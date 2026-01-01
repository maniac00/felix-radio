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
for arg in "$@"; do
    case $arg in
        --mock)
            WITH_API=false
            shift
            ;;
        --skip-install)
            SKIP_INSTALL=true
            shift
            ;;
        *)
            echo "❌ Unknown argument: $arg"
            echo "Usage: ./scripts/dev-start.sh [--mock] [--skip-install]"
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
else
    echo "   Mode: Mock API (using mock data)"
    echo "   💡 Tip: Remove --mock flag to run with real API server"
fi
echo ""
echo "   Press Ctrl+C to stop the server"
echo ""
echo "=================================================="
echo ""

# Trap Ctrl+C to clean up API server
cleanup() {
    echo ""
    echo "🛑 Stopping servers..."
    if [ -f "/tmp/felix-api.pid" ]; then
        API_PID=$(cat /tmp/felix-api.pid)
        kill $API_PID 2>/dev/null
        rm /tmp/felix-api.pid
        echo "   ✅ API server stopped"
    fi
    exit 0
}

trap cleanup INT TERM

cd apps/web && npm run dev
