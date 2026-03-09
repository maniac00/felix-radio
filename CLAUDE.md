# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Development
pnpm dev                    # Start all services (web + api)
pnpm dev:start              # Frontend only with mock data

# Per-service dev
cd apps/web && pnpm dev     # Next.js dev server (port 3000)
cd apps/api && pnpm dev     # Wrangler dev server (port 8787)
cd packages/recorder && pnpm dev  # tsx watch mode

# Build
pnpm build                  # Build all workspaces
cd packages/recorder && pnpm build  # TypeScript → dist/

# Type checking (API has no build script)
cd apps/api && npx tsc --noEmit

# Lint & Format
pnpm lint                   # Lint all workspaces
pnpm format                 # Prettier

# Database (D1)
cd apps/api && pnpm db:migrate:local   # Run migrations locally
cd apps/api && pnpm db:migrate:prod    # Run migrations in production

# Recorder Docker
cd packages/recorder && pnpm docker:build
cd packages/recorder && pnpm docker:run

# Deploy
cd apps/api && pnpm deploy             # Cloudflare Workers
cd apps/web && pnpm deploy             # Cloudflare Pages
./scripts/deploy-production.sh         # Full production deploy
```

## Architecture

**Monorepo** (pnpm workspaces): `apps/*` and `packages/*`

### System Overview
```
Cloudflare Pages (Next.js) ←JWT→ Cloudflare Workers (Hono) ←→ D1 + R2
                                        ↑ API Key
                                   Vultr VPS (Node.js recorder + ffmpeg)
```

### apps/web — Next.js 15 Frontend
- Deployed to Cloudflare Pages, uses App Router
- Auth: NextAuth 5 beta with Google OAuth + JWT
- UI: shadcn/ui (Radix UI + Tailwind CSS 4)
- API client: `lib/api.ts` (ApiClient class, Bearer JWT auth)
- Path alias: `@/*` → `./*`

### apps/api — Cloudflare Workers API
- Framework: Hono, Database: D1 (SQLite), Storage: R2
- Two auth modes: JWT (public endpoints), API Key via `X-API-Key` header (internal endpoints at `/api/internal/*`)
- No `build` script — Wrangler handles TypeScript directly
- Path alias: `@/*` → `./src/*`
- Schema: `migrations/0001_initial_schema.sql` (users, radio_stations, schedules, recordings)

### packages/recorder — Recording Service
- Node.js 20+ on Docker (Vultr VPS), timezone Asia/Seoul
- Polls `/api/internal/schedules/pending` every 1 minute via node-cron
- Records HLS streams with ffmpeg → uploads MP3 to R2 → creates DB entry
- STT: OpenAI Whisper API, uploads text to R2
- Journal-based state tracking (`{dataDir}/journal.json`): `scheduled → recording → recorded → uploading → uploaded → db_synced`
- Schedule matching uses configurable time window (default 5 min)
- `withRetry()` for critical ops, `tryOperation()` for non-blocking ones
- R2 paths: `users/{user_id}/recordings/{filename}.mp3`

## Key Conventions

- ESM throughout — imports use `.js` extensions in recorder package
- API response format: `{ data, meta: { timestamp, requestId } }`
- D1 queries use prepared statements with `.bind()` (no raw string interpolation)
- Recorder prioritizes recording over DB operations (start ffmpeg immediately)
- Journal unique key: `{schedule_id}_{YYYY-MM-DD}` prevents duplicate recordings
- FileCleaner removes local files after retention period (default 3 days)
