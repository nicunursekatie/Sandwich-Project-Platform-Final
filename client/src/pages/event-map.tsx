import { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import {
  MapPin, Search, Calendar, Users, Package, Phone, Mail, AlertCircle,
  ChevronRight, Filter, RefreshCw, Navigation
} from 'lucide-react';
import { useActivityTracker } from '@/hooks/useActivityTracker';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { format } from 'date-fns';

import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, queryClient } from '@/lib/queryClient';

// Fix Leaflet default marker icon issue
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

interface EventMapData {
  id: number;
  organizationName: string | null;
  department: string | null;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  phone: string | null;
  eventAddress: string;
  latitude: string | null;
  longitude: string | null;
  desiredEventDate: string | null;
  scheduledEventDate: string | null;
  status: string;
  estimatedSandwichCount: number | null;
  tspContact: string | null;
  eventStartTime: string | null;
  eventEndTime: string | null;
}

// Custom marker icons for different statuses
const createColorIcon = (color: string) => {
  return new L.Icon({
    iconUrl: `https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-${color}.png`,
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41]
  });
};

const statusIcons = {
  new: createColorIcon('gold'),
  in_process: createColorIcon('yellow'),
  scheduled: createColorIcon('blue'),
  completed: createColorIcon('green'),
  declined: createColorIcon('grey'),
  postponed: createColorIcon('orange'),
  cancelled: createColorIcon('red'),
};

const statusColors = {
  new: 'bg-yellow-100 text-yellow-800 border-yellow-300',
  in_process: 'bg-blue-100 text-blue-800 border-blue-300',
  scheduled: 'bg-indigo-100 text-indigo-800 border-indigo-300',
  completed: 'bg-green-100 text-green-800 border-green-300',
  declined: 'bg-gray-100 text-gray-800 border-gray-300',
  postponed: 'bg-orange-100 text-orange-800 border-orange-300',
  cancelled: 'bg-red-100 text-red-800 border-red-300',
};

// Component to auto-fit map bounds
function MapBounds({ events }: { events: EventMapData[] }) {
  const map = useMap();

  useEffect(() => {
    if (events.length > 0) {
      const bounds = L.latLngBounds(
        events.map(e => [parseFloat(e.latitude!), parseFloat(e.longitude!)])
      );
      map.fitBounds(bounds, { padding: [50, 50] });
    }
  }, [events, map]);

  return null;
}

