import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildTrackerHandoffUrl,
  buildShopsHandoffUrl,
  karatFromKstripItem,
  HOME_DEFAULT_TRACKER_LINK_IDS,
} from '../src/lib/page-handoff.js';

test('buildTrackerHandoffUrl encodes live mode hash with karat and unit', () => {
  const href = buildTrackerHandoffUrl({
    mode: 'live',
    cur: 'AED',
    k: '22',
    u: 'tola',
    lang: 'ar',
    r: '30D',
  });
  assert.equal(href, 'tracker.html#mode=live&cur=AED&k=22&u=tola&lang=ar&r=30D');
});

test('buildTrackerHandoffUrl rejects invalid mode and karat', () => {
  const href = buildTrackerHandoffUrl({ mode: 'bogus', k: '99', u: 'stone' });
  assert.ok(href.startsWith('tracker.html#mode=live'));
  assert.ok(!href.includes('k=99'));
  assert.ok(!href.includes('u=stone'));
});

test('buildShopsHandoffUrl passes country and lang query params', () => {
  assert.equal(
    buildShopsHandoffUrl({ countryCode: 'ae', lang: 'en' }),
    'shops.html?country=AE&lang=en'
  );
  assert.equal(buildShopsHandoffUrl(), 'shops.html');
});

test('karatFromKstripItem parses strip item ids', () => {
  assert.equal(karatFromKstripItem({ id: 'kstrip-22' }), '22');
  assert.equal(karatFromKstripItem({ id: 'kstrip-24' }), '24');
  assert.equal(karatFromKstripItem({ id: 'other' }), null);
});

test('HOME_DEFAULT_TRACKER_LINK_IDS includes action rail and markets CTA', () => {
  assert.ok(HOME_DEFAULT_TRACKER_LINK_IDS.includes('home-action-track'));
  assert.ok(HOME_DEFAULT_TRACKER_LINK_IDS.includes('markets-see-tracker'));
  assert.ok(HOME_DEFAULT_TRACKER_LINK_IDS.includes('home-tool-tracker'));
});
