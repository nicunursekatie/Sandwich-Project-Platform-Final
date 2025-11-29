import { Router, type Request, type Response } from 'express';
import { db } from '../db';
import { logger } from '../middleware/logger';
import OpenAI from 'openai';

interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    role?: string;
  };
}

export const aiChatRouter = Router();

// Helper to get OpenAI client
function getOpenAIClient(): OpenAI {
  if (!process.env.AI_INTEGRATIONS_OPENAI_API_KEY) {
    throw new Error('OpenAI API key not configured');
  }
  return new OpenAI({
    apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
    baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
  });
}

// Helper to convert Date to YYYY-MM-DD string for timezone-safe comparison
function toDateString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Helper to calculate sandwich count from collection
function getCollectionSandwichCount(collection: any): number {
  let total = 0;
  total += collection.individualSandwiches || 0;

  const hasGroupCollections = collection.groupCollections &&
    Array.isArray(collection.groupCollections) &&
    collection.groupCollections.length > 0;

  if (hasGroupCollections) {
    total += collection.groupCollections.reduce(
      (sum: number, group: any) => sum + (Number(group.count) || Number(group.sandwichCount) || 0), 0
    );
  } else {
    total += collection.group1Count || 0;
    total += collection.group2Count || 0;
  }
  return total;
}

// Build context for collections
async function buildCollectionsContext(contextData?: Record<string, any>): Promise<string> {
  const allCollections = await db.query.sandwichCollections.findMany();

  // Filter out deleted collections
  const collections = allCollections.filter(c => !c.deletedAt);

  // Calculate metrics
  let totalSandwiches = 0;
  const hostStats: Record<string, { collections: number; sandwiches: number }> = {};
  const monthlyStats: Record<string, { collections: number; sandwiches: number }> = {};
  const dayOfWeekStats: Record<string, { collections: number; sandwiches: number }> = {};
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  collections.forEach(c => {
    const sandwichCount = getCollectionSandwichCount(c);
    totalSandwiches += sandwichCount;

    // Host stats
    const hostName = c.hostName || 'Unknown';
    if (!hostStats[hostName]) {
      hostStats[hostName] = { collections: 0, sandwiches: 0 };
    }
    hostStats[hostName].collections++;
    hostStats[hostName].sandwiches += sandwichCount;

    // Monthly stats
    if (c.collectionDate) {
      const date = new Date(c.collectionDate + 'T12:00:00');
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      if (!monthlyStats[monthKey]) {
        monthlyStats[monthKey] = { collections: 0, sandwiches: 0 };
      }
      monthlyStats[monthKey].collections++;
      monthlyStats[monthKey].sandwiches += sandwichCount;

      // Day of week stats
      const dayName = dayNames[date.getDay()];
      if (!dayOfWeekStats[dayName]) {
        dayOfWeekStats[dayName] = { collections: 0, sandwiches: 0 };
      }
      dayOfWeekStats[dayName].collections++;
      dayOfWeekStats[dayName].sandwiches += sandwichCount;
    }
  });

  // Average collection size
  const avgCollectionSize = collections.length > 0
    ? Math.round(totalSandwiches / collections.length)
    : 0;

  // Recent months for trend analysis (last 6 months)
  const recentMonths = Object.entries(monthlyStats)
    .sort(([a], [b]) => b.localeCompare(a))
    .slice(0, 6)
    .reverse();

  return `
## Sandwich Collection Data Summary

### Overall Metrics
- Total Collections: ${collections.length}
- Total Sandwiches Collected: ${totalSandwiches.toLocaleString()}
- Average Sandwiches Per Collection: ${avgCollectionSize}
- Number of Active Host Locations: ${Object.keys(hostStats).length}

### Collections by Month (Recent 6 Months)
${recentMonths.map(([month, stats]) => `- ${month}: ${stats.collections} collections, ${stats.sandwiches.toLocaleString()} sandwiches`).join('\n')}

### All-Time Monthly Data
${Object.entries(monthlyStats)
  .sort(([a], [b]) => a.localeCompare(b))
  .map(([month, stats]) => `- ${month}: ${stats.collections} collections, ${stats.sandwiches.toLocaleString()} sandwiches`)
  .join('\n')}

Note: Individual sandwich collections are typically logged on Wednesday or Thursday (weekly collection day is Wednesday). Day-of-week analysis is not meaningful for individual collections.
`;
}

