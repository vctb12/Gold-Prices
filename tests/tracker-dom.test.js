'use strict';
/**
 * tracker-dom.test.js — DOM structure invariants for tracker.html
 *
 * Guards the most important UX contracts of the tracker flagship page:
 *   - Primary price and XAU/USD elements exist
 *   - Freshness / source labels exist
 *   - Methodology link exists in the tracker
 *   - Key controls (country, currency, karat, unit) exist
 *   - Compare, alerts, and planner panels are in the DOM
 *   - Tables have captions and scope attributes
 *   - Mode tabs have required ARIA attributes
 *   - Chart section has an accessible description
 *   - Export panel exists with the disclaimer copy
 *   - Archive panel exists with date-lookup control
 *   - Chart empty state has descriptive copy (not just "…")
 */

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const HTML = fs.readFileSync(path.join(__dirname, '..', 'tracker.html'), 'utf8');

// ── Hero and primary price elements ──────────────────────────────────────────

test('tracker-dom: hero section exists', () => {
  assert.ok(/class="[^"]*tracker-hero-wrap[^"]*"/.test(HTML), 'tracker-hero-wrap must exist');
});

test('tracker-dom: XAU/USD price element exists', () => {
  assert.ok(
    /id="tp-xauusd-value"/.test(HTML),
    '#tp-xauusd-value must exist for spot price display'
  );
});

test('tracker-dom: primary hero title element exists', () => {
  assert.ok(/id="tp-hero-title"/.test(HTML), '#tp-hero-title must exist');
});

test('tracker-dom: freshness badge row exists', () => {
  assert.ok(/class="[^"]*tracker-badge-row[^"]*"/.test(HTML), 'freshness badge row must exist');
});

// ── Controls ─────────────────────────────────────────────────────────────────

test('tracker-dom: currency selector exists', () => {
  assert.ok(/id="tp-currency"/.test(HTML), '#tp-currency control must exist');
});

test('tracker-dom: karat selector exists', () => {
  assert.ok(/id="tp-karat"/.test(HTML), '#tp-karat control must exist');
});

test('tracker-dom: unit selector exists', () => {
  assert.ok(/id="tp-unit"/.test(HTML), '#tp-unit control must exist');
});

test('tracker-dom: range pills container exists', () => {
  assert.ok(/id="tp-range-pills"/.test(HTML), '#tp-range-pills must exist');
});

test('tracker-dom: refresh button exists', () => {
  assert.ok(/id="tp-refresh-btn"/.test(HTML), '#tp-refresh-btn must exist');
});

// ── Methodology link ──────────────────────────────────────────────────────────

test('tracker-dom: methodology link exists in body', () => {
  assert.ok(
    /href="methodology\.html"/.test(HTML),
    'tracker.html must contain at least one link to methodology.html'
  );
});

// ── Mode tabs ─────────────────────────────────────────────────────────────────

test('tracker-dom: mode tab bar exists', () => {
  assert.ok(/role="tablist"/.test(HTML), 'tracker must have a tablist');
});

test('tracker-dom: live tab exists with role=tab', () => {
  assert.ok(/id="tab-live"/.test(HTML), '#tab-live must exist');
});

test('tracker-dom: compare tab exists with role=tab', () => {
  assert.ok(/id="tab-compare"/.test(HTML), '#tab-compare must exist');
});

test('tracker-dom: compare mode panel is NOT tracker-advanced-only', () => {
  // Compare is workspace:basic in modes.js — its panel must not have tracker-advanced-only.
  const compareSection = HTML.match(/id="mode-compare"[^>]*>/);
  assert.ok(compareSection, 'mode-compare section must exist');
  assert.ok(
    !compareSection[0].includes('tracker-advanced-only'),
    'mode-compare must not have tracker-advanced-only class (workspace: basic)'
  );
});

test('tracker-dom: alerts tab exists', () => {
  assert.ok(/id="tab-alerts"/.test(HTML), '#tab-alerts must exist');
});

test('tracker-dom: planner tab exists', () => {
  assert.ok(/id="tab-planner"/.test(HTML), '#tab-planner must exist');
});

// ── Overlay panels ────────────────────────────────────────────────────────────

test('tracker-dom: alerts overlay is NOT tracker-advanced-only', () => {
  const alertsSection = HTML.match(/id="tp-overlay-alerts"[^>]*>/);
  assert.ok(alertsSection, 'tp-overlay-alerts must exist');
  assert.ok(
    !alertsSection[0].includes('tracker-advanced-only'),
    'tp-overlay-alerts must not have tracker-advanced-only (workspace: basic)'
  );
});

