# 🛠️ Felix Radio - Development Setup

> Development environment setup and deployment guide

| Version | Date | Status |
|---------|------|--------|
| 1.0 | 2024-12-27 | Draft |

---

## 1. Prerequisites

### 1.1 Required Software

| Software | Version | Purpose |
|----------|---------|---------|
| Node.js | 20 LTS | Runtime for all packages |
| npm | 9+ | Package manager |
| Git | 2.40+ | Version control |
| Docker | 24+ | Recorder server containerization |
| Wrangler CLI | 3.0+ | Cloudflare deployment |

**Installation:**

```bash
# Node.js (using nvm)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
nvm install 20
nvm use 20

# Wrangler CLI
npm install -g wrangler

# Docker (macOS)
brew install --cask docker

# Docker (Ubuntu)
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
```

### 1.2 Required Accounts

1. **Cloudflare Account** (Free tier)
   - Sign up: https://dash.cloudflare.com/sign-up
   - Services needed: Pages, Workers, D1, R2

2. **Clerk Account** (Free tier)
   - Sign up: https://clerk.com/
   - 10,000 monthly active users free

3. **OpenAI Account** (Paid)
   - Sign up: https://platform.openai.com/signup
   - Whisper API access

4. **Vultr Account** (Paid - $5/month)
   - Sign up: https://www.vultr.com/
   - Seoul region VPS

---

## 2. Project Structure

```
felix-radio/
├── apps/
│   ├── web/                    # Next.js frontend
│   │   ├── app/
│   │   ├── components/
│   │   ├── lib/
│   │   └── package.json
│   └── api/                    # Cloudflare Workers API
│       ├── src/
│       ├── migrations/
│       ├── wrangler.toml
│       └── package.json
├── packages/
│   └── recorder/               # Vultr recording server
│       ├── src/
│       ├── config/
│       ├── Dockerfile
│       └── package.json
├── docs/                       # Documentation
│   ├── PRD.md
│   ├── ARCHITECTURE.md
│   ├── API.md
│   ├── DATABASE.md
│   └── SETUP.md
├── package.json                # Root package.json (workspace)
├── pnpm-workspace.yaml
└── README.md
```

---

## 3. Local Development Setup

### 3.1 Clone Repository

```bash
git clone https://github.com/your-org/felix-radio.git
cd felix-radio
```

### 3.2 Install Dependencies

**Using pnpm (recommended):**
```bash
# Install pnpm
npm install -g pnpm

# Install all dependencies
pnpm install
```

**Using npm:**
```bash
npm install
```

### 3.3 Environment Variables

#### Frontend (apps/web/.env.local)

```env
# Clerk
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...

# API URL
NEXT_PUBLIC_API_URL=http://localhost:8787

# Cloudflare (optional for local dev)
NEXT_PUBLIC_CLOUDFLARE_ACCOUNT_ID=your_account_id
```

#### API (apps/api/.dev.vars)

```env
# Clerk
CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...

# Internal API Key (for recorder server)
INTERNAL_API_KEY=your_random_api_key_here

# R2 (Cloudflare bindings handle this in production)
# Local development uses miniflare
```

#### Recorder Server (packages/recorder/.env)

```env
# Workers API
WORKERS_API_URL=http://localhost:8787
INTERNAL_API_KEY=your_random_api_key_here

# OpenAI
OPENAI_API_KEY=sk-...

# Cloudflare R2
R2_ACCOUNT_ID=your_account_id
R2_ACCESS_KEY_ID=your_access_key_id
R2_SECRET_ACCESS_KEY=your_secret_access_key
R2_BUCKET_NAME=felix-radio-recordings

# Node Environment
NODE_ENV=development
```

---

## 4. Cloudflare Setup

### 4.1 Authenticate Wrangler

```bash
wrangler login
```

### 4.2 Create D1 Database

```bash
# Create database
wrangler d1 create felix-radio-db

# Output:
# ✅ Successfully created DB 'felix-radio-db'
# binding = "DB"
# database_id = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"

# Add binding to wrangler.toml
```

