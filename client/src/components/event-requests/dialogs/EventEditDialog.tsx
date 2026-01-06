import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import {
  Clock,
  Users,
  Megaphone,
  Car,
  Truck,
  Save,
  Loader2,
  X,
  UserPlus,
  Search,
  Building,
  User,
  Package,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, invalidateEventRequestQueries } from '@/lib/queryClient';
import { logger } from '@/lib/logger';
import { getDriverIds, getSpeakerIds, getVolunteerIds } from '@/lib/assignment-utils';
import type { EventRequest } from '@shared/schema';

interface EventEditDialogProps {
  isOpen: boolean;
  onClose: () => void;
  event: EventRequest | null;
  onSaved?: () => void;
}

// Helper function to format time for input
const formatTimeForInput = (time: string | null | undefined): string => {
  if (!time) return '';
  // Already in HH:mm format
  if (/^\d{2}:\d{2}$/.test(time)) return time;
  // Has seconds
  if (/^\d{2}:\d{2}:\d{2}$/.test(time)) return time.slice(0, 5);
  return time;
};

// Helper to parse PostgreSQL array format
const parsePostgresArray = (value: any): string[] => {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') {
    if (value === '{}' || value === '') return [];
    const cleaned = value.replace(/^{|}$/g, '');
    if (!cleaned) return [];
    if (cleaned.includes('"')) {
      const matches = cleaned.match(/"[^"]*"|[^",]+/g);
      return matches ? matches.map(item => item.replace(/"/g, '').trim()).filter(Boolean) : [];
    }
    return cleaned.split(',').map(item => item.trim()).filter(Boolean);
  }
  return [];
};

// Person selector component for assignments
interface PersonSelectorProps {
  selectedPeople: string[];
  onSelectionChange: (selected: string[]) => void;
  assignmentType: 'driver' | 'speaker' | 'volunteer';
  vanDriverNeeded?: boolean;
}