export default function EventMapView() {
  const { user } = useAuth();
  const { trackView, trackSearch } = useActivityTracker();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedEvent, setSelectedEvent] = useState<EventMapData | null>(null);

  useEffect(() => {
    trackView(
      'Event Requests',
      'Event Planning',
      'Event Map',
      'User accessed event map view'
    );
  }, [trackView]);

  // Fetch events with coordinates
  const { data: events = [], isLoading, error, refetch } = useQuery<EventMapData[]>({
    queryKey: ['/api/event-map', statusFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (statusFilter !== 'all') {
        params.append('status', statusFilter);
      }
      const response = await fetch(`/api/event-map?${params}`);
      if (!response.ok) throw new Error('Failed to fetch event map data');
      return response.json();
    },
  });

  // Geocode mutation (server-side rate limited to 1 req/sec)
  const geocodeMutation = useMutation({
    mutationFn: async (eventId: number) => {
      return await apiRequest('POST', `/api/event-map/geocode/${eventId}`);
    },
    onSuccess: () => {
      toast({
        title: 'Address Geocoded',
        description: 'Event location has been added to the map (rate limited: 1 per second)',
      });
      queryClient.invalidateQueries({ queryKey: ['/api/event-map'] });
    },
    onError: (error: any) => {
      const errorDetails = error?.message || error?.details || 'Unable to find coordinates for this address';
      toast({
        title: 'Geocoding Failed',
        description: errorDetails,
        variant: 'destructive',
      });
    },
  });

  // Filter events with coordinates
  const eventsWithCoordinates = useMemo(() => {
    return events.filter(e => e.latitude && e.longitude);
  }, [events]);

  // Filter events without coordinates
  const eventsNeedingGeocode = useMemo(() => {
    return events.filter(e => !e.latitude || !e.longitude);
  }, [events]);

  // Search filtering
  const filteredEvents = useMemo(() => {
    if (!searchTerm.trim()) return eventsWithCoordinates;
    
    const search = searchTerm.toLowerCase();
    return eventsWithCoordinates.filter(event => 
      event.organizationName?.toLowerCase().includes(search) ||
      event.department?.toLowerCase().includes(search) ||
      event.eventAddress?.toLowerCase().includes(search) ||
      `${event.firstName} ${event.lastName}`.toLowerCase().includes(search)
    );
  }, [eventsWithCoordinates, searchTerm]);

  // Calculate map center
  const mapCenter: [number, number] = useMemo(() => {
    if (filteredEvents.length === 0) return [33.7490, -84.3880]; // Atlanta default
    
    const avgLat = filteredEvents.reduce((sum, e) => sum + parseFloat(e.latitude!), 0) / filteredEvents.length;
    const avgLng = filteredEvents.reduce((sum, e) => sum + parseFloat(e.longitude!), 0) / filteredEvents.length;
    
    return [avgLat, avgLng];
  }, [filteredEvents]);

  // Get event date
  const getEventDate = (event: EventMapData) => {
    const date = event.scheduledEventDate || event.desiredEventDate;
    return date ? format(new Date(date), 'MMM dd, yyyy') : 'No date set';
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100">
        <Card className="max-w-md mx-4">
          <CardContent className="pt-6">
            <div className="flex flex-col items-center text-center space-y-4">
              <Skeleton className="h-12 w-12 rounded-full" />
              <Skeleton className="h-6 w-48" />
              <Skeleton className="h-4 w-64" />
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100">
        <Card className="max-w-md mx-4">
          <CardContent className="pt-6">
            <div className="flex flex-col items-center text-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center">
                <AlertCircle className="w-8 h-8 text-red-600" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-gray-900 mb-2">
                  Error Loading Map
                </h2>
                <p className="text-gray-600">
                  {error instanceof Error ? error.message : 'Failed to load event map'}
                </p>
              </div>
              <Button onClick={() => refetch()}>
                <RefreshCw className="w-4 h-4 mr-2" />
                Try Again
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-white">
      {/* Header */}
      <div className="flex-shrink-0 p-4 bg-white border-b border-gray-200">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#007E8C] to-[#005f6b] flex items-center justify-center">
              <Navigation className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Event Requests Map</h1>
              <p className="text-sm text-gray-600">
                {filteredEvents.length} event{filteredEvents.length !== 1 ? 's' : ''} on map
                {eventsNeedingGeocode.length > 0 && (
                  <span className="text-orange-600 ml-2">
                    • {eventsNeedingGeocode.length} need geocoding
                  </span>
                )}
              </p>
            </div>
          </div>
          <Button onClick={() => refetch()} variant="outline" size="sm">
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
        </div>

        {/* Filters */}
        <div className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <Input
              placeholder="Search by organization, name, or address..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full md:w-48">
              <Filter className="w-4 h-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="new">New</SelectItem>
              <SelectItem value="in_process">In Process</SelectItem>
              <SelectItem value="scheduled">Scheduled</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Map and Sidebar */}
      <div className="flex-1 flex overflow-hidden">
        {/* Map */}
        <div className="flex-1 relative">
          {filteredEvents.length > 0 ? (
            <MapContainer
              center={mapCenter}
              zoom={10}
              style={{ height: '100%', width: '100%' }}
              className="z-0"
            >
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              <MapBounds events={filteredEvents} />
              {filteredEvents.map((event) => (
                <Marker
                  key={event.id}
                  position={[parseFloat(event.latitude!), parseFloat(event.longitude!)]}
                  icon={statusIcons[event.status as keyof typeof statusIcons] || statusIcons.new}
                  eventHandlers={{
                    click: () => setSelectedEvent(event),
                  }}
                >
                  <Popup>
                    <div className="p-2 min-w-[250px]">
                      <h3 className="font-semibold text-base mb-2">
                        {event.organizationName || 'Unknown Organization'}
                      </h3>
                      {event.department && (
                        <p className="text-sm text-gray-600 mb-2">{event.department}</p>
                      )}
                      <div className="space-y-1 text-sm">
                        <div className="flex items-center gap-2">
                          <Calendar className="w-3 h-3 text-gray-500" />
                          <span>{getEventDate(event)}</span>
                        </div>
                        {event.estimatedSandwichCount && (
                          <div className="flex items-center gap-2">
                            <Package className="w-3 h-3 text-gray-500" />
                            <span>~{event.estimatedSandwichCount} sandwiches</span>
                          </div>
                        )}
                        <div className="flex items-center gap-2">
                          <MapPin className="w-3 h-3 text-gray-500" />
                          <span className="text-xs">{event.eventAddress}</span>
                        </div>
                      </div>
                      <Badge className={`${statusColors[event.status as keyof typeof statusColors]} mt-2`}>
                        {event.status.replace('_', ' ').toUpperCase()}
                      </Badge>
                    </div>
                  </Popup>
                </Marker>
              ))}
            </MapContainer>
          ) : (
            <div className="h-full flex items-center justify-center bg-gray-50">
              <div className="text-center">
                <MapPin className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  No Events to Display
                </h3>
                <p className="text-gray-600">
                  {eventsNeedingGeocode.length > 0
                    ? 'Geocode event addresses to see them on the map'
                    : 'No events with addresses found'}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Sidebar - Events needing geocoding */}
        {eventsNeedingGeocode.length > 0 && (
          <div className="w-80 border-l border-gray-200 bg-gray-50 flex flex-col">
            <div className="p-4 border-b border-gray-200 bg-white">
              <h2 className="font-semibold text-gray-900 flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-orange-500" />
                Needs Geocoding ({eventsNeedingGeocode.length})
              </h2>
              <p className="text-xs text-gray-600 mt-1">
                Click to add event to map
              </p>
            </div>
            <ScrollArea className="flex-1">
              <div className="p-3 space-y-2">
                {eventsNeedingGeocode.map((event) => (
                  <Card
                    key={event.id}
                    className={`p-3 transition-shadow ${
                      geocodeMutation.isPending 
                        ? 'cursor-not-allowed opacity-50' 
                        : 'hover:shadow-md cursor-pointer'
                    }`}
                    onClick={() => {
                      if (!geocodeMutation.isPending) {
                        geocodeMutation.mutate(event.id);
                      }
                    }}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-medium text-sm truncate">
                          {event.organizationName || 'Unknown'}
                        </h3>
                        <p className="text-xs text-gray-600 mt-1 line-clamp-2">
                          {event.eventAddress}
                        </p>
                        <Badge className={`${statusColors[event.status as keyof typeof statusColors]} text-xs mt-2`}>
                          {event.status.replace('_', ' ')}
                        </Badge>
                      </div>
                      {geocodeMutation.isPending ? (
                        <RefreshCw className="w-4 h-4 text-gray-400 flex-shrink-0 mt-1 animate-spin" />
                      ) : (
                        <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0 mt-1" />
                      )}
                    </div>
                  </Card>
                ))}
              </div>
            </ScrollArea>
          </div>
        )}
      </div>
    </div>
  );
}