// Helper to check missing critical info for an event
function getEventMissingInfo(event: any): string[] {
  const missing: string[] = [];

  // Check for contact info (email OR phone)
  if (!event.email && !event.phone) {
    missing.push('Contact Info');
  }

  // Check for sandwich count
  const hasSandwichCount =
    (event.estimatedSandwichCount && event.estimatedSandwichCount > 0) ||
    (event.estimatedSandwichCountMin && event.estimatedSandwichCountMin > 0) ||
    (event.estimatedSandwichCountMax && event.estimatedSandwichCountMax > 0);

  if (!hasSandwichCount) {
    missing.push('Sandwich Info');
  }

  // Check for address (skip if org is delivering themselves)
  const organizationDelivering =
    (!event.driversNeeded || event.driversNeeded === 0) && !event.vanDriverNeeded;

  if (!organizationDelivering) {
    const hasAddress =
      (event.eventAddress && event.eventAddress.trim() !== '') ||
      (event.deliveryDestination && event.deliveryDestination.trim() !== '') ||
      (event.overnightHoldingLocation && event.overnightHoldingLocation.trim() !== '');

    if (!hasAddress) {
      missing.push('Address');
    }
  }

  // If speakers needed, check for event start time
  if (event.speakersNeeded && event.speakersNeeded > 0 && !event.eventStartTime) {
    missing.push('Event Start Time');
  }

  return missing;
}

