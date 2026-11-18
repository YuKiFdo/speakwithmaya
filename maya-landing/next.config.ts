import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Standalone build: emits .next/standalone/server.js with only the traced runtime files,
  // so the Docker image no longer ships the full node_modules (~1.26 GB image before),
  // which the CPU-starved VPS took 15+ minutes to unpack on each deploy.
  output: "standalone",
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
