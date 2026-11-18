# -------------------------------------------------------------
# Stage 1: Build Expo Web bundle
# -------------------------------------------------------------
FROM node:22-bookworm-slim AS builder

WORKDIR /app

# Copy package manifests
COPY package*.json ./

# Install dependencies
RUN npm ci --legacy-peer-deps

# Copy application source code
COPY . .

# Environment configuration for Expo Web export
ARG EXPO_PUBLIC_BACKEND_URL=https://api.speakwithmaya.com
ARG EXPO_PUBLIC_USE_SERVER_LIVE=true
ARG EXPO_PUBLIC_SUPABASE_URL
ARG EXPO_PUBLIC_SUPABASE_ANON_KEY
ENV EXPO_PUBLIC_BACKEND_URL=$EXPO_PUBLIC_BACKEND_URL
ENV EXPO_PUBLIC_USE_SERVER_LIVE=$EXPO_PUBLIC_USE_SERVER_LIVE
ENV EXPO_PUBLIC_SUPABASE_URL=$EXPO_PUBLIC_SUPABASE_URL
ENV EXPO_PUBLIC_SUPABASE_ANON_KEY=$EXPO_PUBLIC_SUPABASE_ANON_KEY

# Build and export web bundle (creates dist/ with precompressed brotli/gzip assets)
RUN npm run build:web

# -------------------------------------------------------------
# Stage 2: Fast Brotli/Gzip static web server
# -------------------------------------------------------------
FROM node:22-bookworm-slim AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=8080

# Copy pre-compressed static files and production web-server
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/web-server ./web-server

USER node

EXPOSE 8080

# Run lightweight precompressed static web server
CMD ["node", "web-server/server.js"]
