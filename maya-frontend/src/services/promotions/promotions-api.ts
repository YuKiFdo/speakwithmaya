import { getBackendBaseUrl } from '@/utils/backend-url';
import { OnboardingStore } from '@/services/store/onboarding-store';
import { AdminAuthStore } from '@/services/store/admin-auth-store';

export interface PromotionClaim {
  id: string;
  user_id: string;
  promo_code: string;
  campaign_name: string;
  reward_type: 'pro_pass' | 'bonus_minutes' | 'discount_pass';
  reward_value: number;
  original_tier: string;
  claimed_at: string;
  expires_at?: string | null;
  status: 'active' | 'used' | 'expired';
  metadata?: any;
  user?: {
    id: string;
    phoneNumber: string;
    displayName: string;
    email?: string | null;
    avatarUrl?: string | null;
    level: string;
    currentTier: string;
    planStatus: string;
    minutesBalance: number;
  };
}

export interface PromotionCampaign {
  id: string;
  title: string;
  description?: string;
  promoType?: 'comeback' | 'holiday' | 'referral' | 'marketing';
  status: 'active' | 'scheduled' | 'ended' | 'draft';
  rewardType?: 'pro_pass' | 'bonus_minutes' | 'discount_pass';
  rewardValue?: number;
  trialDays?: number;
  starterRewardType?: 'pro_pass' | 'bonus_minutes';
  starterRewardValue?: number;
  starterTrialDays?: number;
  paidRewardType?: 'bonus_minutes';
  paidRewardValue?: number;
  targetAudience: 'all' | 'old_only' | 'new_only';
  targetTiers?: string[];
  userCreatedBefore?: string | null;
  userCreatedAfter?: string | null;
  validDays?: number;
  startDate?: string;
  endDate?: string;
  totalClaims?: number;
  starterProPassClaims?: number;
  paidBonusClaims?: number;
}

export interface PromotionsOverviewData {
  totalComebacks: number;
  totalClaims: number;
  starterProPassClaims: number;
  paidBonusClaims: number;
  campaigns: Array<{
    id: string;
    name: string;
    status: string;
    totalClaims: number;
    starterProPassClaims: number;
    paidBonusClaims: number;
  }>;
}

class PromotionsApi {
  private baseUrl = getBackendBaseUrl();

