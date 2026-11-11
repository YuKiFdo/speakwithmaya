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

const isObserveEnabled =
  process.env.OBSERVE_ENABLED !== 'false' &&
  process.env.NODE_ENV !== 'test';

export const { ObserveModule, ObserveInstrument } = createObserveModule();

const observeImports = isObserveEnabled
  ? [
      ObserveModule.forRoot({
        appKey: process.env.OBSERVE_APP_KEY || 'x5J8HLTDWVq6XfeS',
        appSecret: process.env.OBSERVE_APP_SECRET || 'uO^nYCzd30LMNSf8gh7oDH15mdy5hj7FOQoVOQrSCS1SO',
        serviceId: 'maya-backend',
        tracesSampleRate: process.env.OBSERVE_SAMPLE_RATE ? parseFloat(process.env.OBSERVE_SAMPLE_RATE) : 0.2,
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