// Helper to format event date
function formatEventDate(dateInput: Date | string | null | undefined): string {
  if (!dateInput) return 'TBD';
  const date = dateInput instanceof Date ? dateInput : new Date(dateInput);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// Build context for events
async function buildEventsContext(contextData?: Record<string, any>): Promise<string> {
  const allEvents = await db.query.eventRequests.findMany();

  // Calculate metrics
  const categoryStats: Record<string, { events: number; sandwiches: number }> = {};
  const monthlyStats: Record<string, { events: number; sandwiches: number }> = {};
  const statusCounts: Record<string, number> = {};
  let totalSandwiches = 0;

  // Track events needing attention with DETAILS
  const eventsWithMissingInfoList: { name: string; date: string; missing: string[] }[] = [];
  const unconfirmedScheduledList: { name: string; date: string; sandwiches: number; address: string }[] = [];
  const needsOneDayFollowUpList: { name: string; date: string }[] = [];
  const needsOneMonthFollowUpList: { name: string; date: string }[] = [];
  const stalledInProcessList: { name: string; daysSinceContact: number; tspContact: string }[] = [];
  const newRequestsList: { name: string; date: string; sandwiches: number; category: string }[] = [];
  const inProcessList: { name: string; desiredDate: string; sandwiches: number }[] = [];

  const missingInfoBreakdown: Record<string, number> = {};

  // Get upcoming events at various time horizons
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const sevenDaysOut = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const fourteenDaysOut = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
  const thirtyDaysOut = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  let upcomingNext7Days = 0;
  let upcomingNext14Days = 0;
  let upcomingNext30Days = 0;

  // Track upcoming events with details
  const upcomingEventsList: { name: string; date: string; status: string; sandwiches: number; confirmed: boolean; address: string }[] = [];

  // Track date range of all events
  let earliestEventDate: Date | null = null;
  let latestEventDate: Date | null = null;

  allEvents.forEach(e => {
    const sandwichCount = e.actualSandwichCount || e.estimatedSandwichCount || 0;
    totalSandwiches += sandwichCount;

    // Track date range
    const eventDate = e.scheduledEventDate || e.desiredEventDate;
    if (eventDate) {
      const date = eventDate instanceof Date ? eventDate : new Date(eventDate);
      if (!earliestEventDate || date < earliestEventDate) {
        earliestEventDate = date;
      }
      if (!latestEventDate || date > latestEventDate) {
        latestEventDate = date;
      }
    }

    // Category stats
    const category = e.organizationCategory || 'other';
    if (!categoryStats[category]) {
      categoryStats[category] = { events: 0, sandwiches: 0 };
    }
    categoryStats[category].events++;
    categoryStats[category].sandwiches += sandwichCount;

    // Monthly stats (reuse eventDate from date range tracking above)
    if (eventDate) {
      const date = eventDate instanceof Date ? eventDate : new Date(eventDate);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      if (!monthlyStats[monthKey]) {
        monthlyStats[monthKey] = { events: 0, sandwiches: 0 };
      }
      monthlyStats[monthKey].events++;
      monthlyStats[monthKey].sandwiches += sandwichCount;

      // Check upcoming events at various time horizons (scheduled or in_process only)
      if (date >= now && (e.status === 'scheduled' || e.status === 'in_process')) {
        if (date <= sevenDaysOut) {
          upcomingNext7Days++;
        }
        if (date <= fourteenDaysOut) {
          upcomingNext14Days++;
        }
        if (date <= thirtyDaysOut) {
          upcomingNext30Days++;
          // Add to detailed list for 30-day events
          upcomingEventsList.push({
            name: e.organizationName || 'Unknown',
            date: formatEventDate(date),
            status: e.status,
            sandwiches: sandwichCount,
            confirmed: e.isConfirmed || false,
            address: e.eventAddress || e.deliveryDestination || 'No address'
          });
        }
      }
    }

    // Status counts
    const status = e.status || 'unknown';
    statusCounts[status] = (statusCounts[status] || 0) + 1;

    // Track new requests with details
    if (e.status === 'new') {
      newRequestsList.push({
        name: e.organizationName || 'Unknown',
        date: formatEventDate(e.desiredEventDate),
        sandwiches: sandwichCount,
        category: e.organizationCategory || 'other'
      });
    }

    // Track in_process events
    if (e.status === 'in_process') {
      inProcessList.push({
        name: e.organizationName || 'Unknown',
        desiredDate: formatEventDate(e.desiredEventDate),
        sandwiches: sandwichCount
      });

      // Check if stalled (no contact in 7+ days)
      const lastContact = e.lastContactAttempt || e.contactedAt || e.createdAt;
      if (lastContact) {
        const contactDate = new Date(lastContact);
        if (contactDate < sevenDaysAgo) {
          const daysSince = Math.floor((now.getTime() - contactDate.getTime()) / (1000 * 60 * 60 * 24));
          stalledInProcessList.push({
            name: e.organizationName || 'Unknown',
            daysSinceContact: daysSince,
            tspContact: e.tspContactAssigned || e.tspContact || 'Unassigned'
          });
        }
      }
    }

    // Check for missing critical info (only for active events) WITH DETAILS
    if (e.status === 'in_process' || e.status === 'scheduled' || e.status === 'new') {
      const missingInfo = getEventMissingInfo(e);
      if (missingInfo.length > 0) {
        eventsWithMissingInfoList.push({
          name: e.organizationName || 'Unknown',
          date: formatEventDate(e.scheduledEventDate || e.desiredEventDate),
          missing: missingInfo
        });
        missingInfo.forEach(item => {
          missingInfoBreakdown[item] = (missingInfoBreakdown[item] || 0) + 1;
        });
      }
    }

    // Check for unconfirmed scheduled events WITH DETAILS
    if (e.status === 'scheduled' && !e.isConfirmed) {
      unconfirmedScheduledList.push({
        name: e.organizationName || 'Unknown',
        date: formatEventDate(e.scheduledEventDate || e.desiredEventDate),
        sandwiches: sandwichCount,
        address: e.eventAddress || e.deliveryDestination || 'No address'
      });
    }

    // Check for completed events needing follow-ups WITH DETAILS
    if (e.status === 'completed') {
      const completedDate = formatEventDate(e.scheduledEventDate || e.desiredEventDate);
      if (!e.followUpOneDayCompleted) {
        needsOneDayFollowUpList.push({
          name: e.organizationName || 'Unknown',
          date: completedDate
        });
      }
      if (e.followUpOneDayCompleted && !e.followUpOneMonthCompleted) {
        needsOneMonthFollowUpList.push({
          name: e.organizationName || 'Unknown',
          date: completedDate
        });
      }
    }
  });

  // Sort lists
  upcomingEventsList.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  stalledInProcessList.sort((a, b) => b.daysSinceContact - a.daysSinceContact);

  // Format date range string
  const dateRangeStr = earliestEventDate && latestEventDate
    ? `${formatEventDate(earliestEventDate)} to ${formatEventDate(latestEventDate)}`
    : 'No dates available';

  return `
## Event Data Summary

### Overall Metrics
- Total Events: ${allEvents.length}
- Total Sandwiches: ${totalSandwiches.toLocaleString()}
- Average Per Event: ${allEvents.length > 0 ? Math.round(totalSandwiches / allEvents.length) : 0}
- **Data Time Period: ${dateRangeStr}** (This is the date range spanning all events in the system, from earliest to latest event date)

### Events by Status
${Object.entries(statusCounts)
  .sort((a, b) => b[1] - a[1])
  .map(([status, count]) => `- ${status}: ${count}`)
  .join('\n')}

### Upcoming Events (Next 30 Days): ${upcomingNext30Days} total
- Next 7 Days: ${upcomingNext7Days} events
- Next 14 Days: ${upcomingNext14Days} events
- Next 30 Days: ${upcomingNext30Days} events

${upcomingEventsList.length > 0 ? `**Upcoming Event Details:**
${upcomingEventsList.slice(0, 20).map(e => `- ${e.date}: ${e.name} | ${e.status} | ${e.confirmed ? 'CONFIRMED' : 'Pending confirmation'} | ~${e.sandwiches} sandwiches | ${e.address}`).join('\n')}` : ''}

### New Requests: ${newRequestsList.length}
${newRequestsList.length > 0 ? newRequestsList.slice(0, 10).map(e => `- ${e.name} | Desired: ${e.date} | ~${e.sandwiches} sandwiches | ${e.category}`).join('\n') : 'None'}

### In Process: ${inProcessList.length}
${inProcessList.length > 0 ? inProcessList.slice(0, 10).map(e => `- ${e.name} | Desired: ${e.desiredDate} | ~${e.sandwiches} sandwiches`).join('\n') : 'None'}

### Stalled Intakes (No contact in 7+ days): ${stalledInProcessList.length}
${stalledInProcessList.length > 0 ? stalledInProcessList.slice(0, 10).map(e => `- ${e.name} | ${e.daysSinceContact} days since contact | TSP: ${e.tspContact}`).join('\n') : 'None - great job!'}

### Scheduled Events Pending Confirmation: ${unconfirmedScheduledList.length}
${unconfirmedScheduledList.length > 0 ? unconfirmedScheduledList.map(e => `- ${e.name} | ${e.date} | ~${e.sandwiches} sandwiches | ${e.address}`).join('\n') : 'None - all confirmed!'}

### Events Missing Critical Info: ${eventsWithMissingInfoList.length}
${Object.entries(missingInfoBreakdown).length > 0 ? Object.entries(missingInfoBreakdown).map(([item, count]) => `  - Missing ${item}: ${count}`).join('\n') : '  - None'}
${eventsWithMissingInfoList.length > 0 ? `\n**Details:**\n${eventsWithMissingInfoList.slice(0, 15).map(e => `- ${e.name} (${e.date}): Missing ${e.missing.join(', ')}`).join('\n')}` : ''}

### Follow-up Needed
- Completed Events Needing 1-Day Follow-Up: ${needsOneDayFollowUpList.length}
${needsOneDayFollowUpList.length > 0 ? needsOneDayFollowUpList.slice(0, 10).map(e => `  - ${e.name} (${e.date})`).join('\n') : '  None'}
- Completed Events Needing 1-Month Follow-Up: ${needsOneMonthFollowUpList.length}
${needsOneMonthFollowUpList.length > 0 ? needsOneMonthFollowUpList.slice(0, 10).map(e => `  - ${e.name} (${e.date})`).join('\n') : '  None'}

### Events by Category
${Object.entries(categoryStats)
  .sort((a, b) => b[1].events - a[1].events)
  .map(([category, stats]) => `- ${category}: ${stats.events} events, ${stats.sandwiches.toLocaleString()} sandwiches`)
  .join('\n')}

### Events by Month (Recent)
${Object.entries(monthlyStats)
  .sort(([a], [b]) => b.localeCompare(a))
  .slice(0, 6)
  .map(([month, stats]) => `- ${month}: ${stats.events} events, ${stats.sandwiches.toLocaleString()} sandwiches`)
  .join('\n')}
`;
}

// Build context for general platform help
async function buildGeneralContext(): Promise<string> {
  // Get high-level stats for general context
  const allCollections = await db.query.sandwichCollections.findMany();
  const collections = allCollections.filter(c => !c.deletedAt);
  const allEvents = await db.query.eventRequests.findMany();

  let totalSandwiches = 0;
  collections.forEach(c => {
    totalSandwiches += getCollectionSandwichCount(c);
  });

  const uniqueHosts = new Set(collections.map(c => c.hostName).filter(Boolean));

  return `
## The Sandwich Project Platform Overview

### Quick Stats
- Total Sandwiches Collected: ${totalSandwiches.toLocaleString()}
- Number of Collections: ${collections.length}
- Active Host Locations: ${uniqueHosts.size}
- Total Event Requests: ${allEvents.length}

### Platform Features
The platform includes:
- **Collection Log**: Track weekly sandwich collections from host locations
- **Event Requests**: Manage requests for sandwich events from organizations
- **TSP Network**: Manage hosts, drivers, volunteers, and recipients
- **Projects**: Track ongoing projects and tasks
- **Meetings**: Schedule and manage committee meetings with agendas
- **Analytics**: View trends and metrics for collections and events
- **Grant Metrics**: Access data for grant applications and reporting
- **Resources**: Access training materials and important documents
- **Holding Zone**: Capture ideas and tasks before they become projects

### Weekly Collection Schedule
- Wednesday is the standard weekly collection day
- Collections are typically logged on Wednesday or Thursday
`;
}

// Build context for Holding Zone (Team Board)
async function buildHoldingZoneContext(): Promise<string> {
  const items = await db.query.teamBoardItems.findMany();

  // Calculate metrics
  const statusCounts: Record<string, number> = { open: 0, claimed: 0, done: 0 };
  const typeCounts: Record<string, number> = { task: 0, note: 0, idea: 0 };
  const urgentCount = items.filter(i => i.isUrgent).length;

  items.forEach(item => {
    statusCounts[item.status || 'open']++;
    typeCounts[item.type || 'task']++;
  });

  const recentItems = items
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 10);

  return `
## Holding Zone Data Summary

### Current Items Overview
- Total Items: ${items.length}
- Open Items: ${statusCounts.open}
- Claimed Items: ${statusCounts.claimed}
- Completed Items: ${statusCounts.done}
- Urgent Items: ${urgentCount}

### Items by Type
- Tasks: ${typeCounts.task}
- Notes: ${typeCounts.note}
- Ideas: ${typeCounts.idea}

### Recent Items (Last 10)
${recentItems.map(item => `- [${item.type}] ${item.content?.substring(0, 50)}${item.content && item.content.length > 50 ? '...' : ''} (${item.status})`).join('\n')}

### About the Holding Zone
The Holding Zone is a collaborative space where team members can:
- Capture quick tasks, notes, and ideas
- Assign items to team members
- Mark items as urgent
- Track completion status
- Add comments and collaborate on items
`;
}

