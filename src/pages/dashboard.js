import { injectNav, updateNavLang } from '../components/nav.js';
import { injectFooter } from '../components/footer.js';
import { injectTicker, updateTickerLang } from '../components/ticker.js';
import { injectSpotBar, updateSpotBarLang } from '../components/spotBar.js';
import {
  buildSupabaseBrowserClient,
  deleteMyAccount,
  deleteSavedCalculation,
  deleteSavedShop,
  deleteWatchlistItem,
  exportMyData,
  getMe,
  importLocalStorageData,
  listSavedCalculations,
  listSavedShops,
  listWatchlist,
} from '../lib/public-account-client.js';
import { cacheKeyUserPrefs } from './dashboard.shared.js';

const params = new URLSearchParams(window.location.search);
let lang = params.get('lang') === 'ar' ? 'ar' : 'en';
const DELETE_CONFIRMATION_TOKENS = Object.freeze({
  en: 'DELETE',
  ar: 'حذف',
});

const T = {
  en: {
    authRequired: 'Please sign in first.',
    loaded: 'Dashboard refreshed.',
    importing: 'Importing local browser data…',
    delete: 'Delete',
    empty: 'No saved items yet.',
    refreshFailed: 'Could not refresh dashboard right now.',
    importFailed: 'Import failed. Please try again.',
    signOutFailed: 'Could not sign out right now.',
    loadFailed: 'Could not load dashboard right now.',
    importDone: (r) =>
      `Import complete. Preferences: ${r.preferences ? 'yes' : 'no'}, watchlist: ${r.watchlist}, alerts: ${r.alerts}, shops: ${r.savedShops}, calculations: ${r.savedCalculations}, failed: ${r.failed || 0}.`,
    privacyTitle: 'Account & Privacy',
    privacyCopy:
      'Export your account data as JSON or permanently delete your account data from the app.',
    exportBtn: 'Export my data',
    dangerTitle: 'Danger zone',
    deleteHelp: (token) => `Type ${token} to confirm permanent deletion.`,
    deleteLabel: 'Confirmation text',
    deletePlaceholder: 'Type DELETE',
    deleteBtn: 'Delete my account',
    exportPreparing: 'Preparing your export…',
    exportDone: 'Data export downloaded.',
    exportFailed: 'Could not export your data right now.',
    deleteConfirmRequired: (token) => `Type ${token} exactly to continue.`,
    deleting: 'Deleting account data…',
    deleteDone: 'Account deletion completed. You will be signed out.',
    deleteFailed: 'Could not delete your account right now.',
    signOutAfterDeleteFailed:
      'Deletion finished but sign-out failed. Please close this tab and sign in again to confirm.',
  },
  ar: {
    authRequired: 'يرجى تسجيل الدخول أولاً.',
    loaded: 'تم تحديث لوحة التحكم.',
    importing: 'جارٍ استيراد بيانات المتصفح المحلية…',
    delete: 'حذف',
    empty: 'لا توجد عناصر محفوظة بعد.',
    refreshFailed: 'تعذر تحديث لوحة التحكم حالياً.',
    importFailed: 'فشل الاستيراد. يرجى المحاولة مرة أخرى.',
    signOutFailed: 'تعذر تسجيل الخروج حالياً.',
    loadFailed: 'تعذر تحميل لوحة التحكم حالياً.',
    importDone: (r) =>
      `اكتمل الاستيراد. التفضيلات: ${r.preferences ? 'نعم' : 'لا'}، المراقبة: ${r.watchlist}، التنبيهات: ${r.alerts}، المحلات: ${r.savedShops}، الحاسبات: ${r.savedCalculations}، الفاشلة: ${r.failed || 0}.`,
    privacyTitle: 'الحساب والخصوصية',
    privacyCopy: 'يمكنك تنزيل بيانات حسابك بصيغة JSON أو حذف بيانات الحساب نهائياً من التطبيق.',
    exportBtn: 'تنزيل بياناتي',
    dangerTitle: 'منطقة حساسة',
    deleteHelp: (token) => `اكتب ${token} لتأكيد الحذف النهائي.`,
    deleteLabel: 'نص التأكيد',
    deletePlaceholder: 'اكتب حذف',
    deleteBtn: 'حذف حسابي',
    exportPreparing: 'جارٍ تجهيز ملف البيانات…',
    exportDone: 'تم تنزيل ملف البيانات.',
    exportFailed: 'تعذر تنزيل بياناتك حالياً.',
    deleteConfirmRequired: (token) => `اكتب ${token} كما هي للمتابعة.`,
    deleting: 'جارٍ حذف بيانات الحساب…',
    deleteDone: 'اكتمل حذف الحساب. سيتم تسجيل خروجك.',
    deleteFailed: 'تعذر حذف حسابك حالياً.',
    signOutAfterDeleteFailed:
      'اكتمل الحذف لكن تسجيل الخروج فشل. أغلق الصفحة وسجّل الدخول مرة أخرى للتأكد.',
  },
};

