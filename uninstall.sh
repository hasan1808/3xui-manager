#!/bin/bash

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

INSTALL_DIR="/var/www/3xui-manager"
SERVICE_NAME="3xui-manager"

clear
echo -e "${CYAN}"
echo "╔══════════════════════════════════════════╗"
echo "║       3X-UI Manager - Uninstaller        ║"
echo "╚══════════════════════════════════════════╝"
echo -e "${NC}"

if [[ $EUID -ne 0 ]]; then
    echo -e "${RED}This script must be run as root:${NC}"
    echo -e "  sudo ./uninstall.sh"
    exit 1
fi

echo ""
read -p "Are you sure you want to uninstall? (y/n): " CONFIRM
if [[ "$CONFIRM" != "y" && "$CONFIRM" != "Y" ]]; then
    echo -e "${YELLOW}Uninstall cancelled.${NC}"
    exit 1
fi

echo ""
echo -e "${CYAN}[1/5] Stopping service...${NC}"
systemctl stop ${SERVICE_NAME} 2>/dev/null || true
systemctl disable ${SERVICE_NAME} 2>/dev/null || true
rm -f /etc/systemd/system/${SERVICE_NAME}.service
systemctl daemon-reload 2>/dev/null || true
echo -e "${GREEN}  ✓ Service removed${NC}"

echo ""
echo -e "${CYAN}[2/5] Removing Nginx config...${NC}"
DOMAIN_NAME=""
if [[ -f /etc/nginx/sites-available/3xui-manager ]]; then
    DOMAIN_NAME=$(grep -oP 'server_name\s+\K[^;]+' /etc/nginx/sites-available/3xui-manager 2>/dev/null | grep -v '^_$' | head -1)
fi
rm -f /etc/nginx/sites-available/3xui-manager
rm -f /etc/nginx/sites-enabled/3xui-manager
if command -v nginx &> /dev/null; then
    if [[ -f /etc/nginx/sites-enabled/default ]]; then
        ln -sf /etc/nginx/sites-available/default /etc/nginx/sites-enabled/default 2>/dev/null || true
    fi
    nginx -t > /dev/null 2>&1 && systemctl reload nginx > /dev/null 2>&1 || true
fi
echo -e "${GREEN}  ✓ Nginx config removed${NC}"

echo ""
echo -e "${CYAN}[3/5] Removing SSL certificates...${NC}"
if command -v certbot &> /dev/null; then
    if [[ -n "$DOMAIN_NAME" ]]; then
        certbot delete --cert-name "$DOMAIN_NAME" -q 2>/dev/null || true
    fi
fi
echo -e "${GREEN}  ✓ SSL certificates removed${NC}"

echo ""
echo -e "${CYAN}[4/5] Removing files...${NC}"
read -p "Also delete data directory (data/)? (y/n): " DEL_DATA
if [[ "$DEL_DATA" == "y" || "$DEL_DATA" == "Y" ]]; then
    rm -rf "$INSTALL_DIR"
    echo -e "${GREEN}  ✓ Project and data removed${NC}"
else
    rm -rf "$INSTALL_DIR/."* "$INSTALL_DIR/app" "$INSTALL_DIR/lib" "$INSTALL_DIR/public" "$INSTALL_DIR/package.json" "$INSTALL_DIR/package-lock.json" "$INSTALL_DIR/tsconfig.json" "$INSTALL_DIR/next.config.ts" "$INSTALL_DIR/postcss.config.mjs" "$INSTALL_DIR/eslint.config.mjs" "$INSTALL_DIR/middleware.ts" "$INSTALL_DIR/install.sh" "$INSTALL_DIR/uninstall.sh" "$INSTALL_DIR/README.md"
    echo -e "${GREEN}  ✓ Project files removed (data preserved)${NC}"
fi

echo ""
echo -e "${CYAN}[5/5] Cleanup complete...${NC}"
systemctl restart nginx 2>/dev/null || true
echo -e "${GREEN}  ✓ Nginx restarted${NC}"

echo ""
echo -e "${GREEN}╔══════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║       ✅ Uninstall Complete               ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════╝${NC}"
echo ""
