const { test, expect } = require('@playwright/test');

test('home freshness surface separates status and source labels', async ({ page }) => {
  await page.goto('/index.html?debugFreshness=1');
  await expect(page.locator('#home-quote-meta-slot')).toBeVisible();
  await expect(page.locator('#home-quote-meta-slot')).toContainText(/Status|الحالة/);
  await expect(page.locator('#home-quote-meta-slot')).toContainText(/Source|المصدر/);
});
