import { NEWSLETTER_API_ENDPOINT, FORMSPREE_ENDPOINT } from '../config/index.js';
import { NAV_DATA } from './nav-data.js';
import { escapeHtml, resolveHref } from './nav/helpers.js';
import { track, EVENTS } from '../lib/analytics.js';

// Keep the shared footer useful without turning mobile layouts into a full mega-menu repeat.
const MAX_FOOTER_LINKS_PER_SECTION = 3;

/**
 * Shared footer component — 5-column dark premium.
 * Call injectFooter(lang, depth) from any page entry point.
 */

export function injectFooter(lang = 'en', depth = 0) {
  const isAr = lang === 'ar';
  const navData = NAV_DATA[lang] || NAV_DATA.en;

  function r(href) {
    return resolveHref(href, depth);
  }

  const year = new Date().getFullYear();
  const footerColumnsHtml = navData.groups
    .map((group) => {
      const sectionLinks = group.sections
        .map((section) => {
          const links = section.items
            .slice(0, MAX_FOOTER_LINKS_PER_SECTION)
            .map((item) => `<a href="${r(item.href)}">${escapeHtml(item.label)}</a>`)
            .join('');
          return `<div class="footer-link-section">
            <h5 class="footer-section-heading">${escapeHtml(section.label)}</h5>
            ${links}
          </div>`;
        })
        .join('');

      return `<div class="footer-col footer-col--links">
        <h4 class="footer-col-heading">${escapeHtml(group.label)}</h4>
        <p class="footer-col-note">${escapeHtml(group.description)}</p>
        ${sectionLinks}
      </div>`;
    })
    .join('');

  const html = `
<footer class="site-footer-global">
  <div class="footer-top">
    <div class="footer-inner">

      <!-- Brand column -->
      <div class="footer-col footer-col--brand">
        <a href="${r('../index.html')}" class="footer-brand-link" aria-label="${isAr ? 'العودة إلى الصفحة الرئيسية في Gold Ticker Live' : 'Go to the Gold Ticker Live homepage'}">
          <span class="footer-brand-icon" aria-hidden="true">◈</span>
          <span class="footer-brand-name">${isAr ? 'Gold Ticker Live' : 'Gold Ticker Live'}</span>
        </a>
        <p class="footer-tagline">${
          isAr
            ? 'أسعار ذهب مرجعية مرتبطة بالسعر الفوري للإمارات والخليج والأسواق العربية'
            : 'Spot-linked gold reference prices for the UAE, GCC, and Arab markets'
        }</p>
        <div class="footer-brand-badges">
          <span class="footer-badge">${isAr ? '24+ دولة' : '24+ Countries'}</span>
          <span class="footer-badge">${isAr ? '7 عيارات' : '7 Karats'}</span>
          <span class="footer-badge">${isAr ? 'ثنائي اللغة' : 'EN / AR'}</span>
        </div>
      </div>

      ${footerColumnsHtml}

    </div>
  </div>

  ${
    // Show newsletter form: use internal API endpoint, or fall back to Formspree if configured.
    // Always show the form (endpoint is always available via internal API).
    true
      ? `
  <div class="footer-newsletter">
    <div class="footer-inner">
      <div class="footer-newsletter-inner">
        <div class="footer-newsletter-text">
          <strong>${isAr ? '📬 النشرة الإخبارية' : '📬 Gold Price Updates'}</strong>
          <span>${isAr ? 'احصل على تحديثات أسعار الذهب الأسبوعية في صندوق بريدك' : 'Get weekly gold price updates delivered to your inbox'}</span>
        </div>
        <form class="footer-newsletter-form" id="footer-newsletter-form" novalidate aria-label="${isAr ? 'اشتراك النشرة الإخبارية' : 'Newsletter signup'}" data-endpoint="${NEWSLETTER_API_ENDPOINT}" data-formspree="${FORMSPREE_ENDPOINT}">
          <input type="email" name="email" id="footer-newsletter-email"
            placeholder="${isAr ? 'بريدك الإلكتروني' : 'Your email address'}"
            required
            aria-label="${isAr ? 'البريد الإلكتروني' : 'Email address'}"
            autocomplete="email"
            inputmode="email"
            aria-describedby="footer-newsletter-msg"
          />
          <!-- Honeypot field — hidden from humans, bots fill it in -->
          <input type="text" name="website" tabindex="-1" autocomplete="off" aria-hidden="true" style="position:absolute;left:-9999px;width:1px;height:1px;overflow:hidden" />
          <button type="submit" class="btn btn-primary" id="footer-newsletter-btn">${isAr ? 'اشتراك' : 'Subscribe'}</button>
        </form>
        <p class="footer-newsletter-msg" id="footer-newsletter-msg" role="status" aria-live="polite" aria-atomic="true" hidden></p>
      </div>
    </div>
  </div>
  `
      : ''
  }

  <div class="footer-bottom">
    <div class="footer-inner">
      <div class="footer-sources">
        <span>${isAr ? 'بيانات الأسعار من' : 'Price data by'} <a href="https://goldpricez.com" target="_blank" rel="noopener">GoldPriceZ.com</a></span>
        <span class="footer-sep" aria-hidden="true">·</span>
        <span>${isAr ? 'أسعار الصرف:' : 'FX data:'} <a href="https://open.er-api.com" target="_blank" rel="noopener">open.er-api.com</a></span>
        <span class="footer-sep" aria-hidden="true">·</span>
        <span>${isAr ? 'الدرهم الإماراتي:' : 'AED peg:'} <a href="${r('../methodology.html')}">${isAr ? '3.6725 ثابت' : '3.6725 fixed'}</a></span>
        <span class="footer-sep" aria-hidden="true">·</span>
        <span>${isAr ? 'الأونصة التروية:' : 'Troy oz:'} 31.1035 g</span>
        <span class="footer-sep" aria-hidden="true">·</span>
        <span class="footer-freshness"></span>
        <span class="footer-data-updated"></span>
      </div>
      <div class="footer-bottom-row">
        <p class="footer-disclaimer">${
          isAr
            ? 'قيم تقديرية مكافئة للسبيكة فقط. قد تختلف أسعار التجزئة والمجوهرات. ليست نصيحة مالية.'
            : 'Spot-linked reference estimates only. Retail and jewellery prices may include making charges, premiums, and tax. Not financial advice.'
        }</p>
        <p class="footer-copy">© ${year} Gold Ticker Live · <a href="${r('../terms.html')}">${isAr ? 'شروط الخدمة' : 'Terms'}</a> · <a href="${r('../privacy.html')}">${isAr ? 'الخصوصية' : 'Privacy'}</a> · <a href="${r('../methodology.html')}">${isAr ? 'المنهجية' : 'Methodology'}</a> · <span class="footer-copy-trigger" id="footer-admin-trigger" aria-hidden="true" style="cursor:default;user-select:none">⚡</span></p>
      </div>
    </div>
  </div>
</footer>`;

  const wrapper = document.createElement('div');
  wrapper.innerHTML = html;
  const footerEl = wrapper.firstElementChild;
  document.body.appendChild(footerEl);

  // Populate gold-data freshness timestamp from localStorage
  try {
    const ts = localStorage.getItem('goldprices_gold_ts');
    const freshnessEl = footerEl.querySelector('.footer-freshness');
    if (freshnessEl && ts) {
      const d = new Date(Number(ts));
      if (!isNaN(d.getTime())) {
        const isAr2 =
          document.documentElement.lang === 'ar' || document.documentElement.dir === 'rtl';
        freshnessEl.textContent =
          (isAr2 ? 'آخر تحديث الذهب: ' : 'Gold updated: ') +
          d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      }
    }
  } catch (_) {}

  // Newsletter form: async submission with full state management
  const newsletterForm = footerEl.querySelector('#footer-newsletter-form');
  if (newsletterForm) {
    newsletterForm.addEventListener('submit', (e) => {
      track(EVENTS.NEWSLETTER_SUBSCRIBE, { source: 'footer', cadence: 'weekly' });
      _handleNewsletterSubmit(e, newsletterForm, isAr);
    });
  }

  // Populate "Data last updated" from goldUpdatedAt key
  try {
    const updatedAt = localStorage.getItem('goldUpdatedAt');
    const dataUpdatedEl = footerEl.querySelector('.footer-data-updated');
    if (dataUpdatedEl && updatedAt) {
      const d = new Date(updatedAt);
      if (!isNaN(d.getTime())) {
        const isAr2 =
          document.documentElement.lang === 'ar' || document.documentElement.dir === 'rtl';
        dataUpdatedEl.textContent =
          (isAr2 ? '· آخر مزامنة للبيانات: ' : '· Data sync: ') +
          d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      }
    }
  } catch (_) {}

  // ── Admin Access Methods (Easter Eggs) ──────────────────────────────────────
  // Method 3: Triple-click on ⚡ symbol in footer
  // Method 4: Keyboard shortcut Ctrl+Shift+A
  // Method 5: Konami code ↑↑↓↓←→←→BA
  _initAdminAccessMethods(depth);
}

