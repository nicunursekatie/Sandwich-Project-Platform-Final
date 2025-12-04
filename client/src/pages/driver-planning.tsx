import React, { useState, useMemo, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';

import {
  MapPin, Calendar, Package, Phone, AlertCircle,
  ChevronRight, RefreshCw, Clock, Truck,
  Users, Copy, Check, Building2
} from 'lucide-react';
import { useLocation } from 'wouter';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'react-leaflet-cluster/dist/assets/MarkerCluster.css';
import 'react-leaflet-cluster/dist/assets/MarkerCluster.Default.css';
import { format, addWeeks, isAfter, isBefore, startOfDay } from 'date-fns';
import { PageBreadcrumbs } from '@/components/page-breadcrumbs';

import { Card, CardContent } from '@/components/ui/card';
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
import { useToast } from '@/hooks/use-toast';

// Fix Leaflet default marker icon issue
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Helper function to parse date strings as local dates
const parseLocalDate = (dateString: string): Date => {
  const [year, month, day] = dateString.split('T')[0].split('-').map(Number);
  return new Date(year, month - 1, day);
};

// Haversine formula for accurate distance calculation between coordinates
const calculateDistanceInMiles = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
  const toRad = (deg: number) => deg * Math.PI / 180;
  const R = 3959; // Earth's radius in miles

  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * 
            Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
};

// Types
interface EventMapData {
  id: number;
  organizationName: string | null;
  organizationCategory: string | null;
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
  driversNeeded: number | null;
  assignedDriverIds: string[] | null;
  sandwichTypes: { type: string; quantity: number }[] | null;
  pickupTime: string | null;
  pickupTimeWindow: string | null;
}

interface Driver {
  id: number;
  name: string;
  email: string | null;
  phone: string | null;
  vehicleType: string | null;
  vanApproved: boolean | null;
  isActive: boolean | null;
  availability: string | null;
  area: string | null;
  zone: string | null;
  hostLocation: string | null;
  routeDescription: string | null;
  homeAddress: string | null;
}

interface Host {
  id: number;
  name: string;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  status: string | null;
}

// Custom marker icons
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

const eventIcon = createColorIcon('blue');
const selectedEventIcon = createColorIcon('red');
const hostIcon = createColorIcon('green');

// Format time to 12-hour format
const formatTime12Hour = (time: string | null): string => {
  if (!time) return '';
  try {
    const [hours, minutes] = time.split(':').map(Number);
    if (Number.isNaN(hours) || Number.isNaN(minutes)) {
      console.error('Failed to parse time (NaN):', time);
      return 'Invalid time';
    }
    const period = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours % 12 || 12;
    return `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`;
  } catch (error) {
    console.error('Failed to parse time:', time, error);
    return 'Invalid time';
  }
};

// Extract city from address
const extractCityFromAddress = (address: string | null): string | null => {
  if (!address) return null;
  // Common patterns: "123 Main St, Atlanta, GA 30301" or "123 Main St, Atlanta GA 30301"
  const parts = address.split(',').map(p => p.trim());
  if (parts.length >= 2) {
    // City is usually the second-to-last part before state/zip
    const cityPart = parts[parts.length - 2];
    // Remove any numbers (zip codes that might be attached)
    return cityPart.replace(/\d+/g, '').trim();
  }
  return null;
};

/**
 * City abbreviation mappings for location matching.
 * Maps full city names (lowercase) to an array of common abbreviations.
 * Used by locationMatchesCity() to match driver locations to event cities
 * when users enter abbreviated or shorthand location names.
 */
const CITY_ABBREVIATIONS: Record<string, string[]> = {
  'sandy springs': ['ss'],
  'alpharetta': ['alpha'],
  // Add more as needed
};

