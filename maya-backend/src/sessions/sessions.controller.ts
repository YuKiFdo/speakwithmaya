import {
  Controller,
  Post,
  Get,
  Query,
  Body,
  Param,
  Headers,
  UsePipes,
  ValidationPipe,
  UnauthorizedException,
} from '@nestjs/common';
import { SessionsService } from './sessions.service.js';
import { CreateSessionTokenDto, FinishSessionDto, QueryUsageDto } from './dto/session.dto.js';

@Controller('v1')
export class SessionsController {
  constructor(private readonly sessionsService: SessionsService) {}

  @Post('session-token')
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  async createToken(
    @Body() dto: CreateSessionTokenDto,
    @Headers('authorization') authHeader?: string,
  ) {
    if (!authHeader) {
      throw new UnauthorizedException('Missing Authorization header');
    }
    const token = authHeader.replace(/^Bearer\s+/i, '').trim();
    if (!token) {
      throw new UnauthorizedException('Invalid Bearer token');
    }

    const userId = await this.sessionsService.validateUser(token);
    return this.sessionsService.createSessionToken(userId, dto);
  }

  @Post('sessions/:id/finish')
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  async finishSession(
    @Param('id') sessionId: string,
    @Body() dto: FinishSessionDto,
    @Headers('authorization') authHeader?: string,
  ) {
    if (!authHeader) {
      throw new UnauthorizedException('Missing Authorization header');
    }
    const token = authHeader.replace(/^Bearer\s+/i, '').trim();
    if (!token) {
      throw new UnauthorizedException('Invalid Bearer token');
    }

    const userId = await this.sessionsService.validateUser(token);
    return this.sessionsService.finishSession(sessionId, userId, dto);
  }

  @Get('sessions')
  async getSessions() {
    return this.sessionsService.getUserSessions();
  }

  @Get('sessions/:id')
  async getSessionById(@Param('id') sessionId: string) {
    return this.sessionsService.getSessionDetail(sessionId);
  }

  @Get('admin/usage')
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  async getUsage(@Query() query: QueryUsageDto) {
    return this.sessionsService.getUsageData(query);
  }

  @Get('admin/usage/sessions/:id')
  async getSessionDetail(@Param('id') sessionId: string) {
    return this.sessionsService.getSessionDetail(sessionId);
  }
}

