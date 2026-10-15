import {
  Injectable,
  Logger,
  BadRequestException,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import crypto from 'node:crypto';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import {
  PayHereCheckoutParams,
  PayHereWebhookPayload,
  PayHereOAuthTokenResponse,
  PayHereSubscriptionItem,
  PayHereSubscriptionPaymentItem,
} from './payhere.types.js';
import { GenerateCheckoutParamsDto, ChargeSavedCardDto } from './dto/payhere.dto.js';

@Injectable()
export class PayHereService {
  private readonly logger = new Logger(PayHereService.name);
  private readonly supabase: SupabaseClient;

  private readonly merchantId: string;
  private readonly merchantSecret: string;
  private readonly appId: string;
  private readonly appSecret: string;
  private readonly isSandbox: boolean;
  private readonly notifyUrl: string;

  private cachedToken: { token: string; expiresAt: number } | null = null;

  constructor(private readonly config: ConfigService) {
    const supabaseUrl =
      this.config.get<string>('SUPABASE_URL') ||
      process.env.SUPABASE_URL ||
      'https://placeholder.supabase.co';
    const supabaseKey =
      this.config.get<string>('SUPABASE_SECRET_KEY') ||
      this.config.get<string>('SUPABASE_SERVICE_ROLE_KEY') ||
      process.env.SUPABASE_SECRET_KEY ||
      process.env.SUPABASE_SERVICE_ROLE_KEY ||
      'placeholder-key';
    this.supabase = createClient(supabaseUrl, supabaseKey);

    this.merchantId = this.config.get<string>('PAYHERE_MERCHANT_ID') || '1226477';
    this.merchantSecret = this.config.get<string>('PAYHERE_MERCHANT_SECRET') || '';
    this.appId = this.config.get<string>('PAYHERE_APP_ID') || '';
    this.appSecret = this.config.get<string>('PAYHERE_APP_SECRET') || '';
    this.isSandbox =
      (this.config.get<string>('PAYHERE_MODE') || 'sandbox').toLowerCase() === 'sandbox';
    this.notifyUrl =
      this.config.get<string>('PAYHERE_NOTIFY_URL') ||
      'http://localhost:3000/v1/payments/payhere/notify';
  }

  private getBaseUrl(): string {
    return this.isSandbox
      ? 'https://sandbox.payhere.lk'
      : 'https://www.payhere.lk';
  }

  /**
   * Generates server-signed checkout parameters for the frontend client.
   * Merchant secret is protected on backend; client receives pre-computed hash.
   */
  async generateCheckoutParams(
    userId: string,
    dto: GenerateCheckoutParamsDto
  ): Promise<PayHereCheckoutParams> {
    const planConfigs: Record<string, {
      name: string;
      tier: string;
      amount: number;
      recurrence?: string;
      duration?: string;
      allowance: number;
      isTopup?: boolean;
    }> = {
      '3-months-pro': {
        name: 'Maya AI Pro (3 Months)',
        tier: 'pro',
        amount: 8640.0,
        recurrence: '3 Month',
        duration: 'Forever',
        allowance: 600,
      },
      basic: {
        name: 'Maya AI Basic Monthly',
        tier: 'basic',
        amount: 2700.0,
        recurrence: '1 Month',
        duration: 'Forever',
        allowance: 450,
      },
      pro: {
        name: 'Maya AI Pro Monthly',
        tier: 'pro',
        amount: 3600.0,
        recurrence: '1 Month',
        duration: 'Forever',
        allowance: 600,
      },
      premium: {
        name: 'Maya AI Premium Monthly',
        tier: 'premium',
        amount: 7200.0,
        recurrence: '1 Month',
        duration: 'Forever',
        allowance: 1200,
      },
      '30-min': {
        name: 'Maya AI Extra Talk Time (+30 Min)',
        tier: 'topup',
        amount: 300.0,
        allowance: 30,
        isTopup: true,
      },
      '120-min': {
        name: 'Maya AI Extra Talk Time (+120 Min)',
        tier: 'topup',
        amount: 900.0,
        allowance: 120,
        isTopup: true,
      },
      '300-min': {
        name: 'Maya AI Extra Talk Time (+300 Min)',
        tier: 'topup',
        amount: 2000.0,
        allowance: 300,
        isTopup: true,
      },
    };

    const plan = planConfigs[dto.planTier];
    if (!plan) {
      throw new BadRequestException(`Invalid plan tier: ${dto.planTier}`);
    }

    // Fetch user profile from Supabase
    const { data: profile } = await this.supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();

    const orderId = plan.isTopup
      ? `MAYA-TOPUP-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`
      : `MAYA-SUB-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;
    const formattedAmount = plan.amount.toFixed(2);
    const currency = 'LKR';

    // MD5 Signature per PayHere specification:
    // hash = strtoupper(md5(merchant_id + order_id + amount + currency + strtoupper(md5(merchant_secret))))
    const hashedSecret = crypto
      .createHash('md5')
      .update(this.merchantSecret)
      .digest('hex')
      .toUpperCase();

    const hashString = `${this.merchantId}${orderId}${formattedAmount}${currency}${hashedSecret}`;
    const hash = crypto
      .createHash('md5')
      .update(hashString)
      .digest('hex')
      .toUpperCase();

    // Record pending order transaction
    await this.supabase.from('orders').insert({
      user_id: userId,
      order_type: plan.isTopup ? 'topup_minutes' : 'subscription_new',
      plan_tier: plan.tier,
      amount_lkr: plan.amount,
      minutes_credited: plan.allowance,
      payment_gateway: 'payhere',
      gateway_payment_id: orderId,
      status: 'pending',
    });

    const userFullName = (profile?.display_name || 'Learner').trim();
    const nameParts = userFullName.split(' ');
    const firstName = nameParts[0] || 'Learner';
    const lastName = nameParts.slice(1).join(' ') || 'User';

    return {
      sandbox: this.isSandbox,
      merchant_id: this.merchantId,
      return_url: dto.returnUrl || '',
      cancel_url: dto.cancelUrl || '',
      notify_url: this.notifyUrl,
      order_id: orderId,
      items: plan.name,
      currency,
      amount: formattedAmount,
      ...(plan.recurrence ? { recurrence: plan.recurrence } : {}),
      ...(plan.duration ? { duration: plan.duration } : {}),
      hash,
      first_name: firstName,
      last_name: lastName,
      email: profile?.email || `${userId.slice(0, 8)}@talkwithmaya.com`,
      phone: profile?.phone_number || '+94770000000',
      address: 'Sri Lanka',
      city: 'Colombo',
      country: 'Sri Lanka',
      custom_1: userId,
      custom_2: dto.planTier,
    };
  }

  /**
   * Helper to describe PayHere status codes in human-readable terms for logs.
   */
  private describeStatusCode(code: string | number): string {
    const c = String(code);
    switch (c) {
      case '2':
        return 'SUCCESS (Payment or authorization completed)';
      case '0':
        return 'PENDING (Payment is being processed by gateway)';
      case '-1':
        return 'CANCELED (Payment or checkout was canceled)';
      case '-2':
        return 'FAILED (Card declined, insufficient funds, or error)';
      case '-3':
        return 'CHARGEDBACK (Payment charged back by cardholder)';
      default:
        return `UNKNOWN (${c})`;
    }
  }

  /**
   * Processes server-to-server webhook notification callback from PayHere (notify_url).
   */
  async handlePaymentNotification(payload: PayHereWebhookPayload): Promise<{ received: boolean; status?: string; error?: string }> {
    this.logger.log(`================================================================`);
    this.logger.log(`[PayHereWebhook] 💳 INCOMING WEBHOOK NOTIFICATION RECEIVED`);
    this.logger.log(`----------------------------------------------------------------`);
    this.logger.log(`[PayHereWebhook] • Order ID:           ${payload.order_id}`);
    this.logger.log(`[PayHereWebhook] • Payment ID:         ${payload.payment_id}`);
    this.logger.log(`[PayHereWebhook] • Subscription ID:    ${payload.subscription_id || 'N/A'}`);
    this.logger.log(`[PayHereWebhook] • Merchant ID:        ${payload.merchant_id}`);
    this.logger.log(`[PayHereWebhook] • Amount & Currency:  ${payload.payhere_currency} ${payload.payhere_amount}`);
    this.logger.log(`[PayHereWebhook] • Status Code:        ${payload.status_code} [${this.describeStatusCode(payload.status_code)}]`);
    this.logger.log(`[PayHereWebhook] • Status Message:     ${payload.status_message || 'N/A'}`);
    this.logger.log(`[PayHereWebhook] • Message Type:       ${payload.message_type || 'N/A (Standard Single Payment)'}`);
    this.logger.log(`[PayHereWebhook] • Payment Method:     ${payload.method || 'N/A'}`);
    this.logger.log(`[PayHereWebhook] • Card Masked:        ${payload.card_no || 'N/A'}`);
    this.logger.log(`[PayHereWebhook] • Card Holder:        ${payload.card_holder_name || 'N/A'}`);
    this.logger.log(`[PayHereWebhook] • Card Expiry:        ${payload.card_expiry || 'N/A'}`);
    this.logger.log(`[PayHereWebhook] • Recurrence:         ${payload.item_recurrence || 'N/A'}`);
    this.logger.log(`[PayHereWebhook] • Next Billing Date:  ${payload.item_rec_date_next || 'N/A'}`);
    this.logger.log(`[PayHereWebhook] • Custom 1 (User ID): ${payload.custom_1 || 'N/A'}`);
    this.logger.log(`[PayHereWebhook] • Custom 2 (Tier):    ${payload.custom_2 || 'N/A'}`);
    this.logger.log(`[PayHereWebhook] • MD5 Signature:      ${payload.md5sig}`);
    this.logger.log(`----------------------------------------------------------------`);

    // 1. Verify md5sig
    const hashedSecret = crypto
      .createHash('md5')
      .update(this.merchantSecret)
      .digest('hex')
      .toUpperCase();

    const checkString = `${payload.merchant_id}${payload.order_id}${payload.payhere_amount}${payload.payhere_currency}${payload.status_code}${hashedSecret}`;
    const localMd5sig = crypto
      .createHash('md5')
      .update(checkString)
      .digest('hex')
      .toUpperCase();

    const isMatch = localMd5sig === (payload.md5sig || '').toUpperCase();
    this.logger.log(`[PayHereWebhook] 🔐 Signature verification:`);
    this.logger.log(`[PayHereWebhook]    Calculated Signature: ${localMd5sig}`);
    this.logger.log(`[PayHereWebhook]    Received Signature:   ${payload.md5sig?.toUpperCase()}`);
    this.logger.log(`[PayHereWebhook]    Verification Status:  ${isMatch ? '✅ MATCH - Authenticity Verified' : '❌ MISMATCH - Verification FAILED'}`);

    if (!isMatch) {
      this.logger.error(
        `[PayHereWebhook] 🚨 Checksum mismatch! Check string was: ${payload.merchant_id}${payload.order_id}${payload.payhere_amount}${payload.payhere_currency}${payload.status_code}[HASHED_SECRET]`
      );
      throw new BadRequestException('Invalid checksum signature');
    }

    const statusCode = parseInt(payload.status_code, 10);
    const messageType = payload.message_type;

    // Resolve user ID
    this.logger.log(`[PayHereWebhook] 👤 Resolving user account for order ${payload.order_id}...`);
    let userId = payload.custom_1;
    if (!userId) {
      this.logger.log(`[PayHereWebhook] custom_1 missing; querying orders table by gateway_payment_id=${payload.order_id}...`);
      const { data: order, error: orderLookupErr } = await this.supabase
        .from('orders')
        .select('user_id')
        .eq('gateway_payment_id', payload.order_id)
        .maybeSingle();
      if (orderLookupErr) {
        this.logger.warn(`[PayHereWebhook] Orders lookup error: ${orderLookupErr.message}`);
      }
      userId = order?.user_id;
    }

    if (!userId) {
      this.logger.warn(`[PayHereWebhook] ⚠️ Could not resolve user_id for order ${payload.order_id}. Acknowledging webhook to avoid PayHere retries.`);
      return { received: true, error: 'User could not be resolved' };
    }
    this.logger.log(`[PayHereWebhook] ✅ User resolved: ${userId}`);

    const planTierKey = payload.custom_2 || 'pro';
    const isTopup = ['30-min', '120-min', '300-min'].includes(planTierKey) || payload.order_id?.startsWith('MAYA-TOPUP');

    if (isTopup) {
      this.logger.log(`[PayHereWebhook] ⚡ Processing Extra Talk Time Top-up payment: order=${payload.order_id}, tier=${planTierKey}`);
      if (statusCode === 2) {
        const topupAllowance = planTierKey === '300-min' ? 300 : planTierKey === '120-min' ? 120 : 30;

        // Fetch current user balance
        const { data: userProfile } = await this.supabase
          .from('profiles')
          .select('minutes_balance')
          .eq('id', userId)
          .maybeSingle();

        const currentBalance = userProfile?.minutes_balance ?? 0;
        const newBalance = currentBalance + topupAllowance;

        const { error: profileErr } = await this.supabase
          .from('profiles')
          .update({
            minutes_balance: newBalance,
            updated_at: new Date().toISOString(),
          })
          .eq('id', userId);

        if (profileErr) {
          this.logger.error(`[PayHereWebhook] ❌ Error crediting top-up minutes to profile: ${profileErr.message}`);
        } else {
          this.logger.log(`[PayHereWebhook] ⏱️ Credited +${topupAllowance}m to user ${userId} (new balance: ${newBalance}m)`);
        }

        // Update Order
        await this.supabase
          .from('orders')
          .update({
            status: 'completed',
            payhere_payment_id: payload.payment_id,
            md5sig: payload.md5sig,
            raw_payload: payload,
          })
          .eq('gateway_payment_id', payload.order_id);

        return { received: true, status: 'TOPUP_COMPLETED' };
      } else {
        this.logger.warn(`[PayHereWebhook] Topup payment failed or cancelled with status=${statusCode}`);
        return { received: true, status: 'TOPUP_FAILED' };
      }
    }

    const planTier = planTierKey === '3-months-pro' ? 'pro' : planTierKey;
    const minutesAllowance =
      planTier === 'basic' ? 450 : planTier === 'premium' ? 1200 : 600;

    this.logger.log(`[PayHereWebhook] 📦 Subscription Plan: tier=${planTier}, minutes_allowance=${minutesAllowance} min/mo`);

    // 2. Handle Success Events
    if (statusCode === 2) {
      if (messageType === 'AUTHORIZATION_SUCCESS' || !messageType) {
        const parsedNext = payload.item_rec_date_next
          ? new Date(payload.item_rec_date_next).getTime()
          : 0;
        const nextBillingDate =
          payload.item_rec_date_next && parsedNext > Date.now()
            ? payload.item_rec_date_next
            : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

        // Upsert Subscriptions Table
        const { data: subData, error: subError } = await this.supabase
          .from('subscriptions')
          .upsert(
            {
              user_id: userId,
              payhere_subscription_id: payload.subscription_id,
              customer_token: payload.customer_token || null,
              plan_tier: planTier,
              billing_cycle: payload.item_recurrence || '1 Month',
              amount_lkr: parseFloat(payload.payhere_amount),
              status: 'ACTIVE',
              next_billing_date: nextBillingDate,
              installments_paid: 1,
              card_holder_name: payload.card_holder_name,
              card_masked: payload.card_no,
              card_expiry: payload.card_expiry,
              payment_method: payload.method,
              last_payment_id: payload.payment_id,
              updated_at: new Date().toISOString(),
            },
            { onConflict: 'payhere_subscription_id' }
          )
          .select()
          .single();

        if (subError) {
          this.logger.error(`[PayHereWebhook] ❌ Error saving subscription record: ${subError.message}`);
        } else {
          this.logger.log(`[PayHereWebhook] 💾 Upserted subscription row in public.subscriptions: id=${subData?.id}, status=ACTIVE`);
        }

        // Update User Profile Quotas & Plan Tier
        const { error: profileErr } = await this.supabase
          .from('profiles')
          .update({
            plan_tier: planTier,
            plan_status: 'active',
            billing_cycle: payload.item_recurrence?.includes('3') ? 'quarterly' : 'monthly',
            monthly_minutes_allowance: minutesAllowance,
            minutes_balance: minutesAllowance,
            minutes_reset_at: new Date(nextBillingDate).toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('id', userId);

        if (profileErr) {
          this.logger.error(`[PayHereWebhook] ❌ Error updating user profile: ${profileErr.message}`);
        } else {
          this.logger.log(`[PayHereWebhook] 👤 Updated user profile ${userId}: tier=${planTier}, balance=${minutesAllowance}m, reset_at=${nextBillingDate}`);
        }

        // Update Order
        const { error: orderErr } = await this.supabase
          .from('orders')
          .update({
            status: 'completed',
            subscription_id: subData?.id,
            payhere_payment_id: payload.payment_id,
            payhere_subscription_id: payload.subscription_id,
            md5sig: payload.md5sig,
            raw_payload: payload,
          })
          .eq('gateway_payment_id', payload.order_id);

        if (orderErr) {
          this.logger.warn(`[PayHereWebhook] Note on orders update: ${orderErr.message}`);
        } else {
          this.logger.log(`[PayHereWebhook] 📝 Updated order ${payload.order_id} to completed`);
        }

        this.logger.log(`[PayHereWebhook] 🎉 Initial subscription lifecycle completed successfully for user ${userId}!`);
        this.logger.log(`================================================================`);
      } else if (messageType === 'RECURRING_INSTALLMENT_SUCCESS') {
        this.logger.log(`[PayHereWebhook] 🔄 Processing RECURRING INSTALLMENT RENEWAL for subscription ${payload.subscription_id}...`);
        const { data: sub, error: subFetchErr } = await this.supabase
          .from('subscriptions')
          .select('*')
          .eq('payhere_subscription_id', payload.subscription_id)
          .maybeSingle();

        if (subFetchErr) {
          this.logger.warn(`[PayHereWebhook] Subscription query error: ${subFetchErr.message}`);
        }

        const newInstallments = (sub?.installments_paid || 0) + 1;
        const parsedNextRenewal = payload.item_rec_date_next
          ? new Date(payload.item_rec_date_next).getTime()
          : 0;
        const nextBillingDate =
          payload.item_rec_date_next && parsedNextRenewal > Date.now()
            ? payload.item_rec_date_next
            : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

        if (sub) {
          const { error: subUpdateErr } = await this.supabase
            .from('subscriptions')
            .update({
              status: 'ACTIVE',
              installments_paid: newInstallments,
              next_billing_date: nextBillingDate,
              last_payment_id: payload.payment_id,
              updated_at: new Date().toISOString(),
            })
            .eq('id', sub.id);

          if (subUpdateErr) {
            this.logger.error(`[PayHereWebhook] ❌ Error updating subscription: ${subUpdateErr.message}`);
          } else {
            this.logger.log(`[PayHereWebhook] 💾 Updated subscription: installments_paid=${newInstallments}, next_billing=${nextBillingDate}`);
          }
        }

        // Reset user's monthly practice minutes allowance
        const { error: profResetErr } = await this.supabase
          .from('profiles')
          .update({
            plan_status: 'active',
            minutes_balance: minutesAllowance,
            minutes_reset_at: new Date(nextBillingDate).toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('id', userId);

        if (profResetErr) {
          this.logger.error(`[PayHereWebhook] ❌ Error updating profile: ${profResetErr.message}`);
        } else {
          this.logger.log(`[PayHereWebhook] ⏱️ Refreshed practice balance (+${minutesAllowance}m) for user ${userId}`);
        }

        // Record renewal order
        const { error: renewalOrderErr } = await this.supabase.from('orders').insert({
          user_id: userId,
          subscription_id: sub?.id,
          order_type: 'subscription_renewal',
          plan_tier: planTier,
          amount_lkr: parseFloat(payload.payhere_amount),
          minutes_credited: minutesAllowance,
          payment_gateway: 'payhere',
          payhere_payment_id: payload.payment_id,
          payhere_subscription_id: payload.subscription_id,
          md5sig: payload.md5sig,
          raw_payload: payload,
          status: 'completed',
        });

        if (renewalOrderErr) {
          this.logger.warn(`[PayHereWebhook] Note on renewal order insertion: ${renewalOrderErr.message}`);
        } else {
          this.logger.log(`[PayHereWebhook] 📝 Created renewal order entry in orders table`);
        }

        this.logger.log(`[PayHereWebhook] 🎉 Recurring installment renewal completed successfully for user ${userId}!`);
        this.logger.log(`================================================================`);
      }
    } else if (statusCode === -2) {
      if (messageType === 'RECURRING_STOPPED') {
        this.logger.warn(`[PayHereWebhook] 🛑 Subscription TERMINATED / STOPPED by PayHere: subscription_id=${payload.subscription_id}, user=${userId}`);
        await this.supabase
          .from('subscriptions')
          .update({
            status: 'CANCELLED',
            cancelled_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('payhere_subscription_id', payload.subscription_id);

        await this.supabase
          .from('profiles')
          .update({ plan_status: 'canceled', updated_at: new Date().toISOString() })
          .eq('id', userId);

        this.logger.log(`[PayHereWebhook] 💾 Marked subscription CANCELLED in DB for user ${userId}`);
      } else {
        this.logger.warn(`[PayHereWebhook] ⚠️ Installment payment FAILED: subscription_id=${payload.subscription_id}, user=${userId}. PayHere will retry daily up to 7 days.`);
        await this.supabase
          .from('subscriptions')
          .update({ status: 'PAST_DUE', updated_at: new Date().toISOString() })
          .eq('payhere_subscription_id', payload.subscription_id);

        await this.supabase
          .from('profiles')
          .update({ plan_status: 'past_due', updated_at: new Date().toISOString() })
          .eq('id', userId);

        this.logger.log(`[PayHereWebhook] 💾 Marked subscription PAST_DUE in DB for user ${userId}`);
      }
      this.logger.log(`================================================================`);
    } else if (statusCode === -1) {
      this.logger.warn(`[PayHereWebhook] ❌ Transaction CANCELED by user or gateway for order ${payload.order_id}`);
      this.logger.log(`================================================================`);
    } else if (statusCode === 0) {
      this.logger.log(`[PayHereWebhook] ⏳ Payment status is PENDING for order ${payload.order_id}`);
      this.logger.log(`================================================================`);
    } else if (statusCode === -3) {
      this.logger.warn(`[PayHereWebhook] 🚨 Payment CHARGEDBACK for order ${payload.order_id}`);
      this.logger.log(`================================================================`);
    }

    return { received: true, status: 'processed' };
  }

  /**
   * Retrieves OAuth2 Access Token for Subscription Manager API.
   */
  private async getOAuthAccessToken(): Promise<string> {
    if (this.cachedToken && Date.now() < this.cachedToken.expiresAt) {
      return this.cachedToken.token;
    }

    if (!this.appId || !this.appSecret) {
      this.logger.warn('PAYHERE_APP_ID or PAYHERE_APP_SECRET is not configured.');
      throw new BadRequestException('PayHere Subscription Manager API credentials missing.');
    }

    const authCode = Buffer.from(`${this.appId}:${this.appSecret}`).toString('base64');
    const tokenUrl = `${this.getBaseUrl()}/merchant/v1/oauth/token`;

    try {
      const response = await fetch(tokenUrl, {
        method: 'POST',
        headers: {
          Authorization: `Basic ${authCode}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: 'grant_type=client_credentials',
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`OAuth error HTTP ${response.status}: ${errorText}`);
      }

      const data = (await response.json()) as PayHereOAuthTokenResponse;
      // Expire 30s before official expiration
      const expiresAt = Date.now() + (data.expires_in - 30) * 1000;
      this.cachedToken = { token: data.access_token, expiresAt };
      return data.access_token;
    } catch (err: any) {
      this.logger.error(`Failed to retrieve PayHere OAuth token: ${err.message}`);
      throw new InternalServerErrorException('PayHere authentication error');
    }
  }

  /**
   * Fetches all subscriptions from PayHere Subscription Manager API.
   */
  async getAllPayHereSubscriptions(): Promise<PayHereSubscriptionItem[]> {
    const token = await this.getOAuthAccessToken();
    const url = `${this.getBaseUrl()}/merchant/v1/subscription`;

    const res = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!res.ok) {
      throw new InternalServerErrorException(`PayHere API error: ${res.statusText}`);
    }

    const result = await res.json();
    return result.data || [];
  }

  /**
   * Fetches payment history for a specific subscription.
   */
  async getSubscriptionPayments(
    subscriptionId: string
  ): Promise<PayHereSubscriptionPaymentItem[]> {
    const token = await this.getOAuthAccessToken();
    const url = `${this.getBaseUrl()}/merchant/v1/subscription/${subscriptionId}/payments`;

    const res = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!res.ok) {
      throw new InternalServerErrorException(`PayHere API error: ${res.statusText}`);
    }

    const result = await res.json();
    return result.data || [];
  }

  /**
   * Retries a failed subscription charge via PayHere API.
   */
  async retrySubscription(subscriptionId: string): Promise<{ success: boolean; msg: string }> {
    const token = await this.getOAuthAccessToken();
    const url = `${this.getBaseUrl()}/merchant/v1/subscription/retry`;

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ subscription_id: subscriptionId }),
    });

    const result = await res.json();
    if (result.status !== 1) {
      throw new BadRequestException(result.msg || 'Subscription retry failed');
    }

    return { success: true, msg: result.msg || 'Payment charged successfully' };
  }

  /**
   * Cancels a subscription programmatically via PayHere API and marks DB status as CANCELLED.
   */
  async cancelSubscription(
    subscriptionId: string,
    userId?: string
  ): Promise<{ success: boolean; msg: string }> {
    const token = await this.getOAuthAccessToken();
    const url = `${this.getBaseUrl()}/merchant/v1/subscription/cancel`;

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ subscription_id: subscriptionId }),
    });

    const result = await res.json();
    if (result.status !== 1 && !result.msg?.includes('already cancelled')) {
      throw new BadRequestException(result.msg || 'Subscription cancellation failed');
    }

    // Update local database
    await this.supabase
      .from('subscriptions')
      .update({
        status: 'CANCELLED',
        cancelled_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('payhere_subscription_id', subscriptionId);

    if (userId) {
      await this.supabase
        .from('profiles')
        .update({
          plan_status: 'canceled',
          updated_at: new Date().toISOString(),
        })
        .eq('id', userId);
    }

    return { success: true, msg: result.msg || 'Successfully cancelled subscription' };
  }

  /**
   * Retrieves user's active subscription from local database.
   */
  async getUserActiveSubscription(userId: string) {
    const { data, error } = await this.supabase
      .from('subscriptions')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      this.logger.error(`Error querying user subscription: ${error.message}`);
    }

    if (!data) return null;

    const hasCustomerToken = Boolean(data.customer_token && String(data.customer_token).trim().length > 0);

    return {
      ...data,
      has_saved_card: Boolean(data.card_masked),
      can_auto_charge: hasCustomerToken,
      customer_token: data.customer_token || null,
    };
  }

  /**
   * Automated Charging: Programmatically charges a customer's pre-approved saved card on demand.
   * Can be used for extra talk-time packages (+30 min, +120 min, +300 min) or plan upgrades without re-entering card.
   */
  async chargeSavedCard(userId: string, dto: ChargeSavedCardDto) {
    this.logger.log(`[PayHereAutoCharge] ⚡ Request to charge saved card for user ${userId}: ${JSON.stringify(dto)}`);

    // 1. Fetch user's active or recent subscription record
    const { data: sub, error: subErr } = await this.supabase
      .from('subscriptions')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (subErr) {
      this.logger.error(`[PayHereAutoCharge] Error looking up user subscription: ${subErr.message}`);
    }

    if (!sub || !sub.customer_token || !String(sub.customer_token).trim()) {
      throw new BadRequestException(
        'No pre-approved card token found on file for 1-click charging. Please complete payment via standard PayHere checkout.'
      );
    }

    const cardMasked = sub.card_masked || '···· Card';
    const customerToken = String(sub.customer_token).trim();

    // 2. Resolve price, allowance, item details
    let amount = 0;
    let allowance = 0;
    let itemName = '';
    let isTopup = false;

    if (dto.packageId) {
      isTopup = true;
      if (dto.packageId === '30-min') {
        amount = 300;
        allowance = 30;
        itemName = '+30 Minutes Extra Talk Time';
      } else if (dto.packageId === '120-min') {
        amount = 900;
        allowance = 120;
        itemName = '+120 Minutes Extra Talk Time';
      } else if (dto.packageId === '300-min') {
        amount = 2000;
        allowance = 300;
        itemName = '+300 Minutes Extra Talk Time';
      } else {
        throw new BadRequestException(`Invalid package ID: ${dto.packageId}`);
      }
    } else if (dto.planTier) {
      isTopup = false;
      if (dto.planTier === 'basic') {
        amount = 750;
        allowance = 60;
        itemName = 'Maya Basic Plan (Monthly)';
      } else if (dto.planTier === 'pro') {
        amount = 1500;
        allowance = 150;
        itemName = 'Maya Pro Plan (Monthly)';
      } else if (dto.planTier === 'premium') {
        amount = 3500;
        allowance = 300;
        itemName = 'Maya Premium Plan (Monthly)';
      } else {
        throw new BadRequestException(`Invalid plan tier: ${dto.planTier}`);
      }
    } else {
      throw new BadRequestException('Either packageId or planTier must be specified.');
    }

    const orderId = isTopup
      ? `MAYA-TOPUP-AUTO-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`
      : `MAYA-SUB-AUTO-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;

    // 3. Trigger PayHere Automated Charging API
    if (!this.appId || !this.appSecret) {
      throw new BadRequestException('PayHere Automated Charging credentials are not configured on the server.');
    }

    const accessToken = await this.getOAuthAccessToken();
    const chargeUrl = `${this.getBaseUrl()}/merchant/v1/payment/charge`;
    this.logger.log(`[PayHereAutoCharge] Calling PayHere Charging API: ${chargeUrl} for order ${orderId}, amount=${amount} LKR...`);

    let chargeData: any;
    try {
      const chargeResponse = await fetch(chargeUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: 'PAYMENT',
          order_id: orderId,
          items: itemName,
          currency: 'LKR',
          amount: amount,
          customer_token: customerToken,
          custom_1: userId,
          custom_2: dto.packageId || dto.planTier,
          notify_url: this.notifyUrl,
        }),
      });

      chargeData = await chargeResponse.json();
      this.logger.log(`[PayHereAutoCharge] Gateway response: ${JSON.stringify(chargeData)}`);
    } catch (gatewayErr: any) {
      this.logger.error(`[PayHereAutoCharge] Network error calling PayHere Charging API: ${gatewayErr.message}`);
      throw new InternalServerErrorException(`Payment gateway connection failed: ${gatewayErr.message}`);
    }

    if (!chargeData || chargeData.status !== 1) {
      const errorMsg = chargeData?.msg || 'Card charge declined by payment gateway';
      this.logger.error(`[PayHereAutoCharge] Charge failed for order ${orderId}: ${errorMsg}`);

      // Record failed transaction in orders table for audit trail
      await this.supabase.from('orders').insert({
        user_id: userId,
        order_type: isTopup ? 'topup_minutes' : 'subscription_upgrade',
        plan_tier: dto.planTier || sub.plan_tier,
        amount_lkr: amount,
        minutes_credited: 0,
        payment_gateway: 'payhere_token',
        gateway_payment_id: orderId,
        status: 'failed',
        raw_payload: chargeData,
      });

      throw new BadRequestException(`Payment failed: ${errorMsg}`);
    }

    // 4. Update Database: Credit minutes or activate plan
    let newBalance = 0;
    if (isTopup) {
      const { data: userProfile } = await this.supabase
        .from('profiles')
        .select('minutes_balance')
        .eq('id', userId)
        .maybeSingle();

      const currentBalance = userProfile?.minutes_balance ?? 0;
      newBalance = currentBalance + allowance;

      await this.supabase
        .from('profiles')
        .update({
          minutes_balance: newBalance,
          updated_at: new Date().toISOString(),
        })
        .eq('id', userId);

      this.logger.log(`[PayHereAutoCharge] ⏱️ Credited +${allowance}m top-up to user ${userId}. New balance: ${newBalance}m`);
    } else {
      const nextMonth = new Date();
      nextMonth.setDate(nextMonth.getDate() + 30);
      newBalance = allowance;

      await this.supabase
        .from('profiles')
        .update({
          plan_tier: dto.planTier,
          plan_status: 'active',
          monthly_minutes_allowance: allowance,
          minutes_balance: allowance,
          minutes_reset_at: nextMonth.toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', userId);

      await this.supabase
        .from('subscriptions')
        .update({
          plan_tier: dto.planTier,
          amount_lkr: amount,
          status: 'ACTIVE',
          next_billing_date: nextMonth.toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', sub.id);

      this.logger.log(`[PayHereAutoCharge] 👑 Upgraded user ${userId} to ${dto.planTier}. Monthly balance reset to ${allowance}m.`);
    }

    // 5. Record order entry
    await this.supabase.from('orders').insert({
      user_id: userId,
      order_type: isTopup ? 'topup_minutes' : 'subscription_upgrade',
      plan_tier: dto.planTier || sub.plan_tier,
      amount_lkr: amount,
      minutes_credited: allowance,
      payment_gateway: 'payhere_token',
      gateway_payment_id: orderId,
      status: 'completed',
    });

    return {
      success: true,
      message: isTopup
        ? `Successfully charged Rs. ${amount.toLocaleString()} to your card (${cardMasked}). +${allowance} minutes added!`
        : `Successfully upgraded to ${dto.planTier?.toUpperCase()} Plan! Rs. ${amount.toLocaleString()} charged to your card (${cardMasked}).`,
      orderId,
      newBalance,
      planTier: dto.planTier || sub.plan_tier,
      cardMasked,
    };
  }

  /**
   * Admin: Queries all subscribers from database with profile metadata and calculates overview metrics.
   */
  async getAdminSubscriptions() {
    const { data: subs, error } = await this.supabase
      .from('subscriptions')
      .select(`
        *,
        profile:profiles(id, display_name, phone_number, minutes_balance, level)
      `)
      .order('created_at', { ascending: false });

    if (error) {
      this.logger.error(`Admin subscriptions query failed: ${error.message}`);
      throw new InternalServerErrorException('Database query failed');
    }

    const items = subs || [];
    const activeSubs = items.filter((s) => s.status === 'ACTIVE');
    const pastDueSubs = items.filter((s) => s.status === 'PAST_DUE');
    const cancelledSubs = items.filter((s) => s.status === 'CANCELLED');

    const totalMRR = activeSubs.reduce((acc, curr) => {
      const amount = parseFloat(curr.amount_lkr || 0);
      return curr.billing_cycle === '3 Month' ? acc + amount / 3 : acc + amount;
    }, 0);

    return {
      stats: {
        totalSubscribers: items.length,
        activeCount: activeSubs.length,
        pastDueCount: pastDueSubs.length,
        cancelledCount: cancelledSubs.length,
        mrrLkr: Math.round(totalMRR),
      },
      subscriptions: items,
    };
  }
}
