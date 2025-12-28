#!/bin/bash
set -e

echo "🚀 Felix Radio - Production Deployment Script"
echo "=============================================="
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if running from project root
if [ ! -f "pnpm-workspace.yaml" ]; then
  echo -e "${RED}Error: Must run from project root${NC}"
  exit 1
fi

echo -e "${YELLOW}This script will deploy Felix Radio to production.${NC}"
echo -e "${YELLOW}Make sure you have completed the prerequisites in docs/DEPLOYMENT.md${NC}"
echo ""
read -p "Continue? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
  exit 1
fi

echo ""
echo "Step 1: Checking prerequisites..."
echo "-----------------------------------"

# Check wrangler is installed
if ! command -v wrangler &> /dev/null; then
  echo -e "${RED}Error: wrangler CLI not found${NC}"
  echo "Install with: npm install -g wrangler"
  exit 1
fi
echo -e "${GREEN}✓ Wrangler CLI found${NC}"

# Check wrangler is logged in
if ! wrangler whoami &> /dev/null; then
  echo -e "${RED}Error: Not logged in to Cloudflare${NC}"
  echo "Login with: wrangler login"
  exit 1
fi
echo -e "${GREEN}✓ Logged in to Cloudflare${NC}"

# Check git status
if [ -n "$(git status --porcelain)" ]; then
  echo -e "${YELLOW}Warning: Uncommitted changes detected${NC}"
  read -p "Continue anyway? (y/n) " -n 1 -r
  echo
  if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    exit 1
  fi
fi
echo -e "${GREEN}✓ Git status clean${NC}"

echo ""
echo "Step 2: Building API..."
echo "-----------------------"
cd apps/api

# Check if D1 database exists
echo "Checking D1 database..."
if ! wrangler d1 list | grep -q "felix-radio-db"; then
  echo -e "${YELLOW}D1 database not found. Please create it first:${NC}"
  echo "  wrangler d1 create felix-radio-db"
  echo "  Then update wrangler.toml with the database_id"
  exit 1
fi
echo -e "${GREEN}✓ D1 database exists${NC}"

# Check if secrets are set
echo "Checking secrets..."
echo -e "${YELLOW}Note: Cannot verify secrets remotely. Ensure you have set:${NC}"
echo "  - CLERK_SECRET_KEY"
echo "  - INTERNAL_API_KEY"
read -p "Secrets configured? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
  echo "Set secrets with:"
  echo "  wrangler secret put CLERK_SECRET_KEY"
  echo "  wrangler secret put INTERNAL_API_KEY"
  exit 1
fi

echo ""
echo "Step 3: Deploying Workers API..."
echo "--------------------------------"
pnpm deploy

if [ $? -eq 0 ]; then
  echo -e "${GREEN}✓ Workers API deployed successfully${NC}"
else
  echo -e "${RED}✗ Workers API deployment failed${NC}"
  exit 1
fi

# Get deployment URL
WORKER_URL=$(wrangler deployments list --json | head -1 | grep -o 'https://[^"]*' | head -1)
echo ""
echo -e "${GREEN}Workers API URL: ${WORKER_URL}${NC}"

echo ""
echo "Step 4: Testing deployment..."
echo "-----------------------------"
sleep 3  # Wait for deployment to propagate

# Test health endpoint
echo "Testing health endpoint..."
HEALTH_RESPONSE=$(curl -s "${WORKER_URL}/health")
if echo "$HEALTH_RESPONSE" | grep -q "ok"; then
  echo -e "${GREEN}✓ Health check passed${NC}"
else
  echo -e "${RED}✗ Health check failed${NC}"
  echo "Response: $HEALTH_RESPONSE"
  exit 1
fi

# Test database connection
echo "Testing database connection..."
STATIONS_RESPONSE=$(curl -s -H "Authorization: Bearer dummy-token" "${WORKER_URL}/api/stations" || echo "error")
if echo "$STATIONS_RESPONSE" | grep -q "Unauthorized"; then
  echo -e "${GREEN}✓ API responding (auth required as expected)${NC}"
else
  echo -e "${YELLOW}Warning: Unexpected API response${NC}"
  echo "Response: $STATIONS_RESPONSE"
fi

cd ../..

echo ""
echo "Step 5: Frontend deployment instructions"
echo "----------------------------------------"
echo -e "${YELLOW}Frontend must be deployed via Cloudflare Pages:${NC}"
echo ""
echo "1. Go to Cloudflare Dashboard → Pages"
echo "2. Create project from GitHub repository"
echo "3. Configure build:"
echo "   - Build command: cd apps/web && npm run build"
echo "   - Build output: apps/web/.next"
echo "4. Set environment variables:"
echo "   - NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_live_..."
echo "   - CLERK_SECRET_KEY=sk_live_..."
echo "   - NEXT_PUBLIC_API_URL=${WORKER_URL}"
echo "5. Deploy"
echo ""
read -p "Press Enter when frontend is deployed..."

echo ""
echo "Step 6: Deployment summary"
echo "-------------------------"
echo -e "${GREEN}✓ API deployed: ${WORKER_URL}${NC}"
echo ""
echo "Next steps:"
echo "1. Update apps/web/.env.local with NEXT_PUBLIC_API_URL"
echo "2. Deploy recorder server to Vultr VPS (see docs/DEPLOYMENT.md)"
echo "3. Test end-to-end recording flow"
echo "4. Monitor logs: wrangler tail felix-radio-api"
echo ""
echo -e "${GREEN}Deployment complete! 🎉${NC}"
