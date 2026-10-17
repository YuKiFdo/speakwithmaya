import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { PayHereService } from './payhere.service.js';

export interface ReconciliationReport {
  timestamp: string;
  totalPastDueChecked: number;
  pastDueReinstated: number;
  pastDueDowngraded: number;
  quotasReset: number;
  renewalsAttempted?: number;
  renewalsSucceeded?: number;
  renewalsFailed?: number;
  pendingOrdersSwept?: number;
  pendingOrdersRecovered?: number;
  errors: string[];
}

@Injectable()
export class SubscriptionReconciliationService {
  private readonly logger = new Logger(SubscriptionReconciliationService.name);
  private readonly supabase: SupabaseClient;

  constructor(
    private readonly config: ConfigService,
    private readonly payhereService: PayHereService,
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
  }

  /**
   * Daily Reconciliation Cron:
   * Executes every day at midnight (00:00:00 UTC).
   * 1. Reconciles PAST_DUE and pending subscriptions with PayHere API.
   * 2. Downgrades subscribers whose payment retries failed past grace period (> 7 days).
   * 3. Performs proactive monthly quota cycle refreshes for idle users.
   */
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async handleDailyReconciliation(): Promise<void> {
    this.logger.log('Starting daily PayHere subscription reconciliation cron...');
    try {
      const report = await this.reconcileSubscriptions();
      this.logger.log(
        `Subscription reconciliation completed: checked=${report.totalPastDueChecked}, reinstated=${report.pastDueReinstated}, downgraded=${report.pastDueDowngraded}, quotasReset=${report.quotasReset}`,
      );
    } catch (err: any) {
      this.logger.error(`Daily subscription reconciliation failed: ${err.message}`, err.stack);
    }
  }

  /**
   * Pending Orders Recovery Sweeper:
   * Executes every 10 minutes.
   * Sweeps orders that are pending, created between 5 minutes and 24 hours ago.
   * Automatically queries PayHere Gateway Retrieval API to recover from server downtime or dropped webhooks.
   */
  @Cron(CronExpression.EVERY_10_MINUTES)
  async handlePendingOrdersReconciliation(): Promise<{ swept: number; recovered: number }> {
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const { data: pendingOrders, error } = await this.supabase
      .from('orders')
      .select('*')
      .eq('status', 'pending')
      .lte('created_at', fiveMinutesAgo)
      .gte('created_at', twentyFourHoursAgo)
      .limit(20);

    if (error) {
      this.logger.error(`[PayHereCronSweep] Error querying pending orders: ${error.message}`);
      return { swept: 0, recovered: 0 };
    }

    if (!pendingOrders || pendingOrders.length === 0) {
      return { swept: 0, recovered: 0 };
    }

    this.logger.log(`[PayHereCronSweep] 🧹 Found ${pendingOrders.length} pending order(s) to verify with gateway.`);
    let recovered = 0;

    for (const order of pendingOrders) {
      try {
        const orderIdentifier = order.gateway_payment_id || order.id;
        const result = await this.payhereService.reconcilePendingOrder(orderIdentifier);
        if (result.success && result.status === 'RECONCILED_SUCCESS') {
          recovered++;
        }
        this.logger.log(`[PayHereCronSweep] Order ${orderIdentifier} result: ${result.status} (${result.message})`);
      } catch (orderErr: any) {
        this.logger.error(`[PayHereCronSweep] Failed to sweep order ${order.id}: ${orderErr.message}`);
      }
    }

    return { swept: pendingOrders.length, recovered };
  }