/**
 * Handle async newsletter form submission with full state management.
 * States: loading → success | duplicate | invalid | error
 * @param {Event} e
 * @param {HTMLFormElement} form
 * @param {boolean} isAr
 */
async function _handleNewsletterSubmit(e, form, isAr) {
  e.preventDefault();

  const emailInput = form.querySelector('#footer-newsletter-email');
  const btn = form.querySelector('#footer-newsletter-btn');
  const msg =
    form.querySelector('#footer-newsletter-msg') ||
    document.getElementById('footer-newsletter-msg');

  const email = emailInput ? emailInput.value.trim() : '';

  // Basic client-side validation
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
    _showNewsletterMsg(
      msg,
      isAr ? '⚠ يرجى إدخال بريد إلكتروني صحيح.' : '⚠ Please enter a valid email address.',
      'error'
    );
    if (emailInput) emailInput.focus();
    return;
  }

  // Loading state
  if (btn) {
    btn.disabled = true;
    btn.textContent = isAr ? 'جارٍ الاشتراك…' : 'Subscribing…';
  }
  _showNewsletterMsg(msg, '', null);

  const endpoint = form.dataset.endpoint || '/api/v1/newsletter/subscribe';
  const formspree = form.dataset.formspree || '';

  try {
    let ok = false;
    let responseData = {};

    if (formspree) {
      // Formspree legacy path
      const res = await fetch(formspree, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ email }),
      });
      ok = res.ok;
    } else {
      const locale = document.documentElement.lang === 'ar' ? 'ar' : 'en';
      const pagePath = window.location.pathname;
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, source: 'footer', locale, page_path: pagePath }),
      });
      try {
        responseData = await res.json();
      } catch (_) {}
      ok = res.ok || res.status === 200 || res.status === 201;
    }

    if (ok) {
      // Hide the form, show success using textContent (not innerHTML)
      const formRow = form.parentElement;
      if (formRow) {
        const successMsg = document.createElement('p');
        successMsg.className = 'footer-newsletter-success';
        successMsg.setAttribute('role', 'status');
        successMsg.textContent = isAr
          ? '✅ تحقق من صندوق الوارد لتأكيد اشتراكك.'
          : '✅ Check your inbox to confirm your subscription.';
        formRow.replaceChildren(successMsg);
      }
    } else {
      // Determine error type from response
      const serverMsg = responseData.message || '';
      if (serverMsg.toLowerCase().includes('already')) {
        _showNewsletterMsg(
          msg,
          isAr ? 'ℹ هذا البريد مشترك بالفعل.' : 'ℹ This email is already subscribed.',
          'info'
        );
      } else {
        _showNewsletterMsg(
          msg,
          isAr ? '⚠ حدث خطأ. يرجى المحاولة مجدداً.' : '⚠ Something went wrong. Please try again.',
          'error'
        );
      }
      if (btn) {
        btn.disabled = false;
        btn.textContent = isAr ? 'اشتراك' : 'Subscribe';
      }
    }
  } catch (_err) {
    _showNewsletterMsg(
      msg,
      isAr
        ? '⚠ تعذر الاتصال. يرجى المحاولة لاحقاً.'
        : '⚠ Could not connect. Please try again later.',
      'error'
    );
    if (btn) {
      btn.disabled = false;
      btn.textContent = isAr ? 'اشتراك' : 'Subscribe';
    }
  }
}

