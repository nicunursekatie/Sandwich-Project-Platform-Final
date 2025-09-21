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
  Users,
  MapPin,
  UserPlus,
} from 'lucide-react';
import { CardHeader } from './shared/CardHeader';
import { CardContactInfo } from './shared/CardContactInfo';
import { statusColors } from '@/components/event-requests/constants';
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
  onAssignTspContact: () => void;
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
  onAssignTspContact,
  canEdit = true,
  canDelete = true,
}) => {
  return (
    <Card className={`transition-all duration-200 hover:shadow-lg border-l-4 border-l-[#236383] ${statusColors.new}`}>
      <CardContent className="p-6">
        <CardHeader request={request} />

        {/* TSP Contact Assignment Status */}
        {(request.tspContact || request.customTspContact) && (
          <div className="mb-4">
            <div className="bg-gradient-to-r from-yellow-400 to-yellow-500 rounded-lg p-3 border-2 border-yellow-500">
              <div className="flex items-center gap-2">
                <UserPlus className="w-4 h-4 text-yellow-800" />
                <span className="font-semibold text-yellow-800">TSP Contact Assigned:</span>
                <span className="font-medium text-yellow-900">
                  {request.tspContact || request.customTspContact}
                </span>
              </div>
              {request.tspContactAssignedDate && (
                <p className="text-sm text-yellow-700 mt-1">
                  Assigned on {new Date(request.tspContactAssignedDate).toLocaleDateString()}
                </p>
              )}
            </div>
          </div>
        )}

        {/* Event Details */}
        <div className="space-y-3 mb-4">
          <div className="bg-blue-50 rounded-lg p-3">
            <p className="text-sm text-gray-500 mb-1">Submitted</p>
            <p className="font-medium flex items-center gap-1">
              <Clock className="w-4 h-4" />
              {request.createdAt
                ? new Date(request.createdAt).toLocaleDateString() + ' at ' + new Date(request.createdAt).toLocaleTimeString()
                : 'Unknown'}
            </p>
          </div>

          {/* Submission Message */}
          {request.message && (
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-sm text-gray-500 mb-1">Message from submission:</p>
              <p className="text-sm text-gray-600">{request.message}</p>
            </div>
          )}

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

        </div>

        {/* Contact Info */}
        <CardContactInfo
          request={request}
          onCall={onCall}
          onContact={onContact}
        />

        {/* Action Buttons */}
        <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t">
          {/* TSP Contact Assignment - only show if not already assigned */}
          {!(request.tspContact || request.customTspContact) && (
            <Button
              size="sm"
              variant="outline"
              onClick={onAssignTspContact}
              className="border-yellow-500 text-yellow-700 hover:bg-yellow-50"
            >
              <UserPlus className="w-4 h-4 mr-1" />
              Assign TSP Contact
            </Button>
          )}
          
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