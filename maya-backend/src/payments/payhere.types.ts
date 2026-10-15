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
  recurrence: string;
  duration: string;
  startup_fee?: string;
  hash: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  country: string;
  custom_1?: string; // userId
  custom_2?: string; // planTier
}

export interface PayHereWebhookPayload {
  merchant_id: string;
  order_id: string;
  payment_id: string;
  subscription_id?: string;
  payhere_amount: string;
  payhere_currency: string;
  status_code: string; // "2", "0", "-1", "-2", "-3"
  md5sig: string;
  custom_1?: string; // userId
  custom_2?: string; // planTier
  method?: string; // "VISA", "MASTER", etc.
  status_message?: string;
  recurring?: string; // "1"
  message_type?:
    | 'AUTHORIZATION_SUCCESS'
    | 'AUTHORIZATION_FAILED'
    | 'RECURRING_INSTALLMENT_SUCCESS'
    | 'RECURRING_INSTALLMENT_FAILED'
    | 'RECURRING_COMPLETE'
    | 'RECURRING_STOPPED';
  item_recurrence?: string;
  item_duration?: string;
  item_rec_status?: string; // "0": active, "-1": cancelled, "1": completed
  item_rec_date_next?: string;
  item_rec_install_paid?: string;
  card_holder_name?: string;
  card_no?: string;
  card_expiry?: string;
}

export interface PayHereOAuthTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  scope: string;
}

export interface PayHereSubscriptionItem {
  subscription_id: number | string;
  order_id: string;
  date: string;
  description: string;
  recurring: string;
  status: 'ACTIVE' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
  amount: number;
  currency: string;
  customer?: {
    fist_name?: string;
    last_name?: string;
    email?: string;
    phone?: string;
  };
  payment_method?: {
    method?: string;
    card_customer_name?: string;
    card_no?: string;
  };
}

export interface PayHereSubscriptionPaymentItem {
  payment_id: number | string;
  order_id: string;
  date: string;
  description: string;
  status: string;
  currency: string;
  amount: number;
  payment_method?: {
    method?: string;
    card_customer_name?: string;
    card_no?: string;
  };
}
