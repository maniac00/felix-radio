# Production Deployment Checklist

## Pre-Deployment

### Accounts & Billing
- [ ] Cloudflare account created
- [ ] Credit card added to Cloudflare
- [ ] Workers Paid plan activated ($5/month)
- [ ] Clerk account created
- [ ] Clerk production app configured
- [ ] OpenAI API account with credits
- [ ] Vultr account created
- [ ] Vultr billing configured

### Code Preparation
- [ ] All code committed to GitHub
- [ ] All tests passing locally
- [ ] No secrets in code (checked with `git grep -i "sk_live\|pk_live\|api_key"`)
- [ ] `.env` files in `.gitignore`
- [ ] Production environment examples created

### Security Review
- [ ] CORS configured for production domains only
- [ ] All API endpoints require authentication
- [ ] Internal API endpoints use API key auth
- [ ] No console.log with sensitive data
- [ ] Rate limiting considered (if needed)

## Cloudflare Deployment

### D1 Database
- [ ] Database created: `wrangler d1 create felix-radio-db`
- [ ] Database ID updated in `apps/api/wrangler.toml`
- [ ] Migrations executed: `pnpm db:migrate:prod migrations/0001_initial_schema.sql`
- [ ] Initial data verified (TBN 제주 station)
- [ ] Database backup enabled in Cloudflare dashboard

### R2 Storage
- [ ] Bucket created: `wrangler r2 bucket create felix-radio-recordings`
- [ ] Bucket verified: `wrangler r2 bucket list`
- [ ] R2 API tokens generated for recorder server
- [ ] Access keys saved securely (password manager)

### Workers API
- [ ] Secrets set:
  - [ ] `CLERK_SECRET_KEY` (sk_live_...)
  - [ ] `INTERNAL_API_KEY` (32+ char random string)
- [ ] Deployed: `cd apps/api && pnpm deploy`
- [ ] Deployment URL saved
- [ ] Health check tested: `curl https://.../health`

### Cloudflare Pages (Frontend)
- [ ] GitHub repository connected
- [ ] Build settings configured:
  - Framework: Next.js
  - Build command: `cd apps/web && npm run build`
  - Build output: `apps/web/.next`
- [ ] Environment variables set:
  - [ ] `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
  - [ ] `CLERK_SECRET_KEY`
  - [ ] `NEXT_PUBLIC_API_URL`
  - [ ] `NODE_VERSION=20`
- [ ] Deployed successfully
- [ ] Production URL accessible

### Custom Domain (Optional)
- [ ] Domain purchased/available
- [ ] DNS configured for Pages
- [ ] SSL certificate active
- [ ] Clerk allowed origins updated

## Clerk Configuration

### Production App Setup
- [ ] Production app created
- [ ] Email authentication enabled
- [ ] Sign-up/sign-in customized
- [ ] Email templates reviewed

### Domain Configuration
- [ ] Frontend domain added to allowed origins
- [ ] API domain added to allowed origins
- [ ] Redirect URLs configured
- [ ] Production keys copied to deployment

### Testing
- [ ] Sign up flow tested
- [ ] Sign in flow tested
- [ ] Sign out flow tested
- [ ] JWT token generated successfully

## Vultr VPS Deployment

### VPS Provisioning
- [ ] VPS created (Seoul, 1GB RAM, Ubuntu 22.04)
- [ ] SSH key configured
- [ ] System updated: `apt update && apt upgrade -y`
- [ ] Docker installed
- [ ] Docker Compose installed
- [ ] Git installed

### Firewall Configuration
- [ ] UFW enabled
- [ ] SSH port 22 allowed
- [ ] Unnecessary ports blocked
- [ ] Tested SSH access

### Recorder Server Deployment
- [ ] Repository cloned to VPS
- [ ] `.env` file created with production values
- [ ] Environment variables verified
- [ ] Docker image built: `docker-compose build`
- [ ] Service started: `docker-compose up -d`
- [ ] Container running: `docker-compose ps`
- [ ] Logs checked: `docker-compose logs -f`

### Monitoring
- [ ] Log rotation configured (10MB x 3 files)
- [ ] Cron job verified (polling every minute)
- [ ] First poll logged successfully
- [ ] Disk space checked: `df -h`

## Post-Deployment Testing

### API Endpoints
- [ ] `/health` returns 200 OK
- [ ] `/api/auth/me` requires authentication
- [ ] `/api/schedules` CRUD works
- [ ] `/api/recordings` list works
- [ ] `/api/stations` returns TBN 제주
- [ ] `/api/internal/schedules/pending` requires API key

### Frontend
- [ ] Homepage loads
- [ ] Sign up works
- [ ] Sign in works
- [ ] Dashboard displays
- [ ] Navigation works
- [ ] API calls succeed (check network tab)

### End-to-End Flow
- [ ] Create schedule (5 mins from now, 1 min duration)
- [ ] Wait for schedule time
- [ ] Verify recorder server polls API
- [ ] Verify recording starts (check logs)
- [ ] Verify MP3 uploaded to R2
- [ ] Verify recording appears in frontend
- [ ] Download MP3 and verify playback
- [ ] Trigger STT conversion (when ready)

### Error Handling
- [ ] Invalid JWT returns 401
- [ ] Missing API key returns 401
- [ ] Non-existent resource returns 404
- [ ] Server errors logged properly

## Monitoring Setup

### Cloudflare
- [ ] Workers analytics enabled
- [ ] D1 metrics monitored
- [ ] R2 usage tracked
- [ ] Email alerts configured for errors

### VPS
- [ ] htop installed for resource monitoring
- [ ] Disk space alert script (optional)
- [ ] Log aggregation (optional: Papertrail, Logtail)

### Application
- [ ] Recorder server logs accessible
- [ ] Error tracking configured (optional: Sentry)
- [ ] Uptime monitoring (optional: UptimeRobot)

## Documentation

- [ ] Deployment guide updated with actual values
- [ ] API URLs documented
- [ ] Credentials stored in password manager
- [ ] Team notified of deployment
- [ ] Runbook created for common tasks

## Backup & Recovery

- [ ] D1 automatic backups verified
- [ ] R2 bucket versioning considered
- [ ] VPS snapshot created
- [ ] Environment variables backed up (encrypted)
- [ ] Rollback procedure tested

## Performance

- [ ] First load time < 3 seconds
- [ ] API response time < 500ms
- [ ] Recording starts within 5 seconds of schedule
- [ ] R2 upload completes successfully
- [ ] Database queries optimized

## Security

- [ ] All secrets rotated from development
- [ ] No hardcoded credentials in code
- [ ] HTTPS enforced everywhere
- [ ] JWT expiration configured
- [ ] API rate limiting considered
- [ ] VPS SSH keys only (no password auth)

## Cost Optimization

- [ ] Cloudflare usage reviewed
- [ ] Unnecessary services disabled
- [ ] R2 lifecycle policies configured (optional)
- [ ] OpenAI usage monitored
- [ ] Vultr instance right-sized

## Launch Preparation

- [ ] All stakeholders notified
- [ ] Support process defined
- [ ] Known issues documented
- [ ] User guide prepared (optional)
- [ ] Marketing materials ready (optional)

## Post-Launch (Week 1)

- [ ] Monitor error rates daily
- [ ] Check recording success rate
- [ ] Review user feedback
- [ ] Monitor costs vs. budget
- [ ] Plan next iteration

---

**Deployment Date:** __________
**Deployed By:** __________
**Sign-off:** __________
