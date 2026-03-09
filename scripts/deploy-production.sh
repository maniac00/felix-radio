#!/bin/bash
set -e

# Felix Radio - Production Deployment Script
# Deploys all 3 services: API (Cloudflare Workers), Web (Vercel), Recorder (Vultr VPS Docker)

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Configuration
WORKER_URL="https://felix-radio-api.7wario.workers.dev"
VPS_HOST="158.247.206.183"
VPS_USER="root"
RECORDER_DIR="/root/felix-radio/packages/recorder"

# Check if running from project root
if [ ! -f "pnpm-workspace.yaml" ]; then
  echo -e "${RED}Error: Must run from project root${NC}"
  exit 1
fi

echo "Felix Radio - Production Deployment"
echo "===================================="
echo ""

# Parse arguments
SKIP_API=false
SKIP_WEB=false
SKIP_RECORDER=false

for arg in "$@"; do
  case $arg in
    --skip-api) SKIP_API=true ;;
    --skip-web) SKIP_WEB=true ;;
    --skip-recorder) SKIP_RECORDER=true ;;
    --api-only) SKIP_WEB=true; SKIP_RECORDER=true ;;
    --web-only) SKIP_API=true; SKIP_RECORDER=true ;;
    --recorder-only) SKIP_API=true; SKIP_WEB=true ;;
    --help)
      echo "Usage: ./scripts/deploy-production.sh [options]"
      echo ""
      echo "Options:"
      echo "  --skip-api        Skip API deployment"
      echo "  --skip-web        Skip Web deployment"
      echo "  --skip-recorder   Skip Recorder deployment"
      echo "  --api-only        Deploy API only"
      echo "  --web-only        Deploy Web only"
      echo "  --recorder-only   Deploy Recorder only"
      exit 0
      ;;
  esac
done

# ── Step 1: Prerequisites ──────────────────────────────────────────

echo "Step 1: Checking prerequisites..."
echo "-----------------------------------"

# Check git status
if [ -n "$(git status --porcelain)" ]; then
  echo -e "${YELLOW}Warning: Uncommitted changes detected${NC}"
  read -p "Continue anyway? (y/n) " -n 1 -r
  echo
  if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    exit 1
  fi
else
  echo -e "${GREEN}✓ Git status clean${NC}"
fi

# ── Step 2: Deploy API (Cloudflare Workers) ─────────────────────────

if [ "$SKIP_API" = false ]; then
  echo ""
  echo "Step 2: Deploying API (Cloudflare Workers)..."
  echo "----------------------------------------------"

  if ! command -v wrangler &> /dev/null && ! npx wrangler --version &> /dev/null; then
    echo -e "${RED}Error: wrangler CLI not found${NC}"
    exit 1
  fi

  cd apps/api
  npx wrangler deploy

  echo -e "${GREEN}✓ API deployed: ${WORKER_URL}${NC}"

  # Health check
  echo "Running health check..."
  sleep 2
  HEALTH_RESPONSE=$(curl -s "${WORKER_URL}/health" || echo "error")
  if echo "$HEALTH_RESPONSE" | grep -q "ok"; then
    echo -e "${GREEN}✓ Health check passed${NC}"
  else
    echo -e "${YELLOW}Warning: Health check returned unexpected response${NC}"
    echo "Response: $HEALTH_RESPONSE"
  fi

  cd ../..
else
  echo -e "${YELLOW}Skipping API deployment${NC}"
fi

# ── Step 3: Deploy Web (Vercel) ─────────────────────────────────────

if [ "$SKIP_WEB" = false ]; then
  echo ""
  echo "Step 3: Deploying Web (Vercel)..."
  echo "----------------------------------"

  if ! command -v vercel &> /dev/null && ! npx vercel --version &> /dev/null; then
    echo -e "${RED}Error: vercel CLI not found${NC}"
    exit 1
  fi

  cd apps/web
  npx vercel --prod --yes

  echo -e "${GREEN}✓ Web deployed to Vercel${NC}"
  cd ../..
