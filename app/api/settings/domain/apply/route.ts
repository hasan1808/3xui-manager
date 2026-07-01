import { NextResponse } from "next/server";
import { requireAuth, getAuthUser } from "@/lib/auth-api";
import { execSync } from "child_process";
import fs from "fs";
import path from "path";

const NGINX_CONF = "/etc/nginx/sites-available/3xui-manager";
const NGINX_LINK = "/etc/nginx/sites-enabled/3xui-manager";

function readCurrentPort(): string {
  try {
    const serviceFile = "/etc/systemd/system/3xui-manager.service";
    if (fs.existsSync(serviceFile)) {
      const svc = fs.readFileSync(serviceFile, "utf-8");
      const match = svc.match(/Environment=PORT=(\d+)/);
      if (match) return match[1];
    }
  } catch {}
  return process.env.PORT || "3000";
}

export async function POST(req: Request) {
  const auth = await requireAuth(req);
  if (auth) return auth;
  const user = await getAuthUser(req);
  if (!user || user.role !== "superadmin") {
    return NextResponse.json({ error: "فقط مدیر اصلی" }, { status: 403 });
  }

  const { domain, ssl } = await req.json();
  if (!domain) return NextResponse.json({ error: "دامنه الزامی است" }, { status: 400 });

  const port = readCurrentPort();
  const steps: string[] = [];

  try {
    // Install nginx
    try { execSync("which nginx", { timeout: 5000 }); steps.push("Nginx نصب است"); } catch {
      execSync("apt-get update -qq && apt-get install -y -qq nginx", { timeout: 120000 });
      steps.push("Nginx نصب شد");
    }
    execSync("systemctl enable nginx", { timeout: 10000 });

    if (ssl) {
      // Check if cert exists
      const certPath = `/etc/letsencrypt/live/${domain}/fullchain.pem`;
      if (!fs.existsSync(certPath)) {
        // Setup HTTP first, then certbot
        const httpConf = `server {
    listen 80;
    server_name ${domain};

    location / {
        proxy_pass http://127.0.0.1:${port};
        proxy_http_version 1.1;
        proxy_set_header Upgrade \\$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \\$host;
        proxy_set_header X-Real-IP \\$remote_addr;
        proxy_set_header X-Forwarded-For \\$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \\$scheme;
        proxy_read_timeout 86400;
        proxy_send_timeout 86400;
    }
}`;
        fs.writeFileSync(NGINX_CONF, httpConf, "utf-8");
        execSync(`ln -sf ${NGINX_CONF} ${NGINX_LINK}`, { timeout: 5000 });
        execSync("nginx -t", { timeout: 5000 });
        execSync("systemctl reload nginx", { timeout: 10000 });
        steps.push("Nginx HTTP تنظیم شد");

        // Get cert
        try { execSync("which certbot", { timeout: 5000 }); } catch {
          execSync("apt-get install -y -qq certbot python3-certbot-nginx", { timeout: 120000 });
        }
        execSync(`certbot certonly --nginx -d ${domain} --non-interactive --agree-tos --email admin@${domain}`, { timeout: 120000 });
        steps.push("گواهی SSL دریافت شد");
      }

      // SSL nginx config
      const sslConf = `server {
    listen 80;
    server_name ${domain};
    return 301 https://\\$host\\$request_uri;
}

server {
    listen 443 ssl;
    server_name ${domain};

    ssl_certificate /etc/letsencrypt/live/${domain}/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/${domain}/privkey.pem;

    location / {
        proxy_pass http://127.0.0.1:${port};
        proxy_http_version 1.1;
        proxy_set_header Upgrade \\$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \\$host;
        proxy_set_header X-Real-IP \\$remote_addr;
        proxy_set_header X-Forwarded-For \\$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \\$scheme;
        proxy_read_timeout 86400;
        proxy_send_timeout 86400;
    }
}`;
      fs.writeFileSync(NGINX_CONF, sslConf, "utf-8");
      execSync("nginx -t", { timeout: 5000 });
      execSync("systemctl reload nginx", { timeout: 10000 });
      steps.push("Nginx SSL تنظیم شد");
    } else {
      // HTTP only
      const httpConf = `server {
    listen 80;
    server_name ${domain};

    location / {
        proxy_pass http://127.0.0.1:${port};
        proxy_http_version 1.1;
        proxy_set_header Upgrade \\$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \\$host;
        proxy_set_header X-Real-IP \\$remote_addr;
        proxy_set_header X-Forwarded-For \\$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \\$scheme;
        proxy_read_timeout 86400;
        proxy_send_timeout 86400;
    }
}`;
      fs.writeFileSync(NGINX_CONF, httpConf, "utf-8");
      execSync(`ln -sf ${NGINX_CONF} ${NGINX_LINK}`, { timeout: 5000 });
      execSync("nginx -t", { timeout: 5000 });
      execSync("systemctl reload nginx", { timeout: 10000 });
      steps.push("Nginx HTTP تنظیم شد");
    }

    return NextResponse.json({ ok: true, steps });
  } catch (e: any) {
    return NextResponse.json({ error: "خطا: " + e.message, steps }, { status: 500 });
  }
}
