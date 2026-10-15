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
    const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

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

    return report;
  }
}
