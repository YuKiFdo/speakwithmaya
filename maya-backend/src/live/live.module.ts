import { Module } from '@nestjs/common';
import { LiveGateway } from './live.gateway.js';
import { SessionsModule } from '../sessions/sessions.module.js';

@Module({
  imports: [SessionsModule],
  providers: [LiveGateway],
  exports: [LiveGateway],
})
export class LiveModule {}
