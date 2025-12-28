# Felix Radio API

Cloudflare Workers API for radio recording and STT transcription service.

## Tech Stack

- **Runtime**: Cloudflare Workers (Hono framework)
- **Database**: Cloudflare D1 (SQLite on edge)
- **Storage**: Cloudflare R2 (S3-compatible object storage)
- **Authentication**: Clerk JWT validation
- **Language**: TypeScript

## Project Structure

```
apps/api/
├── src/
│   ├── index.ts              # Main Hono app
│   ├── types.ts              # Shared TypeScript types
│   ├── middleware/
│   │   ├── auth.ts           # Clerk JWT authentication
│   │   └── apiKey.ts         # Internal API key auth
│   ├── routes/
│   │   ├── schedules.ts      # Schedule CRUD endpoints
│   │   ├── recordings.ts     # Recording management
│   │   ├── stations.ts       # Radio station listings
│   │   ├── dashboard.ts      # User statistics
│   │   └── internal.ts       # Recorder server integration
│   ├── db/
│   │   └── queries.ts        # D1 database queries
│   └── storage/
│       └── r2.ts             # R2 file operations
├── migrations/
│   └── 0001_initial_schema.sql
├── wrangler.toml             # Cloudflare Workers config
└── package.json
```

## API Endpoints

### Public Endpoints (Clerk Auth Required)

#### Authentication
- `GET /api/auth/me` - Test authentication, returns user ID

#### Schedules
- `GET /api/schedules` - List user's schedules
- `GET /api/schedules/:id` - Get schedule by ID
- `POST /api/schedules` - Create new schedule
- `PUT /api/schedules/:id` - Update schedule
- `DELETE /api/schedules/:id` - Delete schedule

#### Recordings
- `GET /api/recordings` - List recordings (pagination: ?limit=20&offset=0)
- `GET /api/recordings/:id` - Get recording by ID
- `GET /api/recordings/:id/download` - Download audio file
- `GET /api/recordings/:id/stt` - Get STT result
- `POST /api/recordings/:id/stt` - Trigger STT conversion
- `DELETE /api/recordings/:id` - Delete recording and files

#### Stations
- `GET /api/stations` - List active radio stations
- `GET /api/stations/:id` - Get station by ID

#### Dashboard
- `GET /api/dashboard/stats` - User statistics summary

### Internal Endpoints (API Key Required)

Used by Vultr recording server:

- `GET /api/internal/schedules/pending?time=HH:mm&day=0-6` - Get pending schedules
- `POST /api/internal/recordings` - Create recording entry
- `PUT /api/internal/recordings/:id/status` - Update recording status
- `PUT /api/internal/recordings/:id/stt` - Update STT status

## Development

### Prerequisites

- Node.js 20+
- pnpm
- Cloudflare account (for production)

### Setup

```bash
# Install dependencies
pnpm install

# Create local D1 database and run migrations
pnpm db:migrate:local migrations/0001_initial_schema.sql

# Configure environment variables
cp .dev.vars.example .dev.vars
# Edit .dev.vars with your Clerk keys

# Start development server
pnpm dev
```

### Available Scripts

```bash
pnpm dev                    # Start Wrangler dev server (port 8787)
pnpm deploy                 # Deploy to Cloudflare Workers

# Database operations
pnpm db:migrate:local       # Run migration locally
pnpm db:migrate:prod        # Run migration in production
pnpm db:console:local       # D1 SQL console (local)
pnpm db:console:prod        # D1 SQL console (production)

# R2 operations
pnpm r2:create              # Create R2 bucket
pnpm r2:list                # List R2 buckets
```

### Environment Variables

Create `.dev.vars` file:

```bash
# Clerk Authentication
CLERK_SECRET_KEY=sk_test_your_clerk_secret_key

# Internal API Key (for recorder server)
INTERNAL_API_KEY=your_secure_random_api_key
```

For production, set secrets:

```bash
wrangler secret put CLERK_SECRET_KEY
wrangler secret put INTERNAL_API_KEY
```

## Database Schema

### Tables

- **users** - Clerk user sync (id, email)
- **radio_stations** - Radio station info (name, stream_url)
- **schedules** - Recording schedules (program_name, days_of_week, start_time, duration_mins)
- **recordings** - Recording metadata (audio_file_path, status, stt_status, stt_text_path)

### Relationships

- `schedules.user_id` → `users.id` (CASCADE)
- `schedules.station_id` → `radio_stations.id` (RESTRICT)
- `recordings.user_id` → `users.id` (CASCADE)
- `recordings.schedule_id` → `schedules.id` (SET NULL)
- `recordings.station_id` → `radio_stations.id` (RESTRICT)

## Authentication

### Clerk JWT (Public API)

All `/api/*` endpoints require Bearer token:

```bash
curl -H "Authorization: Bearer YOUR_CLERK_JWT" \
  https://api.example.com/api/schedules
```

### API Key (Internal API)

All `/api/internal/*` endpoints require X-API-Key header:

```bash
curl -H "X-API-Key: YOUR_INTERNAL_API_KEY" \
  https://api.example.com/api/internal/schedules/pending?time=09:00&day=1
```

## Deployment

### Production Deployment

1. Create D1 database:
```bash
wrangler d1 create felix-radio-db
# Update wrangler.toml with database_id
```

2. Run migrations:
```bash
pnpm db:migrate:prod migrations/0001_initial_schema.sql
```

3. Create R2 bucket:
```bash
pnpm r2:create
```

4. Set secrets:
```bash
wrangler secret put CLERK_SECRET_KEY
wrangler secret put INTERNAL_API_KEY
```

5. Deploy:
```bash
pnpm deploy
```

## Testing

### Local Testing

```bash
# Test health endpoint
curl http://localhost:8787/health

# Test authentication (requires valid Clerk JWT)
curl -H "Authorization: Bearer YOUR_JWT" \
  http://localhost:8787/api/auth/me

# Test internal API (requires API key)
curl -H "X-API-Key: dev_api_key_12345" \
  "http://localhost:8787/api/internal/schedules/pending?time=09:00&day=1"
```

## Phase 2 Completion Status

✅ Task 11.0 - Cloudflare Workers API Setup
✅ Task 12.0 - Cloudflare D1 Database
✅ Task 13.0 - Cloudflare R2 Storage
✅ Task 14.0 - Authentication Middleware
✅ Task 15.0 - Schedule Endpoints
✅ Task 16.0 - Recording Endpoints
✅ Task 17.0 - STT Endpoints (integrated in Task 16.0)
✅ Task 18.0 - Station & Internal Endpoints

## Next Steps

- **Phase 3**: Vultr recording server implementation (packages/recorder/)
- **Phase 4**: Frontend-backend integration
- **Phase 5**: Production deployment

## License

Proprietary - Felix Radio Project
