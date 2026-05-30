/**
 * src/pages/developer.js
 *
 * Client-side controller for the Developer API dashboard (developer.html).
 *
 * Handles:
 *  - Auth state (Supabase bearer token from localStorage)
 *  - API key management (create, list, revoke, regenerate)
 *  - Usage summary display
 */

import { injectNav, updateNavLang } from '../components/nav.js';
import { injectFooter } from '../components/footer.js';
import {
  getAccessToken,
  isAuthenticated,
  redirectToAccount,
} from '../lib/public-account-client.js';
import { escape as esc, el as safeEl, clear as clearEl } from '../lib/safe-dom.js';
import { showCopyToast } from '../lib/copy-toast.js';

const API_BASE = '/api/v1';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function apiFetch(path, options = {}) {
  const token = getAccessToken();
  if (!token && options.auth !== false) {
    redirectToAccount();
    return null;
  }
  const res = await fetch(`${API_BASE}${path}`, {
    method: options.method || 'GET',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
    body: options.body != null ? JSON.stringify(options.body) : undefined,
  });
  const json = await res
    .json()
    .catch(() => ({ ok: false, error: { message: 'Invalid response' } }));
  return { status: res.status, ...json };
}

function getEl(id) {
  return document.getElementById(id);
}

function show(id) {
  const elem = getEl(id);
  if (elem) elem.hidden = false;
}

function hide(id) {
  const elem = getEl(id);
  if (elem) elem.hidden = true;
}

function setText(id, text) {
  const elem = getEl(id);
  if (elem) elem.textContent = text;
}

function formatDate(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('en-GB', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return iso;
  }
}

// ---------------------------------------------------------------------------
// Auth state
// ---------------------------------------------------------------------------

function renderAuthState() {
  if (!isAuthenticated()) {
    show('dev-auth-banner');
    hide('dev-keys-authenticated');
    show('dev-keys-unauthenticated');
    hide('usage-section');
    return false;
  }
  hide('dev-auth-banner');
  hide('dev-keys-unauthenticated');
  show('dev-keys-authenticated');
  show('usage-section');
  return true;
}

// ---------------------------------------------------------------------------
// API key list
// ---------------------------------------------------------------------------

async function loadKeys() {
  const list = getEl('dev-keys-list');
  const empty = getEl('dev-keys-empty');
  const loading = getEl('dev-keys-loading');
  if (!list) return;

  if (loading) loading.hidden = false;
  if (empty) empty.hidden = true;
  clearEl(list);

  const result = await apiFetch('/me/api-keys');
  if (loading) loading.hidden = true;

  if (!result || !result.ok) {
    const errItem = safeEl('li', { class: 'dev-empty' }, [
      'Could not load API keys. Please try again.',
    ]);
    list.appendChild(errItem);
    return;
  }

  const keys = result.data?.keys || [];
  if (keys.length === 0) {
    if (empty) empty.hidden = false;
    return;
  }

  const frag = document.createDocumentFragment();
  for (const k of keys) {
    const info = safeEl('div', { class: 'dev-key-info' }, [
      safeEl('span', { class: 'dev-key-prefix' }, [`${esc(k.keyPrefix)}…`]),
      safeEl('span', { class: 'dev-key-meta' }, [
        `Label: ${esc(k.label)} · Created: ${formatDate(k.createdAt)}`,
      ]),
    ]);

    const badge = safeEl(
      'span',
      { class: `dev-key-badge ${k.revoked ? 'dev-key-badge--revoked' : 'dev-key-badge--active'}` },
      [k.revoked ? 'Revoked' : 'Active']
    );

    const actionsChildren = [];
    if (!k.revoked) {
      actionsChildren.push(
        safeEl(
          'button',
          {
            type: 'button',
            class: 'btn btn-sm btn-outline dev-regenerate-btn',
            'data-key-id': k.id,
            'aria-label': `Rotate key ${esc(k.keyPrefix)}`,
          },
          ['Rotate']
        ),
        safeEl(
          'button',
          {
            type: 'button',
            class: 'btn btn-sm btn-danger dev-revoke-btn',
            'data-key-id': k.id,
            'aria-label': `Revoke key ${esc(k.keyPrefix)}`,
          },
          ['Revoke']
        )
      );
    }
    const actions = safeEl('div', { class: 'dev-key-actions' }, actionsChildren);

    const li = safeEl(
      'li',
      {
        class: `developer-key-item${k.revoked ? ' developer-key-item--revoked' : ''}`,
        'data-key-id': k.id,
      },
      [info, badge, actions]
    );
    frag.appendChild(li);
  }
  list.appendChild(frag);
}

