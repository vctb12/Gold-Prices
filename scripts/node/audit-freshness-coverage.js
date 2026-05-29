#!/usr/bin/env node
/**
 * scripts/node/audit-freshness-coverage.js
 *
 * Static-analysis audit of freshness/stale-state coverage across every
 * price-rendering surface in the repo. Read-only. Advisory. Not a gate.
 *
 * Charter refs: AGENTS.md §6.2 (cached / fallback / estimated / delayed
 * values must be labelled with source and timestamp), §6.3 (freshness
 * labels are product elements, not decoration), §6.11 (honest
 * verification — this report says exactly what it checked and what it
 * didn't).
 *
 * Scope (from docs/plans/2026-04-23_freshness-coverage-audit.md §5):
 *   - Enumerates every file under src/ that either (a) imports the
 *     live-status module, (b) references its named exports, or (c) looks
 *     like it renders a gold price (currency/unit strings near numeric
 *     variables).
 *   - For each surface, records whether the three freshness keys
 *     ('live', 'cached', 'stale') appear as string literals.
 *   - Records simple source-label / timestamp-label heuristics.
 *
 * Explicitly NOT in scope:
 *   - §6.1 spot-vs-retail mixing detection (semantic, not heuristic).
 *   - Runtime/DOM coverage (Playwright).
 *
 * Usage:
 *   node scripts/node/audit-freshness-coverage.js           # rewrite reports
 *   node scripts/node/audit-freshness-coverage.js --check   # exit 1 if stale
 *   node scripts/node/audit-freshness-coverage.js --stdout  # print JSON
 */

'use strict';

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');
const OUTPUT_JSON_REL = path.join('reports', 'freshness-coverage.json');
const OUTPUT_MD_REL = path.join('reports', 'freshness-coverage.md');
const OUTPUT_JSON_ABS = path.join(ROOT, OUTPUT_JSON_REL);
const OUTPUT_MD_ABS = path.join(ROOT, OUTPUT_MD_REL);

const CHECK_ONLY = process.argv.includes('--check');
const STDOUT_ONLY = process.argv.includes('--stdout');

// Directories under src/ we scan. Test fixtures, type-only shims, and the
// package.json wrapper are excluded.
const SRC_DIR = path.join(ROOT, 'src');

const LIVE_STATUS_EXPORTS = [
  'getLiveFreshness',
  'getMarketStatus',
  'formatRelativeAge',
  'getAgeMs',
  'GOLD_MARKET',
];

// Currency and unit tokens whose presence alongside numeric interpolation
// is a reasonable proxy for "this file renders a price." Intentionally
// broad — false positives are cheap to review; false negatives are the risk
// we're trying to avoid.
const PRICE_TOKENS = [
  /\bUSD\b/,
  /\bSAR\b/,
  /\bAED\b/,
  /\bEGP\b/,
  /\bINR\b/,
  /\bGBP\b/,
  /\bEUR\b/,
  /\/\s*g\b/,
  /\/\s*gram/i,
  /\/\s*oz/i,
  /per\s+ounce/i,
  /\bspot\b/i,
  /\bkarat\b/i,
  /\b(24|22|21|18)\s*k\b/i,
];

const FRESHNESS_KEYS = ['live', 'cached', 'stale', 'unavailable'];

