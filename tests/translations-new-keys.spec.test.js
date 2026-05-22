'use strict';

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

const REQUIRED_KEYS = [
  'freshness.sourceLabel',
  'freshness.updatedUtcLabel',
  'freshness.badge.live',
  'freshness.badge.cached',
  'freshness.badge.delayed',
  'freshness.badge.estimated',
  'freshness.badge.fallback',
  'freshness.badge.closed',
  'marketStatus.openTitle',
  'marketStatus.openBody',
  'marketStatus.closedTitle',
  'marketStatus.closedBody',
  'marketStatus.note',
  'methodology.sectionTitle',
  'methodology.sectionSub',
  'methodology.title',
  'methodology.sub',
  'methodology.formula',
  'methodology.compareChecklistTitle',
  'methodology.fullPageLink',
  'locationGuides.sectionTitle',
  'locationGuides.sectionSub',
  'locationGuides.title',
  'locationGuides.sub',
  'locationGuides.checklistTitle',
  'trackerAddons.quickPresets.title',
  'trackerAddons.compareHints.title',
  'trackerAddons.exportHelp.title',
  'trackerAddons.alertsHelp.title',
  'tracker.archiveMeta',
  'tracker.archiveSourceMixed',
  'tracker.archiveSourceBaseline',
  'tracker.present',
  'tracker.miniStripSummary',
];

test('new trust-surface keys exist in both EN and AR', async () => {
  const translations = await loadTranslations();
  for (const key of REQUIRED_KEYS) {
    assert.ok(translations.en[key], `Missing EN key: ${key}`);
    assert.ok(translations.ar[key], `Missing AR key: ${key}`);
  }
});
