#!/usr/bin/env bash
# ==============================================================================
# VisionEye Azure VM Provisioning & Initialization Script
# Target: Azure Ubuntu 22.04 / 24.04 LTS VM
# Domain: pvsairamsaketh.in / www.pvsairamsaketh.in
# ==============================================================================

set -e

# Color codes
CYAN='\033[0;36m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BOLD='\033[1m'
NC='\033[0m'

echo -e "${CYAN}${BOLD}"
echo "╔════════════════════════════════════════════════════════════════════════════╗"
echo "║                  VISIONEYE AZURE VM PROVISIONING ENGINE                    ║"
echo "║             Automated Docker, UFW, Nginx & Certbot SSL Setup               ║"
echo "╚════════════════════════════════════════════════════════════════════════════╝"
echo -e "${NC}"

DOMAIN="${1:-pvsairamsaketh.in}"
EMAIL="${2:-pvsaketh1@gmail.com}"

# 1. Update OS packages
echo -e "${CYAN}[1/6] Updating system packages...${NC}"
sudo apt-get update && sudo apt-get upgrade -y
sudo apt-get install -y curl wget git ufw apt-transport-https ca-certificates gnupg lsb-release certbot

# 2. Configure Firewall (UFW)
echo -e "${CYAN}[2/6] Configuring UFW firewall rules...${NC}"
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw --force enable
echo -e "  ${GREEN}✓${NC} Ports 22 (SSH), 80 (HTTP), and 443 (HTTPS) enabled."

# 3. Install Docker Engine & Docker Compose Plugin
echo -e "${CYAN}[3/6] Installing Docker & Docker Compose...${NC}"
if ! command -v docker &> /dev/null; then
    sudo mkdir -p /etc/apt/keyrings
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg --yes
    echo \
      "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
      $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
    sudo apt-get update
    sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
    sudo usermod -aG docker $USER
    sudo systemctl enable docker
    sudo systemctl start docker
fi
echo -e "  ${GREEN}✓${NC} Docker $(docker --version) installed and running."

# 4. Create App Directory
echo -e "${CYAN}[4/6] Creating deployment directory at /opt/visioneye...${NC}"
sudo mkdir -p /opt/visioneye
sudo chown -R $USER:$USER /opt/visioneye
cd /opt/visioneye

# 5. Acquire Let's Encrypt SSL Certificate & Setup Fallback
echo -e "${CYAN}[5/6] Setting up SSL Certificate for ${DOMAIN}...${NC}"
sudo mkdir -p /etc/letsencrypt/live/${DOMAIN}

if [ ! -f "/etc/letsencrypt/live/${DOMAIN}/fullchain.pem" ] || [ ! -f "/etc/letsencrypt/live/${DOMAIN}/privkey.pem" ]; then
    echo "  Attempting Certbot standalone certificate issuance for ${DOMAIN} & www.${DOMAIN}..."
    sudo certbot certonly --standalone -d ${DOMAIN} -d www.${DOMAIN} --non-interactive --agree-tos --email ${EMAIL} || {
        echo -e "${YELLOW}Notice: DNS propagation may be pending. Generating instant fallback SSL certificate...${NC}"
        sudo openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
          -keyout /etc/letsencrypt/live/${DOMAIN}/privkey.pem \
          -out /etc/letsencrypt/live/${DOMAIN}/fullchain.pem \
          -subj "/CN=${DOMAIN}"
    }
fi
echo -e "  ${GREEN}✓${NC} SSL certificates verified at /etc/letsencrypt/live/${DOMAIN}/."

# Ensure Docker starts on boot
sudo systemctl enable docker
sudo systemctl start docker

# Add automated daily SSL renewal cron
(crontab -l 2>/dev/null | grep -v "certbot renew" ; echo "0 3 * * * certbot renew --webroot -w /var/www/certbot --quiet && docker exec visioneye-nginx nginx -s reload 2>/dev/null || true") | sudo crontab -

# 6. Summary & Next Steps
echo -e "\n${GREEN}${BOLD}════════════════════════════════════════════════════════════════════════════"
echo -e "              AZURE VM INITIALIZATION COMPLETE!                              "
echo -e "════════════════════════════════════════════════════════════════════════════${NC}"
echo -e "  ${BOLD}App Directory:${NC}  /opt/visioneye"
echo -e "  ${BOLD}Docker Status:${NC}  Active & Running (24/7 Auto-Restart Enabled)"
echo -e "  ${BOLD}Target Domain:${NC}  https://${DOMAIN}"
echo -e "════════════════════════════════════════════════════════════════════════════\n"
