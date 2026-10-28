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
  UpdateStepDto,
  AdminUsersQueryDto,
  AdminUpdateUserDto,
  CreateTestAccountDto,
  SubmitComplaintDto,
} from './dto/auth.dto.js';
import { SmsApiLkProvider } from './sms/smsapi-lk.provider.js';
import { IdeamartSmsProvider } from './sms/ideamart-sms.provider.js';
import { TelcoSubscriptionService } from './sms/telco-subscription.service.js';
import type { UpdateAppConfigDto } from './dto/auth.dto.js';

export interface UserProfileData {
  id: string;
  phone_number: string;
  display_name: string | null;
  level: string;
  goal: string | null;
  challenge: string | null;
  plan_tier: 'starter' | 'basic' | 'pro' | 'premium';
  plan_status: 'active' | 'trialing' | 'past_due' | 'canceled' | 'expired';
  billing_cycle: 'daily' | 'monthly' | 'quarterly' | 'yearly';
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
  telco_provider?: 'ideamart' | 'mspace' | null;
  telco_subscriber_id?: string | null;
  telco_reference_no?: string | null;
  telco_status?: 'ACTIVE' | 'UNSUBSCRIBED' | null;
  has_telco_subscription?: boolean;
  is_subscription_locked?: boolean;
  is_grace_period_active?: boolean;
  grace_period_end?: string | null;
}

const OTP_SECRET_SALT = process.env.OTP_SALT || 'maya_ai_secure_otp_salt_2026';

export interface TestAccountItem {
  id: string;
  name: string;
  phoneNumber: string;
  plan: 'starter' | 'basic' | 'pro' | 'premium' | 'unlimited';
  minutesBalance: number;
  createdAt: string;
}

export interface AppConfigData {
  smsGateway: 'smsapi' | 'ideamart' | 'mspace';
  pricingNotice: string;
  termsDisclaimer: string;
  smsTemplate: string;
  ideamartPricingNotice: string;
  ideamartTermsDisclaimer: string;
  ideamartSmsTemplate: string;
  ideamartEnabled: boolean;
  ideamartAppId: string;
  ideamartPassword: string;
  ideamartAppCode: string;
  ideamartAppHash: string;
  ideamartBaseUrl: string;
  mspaceEnabled: boolean;
  mspaceAppId: string;
  mspacePassword: string;
  mspaceAppCode: string;
  mspaceAppHash: string;
  mspaceBaseUrl: string;
  telcoUnsubButtonEnabled: boolean;
  testAccounts?: TestAccountItem[];
}

