import { Module } from '@nestjs/common';
import { SessionsController } from './sessions.controller.js';
import { SessionsService } from './sessions.service.js';
import { RoadmapModule } from '../roadmap/roadmap.module.js';
import { AuthModule } from '../auth/auth.module.js';

@Module({
  imports: [RoadmapModule, AuthModule],
  controllers: [SessionsController],
  providers: [SessionsService],
  exports: [SessionsService],
})
export class SessionsModule {}
