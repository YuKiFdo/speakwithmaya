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
# Stage 2: Production Runner
# -------------------------------------------------------------
FROM node:22-bookworm-slim AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3001

# Copy build artifacts and dependencies
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/next.config.ts ./next.config.ts

USER node

EXPOSE 3001

# Run Next.js on port 3001
CMD ["npm", "run", "start", "--", "-p", "3001"]
