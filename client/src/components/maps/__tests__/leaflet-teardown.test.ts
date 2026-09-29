import L from 'leaflet';
import { installLeafletTeardownGuard } from '@/components/maps/leaflet-teardown';

function mountMap(): L.Map {
  const container = document.createElement('div');
  container.style.width = '400px';
  container.style.height = '400px';
  document.body.appendChild(container);
  return L.map(container, { zoomControl: false, attributionControl: false }).setView([33.75, -84.39], 10);
}

describe('leaflet teardown guard', () => {
  beforeAll(() => {
    installLeafletTeardownGuard();
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('removes a map when a tile layer has already lost its container', () => {
    const map = mountMap();
    const tiles = L.tileLayer('https://example.com/{z}/{x}/{y}.png').addTo(map) as L.TileLayer & {
      _container: HTMLElement | null;
      _tiles: Record<string, { el?: HTMLElement | null }>;
    };
    const tile = document.createElement('img');
    tiles._tiles['1:2:3'] = { el: tile };
    tiles._tiles['4:5:6'] = { el: null };
    tiles._container = null;

    expect(() => map.remove()).not.toThrow();
    expect(tiles._tiles).toEqual({});
    expect(tiles._container).toBeNull();
  });

  it('removes a map when a marker icon is already gone', () => {
    const map = mountMap();
    const marker = L.marker([33.75, -84.39]).addTo(map) as L.Marker & { _icon: HTMLElement | null };
    marker._icon = null;

    expect(() => map.remove()).not.toThrow();
    expect(marker._icon).toBeNull();
  });
});
