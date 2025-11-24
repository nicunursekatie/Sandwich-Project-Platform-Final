import React, { useState, useMemo } from 'react';
import { useEventRequestContext } from '../context/EventRequestContext';
import { useEventFilters } from '../hooks/useEventFilters';
import { useEventAssignments } from '../hooks/useEventAssignments';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Calendar, MapPin, Users, Phone, Mail, User, Info, Sandwich, LayoutGrid, Map as MapIcon } from 'lucide-react';
import { format } from 'date-fns';
import type { EventRequest } from '@shared/schema';
import { parseSandwichTypes } from '@/lib/sandwich-utils';
import { EventCalendarView } from '@/components/event-calendar-view';
import { VolunteerOpportunitiesMap } from './VolunteerOpportunitiesMap';

export const VolunteerOpportunitiesTab: React.FC = () => {
  const { user } = useAuth();
  const { filterRequestsByStatus } = useEventFilters();
  const {
    handleSelfSignup,
    canSelfSignup,
    resolveUserName,
  } = useEventAssignments();

  const [roleFilter, setRoleFilter] = useState<'all' | 'speaker' | 'volunteer'>('all');
  const [viewMode, setViewMode] = useState<'card' | 'calendar' | 'map'>('card');

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

    // If only one type, just show "200 deli"
    if (types.length === 1) {
      return `${types[0].quantity} ${types[0].type}`;
    }

    // If multiple types, show breakdown with total: "100 deli, 100 veggie (200 total)"
    return `${types.map(t => `${t.quantity} ${t.type}`).join(', ')} (${total} total)`;
  };

  return (
    <div className="space-y-6 overflow-x-hidden max-w-full">
      {/* View Mode and Role Filter */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        {/* View Toggle */}
        <div className="flex items-center gap-3">
          <span className="text-base font-semibold text-gray-700">View:</span>
          <div className="flex gap-2">
            <Button
              variant={viewMode === 'card' ? 'default' : 'outline'}
              onClick={() => setViewMode('card')}
              size="default"
              className="text-base px-4 py-5"
              style={viewMode === 'card' ? { backgroundColor: '#007E8C' } : {}}
            >
              <LayoutGrid className="w-5 h-5 mr-2" />
              Cards
            </Button>
            <Button
              variant={viewMode === 'calendar' ? 'default' : 'outline'}
              onClick={() => setViewMode('calendar')}
              size="default"
              className="text-base px-4 py-5"
              style={viewMode === 'calendar' ? { backgroundColor: '#007E8C' } : {}}
            >
              <Calendar className="w-5 h-5 mr-2" />
              Calendar
            </Button>
            <Button
              variant={viewMode === 'map' ? 'default' : 'outline'}
              onClick={() => setViewMode('map')}
              size="default"
              className="text-base px-4 py-5"
              style={viewMode === 'map' ? { backgroundColor: '#007E8C' } : {}}
            >
              <MapIcon className="w-5 h-5 mr-2" />
              Map
            </Button>
          </div>
        </div>

        {/* Role Filter */}
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-base font-semibold text-gray-700">Filter by role:</span>
          <div className="flex gap-2">
            <Button
              variant={roleFilter === 'all' ? 'default' : 'outline'}
              onClick={() => setRoleFilter('all')}
              size="default"
              className="text-base px-4 py-5"
              style={roleFilter === 'all' ? { backgroundColor: '#007E8C' } : {}}
            >
              All Roles ({opportunities.length})
            </Button>
            <Button
              variant={roleFilter === 'speaker' ? 'default' : 'outline'}
              onClick={() => setRoleFilter('speaker')}
              size="default"
              className="text-base px-4 py-5"
              style={roleFilter === 'speaker' ? { backgroundColor: '#007E8C' } : {}}
            >
              Speaker Needed
            </Button>
            <Button
              variant={roleFilter === 'volunteer' ? 'default' : 'outline'}
              onClick={() => setRoleFilter('volunteer')}
              size="default"
              className="text-base px-4 py-5"
              style={roleFilter === 'volunteer' ? { backgroundColor: '#007E8C' } : {}}
            >
              Volunteer Needed
            </Button>
          </div>
        </div>
      </div>

      {/* Conditional View Rendering */}
      {viewMode === 'calendar' ? (
        <div className="bg-white rounded-lg p-4">
          <EventCalendarView
            events={opportunities}
            filterByNeeds={true}
            onEventClick={(event) => {
              // Scroll to card in card view
              setViewMode('card');
              setTimeout(() => {
                const cardElement = document.querySelector(`[data-event-id="${event.id}"]`);
                if (cardElement) {
                  cardElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
              }, 100);
            }}
          />
        </div>
      ) : viewMode === 'map' ? (
        <div className="bg-white rounded-lg overflow-hidden" style={{ height: '600px' }}>
          <VolunteerOpportunitiesMap
            events={opportunities}
            onEventClick={(event) => {
              // Scroll to card in card view
              setViewMode('card');
              setTimeout(() => {
                const cardElement = document.querySelector(`[data-event-id="${event.id}"]`);
                if (cardElement) {
                  cardElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
              }, 100);
            }}
          />
        </div>
      ) : opportunities.length === 0 ? (
        <Card className="bg-gray-50">
          <CardContent className="py-12 text-center">
            <Users className="mx-auto h-16 w-16 text-gray-400 mb-6" />
            <p className="text-xl text-gray-600 font-semibold mb-3">
              {roleFilter === 'all'
                ? 'No volunteer opportunities available at this time'
                : `No ${roleFilter} opportunities available at this time`}
            </p>
            <p className="text-base text-gray-500 mt-2">
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
                data-event-id={request.id}
                className="hover:shadow-lg transition-shadow border-2 max-w-full overflow-hidden"
                style={{ borderColor: '#007E8C', backgroundColor: '#f0f9fa' }}
              >
                <CardContent className="p-8 space-y-6">
                  {/* Header */}
                  <div className="flex items-start justify-between gap-4 pb-4 border-b-4" style={{ borderColor: '#007E8C' }}>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-3xl font-bold leading-tight break-words" style={{ color: '#1A2332' }}>
                        {request.organizationName}
                        {request.department && (
                          <span className="text-xl text-gray-600 font-medium ml-3">
                            &bull; {request.department}
                          </span>
                        )}
                      </h3>

                      {/* Roles Needed */}
                      <div className="flex gap-3 flex-wrap mt-4">
                        {needsSpeaker && (
                          <Badge className="bg-blue-600 text-white hover:bg-blue-700 text-base px-4 py-2 font-semibold">
                            Speaker Needed
                          </Badge>
                        )}
                        {needsVolunteer && (
                          <Badge className="bg-green-600 text-white hover:bg-green-700 text-base px-4 py-2 font-semibold">
                            Volunteer Needed
                          </Badge>
                        )}
                        {request.isConfirmed && (
                          <Badge style={{ backgroundColor: '#007E8C' }} className="text-white text-base px-4 py-2 font-semibold">
                            ✓ Date Confirmed
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Event Details - Prominent */}
                  <div className="space-y-5 p-6 rounded-lg border-3" style={{ backgroundColor: 'white', borderColor: '#007E8C' }}>
                    <div className="flex items-start gap-4">
                      <Calendar className="h-7 w-7 mt-1 flex-shrink-0" style={{ color: '#007E8C' }} />
                      <div>
                        <div className="font-bold text-xl leading-tight" style={{ color: '#1A2332' }}>
                          {formatEventDate(request)}
                        </div>
                        <div className="text-gray-700 font-semibold text-lg mt-1">
                          {formatEventTime(request)}
                        </div>
                      </div>
                    </div>

                    {request.location && (
                      <div className="flex items-start gap-4">
                        <MapPin className="h-7 w-7 mt-1 flex-shrink-0" style={{ color: '#007E8C' }} />
                        <div className="text-gray-900 font-semibold text-lg break-words">{request.location}</div>
                      </div>
                    )}

                    <div className="flex items-start gap-4">
                      <Sandwich className="h-7 w-7 mt-1 flex-shrink-0" style={{ color: '#007E8C' }} />
                      <div className="text-gray-900 font-semibold text-lg break-words">{getSandwichSummary(request)}</div>
                    </div>
                  </div>

                  {/* Two Column Layout for Contact and Planning Notes */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5 min-w-0">
                    {/* Contact Info */}
                    <div className="space-y-3 text-gray-700 p-5 bg-white rounded-lg border-2 border-gray-300 min-w-0">
                      <div className="font-bold text-lg text-gray-900 mb-3 flex items-center gap-2">
                        <User className="h-6 w-6" />
                        Contact Info
                      </div>
                      {request.name && (
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-base">{request.name}</span>
                        </div>
                      )}
                      {request.email && (
                        <div className="flex items-center gap-3">
                          <Mail className="h-5 w-5 flex-shrink-0" />
                          <a
                            href={`mailto:${request.email}`}
                            className="hover:underline text-base font-medium break-all"
                            style={{ color: '#007E8C' }}
                          >
                            {request.email}
                          </a>
                        </div>
                      )}
                      {request.phone && (
                        <div className="flex items-center gap-3">
                          <Phone className="h-5 w-5 flex-shrink-0" />
                          <a
                            href={`tel:${request.phone}`}
                            className="hover:underline text-lg font-semibold"
                            style={{ color: '#007E8C' }}
                          >
                            {request.phone}
                          </a>
                        </div>
                      )}
                    </div>

                    {/* Planning Notes */}
                    {request.planningNotes && (
                      <div className="space-y-3 p-5 rounded-lg border-2 min-w-0" style={{ backgroundColor: '#e6f4f6', borderColor: '#007E8C' }}>
                        <div className="font-bold text-lg text-gray-900 mb-3 flex items-center gap-2">
                          <Info className="h-6 w-6" style={{ color: '#007E8C' }} />
                          Planning Notes
                        </div>
                        <div className="text-gray-800 whitespace-pre-wrap break-words text-base leading-relaxed font-medium">
                          {request.planningNotes}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Sign Up Actions - Large, Prominent Buttons */}
                  <div className="flex gap-4 pt-6 border-t-4" style={{ borderColor: '#007E8C' }}>
                    {needsSpeaker && (
                      <Button
                        onClick={() => handleSelfSignup(request.id, 'speaker')}
                        disabled={isSpeakerSignedUp || !canSelfSignup('speaker')}
                        className="flex-1 text-xl py-8 font-bold rounded-lg"
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
                        className="flex-1 text-xl py-8 font-bold rounded-lg"
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
                    <div className="text-base text-gray-700 pt-4 border-t-2 border-gray-300 bg-gray-50 p-5 rounded-lg">
                      <div className="flex gap-6 flex-wrap">
                        {request.speakerId && (
                          <div>
                            <span className="font-bold text-lg">Speaker:</span>{' '}
                            <span className="font-semibold text-lg">{resolveUserName(request.speakerId)}</span>
                          </div>
                        )}
                        {request.volunteerId && (
                          <div>
                            <span className="font-bold text-lg">Volunteer:</span>{' '}
                            <span className="font-semibold text-lg">{resolveUserName(request.volunteerId)}</span>
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
