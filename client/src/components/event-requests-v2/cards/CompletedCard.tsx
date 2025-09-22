import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Calendar,
  Clock,
  Package,
  Mail,
  Eye,
  Trash2,
  CheckCircle,
  FileText,
  MessageCircle,
  RefreshCw,
  MapPin,
  Building,
  AlertTriangle,
  Edit2,
  Save,
  X,
  Car,
  Megaphone,
  Users,
  UserPlus,
} from 'lucide-react';
import { formatTime12Hour, formatEventDate } from '@/components/event-requests/utils';
import { formatSandwichTypesDisplay } from '@/lib/sandwich-utils';
import { statusColors, statusIcons, statusOptions } from '@/components/event-requests/constants';
import { Input } from '@/components/ui/input';
import type { EventRequest } from '@shared/schema';

interface CompletedCardProps {
  request: EventRequest;
  onView: () => void;
  onDelete: () => void;
  onContact: () => void;
  onFollowUp1Day: () => void;
  onFollowUp1Month: () => void;
  onViewCollectionLog?: () => void;
  onReschedule: () => void;
  resolveUserName: (id: string) => string;
  canDelete?: boolean;
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
  setEditingValue
}) => {
  const StatusIcon = statusIcons[request.status as keyof typeof statusIcons] || statusIcons.new;
  
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
          </div>
          <div className="text-sm text-[#236383] mt-1 space-y-1">
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
        {/* Header with icon and title */}
        <div className="flex items-center gap-2 mb-3">
          {icon}
          <span className="font-semibold text-base text-[#236383]">{title}</span>
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

export const CompletedCard: React.FC<CompletedCardProps> = ({
  request,
  onView,
  onDelete,
  onContact,
  onFollowUp1Day,
  onFollowUp1Month,
  onViewCollectionLog,
  onReschedule,
  resolveUserName,
  canDelete = true,
}) => {
  return (
    <Card className="transition-all duration-200 hover:shadow-lg border-l-4 border-l-[#007E8C] bg-gradient-to-br from-[#e6f7f5] via-[#007E8C]/10 to-[#007E8C]/20 border border-[#007E8C]/30">
      <CardContent className="p-6">
        <CardHeader request={request} />

        {/* Event Summary */}
        <div className="space-y-3 mb-4">
          <div className="bg-white rounded-lg p-3 space-y-2">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-500">Event Time</p>
                <p className="font-medium">
                  {request.eventStartTime && formatTime12Hour(request.eventStartTime)}
                  {request.eventEndTime && ` - ${formatTime12Hour(request.eventEndTime)}`}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Actual Attendance</p>
                <p className="font-medium">
                  {request.actualAttendance || request.estimatedAttendance || 'Not recorded'}
                </p>
              </div>
            </div>

            {/* Delivery Destination */}
            {request.deliveryDestination && (
              <div className="bg-blue-50 rounded-lg p-3 mt-2">
                <div className="flex items-center gap-2 text-sm">
                  <MapPin className="w-4 h-4 text-blue-600" />
                  <span className="font-medium">Delivery Destination:</span>
                  <span>{request.deliveryDestination}</span>
                </div>
              </div>
            )}

            {/* Sandwich Info */}
            {(request.actualSandwichCount || request.estimatedSandwichCount || request.sandwichTypes) && (
              <div className="bg-green-50 rounded-lg p-3">
                <div className="flex items-center gap-2 text-sm">
                  <Package className="w-4 h-4 text-green-600" />
                  <span className="font-medium">Sandwiches Delivered:</span>
                  <span>
                    {request.actualSandwichCount
                      ? `${request.actualSandwichCount} delivered`
                      : formatSandwichTypesDisplay(request.sandwichTypes, request.estimatedSandwichCount)}
                  </span>
                </div>
              </div>
            )}

            {/* Follow-up Status */}
            <div className="flex gap-2">
              {request.followUpOneDayCompleted && (
                <Badge variant="success">
                  <CheckCircle className="w-3 h-3 mr-1" />
                  1-Day Follow-up Done
                </Badge>
              )}
              {request.followUpOneMonthCompleted && (
                <Badge variant="success">
                  <CheckCircle className="w-3 h-3 mr-1" />
                  1-Month Follow-up Done
                </Badge>
              )}
            </div>

            {/* Completion Notes */}
            {request.completionNotes && (
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-sm font-medium mb-1">Completion Notes:</p>
                <p className="text-sm text-gray-600">{request.completionNotes}</p>
              </div>
            )}
          </div>

          {/* Assignments Summary */}
          {(request.assignedDriverIds || request.speakerDetails || request.assignedVolunteerIds) && (
            <div className="bg-white rounded-lg p-3">
              <p className="text-sm font-medium mb-2">Event Team:</p>
              <CardAssignments
                request={request}
                resolveUserName={resolveUserName}
                canEdit={false}
              />
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t">
          <Button size="sm" variant="outline" onClick={onView}>
            <Eye className="w-4 h-4 mr-1" />
            View Details
          </Button>

          {!request.followUpOneDayCompleted && (
            <Button
              size="sm"
              variant="outline"
              onClick={onFollowUp1Day}
              className="bg-blue-50 hover:bg-blue-100"
            >
              <MessageCircle className="w-4 h-4 mr-1" />
              1-Day Follow-up
            </Button>
          )}

          {!request.followUpOneMonthCompleted && (
            <Button
              size="sm"
              variant="outline"
              onClick={onFollowUp1Month}
              className="bg-purple-50 hover:bg-purple-100"
            >
              <MessageCircle className="w-4 h-4 mr-1" />
              1-Month Follow-up
            </Button>
          )}

          {onViewCollectionLog && (
            <Button size="sm" variant="outline" onClick={onViewCollectionLog}>
              <FileText className="w-4 h-4 mr-1" />
              Collection Log
            </Button>
          )}

          <Button size="sm" variant="outline" onClick={onContact}>
            <Mail className="w-4 h-4 mr-1" />
            Contact
          </Button>

          <div className="flex-1" />

          <Button
            size="sm"
            variant="ghost"
            onClick={onReschedule}
            title="Create new event based on this one"
          >
            <RefreshCw className="w-4 h-4" />
          </Button>

          {canDelete && (
            <Button
              size="sm"
              variant="ghost"
              onClick={onDelete}
              className="text-red-600 hover:text-red-700"
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
};