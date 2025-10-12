import { useState, useMemo, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import { MapPin, Search, Users, AlertCircle, Phone, Mail, Building2 } from 'lucide-react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/hooks/useAuth';
import { hasPermission, PERMISSIONS } from '@shared/auth-utils';

// Fix Leaflet default marker icon issue in bundled apps
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Custom marker icon with brand teal color
const customIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

interface HostMapData {
  id: number;
  name: string;
  address: string | null;
  latitude: string;
  longitude: string;
  email: string | null;
  phone: string | null;
}

export default function RouteMapView() {
  const { user } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');

  // Check permission
  const canView = hasPermission(user, PERMISSIONS.HOSTS_VIEW);

  // Fetch hosts with coordinates
  const { data: hosts = [], isLoading, error } = useQuery<HostMapData[]>({
    queryKey: ['/api/hosts/map'],
    enabled: canView,
  });

  // Filter hosts based on search
  const filteredHosts = useMemo(() => {
    if (!searchTerm.trim()) return hosts;
    
    const search = searchTerm.toLowerCase();
    return hosts.filter(host => 
      host.name.toLowerCase().includes(search) ||
      host.address?.toLowerCase().includes(search)
    );
  }, [hosts, searchTerm]);

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
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  // Calculate map center based on hosts
  const mapCenter: [number, number] = useMemo(() => {
    if (filteredHosts.length === 0) return [33.7490, -84.3880]; // Atlanta default
    
    const avgLat = filteredHosts.reduce((sum, host) => sum + parseFloat(host.latitude), 0) / filteredHosts.length;
    const avgLng = filteredHosts.reduce((sum, host) => sum + parseFloat(host.longitude), 0) / filteredHosts.length;
    
    return [avgLat, avgLng];
  }, [filteredHosts]);

  return (
    <div className="h-screen flex flex-col">
      {/* Header */}
      <div className="flex-shrink-0 p-4 bg-white border-b border-gray-200">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 mb-4">
          <div className="flex items-center gap-4 flex-1">
            <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-teal-100">
              <MapPin className="w-6 h-6 text-[#007E8C]" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Host Locations Map</h1>
              <p className="text-gray-600">Interactive map showing all host locations</p>
            </div>
          </div>
          
          <Badge 
            variant="secondary" 
            className="bg-teal-100 text-[#007E8C] hover:bg-teal-200"
            data-testid="badge-host-count"
          >
            <Users className="w-4 h-4 mr-1" />
            {filteredHosts.length} {filteredHosts.length === 1 ? 'Host' : 'Hosts'}
          </Badge>
        </div>

        {/* Search Bar */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
          <Input
            type="text"
            placeholder="Search hosts by name or address..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
            data-testid="input-search-hosts"
          />
        </div>
      </div>

      {/* Map Container */}
      <div className="flex-1 relative">
        {filteredHosts.length === 0 && searchTerm ? (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-50 z-10">
            <Card className="max-w-md mx-4">
              <CardContent className="pt-6">
                <div className="flex flex-col items-center text-center space-y-4">
                  <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center">
                    <Search className="w-8 h-8 text-gray-400" />
                  </div>
                  <div>
                    <h2 className="text-xl font-semibold text-gray-900 mb-2">
                      No Results Found
                    </h2>
                    <p className="text-gray-600">
                      No hosts match your search "{searchTerm}"
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        ) : (
          <MapContainer
            center={mapCenter}
            zoom={10}
            className="h-full w-full"
            style={{ height: 'calc(100vh - 180px)' }}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            
            {filteredHosts.map((host) => (
              <Marker
                key={host.id}
                position={[parseFloat(host.latitude), parseFloat(host.longitude)]}
                icon={customIcon}
              >
                <Popup>
                  <div className="p-2 min-w-[250px]" data-testid={`popup-host-${host.id}`}>
                    <div className="flex items-start gap-2 mb-3">
                      <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-teal-100 flex-shrink-0">
                        <Building2 className="w-5 h-5 text-[#007E8C]" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-gray-900 text-lg">{host.name}</h3>
                        {host.address && (
                          <p className="text-sm text-gray-600 mt-1">{host.address}</p>
                        )}
                      </div>
                    </div>
                    
                    <div className="space-y-2 pt-2 border-t border-gray-200">
                      {host.email && (
                        <div className="flex items-center gap-2 text-sm">
                          <Mail className="w-4 h-4 text-gray-400 flex-shrink-0" />
                          <a 
                            href={`mailto:${host.email}`} 
                            className="text-[#007E8C] hover:underline truncate"
                            data-testid={`link-email-${host.id}`}
                          >
                            {host.email}
                          </a>
                        </div>
                      )}
                      {host.phone && (
                        <div className="flex items-center gap-2 text-sm">
                          <Phone className="w-4 h-4 text-gray-400 flex-shrink-0" />
                          <a 
                            href={`tel:${host.phone}`} 
                            className="text-[#007E8C] hover:underline"
                            data-testid={`link-phone-${host.id}`}
                          >
                            {host.phone}
                          </a>
                        </div>
                      )}
                    </div>
                  </div>
                </Popup>
              </Marker>
            ))}
          </MapContainer>
        )}
      </div>

      {/* Legend/Info Panel */}
      <div className="flex-shrink-0 p-3 bg-white border-t border-gray-200">
        <div className="flex items-center justify-center gap-6 text-sm text-gray-600">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-[#007E8C]"></div>
            <span>Active Host Location</span>
          </div>
          <div className="hidden sm:block text-gray-400">|</div>
          <div className="flex items-center gap-2">
            <MapPin className="w-4 h-4 text-gray-400" />
            <span>Click marker for details</span>
          </div>
        </div>
      </div>
    </div>
  );
}