// ---------------------------------------------------------------------------
// Audit exemptions
// ---------------------------------------------------------------------------
// Files classified by the heuristics above as "renders price-like content"
// but which a human reviewer has confirmed do not actually render a live
// gold price on a user-facing surface. Each entry carries a reason string
// that is copied into the report so the exemption is visible and
// reviewable as a plain diff — this is the §6.3 discipline applied to the
// audit itself: the decision is a product element, not decoration.
//
// The set is intentionally small. Reviewers adding an entry must document
// the reason in a single sentence. Entries are only valid for files that
// truly never call `updateSpotBar` / `updateTicker` / any renderer that
// surfaces a price value to the DOM.
const AUDIT_EXEMPTIONS = {
  'src/components/nav-data.js':
    'Nav-link metadata; "22k"/"24k" strings are category labels, not prices.',
  'src/config/countries.js': 'Static country/currency config table; no live values.',
  'src/config/translations.js': 'i18n string catalogue; no live values.',
  'src/lib/count-up.js': 'Generic number-animation utility; currency-agnostic.',
  'src/lib/export.js': 'CSV/JSON export helper; ships user-triggered snapshots, not live values.',
  'src/lib/formatter.js':
    'Pure formatter (locale/currency/time); callers own freshness. The three freshness keys appear in source.* translation keys, not as renderer branches.',
  'src/lib/price-calculator.js':
    'Pure math library (purity × grams × spot); no DOM, no time dimension.',
  'src/routes/routeRegistry.js':
    'Static route metadata (paths, titles, descriptions); no runtime prices.',
  'src/search/searchIndex.js':
    'Search index generator; "live" is an entity-type label, not a freshness key.',
  'src/seo/metadataGenerator.js':
    'Server-side SEO meta builder (titles, descriptions); static per-page.',
  'src/seo/seoHead.js': 'SEO head snippet emitter; static metadata.',
  'src/social/postTemplates.js':
    'Social post copy templates; rendered by scripts/python at post time, not in the browser.',
  'src/tracker/events.js':
    "'live' is the tracker mode-name (VALID_MODES), not a freshness key. Tracker freshness is owned by src/tracker/render.js.",
  'src/tracker/state.js':
    "'live' is the default tracker mode-name; tracker freshness lives on _state.live.updatedAt and is consumed by render.js.",
  'src/tracker/ui-shell.js':
    "'live' references are mode-name checks; now forwards hasLiveFailure into updateSpotBar, which owns the freshness label.",
  'src/utils/inputValidation.js':
    'Input validators (regex); tokens like "karat" appear in validator names/messages, not prices.',
  'src/pages/learn.js': 'Static educational content page; no live prices.',
  'src/pages/methodology.js': 'Static methodology page; no live prices.',
  'src/pages/shops.js':
    'Shops directory is a discovery page; shop cards do not render live prices (the `%` trust-score strings + `shop-tag` labels trip the price-token heuristic). The page-level ticker/spotBar calls now forward updatedAt + hasLiveFailure, so §6.2 is satisfied via those shared components.',
  'src/tracker/render.js':
    'Tracker render.js drives freshness data-driven via STATUS_BADGE_CLASS / SOURCE_BADGE_CLASS lookup tables keyed off `freshness.key`. Every state ("live"|"cached"|"stale"|"unavailable") is therefore handled without per-state string literals — the literal-search heuristic is a false negative here.',
};

// Real gaps not yet remediated. Each entry links to a follow-up plan file
// so the audit surfaces them without noise. Removing an entry means the
// gap has been closed and the file either got a live-status import or a
// new exemption with reason.
const KNOWN_GAPS = {
  'src/lib/api.js':
    'Price fetch layer; source is already tagged ("live" vs "cache-fallback"). Freshness ownership sits with callers who render.',
  'src/lib/page-hydrator.js':
    'Country/city hydrator; now threads hasLiveFailure into updateSpotBar but the karat-card grid itself has no stale badge. Tracked for a follow-up plan.',
  'src/pages/calculator.js':
    'Calculator already tracks STATE.spotSource and feeds hasLiveFailure into updateSpotBar + updateTicker. Internal result panels do not yet carry per-panel freshness.',
  'src/pages/tracker-pro.js':
    'Tracker-pro workspace; per-panel freshness coverage tracked by follow-up plan.',
};

// ---------------------------------------------------------------------------

function walk(dir, acc = []) {
  if (!fs.existsSync(dir)) return acc;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
      walk(full, acc);
    } else if (entry.isFile() && (entry.name.endsWith('.js') || entry.name.endsWith('.mjs'))) {
      acc.push(full);
    }
  }
  return acc;
}

function classifyKind(relPath) {
  const norm = relPath.split(path.sep).join('/');
  if (norm === 'src/lib/live-status.js') return 'live-status-module';
  if (norm.startsWith('src/pages/')) return 'page-module';
  if (norm.startsWith('src/tracker/')) return 'tracker-module';
  if (norm.startsWith('src/components/')) return 'component';
  if (norm.startsWith('src/lib/')) return 'lib';
  if (norm.startsWith('src/search/')) return 'search';
  if (norm.startsWith('src/config/')) return 'config';
  return 'other';
}

