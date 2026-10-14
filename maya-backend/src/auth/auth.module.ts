import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { SmsApiLkProvider } from './sms/smsapi-lk.provider.js';

@Module({
  controllers: [AuthController],
  providers: [AuthService, SmsApiLkProvider],
  exports: [AuthService],
})
export class AuthModule {}
