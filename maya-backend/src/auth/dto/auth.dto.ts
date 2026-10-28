import {
  IsString,
  IsNotEmpty,
  Matches,
  Length,
  IsOptional,
  IsIn,
  IsNumber,
  IsBoolean,
  Min,
  Max,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class SendOtpDto {
  @IsString()
  @IsNotEmpty()
  // Matches international phone numbers (e.g. +94771234567, +94 77 123 4567)
  @Matches(/^\+?[0-9\s-]{9,18}$/, {
    message: 'Invalid phone number format. Please provide a valid phone number with country code.',
  })
  phoneNumber!: string;

  @IsOptional()
  @IsBoolean()
  isLoginMode?: boolean;
}

export class VerifyOtpDto {
  @IsString()
  @IsNotEmpty()
  @Matches(/^\+?[0-9\s-]{9,18}$/, {
    message: 'Invalid phone number format.',
  })
  phoneNumber!: string;

  @IsString()
  @IsNotEmpty()
  @Length(6, 6, { message: 'OTP must be exactly 6 digits.' })
  @Matches(/^[0-9]{6}$/, { message: 'OTP must contain only numbers.' })
  code!: string;

  @IsOptional()
  @IsString()
  displayName?: string;

  @IsOptional()
  @IsBoolean()
  isLoginMode?: boolean;
}

export class BaselineScoresDto {
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  overall?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  fluency?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  grammar?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  pronunciation?: number;
}

export class SavePreferencesDto {
  @IsOptional()
  @IsString()
  displayName?: string;

  @IsOptional()
  @IsString()
  phoneNumber?: string;

  @IsOptional()
  @IsString()
  email?: string;

  @IsOptional()
  @IsString()
  avatarUrl?: string;

  @IsOptional()
  @IsString()
  @IsIn(['sinhala', 'tamil', 'english'])
  nativeLanguage?: string;

  @IsOptional()
  @IsString()
  level?: string;

  @IsOptional()
  @IsString()
  goal?: string;

  @IsOptional()
  @IsString()
  challenge?: string;

  @IsOptional()
  @IsString()
  employmentStatus?: string;

  @IsOptional()
  @IsNumber()
  @Min(5)
  @Max(120)
  dailyGoalMinutes?: number;

  @IsOptional()
  @ValidateNested()
  @Type(() => BaselineScoresDto)
  baselineScores?: BaselineScoresDto;
}

export class UpgradePlanDto {
  @IsString()
  @IsIn(['basic', 'pro', 'premium'])
  planTier!: 'basic' | 'pro' | 'premium';

  @IsOptional()
  @IsString()
  @IsIn(['monthly', 'quarterly', 'yearly'])
  billingCycle?: 'monthly' | 'quarterly' | 'yearly';

  @IsOptional()
  @IsString()
  addOnPackageId?: string;
}

export class AddOnTopUpDto {
  @IsString()
  @IsIn(['30-min', '120-min', '300-min'])
  packageId!: '30-min' | '120-min' | '300-min';
}

export class UpdateStepDto {
  @IsString()
  @IsNotEmpty()
  step!: string;

  @IsOptional()
  @IsString()
  displayName?: string;

  @IsOptional()
  @IsString()
  nativeLanguage?: string;

  @IsOptional()
  @IsString()
  level?: string;

  @IsOptional()
  @IsString()
  goal?: string;

  @IsOptional()
  @IsString()
  challenge?: string;

  @IsOptional()
  @IsString()
  employmentStatus?: string;

  @IsOptional()
  @IsNumber()
  dailyGoalMinutes?: number;

  @IsOptional()
  @IsBoolean()
  markCompleted?: boolean;
}

export class AdminUsersQueryDto {
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsString()
  tier?: string;

  @IsOptional()
  @IsString()
  level?: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  limit?: string;

  @IsOptional()
  @IsString()
  page?: string;
}

export class AdminUpdateUserDto {
  @IsOptional()
  @IsString()
  displayName?: string;

  @IsOptional()
  @IsString()
  phoneNumber?: string;

  @IsOptional()
  @IsString()
  email?: string;

  @IsOptional()
  @IsString()
  avatarUrl?: string;

  @IsOptional()
  @IsString()
  level?: string;

  @IsOptional()
  @IsString()
  goal?: string;

  @IsOptional()
  @IsString()
  challenge?: string;

  @IsOptional()
  @IsString()
  @IsIn(['starter', 'basic', 'pro', 'premium'])
  planTier?: 'starter' | 'basic' | 'pro' | 'premium';

  @IsOptional()
  @IsString()
  @IsIn(['active', 'trialing', 'past_due', 'canceled'])
  planStatus?: 'active' | 'trialing' | 'past_due' | 'canceled';

  @IsOptional()
  @IsNumber()
  @Min(0)
  minutesBalance?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  addOnMinutesBalance?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  monthlyMinutesAllowance?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  baselineFluencyScore?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  baselineGrammarScore?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  baselinePronunciationScore?: number;
}

export class UpdateAppConfigDto {
  @IsOptional()
  @IsString()
  @IsIn(['smsapi', 'ideamart', 'mspace'])
  smsGateway?: 'smsapi' | 'ideamart' | 'mspace';

  @IsOptional()
  @IsString()
  pricingNotice?: string;

  @IsOptional()
  @IsString()
  termsDisclaimer?: string;

  @IsOptional()
  @IsString()
  smsTemplate?: string;

  @IsOptional()
  @IsString()
  ideamartPricingNotice?: string;

  @IsOptional()
  @IsString()
  ideamartTermsDisclaimer?: string;

  @IsOptional()
  @IsString()
  ideamartSmsTemplate?: string;

  // Telco Carrier Billing (IdeaMart & mSpace) Toggles & Credentials
  @IsOptional()
  @IsBoolean()
  ideamartEnabled?: boolean;

  @IsOptional()
  @IsString()
  ideamartAppId?: string;

  @IsOptional()
  @IsString()
  ideamartPassword?: string;

  @IsOptional()
  @IsString()
  ideamartAppCode?: string;

  @IsOptional()
  @IsString()
  ideamartAppHash?: string;

  @IsOptional()
  @IsString()
  ideamartBaseUrl?: string;

  @IsOptional()
  @IsBoolean()
  mspaceEnabled?: boolean;

  @IsOptional()
  @IsString()
  mspaceAppId?: string;

  @IsOptional()
  @IsString()
  mspacePassword?: string;

  @IsOptional()
  @IsString()
  mspaceAppCode?: string;

  @IsOptional()
  @IsString()
  mspaceAppHash?: string;

  @IsOptional()
  @IsString()
  mspaceBaseUrl?: string;

  @IsOptional()
  @IsBoolean()
  telcoUnsubButtonEnabled?: boolean;

  @IsOptional()
  testAccounts?: any[];
}

export class CreateTestAccountDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsString()
  @IsNotEmpty()
  @Matches(/^\+?[0-9\s-]{9,18}$/, {
    message: 'Invalid phone number format.',
  })
  phoneNumber!: string;

  @IsString()
  @IsNotEmpty()
  @IsIn(['starter', 'basic', 'pro', 'premium', 'unlimited'])
  plan!: 'starter' | 'basic' | 'pro' | 'premium' | 'unlimited';

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(99999)
  minutesBalance?: number;
}

export class SubmitComplaintDto {
  @IsString()
  @IsNotEmpty()
  message!: string;
}

export class UpdateComplaintStatusDto {
  @IsString()
  @IsIn(['open', 'resolved'])
  status!: 'open' | 'resolved';
}



