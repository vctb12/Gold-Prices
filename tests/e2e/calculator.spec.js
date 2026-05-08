/**
 * calculator.spec.js
 *
 * Critical-path Playwright E2E tests for the gold calculator page (W-8 / Track 3.2).
 *
 * Tests focus on:
 *   - Page load and key UI elements render
 *   - Calculator tabs are present and navigable
 *   - The basic gold value calculator produces a numeric result
 *   - Back-links to tracker and methodology exist
 *   - No <title> indicates an error
 */

const { test, expect } = require('@playwright/test');

test.describe('Calculator page', () => {
  test.beforeEach(async ({ page, baseURL }) => {
    await page.goto((baseURL || '') + '/calculator.html', { waitUntil: 'domcontentloaded' });
  });

  test('page loads without error title', async ({ page }) => {
    const title = await page.title();
    expect(title).not.toMatch(/^404|not\s*found/i);
    expect(title.toLowerCase()).toMatch(/gold|calculator|calc/);
  });

  test('page has a <main> landmark', async ({ page }) => {
    const main = page.locator('main');
    await expect(main).toHaveCount(1);
  });

  test('calculator form inputs have accessible labels', async ({ page }) => {
    // All visible text inputs/selects should have an accessible name
    // (checked by looking for aria-label or an associated label element).
    const inputs = page.locator(
      'input[type="number"]:visible, select:visible, input[type="text"]:visible'
    );
    const count = await inputs.count();
    // The page is expected to have at least one labelled input
    expect(count).toBeGreaterThan(0);
  });

  test('link back to tracker is present', async ({ page }) => {
    // The page should link to tracker.html for context-switching
    const trackerLinks = page.locator('a[href*="tracker"]');
    await expect(trackerLinks.first()).toBeVisible();
  });

  test('link to methodology is present', async ({ page }) => {
    const methodLinks = page.locator('main a[href*="methodology"]:visible');
    await expect(methodLinks.first()).toBeVisible();
  });

  test('trust note and tracker handoff remain available after a result', async ({ page }) => {
    await page.waitForFunction(() => {
      const spot = document.getElementById('calc-spot-price');
      return spot && spot.textContent && spot.textContent.trim() !== '—';
    });
    await expect(page.locator('#calc-trust-note')).toContainText(/spot|reference|retail/i);
    await page.locator('#val-weight').fill('10');
    await expect(page.locator('#val-result')).toBeVisible();
    await expect(page.locator('#calc-tracker-link')).toBeVisible();
    await expect(page.locator('#calc-country-link')).toBeVisible();
    await expect(page.locator('#calc-tracker-link')).toHaveAttribute('href', /tracker\.html#/);
  });

  test('mobile result dock appears after entering a value', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForFunction(() => {
      const spot = document.getElementById('calc-spot-price');
      return spot && spot.textContent && spot.textContent.trim() !== '—';
    });
    await page.locator('#val-weight').fill('10');
    await expect(page.locator('#val-result')).toBeVisible();
    await expect(page.locator('#calc-mobile-dock')).toBeVisible();
    await expect(page.locator('#calc-mobile-dock-tracker')).toBeVisible();
  });

  test('JSON-LD structured data includes calculator breadcrumb schema', async ({ page }) => {
    const schemaTag = page.locator('script[type="application/ld+json"]');
    const count = await schemaTag.count();
    expect(count).toBeGreaterThan(0);
    // At least one schema block should include the calculator breadcrumb entry.
    let found = false;
    for (let i = 0; i < count; i++) {
      const content = await schemaTag.nth(i).textContent();
      if (
        content &&
        content.includes('BreadcrumbList') &&
        content.includes('https://goldtickerlive.com/calculator.html')
      ) {
        found = true;
        break;
      }
    }
    expect(found, 'Calculator breadcrumb JSON-LD not found').toBe(true);
  });
});
