# Layer layout matters on the VPS: it pulls and unpacks only layers it does not have, and
# with heavy CPU steal unpacking ~1 GB of node_modules took 10+ minutes per deploy. The old
# Dockerfile ran `npm prune` after the build, so node_modules became a new layer on EVERY
# commit. Now production deps are installed in their own stage that depends only on the
# lockfile, and the frequently-changing dist/ is the last, small layer.

# -------------------------------------------------------------
# Stage 1: production dependencies only (cached until package*.json changes)
# -------------------------------------------------------------
FROM node:22-bookworm-slim AS deps

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
RUN npm ci --omit=dev --legacy-peer-deps

# Runtime-only node_modules (~55 MB instead of ~1 GB): the app runs from the esbuild bundle,
# so production needs only the packages bundle.mjs leaves external (native ONNX / Opus, ...)
# and their own dependencies. onnxruntime-web (unused fallback) and non-linux-x64 ONNX
# binaries are dropped. Cached until package*.json or these two scripts change.
COPY scripts/bundle.mjs scripts/runtime-deps.mjs ./scripts/
RUN node scripts/runtime-deps.mjs /runtime

# -------------------------------------------------------------
# Stage 2: build (needs devDependencies)
# -------------------------------------------------------------
FROM deps AS builder

RUN npm ci --legacy-peer-deps

COPY tsconfig*.json nest-cli.json ./
COPY src/ ./src/
COPY scripts/ ./scripts/

# Compile TypeScript to dist/ and produce the single-file bundle dist/main.js (+ workers)
RUN npm run build && npm run bundle

# -------------------------------------------------------------
# Stage 3: Production runtime
# -------------------------------------------------------------
FROM node:22-bookworm-slim AS production

# espeak-ng for Piper TTS phonemization
RUN apt-get update && apt-get install -y --no-install-recommends espeak-ng \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
# glibc gives each thread pool its own malloc arena; with the per-session audio buffers and
# native Opus/ONNX allocations, freed memory stayed in those arenas and RSS kept growing
# (load test: JS heap 57 MiB but RSS ~660 MiB after all sessions closed). Two arenas makes
# freed memory get reused instead of piling up.
ENV MALLOC_ARENA_MAX=2

# Stable layers first (reused by the VPS across deploys), dist/ last (changes every deploy)
COPY --chown=node:node --from=deps /app/package*.json ./
COPY --chown=node:node --from=deps /runtime/node_modules/ ./node_modules/
COPY --chown=node:node assets/ ./assets/
COPY --chown=node:node --from=builder /app/dist/ ./dist/

USER node

EXPOSE 3000

# Single process: Live session state, caches and background jobs are in-memory,
# so the app must not be clustered. Docker (restart: unless-stopped) supervises it.
CMD ["node", "dist/main.js"]
