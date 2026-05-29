'use strict';

const { spawnSync } = require('node:child_process');
const assert = require('node:assert/strict');
const path = require('node:path');
const { test } = require('node:test');

const repoRoot = path.resolve(__dirname, '..');
const recorderScript = path.join(repoRoot, 'scripts', 'python', 'record_price_history.py');

test('record_price_history dry-run reads the checked-out normalized price snapshot', (t) => {
  const pythonVersion = spawnSync('python3', ['--version'], { encoding: 'utf8' });
  if (pythonVersion.error) {
    t.skip('python3 is not available in this environment');
    return;
  }

  const result = spawnSync('python3', [recorderScript], {
    cwd: repoRoot,
    encoding: 'utf8',
    env: {
      ...process.env,
      DRY_RUN: 'true',
      GOLDPRICEZ_API_KEY: '',
      SUPABASE_SERVICE_KEY: '',
      SUPABASE_URL: '',
    },
  });

  const output = `${result.stdout}\n${result.stderr}`;
  assert.equal(result.status, 0, output);
  assert.match(output, /Spot price from local JSON:/);
  assert.doesNotMatch(output, /Failed to fetch from goldpricez/);
});
