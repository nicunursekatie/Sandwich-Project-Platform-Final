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

  const renderAssignmentColumn = (
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
      <div className="bg-white/60 rounded-lg p-4 border border-white/80 min-h-[120px]">
        {/* Header with icon and title */}
        <div className="flex items-center gap-2 mb-3">
          {icon}
          <span className="font-semibold text-base text-[#236383]">{title}</span>
        </div>

        {/* Assigned people */}
        <div className="space-y-2 mb-3 min-h-[60px]">
          {assigned.length > 0 ? (
            assigned.map((personId: string) => {
              const name = details?.[personId]?.name || resolveUserName(personId);
              return (
                <div key={personId} className="flex items-center justify-between bg-white/80 rounded px-3 py-2">
                  <span className="text-sm font-medium">{name}</span>
                  {canEdit && onRemoveAssignment && (
                    <button
                      onClick={() => onRemoveAssignment(type, personId)}
                      className="text-red-500 hover:text-red-700 hover:bg-red-50 rounded-full p-1"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>
              );
            })
          ) : (
            <div className="text-sm text-[#236383]/60 italic">No one assigned</div>
          )}
        </div>

        {/* Assign button */}
        {canEdit && hasCapacity && onAssign && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => onAssign(type)}
            className="w-full text-sm border-[#FBAD3F] text-[#FBAD3F] hover:bg-[#FBAD3F] hover:text-white"
          >
            <UserPlus className="w-4 h-4 mr-2" />
            Assign {title.slice(0, -1)}
          </Button>
        )}
        {!canEdit && canSignup && onSelfSignup && (
          <Button
            size="sm"
            variant={isSignedUp ? "secondary" : "outline"}
            onClick={() => onSelfSignup(type)}
            className="w-full text-sm"
          >
            {isSignedUp ? 'Signed up' : 'Sign up'}
          </Button>
        )}
      </div>
    );
  };

  // Custom render for van driver (single assignment)
  const renderVanDriverAssignment = () => {
    if (!request.vanDriverNeeded && !request.assignedVanDriverId) {
      return null; // Don't show section if not needed and no one assigned
    }

    const assignedVanDriverName = request.assignedVanDriverId 
      ? (request.customVanDriverName || resolveUserName(request.assignedVanDriverId))
      : null;

    return (
      <div className="bg-white/60 rounded-lg p-4 border border-white/80 min-h-[120px]">
        {/* Header */}
        <div className="flex items-center gap-2 mb-3">
          <Car className="w-5 h-5 text-[#A31C41]" />
          <span className="font-semibold text-base text-[#A31C41]">Van Driver</span>
        </div>

        {/* Assigned van driver */}
        <div className="space-y-2 mb-3 min-h-[60px]">
          {assignedVanDriverName ? (
            <div className="flex items-center justify-between bg-white/80 rounded px-3 py-2">
              <span className="text-sm font-medium">{assignedVanDriverName}</span>
              {canEdit && onRemoveAssignment && (
                <button
                  onClick={() => onRemoveAssignment('driver', request.assignedVanDriverId!)}
                  className="text-red-500 hover:text-red-700 hover:bg-red-50 rounded-full p-1"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          ) : (
            <div className="text-sm text-[#A31C41]/60 italic">No van driver assigned</div>
          )}
        </div>

        {/* Assign button - only show if no one assigned yet */}
        {canEdit && !assignedVanDriverName && onAssign && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => onAssign('driver')}
            className="w-full text-sm border-[#A31C41] text-[#A31C41] hover:bg-[#A31C41] hover:text-white"
          >
            <UserPlus className="w-4 h-4 mr-2" />
            Assign Van Driver
          </Button>
        )}
      </div>
    );
  };

  return (
    <div className="pt-4">
      {/* Assignments Section */}
      <div className="grid grid-cols-3 gap-4">
        {/* Drivers Column */}
        {renderAssignmentColumn(
          'driver',
          <Car className="w-5 h-5 text-[#236383]" />,
          'Drivers',
          request.driversNeeded,
          request.assignedDriverIds,
          request.driverDetails
        )}

        {/* Speakers Column */}
        {renderAssignmentColumn(
          'speaker',
          <Megaphone className="w-5 h-5 text-[#236383]" />,
          'Speakers',
          request.speakersNeeded,
          request.assignedSpeakerIds,
          request.speakerDetails
        )}

        {/* Volunteers Column */}
        {renderAssignmentColumn(
          'volunteer',
          <Users className="w-5 h-5 text-[#236383]" />,
          'Volunteers',
          request.volunteersNeeded,
          request.assignedVolunteerIds,
          request.volunteerDetails
        )}
      </div>

      {/* Van Driver Section - separate row if needed */}
      {(request.vanDriverNeeded || request.assignedVanDriverId) && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
          <div className="md:col-span-1">
            {renderVanDriverAssignment()}
          </div>
          <div className="md:col-span-2"></div> {/* Empty space to maintain layout */}
        </div>
      )}
    </div>
  );
};