// Build context for TSP Network
async function buildNetworkContext(): Promise<string> {
  const hosts = await db.query.hosts.findMany();
  const drivers = await db.query.drivers.findMany();
  const volunteers = await db.query.volunteers.findMany();
  const recipients = await db.query.recipients.findMany();

  const activeHosts = hosts.filter(h => h.isActive !== false).length;
  const activeDrivers = drivers.filter(d => d.isActive !== false).length;
  const activeVolunteers = volunteers.filter(v => v.isActive !== false).length;
  const activeRecipients = recipients.filter(r => r.isActive !== false).length;

  return `
## TSP Network Data Summary

### Network Overview
- Total Hosts: ${hosts.length} (${activeHosts} active)
- Total Drivers: ${drivers.length} (${activeDrivers} active)
- Total Volunteers: ${volunteers.length} (${activeVolunteers} active)
- Total Recipients: ${recipients.length} (${activeRecipients} active)

### About the TSP Network
The TSP Network manages all the people and organizations involved in The Sandwich Project:
- **Hosts**: Locations where sandwiches are made (homes, churches, businesses)
- **Drivers**: People who pick up and deliver sandwiches
- **Volunteers**: Team members who help with various tasks
- **Recipients**: Organizations that receive sandwiches for distribution

### Key Functions
- Track contact information and availability
- Manage active/inactive status
- Record notes and special requirements
- Coordinate scheduling and routes
`;
}

