// tracker-chart-loader.js
// Lazy-installs the GoldChart component when the chart area becomes visible.
// Keeps a lightweight intersection observer and defers loading the heavy chart
// library and component until the user can see it.

export function installChartLoader({ state, el } = {}) {
  if (typeof window === 'undefined') return;
  if (window.__trackerChartLoaderInstalled) return;
  window.__trackerChartLoaderInstalled = true;

  const chartWrap = el?.chartWrap || document.querySelector('.tracker-chart-wrap');
  if (!chartWrap) return;

  // create a container for the advanced chart if needed
  function createContainer() {
    let c = document.getElementById('tp-chart-container');
    if (!c) {
      c = document.createElement('div');
      c.id = 'tp-chart-container';
      c.style.width = '100%';
      // height is controlled by CSS (#tp-chart-container { height: 100%; min-height: 240px })
      // insert before the existing svg to preserve fallback
      const svg = document.getElementById('tp-chart');
      if (svg && svg.parentNode) svg.parentNode.insertBefore(c, svg);
      else chartWrap.appendChild(c);
    }
    return c;
  }

  async function loadChart() {
    try {
      const _container = createContainer();
      const mod = await import('../components/chart.js');
      const GoldChart = mod && mod.GoldChart ? mod.GoldChart : mod.default;
      if (!GoldChart) return;
      const chart = new GoldChart('tp-chart-container', state?.lang || 'en');
      // expose globally for simple integration with tracker-pro live updates
      window.__GOLD_CHART = chart;
      // provide initial history if available
      try {
        if (state && Array.isArray(state.history)) chart.setDailyHistory(state.history);
      } catch (e) {
        console.warn('[chart-loader] setDailyHistory failed', e);
      }
      // sync initial range from persisted state
      try {
        if (state?.range && typeof chart.setRange === 'function') {
          chart.setRange(state.range);
        }
      } catch (_e) {
        // non-fatal
      }

      // Sync language and visibility
      const obs = new MutationObserver(() => {
        try {
          if (chart.setLang) chart.setLang(state?.lang || 'en');
        } catch (_e) {}
      });
      obs.observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] });

      // hide the SVG fallback once chart is ready
      try {
        const svg = document.getElementById('tp-chart');
        if (svg) svg.style.display = 'none';
      } catch (_e) {}
    } catch (e) {
      console.warn('[chart-loader] failed to load GoldChart', e);
    }
  }

  // Intersection observer to load the chart once visible (or after an idle timeout)
  const io = new IntersectionObserver((entries) => {
    entries.forEach((en) => {
      if (en.isIntersecting) {
        // stop observing and load chart on idle
        io.disconnect();
        if ('requestIdleCallback' in window) {
          requestIdleCallback(loadChart, { timeout: 3000 });
        } else {
          setTimeout(loadChart, 800);
        }
      }
    });
  });
  io.observe(chartWrap);

  // Fallback: if user toggles to Chart via UI, load immediately
  document.getElementById('tp-jump-chart')?.addEventListener('click', (e) => {
    e.preventDefault();
    loadChart();
  });

  // Also expose a manual trigger
  window.__installGoldChartNow = loadChart;
}

export default installChartLoader;
