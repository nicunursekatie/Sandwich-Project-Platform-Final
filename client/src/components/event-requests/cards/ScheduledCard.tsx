import React, { useState, useMemo } from 'react';
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
import { Checkbox } from '@/components/ui/checkbox';
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
  History,
  ChevronUp,
  ChevronDown,
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
import { MultiRecipientSelector } from '@/components/ui/multi-recipient-selector';
import { useIsMobile } from '@/hooks/use-mobile';
import { getMissingIntakeInfo } from '@/lib/event-request-validation';
import { EventRequestAuditLog } from '@/components/event-request-audit-log';

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
        <div className="space-y-1">
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
        <div className="space-y-1">
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
        <div className="space-y-1">
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
      <div className="flex justify-end gap-3 pt-4">
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
  inlineSandwichMode: 'total' | 'types' | 'range';
  inlineTotalCount: number;
  inlineSandwichTypes: Array<{ type: string; quantity: number }>;
  inlineRangeMin: number;
  inlineRangeMax: number;
  inlineRangeType: string;

  // Actions
  onEdit: () => void;
  onDelete: () => void;
  onContact: () => void;
  onStatusChange: (status: string) => void;
  onFollowUp: () => void;
  onReschedule: () => void;
  onAssignTspContact: () => void;
  onEditTspContact: () => void;
  onLogContact: () => void;

  // Inline editing actions
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

// Helper to get status border color
const getStatusBorderColor = (status: string): string => {
  const colors: Record<string, string> = {
    new: 'border-l-blue-500',
    in_process: 'border-l-yellow-500',
    scheduled: 'border-l-green-500',
    completed: 'border-l-emerald-600',
    declined: 'border-l-red-500',
  };
  return colors[status] || 'border-l-gray-400';
};

