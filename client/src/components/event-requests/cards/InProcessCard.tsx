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
  CalendarCheck,
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
  MapPin,
  FileText,
  MessageCircle,
} from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';
import {
  formatTime12Hour,
  formatEventDate,
  formatToolkitDate,
} from '@/components/event-requests/utils';
import { useDatePopulation, type DatePopulationInfo } from '@/components/event-requests/hooks/useDatePopulation';
import { formatSandwichTypesDisplay } from '@/lib/sandwich-utils';
import {
  statusColors,
  statusIcons,
  statusOptions,
  statusBorderColors,
  statusBgColors,
} from '@/components/event-requests/constants';
import { ConfirmationDialog } from '@/components/ui/confirmation-dialog';
import { Input } from '@/components/ui/input';
import type { EventRequest } from '@shared/schema';
import { EventRequestAuditLog } from '@/components/event-request-audit-log';
import { getMissingIntakeInfo } from '@/lib/event-request-validation';
import { MessageComposer } from '@/components/message-composer';
import { EventMessageThread } from '@/components/event-message-thread';
import { useEventCollaboration } from '@/hooks/use-event-collaboration';
import { CommentThread, CompactPresenceBadge } from '@/components/collaboration';
import { useAuth } from '@/hooks/useAuth';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

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
  onEditContactAttempt?: (attemptNumber: number) => void;
  onDeleteContactAttempt?: (attemptNumber: number) => Promise<void>;
  onAiSuggest?: () => void;
  onAiIntakeAssist?: () => void;
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
  canEditOrgDetails?: boolean;
  isEditingThisCard?: boolean;
  editingField?: string;
  editingValue?: string;
  startEditing?: (field: string, value: string) => void;
  saveEdit?: () => void;
  cancelEdit?: () => void;
  setEditingValue?: (value: string) => void;
  presentUsers?: Array<{ userId: string; userName: string; joinedAt: Date; lastHeartbeat: Date; socketId: string }>;
  currentUserId?: string;
  datePopulationInfo?: DatePopulationInfo;
}

