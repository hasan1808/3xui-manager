#!/bin/bash

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

INSTALL_DIR="/var/www/3xui-manager"
SERVICE_NAME="3xui-manager"
NGINX_CONF="/etc/nginx/sites-available/3xui-manager"
NODE_MIN_VERSION=18

clear
echo -e "${CYAN}"
echo "╔══════════════════════════════════════════╗"
echo "║       3X-UI Manager - Auto Installer     ║"
echo "║    Centralized 3x-ui Panel Dashboard     ║"
echo "╚══════════════════════════════════════════╝"
echo -e "${NC}"

echo ""
echo -e "${YELLOW}Please enter the following information:${NC}"
echo ""

read -p "Admin username [admin]: " ADMIN_USER
ADMIN_USER=${ADMIN_USER:-admin}

read -s -p "Admin password [admin123]: " ADMIN_PASS
ADMIN_PASS=${ADMIN_PASS:-admin123}
echo ""

read -p "Domain name (e.g. panel.example.com): " DOMAIN_NAME

read -p "Server port [3000]: " PORT
PORT=${PORT:-3000}

echo ""
echo -e "${CYAN}Configuration summary:${NC}"
echo -e "  Username: ${GREEN}${ADMIN_USER}${NC}"
echo -e "  Port:     ${GREEN}${PORT}${NC}"
if [[ -n "$DOMAIN_NAME" ]]; then
    echo -e "  Domain:   ${GREEN}${DOMAIN_NAME}${NC}"
    echo -e "  SSL:      ${GREEN}Let's Encrypt (auto)${NC}"
else
    echo -e "  Domain:   ${YELLOW}Not set (HTTP only)${NC}"
fi
echo ""
read -p "Continue with installation? (y/n): " CONFIRM
if [[ "$CONFIRM" != "y" && "$CONFIRM" != "Y" ]]; then
    echo -e "${RED}Installation cancelled.${NC}"
    exit 1
fi

echo ""
echo -e "${CYAN}[1/10] Checking system...${NC}"

if [[ $EUID -ne 0 ]]; then
    echo -e "${RED}This script must be run as root:${NC}"
    echo -e "  sudo ./install.sh"
    exit 1
fi

echo -e "${GREEN}  ✓ Root access confirmed${NC}"

echo ""
echo -e "${CYAN}[2/10] Updating system packages...${NC}"
export DEBIAN_FRONTEND=noninteractive
export NEEDRESTART_MODE=l
echo -e "${YELLOW}  ⟳ apt update${NC}"
apt-get update -qq 2>&1 | tail -5 || echo -e "${YELLOW}  ⚠ apt update completed${NC}"
echo ""
echo -e "${YELLOW}  ⟳ apt upgrade${NC}"
apt-get upgrade -y -qq -o Dpkg::Options::="--force-confdef" -o Dpkg::Options::="--force-confold" 2>&1 | tail -10 || echo -e "${YELLOW}  ⚠ apt upgrade completed${NC}"
echo ""
echo -e "${YELLOW}  ⟳ Installing curl, git, build-essential${NC}"
apt-get install -y -qq curl git build-essential > /dev/null 2>&1
echo -e "${GREEN}  ✓ Base packages installed${NC}"

echo ""
echo -e "${CYAN}[3/10] Installing Node.js...${NC}"

if command -v node &> /dev/null; then
    NODE_CURRENT=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
    if [[ "$NODE_CURRENT" -ge "$NODE_MIN_VERSION" ]]; then
        echo -e "${GREEN}  ✓ Node.js $(node -v) is already installed${NC}"
    else
        echo -e "${YELLOW}  ⚠ Node.js is outdated. Updating...${NC}"
        curl -fsSL https://deb.nodesource.com/setup_20.x | bash - > /dev/null 2>&1
        apt-get install -y -qq nodejs > /dev/null 2>&1
        echo -e "${GREEN}  ✓ Node.js $(node -v) installed${NC}"
    fi
else
    echo -e "${YELLOW}  ⚠ Node.js not found. Installing...${NC}"
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash - > /dev/null 2>&1
    apt-get install -y -qq nodejs > /dev/null 2>&1
    echo -e "${GREEN}  ✓ Node.js $(node -v) installed${NC}"
fi

echo ""
echo -e "${CYAN}[4/10] Installing Nginx...${NC}"

if ! command -v nginx &> /dev/null; then
    apt-get install -y -qq nginx > /dev/null 2>&1
fi
systemctl enable nginx > /dev/null 2>&1
systemctl start nginx > /dev/null 2>&1
echo -e "${GREEN}  ✓ Nginx installed${NC}"

echo ""
echo -e "${CYAN}[5/10] Downloading project...${NC}"

if [[ -d "$INSTALL_DIR" ]]; then
    echo -e "${YELLOW}  ⚠ Project already installed. Updating...${NC}"
    cd "$INSTALL_DIR"
    git pull > /dev/null 2>&1 || true
