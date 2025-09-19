import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Edit,
  Trash2,
  Phone,
  Mail,
  Calendar,
  Shield,
  CheckCircle,
  X,
  AlertTriangle,
  Clock,
  RotateCcw,
  Package,
  FileText,
  MapPin,
  Users,
  Truck,
  UserPlus,
  Save,
  Building,
  User,
  ArrowUp,
  Calculator,
  Megaphone,
  HelpCircle,
  UserCheck,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { hasPermission, PERMISSIONS } from '@shared/auth-utils';
import type { EventRequest } from '@shared/schema';
import {
  SANDWICH_TYPES,
  statusColors,
  SANDWICH_DESTINATIONS,
  statusIcons,
} from './constants';
import {
  formatTime12Hour,
  getSandwichTypesSummary,
  formatEventDate,
} from './utils';

interface RequestCardProps {
  request: EventRequest;
  isEditing: boolean;
  setIsEditing: (editing: boolean) => void;
  editingField: string | null;
  setEditingField: (field: string | null) => void;
  editingValue: string;
  setEditingValue: (value: string) => void;
  editingScheduledId: number | null;
  setEditingScheduledId: (id: number | null) => void;
  inlineSandwichMode: 'total' | 'types';
  setInlineSandwichMode: (mode: 'total' | 'types') => void;
  inlineTotalCount: number;
  setInlineTotalCount: (count: number) => void;
  inlineSandwichTypes: Array<{type: string, quantity: number}>;
  setInlineSandwichTypes: (types: Array<{type: string, quantity: number}>) => void;
  
  // Callback functions
  onEdit: (request: EventRequest) => void;
  onDelete: (id: number) => void;
  onSchedule: (request: EventRequest) => void;
  onCall: (request: EventRequest) => void;
  onToolkit: (request: EventRequest) => void;
  onScheduleCall: (request: EventRequest) => void;
  onFollowUp1Day: (request: EventRequest) => void;
  onFollowUp1Month: (request: EventRequest) => void;
  onReschedule: (id: number) => void;
  onContact: (request: EventRequest) => void;
  onStatusChange: (id: number, status: string) => void;
  
  // Editing functions
  startEditing: (id: number, field: string, currentValue: string) => void;
  saveEdit: () => void;
  cancelEdit: () => void;
  
  // Helper functions
  addInlineSandwichType: () => void;
  updateInlineSandwichType: (index: number, field: 'type' | 'quantity', value: string | number) => void;
  removeInlineSandwichType: (index: number) => void;
  
  // Assignment functions
  openAssignmentDialog: (eventId: number, type: 'driver' | 'speaker' | 'volunteer') => void;
  handleRemoveAssignment: (personId: string, type: 'driver' | 'speaker' | 'volunteer', eventId: number) => Promise<void>;
  handleSelfSignup: (eventId: number, type: 'driver' | 'speaker' | 'volunteer') => Promise<void>;
  canSelfSignup: (eventRequest: EventRequest, type: 'driver' | 'speaker' | 'volunteer') => boolean;
  isUserSignedUp: (eventRequest: EventRequest, type: 'driver' | 'speaker' | 'volunteer') => boolean;
  
  // Helper functions for user/recipient resolution
  resolveUserName: (userIdOrName: string | undefined) => string;
  resolveRecipientName: (recipientIdOrName: string | undefined) => string;
}

