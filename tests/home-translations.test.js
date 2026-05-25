'use strict';

/**
 * Tests for new home page translation keys added in Round 8 and Round 10:
 * - Karat strip unit toggle labels (gram / tola / oz)
 * - Markets highlights section copy
 * - Country search filter (Round 10)
 *
 * Ensures EN/AR parity so bilingual rendering stays consistent.
 */

const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

async function loadTranslations() {
  const url = new URL(
    'file://' + path.resolve(__dirname, '..', 'src', 'config', 'translations.js')
  );
  const mod = await import(url.href);
  return mod.TRANSLATIONS;
}

// Keys that must be present in both EN and AR (bilingual parity).
const REQUIRED_KEYS = [
  // Karat strip unit toggle
  'home.unitGram',
  'home.unitTola',
  'home.unitOz',
  'home.unitToggleLabel',
  'home.karatStripLabelGram',
  'home.karatStripLabelTola',
  'home.karatStripLabelOz',
  'home.karatCopyAriaLabel',
  // Markets highlights
  'home.marketsTitle',
  'home.marketsSub',
  'home.marketsSeeAll',
  'home.mktDubaiName',
  'home.mktDubaiLoc',
  'home.mktDubaiDesc',
  'home.mktDubaiCta',
  'home.mktRiyadhName',
  'home.mktRiyadhLoc',
  'home.mktRiyadhDesc',
  'home.mktRiyadhCta',
  'home.mktKuwaitName',
  'home.mktKuwaitLoc',
  'home.mktKuwaitDesc',
  'home.mktKuwaitCta',
  'home.mktCairoName',
  'home.mktCairoLoc',
  'home.mktCairoDesc',
  'home.mktCairoCta',
  'home.marketsNote',
  // Tracker welcome strip
  'tracker.welcome.chip1Bold',
  'tracker.welcome.chip1Rest',
  'tracker.welcome.chip2Bold',
  'tracker.welcome.chip2Rest',
  'tracker.welcome.chip3Bold',
  'tracker.welcome.chip3Rest',
  'tracker.welcome.dismiss',
  // Country search (Round 10)
  'home.countrySearchPlaceholder',
  'home.countrySearchEmpty',
  'home.freshnessDismiss',
  'home.heroLiveStatusAria',
  'home.statsTitle',
  'home.statsSub',
  'home.stat1Value',
  'home.stat1Label',
  'home.stat2Value',
  'home.stat2Label',
  'home.stat3Value',
  'home.stat3Label',
  'home.stat4Value',
  'home.stat4Label',
  'home.statsDisclaimer',
  // Next-step guides section (Round 12)
  'home.nextStepTitle',
  'home.nextStepSub',
  'home.nextUaeTitle',
  'home.nextUaeDesc',
  'home.nextUaeCta',
  'home.nextDubaiTitle',
  'home.nextDubaiDesc',
  'home.nextDubaiCta',
  'home.nextGccTitle',
  'home.nextGccDesc',
  'home.nextGccCta',
  'home.nextSvrTitle',
  'home.nextSvrDesc',
  'home.nextSvrCta',
  // Tracker pagination (bilingual via translations system)
  'tracker.pagination.prev',
  'tracker.pagination.next',
  'tracker.pagination.prevLabel',
  'tracker.pagination.nextLabel',
  'tracker.pagination.page',
  // Tracker freshness badge variants
  'tracker.refreshBadgeStale',
  'tracker.refreshBadgeUnavailable',
  // Tracker summary data-source item
  'tracker.summary.sourceTitle',
  'tracker.summary.sourceCopy',
  'tracker.heroTitle',
  'tracker.heroSub',
  'tracker.heroCopy',
  'tracker.heroCopyLink',
  'tracker.referenceBannerTitle',
  'tracker.referenceBannerBody',
  'tracker.referenceBannerLink',
  'tracker.referenceBannerClose',
  'tracker.actions.viewChart',
  'tracker.actions.copyBrief',
  'tracker.actions.reset',
  'tracker.controls.language',
  'tracker.controls.currency',
  'tracker.controls.karat',
  'tracker.controls.unit',
  'tracker.hints.reference',
  'tracker.hints.referenceLink',
  'tracker.hints.shortcuts',
  'tracker.quickToolsTitle',
  'tracker.quickToolsCalculator',
  'tracker.quickToolsCountries',
  'tracker.quickToolsShops',
  'tracker.quickToolsMethodology',
  'tracker.quickReferenceAriaLabel',
  'tracker.inlineCalcTitle',
  'tracker.inlineCalcSub',
  'tracker.calcWeightLabel',
  'tracker.calcWeightPlaceholder',
  'tracker.calcKaratLabel',
  'tracker.calcCurrencyLabel',
  'tracker.calcResultLabel',
  'tracker.calcDisclaimer',
  'tracker.calcMethodLink',
  'tracker.countdown',
  'tracker.offlineBanner',
  'tracker.offlineUnknown',
  'nav.shops',
  'nav.methodology',
  'nav.terms',
  'nav.privacy',
  'nav.invest',
  'nav.insights',
  'nav.countries',
  'nav.country',
  'breadcrumbs.ariaLabel',
  'home.countrySearchEmptyQuery',
];