**Update `apps/api/wrangler.toml`:**
```toml
[[d1_databases]]
binding = "DB"
database_name = "felix-radio-db"
database_id = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
```

### 4.3 Run Initial Migration

```bash
cd apps/api

# Execute migration
wrangler d1 execute felix-radio-db --local --file migrations/0001_initial_schema.sql

# For production
wrangler d1 execute felix-radio-db --remote --file migrations/0001_initial_schema.sql
```

### 4.4 Create R2 Bucket

```bash
# Create bucket
wrangler r2 bucket create felix-radio-recordings

# Add binding to wrangler.toml
```

**Update `apps/api/wrangler.toml`:**
```toml
[[r2_buckets]]
binding = "R2"
bucket_name = "felix-radio-recordings"
```

### 4.5 Generate R2 Access Keys

```bash
# Go to Cloudflare dashboard
# R2 > Manage R2 API Tokens > Create API Token
# Copy Access Key ID and Secret Access Key
```

---

## 5. Running Locally

### 5.1 Quick Start (Tunnel Mode - Default)

The easiest way to start local development is using the provided scripts:

```bash
# Start with Cloudflare Tunnel (default mode)
./scripts/dev-start.sh

# This will:
# 1. Start local API server on http://localhost:8787
# 2. Create a Cloudflare Tunnel exposing your local API
# 3. Display a public tunnel URL (e.g., https://abc-def.trycloudflare.com)
# 4. Automatically configure the Vultr recorder server with tunnel URL
# 5. Restart recorder service to use your local API
# 6. Start Next.js on http://localhost:3000
```

This mode allows you to:
- Test with your local D1 database
- Use the production recorder server for actual recordings
- Verify recording functionality end-to-end
- Test file naming, station display, file size, and other recorder features

**Stop servers:**
```bash
./scripts/dev-stop.sh  # Also restores production configuration automatically
```

**Important:**
- When you stop the server (Ctrl+C), it automatically restores the production configuration
- The recorder will reconnect to the production API after cleanup

### 5.2 Local API Only (No Tunnel)

To develop without tunnel and recorder integration:

```bash
# Start without tunnel
./scripts/dev-start.sh --no-tunnel

# This will:
# 1. Start Wrangler API server on http://localhost:8787
# 2. Start Next.js on http://localhost:3000
# 3. No recorder integration (no actual recordings)
```

Use this mode for:
- Frontend UI development
- API logic testing
- Database schema changes
- Quick iterations without recorder

### 5.3 Mock Mode

To develop with mock data only (no API server needed):

```bash
# Start frontend with mock data
./scripts/dev-start.sh --mock

# Access application
# http://localhost:3000
```

**Check API logs:**
```bash
tail -f /tmp/felix-api.log
```

**Stop all servers:**
```bash
./scripts/dev-stop.sh
# Stops both Web (port 3000) and API (port 8787)
```

### 5.4 Manual Service Control

If you prefer manual control over each service:

**Terminal 1 - Frontend:**
```bash
cd apps/web
npm run dev
# http://localhost:3000
```

**Terminal 2 - API:**
```bash
cd apps/api
npm run dev
# http://localhost:8787
```

**Note:** Recorder server is NOT included in local development setup. It should only run on the production Vultr server for these reasons:
- Requires actual radio stream access
- Long-running recording jobs (not suitable for dev interruptions)
- R2 storage credentials needed
- Schedule-based execution makes local testing impractical

To test recording functionality, use the production Vultr server or mock the recording data through the API.

### 5.5 Development Workflow

**Full-Stack with Recorder (Tunnel Mode - Default):**
- Use `./scripts/dev-start.sh` (default mode)
- Test complete recording workflow
- Local D1 database + production recorder server
- Verify file naming, station display, file size
- End-to-end feature testing
- Automatic recorder configuration

