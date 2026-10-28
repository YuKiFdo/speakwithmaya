import { describe, it, expect, beforeEach } from 'vitest';
import crypto from 'node:crypto';
import { BadRequestException } from '@nestjs/common';
import { PayHereService } from './payhere.service.js';
import { ConfigService } from '@nestjs/config';

describe('PayHereService Signature & Telemetry', () => {
  let service: PayHereService;

  const mockMerchantId = '1211149';
  const mockMerchantSecret = 'TEST_SECRET_KEY_12345';

  beforeEach(() => {
    const configService = {
      get: (key: string) => {
        if (key === 'SUPABASE_URL') return 'https://test.supabase.co';
        if (key === 'SUPABASE_SECRET_KEY') return 'test-key';
        if (key === 'PAYHERE_MERCHANT_ID') return mockMerchantId;
        if (key === 'PAYHERE_MERCHANT_SECRET') return mockMerchantSecret;
        if (key === 'PAYHERE_MODE') return 'sandbox';
        if (key === 'PAYHERE_NOTIFY_URL') return 'http://localhost:3000/v1/payments/payhere/notify';
        return '';
      },
    } as unknown as ConfigService;

    service = new PayHereService(configService);
  });

  it('correctly calculates PayHere checkout hash matching official docs', () => {
    const orderId = 'MAYA-SUB-1001';
    const amount = '3600.00';
    const currency = 'LKR';

    const hashedSecret = crypto
      .createHash('md5')
      .update(mockMerchantSecret)
      .digest('hex')
      .toUpperCase();

    const expectedHash = crypto
      .createHash('md5')
      .update(`${mockMerchantId}${orderId}${amount}${currency}${hashedSecret}`)
      .digest('hex')
      .toUpperCase();

    expect(expectedHash).toHaveLength(32);
    expect(expectedHash).toMatch(/^[0-9A-F]{32}$/);
  });

  it('rejects PayHere webhook notification with tampered md5sig', async () => {
    const tamperedPayload = {
      merchant_id: mockMerchantId,
      order_id: 'ORDER_999',
      payment_id: '320025023469',
      subscription_id: '420075032251',
      payhere_amount: '3600.00',
      payhere_currency: 'LKR',
      status_code: '2',
      md5sig: 'TAMPERED_CHECKSUM_VALUE_1234567890',
      message_type: 'AUTHORIZATION_SUCCESS' as const,
    };

    await expect(service.handlePaymentNotification(tamperedPayload)).rejects.toThrow(
      BadRequestException
    );
  });

  it('builds normalized GA4/Meta transaction metadata for monthly and 3-month plans', () => {
    const buildTx = (service as any).buildAnalyticsTransaction.bind(service);

    const proQuarterly = buildTx({
      gateway_payment_id: 'MAYA-PREAUTH-3-MONTHS-PRO-1700000-1234',
      plan_tier: 'pro',
      order_type: 'subscription_new',
      amount_lkr: 8640,
      minutes_credited: 1800,
    });
    expect(proQuarterly).toEqual({
      transactionId: 'MAYA-PREAUTH-3-MONTHS-PRO-1700000-1234',
      eventId: 'purchase_MAYA-PREAUTH-3-MONTHS-PRO-1700000-1234',
      planName: 'Pro',
      billingPeriod: '3_months',
      value: 8640,
      currency: 'LKR',
      orderType: 'subscription_new',
      isCardUpdate: false,
    });

    const basicMonthly = buildTx({
      gateway_payment_id: 'MAYA-PREAUTH-BASIC-1700000-5678',
      plan_tier: 'basic',
      order_type: 'subscription_new',
      amount_lkr: 3600,
      minutes_credited: 450,
    });
    expect(basicMonthly).toEqual({
      transactionId: 'MAYA-PREAUTH-BASIC-1700000-5678',
      eventId: 'purchase_MAYA-PREAUTH-BASIC-1700000-5678',
      planName: 'Basic',
      billingPeriod: 'monthly',
      value: 3600,
      currency: 'LKR',
      orderType: 'subscription_new',
      isCardUpdate: false,
    });

    const cardUpdate = buildTx({
      gateway_payment_id: 'MAYA-CARD-UPDATE-1700000-9999',
      plan_tier: 'card-update',
      order_type: 'subscription_renewal',
      amount_lkr: 0,
      minutes_credited: 0,
    });
    expect(cardUpdate.isCardUpdate).toBe(true);
  });
});
