import { useQuery } from '@tanstack/react-query';
import { Users, Calendar, MapPin, ArrowRight, Sparkles } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatDateShort } from '@/lib/date-utils';
import { getVolunteerCount, getTotalDriverCount, getSpeakerCount } from '@/lib/assignment-utils';
import type { EventRequest } from '@shared/schema';
import { getEffectiveEventDate } from '@shared/event-validation-utils';
import { isScheduledOrRescheduled } from '@shared/event-status-workflow';
import { parseDateOnly } from '@shared/date-utils';

// Whole-day difference between an event's date and today, parsing the
// date-only value as a local date (parseDateOnly) so YYYY-MM-DD isn't shifted
// to the previous day by UTC-midnight interpretation in Eastern time.
const daysUntil = (request: EventRequest): number => {
  const date = getEffectiveEventDate(request);
  const parsed = date ? parseDateOnly(date) : null;
  if (!parsed) return Infinity;
  const today = new Date();
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.round((parsed.getTime() - startOfToday.getTime()) / (1000 * 60 * 60 * 24));
};

interface VolunteerOpportunitiesSpotlightProps {
  onNavigate: (section: string) => void;
}

interface UnfilledNeeds {
  needsSpeaker: boolean;
  needsVolunteer: boolean;
  needsDriver: boolean;
  speakersNeeded: number;
  volunteersNeeded: number;
  driversNeeded: number;
}

const getUnfilledNeeds = (request: EventRequest): UnfilledNeeds => {
  const speakersNeededCount = request.speakersNeeded ?? 0;
  const speakersAssignedCount = getSpeakerCount(request);
  const needsSpeaker = speakersNeededCount > speakersAssignedCount;
  const speakersNeeded = Math.max(0, speakersNeededCount - speakersAssignedCount);

  const volunteersNeededCount = request.volunteersNeeded ?? 0;
  const volunteersAssignedCount = getVolunteerCount(request);
  const needsVolunteer = volunteersNeededCount > volunteersAssignedCount;
  const volunteersNeeded = Math.max(0, volunteersNeededCount - volunteersAssignedCount);

  const driversNeededCount = request.driversNeeded ?? 0;
  const driversAssignedCount = getTotalDriverCount(request);
  const needsDriver = driversNeededCount > driversAssignedCount;
  const driversNeeded = Math.max(0, driversNeededCount - driversAssignedCount);

  return { needsSpeaker, needsVolunteer, needsDriver, speakersNeeded, volunteersNeeded, driversNeeded };
};

// Color-code each opportunity by how soon it is, so understaffed events that
// are nearly here read as urgent at a glance: Red = within 3 days (critical),
// Amber = within a week (needs help soon), teal = further out.
type Urgency = { level: 'critical' | 'soon' | 'upcoming'; label: string; badgeClass: string; borderClass: string };

const getUrgency = (request: EventRequest): Urgency => {
  const days = daysUntil(request);
  if (days <= 3) {
    return { level: 'critical', label: 'Critical', badgeClass: 'bg-red-100 text-red-800', borderClass: 'border-l-red-500' };
  }
  if (days <= 7) {
    return { level: 'soon', label: 'Needs help soon', badgeClass: 'bg-amber-100 text-amber-800', borderClass: 'border-l-amber-500' };
  }
  return { level: 'upcoming', label: 'Upcoming', badgeClass: 'bg-[#007E8C]/10 text-[#007E8C]', borderClass: 'border-l-[#007E8C]' };
};

