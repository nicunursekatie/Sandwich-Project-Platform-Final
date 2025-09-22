import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
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
  FileText,
} from 'lucide-react';
import { formatTime12Hour, formatTimeForInput, formatEventDate } from '@/components/event-requests/utils';
import { SANDWICH_TYPES, statusColors, statusIcons, statusOptions } from '@/components/event-requests/constants';
import { parseSandwichTypes, formatSandwichTypesDisplay } from '@/lib/sandwich-utils';
import type { EventRequest } from '@shared/schema';

interface DeliveryDestinationEditorProps {
  currentValue: string;
  onSave: () => void;
  onCancel: () => void;
  setEditingValue: (value: string) => void;
}

const DeliveryDestinationEditor: React.FC<DeliveryDestinationEditorProps> = ({
  currentValue,
  onSave,
  onCancel,
  setEditingValue
}) => {
  const [selectedOption, setSelectedOption] = React.useState(currentValue ? 'custom' : '');
  const [customValue, setCustomValue] = React.useState(currentValue);

  // Fetch recipients from the API
  const { data: recipients = [], isLoading, error } = useQuery({
    queryKey: ['recipients'],
    queryFn: async () => {
      const response = await fetch('/api/recipients');
      if (!response.ok) {
        throw new Error('Failed to fetch recipients');
      }
      return response.json();
    },
  });

  const handleSave = () => {
    if (selectedOption === 'custom') {
      setEditingValue(customValue);
    } else {
      setEditingValue(selectedOption);
    }
    onSave();
  };

  return (
    <div className="space-y-2">
      <select
        value={selectedOption}
        onChange={(e) => setSelectedOption(e.target.value)}
        className="h-8 px-2 border border-gray-300 rounded text-sm w-full"
                    autoFocus
        disabled={isLoading}
      >
        <option value="">Select recipient organization...</option>
        {isLoading && <option disabled>Loading recipients...</option>}
        {error && <option disabled>Error loading recipients</option>}
        {recipients.map((recipient: any) => (
          <option key={recipient.id} value={recipient.name}>
            {recipient.name}
          </option>
        ))}
        <option value="custom">Custom destination...</option>
      </select>
      {selectedOption === 'custom' && (
        <Input
          type="text"
          placeholder="Enter custom destination..."
          value={customValue}
          onChange={(e) => setCustomValue(e.target.value)}
          className="h-8 w-full"
        />
      )}
      <div className="flex gap-2">
        <Button size="sm" onClick={handleSave}>
          <Save className="w-3 h-3 mr-1" />
          Save
                  </Button>
        <Button size="sm" variant="ghost" onClick={onCancel}>
          <X className="w-3 h-3 mr-1" />
          Cancel
                  </Button>
      </div>
    </div>
  );
};

interface TimeDialogContentProps {
  request: EventRequest;
  startEditing: (field: string, value: string) => void;
  saveEdit: () => void;
  cancelEdit: () => void;
}

