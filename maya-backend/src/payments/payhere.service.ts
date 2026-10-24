import {
  Injectable,
  Logger,
  BadRequestException,
  InternalServerErrorException,
  Optional,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import crypto from 'node:crypto';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { TelcoSubscriptionService } from '../auth/sms/telco-subscription.service.js';
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

  constructor(
    private readonly config: ConfigService,
    @Optional() private readonly telcoService?: TelcoSubscriptionService,
  ) {
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
   * Automatically cancels existing mobile carrier billing (IdeaMart / mSpace)
   * when a user on Starter/Telco upgrades to a paid plan (Pro/Premium) via PayHere.
   */
  private async autoUnsubscribeTelcoIfActive(userId: string, newPlanTier: string): Promise<void> {
    if (!userId || newPlanTier === 'starter') return;

    try {
      const { data: profile, error } = await this.supabase
        .from('profiles')
        .select('id, phone_number, telco_subscriber_id, telco_provider')
        .eq('id', userId)
        .maybeSingle();

      if (error || !profile?.telco_subscriber_id || !profile?.telco_provider) {
        return;
      }

      const provider = profile.telco_provider as 'ideamart' | 'mspace';
      const subscriberId = profile.telco_subscriber_id;

      this.logger.log(
        `[TelcoAutoUnsub] User ${userId} upgraded to ${newPlanTier}. Automatically canceling existing ${provider.toUpperCase()} carrier subscription...`,
      );

      // Load active telco configuration
      let telcoConfig: any = {};
      try {
        const { data: settings } = await this.supabase
          .from('roadmap_levels')
          .select('canonical_content')
          .eq('id', 'sys_app_settings')
          .maybeSingle();
        if (settings?.canonical_content) {
          telcoConfig = JSON.parse(settings.canonical_content);
        }
      } catch (err: any) {
        this.logger.warn(`[TelcoAutoUnsub] Could not load sys_app_settings: ${err?.message}`);
      }

      // Dispatch unsubscribe request to IdeaMart or mSpace API
      if (this.telcoService) {
        await this.telcoService.unsubscribe(provider, subscriberId, telcoConfig);
        this.logger.log(
          `[TelcoAutoUnsub] ✅ Successfully unsubscribed ${provider.toUpperCase()} carrier subscription for user ${userId}.`,
        );
      }

      // Clear telco subscriber tracking on profile so mobile billing is detached
      await this.supabase
        .from('profiles')
        .update({
          telco_subscriber_id: null,
          telco_reference_no: null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', userId);
    } catch (unsubErr: any) {
      this.logger.warn(
        `[TelcoAutoUnsub] ⚠️ Warning auto-unsubscribing telco for user ${userId}: ${unsubErr?.message}`,
      );
    }
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
      allowance: number;
      isTopup?: boolean;
      isPreapproval?: boolean;
    }> = {
      'card-update': {
        name: 'Update Payment Card',
        tier: 'card-update',
        amount: 1.0,
        allowance: 0,
        isPreapproval: true,
      },
      '3-months-pro': {
        name: 'Maya AI Pro (3 Months)',
        tier: 'pro',
        amount: 8640.0,
        allowance: 600,
        isPreapproval: true,
      },
      basic: {
        name: 'Maya AI Basic Monthly',
        tier: 'basic',
        amount: 2700.0,
        allowance: 450,
        isPreapproval: true,
      },
      pro: {
        name: 'Maya AI Pro Monthly',
        tier: 'pro',
        amount: 3600.0,
        allowance: 600,
        isPreapproval: true,
      },
      premium: {
        name: 'Maya AI Premium Monthly',
        tier: 'premium',
        amount: 7200.0,
        allowance: 1200,
        isPreapproval: true,
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

    const isPreapproval = Boolean(plan.isPreapproval);
    const isCardUpdate = dto.planTier === 'card-update';

    const orderId = isCardUpdate
      ? `MAYA-CARD-UPDATE-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`
      : isPreapproval
      ? `MAYA-PREAUTH-${dto.planTier.toUpperCase()}-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`
      : `MAYA-TOPUP-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;

    const currency = 'LKR';

    // MD5 Signature per PayHere specification (Preapproval API):
    // If 'amount' is provided in payload, use that amount in hash.
    // If 'amount' is omitted (zero-charge card update/tokenization), PayHere requires using '10.00' for LKR in hash.
    const formattedAmount = plan.amount.toFixed(2);
    const hashAmount = isCardUpdate ? '10.00' : formattedAmount;

    const hashedSecret = crypto
      .createHash('md5')
      .update(this.merchantSecret)
      .digest('hex')
      .toUpperCase();

    const hashString = `${this.merchantId}${orderId}${hashAmount}${currency}${hashedSecret}`;
    const hash = crypto
      .createHash('md5')
      .update(hashString)
      .digest('hex')
      .toUpperCase();

    // Record pending order transaction
    await this.supabase.from('orders').insert({
      user_id: userId,
      order_type: plan.isTopup ? 'add_on_topup' : isCardUpdate ? 'subscription_renewal' : 'subscription_new',
      plan_tier: plan.tier,
      amount_lkr: isCardUpdate ? 0 : plan.amount,
      minutes_credited: plan.allowance,
      payment_gateway: 'payhere',
      gateway_payment_id: orderId,
      status: 'pending',
    });

    const userFullName = (profile?.display_name || 'Learner').trim();
    const nameParts = userFullName.split(' ');
    const firstName = nameParts[0] || 'Learner';
    const lastName = nameParts.slice(1).join(' ') || 'User';

    const preapprovalUrl = this.isSandbox
      ? 'https://sandbox.payhere.lk/pay/preapprove'
      : 'https://www.payhere.lk/pay/preapprove';

    return {
      sandbox: this.isSandbox,
      action_url: isPreapproval ? preapprovalUrl : undefined,
      merchant_id: this.merchantId,
      return_url: dto.returnUrl || '',
      cancel_url: dto.cancelUrl || '',
      notify_url: this.notifyUrl,
      order_id: orderId,
      items: isCardUpdate
        ? 'Update Payment Card (Zero Charge Verification)'
        : plan.name,
      currency,
      ...(isCardUpdate ? {} : { amount: formattedAmount }),
      ...(isPreapproval ? { preapprove: true } : {}),
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
    const isCardUpdate = payload.custom_2 === 'card-update' || payload.order_id?.startsWith('MAYA-CARD-UPDATE');
    const isPreauthActivation = payload.order_id?.startsWith('MAYA-PREAUTH');

    // Case 1: Card Update (Zero Charge - Preserves existing billing cycle & minutes)
    if (isCardUpdate) {
      this.logger.log(`[PayHereWebhook] 💳 Processing Card Update Preapproval for user ${userId}, order=${payload.order_id}`);
      if (statusCode === 2) {
        const newCustomerToken = payload.customer_token || (payload as any).card_token;
        this.logger.log(`[PayHereWebhook] ✅ Card verified for user ${userId}. Masked: ${payload.card_no}, Token: ${newCustomerToken ? 'Present' : 'Missing'}`);

        const { data: existingSub } = await this.supabase
          .from('subscriptions')
          .select('*')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (existingSub) {
          const { error: subUpdateErr } = await this.supabase
            .from('subscriptions')
            .update({
              card_masked: payload.card_no || existingSub.card_masked,
              card_holder_name: payload.card_holder_name || existingSub.card_holder_name,
              card_expiry: payload.card_expiry || existingSub.card_expiry,
              payment_method: payload.method || existingSub.payment_method,
              customer_token: newCustomerToken || existingSub.customer_token,
              last_payment_id: payload.payment_id,
              status: existingSub.status === 'PAST_DUE' ? 'ACTIVE' : existingSub.status,
              updated_at: new Date().toISOString(),
            })
            .eq('id', existingSub.id);

          if (subUpdateErr) {
            this.logger.error(`[PayHereWebhook] Error updating subscription with new card: ${subUpdateErr.message}`);
          } else {
            this.logger.log(`[PayHereWebhook] 💾 Updated subscription ${existingSub.id} with new card: ${payload.card_no}`);
          }
        } else {
          await this.supabase.from('subscriptions').insert({
            user_id: userId,
            plan_tier: 'pro',
            billing_cycle: '1 Month',
            amount_lkr: 3600,
            status: 'ACTIVE',
            card_masked: payload.card_no,
            card_holder_name: payload.card_holder_name,
            card_expiry: payload.card_expiry,
            payment_method: payload.method,
            customer_token: newCustomerToken,
            last_payment_id: payload.payment_id,
          });
        }

        // Update Order record
        await this.supabase
          .from('orders')
          .update({
            status: 'completed',
            payhere_payment_id: payload.payment_id,
            md5sig: payload.md5sig,
            raw_payload: payload,
          })
          .eq('gateway_payment_id', payload.order_id);

        return { received: true, status: 'CARD_UPDATE_COMPLETED' };
      } else {
        this.logger.warn(`[PayHereWebhook] Card update preapproval failed: status=${statusCode}`);
        return { received: true, status: 'CARD_UPDATE_FAILED' };
      }
    }

    // Case 2: Preapproval Plan Activation (Authorizes card, charges Month 1 immediately, activates plan)
    if (isPreauthActivation) {
      this.logger.log(`[PayHereWebhook] 🚀 Processing Preapproval Plan Activation for user ${userId}, order=${payload.order_id}`);
      if (statusCode === 2) {
        // Idempotency: Verify order is not already marked completed (guards against Sandbox webhook retries)
        const { data: existingOrder } = await this.supabase
          .from('orders')
          .select('status')
          .eq('gateway_payment_id', payload.order_id)
          .maybeSingle();

        if (existingOrder && existingOrder.status === 'completed') {
          this.logger.log(`[PayHereWebhook] ⏩ Preauth order ${payload.order_id} already marked completed. Skipping duplicate processing to prevent double charges.`);
          return { received: true, status: 'ALREADY_COMPLETED' };
        }

        const customerToken = payload.customer_token || (payload as any).card_token;
        const planTier = planTierKey === '3-months-pro' ? 'pro' : planTierKey;
        const isQuarterly = planTierKey === '3-months-pro';
        const amount = isQuarterly ? 8640 : planTier === 'basic' ? 2700 : planTier === 'premium' ? 7200 : 3600;
        const allowance = planTier === 'basic' ? 450 : planTier === 'premium' ? 1200 : 600;
        const cycleDays = isQuarterly ? 90 : 30;

        // Determine if PayHere captured Month 1 upfront in preapproval or if we charge via token
        const receivedAmount = parseFloat(payload.payhere_amount || '0');
        const alreadyChargedInPreapproval = receivedAmount >= amount;

        let chargeSuccess = false;
        let chargePaymentId = payload.payment_id;
        let firstChargeOrderId = payload.order_id;
        let chargeRawData: any = payload;
        let chargeErrorMessage = '';

        if (alreadyChargedInPreapproval) {
          this.logger.log(
            `[PayHereWebhook] 💳 Month 1 payment captured upfront by PayHere Preapproval (${receivedAmount} LKR). No secondary charge needed.`
          );
          chargeSuccess = true;
        } else {
          // Token preapproved without upfront capture; charge Month 1 via Charging API
          firstChargeOrderId = `MAYA-SUB-FIRST-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;
          this.logger.log(`[PayHereWebhook] Executing Month 1 charge for user ${userId}: amount=${amount} LKR, tier=${planTier}...`);

          const chargeResult = await this.executeTokenCharge({
            userId,
            customerToken,
            amount,
            itemName: `Maya AI ${planTier.toUpperCase()} Plan (Month 1)`,
            orderId: firstChargeOrderId,
            custom1: userId,
            custom2: planTier,
          });

          chargeSuccess = chargeResult.success;
          chargePaymentId = chargeResult.data?.data?.payment_id || payload.payment_id;
          chargeRawData = chargeResult.data || payload;
          chargeErrorMessage = chargeResult.error || '';
        }

        const nextBillingDate = new Date(Date.now() + cycleDays * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

        if (chargeSuccess) {
          // Check for existing subscription for this user
          const { data: existingSub } = await this.supabase
            .from('subscriptions')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

          const tokenToPersist = customerToken || (existingSub ? existingSub.customer_token : null);

          let subId: string;
          if (existingSub) {
            subId = existingSub.id;
            await this.supabase
              .from('subscriptions')
              .update({
                customer_token: tokenToPersist,
                plan_tier: planTier,
                billing_cycle: isQuarterly ? '3 Month' : '1 Month',
                amount_lkr: amount,
                status: 'ACTIVE',
                next_billing_date: nextBillingDate,
                installments_paid: 1, // Fresh subscription / tier change always starts at installment 1
                card_holder_name: payload.card_holder_name || existingSub.card_holder_name,
                card_masked: payload.card_no || existingSub.card_masked,
                card_expiry: payload.card_expiry || existingSub.card_expiry,
                payment_method: payload.method || existingSub.payment_method,
                last_payment_id: chargePaymentId,
                updated_at: new Date().toISOString(),
              })
              .eq('id', subId);
          } else {
            const { data: newSub } = await this.supabase
              .from('subscriptions')
              .insert({
                user_id: userId,
                customer_token: tokenToPersist,
                plan_tier: planTier,
                billing_cycle: isQuarterly ? '3 Month' : '1 Month',
                amount_lkr: amount,
                status: 'ACTIVE',
                next_billing_date: nextBillingDate,
                installments_paid: 1,
                card_holder_name: payload.card_holder_name,
                card_masked: payload.card_no,
                card_expiry: payload.card_expiry,
                payment_method: payload.method,
                last_payment_id: chargePaymentId,
              })
              .select()
              .single();
            subId = newSub?.id;
          }

          // Update User Profile Quotas & Plan Tier
          await this.supabase
            .from('profiles')
            .update({
              plan_tier: planTier,
              plan_status: 'active',
              billing_cycle: isQuarterly ? 'quarterly' : 'monthly',
              monthly_minutes_allowance: allowance,
              minutes_balance: allowance,
              minutes_reset_at: new Date(nextBillingDate).toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq('id', userId);

          // Automatically cancel any active mobile carrier billing (IdeaMart / mSpace)
          await this.autoUnsubscribeTelcoIfActive(userId, planTier);

          // Update Preauth Order
          await this.supabase
            .from('orders')
            .update({
              status: 'completed',
              payhere_payment_id: payload.payment_id,
              md5sig: payload.md5sig,
              raw_payload: payload,
            })
            .eq('gateway_payment_id', payload.order_id);

          // If charged separately via token, insert the completed order record
          if (!alreadyChargedInPreapproval) {
            await this.supabase.from('orders').insert({
              user_id: userId,
              subscription_id: subId,
              order_type: 'subscription_new',
              plan_tier: planTier,
              amount_lkr: amount,
              minutes_credited: allowance,
              payment_gateway: 'payhere_token',
              gateway_payment_id: firstChargeOrderId,
              status: 'completed',
              raw_payload: chargeRawData,
            });
          }

          this.logger.log(`[PayHereWebhook] 🎉 Preapproval & Month 1 activation completed successfully for user ${userId}! Tier: ${planTier}`);
          return { received: true, status: 'ACTIVATION_COMPLETED' };
        } else {
          this.logger.error(`[PayHereWebhook] First charge failed for user ${userId}`);

          // Save token anyway as PAST_DUE
          await this.supabase.from('subscriptions').insert({
            user_id: userId,
            customer_token: customerToken,
            plan_tier: planTier,
            billing_cycle: isQuarterly ? '3 Month' : '1 Month',
            amount_lkr: amount,
            status: 'PAST_DUE',
            next_billing_date: nextBillingDate,
            installments_paid: 0,
            card_holder_name: payload.card_holder_name,
            card_masked: payload.card_no,
            card_expiry: payload.card_expiry,
            payment_method: payload.method,
            last_payment_id: payload.payment_id,
          });

          return { received: true, status: 'FIRST_CHARGE_FAILED', error: chargeErrorMessage };
        }
      } else {
        this.logger.warn(`[PayHereWebhook] Preapproval failed: status=${statusCode}`);
        return { received: true, status: 'PREAPPROVAL_FAILED' };
      }
    }

    if (isTopup) {
      this.logger.log(`[PayHereWebhook] ⚡ Processing Extra Talk Time Top-up payment: order=${payload.order_id}, tier=${planTierKey}`);
      if (statusCode === 2) {
        // Idempotency: Check if this top-up order was already completed and credited
        const { data: existingOrder } = await this.supabase
          .from('orders')
          .select('status')
          .eq('gateway_payment_id', payload.order_id)
          .maybeSingle();

        if (existingOrder && existingOrder.status === 'completed') {
          this.logger.log(`[PayHereWebhook] ⏩ Order ${payload.order_id} already completed. Skipping duplicate crediting.`);
          return { received: true, status: 'ALREADY_COMPLETED' };
        }

        const topupAllowance = planTierKey === '300-min' ? 300 : planTierKey === '120-min' ? 120 : 30;

        // Fetch current user balance and add-on balance
        const { data: userProfile } = await this.supabase
          .from('profiles')
          .select('minutes_balance, add_on_minutes_balance')
          .eq('id', userId)
          .maybeSingle();

        const currentBalance = userProfile?.minutes_balance ?? 0;
        const currentAddOn = userProfile?.add_on_minutes_balance ?? 0;
        const newBalance = currentBalance + topupAllowance;
        const newAddOn = currentAddOn + topupAllowance;

        const { error: profileErr } = await this.supabase
          .from('profiles')
          .update({
            minutes_balance: newBalance,
            add_on_minutes_balance: newAddOn,
            updated_at: new Date().toISOString(),
          })
          .eq('id', userId);

        if (profileErr) {
          this.logger.error(`[PayHereWebhook] ❌ Error crediting top-up minutes to profile: ${profileErr.message}`);
        } else {
          this.logger.log(`[PayHereWebhook] ⏱️ Credited +${topupAllowance}m to user ${userId} (new balance: ${newBalance}m, add-on total: ${newAddOn}m)`);
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

        // Check for existing subscription for this user to prevent duplicate rows
        const { data: existingSub } = await this.supabase
          .from('subscriptions')
          .select('*')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        const tokenToSave = payload.customer_token || (existingSub ? existingSub.customer_token : null);

        let subId: string | undefined = undefined;
        if (existingSub) {
          subId = existingSub.id;
          const { error: subUpdateErr } = await this.supabase
            .from('subscriptions')
            .update({
              payhere_subscription_id: payload.subscription_id || existingSub.payhere_subscription_id,
              customer_token: tokenToSave,
              plan_tier: planTier,
              billing_cycle: payload.item_recurrence || '1 Month',
              amount_lkr: parseFloat(payload.payhere_amount),
              status: 'ACTIVE',
              next_billing_date: nextBillingDate,
              installments_paid: 1,
              card_holder_name: payload.card_holder_name || existingSub.card_holder_name,
              card_masked: payload.card_no || existingSub.card_masked,
              card_expiry: payload.card_expiry || existingSub.card_expiry,
              payment_method: payload.method || existingSub.payment_method,
              last_payment_id: payload.payment_id,
              updated_at: new Date().toISOString(),
            })
            .eq('id', subId);

          if (subUpdateErr) {
            this.logger.error(`[PayHereWebhook] ❌ Error updating subscription record: ${subUpdateErr.message}`);
          } else {
            this.logger.log(`[PayHereWebhook] 💾 Updated subscription row in public.subscriptions: id=${subId}, status=ACTIVE`);
          }
        } else {
          const { data: newSub, error: subInsertErr } = await this.supabase
            .from('subscriptions')
            .insert({
              user_id: userId,
              payhere_subscription_id: payload.subscription_id,
              customer_token: tokenToSave,
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
            })
            .select()
            .single();

          if (subInsertErr) {
            this.logger.error(`[PayHereWebhook] ❌ Error inserting subscription record: ${subInsertErr.message}`);
          } else {
            subId = newSub?.id;
            this.logger.log(`[PayHereWebhook] 💾 Created subscription row in public.subscriptions: id=${subId}, status=ACTIVE`);
          }
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

        // Automatically cancel any active mobile carrier billing (IdeaMart / mSpace)
        await this.autoUnsubscribeTelcoIfActive(userId, planTier);

        // Update Order
        const { error: orderErr } = await this.supabase
          .from('orders')
          .update({
            status: 'completed',
            subscription_id: subId,
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
   * Fetches payment history for a specific subscription directly from database orders (with fallback to PayHere API).
   */
  async getSubscriptionPayments(
    subscriptionId: string
  ): Promise<any[]> {
    // 1. Try resolving subscription record from database
    const isSubUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(subscriptionId);
    let subQuery = this.supabase.from('subscriptions').select('*');
    if (isSubUuid) {
      subQuery = subQuery.or(`id.eq.${subscriptionId},payhere_subscription_id.eq.${subscriptionId},user_id.eq.${subscriptionId}`);
    } else {
      subQuery = subQuery.eq('payhere_subscription_id', subscriptionId);
    }
    const { data: sub } = await subQuery.maybeSingle();

    const targetUserId = sub?.user_id || subscriptionId;
    const targetSubId = sub?.id;

    // 2. Fetch all orders (subscription renewals, initial charges, and talk time top-ups)
    let orderQuery = this.supabase
      .from('orders')
      .select('*')
      .order('created_at', { ascending: false });

    if (targetSubId && targetUserId) {
      orderQuery = orderQuery.or(`user_id.eq.${targetUserId},subscription_id.eq.${targetSubId},payhere_subscription_id.eq.${subscriptionId}`);
    } else if (targetUserId) {
      orderQuery = orderQuery.or(`user_id.eq.${targetUserId},payhere_subscription_id.eq.${subscriptionId}`);
    } else {
      orderQuery = orderQuery.eq('payhere_subscription_id', subscriptionId);
    }

    const { data: orders } = await orderQuery;

    if (orders && orders.length > 0) {
      return orders.map((o) => ({
        payment_id: o.payhere_payment_id || o.gateway_payment_id,
        order_id: o.gateway_payment_id,
        order_type: o.order_type,
        plan_tier: o.plan_tier,
        package_id: o.add_on_package_id,
        minutes_credited: o.minutes_credited,
        amount: o.amount_lkr,
        currency: 'LKR',
        date: o.created_at,
        status: o.status === 'completed' ? 'RECEIVED' : o.status === 'failed' ? 'FAILED' : 'PENDING',
        payment_method: o.raw_payload?.method || (o.payment_gateway === 'payhere_token' ? 'SAVED_CARD' : 'PAYHERE'),
        card_no: o.raw_payload?.card_no || sub?.card_masked || null,
        card_holder_name: o.raw_payload?.card_holder_name || sub?.card_holder_name || null,
      }));
    }

    // 3. Fallback: If no orders in database and payhere_subscription_id exists, query PayHere API
    if (sub?.payhere_subscription_id || !subscriptionId.includes('-')) {
      try {
        const token = await this.getOAuthAccessToken();
        const url = `${this.getBaseUrl()}/merchant/v1/subscription/${sub?.payhere_subscription_id || subscriptionId}/payments`;
        const res = await fetch(url, {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        });
        if (res.ok) {
          const result = await res.json();
          return result.data || [];
        }
      } catch {}
    }

    return [];
  }

  /**
   * Retries a failed subscription charge via pre-approved card token (or fallback PayHere API).
   */
  async retrySubscription(subscriptionId: string): Promise<{ success: boolean; msg: string }> {
    // 1. Look up subscription record from database
    const { data: sub, error } = await this.supabase
      .from('subscriptions')
      .select('*')
      .or(`id.eq.${subscriptionId},payhere_subscription_id.eq.${subscriptionId},user_id.eq.${subscriptionId}`)
      .maybeSingle();

    if (error || !sub) {
      throw new BadRequestException('Subscription not found');
    }

    // 2. If subscription has preapproved token, charge via PayHere Automated Charging API
    if (sub.customer_token && String(sub.customer_token).trim().length > 0) {
      const planTier = sub.plan_tier || 'pro';
      const amount = parseFloat(sub.amount_lkr || '3600');
      const isQuarterly = sub.billing_cycle === '3 Month';
      const cycleDays = isQuarterly ? 90 : 30;
      const allowance = planTier === 'basic' ? 450 : planTier === 'premium' ? 1200 : 600;
      const retryOrderId = `MAYA-RENEW-RETRY-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;

      this.logger.log(`[PayHereRetry] ⚡ Executing token charge retry for user ${sub.user_id}, plan=${planTier}, amount=${amount} LKR...`);

      const chargeResult = await this.executeTokenCharge({
        userId: sub.user_id,
        customerToken: sub.customer_token,
        amount,
        itemName: `Maya AI ${planTier.toUpperCase()} Plan Renewal Retry`,
        orderId: retryOrderId,
        custom1: sub.user_id,
        custom2: planTier,
      });

      if (chargeResult.success) {
        const nextBilling = new Date();
        nextBilling.setDate(nextBilling.getDate() + cycleDays);
        const nextBillingDateStr = nextBilling.toISOString().split('T')[0];

        await this.supabase
          .from('subscriptions')
          .update({
            status: 'ACTIVE',
            next_billing_date: nextBillingDateStr,
            installments_paid: (sub.installments_paid || 1) + 1,
            last_payment_id: chargeResult.data?.data?.payment_id || retryOrderId,
            updated_at: new Date().toISOString(),
          })
          .eq('id', sub.id);

        await this.supabase
          .from('profiles')
          .update({
            plan_status: 'active',
            minutes_balance: allowance,
            minutes_reset_at: nextBilling.toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('id', sub.user_id);

        await this.supabase.from('orders').insert({
          user_id: sub.user_id,
          subscription_id: sub.id,
          order_type: 'subscription_renewal',
          plan_tier: planTier,
          amount_lkr: amount,
          minutes_credited: allowance,
          payment_gateway: 'payhere_token',
          gateway_payment_id: retryOrderId,
          status: 'completed',
          raw_payload: chargeResult.data,
        });

        return { success: true, msg: 'Saved card successfully charged! Subscription is now ACTIVE.' };
      } else {
        await this.supabase.from('orders').insert({
          user_id: sub.user_id,
          subscription_id: sub.id,
          order_type: 'subscription_renewal',
          plan_tier: planTier,
          amount_lkr: amount,
          minutes_credited: 0,
          payment_gateway: 'payhere_token',
          gateway_payment_id: retryOrderId,
          status: 'failed',
          raw_payload: chargeResult.data,
        });

        throw new BadRequestException(`Card charge declined: ${chargeResult.error || 'Gateway error'}`);
      }
    }

    // 3. Fallback: Legacy PayHere Subscription API
    if (sub.payhere_subscription_id) {
      const token = await this.getOAuthAccessToken();
      const url = `${this.getBaseUrl()}/merchant/v1/subscription/retry`;
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ subscription_id: sub.payhere_subscription_id }),
      });

      const result = await res.json();
      if (result.status !== 1) {
        throw new BadRequestException(result.msg || 'Subscription retry failed');
      }

      return { success: true, msg: result.msg || 'Payment charged successfully' };
    }

    throw new BadRequestException('No pre-approved card token or PayHere subscription ID found on file.');
  }

  /**
   * Cancels a subscription in local database and PayHere API (if applicable).
   */
  async cancelSubscription(
    subscriptionId: string,
    userId?: string
  ): Promise<{ success: boolean; msg: string }> {
    const { data: sub } = await this.supabase
      .from('subscriptions')
      .select('*')
      .or(`id.eq.${subscriptionId},payhere_subscription_id.eq.${subscriptionId},user_id.eq.${subscriptionId}`)
      .maybeSingle();

    if (sub?.payhere_subscription_id) {
      try {
        const token = await this.getOAuthAccessToken();
        const url = `${this.getBaseUrl()}/merchant/v1/subscription/cancel`;
        await fetch(url, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ subscription_id: sub.payhere_subscription_id }),
        });
      } catch (err: any) {
        this.logger.warn(`PayHere cancel API warning: ${err.message}`);
      }
    }

    if (sub?.id) {
      await this.supabase
        .from('subscriptions')
        .update({
          status: 'CANCELLED',
          cancelled_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', sub.id);
    }

    const resolvedUserId = userId || sub?.user_id;
    if (resolvedUserId) {
      await this.supabase
        .from('profiles')
        .update({
          plan_status: 'canceled',
          updated_at: new Date().toISOString(),
        })
        .eq('id', resolvedUserId);
    }

    return { success: true, msg: 'Subscription successfully cancelled' };
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
   * Executes a direct programmatic charge against PayHere Charging API using a preapproved customer token.
   */
  async executeTokenCharge(params: {
    userId: string;
    customerToken: string;
    amount: number;
    itemName: string;
    orderId: string;
    custom1?: string;
    custom2?: string;
  }): Promise<{ success: boolean; data?: any; error?: string }> {
    if (!this.appId || !this.appSecret) {
      return { success: false, error: 'PayHere Automated Charging credentials missing' };
    }

    try {
      const accessToken = await this.getOAuthAccessToken();
      const chargeUrl = `${this.getBaseUrl()}/merchant/v1/payment/charge`;
      this.logger.log(`[PayHereChargingApi] Charging order ${params.orderId}, amount=${params.amount} LKR...`);

      const res = await fetch(chargeUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: 'PAYMENT',
          order_id: params.orderId,
          items: params.itemName,
          currency: 'LKR',
          amount: params.amount,
          customer_token: params.customerToken,
          custom_1: params.custom1 || params.userId,
          custom_2: params.custom2 || '',
          notify_url: this.notifyUrl,
        }),
      });

      const data = await res.json();
      this.logger.log(`[PayHereChargingApi] Gateway response for ${params.orderId}: ${JSON.stringify(data)}`);

      if (data && data.status === 1) {
        return { success: true, data };
      } else {
        return { success: false, error: data?.msg || 'Charge rejected by payment gateway', data };
      }
    } catch (err: any) {
      this.logger.error(`[PayHereChargingApi] Connection error: ${err.message}`);
      return { success: false, error: err.message };
    }
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
        amount = 2700;
        allowance = 450;
        itemName = 'Maya Basic Plan (Monthly)';
      } else if (dto.planTier === 'pro') {
        amount = 3600;
        allowance = 600;
        itemName = 'Maya Pro Plan (Monthly)';
      } else if (dto.planTier === 'premium') {
        amount = 7200;
        allowance = 1200;
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

    // 3. Trigger PayHere Automated Charging API via centralized executor
    const chargeResult = await this.executeTokenCharge({
      userId,
      customerToken,
      amount,
      itemName,
      orderId,
      custom1: userId,
      custom2: dto.packageId || dto.planTier,
    });

    if (!chargeResult.success) {
      const errorMsg = chargeResult.error || 'Card charge declined by payment gateway';
      this.logger.error(`[PayHereAutoCharge] Charge failed for order ${orderId}: ${errorMsg}`);

      // Record failed transaction in orders table for audit trail
      await this.supabase.from('orders').insert({
        user_id: userId,
        order_type: isTopup ? 'add_on_topup' : 'subscription_renewal',
        plan_tier: dto.planTier || sub.plan_tier,
        amount_lkr: amount,
        minutes_credited: 0,
        payment_gateway: 'payhere_token',
        gateway_payment_id: orderId,
        status: 'failed',
        raw_payload: chargeResult.data,
      });

      throw new BadRequestException(`Payment failed: ${errorMsg}`);
    }

    // 4. Update Database: Credit minutes or activate plan
    let newBalance = 0;
    if (isTopup) {
      const { data: userProfile } = await this.supabase
        .from('profiles')
        .select('minutes_balance, add_on_minutes_balance')
        .eq('id', userId)
        .maybeSingle();

      const currentBalance = userProfile?.minutes_balance ?? 0;
      const currentAddOn = userProfile?.add_on_minutes_balance ?? 0;
      newBalance = currentBalance + allowance;
      const newAddOn = currentAddOn + allowance;

      await this.supabase
        .from('profiles')
        .update({
          minutes_balance: newBalance,
          add_on_minutes_balance: newAddOn,
          updated_at: new Date().toISOString(),
        })
        .eq('id', userId);

      this.logger.log(`[PayHereAutoCharge] ⏱️ Credited +${allowance}m top-up to user ${userId}. New balance: ${newBalance}m (add-on total: ${newAddOn}m)`);
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

      // Automatically cancel any active mobile carrier billing (IdeaMart / mSpace)
      await this.autoUnsubscribeTelcoIfActive(userId, dto.planTier || sub.plan_tier || 'pro');

      await this.supabase
        .from('subscriptions')
        .update({
          plan_tier: dto.planTier,
          amount_lkr: amount,
          status: 'ACTIVE',
          next_billing_date: nextMonth.toISOString().split('T')[0],
          installments_paid: 1,
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
   * Admin: Queries all subscribers from database with profile metadata and calculates overview metrics,
   * including recurring renewal metrics and talk-time top-up telemetry.
   */
  async getAdminSubscriptions() {
    const [{ data: subs, error: subErr }, { data: orders, error: orderErr }] = await Promise.all([
      this.supabase
        .from('subscriptions')
        .select(`
          *,
          profile:profiles(id, display_name, phone_number, minutes_balance, level)
        `)
        .order('created_at', { ascending: false }),
      this.supabase
        .from('orders')
        .select(`
          *,
          profile:profiles(id, display_name, phone_number, level)
        `)
        .order('created_at', { ascending: false }),
    ]);

    if (subErr) {
      this.logger.error(`Admin subscriptions query failed: ${subErr.message}`);
      throw new InternalServerErrorException('Database query failed');
    }

    const items = subs || [];
    const allOrders = orders || [];

    const activeSubs = items.filter((s) => s.status === 'ACTIVE');
    const pastDueSubs = items.filter((s) => s.status === 'PAST_DUE');
    const cancelledSubs = items.filter((s) => s.status === 'CANCELLED');

    const totalMRR = activeSubs.reduce((acc, curr) => {
      const amount = parseFloat(curr.amount_lkr || 0);
      return curr.billing_cycle === '3 Month' ? acc + amount / 3 : acc + amount;
    }, 0);

    // Compute Talk Time Top-Up metrics
    const topUpOrders = allOrders.filter((o) => o.order_type === 'add_on_topup' && o.status === 'completed');
    const totalTopUpRevenue = topUpOrders.reduce((sum, o) => sum + parseFloat(o.amount_lkr || 0), 0);
    const totalTopUpMinutes = topUpOrders.reduce((sum, o) => sum + (o.minutes_credited || 0), 0);

    const pack30 = topUpOrders.filter((o) => o.add_on_package_id === '30-min');
    const pack120 = topUpOrders.filter((o) => o.add_on_package_id === '120-min');
    const pack300 = topUpOrders.filter((o) => o.add_on_package_id === '300-min');

    // Compute Recurring Renewal metrics
    const renewalOrders = allOrders.filter((o) => o.order_type === 'subscription_renewal');
    const successfulRenewals = renewalOrders.filter((o) => o.status === 'completed');
    const failedRenewals = renewalOrders.filter((o) => o.status === 'failed');
    const renewalsRevenue = successfulRenewals.reduce((sum, o) => sum + parseFloat(o.amount_lkr || 0), 0);

    return {
      stats: {
        totalSubscribers: items.length,
        activeCount: activeSubs.length,
        pastDueCount: pastDueSubs.length,
        cancelledCount: cancelledSubs.length,
        mrrLkr: Math.round(totalMRR),
        topUpRevenueLkr: totalTopUpRevenue,
        topUpMinutesSold: totalTopUpMinutes,
        topUpOrdersCount: topUpOrders.length,
        topUpPackages: {
          '30-min': {
            count: pack30.length,
            revenue: pack30.reduce((s, o) => s + parseFloat(o.amount_lkr || 0), 0),
            minutes: pack30.reduce((s, o) => s + (o.minutes_credited || 30), 0),
          },
          '120-min': {
            count: pack120.length,
            revenue: pack120.reduce((s, o) => s + parseFloat(o.amount_lkr || 0), 0),
            minutes: pack120.reduce((s, o) => s + (o.minutes_credited || 120), 0),
          },
          '300-min': {
            count: pack300.length,
            revenue: pack300.reduce((s, o) => s + parseFloat(o.amount_lkr || 0), 0),
            minutes: pack300.reduce((s, o) => s + (o.minutes_credited || 300), 0),
          },
        },
        renewalsCount: renewalOrders.length,
        renewalsSucceeded: successfulRenewals.length,
        renewalsFailed: failedRenewals.length,
        renewalsRevenueLkr: renewalsRevenue,
      },
      subscriptions: items,
      orders: allOrders,
    };
  }

  /**
   * Admin: Queries orders table with optional filtering by order_type.
   */
  async getAdminOrders(orderType?: string, limit: number = 100) {
    let query = this.supabase
      .from('orders')
      .select(`
        *,
        profile:profiles(id, display_name, phone_number, level, minutes_balance)
      `)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (orderType && orderType !== 'ALL') {
      query = query.eq('order_type', orderType);
    }

    const { data: orders, error } = await query;
    if (error) {
      this.logger.error(`Failed to fetch admin orders: ${error.message}`);
      throw new InternalServerErrorException('Database query failed');
    }

    return orders || [];
  }

  /**
   * PayHere Payment Retrieval API:
   * Queries PayHere gateway directly for a given order_id using OAuth2 Bearer token.
   * Endpoint: GET {baseUrl}/merchant/v1/payment/search?order_id={orderId}
   */
  async queryPaymentByOrderId(orderId: string): Promise<any | null> {
    if (!this.appId || !this.appSecret) {
      this.logger.warn(`[PayHereRetrieval] App ID or Secret missing. Cannot query payment search.`);
      return null;
    }

    try {
      const accessToken = await this.getOAuthAccessToken();
      const url = `${this.getBaseUrl()}/merchant/v1/payment/search?order_id=${encodeURIComponent(orderId)}`;
      this.logger.log(`[PayHereRetrieval] 🔍 Querying PayHere Retrieval API for order: ${orderId}...`);

      const res = await fetch(url, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (!res.ok) {
        const errText = await res.text();
        this.logger.warn(`[PayHereRetrieval] Gateway returned HTTP ${res.status}: ${errText}`);
        return null;
      }

      const result = await res.json();
      this.logger.log(`[PayHereRetrieval] Response for ${orderId}: ${JSON.stringify(result)}`);

      if (result && result.status === 1 && Array.isArray(result.data) && result.data.length > 0) {
        return result.data[0];
      }

      return null;
    } catch (err: any) {
      this.logger.error(`[PayHereRetrieval] Error querying order ${orderId}: ${err.message}`);
      return null;
    }
  }

  /**
   * Automated Recovery & Resilience Engine:
   * Reconciles a pending or interrupted order by verifying directly against PayHere Gateway.
   * Handles server crash/reboot during checkout, dropped webhooks, and manual syncs.
   */
  async reconcilePendingOrder(
    orderId: string
  ): Promise<{ success: boolean; status: string; message: string; order?: any }> {
    this.logger.log(`[PayHereRecovery] 🔄 Reconciling order status for ${orderId}...`);

    // 1. Fetch order from local database
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(orderId);
    let orderQuery = this.supabase.from('orders').select('*');
    if (isUuid) {
      orderQuery = orderQuery.or(`id.eq.${orderId},gateway_payment_id.eq.${orderId},payhere_payment_id.eq.${orderId}`);
    } else {
      orderQuery = orderQuery.or(`gateway_payment_id.eq.${orderId},payhere_payment_id.eq.${orderId}`);
    }
    const { data: order, error: orderErr } = await orderQuery.maybeSingle();

    if (orderErr) {
      this.logger.error(`[PayHereRecovery] Database error looking up order ${orderId}: ${orderErr.message}`);
      return { success: false, status: 'DB_ERROR', message: orderErr.message };
    }

    if (!order) {
      this.logger.warn(`[PayHereRecovery] Order ${orderId} not found in database.`);
      return { success: false, status: 'NOT_FOUND', message: 'Order record not found in system.' };
    }

    // If order is already completed, return immediately (idempotent)
    if (order.status === 'completed') {
      this.logger.log(`[PayHereRecovery] ⏩ Order ${orderId} is already completed. No action needed.`);
      return { success: true, status: 'ALREADY_COMPLETED', message: 'Order is already completed.', order };
    }

    // 2. Query PayHere Retrieval API
    const payhereData = await this.queryPaymentByOrderId(order.gateway_payment_id || orderId);

    if (!payhereData) {
      this.logger.log(`[PayHereRecovery] ⏳ Order ${orderId} has no confirmed payment record at PayHere yet.`);
      return {
        success: false,
        status: 'PENDING_AT_GATEWAY',
        message: 'Payment has not been completed or received at gateway yet.',
        order,
      };
    }

    const rawStatus = String(payhereData.status || '').toUpperCase();
    const isSuccess = rawStatus === 'RECEIVED' || rawStatus === 'SUCCESS';
    const isFailed = rawStatus === 'FAILED' || rawStatus === 'CANCELLED' || rawStatus === 'CANCELED';

    // 3. Handle Gateway Declines/Cancellations
    if (isFailed) {
      this.logger.warn(`[PayHereRecovery] ❌ Order ${orderId} failed at gateway with status ${rawStatus}.`);
      await this.supabase
        .from('orders')
        .update({
          status: 'failed',
          payhere_payment_id: payhereData.payment_id ? String(payhereData.payment_id) : order.payhere_payment_id,
          raw_payload: payhereData,
        })
        .eq('id', order.id);

      return {
        success: false,
        status: 'PAYMENT_FAILED',
        message: `Payment marked as ${rawStatus} by payment gateway.`,
      };
    }

    if (!isSuccess) {
      return {
        success: false,
        status: rawStatus || 'PENDING',
        message: `Gateway payment status is ${rawStatus}.`,
        order,
      };
    }

    // 4. Gateway confirmed payment received! Activate plan/minutes in our database
    this.logger.log(`[PayHereRecovery] 🎉 Gateway confirmed payment for order ${orderId} (Payment ID: ${payhereData.payment_id})! Executing activation...`);

    const userId = order.user_id;
    const orderGatewayId = order.gateway_payment_id || orderId;
    const isTopup = order.order_type === 'add_on_topup' || orderGatewayId.startsWith('MAYA-TOPUP');
    const isCardUpdate = orderGatewayId.startsWith('MAYA-CARD-UPDATE');
    const isPreauth = orderGatewayId.startsWith('MAYA-PREAUTH') || order.order_type === 'subscription_new';

    const customerToken = payhereData.customer_token || payhereData.card_token || null;
    const paymentIdStr = payhereData.payment_id ? String(payhereData.payment_id) : null;
    const cardMasked = payhereData.card_no || null;
    const cardHolder = payhereData.card_holder_name || null;
    const cardExpiry = payhereData.card_expiry || null;
    const paymentMethod = payhereData.method || 'VISA';

    if (isCardUpdate) {
      // Case 1: Card Update
      const { data: existingSub } = await this.supabase
        .from('subscriptions')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (existingSub) {
        await this.supabase
          .from('subscriptions')
          .update({
            card_masked: cardMasked || existingSub.card_masked,
            card_holder_name: cardHolder || existingSub.card_holder_name,
            card_expiry: cardExpiry || existingSub.card_expiry,
            payment_method: paymentMethod || existingSub.payment_method,
            customer_token: customerToken || existingSub.customer_token,
            last_payment_id: paymentIdStr || existingSub.last_payment_id,
            status: existingSub.status === 'PAST_DUE' ? 'ACTIVE' : existingSub.status,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existingSub.id);
      }

      await this.supabase
        .from('orders')
        .update({
          status: 'completed',
          payhere_payment_id: paymentIdStr,
          raw_payload: payhereData,
        })
        .eq('id', order.id);

      return { success: true, status: 'RECONCILED_SUCCESS', message: 'Card details successfully updated.' };
    }

    if (isTopup) {
      // Case 2: Top-up Allowance Crediting
      const allowance =
        order.minutes_credited ||
        (order.amount_lkr >= 2000 ? 300 : order.amount_lkr >= 900 ? 120 : 30);

      const { data: userProfile } = await this.supabase
        .from('profiles')
        .select('minutes_balance, add_on_minutes_balance')
        .eq('id', userId)
        .maybeSingle();

      const currentBalance = userProfile?.minutes_balance ?? 0;
      const currentAddOn = userProfile?.add_on_minutes_balance ?? 0;
      const newBalance = currentBalance + allowance;
      const newAddOn = currentAddOn + allowance;

      await this.supabase
        .from('profiles')
        .update({
          minutes_balance: newBalance,
          add_on_minutes_balance: newAddOn,
          updated_at: new Date().toISOString(),
        })
        .eq('id', userId);

      await this.supabase
        .from('orders')
        .update({
          status: 'completed',
          payhere_payment_id: paymentIdStr,
          raw_payload: payhereData,
        })
        .eq('id', order.id);

      this.logger.log(`[PayHereRecovery] ⏱️ Credited +${allowance}m to user ${userId} via recovery!`);
      return { success: true, status: 'RECONCILED_SUCCESS', message: `Successfully credited +${allowance} minutes.` };
    }

    // Case 3: Subscription / Preauth Plan Activation
    const rawTier = order.plan_tier || 'pro';
    const isQuarterly = rawTier === '3-months-pro';
    const planTier = isQuarterly ? 'pro' : rawTier;
    const amount = order.amount_lkr || (isQuarterly ? 8640 : planTier === 'basic' ? 2700 : planTier === 'premium' ? 7200 : 3600);
    const allowance = planTier === 'basic' ? 450 : planTier === 'premium' ? 1200 : 600;
    const cycleDays = isQuarterly ? 90 : 30;
    const nextBillingDate = new Date(Date.now() + cycleDays * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    const { data: existingSub } = await this.supabase
      .from('subscriptions')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    const tokenToPersist = customerToken || (existingSub ? existingSub.customer_token : null);
    let subId = existingSub?.id;

    if (existingSub) {
      await this.supabase
        .from('subscriptions')
        .update({
          customer_token: tokenToPersist,
          plan_tier: planTier,
          billing_cycle: isQuarterly ? '3 Month' : '1 Month',
          amount_lkr: amount,
          status: 'ACTIVE',
          next_billing_date: nextBillingDate,
          installments_paid: 1,
          card_holder_name: cardHolder || existingSub.card_holder_name,
          card_masked: cardMasked || existingSub.card_masked,
          card_expiry: cardExpiry || existingSub.card_expiry,
          payment_method: paymentMethod || existingSub.payment_method,
          last_payment_id: paymentIdStr || existingSub.last_payment_id,
          updated_at: new Date().toISOString(),
        })
        .eq('id', subId);
    } else {
      const { data: newSub } = await this.supabase
        .from('subscriptions')
        .insert({
          user_id: userId,
          customer_token: tokenToPersist,
          plan_tier: planTier,
          billing_cycle: isQuarterly ? '3 Month' : '1 Month',
          amount_lkr: amount,
          status: 'ACTIVE',
          next_billing_date: nextBillingDate,
          installments_paid: 1,
          card_holder_name: cardHolder,
          card_masked: cardMasked,
          card_expiry: cardExpiry,
          payment_method: paymentMethod,
          last_payment_id: paymentIdStr,
        })
        .select()
        .single();
      subId = newSub?.id;
    }

    // Update User Profile
    await this.supabase
      .from('profiles')
      .update({
        plan_tier: planTier,
        plan_status: 'active',
        billing_cycle: isQuarterly ? 'quarterly' : 'monthly',
        monthly_minutes_allowance: allowance,
        minutes_balance: allowance,
        minutes_reset_at: new Date(nextBillingDate).toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId);

    // Automatically cancel any active mobile carrier billing (IdeaMart / mSpace)
    await this.autoUnsubscribeTelcoIfActive(userId, planTier);

    // Update Order
    await this.supabase
      .from('orders')
      .update({
        status: 'completed',
        subscription_id: subId || order.subscription_id,
        payhere_payment_id: paymentIdStr,
        raw_payload: payhereData,
      })
      .eq('id', order.id);

    this.logger.log(`[PayHereRecovery] 🚀 Order ${orderId} successfully reconciled and activated! User: ${userId}, Tier: ${planTier}`);
    return {
      success: true,
      status: 'RECONCILED_SUCCESS',
      message: `Plan ${planTier.toUpperCase()} successfully activated via gateway reconciliation.`,
    };
  }
}
