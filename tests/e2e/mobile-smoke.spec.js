const { test, expect } = require('@playwright/test');

const MOBILE_VIEWPORT = { width: 390, height: 844 };
// Desktop width that is always outside the mobile-drawer media-query range.
const DRAWER_DESKTOP_BREAKPOINT = 1024;

async function expectNoHorizontalOverflow(page, route) {
  const metrics = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    viewportWidth: window.innerWidth,
  }));
  expect(
    metrics.scrollWidth <= metrics.viewportWidth + 1,
    `${route} overflows horizontally: ${metrics.scrollWidth}px > ${metrics.viewportWidth}px`
  ).toBeTruthy();
}

test.describe('Mobile smoke', () => {
  test.use({ viewport: MOBILE_VIEWPORT });

  test('core pages load and show key controls at 390x844', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('main')).toBeVisible();
    await expect(page.locator('#hero-live-card')).toBeVisible();
    await expect(page.locator('.home-tools')).toBeVisible();
    await expect(page.locator('.mobile-bottom-nav')).toBeVisible();
    await expect(page.locator('.mobile-bottom-nav [data-mobile-nav="tracker"]')).toBeVisible();
    await expect(page.locator('.mobile-bottom-nav [data-mobile-nav="calculator"]')).toBeVisible();
    await expect(page.locator('.mobile-bottom-nav [data-mobile-nav="countries"]')).toBeVisible();
    await expect(page.locator('.mobile-bottom-nav [data-mobile-nav="shops"]')).toBeVisible();
    await expect(page.locator('.mobile-bottom-nav [data-mobile-nav="home"]')).toHaveCount(0);
    await expectNoHorizontalOverflow(page, '/');

    await page.goto('/tracker.html');
    await page.waitForSelector('body[data-tracker-shell-ready="true"]', { timeout: 10000 });
    await expect(page.locator('.tracker-modes')).toBeVisible();
    await expect(page.locator('.tracker-mobile-workspace')).toBeVisible();
    await expect(page.locator('#tp-chart-stats')).toBeVisible();
    await expect(page.locator('.mobile-bottom-nav [data-mobile-nav="tracker"]')).toHaveClass(
      /is-active/
    );
    await expectNoHorizontalOverflow(page, '/tracker.html');

    await page.goto('/calculator.html');
    await expect(page.locator('.calc-nav-tabs')).toBeVisible();
    await expect(page.locator('#calc-flow-title')).toBeVisible();
    await expect(page.locator('#val-weight')).toBeVisible();
    await expectNoHorizontalOverflow(page, '/calculator.html');

    await page.goto('/shops.html');
    await expect(page.locator('#shops-filter-toggle')).toBeVisible();
    await expect(page.locator('#shops-search')).toBeVisible();
    await expect(page.locator('#shops-controls-summary')).toBeVisible();
    await expect(page.locator('#shops-mobile-quick-filters')).toBeVisible();
    await expect(
      page.locator('#shops-mobile-quick-filters .shops-quick-filter-chip').first()
    ).toBeVisible();
    await expect(page.locator('[data-listing-tab="verified_shop"]')).toBeVisible();
    await page.locator('#shops-filter-toggle').click();
    await expect(page.locator('#shops-filter-panel')).toHaveClass(/is-open/);
    await expectNoHorizontalOverflow(page, '/shops.html');

    await page.goto('/methodology.html');
    await expect(page.locator('main')).toBeVisible();
    await expectNoHorizontalOverflow(page, '/methodology.html');

    await page.goto('/countries/uae/gold-price/');
    await expect(page.locator('#country-page-title')).toBeVisible();
    await expect(page.locator('#country-karat-cards .country-karat-card').first()).toBeVisible();
    await expect(page.locator('#country-actions .country-action-card').first()).toBeVisible();
    await expectNoHorizontalOverflow(page, '/countries/uae/gold-price/');
  });

  test('mobile drawer toggles with hamburger and closes on Escape without stuck scroll lock', async ({
    page,
  }) => {
    await page.goto('/');
    const burger = page.locator('#nav-hamburger');
    const drawer = page.locator('#nav-drawer');
    await expect(burger).toBeVisible();
    await expect(burger).toHaveAttribute('aria-expanded', 'false');

    // Open
    await burger.click();
    await expect(burger).toHaveAttribute('aria-expanded', 'true');
    await expect(drawer).toHaveAttribute('aria-hidden', 'false');
    await expect(page.locator('#nav-backdrop')).toHaveAttribute('aria-hidden', 'false');
    await expect(page.locator('.site-nav')).toHaveClass(/nav--open/);
    await expect.poll(async () => page.evaluate(() => document.body.style.overflow)).toBe('hidden');

    // Close via hamburger toggle
    await burger.click();
    await expect(burger).toHaveAttribute('aria-expanded', 'false');
    await expect(drawer).toHaveAttribute('aria-hidden', 'true');
    await expect(page.locator('#nav-backdrop')).toHaveAttribute('aria-hidden', 'true');
    await expect(page.locator('.site-nav')).not.toHaveClass(/nav--open/);
    await expect.poll(async () => page.evaluate(() => document.body.style.overflow)).toBe('');

    // Re-open then close via Escape
    await burger.click();
    await expect(drawer).toHaveAttribute('aria-hidden', 'false');

    await page.keyboard.press('Escape');
    await expect(burger).toHaveAttribute('aria-expanded', 'false');
    await expect(drawer).toHaveAttribute('aria-hidden', 'true');
    await expect.poll(async () => page.evaluate(() => document.body.style.overflow)).toBe('');
  });

  test('mobile drawer closes with close button and when resizing past the mobile drawer breakpoint', async ({
    page,
  }) => {
    await page.goto('/');
    const burger = page.locator('#nav-hamburger');
    const drawer = page.locator('#nav-drawer');

    await burger.click();
    await expect(drawer).toHaveAttribute('aria-hidden', 'false');
    await expect(page.locator('#nav-drawer-close')).toBeVisible();
    await page.locator('#nav-drawer-close').click();
    await expect(drawer).toHaveAttribute('aria-hidden', 'true');
    await expect(burger).toHaveAttribute('aria-expanded', 'false');
    await expect.poll(async () => page.evaluate(() => document.body.style.overflow)).toBe('');

    await burger.click();
    await expect(drawer).toHaveAttribute('aria-hidden', 'false');
    await page.setViewportSize({ width: DRAWER_DESKTOP_BREAKPOINT, height: 844 });
    await page.evaluate(() => window.dispatchEvent(new Event('resize')));
    await expect(drawer).toHaveAttribute('aria-hidden', 'true');
    await expect(burger).toHaveAttribute('aria-expanded', 'false');
    await expect.poll(async () => page.evaluate(() => document.body.style.overflow)).toBe('');
  });

  test('mobile drawer closes on backdrop tap', async ({ page }) => {
    await page.setViewportSize({ width: 600, height: 844 });
    await page.goto('/');
    const burger = page.locator('#nav-hamburger');
    const drawer = page.locator('#nav-drawer');

    await burger.click();
    await expect(drawer).toHaveAttribute('aria-hidden', 'false');
    await expect(page.locator('#nav-backdrop')).toHaveAttribute('aria-hidden', 'false');

    await page.locator('#nav-backdrop').click({ position: { x: 10, y: 10 } });
    await expect(drawer).toHaveAttribute('aria-hidden', 'true');
    await expect(burger).toHaveAttribute('aria-expanded', 'false');
    await expect.poll(async () => page.evaluate(() => document.body.style.overflow)).toBe('');
  });

  test('forced RTL layout stays stable on calculator', async ({ page }) => {
    await page.goto('/calculator.html');
    await page.evaluate(() => {
      document.documentElement.setAttribute('dir', 'rtl');
      document.documentElement.setAttribute('lang', 'ar');
    });
    await page.waitForFunction(
      () => document.documentElement.dir === 'rtl' && document.documentElement.lang === 'ar'
    );
    await expect(page.locator('.calc-nav-tabs')).toBeVisible();
    await expect(page.locator('#calc-flow-title')).toBeVisible();
    await expectNoHorizontalOverflow(page, '/calculator.html (forced rtl)');
  });

  test('tracker comparison and export controls stay reachable on mobile', async ({ page }) => {
    await page.goto('/tracker.html');
    await page.waitForSelector('body[data-tracker-shell-ready="true"]', { timeout: 10000 });
    await page.locator('#tp-workspace-toggle').click();
    await page.locator('#tab-compare').click();
    await expect(page.locator('#tp-comparison-cards')).toBeVisible();
    await expect(page.locator('#tp-export-compare')).toBeVisible();
    await page.locator('#tab-exports').click();
    await expect(page.locator('#tp-export-chart-2')).toBeVisible();
    await expect(page.locator('#tp-download-json-2')).toBeVisible();
    await expectNoHorizontalOverflow(page, '/tracker.html mobile compare/exports');
  });
});
