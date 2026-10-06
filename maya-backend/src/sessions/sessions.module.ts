import { Module } from '@nestjs/common';
import { SessionsController } from './sessions.controller.js';
import { SessionsService } from './sessions.service.js';
import { RoadmapModule } from '../roadmap/roadmap.module.js';

@Module({
  imports: [RoadmapModule],
  controllers: [SessionsController],
  providers: [SessionsService],
  exports: [SessionsService],
})
export class SessionsModule {}
