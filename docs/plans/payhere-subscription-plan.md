# Maya AI — PayHere Subscriptions & Recurring Billing Implementation Plan

**Author:** Antigravity AI Engineering  
**Date:** October 15, 2026  
**Status:** Awaiting Approval  
**Target:** `maya-backend` (NestJS) & `maya-frontend` (Expo Universal: Web + iOS/Android)

---

## 1. Executive Summary & Architecture Decision

To monetize Maya AI's English Speaking Coach while strictly adhering to **Rule 01 (Zero Secrets in Client)** and **Rule 03 (Universal Frontend)**:
1. **Client Security:** All PayHere MD5 checksums and secret keys are managed strictly on the NestJS backend. The client receives pre-signed parameter packets on demand.
2. **Web vs. Native Architecture:**
   - **React Native SDK (`@payhere/payhere-mobilesdk-reactnative`)**: Built on native Android AAR and iOS CocoaPods modules. It **cannot run on Web** (will crash if evaluated).
   - **Expo Web (`Platform.OS === 'web'`)**: Uses **PayHere JavaScript SDK (`payhere-2.0.js`)** to display an in-page popup modal without redirecting users away.
   - **Expo Native (`Platform.OS !== 'web'`)**: Uses `@payhere/payhere-mobilesdk-reactnative` through a universal abstraction layer (`payhere-gateway.ts` + `.web.ts` / `.native.ts`).
3. **Automated Billing Engine:**
   - PayHere handles credit/debit card recurring charging automatically based on configured intervals (`1 Month`, `3 Month`, `1 Year`).
   - Asynchronous server callbacks (`notify_url`) update the Supabase database, maintain an append-only transaction ledger, and credit speaking minutes.
4. **Admin & Operational Control:**
   - Utilizes PayHere's OAuth2 **Subscription Manager API** (`/merchant/v1/subscription`) to view, retry failed charges, and cancel recurring plans directly from an internal Admin Portal screen (`/admin/subscriptions`).

---

## 2. PayHere API Specifications & Integration Mapping

### A. Recurring Billing API (Customer Checkout)
- **Production URL:** `https://www.payhere.lk/pay/checkout`
- **Sandbox URL:** `https://sandbox.payhere.lk/pay/checkout`
- **Hash Signature Formula (Backend Only):**
  $$\text{hash} = \text{to\_upper\_case}(\text{md5}(\text{merchant\_id} + \text{order\_id} + \text{number\_format}(\text{amount}, 2, '.', '') + \text{currency} + \text{to\_upper\_case}(\text{md5}(\text{merchant\_secret}))))$$
- **Required POST Parameters:**
  - `merchant_id`, `return_url`, `cancel_url`, `notify_url`
  - `order_id` (e.g., `MAYA-SUB-${userId}-${timestamp}`)
  - `items` (e.g., `Maya AI Pro Monthly Subscription`)
  - `currency` (`LKR`)
  - `amount` (e.g., `3600.00`)
  - `recurrence` (e.g., `1 Month`, `3 Month`, `1 Year`)
  - `duration` (`Forever` or fixed duration)
  - `hash` (precomputed on backend)
  - Customer contact: `first_name`, `last_name`, `email`, `phone`, `address`, `city`, `country`

### B. Payment Webhook Callback (`notify_url`)
- **Format:** `application/x-www-form-urlencoded`
- **Signature Verification:**
  $$\text{local\_md5sig} = \text{strtoupper}(\text{md5}(\text{merchant\_id} + \text{order\_id} + \text{payhere\_amount} + \text{payhere\_currency} + \text{status\_code} + \text{strtoupper}(\text{md5}(\text{merchant\_secret}))))$$
- **Event Handling:**
  - `AUTHORIZATION_SUCCESS` (`status_code: 2`): Initial subscription authorization. Capture `subscription_id`, set user plan to `active`, and grant monthly minutes.
  - `RECURRING_INSTALLMENT_SUCCESS` (`status_code: 2`): Recurring billing cycle payment success. Advance next billing date, record payment in `orders`, and replenish minutes quota.
  - `RECURRING_INSTALLMENT_FAILED` (`status_code: -2`): Payment failed. Update plan status to `past_due`.
  - `RECURRING_STOPPED` (`status_code: -2`, `item_rec_status: -1`): Subscription canceled or retries exhausted. Set plan status to `canceled`.
  - `RECURRING_COMPLETE` (`status_code: 2`, `item_rec_status: 1`): Fixed duration completed.

