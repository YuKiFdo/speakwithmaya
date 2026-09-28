# Screen Fidelity Report: Account (`19-account`)

- **Screen ID:** `19-account`
- **Route:** `/account` ([src/app/account.tsx](file:///d:/outsource/Maya%20Ai/maya-frontend/src/app/account.tsx))
- **Status:** Approved (matching both Web and Mobile designs)

---

## 1. Visual & Layout Architecture

### A. Web / Desktop Layout (2-Column Grid)
- **Sidebar:** `DesktopSidebar` with `Account` tab active (`activeTab="account"`).
- **Top Header:** "Account", "Manage your profile, preferences and account settings.", plus Level 4 XP user badge.
- **2-Column Layout:**
  - **Left Column:**
    1. **Profile Card:** Blue circular avatar with user initials `TF`, Tharindu Fernando, Edit button, Member since May 20, 2026, and Pro Plan pill badge.
    2. **Preferences List Card:** 7 structured settings rows (Personal Information, Learning Goals, Maya's Voice & Personality, Explanation Language with "Sinhala", Speaking Preferences with "Normal Speed • ...", Notifications & Reminders with "7:00 PM Daily", Privacy & Data).
    3. **About TalkWithMaya Card:** Maya icon, brand tagline, description, and version 1.0.0.
  - **Right Column:**
    1. **This Month's Practice Card:** Big stat display "3h 42m left", Pro Plan badge, progress bar ("Used: 1h 18m", "Total: 5h 00m"), and dual stat cards ("Total practice time" 5 Hours, "Plan renews on" 25 Jun 2026).
    2. **Your Pro Plan Card:** "☆ Manage Plan" button, 5 perks grid (Unlimited conversations, Advanced AI memory, Detailed feedback & corrections, Priority voice access, Custom learning goals), and "★ You are enjoying all Pro Plan benefits." blue banner.
    3. **Customer Support Card:** Phone icon, description, and clickable `support@talkwithmaya.com` link.

### B. Mobile Layout (1-Column Stack)
- **Top Bar:** Fixed pinned top bar with SpeakwithMaya brand and Level 4 XP badge.
- **Content Stack:**
  1. Profile Card with right chevron
  2. This Month's Practice Card
  3. Preferences List Card (7 rows with icons & chevrons)
  4. Your Pro Plan Card with 5 perks
  5. About TalkWithMaya Card
  6. Customer Support Card
  7. Upgrade to Pro Card (with red Hot badge and blue "Upgrade Now →" button)
- **Bottom Navigation:** 4 tabs (Home, Roadmap, History, Account active with blue dot).

---

## 2. Platform Safe Checks
- **No Direct DOM Access:** Universal code using React Native primitives.
- **Typography:** `...fontStyle()` helper with Outfit and Inter font families.
- **Navigation:** Integrated into Expo Router Stack and bottom tabs / desktop sidebar.
