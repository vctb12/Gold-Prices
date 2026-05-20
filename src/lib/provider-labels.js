const PROVIDER_NAME_MAP = {
  'primary-provider': 'PrimaryProvider',
  'secondary-provider-cache': 'SecondaryProvider',
  goldpricez: 'GoldPriceZ',
  'cache-fallback': 'SecondaryProvider',
  cache: 'SecondaryProvider',
};

export function formatProviderLabel(providerId) {
  if (!providerId) return 'UnknownProvider';
  return PROVIDER_NAME_MAP[providerId] || String(providerId);
}
