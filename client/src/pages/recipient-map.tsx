import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { MapContainer, TileLayer, Marker, Popup, useMap, useMapEvents } from 'react-leaflet';
import type { Popup as LeafletPopup, Marker as LeafletMarker } from 'leaflet';
import {
  MapPin, Search, AlertCircle, Phone, Mail, Building2, List, ChevronRight, ChevronLeft,
  Users, Calendar, Package, RefreshCw
} from 'lucide-react';
import { useActivityTracker } from '@/hooks/useActivityTracker';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { PageBreadcrumbs } from '@/components/page-breadcrumbs';

import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useAuth } from '@/hooks/useAuth';
import { useResourcePermissions } from '@/hooks/useResourcePermissions';
import { useToast } from '@/hooks/use-toast';
import { queryClient } from '@/lib/queryClient';
import type { Recipient } from '@shared/schema';

// Fix Leaflet default marker icon issue in bundled apps
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Custom purple marker for recipients
const recipientIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-violet.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

// Highlighted marker icon
const highlightedIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

// Map controller component to handle zoom/pan and popup opening
function MapController({ 
  center, 
  zoom, 
  selectedRecipientId,
  markerRefs 
}: { 
  center: [number, number] | null; 
  zoom: number;
  selectedRecipientId: number | null;
  markerRefs: React.MutableRefObject<Map<number, React.RefObject<LeafletMarker>>>;
}) {
  const map = useMap();
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!isMountedRef.current) return;

    if (center && map) {
      const mapInstance = map as any;
      if (!mapInstance._leaflet_events || !mapInstance._container) {
        return;
      }

      try {
        map.setView(center, zoom, { animate: true, duration: 0.5 });
      } catch (error) {
        if (isMountedRef.current) {
          console.warn('Map interaction error:', error);
        }
      }
    }
  }, [center, zoom, map]);

  // Open popup when recipient is selected and map has centered
  useEffect(() => {
    if (selectedRecipientId && center && map) {
      const timer = setTimeout(() => {
        const markerRef = markerRefs.current.get(selectedRecipientId);
        if (markerRef?.current) {
          markerRef.current.openPopup();
        }
      }, 500); // Wait for map animation to complete
      return () => clearTimeout(timer);
    }
  }, [selectedRecipientId, center, map, markerRefs]);

  return null;
}

// Map click handler
function MapClickHandler({ onMapClick }: { onMapClick: () => void }) {
  useMapEvents({
    click: () => {
      onMapClick();
    },
  });
  return null;
}

