# Screen Fidelity Report: Learning Roadmap (`18-roadmap`)

- **Screen ID:** `18-roadmap`
- **Route:** `/roadmap` ([src/app/roadmap.tsx](file:///d:/outsource/Maya%20Ai/maya-frontend/src/app/roadmap.tsx))
- **Status:** Approved (matching both [18-roadmap-web.png](file:///d:/outsource/Maya%20Ai/design/inbox/18-roadmap-web.png) and [18-roadmap-mobile.png](file:///d:/outsource/Maya%20Ai/design/inbox/18-roadmap-mobile.png))

---

## 1. Visual & Layout Architecture

### A. Mobile View (Alternating Serpentine S-Curve with Desktop Aesthetics)
- **Top Bar:** Fixed pinned top bar matching Home (`paddingHorizontal: 20, paddingTop: 12, paddingBottom: 16`, `#f8fafc` border) with `SpeakwithMaya`, Level 4 XP progress bar, user avatar.
- **Main Section Spacing:** Exactly synchronized with Home / Dashboard (`paddingHorizontal: 20, paddingTop: 16, paddingBottom: 90` for mobile tabs).
- **3D Inner Shadow Winding Track (Matches Desktop):**
  - 4-layer recessed groove path (`#c8c8c8ff` bevel emboss, `#f2f2f2ff` track bed, `rgba(201, 201, 201, 0.09)` inner shadow, `rgba(235, 235, 235, 0.75)` center core highlight).
  - Blue glow dual-ring anchor dots on track (`r=10` halo + `r=5` solid `#0057FF` dot with white border).
  - Vertical dotted drop-lines (`stroke="#93C5FD"`, `strokeDasharray="4,4"`).
- **Floating Milestone Nodes (No Card Box, Matching Desktop Style):**
  - High-end open floating layout without rectangular card boxes.
  - Multi-ring avatar circles (`width: 70, height: 70, borderRadius: 35`, colored outer halo, inner white circle `54px`, `MilestoneIcon 26px`, optional green `COMPLETED` checkmark badge).
  - Next to avatar: number row (`01`, `02`...), emerald green `COMPLETED` badge pill, bold title, and session time.
  - Alternates smoothly: odd milestones have avatar on left and text on right; even milestones have text on left and avatar on right.
- **Mobile Bottom Navigation:**
  - 4 tabs: `Home`, `Roadmap` (active `#0057FF` with blue active dot underneath), `History`, `Account`.

### B. Desktop View
- **Sidebar:** `DesktopSidebar` with `Roadmap` active.
- **Header:** `Your Learning Roadmap`, `Your journey to fluency starts here!`, Level 4 progress widget.
- **Track & Grid:** Multi-tier serpentine SVG track with 2 columns of milestone cards per tier, connecting lines, and checkpoint node.
