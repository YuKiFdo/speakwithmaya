import { NestFactory } from '@nestjs/core';
import { WsAdapter } from '@nestjs/platform-ws';
import express from 'express';
import { AppModule, ObserveInstrument } from './app.module.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    instrument: ObserveInstrument,
  });

  // PayHere notify_url sends application/x-www-form-urlencoded POST requests
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));
  app.use(express.json({ limit: '10mb' }));

  app.useWebSocketAdapter(new WsAdapter(app));

  // Enable CORS for web clients (Expo web, admin.speakwithmaya.com, speakwithmaya.com)
  app.enableCors({
    origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
      // Allow requests with no origin (mobile apps, server-to-server) or any valid origin
      if (!origin) return callback(null, true);
      const allowedOrigins = [
        'https://admin.speakwithmaya.com',
        'https://speakwithmaya.com',
        'https://www.speakwithmaya.com',
        'http://localhost:8081',
        'http://localhost:3000',
        'http://localhost:19006',
      ];
      if (allowedOrigins.includes(origin) || origin.endsWith('.speakwithmaya.com') || origin.includes('localhost')) {
        return callback(null, true);
      }
      return callback(null, true);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH', 'HEAD'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-requested-with', 'Accept', 'Range', 'Cache-Control', 'pragma'],
    exposedHeaders: ['Content-Range', 'Accept-Ranges', 'Content-Length', 'Content-Type'],
  });

  const port = process.env.PORT ?? 3000;
  await app.listen(port, '0.0.0.0');
  console.log(`[NestJS] Backend running with CORS enabled on http://localhost:${port}`);
}

await bootstrap();