export const ScheduledCard: React.FC<ScheduledCardProps> = ({
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
  onEdit,
  onDelete,
  onContact,
  onStatusChange,
  onFollowUp,
  onReschedule,
  onAssignTspContact,
  onEditTspContact,
  onLogContact,
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
  openEditAssignmentDialog,
  handleRemoveAssignment,
  handleSelfSignup,
  canSelfSignup,
  isUserSignedUp,
  canEdit = true,
}) => {
  const isMobile = useIsMobile();
  const [showAuditLog, setShowAuditLog] = useState(false);

  // Fetch host contacts and recipients for recipient display names
  const { data: hostContacts = [], isLoading: hostContactsLoading } = useQuery<Array<{
    id: number;
    displayName: string;
    name: string;
    hostLocationName: string;
  }>>({
    queryKey: ['/api/hosts/host-contacts'],
    staleTime: 1 * 60 * 1000,
  });

  const { data: recipients = [], isLoading: recipientsLoading } = useQuery<Array<{ id: number; name: string }>>({
    queryKey: ['/api/recipients'],
    staleTime: 1 * 60 * 1000,
  });

  const { data: hostLocations = [], isLoading: hostLocationsLoading } = useQuery<Array<{ id: number; name: string }>>({
    queryKey: ['/api/hosts'],
    staleTime: 1 * 60 * 1000,
  });

  // Helper to resolve recipient display name from ID
  const resolveRecipientName = (recipientId: string): { name: string; type: string } => {
    if (recipientId.includes(':')) {
      const [type, ...rest] = recipientId.split(':');
      const value = rest.join(':');
      
      if (!isNaN(Number(value))) {
        const numId = Number(value);
        
        if (type === 'host') {
          const hostContact = hostContacts.find(hc => hc.id === numId);
          if (hostContact) {
            const resolvedName = hostContact.displayName || hostContact.name || hostContact.hostLocationName;
            return { name: resolvedName || `Host Contact ${numId}`, type };
          }
          const hostLocation = hostLocations.find(h => h.id === numId);
          if (hostLocation) {
            return { name: hostLocation.name || `Host Location ${numId}`, type };
          }
          const fallbackRecipient = recipients.find(r => r.id === numId);
          if (fallbackRecipient) {
            return { name: fallbackRecipient.name || `Recipient ${numId}`, type: 'recipient' };
          }
          return { name: `Unknown Host (${numId})`, type };
        } else if (type === 'recipient') {
          const recipient = recipients.find(r => r.id === numId);
          if (recipient) {
            return { name: recipient.name || `Recipient ${numId}`, type };
          }
          const fallbackHostLocation = hostLocations.find(h => h.id === numId);
          if (fallbackHostLocation) {
            return { name: fallbackHostLocation.name || `Host ${numId}`, type: 'host' };
          }
          const fallbackHostContact = hostContacts.find(hc => hc.id === numId);
          if (fallbackHostContact) {
            const resolvedName = fallbackHostContact.displayName || fallbackHostContact.name || fallbackHostContact.hostLocationName;
            return { name: resolvedName || `Host Contact ${numId}`, type: 'host' };
          }
          return { name: `Unknown Recipient (${numId})`, type };
        }
      }
      
      return { name: value, type };
    }

    if (!isNaN(Number(recipientId))) {
      const numId = Number(recipientId);

      if (hostContactsLoading || hostLocationsLoading || recipientsLoading) {
        return { name: `Loading...`, type: 'unknown' };
      }

      const hostLocation = hostLocations.find(h => h.id === numId);
      if (hostLocation) {
        return { name: hostLocation.name || `Host Location ${numId}`, type: 'host' };
      }

      const hostContact = hostContacts.find(h => h.id === numId);
      if (hostContact) {
        const resolvedName = hostContact.displayName || hostContact.name || hostContact.hostLocationName;
        return {
          name: resolvedName || `Host Contact ${numId}`,
          type: 'host'
        };
      }

      const recipient = recipients.find(r => r.id === numId);
      if (recipient) {
        return { name: recipient.name || `Recipient ${numId}`, type: 'recipient' };
      }

      return { name: `Unknown ID #${recipientId}`, type: 'unknown' };
    }

    return { name: recipientId, type: 'custom' };
  };

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
        const nameParts = parts.slice(2);
        const cleanName = nameParts.join('-').replace(/-/g, ' ');
        return cleanName.trim() || 'Custom Volunteer';
      }
      return 'Custom Volunteer';
    }

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
    icon?: React.ReactNode,
    type: 'text' | 'time' | 'number' | 'select' = 'text',
    options?: { value: string; label: string }[]
  ) => {
    const isEditing = isEditingThisCard && editingField === field;

    if (isEditing) {
      if (type === 'select' && options) {
        return (
          <div className="flex items-center gap-2">
            {icon && <span className="text-gray-500">{icon}</span>}
            <span className="text-sm font-medium text-gray-600 min-w-[100px]">{label}:</span>
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
          {icon && <span className="text-gray-500">{icon}</span>}
          <span className="text-sm font-medium text-gray-600 min-w-[100px]">{label}:</span>
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
        {icon && <span className="text-gray-500">{icon}</span>}
        <span className="text-sm font-medium text-gray-600 min-w-[100px]">{label}:</span>
        <span className="text-sm text-gray-900">
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
      const hasRange = request.estimatedSandwichCountMin && request.estimatedSandwichCountMax;

      let sandwichInfo;
      if (hasRange) {
        const rangeType = request.estimatedSandwichRangeType;
        const typeLabel = rangeType ? SANDWICH_TYPES.find(t => t.value === rangeType)?.label : null;
        sandwichInfo = `${request.estimatedSandwichCountMin}-${request.estimatedSandwichCountMax}${typeLabel ? ` ${typeLabel}` : ''} (estimated range)`;
      } else {
        sandwichInfo = formatSandwichTypesDisplay(
          request.sandwichTypes,
          request.estimatedSandwichCount ?? undefined
        );
      }

      return (
        <div className="flex items-center gap-2 group">
          <Package className="w-4 h-4 text-gray-500" />
          <span className="text-sm font-medium text-gray-600 min-w-[100px]">Sandwiches:</span>
          <span className="text-sm text-gray-900 font-semibold">{sandwichInfo}</span>
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

    return (
      <div className="space-y-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
        <div className="flex items-center justify-between">
          <span className="font-medium text-sm">Edit Sandwiches</span>
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
            Exact Count
          </Button>
          <Button
            size="sm"
            variant={inlineSandwichMode === 'range' ? 'default' : 'outline'}
            onClick={() => setInlineSandwichMode('range')}
          >
            Range
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
            onChange={(e) => {
              const val = e.target.value === '' ? 0 : parseInt(e.target.value);
              setInlineTotalCount(isNaN(val) ? 0 : val);
            }}
            placeholder="Total sandwich count"
            className="text-gray-900 bg-white"
            min="0"
          />
        ) : inlineSandwichMode === 'range' ? (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Input
                type="number"
                value={inlineRangeMin}
                onChange={(e) => {
                  const val = e.target.value === '' ? 0 : parseInt(e.target.value);
                  setInlineRangeMin(isNaN(val) ? 0 : val);
                }}
                placeholder="Min (e.g., 500)"
                className="w-32 text-gray-900 bg-white"
                min="0"
              />
              <span>to</span>
              <Input
                type="number"
                value={inlineRangeMax}
                onChange={(e) => {
                  const val = e.target.value === '' ? 0 : parseInt(e.target.value);
                  setInlineRangeMax(isNaN(val) ? 0 : val);
                }}
                placeholder="Max (e.g., 700)"
                className="w-32 text-gray-900 bg-white"
                min="0"
              />
            </div>
            <Select
              value={inlineRangeType || undefined}
              onValueChange={(value) => setInlineRangeType(value === 'none' ? '' : value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Type (optional)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No specific type</SelectItem>
                {SANDWICH_TYPES.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
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
                  onChange={(e) => {
                    const val = e.target.value === '' ? 0 : parseInt(e.target.value);
                    updateInlineSandwichType(
                      index,
                      'quantity',
                      isNaN(val) ? 0 : val
                    );
                  }}
                  placeholder="Qty"
                  className="w-24 text-gray-900 bg-white"
                  min="0"
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

  const missingInfo = getMissingIntakeInfo(request);

  return (
    <Card
      id={`event-card-${request.id}`}
      className={`w-full ${isMobile ? 'mx-2' : 'max-w-7xl mx-auto'} bg-white border-l-4 ${getStatusBorderColor(request.status)} shadow-sm hover:shadow-md transition-shadow`}
    >
      <CardContent className={`${isMobile ? 'p-4' : 'p-6'} space-y-4`}>
        {/* Header Section */}
        <div className="flex items-start justify-between gap-4 pb-4 border-b border-gray-200">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <h2 className="text-xl sm:text-2xl font-bold text-gray-900">
                {request.organizationName}
              </h2>
              {request.department && (
                <span className="text-sm text-gray-500">
                  {request.department}
                </span>
              )}
            </div>

            {/* Status Badges Group */}
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <Badge variant="outline" className="bg-white text-gray-700 border-gray-300">
                <StatusIcon className="w-3 h-3 mr-1" />
                {getStatusLabel(request.status)}
              </Badge>

              <Badge
                onClick={() => quickToggleBoolean('isConfirmed', request.isConfirmed)}
                className={`cursor-pointer hover:opacity-80 transition-opacity ${
                  request.isConfirmed
                    ? 'bg-green-100 text-green-800 border-green-300'
                    : 'bg-gray-100 text-gray-600 border-gray-300'
                }`}
                variant="outline"
                title="Click to toggle confirmation status"
              >
                {request.isConfirmed ? '✓ Date Confirmed' : 'Date Requested'}
              </Badge>

              <Badge
                onClick={() => quickToggleBoolean('addedToOfficialSheet', request.addedToOfficialSheet)}
                className={`cursor-pointer hover:opacity-80 transition-opacity ${
                  request.addedToOfficialSheet
                    ? 'bg-blue-100 text-blue-800 border-blue-300'
                    : 'bg-gray-100 text-gray-600 border-gray-300'
                }`}
                variant="outline"
                title="Click to toggle official sheet status"
              >
                {request.addedToOfficialSheet ? '✓ On Official Sheet' : 'Not on Official Sheet'}
              </Badge>

              {request.externalId && request.externalId.startsWith('manual-') && (
                <Badge variant="outline" className="bg-purple-100 text-purple-800 border-purple-300">
                  <FileText className="w-3 h-3 mr-1" />
                  Manual Entry
                </Badge>
              )}
            </div>

            {/* Validation Badges Group */}
            {missingInfo.length > 0 && (
              <div className="flex flex-wrap items-center gap-2 mb-2">
                {missingInfo.map((item) => (
                  <Badge 
                    key={item}
                    variant="outline"
                    className="bg-red-50 text-red-700 border-red-300"
                    data-testid={`badge-missing-${item.toLowerCase().replace(' ', '-')}`}
                  >
                    <AlertTriangle className="w-3 h-3 mr-1" />
                    Missing: {item}
                  </Badge>
                ))}
              </div>
            )}

            {/* Staffing Badges Group */}
            <div className="flex flex-wrap items-center gap-2">
              {staffingComplete ? (
                <Badge variant="outline" className="bg-green-100 text-green-800 border-green-300">
                  <Check className="w-3 h-3 mr-1" />
                  Fully Staffed
                </Badge>
              ) : (
                <>
                  {driverNeeded > driverAssigned && (
                    <Badge variant="outline" className="bg-orange-100 text-orange-800 border-orange-300">
                      {driverNeeded - driverAssigned} driver{driverNeeded - driverAssigned > 1 ? 's' : ''} needed
                    </Badge>
                  )}
                  {speakerNeeded > speakerAssigned && (
                    <Badge variant="outline" className="bg-orange-100 text-orange-800 border-orange-300">
                      {speakerNeeded - speakerAssigned} speaker{speakerNeeded - speakerAssigned > 1 ? 's' : ''} needed
                    </Badge>
                  )}
                  {volunteerNeeded > volunteerAssigned && (
                    <Badge variant="outline" className="bg-orange-100 text-orange-800 border-orange-300">
                      {volunteerNeeded - volunteerAssigned} volunteer{volunteerNeeded - volunteerAssigned > 1 ? 's' : ''} needed
                    </Badge>
                  )}
                </>
              )}

              {request.vanDriverNeeded && !request.assignedVanDriverId && (
                <Badge variant="outline" className="bg-blue-100 text-blue-800 border-blue-300">
                  <Car className="w-3 h-3 mr-1" />
                  Van Driver Needed
                </Badge>
              )}
            </div>
          </div>

          {/* Quick Actions */}
          {canEdit && (
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="ghost"
                onClick={onEdit}
                className="text-gray-600 hover:text-gray-900"
              >
                <Edit2 className="w-4 h-4" />
              </Button>
              <ConfirmationDialog
                trigger={
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
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

        {/* Contact Information Section */}
        {(request.firstName || request.lastName || request.email || request.phone || (request.tspContact || request.customTspContact)) && (
          <div className="bg-gray-50 rounded-lg p-4 space-y-2">
            <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <Users className="w-4 h-4" />
              Contact Information
            </h3>
            
            {request.firstName && request.lastName && renderEditableField('firstName', `${request.firstName} ${request.lastName}`, 'Organizer', <Users className="w-4 h-4" />)}
            {request.email && renderEditableField('email', request.email, 'Email', <Mail className="w-4 h-4" />)}
            {request.phone && renderEditableField('phone', request.phone, 'Phone', <Phone className="w-4 h-4" />)}
            
            {(request.tspContact || request.customTspContact) && (
              <div className="flex items-center gap-2 pt-2 border-t border-gray-200">
                <UserPlus className="w-4 h-4 text-gray-500" />
                <span className="text-sm font-medium text-gray-600 min-w-[100px]">TSP Contact:</span>
                <span className="text-sm text-gray-900">
                  {request.customTspContact || resolveUserName(request.tspContact || '')}
                </span>
                {canEdit && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={onEditTspContact}
                    className="h-6 px-2"
                  >
                    <Edit2 className="w-3 h-3" />
                  </Button>
                )}
              </div>
            )}
          </div>
        )}

        {/* Event Details Section */}
        <div className="bg-blue-50 rounded-lg p-4 space-y-3">
          <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <Calendar className="w-4 h-4" />
            Event Details
          </h3>

          {/* Date */}
          {isEditingThisCard && editingField === dateFieldToEdit ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-gray-500" />
                <span className="text-sm font-medium text-gray-600 min-w-[100px]">{dateLabel}:</span>
                <Input
                  type="date"
                  value={editingValue}
                  onChange={(e) => setEditingValue(e.target.value)}
                  className="h-8 w-40 text-gray-900 bg-white"
                  autoFocus
                />
                <Button size="sm" onClick={saveEdit}>
                  <Save className="w-3 h-3" />
                </Button>
                <Button size="sm" variant="ghost" onClick={cancelEdit}>
                  <X className="w-3 h-3" />
                </Button>
              </div>
              <div className="flex items-center gap-2 ml-8">
                <Checkbox
                  id={`confirm-date-checkbox-${dateFieldToEdit}`}
                  checked={tempIsConfirmed}
                  onCheckedChange={(checked) => setTempIsConfirmed(!!checked)}
                />
                <label
                  htmlFor={`confirm-date-checkbox-${dateFieldToEdit}`}
                  className="text-sm font-medium cursor-pointer"
                >
                  Mark as confirmed by our team
                </label>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2 group">
              <Calendar className="w-4 h-4 text-gray-500" />
              <span className="text-sm font-medium text-gray-600 min-w-[100px]">{dateLabel}:</span>
              <span className="text-sm text-gray-900 font-semibold">
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
                  className="h-6 px-2 opacity-0 group-hover:opacity-70 hover:opacity-100 transition-opacity"
                >
                  <Edit2 className="w-3 h-3" />
                </Button>
              )}
            </div>
          )}

          {/* Times */}
          <div className="flex items-center justify-between">
            <div className="space-y-1 flex-1">
              {request.eventStartTime && (
                <div className="flex items-center gap-2 group">
                  <Clock className="w-4 h-4 text-gray-500" />
                  <span className="text-sm font-medium text-gray-600 min-w-[100px]">Start:</span>
                  {isEditingThisCard && editingField === 'eventStartTime' ? (
                    <>
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
                      <Button size="sm" variant="ghost" onClick={cancelEdit}>
                        <X className="w-3 h-3" />
                      </Button>
                    </>
                  ) : (
                    <>
                      <span className="text-sm text-gray-900">
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
                          className="h-6 px-2 opacity-0 group-hover:opacity-70 hover:opacity-100 transition-opacity"
                        >
                          <Edit2 className="w-3 h-3" />
                        </Button>
                      )}
                    </>
                  )}
                </div>
              )}

              {request.eventEndTime && (
                <div className="flex items-center gap-2 group">
                  <Clock className="w-4 h-4 text-gray-500" />
                  <span className="text-sm font-medium text-gray-600 min-w-[100px]">End:</span>
                  {isEditingThisCard && editingField === 'eventEndTime' ? (
                    <>
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
                      <Button size="sm" variant="ghost" onClick={cancelEdit}>
                        <X className="w-3 h-3" />
                      </Button>
                    </>
                  ) : (
                    <>
                      <span className="text-sm text-gray-900">
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
                          className="h-6 px-2 opacity-0 group-hover:opacity-70 hover:opacity-100 transition-opacity"
                        >
                          <Edit2 className="w-3 h-3" />
                        </Button>
                      )}
                    </>
                  )}
                </div>
              )}

              {(request.pickupDateTime || request.pickupTime) && (
                <div className="flex items-center gap-2 group">
                  <Clock className="w-4 h-4 text-gray-500" />
                  <span className="text-sm font-medium text-gray-600 min-w-[100px]">Pickup:</span>
                  {isEditingThisCard && (editingField === 'pickupDateTime' || editingField === 'pickupTime') ? (
                    editingField === 'pickupDateTime' ? (
                      <div className="flex flex-col gap-2">
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
                        <div className="flex gap-2">
                          <Button size="sm" onClick={saveEdit}>
                            <Save className="w-3 h-3" />
                          </Button>
                          <Button size="sm" variant="ghost" onClick={cancelEdit}>
                            <X className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <>
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
                        <Button size="sm" variant="ghost" onClick={cancelEdit}>
                          <X className="w-3 h-3" />
                        </Button>
                      </>
                    )
                  ) : (
                    <>
                      <span className="text-sm text-gray-900">
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
                          className="h-6 px-2 opacity-0 group-hover:opacity-70 hover:opacity-100 transition-opacity"
                        >
                          <Edit2 className="w-3 h-3" />
                        </Button>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>

            {canEdit && (!request.eventStartTime || !request.eventEndTime || (!request.pickupDateTime && !request.pickupTime)) && (
              <Dialog>
                <DialogTrigger asChild>
                  <Button size="sm" variant="outline">
                    Add Times
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-md max-h-[85vh] overflow-y-auto">
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

          {/* Location */}
          {request.eventAddress && renderEditableField('eventAddress', request.eventAddress, 'Location', <MapPin className="w-4 h-4" />)}

          {/* Sandwiches */}
          {renderSandwichEdit()}

          {/* Attendance */}
          {request.estimatedAttendance && request.estimatedAttendance > 0 && (
            renderEditableField('estimatedAttendance', request.estimatedAttendance, 'Est. Attendance', <Users className="w-4 h-4" />, 'number')
          )}
        </div>

        {/* Delivery & Logistics Section */}
        <div className="bg-teal-50 rounded-lg p-4 space-y-3">
          <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <Package className="w-4 h-4" />
            Delivery & Logistics
          </h3>

          {/* Recipients */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Building className="w-4 h-4 text-gray-500" />
              <span className="text-sm font-medium text-gray-600 min-w-[100px]">Recipients:</span>
            </div>
            {isEditingThisCard && editingField === 'assignedRecipientIds' ? (
              <div className="ml-8 space-y-2">
                <MultiRecipientSelector
                  value={editingValue ? JSON.parse(editingValue) : []}
                  onChange={(ids) => setEditingValue(JSON.stringify(ids))}
                  placeholder="Select recipient organizations..."
                  data-testid="assigned-recipients-editor"
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
              <div className="ml-8 flex flex-wrap gap-2 group">
                {request.assignedRecipientIds && request.assignedRecipientIds.length > 0 ? (
                  request.assignedRecipientIds.map((recipientId, index) => {
                    const { name, type } = resolveRecipientName(recipientId);
                    return (
                      <Badge
                        key={index}
                        variant="secondary"
                        className="bg-white border border-gray-300"
                      >
                        {type === 'recipient' && '🏢 '}
                        {type === 'host' && '🏠 '}
                        {type === 'custom' && '📝 '}
                        {type === 'unknown' && '🔍 '}
                        {name}
                      </Badge>
                    );
                  })
                ) : (
                  <span className="text-sm text-gray-500 italic">No recipients assigned</span>
                )}
                {canEdit && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() =>
                      startEditing(
                        'assignedRecipientIds',
                        JSON.stringify(request.assignedRecipientIds || [])
                      )
                    }
                    className="h-6 px-2 opacity-0 group-hover:opacity-70 hover:opacity-100 transition-opacity"
                  >
                    <Edit2 className="w-3 h-3" />
                  </Button>
                )}
              </div>
            )}
          </div>

          {/* Overnight Holding */}
          {request.overnightHoldingLocation && (
            renderEditableField('overnightHoldingLocation', request.overnightHoldingLocation, 'Overnight Holding', <Package className="w-4 h-4" />)
          )}
        </div>

        {/* Assignments Section */}
        {(driverNeeded > 0 || speakerNeeded > 0 || volunteerNeeded > 0) && (
          <div className="bg-purple-50 rounded-lg p-4 space-y-4">
            <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <Users className="w-4 h-4" />
              Team Assignments
            </h3>

            {/* Drivers */}
            {driverNeeded > 0 && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-700">
                    <Car className="w-4 h-4 inline mr-1" />
                    Drivers ({driverAssigned}/{driverNeeded})
                  </span>
                  {canEdit && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => openAssignmentDialog('driver')}
                    >
                      <UserPlus className="w-3 h-3 mr-1" />
                      Assign Driver
                    </Button>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  {request.assignedVanDriverId && (
                    <Badge variant="secondary" className="bg-blue-100 text-blue-900 border-blue-300">
                      {resolveUserName(request.assignedVanDriverId)} (Van)
                      {canEdit && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() =>
                            handleRemoveAssignment('driver', request.assignedVanDriverId!)
                          }
                          className="h-4 w-4 p-0 ml-1 text-red-600"
                        >
                          <X className="w-3 h-3" />
                        </Button>
                      )}
                    </Badge>
                  )}
                  {parsePostgresArray(request.assignedDriverIds).map((driverId) => {
                    const isCustom = driverId.startsWith('custom-');
                    const displayName = isCustom
                      ? extractCustomName(driverId)
                      : resolveUserName(driverId);
                    return (
                      <Badge
                        key={driverId}
                        variant="secondary"
                        className="bg-white border border-gray-300"
                      >
                        {displayName}
                        {canEdit && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleRemoveAssignment('driver', driverId)}
                            className="h-4 w-4 p-0 ml-1 text-red-600"
                          >
                            <X className="w-3 h-3" />
                          </Button>
                        )}
                      </Badge>
                    );
                  })}
                  {driverAssigned === 0 && (
                    <span className="text-sm text-gray-500 italic">No drivers assigned</span>
                  )}
                </div>
              </div>
            )}

            {/* Speakers */}
            {speakerNeeded > 0 && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-700">
                    <Megaphone className="w-4 h-4 inline mr-1" />
                    Speakers ({speakerAssigned}/{speakerNeeded})
                  </span>
                  {canEdit && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => openAssignmentDialog('speaker')}
                    >
                      <UserPlus className="w-3 h-3 mr-1" />
                      Assign Speaker
                    </Button>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(request.speakerDetails || {}).map(
                    ([speakerId, details]: [string, any]) => {
                      const isCustom = speakerId.startsWith('custom-');
                      const displayName = isCustom
                        ? extractCustomName(speakerId)
                        : resolveUserName(speakerId);
                      return (
                        <Badge
                          key={speakerId}
                          variant="secondary"
                          className="bg-white border border-gray-300"
                        >
                          {displayName}
                          {canEdit && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() =>
                                handleRemoveAssignment('speaker', speakerId)
                              }
                              className="h-4 w-4 p-0 ml-1 text-red-600"
                            >
                              <X className="w-3 h-3" />
                            </Button>
                          )}
                        </Badge>
                      );
                    }
                  )}
                  {speakerAssigned === 0 && (
                    <span className="text-sm text-gray-500 italic">No speakers assigned</span>
                  )}
                </div>
              </div>
            )}

            {/* Volunteers */}
            {volunteerNeeded > 0 && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-700">
                    <Users className="w-4 h-4 inline mr-1" />
                    Volunteers ({volunteerAssigned}/{volunteerNeeded})
                  </span>
                  {canEdit && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => openAssignmentDialog('volunteer')}
                    >
                      <UserPlus className="w-3 h-3 mr-1" />
                      Assign Volunteer
                    </Button>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  {parsePostgresArray(request.assignedVolunteerIds).map(
                    (volunteerId) => {
                      const isCustom = volunteerId.startsWith('custom-');
                      const displayName = isCustom
                        ? extractCustomName(volunteerId)
                        : resolveUserName(volunteerId);
                      return (
                        <Badge
                          key={volunteerId}
                          variant="secondary"
                          className="bg-white border border-gray-300"
                        >
                          {displayName}
                          {canEdit && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() =>
                                handleRemoveAssignment('volunteer', volunteerId)
                              }
                              className="h-4 w-4 p-0 ml-1 text-red-600"
                            >
                              <X className="w-3 h-3" />
                            </Button>
                          )}
                        </Badge>
                      );
                    }
                  )}
                  {volunteerAssigned === 0 && (
                    <span className="text-sm text-gray-500 italic">No volunteers assigned</span>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Notes Section */}
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
          <div className="bg-amber-50 rounded-lg p-4">
            <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <FileText className="w-4 h-4" />
              Notes & Requirements
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {request.message && (
                <div className="sm:col-span-2">
                  <p className="text-sm font-medium mb-1">Original Request Message:</p>
                  <p className="text-sm text-gray-700 bg-white p-3 rounded border-l-4 border-blue-400 whitespace-pre-wrap">
                    {request.message}
                  </p>
                </div>
              )}
              {request.additionalRequirements && (
                <div>
                  <p className="text-sm font-medium mb-1">Special Requirements:</p>
                  <p className="text-sm text-gray-700 bg-white p-3 rounded border-l-4 border-orange-400 whitespace-pre-wrap">
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
                          startEditing('planningNotes', request.planningNotes || '')
                        }
                        className="h-6 px-2"
                      >
                        <Edit2 className="w-3 h-3" />
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
                    <p className="text-sm font-medium">Scheduling Notes:</p>
                    {canEdit && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() =>
                          startEditing('schedulingNotes', request.schedulingNotes || '')
                        }
                        className="h-6 px-2"
                      >
                        <Edit2 className="w-3 h-3" />
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
                  <p className="text-sm font-medium mb-1">Volunteer Notes:</p>
                  <p className="text-sm text-gray-700 bg-white p-3 rounded border-l-4 border-purple-400 whitespace-pre-wrap">
                    {request.volunteerNotes}
                  </p>
                </div>
              )}
              {request.driverNotes && (
                <div>
                  <p className="text-sm font-medium mb-1">Driver Notes:</p>
                  <p className="text-sm text-gray-700 bg-white p-3 rounded border-l-4 border-blue-400 whitespace-pre-wrap">
                    {request.driverNotes}
                  </p>
                </div>
              )}
              {request.vanDriverNotes && (
                <div>
                  <p className="text-sm font-medium mb-1">Van Driver Notes:</p>
                  <p className="text-sm text-gray-700 bg-white p-3 rounded border-l-4 border-red-400 whitespace-pre-wrap">
                    {request.vanDriverNotes}
                  </p>
                </div>
              )}
              {request.followUpNotes && (
                <div>
                  <p className="text-sm font-medium mb-1">Follow-up Notes:</p>
                  <p className="text-sm text-gray-700 bg-white p-3 rounded border-l-4 border-yellow-400 whitespace-pre-wrap">
                    {request.followUpNotes}
                  </p>
                </div>
              )}
              {request.distributionNotes && (
                <div>
                  <p className="text-sm font-medium mb-1">Distribution Notes:</p>
                  <p className="text-sm text-gray-700 bg-white p-3 rounded border-l-4 border-teal-400 whitespace-pre-wrap">
                    {request.distributionNotes}
                  </p>
                </div>
              )}
              {request.duplicateNotes && (
                <div>
                  <p className="text-sm font-medium mb-1">Duplicate Check Notes:</p>
                  <p className="text-sm text-gray-700 bg-white p-3 rounded border-l-4 border-pink-400">
                    {request.duplicateNotes}
                  </p>
                </div>
              )}
              {request.unresponsiveNotes && (
                <div>
                  <p className="text-sm font-medium mb-1">Unresponsive Notes:</p>
                  <p className="text-sm text-gray-700 bg-white p-3 rounded border-l-4 border-gray-400">
                    {request.unresponsiveNotes}
                  </p>
                </div>
              )}
              {request.socialMediaPostNotes && (
                <div>
                  <p className="text-sm font-medium mb-1">Social Media Notes:</p>
                  <p className="text-sm text-gray-700 bg-white p-3 rounded border-l-4 border-indigo-400">
                    {request.socialMediaPostNotes}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className={`${isMobile ? 'flex flex-col space-y-2' : 'flex flex-wrap gap-2'} pt-4 border-t border-gray-200`}>
          <Button
            size="sm"
            variant="outline"
            onClick={onContact}
            className="bg-blue-600 text-white border-blue-600 hover:bg-blue-700 hover:text-white"
          >
            Contact Organizer
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={onLogContact}
          >
            <MessageSquare className="w-4 h-4 mr-1" />
            Log Contact
          </Button>
          <Button size="sm" variant="outline" onClick={onReschedule}>
            Reschedule
          </Button>
          <Button size="sm" onClick={onFollowUp}>
            Follow Up
          </Button>

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

        {/* Activity History */}
        <div className="border-t border-gray-200 pt-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowAuditLog(!showAuditLog)}
            className="w-full justify-between text-gray-600 hover:text-gray-800 p-2 h-8"
            data-testid="button-toggle-audit-log"
          >
            <div className="flex items-center gap-2">
              <History className="w-4 h-4" />
              <span className="text-sm">Activity History</span>
            </div>
            {showAuditLog ? (
              <ChevronUp className="w-4 h-4" />
            ) : (
              <ChevronDown className="w-4 h-4" />
            )}
          </Button>

          {showAuditLog && (
            <div className="mt-3" data-testid="audit-log-section">
              <EventRequestAuditLog
                eventId={request.id?.toString()}
                showFilters={false}
                compact={true}
              />
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
