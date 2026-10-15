import { PayHereCheckoutParams, PayHerePaymentResult } from './payhere-types';

declare global {
  interface Window {
    payhere?: {
      startPayment: (paymentObject: any) => void;
      onCompleted?: (orderId: string) => void;
      onDismissed?: () => void;
      onError?: (error: string) => void;
    };
  }
}

let scriptLoadingPromise: Promise<void> | null = null;

function loadPayHereWebScript(): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve();

  if (window.payhere) {
    return Promise.resolve();
  }

  if (scriptLoadingPromise) {
    return scriptLoadingPromise;
  }

  scriptLoadingPromise = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector('script[src*="payhere-2.0.js"]');
    if (existing) {
      resolve();
      return;
    }

    const script = document.createElement('script');
    script.type = 'text/javascript';
    script.src = 'https://www.payhere.lk/lib/payhere-2.0.js';
    script.async = true;

    script.onload = () => {
      resolve();
    };

    script.onerror = () => {
      scriptLoadingPromise = null;
      reject(new Error('Failed to load PayHere payment script.'));
    };

    document.head.appendChild(script);
  });

  return scriptLoadingPromise;
}

export class PayHereGatewayWeb {
  async startPayment(params: PayHereCheckoutParams): Promise<PayHerePaymentResult> {
    await loadPayHereWebScript();

    if (!window.payhere) {
      throw new Error('PayHere JavaScript SDK is not available.');
    }

    return new Promise<PayHerePaymentResult>((resolve) => {
      window.payhere!.onCompleted = (orderId: string) => {
        resolve({ status: 'completed', orderId });
      };

      window.payhere!.onDismissed = () => {
        resolve({ status: 'dismissed' });
      };

      window.payhere!.onError = (error: string) => {
        resolve({ status: 'error', error });
      };

      // In PayHere JS SDK, setting return_url and cancel_url to undefined prevents redirection away from the page
      const paymentObj = {
        ...params,
        return_url: undefined,
        cancel_url: undefined,
      };

      window.payhere!.startPayment(paymentObj);
    });
  }
}

export const payHereGateway = new PayHereGatewayWeb();
