import L from 'leaflet';

/**
 * Leaflet's map.remove() walks every layer and calls onRemove. A tile layer
 * (and a few other layers) can still be registered after its DOM node is gone,
 * and onRemove then reads parentNode on undefined and crashes the page.
 */
let installed = false;

export function installLeafletTeardownGuard(): void {
  if (installed) return;
  installed = true;

  const gridProto = L.GridLayer.prototype as L.GridLayer & {
    _container: HTMLElement | null;
    _tileZoom?: number;
  };
  const originalGridOnRemove = gridProto.onRemove;
  gridProto.onRemove = function (
    this: L.GridLayer & { _container: HTMLElement | null; _tileZoom?: number },
    map: L.Map
  ) {
    if (!this._container) {
      (map as L.Map & { _removeZoomLimit?: (layer: L.GridLayer) => void })._removeZoomLimit?.(this);
      this._tileZoom = undefined;
      return;
    }
    return originalGridOnRemove.call(this, map);
  };

  const imageProto = L.ImageOverlay.prototype as L.ImageOverlay & { _image?: HTMLElement | null };
  const originalImageOnRemove = imageProto.onRemove;
  imageProto.onRemove = function (this: L.ImageOverlay & { _image?: HTMLElement | null }, map: L.Map) {
    if (!this._image) return;
    return originalImageOnRemove.call(this, map);
  };

  const markerProto = L.Marker.prototype as L.Marker & { _icon?: HTMLElement | null };
  const originalRemoveIcon = markerProto._removeIcon;
  markerProto._removeIcon = function (this: L.Marker & { _icon?: HTMLElement | null }) {
    if (!this._icon) return;
    return originalRemoveIcon.call(this);
  };

  for (const Renderer of [L.SVG, L.Canvas]) {
    const proto = Renderer.prototype as L.Layer & { _container?: HTMLElement | null; _destroyContainer: () => void };
    const originalDestroy = proto._destroyContainer;
    proto._destroyContainer = function (this: { _container?: HTMLElement | null }) {
      if (!this._container) return;
      return originalDestroy.call(this);
    };
  }
}
