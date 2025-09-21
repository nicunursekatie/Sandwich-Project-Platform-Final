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
  CheckCircle,
  AlertCircle,
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
      <div className="flex items-center justify-between group">
        <div>
          <p className="text-sm text-gray-500">{label}</p>
          <p className="font-medium">{value || 'Not set'}</p>
        </div>
        {canEdit && (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => startEditing(field, value?.toString() || '')}
            className="opacity-0 group-hover:opacity-100 transition-opacity"
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
        request.estimatedSandwichCount
      );

      return (
        <div className="flex items-center justify-between group bg-amber-50 rounded-lg p-3">
          <div className="flex items-center gap-2">
            <Package className="w-4 h-4 text-amber-600" />
            <span className="font-medium">Sandwiches:</span>
            <span>{sandwichInfo}</span>
          </div>
          {canEdit && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => startEditing('sandwichTypes', '')}
              className="opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <Edit2 className="w-3 h-3" />
            </Button>
          )}
        </div>
      );
    }

    // Editing sandwich types
    return (
      <div className="bg-amber-50 rounded-lg p-3 space-y-3">
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
                    {Object.entries(SANDWICH_TYPES).map(([key, label]) => (
                      <SelectItem key={key} value={key}>
                        {label}
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
    <Card className="transition-all duration-200 hover:shadow-lg border-l-4 border-l-green-500">
      <CardContent className="p-6">
        <CardHeader request={request} />

        {/* Event Details - Editable */}
        <div className="space-y-3 mb-4">
          <div className="grid grid-cols-2 gap-4">
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
          </div>

          <div className="grid grid-cols-2 gap-4">
            {renderEditableField(
              'pickupTime',
              request.pickupTime && formatTime12Hour(request.pickupTime),
              'Pickup Time',
              'time'
            )}
            {renderEditableField(
              'hasRefrigeration',
              request.hasRefrigeration === true ? 'Yes' : request.hasRefrigeration === false ? 'No' : 'Unknown',
              'Refrigeration Available',
              'select',
              [
                { value: 'true', label: 'Yes' },
                { value: 'false', label: 'No' },
                { value: 'unknown', label: 'Unknown' },
              ]
            )}
          </div>

          {renderEditableField(
            'eventAddress',
            request.eventAddress,
            'Event Location',
            'text'
          )}

          {/* Sandwich Editing */}
          {renderSandwichEdit()}

          {/* Staffing Needs - Editable */}
          <div className="grid grid-cols-3 gap-4">
            {renderEditableField(
              'driversNeeded',
              request.driversNeeded,
              'Drivers Needed',
              'number'
            )}
            {renderEditableField(
              'speakersNeeded',
              request.speakersNeeded,
              'Speakers Needed',
              'number'
            )}
            {renderEditableField(
              'volunteersNeeded',
              request.volunteersNeeded,
              'Volunteers Needed',
              'number'
            )}
          </div>
        </div>

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

        {/* Action Buttons */}
        <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t">
          <Button
            size="sm"
            variant="default"
            onClick={() => onStatusChange('completed')}
            className="bg-green-600 hover:bg-green-700 text-white"
          >
            <CheckCircle className="w-4 h-4 mr-1" />
            Mark Complete
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={onContact}
          >
            Contact Organizer
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => onStatusChange('new')}
          >
            Reschedule
          </Button>

          <div className="flex-1" />

          {canEdit && (
            <>
              <Button size="sm" variant="ghost" onClick={onEdit}>
                <Edit2 className="w-4 h-4" />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={onDelete}
                className="text-red-600 hover:text-red-700"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
};