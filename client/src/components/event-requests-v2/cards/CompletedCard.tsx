import React, { useState, useEffect } from 'react';
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
  Check,
  History,
  ChevronDown,
  ChevronUp,
  Share2,
  Instagram,
} from 'lucide-react';
import { formatTime12Hour, formatEventDate } from '@/components/event-requests/utils';
import { formatSandwichTypesDisplay } from '@/lib/sandwich-utils';
import { ConfirmationDialog } from '@/components/ui/confirmation-dialog';
import { statusColors, statusIcons, statusOptions } from '@/components/event-requests/constants';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import type { EventRequest } from '@shared/schema';
import { EventRequestAuditLog } from '@/components/event-request-audit-log';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface CompletedCardProps {
  request: EventRequest;
  onView: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onContact: () => void;
  onFollowUp1Day: () => void;
  onFollowUp1Month: () => void;
  onViewCollectionLog?: () => void;
  onReschedule: () => void;
  onAssignTspContact: () => void;
  onEditTspContact: () => void;
  resolveUserName: (id: string) => string;
  canDelete?: boolean;
  openAssignmentDialog?: (type: 'driver' | 'speaker' | 'volunteer') => void;
  openEditAssignmentDialog?: (type: 'driver' | 'speaker' | 'volunteer', personId: string) => void;
  handleRemoveAssignment?: (type: 'driver' | 'speaker' | 'volunteer', personId: string) => void;
  handleSelfSignup?: (type: 'driver' | 'speaker' | 'volunteer') => void;
  canSelfSignup?: (request: EventRequest, type: 'driver' | 'speaker' | 'volunteer') => boolean;
  isUserSignedUp?: (request: EventRequest, type: 'driver' | 'speaker' | 'volunteer') => boolean;
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
              {request.department && (
                <span className="text-gray-600 ml-1">
                  &bull; {request.department}
                </span>
              )}
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
      <div className={`rounded-lg p-4 border min-h-[120px] ${
        isUnderStaffed 
          ? 'bg-red-50 border-red-200' 
          : isFullyStaffed && !isOverStaffed
            ? 'bg-teal-50 border-teal-200'
            : isOverStaffed
              ? 'bg-brand-primary-lighter border-brand-primary-border'
              : 'bg-white/60 border-white/80'
      }`}>
        {/* Header with clear status - Completed Event Summary */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            {icon}
            <span className="font-semibold text-base text-[#236383]">{title}</span>
          </div>
          {typeof needed === 'number' && (
            <div className="flex items-center gap-2">
              <div className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
                isUnderStaffed 
                  ? 'bg-red-100 text-red-700 border border-red-200' 
                  : isFullyStaffed && !isOverStaffed
                    ? 'bg-teal-100 text-teal-700 border border-teal-200'
                    : isOverStaffed
                      ? 'bg-brand-primary-light text-brand-primary border border-brand-primary-border'
                      : 'bg-gray-100 text-gray-600'
              }`}>
                {isUnderStaffed && <AlertTriangle className="w-3 h-3" />}
                {isFullyStaffed && !isOverStaffed && <Check className="w-3 h-3" />}
                {isOverStaffed && <Users className="w-3 h-3" />}
                <span className="font-bold">{assigned.length}/{needed}</span>
                {isUnderStaffed && <span className="ml-1">Short-staffed</span>}
                {isOverStaffed && <span className="ml-1">Extra help</span>}
                {isFullyStaffed && !isOverStaffed && <span className="ml-1">Fully staffed</span>}
              </div>
            </div>
          )}
        </div>
        
        {/* Final team summary */}
        {typeof needed === 'number' && (
          <div className="mb-3 text-xs text-gray-600 bg-white/50 rounded px-2 py-1">
            <span className="font-medium">Event Team:</span> {assigned.length} {title.toLowerCase()} 
            {needed > 0 && <span className="ml-2">(Requested: {needed})</span>}
          </div>
        )}
        
        {/* Team members who served */}
        <div className="space-y-2 mb-3">
          {assigned.length > 0 ? (
            assigned.map((personId: string) => {
              const detailName = details?.[personId]?.name;
              const name = (detailName && !/^\d+$/.test(detailName)) ? detailName : resolveUserName(personId);
              return (
                <div key={personId} className="flex items-center bg-white/90 rounded px-3 py-2 shadow-sm">
                  <Check className="w-3 h-3 text-teal-600 mr-2" />
                  <span className="text-sm font-medium">{name}</span>
                </div>
              );
            })
          ) : (
            <div className="text-gray-500 italic text-sm text-center py-2 bg-white/30 rounded border-2 border-dashed border-gray-300">
              No one served in this role
            </div>
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
          undefined
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

// Social Media Tracking Component with Modal Dialog and Better UX
interface SocialMediaTrackingProps {
  request: EventRequest;
}

const SocialMediaTracking: React.FC<SocialMediaTrackingProps> = ({ request }) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // State for modal dialog
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogAction, setDialogAction] = useState<'request' | 'complete' | null>(null);
  const [dialogDate, setDialogDate] = useState('');
  const [dialogNotes, setDialogNotes] = useState('');
  const [isDialogSaving, setIsDialogSaving] = useState(false);

  // State for inline editing
  const [editingField, setEditingField] = useState<'requestedDate' | 'completedDate' | 'notes' | null>(null);
  const [editingRequestedDate, setEditingRequestedDate] = useState('');
  const [editingCompletedDate, setEditingCompletedDate] = useState('');
  const [editingNotes, setEditingNotes] = useState('');

  const updateSocialMediaMutation = useMutation({
    mutationFn: (data: any) =>
      apiRequest('PATCH', `/api/event-requests/${request.id}`, data),
    onSuccess: () => {
      toast({
        title: 'Social media tracking updated',
        description: 'Social media tracking information has been successfully updated.',
      });
      queryClient.invalidateQueries({ queryKey: ['/api/event-requests'] });
      // Close dialog and reset state
      setDialogOpen(false);
      setDialogAction(null);
      setIsDialogSaving(false);
      // Reset inline editing
      setEditingField(null);
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to update social media tracking.',
        variant: 'destructive',
      });
      queryClient.invalidateQueries({ queryKey: ['/api/event-requests'] });
      setIsDialogSaving(false);
    },
  });

  // Helper to format date for input
  const formatDateForInput = (dateString: string | null | undefined) => {
    if (!dateString) return '';
    return new Date(dateString).toISOString().split('T')[0];
  };

  // Helper to format date for display
  const formatDateForDisplay = (dateString: string | null | undefined) => {
    if (!dateString) return '';
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  // Open dialog for requesting social media post
  const handleRequestPost = () => {
    setDialogAction('request');
    setDialogDate(new Date().toISOString().split('T')[0]);
    setDialogNotes(request.socialMediaPostNotes || '');
    setDialogOpen(true);
  };

  // Open dialog for marking post as complete
  const handleCompletePost = () => {
    setDialogAction('complete');
    setDialogDate(new Date().toISOString().split('T')[0]);
    setDialogNotes(request.socialMediaPostNotes || '');
    setDialogOpen(true);
  };

  // Confirm dialog action
  const handleDialogConfirm = () => {
    setIsDialogSaving(true);
    
    if (dialogAction === 'request') {
      updateSocialMediaMutation.mutate({
        socialMediaPostRequested: true,
        socialMediaPostRequestedDate: dialogDate ? new Date(dialogDate).toISOString() : new Date().toISOString(),
        socialMediaPostNotes: dialogNotes,
      });
    } else if (dialogAction === 'complete') {
      updateSocialMediaMutation.mutate({
        socialMediaPostCompleted: true,
        socialMediaPostCompletedDate: dialogDate ? new Date(dialogDate).toISOString() : new Date().toISOString(),
        socialMediaPostNotes: dialogNotes,
      });
    }
  };

  // Cancel dialog
  const handleDialogCancel = () => {
    setDialogOpen(false);
    setDialogAction(null);
    setDialogDate('');
    setDialogNotes('');
    setIsDialogSaving(false);
  };

  // Start inline editing
  const startEditingField = (field: 'requestedDate' | 'completedDate' | 'notes') => {
    setEditingField(field);
    if (field === 'requestedDate') {
      setEditingRequestedDate(formatDateForInput(request.socialMediaPostRequestedDate));
    } else if (field === 'completedDate') {
      setEditingCompletedDate(formatDateForInput(request.socialMediaPostCompletedDate));
    } else if (field === 'notes') {
      setEditingNotes(request.socialMediaPostNotes || '');
    }
  };

  // Save inline edit
  const saveInlineEdit = () => {
    if (editingField === 'requestedDate') {
      updateSocialMediaMutation.mutate({
        socialMediaPostRequestedDate: editingRequestedDate ? new Date(editingRequestedDate).toISOString() : null,
      });
    } else if (editingField === 'completedDate') {
      updateSocialMediaMutation.mutate({
        socialMediaPostCompletedDate: editingCompletedDate ? new Date(editingCompletedDate).toISOString() : null,
      });
    } else if (editingField === 'notes') {
      updateSocialMediaMutation.mutate({
        socialMediaPostNotes: editingNotes,
      });
    }
  };

  // Cancel inline edit
  const cancelInlineEdit = () => {
    setEditingField(null);
    setEditingRequestedDate('');
    setEditingCompletedDate('');
    setEditingNotes('');
  };

  return (
    <>
      {/* Main Social Media Tracking Section */}
      <div className="bg-blue-50 rounded-lg p-4 border border-blue-200" data-testid="social-media-tracking">
        {/* Header */}
        <div className="flex items-center gap-2 mb-4">
          <Instagram className="w-5 h-5 text-blue-600" />
          <h4 className="font-semibold text-base text-blue-900">Social Media Tracking</h4>
          {updateSocialMediaMutation.isPending && (
            <span className="text-xs text-blue-600 ml-2">Saving...</span>
          )}
        </div>

        {/* Status Badges */}
        <div className="space-y-2 mb-4">
          {request.socialMediaPostRequested && (
            <div className="flex items-center gap-2">
              <Badge className="bg-green-100 text-green-800 border-green-300">
                <Check className="w-3 h-3 mr-1" />
                Social Media Requested on {formatDateForDisplay(request.socialMediaPostRequestedDate)}
              </Badge>
              {editingField === 'requestedDate' ? (
                <div className="flex items-center gap-1">
                  <Input
                    type="date"
                    value={editingRequestedDate}
                    onChange={(e) => setEditingRequestedDate(e.target.value)}
                    className="h-7 w-36 text-xs"
                    disabled={updateSocialMediaMutation.isPending}
                    data-testid="input-edit-requested-date"
                  />
                  <Button
                    size="sm"
                    onClick={saveInlineEdit}
                    disabled={updateSocialMediaMutation.isPending}
                    className="h-7 px-2"
                    data-testid="button-save-requested-date"
                  >
                    <Save className="w-3 h-3" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={cancelInlineEdit}
                    disabled={updateSocialMediaMutation.isPending}
                    className="h-7 px-2"
                    data-testid="button-cancel-requested-date"
                  >
                    <X className="w-3 h-3" />
                  </Button>
                </div>
              ) : (
                <button
                  onClick={() => startEditingField('requestedDate')}
                  className="text-blue-600 hover:text-blue-800 opacity-70 hover:opacity-100 transition-opacity"
                  title="Edit requested date"
                  data-testid="button-edit-requested-date"
                >
                  <Edit2 className="w-3 h-3" />
                </button>
              )}
            </div>
          )}
          
          {request.socialMediaPostCompleted && (
            <div className="flex items-center gap-2">
              <Badge className="bg-blue-100 text-blue-800 border-blue-300">
                <CheckCircle className="w-3 h-3 mr-1" />
                Social Media Posted on {formatDateForDisplay(request.socialMediaPostCompletedDate)}
              </Badge>
              {editingField === 'completedDate' ? (
                <div className="flex items-center gap-1">
                  <Input
                    type="date"
                    value={editingCompletedDate}
                    onChange={(e) => setEditingCompletedDate(e.target.value)}
                    className="h-7 w-36 text-xs"
                    disabled={updateSocialMediaMutation.isPending}
                    data-testid="input-edit-completed-date"
                  />
                  <Button
                    size="sm"
                    onClick={saveInlineEdit}
                    disabled={updateSocialMediaMutation.isPending}
                    className="h-7 px-2"
                    data-testid="button-save-completed-date"
                  >
                    <Save className="w-3 h-3" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={cancelInlineEdit}
                    disabled={updateSocialMediaMutation.isPending}
                    className="h-7 px-2"
                    data-testid="button-cancel-completed-date"
                  >
                    <X className="w-3 h-3" />
                  </Button>
                </div>
              ) : (
                <button
                  onClick={() => startEditingField('completedDate')}
                  className="text-blue-600 hover:text-blue-800 opacity-70 hover:opacity-100 transition-opacity"
                  title="Edit completion date"
                  data-testid="button-edit-completed-date"
                >
                  <Edit2 className="w-3 h-3" />
                </button>
              )}
            </div>
          )}
        </div>

        {/* Notes Section */}
        {request.socialMediaPostNotes && (
          <div className="mb-4">
            {editingField === 'notes' ? (
              <div className="space-y-2">
                <Textarea
                  value={editingNotes}
                  onChange={(e) => setEditingNotes(e.target.value)}
                  className="min-h-[80px] resize-none text-sm"
                  disabled={updateSocialMediaMutation.isPending}
                  placeholder="Add notes about social media posts..."
                  data-testid="textarea-edit-notes"
                />
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={saveInlineEdit}
                    disabled={updateSocialMediaMutation.isPending}
                    data-testid="button-save-notes"
                  >
                    <Save className="w-3 h-3 mr-1" />
                    Save
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={cancelInlineEdit}
                    disabled={updateSocialMediaMutation.isPending}
                    data-testid="button-cancel-notes"
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <div className="group">
                <div className="flex items-start gap-2">
                  <div className="flex-1">
                    <p className="text-sm text-gray-600 font-medium mb-1">Notes:</p>
                    <p className="text-sm text-gray-700 bg-white/60 rounded px-3 py-2">
                      {request.socialMediaPostNotes}
                    </p>
                  </div>
                  <button
                    onClick={() => startEditingField('notes')}
                    className="text-blue-600 hover:text-blue-800 opacity-30 group-hover:opacity-70 hover:opacity-100 transition-opacity mt-6"
                    title="Edit notes"
                    data-testid="button-edit-notes"
                  >
                    <Edit2 className="w-3 h-3" />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-2">
          {!request.socialMediaPostRequested && (
            <Button
              onClick={handleRequestPost}
              disabled={updateSocialMediaMutation.isPending}
              className="bg-blue-600 hover:bg-blue-700 text-white"
              data-testid="button-request-social-media"
            >
              <Share2 className="w-4 h-4 mr-2" />
              Request Social Media Post
            </Button>
          )}
          
          {request.socialMediaPostRequested && !request.socialMediaPostCompleted && (
            <Button
              onClick={handleCompletePost}
              disabled={updateSocialMediaMutation.isPending}
              className="bg-green-600 hover:bg-green-700 text-white"
              data-testid="button-complete-social-media"
            >
              <CheckCircle className="w-4 h-4 mr-2" />
              Mark Post Complete
            </Button>
          )}

          {request.socialMediaPostCompleted && (
            <div className="text-sm text-gray-600 italic">
              ✓ Social media workflow complete
            </div>
          )}
        </div>
      </div>

      {/* Modal Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(open) => !isDialogSaving && setDialogOpen(open)}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Instagram className="w-5 h-5 text-blue-600" />
              {dialogAction === 'request' 
                ? 'Request Social Media Post' 
                : 'Mark Social Media Post Complete'}
            </DialogTitle>
            <DialogDescription>
              {dialogAction === 'request'
                ? 'Schedule a social media post for this event. Add the date when the post should be requested and any notes for the social media team.'
                : 'Confirm that the social media post has been published. Record the completion date and any relevant notes.'}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            {/* Date Input */}
            <div>
              <label htmlFor="dialog-date" className="text-sm font-medium block mb-1">
                {dialogAction === 'request' ? 'Request Date' : 'Completion Date'}
              </label>
              <Input
                id="dialog-date"
                type="date"
                value={dialogDate}
                onChange={(e) => setDialogDate(e.target.value)}
                disabled={isDialogSaving}
                data-testid="input-dialog-date"
              />
            </div>

            {/* Notes Input */}
            <div>
              <label htmlFor="dialog-notes" className="text-sm font-medium block mb-1">
                Notes (optional)
              </label>
              <Textarea
                id="dialog-notes"
                value={dialogNotes}
                onChange={(e) => setDialogNotes(e.target.value)}
                placeholder={dialogAction === 'request'
                  ? 'Add any instructions for the social media team...'
                  : 'Add any notes about the posted content...'}
                className="min-h-[100px] resize-none"
                disabled={isDialogSaving}
                data-testid="textarea-dialog-notes"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={handleDialogCancel}
              disabled={isDialogSaving}
              data-testid="button-dialog-cancel"
            >
              Cancel
            </Button>
            <Button
              onClick={handleDialogConfirm}
              disabled={isDialogSaving}
              className={dialogAction === 'request' ? 'bg-blue-600 hover:bg-blue-700' : 'bg-green-600 hover:bg-green-700'}
              data-testid="button-dialog-confirm"
            >
              {isDialogSaving ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                'Confirm'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export const CompletedCard: React.FC<CompletedCardProps> = ({
  request,
  onView,
  onEdit,
  onDelete,
  onContact,
  onFollowUp1Day,
  onFollowUp1Month,
  onViewCollectionLog,
  onReschedule,
  onAssignTspContact,
  onEditTspContact,
  resolveUserName,
  canDelete = true,
  openAssignmentDialog,
  openEditAssignmentDialog,
  handleRemoveAssignment,
  handleSelfSignup,
  canSelfSignup,
  isUserSignedUp,
}) => {
  const [showAuditLog, setShowAuditLog] = useState(false);
  
  // Allow assignment editing when assignment functions are provided
  const canEditAssignments = !!(openAssignmentDialog && handleRemoveAssignment);

  // Extract deliveryDestination as string to avoid 'unknown' type error
  const deliveryDestination = request.deliveryDestination
    ? String(request.deliveryDestination)
    : null;

  return (
    <Card className="transition-all duration-200 hover:shadow-lg border-l-4 border-l-[#007E8C] bg-gradient-to-br from-[#e6f7f5] via-[#007E8C]/10 to-[#007E8C]/20 border border-[#007E8C]/30">
      <CardContent className="p-6">
        <CardHeader request={request} resolveUserName={resolveUserName} />

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
                <p className="text-sm text-gray-500">Event Participation</p>
                <p className="font-medium">
                  {request.actualAttendance 
                    ? `${request.actualAttendance} people attended`
                    : request.estimatedAttendance 
                      ? `~${request.estimatedAttendance} estimated`
                      : 'Not recorded'}
                </p>
              </div>
            </div>

            {/* Delivery Destination */}
            {typeof deliveryDestination === 'string' && deliveryDestination.trim() !== '' ? (
              <div className="bg-brand-primary-lighter rounded-lg p-3 mt-2">
                <div className="flex items-center gap-2 text-sm">
                  <MapPin className="w-4 h-4 text-brand-primary-muted" />
                  <span className="font-medium">Delivery Destination:</span>
                  <span>{deliveryDestination}</span>
                </div>
              </div>
            ) : null}

            {/* Sandwich Info */}
            {(request.actualSandwichCount || request.estimatedSandwichCount || request.sandwichTypes) ? (
              <div className="bg-teal-50 rounded-lg p-3">
                <div className="flex items-center gap-2 text-sm">
                  <Package className="w-4 h-4 text-teal-600" />
                  <span className="font-medium">Sandwiches Delivered:</span>
                  <span>
                    {request.actualSandwichCount
                      ? `${request.actualSandwichCount} delivered`
                      : formatSandwichTypesDisplay(request.sandwichTypes, request.estimatedSandwichCount ?? undefined)}
                  </span>
                </div>
              </div>
            ) : null}

            {/* Follow-up Status */}
            <div className="flex gap-2">
              {request.followUpOneDayCompleted && (
                <Badge variant="default" className="bg-teal-100 text-teal-700 border-teal-300">
                  <CheckCircle className="w-3 h-3 mr-1" />
                  1-Day Follow-up Done
                </Badge>
              )}
              {request.followUpOneMonthCompleted && (
                <Badge variant="default" className="bg-teal-100 text-teal-700 border-teal-300">
                  <CheckCircle className="w-3 h-3 mr-1" />
                  1-Month Follow-up Done
                </Badge>
              )}
            </div>

            {/* Social Media Tracking Section */}
            <SocialMediaTracking request={request} />

            {/* Completion Notes */}
            {request.followUpNotes && (
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-sm font-medium mb-1">Completion Notes:</p>
                <p className="text-sm text-gray-600">{request.followUpNotes}</p>
              </div>
            )}
          </div>

          {/* Assignments Summary */}
          {(request.assignedDriverIds || request.speakerDetails || request.assignedVolunteerIds || canEditAssignments) && (
            <div className="bg-white rounded-lg p-3">
              <p className="text-sm font-medium mb-2">Event Team{canEditAssignments ? ' (Editable)' : ''}:</p>
              <CardAssignments
                request={request}
                resolveUserName={resolveUserName}
                canEdit={canEditAssignments}
                onAssign={openAssignmentDialog}
                onEditAssignment={openEditAssignmentDialog}
                onRemoveAssignment={handleRemoveAssignment}
                onSelfSignup={handleSelfSignup}
                canSelfSignup={canSelfSignup}
                isUserSignedUp={isUserSignedUp}
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

          <Button size="sm" variant="outline" onClick={onEdit}>
            <Edit2 className="w-4 h-4 mr-1" />
            Edit Event
          </Button>

          {!request.followUpOneDayCompleted && (
            <Button
              size="sm"
              variant="outline"
              onClick={onFollowUp1Day}
              className="bg-brand-primary-lighter hover:bg-brand-primary-light"
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
              title="Delete Completed Event"
              description={`Are you sure you want to delete the completed event from ${request.organizationName}? This will remove all event data and cannot be undone.`}
              confirmText="Delete Event"
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
    </Card>
  );
};