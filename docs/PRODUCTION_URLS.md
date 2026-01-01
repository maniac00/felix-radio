# 🌐 Felix Radio - Production URLs

**Last Updated**: 2026-01-02

---

## 🚀 Live Production URLs

### Frontend (Cloudflare Pages)
- **Latest Deployment**: https://2d98abac.felix-radio.pages.dev
- **Previous Deployment**: https://37e8e0a4.felix-radio.pages.dev
- **Status**: ✅ Active with environment variables

### Backend Services
- **API**: https://felix-radio-api.7wario.workers.dev
- **Health Check**: https://felix-radio-api.7wario.workers.dev/health
- **Database**: D1 `felix-radio-db` (ID: 43b83794-5a19-459c-bacf-184c11161150)
- **Storage**: R2 `felix-radio-recordings`

### Recording Server
- **VPS IP**: 158.247.206.183
- **Location**: Seoul, South Korea
- **Container**: felix-recorder (Docker)
- **Status**: ✅ Running

---

## 🔐 Environment Variables (Configured)

The following environment variables are set in Cloudflare Pages:

```
✅ NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY (set)
✅ CLERK_SECRET_KEY (set)
✅ NEXT_PUBLIC_API_URL=https://felix-radio-api.7wario.workers.dev
✅ NODE_VERSION=20
```

---

## 🧪 Quick Test

### 1. Frontend Health Check
```bash
curl -I https://2d98abac.felix-radio.pages.dev
# Should return: 200 OK
```

### 2. API Health Check
```bash
curl https://felix-radio-api.7wario.workers.dev/health
# Should return: {"status":"ok","timestamp":"...","service":"felix-radio-api"}
```

### 3. Recorder Server Status
```bash
ssh root@158.247.206.183 "docker ps | grep felix-recorder"
# Should show: felix-recorder container running
```

---

## 📊 Deployment History

| Date | Deployment | Environment | Status |
|------|------------|-------------|--------|
| 2026-01-02 | 2d98abac | Production (with env vars) | ✅ Active |
| 2026-01-02 | 37e8e0a4 | Production (initial) | ✅ Previous |

---

## 🔄 Access Points

### User Access
- **Main App**: https://2d98abac.felix-radio.pages.dev
- **Login**: https://2d98abac.felix-radio.pages.dev/login
- **Signup**: https://2d98abac.felix-radio.pages.dev/signup
- **Dashboard**: https://2d98abac.felix-radio.pages.dev/dashboard

### Admin Access
- **Cloudflare Dashboard**: https://dash.cloudflare.com
- **Clerk Dashboard**: https://dashboard.clerk.com
- **GitHub Repository**: https://github.com/7wario-sudo/felix-radio

---

## 🎯 Next Steps

1. **Test Authentication**
   - Visit: https://2d98abac.felix-radio.pages.dev
   - Sign up or log in with Clerk
   - Verify dashboard access

2. **Create Test Schedule**
   - Create schedule for 5 minutes from now
   - Duration: 1 minute
   - Station: TBN 제주

3. **Verify Recording Flow**
   - Wait for scheduled time
   - Check if recording appears in list
   - Download and verify MP3 file
   - Test STT conversion

4. **Production Monitoring**
   - Monitor error rates
   - Check recorder server logs
   - Verify API performance

---

## 📞 Support

- **Documentation**: [docs/](.)
- **Deployment Guide**: [PRODUCTION_DEPLOYMENT.md](PRODUCTION_DEPLOYMENT.md)
- **Status**: [DEPLOYMENT_STATUS.md](DEPLOYMENT_STATUS.md)
- **Issues**: https://github.com/7wario-sudo/felix-radio/issues

---

**Status**: ✅ Production Ready
**Last Deployment**: 2026-01-02 01:27 KST