export function VolunteerOpportunitiesSpotlight({ onNavigate }: VolunteerOpportunitiesSpotlightProps) {
  const { data: eventRequests = [], isLoading } = useQuery<EventRequest[]>({
    queryKey: ['/api/event-requests'],
    staleTime: 60 * 1000,
  });

  const opportunities = eventRequests
    .filter((request) => isScheduledOrRescheduled(request.status))
    .filter((request) => {
      const { needsSpeaker, needsVolunteer, needsDriver } = getUnfilledNeeds(request);
      return needsSpeaker || needsVolunteer || needsDriver;
    })
    .sort((a, b) => {
      const dateA = getEffectiveEventDate(a);
      const dateB = getEffectiveEventDate(b);
      const timeA = dateA ? (parseDateOnly(dateA)?.getTime() ?? Infinity) : Infinity;
      const timeB = dateB ? (parseDateOnly(dateB)?.getTime() ?? Infinity) : Infinity;
      return timeA - timeB;
    })
    .slice(0, 3);

  const formatEventDate = (request: EventRequest) => {
    const date = getEffectiveEventDate(request);
    return formatDateShort(date);
  };

  if (isLoading) {
    return (
      <div className="premium-card-elevated p-6 mx-4 mb-8 animate-pulse" style={{ borderTop: '4px solid #007E8C' }}>
        <div className="h-8 bg-gray-200 rounded w-64 mb-4"></div>
        <div className="space-y-3">
          <div className="h-20 bg-gray-100 rounded"></div>
          <div className="h-20 bg-gray-100 rounded"></div>
        </div>
      </div>
    );
  }

  if (opportunities.length === 0) {
    return (
      <div className="premium-card-elevated p-6 mx-4 mb-8" style={{ borderTop: '4px solid #007E8C' }}>
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
            <Users className="w-6 h-6 text-green-600" />
          </div>
          <div>
            <h3 className="premium-text-h4 text-[#007E8C]">Volunteer Opportunities</h3>
            <p className="premium-text-body-sm text-gray-600">
              🎉 Every upcoming event is fully staffed — nothing needs volunteers right now.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="premium-card-elevated p-6 mx-4 mb-8" style={{ borderTop: '4px solid #007E8C' }}>
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-[#007E8C] rounded-lg flex items-center justify-center">
            <Users className="w-6 h-6 text-white" />
          </div>
          <div>
            <h3 className="premium-text-h3 text-[#007E8C] flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-[#FBAD3F]" />
              Volunteer Opportunities
            </h3>
            <p className="premium-text-body-sm text-gray-600">
              Upcoming events that need your help
            </p>
          </div>
        </div>
        <button
          onClick={() => onNavigate('event-requests')}
          className="premium-btn-outline text-sm hidden sm:flex"
          data-testid="button-view-all-opportunities"
        >
          View All
          <ArrowRight className="w-4 h-4 ml-1" />
        </button>
      </div>

      <div className="space-y-3">
        {opportunities.map((event) => {
          const needs = getUnfilledNeeds(event);
          const urgency = getUrgency(event);
          return (
            <Card
              key={event.id}
              className={`hover:shadow-md transition-shadow cursor-pointer border-l-4 ${urgency.borderClass}`}
              onClick={() => onNavigate('event-requests')}
              data-testid={`opportunity-card-${event.id}`}
            >
              <CardContent className="p-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h4 className="font-semibold text-[#236383] truncate">
                        {event.organizationName}
                      </h4>
                      {urgency.level !== 'upcoming' && (
                        <Badge className={`${urgency.badgeClass} flex-shrink-0`}>
                          {urgency.label}
                        </Badge>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-600 mt-1">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-4 h-4" />
                        {formatEventDate(event)}
                      </span>
                      {event.address && (
                        <span className="flex items-center gap-1 truncate">
                          <MapPin className="w-4 h-4 flex-shrink-0" />
                          <span className="truncate">{event.address.split(',')[0]}</span>
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {needs.needsSpeaker && (
                      <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-200">
                        {needs.speakersNeeded} Speaker{needs.speakersNeeded > 1 ? 's' : ''} Needed
                      </Badge>
                    )}
                    {needs.needsVolunteer && (
                      <Badge className="bg-green-100 text-green-800 hover:bg-green-200">
                        {needs.volunteersNeeded} Volunteer{needs.volunteersNeeded > 1 ? 's' : ''} Needed
                      </Badge>
                    )}
                    {needs.needsDriver && (
                      <Badge className="bg-purple-100 text-purple-800 hover:bg-purple-200">
                        {needs.driversNeeded} Driver{needs.driversNeeded > 1 ? 's' : ''} Needed
                      </Badge>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="mt-4 pt-4 border-t border-gray-100 flex items-center justify-between">
        <p className="text-sm text-gray-500">
          {opportunities.length < eventRequests.filter(r => isScheduledOrRescheduled(r.status) && (getUnfilledNeeds(r).needsSpeaker || getUnfilledNeeds(r).needsVolunteer || getUnfilledNeeds(r).needsDriver)).length
            ? `Showing ${opportunities.length} of ${eventRequests.filter(r => isScheduledOrRescheduled(r.status) && (getUnfilledNeeds(r).needsSpeaker || getUnfilledNeeds(r).needsVolunteer || getUnfilledNeeds(r).needsDriver)).length} opportunities`
            : `${opportunities.length} upcoming opportunity${opportunities.length !== 1 ? 'ies' : 'y'}`}
        </p>
        <button
          onClick={() => onNavigate('event-requests')}
          className="premium-btn-primary text-sm sm:hidden"
          data-testid="button-view-all-opportunities-mobile"
        >
          View All Opportunities
        </button>
      </div>
    </div>
  );
}
