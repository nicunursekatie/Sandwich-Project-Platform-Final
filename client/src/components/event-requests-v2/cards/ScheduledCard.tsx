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
  Check,
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
  const speakerGap = (request.speakersNeeded || 0) - Object.keys(request.speakerDetails || {}).length;
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
            <h3 className="font-semibold text-lg text-[#646464]">
              {request.organizationName}
            </h3>
            <Badge className="inline-flex items-center rounded-full px-2.5 py-0.5 font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 hover:bg-primary/80 bg-[#FBAD3F] text-white border border-[#FBAD3F] text-base shadow-sm">
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
              <Badge variant="outline" className="bg-[#A31C41]/10 text-[#A31C41] border-[#A31C41]/30 font-semibold shadow-sm">
                <Car className="w-3 h-3 mr-1" />
                Need {driverGap} driver{driverGap > 1 ? 's' : ''}
              </Badge>
            )}
            {speakerGap > 0 && (
              <Badge variant="outline" className="bg-[#A31C41]/10 text-[#A31C41] border-[#A31C41]/30 font-semibold shadow-sm">
                <Megaphone className="w-3 h-3 mr-1" />
                Need {speakerGap} speaker{speakerGap > 1 ? 's' : ''}
              </Badge>
            )}
            {volunteerGap > 0 && (
              <Badge variant="outline" className="bg-[#A31C41]/10 text-[#A31C41] border-[#A31C41]/30 font-semibold shadow-sm">
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
    const isFullyStaffed = typeof needed === 'number' ? assigned.length >= needed : false;
    const isUnderStaffed = typeof needed === 'number' ? assigned.length < needed : false;
    const isOverStaffed = typeof needed === 'number' ? assigned.length > needed : false;

    return (
      <div className={`rounded-lg p-4 border min-h-[140px] transition-all shadow-md ${
        isUnderStaffed 
          ? 'bg-gradient-to-br from-[#A31C41]/10 to-[#A31C41]/5 border-[#A31C41]/30' 
          : isFullyStaffed && !isOverStaffed
            ? 'bg-gradient-to-br from-[#236383]/10 to-[#236383]/5 border-[#236383]/30'
            : isOverStaffed
              ? 'bg-gradient-to-br from-[#47B3CB]/10 to-[#47B3CB]/5 border-[#47B3CB]/30'
              : 'bg-gradient-to-br from-white to-gray-50 border-gray-200'
      }`}>
        {/* Enhanced Header with clear status */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            {icon}
            <span className="font-semibold text-base text-[#236383]">{title}</span>
          </div>
          {typeof needed === 'number' && (
            <div className="flex items-center gap-2">
              {/* Status indicator */}
              <div className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium shadow-sm ${
                isUnderStaffed 
                  ? 'bg-[#A31C41]/20 text-[#A31C41] border border-[#A31C41]/40' 
                  : isFullyStaffed && !isOverStaffed
                    ? 'bg-[#236383]/20 text-[#236383] border border-[#236383]/40'
                    : isOverStaffed
                      ? 'bg-[#47B3CB]/20 text-[#47B3CB] border border-[#47B3CB]/40'
                      : 'bg-gray-100 text-gray-600'
              }`}>
                {isUnderStaffed && <AlertTriangle className="w-3 h-3" />}
                {isFullyStaffed && !isOverStaffed && <Check className="w-3 h-3" />}
                {isOverStaffed && <Users className="w-3 h-3" />}
                <span className="font-bold">
                  {assigned.length}/{needed}
                </span>
                {isUnderStaffed && <span className="ml-1">Need {needed - assigned.length} more</span>}
                {isOverStaffed && <span className="ml-1">+{assigned.length - needed} extra</span>}
                {isFullyStaffed && !isOverStaffed && <span className="ml-1">Complete</span>}
              </div>
            </div>
          )}
        </div>

        {/* Requirements summary */}
        {typeof needed === 'number' && (
          <div className="mb-3 text-xs text-gray-600 bg-white/50 rounded px-2 py-1">
            <span className="font-medium">Required:</span> {needed} {title.toLowerCase()}
            {assigned.length > 0 && (
              <span className="ml-2">
                • <span className="font-medium">Assigned:</span> {assigned.length}
                {isUnderStaffed && (
                  <span className="ml-2 text-red-600 font-medium">
                    • <span className="font-bold">Missing:</span> {needed - assigned.length}
                  </span>
                )}
                {isOverStaffed && (
                  <span className="ml-2 text-blue-600 font-medium">
                    • <span className="font-bold">Extra:</span> +{assigned.length - needed}
                  </span>
                )}
              </span>
            )}
          </div>
        )}
        
        {/* Assigned people */}
        <div className="space-y-2 mb-3 min-h-[40px]">
          {assigned.length > 0 ? (
            assigned.map((personId: string) => {
              // Extract name properly for custom assignments
              let name = '';
              let isCustomAssignment = false;
              
              if (personId.startsWith('custom-')) {
                // Parse custom ID format: custom-{timestamp}-{name-with-dashes}
                const parts = personId.split('-');
                if (parts.length >= 3) {
                  // Extract name part (everything after timestamp) and convert dashes back to spaces
                  const namePart = parts.slice(2).join('-').replace(/-/g, ' ');
                  name = namePart;
                  isCustomAssignment = true;
                } else {
                  name = personId; // fallback
                }
              } else {
                // Get name from details first, but if it's numeric-only (like "350"), treat it as an ID 
                const detailName = details?.[personId]?.name;
                name = (detailName && !/^\d+$/.test(detailName)) ? detailName : resolveUserName(personId);
              }
              
              return (
                <div key={personId} className="flex items-center justify-between bg-white/90 rounded px-3 py-2 shadow-sm">
                  <span className="text-sm font-medium">{name}</span>
                  <div className="flex items-center gap-1">
                    {/* Edit button for custom assignments */}
                    {canEdit && isCustomAssignment && onEditAssignment && (
                      <button
                        onClick={() => onEditAssignment(type, personId)}
                        className="text-blue-500 hover:text-blue-700 hover:bg-blue-50 rounded-full p-1"
                        title="Edit custom assignment"
                      >
                        <Edit2 className="w-3 h-3" />
                      </button>
                    )}
                    {/* Remove button */}
                    {canEdit && onRemoveAssignment && (
                      <button
                        onClick={() => onRemoveAssignment(type, personId)}
                        className="text-red-500 hover:text-red-700 hover:bg-red-50 rounded-full p-1"
                        title="Remove assignment"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          ) : (
            <div className="text-gray-500 italic text-sm text-center py-2 bg-white/30 rounded border-2 border-dashed border-gray-300">
              No one assigned yet
            </div>
          )}
        </div>
        
        {/* Action buttons */}
        <div className="space-y-2">
          {canEdit && onAssign && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => onAssign(type)}
              className={`w-full text-sm transition-all shadow-sm ${
                isUnderStaffed 
                  ? 'border-[#A31C41] text-[#A31C41] hover:bg-[#A31C41] hover:text-white bg-[#A31C41]/10 font-semibold' 
                  : 'border-[#236383] text-[#236383] hover:bg-[#236383] hover:text-white'
              }`}
            >
              <UserPlus className="w-4 h-4 mr-2" />
              {isUnderStaffed ? `Assign ${title.slice(0, -1)} (Urgent)` : `Add ${title.slice(0, -1)}`}
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
      </div>
    );
  };

  // Custom render for van driver (single assignment)
  const renderVanDriverAssignment = () => {
    if (!request.vanDriverNeeded && !request.assignedVanDriverId) {
      return null; // Don't show section if not needed and no one assigned
    }

    // Extract van driver name properly for custom assignments
    let assignedVanDriverName = null;
    let isCustomVanDriver = false;
    
    if (request.assignedVanDriverId) {
      if (request.assignedVanDriverId.startsWith('custom-')) {
        // Parse custom ID format: custom-{timestamp}-{name-with-dashes}
        const parts = request.assignedVanDriverId.split('-');
        if (parts.length >= 3) {
          // Extract name part (everything after timestamp) and convert dashes back to spaces
          const namePart = parts.slice(2).join('-').replace(/-/g, ' ');
          assignedVanDriverName = namePart;
          isCustomVanDriver = true;
        } else {
          assignedVanDriverName = request.customVanDriverName || request.assignedVanDriverId;
          isCustomVanDriver = true;
        }
      } else {
        assignedVanDriverName = request.customVanDriverName || resolveUserName(request.assignedVanDriverId);
      }
    }

    return (
      <div className="bg-gradient-to-br from-[#A31C41]/10 to-[#A31C41]/5 rounded-lg p-4 border border-[#A31C41]/30 min-h-[120px] shadow-md">
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
              <div className="flex items-center gap-1">
                {/* Edit button for custom van driver */}
                {canEdit && isCustomVanDriver && onEditAssignment && (
                  <button
                    onClick={() => onEditAssignment('driver', request.assignedVanDriverId!)}
                    className="text-blue-500 hover:text-blue-700 hover:bg-blue-50 rounded-full p-1"
                    title="Edit custom assignment"
                  >
                    <Edit2 className="w-3 h-3" />
                  </button>
                )}
                {/* Remove button */}
                {canEdit && onRemoveAssignment && (
                  <button
                    onClick={() => onRemoveAssignment('driver', request.assignedVanDriverId!)}
                    className="text-red-500 hover:text-red-700 hover:bg-red-50 rounded-full p-1"
                    title="Remove assignment"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
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
          null
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
        request.estimatedSandwichCount ?? undefined
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
    <Card className="transition-all duration-200 hover:shadow-lg border-l-4 border-l-[#FBAD3F] bg-gradient-to-br from-[#FBAD3F]/20 via-[#FBAD3F]/10 to-white border border-[#FBAD3F]/30 shadow-lg">
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
          <div className="bg-white/80 rounded-lg p-3 border border-[#FBAD3F]/20 shadow-sm">
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
              {/* Show overnight holding location field if it exists OR if editing */}
              {(request.overnightHoldingLocation || (canEdit && request.deliveryDestination)) && (
                <div>
                  {renderEditableField(
                    'overnightHoldingLocation',
                    request.overnightHoldingLocation || '',
                    '🌙 Overnight Holding Location',
                    'text'
                  )}
                  {/* Show pickup time if location exists or if currently editing pickup time */}
                  {(request.overnightHoldingLocation || (isEditingThisCard && editingField === 'overnightPickupTime')) && (
                    <div className="ml-6 mt-1">
                      {renderEditableField(
                        'overnightPickupTime',
                        request.overnightPickupTime ? formatTime12Hour(request.overnightPickupTime) : '',
                        'Pickup Time',
                        'time'
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Final Delivery Destination - Always show if editable or has value */}
              {(request.deliveryDestination || canEdit) && (
                <div>
                  {renderEditableField(
                    'deliveryDestination',
                    request.deliveryDestination || '',
                    request.overnightHoldingLocation ? '📍 Final Delivery Destination' : '📍 Delivery Destination',
                    'text'
                  )}
                </div>
              )}
            </div>
          )}

          {/* Times & Logistics - Smart Display */}
          <div className="bg-white/80 rounded-lg p-3 border border-[#FBAD3F]/20 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-medium text-gray-700 flex items-center gap-2">
                <Clock className="w-4 h-4" />
                Event Times & Logistics
              </h4>
              {canEdit && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    // If no times are set, start editing the most common one (start time)
                    if (!request.eventStartTime && !request.eventEndTime && !request.pickupTime) {
                      startEditing('eventStartTime', '');
                    }
                  }}
                  className="text-xs text-[#236383] hover:text-[#FBAD3F] opacity-70 hover:opacity-100 hover:bg-[#FBAD3F]/10 rounded-md"
                  title="Add missing times"
                >
                  + Add Times
                </Button>
              )}
            </div>
            <div className="grid gap-3 text-sm" style={{
              gridTemplateColumns: `repeat(${[
                request.eventStartTime,
                request.eventEndTime, 
                request.pickupTime,
                true // Always show refrigeration
              ].filter(Boolean).length}, 1fr)`
            }}>
              {/* Only show fields that have values or are currently being edited */}
              {(request.eventStartTime || (isEditingThisCard && editingField === 'eventStartTime')) && renderEditableField(
                'eventStartTime',
                request.eventStartTime && formatTime12Hour(request.eventStartTime),
                'Start Time',
                'time'
              )}
              {(request.eventEndTime || (isEditingThisCard && editingField === 'eventEndTime')) && renderEditableField(
                'eventEndTime',
                request.eventEndTime && formatTime12Hour(request.eventEndTime),
                'End Time',
                'time'
              )}
              {(request.pickupTime || (isEditingThisCard && editingField === 'pickupTime')) && renderEditableField(
                'pickupTime',
                request.pickupTime && formatTime12Hour(request.pickupTime),
                'Pickup Time',
                'time'
              )}
              {/* Always show refrigeration as it has meaningful states */}
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
            
            {/* Quick add buttons for missing times - only show if editing is enabled and times are missing */}
            {canEdit && !isEditingThisCard && (
              <div className="mt-3 pt-2 border-t border-gray-200">
                <div className="flex flex-wrap gap-2">
                  {!request.eventStartTime && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => startEditing('eventStartTime', '')}
                      className="text-xs border-[#236383]/40 text-[#236383] hover:bg-[#236383] hover:text-white shadow-sm"
                    >
                      + Start Time
                    </Button>
                  )}
                  {!request.eventEndTime && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => startEditing('eventEndTime', '')}
                      className="text-xs border-[#236383]/40 text-[#236383] hover:bg-[#236383] hover:text-white shadow-sm"
                    >
                      + End Time
                    </Button>
                  )}
                  {!request.pickupTime && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => startEditing('pickupTime', '')}
                      className="text-xs border-[#236383]/40 text-[#236383] hover:bg-[#236383] hover:text-white shadow-sm"
                    >
                      + Pickup Time
                    </Button>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Sandwich Details */}
          <div className="bg-white/80 rounded-lg p-3 border border-[#FBAD3F]/20 shadow-sm">
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
                'planningNotes',
                request.planningNotes,
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
          <div className="mt-4 p-4 bg-gradient-to-r from-[#FBAD3F]/15 to-[#FBAD3F]/8 border-2 border-[#FBAD3F]/40 rounded-lg shadow-md">
            <div className="flex items-center gap-3">
              <div className="bg-[#FBAD3F] p-2 rounded-full">
                <Building className="w-6 h-6 text-white" />
              </div>
              <div className="flex-1">
                <div className="text-lg font-bold text-[#FBAD3F] mb-1">
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