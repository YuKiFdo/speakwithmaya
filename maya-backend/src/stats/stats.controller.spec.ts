import { Test, TestingModule } from '@nestjs/testing';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { HttpStatus } from '@nestjs/common';
import { StatsController } from './stats.controller.js';
import { StatsService } from './stats.service.js';

describe('StatsController', () => {
  let controller: StatsController;
  let statsService: StatsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [StatsController],
      providers: [
        {
          provide: StatsService,
          useValue: {
            validateDashboardKey: vi.fn(),
            getSummary: vi.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<StatsController>(StatsController);
    statsService = module.get<StatsService>(StatsService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should return 401 when key is invalid or missing', async () => {
    vi.spyOn(statsService, 'validateDashboardKey').mockReturnValue(false);

    const mockRes: any = {
      set: vi.fn(),
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    };

    await controller.getSummary('wrong-key', undefined, undefined, undefined, mockRes);

    expect(mockRes.set).toHaveBeenCalledWith({
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    });
    expect(mockRes.status).toHaveBeenCalledWith(HttpStatus.UNAUTHORIZED);
    expect(mockRes.json).toHaveBeenCalledWith({ ok: false, error: 'Unauthorized' });
  });

  it('should return 200 with summary when key is valid', async () => {
    const validKey = '2198b640e2f06fc6c94217c71417f600e90a9ae67a9e71f094fadbedf8283c95';
    vi.spyOn(statsService, 'validateDashboardKey').mockReturnValue(true);

    const mockSummary = {
      ok: true,
      generated: '2026-11-10T08:00:00.000Z',
      range: { from: '2026-11-01', to: '2026-11-10' },
      total: 400,
      today: 22,
      yesterday: 50,
      this_month: 384,
      last_month: 16,
      last_mtd: 0,
      monthly: { '2026-10': 16, '2026-11': 384 },
      daily: { '2026-11-10': 22 },
    };

    vi.spyOn(statsService, 'getSummary').mockResolvedValue(mockSummary);

    const mockRes: any = {
      set: vi.fn(),
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    };

    await controller.getSummary(validKey, undefined, '2026-11-01', '2026-11-10', mockRes);

    expect(mockRes.status).toHaveBeenCalledWith(HttpStatus.OK);
    expect(mockRes.json).toHaveBeenCalledWith(mockSummary);
  });
});

