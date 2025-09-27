import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
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
  MessageSquare,
  Building,
  AlertTriangle,
  Car,
  Megaphone,
  UserPlus,
  Check,
  Phone,
  Mail,
  FileText,
} from 'lucide-react';
import {
  formatTime12Hour,
  formatTimeForInput,
  formatEventDate,
} from '@/components/event-requests/utils';
import { DateTimePicker } from '@/components/ui/datetime-picker';
import {
  SANDWICH_TYPES,
  statusColors,
  statusIcons,
  statusOptions,
} from '@/components/event-requests/constants';
import {
  parseSandwichTypes,
  formatSandwichTypesDisplay,
} from '@/lib/sandwich-utils';
import type { EventRequest } from '@shared/schema';
import { ConfirmationDialog } from '@/components/ui/confirmation-dialog';
import { RecipientSelector } from '@/components/ui/recipient-selector';

interface TimeDialogContentProps {
  request: EventRequest;
  startEditing: (field: string, value: string) => void;
  saveEdit: () => void;
  cancelEdit: () => void;
}

const TimeDialogContent: React.FC<TimeDialogContentProps> = ({
  request,
  startEditing,
  saveEdit,
  cancelEdit,
}) => {
  const [tempStartTime, setTempStartTime] = React.useState(
    request.eventStartTime || ''
  );
  const [tempEndTime, setTempEndTime] = React.useState(
    request.eventEndTime || ''
  );
  const [tempPickupDateTime, setTempPickupDateTime] = React.useState(
    request.pickupDateTime?.toString() || ''
  );

  const handleSave = () => {
    if (tempStartTime && !request.eventStartTime) {
      startEditing('eventStartTime', tempStartTime);
    }
    if (tempEndTime && !request.eventEndTime) {
      startEditing('eventEndTime', tempEndTime);
    }
    if (tempPickupDateTime && !request.pickupDateTime) {
      startEditing('pickupDateTime', tempPickupDateTime);
    }
    saveEdit();
  };

  const hasChanges = () => {
    return (
      (tempStartTime && !request.eventStartTime) ||
      (tempEndTime && !request.eventEndTime) ||
      (tempPickupDateTime && !request.pickupDateTime && !request.pickupTime)
    );
  };

  return (
    <div className="space-y-4">
      {!request.eventStartTime && (
        <div className="space-y-2">
          <label className="text-sm font-medium">Event Start Time</label>
          <Input
            type="time"
            value={tempStartTime}
            onChange={(e) => setTempStartTime(e.target.value)}
            className="w-full"
            placeholder="Select start time"
          />
        </div>
      )}
      {!request.eventEndTime && (
        <div className="space-y-2">
          <label className="text-sm font-medium">Event End Time</label>
          <Input
            type="time"
            value={tempEndTime}
            onChange={(e) => setTempEndTime(e.target.value)}
            className="w-full"
            placeholder="Select end time"
          />
        </div>
      )}
      {!request.pickupDateTime && !request.pickupTime && (
        <div className="space-y-2">
          <label className="text-sm font-medium">Pickup Date & Time</label>
          <DateTimePicker
            value={tempPickupDateTime}
            onChange={setTempPickupDateTime}
            placeholder="Select pickup date and time"
            defaultToEventDate={
              request.scheduledEventDate?.toString() ||
              request.desiredEventDate?.toString()
            }
            className="w-full"
            data-testid="pickup-datetime-picker"
          />
        </div>
      )}
      <div className="flex justify-end gap-2 pt-4">
        <Button variant="outline" onClick={cancelEdit}>
          Cancel
        </Button>
        <Button onClick={handleSave} disabled={!hasChanges()}>
          Save Times
        </Button>
      </div>
    </div>
  );
};

interface ScheduledCardProps {
  request: EventRequest;

  // Inline editing state
  editingField: string | null;
  editingValue: string;
  isEditingThisCard: boolean;
  inlineSandwichMode: 'total' | 'types';
  inlineTotalCount: number;
  inlineSandwichTypes: Array<{ type: string; quantity: number }>;

  // Actions
  onEdit: () => void;
  onDelete: () => void;
  onContact: () => void;
  onStatusChange: (status: string) => void;
  onFollowUp: () => void;
  onReschedule: () => void;
  onAssignTspContact: () => void;
  onEditTspContact: () => void;

  // Inline editing actions
  startEditing: (field: string, value: string) => void;
  saveEdit: () => void;
  cancelEdit: () => void;
  setEditingValue: (value: string) => void;
  setInlineSandwichMode: (mode: 'total' | 'types') => void;
  setInlineTotalCount: (count: number) => void;
  addInlineSandwichType: () => void;
  updateInlineSandwichType: (
    index: number,
    field: 'type' | 'quantity',
    value: string | number
  ) => void;
  removeInlineSandwichType: (index: number) => void;

  // Assignment actions
  resolveUserName: (id: string) => string;
  openAssignmentDialog: (type: 'driver' | 'speaker' | 'volunteer') => void;
  openEditAssignmentDialog: (
    type: 'driver' | 'speaker' | 'volunteer',
    personId: string
  ) => void;
  handleRemoveAssignment: (
    type: 'driver' | 'speaker' | 'volunteer',
    personId: string
  ) => void;
  handleSelfSignup: (type: 'driver' | 'speaker' | 'volunteer') => void;
  canSelfSignup: (
    request: EventRequest,
    type: 'driver' | 'speaker' | 'volunteer'
  ) => boolean;
  isUserSignedUp: (
    request: EventRequest,
    type: 'driver' | 'speaker' | 'volunteer'
  ) => boolean;