  private getUserHeaders(): HeadersInit {
    const token = OnboardingStore.getState().accessToken;
    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token || 'dev-token'}`,
    };
  }

  private getAdminHeaders(): HeadersInit {
    const token = AdminAuthStore.getToken();
    return {
      'Content-Type': 'application/json',
      'x-admin-token': token || '',
    };
  }

  /**
   * Ping backend when user visits after outage
   */
  async recordComebackPing(campaign: string = 'outage_recovery') {
    try {
      const token = OnboardingStore.getState().accessToken;
      if (!token) return;

      await fetch(`${this.baseUrl}/v1/promotions/comeback-ping`, {
        method: 'POST',
        headers: this.getUserHeaders(),
        body: JSON.stringify({ metadata: { campaign } }),
      });
    } catch {}
  }

  private eligibilityPromises: Record<
    string,
    Promise<{
      available: boolean;
      alreadyClaimed?: boolean;
      campaign?: any;
      reason?: string;
    }>
  > = {};

  /**
   * Check if user is eligible to claim a promotion (verifies DB claim history and campaign period).
   * Caches in-flight/completed promise for instant reuse across components.
   */
  checkEligibility(promoCode: string = 'outage-comeback-nov26'): Promise<{
    available: boolean;
    alreadyClaimed?: boolean;
    campaign?: any;
    reason?: string;
  }> {
    const key = (promoCode || 'outage-comeback-nov26').trim().toLowerCase();
    if (key in this.eligibilityPromises) {
      return this.eligibilityPromises[key]!;
    }

    const promise = (async () => {
      try {
        const res = await fetch(`${this.baseUrl}/v1/promotions/check/${encodeURIComponent(key)}`, {
          headers: this.getUserHeaders(),
        });
        if (res.ok) {
          return await res.json();
        }
        return { available: false, reason: 'error_response' };
      } catch {
        return { available: false, reason: 'network_error' };
      }
    })();

    this.eligibilityPromises[key] = promise;
    return promise;
  }

  /**
   * Invalidate eligibility cache after claiming
   */
  clearEligibilityCache(promoCode?: string) {
    if (promoCode) {
      delete this.eligibilityPromises[promoCode.trim().toLowerCase()];
    } else {
      this.eligibilityPromises = {};
    }
  }

  /**
   * Claim comeback/apology promo
   */
  async claimPromotion(promoCode: string = 'outage-comeback-nov26') {
    const res = await fetch(`${this.baseUrl}/v1/promotions/claim`, {
      method: 'POST',
      headers: this.getUserHeaders(),
      body: JSON.stringify({ promoCode }),
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.message || 'Failed to claim promotion');
    }

    this.clearEligibilityCache(promoCode);

    if (data.profile?.minutes_balance !== undefined) {
      OnboardingStore.updateMinutesBalance(data.profile.minutes_balance);
    }

    return data;
  }

  /**
   * Admin: Get promotions and comebacks overview
   */
  async getAdminPromotionsOverview(): Promise<PromotionsOverviewData> {
    const res = await fetch(`${this.baseUrl}/v1/admin/promotions/overview`, {
      headers: this.getAdminHeaders(),
    });
    if (!res.ok) {
      throw new Error('Failed to fetch promotions overview');
    }
    return res.json();
  }

  /**
   * Admin: Get paginated promotion claims list
   */
  async getAdminPromotionClaims(query: {
    promoCode?: string;
    search?: string;
    page?: number;
    limit?: number;
  } = {}): Promise<{
    data: PromotionClaim[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const params = new URLSearchParams();
    if (query.promoCode) params.set('promoCode', query.promoCode);
    if (query.search) params.set('search', query.search);
    if (query.page) params.set('page', String(query.page));
    if (query.limit) params.set('limit', String(query.limit));
    if ((query as any).pageSize) params.set('pageSize', String((query as any).pageSize));

    const res = await fetch(`${this.baseUrl}/v1/admin/promotions/claims?${params.toString()}`, {
      headers: this.getAdminHeaders(),
    });
    if (!res.ok) {
      throw new Error('Failed to fetch promotion claims');
    }
    return res.json();
  }

  /**
   * Admin: List all promotion / comeback campaigns
   */
  async getCampaigns(): Promise<PromotionCampaign[]> {
    const res = await fetch(`${this.baseUrl}/v1/admin/promotions/campaigns`, {
      headers: this.getAdminHeaders(),
    });
    if (!res.ok) throw new Error('Failed to fetch campaigns');
    return res.json();
  }

  /**
   * Admin: Create a new promotion campaign
   */
  async createCampaign(campaign: {
    id: string;
    title: string;
    description?: string;
    promoType?: 'comeback' | 'holiday' | 'referral' | 'marketing';
    status?: 'active' | 'scheduled' | 'ended' | 'draft';
    rewardType?: 'pro_pass' | 'bonus_minutes' | 'discount_pass';
    rewardValue?: number;
    trialDays?: number;
    starterRewardType?: 'pro_pass' | 'bonus_minutes';
    starterRewardValue?: number;
    starterTrialDays?: number;
    paidRewardType?: 'bonus_minutes';
    paidRewardValue?: number;
    targetAudience: 'all' | 'old_only' | 'new_only';
    targetTiers?: string[];
    userCreatedBefore?: string;
    validDays?: number;
    startDate?: string;
    endDate?: string;
  }): Promise<{ success: boolean; campaign: PromotionCampaign; message: string }> {
    const res = await fetch(`${this.baseUrl}/v1/admin/promotions/campaigns`, {
      method: 'POST',
      headers: this.getAdminHeaders(),
      body: JSON.stringify(campaign),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to create campaign');
    return data;
  }

  /**
   * Admin: Update / Edit an existing promotion campaign
   */
  async updateCampaign(
    id: string,
    updates: {
      title?: string;
      description?: string;
      promoType?: 'comeback' | 'holiday' | 'referral' | 'marketing';
      status?: 'active' | 'scheduled' | 'ended' | 'draft';
      starterRewardType?: 'pro_pass' | 'bonus_minutes';
      starterRewardValue?: number;
      starterTrialDays?: number;
      paidRewardType?: 'bonus_minutes';
      paidRewardValue?: number;
      targetAudience?: 'all' | 'old_only' | 'new_only';
      targetTiers?: string[];
      validDays?: number;
      startDate?: string;
      endDate?: string;
    }
  ): Promise<{ success: boolean; campaign: PromotionCampaign; message: string }> {
    const res = await fetch(`${this.baseUrl}/v1/admin/promotions/campaigns/${encodeURIComponent(id)}`, {
      method: 'PUT',
      headers: this.getAdminHeaders(),
      body: JSON.stringify(updates),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to update campaign');
    return data;
  }

  /**
   * Admin: Toggle or update campaign status
   */
  async updateCampaignStatus(id: string, status: string): Promise<any> {
    const res = await fetch(`${this.baseUrl}/v1/admin/promotions/campaigns/${id}/status`, {
      method: 'PUT',
      headers: this.getAdminHeaders(),
      body: JSON.stringify({ status }),
    });
    return res.json();
  }
}

export const promotionsApi = new PromotionsApi();