else
    git clone https://github.com/hasan1808/3xui-manager.git "$INSTALL_DIR" > /dev/null 2>&1
    cd "$INSTALL_DIR"
fi
echo -e "${GREEN}  ✓ Project downloaded${NC}"

echo ""
echo -e "${CYAN}[6/10] Installing dependencies (this may take a few minutes)...${NC}"
npm ci --legacy-peer-deps 2>&1 | tail -10
if [ ${PIPESTATUS[0]} -ne 0 ]; then
  echo -e "${RED}  ✗ npm install failed!${NC}"
  exit 1
fi
echo -e "${GREEN}  ✓ Dependencies installed${NC}"

echo ""
echo -e "${CYAN}[7/10] Setting up configuration...${NC}"

JWT_SECRET=$(openssl rand -hex 32 2>/dev/null || head -c 32 /dev/urandom | base64 | tr -d '\n')

SSL_ENV=""
if [[ -n "$DOMAIN_NAME" ]]; then
    SSL_ENV="SSL_ENABLED=true"
fi

cat > .env.local << EOF
JWT_SECRET=${JWT_SECRET}
PORT=${PORT}
${SSL_ENV}
EOF

mkdir -p data/backups/panels
printf '%s' "$ADMIN_PASS" > data/.admin-pass
printf '%s' "$ADMIN_USER" > data/.admin-user
echo -e "${GREEN}  ✓ Configuration saved${NC}"

echo ""
echo -e "${CYAN}[8/10] Building project...${NC}"
npm run build -- --webpack 2>&1 | tail -15
if [ ${PIPESTATUS[0]} -ne 0 ]; then
  echo -e "${RED}  ✗ Build failed! Check the error above.${NC}"
  exit 1
fi
echo -e "${GREEN}  ✓ Project built successfully${NC}"

echo ""
echo -e "${CYAN}[9/10] Configuring Nginx reverse proxy...${NC}"

if [[ -n "$DOMAIN_NAME" ]]; then
    apt-get install -y -qq certbot python3-certbot-nginx > /dev/null 2>&1

    cat > /etc/nginx/sites-available/3xui-manager << NGINX_EOF
server {
    listen 80;
    server_name ${DOMAIN_NAME};

    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    location / {
        proxy_pass http://127.0.0.1:${PORT};
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_read_timeout 86400;
        proxy_send_timeout 86400;
    }
}
NGINX_EOF

    mkdir -p /var/www/certbot
    ln -sf /etc/nginx/sites-available/3xui-manager /etc/nginx/sites-enabled/3xui-manager
    rm -f /etc/nginx/sites-enabled/default
    nginx -t 2>&1
    systemctl reload nginx > /dev/null 2>&1

    echo -e "${YELLOW}  ⟳ Requesting SSL certificate...${NC}"
    SSL_OK=false
    if certbot certonly --webroot -w /var/www/certbot -d "$DOMAIN_NAME" --non-interactive --agree-tos --email "admin@${DOMAIN_NAME}" 2>&1; then
        SSL_OK=true
        echo -e "${GREEN}  ✓ SSL certificate obtained${NC}"

        CERT_PATH="/etc/letsencrypt/live/${DOMAIN_NAME}"
        cat > /etc/nginx/sites-available/3xui-manager << NGINX_EOF
server {
    listen 80;
    server_name ${DOMAIN_NAME};
    return 301 https://\\\$host\\\$request_uri;
}

server {
    listen 443 ssl;
    server_name ${DOMAIN_NAME};

    ssl_certificate ${CERT_PATH}/fullchain.pem;
    ssl_certificate_key ${CERT_PATH}/privkey.pem;

    location / {
        proxy_pass http://127.0.0.1:${PORT};
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_read_timeout 86400;
        proxy_send_timeout 86400;
    }
}
NGINX_EOF
        nginx -t 2>&1 && systemctl reload nginx > /dev/null 2>&1
    else
        SSL_OK=false
        echo -e "${YELLOW}  ⚠ SSL certificate failed. Panel available at HTTP.${NC}"
        sed -i 's/SSL_ENABLED=true/SSL_ENABLED=false/' .env.local

        cat > /etc/nginx/sites-available/3xui-manager << NGINX_EOF
server {
    listen 80;
    server_name ${DOMAIN_NAME};

    location / {
        proxy_pass http://127.0.0.1:${PORT};
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_read_timeout 86400;
        proxy_send_timeout 86400;
    }
}
NGINX_EOF
        nginx -t 2>&1 || true
        systemctl reload nginx > /dev/null 2>&1 || true
    fi
else
    cat > /etc/nginx/sites-available/3xui-manager << NGINX_EOF
server {
    listen 80;
    server_name _;

    location / {
        proxy_pass http://127.0.0.1:${PORT};
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_read_timeout 86400;
        proxy_send_timeout 86400;
    }
}
NGINX_EOF

    ln -sf /etc/nginx/sites-available/3xui-manager /etc/nginx/sites-enabled/3xui-manager
    rm -f /etc/nginx/sites-enabled/default
    nginx -t > /dev/null 2>&1 || true
    systemctl reload nginx > /dev/null 2>&1 || true
