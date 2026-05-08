// @ts-check
const { test, expect } = require('@playwright/test');

async function waitForTrackerReady(page) {
  await page.waitForSelector('body[data-tracker-shell-ready="true"]', { timeout: 10000 });
}

test.describe('Tracker page — live mode & navigation', () => {
  test('tracker page loads with expected landmarks', async ({ page }) => {
    await page.goto('/tracker.html');
    await waitForTrackerReady(page);
    await expect(page).toHaveTitle(/tracker|gold|price/i);
    await expect(page.locator('main')).toBeVisible();
    // tracker hero uses .tracker-hero-wrap in markup
    await expect(page.locator('.tracker-hero-wrap')).toBeVisible();
  });

  test('mode tabs are visible and navigable', async ({ page }) => {
    await page.goto('/tracker.html');
    await waitForTrackerReady(page);
    await page.waitForSelector('[role="tablist"]', { timeout: 10000 });

    const tabList = page.locator('[role="tablist"].tracker-modes').first();
    await expect(tabList).toBeVisible();

    // Exactly 5 tabs are present (live, compare, archive, exports, method)
    const tabs = tabList.locator('[role="tab"]');
    await expect(tabs).toHaveCount(5, { timeout: 5000 });
  });

  test('live mode panel is visible by default', async ({ page }) => {
    await page.goto('/tracker.html');
    await waitForTrackerReady(page);
    await page.waitForSelector('#mode-live', { timeout: 10000 });

    const livePanel = page.locator('#mode-live');
    await expect(livePanel).toBeVisible();
  });

  test('clicking compare tab switches to compare panel', async ({ page }) => {
    await page.goto('/tracker.html');
    await waitForTrackerReady(page);
    await page.waitForSelector('.tracker-mode-tab[data-mode="compare"]', { timeout: 10000 });

    await page.locator('.tracker-mode-tab[data-mode="compare"]').click();

    // Compare panel should become visible
    const comparePanel = page.locator('#mode-compare');
    await expect(comparePanel).toBeVisible({ timeout: 5000 });
  });

  test('tracker has a link to methodology', async ({ page }) => {
    await page.goto('/tracker.html');
    await waitForTrackerReady(page);
    await page.waitForSelector('main a[href*="methodology"]', { timeout: 10000 });

    const methodLink = page.locator('main a[href*="methodology"]:visible').first();
    await expect(methodLink).toBeVisible();
  });

  test('method tab opens the methodology panel', async ({ page }) => {
    await page.goto('/tracker.html');
    await waitForTrackerReady(page);
    await page.locator('#tp-workspace-toggle').click();
    await expect(page.locator('body')).toHaveClass(/tracker-workspace-advanced/);
    await page.waitForSelector('.tracker-mode-tab[data-mode="method"]', { timeout: 10000 });

    await page.locator('.tracker-mode-tab[data-mode="method"]').click();

    const methodPanel = page.locator('#mode-method');
    await expect(methodPanel).toBeVisible({ timeout: 5000 });

    // Should contain methodology link
    await expect(page.locator('#mode-method a[href*="methodology"]:visible').first()).toBeVisible();
  });

  test('tracker has XAU/USD price element', async ({ page }) => {
    await page.goto('/tracker.html');
    await waitForTrackerReady(page);
    await page.waitForSelector('#tp-xauusd-value', { timeout: 10000 });
    await expect(page.locator('#tp-xauusd-value')).toBeVisible();
  });
});
