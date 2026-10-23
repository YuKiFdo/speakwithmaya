import {
  Injectable,
  Logger,
  BadRequestException,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { resolveTelcoError, type TelcoErrorResolution } from './telco-error-codes.js';

export type TelcoProviderType = 'ideamart' | 'mspace';

export interface TelcoGatewayConfig {
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
  telcoClientType?: string;
  telcoDeviceModel?: string;
  telcoOsVersion?: string;
}

export interface TelcoErrorLogEntry {
  timestamp: string;
  provider: TelcoProviderType;
  operation: 'otp_request' | 'otp_verify' | 'status_check' | 'unsubscribe';
  endpoint: string;
  maskedSubscriberId: string;
  statusCode: string;
  rawStatusDetail: string;
  officialDescription: string;
  userMessageReturned: string;
  isSensitiveAdminError: boolean;
}

export interface TelcoPinRequestResult {
  status: 'OTP_SENT' | 'ALREADY_REGISTERED';
  provider: TelcoProviderType;
  referenceNo?: string;
  subscriberId: string;
}

export interface TelcoPinVerifyResult {
  success: boolean;
  provider: TelcoProviderType;
  subscriberId: string;
  subscriptionStatus: string;
}

export interface TelcoStatusResult {
  success: boolean;
  provider: TelcoProviderType;
  subscriberId: string;
  subscriptionStatus: string;
  statusCode: string;
}

export interface TelcoUnsubscribeResult {
  success: boolean;
  provider: TelcoProviderType;
  subscriberId: string;
  alreadyUnsubscribed: boolean;
  statusCode: string;
}

@Injectable()
export class TelcoSubscriptionService {
  private readonly logger = new Logger(TelcoSubscriptionService.name);
  private recentErrors: TelcoErrorLogEntry[] = [];

  /**
   * Formats a user-entered phone number into `tel:947XXXXXXXX` strictly for the initial OTP Request.
   * NOTE: Never use this on the hashed `subscriberId` returned by Telco Verify OTP!
   */
  formatPhoneToTelUri(phoneNumber: string): string {
    let cleaned = (phoneNumber || '').trim().replace(/^tel:/i, '').replace(/[\s\-()+]/g, '');
    if (cleaned.startsWith('0') && cleaned.length === 10) {
      cleaned = '94' + cleaned.slice(1);
    } else if (cleaned.length === 9 && cleaned.startsWith('7')) {
      cleaned = '94' + cleaned;
    }
    return `tel:${cleaned}`;
  }

  /**
   * Masks a subscriberId or phone number for safe console/admin logging.
   */
  private maskSubscriberId(subId: string): string {
    if (!subId || subId.length < 8) return subId;
    return `${subId.slice(0, 6)}***${subId.slice(-3)}`;
  }

  /**
   * Detects Sri Lankan mobile operator from user's phone number prefix:
   * - 070 / 071 (9470 / 9471) -> Mobitel (mSpace)
   * - 077 / 076 / 074 (Dialog), 078 / 072 (Hutch), 075 (Airtel), or others -> IdeaMart
   */
  detectProvider(phoneNumber: string): TelcoProviderType {
    const formatted = this.formatPhoneToTelUri(phoneNumber); // tel:947XXXXXXXX
    const digits = formatted.replace(/^tel:/i, '');
    const prefix = digits.startsWith('94') ? digits.slice(2, 4) : digits.slice(0, 2);

    if (prefix === '70' || prefix === '71') {
      return 'mspace';
    }
    return 'ideamart';
  }

  /**
   * Returns recent Telco error logs captured on the server (max 30).
   */
  getRecentErrorLogs(): TelcoErrorLogEntry[] {
    return this.recentErrors;
  }

  /**
   * Clears in-memory recent error logs.
   */
  clearRecentErrorLogs(): void {
    this.recentErrors = [];
  }

  private recordAndLogTelcoError(params: {
    provider: TelcoProviderType;
    operation: 'otp_request' | 'otp_verify' | 'status_check' | 'unsubscribe';
    endpoint: string;
    subscriberId: string;
    rawStatusDetail?: string;
    resolution: TelcoErrorResolution;
  }): TelcoErrorLogEntry {
    const entry: TelcoErrorLogEntry = {
      timestamp: new Date().toISOString(),
      provider: params.provider,
      operation: params.operation,
      endpoint: params.endpoint,
      maskedSubscriberId: this.maskSubscriberId(params.subscriberId),
      statusCode: params.resolution.code,
      rawStatusDetail: params.rawStatusDetail || '',
      officialDescription: params.resolution.officialDescription,
      userMessageReturned: params.resolution.userMessage,
      isSensitiveAdminError: params.resolution.isSensitiveAdminError,
    };

    this.recentErrors.unshift(entry);
    if (this.recentErrors.length > 30) {
      this.recentErrors.length = 30;
    }

    this.logger.error(
      `\n==============================================================\n` +
        `[TELCO GATEWAY ERROR] (${params.provider.toUpperCase()} - ${params.operation})\n` +
        `Endpoint            : ${params.endpoint}\n` +
        `Subscriber          : ${entry.maskedSubscriberId}\n` +
        `Status Code         : ${entry.statusCode}\n` +
        `Raw Status Detail   : ${entry.rawStatusDetail || 'N/A'}\n` +
        `Official Meaning    : ${entry.officialDescription}\n` +
        `Admin/Sensitive Err : ${entry.isSensitiveAdminError ? 'YES (Hidden from user)' : 'NO'}\n` +
        `User-Safe Message   : ${entry.userMessageReturned}\n` +
        `==============================================================`,
    );

    return entry;
  }

  private getProviderCredentials(provider: TelcoProviderType, config: TelcoGatewayConfig) {
    if (provider === 'mspace') {
      const baseUrl = (
        process.env.MSPACE_BASE_URL ||
        config.mspaceBaseUrl ||
        'https://api.mspace.lk'
      ).replace(/\/+$/, '');
      return {
        enabled: config.mspaceEnabled ?? true,
        appId: process.env.MSPACE_APP_ID || config.mspaceAppId || '',
        password: process.env.MSPACE_PASSWORD || config.mspacePassword || '',
        appCode:
          process.env.MSPACE_APP_CODE ||
          config.mspaceAppCode ||
          '1234',
        appHash: process.env.MSPACE_APP_HASH || config.mspaceAppHash || 'abcdefgh',
        baseUrl,
        otpRequestUrl: `${baseUrl}/otp/request`,
        otpVerifyUrl: `${baseUrl}/otp/verify`,
        statusUrl: `${baseUrl}/subscription/getStatus`,
        unsubscribeUrl: `${baseUrl}/subscription/send`,
      };
    }

    const baseUrl = (
      process.env.IDEAMART_BASE_URL ||
      config.ideamartBaseUrl ||
      'https://api.dialog.lk'
    ).replace(/\/+$/, '');
    return {
      enabled: config.ideamartEnabled ?? true,
      appId: process.env.IDEAMART_APP_ID || config.ideamartAppId || '',
      password: process.env.IDEAMART_PASSWORD || config.ideamartPassword || '',
      appCode:
        process.env.IDEAMART_APP_CODE ||
        config.ideamartAppCode ||
        '77000',
      appHash: process.env.IDEAMART_APP_HASH || config.ideamartAppHash || 'abcdefgh',
      baseUrl,
      otpRequestUrl: `${baseUrl}/subscription/otp/request`,
      otpVerifyUrl: `${baseUrl}/subscription/otp/verify`,
      statusUrl: `${baseUrl}/subscription/getStatus`,
      unsubscribeUrl: `${baseUrl}/subscription/send`,
    };
  }

  /**
   * 1. Request Subscription OTP Pin from IdeaMart (Dialog) or mSpace (Mobitel)
   */
  async requestPin(
    phoneNumber: string,
    config: TelcoGatewayConfig,
  ): Promise<TelcoPinRequestResult> {
    const provider = this.detectProvider(phoneNumber);
    const subscriberId = this.formatPhoneToTelUri(phoneNumber);
    const creds = this.getProviderCredentials(provider, config);

    if (!creds.enabled) {
      const networkName = provider === 'mspace' ? 'Mobitel' : 'Dialog & Hutch';
      throw new BadRequestException(
        `Mobile balance billing is currently unavailable for ${networkName} numbers. Please enter a supported mobile number.`,
      );
    }

    if (!creds.appId || !creds.password) {
      this.logger.error(
        `[TELCO CONFIG MISSING] ${provider.toUpperCase()} Application ID or Password is not configured in Admin Settings.`,
      );
      throw new HttpException(
        'Mobile verification service is temporarily unavailable. Please try again in a few moments.',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }

    const requestBody: Record<string, any> = {
      applicationId: creds.appId,
      password: creds.password,
      subscriberId,
      applicationHash: creds.appHash,
      applicationMetaData: {
        client: config.telcoClientType || 'MOBILEAPP',
        device: config.telcoDeviceModel || 'Mobile',
        os: config.telcoOsVersion || 'Android',
        appCode: creds.appCode,
      },
    };

    // IdeaMart OTP request specifies action: "1"
    if (provider === 'ideamart') {
      requestBody.action = '1';
    }

    this.logger.log(
      `[TELCO OTP REQUEST] Dispatching to ${provider.toUpperCase()} (${creds.otpRequestUrl}) for ${this.maskSubscriberId(subscriberId)}`,
    );

    let data: any = null;
    try {
      const response = await fetch(creds.otpRequestUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      data = await response.json().catch(() => null);
    } catch (networkErr: any) {
      this.logger.error(
        `[TELCO NETWORK ERROR] (${provider.toUpperCase()} otp_request) ${networkErr?.message}`,
      );
      throw new HttpException(
        'Could not reach your mobile operator right now. Please check your connection and try again.',
        HttpStatus.BAD_GATEWAY,
      );
    }

    const statusCode = (data?.statusCode || '').trim().toUpperCase();

    if (statusCode === 'S1000') {
      if (!data?.referenceNo) {
        this.logger.error(
          `[TELCO PROTOCOL ERROR] (${provider.toUpperCase()}) S1000 returned without referenceNo: ${JSON.stringify(data)}`,
        );
        throw new HttpException(
          'Mobile verification service returned an incomplete response. Please try again.',
          HttpStatus.BAD_GATEWAY,
        );
      }

      this.logger.log(
        `[TELCO OTP SENT] ✅ ${provider.toUpperCase()} S1000 for ${this.maskSubscriberId(subscriberId)} (ref: ${data.referenceNo.slice(0, 8)}...)`,
      );

      return {
        status: 'OTP_SENT',
        provider,
        referenceNo: String(data.referenceNo),
        subscriberId,
      };
    }

    // E1351 = User is already registered/subscribed on IdeaMart or mSpace
    if (statusCode === 'E1351') {
      this.logger.log(
        `[TELCO ALREADY REGISTERED] ℹ️ ${provider.toUpperCase()} E1351 for ${this.maskSubscriberId(subscriberId)}`,
      );
      return {
        status: 'ALREADY_REGISTERED',
        provider,
        subscriberId: data?.subscriberId ? String(data.subscriberId) : '',
      };
    }

    const resolution = resolveTelcoError(statusCode, data?.statusDetail, 'otp_request');
    this.recordAndLogTelcoError({
      provider,
      operation: 'otp_request',
      endpoint: creds.otpRequestUrl,
      subscriberId,
      rawStatusDetail: data?.statusDetail,
      resolution,
    });

    throw new HttpException(resolution.userMessage, resolution.httpStatus);
  }

  /**
   * 2. Verify Subscription OTP Pin with IdeaMart (Dialog) or mSpace (Mobitel)
   * Returns the Telco `subscriberId` which MUST be persisted for status & unsubscribe calls.
   */
  async verifyPin(
    provider: TelcoProviderType,
    otp: string,
    referenceNo: string,
    fallbackSubscriberId: string,
    config: TelcoGatewayConfig,
  ): Promise<TelcoPinVerifyResult> {
    const creds = this.getProviderCredentials(provider, config);

    if (!creds.appId || !creds.password) {
      this.logger.error(
        `[TELCO CONFIG MISSING] ${provider.toUpperCase()} credentials missing during verifyPin.`,
      );
      throw new HttpException(
        'Mobile verification service is temporarily unavailable. Please try again.',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }

    const requestBody = {
      applicationId: creds.appId,
      password: creds.password,
      otp: otp.trim(),
      referenceNo: referenceNo.trim(),
    };

    this.logger.log(
      `[TELCO OTP VERIFY] Verifying with ${provider.toUpperCase()} (${creds.otpVerifyUrl}) for ref ${referenceNo.slice(0, 8)}...`,
    );

    let data: any = null;
    try {
      const response = await fetch(creds.otpVerifyUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      data = await response.json().catch(() => null);
    } catch (networkErr: any) {
      this.logger.error(
        `[TELCO NETWORK ERROR] (${provider.toUpperCase()} otp_verify) ${networkErr?.message}`,
      );
      throw new HttpException(
        'Could not reach your mobile operator to verify the code. Please try again.',
        HttpStatus.BAD_GATEWAY,
      );
    }

    const statusCode = (data?.statusCode || '').trim().toUpperCase();

    if (statusCode === 'S1000') {
      // Save exact hashed subscriberId from Telco response without any formatting
      const rawSubscriberIdFromTelco =
        data?.subscriberId !== undefined && data?.subscriberId !== null
          ? String(data.subscriberId)
          : fallbackSubscriberId;

      this.logger.log(
        `[TELCO OTP VERIFIED] ✅ ${provider.toUpperCase()} S1000 — Saved raw subscriberId: ${this.maskSubscriberId(rawSubscriberIdFromTelco)}`,
      );

      return {
        success: true,
        provider,
        subscriberId: rawSubscriberIdFromTelco,
        subscriptionStatus: data?.subscriptionStatus || 'REGISTERED',
      };
    }

    const resolution = resolveTelcoError(statusCode, data?.statusDetail, 'otp_verify');
    this.recordAndLogTelcoError({
      provider,
      operation: 'otp_verify',
      endpoint: creds.otpVerifyUrl,
      subscriberId: fallbackSubscriberId,
      rawStatusDetail: data?.statusDetail,
      resolution,
    });

    throw new HttpException(resolution.userMessage, resolution.httpStatus);
  }

  /**
   * 3. Check Subscription Status (`getStatus`) on IdeaMart or mSpace
   * Uses the exact raw `subscriberId` hash saved from Verify OTP response.
   */
  async getStatus(
    provider: TelcoProviderType,
    subscriberId: string,
    config: TelcoGatewayConfig,
  ): Promise<TelcoStatusResult> {
    const creds = this.getProviderCredentials(provider, config);

    if (!creds.appId || !creds.password) {
      throw new HttpException(
        'Telco gateway credentials are not configured.',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }

    const requestBody = {
      applicationId: creds.appId,
      password: creds.password,
      subscriberId,
    };

    let data: any = null;
    try {
      const response = await fetch(creds.statusUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      data = await response.json().catch(() => null);
    } catch (networkErr: any) {
      this.logger.error(
        `[TELCO NETWORK ERROR] (${provider.toUpperCase()} status_check) ${networkErr?.message}`,
      );
      throw new HttpException(
        'Could not check subscription status with mobile operator right now.',
        HttpStatus.BAD_GATEWAY,
      );
    }

    const statusCode = (data?.statusCode || '').trim().toUpperCase();

    if (statusCode === 'S1000') {
      return {
        success: true,
        provider,
        subscriberId,
        subscriptionStatus: data?.subscriptionStatus || 'REGISTERED',
        statusCode,
      };
    }

    if (statusCode === 'E1356' || statusCode === 'E1365' || statusCode === 'E1951') {
      return {
        success: true,
        provider,
        subscriberId,
        subscriptionStatus: 'UNREGISTERED',
        statusCode,
      };
    }

    const resolution = resolveTelcoError(statusCode, data?.statusDetail, 'status_check');
    this.recordAndLogTelcoError({
      provider,
      operation: 'status_check',
      endpoint: creds.statusUrl,
      subscriberId,
      rawStatusDetail: data?.statusDetail,
      resolution,
    });

    throw new HttpException(resolution.userMessage, resolution.httpStatus);
  }

  /**
   * 4. Unsubscribe (`action: "0"`) on IdeaMart or mSpace using exact saved `subscriberId` hash
   * Fixes legacy Dialog E1951 issue by treating S1000, E1951, E1356, and E1365 as unsubscribed on both operators.
   */
  async unsubscribe(
    provider: TelcoProviderType,
    subscriberId: string,
    config: TelcoGatewayConfig,
  ): Promise<TelcoUnsubscribeResult> {
    const creds = this.getProviderCredentials(provider, config);

    if (!creds.appId || !creds.password) {
      this.logger.error(
        `[TELCO CONFIG MISSING] ${provider.toUpperCase()} credentials missing during unsubscribe.`,
      );
      throw new HttpException(
        'Mobile subscription service is temporarily unavailable. Please try again shortly.',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }

    const requestBody = {
      applicationId: creds.appId,
      password: creds.password,
      subscriberId,
      action: '0',
    };

    this.logger.log(
      `[TELCO UNSUBSCRIBE] Sending action=0 to ${provider.toUpperCase()} (${creds.unsubscribeUrl}) for ${this.maskSubscriberId(subscriberId)}`,
    );

    let data: any = null;
    try {
      const response = await fetch(creds.unsubscribeUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      data = await response.json().catch(() => null);
    } catch (networkErr: any) {
      this.logger.error(
        `[TELCO NETWORK ERROR] (${provider.toUpperCase()} unsubscribe) ${networkErr?.message}`,
      );
      throw new HttpException(
        'Could not reach your mobile operator to cancel the subscription. Please try again.',
        HttpStatus.BAD_GATEWAY,
      );
    }

    const statusCode = (data?.statusCode || '').trim().toUpperCase();

    // S1000 = Unsubscribed now; E1951 / E1356 / E1365 = Already unsubscribed on operator side
    if (
      statusCode === 'S1000' ||
      statusCode === 'E1951' ||
      statusCode === 'E1356' ||
      statusCode === 'E1365'
    ) {
      const alreadyUnsubscribed = statusCode !== 'S1000';
      this.logger.log(
        `[TELCO UNSUBSCRIBED] ✅ ${provider.toUpperCase()} (${statusCode}) for ${this.maskSubscriberId(subscriberId)}`,
      );
      return {
        success: true,
        provider,
        subscriberId,
        alreadyUnsubscribed,
        statusCode,
      };
    }

    const resolution = resolveTelcoError(statusCode, data?.statusDetail, 'unsubscribe');
    this.recordAndLogTelcoError({
      provider,
      operation: 'unsubscribe',
      endpoint: creds.unsubscribeUrl,
      subscriberId,
      rawStatusDetail: data?.statusDetail,
      resolution,
    });

    throw new HttpException(resolution.userMessage, resolution.httpStatus);
  }
}
