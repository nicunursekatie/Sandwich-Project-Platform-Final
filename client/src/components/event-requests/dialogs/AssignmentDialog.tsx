import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Search,
  User,
  Car,
  Building,
  Check,
  X,
  UserPlus,
  Users,
  CheckCircle,
  XCircle,
  HelpCircle,
  ExternalLink,
  Loader2,
} from 'lucide-react';
import { useEventRequestContext } from '../context/EventRequestContext';
import type { AvailabilitySlot } from '@shared/schema';
import { logger } from '@/lib/logger';

interface ComprehensivePersonSelectorProps {
  selectedPeople: string[];
  onSelectionChange: (selected: string[]) => void;
  assignmentType: 'driver' | 'speaker' | 'volunteer' | null;
  availabilitySlots: AvailabilitySlot[];
  isLoadingAvailability: boolean;
}

function ComprehensivePersonSelector({
  selectedPeople,
  onSelectionChange,
  assignmentType,
  availabilitySlots,
  isLoadingAvailability
}: ComprehensivePersonSelectorProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [customEntryText, setCustomEntryText] = useState('');
  const [showCustomEntry, setShowCustomEntry] = useState(false);

  // Helper function to get availability status for a user ID
  const getAvailabilityStatus = (userId: string): 'available' | 'unavailable' | 'not_set' => {
    // Custom entries and non-user types don't have availability
    if (userId.startsWith('custom-') || userId.startsWith('volunteer-') || userId.startsWith('host-contact-')) {
      return 'not_set';
    }

    // Check if user has any availability slot
    const userSlot = availabilitySlots.find(slot => slot.userId === userId);
    
    if (!userSlot) {
      return 'not_set';
    }

    return userSlot.status === 'available' ? 'available' : 'unavailable';
  };

  // Fetch all the different types of people
  const { data: users = [], isLoading: usersLoading } = useQuery<any[]>({
    queryKey: ['/api/users/for-assignments'],
  });

  const { data: drivers = [], isLoading: driversLoading } = useQuery<any[]>({
    queryKey: ['/api/drivers'],
  });

  const { data: volunteers = [], isLoading: volunteersLoading } = useQuery<any[]>({
    queryKey: ['/api/volunteers'],
  });

  const { data: hostsWithContacts = [], isLoading: hostsLoading } = useQuery<any[]>({
    queryKey: ['/api/hosts-with-contacts'],
  });

  const isLoading = usersLoading || driversLoading || volunteersLoading || hostsLoading;

  // Extract all host contacts
  const hostContacts = hostsWithContacts.flatMap(host =>
    (host.contacts || []).map((contact: any) => ({
      ...contact,
      hostName: host.name,
      displayName: contact.name || contact.email || 'Unknown Contact',
      type: 'host-contact'
    }))
  );

  // Filter all people based on search term
  const allPeople = [
    ...users.map((user: any) => ({
      id: user.id,
      displayName: `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.displayName || user.email || 'Unknown User',
      email: user.email,
      type: 'user',
      section: 'Team Members'
    })),
    ...drivers.map((driver: any) => ({
      id: driver.id.toString(),
      displayName: driver.name,
      email: driver.email,
      phone: driver.phone,
      type: 'driver',
      section: 'Drivers'
    })),
    ...volunteers.map((volunteer: any) => ({
      id: `volunteer-${volunteer.id}`,
      displayName: `${volunteer.firstName || ''} ${volunteer.lastName || ''}`.trim() || volunteer.name || 'Unknown Volunteer',
      email: volunteer.email,
      phone: volunteer.phone,
      type: 'volunteer',
      section: 'Volunteers'
    })),
    ...hostContacts.map((contact: any) => ({
      id: `host-contact-${contact.id}`,
      displayName: contact.displayName,
      email: contact.email,
      phone: contact.phone,
      hostName: contact.hostName,
      type: 'host-contact',
      section: 'Host Contacts'
    }))
  ].filter(person => {
    if (!searchTerm) return true;
    const searchLower = searchTerm.toLowerCase();
    return person.displayName.toLowerCase().includes(searchLower) ||
           (person.email && person.email.toLowerCase().includes(searchLower)) ||
           ((person as any).phone && (person as any).phone.toLowerCase().includes(searchLower)) ||
           ((person as any).hostName && (person as any).hostName.toLowerCase().includes(searchLower));
  });

  // Sort all people alphabetically by displayName
  const sortedPeople = allPeople.sort((a, b) =>
    a.displayName.localeCompare(b.displayName, undefined, { sensitivity: 'base' })
  );

  // Group people by section and sort within each section
  const groupedPeople = sortedPeople.reduce((acc, person) => {
    if (!acc[person.section]) acc[person.section] = [];
    acc[person.section].push(person);
    return acc;
  }, {} as Record<string, any[]>);

  const togglePersonSelection = (personId: string) => {
    if (selectedPeople.includes(personId)) {
      onSelectionChange(selectedPeople.filter(id => id !== personId));
    } else {
      onSelectionChange([...selectedPeople, personId]);
    }
  };

  const removeSelectedPerson = (personId: string) => {
    onSelectionChange(selectedPeople.filter(id => id !== personId));
  };

  const handleAddCustomEntry = () => {
    if (customEntryText.trim()) {
      // Create a custom ID that won't conflict with existing IDs
      const customId = `custom-${Date.now()}-${customEntryText.replace(/\s+/g, '-')}`;
      onSelectionChange([...selectedPeople, customId]);
      setCustomEntryText('');
      setShowCustomEntry(false);
    }
  };

  // Helper to get display name for custom entries
  const getPersonDisplayName = (personId: string) => {
    if (personId.startsWith('custom-')) {
      // Extract the custom name from the ID
      const parts = personId.split('-');
      return parts.slice(2).join(' ').replace(/-/g, ' ');
    }
    const person = allPeople.find(p => p.id === personId);
    return person?.displayName || personId;
  };

  return (
    <div className="flex-1 flex flex-col space-y-4">
      {/* Search and Custom Entry Controls */}
      <div className="space-y-2">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-[#007E8C] w-4 h-4" aria-hidden="true" />
          <Input
            placeholder="Search by name, email, phone, or organization..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 border-[#007E8C]/30 focus:border-[#007E8C] focus:ring-[#007E8C]/20"
          />
        </div>

        {/* Custom Entry Section */}
        <div className="space-y-2">
          {!showCustomEntry ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowCustomEntry(true)}
              className="w-full border-[#007E8C]/30 text-[#236383] hover:bg-[#007E8C]/5 hover:border-[#007E8C]"
            >
              <UserPlus className="w-4 h-4 mr-2" aria-hidden="true" />
              Add Custom Entry (Person Not in List)
            </Button>
          ) : (
            <div className="flex gap-2 p-3 bg-[#007E8C]/5 rounded-lg border border-[#007E8C]/20">
              <Input
                placeholder="Enter name for custom assignment..."
                value={customEntryText}
                onChange={(e) => setCustomEntryText(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddCustomEntry();
                  }
                }}
                className="flex-1"
                autoFocus
              />
              <Button
                type="button"
                size="sm"
                onClick={handleAddCustomEntry}
                disabled={!customEntryText.trim()}
                className="bg-[#007E8C] hover:bg-[#236383] text-white"
              >
                Add
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => {
                  setShowCustomEntry(false);
                  setCustomEntryText('');
                }}
                className="hover:bg-[#007E8C]/10"
              >
                Cancel
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Selected People */}
      {selectedPeople.length > 0 && (
        <div className="space-y-2 p-3 bg-[#007E8C]/5 rounded-lg border border-[#007E8C]/10">
          <h3 className="text-sm font-semibold text-[#236383] uppercase tracking-wide">
            Selected {assignmentType ? assignmentType.charAt(0).toUpperCase() + assignmentType.slice(1) + 's' : 'People'} ({selectedPeople.length})
          </h3>
          <div className="flex flex-wrap gap-2">
            {selectedPeople.map((personId) => {
              const isCustom = personId.startsWith('custom-');
              return (
                <Badge
                  key={personId}
                  variant="secondary"
                  className={isCustom ? "bg-[#FBAD3F]/10 text-[#FBAD3F] border border-[#FBAD3F]/30 font-medium" : "bg-[#007E8C]/10 text-[#007E8C] border border-[#007E8C]/30 font-medium"}
                >
                  {getPersonDisplayName(personId)}
                  {isCustom && <span className="ml-1 text-xs">(custom)</span>}
                  <button
                    onClick={() => removeSelectedPerson(personId)}
                    className="ml-2 hover:bg-[#007E8C]/20 rounded-full w-4 h-4 flex items-center justify-center"
                    aria-label={`Remove ${getPersonDisplayName(personId)}`}
                  >
                    <X className="w-3 h-3" aria-hidden="true" />
                  </button>
                </Badge>
              );
            })}
          </div>
        </div>
      )}

      {/* Available People by Category */}
      <div className="flex-1 overflow-hidden">
        <ScrollArea className="h-96">
          <div className="space-y-6 pr-4">
            {Object.entries(groupedPeople).map(([section, people]) => (
              <div key={section}>
                <h3 className="text-sm font-semibold text-[#236383] uppercase tracking-wide mb-3 pb-2 border-b border-[#007E8C]/10">
                  {section} ({people.length})
                </h3>
                <div className="space-y-2">
                  {people.map((person) => {
                    const isSelected = selectedPeople.includes(person.id);
                    const availabilityStatus = getAvailabilityStatus(person.id);
                    
                    return (
                      <button
                        key={person.id}
                        type="button"
                        className={`w-full text-left p-3 rounded-lg border cursor-pointer transition-all ${
                          isSelected
                            ? 'bg-[#007E8C]/10 border-[#007E8C] text-[#236383] shadow-sm'
                            : 'bg-white border-gray-200 hover:bg-[#007E8C]/5 hover:border-[#007E8C]/30'
                        }`}
                        onClick={() => togglePersonSelection(person.id)}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-3 flex-1">
                            {person.type === 'user' && <User className="w-4 h-4 text-[#007E8C]" aria-hidden="true" />}
                            {person.type === 'driver' && <Car className="w-4 h-4 text-[#47B3CB]" aria-hidden="true" />}
                            {person.type === 'volunteer' && <Users className="w-4 h-4 text-[#FBAD3F]" aria-hidden="true" />}
                            {person.type === 'host-contact' && <Building className="w-4 h-4 text-[#236383]" aria-hidden="true" />}
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <div className="font-medium">{person.displayName}</div>
                                {/* Availability indicator */}
                                {!isLoadingAvailability && person.type === 'user' && (
                                  <>
                                    {availabilityStatus === 'available' && (
                                      <Badge variant="outline" className="bg-[#007E8C]/10 text-[#007E8C] border border-[#007E8C]/30 text-xs font-medium">
                                        <CheckCircle className="w-3 h-3 mr-1" aria-hidden="true" />
                                        Available
                                      </Badge>
                                    )}
                                    {availabilityStatus === 'unavailable' && (
                                      <Badge variant="outline" className="bg-[#A31C41]/10 text-[#A31C41] border border-[#A31C41]/30 text-xs font-medium">
                                        <XCircle className="w-3 h-3 mr-1" aria-hidden="true" />
                                        Unavailable
                                      </Badge>
                                    )}
                                    {availabilityStatus === 'not_set' && (
                                      <Badge variant="outline" className="bg-gray-50 text-gray-600 border border-gray-300 text-xs font-medium">
                                        <HelpCircle className="w-3 h-3 mr-1" aria-hidden="true" />
                                        Not Set
                                      </Badge>
                                    )}
                                  </>
                                )}
                                {isLoadingAvailability && person.type === 'user' && (
                                  <Loader2 className="w-3 h-3 animate-spin text-[#007E8C]" aria-hidden="true" />
                                )}
                              </div>
                              {person.email && (
                                <div className="text-sm text-gray-500">{person.email}</div>
                              )}
                              {person.phone && (
                                <div className="text-sm text-gray-500">{person.phone}</div>
                              )}
                              {person.hostName && (
                                <div className="text-sm text-gray-500">Host: {person.hostName}</div>
                              )}
                            </div>
                          </div>
                          {isSelected && (
                            <Check className="w-5 h-5 text-[#007E8C] flex-shrink-0" aria-hidden="true" />
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </div>

      {isLoading && (
        <div className="absolute inset-0 bg-white/80 flex items-center justify-center pointer-events-none">
          <div className="text-sm text-gray-500">Loading people...</div>
        </div>
      )}
    </div>
  );
}

interface AssignmentDialogProps {
  isOpen: boolean;
  onClose: () => void;
  assignmentType: 'driver' | 'speaker' | 'volunteer' | null;
  selectedAssignees: string[];
  setSelectedAssignees: (assignees: string[]) => void;
  onAssign: (assignees: string[]) => void;
}

export const AssignmentDialog: React.FC<AssignmentDialogProps> = ({
  isOpen,
  onClose,
  assignmentType,
  selectedAssignees,
  setSelectedAssignees,
  onAssign,
}) => {
  // Get context to find the event date
  const { assignmentEventId, eventRequests } = useEventRequestContext();

  // Find the current event request
  const currentEvent = useMemo(() => {
    return eventRequests.find(e => e.id === assignmentEventId);
  }, [eventRequests, assignmentEventId]);

  // Extract event date (use scheduledEventDate if available, otherwise desiredEventDate)
  const eventDate = useMemo(() => {
    if (!currentEvent) return null;
    
    const dateToUse = currentEvent.scheduledEventDate || currentEvent.desiredEventDate;
    if (!dateToUse) return null;

    // Format as YYYY-MM-DD for the API
    const date = new Date(dateToUse);
    return date.toISOString().split('T')[0];
  }, [currentEvent]);

  // Fetch availability data for the event date
  const { data: availabilitySlots = [], isLoading: isLoadingAvailability } = useQuery<AvailabilitySlot[]>({
    queryKey: ['/api/availability', eventDate],
    enabled: !!eventDate && isOpen, // Only fetch when dialog is open and we have a date
    queryFn: async () => {
      if (!eventDate) return [];
      const response = await fetch(`/api/availability?startDate=${eventDate}&endDate=${eventDate}`);
      if (!response.ok) {
        logger.error('Failed to fetch availability');
        return [];
      }
      return response.json();
    },
  });

  return (
    <Dialog open={isOpen} onOpenChange={(open) => {
      if (!open) {
        onClose();
        setSelectedAssignees([]);
      }
    }}>
      <DialogContent className="max-w-4xl max-h-[80vh] flex flex-col">
        <DialogHeader className="border-b border-[#007E8C]/10 pb-4">
          <DialogTitle className="flex items-center gap-2 text-[#236383] text-xl">
            <UserPlus className="w-5 h-5 text-[#007E8C]" aria-hidden="true" />
            Assign {assignmentType ? assignmentType.charAt(0).toUpperCase() + assignmentType.slice(1) + 's' : 'People'}
          </DialogTitle>
          <DialogDescription className="text-gray-600 mt-2">
            Select people to assign as {assignmentType}s for this event. You can choose from team members, drivers, volunteers, and host contacts.
          </DialogDescription>
        </DialogHeader>

        {/* View Team Availability Link */}
        <div className="flex items-center justify-end pt-2">
          <Button
            type="button"
            variant="link"
            size="sm"
            onClick={() => window.open('/team-availability', '_blank')}
            className="text-[#007E8C] hover:text-[#236383] font-medium"
            data-testid="link-view-team-availability"
          >
            <ExternalLink className="w-4 h-4 mr-1" aria-hidden="true" />
            View Full Team Availability Calendar
          </Button>
        </div>

        <ComprehensivePersonSelector
          selectedPeople={selectedAssignees}
          onSelectionChange={setSelectedAssignees}
          assignmentType={assignmentType}
          availabilitySlots={availabilitySlots}
          isLoadingAvailability={isLoadingAvailability}
        />

        <div className="flex justify-end space-x-2 pt-4 border-t border-[#007E8C]/10">
          <Button
            variant="outline"
            onClick={onClose}
            className="border-gray-300 text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </Button>
          <Button
            onClick={() => onAssign(selectedAssignees)}
            className="bg-[#007E8C] hover:bg-[#236383] text-white shadow-sm"
            disabled={selectedAssignees.length === 0}
          >
            <UserPlus className="w-4 h-4 mr-2" aria-hidden="true" />
            Assign {selectedAssignees.length} {assignmentType}
            {selectedAssignees.length !== 1 ? 's' : ''}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};