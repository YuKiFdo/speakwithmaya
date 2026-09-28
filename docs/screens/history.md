# Screen Fidelity Report: History (`20-history`)

- **Screen ID:** `20-history`
- **Route:** `/history` ([src/app/history.tsx](file:///d:/outsource/Maya%20Ai/maya-frontend/src/app/history.tsx))
- **Status:** Approved (matching Web Master-Detail, Mobile List, and Mobile Detail designs)
- **Source Images:**
  - `design/inbox/20-history-web.png`
  - `design/inbox/20-history-mobile-list.png`
  - `design/inbox/20-history-mobile-detail.png`

---

## 1. Visual & Layout Architecture

### A. Web / Desktop Layout (Master-Detail Split)
- **Sidebar:** `DesktopSidebar` with `History` tab active (`activeTab="history"`), Talk Time meter (`320 / 600 minutes`), and `Get Extra Talk Time ->` popup trigger.
- **Top Header:** Level 4 XP user badge (`420 / 800 XP`, Maya avatar with gold ring), linked to `level-up` interactive modal.
- **Master Column (Left, ~390px):**
  - **Search Bar:** Real-time search filter input (`Search conversations...`) with clear button.
  - **Date Groupings:** Categorized sessions into `Today`, `Yesterday`, and `May 25, 2026`.
  - **Session Cards:**
    - Colored icon square matching practice mode (Workplace, Casual, Interview, Phone, Travel).
    - Session Title & meta badges: Calendar date, Clock time, Timer duration, and Refresh corrections count.
    - Blue circular play button (`#2B5BFF`) & vertical options button (`⋮`).
    - Active selection highlight with blue border (`#3B82F6`) and background tint (`#F8FAFC`).
- **Detail Column (Right, flex 1):**
  - **Detail Header:** Session mode icon, title, full metadata line, and close button (`✕`).
  - **Voice Recording Card:**
    - Play / Pause interactive toggle button.
    - Dynamic multi-bar audio waveform visualizer (played bars highlighted in `#2B5BFF`, unplayed in `#CBD5E1`).
    - Duration timestamp (`12:00`).
    - Speed toggle pill (`1.0x` / `1.25x` / `1.5x` / `2.0x`).
    - Auto-removal notice: `ⓘ This recording will be automatically removed within 7 days.`
  - **Session Transcript:**
    - Header with `▶▶ Jump to Next Correction` button (auto-scrolls to the next grammar feedback item).
    - Dialogue turns with timestamps and avatars (User `You` vs `AI` Maya).
    - Light grey rounded user bubbles and soft-green AI response bubbles.
    - **Interactive Grammar Correction Cards:**
      - Soft rose border (`#FECDD3`), red badge `✕ 1 correction`, collapsible chevron (`∧` / `∨`).
      - Audio speaker button & mini Maya avatar.
      - Comparison boxes: Original red-tinted box with strikethrough error vs. Corrected green-tinted box with checkmark.
      - Context explanation: `Why: Use the past tense "did" here.` / `Avoid contractions in formal speech.`.

### B. Mobile Layout (List View & Detail View Switching)
- **Top Bar:** Fixed pinned top bar with `SpeakwithMaya` branding and Level 4 XP badge.
- **Mobile List View (`20-history-mobile-list.png`):**
  - Title and subtitle.
  - Filter row: Search input + `All Modes` modal filter button.
  - Date grouped session cards with meta grid and play button.
  - Fixed bottom navigation bar with active blue indicator on History tab.
- **Mobile Detail View (`20-history-mobile-detail.png`):**
  - Activated seamlessly by tapping any session card.
  - Back navigation chevron `<` returns directly to the list view.
  - Mode square, session title, and 3-dots menu.
  - Voice Recording card with waveform and controls.
  - Session transcript with collapsible grammar correction cards and jump button.

---

## 2. Platform Safe Checks
- **Universal Code:** Strictly uses React Native primitives (`View`, `Text`, `Pressable`, `ScrollView`, `TextInput`, `Modal`) without direct DOM manipulation.
- **Typography:** Strictly uses `...fontStyle(family, weight)` helper for Outfit and Inter fonts. Zero raw `fontFamily` / `fontWeight` pairing issues on Android.
- **Image Styling:** Zero `tintColor` on multi-color illustrations and Maya avatars.
- **Navigation:** Integrated into Expo Router Stack (`/history`), Desktop Sidebar, and mobile bottom tab bar across Dashboard, Roadmap, and Account.
