# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: popup.spec.ts >> Common Popup Component Tests >> opens Daily Limit popup when clicking talk time upgrade button
- Location: e2e\popup.spec.ts:50:7

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByText('You\'ve reached your')
Expected: visible
Timeout: 5000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" getByText('You\'ve reached your') with timeout 5000ms
  - waiting for getByText('You\'ve reached your')

```

```yaml
- text: SpeakwithMaya Practice · improve · Be Confident
- tab "Home":
  - img
  - text: Home
- tab "Roadmap":
  - img
  - text: Roadmap
- tab "History":
  - img
  - text: History
- tab "Account":
  - img
  - text: Account
- button "Upgrade to Pro 20% off":
  - img
  - text: Upgrade to Pro 20% off
- text: Your Talk Time Resets in 24 hours 01 / 5 minutes
- button "Upgrade to premium →":
  - img
  - text: Upgrade to premium →
- text: Hello, Shehal! 👋 Ready to practice English today?
- button "View Level 4 progress": Level 4 420 / 800 XP
- text: Start a conversation Jump into a real-time conversation with your AI English partner.
- button "Start Talking with Maya": Start Talking
- text: 2,458+ conversations today
- img "Maya waving"
- text: Maya can help you with Choose what you want to practice today
- button "Practice Casual Chat": Casual Chat Chat about anything in everyday life ›
- button "Workplace (Locked, upgrade to Pro to unlock)":
  - text: Workplace Improve your work communication
  - img
- button "Travel English (Locked, upgrade to Pro to unlock)":
  - text: Travel English Communicate while you travel
  - img
- button "Role Play (Locked, upgrade to Pro to unlock)":
  - text: Role Play Practice real-life scenarios
  - img
- button "Job Interview (Locked, upgrade to Pro to unlock)":
  - text: Job Interview Prepare for your next interview
  - img
- button "IELTS Speaking (Locked, upgrade to Pro to unlock)":
  - text: IELTS Speaking Improve your IELTS speaking score
  - img
- img
- text: Unlock All Conversation With Pro More conversations, AI feedback, advanced lessons & more!
- button "Upgrade to Pro": Upgrade to Pro →
- dialog:
  - button "Close popup"
  - img
  - text: Unlock with Premium This feature is available for Premium users only.
  - button "Upgrade to Premium":
    - img
    - text: Upgrade to Premium
    - img
  - text: Upgrade to Premium and get access to all features.
```

# Test source

```ts
  1  | import { test, expect } from '@playwright/test';
  2  | 
  3  | test.describe('Common Popup Component Tests', () => {
  4  |   test('opens Unlock with Premium popup when clicking locked scenario', async ({ page }) => {
  5  |     await page.goto('/dashboard');
  6  |     await page.waitForLoadState('networkidle');
  7  | 
  8  |     // Click on Role Play (locked scenario)
  9  |     const rolePlayCard = page.getByRole('button', { name: /Role Play/i });
  10 |     await expect(rolePlayCard).toBeVisible({ timeout: 15000 });
  11 |     await rolePlayCard.click();
  12 | 
  13 |     // Verify modal is displayed with Unlock with Premium
  14 |     await expect(page.getByText('Unlock with')).toBeVisible();
  15 |     await expect(page.getByText('Premium', { exact: true })).toBeVisible();
  16 |     await expect(
  17 |       page.getByText('This feature is available for Premium users only.')
  18 |     ).toBeVisible();
  19 |     await expect(
  20 |       page.getByRole('button', { name: 'Upgrade to Premium', exact: true })
  21 |     ).toBeVisible();
  22 |     await expect(
  23 |       page.getByText('Upgrade to Premium and get access to all features.')
  24 |     ).toBeVisible();
  25 | 
  26 |     // Close modal by clicking primary button
  27 |     await page.getByRole('button', { name: 'Upgrade to Premium', exact: true }).click();
  28 |     await expect(page.getByText('Unlock with')).not.toBeVisible();
  29 |   });
  30 | 
  31 |   test('opens Level Up popup when clicking level badge', async ({ page }) => {
  32 |     await page.goto('/dashboard');
  33 |     await page.waitForLoadState('networkidle');
  34 | 
  35 |     // Click on Level 4 badge in desktop header
  36 |     const levelBadge = page.getByRole('button', { name: /View Level 4 progress/i }).first();
  37 |     await expect(levelBadge).toBeVisible();
  38 |     await levelBadge.click();
  39 | 
  40 |     // Verify Level Up modal
  41 |     await expect(page.getByText('Level Up!')).toBeVisible();
  42 |     await expect(page.getByText(/You've reached Level 5!/i)).toBeVisible();
  43 |     await expect(page.getByRole('button', { name: 'Awesome!' })).toBeVisible();
  44 | 
  45 |     // Dismiss modal by clicking Awesome!
  46 |     await page.getByRole('button', { name: 'Awesome!' }).click();
  47 |     await expect(page.getByText('Level Up!')).not.toBeVisible();
  48 |   });
  49 | 
  50 |   test('opens Daily Limit popup when clicking talk time upgrade button', async ({ page }) => {
  51 |     await page.goto('/dashboard');
  52 |     await page.waitForLoadState('networkidle');
  53 | 
  54 |     // Click on sidebar talk time button
  55 |     const talkTimeBtn = page.getByRole('button', { name: 'Upgrade to premium →' });
  56 |     await expect(talkTimeBtn).toBeVisible();
  57 |     await talkTimeBtn.click();
  58 | 
  59 |     // Verify Daily Limit modal
> 60 |     await expect(page.getByText("You've reached your")).toBeVisible();
     |                                                         ^ Error: expect(locator).toBeVisible() failed
  61 |     await expect(page.getByText("daily limit!")).toBeVisible();
  62 |     await expect(page.getByText("Continue your practice with Premium.")).toBeVisible();
  63 |     await expect(page.getByRole('button', { name: 'Upgrade to Premium', exact: true })).toBeVisible();
  64 | 
  65 |     // Dismiss
  66 |     await page.getByRole('button', { name: 'Upgrade to Premium', exact: true }).click();
  67 |     await expect(page.getByText("daily limit!")).not.toBeVisible();
  68 |   });
  69 | });
  70 | 
```