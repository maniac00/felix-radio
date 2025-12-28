# Felix Radio - Production Deployment Guide

## Prerequisites

Before deploying to production, ensure you have:

- [x] Cloudflare account with Workers plan
- [x] Clerk account with production application
- [x] GitHub repository with all code committed
- [ ] Credit card added to Cloudflare (for Workers, D1, R2)
- [ ] Domain name (optional, can use workers.dev subdomain)

## Deployment Checklist

### 1. Cloudflare Setup

#### 1.1 Install Wrangler CLI

```bash
npm install -g wrangler

# Login to Cloudflare
wrangler login
```

#### 1.2 Create Production D1 Database

```bash
cd apps/api

# Create database
wrangler d1 create felix-radio-db

# Output will show:
# database_id = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
```

**Update `apps/api/wrangler.toml`:**
```toml
[[d1_databases]]
binding = "DB"
database_name = "felix-radio-db"
database_id = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"  # Replace with actual ID
```

#### 1.3 Run Database Migrations

```bash
# Execute migration in production
pnpm db:migrate:prod migrations/0001_initial_schema.sql

# Verify tables created
wrangler d1 execute felix-radio-db --remote --command "SELECT name FROM sqlite_master WHERE type='table'"
```

#### 1.4 Create Production R2 Bucket

```bash
# Create bucket
wrangler r2 bucket create felix-radio-recordings

# Verify bucket created
wrangler r2 bucket list
```

#### 1.5 Generate R2 Access Keys

For the recorder server to upload files:

1. Go to Cloudflare Dashboard → R2
2. Click "Manage R2 API Tokens"
3. Create API Token with:
   - Permissions: Object Read & Write
   - TTL: No expiry
   - Bucket: `felix-radio-recordings`
4. Save `Access Key ID` and `Secret Access Key`

### 2. Clerk Configuration

#### 2.1 Create Production Application

