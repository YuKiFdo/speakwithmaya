import { Injectable, Logger } from '@nestjs/common';
import { ISmsGatewayProvider, SmsDeliveryResult } from './sms-gateway.interface.js';

@Injectable()
export class MockSmsProvider implements ISmsGatewayProvider {
  private readonly logger = new Logger(MockSmsProvider.name);

  async sendOtp(phoneNumber: string, code: string): Promise<SmsDeliveryResult> {
    // In development & staging, output clearly formatted SMS dispatch in terminal
    this.logger.log(`\n===============================================\n` +
      `[SMS GATEWAY DISPATCH]\n` +
      `Recipient : ${phoneNumber}\n` +
      `Message   : Your Maya AI verification code is ${code}. Valid for 5 minutes.\n` +
      `===============================================`);

    return {
      success: true,
      messageId: `mock-msg-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    };
  }
}
