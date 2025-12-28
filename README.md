# 🐱 Felix Radio

> Radio recording and STT transcription service

Felix Radio is a web-based service that automatically records radio broadcasts and converts them to text using OpenAI Whisper API. Built with modern serverless technologies for reliability and scalability.

## 🎯 Features

- **Scheduled Recording**: Automatically record radio streams at scheduled times
- **Cloud Storage**: Store recordings in Cloudflare R2
- **STT Conversion**: Convert audio to text using OpenAI Whisper API
- **Web Dashboard**: Manage schedules and recordings via web interface
- **Multi-user**: Secure authentication with Clerk

## 🏗️ Architecture

```
┌─────────────── Cloudflare ─────────────┐
│  Pages (Next.js) ↔ Workers (Hono)     │
│         ↕              ↕               │
│        R2            D1                │
└────────────────┬───────────────────────┘
                 │
┌────────────────▼───────────────────────┐
│  Vultr VPS: Recording Server          │
│  - Node.js + ffmpeg                   │
│  - Schedule polling (1min)            │
│  - HLS stream recording               │
└────────────────────────────────────────┘
```

## 📦 Tech Stack

- **Frontend**: Next.js 14+ (App Router), Tailwind CSS, shadcn/ui
- **API**: Cloudflare Workers, Hono
- **Database**: Cloudflare D1 (SQLite)
- **Storage**: Cloudflare R2
- **Auth**: Clerk
- **Recording**: Vultr VPS, Node.js, ffmpeg
- **STT**: OpenAI Whisper API

## 🚀 Quick Start

### Prerequisites

- Node.js 20+
- pnpm 8+
- Cloudflare account
- Clerk account
- OpenAI API key
- Vultr VPS (for production)

### Installation

```bash
# Clone repository
git clone https://github.com/your-org/felix-radio.git
cd felix-radio

# Install dependencies
pnpm install

# Set up environment variables
cp apps/web/.env.local.example apps/web/.env.local
cp apps/api/.dev.vars.example apps/api/.dev.vars
cp packages/recorder/.env.example packages/recorder/.env

# Start development servers
pnpm dev
```

### Development

```bash
# Quick Start (Frontend only with demo mode)
npm run dev:start           # Start development server
npm run dev:stop            # Stop development server

# Or use scripts directly
./scripts/dev-start.sh      # Auto-configures demo environment
./scripts/dev-stop.sh       # Cleanup all processes

# Start all services in parallel (when backend is ready)
pnpm dev

# Start individual services
cd apps/web && npm run dev      # Frontend (http://localhost:3000)
cd apps/api && pnpm dev         # API (http://localhost:8787)
cd packages/recorder && pnpm dev  # Recording server
```

**Demo Mode Features:**
- ✅ Authentication disabled for quick testing
- ✅ Mock data pre-loaded
- ✅ All UI features functional
- ✅ No Clerk or API setup required

## 📁 Project Structure

```
felix-radio/
├── apps/
│   ├── web/           # Next.js frontend
│   └── api/           # Cloudflare Workers API
├── packages/
│   └── recorder/      # Vultr recording server
├── docs/              # Documentation
│   ├── PRD.md
│   ├── ARCHITECTURE.md
│   ├── API.md
│   ├── DATABASE.md
│   └── SETUP.md
└── README.md
```

## 🔧 Configuration

### Frontend (apps/web/.env.local)

```env
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
NEXT_PUBLIC_API_URL=http://localhost:8787
```

### API (apps/api/.dev.vars)

```env
CLERK_SECRET_KEY=sk_test_...
INTERNAL_API_KEY=your_random_api_key
```

### Recorder (packages/recorder/.env)

```env
WORKERS_API_URL=http://localhost:8787
INTERNAL_API_KEY=your_random_api_key
OPENAI_API_KEY=sk-...
R2_ACCOUNT_ID=...
R2_ACCESS_KEY_ID=...
R2_SECRET_ACCESS_KEY=...
R2_BUCKET_NAME=felix-radio-recordings
```

## 📚 Documentation

- [Product Requirements Document](docs/PRD.md)
- [System Architecture](docs/ARCHITECTURE.md)
- [API Specification](docs/API.md)
- [Database Schema](docs/DATABASE.md)
- [Setup Guide](docs/SETUP.md)
- [**Production Deployment Guide**](docs/DEPLOYMENT.md) ⭐
- [**Production Checklist**](docs/PRODUCTION_CHECKLIST.md) ⭐
- [Legacy System Reference](docs/legacy.md)

## 🧪 Testing

```bash
# Run all tests
pnpm test

# Run tests for specific workspace
cd apps/web && pnpm test
cd apps/api && pnpm test
cd packages/recorder && pnpm test
```

## 🚢 Deployment

### Quick Deploy to Production

```bash
# Automated deployment script
./scripts/deploy-production.sh
```

**See [DEPLOYMENT.md](docs/DEPLOYMENT.md) for complete production deployment guide.**

### Individual Services

#### Frontend (Cloudflare Pages)
```bash
cd apps/web
pnpm build
# Deploy via Cloudflare Pages dashboard
```

#### API (Cloudflare Workers)
```bash
cd apps/api

# Create D1 database
wrangler d1 create felix-radio-db

# Run migrations
pnpm db:migrate:prod migrations/0001_initial_schema.sql

# Set secrets
wrangler secret put CLERK_SECRET_KEY
wrangler secret put INTERNAL_API_KEY

# Deploy
pnpm deploy
```

#### Recorder (Vultr VPS)
```bash
# On VPS
cd packages/recorder
docker-compose up -d
```

### Deployment Resources

- 📖 [Step-by-step Deployment Guide](docs/DEPLOYMENT.md)
- ✅ [Production Checklist](docs/PRODUCTION_CHECKLIST.md)
- 🔧 [Environment Examples](apps/api/.env.production.example)

### Cost Estimate

- **Cloudflare**: ~$5-10/month (Workers + D1 + R2)
- **Vultr VPS**: $6/month (1GB RAM, Seoul)
- **OpenAI Whisper**: $0.006/minute of audio
- **Total**: ~$15-20/month (excluding STT usage)

## 📝 License

MIT

## 🤝 Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for development workflow and guidelines.

## 📧 Support

- Documentation: [docs/](docs/)
- Issues: [GitHub Issues](https://github.com/your-org/felix-radio/issues)
- Email: support@felix-radio.com