// Build context for Projects
async function buildProjectsContext(): Promise<string> {
  const projects = await db.query.projects.findMany();

  const statusCounts: Record<string, number> = {};
  const priorityCounts: Record<string, number> = {};
  const categoryCounts: Record<string, number> = {};

  projects.forEach(p => {
    statusCounts[p.status || 'waiting'] = (statusCounts[p.status || 'waiting'] || 0) + 1;
    priorityCounts[p.priority || 'medium'] = (priorityCounts[p.priority || 'medium'] || 0) + 1;
    if (p.category) {
      categoryCounts[p.category] = (categoryCounts[p.category] || 0) + 1;
    }
  });

  const activeProjects = projects.filter(p => p.status !== 'completed' && p.status !== 'archived');

  return `
## Projects Data Summary

### Overview
- Total Projects: ${projects.length}
- Active Projects: ${activeProjects.length}

### Projects by Status
${Object.entries(statusCounts)
  .sort((a, b) => b[1] - a[1])
  .map(([status, count]) => `- ${status}: ${count}`)
  .join('\n')}

### Projects by Priority
${Object.entries(priorityCounts)
  .sort((a, b) => b[1] - a[1])
  .map(([priority, count]) => `- ${priority}: ${count}`)
  .join('\n')}

### Projects by Category
${Object.entries(categoryCounts)
  .sort((a, b) => b[1] - a[1])
  .map(([category, count]) => `- ${category}: ${count}`)
  .join('\n')}

### About Projects
Projects help track ongoing initiatives for The Sandwich Project:
- Set priority levels (low, medium, high, urgent)
- Track status (waiting, in-progress, completed, archived)
- Assign team members
- Set due dates and track progress
- Categorize by type (technology, operations, outreach, etc.)
`;
}

