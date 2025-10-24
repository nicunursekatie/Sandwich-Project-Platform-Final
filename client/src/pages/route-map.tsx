import { useState, useMemo, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import {
  MapPin, Search, AlertCircle, Phone, Mail, Building2, List, ChevronRight, ChevronLeft
} from 'lucide-react';
import { useActivityTracker } from '@/hooks/useActivityTracker';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useAuth } from '@/hooks/useAuth';
import { hasPermission, PERMISSIONS } from '@shared/auth-utils';

// Fix Leaflet default marker icon issue in bundled apps
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

interface HostContactMapData {
  id: number;
  contactName: string;
  role: string;
  hostLocationName: string;
  address: string | null;
  latitude: string;
  longitude: string;
  email: string | null;
  phone: string | null;
}

export default function RouteMapView() {
  const { user } = useAuth();
  const { trackView, trackSearch } = useActivityTracker();
  const [searchTerm, setSearchTerm] = useState('');
  const [isPanelOpen, setIsPanelOpen] = useState(true);

  useEffect(() => {
    trackView(
      'Maps',
      'Maps',
      'Route Map',
      'User accessed route map'
    );
  }, [trackView]);

  // Check permissions
  const canView = hasPermission(user, PERMISSIONS.HOSTS_VIEW);

  // Fetch host contacts with coordinates
  const { data: hosts = [], isLoading, error } = useQuery<HostContactMapData[]>({
    queryKey: ['/api/hosts/map'],
    enabled: canView,
  });

  // Filter host contacts based on search
  const filteredHosts = useMemo(() => {
    if (!searchTerm.trim()) return hosts;
    
    const search = searchTerm.toLowerCase();
    return hosts.filter(contact => 
      contact.contactName.toLowerCase().includes(search) ||
      contact.hostLocationName.toLowerCase().includes(search) ||
      contact.address?.toLowerCase().includes(search)
    );
  }, [hosts, searchTerm]);

  // Calculate map center based on host contacts
  const mapCenter: [number, number] = useMemo(() => {
    if (filteredHosts.length === 0) return [33.7490, -84.3880]; // Atlanta default
    
    const avgLat = filteredHosts.reduce((sum, contact) => sum + parseFloat(contact.latitude), 0) / filteredHosts.length;
    const avgLng = filteredHosts.reduce((sum, contact) => sum + parseFloat(contact.longitude), 0) / filteredHosts.length;
    
    return [avgLat, avgLng];
  }, [filteredHosts]);

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
                  You don't have permission to view the host location map.
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
                  Error Loading Map
                </h2>
                <p className="text-gray-600">
                  Failed to load host locations. Please try again later.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // No hosts with coordinates
  if (hosts.length === 0) {
    return (
      <div className="h-screen flex flex-col">
        <div className="flex-shrink-0 p-4 bg-white border-b border-gray-200">
          <div className="flex items-center gap-4">
            <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-teal-100">
              <MapPin className="w-6 h-6 text-[#007E8C]" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Host Locations Map</h1>
              <p className="text-gray-600">No host locations available</p>
            </div>
          </div>
        </div>
        <div className="flex-1 flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100">
          <Card className="max-w-md mx-4">
            <CardContent className="pt-6">
              <div className="flex flex-col items-center text-center space-y-4">
                <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center">
                  <MapPin className="w-8 h-8 text-gray-400" />
                </div>
                <div>
                  <h2 className="text-xl font-semibold text-gray-900 mb-2">
                    No Locations Found
                  </h2>
                  <p className="text-gray-600">
                    No host locations have coordinates set yet. Add coordinates to hosts to see them on the map.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col">
      {/* Header */}
      <div className="flex-shrink-0 p-4 bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="flex items-center gap-4">
              <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-teal-100">
                <MapPin className="w-6 h-6 text-[#007E8C]" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Host Locations Map</h1>
                <p className="text-sm text-gray-600">{hosts.length} location{hosts.length !== 1 ? 's' : ''} on map</p>
              </div>
            </div>
            
            {/* Search */}
            <div className="flex-1 max-w-md">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  placeholder="Search by name, location, or address..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                  data-testid="input-search-hosts"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content: Side Panel + Map */}
      <div className="flex-1 flex overflow-hidden">
        {/* Host List Panel */}
        <div className={`
          ${isPanelOpen ? 'w-80' : 'w-0'}
          transition-all duration-300 flex-shrink-0 bg-white border-r border-gray-200 flex flex-col
        `}>
          {isPanelOpen && (
            <>
              <div className="p-4 border-b border-gray-200 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <List className="w-5 h-5 text-[#007E8C]" />
                  <h2 className="font-semibold text-gray-900">
                    Host Locations ({filteredHosts.length})
                  </h2>
                </div>
              </div>
              
              <ScrollArea className="flex-1">
                <div className="p-4 space-y-3">
                  {filteredHosts.map(contact => (
                    <Card key={contact.id} className="hover:shadow-md transition-shadow" data-testid={`card-host-${contact.id}`}>
                      <CardContent className="p-4">
                        <div className="space-y-2">
                          <div>
                            <div className="font-semibold text-gray-900">
                              {contact.contactName}
                            </div>
                            <div className="text-sm text-gray-600 flex items-center gap-1">
                              <Building2 className="w-3 h-3" />
                              {contact.hostLocationName}
                            </div>
                          </div>
                          
                          {contact.role && (
                            <Badge variant="outline" className="text-xs">
                              {contact.role}
                            </Badge>
                          )}
                          
                          {contact.address && (
                            <div className="text-xs text-gray-600">
                              📍 {contact.address}
                            </div>
                          )}
                          
                          <div className="space-y-1 pt-2 border-t border-gray-100">
                            {contact.phone && (
                              <div className="flex items-center gap-1 text-xs text-gray-600">
                                <Phone className="w-3 h-3" />
                                <a href={`tel:${contact.phone}`} className="hover:text-[#007E8C]">
                                  {contact.phone}
                                </a>
                              </div>
                            )}
                            {contact.email && (
                              <div className="flex items-center gap-1 text-xs text-gray-600">
                                <Mail className="w-3 h-3" />
                                <a href={`mailto:${contact.email}`} className="hover:text-[#007E8C] break-all">
                                  {contact.email}
                                </a>
                              </div>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </ScrollArea>
            </>
          )}
        </div>

        {/* Toggle Panel Button */}
        <Button
          variant="outline"
          size="sm"
          className="absolute left-0 top-1/2 transform -translate-y-1/2 z-[1000] rounded-r-lg rounded-l-none shadow-md"
          style={{ left: isPanelOpen ? '320px' : '0' }}
          onClick={() => setIsPanelOpen(!isPanelOpen)}
          data-testid="button-toggle-panel"
        >
          {isPanelOpen ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </Button>

        {/* Map */}
        <div className="flex-1 relative">
          <MapContainer
            center={mapCenter}
            zoom={10}
            className="h-full w-full"
            data-testid="map-container"
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />

            {/* Host Contact Markers */}
            {filteredHosts.map(contact => (
              <Marker
                key={contact.id}
                position={[parseFloat(contact.latitude), parseFloat(contact.longitude)]}
                data-testid={`marker-host-${contact.id}`}
              >
                <Popup>
                  <div className="p-2 min-w-[200px]">
                    <div className="font-semibold text-[#007E8C] mb-1">
                      {contact.contactName}
                    </div>
                    <div className="text-sm text-gray-600 mb-2">
                      <Building2 className="inline w-3 h-3 mr-1" />
                      {contact.hostLocationName}
                    </div>
                    {contact.role && (
                      <Badge variant="outline" className="mb-2 text-xs">
                        {contact.role}
                      </Badge>
                    )}
                    {contact.address && (
                      <div className="text-xs text-gray-600 mb-2">
                        {contact.address}
                      </div>
                    )}
                    <div className="space-y-1 pt-2 border-t border-gray-200">
                      {contact.phone && (
                        <div className="flex items-center gap-1 text-xs text-gray-600">
                          <Phone className="w-3 h-3" />
                          <a href={`tel:${contact.phone}`} className="hover:text-[#007E8C]">
                            {contact.phone}
                          </a>
                        </div>
                      )}
                      {contact.email && (
                        <div className="flex items-center gap-1 text-xs text-gray-600">
                          <Mail className="w-3 h-3" />
                          <a href={`mailto:${contact.email}`} className="hover:text-[#007E8C]">
                            {contact.email}
                          </a>
                        </div>
                      )}
                    </div>
                  </div>
                </Popup>
              </Marker>
            ))}
          </MapContainer>

          {/* Filtered Results Info */}
          {searchTerm && (
            <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-[1000] pointer-events-none">
              <div className="bg-white shadow-lg rounded-lg px-4 py-2 border border-gray-200">
                <p className="text-sm text-gray-600">
                  Showing {filteredHosts.length} of {hosts.length} location{hosts.length !== 1 ? 's' : ''}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
