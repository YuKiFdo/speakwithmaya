# -------------------------------------------------------------
# Stage 1: Build Next.js Landing Site
# -------------------------------------------------------------
FROM node:22-bookworm-slim AS builder

WORKDIR /app

# Copy package manifests
COPY package*.json ./

# Install dependencies
RUN npm ci --legacy-peer-deps

# Copy source code
COPY . .

# Build Next.js site
RUN npm run build

# -------------------------------------------------------------
# Stage 2: Production Runner (Next.js standalone output)
# -------------------------------------------------------------
# Only the traced runtime files (~40 MB) instead of the full node_modules: the old image
# was ~1.26 GB and the CPU-starved VPS needed 15+ minutes to unpack it on each deploy.
FROM node:22-bookworm-slim AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3001
# server.js listens on $HOSTNAME; with host networking that would be the VPS hostname
ENV HOSTNAME=0.0.0.0

COPY --from=builder --chown=node:node /app/.next/standalone ./
COPY --from=builder --chown=node:node /app/.next/static ./.next/static
COPY --from=builder --chown=node:node /app/public ./public

USER node

EXPOSE 3001

CMD ["node", "server.js"]
