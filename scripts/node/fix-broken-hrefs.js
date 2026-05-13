#!/usr/bin/env node
// phx/20 fix-broken-hrefs: targeted rewrite of broken relative hrefs to
// canonical root-safe paths.
//
// Unlike the legacy scripts/node/fix-links.js (which blindly rewrote every
// "../" href to "/"), this script only touches hrefs that resolve to
// non-existent files under the current relative resolution, and only when the
// correct target is unambiguous.
//
// Categories rewritten:
//   1. "(../)+<top-page>"        → "/<top-page>"
//   2. "(../)+guides/<guide>"    → "/content/guides/<guide>"
//   3. "(../)+countries/<slug>.html" → "/countries/<slug>/"
//   4. "../countries/<slug>/..." → "/countries/<slug>/..."  (from content/* pages)
const fs = require('fs');
const { execSync } = require('child_process');

const COUNTRY_SLUGS = [
  'algeria',
  'bahrain',
  'egypt',
  'india',
  'iraq',
  'jordan',
  'kuwait',
  'lebanon',
  'libya',
  'morocco',
  'oman',
  'pakistan',
  'palestine',
  'qatar',
  'saudi-arabia',
  'sudan',
  'syria',
  'tunisia',
  'turkey',
  'uae',
  'yemen',
];

const TOP_LEVEL_PAGES = [
  'calculator.html',
  'tracker.html',
  'learn.html',
  'methodology.html',
  'shops.html',
  'insights.html',
  'invest.html',
  'privacy.html',
  'terms.html',
];

const GUIDES = [
  'buying-guide.html',
  '24k-vs-22k.html',
  'gold-karat-comparison.html',
  'aed-peg-explained.html',
  'gcc-market-hours.html',
  'invest-in-gold-gcc.html',
  'zakat-gold-guide.html',
];

function esc(re) {
  return re.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const rules = [];

for (const page of TOP_LEVEL_PAGES) {
  rules.push({
    re: new RegExp(`((?:href|src)=")(?:\\.\\./){1,6}${esc(page)}(?=[#"?])`, 'g'),
    to: (_m, attr) => `${attr}/${page}`,
  });
}

for (const g of GUIDES) {
  rules.push({
    re: new RegExp(`((?:href|src)=")(?:\\.\\./){1,6}guides/${esc(g)}(?=[#"?])`, 'g'),
    to: (_m, attr) => `${attr}/content/guides/${g}`,
  });
}

for (const slug of COUNTRY_SLUGS) {
  rules.push({
    re: new RegExp(`((?:href|src)=")(?:\\.\\./){1,6}countries/${esc(slug)}\\.html(?=[#"?])`, 'g'),
    to: (_m, attr) => `${attr}/countries/${slug}/`,
  });
}

rules.push({
  re: /((?:href|src)=")\.\.\/countries\/([a-z-]+)(\/[^"]*)?"/g,
  to: (_m, attr, slug, rest = '') => `${attr}/countries/${slug}${rest}"`,
});

const files = execSync(
  'find . -name "*.html" -not -path "./node_modules/*" -not -path "./dist/*" -not -path "./playwright-report/*" -not -path "./test-results/*"'
)
  .toString()
  .trim()
  .split('\n');

let touched = 0;
for (const f of files) {
  let s = fs.readFileSync(f, 'utf8');
  const before = s;
  for (const { re, to } of rules) {
    s = s.replace(re, to);
  }
  if (s !== before) {
    fs.writeFileSync(f, s);
    touched++;
  }
}

console.log(`Files touched: ${touched}`);
