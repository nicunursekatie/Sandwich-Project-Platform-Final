/**
 * Driver Hub
 *
 * A focused interface for drivers to browse events that need drivers
 * and sign up to drive. Reuses the volunteer-hub API endpoints
 * with client-side filtering for driver-specific needs.
 */

import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format, parseISO, isAfter, startOfDay } from 'date-fns';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { formatTimeForDisplay } from '@/lib/date-utils';

// UI Components
import { Card, CardContent } from '@/components/ui/card';
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
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';

// Icons
import {
  Calendar,
  MapPin,
  Clock,
  Car,
  Truck,
  Check,
  X,
  Loader2,
  Sandwich,
  Search,
  Package,
  AlertCircle,
} from 'lucide-react';

// Types — same shape as volunteer hub
interface AvailableEvent {
  id: number;
  organizationName: string;
  organizationCategory: string | null;
  department: string | null;
  eventAddress: string;
  city: string | null;
  state: string | null;
  latitude: string | null;
  longitude: string | null;
  scheduledEventDate: string | null;
  desiredEventDate: string | null;
  eventStartTime: string | null;
  eventEndTime: string | null;
  estimatedSandwichCount: number | null;
  status: string | null;
  driversNeeded: number;
  driversAssigned: number;
  driversUnfilled: number;
  speakersNeeded: number;
  speakersAssigned: number;
  speakersUnfilled: number;
  volunteersNeeded: number;
  volunteersAssigned: number;
  volunteersUnfilled: number;
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

// Status badge
function StatusBadge({ status }: { status: string }) {
  const config = {
    pending: { label: 'Pending Approval', className: 'bg-[#fbad3f]/20 text-[#d4910e] border-[#fbad3f]/40 font-medium' },
    confirmed: { label: 'Confirmed', className: 'bg-green-100 text-green-700 border-green-300 font-medium' },
    declined: { label: 'Declined', className: 'bg-[#a31c41]/15 text-[#a31c41] border-[#a31c41]/30' },
    assigned: { label: 'Assigned', className: 'bg-[#47b3cb]/20 text-[#236383] border-[#47b3cb]/40 font-medium' },
  }[status] || { label: status, className: 'bg-gray-100 text-gray-800 border-gray-200' };

  return <Badge variant="outline" className={config.className}>{config.label}</Badge>;
}

// Driver event card — focused on driver-relevant information
function DriverEventCard({
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

  const vanDriverAssigned = false; // We don't have this info from the API yet
  const needsVanDriver = event.vanDriverNeeded;

  return (
    <Card className="hover:shadow-lg transition-all border-l-4 border-l-[#236383]">
      <CardContent className="p-4 space-y-3">
        {/* Organization name */}
        <div>
          <h3 className="font-semibold text-base text-[#236383]">{event.organizationName}</h3>
          {event.department && (
            <p className="text-sm text-muted-foreground">{event.department}</p>
          )}
        </div>

        {/* Date & Time */}
        <div className="flex items-center gap-2 text-sm">
          <Calendar className="w-4 h-4 shrink-0 text-[#236383]" />
          <span className="font-medium">
            {formattedDate}
            {event.eventStartTime && (
              <span className="font-normal text-muted-foreground">
                {' '}at {formatTimeForDisplay(event.eventStartTime)}
                {event.eventEndTime && ` – ${formatTimeForDisplay(event.eventEndTime)}`}
              </span>
            )}
          </span>
        </div>

        {/* Location */}
        {event.eventAddress && (
          <div className="flex items-start gap-2 text-sm text-muted-foreground">
            <MapPin className="w-4 h-4 shrink-0 mt-0.5 text-[#236383]" />
            <span>{event.eventAddress}{event.city && `, ${event.city}`}</span>
          </div>
        )}

        {/* Driver-specific details row */}
        <div className="flex flex-wrap gap-2">
          {/* Pickup time */}
          {event.pickupTime && (
            <Badge variant="outline" className="bg-amber-50 text-amber-800 border-amber-200 gap-1">
              <Clock className="w-3 h-3" />
              Pickup: {formatTimeForDisplay(event.pickupTime)}
            </Badge>
          )}

          {/* Sandwich count */}
          {event.estimatedSandwichCount && event.estimatedSandwichCount > 0 && (
            <Badge variant="outline" className="bg-gray-50 text-gray-700 border-gray-200 gap-1">
              <Package className="w-3 h-3" />
              ~{event.estimatedSandwichCount} sandwiches
            </Badge>
          )}

          {/* Van needed */}
          {needsVanDriver && (
            <Badge variant="outline" className="bg-[#fbad3f]/10 text-[#d4910e] border-[#fbad3f]/30 gap-1 font-medium">
              <Truck className="w-3 h-3" />
              Van Driver Needed
            </Badge>
          )}
        </div>

        {/* Driver openings */}
        <div className="flex items-center gap-2">
          {event.driversUnfilled > 0 ? (
            <Badge variant="outline" className="bg-[#236383]/10 text-[#236383] border-[#236383]/30 gap-1">
              <Car className="w-3 h-3" />
              {event.driversUnfilled} driver{event.driversUnfilled !== 1 ? 's' : ''} needed
              {event.driversAssigned > 0 && (
                <span className="text-muted-foreground font-normal ml-1">
                  ({event.driversAssigned}/{event.driversNeeded} filled)
                </span>
              )}
            </Badge>
          ) : (
            <Badge variant="outline" className="bg-green-100 text-green-700 border-green-300 gap-1">
              <Check className="w-3 h-3" />
              Drivers filled — extra help still welcome
            </Badge>
          )}
        </div>

        {/* Action */}
        <div className="pt-2">
          {existingSignup ? (
            <div className="flex items-center justify-between p-2.5 rounded-lg bg-gradient-to-r from-[#236383]/10 to-[#47b3cb]/10 border border-[#236383]/20">
              <div className="flex items-center gap-2">
                <div className="bg-[#236383] rounded-full p-0.5">
                  <Check className="w-3 h-3 text-white" />
                </div>
                <span className="text-sm font-medium text-[#236383]">
                  Signed up to drive
                </span>
              </div>
              <StatusBadge status={existingSignup.status} />
            </div>
          ) : (
            <Button
              className="w-full bg-gradient-to-r from-[#236383] to-[#47b3cb] hover:from-[#1e5a75] hover:to-[#236383] text-white h-10 shadow-sm"
              onClick={() => onSignup(event.id)}
            >
              <Car className="w-4 h-4 mr-2" />
              Sign Up to Drive
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// Main component
export default function DriverHub() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState('available');
  const [searchTerm, setSearchTerm] = useState('');
  const [signupDialogOpen, setSignupDialogOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<AvailableEvent | null>(null);
  const [signupNotes, setSignupNotes] = useState('');

  // Fetch available events (same endpoint as volunteer hub)
  const { data: allEvents = [], isLoading: eventsLoading } = useQuery<AvailableEvent[]>({
    queryKey: ['/api/volunteer-hub/available-events', true],
    queryFn: async () => {
      const response = await fetch('/api/volunteer-hub/available-events?needsOnly=false', {
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to fetch events');
      return response.json();
    },
  });

  // Fetch user's signups (filter to driver role client-side)
  const { data: allSignups = [], isLoading: signupsLoading } = useQuery<MySignup[]>({
    queryKey: ['/api/volunteer-hub/my-signups'],
    queryFn: async () => {
      const response = await fetch('/api/volunteer-hub/my-signups', {
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to fetch signups');
      return response.json();
    },
  });

  const myDriverSignups = useMemo(
    () => allSignups.filter((s) => s.role === 'driver'),
    [allSignups]
  );

  // Signup mutation — hardcoded to driver role
  const signupMutation = useMutation({
    mutationFn: async ({ eventId, notes }: { eventId: number; notes: string }) => {
      const response = await fetch(`/api/volunteer-hub/signup/${eventId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roles: ['driver'], notes }),
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
        title: 'Driver Signup Submitted!',
        description: data.message || 'Your request to drive has been submitted for coordinator approval.',
      });
      setSignupDialogOpen(false);
      setSelectedEvent(null);
      setSignupNotes('');
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
        description: 'Your driver signup has been cancelled.',
      });
      queryClient.invalidateQueries({ queryKey: ['/api/volunteer-hub/my-signups'] });
      queryClient.invalidateQueries({ queryKey: ['/api/volunteer-hub/available-events'] });
    },
    onError: (error: Error) => {
      toast({
        title: 'Cancel Failed',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Filter events to those needing drivers, exclude self-transport
  const driverEvents = useMemo(() => {
    const today = startOfDay(new Date());
    const normalizedSearch = searchTerm.trim().toLowerCase();

    return allEvents
      .filter((event) => {
        // Exclude self-transport events
        if (event.selfTransport) return false;

        // Must need at least one driver or van driver
        const needsDrivers = event.driversUnfilled > 0 || event.vanDriverNeeded;
        if (!needsDrivers) return false;

        // Must be in the future
        const eventDate = event.scheduledEventDate || event.desiredEventDate;
        if (eventDate && !isAfter(parseISO(eventDate), today)) return false;

        // Search filter
        if (normalizedSearch) {
          const searchable = [
            event.organizationName,
            event.department || '',
            event.eventAddress || '',
            event.city || '',
          ].join(' ').toLowerCase();
          if (!searchable.includes(normalizedSearch)) return false;
        }

        return true;
      })
      .sort((a, b) => {
        const dateA = a.scheduledEventDate || a.desiredEventDate || '';
        const dateB = b.scheduledEventDate || b.desiredEventDate || '';
        return dateA.localeCompare(dateB);
      });
  }, [allEvents, searchTerm]);

  // Build signup map for quick lookup
  const signupByEventId = useMemo(() => {
    const map = new Map<number, MySignup>();
    myDriverSignups.forEach((s) => map.set(s.eventRequestId, s));
    return map;
  }, [myDriverSignups]);

  // Stats
  const totalOpenings = driverEvents.reduce((sum, e) => sum + e.driversUnfilled, 0);
  const vanNeededCount = driverEvents.filter((e) => e.vanDriverNeeded).length;
  const myActiveSignups = myDriverSignups.filter((s) => s.status !== 'declined').length;

  const handleSignupClick = (eventId: number) => {
    const event = allEvents.find((e) => e.id === eventId);
    if (event) {
      setSelectedEvent(event);
      setSignupNotes('');
      setSignupDialogOpen(true);
    }
  };

  const handleSignupSubmit = () => {
    if (!selectedEvent) return;
    signupMutation.mutate({ eventId: selectedEvent.id, notes: signupNotes });
  };

  if (eventsLoading) {
    return (
      <div className="space-y-4 p-4">
        <Skeleton className="h-32 w-full" />
        <div className="grid gap-4 md:grid-cols-2">
          <Skeleton className="h-48" />
          <Skeleton className="h-48" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-[#236383] to-[#47b3cb] rounded-xl p-6 text-white shadow-lg">
        <div className="flex items-center gap-3 mb-2">
          <Car className="w-8 h-8" />
          <h1 className="text-2xl font-bold">Driver Hub</h1>
        </div>
        <p className="text-white/80 text-sm">
          Browse upcoming events that need drivers and sign up to help with deliveries.
        </p>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
          <div className="bg-white/15 rounded-lg p-3 text-center">
            <div className="text-2xl font-bold">{driverEvents.length}</div>
            <div className="text-xs text-white/70">Events Need Drivers</div>
          </div>
          <div className="bg-white/15 rounded-lg p-3 text-center">
            <div className="text-2xl font-bold">{totalOpenings}</div>
            <div className="text-xs text-white/70">Driver Openings</div>
          </div>
          <div className="bg-white/15 rounded-lg p-3 text-center">
            <div className="text-2xl font-bold">{vanNeededCount}</div>
            <div className="text-xs text-white/70">Need Van Drivers</div>
          </div>
          <div className="bg-white/15 rounded-lg p-3 text-center">
            <div className="text-2xl font-bold">{myActiveSignups}</div>
            <div className="text-xs text-white/70">My Commitments</div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <TabsList>
            <TabsTrigger value="available" className="gap-1.5">
              <Car className="w-4 h-4" />
              Available Events
              {driverEvents.length > 0 && (
                <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">
                  {driverEvents.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="my-signups" className="gap-1.5">
              <Check className="w-4 h-4" />
              My Signups
              {myActiveSignups > 0 && (
                <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">
                  {myActiveSignups}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          {activeTab === 'available' && (
            <div className="relative w-full max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search events..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 h-9"
              />
            </div>
          )}
        </div>

        {/* Available Events */}
        <TabsContent value="available" className="mt-4">
          {driverEvents.length === 0 ? (
            <Card className="p-12 text-center">
              <Car className="w-12 h-12 mx-auto mb-3 text-muted-foreground/30" />
              <h3 className="font-medium text-muted-foreground mb-1">No events need drivers right now</h3>
              <p className="text-sm text-muted-foreground/70">
                Check back soon — new events are added regularly.
              </p>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3">
              {driverEvents.map((event) => (
                <DriverEventCard
                  key={event.id}
                  event={event}
                  onSignup={handleSignupClick}
                  existingSignup={signupByEventId.get(event.id)}
                />
              ))}
            </div>
          )}
        </TabsContent>

        {/* My Signups */}
        <TabsContent value="my-signups" className="mt-4">
          {signupsLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-24" />
              <Skeleton className="h-24" />
            </div>
          ) : myDriverSignups.length === 0 ? (
            <Card className="p-12 text-center">
              <Car className="w-12 h-12 mx-auto mb-3 text-muted-foreground/30" />
              <h3 className="font-medium text-muted-foreground mb-1">No driver signups yet</h3>
              <p className="text-sm text-muted-foreground/70">
                Browse available events and sign up to drive!
              </p>
              <Button
                variant="outline"
                className="mt-4"
                onClick={() => setActiveTab('available')}
              >
                Browse Events
              </Button>
            </Card>
          ) : (
            <div className="space-y-3">
              {myDriverSignups.map((signup) => {
                const eventDate = signup.event.scheduledEventDate || signup.event.desiredEventDate;
                const isPast = eventDate && !isAfter(parseISO(eventDate), startOfDay(new Date()));

                return (
                  <Card key={signup.id} className={`${isPast ? 'opacity-60' : ''}`}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="space-y-1">
                          <h3 className="font-semibold text-[#236383]">
                            {signup.event.organizationName}
                          </h3>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Calendar className="w-3.5 h-3.5" />
                            <span>
                              {eventDate
                                ? format(parseISO(eventDate), 'EEE, MMM d, yyyy')
                                : 'Date TBD'}
                              {signup.event.eventStartTime && (
                                <span>
                                  {' '}at {formatTimeForDisplay(signup.event.eventStartTime)}
                                </span>
                              )}
                            </span>
                          </div>
                          {signup.event.eventAddress && (
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <MapPin className="w-3.5 h-3.5" />
                              <span>{signup.event.eventAddress}</span>
                            </div>
                          )}
                          {signup.notes && (
                            <p className="text-xs text-muted-foreground mt-1 italic">
                              Note: {signup.notes}
                            </p>
                          )}
                        </div>
                        <div className="flex flex-col items-end gap-2">
                          <StatusBadge status={signup.status} />
                          {signup.status === 'pending' && !isPast && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-red-600 hover:text-red-700 hover:bg-red-50 h-7 text-xs"
                              onClick={() => cancelSignupMutation.mutate(signup.id)}
                              disabled={cancelSignupMutation.isPending}
                            >
                              {cancelSignupMutation.isPending ? (
                                <Loader2 className="w-3 h-3 animate-spin mr-1" />
                              ) : (
                                <X className="w-3 h-3 mr-1" />
                              )}
                              Cancel
                            </Button>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Signup Dialog — simplified, driver-only */}
      <Dialog open={signupDialogOpen} onOpenChange={setSignupDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Car className="w-5 h-5 text-[#236383]" />
              Sign Up to Drive
            </DialogTitle>
            {selectedEvent && (
              <DialogDescription>
                <strong>{selectedEvent.organizationName}</strong>
                {selectedEvent.department && ` — ${selectedEvent.department}`}
                <br />
                {selectedEvent.scheduledEventDate && (
                  <span>
                    {format(parseISO(selectedEvent.scheduledEventDate), 'EEEE, MMMM d, yyyy')}
                    {selectedEvent.eventStartTime && ` at ${formatTimeForDisplay(selectedEvent.eventStartTime)}`}
                  </span>
                )}
              </DialogDescription>
            )}
          </DialogHeader>

          {selectedEvent && (
            <div className="space-y-4">
              {/* Driver-relevant info summary */}
              <div className="bg-gray-50 rounded-lg p-3 space-y-1.5 text-sm">
                {selectedEvent.eventAddress && (
                  <div className="flex items-start gap-2">
                    <MapPin className="w-3.5 h-3.5 mt-0.5 text-muted-foreground" />
                    <span>{selectedEvent.eventAddress}</span>
                  </div>
                )}
                {selectedEvent.pickupTime && (
                  <div className="flex items-center gap-2">
                    <Clock className="w-3.5 h-3.5 text-muted-foreground" />
                    <span>Pickup: {formatTimeForDisplay(selectedEvent.pickupTime)}</span>
                  </div>
                )}
                {selectedEvent.estimatedSandwichCount && selectedEvent.estimatedSandwichCount > 0 && (
                  <div className="flex items-center gap-2">
                    <Package className="w-3.5 h-3.5 text-muted-foreground" />
                    <span>~{selectedEvent.estimatedSandwichCount} sandwiches</span>
                  </div>
                )}
                {selectedEvent.vanDriverNeeded && (
                  <div className="flex items-center gap-2 text-amber-700">
                    <Truck className="w-3.5 h-3.5" />
                    <span className="font-medium">Van driver needed for this event</span>
                  </div>
                )}
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-800">
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  <span>
                    Your signup will be submitted as <strong>tentative</strong> and a coordinator will confirm your assignment.
                  </span>
                </div>
              </div>

              <div>
                <Label htmlFor="signup-notes" className="text-sm font-medium">
                  Notes (optional)
                </Label>
                <Textarea
                  id="signup-notes"
                  placeholder="Any details — e.g., vehicle type, time constraints, van availability..."
                  value={signupNotes}
                  onChange={(e) => setSignupNotes(e.target.value)}
                  rows={3}
                  className="mt-1.5"
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setSignupDialogOpen(false)}
              disabled={signupMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSignupSubmit}
              disabled={signupMutation.isPending}
              className="bg-[#236383] hover:bg-[#1e5a75] text-white"
            >
              {signupMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Submitting...
                </>
              ) : (
                <>
                  <Car className="w-4 h-4 mr-2" />
                  Sign Up to Drive
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
