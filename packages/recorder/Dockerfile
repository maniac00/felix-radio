# Felix Radio Recorder - Docker Image
FROM node:20-alpine

# Install ffmpeg
RUN apk add --no-cache ffmpeg

# Set working directory
WORKDIR /app

# Copy package files
COPY package.json pnpm-lock.yaml* ./

# Install pnpm and dependencies
RUN npm install -g pnpm && pnpm install --no-frozen-lockfile

# Copy source code
COPY . .

# Build TypeScript
RUN pnpm build

# Set timezone environment variable
ENV TZ=Asia/Seoul

# Create persistent data directory and temp directory
RUN mkdir -p /data/felix-recordings/audio /tmp/felix-recordings

# Run the application
CMD ["node", "dist/index.js"]
