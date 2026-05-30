/**
 * Learn hub guide cards — categories, read time, difficulty.
 * User-visible titles/descriptions use translation keys where noted.
 */

export const LEARN_GUIDE_CATEGORIES = Object.freeze([
  {
    id: 'start',
    titleKey: 'learn.cat.start',
    descKey: 'learn.cat.startDesc',
    guides: [
      {
        href: 'content/guides/buying-guide.html',
        titleKey: 'learn.card.buyingTitle',
        descKey: 'learn.card.buyingDesc',
        readMin: 12,
        level: 'beginner',
      },
      {
        href: 'content/guides/24k-vs-22k-vs-18k-gold/',
        titleKey: 'learn.card.karatTitle',
        descKey: 'learn.card.karatDesc',
        readMin: 8,
        level: 'beginner',
      },
      {
        href: 'content/spot-vs-retail-gold-price/',
        titleKey: 'learn.card.spotRetailTitle',
        descKey: 'learn.card.spotRetailDesc',
        readMin: 6,
        level: 'beginner',
      },
    ],
  },
  {
    id: 'buying',
    titleKey: 'learn.cat.buying',
    descKey: 'learn.cat.buyingDesc',
    guides: [
      {
        href: 'content/guides/how-to-spot-fake-gold/',
        titleKey: 'learn.card.fakeTitle',
        descKey: 'learn.card.fakeDesc',
        readMin: 7,
        level: 'beginner',
      },
      {
        href: 'content/gold-making-charges-guide/',
        titleKey: 'learn.card.makingTitle',
        descKey: 'learn.card.makingDesc',
        readMin: 6,
        level: 'intermediate',
      },
      {
        href: 'content/guides/buying-gold-online-vs-in-store/',
        titleKey: 'learn.card.onlineTitle',
        descKey: 'learn.card.onlineDesc',
        readMin: 7,
        level: 'intermediate',
      },
    ],
  },
  {
    id: 'invest',
    titleKey: 'learn.cat.invest',
    descKey: 'learn.cat.investDesc',
    guides: [
      {
        href: 'content/guides/gold-investment-for-beginners/',
        titleKey: 'learn.card.investTitle',
        descKey: 'learn.card.investDesc',
        readMin: 10,
        level: 'beginner',
      },
      {
        href: 'content/guides/gold-bars-vs-coins/',
        titleKey: 'learn.card.barsTitle',
        descKey: 'learn.card.barsDesc',
        readMin: 6,
        level: 'intermediate',
      },
      {
        href: 'content/guides/gold-as-inflation-hedge/',
        titleKey: 'learn.card.inflationTitle',
        descKey: 'learn.card.inflationDesc',
        readMin: 8,
        level: 'intermediate',
      },
    ],
  },
  {
    id: 'gcc',
    titleKey: 'learn.cat.gcc',
    descKey: 'learn.cat.gccDesc',
    guides: [
      {
        href: 'content/guides/uae-vs-saudi-vs-kuwait-gold-prices/',
        titleKey: 'learn.card.gccCompareTitle',
        descKey: 'learn.card.gccCompareDesc',
        readMin: 7,
        level: 'intermediate',
      },
      {
        href: 'content/guides/aed-peg-explained.html',
        titleKey: 'learn.card.pegTitle',
        descKey: 'learn.card.pegDesc',
        readMin: 5,
        level: 'beginner',
      },
      {
        href: 'content/guides/gcc-market-hours.html',
        titleKey: 'learn.card.hoursTitle',
        descKey: 'learn.card.hoursDesc',
        readMin: 5,
        level: 'beginner',
      },
    ],
  },
]);

export const LEARN_PROGRESS_KEY = 'gtl_learn_guides_read';

export function getLearnProgress() {
  try {
    const raw = localStorage.getItem(LEARN_PROGRESS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function markGuideRead(href) {
  const list = getLearnProgress();
  if (!list.includes(href)) {
    list.push(href);
    localStorage.setItem(LEARN_PROGRESS_KEY, JSON.stringify(list.slice(-50)));
  }
}

export function countTotalGuides() {
  return LEARN_GUIDE_CATEGORIES.reduce((n, c) => n + c.guides.length, 0);
}
