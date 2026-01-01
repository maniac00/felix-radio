#!/bin/bash

# Felix Radio - Local Development Start Script

echo "🐱 Felix Radio - Starting Local Development Server"
echo "=================================================="

# Check if running from project root
if [ ! -f "package.json" ]; then
    echo "❌ Error: Please run this script from project root"
    exit 1
fi

# Parse command line arguments
WITH_API=true  # Default to using real API
SKIP_INSTALL=false
WITH_TUNNEL=true  # Default to using tunnel
for arg in "$@"; do
    case $arg in
        --mock)
            WITH_API=false
            WITH_TUNNEL=false
            shift
            ;;
        --skip-install)
            SKIP_INSTALL=true
            shift
            ;;
        --no-tunnel)
            WITH_TUNNEL=false
            shift
            ;;
        *)
            echo "❌ Unknown argument: $arg"
            echo "Usage: ./scripts/dev-start.sh [--mock] [--skip-install] [--no-tunnel]"
            exit 1
            ;;
    esac
done

# Check for uncommitted changes
if [ -n "$(git status --porcelain)" ]; then
    echo "⚠️  Warning: You have uncommitted changes"
    echo ""
fi

# Install/update dependencies if needed
if [ "$SKIP_INSTALL" = false ]; then
    echo "📦 Checking dependencies..."

    # Check if node_modules exists and package.json was modified
    if [ ! -d "node_modules" ] || [ "package.json" -nt "node_modules" ]; then
        echo "   📥 Installing dependencies..."
        pnpm install --silent
        echo "   ✅ Dependencies installed"
    else
        echo "   ✅ Dependencies up to date"
    fi
    echo ""
fi

# Create or update .env.local
if [ "$WITH_API" = true ]; then
    echo "📝 Creating .env.local with real API mode..."
    cat > apps/web/.env.local << 'EOF'
# Clerk Authentication Keys
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_bGlrZWQtbWFybW9zZXQtOC5jbGVyay5hY2NvdW50cy5kZXYk
CLERK_SECRET_KEY=sk_test_z2rJXG5lIOFotq2TvjBGBKFA2CdymS0FPLUoJxpVzy

# API Configuration
NEXT_PUBLIC_API_URL=http://localhost:8787

# Real API Mode
NEXT_PUBLIC_USE_MOCK_API=false
EOF
    echo "✅ Created apps/web/.env.local with real API mode"
else
    # Always regenerate .env.local in mock mode to ensure correct settings
    echo "📝 Creating .env.local with mock mode..."
    cat > apps/web/.env.local << 'EOF'
# Clerk Authentication Keys
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_bGlrZWQtbWFybW9zZXQtOC5jbGVyay5hY2NvdW50cy5kZXYk
CLERK_SECRET_KEY=sk_test_z2rJXG5lIOFotq2TvjBGBKFA2CdymS0FPLUoJxpVzy

# API Configuration
NEXT_PUBLIC_API_URL=http://localhost:8787

# Mock Mode (set to 'true' to use mock data)
NEXT_PUBLIC_USE_MOCK_API=true
EOF
    echo "✅ Created apps/web/.env.local with mock mode enabled"
fi

# Start API server if --with-api flag is set
if [ "$WITH_API" = true ]; then
    echo ""
    echo "🔧 Starting API server (Wrangler)..."
    echo ""

    # Clean up old API server if running
    if [ -f "/tmp/felix-api.pid" ]; then
        OLD_API_PID=$(cat /tmp/felix-api.pid)
        if ps -p $OLD_API_PID > /dev/null 2>&1; then
            echo "   🧹 Stopping old API server..."
            kill $OLD_API_PID 2>/dev/null
            sleep 1
        fi
        rm /tmp/felix-api.pid
    fi

    # Start API server in background
    (cd apps/api && pnpm dev > /tmp/felix-api.log 2>&1) &
    API_PID=$!
    echo $API_PID > /tmp/felix-api.pid

    echo "   ⏳ Waiting for API server to be ready..."
    # Wait for API server to be ready (check for port 8787)
    for i in {1..30}; do
        if lsof -Pi :8787 -sTCP:LISTEN -t >/dev/null 2>&1; then
            echo "   ✅ API server is ready on http://localhost:8787"
            break
        fi
        if [ $i -eq 30 ]; then
            echo "   ❌ API server failed to start within 30 seconds"
            echo "   📋 Check logs: tail -f /tmp/felix-api.log"
            kill $API_PID 2>/dev/null
            exit 1
        fi
        sleep 1
    done

    echo ""