1. Go to [Clerk Dashboard](https://dashboard.clerk.com)
2. Create new application or use existing
3. Configure:
   - Application name: `Felix Radio Production`
   - Sign-in options: Email
   - Social logins: (optional)

#### 2.2 Get Clerk Keys

From Clerk Dashboard → API Keys:
- `CLERK_PUBLISHABLE_KEY` (starts with `pk_live_`)
- `CLERK_SECRET_KEY` (starts with `sk_live_`)

#### 2.3 Configure Allowed Origins

In Clerk Dashboard → Domains:
- Add production domain (e.g., `felix-radio.pages.dev`)
- Add API domain (e.g., `felix-radio-api.workers.dev`)

### 3. Workers API Deployment

#### 3.1 Set Production Secrets

```bash
cd apps/api

# Set Clerk secret key
wrangler secret put CLERK_SECRET_KEY
# Paste: sk_live_... (from Clerk dashboard)

# Set internal API key (generate secure random key)
wrangler secret put INTERNAL_API_KEY
# Paste: [generate with: openssl rand -base64 32]
```

#### 3.2 Deploy Workers API

```bash
# Deploy to production
pnpm deploy

# Output will show:
# Published felix-radio-api (X.XX sec)
# https://felix-radio-api.<your-subdomain>.workers.dev
```

#### 3.3 Test Production API

```bash
# Test health endpoint
curl https://felix-radio-api.<your-subdomain>.workers.dev/health

# Expected output:
# {"status":"ok","timestamp":"2024-12-28T...","service":"felix-radio-api"}
```

### 4. Frontend Deployment (Cloudflare Pages)

#### 4.1 Connect GitHub Repository

1. Go to Cloudflare Dashboard → Pages
2. Click "Create a project"
3. Connect to GitHub
4. Select `felix-radio` repository
5. Configure build settings:
   - Framework preset: `Next.js`
   - Build command: `cd apps/web && npm run build`
   - Build output directory: `apps/web/.next`
   - Root directory: `/`

#### 4.2 Set Environment Variables

In Pages → Settings → Environment variables:

```bash
# Clerk Keys (from Clerk dashboard)
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_live_...
CLERK_SECRET_KEY=sk_live_...

# API URL (from Workers deployment)
NEXT_PUBLIC_API_URL=https://felix-radio-api.<your-subdomain>.workers.dev

# Node version
NODE_VERSION=20
```

#### 4.3 Deploy Frontend

Pages will automatically deploy on git push to main branch.

Manual deployment:
1. Go to Pages → Deployments
2. Click "Create deployment"
3. Select branch: `main`
4. Deploy

#### 4.4 Configure Custom Domain (Optional)

1. Go to Pages → Custom domains
2. Add domain (e.g., `app.felix-radio.com`)
3. Update DNS records as instructed
4. Wait for SSL certificate provisioning

### 5. Recorder Server Deployment (Vultr VPS)

#### 5.1 Provision Vultr VPS

1. Create Vultr account at https://vultr.com
2. Add payment method
3. Deploy new server:
   - **Location**: Seoul, South Korea
   - **Server Type**: Cloud Compute - Shared CPU
   - **Server Size**: 25 GB SSD / 1 vCPU / 1 GB RAM ($6/mo)
   - **Operating System**: Ubuntu 22.04 LTS
   - **Server Hostname**: `felix-recorder`

4. Save SSH credentials

#### 5.2 Setup VPS

```bash
# SSH into VPS
ssh root@<vps-ip-address>

# Update system
apt update && apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com | sh

# Install Docker Compose
apt install docker-compose -y

# Install git
apt install git -y

# Configure firewall
ufw allow 22/tcp  # SSH
ufw enable
```

#### 5.3 Deploy Recorder Server

```bash
# Clone repository
git clone https://github.com/<your-username>/felix-radio.git
cd felix-radio/packages/recorder

# Create .env file
nano .env
```

**Paste the following (update with your values):**
```bash
# Cloudflare Workers API
WORKERS_API_URL=https://felix-radio-api.<your-subdomain>.workers.dev
INTERNAL_API_KEY=<same key from wrangler secret put>

# OpenAI Whisper
OPENAI_API_KEY=sk-proj-...

# R2 Storage (from step 1.5)
R2_ACCOUNT_ID=<your-cloudflare-account-id>
R2_ACCESS_KEY_ID=<r2-access-key-id>
R2_SECRET_ACCESS_KEY=<r2-secret-access-key>
R2_BUCKET_NAME=felix-radio-recordings
R2_ENDPOINT=https://<your-account-id>.r2.cloudflarestorage.com

# Configuration
TZ=Asia/Seoul
LOG_LEVEL=info
```

**Build and start:**
```bash
# Build Docker image
docker-compose build

# Start service
docker-compose up -d

# Check logs
docker-compose logs -f
```

#### 5.4 Verify Recorder Server

```bash
# Check container status
docker-compose ps

# Should show:
# felix-recorder   Up X minutes

# Check logs for polling activity
docker-compose logs -f | grep "Polling"
```

### 6. Post-Deployment Verification

#### 6.1 Test Complete Flow

1. **Frontend**: Visit production URL
   - Sign up with email
   - Verify Clerk authentication works

2. **Create Schedule**:
   - Create test schedule (5 minutes from now, 1 minute duration)
   - Verify schedule saved in D1

3. **Recording**:
   - Wait for schedule time
   - Check recorder server logs for polling
   - Verify recording created in D1
   - Check R2 bucket for MP3 file

4. **Download**:
   - Click download in frontend
   - Verify MP3 plays correctly

5. **STT**:
   - Trigger STT conversion
   - Verify text result appears

#### 6.2 Monitor Services

**Workers API:**
```bash
# View logs
wrangler tail felix-radio-api

# Check analytics
# Visit: Cloudflare Dashboard → Workers → felix-radio-api → Metrics
```

**Recorder Server:**
```bash
# SSH to VPS
ssh root@<vps-ip>

# View logs
cd felix-radio/packages/recorder
docker-compose logs -f

# Check disk usage
df -h
```

### 7. Cost Estimation

**Cloudflare:**
- Workers: $5/month (Paid plan, 10M requests/month included)
- D1: Free tier (5 GB storage, 5M reads/day)
- R2: $0.015/GB/month storage + $0.36/million Class B operations
- Pages: Free (500 builds/month)

**Vultr VPS:**
- Seoul VPS (1GB RAM): $6/month

**OpenAI:**
- Whisper API: $0.006/minute of audio

**Estimated Total: ~$15-20/month** (excluding STT usage)

### 8. Rollback Procedures

#### Rollback Workers API:
```bash
cd apps/api

# List deployments
wrangler deployments list

# Rollback to previous version
wrangler rollback --message "Rolling back due to issue"
```

#### Rollback Frontend:
1. Go to Pages → Deployments
2. Find previous working deployment
3. Click "..." → "Retry deployment"

#### Rollback Recorder:
```bash
ssh root@<vps-ip>
cd felix-radio/packages/recorder

# Pull previous version
git fetch origin
git checkout <previous-commit-hash>

# Rebuild and restart
docker-compose up -d --build
```

### 9. Monitoring & Alerts

#### Setup Cloudflare Email Alerts

1. Workers → felix-radio-api → Settings → Triggers
2. Add alert for:
   - Error rate > 5%
   - CPU time > 50ms
   - Success rate < 95%

#### VPS Monitoring

Install basic monitoring:
```bash
# Install htop for resource monitoring
apt install htop

# Install disk space alert script (optional)
# See: /scripts/monitor-disk.sh
```

### 10. Security Checklist

- [ ] All secrets set via `wrangler secret put` (not in code)
- [ ] `.env` files not committed to git
- [ ] CORS configured for production domains only
- [ ] Clerk production keys used (not test keys)
- [ ] R2 bucket has proper access controls
- [ ] VPS firewall configured (only SSH port open)
- [ ] Regular updates scheduled for VPS
- [ ] Strong passwords/SSH keys for VPS access

## Troubleshooting

### Workers API Issues

**Issue**: 401 Unauthorized on all API requests
**Solution**: Check Clerk secret key is set correctly
```bash
wrangler secret put CLERK_SECRET_KEY
```

**Issue**: Database errors
**Solution**: Verify D1 database ID in wrangler.toml matches production database

### Recorder Server Issues

**Issue**: No recordings happening
**Solution**: Check recorder server logs
```bash
docker-compose logs -f | grep -i error
```

**Issue**: R2 upload fails
**Solution**: Verify R2 credentials and endpoint in .env

### Frontend Issues

**Issue**: "Failed to fetch" on API calls
**Solution**: Check NEXT_PUBLIC_API_URL is set correctly in Pages environment variables

## Maintenance

### Regular Tasks

**Weekly:**
- Check recorder server logs for errors
- Monitor disk usage on VPS

**Monthly:**
- Review Cloudflare usage and costs
- Update VPS system packages: `apt update && apt upgrade -y`
- Restart recorder server: `docker-compose restart`

**Quarterly:**
- Review and rotate API keys
- Audit D1 database for unused recordings
- Clean up old R2 files if needed

## Support

For issues:
1. Check logs (Workers tail, docker-compose logs)
2. Review this deployment guide
3. Check GitHub issues: https://github.com/<your-repo>/issues

---

**Deployment Date**: _____________
**Deployed By**: _____________
**Production URL**: _____________
**API URL**: _____________
