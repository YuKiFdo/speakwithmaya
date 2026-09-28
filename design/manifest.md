# Design Manifest

Central ledger tracking every screen in the AI English Speaking Coach application.

| id | flow | step order | name | mobile image | web image | status | API endpoints used | open questions |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `01-onboarding-welcome` | `onboarding` | 1 | Welcome / Get Started | `design/inbox/01-onboarding-welcome-mobile.png` | None (pending intake) | `mobile-only` | None | Web/desktop derived layout needed. |
| `02-onboarding-name` | `onboarding` | 2 | What should I call you? | `design/inbox/02-onboarding-name-mobile.png` | None (pending intake) | `mobile-only` | `PATCH /v1/users/profile` | Min/max name validation; auto-focus behavior. |
| `03-onboarding-phone` | `onboarding` | 3 | Phone & Starter Plan (LKR 8+tax/day) | `design/inbox/03-onboarding-phone-mobile.png` | None (pending intake) | `mobile-only` | `POST /v1/auth/otp/send` | Starter Plan billing mechanism (Supabase SMS OTP vs Carrier Direct Billing / Ideamart). |
| `04-onboarding-otp` | `onboarding` | 4 | OTP Verification | Derived (no PNG provided) | None (pending intake) | `approved` | `POST /v1/auth/otp/verify` | Auto-advances & paste support. |
| `05-onboarding-goal` | `onboarding` | 5 | What's your biggest goal? | `design/inbox/05-onboarding-goal-mobile.png` | None (pending intake) | `mobile-only` | `PATCH /v1/users/profile` | Personalisation settings. |
| `06-onboarding-challenge` | `onboarding` | 6 | What's hardest for you? | `design/inbox/06-onboarding-challenge-mobile.png` | None (pending intake) | `mobile-only` | `PATCH /v1/users/profile` | Challenge diagnostic tags. |
| `07-onboarding-level` | `onboarding` | 7 | What's your current level? | `design/inbox/07-onboarding-level-mobile.png` | None (pending intake) | `mobile-only` | `PATCH /v1/users/profile` | CEFR baseline level. |
| `08-onboarding-language` | `onboarding` | 8 | Your native language? | `design/inbox/08-onboarding-language-mobile.png` | None (pending intake) | `mobile-only` | `PATCH /v1/users/profile` | Sinhala / Tamil / Other search. |
| `09-onboarding-daily-goal` | `onboarding` | 9 | How much can you practice daily? | `design/inbox/09-onboarding-daily-goal-mobile.png` | None (pending intake) | `mobile-only` | `PATCH /v1/users/profile` | Daily commitment (5/10/15 min). |
| `10-onboarding-social-proof` | `onboarding` | 10 | You're in Good Company | `design/inbox/10-onboarding-social-proof-mobile.png` | None (pending intake) | `mobile-only` | None | Social proof metrics & testimonials. |
| `11-onboarding-building-plan` | `onboarding` | 11 | Building Your Plan | `design/inbox/11-onboarding-building-plan-mobile.png` | None (pending intake) | `mobile-only` | `POST /v1/users/plan` | Animated circular progress (0-100%) & checklist. |
| `12-onboarding-intro-call` | `onboarding` | 12 | Intro call with Maya | `design/inbox/12-onboarding-intro-call-mobile.png` | None (pending intake) | `mobile-only` | `POST /v1/sessions/intro` | Light theme aligned; Maya 3D avatar & expectations. |
| `13-onboarding-connecting` | `onboarding` | 13 | Connecting to Maya... | `design/inbox/13-onboarding-connecting-mobile.png` | None (pending intake) | `mobile-only` | `POST /v1/session-token` | Pulsating animated orbital rings with Maya avatar & quick tips. |
| `14-live-call-listening` | `practice` | 14 | Live Call (Maya Listening) | `design/inbox/14-live-call-listening-mobile.png` | None (pending intake) | `mobile-only` | Gemini Live WebSocket | Purple bottom glow, red recording dot, session countdown notice. |
| `15-live-call-speaking` | `practice` | 15 | Live Call (Maya Speaking) | `design/inbox/15-live-call-speaking-mobile.png` | None (pending intake) | `mobile-only` | Gemini Live WebSocket | Sky-blue ambient aura, green status dot, Speaking status. |
| `16-session-complete` | `summary` | 16 | Great job! Session Complete | `design/inbox/16-session-complete-mobile.png` | None (pending intake) | `mobile-only` | `GET /v1/ledger/summary` | Double thumbs-up celebratory avatar, practice time, XP, Level progress. |
| `17-dashboard` | `home` | 17 | Main Dashboard | `design/inbox/17-dashboard-mobile.png` | `design/inbox/17-dashboard-web.png` | `approved` | `GET /v1/users/me`, `GET /v1/quotas` | Universal responsive layout with sidebar, waving Maya hero, scenarios grid & talk time. |
| `18-roadmap` | `roadmap` | 18 | Learning Roadmap | `design/inbox/18-roadmap-mobile.png` | `design/inbox/18-roadmap-web.png` | `approved` | `GET /v1/roadmap` | Alternating mobile serpentine winding track & desktop multi-tier track, Level XP badge, custom icons. |
| `19-account` | `account` | 19 | Account | `design/inbox/19-account-mobile.png` | `design/inbox/19-account-web.png` | `approved` | `GET /v1/users/profile`, `GET /v1/quotas` | Profile details, practice usage, 7-preference items, Pro perks, support. |
| `20-history` | `history` | 20 | History & Session Review | `design/inbox/20-history-mobile-list.png`, `design/inbox/20-history-mobile-detail.png` | `design/inbox/20-history-web.png` | `approved` | `GET /v1/sessions/history`, `GET /v1/sessions/:id/recording`, `GET /v1/sessions/:id/transcript` | Master-detail desktop split, interactive voice recording waveform audio player, session transcript with inline collapsible grammar correction cards, jump to next correction, mode & search filters. |
| `21-call-grammar-feedback` | `practice` | 21 | In-Call Real-Time Grammar Feedback | `design/inbox/21-call-grammar-feedback-mobile.png` | Derived (Desktop Centered Modal) | `approved` | Gemini Live Real-Time Events / Tool Calling | Real-time in-call grammar correction sheet on mobile and centered modal on desktop with original sentence, corrected version, explanation, and auto-dismiss countdown button. |


