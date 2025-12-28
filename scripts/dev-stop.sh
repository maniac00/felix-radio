#!/bin/bash

# Felix Radio - Local Development Stop Script

echo "🐱 Felix Radio - Stopping Local Development Server"
echo "=================================================="

# Find and kill Next.js dev server
echo "🔍 Looking for Next.js development server..."

# Find process by port 3000
PID=$(lsof -ti:3000)

if [ -z "$PID" ]; then
    echo "ℹ️  No server running on port 3000"
else
    echo "🛑 Stopping server (PID: $PID)..."
    kill -9 $PID 2>/dev/null
    echo "✅ Server stopped successfully"
fi

# Also kill any node processes running next dev
NODE_PIDS=$(pgrep -f "next dev")
if [ ! -z "$NODE_PIDS" ]; then
    echo "🧹 Cleaning up additional Next.js processes..."
    echo "$NODE_PIDS" | xargs kill -9 2>/dev/null
    echo "✅ Cleanup completed"
fi

echo ""
echo "=================================================="
echo "✨ All development servers stopped"
echo ""
