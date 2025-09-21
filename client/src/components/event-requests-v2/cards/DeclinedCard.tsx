import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  XCircle,
  RefreshCw,
  Mail,
  Phone,
  Eye,
  Trash2,
  Calendar,
} from 'lucide-react';
import { CardHeader } from './shared/CardHeader';
import { formatEventDate } from '@/components/event-requests/utils';
import type { EventRequest } from '@shared/schema';

interface DeclinedCardProps {
  request: EventRequest;
  onView: () => void;
  onDelete: () => void;
  onContact: () => void;
  onCall: () => void;
  onReactivate: () => void;
  canDelete?: boolean;
}

export const DeclinedCard: React.FC<DeclinedCardProps> = ({
  request,
  onView,
  onDelete,
  onContact,
  onCall,
  onReactivate,
  canDelete = true,
}) => {
  const dateInfo = formatEventDate(request.desiredEventDate || '');

  return (
    <Card className="transition-all duration-200 hover:shadow-lg border-l-4 border-l-red-400 bg-red-50/30 opacity-90">
      <CardContent className="p-6">
        <CardHeader request={request} />

        {/* Decline Info */}
        <div className="space-y-3 mb-4">
          <div className="bg-red-50 rounded-lg p-3">
            <div className="flex items-center gap-2">
              <XCircle className="w-4 h-4 text-red-600" />
              <span className="text-sm font-medium text-red-700">
                Status: {request.status === 'declined' ? 'Declined' : 'Postponed'}
              </span>
              {request.statusChangedAt && (
                <span className="text-sm text-red-600">
                  on {new Date(request.statusChangedAt).toLocaleDateString()}
                </span>
              )}
            </div>
            {request.declineReason && (
              <p className="text-sm text-red-600 mt-2">
                Reason: {request.declineReason}
              </p>
            )}
          </div>

          {/* Original Request Info */}
          <div className="bg-white/70 rounded-lg p-3 space-y-2">
            <div>
              <p className="text-sm text-gray-500">Originally Requested Date</p>
              <p className="font-medium flex items-center gap-1">
                <Calendar className="w-4 h-4" />
                {dateInfo.display}
              </p>
            </div>
            {request.estimatedAttendance && (
              <div>
                <p className="text-sm text-gray-500">Estimated Attendance</p>
                <p className="font-medium">{request.estimatedAttendance}</p>
              </div>
            )}
            {request.estimatedSandwichCount && (
              <div>
                <p className="text-sm text-gray-500">Sandwich Count Requested</p>
                <p className="font-medium">{request.estimatedSandwichCount}</p>
              </div>
            )}
          </div>

          {/* Contact Info */}
          <div className="bg-white/70 rounded-lg p-3">
            <p className="text-sm font-medium mb-1">Contact:</p>
            <p className="text-sm">{request.firstName} {request.lastName}</p>
            <p className="text-sm text-gray-600">{request.email}</p>
            {request.phone && <p className="text-sm text-gray-600">{request.phone}</p>}
          </div>

          {/* Notes */}
          {request.notes && (
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-sm text-gray-600">{request.notes}</p>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t">
          <Button
            size="sm"
            variant="default"
            onClick={onReactivate}
            className="bg-green-600 hover:bg-green-700 text-white"
          >
            <RefreshCw className="w-4 h-4 mr-1" />
            Reactivate Request
          </Button>

          <Button size="sm" variant="outline" onClick={onView}>
            <Eye className="w-4 h-4 mr-1" />
            View Details
          </Button>

          {request.phone && (
            <Button size="sm" variant="outline" onClick={onCall}>
              <Phone className="w-4 h-4 mr-1" />
              Call
            </Button>
          )}

          <Button size="sm" variant="outline" onClick={onContact}>
            <Mail className="w-4 h-4 mr-1" />
            Email
          </Button>

          <div className="flex-1" />

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