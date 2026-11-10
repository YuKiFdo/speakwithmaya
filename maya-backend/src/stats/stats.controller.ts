import {
  Controller,
  Get,
  Query,
  Headers,
  Res,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Response } from 'express';
import { StatsService } from './stats.service.js';

@Controller(['stats', 'v1/stats'])
export class StatsController {
  private readonly logger = new Logger(StatsController.name);

  constructor(private readonly statsService: StatsService) {}

  /**
   * GET /stats/summary?from=YYYY-MM-DD&to=YYYY-MM-DD
   * Exact contract for the IDEACIPHER dashboard.
   * Reports ONLY Telco carrier subscriptions (IdeaMart & mSpace), strictly excluding test accounts.
   */
  @Get('summary')
  async getSummary(
    @Headers('x-dashboard-key') dashboardKeyHeader: string | undefined,
    @Headers('authorization') authHeader: string | undefined,
    @Query('from') from: string | undefined,
    @Query('to') to: string | undefined,
    @Res() res: Response,
  ) {
    // Set mandatory headers matching the dashboard contract
    res.set({
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    });

    const providedKey = dashboardKeyHeader || authHeader;
    if (!this.statsService.validateDashboardKey(providedKey)) {
      return res.status(HttpStatus.UNAUTHORIZED).json({
        ok: false,
        error: 'Unauthorized',
      });
    }

    try {
      const summary = await this.statsService.getSummary(from, to);
      return res.status(HttpStatus.OK).json(summary);
    } catch (err: any) {
      this.logger.error(`Error generating telco stats summary: ${err.message}`, err.stack);
      return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
        ok: false,
        error: 'Database error',
      });
    }
  }
}