// ---------------------------------------------------------------------------
// Create key
// ---------------------------------------------------------------------------

async function handleCreateKey(evt) {
  evt.preventDefault();
  const btn = getEl('dev-create-key-btn');
  const status = getEl('dev-create-key-status');
  const labelInput = getEl('dev-key-label');

  if (btn) btn.disabled = true;
  if (status) {
    status.textContent = 'Creating…';
    status.className = 'dev-form-status';
  }

  const label = labelInput?.value.trim() || 'default';
  const result = await apiFetch('/me/api-keys', { method: 'POST', body: { label } });

  if (btn) btn.disabled = false;

  if (!result || !result.ok) {
    const msg = result?.error?.message || 'Failed to create key.';
    if (status) {
      status.textContent = msg;
      status.className = 'dev-form-status dev-form-status--error';
    }
    return;
  }

  if (status) {
    status.textContent = '';
  }
  if (labelInput) labelInput.value = '';

  // Show raw key reveal
  const reveal = getEl('dev-new-key-reveal');
  const keyValue = getEl('dev-new-key-value');
  if (reveal && keyValue) {
    keyValue.textContent = result.data.key;
    reveal.hidden = false;
    reveal.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  await loadKeys();
  await loadUsage();
}

// ---------------------------------------------------------------------------
// Revoke key
// ---------------------------------------------------------------------------

async function handleRevoke(keyId) {
  if (!keyId) return;
  if (
    !window.confirm('Revoke this API key? Any application using it will stop working immediately.')
  )
    return;

  const result = await apiFetch(`/me/api-keys/${encodeURIComponent(keyId)}`, { method: 'DELETE' });
  if (!result || !result.ok) {
    showCopyToast(result?.error?.message || 'Could not revoke key.', { durationMs: 4000 });
    return;
  }
  await loadKeys();
}

// ---------------------------------------------------------------------------
// Regenerate key
// ---------------------------------------------------------------------------

async function handleRegenerate(keyId) {
  if (!keyId) return;
  if (
    !window.confirm(
      'Rotate this key? The old key will be revoked immediately and a new one issued.'
    )
  )
    return;

  const result = await apiFetch(`/me/api-keys/${encodeURIComponent(keyId)}/regenerate`, {
    method: 'POST',
  });
  if (!result || !result.ok) {
    showCopyToast(result?.error?.message || 'Could not rotate key.', { durationMs: 4000 });
    return;
  }

  // Show new key
  const reveal = getEl('dev-new-key-reveal');
  const keyValue = getEl('dev-new-key-value');
  if (reveal && keyValue) {
    keyValue.textContent = result.data.key;
    reveal.hidden = false;
    reveal.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  await loadKeys();
}

// ---------------------------------------------------------------------------
// Usage summary
// ---------------------------------------------------------------------------

async function loadUsage() {
  const loading = getEl('dev-usage-loading');
  const summary = getEl('dev-usage-summary');

  if (loading) loading.hidden = false;
  if (summary) summary.hidden = true;

  const result = await apiFetch('/me/api-usage?days=30');

  if (loading) loading.hidden = true;
  if (!result || !result.ok) return;

  const d = result.data;
  setText('dev-usage-today', String(d.todayCalls ?? 0));
  setText('dev-usage-total', String(d.totalCalls ?? 0));
  const dailyQuota = d.quota?.daily;
  const quotaLabel = dailyQuota > 0 ? `${dailyQuota}/day` : dailyQuota === 0 ? 'No quota set' : '—';
  setText('dev-usage-quota', quotaLabel);
  setText('dev-usage-tier', d.quota?.tier || 'free');

  // Quota bar
  const bar = getEl('dev-usage-bar');
  const note = getEl('dev-usage-note');
  if (bar && dailyQuota > 0) {
    const pct = Math.min(100, Math.round(((d.todayCalls || 0) / dailyQuota) * 100));
    bar.style.width = `${pct}%`;
    bar.setAttribute('aria-valuenow', pct);
    if (note)
      note.textContent = `${d.todayCalls || 0} of ${dailyQuota} calls used today (${pct}%).`;
  } else if (bar) {
    bar.style.width = '0%';
    bar.setAttribute('aria-valuenow', 0);
    if (note) note.textContent = 'No daily quota configured for your current tier.';
  }

  if (summary) summary.hidden = false;
}

// ---------------------------------------------------------------------------
// Copy to clipboard
// ---------------------------------------------------------------------------

async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Event delegation
// ---------------------------------------------------------------------------

function attachListeners() {
  const form = getEl('dev-create-key-form');
  if (form) form.addEventListener('submit', handleCreateKey);

  const refreshBtn = getEl('dev-refresh-keys-btn');
  if (refreshBtn)
    refreshBtn.addEventListener('click', () => {
      loadKeys();
      loadUsage();
    });

  const copyBtn = getEl('dev-copy-key-btn');
  if (copyBtn) {
    copyBtn.addEventListener('click', async () => {
      const keyEl = getEl('dev-new-key-value');
      const text = keyEl?.textContent || '';
      const ok = await copyToClipboard(text);
      copyBtn.textContent = ok ? 'Copied!' : 'Copy failed';
      setTimeout(() => {
        copyBtn.textContent = 'Copy';
      }, 2000);
    });
  }

  const dismissBtn = getEl('dev-dismiss-key-btn');
  if (dismissBtn) {
    dismissBtn.addEventListener('click', () => {
      const reveal = getEl('dev-new-key-reveal');
      if (reveal) reveal.hidden = true;
      const keyEl = getEl('dev-new-key-value');
      if (keyEl) keyEl.textContent = '';
    });
  }

  // Delegate revoke / regenerate button clicks inside key list
  const keysList = getEl('dev-keys-list');
  if (keysList) {
    keysList.addEventListener('click', (e) => {
      const revokeBtn = e.target.closest('.dev-revoke-btn');
      const regenBtn = e.target.closest('.dev-regenerate-btn');
      if (revokeBtn) handleRevoke(revokeBtn.dataset.keyId);
      if (regenBtn) handleRegenerate(regenBtn.dataset.keyId);
    });
  }
}

// ---------------------------------------------------------------------------
// Language
// ---------------------------------------------------------------------------

function getLang() {
  try {
    const urlLang = new URLSearchParams(window.location.search).get('lang');
    if (urlLang === 'ar') return 'ar';
    const p = JSON.parse(localStorage.getItem('user_prefs') || '{}');
    return p.lang === 'ar' ? 'ar' : 'en';
  } catch {
    return 'en';
  }
}

// ---------------------------------------------------------------------------
// Init
// ---------------------------------------------------------------------------

async function init() {
  const lang = getLang();
  injectNav?.(lang);
  injectFooter?.();
  if (typeof updateNavLang === 'function') updateNavLang(lang);

  attachListeners();

  const authed = renderAuthState();
  if (authed) {
    await Promise.all([loadKeys(), loadUsage()]);
  }
}

document.addEventListener('DOMContentLoaded', init);
