import L from 'leaflet';

/**
 * Leaflet's map.remove() walks every layer and calls onRemove. A tile layer
 * (and a few other layers) can still be registered after its DOM node is gone,
 * and onRemove then reads parentNode on undefined and crashes the page.
 *
 * When a node is missing, stand in a detached element and run Leaflet's own
 * teardown so tiles, handlers, and zoom limits are still cleared.
 */
let installed = false;

type GridWithTiles = L.GridLayer & {
  _container: HTMLElement | null;
  _tiles?: Record<string, { el?: HTMLElement | null }>;
};

type MarkerWithIcon = L.Marker & {
  _icon?: HTMLElement | null;
  _removeIcon: (this: MarkerWithIcon) => void;
};

function detached(tag: string): HTMLElement {
  return document.createElement(tag);
}

export function installLeafletTeardownGuard(): void {
  if (installed) return;
  installed = true;

  const gridProto = L.GridLayer.prototype as GridWithTiles;
  const originalGridOnRemove = gridProto.onRemove;
  gridProto.onRemove = function (this: GridWithTiles, map: L.Map) {
    if (this._tiles) {
      for (const key of Object.keys(this._tiles)) {
        if (!this._tiles[key]?.el) delete this._tiles[key];
      }
    }
    if (!this._container) this._container = detached('div');
    return originalGridOnRemove.call(this, map);
  };

  const imageProto = L.ImageOverlay.prototype as L.ImageOverlay & { _image?: HTMLElement | null };
  const originalImageOnRemove = imageProto.onRemove;
  imageProto.onRemove = function (this: L.ImageOverlay & { _image?: HTMLElement | null }, map: L.Map) {
    if (!this._image) this._image = detached('img');
    return originalImageOnRemove.call(this, map);
  };

  const markerProto = L.Marker.prototype as MarkerWithIcon;
  const originalRemoveIcon = markerProto._removeIcon;
  markerProto._removeIcon = function (this: MarkerWithIcon) {
    if (!this._icon) this._icon = detached('div');
    return originalRemoveIcon.call(this);
  };

  for (const Renderer of [L.SVG, L.Canvas]) {
    const proto = Renderer.prototype as L.Layer & {
      _container?: HTMLElement | null;
      _destroyContainer: (this: { _container?: HTMLElement | null }) => void;
    };
    const originalDestroy = proto._destroyContainer;
    proto._destroyContainer = function (this: { _container?: HTMLElement | null }) {
      if (!this._container) this._container = detached('div');
      return originalDestroy.call(this);
    };
  }
}
