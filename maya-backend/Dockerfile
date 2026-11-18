# -------------------------------------------------------------
# Stage 1: Build & native compilation (builder)
# -------------------------------------------------------------
FROM node:22-bookworm-slim AS builder

WORKDIR /app

# Native build toolchain for C++ bindings (@discordjs/opus)
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

# onnxruntime-node's install script downloads the CUDA GPU provider from NuGet.
# The VMs have no GPU (CPU binaries ship in the npm package) and that download times out.
ENV ONNXRUNTIME_NODE_INSTALL=skip

COPY package*.json ./

# Lockfile-exact install (runs node-gyp for @discordjs/opus)
RUN npm ci --legacy-peer-deps

COPY tsconfig*.json nest-cli.json ./
COPY src/ ./src/
COPY scripts/ ./scripts/

# Compile TypeScript to dist/ and produce the single-file bundle dist/main.js
RUN npm run build && npm run bundle

# Drop devDependencies; native binaries stay in node_modules
RUN npm prune --omit=dev --legacy-peer-deps

# -------------------------------------------------------------
# Stage 2: Production runtime
# -------------------------------------------------------------
FROM node:22-bookworm-slim AS production

# espeak-ng for Piper TTS phonemization
RUN apt-get update && apt-get install -y --no-install-recommends espeak-ng \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

COPY --chown=node:node --from=builder /app/package*.json ./
COPY --chown=node:node --from=builder /app/node_modules/ ./node_modules/
COPY --chown=node:node --from=builder /app/dist/ ./dist/
COPY --chown=node:node assets/ ./assets/

USER node

EXPOSE 3000

# Single process: Live session state, caches and background jobs are in-memory,
# so the app must not be clustered. Docker (restart: unless-stopped) supervises it.
CMD ["node", "dist/main.js"]
