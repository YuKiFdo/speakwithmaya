import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SubscriptionReconciliationService } from './subscription-reconciliation.service.js';
import { ConfigService } from '@nestjs/config';
import { PayHereService } from './payhere.service.js';

describe('SubscriptionReconciliationService', () => {
  let service: SubscriptionReconciliationService;
  let mockPayHereService: Partial<PayHereService>;

  beforeEach(() => {
    const configService = {
      get: (key: string) => {
        if (key === 'SUPABASE_URL') return 'https://test.supabase.co';
        if (key === 'SUPABASE_SECRET_KEY') return 'test-key';
        return '';
      },
    } as unknown as ConfigService;

    mockPayHereService = {
      getSubscriptionPayments: vi.fn().mockResolvedValue([]),
    };

    service = new SubscriptionReconciliationService(
      configService,
      mockPayHereService as PayHereService,
    );
  });

  it('instantiates cleanly and defines reconciliation methods', () => {
    expect(service).toBeDefined();
    expect(typeof service.handleDailyReconciliation).toBe('function');
    expect(typeof service.reconcileSubscriptions).toBe('function');
  });
});