// Check if a location string matches a city (including abbreviations)
const locationMatchesCity = (location: string, city: string): boolean => {
  const locLower = location.toLowerCase();
  const cityLower = city.toLowerCase();
  
  // Direct match
  if (locLower.includes(cityLower) || cityLower.includes(locLower)) {
    return true;
  }
  
  // Check abbreviations for the city
  const cityAbbrevs = CITY_ABBREVIATIONS[cityLower] || [];
  if (cityAbbrevs.some(abbrev => locLower.includes(abbrev))) {
    return true;
  }
  
  // Check if location is an abbreviation that matches the city
  for (const [fullName, abbrevs] of Object.entries(CITY_ABBREVIATIONS)) {
    if (abbrevs.some(abbrev => locLower.includes(abbrev)) && cityLower.includes(fullName)) {
      return true;
    }
    if (locLower.includes(fullName) && abbrevs.some(abbrev => cityLower.includes(abbrev))) {
      return true;
    }
  }
  
  return false;
};

// Check if driver location matches event area
const doesDriverMatchEventArea = (driver: Driver, eventAddress: string | null): boolean => {
  if (!eventAddress) return false;

  const eventCity = extractCityFromAddress(eventAddress);
  if (!eventCity) return false;

  // Check all driver location fields
  const driverLocations = [
    driver.hostLocation,
    driver.area,
    driver.zone,
    driver.routeDescription,
    driver.homeAddress
  ].filter(Boolean) as string[];

  // Check if any driver location matches the event city
  return driverLocations.some(loc => locationMatchesCity(loc, eventCity));
};

// Component to center map on selected event
function MapController({ selectedEvent, events }: { selectedEvent: EventMapData | null; events: EventMapData[] }) {
  const map = useMap();

  useEffect(() => {
    if (selectedEvent?.latitude && selectedEvent?.longitude) {
      map.setView(
        [parseFloat(selectedEvent.latitude), parseFloat(selectedEvent.longitude)],
        14,
        { animate: true }
      );
    } else if (events.length > 0) {
      // Fit to all events
      const validEvents = events.filter(e => e.latitude && e.longitude);
      if (validEvents.length > 0) {
        const bounds = L.latLngBounds(
          validEvents.map(e => [parseFloat(e.latitude!), parseFloat(e.longitude!)])
        );
        map.fitBounds(bounds, { padding: [50, 50] });
      }
    }
  }, [selectedEvent, events, map]);

  return null;
}

// Generate SMS message for driver outreach
const generateDriverSMS = (event: EventMapData, driver: Driver): string => {
  const eventDate = event.scheduledEventDate || event.desiredEventDate;
  const formattedDate = eventDate ? format(parseLocalDate(eventDate), 'EEEE, MMMM d') : 'TBD';
  const time = event.pickupTime || event.eventStartTime;
  const formattedTime = time ? formatTime12Hour(time) : 'TBD';
  const location = event.eventAddress || 'TBD';
  const sandwichCount = event.estimatedSandwichCount || 'TBD';
  const firstName = driver.name?.split(' ')[0] || 'there';

  return `Hi ${firstName}! We have a sandwich event coming up and would love your help! 🥪

📅 ${formattedDate}
⏰ Pickup around ${formattedTime}
📍 ${location}
🥪 ~${sandwichCount} sandwiches

Would you be available to help with delivery? Let me know and I'll send you the details!

Thanks so much!
- The Sandwich Project Team`;
};

