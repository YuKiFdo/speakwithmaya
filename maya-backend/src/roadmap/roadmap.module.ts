import { Module } from '@nestjs/common';
import { RoadmapController } from './roadmap.controller.js';
import { RoadmapService } from './roadmap.service.js';
import { AuthModule } from '../auth/auth.module.js';

@Module({
  imports: [AuthModule],
  controllers: [RoadmapController],
  providers: [RoadmapService],
  exports: [RoadmapService],
})
export class RoadmapModule {}

