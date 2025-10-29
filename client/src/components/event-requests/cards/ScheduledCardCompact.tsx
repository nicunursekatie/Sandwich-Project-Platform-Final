import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Clock,
  Package,
  MapPin,
  Users,
  Calendar,
  Building,
  Car,
  Megaphone,
  UserPlus,
  Edit2,
  Trash2,
  Mail,
  Phone,
  Check,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  History,
} from 'lucide-react';
import { formatTime12Hour, formatEventDate } from '@/components/event-requests/utils';
import { formatSandwichTypesDisplay } from '@/lib/sandwich-utils';
import type { EventRequest } from '@shared/schema';
import { ConfirmationDialog } from '@/components/ui/confirmation-dialog';
import { EventRequestAuditLog } from '@/components/event-request-audit-log';
import { getMissingIntakeInfo } from '@/lib/event-request-validation';

interface ScheduledCardCompactProps {
  request: EventRequest;
  onEdit: () => void;
  onDelete: () => void;
  onContact: () => void;
  onAssignTspContact: () => void;
  resolveUserName: (id: string) => string;
  canEdit?: boolean;
}

const parsePostgresArray = (arr: any): string[] => {
  if (!arr) return [];
  if (Array.isArray(arr)) return arr;
  if (typeof arr === 'string') {
    if (arr === '{}' || arr === '') return [];
    let cleaned = arr.replace(/^{|}$/g, '');
    if (!cleaned) return [];
    return cleaned.split(',').map((item) => item.trim()).filter((item) => item);
  }
  return [];
};