const TimeDialogContent: React.FC<TimeDialogContentProps> = ({
  request,
  startEditing,
  saveEdit,
  cancelEdit
}) => {
  const [tempStartTime, setTempStartTime] = React.useState(request.eventStartTime || '');
  const [tempEndTime, setTempEndTime] = React.useState(request.eventEndTime || '');
  const [tempPickupTime, setTempPickupTime] = React.useState(request.pickupTime || '');

  const handleSave = () => {
    if (tempStartTime && !request.eventStartTime) {
      startEditing('eventStartTime', tempStartTime);
    }
    if (tempEndTime && !request.eventEndTime) {
      startEditing('eventEndTime', tempEndTime);
    }
    if (tempPickupTime && !request.pickupTime) {
      startEditing('pickupTime', tempPickupTime);
    }
    saveEdit();
  };

  const hasChanges = () => {
    return (tempStartTime && !request.eventStartTime) ||
           (tempEndTime && !request.eventEndTime) ||
           (tempPickupTime && !request.pickupTime);
  };

    return (
    <div className="space-y-4">
      {!request.eventStartTime && (
        <div className="space-y-2">
          <label className="text-sm font-medium">Event Start Time</label>
          <Input
            type="time"
            value={tempStartTime}
            onChange={(e) => setTempStartTime(e.target.value)}
            className="w-full"
            placeholder="Select start time"
          />
            </div>
          )}
      {!request.eventEndTime && (
        <div className="space-y-2">
          <label className="text-sm font-medium">Event End Time</label>
          <Input
            type="time"
            value={tempEndTime}
            onChange={(e) => setTempEndTime(e.target.value)}
            className="w-full"
            placeholder="Select end time"
          />
        </div>
      )}
      {!request.pickupTime && (
        <div className="space-y-2">
          <label className="text-sm font-medium">Pickup Time</label>
          <Input
            type="time"
            value={tempPickupTime}
            onChange={(e) => setTempPickupTime(e.target.value)}
            className="w-full"
            placeholder="Select pickup time"
          />
          </div>
        )}
      <div className="flex justify-end gap-2 pt-4">
        <Button variant="outline" onClick={cancelEdit}>
          Cancel
            </Button>
            <Button
          onClick={handleSave}
          disabled={!hasChanges()}
        >
          Save Times
            </Button>
        </div>
      </div>
    );
  };

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
    <Card className="transition-all duration-200 hover:shadow-lg bg-gradient-to-br from-[#fef3e2] via-[#FBAD3F]/60 to-[#FBAD3F]/40 border border-[#FBAD3F]/30 shadow-lg">
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
              {staffingComplete ? (
                <Badge className="bg-[#47B3CB] text-white px-2 py-1 text-xs shadow-sm">
                  <Check className="w-3 h-3 mr-1" />
                  Fully Staffed
                </Badge>
              ) : (
                <div className="flex gap-1">
                  {driverNeeded > driverAssigned && (
                    <Badge className="bg-[#A31C41] text-white px-2 py-1 text-xs shadow-sm">
                      {driverNeeded - driverAssigned} driver{driverNeeded - driverAssigned > 1 ? 's' : ''} needed
                    </Badge>
                  )}
                  {speakerNeeded > speakerAssigned && (
                    <Badge className="bg-[#A31C41] text-white px-2 py-1 text-xs shadow-sm">
                      {speakerNeeded - speakerAssigned} speaker{speakerNeeded - speakerAssigned > 1 ? 's' : ''} needed
                    </Badge>
                  )}
                  {volunteerNeeded > volunteerAssigned && (
                    <Badge className="bg-[#A31C41] text-white px-2 py-1 text-xs shadow-sm">
                      {volunteerNeeded - volunteerAssigned} volunteer{volunteerNeeded - volunteerAssigned > 1 ? 's' : ''} needed
                    </Badge>
                      )}
                    </div>
                  )}
                </div>
              </div>
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

          {/* Quick Actions */}
          {canEdit && (
            <div className="flex gap-1">
              <Button size="sm" variant="ghost" onClick={onEdit}>
                <Edit2 className="w-4 h-4" />
              </Button>
              <Button size="sm" variant="ghost" onClick={onDelete} className="text-red-600 hover:text-red-700">
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          )}
        </div>

        {/* Main Content */}
        <div className="space-y-4">
            {/* Event Location */}
            {request.eventAddress && (
              <div className="bg-white/90 rounded-lg p-3 mb-4 border border-white/50 shadow-sm">
                <div className="flex items-center gap-2 mb-2">
                  <MapPin className="w-4 h-4 text-[#47B3CB]" />
                  <span className="font-semibold text-gray-800">Event Location</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-base font-medium text-gray-600">Address:</span>
                  <a 
                    href={`https://maps.google.com/maps?q=${encodeURIComponent(request.eventAddress)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-base text-blue-600 hover:text-blue-800 hover:underline"
                  >
                    {request.eventAddress}
                  </a>
                </div>
            </div>
          )}

            {/* Delivery Logistics */}
            <div className="bg-white/90 rounded-lg p-3 mb-4 border border-white/50 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Package className="w-4 h-4 text-[#47B3CB]" />
                  <span className="font-semibold text-gray-800">Delivery Logistics</span>
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-base font-medium text-gray-600">Overnight Holding:</span>
                  {isEditingThisCard && editingField === 'overnightHoldingLocation' ? (
                    <div className="flex items-center gap-2">
                      <Input
                        type="text"
                        value={editingValue}
                        onChange={(e) => setEditingValue(e.target.value)}
                        className="h-8 w-48"
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
                      <span className="text-base">
                        {request.overnightHoldingLocation || 'Not specified'}
                      </span>
                      {canEdit && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => startEditing('overnightHoldingLocation', request.overnightHoldingLocation || '')}
                          className="h-5 px-1 opacity-0 group-hover:opacity-70 hover:opacity-100 transition-opacity"
                        >
                          <Edit2 className="w-3 h-3" />
                        </Button>
                      )}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-base font-medium text-gray-600">Recipients:</span>
                  {isEditingThisCard && editingField === 'deliveryDestination' ? (
                    <DeliveryDestinationEditor 
                      currentValue={request.deliveryDestination || ''}
                      onSave={saveEdit}
                      onCancel={cancelEdit}
                      setEditingValue={setEditingValue}
                    />
                  ) : (
                    <div className="flex items-center gap-1 group">
                      <span className="text-base">
                        {request.deliveryDestination || 'Not specified'}
                      </span>
                      {canEdit && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => startEditing('deliveryDestination', request.deliveryDestination || '')}
                          className="h-5 px-1 opacity-0 group-hover:opacity-70 hover:opacity-100 transition-opacity"
                        >
                          <Edit2 className="w-3 h-3" />
                        </Button>
                      )}
                    </div>
                  )}
                </div>
            </div>
          </div>

            {/* Sandwich Information */}
            <div className="bg-white/90 rounded-lg p-3 mb-4 border border-white/50 shadow-sm">
              <div className="flex items-center gap-2 mb-2">
                <Package className="w-4 h-4 text-[#47B3CB]" />
                <span className="font-semibold text-gray-800">Sandwich Details</span>
              </div>
              <div className="space-y-2">
            {renderSandwichEdit()}
          </div>
        </div>

            {/* Event Times */}
            <div className="bg-white/90 rounded-lg p-3 mb-4 border border-white/50 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-[#47B3CB]" />
                  <span className="font-semibold text-gray-800">Event Times</span>
              </div>
                {canEdit && (
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 px-2 text-sm text-[#47B3CB] hover:bg-[#47B3CB]/10"
                      >
                        + Add Times
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-md">
                      <DialogHeader>
                        <DialogTitle>Add Event Times</DialogTitle>
                      </DialogHeader>
                      <TimeDialogContent 
                        request={request}
                        startEditing={startEditing}
                        saveEdit={saveEdit}
                        cancelEdit={cancelEdit}
                      />
                    </DialogContent>
                  </Dialog>
                )}
              </div>
              <div className="space-y-2">
                {/* Times - only show if they exist */}
                {(request.eventStartTime || request.eventEndTime || request.pickupTime) ? (
                  <div className="space-y-2">
                    {request.eventStartTime && (
                      <div className="flex items-center gap-1 group">
                        <span className="text-base font-medium text-gray-600">Start:</span>
                        <span className="text-base">{formatTime12Hour(request.eventStartTime)}</span>
                        {canEdit && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => startEditing('eventStartTime', request.eventStartTime ? formatTimeForInput(request.eventStartTime) : '')}
                            className="h-5 px-1 opacity-0 group-hover:opacity-70 hover:opacity-100 transition-opacity"
                          >
                            <Edit2 className="w-3 h-3" />
                          </Button>
              )}
            </div>
                    )}
                    {request.eventEndTime && (
                      <div className="flex items-center gap-1 group">
                        <span className="text-base font-medium text-gray-600">End:</span>
                        <span className="text-base">{formatTime12Hour(request.eventEndTime)}</span>
                        {canEdit && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => startEditing('eventEndTime', request.eventEndTime ? formatTimeForInput(request.eventEndTime) : '')}
                            className="h-5 px-1 opacity-0 group-hover:opacity-70 hover:opacity-100 transition-opacity"
                          >
                            <Edit2 className="w-3 h-3" />
                          </Button>
                        )}
          </div>
                    )}
                    {request.pickupTime && (
                      <div className="flex items-center gap-1 group">
                        <span className="text-base font-medium text-gray-600">Pickup:</span>
                        <span className="text-base">{formatTime12Hour(request.pickupTime)}</span>
                        {canEdit && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => startEditing('pickupTime', request.pickupTime ? formatTimeForInput(request.pickupTime) : '')}
                            className="h-5 px-1 opacity-0 group-hover:opacity-70 hover:opacity-100 transition-opacity"
                          >
                            <Edit2 className="w-3 h-3" />
                          </Button>
                        )}
        </div>
                    )}
                    
                    {/* Inline editing for times */}
                    {isEditingThisCard && (editingField === 'eventStartTime' || editingField === 'eventEndTime' || editingField === 'pickupTime') && (
                      <div className="flex items-center gap-2 mt-2">
                        <Input
                          type="time"
                          value={editingValue}
                          onChange={(e) => setEditingValue(e.target.value)}
                          className="h-8 w-32"
                          autoFocus
                        />
                        <Button size="sm" onClick={saveEdit}>
                          <Save className="w-3 h-3" />
                        </Button>
                        <Button size="sm" variant="ghost" onClick={cancelEdit}>
                          <X className="w-3 h-3" />
                        </Button>
              </div>
                    )}
                </div>
                ) : (
                  <div className="text-base text-gray-500 italic">
                    No times set yet. Click "Add Times" to add event times.
                  </div>
                )}
              </div>
            </div>

            {/* TSP Contact */}
            {(request.tspContact || request.customTspContact) && (
              <div className="bg-white/90 rounded-lg p-3 mb-4 border border-white/50 shadow-sm">
                <div className="flex items-center gap-2">
                  <Building className="w-4 h-4 text-[#FBAD3F]" />
                  <span className="text-base">
                    <span className="font-medium text-[#FBAD3F]">TSP Contact:</span>{' '}
                    {request.tspContact ? resolveUserName(request.tspContact) : request.customTspContact}
                  </span>
            </div>
          </div>
        )}


        {/* Team Assignments */}
        {totalNeeded > 0 && (
          <div className="bg-white/90 rounded-lg p-4 mb-4 border border-white/50 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <span className="font-semibold text-gray-800">Team Assignments</span>
              <span className={`text-base font-bold px-2 py-1 rounded-full ${
                staffingComplete 
                  ? 'bg-[#47B3CB]/20 text-[#47B3CB]' 
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
                    ? 'bg-[#47B3CB]/10 border-[#47B3CB]/30' 
                    : 'bg-red-50 border-red-200'
                }`}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Car className="w-4 h-4 text-[#47B3CB]" />
                      <span className="font-medium text-[#47B3CB]">Drivers</span>
                      <span className={`text-sm px-2 py-1 rounded-full font-bold ${
                        driverAssigned >= driverNeeded 
                          ? 'bg-[#47B3CB]/20 text-[#47B3CB]' 
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
                        className="h-8 text-sm border-[#47B3CB]/40 text-[#47B3CB] hover:bg-[#47B3CB] hover:text-white"
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
                    ? 'bg-[#47B3CB]/10 border-[#47B3CB]/30' 
                    : 'bg-red-50 border-red-200'
                }`}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Megaphone className="w-4 h-4 text-[#47B3CB]" />
                      <span className="font-medium text-[#47B3CB]">Speakers</span>
                      <span className={`text-sm px-2 py-1 rounded-full font-bold ${
                        speakerAssigned >= speakerNeeded 
                          ? 'bg-[#47B3CB]/20 text-[#47B3CB]' 
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
                        className="h-8 text-sm border-[#47B3CB]/40 text-[#47B3CB] hover:bg-[#47B3CB] hover:text-white"
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
                    ? 'bg-[#47B3CB]/10 border-[#47B3CB]/30' 
                    : 'bg-red-50 border-red-200'
                }`}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Users className="w-4 h-4 text-[#47B3CB]" />
                      <span className="font-medium text-[#47B3CB]">Volunteers</span>
                      <span className={`text-sm px-2 py-1 rounded-full font-bold ${
                        volunteerAssigned >= volunteerNeeded 
                          ? 'bg-[#47B3CB]/20 text-[#47B3CB]' 
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
                        className="h-8 text-sm border-[#47B3CB]/40 text-[#47B3CB] hover:bg-[#47B3CB] hover:text-white"
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
                <div className="rounded-lg p-3 border bg-orange-50 border-orange-200">
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

        {/* Request Message */}
        {request.message && (
          <div className="bg-blue-50 rounded-lg p-3 mb-4 border border-blue-200">
            <div className="flex items-center gap-2 mb-2">
              <MessageSquare className="w-4 h-4 text-blue-600" />
              <span className="font-medium text-blue-800">Original Request Message</span>
            </div>
            <p className="text-base text-blue-700">{request.message}</p>
          </div>
        )}

        {/* Planning Notes */}
        <div className="bg-[#47B3CB]/10 rounded-lg p-3 mb-4 border border-[#47B3CB]/30">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-[#47B3CB]" />
              <span className="font-medium text-[#47B3CB]">Planning Notes</span>
            </div>
          {canEdit && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => startEditing('planningNotes', request.planningNotes || '')}
                className="h-6 px-2 text-sm text-[#47B3CB] hover:bg-[#47B3CB]/10"
              >
                <Edit2 className="w-3 h-3 mr-1" />
                {request.planningNotes ? 'Edit' : 'Add'}
              </Button>
            )}
          </div>
          {isEditingThisCard && editingField === 'planningNotes' ? (
            <div className="space-y-2">
              <textarea
                value={editingValue}
                onChange={(e) => setEditingValue(e.target.value)}
                className="w-full p-2 border border-gray-300 rounded text-sm min-h-[80px]"
                placeholder="Add planning notes..."
                autoFocus
              />
              <div className="flex gap-2">
                <Button size="sm" onClick={saveEdit}>
                  <Save className="w-3 h-3 mr-1" />
                  Save
                </Button>
                <Button size="sm" variant="ghost" onClick={cancelEdit}>
                  <X className="w-3 h-3 mr-1" />
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <p className="text-base text-gray-700">
              {request.planningNotes || 'No planning notes yet. Click "Add" to add notes.'}
            </p>
          )}
        </div>

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
      </div>
      </CardContent>
    </Card>
  );
};