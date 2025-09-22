import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
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
  AlertCircle,
  MessageSquare,
  Building,
  AlertTriangle,
  Car,
  Megaphone,
  UserPlus,
  UserX,
} from 'lucide-react';
import { formatTime12Hour, formatTimeForInput, formatEventDate } from '@/components/event-requests/utils';
import { SANDWICH_TYPES, statusColors, statusIcons, statusOptions } from '@/components/event-requests/constants';
import { parseSandwichTypes, formatSandwichTypesDisplay } from '@/lib/sandwich-utils';
import type { EventRequest } from '@shared/schema';

interface ScheduledCardProps {
  request: EventRequest;

  // Inline editing state
  editingField: string | null;
  editingValue: string;
  isEditingThisCard: boolean;
  inlineSandwichMode: 'total' | 'types';
  inlineTotalCount: number;
  inlineSandwichTypes: Array<{type: string, quantity: number}>;

  // Actions
  onEdit: () => void;
  onDelete: () => void;
  onContact: () => void;
  onStatusChange: (status: string) => void;
  onFollowUp: () => void;
  onReschedule: () => void;

  // Inline editing actions
  startEditing: (field: string, value: string) => void;
  saveEdit: () => void;
  cancelEdit: () => void;
  setEditingValue: (value: string) => void;
  setInlineSandwichMode: (mode: 'total' | 'types') => void;
  setInlineTotalCount: (count: number) => void;
  addInlineSandwichType: () => void;
  updateInlineSandwichType: (index: number, field: 'type' | 'quantity', value: string | number) => void;
  removeInlineSandwichType: (index: number) => void;

  // Assignment actions
  resolveUserName: (id: string) => string;
  openAssignmentDialog: (type: 'driver' | 'speaker' | 'volunteer') => void;
  openEditAssignmentDialog: (type: 'driver' | 'speaker' | 'volunteer', personId: string) => void;
  handleRemoveAssignment: (type: 'driver' | 'speaker' | 'volunteer', personId: string) => void;
  handleSelfSignup: (type: 'driver' | 'speaker' | 'volunteer') => void;
  canSelfSignup: (request: EventRequest, type: 'driver' | 'speaker' | 'volunteer') => boolean;
  isUserSignedUp: (request: EventRequest, type: 'driver' | 'speaker' | 'volunteer') => boolean;

  canEdit?: boolean;
}

// CardHeader component - copied from shared
interface CardHeaderProps {
  request: EventRequest;
  isInProcessStale?: boolean;
  canEdit?: boolean;
  isEditingThisCard?: boolean;
  editingField?: string;
  editingValue?: string;
  startEditing?: (field: string, value: string) => void;
  saveEdit?: () => void;
  cancelEdit?: () => void;
  setEditingValue?: (value: string) => void;
  resolveUserName?: (id: string) => string;
}

