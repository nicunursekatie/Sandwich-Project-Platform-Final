import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
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
  UserPlus,
  History,
  ChevronDown,
  ChevronUp,
  Sparkles,
} from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';
import {
  formatTime12Hour,
  formatEventDate,
  formatToolkitDate,
} from '@/components/event-requests/utils';
import { formatSandwichTypesDisplay } from '@/lib/sandwich-utils';
import {
  statusColors,
  statusIcons,
  statusOptions,
} from '@/components/event-requests/constants';
import { ConfirmationDialog } from '@/components/ui/confirmation-dialog';
import { Input } from '@/components/ui/input';
import type { EventRequest } from '@shared/schema';
import { EventRequestAuditLog } from '@/components/event-request-audit-log';
import { getMissingIntakeInfo } from '@/lib/event-request-validation';
import { MessageComposer } from '@/components/message-composer';
import { EventMessageThread } from '@/components/event-message-thread';

interface InProcessCardProps {
  request: EventRequest;
  resolveUserName?: (id: string) => string;
  isStale?: boolean;
  followUpStatus?: 'toolkit' | 'contact' | null;
  onEdit: () => void;
  onDelete: () => void;
  onSchedule: () => void;
  onCall: () => void;
  onContact: () => void;
  onScheduleCall: () => void;
  onResendToolkit?: () => void;
  onAssignTspContact: () => void;
  onEditTspContact: () => void;
  onLogContact: () => void;
  onAiSuggest?: () => void;
  canEdit?: boolean;
  canDelete?: boolean;
  // Inline editing props
  startEditing?: (field: string, value: string) => void;
  saveEdit?: () => void;
  cancelEdit?: () => void;
  setEditingValue?: (value: string) => void;
  isEditingThisCard?: boolean;
  editingField?: string;
  editingValue?: string;
  tempIsConfirmed?: boolean;
}

// CardHeader component - copied from shared
interface CardHeaderProps {
  request: EventRequest;
  resolveUserName?: (id: string) => string;
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
  resolveUserName,
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
  const isMobile = useIsMobile();
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

