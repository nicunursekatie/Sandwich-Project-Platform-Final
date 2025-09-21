import React from 'react';
import { Button } from '@/components/ui/button';
import { Mail, Phone, User } from 'lucide-react';
import type { EventRequest } from '@shared/schema';

interface CardContactInfoProps {
  request: EventRequest;
  onCall?: () => void;
  onContact?: () => void;
}

export const CardContactInfo: React.FC<CardContactInfoProps> = ({
  request,
  onCall,
  onContact
}) => {
  return (
    <div className="bg-gray-50 rounded-lg p-3 space-y-2">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-sm">
            <User className="w-4 h-4 text-gray-500" />
            <span className="font-medium text-[16px]">
              {request.firstName} {request.lastName}
            </span>
          </div>
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <Mail className="w-4 h-4 text-gray-400" />
            <span className="text-[16px]">{request.email}</span>
          </div>
          {request.phone && (
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <Phone className="w-4 h-4 text-gray-400" />
              <span className="text-[16px]">{request.phone}</span>
            </div>
          )}
        </div>
        <div className="flex flex-col gap-2">
          {request.phone && onCall && (
            <Button
              size="sm"
              variant="outline"
              onClick={onCall}
              className="text-xs"
            >
              <Phone className="w-3 h-3 mr-1" />
              Call
            </Button>
          )}
          {onContact && (
            <Button
              size="sm"
              variant="outline"
              onClick={onContact}
              className="text-xs"
            >
              <Mail className="w-3 h-3 mr-1" />
              Email
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};