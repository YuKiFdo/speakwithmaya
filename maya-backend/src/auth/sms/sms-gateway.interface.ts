export interface SmsDeliveryResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

export interface ISmsGatewayProvider {
  /**
   * Sends an OTP verification code via SMS to the specified recipient phone number.
   * @param phoneNumber E.164 formatted telephone number (e.g. +94771234567)
   * @param code The 6-digit numeric OTP code
   * @param customMessage Optional custom message text template containing {CODE} placeholder
   */
  sendOtp(phoneNumber: string, code: string, customMessage?: string): Promise<SmsDeliveryResult>;
}