// Build context for Meetings
async function buildMeetingsContext(): Promise<string> {
  const meetings = await db.query.meetings.findMany();
  const agendaItems = await db.query.agendaItems.findMany();

  // Sort meetings by date
  const upcomingMeetings = meetings
    .filter(m => new Date(m.scheduledDate) >= new Date())
    .sort((a, b) => new Date(a.scheduledDate).getTime() - new Date(b.scheduledDate).getTime())
    .slice(0, 5);

  const recentMeetings = meetings
    .filter(m => new Date(m.scheduledDate) < new Date())
    .sort((a, b) => new Date(b.scheduledDate).getTime() - new Date(a.scheduledDate).getTime())
    .slice(0, 5);

  return `
## Meetings Data Summary

### Overview
- Total Meetings Scheduled: ${meetings.length}
- Total Agenda Items: ${agendaItems.length}

### Upcoming Meetings
${upcomingMeetings.length > 0
  ? upcomingMeetings.map(m => `- ${m.title} (${new Date(m.scheduledDate).toLocaleDateString()})`).join('\n')
  : '- No upcoming meetings scheduled'}

### Recent Meetings
${recentMeetings.length > 0
  ? recentMeetings.map(m => `- ${m.title} (${new Date(m.scheduledDate).toLocaleDateString()})`).join('\n')
  : '- No recent meetings'}

### About Meetings
The meeting dashboard helps manage committee meetings:
- Schedule meetings with dates and times
- Create and manage agenda items
- Track action items from meetings
- Record meeting notes and minutes
- Compile agendas for distribution
`;
}

// Build context for Resources
async function buildResourcesContext(): Promise<string> {
  const resources = await db.query.resources.findMany();

  const categoryStats: Record<string, number> = {};
  const typeStats: Record<string, number> = {};

  resources.forEach(r => {
    if (r.category) {
      categoryStats[r.category] = (categoryStats[r.category] || 0) + 1;
    }
    if (r.resourceType) {
      typeStats[r.resourceType] = (typeStats[r.resourceType] || 0) + 1;
    }
  });

  return `
## Resources Data Summary

### Overview
- Total Resources: ${resources.length}

### Resources by Category
${Object.entries(categoryStats)
  .sort((a, b) => b[1] - a[1])
  .map(([category, count]) => `- ${category}: ${count}`)
  .join('\n') || '- No categories defined'}

### Resources by Type
${Object.entries(typeStats)
  .sort((a, b) => b[1] - a[1])
  .map(([type, count]) => `- ${type}: ${count}`)
  .join('\n') || '- No types defined'}

### About Resources
Resources is a library of documents and materials for The Sandwich Project:
- Training materials and guides
- Forms and templates
- Policy documents
- How-to guides and procedures
- Links to external resources
`;
}

// Build context for Organizations
async function buildOrganizationsContext(): Promise<string> {
  const organizations = await db.query.organizations.findMany();
  const events = await db.query.eventRequests.findMany();

  const categoryStats: Record<string, number> = {};
  organizations.forEach(org => {
    const category = org.category || 'other';
    categoryStats[category] = (categoryStats[category] || 0) + 1;
  });

  // Count events per organization
  const orgsWithEvents = new Set(events.map(e => e.organizationName).filter(Boolean));

  return `
## Organizations Data Summary

### Overview
- Total Organizations: ${organizations.length}
- Organizations with Events: ${orgsWithEvents.size}

### Organizations by Category
${Object.entries(categoryStats)
  .sort((a, b) => b[1] - a[1])
  .map(([category, count]) => `- ${category}: ${count}`)
  .join('\n') || '- No categories defined'}

### About Organizations
The Organizations catalog tracks groups that partner with The Sandwich Project:
- Schools, churches, businesses, and community groups
- Contact information and key contacts
- Event history and relationships
- Notes and special requirements
`;
}

// Build context for Important Links
async function buildLinksContext(): Promise<string> {
  const links = await db.query.driveLinks.findMany();

  const categoryStats: Record<string, number> = {};
  links.forEach(link => {
    const category = link.category || 'general';
    categoryStats[category] = (categoryStats[category] || 0) + 1;
  });

  return `
## Important Links Data Summary

### Overview
- Total Links: ${links.length}

### Links by Category
${Object.entries(categoryStats)
  .sort((a, b) => b[1] - a[1])
  .map(([category, count]) => `- ${category}: ${count}`)
  .join('\n') || '- No categories defined'}

### About Important Links
Important Links is a quick-access hub for frequently used resources:
- Google Drive folders and documents
- External tools and platforms
- Key websites and portals
- Shared team resources
`;
}

