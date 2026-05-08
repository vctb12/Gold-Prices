const { test, expect } = require('@playwright/test');

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

test.describe('Country gold price pages', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('UAE country page shows prices, trust links, and actions', async ({ page }) => {
    await page.goto('/countries/uae/gold-price/');
    await expect(page.locator('#country-page-title')).toContainText(
      /United Arab Emirates|الإمارات/
    );
    await expect(page.locator('#country-status-list .country-status-card')).toHaveCount(3);
    await expect(page.locator('#country-karat-cards .country-karat-card').first()).toBeVisible();
    await expect(page.locator('#country-price-table')).toBeVisible();
    await expect(page.locator('#country-trust-note a[href*="methodology"]')).toBeVisible();
    await expect(page.locator('#country-actions a[href*="tracker.html"]').first()).toBeVisible();
    await expect(page.locator('#country-actions a[href*="calculator.html"]').first()).toBeVisible();
    await expect(page.locator('script[type="application/ld+json"]')).toHaveCount(3);
    await expectNoHorizontalOverflow(page, '/countries/uae/gold-price/');
  });

  test('Saudi country page keeps FAQ and city links available', async ({ page }) => {
    await page.goto('/countries/saudi-arabia/gold-price/');
    await expect(page.locator('#country-page-title')).toContainText(/Saudi Arabia|السعودية/);
    await expect(
      page.locator('#country-context a[href*="/riyadh/gold-prices/"]').first()
    ).toBeVisible();
    await expect(page.locator('#country-faq-list details').first()).toBeVisible();
    await expect(
      page
        .locator(
          '#country-actions a[href*="compare-countries"], #country-actions a[href*="gcc-gold-price-comparison"]'
        )
        .first()
    ).toBeVisible();
    await expectNoHorizontalOverflow(page, '/countries/saudi-arabia/gold-price/');
  });
});
