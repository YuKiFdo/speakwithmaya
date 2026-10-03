import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { RoadmapService } from './roadmap.service.js';
import {
  CreateRoadmapLevelDto,
  UpdateRoadmapLevelDto,
  ReorderRoadmapLevelsDto,
  SimulateLevelTurnDto,
} from './dto/roadmap.dto.js';

@Controller('v1')
export class RoadmapController {
  constructor(private readonly roadmapService: RoadmapService) {}

  // 1. Student / Public endpoint — returns only published levels
  @Get('roadmap')
  async getStudentRoadmap() {
    const levels = await this.roadmapService.getAllLevels(false);
    return {
      levels,
      total: levels.length,
    };
  }

  // 2. Admin: Get all levels (draft + published)
  @Get('admin/roadmap')
  async getAdminRoadmap() {
    const levels = await this.roadmapService.getAllLevels(true);
    return {
      levels,
      total: levels.length,
    };
  }

  // 3. Admin: Get single level details
  @Get('admin/roadmap/:id')
  async getLevelById(@Param('id') id: string) {
    return this.roadmapService.getLevelById(id);
  }

  // 4. Admin: Create new level
  @Post('admin/roadmap')
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  async createLevel(@Body() dto: CreateRoadmapLevelDto) {
    return this.roadmapService.createLevel(dto);
  }

  // 5. Admin: Reorder levels
  @Put('admin/roadmap/reorder')
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  async reorderLevels(@Body() dto: ReorderRoadmapLevelsDto) {
    return this.roadmapService.reorderLevels(dto.levels);
  }

  // 6. Admin: Update level
  @Put('admin/roadmap/:id')
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  async updateLevel(
    @Param('id') id: string,
    @Body() dto: UpdateRoadmapLevelDto,
  ) {
    return this.roadmapService.updateLevel(id, dto);
  }

  // 7. Admin: Delete level
  @Delete('admin/roadmap/:id')
  async deleteLevel(@Param('id') id: string) {
    return this.roadmapService.deleteLevel(id);
  }

  // 8. Admin: Test / Simulate a level turn in the Playground
  @Post('admin/roadmap/simulate')
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  async simulateLevelTurn(@Body() dto: SimulateLevelTurnDto) {
    return this.roadmapService.simulateTurn(dto);
  }
}