// Build context for Dashboard
async function buildDashboardContext(): Promise<string> {
  // Combine key metrics from across the platform
  const collections = (await db.query.sandwichCollections.findMany()).filter(c => !c.deletedAt);
  const events = await db.query.eventRequests.findMany();
  const projects = await db.query.projects.findMany();
  const teamBoardItems = await db.query.teamBoardItems.findMany();

  let totalSandwiches = 0;
  collections.forEach(c => {
    totalSandwiches += getCollectionSandwichCount(c);
  });

  const activeProjects = projects.filter(p => p.status !== 'completed' && p.status !== 'archived').length;
  const openItems = teamBoardItems.filter(i => i.status === 'open').length;
  const upcomingEvents = events.filter(e => {
    const eventDate = e.scheduledEventDate || e.desiredEventDate;
    return eventDate && new Date(eventDate) >= new Date();
  }).length;

  return `
## Dashboard Data Summary

### Quick Stats
- Total Sandwiches Collected: ${totalSandwiches.toLocaleString()}
- Total Collections: ${collections.length}
- Total Events: ${events.length}
- Upcoming Events: ${upcomingEvents}
- Active Projects: ${activeProjects}
- Open Holding Zone Items: ${openItems}

### About the Dashboard
The Dashboard provides an overview of The Sandwich Project's activities:
- Quick access to key metrics
- Recent activity summaries
- Navigation to all platform features
- Announcements and updates
`;
}

// Get system prompt for context type
function getSystemPrompt(contextType: string, dataSummary: string): string {
  const baseRules = `
TODAY'S DATE: ${new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}

CRITICAL RULES - YOU MUST FOLLOW THESE:
1. ONLY use the data provided below. Do NOT invent, assume, or hallucinate any data points, categories, or metrics.
2. The Sandwich Project does NOT track sandwich types (no "vegetarian", "turkey", "ham", etc.). They only track TOTAL sandwich counts.
3. If asked about something truly not present in the data, say "That information is not tracked in the current data." BUT first check carefully - date ranges, time periods, and monthly breakdowns ARE included in the data summary.
4. Never make up statistics or trends that aren't directly derivable from the provided data.
5. NEVER compare or rank hosts/locations against each other - The Sandwich Project values all contributors equally and does not pit hosts against one another.
6. Wednesday is the standard weekly collection day for individual sandwich collections, with most submissions logged on Wednesday or Thursday. Day-of-week analysis is not meaningful for individual collections.
7. When referring to dates, use today's date (shown above) as your reference point. Do NOT assume it is any date other than today.
8. When you show a chart and the user asks follow-up questions about that data (like "what time period does this cover?"), answer using the data summary - the time period, date ranges, and breakdown by month are all included in the data. Do NOT say the information isn't tracked when it clearly is.

When the user asks for a chart or visualization, respond with a JSON block using ONLY data from the summary below:
\`\`\`chart
{
  "type": "bar" | "line" | "pie",
  "title": "Chart Title",
  "data": [{ "name": "Label", "value": 123 }, ...],
  "xKey": "name",
  "yKey": "value",
  "description": "Brief explanation of what this shows"
}
\`\`\`

Keep responses concise but insightful. Focus on actionable information derived from the actual data.
`;

  const contextDescriptions: Record<string, string> = {
    collections: `You are a data analyst assistant for The Sandwich Project's collection log.
You help analyze sandwich collection data - when sandwiches were collected and how many.
Collections are submitted by hosts (individuals or groups) who organize sandwich-making.
IMPORTANT: Never rank or compare hosts against each other. Focus on overall totals and trends.`,

    events: `You are a data analyst assistant for The Sandwich Project's event management system.
You help analyze event request data - organizations requesting sandwich-making events, event categories, and scheduling.
IMPORTANT: Never rank or compare organizations against each other. Focus on overall trends and categories.`,

    'impact-reports': `You are a data analyst assistant for The Sandwich Project's impact reporting.
You help analyze the overall impact of the organization including events, collections, and sandwich distribution.
IMPORTANT: Never rank or compare hosts or organizations against each other. Focus on overall impact and growth.`,

    'general': `You are a helpful assistant for The Sandwich Project platform.
You help users navigate and understand the platform's features for managing sandwich collections, events, volunteers, and organizational data.
If the user asks about specific data, let them know which section of the platform would have that information.`,

    'holding-zone': `You are a helpful assistant for The Sandwich Project's Holding Zone.
The Holding Zone is a collaborative task board where team members capture tasks, notes, and ideas before they become formal projects.
You help users manage their items, understand the status of tasks, and organize their workflow.`,

    'network': `You are a helpful assistant for The Sandwich Project's TSP Network.
The TSP Network manages all the people and organizations involved: hosts (where sandwiches are made), drivers (who deliver), volunteers (who help), and recipients (who receive sandwiches).
You help users understand the network structure and find information about participants.`,

    'projects': `You are a helpful assistant for The Sandwich Project's project management.
Projects track ongoing initiatives with priorities, statuses, categories, and team assignments.
You help users understand project status, priorities, and organizational structure.`,

    'meetings': `You are a helpful assistant for The Sandwich Project's meeting management.
The meeting dashboard helps schedule and manage committee meetings, agendas, and action items.
You help users find meeting information and understand upcoming schedules.`,

    'resources': `You are a helpful assistant for The Sandwich Project's resource library.
Resources include training materials, guides, forms, templates, and procedures.
You help users find and understand available resources.`,

    'organizations': `You are a helpful assistant for The Sandwich Project's organization catalog.
Organizations are groups that partner with TSP for sandwich-making events.
You help users understand the organization database and event relationships.`,

    'links': `You are a helpful assistant for The Sandwich Project's important links.
Important Links provides quick access to frequently used documents and external resources.
You help users find and navigate to key resources.`,

    'dashboard': `You are a helpful assistant for The Sandwich Project's dashboard.
The dashboard provides an overview of all platform activities and key metrics.
You help users understand the overall status and navigate to different sections.`,
  };

  const contextDesc = contextDescriptions[contextType] || contextDescriptions['general'];

  return `${contextDesc}

${baseRules}

CURRENT DATA (this is the ONLY data you should reference):
${dataSummary}`;
}