function tx(key, arg) {
  const value = T[lang]?.[key] || T.en[key] || key;
  return typeof value === 'function' ? value(arg) : value;
}

function getDeleteConfirmationToken() {
  return DELETE_CONFIRMATION_TOKENS[lang] || DELETE_CONFIRMATION_TOKENS.en;
}

function tokenMatchesConfirmation(typed) {
  const token = getDeleteConfirmationToken();
  const normalizedTyped = String(typed || '').trim();
  if (!normalizedTyped) return false;
  if (token === 'DELETE') return normalizedTyped.toUpperCase() === 'DELETE';
  return normalizedTyped === token || normalizedTyped.toUpperCase() === 'DELETE';
}

function userFacingApiError(error, fallbackKey) {
  if (error?.code === 'AUTH_REQUIRED' || error?.status === 401) return tx('authRequired');
  const code = error?.code || error?.status || null;
  return code ? `${tx(fallbackKey)} (${code})` : tx(fallbackKey);
}

function setStatus(message) {
  const node = document.getElementById('dashboard-status');
  if (node) node.textContent = message;
}

function setPrivacyStatus(message) {
  const node = document.getElementById('dashboard-privacy-status');
  if (node) node.textContent = message;
}

function setLang(nextLang) {
  lang = nextLang === 'ar' ? 'ar' : 'en';
  document.documentElement.lang = lang;
  document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
  try {
    const prefs = JSON.parse(localStorage.getItem(cacheKeyUserPrefs()) || '{}');
    prefs.lang = lang;
    localStorage.setItem(cacheKeyUserPrefs(), JSON.stringify(prefs));
  } catch {
    // no-op
  }
  applyStaticCopy();
}

function applyStaticCopy() {
  const mapping = [
    ['dashboard-privacy-title', 'privacyTitle'],
    ['dashboard-privacy-copy', 'privacyCopy'],
    ['dashboard-export-btn', 'exportBtn'],
    ['dashboard-danger-title', 'dangerTitle'],
    ['dashboard-delete-help', 'deleteHelp'],
    ['dashboard-delete-label', 'deleteLabel'],
    ['dashboard-delete-btn', 'deleteBtn'],
  ];
  mapping.forEach(([id, key]) => {
    const node = document.getElementById(id);
    if (!node) return;
    if (key === 'deleteHelp' || key === 'deleteConfirmRequired') {
      node.textContent = tx(key, getDeleteConfirmationToken());
    } else {
      node.textContent = tx(key);
    }
  });
  const confirmInput = document.getElementById('dashboard-delete-confirm');
  if (confirmInput) confirmInput.placeholder = tx('deletePlaceholder');
  const deleteToken = document.getElementById('dashboard-delete-token');
  if (deleteToken) deleteToken.textContent = getDeleteConfirmationToken();
}

