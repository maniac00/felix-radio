#!/bin/bash

# Felix Radio - Local Development Start Script

echo "🐱 Felix Radio - Starting Local Development Server"
echo "=================================================="

# Check if running from project root
if [ ! -f "package.json" ]; then
    echo "❌ Error: Please run this script from project root"
    exit 1
fi

# Check if .env.local exists
if [ ! -f "apps/web/.env.local" ]; then
    echo "📝 Creating .env.local with demo credentials..."
    cat > apps/web/.env.local << 'EOF'
# Clerk keys (placeholder - authentication disabled for demo)
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_placeholder
CLERK_SECRET_KEY=sk_test_placeholder

# API Configuration
NEXT_PUBLIC_API_URL=http://localhost:8787
EOF
    echo "✅ Created apps/web/.env.local"
fi

# Disable Clerk authentication for demo
if [ -f "apps/web/middleware.ts" ]; then
    echo "🔓 Disabling authentication middleware for demo..."
    mv apps/web/middleware.ts apps/web/middleware.ts.disabled 2>/dev/null || true
fi

# Start development server
echo ""
echo "🚀 Starting Next.js development server..."
echo ""
echo "   📱 Local:    http://localhost:3000"
echo "   🌐 Network:  http://$(ipconfig getifaddr en0 2>/dev/null || echo "unavailable"):3000"
echo ""
echo "   Available pages:"
echo "   - Dashboard:        /dashboard"
echo "   - Schedules:        /dashboard/schedules"
echo "   - Recordings:       /dashboard/recordings"
echo "   - Recording Detail: /dashboard/recordings/1"
echo ""
echo "   Press Ctrl+C to stop the server"
echo ""
echo "=================================================="
echo ""

cd apps/web && npm run dev
