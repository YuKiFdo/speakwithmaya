import { HttpStatus } from '@nestjs/common';

export interface TelcoErrorResolution {
  code: string;
  officialDescription: string;
  userMessage: string;
  isSensitiveAdminError: boolean;
  httpStatus: number;
}

interface TelcoErrorDefinition {
  officialDescription: string;
  userMessage: string;
  isSensitiveAdminError: boolean;
  httpStatus: number;
}

const GENERIC_SERVICE_UNAVAILABLE_MSG =
  'Mobile verification service is temporarily unavailable. Please try again in a few moments.';

const GENERIC_DELIVERY_FAILED_MSG =
  'Could not send the verification SMS to your number right now. Please check your signal and try again.';

const GENERIC_CHARGING_ERROR_MSG =
  'Could not process mobile billing at the moment. Please try again shortly.';

/**
 * Complete IdeaMart (Dialog) & mSpace (Mobitel) Error Code Dictionary.
 *
 * Security rule:
 * - Admin/configuration/infrastructure errors (isSensitiveAdminError = true) NEVER expose
 *   raw ApplicationID, SP, IP whitelist, NCS, SDP-SBL, PGW, or credential details to end users.
 *   They are logged in full on the backend console and stored in the admin error log.
 * - User-actionable errors (balance, OTP, invalid number, rate limit) return clear, polite instructions.
 */