**Full-Stack Development (Local API Only):**
- Use `./scripts/dev-start.sh --no-tunnel`
- Test actual API integration
- Clerk authentication with local D1 database
- Create/modify real data
- Fast hot reload with real backend
- No actual recordings (recorder not integrated)

**Frontend Development (Mock Mode):**
- Use `./scripts/dev-start.sh --mock`
- No backend dependencies
- Predefined data for testing UI
- Clerk authentication with test credentials
- Fastest iteration for UI-only changes

**API Development:**
- Wrangler uses Miniflare for local D1/R2 simulation
- Changes auto-reload with `--watch`
- Test with curl, Postman, or frontend
- Local D1 database persists in `.wrangler/state/`

**Environment Modes:**

| Mode | Command | Use Case |
|------|---------|----------|
| Tunnel (Default) | `./scripts/dev-start.sh` | Full-stack + production recorder |
| Local API | `./scripts/dev-start.sh --no-tunnel` | Full-stack without recordings |
| Mock | `./scripts/dev-start.sh --mock` | Fast UI-only development |
| API Only | `cd apps/api && npm run dev` | API testing |
| Frontend Only | `cd apps/web && npm run dev` | With custom API URL |

---

## 6. Testing

### 6.1 API Testing

**Test Authentication:**
```bash
# Get Clerk JWT token from frontend (dev tools > Application > localStorage)
export TOKEN="eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9..."

# Test endpoint
curl http://localhost:8787/api/schedules \
  -H "Authorization: Bearer $TOKEN"
```

**Test Internal API:**
```bash
# Test pending schedules
curl http://localhost:8787/api/internal/schedules/pending?currentTime=2024-12-27T09:00:00Z \
  -H "X-API-Key: your_random_api_key_here"
```

### 6.2 End-to-End Testing

