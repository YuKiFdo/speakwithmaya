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
    // If action_url or preapprove is set, use PayHere Preapproval API (form POST submission)
    if (params.action_url || params.preapprove) {
      if (typeof window === 'undefined') {
        return { status: 'error', error: 'Window context is unavailable.' };
      }

      const targetUrl =
        params.action_url ||
        (params.sandbox
          ? 'https://sandbox.payhere.lk/pay/preapprove'
          : 'https://www.payhere.lk/pay/preapprove');

      const currentOrigin = window.location.origin;
      const currentPath = window.location.pathname;

      const ensureOrderIdParam = (url: string, orderId: string): string => {
        if (!orderId || url.includes('order_id=')) return url;
        const sep = url.includes('?') ? '&' : '?';
        return `${url}${sep}order_id=${encodeURIComponent(orderId)}`;
      };

      const returnUrl = ensureOrderIdParam(
        params.return_url || `${currentOrigin}${currentPath}?payment=success`,
        params.order_id
      );
      const cancelUrl = ensureOrderIdParam(
        params.cancel_url || `${currentOrigin}${currentPath}?payment=cancelled`,
        params.order_id
      );

      const form = document.createElement('form');
      form.method = 'POST';
      form.action = targetUrl;
      form.style.display = 'none';

      const fields: Record<string, string | undefined> = {
        merchant_id: params.merchant_id,
        return_url: returnUrl,
        cancel_url: cancelUrl,
        notify_url: params.notify_url,
        first_name: params.first_name,
        last_name: params.last_name,
        email: params.email,
        phone: params.phone,
        address: params.address,
        city: params.city,
        country: params.country,
        order_id: params.order_id,
        items: params.items,
        currency: params.currency,
        hash: params.hash,
        amount: params.amount,
        custom_1: params.custom_1,
        custom_2: params.custom_2,
      };

      for (const [key, val] of Object.entries(fields)) {
        if (val !== undefined && val !== null && val !== '') {
          const input = document.createElement('input');
          input.type = 'hidden';
          input.name = key;
          input.value = val;
          form.appendChild(input);
        }
      }

      document.body.appendChild(form);
      form.submit();

      // Form submission triggers browser navigation to PayHere preapproval gateway
      return new Promise<PayHerePaymentResult>(() => {});
    }

    // Standard one-time payment (Top-up): Use PayHere JavaScript SDK popup modal
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
