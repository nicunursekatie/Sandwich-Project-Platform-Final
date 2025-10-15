import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  AlertTriangle,
  TrendingUp,
  Target,
  Calendar,
  Users,
  CheckCircle,
  ArrowRight,
  Clock,
  MapPin,
} from 'lucide-react';
import type { SandwichCollection } from '@shared/schema';
import {
  calculateTotalSandwiches,
  parseCollectionDate,
} from '@/lib/analytics-utils';

interface ActionItem {
  id: string;
  priority: 'high' | 'medium' | 'low';
  category: 'volunteer-recruitment' | 'scheduling' | 'recognition' | 'planning';
  title: string;
  description: string;
  impact: string;
  action: string;
  data?: any;
}

export default function ActionCenter() {
  // Fetch collections data
  const { data: collectionsData } = useQuery<{ collections: SandwichCollection[] }>({
    queryKey: ['/api/sandwich-collections/all'],
    queryFn: async () => {
      const response = await fetch('/api/sandwich-collections?limit=5000');
      if (!response.ok) throw new Error('Failed to fetch collections');
      return response.json();
    },
  });

  // Fetch event requests for forward-looking insights
  const { data: eventRequests } = useQuery<any[]>({
    queryKey: ['/api/event-requests'],
    queryFn: async () => {
      const response = await fetch('/api/event-requests?all=true');
      if (!response.ok) throw new Error('Failed to fetch event requests');
      return response.json();
    },
  });

  const collections = collectionsData?.collections || [];

  // Calculate actionable insights focused on forward-looking event forecasting
  const actionItems = useMemo((): ActionItem[] => {
    if (!collections.length) return [];

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const currentMonth = today.getMonth();
    const currentYear = today.getFullYear();
    const dayOfWeek = today.getDay();

    // Current week analysis (Wed-Tue)
    const currentWeekStart = new Date(today);
    const daysFromWednesday = (dayOfWeek + 4) % 7;
    currentWeekStart.setDate(today.getDate() - daysFromWednesday);
    currentWeekStart.setHours(0, 0, 0, 0);

    const currentWeekEnd = new Date(currentWeekStart);
    currentWeekEnd.setDate(currentWeekStart.getDate() + 6);
    currentWeekEnd.setHours(23, 59, 59, 999);

    // Get ALL collections for current week (past AND future dates)
    const currentWeekCollections = collections.filter((c) => {
      const date = parseCollectionDate(c.collectionDate);
      return date >= currentWeekStart && date <= currentWeekEnd;
    });

    const currentWeekTotal = currentWeekCollections.reduce(
      (sum, c) => sum + calculateTotalSandwiches(c),
      0
    );

    // Calculate weekly average (Wed-Tue weeks)
    const weekMap = new Map<string, number>();
    collections.forEach((c) => {
      const date = parseCollectionDate(c.collectionDate);
      const weekStart = new Date(date);
      const collectionDayOfWeek = date.getDay();
      const daysFromWed = (collectionDayOfWeek + 4) % 7;
      weekStart.setDate(date.getDate() - daysFromWed);
      const weekKey = weekStart.toISOString().split('T')[0];
      const current = weekMap.get(weekKey) || 0;
      weekMap.set(weekKey, current + calculateTotalSandwiches(c));
    });

    const weeklyTotals = Array.from(weekMap.values());
    const avgWeekly = weeklyTotals.length > 0
      ? weeklyTotals.reduce((a, b) => a + b, 0) / weeklyTotals.length
      : 0;

    const daysElapsedInWeek = (dayOfWeek + 4) % 7 + 1;
    const projectedWeekTotal = currentWeekTotal > 0
      ? Math.round((currentWeekTotal / daysElapsedInWeek) * 7)
      : currentWeekTotal;

    const actions: ActionItem[] = [];

    // ============================================================
    // CATEGORY 1: FOLLOW-UP & ENGAGEMENT
    // ============================================================

    // Find completed events needing 1-day follow-up
    const completedEventsNeeding1Day = (eventRequests || []).filter((event) => {
      if (event.status !== 'completed') return false;
      if (!event.desiredEventDate) return false;
      if (event.followUpOneDayCompleted) return false;

      const eventDate = new Date(event.desiredEventDate);
      const oneDayAgo = new Date(today);
      oneDayAgo.setDate(today.getDate() - 1);

      // Flag events from yesterday or earlier that need 1-day follow-up
      return eventDate <= oneDayAgo;
    });

    if (completedEventsNeeding1Day.length > 0) {
      actions.push({
        id: 'followup-1day-needed',
        priority: 'high',
        category: 'recognition',
        title: `${completedEventsNeeding1Day.length} Event${completedEventsNeeding1Day.length !== 1 ? 's' : ''} Need 1-Day Follow-Up`,
        description: `Completed events waiting for immediate post-event feedback`,
        impact: `Timely follow-up improves retention and captures fresh feedback`,
        action: `Contact ${completedEventsNeeding1Day.slice(0, 3).map(e => e.organizationName).join(', ')}${completedEventsNeeding1Day.length > 3 ? ` and ${completedEventsNeeding1Day.length - 3} more` : ''}`,
        data: { events: completedEventsNeeding1Day },
      });
    }

    // Find completed events needing 1-month follow-up (events 30+ days ago)
    const oneMonthAgo = new Date(today);
    oneMonthAgo.setDate(today.getDate() - 30);

    const completedEventsNeeding1Month = (eventRequests || []).filter((event) => {
      if (event.status !== 'completed') return false;
      if (!event.desiredEventDate) return false;
      if (event.followUpOneMonthCompleted) return false;

      const eventDate = new Date(event.desiredEventDate);
      return eventDate <= oneMonthAgo;
    });

    if (completedEventsNeeding1Month.length > 0) {
      actions.push({
        id: 'followup-1month-needed',
        priority: 'medium',
        category: 'recognition',
        title: `${completedEventsNeeding1Month.length} Event${completedEventsNeeding1Month.length !== 1 ? 's' : ''} Need 1-Month Follow-Up`,
        description: `Events from 30+ days ago waiting for long-term feedback`,
        impact: `Monthly follow-ups help assess long-term impact and build relationships`,
        action: `Schedule follow-up calls with ${completedEventsNeeding1Month.slice(0, 3).map(e => e.organizationName).join(', ')}${completedEventsNeeding1Month.length > 3 ? ` and ${completedEventsNeeding1Month.length - 3} more` : ''}`,
        data: { events: completedEventsNeeding1Month },
      });
    }

    // Find inactive hosts (haven't collected in 30+ days)
    const thirtyDaysAgo = new Date(today);
    thirtyDaysAgo.setDate(today.getDate() - 30);

    const recentHostNames = new Set(
      collections
        .filter((c) => {
          const date = parseCollectionDate(c.collectionDate);
          return date >= thirtyDaysAgo;
        })
        .map((c) => c.hostName)
    );

    const olderCollections = collections.filter((c) => {
      const date = parseCollectionDate(c.collectionDate);
      return date < thirtyDaysAgo;
    });

    const inactiveHosts = new Set<string>();
    olderCollections.forEach((c) => {
      if (c.hostName && !recentHostNames.has(c.hostName)) {
        inactiveHosts.add(c.hostName);
      }
    });

    if (inactiveHosts.size > 0 && inactiveHosts.size <= 10) {
      actions.push({
        id: 'inactive-hosts',
        priority: 'medium',
        category: 'volunteer-recruitment',
        title: `${inactiveHosts.size} Host${inactiveHosts.size !== 1 ? 's' : ''} Inactive for 30+ Days`,
        description: `Previously active collection hosts haven't reported recently`,
        impact: `Re-engaging ${inactiveHosts.size} hosts could add ${Math.round((inactiveHosts.size * avgWeekly) / recentHostNames.size / 4)} sandwiches/week`,
        action: `Reach out to check in: ${Array.from(inactiveHosts).slice(0, 3).join(', ')}${inactiveHosts.size > 3 ? ` and ${inactiveHosts.size - 3} more` : ''}`,
        data: { hosts: Array.from(inactiveHosts) },
      });
    }

    // ============================================================
    // CATEGORY 2: PLANNING & LOGISTICS
    // ============================================================

    // Find upcoming events (next 14 days) missing driver assignments
    const twoWeeksFromNow = new Date(today);
    twoWeeksFromNow.setDate(today.getDate() + 14);

    const upcomingEventsMissingDrivers = (eventRequests || []).filter((event) => {
      if (!['in_process', 'scheduled'].includes(event.status)) return false;
      if (!event.desiredEventDate) return false;
      if ((event.driversNeeded || 0) === 0) return false; // No drivers needed

      const eventDate = new Date(event.desiredEventDate);
      if (eventDate < today || eventDate > twoWeeksFromNow) return false;

      // Check if drivers are assigned
      const assignedDrivers = event.assignedDriverIds || [];
      const driversNeeded = event.driversNeeded || 0;

      return assignedDrivers.length < driversNeeded;
    });

    if (upcomingEventsMissingDrivers.length > 0) {
      const totalDriversNeeded = upcomingEventsMissingDrivers.reduce((sum, e) => {
        const assigned = (e.assignedDriverIds || []).length;
        const needed = e.driversNeeded || 0;
        return sum + (needed - assigned);
      }, 0);

      actions.push({
        id: 'missing-drivers',
        priority: 'high',
        category: 'scheduling',
        title: `${upcomingEventsMissingDrivers.length} Upcoming Event${upcomingEventsMissingDrivers.length !== 1 ? 's' : ''} Need Driver${totalDriversNeeded !== 1 ? 's' : ''}`,
        description: `Events in next 2 weeks need ${totalDriversNeeded} more driver${totalDriversNeeded !== 1 ? 's' : ''}`,
        impact: `Transportation is critical - events can't happen without drivers`,
        action: `Assign drivers for ${upcomingEventsMissingDrivers.slice(0, 3).map(e => e.organizationName).join(', ')}${upcomingEventsMissingDrivers.length > 3 ? ` and ${upcomingEventsMissingDrivers.length - 3} more` : ''}`,
        data: { events: upcomingEventsMissingDrivers, driversNeeded: totalDriversNeeded },
      });
    }

    // Find upcoming events missing speaker assignments
    const upcomingEventsMissingSpeakers = (eventRequests || []).filter((event) => {
      if (!['in_process', 'scheduled'].includes(event.status)) return false;
      if (!event.desiredEventDate) return false;
      if ((event.speakersNeeded || 0) === 0) return false;

      const eventDate = new Date(event.desiredEventDate);
      if (eventDate < today || eventDate > twoWeeksFromNow) return false;

      const assignedSpeakers = event.assignedSpeakerIds || [];
      const speakersNeeded = event.speakersNeeded || 0;

      return assignedSpeakers.length < speakersNeeded;
    });

    if (upcomingEventsMissingSpeakers.length > 0) {
      const totalSpeakersNeeded = upcomingEventsMissingSpeakers.reduce((sum, e) => {
        const assigned = (e.assignedSpeakerIds || []).length;
        const needed = e.speakersNeeded || 0;
        return sum + (needed - assigned);
      }, 0);

      actions.push({
        id: 'missing-speakers',
        priority: 'medium',
        category: 'scheduling',
        title: `${upcomingEventsMissingSpeakers.length} Upcoming Event${upcomingEventsMissingSpeakers.length !== 1 ? 's' : ''} Need Speaker${totalSpeakersNeeded !== 1 ? 's' : ''}`,
        description: `Events in next 2 weeks need ${totalSpeakersNeeded} more speaker${totalSpeakersNeeded !== 1 ? 's' : ''}`,
        impact: `Speakers help share the mission and recruit future volunteers`,
        action: `Assign speakers for ${upcomingEventsMissingSpeakers.slice(0, 3).map(e => e.organizationName).join(', ')}${upcomingEventsMissingSpeakers.length > 3 ? ` and ${upcomingEventsMissingSpeakers.length - 3} more` : ''}`,
        data: { events: upcomingEventsMissingSpeakers, speakersNeeded: totalSpeakersNeeded },
      });
    }

    // Find large upcoming events (500+ sandwiches) that might need extra support
    const largeUpcomingEvents = (eventRequests || []).filter((event) => {
      if (!['in_process', 'scheduled'].includes(event.status)) return false;
      if (!event.desiredEventDate) return false;
      if ((event.estimatedSandwichCount || 0) < 500) return false;

      const eventDate = new Date(event.desiredEventDate);
      return eventDate >= today && eventDate <= twoWeeksFromNow;
    });

    if (largeUpcomingEvents.length > 0) {
      actions.push({
        id: 'large-events-support',
        priority: 'medium',
        category: 'planning',
        title: `${largeUpcomingEvents.length} Large Event${largeUpcomingEvents.length !== 1 ? 's' : ''} Coming Up`,
        description: `Events with 500+ sandwiches in next 2 weeks may need extra coordination`,
        impact: `Large events require additional volunteers and planning`,
        action: `Review logistics for ${largeUpcomingEvents.map(e => `${e.organizationName} (${e.estimatedSandwichCount})`).join(', ')}`,
        data: { events: largeUpcomingEvents },
      });
    }

    // Calculate average collections by day of week for forecasting
    const dayOfWeekTotals = new Map<number, { total: number; count: number }>();
    collections.forEach((c) => {
      const date = parseCollectionDate(c.collectionDate);
      const dow = date.getDay();
      const current = dayOfWeekTotals.get(dow) || { total: 0, count: 0 };
      dayOfWeekTotals.set(dow, {
        total: current.total + calculateTotalSandwiches(c),
        count: current.count + 1,
      });
    });

    // Look ahead at next 4 weeks and forecast based on scheduled events + expected individual donations
    for (let weekOffset = 0; weekOffset < 4; weekOffset++) {
      const weekStart = new Date(currentWeekStart);
      weekStart.setDate(currentWeekStart.getDate() + (weekOffset * 7));

      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6);
      weekEnd.setHours(23, 59, 59, 999);

      // For current week, only calculate expected donations for remaining days
      const isCurrentWeek = weekOffset === 0;
      const startDay = isCurrentWeek ? today : weekStart;

      // Get scheduled events for this week (include completed for accurate totals)
      const scheduledThisWeek = (eventRequests || []).filter((event) => {
        if (!event.desiredEventDate) return false;
        if (!['in_process', 'scheduled', 'completed'].includes(event.status)) return false;

        const eventDate = new Date(event.desiredEventDate);
        return eventDate >= weekStart && eventDate <= weekEnd;
      });

      const scheduledTotal = scheduledThisWeek.reduce(
        (sum, event) => sum + (event.estimatedSandwichCount || 0),
        0
      );

      // Calculate expected individual donations for the week (or remaining days)
      let expectedIndividualDonations = 0;
      const currentDate = new Date(startDay);
      while (currentDate <= weekEnd) {
        const dow = currentDate.getDay();
        const dayData = dayOfWeekTotals.get(dow);
        if (dayData && dayData.count > 0) {
          expectedIndividualDonations += dayData.total / dayData.count;
        }
        currentDate.setDate(currentDate.getDate() + 1);
      }

      // Total forecast = scheduled events + expected individual donations + already collected (if current week)
      const alreadyCollected = isCurrentWeek ? currentWeekTotal : 0;
      const totalForecast = alreadyCollected + scheduledTotal + Math.round(expectedIndividualDonations);

      // Get historical average for comparison
      const historicalWeeks = Array.from(weekMap.values());
      const avgForWeek = historicalWeeks.length > 0
        ? historicalWeeks.reduce((a, b) => a + b, 0) / historicalWeeks.length
        : avgWeekly;

      // Flag if total forecast is significantly below average
      const gap = avgForWeek - totalForecast;
      const percentBelow = avgForWeek > 0 ? (gap / avgForWeek) * 100 : 0;

      // Debug logging for action center
      if (weekOffset === 0) {
        console.log('=== ACTION CENTER DEBUG (Current Week) ===');
        console.log('Total forecast:', totalForecast);
        console.log('Already collected:', alreadyCollected);
        console.log('Scheduled events total:', scheduledTotal);
        console.log('Expected individual donations:', Math.round(expectedIndividualDonations));
        console.log('Average weekly:', avgForWeek);
        console.log('Gap:', gap);
        console.log('Percent below:', percentBelow.toFixed(1) + '%');
        console.log('Would flag?', gap > 500 && percentBelow > 20);
      }

      // Only show "below average" warnings if we're past Wednesday (day 3) OR if it's a future week
      // Early in the week, we'll show planned group collections instead
      const shouldShowBelowAverageWarning = weekOffset > 0 || dayOfWeek >= 3;

      if (gap > 500 && percentBelow > 20 && shouldShowBelowAverageWarning) {
        const weekLabel = weekOffset === 0 ? 'This Week' :
                         weekOffset === 1 ? 'Next Week' :
                         `Week of ${weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;

        actions.push({
          id: `low-forecast-week-${weekOffset}`,
          priority: weekOffset === 0 ? 'high' : weekOffset === 1 ? 'high' : 'medium',
          category: 'volunteer-recruitment',
          title: `${weekLabel}: Forecasted Below Average`,
          description: `Forecast ${totalForecast.toLocaleString()} sandwiches vs ${Math.round(avgForWeek).toLocaleString()} average`,
          impact: `Need ${Math.round(gap).toLocaleString()} more sandwiches to reach typical week`,
          action: `Recruit volunteers for collections during ${weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${weekEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`,
          data: { weekStart, weekEnd, totalForecast, scheduledTotal, expectedIndividualDonations: Math.round(expectedIndividualDonations), avgForWeek, gap, scheduledEventCount: scheduledThisWeek.length },
        });
      }
    }

    // Early in the week (Sun-Tue, days 0-2): Show helpful info about planned group collections
    // Later in the week (Wed+, days 3+): Show pace warnings if behind
    const alreadyFlaggedThisWeek = actions.some(a => a.id === 'low-forecast-week-0');

    if (dayOfWeek < 3 && !alreadyFlaggedThisWeek) {
      // Early week: Show planned group collections to help prioritize individual recruitment
      const plannedCollectionsThisWeek = currentWeekCollections.filter((c) => {
        const date = parseCollectionDate(c.collectionDate);
        return date > today;
      });

      const plannedGroupTotal = plannedCollectionsThisWeek.reduce((sum, c) => {
        // Count group collections only (exclude individual)
        const groupTotal = (c.groupCollections || []).reduce((gsum, g) => gsum + (g.sandwichCount || 0), 0);
        return sum + groupTotal;
      }, 0);

      // Get scheduled events for this week
      const scheduledThisWeek = (eventRequests || []).filter((event) => {
        if (!event.desiredEventDate) return false;
        if (!['in_process', 'scheduled', 'completed'].includes(event.status)) return false;
        const eventDate = new Date(event.desiredEventDate);
        return eventDate >= currentWeekStart && eventDate <= currentWeekEnd;
      });

      const scheduledEventTotal = scheduledThisWeek.reduce(
        (sum, event) => sum + (event.estimatedSandwichCount || 0),
        0
      );

      const totalPlanned = plannedGroupTotal + scheduledEventTotal;
      const needFromIndividual = Math.max(0, Math.round(avgWeekly - currentWeekTotal - totalPlanned));

      // Show this insight if we have meaningful data
      if (totalPlanned > 0 || needFromIndividual > 0) {
        const weekdays = ['Sunday', 'Monday', 'Tuesday'];
        const dayName = weekdays[dayOfWeek];

        actions.push({
          id: 'early-week-planning',
          priority: needFromIndividual > 2000 ? 'high' : 'medium',
          category: 'planning',
          title: `Week Outlook (${dayName})`,
          description: `${totalPlanned.toLocaleString()} sandwiches from ${plannedCollectionsThisWeek.length + scheduledThisWeek.length} planned group collections/events`,
          impact: `Need ~${needFromIndividual.toLocaleString()} from individual collections to reach weekly average (${Math.round(avgWeekly).toLocaleString()})`,
          action: needFromIndividual > 2000
            ? 'High individual recruitment priority this week'
            : 'Moderate individual recruitment needed this week',
          data: {
            currentWeekTotal,
            plannedGroupTotal,
            scheduledEventTotal,
            totalPlanned,
            avgWeekly,
            needFromIndividual,
            plannedCollectionsCount: plannedCollectionsThisWeek.length,
            scheduledEventCount: scheduledThisWeek.length
          },
        });
      }
    } else if (dayOfWeek >= 3 && !alreadyFlaggedThisWeek) {
      // Later in week: Show pace warnings if behind
      const weeklyGap = avgWeekly - projectedWeekTotal;

      if (weeklyGap > 500) {
        actions.push({
          id: 'weekly-pace',
          priority: 'high',
          category: 'volunteer-recruitment',
          title: 'Weekly Collections Below Average Pace',
          description: `Currently tracking ${Math.abs(Math.round((weeklyGap / avgWeekly) * 100))}% below typical weekly collections`,
          impact: `Need ~${Math.round(weeklyGap)} more sandwiches to reach average week`,
          action: 'Recruit volunteers for end-of-week collections',
          data: { currentWeekTotal, projectedWeekTotal, avgWeekly, gap: weeklyGap },
        });
      }
    }

    // ============================================================
    // CATEGORY 3: GROWTH OPPORTUNITIES
    // ============================================================

    // Compare current month to same month last year
    const lastYearMonth = currentMonth;
    const lastYear = currentYear - 1;

    const currentMonthCollections = collections.filter((c) => {
      const date = parseCollectionDate(c.collectionDate);
      return date.getMonth() === currentMonth && date.getFullYear() === currentYear;
    });

    const lastYearSameMonthCollections = collections.filter((c) => {
      const date = parseCollectionDate(c.collectionDate);
      return date.getMonth() === lastYearMonth && date.getFullYear() === lastYear;
    });

    const currentMonthTotal = currentMonthCollections.reduce(
      (sum, c) => sum + calculateTotalSandwiches(c),
      0
    );

    const lastYearSameMonthTotal = lastYearSameMonthCollections.reduce(
      (sum, c) => sum + calculateTotalSandwiches(c),
      0
    );

    // Only flag if we have data from last year and we're significantly behind
    if (lastYearSameMonthTotal > 0) {
      const yearOverYearGap = lastYearSameMonthTotal - currentMonthTotal;
      const percentBehind = (yearOverYearGap / lastYearSameMonthTotal) * 100;

      if (yearOverYearGap > 1000 && percentBehind > 15) {
        const monthName = today.toLocaleDateString('en-US', { month: 'long' });
        actions.push({
          id: 'year-over-year-decline',
          priority: 'medium',
          category: 'planning',
          title: `${monthName} Tracking Behind Last Year`,
          description: `${Math.round(percentBehind)}% below ${monthName} ${lastYear} (${yearOverYearGap.toLocaleString()} fewer sandwiches)`,
          impact: `Identifying growth opportunities could restore momentum`,
          action: `Review what worked well in ${monthName} ${lastYear} and replicate those strategies`,
          data: { currentMonthTotal, lastYearSameMonthTotal, gap: yearOverYearGap, percentBehind },
        });
      }
    }

    // Find organizations with repeat events that could go larger
    const completedEventsLastYear = (eventRequests || []).filter((event) => {
      if (event.status !== 'completed') return false;
      if (!event.desiredEventDate) return false;

      const eventDate = new Date(event.desiredEventDate);
      return eventDate.getFullYear() === lastYear;
    });

    const orgEventCounts = new Map<string, { count: number; avgSize: number }>();

    completedEventsLastYear.forEach((event) => {
      if (!event.organizationName) return;
      const current = orgEventCounts.get(event.organizationName) || { count: 0, avgSize: 0 };
      current.count += 1;
      current.avgSize += (event.actualSandwichCount || event.estimatedSandwichCount || 0);
      orgEventCounts.set(event.organizationName, current);
    });

    // Find repeat organizations (2+ events) with small-medium events (< 300 sandwiches avg)
    const growthOpportunityOrgs: Array<{ org: string; eventCount: number; avgSize: number }> = [];

    orgEventCounts.forEach((data, org) => {
      if (data.count >= 2) {
        const avgSize = data.avgSize / data.count;
        if (avgSize > 0 && avgSize < 300) {
          growthOpportunityOrgs.push({ org, eventCount: data.count, avgSize: Math.round(avgSize) });
        }
      }
    });

    if (growthOpportunityOrgs.length > 0) {
      growthOpportunityOrgs.sort((a, b) => b.eventCount - a.eventCount);
      const topOrgs = growthOpportunityOrgs.slice(0, 3);

      actions.push({
        id: 'growth-opportunities',
        priority: 'low',
        category: 'planning',
        title: `${growthOpportunityOrgs.length} Partner${growthOpportunityOrgs.length !== 1 ? 's' : ''} Could Scale Up Events`,
        description: `Organizations with multiple small events could potentially host larger ones`,
        impact: `Growing event sizes with proven partners is easier than recruiting new ones`,
        action: `Explore expansion with ${topOrgs.map(o => `${o.org} (${o.eventCount} events, avg ${o.avgSize})`).join(', ')}`,
        data: { organizations: growthOpportunityOrgs },
      });
    }

    return actions.sort((a, b) => {
      const priorityOrder = { high: 0, medium: 1, low: 2 };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    });
  }, [collections, eventRequests]);

  const priorityColors = {
    high: 'bg-red-100 text-red-800 border-red-300',
    medium: 'bg-amber-100 text-amber-800 border-amber-300',
    low: 'bg-blue-100 text-blue-800 border-blue-300',
  };

  const categoryIcons = {
    'volunteer-recruitment': Users,
    scheduling: Calendar,
    recognition: CheckCircle,
    planning: Target,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-3xl font-bold text-brand-primary">Action Center</h2>
        <p className="text-gray-600 mt-2">
          Strategic opportunities for volunteer recruitment and program growth • {actionItems.length} insights
        </p>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">High Priority</p>
                <p className="text-2xl font-bold text-red-600">
                  {actionItems.filter((a) => a.priority === 'high').length}
                </p>
              </div>
              <AlertTriangle className="h-8 w-8 text-red-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Recruitment</p>
                <p className="text-2xl font-bold text-brand-primary">
                  {actionItems.filter((a) => a.category === 'volunteer-recruitment').length}
                </p>
              </div>
              <Users className="h-8 w-8 text-brand-primary" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Scheduling</p>
                <p className="text-2xl font-bold text-brand-teal">
                  {actionItems.filter((a) => a.category === 'scheduling').length}
                </p>
              </div>
              <Calendar className="h-8 w-8 text-brand-teal" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Recognition</p>
                <p className="text-2xl font-bold text-green-600">
                  {actionItems.filter((a) => a.category === 'recognition').length}
                </p>
              </div>
              <CheckCircle className="h-8 w-8 text-green-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Action Items */}
      <div className="space-y-4">
        {actionItems.map((item) => {
          const Icon = categoryIcons[item.category];
          return (
            <Card
              key={item.id}
              className={`border-l-4 ${
                item.priority === 'high'
                  ? 'border-l-red-500'
                  : item.priority === 'medium'
                  ? 'border-l-amber-500'
                  : 'border-l-blue-500'
              }`}
            >
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3 flex-1">
                    <Icon className="h-6 w-6 text-gray-600 mt-1" />
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <CardTitle className="text-xl">{item.title}</CardTitle>
                        <Badge className={priorityColors[item.priority]}>
                          {item.priority.toUpperCase()}
                        </Badge>
                      </div>
                      <CardDescription className="text-base">
                        {item.description}
                      </CardDescription>
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  <div className="bg-gray-50 p-3 rounded-lg">
                    <p className="text-sm text-gray-600 mb-1">Potential Impact</p>
                    <p className="font-semibold text-brand-primary">{item.impact}</p>
                  </div>
                  <div className="bg-gray-50 p-3 rounded-lg">
                    <p className="text-sm text-gray-600 mb-1">Recommended Action</p>
                    <p className="font-semibold text-brand-primary">{item.action}</p>
                  </div>
                </div>

                {/* Weekly Pace Details */}
                {item.id === 'weekly-pace' && item.data && (
                  <div className="border-t pt-4 mt-4">
                    <div className="grid grid-cols-3 gap-4 text-center">
                      <div>
                        <p className="text-sm text-gray-600">This Week So Far</p>
                        <p className="text-2xl font-bold text-brand-primary">
                          {item.data.currentWeekTotal?.toLocaleString()}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">Projected Total</p>
                        <p className="text-2xl font-bold text-amber-600">
                          {item.data.projectedWeekTotal?.toLocaleString()}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">Weekly Average</p>
                        <p className="text-2xl font-bold text-gray-700">
                          {Math.round(item.data.avgWeekly)?.toLocaleString()}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                <div className="mt-4">
                  <Button className="w-full" size="lg">
                    {item.action}
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}

        {actionItems.length === 0 && (
          <Card>
            <CardContent className="py-12 text-center">
              <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-gray-900 mb-2">
                All Caught Up!
              </h3>
              <p className="text-gray-600">
                Program is running smoothly. Keep up the great work!
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