export default function RequestCard({
  request,
  isEditing,
  setIsEditing,
  editingField,
  setEditingField,
  editingValue,
  setEditingValue,
  editingScheduledId,
  setEditingScheduledId,
  inlineSandwichMode,
  setInlineSandwichMode,
  inlineTotalCount,
  setInlineTotalCount,
  inlineSandwichTypes,
  setInlineSandwichTypes,
  onEdit,
  onDelete,
  onSchedule,
  onCall,
  onToolkit,
  onScheduleCall,
  onFollowUp1Day,
  onFollowUp1Month,
  onReschedule,
  onContact,
  onStatusChange,
  startEditing,
  saveEdit,
  cancelEdit,
  addInlineSandwichType,
  updateInlineSandwichType,
  removeInlineSandwichType,
  openAssignmentDialog,
  handleRemoveAssignment,
  handleSelfSignup,
  canSelfSignup,
  isUserSignedUp,
  resolveUserName,
  resolveRecipientName,
}: RequestCardProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  
  const StatusIcon = statusIcons[request.status];
  const dateInfo = formatEventDate(request.desiredEventDate || '');

  return (
    <Card
      key={request.id}
      className={`transition-all duration-200 hover:shadow-lg ${statusColors[request.status]}`}
      data-testid={`card-event-request-${request.id}`}
    >
      <CardContent className="p-0">
        {request.status === 'scheduled' && (
          <div className="h-1 bg-[#236383] rounded-t-md"></div>
        )}
        <div className="p-6">
          <div className="flex items-start justify-between">
            <div className="flex-1 space-y-4">
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <div className="flex items-center space-x-3">
                    <StatusIcon className="w-7 h-7 text-brand-primary flex-shrink-0" />
                    <h2 className="text-2xl font-bold text-brand-primary leading-tight">
                      {request.organizationName}
                    </h2>
                  </div>
                </div>
              </div>

              {/* Contact Information */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-3">
                  <div className="flex items-center space-x-3">
                    <User className="w-5 h-5 text-[#007E8C] flex-shrink-0" />
                    <div>
                      <p className="text-base font-semibold text-[#1A2332]">
                        {request.firstName} {request.lastName}
                      </p>
                      <p className="text-sm text-[#007E8C]">Event Contact</p>
                    </div>
                  </div>

                  <div className="flex items-center space-x-3">
                    <Mail className="w-5 h-5 text-[#007E8C] flex-shrink-0" />
                    <a href={`mailto:${request.email}`} className="text-base text-[#007E8C] hover:underline">
                      {request.email}
                    </a>
                  </div>

                  {request.phone && (
                    <div className="flex items-center space-x-3">
                      <Phone className="w-5 h-5 text-[#007E8C] flex-shrink-0" />
                      <div className="flex items-center space-x-2">
                        <span className="text-base text-[#1A2332]">{request.phone}</span>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={(e) => {
                            e.stopPropagation();
                            const phoneNumber = request.phone;
                            const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
                            
                            if (isMobile) {
                              window.location.href = `tel:${phoneNumber}`;
                            } else {
                              navigator.clipboard.writeText(phoneNumber || '').then(() => {
                                toast({
                                  title: 'Phone number copied!',
                                  description: `${phoneNumber} has been copied to your clipboard.`,
                                });
                              }).catch(() => {
                                toast({
                                  title: 'Failed to copy',
                                  description: 'Please copy manually: ' + phoneNumber,
                                  variant: 'destructive',
                                });
                              });
                            }
                          }}
                          className="h-6 px-2 text-xs"
                          data-testid={`button-phone-${request.id}`}
                        >
                          {/iPhone|iPad|iPod|Android/i.test(navigator.userAgent) ? 'Call' : 'Copy'}
                        </Button>
                      </div>
                    </div>
                  )}
                </div>

                <div className="space-y-3">
                  <div className="flex items-center space-x-3">
                    <Calendar className="w-5 h-5 text-[#007E8C] flex-shrink-0" />
                    <div>
                      <p className={`text-base font-semibold ${dateInfo.className}`}>
                        {dateInfo.text}
                      </p>
                      <p className="text-sm text-[#007E8C]">Requested Event Date</p>
                      {dateInfo.isWedOrThu && (
                        <p className="text-xs text-[#FBAD3F] font-medium">
                          ⭐ {dateInfo.dayName} - Great day for events!
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center space-x-3">
                    <Building className="w-5 h-5 text-[#007E8C] flex-shrink-0" />
                    <div>
                      <p className="text-base font-semibold text-[#1A2332]">
                        {request.department || 'Not specified'}
                      </p>
                      {/* DEBUG: Show what's actually in these fields */}
                      <div className="text-xs text-red-500 mt-1 border border-red-200 p-1 rounded">
                        DEBUG - Dept: "{request.department}" | Msg: "{request.message?.substring(0, 50)}..."
                      </div>
                      <p className="text-sm text-[#007E8C]">Department</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Toolkit Status - Only for In Process */}
              {request.status === 'in_process' && (
                <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                  <h4 className="text-sm font-semibold text-green-800 mb-3 flex items-center">
                    <Shield className="w-4 h-4 mr-2 text-green-600" />
                    Toolkit Status
                  </h4>
                  <div className="flex items-center space-x-4">
                    {request.toolkitSent ? (
                      <div className="flex items-center space-x-2">
                        <CheckCircle className="w-5 h-5 text-green-600" />
                        <span className="text-green-800 font-medium">
                          Toolkit Sent
                        </span>
                        {request.toolkitSentDate && (
                          <span className="text-sm text-green-600">
                            on{' '}
                            {new Date(request.toolkitSentDate).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                    ) : (
                      <div className="flex items-center space-x-2">
                        <AlertTriangle className="w-5 h-5 text-orange-600" />
                        <span className="text-orange-800 font-medium">
                          Toolkit Not Sent
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Comprehensive Event Details for Scheduled Events - Compact Grid */}
              {request.status === 'scheduled' && (
                <div className="mt-3 bg-white border rounded-lg p-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                    
                    {/* Column 1: Schedule & Location */}
                    <div className="space-y-2 bg-[#e6f2f5] p-3 rounded-lg border border-[#007E8C]/20">
                      <h4 className="text-base font-semibold tracking-tight flex items-center border-b pb-2">
                        <Calendar className="w-4 h-4 mr-2" />
                        Schedule & Location
                      </h4>
                      
                      {/* Times in compact rows */}
                      <div className="space-y-1">
                        {/* Start and End times with proper layout */}
                        <div className="space-y-2">
                          {/* Start time */}
                          <div className="grid grid-cols-[auto,1fr] items-center gap-3">
                            <span className="text-base font-medium text-[#236383] min-w-16">Start:</span>
                            {editingScheduledId === request.id && editingField === 'eventStartTime' ? (
                              <div className="flex items-center gap-2">
                                <Input
                                  type="time"
                                  value={editingValue}
                                  onChange={(e) => setEditingValue(e.target.value)}
                                  className="w-28"
                                />
                                <Button size="icon" onClick={(e) => { e.stopPropagation(); saveEdit(); }} className="h-7 w-7">
                                  <CheckCircle className="w-4 h-4" />
                                </Button>
                                <Button variant="outline" size="icon" onClick={(e) => { e.stopPropagation(); cancelEdit(); }} className="h-7 w-7">
                                  <X className="w-4 h-4" />
                                </Button>
                              </div>
                            ) : (
                              <div className="flex items-center gap-1">
                                <span className="text-base font-medium">
                                  {request.eventStartTime ? formatTime12Hour(request.eventStartTime) : 'Not set'}
                                </span>
                                {hasPermission(user, PERMISSIONS.EVENT_REQUESTS_EDIT) && (
                                  <Button variant="ghost" size="icon" onClick={(e) => {
                                    e.stopPropagation();
                                    startEditing(request.id, 'eventStartTime', request.eventStartTime || '');
                                  }} className="h-6 w-6 ml-1">
                                    <Edit className="w-4 h-4" />
                                  </Button>
                                )}
                              </div>
                            )}
                          </div>

                          {/* End time */}
                          <div className="grid grid-cols-[auto,1fr] items-center gap-3">
                            <span className="text-base font-medium text-[#236383] min-w-16">End:</span>
                            {editingScheduledId === request.id && editingField === 'eventEndTime' ? (
                              <div className="flex items-center gap-2">
                                <Input
                                  type="time"
                                  value={editingValue}
                                  onChange={(e) => setEditingValue(e.target.value)}
                                  className="w-28"
                                />
                                <Button size="icon" onClick={(e) => { e.stopPropagation(); saveEdit(); }} className="h-7 w-7">
                                  <CheckCircle className="w-4 h-4" />
                                </Button>
                                <Button variant="outline" size="icon" onClick={(e) => { e.stopPropagation(); cancelEdit(); }} className="h-7 w-7">
                                  <X className="w-4 h-4" />
                                </Button>
                              </div>
                            ) : (
                              <div className="flex items-center gap-1">
                                <span className="text-base font-medium">
                                  {request.eventEndTime ? formatTime12Hour(request.eventEndTime) : 'Not set'}
                                </span>
                                {hasPermission(user, PERMISSIONS.EVENT_REQUESTS_EDIT) && (
                                  <Button variant="ghost" size="icon" onClick={(e) => {
                                    e.stopPropagation();
                                    startEditing(request.id, 'eventEndTime', request.eventEndTime || '');
                                  }} className="h-6 w-6 ml-1">
                                    <Edit className="w-4 h-4" />
                                  </Button>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                        
                        {/* Pickup time with proper alignment */}
                        <div className="grid grid-cols-[auto,1fr] items-center gap-3">
                          <span className="text-base font-medium text-[#236383] min-w-16">Pickup:</span>
                          {editingScheduledId === request.id && editingField === 'pickupTime' ? (
                            <div className="flex items-center gap-2">
                              <Input
                                type="time"
                                value={editingValue}
                                onChange={(e) => setEditingValue(e.target.value)}
                                className="w-28"
                              />
                              <Button size="icon" onClick={(e) => { e.stopPropagation(); saveEdit(); }} className="h-7 w-7">
                                <CheckCircle className="w-4 h-4" />
                              </Button>
                              <Button variant="outline" size="icon" onClick={(e) => { e.stopPropagation(); cancelEdit(); }} className="h-7 w-7">
                                <X className="w-4 h-4" />
                              </Button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1">
                              <span className="text-base font-medium">
                                {request.pickupTime ? formatTime12Hour(request.pickupTime) : 'Not set'}
                              </span>
                              {hasPermission(user, PERMISSIONS.EVENT_REQUESTS_EDIT) && (
                                <Button variant="ghost" size="icon" onClick={(e) => {
                                  e.stopPropagation();
                                  startEditing(request.id, 'pickupTime', request.pickupTime || '');
                                }} className="h-6 w-6 ml-1">
                                  <Edit className="w-4 h-4" />
                                </Button>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                      
                      {/* Address */}
                      <div className="pt-2 border-t">
                        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start space-y-1 sm:space-y-0">
                          <span className="text-base font-medium text-[#236383] flex-shrink-0">Address:</span>
                          <div className="flex items-start space-x-1 sm:flex-1 sm:justify-end">
                            {editingScheduledId === request.id && editingField === 'eventAddress' ? (
                              <div className="flex items-center space-x-2 w-full">
                                <Input
                                  value={editingValue}
                                  onChange={(e) => setEditingValue(e.target.value)}
                                  className="text-sm"
                                  placeholder="Enter address"
                                />
                                <Button size="sm" onClick={(e) => { e.stopPropagation(); saveEdit(); }}>
                                  <CheckCircle className="w-4 h-4" />
                                </Button>
                                <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); cancelEdit(); }}>
                                  <X className="w-4 h-4" />
                                </Button>
                              </div>
                            ) : (
                              <>
                                <span className="font-semibold text-base sm:text-right sm:max-w-[200px] break-words">
                                  {request.eventAddress ? (
                                    <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(request.eventAddress)}`}
                                       target="_blank" rel="noopener noreferrer"
                                       className="text-[#007E8C] hover:text-[#236383] underline">
                                      {request.eventAddress}
                                    </a>
                                  ) : <span className="text-[#007E8C]">Not specified</span>}
                                </span>
                                {hasPermission(user, PERMISSIONS.EVENT_REQUESTS_EDIT) && (
                                  <Button size="sm" variant="ghost" onClick={(e) => {
                                    e.stopPropagation();
                                    startEditing(request.id, 'eventAddress', request.eventAddress || '');
                                  }} className="h-5 w-5 p-0 flex-shrink-0">
                                    <Edit className="w-3 h-3" />
                                  </Button>
                                )}
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    {/* Column 2: Sandwich & Logistics */}
                    <div className="space-y-2 bg-[#e6f2f5] p-3 rounded-lg border border-[#007E8C]/20">
                      <h4 className="text-base font-semibold tracking-tight flex items-center border-b pb-2">
                        <Package className="w-4 h-4 mr-2" />
                        Sandwich Details
                      </h4>
                      
                      <div className="space-y-2">
                        {/* Total Sandwiches Count */}
                        <div className="flex justify-between items-center">
                          <span className="text-base font-medium text-[#236383]">Total:</span>
                          {editingScheduledId === request.id && editingField === 'estimatedSandwichCount' ? (
                            <div className="flex items-center space-x-2">
                              <Input
                                type="number"
                                value={editingValue}
                                onChange={(e) => setEditingValue(e.target.value)}
                                className="w-24 h-7 text-sm"
                                min="0"
                              />
                              <Button size="sm" onClick={(e) => { e.stopPropagation(); saveEdit(); }}>
                                <CheckCircle className="w-4 h-4" />
                              </Button>
                              <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); cancelEdit(); }}>
                                <X className="w-4 h-4" />
                              </Button>
                            </div>
                          ) : (
                            <div className="flex items-center space-x-1">
                              <span className="font-semibold text-base">
                                {request.estimatedSandwichCount || 0} sandwiches
                              </span>
                              {hasPermission(user, PERMISSIONS.EVENT_REQUESTS_EDIT) && (
                                <Button size="sm" variant="ghost" onClick={(e) => {
                                  e.stopPropagation();
                                  startEditing(request.id, 'estimatedSandwichCount', request.estimatedSandwichCount?.toString() || '0');
                                }} className="h-4 w-4 p-0">
                                  <Edit className="w-3 h-3" />
                                </Button>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Sandwich Types */}
                        <div className="flex flex-col space-y-2">
                          <div className="flex justify-between items-center">
                            <span className="text-[#FBAD3F] text-base font-semibold">Types:</span>
                            {hasPermission(user, PERMISSIONS.EVENT_REQUESTS_EDIT) && (
                              <Button size="sm" variant="ghost" onClick={(e) => {
                                e.stopPropagation();
                                startEditing(request.id, 'sandwichTypes', JSON.stringify(request.sandwichTypes) || '');
                              }} className="h-4 w-4 p-0">
                                <Edit className="w-3 h-3" />
                              </Button>
                            )}
                          </div>
                          
                          {editingScheduledId === request.id && editingField === 'sandwichTypes' ? (
                            <div className="space-y-3 bg-white p-3 rounded border">
                              <div className="text-sm font-medium text-gray-700 mb-2">Edit Sandwich Types:</div>
                              {SANDWICH_TYPES.slice(0, 4).map((type) => { // Exclude 'unknown' from editing
                                const currentQuantity = inlineSandwichTypes.find(t => t.type === type.value)?.quantity || 0;
                                return (
                                  <div key={type.value} className="flex items-center justify-between">
                                    <span className="text-sm font-medium min-w-0 flex-1">{type.label}:</span>
                                    <div className="flex items-center space-x-2">
                                      <Input
                                        type="number"
                                        value={currentQuantity}
                                        onChange={(e) => {
                                          const quantity = parseInt(e.target.value) || 0;
                                          updateInlineSandwichType(
                                            inlineSandwichTypes.findIndex(t => t.type === type.value),
                                            'quantity',
                                            quantity
                                          );
                                          // If quantity is 0, remove the type; if > 0, add/update it
                                          const existingIndex = inlineSandwichTypes.findIndex(t => t.type === type.value);
                                          if (quantity === 0 && existingIndex >= 0) {
                                            removeInlineSandwichType(existingIndex);
                                          } else if (quantity > 0 && existingIndex < 0) {
                                            setInlineSandwichTypes([...inlineSandwichTypes, { type: type.value, quantity }]);
                                          }
                                        }}
                                        className="w-16 h-7 text-sm"
                                        min="0"
                                        placeholder="0"
                                      />
                                    </div>
                                  </div>
                                );
                              })}
                              <div className="flex items-center space-x-2 pt-2 border-t">
                                <Button size="sm" onClick={(e) => { e.stopPropagation(); saveEdit(); }} className="h-8 px-3">
                                  <CheckCircle className="w-4 h-4 mr-1" />
                                  Save
                                </Button>
                                <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); cancelEdit(); }} className="h-8 px-3">
                                  <X className="w-4 h-4 mr-1" />
                                  Cancel
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <div className="text-right">
                              <span className="font-bold text-[#1A2332] text-base">
                                {request.sandwichTypes ? getSandwichTypesSummary(request).breakdown : 'Not specified'}
                              </span>
                            </div>
                          )}
                        </div>
                        
                        <div className="flex justify-between items-center">
                          <span className="text-[#47B3CB] text-base font-semibold">Refrigeration:</span>
                          {editingScheduledId === request.id && editingField === 'hasRefrigeration' ? (
                            <div className="flex items-center space-x-2">
                              <Select value={editingValue} onValueChange={setEditingValue}>
                                <SelectTrigger className="w-32">
                                  <SelectValue placeholder="Select..." />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="true">Yes</SelectItem>
                                  <SelectItem value="false">No</SelectItem>
                                  <SelectItem value="unknown">Unknown</SelectItem>
                                </SelectContent>
                              </Select>
                              <Button size="sm" onClick={(e) => { e.stopPropagation(); saveEdit(); }}>
                                <CheckCircle className="w-4 h-4" />
                              </Button>
                              <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); cancelEdit(); }}>
                                <X className="w-4 h-4" />
                              </Button>
                            </div>
                          ) : (
                            <div className="flex items-center space-x-1">
                              <span className="font-bold text-base">
                                {request.hasRefrigeration === true ? 'Yes' : 
                                 request.hasRefrigeration === false ? 'No' : 'Unknown'}
                              </span>
                              {hasPermission(user, PERMISSIONS.EVENT_REQUESTS_EDIT) && (
                                <Button size="sm" variant="ghost" onClick={(e) => {
                                  e.stopPropagation();
                                  const currentValue = request.hasRefrigeration === true ? 'true' : 
                                                      request.hasRefrigeration === false ? 'false' : 'unknown';
                                  startEditing(request.id, 'hasRefrigeration', currentValue);
                                }} className="h-4 w-4 p-0">
                                  <Edit className="w-3 h-3" />
                                </Button>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    {/* Column 3: Staffing & Assignments */}
                    <div className="space-y-2 bg-[#e6f2f5] p-3 rounded-lg border border-[#007E8C]/20">
                      <h4 className="text-base font-semibold tracking-tight flex items-center border-b pb-2">
                        <Users className="w-4 h-4 mr-2" />
                        Staffing
                      </h4>
                      
                      <div className="space-y-3">
                        {/* Drivers Section */}
                        <div className="space-y-2">
                          <div className="flex justify-between items-center">
                            <span className="text-base font-medium text-[#236383] flex items-center">
                              <Truck className="w-4 h-4 mr-1" />
                              Drivers:
                            </span>
                            {editingScheduledId === request.id && editingField === 'driversNeeded' ? (
                              <div className="flex items-center space-x-2">
                                <Input
                                  type="number"
                                  value={editingValue}
                                  onChange={(e) => setEditingValue(e.target.value)}
                                  className="w-16 h-7 text-sm"
                                  min="0"
                                />
                                <Button size="sm" onClick={(e) => { e.stopPropagation(); saveEdit(); }}>
                                  <CheckCircle className="w-4 h-4" />
                                </Button>
                                <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); cancelEdit(); }}>
                                  <X className="w-4 h-4" />
                                </Button>
                              </div>
                            ) : (
                              <div className="flex items-center space-x-1">
                                <span className="font-semibold text-base">
                                  {request.driversNeeded || 0} needed
                                </span>
                                {hasPermission(user, PERMISSIONS.EVENT_REQUESTS_EDIT) && (
                                  <Button size="sm" variant="ghost" onClick={(e) => {
                                    e.stopPropagation();
                                    startEditing(request.id, 'driversNeeded', request.driversNeeded?.toString() || '0');
                                  }} className="h-4 w-4 p-0">
                                    <Edit className="w-3 h-3" />
                                  </Button>
                                )}
                              </div>
                            )}
                          </div>
                          
                          {/* Driver Assignments */}
                          {request.assignedDriverIds && request.assignedDriverIds.length > 0 && (
                            <div className="space-y-1">
                              {request.assignedDriverIds.map((driverId) => {
                                const driverDetails = request.driverDetails?.[driverId];
                                const driverName = driverDetails?.name || resolveUserName(driverId);
                                return (
                                  <div key={driverId} className="flex items-center justify-between bg-white p-2 rounded border">
                                    <span className="text-sm font-medium">{driverName}</span>
                                    {hasPermission(user, PERMISSIONS.EVENT_REQUESTS_EDIT) && (
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleRemoveAssignment(driverId, 'driver', request.id);
                                        }}
                                        className="h-6 w-6 p-0 text-red-600 hover:text-red-700"
                                      >
                                        <X className="w-3 h-3" />
                                      </Button>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          )}
                          
                          {/* Driver Assignment Actions */}
                          {hasPermission(user, PERMISSIONS.EVENT_REQUESTS_EDIT) && (
                            <div className="flex gap-1">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openAssignmentDialog(request.id, 'driver');
                                }}
                                className="h-7 text-xs"
                              >
                                <UserPlus className="w-3 h-3 mr-1" />
                                Assign
                              </Button>
                              {canSelfSignup(request, 'driver') && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleSelfSignup(request.id, 'driver');
                                  }}
                                  className="h-7 text-xs"
                                >
                                  <UserCheck className="w-3 h-3 mr-1" />
                                  {isUserSignedUp(request, 'driver') ? 'Remove Me' : 'Sign Me Up'}
                                </Button>
                              )}
                            </div>
                          )}
                        </div>
                        
                        {/* Speakers Section */}
                        <div className="space-y-2">
                          <div className="flex justify-between items-center">
                            <span className="text-base font-medium text-[#236383] flex items-center">
                              <Megaphone className="w-4 h-4 mr-1" />
                              Speakers:
                            </span>
                            {editingScheduledId === request.id && editingField === 'speakersNeeded' ? (
                              <div className="flex items-center space-x-2">
                                <Input
                                  type="number"
                                  value={editingValue}
                                  onChange={(e) => setEditingValue(e.target.value)}
                                  className="w-16 h-7 text-sm"
                                  min="0"
                                />
                                <Button size="sm" onClick={(e) => { e.stopPropagation(); saveEdit(); }}>
                                  <CheckCircle className="w-4 h-4" />
                                </Button>
                                <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); cancelEdit(); }}>
                                  <X className="w-4 h-4" />
                                </Button>
                              </div>
                            ) : (
                              <div className="flex items-center space-x-1">
                                <span className="font-semibold text-base">
                                  {request.speakersNeeded || 0} needed
                                </span>
                                {hasPermission(user, PERMISSIONS.EVENT_REQUESTS_EDIT) && (
                                  <Button size="sm" variant="ghost" onClick={(e) => {
                                    e.stopPropagation();
                                    startEditing(request.id, 'speakersNeeded', request.speakersNeeded?.toString() || '0');
                                  }} className="h-4 w-4 p-0">
                                    <Edit className="w-3 h-3" />
                                  </Button>
                                )}
                              </div>
                            )}
                          </div>
                          
                          {/* Speaker Assignments */}
                          {request.assignedSpeakerIds && request.assignedSpeakerIds.length > 0 && (
                            <div className="space-y-1">
                              {request.assignedSpeakerIds.map((speakerId) => {
                                const speakerDetails = request.speakerDetails?.[speakerId];
                                const speakerName = speakerDetails?.name || resolveUserName(speakerId);
                                return (
                                  <div key={speakerId} className="flex items-center justify-between bg-white p-2 rounded border">
                                    <span className="text-sm font-medium">{speakerName}</span>
                                    {hasPermission(user, PERMISSIONS.EVENT_REQUESTS_EDIT) && (
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleRemoveAssignment(speakerId, 'speaker', request.id);
                                        }}
                                        className="h-6 w-6 p-0 text-red-600 hover:text-red-700"
                                      >
                                        <X className="w-3 h-3" />
                                      </Button>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          )}
                          
                          {/* Speaker Assignment Actions */}
                          {hasPermission(user, PERMISSIONS.EVENT_REQUESTS_EDIT) && (
                            <div className="flex gap-1">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openAssignmentDialog(request.id, 'speaker');
                                }}
                                className="h-7 text-xs"
                              >
                                <UserPlus className="w-3 h-3 mr-1" />
                                Assign
                              </Button>
                              {canSelfSignup(request, 'speaker') && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleSelfSignup(request.id, 'speaker');
                                  }}
                                  className="h-7 text-xs"
                                >
                                  <UserCheck className="w-3 h-3 mr-1" />
                                  {isUserSignedUp(request, 'speaker') ? 'Remove Me' : 'Sign Me Up'}
                                </Button>
                              )}
                            </div>
                          )}
                        </div>
                        
                        {/* Volunteers Section */}
                        <div className="space-y-2">
                          <div className="flex justify-between items-center">
                            <span className="text-base font-medium text-[#236383] flex items-center">
                              <Users className="w-4 h-4 mr-1" />
                              Volunteers:
                            </span>
                            {editingScheduledId === request.id && editingField === 'volunteersNeeded' ? (
                              <div className="flex items-center space-x-2">
                                <Input
                                  type="number"
                                  value={editingValue}
                                  onChange={(e) => setEditingValue(e.target.value)}
                                  className="w-16 h-7 text-sm"
                                  min="0"
                                />
                                <Button size="sm" onClick={(e) => { e.stopPropagation(); saveEdit(); }}>
                                  <CheckCircle className="w-4 h-4" />
                                </Button>
                                <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); cancelEdit(); }}>
                                  <X className="w-4 h-4" />
                                </Button>
                              </div>
                            ) : (
                              <div className="flex items-center space-x-1">
                                <span className="font-semibold text-base">
                                  {request.volunteersNeeded || 0} needed
                                </span>
                                {hasPermission(user, PERMISSIONS.EVENT_REQUESTS_EDIT) && (
                                  <Button size="sm" variant="ghost" onClick={(e) => {
                                    e.stopPropagation();
                                    startEditing(request.id, 'volunteersNeeded', request.volunteersNeeded?.toString() || '0');
                                  }} className="h-4 w-4 p-0">
                                    <Edit className="w-3 h-3" />
                                  </Button>
                                )}
                              </div>
                            )}
                          </div>
                          
                          {/* Volunteer Assignments */}
                          {request.assignedVolunteerIds && request.assignedVolunteerIds.length > 0 && (
                            <div className="space-y-1">
                              {request.assignedVolunteerIds.map((volunteerId) => {
                                const volunteerDetails = request.volunteerDetails?.[volunteerId];
                                const volunteerName = volunteerDetails?.name || resolveUserName(volunteerId);
                                return (
                                  <div key={volunteerId} className="flex items-center justify-between bg-white p-2 rounded border">
                                    <span className="text-sm font-medium">{volunteerName}</span>
                                    {hasPermission(user, PERMISSIONS.EVENT_REQUESTS_EDIT) && (
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleRemoveAssignment(volunteerId, 'volunteer', request.id);
                                        }}
                                        className="h-6 w-6 p-0 text-red-600 hover:text-red-700"
                                      >
                                        <X className="w-3 h-3" />
                                      </Button>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          )}
                          
                          {/* Volunteer Assignment Actions */}
                          {hasPermission(user, PERMISSIONS.EVENT_REQUESTS_EDIT) && (
                            <div className="flex gap-1">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openAssignmentDialog(request.id, 'volunteer');
                                }}
                                className="h-7 text-xs"
                              >
                                <UserPlus className="w-3 h-3 mr-1" />
                                Assign
                              </Button>
                              {canSelfSignup(request, 'volunteer') && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleSelfSignup(request.id, 'volunteer');
                                  }}
                                  className="h-7 text-xs"
                                >
                                  <UserCheck className="w-3 h-3 mr-1" />
                                  {isUserSignedUp(request, 'volunteer') ? 'Remove Me' : 'Sign Me Up'}
                                </Button>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {request.message && (
                <div className="mt-4 p-3 bg-[#e6f2f5] border-l-4 border-brand-primary rounded-r-lg">
                  <p className="text-base text-brand-primary line-clamp-2 font-medium">
                    {request.message}
                  </p>
                </div>
              )}

              {/* Action Buttons for New Status */}
              {request.status === 'new' && hasPermission(user, PERMISSIONS.EVENT_REQUESTS_EDIT) && (
                <div className="mt-4 flex flex-wrap gap-2 pt-4 border-t border-[#007E8C]/20">
                  <Button
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      onToolkit(request);
                    }}
                    className="text-white"
                    style={{ backgroundColor: '#007E8C' }}
                    data-testid={`button-send-toolkit-${request.id}`}
                  >
                    <Shield className="w-4 h-4 mr-2" />
                    Send Toolkit
                  </Button>
                  
                  {request.phone && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={(e) => {
                        e.stopPropagation();
                        onCall(request);
                      }}
                      data-testid={`button-call-${request.id}`}
                      title={request.phone}
                    >
                      <Phone className="w-4 h-4 mr-2" />
                      Call Contact
                    </Button>
                  )}
                  
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-[#236383] text-[#236383] hover:bg-[#236383] hover:text-white"
                    onClick={(e) => {
                      e.stopPropagation();
                      onEdit(request);
                    }}
                    data-testid={`button-edit-${request.id}`}
                  >
                    <Edit className="w-4 h-4 mr-2" />
                    Edit
                  </Button>
                </div>
              )}

              {/* Action Buttons for In Process Status */}
              {request.status === 'in_process' && hasPermission(user, PERMISSIONS.EVENT_REQUESTS_EDIT) && (
                <div className="mt-4 flex flex-wrap gap-2 pt-4 border-t border-[#007E8C]/20">
                  <Button
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      onSchedule(request);
                    }}
                    className="text-white"
                    style={{ backgroundColor: '#47B3CB' }}
                    data-testid={`button-mark-scheduled-${request.id}`}
                  >
                    <Calendar className="w-4 h-4 mr-2" />
                    Mark Scheduled
                  </Button>
                  
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={(e) => {
                      e.stopPropagation();
                      onScheduleCall(request);
                    }}
                    data-testid={`button-schedule-call-${request.id}`}
                  >
                    <Phone className="w-4 h-4 mr-2" />
                    Schedule Call
                  </Button>
                  
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-[#236383] text-[#236383] hover:bg-[#236383] hover:text-white"
                    onClick={(e) => {
                      e.stopPropagation();
                      onEdit(request);
                    }}
                    data-testid={`button-edit-${request.id}`}
                  >
                    <Edit className="w-4 h-4 mr-2" />
                    Edit
                  </Button>
                </div>
              )}

              {/* Action Buttons for Scheduled Status */}
              {request.status === 'scheduled' && hasPermission(user, PERMISSIONS.EVENT_REQUESTS_EDIT) && (
                <div className="mt-4 flex flex-wrap gap-2 pt-4 border-t border-[#007E8C]/20">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={(e) => {
                      e.stopPropagation();
                      onEdit(request);
                    }}
                    data-testid={`button-edit-${request.id}`}
                  >
                    <Edit className="w-4 h-4 mr-2" />
                    Edit Event Details
                  </Button>
                  
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={(e) => {
                      e.stopPropagation();
                      onContact(request);
                    }}
                    className="text-white"
                    style={{ backgroundColor: '#236383' }}
                    data-testid={`button-contact-${request.id}`}
                  >
                    <Phone className="w-4 h-4 mr-2" />
                    Contact Organizer
                  </Button>
                </div>
              )}

              {/* Driver Information for Completed Events */}
              {request.status === 'completed' && request.assignedDriverIds && request.assignedDriverIds.length > 0 && (
                <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg">
                  <h4 className="text-sm font-semibold text-green-800 mb-2 flex items-center">
                    <span className="mr-2">🚗</span>
                    Drivers Who Served
                  </h4>
                  <div className="space-y-1">
                    {request.assignedDriverIds.map((driverId, index) => {
                      const driverDetails = request.driverDetails?.[driverId];
                      const driverName = driverDetails?.name || `Driver ${index + 1}`;
                      return (
                        <div key={driverId} className="flex items-center space-x-2">
                          <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                          <span className="text-sm font-medium text-green-800">{driverName}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Action Buttons for Completed Status */}
              {request.status === 'completed' && hasPermission(user, PERMISSIONS.EVENT_REQUESTS_EDIT) && (
                <div className="mt-4 flex flex-wrap gap-2 pt-4 border-t border-[#007E8C]/20">
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-[#236383] text-[#236383] hover:bg-[#236383] hover:text-white"
                    onClick={(e) => {
                      e.stopPropagation();
                      onEdit(request);
                    }}
                    data-testid={`button-edit-${request.id}`}
                  >
                    <Edit className="w-4 h-4 mr-2" />
                    Edit
                  </Button>
                  
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={(e) => {
                      e.stopPropagation();
                      onFollowUp1Day(request);
                    }}
                    className="text-white"
                    style={{ backgroundColor: '#FBAD3F' }}
                    data-testid={`button-followup-1day-${request.id}`}
                  >
                    <Clock className="w-4 h-4 mr-2" />
                    1 Day Follow-up
                  </Button>
                  
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={(e) => {
                      e.stopPropagation();
                      onFollowUp1Month(request);
                    }}
                    className="text-white"
                    style={{ backgroundColor: '#1A2332' }}
                    data-testid={`button-followup-1month-${request.id}`}
                  >
                    <Calendar className="w-4 h-4 mr-2" />
                    1 Month Follow-up
                  </Button>
                  
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-[#A31C41] text-[#A31C41] hover:bg-[#A31C41] hover:text-white"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (confirm('Are you sure you want to delete this event request? This action cannot be undone.')) {
                        onDelete(request.id);
                      }
                    }}
                    data-testid={`button-delete-${request.id}`}
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Delete
                  </Button>
                </div>
              )}

              {/* Action Buttons for Declined Status */}
              {request.status === 'declined' && hasPermission(user, PERMISSIONS.EVENT_REQUESTS_EDIT) && (
                <div className="mt-4 flex flex-wrap gap-2 pt-4 border-t border-[#007E8C]/20">
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-[#236383] text-[#236383] hover:bg-[#236383] hover:text-white"
                    onClick={(e) => {
                      e.stopPropagation();
                      onEdit(request);
                    }}
                    data-testid={`button-edit-${request.id}`}
                  >
                    <Edit className="w-4 h-4 mr-2" />
                    Edit
                  </Button>
                  
                  <Button
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      onReschedule(request.id);
                    }}
                    className="text-white"
                    style={{ backgroundColor: '#47B3CB' }}
                    data-testid={`button-reschedule-${request.id}`}
                  >
                    <RotateCcw className="w-4 h-4 mr-2" />
                    Reschedule
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}