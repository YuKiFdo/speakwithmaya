import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { SmsApiLkProvider } from './sms/smsapi-lk.provider.js';
import { IdeamartSmsProvider } from './sms/ideamart-sms.provider.js';
import { TelcoSubscriptionService } from './sms/telco-subscription.service.js';
import { AuthGuard } from './guards/auth.guard.js';
import { AdminGuard } from './guards/admin.guard.js';

@Module({
  controllers: [AuthController],
  providers: [
    AuthService,
    SmsApiLkProvider,
    IdeamartSmsProvider,
    TelcoSubscriptionService,
    AuthGuard,
    AdminGuard,
  ],
  exports: [AuthService, TelcoSubscriptionService, AuthGuard, AdminGuard],
})
export class AuthModule {}