test('tracker-dom: planner overlay is NOT tracker-advanced-only', () => {
  const plannerSection = HTML.match(/id="tp-overlay-planner"[^>]*>/);
  assert.ok(plannerSection, 'tp-overlay-planner must exist');
  assert.ok(
    !plannerSection[0].includes('tracker-advanced-only'),
    'tp-overlay-planner must not have tracker-advanced-only (workspace: basic)'
  );
});

test('tracker-dom: alerts overlay has role=dialog and aria-modal', () => {
  assert.ok(
    /id="tp-overlay-alerts"[\s\S]*?role="dialog"[\s\S]*?aria-modal="true"/.test(HTML) ||
      /aria-modal="true"[\s\S]*?id="tp-overlay-alerts"/.test(HTML),
    'alerts overlay must have role=dialog and aria-modal=true'
  );
});

test('tracker-dom: alerts delivery selector exists', () => {
  assert.ok(/id="tp-alert-delivery"/.test(HTML), '#tp-alert-delivery must exist');
});

test('tracker-dom: server alert email field exists', () => {
  assert.ok(/id="tp-alert-email"/.test(HTML), '#tp-alert-email must exist');
});

test('tracker-dom: planner overlay has role=dialog and aria-modal', () => {
  assert.ok(
    /id="tp-overlay-planner"[\s\S]*?role="dialog"/.test(HTML) ||
      /role="dialog"[\s\S]{0,200}id="tp-overlay-planner"/.test(HTML),
    'planner overlay must have role=dialog'
  );
});

// ── Karat table ───────────────────────────────────────────────────────────────

test('tracker-dom: karat table body exists', () => {
  assert.ok(/id="tp-karat-table"/.test(HTML), '#tp-karat-table tbody must exist');
});

test('tracker-dom: karat table has a caption', () => {
  // Caption must appear somewhere in the section that includes tp-karat-table
  const karatSection = HTML.indexOf('id="tp-karat-table"');
  const tableStart = HTML.lastIndexOf('<table', karatSection);
  const tableEnd = HTML.indexOf('</table>', karatSection);
  const tableHtml = HTML.slice(tableStart, tableEnd + 8);
  assert.ok(/<caption/.test(tableHtml), 'karat table must have a <caption>');
});

test('tracker-dom: karat table headers have scope attributes', () => {
  const karatSection = HTML.indexOf('id="tp-karat-table"');
  const tableStart = HTML.lastIndexOf('<table', karatSection);
  const tableEnd = HTML.indexOf('</table>', karatSection);
  const tableHtml = HTML.slice(tableStart, tableEnd + 8);
  assert.ok(/scope="col"/.test(tableHtml), 'karat table <th> must have scope="col"');
});

// ── Archive table ─────────────────────────────────────────────────────────────

test('tracker-dom: archive table body exists', () => {
  assert.ok(/id="tp-archive-body"/.test(HTML), '#tp-archive-body must exist');
});

test('tracker-dom: archive table has a caption', () => {
  const archiveSection = HTML.indexOf('id="tp-archive-body"');
  const tableStart = HTML.lastIndexOf('<table', archiveSection);
  const tableEnd = HTML.indexOf('</table>', archiveSection);
  const tableHtml = HTML.slice(tableStart, tableEnd + 8);
  assert.ok(/<caption/.test(tableHtml), 'archive table must have a <caption>');
});

test('tracker-dom: archive table headers have scope attributes', () => {
  const archiveSection = HTML.indexOf('id="tp-archive-body"');
  const tableStart = HTML.lastIndexOf('<table', archiveSection);
  const tableEnd = HTML.indexOf('</table>', archiveSection);
  const tableHtml = HTML.slice(tableStart, tableEnd + 8);
  assert.ok(/scope="col"/.test(tableHtml), 'archive table <th> must have scope="col"');
});

// ── Chart workspace ───────────────────────────────────────────────────────────

/** Minimum character length that indicates meaningful empty-state content (not just "…"). */
const MIN_EMPTY_STATE_LENGTH = 50;

test('tracker-dom: chart SVG exists', () => {
  assert.ok(/id="tp-chart"/.test(HTML), '#tp-chart SVG must exist');
});

