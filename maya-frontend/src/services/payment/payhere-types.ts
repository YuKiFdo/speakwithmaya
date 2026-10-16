export interface PayHereCheckoutParams {
  sandbox: boolean;
  merchant_id: string;
  return_url: string;
  cancel_url: string;
  notify_url: string;
  order_id: string;
  items: string;
  currency: string;
  amount: string;
  recurrence?: string;
  duration?: string;
  startup_fee?: string;
  preapprove?: boolean;
  hash: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  country: string;
  custom_1?: string;
  custom_2?: string;
}

export interface PayHerePaymentResult {
  status: 'completed' | 'dismissed' | 'error';
  orderId?: string;
  error?: string;
}

export interface SubscriptionRecord {
  id: string;
  user_id: string;
  payhere_subscription_id: string;
  customer_token?: string | null;
  plan_tier: 'starter' | 'basic' | 'pro' | 'premium';
  billing_cycle: string;
  amount_lkr: number;
  status: 'PENDING' | 'ACTIVE' | 'PAST_DUE' | 'CANCELLED' | 'COMPLETED';
  next_billing_date: string | null;
  installments_paid: number;
  card_holder_name?: string;
  card_masked?: string;
  card_expiry?: string;
  payment_method?: string;
  has_saved_card?: boolean;
  can_auto_charge?: boolean;
  created_at: string;
  updated_at: string;
  profile?: {
    id: string;
    display_name: string;
    phone_number: string;
    email?: string;
    minutes_balance: number;
    level?: string;
  };
}

export interface AdminSubscriptionsResponse {
  stats: {
    totalSubscribers: number;
    activeCount: number;
    pastDueCount: number;
    cancelledCount: number;
    mrrLkr: number;
  };
  subscriptions: SubscriptionRecord[];
}
