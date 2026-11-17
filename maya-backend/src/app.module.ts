import { Module } from '@nestjs/common';
import { createObserveModule } from '@nestjs/observe';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';

import { ScheduleModule } from '@nestjs/schedule';
import { ConfigModule } from '@nestjs/config';
import { HealthModule } from './health/health.module.js';
import { SessionsModule } from './sessions/sessions.module.js';
import { LiveModule } from './live/live.module.js';
import { RoadmapModule } from './roadmap/roadmap.module.js';
import { AuthModule } from './auth/auth.module.js';
import { PayHereModule } from './payments/payhere.module.js';
import { StatsModule } from './stats/stats.module.js';

// Telemetry requires credentials from the environment (no hardcoded fallback secret).
const isObserveEnabled =
  process.env.OBSERVE_ENABLED !== 'false' &&
  process.env.NODE_ENV !== 'test' &&
  Boolean(process.env.OBSERVE_APP_KEY && process.env.OBSERVE_APP_SECRET);

export const { ObserveModule, ObserveInstrument } = createObserveModule();

const observeImports = isObserveEnabled
  ? [
      ObserveModule.forRoot({
        appKey: process.env.OBSERVE_APP_KEY as string,
        appSecret: process.env.OBSERVE_APP_SECRET as string,
        serviceId: 'maya-backend',
        // Default lowered from 0.2: the account hit 600k of 300k included events (429s).
        tracesSampleRate: process.env.OBSERVE_SAMPLE_RATE ? parseFloat(process.env.OBSERVE_SAMPLE_RATE) : 0.02,
      }),
    ]
  : [];

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    ScheduleModule.forRoot(),
    ...observeImports,
    HealthModule,
    AuthModule,
    PayHereModule,
    StatsModule,
    SessionsModule,
    LiveModule,
    RoadmapModule,
  ],

  controllers: [AppController],
  providers: [AppService],
})
export class AppModule { }

