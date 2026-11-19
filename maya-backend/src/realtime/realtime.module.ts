import { Global, Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { EventsGateway } from './events.gateway.js';
import { EventsService } from './events.service.js';

/**
 * EventsService has no dependencies and is global, so any service (auth, payments, sessions)
 * can emit change hints without importing anything - and without a circular module import.
 */
@Global()
@Module({
  providers: [EventsService],
  exports: [EventsService],
})
export class EventsModule {}

/** The /events WebSocket gateway (needs AuthService to validate tokens). */
@Module({
  imports: [AuthModule],
  providers: [EventsGateway],
})
export class RealtimeGatewayModule {}
