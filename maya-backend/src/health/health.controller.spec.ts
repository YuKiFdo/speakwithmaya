import { describe, it, expect, beforeEach } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { HealthController } from './health.controller.js';
import { HealthService } from './health.service.js';

describe('HealthController', () => {
  let healthController: HealthController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [HealthService],
    }).compile();

    healthController = module.get<HealthController>(HealthController);
  });

  it('should return health status ok', () => {
    const result = healthController.check();
    expect(result.status).toBe('ok');
    expect(result.timestamp).toBeDefined();
    expect(typeof result.uptime).toBe('number');
    expect(result.environment).toBeDefined();
  });
});
