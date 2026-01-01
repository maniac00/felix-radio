#!/bin/bash
# Helper script to update recorder with current tunnel URL

TUNNEL_LOG="/tmp/felix-tunnel.log"
MAX_WAIT=30

echo "🔧 Configuring recorder with tunnel URL..."

# Wait for tunnel URL to appear
for i in $(seq 1 $MAX_WAIT); do
    if [ -f "$TUNNEL_LOG" ] && grep -q "https://" "$TUNNEL_LOG"; then
        TUNNEL_URL=$(grep -E -o 'https://[a-zA-Z0-9\-]+\.trycloudflare\.com' "$TUNNEL_LOG" | head -1)
        
        if [ -n "$TUNNEL_URL" ]; then
            echo "   ✅ Found tunnel URL: $TUNNEL_URL"
            
            # Create .env file locally
            cat > /tmp/felix-recorder.env << EOF
# Workers API Configuration
# Primary: Local tunnel (auto-detected, preferred)
WORKERS_API_URL_PRIMARY=$TUNNEL_URL
# Fallback: Production (always available)
WORKERS_API_URL_FALLBACK=https://felix-radio-api.7wario.workers.dev
INTERNAL_API_KEY=dev_api_key_12345

# OpenAI Whisper API
OPENAI_API_KEY=sk-proj-YOUR_KEY_HERE

# Cloudflare R2 Configuration
R2_ACCOUNT_ID=ed20098766cafda6a8821fcc3be0ac43
R2_ACCESS_KEY_ID=4972687ffcb2b717819580b75bffd463
R2_SECRET_ACCESS_KEY=0452e5853a5c20bb833f2ae132ba9875731df49a970ffb2a1bc5fa11b425246f
R2_BUCKET_NAME=felix-radio-recordings
R2_ENDPOINT=https://ed20098766cafda6a8821fcc3be0ac43.r2.cloudflarestorage.com

# Configuration
TZ=Asia/Seoul
LOG_LEVEL=info
EOF
            
            # Upload to recorder server
            if scp -q /tmp/felix-recorder.env root@158.247.206.183:felix-radio/packages/recorder/.env; then
                rm /tmp/felix-recorder.env
                echo "   ✅ Recorder .env updated"
                
                # Restart recorder
                echo "   🔄 Restarting recorder service..."
                if ssh root@158.247.206.183 "cd felix-radio/packages/recorder && docker-compose down && docker-compose up -d" > /dev/null 2>&1; then
                    echo "   ✅ Recorder restarted with tunnel URL"
                    exit 0
                else
                    echo "   ❌ Failed to restart recorder"
                    exit 1
                fi
            else
                echo "   ❌ Failed to upload .env file"
                rm /tmp/felix-recorder.env
                exit 1
            fi
        fi
    fi
    
    sleep 1
done

echo "   ⏰ Timeout waiting for tunnel URL"
exit 1
