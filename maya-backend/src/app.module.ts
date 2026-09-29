import { Module } from '@nestjs/common';
import { createObserveModule } from '@nestjs/observe';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';

import { ConfigModule } from '@nestjs/config';
import { HealthModule } from './health/health.module.js';
import { SessionsModule } from './sessions/sessions.module.js';

export const { ObserveModule, ObserveInstrument } = createObserveModule();

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    // Distributed tracing, auto-correlated logs, request/job metrics, error
    // telemetry, alarms, and more — out of the box. Sign up at https://observe.nestjs.com
    ObserveModule.forRoot({
      appKey: 'x5J8HLTDWVq6XfeS',
      appSecret: 'uO^nYCzd30LMNSf8gh7oDH15mdy5hj7FOQoVOQrSCS1SO',
      serviceId: 'maya-backend',
    }),
    HealthModule,
    SessionsModule,
  ],

  controllers: [AppController],
  providers: [AppService],
})
export class AppModule { }

