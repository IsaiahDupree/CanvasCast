# CanvasCast Worker - Multi-stage Build
# Includes Node.js, ffmpeg, and Chromium for Remotion rendering

# Stage 1: Dependencies
FROM node:20-slim AS deps
WORKDIR /app

# Install pnpm
RUN npm install -g pnpm@9.0.0

# Copy package files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/worker/package.json ./apps/worker/
COPY packages/remotion/package.json ./packages/remotion/
COPY packages/shared/package.json ./packages/shared/

# Install dependencies
RUN pnpm install --frozen-lockfile

# Stage 2: Builder
FROM node:20-slim AS builder
WORKDIR /app

# Install pnpm
RUN npm install -g pnpm@9.0.0

# Copy dependencies from deps stage
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/worker/node_modules ./apps/worker/node_modules
COPY --from=deps /app/packages/remotion/node_modules ./packages/remotion/node_modules
COPY --from=deps /app/packages/shared/node_modules ./packages/shared/node_modules

# Copy package files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/worker/package.json ./apps/worker/
COPY packages/remotion/package.json ./packages/remotion/
COPY packages/shared/package.json ./packages/shared/

# Copy source code
COPY apps/worker ./apps/worker
COPY packages/remotion ./packages/remotion
COPY packages/shared ./packages/shared

# Build worker
WORKDIR /app/apps/worker
RUN pnpm build

# Stage 3: Runner
FROM node:20-slim AS runner
WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    # FFmpeg for audio/video processing
    ffmpeg \
    # Chromium dependencies for Remotion
    chromium \
    fonts-liberation \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libatspi2.0-0 \
    libcups2 \
    libdbus-1-3 \
    libdrm2 \
    libgbm1 \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
    libxcomposite1 \
    libxdamage1 \
    libxfixes3 \
    libxkbcommon0 \
    libxrandr2 \
    xdg-utils \
    # Clean up
    && rm -rf /var/lib/apt/lists/*

# Set Puppeteer to use system Chromium
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium
ENV NODE_ENV=production

# Create non-root user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 workeruser

# Install pnpm
RUN npm install -g pnpm@9.0.0

# Copy package files for production install
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/worker/package.json ./apps/worker/
COPY packages/remotion/package.json ./packages/remotion/
COPY packages/shared/package.json ./packages/shared/

# Install only production dependencies
RUN pnpm install --frozen-lockfile --prod

# Copy built files
COPY --from=builder --chown=workeruser:nodejs /app/apps/worker/dist ./apps/worker/dist
COPY --from=builder --chown=workeruser:nodejs /app/packages/remotion/dist ./packages/remotion/dist
COPY --from=builder --chown=workeruser:nodejs /app/packages/shared/dist ./packages/shared/dist

# Copy Remotion source files (needed for rendering)
COPY --from=builder --chown=workeruser:nodejs /app/packages/remotion/src ./packages/remotion/src

# Switch to non-root user
USER workeruser

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD node -e "console.log('healthy')" || exit 1

# Run worker
CMD ["node", "apps/worker/dist/index.js"]
