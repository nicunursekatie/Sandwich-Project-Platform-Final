import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { formatDistanceToNow } from 'date-fns';
import {
  Calendar,
  Clock,
  Package,
  Phone,
  Mail,
  Edit,
  Trash2,
  Users,
  MapPin,
  UserPlus,
  Building,
  AlertTriangle,
  Edit2,
  Save,
  X,
  User,
  History,
  ChevronDown,
  ChevronUp,
  MessageSquare,
  Sparkles,
} from 'lucide-react';
import { statusColors, statusIcons, statusOptions, statusBorderColors, statusBgColors } from '@/components/event-requests/constants';
import { formatEventDate } from '@/components/event-requests/utils';
import { ConfirmationDialog } from '@/components/ui/confirmation-dialog';
import { Input } from '@/components/ui/input';
import { formatSandwichTypesDisplay } from '@/lib/sandwich-utils';
import type { EventRequest } from '@shared/schema';
import { useAuth } from '@/hooks/useAuth';
import { hasPermission } from '@shared/unified-auth-utils';
import { PERMISSIONS } from '@shared/auth-utils';
import { EventRequestAuditLog } from '@/components/event-request-audit-log';
import { MessageComposer } from '@/components/message-composer';
import { EventMessageThread } from '@/components/event-message-thread';

