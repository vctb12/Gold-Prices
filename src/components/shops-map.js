/**
 * Shops Map Component — Leaflet.js interactive map view for gold shops directory.
 * Loads Leaflet from CDN with graceful fallback to list-only view.
 *
 * @module src/components/shops-map
 */

import { escape as escapeHtml } from '../lib/safe-dom.js';

const LEAFLET_CSS = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
const LEAFLET_JS = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';

// Default center: UAE/GCC region
const DEFAULT_CENTER = [25.2, 55.27];
const DEFAULT_ZOOM = 5;

let _leafletLoaded = false;
let _leafletLoadPromise = null;
let _map = null;
let _markers = [];
let _markerLayer = null;

/**
 * Dynamically load Leaflet CSS and JS from CDN.
 * @returns {Promise<boolean>} true if loaded successfully
 */
function loadLeaflet() {
  if (_leafletLoaded) return Promise.resolve(true);
  if (_leafletLoadPromise) return _leafletLoadPromise;

  _leafletLoadPromise = new Promise((resolve) => {
    // Load CSS
    if (!document.querySelector(`link[href="${LEAFLET_CSS}"]`)) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = LEAFLET_CSS;
      document.head.appendChild(link);
    }

    // Load JS
    if (window.L) {
      _leafletLoaded = true;
      resolve(true);
      return;
    }

    const script = document.createElement('script');
    script.src = LEAFLET_JS;
    script.async = true;
    script.onload = () => {
      _leafletLoaded = true;
      resolve(true);
    };
    script.onerror = () => {
      resolve(false);
    };
    document.head.appendChild(script);
  });

  return _leafletLoadPromise;
}

/**
 * Initialize the map in the given container.
 * @param {string} containerId - DOM element ID
 * @param {object} options
 * @param {Function} options.onMarkerClick - callback(shop) when a pin is clicked
 * @returns {Promise<boolean>} true if map initialized
 */
export async function initShopsMap(containerId, { onMarkerClick } = {}) {
  const container = document.getElementById(containerId);
  if (!container) return false;

  const loaded = await loadLeaflet();
  if (!loaded || !window.L) {
    container.innerHTML =
      '<p class="shops-map-fallback">Map could not be loaded. Showing list view.</p>';
    return false;
  }

  // Prevent double-init
  if (_map) {
    _map.remove();
    _map = null;
  }

  _map = window.L.map(containerId, {
    center: DEFAULT_CENTER,
    zoom: DEFAULT_ZOOM,
    scrollWheelZoom: true,
    zoomControl: true,
  });

  window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    maxZoom: 18,
  }).addTo(_map);

  _markerLayer = window.L.layerGroup().addTo(_map);
  _map._onMarkerClick = onMarkerClick;

  return true;
}

/**
 * Update map markers with the given shops array.
 * @param {Array} shops - filtered shops with lat/lng
 */
export function updateMapMarkers(shops) {
  if (!_map || !_markerLayer || !window.L) return;

  _markerLayer.clearLayers();
  _markers = [];

  const mappableShops = shops.filter((s) => s.lat && s.lng);
  if (!mappableShops.length) return;

  const bounds = [];

  mappableShops.forEach((shop) => {
    const marker = window.L.marker([shop.lat, shop.lng]);

    const popupContent = `
      <div class="shops-map-popup">
        <strong>${escapeHtml(shop.name)}</strong>
        <p>${escapeHtml(shop.market)}, ${escapeHtml(shop.city)}</p>
        <p class="shops-map-popup-category">${escapeHtml(shop.category)}</p>
        <button class="shops-map-popup-btn" data-shop-id="${escapeHtml(shop.id)}">View details &rarr;</button>
      </div>
    `;

    marker.bindPopup(popupContent);
    marker.on('popupopen', () => {
      const btn = document.querySelector(`.shops-map-popup-btn[data-shop-id="${shop.id}"]`);
      if (btn && _map._onMarkerClick) {
        btn.addEventListener('click', () => _map._onMarkerClick(shop));
      }
    });

    _markerLayer.addLayer(marker);
    _markers.push(marker);
    bounds.push([shop.lat, shop.lng]);
  });

  if (bounds.length > 1) {
    _map.fitBounds(bounds, { padding: [30, 30], maxZoom: 12 });
  } else if (bounds.length === 1) {
    _map.setView(bounds[0], 10);
  }
}

/**
 * Destroy the map instance and clean up.
 */
export function destroyShopsMap() {
  if (_map) {
    _map.remove();
    _map = null;
  }
  _markers = [];
  _markerLayer = null;
}

/**
 * Invalidate map size (call after container becomes visible).
 */
export function invalidateMapSize() {
  if (_map) {
    _map.invalidateSize();
  }
}
