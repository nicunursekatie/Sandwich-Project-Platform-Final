import React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Car, Megaphone, Users, UserPlus, X } from 'lucide-react';
import type { EventRequest } from '@shared/schema';

interface CardAssignmentsProps {
  request: EventRequest;
  resolveUserName: (id: string) => string;
  canEdit?: boolean;
  canSelfSignup?: (request: EventRequest, type: 'driver' | 'speaker' | 'volunteer') => boolean;
  isUserSignedUp?: (request: EventRequest, type: 'driver' | 'speaker' | 'volunteer') => boolean;
  onAssign?: (type: 'driver' | 'speaker' | 'volunteer') => void;
  onEditAssignment?: (type: 'driver' | 'speaker' | 'volunteer', personId: string) => void;
  onRemoveAssignment?: (type: 'driver' | 'speaker' | 'volunteer', personId: string) => void;
  onSelfSignup?: (type: 'driver' | 'speaker' | 'volunteer') => void;
}

export const CardAssignments: React.FC<CardAssignmentsProps> = ({
  request,
  resolveUserName,
  canEdit = false,
  canSelfSignup,
  isUserSignedUp,
  onAssign,
  onEditAssignment,
  onRemoveAssignment,
  onSelfSignup,
}) => {
  const parsePostgresArray = (arr: any): string[] => {
    if (!arr) return [];
    if (Array.isArray(arr)) return arr;
    if (typeof arr === 'string') {
      if (arr === '{}' || arr === '') return [];
      let cleaned = arr.replace(/^{|}$/g, '');
      if (!cleaned) return [];
      if (cleaned.includes('"')) {
        const matches = cleaned.match(/"[^"]*"|[^",]+/g);
        return matches ? matches.map(item => item.replace(/"/g, '').trim()).filter(item => item) : [];
      }
      return cleaned.split(',').map(item => item.trim()).filter(item => item);
    }
    return [];
  };

  const renderAssignmentSection = (
    type: 'driver' | 'speaker' | 'volunteer',
    icon: React.ReactNode,
    title: string,
    needed: number | null | undefined,
    assignedIds: string[] | any,
    details?: any
  ) => {
    const assigned = type === 'speaker' ?
      Object.keys(details || {}) :
      parsePostgresArray(assignedIds);

    const hasCapacity = typeof needed === 'number' ? assigned.length < needed : true;
    const canSignup = canSelfSignup && canSelfSignup(request, type);
    const isSignedUp = isUserSignedUp && isUserSignedUp(request, type);

    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {icon}
            <span className="font-medium text-sm">
              {title}
              {typeof needed === 'number' && ` (${assigned.length}/${needed})`}
            </span>
          </div>
          {canEdit && hasCapacity && onAssign && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => onAssign(type)}
              className="h-7 text-xs"
            >
              <UserPlus className="w-3 h-3 mr-1" />
              Assign
            </Button>
          )}
          {!canEdit && canSignup && onSelfSignup && (
            <Button
              size="sm"
              variant={isSignedUp ? "secondary" : "outline"}
              onClick={() => onSelfSignup(type)}
              className="h-7 text-xs"
            >
              {isSignedUp ? 'Signed up' : 'Sign up'}
            </Button>
          )}
        </div>
        {assigned.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {assigned.map((personId: string) => {
              const name = details?.[personId]?.name || resolveUserName(personId);
              return (
                <Badge key={personId} variant="secondary" className="text-xs">
                  {name}
                  {canEdit && onRemoveAssignment && (
                    <button
                      onClick={() => onRemoveAssignment(type, personId)}
                      className="ml-1 hover:bg-gray-300 rounded-full"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </Badge>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-3 pt-3 border-t">
      {(request.driversNeeded || (request.assignedDriverIds && parsePostgresArray(request.assignedDriverIds).length > 0)) &&
        renderAssignmentSection(
          'driver',
          <Car className="w-4 h-4 text-blue-600" />,
          'Drivers',
          request.driversNeeded,
          request.assignedDriverIds,
          request.driverDetails
        )}

      {(request.speakersNeeded || Object.keys(request.speakerDetails || {}).length > 0) &&
        renderAssignmentSection(
          'speaker',
          <Megaphone className="w-4 h-4 text-purple-600" />,
          'Speakers',
          request.speakersNeeded,
          [],
          request.speakerDetails
        )}

      {(request.volunteersNeeded || (request.assignedVolunteerIds && parsePostgresArray(request.assignedVolunteerIds).length > 0)) &&
        renderAssignmentSection(
          'volunteer',
          <Users className="w-4 h-4 text-green-600" />,
          'Volunteers',
          request.volunteersNeeded,
          request.assignedVolunteerIds,
          request.volunteerDetails
        )}
    </div>
  );
};