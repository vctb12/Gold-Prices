export const REALTIME_POLLING_DEFAULTS = {
  activePollMs: 5000,
  hiddenPollMs: 20000,
  fetchTimeoutMs: 5000,
  jitterMs: 250,
  backoffMs: [5000, 10000, 20000, 40000, 60000],
};
