import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Calendar,
  Clock,
  Package,
  Phone,
  Mail,
  Edit,
  Trash2,
  AlertTriangle,
  CheckCircle,
} from 'lucide-react';
import { CardHeader } from './shared/CardHeader';
import { CardContactInfo } from './shared/CardContactInfo';
import { formatTime12Hour } from '@/components/event-requests/utils';
import { formatSandwichTypesDisplay } from '@/lib/sandwich-utils';
import type { EventRequest } from '@shared/schema';

interface InProcessCardProps {
  request: EventRequest;
  isStale?: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onSchedule: () => void;
  onCall: () => void;
  onContact: () => void;
  onScheduleCall: () => void;
  onResendToolkit?: () => void;
  canEdit?: boolean;
  canDelete?: boolean;
}

export const InProcessCard: React.FC<InProcessCardProps> = ({
  request,
  isStale = false,
  onEdit,
  onDelete,
  onSchedule,
  onCall,
  onContact,
  onScheduleCall,
  onResendToolkit,
  canEdit = true,
  canDelete = true,
}) => {
  return (
    <Card className={`transition-all duration-200 hover:shadow-lg border-l-4 ${
      isStale ? 'border-l-amber-500' : 'border-l-yellow-500'
    }`}>
      <CardContent className="p-6">
        <CardHeader request={request} isInProcessStale={isStale} />

        {/* Event Details */}
        <div className="space-y-3 mb-4">
          {/* Toolkit Sent Info */}
          {request.toolkitSentDate && (
            <div className="bg-yellow-50 rounded-lg p-3">
              <div className="flex items-center gap-2">
                <Package className="w-4 h-4 text-yellow-600" />
                <span className="text-sm font-medium">Toolkit sent:</span>
                <span className="text-sm">
                  {new Date(request.toolkitSentDate).toLocaleDateString()}
                </span>
                {isStale && (
                  <Badge variant="outline" className="ml-2 bg-amber-50 text-amber-700 border-amber-300">
                    <AlertTriangle className="w-3 h-3 mr-1" />
                    Over 1 week ago
                  </Badge>
                )}
              </div>
            </div>
          )}

          {/* Scheduled Call Info */}
          {request.scheduledCallDate && (
            <div className="bg-blue-50 rounded-lg p-3">
              <div className="flex items-center gap-2">
                <Phone className="w-4 h-4 text-blue-600" />
                <span className="text-sm font-medium">Call scheduled:</span>
                <span className="text-sm">
                  {new Date(request.scheduledCallDate).toLocaleString()}
                </span>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-gray-500">Preferred Time</p>
              <p className="font-medium">
                {request.preferredStartTime && formatTime12Hour(request.preferredStartTime)}
                {request.preferredEndTime && ` - ${formatTime12Hour(request.preferredEndTime)}`}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Estimated Attendance</p>
              <p className="font-medium">{request.estimatedAttendance || 'Not specified'}</p>
            </div>
          </div>

          {/* Sandwich Info */}
          {(request.estimatedSandwichCount || request.sandwichTypes) && (
            <div className="bg-amber-50 rounded-lg p-3">
              <div className="flex items-center gap-2 text-sm">
                <Package className="w-4 h-4 text-amber-600" />
                <span className="font-medium">Sandwiches:</span>
                <span>
                  {formatSandwichTypesDisplay(request.sandwichTypes, request.estimatedSandwichCount)}
                </span>
              </div>
            </div>
          )}

          {/* Notes */}
          {request.notes && (
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-sm text-gray-600">{request.notes}</p>
            </div>
          )}
        </div>

        {/* Contact Info */}
        <CardContactInfo
          request={request}
          onCall={onCall}
          onContact={onContact}
        />

        {/* Action Buttons */}
        <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t">
          <Button
            size="sm"
            variant="default"
            onClick={onSchedule}
            className="bg-green-600 hover:bg-green-700 text-white"
          >
            <Calendar className="w-4 h-4 mr-1" />
            Mark Scheduled
          </Button>
          {!request.scheduledCallDate && (
            <Button
              size="sm"
              variant="outline"
              onClick={onScheduleCall}
            >
              <Phone className="w-4 h-4 mr-1" />
              Schedule Follow-up Call
            </Button>
          )}
          {onResendToolkit && (
            <Button
              size="sm"
              variant="outline"
              onClick={onResendToolkit}
            >
              <Package className="w-4 h-4 mr-1" />
              Resend Toolkit
            </Button>
          )}

          <div className="flex-1" />

          {canEdit && (
            <Button size="sm" variant="ghost" onClick={onEdit}>
              <Edit className="w-4 h-4" />
            </Button>
          )}
          {canDelete && (
            <Button
              size="sm"
              variant="ghost"
              onClick={onDelete}
              className="text-red-600 hover:text-red-700"
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
};