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
REMOTE_HOST="${2:-pvsairamsaketh.in}"
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
echo -e "\n${CYAN}[2/6] Deploying frontend to /opt/visioneye/website/live/...${NC}"
$SSH "mkdir -p /opt/visioneye/website/live"
eval rsync -az --delete -e \"ssh $SSH_KEY_ARG -o StrictHostKeyChecking=no\" \
  "$PROJ/frontend/dist/" \
  "$REMOTE_USER@$REMOTE_HOST:/opt/visioneye/website/live/"
echo -e "${GREEN}✓ Frontend synced${NC}"

# Step 3: Deploy website static files & real downloads
echo -e "\n${CYAN}[3/6] Deploying website static files & downloads to VM...${NC}"
$SSH "mkdir -p /opt/visioneye/downloads"
eval rsync -az --exclude='live/' -e \"ssh $SSH_KEY_ARG -o StrictHostKeyChecking=no\" \
  "$PROJ/website/" \
  "$REMOTE_USER@$REMOTE_HOST:/opt/visioneye/website/"
if [ -d "$PROJ/backend/downloads" ]; then
  eval rsync -az -e \"ssh $SSH_KEY_ARG -o StrictHostKeyChecking=no\" \
    "$PROJ/backend/downloads/" \
    "$REMOTE_USER@$REMOTE_HOST:/opt/visioneye/downloads/"
fi
echo -e "${GREEN}✓ Website and download artifacts synced${NC}"

# Step 4: Deploy backend code into visioneye-app container
echo -e "\n${CYAN}[4/6] Updating backend API inside Docker container...${NC}"
$SSH "mkdir -p /tmp/backend_sync"
scp $SSH_KEY_ARG -o StrictHostKeyChecking=no \
  "$PROJ/backend/api/auth_views.py" \
  "$PROJ/backend/api/download_views.py" \
  "$PROJ/backend/api/upload_views.py" \
  "$PROJ/backend/api/views.py" \
  "$PROJ/backend/vision/pipeline.py" \
  "$PROJ/backend/api/urls.py" \
  "$PROJ/backend/config/settings.py" \
  "$REMOTE_USER@$REMOTE_HOST:/tmp/backend_sync/"

$SSH "sudo docker cp /tmp/backend_sync/auth_views.py visioneye-app:/app/backend/api/auth_views.py && \
      sudo docker cp /tmp/backend_sync/download_views.py visioneye-app:/app/backend/api/download_views.py && \
      sudo docker cp /tmp/backend_sync/upload_views.py visioneye-app:/app/backend/api/upload_views.py && \
      sudo docker cp /tmp/backend_sync/views.py visioneye-app:/app/backend/api/views.py && \
      sudo docker cp /tmp/backend_sync/pipeline.py visioneye-app:/app/backend/vision/pipeline.py && \
      sudo docker cp /tmp/backend_sync/urls.py visioneye-app:/app/backend/api/urls.py && \
      sudo docker cp /tmp/backend_sync/settings.py visioneye-app:/app/backend/config/settings.py && \
      sudo docker cp /opt/visioneye/downloads visioneye-app:/app/backend/downloads && \
      sudo docker restart visioneye-app"
echo -e "${GREEN}✓ Backend updated and container restarted${NC}"

# Step 5: Deploy nginx config & reload
echo -e "\n${CYAN}[5/6] Updating Nginx config & reloading container...${NC}"
scp $SSH_KEY_ARG -o StrictHostKeyChecking=no \
  "$PROJ/azure/nginx.conf" \
  "$REMOTE_USER@$REMOTE_HOST:/opt/visioneye/nginx.conf"
$SSH "sudo docker exec visioneye-nginx nginx -s reload 2>/dev/null || sudo docker restart visioneye-nginx 2>/dev/null || true"
echo -e "${GREEN}✓ Nginx updated and reloaded${NC}"

# Step 6: Verify
echo -e "\n${CYAN}[6/6] Verifying deployment...${NC}"
sleep 3
MIME=$(curl -skI "https://$REMOTE_HOST/app.js" | grep -i content-type | head -1)
echo "  app.js MIME: $MIME"
HEALTH=$(curl -sk "https://$REMOTE_HOST/api/health" | python3 -c "import sys,json; d=json.load(sys.stdin); print('✓ Backend Health:', d.get('status','?'))" 2>/dev/null || echo "  (health check N/A)")
echo "  $HEALTH"
DOWNLOADS=$(curl -sk "https://$REMOTE_HOST/api/downloads/info" | python3 -c "import sys,json; d=json.load(sys.stdin); print('✓ Downloads API: v' + d.get('version','?'))" 2>/dev/null || echo "  (downloads check N/A)")
echo "  $DOWNLOADS"
AUTH=$(curl -sk "https://$REMOTE_HOST/api/auth/session" | python3 -c "import sys,json; d=json.load(sys.stdin); print('✓ Auth API Active: session checked')" 2>/dev/null || echo "  (auth check N/A)")
echo "  $AUTH"


echo -e "\n${GREEN}╔═══════════════════════════════════╗"
echo "║  ✓  DEPLOYMENT COMPLETE           ║"
echo -e "╚═══════════════════════════════════╝${NC}"
echo ""
echo "  🌐  https://pvsairamsaketh.in"
echo "  ⚡  https://pvsairamsaketh.in/live"
echo ""
