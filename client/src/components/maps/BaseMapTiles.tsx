import { useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { TileLayer, useMap } from 'react-leaflet';

type MapTileConfig =
  | { provider: 'google'; attribution: string }
  | { provider: 'carto'; reason: string };

const CARTO_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>';

let warnedFallback = false;

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => {
    switch (char) {
      case '&':
        return '&amp;';
      case '<':
        return '&lt;';
      case '>':
        return '&gt;';
      case '"':
        return '&quot;';
      default:
        return '&#39;';
    }
  });
}

function googleAttribution(copyright: string): string {
  const safe = escapeHtml(copyright.trim()) || 'Map data © Google Maps';
  return `<a href="https://www.google.com/maps" target="_blank" rel="noopener noreferrer" aria-label="Google Maps">Google Maps</a> | ${safe}`;
}

/**
 * Google requires a visible Google Maps credit plus the copyright string
 * from the tile viewport API. Both sit in Leaflet's bottom-right attribution
 * so they stay clear of the driver-planning legend.
 */
function GoogleMapCredits({ initialCopyright }: { initialCopyright: string }) {
  const map = useMap();
  const appliedCopyright = useRef<string | null>(null);

  useEffect(() => {
    const attribution = map.attributionControl;
    const previousPrefix = attribution?.options.prefix;
    attribution?.setPrefix(false);

    const applyCopyright = (text: string) => {
      const next = googleAttribution(text);
      if (appliedCopyright.current === next) return;
      if (appliedCopyright.current) {
        attribution?.removeAttribution(appliedCopyright.current);
      }
      attribution?.addAttribution(next);
      appliedCopyright.current = next;
    };

    applyCopyright(initialCopyright);

    let timer: ReturnType<typeof setTimeout> | undefined;
    let cancelled = false;

    const schedule = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(async () => {
        const bounds = map.getBounds();
        const params = new URLSearchParams({
          north: bounds.getNorth().toFixed(4),
          south: bounds.getSouth().toFixed(4),
          east: bounds.getEast().toFixed(4),
          west: bounds.getWest().toFixed(4),
          zoom: String(Math.round(map.getZoom())),
        });
        try {
          const response = await fetch(`/api/maps/copyright?${params}`, {
            credentials: 'include',
          });
          if (!response.ok || cancelled) return;
          const body = await response.json();
          if (typeof body.copyright === 'string') applyCopyright(body.copyright);
        } catch {
          // Keep the last copyright string if this lookup fails.
        }
      }, 400);
    };

    map.on('moveend', schedule);
    schedule();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      map.off('moveend', schedule);
      if (appliedCopyright.current) {
        attribution?.removeAttribution(appliedCopyright.current);
        appliedCopyright.current = null;
      }
      attribution?.setPrefix(
        previousPrefix === false || typeof previousPrefix === 'string' ? previousPrefix : 'Leaflet'
      );
    };
  }, [map, initialCopyright]);

  return (
    <TileLayer
      attribution=""
      url="/api/maps/tiles/{z}/{x}/{y}"
      maxZoom={20}
    />
  );
}

function CartoTiles({ reason }: { reason?: string }) {
  if (reason && !warnedFallback) {
    warnedFallback = true;
    console.warn(`Map tiles: ${reason}`);
  }

  return (
    <>
      <TileLayer
        attribution={CARTO_ATTRIBUTION}
        url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
        subdomains="abcd"
        maxZoom={20}
      />
      {reason ? <FallbackNotice reason={reason} /> : null}
    </>
  );
}

function FallbackNotice({ reason }: { reason: string }) {
  const map = useMap();

  useEffect(() => {
    const note = document.createElement('div');
    note.textContent = reason;
    note.setAttribute('role', 'status');
    note.style.cssText = [
      'position:absolute',
      'top:10px',
      'left:50px',
      'z-index:1000',
      'background:#fff',
      'color:#7a4b00',
      'font:12px/1.35 system-ui,sans-serif',
      'padding:6px 8px',
      'border-radius:6px',
      'box-shadow:0 1px 4px rgba(0,0,0,.2)',
      'max-width:min(420px, calc(100% - 60px))',
    ].join(';');
    map.getContainer().appendChild(note);
    return () => note.remove();
  }, [map, reason]);

  return null;
}

/**
 * Basemap for Leaflet screens. Uses Google roadmap tiles when the server
 * can reach the Map Tiles API, and the previous CARTO tiles when it cannot.
 */
export function BaseMapTiles() {
  const { data, isLoading, isError } = useQuery<MapTileConfig>({
    queryKey: ['/api/maps/config'],
    staleTime: 60 * 1000,
    retry: 1,
  });

  if (isLoading) return null;
  if (isError || !data || data.provider !== 'google') {
    return <CartoTiles reason={data?.provider === 'carto' ? data.reason : undefined} />;
  }

  return <GoogleMapCredits initialCopyright={data.attribution} />;
}
