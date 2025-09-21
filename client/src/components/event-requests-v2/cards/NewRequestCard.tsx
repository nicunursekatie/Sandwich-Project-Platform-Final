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
  CheckCircle,
  X,
  Users,
  MapPin,
} from 'lucide-react';
import { CardHeader } from './shared/CardHeader';
import { CardContactInfo } from './shared/CardContactInfo';
import { formatTime12Hour } from '@/components/event-requests/utils';
import { formatSandwichTypesDisplay } from '@/lib/sandwich-utils';
import type { EventRequest } from '@shared/schema';

interface NewRequestCardProps {
  request: EventRequest;
  onEdit: () => void;
  onDelete: () => void;
  onCall: () => void;
  onContact: () => void;
  onToolkit: () => void;
  onScheduleCall: () => void;
  onApprove: () => void;
  onDecline: () => void;
  canEdit?: boolean;
  canDelete?: boolean;
}

export const NewRequestCard: React.FC<NewRequestCardProps> = ({
  request,
  onEdit,
  onDelete,
  onCall,
  onContact,
  onToolkit,
  onScheduleCall,
  onApprove,
  onDecline,
  canEdit = true,
  canDelete = true,
}) => {
  return (
    <Card className="transition-all duration-200 hover:shadow-lg border-l-4 border-l-[#236383] bg-gradient-to-br from-[#e6f2f5] to-[#d1e9ed] border border-[#236383]/30">
      <CardContent className="p-6">
        <CardHeader request={request} />

        {/* Event Details */}
        <div className="space-y-3 mb-4">
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
              <p className="font-medium flex items-center gap-1">
                <Users className="w-4 h-4" />
                {request.estimatedAttendance || 'Not specified'}
              </p>
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

          {/* Previous Host Status */}
          {request.hasHostedBefore !== null && (
            <div className="flex items-center gap-2 text-sm">
              <span className="text-gray-500">Previously hosted:</span>
              <Badge variant={request.hasHostedBefore ? "success" : "secondary"}>
                {request.hasHostedBefore ? 'Yes' : 'No - First Time'}
              </Badge>
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
            onClick={onToolkit}
            className="bg-[#FBAD3F] hover:bg-[#e89a2d] text-white"
          >
            <Package className="w-4 h-4 mr-1" />
            Send Toolkit
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={onScheduleCall}
          >
            <Phone className="w-4 h-4 mr-1" />
            Schedule Call
          </Button>

          <div className="flex-1" />

          {/* Quick Actions */}
          <Button
            size="sm"
            variant="ghost"
            onClick={onApprove}
            className="text-[#236383] hover:text-[#007E8C]"
          >
            <CheckCircle className="w-4 h-4 mr-1" />
            Approve
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={onDecline}
            className="text-red-600 hover:text-red-700"
          >
            <X className="w-4 h-4 mr-1" />
            Decline
          </Button>

          {/* Edit/Delete */}
          {canEdit && (
            <Button
              size="sm"
              variant="ghost"
              onClick={onEdit}
            >
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