**Manual Testing Flow:**
1. Login via frontend (http://localhost:3000)
2. Create a schedule for current time + 2 minutes
3. Wait for recorder to poll and execute
4. Check R2 bucket for MP3 file
5. Trigger STT conversion from frontend
6. Verify text appears in frontend

**Automated Tests (Future):**
```bash
# Unit tests
npm run test

# E2E tests
npm run test:e2e
```

---

## 7. Deployment

### 7.1 Frontend Deployment (Cloudflare Pages)

**Option 1: GitHub Integration (Recommended)**
1. Go to Cloudflare Dashboard > Pages
2. Connect GitHub repository
3. Set build configuration:
   - Build command: `cd apps/web && npm run build`
   - Build output directory: `apps/web/.next`
   - Root directory: `/`
4. Add environment variables
5. Deploy automatically on push to `main`

**Option 2: Manual Deploy**
```bash
cd apps/web

# Build
npm run build

# Deploy (using Wrangler Pages)
wrangler pages deploy .next --project-name felix-radio-web
```

**Environment Variables (Production):**
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
- `CLERK_SECRET_KEY`
- `NEXT_PUBLIC_API_URL` (e.g., `https://api.felix-radio.com`)

### 7.2 API Deployment (Cloudflare Workers)

```bash
cd apps/api

# Deploy to production
wrangler deploy

# Output:
# ✅ Deployed to https://felix-radio-api.your-subdomain.workers.dev
```

**Production Secrets:**
```bash
# Set secrets (not in wrangler.toml)
wrangler secret put CLERK_SECRET_KEY
wrangler secret put INTERNAL_API_KEY
```

### 7.3 Recorder Deployment (Vultr VPS)

**Step 1: Create Vultr VPS**
1. Login to Vultr dashboard
2. Deploy new instance:
   - Location: Seoul
   - Type: Regular Performance
   - Plan: 1 vCPU / 1GB RAM ($5/month)
   - OS: Ubuntu 22.04 LTS
   - Enable IPv4

**Step 2: SSH Setup**
```bash
# SSH into VPS
ssh root@your-vps-ip

# Update system
apt update && apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh

# Install Docker Compose
apt install docker-compose -y

# Install Node.js (for debugging)
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs
```

**Step 3: Deploy with Docker**

Create `docker-compose.yml` on VPS:
```yaml
version: '3.8'

services:
  recorder:
    image: ghcr.io/your-org/felix-radio-recorder:latest
    container_name: felix-recorder
    restart: unless-stopped
    environment:
      - WORKERS_API_URL=https://api.felix-radio.com
      - INTERNAL_API_KEY=${INTERNAL_API_KEY}
      - OPENAI_API_KEY=${OPENAI_API_KEY}
      - R2_ACCOUNT_ID=${R2_ACCOUNT_ID}
      - R2_ACCESS_KEY_ID=${R2_ACCESS_KEY_ID}
      - R2_SECRET_ACCESS_KEY=${R2_SECRET_ACCESS_KEY}
      - R2_BUCKET_NAME=felix-radio-recordings
      - NODE_ENV=production
    volumes:
      - /tmp/recordings:/tmp/recordings
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"
```

Create `.env` file:
```env
INTERNAL_API_KEY=your_production_api_key
OPENAI_API_KEY=sk-...
R2_ACCOUNT_ID=...
R2_ACCESS_KEY_ID=...
R2_SECRET_ACCESS_KEY=...
```

Deploy:
```bash
# Pull image
docker-compose pull

# Start container
docker-compose up -d

# Check logs
docker-compose logs -f recorder
```

**Step 4: CI/CD with GitHub Actions**

Create `.github/workflows/deploy-recorder.yml`:
```yaml
name: Deploy Recorder

on:
  push:
    branches: [main]
    paths:
      - 'packages/recorder/**'

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Build and push Docker image
        uses: docker/build-push-action@v4
        with:
          context: ./packages/recorder
          push: true
          tags: ghcr.io/your-org/felix-radio-recorder:latest

      - name: Deploy to Vultr
        uses: appleboy/ssh-action@v0.1.10
        with:
          host: ${{ secrets.VULTR_HOST }}
          username: root
          key: ${{ secrets.VULTR_SSH_KEY }}
          script: |
            cd /opt/felix-radio
            docker-compose pull
            docker-compose up -d
```

---

## 8. Monitoring & Debugging

### 8.1 Cloudflare Workers Logs

```bash
# Tail logs (real-time)
wrangler tail

# Production logs
wrangler tail --env production
```

**Cloudflare Dashboard:**
- Workers > felix-radio-api > Logs
- Real-time request logs
- Error tracking

### 8.2 Recorder Server Logs

```bash
# SSH into VPS
ssh root@your-vps-ip

# View logs
docker-compose logs -f recorder

# View last 100 lines
docker-compose logs --tail 100 recorder

# Check container status
docker-compose ps
```

### 8.3 D1 Database Queries

```bash
# Local
wrangler d1 execute felix-radio-db --local --command "SELECT COUNT(*) FROM recordings"

# Production
wrangler d1 execute felix-radio-db --remote --command "SELECT * FROM recordings ORDER BY created_at DESC LIMIT 10"
```

### 8.4 R2 Storage Management

```bash
# List objects
wrangler r2 object list felix-radio-recordings

# Download object
wrangler r2 object get felix-radio-recordings/users/user_123/recordings/2024-12-27_09-00-00.mp3 --file download.mp3

# Delete object
wrangler r2 object delete felix-radio-recordings/users/user_123/recordings/2024-12-27_09-00-00.mp3
```

---

## 9. Troubleshooting

### 9.1 Common Issues

**Issue: Clerk authentication fails locally**
```bash
# Solution: Check .env.local variables
cat apps/web/.env.local

# Verify Clerk dashboard settings:
# - Allowed domains: http://localhost:3000
# - JWT template configured correctly
```

**Issue: D1 migration fails**
```bash
# Solution: Reset local D1 database
rm -rf .wrangler/state/v3/d1

# Re-run migration
wrangler d1 execute felix-radio-db --local --file migrations/0001_initial_schema.sql
```

**Issue: Recording fails (ffmpeg error)**
```bash
# Solution: Check stream URL validity
ffmpeg -i "https://example.com/stream.m3u8" -t 10 test.mp3

# Check VPS ffmpeg installation
docker-compose exec recorder ffmpeg -version
```

**Issue: STT conversion fails**
```bash
# Solution: Check OpenAI API key
curl https://api.openai.com/v1/models \
  -H "Authorization: Bearer $OPENAI_API_KEY"

# Check audio file size (<25MB for Whisper)
ls -lh /tmp/recordings/*.mp3
```

### 9.2 Performance Issues

**Slow API Response:**
- Check D1 query performance with EXPLAIN
- Add missing indexes
- Enable Cloudflare Workers KV caching

**High Whisper API Cost:**
- Reduce recording quality (lower bitrate)
- Implement audio compression before STT
- Use batching for multiple recordings

---

## 10. Development Best Practices

### 10.1 Git Workflow

```bash
# Create feature branch
git checkout -b feature/add-recording-filters

# Commit changes
git add .
git commit -m "feat: add status filter to recordings API"

# Push and create PR
git push origin feature/add-recording-filters
```

**Commit Message Format:**
- `feat:` New feature
- `fix:` Bug fix
- `docs:` Documentation
- `refactor:` Code refactoring
- `test:` Tests
- `chore:` Build/config changes

### 10.2 Code Quality

**Linting:**
```bash
# Run ESLint
npm run lint

# Fix auto-fixable issues
npm run lint:fix
```

**Type Checking:**
```bash
# TypeScript check
npm run type-check
```

**Formatting:**
```bash
# Prettier
npm run format
```

### 10.3 Environment-Specific Config

**Development:**
- Local D1 database (Miniflare)
- Mock Whisper API (optional)
- Short polling interval (1 minute)

**Staging:**
- Cloudflare D1 (separate database)
- Real Whisper API
- Normal polling interval

**Production:**
- Cloudflare D1 (production database)
- Real Whisper API
- Monitoring enabled
- Error alerting via Slack/Email

---

## 11. Maintenance

### 11.1 Database Maintenance

**Weekly Backup:**
```bash
# Export D1 database
wrangler d1 export felix-radio-db --output backup-$(date +%Y%m%d).sql

# Upload to R2
wrangler r2 object put felix-radio-backups/db-backup-$(date +%Y%m%d).sql --file backup-$(date +%Y%m%d).sql
```

**Cleanup Old Recordings:**
```bash
# Run cleanup script (cron job on VPS)
0 2 * * * /usr/local/bin/cleanup-old-recordings.sh

# Script content:
#!/bin/bash
wrangler d1 execute felix-radio-db --remote --command "DELETE FROM recordings WHERE recorded_at < datetime('now', '-90 days')"
```

### 11.2 Dependency Updates

**Monthly Updates:**
```bash
# Check outdated packages
npm outdated

# Update all packages
npm update

# Update major versions (carefully)
npx npm-check-updates -u
npm install
```

### 11.3 Security Updates

**Monitor Security Advisories:**
```bash
# Check for vulnerabilities
npm audit

# Fix vulnerabilities
npm audit fix

# Force fix (use with caution)
npm audit fix --force
```

---

## 12. Scaling Considerations

### 12.1 Horizontal Scaling

**Add Multiple Recorder Servers:**
1. Deploy additional Vultr VPS instances
2. Use load balancer (Cloudflare Load Balancing)
3. Distribute schedules across servers (hash-based)

**Example: Multi-region Recording**
- Seoul VPS: Korean stations
- Tokyo VPS: Japanese stations
- US VPS: US stations

### 12.2 Vertical Scaling

**Upgrade VPS Plan:**
- Current: 1 vCPU / 1GB RAM
- Upgraded: 2 vCPU / 4GB RAM (for parallel recordings)

**Workers:**
- Free tier: 100k requests/day
- Paid tier: Unlimited + longer CPU time

---

## 13. Useful Commands Reference

### 13.1 Wrangler Commands

```bash
# Login
wrangler login

# Deploy Workers
wrangler deploy

# Tail logs
wrangler tail

# D1 operations
wrangler d1 list
wrangler d1 execute <db-name> --command "SELECT * FROM users"
wrangler d1 backup create <db-name>

# R2 operations
wrangler r2 bucket list
wrangler r2 object list <bucket-name>
wrangler r2 object get <bucket-name>/<key> --file output.mp3

# Secrets
wrangler secret put <SECRET_NAME>
wrangler secret list
wrangler secret delete <SECRET_NAME>
```

### 13.2 Docker Commands

```bash
# Build image
docker build -t felix-recorder packages/recorder

# Run container
docker run -d --name felix-recorder --env-file .env felix-recorder

# View logs
docker logs -f felix-recorder

# Stop container
docker stop felix-recorder

# Remove container
docker rm felix-recorder

# Cleanup
docker system prune -a
```

### 13.3 VPS Maintenance

```bash
# Update system
apt update && apt upgrade -y

# Check disk usage
df -h

# Check memory usage
free -h

# Monitor processes
htop

# Check Docker stats
docker stats

# Restart service
docker-compose restart recorder
```

---

## 14. Additional Resources

### 14.1 Documentation Links

- [Cloudflare Workers Docs](https://developers.cloudflare.com/workers/)
- [Cloudflare D1 Docs](https://developers.cloudflare.com/d1/)
- [Cloudflare R2 Docs](https://developers.cloudflare.com/r2/)
- [Next.js Docs](https://nextjs.org/docs)
- [Clerk Docs](https://clerk.com/docs)
- [Whisper API Docs](https://platform.openai.com/docs/guides/speech-to-text)
- [ffmpeg Documentation](https://ffmpeg.org/documentation.html)

### 14.2 Community & Support

- GitHub Discussions: `https://github.com/your-org/felix-radio/discussions`
- Slack Channel: `#felix-radio`
- Email: `support@felix-radio.com`

---

## Appendix

### A. Cost Breakdown

**Monthly Costs (Production):**

| Service | Tier | Cost |
|---------|------|------|
| Cloudflare Pages | Free | $0 |
| Cloudflare Workers | Free (100k req/day) | $0 |
| Cloudflare D1 | Free (5GB) | $0 |
| Cloudflare R2 | 10GB free + $0.015/GB | $0-5 |
| Clerk | Free (10k MAU) | $0 |
| Vultr VPS | 1 vCPU / 1GB | $5 |
| Whisper API | $0.006/min | $10-50 |
| **Total** | | **$15-60** |

### B. Environment Variables Checklist

**Frontend:**
- [ ] `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
- [ ] `CLERK_SECRET_KEY`
- [ ] `NEXT_PUBLIC_API_URL`

**API:**
- [ ] `CLERK_PUBLISHABLE_KEY`
- [ ] `CLERK_SECRET_KEY`
- [ ] `INTERNAL_API_KEY`
- [ ] D1 binding configured in wrangler.toml
- [ ] R2 binding configured in wrangler.toml

**Recorder:**
- [ ] `WORKERS_API_URL`
- [ ] `INTERNAL_API_KEY`
- [ ] `OPENAI_API_KEY`
- [ ] `R2_ACCOUNT_ID`
- [ ] `R2_ACCESS_KEY_ID`
- [ ] `R2_SECRET_ACCESS_KEY`
- [ ] `R2_BUCKET_NAME`

### C. Pre-launch Checklist

- [ ] All environment variables set
- [ ] D1 database created and migrated
- [ ] R2 bucket created
- [ ] Clerk application configured
- [ ] Frontend deployed to Cloudflare Pages
- [ ] API deployed to Cloudflare Workers
- [ ] Recorder server deployed to Vultr VPS
- [ ] Test schedule created and executed successfully
- [ ] Test STT conversion completed
- [ ] Monitoring and logging configured
- [ ] Backup strategy implemented
- [ ] DNS configured (custom domain)
- [ ] SSL/TLS enabled
- [ ] Rate limiting tested
- [ ] Error handling verified