  /**
   * Core reconciliation workflow (can also be invoked on-demand by Admins).
   */
  async reconcileSubscriptions(): Promise<ReconciliationReport> {
    const report: ReconciliationReport = {
      timestamp: new Date().toISOString(),
      totalPastDueChecked: 0,
      pastDueReinstated: 0,
      pastDueDowngraded: 0,
      quotasReset: 0,
      errors: [],
    };

    const now = new Date();

    // 1. Fetch all PAST_DUE subscriptions
    const { data: pastDueSubs, error: pastDueErr } = await this.supabase
      .from('subscriptions')
      .select('*')
      .eq('status', 'PAST_DUE');

    if (pastDueErr) {
      this.logger.error(`Failed to fetch past_due subscriptions: ${pastDueErr.message}`);
      report.errors.push(`fetch past_due: ${pastDueErr.message}`);
    } else if (pastDueSubs) {
      report.totalPastDueChecked = pastDueSubs.length;

      for (const sub of pastDueSubs) {
        try {
          const subId = sub.payhere_subscription_id;
          const updatedAt = sub.updated_at ? new Date(sub.updated_at).getTime() : now.getTime();
          const daysPastDue = (now.getTime() - updatedAt) / (24 * 60 * 60 * 1000);

          // Check PayHere Subscription Manager API if subscription ID is present
          if (subId) {
            try {
              const payments = await this.payhereService.getSubscriptionPayments(subId);
              // Check if any recent payment succeeded (status_code 2)
              const hasRecentSuccess = payments?.some((p) => String(p.status) === '2');

              if (hasRecentSuccess) {
                // Payment was captured by PayHere retry -> Reinstate active status
                await this.supabase
                  .from('subscriptions')
                  .update({
                    status: 'ACTIVE',
                    updated_at: new Date().toISOString(),
                  })
                  .eq('id', sub.id);

                if (sub.user_id) {
                  await this.supabase
                    .from('profiles')
                    .update({
                      plan_status: 'active',
                      updated_at: new Date().toISOString(),
                    })
                    .eq('id', sub.user_id);
                }

                report.pastDueReinstated++;
                this.logger.log(`Reinstated subscription ${subId} for user ${sub.user_id}`);
                continue;
              }
            } catch (apiErr: any) {
              this.logger.warn(
                `PayHere API check for sub ${subId} returned error: ${apiErr.message}`,
              );
            }
          }

          // If past due for > 7 days and not reinstated: downgrade to canceled/starter
          if (daysPastDue >= 7) {
            await this.supabase
              .from('subscriptions')
              .update({
                status: 'CANCELLED',
                cancelled_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              })
              .eq('id', sub.id);

            if (sub.user_id) {
              await this.supabase
                .from('profiles')
                .update({
                  plan_tier: 'starter',
                  plan_status: 'canceled',
                  monthly_minutes_allowance: 10,
                  minutes_balance: 10,
                  updated_at: new Date().toISOString(),
                })
                .eq('id', sub.user_id);
            }

            report.pastDueDowngraded++;
            this.logger.log(
              `Downgraded past-due subscription ${sub.id} (user ${sub.user_id}) after ${Math.round(daysPastDue)} days`,
            );
          }
        } catch (itemErr: any) {
          report.errors.push(`Sub ${sub.id}: ${itemErr.message}`);
        }
      }
    }

    // 2. Proactive quota refresh for users who reached their monthly reset date
    const { data: expiredProfiles, error: profileErr } = await this.supabase
      .from('profiles')
      .select('id, plan_tier, plan_status, monthly_minutes_allowance, add_on_minutes_balance, minutes_reset_at')
      .lte('minutes_reset_at', now.toISOString())
      .limit(200);

    if (profileErr) {
      this.logger.error(`Failed to fetch profiles due for quota reset: ${profileErr.message}`);
      report.errors.push(`fetch expired profiles: ${profileErr.message}`);
    } else if (expiredProfiles && expiredProfiles.length > 0) {
      for (const p of expiredProfiles) {
        try {
          const nextResetIso = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString();
          let newBalance = 10;
          let tier = p.plan_tier;
          let status = p.plan_status;

          if (p.plan_tier !== 'starter' && p.plan_status !== 'active') {
            if (p.plan_status === 'canceled') {
              tier = 'starter';
              newBalance = 10 + (p.add_on_minutes_balance || 0);
            } else if (p.plan_status === 'past_due') {
              newBalance = 0 + (p.add_on_minutes_balance || 0);
            }
          } else {
            newBalance = (p.monthly_minutes_allowance || 10) + (p.add_on_minutes_balance || 0);
          }

          await this.supabase
            .from('profiles')
            .update({
              plan_tier: tier,
              plan_status: status,
              minutes_balance: newBalance,
              minutes_reset_at: nextResetIso,
              updated_at: new Date().toISOString(),
            })
            .eq('id', p.id);

          report.quotasReset++;
        } catch (resetErr: any) {
          report.errors.push(`Profile ${p.id}: ${resetErr.message}`);
        }
      }
    }

    // 3. Automated Renewal Charging for ACTIVE tokenized subscriptions due today
    const renewalStats = await this.processAutomatedRenewals();
    report.renewalsAttempted = renewalStats.renewalsAttempted;
    report.renewalsSucceeded = renewalStats.renewalsSucceeded;
    report.renewalsFailed = renewalStats.renewalsFailed;

    // 4. Sweep pending orders between 5 mins and 24 hours old with PayHere Gateway
    const sweepResult = await this.handlePendingOrdersReconciliation();
    report.pendingOrdersSwept = sweepResult.swept;
    report.pendingOrdersRecovered = sweepResult.recovered;

    return report;
  }

