#!/usr/bin/env node
// phx/14 asset fixer: rewrite broken relative favicon / icon / manifest refs
// in HTML files to root-safe absolute paths.
//
// These files live under country leaf pages (e.g.
// /countries/saudi-arabia/jeddah/gold-rate/24-karat/index.html) and use
// hand-authored relative `../` sequences that don't match the page's actual
// depth from the site root. Since these assets live at `/assets/*` and
// `/favicon.svg` etc. at the site root, the safest fix is to convert the
// refs to root-safe absolute paths so they resolve correctly regardless of
// page depth.
const fs = require('fs');
const { execSync } = require('child_process');

const TARGETS = [
  // filename, root-safe replacement
  { file: 'favicon.svg', replacement: '/favicon.svg' },
  { file: 'assets/favicon-32x32.png', replacement: '/assets/favicon-32x32.png' },
  { file: 'assets/apple-touch-icon.png', replacement: '/assets/apple-touch-icon.png' },
  { file: 'manifest.json', replacement: '/manifest.json' },
];

const files = execSync(
  'find . -name "*.html" -not -path "./node_modules/*" -not -path "./dist/*" -not -path "./playwright-report/*" -not -path "./test-results/*"'
)
  .toString()
  .trim()
  .split('\n');

let totalChanges = 0;
const filesTouched = new Set();

for (const f of files) {
  let s = fs.readFileSync(f, 'utf8');
  const before = s;

  for (const { file, replacement } of TARGETS) {
    // Match ../ (1-6 times) + file, within href="" or src="" attributes.
    const re = new RegExp(
      `((?:href|src)=")(?:\\.\\./){1,6}${file.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&')}"`,
      'g'
    );
    s = s.replace(re, `$1${replacement}"`);
  }

  if (s !== before) {
    fs.writeFileSync(f, s);
    filesTouched.add(f);
    totalChanges += 1;
  }
}

console.log(`Files touched: ${filesTouched.size} (${totalChanges} edits)`);
