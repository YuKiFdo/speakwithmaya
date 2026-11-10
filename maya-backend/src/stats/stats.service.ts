import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import * as crypto from 'crypto';

const TIMEZONE = 'Asia/Colombo';
const MAX_RANGE_DAYS = 366;

export interface StatsSummaryResponse {
  ok: boolean;
  generated: string;
  range: { from: string; to: string };
  total: number;
  today: number;
  yesterday: number;
  this_month: number;
  last_month: number;
  last_mtd: number;
  monthly: Record<string, number>;
  daily: Record<string, number>;
}

@Injectable()
export class StatsService {
  private readonly logger = new Logger(StatsService.name);
  private readonly supabase: SupabaseClient;

  // In-memory cache of resolved telco subscription dates
  private cachedTelcoDates: string[] | null = null;
  private cacheExpiresAt = 0;

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
  }

  /* ------------------------------------------------------------ date helpers
   * Calendar dates are held as UTC-midnight Date objects so arithmetic never
   * drifts with the server's own timezone; "today" is computed in Asia/Colombo. */
  private ymd(d: Date): string {
    return d.toISOString().slice(0, 10);
  }

  private addDays(d: Date, n: number): Date {
    return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + n));
  }

  private addMonths(d: Date, n: number): Date {
    return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + n, 1));
  }

  private daysInMonth(d: Date): number {
    return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  }

  private todayInZone(): Date {
    const s = new Intl.DateTimeFormat('en-CA', {
      timeZone: TIMEZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());
    return new Date(`${s}T00:00:00Z`);
  }

  private parseDate(s?: string | null): Date | null {
    if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
    const d = new Date(`${s}T00:00:00Z`);
    return !Number.isNaN(d.getTime()) && this.ymd(d) === s ? d : null;
  }

  private toColomboDateStr(dateInput: string | Date | null | undefined): string | null {
    if (!dateInput) return null;
    const d = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
    if (isNaN(d.getTime())) return null;
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: TIMEZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(d);
  }

  /**
   * Constant-time API Key verification against configured dashboard key.
   */
  validateDashboardKey(given?: string): boolean {
    const expected =
      this.config.get<string>('DASHBOARD_API_KEY') ||
      process.env.DASHBOARD_API_KEY ||
      this.config.get<string>('DASHBOARD_KEY') ||
      process.env.DASHBOARD_KEY ||
      process.env.ADMIN_API_KEY ||
      'maya-telco-stats-dashboard-2026';

    if (!given || typeof given !== 'string' || !expected) {
      return false;
    }

    const cleanGiven = given.replace(/^Bearer\s+/i, '').trim();
    const a = crypto.createHash('sha256').update(cleanGiven).digest();
    const b = crypto.createHash('sha256').update(expected.trim()).digest();
    return crypto.timingSafeEqual(a, b);
  }

  /**
   * Loads all Telco subscribers strictly excluding test accounts, returning their
   * subscription dates formatted as YYYY-MM-DD in Asia/Colombo.
   */
  private async getTelcoSubscriptionDates(): Promise<string[]> {
    const now = Date.now();
    if (this.cachedTelcoDates && now < this.cacheExpiresAt) {
      return this.cachedTelcoDates;
    }

    const [
      { data: profiles, error: profErr },
      { data: telcoVerifs, error: verifErr },
      { data: appSettingsRow },
      { data: subs },
    ] = await Promise.all([
      this.supabase
        .from('profiles')
        .select('id, phone_number, plan_tier, plan_status, billing_cycle, monthly_minutes_allowance, telco_subscriber_id, telco_provider, created_at'),
      this.supabase
        .from('phone_verifications')
        .select('phone_number, otp_hash, is_verified, created_at, verified_at')
        .eq('is_verified', true)
        .like('otp_hash', 'TELCO:%'),
      this.supabase
        .from('roadmap_levels')
        .select('canonical_content')
        .eq('id', 'sys_app_settings')
        .maybeSingle(),
      this.supabase.from('subscriptions').select('user_id, status'),
    ]);

    if (profErr) {
      this.logger.error(`Failed to fetch profiles for stats: ${profErr.message}`);
      throw new Error(`Database error: ${profErr.message}`);
    }

    let appConfig: Record<string, any> = {};
    if (appSettingsRow?.canonical_content) {
      try {
        appConfig = JSON.parse(appSettingsRow.canonical_content);
      } catch {}
    }

    const testPhoneDigitsSet = new Set<string>(
      (Array.isArray(appConfig.testAccounts) ? appConfig.testAccounts : [])
        .map((t: any) => String(t?.phoneNumber || '').replace(/\D/g, ''))
        .filter(Boolean),
    );

    const cardSubByUser = new Map<string, any>();
    for (const s of subs || []) {
      if (!cardSubByUser.has(s.user_id) || s.status === 'ACTIVE') {
        cardSubByUser.set(s.user_id, s);
      }
    }

    const telcoVerifByDigits = new Map<
      string,
      { provider: 'ideamart' | 'mspace'; verifiedAt: string; referenceNo: string }
    >();
    for (const v of telcoVerifs || []) {
      const digits = String(v.phone_number || '').replace(/\D/g, '');
      if (!digits) continue;
      const parts = String(v.otp_hash || '').split(':');
      const prov = (parts[1] === 'mspace' ? 'mspace' : 'ideamart') as 'ideamart' | 'mspace';
      const refNo = parts.slice(2).join(':');
      if (!telcoVerifByDigits.has(digits)) {
        telcoVerifByDigits.set(digits, {
          provider: prov,
          verifiedAt: v.verified_at || v.created_at,
          referenceNo: refNo,
        });
      }
    }

    const isTelcoGatewayActive =
      appConfig.smsGateway === 'ideamart' || appConfig.smsGateway === 'mspace';

    const telcoSubDates: string[] = [];

    for (const prof of profiles || []) {
      const digits = String(prof.phone_number || '').replace(/\D/g, '');

      // Exclude test accounts configured in sys_app_settings or internal test flag (minutes allowance >= 9000)
      if (testPhoneDigitsSet.has(digits) || (prof.monthly_minutes_allowance || 0) >= 9000) {
        continue;
      }

      const verif = digits ? telcoVerifByDigits.get(digits) : undefined;
      const hasExplicitTelco = Boolean(
        prof.telco_subscriber_id || prof.telco_provider || verif,
      );
      const isImplicitTelcoDailyStarter =
        isTelcoGatewayActive &&
        (prof.billing_cycle === 'daily' || prof.plan_tier === 'starter') &&
        !cardSubByUser.has(prof.id);

      if (!hasExplicitTelco && !isImplicitTelcoDailyStarter) {
        continue;
      }

      const subscribedAt = verif?.verifiedAt || prof.created_at;
      const colomboDate = this.toColomboDateStr(subscribedAt);
      if (colomboDate) {
        telcoSubDates.push(colomboDate);
      }
    }

    // Cache results for 60 seconds (matches IDEACIPHER dashboard refresh cycle)
    this.cachedTelcoDates = telcoSubDates;
    this.cacheExpiresAt = Date.now() + 60 * 1000;

    return telcoSubDates;
  }

  /**
   * Produces the exact statistics summary response matching IDEACIPHER dashboard specification.
   */
  async getSummary(fromQuery?: string, toQuery?: string): Promise<StatsSummaryResponse> {
    const today = this.todayInZone();
    const tomorrow = this.addDays(today, 1);
    const yesterday = this.addDays(today, -1);
    const monthStart = this.addMonths(today, 0);
    const lastMonth = this.addMonths(today, -1);
    const lastMtdEnd = this.addDays(
      lastMonth,
      Math.min(today.getUTCDate(), this.daysInMonth(lastMonth)),
    );
    const trendStart = this.addMonths(today, -11);

    const todayStr = this.ymd(today);
    const yesterdayStr = this.ymd(yesterday);
    const tomorrowStr = this.ymd(tomorrow);
    const monthStartStr = this.ymd(monthStart);
    const lastMonthStr = this.ymd(lastMonth);
    const lastMtdEndStr = this.ymd(lastMtdEnd);
    const trendStartStr = this.ymd(trendStart);

    let from = this.parseDate(fromQuery) || monthStart;
    let to = this.parseDate(toQuery) || today;
    if (from > to) [from, to] = [to, from];
    if ((to.getTime() - from.getTime()) / 86400000 > MAX_RANGE_DAYS) {
      from = this.addDays(to, -MAX_RANGE_DAYS);
    }

    const fromStr = this.ymd(from);
    const toStr = this.ymd(to);

    const telcoDates = await this.getTelcoSubscriptionDates();

    let todayCount = 0;
    let yesterdayCount = 0;
    let thisMonthCount = 0;
    let lastMonthCount = 0;
    let lastMtdCount = 0;
    const monthly: Record<string, number> = {};
    const daily: Record<string, number> = {};

    for (const d of telcoDates) {
      if (d === todayStr) todayCount++;
      if (d === yesterdayStr) yesterdayCount++;
      if (d >= monthStartStr && d < tomorrowStr) thisMonthCount++;
      if (d >= lastMonthStr && d < monthStartStr) lastMonthCount++;
      if (d >= lastMonthStr && d < lastMtdEndStr) lastMtdCount++;

      // Last 12 months trend
      if (d >= trendStartStr && d < tomorrowStr) {
        const ym = d.slice(0, 7);
        monthly[ym] = (monthly[ym] || 0) + 1;
      }

      // Daily breakdown for requested range [from, to]
      if (d >= fromStr && d <= toStr) {
        daily[d] = (daily[d] || 0) + 1;
      }
    }

    // Sort monthly keys chronologically
    const sortedMonthly: Record<string, number> = {};
    for (const k of Object.keys(monthly).sort()) {
      sortedMonthly[k] = monthly[k];
    }

    // Sort daily keys chronologically
    const sortedDaily: Record<string, number> = {};
    for (const k of Object.keys(daily).sort()) {
      sortedDaily[k] = daily[k];
    }

    return {
      ok: true,
      generated: new Date().toISOString(),
      range: { from: fromStr, to: toStr },
      total: telcoDates.length,
      today: todayCount,
      yesterday: yesterdayCount,
      this_month: thisMonthCount,
      last_month: lastMonthCount,
      last_mtd: lastMtdCount,
      monthly: sortedMonthly,
      daily: sortedDaily,
    };
  }
}

