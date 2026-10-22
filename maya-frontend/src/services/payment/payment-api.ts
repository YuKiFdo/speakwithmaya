import { Platform } from 'react-native';
import { OnboardingStore } from '../store/onboarding-store';
import {
  PayHereCheckoutParams,
  SubscriptionRecord,
  AdminSubscriptionsResponse,
} from './payhere-types';

const getBackendUrl = (): string => {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    const hostname = window.location.hostname;
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      return 'http://127.0.0.1:3000';
    }
    if (hostname.endsWith('speakwithmaya.com')) {
      return 'https://api.speakwithmaya.com';
    }
    if (
      hostname.includes('azurecontainerapps.io') ||
      hostname.includes('azurewebsites.net') ||
      hostname.includes('southeastasia')
    ) {
      return 'https://maya-backend.icyisland-5baf2c26.southeastasia.azurecontainerapps.io';
    }
  }
  return process.env.EXPO_PUBLIC_BACKEND_URL || 'http://127.0.0.1:3000';
};

class PaymentApiService {
  private baseUrl = getBackendUrl();

  private getAuthHeaders(): Record<string, string> {
    const token = OnboardingStore.getState().accessToken;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    return headers;
  }

  /**
   * Request server-signed checkout parameters for a subscription plan or top-up.
   */
  async getCheckoutParams(
    planTier: 'basic' | 'pro' | 'premium' | '3-months-pro' | '30-min' | '120-min' | '300-min',
    billingCycle: 'monthly' | '3-months' | 'yearly' = 'monthly',
    returnUrl?: string,
    cancelUrl?: string
  ): Promise<PayHereCheckoutParams> {
    const currentOrigin = typeof window !== 'undefined' ? window.location.origin : '';
    const currentPath = typeof window !== 'undefined' ? window.location.pathname : '';

    const effectiveReturnUrl =
      returnUrl || (currentOrigin ? `${currentOrigin}${currentPath}?payment=success` : undefined);
    const effectiveCancelUrl =
      cancelUrl || (currentOrigin ? `${currentOrigin}${currentPath}?payment=cancelled` : undefined);

    const res = await fetch(`${this.baseUrl}/v1/payments/payhere/checkout-params`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: JSON.stringify({
        planTier,
        billingCycle,
        returnUrl: effectiveReturnUrl,
        cancelUrl: effectiveCancelUrl,
      }),
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.message || 'Failed to initialize payment checkout');
    }

