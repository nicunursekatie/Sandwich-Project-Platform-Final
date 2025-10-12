import { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { MapContainer, TileLayer, Marker, Popup, Polyline } from 'react-leaflet';
import { 
  MapPin, Search, Users, AlertCircle, Phone, Mail, Building2, 
  Route, X, Loader2, ChevronDown, ChevronUp, ExternalLink, 
  Printer, Copy, Check, Navigation, Car
} from 'lucide-react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { hasPermission, PERMISSIONS } from '@shared/auth-utils';
import { apiRequest } from '@/lib/queryClient';
import type { Driver } from '@shared/schema';

// Fix Leaflet default marker icon issue in bundled apps
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Custom marker icons
const unselectedIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

const selectedIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

// Create numbered marker icons
function createNumberedIcon(number: number): L.DivIcon {
  return L.divIcon({
    className: 'custom-numbered-icon',
    html: `
      <div style="
        background-color: #007E8C;
        color: white;
        width: 32px;
        height: 32px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-weight: bold;
        font-size: 14px;
        border: 3px solid white;
        box-shadow: 0 2px 6px rgba(0,0,0,0.3);
      ">${number}</div>
    `,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
  });
}

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

interface OptimizedRoute {
  optimizedOrder: Array<{ id: number; name: string; position: number }>;
  totalDistance: number;
  unit: string;
  algorithm: string;
}

export default function RouteMapView() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedHostIds, setSelectedHostIds] = useState<Set<number>>(new Set());
  const [selectedDriverId, setSelectedDriverId] = useState<string>('');
  const [optimizedRoute, setOptimizedRoute] = useState<OptimizedRoute | null>(null);
  const [isPanelOpen, setIsPanelOpen] = useState(true);
  const [copiedToClipboard, setCopiedToClipboard] = useState(false);

  // Check permissions
  const canView = hasPermission(user, PERMISSIONS.HOSTS_VIEW);
  const canOptimize = hasPermission(user, PERMISSIONS.DRIVERS_VIEW);

  // Fetch host contacts with coordinates
  const { data: hosts = [], isLoading, error } = useQuery<HostContactMapData[]>({
    queryKey: ['/api/hosts/map'],
    enabled: canView,
  });

  // Fetch drivers
  const { data: drivers = [] } = useQuery<Driver[]>({
    queryKey: ['/api/drivers'],
    enabled: canOptimize,
  });

  // Active drivers only
  const activeDrivers = useMemo(() => 
    drivers.filter(d => d.isActive), 
    [drivers]
  );

  // Optimize route mutation
  const optimizeMutation = useMutation({
    mutationFn: (data: { hostIds: number[]; driverId?: string }) =>
      apiRequest('POST', '/api/routes/optimize', data),
    onSuccess: (data: OptimizedRoute) => {
      setOptimizedRoute(data);
      toast({
        title: 'Route Optimized',
        description: `Optimized route with ${data.optimizedOrder.length} stops, ${data.totalDistance} ${data.unit} total distance.`,
      });
    },
    onError: (error) => {
      toast({
        title: 'Optimization Failed',
        description: 'Could not optimize route. Please try again.',
        variant: 'destructive',
      });
    },
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

  // Get selected hosts data
  const selectedHosts = useMemo(() => 
    hosts.filter(h => selectedHostIds.has(h.id)),
    [hosts, selectedHostIds]
  );

  // Toggle host selection
  const toggleHostSelection = (hostId: number) => {
    setSelectedHostIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(hostId)) {
        newSet.delete(hostId);
      } else {
        newSet.add(hostId);
      }
      return newSet;
    });
  };

  // Clear all selections
  const clearSelection = () => {
    setSelectedHostIds(new Set());
    setOptimizedRoute(null);
  };

  // Optimize route
  const handleOptimizeRoute = () => {
    if (selectedHostIds.size === 0) {
      toast({
        title: 'No Hosts Selected',
        description: 'Please select at least one host to optimize the route.',
        variant: 'destructive',
      });
      return;
    }

    optimizeMutation.mutate({
      hostIds: Array.from(selectedHostIds),
      driverId: selectedDriverId || undefined,
    });
  };

  // Export to Google Maps
  const exportToGoogleMaps = () => {
    if (!optimizedRoute || optimizedRoute.optimizedOrder.length === 0) return;

    const waypoints = optimizedRoute.optimizedOrder
      .map(stop => {
        const host = hosts.find(h => h.id === stop.id);
        if (!host) return null;
        return `${host.latitude},${host.longitude}`;
      })
      .filter(Boolean)
      .join('/');

    const url = `https://www.google.com/maps/dir/${waypoints}`;
    window.open(url, '_blank');
  };

  // Print route
  const printRoute = () => {
    if (!optimizedRoute) return;

    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const routeDetails = optimizedRoute.optimizedOrder
      .map((stop, idx) => {
        const host = hosts.find(h => h.id === stop.id);
        return `
          <div style="margin: 12px 0; padding: 12px; border: 1px solid #ddd; border-radius: 6px;">
            <div style="font-weight: bold; color: #007E8C;">Stop ${idx + 1}: ${host?.contactName || 'Unknown'} - ${host?.hostLocationName || 'Unknown Location'}</div>
            <div style="margin-top: 4px; color: #666;">${host?.address || 'No address'}</div>
          </div>
        `;
      })
      .join('');

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Route Plan - The Sandwich Project</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; }
            h1 { color: #007E8C; }
            .summary { background: #f0f9ff; padding: 12px; border-radius: 6px; margin: 20px 0; }
          </style>
        </head>
        <body>
          <h1>Optimized Route Plan</h1>
          <div class="summary">
            <strong>Total Distance:</strong> ${optimizedRoute.totalDistance} ${optimizedRoute.unit}<br/>
            <strong>Total Stops:</strong> ${optimizedRoute.optimizedOrder.length}<br/>
            <strong>Driver:</strong> ${drivers.find(d => d.id.toString() === selectedDriverId)?.name || 'Not assigned'}
          </div>
          <h2>Route Details</h2>
          ${routeDetails}
          <p style="margin-top: 30px; color: #666; font-size: 12px;">
            Generated by The Sandwich Project Route Planner
          </p>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.print();
  };

  // Copy route to clipboard
  const copyToClipboard = async () => {
    if (!optimizedRoute) return;

    const routeText = optimizedRoute.optimizedOrder
      .map((stop, idx) => {
        const host = hosts.find(h => h.id === stop.id);
        return `Stop ${idx + 1}: ${host?.contactName || 'Unknown'} - ${host?.hostLocationName || 'Unknown Location'}\n${host?.address || 'No address'}`;
      })
      .join('\n\n');

    const fullText = `Optimized Route Plan
Total Distance: ${optimizedRoute.totalDistance} ${optimizedRoute.unit}
Total Stops: ${optimizedRoute.optimizedOrder.length}
Driver: ${drivers.find(d => d.id.toString() === selectedDriverId)?.name || 'Not assigned'}

${routeText}`;

    try {
      await navigator.clipboard.writeText(fullText);
      setCopiedToClipboard(true);
      toast({
        title: 'Copied to Clipboard',
        description: 'Route details have been copied.',
      });
      setTimeout(() => setCopiedToClipboard(false), 2000);
    } catch (err) {
      toast({
        title: 'Copy Failed',
        description: 'Could not copy to clipboard.',
        variant: 'destructive',
      });
    }
  };

  // Calculate map center based on host contacts or optimized route
  const mapCenter: [number, number] = useMemo(() => {
    const contactsToCenter = optimizedRoute 
      ? optimizedRoute.optimizedOrder.map(stop => hosts.find(h => h.id === stop.id)).filter(Boolean) as HostContactMapData[]
      : filteredHosts;
    
    if (contactsToCenter.length === 0) return [33.7490, -84.3880]; // Atlanta default
    
    const avgLat = contactsToCenter.reduce((sum, contact) => sum + parseFloat(contact.latitude), 0) / contactsToCenter.length;
    const avgLng = contactsToCenter.reduce((sum, contact) => sum + parseFloat(contact.longitude), 0) / contactsToCenter.length;
    
    return [avgLat, avgLng];
  }, [filteredHosts, optimizedRoute, hosts]);

  // Create polyline coordinates for optimized route
  const routePolyline: [number, number][] = useMemo(() => {
    if (!optimizedRoute) return [];
    
    return optimizedRoute.optimizedOrder
      .map(stop => {
        const host = hosts.find(h => h.id === stop.id);
        if (!host) return null;
        return [parseFloat(host.latitude), parseFloat(host.longitude)] as [number, number];
      })
      .filter(Boolean) as [number, number][];
  }, [optimizedRoute, hosts]);

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
    <div className="h-screen flex flex-col lg:flex-row">
      {/* Route Planning Panel - Side panel on desktop, bottom sheet on mobile */}
      <div className={`
        lg:w-96 lg:flex-shrink-0 lg:border-r lg:border-gray-200 bg-white
        ${isPanelOpen ? 'block' : 'hidden lg:block'}
        order-2 lg:order-1
      `}>
        <div className="h-full flex flex-col">
          {/* Panel Header */}
          <div className="flex-shrink-0 p-4 border-b border-gray-200">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <Route className="w-5 h-5 text-[#007E8C]" />
                Route Planning
              </h2>
              <Button
                variant="ghost"
                size="sm"
                className="lg:hidden"
                onClick={() => setIsPanelOpen(false)}
                data-testid="button-close-panel"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>

            {/* Selected Hosts Summary */}
            {selectedHostIds.size > 0 && (
              <div className="flex items-center justify-between gap-2 p-3 bg-teal-50 rounded-lg">
                <div className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-[#007E8C]" />
                  <span className="text-sm font-medium text-gray-900">
                    {selectedHostIds.size} host{selectedHostIds.size !== 1 ? 's' : ''} selected
                  </span>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearSelection}
                  data-testid="button-clear-selection"
                  className="h-7 text-xs"
                >
                  Clear
                </Button>
              </div>
            )}
          </div>

          {/* Panel Content */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {/* Driver Selection */}
            {canOptimize && (
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">
                  Assign Driver
                </label>
                <Select value={selectedDriverId} onValueChange={setSelectedDriverId}>
                  <SelectTrigger data-testid="select-driver">
                    <SelectValue placeholder="Select a driver" />
                  </SelectTrigger>
                  <SelectContent>
                    {activeDrivers.map(driver => (
                      <SelectItem 
                        key={driver.id} 
                        value={driver.id.toString()}
                        data-testid={`option-driver-${driver.id}`}
                      >
                        {driver.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Optimize Button */}
            <Button
              className="w-full bg-[#007E8C] hover:bg-[#006270]"
              onClick={handleOptimizeRoute}
              disabled={selectedHostIds.size === 0 || optimizeMutation.isPending}
              data-testid="button-optimize-route"
            >
              {optimizeMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Optimizing...
                </>
              ) : (
                <>
                  <Navigation className="w-4 h-4 mr-2" />
                  Optimize Route
                </>
              )}
            </Button>

            {/* Optimized Route Display */}
            {optimizedRoute && (
              <Card className="border-[#007E8C]">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center justify-between">
                    <span>Optimized Route</span>
                    <Badge className="bg-[#007E8C]">
                      {optimizedRoute.totalDistance} {optimizedRoute.unit}
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {/* Route Stops */}
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {optimizedRoute.optimizedOrder.map((stop, idx) => {
                      const host = hosts.find(h => h.id === stop.id);
                      return (
                        <div 
                          key={stop.id}
                          className="flex items-start gap-3 p-2 bg-gray-50 rounded-lg"
                          data-testid={`route-stop-${idx + 1}`}
                        >
                          <div className="flex items-center justify-center w-6 h-6 rounded-full bg-[#007E8C] text-white text-xs font-bold flex-shrink-0">
                            {idx + 1}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-sm text-gray-900 truncate">
                              {host?.contactName || 'Unknown'} - {host?.hostLocationName || 'Unknown Location'}
                            </div>
                            <div className="text-xs text-gray-500 truncate">
                              {host?.address || 'No address'}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Route Actions */}
                  <div className="space-y-2 pt-3 border-t border-gray-200">
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full justify-start"
                      onClick={exportToGoogleMaps}
                      data-testid="button-export-google-maps"
                    >
                      <ExternalLink className="w-4 h-4 mr-2" />
                      Open in Google Maps
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full justify-start"
                      onClick={printRoute}
                      data-testid="button-print-route"
                    >
                      <Printer className="w-4 h-4 mr-2" />
                      Print Route
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full justify-start"
                      onClick={copyToClipboard}
                      data-testid="button-copy-route"
                    >
                      {copiedToClipboard ? (
                        <Check className="w-4 h-4 mr-2 text-green-600" />
                      ) : (
                        <Copy className="w-4 h-4 mr-2" />
                      )}
                      {copiedToClipboard ? 'Copied!' : 'Copy to Clipboard'}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Selected Hosts List */}
            {selectedHostIds.size > 0 && !optimizedRoute && (
              <div className="space-y-2">
                <h3 className="text-sm font-medium text-gray-700">Selected Hosts</h3>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {selectedHosts.map(contact => (
                    <div 
                      key={contact.id}
                      className="flex items-center justify-between p-2 bg-gray-50 rounded-lg"
                      data-testid={`selected-host-${contact.id}`}
                    >
                      <span className="text-sm text-gray-900 truncate flex-1">
                        {contact.contactName} - {contact.hostLocationName}
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleHostSelection(contact.id)}
                        className="h-6 w-6 p-0"
                        data-testid={`button-remove-host-${contact.id}`}
                      >
                        <X className="w-3 h-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Map Section */}
      <div className="flex-1 flex flex-col order-1 lg:order-2">
        {/* Header */}
        <div className="flex-shrink-0 p-4 bg-white border-b border-gray-200">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 mb-4">
            <div className="flex items-center gap-4 flex-1">
              <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-teal-100">
                <MapPin className="w-6 h-6 text-[#007E8C]" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Host Locations Map</h1>
                <p className="text-gray-600 text-sm">Select hosts to plan delivery route</p>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <Badge 
                variant="secondary" 
                className="bg-teal-100 text-[#007E8C] hover:bg-teal-200"
                data-testid="badge-host-count"
              >
                <Users className="w-4 h-4 mr-1" />
                {filteredHosts.length} {filteredHosts.length === 1 ? 'Host' : 'Hosts'}
              </Badge>
              <Button
                variant="outline"
                size="sm"
                className="lg:hidden"
                onClick={() => setIsPanelOpen(true)}
                data-testid="button-open-panel"
              >
                {isPanelOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </Button>
            </div>
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
              
              {/* Draw route polyline if optimized */}
              {routePolyline.length > 0 && (
                <Polyline
                  positions={routePolyline}
                  color="#007E8C"
                  weight={4}
                  opacity={0.8}
                />
              )}

              {/* Host markers */}
              {filteredHosts.map((host) => {
                const isSelected = selectedHostIds.has(host.id);
                const routeStop = optimizedRoute?.optimizedOrder.find(s => s.id === host.id);
                
                return (
                  <Marker
                    key={host.id}
                    position={[parseFloat(host.latitude), parseFloat(host.longitude)]}
                    icon={routeStop ? createNumberedIcon(routeStop.position) : (isSelected ? selectedIcon : unselectedIcon)}
                  >
                    <Popup>
                      <div className="p-2 min-w-[250px]" data-testid={`popup-host-${host.id}`}>
                        {/* Selection Checkbox */}
                        <div className="flex items-center gap-2 mb-3 pb-3 border-b border-gray-200">
                          <Checkbox
                            id={`select-host-${host.id}`}
                            checked={isSelected}
                            onCheckedChange={() => toggleHostSelection(host.id)}
                            data-testid={`checkbox-host-${host.id}`}
                          />
                          <label 
                            htmlFor={`select-host-${host.id}`}
                            className="text-sm font-medium text-gray-700 cursor-pointer"
                          >
                            {isSelected ? 'Selected for route' : 'Add to route'}
                          </label>
                        </div>

                        <div className="flex items-start gap-2 mb-3">
                          <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-teal-100 flex-shrink-0">
                            <Building2 className="w-5 h-5 text-[#007E8C]" />
                          </div>
                          <div>
                            <h3 className="font-semibold text-gray-900 text-lg">{host.contactName}</h3>
                            <p className="text-sm text-[#007E8C] font-medium">{host.hostLocationName}</p>
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
                );
              })}
            </MapContainer>
          )}
        </div>

        {/* Legend/Info Panel */}
        <div className="flex-shrink-0 p-3 bg-white border-t border-gray-200">
          <div className="flex items-center justify-center gap-4 sm:gap-6 text-xs sm:text-sm text-gray-600 flex-wrap">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: '#4285F4' }}></div>
              <span>Unselected</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: '#34A853' }}></div>
              <span>Selected</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 rounded-full bg-[#007E8C] text-white text-[10px] flex items-center justify-center font-bold">1</div>
              <span>Route Order</span>
            </div>
            <div className="hidden sm:block text-gray-400">|</div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-0.5 bg-[#007E8C]"></div>
              <span>Optimized Route</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
