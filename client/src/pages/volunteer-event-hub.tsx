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
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths, parseISO, isAfter, startOfDay } from 'date-fns';
import { useAuth } from '@/hooks/useAuth';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

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
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

// Icons
import {
  Calendar,
  MapPin,
  Clock,
  Users,
  Mic,
  Car,
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
  Info,
} from 'lucide-react';

// Fix Leaflet default marker icon
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

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

// Custom marker icons
const createEventIcon = (needsSpeaker: boolean, needsVolunteer: boolean, needsDriver: boolean) => {
  let color = '#22c55e'; // Green for general events
  if (needsSpeaker) color = '#a855f7'; // Purple for speaker needed
  else if (needsDriver) color = '#3b82f6'; // Blue for driver needed
  else if (needsVolunteer) color = '#22c55e'; // Green for volunteer needed

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
    map.setView(center, 10);
  }, [center, map]);
  return null;
}

// Role badge component
function RoleBadge({ role }: { role: string }) {
  const config = {
    speaker: { label: 'Speaker', icon: Mic, className: 'bg-purple-100 text-purple-800 border-purple-200' },
    driver: { label: 'Driver', icon: Car, className: 'bg-blue-100 text-blue-800 border-blue-200' },
    general: { label: 'Volunteer', icon: UserCheck, className: 'bg-green-100 text-green-800 border-green-200' },
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
    pending: { label: 'Pending Approval', className: 'bg-yellow-100 text-yellow-800 border-yellow-200' },
    confirmed: { label: 'Confirmed', className: 'bg-green-100 text-green-800 border-green-200' },
    declined: { label: 'Declined', className: 'bg-red-100 text-red-800 border-red-200' },
    assigned: { label: 'Assigned', className: 'bg-blue-100 text-blue-800 border-blue-200' },
  }[status] || { label: status, className: 'bg-gray-100 text-gray-800 border-gray-200' };

  return (
    <Badge variant="outline" className={config.className}>
      {config.label}
    </Badge>
  );
}