fi

# Start Cloudflare Tunnel if --tunnel flag is set
if [ "$WITH_TUNNEL" = true ]; then
    echo ""
    echo "🌐 Starting Cloudflare Tunnel for local API..."
    echo ""

    # Clean up old tunnel if running
    if [ -f "/tmp/felix-tunnel.pid" ]; then
        OLD_TUNNEL_PID=$(cat /tmp/felix-tunnel.pid)
        if ps -p $OLD_TUNNEL_PID > /dev/null 2>&1; then
            echo "   🧹 Stopping old tunnel..."
            kill $OLD_TUNNEL_PID 2>/dev/null
            sleep 1
        fi
        rm /tmp/felix-tunnel.pid
    fi

    # Start tunnel in background
    cloudflared tunnel --url http://localhost:8787 > /tmp/felix-tunnel.log 2>&1 &
    TUNNEL_PID=$!
    echo $TUNNEL_PID > /tmp/felix-tunnel.pid

    echo "   ⏳ Configuring recorder with tunnel..."
    echo ""

    # Run tunnel setup script in background
    ./scripts/tunnel-setup-recorder.sh &
    TUNNEL_SETUP_PID=$!

    # Wait briefly to show tunnel URL
    sleep 3
    if [ -f "/tmp/felix-tunnel.log" ] && grep -q "https://" /tmp/felix-tunnel.log 2>/dev/null; then
        TUNNEL_URL=$(grep -E -o 'https://[a-zA-Z0-9\-]+\.trycloudflare\.com' /tmp/felix-tunnel.log | head -1)
        if [ -n "$TUNNEL_URL" ]; then
            echo "   🔗 Tunnel URL: $TUNNEL_URL"
        fi
    fi

    echo ""
fi

# Clean up old Next.js cache if needed (helps with code changes)
if [ -d "apps/web/.next" ]; then
    echo "🧹 Cleaning Next.js cache for fresh start..."
    rm -rf apps/web/.next
    echo "✅ Cache cleaned"
    echo ""
fi

# Start Next.js development server
echo ""
echo "🚀 Starting Next.js development server..."
echo ""
echo "   📱 Local:    http://localhost:3000"
echo "   🌐 Network:  http://$(ipconfig getifaddr en0 2>/dev/null || echo "unavailable"):3000"
if [ "$WITH_API" = true ]; then
    echo "   🔧 API:      http://localhost:8787"
fi
echo ""
echo "   Available pages:"
echo "   - Dashboard:        /dashboard"
echo "   - Schedules:        /dashboard/schedules"
echo "   - Recordings:       /dashboard/recordings"
echo "   - Recording Detail: /dashboard/recordings/1"
echo ""
if [ "$WITH_API" = true ]; then
    echo "   Mode: Real API (using local Wrangler server)"
    echo "   📋 API Logs: tail -f /tmp/felix-api.log"
    if [ "$WITH_TUNNEL" = true ]; then
        echo "   🌐 Tunnel: Active (check logs for public URL)"
        echo "   📋 Tunnel Logs: tail -f /tmp/felix-tunnel.log"
    fi
else
    echo "   Mode: Mock API (using mock data)"
    echo "   💡 Tip: Remove --mock flag to run with real API server"
fi
echo ""
echo "   Press Ctrl+C to stop the server"
echo ""
echo "=================================================="
echo ""

# Trap Ctrl+C to clean up API server and tunnel
cleanup() {
    echo ""
    echo "🛑 Stopping servers..."
    if [ -f "/tmp/felix-api.pid" ]; then
        API_PID=$(cat /tmp/felix-api.pid)
        kill $API_PID 2>/dev/null
        rm /tmp/felix-api.pid
        echo "   ✅ API server stopped"
    fi
    if [ -f "/tmp/felix-tunnel.pid" ]; then
        TUNNEL_PID=$(cat /tmp/felix-tunnel.pid)
        kill $TUNNEL_PID 2>/dev/null
        rm /tmp/felix-tunnel.pid
        echo "   ✅ Tunnel stopped"
        echo "   ℹ️  Recorder will auto-fallback to production API"
    fi
    exit 0
}

trap cleanup INT TERM

cd apps/web && npm run dev
