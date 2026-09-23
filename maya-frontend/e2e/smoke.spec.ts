import { test, expect } from '@playwright/test';

test.describe('Universal App Skeleton Smoke Test', () => {
  test('renders universal shell without horizontal scroll', async ({ page }) => {
    await page.goto('/');

    // Verify main shell is present
    const shell = page.getByTestId('responsive-shell');
    await expect(shell).toBeVisible({ timeout: 15000 });

    // Verify key onboarding text is visible
    await expect(page.getByText(/Meet Maya/i)).toBeVisible();

    // Verify diagnostic breakpoint indicator is rendered
    const indicator = page.getByTestId('breakpoint-indicator');
    await expect(indicator).toBeVisible();

    // Verify Get Started button is visible
    const getStartedBtn = page.getByTestId('get-started-button');
    await expect(getStartedBtn).toBeVisible();

    // Assert zero horizontal scroll on root document
    const isOverflowing = await page.evaluate(() => {
      return document.documentElement.scrollWidth > document.documentElement.clientWidth;
    });
    expect(isOverflowing).toBe(false);
  });

  test('verifies responsive fluid layout across 360px, 768px, and 1024px widths', async ({ page }) => {
    // 1. Phone Viewport (360px)
    await page.setViewportSize({ width: 360, height: 740 });
    await page.goto('/');
    await expect(page.getByText(/Meet Maya/i)).toBeVisible();
    let isOverflowing = await page.evaluate(() => {
      return document.documentElement.scrollWidth > document.documentElement.clientWidth;
    });
    expect(isOverflowing).toBe(false);

    // 2. Tablet Viewport (768px)
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.waitForTimeout(300);
    isOverflowing = await page.evaluate(() => {
      return document.documentElement.scrollWidth > document.documentElement.clientWidth;
    });
    expect(isOverflowing).toBe(false);

    // 3. Desktop Viewport (1024px)
    await page.setViewportSize({ width: 1024, height: 768 });
    await page.waitForTimeout(300);
    isOverflowing = await page.evaluate(() => {
      return document.documentElement.scrollWidth > document.documentElement.clientWidth;
    });
    expect(isOverflowing).toBe(false);
  });
});
