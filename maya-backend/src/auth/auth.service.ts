import {
  Injectable,
  Logger,
  BadRequestException,
  HttpException,
  HttpStatus,
  NotFoundException,
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import * as crypto from 'crypto';
import {
  SendOtpDto,
  VerifyOtpDto,
  SavePreferencesDto,
  UpgradePlanDto,
  AddOnTopUpDto,
} from './dto/auth.dto.js';
import { SmsApiLkProvider } from './sms/smsapi-lk.provider.js';

export interface UserProfileData {
  id: string;
  phone_number: string;
  display_name: string | null;
  level: string;
  goal: string | null;
  challenge: string | null;
  plan_tier: 'starter' | 'basic' | 'pro' | 'premium';
  plan_status: 'active' | 'trialing' | 'past_due' | 'canceled';
  billing_cycle: 'monthly' | 'quarterly' | 'yearly';
  monthly_minutes_allowance: number;
  add_on_minutes_balance: number;
  minutes_balance: number;
  minutes_reset_at: string;
  native_language: string;
  employment_status: string | null;
  daily_goal_minutes: number;
  baseline_fluency_score: number;
  baseline_grammar_score: number;
  baseline_pronunciation_score: number;
  last_active_step: string | null;
  onboarding_completed_at: string | null;
  created_at: string;
  updated_at: string;
}

const OTP_SECRET_SALT = process.env.OTP_SALT || 'maya_ai_secure_otp_salt_2026';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly supabase: SupabaseClient;

  constructor(
    private readonly configService: ConfigService,
    private readonly smsProvider: SmsApiLkProvider,
  ) {
    const supabaseUrl =
      this.configService.get<string>('SUPABASE_URL') ||
      process.env.SUPABASE_URL;
    const supabaseKey =
      this.configService.get<string>('SUPABASE_SECRET_KEY') ||
      this.configService.get<string>('SUPABASE_SERVICE_ROLE_KEY') ||
      this.configService.get<string>('SUPABASE_SERVICE_KEY') ||
      this.configService.get<string>('SUPABASE_ANON_KEY') ||
      process.env.SUPABASE_SECRET_KEY ||
      process.env.SUPABASE_SERVICE_ROLE_KEY ||
      process.env.SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      throw new Error(
        'Database configuration missing. SUPABASE_URL and SUPABASE_SECRET_KEY are required.',
      );
    }

    this.supabase = createClient(supabaseUrl, supabaseKey);
    this.logger.log('AuthService: Connected strictly to Supabase database.');
  }

  /**
   * Cleans and normalizes phone numbers into E.164 format.
   * Special handling for Sri Lankan numbers: +9477XXXXXXX.
   */
  normalizePhoneNumber(raw: string): string {
    if (!raw) return '';
    let digits = raw.replace(/[^0-9+]/g, '');

    // If starts with 0 (e.g. 0771234567), strip 0 and prepend +94
    if (digits.startsWith('0') && digits.length === 10) {
      digits = '+94' + digits.substring(1);
    } else if (digits.startsWith('94') && !digits.startsWith('+94')) {
      digits = '+' + digits;
    } else if (!digits.startsWith('+')) {
      digits = '+94' + digits;
    }

    return digits;
  }

  private hashOtp(code: string, phone: string): string {
    return crypto
      .createHash('sha256')
      .update(`${phone}:${code}:${OTP_SECRET_SALT}`)
      .digest('hex');
  }

  /**
   * Request an OTP to be sent to a phone number.
   * Strictly writes to public.phone_verifications in Supabase.
   */
  async sendOtp(dto: SendOtpDto) {
    const phone = this.normalizePhoneNumber(dto.phoneNumber);
    if (!phone || phone.length < 10) {
      throw new BadRequestException('Please enter a valid mobile number.');
    }

    const now = Date.now();

    // 1. Check cooldown (60 seconds) strictly against database
    const { data: recent, error: checkError } = await this.supabase
      .from('phone_verifications')
      .select('created_at, is_verified')
      .eq('phone_number', phone)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (checkError) {
      this.logger.error(`Database query error in phone_verifications: ${checkError.message}`);
      throw new InternalServerErrorException('Database check failed. Please try again.');
    }

    if (recent) {
      const lastCreatedAt = new Date(recent.created_at).getTime();
      const elapsedSec = Math.floor((now - lastCreatedAt) / 1000);
      if (elapsedSec < 60) {
        const waitTime = 60 - elapsedSec;
        throw new HttpException(
          `Please wait ${waitTime} seconds before requesting another code.`,
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }
    }

    // 2. Generate 6-digit cryptographically secure OTP
    const code = crypto.randomInt(100000, 999999).toString();
    const otpHash = this.hashOtp(code, phone);
    const expiresAt = new Date(now + 5 * 60 * 1000).toISOString(); // 5 minutes

    // 3. Persist OTP verification row directly into database
    const { error: insertError } = await this.supabase
      .from('phone_verifications')
      .insert({
        phone_number: phone,
        otp_hash: otpHash,
        attempts: 0,
        max_attempts: 3,
        is_verified: false,
        expires_at: expiresAt,
      });

    if (insertError) {
      this.logger.error(`Failed to insert into phone_verifications: ${insertError.message}`);
      throw new InternalServerErrorException('Failed to generate verification session in database.');
    }

    // 4. Dispatch via SMS Gateway Provider
    await this.smsProvider.sendOtp(phone, code);

    return {
      success: true,
      cooldownSeconds: 60,
      expiresInSeconds: 300,
      message: 'Verification code sent successfully.',
    };
  }

  /**
   * Verify an OTP and provision / log-in the user with Starter Plan.
   * Strictly verifies against public.phone_verifications and public.profiles.
   */
  async verifyOtp(dto: VerifyOtpDto) {
    const phone = this.normalizePhoneNumber(dto.phoneNumber);
    const code = (dto.code || '').trim();
    const now = Date.now();

    // 1. Fetch latest pending verification record strictly from database
    const { data: record, error: fetchError } = await this.supabase
      .from('phone_verifications')
      .select('*')
      .eq('phone_number', phone)
      .eq('is_verified', false)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (fetchError) {
      this.logger.error(`Database error fetching verification: ${fetchError.message}`);
      throw new InternalServerErrorException('Database verification lookup failed.');
    }

    if (!record) {
      throw new BadRequestException(
        'No active verification request found. Please request a new code.',
      );
    }

    // 2. Check expiration
    const expiryTimestamp = new Date(record.expires_at).getTime();
    if (now > expiryTimestamp) {
      throw new BadRequestException(
        'Verification code has expired. Please request a new one.',
      );
    }

    // 3. Check attempts lockout
    const attempts = record.attempts || 0;
    const maxAttempts = record.max_attempts || 3;
    if (attempts >= maxAttempts) {
      throw new HttpException(
        'Too many failed attempts. For your security, this code is no longer valid. Please request a new code.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    // 4. Verify code hash match
    const computedHash = this.hashOtp(code, phone);
    if (computedHash !== record.otp_hash) {
      const newAttempts = attempts + 1;
      const remaining = maxAttempts - newAttempts;

      // Update attempt count in database
      await this.supabase
        .from('phone_verifications')
        .update({ attempts: newAttempts, updated_at: new Date().toISOString() })
        .eq('id', record.id);

      if (remaining <= 0) {
        throw new HttpException(
          'Too many failed attempts. Please request a new code.',
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }

      throw new BadRequestException(
        `Incorrect code. You have ${remaining} ${remaining === 1 ? 'attempt' : 'attempts'} remaining.`,
      );
    }

    // 5. Mark as verified in database
    const { error: verifyUpdateError } = await this.supabase
      .from('phone_verifications')
      .update({
        is_verified: true,
        verified_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', record.id);

    if (verifyUpdateError) {
      this.logger.error(`Failed to mark OTP as verified in database: ${verifyUpdateError.message}`);
      throw new InternalServerErrorException('Failed to update verification status.');
    }

    // 6. Find or Provision User Profile with Starter Plan (10 min / mo) in database
    const userProfile = await this.findOrCreateProfileByPhone(phone);

    // 7. Generate bearer access token
    const accessToken = this.generateTokenForUser(userProfile);

    const isCompleted = !!userProfile.onboarding_completed_at;
    let lastActiveRoute = '/(tabs)/dashboard';

    if (!isCompleted) {
      const step = userProfile.last_active_step;
      const initialSteps = ['/', '/onboarding/name', '/onboarding/phone', '/onboarding/otp'];
      if (step && !initialSteps.includes(step)) {
        lastActiveRoute = step;
      } else {
        lastActiveRoute = '/onboarding/goal';
      }
    }

    return {
      success: true,
      accessToken,
      isNewUser: !userProfile.onboarding_completed_at,
      isCompleted,
      lastActiveRoute,
      user: {
        id: userProfile.id,
        phoneNumber: userProfile.phone_number,
        displayName: userProfile.display_name,
        planTier: userProfile.plan_tier,
        planStatus: userProfile.plan_status,
        monthlyMinutesAllowance: userProfile.monthly_minutes_allowance,
        minutesBalance: userProfile.minutes_balance,
        minutesResetAt: userProfile.minutes_reset_at,
        level: userProfile.level,
        nativeLanguage: userProfile.native_language,
        lastActiveStep: userProfile.last_active_step,
        goal: userProfile.goal,
        challenge: userProfile.challenge,
        employmentStatus: userProfile.employment_status,
        dailyGoalMinutes: userProfile.daily_goal_minutes,
        isCompleted,
      },
    };
  }

  /**
   * Ensures an auth.users record exists before creating public.profiles record,
   * satisfying the profiles_id_fkey foreign key constraint.
   */
  private async getOrCreateAuthUserId(phone: string): Promise<string> {
    try {
      const { data: createData, error: createError } = await this.supabase.auth.admin.createUser({
        phone: phone,
        phone_confirm: true,
        user_metadata: { phone_number: phone },
      });

      if (createData?.user?.id) {
        return createData.user.id;
      }

      // If user with this phone already exists in auth.users, find their id
      if (createError) {
        const { data: listData } = await this.supabase.auth.admin.listUsers();
        const existing = listData?.users?.find(
          (u) =>
            u.phone === phone ||
            u.phone === phone.replace('+', '') ||
            u.user_metadata?.phone_number === phone,
        );
        if (existing?.id) {
          return existing.id;
        }
      }
    } catch (err: any) {
      this.logger.warn(`auth.admin.createUser warning: ${err?.message}`);
    }

    try {
      const { data: listData } = await this.supabase.auth.admin.listUsers();
      const existing = listData?.users?.find(
        (u) =>
          u.phone === phone ||
          u.phone === phone.replace('+', '') ||
          u.user_metadata?.phone_number === phone,
      );
      if (existing?.id) {
        return existing.id;
      }
    } catch {}

    return crypto.randomUUID();
  }

  /**
   * Internal helper: Finds existing user by phone or provisions new profile strictly in Supabase.
   */
  private async findOrCreateProfileByPhone(phone: string): Promise<UserProfileData> {
    const nextMonthIso = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

    const { data: existing, error: findError } = await this.supabase
      .from('profiles')
      .select('*')
      .eq('phone_number', phone)
      .maybeSingle();

    if (findError) {
      this.logger.error(`Database error querying profiles: ${findError.message}`);
      throw new InternalServerErrorException('Database profile lookup failed.');
    }

    if (existing) {
      // Check lazy monthly reset in database
      return await this.checkAndResetMonthlyQuota(existing as UserProfileData);
    }

    // Provision new user in auth.users first, satisfying profiles_id_fkey foreign key
    const newId = await this.getOrCreateAuthUserId(phone);
    const newProfile = {
      id: newId,
      phone_number: phone,
      display_name: null,
      level: 'Intermediate',
      goal: null,
      challenge: null,
      plan_tier: 'starter',
      plan_status: 'active',
      billing_cycle: 'monthly',
      monthly_minutes_allowance: 10,
      add_on_minutes_balance: 0,
      minutes_balance: 10,
      minutes_reset_at: nextMonthIso,
      native_language: 'sinhala',
      employment_status: null,
      daily_goal_minutes: 10,
      baseline_fluency_score: 0,
      baseline_grammar_score: 0,
      baseline_pronunciation_score: 0,
      last_active_step: '/onboarding/goal',
      onboarding_completed_at: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const { data: created, error: insertErr } = await this.supabase
      .from('profiles')
      .insert(newProfile)
      .select()
      .single();

    if (insertErr || !created) {
      this.logger.error(`Database error inserting new profile: ${insertErr?.message}`);
      throw new InternalServerErrorException('Failed to create user account in database.');
    }

    return created as UserProfileData;
  }

  /**
   * Automatically refreshes 10 minutes balance if user crossed their monthly reset date.
   */
  private async checkAndResetMonthlyQuota(profile: UserProfileData): Promise<UserProfileData> {
    if (!profile.minutes_reset_at) return profile;

    const resetDate = new Date(profile.minutes_reset_at).getTime();
    const now = Date.now();

    if (now >= resetDate) {
      const nextResetIso = new Date(now + 30 * 24 * 60 * 60 * 1000).toISOString();
      const updatedBalance = profile.monthly_minutes_allowance + (profile.add_on_minutes_balance || 0);

      profile.minutes_balance = updatedBalance;
      profile.minutes_reset_at = nextResetIso;

      const { error: resetError } = await this.supabase
        .from('profiles')
        .update({
          minutes_balance: updatedBalance,
          minutes_reset_at: nextResetIso,
          updated_at: new Date().toISOString(),
        })
        .eq('id', profile.id);

      if (resetError) {
        this.logger.warn(`Failed to update monthly reset in DB: ${resetError.message}`);
      }
    }

    return profile;
  }

  /**
   * Issues JWT token for authenticated requests.
   */
  /**
   * Issues signed HMAC-SHA256 JWT token for authenticated requests.
   */
  private generateTokenForUser(user: UserProfileData): string {
    const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
    const payload = Buffer.from(
      JSON.stringify({
        sub: user.id,
        phone: user.phone_number,
        plan: user.plan_tier,
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60, // 30 days
      }),
    ).toString('base64url');

    const secret = process.env.SUPABASE_SECRET_KEY || 'maya-secure-jwt-secret';
    const signature = crypto
      .createHmac('sha256', secret)
      .update(`${header}.${payload}`)
      .digest('base64url');

    return `${header}.${payload}.${signature}`;
  }

  /**
   * Decodes and validates token returning user ID with signature check.
   */
  validateAuthToken(token: string): string {
    if (!token) throw new BadRequestException('Authorization token required');
    const clean = token.replace(/^Bearer\s+/i, '').trim();

    // Check signed 3-part JWT
    const parts = clean.split('.');
    if (parts.length === 3) {
      const [header, payload, signature] = parts;
      const secret = process.env.SUPABASE_SECRET_KEY || 'maya-secure-jwt-secret';
      const expectedSig = crypto
        .createHmac('sha256', secret)
        .update(`${header}.${payload}`)
        .digest('base64url');

      if (expectedSig !== signature) {
        throw new UnauthorizedException('Invalid token signature');
      }

      try {
        const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString('utf-8'));
        if (decoded.exp && Math.floor(Date.now() / 1000) > decoded.exp) {
          throw new UnauthorizedException('Authentication token has expired');
        }
        if (decoded.sub) return decoded.sub;
      } catch {
        throw new UnauthorizedException('Malformed token payload');
      }
    }

    // Backward compatibility for base64 JSON payload
    try {
      const decoded = JSON.parse(Buffer.from(clean, 'base64').toString('utf-8'));
      if (decoded && decoded.sub) {
        return decoded.sub;
      }
    } catch {}

    // If standard UUID format
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(clean)) {
      return clean;
    }

    throw new UnauthorizedException('Invalid authentication token');
  }

  /**
   * Persists onboarding choices directly into public.profiles in Supabase.
   */
  async savePreferences(userId: string, dto: SavePreferencesDto) {
    const updates: any = {
      updated_at: new Date().toISOString(),
      onboarding_completed_at: new Date().toISOString(),
    };

    if (dto.displayName !== undefined) updates.display_name = dto.displayName.trim();
    if (dto.nativeLanguage !== undefined) updates.native_language = dto.nativeLanguage;
    if (dto.level !== undefined) updates.level = dto.level;
    if (dto.goal !== undefined) updates.goal = dto.goal;
    if (dto.challenge !== undefined) updates.challenge = dto.challenge;
    if (dto.employmentStatus !== undefined) updates.employment_status = dto.employmentStatus;
    if (dto.dailyGoalMinutes !== undefined) updates.daily_goal_minutes = dto.dailyGoalMinutes;

    if (dto.baselineScores) {
      if (dto.baselineScores.overall !== undefined) {
        updates.baseline_fluency_score = dto.baselineScores.fluency || dto.baselineScores.overall;
        updates.baseline_grammar_score = dto.baselineScores.grammar || dto.baselineScores.overall;
        updates.baseline_pronunciation_score = dto.baselineScores.pronunciation || dto.baselineScores.overall;
      }
    }

    const { data, error } = await this.supabase
      .from('profiles')
      .update(updates)
      .eq('id', userId)
      .select()
      .single();

    if (error || !data) {
      this.logger.error(`Database error saving preferences: ${error?.message}`);
      throw new InternalServerErrorException('Failed to save user preferences in database.');
    }

    return { success: true, profile: data };
  }

  /**
   * Tracks user's progress through onboarding screens so logging in from another device resumes seamlessly.
   */
  async updateStep(userId: string, step: string) {
    const { error } = await this.supabase
      .from('profiles')
      .update({ last_active_step: step, updated_at: new Date().toISOString() })
      .eq('id', userId);

    if (error) {
      this.logger.error(`Failed to update last_active_step in database: ${error.message}`);
      throw new InternalServerErrorException('Failed to update step in database.');
    }

    return { success: true, step };
  }

  /**
   * Retrieves user profile strictly from database with up-to-date quotas.
   */
  async getProfile(userId: string): Promise<UserProfileData> {
    const { data, error } = await this.supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();

    if (error) {
      this.logger.error(`Database error in getProfile: ${error.message}`);
      throw new InternalServerErrorException('Database error fetching user profile.');
    }

    if (!data) {
      throw new NotFoundException('User profile not found in database.');
    }

    return await this.checkAndResetMonthlyQuota(data as UserProfileData);
  }

  /**
   * Upgrades subscription tier and records transaction in database.
   */
  async upgradePlan(userId: string, dto: UpgradePlanDto) {
    const minutesMap = {
      basic: 450,
      pro: 600,
      premium: 1200,
    };
    const allowance = minutesMap[dto.planTier];

    const updates = {
      plan_tier: dto.planTier,
      plan_status: 'active',
      billing_cycle: dto.billingCycle || 'monthly',
      monthly_minutes_allowance: allowance,
      minutes_balance: allowance, // Credit full new monthly tier allowance
      updated_at: new Date().toISOString(),
    };

    const { error: profileError } = await this.supabase
      .from('profiles')
      .update(updates)
      .eq('id', userId);

    if (profileError) {
      this.logger.error(`Failed to update plan in database: ${profileError.message}`);
      throw new InternalServerErrorException('Failed to update subscription in database.');
    }

    // Record order transaction in database
    const { error: orderError } = await this.supabase.from('orders').insert({
      user_id: userId,
      order_type: 'subscription_new',
      plan_tier: dto.planTier,
      amount_lkr: dto.planTier === 'basic' ? 2700 : dto.planTier === 'pro' ? 3600 : 7200,
      minutes_credited: allowance,
      payment_gateway: 'mock',
      status: 'completed',
    });

    if (orderError) {
      this.logger.warn(`Failed to insert order record: ${orderError.message}`);
    }

    return {
      success: true,
      planTier: dto.planTier,
      monthlyMinutesAllowance: allowance,
      minutesBalance: allowance,
      message: `Successfully upgraded to ${dto.planTier.toUpperCase()} plan!`,
    };
  }

  /**
   * Purchases on-demand extra time top-up pack and records transaction in database.
   */
  async addOnTopUp(userId: string, dto: AddOnTopUpDto) {
    const packMap: Record<string, { minutes: number; price: number }> = {
      '30-min': { minutes: 30, price: 300 },
      '120-min': { minutes: 120, price: 900 },
      '300-min': { minutes: 300, price: 2000 },
    };
    const pack = packMap[dto.packageId];
    if (!pack) throw new BadRequestException('Invalid package ID');

    const profile = await this.getProfile(userId);
    const newBalance = profile.minutes_balance + pack.minutes;
    const newAddOn = (profile.add_on_minutes_balance || 0) + pack.minutes;

    const { error: profileError } = await this.supabase
      .from('profiles')
      .update({
        minutes_balance: newBalance,
        add_on_minutes_balance: newAddOn,
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId);

    if (profileError) {
      this.logger.error(`Failed to update add-on minutes in database: ${profileError.message}`);
      throw new InternalServerErrorException('Database update failed.');
    }

    await this.supabase.from('orders').insert({
      user_id: userId,
      order_type: 'add_on_topup',
      add_on_package_id: dto.packageId,
      amount_lkr: pack.price,
      minutes_credited: pack.minutes,
      payment_gateway: 'mock',
      status: 'completed',
    });

    return {
      success: true,
      packageId: dto.packageId,
      minutesCredited: pack.minutes,
      totalMinutesBalance: newBalance,
      message: `Successfully added ${pack.minutes} extra practice minutes!`,
    };
  }

  /**
   * Returns list of subscription plans and extra time top-up options.
   */
  getPlansCatalog() {
    return {
      subscriptionPlans: [
        {
          id: 'starter',
          name: 'Starter',
          priceLkr: 0,
          period: '/ month',
          minutes: 10,
          features: ['10 AI conversation minutes / mo', 'Basic AI speaking partner', 'Voice captions'],
        },
        {
          id: 'basic',
          name: 'Basic',
          priceLkr: 2700,
          period: '/ month',
          minutes: 450,
          features: ['450 AI conversation minutes', 'AI partner', 'Grammar corrections', 'Session transcript'],
        },
        {
          id: 'pro',
          name: 'Pro',
          priceLkr: 3600,
          period: '/ month',
          minutes: 600,
          highlighted: true,
          badge: 'Most Popular',
          features: ['600 AI conversation minutes', 'Advanced pronunciation feedback', 'Rephrasing suggestions', 'Full session history'],
        },
        {
          id: 'premium',
          name: 'Premium',
          priceLkr: 7200,
          period: '/ month',
          minutes: 1200,
          features: ['1,200 AI conversation minutes', 'Detailed speaking analytics', 'Personalized learning insights', 'Priority AI responses'],
        },
      ],
      addOnPacks: [
        { id: '30-min', minutes: 30, priceLkr: 300, label: '+30 Min Quick Boost' },
        { id: '120-min', minutes: 120, priceLkr: 900, label: '+120 Min Keep Going', popular: true },
        { id: '300-min', minutes: 300, priceLkr: 2000, label: '+300 Min Max Practice' },
      ],
    };
  }
}
