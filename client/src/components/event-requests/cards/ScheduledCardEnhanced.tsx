import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Clock,
  Package,
  MapPin,
  Edit2,
  Save,
  X,
  Trash2,
  Calendar,
  Users,
  Building,
  Car,
  Megaphone,
  UserPlus,
  Check,
  Phone,
  Mail,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  History,
  FileText,
  MessageSquare,
  Loader2,
} from 'lucide-react';
import {
  formatTime12Hour,
  formatTimeForInput,
  formatEventDate,
} from '@/components/event-requests/utils';
import { DateTimePicker } from '@/components/ui/datetime-picker';
import {
  SANDWICH_TYPES,
  statusOptions,
} from '@/components/event-requests/constants';
import {
  parseSandwichTypes,
  formatSandwichTypesDisplay,
} from '@/lib/sandwich-utils';
import type { EventRequest } from '@shared/schema';
import { ConfirmationDialog } from '@/components/ui/confirmation-dialog';
import { MultiRecipientSelector } from '@/components/ui/multi-recipient-selector';
import { getMissingIntakeInfo } from '@/lib/event-request-validation';
import { EventRequestAuditLog } from '@/components/event-request-audit-log';
import SendKudosButton from '@/components/send-kudos-button';
import { MessageComposer } from '@/components/message-composer';

interface ScheduledCardEnhancedProps {
  request: EventRequest;
  editingField: string | null;
  editingValue: string;
  isEditingThisCard: boolean;
  inlineSandwichMode: 'total' | 'types' | 'range';
  inlineTotalCount: number;
  inlineSandwichTypes: Array<{ type: string; quantity: number }>;
  inlineRangeMin: number;
  inlineRangeMax: number;
  inlineRangeType: string;
  isSaving?: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onContact: () => void;
  onAssignTspContact: () => void;
  onEditTspContact: () => void;
  onLogContact: () => void;
  onFollowUp: () => void;
  onReschedule: () => void;
  startEditing: (field: string, value: string) => void;
  saveEdit: () => void;
  cancelEdit: () => void;
  setEditingValue: (value: string) => void;
  tempIsConfirmed: boolean;
  setTempIsConfirmed: (value: boolean) => void;
  quickToggleBoolean: (field: 'isConfirmed' | 'addedToOfficialSheet', value: boolean) => void;
  setInlineSandwichMode: (mode: 'total' | 'types' | 'range') => void;
  setInlineTotalCount: (count: number) => void;
  setInlineRangeMin: (count: number) => void;
  setInlineRangeMax: (count: number) => void;
  setInlineRangeType: (type: string) => void;
  addInlineSandwichType: () => void;
  updateInlineSandwichType: (index: number, field: 'type' | 'quantity', value: string | number) => void;
  removeInlineSandwichType: (index: number) => void;
  resolveUserName: (id: string) => string;
  openAssignmentDialog: (type: 'driver' | 'speaker' | 'volunteer') => void;
  handleRemoveAssignment: (type: 'driver' | 'speaker' | 'volunteer', personId: string) => void;
  canEdit?: boolean;
}

