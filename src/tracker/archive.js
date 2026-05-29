import { getBaselineRange } from '../lib/historical-data.js';
import { clear, el } from '../lib/safe-dom.js';
import { tx, _el, _priceFor, _state } from './_ctx.js';

const ARCHIVE_PAGE_SIZE = 50;
let _archivePage = 0;

export function renderArchive(resetPage = false) {
  if (!_el.archiveBody) return;
  if (resetPage) _archivePage = 0;

  const archiveSourceNote = document.getElementById('tp-archive-source-note');
  if (archiveSourceNote) {
    const { last: lastMonth, first: firstMonth } = getBaselineRange();
    const noteText = tx('archive.sourceNote', {
      lastMonth: lastMonth || '—',
      firstMonth: firstMonth || '2019',
    });
    const link = el(
      'a',
      { href: 'methodology.html', class: 'tracker-inline-link' },
      tx('archive.sourceNoteLink')
    );
    archiveSourceNote.replaceChildren(noteText, ' ', link);
  }

  let rows = _state.history.slice().reverse();

  const range = _el.archiveRange?.value || 'ALL';
  if (range !== 'ALL') {
    const daysBack = { '30D': 30, '90D': 90, '1Y': 365, '3Y': 1095, '5Y': 1825 }[range] || 0;
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - daysBack);
    rows = rows.filter((r) => {
      const d = r.date instanceof Date ? r.date : new Date(r.date);
      return d >= cutoff;
    });
  }

  const query = _el.archiveSearch?.value?.toLowerCase() || '';
  if (query) {
    rows = rows.filter((r) => {
      const dateStr = r.date instanceof Date ? r.date.toISOString() : String(r.date);
      return dateStr.includes(query) || r.source.toLowerCase().includes(query);
    });
  }

  const totalFiltered = rows.length;
  const totalPages = Math.max(1, Math.ceil(totalFiltered / ARCHIVE_PAGE_SIZE));
  _archivePage = Math.min(_archivePage, totalPages - 1);
  const pageStart = _archivePage * ARCHIVE_PAGE_SIZE;
  const pageRows = rows.slice(pageStart, pageStart + ARCHIVE_PAGE_SIZE);

  clear(_el.archiveBody);

  if (!pageRows.length) {
    const { last: lastMonth } = getBaselineRange();
    const noDataMsg = tx('archive.noDataDetailed', { lastMonth: lastMonth || '—' });
    _el.archiveBody.append(el('tr', null, [el('td', { colspan: '5' }, noDataMsg)]));
    if (_el.archiveMeta) _el.archiveMeta.textContent = '';
    _renderArchivePagination(0, 1, 0);
    return;
  }

  const fragment = document.createDocumentFragment();
  for (const r of pageRows) {
    const aed24 = _priceFor({ currency: 'AED', karat: '24', unit: 'gram', spot: r.spot });
    const selected = _priceFor({
      currency: _state.selectedCurrency,
      karat: _state.selectedKarat,
      unit: _state.selectedUnit,
      spot: r.spot,
    });
    const dateStr = r.date instanceof Date ? r.date.toISOString().slice(0, 10) : String(r.date);
    const sourceLabel = r.source + (r.granularity ? ' · ' + r.granularity : '');
    fragment.append(
      el('tr', null, [
        el('td', null, dateStr),
        el('td', null, `$${r.spot.toFixed(2)}`),
        el('td', null, selected ? selected.toFixed(2) : '—'),
        el('td', null, aed24 ? aed24.toFixed(2) : '—'),
        el('td', null, [
          el(
            'span',
            { class: `tracker-source-badge tracker-source-badge--${r.source}` },
            sourceLabel
          ),
        ]),
      ])
    );
  }
  _el.archiveBody.append(fragment);

  if (_el.archiveMeta) {
    const { first: firstMonth, last: lastMonth } = getBaselineRange();
    const sourceLabel = _state.history.some(
      (r) => r.source === 'live' || r.source === 'session-cache'
    )
      ? tx('archiveSourceMixed')
      : tx('archiveSourceBaseline');
    _el.archiveMeta.textContent = tx('archiveMeta', {
      start: pageStart + 1,
      end: pageStart + pageRows.length,
      total: totalFiltered,
      source: sourceLabel,
      from: firstMonth || '2019',
      to: lastMonth || tx('present'),
    });
  }

  _renderArchivePagination(_archivePage, totalPages, totalFiltered);
  renderSeasonal();
}

