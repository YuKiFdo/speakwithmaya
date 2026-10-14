import {
  IsString,
  IsNotEmpty,
  Matches,
  Length,
  IsOptional,
  IsIn,
  IsNumber,
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
}

