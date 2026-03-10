import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap, useMapEvents } from 'react-leaflet';
import MarkerClusterGroup from 'react-leaflet-cluster';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'react-leaflet-cluster/dist/assets/MarkerCluster.css';
import 'react-leaflet-cluster/dist/assets/MarkerCluster.Default.css';
import {
  Search, Loader2, X, Navigation, MapPin, Building2, Heart, Car, Users, Route,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';

// Fix Leaflet default marker icon issue in bundled apps
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// --- Marker Icons (one per entity type) ---
const MARKER_SHADOW = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png';
const MARKER_BASE = 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-';

function makeIcon(color: string) {
  return new L.Icon({
    iconUrl: `${MARKER_BASE}${color}.png`,
    shadowUrl: MARKER_SHADOW,
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41],
  });
}

const ENTITY_ICONS = {
  event: makeIcon('blue'),
  host: makeIcon('green'),
  recipient: makeIcon('violet'),
  driver: makeIcon('orange'),
  volunteer: makeIcon('red'),
  search: makeIcon('gold'),
} as const;

const ENTITY_COLORS: Record<EntityType, string> = {
  event: '#3b82f6',
  host: '#22c55e',
  recipient: '#8b5cf6',
  driver: '#f97316',
  volunteer: '#ef4444',
};

const ENTITY_LABELS: Record<EntityType, { label: string; icon: typeof MapPin }> = {
  event: { label: 'Events', icon: MapPin },
  host: { label: 'Hosts', icon: Building2 },
  recipient: { label: 'Recipients', icon: Heart },
  driver: { label: 'Drivers', icon: Car },
  volunteer: { label: 'Volunteers', icon: Users },
};

// --- Types ---
type EntityType = 'event' | 'host' | 'recipient' | 'driver' | 'volunteer';

interface MapEntity {
  id: string;
  type: EntityType;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  metadata: Record<string, any>;
}

interface EventMapViewProps {
  onEventClick?: (event: any) => void;
}

// --- Helper components ---
function MapController({ center, zoom, flyKey }: { center: [number, number] | null; zoom: number; flyKey: number }) {
  const map = useMap();
  useEffect(() => {
    if (!center || !map) return;
    try { map.flyTo(center, zoom, { duration: 0.5 }); } catch {}
  }, [flyKey]); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}

function InvalidateSizeOnMount() {
  const map = useMap();
  useEffect(() => {
    setTimeout(() => map.invalidateSize(), 100);
  }, [map]);
  return null;
}

function FitBoundsOnLoad({ points }: { points: [number, number][] }) {
  const map = useMap();
  const hasFitted = useRef(false);
  useEffect(() => {
    if (hasFitted.current || points.length === 0) return;
    if (points.length > 1) {
      const bounds = L.latLngBounds(points);
      map.fitBounds(bounds, { padding: [30, 30], maxZoom: 12 });
    } else {
      map.setView(points[0], 11);
    }
    hasFitted.current = true;
  }, [points, map]);
  return null;
}

// Directions API call
async function fetchDrivingRoute(
  fromLat: number, fromLng: number, toLat: number, toLng: number
): Promise<{ coordinates: [number, number][]; distance: number; duration: number; durationInTraffic: number | null } | null> {
  try {
    const response = await fetch('/api/directions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        origin: { lat: fromLat, lng: fromLng },
        destination: { lat: toLat, lng: toLng },
        departureTime: 'now',
      }),
    });
    if (!response.ok) return null;
    const data = await response.json();
    if (!data.coordinates || data.coordinates.length === 0) return null;
    return {
      coordinates: data.coordinates,
      distance: data.distance,
      duration: data.duration,
      durationInTraffic: data.durationInTraffic ?? null,
    };
  } catch {
    return null;
  }
}

function formatDuration(seconds: number): string {
  const mins = Math.round(seconds / 60);
  if (mins < 60) return `${mins} min`;
  const hrs = Math.floor(mins / 60);
  const rem = mins % 60;
  return rem > 0 ? `${hrs} hr ${rem} min` : `${hrs} hr`;
}

