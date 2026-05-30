/**
 * Methodology page entry point.
 * Injects shared nav/footer and wires language toggle.
 */

import { mountSharedShell } from '../components/site-shell.js';
import { injectBreadcrumbs } from '../components/breadcrumbs.js';
import { initMethodologyLive } from './methodology-live.js';
import { initPageEnter } from '../lib/page-enter.js';
import { mountRelatedGuides } from '../components/RelatedGuides.js';

const STATE = { lang: 'en' };

const T = {
  en: {
    'method-hero-tag': 'Transparency & Trust',
    'method-h1': 'Data Sources & Methodology',
    'method-sub':
      'How we calculate every price you see — step by step, with full source attribution.',
    'overview-p3':
      'Historical views can mix live snapshots, browser cache checkpoints, and longer daily or monthly reference history. The tracker labels that resolution so monthly baselines are never presented as exact intraday history.',
    'fx-rates-update-p2':
      'Gold spot freshness and FX freshness do not always update at the same speed, so the tracker and exports label each layer separately.',
    'fallback-export-p':
      'CSV and JSON exports include generated timestamps, source notes, data-resolution context, and a reminder that values are reference prices rather than shop quotes.',
    'method-toc-label': 'Sections',
    'toc-overview': 'Overview',
    'toc-gold-data': 'Gold Price Data',
    'toc-fx-rates': 'FX Rates',
    'toc-aed-peg': 'AED Peg',
    'toc-karat': 'Karat Conversion',
    'toc-not-included': "What We Don't Include",
    'toc-fallback': 'Fallback & Reliability',
    'toc-disclaimer': 'Disclaimer',
  },
  ar: {
    'method-hero-tag': 'الشفافية والثقة',
    'method-h1': 'مصادر البيانات والمنهجية',
    'method-sub': 'كيف نحسب كل سعر تراه — خطوة بخطوة، مع الإسناد الكامل للمصادر.',
    'overview-p3':
      'قد تمزج العروض التاريخية بين اللقطات المباشرة ونقاط التخزين في المتصفح والسجل المرجعي اليومي أو الشهري للنطاقات الأطول. يوضّح المتتبع هذه الدقة حتى لا يظهر الخط الأساسي الشهري وكأنه سجل لحظي دقيق.',
    'fx-rates-update-p2':
      'لا تتحرك حداثة سعر الذهب وحداثة الصرف بالسرعة نفسها دائماً، لذلك يضع المتتبع وملفات التصدير وسمًا مستقلاً لكل طبقة.',
    'fallback-export-p':
      'تتبع ملفات CSV وJSON هذا الوضوح نفسه، إذ تتضمن وقت الإنشاء وملاحظات المصدر وسياق دقة البيانات وتذكيراً بأن القيم مرجعية وليست أسعار محلات.',
    'method-toc-label': 'الأقسام',
    'toc-overview': 'نظرة عامة',
    'toc-gold-data': 'بيانات سعر الذهب',
    'toc-fx-rates': 'أسعار الصرف',
    'toc-aed-peg': 'ربط الدرهم',
    'toc-karat': 'تحويل العيار',
    'toc-not-included': 'ما لا تشمله الأسعار',
    'toc-fallback': 'النسخ الاحتياطي والموثوقية',
    'toc-disclaimer': 'إخلاء المسؤولية',
  },
};

function t(key) {
  return T[STATE.lang]?.[key] ?? T.en[key] ?? key;
}

function applyLanguage() {
  document.documentElement.lang = STATE.lang;
  document.documentElement.dir = STATE.lang === 'ar' ? 'rtl' : 'ltr';
  Object.keys(T.en).forEach((key) => {
    const el = document.getElementById(key);
    if (el) el.textContent = t(key);
  });
}

function init() {
  // Load saved language preference
  const saved = localStorage.getItem('gp_pref_lang');
  if (saved === 'ar' || saved === 'en') STATE.lang = saved;

  const shell = mountSharedShell({ lang: STATE.lang, depth: 0 });
  const navCtrl = shell.navCtrl;
  injectBreadcrumbs('methodology');
  navCtrl.getLangToggleButtons().forEach((btn) => {
    btn.addEventListener('click', () => {
      STATE.lang = STATE.lang === 'en' ? 'ar' : 'en';
      localStorage.setItem('gp_pref_lang', STATE.lang);
      shell.updateLang(STATE.lang);
      applyLanguage();
      initMethodologyLive(STATE.lang);
    });
  });

  applyLanguage();
  initPageEnter('#main-content');
  mountRelatedGuides({ lang: STATE.lang });
  initMethodologyLive(STATE.lang);
}

document.addEventListener('DOMContentLoaded', init);
