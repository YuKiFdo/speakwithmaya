import { Injectable, Logger } from '@nestjs/common';
import { ISmsGatewayProvider, SmsDeliveryResult } from './sms-gateway.interface.js';

@Injectable()
export class SmsApiLkProvider implements ISmsGatewayProvider {
  private readonly logger = new Logger(SmsApiLkProvider.name);
  private readonly apiEndpoint = 'https://dashboard.smsapi.lk/api/v3/sms/send';
  private readonly apiToken =
    process.env.SMSAPI_LK_TOKEN || '144|kMx9xkQ0VDVdfFLVkJPJLPXDYXKJgXtAKG62GtBa';
  private readonly senderId = process.env.SMSAPI_LK_SENDER_ID || 'MayaAI';

  /**
   * Normalizes phone number into standard international format without '+'
   * e.g., '+94784508121' -> '94784508121', '0784508121' -> '94784508121'
   */
  private formatRecipient(phoneNumber: string): string {
    let cleaned = phoneNumber.replace(/[\s\-\(\)\+]/g, '');
    if (cleaned.startsWith('0') && cleaned.length === 10) {
      cleaned = '94' + cleaned.slice(1);
    }
    return cleaned;
  }

  async sendOtp(phoneNumber: string, code: string): Promise<SmsDeliveryResult> {
    const recipient = this.formatRecipient(phoneNumber);
    const message = `Your Maya AI English Coach verification code is: ${code}. Valid for 5 minutes. Do not share this code.`;

    // Always log in terminal for instant dev inspection
    this.logger.log(
      `\n===============================================\n` +
      `[SMSAPI.LK DISPATCH]\n` +
      `Recipient : ${recipient} (raw: ${phoneNumber})\n` +
      `Sender ID : ${this.senderId}\n` +
      `Code      : ${code}\n` +
      `===============================================`,
    );

    try {
      const response = await fetch(this.apiEndpoint, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiToken}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          recipient,
          sender_id: this.senderId,
          type: 'plain',
          message,
        }),
      });

      const data = await response.json().catch(() => null);

      if (response.ok && data?.status === 'success') {
        const msgId = typeof data.data === 'object' ? data.data?.uid || data.data?.id : String(data.data || '');
        this.logger.log(`[SMSAPI.LK] ✅ SMS delivered successfully to ${recipient}. MsgId: ${msgId}`);
        return {
          success: true,
          messageId: msgId,
        };
      }

      this.logger.warn(`[SMSAPI.LK] ⚠️ API response status: ${response.status}, message: ${data?.message || JSON.stringify(data)}`);
      // Even if gateway returns an error (e.g. sender ID awaiting approval), return success for OTP verification flow
      return {
        success: false,
        error: data?.message || `HTTP ${response.status}`,
      };
    } catch (err: any) {
      this.logger.error(`[SMSAPI.LK] ❌ Failed to send SMS via SMSAPI.LK: ${err.message}`);
      return {
        success: false,
        error: err.message,
      };
    }
  }
}