export const ScheduledCardCompact: React.FC<ScheduledCardCompactProps> = ({
  request,
  onEdit,
  onDelete,
  onContact,
  onAssignTspContact,
  resolveUserName,
  canEdit = true,
}) => {
  const [showDetails, setShowDetails] = useState(false);
  const [showAuditLog, setShowAuditLog] = useState(false);

  // Get display date
  const displayDate = request.scheduledEventDate || request.desiredEventDate;
  const dateInfo = displayDate ? formatEventDate(displayDate.toString()) : null;

  // Calculate staffing
  const driverAssigned = parsePostgresArray(request.assignedDriverIds).length + (request.assignedVanDriverId ? 1 : 0);
  const speakerAssigned = Object.keys(request.speakerDetails || {}).length;
  const volunteerAssigned = parsePostgresArray(request.assignedVolunteerIds).length;

  const driverNeeded = request.driversNeeded || 0;
  const speakerNeeded = request.speakersNeeded || 0;
  const volunteerNeeded = request.volunteersNeeded || 0;

  const totalAssigned = driverAssigned + speakerAssigned + volunteerAssigned;
  const totalNeeded = driverNeeded + speakerNeeded + volunteerNeeded;
  const staffingComplete = totalAssigned >= totalNeeded && totalNeeded > 0;

  // Get sandwich info
  const sandwichInfo = formatSandwichTypesDisplay(
    request.sandwichTypes,
    request.estimatedSandwichCount ?? undefined
  );

  const missingInfo = getMissingIntakeInfo(request);

  return (
    <Card className="w-full bg-white border-l-4 border-l-[#007E8C] shadow-sm hover:shadow-md transition-all">
      <CardContent className="p-4">
        {/* Compact Header Row */}
        <div className="flex items-start justify-between gap-4 mb-3">
          <div className="flex-1 min-w-0">
            {/* Title Row with Status */}
            <div className="flex items-center gap-3 mb-2">
              <h3 className="text-lg font-bold text-[#236383] truncate">
                {request.organizationName}
              </h3>
              {request.isConfirmed ? (
                <Badge className="bg-[#007E8C]/10 text-[#007E8C] border-[#007E8C]/30 shrink-0">
                  <Check className="w-3 h-3 mr-1" />
                  Confirmed
                </Badge>
              ) : (
                <Badge variant="outline" className="shrink-0 border-gray-400">Requested</Badge>
              )}
              {staffingComplete && (
                <Badge className="bg-[#47B3CB]/10 text-[#236383] border-[#47B3CB]/30 shrink-0">
                  <Check className="w-3 h-3 mr-1" />
                  Staffed
                </Badge>
              )}
              {missingInfo.length > 0 && (
                <Badge className="bg-[#A31C41]/10 text-[#A31C41] border-[#A31C41]/30 shrink-0">
                  <AlertTriangle className="w-3 h-3 mr-1" />
                  {missingInfo.length} Missing
                </Badge>
              )}
            </div>

            {/* Info Grid - Horizontal Layout */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-2 text-sm">
              {/* Date */}
              <div className="flex items-center gap-2 text-gray-700">
                <Calendar className="w-4 h-4 text-[#007E8C] shrink-0" />
                <span className="font-medium truncate">
                  {dateInfo ? dateInfo.text : 'No date'}
                </span>
              </div>

              {/* Time */}
              {request.eventStartTime && (
                <div className="flex items-center gap-2 text-gray-700">
                  <Clock className="w-4 h-4 text-[#236383] shrink-0" />
                  <span className="truncate">
                    {formatTime12Hour(request.eventStartTime)}
                    {request.eventEndTime && ` - ${formatTime12Hour(request.eventEndTime)}`}
                  </span>
                </div>
              )}

              {/* Sandwiches */}
              <div className="flex items-center gap-2 text-gray-700">
                <Package className="w-4 h-4 text-[#FBAD3F] shrink-0" />
                <span className="font-semibold truncate">{sandwichInfo}</span>
              </div>

              {/* Attendance */}
              {request.estimatedAttendance && (
                <div className="flex items-center gap-2 text-gray-700">
                  <Users className="w-4 h-4 text-[#47B3CB] shrink-0" />
                  <span className="truncate">{request.estimatedAttendance} people</span>
                </div>
              )}

              {/* Location */}
              {request.eventAddress && (
                <div className="flex items-center gap-2 text-gray-700 col-span-2">
                  <MapPin className="w-4 h-4 text-[#A31C41] shrink-0" />
                  <a
                    href={`https://maps.google.com/maps?q=${encodeURIComponent(request.eventAddress)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[#236383] hover:underline truncate"
                  >
                    {request.eventAddress}
                  </a>
                </div>
              )}

              {/* Contact */}
              {request.contactName && (
                <div className="flex items-center gap-2 text-gray-700">
                  <Mail className="w-4 h-4 text-[#007E8C] shrink-0" />
                  <span className="truncate">{request.contactName}</span>
                </div>
              )}

              {/* Recipients */}
              {request.assignedRecipientIds && request.assignedRecipientIds.length > 0 && (
                <div className="flex items-center gap-2 text-gray-700">
                  <Building className="w-4 h-4 text-[#47B3CB] shrink-0" />
                  <span className="truncate">
                    {request.assignedRecipientIds.length} recipient{request.assignedRecipientIds.length > 1 ? 's' : ''}
                  </span>
                </div>
              )}
            </div>

            {/* Staffing Status Bar */}
            {totalNeeded > 0 && (
              <div className="mt-3 flex items-center gap-4 text-xs">
                {driverNeeded > 0 && (
                  <div className="flex items-center gap-1">
                    <Car className="w-3 h-3 text-gray-500" />
                    <span className={driverAssigned >= driverNeeded ? 'text-green-700 font-medium' : 'text-orange-700'}>
                      {driverAssigned}/{driverNeeded} drivers
                    </span>
                  </div>
                )}
                {speakerNeeded > 0 && (
                  <div className="flex items-center gap-1">
                    <Megaphone className="w-3 h-3 text-gray-500" />
                    <span className={speakerAssigned >= speakerNeeded ? 'text-green-700 font-medium' : 'text-orange-700'}>
                      {speakerAssigned}/{speakerNeeded} speakers
                    </span>
                  </div>
                )}
                {volunteerNeeded > 0 && (
                  <div className="flex items-center gap-1">
                    <UserPlus className="w-3 h-3 text-gray-500" />
                    <span className={volunteerAssigned >= volunteerNeeded ? 'text-green-700 font-medium' : 'text-orange-700'}>
                      {volunteerAssigned}/{volunteerNeeded} volunteers
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 shrink-0">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowDetails(!showDetails)}
              className="h-8"
            >
              {showDetails ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={onContact}
              className="h-8 bg-[#236383] text-white border-[#236383] hover:bg-[#007E8C]"
            >
              <Mail className="w-4 h-4" />
            </Button>
            {canEdit && (
              <>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={onEdit}
                  className="h-8"
                >
                  <Edit2 className="w-4 h-4" />
                </Button>
                <ConfirmationDialog
                  trigger={
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 text-red-600 hover:text-red-700 hover:bg-red-50"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  }
                  title="Delete Event"
                  description={`Delete the event from ${request.organizationName}?`}
                  confirmText="Delete"
                  onConfirm={onDelete}
                  variant="destructive"
                />
              </>
            )}
          </div>
        </div>

        {/* Expandable Details */}
        {showDetails && (
          <div className="mt-4 pt-4 border-t border-gray-200 space-y-3">
            {/* Contact Details */}
            {(request.contactEmail || request.contactPhone) && (
              <div className="bg-[#47B3CB]/5 rounded-lg p-3 border border-[#47B3CB]/20">
                <h4 className="text-xs font-semibold text-[#236383] mb-2 uppercase tracking-wide">Contact Info</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                  {request.contactEmail && (
                    <div className="flex items-center gap-2">
                      <Mail className="w-3 h-3 text-gray-500" />
                      <a href={`mailto:${request.contactEmail}`} className="text-blue-600 hover:underline">
                        {request.contactEmail}
                      </a>
                    </div>
                  )}
                  {request.contactPhone && (
                    <div className="flex items-center gap-2">
                      <Phone className="w-3 h-3 text-gray-500" />
                      <a href={`tel:${request.contactPhone}`} className="text-blue-600 hover:underline">
                        {request.contactPhone}
                      </a>
                    </div>
                  )}
                  {(request.tspContact || request.customTspContact) && (
                    <div className="flex items-center gap-2">
                      <UserPlus className="w-3 h-3 text-gray-500" />
                      <span className="text-gray-700">
                        TSP: {request.customTspContact || resolveUserName(request.tspContact || '')}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Assignments */}
            {totalNeeded > 0 && (
              <div className="bg-[#007E8C]/5 rounded-lg p-3 border border-[#007E8C]/20">
                <h4 className="text-xs font-semibold text-[#236383] mb-2 uppercase tracking-wide">Team Assignments</h4>
                <div className="space-y-2 text-sm">
                  {driverNeeded > 0 && (
                    <div>
                      <span className="text-gray-600 font-medium">Drivers: </span>
                      {parsePostgresArray(request.assignedDriverIds).map((id) => (
                        <Badge key={id} variant="secondary" className="mr-1">
                          {resolveUserName(id)}
                        </Badge>
                      ))}
                      {driverAssigned === 0 && <span className="text-gray-400 italic">None assigned</span>}
                    </div>
                  )}
                  {speakerNeeded > 0 && (
                    <div>
                      <span className="text-gray-600 font-medium">Speakers: </span>
                      {Object.keys(request.speakerDetails || {}).map((id) => (
                        <Badge key={id} variant="secondary" className="mr-1">
                          {resolveUserName(id)}
                        </Badge>
                      ))}
                      {speakerAssigned === 0 && <span className="text-gray-400 italic">None assigned</span>}
                    </div>
                  )}
                  {volunteerNeeded > 0 && (
                    <div>
                      <span className="text-gray-600 font-medium">Volunteers: </span>
                      {parsePostgresArray(request.assignedVolunteerIds).map((id) => (
                        <Badge key={id} variant="secondary" className="mr-1">
                          {resolveUserName(id)}
                        </Badge>
                      ))}
                      {volunteerAssigned === 0 && <span className="text-gray-400 italic">None assigned</span>}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Notes */}
            {(request.message || request.planningNotes || request.schedulingNotes) && (
              <div className="bg-[#FBAD3F]/5 rounded-lg p-3 border border-[#FBAD3F]/20">
                <h4 className="text-xs font-semibold text-[#236383] mb-2 uppercase tracking-wide">Notes</h4>
                <div className="space-y-2 text-sm">
                  {request.message && (
                    <div>
                      <span className="text-gray-600 font-medium">Request: </span>
                      <p className="text-gray-700 mt-1">{request.message}</p>
                    </div>
                  )}
                  {request.planningNotes && (
                    <div>
                      <span className="text-gray-600 font-medium">Planning: </span>
                      <p className="text-gray-700 mt-1">{request.planningNotes}</p>
                    </div>
                  )}
                  {request.schedulingNotes && (
                    <div>
                      <span className="text-gray-600 font-medium">Scheduling: </span>
                      <p className="text-gray-700 mt-1">{request.schedulingNotes}</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Activity History */}
            <div className="border-t border-gray-200 pt-3">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowAuditLog(!showAuditLog)}
                className="w-full justify-between text-gray-600 hover:text-gray-800 h-8"
              >
                <div className="flex items-center gap-2">
                  <History className="w-4 h-4" />
                  <span className="text-sm">Activity History</span>
                </div>
                {showAuditLog ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </Button>

              {showAuditLog && (
                <div className="mt-3">
                  <EventRequestAuditLog
                    eventId={request.id?.toString()}
                    showFilters={false}
                    compact={true}
                  />
                </div>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
