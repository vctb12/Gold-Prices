import { el } from '../lib/safe-dom.js';

export function renderTrackerQuickPresets({ t = (key) => key } = {}) {
  const presets = [
    { href: '#mode=live&r=24H', label: t('trackerAddons.quickPresets.live24h') },
    { href: '#mode=live&r=7D', label: t('trackerAddons.quickPresets.live7d') },
    { href: '#mode=compare', label: t('trackerAddons.quickPresets.compare') },
    { href: '#mode=exports', label: t('trackerAddons.quickPresets.exports') },
  ];

  return el(
    'section',
    { class: 'tracker-addon-card', 'aria-labelledby': 'tracker-quick-presets-title' },
    [
      el('h3', { id: 'tracker-quick-presets-title' }, t('trackerAddons.quickPresets.title')),
      el('p', { class: 'tracker-addon-card__copy' }, t('trackerAddons.quickPresets.copy')),
      el(
        'div',
        { class: 'tracker-addon-chip-row' },
        presets.map((preset) => el('a', { class: 'tracker-chip', href: preset.href }, preset.label))
      ),
    ]
  );
}
