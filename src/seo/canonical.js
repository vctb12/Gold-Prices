export const CANONICAL_BASE = 'https://goldtickerlive.com';

export function normalizePathname(pathname = '/') {
  let normalized = pathname || '/';
  if (!normalized.startsWith('/')) normalized = `/${normalized}`;
  if (normalized === '/Gold-Prices' || normalized.startsWith('/Gold-Prices/')) {
    normalized = normalized.replace(/^\/Gold-Prices/, '') || '/';
  }
  return normalized;
}

export function buildCanonicalUrl(pathname = '/') {
  const normalized = normalizePathname(pathname);
  return new URL(normalized, `${CANONICAL_BASE}/`).toString();
}

export function enforceCanonicalOnDocument(doc = document, pathname = window.location.pathname) {
  const canonicalUrl = buildCanonicalUrl(pathname);
  let tag = doc.querySelector('link[rel="canonical"]');
  if (!tag) {
    tag = doc.createElement('link');
    tag.setAttribute('rel', 'canonical');
    doc.head.appendChild(tag);
  }
  tag.setAttribute('href', canonicalUrl);
  return canonicalUrl;
}
