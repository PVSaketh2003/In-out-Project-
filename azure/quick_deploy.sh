#!/usr/bin/env bash
# ============================================================
# VisionEye Quick Deploy Script (Direct SSH to Azure VM)
# Usage: bash azure/quick_deploy.sh <path_to_ssh_key>
# Example: bash azure/quick_deploy.sh ~/.ssh/visioneye_key.pem
#
# If no key arg provided, uses SSH agent (if configured).
# This bypasses GitHub Actions for urgent hotfixes.
# ============================================================

set -e
CYAN='\033[0;36m'; GREEN='\033[0;32m'; RED='\033[0;31m'; NC='\033[0m'

REMOTE_USER="azureuser"
REMOTE_HOST="pvsairamsaketh.in"
PROJ="$(cd "$(dirname "$0")/.." && pwd)"

SSH_KEY_ARG=""
if [[ -n "$1" ]]; then
  SSH_KEY_ARG="-i $1"
fi

SSH="ssh $SSH_KEY_ARG -o StrictHostKeyChecking=no $REMOTE_USER@$REMOTE_HOST"
RSYNC="rsync -az --delete -e 'ssh $SSH_KEY_ARG -o StrictHostKeyChecking=no'"

echo -e "${CYAN}╔══════════════════════════════════════════╗"
echo -e "║   VISIONEYE QUICK DEPLOY → Azure VM      ║"
echo -e "╚══════════════════════════════════════════╝${NC}"

# Step 1: Build frontend
echo -e "\n${CYAN}[1/5] Building React frontend...${NC}"
cd "$PROJ/frontend" && npm run build
echo -e "${GREEN}✓ Frontend built${NC}"

# Step 2: Deploy frontend dist
echo -e "\n${CYAN}[2/5] Deploying frontend to /var/www/website/live/...${NC}"
eval rsync -az --delete -e \"ssh $SSH_KEY_ARG -o StrictHostKeyChecking=no\" \
  "$PROJ/frontend/dist/" \
  "$REMOTE_USER@$REMOTE_HOST:/var/www/website/live/"
echo -e "${GREEN}✓ Frontend synced${NC}"

# Step 3: Deploy website static files
echo -e "\n${CYAN}[3/5] Deploying website static files to /var/www/website/...${NC}"
eval rsync -az --exclude='live/' -e \"ssh $SSH_KEY_ARG -o StrictHostKeyChecking=no\" \
  "$PROJ/website/" \
  "$REMOTE_USER@$REMOTE_HOST:/var/www/website/"
echo -e "${GREEN}✓ Website files synced${NC}"

# Step 4: Deploy nginx config
echo -e "\n${CYAN}[4/5] Updating Nginx config...${NC}"
scp $SSH_KEY_ARG -o StrictHostKeyChecking=no \
  "$PROJ/azure/nginx.conf" \
  "$REMOTE_USER@$REMOTE_HOST:/tmp/nginx_new.conf"
$SSH "sudo cp /tmp/nginx_new.conf /etc/nginx/nginx.conf && sudo nginx -t && sudo nginx -s reload"
echo -e "${GREEN}✓ Nginx updated and reloaded${NC}"

# Step 5: Verify
echo -e "\n${CYAN}[5/5] Verifying deployment...${NC}"
sleep 2
MIME=$(curl -skI "https://$REMOTE_HOST/app.js" | grep -i content-type | head -1)
echo "  app.js MIME: $MIME"
HEALTH=$(curl -sk "https://$REMOTE_HOST/api/health" | python3 -c "import sys,json; d=json.load(sys.stdin); print('✓ Backend:', d.get('status','?'))" 2>/dev/null || echo "  (health check N/A)")
echo "  $HEALTH"

echo -e "\n${GREEN}╔═══════════════════════════════════╗"
echo "║  ✓  DEPLOYMENT COMPLETE           ║"
echo -e "╚═══════════════════════════════════╝${NC}"
echo ""
echo "  🌐  https://pvsairamsaketh.in"
echo "  ⚡  https://pvsairamsaketh.in/live"
echo ""