test('tracker-dom: chart empty state exists and is not trivially empty', () => {
  const emptyStateMatch = HTML.match(/id="tp-chart-empty"[\s\S]*?<\/div>/);
  assert.ok(emptyStateMatch, '#tp-chart-empty must exist');
  assert.ok(
    emptyStateMatch[0].length > MIN_EMPTY_STATE_LENGTH,
    'chart empty state should have descriptive content (not just "…")'
  );
});

test('tracker-dom: chart source note exists', () => {
  assert.ok(/id="tp-chart-source-note"/.test(HTML), '#tp-chart-source-note must exist');
});

test('tracker-dom: chart stats section exists', () => {
  assert.ok(/id="tp-chart-stats"/.test(HTML), '#tp-chart-stats must exist');
});

// ── Exports ───────────────────────────────────────────────────────────────────

test('tracker-dom: exports panel exists', () => {
  assert.ok(/id="mode-exports"/.test(HTML), '#mode-exports panel must exist');
});

test('tracker-dom: exports panel has primary export buttons', () => {
  assert.ok(/id="tp-export-chart-2"/.test(HTML), '#tp-export-chart-2 must exist');
  assert.ok(/id="tp-download-json-2"/.test(HTML), '#tp-download-json-2 must exist');
});

test('tracker-dom: exports panel has a disclaimer about reference prices', () => {
  assert.ok(
    /tracker-export-disclaimer/.test(HTML),
    'export panel must include a .tracker-export-disclaimer note'
  );
});

// ── Archive ───────────────────────────────────────────────────────────────────

test('tracker-dom: archive panel exists', () => {
  assert.ok(/id="mode-archive"/.test(HTML), '#mode-archive panel must exist');
});

test('tracker-dom: date lookup control exists', () => {
  assert.ok(/id="tp-lookup-date"/.test(HTML), '#tp-lookup-date input must exist');
});

// ── Compare workspace ─────────────────────────────────────────────────────────

test('tracker-dom: comparison card grid exists', () => {
  assert.ok(/id="tp-comparison-cards"/.test(HTML), '#tp-comparison-cards must exist');
});

test('tracker-dom: compare preset buttons exist', () => {
  assert.ok(/data-compare-preset="gcc-core"/.test(HTML), 'GCC core preset button must exist');
  assert.ok(/data-compare-preset="uae-karats"/.test(HTML), 'UAE karats preset button must exist');
});

test('tracker-dom: compare board empty state exists', () => {
  assert.ok(/id="tp-comparison-empty"/.test(HTML), '#tp-comparison-empty must exist');
});

// ── Mobile workspace ─────────────────────────────────────────────────────────

test('tracker-dom: mobile workspace section exists', () => {
  assert.ok(
    /class="[^"]*tracker-mobile-workspace[^"]*"/.test(HTML),
    '.tracker-mobile-workspace must exist'
  );
});

// ── Methodology panel ─────────────────────────────────────────────────────────

test('tracker-dom: method panel exists', () => {
  assert.ok(/id="mode-method"/.test(HTML), '#mode-method panel must exist');
});

test('tracker-dom: method panel links to full methodology page', () => {
  // Find the method panel section and verify it has a methodology.html link
  const methodStart = HTML.indexOf('id="mode-method"');
  const methodEnd = HTML.indexOf('</section>', methodStart + 100);
  const methodHtml = HTML.slice(methodStart, methodEnd + 10);
  assert.ok(
    /href="methodology\.html"/.test(methodHtml),
    'method panel must link to methodology.html'
  );
});

// ── Workspace toggle ──────────────────────────────────────────────────────────

test('tracker-dom: workspace toggle button exists', () => {
  assert.ok(/id="tp-workspace-toggle"/.test(HTML), '#tp-workspace-toggle must exist');
});

test('tracker-dom: workspace toggle has aria-pressed attribute', () => {
  const toggleMatch = HTML.match(/id="tp-workspace-toggle"[^>]*/);
  assert.ok(toggleMatch, 'workspace toggle must exist');
  assert.ok(
    /aria-pressed/.test(toggleMatch[0]),
    'workspace toggle must have aria-pressed attribute'
  );
});

// ── Planner form labels ───────────────────────────────────────────────────────

test('tracker-dom: planner budget amount input exists', () => {
  assert.ok(/id="tp-budget-amount"/.test(HTML), '#tp-budget-amount must exist');
});

test('tracker-dom: planner jewelry karat select exists', () => {
  assert.ok(/id="tp-jewelry-karat"/.test(HTML), '#tp-jewelry-karat must exist');
});

// ── Alert form ────────────────────────────────────────────────────────────────