function formatDistance(meters: number): string {
  const miles = meters / 1609.344;
  return `${miles.toFixed(1)} mi`;
}

// --- Main Component ---
function EventMapView({ onEventClick }: EventMapViewProps) {
  const { toast } = useToast();

  // State
  const [entityFilters, setEntityFilters] = useState<Record<EntityType, boolean>>({
    event: true, host: true, recipient: true, driver: true, volunteer: true,
  });
  const [addressSearch, setAddressSearch] = useState('');
  const [searchedLocation, setSearchedLocation] = useState<{ address: string; latitude: number; longitude: number } | null>(null);
  const [selectedPoints, setSelectedPoints] = useState<[MapEntity | null, MapEntity | null]>([null, null]);
  const [routeResult, setRouteResult] = useState<{ coordinates: [number, number][]; distance: number; duration: number; durationInTraffic: number | null } | null>(null);
  const [isCalculatingRoute, setIsCalculatingRoute] = useState(false);
  const [mapCenter, setMapCenter] = useState<[number, number] | null>(null);
  const [mapZoom, setMapZoom] = useState(11);
  const [flyKey, setFlyKey] = useState(0);
  const markerRefs = useRef<Map<string, L.Marker>>(new Map());

  // Data fetching
  const { data: events = [] } = useQuery<any[]>({
    queryKey: ['/api/event-map'],
    staleTime: 30000,
  });

  const { data: hosts = [] } = useQuery<any[]>({
    queryKey: ['/api/hosts/map'],
    staleTime: 30000,
  });

  const { data: recipients = [] } = useQuery<any[]>({
    queryKey: ['/api/recipients/map'],
    staleTime: 30000,
  });

  const { data: driverCandidates = [] } = useQuery<any[]>({
    queryKey: ['/api/drivers/driver-candidates'],
    staleTime: 30000,
  });

  // Normalize all entities
  const allEntities = useMemo(() => {
    const entities: MapEntity[] = [];

    // Events
    events.forEach((e: any) => {
      const lat = parseFloat(String(e.latitude));
      const lng = parseFloat(String(e.longitude));
      if (isNaN(lat) || isNaN(lng)) return;
      entities.push({
        id: `event-${e.id}`,
        type: 'event',
        name: e.organizationName || 'Unknown Event',
        address: e.eventAddress || '',
        latitude: lat,
        longitude: lng,
        metadata: {
          status: e.status,
          date: e.scheduledEventDate || e.desiredEventDate,
          sandwichCount: e.estimatedSandwichCount,
          eventId: e.id,
          raw: e,
        },
      });
    });

    // Hosts
    hosts.forEach((h: any) => {
      const lat = parseFloat(String(h.latitude));
      const lng = parseFloat(String(h.longitude));
      if (isNaN(lat) || isNaN(lng)) return;
      entities.push({
        id: `host-${h.id}`,
        type: 'host',
        name: h.contactName || h.hostLocationName || 'Unknown Host',
        address: h.address || '',
        latitude: lat,
        longitude: lng,
        metadata: { role: h.role, phone: h.phone, email: h.email, hostLocation: h.hostLocationName },
      });
    });

    // Recipients
    recipients.forEach((r: any) => {
      const lat = parseFloat(String(r.latitude));
      const lng = parseFloat(String(r.longitude));
      if (isNaN(lat) || isNaN(lng)) return;
      entities.push({
        id: `recipient-${r.id}`,
        type: 'recipient',
        name: r.name || 'Unknown Recipient',
        address: r.address || '',
        latitude: lat,
        longitude: lng,
        metadata: { region: r.region, sandwiches: r.estimatedSandwiches, contact: r.contactPersonName, phone: r.phone },
      });
    });

    // Drivers and Volunteers (from driver-candidates)
    driverCandidates.forEach((d: any) => {
      const lat = parseFloat(String(d.latitude));
      const lng = parseFloat(String(d.longitude));
      if (isNaN(lat) || isNaN(lng)) return;
      const type: EntityType = d.source === 'volunteer' ? 'volunteer' : 'driver';
      entities.push({
        id: `${type}-${d.id}`,
        type,
        name: d.name || d.contactName || `${d.firstName || ''} ${d.lastName || ''}`.trim() || 'Unknown',
        address: d.address || d.homeAddress || '',
        latitude: lat,
        longitude: lng,
        metadata: { phone: d.phone, email: d.email, area: d.area, source: d.source },
      });
    });

    return entities;
  }, [events, hosts, recipients, driverCandidates]);

  // Entity counts
  const entityCounts = useMemo(() => {
    const counts: Record<EntityType, number> = { event: 0, host: 0, recipient: 0, driver: 0, volunteer: 0 };
    allEntities.forEach(e => counts[e.type]++);
    return counts;
  }, [allEntities]);

  // Filtered entities
  const visibleEntities = useMemo(
    () => allEntities.filter(e => entityFilters[e.type]),
    [allEntities, entityFilters]
  );

  // All visible points for initial bounds
  const allPoints = useMemo<[number, number][]>(
    () => visibleEntities.map(e => [e.latitude, e.longitude]),
    [visibleEntities]
  );

  // Address search
  const geocodeMutation = useMutation({
    mutationFn: async (address: string) => {
      const res = await fetch('/api/event-map/geocode-address', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ address }),
      });
      if (!res.ok) throw new Error('Failed to geocode address');
      return res.json();
    },
    onSuccess: (data) => {
      setSearchedLocation({ address: addressSearch, latitude: data.latitude, longitude: data.longitude });
      setMapCenter([data.latitude, data.longitude]);
      setMapZoom(14);
      setFlyKey(k => k + 1);
    },
    onError: () => {
      toast({ title: 'Address not found', description: 'Could not locate that address.', variant: 'destructive' });
    },
  });

  const handleSearch = () => {
    if (addressSearch.trim()) geocodeMutation.mutate(addressSearch.trim());
  };

  // Two-point selection
  const handleSelectForRoute = useCallback(async (entity: MapEntity) => {
    setSelectedPoints(prev => {
      if (!prev[0]) return [entity, null];
      if (prev[0].id === entity.id) return prev; // already selected
      return [prev[0], entity];
    });
  }, []);

  // Calculate route when both points are set
  useEffect(() => {
    const [a, b] = selectedPoints;
    if (!a || !b) {
      setRouteResult(null);
      return;
    }
    setIsCalculatingRoute(true);
    fetchDrivingRoute(a.latitude, a.longitude, b.latitude, b.longitude).then(result => {
      setRouteResult(result);
      setIsCalculatingRoute(false);
      if (!result) {
        toast({ title: 'Route not found', description: 'Could not calculate drive time between these points.', variant: 'destructive' });
      }
    });
  }, [selectedPoints, toast]);

  const clearRoute = () => {
    setSelectedPoints([null, null]);
    setRouteResult(null);
  };

  const isSelected = (id: string) => selectedPoints[0]?.id === id || selectedPoints[1]?.id === id;

  return (
    <div className="space-y-3 px-4 sm:px-6">
      {/* Controls bar */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Entity filter toggles */}
        {(Object.keys(ENTITY_LABELS) as EntityType[]).map(type => {
          const config = ENTITY_LABELS[type];
          const Icon = config.icon;
          const active = entityFilters[type];
          const count = entityCounts[type];
          return (
            <Button
              key={type}
              variant="outline"
              size="sm"
              className={`h-8 text-xs ${active ? '' : 'opacity-40'}`}
              style={active ? { borderColor: ENTITY_COLORS[type], color: ENTITY_COLORS[type] } : {}}
              onClick={() => setEntityFilters(prev => ({ ...prev, [type]: !prev[type] }))}
            >
              <Icon className="w-3.5 h-3.5 mr-1" />
              {config.label}
              {count > 0 && (
                <Badge
                  variant="secondary"
                  className="ml-1 h-4 min-w-4 px-1 text-[10px]"
                  style={active ? { backgroundColor: ENTITY_COLORS[type], color: 'white' } : {}}
                >
                  {count}
                </Badge>
              )}
            </Button>
          );
        })}

        {/* Divider */}
        <div className="w-px h-6 bg-gray-300 mx-1 hidden sm:block" />

        {/* Address search */}
        <div className="flex items-center gap-1 flex-1 min-w-[200px] max-w-md">
          <Input
            value={addressSearch}
            onChange={e => setAddressSearch(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSearch()}
            placeholder="Search address..."
            className="h-8 text-sm"
          />
          <Button size="sm" variant="outline" className="h-8 px-2" onClick={handleSearch} disabled={geocodeMutation.isPending}>
            {geocodeMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
          </Button>
          {searchedLocation && (
            <Button size="sm" variant="ghost" className="h-8 px-2" onClick={() => setSearchedLocation(null)}>
              <X className="w-4 h-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Route selection indicator */}
      {(selectedPoints[0] || selectedPoints[1]) && (
        <div className="flex items-center gap-2 text-sm bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">
          <Route className="w-4 h-4 text-blue-600 flex-shrink-0" />
          <span className="text-blue-800">
            {selectedPoints[0] && !selectedPoints[1] && (
              <>Point A: <strong>{selectedPoints[0].name}</strong> — now select Point B on the map</>
            )}
            {selectedPoints[0] && selectedPoints[1] && (
              <>
                <strong>{selectedPoints[0].name}</strong>
                {' → '}
                <strong>{selectedPoints[1].name}</strong>
                {isCalculatingRoute && ' — calculating...'}
              </>
            )}
          </span>
          <Button size="sm" variant="ghost" className="h-6 px-2 ml-auto text-blue-600" onClick={clearRoute}>
            <X className="w-3.5 h-3.5 mr-1" /> Clear
          </Button>
        </div>
      )}

      {/* Map */}
      <div className="rounded-lg overflow-hidden border border-gray-200" style={{ height: '70vh' }}>
        <MapContainer
          center={[33.88, -84.35]}
          zoom={10}
          style={{ height: '100%', width: '100%' }}
          scrollWheelZoom={true}
        >
          <TileLayer
            attribution='&copy; <a href="https://carto.com/">CARTO</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
          />
          <InvalidateSizeOnMount />
          <FitBoundsOnLoad points={allPoints} />
          <MapController center={mapCenter} zoom={mapZoom} flyKey={flyKey} />

          <MarkerClusterGroup chunkedLoading maxClusterRadius={60}>
            {visibleEntities.map(entity => (
              <Marker
                key={entity.id}
                position={[entity.latitude, entity.longitude]}
                icon={ENTITY_ICONS[entity.type]}
                ref={(ref) => { if (ref) markerRefs.current.set(entity.id, ref); }}
              >
                <Popup maxWidth={280} minWidth={200}>
                  <EntityPopup
                    entity={entity}
                    isSelected={isSelected(entity.id)}
                    onSelectForRoute={() => handleSelectForRoute(entity)}
                    onEventClick={entity.type === 'event' && onEventClick ? () => onEventClick(entity.metadata.raw) : undefined}
                  />
                </Popup>
              </Marker>
            ))}
          </MarkerClusterGroup>

          {/* Search result marker */}
          {searchedLocation && (
            <Marker
              position={[searchedLocation.latitude, searchedLocation.longitude]}
              icon={ENTITY_ICONS.search}
            >
              <Popup>
                <div className="text-sm">
                  <p className="font-semibold">Searched Location</p>
                  <p className="text-gray-600">{searchedLocation.address}</p>
                </div>
              </Popup>
            </Marker>
          )}

          {/* Route polyline */}
          {routeResult && routeResult.coordinates.length > 0 && (
            <Polyline
              positions={routeResult.coordinates}
              pathOptions={{ color: '#3b82f6', weight: 4, opacity: 0.8 }}
            />
          )}
        </MapContainer>
      </div>

      {/* Drive time result bar */}
      {routeResult && selectedPoints[0] && selectedPoints[1] && (
        <div className="flex items-center gap-3 bg-white border border-gray-200 rounded-lg px-4 py-3 shadow-sm">
          <Navigation className="w-5 h-5 text-blue-600 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium text-gray-900 truncate">
              {selectedPoints[0].name} → {selectedPoints[1].name}
            </div>
            <div className="flex items-center gap-3 text-sm text-gray-600">
              <span>{formatDistance(routeResult.distance)}</span>
              <span className="text-gray-300">|</span>
              <span>~{formatDuration(routeResult.duration)}</span>
              {routeResult.durationInTraffic && routeResult.durationInTraffic !== routeResult.duration && (
                <>
                  <span className="text-gray-300">|</span>
                  <span className="text-orange-600">{formatDuration(routeResult.durationInTraffic)} in traffic</span>
                </>
              )}
            </div>
          </div>
          <Button size="sm" variant="outline" onClick={clearRoute}>Clear</Button>
        </div>
      )}
    </div>
  );
}

// --- Popup content for each entity type ---
function EntityPopup({
  entity,
  isSelected,
  onSelectForRoute,
  onEventClick,
}: {
  entity: MapEntity;
  isSelected: boolean;
  onSelectForRoute: () => void;
  onEventClick?: () => void;
}) {
  const { type, name, address, metadata } = entity;
  const color = ENTITY_COLORS[type];

  return (
    <div className="text-sm space-y-1.5" style={{ minWidth: 180 }}>
      <div className="flex items-center gap-1.5">
        <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
        <span className="font-semibold text-gray-900 text-base leading-tight">{name}</span>
      </div>
      <div className="text-xs text-gray-500 uppercase tracking-wide">{ENTITY_LABELS[type].label.slice(0, -1)}</div>
      {address && <p className="text-gray-600 text-xs">{address}</p>}

      {type === 'event' && (
        <div className="space-y-0.5 text-xs text-gray-600">
          {metadata.status && <p>Status: <span className="font-medium capitalize">{metadata.status}</span></p>}
          {metadata.date && <p>Date: {new Date(metadata.date).toLocaleDateString()}</p>}
          {metadata.sandwichCount && <p>Sandwiches: {metadata.sandwichCount}</p>}
        </div>
      )}

      {type === 'host' && (
        <div className="space-y-0.5 text-xs text-gray-600">
          {metadata.hostLocation && <p>{metadata.hostLocation}</p>}
          {metadata.role && <p>Role: {metadata.role}</p>}
          {metadata.phone && <p>{metadata.phone}</p>}
        </div>
      )}

      {type === 'recipient' && (
        <div className="space-y-0.5 text-xs text-gray-600">
          {metadata.region && <p>Region: {metadata.region}</p>}
          {metadata.contact && <p>Contact: {metadata.contact}</p>}
          {metadata.sandwiches && <p>Est. sandwiches: {metadata.sandwiches}</p>}
        </div>
      )}

      {(type === 'driver' || type === 'volunteer') && (
        <div className="space-y-0.5 text-xs text-gray-600">
          {metadata.area && <p>Area: {metadata.area}</p>}
          {metadata.phone && <p>{metadata.phone}</p>}
          {metadata.email && <p>{metadata.email}</p>}
        </div>
      )}

      <div className="flex gap-1.5 pt-1 border-t border-gray-100">
        <button
          onClick={onSelectForRoute}
          className={`text-xs px-2 py-1 rounded ${
            isSelected
              ? 'bg-blue-600 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-blue-50 hover:text-blue-700'
          }`}
        >
          {isSelected ? 'Selected' : 'Select for Route'}
        </button>
        {onEventClick && (
          <button
            onClick={onEventClick}
            className="text-xs px-2 py-1 rounded bg-[#007E8C]/10 text-[#007E8C] hover:bg-[#007E8C]/20"
          >
            View Event
          </button>
        )}
      </div>
    </div>
  );
}

export default EventMapView;
