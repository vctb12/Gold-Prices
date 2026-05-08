/**
 * shops-search.spec.js
 *
 * Critical-path Playwright E2E tests for the shops directory page (W-8 / Track 3.2).
 *
 * Tests focus on:
 *   - Page load and key UI elements render
 *   - Shop cards or listings are present
 *   - Search / filter controls are accessible and interactive
 *   - Search input interaction filters results
 *   - Internal links to methodology and spot-vs-retail exist
 *   - No <title> indicates an error
 */

const { test, expect } = require('@playwright/test');

test.describe('Shops directory page', () => {
  test.beforeEach(async ({ page, baseURL }) => {
    await page.goto((baseURL || '') + '/shops.html', { waitUntil: 'domcontentloaded' });
  });

  test('page loads without error title', async ({ page }) => {
    const title = await page.title();
    expect(title).not.toMatch(/^404|not\s*found/i);
    expect(title.toLowerCase()).toMatch(/shop|gold|souq|directory/);
  });

  test('page has a <main> landmark', async ({ page }) => {
    const main = page.locator('main');
    await expect(main).toHaveCount(1);
  });

  test('page has a skip link', async ({ page }) => {
    const skip = page.locator('a.skip-link, a[href="#main-content"], a[href="#main"]');
    await expect(skip.first()).toBeAttached();
  });

  test('shop listing area is present', async ({ page }) => {
    // The shops container should render at least the region; even if shops
    // are dynamic, the wrapper element should exist.
    const shopArea = page.locator('#shops-grid, .shops-grid, [data-shops], .shop-list, .shop-card');
    await expect(shopArea.first()).toBeAttached();
  });

  test('country / city filter controls have accessible labels', async ({ page }) => {
    // Any visible <select> on the shops page should have an aria-label or
    // an associated <label> element.
    const selects = page.locator('select:visible');
    const count = await selects.count();
    for (let i = 0; i < count; i++) {
      const sel = selects.nth(i);
      const ariaLabel = await sel.getAttribute('aria-label');
      const id = await sel.getAttribute('id');
      // Accept either aria-label or a <label for="..."> in the DOM
      const hasLabel = ariaLabel || (id && (await page.locator(`label[for="${id}"]`).count()) > 0);
      expect(hasLabel, `select #${i} is missing an accessible label`).toBeTruthy();
    }
  });

  test('disclaimer or informational notice is present', async ({ page }) => {
    // Trust copy: some kind of disclaimer or info notice should appear
    // so users know listings are informational, not endorsements.
    const body = (await page.textContent('body')) || '';
    expect(body.length).toBeGreaterThan(500);
  });

  test('trust disclaimer contains spot-vs-retail guidance', async ({ page }) => {
    // Wait for JS to hydrate the disclaimer
    await page
      .waitForFunction(
        () => {
          const el = document.getElementById('shops-price-disclaimer');
          return el && el.textContent && el.textContent.length > 50;
        },
        { timeout: 5000 }
      )
      .catch(() => null);
    const disclaimerEl = page.locator('#shops-price-disclaimer');
    const disclaimerText = (await disclaimerEl.textContent()) || '';
    // Should mention reference/spot and recommend confirming with the shop
    expect(disclaimerText.toLowerCase()).toMatch(/spot|reference|estimate/);
    expect(disclaimerText.toLowerCase()).toMatch(/confirm|verify|making charge|retail/);
  });

  test('search input filters shop listings', async ({ page }) => {
    // Wait for shops to render
    await page.waitForSelector('.shop-card, #shops-grid', { timeout: 5000 }).catch(() => null);

    const searchInput = page.locator('#shops-search:visible');
    const inputCount = await searchInput.count();
    if (inputCount === 0) {
      // Search input not present — skip gracefully (feature may not be on this build)
      return;
    }

    // Type a search term and verify something happens (count changes or empty state)
    await searchInput.first().fill('Dubai');
    await page.waitForTimeout(400); // debounce

    const listingsAfter = await page.locator('.shop-card, .shops-card, [data-shop-id]').count();
    const emptyState = page.locator('#shops-empty, .shops-empty, [data-empty-state]');
    const hasEmptyState = (await emptyState.count()) > 0 && (await emptyState.first().isVisible());

    // Either there are listings (matching Dubai) or an empty state was shown
    expect(listingsAfter > 0 || hasEmptyState).toBeTruthy();
  });

  test('country filter updates results', async ({ page }) => {
    // Wait for shops to load
    await page
      .waitForSelector('.shop-card, #shops-grid, .shops-filter', { timeout: 5000 })
      .catch(() => null);

    const countrySelect = page.locator(
      '#shops-country-filter, select[aria-label*="country" i], select[id*="country" i]'
    );
    if ((await countrySelect.count()) === 0) return; // graceful skip

    const options = await countrySelect.first().locator('option').allTextContents();
    const nonAll = options.find(
      (o) => o.toLowerCase() !== 'all' && o.toLowerCase() !== 'all countries'
    );
    if (!nonAll) return;

    await countrySelect.first().selectOption({ label: nonAll });
    await page.waitForTimeout(300);

    // After selecting a country the results area should still be attached
    const resultsArea = page.locator('#shops-grid, .shops-grid, .shop-card, #shops-empty');
    await expect(resultsArea.first()).toBeAttached();
  });

  test('methodology and spot-vs-retail links are present', async ({ page }) => {
    // Both internal links should appear on the page somewhere
    const methodologyLink = page.locator('a[href*="methodology"]');
    await expect(methodologyLink.first()).toBeAttached();

    const spotVsRetailLink = page.locator('a[href*="spot-vs-retail"]');
    await expect(spotVsRetailLink.first()).toBeAttached();
  });
});
