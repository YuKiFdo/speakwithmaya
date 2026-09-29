import { NestFactory } from '@nestjs/core';
import { AppModule, ObserveInstrument } from './app.module.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    instrument: ObserveInstrument,
  });

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
