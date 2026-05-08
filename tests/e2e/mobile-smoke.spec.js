const { test, expect } = require('@playwright/test');

const MOBILE_VIEWPORT = { width: 390, height: 844 };

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
    await expectNoHorizontalOverflow(page, '/');

    await page.goto('/tracker.html');
    await page.waitForSelector('body[data-tracker-shell-ready="true"]', { timeout: 10000 });
    await expect(page.locator('.tracker-modes')).toBeVisible();
    await expectNoHorizontalOverflow(page, '/tracker.html');

    await page.goto('/calculator.html');
    await expect(page.locator('.calc-nav-tabs')).toBeVisible();
    await expect(page.locator('#val-weight')).toBeVisible();
    await expectNoHorizontalOverflow(page, '/calculator.html');

    await page.goto('/shops.html');
    await expect(page.locator('#shops-filter-toggle')).toBeVisible();
    await page.locator('#shops-filter-toggle').click();
    await expect(page.locator('#shops-search')).toBeVisible();
    await expectNoHorizontalOverflow(page, '/shops.html');

    await page.goto('/methodology.html');
    await expect(page.locator('main')).toBeVisible();
    await expectNoHorizontalOverflow(page, '/methodology.html');
  });

  test('mobile drawer is reachable and ARIA state updates', async ({ page }) => {
    await page.goto('/');
    const burger = page.locator('#nav-hamburger');
    await expect(burger).toBeVisible();
    await expect(burger).toHaveAttribute('aria-expanded', 'false');

    await burger.click();
    await expect(burger).toHaveAttribute('aria-expanded', 'true');
    await expect(page.locator('#nav-drawer')).toHaveAttribute('aria-hidden', 'false');

    await page.keyboard.press('Escape');
    await expect(burger).toHaveAttribute('aria-expanded', 'false');
    await expect(page.locator('#nav-drawer')).toHaveAttribute('aria-hidden', 'true');
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
    await expectNoHorizontalOverflow(page, '/calculator.html (forced rtl)');
  });
});
