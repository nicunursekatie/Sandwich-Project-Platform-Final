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
  MessageSquare,
  Building,
  AlertTriangle,
  Car,
  Megaphone,
  UserPlus,
  Check,
  Phone,
  Mail,
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
  // Helper functions
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

  const StatusIcon = statusIcons[request.status as keyof typeof statusIcons] || statusIcons.new;

  // Calculate staffing status
  const driverAssigned = parsePostgresArray(request.assignedDriverIds).length;
  const speakerAssigned = Object.keys(request.speakerDetails || {}).length;
  const volunteerAssigned = parsePostgresArray(request.assignedVolunteerIds).length;

  const driverNeeded = request.driversNeeded || 0;
  const speakerNeeded = request.speakersNeeded || 0;
  const volunteerNeeded = request.volunteersNeeded || 0;

  const totalAssigned = driverAssigned + speakerAssigned + volunteerAssigned;
  const totalNeeded = driverNeeded + speakerNeeded + volunteerNeeded;
  const staffingComplete = totalAssigned >= totalNeeded && totalNeeded > 0;

  // Get display date
  const displayDate = request.scheduledEventDate || request.desiredEventDate;
  const dateInfo = displayDate ? formatEventDate(displayDate.toString()) : null;

  // Get status label
  const getStatusLabel = (status: string) => {
    const statusOption = statusOptions.find(option => option.value === status);
    return statusOption ? statusOption.label : status.replace('_', ' ');
  };

  // Format date for input
  const formatDateForInput = (dateStr: string) => {
    if (!dateStr) return '';
    return dateStr.split('T')[0];
  };

  // Determine date field to edit
  let dateFieldToEdit = 'desiredEventDate';
  let dateLabel = 'Requested Date';
  if (request.scheduledEventDate) {
    dateFieldToEdit = 'scheduledEventDate';
    dateLabel = request.status === 'completed' ? 'Event Date' : 'Scheduled Date';
  }

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
      <div className="flex items-center gap-2 group">
        <span className="text-base font-medium text-gray-600">{label}:</span>
        <span className="text-base">
          {field === 'eventAddress' && value ? (
            <a 
              href={`https://maps.google.com/maps?q=${encodeURIComponent(value)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:text-blue-800 hover:underline"
            >
              {value}
            </a>
          ) : (
            value || 'Not set'
          )}
        </span>
          {canEdit && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                if (type === 'time') {
                  const rawValue = request[field as keyof EventRequest] as string;
                  startEditing(field, rawValue || '');
                } else {
                  startEditing(field, value?.toString() || '');
                }
              }}
            className="h-6 px-2 opacity-0 group-hover:opacity-70 hover:opacity-100 transition-opacity"
            >
              <Edit2 className="w-3 h-3" />
            </Button>
          )}
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
        <div className="flex items-center gap-2 group">
          <Package className="w-4 h-4 text-amber-600" />
          <span className="text-base font-medium text-gray-600">Sandwiches:</span>
          <span className="text-base font-semibold">{sandwichInfo}</span>
            {canEdit && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => startEditing('sandwichTypes', '')}
              className="h-6 px-2 opacity-0 group-hover:opacity-70 hover:opacity-100 transition-opacity"
              >
                <Edit2 className="w-3 h-3" />
              </Button>
            )}
        </div>
      );
    }

    // Editing sandwich types
    return (
      <div className="space-y-3 p-3 bg-amber-50 rounded-lg">
        <div className="flex items-center justify-between">
          <span className="font-medium">Edit Sandwiches</span>
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
    <Card className="transition-all duration-200 hover:shadow-lg bg-gradient-to-br from-[#FBAD3F]/15 via-[#FBAD3F]/8 to-white border border-[#FBAD3F]/30 shadow-lg">
      <CardContent className="p-6">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <h3 className="text-xl font-bold text-gray-900">{request.organizationName}</h3>
              <Badge className="bg-[#FBAD3F] text-white px-3 py-1 text-sm font-medium shadow-sm">
                <StatusIcon className="w-3 h-3 mr-1" />
                {getStatusLabel(request.status)}
              </Badge>
              {staffingComplete && (
                <Badge className="bg-[#236383] text-white px-2 py-1 text-xs shadow-sm">
                  <Check className="w-3 h-3 mr-1" />
                  Fully Staffed
                </Badge>
            )}
          </div>

            {/* Contact & Date */}
            <div className="flex items-center gap-6 text-base text-gray-600 mb-3">
              <div className="flex items-center gap-1">
                <span className="font-medium">{request.firstName} {request.lastName}</span>
                {request.email && (
                  <a href={`mailto:${request.email}`} className="text-blue-600 hover:text-blue-800">
                    <Mail className="w-3 h-3" />
                  </a>
                )}
                {request.phone && (
                  <a href={`tel:${request.phone}`} className="text-blue-600 hover:text-blue-800">
                    <Phone className="w-3 h-3" />
                  </a>
                      )}
                    </div>
              
              <div className="flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                {isEditingThisCard && editingField === dateFieldToEdit ? (
                  <div className="flex items-center gap-2">
                    <Input
                      type="date"
                      value={formatDateForInput(editingValue)}
                      onChange={(e) => setEditingValue(e.target.value)}
                      className="h-7 w-36"
                      autoFocus
                    />
                    <Button size="sm" onClick={saveEdit}>
                      <Save className="w-3 h-3" />
                    </Button>
                    <Button size="sm" variant="ghost" onClick={cancelEdit}>
                      <X className="w-3 h-3" />
                    </Button>
                </div>
                ) : (
                  <div className="flex items-center gap-1 group">
                    <span className="font-medium">{dateLabel}:</span>
                    <span>{displayDate && dateInfo ? dateInfo.text : 'No date set'}</span>
                    {canEdit && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => startEditing(dateFieldToEdit, formatDateForInput(displayDate?.toString() || ''))}
                        className="h-5 px-1 opacity-0 group-hover:opacity-70 hover:opacity-100 transition-opacity"
                      >
                        <Edit2 className="w-3 h-3" />
                      </Button>
              )}
            </div>
              )}
            </div>
          </div>

            {/* Key Details */}
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div className="space-y-2">
                {request.eventAddress && (
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-gray-500" />
                    <a 
                      href={`https://maps.google.com/maps?q=${encodeURIComponent(request.eventAddress)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-blue-600 hover:text-blue-800 hover:underline"
                    >
                      {request.eventAddress}
                    </a>
          </div>
                )}
                
                {renderSandwichEdit()}
              </div>

              <div className="space-y-2">
                {/* Times - only show if they exist */}
                {(request.eventStartTime || request.eventEndTime || request.pickupTime) && (
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-gray-500" />
                    <div className="text-base space-x-3">
                      {request.eventStartTime && (
                        <span>Start: {formatTime12Hour(request.eventStartTime)}</span>
                      )}
                      {request.eventEndTime && (
                        <span>End: {formatTime12Hour(request.eventEndTime)}</span>
                      )}
                      {request.pickupTime && (
                        <span>Pickup: {formatTime12Hour(request.pickupTime)}</span>
              )}
            </div>
                    {canEdit && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          if (!request.eventStartTime) startEditing('eventStartTime', '');
                          else if (!request.eventEndTime) startEditing('eventEndTime', '');
                          else if (!request.pickupTime) startEditing('pickupTime', '');
                        }}
                        className="h-6 px-2 text-sm text-blue-600"
                      >
                        + Add Time
                      </Button>
                    )}
          </div>
                )}

                {/* TSP Contact */}
        {(request.tspContact || request.customTspContact) && (
                  <div className="flex items-center gap-2">
                    <Building className="w-4 h-4 text-[#FBAD3F]" />
                    <span className="text-base">
                      <span className="font-medium text-[#FBAD3F]">TSP Contact:</span>{' '}
                      {request.tspContact ? resolveUserName(request.tspContact) : request.customTspContact}
                    </span>
              </div>
                )}
                </div>
                </div>
          </div>

          {/* Quick Actions */}
          {canEdit && (
            <div className="flex gap-1 ml-4">
              <Button size="sm" variant="ghost" onClick={onEdit}>
                <Edit2 className="w-4 h-4" />
              </Button>
              <Button size="sm" variant="ghost" onClick={onDelete} className="text-red-600 hover:text-red-700">
                <Trash2 className="w-4 h-4" />
              </Button>
                  </div>
                )}
              </div>

        {/* Team Assignments */}
        {totalNeeded > 0 && (
          <div className="bg-white/80 rounded-lg p-4 mb-4 border border-[#FBAD3F]/20">
            <div className="flex items-center justify-between mb-3">
              <span className="font-semibold text-gray-800">Team Assignments</span>
              <span className={`text-base font-bold px-2 py-1 rounded-full ${
                staffingComplete 
                  ? 'bg-[#236383]/20 text-[#236383]' 
                  : 'bg-[#A31C41]/20 text-[#A31C41]'
              }`}>
                {totalAssigned}/{totalNeeded} assigned
              </span>
            </div>

            <div className="space-y-3">
            {/* Drivers */}
              {driverNeeded > 0 && (
                <div className={`rounded-lg p-3 border ${
                  driverAssigned >= driverNeeded 
                    ? 'bg-[#236383]/10 border-[#236383]/30' 
                    : 'bg-[#A31C41]/10 border-[#A31C41]/30'
                }`}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Car className="w-4 h-4 text-[#236383]" />
                      <span className="font-medium text-[#236383]">Drivers</span>
                      <span className={`text-sm px-2 py-1 rounded-full font-bold ${
                        driverAssigned >= driverNeeded 
                          ? 'bg-[#236383]/20 text-[#236383]' 
                          : 'bg-[#A31C41]/20 text-[#A31C41]'
                      }`}>
                        {driverAssigned}/{driverNeeded}
                </span>
              </div>
                    {canEdit && (
                      <Button 
                        size="sm" 
                        variant="outline" 
                        onClick={() => openAssignmentDialog('driver')}
                        className="h-8 text-sm border-[#236383]/40 text-[#236383] hover:bg-[#236383] hover:text-white"
                      >
                        <UserPlus className="w-3 h-3 mr-1" />
                        {driverAssigned < driverNeeded ? 'Assign' : 'Add'}
                      </Button>
                    )}
            </div>
                  {driverAssigned > 0 ? (
                    <div className="space-y-1">
                      {parsePostgresArray(request.assignedDriverIds).map((driverId: string) => {
                        let name = '';
                        if (driverId.startsWith('custom-')) {
                          const parts = driverId.split('-');
                          if (parts.length >= 3) {
                            name = parts.slice(2).join('-').replace(/-/g, ' ');
                          }
                        } else {
                          const detailName = (request.driverDetails as any)?.[driverId]?.name;
                          name = (detailName && !/^\d+$/.test(detailName)) ? detailName : resolveUserName(driverId);
                        }
                        return (
                          <div key={driverId} className="flex items-center justify-between bg-white/60 rounded px-2 py-1">
                            <span className="text-base font-medium">{name}</span>
                            {canEdit && (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleRemoveAssignment('driver', driverId)}
                                className="h-6 w-6 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                              >
                                <X className="w-3 h-3" />
                              </Button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-base text-gray-500 italic">No drivers assigned</div>
                  )}
                </div>
              )}

            {/* Speakers */}
              {speakerNeeded > 0 && (
                <div className={`rounded-lg p-3 border ${
                  speakerAssigned >= speakerNeeded 
                    ? 'bg-[#236383]/10 border-[#236383]/30' 
                    : 'bg-[#A31C41]/10 border-[#A31C41]/30'
                }`}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Megaphone className="w-4 h-4 text-[#236383]" />
                      <span className="font-medium text-[#236383]">Speakers</span>
                      <span className={`text-sm px-2 py-1 rounded-full font-bold ${
                        speakerAssigned >= speakerNeeded 
                          ? 'bg-[#236383]/20 text-[#236383]' 
                          : 'bg-[#A31C41]/20 text-[#A31C41]'
                      }`}>
                        {speakerAssigned}/{speakerNeeded}
                </span>
              </div>
                    {canEdit && (
                      <Button 
                        size="sm" 
                        variant="outline" 
                        onClick={() => openAssignmentDialog('speaker')}
                        className="h-8 text-sm border-[#236383]/40 text-[#236383] hover:bg-[#236383] hover:text-white"
                      >
                        <UserPlus className="w-3 h-3 mr-1" />
                        {speakerAssigned < speakerNeeded ? 'Assign' : 'Add'}
                      </Button>
                    )}
            </div>
                  {speakerAssigned > 0 ? (
                    <div className="space-y-1">
                      {Object.keys(request.speakerDetails || {}).map((speakerId: string) => {
                        const detailName = (request.speakerDetails as any)?.[speakerId]?.name;
                        const name = (detailName && !/^\d+$/.test(detailName)) ? detailName : resolveUserName(speakerId);
                        return (
                          <div key={speakerId} className="flex items-center justify-between bg-white/60 rounded px-2 py-1">
                            <span className="text-base font-medium">{name}</span>
                            {canEdit && (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleRemoveAssignment('speaker', speakerId)}
                                className="h-6 w-6 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                              >
                                <X className="w-3 h-3" />
                              </Button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-base text-gray-500 italic">No speakers assigned</div>
                  )}
                </div>
              )}

            {/* Volunteers */}
              {volunteerNeeded > 0 && (
                <div className={`rounded-lg p-3 border ${
                  volunteerAssigned >= volunteerNeeded 
                    ? 'bg-[#236383]/10 border-[#236383]/30' 
                    : 'bg-[#A31C41]/10 border-[#A31C41]/30'
                }`}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Users className="w-4 h-4 text-[#236383]" />
                      <span className="font-medium text-[#236383]">Volunteers</span>
                      <span className={`text-sm px-2 py-1 rounded-full font-bold ${
                        volunteerAssigned >= volunteerNeeded 
                          ? 'bg-[#236383]/20 text-[#236383]' 
                          : 'bg-[#A31C41]/20 text-[#A31C41]'
                      }`}>
                        {volunteerAssigned}/{volunteerNeeded}
                </span>
              </div>
                    {canEdit && (
                      <Button 
                        size="sm" 
                        variant="outline" 
                        onClick={() => openAssignmentDialog('volunteer')}
                        className="h-8 text-sm border-[#236383]/40 text-[#236383] hover:bg-[#236383] hover:text-white"
                      >
                        <UserPlus className="w-3 h-3 mr-1" />
                        {volunteerAssigned < volunteerNeeded ? 'Assign' : 'Add'}
          </Button>
                    )}
                  </div>
                  {volunteerAssigned > 0 ? (
                    <div className="space-y-1">
                      {parsePostgresArray(request.assignedVolunteerIds).map((volunteerId: string) => {
                        const name = resolveUserName(volunteerId);
                        return (
                          <div key={volunteerId} className="flex items-center justify-between bg-white/60 rounded px-2 py-1">
                            <span className="text-base font-medium">{name}</span>
                            {canEdit && (
          <Button
            size="sm"
                                variant="ghost"
                                onClick={() => handleRemoveAssignment('volunteer', volunteerId)}
                                className="h-6 w-6 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
          >
                                <X className="w-3 h-3" />
          </Button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-base text-gray-500 italic">No volunteers assigned</div>
                  )}
                </div>
              )}

              {/* Van Driver - if needed */}
              {(request.vanDriverNeeded || request.assignedVanDriverId) && (
                <div className="rounded-lg p-3 border bg-[#A31C41]/10 border-[#A31C41]/30">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Car className="w-4 h-4 text-[#A31C41]" />
                      <span className="font-medium text-[#A31C41]">Van Driver</span>
                    </div>
                    {canEdit && !request.assignedVanDriverId && (
                      <Button 
                        size="sm" 
                        variant="outline" 
                        onClick={() => openAssignmentDialog('driver')}
                        className="h-8 text-sm border-[#A31C41]/40 text-[#A31C41] hover:bg-[#A31C41] hover:text-white"
                      >
                        <UserPlus className="w-3 h-3 mr-1" />
                        Assign
              </Button>
                    )}
                  </div>
                  {request.assignedVanDriverId ? (
                    <div className="flex items-center justify-between bg-white/60 rounded px-2 py-1">
                      <span className="text-base font-medium">
                        {request.customVanDriverName || resolveUserName(request.assignedVanDriverId)}
                      </span>
                      {canEdit && (
              <Button
                size="sm"
                variant="ghost"
                          onClick={() => handleRemoveAssignment('driver', request.assignedVanDriverId!)}
                          className="h-6 w-6 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
              >
                          <X className="w-3 h-3" />
              </Button>
                      )}
                    </div>
                  ) : (
                    <div className="text-base text-gray-500 italic">No van driver assigned</div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Notes */}
        {request.message && (
          <div className="bg-blue-50 rounded-lg p-3 mb-4">
            <div className="flex items-center gap-2 mb-2">
              <MessageSquare className="w-4 h-4 text-blue-600" />
              <span className="font-medium text-blue-800">Request Message</span>
            </div>
            <p className="text-base text-blue-700">{request.message}</p>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-2 pt-3 border-t border-gray-200">
          <Button size="sm" variant="outline" onClick={onContact}>
            Contact Organizer
          </Button>
          <Button size="sm" variant="outline" onClick={onReschedule}>
            Reschedule
          </Button>
          <div className="flex-1" />
          <Button size="sm" onClick={onFollowUp}>
            Follow Up
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};