function downloadJsonFile(fileName, value) {
  const blob = new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function renderList(containerId, items, onDelete) {
  const list = document.getElementById(containerId);
  if (!list) return;
  list.replaceChildren();
  if (!items.length) {
    const li = document.createElement('li');
    li.textContent = tx('empty');
    list.append(li);
    return;
  }
  items.forEach((item) => {
    const li = document.createElement('li');
    const copy = document.createElement('span');
    copy.textContent =
      item.label || item.item_label || item.shop_name || item.tool || item.item_key;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'btn btn-ghost btn-sm';
    btn.textContent = tx('delete');
    btn.addEventListener('click', () => {
      Promise.resolve(onDelete(item.id)).catch(() => {
        setStatus(tx('refreshFailed'));
      });
    });
    li.append(copy, btn);
    list.append(li);
  });
}

async function refreshDashboard() {
  const me = await getMe();
  const [calculations, watchlist, shops] = await Promise.all([
    listSavedCalculations(),
    listWatchlist(),
    listSavedShops(),
  ]);

  const preferences = document.getElementById('dashboard-preferences');
  if (preferences) {
    preferences.textContent = JSON.stringify(me.preferences || {}, null, 2);
  }

  renderList('dashboard-calculations', calculations.items || [], async (id) => {
    await deleteSavedCalculation(id);
    await refreshDashboard();
  });
  renderList('dashboard-watchlist', watchlist.items || [], async (id) => {
    await deleteWatchlistItem(id);
    await refreshDashboard();
  });
  renderList('dashboard-shops', shops.items || [], async (id) => {
    await deleteSavedShop(id);
    await refreshDashboard();
  });
  setStatus(tx('loaded'));
}

async function init() {
  setLang(lang);
  document.getElementById('dashboard-privacy-card')?.removeAttribute('hidden');
  injectSpotBar(lang, 0);
  const nav = injectNav(lang, 0);
  injectFooter(lang, 0);
  injectTicker(lang, 0);

  nav.getLangToggleButtons().forEach((btn) => {
    btn.addEventListener('click', () => {
      setLang(lang === 'en' ? 'ar' : 'en');
      updateNavLang(lang);
      updateTickerLang(lang);
      updateSpotBarLang(lang);
    });
  });

  const sb = buildSupabaseBrowserClient();
  if (!sb) {
    setStatus('Supabase client unavailable. Check configuration.');
    return;
  }

  const session = await sb.auth.getSession().catch(() => null);
  if (!session?.data?.session?.access_token) {
    setStatus(tx('authRequired'));
    window.location.href = '/account.html';
    return;
  }

  document.getElementById('dashboard-refresh-btn')?.addEventListener('click', async () => {
    try {
      await refreshDashboard();
    } catch {
      setStatus(tx('refreshFailed'));
    }
  });
  document.getElementById('dashboard-signout-btn')?.addEventListener('click', async () => {
    try {
      await sb.auth.signOut();
      window.location.href = '/account.html';
    } catch {
      setStatus(tx('signOutFailed'));
    }
  });
  document.getElementById('dashboard-import-btn')?.addEventListener('click', async () => {
    try {
      setStatus(tx('importing'));
      const result = await importLocalStorageData();
      setStatus(tx('importDone', result));
      await refreshDashboard();
    } catch {
      setStatus(tx('importFailed'));
    }
  });
  document.getElementById('dashboard-export-btn')?.addEventListener('click', async () => {
    try {
      setPrivacyStatus(tx('exportPreparing'));
      const payload = await exportMyData();
      const dateStamp = new Date().toISOString().replace(/:/g, '-').replace(/\..+$/, '');
      downloadJsonFile(`gold-ticker-live-export-${dateStamp}.json`, payload);
      setPrivacyStatus(tx('exportDone'));
    } catch (error) {
      console.error('[dashboard] export failed', error);
      setPrivacyStatus(userFacingApiError(error, 'exportFailed'));
    }
  });
  document.getElementById('dashboard-delete-btn')?.addEventListener('click', async () => {
    const confirmInput = document.getElementById('dashboard-delete-confirm');
    const typed = confirmInput?.value?.trim();
    if (!tokenMatchesConfirmation(typed)) {
      setPrivacyStatus(tx('deleteConfirmRequired', getDeleteConfirmationToken()));
      return;
    }
    try {
      setPrivacyStatus(tx('deleting'));
      const result = await deleteMyAccount(typed);
      setPrivacyStatus(result?.auth?.message || tx('deleteDone'));
      if (confirmInput) confirmInput.value = '';
      try {
        await sb.auth.signOut();
        window.location.href = '/account.html';
      } catch {
        setPrivacyStatus(tx('signOutAfterDeleteFailed'));
      }
    } catch (error) {
      console.error('[dashboard] account deletion failed', error);
      setPrivacyStatus(userFacingApiError(error, 'deleteFailed'));
    }
  });

  try {
    await refreshDashboard();
  } catch {
    setStatus(tx('loadFailed'));
  }
}

init();
