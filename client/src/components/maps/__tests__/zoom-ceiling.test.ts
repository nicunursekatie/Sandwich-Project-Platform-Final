import L from 'leaflet';
import { BASEMAP_MAX_ZOOM, ensureZoomCeiling } from '@/components/maps/zoom-ceiling';

function mountMap(options: L.MapOptions = {}): L.Map {
  const container = document.createElement('div');
  document.body.appendChild(container);
  return L.map(container, { zoomControl: false, attributionControl: false, ...options }).setView(
    [33.75, -84.39],
    10
  );
}

describe('ensureZoomCeiling', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('reproduces the NaN crash when no tile layer has set a max zoom', () => {
    const map = mountMap();
    map.fitBounds([[33.7, -84.4], [33.7, -84.4]], { padding: [50, 50] });
    expect(map.getZoom()).toBe(Infinity);
    expect(() => map.getBounds()).toThrow(/Invalid LatLng object/);
  });

  it('keeps fitBounds finite before any tile layer is added', () => {
    const map = mountMap();
    ensureZoomCeiling(map);
    map.fitBounds([[33.7, -84.4], [33.7, -84.4]], { padding: [50, 50] });
    expect(map.getZoom()).toBe(BASEMAP_MAX_ZOOM);
    expect(() => map.getBounds()).not.toThrow();
  });

  it('leaves an explicit maxZoom alone', () => {
    const map = mountMap({ maxZoom: 15 });
    ensureZoomCeiling(map);
    expect(map.getMaxZoom()).toBe(15);
  });
});
