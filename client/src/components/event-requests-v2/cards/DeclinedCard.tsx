import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  XCircle,
  RefreshCw,
  Mail,
  Phone,
  Eye,
  Trash2,
  Calendar,
  Building,
  AlertTriangle,
  Edit2,
  Save,
  X,
} from 'lucide-react';
import { formatEventDate } from '@/components/event-requests/utils';
import { statusColors, statusIcons, statusOptions } from '@/components/event-requests/constants';
import { Input } from '@/components/ui/input';
import type { EventRequest } from '@shared/schema';

interface DeclinedCardProps {
  request: EventRequest;
  onView: () => void;
  onDelete: () => void;
  onContact: () => void;
  onCall: () => void;
  onReactivate: () => void;
  canDelete?: boolean;
  resolveUserName?: (id: string) => string;
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
    // Fix timezone issue by treating both dates as local
    const date = new Date(dateString + 'T00:00:00');
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Reset time to start of day for fair comparison
    
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
                  {request.tspContact ? (resolveUserName ? resolveUserName(request.tspContact) : request.tspContact) : request.customTspContact}
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

export const DeclinedCard: React.FC<DeclinedCardProps> = ({
  request,
  onView,
  onDelete,
  onContact,
  onCall,
  onReactivate,
  canDelete = true,
  resolveUserName,
}) => {
  const dateInfo = formatEventDate(request.desiredEventDate || '');

  return (
    <Card className="transition-all duration-200 hover:shadow-lg border-l-4 border-l-gray-400 bg-gradient-to-br from-gray-100 via-gray-50 to-red-50/20 border border-gray-300/30 opacity-90">
      <CardContent className="p-6">
        <CardHeader request={request} resolveUserName={resolveUserName} />

        {/* Decline Info */}
        <div className="space-y-3 mb-4">
          <div className="bg-red-50 rounded-lg p-3">
            <div className="flex items-center gap-2">
              <XCircle className="w-4 h-4 text-red-600" />
              <span className="text-sm font-medium text-red-700">
                Status: {request.status === 'declined' ? 'Declined' : 'Postponed'}
              </span>
              {request.statusChangedAt && (
                <span className="text-sm text-red-600">
                  on {new Date(request.statusChangedAt).toLocaleDateString()}
                </span>
              )}
            </div>
            {request.declineReason && (
              <p className="text-sm text-red-600 mt-2">
                Reason: {request.declineReason}
              </p>
            )}
          </div>

          {/* Original Request Info */}
          <div className="bg-white/70 rounded-lg p-3 space-y-2">
            <div>
              <p className="text-sm text-gray-500">Originally Requested Date</p>
              <p className="font-medium flex items-center gap-1">
                <Calendar className="w-4 h-4" />
                {dateInfo.display}
              </p>
            </div>
            {request.estimatedAttendance && (
              <div>
                <p className="text-sm text-gray-500">Estimated Attendance</p>
                <p className="font-medium">{request.estimatedAttendance}</p>
              </div>
            )}
            {request.estimatedSandwichCount && (
              <div>
                <p className="text-sm text-gray-500">Sandwich Count Requested</p>
                <p className="font-medium">{request.estimatedSandwichCount}</p>
              </div>
            )}
          </div>

          {/* Contact Info */}
          <div className="bg-white/70 rounded-lg p-3">
            <p className="text-sm font-medium mb-1">Contact:</p>
            <p className="text-sm">{request.firstName} {request.lastName}</p>
            <p className="text-sm text-gray-600">{request.email}</p>
            {request.phone && <p className="text-sm text-gray-600">{request.phone}</p>}
          </div>

          {/* Notes */}
          {request.notes && (
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-sm text-gray-600">{request.notes}</p>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t">
          <Button
            size="sm"
            variant="default"
            onClick={onReactivate}
            className="bg-[#FBAD3F] hover:bg-[#e89a2d] text-white"
          >
            <RefreshCw className="w-4 h-4 mr-1" />
            Reactivate Request
          </Button>

          <Button size="sm" variant="outline" onClick={onView}>
            <Eye className="w-4 h-4 mr-1" />
            View Details
          </Button>

          {request.phone && (
            <Button size="sm" variant="outline" onClick={onCall}>
              <Phone className="w-4 h-4 mr-1" />
              Call
            </Button>
          )}

          <Button size="sm" variant="outline" onClick={onContact}>
            <Mail className="w-4 h-4 mr-1" />
            Email
          </Button>

          <div className="flex-1" />

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