  /**
   * Automatically charges recurring renewals for subscriptions due today using PayHere preapproved tokens.
   */
  async processAutomatedRenewals(): Promise<{ renewalsAttempted: number; renewalsSucceeded: number; renewalsFailed: number }> {
    const todayStr = new Date().toISOString().split('T')[0];
    const results = { renewalsAttempted: 0, renewalsSucceeded: 0, renewalsFailed: 0 };

    this.logger.log(`[PayHereRenewals] 🔄 Checking for subscriptions due for renewal on or before ${todayStr}...`);

    const { data: dueSubs, error: subErr } = await this.supabase
      .from('subscriptions')
      .select('*')
      .eq('status', 'ACTIVE')
      .not('customer_token', 'is', null)
      .lte('next_billing_date', todayStr);

    if (subErr) {
      this.logger.error(`[PayHereRenewals] Failed to query due subscriptions: ${subErr.message}`);
      return results;
    }

    if (!dueSubs || dueSubs.length === 0) {
      this.logger.log('[PayHereRenewals] No active tokenized subscriptions due for renewal today.');
      return results;
    }

    this.logger.log(`[PayHereRenewals] Found ${dueSubs.length} subscription(s) due for renewal.`);

    for (const sub of dueSubs) {
      results.renewalsAttempted++;
      try {
        const userId = sub.user_id;
        const planTier = sub.plan_tier;
        const customerToken = sub.customer_token;
        const amount = parseFloat(sub.amount_lkr || '3600');
        const isQuarterly = sub.billing_cycle === '3 Month';
        const cycleDays = isQuarterly ? 90 : 30;
        const allowance = planTier === 'basic' ? 450 : planTier === 'premium' ? 1200 : 600;

        const renewalOrderId = `MAYA-RENEW-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;

        this.logger.log(`[PayHereRenewals] Processing renewal for user ${userId}, plan=${planTier}, amount=${amount} LKR, token=${customerToken.slice(0, 8)}...`);

        const chargeResult = await this.payhereService.executeTokenCharge({
          userId,
          customerToken,
          amount,
          itemName: `Maya AI ${planTier.toUpperCase()} Plan Renewal`,
          orderId: renewalOrderId,
          custom1: userId,
          custom2: planTier,
        });

        if (chargeResult.success) {
          const nextBilling = new Date();
          nextBilling.setDate(nextBilling.getDate() + cycleDays);
          const nextBillingDateStr = nextBilling.toISOString().split('T')[0];

          // Advance subscription billing date & increment installments
          await this.supabase
            .from('subscriptions')
            .update({
              next_billing_date: nextBillingDateStr,
              installments_paid: (sub.installments_paid || 1) + 1,
              last_payment_id: chargeResult.data?.data?.payment_id || renewalOrderId,
              updated_at: new Date().toISOString(),
            })
            .eq('id', sub.id);

          // Refresh user profile minutes allowance
          await this.supabase
            .from('profiles')
            .update({
              plan_status: 'active',
              minutes_balance: allowance,
              minutes_reset_at: nextBilling.toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq('id', userId);

          // Record renewal order entry
          await this.supabase.from('orders').insert({
            user_id: userId,
            subscription_id: sub.id,
            order_type: 'subscription_renewal',
            plan_tier: planTier,
            amount_lkr: amount,
            minutes_credited: allowance,
            payment_gateway: 'payhere_token',
            gateway_payment_id: renewalOrderId,
            status: 'completed',
            raw_payload: chargeResult.data,
          });

          results.renewalsSucceeded++;
          this.logger.log(`[PayHereRenewals] ✅ Renewal succeeded for user ${userId}. Next billing: ${nextBillingDateStr}`);
        } else {
          // Charge failed: mark subscription PAST_DUE
          this.logger.warn(`[PayHereRenewals] ❌ Renewal charge failed for user ${userId}: ${chargeResult.error}`);

          await this.supabase
            .from('subscriptions')
            .update({
              status: 'PAST_DUE',
              updated_at: new Date().toISOString(),
            })
            .eq('id', sub.id);

          await this.supabase
            .from('profiles')
            .update({
              plan_status: 'past_due',
              updated_at: new Date().toISOString(),
            })
            .eq('id', userId);

          await this.supabase.from('orders').insert({
            user_id: userId,
            subscription_id: sub.id,
            order_type: 'subscription_renewal',
            plan_tier: planTier,
            amount_lkr: amount,
            minutes_credited: 0,
            payment_gateway: 'payhere_token',
            gateway_payment_id: renewalOrderId,
            status: 'failed',
            raw_payload: chargeResult.data,
          });

          results.renewalsFailed++;
        }
      } catch (err: any) {
        this.logger.error(`[PayHereRenewals] Error processing renewal for sub ${sub.id}: ${err.message}`);
        results.renewalsFailed++;
      }
    }

    return results;
  }
}
