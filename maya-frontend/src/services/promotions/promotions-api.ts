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
  status: 'active' | 'scheduled' | 'ended' | 'draft';
  rewardType: 'pro_pass' | 'bonus_minutes' | 'discount_pass';
  rewardValue: number;
  trialDays?: number;
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

    if (data.profile) {
      OnboardingStore.updateUser(data.profile);
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
    rewardType: 'pro_pass' | 'bonus_minutes' | 'discount_pass';
    rewardValue: number;
    trialDays?: number;
    targetAudience: 'all' | 'old_only' | 'new_only';
    targetTiers?: string[];
    userCreatedBefore?: string;
    validDays?: number;
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

