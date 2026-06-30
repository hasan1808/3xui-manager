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
  try {
    const envPath = path.join(process.cwd(), ".env.local");
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, "utf-8");
      const match = content.match(/^PORT=(.+)$/m);
      if (match) return match[1].trim();
    }
  } catch {}
  return process.env.PORT || "3000";
}

export async function GET(req: Request) {
  const auth = await requireAuth(req);
  if (auth) return auth;

  let domain = "";
  let ssl = false;

  try {
    if (fs.existsSync(NGINX_CONF)) {
      const conf = fs.readFileSync(NGINX_CONF, "utf-8");
      const match = conf.match(/server_name\s+([^;]+);/);
      if (match) {
        const serverName = match[1].trim();
        if (serverName !== "_" && serverName !== "localhost") {
          domain = serverName;
        }
      }
      ssl = conf.includes("listen 443 ssl");
    }
  } catch {}

  return NextResponse.json({ domain, ssl });
}

export async function PUT(req: Request) {
  const auth = await requireAuth(req);
  if (auth) return auth;
  const user = await getAuthUser(req);
  if (!user || user.role !== "superadmin") {
    return NextResponse.json({ error: "فقط مدیر اصلی" }, { status: 403 });
  }

  const { domain, enableSsl } = await req.json();

  if (!domain || !domain.trim()) {
    return NextResponse.json({ error: "دامنه الزامی است" }, { status: 400 });
  }

  const domainClean = domain.trim().toLowerCase();
  const port = readCurrentPort();

  try {
    // Install nginx if not installed
    try { execSync("which nginx", { timeout: 5000 }); } catch {
      execSync("apt-get update -qq && apt-get install -y -qq nginx", { timeout: 120000 });
    }
    execSync("systemctl enable nginx", { timeout: 10000 });

    if (enableSsl) {
      // Install certbot if not installed
      try { execSync("which certbot", { timeout: 5000 }); } catch {
        execSync("apt-get install -y -qq certbot python3-certbot-nginx", { timeout: 120000 });
      }

      // HTTP redirect
      const conf = `server {
    listen 80;
    server_name ${domainClean};
    return 301 https://\\$host\\$request_uri;
}

server {
    listen 443 ssl;
    server_name ${domainClean};

    ssl_certificate /etc/letsencrypt/live/${domainClean}/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/${domainClean}/privkey.pem;

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
      fs.writeFileSync(NGINX_CONF, conf, "utf-8");

      // Enable site
      execSync(`ln -sf ${NGINX_CONF} ${NGINX_LINK}`, { timeout: 5000 });
      execSync("rm -f /etc/nginx/sites-enabled/default", { timeout: 5000 });
      execSync("nginx -t", { timeout: 5000 });
      execSync("systemctl reload nginx", { timeout: 10000 });

      // Get SSL certificate
      try {
        execSync(`certbot --nginx -d ${domainClean} --non-interactive --agree-tos --redirect`, { timeout: 120000 });
      } catch {
        return NextResponse.json({ ok: true, domain: domainClean, ssl: false, message: `دامنه ${domainClean} تنظیم شد. SSL ناموفق بود - بعداً دوباره تلاش کنید.` });
      }

      // Enable SSL in env
      const envPath = path.join(process.cwd(), ".env.local");
      let envContent = "";
      if (fs.existsSync(envPath)) envContent = fs.readFileSync(envPath, "utf-8");
      if (envContent.match(/SSL_ENABLED=/)) {
        envContent = envContent.replace(/SSL_ENABLED=\w+/, "SSL_ENABLED=true");
      } else {
        envContent += "\nSSL_ENABLED=true";
      }
      fs.writeFileSync(envPath, envContent, "utf-8");

      return NextResponse.json({ ok: true, domain: domainClean, ssl: true, message: `دامنه ${domainClean} با SSL تنظیم شد` });
    } else {
      // No SSL - HTTP only
      const conf = `server {
    listen 80;
    server_name ${domainClean};

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
      fs.writeFileSync(NGINX_CONF, conf, "utf-8");
      execSync(`ln -sf ${NGINX_CONF} ${NGINX_LINK}`, { timeout: 5000 });
      execSync("rm -f /etc/nginx/sites-enabled/default", { timeout: 5000 });
      execSync("nginx -t", { timeout: 5000 });
      execSync("systemctl reload nginx", { timeout: 10000 });

      return NextResponse.json({ ok: true, domain: domainClean, ssl: false, message: `دامنه ${domainClean} تنظیم شد (HTTP)` });
    }
  } catch (e: any) {
    return NextResponse.json({ error: "خطا: " + e.message }, { status: 500 });
  }
}
