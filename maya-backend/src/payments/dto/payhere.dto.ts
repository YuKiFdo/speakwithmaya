import { IsString, IsNotEmpty, IsOptional, IsIn } from 'class-validator';

export class GenerateCheckoutParamsDto {
  @IsString()
  @IsNotEmpty()
  @IsIn(['basic', 'pro', 'premium', '3-months-pro'])
  planTier!: 'basic' | 'pro' | 'premium' | '3-months-pro';

  @IsString()
  @IsOptional()
  @IsIn(['monthly', '3-months', 'yearly'])
  billingCycle?: 'monthly' | '3-months' | 'yearly';

  @IsString()
  @IsOptional()
  returnUrl?: string;

  @IsString()
  @IsOptional()
  cancelUrl?: string;
}

export class CancelSubscriptionDto {
  @IsString()
  @IsOptional()
  subscriptionId?: string;

  @IsString()
  @IsOptional()
  reason?: string;
}

export class RetrySubscriptionDto {
  @IsString()
  @IsNotEmpty()
  subscriptionId!: string;
}
