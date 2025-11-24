import React, { useState, useMemo } from 'react';
import { useEventRequestContext } from '../context/EventRequestContext';
import { useEventFilters } from '../hooks/useEventFilters';
import { useEventAssignments } from '../hooks/useEventAssignments';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
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
    resolveUserName,
  } = useEventAssignments();

  const [roleFilter, setRoleFilter] = useState<'all' | 'speaker' | 'volunteer'>('all');

  // Get ONLY scheduled events
  const scheduledRequests = filterRequestsByStatus('scheduled');

  // Filter events that need volunteers or speakers
  const opportunities = useMemo(() => {
    return scheduledRequests.filter((request: EventRequest) => {
      // Check if roles are actually missing
      const needsSpeaker = !request.speakerId || request.speakerId === null || request.speakerId === '';
      const needsVolunteer = !request.volunteerId || request.volunteerId === null || request.volunteerId === '';

      // Filter by role selection
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
    <div className="space-y-6">
      {/* Role Filter */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-sm font-medium text-gray-700">Filter by role:</span>
        <div className="flex gap-2">
          <Button
            variant={roleFilter === 'all' ? 'default' : 'outline'}
            onClick={() => setRoleFilter('all')}
            size="sm"
            style={roleFilter === 'all' ? { backgroundColor: '#007E8C' } : {}}
          >
            All Roles ({opportunities.length})
          </Button>
          <Button
            variant={roleFilter === 'speaker' ? 'default' : 'outline'}
            onClick={() => setRoleFilter('speaker')}
            size="sm"
            style={roleFilter === 'speaker' ? { backgroundColor: '#007E8C' } : {}}
          >
            Speaker Needed
          </Button>
          <Button
            variant={roleFilter === 'volunteer' ? 'default' : 'outline'}
            onClick={() => setRoleFilter('volunteer')}
            size="sm"
            style={roleFilter === 'volunteer' ? { backgroundColor: '#007E8C' } : {}}
          >
            Volunteer Needed
          </Button>
        </div>
      </div>

      {/* Opportunities List */}
      {opportunities.length === 0 ? (
        <Card className="bg-gray-50">
          <CardContent className="py-12 text-center">
            <Users className="mx-auto h-12 w-12 text-gray-400 mb-4" />
            <p className="text-gray-600 font-medium">
              {roleFilter === 'all'
                ? 'No volunteer opportunities available at this time'
                : `No ${roleFilter} opportunities available at this time`}
            </p>
            <p className="text-sm text-gray-500 mt-2">
              All scheduled events have their roles filled. Check back later!
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {opportunities.map((request: EventRequest) => {
            const needsSpeaker = !request.speakerId || request.speakerId === null || request.speakerId === '';
            const needsVolunteer = !request.volunteerId || request.volunteerId === null || request.volunteerId === '';
            const isSpeakerSignedUp = request.speakerId === user?.id;
            const isVolunteerSignedUp = request.volunteerId === user?.id;

            return (
              <Card
                key={request.id}
                className="hover:shadow-lg transition-shadow border-2"
                style={{ borderColor: '#007E8C', backgroundColor: '#f0f9fa' }}
              >
                <CardContent className="p-6 space-y-4">
                  {/* Header */}
                  <div className="flex items-start justify-between gap-4 pb-3 border-b-2" style={{ borderColor: '#007E8C' }}>
                    <div className="flex-1">
                      <h3 className="text-xl font-bold" style={{ color: '#1A2332' }}>
                        {request.groupName}
                        {request.department && (
                          <span className="text-gray-600 font-normal ml-2">
                            &bull; {request.department}
                          </span>
                        )}
                      </h3>

                      {/* Roles Needed */}
                      <div className="flex gap-2 flex-wrap mt-2">
                        {needsSpeaker && (
                          <Badge className="bg-blue-600 text-white hover:bg-blue-700 text-sm">
                            Speaker Needed
                          </Badge>
                        )}
                        {needsVolunteer && (
                          <Badge className="bg-green-600 text-white hover:bg-green-700 text-sm">
                            Volunteer Needed
                          </Badge>
                        )}
                        {request.isConfirmed && (
                          <Badge style={{ backgroundColor: '#007E8C' }} className="text-white text-sm">
                            ✓ Date Confirmed
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Event Details - Prominent */}
                  <div className="space-y-3 p-4 rounded-lg border-2" style={{ backgroundColor: 'white', borderColor: '#007E8C' }}>
                    <div className="flex items-start gap-3">
                      <Calendar className="h-5 w-5 mt-0.5" style={{ color: '#007E8C' }} />
                      <div>
                        <div className="font-bold text-base" style={{ color: '#1A2332' }}>
                          {formatEventDate(request)}
                        </div>
                        <div className="text-gray-700 font-medium">
                          {formatEventTime(request)}
                        </div>
                      </div>
                    </div>

                    {request.location && (
                      <div className="flex items-start gap-3">
                        <MapPin className="h-5 w-5 mt-0.5" style={{ color: '#007E8C' }} />
                        <div className="text-gray-900 font-medium">{request.location}</div>
                      </div>
                    )}

                    <div className="flex items-start gap-3">
                      <Sandwich className="h-5 w-5 mt-0.5" style={{ color: '#007E8C' }} />
                      <div className="text-gray-900 font-medium">{getSandwichSummary(request)}</div>
                    </div>
                  </div>

                  {/* Two Column Layout for Contact and Planning Notes */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Contact Info - Smaller text */}
                    <div className="space-y-2 text-sm text-gray-600 p-3 bg-white rounded-lg border border-gray-300">
                      <div className="font-semibold text-gray-800 mb-2 flex items-center gap-2">
                        <User className="h-4 w-4" />
                        Contact Info
                      </div>
                      {request.name && (
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{request.name}</span>
                        </div>
                      )}
                      {request.email && (
                        <div className="flex items-center gap-2">
                          <Mail className="h-4 w-4" />
                          <a
                            href={`mailto:${request.email}`}
                            className="hover:underline"
                            style={{ color: '#007E8C' }}
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
                            className="hover:underline"
                            style={{ color: '#007E8C' }}
                          >
                            {request.phone}
                          </a>
                        </div>
                      )}
                    </div>

                    {/* Planning Notes */}
                    {request.planningNotes && (
                      <div className="space-y-2 text-sm p-3 rounded-lg border-2" style={{ backgroundColor: '#e6f4f6', borderColor: '#007E8C' }}>
                        <div className="font-semibold text-gray-800 mb-2 flex items-center gap-2">
                          <Info className="h-4 w-4" style={{ color: '#007E8C' }} />
                          Planning Notes
                        </div>
                        <div className="text-gray-700 whitespace-pre-wrap">
                          {request.planningNotes}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Sign Up Actions - Large, Prominent Buttons */}
                  <div className="flex gap-3 pt-4 border-t-2" style={{ borderColor: '#007E8C' }}>
                    {needsSpeaker && (
                      <Button
                        onClick={() => handleSelfSignup(request.id, 'speaker')}
                        disabled={isSpeakerSignedUp || !canSelfSignup('speaker')}
                        className="flex-1 text-base py-6 font-semibold"
                        style={
                          isSpeakerSignedUp
                            ? { backgroundColor: '#e0e0e0', color: '#666' }
                            : { backgroundColor: '#007E8C', color: 'white' }
                        }
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
                        className="flex-1 text-base py-6 font-semibold"
                        style={
                          isVolunteerSignedUp
                            ? { backgroundColor: '#e0e0e0', color: '#666' }
                            : { backgroundColor: '#007E8C', color: 'white' }
                        }
                      >
                        {isVolunteerSignedUp ? (
                          <>✓ You're signed up as Volunteer</>
                        ) : (
                          <>Sign Up as Volunteer</>
                        )}
                      </Button>
                    )}
                  </div>

                  {/* Show who else is assigned (if anyone) */}
                  {(request.speakerId || request.volunteerId) && (
                    <div className="text-sm text-gray-600 pt-2 border-t border-gray-300 bg-gray-50 p-3 rounded">
                      <div className="flex gap-4">
                        {request.speakerId && (
                          <div>
                            <span className="font-semibold">Speaker:</span>{' '}
                            {resolveUserName(request.speakerId)}
                          </div>
                        )}
                        {request.volunteerId && (
                          <div>
                            <span className="font-semibold">Volunteer:</span>{' '}
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