else
  echo -e "${YELLOW}Skipping Web deployment${NC}"
fi

# ── Step 4: Deploy Recorder (Vultr VPS Docker) ──────────────────────

if [ "$SKIP_RECORDER" = false ]; then
  echo ""
  echo "Step 4: Deploying Recorder (Vultr VPS)..."
  echo "-------------------------------------------"

  # Check sshpass
  if ! command -v sshpass &> /dev/null; then
    echo -e "${RED}Error: sshpass not found. Install with: brew install hudochenkov/sshpass/sshpass${NC}"
    exit 1
  fi

  # Read VPS password
  if [ -z "$VPS_PASSWORD" ]; then
    read -s -p "VPS password for ${VPS_USER}@${VPS_HOST}: " VPS_PASSWORD
    echo
  fi

  SSH_CMD="sshpass -e ssh -o StrictHostKeyChecking=accept-new -o PubkeyAuthentication=no -o PreferredAuthentications=password ${VPS_USER}@${VPS_HOST}"

  # Test connection
  echo "Connecting to VPS..."
  if ! SSHPASS="$VPS_PASSWORD" $SSH_CMD "echo connected" &> /dev/null; then
    echo -e "${RED}Error: Failed to connect to VPS${NC}"
    exit 1
  fi
  echo -e "${GREEN}✓ VPS connection OK${NC}"

  # Pull latest code
  echo "Pulling latest code..."
  SSHPASS="$VPS_PASSWORD" $SSH_CMD "cd /root/felix-radio && git pull"
  echo -e "${GREEN}✓ Code updated${NC}"

  # Docker rebuild and restart
  echo "Building and restarting Docker container..."
  SSHPASS="$VPS_PASSWORD" $SSH_CMD "cd ${RECORDER_DIR} && docker compose down && docker compose build --no-cache && docker compose up -d"
  echo -e "${GREEN}✓ Docker container rebuilt and started${NC}"

  # Verify container is running
  echo "Verifying container status..."
  sleep 2
  CONTAINER_STATUS=$(SSHPASS="$VPS_PASSWORD" $SSH_CMD "docker compose -f ${RECORDER_DIR}/docker-compose.yml ps --format '{{.Status}}'" 2>/dev/null || echo "unknown")
  if echo "$CONTAINER_STATUS" | grep -q "Up"; then
    echo -e "${GREEN}✓ Recorder container is running${NC}"
  else
    echo -e "${YELLOW}Warning: Container status: ${CONTAINER_STATUS}${NC}"
    echo "Check logs with: ssh ${VPS_USER}@${VPS_HOST} 'docker logs felix-recorder --tail 20'"
  fi

  # Show recent logs
  echo ""
  echo "Recent recorder logs:"
  SSHPASS="$VPS_PASSWORD" $SSH_CMD "docker logs felix-recorder --tail 5" 2>&1
else
  echo -e "${YELLOW}Skipping Recorder deployment${NC}"
fi

# ── Summary ─────────────────────────────────────────────────────────

echo ""
echo "===================================="
echo "Deployment Summary"
echo "===================================="
[ "$SKIP_API" = false ] && echo -e "${GREEN}✓ API:      ${WORKER_URL}${NC}"
[ "$SKIP_WEB" = false ] && echo -e "${GREEN}✓ Web:      Vercel (see URL above)${NC}"
[ "$SKIP_RECORDER" = false ] && echo -e "${GREEN}✓ Recorder: ${VPS_USER}@${VPS_HOST} (Docker)${NC}"
echo ""
echo "Useful commands:"
echo "  API logs:      cd apps/api && npx wrangler tail"
echo "  Recorder logs: ssh ${VPS_USER}@${VPS_HOST} 'docker logs felix-recorder -f'"
echo ""
echo -e "${GREEN}Deployment complete!${NC}"
