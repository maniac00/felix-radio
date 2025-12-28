#!/bin/bash

echo "🚀 Starting Wrangler dev server..."
pnpm dev > /tmp/wrangler.log 2>&1 &
WRANGLER_PID=$!

echo "⏳ Waiting for server to start..."
sleep 12

echo "🔍 Testing health endpoint..."
HEALTH=$(curl -s http://localhost:8787/health)

if echo "$HEALTH" | grep -q "ok"; then
  echo "✅ Health check passed!"
  echo "$HEALTH"
  echo ""
  echo "📋 Testing root endpoint..."
  curl -s http://localhost:8787/ | head -n 30
  echo ""
  echo "✅ API is running successfully!"
else
  echo "❌ Health check failed"
  echo "Server logs:"
  cat /tmp/wrangler.log
fi

echo ""
echo "🛑 Stopping server..."
kill $WRANGLER_PID 2>/dev/null || pkill -f wrangler
sleep 2
echo "✨ Test complete!"
