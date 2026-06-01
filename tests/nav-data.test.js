/**
 * Integrity tests for src/components/nav-data.js.
 *
 * These guard the nav information-architecture revamp against silent drift:
 *   - both locales must expose the same group keys in the same order
 *   - every href must be a non-empty string
 *   - primary solo links (home, shops) must exist in both locales
 *   - no duplicate hrefs inside a single group (would suggest a copy-paste
 *     bug that fragments analytics and a11y)
 *   - labels must be non-empty strings (prevents blank nav items)
 */

'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

async function loadNav() {
  const url = new URL(
    'file://' + path.resolve(__dirname, '..', 'src', 'components', 'nav-data.js')
  );
  return import(url.href);
}

test('NAV_DATA exposes both en and ar locales', async () => {
  const { NAV_DATA } = await loadNav();
  assert.ok(NAV_DATA.en, 'NAV_DATA.en missing');
  assert.ok(NAV_DATA.ar, 'NAV_DATA.ar missing');
});

test('NAV_DATA solo links exist in both locales', async () => {
  const { NAV_DATA } = await loadNav();
  for (const lang of ['en', 'ar']) {
    assert.ok(NAV_DATA[lang].home?.href, `${lang}.home.href missing`);
    assert.ok(NAV_DATA[lang].home?.label, `${lang}.home.label missing`);
    assert.ok(NAV_DATA[lang].shops?.href, `${lang}.shops.href missing`);
    assert.ok(NAV_DATA[lang].shops?.label, `${lang}.shops.label missing`);
  }
});

test('NAV_DATA group keys match between locales', async () => {
  const { NAV_DATA } = await loadNav();
  const enKeys = NAV_DATA.en.groups.map((g) => g.key);
  const arKeys = NAV_DATA.ar.groups.map((g) => g.key);
  // Top-level order is intentional IA: primary price checking, tools, buying, markets.
  const expectedKeys = ['prices', 'tools', 'discover'];
  assert.deepEqual(enKeys, expectedKeys);
  assert.deepEqual(arKeys, expectedKeys);
  assert.deepEqual(
    enKeys,
    arKeys,
    `EN/AR group keys diverged. en=${enKeys.join(',')} ar=${arKeys.join(',')}`
  );
});

test('NAV_DATA groups each have the same item count across locales', async () => {
  const { NAV_DATA } = await loadNav();
  for (let i = 0; i < NAV_DATA.en.groups.length; i += 1) {
    const en = NAV_DATA.en.groups[i];
    const ar = NAV_DATA.ar.groups[i];
    assert.equal(
      en.items.length,
      ar.items.length,
      `Group "${en.key}" has ${en.items.length} EN items vs ${ar.items.length} AR items`
    );
  }
});

test('NAV_DATA items all have non-empty href and label', async () => {
  const { NAV_DATA } = await loadNav();
  for (const lang of ['en', 'ar']) {
    for (const group of NAV_DATA[lang].groups) {
      assert.ok(group.key, `${lang} group missing key`);
      assert.ok(group.label, `${lang} group ${group.key} missing label`);
      for (const item of group.items) {
        assert.ok(
          typeof item.href === 'string' && item.href.length > 0,
          `${lang} ${group.key} item has empty href: ${JSON.stringify(item)}`
        );
        assert.ok(
          typeof item.label === 'string' && item.label.length > 0,
          `${lang} ${group.key} item has empty label: ${JSON.stringify(item)}`
        );
      }
    }
  }
});

test('NAV_DATA groups contain no duplicate hrefs within a group', async () => {
  const { NAV_DATA } = await loadNav();
  for (const lang of ['en', 'ar']) {
    for (const group of NAV_DATA[lang].groups) {
      const seen = new Set();
      for (const item of group.items) {
        assert.ok(!seen.has(item.href), `Duplicate href in ${lang}.${group.key}: ${item.href}`);
        seen.add(item.href);
      }
    }
  }
});

test('NAV_DATA has no links to removed consolidated content landings', async () => {
  const { NAV_DATA } = await loadNav();
  const removed = new Set([
    '/content/compare-countries/',
    '/content/todays-best-rates/',
    '/content/premium-watch/',
    '/content/news/',
    '/content/changelog/',
    '/content/22k-gold-price-guide/',
    '/content/24k-gold-price-guide/',
  ]);
  for (const lang of ['en', 'ar']) {
    for (const group of NAV_DATA[lang].groups) {
      for (const item of group.items) {
        assert.ok(
          !removed.has(item.href),
          `${lang}.${group.key} still references removed landing: ${item.href}`
        );
      }
    }
  }
});

test('NAV_DATA has no duplicate hrefs across groups (ignoring anchors/query)', async () => {
  const { NAV_DATA } = await loadNav();
  for (const lang of ['en', 'ar']) {
    const seen = new Map();
    for (const group of NAV_DATA[lang].groups) {
      for (const item of group.items) {
        // Anchors/query variants of the same tracker mode are intentionally distinct entries.
        const key = item.href;
        if (seen.has(key)) {
          throw new Error(
            `Duplicate href across groups in ${lang}: ${key} ` +
              `(first in ${seen.get(key)}, again in ${group.key})`
          );
        }
        seen.set(key, group.key);
      }
    }
  }
});

test('NAV_DATA every group has a layout hint (two-col | one-col)', async () => {
  const { NAV_DATA } = await loadNav();
  for (const lang of ['en', 'ar']) {
    for (const group of NAV_DATA[lang].groups) {
      assert.ok(
        group.layout === 'two-col' || group.layout === 'one-col' || group.layout === 'mega',
        `${lang}.${group.key} missing/invalid layout: ${JSON.stringify(group.layout)}`
      );
    }
  }
});