export const TELCO_ERROR_DEFINITIONS: Record<string, TelcoErrorDefinition> = {
  E1301: {
    officialDescription: 'Requested ApplicationID is not allowed within the System',
    userMessage: GENERIC_SERVICE_UNAVAILABLE_MSG,
    isSensitiveAdminError: true,
    httpStatus: HttpStatus.SERVICE_UNAVAILABLE,
  },
  E1302: {
    officialDescription: 'Requested SP is not allowed within the System',
    userMessage: GENERIC_SERVICE_UNAVAILABLE_MSG,
    isSensitiveAdminError: true,
    httpStatus: HttpStatus.SERVICE_UNAVAILABLE,
  },
  E1303: {
    officialDescription:
      'IP address, which the request originates from, is not listed within the allowed-host-address list',
    userMessage: GENERIC_SERVICE_UNAVAILABLE_MSG,
    isSensitiveAdminError: true,
    httpStatus: HttpStatus.SERVICE_UNAVAILABLE,
  },
  E1304: {
    officialDescription: 'Requested Application is not found within the System',
    userMessage: GENERIC_SERVICE_UNAVAILABLE_MSG,
    isSensitiveAdminError: true,
    httpStatus: HttpStatus.SERVICE_UNAVAILABLE,
  },
  E1305: {
    officialDescription: 'Requested ApplicationID is invalid',
    userMessage: GENERIC_SERVICE_UNAVAILABLE_MSG,
    isSensitiveAdminError: true,
    httpStatus: HttpStatus.SERVICE_UNAVAILABLE,
  },
  E1306: {
    officialDescription: 'Routing Key (shortcode/ keyword) for the NCS service is invalid',
    userMessage: GENERIC_SERVICE_UNAVAILABLE_MSG,
    isSensitiveAdminError: true,
    httpStatus: HttpStatus.SERVICE_UNAVAILABLE,
  },
  E1307: {
    officialDescription: 'Requested SP is not found within the System',
    userMessage: GENERIC_SERVICE_UNAVAILABLE_MSG,
    isSensitiveAdminError: true,
    httpStatus: HttpStatus.SERVICE_UNAVAILABLE,
  },
  E1308: {
    officialDescription: 'Error during the charging operation',
    userMessage:
      'Could not complete the mobile billing request. Please check your mobile balance and try again.',
    isSensitiveAdminError: false,
    httpStatus: HttpStatus.BAD_REQUEST,
  },
  E1309: {
    officialDescription: 'Requested service is not allowed for this Application',
    userMessage: GENERIC_SERVICE_UNAVAILABLE_MSG,
    isSensitiveAdminError: true,
    httpStatus: HttpStatus.SERVICE_UNAVAILABLE,
  },
  E1310: {
    officialDescription: 'MO flow is not allowed for this Application',
    userMessage: GENERIC_SERVICE_UNAVAILABLE_MSG,
    isSensitiveAdminError: true,
    httpStatus: HttpStatus.SERVICE_UNAVAILABLE,
  },
  E1311: {
    officialDescription: 'MT flow is not allowed for this Application',
    userMessage: GENERIC_SERVICE_UNAVAILABLE_MSG,
    isSensitiveAdminError: true,
    httpStatus: HttpStatus.SERVICE_UNAVAILABLE,
  },
  E1312: {
    officialDescription: 'Invalid request',
    userMessage: 'Unable to process your request. Please check your mobile number and try again.',
    isSensitiveAdminError: true,
    httpStatus: HttpStatus.BAD_REQUEST,
  },
  E1313: {
    officialDescription:
      'Authentication failure. There is no active application, or no active service provider or given password in the request is invalid.',
    userMessage: GENERIC_SERVICE_UNAVAILABLE_MSG,
    isSensitiveAdminError: true,
    httpStatus: HttpStatus.SERVICE_UNAVAILABLE,
  },
  E1315: {
    officialDescription: 'Requested NCS service is not available',
    userMessage: GENERIC_SERVICE_UNAVAILABLE_MSG,
    isSensitiveAdminError: true,
    httpStatus: HttpStatus.SERVICE_UNAVAILABLE,
  },
  E1316: {
    officialDescription: 'Sorry, the {0} application is temporarily unavailable. Please try again later.',
    userMessage: GENERIC_SERVICE_UNAVAILABLE_MSG,
    isSensitiveAdminError: true,
    httpStatus: HttpStatus.SERVICE_UNAVAILABLE,
  },
  E1317: {
    officialDescription:
      'MSISDN which is in the request is in invalid state. (MSISDN may be in a Blocked State, MSISDN may have invalid length of digit)',
    userMessage:
      'This mobile number is invalid or currently inactive on the network. Please check the number and try again.',
    isSensitiveAdminError: false,
    httpStatus: HttpStatus.BAD_REQUEST,
  },
  E1318: {
    officialDescription: 'Sorry, the {0} application is temporarily unavailable. Please try again later.',
    userMessage: GENERIC_SERVICE_UNAVAILABLE_MSG,
    isSensitiveAdminError: true,
    httpStatus: HttpStatus.SERVICE_UNAVAILABLE,
  },
  E1319: {
    officialDescription: 'Sorry, the {0} application is temporarily unavailable. Please try again later.',
    userMessage: GENERIC_SERVICE_UNAVAILABLE_MSG,
    isSensitiveAdminError: true,
    httpStatus: HttpStatus.SERVICE_UNAVAILABLE,
  },
  E1322: {
    officialDescription: 'Requested sender is not allowed',
    userMessage: GENERIC_SERVICE_UNAVAILABLE_MSG,
    isSensitiveAdminError: true,
    httpStatus: HttpStatus.SERVICE_UNAVAILABLE,
  },
  E1323: {
    officialDescription: 'Requested recipients not allowed',
    userMessage: 'This mobile number cannot receive verification messages from this service.',
    isSensitiveAdminError: true,
    httpStatus: HttpStatus.BAD_REQUEST,
  },
  E1324: {
    officialDescription: 'Subscription via HTTP is not allowed',
    userMessage: GENERIC_SERVICE_UNAVAILABLE_MSG,
    isSensitiveAdminError: true,
    httpStatus: HttpStatus.SERVICE_UNAVAILABLE,
  },
  E1325: {
    officialDescription: 'Format of the address is invalid',
    userMessage: 'Please enter a valid Sri Lankan mobile number (e.g. 077 123 4567).',
    isSensitiveAdminError: false,
    httpStatus: HttpStatus.BAD_REQUEST,
  },
  E1326: {
    officialDescription:
      'Sorry, your SMS sent to {0} application could not be processed. Please check if you have sufficient balance and try again.',
    userMessage:
      'Insufficient mobile balance to subscribe. Please top up your mobile account and try again.',
    isSensitiveAdminError: false,
    httpStatus: HttpStatus.BAD_REQUEST,
  },
  E1327: {
    officialDescription: 'App id not allowed in pgw',
    userMessage: GENERIC_SERVICE_UNAVAILABLE_MSG,
    isSensitiveAdminError: true,
    httpStatus: HttpStatus.SERVICE_UNAVAILABLE,
  },
  E1328: {
    officialDescription: 'Charging operation not allowed. Please check the NCS configuration.',
    userMessage: GENERIC_CHARGING_ERROR_MSG,
    isSensitiveAdminError: true,
    httpStatus: HttpStatus.SERVICE_UNAVAILABLE,
  },
  E1329: {
    officialDescription: 'Charging amount too high. Please check the NCS configuration.',
    userMessage: GENERIC_CHARGING_ERROR_MSG,
    isSensitiveAdminError: true,
    httpStatus: HttpStatus.SERVICE_UNAVAILABLE,
  },
  E1330: {
    officialDescription: 'Charging amount too low. Please check the NCS configuration.',
    userMessage: GENERIC_CHARGING_ERROR_MSG,
    isSensitiveAdminError: true,
    httpStatus: HttpStatus.SERVICE_UNAVAILABLE,
  },
  E1331: {
    officialDescription:
      'Sorry, invalid/unauthorized source address. Please check the availability of default sender address or aliases for SMS-MT in {0} application.',
    userMessage: GENERIC_SERVICE_UNAVAILABLE_MSG,
    isSensitiveAdminError: true,
    httpStatus: HttpStatus.SERVICE_UNAVAILABLE,
  },
  E1332: {
    officialDescription: 'Delivery failed',
    userMessage: GENERIC_DELIVERY_FAILED_MSG,
    isSensitiveAdminError: false,
    httpStatus: HttpStatus.BAD_GATEWAY,
  },
  E1333: {
    officialDescription:
      'Message contain suspective abusive content or subscriber base is larger than limit, will be stored for admin approval',
    userMessage: GENERIC_DELIVERY_FAILED_MSG,
    isSensitiveAdminError: true,
    httpStatus: HttpStatus.SERVICE_UNAVAILABLE,
  },
  E1334: {
    officialDescription: 'Message length is too long. Maximum message length is {0}',
    userMessage: GENERIC_DELIVERY_FAILED_MSG,
    isSensitiveAdminError: true,
    httpStatus: HttpStatus.SERVICE_UNAVAILABLE,
  },
  E1335: {
    officialDescription:
      'Message length is too long. Maximum message length for advertisement messages is {0}.',
    userMessage: GENERIC_DELIVERY_FAILED_MSG,
    isSensitiveAdminError: true,
    httpStatus: HttpStatus.SERVICE_UNAVAILABLE,
  },
  E1336: {
    officialDescription: 'No matching service code found for the charging amount',
    userMessage: GENERIC_CHARGING_ERROR_MSG,
    isSensitiveAdminError: true,
    httpStatus: HttpStatus.SERVICE_UNAVAILABLE,
  },
  E1337: {
    officialDescription: 'Subscriber authentication by charging gateway failed.',
    userMessage:
      'Your mobile operator could not authorize billing for this number. Please check your account status or balance and try again.',
    isSensitiveAdminError: true,
    httpStatus: HttpStatus.BAD_REQUEST,
  },
  E1340: {
    officialDescription: 'Invalid request - {0}',
    userMessage: 'Unable to process your request. Please check your details and try again.',
    isSensitiveAdminError: true,
    httpStatus: HttpStatus.BAD_REQUEST,
  },
  E1341: {
    officialDescription:
      'Delivery failed. Errors occurred while sending the request for the intended destinations',
    userMessage: GENERIC_DELIVERY_FAILED_MSG,
    isSensitiveAdminError: false,
    httpStatus: HttpStatus.BAD_GATEWAY,
  },
  E1342: {
    officialDescription: 'Sorry, Your phone number is blacklisted to use this application {0}',
    userMessage:
      'Sorry, this mobile number is restricted from using this subscription service.',
    isSensitiveAdminError: false,
    httpStatus: HttpStatus.FORBIDDEN,
  },
  E1343: {
    officialDescription: 'Non white listed mobile number accessing services of application {0}',
    userMessage:
      'Sorry, this mobile number is not authorized to access this service right now.',
    isSensitiveAdminError: false,
    httpStatus: HttpStatus.FORBIDDEN,
  },
  E1344: {
    officialDescription:
      'Sorry, your SMS sent to {0} application could not be processed. Please check if you have sufficient balance and try again.',
    userMessage:
      'Insufficient mobile balance to complete your subscription. Please top up your credit and try again.',
    isSensitiveAdminError: false,
    httpStatus: HttpStatus.BAD_REQUEST,
  },
  E1351: {
    officialDescription: 'User already registered',
    userMessage: 'This mobile number is already subscribed.',
    isSensitiveAdminError: false,
    httpStatus: HttpStatus.OK,
  },
  E1356: {
    officialDescription: 'User not registered',
    userMessage: 'This mobile number does not have an active subscription.',
    isSensitiveAdminError: false,
    httpStatus: HttpStatus.BAD_REQUEST,
  },
  E1357: {
    officialDescription: 'Sorry, you are unauthorised to use the {0} application.',
    userMessage: 'Sorry, this mobile number is not authorized to use this service.',
    isSensitiveAdminError: false,
    httpStatus: HttpStatus.FORBIDDEN,
  },
  E1360: {
    officialDescription: 'Error response from SDP-SBL',
    userMessage: GENERIC_SERVICE_UNAVAILABLE_MSG,
    isSensitiveAdminError: true,
    httpStatus: HttpStatus.BAD_GATEWAY,
  },
  E1361: {
    officialDescription: 'Message rejected by SDP-SBL',
    userMessage: GENERIC_SERVICE_UNAVAILABLE_MSG,
    isSensitiveAdminError: true,
    httpStatus: HttpStatus.BAD_GATEWAY,
  },
  E1362: {
    officialDescription: 'Invalid request',
    userMessage: 'Unable to process your request. Please check your details and try again.',
    isSensitiveAdminError: true,
    httpStatus: HttpStatus.BAD_REQUEST,
  },
  E1363: {
    officialDescription: 'No response/response delayed from SDP-SBL',
    userMessage: 'Your mobile operator took too long to respond. Please try again in a moment.',
    isSensitiveAdminError: true,
    httpStatus: HttpStatus.GATEWAY_TIMEOUT,
  },
  E1364: {
    officialDescription: 'Could not send the message to SDP-SBL',
    userMessage: GENERIC_SERVICE_UNAVAILABLE_MSG,
    isSensitiveAdminError: true,
    httpStatus: HttpStatus.BAD_GATEWAY,
  },
  E1365: {
    officialDescription: 'Subscriber is not registered to use this application',
    userMessage: 'This mobile number is not currently subscribed.',
    isSensitiveAdminError: false,
    httpStatus: HttpStatus.BAD_REQUEST,
  },
  E1366: {
    officialDescription: 'Mt Delivery failed',
    userMessage: GENERIC_DELIVERY_FAILED_MSG,
    isSensitiveAdminError: true,
    httpStatus: HttpStatus.BAD_GATEWAY,
  },
  E1367: {
    officialDescription: 'Request QOS not supported',
    userMessage: GENERIC_SERVICE_UNAVAILABLE_MSG,
    isSensitiveAdminError: true,
    httpStatus: HttpStatus.SERVICE_UNAVAILABLE,
  },
  E1368: {
    officialDescription: 'Requested ServiceType not supported',
    userMessage: GENERIC_SERVICE_UNAVAILABLE_MSG,
    isSensitiveAdminError: true,
    httpStatus: HttpStatus.SERVICE_UNAVAILABLE,
  },
  E1370: {
    officialDescription: 'Invalid reservation Id.',
    userMessage: GENERIC_CHARGING_ERROR_MSG,
    isSensitiveAdminError: true,
    httpStatus: HttpStatus.BAD_REQUEST,
  },
  E1371: {
    officialDescription: 'App do not accept payments from given Payment Instrument',
    userMessage: 'Your selected mobile billing method is not supported for this service.',
    isSensitiveAdminError: true,
    httpStatus: HttpStatus.BAD_REQUEST,
  },
  E1372: {
    officialDescription: 'Default payment instrument for the user not found.',
    userMessage: 'No active mobile billing account was found for this number.',
    isSensitiveAdminError: false,
    httpStatus: HttpStatus.BAD_REQUEST,
  },
  E1373: {
    officialDescription: 'Invalid payer account.',
    userMessage: 'Your mobile billing account could not be verified. Please check with your operator.',
    isSensitiveAdminError: false,
    httpStatus: HttpStatus.BAD_REQUEST,
  },
  E1374: {
    officialDescription: 'Invalid payee account.',
    userMessage: GENERIC_CHARGING_ERROR_MSG,
    isSensitiveAdminError: true,
    httpStatus: HttpStatus.SERVICE_UNAVAILABLE,
  },
  E1375: {
    officialDescription: 'Transfer between two different payment instruments is not allowed.',
    userMessage: GENERIC_CHARGING_ERROR_MSG,
    isSensitiveAdminError: true,
    httpStatus: HttpStatus.BAD_REQUEST,
  },
  E1376: {
    officialDescription: 'Unknown charging error.',
    userMessage: GENERIC_CHARGING_ERROR_MSG,
    isSensitiveAdminError: true,
    httpStatus: HttpStatus.BAD_GATEWAY,
  },
  E1377: {
    officialDescription: 'Invalid payment instrument name.',
    userMessage: GENERIC_CHARGING_ERROR_MSG,
    isSensitiveAdminError: true,
    httpStatus: HttpStatus.SERVICE_UNAVAILABLE,
  },
  E1378: {
    officialDescription: 'Insufficient balance.',
    userMessage:
      'Insufficient mobile balance to complete your subscription. Please top up your credit and try again.',
    isSensitiveAdminError: false,
    httpStatus: HttpStatus.BAD_REQUEST,
  },
  E1379: {
    officialDescription: 'Transaction has already completed.',
    userMessage: 'This subscription request has already been processed.',
    isSensitiveAdminError: false,
    httpStatus: HttpStatus.BAD_REQUEST,
  },
  E1380: {
    officialDescription: 'Transaction currency not supported.',
    userMessage: GENERIC_CHARGING_ERROR_MSG,
    isSensitiveAdminError: true,
    httpStatus: HttpStatus.SERVICE_UNAVAILABLE,
  },
  E1381: {
    officialDescription: 'IP address, which the request originates from is not allowed access this service.',
    userMessage: GENERIC_SERVICE_UNAVAILABLE_MSG,
    isSensitiveAdminError: true,
    httpStatus: HttpStatus.SERVICE_UNAVAILABLE,
  },
  E1382: {
    officialDescription: 'Payment Instrument is not allowed perform transactions.',
    userMessage: 'Mobile billing is currently restricted on this number.',
    isSensitiveAdminError: false,
    httpStatus: HttpStatus.FORBIDDEN,
  },
  E1383: {
    officialDescription: 'USSD network initiated flow not allowed.',
    userMessage: GENERIC_SERVICE_UNAVAILABLE_MSG,
    isSensitiveAdminError: true,
    httpStatus: HttpStatus.SERVICE_UNAVAILABLE,
  },
  E1384: {
    officialDescription: 'International SMS sending is disabled.',
    userMessage: 'Only Sri Lankan (+94) mobile numbers are supported.',
    isSensitiveAdminError: false,
    httpStatus: HttpStatus.BAD_REQUEST,
  },
  E1387: {
    officialDescription: 'NCS SLA configured Merchant ID not found in DB.',
    userMessage: GENERIC_SERVICE_UNAVAILABLE_MSG,
    isSensitiveAdminError: true,
    httpStatus: HttpStatus.SERVICE_UNAVAILABLE,
  },
  E1400: {
    officialDescription: 'Card Management Module Unavailable',
    userMessage: GENERIC_SERVICE_UNAVAILABLE_MSG,
    isSensitiveAdminError: true,
    httpStatus: HttpStatus.SERVICE_UNAVAILABLE,
  },
  E1401: {
    officialDescription: 'Invalid NFC Token',
    userMessage: GENERIC_SERVICE_UNAVAILABLE_MSG,
    isSensitiveAdminError: true,
    httpStatus: HttpStatus.BAD_REQUEST,
  },
  E1402: {
    officialDescription: 'NFC Token do not match with request',
    userMessage: GENERIC_SERVICE_UNAVAILABLE_MSG,
    isSensitiveAdminError: true,
    httpStatus: HttpStatus.BAD_REQUEST,
  },
  E1404: {
    officialDescription: 'Charging Failed.',
    userMessage:
      'Mobile billing failed. Please ensure you have sufficient airtime balance and try again.',
    isSensitiveAdminError: false,
    httpStatus: HttpStatus.BAD_REQUEST,
  },
  E1405: {
    officialDescription: 'Charging Authorization Timeouted.',
    userMessage: 'Mobile billing authorization timed out. Please try again.',
    isSensitiveAdminError: false,
    httpStatus: HttpStatus.GATEWAY_TIMEOUT,
  },
  E1406: {
    officialDescription: 'Charging Authorization Rejected.',
    userMessage:
      'Mobile billing authorization was declined. Please check your mobile balance and try again.',
    isSensitiveAdminError: false,
    httpStatus: HttpStatus.BAD_REQUEST,
  },
  E1600: {
    officialDescription: 'Sorry, the {0} application is temporarily unavailable. Please try again later.',
    userMessage: GENERIC_SERVICE_UNAVAILABLE_MSG,
    isSensitiveAdminError: true,
    httpStatus: HttpStatus.SERVICE_UNAVAILABLE,
  },
  E1601: {
    officialDescription: 'An unexpected error has occurred',
    userMessage: GENERIC_SERVICE_UNAVAILABLE_MSG,
    isSensitiveAdminError: true,
    httpStatus: HttpStatus.INTERNAL_SERVER_ERROR,
  },
  E1602: {
    officialDescription: 'Message delivery failed',
    userMessage: GENERIC_DELIVERY_FAILED_MSG,
    isSensitiveAdminError: false,
    httpStatus: HttpStatus.BAD_GATEWAY,
  },
  E1603: {
    officialDescription:
      'Temporary System Error occurred while delivering your request / OTP expired or already used.',
    userMessage:
      'This verification code has expired or could not be verified. Please request a new code and try again.',
    isSensitiveAdminError: false,
    httpStatus: HttpStatus.BAD_REQUEST,
  },
  E1605: {
    officialDescription: 'Invalid charging request',
    userMessage: GENERIC_CHARGING_ERROR_MSG,
    isSensitiveAdminError: true,
    httpStatus: HttpStatus.SERVICE_UNAVAILABLE,
  },
  E1606: {
    officialDescription: 'Invalid charging amount',
    userMessage: GENERIC_CHARGING_ERROR_MSG,
    isSensitiveAdminError: true,
    httpStatus: HttpStatus.SERVICE_UNAVAILABLE,
  },
  E1825: {
    officialDescription: 'Unsupported operation',
    userMessage: GENERIC_SERVICE_UNAVAILABLE_MSG,
    isSensitiveAdminError: true,
    httpStatus: HttpStatus.SERVICE_UNAVAILABLE,
  },
  E1830: {
    officialDescription: 'This service is not available for {0} users.',
    userMessage: 'This subscription service is currently not available for your mobile network.',
    isSensitiveAdminError: false,
    httpStatus: HttpStatus.BAD_REQUEST,
  },
  E1850: {
    officialDescription: 'Invalid OTP code entered by subscriber',
    userMessage: 'Incorrect verification code. Please check the code sent to your phone and try again.',
    isSensitiveAdminError: false,
    httpStatus: HttpStatus.BAD_REQUEST,
  },
  E1851: {
    officialDescription: 'OTP request has been expired',
    userMessage: 'Verification code has expired. Please request a new code.',
    isSensitiveAdminError: false,
    httpStatus: HttpStatus.BAD_REQUEST,
  },
  E1852: {
    officialDescription: 'Maximum number of OTP attempts had reached',
    userMessage: 'Maximum verification attempts exceeded. Please request a new code.',
    isSensitiveAdminError: false,
    httpStatus: HttpStatus.TOO_MANY_REQUESTS,
  },
  E1853: {
    officialDescription: 'Maximum number of OTP requests reached',
    userMessage:
      'Maximum number of verification code requests reached. Please wait a few minutes and try again.',
    isSensitiveAdminError: false,
    httpStatus: HttpStatus.TOO_MANY_REQUESTS,
  },
  E1951: {
    officialDescription: 'Subscriber is already unsubscribed',
    userMessage: 'Your subscription has already been cancelled.',
    isSensitiveAdminError: false,
    httpStatus: HttpStatus.OK,
  },
};

