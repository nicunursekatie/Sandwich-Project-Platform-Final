/**
 * Volunteer Event Hub
 *
 * A user-friendly interface for volunteers and speakers to browse and sign up
 * for events based on their calendar availability and location convenience.
 *
 * Features:
 * - Calendar view for date-based browsing
 * - Map view for location-based browsing
 * - Filter by role needed (speaker, volunteer, driver)
 * - Request to join events
 * - View own signups and status
 */

import React, { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { MapContainer, TileLayer, Marker, Popup, Tooltip, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, addMonths, subMonths, parseISO, isAfter, startOfDay } from 'date-fns';
import { useAuth } from '@/hooks/useAuth';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { formatTimeForDisplay, parseEventDate } from '@/lib/date-utils';
import { PERMISSIONS } from '@shared/auth-utils';
import { hasPermission } from '@shared/unified-auth-utils';

// UI Components
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';

// Icons
import {
  Calendar,
  MapPin,
  Clock,
  Users,
  Mic,
  Car,
  Truck,
  ChevronLeft,
  ChevronRight,
  Building2,
  Sandwich,
  Check,
  X,
  AlertCircle,
  Loader2,
  Eye,
  HandHeart,
  Filter,
  List,
  Map as MapIcon,
  CalendarDays,
  UserCheck,
  Search,
  Navigation,
  CheckCircle2,
  LocateFixed,
} from 'lucide-react';

// Fix Leaflet default marker icon
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Render an event's time range, or "Time TBD" when start time is missing.
function formatEventTime(start: string | null | undefined, end?: string | null | undefined): string {
  if (!start) return 'Time TBD';
  const formatted = formatTimeForDisplay(start);
  return end ? `${formatted} – ${formatTimeForDisplay(end)}` : formatted;
}

function getAddressText(location: {
  eventAddress?: string | null;
  city?: string | null;
  state?: string | null;
  zipCode?: string | null;
}): string {
  return [
    location.eventAddress,
    location.city,
    location.state,
    location.zipCode,
  ].filter(Boolean).join(', ');
}

function getGoogleMapsUrl(location: {
  eventAddress?: string | null;
  city?: string | null;
  state?: string | null;
  zipCode?: string | null;
}): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(getAddressText(location))}`;
}

function AddressLink({
  location,
  className,
  iconClassName = 'w-4 h-4 shrink-0 mt-0.5 text-[#007e8c]',
}: {
  location: {
    eventAddress?: string | null;
    city?: string | null;
    state?: string | null;
    zipCode?: string | null;
  };
  className?: string;
  iconClassName?: string;
}) {
  const addressText = getAddressText(location);
  if (!addressText) return null;

  return (
    <a
      href={getGoogleMapsUrl(location)}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        'flex items-start gap-2 text-sm text-muted-foreground hover:text-[#007e8c] hover:underline underline-offset-2',
        className,
      )}
      aria-label={`Open ${addressText} in Google Maps`}
    >
      <MapPin className={iconClassName} />
      <span>{addressText}</span>
    </a>
  );
}

// Types
interface AvailableEvent {
  id: number;
  organizationName: string;
  organizationCategory: string | null;
  department: string | null;
  eventAddress: string;
  city: string | null;
  state: string | null;
  zipCode: string | null;
  latitude: string | null;
  longitude: string | null;
  scheduledEventDate: string | null;
  desiredEventDate: string | null;
  eventStartTime: string | null;
  eventEndTime: string | null;
  estimatedSandwichCount: number | null;
  status: string | null;
  speakersNeeded: number;
  speakersAssigned: number;
  speakersUnfilled: number;
  volunteersNeeded: number;
  volunteersAssigned: number;
  volunteersUnfilled: number;
  driversNeeded: number;
  driversAssigned: number;
  driversUnfilled: number;
  hasUnfilledNeeds: boolean;
  vanDriverNeeded: boolean;
  selfTransport: boolean | null;
  pickupTime: string | null;
  eventNotes: string | null;
}

function getEventDateLabel(
  event: Pick<AvailableEvent, 'scheduledEventDate' | 'desiredEventDate'>,
  pattern = 'MMM d',
): string {
  const eventDate = event.scheduledEventDate || event.desiredEventDate;
  if (!eventDate) return 'Date TBD';

  const parsedDate = parseEventDate(eventDate);
  return parsedDate ? format(parsedDate, pattern) : 'Date TBD';
}

interface MySignup {
  id: number;
  eventRequestId: number;
  role: string;
  status: string;
  notes: string | null;
  signedUpAt: string;
  event: {
    id: number;
    organizationName: string;
    scheduledEventDate: string | null;
    desiredEventDate: string | null;
    eventStartTime: string | null;
    eventEndTime: string | null;
    eventAddress: string;
    city: string | null;
    state: string | null;
    status: string;
  };
}

// Custom marker icons using brand colors
const createEventIcon = (needsSpeaker: boolean, needsVolunteer: boolean, needsDriver: boolean, isCompleted = false, needsVanDriver = false) => {
  // Two-state: needs help (teal) vs filled/completed (gray). Specific role detail lives in the popup.
  const needsHelp = !isCompleted && (needsSpeaker || needsVolunteer || needsDriver || needsVanDriver);
  const color = needsHelp ? '#007e8c' : '#9ca3af';

  const html = `
    <div style="position: relative; width: 30px; height: 42px;">
      <svg viewBox="0 0 25 41" width="30" height="42" xmlns="http://www.w3.org/2000/svg">
        <path d="M12.5 0C5.6 0 0 5.6 0 12.5c0 9.4 12.5 28.5 12.5 28.5S25 21.9 25 12.5C25 5.6 19.4 0 12.5 0z" fill="${color}" stroke="white" stroke-width="1.5"/>
        <circle cx="12.5" cy="12.5" r="5" fill="white"/>
      </svg>
    </div>
  `;

  return L.divIcon({
    html,
    className: 'custom-event-marker',
    iconSize: [30, 42],
    iconAnchor: [15, 42],
    popupAnchor: [0, -35],
  });
};

// Map center setter component
function MapCenterSetter({ center }: { center: [number, number] }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, 11);
  }, [center, map]);
  return null;
}

// Haversine formula for distance between two coordinates in miles
const calculateDistanceMiles = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
  const toRad = (deg: number) => deg * Math.PI / 180;
  const R = 3959; // Earth's radius in miles
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

// Create a distinct icon for the user's location
const createUserLocationIcon = () => {
  const html = `
    <div style="position: relative; width: 24px; height: 24px;">
      <div style="width: 24px; height: 24px; background: #3b82f6; border: 3px solid white; border-radius: 50%; box-shadow: 0 2px 6px rgba(0,0,0,0.3);"></div>
      <div style="position: absolute; top: -2px; left: -2px; width: 28px; height: 28px; border: 2px solid #3b82f6; border-radius: 50%; opacity: 0.3; animation: pulse 2s infinite;"></div>
    </div>
  `;
  return L.divIcon({
    html,
    className: 'user-location-marker',
    iconSize: [24, 24],
    iconAnchor: [12, 12],
    popupAnchor: [0, -12],
  });
};

// Brand colors: #236383 (dark teal), #47b3cb (light teal), #007e8c (primary teal), #a31c41 (burgundy), #fbad3f (gold)

// Role badge component
function RoleBadge({ role }: { role: string }) {
  const config = {
    speaker: { label: 'Speaker', icon: Mic, className: 'bg-[#a31c41]/10 text-[#a31c41] border-[#a31c41]/30' },
    driver: { label: 'Driver', icon: Car, className: 'bg-[#236383]/10 text-[#236383] border-[#236383]/30' },
    general: { label: 'Volunteer', icon: UserCheck, className: 'bg-[#007e8c]/10 text-[#007e8c] border-[#007e8c]/30' },
  }[role] || { label: role, icon: Users, className: 'bg-gray-100 text-gray-800 border-gray-200' };

  const Icon = config.icon;

  return (
    <Badge variant="outline" className={cn('gap-1', config.className)}>
      <Icon className="w-3 h-3" />
      {config.label}
    </Badge>
  );
}

// Status badge component
function StatusBadge({ status }: { status: string }) {
  const config = {
    pending: { label: 'Pending Approval', className: 'bg-[#fbad3f]/20 text-[#d4910e] border-[#fbad3f]/40 font-medium' },
    confirmed: { label: 'Confirmed', className: 'bg-green-100 text-green-700 border-green-300 font-medium' },
    declined: { label: 'Declined', className: 'bg-[#a31c41]/15 text-[#a31c41] border-[#a31c41]/30' },
    assigned: { label: 'Assigned', className: 'bg-[#47b3cb]/20 text-[#236383] border-[#47b3cb]/40 font-medium' },
  }[status] || { label: status, className: 'bg-gray-100 text-gray-800 border-gray-200' };

  return (
    <Badge variant="outline" className={config.className}>
      {config.label}
    </Badge>
  );
}

// Event card component — volunteer-facing, clean and simple
function EventCard({
  event,
  onSignup,
  onAssign,
  canSelfSignup,
  canAssignOthers,
  existingSignup,
}: {
  event: AvailableEvent;
  onSignup: (eventId: number) => void;
  onAssign?: (eventId: number) => void;
  canSelfSignup: boolean;
  canAssignOthers?: boolean;
  existingSignup?: MySignup;
}) {
  const eventDate = event.scheduledEventDate || event.desiredEventDate;
  const formattedDate = eventDate
    ? format(parseEventDate(eventDate)!, 'EEEE, MMMM d, yyyy')
    : 'Date TBD';

  // Build a simple list of roles needed
  const rolesNeeded: string[] = [];
  if (event.speakersUnfilled > 0) rolesNeeded.push(`Speaker${event.speakersUnfilled > 1 ? 's' : ''}`);
  if (event.volunteersUnfilled > 0) rolesNeeded.push(`Volunteer${event.volunteersUnfilled > 1 ? 's' : ''}`);
  if (event.driversUnfilled > 0) rolesNeeded.push(`Driver${event.driversUnfilled > 1 ? 's' : ''}`);
  if (event.vanDriverNeeded) rolesNeeded.push('Van Driver');

  return (
    <Card className="hover:shadow-lg transition-all hover:border-[#47b3cb] border-l-4 border-l-[#47b3cb]">
      <CardContent className="p-4 space-y-3">
        {/* Organization name and date */}
        <div>
          <h3 className="font-semibold text-base text-[#236383]">{event.organizationName}</h3>
          {event.department && (
            <p className="text-sm text-muted-foreground">{event.department}</p>
          )}
        </div>

        {/* Date & Time — single line when possible */}
        <div className="flex items-center gap-2 text-sm">
          <Calendar className="w-4 h-4 shrink-0 text-[#007e8c]" />
          <span className="font-medium">
            {formattedDate}
            <span className="font-normal text-muted-foreground">
              {' · '}{formatEventTime(event.eventStartTime, event.eventEndTime)}
            </span>
          </span>
        </div>

        {/* Driver pickup time */}
        {event.pickupTime && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Truck className="w-4 h-4 shrink-0 text-[#007e8c]" />
            <span>Pickup: {formatTimeForDisplay(event.pickupTime)}</span>
          </div>
        )}

        {/* Location */}
        {event.eventAddress && (
          <AddressLink location={event} />
        )}

        {/* Roles needed — simple badges */}
        {rolesNeeded.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium text-gray-700">Needed:</span>
            {event.speakersUnfilled > 0 && (
              <Badge variant="outline" className="bg-[#a31c41]/10 text-[#a31c41] border-[#a31c41]/30 gap-1">
                <Mic className="w-3 h-3" />
                Speaker{event.speakersUnfilled > 1 ? ` (${event.speakersUnfilled})` : ''}
              </Badge>
            )}
            {event.volunteersUnfilled > 0 && (
              <Badge variant="outline" className="bg-[#007e8c]/10 text-[#007e8c] border-[#007e8c]/30 gap-1">
                <UserCheck className="w-3 h-3" />
                Volunteer{event.volunteersUnfilled > 1 ? ` (${event.volunteersUnfilled})` : ''}
              </Badge>
            )}
            {event.driversUnfilled > 0 && (
              <Badge variant="outline" className="bg-[#236383]/10 text-[#236383] border-[#236383]/30 gap-1">
                <Car className="w-3 h-3" />
                Driver{event.driversUnfilled > 1 ? ` (${event.driversUnfilled})` : ''}
              </Badge>
            )}
            {event.vanDriverNeeded && (
              <Badge variant="outline" className="bg-[#fbad3f]/10 text-[#fbad3f] border-[#fbad3f]/30 gap-1">
                <Car className="w-3 h-3" />
                Van Driver
              </Badge>
            )}
          </div>
        )}
        {rolesNeeded.length === 0 && (
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="bg-green-100 text-green-700 border-green-300 gap-1">
              <Check className="w-3 h-3" />
              Fully Staffed — extra help still welcome!
            </Badge>
          </div>
        )}

        {/* Action button */}
        <div className="pt-2">
          {existingSignup ? (
            <div className="flex items-center justify-between p-2.5 rounded-lg bg-gradient-to-r from-[#47b3cb]/15 to-[#007e8c]/10 border border-[#47b3cb]/30">
              <div className="flex items-center gap-2">
                <div className="bg-[#007e8c] rounded-full p-0.5">
                  <Check className="w-3 h-3 text-white" />
                </div>
                <span className="text-sm font-medium text-[#236383]">
                  Signed up as {existingSignup.role === 'general' ? 'Volunteer' : existingSignup.role === 'speaker' ? 'Speaker' : existingSignup.role === 'driver' ? 'Driver' : existingSignup.role}
                </span>
              </div>
              <StatusBadge status={existingSignup.status} />
            </div>
          ) : (
            <div className="space-y-2">
              {canSelfSignup ? (
                <Button
                  className="w-full bg-gradient-to-r from-[#007e8c] to-[#47b3cb] hover:from-[#236383] hover:to-[#007e8c] text-white h-10 shadow-sm"
                  onClick={() => onSignup(event.id)}
                >
                  <HandHeart className="w-4 h-4 mr-2" />
                  Sign Up to Volunteer
                </Button>
              ) : (
                <div className="rounded-lg bg-gray-50 border border-gray-200 px-3 py-2 text-xs text-gray-600 text-center">
                  Ask a coordinator to sign you up.
                </div>
              )}
              {canAssignOthers && onAssign && (
                <Button
                  variant="outline"
                  className="w-full h-9 border-[#236383]/30 text-[#236383] hover:bg-[#236383]/5"
                  onClick={() => onAssign(event.id)}
                >
                  <Users className="w-4 h-4 mr-2" />
                  Assign Someone Else
                </Button>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// Wrapper used inside Leaflet Popup so we can close the popup
// before opening the signup/assign modal (otherwise the popup hovers
// behind the modal). Must be rendered inside MapContainer.
function MapEventPopupContent({
  event,
  onSignupClick,
  canSelfSignup,
  canAssignOthers,
  onAssignClick,
  userLocation,
}: {
  event: AvailableEvent;
  onSignupClick: (eventId: number) => void;
  canSelfSignup: boolean;
  canAssignOthers: boolean;
  onAssignClick: (eventId: number) => void;
  userLocation: { lat: number; lng: number } | null;
}) {
  const map = useMap();
  const distanceMiles = userLocation && event.latitude && event.longitude
    ? calculateDistanceMiles(
        userLocation.lat,
        userLocation.lng,
        parseFloat(event.latitude),
        parseFloat(event.longitude),
      )
    : undefined;
  return (
    <div className="w-[360px] max-w-[calc(100vw-3rem)] space-y-3">
      {distanceMiles !== undefined && (
        <div className="flex items-center gap-2 rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-sm font-medium text-blue-700">
          <Navigation className="w-4 h-4 shrink-0" />
          <span>{distanceMiles.toFixed(1)} miles from you</span>
        </div>
      )}
      <EventCard
        event={event}
        onSignup={(id) => { map.closePopup(); onSignupClick(id); }}
        onAssign={(id) => { map.closePopup(); onAssignClick(id); }}
        canSelfSignup={canSelfSignup}
        canAssignOthers={canAssignOthers}
      />
    </div>
  );
}

// Signup dialog component
function SignupDialog({
  event,
  open,
  onOpenChange,
  onSubmit,
  isSubmitting,
}: {
  event: AvailableEvent | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (roles: string[], notes: string) => void;
  isSubmitting: boolean;
}) {
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const [notes, setNotes] = useState('');

  const availableRoles = useMemo(() => {
    if (!event) return [];

    const roles: Array<{
      value: 'speaker' | 'general' | 'driver';
      label: string;
      icon: typeof Mic;
      colorClass: string;
      borderClass: string;
      bgClass: string;
    }> = [];

    const spotsLabel = (count: number) => (count === 1 ? '1 spot open' : `${count} spots open`);

    // Always show speaker role if event has any speaker need or assigned speakers
    if (event.speakersNeeded > 0 || event.speakersAssigned > 0) {
      roles.push({
        value: 'speaker',
        label: event.speakersUnfilled > 0
          ? `Speaker — ${spotsLabel(event.speakersUnfilled)}`
          : 'Speaker — filled, extra help welcome',
        icon: Mic,
        colorClass: 'text-[#a31c41]',
        borderClass: 'border-[#a31c41]/30',
        bgClass: 'bg-[#a31c41]/5',
      });
    }

    // Always show volunteer role
    roles.push({
      value: 'general',
      label: event.volunteersUnfilled > 0
        ? `General Volunteer — ${spotsLabel(event.volunteersUnfilled)}`
        : event.volunteersNeeded > 0
          ? 'General Volunteer — filled, extra help welcome'
          : 'General Volunteer — extra help always welcome',
      icon: UserCheck,
      colorClass: 'text-[#007e8c]',
      borderClass: 'border-[#007e8c]/30',
      bgClass: 'bg-[#007e8c]/5',
    });

    // Show driver role if event needs drivers AND it's NOT a van-required event.
    // Van-needed events use a separate van-driver signup flow (handled elsewhere).
    if (!event.vanDriverNeeded && (event.driversNeeded > 0 || event.driversAssigned > 0)) {
      roles.push({
        value: 'driver',
        label: event.driversUnfilled > 0
          ? `Driver — ${spotsLabel(event.driversUnfilled)}`
          : 'Driver — filled, extra help welcome',
        icon: Car,
        colorClass: 'text-[#236383]',
        borderClass: 'border-[#236383]/30',
        bgClass: 'bg-[#236383]/5',
      });
    }

    return roles;
  }, [event]);

  useEffect(() => {
    if (open && event) {
      const defaultRole = availableRoles[0]?.value;
      setSelectedRoles(defaultRole ? [defaultRole] : []);
      setNotes('');
    }
  }, [open, event, availableRoles]);

  if (!event) return null;

  const eventDate = event.scheduledEventDate || event.desiredEventDate;
  const formattedDate = eventDate
    ? format(parseEventDate(eventDate)!, 'EEEE, MMMM d, yyyy')
    : 'Date TBD';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Volunteer for Event</DialogTitle>
          <DialogDescription>
            Sign up to volunteer at {event.organizationName} on {formattedDate}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Role selection */}
          <div className="space-y-2">
            <Label>
              Select your role <span className="text-muted-foreground font-normal">(required)</span>
            </Label>
            {availableRoles.length === 0 ? (
              <div className="text-sm text-muted-foreground">
                No roles are currently available for this event.
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">
                  Tip: you can choose more than one role.
                </p>
                {availableRoles.map((role) => {
                  const Icon = role.icon;
                  const isSelected = selectedRoles.includes(role.value);
                  return (
                    <Label
                      key={role.value}
                      htmlFor={`role-${role.value}`}
                      className={cn(
                        'flex items-center gap-3 rounded-lg border px-3 py-2 cursor-pointer transition-colors',
                        role.borderClass,
                        isSelected ? role.bgClass : 'bg-white'
                      )}
                    >
                      <Checkbox
                        id={`role-${role.value}`}
                        checked={isSelected}
                        onCheckedChange={(checked) => {
                          setSelectedRoles((prev) => {
                            if (checked === true) {
                              return Array.from(new Set([...prev, role.value]));
                            }
                            return prev.filter((value) => value !== role.value);
                          });
                        }}
                      />
                      <Icon className={cn('w-4 h-4', role.colorClass)} />
                      <span className="text-sm text-gray-700">{role.label}</span>
                    </Label>
                  );
                })}
              </div>
            )}
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes">Notes (optional)</Label>
            <Textarea
              id="notes"
              placeholder="Anything we should know?"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
            />
          </div>

          {/* Reassurance callout */}
          <div className="bg-[#007e8c]/10 border-l-4 border-[#007e8c] rounded-md p-4 text-sm text-[#236383]">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 mt-0.5 shrink-0 text-[#007e8c]" />
              <div>
                <p className="text-base font-semibold">What happens next?</p>
                <p className="text-[#236383]/90 mt-1.5 leading-relaxed">
                  A coordinator will review your signup and confirm your participation.
                  You'll receive an email once your signup is approved.
                </p>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => onSubmit(selectedRoles, notes)}
            disabled={selectedRoles.length === 0 || isSubmitting}
            className="bg-gradient-to-r from-[#007e8c] to-[#47b3cb] hover:from-[#236383] hover:to-[#007e8c] text-white shadow-sm"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Submitting...
              </>
            ) : (
              <>
                <HandHeart className="w-4 h-4 mr-2" />
                Submit Signup Request
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Assign-Others dialog: for users with EVENT_REQUESTS_ASSIGN_OTHERS who want
// to staff an event with someone other than themselves. Mirrors SignupDialog
// but adds a user picker and skips the self-signup pending-review flow.
function AssignOthersDialog({
  event,
  open,
  onOpenChange,
  onSubmit,
  isSubmitting,
}: {
  event: AvailableEvent | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (targetUserId: string, roles: string[], notes: string) => void;
  isSubmitting: boolean;
}) {
  const [targetUserId, setTargetUserId] = useState<string>('');
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const [notes, setNotes] = useState('');
  const [userSearch, setUserSearch] = useState('');

  const { data: assignableUsers = [] } = useQuery<Array<{
    id: string;
    firstName?: string | null;
    lastName?: string | null;
    displayName?: string | null;
    email?: string | null;
  }>>({
    queryKey: ['/api/users/for-assignments'],
    enabled: open,
  });

  const filteredUsers = useMemo(() => {
    if (!userSearch.trim()) return assignableUsers;
    const q = userSearch.toLowerCase();
    return assignableUsers.filter((u) => {
      const name = (u.displayName || `${u.firstName ?? ''} ${u.lastName ?? ''}`.trim()).toLowerCase();
      const email = (u.email ?? '').toLowerCase();
      return name.includes(q) || email.includes(q);
    });
  }, [assignableUsers, userSearch]);

  const availableRoles = useMemo(() => {
    if (!event) return [] as Array<{ value: 'speaker' | 'general' | 'driver'; label: string; icon: typeof Mic; colorClass: string; borderClass: string; bgClass: string }>;
    const roles: Array<{ value: 'speaker' | 'general' | 'driver'; label: string; icon: typeof Mic; colorClass: string; borderClass: string; bgClass: string }> = [];
    if (event.speakersNeeded > 0 || event.speakersAssigned > 0) {
      roles.push({
        value: 'speaker',
        label: event.speakersUnfilled > 0
          ? `Speaker (${event.speakersUnfilled} needed)`
          : `Speaker (${event.speakersAssigned}/${event.speakersNeeded} filled)`,
        icon: Mic,
        colorClass: 'text-[#a31c41]',
        borderClass: 'border-[#a31c41]/30',
        bgClass: 'bg-[#a31c41]/5',
      });
    }
    roles.push({
      value: 'general',
      label: event.volunteersUnfilled > 0
        ? `General Volunteer (${event.volunteersUnfilled} needed)`
        : `General Volunteer`,
      icon: UserCheck,
      colorClass: 'text-[#007e8c]',
      borderClass: 'border-[#007e8c]/30',
      bgClass: 'bg-[#007e8c]/5',
    });
    if (!event.vanDriverNeeded && (event.driversNeeded > 0 || event.driversAssigned > 0)) {
      roles.push({
        value: 'driver',
        label: event.driversUnfilled > 0
          ? `Driver (${event.driversUnfilled} needed)`
          : `Driver (${event.driversAssigned}/${event.driversNeeded} filled)`,
        icon: Car,
        colorClass: 'text-[#236383]',
        borderClass: 'border-[#236383]/30',
        bgClass: 'bg-[#236383]/5',
      });
    }
    return roles;
  }, [event]);

  useEffect(() => {
    if (open && event) {
      setTargetUserId('');
      setSelectedRoles([availableRoles[0]?.value].filter(Boolean) as string[]);
      setNotes('');
      setUserSearch('');
    }
  }, [open, event, availableRoles]);

  if (!event) return null;

  const eventDate = event.scheduledEventDate || event.desiredEventDate;
  const formattedDate = eventDate
    ? format(parseEventDate(eventDate)!, 'EEEE, MMMM d, yyyy')
    : 'Date TBD';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Assign Someone to Event</DialogTitle>
          <DialogDescription>
            Pre-approved assignment to {event.organizationName} on {formattedDate}. The person you assign will be notified immediately — no review step.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* User picker */}
          <div className="space-y-2">
            <Label htmlFor="assignee-search">
              Who are you assigning? <span className="text-muted-foreground font-normal">(required)</span>
            </Label>
            <Input
              id="assignee-search"
              placeholder="Search by name or email..."
              value={userSearch}
              onChange={(e) => setUserSearch(e.target.value)}
            />
            <ScrollArea className="h-40 rounded-md border">
              <div className="p-1 space-y-1">
                {filteredUsers.length === 0 ? (
                  <div className="text-sm text-muted-foreground py-4 text-center">
                    No users match that search.
                  </div>
                ) : (
                  filteredUsers.slice(0, 50).map((u) => {
                    const label = u.displayName || `${u.firstName ?? ''} ${u.lastName ?? ''}`.trim() || u.email || u.id;
                    const isSelected = targetUserId === u.id;
                    return (
                      <button
                        key={u.id}
                        type="button"
                        onClick={() => setTargetUserId(u.id)}
                        className={cn(
                          'w-full text-left px-2 py-1.5 rounded text-sm transition-colors',
                          isSelected ? 'bg-[#007e8c] text-white' : 'hover:bg-slate-100'
                        )}
                      >
                        <div className="font-medium truncate">{label}</div>
                        {u.email && (
                          <div className={cn('text-xs truncate', isSelected ? 'text-white/80' : 'text-muted-foreground')}>
                            {u.email}
                          </div>
                        )}
                      </button>
                    );
                  })
                )}
              </div>
            </ScrollArea>
          </div>

          {/* Role selection */}
          <div className="space-y-2">
            <Label>
              Role(s) <span className="text-muted-foreground font-normal">(required)</span>
            </Label>
            {availableRoles.length === 0 ? (
              <div className="text-sm text-muted-foreground">
                No roles are currently available for this event.
              </div>
            ) : (
              <div className="space-y-2">
                {availableRoles.map((role) => {
                  const Icon = role.icon;
                  const isSelected = selectedRoles.includes(role.value);
                  return (
                    <Label
                      key={role.value}
                      htmlFor={`assign-role-${role.value}`}
                      className={cn(
                        'flex items-center gap-3 rounded-lg border px-3 py-2 cursor-pointer transition-colors',
                        role.borderClass,
                        isSelected ? role.bgClass : 'bg-white'
                      )}
                    >
                      <Checkbox
                        id={`assign-role-${role.value}`}
                        checked={isSelected}
                        onCheckedChange={(checked) => {
                          setSelectedRoles((prev) => {
                            if (checked === true) {
                              return Array.from(new Set([...prev, role.value]));
                            }
                            return prev.filter((v) => v !== role.value);
                          });
                        }}
                      />
                      <Icon className={cn('w-4 h-4', role.colorClass)} />
                      <span className="text-sm text-gray-700">{role.label}</span>
                    </Label>
                  );
                })}
              </div>
            )}
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="assign-notes">Notes (optional)</Label>
            <Textarea
              id="assign-notes"
              placeholder="Anything the assignee should know..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => onSubmit(targetUserId, selectedRoles, notes)}
            disabled={!targetUserId || selectedRoles.length === 0 || isSubmitting}
            className="bg-gradient-to-r from-[#007e8c] to-[#47b3cb] hover:from-[#236383] hover:to-[#007e8c] text-white shadow-sm"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Assigning...
              </>
            ) : (
              'Confirm Assignment'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Coordinator dialog for changing a volunteer's role OR removing them
 * from an event. The same dialog handles both flows so we don't nest dialogs.
 * Mode is set when the dialog is opened.
 */
function ManageSignupDialog({
  signup,
  mode,
  open,
  onOpenChange,
  onChangeRole,
  onRemove,
  isSubmitting,
}: {
  signup: any | null;
  mode: 'change_role' | 'remove' | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onChangeRole: (signupId: number, role: string, reason?: string) => void;
  onRemove: (signupId: number, reason?: string) => void;
  isSubmitting: boolean;
}) {
  const [newRole, setNewRole] = useState<string>('general');
  const [reason, setReason] = useState('');

  useEffect(() => {
    if (open && signup) {
      // Default new role to anything other than current role
      const fallback = signup.role === 'general' ? 'speaker' : 'general';
      setNewRole(fallback);
      setReason('');
    }
  }, [open, signup?.id, signup?.role, signup]);

  if (!signup || !mode) return null;

  const orgName = signup.event?.organizationName || 'this event';
  const vanNeeded = !!signup.event?.vanDriverNeeded;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {mode === 'change_role' ? 'Change Volunteer Role' : 'Remove Volunteer'}
          </DialogTitle>
          <DialogDescription>
            {mode === 'change_role'
              ? `Update ${signup.volunteerName || 'this volunteer'}'s role on ${orgName}.`
              : `Remove ${signup.volunteerName || 'this volunteer'} from ${orgName}. They'll be notified by email.`}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-3">
          {mode === 'change_role' && (
            <div className="space-y-2">
              <Label>New role</Label>
              <Select value={newRole} onValueChange={setNewRole}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose role" />
                </SelectTrigger>
                <SelectContent>
                  {signup.role !== 'general' && (
                    <SelectItem value="general">General Volunteer</SelectItem>
                  )}
                  {signup.role !== 'speaker' && (
                    <SelectItem value="speaker">Speaker</SelectItem>
                  )}
                  {signup.role !== 'driver' && !vanNeeded && (
                    <SelectItem value="driver">Driver</SelectItem>
                  )}
                </SelectContent>
              </Select>
              {vanNeeded && signup.role !== 'driver' && (
                <p className="text-xs text-[#A31C41]">
                  Driver role is hidden because this event needs a van driver. Use the van driver flow instead.
                </p>
              )}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="reason">
              {mode === 'change_role' ? 'Reason (optional)' : 'Explanation (optional)'}
            </Label>
            <Textarea
              id="reason"
              placeholder={
                mode === 'change_role'
                  ? "What's prompting this change? (will be included in the email)"
                  : "Why are you removing them? (will be included in the email)"
              }
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={4}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            Cancel
          </Button>
          {mode === 'change_role' ? (
            <Button
              onClick={() => onChangeRole(signup.id, newRole, reason.trim() || undefined)}
              disabled={isSubmitting || !newRole || newRole === signup.role}
              className="bg-[#FBAD3F] hover:bg-[#FBAD3F]/90 text-[#1a1a1a]"
            >
              {isSubmitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              Save Change
            </Button>
          ) : (
            <Button
              onClick={() => onRemove(signup.id, reason.trim() || undefined)}
              disabled={isSubmitting}
              className="bg-[#A31C41] hover:bg-[#A31C41]/90 text-white"
            >
              {isSubmitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              Remove Volunteer
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Main component
export default function VolunteerEventHub() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // View state
  const [view, setView] = useState<'list' | 'calendar' | 'map' | 'my_signups' | 'pending_approvals'>('calendar');
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedCalendarDate, setSelectedCalendarDate] = useState<string | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<AvailableEvent | null>(null);
  const [signupDialogOpen, setSignupDialogOpen] = useState(false);
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [manageSignup, setManageSignup] = useState<any | null>(null);
  const [manageMode, setManageMode] = useState<'change_role' | 'remove' | null>(null);
  const [manageDialogOpen, setManageDialogOpen] = useState(false);

  // Can this user assign OTHERS to events (not just self-signup)?
  const canAssignOthers =
    user?.role === 'super_admin' ||
    (Array.isArray(user?.permissions) &&
      (user.permissions as string[]).includes('EVENT_REQUESTS_ASSIGN_OTHERS'));

  const canApproveSignups =
    user?.role === 'super_admin' ||
    (Array.isArray(user?.permissions) &&
      (user.permissions as string[]).includes('VOLUNTEER_SIGNUP_APPROVE'));

  const canSelfSignup = !!user && hasPermission(user, PERMISSIONS.EVENT_REQUESTS_SELF_SIGNUP);

  // Filters
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [mySignupsRoleFilter, setMySignupsRoleFilter] = useState<string>('all');
  const [showOnlyNeeds, setShowOnlyNeeds] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const needsOnlyForEventQuery = view === 'calendar' ? false : showOnlyNeeds;

  // User location for distance calculation on map
  const [userAddress, setUserAddress] = useState('');
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [geocodingLoading, setGeocodingLoading] = useState(false);
  const [browserLocationLoading, setBrowserLocationLoading] = useState(false);

  // Fetch available events
  const { data: events = [], isLoading: eventsLoading } = useQuery<AvailableEvent[]>({
    queryKey: ['/api/volunteer-hub/available-events', needsOnlyForEventQuery],
    queryFn: async () => {
      const response = await fetch(`/api/volunteer-hub/available-events?needsOnly=${needsOnlyForEventQuery}`, {
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to fetch events');
      return response.json();
    },
  });

  // Fetch user's signups
  const { data: mySignups = [], isLoading: signupsLoading } = useQuery<MySignup[]>({
    queryKey: ['/api/volunteer-hub/my-signups'],
    queryFn: async () => {
      const response = await fetch('/api/volunteer-hub/my-signups', {
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to fetch signups');
      return response.json();
    },
  });

  // Fetch pending signups (for coordinators)
  const { data: pendingSignups = [] } = useQuery<any[]>({
    queryKey: ['/api/volunteer-hub/pending-signups'],
    queryFn: async () => {
      const response = await fetch('/api/volunteer-hub/pending-signups', { credentials: 'include' });
      if (!response.ok) return [];
      return response.json();
    },
    enabled: canApproveSignups,
    refetchInterval: 30000,
  });

  // Approve/decline mutation
  const updateSignupStatusMutation = useMutation({
    mutationFn: async ({ signupId, status }: { signupId: number; status: string }) => {
      const response = await fetch(`/api/volunteer-hub/signup/${signupId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to update signup status');
      return response.json();
    },
    onSuccess: (_, { status }) => {
      queryClient.invalidateQueries({ queryKey: ['/api/volunteer-hub/pending-signups'] });
      queryClient.invalidateQueries({ queryKey: ['/api/volunteer-hub/all-signups'] });
      queryClient.invalidateQueries({ queryKey: ['/api/volunteer-hub/available-events'] });
      toast({ title: status === 'assigned' ? 'Signup approved' : 'Signup declined' });
    },
    onError: () => {
      toast({ title: 'Failed to update signup', variant: 'destructive' });
    },
  });

  // Fetch all signups (approved + declined) for management list
  const { data: allSignups = [] } = useQuery<any[]>({
    queryKey: ['/api/volunteer-hub/all-signups'],
    queryFn: async () => {
      const response = await fetch('/api/volunteer-hub/pending-signups?all=true', { credentials: 'include' });
      if (!response.ok) return [];
      return response.json();
    },
    enabled: canApproveSignups,
    refetchInterval: 30000,
  });

  // Change role mutation
  const changeRoleMutation = useMutation({
    mutationFn: async ({ signupId, role, reason }: { signupId: number; role: string; reason?: string }) => {
      const response = await fetch(`/api/volunteer-hub/signup/${signupId}/role`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role, reason }),
        credentials: 'include',
      });
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to change role');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/volunteer-hub/all-signups'] });
      queryClient.invalidateQueries({ queryKey: ['/api/volunteer-hub/pending-signups'] });
      queryClient.invalidateQueries({ queryKey: ['/api/volunteer-hub/available-events'] });
      toast({ title: 'Role updated', description: 'Volunteer has been notified by email.' });
    },
    onError: (err: Error) => {
      toast({ title: 'Failed to change role', description: err.message, variant: 'destructive' });
    },
  });

  // Remove from event mutation
  const removeSignupMutation = useMutation({
    mutationFn: async ({ signupId, reason }: { signupId: number; reason?: string }) => {
      const response = await fetch(`/api/volunteer-hub/signup/${signupId}/remove`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason }),
        credentials: 'include',
      });
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to remove signup');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/volunteer-hub/all-signups'] });
      queryClient.invalidateQueries({ queryKey: ['/api/volunteer-hub/pending-signups'] });
      queryClient.invalidateQueries({ queryKey: ['/api/volunteer-hub/available-events'] });
      toast({ title: 'Volunteer removed', description: 'They have been notified by email.' });
    },
    onError: (err: Error) => {
      toast({ title: 'Failed to remove', description: err.message, variant: 'destructive' });
    },
  });

  // Signup mutation
  const signupMutation = useMutation({
    mutationFn: async ({ eventId, roles, notes }: { eventId: number; roles: string[]; notes: string }) => {
      const response = await fetch(`/api/volunteer-hub/signup/${eventId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roles, notes }),
        credentials: 'include',
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to sign up');
      }
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: 'Signup Submitted!',
        description: data.message || 'Your volunteer request has been submitted.',
      });
      setSignupDialogOpen(false);
      setSelectedEvent(null);
      queryClient.invalidateQueries({ queryKey: ['/api/volunteer-hub/my-signups'] });
      queryClient.invalidateQueries({ queryKey: ['/api/volunteer-hub/available-events'] });
    },
    onError: (error: Error) => {
      toast({
        title: 'Signup Failed',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Assign-others mutation: coordinator assigning another user to an event.
  // Hits the same /signup/:eventId endpoint with targetUserId set; the backend
  // routes it through the pre-approved path and mirrors into event arrays.
  const assignOthersMutation = useMutation({
    mutationFn: async ({
      eventId,
      targetUserId,
      roles,
      notes,
    }: {
      eventId: number;
      targetUserId: string;
      roles: string[];
      notes: string;
    }) => {
      const response = await fetch(`/api/volunteer-hub/signup/${eventId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetUserId, roles, notes }),
        credentials: 'include',
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to assign');
      }
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: 'Assignment complete',
        description: data.message || 'User assigned to this event.',
      });
      setAssignDialogOpen(false);
      setSelectedEvent(null);
      queryClient.invalidateQueries({ queryKey: ['/api/volunteer-hub/available-events'] });
    },
    onError: (error: Error) => {
      toast({
        title: 'Assignment failed',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Cancel signup mutation
  const cancelSignupMutation = useMutation({
    mutationFn: async (signupId: number) => {
      const response = await fetch(`/api/volunteer-hub/signup/${signupId}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to cancel signup');
      }
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: 'Signup Cancelled',
        description: 'Your volunteer signup has been cancelled.',
      });
      queryClient.invalidateQueries({ queryKey: ['/api/volunteer-hub/my-signups'] });
    },
    onError: (error: Error) => {
      toast({
        title: 'Cancel Failed',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Filter events
  const filteredEvents = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    return events
      .filter(event => {
        if (normalizedSearch) {
          const searchableText = [
            event.organizationName,
            event.organizationCategory || '',
            event.department || '',
            event.eventAddress || '',
            event.city || '',
            event.state || '',
            event.eventNotes || '',
          ].join(' ').toLowerCase();

          if (!searchableText.includes(normalizedSearch)) return false;
        }

        if (roleFilter === 'speaker' && event.speakersUnfilled === 0) return false;
        if (roleFilter === 'volunteer' && event.volunteersUnfilled === 0) return false;
        if (roleFilter === 'driver') {
          if (event.driversUnfilled === 0) return false;
          // Group is providing their own transport — no driver opportunity here.
          if (event.selfTransport) return false;
        }
        return true;
      })
      .sort((a, b) => {
        if (a.hasUnfilledNeeds !== b.hasUnfilledNeeds) {
          return a.hasUnfilledNeeds ? -1 : 1;
        }

        const dateA = a.scheduledEventDate || a.desiredEventDate;
        const dateB = b.scheduledEventDate || b.desiredEventDate;
        if (dateA && dateB) return new Date(dateA).getTime() - new Date(dateB).getTime();
        if (dateA) return -1;
        if (dateB) return 1;
        return a.organizationName.localeCompare(b.organizationName);
      });
  }, [events, roleFilter, searchTerm]);

  // Calculate summary metrics for dashboard cards
  const summaryMetrics = useMemo(() => {
    const totalEvents = events.length;
    const eventsNeedingHelp = events.filter(e => e.hasUnfilledNeeds).length;
    const totalSpeakerOpenings = events.reduce((sum, e) => sum + e.speakersUnfilled, 0);
    const totalVolunteerOpenings = events.reduce((sum, e) => sum + e.volunteersUnfilled, 0);
    const totalDriverOpenings = events.reduce((sum, e) => sum + e.driversUnfilled, 0);
    const totalOpenings = totalSpeakerOpenings + totalVolunteerOpenings + totalDriverOpenings;

    return {
      totalEvents,
      eventsNeedingHelp,
      totalSpeakerOpenings,
      totalVolunteerOpenings,
      totalDriverOpenings,
      totalOpenings,
    };
  }, [events]);

  // Group events by date for calendar view
  const eventsByDate = useMemo(() => {
    const grouped: Record<string, AvailableEvent[]> = {};
    filteredEvents.forEach(event => {
      const dateStr = event.scheduledEventDate || event.desiredEventDate;
      if (dateStr) {
        const key = dateStr.split('T')[0];
        if (!grouped[key]) grouped[key] = [];
        grouped[key].push(event);
      }
    });
    return grouped;
  }, [filteredEvents]);

  const getRoleOpenings = (event: AvailableEvent) => {
    const roles: Array<{ singular: string; plural: string; count: number; color: string; bg: string; Icon: typeof Mic }> = [];

    if (event.speakersUnfilled > 0) {
      roles.push({ singular: 'speaker', plural: 'speakers', count: event.speakersUnfilled, color: '#A31C41', bg: '#A31C4114', Icon: Mic });
    }
    if (event.volunteersUnfilled > 0) {
      roles.push({ singular: 'volunteer', plural: 'volunteers', count: event.volunteersUnfilled, color: '#007E8C', bg: '#007E8C14', Icon: UserCheck });
    }
    if (event.driversUnfilled > 0) {
      roles.push({ singular: 'driver', plural: 'drivers', count: event.driversUnfilled, color: '#236383', bg: '#23638314', Icon: Car });
    }
    if (event.vanDriverNeeded) {
      roles.push({ singular: 'van driver', plural: 'van drivers', count: 1, color: '#B45309', bg: '#FBAD3F22', Icon: Truck });
    }

    return roles;
  };

  const formatNeededRole = (role: ReturnType<typeof getRoleOpenings>[number]) => {
    const label = role.count === 1 ? role.singular : role.plural;
    return `${role.count} ${label} needed`;
  };

  const getTotalOpeningsForEvents = (dayEvents: AvailableEvent[]) => (
    dayEvents.reduce((sum, event) => (
      sum +
      Math.max(0, event.speakersUnfilled) +
      Math.max(0, event.volunteersUnfilled) +
      Math.max(0, event.driversUnfilled) +
      (event.vanDriverNeeded ? 1 : 0)
    ), 0)
  );

  const monthCalendarSummary = useMemo(() => {
    const monthEvents = filteredEvents.filter((event) => {
      const dateStr = event.scheduledEventDate || event.desiredEventDate;
      if (!dateStr) return false;
      const date = parseEventDate(dateStr);
      return !!date && date.getMonth() === currentMonth.getMonth() && date.getFullYear() === currentMonth.getFullYear();
    });

    return {
      events: monthEvents.length,
      openings: getTotalOpeningsForEvents(monthEvents),
      days: new Set(monthEvents.map((event) => (event.scheduledEventDate || event.desiredEventDate || '').split('T')[0])).size,
    };
  }, [filteredEvents, currentMonth]);

  const selectedDateEvents = selectedCalendarDate ? eventsByDate[selectedCalendarDate] || [] : [];
  const selectedDateLabel = selectedCalendarDate
    ? format(parseEventDate(selectedCalendarDate)!, 'EEEE, MMMM d')
    : 'Choose a day';

  // Get existing signup for an event
  const getExistingSignup = (eventId: number) => {
    return mySignups.find(s => s.eventRequestId === eventId);
  };

  // Handle signup click
  // Geocode user address for distance calculation
  const handleGeocodeAddress = async () => {
    if (!userAddress.trim()) return;
    setGeocodingLoading(true);
    try {
      const res = await fetch('/api/event-map/geocode-address', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ address: userAddress.trim() }),
      });
      if (!res.ok) {
        const data = await res.json();
        toast({
          title: 'Address not found',
          description: data.details || 'Could not find that address. Try a more specific address.',
          variant: 'destructive',
        });
        return;
      }
      const data = await res.json();
      setUserLocation({ lat: parseFloat(data.latitude), lng: parseFloat(data.longitude) });
      toast({ title: 'Location set', description: 'Showing distances from your address.' });
    } catch {
      toast({ title: 'Error', description: 'Failed to look up address.', variant: 'destructive' });
    } finally {
      setGeocodingLoading(false);
    }
  };

  const handleUseBrowserLocation = () => {
    if (!navigator.geolocation) {
      toast({
        title: 'Location not available',
        description: "Your browser doesn't support location lookup. Type an address instead.",
        variant: 'destructive',
      });
      return;
    }
    setBrowserLocationLoading(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setUserLocation({ lat: position.coords.latitude, lng: position.coords.longitude });
        setUserAddress('Current location');
        setBrowserLocationLoading(false);
        toast({ title: 'Location set', description: 'Showing distances from where you are.' });
      },
      (error) => {
        setBrowserLocationLoading(false);
        const description = error.code === error.PERMISSION_DENIED
          ? 'Location permission was denied. Type an address instead.'
          : 'Could not get your location. Type an address instead.';
        toast({ title: 'Location unavailable', description, variant: 'destructive' });
      },
      { enableHighAccuracy: false, timeout: 10000 },
    );
  };

  const handleSignupClick = (eventId: number) => {
    const event = events.find(e => e.id === eventId);
    if (event) {
      setSelectedEvent(event);
      setSignupDialogOpen(true);
    }
  };

  const handleAssignClick = (eventId: number) => {
    const event = events.find(e => e.id === eventId);
    if (event) {
      setSelectedEvent(event);
      setAssignDialogOpen(true);
    }
  };

  // Handle signup submit
  const handleSignupSubmit = (roles: string[], notes: string) => {
    if (selectedEvent) {
      signupMutation.mutate({ eventId: selectedEvent.id, roles, notes });
    }
  };

  // Handle assign-others submit
  const handleAssignSubmit = (targetUserId: string, roles: string[], notes: string) => {
    if (selectedEvent) {
      assignOthersMutation.mutate({ eventId: selectedEvent.id, targetUserId, roles, notes });
    }
  };

  // Calendar navigation
  const prevMonth = () => {
    setCurrentMonth(subMonths(currentMonth, 1));
    setSelectedCalendarDate(null);
  };
  const nextMonth = () => {
    setCurrentMonth(addMonths(currentMonth, 1));
    setSelectedCalendarDate(null);
  };
  const goToToday = () => {
    const today = new Date();
    setCurrentMonth(today);
    setSelectedCalendarDate(format(today, 'yyyy-MM-dd'));
  };

  // Calendar days
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const calendarDays = eachDayOfInterval({ start: monthStart, end: monthEnd });

  // Add padding days for calendar grid
  const startPadding = monthStart.getDay();
  const endPadding = (7 - ((startPadding + calendarDays.length) % 7)) % 7;
  const paddedDays = [
    ...Array(startPadding).fill(null),
    ...calendarDays,
    ...Array(endPadding).fill(null),
  ];

  // Map center (default to NYC area)
  const mapCenter: [number, number] = useMemo(() => {
    const eventsWithCoords = filteredEvents.filter(e => e.latitude && e.longitude);
    if (eventsWithCoords.length > 0) {
      const avgLat = eventsWithCoords.reduce((sum, e) => sum + parseFloat(e.latitude!), 0) / eventsWithCoords.length;
      const avgLng = eventsWithCoords.reduce((sum, e) => sum + parseFloat(e.longitude!), 0) / eventsWithCoords.length;
      return [avgLat, avgLng];
    }
    return [40.7128, -74.006]; // Default to NYC
  }, [filteredEvents]);

  if (eventsLoading || signupsLoading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => (
            <Skeleton key={i} className="h-64" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 space-y-6">
        {/* Header with gradient banner */}
        <div className="bg-gradient-to-r from-[#007e8c] to-[#47b3cb] rounded-xl p-6 text-white">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-3">
                <div className="bg-white/20 p-2 rounded-lg">
                  <HandHeart className="w-7 h-7" />
                </div>
                Volunteer Event Hub
              </h1>
              <p className="text-white/80 mt-2 text-base">
                Find an event, pick a role, and sign up — it's that simple.
              </p>
            </div>
            {mySignups.length > 0 && (
              <button
                onClick={() => setView('my_signups')}
                className="bg-white/20 hover:bg-white/30 transition-colors rounded-lg px-4 py-2 text-sm font-medium flex items-center gap-2"
              >
                <UserCheck className="w-4 h-4" />
                {mySignups.length} Active Signup{mySignups.length !== 1 ? 's' : ''}
              </button>
            )}
          </div>

          {/* Summary stats inline */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5">
            <div className="bg-white/20 rounded-lg p-3 text-center border border-white/20">
              <div className="text-2xl font-bold">{summaryMetrics.totalEvents}</div>
              <div className="text-base font-semibold leading-snug text-white">Upcoming Events</div>
            </div>
            <div className="bg-white/20 rounded-lg p-3 text-center border border-white/20">
              <div className="text-2xl font-bold">{summaryMetrics.totalDriverOpenings}</div>
              <div className="text-base font-semibold leading-snug text-white">Drivers Needed</div>
            </div>
            <div className="bg-white/20 rounded-lg p-3 text-center border border-white/20">
              <div className="text-2xl font-bold">{summaryMetrics.totalSpeakerOpenings}</div>
              <div className="text-base font-semibold leading-snug text-white">Speakers Needed</div>
            </div>
            <div className="bg-white/20 rounded-lg p-3 text-center border border-white/20">
              <div className="text-2xl font-bold">{summaryMetrics.totalOpenings}</div>
              <div className="text-base font-semibold leading-snug text-white">Total Openings</div>
            </div>
          </div>
        </div>

        {/* Filters & View Toggle */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          {view !== 'my_signups' && (
            <>
              <div className="relative w-full sm:max-w-sm">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search by organization, city, or address..."
                  className="pl-9"
                />
              </div>

              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-muted-foreground" />
                <Select value={roleFilter} onValueChange={setRoleFilter}>
                  <SelectTrigger className="w-[160px]">
                    <SelectValue placeholder="Filter by role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Roles</SelectItem>
                    <SelectItem value="speaker">Speakers Needed</SelectItem>
                    <SelectItem value="volunteer">Volunteers Needed</SelectItem>
                    <SelectItem value="driver">Drivers Needed</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {view === 'calendar' ? (
                <div className="rounded-lg border border-[#FBAD3F]/30 bg-[#FAF8F4] px-3 py-2 text-sm text-[#236383]">
                  Calendar shows all upcoming events. Open spots are highlighted first.
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="showOnlyNeeds"
                    checked={showOnlyNeeds}
                    onCheckedChange={(checked) => setShowOnlyNeeds(checked === true)}
                  />
                  <Label htmlFor="showOnlyNeeds" className="text-sm cursor-pointer">
                    Only show events that need help
                  </Label>
                </div>
              )}
            </>
          )}

          <div className="flex-1" />

          <div className="flex w-full flex-wrap gap-1 rounded-lg border border-[#007e8c]/20 bg-[#007e8c]/5 p-1 sm:w-auto">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setView('calendar')}
              className={`flex-1 gap-1.5 sm:flex-none ${view === 'calendar' ? 'bg-[#007e8c] text-white hover:bg-[#007e8c]/90 hover:text-white' : 'text-[#236383] hover:text-[#007e8c] hover:bg-[#007e8c]/10'}`}
            >
              <CalendarDays className="w-4 h-4" />
              Calendar
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setView('list')}
              className={`flex-1 gap-1.5 sm:flex-none ${view === 'list' ? 'bg-[#007e8c] text-white hover:bg-[#007e8c]/90 hover:text-white' : 'text-[#236383] hover:text-[#007e8c] hover:bg-[#007e8c]/10'}`}
            >
              <List className="w-4 h-4" />
              List
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setView('map')}
              className={`flex-1 gap-1.5 sm:flex-none ${view === 'map' ? 'bg-[#007e8c] text-white hover:bg-[#007e8c]/90 hover:text-white' : 'text-[#236383] hover:text-[#007e8c] hover:bg-[#007e8c]/10'}`}
            >
              <MapIcon className="w-4 h-4" />
              Map
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setView('my_signups')}
              className={`flex-1 gap-1.5 sm:flex-none ${view === 'my_signups' ? 'bg-[#007e8c] text-white hover:bg-[#007e8c]/90 hover:text-white' : 'text-[#236383] hover:text-[#007e8c] hover:bg-[#007e8c]/10'}`}
            >
              <UserCheck className="w-4 h-4" />
              My Signups
              {mySignups.length > 0 && (
                <span className={`ml-1 text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center ${
                  view === 'my_signups' ? 'bg-white text-[#007e8c]' : 'bg-[#007e8c] text-white'
                }`}>
                  {mySignups.length}
                </span>
              )}
            </Button>
            {canApproveSignups && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setView('pending_approvals')}
                className={`flex-1 gap-1.5 sm:flex-none ${view === 'pending_approvals' ? 'bg-[#007e8c] text-white hover:bg-[#007e8c]/90 hover:text-white' : 'text-amber-700 hover:text-[#007e8c] hover:bg-[#007e8c]/10'}`}
              >
                <Clock className="w-4 h-4" />
                Pending Approvals
                {pendingSignups.length > 0 && (
                  <span className={`ml-1 text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center ${
                    view === 'pending_approvals' ? 'bg-white text-[#007e8c]' : 'bg-amber-500 text-white'
                  }`}>
                    {pendingSignups.length}
                  </span>
                )}
              </Button>
            )}
          </div>
        </div>

        {/* Guidance note: shown above the active view so volunteers see it
            before scanning the calendar / list for events to sign up for. */}
        <div className="rounded-lg border border-[#FBAD3F]/40 bg-[#FFF7E6] px-4 py-3 text-sm text-[#236383] leading-relaxed">
          Extra help is usually welcome at events, but subject to approval. Please
          prioritize signing up for unfilled needs whenever possible. Thank you so
          much for being part of this team!
        </div>

        {/* Main Content */}
        <Tabs value={view} className="space-y-4">
          {/* Calendar View */}
          <TabsContent value="calendar" className="mt-0">
            <Card className="overflow-hidden border-[#FBAD3F]/30 shadow-sm">
              <div className="bg-[#FAF8F4] border-b border-[#FBAD3F]/30 px-4 sm:px-6 py-4">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div className="flex items-start gap-3">
                    <div className="h-12 w-12 rounded-xl bg-[#FBAD3F] text-[#1A2332] flex items-center justify-center shadow-sm">
                      <CalendarDays className="w-6 h-6" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <Button variant="outline" size="icon" onClick={prevMonth} className="h-8 w-8 border-[#007E8C]/30 text-[#236383] hover:bg-[#007E8C]/10" aria-label="Previous month">
                          <ChevronLeft className="w-4 h-4" />
                        </Button>
                        <CardTitle className="min-w-[180px] text-center text-xl sm:text-2xl text-[#236383]">
                          {format(currentMonth, 'MMMM yyyy')}
                        </CardTitle>
                        <Button variant="outline" size="icon" onClick={nextMonth} className="h-8 w-8 border-[#007E8C]/30 text-[#236383] hover:bg-[#007E8C]/10" aria-label="Next month">
                          <ChevronRight className="w-4 h-4" />
                        </Button>
                      </div>
                      <CardDescription className="mt-1 text-sm text-gray-700">
                        Pick a day to see the full event details and sign up.
                      </CardDescription>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <div className="hidden sm:flex items-center gap-2 rounded-lg bg-white border border-[#007E8C]/20 px-3 py-2 text-sm text-[#236383]">
                      <HandHeart className="w-4 h-4 text-[#007E8C]" />
                      <span className="font-semibold">{monthCalendarSummary.openings}</span>
                      <span>open spots</span>
                    </div>
                    <Button variant="outline" size="sm" onClick={goToToday} className="border-[#007E8C]/30 text-[#236383] hover:bg-[#007E8C]/10">
                      Today
                    </Button>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 mt-4">
                  <div className="rounded-lg bg-white border border-[#007E8C]/15 p-3">
                    <div className="text-2xl font-bold text-[#236383]">{monthCalendarSummary.events}</div>
                    <div className="text-xs font-medium text-gray-600">events shown</div>
                  </div>
                  <div className="rounded-lg bg-white border border-[#007E8C]/15 p-3">
                    <div className="text-2xl font-bold text-[#007E8C]">{monthCalendarSummary.days}</div>
                    <div className="text-xs font-medium text-gray-600">days with events</div>
                  </div>
                  <div className="rounded-lg bg-white border border-[#FBAD3F]/30 p-3">
                    <div className="text-2xl font-bold text-[#B45309]">{monthCalendarSummary.openings}</div>
                    <div className="text-xs font-medium text-gray-600">spots open</div>
                  </div>
                </div>
              </div>

              <CardContent className="p-4 sm:p-6">
                <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_420px] gap-5">
                  <div className="space-y-3">
                    <div className="grid grid-cols-7 gap-1 sm:gap-2">
                      {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                        <div key={day} className="text-center text-[11px] sm:text-sm font-bold text-[#236383] py-2">
                          {day}
                        </div>
                      ))}

                      {paddedDays.map((day, idx) => {
                        if (!day) {
                          return <div key={`empty-${idx}`} className="min-h-[76px] sm:min-h-[120px]" />;
                        }

                        const dateKey = format(day, 'yyyy-MM-dd');
                        const dayEvents = eventsByDate[dateKey] || [];
                        const roleOpenings = getTotalOpeningsForEvents(dayEvents);
                        const isToday = isSameDay(day, new Date());
                        const isPast = !isAfter(day, startOfDay(new Date())) && !isToday;
                        const isSelected = selectedCalendarDate === dateKey;
                        const hasEvents = dayEvents.length > 0;
                        const topRoles = dayEvents.flatMap(getRoleOpenings).slice(0, 3);

                        return (
                          <button
                            key={dateKey}
                            type="button"
                            onClick={() => hasEvents && setSelectedCalendarDate(dateKey)}
                            disabled={!hasEvents}
                            className={cn(
                              'relative min-h-[76px] sm:min-h-[120px] rounded-xl border p-2 text-left transition-all',
                              hasEvents
                                ? 'bg-white border-[#47B3CB]/35 hover:border-[#007E8C] hover:shadow-md cursor-pointer'
                                : 'bg-gray-50 border-gray-100 cursor-default',
                              isPast && hasEvents && 'opacity-75',
                              isSelected && 'ring-2 ring-[#FBAD3F] border-[#007E8C] shadow-md bg-[#FAF8F4]',
                              isToday && !isSelected && 'ring-2 ring-[#47B3CB]/60',
                            )}
                          >
                            <div className="flex items-center justify-between gap-1">
                              <span
                                className={cn(
                                  'inline-flex h-7 w-7 items-center justify-center rounded-full text-sm font-bold',
                                  isToday ? 'bg-[#007E8C] text-white' : hasEvents ? 'text-[#236383]' : 'text-gray-400',
                                )}
                              >
                                {format(day, 'd')}
                              </span>
                              {hasEvents && (
                                <span className="rounded-full bg-[#FBAD3F]/20 px-2 py-0.5 text-[10px] font-bold text-[#92400E]">
                                  {dayEvents.length}
                                </span>
                              )}
                            </div>

                            {hasEvents ? (
                              <div className="mt-2 space-y-1">
                                <div className="text-[11px] sm:text-sm font-bold text-[#236383] leading-tight">
                                  {dayEvents.length} {dayEvents.length === 1 ? 'event' : 'events'}
                                </div>
                                <div className="text-[10px] sm:text-xs text-gray-600">
                                  {roleOpenings > 0
                                    ? `${roleOpenings} ${roleOpenings === 1 ? 'spot' : 'spots'} open`
                                    : 'Extra help welcome'}
                                </div>
                                <div className="hidden sm:flex flex-wrap gap-1 pt-1">
                                  {topRoles.map((role, roleIdx) => (
                                    <span
                                      key={`${role.singular}-${roleIdx}`}
                                      className="inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[10px] font-bold"
                                      style={{ backgroundColor: role.bg, color: role.color }}
                                      title={formatNeededRole(role)}
                                    >
                                      <role.Icon className="w-3 h-3" />
                                      {role.count > 1 && <span className="ml-0.5">{role.count}</span>}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            ) : (
                              <div className="mt-2 text-[10px] sm:text-xs text-gray-400">No events</div>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-[#007E8C]/20 bg-[#FAF8F4] p-4 sm:p-5 min-h-[360px]">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="text-lg font-bold text-[#236383]">{selectedDateLabel}</h3>
                        <p className="text-sm text-gray-600 mt-1">
                          {selectedCalendarDate
                            ? selectedDateEvents.length > 0
                              ? `${selectedDateEvents.length} ${selectedDateEvents.length === 1 ? 'event' : 'events'} available`
                              : 'No events on this day'
                            : 'Select a day with a gold number.'}
                        </p>
                      </div>
                      {selectedDateEvents.length > 0 && (
                        <Badge className="bg-[#007E8C] text-white border-transparent">
                          {getTotalOpeningsForEvents(selectedDateEvents)} open
                        </Badge>
                      )}
                    </div>

                    <div className="mt-4 space-y-3">
                      {selectedDateEvents.length === 0 ? (
                        <div className="rounded-xl bg-white border border-dashed border-[#47B3CB]/40 p-6 text-center">
                          <Calendar className="w-9 h-9 mx-auto text-[#47B3CB]" />
                          <p className="font-semibold text-[#236383] mt-3">Choose a day with events</p>
                          <p className="text-sm text-gray-600 mt-1">
                            Days with opportunities show a gold count in the corner.
                          </p>
                        </div>
                      ) : (
                        selectedDateEvents.map((event) => {
                          const roles = getRoleOpenings(event);
                          const existingSignup = getExistingSignup(event.id);

                          return (
                            <div key={event.id} className="rounded-xl bg-white border border-[#47B3CB]/25 shadow-sm overflow-hidden">
                              <div className="h-1 bg-gradient-to-r from-[#FBAD3F] via-[#47B3CB] to-[#007E8C]" />
                              <div className="p-4 space-y-3">
                                <div className="flex items-start justify-between gap-3">
                                  <div className="min-w-0">
                                    <h4 className="font-bold text-[#236383] leading-tight">{event.organizationName}</h4>
                                    {event.department && (
                                      <p className="text-sm text-gray-500 mt-0.5">{event.department}</p>
                                    )}
                                  </div>
                                </div>

                                <div className="grid gap-2 text-sm text-gray-700">
                                  <div className="flex items-center gap-2">
                                    <Clock className="w-4 h-4 text-[#007E8C] shrink-0" />
                                    <span>{formatEventTime(event.eventStartTime, event.eventEndTime)}</span>
                                  </div>
                                  {event.eventAddress && (
                                    <AddressLink
                                      location={event}
                                      className="text-gray-700"
                                      iconClassName="w-4 h-4 text-[#007E8C] shrink-0 mt-0.5"
                                    />
                                  )}
                                  {event.estimatedSandwichCount && (
                                    <div className="flex items-center gap-2">
                                      <Sandwich className="w-4 h-4 text-[#B45309] shrink-0" />
                                      <span>{event.estimatedSandwichCount.toLocaleString()} sandwiches</span>
                                    </div>
                                  )}
                                </div>

                                <div className="flex flex-wrap gap-2">
                                  {roles.length > 0 ? roles.map((role) => (
                                    <span
                                      key={role.singular}
                                      className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold"
                                      style={{ backgroundColor: role.bg, color: role.color }}
                                    >
                                      <role.Icon className="w-3.5 h-3.5" />
                                      {formatNeededRole(role)}
                                    </span>
                                  )) : (
                                    <span className="inline-flex items-center gap-1.5 rounded-full bg-green-50 text-green-700 px-3 py-1.5 text-xs font-bold">
                                      <CheckCircle2 className="w-3.5 h-3.5" />
                                      Extra help welcome
                                    </span>
                                  )}
                                </div>

                                {existingSignup ? (
                                  <div className="rounded-lg bg-[#47B3CB]/10 border border-[#47B3CB]/30 px-3 py-2 text-sm font-semibold text-[#236383] flex items-center justify-between gap-2">
                                    <span className="inline-flex items-center gap-2">
                                      <Check className="w-4 h-4" />
                                      You signed up
                                    </span>
                                    <StatusBadge status={existingSignup.status} />
                                  </div>
                                ) : (
                                  <div className="grid gap-2 sm:grid-cols-2">
                                    {canSelfSignup ? (
                                      <Button
                                        className="bg-[#007E8C] hover:bg-[#236383] text-white"
                                        onClick={() => handleSignupClick(event.id)}
                                      >
                                        <HandHeart className="w-4 h-4 mr-2" />
                                        Sign Up
                                      </Button>
                                    ) : (
                                      <div className="rounded-md bg-gray-50 border border-gray-200 px-3 py-2 text-xs text-gray-600 text-center">
                                        Ask a coordinator to sign you up.
                                      </div>
                                    )}
                                    {canAssignOthers && (
                                      <Button
                                        variant="outline"
                                        className="border-[#236383]/30 text-[#236383] hover:bg-[#236383]/5"
                                        onClick={() => handleAssignClick(event.id)}
                                      >
                                        <Users className="w-4 h-4 mr-2" />
                                        Assign Someone
                                      </Button>
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Map View */}
          <TabsContent value="map" className="mt-0">
            <Card>
              <CardContent className="p-0">
                {/* Address search for distance */}
                <div className="p-4 border-b space-y-2">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                    <div className="flex items-center gap-2">
                      <Navigation className="w-4 h-4 text-[#236383] shrink-0" />
                      <span className="text-sm font-medium text-gray-700">Your location:</span>
                    </div>
                    <div className="flex flex-1 flex-col gap-2 sm:flex-row sm:flex-wrap">
                      <Input
                        placeholder="Enter your address to see distances..."
                        value={userAddress}
                        onChange={(e) => setUserAddress(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleGeocodeAddress()}
                        className="min-w-0 flex-1 text-sm sm:min-w-[180px]"
                      />
                      <Button
                        size="sm"
                        onClick={handleGeocodeAddress}
                        disabled={geocodingLoading || !userAddress.trim()}
                        className="shrink-0 bg-[#007e8c] hover:bg-[#236383]"
                      >
                        {geocodingLoading ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Search className="w-4 h-4" />
                        )}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={handleUseBrowserLocation}
                        disabled={browserLocationLoading}
                        className="shrink-0 gap-1.5 border-[#007e8c]/30 text-xs text-[#236383] hover:bg-[#007e8c]/10"
                      >
                        {browserLocationLoading ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <LocateFixed className="w-3.5 h-3.5" />
                        )}
                        Use my current location
                      </Button>
                      {userLocation && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => { setUserLocation(null); setUserAddress(''); }}
                          className="shrink-0 text-xs"
                        >
                          Clear
                        </Button>
                      )}
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground sm:ml-6">
                    Your browser will ask for permission before sharing your location.
                  </p>
                  {userLocation && (
                    <p className="text-xs text-green-600 sm:ml-6">
                      <Check className="w-3 h-3 inline mr-1" />
                      Location set — distances shown in event popups
                    </p>
                  )}
                </div>

                {/* Date range info */}
                <div className="px-4 py-2 border-b bg-gray-50 text-sm text-gray-600">
                  <Calendar className="w-3.5 h-3.5 inline mr-1.5 -mt-0.5 text-[#007e8c]" />
                  Showing <span className="font-semibold text-[#007e8c]">{filteredEvents.length}</span> scheduled events from today onward that need volunteers, speakers, or drivers
                </div>

                <div className="h-[520px] overflow-hidden rounded-lg sm:h-[600px]">
                  <MapContainer
                    center={userLocation ? [userLocation.lat, userLocation.lng] : mapCenter}
                    zoom={11}
                    style={{ height: '100%', width: '100%' }}
                  >
                    <TileLayer
                      attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
                      url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
                    />
                    <MapCenterSetter center={userLocation ? [userLocation.lat, userLocation.lng] : mapCenter} />

                    {/* User location marker */}
                    {userLocation && (
                      <Marker
                        position={[userLocation.lat, userLocation.lng]}
                        icon={createUserLocationIcon()}
                      >
                        <Popup>
                          <div className="text-sm font-medium">Your Location</div>
                          <div className="text-xs text-muted-foreground">{userAddress}</div>
                        </Popup>
                      </Marker>
                    )}

                    {filteredEvents
                      .filter(e => e.latitude && e.longitude)
                      .map(event => (
                        <Marker
                          key={event.id}
                          position={[parseFloat(event.latitude!), parseFloat(event.longitude!)]}
                          icon={createEventIcon(
                            event.speakersUnfilled > 0,
                            event.volunteersUnfilled > 0,
                            event.driversUnfilled > 0,
                            event.status === 'completed',
                            event.vanDriverNeeded
                          )}
                        >
                          <Tooltip
                            permanent
                            direction="top"
                            offset={[0, -44]}
                            opacity={1}
                            className="volunteer-map-event-label"
                          >
                            <div className="max-w-[150px]">
                              <div className="truncate font-semibold">{event.organizationName}</div>
                              <div className="text-[11px] font-medium text-[#236383]">
                                {getEventDateLabel(event)}
                              </div>
                            </div>
                          </Tooltip>
                          <Popup minWidth={380} maxWidth={420} className="volunteer-map-event-popup">
                            <MapEventPopupContent
                              event={event}
                              onSignupClick={handleSignupClick}
                              canSelfSignup={canSelfSignup}
                              canAssignOthers={canAssignOthers}
                              onAssignClick={handleAssignClick}
                              userLocation={userLocation}
                            />
                          </Popup>
                        </Marker>
                      ))}
                  </MapContainer>
                </div>

                {/* Map Legend */}
                <div className="p-4 border-t flex flex-wrap gap-4 text-sm text-muted-foreground">
                  <div className="flex items-center gap-1.5">
                    <div className="w-4 h-4 rounded-full bg-[#007e8c]" />
                    <span>Needs help</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-4 h-4 rounded-full bg-gray-400" />
                    <span>Filled or completed</span>
                  </div>
                  {userLocation && (
                    <div className="flex items-center gap-1.5">
                      <div className="w-4 h-4 rounded-full bg-blue-500 border-2 border-white shadow" />
                      <span>Your location</span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* List View */}
          <TabsContent value="list" className="mt-0">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredEvents.length === 0 ? (
                <Card className="col-span-full">
                  <CardContent className="py-12 text-center">
                    <Calendar className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                    <h3 className="text-lg font-medium">No Events Found</h3>
                    <p className="text-muted-foreground mt-1">
                      {showOnlyNeeds
                        ? 'All current events are fully staffed!'
                        : 'No upcoming events match your filters.'}
                    </p>
                  </CardContent>
                </Card>
              ) : (
                filteredEvents.map(event => (
                  <EventCard
                    key={event.id}
                    event={event}
                    onSignup={handleSignupClick}
                    onAssign={canAssignOthers ? handleAssignClick : undefined}
                    canSelfSignup={canSelfSignup}
                    canAssignOthers={canAssignOthers}
                    existingSignup={getExistingSignup(event.id)}
                  />
                ))
              )}
            </div>
          </TabsContent>

          {/* My Signups View */}
          <TabsContent value="my_signups" className="mt-0">
            {mySignups.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <HandHeart className="w-12 h-12 mx-auto text-[#007e8c] mb-4" />
                  <h3 className="text-lg font-medium">You haven't signed up yet — that's okay!</h3>
                  <p className="text-muted-foreground mt-2 max-w-md mx-auto">
                    Every sandwich helps. Browse upcoming events to find one that fits your schedule.
                  </p>
                  <Button
                    className="mt-4 bg-[#007e8c] hover:bg-[#236383]"
                    onClick={() => setView('list')}
                  >
                    Browse Events
                  </Button>
                </CardContent>
              </Card>
            ) : (() => {
              const filteredSignups = mySignupsRoleFilter === 'all'
                ? mySignups
                : mySignups.filter(s => s.role === mySignupsRoleFilter);
              return (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Filter className="w-4 h-4 text-muted-foreground" />
                  <Select value={mySignupsRoleFilter} onValueChange={setMySignupsRoleFilter}>
                    <SelectTrigger className="w-[160px]">
                      <SelectValue placeholder="Filter by role" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Roles</SelectItem>
                      <SelectItem value="speaker">Speaker</SelectItem>
                      <SelectItem value="general">General Volunteer</SelectItem>
                      <SelectItem value="driver">Driver</SelectItem>
                    </SelectContent>
                  </Select>
                  <span className="text-xs text-muted-foreground">
                    {filteredSignups.length} of {mySignups.length}
                  </span>
                </div>
                {filteredSignups.length === 0 ? (
                  <Card>
                    <CardContent className="py-8 text-center text-sm text-muted-foreground">
                      No signups in this role.
                    </CardContent>
                  </Card>
                ) : (
                filteredSignups.map(signup => {
                  const signupDate = signup.event.scheduledEventDate || signup.event.desiredEventDate;
                  const formattedSignupDate = signupDate
                    ? format(parseEventDate(signupDate)!, 'EEEE, MMMM d, yyyy')
                    : 'Date TBD';

                  return (
                    <Card key={signup.id} className="border-l-4 border-l-[#47b3cb] hover:shadow-md transition-shadow">
                      <CardContent className="p-4">
                        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                          <div className="flex-1 min-w-0 space-y-2">
                            <div>
                              <h3 className="font-semibold text-base">{signup.event.organizationName}</h3>
                              <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                                <Calendar className="w-4 h-4 shrink-0 text-[#007e8c]" />
                                <span>
                                  {formattedSignupDate}
                                  {' · '}{formatEventTime(signup.event.eventStartTime)}
                                </span>
                              </div>
                              {signup.event.eventAddress && (
                                <AddressLink
                                  location={signup.event}
                                  className="mt-1"
                                  iconClassName="w-4 h-4 shrink-0 mt-0.5 text-[#007e8c]"
                                />
                              )}
                            </div>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <span>Signed up {format(parseISO(signup.signedUpAt), 'MMM d, yyyy')}</span>
                              {signup.notes && <span>— {signup.notes}</span>}
                            </div>
                          </div>
                          <div className="flex flex-wrap gap-2 sm:flex-col sm:items-end sm:shrink-0">
                            <RoleBadge role={signup.role} />
                            <StatusBadge status={signup.status} />
                            {signup.status === 'pending' && (
                              <Button
                                variant="outline"
                                size="sm"
                                className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                onClick={() => cancelSignupMutation.mutate(signup.id)}
                                disabled={cancelSignupMutation.isPending}
                              >
                                <X className="w-3 h-3 mr-1" />
                                Cancel
                              </Button>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })
                )}
              </div>
              );
            })()}
          </TabsContent>

          {/* Pending Approvals View */}
          <TabsContent value="pending_approvals" className="mt-0">
            {pendingSignups.length === 0 ? (
              <Card className="border-dashed">
                <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                  <Check className="w-12 h-12 text-green-400 mb-4" />
                  <h3 className="text-lg font-semibold text-gray-900 mb-1">All caught up!</h3>
                  <p className="text-sm text-gray-500">No signups waiting for approval.</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-gray-600">{pendingSignups.length} signup{pendingSignups.length !== 1 ? 's' : ''} awaiting approval</p>
                {pendingSignups.map((signup: any) => {
                  const eventDate = signup.event?.scheduledEventDate || signup.event?.desiredEventDate;
                  return (
                    <Card key={signup.id} className="border border-gray-200 hover:shadow-md transition-shadow">
                      <CardContent className="p-4">
                        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                          <div className="flex-1 space-y-2">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-semibold text-gray-900">{signup.volunteerName || 'Unknown'}</span>
                              <RoleBadge role={signup.role} />
                              <Badge variant="outline" className="bg-amber-100 text-amber-800 border-amber-200">
                                <Clock className="w-3 h-3 mr-1" />Pending
                              </Badge>
                            </div>
                            <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-600">
                              {signup.volunteerEmail && (
                                <span className="flex items-center gap-1">
                                  <MapPin className="w-3.5 h-3.5" />
                                  {signup.volunteerEmail}
                                </span>
                              )}
                              {signup.volunteerPhone && (
                                <span className="flex items-center gap-1">
                                  <Clock className="w-3.5 h-3.5" />
                                  {signup.volunteerPhone}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 text-sm text-gray-700 bg-gray-50 px-3 py-1.5 rounded-md">
                              <Building2 className="w-3.5 h-3.5 text-[#236383] shrink-0" />
                              <span className="font-medium">{signup.event?.organizationName || 'Unknown Event'}</span>
                              {eventDate && (
                                <>
                                  <span className="text-gray-400">|</span>
                                  <Calendar className="w-3.5 h-3.5 text-[#236383]" />
                                  <span>{format(parseEventDate(eventDate)!, 'MMM d, yyyy')}</span>
                                  <span>· {formatEventTime(signup.event?.eventStartTime)}</span>
                                </>
                              )}
                            </div>
                            {signup.notes && (
                              <p className="text-sm text-gray-600 italic bg-amber-50 px-3 py-1.5 rounded-md">"{signup.notes}"</p>
                            )}
                            <div className="text-xs text-gray-400">
                              Signed up {format(parseISO(signup.signedUpAt), 'MMM d, yyyy h:mm a')}
                            </div>
                          </div>
                          <div className="grid gap-2 sm:flex sm:flex-col sm:shrink-0">
                            <Button
                              size="sm"
                              className="bg-green-600 hover:bg-green-700 text-white"
                              onClick={() => updateSignupStatusMutation.mutate({ signupId: signup.id, status: 'assigned' })}
                              disabled={updateSignupStatusMutation.isPending}
                            >
                              <Check className="w-4 h-4 mr-1" />
                              Approve
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="border-red-300 text-red-600 hover:bg-red-50"
                              onClick={() => updateSignupStatusMutation.mutate({ signupId: signup.id, status: 'declined' })}
                              disabled={updateSignupStatusMutation.isPending}
                            >
                              <X className="w-4 h-4 mr-1" />
                              Decline
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}

            {/* Approved / Declined signups management list */}
            <div className="mt-8">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-lg font-semibold text-[#236383]">Approved &amp; Declined Signups</h3>
                <p className="text-xs text-gray-500">{allSignups.filter((s: any) => s.status !== 'pending').length} total</p>
              </div>
              {(() => {
                const managed = allSignups.filter((s: any) => s.status !== 'pending');
                if (managed.length === 0) {
                  return (
                    <Card className="border-dashed">
                      <CardContent className="flex flex-col items-center justify-center py-8 text-center">
                        <p className="text-sm text-gray-500">No approved or declined signups yet.</p>
                      </CardContent>
                    </Card>
                  );
                }
                return (
                  <div className="space-y-2">
                    {managed.map((signup: any) => {
                      const eventDate = signup.event?.scheduledEventDate || signup.event?.desiredEventDate;
                      const isApproved = signup.status === 'confirmed' || signup.status === 'assigned';
                      const isDeclined = signup.status === 'declined';
                      const vanNeeded = !!signup.event?.vanDriverNeeded;
                      const driverConflict = isApproved && signup.role === 'driver' && vanNeeded;
                      return (
                        <Card
                          key={signup.id}
                          className={cn(
                            'border transition-shadow hover:shadow-sm',
                            isApproved ? 'border-[#47B3CB]/40' : 'border-gray-200',
                            driverConflict && 'border-[#A31C41]/60 bg-[#A31C41]/5'
                          )}
                        >
                          <CardContent className="p-3">
                            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                              <div className="flex-1 min-w-0 space-y-1.5">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="font-semibold text-gray-900 truncate">{signup.volunteerName || 'Unknown'}</span>
                                  <RoleBadge role={signup.role} />
                                  {isApproved && (
                                    <Badge className="bg-[#47B3CB] text-white border-transparent">
                                      <Check className="w-3 h-3 mr-1" />Approved
                                    </Badge>
                                  )}
                                  {isDeclined && (
                                    <Badge variant="outline" className="bg-gray-100 text-gray-700 border-gray-300">
                                      Declined
                                    </Badge>
                                  )}
                                  {driverConflict && (
                                    <Badge className="bg-[#A31C41] text-white border-transparent">
                                      <AlertCircle className="w-3 h-3 mr-1" />Van Needed — Driver Conflict
                                    </Badge>
                                  )}
                                </div>
                                <div className="flex flex-wrap items-center gap-2 rounded bg-gray-50 px-2.5 py-1 text-xs text-gray-700">
                                  <Building2 className="w-3.5 h-3.5 text-[#236383] shrink-0" />
                                  <span className="font-medium truncate">{signup.event?.organizationName || 'Unknown Event'}</span>
                                  {eventDate && (
                                    <>
                                      <span className="text-gray-400">|</span>
                                      <Calendar className="w-3.5 h-3.5 text-[#236383]" />
                                      <span>{format(parseEventDate(eventDate)!, 'MMM d, yyyy')}</span>
                                      {signup.event?.eventStartTime && (
                                        <span className="text-gray-500">· {formatEventTime(signup.event.eventStartTime)}</span>
                                      )}
                                    </>
                                  )}
                                </div>
                                <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-gray-500">
                                  {signup.volunteerEmail && <span>{signup.volunteerEmail}</span>}
                                  {signup.volunteerPhone && <span>{signup.volunteerPhone}</span>}
                                </div>
                              </div>
                              {isApproved && (
                                <div className="grid gap-1.5 sm:flex sm:flex-col sm:shrink-0">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="border-[#FBAD3F] text-[#a07227] hover:bg-[#FBAD3F]/10 h-7 px-2 text-xs"
                                    onClick={() => {
                                      setManageSignup(signup);
                                      setManageMode('change_role');
                                      setManageDialogOpen(true);
                                    }}
                                  >
                                    Change Role
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="border-[#A31C41] text-[#A31C41] hover:bg-[#A31C41]/10 h-7 px-2 text-xs"
                                    onClick={() => {
                                      setManageSignup(signup);
                                      setManageMode('remove');
                                      setManageDialogOpen(true);
                                    }}
                                  >
                                    Remove
                                  </Button>
                                </div>
                              )}
                              {isDeclined && (
                                <div className="grid gap-1.5 sm:flex sm:flex-col sm:shrink-0">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="border-green-500 text-green-700 hover:bg-green-50 h-7 px-2 text-xs"
                                    onClick={() => updateSignupStatusMutation.mutate({ signupId: signup.id, status: 'assigned' })}
                                    disabled={updateSignupStatusMutation.isPending}
                                  >
                                    Re-approve
                                  </Button>
                                </div>
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                );
              })()}
            </div>
          </TabsContent>
        </Tabs>

        {/* Signup Dialog */}
        <SignupDialog
          event={selectedEvent}
          open={signupDialogOpen}
          onOpenChange={setSignupDialogOpen}
          onSubmit={handleSignupSubmit}
          isSubmitting={signupMutation.isPending}
        />

        {/* Manage signup dialog (change role / remove) */}
        <ManageSignupDialog
          signup={manageSignup}
          mode={manageMode}
          open={manageDialogOpen}
          onOpenChange={(open) => {
            setManageDialogOpen(open);
            if (!open) {
              setManageSignup(null);
              setManageMode(null);
            }
          }}
          onChangeRole={(signupId, role, reason) => {
            changeRoleMutation.mutate(
              { signupId, role, reason },
              {
                onSuccess: () => {
                  setManageDialogOpen(false);
                  setManageSignup(null);
                  setManageMode(null);
                },
              }
            );
          }}
          onRemove={(signupId, reason) => {
            removeSignupMutation.mutate(
              { signupId, reason },
              {
                onSuccess: () => {
                  setManageDialogOpen(false);
                  setManageSignup(null);
                  setManageMode(null);
                },
              }
            );
          }}
          isSubmitting={changeRoleMutation.isPending || removeSignupMutation.isPending}
        />

        {/* Assign Others Dialog - only opened when a coordinator clicks "Assign Someone" */}
        {canAssignOthers && (
          <AssignOthersDialog
            event={selectedEvent}
            open={assignDialogOpen}
            onOpenChange={setAssignDialogOpen}
            onSubmit={handleAssignSubmit}
            isSubmitting={assignOthersMutation.isPending}
          />
        )}

    </div>
  );
}
