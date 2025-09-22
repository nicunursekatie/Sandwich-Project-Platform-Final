import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Calendar,
  Clock,
  Package,
  Phone,
  Mail,
  Edit,
  Trash2,
  AlertTriangle,
  CheckCircle,
  MessageSquare,
  Building,
  Edit2,
  Save,
  X,
  User,
} from 'lucide-react';
import {
  formatTime12Hour,
  formatEventDate,
} from '@/components/event-requests/utils';
import { formatSandwichTypesDisplay } from '@/lib/sandwich-utils';
import {
  statusColors,
  statusIcons,
  statusOptions,
} from '@/components/event-requests/constants';
import { Input } from '@/components/ui/input';
import type { EventRequest } from '@shared/schema';

interface InProcessCardProps {
  request: EventRequest;
  resolveUserName?: (id: string) => string;
  isStale?: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onSchedule: () => void;
  onCall: () => void;
  onContact: () => void;
  onScheduleCall: () => void;
  onResendToolkit?: () => void;
  canEdit?: boolean;
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
  setEditingValue,
}) => {
  const StatusIcon =
    statusIcons[request.status as keyof typeof statusIcons] || statusIcons.new;

  // Get the proper status label from constants instead of just replacing underscores
  const getStatusLabel = (status: string) => {
    const statusOption = statusOptions.find(
      (option) => option.value === status
    );
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
              <Badge
                variant="outline"
                className="bg-amber-50 text-amber-700 border-amber-300"
              >
                <AlertTriangle className="w-3 h-3 mr-1" />
                Needs follow-up
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
            {/* TSP Contact */}
            {(request.tspContact || request.customTspContact) && (
              <div className="text-sm text-[#D68319] mb-2">
                <span className="font-medium">TSP Contact: </span>
                <span className="font-normal">
                  {request.tspContact ? resolveUserName(request.tspContact) : request.customTspContact}
                </span>
                {request.tspContactAssignedDate && (
                  <span className="ml-2 text-xs text-gray-500">
                    (assigned {new Date(request.tspContactAssignedDate).toLocaleDateString()})
                  </span>
                )}
              </div>
            )}
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
                  <Button
                    size="sm"
                    onClick={saveEdit}
                    data-testid="button-save-date"
                  >
                    <Save className="w-3 h-3" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={cancelEdit}
                    data-testid="button-cancel-date"
                  >
                    <X className="w-3 h-3" />
                  </Button>
                </div>
              ) : (
                <div className="flex items-center gap-2 group">
                  <span data-testid="text-date-label" className="text-[16px] font-bold">
                    {dateLabel}:{' '}
                    <strong
                      className="text-[16px] font-normal"
                      data-testid="text-date-value"
                    >
                      {displayDate && dateInfo ? dateInfo.text : 'No date set'}
                    </strong>
                    {displayDate && getRelativeTime(displayDate.toString()) && (
                      <span className="text-[#236383] ml-1">
                        ({getRelativeTime(displayDate.toString())})
                      </span>
                    )}
                  </span>
                  {canEdit && startEditing && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() =>
                        startEditing(
                          dateFieldToEdit,
                          formatDateForInput(displayDate?.toString() || '')
                        )
                      }
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

// CardContactInfo component - copied from shared
interface CardContactInfoProps {
  request: EventRequest;
  onCall?: () => void;
  onContact?: () => void;
}

const CardContactInfo: React.FC<CardContactInfoProps> = ({
  request,
  onCall,
  onContact,
}) => {
  return (
    <div className="bg-gray-50 rounded-lg p-3 space-y-2">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-sm">
            <User className="w-4 h-4 text-gray-500" />
            <span className="font-medium text-[16px]">
              {request.firstName} {request.lastName}
            </span>
          </div>
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <Mail className="w-4 h-4 text-gray-400" />
            <span className="text-[16px]">{request.email}</span>
          </div>
          {request.phone && (
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <Phone className="w-4 h-4 text-gray-400" />
              <span className="text-[16px]">{request.phone}</span>
            </div>
          )}
        </div>
        <div className="flex flex-col gap-2">
          {request.phone && onCall && (
            <Button
              size="sm"
              variant="outline"
              onClick={onCall}
              className="text-[15px]"
            >
              <Phone className="w-3 h-3 mr-1" />
              Call
            </Button>
          )}
          {onContact && (
            <Button
              size="sm"
              variant="outline"
              onClick={onContact}
              className="text-[15px]"
            >
              <Mail className="w-3 h-3 mr-1" />
              Email
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

export const InProcessCard: React.FC<InProcessCardProps> = ({
  request,
  resolveUserName,
  isStale = false,
  onEdit,
  onDelete,
  onSchedule,
  onCall,
  onContact,
  onScheduleCall,
  onResendToolkit,
  canEdit = true,
  canDelete = true,
}) => {
  return (
    <Card
      className={`transition-all duration-200 hover:shadow-lg border-l-4 border-l-[#FBAD3F] ${
        isStale
          ? 'bg-gradient-to-br from-[#FBAD3F]/30 via-[#FBAD3F]/20 to-[#FFF4E6] border border-[#FBAD3F]/50'
          : 'bg-gradient-to-br from-[#FFF4E6] via-[#FBAD3F]/10 to-[#FBAD3F]/20 border border-[#FBAD3F]/30'
      }`}
    >
      <CardContent className="p-6">
        <CardHeader request={request} isInProcessStale={isStale} />

        {/* Event Details */}
        <div className="space-y-3 mb-4">
          {/* Toolkit Sent Info */}
          {request.toolkitSentDate && (
            <div className="bg-yellow-50 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-1">
                <Package className="w-4 h-4 text-yellow-600" />
                <span className="text-sm font-medium">Toolkit sent:</span>
                <span className="text-sm">
                  {new Date(request.toolkitSentDate).toLocaleDateString()}
                </span>
                {isStale && (
                  <Badge
                    variant="outline"
                    className="ml-2 bg-amber-50 text-amber-700 border-amber-300"
                  >
                    <AlertTriangle className="w-3 h-3 mr-1" />
                    Over 1 week ago
                  </Badge>
                )}
              </div>
              {request.toolkitSentBy && (
                <div className="flex items-center gap-2 ml-6">
                  <User className="w-3 h-3 text-yellow-600" />
                  <span className="text-xs text-yellow-700">
                    Sent by: {resolveUserName ? resolveUserName(request.toolkitSentBy) : request.toolkitSentBy}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Scheduled Call Info */}
          {request.scheduledCallDate && (
            <div className="bg-blue-50 rounded-lg p-3">
              <div className="flex items-center gap-2">
                <Phone className="w-4 h-4 text-blue-600" />
                <span className="text-sm font-medium">Call scheduled:</span>
                <span className="text-sm">
                  {new Date(request.scheduledCallDate).toLocaleString()}
                </span>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-[16px] font-semibold text-[#236383]">
                Preferred Time
              </p>
              <p className="font-medium">
                {request.eventStartTime &&
                  formatTime12Hour(request.eventStartTime)}
                {request.eventEndTime &&
                  ` - ${formatTime12Hour(request.eventEndTime)}`}
              </p>
            </div>
          </div>

          {/* Sandwich Info */}
          {(request.estimatedSandwichCount || request.sandwichTypes) && (
            <div className="bg-amber-50 rounded-lg p-3">
              <div className="flex items-center gap-2 text-sm">
                <Package className="w-4 h-4 text-amber-600" />
                <span className="font-medium">Sandwiches:</span>
                <span>
                  {formatSandwichTypesDisplay(
                    request.sandwichTypes,
                    request.estimatedSandwichCount ?? undefined
                  )}
                </span>
              </div>
            </div>
          )}

          {/* Notes Section */}
          {(request.message || request.planningNotes) && (
            <div className="bg-gray-50 rounded-lg p-3">
              <h4 className="font-medium text-gray-700 mb-2 flex items-center gap-2">
                <MessageSquare className="w-4 h-4" />
                Notes
              </h4>
              <div className="space-y-3">
                {request.message && (
                  <div>
                    <p className="text-gray-500 mb-1 text-[16px]">
                      Initial Request Message:
                    </p>
                    <p className="text-sm text-gray-700 bg-blue-50 p-2 rounded border-l-3 border-blue-200">
                      {request.message}
                    </p>
                  </div>
                )}
                {request.planningNotes && (
                  <div>
                    <p className="text-xs text-gray-500 mb-1">
                      Planning Notes:
                    </p>
                    <p className="text-sm text-gray-700 bg-white p-2 rounded border">
                      {request.planningNotes}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Contact Info */}
        <CardContactInfo
          request={request}
          onCall={onCall}
          onContact={onContact}
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

        {/* Action Buttons */}
        <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t">
          <Button
            size="sm"
            variant="default"
            onClick={onSchedule}
            className="bg-[#FBAD3F] hover:bg-[#e89a2d] text-white"
          >
            <Calendar className="w-4 h-4 mr-1" />
            Mark Scheduled
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={onScheduleCall}
            className="text-[16px]"
          >
            <Phone className="w-4 h-4 mr-1" />
            {request.scheduledCallDate ? 'Reschedule Call' : 'Schedule Call'}
          </Button>
          {onResendToolkit && (
            <Button size="sm" variant="outline" onClick={onResendToolkit}>
              <Package className="w-4 h-4 mr-1" />
              Resend Toolkit
            </Button>
          )}

          <div className="flex-1" />

          {canEdit && (
            <Button size="sm" variant="ghost" onClick={onEdit}>
              <Edit className="w-4 h-4" />
            </Button>
          )}
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
