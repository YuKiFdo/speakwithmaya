# Dashboard Screen Fidelity & Layout Standards

This document locks in the verified and user-approved styling, padding, dynamic height scaling, and layout rules for the Maya AI Dashboard screen ([dashboard.tsx](file:///d:/outsource/Maya%20Ai/maya-frontend/src/app/dashboard.tsx)).

---

## 1. Responsive Viewport Strategy

- **Dual-Mode Desktop/Laptop Scaling:**
  - **Standard Desktop Displays (Height ≥ 850px):** Expands generously with taller hero cards, rich paddings, and anchored banners.
  - **Compact Laptop Screens (Height ~600–768px):** Dynamically contracts heights and margins using formulaic `windowHeight` calculations to ensure **zero vertical scrolling** is required to view the entire dashboard.
- **Mobile Mode (< 768px Width):** Single-column stacked layout with mobile greeting, compact card dimensions, and mobile bottom tab navigation.

---

## 2. Locked Dimensions & Dynamic Calculations

### A. Light Blue Hero Card ("Start a conversation")
- **Dynamic Min-Height:**
  ```tsx
  const desktopHeroMinHeight = isDesktop
    ? Math.min(325, Math.max(160, Math.round(windowHeight * 0.35)))
    : 170;
  ```
- **Vertical Padding:**
  ```tsx
  const desktopHeroPaddingV = isDesktop
    ? Math.min(56, Math.max(16, Math.round(windowHeight * 0.055)))
    : 18;
  ```
- **Margin Top (Distance from Header):**
  ```tsx
  const desktopHeroMarginTop = isDesktop
    ? Math.min(50, Math.max(10, Math.round((windowHeight - 620) * 0.10) + 10))
    : 16;
  ```
- **Horizontal Padding:** `36px` on desktop (`paddingHorizontal: 36`).
- **Maya Waving Avatar Illustration:**
  ```tsx
  const desktopMayaImgHeight = isDesktop
    ? Math.min(340, Math.max(225, Math.round(windowHeight * 0.35)))
    : 206;
  ```
- **Typography & Button:**
  - Title: `fontSize: 30`, `lineHeight: 36`
  - Subtitle: `fontSize: 15`, `lineHeight: 22`, `maxWidth: 460`, `color: '#64748b'`
  - Button: `height: 46`, `minWidth: 210`, `borderRadius: 12`, `fontSize: 16` bold text
  - Social Proof Row: `marginTop: 14`

---

### B. Scenario Cards ("Maya can help you with")
- **3-Column Full-Width Grid Calculation:**
  ```tsx
  scenariosGridDesktop: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  scenarioCardDesktop: {
    ...Platform.select({
      web: {
        width: 'calc((100% - 24px) / 3)', // 100% full width, accounting for 2x 12px gaps
      },
      default: {
        width: '31.8%',
      },
    }),
    flexGrow: 0,
    flexShrink: 0,
    paddingHorizontal: 16,
    paddingVertical: 14,
    minHeight: 84,
    gap: 12,
    borderRadius: 18,
    marginBottom: 0,
  }
  ```
- **Dynamic Min-Height:**
  ```tsx
  const desktopCardMinHeight = isDesktop
    ? Math.min(124, Math.max(86, Math.round(windowHeight * 0.135)))
    : 114;
  ```

---

### C. Bottom Banner ("Unlock All Conversation With Pro")
- **Dynamic Min-Height & Padding:**
  ```tsx
  const desktopBannerMinHeight = isDesktop
    ? Math.min(94, Math.max(74, Math.round(windowHeight * 0.098)))
    : 78;

  const desktopBannerPaddingV = isDesktop
    ? Math.min(22, Math.max(15, Math.round(windowHeight * 0.022)))
    : 16;
  ```
- **Container Styling:**
  - `backgroundColor: '#0057FF'`
  - `borderRadius: 18` (desktop: `20`)
  - `paddingHorizontal: 26` (desktop: `30`)
- **Icon Box:** `54 × 54px`, `borderRadius: 16`, white background with centered blue crown icon.
- **Typography:**
  - Title: `fontSize: 18`, bold, white
  - Subtitle: `fontSize: 13`, `color: 'rgba(255, 255, 255, 0.88)'`, `marginTop: 3`
- **Button:**
  - White background, `height: 48`, `paddingHorizontal: 24`, `borderRadius: 14`
  - Text: `fontSize: 15`, bold `#0057FF`

---

## 3. Desktop Vertical Distribution Strategy

- The main scroll view utilizes:
  ```tsx
  mainScrollContentDesktop: {
    paddingHorizontal: 40,
    paddingTop: 18,
    paddingBottom: 24,
    flexGrow: 1,
    justifyContent: 'space-between',
  }
  ```
- **Top Group (`desktopTopGroup`):** Contains the top greeting and the hero card banner.
- **Lower Group (`desktopLowerGroup`):** Contains the scenario cards and the bottom banner, anchored together cleanly with `gap: 16`.
- This ensures the layout distributes harmoniously without orphan spaces or awkward margins.