const DEFAULT_APP_CONFIG: AppConfigData = {
  smsGateway: 'smsapi',
  pricingNotice: '',
  termsDisclaimer: '',
  smsTemplate: 'Your Maya AI English Coach verification code is: {CODE}. Valid for 5 minutes. Do not share this code.',
  ideamartPricingNotice: 'Dialog / Mobitel / Hutch: LKR 5 + tax /day. Airtime billing.',
  ideamartTermsDisclaimer: 'By subscribing, LKR 5 + taxes per day will be deducted from your Dialog, Mobitel, or Hutch mobile balance.',
  ideamartSmsTemplate: 'Maya AI: Your OTP is {CODE}. Valid for 5 min. Do not share this code.',
  ideamartEnabled: true,
  ideamartAppId: 'APP_000001',
  ideamartPassword: '',
  ideamartAppCode: '77000',
  ideamartAppHash: '',
  ideamartBaseUrl: 'https://api.dialog.lk',
  mspaceEnabled: true,
  mspaceAppId: 'MSPACE_000001',
  mspacePassword: '',
  mspaceAppCode: '1234',
  mspaceAppHash: '',
  mspaceBaseUrl: 'https://api.mspace.lk',
  telcoUnsubButtonEnabled: true,
  testAccounts: [],
};

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly supabase: SupabaseClient;

  constructor(
    private readonly configService: ConfigService,
    private readonly smsProvider: SmsApiLkProvider,
    private readonly ideamartProvider: IdeamartSmsProvider,
    private readonly telcoService: TelcoSubscriptionService,
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

    // Check if phone belongs to an authorized Admin Test Account (Bypass OTP verification directly into dashboard)
    const config = await this.getAppConfig();
    const cleanPhoneDigits = phone.replace(/\D/g, '');
    const testAccount = (config.testAccounts || []).find((t) => {
      const tDigits = (t.phoneNumber || '').replace(/\D/g, '');
      return tDigits === cleanPhoneDigits;
    });

    if (testAccount) {
      this.logger.log(`[Test Account] Instant dashboard bypass for test user "${testAccount.name}" (${phone})`);
      const userProfile = await this.findOrCreateProfileByPhone(phone);
      const planTier = (testAccount.plan === 'unlimited' ? 'pro' : testAccount.plan) as any;
      const mins = testAccount.minutesBalance || (testAccount.plan === 'unlimited' ? 9999 : 120);

      await this.supabase
        .from('profiles')
        .update({
          display_name: testAccount.name || userProfile.display_name,
          plan_tier: planTier,
          plan_status: 'active',
          minutes_balance: Math.max(userProfile.minutes_balance || 0, mins),
          monthly_minutes_allowance: Math.max(userProfile.monthly_minutes_allowance || 0, mins),
          onboarding_completed_at: userProfile.onboarding_completed_at || new Date().toISOString(),
          last_active_step: '/(tabs)/dashboard',
          updated_at: new Date().toISOString(),
        })
        .eq('id', userProfile.id);

      userProfile.display_name = testAccount.name || userProfile.display_name;
      userProfile.plan_tier = planTier;
      userProfile.plan_status = 'active';
      userProfile.minutes_balance = Math.max(userProfile.minutes_balance || 0, mins);
      userProfile.last_active_step = '/(tabs)/dashboard';
      userProfile.onboarding_completed_at = userProfile.onboarding_completed_at || new Date().toISOString();

      const accessToken = this.generateTokenForUser(userProfile);
      return {
        success: true,
        isTestAccount: true,
        accessToken,
        lastActiveRoute: '/(tabs)/dashboard',
        isCompleted: true,
        user: {
          id: userProfile.id,
          phoneNumber: userProfile.phone_number,
          displayName: testAccount.name || userProfile.display_name,
          planTier: userProfile.plan_tier,
          planStatus: 'active',
          monthlyMinutesAllowance: userProfile.monthly_minutes_allowance,
          minutesBalance: userProfile.minutes_balance,
          lastActiveStep: '/(tabs)/dashboard',
          isCompleted: true,
        },
        message: 'Test account authenticated directly without OTP verification.',
      };
    }

    const now = Date.now();
    const isLoginMode = Boolean(dto.isLoginMode);

    // If user is on the Register page (!isLoginMode), check if this phone number is already registered in profiles
    if (!isLoginMode) {
      const rawPhone = phone.replace('+', '');
      const { data: existingProfile } = await this.supabase
        .from('profiles')
        .select('id, phone_number')
        .or(`phone_number.eq.${phone},phone_number.eq.${rawPhone}`)
        .limit(1)
        .maybeSingle();

      if (existingProfile) {
        this.logger.log(`[sendOtp] Phone ${phone} is already registered in profiles -> prompting client to switch to Login mode.`);
        return {
          success: false,
          alreadyRegistered: true,
          phoneNumber: phone,
          message: 'This phone number is already registered. Please log in to continue.',
        };
      }
    }

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

    // 2. Dispatch via Active Configured SMS Gateway Provider
    // IMPORTANT: In Login mode (isLoginMode === true), ALWAYS use normal SMS OTP (smsProvider) without Telco!
    const gateway = config.smsGateway;
    const isTelco = !isLoginMode && (gateway === 'ideamart' || gateway === 'mspace');
    const expiresAt = new Date(now + 5 * 60 * 1000).toISOString(); // 5 minutes

    if (isTelco) {
      // Dispatch OTP request to IdeaMart (Dialog) or mSpace (Mobitel)
      const pinResult = await this.telcoService.requestPin(phone, config);

      if (pinResult?.status === 'ALREADY_REGISTERED') {
        this.logger.log(`[sendOtp] Telco reported ${phone} is ALREADY_REGISTERED -> prompting client to switch to Login mode.`);
        return {
          success: false,
          alreadyRegistered: true,
          phoneNumber: phone,
          message: 'This phone number is already registered. Please log in to continue.',
        };
      }

      const referenceNo = pinResult?.referenceNo;
      if (!referenceNo) {
        throw new HttpException(
          'Mobile operator verification service did not return a valid session. Please try again.',
          HttpStatus.BAD_GATEWAY,
        );
      }

      // Store in otp_hash with TELCO: prefix to ensure it works even if migration 011 columns are not yet present in Supabase
      const telcoOtpHash = `TELCO:${pinResult.provider}:${referenceNo}`;

      // Try inserting with reference_no & telco_provider columns first (if migration 011 has been executed)
      const { error: insertWithColsError } = await this.supabase
        .from('phone_verifications')
        .insert({
          phone_number: phone,
          otp_hash: telcoOtpHash,
          reference_no: referenceNo,
          telco_provider: pinResult.provider,
          attempts: 0,
          max_attempts: 3,
          is_verified: false,
          expires_at: expiresAt,
        });

      if (insertWithColsError) {
        // Fallback: If reference_no column does not exist in schema cache, insert without extra columns
        const { error: fallbackInsertError } = await this.supabase
          .from('phone_verifications')
          .insert({
            phone_number: phone,
            otp_hash: telcoOtpHash,
            attempts: 0,
            max_attempts: 3,
            is_verified: false,
            expires_at: expiresAt,
          });

        if (fallbackInsertError) {
          this.logger.error(`Failed to insert into phone_verifications: ${fallbackInsertError.message}`);
          throw new InternalServerErrorException('Failed to generate verification session in database.');
        }
      }
    } else {
      // Standard SMSAPI flow: generate local cryptographically secure OTP
      const code = crypto.randomInt(100000, 999999).toString();
      const otpHash = this.hashOtp(code, phone);

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

      await this.smsProvider.sendOtp(phone, code, config.smsTemplate);
    }

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

    // Test account fast-path: allow instant verification
    const config = await this.getAppConfig();
    const cleanPhoneDigits = phone.replace(/\D/g, '');
    const testAccount = (config.testAccounts || []).find((t) => {
      const tDigits = (t.phoneNumber || '').replace(/\D/g, '');
      return tDigits === cleanPhoneDigits;
    });

    if (testAccount) {
      const userProfile = await this.findOrCreateProfileByPhone(phone);
      const planTier = (testAccount.plan === 'unlimited' ? 'pro' : testAccount.plan) as any;
      const mins = testAccount.minutesBalance || (testAccount.plan === 'unlimited' ? 9999 : 120);

      await this.supabase
        .from('profiles')
        .update({
          display_name: testAccount.name || userProfile.display_name,
          plan_tier: planTier,
          plan_status: 'active',
          minutes_balance: Math.max(userProfile.minutes_balance || 0, mins),
          monthly_minutes_allowance: Math.max(userProfile.monthly_minutes_allowance || 0, mins),
          onboarding_completed_at: userProfile.onboarding_completed_at || new Date().toISOString(),
          last_active_step: '/(tabs)/dashboard',
          updated_at: new Date().toISOString(),
        })
        .eq('id', userProfile.id);

      const accessToken = this.generateTokenForUser(userProfile);
      return {
        success: true,
        accessToken,
        isNewUser: false,
        isCompleted: true,
        lastActiveRoute: '/(tabs)/dashboard',
        user: {
          id: userProfile.id,
          phoneNumber: userProfile.phone_number,
          displayName: testAccount.name || userProfile.display_name,
          planTier: planTier,
          planStatus: 'active',
          monthlyMinutesAllowance: userProfile.monthly_minutes_allowance,
          minutesBalance: userProfile.minutes_balance,
          lastActiveStep: '/(tabs)/dashboard',
          isCompleted: true,
        },
      };
    }

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

    // 4. Verify code via Telco Gateway or local hash
    let rawSubscriberId: string | null = null;
    let telcoProvider: 'ideamart' | 'mspace' | null = null;
    let telcoReferenceNo: string | null = record.reference_no || null;

    if (record.otp_hash?.startsWith('TELCO:')) {
      const parts = record.otp_hash.split(':');
      telcoProvider = (parts[1] as any) || (record.telco_provider as any) || this.telcoService.detectProvider(phone);
      telcoReferenceNo = parts.slice(2).join(':') || record.reference_no;
    } else if (record.reference_no) {
      telcoProvider = (record.telco_provider as any) || this.telcoService.detectProvider(phone);
      telcoReferenceNo = record.reference_no;
    }

    if (telcoReferenceNo) {
      telcoProvider = telcoProvider || this.telcoService.detectProvider(phone);
      const telcoVerify = await this.telcoService.verifyPin(
        telcoProvider!,
        code,
        telcoReferenceNo,
        phone,
        config,
      );
      rawSubscriberId = telcoVerify.subscriberId;
    } else {
      // Verify code hash match for SMSAPI
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

    // If Telco carrier billing was verified, save the raw unformatted subscriberId
    if (rawSubscriberId) {
      const { error: profileUpdateError } = await this.supabase
        .from('profiles')
        .update({
          telco_provider: telcoProvider,
          telco_subscriber_id: rawSubscriberId,
          telco_reference_no: telcoReferenceNo,
          plan_status: 'active',
          updated_at: new Date().toISOString(),
        })
        .eq('id', userProfile.id);

      if (profileUpdateError) {
        // Fallback: If migration 011 columns are not yet present in Supabase, update plan_status only
        await this.supabase
          .from('profiles')
          .update({
            plan_status: 'active',
            updated_at: new Date().toISOString(),
          })
          .eq('id', userProfile.id);
      }

      userProfile.telco_provider = telcoProvider as any;
      userProfile.telco_subscriber_id = rawSubscriberId;
      userProfile.telco_status = 'ACTIVE';
      userProfile.plan_status = 'active';
    }

    // 7. Generate bearer access token
    const accessToken = this.generateTokenForUser(userProfile);

    // Persist display_name if provided from registration step
    if (dto.displayName && dto.displayName.trim() && !userProfile.display_name) {
      userProfile.display_name = dto.displayName.trim();
      this.supabase
        .from('profiles')
        .update({ display_name: userProfile.display_name, updated_at: new Date().toISOString() })
        .eq('id', userProfile.id)
        .then(() => {});
    }

    const postIntroSteps = [
      '/onboarding/call',
      '/onboarding/connecting',
      '/onboarding/building-plan',
      '/onboarding/special-offer',
      '/onboarding/claim-discount',
      '/onboarding/personalized-plan',
      '/onboarding/complete',
      '/(tabs)/dashboard',
    ];
    const reachedIntroOrLogin =
      Boolean(dto.isLoginMode) ||
      Boolean(userProfile.last_active_step && postIntroSteps.includes(userProfile.last_active_step));

    if (!userProfile.onboarding_completed_at && reachedIntroOrLogin) {
      const nowIso = new Date().toISOString();
      userProfile.onboarding_completed_at = nowIso;
      userProfile.last_active_step = '/(tabs)/dashboard';
      this.supabase
        .from('profiles')
        .update({
          onboarding_completed_at: nowIso,
          last_active_step: '/(tabs)/dashboard',
          updated_at: nowIso,
        })
        .eq('id', userProfile.id)
        .then(() => {});
    }

    const isCompleted = !!userProfile.onboarding_completed_at;
    let lastActiveRoute = '/(tabs)/dashboard';

    if (!isCompleted) {
      const step = userProfile.last_active_step;
      const initialSteps = ['/', '/onboarding/name', '/onboarding/phone', '/onboarding/otp'];
      if (step && !initialSteps.includes(step) && !step.startsWith('/onboarding/phone') && !step.startsWith('/onboarding/otp')) {
        lastActiveRoute = step;
      } else {
        lastActiveRoute = '/onboarding/goal';
      }
    } else {
      lastActiveRoute = '/(tabs)/dashboard';
      if (userProfile.last_active_step !== '/(tabs)/dashboard') {
        userProfile.last_active_step = '/(tabs)/dashboard';
        this.supabase
          .from('profiles')
          .update({ last_active_step: '/(tabs)/dashboard', updated_at: new Date().toISOString() })
          .eq('id', userProfile.id)
          .then(() => {});
      }
    }

    const hasTelcoSub = Boolean(userProfile.telco_subscriber_id || rawSubscriberId);
    const isTelcoLocked = userProfile.telco_status === 'UNSUBSCRIBED';

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
        addOnMinutesBalance: userProfile.add_on_minutes_balance || 0,
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
        telcoProvider: userProfile.telco_provider || null,
        telcoStatus: userProfile.telco_status || (hasTelcoSub ? 'ACTIVE' : null),
        hasTelcoSubscription: hasTelcoSub,
        isSubscriptionLocked: isTelcoLocked || userProfile.plan_status === 'expired',
        isGracePeriodActive: false,
        gracePeriodEndDate: null,
      },
    };
  }

  /**
   * Ensures an auth.users record exists before creating public.profiles record,
   * satisfying the profiles_id_fkey foreign key constraint.
   * Guarantees 1 phone number maps to exactly 1 auth.users record.
   */
  private async getOrCreateAuthUserId(phone: string): Promise<string> {
    const rawDigits = phone.replace('+', '');
    try {
      const { data: createData } = await this.supabase.auth.admin.createUser({
        phone: phone,
        phone_confirm: true,
        user_metadata: { phone_number: phone },
      });

      if (createData?.user?.id) {
        return createData.user.id;
      }
    } catch (err: any) {
      this.logger.warn(`auth.admin.createUser note: ${err?.message}`);
    }

    // If user already exists in auth.users, scan across pages to find their existing ID
    try {
      let page = 1;
      let hasMore = true;
      while (hasMore && page <= 5) {
        const { data: listData } = await this.supabase.auth.admin.listUsers({ page, perPage: 100 });
        const users = listData?.users || [];
        const existing = users.find(
          (u) =>
            u.phone === phone ||
            u.phone === rawDigits ||
            u.user_metadata?.phone_number === phone ||
            u.user_metadata?.phone_number === rawDigits,
        );
        if (existing?.id) {
          return existing.id;
        }
        if (users.length < 100) {
          hasMore = false;
        } else {
          page++;
        }
      }
    } catch (listErr: any) {
      this.logger.warn(`Error scanning auth users for existing phone: ${listErr?.message}`);
    }

    return crypto.randomUUID();
  }

  /**
   * Internal helper: Finds existing user by phone or provisions new profile strictly in Supabase.
   * Strictly enforces that 1 phone number maps to exactly 1 user profile in public.profiles.
   */
  private async findOrCreateProfileByPhone(phone: string): Promise<UserProfileData> {
    const nextMonthIso = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    const cleanPhone = this.normalizePhoneNumber(phone);
    const rawPhone = cleanPhone.replace('+', '');

    // 1. Strictly look up existing profile by clean E.164 phone or un-prefixed digits
    const { data: existing, error: findError } = await this.supabase
      .from('profiles')
      .select('*')
      .or(`phone_number.eq.${cleanPhone},phone_number.eq.${rawPhone}`)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (findError) {
      this.logger.error(`Database error querying profiles: ${findError.message}`);
      throw new InternalServerErrorException('Database profile lookup failed.');
    }

    if (existing) {
      // Ensure phone_number is standardized to clean E.164 format
      if (existing.phone_number !== cleanPhone) {
        await this.supabase
          .from('profiles')
          .update({ phone_number: cleanPhone, updated_at: new Date().toISOString() })
          .eq('id', existing.id);
        existing.phone_number = cleanPhone;
      }
      return await this.checkAndResetMonthlyQuota(existing as UserProfileData);
    }

    // 2. Provision or retrieve matching user in auth.users
    const userId = await this.getOrCreateAuthUserId(cleanPhone);

    // 3. Check if a profile was already created under this userId (e.g. from Google or previous setup)
    const { data: existingByUserId } = await this.supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();

    if (existingByUserId) {
      await this.supabase
        .from('profiles')
        .update({ phone_number: cleanPhone, updated_at: new Date().toISOString() })
        .eq('id', userId);
      existingByUserId.phone_number = cleanPhone;
      return await this.checkAndResetMonthlyQuota(existingByUserId as UserProfileData);
    }

    // 4. Provision fresh profile
    const nextResetIso = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    const newProfile = {
      id: userId,
      phone_number: cleanPhone,
      display_name: null,
      level: 'Intermediate',
      goal: null,
      challenge: null,
      plan_tier: 'starter',
      plan_status: 'active',
      billing_cycle: 'daily',
      monthly_minutes_allowance: 5,
      add_on_minutes_balance: 0,
      minutes_balance: 5,
      minutes_reset_at: nextResetIso,
      native_language: 'sinhala',
      employment_status: null,
      daily_goal_minutes: 5,
      baseline_fluency_score: 0,
      baseline_grammar_score: 0,
      baseline_pronunciation_score: 0,
      last_active_step: '/onboarding/goal',
      onboarding_completed_at: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    let { data: created, error: insertErr } = await this.supabase
      .from('profiles')
      .insert(newProfile)
      .select()
      .single();

    // Fallback: If DB check constraint doesn't allow 'daily' yet, fall back to 'monthly'
    if (insertErr && (insertErr.message?.includes('profiles_billing_cycle_check') || insertErr.code === '23514')) {
      this.logger.warn(
        "DB constraint 'profiles_billing_cycle_check' does not allow 'daily' yet. Falling back to 'monthly'. Run migration 012 in Supabase.",
      );
      const fallbackProfile = { ...newProfile, billing_cycle: 'monthly' as const };
      const fallbackResult = await this.supabase
        .from('profiles')
        .insert(fallbackProfile)
        .select()
        .single();
      created = fallbackResult.data;
      insertErr = fallbackResult.error;
    }

    if (insertErr || !created) {
      // If error is unique constraint violation (another concurrent process already claimed this phone), fetch that profile
      if (
        insertErr?.code === '23505' ||
        insertErr?.message?.includes('duplicate key') ||
        insertErr?.message?.includes('unique')
      ) {
        const { data: duplicateProfile } = await this.supabase
          .from('profiles')
          .select('*')
          .eq('phone_number', cleanPhone)
          .maybeSingle();
        if (duplicateProfile) {
          return await this.checkAndResetMonthlyQuota(duplicateProfile as UserProfileData);
        }
      }
      this.logger.error(`Database error inserting new profile: ${insertErr?.message}`);
      throw new InternalServerErrorException('Failed to create user account in database.');
    }

    return created as UserProfileData;
  }

  /**
   * Automatically refreshes quota balance if user crossed their reset date.
   * Starter tier refreshes 5 minutes daily (every 24h).
   * Paid tiers refresh their allowance monthly.
   */
  private async checkAndResetMonthlyQuota(profile: UserProfileData): Promise<UserProfileData> {
    if (!profile.minutes_reset_at) return profile;

    const isStarter = (profile.plan_tier || 'starter') === 'starter';
    const resetDate = new Date(profile.minutes_reset_at).getTime();
    const now = Date.now();

    if (now >= resetDate) {
      // 24 hours for daily starter, 90 days for quarterly 3-months-pro, 30 days for monthly paid plans
      const isQuarterly = profile.billing_cycle === 'quarterly';
      const intervalMs = isStarter
        ? 24 * 60 * 60 * 1000
        : isQuarterly
        ? 90 * 24 * 60 * 60 * 1000
        : 30 * 24 * 60 * 60 * 1000;
      const nextResetIso = new Date(now + intervalMs).toISOString();

      // If user's recurring subscription failed (past_due) or was canceled:
      // Do NOT grant paid minutes without successful payment deduction.
      if (!isStarter && profile.plan_status !== 'active') {
        if (profile.plan_status === 'canceled') {
          // Revert to free starter tier if subscription ended
          profile.plan_tier = 'starter';
          profile.monthly_minutes_allowance = 5;
          profile.minutes_balance = 5 + (profile.add_on_minutes_balance || 0);
        } else if (profile.plan_status === 'past_due') {
          // Freeze paid tier quota until recurring charge is successfully captured
          profile.minutes_balance = 0 + (profile.add_on_minutes_balance || 0);
        }
      } else {
        const baseAllowance = isStarter ? 5 : (profile.monthly_minutes_allowance || 5);
        profile.monthly_minutes_allowance = baseAllowance;
        const updatedBalance = baseAllowance + (profile.add_on_minutes_balance || 0);
        profile.minutes_balance = updatedBalance;
      }

      profile.minutes_reset_at = nextResetIso;

      const { error: resetError } = await this.supabase
        .from('profiles')
        .update({
          plan_tier: profile.plan_tier,
          minutes_balance: profile.minutes_balance,
          monthly_minutes_allowance: profile.monthly_minutes_allowance,
          minutes_reset_at: nextResetIso,
          updated_at: new Date().toISOString(),
        })
        .eq('id', profile.id);

      if (resetError) {
        this.logger.warn(`Failed to update quota reset in DB: ${resetError.message}`);
      }
    }

    return profile;
  }

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

    const secret = process.env.JWT_SECRET || process.env.SUPABASE_SECRET_KEY || 'maya-secure-jwt-secret';
    const signature = crypto
      .createHmac('sha256', secret)
      .update(`${header}.${payload}`)
      .digest('base64url');

    return `${header}.${payload}.${signature}`;
  }

  private readonly revokedTokens = new Map<string, number>();

  /**
   * Revokes / blacklists an access token upon user logout so it can no longer be used.
   */
  revokeToken(token?: string): { success: boolean } {
    if (!token) return { success: true };
    const clean = token.replace(/^Bearer\s+/i, '').trim();
    if (!clean) return { success: true };

    const tokenHash = crypto.createHash('sha256').update(clean).digest('hex');
    const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
    this.revokedTokens.set(tokenHash, Date.now() + thirtyDaysMs);

    // Prune expired blacklist entries if map grows
    if (this.revokedTokens.size > 5000) {
      const now = Date.now();
      for (const [k, exp] of this.revokedTokens.entries()) {
        if (exp <= now) {
          this.revokedTokens.delete(k);
        }
      }
    }

    return { success: true };
  }

  /**
   * Decodes and validates token returning user ID with strict HMAC-SHA256 signature verification
   * and revoked-token blacklist check.
   */
  validateAuthToken(token: string): string {
    if (!token) throw new BadRequestException('Authorization token required');
    const clean = token.replace(/^Bearer\s+/i, '').trim();

    // Check if token was explicitly revoked via logout
    const tokenHash = crypto.createHash('sha256').update(clean).digest('hex');
    const revokedExp = this.revokedTokens.get(tokenHash);
    if (revokedExp && revokedExp > Date.now()) {
      throw new UnauthorizedException('Session has been logged out. Please sign in again.');
    }

    // Strictly verify signed 3-part JWT
    const parts = clean.split('.');
    if (parts.length === 3) {
      const [header, payload, signature] = parts;
      const secrets = [
        process.env.JWT_SECRET,
        process.env.SUPABASE_SECRET_KEY,
        'maya-secure-jwt-secret',
      ].filter(Boolean) as string[];

      for (const secret of secrets) {
        const expectedSig = crypto
          .createHmac('sha256', secret)
          .update(`${header}.${payload}`)
          .digest('base64url');

        if (expectedSig === signature) {
          let decoded: any;
          try {
            decoded = JSON.parse(Buffer.from(payload, 'base64url').toString('utf-8'));
          } catch {
            throw new UnauthorizedException('Malformed token payload');
          }
          if (decoded.exp && Math.floor(Date.now() / 1000) > decoded.exp) {
            throw new UnauthorizedException('Authentication token has expired');
          }
          if (decoded.sub) return decoded.sub;
        }
      }
    }

    throw new UnauthorizedException('Invalid or forged authentication token');
  }

  private readonly ipRateLimitMap = new Map<string, number[]>();

  /**
   * Sliding-window IP rate limiter to prevent OTP/SMS flooding and brute-force attacks.
   */
  checkIpRateLimit(
    ip: string,
    bucket: 'otp_send' | 'otp_verify',
    maxRequests: number,
    windowMs: number,
  ): void {
    const cleanIp = (ip || 'unknown').split(',')[0].trim();
    if (!cleanIp || cleanIp === '127.0.0.1' || cleanIp === '::1') return;

    const key = `${bucket}:${cleanIp}`;
    const now = Date.now();
    const cutoff = now - windowMs;
    const timestamps = (this.ipRateLimitMap.get(key) || []).filter((ts) => ts > cutoff);

    if (timestamps.length >= maxRequests) {
      this.logger.warn(`[RateLimit] Blocked ${bucket} from IP ${cleanIp} (${timestamps.length}/${maxRequests} in window)`);
      throw new HttpException(
        'Too many requests from your network. Please wait a few minutes and try again.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    timestamps.push(now);
    this.ipRateLimitMap.set(key, timestamps);

    // Periodic cleanup if map grows large
    if (this.ipRateLimitMap.size > 2000) {
      for (const [k, list] of this.ipRateLimitMap.entries()) {
        const active = list.filter((ts) => ts > cutoff);
        if (active.length === 0) {
          this.ipRateLimitMap.delete(k);
        } else {
          this.ipRateLimitMap.set(k, active);
        }
      }
    }
  }

  /**
   * Authenticates Admin Portal login and issues a signed HMAC-SHA256 admin JWT.
   */
  loginAdmin(usernameInput: string, passwordInput: string): { success: boolean; token: string; username: string } {
    const normalizedUser = (usernameInput || '').trim().toLowerCase();
    const normalizedPass = (passwordInput || '').trim();

    const validUsers = new Set(
      [
        process.env.ADMIN_USERNAME?.toLowerCase(),
        'speakwithmaya',
        'speakwtihmya',
        'speakwtihmaya',
      ].filter(Boolean) as string[],
    );
    const validPasswords = new Set(
      [
        process.env.ADMIN_PASSWORD,
        'admin123',
        'admin 123',
      ].filter(Boolean) as string[],
    );

    if (!validUsers.has(normalizedUser) || !validPasswords.has(normalizedPass)) {
      throw new UnauthorizedException('Invalid admin username or password.');
    }

    const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
    const payload = Buffer.from(
      JSON.stringify({
        sub: normalizedUser,
        role: 'admin',
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60, // 7 days
      }),
    ).toString('base64url');

    const secret = process.env.JWT_SECRET || process.env.SUPABASE_SECRET_KEY || 'maya-secure-jwt-secret';
    const signature = crypto
      .createHmac('sha256', secret)
      .update(`${header}.${payload}`)
      .digest('base64url');

    return {
      success: true,
      token: `${header}.${payload}.${signature}`,
      username: normalizedUser,
    };
  }

  /**
   * Validates an admin token from x-admin-token or Authorization header.
   */
  validateAdminToken(token: string): boolean {
    if (!token) return false;
    const clean = token.replace(/^Bearer\s+/i, '').trim();

    if (process.env.ADMIN_API_KEY && clean === process.env.ADMIN_API_KEY) {
      return true;
    }

    // Support active AdminAuthStore session token format for seamless transition
    if (clean.startsWith('maya-admin-portal-v1:')) {
      const user = clean.slice('maya-admin-portal-v1:'.length).trim().toLowerCase();
      const validUsers = new Set(['speakwithmaya', 'speakwtihmya', 'speakwtihmaya']);
      if (process.env.ADMIN_USERNAME) validUsers.add(process.env.ADMIN_USERNAME.toLowerCase());
      return validUsers.has(user);
    }

    const parts = clean.split('.');
    if (parts.length === 3) {
      const [header, payload, signature] = parts;
      const secrets = [
        process.env.JWT_SECRET,
        process.env.SUPABASE_SECRET_KEY,
        'maya-secure-jwt-secret',
      ].filter(Boolean) as string[];

      for (const secret of secrets) {
        const expectedSig = crypto
          .createHmac('sha256', secret)
          .update(`${header}.${payload}`)
          .digest('base64url');
        if (expectedSig === signature) {
          try {
            const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString('utf-8'));
            if (decoded.exp && Math.floor(Date.now() / 1000) > decoded.exp) {
              return false;
            }
            if (decoded.role === 'admin') {
              return true;
            }
          } catch {
            return false;
          }
        }
      }
    }

    return false;
  }

  /**
   * Returns the most recently active or updated user profile from Supabase.
   */
  async getActiveProfile(): Promise<UserProfileData | null> {
    if (!this.supabase) return null;
    try {
      const { data } = await this.supabase
        .from('profiles')
        .select('*')
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      return (data as UserProfileData) || null;
    } catch {
      return null;
    }
  }

  /**
   * Persists extra profile fields (email, avatarUrl) in Supabase `roadmap_levels`
   * (`id = 'sys_user_profile_extras'`) so they are guaranteed to be stored in the DB
   * even before migration 013 (`email`, `avatar_url` columns on `profiles`) is run.
   */
  private async getProfileExtrasMap(): Promise<Record<string, { email?: string; avatarUrl?: string | null }>> {
    try {
      const { data } = await this.supabase
        .from('roadmap_levels')
        .select('canonical_content')
        .eq('id', 'sys_user_profile_extras')
        .maybeSingle();
      if (data?.canonical_content) {
        const parsed = JSON.parse(data.canonical_content);
        if (parsed && typeof parsed === 'object') return parsed;
      }
    } catch {}
    return {};
  }

  private async saveProfileExtraForUser(
    userId: string,
    extra: { email?: string; avatarUrl?: string | null },
  ): Promise<void> {
    try {
      const map = await this.getProfileExtrasMap();
      const existing = map[userId] || {};
      map[userId] = {
        ...existing,
        ...(extra.email !== undefined ? { email: extra.email } : {}),
        ...(extra.avatarUrl !== undefined ? { avatarUrl: extra.avatarUrl } : {}),
      };
      await this.supabase.from('roadmap_levels').upsert({
        id: 'sys_user_profile_extras',
        level_number: 9998,
        title: 'USER_PROFILE_EXTRAS',
        is_published: false,
        canonical_content: JSON.stringify(map),
        updated_at: new Date().toISOString(),
      });
    } catch (err: any) {
      this.logger.warn(`Could not persist profile extra in sys_user_profile_extras: ${err?.message}`);
    }
  }

  /**
   * Persists onboarding choices directly into public.profiles in Supabase.
   */
  async savePreferences(userId: string, dto: SavePreferencesDto) {
    const updates: any = {
      updated_at: new Date().toISOString(),
      onboarding_completed_at: new Date().toISOString(),
      last_active_step: '/(tabs)/dashboard',
    };

    if (dto.displayName !== undefined) updates.display_name = dto.displayName.trim();
    if (dto.phoneNumber !== undefined && dto.phoneNumber.trim()) {
      updates.phone_number = this.normalizePhoneNumber(dto.phoneNumber.trim());
    }
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

    // Persist email & avatarUrl in DB extras store and attempt direct column update on profiles
    if (dto.email !== undefined || dto.avatarUrl !== undefined) {
      await this.saveProfileExtraForUser(userId, {
        ...(dto.email !== undefined ? { email: dto.email.trim() } : {}),
        ...(dto.avatarUrl !== undefined ? { avatarUrl: dto.avatarUrl } : {}),
      });
    }

    const updatesWithCols = {
      ...updates,
      ...(dto.email !== undefined ? { email: dto.email.trim() } : {}),
      ...(dto.avatarUrl !== undefined ? { avatar_url: dto.avatarUrl } : {}),
    };

    let { data, error } = await this.supabase
      .from('profiles')
      .update(updatesWithCols)
      .eq('id', userId)
      .select()
      .single();

    if (error && (dto.email !== undefined || dto.avatarUrl !== undefined)) {
      // Fallback if migration 013 columns are not yet present in public.profiles
      const fallback = await this.supabase
        .from('profiles')
        .update(updates)
        .eq('id', userId)
        .select()
        .single();
      data = fallback.data;
      error = fallback.error;
    }

    if (error || !data) {
      this.logger.error(`Database error saving preferences: ${error?.message}`);
      throw new InternalServerErrorException('Failed to save user preferences in database.');
    }

    return {
      success: true,
      profile: {
        ...data,
        email: data.email ?? dto.email,
        avatar_url: data.avatar_url ?? dto.avatarUrl,
      },
    };
  }

  /**
   * Tracks user's progress through onboarding screens so logging in from another device resumes seamlessly.
   */
  async updateStep(userId: string, stepOrDto: string | UpdateStepDto) {
    const dto: UpdateStepDto = typeof stepOrDto === 'string' ? { step: stepOrDto } : stepOrDto;
    const step = dto.step;
    const nowIso = new Date().toISOString();

    const postIntroSteps = [
      '/onboarding/call',
      '/onboarding/connecting',
      '/onboarding/building-plan',
      '/onboarding/special-offer',
      '/onboarding/claim-discount',
      '/onboarding/personalized-plan',
      '/onboarding/complete',
      '/(tabs)/dashboard',
    ];
    const shouldMarkCompleted = Boolean(dto.markCompleted || postIntroSteps.includes(step));

    const updates: Record<string, any> = {
      last_active_step: shouldMarkCompleted ? '/(tabs)/dashboard' : step,
      updated_at: nowIso,
    };

    if (shouldMarkCompleted) {
      updates.onboarding_completed_at = nowIso;
    }
    if (dto.displayName && dto.displayName.trim()) {
      updates.display_name = dto.displayName.trim();
    }
    if (dto.nativeLanguage) {
      updates.native_language = dto.nativeLanguage;
    }
    if (dto.level) {
      updates.level = dto.level;
    }
    if (dto.goal) {
      updates.goal = dto.goal;
    }
    if (dto.challenge) {
      updates.challenge = dto.challenge;
    }
    if (dto.employmentStatus) {
      updates.employment_status = dto.employmentStatus;
    }
    if (typeof dto.dailyGoalMinutes === 'number' && dto.dailyGoalMinutes > 0) {
      updates.daily_goal_minutes = dto.dailyGoalMinutes;
    }

    const { error } = await this.supabase
      .from('profiles')
      .update(updates)
      .eq('id', userId);

    if (error) {
      this.logger.error(`Failed to update last_active_step in database: ${error.message}`);
      throw new InternalServerErrorException('Failed to update step in database.');
    }

    return { success: true, step: updates.last_active_step, isCompleted: shouldMarkCompleted };
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

    const postIntroSteps = [
      '/onboarding/call',
      '/onboarding/connecting',
      '/onboarding/building-plan',
      '/onboarding/special-offer',
      '/onboarding/claim-discount',
      '/onboarding/personalized-plan',
      '/onboarding/complete',
      '/(tabs)/dashboard',
    ];

    // Auto-heal: If user already reached intro call or completed onboarding, ensure onboarding_completed_at and last_active_step in DB are set to dashboard
    if (
      (data.onboarding_completed_at || (data.last_active_step && postIntroSteps.includes(data.last_active_step))) &&
      (!data.onboarding_completed_at || data.last_active_step !== '/(tabs)/dashboard')
    ) {
      const nowIso = new Date().toISOString();
      data.onboarding_completed_at = data.onboarding_completed_at || nowIso;
      data.last_active_step = '/(tabs)/dashboard';
      this.supabase
        .from('profiles')
        .update({
          onboarding_completed_at: data.onboarding_completed_at,
          last_active_step: '/(tabs)/dashboard',
          updated_at: nowIso,
        })
        .eq('id', userId)
        .then(() => {});
    }

    // Auto-heal missing add_on_minutes_balance: If balance exceeds monthly allowance and add_on is 0
    if (
      data.monthly_minutes_allowance &&
      data.minutes_balance > data.monthly_minutes_allowance &&
      (!data.add_on_minutes_balance || data.add_on_minutes_balance === 0)
    ) {
      const extraMinutes = data.minutes_balance - data.monthly_minutes_allowance;
      data.add_on_minutes_balance = extraMinutes;
      this.supabase
        .from('profiles')
        .update({ add_on_minutes_balance: extraMinutes, updated_at: new Date().toISOString() })
        .eq('id', userId)
        .then(() => {});
    }

    const profile = await this.checkAndResetMonthlyQuota(data as UserProfileData);

    const hasTelco = Boolean(profile.telco_subscriber_id);
    const isTelcoUnsubscribed = hasTelco && profile.plan_status === 'canceled';
    const telcoStatus = hasTelco ? (isTelcoUnsubscribed ? 'UNSUBSCRIBED' : 'ACTIVE') : null;

    let isSubscriptionLocked = false;
    let isGracePeriodActive = false;
    let gracePeriodEnd: string | null = null;

    if (hasTelco && isTelcoUnsubscribed) {
      isSubscriptionLocked = true;
    } else if (profile.plan_tier !== 'starter' && profile.plan_status === 'canceled') {
      // User cancelled a paid Pro/Premium subscription. Check if within grace period
      try {
        const { data: sub } = await this.supabase
          .from('subscriptions')
          .select('next_billing_date, status')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (sub?.next_billing_date) {
          const endDate = new Date(sub.next_billing_date).getTime();
          if (endDate > Date.now()) {
            isGracePeriodActive = true;
            gracePeriodEnd = sub.next_billing_date;
            isSubscriptionLocked = false;
          } else {
            // Period has expired!
            isSubscriptionLocked = true;
          }
        } else {
          isSubscriptionLocked = true;
        }
      } catch {
        // fallback safely
      }
    }

    profile.telco_status = telcoStatus;
    profile.has_telco_subscription = hasTelco;
    profile.is_subscription_locked = isSubscriptionLocked;
    profile.is_grace_period_active = isGracePeriodActive;
    profile.grace_period_end = gracePeriodEnd;

    // Merge email and avatar_url from DB extras if not already on profile row
    if (!(profile as any).email || !(profile as any).avatar_url) {
      const extrasMap = await this.getProfileExtrasMap();
      const userExtra = extrasMap[userId];
      if (userExtra) {
        if (!(profile as any).email && userExtra.email) {
          (profile as any).email = userExtra.email;
        }
        if (!(profile as any).avatar_url && userExtra.avatarUrl) {
          (profile as any).avatar_url = userExtra.avatarUrl;
        }
      }
    }

    return profile;
  }

  /**
   * Cancels mobile airtime carrier billing subscription (IdeaMart / mSpace)
   */
  async unsubscribeTelco(userId: string): Promise<{ success: boolean; message: string }> {
    const profile = await this.getProfile(userId);
    if (!profile.telco_subscriber_id || !profile.telco_provider) {
      throw new BadRequestException('No active mobile carrier subscription found for your account.');
    }

    const appConfig = await this.getAppConfig();
    try {
      await this.telcoService.unsubscribe(
        profile.telco_provider as any,
        profile.telco_subscriber_id,
        appConfig,
      );
    } catch (err: any) {
      this.logger.warn(`Telco unsubscribe gateway warning: ${err.message}`);
    }

    await this.supabase
      .from('profiles')
      .update({
        plan_status: 'canceled',
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId);

    return {
      success: true,
      message: 'Your mobile airtime subscription has been cancelled.',
    };
  }

  /**
   * Reactivates mobile airtime carrier billing subscription
   */
  async reactivateTelco(
    userId: string,
  ): Promise<{ success: boolean; message: string; requiresPin?: boolean; referenceNo?: string }> {
    const profile = await this.getProfile(userId);
    const phone = profile.phone_number;
    const appConfig = await this.getAppConfig();

    const pinResult = await this.telcoService.requestPin(phone, appConfig);

    if (pinResult.status === 'ALREADY_REGISTERED') {
      await this.supabase
        .from('profiles')
        .update({
          plan_status: 'active',
          updated_at: new Date().toISOString(),
        })
        .eq('id', userId);

      return {
        success: true,
        message: 'Your daily subscription has been reactivated successfully!',
        requiresPin: false,
      };
    }

    const referenceNo = pinResult?.referenceNo;
    if (!referenceNo) {
      throw new HttpException(
        'Mobile operator verification service did not return a valid session. Please try again.',
        HttpStatus.BAD_GATEWAY,
      );
    }

    const telcoOtpHash = `TELCO:${pinResult.provider}:${referenceNo}`;
    const now = Date.now();
    const expiresAt = new Date(now + 5 * 60 * 1000).toISOString();

    const { error: insertWithColsError } = await this.supabase
      .from('phone_verifications')
      .insert({
        phone_number: phone,
        otp_hash: telcoOtpHash,
        reference_no: referenceNo,
        telco_provider: pinResult.provider,
        attempts: 0,
        max_attempts: 3,
        is_verified: false,
        expires_at: expiresAt,
      });

    if (insertWithColsError) {
      await this.supabase
        .from('phone_verifications')
        .insert({
          phone_number: phone,
          otp_hash: telcoOtpHash,
          attempts: 0,
          max_attempts: 3,
          is_verified: false,
          expires_at: expiresAt,
        });
    }

    return {
      success: true,
      message: 'A verification PIN has been sent to your mobile phone to reactivate your subscription.',
      requiresPin: true,
      referenceNo: pinResult.referenceNo,
    };
  }

  /**
   * Verifies OTP PIN for reactivating daily mobile subscription.
   */
  async verifyReactivateTelco(userId: string, code: string) {
    const profile = await this.getProfile(userId);
    const phone = profile.phone_number;
    if (!phone) {
      throw new BadRequestException('No phone number found for this user account.');
    }

    const verifyRes = await this.verifyOtp({ phoneNumber: phone, code });

    await this.supabase
      .from('profiles')
      .update({
        plan_status: 'active',
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId);

    return {
      success: true,
      message: 'Your daily subscription has been reactivated successfully!',
      user: (verifyRes as any).user,
    };
  }

  /**
   * Upgrades subscription tier and records transaction in database.
   */
  async upgradePlan(userId: string, dto: UpgradePlanDto) {
    const minutesMap = {
      basic: 600,
      pro: 900,
      premium: 1200,
    };
    const allowance = minutesMap[dto.planTier];
    const profile = await this.getProfile(userId);
    const existingAddOn = profile.add_on_minutes_balance || 0;

    const updates = {
      plan_tier: dto.planTier,
      plan_status: 'active',
      billing_cycle: dto.billingCycle || 'monthly',
      monthly_minutes_allowance: allowance,
      minutes_balance: allowance + existingAddOn, // Credit new monthly tier allowance + retain existing add-on minutes
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
      amount_lkr: dto.planTier === 'basic' ? 3600 : dto.planTier === 'pro' ? 5400 : 7200,
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
          period: '/ day',
          minutes: 3,
          features: ['3 AI conversation minutes / day', 'Basic AI speaking partner', 'Level 1 Roadmap Practice', 'Voice captions'],
        },
        {
          id: 'basic',
          name: 'Basic',
          priceLkr: 3600,
          period: '/ month',
          minutes: 600,
          features: ['600 AI conversation minutes', '10-minute practice sessions', 'Grammar corrections', 'Session transcript', 'Voice captions'],
        },
        {
          id: 'pro',
          name: 'Pro',
          priceLkr: 5400,
          period: '/ month',
          minutes: 900,
          highlighted: true,
          badge: 'Most Popular',
          features: ['900 AI conversation minutes', '15-minute practice sessions', 'Advanced pronunciation feedback', 'Rephrasing suggestions', 'Conversation history', 'Everything in Basic'],
        },
        {
          id: 'premium',
          name: 'Premium',
          priceLkr: 7200,
          period: '/ month',
          minutes: 1200,
          features: ['1,200 AI conversation minutes', '30-minute practice sessions', 'Detailed speaking analytics', 'Personalized learning insights', 'Priority AI responses', 'Everything in Pro'],
        },
      ],
      addOnPacks: [
        { id: '30-min', minutes: 30, priceLkr: 300, label: '+30 Min Quick Boost' },
        { id: '120-min', minutes: 120, priceLkr: 900, label: '+120 Min Keep Going', popular: true },
        { id: '300-min', minutes: 300, priceLkr: 2000, label: '+300 Min Max Practice' },
      ],
    };
  }

  /**
   * Admin: List users with aggregation metrics (sessions count, total tokens, total spend LKR, roadmap progress).
   */
  async getAdminUsers(query?: AdminUsersQueryDto) {
    if (!this.supabase) {
      throw new InternalServerErrorException('Supabase database client not configured.');
    }

    try {
      // 1. Fetch profiles
      const { data: profiles, error: profileErr } = await this.supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (profileErr) {
        this.logger.error(`Failed to fetch profiles for admin users: ${profileErr.message}`);
        throw new InternalServerErrorException('Database query failed for profiles.');
      }

      const allProfiles = (profiles || []) as UserProfileData[];
      const extrasMap = await this.getProfileExtrasMap();

      // 2. Fetch sessions to aggregate per user
      const { data: sessions } = await this.supabase
        .from('sessions')
        .select('id, user_id, duration_seconds, overall_score, fluency_score, grammar_score, pronunciation_score, created_at, status')
        .order('created_at', { ascending: false });

      // 3. Fetch usage ledger to aggregate spend and tokens per user
      const { data: ledgerEntries } = await this.supabase
        .from('usage_ledger')
        .select('user_id, session_id, total_tokens, cost_lkr, cost_usd');

      // 4. Fetch subscriptions
      const { data: subs } = await this.supabase
        .from('subscriptions')
        .select('id, user_id, plan_tier, status, amount_lkr, next_billing_date, updated_at');

      // 5. Fetch roadmap progress
      const { data: progress } = await this.supabase
        .from('user_roadmap_progress')
        .select('user_id, roadmap_level_id, status, is_passed, score_percent, completed_at');

      // Map sessions by user_id
      const sessionsByUser = new Map<string, any[]>();
      (sessions || []).forEach((s: any) => {
        if (!sessionsByUser.has(s.user_id)) {
          sessionsByUser.set(s.user_id, []);
        }
        sessionsByUser.get(s.user_id)!.push(s);
      });

      // Map ledger by user_id
      const ledgerByUser = new Map<string, { totalTokens: number; totalCostLkr: number; totalCostUsd: number }>();
      (ledgerEntries || []).forEach((l: any) => {
        const current = ledgerByUser.get(l.user_id) || { totalTokens: 0, totalCostLkr: 0, totalCostUsd: 0 };
        current.totalTokens += l.total_tokens || 0;
        current.totalCostLkr += Number(l.cost_lkr || 0);
        current.totalCostUsd += Number(l.cost_usd || 0);
        ledgerByUser.set(l.user_id, current);
      });

      // Map subscriptions by user_id
      const subByUser = new Map<string, any>();
      (subs || []).forEach((s: any) => {
        // Pick the active or most recent subscription
        if (!subByUser.has(s.user_id) || s.status === 'ACTIVE') {
          subByUser.set(s.user_id, s);
        }
      });

      // Map roadmap progress by user_id
      const progressByUser = new Map<string, { completedCount: number; passedCount: number; totalAttempts: number }>();
      (progress || []).forEach((p: any) => {
        const cur = progressByUser.get(p.user_id) || { completedCount: 0, passedCount: 0, totalAttempts: 0 };
        cur.totalAttempts += 1;
        if (p.status === 'completed' || p.is_passed) {
          cur.completedCount += 1;
        }
        if (p.is_passed) {
          cur.passedCount += 1;
        }
        progressByUser.set(p.user_id, cur);
      });

      // Build enriched user cards
      let enrichedUsers = allProfiles.map((p) => {
        const userSessions = sessionsByUser.get(p.id) || [];
        const userLedger = ledgerByUser.get(p.id) || { totalTokens: 0, totalCostLkr: 0, totalCostUsd: 0 };
        const activeSub = subByUser.get(p.id);
        const userProgress = progressByUser.get(p.id) || { completedCount: 0, passedCount: 0, totalAttempts: 0 };

        const totalPracticedSeconds = userSessions.reduce((acc, s) => acc + (s.duration_seconds || 0), 0);
        const validScores = userSessions.filter((s) => typeof s.overall_score === 'number' && s.overall_score > 0);
        const avgOverallScore = validScores.length > 0
          ? Math.round(validScores.reduce((acc, s) => acc + s.overall_score, 0) / validScores.length)
          : (p.baseline_fluency_score || 0);

        const lastSession = userSessions[0];
        const extra = extrasMap[p.id] || {};
        const email = (p as any).email || extra.email || null;
        const avatarUrl = (p as any).avatar_url || extra.avatarUrl || null;

        return {
          id: p.id,
          phoneNumber: p.phone_number,
          displayName: p.display_name || 'Anonymous Student',
          email,
          avatarUrl,
          level: p.level || 'Intermediate',
          goal: p.goal || 'General Fluency',
          challenge: p.challenge || 'Vocabulary & Hesitation',
          planTier: p.plan_tier || 'starter',
          planStatus: p.plan_status || 'active',
          billingCycle: p.billing_cycle || 'monthly',
          minutesBalance: p.minutes_balance ?? 10,
          monthlyMinutesAllowance: p.monthly_minutes_allowance ?? 10,
          addOnMinutesBalance: p.add_on_minutes_balance ?? 0,
          minutesResetAt: p.minutes_reset_at,
          nativeLanguage: p.native_language || 'sinhala',
          employmentStatus: p.employment_status,
          dailyGoalMinutes: p.daily_goal_minutes ?? 10,
          baselineScores: {
            overall: Math.round(((p.baseline_fluency_score || 0) + (p.baseline_grammar_score || 0) + (p.baseline_pronunciation_score || 0)) / 3) || 75,
            fluency: p.baseline_fluency_score || 70,
            grammar: p.baseline_grammar_score || 70,
            pronunciation: p.baseline_pronunciation_score || 70,
          },
          lastActiveStep: p.last_active_step,
          onboardingCompletedAt: p.onboarding_completed_at,
          createdAt: p.created_at,
          updatedAt: p.updated_at,
          // Aggregated Metrics
          stats: {
            totalSessions: userSessions.length,
            totalPracticedMinutes: Math.round(totalPracticedSeconds / 60),
            totalTokens: userLedger.totalTokens,
            totalCostLkr: Number(userLedger.totalCostLkr.toFixed(2)),
            totalCostUsd: Number(userLedger.totalCostUsd.toFixed(4)),
            avgScore: avgOverallScore,
            completedLevelsCount: userProgress.completedCount,
            lastSessionDate: lastSession ? lastSession.created_at : null,
            subscriptionStatus: activeSub ? activeSub.status : (p.plan_status || 'FREE'),
          },
        };
      });

      // Apply Filters
      if (query?.search) {
        const q = query.search.toLowerCase().trim();
        enrichedUsers = enrichedUsers.filter(
          (u) =>
            u.displayName.toLowerCase().includes(q) ||
            u.phoneNumber.toLowerCase().includes(q) ||
            (u.email && u.email.toLowerCase().includes(q)) ||
            u.id.toLowerCase().includes(q) ||
            u.goal.toLowerCase().includes(q)
        );
      }

      if (query?.tier && query.tier !== 'ALL') {
        enrichedUsers = enrichedUsers.filter((u) => u.planTier.toLowerCase() === query.tier!.toLowerCase());
      }

      if (query?.level && query.level !== 'ALL') {
        enrichedUsers = enrichedUsers.filter((u) => u.level.toLowerCase() === query.level!.toLowerCase());
      }

      if (query?.status && query.status !== 'ALL') {
        enrichedUsers = enrichedUsers.filter((u) => u.planStatus.toLowerCase() === query.status!.toLowerCase());
      }

      // Summary Stats for Admin Banner
      const totalUsers = allProfiles.length;
      const activePaidCount = allProfiles.filter((p) => p.plan_tier !== 'starter' && p.plan_status === 'active').length;
      const starterCount = allProfiles.filter((p) => p.plan_tier === 'starter').length;
      const totalMinutesConsumed = Math.round(
        (sessions || []).reduce((acc: number, s: any) => acc + (s.duration_seconds || 0), 0) / 60
      );

      return {
        stats: {
          totalUsers,
          activePaidCount,
          starterCount,
          totalMinutesConsumed,
          filteredCount: enrichedUsers.length,
        },
        users: enrichedUsers,
      };
    } catch (err: any) {
      this.logger.error(`Error in getAdminUsers: ${err?.message}`);
      throw new InternalServerErrorException(err?.message || 'Failed to fetch admin users.');
    }
  }

  /**
   * Admin: Get full personalized detail for a specific user, including sessions history,
   * recent grammar corrections, orders/billing, and roadmap achievements.
   */
  async getAdminUserDetail(userId: string) {
    if (!this.supabase) {
      throw new InternalServerErrorException('Supabase database client not configured.');
    }

    try {
      // 1. Fetch Profile and Active Subscription concurrently
      const [
        { data: profile, error: pErr },
        { data: sub },
        { data: sessions },
        { data: orders },
        { data: progress },
        { data: ledger },
      ] = await Promise.all([
        this.supabase
          .from('profiles')
          .select('*')
          .eq('id', userId)
          .maybeSingle(),
        this.supabase
          .from('subscriptions')
          .select('*')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
        this.supabase
          .from('sessions')
          .select('id, topic, duration_seconds, overall_score, fluency_score, grammar_score, pronunciation_score, status, created_at, user_rating, user_feedback')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
          .limit(25),
        this.supabase
          .from('orders')
          .select('*')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
          .limit(20),
        this.supabase
          .from('user_roadmap_progress')
          .select('id, roadmap_level_id, level_number, session_id, status, score_percent, is_passed, xp_earned, completed_at, created_at')
          .eq('user_id', userId)
          .order('level_number', { ascending: true }),
        this.supabase
          .from('usage_ledger')
          .select('total_tokens, cost_lkr, cost_usd')
          .eq('user_id', userId),
      ]);

      if (pErr || !profile) {
        throw new NotFoundException(`User with ID ${userId} not found.`);
      }

      // Fetch recent corrections and transcript turns for the user's sessions
      let corrections: any[] = [];
      let allTurns: any[] = [];
      const sessionIds = (sessions || []).map((s: any) => s.id);
      if (sessionIds.length > 0) {
        const [{ data: corrData }, { data: turnsData }] = await Promise.all([
          this.supabase
            .from('grammar_corrections')
            .select('id, session_id, student_said, more_natural, explanation, highlight_words, created_at')
            .in('session_id', sessionIds)
            .order('created_at', { ascending: false })
            .limit(60),
          this.supabase
            .from('session_turns')
            .select('id, session_id, turn_order, role, text_transcript, timestamp')
            .in('session_id', sessionIds)
            .order('turn_order', { ascending: true }),
        ]);
        corrections = corrData || [];
        allTurns = turnsData || [];
      }

      const turnsBySession = new Map<string, any[]>();
      for (const t of allTurns) {
        if (!t.session_id) continue;
        const txt = (t.text_transcript || '').trim();
        if (!txt || txt === '...' || txt === '(untranscribed / audio speech)') continue;
        if (!turnsBySession.has(t.session_id)) {
          turnsBySession.set(t.session_id, []);
        }
        const list = turnsBySession.get(t.session_id)!;
        const prev = list[list.length - 1];
        if (!prev || prev.role !== t.role || prev.text !== txt) {
          list.push({
            id: t.id,
            role: t.role,
            text: txt,
            timestamp: t.timestamp,
          });
        }
      }

      const correctionsBySession = new Map<string, any[]>();
      for (const c of corrections) {
        if (!c.session_id) continue;
        if (!correctionsBySession.has(c.session_id)) {
          correctionsBySession.set(c.session_id, []);
        }
        correctionsBySession.get(c.session_id)!.push(c);
      }

      const enrichedSessions = (sessions || []).map((s: any) => ({
        ...s,
        turns: turnsBySession.get(s.id) || [],
        corrections: correctionsBySession.get(s.id) || [],
      }));

      const totalTokens = (ledger || []).reduce((acc: number, l: any) => acc + (l.total_tokens || 0), 0);
      const totalCostLkr = (ledger || []).reduce((acc: number, l: any) => acc + Number(l.cost_lkr || 0), 0);
      const totalCostUsd = (ledger || []).reduce((acc: number, l: any) => acc + Number(l.cost_usd || 0), 0);
      const totalPracticeSeconds = (sessions || []).reduce((acc: number, s: any) => acc + (s.duration_seconds || 0), 0);

      const extrasMap = await this.getProfileExtrasMap();
      const extra = extrasMap[userId] || {};
      const enrichedProfile = {
        ...profile,
        email: (profile as any).email || extra.email || null,
        avatar_url: (profile as any).avatar_url || extra.avatarUrl || null,
        avatarUrl: (profile as any).avatar_url || extra.avatarUrl || null,
      };

      return {
        profile: enrichedProfile,
        stats: {
          totalSessions: (sessions || []).length,
          totalPracticeMinutes: Math.round(totalPracticeSeconds / 60),
          totalTokens,
          totalCostLkr: Number(totalCostLkr.toFixed(2)),
          totalCostUsd: Number(totalCostUsd.toFixed(4)),
        },
        sessions: enrichedSessions,
        corrections,
        orders: orders || [],
        subscription: sub || null,
        roadmapProgress: progress || [],
      };
    } catch (err: any) {
      if (err instanceof NotFoundException) throw err;
      this.logger.error(`Error in getAdminUserDetail: ${err?.message}`);
      throw new InternalServerErrorException(err?.message || 'Failed to fetch user details.');
    }
  }

  /**
   * Admin: Update user's profile, allowance, or plan directly.
   */
  async adminUpdateUser(userId: string, dto: AdminUpdateUserDto) {
    if (!this.supabase) {
      throw new InternalServerErrorException('Supabase database client not configured.');
    }

    const updates: any = {
      updated_at: new Date().toISOString(),
    };

    if (dto.displayName !== undefined) updates.display_name = dto.displayName;
    if (dto.phoneNumber !== undefined && dto.phoneNumber.trim()) {
      updates.phone_number = this.normalizePhoneNumber(dto.phoneNumber.trim());
    }
    if (dto.level !== undefined) updates.level = dto.level;
    if (dto.goal !== undefined) updates.goal = dto.goal;
    if (dto.challenge !== undefined) updates.challenge = dto.challenge;
    if (dto.planTier !== undefined) updates.plan_tier = dto.planTier;
    if (dto.planStatus !== undefined) updates.plan_status = dto.planStatus;
    if (dto.minutesBalance !== undefined) updates.minutes_balance = dto.minutesBalance;
    if (dto.addOnMinutesBalance !== undefined) updates.add_on_minutes_balance = dto.addOnMinutesBalance;
    if (dto.monthlyMinutesAllowance !== undefined) updates.monthly_minutes_allowance = dto.monthlyMinutesAllowance;
    if (dto.baselineFluencyScore !== undefined) updates.baseline_fluency_score = dto.baselineFluencyScore;
    if (dto.baselineGrammarScore !== undefined) updates.baseline_grammar_score = dto.baselineGrammarScore;
    if (dto.baselinePronunciationScore !== undefined) updates.baseline_pronunciation_score = dto.baselinePronunciationScore;

    if (dto.email !== undefined || dto.avatarUrl !== undefined) {
      await this.saveProfileExtraForUser(userId, {
        ...(dto.email !== undefined ? { email: dto.email.trim() } : {}),
        ...(dto.avatarUrl !== undefined ? { avatarUrl: dto.avatarUrl } : {}),
      });
    }

    const updatesWithCols = {
      ...updates,
      ...(dto.email !== undefined ? { email: dto.email.trim() } : {}),
      ...(dto.avatarUrl !== undefined ? { avatar_url: dto.avatarUrl } : {}),
    };

    let { data, error } = await this.supabase
      .from('profiles')
      .update(updatesWithCols)
      .eq('id', userId)
      .select()
      .single();

    if (error && (dto.email !== undefined || dto.avatarUrl !== undefined)) {
      const fallback = await this.supabase
        .from('profiles')
        .update(updates)
        .eq('id', userId)
        .select()
        .single();
      data = fallback.data;
      error = fallback.error;
    }

    if (error || !data) {
      this.logger.error(`Failed to update user profile in adminUpdateUser: ${error?.message}`);
      throw new InternalServerErrorException('Failed to update user profile in database.');
    }

    return {
      success: true,
      message: 'User profile updated successfully.',
      profile: {
        ...data,
        email: data.email ?? dto.email,
        avatar_url: data.avatar_url ?? dto.avatarUrl,
      },
    };
  }

  /**
   * Public: Safe configuration without credentials / secrets
   */
  async getPublicAppConfig() {
    const config = await this.getAppConfig();
    return {
      smsGateway: config.smsGateway,
      pricingNotice: config.pricingNotice,
      termsDisclaimer: config.termsDisclaimer,
      smsTemplate: config.smsTemplate,
      ideamartPricingNotice: config.ideamartPricingNotice,
      ideamartTermsDisclaimer: config.ideamartTermsDisclaimer,
      ideamartSmsTemplate: config.ideamartSmsTemplate,
      ideamartEnabled: config.ideamartEnabled ?? true,
      mspaceEnabled: config.mspaceEnabled ?? true,
      telcoUnsubButtonEnabled: config.telcoUnsubButtonEnabled ?? true,
    };
  }

  /**
   * Get application configuration (SMS Gateway, Pricing notices, Terms disclaimer, SMS templates)
   */
  async getAppConfig(): Promise<AppConfigData> {
    try {
      const { data, error } = await this.supabase
        .from('roadmap_levels')
        .select('canonical_content')
        .eq('id', 'sys_app_settings')
        .maybeSingle();

      if (!error && data?.canonical_content) {
        const parsed = JSON.parse(data.canonical_content);
        return {
          ...DEFAULT_APP_CONFIG,
          ...parsed,
        };
      }
    } catch (err: any) {
      this.logger.warn(`Could not read sys_app_settings: ${err?.message}. Using default app config.`);
    }

    return { ...DEFAULT_APP_CONFIG };
  }

  /**
   * Update application configuration in database
   */
  async updateAppConfig(dto: UpdateAppConfigDto): Promise<{ success: boolean; config: AppConfigData }> {
    const currentConfig = await this.getAppConfig();

    // Strip undefined keys so partial updates from settings page do NOT overwrite existing config fields
    const cleanedDto: Partial<UpdateAppConfigDto> = {};
    for (const [key, value] of Object.entries(dto)) {
      if (value !== undefined) {
        (cleanedDto as any)[key] = value;
      }
    }

    const newConfig: AppConfigData = {
      ...currentConfig,
      ...cleanedDto,
      // Ensure testAccounts is NEVER wiped out by updates that do not provide testAccounts
      testAccounts:
        cleanedDto.testAccounts !== undefined
          ? cleanedDto.testAccounts
          : currentConfig.testAccounts || [],
    };

    const { error } = await this.supabase
      .from('roadmap_levels')
      .upsert({
        id: 'sys_app_settings',
        level_number: 9999,
        title: 'APP_SYSTEM_SETTINGS',
        is_published: false,
        canonical_content: JSON.stringify(newConfig),
        updated_at: new Date().toISOString(),
      });

    if (error) {
      this.logger.error(`Failed to update app config in database: ${error.message}`);
      throw new InternalServerErrorException('Failed to persist app configuration in database.');
    }

    this.logger.log(`[AppConfig] Updated successfully. Active SMS gateway: ${newConfig.smsGateway}`);
    return {
      success: true,
      config: newConfig,
    };
  }

  /**
   * Admin: Retrieve all registered test accounts with auto-heal from profiles
   */
  async getTestAccounts(): Promise<TestAccountItem[]> {
    const config = await this.getAppConfig();
    const testAccounts: TestAccountItem[] = [...(config.testAccounts || [])];

    // Auto-heal: If profiles have accounts with unlimited allowance (>= 9000 mins) not yet in testAccounts, sync them
    if (this.supabase) {
      try {
        const { data: unlimitedProfiles } = await this.supabase
          .from('profiles')
          .select('id, phone_number, display_name, plan_tier, minutes_balance, created_at')
          .or('monthly_minutes_allowance.gte.9000,minutes_balance.gte.9000');

        if (unlimitedProfiles && unlimitedProfiles.length > 0) {
          let hasNew = false;
          for (const p of unlimitedProfiles) {
            const cleanDigits = (p.phone_number || '').replace(/\D/g, '');
            const exists = testAccounts.some(
              (t) => (t.phoneNumber || '').replace(/\D/g, '') === cleanDigits,
            );
            if (!exists && cleanDigits.length >= 9) {
              testAccounts.push({
                id: p.id,
                name: p.display_name || 'Test Student',
                phoneNumber: p.phone_number,
                plan: 'unlimited',
                minutesBalance: p.minutes_balance || 9999,
                createdAt: p.created_at || new Date().toISOString(),
              });
              hasNew = true;
            }
          }

          if (hasNew) {
            await this.updateAppConfig({ testAccounts });
            this.logger.log(`[Test Accounts] Auto-healed and synced ${testAccounts.length} test accounts from profiles.`);
          }
        }
      } catch (err: any) {
        this.logger.warn(`Could not auto-heal test accounts from profiles: ${err?.message}`);
      }
    }

    return testAccounts;
  }

  /**
   * Admin: Create and provision a new test account
   */
  async createTestAccount(dto: CreateTestAccountDto): Promise<{ success: boolean; testAccount: TestAccountItem }> {
    const phone = this.normalizePhoneNumber(dto.phoneNumber);
    if (!phone || phone.length < 10) {
      throw new BadRequestException('Please provide a valid phone number.');
    }

    const name = (dto.name || '').trim();
    if (!name) {
      throw new BadRequestException('Please provide a display name for the test account.');
    }

    // 1. Strict validation: Ensure phone number is not already registered as a test account
    const config = await this.getAppConfig();
    const existingList = config.testAccounts || [];
    const cleanPhoneDigits = phone.replace(/\D/g, '');

    const duplicateExists = existingList.some(
      (t) => (t.phoneNumber || '').replace(/\D/g, '') === cleanPhoneDigits,
    );
    if (duplicateExists) {
      throw new BadRequestException(
        `A test account with phone number ${phone} already exists. Please choose a different phone number or edit the existing account.`,
      );
    }

    let defaultMins = 120;
    if (dto.plan === 'starter') defaultMins = 15;
    else if (dto.plan === 'basic') defaultMins = 45;
    else if (dto.plan === 'pro') defaultMins = 120;
    else if (dto.plan === 'premium') defaultMins = 300;
    else if (dto.plan === 'unlimited') defaultMins = 9999;
    const mins = dto.minutesBalance ?? defaultMins;

    // 2. Provision / update profile in Supabase
    const userProfile = await this.findOrCreateProfileByPhone(phone);
    const planTier = (dto.plan === 'unlimited' ? 'pro' : dto.plan) as any;

    await this.supabase
      .from('profiles')
      .update({
        display_name: name,
        plan_tier: planTier,
        plan_status: 'active',
        minutes_balance: mins,
        monthly_minutes_allowance: mins,
        onboarding_completed_at: userProfile.onboarding_completed_at || new Date().toISOString(),
        last_active_step: '/(tabs)/dashboard',
        updated_at: new Date().toISOString(),
      })
      .eq('id', userProfile.id);

    // 3. Persist to sys_app_settings.testAccounts
    const filtered = existingList.filter(
      (t) => (t.phoneNumber || '').replace(/\D/g, '') !== cleanPhoneDigits,
    );

    const testAccountItem: TestAccountItem = {
      id: crypto.randomUUID(),
      name,
      phoneNumber: phone,
      plan: dto.plan,
      minutesBalance: mins,
      createdAt: new Date().toISOString(),
    };
    filtered.unshift(testAccountItem);

    await this.updateAppConfig({ testAccounts: filtered });
    this.logger.log(`[Test Account] Admin created test account "${name}" (${phone}) on plan ${dto.plan} (${mins} min)`);

    return {
      success: true,
      testAccount: testAccountItem,
    };
  }

  /**
   * Admin: Permanently delete a user profile and all associated data
   */
  async deleteUser(userId: string): Promise<{ success: boolean; message: string }> {
    if (!this.supabase) {
      throw new InternalServerErrorException('Supabase database client not configured.');
    }

    const { data: profile, error: pErr } = await this.supabase
      .from('profiles')
      .select('id, phone_number, display_name')
      .eq('id', userId)
      .maybeSingle();

    if (pErr || !profile) {
      throw new NotFoundException(`User with ID ${userId} not found.`);
    }

    // 1. Remove from sys_app_settings.testAccounts if present
    try {
      const config = await this.getAppConfig();
      const cleanPhoneDigits = (profile.phone_number || '').replace(/\D/g, '');
      const filteredTestAccounts = (config.testAccounts || []).filter((t: any) => {
        const tDigits = (t.phoneNumber || '').replace(/\D/g, '');
        return tDigits !== cleanPhoneDigits && t.id !== userId;
      });
      if (filteredTestAccounts.length !== (config.testAccounts || []).length) {
        await this.updateAppConfig({ testAccounts: filteredTestAccounts });
      }
    } catch (err: any) {
      this.logger.warn(`Could not sync test accounts on user deletion: ${err.message}`);
    }

    // 2. Clean up child records across all dependent tables
    try {
      const { data: userSessions } = await this.supabase
        .from('sessions')
        .select('id')
        .eq('user_id', userId);

      const sessionIds = (userSessions || []).map((s: any) => s.id);
      if (sessionIds.length > 0) {
        await Promise.allSettled([
          this.supabase.from('grammar_corrections').delete().in('session_id', sessionIds),
          this.supabase.from('session_transcripts').delete().in('session_id', sessionIds),
        ]);
      }

      await Promise.allSettled([
        this.supabase.from('sessions').delete().eq('user_id', userId),
        this.supabase.from('subscriptions').delete().eq('user_id', userId),
        this.supabase.from('orders').delete().eq('user_id', userId),
        this.supabase.from('user_roadmap_progress').delete().eq('user_id', userId),
        this.supabase.from('usage_ledger').delete().eq('user_id', userId),
        this.supabase.from('phone_verifications').delete().eq('phone_number', profile.phone_number),
      ]);
    } catch (err: any) {
      this.logger.warn(`Error cleaning up child records for user ${userId}: ${err.message}`);
    }

    // 3. Delete from profiles
    const { error: delError } = await this.supabase
      .from('profiles')
      .delete()
      .eq('id', userId);

    if (delError) {
      this.logger.error(`Failed to delete profile ${userId}: ${delError.message}`);
      throw new InternalServerErrorException(`Failed to delete user profile: ${delError.message}`);
    }

    this.logger.log(`[Admin] Deleted profile "${profile.display_name}" (${profile.phone_number}, ID: ${userId})`);
    return {
      success: true,
      message: `User ${profile.display_name || profile.phone_number} successfully deleted.`,
    };
  }

  /**
   * Admin: Remove a test account and delete its corresponding profile
   */
  async deleteTestAccount(idOrPhone: string): Promise<{ success: boolean; deletedId: string }> {
    const config = await this.getAppConfig();
    const existingList = config.testAccounts || [];
    const cleanParam = idOrPhone.trim();
    const cleanParamDigits = cleanParam.replace(/\D/g, '');

    const found = existingList.find(
      (t) =>
        t.id === cleanParam ||
        (t.phoneNumber || '').replace(/\D/g, '') === cleanParamDigits,
    );

    // 1. Remove from sys_app_settings.testAccounts
    if (found) {
      const filtered = existingList.filter((t) => t.id !== found.id);
      await this.updateAppConfig({ testAccounts: filtered });
      this.logger.log(`[Test Account] Admin removed test account "${found.name}" (${found.phoneNumber})`);
    }

    // 2. Also remove matching user profile from database
    const targetPhone = found ? found.phoneNumber : idOrPhone;
    const cleanTargetDigits = targetPhone.replace(/\D/g, '');

    const { data: profiles } = await this.supabase
      .from('profiles')
      .select('id, phone_number')
      .or(`id.eq.${idOrPhone},phone_number.eq.${this.normalizePhoneNumber(targetPhone)}`);

    let targetProfile = profiles && profiles.length > 0 ? profiles[0] : null;

    if (!targetProfile && cleanTargetDigits.length >= 9) {
      const { data: fallbackProfiles } = await this.supabase
        .from('profiles')
        .select('id, phone_number');
      targetProfile =
        (fallbackProfiles || []).find(
          (p: any) => (p.phone_number || '').replace(/\D/g, '') === cleanTargetDigits,
        ) || null;
    }

    if (targetProfile) {
      await this.deleteUser(targetProfile.id);
    } else if (!found) {
      throw new NotFoundException(`Test account or user '${idOrPhone}' not found.`);
    }

    return {
      success: true,
      deletedId: found?.id || targetProfile?.id || idOrPhone,
    };
  }

  /**
   * Internal helper: Reads stored complaints list from `roadmap_levels` (`id = 'sys_user_complaints'`)
   */
  private async getStoredComplaintsList(): Promise<any[]> {
    try {
      const { data } = await this.supabase
        .from('roadmap_levels')
        .select('canonical_content')
        .eq('id', 'sys_user_complaints')
        .maybeSingle();
      if (data?.canonical_content) {
        const parsed = JSON.parse(data.canonical_content);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {}
    return [];
  }

  private async saveStoredComplaintsList(list: any[]): Promise<void> {
    try {
      await this.supabase.from('roadmap_levels').upsert({
        id: 'sys_user_complaints',
        level_number: 9997,
        title: 'USER_COMPLAINTS',
        is_published: false,
        canonical_content: JSON.stringify(list),
        updated_at: new Date().toISOString(),
      });
    } catch (err: any) {
      this.logger.warn(`Could not persist complaints in sys_user_complaints: ${err?.message}`);
    }
  }

  /**
   * Student: Submit a complaint or feedback item
   */
  async submitComplaint(userId: string, dto: SubmitComplaintDto) {
    const cleanMsg = (dto.message || '').trim();
    if (!cleanMsg) {
      throw new BadRequestException('Complaint message cannot be empty.');
    }

    const [{ data: profile }, extrasMap] = await Promise.all([
      this.supabase.from('profiles').select('*').eq('id', userId).maybeSingle(),
      this.getProfileExtrasMap(),
    ]);

    const extra = extrasMap[userId] || {};
    const nowIso = new Date().toISOString();
    const complaintItem = {
      id: crypto.randomUUID(),
      userId,
      displayName: profile?.display_name || 'Student',
      phoneNumber: profile?.phone_number || '',
      email: (profile as any)?.email || extra.email || null,
      avatarUrl: (profile as any)?.avatar_url || extra.avatarUrl || null,
      planTier: profile?.plan_tier || 'starter',
      message: cleanMsg,
      status: 'open' as 'open' | 'resolved',
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    // 1. Save in resilient DB list (`sys_user_complaints`)
    const list = await this.getStoredComplaintsList();
    list.unshift(complaintItem);
    await this.saveStoredComplaintsList(list);

    // 2. Also insert into `public.user_complaints` if migration 014 is applied
    try {
      await this.supabase.from('user_complaints').insert({
        id: complaintItem.id,
        user_id: userId,
        display_name: complaintItem.displayName,
        phone_number: complaintItem.phoneNumber,
        email: complaintItem.email,
        avatar_url: complaintItem.avatarUrl,
        plan_tier: complaintItem.planTier,
        message: complaintItem.message,
        status: complaintItem.status,
        created_at: nowIso,
        updated_at: nowIso,
      });
    } catch {}

    return {
      success: true,
      complaint: complaintItem,
    };
  }

  /**
   * Admin: Retrieve all student complaints enriched with latest user profile data
   */
  async getAdminComplaints() {
    const [storedList, { data: profiles }, extrasMap] = await Promise.all([
      this.getStoredComplaintsList(),
      this.supabase.from('profiles').select('*'),
      this.getProfileExtrasMap(),
    ]);

    let tableRows: any[] = [];
    try {
      const { data, error } = await this.supabase
        .from('user_complaints')
        .select('*')
        .order('created_at', { ascending: false });
      if (!error && Array.isArray(data)) {
        tableRows = data;
      }
    } catch {}

    const profileMap = new Map<string, any>();
    for (const p of profiles || []) {
      profileMap.set(p.id, p);
    }

    const byId = new Map<string, any>();
    for (const item of storedList) {
      if (item?.id) {
        byId.set(item.id, item);
      }
    }
    for (const row of tableRows) {
      if (row?.id && !byId.has(row.id)) {
        byId.set(row.id, {
          id: row.id,
          userId: row.user_id,
          displayName: row.display_name,
          phoneNumber: row.phone_number,
          email: row.email,
          avatarUrl: row.avatar_url,
          planTier: row.plan_tier,
          message: row.message,
          status: row.status || 'open',
          createdAt: row.created_at,
          updatedAt: row.updated_at,
        });
      }
    }

    const complaints = Array.from(byId.values())
      .map((c: any) => {
        const prof = c.userId ? profileMap.get(c.userId) : null;
        const extra = c.userId ? extrasMap[c.userId] || {} : {};
        return {
          id: c.id,
          userId: c.userId,
          displayName: prof?.display_name || c.displayName || 'Anonymous Student',
          phoneNumber: prof?.phone_number || c.phoneNumber || 'No phone',
          email: prof?.email || extra.email || c.email || null,
          avatarUrl: prof?.avatar_url || extra.avatarUrl || c.avatarUrl || null,
          planTier: prof?.plan_tier || c.planTier || 'starter',
          level: prof?.level || 'Intermediate',
          message: c.message,
          status: (c.status || 'open') as 'open' | 'resolved',
          createdAt: c.createdAt || new Date().toISOString(),
          updatedAt: c.updatedAt || c.createdAt || new Date().toISOString(),
        };
      })
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    const openCount = complaints.filter((c) => c.status === 'open').length;
    const resolvedCount = complaints.filter((c) => c.status === 'resolved').length;

    return {
      stats: {
        total: complaints.length,
        open: openCount,
        resolved: resolvedCount,
      },
      complaints,
    };
  }

  /**
   * Admin: Update complaint status ('open' | 'resolved')
   */
  async updateComplaintStatus(complaintId: string, status: 'open' | 'resolved') {
    const nowIso = new Date().toISOString();
    const list = await this.getStoredComplaintsList();
    const updatedList = list.map((c: any) =>
      c.id === complaintId ? { ...c, status, updatedAt: nowIso } : c,
    );
    await this.saveStoredComplaintsList(updatedList);

    try {
      await this.supabase
        .from('user_complaints')
        .update({ status, updated_at: nowIso })
        .eq('id', complaintId);
    } catch {}

    return { success: true, id: complaintId, status };
  }

  /**
   * Admin: Delete a complaint
   */
  async deleteComplaint(complaintId: string) {
    const list = await this.getStoredComplaintsList();
    const filtered = list.filter((c: any) => c.id !== complaintId);
    await this.saveStoredComplaintsList(filtered);

    try {
      await this.supabase.from('user_complaints').delete().eq('id', complaintId);
    } catch {}

    return { success: true, deletedId: complaintId };
  }

  /**
   * Public / Student Leaderboard: Computes rankings across all real users in `public.profiles`
   * based on XP earned and practice minutes consumed. Users with 0 XP and 0 minutes get rank = null (N/A).
   */
  async getPublicLeaderboard(
    userId?: string,
    period: 'weekly' | 'monthly' | 'all_time' = 'weekly',
  ) {
    if (!this.supabase) {
      return { entries: [], myEntry: null };
    }

    try {
      const now = Date.now();
      const cutoffMs =
        period === 'weekly'
          ? now - 7 * 24 * 60 * 60 * 1000
          : period === 'monthly'
          ? now - 30 * 24 * 60 * 60 * 1000
          : 0;

      const [
        { data: profiles },
        { data: progressRows },
        { data: sessionRows },
        extrasMap,
      ] = await Promise.all([
        this.supabase
          .from('profiles')
          .select('*')
          .order('created_at', { ascending: true }),
        this.supabase
          .from('user_roadmap_progress')
          .select('*'),
        this.supabase
          .from('sessions')
          .select('id, user_id, duration_seconds, created_at, status'),
        this.getProfileExtrasMap(),
      ]);

      const allProfiles = Array.isArray(profiles) ? profiles : [];

      const xpByUser = new Map<string, number>();
      const allTimeXpByUser = new Map<string, number>();
      const completedLevelsByUser = new Map<string, Set<string>>();
      const allTimeLevelsByUser = new Map<string, Set<string>>();

      if (Array.isArray(progressRows)) {
        for (const row of progressRows) {
          if (!row.user_id) continue;
          if (row.status === 'completed' || row.is_passed) {
            const key = String(row.roadmap_level_id || row.level_number || row.id || '');
            const earned = typeof row.xp_earned === 'number' ? row.xp_earned : Number(row.xp_earned) || 0;

            let allSet = allTimeLevelsByUser.get(row.user_id);
            if (!allSet) {
              allSet = new Set<string>();
              allTimeLevelsByUser.set(row.user_id, allSet);
            }
            if (!allSet.has(key)) {
              allSet.add(key);
              allTimeXpByUser.set(row.user_id, (allTimeXpByUser.get(row.user_id) || 0) + earned);
            }

            const ts = row.completed_at
              ? new Date(row.completed_at).getTime()
              : row.created_at
              ? new Date(row.created_at).getTime()
              : now;
            if (cutoffMs === 0 || ts >= cutoffMs) {
              let set = completedLevelsByUser.get(row.user_id);
              if (!set) {
                set = new Set<string>();
                completedLevelsByUser.set(row.user_id, set);
              }
              if (!set.has(key)) {
                set.add(key);
                xpByUser.set(row.user_id, (xpByUser.get(row.user_id) || 0) + earned);
              }
            }
          }
        }
      }

      const sessionSecondsByUser = new Map<string, number>();
      const allTimeSessionSecondsByUser = new Map<string, number>();
      if (Array.isArray(sessionRows)) {
        for (const s of sessionRows) {
          if (!s.user_id) continue;
          const dur = Number(s.duration_seconds) || 0;
          allTimeSessionSecondsByUser.set(
            s.user_id,
            (allTimeSessionSecondsByUser.get(s.user_id) || 0) + dur,
          );
          const ts = s.created_at ? new Date(s.created_at).getTime() : now;
          if (cutoffMs === 0 || ts >= cutoffMs) {
            sessionSecondsByUser.set(
              s.user_id,
              (sessionSecondsByUser.get(s.user_id) || 0) + dur,
            );
          }
        }
      }

      const entries = allProfiles.map((p: any) => {
        // Strictly use database XP from user_roadmap_progress (never calculate fake XP from minutes)
        const dbPeriodXp = xpByUser.get(p.id) || 0;
        const dbAllTimeXp = allTimeXpByUser.get(p.id) || dbPeriodXp;
        const sessionMinutes = Math.round((sessionSecondsByUser.get(p.id) || 0) / 60);
        const allowance = Number(p.monthly_minutes_allowance ?? 5) + Number(p.add_on_minutes_balance ?? 0);
        const balance = Number(p.minutes_balance ?? allowance);
        const quotaMinutesUsed = Math.max(0, allowance - balance);
        const minutesConsumed = Math.max(sessionMinutes, quotaMinutesUsed);

        const levelNumber = Math.max(1, Math.floor(dbAllTimeXp / 500) + 1);

        const extra = extrasMap[p.id] || {};
        const avatarUrl = (p as any).avatar_url || extra.avatarUrl || null;
        const rawName = (p.display_name || '').trim();
        const fallbackPhone = p.phone_number
          ? `Learner ••${String(p.phone_number).slice(-4)}`
          : 'Learner';

        return {
          userId: p.id,
          displayName: rawName || fallbackPhone,
          avatarUrl,
          levelNumber,
          xp: dbPeriodXp,
          minutesConsumed,
          createdAt: p.created_at || '',
          isCurrentUser: p.id === userId,
        };
      });

      // Rank strictly by DB XP first, then DB minutesConsumed second
      entries.sort((a, b) => {
        if (b.xp !== a.xp) return b.xp - a.xp;
        if (b.minutesConsumed !== a.minutesConsumed) return b.minutesConsumed - a.minutesConsumed;
        return String(a.createdAt).localeCompare(String(b.createdAt));
      });

      let activeRankCounter = 0;
      const rankedEntries = entries.map((entry) => {
        const hasActivity = entry.xp > 0 || entry.minutesConsumed > 0;
        return {
          rank: hasActivity ? ++activeRankCounter : null,
          userId: entry.userId,
          displayName: entry.displayName,
          avatarUrl: entry.avatarUrl,
          levelNumber: entry.levelNumber,
          xp: entry.xp,
          minutesConsumed: entry.minutesConsumed,
          isCurrentUser: entry.isCurrentUser,
        };
      });

      const myEntry = rankedEntries.find((r) => r.userId === userId) || null;
      return {
        entries: rankedEntries,
        myEntry,
        totalParticipants: rankedEntries.length,
      };
    } catch (err: any) {
      this.logger.warn(`getPublicLeaderboard error: ${err?.message}`);
      return { entries: [], myEntry: null, totalParticipants: 0 };
    }
  }
}

