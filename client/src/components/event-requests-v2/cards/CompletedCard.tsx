import React from 'react';
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
} from 'lucide-react';
import { CardHeader } from './shared/CardHeader';
import { CardAssignments } from './shared/CardAssignments';
import { formatTime12Hour } from '@/components/event-requests/utils';
import { getSandwichTypesSummary } from '@/components/event-requests/utils';
import type { EventRequest } from '@shared/schema';

interface CompletedCardProps {
  request: EventRequest;
  onView: () => void;
  onDelete: () => void;
  onContact: () => void;
  onFollowUp1Day: () => void;
  onFollowUp1Month: () => void;
  onViewCollectionLog?: () => void;
  onReschedule: () => void;
  resolveUserName: (id: string) => string;
  canDelete?: boolean;
}

export const CompletedCard: React.FC<CompletedCardProps> = ({
  request,
  onView,
  onDelete,
  onContact,
  onFollowUp1Day,
  onFollowUp1Month,
  onViewCollectionLog,
  onReschedule,
  resolveUserName,
  canDelete = true,
}) => {
  return (
    <Card className="transition-all duration-200 hover:shadow-lg border-l-4 border-l-gray-400 bg-gray-50">
      <CardContent className="p-6">
        <CardHeader request={request} />

        {/* Event Summary */}
        <div className="space-y-3 mb-4">
          <div className="bg-white rounded-lg p-3 space-y-2">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-500">Event Time</p>
                <p className="font-medium">
                  {request.eventStartTime && formatTime12Hour(request.eventStartTime)}
                  {request.eventEndTime && ` - ${formatTime12Hour(request.eventEndTime)}`}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Actual Attendance</p>
                <p className="font-medium">
                  {request.actualAttendance || request.estimatedAttendance || 'Not recorded'}
                </p>
              </div>
            </div>

            {/* Sandwich Info */}
            {(request.actualSandwichCount || request.estimatedSandwichCount || request.sandwichTypes) && (
              <div className="bg-green-50 rounded-lg p-3">
                <div className="flex items-center gap-2 text-sm">
                  <Package className="w-4 h-4 text-green-600" />
                  <span className="font-medium">Sandwiches Delivered:</span>
                  <span>
                    {request.actualSandwichCount
                      ? `${request.actualSandwichCount} delivered`
                      : request.sandwichTypes
                      ? getSandwichTypesSummary(request.sandwichTypes)
                      : `${request.estimatedSandwichCount} estimated`}
                  </span>
                </div>
              </div>
            )}

            {/* Follow-up Status */}
            <div className="flex gap-2">
              {request.followUpOneDayCompleted && (
                <Badge variant="success">
                  <CheckCircle className="w-3 h-3 mr-1" />
                  1-Day Follow-up Done
                </Badge>
              )}
              {request.followUpOneMonthCompleted && (
                <Badge variant="success">
                  <CheckCircle className="w-3 h-3 mr-1" />
                  1-Month Follow-up Done
                </Badge>
              )}
            </div>

            {/* Completion Notes */}
            {request.completionNotes && (
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-sm font-medium mb-1">Completion Notes:</p>
                <p className="text-sm text-gray-600">{request.completionNotes}</p>
              </div>
            )}
          </div>

          {/* Assignments Summary */}
          {(request.assignedDriverIds || request.speakerDetails || request.assignedVolunteerIds) && (
            <div className="bg-white rounded-lg p-3">
              <p className="text-sm font-medium mb-2">Event Team:</p>
              <CardAssignments
                request={request}
                resolveUserName={resolveUserName}
                canEdit={false}
              />
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t">
          <Button size="sm" variant="outline" onClick={onView}>
            <Eye className="w-4 h-4 mr-1" />
            View Details
          </Button>

          {!request.followUpOneDayCompleted && (
            <Button
              size="sm"
              variant="outline"
              onClick={onFollowUp1Day}
              className="bg-blue-50 hover:bg-blue-100"
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