function _showNewsletterMsg(el, text, type) {
  if (!el) return;
  el.textContent = text;
  el.removeAttribute('hidden');
  el.className = `footer-newsletter-msg footer-newsletter-msg--${type || 'info'}`;
  if (!text) el.setAttribute('hidden', '');
}

/**
 * Computes the admin URL relative to the current page depth.
 * @param {number} depth
 * @returns {string}
 */
function _getAdminUrl(depth) {
  if (depth === 0) return 'admin/login/';
  return '../'.repeat(depth) + 'admin/login/';
}

/**
 * Show admin quick-access popup then redirect.
 * @param {string} adminUrl
 */
function _showAdminPopup(adminUrl) {
  // Don't show if already on an admin page
  if (window.location.pathname.includes('/admin/')) return;

  let popup = document.getElementById('gp-admin-secret-popup');
  if (popup) {
    popup.remove();
  }

  popup = document.createElement('div');
  popup.id = 'gp-admin-secret-popup';
  popup.setAttribute('role', 'dialog');
  popup.setAttribute('aria-label', 'Admin panel access');
  popup.style.cssText = [
    'position:fixed',
    'bottom:80px',
    'right:20px',
    'z-index:99999',
    'background:linear-gradient(135deg,#0a1628,#0d1526)',
    'border:1px solid rgba(245,158,11,0.55)',
    'border-radius:16px',
    'box-shadow:0 12px 48px rgba(0,0,0,0.7),0 0 30px rgba(245,158,11,0.12)',
    'padding:20px 24px',
    'max-width:280px',
    'animation:gp-admin-pop 0.3s cubic-bezier(0.34,1.56,0.64,1) both',
    'font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif',
  ].join(';');

  popup.innerHTML = `
    <style>
      @keyframes gp-admin-pop {
        from { opacity:0; transform:scale(0.82) translateY(14px); }
        to   { opacity:1; transform:scale(1) translateY(0); }
      }
    </style>
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px">
      <span style="font-size:22px;line-height:1">⚙️</span>
      <strong style="color:#f1f5f9;font-size:0.9375rem;letter-spacing:-0.01em">GoldAdmin</strong>
      <button id="gp-admin-popup-close" style="margin-left:auto;background:none;border:none;color:#64748b;cursor:pointer;font-size:18px;line-height:1;padding:0" aria-label="Close">✕</button>
    </div>
    <p style="color:#8ba3c7;font-size:0.8125rem;line-height:1.5;margin-bottom:14px">
      Admin panel access detected. Click below to sign in.
    </p>
    <a href="${adminUrl}" style="display:flex;align-items:center;gap:8px;background:linear-gradient(135deg,#f59e0b,#d97706);color:#0f172a;font-weight:700;font-size:0.875rem;border-radius:8px;padding:10px 16px;text-decoration:none;justify-content:center;box-shadow:0 2px 12px rgba(245,158,11,0.3)">
      <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
      Open Admin Panel
    </a>`;

  document.body.appendChild(popup);

  const closeBtn = document.getElementById('gp-admin-popup-close');
  if (closeBtn) {
    closeBtn.addEventListener('click', () => popup.remove());
  }

  // Auto-close after 8 seconds
  setTimeout(() => {
    if (popup.parentNode) popup.remove();
  }, 8000);

  // Close on click outside
  setTimeout(() => {
    document.addEventListener('click', function onDocClick(e) {
      if (!popup.contains(e.target)) {
        popup.remove();
        document.removeEventListener('click', onDocClick);
      }
    });
  }, 300);
}