test('NAV_DATA every dropdown item has a non-empty description', async () => {
  const { NAV_DATA } = await loadNav();
  for (const lang of ['en', 'ar']) {
    for (const group of NAV_DATA[lang].groups) {
      assert.ok(group.key, `${lang} group missing key`);
      assert.ok(group.label, `${lang}.${group.key} missing label`);
      assert.ok(group.description, `${lang}.${group.key} missing description`);
      assert.ok(group.layout, `${lang}.${group.key} missing layout`);
      assert.ok(Array.isArray(group.sections), `${lang}.${group.key} missing sections`);
      assert.ok(group.sections.length > 0, `${lang}.${group.key} has no sections`);
      assert.ok(group.featured?.href, `${lang}.${group.key} missing featured link`);
      assert.ok(group.featured?.label, `${lang}.${group.key} missing featured label`);
      assert.ok(group.featured?.description, `${lang}.${group.key} missing featured description`);
      assert.ok(group.cta?.href, `${lang}.${group.key} missing contextual CTA`);
      assert.ok(group.cta?.label, `${lang}.${group.key} missing CTA label`);
      assert.ok(group.cta?.description, `${lang}.${group.key} missing CTA description`);
      for (const section of group.sections) {
        assert.ok(section.key, `${lang}.${group.key} section missing key`);
        assert.ok(section.label, `${lang}.${group.key}.${section.key} missing label`);
        assert.ok(section.items.length > 0, `${lang}.${group.key}.${section.key} has no items`);
      }
      for (const item of group.items) {
        assert.ok(
          typeof item.description === 'string' && item.description.length > 0,
          `${lang}.${group.key} item "${item.label}" missing description`
        );
      }
    }
  }
});

test('NAV_DATA primary flag exists in prices and tools for both locales', async () => {
  const { NAV_DATA } = await loadNav();
  for (const lang of ['en', 'ar']) {
    for (const key of ['prices', 'tools']) {
      const group = NAV_DATA[lang].groups.find((g) => g.key === key);
      assert.ok(group, `${lang}.${key} group missing`);
      const primaryCount = group.items.filter((it) => it.primary === true).length;
      assert.ok(
        primaryCount >= 1,
        `${lang}.${key} should have at least one primary item, found ${primaryCount}`
      );
    }
  }
});

test('NAV_DATA primary flag membership matches across locales per group', async () => {
  const { NAV_DATA } = await loadNav();
  for (let i = 0; i < NAV_DATA.en.groups.length; i += 1) {
    const en = NAV_DATA.en.groups[i];
    const ar = NAV_DATA.ar.groups[i];
    for (let j = 0; j < en.items.length; j += 1) {
      const enP = Boolean(en.items[j].primary);
      const arP = Boolean(ar.items[j].primary);
      assert.equal(
        enP,
        arP,
        `Primary flag mismatch at ${en.key}[${j}] (en=${enP}, ar=${arP}): ${en.items[j].label} / ${ar.items[j].label}`
      );
    }
  }
});

test('NAV_DATA primary links are slim (live + calculator only)', async () => {
  const { NAV_DATA } = await loadNav();
  for (const lang of ['en', 'ar']) {
    assert.equal(
      NAV_DATA[lang].primaryLinks.length,
      2,
      `${lang} should expose two primary nav links (live + calculator)`
    );
    const keys = NAV_DATA[lang].primaryLinks.map((l) => l.key);
    assert.deepEqual(keys, ['live-prices', 'calculator']);
  }
});

test('NAV_DATA drawer search placeholder exists in both locales', async () => {
  const { NAV_DATA } = await loadNav();
  for (const lang of ['en', 'ar']) {
    assert.ok(
      NAV_DATA[lang].drawerSearchPlaceholder,
      `${lang}.drawerSearchPlaceholder missing`
    );
  }
});

test('NAV_DATA labels are present (langToggle, openMenu, closeMenu, mainNav)', async () => {
  const { NAV_DATA } = await loadNav();
  for (const lang of ['en', 'ar']) {
    assert.ok(NAV_DATA[lang].langToggle, `${lang}.langToggle missing`);
    assert.ok(NAV_DATA[lang].openMenu, `${lang}.openMenu missing`);
    assert.ok(NAV_DATA[lang].closeMenu, `${lang}.closeMenu missing`);
    assert.ok(NAV_DATA[lang].mainNav, `${lang}.mainNav missing`);
    assert.ok(NAV_DATA[lang].brandLabel, `${lang}.brandLabel missing`);
    assert.ok(NAV_DATA[lang].recentSearches, `${lang}.recentSearches missing`);
    assert.ok(NAV_DATA[lang].themeLabels?.auto, `${lang}.themeLabels.auto missing`);
    assert.ok(NAV_DATA[lang].themeLabels?.light, `${lang}.themeLabels.light missing`);
    assert.ok(NAV_DATA[lang].themeLabels?.dark, `${lang}.themeLabels.dark missing`);
  }
});

test('NAV_DATA canonical 7 surfaces are present and locale-parity aligned', async () => {
  const { NAV_DATA } = await loadNav();
  const expected = [
    '/index.html',
    '/tracker.html',
    '/calculator.html',
    '/countries/index.html',
    '/shops.html',
    '/learn.html',
    '/insights.html',
  ];
  assert.deepEqual(NAV_DATA.en.canonicalSurfaces, expected);
  assert.deepEqual(NAV_DATA.ar.canonicalSurfaces, expected);
});