function _renderArchivePagination(page, totalPages, total) {
  let paginationEl = document.getElementById('tp-archive-pagination');
  if (!paginationEl) {
    const tableFooter = _el.archiveMeta?.parentElement;
    if (!tableFooter) return;
    paginationEl = el('div', {
      id: 'tp-archive-pagination',
      class: 'tracker-pagination',
      'aria-label': 'Archive pages',
    });
    tableFooter.after(paginationEl);
  }
  clear(paginationEl);
  if (total <= ARCHIVE_PAGE_SIZE) return;

  const prevBtn = el(
    'button',
    {
      type: 'button',
      class: 'btn btn-sm btn-ghost tracker-pagination-btn',
      'aria-label': tx('pagination.prevLabel'),
      disabled: page === 0 ? true : null,
    },
    tx('pagination.prev')
  );
  prevBtn.addEventListener('click', () => {
    _archivePage--;
    renderArchive();
  });

  const pageLabel = el(
    'span',
    { class: 'tracker-pagination-label' },
    tx('pagination.page', { page: page + 1, total: totalPages })
  );

  const nextBtn = el(
    'button',
    {
      type: 'button',
      class: 'btn btn-sm btn-ghost tracker-pagination-btn',
      'aria-label': tx('pagination.nextLabel'),
      disabled: page >= totalPages - 1 ? true : null,
    },
    tx('pagination.next')
  );
  nextBtn.addEventListener('click', () => {
    _archivePage++;
    renderArchive();
  });

  paginationEl.append(prevBtn, pageLabel, nextBtn);
}

export function renderSeasonal() {
  if (!_el.seasonalResults) return;
  const history = Array.isArray(_state.history) ? _state.history : [];
  if (!history.length) {
    _el.seasonalResults.replaceChildren();
    return;
  }

  const sums = new Array(12).fill(0);
  const counts = new Array(12).fill(0);
  for (const r of history) {
    const d = r.date instanceof Date ? r.date : new Date(r.date);
    if (!Number.isFinite(d.getTime())) continue;
    const v = Number(r.spot);
    if (!Number.isFinite(v) || v <= 0) continue;
    const m = d.getMonth();
    sums[m] += v;
    counts[m] += 1;
  }

  const monthNames = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
  ];

  const monthly = [];
  for (let m = 0; m < 12; m++) {
    if (counts[m] > 0) monthly.push({ m, label: monthNames[m], avg: sums[m] / counts[m] });
  }

  if (!monthly.length) {
    _el.seasonalResults.replaceChildren();
    return;
  }

  const avgs = monthly.map((x) => x.avg);
  const minAvg = Math.min(...avgs);
  const maxAvg = Math.max(...avgs);
  const minMonth = monthly.find((x) => x.avg === minAvg);
  const maxMonth = monthly.find((x) => x.avg === maxAvg);
  const overall = avgs.reduce((a, b) => a + b, 0) / avgs.length;
  const range = maxAvg - minAvg;
  const pctSpread = (range / overall) * 100;

  const yearsSpan = (() => {
    const times = history
      .map((r) => (r.date instanceof Date ? r.date : new Date(r.date)).getTime())
      .filter(Number.isFinite);
    if (!times.length) return '';
    const years = (Math.max(...times) - Math.min(...times)) / (365.25 * 24 * 3600 * 1000);
    return years >= 1 ? ` over ${years.toFixed(1)} yrs` : '';
  })();

  function resultCard(label, value, sub) {
    return el('div', { class: 'tracker-result-card' }, [
      el('div', { class: 'tracker-result-k' }, [label]),
      el('div', { class: 'tracker-result-v' }, [value]),
      el('div', { class: 'tracker-result-s' }, [sub]),
    ]);
  }

  const frag = document.createDocumentFragment();
  frag.append(
    resultCard('Typical high month', maxMonth.label, `$${maxAvg.toFixed(0)} avg spot`),
    resultCard('Typical low month', minMonth.label, `$${minAvg.toFixed(0)} avg spot`),
    resultCard('Seasonal spread', `${pctSpread.toFixed(1)}%`, `high vs low month${yearsSpan}`)
  );
  _el.seasonalResults.replaceChildren(frag);
}
