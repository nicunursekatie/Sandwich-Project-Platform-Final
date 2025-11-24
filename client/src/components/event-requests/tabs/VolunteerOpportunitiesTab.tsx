import React, { useState, useMemo } from 'react';
import { useEventRequestContext } from '../context/EventRequestContext';
import { useEventFilters } from '../hooks/useEventFilters';
import { useEventAssignments } from '../hooks/useEventAssignments';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Calendar, MapPin, Users, Phone, Mail, User, Info, Sandwich } from 'lucide-react';
import { format } from 'date-fns';
import type { EventRequest } from '@shared/schema';
import { parseSandwichTypes } from '@/lib/sandwich-utils';

export const VolunteerOpportunitiesTab: React.FC = () => {
  const { user } = useAuth();
  const { filterRequestsByStatus } = useEventFilters();
  const {
    handleSelfSignup,
    canSelfSignup,
    isUserSignedUp,
    resolveUserName,
  } = useEventAssignments();

  const [roleFilter, setRoleFilter] = useState<'all' | 'speaker' | 'volunteer'>('all');

  // Get scheduled events
  const scheduledRequests = filterRequestsByStatus('scheduled');

  // Filter events that need volunteers or speakers
  const opportunities = useMemo(() => {
    return scheduledRequests.filter((request: EventRequest) => {
      const needsSpeaker = !request.speakerId;
      const needsVolunteer = !request.volunteerId;

      // Filter by role
      if (roleFilter === 'speaker' && !needsSpeaker) return false;
      if (roleFilter === 'volunteer' && !needsVolunteer) return false;

      // Show if either role is needed
      return needsSpeaker || needsVolunteer;
    });
  }, [scheduledRequests, roleFilter]);

  const formatEventDate = (request: EventRequest) => {
    const date = request.scheduledEventDate || request.desiredEventDate;
    if (!date) return 'Date TBD';
    try {
      return format(new Date(date), 'EEEE, MMMM d, yyyy');
    } catch {
      return 'Invalid date';
    }
  };

  const formatEventTime = (request: EventRequest) => {
    if (!request.eventTime) return 'Time TBD';
    return request.eventTime;
  };

  const getSandwichSummary = (request: EventRequest) => {
    if (!request.sandwichTypes) return 'Not specified';
    const types = parseSandwichTypes(request.sandwichTypes);
    const total = types.reduce((sum, type) => sum + type.quantity, 0);
    return `${total} sandwiches (${types.map(t => `${t.quantity} ${t.type}`).join(', ')})`;
  };

  return (
    <div className="space-y-6 p-4">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Volunteer Opportunities</h2>
          <p className="text-gray-600 mt-1">
            Sign up to speak or volunteer at upcoming events
          </p>
        </div>

        {/* Role Filter */}
        <div className="flex gap-2">
          <Button
            variant={roleFilter === 'all' ? 'default' : 'outline'}
            onClick={() => setRoleFilter('all')}
            size="sm"
          >
            All Roles
          </Button>
          <Button
            variant={roleFilter === 'speaker' ? 'default' : 'outline'}
            onClick={() => setRoleFilter('speaker')}
            size="sm"
          >
            Speaker Needed
          </Button>
          <Button
            variant={roleFilter === 'volunteer' ? 'default' : 'outline'}
            onClick={() => setRoleFilter('volunteer')}
            size="sm"
          >
            Volunteer Needed
          </Button>
        </div>
      </div>

      {/* Opportunities Count */}
      <div className="text-sm text-gray-600">
        {opportunities.length} {opportunities.length === 1 ? 'opportunity' : 'opportunities'} available
      </div>

      {/* Opportunities List */}
      {opportunities.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Users className="mx-auto h-12 w-12 text-gray-400 mb-4" />
            <p className="text-gray-600">
              {roleFilter === 'all'
                ? 'No volunteer opportunities available at this time'
                : `No ${roleFilter} opportunities available at this time`}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {opportunities.map((request: EventRequest) => {
            const needsSpeaker = !request.speakerId;
            const needsVolunteer = !request.volunteerId;
            const isSpeakerSignedUp = request.speakerId === user?.id;
            const isVolunteerSignedUp = request.volunteerId === user?.id;

            return (
              <Card key={request.id} className="hover:shadow-lg transition-shadow">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-gray-900 mb-2">
                        {request.groupName}
                        {request.department && (
                          <span className="text-gray-500 font-normal ml-2">
                            &bull; {request.department}
                          </span>
                        )}
                      </h3>

                      {/* Roles Needed */}
                      <div className="flex gap-2 flex-wrap">
                        {needsSpeaker && (
                          <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-200">
                            Speaker Needed
                          </Badge>
                        )}
                        {needsVolunteer && (
                          <Badge className="bg-green-100 text-green-800 hover:bg-green-200">
                            Volunteer Needed
                          </Badge>
                        )}
                        {request.isConfirmed && (
                          <Badge className="bg-[#007E8C] text-white">
                            ✓ Date Confirmed
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="space-y-4">
                  {/* Event Details - Prominent */}
                  <div className="space-y-3 p-4 bg-gray-50 rounded-lg">
                    <div className="flex items-start gap-3">
                      <Calendar className="h-5 w-5 text-gray-600 mt-0.5" />
                      <div>
                        <div className="font-medium text-gray-900">
                          {formatEventDate(request)}
                        </div>
                        <div className="text-gray-600">
                          {formatEventTime(request)}
                        </div>
                      </div>
                    </div>

                    {request.location && (
                      <div className="flex items-start gap-3">
                        <MapPin className="h-5 w-5 text-gray-600 mt-0.5" />
                        <div className="text-gray-900">{request.location}</div>
                      </div>
                    )}

                    <div className="flex items-start gap-3">
                      <Sandwich className="h-5 w-5 text-gray-600 mt-0.5" />
                      <div className="text-gray-900">{getSandwichSummary(request)}</div>
                    </div>
                  </div>

                  {/* Two Column Layout for Contact and Planning Notes */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Contact Info - Smaller text */}
                    <div className="space-y-2 text-sm text-gray-600">
                      <div className="font-medium text-gray-700 mb-2">Contact Info</div>
                      {request.name && (
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4" />
                          <span>{request.name}</span>
                        </div>
                      )}
                      {request.email && (
                        <div className="flex items-center gap-2">
                          <Mail className="h-4 w-4" />
                          <a
                            href={`mailto:${request.email}`}
                            className="text-blue-600 hover:underline"
                          >
                            {request.email}
                          </a>
                        </div>
                      )}
                      {request.phone && (
                        <div className="flex items-center gap-2">
                          <Phone className="h-4 w-4" />
                          <a
                            href={`tel:${request.phone}`}
                            className="text-blue-600 hover:underline"
                          >
                            {request.phone}
                          </a>
                        </div>
                      )}
                    </div>

                    {/* Planning Notes - Similar size */}
                    {request.planningNotes && (
                      <div className="space-y-2 text-sm">
                        <div className="font-medium text-gray-700 mb-2 flex items-center gap-2">
                          <Info className="h-4 w-4" />
                          Planning Notes
                        </div>
                        <div className="text-gray-600 whitespace-pre-wrap p-3 bg-blue-50 rounded border border-blue-200">
                          {request.planningNotes}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Sign Up Actions */}
                  <div className="flex gap-3 pt-4 border-t">
                    {needsSpeaker && (
                      <Button
                        onClick={() => handleSelfSignup(request.id, 'speaker')}
                        disabled={isSpeakerSignedUp || !canSelfSignup('speaker')}
                        className="flex-1"
                        variant={isSpeakerSignedUp ? 'outline' : 'default'}
                      >
                        {isSpeakerSignedUp ? (
                          <>✓ You're signed up as Speaker</>
                        ) : (
                          <>Sign Up as Speaker</>
                        )}
                      </Button>
                    )}
                    {needsVolunteer && (
                      <Button
                        onClick={() => handleSelfSignup(request.id, 'volunteer')}
                        disabled={isVolunteerSignedUp || !canSelfSignup('volunteer')}
                        className="flex-1"
                        variant={isVolunteerSignedUp ? 'outline' : 'default'}
                      >
                        {isVolunteerSignedUp ? (
                          <>✓ You're signed up as Volunteer</>
                        ) : (
                          <>Sign Up as Volunteer</>
                        )}
                      </Button>
                    )}
                  </div>

                  {/* Show who else is assigned */}
                  {(request.speakerId || request.volunteerId) && (
                    <div className="text-sm text-gray-600 pt-2 border-t">
                      <div className="flex gap-4">
                        {request.speakerId && (
                          <div>
                            <span className="font-medium">Speaker:</span>{' '}
                            {resolveUserName(request.speakerId)}
                          </div>
                        )}
                        {request.volunteerId && (
                          <div>
                            <span className="font-medium">Volunteer:</span>{' '}
                            {resolveUserName(request.volunteerId)}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};
