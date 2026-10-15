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

  // Enable CORS for web clients (e.g. Expo web on localhost:8081)
  app.enableCors({
    origin: true, // Reflects the request origin in development
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-requested-with', 'Accept'],
  });

  const port = process.env.PORT ?? 3000;
  await app.listen(port, '0.0.0.0');
  console.log(`[NestJS] Backend running with CORS enabled on http://localhost:${port}`);
}

await bootstrap();
