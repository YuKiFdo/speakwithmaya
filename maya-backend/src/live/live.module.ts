import { Module } from '@nestjs/common';
import { LiveGateway } from './live.gateway.js';
import { SessionsModule } from '../sessions/sessions.module.js';
import { AuthModule } from '../auth/auth.module.js';

@Module({
  imports: [SessionsModule, AuthModule],
  providers: [LiveGateway],
  exports: [LiveGateway],
})
export class LiveModule {}