// POST /api/ai-chat - Universal AI chat endpoint
aiChatRouter.post('/', async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { message, contextType = 'collections', contextData, conversationHistory = [] } = req.body;

    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    logger.info('AI chat request', { userId: req.user.id, contextType, messageLength: message.length });

    // Build context based on type
    let dataSummary: string;
    switch (contextType) {
      case 'collections':
        dataSummary = await buildCollectionsContext(contextData);
        break;
      case 'events':
        dataSummary = await buildEventsContext(contextData);
        break;
      case 'impact-reports':
        // For impact reports, combine both
        const collectionsData = await buildCollectionsContext(contextData);
        const eventsData = await buildEventsContext(contextData);
        dataSummary = `${collectionsData}\n\n${eventsData}`;
        break;
      case 'holding-zone':
        dataSummary = await buildHoldingZoneContext();
        break;
      case 'network':
        dataSummary = await buildNetworkContext();
        break;
      case 'projects':
        dataSummary = await buildProjectsContext();
        break;
      case 'meetings':
        dataSummary = await buildMeetingsContext();
        break;
      case 'resources':
        dataSummary = await buildResourcesContext();
        break;
      case 'organizations':
        dataSummary = await buildOrganizationsContext();
        break;
      case 'links':
        dataSummary = await buildLinksContext();
        break;
      case 'dashboard':
        dataSummary = await buildDashboardContext();
        break;
      case 'general':
        dataSummary = await buildGeneralContext();
        break;
      default:
        dataSummary = await buildGeneralContext();
    }

    const systemPrompt = getSystemPrompt(contextType, dataSummary);

    const messages: any[] = [
      { role: 'system', content: systemPrompt },
      ...conversationHistory.slice(-10),
      { role: 'user', content: message }
    ];

    const client = getOpenAIClient();
    const completion = await client.chat.completions.create({
      model: 'gpt-4o',
      messages,
      temperature: 0.7,
      max_tokens: 1500,
    });

    const aiResponse = completion.choices[0].message.content || 'I apologize, but I was unable to generate a response.';

    // Parse any chart data from the response
    let chartData = null;
    const chartMatch = aiResponse.match(/```chart\n([\s\S]*?)\n```/);
    if (chartMatch) {
      try {
        chartData = JSON.parse(chartMatch[1]);
      } catch (e) {
        logger.warn('Failed to parse chart data from AI response');
      }
    }

    // Clean response (remove chart JSON block for display)
    const cleanedResponse = aiResponse.replace(/```chart\n[\s\S]*?\n```/g, '').trim();

    res.json({
      response: cleanedResponse,
      chart: chartData,
      contextType,
    });

  } catch (error) {
    logger.error('Error in AI chat', { error });
    res.status(500).json({
      error: 'Failed to process AI chat request',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});