### C. Subscription Manager API (OAuth2 Client)
- **Token Endpoint:** `POST https://www.payhere.lk/merchant/v1/oauth/token`
  - Header: `Authorization: Basic base64(app_id:app_secret)`
  - Body: `grant_type=client_credentials`
- **Management Endpoints:**
  - `GET /merchant/v1/subscription`: List all active/inactive subscriptions.
  - `GET /merchant/v1/subscription/{id}`: Detailed view of a specific subscription.
  - `GET /merchant/v1/subscription/{id}/payments`: Full historical log of installments charged.
  - `POST /merchant/v1/subscription/retry`: Manually retry failed installment charge.
  - `POST /merchant/v1/subscription/cancel`: Stop future recurring installments.

---

## 3. Architecture & Data Flow

```mermaid
flowchart TD
    subgraph Frontend [Maya Frontend (Universal Client)]
        UI[User Taps Upgrade Plan]
        GW[Universal Payment Gateway Adapter]
        WebSDK[payhere-2.0.js (Onsite Modal)]
        NativeSDK[@payhere/payhere-mobilesdk-reactnative]
    end

    subgraph Backend [Maya NestJS Backend]
        Signer[PaymentsController /checkout-params]
        Webhook[PaymentsController /notify]
        SubMgr[PayHereSubscriptionManagerService]
    end

    subgraph PayHere [PayHere Payment Gateway]
        PH_Engine[Recurring Billing Engine]
        PH_Auth[3DS Card Authorization]
        PH_API[Subscription Manager REST API]
    end

    subgraph Supabase [Supabase Database]
        DB_Sub[(public.subscriptions)]
        DB_Order[(public.orders)]
        DB_Profile[(public.profiles)]
    end

    UI -->|1. Selects Plan| Signer
    Signer -->|2. Create Pending Record & Hash| DB_Order
    Signer -->|3. Return Signed Object| GW
    GW -->|Web| WebSDK
    GW -->|iOS / Android| NativeSDK
    WebSDK -->|4. Authorize Card| PH_Auth
    NativeSDK -->|4. Authorize Card| PH_Auth
    PH_Auth -->|5. Instant Callback| Webhook
    Webhook -->|6. Verify md5sig & Update| DB_Sub
    Webhook --> DB_Profile
    Webhook --> DB_Order

    subgraph AdminPortal [Admin Dashboard /admin/subscriptions]
        AdminUI[Admin Management View]
    end

    AdminUI -->|Manage / Cancel / Retry| SubMgr
    SubMgr -->|OAuth2 Bearer API| PH_API
    PH_API -->|Sync Status| DB_Sub
```

---

## 4. Universal Client Strategy (Expo Web vs Native)

```
maya-frontend/src/services/payment/
├── payhere-gateway.ts          # Common TypeScript interface & factory
├── payhere-gateway.web.ts      # Web implementation (payhere-2.0.js popup)
└── payhere-gateway.native.ts   # Native implementation (@payhere React Native SDK)
```

### Shared Interface
```typescript
export interface PayHereCheckoutParams {
  sandbox: boolean;
  merchant_id: string;
  order_id: string;
  items: string;
  amount: string;
  currency: 'LKR' | 'USD';
  recurrence: string;
  duration: string;
  startup_fee?: string;
  hash: string;
  notify_url: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  country: string;
}

export interface PaymentGatewayService {
  startPayment(
    params: PayHereCheckoutParams,
    onCompleted: (orderId: string) => void,
    onError: (error: string) => void,
    onDismissed: () => void
  ): Promise<void>;
}
```

### Web Adapter (`payhere-gateway.web.ts`)
- Dynamically loads `<script src="https://www.payhere.lk/lib/payhere-2.0.js"></script>`.
- Calls `window.payhere.startPayment(params)`.
- Listens to `window.payhere.onCompleted`, `onError`, `onDismissed`.