/**
 * Resolves a Telco statusCode + statusDetail into a safe user-facing message
 * and full diagnostic metadata for backend logging.
 */
export function resolveTelcoError(
  statusCode?: string,
  statusDetail?: string,
  context: 'otp_request' | 'otp_verify' | 'status_check' | 'unsubscribe' = 'otp_request',
): TelcoErrorResolution {
  const normalizedCode = (statusCode || 'UNKNOWN').trim().toUpperCase();
  const definition = TELCO_ERROR_DEFINITIONS[normalizedCode];

  if (definition) {
    let userMessage = definition.userMessage;

    // Context-aware refinement for E1603 (during OTP request it's a temporary system error; during OTP verify it's expired/used OTP)
    if (normalizedCode === 'E1603' && context === 'otp_request') {
      userMessage =
        'A temporary error occurred while sending your verification code. Please try again in a moment.';
    }

    return {
      code: normalizedCode,
      officialDescription: definition.officialDescription,
      userMessage,
      isSensitiveAdminError: definition.isSensitiveAdminError,
      httpStatus: definition.httpStatus,
    };
  }

  return {
    code: normalizedCode,
    officialDescription: statusDetail || 'Unrecognized telco gateway error',
    userMessage:
      context === 'otp_verify'
        ? 'Could not verify the code right now. Please check the code or request a new one.'
        : GENERIC_SERVICE_UNAVAILABLE_MSG,
    isSensitiveAdminError: true,
    httpStatus: HttpStatus.BAD_GATEWAY,
  };
}
