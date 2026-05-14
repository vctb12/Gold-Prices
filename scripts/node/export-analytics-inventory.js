#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const ROOT = path.resolve(__dirname, '..', '..');
const OUTPUT_REL = path.join('reports', 'analytics', 'event-inventory.json');
const OUTPUT_ABS = path.join(ROOT, OUTPUT_REL);
const CHECK_ONLY = process.argv.includes('--check');

async function loadAnalyticsModule() {
  const modPath = path.join(ROOT, 'src', 'lib', 'analytics.js');
  return import(pathToFileURL(modPath).href);
}

function normalize(text) {
  return text.replace(/"generatedAt":\s*"[^"]+"/, '"generatedAt":"_"');
}

async function main() {
  const { EVENT_SCHEMA, EVENT_ALIASES, getEventInventory } = await loadAnalyticsModule();
  const report = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    totals: {
      events: Object.keys(EVENT_SCHEMA || {}).length,
      aliases: Object.keys(EVENT_ALIASES || {}).length,
    },
    aliases: EVENT_ALIASES || {},
    events: typeof getEventInventory === 'function' ? getEventInventory() : [],
  };
  const text = JSON.stringify(report, null, 2) + '\n';

  if (CHECK_ONLY) {
    if (!fs.existsSync(OUTPUT_ABS)) {
      console.warn(
        `[analytics-inventory] ${OUTPUT_REL} is missing. Run \`node scripts/node/export-analytics-inventory.js\`.`
      );
      return;
    }
    const existing = fs.readFileSync(OUTPUT_ABS, 'utf8');
    if (normalize(existing) !== normalize(text)) {
      console.warn(
        `[analytics-inventory] ${OUTPUT_REL} is stale. Run \`node scripts/node/export-analytics-inventory.js\`.`
      );
      return;
    }
    console.log(`[analytics-inventory] check ok (${report.totals.events} events)`);
    return;
  }

  fs.mkdirSync(path.dirname(OUTPUT_ABS), { recursive: true });
  fs.writeFileSync(OUTPUT_ABS, text, 'utf8');
  console.log(`[analytics-inventory] wrote ${OUTPUT_REL} (${report.totals.events} events)`);
}

main().catch((err) => {
  console.error('[analytics-inventory] failed:', err?.message || err);
  process.exit(1);
});
