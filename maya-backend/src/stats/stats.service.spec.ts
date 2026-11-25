import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { StatsService } from './stats.service.js';

describe('StatsService', () => {
  let service: StatsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StatsService,
        {
          provide: ConfigService,
          useValue: {
            get: (key: string) => {
              if (key === 'DASHBOARD_API_KEY') return 'test-dashboard-secret-key';
              if (key === 'SUPABASE_URL') return 'https://test.supabase.co';
              if (key === 'SUPABASE_SECRET_KEY') return 'test-secret';
              return null;
            },
          },
        },
      ],
    }).compile();

    service = module.get<StatsService>(StatsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('validateDashboardKey', () => {
    it('should reject missing or empty keys', () => {
      expect(service.validateDashboardKey()).toBe(false);
      expect(service.validateDashboardKey('')).toBe(false);
    });

    it('should reject incorrect keys', () => {
      expect(service.validateDashboardKey('wrong-key')).toBe(false);
    });

    it('should validate exact key', () => {
      expect(service.validateDashboardKey('test-dashboard-secret-key')).toBe(true);
    });

    it('should validate key with Bearer prefix', () => {
      expect(service.validateDashboardKey('Bearer test-dashboard-secret-key')).toBe(true);
    });
  });

  describe('getSummary logic and date computations', () => {
    it('should compute exact summary shape matching IDEACIPHER dashboard contract', async () => {
      // Mock internal getTelcoDailyCounts ({ day: subscribers })
      const mockCounts = {
        '2026-11-10': 1, // today
        '2026-11-09': 1, // yesterday
        '2026-11-01': 1, // this month
        '2026-10-15': 1, // last month
        '2026-10-05': 1, // last month (before MTD end)
      };

      vi.spyOn(service as any, 'getTelcoDailyCounts').mockResolvedValue(mockCounts);

      const res = await service.getSummary('2026-11-01', '2026-11-10');

      expect(res.ok).toBe(true);
      expect(typeof res.generated).toBe('string');
      expect(res.range).toEqual({ from: '2026-11-01', to: '2026-11-10' });
      expect(typeof res.total).toBe('number');
      expect(typeof res.today).toBe('number');
      expect(typeof res.yesterday).toBe('number');
      expect(typeof res.this_month).toBe('number');
      expect(typeof res.last_month).toBe('number');
      expect(typeof res.last_mtd).toBe('number');
      expect(typeof res.monthly).toBe('object');
      expect(typeof res.daily).toBe('object');
      expect(res.total).toBe(5);
    });

    it('weights each day by its subscriber count', async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-11-25T06:00:00Z')); // 2026-11-25 in Colombo
      try {
        vi.spyOn(service as any, 'getTelcoDailyCounts').mockResolvedValue({
          '2026-11-25': 77,
          '2026-11-24': 40,
          '2026-11-02': 3,
          '2026-10-20': 10,
          '2026-10-28': 5,
        });

        const res = await service.getSummary();

        expect(res.total).toBe(135);
        expect(res.today).toBe(77);
        expect(res.yesterday).toBe(40);
        expect(res.this_month).toBe(120);
        expect(res.last_month).toBe(15);
        expect(res.last_mtd).toBe(10);
        expect(res.monthly).toEqual({ '2026-10': 15, '2026-11': 120 });
        expect(res.daily).toEqual({ '2026-11-02': 3, '2026-11-24': 40, '2026-11-25': 77 });
      } finally {
        vi.useRealTimers();
      }
    });
  });
});
