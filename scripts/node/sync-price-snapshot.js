#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const { getSupabaseClient } = require('../../server/lib/supabase-client');
const {
  validatePricePayload,
  buildPriceSnapshotRow,
  insertSnapshotIfNew,
  insertProviderRun,
  upsertProviderHealth,
} = require('../../server/lib/price-snapshots');

const ROOT = path.resolve(__dirname, '../..');
const GOLD_PRICE_FILE = path.join(ROOT, 'data', 'gold_price.json');

function envBool(name, fallback = false) {
  const value = process.env[name];
  if (value === undefined || value === null || value === '') return fallback;
  return ['1', 'true', 'yes', 'on'].includes(String(value).trim().toLowerCase());
}

function readJsonFile(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return null;
  }
}

function appendGithubOutput(name, value) {
  const outputFile = process.env.GITHUB_OUTPUT;
  if (!outputFile) return;
  try {
    fs.appendFileSync(outputFile, `${name}=${String(value)}\n`, 'utf8');
  } catch {
    // best effort only
  }
}

function writeSummary(lines) {
  const summary = process.env.GITHUB_STEP_SUMMARY;
  if (!summary || !Array.isArray(lines) || !lines.length) return;
  try {
    fs.appendFileSync(summary, `${lines.join('\n')}\n`, 'utf8');
  } catch {
    // best effort only
  }
}

async function run() {
  const strictMode = envBool('SNAPSHOT_SYNC_STRICT', false);
  const providerChain = process.env.PRICE_PROVIDER_CHAIN || '';
  const circuitState = process.env.PRICE_CIRCUIT_STATE || null;
  const payload = readJsonFile(process.env.PRICE_JSON_PATH || GOLD_PRICE_FILE);

  if (!payload) {
    const message = 'gold_price.json is missing or invalid JSON';
    appendGithubOutput('snapshot_synced', 'false');
    appendGithubOutput('snapshot_sync_reason', 'invalid_payload_file');
    if (strictMode) throw new Error(message);
    writeSummary([`- Snapshot sync skipped: ${message}`]);
    return 0;
  }

  const validated = validatePricePayload(payload);
  if (!validated.ok) {
    const reason = validated.errors.join('; ');
    appendGithubOutput('snapshot_synced', 'false');
    appendGithubOutput('snapshot_sync_reason', 'validation_failed');
    appendGithubOutput('snapshot_validation_error', reason);
    if (strictMode) throw new Error(`snapshot validation failed: ${reason}`);
    writeSummary([`- Snapshot sync skipped: validation failed (${reason})`]);
    return 0;
  }

  const supabase = getSupabaseClient(false);
  if (!supabase) {
    appendGithubOutput('snapshot_synced', 'false');
    appendGithubOutput('snapshot_sync_reason', 'supabase_not_configured');
    writeSummary(['- Snapshot sync skipped: Supabase not configured']);
    return 0;
  }

  try {
    const row = buildPriceSnapshotRow(validated.normalized, { providerChain });
    const snapshotResult = await insertSnapshotIfNew(supabase, row);
    // Record provider telemetry for every fetch run, even when the snapshot is
    // a duplicate. This keeps provider health/latency metrics current across
    // retries and repeated polls that intentionally do not create new snapshots.
    await insertProviderRun(supabase, validated.normalized, { circuitState });
    await upsertProviderHealth(
      supabase,
      validated.normalized.sourceProvider,
      circuitState || (validated.normalized.isFallback ? 'fallback' : 'closed')
    );

    appendGithubOutput('snapshot_synced', snapshotResult.inserted ? 'true' : 'false');
    appendGithubOutput('snapshot_duplicate', snapshotResult.duplicate ? 'true' : 'false');
    appendGithubOutput(
      'snapshot_sync_reason',
      snapshotResult.duplicate ? 'duplicate_snapshot' : 'inserted'
    );

    const summaryLine = snapshotResult.duplicate
      ? '- Snapshot sync: duplicate snapshot skipped; provider run + health were still updated.'
      : '- Snapshot sync: inserted into price_snapshots and updated provider health.';
    writeSummary([summaryLine]);
    return 0;
  } catch (error) {
    appendGithubOutput('snapshot_synced', 'false');
    appendGithubOutput('snapshot_sync_reason', 'sync_failed');
    appendGithubOutput('snapshot_sync_error', error.message || 'unknown error');
    if (strictMode) throw error;
    writeSummary([`- Snapshot sync failed (non-strict mode): ${error.message || 'unknown error'}`]);
    return 0;
  }
}

run()
  .then((code) => {
    process.exit(code);
  })
  .catch((error) => {
    console.error(`[sync-price-snapshot] ${error.message || error}`);
    process.exit(1);
  });