// Event card component
function EventCard({
  event,
  onSignup,
  existingSignup,
}: {
  event: AvailableEvent;
  onSignup: (eventId: number) => void;
  existingSignup?: MySignup;
}) {
  const eventDate = event.scheduledEventDate || event.desiredEventDate;
  const formattedDate = eventDate
    ? format(parseISO(eventDate), 'EEEE, MMMM d, yyyy')
    : 'Date TBD';

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <CardTitle className="text-base truncate">{event.organizationName}</CardTitle>
            {event.department && (
              <CardDescription className="text-xs truncate">{event.department}</CardDescription>
            )}
          </div>
          {event.organizationCategory && (
            <Badge variant="secondary" className="text-xs shrink-0">
              {event.organizationCategory}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Date & Time */}
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Calendar className="w-4 h-4 shrink-0" />
          <span>{formattedDate}</span>
        </div>
        {event.eventStartTime && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Clock className="w-4 h-4 shrink-0" />
            <span>
              {event.eventStartTime}
              {event.eventEndTime && ` - ${event.eventEndTime}`}
            </span>
          </div>
        )}

        {/* Location */}
        {event.eventAddress && (
          <div className="flex items-start gap-2 text-sm text-muted-foreground">
            <MapPin className="w-4 h-4 shrink-0 mt-0.5" />
            <span className="break-words">
              {event.eventAddress}
              {event.city && `, ${event.city}`}
              {event.state && `, ${event.state}`}
            </span>
          </div>
        )}

        {/* Sandwich count */}
        {event.estimatedSandwichCount && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Sandwich className="w-4 h-4 shrink-0 text-amber-500" />
            <span>{event.estimatedSandwichCount} sandwiches</span>
          </div>
        )}

        {/* Needs badges */}
        <div className="flex flex-wrap gap-1.5">
          {event.speakersUnfilled > 0 && (
            <Badge className="bg-purple-600 hover:bg-purple-700 text-white gap-1">
              <Mic className="w-3 h-3" />
              {event.speakersUnfilled} Speaker{event.speakersUnfilled > 1 ? 's' : ''} Needed
            </Badge>
          )}
          {event.volunteersUnfilled > 0 && (
            <Badge className="bg-green-600 hover:bg-green-700 text-white gap-1">
              <UserCheck className="w-3 h-3" />
              {event.volunteersUnfilled} Volunteer{event.volunteersUnfilled > 1 ? 's' : ''} Needed
            </Badge>
          )}
          {event.driversUnfilled > 0 && (
            <Badge className="bg-blue-600 hover:bg-blue-700 text-white gap-1">
              <Car className="w-3 h-3" />
              {event.driversUnfilled} Driver{event.driversUnfilled > 1 ? 's' : ''} Needed
            </Badge>
          )}
          {event.vanDriverNeeded && (
            <Badge className="bg-indigo-600 hover:bg-indigo-700 text-white gap-1">
              🚐 Van Driver Needed
            </Badge>
          )}
        </div>

        {/* Action button */}
        <div className="pt-2 border-t">
          {existingSignup ? (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-green-600" />
                <span className="text-sm text-muted-foreground">
                  Signed up as {existingSignup.role}
                </span>
              </div>
              <StatusBadge status={existingSignup.status} />
            </div>
          ) : (
            <Button
              className="w-full"
              onClick={() => onSignup(event.id)}
              disabled={!event.hasUnfilledNeeds}
            >
              <HandHeart className="w-4 h-4 mr-2" />
              Volunteer for this Event
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
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
  onSubmit: (role: string, notes: string) => void;
  isSubmitting: boolean;
}) {
  const [selectedRole, setSelectedRole] = useState<string>('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (open && event) {
      // Auto-select the first available role
      if (event.speakersUnfilled > 0) setSelectedRole('speaker');
      else if (event.volunteersUnfilled > 0) setSelectedRole('general');
      else if (event.driversUnfilled > 0) setSelectedRole('driver');
      else setSelectedRole('');
      setNotes('');
    }
  }, [open, event]);

  if (!event) return null;

  const eventDate = event.scheduledEventDate || event.desiredEventDate;
  const formattedDate = eventDate
    ? format(parseISO(eventDate), 'EEEE, MMMM d, yyyy')
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
            <Label>Select your role *</Label>
            <Select value={selectedRole} onValueChange={setSelectedRole}>
              <SelectTrigger>
                <SelectValue placeholder="Choose a role..." />
              </SelectTrigger>
              <SelectContent>
                {event.speakersUnfilled > 0 && (
                  <SelectItem value="speaker">
                    <div className="flex items-center gap-2">
                      <Mic className="w-4 h-4 text-purple-600" />
                      <span>Speaker ({event.speakersUnfilled} needed)</span>
                    </div>
                  </SelectItem>
                )}
                {event.volunteersUnfilled > 0 && (
                  <SelectItem value="general">
                    <div className="flex items-center gap-2">
                      <UserCheck className="w-4 h-4 text-green-600" />
                      <span>General Volunteer ({event.volunteersUnfilled} needed)</span>
                    </div>
                  </SelectItem>
                )}
                {event.driversUnfilled > 0 && (
                  <SelectItem value="driver">
                    <div className="flex items-center gap-2">
                      <Car className="w-4 h-4 text-blue-600" />
                      <span>Driver ({event.driversUnfilled} needed)</span>
                    </div>
                  </SelectItem>
                )}
              </SelectContent>
            </Select>
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes">Notes (optional)</Label>
            <Textarea
              id="notes"
              placeholder="Any special skills, availability notes, or questions..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
            />
          </div>

          {/* Info box */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-800">
            <div className="flex items-start gap-2">
              <Info className="w-4 h-4 mt-0.5 shrink-0" />
              <div>
                <p className="font-medium">What happens next?</p>
                <p className="text-blue-700 mt-1">
                  A coordinator will review your signup and confirm your participation.
                  You'll receive an email notification once your signup is approved.
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
            onClick={() => onSubmit(selectedRole, notes)}
            disabled={!selectedRole || isSubmitting}
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

// Main component
export default function VolunteerEventHub() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // View state
  const [view, setView] = useState<'calendar' | 'map' | 'list'>('calendar');
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedEvent, setSelectedEvent] = useState<AvailableEvent | null>(null);
  const [signupDialogOpen, setSignupDialogOpen] = useState(false);

  // Filters
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [showOnlyNeeds, setShowOnlyNeeds] = useState(true);

  // Fetch available events
  const { data: events = [], isLoading: eventsLoading } = useQuery<AvailableEvent[]>({
    queryKey: ['/api/volunteer-hub/available-events', showOnlyNeeds],
    queryFn: async () => {
      const response = await fetch(`/api/volunteer-hub/available-events?needsOnly=${showOnlyNeeds}`, {
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

  // Signup mutation
  const signupMutation = useMutation({
    mutationFn: async ({ eventId, role, notes }: { eventId: number; role: string; notes: string }) => {
      const response = await fetch(`/api/volunteer-hub/signup/${eventId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role, notes }),
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
    return events.filter(event => {
      if (roleFilter === 'speaker' && event.speakersUnfilled === 0) return false;
      if (roleFilter === 'volunteer' && event.volunteersUnfilled === 0) return false;
      if (roleFilter === 'driver' && event.driversUnfilled === 0) return false;
      return true;
    });
  }, [events, roleFilter]);

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

  // Get existing signup for an event
  const getExistingSignup = (eventId: number) => {
    return mySignups.find(s => s.eventRequestId === eventId);
  };

  // Handle signup click
  const handleSignupClick = (eventId: number) => {
    const event = events.find(e => e.id === eventId);
    if (event) {
      setSelectedEvent(event);
      setSignupDialogOpen(true);
    }
  };

  // Handle signup submit
  const handleSignupSubmit = (role: string, notes: string) => {
    if (selectedEvent) {
      signupMutation.mutate({ eventId: selectedEvent.id, role, notes });
    }
  };

  // Calendar navigation
  const prevMonth = () => setCurrentMonth(subMonths(currentMonth, 1));
  const nextMonth = () => setCurrentMonth(addMonths(currentMonth, 1));
  const goToToday = () => setCurrentMonth(new Date());

  // Calendar days
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const calendarDays = eachDayOfInterval({ start: monthStart, end: monthEnd });

  // Add padding days for calendar grid
  const startPadding = monthStart.getDay();
  const paddedDays = [
    ...Array(startPadding).fill(null),
    ...calendarDays,
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
    <TooltipProvider>
      <div className="p-4 sm:p-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-2">
              <HandHeart className="w-7 h-7 text-green-600" />
              Volunteer Event Hub
            </h1>
            <p className="text-muted-foreground mt-1">
              Browse upcoming events and sign up to volunteer
            </p>
          </div>

          {/* My Signups Summary */}
          {mySignups.length > 0 && (
            <Card className="sm:w-auto">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="bg-green-100 p-2 rounded-full">
                    <Check className="w-5 h-5 text-green-600" />
                  </div>
                  <div>
                    <p className="font-medium">{mySignups.length} Active Signup{mySignups.length > 1 ? 's' : ''}</p>
                    <p className="text-sm text-muted-foreground">
                      {mySignups.filter(s => s.status === 'pending').length} pending approval
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Filters & View Toggle */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
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

          <div className="flex-1" />

          <div className="flex rounded-lg border p-1">
            <Button
              variant={view === 'calendar' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setView('calendar')}
              className="gap-1.5"
            >
              <CalendarDays className="w-4 h-4" />
              Calendar
            </Button>
            <Button
              variant={view === 'map' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setView('map')}
              className="gap-1.5"
            >
              <MapIcon className="w-4 h-4" />
              Map
            </Button>
            <Button
              variant={view === 'list' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setView('list')}
              className="gap-1.5"
            >
              <List className="w-4 h-4" />
              List
            </Button>
          </div>
        </div>

        {/* Main Content */}
        <Tabs value={view} className="space-y-4">
          {/* Calendar View */}
          <TabsContent value="calendar" className="mt-0">
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">
                    {format(currentMonth, 'MMMM yyyy')}
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={goToToday}>
                      Today
                    </Button>
                    <Button variant="outline" size="icon" onClick={prevMonth}>
                      <ChevronLeft className="w-4 h-4" />
                    </Button>
                    <Button variant="outline" size="icon" onClick={nextMonth}>
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {/* Calendar Grid */}
                <div className="grid grid-cols-7 gap-px bg-muted rounded-lg overflow-hidden">
                  {/* Day headers */}
                  {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                    <div key={day} className="bg-muted-foreground/10 p-2 text-center text-sm font-medium">
                      {day}
                    </div>
                  ))}

                  {/* Calendar cells */}
                  {paddedDays.map((day, idx) => {
                    if (!day) {
                      return <div key={`empty-${idx}`} className="bg-background p-2 min-h-[100px]" />;
                    }

                    const dateKey = format(day, 'yyyy-MM-dd');
                    const dayEvents = eventsByDate[dateKey] || [];
                    const isToday = isSameDay(day, new Date());
                    const isPast = !isAfter(day, startOfDay(new Date())) && !isToday;

                    return (
                      <div
                        key={dateKey}
                        className={cn(
                          'bg-background p-2 min-h-[100px] border-t',
                          isPast && 'opacity-50',
                          isToday && 'ring-2 ring-inset ring-blue-500'
                        )}
                      >
                        <div className={cn(
                          'text-sm font-medium mb-1',
                          isToday && 'bg-blue-500 text-white w-6 h-6 rounded-full flex items-center justify-center'
                        )}>
                          {format(day, 'd')}
                        </div>
                        <div className="space-y-1">
                          {dayEvents.slice(0, 3).map(event => (
                            <Tooltip key={event.id}>
                              <TooltipTrigger asChild>
                                <button
                                  className={cn(
                                    'w-full text-left text-xs p-1 rounded truncate',
                                    'bg-green-100 text-green-800 hover:bg-green-200',
                                    event.speakersUnfilled > 0 && 'bg-purple-100 text-purple-800 hover:bg-purple-200',
                                    event.driversUnfilled > 0 && !event.speakersUnfilled && 'bg-blue-100 text-blue-800 hover:bg-blue-200'
                                  )}
                                  onClick={() => handleSignupClick(event.id)}
                                >
                                  {event.organizationName}
                                </button>
                              </TooltipTrigger>
                              <TooltipContent side="right" className="max-w-xs">
                                <p className="font-medium">{event.organizationName}</p>
                                {event.eventStartTime && <p className="text-xs">{event.eventStartTime}</p>}
                                <div className="flex gap-1 mt-1">
                                  {event.speakersUnfilled > 0 && (
                                    <Badge variant="secondary" className="text-[10px]">
                                      <Mic className="w-2.5 h-2.5 mr-0.5" />{event.speakersUnfilled}
                                    </Badge>
                                  )}
                                  {event.volunteersUnfilled > 0 && (
                                    <Badge variant="secondary" className="text-[10px]">
                                      <UserCheck className="w-2.5 h-2.5 mr-0.5" />{event.volunteersUnfilled}
                                    </Badge>
                                  )}
                                  {event.driversUnfilled > 0 && (
                                    <Badge variant="secondary" className="text-[10px]">
                                      <Car className="w-2.5 h-2.5 mr-0.5" />{event.driversUnfilled}
                                    </Badge>
                                  )}
                                </div>
                              </TooltipContent>
                            </Tooltip>
                          ))}
                          {dayEvents.length > 3 && (
                            <div className="text-xs text-muted-foreground text-center">
                              +{dayEvents.length - 3} more
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Legend */}
                <div className="flex flex-wrap gap-4 mt-4 text-sm">
                  <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 rounded bg-purple-200" />
                    <span>Speaker Needed</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 rounded bg-green-200" />
                    <span>Volunteer Needed</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 rounded bg-blue-200" />
                    <span>Driver Needed</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Map View */}
          <TabsContent value="map" className="mt-0">
            <Card>
              <CardContent className="p-0">
                <div className="h-[600px] rounded-lg overflow-hidden">
                  <MapContainer
                    center={mapCenter}
                    zoom={10}
                    style={{ height: '100%', width: '100%' }}
                  >
                    <TileLayer
                      attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                      url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    />
                    <MapCenterSetter center={mapCenter} />

                    {filteredEvents
                      .filter(e => e.latitude && e.longitude)
                      .map(event => (
                        <Marker
                          key={event.id}
                          position={[parseFloat(event.latitude!), parseFloat(event.longitude!)]}
                          icon={createEventIcon(
                            event.speakersUnfilled > 0,
                            event.volunteersUnfilled > 0,
                            event.driversUnfilled > 0
                          )}
                        >
                          <Popup>
                            <div className="min-w-[200px] space-y-2">
                              <h3 className="font-semibold">{event.organizationName}</h3>
                              {event.scheduledEventDate && (
                                <p className="text-sm text-muted-foreground">
                                  {format(parseISO(event.scheduledEventDate), 'MMM d, yyyy')}
                                  {event.eventStartTime && ` at ${event.eventStartTime}`}
                                </p>
                              )}
                              <p className="text-sm">{event.eventAddress}</p>

                              <div className="flex flex-wrap gap-1">
                                {event.speakersUnfilled > 0 && (
                                  <Badge className="bg-purple-600 text-white text-xs">
                                    <Mic className="w-3 h-3 mr-1" />{event.speakersUnfilled}
                                  </Badge>
                                )}
                                {event.volunteersUnfilled > 0 && (
                                  <Badge className="bg-green-600 text-white text-xs">
                                    <UserCheck className="w-3 h-3 mr-1" />{event.volunteersUnfilled}
                                  </Badge>
                                )}
                                {event.driversUnfilled > 0 && (
                                  <Badge className="bg-blue-600 text-white text-xs">
                                    <Car className="w-3 h-3 mr-1" />{event.driversUnfilled}
                                  </Badge>
                                )}
                              </div>

                              <Button
                                size="sm"
                                className="w-full mt-2"
                                onClick={() => handleSignupClick(event.id)}
                              >
                                <HandHeart className="w-3 h-3 mr-1" />
                                Volunteer
                              </Button>
                            </div>
                          </Popup>
                        </Marker>
                      ))}
                  </MapContainer>
                </div>

                {/* Map Legend */}
                <div className="p-4 border-t flex flex-wrap gap-4 text-sm">
                  <div className="flex items-center gap-1.5">
                    <div className="w-4 h-4 rounded-full bg-purple-500" />
                    <span>Speaker Needed</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-4 h-4 rounded-full bg-green-500" />
                    <span>Volunteer Needed</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-4 h-4 rounded-full bg-blue-500" />
                    <span>Driver Needed</span>
                  </div>
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
                    existingSignup={getExistingSignup(event.id)}
                  />
                ))
              )}
            </div>
          </TabsContent>
        </Tabs>

        {/* My Signups Section */}
        {mySignups.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <UserCheck className="w-5 h-5" />
                My Volunteer Signups
              </CardTitle>
              <CardDescription>
                Events you've signed up to help with
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {mySignups.map(signup => (
                  <div
                    key={signup.id}
                    className="flex items-center justify-between p-3 rounded-lg border"
                  >
                    <div className="flex items-center gap-4">
                      <div>
                        <p className="font-medium">{signup.event.organizationName}</p>
                        <p className="text-sm text-muted-foreground">
                          {signup.event.scheduledEventDate
                            ? format(parseISO(signup.event.scheduledEventDate), 'MMM d, yyyy')
                            : 'Date TBD'}
                          {signup.event.eventStartTime && ` at ${signup.event.eventStartTime}`}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <RoleBadge role={signup.role} />
                      <StatusBadge status={signup.status} />
                      {signup.status === 'pending' && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => cancelSignupMutation.mutate(signup.id)}
                          disabled={cancelSignupMutation.isPending}
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Signup Dialog */}
        <SignupDialog
          event={selectedEvent}
          open={signupDialogOpen}
          onOpenChange={setSignupDialogOpen}
          onSubmit={handleSignupSubmit}
          isSubmitting={signupMutation.isPending}
        />
      </div>
    </TooltipProvider>
  );
}