function _initAdminAccessMethods(depth) {
  const adminUrl = _getAdminUrl(depth);

  // Method 3: Triple-click on ⚡ footer trigger
  const trigger = document.getElementById('footer-admin-trigger');
  if (trigger) {
    let clicks = 0;
    let clickTimer;
    trigger.addEventListener('click', () => {
      clicks++;
      clearTimeout(clickTimer);
      if (clicks >= 3) {
        clicks = 0;
        _showAdminPopup(adminUrl);
      } else {
        clickTimer = setTimeout(() => {
          clicks = 0;
        }, 600);
      }
    });
  }

  // Method 4: Keyboard shortcut Ctrl+Shift+A
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'A') {
      e.preventDefault();
      _showAdminPopup(adminUrl);
    }
  });

  // Method 5: Konami code ↑↑↓↓←→←→BA
  const KONAMI = [
    'ArrowUp',
    'ArrowUp',
    'ArrowDown',
    'ArrowDown',
    'ArrowLeft',
    'ArrowRight',
    'ArrowLeft',
    'ArrowRight',
    'b',
    'a',
  ];
  let konamiIdx = 0;
  document.addEventListener('keydown', (e) => {
    if (e.key === KONAMI[konamiIdx]) {
      konamiIdx++;
      if (konamiIdx === KONAMI.length) {
        konamiIdx = 0;
        _showAdminPopup(adminUrl);
      }
    } else {
      konamiIdx = e.key === KONAMI[0] ? 1 : 0;
    }
  });
}