const CardHeader: React.FC<CardHeaderProps> = ({
  request,
  resolveUserName,
  isInProcessStale,
  canEdit = false,
  canEditOrgDetails = false,
  isEditingThisCard = false,
  editingField = '',
  editingValue = '',
  startEditing,
  saveEdit,
  cancelEdit,
  setEditingValue,
  presentUsers = [],
  currentUserId = '',
  datePopulationInfo,
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

  // Check if we're editing organization or department fields
  const isEditingOrgName = isEditingThisCard && editingField === 'organizationName';
  const isEditingDepartment = isEditingThisCard && editingField === 'department';

  return {
    header: (
      <div className="mb-4">
        <div className="flex items-center gap-2 flex-wrap">
          {/* Real-time Presence Indicator */}
          {presentUsers && presentUsers.length > 0 && currentUserId && (
            <CompactPresenceBadge 
              users={presentUsers} 
              currentUserId={currentUserId}
              className="mr-1"
            />
          )}
          {/* Organization Name - with inline editing */}
          {isEditingOrgName ? (
            <div className="flex items-center gap-2">
              <Input
                value={editingValue}
                onChange={(e) => setEditingValue?.(e.target.value)}
                className="h-8 text-lg font-bold text-[#236383]"
                autoFocus
                data-testid="input-organization-name"
              />
              <Button size="sm" onClick={saveEdit} data-testid="button-save-org-name">
                <Save className="w-3 h-3" />
              </Button>
              <Button size="sm" variant="ghost" onClick={cancelEdit} data-testid="button-cancel-org-name">
                <X className="w-3 h-3" />
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-2 group">
              <h3 className="text-xl sm:text-2xl font-bold text-[#236383] flex items-center gap-2 break-words min-w-0">
                {request.organizationName}
              </h3>
              {canEditOrgDetails && startEditing && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => startEditing('organizationName', request.organizationName || '')}
                  className="h-6 px-2 opacity-30 group-hover:opacity-70 hover:opacity-100 transition-opacity"
                  title="Edit organization name"
                  data-testid="button-edit-org-name"
                >
                  <Edit2 className="w-3 h-3" />
                </Button>
              )}
            </div>
          )}

          {/* Department - with inline editing */}
          {(request.department || isEditingDepartment || canEditOrgDetails) && (
            <>
              <span className="text-gray-600">&bull;</span>
              {isEditingDepartment ? (
                <div className="flex items-center gap-2">
                  <Input
                    value={editingValue}
                    onChange={(e) => setEditingValue?.(e.target.value)}
                    className="h-8 text-sm font-normal text-gray-600"
                    placeholder="Department"
                    autoFocus
                    data-testid="input-department"
                  />
                  <Button size="sm" onClick={saveEdit} data-testid="button-save-department">
                    <Save className="w-3 h-3" />
                  </Button>
                  <Button size="sm" variant="ghost" onClick={cancelEdit} data-testid="button-cancel-department">
                    <X className="w-3 h-3" />
                  </Button>
                </div>
              ) : (
                <div className="flex items-center gap-2 group">
                  {request.department ? (
                    <span className="text-sm font-normal text-gray-600 break-words">{request.department}</span>
                  ) : canEditOrgDetails ? (
                    <span className="text-sm font-normal text-gray-400 italic">No department</span>
                  ) : null}
                  {canEditOrgDetails && startEditing && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => startEditing('department', request.department || '')}
                      className="h-6 px-2 opacity-30 group-hover:opacity-70 hover:opacity-100 transition-opacity"
                      title={request.department ? "Edit department" : "Add department"}
                      data-testid="button-edit-department"
                    >
                      <Edit2 className="w-3 h-3" />
                    </Button>
                  )}
                </div>
              )}
            </>
          )}
          {/* Confirmation Status Badge - Click to toggle */}
          <Badge
            onClick={() => {
              startEditing?.('isConfirmed', (!request.isConfirmed).toString());
              // Immediately save the toggle
              setTimeout(() => saveEdit?.(), 0);
            }}
            className={`px-2.5 py-1 text-sm font-medium shadow-sm inline-flex items-center cursor-pointer hover:opacity-80 transition-opacity whitespace-nowrap ${
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
              className="bg-amber-50 text-amber-700 border-amber-300 whitespace-nowrap"
            >
              <AlertTriangle className="w-3 h-3 mr-1" />
              Needs follow-up
            </Badge>
          )}
          {/* Past Date Warning Badge */}
          {isPast && (
            <Badge
              className="bg-[#A31C41] text-white px-2.5 py-0.5 text-sm font-medium shadow-sm inline-flex items-center whitespace-nowrap"
            >
              <Clock className="w-3 h-3 mr-1" />
              Date Passed
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
          <div className="flex items-center gap-2 group flex-wrap">
            <span className="text-base font-bold break-words" data-testid="text-date-value">
              {displayDate && dateInfo ? dateInfo.text : 'No date set'}
            </span>
            {displayDate && getRelativeTime(displayDate.toString()) && (
              <span className="text-sm opacity-80">
                ({getRelativeTime(displayDate.toString())})
              </span>
            )}
            {/* Date Population Badges */}
            {datePopulationInfo && datePopulationInfo.isOpen && (
              <Badge
                className="flex items-center gap-1 text-white text-xs px-2 py-0.5"
                style={{ backgroundColor: '#47B3CB' }}
                title="No other events scheduled or in process on this date"
              >
                <CalendarCheck className="w-3 h-3" />
                Open date
              </Badge>
            )}
            {datePopulationInfo && datePopulationInfo.scheduledCount > 0 && (
              <Badge
                className="flex items-center gap-1 text-white text-xs px-2 py-0.5"
                style={{ backgroundColor: '#FBAD3F' }}
                title={`${datePopulationInfo.scheduledCount} scheduled event${datePopulationInfo.scheduledCount > 1 ? 's' : ''} on this date`}
              >
                <AlertTriangle className="w-3 h-3" />
                {datePopulationInfo.scheduledCount} scheduled
              </Badge>
            )}
            {datePopulationInfo && datePopulationInfo.inProcessCount > 0 && (
              <Badge
                className="flex items-center gap-1 text-white text-xs px-2 py-0.5"
                style={{ backgroundColor: '#007E8C' }}
                title={`${datePopulationInfo.inProcessCount} in-process event${datePopulationInfo.inProcessCount > 1 ? 's' : ''} on this date`}
              >
                <Calendar className="w-3 h-3" />
                {datePopulationInfo.inProcessCount} in process
              </Badge>
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
                className="h-6 px-2 text-white hover:bg-white/20 transition-colors"
                title={`Edit ${dateLabel}`}
                data-testid="button-edit-date"
              >
                <Edit2 className="w-3 h-3" />
              </Button>
            )}
          </div>
        )}
        {request.eventAddress && (
          <div className="mt-3 pt-3 border-t border-white/20">
            <div className="flex items-center gap-2 mb-1">
              <MapPin className="w-4 h-4" />
              <span className="text-sm uppercase font-bold tracking-wide">Event Location</span>
            </div>
            <a
              href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(request.eventAddress)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-base font-bold break-words hover:underline"
            >
              {request.eventAddress}
            </a>
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
      <div className="flex items-center justify-between gap-2">
        <div className="space-y-1 min-w-0 flex-1">
          <div className="flex items-center gap-2 text-sm">
            <User className="w-4 h-4 text-gray-500 flex-shrink-0" />
            <span className="font-medium text-base break-words min-w-0">
              {request.firstName} {request.lastName}
            </span>
          </div>
          <div className="flex items-center gap-2 text-sm text-gray-600 min-w-0">
            <Mail className="w-4 h-4 text-gray-400 flex-shrink-0" />
            <span className="text-base break-all min-w-0">{request.email}</span>
          </div>
          {request.phone && (
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <Phone className="w-4 h-4 text-gray-400 flex-shrink-0" />
              <span className="text-base whitespace-nowrap">{request.phone}</span>
            </div>
          )}
          {request.eventAddress && (
            <div className="flex items-center gap-2 text-sm text-gray-600 min-w-0">
              <MapPin className="w-4 h-4 text-gray-400 flex-shrink-0" />
              <a
                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(request.eventAddress)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-brand-primary-muted hover:text-brand-primary-dark text-base break-words min-w-0"
              >
                {request.eventAddress}
              </a>
            </div>
          )}
        </div>
        <div className="flex flex-col gap-2 flex-shrink-0">
          {request.phone && onCall && (
            <Button
              size="sm"
              variant="outline"
              onClick={onCall}
              className="text-sm h-8"
            >
              <Phone className="w-4 h-4 mr-1" />
              Call
            </Button>
          )}
          {onContact && (
            <Button
              size="sm"
              variant="outline"
              onClick={onContact}
              className="text-sm h-8"
            >
              <Mail className="w-4 h-4 mr-1" />
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
  onEditContactAttempt,
  onDeleteContactAttempt,
  onAiSuggest,
  onAiIntakeAssist,
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
  const [showComments, setShowComments] = useState(false);
  const [showContactAttempts, setShowContactAttempts] = useState(false);
  const { user } = useAuth();

  // Collaboration hook for comments
  const collaboration = useEventCollaboration(request.id);

  // Date population hook - to show warnings for busy dates
  const { getDatePopulation } = useDatePopulation();
  const datePopulationInfo = getDatePopulation(
    request.scheduledEventDate || request.desiredEventDate,
    request.id
  );

  // Check if user has permission to edit organization details
  const canEditOrgDetails =
    (user?.permissions as string[] | undefined)?.includes('EVENT_REQUESTS_INLINE_EDIT_ORG_DETAILS') ||
    user?.role === 'super_admin' ||
    user?.role === 'admin';

  const headerContent = CardHeader({
    request,
    resolveUserName,
    isInProcessStale: isStale,
    canEdit: !!startEditing, // Enable editing if editing functions are provided
    canEditOrgDetails,
    isEditingThisCard,
    editingField,
    editingValue,
    startEditing,
    saveEdit,
    cancelEdit,
    setEditingValue,
    presentUsers: collaboration.presentUsers,
    currentUserId: user?.id,
    datePopulationInfo,
  });

  return (
    <Card
      id={`event-card-${request.id}`}
      className={`transition-all duration-200 hover:shadow-[0_2px_6px_rgba(0,0,0,0.10)] border-l-[4px] bg-[#FFF4E5] shadow-[0_1px_4px_rgba(0,0,0,0.08)] border-[#D8DEE2] rounded-xl ${
        isStale ? 'border-l-[#A31C41]' : ''
      }`}
      style={!isStale ? { borderLeftColor: statusBorderColors.in_process } : {}}
    >
      <CardContent className="p-3">
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
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4 mb-4">
          {/* Left Column - Event Details */}
          <div className="space-y-3">
            {/* Event Date - First in left column */}
            {headerContent.eventDate}
            {/* Contact Attempts Info */}
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
              <div className="flex items-center justify-between mb-2">
                {(request.contactAttempts || request.lastContactAttempt) && (
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
                )}
                <div className="flex items-center gap-2">
                  {Array.isArray(request.contactAttemptsLog) && request.contactAttemptsLog.length > 0 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowContactAttempts(!showContactAttempts)}
                      className="h-7 text-xs flex items-center gap-1 text-amber-800 hover:bg-amber-100"
                    >
                      {showContactAttempts ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                      {showContactAttempts ? 'Hide' : 'Show'} Details
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={onLogContact}
                    className="h-7 text-xs flex items-center gap-1 border-amber-300 hover:bg-amber-100"
                  >
                    <Phone className="w-3 h-3" />
                    Log Contact
                  </Button>
                </div>
              </div>

              {/* Contact Attempts Details */}
              {showContactAttempts && Array.isArray(request.contactAttemptsLog) && request.contactAttemptsLog.length > 0 && (
                <div className="mt-3 space-y-2 border-t border-amber-300 pt-3">
                  {request.contactAttemptsLog
                    .slice()
                    .sort((a, b) => {
                      // Sort by attemptNumber descending (most recent first)
                      return (b.attemptNumber || 0) - (a.attemptNumber || 0);
                    })
                    .map((attempt: any) => {
                      if (!attempt || typeof attempt !== 'object') return null;

                      const methodIcons = {
                        phone: <Phone className="w-3 h-3" />,
                        email: <Mail className="w-3 h-3" />,
                        text: <MessageCircle className="w-3 h-3" />,
                        both: <MessageSquare className="w-3 h-3" />,
                      };

                      const methodLabels = {
                        phone: 'Phone',
                        email: 'Email',
                        text: 'Text',
                        both: 'Phone & Email',
                      };

                      const outcomeLabels: { [key: string]: string } = {
                        successful: 'Successfully contacted - Got response',
                        no_answer: 'No answer - No response',
                        left_message: 'Left voicemail/message',
                        wrong_number: 'Wrong/disconnected number',
                        email_bounced: 'Email bounced/failed',
                        requested_callback: 'Requested callback/follow-up',
                        other: 'Other',
                      };

                      let parsedDate: Date | undefined;
                      if (attempt.timestamp) {
                        try {
                          parsedDate = new Date(attempt.timestamp);
                          if (isNaN(parsedDate.getTime())) {
                            parsedDate = undefined;
                          }
                        } catch (e) {
                          parsedDate = undefined;
                        }
                      }

                      const userName = attempt.createdByName || attempt.createdBy || 'Unknown';
                      const loggedByName = attempt.loggedByName;
                      const showLoggedBy = loggedByName && loggedByName !== userName && loggedByName !== 'Unknown';

                      return (
                        <div
                          key={attempt.attemptNumber || attempt.timestamp}
                          className="bg-white rounded p-2 border border-amber-200 text-sm"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="font-semibold text-amber-900">
                                  Attempt #{attempt.attemptNumber || '?'}
                                </span>
                                {attempt.method && (
                                  <div className="flex items-center gap-1 text-amber-700">
                                    {methodIcons[attempt.method as keyof typeof methodIcons] || <Phone className="w-3 h-3" />}
                                    <span className="text-xs">{methodLabels[attempt.method as keyof typeof methodLabels] || attempt.method}</span>
                                  </div>
                                )}
                              </div>
                              {attempt.outcome && (
                                <div className="text-xs text-gray-700 mb-1">
                                  <span className="font-medium">Outcome:</span>{' '}
                                  {outcomeLabels[attempt.outcome] || attempt.outcome}
                                </div>
                              )}
                              {attempt.notes && (
                                <div className="text-xs text-gray-600 mb-1 whitespace-pre-wrap">
                                  {attempt.notes}
                                </div>
                              )}
                              <div className="flex items-center gap-2 text-xs text-gray-500">
                                {parsedDate && (
                                  <span>{parsedDate.toLocaleString()}</span>
                                )}
                                {userName && userName !== 'unknown' && userName !== 'system' && (
                                  <span>• by {userName}</span>
                                )}
                                {showLoggedBy && (
                                  <span className="text-gray-400 italic">
                                    (logged by {loggedByName})
                                  </span>
                                )}
                              </div>
                            </div>
                            {/* Edit/Delete buttons for contact attempts */}
                            <div className="flex gap-1 flex-shrink-0">
                              {onEditContactAttempt && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-6 w-6 p-0 text-amber-700 hover:text-amber-900 hover:bg-amber-100"
                                  onClick={() => onEditContactAttempt(attempt.attemptNumber)}
                                  title="Edit contact attempt"
                                >
                                  <Edit2 className="w-3 h-3" />
                                </Button>
                              )}
                              {onDeleteContactAttempt && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-6 w-6 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                                  onClick={() => onDeleteContactAttempt(attempt.attemptNumber)}
                                  title="Delete contact attempt"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </Button>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                </div>
              )}
            </div>

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

        {/* Notes & Requirements Section */}
        {(request.notes || request.schedulingNotes || request.planningNotes || request.additionalRequirements) && (
          <div className="bg-white rounded-lg p-4 mb-4 border border-gray-200">
            <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
              <FileText className="w-4 h-4" />
              Notes & Requirements
            </h3>
            <div className="space-y-3">
              {request.notes && (
                <div>
                  <p className="text-sm font-medium mb-1">Initial Request Notes:</p>
                  <p className="text-sm text-gray-700 bg-gray-50 p-3 rounded border-l-4 border-blue-400 whitespace-pre-wrap">
                    {request.notes}
                  </p>
                </div>
              )}
              {request.schedulingNotes && (
                <div>
                  <p className="text-sm font-medium mb-1">Scheduling Notes:</p>
                  <p className="text-sm text-gray-700 bg-green-50 p-3 rounded border-l-4 border-green-400 whitespace-pre-wrap">
                    {request.schedulingNotes}
                  </p>
                </div>
              )}
              {request.planningNotes && (
                <div>
                  <p className="text-sm font-medium mb-1">Planning Notes:</p>
                  <p className="text-sm text-gray-700 bg-yellow-50 p-3 rounded border-l-4 border-yellow-400 whitespace-pre-wrap">
                    {request.planningNotes}
                  </p>
                </div>
              )}
              {request.additionalRequirements && (
                <div>
                  <p className="text-sm font-medium mb-1">Additional Requirements:</p>
                  <p className="text-sm text-gray-700 bg-purple-50 p-3 rounded border-l-4 border-purple-400 whitespace-pre-wrap">
                    {request.additionalRequirements}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Communication & Notes Section */}
        {request.id && (
          <div className="bg-white rounded-lg p-4 mb-4 border border-gray-200">
            <div className="flex items-center justify-between mb-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowComments(!showComments)}
                className="flex-1 justify-between text-gray-700 hover:text-gray-700 hover:bg-gray-50 font-medium p-2 h-auto"
              >
                <div className="flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-gray-600" />
                  <h3 className="text-sm font-semibold">Team Comments</h3>
                  {collaboration.comments && collaboration.comments.length > 0 && (
                    <Badge variant="secondary" className="ml-1">
                      {collaboration.comments.length}
                    </Badge>
                  )}
                </div>
                {showComments ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowComments(true)}
                className="ml-2 border-[#007E8C] text-[#007E8C] hover:bg-[#007E8C]/10 h-8"
              >
                <MessageSquare className="w-4 h-4 mr-1" />
                Add Comment
              </Button>
            </div>

            {showComments && (
              <div className="mt-3 max-h-[500px]">
                <CommentThread
                  comments={collaboration.comments || []}
                  currentUserId={user?.id || ''}
                  currentUserName={user?.fullName || user?.email || ''}
                  onAddComment={collaboration.addComment}
                  onEditComment={collaboration.updateComment}
                  onDeleteComment={collaboration.deleteComment}
                  isLoading={collaboration.commentsLoading || false}
                />
              </div>
            )}

            <div className="mt-4 pt-4 border-t">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Comments & Messages</h3>
              <EventMessageThread
                eventId={request.id.toString()}
                eventRequest={request}
                eventTitle={`${request.organizationName} event`}
                maxHeight="300px"
                onEditContactAttempt={onEditContactAttempt}
                onDeleteContactAttempt={onDeleteContactAttempt}
              />
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <TooltipProvider>
          <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t items-center">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="sm"
                  variant="default"
                  onClick={onSchedule}
                  className="bg-[#FBAD3F] hover:bg-[#e89a2d] text-white h-8"
                >
                  <Calendar className="w-4 h-4 mr-1" />
                  Mark Scheduled
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Mark this event as scheduled</p>
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={onScheduleCall}
                  className="h-8"
                >
                  <Phone className="w-4 h-4 mr-1" />
                  {request.scheduledCallDate ? 'Reschedule Call' : 'Schedule Call'}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>{request.scheduledCallDate ? 'Reschedule the call with organizer' : 'Schedule a call with organizer'}</p>
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={onLogContact}
                  className="border-[#007E8C] text-[#007E8C] hover:bg-[#007E8C]/10 h-8"
                >
                  <MessageSquare className="w-4 h-4 mr-1" />
                  Log Contact
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Log a contact attempt or conversation</p>
              </TooltipContent>
            </Tooltip>

            {onResendToolkit && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button size="sm" variant="outline" onClick={onResendToolkit} className="h-8">
                    <Package className="w-4 h-4 mr-1" />
                    Resend Toolkit
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Resend toolkit email to organizer</p>
                </TooltipContent>
              </Tooltip>
            )}

            {/* TSP Contact Assignment - only show if not already assigned */}
            {!(request.tspContact || request.customTspContact) && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={onAssignTspContact}
                    className="border-yellow-500 text-yellow-700 hover:bg-yellow-50 h-8"
                  >
                    <UserPlus className="w-4 h-4 mr-1" />
                    Assign TSP Contact
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Assign a TSP contact to this event request</p>
                </TooltipContent>
              </Tooltip>
            )}

            {/* AI Date Suggestion - show if there are dates to analyze */}
            {(request.desiredEventDate || request.backupDates?.length) && onAiSuggest && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={onAiSuggest}
                    className="border-[#236383] text-[#236383] hover:bg-[#236383]/10 h-8"
                    data-testid="button-ai-suggest-date"
                  >
                    <Sparkles className="w-4 h-4 mr-1" />
                    AI Date Suggest
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Get AI suggestions for the best event date</p>
                </TooltipContent>
              </Tooltip>
            )}

            {/* AI Intake Assistant - always available */}
            {onAiIntakeAssist && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={onAiIntakeAssist}
                    className="border-[#47B3CB] text-[#47B3CB] hover:bg-[#47B3CB]/10 h-8"
                    data-testid="button-ai-intake-assist"
                  >
                    <Sparkles className="w-4 h-4 mr-1" />
                    AI Intake Check
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Use AI to check intake information</p>
                </TooltipContent>
              </Tooltip>
            )}

            <div className="flex-1" />

            {canEdit && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button size="sm" variant="ghost" onClick={onEdit} className="h-8">
                    <Edit className="w-4 h-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Edit this event request</p>
                </TooltipContent>
              </Tooltip>
            )}
            {canDelete && (
              <ConfirmationDialog
                trigger={
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-red-600 hover:text-red-700 h-8"
                        data-testid="button-delete-request"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Delete this event request</p>
                    </TooltipContent>
                  </Tooltip>
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
        </TooltipProvider>

        {/* Audit Log Section */}
        <div className="mt-4 border-t border-gray-200 pt-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              setShowAuditLog(!showAuditLog);
            }}
            className="w-full justify-between text-gray-600 hover:text-gray-800 p-2 h-8"
            data-testid="button-toggle-audit-log"
            type="button"
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
        <DialogContent className="w-[95vw] max-w-2xl">
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