const CardHeader: React.FC<CardHeaderProps> = ({
  request,
  isInProcessStale,
  canEdit = false,
  isEditingThisCard = false,
  editingField = '',
  editingValue = '',
  startEditing,
  saveEdit,
  cancelEdit,
  setEditingValue,
  resolveUserName
}) => {
  const StatusIcon = statusIcons[request.status as keyof typeof statusIcons] || statusIcons.new;

  // Calculate staffing gaps
  const parsePostgresArray = (arr: any): string[] => {
    if (!arr) return [];
    if (Array.isArray(arr)) return arr;
    if (typeof arr === 'string') {
      if (arr === '{}' || arr === '') return [];
      let cleaned = arr.replace(/^{|}$/g, '');
      if (!cleaned) return [];
      if (cleaned.includes('"')) {
        const matches = cleaned.match(/"[^"]*"|[^",]+/g);
        return matches ? matches.map(item => item.replace(/"/g, '').trim()).filter(item => item) : [];
      }
      return cleaned.split(',').map(item => item.trim()).filter(item => item);
    }
    return [];
  };

  const driverGap = (request.driversNeeded || 0) - parsePostgresArray(request.assignedDriverIds).length;
  const speakerGap = (request.speakersNeeded || 0) - Object.keys(request.assignedSpeakerDetails || {}).length;
  const volunteerGap = (request.volunteersNeeded || 0) - parsePostgresArray(request.assignedVolunteerIds).length;
  const hasStaffingGaps = driverGap > 0 || speakerGap > 0 || volunteerGap > 0;
  
  // Get the proper status label from constants instead of just replacing underscores
  const getStatusLabel = (status: string) => {
    const statusOption = statusOptions.find(option => option.value === status);
    return statusOption ? statusOption.label : status.replace('_', ' ');
  };

  // Hide requested date once there's a scheduled date (keep requested date in database but don't display)
  const displayDate = request.scheduledEventDate || request.desiredEventDate;

  // Format the date for display
  const dateInfo = displayDate ? formatEventDate(displayDate.toString()) : null;

  // Calculate if date is past
  const isPast = displayDate ? new Date(displayDate) < new Date() : false;

  // Calculate relative time
  const getRelativeTime = (dateString: string) => {
    const date = new Date(dateString);
    const today = new Date();
    const diffTime = date.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Tomorrow';
    if (diffDays === -1) return 'Yesterday';
    if (diffDays > 0 && diffDays <= 7) return `In ${diffDays} days`;
    if (diffDays < 0 && diffDays >= -7) return `${Math.abs(diffDays)} days ago`;
    return '';
  };

  // Determine the date label and field to edit based on what date we're showing
  let dateLabel = 'Requested Date';
  let dateFieldToEdit = 'desiredEventDate';
  if (request.scheduledEventDate) {
    dateFieldToEdit = 'scheduledEventDate';
    if (request.status === 'completed') {
      dateLabel = 'Event Date';
    } else {
      dateLabel = 'Scheduled Date';
    }
  }

  // Parse date string safely without timezone issues
  const parseLocalDate = (dateStr: string) => {
    const [year, month, day] = dateStr.split('-').map(Number);
    return new Date(year, month - 1, day);
  };

  // Format date for input (YYYY-MM-DD)
  const formatDateForInput = (dateStr: string) => {
    if (!dateStr) return '';
    return dateStr.split('T')[0]; // Remove time part if present
  };

  // Check if we're editing this date field
  const isEditingDate = isEditingThisCard && editingField === dateFieldToEdit;

  return (
    <div className="flex items-start justify-between mb-4">
      <div className="flex items-start space-x-3">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-lg text-[#1A2332]">
              {request.organizationName}
            </h3>
            <Badge className="inline-flex items-center rounded-full px-2.5 py-0.5 font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 hover:bg-primary/80 bg-gradient-to-br from-[#e6f2f5] to-[#d1e9ed] text-[#236383] border border-[#236383]/30 text-[16px]">
              <StatusIcon className="w-3 h-3 mr-1" />
              {getStatusLabel(request.status)}
            </Badge>
            {isInProcessStale && (
              <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-300">
                <AlertTriangle className="w-3 h-3 mr-1" />
                Needs follow-up
              </Badge>
            )}
            {/* Staffing need badges */}
            {driverGap > 0 && (
              <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-300">
                <Car className="w-3 h-3 mr-1" />
                Need {driverGap} driver{driverGap > 1 ? 's' : ''}
              </Badge>
            )}
            {speakerGap > 0 && (
              <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-300">
                <Megaphone className="w-3 h-3 mr-1" />
                Need {speakerGap} speaker{speakerGap > 1 ? 's' : ''}
              </Badge>
            )}
            {volunteerGap > 0 && (
              <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-300">
                <Users className="w-3 h-3 mr-1" />
                Need {volunteerGap} volunteer{volunteerGap > 1 ? 's' : ''}
              </Badge>
            )}
          </div>
          <div className="text-sm text-[#236383] mt-1 space-y-1">
            {/* Contact Information */}
            <div className="text-sm text-gray-700 mb-2">
              <strong>{request.firstName} {request.lastName}</strong>
              {request.email && (
                <span className="ml-2">• {request.email}</span>
              )}
              {request.phone && (
                <span className="ml-2">• {request.phone}</span>
              )}
            </div>
            <div className="flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              {isEditingDate ? (
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{dateLabel}:</span>
                  <Input
                    type="date"
                    value={formatDateForInput(editingValue)}
                    onChange={(e) => setEditingValue?.(e.target.value)}
                    className="h-8 w-40"
                    autoFocus
                    data-testid="input-date"
                  />
                  <Button size="sm" onClick={saveEdit} data-testid="button-save-date">
                    <Save className="w-3 h-3" />
                  </Button>
                  <Button size="sm" variant="ghost" onClick={cancelEdit} data-testid="button-cancel-date">
                    <X className="w-3 h-3" />
                  </Button>
                </div>
              ) : (
                <div className="flex items-center gap-2 group">
                  <span data-testid="text-date-label" className="text-[16px]">
                    {dateLabel}: {' '}
                    <strong className="text-[16px]" data-testid="text-date-value">
                      {displayDate && dateInfo ? dateInfo.text : 'No date set'}
                    </strong>
                    {displayDate && getRelativeTime(displayDate.toString()) && (
                      <span className="text-[#236383] ml-1">({getRelativeTime(displayDate.toString())})</span>
                    )}
                  </span>
                  {canEdit && startEditing && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => startEditing(dateFieldToEdit, formatDateForInput(displayDate?.toString() || ''))}
                      className="h-6 px-2 opacity-30 group-hover:opacity-70 hover:opacity-100 transition-opacity"
                      title={`Edit ${dateLabel}`}
                      data-testid="button-edit-date"
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
    </div>
  );
};

// CardAssignments component - copied from shared
interface CardAssignmentsProps {
  request: EventRequest;
  resolveUserName: (id: string) => string;
  canEdit?: boolean;
  canSelfSignup?: (request: EventRequest, type: 'driver' | 'speaker' | 'volunteer') => boolean;
  isUserSignedUp?: (request: EventRequest, type: 'driver' | 'speaker' | 'volunteer') => boolean;
  onAssign?: (type: 'driver' | 'speaker' | 'volunteer') => void;
  onEditAssignment?: (type: 'driver' | 'speaker' | 'volunteer', personId: string) => void;
  onRemoveAssignment?: (type: 'driver' | 'speaker' | 'volunteer', personId: string) => void;
  onSelfSignup?: (type: 'driver' | 'speaker' | 'volunteer') => void;
}

const CardAssignments: React.FC<CardAssignmentsProps> = ({
  request,
  resolveUserName,
  canEdit = false,
  canSelfSignup,
  isUserSignedUp,
  onAssign,
  onEditAssignment,
  onRemoveAssignment,
  onSelfSignup,
}) => {
  const parsePostgresArray = (arr: any): string[] => {
    if (!arr) return [];
    if (Array.isArray(arr)) return arr;
    if (typeof arr === 'string') {
      if (arr === '{}' || arr === '') return [];
      let cleaned = arr.replace(/^{|}$/g, '');
      if (!cleaned) return [];
      if (cleaned.includes('"')) {
        const matches = cleaned.match(/"[^"]*"|[^",]+/g);
        return matches ? matches.map(item => item.replace(/"/g, '').trim()).filter(item => item) : [];
      }
      return cleaned.split(',').map(item => item.trim()).filter(item => item);
    }
    return [];
  };

  const renderAssignmentColumn = (
    type: 'driver' | 'speaker' | 'volunteer',
    icon: React.ReactNode,
    title: string,
    needed: number | null | undefined,
    assignedIds: string[] | any,
    details?: any
  ) => {
    const assigned = type === 'speaker' ?
      Object.keys(details || {}) :
      parsePostgresArray(assignedIds);

    const hasCapacity = typeof needed === 'number' ? assigned.length < needed : true;
    const canSignup = canSelfSignup && canSelfSignup(request, type);
    const isSignedUp = isUserSignedUp && isUserSignedUp(request, type);

    return (
      <div className="bg-white/60 rounded-lg p-4 border border-white/80 min-h-[120px]">
        {/* Header with icon, title and count */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            {icon}
            <span className="font-semibold text-base text-[#236383]">{title}</span>
          </div>
          {typeof needed === 'number' && (
            <div className="flex items-center gap-1">
              <span className={`text-sm font-medium ${
                assigned.length >= needed ? 'text-green-600' : 'text-orange-600'
              }`}>
                {assigned.length}/{needed}
              </span>
              {assigned.length < needed && (
                <UserX className="w-4 h-4 text-orange-600" />
              )}
            </div>
          )}
        </div>
        {/* Assigned people */}
        <div className="space-y-2 mb-3 min-h-[60px]">
          {assigned.length > 0 ? (
            assigned.map((personId: string) => {
              // Get name from details first, but if it's numeric-only (like "350"), treat it as an ID 
              const detailName = details?.[personId]?.name;
              const name = (detailName && !/^\d+$/.test(detailName)) ? detailName : resolveUserName(personId);
              return (
                <div key={personId} className="flex items-center justify-between bg-white/80 rounded px-3 py-2">
                  <span className="text-sm font-medium">{name}</span>
                  {canEdit && onRemoveAssignment && (
                    <button
                      onClick={() => onRemoveAssignment(type, personId)}
                      className="text-red-500 hover:text-red-700 hover:bg-red-50 rounded-full p-1"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>
              );
            })
          ) : (
            <div className="text-[#236383]/60 italic text-[16px]">No one assigned</div>
          )}
        </div>
        {/* Assign button */}
        {canEdit && hasCapacity && onAssign && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => onAssign(type)}
            className="w-full text-sm border-[#FBAD3F] text-[#FBAD3F] hover:bg-[#FBAD3F] hover:text-white"
          >
            <UserPlus className="w-4 h-4 mr-2" />
            Assign {title.slice(0, -1)}
          </Button>
        )}
        {!canEdit && canSignup && onSelfSignup && (
          <Button
            size="sm"
            variant={isSignedUp ? "secondary" : "outline"}
            onClick={() => onSelfSignup(type)}
            className="w-full text-sm"
          >
            {isSignedUp ? 'Signed up' : 'Sign up'}
          </Button>
        )}
      </div>
    );
  };

  // Custom render for van driver (single assignment)
  const renderVanDriverAssignment = () => {
    if (!request.vanDriverNeeded && !request.assignedVanDriverId) {
      return null; // Don't show section if not needed and no one assigned
    }

    const assignedVanDriverName = request.assignedVanDriverId 
      ? (request.customVanDriverName || resolveUserName(request.assignedVanDriverId))
      : null;

    return (
      <div className="bg-white/60 rounded-lg p-4 border border-white/80 min-h-[120px]">
        {/* Header */}
        <div className="flex items-center gap-2 mb-3">
          <Car className="w-5 h-5 text-[#A31C41]" />
          <span className="font-semibold text-base text-[#A31C41]">Van Driver</span>
        </div>

        {/* Assigned van driver */}
        <div className="space-y-2 mb-3 min-h-[60px]">
          {assignedVanDriverName ? (
            <div className="flex items-center justify-between bg-white/80 rounded px-3 py-2">
              <span className="text-sm font-medium">{assignedVanDriverName}</span>
              {canEdit && onRemoveAssignment && (
                <button
                  onClick={() => onRemoveAssignment('driver', request.assignedVanDriverId!)}
                  className="text-red-500 hover:text-red-700 hover:bg-red-50 rounded-full p-1"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          ) : (
            <div className="text-sm text-[#A31C41]/60 italic">No van driver assigned</div>
          )}
        </div>

        {/* Assign button - only show if no one assigned yet */}
        {canEdit && !assignedVanDriverName && onAssign && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => onAssign('driver')}
            className="w-full text-sm border-[#A31C41] text-[#A31C41] hover:bg-[#A31C41] hover:text-white"
          >
            <UserPlus className="w-4 h-4 mr-2" />
            Assign Van Driver
          </Button>
        )}
      </div>
    );
  };

  return (
    <div className="pt-4">
      {/* Assignments Section */}
      <div className="grid grid-cols-3 gap-4">
        {/* Drivers Column */}
        {renderAssignmentColumn(
          'driver',
          <Car className="w-5 h-5 text-[#236383]" />,
          'Drivers',
          request.driversNeeded,
          request.assignedDriverIds,
          request.driverDetails
        )}

        {/* Speakers Column */}
        {renderAssignmentColumn(
          'speaker',
          <Megaphone className="w-5 h-5 text-[#236383]" />,
          'Speakers',
          request.speakersNeeded,
          request.assignedSpeakerIds,
          request.speakerDetails
        )}

        {/* Volunteers Column */}
        {renderAssignmentColumn(
          'volunteer',
          <Users className="w-5 h-5 text-[#236383]" />,
          'Volunteers',
          request.volunteersNeeded,
          request.assignedVolunteerIds,
          request.volunteerDetails
        )}
      </div>

      {/* Van Driver Section - separate row if needed */}
      {(request.vanDriverNeeded || request.assignedVanDriverId) && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
          <div className="md:col-span-1">
            {renderVanDriverAssignment()}
          </div>
          <div className="md:col-span-2"></div> {/* Empty space to maintain layout */}
        </div>
      )}
    </div>
  );
};

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
  // Helper function for parsing postgres arrays
  const parsePostgresArray = (arr: any): string[] => {
    if (!arr) return [];
    if (Array.isArray(arr)) return arr;
    if (typeof arr === 'string') {
      if (arr === '{}' || arr === '') return [];
      let cleaned = arr.replace(/^{|}$/g, '');
      if (!cleaned) return [];
      if (cleaned.includes('"')) {
        const matches = cleaned.match(/"[^"]*"|[^",]+/g);
        return matches ? matches.map(item => item.replace(/"/g, '').trim()).filter(item => item) : [];
      }
      return cleaned.split(',').map(item => item.trim()).filter(item => item);
    }
    return [];
  };
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
            className="h-8"
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
      <div className="group">
        <p className="text-gray-600 font-bold text-[17px]">{label}</p>
        <div className="flex items-center gap-2">
          {field === 'eventAddress' && value ? (
            <a 
              href={`https://maps.google.com/maps?q=${encodeURIComponent(value)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-lg text-[#236383] hover:text-[#FBAD3F] hover:underline transition-colors font-normal"
            >
              {value}
            </a>
          ) : (
            <p className="text-lg font-normal">{value || 'Not set'}</p>
          )}
          {canEdit && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                // For time fields, we need to pass the raw 24-hour format value for the HTML input
                if (type === 'time') {
                  // Extract the raw time from the request object
                  const rawValue = request[field as keyof EventRequest] as string;
                  startEditing(field, rawValue || '');
                } else {
                  startEditing(field, value?.toString() || '');
                }
              }}
              className="h-6 px-2 opacity-30 group-hover:opacity-70 hover:opacity-100 transition-opacity"
              title={`Edit ${label}`}
            >
              <Edit2 className="w-3 h-3" />
            </Button>
          )}
        </div>
      </div>
    );
  };

  const renderSandwichEdit = () => {
    if (!(isEditingThisCard && editingField === 'sandwichTypes')) {
      const sandwichInfo = formatSandwichTypesDisplay(
        request.sandwichTypes,
        request.estimatedSandwichCount
      );

      return (
        <div className="group bg-amber-50 rounded-lg p-3">
          <div className="flex items-center gap-2">
            <Package className="w-5 h-5 text-amber-600" />
            <span className="text-lg font-semibold">Sandwiches:</span>
            <span className="text-lg font-normal">{sandwichInfo}</span>
            {canEdit && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => startEditing('sandwichTypes', '')}
                className="h-6 px-2 ml-2 opacity-0 group-hover:opacity-70 hover:opacity-100 transition-opacity"
                title="Edit sandwich types"
              >
                <Edit2 className="w-3 h-3" />
              </Button>
            )}
          </div>
        </div>
      );
    }

    // Editing sandwich types
    return (
      <div className="bg-amber-50 rounded-lg p-3 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-lg font-semibold">Edit Sandwiches</span>
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
          />
        ) : (
          <div className="space-y-2">
            {inlineSandwichTypes.map((item, index) => (
              <div key={index} className="flex gap-2">
                <Select
                  value={item.type}
                  onValueChange={(value) => updateInlineSandwichType(index, 'type', value)}
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
                  onChange={(e) => updateInlineSandwichType(index, 'quantity', parseInt(e.target.value) || 0)}
                  placeholder="Qty"
                  className="w-24"
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
    <Card className="transition-all duration-200 hover:shadow-lg border-l-4 border-l-[#236383] bg-gradient-to-br from-[#e6f2f5] via-[#d1e9ed] to-[#236383]/10 border border-[#236383]/30">
      <CardContent className="p-6">
        <CardHeader
          request={request}
          canEdit={canEdit}
          isEditingThisCard={isEditingThisCard}
          editingField={editingField || ''}
          editingValue={editingValue}
          startEditing={startEditing}
          saveEdit={saveEdit}
          cancelEdit={cancelEdit}
          setEditingValue={setEditingValue}
          resolveUserName={resolveUserName}
        />

        {/* Event Details - Editable */}
        <div className="space-y-3 mb-4">
          {/* Event Location */}
          <div className="bg-white/50 rounded-lg p-3 border border-white/60">
            {renderEditableField(
              'eventAddress',
              request.eventAddress,
              'Event Location',
              'text'
            )}
          </div>

          {/* Destinations - Always show this section if there's a destination or if user can edit */}
          {(request.overnightHoldingLocation || request.deliveryDestination || canEdit) && (
            <div className="bg-white/50 rounded-lg p-3 border border-white/60 space-y-3">
              {/* Overnight Holding Location */}
              {request.overnightHoldingLocation ? (
                <div>
                  {renderEditableField(
                    'overnightHoldingLocation',
                    request.overnightHoldingLocation,
                    '🌙 Overnight Holding Location',
                    'text'
                  )}
                  <div className="ml-6 mt-1">
                    {request.overnightPickupTime ? (
                      renderEditableField(
                        'overnightPickupTime',
                        formatTime12Hour(request.overnightPickupTime),
                        'Pickup Time',
                        'time'
                      )
                    ) : (
                      canEdit && (
                        <div className="group">
                          <p className="text-gray-600 font-bold text-[17px]">Pickup Time</p>
                          <div className="flex items-center gap-2">
                            <p className="text-lg font-normal text-gray-400">Not set</p>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => startEditing('overnightPickupTime', '')}
                              className="h-6 px-2 opacity-30 group-hover:opacity-70 hover:opacity-100 transition-opacity"
                              title="Add Pickup Time from Overnight Location"
                            >
                              <Edit2 className="w-3 h-3" />
                            </Button>
                          </div>
                        </div>
                      )
                    )}
                  </div>
                </div>
              ) : (
                canEdit && request.deliveryDestination && (
                  <div className="group">
                    <p className="text-gray-600 font-bold text-[17px]">🌙 Overnight Holding Location</p>
                    <div className="flex items-center gap-2">
                      <p className="text-lg font-normal text-gray-400">Not set</p>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => startEditing('overnightHoldingLocation', '')}
                        className="h-6 px-2 opacity-30 group-hover:opacity-70 hover:opacity-100 transition-opacity"
                        title="Add Overnight Holding Location"
                      >
                        <Edit2 className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                )
              )}

              {/* Final Delivery Destination */}
              {request.deliveryDestination ? (
                <div>
                  {renderEditableField(
                    'deliveryDestination',
                    request.deliveryDestination,
                    request.overnightHoldingLocation ? '📍 Final Delivery Destination' : '📍 Delivery Destination',
                    'text'
                  )}
                </div>
              ) : (
                canEdit && (
                  <div className="group">
                    <p className="text-gray-600 font-bold text-[17px]">📍 Delivery Destination</p>
                    <div className="flex items-center gap-2">
                      <p className="text-lg font-normal text-gray-400">Not set</p>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => startEditing('deliveryDestination', '')}
                        className="h-6 px-2 opacity-30 group-hover:opacity-70 hover:opacity-100 transition-opacity"
                        title="Add Delivery Destination"
                      >
                        <Edit2 className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                )
              )}
            </div>
          )}

          {/* Times & Logistics - Compact */}
          <div className="bg-white/50 rounded-lg p-2 border border-white/60">
            <div className="grid grid-cols-4 gap-3 text-sm">
              {renderEditableField(
                'eventStartTime',
                request.eventStartTime && formatTime12Hour(request.eventStartTime),
                'Start Time',
                'time'
              )}
              {renderEditableField(
                'eventEndTime',
                request.eventEndTime && formatTime12Hour(request.eventEndTime),
                'End Time',
                'time'
              )}
              {renderEditableField(
                'pickupTime',
                request.pickupTime && formatTime12Hour(request.pickupTime),
                'Pickup Time',
                'time'
              )}
              {renderEditableField(
                'hasRefrigeration',
                request.hasRefrigeration === true ? 'Yes' : request.hasRefrigeration === false ? 'No' : 'Unknown',
                'Refrigeration',
                'select',
                [
                  { value: 'true', label: 'Yes' },
                  { value: 'false', label: 'No' },
                  { value: 'unknown', label: 'Unknown' },
                ]
              )}
            </div>
          </div>

          {/* Sandwich Details */}
          <div className="bg-white/50 rounded-lg p-3 border border-white/60">
            {renderSandwichEdit()}
          </div>
        </div>

        {/* Notes Section */}
        <div className="bg-white/50 rounded-lg p-3 border border-white/60 mb-4">
          <h4 className="font-medium text-gray-700 mb-2 flex items-center gap-2">
            <MessageSquare className="w-4 h-4" />
            Notes
          </h4>
          <div className="space-y-3">
            {request.message && (
              <div>
                <p className="font-medium text-gray-600 mb-2 text-[16px]">Initial Request Message:</p>
                <p className="text-base text-gray-800 bg-blue-50 p-3 rounded border-l-4 border-blue-300 leading-relaxed">
                  {request.message}
                </p>
              </div>
            )}
            <div>
              {renderEditableField(
                'notes',
                request.notes,
                'Additional Notes',
                'text'
              )}
            </div>
          </div>
        </div>

        {/* Assignments */}
        <CardAssignments
          request={request}
          resolveUserName={resolveUserName}
          canEdit={canEdit}
          canSelfSignup={canSelfSignup}
          isUserSignedUp={isUserSignedUp}
          onAssign={(type) => openAssignmentDialog(type)}
          onEditAssignment={(type, personId) => openEditAssignmentDialog(type, personId)}
          onRemoveAssignment={(type, personId) => handleRemoveAssignment(type, personId)}
          onSelfSignup={(type) => handleSelfSignup(type)}
        />

        {/* TSP Contact Section - Prominent display */}
        {(request.tspContact || request.customTspContact) && (
          <div className="mt-4 p-4 bg-gradient-to-r from-[#FBAD3F]/10 to-[#D68319]/10 border-2 border-[#FBAD3F]/30 rounded-lg">
            <div className="flex items-center gap-3">
              <div className="bg-[#FBAD3F] p-2 rounded-full">
                <Building className="w-6 h-6 text-white" />
              </div>
              <div className="flex-1">
                <div className="text-lg font-bold text-[#D68319] mb-1">
                  TSP Contact
                </div>
                <div className="text-xl font-semibold text-[#236383]">
                  {request.tspContact ? (resolveUserName ? resolveUserName(request.tspContact) : request.tspContact) : request.customTspContact}
                </div>
                {request.tspContactAssignedDate && (
                  <div className="text-sm text-gray-600 mt-1">
                    Assigned {new Date(request.tspContactAssignedDate).toLocaleDateString()}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Staffing Summary - Visual representation */}
        <div className="mt-3 pt-3 border-t border-gray-200">
          <div className="grid grid-cols-3 gap-3">
            {/* Drivers */}
            <div className={`rounded-lg p-2 ${
              parsePostgresArray(request.assignedDriverIds).length >= (request.driversNeeded || 0)
                ? 'bg-green-50 border border-green-300'
                : 'bg-orange-50 border border-orange-300'
            }`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1">
                  <Car className={`w-4 h-4 ${
                    parsePostgresArray(request.assignedDriverIds).length >= (request.driversNeeded || 0)
                      ? 'text-green-600'
                      : 'text-orange-600'
                  }`} />
                  <span className="text-sm font-medium">Drivers</span>
                </div>
                <span className={`text-sm font-bold ${
                  parsePostgresArray(request.assignedDriverIds).length >= (request.driversNeeded || 0)
                    ? 'text-green-600'
                    : 'text-orange-600'
                }`}>
                  {parsePostgresArray(request.assignedDriverIds).length}/{request.driversNeeded || 0}
                </span>
              </div>
            </div>

            {/* Speakers */}
            <div className={`rounded-lg p-2 ${
              Object.keys(request.assignedSpeakerDetails || {}).length >= (request.speakersNeeded || 0)
                ? 'bg-green-50 border border-green-300'
                : 'bg-orange-50 border border-orange-300'
            }`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1">
                  <Megaphone className={`w-4 h-4 ${
                    Object.keys(request.assignedSpeakerDetails || {}).length >= (request.speakersNeeded || 0)
                      ? 'text-green-600'
                      : 'text-orange-600'
                  }`} />
                  <span className="text-sm font-medium">Speakers</span>
                </div>
                <span className={`text-sm font-bold ${
                  Object.keys(request.assignedSpeakerDetails || {}).length >= (request.speakersNeeded || 0)
                    ? 'text-green-600'
                    : 'text-orange-600'
                }`}>
                  {Object.keys(request.assignedSpeakerDetails || {}).length}/{request.speakersNeeded || 0}
                </span>
              </div>
            </div>

            {/* Volunteers */}
            <div className={`rounded-lg p-2 ${
              parsePostgresArray(request.assignedVolunteerIds).length >= (request.volunteersNeeded || 0)
                ? 'bg-green-50 border border-green-300'
                : 'bg-orange-50 border border-orange-300'
            }`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1">
                  <Users className={`w-4 h-4 ${
                    parsePostgresArray(request.assignedVolunteerIds).length >= (request.volunteersNeeded || 0)
                      ? 'text-green-600'
                      : 'text-orange-600'
                  }`} />
                  <span className="text-sm font-medium">Volunteers</span>
                </div>
                <span className={`text-sm font-bold ${
                  parsePostgresArray(request.assignedVolunteerIds).length >= (request.volunteersNeeded || 0)
                    ? 'text-green-600'
                    : 'text-orange-600'
                }`}>
                  {parsePostgresArray(request.assignedVolunteerIds).length}/{request.volunteersNeeded || 0}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t">
          <Button
            size="sm"
            variant="outline"
            onClick={onContact}
          >
            <span className="text-base font-medium">Contact Organizer</span>
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={onReschedule}
          >
            <span className="text-base font-medium">Reschedule</span>
          </Button>

          <div className="flex-1" />

          {canEdit && (
            <>
              <Button size="sm" variant="ghost" onClick={onEdit}>
                <Edit2 className="w-5 h-5" />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={onDelete}
                className="text-red-600 hover:text-red-700"
              >
                <Trash2 className="w-5 h-5" />
              </Button>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
};