fi

echo -e "${GREEN}  ✓ Nginx configured${NC}"

echo ""
echo -e "${CYAN}[10/10] Setting up systemd service...${NC}"

cat > /etc/systemd/system/${SERVICE_NAME}.service << EOF
[Unit]
Description=3X-UI Manager Dashboard
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=${INSTALL_DIR}
ExecStart=$(which npm) start
Restart=always
RestartSec=10
Environment=NODE_ENV=production
Environment=PORT=${PORT}
${SSL_ENV:+Environment=SSL_ENABLED=true}

[Install]
WantedBy=multi-user.target
EOF

chown -R root:root "$INSTALL_DIR"
chmod -R 755 "$INSTALL_DIR"

systemctl daemon-reload
systemctl enable ${SERVICE_NAME} > /dev/null 2>&1
systemctl restart ${SERVICE_NAME}
echo -e "${GREEN}  ✓ Service enabled and started${NC}"

echo ""
echo -e "${CYAN}Checking service status...${NC}"
echo ""
sleep 2

if systemctl is-active --quiet ${SERVICE_NAME}; then
    echo -e "${GREEN}╔══════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║       ✅ Installation Successful!        ║${NC}"
    echo -e "${GREEN}╚══════════════════════════════════════════╝${NC}"
    echo ""

    SERVER_IP=$(hostname -I | awk '{print $1}')

    if [[ -n "$DOMAIN_NAME" ]] && [[ "$SSL_OK" == "true" ]]; then
        echo -e "  Access URL:  ${CYAN}https://${DOMAIN_NAME}${NC}"
    elif [[ -n "$DOMAIN_NAME" ]]; then
        echo -e "  Access URL:  ${CYAN}http://${DOMAIN_NAME}${NC}"
    else
        echo -e "  Access URL:  ${CYAN}http://${SERVER_IP}:${PORT}${NC}"
    fi

    echo -e "  Port:        ${YELLOW}${PORT}${NC}"
    echo -e "  Username:    ${YELLOW}${ADMIN_USER}${NC}"
    echo -e "  Password:    ${YELLOW}${ADMIN_PASS}${NC}"
    echo ""
    echo -e "  ${YELLOW}Useful commands:${NC}"
    echo -e "  Update:        cd ${INSTALL_DIR} && git pull && npm run build -- --webpack && systemctl restart ${SERVICE_NAME}"
    echo -e "  Check status:  systemctl status ${SERVICE_NAME}"
    echo -e "  Restart:       systemctl restart ${SERVICE_NAME}"
    echo -e "  Stop:          systemctl stop ${SERVICE_NAME}"
    echo -e "  Logs:          journalctl -u ${SERVICE_NAME} -f"
    echo -e "  Uninstall:     sudo ./uninstall.sh"
    echo ""
    echo -e "${RED}  ⚠ Please change the default password!${NC}"
    echo ""
else
    echo -e "${RED}╔══════════════════════════════════════════╗${NC}"
    echo -e "${RED}║       ⚠ Installation Completed           ║${NC}"
    echo -e "${RED}║       But the service failed to start    ║${NC}"
    echo -e "${RED}╚══════════════════════════════════════════╝${NC}"
    echo ""

    SERVER_IP=$(hostname -I | awk '{print $1}')

    echo -e "  ${YELLOW}Panel Info:${NC}"
    if [[ -n "$DOMAIN_NAME" ]]; then
        echo -e "  Access URL:  ${CYAN}http://${DOMAIN_NAME}${NC}"
    else
        echo -e "  Access URL:  ${CYAN}http://${SERVER_IP}:${PORT}${NC}"
    fi
    echo -e "  Port:        ${YELLOW}${PORT}${NC}"
    echo -e "  Username:    ${YELLOW}${ADMIN_USER}${NC}"
    echo -e "  Password:    ${YELLOW}${ADMIN_PASS}${NC}"
    echo ""
    echo -e "  ${YELLOW}Checking logs for errors:${NC}"
    echo ""
    systemctl status ${SERVICE_NAME} --no-pager 2>&1 | head -20
    echo ""
    echo -e "  ${YELLOW}Try to start manually:${NC}"
    echo -e "  journalctl -u ${SERVICE_NAME} --no-pager -n 30"
    echo ""
    echo -e "  ${YELLOW}Useful commands:${NC}"
    echo -e "  Update:        cd ${INSTALL_DIR} && git pull && npm run build -- --webpack && systemctl restart ${SERVICE_NAME}"
    echo -e "  Restart:       systemctl restart ${SERVICE_NAME}"
    echo -e "  Logs:          journalctl -u ${SERVICE_NAME} -f"
    echo -e "  Uninstall:     sudo ./uninstall.sh"
    echo ""
fi
