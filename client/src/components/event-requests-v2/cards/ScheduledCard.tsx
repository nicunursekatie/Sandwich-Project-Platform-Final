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
  AlertCircle,
  MessageSquare,
} from 'lucide-react';
import { CardHeader } from './shared/CardHeader';
import { CardAssignments } from './shared/CardAssignments';
import { formatTime12Hour, formatTimeForInput } from '@/components/event-requests/utils';
import { SANDWICH_TYPES } from '@/components/event-requests/constants';
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
      <div className="group">
        <p className="text-base text-gray-600 font-medium">{label}</p>
        <div className="flex items-center gap-2">
          {field === 'eventAddress' && value ? (
            <a 
              href={`https://maps.google.com/maps?q=${encodeURIComponent(value)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-lg font-semibold text-[#236383] hover:text-[#FBAD3F] hover:underline transition-colors"
            >
              {value}
            </a>
          ) : (
            <p className="text-lg font-semibold">{value || 'Not set'}</p>
          )}
          {canEdit && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => startEditing(field, value?.toString() || '')}
              className="h-6 px-2 opacity-30 group-hover:opacity-70 hover:opacity-100 transition-opacity"
              title={`Edit ${label}`}
            >
              <Edit2 className="w-3 h-3" />
            </Button>
          )}
        </div>
      </div>
    );
  };

  const renderSandwichEdit = () => {
    if (!(isEditingThisCard && editingField === 'sandwichTypes')) {
      const sandwichInfo = formatSandwichTypesDisplay(
        request.sandwichTypes,
        request.estimatedSandwichCount
      );

      return (
        <div className="group bg-amber-50 rounded-lg p-3">
          <div className="flex items-center gap-2">
            <Package className="w-5 h-5 text-amber-600" />
            <span className="text-lg font-semibold">Sandwiches:</span>
            <span className="text-lg font-medium">{sandwichInfo}</span>
            {canEdit && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => startEditing('sandwichTypes', '')}
                className="h-6 px-2 ml-2 opacity-0 group-hover:opacity-70 hover:opacity-100 transition-opacity"
                title="Edit sandwich types"
              >
                <Edit2 className="w-3 h-3" />
              </Button>
            )}
          </div>
        </div>
      );
    }

    // Editing sandwich types
    return (
      <div className="bg-amber-50 rounded-lg p-3 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-lg font-semibold">Edit Sandwiches</span>
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
    <Card className="transition-all duration-200 hover:shadow-lg border-l-4 border-l-[#236383] bg-gradient-to-br from-[#e6f2f5] to-[#d1e9ed] border border-[#236383]/30">
      <CardContent className="p-6">
        <CardHeader 
          request={request} 
          canEdit={canEdit}
          isEditingThisCard={isEditingThisCard}
          editingField={editingField || ''}
          editingValue={editingValue}
          startEditing={startEditing}
          saveEdit={saveEdit}
          cancelEdit={cancelEdit}
          setEditingValue={setEditingValue}
        />

        {/* Event Details - Editable */}
        <div className="space-y-3 mb-4">
          {/* Event Location */}
          <div className="bg-white/50 rounded-lg p-3 border border-white/60">
            {renderEditableField(
              'eventAddress',
              request.eventAddress,
              'Event Location',
              'text'
            )}
          </div>

          {/* Destination */}
          {request.deliveryDestination && (
            <div className="bg-white/50 rounded-lg p-3 border border-white/60">
              {renderEditableField(
                'deliveryDestination',
                request.deliveryDestination,
                'Delivery Destination',
                'text'
              )}
            </div>
          )}

          {/* Times & Logistics - Compact */}
          <div className="bg-white/50 rounded-lg p-2 border border-white/60">
            <div className="grid grid-cols-4 gap-3 text-sm">
              {renderEditableField(
                'eventStartTime',
                request.eventStartTime && formatTime12Hour(request.eventStartTime),
                'Start Time',
                'time'
              )}
              {renderEditableField(
                'eventEndTime',
                request.eventEndTime && formatTime12Hour(request.eventEndTime),
                'End Time',
                'time'
              )}
              {renderEditableField(
                'pickupTime',
                request.pickupTime && formatTime12Hour(request.pickupTime),
                'Pickup Time',
                'time'
              )}
              {renderEditableField(
                'hasRefrigeration',
                request.hasRefrigeration === true ? 'Yes' : request.hasRefrigeration === false ? 'No' : 'Unknown',
                'Refrigeration',
                'select',
                [
                  { value: 'true', label: 'Yes' },
                  { value: 'false', label: 'No' },
                  { value: 'unknown', label: 'Unknown' },
                ]
              )}
            </div>
          </div>

          {/* Sandwich Details */}
          <div className="bg-white/50 rounded-lg p-3 border border-white/60">
            {renderSandwichEdit()}
          </div>
        </div>

        {/* Notes Section */}
        {(request.message || request.notes) && (
          <div className="bg-white/50 rounded-lg p-3 border border-white/60 mb-4">
            <h4 className="font-medium text-gray-700 mb-2 flex items-center gap-2">
              <MessageSquare className="w-4 h-4" />
              Notes
            </h4>
            <div className="space-y-3">
              {request.message && (
                <div>
                  <p className="text-sm font-medium text-gray-600 mb-2">Initial Request Message:</p>
                  <p className="text-base text-gray-800 bg-blue-50 p-3 rounded border-l-4 border-blue-300 leading-relaxed">
                    {request.message}
                  </p>
                </div>
              )}
              {request.notes && (
                <div>
                  <p className="text-sm font-medium text-gray-600 mb-2">Additional Notes:</p>
                  <p className="text-base text-gray-800 bg-gray-50 p-3 rounded border-l-4 border-gray-300 leading-relaxed">
                    {request.notes}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Assignments */}
        <CardAssignments
          request={request}
          resolveUserName={resolveUserName}
          canEdit={canEdit}
          canSelfSignup={canSelfSignup}
          isUserSignedUp={isUserSignedUp}
          onAssign={(type) => openAssignmentDialog(type)}
          onEditAssignment={(type, personId) => openEditAssignmentDialog(type, personId)}
          onRemoveAssignment={(type, personId) => handleRemoveAssignment(type, personId)}
          onSelfSignup={(type) => handleSelfSignup(type)}
        />

        {/* Staffing Needs - Editable (smaller text, less prominent) */}
        <div className="grid grid-cols-3 gap-4 mt-3 pt-3 border-t border-gray-200">
          <div className="text-sm text-gray-600">
            <span className="font-medium">Drivers Needed:</span> {request.driversNeeded || 0}
          </div>
          <div className="text-sm text-gray-600">
            <span className="font-medium">Speakers Needed:</span> {request.speakersNeeded || 0}
          </div>
          <div className="text-sm text-gray-600">
            <span className="font-medium">Volunteers Needed:</span> {request.volunteersNeeded || 0}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t">
          <Button
            size="sm"
            variant="outline"
            onClick={onContact}
          >
            <span className="text-base font-medium">Contact Organizer</span>
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={onReschedule}
          >
            <span className="text-base font-medium">Reschedule</span>
          </Button>

          <div className="flex-1" />

          {canEdit && (
            <>
              <Button size="sm" variant="ghost" onClick={onEdit}>
                <Edit2 className="w-5 h-5" />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={onDelete}
                className="text-red-600 hover:text-red-700"
              >
                <Trash2 className="w-5 h-5" />
              </Button>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
};