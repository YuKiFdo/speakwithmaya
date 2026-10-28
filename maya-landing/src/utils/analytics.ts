declare global {
  interface Window {
    dataLayer?: Record<string, unknown>[];
  }
}

export interface PlanSelectionPayload {
  plan_name: 'Basic' | 'Pro' | 'Premium';
  billing_period: 'monthly' | '3_months';
  value: number;
  currency: 'LKR';
}

export const LANDING_PLANS: Record<'Basic' | 'Pro' | 'Premium', PlanSelectionPayload> = {
  Basic: {
    plan_name: 'Basic',
    billing_period: 'monthly',
    value: 3600,
    currency: 'LKR',
  },
  Pro: {
    plan_name: 'Pro',
    billing_period: 'monthly',
    value: 5400,
    currency: 'LKR',
  },
  Premium: {
    plan_name: 'Premium',
    billing_period: 'monthly',
    value: 7200,
    currency: 'LKR',
  },
};

export function pushLandingDataLayerEvent(
  event: string,
  params: Record<string, unknown> = {}
): void {
  if (typeof window === 'undefined') return;
  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push({
    event,
    ...params,
  });
}

export function trackLandingViewPlanSelection(): void {
  pushLandingDataLayerEvent('view_plan_selection');
}

export function trackLandingSelectPlan(planKey: 'Basic' | 'Pro' | 'Premium'): void {
  const plan = LANDING_PLANS[planKey];
  if (!plan) return;
  pushLandingDataLayerEvent('select_plan', {
    plan_name: plan.plan_name,
    billing_period: plan.billing_period,
    value: plan.value,
    currency: plan.currency,
  });
}
