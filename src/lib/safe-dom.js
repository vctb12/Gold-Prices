/**
 * Shared safe-DOM utilities.
 *
 * Every client-side page that renders dynamic content (search results,
 * shop cards, calculator breakdowns, etc.) should use these helpers instead of
 * rolling its own escaping. Concentrating the policy here means:
 *   1. A single, auditable definition of "safe" for the project.
 *   2. Static analysis (CodeQL, the CI grep guard in `scripts/node/check-unsafe-dom.js`)
 *      can allowlist this file and flag any new raw `innerHTML` sinks elsewhere.
 *   3. If we ever need to swap in a more formal sanitizer (e.g. DOMPurify with a
 *      pinned config), there is one place to do it.
 *
 * Rules of thumb:
 *   - Prefer `setText(el, value)` over `el.textContent = value` for nullish safety.
 *   - Prefer `el(tag, attrs, children)` over template-string `innerHTML` when the
 *     content mixes untrusted strings with attributes.
 *   - Only call `setTrustedHTML` with strings you constructed yourself from
 *     escaped fragments — never with raw user input.
 */

/** HTML-escape a value for safe insertion inside element text or attribute
 *  values. Returns an empty string for `null`/`undefined`. */
export function escape(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Return the URL only if it is safe to use as an `<a href>` value in a
 *  browser context. Allows http(s), `mailto:`, `tel:`, root-relative,
 *  relative (`./` / `../`), and fragment-only URLs. Explicitly rejects `javascript:`, `data:`,
 *  `vbscript:`, `file:`, and any other non-allowlisted scheme.
 *
 *  ⚠️ This is for *navigation URLs in the browser only*. It is NOT a
 *  filesystem-path sanitizer — do not pass its output to `fs.*` calls or
 *  to server-side path resolution. */
export function safeHref(url) {
  if (!url || typeof url !== 'string') return '';
  const trimmed = url.trim();
  // Explicitly reject javascript:, data:, vbscript:, file:, etc. — allowlist only.
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (/^mailto:/i.test(trimmed)) return trimmed;
  if (/^tel:/i.test(trimmed)) {
    const sanitizedPhone = safeTel(trimmed.slice(4));
    return sanitizedPhone ? `tel:${sanitizedPhone}` : '';
  }
  // Also allow protocol-relative and root-relative internal links.
  if (trimmed.startsWith('/') || trimmed.startsWith('./') || trimmed.startsWith('../'))
    return trimmed;
  if (trimmed.startsWith('#')) return trimmed;
  return '';
}

/** Return a tel:-safe phone string (digits, +, -, spaces, parens only). */
export function safeTel(phone) {
  if (!phone || typeof phone !== 'string') return '';
  return phone.replace(/[^\d+\-() ]/g, '').replace(/\s+/g, '');
}

/** Null-safe textContent setter. */
export function setText(node, value) {
  if (node) node.textContent = String(value ?? '');
}

/** Remove every child from `node`. Faster and safer than `node.innerHTML = ''`
 *  because it does not invoke the HTML parser. */
export function clear(node) {
  if (!node) return;
  while (node.firstChild) node.removeChild(node.firstChild);
}

// Symbol branding travels with the DOM node itself and avoids external mutable
// registries; this keeps trust metadata local to the value being appended.
const SAFE_DOM_NODE_BRAND = Symbol('safeDomTrustedNode');
const ALLOWED_NODE_TYPES = new Set([1, 3, 11]); // Element, Text, DocumentFragment
const BLOCKED_ATTR_NAMES = new Set(['srcdoc']);
const URL_ATTR_NAMES = new Set(['href', 'src', 'action', 'formaction', 'poster', 'xlink:href']);

function markTrustedNode(node) {
  if (!node || typeof node !== 'object') return node;
  try {
    Object.defineProperty(node, SAFE_DOM_NODE_BRAND, {
      value: true,
      enumerable: false,
      configurable: true,
    });
  } catch {
    // Non-extensible DOM node; safe to continue without branding.
  }
  return node;
}

function isNodeLike(value) {
  return Boolean(value && typeof value === 'object' && typeof value.nodeType === 'number');
}

function isTrustedNode(node, ownerDocument) {
  if (!isNodeLike(node)) return false;
  if (!ALLOWED_NODE_TYPES.has(node.nodeType)) return false;
  // Cross-document nodes can come from unknown contexts (iframes/parsers); keep
  // trust boundary local to this document to avoid implicit HTML reinterpretation.
  if (ownerDocument && node.ownerDocument && node.ownerDocument !== ownerDocument) return false;
  if (node.nodeType === 3) return true; // Text nodes are safe by construction.
  return node[SAFE_DOM_NODE_BRAND] === true;
}

function appendText(parent, value) {
  if (!parent) return;
  parent.append(String(value ?? ''));
}

function appendTrustedNode(parent, node) {
  if (!parent) return;
  if (isTrustedNode(node, parent?.ownerDocument)) {
    parent.append(node);
    return;
  }
  appendText(parent, node?.textContent ?? '');
}

function appendSafeChildren(parent, children) {
  if (children === null || children === undefined || children === false) return;
  if (Array.isArray(children)) {
    for (const child of children) appendSafeChildren(parent, child);
    return;
  }
  if (isNodeLike(children)) {
    appendTrustedNode(parent, children);
    return;
  }
  appendText(parent, children);
}

/**
 * Create an element with attributes and children.
 *
 *   el('a', { href: safeHref(url), class: 'btn' }, ['Go'])
 *
 * Attribute values are set with `setAttribute`, which treats them as strings
 * and does not invoke the HTML parser. Children may be nodes or strings; strings
 * become text nodes (never parsed as HTML).
 */
export function el(tag, attrs, children) {
  const node = markTrustedNode(document.createElement(tag));
  if (attrs) {
    for (const [key, value] of Object.entries(attrs)) {
      if (value === null || value === undefined || value === false) continue;
      const keyLower = key.toLowerCase();
      if (BLOCKED_ATTR_NAMES.has(keyLower)) continue;
      if (key === 'class') node.className = String(value);
      else if (key === 'dataset' && typeof value === 'object') {
        for (const [dk, dv] of Object.entries(value)) node.dataset[dk] = String(dv);
      } else if (key === 'style' && typeof value === 'object') {
        for (const [sk, sv] of Object.entries(value)) {
          if (sv === null || sv === undefined) continue;
          if (sk.startsWith('--')) node.style.setProperty(sk, String(sv));
          else node.style[sk] = String(sv);
        }
      } else if (keyLower.startsWith('on')) {
        if (typeof value === 'function') {
          node.addEventListener(keyLower.slice(2), value);
        }
      } else if (URL_ATTR_NAMES.has(keyLower)) {
        const safeValue = safeHref(String(value));
        if (safeValue) node.setAttribute(key, safeValue);
      } else if (value === true) {
        node.setAttribute(key, '');
      } else {
        node.setAttribute(key, String(value));
      }
    }
  }
  appendSafeChildren(node, children);
  return node;
}

/**
 * NOTE: this module intentionally does not export a `setTrustedHTML`
 * helper. Scattering trusted-HTML sinks tends to metastasize — every
 * caller becomes a new thing to audit. If a genuine bulk-HTML use case
 * emerges, prefer building a `DocumentFragment` via `el()` instead.
 */