  return {
    header: (
      <div className="mb-4">
        <div className="flex items-center gap-3 flex-wrap">
          <h3 className="text-2xl font-bold text-[#236383] flex items-center gap-2 break-words">
            {request.organizationName}
            {request.department && (
              <span className="text-sm font-normal text-gray-600 break-words">
                &bull; {request.department}
              </span>
            )}
          </h3>
          {/* Confirmation Status Badge - Click to toggle */}
          <Badge
            onClick={() => startEditing?.('isConfirmed', (!request.isConfirmed).toString())}
            className={`px-3 py-1 text-sm font-medium shadow-sm inline-flex items-center cursor-pointer hover:opacity-80 transition-opacity ${
              request.isConfirmed
                ? 'bg-gradient-to-br from-[#007E8C] to-[#47B3CB] text-white'
                : 'bg-gradient-to-br from-gray-500 to-gray-600 text-white'
            }`}
            title="Click to toggle confirmation status"
          >
            {request.isConfirmed ? '✓ Date Confirmed' : 'Date Pending'}
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

          {/* Validation badges for missing intake info */}
          {(() => {
            const missingInfo = getMissingIntakeInfo(request);
            if (missingInfo.length === 0) return null;

            // Always show individual badges listing each missing item
            return missingInfo.map((item) => (
              <Badge
                key={item}
                className="bg-[#A31C41] text-white px-2.5 py-0.5 text-sm font-medium shadow-sm inline-flex items-center"
                data-testid={`badge-missing-${item.toLowerCase().replace(' ', '-')}`}
              >
                <AlertTriangle className="w-3 h-3 mr-1" />
                Missing: {item}
              </Badge>
            ));
          })()}
        </div>
      </div>
    ),
    eventDate: (
      <div className="bg-[#236383] text-white rounded-lg p-4 shadow-md">
        <div className="flex items-center gap-2 mb-2">
          <Calendar className="w-5 h-5" />
          <span className="text-sm uppercase font-bold tracking-wide">Event Date</span>
        </div>
        {isEditingDate ? (
          <div className="flex items-center gap-2">
            <Input
              type="date"
              value={formatDateForInput(editingValue)}
              onChange={(e) => setEditingValue?.(e.target.value)}
              className="h-8 w-full bg-white text-gray-900"
              autoFocus
              data-testid="input-date"
            />
            <Button
              size="sm"
              onClick={saveEdit}
              className="bg-[#FBAD3F] hover:bg-[#e89a2d]"
              data-testid="button-save-date"
            >
              <Save className="w-3 h-3" />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={cancelEdit}
              className="text-white hover:bg-white/20"
              data-testid="button-cancel-date"
            >
              <X className="w-3 h-3" />
            </Button>
          </div>
        ) : (
          <div className="flex items-center gap-2 group">
            <span className="text-base font-bold break-words" data-testid="text-date-value">
              {displayDate && dateInfo ? dateInfo.text : 'No date set'}
            </span>
            {displayDate && getRelativeTime(displayDate.toString()) && (
              <span className="text-sm opacity-80">
                ({getRelativeTime(displayDate.toString())})
              </span>
            )}
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
                className="h-6 px-2 opacity-0 group-hover:opacity-70 hover:opacity-100 transition-opacity text-white hover:bg-white/20"
                title={`Edit ${dateLabel}`}
                data-testid="button-edit-date"
              >
                <Edit2 className="w-3 h-3" />
              </Button>
            )}
          </div>
        )}
      </div>
    )
  };
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
            <span className="font-medium text-base break-words">
              {request.firstName} {request.lastName}
            </span>
          </div>
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <Mail className="w-4 h-4 text-gray-400" />
            <span className="text-base break-words">{request.email}</span>
          </div>
          {request.phone && (
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <Phone className="w-4 h-4 text-gray-400" />
              <span className="text-base break-words">{request.phone}</span>
            </div>
          )}
        </div>
        <div className="flex flex-col gap-2">
          {request.phone && onCall && (
            <Button
              size="sm"
              variant="outline"
              onClick={onCall}
              className="text-sm"
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
              className="text-sm"
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
  followUpStatus = null,
  onEdit,
  onDelete,
  onSchedule,
  onCall,
  onContact,
  onScheduleCall,
  onResendToolkit,
  onAssignTspContact,
  onEditTspContact,
  onLogContact,
  onAiSuggest,
  canEdit = true,
  canDelete = true,
  // Inline editing props
  startEditing,
  saveEdit,
  cancelEdit,
  setEditingValue,
  isEditingThisCard = false,
  editingField = '',
  editingValue = '',
  tempIsConfirmed = false,
}) => {
  const [showAuditLog, setShowAuditLog] = useState(false);
  const [showMessageDialog, setShowMessageDialog] = useState(false);
  const headerContent = CardHeader({
    request,
    resolveUserName,
    isInProcessStale: isStale,
    canEdit: !!startEditing, // Enable editing if editing functions are provided
    isEditingThisCard,
    editingField,
    editingValue,
    startEditing,
    saveEdit,
    cancelEdit,
    setEditingValue
  });

  return (
    <Card
      id={`event-card-${request.id}`}
      className={`transition-all duration-200 hover:shadow-lg border-l-4 bg-white shadow-sm ${
        isStale
          ? 'border-l-[#A31C41]'
          : 'border-l-[#FBAD3F]'
      }`}
    >
      <CardContent className="p-6">
        {headerContent.header}

        {/* Toolkit Sent Status - Professional and brand-aligned */}
        {request.toolkitSentDate && (() => {
          const formattedDate = formatToolkitDate(request.toolkitSentDate);
          if (!formattedDate) return null;

          return (
            <div className="mb-4">
              <div className="inline-flex items-center gap-2 rounded-md border border-[#007E8C]/25 bg-[#00CED1]/10 text-[#007E8C] px-3 py-2 text-sm font-medium">
                <Package className="w-4 h-4" />
                <span>Toolkit sent {formattedDate}</span>
                {request.toolkitSentBy && (
                  <span className="text-xs text-[#007E8C]">
                    by {resolveUserName ? resolveUserName(request.toolkitSentBy) : request.toolkitSentBy}
                  </span>
                )}
              </div>
              {followUpStatus === 'toolkit' && (
                <div className="mt-2">
                  <Badge className="bg-red-500 text-white border-red-400 px-3 py-1">
                    <AlertTriangle className="w-4 h-4 mr-1" />
                    Follow-up needed - Over 1 week since toolkit sent
                  </Badge>
                </div>
              )}
              {followUpStatus === 'contact' && (
                <div className="mt-2">
                  <Badge className="bg-orange-500 text-white border-orange-400 px-3 py-1">
                    <AlertTriangle className="w-4 h-4 mr-1" />
                    Follow-up needed - Over 1 week since last contact
                  </Badge>
                </div>
              )}
            </div>
          );
        })()}

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
          {/* Left Column - Event Details */}
          <div className="space-y-3">
            {/* Event Date - First in left column */}
            {headerContent.eventDate}
            {/* Contact Attempts Info */}
            {(request.contactAttempts || request.lastContactAttempt) && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                <div className="flex items-center gap-2 text-amber-800">
                  <Phone className="w-4 h-4" />
                  {request.contactAttempts && request.contactAttempts > 0 && (
                    <span className="text-sm font-medium">
                      Contact attempts: {request.contactAttempts}
                    </span>
                  )}
                  {request.lastContactAttempt && (
                    <span className="text-xs">
                      (Last: {new Date(request.lastContactAttempt).toLocaleDateString()})
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* Scheduled Call Info */}
            {request.scheduledCallDate && (
              <div className="bg-brand-primary-lighter rounded-lg p-3">
                <div className="flex items-center gap-2">
                  <Phone className="w-4 h-4 text-brand-primary-muted" />
                  <span className="text-sm font-medium">Call scheduled:</span>
                  <span className="text-sm">
                    {new Date(request.scheduledCallDate).toLocaleString()}
                  </span>
                </div>
              </div>
            )}

            {/* Preferred Time */}
            {(request.eventStartTime || request.eventEndTime) && (
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-sm uppercase font-bold tracking-wide text-[#236383] mb-1">
                  Preferred Time
                </p>
                <p className="font-medium">
                  {request.eventStartTime &&
                    formatTime12Hour(request.eventStartTime)}
                  {request.eventEndTime &&
                    ` - ${formatTime12Hour(request.eventEndTime)}`}
                </p>
              </div>
            )}

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
          </div>

          {/* Right Column - Contact Info & TSP Contact */}
          <div className="space-y-3">
            {/* Contact Info */}
            <CardContactInfo
              request={request}
              onCall={onCall}
              onContact={onContact}
            />

            {/* TSP Contact Section - Prominent display */}
            {(request.tspContact || request.customTspContact) && (
              <div className="p-4 bg-gradient-to-r from-[#FBAD3F]/10 to-[#D68319]/10 border-2 border-[#FBAD3F]/30 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="bg-[#FBAD3F] p-2 rounded-full">
                    <Building className="w-6 h-6 text-white" />
                  </div>
                  <div className="flex-1">
                    <div className="text-sm uppercase font-bold tracking-wide text-[#236383] mb-1">
                      TSP Contact
                    </div>
                    <div className="text-base font-semibold text-[#007E8C] break-words">
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
          </div>
        </div>

        {/* Comprehensive Notes Section - Full Width */}
        {(request.message || request.planningNotes || request.schedulingNotes || request.additionalRequirements ||
          request.volunteerNotes || request.driverNotes || request.vanDriverNotes || request.followUpNotes ||
          request.distributionNotes || request.duplicateNotes || request.unresponsiveNotes || request.socialMediaPostNotes) && (
          <div className="bg-gray-50 rounded-lg p-4 mb-4">
            <h4 className="font-medium text-gray-700 mb-3 flex items-center gap-2">
              <MessageSquare className="w-4 h-4" />
              Notes & Requirements
            </h4>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              {request.message && (
                <div>
                  <p className="text-sm font-medium text-gray-600 mb-1">
                    Initial Request Message:
                  </p>
                  <p className="text-sm text-gray-700 bg-brand-primary-lighter p-2 rounded border-l-3 border-brand-primary-border">
                    {request.message}
                  </p>
                </div>
              )}
              {request.additionalRequirements && (
                <div>
                  <p className="text-sm font-medium text-gray-600 mb-1">
                    Special Requirements:
                  </p>
                  <p className="text-sm text-gray-700 bg-amber-50 p-2 rounded border-l-3 border-amber-200">
                    {request.additionalRequirements}
                  </p>
                </div>
              )}
              {request.planningNotes && (
                <div>
                  <p className="text-sm font-medium text-gray-600 mb-1">
                    Planning Notes:
                  </p>
                  <p className="text-sm text-gray-700 bg-white p-2 rounded border">
                    {request.planningNotes}
                  </p>
                </div>
              )}
              {request.schedulingNotes && (
                <div>
                  <p className="text-sm font-medium text-gray-600 mb-1">
                    Scheduling Notes:
                  </p>
                  <p className="text-sm text-gray-700 bg-green-50 p-2 rounded border-l-3 border-green-200">
                    {request.schedulingNotes}
                  </p>
                </div>
              )}
              {request.volunteerNotes && (
                <div>
                  <p className="text-sm font-medium text-gray-600 mb-1">
                    Volunteer Notes:
                  </p>
                  <p className="text-sm text-gray-700 bg-purple-50 p-2 rounded border-l-3 border-purple-200">
                    {request.volunteerNotes}
                  </p>
                </div>
              )}
              {request.driverNotes && (
                <div>
                  <p className="text-sm font-medium text-gray-600 mb-1">
                    Driver Notes:
                  </p>
                  <p className="text-sm text-gray-700 bg-orange-50 p-2 rounded border-l-3 border-orange-200">
                    {request.driverNotes}
                  </p>
                </div>
              )}
              {request.vanDriverNotes && (
                <div>
                  <p className="text-sm font-medium text-gray-600 mb-1">
                    Van Driver Notes:
                  </p>
                  <p className="text-sm text-gray-700 bg-red-50 p-2 rounded border-l-3 border-red-200">
                    {request.vanDriverNotes}
                  </p>
                </div>
              )}
              {request.followUpNotes && (
                <div>
                  <p className="text-sm font-medium text-gray-600 mb-1">
                    Follow-up Notes:
                  </p>
                  <p className="text-sm text-gray-700 bg-yellow-50 p-2 rounded border-l-3 border-yellow-200">
                    {request.followUpNotes}
                  </p>
                </div>
              )}
              {request.distributionNotes && (
                <div>
                  <p className="text-sm font-medium text-gray-600 mb-1">
                    Distribution Notes:
                  </p>
                  <p className="text-sm text-gray-700 bg-teal-50 p-2 rounded border-l-3 border-teal-200">
                    {request.distributionNotes}
                  </p>
                </div>
              )}
              {request.duplicateNotes && (
                <div>
                  <p className="text-sm font-medium text-gray-600 mb-1">
                    Duplicate Check Notes:
                  </p>
                  <p className="text-sm text-gray-700 bg-pink-50 p-2 rounded border-l-3 border-pink-200">
                    {request.duplicateNotes}
                  </p>
                </div>
              )}
              {request.unresponsiveNotes && (
                <div>
                  <p className="text-sm font-medium text-gray-600 mb-1">
                    Contact Attempts Logged:
                  </p>
                  <p className="text-sm text-gray-700 bg-gray-100 p-2 rounded border-l-3 border-gray-300">
                    {request.unresponsiveNotes}
                  </p>
                </div>
              )}
              {request.socialMediaPostNotes && (
                <div>
                  <p className="text-sm font-medium text-gray-600 mb-1">
                    Social Media Notes:
                  </p>
                  <p className="text-sm text-gray-700 bg-indigo-50 p-2 rounded border-l-3 border-indigo-200">
                    {request.socialMediaPostNotes}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Message Thread Section */}
        {request.id && (
          <div className="bg-white rounded-lg p-4 mb-4 border border-gray-200">
            <EventMessageThread
              eventId={request.id.toString()}
              eventTitle={`${request.organizationName} event`}
              maxHeight="300px"
            />
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
            className="text-base"
          >
            <Phone className="w-4 h-4 mr-1" />
            {request.scheduledCallDate ? 'Reschedule Call' : 'Schedule Call'}
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={onLogContact}
            className="text-base border-[#007E8C] text-[#007E8C] hover:bg-[#007E8C]/10"
          >
            <MessageSquare className="w-4 h-4 mr-1" />
            Log Contact
          </Button>
          {onResendToolkit && (
            <Button size="sm" variant="outline" onClick={onResendToolkit}>
              <Package className="w-4 h-4 mr-1" />
              Resend Toolkit
            </Button>
          )}

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

          {/* AI Date Suggestion - show if there are dates to analyze */}
          {(request.desiredEventDate || request.backupDates?.length) && onAiSuggest && (
            <Button
              size="sm"
              variant="outline"
              onClick={onAiSuggest}
              className="border-[#236383] text-[#236383] hover:bg-[#236383]/10"
              data-testid="button-ai-suggest-date"
            >
              <Sparkles className="w-4 h-4 mr-1" />
              AI Date Suggest
            </Button>
          )}

          <div className="flex-1" />

          {canEdit && (
            <>
              <Button
                size="sm"
                onClick={() => setShowMessageDialog(true)}
                variant="ghost"
                className="text-[#007E8C] hover:text-[#007E8C] hover:bg-[#007E8C]/10"
                aria-label="Message about this event"
              >
                <MessageSquare className="w-4 h-4" aria-hidden="true" />
              </Button>
              <Button size="sm" variant="ghost" onClick={onEdit}>
                <Edit className="w-4 h-4" />
              </Button>
            </>
          )}
          {canDelete && (
            <ConfirmationDialog
              trigger={
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-red-600 hover:text-red-700"
                  data-testid="button-delete-request"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              }
              title="Delete In-Process Event"
              description={`Are you sure you want to delete the in-process event from ${request.organizationName}? This will remove all progress and cannot be undone.`}
              confirmText="Delete Request"
              cancelText="Cancel"
              onConfirm={onDelete}
              variant="destructive"
            />
          )}
        </div>

        {/* Audit Log Section */}
        <div className="mt-4 border-t border-gray-200 pt-4">
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

      {/* Message Composer Dialog */}
      <Dialog open={showMessageDialog} onOpenChange={setShowMessageDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Message About Event: {request.organizationName}</DialogTitle>
          </DialogHeader>
          <MessageComposer
            contextType="event"
            contextId={request.id.toString()}
            contextTitle={`${request.organizationName} event`}
            onSent={() => setShowMessageDialog(false)}
            onCancel={() => setShowMessageDialog(false)}
          />
        </DialogContent>
      </Dialog>
    </Card>
  );
};