function detectLiveStatusUsage(source) {
  const imports =
    /from\s+['"][^'"]*lib\/live-status(?:\.js)?['"]/.test(source) ||
    /import\s*\(\s*['"][^'"]*lib\/live-status(?:\.js)?['"]/.test(source);
  const symbols = {};
  for (const sym of LIVE_STATUS_EXPORTS) {
    symbols[sym] = new RegExp(`\\b${sym}\\b`).test(source);
  }
  const any = imports || Object.values(symbols).some(Boolean);
  return { imports, symbols, any };
}

function detectFreshnessKeys(source) {
  const matched = [];
  for (const key of FRESHNESS_KEYS) {
    const re = new RegExp(`['"\`]${key}['"\`]`);
    if (re.test(source)) matched.push(key);
  }
  return matched;
}

function looksLikePriceRender(source) {
  let hits = 0;
  for (const re of PRICE_TOKENS) if (re.test(source)) hits += 1;
  // Require ≥2 distinct token matches to reduce noise from incidental
  // mentions (e.g. a comment that says "per ounce").
  return hits >= 2;
}

function detectLabelHeuristics(source) {
  const hasSourceLabel =
    /\bsource\b/i.test(source) && /(data-source|['"]source['"]|sourceLabel|Source:)/i.test(source);
  const hasTimestampLabel =
    /formatRelativeAge|getAgeMs|\bupdated[_\s-]?at\b|\bago\b|timeText|ageText/i.test(source);
  return { hasSourceLabel, hasTimestampLabel };
}

function recordFor(absPath) {
  const rel = path.relative(ROOT, absPath).split(path.sep).join('/');
  const source = fs.readFileSync(absPath, 'utf8');
  const kind = classifyKind(rel);
  const usage = detectLiveStatusUsage(source);
  const renders = looksLikePriceRender(source);
  const freshnessKeysMatched = detectFreshnessKeys(source);
  const labels = detectLabelHeuristics(source);

  const exemptionReason = AUDIT_EXEMPTIONS[rel] || null;
  const knownGapReason = KNOWN_GAPS[rel] || null;

  const notes = [];
  if (usage.any) {
    for (const key of ['live', 'cached', 'stale']) {
      if (!freshnessKeysMatched.includes(key)) {
        notes.push(`missing '${key}' branch literal`);
      }
    }
  }
  if (renders && !usage.any && kind !== 'live-status-module' && !exemptionReason) {
    notes.push('renders price-like content but no live-status import');
  }
  if (renders && !labels.hasTimestampLabel && !exemptionReason) {
    notes.push('renders price-like content but no timestamp label heuristic');
  }
  if (exemptionReason) notes.push(`EXEMPT: ${exemptionReason}`);
  if (knownGapReason) notes.push(`KNOWN GAP: ${knownGapReason}`);

  // Only include files that are either live-status consumers OR price-like
  // renderers OR the module itself. Everything else is dropped so the
  // report stays focused.
  const include = usage.any || renders || kind === 'live-status-module';

  return {
    include,
    path: rel,
    kind,
    importsLiveStatus: usage.imports,
    usedSymbols: Object.keys(usage.symbols)
      .filter((k) => usage.symbols[k])
      .sort(),
    rendersPriceLike: renders,
    freshnessKeysMatched,
    hasSourceLabel: labels.hasSourceLabel,
    hasTimestampLabel: labels.hasTimestampLabel,
    exempt: Boolean(exemptionReason),
    exemptReason: exemptionReason,
    knownGap: Boolean(knownGapReason),
    knownGapReason,
    notes,
  };
}

function summarize(records) {
  let consumersFull = 0;
  let consumersMissingStale = 0;
  let consumersMissingCached = 0;
  let consumersMissingLive = 0;
  let rendersWithoutLiveStatus = 0;
  let exemptCount = 0;
  let knownGapCount = 0;
  for (const r of records) {
    const usesLiveStatus = r.importsLiveStatus || (r.usedSymbols && r.usedSymbols.length > 0);
    if (usesLiveStatus) {
      const has = (k) => r.freshnessKeysMatched.includes(k);
      if (has('live') && has('cached') && has('stale')) consumersFull += 1;
      if (!has('stale')) consumersMissingStale += 1;
      if (!has('cached')) consumersMissingCached += 1;
      if (!has('live')) consumersMissingLive += 1;
    }
    if (r.rendersPriceLike && !usesLiveStatus && r.kind !== 'live-status-module' && !r.exempt) {
      rendersWithoutLiveStatus += 1;
    }
    if (r.exempt) exemptCount += 1;
    if (r.knownGap) knownGapCount += 1;
  }
  return {
    totalSurfaces: records.length,
    consumersWithAllThreeBranches: consumersFull,
    consumersMissingStale,
    consumersMissingCached,
    consumersMissingLive,
    priceRenderersWithoutLiveStatus: rendersWithoutLiveStatus,
    documentedExemptions: exemptCount,
    knownGapsTracked: knownGapCount,
  };
}

function buildReport() {
  const files = walk(SRC_DIR).sort();
  const rawRecords = files.map(recordFor);
  const records = rawRecords.filter((r) => r.include);
  for (const r of records) delete r.include;
  return {
    schemaVersion: 1,
    generatedAtDate: new Date().toISOString().slice(0, 10),
    scopeNote:
      'Static analysis only. Does not audit §6.1 spot-vs-retail mixing. Advisory, not a gate.',
    summary: summarize(records),
    records,
  };
}

function renderMarkdown(report) {
  const lines = [];
  lines.push('# Freshness-coverage audit');
  lines.push('');
  lines.push('**Static analysis. Advisory, not a gate.**');
  lines.push('');
  lines.push(
    `Generated from \`scripts/node/audit-freshness-coverage.js\` on ${report.generatedAtDate}.`
  );
  lines.push('');
  lines.push('## Scope note');
  lines.push('');
  lines.push(report.scopeNote);
  lines.push('');
  lines.push(
    'Plan: [`docs/plans/2026-04-23_freshness-coverage-audit.md`](../docs/plans/2026-04-23_freshness-coverage-audit.md).'
  );
  lines.push('');
  lines.push('## Summary');
  lines.push('');
  const s = report.summary;
  lines.push(`- Total surfaces: **${s.totalSurfaces}**`);
  lines.push(
    `- Live-status consumers with all three branches (live / cached / stale): **${s.consumersWithAllThreeBranches}**`
  );
  lines.push(`- Consumers missing \`stale\` literal: **${s.consumersMissingStale}**`);
  lines.push(`- Consumers missing \`cached\` literal: **${s.consumersMissingCached}**`);
  lines.push(`- Consumers missing \`live\` literal: **${s.consumersMissingLive}**`);
  lines.push(
    `- Price-like renderers without any live-status import (after exemptions): **${s.priceRenderersWithoutLiveStatus}**`
  );
  lines.push(`- Documented false-positive exemptions: **${s.documentedExemptions}**`);
  lines.push(`- Known real gaps tracked for follow-up: **${s.knownGapsTracked}**`);
  lines.push('');
  lines.push('## Per-surface details');
  lines.push('');
  lines.push('| File | Kind | Imports | Used symbols | Freshness keys | Src / TS | Notes |');
  lines.push('| --- | --- | --- | --- | --- | --- | --- |');
  for (const r of report.records) {
    const src = r.hasSourceLabel ? '✓' : '·';
    const ts = r.hasTimestampLabel ? '✓' : '·';
    const symbols = r.usedSymbols.length ? r.usedSymbols.join(', ') : '—';
    const keys = r.freshnessKeysMatched.length ? r.freshnessKeysMatched.join(', ') : '—';
    const notes = r.notes.length ? r.notes.join('; ') : '';
    lines.push(
      `| \`${r.path}\` | ${r.kind} | ${r.importsLiveStatus ? '✓' : '·'} | ${symbols} | ${keys} | ${src} / ${ts} | ${notes} |`
    );
  }
  lines.push('');
  return lines.join('\n') + '\n';
}

function stringifyJson(report) {
  return JSON.stringify(report, null, 2) + '\n';
}

function normalizeForCheck(s) {
  return s
    .replace(/"generatedAtDate":\s*"[^"]*"/, '"generatedAtDate":"_"')
    .replace(/Generated from.*on \d{4}-\d{2}-\d{2}\./, 'Generated _.');
}

function main() {
  const report = buildReport();
  const json = stringifyJson(report);
  const md = renderMarkdown(report);

  if (STDOUT_ONLY) {
    process.stdout.write(json);
    return;
  }

  if (CHECK_ONLY) {
    let ok = true;
    for (const [abs, rel, fresh] of [
      [OUTPUT_JSON_ABS, OUTPUT_JSON_REL, json],
      [OUTPUT_MD_ABS, OUTPUT_MD_REL, md],
    ]) {
      if (!fs.existsSync(abs)) {
        console.error(`[freshness-coverage:check] ${rel} is missing.`);
        ok = false;
        continue;
      }
      const existing = fs.readFileSync(abs, 'utf8');
      if (normalizeForCheck(existing) !== normalizeForCheck(fresh)) {
        console.error(`[freshness-coverage:check] ${rel} is stale.`);
        ok = false;
      }
    }
    if (!ok) {
      console.error('  Re-run `node scripts/node/audit-freshness-coverage.js` and commit.');
      process.exit(1);
    }
    console.log(
      `[freshness-coverage:check] OK (${report.records.length} surfaces, ${report.summary.consumersWithAllThreeBranches} fully covered)`
    );
    return;
  }

  fs.mkdirSync(path.dirname(OUTPUT_JSON_ABS), { recursive: true });
  fs.writeFileSync(OUTPUT_JSON_ABS, json);
  fs.writeFileSync(OUTPUT_MD_ABS, md);
  console.log(
    `[freshness-coverage] wrote ${OUTPUT_JSON_REL} + ${OUTPUT_MD_REL} (${report.records.length} surfaces)`
  );
}

module.exports = {
  classifyKind,
  detectLiveStatusUsage,
  detectFreshnessKeys,
  looksLikePriceRender,
  detectLabelHeuristics,
  recordFor,
  summarize,
  buildReport,
  renderMarkdown,
  AUDIT_EXEMPTIONS,
  KNOWN_GAPS,
};

if (require.main === module) main();
