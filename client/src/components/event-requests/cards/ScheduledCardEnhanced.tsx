import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
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
  onEdit: () => void;
  onDelete: () => void;
  onContact: () => void;
  onAssignTspContact: () => void;
  onEditTspContact: () => void;
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
  if (!id || typeof id !== 'string') return 'Unknown';
  if (id.startsWith('custom-')) {
    const parts = id.split('-');
    if (parts.length >= 3) {
      const nameParts = parts.slice(2);
      return nameParts.join('-').replace(/-/g, ' ').trim() || 'Custom Volunteer';
    }
    return 'Custom Volunteer';
  }
  return id;
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
  onEdit,
  onDelete,
  onContact,
  onAssignTspContact,
  onEditTspContact,
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
      const hostLocation = hostLocations.find(h => h.id === numId);
      if (hostLocation) return hostLocation.name;
      const hostContact = hostContacts.find(h => h.id === numId);
      if (hostContact) return hostContact.displayName || hostContact.name;
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
    <Card className="w-full bg-gradient-to-br from-[#FBAD3F]/95 via-[#FBAD3F]/70 to-[#FBAD3F]/45 border-l-4 border-l-[#007E8C] shadow-lg hover:shadow-xl transition-all">
      <CardContent className="p-5">
        {/* Header Row - Organization & Status */}
        <div className="flex items-start justify-between gap-4 mb-4">
          <div className="flex-1">
            <div className="flex items-baseline gap-3 mb-2">
              <h2 className="text-2xl font-bold text-white drop-shadow-md" style={{ textShadow: '1px 1px 2px rgba(0,0,0,0.3)' }}>
                {request.organizationName}
              </h2>
              {request.department && (
                <span className="text-lg text-[#236383] font-semibold">
                  {request.department}
                </span>
              )}
            </div>

            {/* Status Badges */}
            <div className="flex flex-wrap items-center gap-2">
              <Badge
                onClick={() => canEdit && quickToggleBoolean('isConfirmed', !request.isConfirmed)}
                className={`cursor-pointer font-semibold ${
                  request.isConfirmed
                    ? 'bg-[#007E8C] text-white hover:bg-[#007E8C]/90'
                    : 'bg-white/80 text-[#236383] border-2 border-[#236383] hover:bg-white'
                }`}
              >
                {request.isConfirmed ? <Check className="w-3 h-3 mr-1" /> : null}
                {request.isConfirmed ? 'CONFIRMED' : 'REQUESTED'}
              </Badge>

              <Badge
                onClick={() => canEdit && quickToggleBoolean('addedToOfficialSheet', !request.addedToOfficialSheet)}
                className={`cursor-pointer font-semibold ${
                  request.addedToOfficialSheet
                    ? 'bg-[#47B3CB] text-white hover:bg-[#47B3CB]/90'
                    : 'bg-white/80 text-[#236383] border-2 border-[#47B3CB] hover:bg-white'
                }`}
              >
                {request.addedToOfficialSheet ? '✓ ON SHEET' : 'NOT ON SHEET'}
              </Badge>

              {staffingComplete && (
                <Badge className="bg-[#007E8C] text-white font-semibold">
                  <Check className="w-3 h-3 mr-1" />
                  FULLY STAFFED
                </Badge>
              )}

              {missingInfo.length > 0 && (
                <Badge className="bg-[#A31C41] text-white font-semibold animate-pulse">
                  <AlertTriangle className="w-3 h-3 mr-1" />
                  {missingInfo.length} MISSING
                </Badge>
              )}
            </div>
          </div>

          {/* Action Buttons */}
          {canEdit && (
            <div className="flex gap-2">
              <Button size="sm" onClick={onEdit} className="bg-white/90 text-[#236383] hover:bg-white">
                <Edit2 className="w-4 h-4" />
              </Button>
              <ConfirmationDialog
                trigger={
                  <Button size="sm" className="bg-[#A31C41] text-white hover:bg-[#A31C41]/90">
                    <Trash2 className="w-4 h-4" />
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

        {/* Main Info Grid - 2 columns */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
          {/* LEFT COLUMN - Event Details */}
          <div className="bg-[#236383] rounded-lg p-4 text-white space-y-3">
            <h3 className="font-bold text-lg uppercase tracking-wide border-b border-white/30 pb-2">📅 Event Details</h3>

            {/* Date - Inline Editable */}
            <div className="flex items-center gap-2">
              <Calendar className="w-5 h-5 shrink-0" />
              {isEditingThisCard && editingField === dateFieldToEdit ? (
                <div className="flex items-center gap-2 flex-1">
                  <Input
                    type="date"
                    value={editingValue}
                    onChange={(e) => setEditingValue(e.target.value)}
                    className="h-8 bg-white text-gray-900"
                  />
                  <Button size="sm" onClick={saveEdit} className="bg-[#007E8C] hover:bg-[#007E8C]/90">
                    <Save className="w-3 h-3" />
                  </Button>
                  <Button size="sm" variant="ghost" onClick={cancelEdit} className="text-white hover:bg-white/20">
                    <X className="w-3 h-3" />
                  </Button>
                </div>
              ) : (
                <div className="flex items-center gap-2 flex-1 group">
                  <span className="font-bold text-lg">
                    {dateInfo ? dateInfo.text : 'No date set'}
                  </span>
                  {canEdit && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => startEditing(dateFieldToEdit, formatDateForInput(displayDate?.toString() || ''))}
                      className="opacity-0 group-hover:opacity-100 text-white hover:bg-white/20 h-6 px-2"
                    >
                      <Edit2 className="w-3 h-3" />
                    </Button>
                  )}
                </div>
              )}
            </div>

            {/* Times Row */}
            <div className="grid grid-cols-3 gap-2 text-sm">
              {/* Start Time */}
              <div>
                <div className="text-white/70 text-xs uppercase">Start</div>
                {isEditingThisCard && editingField === 'eventStartTime' ? (
                  <div className="flex flex-col gap-1">
                    <Input
                      type="time"
                      value={editingValue}
                      onChange={(e) => setEditingValue(e.target.value)}
                      className="h-7 bg-white text-gray-900 text-xs"
                    />
                    <div className="flex gap-1">
                      <Button size="sm" onClick={saveEdit} className="h-6 px-2 bg-[#007E8C]">
                        <Save className="w-3 h-3" />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={cancelEdit} className="h-6 px-2 text-white">
                        <X className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="font-semibold group cursor-pointer" onClick={() => canEdit && startEditing('eventStartTime', formatTimeForInput(request.eventStartTime || ''))}>
                    {request.eventStartTime ? formatTime12Hour(request.eventStartTime) : 'Not set'}
                  </div>
                )}
              </div>

              {/* End Time */}
              <div>
                <div className="text-white/70 text-xs uppercase">End</div>
                {isEditingThisCard && editingField === 'eventEndTime' ? (
                  <div className="flex flex-col gap-1">
                    <Input
                      type="time"
                      value={editingValue}
                      onChange={(e) => setEditingValue(e.target.value)}
                      className="h-7 bg-white text-gray-900 text-xs"
                    />
                    <div className="flex gap-1">
                      <Button size="sm" onClick={saveEdit} className="h-6 px-2 bg-[#007E8C]">
                        <Save className="w-3 h-3" />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={cancelEdit} className="h-6 px-2 text-white">
                        <X className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="font-semibold group cursor-pointer" onClick={() => canEdit && startEditing('eventEndTime', formatTimeForInput(request.eventEndTime || ''))}>
                    {request.eventEndTime ? formatTime12Hour(request.eventEndTime) : 'Not set'}
                  </div>
                )}
              </div>

              {/* Pickup Time */}
              <div>
                <div className="text-white/70 text-xs uppercase">Pickup</div>
                {isEditingThisCard && editingField === 'pickupDateTime' ? (
                  <div className="flex flex-col gap-1">
                    <DateTimePicker
                      value={editingValue}
                      onChange={setEditingValue}
                      className="h-7 text-xs"
                    />
                    <div className="flex gap-1">
                      <Button size="sm" onClick={saveEdit} className="h-6 px-2 bg-[#007E8C]">
                        <Save className="w-3 h-3" />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={cancelEdit} className="h-6 px-2 text-white">
                        <X className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="font-semibold group cursor-pointer text-xs" onClick={() => canEdit && startEditing('pickupDateTime', request.pickupDateTime?.toString() || '')}>
                    {request.pickupDateTime ? formatTime12Hour(new Date(request.pickupDateTime).toTimeString().slice(0, 5)) : (request.pickupTime ? formatTime12Hour(request.pickupTime) : 'Not set')}
                  </div>
                )}
              </div>
            </div>

            {/* Address */}
            <div className="flex items-start gap-2">
              <MapPin className="w-5 h-5 shrink-0 mt-0.5" />
              {isEditingThisCard && editingField === 'eventAddress' ? (
                <div className="flex-1 flex flex-col gap-2">
                  <Input
                    value={editingValue}
                    onChange={(e) => setEditingValue(e.target.value)}
                    className="bg-white text-gray-900"
                    placeholder="Event address"
                  />
                  <div className="flex gap-2">
                    <Button size="sm" onClick={saveEdit} className="bg-[#007E8C]">
                      <Save className="w-3 h-3 mr-1" /> Save
                    </Button>
                    <Button size="sm" variant="ghost" onClick={cancelEdit} className="text-white hover:bg-white/20">
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
                      className="text-[#FBAD3F] hover:text-[#FBAD3F]/80 underline font-semibold"
                    >
                      {request.eventAddress}
                    </a>
                  ) : (
                    <span className="text-white/60">No address set</span>
                  )}
                  {canEdit && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => startEditing('eventAddress', request.eventAddress || '')}
                      className="opacity-0 group-hover:opacity-100 text-white hover:bg-white/20 h-6 px-2 ml-2"
                    >
                      <Edit2 className="w-3 h-3" />
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
                          <Button size="sm" variant="ghost" onClick={() => removeInlineSandwichType(index)} className="text-white">
                            <X className="w-3 h-3" />
                          </Button>
                        </div>
                      ))}
                      <Button size="sm" onClick={addInlineSandwichType} variant="outline" className="w-full">
                        + Add Type
                      </Button>
                    </div>
                  )}

                  <div className="flex gap-2 pt-2">
                    <Button size="sm" onClick={saveEdit} className="bg-[#007E8C]">
                      <Save className="w-3 h-3 mr-1" /> Save
                    </Button>
                    <Button size="sm" variant="ghost" onClick={cancelEdit} className="text-white hover:bg-white/20">
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex-1 group flex items-center gap-2">
                  <span className="font-bold text-xl text-[#FBAD3F]">{sandwichInfo}</span>
                  {canEdit && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => startEditing('sandwichTypes', '')}
                      className="opacity-0 group-hover:opacity-100 text-white hover:bg-white/20 h-6 px-2"
                    >
                      <Edit2 className="w-3 h-3" />
                    </Button>
                  )}
                </div>
              )}
            </div>

            {/* Attendance */}
            {request.estimatedAttendance && (
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 shrink-0" />
                <span className="font-semibold">{request.estimatedAttendance} people expected</span>
              </div>
            )}
          </div>

          {/* RIGHT COLUMN - Contacts & Logistics */}
          <div className="space-y-3">
            {/* Contact Info */}
            <div className="bg-[#47B3CB] rounded-lg p-4 text-white">
              <h3 className="font-bold uppercase tracking-wide border-b border-white/30 pb-2 mb-3">👤 Contact Info</h3>
              <div className="space-y-2 text-sm">
                {request.contactName && (
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4 shrink-0" />
                    <span className="font-semibold">{request.contactName}</span>
                  </div>
                )}
                {request.contactEmail && (
                  <div className="flex items-center gap-2">
                    <Mail className="w-4 h-4 shrink-0" />
                    <a href={`mailto:${request.contactEmail}`} className="hover:underline">
                      {request.contactEmail}
                    </a>
                  </div>
                )}
                {request.contactPhone && (
                  <div className="flex items-center gap-2">
                    <Phone className="w-4 h-4 shrink-0" />
                    <a href={`tel:${request.contactPhone}`} className="hover:underline">
                      {request.contactPhone}
                    </a>
                  </div>
                )}
                {(request.tspContact || request.customTspContact) && (
                  <div className="flex items-center gap-2 pt-2 border-t border-white/30">
                    <UserPlus className="w-4 h-4 shrink-0" />
                    <span className="font-semibold">TSP: {request.customTspContact || resolveUserName(request.tspContact || '')}</span>
                    {canEdit && (
                      <Button size="sm" variant="ghost" onClick={onEditTspContact} className="h-6 px-2 text-white hover:bg-white/20">
                        <Edit2 className="w-3 h-3" />
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
            <div className="bg-[#A31C41] rounded-lg p-4 text-white">
              <h3 className="font-bold uppercase tracking-wide border-b border-white/30 pb-2 mb-3">🚚 Delivery Logistics</h3>
              <div className="space-y-2 text-sm">
                {request.assignedRecipientIds && request.assignedRecipientIds.length > 0 ? (
                  <div>
                    <div className="text-white/80 text-xs uppercase mb-1">Recipients</div>
                    <div className="flex flex-wrap gap-1">
                      {request.assignedRecipientIds.map((id, idx) => (
                        <Badge key={idx} className="bg-white/20 text-white border-white/40">
                          {resolveRecipientName(id)}
                        </Badge>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="text-white/60 text-xs">No recipients assigned</div>
                )}

                {request.overnightHoldingLocation && (
                  <div className="pt-2 border-t border-white/30">
                    <div className="text-white/80 text-xs uppercase mb-1">Overnight Holding</div>
                    <div className="font-semibold">{request.overnightHoldingLocation}</div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Staffing Section */}
        {totalNeeded > 0 && (
          <div className="bg-white/90 rounded-lg p-4 mb-4">
            <h3 className="font-bold text-[#236383] uppercase tracking-wide mb-3">👥 Team Assignments</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Drivers */}
              {driverNeeded > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-semibold text-[#236383] flex items-center gap-1">
                      <Car className="w-4 h-4" />
                      Drivers ({driverAssigned}/{driverNeeded})
                    </span>
                    {canEdit && (
                      <Button size="sm" onClick={() => openAssignmentDialog('driver')} className="h-7 bg-[#007E8C] text-white">
                        <UserPlus className="w-3 h-3" />
                      </Button>
                    )}
                  </div>
                  <div className="space-y-1">
                    {parsePostgresArray(request.assignedDriverIds).map((id) => (
                      <div key={id} className="flex items-center justify-between bg-[#47B3CB]/10 rounded px-2 py-1">
                        <span className="text-sm">{extractCustomName(id) || resolveUserName(id)}</span>
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
                    ))}
                    {driverAssigned === 0 && <div className="text-sm text-gray-500 italic">None assigned</div>}
                  </div>
                </div>
              )}

              {/* Speakers */}
              {speakerNeeded > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-semibold text-[#236383] flex items-center gap-1">
                      <Megaphone className="w-4 h-4" />
                      Speakers ({speakerAssigned}/{speakerNeeded})
                    </span>
                    {canEdit && (
                      <Button size="sm" onClick={() => openAssignmentDialog('speaker')} className="h-7 bg-[#007E8C] text-white">
                        <UserPlus className="w-3 h-3" />
                      </Button>
                    )}
                  </div>
                  <div className="space-y-1">
                    {Object.keys(request.speakerDetails || {}).map((id) => (
                      <div key={id} className="flex items-center justify-between bg-[#47B3CB]/10 rounded px-2 py-1">
                        <span className="text-sm">{extractCustomName(id) || resolveUserName(id)}</span>
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
                    ))}
                    {speakerAssigned === 0 && <div className="text-sm text-gray-500 italic">None assigned</div>}
                  </div>
                </div>
              )}

              {/* Volunteers */}
              {volunteerNeeded > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-semibold text-[#236383] flex items-center gap-1">
                      <Users className="w-4 h-4" />
                      Volunteers ({volunteerAssigned}/{volunteerNeeded})
                    </span>
                    {canEdit && (
                      <Button size="sm" onClick={() => openAssignmentDialog('volunteer')} className="h-7 bg-[#007E8C] text-white">
                        <UserPlus className="w-3 h-3" />
                      </Button>
                    )}
                  </div>
                  <div className="space-y-1">
                    {parsePostgresArray(request.assignedVolunteerIds).map((id) => (
                      <div key={id} className="flex items-center justify-between bg-[#47B3CB]/10 rounded px-2 py-1">
                        <span className="text-sm">{extractCustomName(id) || resolveUserName(id)}</span>
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
                    ))}
                    {volunteerAssigned === 0 && <div className="text-sm text-gray-500 italic">None assigned</div>}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Actions Bar */}
        <div className="flex items-center justify-between pt-4 border-t border-gray-300">
          <Button
            onClick={onContact}
            className="bg-[#236383] text-white hover:bg-[#236383]/90"
          >
            <Mail className="w-4 h-4 mr-2" />
            Contact Organizer
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowAuditLog(!showAuditLog)}
            className="text-[#236383]"
          >
            <History className="w-4 h-4 mr-2" />
            Activity History
            {showAuditLog ? <ChevronUp className="w-4 h-4 ml-1" /> : <ChevronDown className="w-4 h-4 ml-1" />}
          </Button>
        </div>

        {showAuditLog && (
          <div className="mt-4 pt-4 border-t border-gray-300">
            <EventRequestAuditLog
              eventId={request.id?.toString()}
              showFilters={false}
              compact={true}
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
};