test('new home translation keys exist in both EN and AR', async () => {
  const t = await loadTranslations();
  for (const key of REQUIRED_KEYS) {
    assert.ok(
      typeof t.en[key] === 'string' && t.en[key].length > 0,
      `Missing EN translation for "${key}"`
    );
    assert.ok(
      typeof t.ar[key] === 'string' && t.ar[key].length > 0,
      `Missing AR translation for "${key}"`
    );
  }
});

test('karatCopyAriaLabel contains {karat} placeholder in both locales', async () => {
  const t = await loadTranslations();
  assert.ok(t.en['home.karatCopyAriaLabel'].includes('{karat}'), 'EN should have {karat}');
  assert.ok(t.ar['home.karatCopyAriaLabel'].includes('{karat}'), 'AR should have {karat}');
});

test('karat strip label keys are distinct (gram ≠ tola ≠ oz)', async () => {
  const t = await loadTranslations();
  for (const locale of ['en', 'ar']) {
    const gram = t[locale]['home.karatStripLabelGram'];
    const tola = t[locale]['home.karatStripLabelTola'];
    const oz = t[locale]['home.karatStripLabelOz'];
    assert.notEqual(gram, tola, `${locale}: gram and tola labels must differ`);
    assert.notEqual(gram, oz, `${locale}: gram and oz labels must differ`);
    assert.notEqual(tola, oz, `${locale}: tola and oz labels must differ`);
  }
});

test('markets section has 4 markets each with name, loc, desc, cta keys', async () => {
  const t = await loadTranslations();
  const markets = ['Dubai', 'Riyadh', 'Kuwait', 'Cairo'];
  for (const mkt of markets) {
    const prefix = `home.mkt${mkt}`;
    for (const suffix of ['Name', 'Loc', 'Desc', 'Cta']) {
      const key = `${prefix}${suffix}`;
      assert.ok(typeof t.en[key] === 'string' && t.en[key].length > 0, `EN missing ${key}`);
      assert.ok(typeof t.ar[key] === 'string' && t.ar[key].length > 0, `AR missing ${key}`);
    }
  }
});

test('country search keys are non-empty and bilingual', async () => {
  const t = await loadTranslations();
  const keys = ['home.countrySearchPlaceholder', 'home.countrySearchEmpty'];
  for (const key of keys) {
    assert.ok(typeof t.en[key] === 'string' && t.en[key].length > 0, `EN missing ${key}`);
    assert.ok(typeof t.ar[key] === 'string' && t.ar[key].length > 0, `AR missing ${key}`);
    // EN and AR should be different strings (not accidentally the same)
    assert.notEqual(t.en[key], t.ar[key], `EN and AR should differ for ${key}`);
  }
});