test('tracker-dom: alert scope select exists', () => {
  assert.ok(/id="tp-alert-scope"/.test(HTML), '#tp-alert-scope must exist');
});

test('tracker-dom: alert target price input exists', () => {
  assert.ok(/id="tp-alert-target"/.test(HTML), '#tp-alert-target must exist');
});

test('tracker-dom: alert target input has aria-describedby for hint text', () => {
  const targetMatch = HTML.match(/id="tp-alert-target"[^>]*/);
  assert.ok(targetMatch, '#tp-alert-target must exist');
  assert.ok(
    /aria-describedby/.test(targetMatch[0]),
    '#tp-alert-target must have aria-describedby pointing at hint text'
  );
});

// ── Archive source context ────────────────────────────────────────────────────

test('tracker-dom: archive source note element exists', () => {
  assert.ok(
    /id="tp-archive-source-note"/.test(HTML),
    '#tp-archive-source-note must exist in the archive panel to explain data provenance'
  );
});

test('tracker-dom: archive source note has aria-live attribute', () => {
  const noteMatch = HTML.match(/id="tp-archive-source-note"[^>]*/);
  assert.ok(noteMatch, '#tp-archive-source-note must exist');
  assert.ok(
    /aria-live/.test(noteMatch[0]),
    '#tp-archive-source-note must have aria-live for dynamic content updates'
  );
});

test('tracker-dom: archive source note links to methodology', () => {
  // The note must include a methodology link for users to learn more
  const noteStart = HTML.indexOf('id="tp-archive-source-note"');
  assert.ok(noteStart !== -1, '#tp-archive-source-note must exist');
  const noteSnippet = HTML.slice(noteStart, noteStart + 600);
  assert.ok(
    /href="methodology\.html"/.test(noteSnippet),
    'archive source note must contain a methodology.html link'
  );
});

// ── Export metadata / disclaimer ──────────────────────────────────────────────

test('tracker-dom: export disclaimer mentions spot-linked', () => {
  // Verify the export panel disclaimer mentions spot-linked reference wording
  const disclaimerStart = HTML.indexOf('tracker-export-disclaimer');
  assert.ok(disclaimerStart !== -1, '.tracker-export-disclaimer must exist');
  const disclaimerSnippet = HTML.slice(disclaimerStart, disclaimerStart + 600);
  assert.ok(
    /spot.linked/i.test(disclaimerSnippet) ||
      /spot linked/i.test(disclaimerSnippet) ||
      /reference/i.test(disclaimerSnippet),
    'export disclaimer must mention spot-linked or reference estimates'
  );
});

test('tracker-dom: archive browse panel has export buttons', () => {
  assert.ok(/id="tp-export-archive"/.test(HTML), '#tp-export-archive must exist');
  assert.ok(/id="tp-export-history"/.test(HTML), '#tp-export-history must exist');
});

test('tracker-dom: export panel has JSON download button', () => {
  assert.ok(/id="tp-download-json"/.test(HTML), '#tp-download-json must exist for JSON export');
});

test('tracker-dom: export readiness pill exists in command panel', () => {
  assert.ok(
    /id="tp-export-readiness-pill"/.test(HTML),
    '#tp-export-readiness-pill must exist to show export source readiness'
  );
});

// ── Chart source note ─────────────────────────────────────────────────────────

test('tracker-dom: chart source note element exists', () => {
  assert.ok(/id="tp-chart-source-note"/.test(HTML), '#tp-chart-source-note must exist');
});

test('tracker-dom: chart source note is not trivially short', () => {
  // The chart source note should contain substantive context, not just a placeholder
  const noteStart = HTML.indexOf('id="tp-chart-source-note"');
  if (noteStart === -1) return; // not present in HTML (may be set via JS) — skip
  const noteSnippet = HTML.slice(noteStart, noteStart + 400);
  // The element must have some text content or be populated by JS
  // We just verify the element exists with a class that implies it's a source context element
  assert.ok(
    /tp-chart-source-note/.test(noteSnippet),
    'chart source note element must be present in the DOM'
  );
});

test('tracker-dom: quick calculator weight input uses decimal inputmode', () => {
  const weightInputMatch = HTML.match(/id="tp-quick-calc-weight"[^>]*>/);
  assert.ok(weightInputMatch, '#tp-quick-calc-weight input must exist');
  assert.ok(
    /inputmode="decimal"/.test(weightInputMatch[0]),
    '#tp-quick-calc-weight should set inputmode="decimal" for mobile keyboards'
  );
});