export default function RecipientMapView() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { trackView, trackSearch } = useActivityTracker();
  const [searchTerm, setSearchTerm] = useState('');
  const [isPanelOpen, setIsPanelOpen] = useState(true);
  const [selectedRecipientId, setSelectedRecipientId] = useState<number | null>(null);
  const [mapCenter, setMapCenter] = useState<[number, number] | null>(null);
  const [mapZoom, setMapZoom] = useState(10);
  const markerRefs = useRef<Map<number, React.RefObject<LeafletMarker>>>(new Map());

  useEffect(() => {
    trackView(
      'Maps',
      'Maps',
      'Recipient Map',
      'User accessed recipient map'
    );
  }, [trackView]);

  // Check permissions
  const { canView } = useResourcePermissions('RECIPIENTS');

  // Fetch recipients
  const { data: recipients = [], isLoading, error } = useQuery<Recipient[]>({
    queryKey: ['/api/recipients'],
    enabled: canView,
  });

  // Geocode mutation
  const geocodeMutation = useMutation({
    mutationFn: async (recipientId: number) => {
      const response = await fetch(`/api/recipients/${recipientId}/geocode`, {
        method: 'POST',
        credentials: 'include',
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to geocode');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/recipients'] });
      toast({
        title: 'Address geocoded',
        description: 'Location coordinates have been updated.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Geocoding failed',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Filter recipients that have coordinates
  const recipientsWithCoords = useMemo(() => {
    return recipients.filter(r => r.latitude && r.longitude && r.status === 'active');
  }, [recipients]);

  // Filter based on search
  const filteredRecipients = useMemo(() => {
    if (!searchTerm.trim()) return recipientsWithCoords;

    const search = searchTerm.toLowerCase();
    return recipientsWithCoords.filter(r =>
      r.name.toLowerCase().includes(search) ||
      r.address?.toLowerCase().includes(search) ||
      r.region?.toLowerCase().includes(search) ||
      r.contactPersonName?.toLowerCase().includes(search)
    );
  }, [recipientsWithCoords, searchTerm]);

  // Recipients without coordinates (for geocoding)
  const recipientsWithoutCoords = useMemo(() => {
    return recipients.filter(r => (!r.latitude || !r.longitude) && r.address && r.status === 'active');
  }, [recipients]);

  // Calculate initial map center
  const initialMapCenter: [number, number] = useMemo(() => {
    if (filteredRecipients.length === 0) return [33.7490, -84.3880]; // Atlanta default

    const avgLat = filteredRecipients.reduce((sum, r) => sum + parseFloat(r.latitude as string), 0) / filteredRecipients.length;
    const avgLng = filteredRecipients.reduce((sum, r) => sum + parseFloat(r.longitude as string), 0) / filteredRecipients.length;

    return [avgLat, avgLng];
  }, [filteredRecipients]);

  // Handle recipient card click
  const handleRecipientClick = (recipient: Recipient) => {
    if (!recipient.latitude || !recipient.longitude) return;

    const lat = parseFloat(recipient.latitude as string);
    const lng = parseFloat(recipient.longitude as string);
    setSelectedRecipientId(recipient.id);
    setMapCenter([lat, lng]);
    setMapZoom(15);
  };


  // Permission check
  if (!canView) {
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
                  Access Denied
                </h2>
                <p className="text-gray-600">
                  You don't have permission to view the recipient map.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Loading state
  if (isLoading) {
    return (
      <div className="h-screen flex flex-col">
        <div className="flex-shrink-0 p-4 bg-white border-b border-gray-200">
          <div className="flex items-center gap-4">
            <Skeleton className="h-12 w-12 rounded-xl" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-6 w-48" />
              <Skeleton className="h-4 w-96" />
            </div>
          </div>
        </div>
        <div className="flex-1 relative">
          <Skeleton className="absolute inset-0" />
        </div>
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
                  Error Loading Recipients
                </h2>
                <p className="text-gray-600">
                  {(error as Error).message || 'An unexpected error occurred'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* Header */}
      <div className="flex-shrink-0 p-4 bg-white border-b border-gray-200 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-purple-100 flex items-center justify-center">
              <Building2 className="w-6 h-6 text-purple-600" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">Recipient Map</h1>
              <p className="text-sm text-gray-500">
                {filteredRecipients.length} of {recipientsWithCoords.length} recipients shown
                {recipientsWithoutCoords.length > 0 && (
                  <span className="text-amber-600 ml-2">
                    ({recipientsWithoutCoords.length} need geocoding)
                  </span>
                )}
              </p>
            </div>
          </div>
          <PageBreadcrumbs items={[
            { label: 'Recipients', href: '/recipients' },
            { label: 'Map' }
          ]} />
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Side Panel */}
        <div className={`flex-shrink-0 bg-white border-r border-gray-200 transition-all duration-300 ${isPanelOpen ? 'w-96' : 'w-0'}`}>
          {isPanelOpen && (
            <div className="h-full flex flex-col">
              {/* Search */}
              <div className="p-4 border-b border-gray-100">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <Input
                    type="text"
                    placeholder="Search recipients..."
                    value={searchTerm}
                    onChange={(e) => {
                      setSearchTerm(e.target.value);
                      if (e.target.value.length > 2) {
                        trackSearch('recipient_map', e.target.value, filteredRecipients.length);
                      }
                    }}
                    className="pl-10"
                  />
                </div>
              </div>

              {/* Recipients List */}
              <ScrollArea className="flex-1">
                <div className="p-2 space-y-2">
                  {filteredRecipients.map((recipient) => (
                    <Card
                      key={recipient.id}
                      className={`cursor-pointer transition-all hover:shadow-md ${
                        selectedRecipientId === recipient.id
                          ? 'ring-2 ring-purple-500 bg-purple-50'
                          : 'hover:bg-gray-50'
                      }`}
                      onClick={() => handleRecipientClick(recipient)}
                    >
                      <CardContent className="p-3">
                        <div className="flex items-start gap-3">
                          <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center flex-shrink-0">
                            <Building2 className="w-4 h-4 text-purple-600" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <h3 className="font-medium text-gray-900 truncate">
                              {recipient.name}
                            </h3>
                            {recipient.region && (
                              <Badge variant="outline" className="text-xs mt-1">
                                {recipient.region}
                              </Badge>
                            )}
                            {recipient.address && (
                              <p className="text-xs text-gray-500 mt-1 line-clamp-2">
                                <MapPin className="w-3 h-3 inline mr-1" />
                                {recipient.address}
                              </p>
                            )}
                            <div className="flex flex-wrap gap-2 mt-2 text-xs text-gray-500">
                              {recipient.estimatedSandwiches && (
                                <span className="flex items-center gap-1">
                                  <Package className="w-3 h-3" />
                                  {recipient.estimatedSandwiches}/wk
                                </span>
                              )}
                              {recipient.collectionDay && (
                                <span className="flex items-center gap-1">
                                  <Calendar className="w-3 h-3" />
                                  {recipient.collectionDay}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}

                  {filteredRecipients.length === 0 && (
                    <div className="text-center py-8 text-gray-500">
                      <MapPin className="w-12 h-12 mx-auto mb-2 opacity-30" />
                      <p>No recipients found</p>
                      {searchTerm && (
                        <p className="text-sm">Try a different search term</p>
                      )}
                    </div>
                  )}
                </div>
              </ScrollArea>

              {/* Geocoding section */}
              {recipientsWithoutCoords.length > 0 && (
                <div className="p-4 border-t border-gray-100 bg-amber-50">
                  <h4 className="text-sm font-medium text-amber-800 mb-2">
                    Recipients needing geocoding ({recipientsWithoutCoords.length})
                  </h4>
                  <div className="max-h-32 overflow-y-auto space-y-1">
                    {recipientsWithoutCoords.slice(0, 5).map((r) => (
                      <div key={r.id} className="flex items-center justify-between text-xs">
                        <span className="truncate text-gray-700">{r.name}</span>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 px-2"
                          onClick={() => geocodeMutation.mutate(r.id)}
                          disabled={geocodeMutation.isPending}
                        >
                          <RefreshCw className={`w-3 h-3 ${geocodeMutation.isPending ? 'animate-spin' : ''}`} />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Toggle Panel Button */}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setIsPanelOpen(!isPanelOpen)}
          className="absolute left-0 top-1/2 transform -translate-y-1/2 z-[1000] bg-white shadow-md rounded-r-lg rounded-l-none h-12 px-1"
          style={{ left: isPanelOpen ? '384px' : '0px' }}
        >
          {isPanelOpen ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </Button>

        {/* Map */}
        <div className="flex-1 relative">
          <MapContainer
            center={initialMapCenter}
            zoom={10}
            className="h-full w-full"
            scrollWheelZoom={true}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <MapController 
              center={mapCenter} 
              zoom={mapZoom} 
              selectedRecipientId={selectedRecipientId}
              markerRefs={markerRefs}
            />
            <MapClickHandler onMapClick={() => setSelectedRecipientId(null)} />

            {filteredRecipients.map((recipient) => {
              if (!recipient.latitude || !recipient.longitude) return null;

              const lat = parseFloat(recipient.latitude as string);
              const lng = parseFloat(recipient.longitude as string);
              const isSelected = selectedRecipientId === recipient.id;

              // Get or create marker ref for this recipient
              if (!markerRefs.current.has(recipient.id)) {
                markerRefs.current.set(recipient.id, React.createRef<LeafletMarker>());
              }
              const markerRef = markerRefs.current.get(recipient.id)!;

              return (
                <Marker
                  key={recipient.id}
                  ref={markerRef}
                  position={[lat, lng]}
                  icon={isSelected ? highlightedIcon : recipientIcon}
                  eventHandlers={{
                    click: () => handleRecipientClick(recipient),
                  }}
                >
                  <Popup>
                    <div className="min-w-[200px]">
                      <h3 className="font-semibold text-gray-900">{recipient.name}</h3>
                      {recipient.region && (
                        <Badge variant="outline" className="text-xs mt-1">
                          {recipient.region}
                        </Badge>
                      )}
                      {recipient.address && (
                        <p className="text-sm text-gray-600 mt-2">
                          <MapPin className="w-3 h-3 inline mr-1" />
                          {recipient.address}
                        </p>
                      )}
                      {recipient.contactPersonName && (
                        <p className="text-sm text-gray-600 mt-1">
                          <Users className="w-3 h-3 inline mr-1" />
                          {recipient.contactPersonName}
                          {recipient.contactPersonRole && ` (${recipient.contactPersonRole})`}
                        </p>
                      )}
                      {recipient.phone && (
                        <p className="text-sm text-gray-600 mt-1">
                          <Phone className="w-3 h-3 inline mr-1" />
                          <a href={`tel:${recipient.phone}`} className="text-blue-600 hover:underline">
                            {recipient.phone}
                          </a>
                        </p>
                      )}
                      {recipient.email && (
                        <p className="text-sm text-gray-600 mt-1">
                          <Mail className="w-3 h-3 inline mr-1" />
                          <a href={`mailto:${recipient.email}`} className="text-blue-600 hover:underline">
                            {recipient.email}
                          </a>
                        </p>
                      )}
                      <div className="flex gap-2 mt-2 text-xs text-gray-500">
                        {recipient.estimatedSandwiches && (
                          <span>
                            <Package className="w-3 h-3 inline mr-1" />
                            {recipient.estimatedSandwiches}/wk
                          </span>
                        )}
                        {recipient.collectionDay && (
                          <span>
                            <Calendar className="w-3 h-3 inline mr-1" />
                            {recipient.collectionDay}
                          </span>
                        )}
                      </div>
                    </div>
                  </Popup>
                </Marker>
              );
            })}
          </MapContainer>

          {/* Legend */}
          <div className="absolute bottom-4 right-4 bg-white rounded-lg shadow-lg p-3 z-[1000]">
            <div className="text-xs font-semibold mb-2">Legend</div>
            <div className="flex items-center gap-2 text-xs">
              <div className="w-4 h-4 rounded-full bg-purple-500"></div>
              <span>Recipient Location</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
