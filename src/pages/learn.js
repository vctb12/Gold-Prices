/**
 * Learn page entry point.
 * Handles nav injection, language toggle, and bilingual content switching.
 */

import * as cache from '../lib/cache.js';
import { mountSharedShell } from '../components/site-shell.js';
import { injectBreadcrumbs } from '../components/breadcrumbs.js';
import {
  applyLearnContent,
  normalizeLearnLang,
  syncLearnDocumentLang,
} from './learn-hub/renderer.js';

const STATE = {
  lang: 'en',
};

async function init() {
  cache.loadState(STATE);

  const urlLang = new URLSearchParams(location.search).get('lang');
  STATE.lang = normalizeLearnLang(urlLang || STATE.lang);

  syncLearnDocumentLang(STATE.lang);

  const shell = mountSharedShell({ lang: STATE.lang, depth: 0 });
  const navResult = shell.navCtrl;
  injectBreadcrumbs('learn');

  navResult.getLangToggleButtons().forEach((btn) => {
    btn.addEventListener('click', () => {
      STATE.lang = STATE.lang === 'en' ? 'ar' : 'en';
      cache.savePreference('lang', STATE.lang);
      shell.updateLang(STATE.lang);
      applyLearnContent(STATE.lang);
    });
  });

  applyLearnContent(STATE.lang);

  // TOC scroll-spy
  const sections = document.querySelectorAll('.learn-section[id]');
  const tocLinks = document.querySelectorAll('.learn-toc-list a[href^="#"]');
  if (sections.length && tocLinks.length) {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const id = entry.target.id;
          const link = document.querySelector(`.learn-toc-list a[href="#${id}"]`);
          if (link) link.classList.toggle('is-active', entry.isIntersecting);
        });
      },
      { rootMargin: '-20% 0px -70% 0px', threshold: 0 }
    );
    sections.forEach((s) => observer.observe(s));
  }
}

init();
