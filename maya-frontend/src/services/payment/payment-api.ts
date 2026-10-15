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
   * Request server-signed checkout parameters for a subscription plan.
   */
  async getCheckoutParams(
    planTier: 'basic' | 'pro' | 'premium' | '3-months-pro' | '30-min' | '120-min' | '300-min',
    billingCycle: 'monthly' | '3-months' | 'yearly' = 'monthly'
  ): Promise<PayHereCheckoutParams> {
    const res = await fetch(`${this.baseUrl}/v1/payments/payhere/checkout-params`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: JSON.stringify({ planTier, billingCycle }),
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.message || 'Failed to initialize payment checkout');
    }

    return data.params;
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
}

export const paymentApi = new PaymentApiService();