export default function DriverPlanningDashboard() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [selectedEvent, setSelectedEvent] = useState<EventMapData | null>(null);
  const [weeksAhead, setWeeksAhead] = useState<string>('4');
  const [copiedDriverId, setCopiedDriverId] = useState<number | null>(null);

  // Fetch events
  const { data: allEvents = [], isLoading: eventsLoading, refetch: refetchEvents } = useQuery<EventMapData[]>({
    queryKey: ['/api/event-map'],
    queryFn: async () => {
      const response = await fetch('/api/event-map');
      if (!response.ok) throw new Error('Failed to fetch events');
      return response.json();
    },
  });

  // Fetch drivers
  const { data: drivers = [], isLoading: driversLoading } = useQuery<Driver[]>({
    queryKey: ['/api/drivers'],
    queryFn: async () => {
      const response = await fetch('/api/drivers');
      if (!response.ok) throw new Error('Failed to fetch drivers');
      return response.json();
    },
  });

  // Fetch hosts
  const { data: hosts = [] } = useQuery<Host[]>({
    queryKey: ['/api/hosts'],
    queryFn: async () => {
      const response = await fetch('/api/hosts');
      if (!response.ok) throw new Error('Failed to fetch hosts');
      return response.json();
    },
  });

  // Filter events to upcoming scheduled events within selected weeks
  const upcomingEvents = useMemo(() => {
    const today = startOfDay(new Date());
    const endDate = addWeeks(today, parseInt(weeksAhead));

    return allEvents
      .filter(event => {
        // Must have coordinates
        if (!event.latitude || !event.longitude) return false;

        // Must be scheduled status
        if (event.status !== 'scheduled') return false;

        // Must have a date
        const dateStr = event.scheduledEventDate || event.desiredEventDate;
        if (!dateStr) return false;

        const eventDate = parseLocalDate(dateStr);
        return isAfter(eventDate, today) && isBefore(eventDate, endDate);
      })
      .sort((a, b) => {
        const dateA = parseLocalDate(a.scheduledEventDate || a.desiredEventDate!);
        const dateB = parseLocalDate(b.scheduledEventDate || b.desiredEventDate!);
        return dateA.getTime() - dateB.getTime();
      });
  }, [allEvents, weeksAhead]);

  // Get active drivers
  const activeDrivers = useMemo(() => {
    return drivers.filter(d => d.isActive);
  }, [drivers]);

  // Get suggested drivers for selected event
  const suggestedDrivers = useMemo(() => {
    if (!selectedEvent) return [];

    return activeDrivers
      .filter(driver => {
        // Check if driver has any location info at all
        const hasLocation = driver.hostLocation || driver.area || driver.zone || driver.routeDescription || driver.homeAddress;
        if (!hasLocation) return false;

        // Check if driver matches event area
        return doesDriverMatchEventArea(driver, selectedEvent.eventAddress);
      })
      .sort((a, b) => {
        // Sort by availability (available first)
        if (a.availability === 'available' && b.availability !== 'available') return -1;
        if (b.availability === 'available' && a.availability !== 'available') return 1;
        return (a.name || '').localeCompare(b.name || '');
      });
  }, [selectedEvent, activeDrivers]);

  // Get drivers without location data
  const driversWithoutLocation = useMemo(() => {
    return activeDrivers.filter(driver =>
      !driver.hostLocation && !driver.area && !driver.zone && !driver.routeDescription && !driver.homeAddress
    );
  }, [activeDrivers]);

  // Get nearby hosts for selected event
  const nearbyHosts = useMemo(() => {
    if (!selectedEvent?.latitude || !selectedEvent?.longitude) return [];

    const eventLat = parseFloat(selectedEvent.latitude);
    const eventLng = parseFloat(selectedEvent.longitude);

    return hosts
      .filter(host => host.latitude && host.longitude && host.status === 'active')
      .map(host => {
        const distance = calculateDistanceInMiles(eventLat, eventLng, host.latitude!, host.longitude!);
        return { ...host, distance };
      })
      .filter(host => host.distance < 10) // Within 10 miles
      .sort((a, b) => a.distance - b.distance)
      .slice(0, 5);
  }, [selectedEvent, hosts]);

  // Copy SMS to clipboard
  const copyDriverSMS = async (driver: Driver) => {
    if (!selectedEvent) return;

    const sms = generateDriverSMS(selectedEvent, driver);
    try {
      await navigator.clipboard.writeText(sms);
      setCopiedDriverId(driver.id);
      toast({
        title: 'Copied!',
        description: `SMS message for ${driver.name} copied to clipboard`,
      });
      setTimeout(() => setCopiedDriverId(null), 2000);
    } catch (error) {
      console.error('Failed to copy to clipboard:', error);
      toast({
        title: 'Copy failed',
        description: 'Unable to copy to clipboard. Please try again.',
        variant: 'destructive',
      });
    }
  };

  // Map center
  const mapCenter: [number, number] = useMemo(() => {
    if (upcomingEvents.length === 0) return [33.7490, -84.3880]; // Atlanta default

    const avgLat = upcomingEvents.reduce((sum, e) => sum + parseFloat(e.latitude!), 0) / upcomingEvents.length;
    const avgLng = upcomingEvents.reduce((sum, e) => sum + parseFloat(e.longitude!), 0) / upcomingEvents.length;

    return [avgLat, avgLng];
  }, [upcomingEvents]);

  const isLoading = eventsLoading || driversLoading;

  if (isLoading) {
    return (
      <div className="h-[calc(100vh-200px)] flex items-center justify-center">
        <div className="text-center">
          <Skeleton className="h-12 w-12 rounded-full mx-auto mb-4" />
          <Skeleton className="h-6 w-48 mx-auto" />
        </div>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-140px)] flex flex-col">
      {/* Header */}
      <div className="flex-shrink-0 p-4 bg-white border-b">
        <PageBreadcrumbs
          segments={[
            { label: 'Event Planning', href: '/dashboard?section=event-requests' },
            { label: 'Driver Planning' }
          ]}
        />
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#007E8C] to-[#005f6b] flex items-center justify-center">
              <Truck className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Driver Planning</h1>
              <p className="text-sm text-gray-600">
                {upcomingEvents.length} upcoming event{upcomingEvents.length !== 1 ? 's' : ''} needing drivers
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Select value={weeksAhead} onValueChange={setWeeksAhead}>
              <SelectTrigger className="w-40">
                <Calendar className="w-4 h-4 mr-2" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="2">Next 2 weeks</SelectItem>
                <SelectItem value="4">Next 4 weeks</SelectItem>
                <SelectItem value="6">Next 6 weeks</SelectItem>
                <SelectItem value="8">Next 8 weeks</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" onClick={() => refetchEvents()}>
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content - 3 Panels */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Panel - Event List */}
        <div className="w-80 border-r bg-gray-50 flex flex-col">
          <div className="p-3 border-b bg-white">
            <h2 className="font-semibold text-gray-900 flex items-center gap-2">
              <Calendar className="w-5 h-5 text-[#007E8C]" />
              Upcoming Events ({upcomingEvents.length})
            </h2>
          </div>
          <ScrollArea className="flex-1">
            <div className="p-3 space-y-2">
              {upcomingEvents.map((event) => {
                const isSelected = selectedEvent?.id === event.id;
                const eventDate = event.scheduledEventDate || event.desiredEventDate;
                const driversAssigned = event.assignedDriverIds?.length || 0;
                const driversNeeded = event.driversNeeded || 1;

                return (
                  <Card
                    key={event.id}
                    className={`p-3 cursor-pointer transition-all ${
                      isSelected
                        ? 'ring-2 ring-[#007E8C] bg-[#007E8C]/5'
                        : 'hover:shadow-md hover:bg-white'
                    }`}
                    onClick={() => setSelectedEvent(isSelected ? null : event)}
                  >
                    <div className="space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="font-medium text-sm text-gray-900 line-clamp-1">
                          {event.organizationName || 'Unknown Organization'}
                        </h3>
                        <ChevronRight className={`w-4 h-4 text-gray-400 flex-shrink-0 transition-transform ${isSelected ? 'rotate-90' : ''}`} />
                      </div>

                      {/* Date */}
                      <div className="flex items-center gap-1.5 text-xs text-gray-700">
                        <Calendar className="w-3.5 h-3.5 flex-shrink-0" />
                        <span className="font-medium">
                          {eventDate ? format(parseLocalDate(eventDate), 'EEE, MMM d') : 'No date'}
                        </span>
                        {event.eventStartTime && (
                          <span className="text-gray-500">
                            at {formatTime12Hour(event.eventStartTime)}
                          </span>
                        )}
                      </div>

                      {/* Sandwich count */}
                      {event.estimatedSandwichCount && (
                        <div className="flex items-center gap-1.5 text-xs text-gray-600">
                          <Package className="w-3.5 h-3.5 flex-shrink-0" />
                          <span>~{event.estimatedSandwichCount} sandwiches</span>
                        </div>
                      )}

                      {/* Location */}
                      <div className="flex items-center gap-1.5 text-xs text-gray-500">
                        <MapPin className="w-3.5 h-3.5 flex-shrink-0" />
                        <span className="line-clamp-1">{extractCityFromAddress(event.eventAddress) || event.eventAddress}</span>
                      </div>

                      {/* Driver status */}
                      <div className="flex items-center gap-2">
                        <Badge
                          variant={driversAssigned >= driversNeeded ? 'default' : 'destructive'}
                          className="text-xs"
                        >
                          <Truck className="w-3 h-3 mr-1" />
                          {driversAssigned}/{driversNeeded} drivers
                        </Badge>
                      </div>
                    </div>
                  </Card>
                );
              })}

              {upcomingEvents.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  <Calendar className="w-12 h-12 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">No scheduled events in this period</p>
                </div>
              )}
            </div>
          </ScrollArea>
        </div>

        {/* Center Panel - Map */}
        <div className="flex-1 relative">
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
            <MapController selectedEvent={selectedEvent} events={upcomingEvents} />

            {/* Event markers */}
            {upcomingEvents.map((event) => (
              <Marker
                key={event.id}
                position={[parseFloat(event.latitude!), parseFloat(event.longitude!)]}
                icon={selectedEvent?.id === event.id ? selectedEventIcon : eventIcon}
                eventHandlers={{
                  click: () => setSelectedEvent(event)
                }}
              >
                <Popup>
                  <div className="p-2 min-w-[200px]">
                    <h3 className="font-semibold">{event.organizationName}</h3>
                    <p className="text-sm text-gray-600">{event.eventAddress}</p>
                    {event.estimatedSandwichCount && (
                      <p className="text-sm">~{event.estimatedSandwichCount} sandwiches</p>
                    )}
                  </div>
                </Popup>
              </Marker>
            ))}

            {/* Nearby host markers when event selected */}
            {selectedEvent && nearbyHosts.map((host) => (
              <Marker
                key={`host-${host.id}`}
                position={[host.latitude!, host.longitude!]}
                icon={hostIcon}
              >
                <Popup>
                  <div className="p-2">
                    <h3 className="font-semibold">{host.name}</h3>
                    <p className="text-sm text-gray-600">{host.address}</p>
                    <p className="text-xs text-gray-500">{host.distance.toFixed(1)} miles away</p>
                  </div>
                </Popup>
              </Marker>
            ))}
          </MapContainer>

          {/* Map legend */}
          <div className="absolute bottom-4 left-4 bg-white rounded-lg shadow-lg p-3 z-[1000]">
            <div className="text-xs font-semibold mb-2">Legend</div>
            <div className="space-y-1 text-xs">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-blue-500" />
                <span>Event</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-red-500" />
                <span>Selected Event</span>
              </div>
              {selectedEvent && (
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-green-500" />
                  <span>Nearby Host</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Panel - Driver Suggestions */}
        <div className="w-96 border-l bg-gray-50 flex flex-col">
          <div className="p-3 border-b bg-white">
            <h2 className="font-semibold text-gray-900 flex items-center gap-2">
              <Users className="w-5 h-5 text-[#007E8C]" />
              {selectedEvent ? 'Suggested Drivers' : 'Select an Event'}
            </h2>
            {selectedEvent && (
              <p className="text-xs text-gray-600 mt-1">
                For: {selectedEvent.organizationName}
              </p>
            )}
          </div>

          <ScrollArea className="flex-1">
            {!selectedEvent ? (
              <div className="p-6 text-center text-gray-500">
                <Truck className="w-16 h-16 mx-auto mb-3 opacity-20" />
                <p className="text-sm font-medium">No event selected</p>
                <p className="text-xs mt-1">Click an event from the list to see suggested drivers and nearby hosts</p>
              </div>
            ) : (
              <div className="p-3 space-y-4">
                {/* Nearby Hosts - Show first and always visible */}
                <div>
                  <h3 className="text-xs font-semibold text-gray-700 uppercase tracking-wide mb-2 flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-green-600" />
                    Nearby Host Locations
                  </h3>
                  {nearbyHosts.length > 0 ? (
                    <div className="space-y-2">
                      {nearbyHosts.map((host) => (
                        <div key={host.id} className="flex items-center justify-between text-xs p-2 bg-green-50 border border-green-200 rounded">
                          <div className="flex items-center gap-2">
                            <Building2 className="w-3.5 h-3.5 text-green-600" />
                            <span className="font-medium">{host.name}</span>
                          </div>
                          <span className="text-green-700">{host.distance.toFixed(1)} mi</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-xs p-3 bg-gray-100 rounded text-gray-500 text-center">
                      No hosts with map coordinates found nearby.
                      <br />
                      <span className="text-gray-400">Add coordinates in Host Management to see them here.</span>
                    </div>
                  )}
                </div>

                {/* Suggested Drivers */}
                {suggestedDrivers.length > 0 ? (
                  <div className="space-y-2">
                    <h3 className="text-xs font-semibold text-gray-700 uppercase tracking-wide">
                      Drivers in this area ({suggestedDrivers.length})
                    </h3>
                    {suggestedDrivers.map((driver) => (
                      <Card key={driver.id} className="p-3">
                        <div className="space-y-2">
                          <div className="flex items-start justify-between">
                            <div>
                              <h4 className="font-medium text-sm">{driver.name}</h4>
                              <p className="text-xs text-gray-500">
                                {driver.hostLocation || driver.area || driver.routeDescription || 'No location'}
                              </p>
                            </div>
                            <Badge
                              variant={driver.availability === 'available' ? 'default' : 'secondary'}
                              className="text-xs"
                            >
                              {driver.availability || 'Unknown'}
                            </Badge>
                          </div>

                          <div className="flex items-center gap-3 text-xs text-gray-600">
                            {driver.phone && (
                              <a href={`tel:${driver.phone}`} className="flex items-center gap-1 hover:text-[#007E8C]">
                                <Phone className="w-3 h-3" />
                                {driver.phone}
                              </a>
                            )}
                            {driver.vehicleType && (
                              <span className="flex items-center gap-1">
                                <Truck className="w-3 h-3" />
                                {driver.vehicleType}
                                {driver.vanApproved && ' (Van OK)'}
                              </span>
                            )}
                          </div>

                          <Button
                            size="sm"
                            variant="outline"
                            className="w-full text-xs"
                            onClick={() => copyDriverSMS(driver)}
                          >
                            {copiedDriverId === driver.id ? (
                              <>
                                <Check className="w-3 h-3 mr-1" />
                                Copied!
                              </>
                            ) : (
                              <>
                                <Copy className="w-3 h-3 mr-1" />
                                Copy SMS Request
                              </>
                            )}
                          </Button>
                        </div>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-4 text-gray-500">
                    <AlertCircle className="w-8 h-8 mx-auto mb-2 opacity-40" />
                    <p className="text-sm font-medium">No matching drivers found</p>
                    <p className="text-xs mt-1">
                      No drivers have location data matching this event&apos;s area
                    </p>
                  </div>
                )}

                {/* Drivers needing location data */}
                {driversWithoutLocation.length > 0 && (
                  <div className="mt-4 pt-4 border-t">
                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                      <h4 className="text-xs font-semibold text-amber-800 flex items-center gap-1">
                        <AlertCircle className="w-3.5 h-3.5" />
                        {driversWithoutLocation.length} drivers need location data
                      </h4>
                      <p className="text-xs text-amber-700 mt-1">
                        Add area/location info to these drivers to see them in suggestions.
                      </p>
                      <Button
                        variant="link"
                        size="sm"
                        className="text-xs p-0 h-auto mt-2 text-amber-800"
                        onClick={() => setLocation('/dashboard?section=drivers')}
                      >
                        Go to Driver Management →
                      </Button>
                    </div>
                  </div>
                )}

              </div>
            )}
          </ScrollArea>
        </div>
      </div>
    </div>
  );
}