### Native Adapter (`payhere-gateway.native.ts`)
- Uses `import PayHere from '@payhere/payhere-mobilesdk-reactnative';`.
- Calls `PayHere.startPayment(params, onCompleted, onError, onDismissed)`.

---

## 5. Database Schema Migration (Supabase SQL)

```sql
-- 005_payhere_subscriptions.sql
-- Create Subscriptions Table for Recurring Billing
CREATE TABLE IF NOT EXISTS public.subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  payhere_subscription_id TEXT UNIQUE,
  plan_tier TEXT CHECK (plan_tier IN ('basic', 'pro', 'premium')) NOT NULL,
  billing_cycle TEXT NOT NULL, -- '1 Month', '3 Month', '1 Year'
  amount_lkr NUMERIC(10, 2) NOT NULL,
  status TEXT CHECK (status IN ('PENDING', 'ACTIVE', 'PAST_DUE', 'CANCELLED', 'COMPLETED')) DEFAULT 'PENDING',
  next_billing_date DATE,
  installments_paid INTEGER DEFAULT 0,
  card_masked TEXT,
  card_expiry TEXT,
  payment_method TEXT,
  last_payment_id TEXT,
  cancelled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_user ON public.subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON public.subscriptions(status);

-- Enhance public.orders table with PayHere transaction telemetry
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS subscription_id UUID REFERENCES public.subscriptions(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS payhere_payment_id TEXT,
  ADD COLUMN IF NOT EXISTS payhere_subscription_id TEXT,
  ADD COLUMN IF NOT EXISTS md5sig TEXT,
  ADD COLUMN IF NOT EXISTS raw_payload JSONB;
```

---

## 6. Implementation Milestones

### Milestone 1: Database & Backend Foundation
- [ ] Apply `005_payhere_subscriptions.sql` in Supabase.
- [ ] Add PayHere environment variables to `maya-backend/.env` (`PAYHERE_MERCHANT_ID`, `PAYHERE_MERCHANT_SECRET`, `PAYHERE_APP_ID`, `PAYHERE_APP_SECRET`, `PAYHERE_MODE`).
- [ ] Implement `PayHereSigningService` (`POST /v1/payments/payhere/checkout-params`).
- [ ] Implement `PayHereWebhookController` (`POST /v1/payments/payhere/notify`) with `md5sig` validation and status updates.
- [ ] Implement `PayHereSubscriptionManagerService` with OAuth2 Bearer token caching and management operations.

### Milestone 2: Universal Client Integration
- [ ] Create `payhere-gateway.ts`, `payhere-gateway.web.ts`, and `payhere-gateway.native.ts`.
- [ ] Integrate into `PersonalizedPlanScreen` (`maya-frontend/src/app/onboarding/personalized-plan.tsx`).
- [ ] Integrate into `UpgradeScreen` (`maya-frontend/src/app/upgrade.tsx`).
- [ ] Integrate self-service cancellation into `AccountScreen` (`maya-frontend/src/app/(tabs)/account.tsx`).

### Milestone 3: Admin Portal (`/admin/subscriptions`)
- [ ] Backend admin endpoints (`GET /v1/admin/subscriptions`, `GET /v1/admin/subscriptions/:id/payments`, `POST /v1/admin/subscriptions/:id/retry`, `POST /v1/admin/subscriptions/:id/cancel`).
- [ ] Create admin frontend screen `maya-frontend/src/app/admin/subscriptions.tsx` featuring:
  - Metric cards: MRR (LKR), Active Subscribers, Past Due count, Churn rate.
  - Searchable, filterable subscriber table.
  - Actions: View Payment History, Retry Card Charge, Cancel Subscription, Sync with PayHere.

### Milestone 4: Verification & Sandbox Testing
- [ ] Test initial authorization flow in Sandbox environment.
- [ ] Verify accelerated Sandbox recurring installment callback (~1 minute post-authorization).
- [ ] Test simulated webhook events (`AUTHORIZATION_SUCCESS`, `RECURRING_INSTALLMENT_SUCCESS`, `RECURRING_INSTALLMENT_FAILED`, `RECURRING_STOPPED`).
- [ ] Verify quota replenishments in `profiles` and transaction recording in `orders`.
