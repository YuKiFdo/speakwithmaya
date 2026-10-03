import { Module } from '@nestjs/common';
import { RoadmapController } from './roadmap.controller.js';
import { RoadmapService } from './roadmap.service.js';

@Module({
  controllers: [RoadmapController],
  providers: [RoadmapService],
  exports: [RoadmapService],
})
export class RoadmapModule {}
