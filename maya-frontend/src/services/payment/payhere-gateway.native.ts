import { Alert } from 'react-native';
import { PayHereCheckoutParams, PayHerePaymentResult } from './payhere-types';

export class PayHereGatewayNative {
  async startPayment(params: PayHereCheckoutParams): Promise<PayHerePaymentResult> {
    return new Promise<PayHerePaymentResult>((resolve) => {
      try {
        // Dynamically load to prevent compilation errors if native module isn't present in Expo Go
        // In standalone native builds, @payhere/payhere-mobilesdk-reactnative is linked
        const PayHereModule = require('@payhere/payhere-mobilesdk-reactnative');
        const PayHere = PayHereModule.default || PayHereModule;

        if (!PayHere || typeof PayHere.startPayment !== 'function') {
          throw new Error('PayHere React Native Mobile SDK is not linked.');
        }

        PayHere.startPayment(
          params,
          (paymentId: string) => {
            resolve({ status: 'completed', orderId: paymentId });
          },
          (errorData: any) => {
            const errStr = typeof errorData === 'string' ? errorData : JSON.stringify(errorData);
            Alert.alert('Payment Error', errStr);
            resolve({ status: 'error', error: errStr });
          },
          () => {
            resolve({ status: 'dismissed' });
          }
        );
      } catch (err: any) {
        Alert.alert(
          'Mobile Payment',
          'PayHere mobile checkout is available in production native builds. Error: ' +
            (err.message || String(err))
        );
        resolve({ status: 'error', error: err.message });
      }
    });
  }
}

export const payHereGateway = new PayHereGatewayNative();