function PersonSelector({
  selectedPeople,
  onSelectionChange,
  assignmentType,
  vanDriverNeeded = false,
}: PersonSelectorProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [customEntryText, setCustomEntryText] = useState('');
  const [showCustomEntry, setShowCustomEntry] = useState(false);

  // Fetch users for assignments
  const { data: users = [] } = useQuery<any[]>({
    queryKey: ['/api/users/for-assignments'],
  });

  const { data: drivers = [] } = useQuery<any[]>({
    queryKey: ['/api/drivers'],
  });

  const { data: volunteers = [] } = useQuery<any[]>({
    queryKey: ['/api/volunteers'],
  });

  // Build list of available people based on assignment type
  const availablePeople = useMemo(() => {
    const people: Array<{ id: string; name: string; type: string; details?: string }> = [];

    // Add users (team members)
    users.forEach((user: any) => {
      people.push({
        id: user.id,
        name: user.displayName || `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email || user.id,
        type: 'user',
        details: user.email,
      });
    });

    // Add drivers (for driver assignments)
    if (assignmentType === 'driver') {
      drivers.forEach((driver: any) => {
        // Filter for van-approved AND willing to drive van if needed
        if (vanDriverNeeded && (!driver.vanApproved || !driver.interestedInVanDriving)) return;

        people.push({
          id: `driver-${driver.id}`,
          name: driver.name || `Driver #${driver.id}`,
          type: 'driver',
          details: driver.vanApproved ? 'Van Approved' : undefined,
        });
      });
    }

    // Add volunteers (for volunteer/speaker assignments)
    if (assignmentType === 'volunteer' || assignmentType === 'speaker') {
      volunteers.forEach((vol: any) => {
        people.push({
          id: `volunteer-${vol.id}`,
          name: vol.name || `${vol.firstName || ''} ${vol.lastName || ''}`.trim() || `Volunteer #${vol.id}`,
          type: 'volunteer',
        });
      });
    }

    return people;
  }, [users, drivers, volunteers, assignmentType, vanDriverNeeded]);

  // Filter by search term
  const filteredPeople = useMemo(() => {
    if (!searchTerm) return availablePeople;
    const lower = searchTerm.toLowerCase();
    return availablePeople.filter(
      p => p.name.toLowerCase().includes(lower) || p.details?.toLowerCase().includes(lower)
    );
  }, [availablePeople, searchTerm]);

  const togglePerson = (personId: string) => {
    if (selectedPeople.includes(personId)) {
      onSelectionChange(selectedPeople.filter(id => id !== personId));
    } else {
      onSelectionChange([...selectedPeople, personId]);
    }
  };

  const handleAddCustomEntry = () => {
    if (!customEntryText.trim()) return;
    const customId = `custom-${Date.now()}-${customEntryText.trim().replace(/\s+/g, '-')}`;
    onSelectionChange([...selectedPeople, customId]);
    setCustomEntryText('');
    setShowCustomEntry(false);
  };

  const getDisplayName = (personId: string): string => {
    if (personId.startsWith('custom-')) {
      const parts = personId.split('-');
      return parts.slice(2).join(' ').replace(/-/g, ' ') || personId;
    }
    const person = availablePeople.find(p => p.id === personId);
    return person?.name || personId;
  };

  const removePerson = (personId: string) => {
    onSelectionChange(selectedPeople.filter(id => id !== personId));
  };

  return (
    <div className="space-y-3">
      {/* Selected people */}
      {selectedPeople.length > 0 && (
        <div className="flex flex-wrap gap-2 p-2 bg-gray-50 rounded-lg">
          {selectedPeople.map(personId => (
            <Badge key={personId} variant="secondary" className="flex items-center gap-1">
              {getDisplayName(personId)}
              <button
                type="button"
                onClick={() => removePerson(personId)}
                className="ml-1 hover:bg-gray-200 rounded-full p-0.5"
              >
                <X className="w-3 h-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <Input
          placeholder="Search people..."
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Custom entry */}
      {!showCustomEntry ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setShowCustomEntry(true)}
          className="w-full"
        >
          <UserPlus className="w-4 h-4 mr-2" />
          Add Custom Entry
        </Button>
      ) : (
        <div className="flex gap-2">
          <Input
            placeholder="Enter name..."
            value={customEntryText}
            onChange={e => setCustomEntryText(e.target.value)}
            onKeyPress={e => e.key === 'Enter' && handleAddCustomEntry()}
            autoFocus
          />
          <Button size="sm" onClick={handleAddCustomEntry} disabled={!customEntryText.trim()}>
            Add
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setShowCustomEntry(false);
              setCustomEntryText('');
            }}
          >
            Cancel
          </Button>
        </div>
      )}

      {/* People list - using max-height with overflow instead of ScrollArea to allow parent scroll */}
      <div className="max-h-48 overflow-y-auto border rounded-lg">
        <div className="p-2 space-y-1">
          {filteredPeople.map(person => {
            const isSelected = selectedPeople.includes(person.id);
            return (
              <button
                key={person.id}
                type="button"
                onClick={() => togglePerson(person.id)}
                className={`w-full text-left p-2 rounded-md flex items-center gap-2 transition-colors ${
                  isSelected ? 'bg-blue-50 border border-blue-200' : 'hover:bg-gray-50'
                }`}
              >
                {person.type === 'user' && <User className="w-4 h-4 text-gray-500" />}
                {person.type === 'driver' && <Car className="w-4 h-4 text-blue-500" />}
                {person.type === 'volunteer' && <Users className="w-4 h-4 text-amber-500" />}
                <div className="flex-1">
                  <div className="text-sm font-medium">{person.name}</div>
                  {person.details && (
                    <div className="text-xs text-gray-500">{person.details}</div>
                  )}
                </div>
                {isSelected && <Badge variant="secondary" className="text-xs">Selected</Badge>}
              </button>
            );
          })}
          {filteredPeople.length === 0 && (
            <div className="text-center text-gray-500 py-4 text-sm">
              No matches found
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export const EventEditDialog: React.FC<EventEditDialogProps> = ({
  isOpen,
  onClose,
  event,
  onSaved,
}) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Form state for logistics
  const [driversNeeded, setDriversNeeded] = useState('');
  const [speakersNeeded, setSpeakersNeeded] = useState('');
  const [volunteersNeeded, setVolunteersNeeded] = useState('');
  const [pickupTime, setPickupTime] = useState('');
  const [eventStartTime, setEventStartTime] = useState('');
  const [eventEndTime, setEventEndTime] = useState('');
  const [pickupTimeWindow, setPickupTimeWindow] = useState('');
  const [tspContact, setTspContact] = useState('');
  const [customTspContact, setCustomTspContact] = useState('');
  const [vanDriverNeeded, setVanDriverNeeded] = useState(false);

  // Staffing assignments
  const [assignedDriverIds, setAssignedDriverIds] = useState<string[]>([]);
  const [assignedSpeakerIds, setAssignedSpeakerIds] = useState<string[]>([]);
  const [assignedVolunteerIds, setAssignedVolunteerIds] = useState<string[]>([]);
  const [assignedVanDriverId, setAssignedVanDriverId] = useState<string | null>(null);

  // Fetch users for TSP contact dropdown
  const { data: usersBasic = [] } = useQuery<any[]>({
    queryKey: ['/api/users/basic'],
  });

  // Populate form when event changes
  useEffect(() => {
    if (event) {
      setDriversNeeded(event.driversNeeded?.toString() || '');
      setSpeakersNeeded(event.speakersNeeded?.toString() || '');
      setVolunteersNeeded(event.volunteersNeeded?.toString() || '');
      setPickupTime(formatTimeForInput(event.pickupTime));
      setEventStartTime(formatTimeForInput(event.eventStartTime));
      setEventEndTime(formatTimeForInput(event.eventEndTime));
      setPickupTimeWindow(event.pickupTimeWindow || '');
      setTspContact(event.tspContact || '');
      setCustomTspContact(event.customTspContact || '');
      setVanDriverNeeded(event.vanDriverNeeded || false);
      setAssignedDriverIds(getDriverIds(event));
      setAssignedSpeakerIds(getSpeakerIds(event));
      setAssignedVolunteerIds(getVolunteerIds(event));
      setAssignedVanDriverId(event.assignedVanDriverId || null);
    }
  }, [event]);

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: async (data: any) => {
      if (!event) throw new Error('No event selected');
      logger.log('Updating event:', event.id, data);
      return apiRequest('PATCH', `/api/event-requests/${event.id}`, data);
    },
    onSuccess: () => {
      // Invalidate all event request queries to refresh UI
      invalidateEventRequestQueries(queryClient);
      toast({
        title: 'Event updated',
        description: 'Your changes have been saved.',
      });
      onSaved?.();
      onClose();
    },
    onError: (error) => {
      logger.error('Failed to update event:', error);
      toast({
        title: 'Update failed',
        description: 'There was an error saving your changes.',
        variant: 'destructive',
      });
    },
  });

  const handleSave = () => {
    const updates: any = {};
    console.log('[EventEditDialog] handleSave called');
    console.log('[EventEditDialog] Current state - tspContact:', tspContact, ', customTspContact:', customTspContact);
    console.log('[EventEditDialog] Original event - tspContact:', event?.tspContact, ', customTspContact:', event?.customTspContact);
    console.log('[EventEditDialog] vanDriverNeeded state:', vanDriverNeeded, 'event.vanDriverNeeded:', event?.vanDriverNeeded);

    // Logistics
    if (driversNeeded !== (event?.driversNeeded?.toString() || '')) {
      updates.driversNeeded = driversNeeded ? parseInt(driversNeeded) : null;
    }
    if (speakersNeeded !== (event?.speakersNeeded?.toString() || '')) {
      updates.speakersNeeded = speakersNeeded ? parseInt(speakersNeeded) : null;
    }
    if (volunteersNeeded !== (event?.volunteersNeeded?.toString() || '')) {
      updates.volunteersNeeded = volunteersNeeded ? parseInt(volunteersNeeded) : null;
    }
    if (pickupTime !== formatTimeForInput(event?.pickupTime)) {
      updates.pickupTime = pickupTime || null;
    }
    if (eventStartTime !== formatTimeForInput(event?.eventStartTime)) {
      updates.eventStartTime = eventStartTime || null;
    }
    if (eventEndTime !== formatTimeForInput(event?.eventEndTime)) {
      updates.eventEndTime = eventEndTime || null;
    }
    if (pickupTimeWindow !== (event?.pickupTimeWindow || '')) {
      updates.pickupTimeWindow = pickupTimeWindow || null;
    }
    console.log('[EventEditDialog] vanDriverNeeded comparison:', vanDriverNeeded, '!==', (event?.vanDriverNeeded || false), '=', vanDriverNeeded !== (event?.vanDriverNeeded || false));
    if (vanDriverNeeded !== (event?.vanDriverNeeded || false)) {
      console.log('[EventEditDialog] Adding vanDriverNeeded to updates:', vanDriverNeeded);
      updates.vanDriverNeeded = vanDriverNeeded;
    }

    // TSP Contact
    const currentTspContact = event?.tspContact || '';
    const currentCustomTspContact = event?.customTspContact || '';
    console.log('[EventEditDialog] TSP comparison - tspContact:', JSON.stringify(tspContact), 'currentTspContact:', JSON.stringify(currentTspContact), 'areEqual:', tspContact === currentTspContact);

    const tspContactChanged = tspContact !== currentTspContact;
    const customTspContactChanged = customTspContact !== currentCustomTspContact;

    if (tspContactChanged) {
      if (tspContact === 'custom') {
        updates.tspContact = null;
        console.log('[EventEditDialog] Setting updates.tspContact to null (custom mode)');
      } else {
        updates.tspContact = tspContact || null;
        console.log('[EventEditDialog] Setting updates.tspContact to:', JSON.stringify(updates.tspContact));
      }
    }
    if (customTspContactChanged) {
      updates.customTspContact = customTspContact || null;
      console.log('[EventEditDialog] Setting updates.customTspContact to:', JSON.stringify(updates.customTspContact));
    }

    // Set tspContactAssignedDate when TSP contact is being assigned/changed
    if (tspContactChanged || customTspContactChanged) {
      const hasNewTspContact = (tspContact && tspContact !== 'custom' && tspContact !== 'none') || customTspContact;
      if (hasNewTspContact) {
        updates.tspContactAssignedDate = new Date().toISOString();
        console.log('[EventEditDialog] Setting tspContactAssignedDate:', updates.tspContactAssignedDate);
      } else {
        // Clearing TSP contact - also clear the date
        updates.tspContactAssignedDate = null;
        console.log('[EventEditDialog] Clearing tspContactAssignedDate');
      }
    }

    // Staffing assignments
    const originalDriverIds = event ? getDriverIds(event) : [];
    if (JSON.stringify(assignedDriverIds.sort()) !== JSON.stringify(originalDriverIds.sort())) {
      updates.assignedDriverIds = assignedDriverIds;
      // Also update driverDetails JSONB to keep it in sync (source of truth)
      const driverDetailsObj = (event?.driverDetails || {}) as Record<string, { name?: string }>;
      const newDriverDetails: Record<string, { name?: string }> = {};
      assignedDriverIds.forEach(id => {
        newDriverDetails[id] = driverDetailsObj[id] || {};
      });
      updates.driverDetails = newDriverDetails;
    }

    const speakerDetailsObj = (event?.speakerDetails || {}) as Record<string, { name?: string }>;
    const originalSpeakerIds = event ? getSpeakerIds(event) : [];
    if (JSON.stringify(assignedSpeakerIds.sort()) !== JSON.stringify(originalSpeakerIds.sort())) {
      // Build speakerDetails object
      const newSpeakerDetails: Record<string, { name?: string }> = {};
      assignedSpeakerIds.forEach(id => {
        newSpeakerDetails[id] = speakerDetailsObj[id] || {};
      });
      updates.speakerDetails = newSpeakerDetails;
    }

    const originalVolunteerIds = event ? getVolunteerIds(event) : [];
    if (JSON.stringify(assignedVolunteerIds.sort()) !== JSON.stringify(originalVolunteerIds.sort())) {
      updates.assignedVolunteerIds = assignedVolunteerIds;
      // Also update volunteerDetails JSONB to keep it in sync (source of truth)
      const volunteerDetailsObj = (event?.volunteerDetails || {}) as Record<string, { name?: string }>;
      const newVolunteerDetails: Record<string, { name?: string }> = {};
      assignedVolunteerIds.forEach(id => {
        newVolunteerDetails[id] = volunteerDetailsObj[id] || {};
      });
      updates.volunteerDetails = newVolunteerDetails;
    }

    if (assignedVanDriverId !== (event?.assignedVanDriverId || null)) {
      updates.assignedVanDriverId = assignedVanDriverId;
    }

    if (Object.keys(updates).length === 0) {
      console.log('[EventEditDialog] No changes detected, closing dialog');
      toast({
        description: 'No changes to save.',
      });
      onClose();
      return;
    }

    console.log('[EventEditDialog] Final updates object:', JSON.stringify(updates, null, 2));
    updateMutation.mutate(updates);
  };

  if (!event) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Edit Event Details
            <Badge variant="outline" className="ml-2">
              #{event.id}
            </Badge>
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="flex-1 pr-4">
          <Tabs defaultValue="logistics" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="logistics">
                <Clock className="w-4 h-4 mr-2" />
                Logistics
              </TabsTrigger>
              <TabsTrigger value="staffing">
                <Users className="w-4 h-4 mr-2" />
                Staffing
              </TabsTrigger>
            </TabsList>

            <TabsContent value="logistics" className="space-y-4 mt-4">
              {/* Staffing Requirements */}
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="driversNeeded" className="flex items-center gap-1">
                    <Car className="w-4 h-4" /> Drivers Needed
                  </Label>
                  <Input
                    id="driversNeeded"
                    type="number"
                    min="0"
                    value={driversNeeded}
                    onChange={e => setDriversNeeded(e.target.value)}
                    placeholder="0"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="speakersNeeded" className="flex items-center gap-1">
                    <Megaphone className="w-4 h-4" /> Speakers Needed
                  </Label>
                  <Input
                    id="speakersNeeded"
                    type="number"
                    min="0"
                    value={speakersNeeded}
                    onChange={e => setSpeakersNeeded(e.target.value)}
                    placeholder="0"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="volunteersNeeded" className="flex items-center gap-1">
                    <Users className="w-4 h-4" /> Volunteers Needed
                  </Label>
                  <Input
                    id="volunteersNeeded"
                    type="number"
                    min="0"
                    value={volunteersNeeded}
                    onChange={e => setVolunteersNeeded(e.target.value)}
                    placeholder="0"
                  />
                </div>
              </div>

              {/* Van Driver */}
              <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                <input
                  type="checkbox"
                  id="vanDriverNeeded"
                  checked={vanDriverNeeded}
                  onChange={e => setVanDriverNeeded(e.target.checked)}
                  className="w-4 h-4"
                />
                <Label htmlFor="vanDriverNeeded" className="flex items-center gap-2 cursor-pointer">
                  <Truck className="w-4 h-4 text-amber-600" />
                  Van Driver Needed
                </Label>
              </div>

              <Separator />

              {/* Times */}
              <div className="space-y-4">
                <h4 className="font-medium">Event Times</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="pickupTime">Pickup Time</Label>
                    <Input
                      id="pickupTime"
                      type="time"
                      value={pickupTime}
                      onChange={e => setPickupTime(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="pickupTimeWindow">Pickup Window</Label>
                    <Input
                      id="pickupTimeWindow"
                      value={pickupTimeWindow}
                      onChange={e => setPickupTimeWindow(e.target.value)}
                      placeholder="e.g. 30 minutes"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="eventStartTime">Event Start</Label>
                    <Input
                      id="eventStartTime"
                      type="time"
                      value={eventStartTime}
                      onChange={e => setEventStartTime(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="eventEndTime">Event End</Label>
                    <Input
                      id="eventEndTime"
                      type="time"
                      value={eventEndTime}
                      onChange={e => setEventEndTime(e.target.value)}
                    />
                  </div>
                </div>
              </div>

              <Separator />

              {/* TSP Contact */}
              <div className="space-y-3">
                <h4 className="font-medium">TSP Contact</h4>
                <Select
                  value={tspContact || 'none'}
                  onValueChange={value => {
                    setTspContact(value === 'none' ? '' : value);
                    if (value && value !== 'custom' && value !== 'none') {
                      setCustomTspContact('');
                    }
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select TSP contact..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">
                      <span className="text-gray-500">No TSP contact assigned</span>
                    </SelectItem>
                    {usersBasic.map((u: any) => {
                      const name = u.displayName || [u.firstName, u.lastName].filter(Boolean).join(' ') || u.email || u.id;
                      return (
                        <SelectItem key={u.id} value={u.id}>
                          {name}
                        </SelectItem>
                      );
                    })}
                    <SelectItem value="custom">
                      <span className="italic">Enter custom contact...</span>
                    </SelectItem>
                  </SelectContent>
                </Select>

                {tspContact === 'custom' && (
                  <Input
                    value={customTspContact}
                    onChange={e => setCustomTspContact(e.target.value)}
                    placeholder="Enter custom contact name"
                  />
                )}

                {tspContact && tspContact !== 'custom' && tspContact !== 'none' && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-red-600 hover:text-red-700"
                    onClick={() => {
                      setTspContact('');
                      setCustomTspContact('');
                    }}
                  >
                    <X className="w-3 h-3 mr-1" />
                    Remove TSP Contact
                  </Button>
                )}
              </div>
            </TabsContent>

            <TabsContent value="staffing" className="space-y-6 mt-4">
              {/* Drivers */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-medium flex items-center gap-2">
                    <Car className="w-4 h-4" />
                    Assigned Drivers
                    {parseInt(driversNeeded) > 0 && (
                      <Badge variant={assignedDriverIds.length >= parseInt(driversNeeded) ? 'secondary' : 'destructive'}>
                        {assignedDriverIds.length}/{driversNeeded}
                      </Badge>
                    )}
                  </h4>
                </div>
                <PersonSelector
                  selectedPeople={assignedDriverIds}
                  onSelectionChange={setAssignedDriverIds}
                  assignmentType="driver"
                  vanDriverNeeded={vanDriverNeeded}
                />
              </div>

              <Separator />

              {/* Van Driver (if needed) */}
              {vanDriverNeeded && (
                <>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="font-medium flex items-center gap-2">
                        <Truck className="w-4 h-4 text-amber-600" />
                        Van Driver
                        {assignedVanDriverId ? (
                          <Badge variant="secondary">Assigned</Badge>
                        ) : (
                          <Badge variant="destructive">Needed</Badge>
                        )}
                      </h4>
                    </div>
                    <PersonSelector
                      selectedPeople={assignedVanDriverId ? [assignedVanDriverId] : []}
                      onSelectionChange={ids => setAssignedVanDriverId(ids[0] || null)}
                      assignmentType="driver"
                      vanDriverNeeded={true}
                    />
                  </div>
                  <Separator />
                </>
              )}

              {/* Speakers */}
              {(parseInt(speakersNeeded) > 0 || assignedSpeakerIds.length > 0) && (
                <>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="font-medium flex items-center gap-2">
                        <Megaphone className="w-4 h-4" />
                        Assigned Speakers
                        {parseInt(speakersNeeded) > 0 && (
                          <Badge variant={assignedSpeakerIds.length >= parseInt(speakersNeeded) ? 'secondary' : 'destructive'}>
                            {assignedSpeakerIds.length}/{speakersNeeded}
                          </Badge>
                        )}
                      </h4>
                    </div>
                    <PersonSelector
                      selectedPeople={assignedSpeakerIds}
                      onSelectionChange={setAssignedSpeakerIds}
                      assignmentType="speaker"
                    />
                  </div>
                  <Separator />
                </>
              )}

              {/* Volunteers */}
              {(parseInt(volunteersNeeded) > 0 || assignedVolunteerIds.length > 0) && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="font-medium flex items-center gap-2">
                      <Users className="w-4 h-4" />
                      Assigned Volunteers
                      {parseInt(volunteersNeeded) > 0 && (
                        <Badge variant={assignedVolunteerIds.length >= parseInt(volunteersNeeded) ? 'secondary' : 'destructive'}>
                          {assignedVolunteerIds.length}/{volunteersNeeded}
                        </Badge>
                      )}
                    </h4>
                  </div>
                  <PersonSelector
                    selectedPeople={assignedVolunteerIds}
                    onSelectionChange={setAssignedVolunteerIds}
                    assignmentType="volunteer"
                  />
                </div>
              )}
            </TabsContent>
          </Tabs>
        </ScrollArea>

        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={updateMutation.isPending}>
            {updateMutation.isPending ? (
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
  );
};
