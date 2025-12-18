import React, { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import { useLocation } from 'wouter';

import {
  MapPin, Calendar, Package, Phone, AlertCircle,
  ChevronRight, RefreshCw, Clock, Truck,
  Users, Copy, Check, Building2, Heart, Edit2, Save, Loader2,
  ChevronUp, ChevronDown, X, Maximize2, Minimize2, List, ExternalLink
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { PERMISSIONS, hasPermission } from '@shared/auth-utils';
import type { UserForPermissions } from '@shared/types';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'react-leaflet-cluster/dist/assets/MarkerCluster.css';
import 'react-leaflet-cluster/dist/assets/MarkerCluster.Default.css';
import { format, addWeeks, startOfDay, endOfDay, isWithinInterval } from 'date-fns';
import { PageBreadcrumbs } from '@/components/page-breadcrumbs';

import { Card } from '@/components/ui/card';
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
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';

// Fix Leaflet default marker icon issue
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Helper function to parse date strings as local dates
const parseLocalDate = (dateString: string): Date => {
  if (!dateString) return new Date();

  // Extract just the date part (YYYY-MM-DD) from any format
  const datePart = dateString.split('T')[0];
  const [year, month, day] = datePart.split('-').map(Number);

  // Create date at local midnight (not UTC midnight)
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
  tspContactAssigned: string | null;
  tspContact: string | null;
  customTspContact: string | null;
  eventStartTime: string | null;
  eventEndTime: string | null;
  driversNeeded: number | null;
  assignedDriverIds: string[] | null;
  assignedRecipientIds: string[] | null;
  tentativeDriverIds: string[] | null;
  sandwichTypes: { type: string; quantity: number }[] | null;
  pickupTime: string | null;
  pickupTimeWindow: string | null;
  selfTransport: boolean | null;
  vanDriverNeeded: boolean | null;
  assignedVanDriverId: string | null;
  isDhlVan?: boolean | null;
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
  latitude: string | null;
  longitude: string | null;
  geocodedAt: string | null;
}

type DriverSource = 'driver' | 'host' | 'volunteer';

interface DriverCandidate {
  id: string; // source-prefixed id (e.g., driver-1, host-2, volunteer-3)
  source: DriverSource;
  name: string;
  email: string | null;
  phone: string | null;
  latitude: string;
  longitude: string;
  area?: string | null;
  zone?: string | null;
  routeDescription?: string | null;
  homeAddress?: string | null;
  availability?: string | null;
  vehicleType?: string | null;
  vanApproved?: boolean | null;
  hostLocation?: string | null;
}

interface HostContact {
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

interface RecipientMapData {
  id: number;
  name: string;
  address: string | null;
  region: string | null;
  latitude: string;
  longitude: string;
  estimatedSandwiches: number | null;
  collectionDay: string | null;
  collectionTime: string | null;
  focusAreas: string[] | null;
  contactPersonName: string | null;
  phone: string | null;
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
const hostFocusedIcon = createColorIcon('orange');
const recipientIcon = createColorIcon('violet');
const recipientFocusedIcon = createColorIcon('orange');
const driverIcon = createColorIcon('yellow'); // Yellow for drivers

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

// Type for focused map item (host or recipient)
interface FocusedMapItem {
  type: 'host' | 'recipient';
  id: number;
  latitude: string;
  longitude: string;
}

// Component to center map on selected event or focused item
function MapController({
  selectedEvent,
  events,
  focusedItem,
  nearbyHosts,
  nearbyRecipients,
  designatedRecipients,
}: {
  selectedEvent: EventMapData | null;
  events: EventMapData[];
  focusedItem: FocusedMapItem | null;
  nearbyHosts: { latitude: string; longitude: string }[];
  nearbyRecipients: { latitude: string; longitude: string }[];
  designatedRecipients: { latitude: string; longitude: string }[];
}) {
  const map = useMap();

  // Handle focused item (host or recipient click from sidebar)
  useEffect(() => {
    if (focusedItem?.latitude && focusedItem?.longitude) {
      map.setView(
        [parseFloat(focusedItem.latitude), parseFloat(focusedItem.longitude)],
        15,
        { animate: true }
      );
    }
  }, [focusedItem, map]);

  // Center on selected event with bounds that include at least one host and one recipient
  const selectedEventId = selectedEvent?.id;
  useEffect(() => {
    if (selectedEvent?.latitude && selectedEvent?.longitude) {
      const points: [number, number][] = [
        [parseFloat(selectedEvent.latitude), parseFloat(selectedEvent.longitude)]
      ];

      // Add closest host if available
      if (nearbyHosts.length > 0) {
        points.push([
          parseFloat(nearbyHosts[0].latitude),
          parseFloat(nearbyHosts[0].longitude)
        ]);
      }

      // Add designated recipient if available, otherwise add closest recipient
      if (designatedRecipients.length > 0) {
        points.push([
          parseFloat(designatedRecipients[0].latitude),
          parseFloat(designatedRecipients[0].longitude)
        ]);
      } else if (nearbyRecipients.length > 0) {
        points.push([
          parseFloat(nearbyRecipients[0].latitude),
          parseFloat(nearbyRecipients[0].longitude)
        ]);
      }

      if (points.length > 1) {
        // Compute zoom that includes event + closest host + closest recipient, but keep the event centered
        const bounds = L.latLngBounds(points);
        const zoomForBounds = Math.min(map.getBoundsZoom(bounds, false, L.point(60, 60)), 14);
        map.setView(
          [parseFloat(selectedEvent.latitude), parseFloat(selectedEvent.longitude)],
          zoomForBounds,
          { animate: true }
        );
      } else {
        // Fallback to just centering on event if no hosts/recipients
        map.setView(
          [parseFloat(selectedEvent.latitude), parseFloat(selectedEvent.longitude)],
          14,
          { animate: true }
        );
      }
    }
  }, [
    selectedEventId,
    selectedEvent?.latitude,
    selectedEvent?.longitude,
    nearbyHosts,
    nearbyRecipients,
    designatedRecipients,
    map
  ]);

  // Fit bounds to all events on initial load (when no event selected)
  useEffect(() => {
    if (!selectedEvent && events.length > 0) {
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
type SMSDriver = { id: string | number; name: string; phone?: string | null };

const generateDriverSMS = (event: EventMapData, driver: SMSDriver): string => {
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
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const [selectedEvent, setSelectedEvent] = useState<EventMapData | null>(null);
  const [weeksAhead, setWeeksAhead] = useState<string>('4');
  const [copiedDriverId, setCopiedDriverId] = useState<string | number | null>(null);
  const [focusedItem, setFocusedItem] = useState<FocusedMapItem | null>(null);
  const [showAllHosts, setShowAllHosts] = useState(false);
  const [showAllRecipients, setShowAllRecipients] = useState(false);
  const [showAllNearbyDrivers, setShowAllNearbyDrivers] = useState(false);
  const [assigningDriverId, setAssigningDriverId] = useState<string | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [mobilePanel, setMobilePanel] = useState<'details' | null>(null);
  const [mobileFullscreenMap, setMobileFullscreenMap] = useState(false);
  const [mobileEventsCollapsed, setMobileEventsCollapsed] = useState(false);
  const [showOnlyUnmetStaffing, setShowOnlyUnmetStaffing] = useState(true);
  const [showPendingEvents, setShowPendingEvents] = useState(false);
  const [geocodingEventId, setGeocodingEventId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState({
    driversNeeded: '',
    pickupTime: '',
    eventStartTime: '',
    eventEndTime: '',
    pickupTimeWindow: '',
  });

  // Check if user has edit permission
  const canEditEvents = user && hasPermission(user as UserForPermissions, PERMISSIONS.EVENT_REQUESTS_EDIT);

  // Update event mutation
  const updateEventMutation = useMutation({
    mutationFn: async (data: { id: number; updates: Record<string, any> }) => {
      const response = await fetch(`/api/event-requests/${data.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(data.updates),
      });
      if (!response.ok) throw new Error('Failed to update event');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/event-map'] });
      toast({ title: 'Event updated', description: 'Changes saved successfully' });
      setEditDialogOpen(false);
    },
    onError: () => {
      toast({ title: 'Update failed', description: 'Could not save changes', variant: 'destructive' });
    },
  });

  // Assign driver to event (supports tentative assignments)
  const assignDriverMutation = useMutation({
    mutationFn: async ({ eventId, driverId, currentAssigned, currentTentative, tentative }: {
      eventId: number;
      driverId: string;
      currentAssigned: string[];
      currentTentative?: string[];
      tentative?: boolean;
    }) => {
      const assignedSet = new Set(currentAssigned);
      const tentativeSet = new Set(currentTentative || []);

      if (tentative) {
        // Add to tentative, remove from confirmed if present
        tentativeSet.add(driverId);
        assignedSet.delete(driverId);
      } else {
        // Add to confirmed, remove from tentative if present
        assignedSet.add(driverId);
        tentativeSet.delete(driverId);
      }

      const assignedDriverIds = Array.from(assignedSet);
      const tentativeDriverIds = Array.from(tentativeSet);

      const response = await fetch(`/api/event-requests/${eventId}/drivers`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ assignedDriverIds, tentativeDriverIds }),
      });
      if (!response.ok) throw new Error('Failed to assign driver');
      return response.json();
    },
    onSuccess: (data, variables) => {
      toast({
        title: variables.tentative ? 'Driver marked tentative' : 'Driver assigned',
        description: variables.tentative
          ? 'Driver has been marked as tentative (?) for this event.'
          : 'Driver has been confirmed for this event.',
      });
      // Refresh events and update selected event locally
      queryClient.invalidateQueries();
      setSelectedEvent((prev) => (prev ? {
        ...prev,
        assignedDriverIds: data.assignedDriverIds || [],
        tentativeDriverIds: data.tentativeDriverIds || []
      } : prev));
    },
    onError: () => {
      toast({
        title: 'Assign failed',
        description: 'Could not assign the driver. Please try again.',
        variant: 'destructive',
      });
    },
    onSettled: () => {
      setAssigningDriverId(null);
    },
  });

  // Open edit dialog and populate form
  const openEditDialog = () => {
    if (!selectedEvent) return;
    setEditForm({
      driversNeeded: selectedEvent.driversNeeded?.toString() || '',
      pickupTime: selectedEvent.pickupTime || '',
      eventStartTime: selectedEvent.eventStartTime || '',
      eventEndTime: selectedEvent.eventEndTime || '',
      pickupTimeWindow: selectedEvent.pickupTimeWindow || '',
    });
    setEditDialogOpen(true);
  };

  // Save edit form
  const saveEditForm = () => {
    if (!selectedEvent) return;
    const updates: Record<string, any> = {};
    if (editForm.driversNeeded) updates.driversNeeded = editForm.driversNeeded;
    if (editForm.pickupTime) updates.pickupTime = editForm.pickupTime;
    if (editForm.eventStartTime) updates.eventStartTime = editForm.eventStartTime;
    if (editForm.eventEndTime) updates.eventEndTime = editForm.eventEndTime;
    if (editForm.pickupTimeWindow) updates.pickupTimeWindow = editForm.pickupTimeWindow;

    updateEventMutation.mutate({ id: selectedEvent.id, updates });
  };

  // Geocode event mutation
  const geocodeEventMutation = useMutation({
    mutationFn: async (eventId: number) => {
      const response = await fetch(`/api/event-map/geocode/${eventId}`, {
        method: 'POST',
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to geocode event');
      }
      return response.json();
    },
    onSuccess: (data, eventId) => {
      toast({
        title: 'Event geocoded',
        description: 'The event location has been added to the map.',
      });
      // Refetch events to get updated coordinates
      refetchEvents();
      setGeocodingEventId(null);
    },
    onError: (error: any) => {
      toast({
        title: 'Geocoding failed',
        description: error.message || 'Could not geocode the event address. Please check the address in the event details.',
        variant: 'destructive',
      });
      setGeocodingEventId(null);
    },
  });

  const handleGeocodeEvent = (e: React.MouseEvent, eventId: number) => {
    e.stopPropagation(); // Prevent card selection
    setGeocodingEventId(eventId);
    geocodeEventMutation.mutate(eventId);
  };

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

  // Fetch basic users for resolving user IDs (for assigned staff / assigned drivers that are user IDs)
  const { data: usersBasic = [] } = useQuery<Array<{ id: string; displayName?: string; firstName?: string; lastName?: string; email?: string }>>({
    queryKey: ['/api/users/basic'],
    queryFn: async () => {
      const response = await fetch('/api/users/basic');
      if (!response.ok) throw new Error('Failed to fetch users');
      return response.json();
    },
    staleTime: 300000,
  });

  // Fetch driver candidates (drivers + hosts + volunteers flagged as drivers)
  const { data: driverCandidates = [], isLoading: driverCandidatesLoading } = useQuery<DriverCandidate[]>({
    queryKey: ['/api/drivers/driver-candidates'],
    queryFn: async () => {
      const response = await fetch('/api/drivers/driver-candidates');
      if (!response.ok) throw new Error('Failed to fetch driver candidates');
      return response.json();
    },
  });

  // Fetch host contacts with coordinates (from the hosts/map endpoint)
  const { data: hostContacts = [] } = useQuery<HostContact[]>({
    queryKey: ['/api/hosts/map'],
    queryFn: async () => {
      const response = await fetch('/api/hosts/map');
      if (!response.ok) throw new Error('Failed to fetch host contacts');
      return response.json();
    },
  });

  // Fetch recipients with coordinates for map display
  const { data: recipientMapData = [] } = useQuery<RecipientMapData[]>({
    queryKey: ['/api/recipients/map'],
    queryFn: async () => {
      const response = await fetch('/api/recipients/map');
      if (!response.ok) throw new Error('Failed to fetch recipients for map');
      return response.json();
    },
  });

  const usersById = useMemo(() => {
    const map = new Map<string, string>();
    for (const u of usersBasic) {
      const name = (u.displayName || [u.firstName, u.lastName].filter(Boolean).join(' ') || u.email || u.id || '').trim();
      if (u.id && name) map.set(u.id, name);
    }
    return map;
  }, [usersBasic]);

  const parsePostgresArrayLike = (arr: unknown): string[] => {
    if (!arr) return [];
    if (Array.isArray(arr)) return arr.map(String).map((s) => s.trim()).filter(Boolean);
    if (typeof arr === 'string') {
      if (arr === '{}' || arr === '') return [];
      const cleaned = arr.replace(/^{|}$/g, '');
      if (!cleaned) return [];
      return cleaned.split(',').map((item) => item.trim()).filter(Boolean);
    }
    return [];
  };

  const extractCustomName = (id: string): string => {
    if (!id || typeof id !== 'string') return '';
    if (id.startsWith('custom-')) {
      const parts = id.split('-');
      if (parts.length >= 3) {
        const nameParts = parts.slice(2);
        return nameParts.join('-').replace(/-/g, ' ').trim() || 'Custom Volunteer';
      }
      return 'Custom Volunteer';
    }
    if (id.startsWith('custom:')) {
      return id.replace('custom:', '').trim();
    }
    return '';
  };

  const resolveUserName = (id: string): string => {
    const custom = extractCustomName(id);
    if (custom) return custom;
    const name = usersById.get(id);
    return name || id;
  };

  // Filter events to upcoming scheduled events within selected weeks
  const upcomingEvents = useMemo(() => {
    const today = startOfDay(new Date());
    const endDate = endOfDay(addWeeks(today, parseInt(weeksAhead)));

    return allEvents
      .filter(event => {
        // Status filter - scheduled always included, pending/new_request when toggled
        const status = (event.status || '').toLowerCase();
        const isScheduled = status === 'scheduled';
        const isPendingOrNew = status === 'pending' || status === 'new_request';
        if (!isScheduled && !(showPendingEvents && isPendingOrNew)) return false;

        // Must have a date
        const dateStr = event.scheduledEventDate || event.desiredEventDate;
        if (!dateStr) return false;

        const eventDate = parseLocalDate(dateStr);
        return isWithinInterval(eventDate, { start: today, end: endDate });
      })
      .sort((a, b) => {
        const dateA = parseLocalDate(a.scheduledEventDate || a.desiredEventDate!);
        const dateB = parseLocalDate(b.scheduledEventDate || b.desiredEventDate!);
        return dateA.getTime() - dateB.getTime();
      });
  }, [allEvents, weeksAhead, showPendingEvents]);

  // Map-safe subset: only events with coordinates
  const upcomingEventsWithCoords = useMemo(() => {
    return upcomingEvents.filter((e) => {
      const lat = (e.latitude || '').trim();
      const lng = (e.longitude || '').trim();
      if (!lat || !lng) return false;
      const latNum = Number.parseFloat(lat);
      const lngNum = Number.parseFloat(lng);
      return Number.isFinite(latNum) && Number.isFinite(lngNum);
    });
  }, [upcomingEvents]);

  // Filter events based on staffing needs toggle
  const events = useMemo(() => {
    if (!showOnlyUnmetStaffing) return upcomingEvents;

    return upcomingEvents.filter(event => {
      // Skip self-transport events - they don't need TSP drivers
      if (event.selfTransport) return false;

      // Only consider events with explicit driver requirements
      const driversNeeded = event.driversNeeded || 0;

      // If no driver requirement configured, don't show as needing drivers
      if (driversNeeded === 0) return false;

      // Count ALL assigned drivers including van drivers
      // Van driver and DHL van both count toward the total driver requirement
      const driversAssigned = (event.assignedDriverIds?.length || 0) +
                              (event.assignedVanDriverId ? 1 : 0) +
                              (event.isDhlVan ? 1 : 0);

      return driversAssigned < driversNeeded;
    });
  }, [upcomingEvents, showOnlyUnmetStaffing]);

  // Count of events with unmet staffing needs
  const unmetStaffingCount = useMemo(() => {
    return upcomingEvents.filter(event => {
      // Skip self-transport events
      if (event.selfTransport) return false;

      // Only count events with explicit driver requirements
      const driversNeeded = event.driversNeeded || 0;

      if (driversNeeded === 0) return false;

      // Count ALL assigned drivers including van drivers
      // Van driver and DHL van both count toward the total driver requirement
      const driversAssigned = (event.assignedDriverIds?.length || 0) +
                              (event.assignedVanDriverId ? 1 : 0) +
                              (event.isDhlVan ? 1 : 0);

      return driversAssigned < driversNeeded;
    }).length;
  }, [upcomingEvents]);

  // Get active drivers
  const activeDrivers = useMemo(() => {
    return drivers.filter(d => d.isActive);
  }, [drivers]);

  // Get nearest driver candidates (drivers + hosts + volunteers) to the selected event (by distance)
  const nearbyDrivers = useMemo(() => {
    if (!selectedEvent?.latitude || !selectedEvent?.longitude) return [];

    const eventLat = parseFloat(selectedEvent.latitude);
    const eventLng = parseFloat(selectedEvent.longitude);

    return driverCandidates
      .filter((c) => c.latitude && c.longitude)
      .map((driver) => {
        const distance = calculateDistanceInMiles(
          eventLat,
          eventLng,
          parseFloat(driver.latitude),
          parseFloat(driver.longitude)
        );
        return { driver, distance };
      })
      .sort((a, b) => a.distance - b.distance);
  }, [driverCandidates, selectedEvent]);

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

  // Get nearby host contacts near the selected event (show individual contacts, not locations)
  // Dynamically expands search radius if not enough hosts found nearby
  const nearbyHosts = useMemo(() => {
    if (!selectedEvent?.latitude || !selectedEvent?.longitude) return [];

    const eventLat = parseFloat(selectedEvent.latitude);
    const eventLng = parseFloat(selectedEvent.longitude);

    const hostsWithDistance = hostContacts
      .filter(contact => contact.latitude && contact.longitude)
      .map(contact => ({
        id: contact.id,
        contactName: contact.contactName,
        hostLocationName: contact.hostLocationName,
        latitude: contact.latitude,
        longitude: contact.longitude,
        distance: calculateDistanceInMiles(
          eventLat,
          eventLng,
          parseFloat(contact.latitude),
          parseFloat(contact.longitude)
        ),
      }))
      .sort((a, b) => a.distance - b.distance);

    // Try progressively larger radii until we have at least 3 hosts (or run out of options)
    const radii = [10, 20, 35, 50];
    for (const radius of radii) {
      const hostsInRadius = hostsWithDistance.filter(h => h.distance < radius);
      if (hostsInRadius.length >= 3) {
        return hostsInRadius.slice(0, 10);
      }
    }

    // If still not enough, just return whatever we have (sorted by distance)
    return hostsWithDistance.slice(0, 10);
  }, [selectedEvent, hostContacts]);

  // Get nearby recipients (delivery locations) near the selected event
  // Dynamically expands search radius if not enough recipients found nearby
  const nearbyRecipients = useMemo(() => {
    if (!selectedEvent?.latitude || !selectedEvent?.longitude) return [];

    const eventLat = parseFloat(selectedEvent.latitude);
    const eventLng = parseFloat(selectedEvent.longitude);

    const recipientsWithDistance = recipientMapData
      .filter(recipient => recipient.latitude && recipient.longitude)
      .map(recipient => ({
        ...recipient,
        distance: calculateDistanceInMiles(
          eventLat,
          eventLng,
          parseFloat(recipient.latitude),
          parseFloat(recipient.longitude)
        ),
      }))
      .sort((a, b) => a.distance - b.distance);

    // Try progressively larger radii until we have at least 3 recipients (or run out of options)
    const radii = [15, 25, 40, 60];
    for (const radius of radii) {
      const recipientsInRadius = recipientsWithDistance.filter(r => r.distance < radius);
      if (recipientsInRadius.length >= 3) {
        return recipientsInRadius.slice(0, 10);
      }
    }

    // If still not enough, just return whatever we have (sorted by distance)
    return recipientsWithDistance.slice(0, 10);
  }, [selectedEvent, recipientMapData]);

  // Designated recipient(s) explicitly assigned on the event (if any)
  const designatedRecipients = useMemo(() => {
    const assigned = selectedEvent?.assignedRecipientIds || [];
    if (!selectedEvent || assigned.length === 0) return [];

    const numericIds = assigned
      .map((v) => Number(v))
      .filter((n) => Number.isFinite(n));

    const normalizedNames = assigned
      .map((v) => (v || '').trim().toLowerCase())
      .filter((v) => v.length > 0 && Number.isNaN(Number(v)));

    const matches = recipientMapData.filter((r) => {
      if (!r.latitude || !r.longitude) return false;
      if (numericIds.length > 0 && numericIds.includes(r.id)) return true;
      if (normalizedNames.length > 0) {
        const name = (r.name || '').trim().toLowerCase();
        return normalizedNames.some((n) => n === name);
      }
      return false;
    });

    return matches;
  }, [selectedEvent, recipientMapData]);

  const nonDesignatedNearbyRecipients = useMemo(() => {
    if (!selectedEvent) return [];
    if (designatedRecipients.length === 0) return nearbyRecipients;
    const designatedIds = new Set(designatedRecipients.map((r) => r.id));
    return nearbyRecipients.filter((r) => !designatedIds.has(r.id));
  }, [selectedEvent, designatedRecipients, nearbyRecipients]);

  const getAssignedStaffLabel = (event: EventMapData): string | null => {
    const parts = [event.customTspContact, event.tspContactAssigned, event.tspContact]
      .map((v) => (v || '').trim())
      .filter(Boolean)
      .map((v) => (v.startsWith('user_') || v.startsWith('auth0|') || v.startsWith('google-oauth2|')) ? resolveUserName(v) : v);
    if (parts.length === 0) return null;
    // De-dupe while preserving order
    return Array.from(new Set(parts)).join(' • ');
  };

  const getAssignedDriversLabel = (event: EventMapData): string | null => {
    const ids = parsePostgresArrayLike(event.assignedDriverIds);
    if (ids.length === 0) return null;

    const candidateById = new Map(driverCandidates.map((c) => [c.id, c]));
    const driverByNumericId = new Map(activeDrivers.map((d) => [String(d.id), d]));

    const labels = ids.map((raw) => {
      const id = String(raw).trim();
      if (!id) return '';

      // 1) custom name formats
      const custom = extractCustomName(id);
      if (custom) return custom;

      // 2) user IDs (common across event-request staffing)
      const userName = usersById.get(id);
      if (userName) return userName;

      // 3) driver candidate IDs (driver-12 / host-3 / volunteer-9)
      const candidate = candidateById.get(id);
      if (candidate) return candidate.name;

      // 4) numeric IDs (plain "12") -> drivers table
      if (/^\d+$/.test(id)) {
        const driver = driverByNumericId.get(id);
        if (driver?.name) return driver.name;
        const asCandidate = candidateById.get(`driver-${id}`);
        if (asCandidate) return asCandidate.name;
      }

      // 5) prefixed numeric IDs -> drivers table
      const tail = id.includes('-') ? id.split('-').pop() : null;
      if (tail && /^\d+$/.test(tail)) {
        const driver = driverByNumericId.get(tail);
        if (driver?.name) return driver.name;
      }

      return id;
    }).filter(Boolean);

    const deduped = Array.from(new Set(labels));
    return deduped.length > 0 ? deduped.join(', ') : null;
  };

  const getDesignatedRecipientLabel = (event: EventMapData): string | null => {
    const assigned = event.assignedRecipientIds || [];
    if (assigned.length === 0) return null;

    const numericIds = assigned
      .map((v) => Number(v))
      .filter((n) => Number.isFinite(n));

    const names = recipientMapData
      .filter((r) => numericIds.includes(r.id))
      .map((r) => r.name)
      .filter(Boolean);

    if (names.length > 0) return Array.from(new Set(names)).join(', ');
    // Fallback: show whatever was stored
    return assigned.filter(Boolean).join(', ');
  };

  // Copy SMS to clipboard
  const copyDriverSMS = async (driver: SMSDriver) => {
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
    if (upcomingEventsWithCoords.length === 0) return [33.7490, -84.3880]; // Atlanta default

    const avgLat = upcomingEventsWithCoords.reduce((sum, e) => sum + parseFloat(e.latitude!), 0) / upcomingEventsWithCoords.length;
    const avgLng = upcomingEventsWithCoords.reduce((sum, e) => sum + parseFloat(e.longitude!), 0) / upcomingEventsWithCoords.length;

    return [avgLat, avgLng];
  }, [upcomingEventsWithCoords]);

  const isLoading = eventsLoading || driversLoading || driverCandidatesLoading;

  if (isLoading) {
    return (
      <div className="h-full min-h-[260px] flex items-center justify-center">
        <div className="text-center">
          <Skeleton className="h-12 w-12 rounded-full mx-auto mb-4" />
          <Skeleton className="h-6 w-48 mx-auto" />
        </div>
      </div>
    );
  }

  return (
    <div className="h-full min-h-0 flex flex-col">
      {/* Header - Desktop */}
      <div className="flex-shrink-0 p-4 bg-white border-b hidden lg:block">
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
                {unmetStaffingCount} event{unmetStaffingCount !== 1 ? 's' : ''} needing drivers ({upcomingEvents.length} total upcoming)
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

      {/* Header - Mobile/Tablet */}
      <div className="flex-shrink-0 p-3 bg-white border-b lg:hidden">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#007E8C] to-[#005f6b] flex items-center justify-center flex-shrink-0">
              <Truck className="w-4 h-4 text-white" />
            </div>
            <div className="min-w-0">
              <h1 className="text-lg font-bold text-gray-900 truncate">Driver Planning</h1>
              <p className="text-xs text-gray-600">
                {unmetStaffingCount} needing drivers
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <Select value={weeksAhead} onValueChange={setWeeksAhead}>
              <SelectTrigger className="w-24 h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="2">2 weeks</SelectItem>
                <SelectItem value="4">4 weeks</SelectItem>
                <SelectItem value="6">6 weeks</SelectItem>
                <SelectItem value="8">8 weeks</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => refetchEvents()}>
              <RefreshCw className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content - Desktop 3-Panel Layout */}
      <div className="flex-1 hidden lg:flex overflow-hidden">
        {/* Left Panel - Event List */}
        <div className="w-80 border-r bg-gray-50 flex flex-col" data-testid="driver-planning-events-list">
          <div className="p-3 border-b bg-white space-y-2">
            <h2 className="font-semibold text-gray-900 flex items-center gap-2">
              <Calendar className="w-5 h-5 text-[#007E8C]" />
              Events ({events.length}{showOnlyUnmetStaffing ? ` of ${upcomingEvents.length}` : ''})
            </h2>
            <label className="flex items-center gap-2 text-xs cursor-pointer">
              <input
                type="checkbox"
                checked={showOnlyUnmetStaffing}
                onChange={(e) => setShowOnlyUnmetStaffing(e.target.checked)}
                className="rounded border-gray-300 text-[#007E8C] focus:ring-[#007E8C]"
              />
              <span className="text-gray-600">Only show events needing drivers</span>
              {showOnlyUnmetStaffing && unmetStaffingCount > 0 && (
                <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
                  {unmetStaffingCount}
                </Badge>
              )}
            </label>
            <label className="flex items-center gap-2 text-xs cursor-pointer">
              <input
                type="checkbox"
                checked={showPendingEvents}
                onChange={(e) => setShowPendingEvents(e.target.checked)}
                className="rounded border-gray-300 text-[#007E8C] focus:ring-[#007E8C]"
              />
              <span className="text-gray-600">Include pending/new requests</span>
            </label>
          </div>
          <ScrollArea className="flex-1">
            <div className="p-3 space-y-2">
              {events.map((event) => {
                const isSelected = selectedEvent?.id === event.id;
                const eventDate = event.scheduledEventDate || event.desiredEventDate;
                const regularDriversAssigned = event.assignedDriverIds?.length || 0;
                const driversTentative = event.tentativeDriverIds?.length || 0;
                const driversNeeded = event.driversNeeded || 0;
                const hasDriverRequirement = driversNeeded > 0;

                // Count ALL assigned drivers including van drivers for status calculation
                // Van driver and DHL van both count toward the total driver requirement
                const totalDriversAssigned = regularDriversAssigned +
                                             (event.assignedVanDriverId ? 1 : 0) +
                                             (event.isDhlVan ? 1 : 0);
                const driversFulfilled = totalDriversAssigned >= driversNeeded;

                return (
                  <Card
                    key={event.id}
                    className={`p-3 cursor-pointer transition-all ${
                      isSelected
                        ? 'ring-2 ring-[#007E8C] bg-[#007E8C]/5'
                        : 'hover:shadow-md hover:bg-white'
                    }`}
                    onClick={() => {
                      setSelectedEvent(isSelected ? null : event);
                      setShowAllHosts(false);
                      setShowAllRecipients(false);
                    }}
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

                      {/* Driver status - only show if event has driver requirements */}
                      <div className="flex items-center gap-2">
                        {event.selfTransport ? (
                          <Badge variant="secondary" className="text-xs">
                            Self-transport
                          </Badge>
                        ) : hasDriverRequirement ? (
                          <Badge
                            variant={driversFulfilled ? 'default' : 'destructive'}
                            className="text-xs"
                          >
                            <Truck className="w-3 h-3 mr-1" />
                            {totalDriversAssigned}{driversTentative > 0 && <span className="text-amber-300">+{driversTentative}?</span>}/{driversNeeded} drivers
                            {event.isDhlVan
                              ? ' (incl. DHL)'
                              : event.assignedVanDriverId
                              ? ' (incl. van)'
                              : ''}
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-xs text-gray-500">
                            No driver requirement
                          </Badge>
                        )}
                        {(!event.latitude || !event.longitude) && (
                          <Badge 
                            variant="outline" 
                            className="text-xs cursor-pointer hover:bg-gray-100"
                            onClick={(e) => handleGeocodeEvent(e, event.id)}
                            title="Click to geocode this event's address"
                          >
                            {geocodingEventId === event.id ? (
                              <>
                                <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                                Geocoding...
                              </>
                            ) : (
                              'Needs geocode'
                            )}
                          </Badge>
                        )}
                      </div>

                    {/* Expanded details on selected card */}
                    {isSelected && (
                      <div className="pt-2 border-t border-gray-100 space-y-1">
                        {getAssignedStaffLabel(event) && (
                          <div className="text-[11px] text-gray-700">
                            <span className="font-semibold">Assigned staff:</span>{' '}
                            <span className="text-gray-600">{getAssignedStaffLabel(event)}</span>
                          </div>
                        )}
                        {getAssignedDriversLabel(event) && (
                          <div className="text-[11px] text-gray-700">
                            <span className="font-semibold">Assigned drivers:</span>{' '}
                            <span className="text-gray-600">{getAssignedDriversLabel(event)}</span>
                          </div>
                        )}
                        {getDesignatedRecipientLabel(event) && (
                          <div className="text-[11px] text-gray-700">
                            <span className="font-semibold">Recipient:</span>{' '}
                            <span className="text-gray-600">{getDesignatedRecipientLabel(event)}</span>
                          </div>
                        )}
                        {!getAssignedStaffLabel(event) && !getAssignedDriversLabel(event) && !getDesignatedRecipientLabel(event) && (
                          <div className="text-[11px] text-gray-500">
                            No staff or recipient assigned yet.
                          </div>
                        )}
                        {canEditEvents && (
                          <div className="pt-1 mt-1 border-t border-gray-100">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 text-xs text-[#007E8C] hover:text-[#007E8C] hover:bg-[#007E8C]/10 p-0"
                              onClick={(e) => {
                                e.stopPropagation();
                                setLocation(`/dashboard?section=event-requests&eventId=${event.id}`);
                              }}
                            >
                              <Edit2 className="w-3 h-3 mr-1" />
                              Edit Event Request
                              <ExternalLink className="w-3 h-3 ml-1" />
                            </Button>
                          </div>
                        )}
                      </div>
                    )}
                    </div>
                  </Card>
                );
              })}

              {events.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  <Calendar className="w-12 h-12 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">
                    {showOnlyUnmetStaffing && upcomingEvents.length > 0
                      ? 'All events have drivers assigned!'
                      : 'No scheduled events in this period'}
                  </p>
                  {showOnlyUnmetStaffing && upcomingEvents.length > 0 && (
                    <Button
                      variant="link"
                      size="sm"
                      onClick={() => setShowOnlyUnmetStaffing(false)}
                      className="text-[#007E8C] mt-2"
                    >
                      Show all {upcomingEvents.length} events
                    </Button>
                  )}
                </div>
              )}
            </div>
          </ScrollArea>
        </div>

        {/* Center Panel - Map */}
        <div className="flex-1 relative" data-testid="driver-planning-map">
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
            <MapController
              selectedEvent={selectedEvent}
              events={upcomingEventsWithCoords}
              focusedItem={focusedItem}
              nearbyHosts={nearbyHosts}
              nearbyRecipients={nearbyRecipients}
              designatedRecipients={designatedRecipients}
            />

            {/* Event markers */}
            {upcomingEventsWithCoords.map((event) => (
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
                position={[parseFloat(host.latitude), parseFloat(host.longitude)]}
                icon={focusedItem?.type === 'host' && focusedItem?.id === host.id ? hostFocusedIcon : hostIcon}
                eventHandlers={{
                  click: () => setFocusedItem({
                    type: 'host',
                    id: host.id,
                    latitude: host.latitude,
                    longitude: host.longitude
                  })
                }}
              >
                <Popup>
                  <div className="p-2">
                    <h3 className="font-semibold text-green-700">{host.contactName}</h3>
                    <p className="text-xs text-gray-600">{host.hostLocationName}</p>
                    <p className="text-xs text-gray-500 mt-1">{host.distance.toFixed(1)} miles away</p>
                  </div>
                </Popup>
              </Marker>
            ))}

            {/* Nearby recipient markers when event selected */}
            {selectedEvent && designatedRecipients.map((recipient) => (
              <Marker
                key={`designated-recipient-${recipient.id}`}
                position={[parseFloat(recipient.latitude), parseFloat(recipient.longitude)]}
                icon={focusedItem?.type === 'recipient' && focusedItem?.id === recipient.id ? recipientFocusedIcon : recipientIcon}
                eventHandlers={{
                  click: () => setFocusedItem({
                    type: 'recipient',
                    id: recipient.id,
                    latitude: recipient.latitude,
                    longitude: recipient.longitude
                  })
                }}
              >
                <Popup>
                  <div className="p-2 min-w-[180px]">
                    <div className="text-[10px] font-semibold text-purple-700 uppercase tracking-wide">Designated Recipient</div>
                    <h3 className="font-semibold text-purple-700">{recipient.name}</h3>
                    {recipient.address && (
                      <p className="text-xs text-gray-600">{recipient.address}</p>
                    )}
                  </div>
                </Popup>
              </Marker>
            ))}

            {/* Nearby recipient markers when event selected */}
            {selectedEvent && nonDesignatedNearbyRecipients.map((recipient) => (
              <Marker
                key={`recipient-${recipient.id}`}
                position={[parseFloat(recipient.latitude), parseFloat(recipient.longitude)]}
                icon={focusedItem?.type === 'recipient' && focusedItem?.id === recipient.id ? recipientFocusedIcon : recipientIcon}
                eventHandlers={{
                  click: () => setFocusedItem({
                    type: 'recipient',
                    id: recipient.id,
                    latitude: recipient.latitude,
                    longitude: recipient.longitude
                  })
                }}
              >
                <Popup>
                  <div className="p-2 min-w-[180px]">
                    <h3 className="font-semibold text-purple-700">{recipient.name}</h3>
                    {recipient.address && (
                      <p className="text-xs text-gray-600">{recipient.address}</p>
                    )}
                    {recipient.estimatedSandwiches && (
                      <p className="text-xs mt-1">Needs ~{recipient.estimatedSandwiches} sandwiches</p>
                    )}
                    <p className="text-xs text-gray-500 mt-1">{recipient.distance.toFixed(1)} miles away</p>
                  </div>
                </Popup>
              </Marker>
            ))}
          </MapContainer>

          {/* Map legend */}
          <div className="absolute bottom-4 left-4 bg-white rounded-lg shadow-lg p-3 z-[1000]" data-testid="driver-planning-legend">
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
                <>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-green-500" />
                    <span>Nearby Host</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-purple-500" />
                    <span>Nearby Recipient</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-orange-500" />
                    <span>Focused Item</span>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Right Panel - Driver Suggestions */}
        <div className="w-96 border-l bg-gray-50 flex flex-col">
          <div className="p-3 border-b bg-white">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-gray-900 flex items-center gap-2">
                <Users className="w-5 h-5 text-[#007E8C]" />
                {selectedEvent ? 'Suggested Drivers' : 'Select an Event'}
              </h2>
              {selectedEvent && canEditEvents && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={openEditDialog}
                  className="h-7 w-7 p-0 text-gray-400 hover:text-gray-600"
                  title="Edit event details"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                </Button>
              )}
            </div>
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
                <div data-testid="driver-planning-nearby-hosts">
                  <h3 className="text-xs font-semibold text-gray-700 uppercase tracking-wide mb-2 flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-green-600" />
                    Nearby Hosts
                  </h3>
                  {nearbyHosts.length > 0 ? (
                    <div className="space-y-2">
                      {(showAllHosts ? nearbyHosts : nearbyHosts.slice(0, 3)).map((host) => (
                        <button
                          key={host.id}
                          onClick={() => setFocusedItem({
                            type: 'host',
                            id: host.id,
                            latitude: host.latitude,
                            longitude: host.longitude
                          })}
                          className={`w-full text-left text-xs p-2 border rounded transition-colors hover:bg-green-100 ${
                            focusedItem?.type === 'host' && focusedItem?.id === host.id
                              ? 'bg-green-100 border-green-400'
                              : 'bg-green-50 border-green-200'
                          }`}
                          data-testid={`host-locate-${host.id}`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <MapPin className="w-3.5 h-3.5 text-green-600" />
                              <span className="font-medium">{host.contactName}</span>
                            </div>
                            <span className="text-green-700">{host.distance.toFixed(1)} mi</span>
                          </div>
                          <div className="text-gray-500 pl-5 mt-0.5 text-[10px]">
                            {host.hostLocationName}
                          </div>
                        </button>
                      ))}
                      {nearbyHosts.length > 3 && (
                        <button
                          onClick={() => setShowAllHosts(!showAllHosts)}
                          className="w-full text-xs text-green-700 hover:text-green-900 font-medium py-1"
                        >
                          {showAllHosts ? 'Show less' : `View ${nearbyHosts.length - 3} more hosts`}
                        </button>
                      )}
                    </div>
                  ) : (
                    <div className="text-xs p-3 bg-gray-100 rounded text-gray-500 text-center">
                      No hosts with map coordinates found nearby.
                      <br />
                      <span className="text-gray-400">Add coordinates in Host Management to see them here.</span>
                    </div>
                  )}
                </div>

                {/* Nearby Recipients - Delivery locations */}
                <div data-testid="driver-planning-nearby-recipients">
                  <h3 className="text-xs font-semibold text-gray-700 uppercase tracking-wide mb-2 flex items-center gap-2">
                    <Heart className="w-4 h-4 text-purple-600" />
                    Nearby Recipients (Delivery Locations)
                  </h3>
                  {designatedRecipients.length > 0 && (
                    <div className="mb-3">
                      <div className="text-[11px] font-semibold text-gray-700 mb-1">Designated recipient</div>
                      <div className="space-y-1">
                        {designatedRecipients.map((recipient) => (
                          <button
                            key={`designated-recipient-sidebar-${recipient.id}`}
                            onClick={() => setFocusedItem({
                              type: 'recipient',
                              id: recipient.id,
                              latitude: recipient.latitude,
                              longitude: recipient.longitude
                            })}
                            className={`w-full text-left text-xs p-2 border rounded transition-colors hover:bg-purple-100 ${
                              focusedItem?.type === 'recipient' && focusedItem?.id === recipient.id
                                ? 'bg-purple-100 border-purple-400'
                                : 'bg-purple-50 border-purple-200'
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <MapPin className="w-3.5 h-3.5 text-purple-600" />
                                <span className="font-medium">{recipient.name}</span>
                              </div>
                              <span className="text-purple-700">Designated</span>
                            </div>
                            {recipient.address && (
                              <div className="text-gray-500 pl-5 mt-0.5 text-[10px] line-clamp-1">
                                {recipient.address}
                              </div>
                            )}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  {nearbyRecipients.length > 0 ? (
                    <div className="space-y-2">
                      {(showAllRecipients ? nonDesignatedNearbyRecipients : nonDesignatedNearbyRecipients.slice(0, 3)).map((recipient) => (
                        <button
                          key={recipient.id}
                          onClick={() => setFocusedItem({
                            type: 'recipient',
                            id: recipient.id,
                            latitude: recipient.latitude,
                            longitude: recipient.longitude
                          })}
                          className={`w-full text-left text-xs p-2 border rounded transition-colors hover:bg-purple-100 ${
                            focusedItem?.type === 'recipient' && focusedItem?.id === recipient.id
                              ? 'bg-purple-100 border-purple-400'
                              : 'bg-purple-50 border-purple-200'
                          }`}
                          data-testid={`recipient-locate-${recipient.id}`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <MapPin className="w-3.5 h-3.5 text-purple-600" />
                              <span className="font-medium">{recipient.name}</span>
                            </div>
                            <span className="text-purple-700">{recipient.distance.toFixed(1)} mi</span>
                          </div>
                          {recipient.estimatedSandwiches && (
                            <div className="mt-1 text-gray-600 pl-5">
                              Needs ~{recipient.estimatedSandwiches} sandwiches
                            </div>
                          )}
                          {recipient.region && (
                            <div className="mt-0.5 text-gray-500 pl-5 text-[10px]">
                              {recipient.region}
                            </div>
                          )}
                        </button>
                      ))}
                      {nonDesignatedNearbyRecipients.length > 3 && (
                        <button
                          onClick={() => setShowAllRecipients(!showAllRecipients)}
                          className="w-full text-xs text-purple-700 hover:text-purple-900 font-medium py-1"
                        >
                          {showAllRecipients ? 'Show less' : `View ${nonDesignatedNearbyRecipients.length - 3} more recipients`}
                        </button>
                      )}
                    </div>
                  ) : recipientMapData.length === 0 ? (
                    <div className="text-xs p-3 bg-gray-100 rounded text-gray-500 text-center">
                      No recipients with map coordinates yet.
                      <br />
                      <span className="text-gray-400">Run geocoding backfill or add addresses to recipients.</span>
                    </div>
                  ) : (
                    <div className="text-xs p-3 bg-gray-100 rounded text-gray-500 text-center">
                      No recipients within 15 miles of this event.
                    </div>
                  )}
                </div>

                {/* Suggested Drivers */}
                {nearbyDrivers.length > 0 && (
                  <div className="space-y-2">
                    <h3 className="text-xs font-semibold text-gray-700 uppercase tracking-wide">
                      Closest drivers
                    </h3>
                    {(showAllNearbyDrivers ? nearbyDrivers : nearbyDrivers.slice(0, 5)).map(({ driver, distance }) => (
                      <Card key={driver.id} className="p-3">
                        <div className="flex items-start justify-between">
                          <div>
                            <h4 className="font-medium text-sm">{driver.name}</h4>
                            <p className="text-xs text-gray-500">
                              {driver.hostLocation || driver.area || driver.routeDescription || 'No location'}
                            </p>
                            <p className="text-[11px] text-gray-400 mt-1">{distance.toFixed(1)} miles away</p>
                          </div>
                          <Badge
                            variant={driver.availability === 'available' ? 'default' : 'secondary'}
                            className="text-xs"
                          >
                            {driver.availability || 'Unknown'}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-gray-600 mt-2">
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
                        {selectedEvent && (
                          <div className="flex gap-1 mt-3">
                            {/* Tentative assignment button */}
                            <Button
                              size="sm"
                              variant={selectedEvent.tentativeDriverIds?.includes(String(driver.id)) ? 'default' : 'outline'}
                              className="flex-1 text-xs"
                              disabled={assigningDriverId === driver.id}
                              onClick={() => {
                                if (!selectedEvent) return;
                                setAssigningDriverId(driver.id);
                                assignDriverMutation.mutate({
                                  eventId: selectedEvent.id,
                                  driverId: String(driver.id),
                                  currentAssigned: selectedEvent.assignedDriverIds || [],
                                  currentTentative: selectedEvent.tentativeDriverIds || [],
                                  tentative: true,
                                });
                              }}
                            >
                              {assigningDriverId === driver.id ? (
                                <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                              ) : (
                                <span className="mr-1 font-bold">?</span>
                              )}
                              {selectedEvent.tentativeDriverIds?.includes(String(driver.id)) ? 'Tentative' : 'Maybe'}
                            </Button>
                            {/* Confirmed assignment button */}
                            <Button
                              size="sm"
                              className="flex-1 text-xs"
                              disabled={assigningDriverId === driver.id}
                              onClick={() => {
                                if (!selectedEvent) return;
                                setAssigningDriverId(driver.id);
                                assignDriverMutation.mutate({
                                  eventId: selectedEvent.id,
                                  driverId: String(driver.id),
                                  currentAssigned: selectedEvent.assignedDriverIds || [],
                                  currentTentative: selectedEvent.tentativeDriverIds || [],
                                  tentative: false,
                                });
                              }}
                            >
                              {assigningDriverId === driver.id ? (
                                <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                              ) : (
                                <Check className="w-3 h-3 mr-1" />
                              )}
                              {selectedEvent.assignedDriverIds?.includes(String(driver.id)) ? 'Confirmed' : 'Confirm'}
                            </Button>
                          </div>
                        )}
                      </Card>
                    ))}
                    {nearbyDrivers.length > 5 && (
                      <button
                        onClick={() => setShowAllNearbyDrivers(!showAllNearbyDrivers)}
                        className="w-full text-xs text-purple-700 hover:text-purple-900 font-medium py-1"
                      >
                        {showAllNearbyDrivers
                          ? 'Show top 5'
                          : `View ${nearbyDrivers.length - 5} more drivers`}
                      </button>
                    )}
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
                        onClick={() => window.location.href = '/dashboard?section=drivers'}
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

      {/* Main Content - Tablet 2-Panel Layout (md to lg) */}
      <div className="flex-1 hidden md:flex lg:hidden overflow-hidden">
        {/* Left Panel - Event List */}
        <div className="w-72 border-r bg-gray-50 flex flex-col" data-testid="driver-planning-events-list-tablet">
          <div className="p-3 border-b bg-white space-y-2">
            <h2 className="font-semibold text-gray-900 flex items-center gap-2 text-sm">
              <Calendar className="w-4 h-4 text-[#007E8C]" />
              Events ({events.length}{showOnlyUnmetStaffing ? ` of ${upcomingEvents.length}` : ''})
            </h2>
            <label className="flex items-center gap-2 text-xs cursor-pointer">
              <input
                type="checkbox"
                checked={showOnlyUnmetStaffing}
                onChange={(e) => setShowOnlyUnmetStaffing(e.target.checked)}
                className="rounded border-gray-300 text-[#007E8C] focus:ring-[#007E8C]"
              />
              <span className="text-gray-600">Needing drivers only</span>
            </label>
          </div>
          <ScrollArea className="flex-1">
            <div className="p-2 space-y-2">
              {events.map((event) => {
                const isSelected = selectedEvent?.id === event.id;
                const eventDate = event.scheduledEventDate || event.desiredEventDate;
                const driversAssigned = event.assignedDriverIds?.length || 0;
                const driversTentative = event.tentativeDriverIds?.length || 0;
                const driversNeeded = event.driversNeeded || 0;
                const hasDriverRequirement = driversNeeded > 0 || event.vanDriverNeeded;
                const driversFulfilled =
                  driversAssigned >= driversNeeded &&
                  (!event.vanDriverNeeded || !!event.assignedVanDriverId || !!event.isDhlVan);

                return (
                  <Card
                    key={event.id}
                    className={`p-2 cursor-pointer transition-all ${
                      isSelected
                        ? 'ring-2 ring-[#007E8C] bg-[#007E8C]/5'
                        : 'hover:shadow-md hover:bg-white'
                    }`}
                    onClick={() => {
                      setSelectedEvent(isSelected ? null : event);
                      setShowAllHosts(false);
                      setShowAllRecipients(false);
                    }}
                  >
                    <div className="space-y-1">
                      <h3 className="font-medium text-xs text-gray-900 line-clamp-1">
                        {event.organizationName || 'Unknown'}
                      </h3>
                      <div className="flex items-center gap-1 text-xs text-gray-600">
                        <Calendar className="w-3 h-3" />
                        {eventDate ? format(parseLocalDate(eventDate), 'MMM d') : 'No date'}
                      </div>
                      {event.selfTransport ? (
                        <Badge variant="secondary" className="text-[10px] px-1 py-0">
                          Self
                        </Badge>
                      ) : hasDriverRequirement ? (
                        <Badge
                          variant={driversFulfilled ? 'default' : 'destructive'}
                          className="text-[10px] px-1 py-0"
                        >
                          {driversAssigned}{driversTentative > 0 && <span className="text-amber-300">+{driversTentative}?</span>}/{driversNeeded}
                          {event.vanDriverNeeded && (event.isDhlVan ? '+DHL' : (event.assignedVanDriverId ? '+Van' : '+Van!'))}
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-[10px] px-1 py-0 text-gray-400">
                          No req
                        </Badge>
                      )}
                      {isSelected && (
                        <div className="pt-2 border-t border-gray-100 space-y-1">
                          {getAssignedStaffLabel(event) && (
                            <div className="text-[11px] text-gray-700">
                              <span className="font-semibold">Assigned staff:</span>{' '}
                              <span className="text-gray-600">{getAssignedStaffLabel(event)}</span>
                            </div>
                          )}
                          {getAssignedDriversLabel(event) && (
                            <div className="text-[11px] text-gray-700">
                              <span className="font-semibold">Assigned drivers:</span>{' '}
                              <span className="text-gray-600">{getAssignedDriversLabel(event)}</span>
                            </div>
                          )}
                          {getDesignatedRecipientLabel(event) && (
                            <div className="text-[11px] text-gray-700">
                              <span className="font-semibold">Recipient:</span>{' '}
                              <span className="text-gray-600">{getDesignatedRecipientLabel(event)}</span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </Card>
                );
              })}
              {events.length === 0 && (
                <div className="text-center py-4 text-gray-500">
                  <Calendar className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  <p className="text-xs">
                    {showOnlyUnmetStaffing && upcomingEvents.length > 0
                      ? 'All staffed!'
                      : 'No events'}
                  </p>
                </div>
              )}
            </div>
          </ScrollArea>
        </div>

        {/* Right Panel - Map + Details overlay */}
        <div className="flex-1 relative" data-testid="driver-planning-map-tablet">
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
            <MapController
              selectedEvent={selectedEvent}
              events={upcomingEventsWithCoords}
              focusedItem={focusedItem}
              nearbyHosts={nearbyHosts}
              nearbyRecipients={nearbyRecipients}
              designatedRecipients={designatedRecipients}
            />
            {upcomingEventsWithCoords.map((event) => (
              <Marker
                key={event.id}
                position={[parseFloat(event.latitude!), parseFloat(event.longitude!)]}
                icon={selectedEvent?.id === event.id ? selectedEventIcon : eventIcon}
                eventHandlers={{
                  click: () => setSelectedEvent(event)
                }}
              >
                <Popup>
                  <div className="p-2 min-w-[180px]">
                    <h3 className="font-semibold text-sm">{event.organizationName}</h3>
                    <p className="text-xs text-gray-600">{event.eventAddress}</p>
                  </div>
                </Popup>
              </Marker>
            ))}
            {selectedEvent && nearbyHosts.map((host) => (
              <Marker
                key={`host-${host.id}`}
                position={[parseFloat(host.latitude), parseFloat(host.longitude)]}
                icon={focusedItem?.type === 'host' && focusedItem?.id === host.id ? hostFocusedIcon : hostIcon}
              >
                <Popup>
                  <div className="p-2">
                    <h3 className="font-semibold text-green-700 text-sm">{host.contactName}</h3>
                    <p className="text-xs text-gray-500">{host.distance.toFixed(1)} mi away</p>
                  </div>
                </Popup>
              </Marker>
            ))}
            {selectedEvent && designatedRecipients.map((recipient) => (
              <Marker
                key={`designated-recipient-${recipient.id}`}
                position={[parseFloat(recipient.latitude), parseFloat(recipient.longitude)]}
                icon={focusedItem?.type === 'recipient' && focusedItem?.id === recipient.id ? recipientFocusedIcon : recipientIcon}
              >
                <Popup>
                  <div className="p-2">
                    <div className="text-[10px] font-semibold text-purple-700 uppercase tracking-wide">Designated Recipient</div>
                    <h3 className="font-semibold text-purple-700 text-sm">{recipient.name}</h3>
                  </div>
                </Popup>
              </Marker>
            ))}

            {selectedEvent && nonDesignatedNearbyRecipients.map((recipient) => (
              <Marker
                key={`recipient-${recipient.id}`}
                position={[parseFloat(recipient.latitude), parseFloat(recipient.longitude)]}
                icon={focusedItem?.type === 'recipient' && focusedItem?.id === recipient.id ? recipientFocusedIcon : recipientIcon}
              >
                <Popup>
                  <div className="p-2">
                    <h3 className="font-semibold text-purple-700 text-sm">{recipient.name}</h3>
                    <p className="text-xs text-gray-500">{recipient.distance.toFixed(1)} mi away</p>
                  </div>
                </Popup>
              </Marker>
            ))}
            {/* Show all driver candidates with geocoded coordinates */}
            {driverCandidates
              .filter((driver) => driver.latitude && driver.longitude)
              .map((driver) => (
              <Marker
                key={`driver-${driver.id}`}
                position={[parseFloat(driver.latitude), parseFloat(driver.longitude)]}
                icon={driverIcon}
              >
                <Popup>
                  <div className="p-2 min-w-[180px]">
                    <h3 className="font-semibold text-yellow-700 text-sm flex items-center gap-1">
                      <Truck className="w-3 h-3" />
                      {driver.name} <span className="text-gray-400 text-[11px]">({driver.source})</span>
                    </h3>
                    <p className="text-xs text-gray-600">
                      {driver.hostLocation || 'Driver location'}
                    </p>
                    {driver.phone && (
                      <p className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                        <Phone className="w-3 h-3" />
                        {driver.phone}
                      </p>
                    )}
                    {driver.vanApproved && (
                      <p className="text-xs text-green-600 mt-1">Van Approved</p>
                    )}
                  </div>
                </Popup>
              </Marker>
            ))}
          </MapContainer>

          {/* Tablet Details Panel - Bottom overlay when event selected */}
          {selectedEvent && (
            <div className="absolute bottom-0 left-0 right-0 bg-white border-t shadow-lg max-h-[40%] overflow-y-auto z-[1000]">
              <div className="p-3 border-b sticky top-0 bg-white flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-sm">{selectedEvent.organizationName}</h3>
                  <p className="text-xs text-gray-500">{extractCityFromAddress(selectedEvent.eventAddress)}</p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={() => setSelectedEvent(null)}
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
              <div className="p-3 space-y-3">
                {/* Nearby Hosts */}
                <div>
                  <h4 className="text-xs font-semibold text-gray-700 mb-2 flex items-center gap-1">
                    <Building2 className="w-3 h-3 text-green-600" />
                    Nearby Hosts ({nearbyHosts.length})
                  </h4>
                  <div className="flex gap-2 overflow-x-auto pb-2">
                    {nearbyHosts.slice(0, 5).map((host) => (
                      <div key={host.id} className="flex-shrink-0 text-xs p-2 bg-green-50 border border-green-200 rounded min-w-[120px]">
                        <div className="font-medium">{host.contactName}</div>
                        <div className="text-green-700">{host.distance.toFixed(1)} mi</div>
                      </div>
                    ))}
                  </div>
                </div>
                {/* Nearby Recipients */}
                <div>
                  <h4 className="text-xs font-semibold text-gray-700 mb-2 flex items-center gap-1">
                    <Heart className="w-3 h-3 text-purple-600" />
                    Nearby Recipients ({nearbyRecipients.length})
                  </h4>
                  <div className="flex gap-2 overflow-x-auto pb-2">
                    {nearbyRecipients.slice(0, 5).map((recipient) => (
                      <div key={recipient.id} className="flex-shrink-0 text-xs p-2 bg-purple-50 border border-purple-200 rounded min-w-[120px]">
                        <div className="font-medium">{recipient.name}</div>
                        <div className="text-purple-700">{recipient.distance.toFixed(1)} mi</div>
                      </div>
                    ))}
                  </div>
                </div>
                {/* Suggested Drivers */}
                {suggestedDrivers.length > 0 && (
                  <div>
                    <h4 className="text-xs font-semibold text-gray-700 mb-2 flex items-center gap-1">
                      <Truck className="w-3 h-3 text-[#007E8C]" />
                      Suggested Drivers ({suggestedDrivers.length})
                    </h4>
                    <div className="space-y-2">
                      {suggestedDrivers.slice(0, 3).map((driver) => (
                        <div key={driver.id} className="text-xs p-2 bg-gray-50 border rounded flex items-center justify-between">
                          <div>
                            <div className="font-medium">{driver.name}</div>
                            <div className="text-gray-500">{driver.phone}</div>
                          </div>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs"
                            onClick={() => copyDriverSMS(driver)}
                          >
                            {copiedDriverId === driver.id ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Main Content - Mobile Layout (< md) */}
      <div className="flex-1 md:hidden flex flex-col" data-testid="driver-planning-mobile">
        {/* Map - Expands to full screen when mobileFullscreenMap is true */}
        <div
          className={`relative transition-all duration-300 ${
            mobileFullscreenMap
              ? 'h-[calc(100dvh-60px)]'
              : mobileEventsCollapsed
                ? 'h-[calc(100dvh-120px)]'
                : 'h-[55dvh] min-h-[280px]'
          }`}
        >
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
            <MapController
              selectedEvent={selectedEvent}
              events={upcomingEventsWithCoords}
              focusedItem={focusedItem}
              nearbyHosts={nearbyHosts}
              nearbyRecipients={nearbyRecipients}
              designatedRecipients={designatedRecipients}
            />
            {upcomingEventsWithCoords.map((event) => (
              <Marker
                key={event.id}
                position={[parseFloat(event.latitude!), parseFloat(event.longitude!)]}
                icon={selectedEvent?.id === event.id ? selectedEventIcon : eventIcon}
                eventHandlers={{
                  click: () => {
                    setSelectedEvent(event);
                    setMobilePanel('details');
                  }
                }}
              >
                <Popup>
                  <div className="p-2">
                    <h3 className="font-semibold text-sm">{event.organizationName}</h3>
                    <p className="text-xs text-gray-600">{event.eventAddress}</p>
                  </div>
                </Popup>
              </Marker>
            ))}
            {selectedEvent && nearbyHosts.map((host) => (
              <Marker
                key={`host-${host.id}`}
                position={[parseFloat(host.latitude), parseFloat(host.longitude)]}
                icon={focusedItem?.type === 'host' && focusedItem?.id === host.id ? hostFocusedIcon : hostIcon}
              >
                <Popup>
                  <div className="p-2">
                    <h3 className="font-semibold text-green-700 text-sm">{host.contactName}</h3>
                    <p className="text-xs">{host.distance.toFixed(1)} mi</p>
                  </div>
                </Popup>
              </Marker>
            ))}
            {selectedEvent && designatedRecipients.map((recipient) => (
              <Marker
                key={`designated-recipient-${recipient.id}`}
                position={[parseFloat(recipient.latitude), parseFloat(recipient.longitude)]}
                icon={focusedItem?.type === 'recipient' && focusedItem?.id === recipient.id ? recipientFocusedIcon : recipientIcon}
              >
                <Popup>
                  <div className="p-2">
                    <div className="text-[10px] font-semibold text-purple-700 uppercase tracking-wide">Designated Recipient</div>
                    <h3 className="font-semibold text-purple-700 text-sm">{recipient.name}</h3>
                  </div>
                </Popup>
              </Marker>
            ))}

            {selectedEvent && nonDesignatedNearbyRecipients.map((recipient) => (
              <Marker
                key={`recipient-${recipient.id}`}
                position={[parseFloat(recipient.latitude), parseFloat(recipient.longitude)]}
                icon={focusedItem?.type === 'recipient' && focusedItem?.id === recipient.id ? recipientFocusedIcon : recipientIcon}
              >
                <Popup>
                  <div className="p-2">
                    <h3 className="font-semibold text-purple-700 text-sm">{recipient.name}</h3>
                    <p className="text-xs">{recipient.distance.toFixed(1)} mi</p>
                  </div>
                </Popup>
              </Marker>
            ))}
          </MapContainer>

          {/* Mobile Map Controls - Top Right */}
          <div className="absolute top-3 right-3 flex flex-col gap-2 z-[1000]">
            {/* Fullscreen Toggle Button */}
            <Button
              variant="secondary"
              size="icon"
              className="h-10 w-10 bg-white shadow-lg border"
              onClick={() => {
                setMobileFullscreenMap(!mobileFullscreenMap);
                if (!mobileFullscreenMap) {
                  setMobileEventsCollapsed(true);
                }
              }}
              data-testid="btn-toggle-fullscreen-map"
            >
              {mobileFullscreenMap ? (
                <Minimize2 className="w-5 h-5 text-gray-700" />
              ) : (
                <Maximize2 className="w-5 h-5 text-gray-700" />
              )}
            </Button>
            
            {/* Show Events List Button - only visible in fullscreen mode */}
            {mobileFullscreenMap && (
              <Button
                variant="secondary"
                size="icon"
                className="h-10 w-10 bg-white shadow-lg border"
                onClick={() => {
                  setMobileFullscreenMap(false);
                  setMobileEventsCollapsed(false);
                }}
                data-testid="btn-show-events-list"
              >
                <List className="w-5 h-5 text-gray-700" />
              </Button>
            )}
          </div>

          {/* Mobile Legend - repositioned */}
          <div className="absolute top-3 left-3 bg-white rounded-lg shadow-lg p-2 z-[1000]">
            <div className="text-[10px] font-semibold mb-1">Legend</div>
            <div className="space-y-0.5 text-[10px]">
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-full bg-blue-500" />
                <span>Event</span>
              </div>
              {selectedEvent && (
                <>
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 rounded-full bg-green-500" />
                    <span>Host</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 rounded-full bg-purple-500" />
                    <span>Recipient</span>
                  </div>
                </>
              )}
            </div>
          </div>
          
          {/* Selected Event Quick Info - Bottom of map in fullscreen mode */}
          {mobileFullscreenMap && selectedEvent && (
            <div className="absolute bottom-4 left-3 right-3 bg-white rounded-lg shadow-lg p-3 z-[1000]">
              <div className="flex items-center justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <h4 className="font-medium text-sm truncate">{selectedEvent.organizationName}</h4>
                  <div className="flex items-center gap-2 text-xs text-gray-600 mt-1">
                    <Calendar className="w-3 h-3 flex-shrink-0" />
                    <span>
                      {selectedEvent.scheduledEventDate || selectedEvent.desiredEventDate
                        ? format(parseLocalDate(selectedEvent.scheduledEventDate || selectedEvent.desiredEventDate!), 'EEE, MMM d')
                        : 'No date'}
                    </span>
                    {(() => {
                      const totalDrivers = (selectedEvent.assignedDriverIds?.length || 0) +
                                          (selectedEvent.assignedVanDriverId ? 1 : 0) +
                                          (selectedEvent.isDhlVan ? 1 : 0);
                      const needed = selectedEvent.driversNeeded || 0;
                      const fulfilled = totalDrivers >= needed;
                      const tentative = selectedEvent.tentativeDriverIds?.length || 0;

                      if (selectedEvent.selfTransport) {
                        return <Badge variant="secondary" className="text-[10px] px-1.5">Self</Badge>;
                      }
                      if (needed > 0) {
                        return (
                          <Badge
                            variant={fulfilled ? 'default' : 'destructive'}
                            className="text-[10px] px-1.5"
                          >
                            {totalDrivers}{tentative > 0 && <span className="text-amber-300">+{tentative}?</span>}/{needed}
                            {selectedEvent.isDhlVan
                              ? ' DHL'
                              : selectedEvent.assignedVanDriverId
                                ? ' van'
                                : ''}
                          </Badge>
                        );
                      }
                      return <Badge variant="outline" className="text-[10px] px-1.5 text-gray-400">No req</Badge>;
                    })()}
                  </div>
                </div>
                <Button
                  size="sm"
                  className="h-9 px-3"
                  onClick={() => setMobilePanel('details')}
                  data-testid="btn-view-event-details"
                >
                  Details
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Collapsible Events List - Hidden in fullscreen mode */}
        {!mobileFullscreenMap && (
          <div className={`bg-white border-t flex flex-col transition-all duration-300 ${
            mobileEventsCollapsed ? 'h-14' : 'flex-1 min-h-[280px]'
          }`}>
            {/* Collapsible Header */}
            <button
              className="p-3 border-b flex items-center justify-between w-full text-left"
              onClick={() => setMobileEventsCollapsed(!mobileEventsCollapsed)}
              data-testid="btn-toggle-events-panel"
            >
              <div className="flex items-center gap-2">
                <Calendar className="w-5 h-5 text-[#007E8C]" />
                <span className="font-semibold text-sm">Events ({events.length}{showOnlyUnmetStaffing ? `/${upcomingEvents.length}` : ''})</span>
                {selectedEvent && mobileEventsCollapsed && (
                  <Badge variant="outline" className="text-[10px]">
                    {selectedEvent.organizationName?.substring(0, 15)}...
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-2">
                {!mobileEventsCollapsed && (
                  <Select value={weeksAhead} onValueChange={setWeeksAhead}>
                    <SelectTrigger className="w-24 h-7 text-xs" onClick={(e) => e.stopPropagation()}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="2">2 weeks</SelectItem>
                      <SelectItem value="4">4 weeks</SelectItem>
                      <SelectItem value="6">6 weeks</SelectItem>
                      <SelectItem value="8">8 weeks</SelectItem>
                    </SelectContent>
                  </Select>
                )}
                {mobileEventsCollapsed ? (
                  <ChevronUp className="w-5 h-5 text-gray-400" />
                ) : (
                  <ChevronDown className="w-5 h-5 text-gray-400" />
                )}
              </div>
            </button>

            {/* Filter Toggles */}
            {!mobileEventsCollapsed && (
              <div className="px-3 py-2 border-b bg-gray-50 space-y-2">
                <label className="flex items-center gap-2 text-xs cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showOnlyUnmetStaffing}
                    onChange={(e) => setShowOnlyUnmetStaffing(e.target.checked)}
                    className="rounded border-gray-300 text-[#007E8C] focus:ring-[#007E8C]"
                  />
                  <span className="text-gray-600">Only show events needing drivers</span>
                </label>
                <label className="flex items-center gap-2 text-xs cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showPendingEvents}
                    onChange={(e) => setShowPendingEvents(e.target.checked)}
                    className="rounded border-gray-300 text-[#007E8C] focus:ring-[#007E8C]"
                  />
                  <span className="text-gray-600">Include pending/new requests</span>
                </label>
              </div>
            )}

            {/* Events List Content */}
            {!mobileEventsCollapsed && (
              <ScrollArea className="flex-1">
                <div className="p-3 space-y-2">
                  {events.map((event) => {
                    const isSelected = selectedEvent?.id === event.id;
                    const eventDate = event.scheduledEventDate || event.desiredEventDate;
                    const driversAssigned = event.assignedDriverIds?.length || 0;
                    const driversTentative = event.tentativeDriverIds?.length || 0;
                    const driversNeeded = event.driversNeeded || 0;
                    const hasDriverRequirement = driversNeeded > 0 || event.vanDriverNeeded;

                    return (
                      <Card
                        key={event.id}
                        className={`p-3 cursor-pointer transition-all active:scale-[0.98] ${
                          isSelected
                            ? 'ring-2 ring-[#007E8C] bg-[#007E8C]/5'
                            : 'hover:shadow-md active:bg-gray-50'
                        }`}
                        onClick={() => {
                          setSelectedEvent(isSelected ? null : event);
                          setShowAllHosts(false);
                          setShowAllRecipients(false);
                          if (!isSelected) {
                            setMobilePanel('details');
                          }
                        }}
                        data-testid={`event-card-${event.id}`}
                      >
                        <div className="space-y-2">
                          <div className="flex items-start justify-between gap-2">
                            <h3 className="font-medium text-sm text-gray-900 line-clamp-1">
                              {event.organizationName || 'Unknown Organization'}
                            </h3>
                            <ChevronRight className={`w-5 h-5 text-gray-400 flex-shrink-0 transition-transform ${isSelected ? 'rotate-90' : ''}`} />
                          </div>
                          <div className="flex items-center gap-2 text-xs text-gray-700">
                            <Calendar className="w-4 h-4 flex-shrink-0" />
                            <span className="font-medium">
                              {eventDate ? format(parseLocalDate(eventDate), 'EEE, MMM d') : 'No date'}
                            </span>
                            {event.eventStartTime && (
                              <span className="text-gray-500">
                                at {formatTime12Hour(event.eventStartTime)}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 text-xs text-gray-500">
                            <MapPin className="w-4 h-4 flex-shrink-0" />
                            <span className="line-clamp-1">{extractCityFromAddress(event.eventAddress) || event.eventAddress}</span>
                          </div>
                          <div className="flex items-center gap-2 flex-wrap">
                            {event.selfTransport ? (
                              <Badge variant="secondary" className="text-xs px-2 py-0.5">
                                Self-transport
                              </Badge>
                            ) : hasDriverRequirement ? (
                              <Badge
                                variant={driversAssigned >= driversNeeded && (!event.vanDriverNeeded || event.assignedVanDriverId || event.isDhlVan) ? 'default' : 'destructive'}
                                className="text-xs px-2 py-0.5"
                              >
                                <Truck className="w-3.5 h-3.5 mr-1" />
                                {driversAssigned}{driversTentative > 0 && <span className="text-amber-300">+{driversTentative}?</span>}/{driversNeeded} drivers
                                {event.vanDriverNeeded && (
                                  event.isDhlVan ? ' + DHL van' : (event.assignedVanDriverId ? ' + Van' : ' + Van needed')
                                )}
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-xs px-2 py-0.5 text-gray-400">
                                No driver requirement
                              </Badge>
                            )}
                            {event.estimatedSandwichCount && (
                              <span className="text-xs text-gray-500">~{event.estimatedSandwichCount} sandwiches</span>
                            )}
                          </div>
                        </div>
                      </Card>
                    );
                  })}
                  {events.length === 0 && (
                    <div className="text-center py-8 text-gray-500">
                      <Calendar className="w-12 h-12 mx-auto mb-2 opacity-30" />
                      <p className="text-sm">
                        {showOnlyUnmetStaffing && upcomingEvents.length > 0
                          ? 'All events have drivers assigned!'
                          : 'No scheduled events in this period'}
                      </p>
                      {showOnlyUnmetStaffing && upcomingEvents.length > 0 && (
                        <Button
                          variant="link"
                          size="sm"
                          onClick={() => setShowOnlyUnmetStaffing(false)}
                          className="text-[#007E8C] mt-2"
                        >
                          Show all {upcomingEvents.length} events
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              </ScrollArea>
            )}
          </div>
        )}
      </div>

      {/* Mobile Details Sheet */}
      <Sheet open={mobilePanel === 'details' && selectedEvent !== null} onOpenChange={(open) => setMobilePanel(open ? 'details' : null)}>
        <SheetContent side="bottom" className="h-[80vh] p-0">
          <SheetHeader className="p-4 border-b">
            <SheetTitle className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-[#007E8C]" />
                <span className="truncate">{selectedEvent?.organizationName || 'Event Details'}</span>
              </div>
              {canEditEvents && selectedEvent && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={openEditDialog}
                >
                  <Edit2 className="w-4 h-4" />
                </Button>
              )}
            </SheetTitle>
          </SheetHeader>
          <ScrollArea className="h-[calc(80vh-80px)]">
            {selectedEvent && (
              <div className="p-4 space-y-4">
                {/* Event Info */}
                <div className="bg-gray-50 rounded-lg p-3 space-y-2">
                  <div className="flex items-center gap-2 text-sm">
                    <Calendar className="w-4 h-4 text-gray-500" />
                    <span>
                      {selectedEvent.scheduledEventDate || selectedEvent.desiredEventDate
                        ? format(parseLocalDate(selectedEvent.scheduledEventDate || selectedEvent.desiredEventDate!), 'EEEE, MMMM d, yyyy')
                        : 'No date'}
                    </span>
                  </div>
                  {selectedEvent.eventStartTime && (
                    <div className="flex items-center gap-2 text-sm">
                      <Clock className="w-4 h-4 text-gray-500" />
                      <span>{formatTime12Hour(selectedEvent.eventStartTime)}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-2 text-sm">
                    <MapPin className="w-4 h-4 text-gray-500" />
                    <span>{selectedEvent.eventAddress}</span>
                  </div>
                  {selectedEvent.estimatedSandwichCount && (
                    <div className="flex items-center gap-2 text-sm">
                      <Package className="w-4 h-4 text-gray-500" />
                      <span>~{selectedEvent.estimatedSandwichCount} sandwiches</span>
                    </div>
                  )}
                </div>

                {/* Assignments */}
                <div className="bg-white rounded-lg border p-3 space-y-2">
                  <div className="text-sm font-semibold text-gray-700">Assignments</div>
                  {getAssignedStaffLabel(selectedEvent) && (
                    <div className="text-sm text-gray-700">
                      <span className="font-medium">Assigned staff:</span>{' '}
                      {getAssignedStaffLabel(selectedEvent)}
                    </div>
                  )}
                  {getAssignedDriversLabel(selectedEvent) && (
                    <div className="text-sm text-gray-700">
                      <span className="font-medium">Assigned drivers:</span>{' '}
                      {getAssignedDriversLabel(selectedEvent)}
                    </div>
                  )}
                  {getDesignatedRecipientLabel(selectedEvent) && (
                    <div className="text-sm text-gray-700">
                      <span className="font-medium">Recipient:</span>{' '}
                      {getDesignatedRecipientLabel(selectedEvent)}
                    </div>
                  )}
                  {!getAssignedStaffLabel(selectedEvent) && !getAssignedDriversLabel(selectedEvent) && !getDesignatedRecipientLabel(selectedEvent) && (
                    <div className="text-sm text-gray-500">No assignments yet.</div>
                  )}
                </div>

                {/* Nearby Hosts */}
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-green-600" />
                    Nearby Hosts ({nearbyHosts.length})
                  </h3>
                  {nearbyHosts.length > 0 ? (
                    <div className="space-y-2">
                      {(showAllHosts ? nearbyHosts : nearbyHosts.slice(0, 3)).map((host) => (
                        <button
                          key={host.id}
                          onClick={() => {
                            setFocusedItem({
                              type: 'host',
                              id: host.id,
                              latitude: host.latitude,
                              longitude: host.longitude
                            });
                            setMobilePanel(null);
                          }}
                          className={`w-full text-left text-sm p-3 border rounded-lg transition-colors ${
                            focusedItem?.type === 'host' && focusedItem?.id === host.id
                              ? 'bg-green-100 border-green-400'
                              : 'bg-green-50 border-green-200 hover:bg-green-100'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-medium">{host.contactName}</span>
                            <span className="text-green-700">{host.distance.toFixed(1)} mi</span>
                          </div>
                          <div className="text-xs text-gray-500 mt-1">{host.hostLocationName}</div>
                        </button>
                      ))}
                      {nearbyHosts.length > 3 && (
                        <button
                          onClick={() => setShowAllHosts(!showAllHosts)}
                          className="w-full text-sm text-green-700 font-medium py-2"
                        >
                          {showAllHosts ? 'Show less' : `View ${nearbyHosts.length - 3} more hosts`}
                        </button>
                      )}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500 p-3 bg-gray-100 rounded-lg">No nearby hosts found</p>
                  )}
                </div>

                {/* Nearby Recipients */}
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                    <Heart className="w-4 h-4 text-purple-600" />
                    Nearby Recipients ({nearbyRecipients.length})
                  </h3>
                  {nearbyRecipients.length > 0 ? (
                    <div className="space-y-2">
                      {(showAllRecipients ? nearbyRecipients : nearbyRecipients.slice(0, 3)).map((recipient) => (
                        <button
                          key={recipient.id}
                          onClick={() => {
                            setFocusedItem({
                              type: 'recipient',
                              id: recipient.id,
                              latitude: recipient.latitude,
                              longitude: recipient.longitude
                            });
                            setMobilePanel(null);
                          }}
                          className={`w-full text-left text-sm p-3 border rounded-lg transition-colors ${
                            focusedItem?.type === 'recipient' && focusedItem?.id === recipient.id
                              ? 'bg-purple-100 border-purple-400'
                              : 'bg-purple-50 border-purple-200 hover:bg-purple-100'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-medium">{recipient.name}</span>
                            <span className="text-purple-700">{recipient.distance.toFixed(1)} mi</span>
                          </div>
                          {recipient.estimatedSandwiches && (
                            <div className="text-xs text-gray-600 mt-1">
                              Needs ~{recipient.estimatedSandwiches} sandwiches
                            </div>
                          )}
                        </button>
                      ))}
                      {nearbyRecipients.length > 3 && (
                        <button
                          onClick={() => setShowAllRecipients(!showAllRecipients)}
                          className="w-full text-sm text-purple-700 font-medium py-2"
                        >
                          {showAllRecipients ? 'Show less' : `View ${nearbyRecipients.length - 3} more recipients`}
                        </button>
                      )}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500 p-3 bg-gray-100 rounded-lg">No nearby recipients found</p>
                  )}
                </div>

                {/* Nearby Drivers with Distance */}
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                    <Truck className="w-4 h-4 text-[#007E8C]" />
                    Closest Drivers ({nearbyDrivers.length})
                  </h3>
                  {nearbyDrivers.length > 0 ? (
                    <div className="space-y-2">
                      {(showAllNearbyDrivers ? nearbyDrivers : nearbyDrivers.slice(0, 5)).map(({ driver, distance }) => (
                        <Card key={driver.id} className="p-3">
                          <div className="space-y-2">
                            <div className="flex items-start justify-between">
                              <div className="flex-1 min-w-0">
                                <h4 className="font-medium text-sm truncate">{driver.name}</h4>
                                <p className="text-xs text-gray-500 truncate">
                                  {driver.hostLocation || driver.area || driver.routeDescription || 'No location'}
                                </p>
                                <p className="text-[11px] text-[#007E8C] font-medium mt-1">
                                  {distance.toFixed(1)} miles away
                                </p>
                              </div>
                              <Badge
                                variant={driver.availability === 'available' ? 'default' : 'secondary'}
                                className="text-xs flex-shrink-0"
                              >
                                {driver.availability || 'Unknown'}
                              </Badge>
                            </div>
                            <div className="flex items-center gap-3 text-xs text-gray-600 flex-wrap">
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
                            <div className="grid grid-cols-2 gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-xs h-8"
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
                                    SMS
                                  </>
                                )}
                              </Button>
                              {/* Tentative assignment button */}
                              <Button
                                size="sm"
                                variant={selectedEvent?.tentativeDriverIds?.includes(String(driver.id)) ? 'default' : 'outline'}
                                className="text-xs h-8"
                                disabled={assigningDriverId === driver.id}
                                onClick={() => {
                                  if (!selectedEvent) return;
                                  setAssigningDriverId(driver.id);
                                  assignDriverMutation.mutate({
                                    eventId: selectedEvent.id,
                                    driverId: String(driver.id),
                                    currentAssigned: selectedEvent.assignedDriverIds || [],
                                    currentTentative: selectedEvent.tentativeDriverIds || [],
                                    tentative: true,
                                  });
                                }}
                              >
                                {assigningDriverId === driver.id ? (
                                  <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                                ) : (
                                  <span className="mr-1 font-bold">?</span>
                                )}
                                {selectedEvent?.tentativeDriverIds?.includes(String(driver.id)) ? 'Tentative' : 'Maybe'}
                              </Button>
                              {/* Confirmed assignment button */}
                              <Button
                                size="sm"
                                className="text-xs h-8"
                                disabled={assigningDriverId === driver.id}
                                onClick={() => {
                                  if (!selectedEvent) return;
                                  setAssigningDriverId(driver.id);
                                  assignDriverMutation.mutate({
                                    eventId: selectedEvent.id,
                                    driverId: String(driver.id),
                                    currentAssigned: selectedEvent.assignedDriverIds || [],
                                    currentTentative: selectedEvent.tentativeDriverIds || [],
                                    tentative: false,
                                  });
                                }}
                              >
                                {assigningDriverId === driver.id ? (
                                  <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                                ) : (
                                  <Check className="w-3 h-3 mr-1" />
                                )}
                                {selectedEvent?.assignedDriverIds?.includes(String(driver.id)) ? 'Confirmed' : 'Confirm'}
                              </Button>
                            </div>
                          </div>
                        </Card>
                      ))}
                      {nearbyDrivers.length > 5 && (
                        <button
                          onClick={() => setShowAllNearbyDrivers(!showAllNearbyDrivers)}
                          className="w-full text-sm text-[#007E8C] font-medium py-2"
                        >
                          {showAllNearbyDrivers ? 'Show top 5' : `View ${nearbyDrivers.length - 5} more drivers`}
                        </button>
                      )}
                    </div>
                  ) : (
                    <div className="text-center py-4 text-gray-500 bg-gray-100 rounded-lg">
                      <AlertCircle className="w-6 h-6 mx-auto mb-2 opacity-40" />
                      <p className="text-sm">No drivers with location data found</p>
                      <p className="text-xs mt-1 text-gray-400">Add area/location to drivers to see suggestions</p>
                    </div>
                  )}
                </div>

                {/* Drivers needing location */}
                {driversWithoutLocation.length > 0 && (
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                    <h4 className="text-xs font-semibold text-amber-800 flex items-center gap-1">
                      <AlertCircle className="w-3.5 h-3.5" />
                      {driversWithoutLocation.length} drivers need location data
                    </h4>
                    <p className="text-xs text-amber-700 mt-1">
                      Add area/location info to see more driver suggestions.
                    </p>
                  </div>
                )}
              </div>
            )}
          </ScrollArea>
        </SheetContent>
      </Sheet>

      {/* Edit Event Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg">Edit Event Details</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="driversNeeded" className="text-sm">Drivers Needed</Label>
              <Input
                id="driversNeeded"
                type="number"
                min="1"
                value={editForm.driversNeeded}
                onChange={(e) => setEditForm({ ...editForm, driversNeeded: e.target.value })}
                placeholder="e.g. 2"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pickupTime" className="text-sm">Pickup Time</Label>
              <Input
                id="pickupTime"
                type="time"
                value={editForm.pickupTime}
                onChange={(e) => setEditForm({ ...editForm, pickupTime: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="eventStartTime" className="text-sm">Event Start</Label>
                <Input
                  id="eventStartTime"
                  type="time"
                  value={editForm.eventStartTime}
                  onChange={(e) => setEditForm({ ...editForm, eventStartTime: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="eventEndTime" className="text-sm">Event End</Label>
                <Input
                  id="eventEndTime"
                  type="time"
                  value={editForm.eventEndTime}
                  onChange={(e) => setEditForm({ ...editForm, eventEndTime: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="pickupTimeWindow" className="text-sm">Pickup Time Window</Label>
              <Input
                id="pickupTimeWindow"
                value={editForm.pickupTimeWindow}
                onChange={(e) => setEditForm({ ...editForm, pickupTimeWindow: e.target.value })}
                placeholder="e.g. 30 minutes"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={saveEditForm}
              disabled={updateEventMutation.isPending}
            >
              {updateEventMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  Save Changes
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
