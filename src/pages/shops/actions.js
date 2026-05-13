/**
 * shops/share.js - Extract sharing and shortlist logic from shops.js
 * Separates action handlers from main module
 */

export function toggleShortlist(shopId, STATE, saveShortlistToStorage) {
  const idx = STATE.shortlist.indexOf(shopId);
  if (idx === -1) {
    STATE.shortlist.push(shopId);
  } else {
    STATE.shortlist.splice(idx, 1);
  }
  saveShortlistToStorage(STATE.shortlist);
}

export function isInShortlist(shopId, STATE) {
  return STATE.shortlist.includes(shopId);
}

export function shareShop(shop) {
  const url = `${location.origin}${location.pathname}?shop=${shop.id}`;
  const text = `${shop.name} — ${shop.market}, ${shop.city}`;

  if (navigator.share) {
    navigator.share({ title: shop.name, text, url }).catch(() => {});
  } else {
    navigator.clipboard
      ?.writeText(url)
      .then(() => {
        alert(STATE.lang === 'ar' ? 'تم نسخ الرابط' : 'Link copied to clipboard');
      })
      .catch(() => {});
  }
}

export function syncUrlToState(STATE) {
  const p = new URLSearchParams(location.search);

  if (STATE.region !== 'all') p.set('region', STATE.region);
  else p.delete('region');

  if (STATE.country !== 'all') p.set('country', STATE.country);
  else p.delete('country');

  if (STATE.city !== 'all') p.set('city', STATE.city);
  else p.delete('city');

  if (STATE.specialty !== 'all') p.set('specialty', STATE.specialty);
  else p.delete('specialty');

  if (STATE.verifiedOnly) p.set('verified', '1');
  else p.delete('verified');

  if (STATE.lang === 'ar') p.set('lang', 'ar');
  else p.delete('lang');

  const q = STATE.search.trim();
  if (q) {
    p.set('search', q);
    p.delete('q');
  } else {
    p.delete('search');
    p.delete('q');
  }

  const qs = p.toString();
  history.replaceState(null, '', qs ? `${location.pathname}?${qs}` : location.pathname);
}
