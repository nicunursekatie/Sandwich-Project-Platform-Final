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
  Home,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { formatTime12Hour, formatEventDate } from '@/components/event-requests/utils';
import { formatSandwichTypesDisplay } from '@/lib/sandwich-utils';
import { extractNameFromCustomId } from '@/lib/utils';
import { ConfirmationDialog } from '@/components/ui/confirmation-dialog';
import { statusColors, statusIcons, statusOptions } from '@/components/event-requests/constants';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { EventRequest } from '@shared/schema';
import { EventRequestAuditLog } from '@/components/event-request-audit-log';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { apiRequest } from '@/lib/queryClient';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { logger } from '@/lib/logger';
import { MultiRecipientSelector } from '@/components/ui/multi-recipient-selector';

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
  canEditOrgDetails?: boolean;
  // TSP Contact editing
  isEditingTspContact?: boolean;
  editingTspContactId?: number | null;
  editingCustomTspContact?: string;
  tspContactInputMode?: 'dropdown' | 'text';
  startEditingTspContact?: () => void;
  saveTspContact?: () => void;
  cancelTspContactEdit?: () => void;
  setEditingTspContactId?: (id: number) => void;
  setEditingCustomTspContact?: (value: string) => void;
  setTspContactInputMode?: (mode: 'dropdown' | 'text') => void;
  users?: { id: number; name: string; email: string }[];
  updateTspContactMutation?: any;
  tempIsConfirmed?: boolean;
  setTempIsConfirmed?: (value: boolean) => void;
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
  resolveUserName,
  canEditOrgDetails = false,
  // TSP Contact editing
  isEditingTspContact = false,
  editingTspContactId = null,
  editingCustomTspContact = '',
  tspContactInputMode = 'dropdown',
  startEditingTspContact,
  saveTspContact,
  cancelTspContactEdit,
  setEditingTspContactId,
  setEditingCustomTspContact,
  setTspContactInputMode,
  users = [],
  updateTspContactMutation,
  tempIsConfirmed = false,
  setTempIsConfirmed
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

  // Check if we're editing organization or department fields
  const isEditingOrgName = isEditingThisCard && editingField === 'organizationName';
  const isEditingDepartment = isEditingThisCard && editingField === 'department';

  return (
    <div className="flex items-start justify-between mb-4">
      <div className="flex items-start space-x-3">
        <div className="flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            {/* Organization Name - with inline editing for admins */}
            {isEditingOrgName ? (
              <div className="flex items-center gap-2">
                <Input
                  value={editingValue}
                  onChange={(e) => setEditingValue?.(e.target.value)}
                  className="h-8 text-lg font-semibold"
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
                <h3 className="font-semibold text-sm sm:text-base md:text-lg text-[#1A2332] break-words">
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

            {/* Department - with inline editing for admins */}
            {(request.department || isEditingDepartment || canEditOrgDetails) && (
              <>
                <span className="text-gray-600">&bull;</span>
                {isEditingDepartment ? (
                  <div className="flex items-center gap-2">
                    <Input
                      value={editingValue}
                      onChange={(e) => setEditingValue?.(e.target.value)}
                      className="h-8"
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
                      <span className="text-gray-600">{request.department}</span>
                    ) : canEditOrgDetails ? (
                      <span className="text-gray-400 italic text-sm">No department</span>
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

            <Badge className="inline-flex items-center rounded-full px-2.5 py-0.5 font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 hover:bg-primary/80 bg-gradient-to-br from-[#e6f2f5] to-[#d1e9ed] text-[#236383] border border-[#236383]/30 text-[16px]">
              <StatusIcon className="w-3 h-3 mr-1" />
              {getStatusLabel(request.status)}
            </Badge>
            {/* Confirmation Status Badge - Completed events are always confirmed */}
            <Badge
              onClick={() => request.status !== 'completed' && startEditing?.('isConfirmed', (!request.isConfirmed).toString())}
              className={`px-3 py-1 text-sm font-medium shadow-sm inline-flex items-center ${
                request.status === 'completed' || request.isConfirmed
                  ? 'bg-green-600 text-white'
                  : 'bg-gray-400 text-white'
              } ${request.status !== 'completed' ? 'cursor-pointer hover:opacity-80 transition-opacity' : ''}`}
              title={request.status === 'completed' ? 'Completed events are always confirmed' : 'Click to toggle confirmation status'}
            >
              {request.status === 'completed' || request.isConfirmed ? '✓ Confirmed' : 'Requested'}
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
            <div className="text-sm text-[#D68319] mb-2 group relative">
              <span className="font-medium">TSP Contact: </span>
              {isEditingTspContact ? (
                <div className="inline-flex items-center gap-2 ml-2 flex-wrap">
                  {tspContactInputMode === 'dropdown' ? (
                    <>
                      <Select
                        value={editingTspContactId?.toString() || ''}
                        onValueChange={(value) => setEditingTspContactId?.(parseInt(value))}
                      >
                        <SelectTrigger className="h-8 w-48">
                          <SelectValue placeholder="Select user..." />
                        </SelectTrigger>
                        <SelectContent>
                          {users.map((user) => (
                            <SelectItem key={user.id} value={user.id.toString()}>
                              {user.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button 
                        size="sm" 
                        variant="outline" 
                        onClick={() => setTspContactInputMode?.('text')}
                        className="h-7 px-2 text-xs"
                        title="Switch to custom name"
                      >
                        or enter name
                      </Button>
                    </>
                  ) : (
                    <>
                      <Input
                        value={editingCustomTspContact}
                        onChange={(e) => setEditingCustomTspContact?.(e.target.value)}
                        placeholder="Enter TSP contact name..."
                        className="h-8 w-48"
                        autoFocus
                      />
                      <Button 
                        size="sm" 
                        variant="outline" 
                        onClick={() => setTspContactInputMode?.('dropdown')}
                        className="h-7 px-2 text-xs"
                        title="Switch to user dropdown"
                      >
                        or select user
                      </Button>
                    </>
                  )}
                  <Button size="sm" onClick={saveTspContact} disabled={updateTspContactMutation?.isPending} className="h-7 px-2">
                    <Save className="w-3 h-3" />
                  </Button>
                  <Button size="sm" variant="ghost" onClick={cancelTspContactEdit} className="h-7 px-2">
                    <X className="w-3 h-3" />
                  </Button>
                </div>
              ) : (
                <>
                  {(request.tspContact || request.customTspContact) ? (
                    <>
                      <span className="font-normal">
                        {request.tspContact ? (resolveUserName ? resolveUserName(request.tspContact) : request.tspContact) : request.customTspContact}
                      </span>
                      {request.tspContactAssignedDate && (
                        <span className="ml-2 text-xs text-gray-500">
                          (assigned {new Date(request.tspContactAssignedDate).toLocaleDateString()})
                        </span>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={startEditingTspContact}
                        className="ml-2 h-6 w-6 p-0 opacity-0 group-hover:opacity-70 hover:opacity-100 transition-opacity"
                        title="Edit TSP contact"
                      >
                        <Edit2 className="w-3 h-3" />
                      </Button>
                    </>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={startEditingTspContact}
                      className="ml-2 h-7 px-3 text-xs"
                    >
                      Assign TSP Contact
                    </Button>
                  )}
                </>
              )}
            </div>
            <div className="flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              {isEditingDate ? (
                <div className="flex flex-col gap-2">
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
                  {/* Don't show confirmation checkbox for completed events - they're always confirmed */}
                  {request.status !== 'completed' && (
                    <div className="flex items-center gap-2 ml-2">
                      <Checkbox
                        id="confirm-date-checkbox"
                        checked={tempIsConfirmed}
                        onCheckedChange={(checked) => setTempIsConfirmed?.(!!checked)}
                      />
                      <label
                        htmlFor="confirm-date-checkbox"
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                      >
                        Mark as confirmed by our team
                      </label>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex items-center gap-2 group">
                  <span data-testid="text-date-label" className="text-sm sm:text-base md:text-lg">
                    {dateLabel}: {' '}
                    <strong className="text-sm sm:text-base md:text-lg break-words" data-testid="text-date-value">
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

  // Get all team members with names
  const getDrivers = () => {
    const regularDrivers = parsePostgresArray(request.assignedDriverIds);
    const drivers: { id: string; name: string }[] = regularDrivers.map(id => {
      const detailName = (request.driverDetails as any)?.[id]?.name;
      let name = (detailName && !/^\d+$/.test(detailName)) ? detailName : resolveUserName(id);
      if (name.startsWith('custom-')) {
        name = extractNameFromCustomId(name);
      }
      return { id, name };
    });

    // Add van driver if assigned
    if (request.assignedVanDriverId) {
      let vanDriverName = request.customVanDriverName || resolveUserName(request.assignedVanDriverId);
      if (vanDriverName.startsWith('custom-')) {
        vanDriverName = extractNameFromCustomId(vanDriverName);
      }
      drivers.push({ id: request.assignedVanDriverId, name: vanDriverName });
    }

    return drivers;
  };

  const getSpeakers = () => {
    const speakerIds = Object.keys(request.speakerDetails || {});
    return speakerIds.map(id => {
      const detailName = (request.speakerDetails as any)?.[id]?.name;
      let name = (detailName && !/^\d+$/.test(detailName)) ? detailName : resolveUserName(id);
      if (name.startsWith('custom-')) {
        name = extractNameFromCustomId(name);
      }
      return { id, name };
    });
  };

  const getVolunteers = () => {
    const volunteerIds = parsePostgresArray(request.assignedVolunteerIds);
    return volunteerIds.map(id => {
      let name = resolveUserName(id);
      if (name.startsWith('custom-')) {
        name = extractNameFromCustomId(name);
      }
      return { id, name };
    });
  };

  const drivers = getDrivers();
  const speakers = getSpeakers();
  const volunteers = getVolunteers();

  // Calculate staffing gaps
  const staffingGaps: string[] = [];
  const driversNeeded = request.driversNeeded || 0;
  const speakersNeeded = request.speakersNeeded || 0;
  const volunteersNeeded = request.volunteersNeeded || 0;

  // Count ALL drivers (regular + van driver) for staffing gap calculation, avoiding double-counting
  const regularDriverIds = parsePostgresArray(request.assignedDriverIds);
  const regularDriversCount = regularDriverIds.length;
  const isVanDriverUnique = request.assignedVanDriverId && !regularDriverIds.includes(request.assignedVanDriverId);
  const totalDriversCount = regularDriversCount + (isVanDriverUnique ? 1 : 0);
  
  if (driversNeeded > totalDriversCount) {
    staffingGaps.push(`Needed ${driversNeeded} driver${driversNeeded > 1 ? 's' : ''} (had ${totalDriversCount})`);
  }
  if (speakersNeeded > speakers.length) {
    staffingGaps.push(`Needed ${speakersNeeded} speaker${speakersNeeded > 1 ? 's' : ''} (had ${speakers.length})`);
  }
  if (volunteersNeeded > volunteers.length) {
    staffingGaps.push(`Needed ${volunteersNeeded} volunteer${volunteersNeeded > 1 ? 's' : ''} (had ${volunteers.length})`);
  }

  return (
    <div className="space-y-3">
      {/* Unmet Needs Alert - only show if there were staffing gaps */}
      {staffingGaps.length > 0 && (
        <div className="bg-amber-50 border border-amber-300 rounded-lg px-3 py-2 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-700 mt-0.5 flex-shrink-0" />
          <div className="text-sm text-amber-800">
            <span className="font-semibold">Staffing Gap: </span>
            {staffingGaps.join(', ')}
          </div>
        </div>
      )}

      {/* Compact Team Display */}
      <div className="bg-white/50 rounded-lg px-3 py-2 text-sm">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          {/* Drivers */}
          <div className="flex items-center gap-2">
            <Car className="w-4 h-4 text-[#236383]" />
            <span className="font-medium text-[#236383]">Drivers:</span>
            {canEdit && onAssign && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => onAssign('driver')}
                className="h-5 w-5 p-0 hover:bg-[#236383]/10"
                title="Add driver"
                data-testid="button-add-driver"
              >
                <UserPlus className="w-3 h-3 text-[#236383]" />
              </Button>
            )}
            {drivers.length > 0 ? (
              <div className="flex flex-wrap gap-1">
                {drivers.map((driver, index) => (
                  <React.Fragment key={driver.id}>
                    <Badge 
                      variant="secondary" 
                      className="bg-[#236383]/10 text-[#236383] text-xs px-2 py-0.5 group relative"
                      data-testid={`badge-driver-${driver.id}`}
                    >
                      {driver.name}
                      {canEdit && onRemoveAssignment && (
                        <button
                          onClick={() => onRemoveAssignment('driver', driver.id)}
                          className="ml-1 inline-flex items-center justify-center w-3 h-3 rounded-full text-gray-400 hover:text-red-600 hover:bg-red-100 focus:text-red-600 focus:bg-red-100 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-1 transition-all"
                          title="Remove driver"
                          data-testid={`button-remove-driver-${driver.id}`}
                        >
                          <X className="w-2.5 h-2.5" />
                        </button>
                      )}
                    </Badge>
                    {index < drivers.length - 1 && <span className="text-gray-400">•</span>}
                  </React.Fragment>
                ))}
              </div>
            ) : (
              <span className="text-gray-500 italic text-xs">(none)</span>
            )}
          </div>

          <span className="text-gray-300">|</span>

          {/* Speakers */}
          <div className="flex items-center gap-2">
            <Megaphone className="w-4 h-4 text-[#236383]" />
            <span className="font-medium text-[#236383]">Speakers:</span>
            {canEdit && onAssign && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => onAssign('speaker')}
                className="h-5 w-5 p-0 hover:bg-[#236383]/10"
                title="Add speaker"
                data-testid="button-add-speaker"
              >
                <UserPlus className="w-3 h-3 text-[#236383]" />
              </Button>
            )}
            {speakers.length > 0 ? (
              <div className="flex flex-wrap gap-1">
                {speakers.map((speaker, index) => (
                  <React.Fragment key={speaker.id}>
                    <Badge 
                      variant="secondary" 
                      className="bg-[#236383]/10 text-[#236383] text-xs px-2 py-0.5 group relative"
                      data-testid={`badge-speaker-${speaker.id}`}
                    >
                      {speaker.name}
                      {canEdit && onRemoveAssignment && (
                        <button
                          onClick={() => onRemoveAssignment('speaker', speaker.id)}
                          className="ml-1 inline-flex items-center justify-center w-3 h-3 rounded-full text-gray-400 hover:text-red-600 hover:bg-red-100 focus:text-red-600 focus:bg-red-100 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-1 transition-all"
                          title="Remove speaker"
                          data-testid={`button-remove-speaker-${speaker.id}`}
                        >
                          <X className="w-2.5 h-2.5" />
                        </button>
                      )}
                    </Badge>
                    {index < speakers.length - 1 && <span className="text-gray-400">•</span>}
                  </React.Fragment>
                ))}
              </div>
            ) : (
              <span className="text-gray-500 italic text-xs">(none)</span>
            )}
          </div>

          <span className="text-gray-300">|</span>

          {/* Volunteers */}
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-[#236383]" />
            <span className="font-medium text-[#236383]">Volunteers:</span>
            {canEdit && onAssign && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => onAssign('volunteer')}
                className="h-5 w-5 p-0 hover:bg-[#236383]/10"
                title="Add volunteer"
                data-testid="button-add-volunteer"
              >
                <UserPlus className="w-3 h-3 text-[#236383]" />
              </Button>
            )}
            {volunteers.length > 0 ? (
              <div className="flex flex-wrap gap-1">
                {volunteers.map((volunteer, index) => (
                  <React.Fragment key={volunteer.id}>
                    <Badge 
                      variant="secondary" 
                      className="bg-[#236383]/10 text-[#236383] text-xs px-2 py-0.5 group relative"
                      data-testid={`badge-volunteer-${volunteer.id}`}
                    >
                      {volunteer.name}
                      {canEdit && onRemoveAssignment && (
                        <button
                          onClick={() => onRemoveAssignment('volunteer', volunteer.id)}
                          className="ml-1 inline-flex items-center justify-center w-3 h-3 rounded-full text-gray-400 hover:text-red-600 hover:bg-red-100 focus:text-red-600 focus:bg-red-100 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-1 transition-all"
                          title="Remove volunteer"
                          data-testid={`button-remove-volunteer-${volunteer.id}`}
                        >
                          <X className="w-2.5 h-2.5" />
                        </button>
                      )}
                    </Badge>
                    {index < volunteers.length - 1 && <span className="text-gray-400">•</span>}
                  </React.Fragment>
                ))}
              </div>
            ) : (
              <span className="text-gray-500 italic text-xs">(none)</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// Simplified Social Media Tracking Component
interface SocialMediaTrackingProps {
  request: EventRequest;
}

const SocialMediaTracking: React.FC<SocialMediaTrackingProps> = ({ request }) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // State for inline editing
  const [showRequestedDate, setShowRequestedDate] = useState(false);
  const [showPostedDate, setShowPostedDate] = useState(false);
  const [editingNotes, setEditingNotes] = useState(false);
  const [notes, setNotes] = useState(request.socialMediaPostNotes || '');
  
  // State for post link editing
  const [editingPostLink, setEditingPostLink] = useState(false);
  const [postLink, setPostLink] = useState((request as any).socialMediaPostLink || '');
  
  // State for Instagram link
  const [showInstagramDialog, setShowInstagramDialog] = useState(false);
  const [instagramLink, setInstagramLink] = useState('');
  const [editingInstagramLink, setEditingInstagramLink] = useState(false);
  const [tempInstagramLink, setTempInstagramLink] = useState('');

  const updateSocialMediaMutation = useMutation({
    mutationFn: (data: any) =>
      apiRequest('PATCH', `/api/event-requests/${request.id}`, data),
    onSuccess: () => {
      toast({
        title: 'Social media tracking updated',
        description: 'Social media tracking information has been successfully updated.',
      });
      queryClient.invalidateQueries({ queryKey: ['/api/event-requests'] });
      // Reset states
      setShowRequestedDate(false);
      setShowPostedDate(false);
      setEditingNotes(false);
      setShowInstagramDialog(false);
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to update social media tracking.',
        variant: 'destructive',
      });
      queryClient.invalidateQueries({ queryKey: ['/api/event-requests'] });
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

  // Handle marking as requested (simplified - just use today's date)
  const handleMarkRequested = () => {
    const todayDate = new Date().toISOString();
    updateSocialMediaMutation.mutate({
      socialMediaPostRequested: true,
      socialMediaPostRequestedDate: todayDate,
    });
  };

  // Handle marking as posted (with optional Instagram link)
  const handleMarkPostedWithLink = () => {
    const todayDate = new Date().toISOString();
    const updateData: any = {
      socialMediaPostCompleted: true,
      socialMediaPostCompletedDate: todayDate,
    };
    
    // Append Instagram link to existing notes if provided
    if (instagramLink.trim()) {
      const existingNotes = request.socialMediaPostNotes || '';
      const instagramLinkText = `Instagram: ${instagramLink.trim()}`;
      
      // Check if there's already an Instagram link and remove it
      const notesWithoutInstagram = existingNotes.replace(/Instagram:\s*https?:\/\/[^\s\n]+(\n)?/g, '').trim();
      
      // Append the new Instagram link
      if (notesWithoutInstagram) {
        updateData.socialMediaPostNotes = `${notesWithoutInstagram}\n${instagramLinkText}`;
      } else {
        updateData.socialMediaPostNotes = instagramLinkText;
      }
    }
    
    updateSocialMediaMutation.mutate(updateData);
    setInstagramLink('');
  };

  // Update requested date
  const handleUpdateRequestedDate = (newDate: string) => {
    updateSocialMediaMutation.mutate({
      socialMediaPostRequestedDate: newDate ? new Date(newDate).toISOString() : null,
    });
  };

  // Update posted date
  const handleUpdatePostedDate = (newDate: string) => {
    updateSocialMediaMutation.mutate({
      socialMediaPostCompletedDate: newDate ? new Date(newDate).toISOString() : null,
    });
  };

  // Update notes
  const handleUpdateNotes = () => {
    updateSocialMediaMutation.mutate({
      socialMediaPostNotes: notes,
    });
    setEditingNotes(false);
  };

  // Update post link
  const handleUpdatePostLink = () => {
    updateSocialMediaMutation.mutate({
      socialMediaPostLink: postLink.trim() || null,
    });
    setEditingPostLink(false);
  };

  // Extract Instagram link from notes if it exists
  const getInstagramLinkFromNotes = () => {
    if (!request.socialMediaPostNotes) return null;
    const match = request.socialMediaPostNotes.match(/Instagram:\s*(https?:\/\/[^\s\n]+)/);
    return match ? match[1] : null;
  };
  
  // Get notes without Instagram link for display
  const getNotesWithoutInstagramLink = () => {
    if (!request.socialMediaPostNotes) return '';
    return request.socialMediaPostNotes.replace(/Instagram:\s*https?:\/\/[^\s\n]+(\n)?/g, '').trim();
  };
  
  // Update Instagram link separately
  const handleUpdateInstagramLink = (newLink: string) => {
    const existingNotes = getNotesWithoutInstagramLink();
    let updatedNotes = existingNotes;
    
    if (newLink.trim()) {
      const instagramLinkText = `Instagram: ${newLink.trim()}`;
      updatedNotes = existingNotes ? `${existingNotes}\n${instagramLinkText}` : instagramLinkText;
    }
    
    updateSocialMediaMutation.mutate({
      socialMediaPostNotes: updatedNotes || null,
    });
    setEditingInstagramLink(false);
    setTempInstagramLink('');
  };
  
  // Remove Instagram link
  const handleRemoveInstagramLink = () => {
    const notesWithoutInstagram = getNotesWithoutInstagramLink();
    updateSocialMediaMutation.mutate({
      socialMediaPostNotes: notesWithoutInstagram || null,
    });
  };

  return (
    <>
      {/* Compact Social Media Tracking Section - positioned in the corner */}
      <div className="inline-block bg-[#47b3cb]/5 rounded-lg p-3 border border-[#47b3cb]/30 max-w-xs" data-testid="social-media-tracking">
        {/* Compact Header */}
        <div className="flex items-center gap-2 mb-2">
          <Share2 className="w-4 h-4 text-[#236383]" />
          <span className="font-semibold text-sm text-[#236383]">Social Media</span>
          {updateSocialMediaMutation.isPending && (
            <span className="text-xs text-[#007e8c] ml-auto">Saving...</span>
          )}
        </div>

        <div className="space-y-2">
          {/* Not requested yet - show compact button */}
          {!request.socialMediaPostRequested && !request.socialMediaPostCompleted && (
            <Button
              onClick={handleMarkRequested}
              className="bg-[#007e8c] hover:bg-[#236383] text-white text-xs px-3 py-1 h-8 w-full"
              disabled={updateSocialMediaMutation.isPending}
            >
              📱 Mark Social Media Requested
            </Button>
          )}

          {/* Requested but not posted - compact display */}
          {request.socialMediaPostRequested && !request.socialMediaPostCompleted && (
            <>
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-1 text-xs">
                  <span className="text-[#236383] font-medium">✓ Requested</span>
                  {showRequestedDate ? (
                    <Input
                      type="date"
                      value={formatDateForInput(request.socialMediaPostRequestedDate?.toString())}
                      onChange={(e) => {
                        handleUpdateRequestedDate(e.target.value);
                        setShowRequestedDate(false);
                      }}
                      className="h-6 text-xs border-[#47b3cb]"
                      disabled={updateSocialMediaMutation.isPending}
                      onBlur={() => setShowRequestedDate(false)}
                      autoFocus
                    />
                  ) : (
                    <button
                      onClick={() => setShowRequestedDate(true)}
                      className="text-[#007e8c] underline hover:text-[#236383] text-xs"
                    >
                      {formatDateForDisplay(request.socialMediaPostRequestedDate?.toString())}
                    </button>
                  )}
                </div>
                
                <Button
                  onClick={() => setShowInstagramDialog(true)}
                  className="bg-[#fbad3f] hover:bg-[#a31c41] text-white text-xs px-3 py-1 h-7 w-full"
                  disabled={updateSocialMediaMutation.isPending}
                >
                  Mark as Posted
                </Button>
              </div>
            </>
          )}

          {/* Posted - compact display */}
          {request.socialMediaPostCompleted && (
            <div className="space-y-2">
              <div className="flex items-center gap-1 text-xs">
                <span className="text-[#236383] font-medium">✓ Posted</span>
                {showPostedDate ? (
                  <Input
                    type="date"
                    value={formatDateForInput(request.socialMediaPostCompletedDate?.toString())}
                    onChange={(e) => {
                      handleUpdatePostedDate(e.target.value);
                      setShowPostedDate(false);
                    }}
                    className="h-6 text-xs border-[#47b3cb]"
                    disabled={updateSocialMediaMutation.isPending}
                    onBlur={() => setShowPostedDate(false)}
                    autoFocus
                  />
                ) : (
                  <button
                    onClick={() => setShowPostedDate(true)}
                    className="text-[#007e8c] underline hover:text-[#236383] text-xs"
                  >
                    {formatDateForDisplay(request.socialMediaPostCompletedDate?.toString())}
                  </button>
                )}
              </div>
              
              {/* Display notes (without Instagram link) */}
              {getNotesWithoutInstagramLink() && (
                <div className="text-xs text-gray-600 bg-gray-50 rounded p-2 mb-2">
                  <div className="flex items-start gap-1">
                    <MessageCircle className="w-3 h-3 text-gray-500 mt-0.5" />
                    <span>{getNotesWithoutInstagramLink()}</span>
                  </div>
                </div>
              )}
              
              {/* Display/Edit Instagram link */}
              {editingInstagramLink ? (
                <div className="flex flex-col gap-1 mb-2">
                  <div className="flex items-center gap-1">
                    <Instagram className="w-3 h-3 text-[#E4405F]" />
                    <Input
                      type="url"
                      value={tempInstagramLink}
                      onChange={(e) => setTempInstagramLink(e.target.value)}
                      placeholder="https://instagram.com/..."
                      className="h-6 text-xs border-[#E4405F]/30 flex-1"
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          handleUpdateInstagramLink(tempInstagramLink);
                        }
                        if (e.key === 'Escape') {
                          setEditingInstagramLink(false);
                          setTempInstagramLink('');
                        }
                      }}
                    />
                  </div>
                  <div className="flex gap-1">
                    <Button
                      size="sm"
                      onClick={() => handleUpdateInstagramLink(tempInstagramLink)}
                      className="bg-[#E4405F] hover:bg-[#C13584] text-white text-xs px-2 py-0.5 h-5"
                      disabled={updateSocialMediaMutation.isPending}
                    >
                      <Save className="w-3 h-3 mr-1" />
                      Save
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setEditingInstagramLink(false);
                        setTempInstagramLink('');
                      }}
                      className="text-xs px-2 py-0.5 h-5"
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : getInstagramLinkFromNotes() ? (
                <div className="flex items-center gap-1 text-xs group">
                  <Instagram className="w-3 h-3 text-[#E4405F]" />
                  <a 
                    href={getInstagramLinkFromNotes()!} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-[#E4405F] underline hover:text-[#C13584] text-xs flex-1"
                  >
                    View on Instagram
                  </a>
                  <div className="opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                    <button
                      onClick={() => {
                        setTempInstagramLink(getInstagramLinkFromNotes() || '');
                        setEditingInstagramLink(true);
                      }}
                      className="text-[#E4405F] hover:text-[#C13584] p-0.5"
                      title="Edit Instagram link"
                    >
                      <Edit2 className="w-3 h-3" />
                    </button>
                    <button
                      onClick={handleRemoveInstagramLink}
                      className="text-red-500 hover:text-red-700 p-0.5"
                      title="Remove Instagram link"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              ) : (
                <Button
                  onClick={() => {
                    setTempInstagramLink('');
                    setEditingInstagramLink(true);
                  }}
                  className="bg-[#E4405F]/10 hover:bg-[#E4405F]/20 text-[#E4405F] text-xs px-2 py-1 h-6 w-full"
                >
                  <Instagram className="w-3 h-3 mr-1" />
                  Add Instagram Link
                </Button>
              )}

              {/* Compact Post Link */}
              {((request as any).socialMediaPostLink || editingPostLink) && (
                <div className="text-xs">
                  {editingPostLink ? (
                    <div className="flex flex-col gap-1">
                      <Input
                        type="url"
                        value={postLink}
                        onChange={(e) => setPostLink(e.target.value)}
                        placeholder="Post link..."
                        className="h-6 text-xs border-[#47b3cb]"
                        disabled={updateSocialMediaMutation.isPending}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleUpdatePostLink();
                          if (e.key === 'Escape') {
                            setPostLink((request as any).socialMediaPostLink || '');
                            setEditingPostLink(false);
                          }
                        }}
                      />
                      <div className="flex gap-1">
                        <Button
                          size="sm"
                          onClick={handleUpdatePostLink}
                          className="bg-[#007e8c] hover:bg-[#236383] text-white text-xs px-2 py-1 h-6"
                          disabled={updateSocialMediaMutation.isPending}
                        >
                          Save
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setPostLink((request as any).socialMediaPostLink || '');
                            setEditingPostLink(false);
                          }}
                          className="text-xs px-2 py-1 h-6"
                          disabled={updateSocialMediaMutation.isPending}
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div
                      onClick={() => {
                        setPostLink((request as any).socialMediaPostLink || '');
                        setEditingPostLink(true);
                      }}
                      className="p-1 rounded border border-[#47b3cb]/30 bg-white/50 cursor-pointer hover:bg-white/70 transition-colors truncate"
                    >
                      {(request as any).socialMediaPostLink ? (
                        <a href={(request as any).socialMediaPostLink} target="_blank" rel="noopener noreferrer" className="text-[#007e8c] underline text-xs">
                          View post
                        </a>
                      ) : (
                        <span className="text-gray-500">Add link</span>
                      )}
                    </div>
                  )}
                </div>
              )}
              
              {/* Add link button if no link exists */}
              {!(request as any).socialMediaPostLink && !editingPostLink && (
                <Button
                  onClick={() => setEditingPostLink(true)}
                  className="bg-[#47b3cb]/20 hover:bg-[#47b3cb]/30 text-[#236383] text-xs px-2 py-1 h-6 w-full"
                >
                  + Add link
                </Button>
              )}
            </div>
          )}
        </div>
      </div>
      
      {/* Confirmation Dialog */}
      <Dialog open={showInstagramDialog} onOpenChange={setShowInstagramDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Mark Social Media as Posted</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              Confirm that the social media post has been completed.
            </p>
            {request.socialMediaPostNotes && getNotesWithoutInstagramLink() && (
              <div className="bg-gray-50 rounded p-2">
                <p className="text-xs text-gray-600">
                  <strong>Existing notes:</strong> {getNotesWithoutInstagramLink()}
                </p>
              </div>
            )}
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">
                Instagram Link (Optional)
              </label>
              <div className="flex items-center gap-2">
                <Instagram className="w-4 h-4 text-[#E4405F]" />
                <Input
                  type="url"
                  placeholder="https://instagram.com/..."
                  value={instagramLink}
                  onChange={(e) => setInstagramLink(e.target.value)}
                  className="w-full border-[#47b3cb] focus:border-[#007e8c]"
                />
              </div>
              <p className="text-xs text-gray-500">
                {getNotesWithoutInstagramLink() 
                  ? 'The Instagram link will be added to the existing notes'
                  : 'Add the Instagram post link if available'}
              </p>
            </div>
          </div>
          <DialogFooter className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setShowInstagramDialog(false);
                setInstagramLink('');
              }}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                handleMarkPostedWithLink();
                setShowInstagramDialog(false);
              }}
              className="flex-1 bg-[#47b3cb] hover:bg-[#236383] text-white"
              disabled={updateSocialMediaMutation.isPending}
            >
              Mark as Posted
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
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [showAuditLog, setShowAuditLog] = useState(false);
  const [showInstagramDialog, setShowInstagramDialog] = useState(false);
  const [instagramLink, setInstagramLink] = useState('');

  // Confirmation checkbox state for date editing
  const [tempIsConfirmed, setTempIsConfirmed] = useState(request.isConfirmed || false);

  // Inline editing state for organization and department
  const [isEditingField, setIsEditingField] = useState(false);
  const [editingField, setEditingField] = useState('');
  const [editingValue, setEditingValue] = useState('');

  // Inline editing state for sandwich count
  const [isEditingSandwichCount, setIsEditingSandwichCount] = useState(false);
  const [editingSandwichCount, setEditingSandwichCount] = useState('');
  const [editingMode, setEditingMode] = useState<'simple' | 'detailed'>('simple');
  const [editingTypes, setEditingTypes] = useState<{
    turkey?: number;
    ham?: number;
    deli?: number;
    pbj?: number;
    unknown?: number;
  }>({});

  // Inline editing state for TSP contact
  const [isEditingTspContact, setIsEditingTspContact] = useState(false);
  const [editingTspContactId, setEditingTspContactId] = useState<number | null>(null);
  const [editingCustomTspContact, setEditingCustomTspContact] = useState('');
  const [tspContactInputMode, setTspContactInputMode] = useState<'dropdown' | 'text'>('dropdown');

  // Check if user has permission to edit organization details
  const canEditOrgDetails =
    (user?.permissions as string[] | undefined)?.includes('EVENT_REQUESTS_INLINE_EDIT_ORG_DETAILS') ||
    user?.role === 'super_admin' ||
    user?.role === 'admin';

  // Debug: log permission check
  logger.log('CompletedCard org details edit permission:', {
    userId: user?.id,
    userRole: user?.role,
    hasPermission: (user?.permissions as string[] | undefined)?.includes('EVENT_REQUESTS_INLINE_EDIT_ORG_DETAILS'),
    canEditOrgDetails,
    requestId: request.id,
    orgName: request.organizationName
  });

  // Social media mutation
  const updateSocialMediaMutation = useMutation({
    mutationFn: (data: any) =>
      apiRequest('PATCH', `/api/event-requests/${request.id}`, data),
    onSuccess: () => {
      toast({
        title: 'Social media tracking updated',
        description: 'Social media tracking information has been successfully updated.',
      });
      queryClient.invalidateQueries({ queryKey: ['/api/event-requests'] });
      setShowInstagramDialog(false);
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to update social media tracking.',
        variant: 'destructive',
      });
      queryClient.invalidateQueries({ queryKey: ['/api/event-requests'] });
    },
  });

  // Organization details mutation
  const updateOrgDetailsMutation = useMutation({
    mutationFn: (data: any) =>
      apiRequest('PATCH', `/api/event-requests/${request.id}`, data),
    onSuccess: () => {
      toast({
        title: 'Event details updated',
        description: 'Event information has been successfully updated.',
      });
      queryClient.invalidateQueries({ queryKey: ['/api/event-requests'] });
      setIsEditingField(false);
      setEditingField('');
      setEditingValue('');
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to update organization details.',
        variant: 'destructive',
      });
      setIsEditingField(false);
      setEditingField('');
      setEditingValue('');
    },
  });

  // Sandwich count mutation
  const updateSandwichCountMutation = useMutation({
    mutationFn: (data: { actualSandwichCount: number; actualSandwichTypes?: any }) =>
      apiRequest('PATCH', `/api/event-requests/${request.id}`, data),
    onSuccess: () => {
      toast({
        title: 'Sandwich count updated',
        description: 'The actual sandwich count has been successfully updated.',
      });
      queryClient.invalidateQueries({ queryKey: ['/api/event-requests'] });
      setIsEditingSandwichCount(false);
      setEditingSandwichCount('');
      setEditingTypes({});
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to update sandwich count.',
        variant: 'destructive',
      });
      setIsEditingSandwichCount(false);
      setEditingSandwichCount('');
      setEditingTypes({});
    },
  });

  // TSP contact mutation
  const updateTspContactMutation = useMutation({
    mutationFn: (data: { tspContact?: number | null; customTspContact?: string | null; tspContactAssignedDate: string }) =>
      apiRequest('PATCH', `/api/event-requests/${request.id}`, data),
    onSuccess: () => {
      toast({
        title: 'TSP Contact updated',
        description: 'The TSP contact has been successfully updated.',
      });
      queryClient.invalidateQueries({ queryKey: ['/api/event-requests'] });
      setIsEditingTspContact(false);
      setEditingTspContactId(null);
      setEditingCustomTspContact('');
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to update TSP contact.',
        variant: 'destructive',
      });
      setIsEditingTspContact(false);
      setEditingTspContactId(null);
      setEditingCustomTspContact('');
    },
  });

  // Handlers for inline editing
  const startEditing = (field: string, value: string) => {
    setIsEditingField(true);
    setEditingField(field);
    setEditingValue(value);

    // When starting to edit a date, also load the current confirmation status
    if (field === 'desiredEventDate' || field === 'scheduledEventDate') {
      setTempIsConfirmed(request.isConfirmed || false);
    }
  };

  const saveEdit = () => {
    if (editingField === 'organizationName') {
      updateOrgDetailsMutation.mutate({ organizationName: editingValue });
    } else if (editingField === 'department') {
      updateOrgDetailsMutation.mutate({ department: editingValue });
    } else if (editingField === 'eventAddress') {
      updateOrgDetailsMutation.mutate({ eventAddress: editingValue });
    } else if (editingField === 'desiredEventDate' || editingField === 'scheduledEventDate') {
      // When saving a date, also save the confirmation status
      // Completed events are always confirmed
      updateOrgDetailsMutation.mutate({
        [editingField]: editingValue,
        isConfirmed: request.status === 'completed' ? true : tempIsConfirmed
      });
    }
  };

  const cancelEdit = () => {
    setIsEditingField(false);
    setEditingField('');
    setEditingValue('');
  };

  // Handlers for sandwich count editing
  const startEditingSandwichCount = () => {
    const currentCount = request.actualSandwichCount || request.estimatedSandwichCount || 0;
    const currentTypes = request.actualSandwichTypes || request.sandwichTypes;

    // Check if we have type data
    if (currentTypes && Array.isArray(currentTypes) && currentTypes.length > 0) {
      // Parse existing types into editing state
      const typeMap: any = {};
      currentTypes.forEach((item: any) => {
        if (item.type && item.quantity) {
          const typeLower = item.type.toLowerCase();
          typeMap[typeLower] = item.quantity;
        }
      });
      setEditingTypes(typeMap);
      setEditingMode('detailed');
    } else {
      setEditingSandwichCount(currentCount.toString());
      setEditingMode('simple');
    }

    setIsEditingSandwichCount(true);
  };

  const saveSandwichCount = () => {
    if (editingMode === 'simple') {
      // Simple mode - just save the total
      const count = parseInt(editingSandwichCount, 10);
      if (isNaN(count) || count < 0) {
        toast({
          title: 'Invalid count',
          description: 'Please enter a valid positive number.',
          variant: 'destructive',
        });
        return;
      }
      
      // Preserve existing types - only update the count
      const currentTypes = request.actualSandwichTypes || request.sandwichTypes;
      updateSandwichCountMutation.mutate({
        actualSandwichCount: count,
        actualSandwichTypes: currentTypes || null
      });
    } else {
      // Detailed mode - save types and calculate total
      const types: any[] = [];
      let total = 0;

      Object.entries(editingTypes).forEach(([type, count]) => {
        if (count && count > 0) {
          types.push({
            type: type.charAt(0).toUpperCase() + type.slice(1), // Capitalize
            quantity: count
          });
          total += count;
        }
      });

      if (total === 0) {
        toast({
          title: 'Invalid count',
          description: 'Please enter at least one sandwich type with a count.',
          variant: 'destructive',
        });
        return;
      }

      updateSandwichCountMutation.mutate({
        actualSandwichCount: total,
        actualSandwichTypes: types
      });
    }
  };

  const cancelSandwichCountEdit = () => {
    setIsEditingSandwichCount(false);
    setEditingSandwichCount('');
    setEditingTypes({});
  };

  const toggleEditingMode = () => {
    if (editingMode === 'simple') {
      // Switch to detailed - try to preserve the count
      const simpleCount = parseInt(editingSandwichCount, 10);
      if (!isNaN(simpleCount) && simpleCount > 0) {
        // Put all count in "unknown" category
        setEditingTypes({ unknown: simpleCount });
      }
      setEditingMode('detailed');
    } else {
      // Switch to simple - calculate total from types
      const total = Object.values(editingTypes).reduce((sum, count) => sum + (count || 0), 0);
      setEditingSandwichCount(total.toString());
      setEditingMode('simple');
    }
  };

  // Handlers for TSP contact editing
  const startEditingTspContact = () => {
    // Initialize based on existing data
    if (request.customTspContact) {
      setTspContactInputMode('text');
      setEditingCustomTspContact(request.customTspContact);
    } else {
      setTspContactInputMode('dropdown');
      setEditingTspContactId(request.tspContact ? parseInt(request.tspContact) : null);
    }
    setIsEditingTspContact(true);
  };

  const saveTspContact = () => {
    const todayDate = new Date().toISOString();
    
    if (tspContactInputMode === 'dropdown') {
      if (!editingTspContactId) {
        toast({
          title: 'Invalid selection',
          description: 'Please select a TSP contact.',
          variant: 'destructive',
        });
        return;
      }
      updateTspContactMutation.mutate({
        tspContact: editingTspContactId,
        customTspContact: null, // Clear custom text when using dropdown
        tspContactAssignedDate: todayDate
      });
    } else {
      if (!editingCustomTspContact.trim()) {
        toast({
          title: 'Invalid input',
          description: 'Please enter a TSP contact name.',
          variant: 'destructive',
        });
        return;
      }
      updateTspContactMutation.mutate({
        tspContact: null, // Clear user ID when using custom text
        customTspContact: editingCustomTspContact.trim(),
        tspContactAssignedDate: todayDate
      });
    }
  };

  const cancelTspContactEdit = () => {
    setIsEditingTspContact(false);
    setEditingTspContactId(null);
    setEditingCustomTspContact('');
  };

  // Helper functions for Instagram link
  const getInstagramLinkFromNotes = () => {
    const notes = request.socialMediaPostNotes || '';
    const match = notes.match(/Instagram:\s*(https?:\/\/[^\s\n]+)/);
    return match ? match[1] : '';
  };

  const getNotesWithoutInstagramLink = () => {
    const notes = request.socialMediaPostNotes || '';
    return notes.replace(/Instagram:\s*https?:\/\/[^\s\n]+\n?/, '').trim();
  };

  const handleMarkPostedWithLink = () => {
    const todayDate = new Date().toISOString();
    const updateData: any = {
      socialMediaPostCompleted: true,
      socialMediaPostCompletedDate: todayDate,
    };
    
    // Append Instagram link to existing notes if provided
    if (instagramLink.trim()) {
      const existingNotes = getNotesWithoutInstagramLink();
      const instagramLinkText = `Instagram: ${instagramLink.trim()}`;
      
      if (existingNotes) {
        updateData.socialMediaPostNotes = `${existingNotes}\n${instagramLinkText}`;
      } else {
        updateData.socialMediaPostNotes = instagramLinkText;
      }
    }
    
    updateSocialMediaMutation.mutate(updateData);
    setInstagramLink('');
  };
  
  // Allow assignment editing when assignment functions are provided
  const canEditAssignments = !!(openAssignmentDialog && handleRemoveAssignment);

  // Fetch recipients and hosts for name lookup
  const { data: recipients = [] } = useQuery<{ id: number; name: string }[]>({
    queryKey: ['/api/recipients'],
    staleTime: 10 * 60 * 1000,
  });

  const { data: hosts = [] } = useQuery<{ id: number; name: string }[]>({
    queryKey: ['/api/hosts'],
    staleTime: 10 * 60 * 1000,
  });

  // Fetch users for TSP contact assignment
  const { data: users = [] } = useQuery<{ id: number; name: string; email: string }[]>({
    queryKey: ['/api/users/basic'],
    staleTime: 10 * 60 * 1000,
  });

  // Helper to get display information from IDs (supports new prefixed format)
  const getRecipientDisplayInfo = (recipientIds: any): Array<{ name: string; type: string; icon: React.ReactNode }> => {
    if (!recipientIds) return [];
    
    // Parse the array (could be string or array)
    let ids: string[] = [];
    if (Array.isArray(recipientIds)) {
      ids = recipientIds.map(id => String(id));
    } else if (typeof recipientIds === 'string') {
      try {
        // Handle PostgreSQL array format: {1,2,3} or {"host:5","recipient:10","custom:Hall, Room 2"}
        if (recipientIds.startsWith('{') && recipientIds.endsWith('}')) {
          const arrayContent = recipientIds.slice(1, -1); // Remove { and }
          
          // Parse PostgreSQL array format respecting quoted strings
          // PostgreSQL escapes quotes as "" (doubled) or \" (backslash)
          // Handles: {value1,value2} and {"value 1","value 2"} and {"value,with,commas"} and {"value with ""quotes"""}
          const parsed: string[] = [];
          let current = '';
          let inQuotes = false;
          
          for (let i = 0; i < arrayContent.length; i++) {
            const char = arrayContent[i];
            const nextChar = i < arrayContent.length - 1 ? arrayContent[i + 1] : null;
            const prevChar = i > 0 ? arrayContent[i - 1] : null;
            
            if (char === '"') {
              if (inQuotes && nextChar === '"') {
                // Doubled quote ("") inside quoted string = escaped quote, add one quote
                current += '"';
                i++; // Skip the next quote
              } else if (inQuotes && prevChar === '\\') {
                // Backslash-escaped quote (\") = actual quote (backslash was already added)
                current = current.slice(0, -1) + '"'; // Replace the backslash with quote
              } else {
                // Regular quote - toggle quote state
                inQuotes = !inQuotes;
              }
            } else if (char === ',' && !inQuotes) {
              // Comma outside quotes = separator
              if (current.trim()) {
                parsed.push(current.trim());
              }
              current = '';
            } else {
              current += char;
            }
          }
          
          // Don't forget the last value
          if (current.trim()) {
            parsed.push(current.trim());
          }
          
          ids = parsed;
        }
      } catch {
        return [];
      }
    }
    
    // Map IDs to display info
    return ids.map(id => {
      const idStr = String(id);
      
      // Check for prefixed format
      if (idStr.startsWith('host:')) {
        const hostId = parseInt(idStr.replace('host:', ''));
        const host = hosts.find(h => h.id === hostId);
        return {
          name: host?.name || `Unknown Host (${hostId})`,
          type: 'host',
          icon: <Home className="w-3 h-3 mr-1" />
        };
      } else if (idStr.startsWith('recipient:')) {
        const recipientId = parseInt(idStr.replace('recipient:', ''));
        const recipient = recipients.find(r => r.id === recipientId);
        return {
          name: recipient?.name || `Unknown Recipient (${recipientId})`,
          type: 'recipient',
          icon: <Building className="w-3 h-3 mr-1" />
        };
      } else if (idStr.startsWith('custom:')) {
        return {
          name: idStr.replace('custom:', ''),
          type: 'custom',
          icon: null
        };
      }
      
      // Legacy numeric ID - assume it's a recipient
      const numId = parseInt(idStr, 10);
      if (!isNaN(numId)) {
        const recipient = recipients.find(r => r.id === numId);
        return {
          name: recipient?.name || `Unknown (${numId})`,
          type: 'recipient',
          icon: <Building className="w-3 h-3 mr-1" />
        };
      }
      
      return {
        name: idStr,
        type: 'unknown',
        icon: null
      };
    });
  };

  const assignedRecipientInfo = getRecipientDisplayInfo((request as any).assignedRecipientIds);

  // Get event date and time for display
  const eventDate = request.scheduledEventDate || request.desiredEventDate;
  const eventDateDisplay = eventDate ? formatEventDate(eventDate.toString()).text : 'No date set';
  const eventTimeDisplay = request.eventStartTime
    ? `${formatTime12Hour(request.eventStartTime)}${request.eventEndTime ? ` - ${formatTime12Hour(request.eventEndTime)}` : ''}`
    : 'No time set';

  return (
    <Card className="transition-all duration-200 hover:shadow-lg border-l-4 border-l-[#007E8C] bg-gradient-to-br from-[#e6f7f5] via-[#007E8C]/10 to-[#007E8C]/20 border border-[#007E8C]/30">
      <CardContent className="p-4">
        <CardHeader
          request={request}
          resolveUserName={resolveUserName}
          canEditOrgDetails={canEditOrgDetails}
          isEditingThisCard={isEditingField}
          editingField={editingField}
          editingValue={editingValue}
          startEditing={startEditing}
          saveEdit={saveEdit}
          cancelEdit={cancelEdit}
          setEditingValue={setEditingValue}
          isEditingTspContact={isEditingTspContact}
          editingTspContactId={editingTspContactId}
          editingCustomTspContact={editingCustomTspContact}
          tspContactInputMode={tspContactInputMode}
          startEditingTspContact={startEditingTspContact}
          saveTspContact={saveTspContact}
          cancelTspContactEdit={cancelTspContactEdit}
          setEditingTspContactId={setEditingTspContactId}
          setEditingCustomTspContact={setEditingCustomTspContact}
          setTspContactInputMode={setTspContactInputMode}
          users={users}
          updateTspContactMutation={updateTspContactMutation}
          tempIsConfirmed={tempIsConfirmed}
          setTempIsConfirmed={setTempIsConfirmed}
        />

        {/* NEW: Top Info Grid - Event Time, Sandwiches Delivered, Social Media */}
        <div className="bg-white rounded-lg p-3 mb-3 border border-gray-200">
          <div className="grid grid-cols-3 gap-3">
            {/* Event Time Section */}
            <div className="text-center">
              <Clock className="w-5 h-5 text-[#236383] mx-auto mb-2" />
              <p className="text-sm text-gray-600 font-medium">Event Time</p>
              <p className="font-semibold text-[#236383] mt-1">{eventDateDisplay}</p>
              <p className="text-sm text-[#236383]">{eventTimeDisplay}</p>
            </div>

            {/* Sandwiches Delivered Section */}
            <div className="text-center group relative">
              <Package className="w-5 h-5 text-[#FBAD3F] mx-auto mb-2" />
              <p className="text-sm text-gray-600 font-medium">Sandwiches Delivered</p>
              {isEditingSandwichCount ? (
                <div className="flex flex-col items-center gap-2 mt-1 min-w-[200px]">
                  {editingMode === 'simple' ? (
                    // Simple mode - just a single total input
                    <>
                      <Input
                        type="number"
                        value={editingSandwichCount}
                        onChange={(e) => setEditingSandwichCount(e.target.value)}
                        className="h-10 w-32 text-center text-xl font-semibold"
                        placeholder="Total"
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') saveSandwichCount();
                          if (e.key === 'Escape') cancelSandwichCountEdit();
                        }}
                      />
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={toggleEditingMode}
                        className="text-xs h-6"
                      >
                        Add breakdown by type
                      </Button>
                    </>
                  ) : (
                    // Detailed mode - inputs for each type
                    <div className="space-y-2 w-full">
                      <div className="grid grid-cols-2 gap-2 text-left">
                        <div>
                          <label className="text-xs text-gray-600">Turkey</label>
                          <Input
                            type="number"
                            value={editingTypes.turkey || ''}
                            onChange={(e) => setEditingTypes({ ...editingTypes, turkey: parseInt(e.target.value) || 0 })}
                            className="h-8 text-sm"
                            placeholder="0"
                            min="0"
                          />
                        </div>
                        <div>
                          <label className="text-xs text-gray-600">Ham</label>
                          <Input
                            type="number"
                            value={editingTypes.ham || ''}
                            onChange={(e) => setEditingTypes({ ...editingTypes, ham: parseInt(e.target.value) || 0 })}
                            className="h-8 text-sm"
                            placeholder="0"
                            min="0"
                          />
                        </div>
                        <div>
                          <label className="text-xs text-gray-600">Deli</label>
                          <Input
                            type="number"
                            value={editingTypes.deli || ''}
                            onChange={(e) => setEditingTypes({ ...editingTypes, deli: parseInt(e.target.value) || 0 })}
                            className="h-8 text-sm"
                            placeholder="0"
                            min="0"
                          />
                        </div>
                        <div>
                          <label className="text-xs text-gray-600">PB&J</label>
                          <Input
                            type="number"
                            value={editingTypes.pbj || ''}
                            onChange={(e) => setEditingTypes({ ...editingTypes, pbj: parseInt(e.target.value) || 0 })}
                            className="h-8 text-sm"
                            placeholder="0"
                            min="0"
                          />
                        </div>
                        <div className="col-span-2">
                          <label className="text-xs text-gray-600">Unknown</label>
                          <Input
                            type="number"
                            value={editingTypes.unknown || ''}
                            onChange={(e) => setEditingTypes({ ...editingTypes, unknown: parseInt(e.target.value) || 0 })}
                            className="h-8 text-sm"
                            placeholder="0"
                            min="0"
                          />
                        </div>
                      </div>
                      <div className="text-xs text-gray-600 text-center bg-gray-50 rounded p-1">
                        Total: <span className="font-semibold">{Object.values(editingTypes).reduce((sum, count) => sum + (count || 0), 0)}</span>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={toggleEditingMode}
                        className="text-xs h-6 w-full"
                      >
                        Switch to simple total
                      </Button>
                    </div>
                  )}
                  <div className="flex gap-1">
                    <Button size="sm" onClick={saveSandwichCount} disabled={updateSandwichCountMutation.isPending}>
                      <Save className="w-3 h-3 mr-1" />
                      Save
                    </Button>
                    <Button size="sm" variant="ghost" onClick={cancelSandwichCountEdit}>
                      <X className="w-3 h-3 mr-1" />
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="relative">
                  <p className="font-semibold text-[#FBAD3F] text-xl sm:text-2xl md:text-3xl mt-1 break-words">
                    {(() => {
                      const count = request.actualSandwichCount || request.estimatedSandwichCount;
                      const types = request.actualSandwichTypes || request.sandwichTypes;

                      if (!count) {
                        return <span className="text-gray-400 italic text-base">Not recorded</span>;
                      }

                      // If we have types, show count with type
                      if (types && Array.isArray(types) && types.length > 0) {
                        const typeDisplay = formatSandwichTypesDisplay(types);
                        return typeDisplay;
                      }

                      // Otherwise just show count
                      return count;
                    })()}
                  </p>
                  <div className="flex justify-center mt-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={startEditingSandwichCount}
                      className="h-7 px-3 text-xs opacity-60 group-hover:opacity-100 transition-opacity bg-white/80 hover:bg-white border-[#FBAD3F]/30 hover:border-[#FBAD3F]"
                      title="Edit sandwich count"
                    >
                      <Edit2 className="w-3 h-3 mr-1" />
                      Edit Count
                    </Button>
                  </div>
                </div>
              )}
            </div>

            {/* Social Media Status Section */}
            <div className="text-center">
              <Share2 className="w-5 h-5 text-[#47b3cb] mx-auto mb-2" />
              <p className="text-sm text-gray-600 font-medium">Social Media</p>
              <p className="font-semibold text-[#47b3cb] mt-1">
                {request.socialMediaPostCompleted ? (
                  <span className="flex items-center justify-center gap-1">
                    <CheckCircle className="w-4 h-4 text-teal-600" />
                    Posted
                  </span>
                ) : request.socialMediaPostRequested ? (
                  <span className="flex items-center justify-center gap-1">
                    <Clock className="w-4 h-4 text-[#47b3cb]" />
                    Requested
                  </span>
                ) : (
                  <span className="text-gray-400 italic">Not tracked</span>
                )}
              </p>
              {/* Display Instagram link if posted and link exists, or show "Add Link" button */}
              {request.socialMediaPostCompleted && (() => {
                const instagramLink = getInstagramLinkFromNotes();
                if (instagramLink) {
                  return (
                    <a
                      href={instagramLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-center gap-1 mt-2 text-xs text-[#236383] hover:text-[#007e8c] hover:underline"
                    >
                      <Instagram className="w-3 h-3" />
                      View Post
                    </a>
                  );
                } else {
                  // No link yet - show Add Link button
                  return (
                    <Button
                      size="sm"
                      onClick={() => setShowInstagramDialog(true)}
                      className="bg-[#fbad3f] hover:bg-[#a31c41] text-white text-xs h-7 px-2 mt-2"
                      disabled={updateSocialMediaMutation.isPending}
                    >
                      <Instagram className="w-3 h-3 mr-1" />
                      Add Link
                    </Button>
                  );
                }
              })()}
              {/* Quick action buttons */}
              {!request.socialMediaPostCompleted && (
                <div className="flex flex-col gap-1 mt-2">
                  {!request.socialMediaPostRequested && (
                    <Button
                      size="sm"
                      onClick={() => {
                        const todayDate = new Date().toISOString();
                        updateSocialMediaMutation.mutate({
                          socialMediaPostRequested: true,
                          socialMediaPostRequestedDate: todayDate,
                        });
                      }}
                      className="bg-[#007e8c] hover:bg-[#236383] text-white text-xs h-7 px-2"
                      disabled={updateSocialMediaMutation.isPending}
                    >
                      Mark Requested
                    </Button>
                  )}
                  <Button
                    size="sm"
                    onClick={() => setShowInstagramDialog(true)}
                    className="bg-[#fbad3f] hover:bg-[#a31c41] text-white text-xs h-7 px-2"
                    disabled={updateSocialMediaMutation.isPending}
                  >
                    Mark Posted
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Event Summary */}
        <div className="space-y-2 mb-3">
          <div className="bg-white rounded-lg p-2 space-y-2">
            {/* Assigned Recipients */}
            <div className="bg-[#e6f2f5] rounded-lg p-3">
              <div className="flex items-start gap-2 text-sm">
                <Building className="w-4 h-4 text-[#236383] mt-0.5" />
                <div className="flex-1">
                  <span className="font-medium text-[#236383]">Recipients & Hosts:</span>
                  {isEditingThisCard && editingField === 'assignedRecipientIds' ? (
                    <div className="space-y-2 mt-2">
                      <MultiRecipientSelector
                        value={editingValue ? JSON.parse(editingValue) : []}
                        onChange={(ids) => setEditingValue(JSON.stringify(ids))}
                        placeholder="Select recipient organizations..."
                        data-testid="assigned-recipients-editor"
                      />
                      <div className="flex gap-2">
                        <Button size="sm" onClick={saveEdit}>
                          <Save className="w-3 h-3 mr-1" />
                          Save
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={cancelEdit}
                        >
                          <X className="w-3 h-3 mr-1" />
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-start gap-2 mt-1">
                      {assignedRecipientInfo.length > 0 ? (
                        <div className="flex flex-wrap gap-1 flex-1">
                          {assignedRecipientInfo.map((item, index) => (
                            <Badge
                              key={index}
                              variant="secondary"
                              className="bg-white text-[#236383] border border-[#236383]/30 text-xs flex items-center gap-1"
                              data-testid={`badge-${item.type}-${index}`}
                            >
                              {item.icon}
                              {item.name}
                            </Badge>
                          ))}
                        </div>
                      ) : (
                        canEditOrgDetails && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              startEditing(
                                'assignedRecipientIds',
                                (request as any).assignedRecipientIds ? JSON.stringify((request as any).assignedRecipientIds) : '[]'
                              )
                            }
                            className="text-[#236383] border-[#236383]/30 hover:bg-[#236383]/10"
                          >
                            <Edit2 className="w-3 h-3 mr-1" />
                            Add Recipients
                          </Button>
                        )
                      )}
                      {canEditOrgDetails && assignedRecipientInfo.length > 0 && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() =>
                            startEditing(
                              'assignedRecipientIds',
                              (request as any).assignedRecipientIds ? JSON.stringify((request as any).assignedRecipientIds) : '[]'
                            )
                          }
                          className="h-6 px-2 opacity-70 hover:opacity-100 transition-opacity"
                        >
                          <Edit2 className="w-3 h-3" />
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Event Address - with inline editing */}
            {(request.eventAddress || isEditingField && editingField === 'eventAddress' || canEditOrgDetails) && (
              <div className="bg-[#e6f2f5] rounded-lg p-3">
                <div className="flex items-start gap-2 text-sm">
                  <MapPin className="w-4 h-4 text-[#236383] mt-0.5" />
                  <div className="flex-1">
                    {isEditingField && editingField === 'eventAddress' ? (
                      <div className="flex flex-col gap-2">
                        <Textarea
                          value={editingValue}
                          onChange={(e) => setEditingValue(e.target.value)}
                          className="min-h-[60px]"
                          placeholder="Enter event address"
                          autoFocus
                          data-testid="input-event-address"
                        />
                        <div className="flex gap-2">
                          <Button size="sm" onClick={saveEdit} data-testid="button-save-event-address">
                            <Save className="w-3 h-3 mr-1" />
                            Save
                          </Button>
                          <Button size="sm" variant="ghost" onClick={cancelEdit} data-testid="button-cancel-event-address">
                            <X className="w-3 h-3 mr-1" />
                            Cancel
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-start justify-between gap-2 group">
                        <div className="flex-1">
                          <span className="font-medium text-[#236383]">Event Address:</span>
                          <p className="text-gray-700 mt-1">
                            {request.eventAddress || <span className="text-gray-400 italic">No address provided</span>}
                          </p>
                        </div>
                        {canEditOrgDetails && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => startEditing('eventAddress', request.eventAddress || '')}
                            className="h-6 px-2 opacity-30 group-hover:opacity-70 hover:opacity-100 transition-opacity"
                            title={request.eventAddress ? "Edit address" : "Add address"}
                            data-testid="button-edit-event-address"
                          >
                            <Edit2 className="w-3 h-3" />
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

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

            {/* Completion Notes */}
            {request.followUpNotes && (
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-sm font-medium mb-1">Completion Notes:</p>
                <p className="text-sm text-gray-600">{request.followUpNotes}</p>
              </div>
            )}
          </div>

          {/* Assignments Summary - Always show so staff can be added to completed events */}
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

        {/* Action Buttons */}
        <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t">
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
        <div className="mt-3 border-t border-gray-200 pt-2">
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

      {/* Dialog for marking as posted with Instagram link */}
      <Dialog open={showInstagramDialog} onOpenChange={setShowInstagramDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Mark Social Media as Posted</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              Confirm that the social media post has been completed.
            </p>
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">
                Instagram Link (optional)
              </label>
              <Input
                type="url"
                placeholder="https://instagram.com/p/..."
                value={instagramLink}
                onChange={(e) => setInstagramLink(e.target.value)}
                className="w-full"
              />
              <p className="text-xs text-gray-500">
                Add a link to the Instagram post if available
              </p>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setShowInstagramDialog(false);
                setInstagramLink('');
              }}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                handleMarkPostedWithLink();
                setShowInstagramDialog(false);
              }}
              className="flex-1 bg-[#47b3cb] hover:bg-[#236383] text-white"
              disabled={updateSocialMediaMutation.isPending}
            >
              Mark as Posted
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
};