  canEdit?: boolean;
}

export const ScheduledCard: React.FC<ScheduledCardProps> = ({
  request,
  editingField,
  editingValue,
  isEditingThisCard,
  inlineSandwichMode,
  inlineTotalCount,
  inlineSandwichTypes,
  onEdit,
  onDelete,
  onContact,
  onStatusChange,
  onFollowUp,
  onReschedule,
  onAssignTspContact,
  onEditTspContact,
  startEditing,
  saveEdit,
  cancelEdit,
  setEditingValue,
  setInlineSandwichMode,
  setInlineTotalCount,
  addInlineSandwichType,
  updateInlineSandwichType,
  removeInlineSandwichType,
  resolveUserName,
  openAssignmentDialog,
  openEditAssignmentDialog,
  handleRemoveAssignment,
  handleSelfSignup,
  canSelfSignup,
  isUserSignedUp,
  canEdit = true,
}) => {
  // Helper functions
  const parsePostgresArray = (arr: any): string[] => {
    if (!arr) return [];
    if (Array.isArray(arr)) return arr;
    if (typeof arr === 'string') {
      if (arr === '{}' || arr === '') return [];
      let cleaned = arr.replace(/^{|}$/g, '');
      if (!cleaned) return [];
      if (cleaned.includes('"')) {
        const matches = cleaned.match(/"[^"]*"|[^",]+/g);
        return matches
          ? matches
              .map((item) => item.replace(/"/g, '').trim())
              .filter((item) => item)
          : [];
      }
      return cleaned
        .split(',')
        .map((item) => item.trim())
        .filter((item) => item);
    }
    return [];
  };

  const StatusIcon =
    statusIcons[request.status as keyof typeof statusIcons] || statusIcons.new;

  // Helper function to extract name from custom entries
  const extractCustomName = (id: string): string => {
    if (!id || typeof id !== 'string') {
      return 'Unknown';
    }

    if (id.startsWith('custom-')) {
      const parts = id.split('-');
      if (parts.length >= 3) {
        // Extract name parts (everything after "custom-" and the timestamp)
        const nameParts = parts.slice(2);
        const cleanName = nameParts.join('-').replace(/-/g, ' ');

        // Return the cleaned name, or fallback if empty
        return cleanName.trim() || 'Custom Volunteer';
      }
      // If custom ID doesn't have enough parts, return a fallback
      return 'Custom Volunteer';
    }

    // For non-custom IDs, return as-is
    return id;
  };

  // Calculate staffing status
  const driverAssigned =
    parsePostgresArray(request.assignedDriverIds).length +
    (request.assignedVanDriverId ? 1 : 0);
  const speakerAssigned = Object.keys(request.speakerDetails || {}).length;
  const volunteerAssigned = parsePostgresArray(
    request.assignedVolunteerIds
  ).length;

  const driverNeeded = request.driversNeeded || 0;
  const speakerNeeded = request.speakersNeeded || 0;
  const volunteerNeeded = request.volunteersNeeded || 0;

  const totalAssigned = driverAssigned + speakerAssigned + volunteerAssigned;
  const totalNeeded = driverNeeded + speakerNeeded + volunteerNeeded;
  const staffingComplete = totalAssigned >= totalNeeded && totalNeeded > 0;

  // Get display date
  const displayDate = request.scheduledEventDate || request.desiredEventDate;
  const dateInfo = displayDate ? formatEventDate(displayDate.toString()) : null;

  // Get status label
  const getStatusLabel = (status: string) => {
    const statusOption = statusOptions.find(
      (option) => option.value === status
    );
    return statusOption ? statusOption.label : status.replace('_', ' ');
  };

  // Format date for input
  const formatDateForInput = (dateStr: string) => {
    if (!dateStr) return '';
    return dateStr.split('T')[0];
  };

  // Determine date field to edit
  let dateFieldToEdit = 'desiredEventDate';
  let dateLabel = 'Requested Date';
  if (request.scheduledEventDate) {
    dateFieldToEdit = 'scheduledEventDate';
    dateLabel =
      request.status === 'completed' ? 'Event Date' : 'Scheduled Date';
  }

  const renderEditableField = (
    field: string,
    value: any,
    label: string,
    type: 'text' | 'time' | 'number' | 'select' = 'text',
    options?: { value: string; label: string }[]
  ) => {
    const isEditing = isEditingThisCard && editingField === field;

    if (isEditing) {
      if (type === 'select' && options) {
        return (
          <div className="flex items-center gap-2">
            <Select value={editingValue} onValueChange={setEditingValue}>
              <SelectTrigger className="h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {options.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button size="sm" onClick={saveEdit}>
              <Save className="w-3 h-3" />
            </Button>
            <Button size="sm" variant="ghost" onClick={cancelEdit}>
              <X className="w-3 h-3" />
            </Button>
          </div>
        );
      }

      return (
        <div className="flex items-center gap-2">
          <Input
            type={type}
            value={editingValue}
            onChange={(e) => setEditingValue(e.target.value)}
            className="h-8 text-gray-900 bg-white"
            autoFocus
          />
          <Button size="sm" onClick={saveEdit}>
            <Save className="w-3 h-3" />
          </Button>
          <Button size="sm" variant="ghost" onClick={cancelEdit}>
            <X className="w-3 h-3" />
          </Button>
        </div>
      );
    }

    return (
      <div className="flex items-center gap-2 group">
        <span className="text-base font-medium text-gray-600">{label}:</span>
        <span className="text-base">
          {field === 'eventAddress' && value ? (
            <a
              href={`https://maps.google.com/maps?q=${encodeURIComponent(value)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:text-blue-800 hover:underline"
            >
              {value}
            </a>
          ) : (
            value || 'Not set'
          )}
        </span>
        {canEdit && (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              if (type === 'time') {
                const rawValue = request[field as keyof EventRequest] as string;
                startEditing(field, rawValue || '');
              } else {
                startEditing(field, value?.toString() || '');
              }
            }}
            className="h-6 px-2 opacity-0 group-hover:opacity-70 hover:opacity-100 transition-opacity"
          >
            <Edit2 className="w-3 h-3" />
          </Button>
        )}
      </div>
    );
  };

  const renderSandwichEdit = () => {
    if (!(isEditingThisCard && editingField === 'sandwichTypes')) {
      const sandwichInfo = formatSandwichTypesDisplay(
        request.sandwichTypes,
        request.estimatedSandwichCount ?? undefined
      );

      return (
        <div className="flex items-center gap-2 group">
          <Package className="w-4 h-4 text-amber-600" />
          <span className="text-base font-medium text-gray-600">
            Sandwiches:
          </span>
          <span className="text-base font-semibold">{sandwichInfo}</span>
          {canEdit && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => startEditing('sandwichTypes', '')}
              className="h-6 px-2 opacity-0 group-hover:opacity-70 hover:opacity-100 transition-opacity"
            >
              <Edit2 className="w-3 h-3" />
            </Button>
          )}
        </div>
      );
    }

    // Editing sandwich types
    return (
      <div className="space-y-3 p-3 bg-amber-50 rounded-lg">
        <div className="flex items-center justify-between">
          <span className="font-medium">Edit Sandwiches</span>
          <div className="flex gap-2">
            <Button size="sm" onClick={saveEdit}>
              <Save className="w-3 h-3 mr-1" /> Save
            </Button>
            <Button size="sm" variant="ghost" onClick={cancelEdit}>
              <X className="w-3 h-3" />
            </Button>
          </div>
        </div>

        <div className="flex gap-2">
          <Button
            size="sm"
            variant={inlineSandwichMode === 'total' ? 'default' : 'outline'}
            onClick={() => setInlineSandwichMode('total')}
          >
            Total Count
          </Button>
          <Button
            size="sm"
            variant={inlineSandwichMode === 'types' ? 'default' : 'outline'}
            onClick={() => setInlineSandwichMode('types')}
          >
            By Type
          </Button>
        </div>

        {inlineSandwichMode === 'total' ? (
          <Input
            type="number"
            value={inlineTotalCount}
            onChange={(e) => setInlineTotalCount(parseInt(e.target.value) || 0)}
            placeholder="Total sandwich count"
            className="text-gray-900 bg-white"
          />
        ) : (
          <div className="space-y-2">
            {inlineSandwichTypes.map((item, index) => (
              <div key={index} className="flex gap-2">
                <Select
                  value={item.type}
                  onValueChange={(value) =>
                    updateInlineSandwichType(index, 'type', value)
                  }
                >
                  <SelectTrigger>
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
                  onChange={(e) =>
                    updateInlineSandwichType(
                      index,
                      'quantity',
                      parseInt(e.target.value) || 0
                    )
                  }
                  placeholder="Qty"
                  className="w-24 text-gray-900 bg-white"
                />
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => removeInlineSandwichType(index)}
                >
                  <X className="w-3 h-3" />
                </Button>
              </div>
            ))}
            <Button size="sm" variant="outline" onClick={addInlineSandwichType}>
              Add Type
            </Button>
          </div>
        )}
      </div>
    );
  };

  return (
    <Card className="w-full transition-all duration-200 hover:shadow-lg bg-gradient-to-br from-[#fef3e2] via-[#FBAD3F]/60 to-[#FBAD3F]/40 border border-[#FBAD3F]/30 shadow-lg">
      <CardContent className="p-6">
        {/* Header with Organization and Status */}
        <div className="flex items-start justify-between mb-6">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-4">
              <h3 className="text-2xl font-bold text-[#236383] flex items-center gap-2">
                {request.organizationName}
                {request.department && (
                  <span className="text-lg font-normal text-[#646464]">
                    &bull; {request.department}
                  </span>
                )}
              </h3>
              <Badge className="bg-[#FBAD3F] text-white px-3 py-1 text-sm font-medium shadow-sm">
                <StatusIcon className="w-3 h-3 mr-1" />
                {getStatusLabel(request.status)}
              </Badge>
              {staffingComplete ? (
                <Badge className="bg-[#47B3CB] text-white px-2 py-1 text-xs shadow-sm">
                  <Check className="w-3 h-3 mr-1" />
                  Fully Staffed
                </Badge>
              ) : (
                <div className="flex gap-1">
                  {driverNeeded > driverAssigned && (
                    <Badge className="bg-[#A31C41] text-white px-2 py-1 text-xs shadow-sm">
                      {driverNeeded - driverAssigned} driver
                      {driverNeeded - driverAssigned > 1 ? 's' : ''} needed
                    </Badge>
                  )}
                  {speakerNeeded > speakerAssigned && (
                    <Badge className="bg-[#A31C41] text-white px-2 py-1 text-xs shadow-sm">
                      {speakerNeeded - speakerAssigned} speaker
                      {speakerNeeded - speakerAssigned > 1 ? 's' : ''} needed
                    </Badge>
                  )}
                  {volunteerNeeded > volunteerAssigned && (
                    <Badge className="bg-[#A31C41] text-white px-2 py-1 text-xs shadow-sm">
                      {volunteerNeeded - volunteerAssigned} volunteer
                      {volunteerNeeded - volunteerAssigned > 1 ? 's' : ''}{' '}
                      needed
                    </Badge>
                  )}
                </div>
              )}
            </div>

            {/* Key Information - Prominently Displayed */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              {/* Event Date - Most Important */}
              <div className="bg-[#236383] text-white rounded-lg p-4 shadow-md">
                <div className="flex items-center gap-2 mb-2">
                  <Calendar className="w-5 h-5" />
                  <span className="font-semibold text-sm uppercase tracking-wide">
                    Event Date
                  </span>
                </div>
                {isEditingThisCard && editingField === dateFieldToEdit ? (
                  <div className="flex items-center gap-2">
                    <Input
                      type="date"
                      value={formatDateForInput(editingValue)}
                      onChange={(e) => setEditingValue(e.target.value)}
                      className="h-8 w-full text-gray-900 bg-white"
                      autoFocus
                    />
                    <Button
                      size="sm"
                      onClick={saveEdit}
                      className="bg-[#FBAD3F] hover:bg-[#e89a2d]"
                    >
                      <Save className="w-3 h-3" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={cancelEdit}
                      className="text-white hover:bg-white/20"
                    >
                      <X className="w-3 h-3" />
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 group">
                    <span className="text-lg font-bold">
                      {displayDate && dateInfo ? dateInfo.text : 'No date set'}
                    </span>
                    {canEdit && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() =>
                          startEditing(
                            dateFieldToEdit,
                            formatDateForInput(displayDate?.toString() || '')
                          )
                        }
                        className="h-6 px-2 opacity-0 group-hover:opacity-70 hover:opacity-100 transition-opacity text-white hover:bg-white/20"
                      >
                        <Edit2 className="w-3 h-3" />
                      </Button>
                    )}
                  </div>
                )}
              </div>

              {/* Event Address - Google Maps Link */}
              {request.eventAddress && (
                <div className="bg-[#47B3CB] text-white rounded-lg p-4 shadow-md">
                  <div className="flex items-center gap-2 mb-2">
                    <MapPin className="w-5 h-5" />
                    <span className="font-semibold text-sm uppercase tracking-wide">
                      Location
                    </span>
                  </div>
                  <a
                    href={`https://maps.google.com/maps?q=${encodeURIComponent(request.eventAddress)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm font-medium hover:underline block truncate"
                    title={request.eventAddress}
                  >
                    {request.eventAddress}
                  </a>
                </div>
              )}

              {/* Sandwich Count - Prominent Display */}
              <div className="bg-[#FBAD3F] text-white rounded-lg p-4 shadow-md">
                <div className="flex items-center gap-2 mb-2">
                  <Package className="w-5 h-5" />
                  <span className="font-semibold text-sm uppercase tracking-wide">
                    Sandwiches
                  </span>
                </div>
                <div className="text-lg font-bold">
                  {formatSandwichTypesDisplay(
                    request.sandwichTypes,
                    request.estimatedSandwichCount ?? undefined
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          {canEdit && (
            <div className="flex gap-1">
              <Button
                size="sm"
                variant="ghost"
                onClick={onEdit}
                className="text-[#236383] hover:bg-[#236383]/10"
              >
                <Edit2 className="w-4 h-4" />
              </Button>
              <ConfirmationDialog
                trigger={
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-[#A31C41] hover:text-[#A31C41] hover:bg-[#A31C41]/10"
                    data-testid="button-delete-request"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                }
                title="Delete Scheduled Event"
                description={`Are you sure you want to delete the scheduled event from ${request.organizationName}? This will remove all scheduling and assignment data and cannot be undone.`}
                confirmText="Delete Event"
                cancelText="Cancel"
                onConfirm={onDelete}
                variant="destructive"
              />
            </div>
          )}
        </div>

        {/* Main Content */}
        <div className="space-y-4">
          {/* Three-column grid for Event Times, Sandwich Details, and Delivery Logistics */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Event Times */}
            <div className="bg-[#007E8C] text-white rounded-lg p-4 shadow-md">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4" />
                  <span className="font-semibold text-lg">Event Times</span>
                </div>
                {canEdit && (
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 text-sm border-white/60 text-white hover:bg-white hover:text-[#A31C41] font-semibold shadow-sm bg-[#47b3cb]"
                      >
                        Add
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-md">
                      <DialogHeader>
                        <DialogTitle>Add Event Times</DialogTitle>
                      </DialogHeader>
                      <TimeDialogContent
                        request={request}
                        startEditing={startEditing}
                        saveEdit={saveEdit}
                        cancelEdit={cancelEdit}
                      />
                    </DialogContent>
                  </Dialog>
                )}
              </div>
              <div className="space-y-2">
                {/* Times - only show if they exist */}
                {request.eventStartTime ||
                request.eventEndTime ||
                request.pickupTime ||
                request.pickupDateTime ? (
                  <div className="space-y-2">
                    {request.eventStartTime && (
                      <div className="flex items-center gap-1 group">
                        <span className="text-base font-medium">Start:</span>
                        <span className="text-base">
                          {formatTime12Hour(request.eventStartTime)}
                        </span>
                        {canEdit && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() =>
                              startEditing(
                                'eventStartTime',
                                formatTimeForInput(request.eventStartTime || '')
                              )
                            }
                            className="h-4 px-1 opacity-0 group-hover:opacity-70 hover:opacity-100 transition-opacity"
                          >
                            <Edit2 className="w-3 h-3" />
                          </Button>
                        )}
                      </div>
                    )}
                    {request.eventEndTime && (
                      <div className="flex items-center gap-1 group">
                        <span className="text-base font-medium">End:</span>
                        <span className="text-base">
                          {formatTime12Hour(request.eventEndTime)}
                        </span>
                        {canEdit && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() =>
                              startEditing(
                                'eventEndTime',
                                formatTimeForInput(request.eventEndTime || '')
                              )
                            }
                            className="h-4 px-1 opacity-0 group-hover:opacity-70 hover:opacity-100 transition-opacity"
                          >
                            <Edit2 className="w-3 h-3" />
                          </Button>
                        )}
                      </div>
                    )}
                    {(request.pickupDateTime || request.pickupTime) && (
                      <div className="flex items-center gap-1 group">
                        <span className="text-base font-medium">Pickup:</span>
                        <span className="text-base">
                          {request.pickupDateTime
                            ? (() => {
                                const date = new Date(request.pickupDateTime);
                                const dateStr = date.toLocaleDateString(
                                  'en-US',
                                  {
                                    month: 'short',
                                    day: 'numeric',
                                    year: 'numeric',
                                  }
                                );
                                const timeStr = formatTime12Hour(
                                  date.toTimeString().slice(0, 5)
                                );
                                return `${dateStr} at ${timeStr}`;
                              })()
                            : formatTime12Hour(request.pickupTime!)}
                        </span>
                        {canEdit && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              if (request.pickupDateTime) {
                                startEditing(
                                  'pickupDateTime',
                                  request.pickupDateTime.toString()
                                );
                              } else {
                                startEditing(
                                  'pickupTime',
                                  formatTimeForInput(request.pickupTime || '')
                                );
                              }
                            }}
                            className="h-4 px-1 opacity-0 group-hover:opacity-70 hover:opacity-100 transition-opacity"
                          >
                            <Edit2 className="w-3 h-3" />
                          </Button>
                        )}
                      </div>
                    )}

                    {/* Inline editing for times */}
                    {isEditingThisCard &&
                      (editingField === 'eventStartTime' ||
                        editingField === 'eventEndTime' ||
                        editingField === 'pickupTime') && (
                        <div className="flex items-center gap-2 mt-2">
                          <Input
                            type="time"
                            value={editingValue}
                            onChange={(e) => setEditingValue(e.target.value)}
                            className="h-8 w-32 text-gray-900 bg-white"
                            autoFocus
                          />
                          <Button size="sm" onClick={saveEdit}>
                            <Save className="w-3 h-3" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={cancelEdit}
                          >
                            <X className="w-3 h-3" />
                          </Button>
                        </div>
                      )}
                    {/* Inline editing for pickup datetime */}
                    {isEditingThisCard && editingField === 'pickupDateTime' && (
                      <div className="mt-2">
                        <DateTimePicker
                          value={editingValue}
                          onChange={setEditingValue}
                          placeholder="Select pickup date and time"
                          defaultToEventDate={
                            request.scheduledEventDate?.toString() ||
                            request.desiredEventDate?.toString()
                          }
                          className="w-full"
                          data-testid="inline-pickup-datetime-picker"
                        />
                        <div className="flex items-center gap-2 mt-2">
                          <Button size="sm" onClick={saveEdit}>
                            <Save className="w-3 h-3" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={cancelEdit}
                          >
                            <X className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-base italic">
                    No times set yet. Click "Add Times" to add event times.
                  </div>
                )}
              </div>
            </div>

            {/* Sandwich Information */}
            <div className="bg-[#FBAD3F] text-white rounded-lg p-4 shadow-md">
              <div className="flex items-center gap-2 mb-3">
                <Package className="w-4 h-4" />
                <span className="font-semibold text-lg">Sandwich Details</span>
              </div>
              <div className="space-y-2">{renderSandwichEdit()}</div>
            </div>

            {/* Delivery Logistics */}
            <div className="bg-[#47B3CB] text-white rounded-lg p-4 shadow-md">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Package className="w-4 h-4" />
                  <span className="font-semibold text-lg">
                    Delivery Logistics
                  </span>
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-base font-medium">
                    Overnight Holding:
                  </span>
                  {isEditingThisCard &&
                  editingField === 'overnightHoldingLocation' ? (
                    <div className="flex items-center gap-2">
                      <Input
                        type="text"
                        value={editingValue}
                        onChange={(e) => setEditingValue(e.target.value)}
                        className="h-8 w-48 text-gray-900 bg-white"
                        autoFocus
                      />
                      <Button size="sm" onClick={saveEdit}>
                        <Save className="w-3 h-3" />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={cancelEdit}>
                        <X className="w-3 h-3" />
                      </Button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1 group">
                      <span className="text-base">
                        {request.overnightHoldingLocation || 'Not specified'}
                      </span>
                      {canEdit && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() =>
                            startEditing(
                              'overnightHoldingLocation',
                              request.overnightHoldingLocation || ''
                            )
                          }
                          className="h-4 px-1 opacity-0 group-hover:opacity-70 hover:opacity-100 transition-opacity"
                        >
                          <Edit2 className="w-3 h-3" />
                        </Button>
                      )}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">Recipients:</span>
                  {isEditingThisCard &&
                  editingField === 'deliveryDestination' ? (
                    <RecipientSelector
                      value={editingValue}
                      onChange={setEditingValue}
                      isInlineEditing={true}
                      onSave={saveEdit}
                      onCancel={cancelEdit}
                      autoFocus={true}
                      data-testid="delivery-destination-editor"
                    />
                  ) : (
                    <div className="flex items-center gap-1 group">
                      <span className="text-base">
                        {request.deliveryDestination || 'Not specified'}
                      </span>
                      {canEdit && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() =>
                            startEditing(
                              'deliveryDestination',
                              request.deliveryDestination || ''
                            )
                          }
                          className="h-4 px-1 opacity-0 group-hover:opacity-70 hover:opacity-100 transition-opacity"
                        >
                          <Edit2 className="w-3 h-3" />
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Two-column grid for Contact Information and Team Assignments */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Contact Information */}
            <div className="bg-[#236383] text-white rounded-lg p-4 shadow-md">
              <div className="flex items-center gap-2 mb-3">
                <Users className="w-5 h-5" />
                <span className="font-semibold text-lg">
                  Contact Information
                </span>
              </div>
              <div className="flex items-center gap-6">
                <div className="flex flex-col gap-1">
                  <span className="font-medium text-base">
                    {request.firstName} {request.lastName}
                  </span>
                  {request.email && (
                    <div className="flex items-center gap-1">
                      <Mail className="w-4 h-4" />
                      <a
                        href={`mailto:${request.email}`}
                        className="text-base hover:underline"
                      >
                        {request.email}
                      </a>
                    </div>
                  )}
                  {request.phone && (
                    <div className="flex items-center gap-1">
                      <Phone className="w-4 h-4" />
                      <a
                        href={`tel:${request.phone}`}
                        className="text-base hover:underline"
                      >
                        {request.phone}
                      </a>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Team Assignments */}
            {totalNeeded > 0 && (
              <div className="bg-[#A31C41] text-white rounded-lg p-4 shadow-md">
                <div className="flex items-center justify-between mb-3">
                  <span className="font-semibold text-lg">
                    Team Assignments
                  </span>
                  <span
                    className={`text-base font-bold px-2 py-1 rounded-full ${
                      staffingComplete
                        ? 'bg-white/20 text-white'
                        : 'bg-white/20 text-white'
                    }`}
                  >
                    {totalAssigned}/{totalNeeded} assigned
                  </span>
                </div>

                <div className="space-y-3">
                  {/* Drivers */}
                  {driverNeeded > 0 && (
                    <div
                      className={`rounded-lg p-3 border ${
                        driverAssigned >= driverNeeded
                          ? 'bg-white/20 border-white/30'
                          : 'bg-white/20 border-white/30'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <Car className="w-4 h-4" />
                          <span className="font-medium">Drivers</span>
                          <span
                            className={`text-sm px-2 py-1 rounded-full font-bold ${
                              driverAssigned >= driverNeeded
                                ? 'bg-white/20 text-white'
                                : 'bg-white/20 text-white'
                            }`}
                          >
                            {driverAssigned}/{driverNeeded}
                          </span>
                        </div>
                        {canEdit && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => openAssignmentDialog('driver')}
                            className="h-8 text-sm border-white/60 text-white hover:bg-white hover:text-[#A31C41] font-semibold shadow-sm !bg-[#47b3cb]"
                          >
                            <UserPlus className="w-3 h-3 mr-1" />
                            {driverAssigned < driverNeeded ? 'Assign' : 'Add'}
                          </Button>
                        )}
                      </div>
                      {driverAssigned > 0 || request.assignedVanDriverId ? (
                        <div className="space-y-1">
                          {parsePostgresArray(request.assignedDriverIds).map(
                            (driverId: string) => {
                              let name = '';
                              if (driverId.startsWith('custom-')) {
                                name = extractCustomName(driverId);
                              } else {
                                const detailName = (
                                  request.driverDetails as any
                                )?.[driverId]?.name;
                                // Check if detailName is actually a name (not an ID)
                                const isActualName =
                                  detailName &&
                                  !/^[\d]+$/.test(detailName) &&
                                  !detailName.startsWith('user_') &&
                                  !detailName.startsWith('admin_');
                                name = isActualName
                                  ? detailName
                                  : resolveUserName(driverId);
                              }
                              return (
                                <div
                                  key={driverId}
                                  className="flex items-center justify-between bg-white/20 rounded px-2 py-1"
                                >
                                  <span className="text-base font-medium">
                                    {name}
                                  </span>
                                  {canEdit && (
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() =>
                                        handleRemoveAssignment(
                                          'driver',
                                          driverId
                                        )
                                      }
                                      className="h-6 w-6 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                                    >
                                      <X className="w-3 h-3" />
                                    </Button>
                                  )}
                                </div>
                              );
                            }
                          )}
                          {/* Van Driver in Drivers List */}
                          {request.assignedVanDriverId && (
                            <div className="flex items-center justify-between bg-white/60 rounded px-2 py-1">
                              <span className="text-base font-medium">
                                {resolveUserName(request.assignedVanDriverId)}
                                <span className="ml-2 text-xs text-[#A31C41]">
                                  (van driver, counts as driver)
                                </span>
                              </span>
                              {canEdit && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() =>
                                    handleRemoveAssignment(
                                      'driver',
                                      request.assignedVanDriverId!
                                    )
                                  }
                                  className="h-6 w-6 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                                >
                                  <X className="w-3 h-3" />
                                </Button>
                              )}
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="text-base italic">
                          No drivers assigned
                        </div>
                      )}
                    </div>
                  )}

                  {/* Speakers */}
                  {speakerNeeded > 0 && (
                    <div
                      className={`rounded-lg p-3 border ${
                        speakerAssigned >= speakerNeeded
                          ? 'bg-white/20 border-white/30'
                          : 'bg-white/20 border-white/30'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <Megaphone className="w-4 h-4" />
                          <span className="font-medium">Speakers</span>
                          <span
                            className={`text-sm px-2 py-1 rounded-full font-bold ${
                              speakerAssigned >= speakerNeeded
                                ? 'bg-white/20 text-white'
                                : 'bg-white/20 text-white'
                            }`}
                          >
                            {speakerAssigned}/{speakerNeeded}
                          </span>
                        </div>
                        {canEdit && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => openAssignmentDialog('speaker')}
                            className="h-8 text-sm border-white/60 text-white hover:bg-white hover:text-[#A31C41] font-semibold shadow-sm"
                          >
                            <UserPlus className="w-3 h-3 mr-1" />
                            {speakerAssigned < speakerNeeded ? 'Assign' : 'Add'}
                          </Button>
                        )}
                      </div>
                      {speakerAssigned > 0 ? (
                        <div className="space-y-1">
                          {Object.keys(request.speakerDetails || {}).map(
                            (speakerId: string) => {
                              let name = '';
                              if (speakerId.startsWith('custom-')) {
                                name = extractCustomName(speakerId);
                              } else {
                                const detailName = (
                                  request.speakerDetails as any
                                )?.[speakerId]?.name;
                                const isActualName =
                                  detailName &&
                                  !/^[\d]+$/.test(detailName) &&
                                  !detailName.startsWith('user_') &&
                                  !detailName.startsWith('admin_');
                                name = isActualName
                                  ? detailName
                                  : resolveUserName(speakerId);
                              }
                              return (
                                <div
                                  key={speakerId}
                                  className="flex items-center justify-between bg-white/20 rounded px-2 py-1"
                                >
                                  <span className="text-base font-medium">
                                    {name}
                                  </span>
                                  {canEdit && (
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() =>
                                        handleRemoveAssignment(
                                          'speaker',
                                          speakerId
                                        )
                                      }
                                      className="h-6 w-6 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                                    >
                                      <X className="w-3 h-3" />
                                    </Button>
                                  )}
                                </div>
                              );
                            }
                          )}
                        </div>
                      ) : (
                        <div className="text-base italic">
                          No speakers assigned
                        </div>
                      )}
                    </div>
                  )}

                  {/* Volunteers */}
                  {volunteerNeeded > 0 && (
                    <div
                      className={`rounded-lg p-3 border ${
                        volunteerAssigned >= volunteerNeeded
                          ? 'bg-white/20 border-white/30'
                          : 'bg-white/20 border-white/30'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <Users className="w-4 h-4" />
                          <span className="font-medium">Volunteers</span>
                          <span
                            className={`text-sm px-2 py-1 rounded-full font-bold ${
                              volunteerAssigned >= volunteerNeeded
                                ? 'bg-white/20 text-white'
                                : 'bg-white/20 text-white'
                            }`}
                          >
                            {volunteerAssigned}/{volunteerNeeded}
                          </span>
                        </div>
                        {canEdit && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => openAssignmentDialog('volunteer')}
                            className="h-8 text-sm border-white/60 text-white hover:bg-white hover:text-[#A31C41] font-semibold shadow-sm"
                          >
                            <UserPlus className="w-3 h-3 mr-1" />
                            {volunteerAssigned < volunteerNeeded
                              ? 'Assign'
                              : 'Add'}
                          </Button>
                        )}
                      </div>
                      {volunteerAssigned > 0 ? (
                        <div className="space-y-1">
                          {parsePostgresArray(request.assignedVolunteerIds).map(
                            (volunteerId: string) => {
                              const name = volunteerId.startsWith('custom-')
                                ? extractCustomName(volunteerId)
                                : resolveUserName(volunteerId);
                              return (
                                <div
                                  key={volunteerId}
                                  className="flex items-center justify-between bg-white/20 rounded px-2 py-1"
                                >
                                  <span className="text-base font-medium">
                                    {name}
                                  </span>
                                  {canEdit && (
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() =>
                                        handleRemoveAssignment(
                                          'volunteer',
                                          volunteerId
                                        )
                                      }
                                      className="h-6 w-6 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                                    >
                                      <X className="w-3 h-3" />
                                    </Button>
                                  )}
                                </div>
                              );
                            }
                          )}
                        </div>
                      ) : (
                        <div className="text-base italic">
                          No volunteers assigned
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Comprehensive Notes & Requirements Section */}
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
            <div className="bg-[#47B3CB] text-white rounded-lg p-4 mb-4 shadow-md">
              <div className="flex items-center gap-2 mb-3">
                <FileText className="w-4 h-4" />
                <span className="font-medium text-lg">
                  Notes & Requirements
                </span>
              </div>
              <div className="space-y-3">
                {request.message && (
                  <div>
                    <p className="text-sm font-medium mb-1">
                      Original Request Message:
                    </p>
                    <p className="text-sm text-gray-700 bg-blue-50 p-3 rounded border-l-3 border-blue-200">
                      {request.message}
                    </p>
                  </div>
                )}
                {request.additionalRequirements && (
                  <div>
                    <p className="text-sm font-medium mb-1">
                      Special Requirements:
                    </p>
                    <p className="text-sm text-gray-700 bg-amber-50 p-3 rounded border-l-3 border-amber-200">
                      {request.additionalRequirements}
                    </p>
                  </div>
                )}
                {request.planningNotes && (
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-sm font-medium">Planning Notes:</p>
                      {canEdit && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() =>
                            startEditing(
                              'planningNotes',
                              request.planningNotes || ''
                            )
                          }
                          className="h-6 px-2 text-xs hover:bg-white/20"
                        >
                          <Edit2 className="w-3 h-3 mr-1" />
                          Edit
                        </Button>
                      )}
                    </div>
                    {isEditingThisCard && editingField === 'planningNotes' ? (
                      <div className="space-y-2">
                        <textarea
                          value={editingValue}
                          onChange={(e) => setEditingValue(e.target.value)}
                          className="w-full p-2 border border-gray-300 rounded text-base min-h-[80px] text-gray-900 bg-white"
                          placeholder="Add planning notes..."
                          autoFocus
                        />
                        <div className="flex gap-2">
                          <Button size="sm" onClick={saveEdit}>
                            <Save className="w-3 h-3 mr-1" />
                            Save
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={cancelEdit}
                          >
                            <X className="w-3 h-3 mr-1" />
                            Cancel
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <p className="text-sm text-gray-700 bg-white p-3 rounded border">
                        {request.planningNotes}
                      </p>
                    )}
                  </div>
                )}
                {request.schedulingNotes && (
                  <div>
                    <p className="text-sm font-medium mb-1">
                      Scheduling Notes:
                    </p>
                    <p className="text-sm text-gray-700 bg-green-50 p-3 rounded border-l-3 border-green-200">
                      {request.schedulingNotes}
                    </p>
                  </div>
                )}
                {request.volunteerNotes && (
                  <div>
                    <p className="text-sm font-medium mb-1">Volunteer Notes:</p>
                    <p className="text-sm text-gray-700 bg-purple-50 p-3 rounded border-l-3 border-purple-200">
                      {request.volunteerNotes}
                    </p>
                  </div>
                )}
                {request.driverNotes && (
                  <div>
                    <p className="text-sm font-medium mb-1">Driver Notes:</p>
                    <p className="text-sm text-gray-700 bg-orange-50 p-3 rounded border-l-3 border-orange-200">
                      {request.driverNotes}
                    </p>
                  </div>
                )}
                {request.vanDriverNotes && (
                  <div>
                    <p className="text-sm font-medium mb-1">
                      Van Driver Notes:
                    </p>
                    <p className="text-sm text-gray-700 bg-red-50 p-3 rounded border-l-3 border-red-200">
                      {request.vanDriverNotes}
                    </p>
                  </div>
                )}
                {request.followUpNotes && (
                  <div>
                    <p className="text-sm font-medium mb-1">Follow-up Notes:</p>
                    <p className="text-sm text-gray-700 bg-yellow-50 p-3 rounded border-l-3 border-yellow-200">
                      {request.followUpNotes}
                    </p>
                  </div>
                )}
                {request.distributionNotes && (
                  <div>
                    <p className="text-sm font-medium mb-1">
                      Distribution Notes:
                    </p>
                    <p className="text-sm text-gray-700 bg-teal-50 p-3 rounded border-l-3 border-teal-200">
                      {request.distributionNotes}
                    </p>
                  </div>
                )}
                {request.duplicateNotes && (
                  <div>
                    <p className="text-sm font-medium mb-1">
                      Duplicate Check Notes:
                    </p>
                    <p className="text-sm text-gray-700 bg-pink-50 p-3 rounded border-l-3 border-pink-200">
                      {request.duplicateNotes}
                    </p>
                  </div>
                )}
                {request.unresponsiveNotes && (
                  <div>
                    <p className="text-sm font-medium mb-1">
                      Unresponsive Notes:
                    </p>
                    <p className="text-sm text-gray-700 bg-gray-100 p-3 rounded border-l-3 border-gray-300">
                      {request.unresponsiveNotes}
                    </p>
                  </div>
                )}
                {request.socialMediaPostNotes && (
                  <div>
                    <p className="text-sm font-medium mb-1">
                      Social Media Notes:
                    </p>
                    <p className="text-sm text-gray-700 bg-indigo-50 p-3 rounded border-l-3 border-indigo-200">
                      {request.socialMediaPostNotes}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex flex-wrap gap-2 pt-3 border-t border-gray-200 justify-end">
            <Button size="sm" variant="outline" onClick={onContact} className="!bg-[#007e8c] !text-[#ffffff] !border-[#007e8c] hover:!bg-[#006975] hover:!text-white">
              Contact Organizer
            </Button>
            <Button size="sm" variant="outline" onClick={onReschedule}>
              Reschedule
            </Button>
            <Button size="sm" onClick={onFollowUp}>
              Follow Up
            </Button>

            {/* TSP Contact Assignment - only show if not already assigned */}
            {!(request.tspContact || request.customTspContact) && (
              <Button
                size="sm"
                variant="outline"
                onClick={onAssignTspContact}
                className="border-yellow-500 text-yellow-700 hover:bg-yellow-50"
              >
                <UserPlus className="w-4 h-4 mr-1" />
                Assign TSP Contact
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
