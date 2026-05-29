import { LEARN_CONTENT } from './content-model.js';

const DEFAULT_LANG = 'en';

export function normalizeLearnLang(lang) {
  return lang === 'ar' ? 'ar' : DEFAULT_LANG;
}

export function syncLearnDocumentLang(lang) {
  document.documentElement.lang = lang;
  document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
}

export function applyLearnContent(lang) {
  const resolvedLang = normalizeLearnLang(lang);
  const content = LEARN_CONTENT[resolvedLang] ?? LEARN_CONTENT[DEFAULT_LANG];

  Object.entries(content).forEach(([id, text]) => {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
  });

  syncLearnDocumentLang(resolvedLang);
  return resolvedLang;
}
