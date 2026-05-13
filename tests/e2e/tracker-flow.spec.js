// @ts-check
const { test, expect } = require('@playwright/test');

async function waitForTrackerReady(page) {
  await page.waitForSelector('body[data-tracker-shell-ready="true"]', { timeout: 10000 });
}

async function dismissOnboardingIfPresent(page) {
  const dismiss = page.locator('#onb-dismiss');
  if (await dismiss.count()) {
    await dismiss.click().catch(() => null);
  }
}

test.describe('Tracker page — live mode & navigation', () => {
  test('tracker page loads with expected landmarks', async ({ page }) => {
    await page.goto('/tracker.html');
    await waitForTrackerReady(page);
    await expect(page).toHaveTitle(/tracker|gold|price/i);
    await expect(page.locator('main')).toBeVisible();
    // tracker hero uses .tracker-hero-wrap in markup
    await expect(page.locator('.tracker-hero-wrap')).toBeVisible();
    await expect(page.locator('.tracker-mobile-workspace')).toBeAttached();
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
    await page.goto('/tracker.html#mode=live&cur=AED&k=24&u=gram&r=30D');
    await waitForTrackerReady(page);
    await dismissOnboardingIfPresent(page);
    await page.locator('#tp-workspace-toggle').click();
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

  test('historical explorer controls and summary cards render', async ({ page }) => {
    await page.goto('/tracker.html#mode=live&cur=AED&k=24&u=gram&r=30D');
    await waitForTrackerReady(page);
    await expect(page.locator('#tp-range-pills')).toBeVisible();
    await expect(page.locator('[data-range="24H"]')).toBeVisible();
    await expect(page.locator('[data-range="7D"]')).toBeVisible();
    await expect(page.locator('#tp-history-month')).toBeVisible();
    await expect(page.locator('#tp-chart-stats .tracker-stat-card').first()).toBeVisible();
    await expect(page.locator('#tp-chart-source-note')).toBeVisible();
  });

  test('comparison builder supports presets and export', async ({ page }) => {
    await page.goto('/tracker.html#mode=live&cur=AED&k=24&u=gram&r=30D');
    await waitForTrackerReady(page);
    await page.locator('#tp-workspace-toggle').click();
    await page.locator('#tab-compare').click();
    await page.locator('#tp-refresh-btn').click();
    await expect(page.locator('#mode-compare')).toBeVisible();
    await expect(page.locator('#tp-comparison-cards')).toBeVisible();
    await expect(page.locator('#tp-export-compare')).toBeVisible();
    await page.locator('[data-compare-preset="uae-karats"]').click();
    await expect(page.locator('#tp-comparison-cards .comparison-card').first()).toBeVisible();
    await expect(page.locator('#tp-export-compare')).toBeEnabled({ timeout: 10000 });
  });

  test('compare tab is visible and clickable without needing advanced workspace', async ({
    page,
  }) => {
    await page.goto('/tracker.html');
    await waitForTrackerReady(page);
    // Compare is workspace:basic — its tab button must be visible in default state
    const compareTab = page.locator('#tab-compare');
    await expect(compareTab).toBeVisible({ timeout: 5000 });

    // Clicking it should switch to compare mode without requiring workspace toggle
    await compareTab.click();
    await expect(page.locator('#mode-compare')).toBeVisible({ timeout: 5000 });
  });

  test('alerts and planner overlays open without requiring advanced workspace', async ({
    page,
  }) => {
    await page.goto('/tracker.html');
    await waitForTrackerReady(page);

    // Alerts tab button must be visible in basic mode
    const alertsTab = page.locator('#tab-alerts');
    await expect(alertsTab).toBeVisible({ timeout: 5000 });
    await alertsTab.click();
    // Alerts overlay should open
    await expect(page.locator('#tp-overlay-alerts')).toBeVisible({ timeout: 5000 });

    // Close it
    await page.locator('#tp-overlay-alerts .tp-overlay-close').click();
    await expect(page.locator('#tp-overlay-alerts')).toBeHidden({ timeout: 3000 });

    // Planner tab button must be visible in basic mode
    const plannerTab = page.locator('#tab-planner');
    await expect(plannerTab).toBeVisible({ timeout: 5000 });
    await plannerTab.click();
    await expect(page.locator('#tp-overlay-planner')).toBeVisible({ timeout: 5000 });
  });

  test('tracker at 360px shows Compare tab and has no horizontal overflow', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 780 });
    await page.goto('/tracker.html');
    await waitForTrackerReady(page);

    // Compare tab visible on 360px
    await expect(page.locator('#tab-compare')).toBeVisible({ timeout: 5000 });

    // No horizontal overflow
    const metrics = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      viewportWidth: window.innerWidth,
    }));
    expect(
      metrics.scrollWidth <= metrics.viewportWidth + 1,
      `tracker at 360px overflows: ${metrics.scrollWidth}px > ${metrics.viewportWidth}px`
    ).toBeTruthy();
  });
});