const parsePostgresArray = (arr: any): string[] => {
  if (!arr) return [];
  if (Array.isArray(arr)) return arr;
  if (typeof arr === 'string') {
    if (arr === '{}' || arr === '') return [];
    let cleaned = arr.replace(/^{|}$/g, '');
    if (!cleaned) return [];
    return cleaned.split(',').map((item) => item.trim()).filter((item) => item);
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
  return ''; // Return empty string so resolveUserName gets called
};

export const ScheduledCardEnhanced: React.FC<ScheduledCardEnhancedProps> = ({
  request,
  editingField,
  editingValue,
  isEditingThisCard,
  inlineSandwichMode,
  inlineTotalCount,
  inlineSandwichTypes,
  inlineRangeMin,
  inlineRangeMax,
  inlineRangeType,
  isSaving = false,
  onEdit,
  onDelete,
  onContact,
  onAssignTspContact,
  onEditTspContact,
  onLogContact,
  onFollowUp,
  onReschedule,
  startEditing,
  saveEdit,
  cancelEdit,
  setEditingValue,
  tempIsConfirmed,
  setTempIsConfirmed,
  quickToggleBoolean,
  setInlineSandwichMode,
  setInlineTotalCount,
  setInlineRangeMin,
  setInlineRangeMax,
  setInlineRangeType,
  addInlineSandwichType,
  updateInlineSandwichType,
  removeInlineSandwichType,
  resolveUserName,
  openAssignmentDialog,
  handleRemoveAssignment,
  canEdit = true,
}) => {
  const [showAuditLog, setShowAuditLog] = useState(false);
  const [showMessageDialog, setShowMessageDialog] = useState(false);
  const [addingAllTimes, setAddingAllTimes] = useState(false);
  const [tempStartTime, setTempStartTime] = useState('');
  const [tempEndTime, setTempEndTime] = useState('');
  const [tempPickupTime, setTempPickupTime] = useState('');

  const queryClient = useQueryClient();

  // Mutation for updating event request fields
  const updateFieldsMutation = useMutation({
    mutationFn: async (updates: Record<string, any>) => {
      const response = await fetch(`/api/event-requests/${request.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to update event request');
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/event-requests'] });
      setAddingAllTimes(false);
      setTempStartTime('');
      setTempEndTime('');
      setTempPickupTime('');
    },
  });

  // Fetch data for recipient resolution
  const { data: hostContacts = [] } = useQuery<Array<{
    id: number;
    displayName: string;
    name: string;
    hostLocationName: string;
  }>>({
    queryKey: ['/api/hosts/host-contacts'],
    staleTime: 1 * 60 * 1000,
  });

  const { data: recipients = [] } = useQuery<Array<{ id: number; name: string }>>({
    queryKey: ['/api/recipients'],
    staleTime: 1 * 60 * 1000,
  });

  const { data: hostLocations = [] } = useQuery<Array<{ id: number; name: string }>>({
    queryKey: ['/api/hosts'],
    staleTime: 1 * 60 * 1000,
  });

  const resolveRecipientName = (recipientId: string): string => {
    if (recipientId.includes(':')) {
      const [type, ...rest] = recipientId.split(':');
      const value = rest.join(':');

      if (!isNaN(Number(value))) {
        const numId = Number(value);

        if (type === 'host') {
          const hostContact = hostContacts.find(hc => hc.id === numId);
          if (hostContact) return hostContact.displayName || hostContact.name || hostContact.hostLocationName;
          const hostLocation = hostLocations.find(h => h.id === numId);
          if (hostLocation) return hostLocation.name;
        } else if (type === 'recipient') {
          const recipient = recipients.find(r => r.id === numId);
          if (recipient) return recipient.name;
        }
      }
      return value;
    }

    if (!isNaN(Number(recipientId))) {
      const numId = Number(recipientId);
      // Check host contacts first (more specific), then locations, then recipients
      const hostContact = hostContacts.find(h => h.id === numId);
      if (hostContact) return hostContact.displayName || hostContact.name;
      const hostLocation = hostLocations.find(h => h.id === numId);
      if (hostLocation) return hostLocation.name;
      const recipient = recipients.find(r => r.id === numId);
      if (recipient) return recipient.name;
    }

    return recipientId;
  };

  // Get display date
  const displayDate = request.scheduledEventDate || request.desiredEventDate;
  const dateInfo = displayDate ? formatEventDate(displayDate.toString()) : null;

  // Calculate staffing
  const driverAssigned = parsePostgresArray(request.assignedDriverIds).length + (request.assignedVanDriverId ? 1 : 0);
  const speakerAssigned = Object.keys(request.speakerDetails || {}).length;
  const volunteerAssigned = parsePostgresArray(request.assignedVolunteerIds).length;
  const driverNeeded = request.driversNeeded || 0;
  const speakerNeeded = request.speakersNeeded || 0;
  const volunteerNeeded = request.volunteersNeeded || 0;
  const totalAssigned = driverAssigned + speakerAssigned + volunteerAssigned;
  const totalNeeded = driverNeeded + speakerNeeded + volunteerNeeded;
  const staffingComplete = totalAssigned >= totalNeeded && totalNeeded > 0;

  // Sandwich info
  const hasRange = request.estimatedSandwichCountMin && request.estimatedSandwichCountMax;
  let sandwichInfo;
  if (hasRange) {
    const rangeType = request.estimatedSandwichRangeType;
    const typeLabel = rangeType ? SANDWICH_TYPES.find(t => t.value === rangeType)?.label : null;
    sandwichInfo = `${request.estimatedSandwichCountMin}-${request.estimatedSandwichCountMax}${typeLabel ? ` ${typeLabel}` : ''}`;
  } else {
    sandwichInfo = formatSandwichTypesDisplay(request.sandwichTypes, request.estimatedSandwichCount ?? undefined);
  }

  const missingInfo = getMissingIntakeInfo(request);

  const formatDateForInput = (dateStr: string) => {
    if (!dateStr) return '';
    return dateStr.split('T')[0];
  };

  let dateFieldToEdit = 'desiredEventDate';
  let dateLabel = 'Requested Date';
  if (request.scheduledEventDate) {
    dateFieldToEdit = 'scheduledEventDate';
    dateLabel = request.status === 'completed' ? 'Event Date' : 'Scheduled Date';
  }

  return (
    <Card className="w-full bg-white border-l-4 border-l-[#007E8C] shadow-sm hover:shadow-lg transition-all">
      <CardContent className="p-6">
        {/* Header Row - Organization & Status */}
        <div className="flex items-start justify-between gap-4 mb-4 pb-4 border-b-2 border-[#007E8C]/10">
          <div className="flex-1">
            <div className="flex items-baseline gap-3 mb-3">
              <h2 className="text-2xl font-bold text-[#236383]">
                {request.organizationName}
              </h2>
              {request.department && (
                <span className="text-sm text-[#236383]/70 font-medium">
                  {request.department}
                </span>
              )}
            </div>

            {/* Status Badges */}
            <div className="flex flex-wrap items-center gap-2">
              <Badge
                onClick={() => canEdit && quickToggleBoolean('isConfirmed', request.isConfirmed)}
                className={`cursor-pointer hover:opacity-80 transition-opacity font-medium ${
                  request.isConfirmed
                    ? 'bg-gradient-to-br from-[#007E8C] to-[#47B3CB] text-white border border-[#007E8C]'
                    : 'bg-gradient-to-br from-gray-500 to-gray-600 text-white border border-gray-500'
                }`}
              >
                {request.isConfirmed ? 'Date Confirmed' : 'Date Pending'}
              </Badge>

              <Badge
                onClick={() => canEdit && quickToggleBoolean('addedToOfficialSheet', request.addedToOfficialSheet)}
                className={`cursor-pointer hover:opacity-80 transition-opacity font-medium ${
                  request.addedToOfficialSheet
                    ? 'bg-gradient-to-br from-[#236383] to-[#007E8C] text-white border border-[#236383]'
                    : 'bg-gradient-to-br from-gray-500 to-gray-600 text-white border border-gray-500'
                }`}
              >
                {request.addedToOfficialSheet ? '✓ On Official Sheet' : 'Not on Sheet'}
              </Badge>

              {/* Sandwich count badge */}
              <Badge className="bg-[#FBAD3F] text-white border border-[#FBAD3F] font-medium">
                <Package className="w-3 h-3 mr-1" aria-hidden="true" />
                {sandwichInfo} Sandwiches
              </Badge>

              {request.externalId && request.externalId.startsWith('manual-') && (
                <Badge className="bg-[#FBAD3F] text-white border border-[#FBAD3F] font-medium">
                  <FileText className="w-3 h-3 mr-1" />
                  Manual Entry
                </Badge>
              )}

              {staffingComplete ? (
                <Badge className="bg-gradient-to-br from-[#47B3CB] to-[#007E8C] text-white border border-[#47B3CB] font-medium">
                  Fully Staffed
                </Badge>
              ) : (
                <>
                  {driverNeeded > driverAssigned && (
                    <Badge className="bg-[#FBAD3F] text-white border border-[#FBAD3F] font-medium">
                      {driverNeeded - driverAssigned} driver{driverNeeded - driverAssigned > 1 ? 's' : ''} needed
                    </Badge>
                  )}
                  {speakerNeeded > speakerAssigned && (
                    <Badge className="bg-[#FBAD3F] text-white border border-[#FBAD3F] font-medium">
                      {speakerNeeded - speakerAssigned} speaker{speakerNeeded - speakerAssigned > 1 ? 's' : ''} needed
                    </Badge>
                  )}
                  {volunteerNeeded > volunteerAssigned && (
                    <Badge className="bg-[#FBAD3F] text-white border border-[#FBAD3F] font-medium">
                      {volunteerNeeded - volunteerAssigned} volunteer{volunteerNeeded - volunteerAssigned > 1 ? 's' : ''} needed
                    </Badge>
                  )}
                </>
              )}

              {request.vanDriverNeeded && !request.assignedVanDriverId && (
                <Badge className="bg-[#236383] text-white border border-[#236383] font-medium">
                  <Car className="w-3 h-3 mr-1" />
                  Van Driver Needed
                </Badge>
              )}

              {missingInfo.length > 0 && (
                <Badge className="bg-gradient-to-br from-[#A31C41] to-[#8B1538] text-white border border-[#A31C41] font-medium animate-pulse">
                  <AlertTriangle className="w-3 h-3 mr-1" />
                  {missingInfo.length} Missing
                </Badge>
              )}
            </div>
          </div>

          {/* Action Buttons */}
          {canEdit && (
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={() => setShowMessageDialog(true)}
                variant="ghost"
                className="text-[#007E8C] hover:text-[#007E8C] hover:bg-[#007E8C]/10"
                aria-label="Message about this event"
              >
                <MessageSquare className="w-4 h-4" aria-hidden="true" />
              </Button>
              <Button size="sm" onClick={onEdit} variant="ghost" className="text-[#007E8C] hover:text-[#007E8C] hover:bg-[#007E8C]/10" aria-label="Edit event">
                <Edit2 className="w-4 h-4" aria-hidden="true" />
              </Button>
              <ConfirmationDialog
                trigger={
                  <Button size="sm" variant="ghost" className="text-[#A31C41] hover:text-[#A31C41] hover:bg-[#A31C41]/10" aria-label="Delete event">
                    <Trash2 className="w-4 h-4" aria-hidden="true" />
                  </Button>
                }
                title="Delete Event"
                description={`Delete ${request.organizationName}?`}
                confirmText="Delete"
                onConfirm={onDelete}
                variant="destructive"
              />
            </div>
          )}
        </div>

        {/* Main Info Section - Compact Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
          {/* Left Column - Event Details & Team Assignments */}
          <div className="lg:col-span-2 space-y-4">
            {/* Event Details */}
            <div className="bg-[#007E8C]/5 rounded-lg p-4 border border-[#007E8C]/10 space-y-3">
              <h3 className="text-sm uppercase font-bold tracking-wide text-[#236383] flex items-center gap-2 mb-3">
                <Calendar className="w-4 h-4 text-[#007E8C]" aria-hidden="true" />
                Event Details
              </h3>

            {/* Date - Inline Editable */}
            <div className="flex items-center gap-2">
              <Calendar className="w-5 h-5 shrink-0 text-[#007E8C]" />
              {isEditingThisCard && editingField === dateFieldToEdit ? (
                <div className="flex items-center gap-2 flex-1">
                  <Input
                    type="date"
                    value={editingValue}
                    onChange={(e) => setEditingValue(e.target.value)}
                    className="h-8 bg-white text-gray-900 border-[#007E8C]/20"
                  />
                  <Button size="sm" onClick={saveEdit} className="bg-[#007E8C] hover:bg-[#007E8C]/90 text-white" aria-label="Save date">
                    <Save className="w-3 h-3" aria-hidden="true" />
                  </Button>
                  <Button size="sm" variant="ghost" onClick={cancelEdit} className="text-gray-600 hover:bg-gray-100" aria-label="Cancel editing">
                    <X className="w-3 h-3" aria-hidden="true" />
                  </Button>
                </div>
              ) : (
                <div className="flex items-center gap-2 flex-1 group">
                  <span className="text-base font-bold text-[#236383]">
                    {dateInfo ? dateInfo.text : 'No date set'}
                  </span>
                  {canEdit && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => startEditing(dateFieldToEdit, formatDateForInput(displayDate?.toString() || ''))}
                      className="opacity-0 group-hover:opacity-100 text-[#007E8C] hover:bg-[#007E8C]/10 h-6 px-2"
                      aria-label="Edit date"
                    >
                      <Edit2 className="w-3 h-3" aria-hidden="true" />
                    </Button>
                  )}
                </div>
              )}
            </div>

            {/* Times Row with Add Times button */}
            <div className="flex items-start justify-between gap-4">
              <div className="grid grid-cols-3 gap-2 text-sm flex-1">
                {/* Start Time */}
                <div>
                  <div className="text-gray-700 text-sm uppercase font-semibold">Start</div>
                  {(isEditingThisCard && editingField === 'eventStartTime') || addingAllTimes ? (
                    <div className="flex flex-col gap-1">
                      <Input
                        type="time"
                        value={addingAllTimes ? tempStartTime : editingValue}
                        onChange={(e) => addingAllTimes ? setTempStartTime(e.target.value) : setEditingValue(e.target.value)}
                        className="h-7 bg-white text-gray-900 text-xs border-[#007E8C]/20"
                      />
                      {!addingAllTimes && (
                        <div className="flex gap-1">
                          <Button size="sm" onClick={saveEdit} className="h-6 px-2 bg-[#007E8C] text-white hover:bg-[#007E8C]/90" aria-label="Save">
                            <Save className="w-3 h-3" aria-hidden="true" />
                          </Button>
                          <Button size="sm" variant="ghost" onClick={cancelEdit} className="h-6 px-2 text-gray-600 hover:bg-gray-100" aria-label="Cancel">
                            <X className="w-3 h-3" aria-hidden="true" />
                          </Button>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-base font-bold group cursor-pointer text-gray-900" onClick={() => canEdit && startEditing('eventStartTime', formatTimeForInput(request.eventStartTime || ''))}>
                      {request.eventStartTime ? formatTime12Hour(request.eventStartTime) : 'Not set'}
                    </div>
                  )}
                </div>

                {/* End Time */}
                <div>
                  <div className="text-gray-700 text-sm uppercase font-semibold">End</div>
                  {(isEditingThisCard && editingField === 'eventEndTime') || addingAllTimes ? (
                    <div className="flex flex-col gap-1">
                      <Input
                        type="time"
                        value={addingAllTimes ? tempEndTime : editingValue}
                        onChange={(e) => addingAllTimes ? setTempEndTime(e.target.value) : setEditingValue(e.target.value)}
                        className="h-7 bg-white text-gray-900 text-xs border-[#007E8C]/20"
                      />
                      {!addingAllTimes && (
                        <div className="flex gap-1">
                          <Button size="sm" onClick={saveEdit} className="h-6 px-2 bg-[#007E8C] text-white hover:bg-[#007E8C]/90" aria-label="Save">
                            <Save className="w-3 h-3" aria-hidden="true" />
                          </Button>
                          <Button size="sm" variant="ghost" onClick={cancelEdit} className="h-6 px-2 text-gray-600 hover:bg-gray-100" aria-label="Cancel">
                            <X className="w-3 h-3" aria-hidden="true" />
                          </Button>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-base font-bold group cursor-pointer text-gray-900" onClick={() => canEdit && startEditing('eventEndTime', formatTimeForInput(request.eventEndTime || ''))}>
                      {request.eventEndTime ? formatTime12Hour(request.eventEndTime) : 'Not set'}
                    </div>
                  )}
                </div>

                {/* Pickup Time */}
                <div>
                  <div className="text-gray-700 text-sm uppercase font-semibold">Pickup</div>
                  {(isEditingThisCard && editingField === 'pickupDateTime') || addingAllTimes ? (
                    <div className="flex flex-col gap-1">
                      {addingAllTimes ? (
                        <Input
                          type="time"
                          value={tempPickupTime}
                          onChange={(e) => setTempPickupTime(e.target.value)}
                          className="h-7 bg-white text-gray-900 text-xs border-[#007E8C]/20"
                        />
                      ) : (
                        <>
                          <DateTimePicker
                            value={editingValue}
                            onChange={setEditingValue}
                            className="h-7 text-xs border-[#007E8C]/20"
                          />
                          <div className="flex gap-1">
                            <Button size="sm" onClick={saveEdit} className="h-6 px-2 bg-[#007E8C] text-white hover:bg-[#007E8C]/90" aria-label="Save">
                              <Save className="w-3 h-3" aria-hidden="true" />
                            </Button>
                            <Button size="sm" variant="ghost" onClick={cancelEdit} className="h-6 px-2 text-gray-600 hover:bg-gray-100" aria-label="Cancel">
                              <X className="w-3 h-3" aria-hidden="true" />
                            </Button>
                          </div>
                        </>
                      )}
                    </div>
                  ) : (
                    <div className="text-base font-bold group cursor-pointer text-gray-900" onClick={() => canEdit && startEditing('pickupDateTime', request.pickupDateTime?.toString() || '')}>
                      {request.pickupDateTime ? formatTime12Hour(new Date(request.pickupDateTime).toTimeString().slice(0, 5)) : (request.pickupTime ? formatTime12Hour(request.pickupTime) : 'Not set')}
                    </div>
                  )}
                </div>
              </div>

              {/* Add Times button or Save/Cancel buttons */}
              {canEdit && (!request.eventStartTime || !request.eventEndTime || (!request.pickupDateTime && !request.pickupTime)) && (
                <div className="flex flex-col gap-1 mt-4">
                  {!addingAllTimes ? (
                    <Button
                      size="sm"
                      variant="outline"
                      className="bg-[#007E8C]/10 hover:bg-[#007E8C]/20 text-[#007E8C] border-[#007E8C]/30 whitespace-nowrap"
                      onClick={() => {
                        // Initialize temp values with existing times
                        setTempStartTime(formatTimeForInput(request.eventStartTime || ''));
                        setTempEndTime(formatTimeForInput(request.eventEndTime || ''));
                        setTempPickupTime(request.pickupDateTime ? formatTimeForInput(new Date(request.pickupDateTime).toTimeString().slice(0, 5)) : (request.pickupTime ? formatTimeForInput(request.pickupTime) : ''));
                        setAddingAllTimes(true);
                      }}
                    >
                      <Clock className="w-3 h-3 mr-1" aria-hidden="true" />
                      Set All Times
                    </Button>
                  ) : (
                    <div className="flex gap-1">
                      <Button
                        size="sm"
                        onClick={() => {
                          // Prepare updates object with all modified times
                          const updates: Record<string, string> = {};

                          // Get existing pickup time value for comparison
                          const existingPickupTime = request.pickupDateTime
                            ? formatTimeForInput(new Date(request.pickupDateTime).toTimeString().slice(0, 5))
                            : (request.pickupTime ? formatTimeForInput(request.pickupTime) : '');

                          if (tempStartTime && tempStartTime !== formatTimeForInput(request.eventStartTime || '')) {
                            updates.eventStartTime = tempStartTime;
                          }
                          if (tempEndTime && tempEndTime !== formatTimeForInput(request.eventEndTime || '')) {
                            updates.eventEndTime = tempEndTime;
                          }
                          if (tempPickupTime && tempPickupTime !== existingPickupTime) {
                            updates.pickupTime = tempPickupTime;
                          }

                          // Save all fields at once
                          if (Object.keys(updates).length > 0) {
                            updateFieldsMutation.mutate(updates);
                          } else {
                            setAddingAllTimes(false);
                          }
                        }}
                        className="bg-[#007E8C] text-white hover:bg-[#007E8C]/90 whitespace-nowrap"
                        disabled={updateFieldsMutation.isPending}
                        aria-label="Save all times"
                      >
                        <Save className="w-3 h-3 mr-1" aria-hidden="true" />
                        {updateFieldsMutation.isPending ? 'Saving...' : 'Save All'}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setAddingAllTimes(false);
                          setTempStartTime('');
                          setTempEndTime('');
                          setTempPickupTime('');
                        }}
                        className="text-gray-600 hover:bg-gray-100"
                        aria-label="Cancel"
                      >
                        <X className="w-3 h-3" aria-hidden="true" />
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Address */}
            <div className="flex items-start gap-2">
              <MapPin className="w-5 h-5 shrink-0 mt-0.5 text-[#007E8C]" />
              {isEditingThisCard && editingField === 'eventAddress' ? (
                <div className="flex-1 flex flex-col gap-2">
                  <Input
                    value={editingValue}
                    onChange={(e) => setEditingValue(e.target.value)}
                    className="bg-white text-gray-900 border-[#007E8C]/20"
                    placeholder="Event address"
                  />
                  <div className="flex gap-2">
                    <Button size="sm" onClick={saveEdit} className="bg-[#007E8C] hover:bg-[#007E8C]/90 text-white">
                      <Save className="w-3 h-3 mr-1" /> Save
                    </Button>
                    <Button size="sm" variant="ghost" onClick={cancelEdit} className="text-gray-600 hover:bg-gray-100">
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex-1 group">
                  {request.eventAddress ? (
                    <a
                      href={`https://maps.google.com/maps?q=${encodeURIComponent(request.eventAddress)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-base text-[#007E8C] hover:text-[#007E8C]/80 underline font-semibold"
                    >
                      {request.eventAddress}
                    </a>
                  ) : (
                    <span className="text-sm text-gray-600">No address set</span>
                  )}
                  {canEdit && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => startEditing('eventAddress', request.eventAddress || '')}
                      className="opacity-0 group-hover:opacity-100 text-[#007E8C] hover:bg-[#007E8C]/10 h-6 px-2 ml-2"
                      aria-label="Edit"
                    >
                      <Edit2 className="w-3 h-3" aria-hidden="true" />
                    </Button>
                  )}
                </div>
              )}
            </div>

            {/* Sandwiches - Inline Editable */}
            <div className="flex items-center gap-2">
              <Package className="w-5 h-5 shrink-0" />
              {isEditingThisCard && editingField === 'sandwichTypes' ? (
                <div className="flex-1 bg-white/10 rounded p-2 space-y-2">
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant={inlineSandwichMode === 'total' ? 'default' : 'outline'}
                      onClick={() => setInlineSandwichMode('total')}
                      className="h-7"
                    >
                      Exact
                    </Button>
                    <Button
                      size="sm"
                      variant={inlineSandwichMode === 'range' ? 'default' : 'outline'}
                      onClick={() => setInlineSandwichMode('range')}
                      className="h-7"
                    >
                      Range
                    </Button>
                    <Button
                      size="sm"
                      variant={inlineSandwichMode === 'types' ? 'default' : 'outline'}
                      onClick={() => setInlineSandwichMode('types')}
                      className="h-7"
                    >
                      By Type
                    </Button>
                  </div>

                  {inlineSandwichMode === 'total' && (
                    <Input
                      type="number"
                      value={inlineTotalCount}
                      onChange={(e) => setInlineTotalCount(parseInt(e.target.value) || 0)}
                      placeholder="Total count"
                      className="bg-white text-gray-900"
                    />
                  )}

                  {inlineSandwichMode === 'range' && (
                    <div className="space-y-2">
                      <div className="flex gap-2">
                        <Input
                          type="number"
                          value={inlineRangeMin}
                          onChange={(e) => setInlineRangeMin(parseInt(e.target.value) || 0)}
                          placeholder="Min"
                          className="w-24 bg-white text-gray-900"
                        />
                        <span className="text-white self-center">to</span>
                        <Input
                          type="number"
                          value={inlineRangeMax}
                          onChange={(e) => setInlineRangeMax(parseInt(e.target.value) || 0)}
                          placeholder="Max"
                          className="w-24 bg-white text-gray-900"
                        />
                      </div>
                      <Select value={inlineRangeType || undefined} onValueChange={setInlineRangeType}>
                        <SelectTrigger className="bg-white text-gray-900">
                          <SelectValue placeholder="Type (optional)" />
                        </SelectTrigger>
                        <SelectContent>
                          {SANDWICH_TYPES.map((type) => (
                            <SelectItem key={type.value} value={type.value}>
                              {type.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {inlineSandwichMode === 'types' && (
                    <div className="space-y-2">
                      {inlineSandwichTypes.map((item, index) => (
                        <div key={index} className="flex gap-2">
                          <Select
                            value={item.type}
                            onValueChange={(value) => updateInlineSandwichType(index, 'type', value)}
                          >
                            <SelectTrigger className="bg-white text-gray-900">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {SANDWICH_TYPES.map((type) => (
                                <SelectItem key={type.value} value={type.value}>
                                  {type.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Input
                            type="number"
                            value={item.quantity}
                            onChange={(e) => updateInlineSandwichType(index, 'quantity', parseInt(e.target.value) || 0)}
                            className="w-20 bg-white text-gray-900"
                          />
                          <Button size="sm" variant="ghost" onClick={() => removeInlineSandwichType(index)} className="text-white" aria-label="Remove sandwich type">
                            <X className="w-3 h-3" aria-hidden="true" />
                          </Button>
                        </div>
                      ))}
                      <Button size="sm" onClick={addInlineSandwichType} variant="outline" className="w-full">
                        + Add Type
                      </Button>
                    </div>
                  )}

                  <div className="flex gap-2 pt-2">
                    <Button size="sm" onClick={saveEdit} disabled={isSaving} className="bg-[#007E8C]">
                      {isSaving ? (
                        <>
                          <Loader2 className="w-3 h-3 mr-1 animate-spin" /> Saving...
                        </>
                      ) : (
                        <>
                          <Save className="w-3 h-3 mr-1" /> Save
                        </>
                      )}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={cancelEdit} className="text-white hover:bg-white/20">
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex-1 group flex items-center gap-2">
                  <span className="text-base font-bold text-[#FBAD3F]">{sandwichInfo}</span>
                  {canEdit && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => startEditing('sandwichTypes', '')}
                      className="opacity-0 group-hover:opacity-100 text-white hover:bg-white/20 h-6 px-2"
                      aria-label="Edit sandwich types"
                    >
                      <Edit2 className="w-3 h-3" aria-hidden="true" />
                    </Button>
                  )}
                </div>
              )}
            </div>

            {/* Attendance */}
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 shrink-0" />
              {isEditingThisCard && editingField === 'estimatedAttendance' ? (
                <div className="flex items-center gap-2 flex-1">
                  <Input
                    type="number"
                    value={editingValue}
                    onChange={(e) => setEditingValue(e.target.value)}
                    className="h-8 w-24 bg-white text-gray-900"
                    placeholder="Attendance"
                  />
                  <Button size="sm" onClick={saveEdit} className="bg-[#007E8C] hover:bg-[#007E8C]/90" aria-label="Save">
                    <Save className="w-3 h-3" aria-hidden="true" />
                  </Button>
                  <Button size="sm" variant="ghost" onClick={cancelEdit} className="text-white hover:bg-white/20" aria-label="Cancel">
                    <X className="w-3 h-3" aria-hidden="true" />
                  </Button>
                </div>
              ) : (
                <div className="flex items-center gap-2 flex-1 group cursor-pointer" onClick={() => canEdit && startEditing('estimatedAttendance', request.estimatedAttendance?.toString() || '')}>
                  <span className="text-base font-semibold">
                    {request.estimatedAttendance ? `${request.estimatedAttendance} people expected` : 'No attendance set'}
                  </span>
                  {canEdit && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={(e) => { e.stopPropagation(); startEditing('estimatedAttendance', request.estimatedAttendance?.toString() || ''); }}
                      className="opacity-0 group-hover:opacity-100 text-white hover:bg-white/20 h-6 px-2"
                      aria-label="Edit attendance"
                    >
                      <Edit2 className="w-3 h-3" aria-hidden="true" />
                    </Button>
                  )}
                </div>
              )}
            </div>
            </div>

            {/* Team Assignments - Below Event Details in same column */}
            <div className="bg-[#236383]/5 rounded-lg p-4 border border-[#236383]/10">
              <h3 className="text-sm uppercase font-bold tracking-wide text-[#236383] mb-3 flex items-center gap-2">
                <Users className="w-4 h-4 text-[#236383]" aria-hidden="true" />
                Team Assignments
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Drivers */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    {isEditingThisCard && editingField === 'driversNeeded' ? (
                      <div className="flex items-center gap-2 flex-1">
                        <Car className="w-4 h-4 text-[#236383]" />
                        <Input
                          type="number"
                          value={editingValue}
                          onChange={(e) => setEditingValue(e.target.value)}
                          className="h-7 w-16 text-sm"
                          min="0"
                          placeholder="0"
                        />
                        <span className="text-sm text-[#236383]">needed</span>
                        <Button size="sm" onClick={saveEdit} className="h-6 px-2 bg-[#007E8C] text-white" aria-label="Save">
                          <Save className="w-3 h-3" aria-hidden="true" />
                        </Button>
                        <Button size="sm" variant="ghost" onClick={cancelEdit} className="h-6 px-2" aria-label="Cancel">
                          <X className="w-3 h-3" aria-hidden="true" />
                        </Button>
                      </div>
                    ) : (
                      <>
                        <span className="text-base font-bold text-gray-900 flex items-center gap-1">
                          <Car className="w-5 h-5" />
                          {driverNeeded > 0 ? `Drivers (${driverAssigned}/${driverNeeded})` : 'Drivers'}
                        </span>
                        {canEdit && driverNeeded > 0 && (
                          <Button size="sm" onClick={() => openAssignmentDialog('driver')} className="h-7 bg-[#007E8C] text-white" aria-label="Add driver">
                            <UserPlus className="w-3 h-3" aria-hidden="true" />
                          </Button>
                        )}
                      </>
                    )}
                  </div>
                  <div className="space-y-1">
                    {driverNeeded > 0 ? (
                      <>
                        {parsePostgresArray(request.assignedDriverIds).map((id) => (
                          <div key={id} className="flex items-center justify-between bg-[#47B3CB]/10 rounded px-3 py-1.5">
                            <span className="text-base">{extractCustomName(id) || resolveUserName(id)}</span>
                            <div className="flex items-center gap-1">
                              <SendKudosButton
                                recipientId={id}
                                recipientName={extractCustomName(id) || resolveUserName(id)}
                                contextType="project"
                                contextId={request.id.toString()}
                                contextTitle={`${request.organizationName} event`}
                                size="sm"
                                variant="outline"
                                iconOnly
                              />
                              {canEdit && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => handleRemoveAssignment('driver', id)}
                                  className="h-5 w-5 p-0 text-red-600"
                                >
                                  <X className="w-3 h-3" />
                                </Button>
                              )}
                            </div>
                          </div>
                        ))}
                        {driverAssigned === 0 && <div className="text-base text-gray-600 italic">None assigned</div>}
                      </>
                    ) : (
                      <div className="flex items-center justify-between bg-[#47B3CB]/10 rounded px-3 py-1.5">
                        <span className="text-base text-gray-600 italic">No drivers needed</span>
                        {canEdit && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => startEditing('driversNeeded', '1')}
                            className="h-6 px-2 text-[#007E8C]"
                          >
                            <Edit2 className="w-3 h-3 mr-1" />
                            Set Need
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Speakers */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    {isEditingThisCard && editingField === 'speakersNeeded' ? (
                      <div className="flex items-center gap-2 flex-1">
                        <Megaphone className="w-4 h-4 text-[#236383]" />
                        <Input
                          type="number"
                          value={editingValue}
                          onChange={(e) => setEditingValue(e.target.value)}
                          className="h-7 w-16 text-sm"
                          min="0"
                          placeholder="0"
                        />
                        <span className="text-sm text-[#236383]">needed</span>
                        <Button size="sm" onClick={saveEdit} className="h-6 px-2 bg-[#007E8C] text-white" aria-label="Save">
                          <Save className="w-3 h-3" aria-hidden="true" />
                        </Button>
                        <Button size="sm" variant="ghost" onClick={cancelEdit} className="h-6 px-2" aria-label="Cancel">
                          <X className="w-3 h-3" aria-hidden="true" />
                        </Button>
                      </div>
                    ) : (
                      <>
                        <span className="text-base font-bold text-gray-900 flex items-center gap-1">
                          <Megaphone className="w-5 h-5" />
                          {speakerNeeded > 0 ? `Speakers (${speakerAssigned}/${speakerNeeded})` : 'Speakers'}
                        </span>
                        {canEdit && speakerNeeded > 0 && (
                          <Button size="sm" onClick={() => openAssignmentDialog('speaker')} className="h-7 bg-[#007E8C] text-white" aria-label="Add speaker">
                            <UserPlus className="w-3 h-3" aria-hidden="true" />
                          </Button>
                        )}
                      </>
                    )}
                  </div>
                  <div className="space-y-1">
                    {speakerNeeded > 0 ? (
                      <>
                        {Object.keys(request.speakerDetails || {}).map((id) => {
                          const detailName = (request.speakerDetails as any)?.[id]?.name;
                          const displayName = (detailName && !/^\d+$/.test(detailName)) ? detailName : (extractCustomName(id) || resolveUserName(id));
                          return (
                            <div key={id} className="flex items-center justify-between bg-[#47B3CB]/10 rounded px-3 py-1.5">
                              <span className="text-base">{displayName}</span>
                              <div className="flex items-center gap-1">
                                <SendKudosButton
                                  recipientId={id}
                                  recipientName={displayName}
                                  contextType="project"
                                  contextId={request.id.toString()}
                                  contextTitle={`${request.organizationName} event`}
                                  size="sm"
                                  variant="outline"
                                  iconOnly
                                />
                                {canEdit && (
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => handleRemoveAssignment('speaker', id)}
                                    className="h-5 w-5 p-0 text-red-600"
                                  >
                                    <X className="w-3 h-3" />
                                  </Button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                        {speakerAssigned === 0 && <div className="text-base text-gray-600 italic">None assigned</div>}
                      </>
                    ) : (
                      <div className="flex items-center justify-between bg-[#47B3CB]/10 rounded px-3 py-1.5">
                        <span className="text-base text-gray-600 italic">No speakers needed</span>
                        {canEdit && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => startEditing('speakersNeeded', '1')}
                            className="h-6 px-2 text-[#007E8C]"
                          >
                            <Edit2 className="w-3 h-3 mr-1" />
                            Set Need
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Volunteers */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    {isEditingThisCard && editingField === 'volunteersNeeded' ? (
                      <div className="flex items-center gap-2 flex-1">
                        <Users className="w-4 h-4 text-[#236383]" />
                        <Input
                          type="number"
                          value={editingValue}
                          onChange={(e) => setEditingValue(e.target.value)}
                          className="h-7 w-16 text-sm"
                          min="0"
                          placeholder="0"
                        />
                        <span className="text-sm text-[#236383]">needed</span>
                        <Button size="sm" onClick={saveEdit} className="h-6 px-2 bg-[#007E8C] text-white" aria-label="Save">
                          <Save className="w-3 h-3" aria-hidden="true" />
                        </Button>
                        <Button size="sm" variant="ghost" onClick={cancelEdit} className="h-6 px-2" aria-label="Cancel">
                          <X className="w-3 h-3" aria-hidden="true" />
                        </Button>
                      </div>
                    ) : (
                      <>
                        <span className="text-base font-bold text-gray-900 flex items-center gap-1">
                          <Users className="w-5 h-5" />
                          {volunteerNeeded > 0 ? `Volunteers (${volunteerAssigned}/${volunteerNeeded})` : 'Volunteers'}
                        </span>
                        {canEdit && volunteerNeeded > 0 && (
                          <Button size="sm" onClick={() => openAssignmentDialog('volunteer')} className="h-7 bg-[#007E8C] text-white" aria-label="Add volunteer">
                            <UserPlus className="w-3 h-3" aria-hidden="true" />
                          </Button>
                        )}
                      </>
                    )}
                  </div>
                  <div className="space-y-1">
                    {volunteerNeeded > 0 ? (
                      <>
                        {parsePostgresArray(request.assignedVolunteerIds).map((id) => (
                          <div key={id} className="flex items-center justify-between bg-[#47B3CB]/10 rounded px-3 py-1.5">
                            <span className="text-base">{extractCustomName(id) || resolveUserName(id)}</span>
                            <div className="flex items-center gap-1">
                              <SendKudosButton
                                recipientId={id}
                                recipientName={extractCustomName(id) || resolveUserName(id)}
                                contextType="project"
                                contextId={request.id.toString()}
                                contextTitle={`${request.organizationName} event`}
                                size="sm"
                                variant="outline"
                                iconOnly
                              />
                              {canEdit && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => handleRemoveAssignment('volunteer', id)}
                                  className="h-5 w-5 p-0 text-red-600"
                                >
                                  <X className="w-3 h-3" />
                                </Button>
                              )}
                            </div>
                          </div>
                        ))}
                        {volunteerAssigned === 0 && <div className="text-base text-gray-600 italic">None assigned</div>}
                      </>
                    ) : (
                      <div className="flex items-center justify-between bg-[#47B3CB]/10 rounded px-3 py-1.5">
                        <span className="text-base text-gray-600 italic">No volunteers needed</span>
                        {canEdit && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => startEditing('volunteersNeeded', '1')}
                            className="h-6 px-2 text-[#007E8C]"
                          >
                            <Edit2 className="w-3 h-3 mr-1" />
                            Set Need
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Contact & Logistics Column - Single column on right */}
          <div className="lg:col-span-1 space-y-4">
            {/* Contact Info */}
            <div className="bg-[#47B3CB]/5 rounded-lg p-4 border border-[#47B3CB]/10">
              <h3 className="text-sm uppercase font-bold tracking-wide text-[#236383] pb-2 mb-3 flex items-center gap-2">
                <Users className="w-4 h-4 text-[#47B3CB]" aria-hidden="true" />
                Event Organizer
              </h3>
              <div className="space-y-2 text-sm text-gray-900">
                {(request.firstName || request.lastName) && (
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4 shrink-0" />
                    <span className="text-base font-semibold">
                      {request.firstName} {request.lastName}
                    </span>
                  </div>
                )}
                {request.email && (
                  <div className="flex items-center gap-2">
                    <Mail className="w-4 h-4 shrink-0" />
                    <a href={`mailto:${request.email}`} className="hover:underline">
                      {request.email}
                    </a>
                  </div>
                )}
                {request.phone && (
                  <div className="flex items-center gap-2">
                    <Phone className="w-4 h-4 shrink-0" />
                    <a href={`tel:${request.phone}`} className="hover:underline">
                      {request.phone}
                    </a>
                  </div>
                )}
                {(request.tspContact || request.customTspContact) && (
                  <div className="flex items-center gap-2 pt-2 border-t border-white/30">
                    <UserPlus className="w-4 h-4 shrink-0" />
                    <span className="text-base font-semibold">TSP: {request.customTspContact || resolveUserName(request.tspContact || '')}</span>
                    {canEdit && (
                      <Button size="sm" variant="ghost" onClick={onEditTspContact} className="h-6 px-2 text-white hover:bg-white/20" aria-label="Edit TSP contact">
                        <Edit2 className="w-3 h-3" aria-hidden="true" />
                      </Button>
                    )}
                  </div>
                )}
                {!request.tspContact && !request.customTspContact && (
                  <Button
                    size="sm"
                    onClick={onAssignTspContact}
                    className="w-full bg-white/20 hover:bg-white/30 text-white mt-2"
                  >
                    <UserPlus className="w-4 h-4 mr-2" />
                    Assign TSP Contact
                  </Button>
                )}
              </div>
            </div>

            {/* Delivery Logistics */}
            <div className="bg-[#FBAD3F]/5 rounded-lg p-4 border border-[#FBAD3F]/10">
              <h3 className="text-sm uppercase font-bold tracking-wide text-[#236383] pb-2 mb-3 flex items-center gap-2">
                <Package className="w-4 h-4 text-[#FBAD3F]" aria-hidden="true" />
                Delivery Logistics
              </h3>
              <div className="space-y-2 text-sm text-gray-900">
                {/* Recipients - Inline Editable */}
                <div>
                  <div className="text-gray-600 text-xs uppercase mb-1 font-medium">Recipients</div>
                  {isEditingThisCard && editingField === 'assignedRecipientIds' ? (
                    <div className="space-y-2">
                      <MultiRecipientSelector
                        value={editingValue ? JSON.parse(editingValue) : []}
                        onChange={(ids) => setEditingValue(JSON.stringify(ids))}
                        placeholder="Select recipients..."
                      />
                      <div className="flex gap-2">
                        <Button size="sm" onClick={saveEdit} className="bg-white text-[#A31C41] hover:bg-white/90">
                          <Save className="w-3 h-3 mr-1" /> Save
                        </Button>
                        <Button size="sm" variant="ghost" onClick={cancelEdit} className="text-white hover:bg-white/20">
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div>
                      {request.assignedRecipientIds && request.assignedRecipientIds.length > 0 ? (
                        <div className="space-y-2">
                          <div className="flex flex-wrap gap-1">
                            {request.assignedRecipientIds.slice(0, 3).map((id, idx) => {
                              const recipientName = resolveRecipientName(id);
                              return (
                                <Badge key={idx} className="bg-white text-gray-900 border-gray-300">
                                  🏠 {recipientName}
                                </Badge>
                              );
                            })}
                            {request.assignedRecipientIds.length > 3 && (
                              <Badge className="bg-white/90 text-gray-700 border-gray-300">
                                +{request.assignedRecipientIds.length - 3} more
                              </Badge>
                            )}
                          </div>
                        </div>
                      ) : request.recipientsCount ? (
                        <Badge className="bg-white text-gray-900 border-gray-300">
                          🏠 Unknown Host ({request.recipientsCount})
                        </Badge>
                      ) : (
                        <div className="text-white/60 text-xs">No recipients assigned</div>
                      )}
                      {canEdit && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => startEditing('assignedRecipientIds', JSON.stringify(request.assignedRecipientIds || []))}
                          className="text-white hover:bg-white/20 h-6 px-2 mt-2"
                        >
                          <Edit2 className="w-3 h-3 mr-1" /> Edit Recipients
                        </Button>
                      )}
                    </div>
                  )}
                </div>

                {/* Overnight Holding - Inline Editable */}
                <div className="pt-2 border-t border-gray-200">
                  <div className="text-gray-600 text-xs uppercase mb-1 font-medium">Overnight Holding</div>
                  {isEditingThisCard && editingField === 'overnightHoldingLocation' ? (
                    <div className="flex flex-col gap-2">
                      <Input
                        value={editingValue}
                        onChange={(e) => setEditingValue(e.target.value)}
                        className="bg-white text-gray-900"
                        placeholder="Overnight holding location"
                      />
                      <div className="flex gap-2">
                        <Button size="sm" onClick={saveEdit} className="bg-white text-[#A31C41] hover:bg-white/90">
                          <Save className="w-3 h-3 mr-1" /> Save
                        </Button>
                        <Button size="sm" variant="ghost" onClick={cancelEdit} className="text-white hover:bg-white/20">
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <div className="text-base font-semibold">
                        {request.overnightHoldingLocation || 'Not set'}
                      </div>
                      {canEdit && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => startEditing('overnightHoldingLocation', request.overnightHoldingLocation || '')}
                          className="text-white hover:bg-white/20 h-6 px-2 mt-1"
                        >
                          <Edit2 className="w-3 h-3 mr-1" /> Edit
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Notes & Requirements Section */}
        {(request.message ||
          request.planningNotes ||
          request.schedulingNotes ||
          request.additionalRequirements ||
          request.volunteerNotes ||
          request.driverNotes ||
          request.vanDriverNotes ||
          request.followUpNotes ||
          request.distributionNotes ||
          request.duplicateNotes ||
          request.unresponsiveNotes ||
          request.socialMediaPostNotes) && (
          <div className="bg-amber-50 rounded-lg p-4 mb-4">
            <h3 className="text-sm uppercase font-bold tracking-wide text-[#236383] mb-3 flex items-center gap-2">
              <FileText className="w-4 h-4" />
              Notes & Requirements
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {request.message && (
                <div className="sm:col-span-2">
                  <p className="text-sm font-medium mb-1 text-gray-900">Original Request Message:</p>
                  <p className="text-sm text-gray-700 bg-white p-3 rounded border-l-4 border-blue-400 whitespace-pre-wrap">
                    {request.message}
                  </p>
                </div>
              )}
              {request.additionalRequirements && (
                <div>
                  <p className="text-sm font-medium mb-1 text-gray-900">Special Requirements:</p>
                  <p className="text-sm text-gray-700 bg-white p-3 rounded border-l-4 border-orange-400 whitespace-pre-wrap">
                    {request.additionalRequirements}
                  </p>
                </div>
              )}
              {request.planningNotes && (
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-sm font-medium text-gray-900">Planning Notes:</p>
                    {canEdit && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => startEditing('planningNotes', request.planningNotes || '')}
                        className="h-6 px-2"
                        aria-label="Edit planning notes"
                      >
                        <Edit2 className="w-3 h-3" aria-hidden="true" />
                      </Button>
                    )}
                  </div>
                  {isEditingThisCard && editingField === 'planningNotes' ? (
                    <div className="space-y-2">
                      <textarea
                        value={editingValue}
                        onChange={(e) => setEditingValue(e.target.value)}
                        className="w-full p-3 border border-gray-300 rounded text-sm min-h-[100px] text-gray-900 bg-white"
                        placeholder="Add planning notes..."
                        autoFocus
                      />
                      <div className="flex gap-2">
                        <Button size="sm" onClick={saveEdit}>
                          <Save className="w-3 h-3 mr-1" />
                          Save
                        </Button>
                        <Button size="sm" variant="ghost" onClick={cancelEdit}>
                          <X className="w-3 h-3 mr-1" />
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-gray-700 bg-white p-3 rounded border border-gray-200 whitespace-pre-wrap">
                      {request.planningNotes}
                    </p>
                  )}
                </div>
              )}
              {request.schedulingNotes && (
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-sm font-medium text-gray-900">Scheduling Notes:</p>
                    {canEdit && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => startEditing('schedulingNotes', request.schedulingNotes || '')}
                        className="h-6 px-2"
                        aria-label="Edit scheduling notes"
                      >
                        <Edit2 className="w-3 h-3" aria-hidden="true" />
                      </Button>
                    )}
                  </div>
                  {isEditingThisCard && editingField === 'schedulingNotes' ? (
                    <div className="space-y-2">
                      <textarea
                        value={editingValue}
                        onChange={(e) => setEditingValue(e.target.value)}
                        className="w-full p-3 border border-gray-300 rounded text-sm min-h-[100px] text-gray-900 bg-white"
                        placeholder="Add scheduling notes..."
                        autoFocus
                      />
                      <div className="flex gap-2">
                        <Button size="sm" onClick={saveEdit}>
                          <Save className="w-3 h-3 mr-1" />
                          Save
                        </Button>
                        <Button size="sm" variant="ghost" onClick={cancelEdit}>
                          <X className="w-3 h-3 mr-1" />
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-gray-700 bg-white p-3 rounded border-l-4 border-green-400 whitespace-pre-wrap">
                      {request.schedulingNotes}
                    </p>
                  )}
                </div>
              )}
              {request.volunteerNotes && (
                <div>
                  <p className="text-sm font-medium mb-1 text-gray-900">Volunteer Notes:</p>
                  <p className="text-sm text-gray-700 bg-white p-3 rounded border-l-4 border-purple-400 whitespace-pre-wrap">
                    {request.volunteerNotes}
                  </p>
                </div>
              )}
              {request.driverNotes && (
                <div>
                  <p className="text-sm font-medium mb-1 text-gray-900">Driver Notes:</p>
                  <p className="text-sm text-gray-700 bg-white p-3 rounded border-l-4 border-blue-400 whitespace-pre-wrap">
                    {request.driverNotes}
                  </p>
                </div>
              )}
              {request.vanDriverNotes && (
                <div>
                  <p className="text-sm font-medium mb-1 text-gray-900">Van Driver Notes:</p>
                  <p className="text-sm text-gray-700 bg-white p-3 rounded border-l-4 border-red-400 whitespace-pre-wrap">
                    {request.vanDriverNotes}
                  </p>
                </div>
              )}
              {request.followUpNotes && (
                <div>
                  <p className="text-sm font-medium mb-1 text-gray-900">Follow-up Notes:</p>
                  <p className="text-sm text-gray-700 bg-white p-3 rounded border-l-4 border-yellow-400 whitespace-pre-wrap">
                    {request.followUpNotes}
                  </p>
                </div>
              )}
              {request.distributionNotes && (
                <div>
                  <p className="text-sm font-medium mb-1 text-gray-900">Distribution Notes:</p>
                  <p className="text-sm text-gray-700 bg-white p-3 rounded border-l-4 border-teal-400 whitespace-pre-wrap">
                    {request.distributionNotes}
                  </p>
                </div>
              )}
              {request.duplicateNotes && (
                <div>
                  <p className="text-sm font-medium mb-1 text-gray-900">Duplicate Check Notes:</p>
                  <p className="text-sm text-gray-700 bg-white p-3 rounded border-l-4 border-pink-400">
                    {request.duplicateNotes}
                  </p>
                </div>
              )}
              {request.unresponsiveNotes && (
                <div>
                  <p className="text-sm font-medium mb-1 text-gray-900">Contact Attempts Logged:</p>
                  <p className="text-sm text-gray-700 bg-white p-3 rounded border-l-4 border-gray-400">
                    {request.unresponsiveNotes}
                  </p>
                </div>
              )}
              {request.socialMediaPostNotes && (
                <div>
                  <p className="text-sm font-medium mb-1 text-gray-900">Social Media Notes:</p>
                  <p className="text-sm text-gray-700 bg-white p-3 rounded border-l-4 border-indigo-400">
                    {request.socialMediaPostNotes}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Action Buttons Row */}
        <div className="flex flex-wrap gap-2 mb-4 pt-4 border-t-2 border-[#007E8C]/10">
          <Button
            onClick={onContact}
            className="bg-[#007E8C] text-white hover:bg-[#007E8C]/90"
          >
            <Mail className="w-4 h-4 mr-2" />
            Contact Organizer
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={onLogContact}
            className="border-[#236383]/30 text-[#236383] hover:bg-[#236383]/10"
          >
            <MessageSquare className="w-4 h-4 mr-1" />
            Log Contact
          </Button>
          <Button size="sm" variant="outline" onClick={onReschedule} className="border-[#236383]/30 text-[#236383] hover:bg-[#236383]/10">
            Reschedule
          </Button>
          <Button size="sm" onClick={onFollowUp} className="bg-[#236383] text-white hover:bg-[#236383]/90">
            Follow Up
          </Button>

          {!(request.tspContact || request.customTspContact) && (
            <Button
              size="sm"
              variant="outline"
              onClick={onAssignTspContact}
              className="border-[#FBAD3F]/30 text-[#FBAD3F] hover:bg-[#FBAD3F]/10"
            >
              <UserPlus className="w-4 h-4 mr-1" />
              Assign TSP Contact
            </Button>
          )}
        </div>

        {/* Activity History Toggle */}
        <div className="border-t-2 border-[#007E8C]/10 pt-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowAuditLog(!showAuditLog)}
            className="w-full justify-between text-[#236383] hover:text-[#236383] hover:bg-[#007E8C]/5 font-medium"
          >
            <div className="flex items-center gap-2">
              <History className="w-4 h-4" aria-hidden="true" />
              Activity History
            </div>
            {showAuditLog ? <ChevronUp className="w-4 h-4" aria-hidden="true" /> : <ChevronDown className="w-4 h-4" aria-hidden="true" />}
          </Button>
        </div>

        {showAuditLog && (
          <div className="mt-4 pt-4 border-t-2 border-[#007E8C]/10">
            <EventRequestAuditLog
              eventId={request.id?.toString()}
              showFilters={false}
              compact={true}
            />
          </div>
        )}
      </CardContent>

      {/* Message Composer Dialog */}
      <Dialog open={showMessageDialog} onOpenChange={setShowMessageDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Message About Event: {request.organizationName}</DialogTitle>
          </DialogHeader>
          <MessageComposer
            contextType="event"
            contextId={request.id.toString()}
            contextTitle={`${request.organizationName} event on ${formatEventDate(request.scheduledDate)}`}
            onSent={() => setShowMessageDialog(false)}
            onCancel={() => setShowMessageDialog(false)}
          />
        </DialogContent>
      </Dialog>
    </Card>
  );
};