interface NewRequestCardProps {
  request: EventRequest;
  onEdit: () => void;
  onDelete: () => void;
  onCall: () => void;
  onContact: () => void;
  onToolkit: () => void;
  onScheduleCall: () => void;
  onAssignTspContact: () => void;
  onEditTspContact: () => void;
  onApprove: () => void;
  onDecline: () => void;
  onLogContact: () => void;
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

interface User {
  id: string;
  firstName?: string;
  lastName?: string;
  displayName?: string;
  email: string;
  role?: string;
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
  handleConfirmToggleClick?: () => void;
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
  handleConfirmToggleClick
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
            <h3 className="text-2xl font-bold text-[#236383]">
              {request.organizationName}
              {request.department && (
                <span className="text-sm font-normal text-gray-600 ml-2">
                  &bull; {request.department}
                </span>
              )}
            </h3>
            {/* Confirmation Status Badge - Click to toggle */}
            <Badge
              onClick={handleConfirmToggleClick}
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
              <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-300">
                <AlertTriangle className="w-3 h-3 mr-1" />
                Needs follow-up
              </Badge>
            )}
          </div>
          <div className="text-sm text-[#007E8C] mt-1 space-y-1">
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
                  <span data-testid="text-date-label" className="text-sm uppercase text-gray-600">
                    {dateLabel}: {' '}
                    <strong className="text-base font-bold text-[#236383]" data-testid="text-date-value">
                      {displayDate && dateInfo ? dateInfo.text : 'No date set'}
                    </strong>
                    {displayDate && getRelativeTime(displayDate.toString()) && (
                      <span className="text-[#007E8C] ml-1">({getRelativeTime(displayDate.toString())})</span>
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

// CardContactInfo component - copied from shared
interface CardContactInfoProps {
  request: EventRequest;
  onCall?: () => void;
  onContact?: () => void;
}

const CardContactInfo: React.FC<CardContactInfoProps> = ({
  request,
  onCall,
  onContact
}) => {
  return (
    <div className="bg-gray-50 rounded-lg p-3 space-y-2">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-sm">
            <User className="w-4 h-4 text-gray-500" />
            <span className="font-medium text-base">
              {request.firstName} {request.lastName}
            </span>
          </div>
          {request.email && (
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <Mail className="w-4 h-4 text-gray-400" />
              <a
                href={`mailto:${request.email}`}
                className="text-brand-primary-muted hover:text-brand-primary-dark text-base"
              >
                {request.email}
              </a>
            </div>
          )}
          {request.phone && (
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <Phone className="w-4 h-4 text-gray-400" />
              <a
                href={`tel:${request.phone}`}
                className="text-brand-primary-muted hover:text-brand-primary-dark text-base"
              >
                {request.phone}
              </a>
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

export const NewRequestCard: React.FC<NewRequestCardProps> = ({
  request,
  onEdit,
  onDelete,
  onCall,
  onContact,
  onToolkit,
  onScheduleCall,
  onAssignTspContact,
  onEditTspContact,
  onApprove,
  onDecline,
  onLogContact,
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
  const [showConfirmToggle, setShowConfirmToggle] = useState(false);
  const [pendingConfirmValue, setPendingConfirmValue] = useState(false);
  const queryClient = useQueryClient();
  const { user } = useAuth();

  // Mutation for toggling date confirmation
  const toggleConfirmMutation = useMutation({
    mutationFn: async (newValue: boolean) => {
      const response = await fetch(`/api/event-requests/${request.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isConfirmed: newValue }),
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to update confirmation status');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/event-requests'] });
      setShowConfirmToggle(false);
    },
  });

  const handleConfirmToggleClick = () => {
    setPendingConfirmValue(!request.isConfirmed);
    setShowConfirmToggle(true);
  };

  // Fetch users data for TSP contact name lookup
  const { data: users = [] } = useQuery<User[]>({
    queryKey: ['/api/users/basic'],
    enabled: !!request.tspContact, // Only fetch if there's a TSP contact assigned
  });

  // Helper function to get user display name from user ID
  const getUserDisplayName = (userId: string): string => {
    const user = users.find((u) => u.id === userId);
    if (!user) return userId;
    return (
      `${user.firstName || ''} ${user.lastName || ''}`.trim() ||
      user.displayName ||
      user.email ||
      'Unknown User'
    );
  };

  // Check if user can edit TSP contact assignments
  const canEditTspContact = hasPermission(
    user,
    PERMISSIONS.EVENT_REQUESTS_EDIT_TSP_CONTACT
  );
  return (
    <Card
      className={`transition-all duration-200 hover:shadow-[0_12px_32px_rgba(28,27,25,0.12)] border-l-[6px] bg-[#E2F5F6] shadow-[0_10px_30px_rgba(28,27,25,0.12),_0_3px_8px_rgba(28,27,25,0.08)]`}
      style={{ borderLeftColor: statusBorderColors.new }}
    >
      <CardContent className="p-6">
        <CardHeader
          request={request}
          canEdit={!!startEditing}
          isEditingThisCard={isEditingThisCard}
          editingField={editingField}
          editingValue={editingValue}
          startEditing={startEditing}
          saveEdit={saveEdit}
          cancelEdit={cancelEdit}
          setEditingValue={setEditingValue}
          handleConfirmToggleClick={handleConfirmToggleClick}
        />

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
          {/* Left Column - Event Details */}
          <div className="space-y-3">
            {/* Submitted Info */}
            <div className="bg-brand-primary-lighter rounded-lg p-3">
              <p className="text-sm uppercase font-bold tracking-wide text-[#236383] mb-1">
                Submitted
              </p>
              <div className="space-y-1">
                <div className="font-medium flex items-center gap-2 text-base">
                  <Clock className="w-4 h-4" />
                  {request.createdAt
                    ? new Date(request.createdAt).toLocaleDateString() +
                      ' at ' +
                      new Date(request.createdAt).toLocaleTimeString()
                    : 'Unknown date'}
                  {request.createdAt && (
                    <Badge className="ml-1 bg-[#236383] text-white border-0 shadow-lg hover:bg-[#007E8C] transition-all duration-200 text-sm">
                      {formatDistanceToNow(new Date(request.createdAt), {
                        addSuffix: true,
                      })}
                    </Badge>
                  )}
                </div>
                {(request.contactAttempts || request.lastContactAttempt) && (
                  <div className="text-sm text-gray-600 flex items-center gap-2 mt-2">
                    <Phone className="w-3 h-3" />
                    {request.contactAttempts && request.contactAttempts > 0 && (
                      <span>Contact attempts: {request.contactAttempts}</span>
                    )}
                    {request.lastContactAttempt && (
                      <span className="text-xs">
                        (Last: {formatDistanceToNow(new Date(request.lastContactAttempt), { addSuffix: true })})
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Sandwich Info */}
            {(request.estimatedSandwichCount !== undefined && request.estimatedSandwichCount !== null) || request.sandwichTypes ? (
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
            ) : null}

            {/* Previous Host Status */}
            {typeof request.hasHostedBefore !== 'undefined' && (
              <div className="bg-gray-50 rounded-lg p-3">
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-sm uppercase font-bold tracking-wide text-[#236383]">
                    Previously hosted:
                  </span>
                  <Badge
                    className={
                      request.hasHostedBefore
                        ? 'inline-flex items-center rounded-full px-2.5 py-0.5 font-semibold focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 border-transparent bg-[#007E8C] text-white border-0 shadow-lg hover:bg-[#47B3CB] transition-all duration-200 text-sm'
                        : 'inline-flex items-center rounded-full px-2.5 py-0.5 font-semibold focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 border-transparent bg-[#236383] text-white border-0 shadow-lg hover:bg-[#007E8C] transition-all duration-200 text-sm'
                    }
                  >
                    {request.hasHostedBefore ? 'Yes' : 'No - First Time'}
                  </Badge>
                </div>
              </div>
            )}
          </div>

          {/* Right Column - Contact Info */}
          <div className="space-y-3">
            <CardContactInfo
              request={request}
              onCall={onCall}
              onContact={onContact}
            />

            {/* TSP Contact Assignment Status */}
            {(request.tspContact || request.customTspContact) && (
              <div
                className="rounded-lg p-3 border border-[#FBAD3F] shadow-sm"
                style={{ backgroundColor: '#FFF4E6', borderColor: '#FBAD3F' }}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <UserPlus className="w-4 h-4 text-[#E5901A]" />
                    <span className="font-semibold text-[#D68319]">
                      TSP Contact:
                    </span>
                    <span className="font-medium text-[#C7761A]">
                      {request.tspContact
                        ? getUserDisplayName(request.tspContact)
                        : request.customTspContact}
                    </span>
                  </div>
                  {canEditTspContact && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={onEditTspContact}
                      className="h-6 px-2 text-[#D68319] hover:bg-[#FBAD3F]/20"
                      data-testid="button-edit-tsp-contact"
                    >
                      <Edit className="w-3 h-3" />
                    </Button>
                  )}
                </div>
                {request.tspContactAssignedDate && (
                  <p className="text-sm text-[#D68319] mt-1">
                    Assigned on{' '}
                    {new Date(
                      request.tspContactAssignedDate
                    ).toLocaleDateString()}
                  </p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Communication & Notes Section */}
        {request.id && (
          <div className="bg-white rounded-lg p-4 mb-4 border border-gray-200">
            <EventMessageThread
              eventId={request.id.toString()}
              eventRequest={request}
              eventTitle={`${request.organizationName} event`}
              maxHeight="300px"
            />
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t">
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

          {/* AI Intake Assistant - always available */}
          {onAiIntakeAssist && (
            <Button
              size="sm"
              variant="outline"
              onClick={onAiIntakeAssist}
              className="border-[#47B3CB] text-[#47B3CB] hover:bg-[#47B3CB]/10"
              data-testid="button-ai-intake-assist"
            >
              <Sparkles className="w-4 h-4 mr-1" />
              AI Intake Check
            </Button>
          )}

          <Button
            size="sm"
            variant="default"
            onClick={onToolkit}
            className="bg-[#FBAD3F] hover:bg-[#e89a2d] text-white text-base"
          >
            <Package className="w-4 h-4 mr-1" />
            Send Toolkit
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={onScheduleCall}
            className="text-base"
          >
            <Phone className="w-4 h-4 mr-1" />
            Schedule Call
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

          <div className="flex-1" />

          {/* Edit/Delete */}
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
              title="Delete Event Request"
              description={`Are you sure you want to delete the event request from ${request.organizationName}? This action cannot be undone.`}
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

        {/* Confirmation Toggle Dialog */}
        <ConfirmationDialog
          isOpen={showConfirmToggle}
          onClose={() => setShowConfirmToggle(false)}
          onConfirm={() => toggleConfirmMutation.mutate(pendingConfirmValue)}
          title={pendingConfirmValue ? 'Confirm Date' : 'Mark Date as Pending'}
          message={
            pendingConfirmValue
              ? 'Are you sure you want to mark this date as confirmed?'
              : 'Are you sure you want to mark this date as pending?'
          }
          confirmText="Yes, Update"
          cancelText="Cancel"
        />
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
