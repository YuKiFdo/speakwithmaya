# Guided Tours (first-visit dashboard tour)

Derived design, approved by the user on 2026-11-22 from the interactive mockups (phone + desktop canvas).
No PNG exists in `design/inbox/`; the approved mockup is the design reference.

---

## 1. What the learner sees

The first time a learner lands on the dashboard (after onboarding, or the first time after this release for existing learners):

| # | Step | Phone (< 768 px) | Tablet / desktop (≥ 768 px) |
| :-- | :-- | :-- | :-- |
| 0 | Welcome: "Hi {name}, I'm Maya" | Bottom sheet with Maya | Centered popup with Maya |
| 1 | Start Talking (or Resume Practice) button | Tip card below | Popover to the right |
| 2 | "Maya can help you with" topics | Tip card above / below | Popover above / below |
| 3 | Talk Time | Dashboard card (auto-scrolls into view) | Sidebar card, popover to the right |
| 4 | Level & XP badge | Top bar | Top-right badge, popover below |
| 5 | Roleplays tab | Bottom tab | Sidebar item |
| 6 | History tab | Bottom tab | Sidebar item |
| 7 | Account tab | Bottom tab | Sidebar item |
| 8 | "You're all set!" | Start Talking / Explore on my own | Same, side by side |

- Dimmed screen with a rounded spotlight that slides between targets, plus a soft pulse ring.
- Every step: step count ("3 / 7"), progress dots, Skip, Back (from step 2), Next / Done.
- Web keyboard: ← → move, Enter / Space press the focused button, Esc closes. Focus moves to the main button each step.
- Android back button closes the tour. Native steps are announced to screen readers.
- Reduce-motion setting: no slide, no pulse.
- A step whose element is not on screen (e.g. hidden by plan state) is skipped automatically.

## 2. When it shows

- Once per learner across all devices. Saved at the moment it starts (closing the app mid-tour does not replay it); Skip also counts as seen.
- Waits until: dashboard focused, hero loaded (`resumeChecked`), profile loaded, no popup / create-session modal / Pro Pass modal / resume in progress, and no XP fill animation running. Starts 0.8 s after all of these hold.

## 3. Language

From the learner's onboarding native language: Sinhala → Sinhala copy, Tamil → Tamil copy, otherwise English.
`language_mode` is deliberately not used (the client defaults it to `english_only` when it is missing).
**Sinhala and Tamil copy are drafts and need native-speaker review.** Copy lives in `maya-frontend/src/tours/dashboard-welcome.ts`.

## 3b. Create Session tour (`create-session:v1`)

Shows the first time the learner opens the "Create New Session" modal (Start Talking, New Conversation or a topic tile), once the modal is open and no option picker is showing. Four highlighted steps, no welcome sheet:

1. **Practice time**: how long the session lasts; longer ones need a higher plan.
2. **Language help**: what English only / Sinhala Support / Deep Guidance each do.
3. **AI corrections**: what Let me speak / Keep me on track / Correct me instantly each do.
4. **Start Session**: starts the call; Cancel goes back.

A native / web `Modal` draws above the app, so this tour sets `host: 'create-session'` and the modal renders `<TourHost name="create-session" />` as its last child. If the modal closes mid-tour, the tour ends quietly.

Sinhala copy is written in everyday spoken Sinhala (not formal written style), matching how learners talk.

## 3c. History tours (`history:v1`, `history-detail:v1`)

Shows on the first visit to History once the learner has at least one conversation (no tour on an empty history), after the list has loaded and no popup or filter sheet is open.

- **Desktop / tablet** (list and review side by side), one tour: Find a conversation (search) → Your conversations (first card, ▶ plays it) → Voice recording (wave to jump, speed, removed after 7 days) → Transcript & corrections (Jump to Next Correction).
- **Phone**: `history:v1` covers search + mode filter and the first card. The review is a separate view, so `history-detail:v1` covers Voice recording and Transcript & corrections the first time a review is opened.

## 3d. When a tour counts as "seen"

A tour is saved as seen when its first step is actually on screen, not when it is requested. If none of its elements can be found, it is not saved and tries again next time. In development builds the console logs `[tour] ...` lines explaining starts and skipped steps.

## 4. Implementation

| Piece | File |
| :-- | :-- |
| Engine (registry, measuring, scrolling, start-once hook) | `maya-frontend/src/components/tour/tour-provider.tsx` |
| Overlay UI (spotlight, card, sheet) | `maya-frontend/src/components/tour/tour-overlay.tsx` |
| Placement maths (pure) | `maya-frontend/src/components/tour/tour-placement.ts` |
| Keyboard / back button | `tour-keyboard.web.ts` / `tour-keyboard.ts` |
| Seen state (local cache + profile) | `maya-frontend/src/components/tour/tour-storage.ts` |
| Tour data + copy | `maya-frontend/src/tours/dashboard-welcome.ts` |

Target ids: `dashboard.start`, `dashboard.scenarios`, `dashboard.talkTime`, `nav.level`, `nav.home`, `nav.roadmap`, `nav.history`, `nav.account`.

### Adding a tour for a new feature

1. Add `useTourTarget('<id>')` refs to the elements (and `scrollKey` + `useTourScrollContainer` if they can be off screen).
2. Create `src/tours/<name>.ts` with steps and en / si / ta copy.
3. Call `useFirstVisitTour(TOUR, ready, { lang, vars })` in the screen.
4. To show a changed tour again to everyone, bump the id suffix (`:v1` → `:v2`).

## 5. Backend

- Migration `maya-backend/src/database/030_profiles_tours_seen.sql`: `profiles.tours_seen text[] NOT NULL DEFAULT '{}'`.
- `GET /v1/users/tours` → `{ toursSeen: string[] }` (AuthGuard).
- `POST /v1/users/tours/seen` `{ tourId }` → `{ toursSeen }` (AuthGuard, DTO-validated id, idempotent, capped at 100 ids).
- Before the migration runs, both endpoints degrade safely: reads return `[]`, writes log a warning. The device-local flag still prevents repeats on that device.
- Load: the server is read at most once per app session, and only while a tour is unseen on that device.
