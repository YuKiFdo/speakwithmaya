import { NestFactory } from '@nestjs/core';
import { WsAdapter } from '@nestjs/platform-ws';
import express from 'express';
import { Agent, setGlobalDispatcher } from 'undici';
import { AppModule, ObserveInstrument } from './app.module.js';

// Keep outbound HTTPS connections (Supabase, Gemini, etc.) alive between requests.
// Node's default fetch closes idle sockets after ~4 s, so at low traffic almost every
// Supabase call paid a fresh TCP+TLS handshake (measured 0.3–0.8 s from the VPS).
setGlobalDispatcher(
  new Agent({
    keepAliveTimeout: Number(process.env.OUTBOUND_KEEPALIVE_MS) || 60_000,
    keepAliveMaxTimeout: 10 * 60_000,
    connections: 32, // per origin; bounds sockets if a burst hits
  }),
);

// Global outbound fetch timeout safeguard: prevent unbounded hangs if caller omitted AbortSignal
const _origFetch = globalThis.fetch;
const OUTBOUND_HTTP_TIMEOUT_MS = Number(process.env.OUTBOUND_HTTP_TIMEOUT_MS) || 30000;
globalThis.fetch = function (input: RequestInfo | URL, init?: RequestInit) {
  if (!init?.signal) {
    return _origFetch(input, { ...init, signal: AbortSignal.timeout(OUTBOUND_HTTP_TIMEOUT_MS) });
  }
  return _origFetch(input, init);
} as typeof fetch;

async function bootstrap() {
  const isObserveEnabled =
    process.env.OBSERVE_ENABLED !== 'false' &&
    process.env.NODE_ENV !== 'test' &&
    Boolean(process.env.OBSERVE_APP_KEY && process.env.OBSERVE_APP_SECRET);

  const app = await NestFactory.create(AppModule, {
    ...(isObserveEnabled && ObserveInstrument ? { instrument: ObserveInstrument } : {}),
  });

  // PayHere notify_url sends application/x-www-form-urlencoded POST requests
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));
  app.use(express.json({ limit: '10mb' }));

  app.useWebSocketAdapter(new WsAdapter(app));

  // Enable CORS for web clients (Expo web, admin.speakwithmaya.com, speakwithmaya.com)
  app.enableCors({
    origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
      // Allow requests with no origin (mobile apps, server-to-server)
      if (!origin) return callback(null, true);
      const allowedOrigins = [
        'https://admin.speakwithmaya.com',
        'https://speakwithmaya.com',
        'https://www.speakwithmaya.com',
        'http://localhost:8081',
        'http://localhost:3000',
        'http://localhost:19006',
      ];
      const isAllowed =
        allowedOrigins.includes(origin) ||
        origin.endsWith('.speakwithmaya.com') ||
        origin.includes('azurecontainerapps.io') ||
        origin.includes('azurewebsites.net') ||
        origin.includes('localhost') ||
        origin.includes('127.0.0.1') ||
        /^https?:\/\/(192\.168\.|10\.|172\.(1[6-9]|2\d|3[01])\.)/.test(origin);

      if (isAllowed) {
        return callback(null, true);
      }
      return callback(new Error('Origin not allowed by CORS'), false);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH', 'HEAD'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'x-admin-token',
      'x-dashboard-key',
      'X-Dashboard-Key',
      'x-requested-with',
      'Accept',
      'Range',
      'Cache-Control',
      'pragma',
      'Pragma',
      'expires',
      'Expires',
    ],
    exposedHeaders: ['Content-Range', 'Accept-Ranges', 'Content-Length', 'Content-Type'],
  });

  const port = process.env.PORT ?? 3000;
  await app.listen(port, '0.0.0.0');
  console.log(`[NestJS] Backend running with CORS enabled on http://localhost:${port}`);

  // Zero-downtime PM2 reloads: with `wait_ready: true` PM2 keeps the old process serving
  // until this signal arrives, instead of killing it as soon as the new one is spawned.
  process.send?.('ready');
}

await bootstrap();