    return data.params;
  }

  /**
   * Generates server-signed PayHere Preapproval parameters for card update (zero charge).
   */
  async getCardUpdateParams(): Promise<PayHereCheckoutParams> {
    const currentOrigin = typeof window !== 'undefined' ? window.location.origin : '';
    const returnUrl = currentOrigin ? `${currentOrigin}/(tabs)/account?card_update=success` : undefined;
    const cancelUrl = currentOrigin ? `${currentOrigin}/(tabs)/account?card_update=cancelled` : undefined;
    return this.getCheckoutParams('card-update' as any, 'monthly', returnUrl, cancelUrl);
  }

  /**
   * Fetches user's current subscription from database.
   */
  async getMySubscription(): Promise<SubscriptionRecord | null> {
    const res = await fetch(`${this.baseUrl}/v1/subscriptions/my`, {
      method: 'GET',
      headers: this.getAuthHeaders(),
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.message || 'Failed to fetch subscription');
    }

    return data.subscription || null;
  }

  /**
   * Automated 1-Click Charging using pre-approved saved card.
   * Auto-deducts without requiring card entry or gateway popups.
   */
  async chargeSavedCard(payload: {
    packageId?: '30-min' | '120-min' | '300-min';
    planTier?: 'basic' | 'pro' | 'premium';
  }): Promise<{
    success: boolean;
    message: string;
    orderId?: string;
    newBalance?: number;
    planTier?: string;
    cardMasked?: string;
  }> {
    const res = await fetch(`${this.baseUrl}/v1/payments/payhere/charge-saved-card`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: JSON.stringify(payload),
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.message || 'Auto-charge failed');
    }

    return data;
  }

  /**
   * User self-service cancellation of active recurring plan.
   */
  async cancelSubscription(subscriptionId?: string, reason?: string): Promise<{ success: boolean; msg: string }> {
    const res = await fetch(`${this.baseUrl}/v1/subscriptions/cancel`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: JSON.stringify({ subscriptionId, reason }),
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.message || 'Failed to cancel subscription');
    }

    return data;
  }

  /**
   * Admin: List all subscribers and overall revenue stats.
   */
  async getAdminSubscriptions(): Promise<AdminSubscriptionsResponse> {
    const res = await fetch(`${this.baseUrl}/v1/admin/subscriptions`, {
      method: 'GET',
      headers: this.getAuthHeaders(),
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.message || 'Failed to fetch admin subscribers');
    }

    return data;
  }

  /**
   * Admin: List orders with filters (subscription renewals, talk-time top-ups, initial subscriptions).
   */
  async getAdminOrders(type: string = 'ALL', limit: number = 100): Promise<any[]> {
    const query = new URLSearchParams({ type, limit: String(limit) });
    const res = await fetch(`${this.baseUrl}/v1/admin/orders?${query.toString()}`, {
      method: 'GET',
      headers: this.getAuthHeaders(),
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.message || 'Failed to fetch admin orders');
    }

    return data.orders || [];
  }

  /**
   * Admin: View payment history for a subscription.
   */
  async getSubscriptionPayments(subscriptionId: string): Promise<any[]> {
    const res = await fetch(`${this.baseUrl}/v1/admin/subscriptions/${subscriptionId}/payments`, {
      method: 'GET',
      headers: this.getAuthHeaders(),
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.message || 'Failed to fetch payments');
    }

    return data.payments || [];
  }

  /**
   * Admin: Retry failed subscription charge.
   */
  async retrySubscription(subscriptionId: string): Promise<{ success: boolean; msg: string }> {
    const res = await fetch(`${this.baseUrl}/v1/admin/subscriptions/${subscriptionId}/retry`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.message || 'Failed to retry charge');
    }

    return data;
  }

  /**
   * Admin: Cancel user subscription.
   */
  async adminCancelSubscription(subscriptionId: string): Promise<{ success: boolean; msg: string }> {
    const res = await fetch(`${this.baseUrl}/v1/admin/subscriptions/${subscriptionId}/cancel`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.message || 'Failed to cancel subscription');
    }

    return data;
  }

  /**
   * Admin: Trigger on-demand reconciliation of past-due subscriptions and quotas.
   */
  async reconcileSubscriptions(): Promise<{
    timestamp: string;
    totalPastDueChecked: number;
    pastDueReinstated: number;
    pastDueDowngraded: number;
    quotasReset: number;
    renewalsAttempted?: number;
    renewalsSucceeded?: number;
    renewalsFailed?: number;
    pendingOrdersSwept?: number;
    pendingOrdersRecovered?: number;
    errors: string[];
  }> {
    const res = await fetch(`${this.baseUrl}/v1/admin/subscriptions/reconcile`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.message || 'Failed to trigger reconciliation');
    }

    return data;
  }

  /**
   * Resilient Payment Verification:
   * Direct verification against PayHere Gateway via backend recovery engine.
   * Ensures instant plan activation even after server restart or missed webhook.
   */
  async verifyOrder(orderId: string): Promise<{
    success: boolean;
    status: string;
    message: string;
    order?: any;
  }> {
    try {
      const res = await fetch(`${this.baseUrl}/v1/payments/payhere/verify-order/${encodeURIComponent(orderId)}`, {
        method: 'POST',
        headers: this.getAuthHeaders(),
      });

      const data = await res.json();
      return data;
    } catch (err: any) {
      return {
        success: false,
        status: 'NETWORK_ERROR',
        message: err.message || 'Network error verifying order',
      };
    }
  }
}

export const paymentApi = new PaymentApiService();
