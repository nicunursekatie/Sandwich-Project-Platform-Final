import { db } from '../../db';
import { eventRequests, sandwichCollections, organizationEngagementScores } from '../../../shared/schema';
import { eq, sql, desc, and, gte, isNotNull } from 'drizzle-orm';
import { logger } from '../../utils/production-safe-logger';
import { canonicalizeOrgName } from '../../utils/organization-canonicalization';

// ============================================================================
// Types
// ============================================================================

export interface EngagementMetrics {
  totalEvents: number;
  completedEvents: number;
  totalSandwiches: number;
  daysSinceLastEvent: number | null;
  daysSinceFirstEvent: number | null;
  lastEventDate: Date | null;
  firstEventDate: Date | null;
  averageEventInterval: number | null;
  eventDates: Date[];
}

export interface EngagementScores {
  overall: number;
  frequency: number;
  recency: number;
  volume: number;
  completion: number;
  consistency: number;
}

export interface EngagementInsight {
  type: 'warning' | 'opportunity' | 'positive' | 'info';
  title: string;
  description: string;
  priority: number;
}

export interface RecommendedAction {
  action: string;
  reason: string;
  priority: 'urgent' | 'high' | 'normal' | 'low';
}

export interface ProgramSuitability {
  program: string;
  score: number;
  reason: string;
}

export interface OrganizationEngagement {
  organizationName: string;
  canonicalName: string;
  category: string | null;
  scores: EngagementScores;
  metrics: EngagementMetrics;
  engagementLevel: 'highly_engaged' | 'engaged' | 'moderate' | 'low' | 'at_risk' | 'dormant' | 'new';
  engagementTrend: 'increasing' | 'decreasing' | 'stable' | 'new';
  trendPercentChange: number;
  outreachPriority: 'urgent' | 'high' | 'normal' | 'low';
  insights: EngagementInsight[];
  recommendedActions: RecommendedAction[];
  programSuitability: ProgramSuitability[];
  lastCalculatedAt: Date;
}

export interface GroupInsightsSummary {
  totalOrganizations: number;
  engagementDistribution: {
    highlyEngaged: number;
    engaged: number;
    moderate: number;
    low: number;
    atRisk: number;
    dormant: number;
    new: number;
  };
  outreachPriorities: {
    urgent: number;
    high: number;
    normal: number;
    low: number;
  };
  categoryBreakdown: Record<string, {
    count: number;
    avgEngagementScore: number;
  }>;
  averageEngagementScore: number;
  topPerformers: OrganizationEngagement[];
  needsAttention: OrganizationEngagement[];
  newOpportunities: OrganizationEngagement[];
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Calculate days between two dates
 */
function daysBetween(date1: Date, date2: Date): number {
  const diffTime = Math.abs(date2.getTime() - date1.getTime());
  return Math.floor(diffTime / (1000 * 60 * 60 * 24));
}

/**
 * Calculate frequency score (0-100)
 * Based on events per year - more frequent events = higher score
 */
function calculateFrequencyScore(metrics: EngagementMetrics): number {
  if (metrics.totalEvents === 0) return 0;
  if (metrics.daysSinceFirstEvent === null || metrics.daysSinceFirstEvent === 0) {
    return metrics.totalEvents > 0 ? 50 : 0; // New org with at least one event
  }

  const yearsActive = metrics.daysSinceFirstEvent / 365;
  const eventsPerYear = metrics.totalEvents / Math.max(yearsActive, 0.25); // Min 3 months

  // Scale: 0 events = 0, 1/year = 25, 2/year = 50, 4/year = 75, 6+/year = 100
  if (eventsPerYear >= 6) return 100;
  if (eventsPerYear >= 4) return 75 + (eventsPerYear - 4) * 12.5;
  if (eventsPerYear >= 2) return 50 + (eventsPerYear - 2) * 12.5;
  if (eventsPerYear >= 1) return 25 + (eventsPerYear - 1) * 25;
  return eventsPerYear * 25;
}

/**
 * Calculate recency score (0-100)
 * Based on days since last event - more recent = higher score
 */
function calculateRecencyScore(metrics: EngagementMetrics): number {
  if (metrics.daysSinceLastEvent === null) return 0;

  const days = metrics.daysSinceLastEvent;

  // Scale: 0-30 days = 100, 30-90 = 75-100, 90-180 = 50-75, 180-365 = 25-50, 365+ = 0-25
  if (days <= 30) return 100;
  if (days <= 90) return 100 - ((days - 30) / 60) * 25;
  if (days <= 180) return 75 - ((days - 90) / 90) * 25;
  if (days <= 365) return 50 - ((days - 180) / 185) * 25;
  if (days <= 730) return 25 - ((days - 365) / 365) * 15;
  return Math.max(0, 10 - ((days - 730) / 365) * 10);
}

/**
 * Calculate volume score (0-100)
 * Based on total sandwiches distributed
 */
function calculateVolumeScore(metrics: EngagementMetrics): number {
  const sandwiches = metrics.totalSandwiches;

  // Scale: 0 = 0, 100 = 20, 500 = 50, 1000 = 75, 5000+ = 100
  if (sandwiches >= 5000) return 100;
  if (sandwiches >= 1000) return 75 + ((sandwiches - 1000) / 4000) * 25;
  if (sandwiches >= 500) return 50 + ((sandwiches - 500) / 500) * 25;
  if (sandwiches >= 100) return 20 + ((sandwiches - 100) / 400) * 30;
  return (sandwiches / 100) * 20;
}

/**
 * Calculate completion score (0-100)
 * Based on ratio of completed events to total requests
 */
function calculateCompletionScore(metrics: EngagementMetrics): number {
  if (metrics.totalEvents === 0) return 0;

  const completionRate = metrics.completedEvents / metrics.totalEvents;
  return Math.round(completionRate * 100);
}

/**
 * Calculate consistency score (0-100)
 * Based on regularity of events (low variance in intervals)
 */
function calculateConsistencyScore(metrics: EngagementMetrics): number {
  if (metrics.eventDates.length < 2) return 0;
  if (metrics.averageEventInterval === null) return 0;

  // Calculate standard deviation of intervals
  const sortedDates = [...metrics.eventDates].sort((a, b) => a.getTime() - b.getTime());
  const intervals: number[] = [];

  for (let i = 1; i < sortedDates.length; i++) {
    intervals.push(daysBetween(sortedDates[i-1], sortedDates[i]));
  }

  if (intervals.length === 0) return 0;

  const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
  const variance = intervals.reduce((sum, interval) => {
    return sum + Math.pow(interval - avgInterval, 2);
  }, 0) / intervals.length;
  const stdDev = Math.sqrt(variance);

  // Coefficient of variation (lower = more consistent)
  const cv = avgInterval > 0 ? stdDev / avgInterval : 1;

  // Convert to score: CV of 0 = 100, CV of 1 = 50, CV of 2+ = 0
  if (cv <= 0.5) return 100;
  if (cv <= 1) return 100 - (cv - 0.5) * 100;
  if (cv <= 2) return 50 - (cv - 1) * 50;
  return 0;
}

/**
 * Calculate overall engagement score (weighted average)
 */
function calculateOverallScore(scores: Omit<EngagementScores, 'overall'>): number {
  // Weights for each component
  const weights = {
    recency: 0.30,    // Most important - recent activity
    frequency: 0.25,  // Regular engagement
    completion: 0.20, // Follow-through on commitments
    volume: 0.15,     // Impact/scale
    consistency: 0.10 // Predictability
  };

  const weighted =
    scores.recency * weights.recency +
    scores.frequency * weights.frequency +
    scores.completion * weights.completion +
    scores.volume * weights.volume +
    scores.consistency * weights.consistency;

  return Math.round(weighted * 100) / 100;
}

/**
 * Determine engagement level based on overall score
 */
function determineEngagementLevel(
  score: number,
  metrics: EngagementMetrics
): OrganizationEngagement['engagementLevel'] {
  // Check for organizations that have NEVER had an event with us
  // These aren't "at risk" - they were never engaged to begin with
  if (metrics.totalEvents === 0) {
    return 'new';  // Treat as new/prospect - not "at risk"
  }

  // Check for new organizations (less than 90 days since first event)
  if (metrics.daysSinceFirstEvent !== null && metrics.daysSinceFirstEvent < 90) {
    return 'new';
  }

  // Check for dormant (no activity in over a year)
  if (metrics.daysSinceLastEvent !== null && metrics.daysSinceLastEvent > 365) {
    return 'dormant';
  }

  // Score-based levels
  if (score >= 80) return 'highly_engaged';
  if (score >= 60) return 'engaged';
  if (score >= 40) return 'moderate';
  if (score >= 25) return 'low';
  return 'at_risk';
}

/**
 * Detect high-value partners who were recently active and have now gone quiet
 */
function hasSignificantDropOff(metrics: EngagementMetrics): boolean {
  if (!metrics.eventDates.length) return false;

  const now = new Date();
  const sixMonthsAgo = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000);
  const oneYearAgo = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);

  // Activity windows
  const recentEvents = metrics.eventDates.filter(d => d >= sixMonthsAgo).length;
  const previousWindowEvents = metrics.eventDates.filter(d =>
    d >= oneYearAgo && d < sixMonthsAgo
  ).length;

  const hadMeaningfulVolume = metrics.totalSandwiches >= 500;
  const hadRegularActivity = previousWindowEvents >= 2;

  // No activity in the last 6 months, but regular/high-volume activity in the 6-12 months prior
  return hadMeaningfulVolume && hadRegularActivity && recentEvents === 0;
}

/**
 * Determine outreach priority based on engagement level and potential
 */
function determineOutreachPriority(
  engagementLevel: OrganizationEngagement['engagementLevel'],
  metrics: EngagementMetrics,
  scores: EngagementScores
): OrganizationEngagement['outreachPriority'] {
  const significantDropOff = hasSignificantDropOff(metrics);

  if (significantDropOff) {
    // Recently went dark after being active and high-volume
    return metrics.daysSinceLastEvent !== null && metrics.daysSinceLastEvent > 365
      ? 'urgent'
      : 'high';
  }

  // Never-engaged organizations are low priority - they're prospects, not at-risk partners
  if (metrics.totalEvents === 0) {
    return 'low';
  }

  // Highly engaged partners don't need outreach
  if (engagementLevel === 'highly_engaged' || engagementLevel === 'engaged') return 'low';

  return 'normal';
}

/**
 * Generate insights based on metrics and scores
 */
function generateInsights(
  metrics: EngagementMetrics,
  scores: EngagementScores,
  engagementLevel: OrganizationEngagement['engagementLevel']
): EngagementInsight[] {
  const insights: EngagementInsight[] = [];
  const significantDropOff = hasSignificantDropOff(metrics);

  if (significantDropOff) {
    insights.push({
      type: 'warning',
      title: 'Significant Drop-Off',
      description: 'Previously a regular high-volume partner but no activity in the last 6 months. Prioritize re-engagement.',
      priority: 1
    });
  }

  // Recency insights
  if (metrics.daysSinceLastEvent !== null) {
    if (metrics.daysSinceLastEvent > 365) {
      insights.push({
        type: 'warning',
        title: 'Dormant Organization',
        description: `No activity in ${Math.floor(metrics.daysSinceLastEvent / 30)} months. Consider re-engagement outreach.`,
        priority: 1
      });
    } else if (metrics.daysSinceLastEvent > 180) {
      insights.push({
        type: 'warning',
        title: 'Extended Inactivity',
        description: `Last event was ${Math.floor(metrics.daysSinceLastEvent / 30)} months ago. Schedule a check-in.`,
        priority: 2
      });
    } else if (metrics.daysSinceLastEvent <= 30 && metrics.completedEvents > 0) {
      insights.push({
        type: 'positive',
        title: 'Recently Active',
        description: 'This organization had an event within the last month.',
        priority: 5
      });
    }
  }

  // Volume insights
  if (metrics.totalSandwiches >= 1000) {
    insights.push({
      type: 'positive',
      title: 'High Impact Partner',
      description: `Has distributed ${metrics.totalSandwiches.toLocaleString()} sandwiches total.`,
      priority: 4
    });
  }

  // Frequency insights
  if (scores.frequency >= 75) {
    insights.push({
      type: 'positive',
      title: 'Frequent Partner',
      description: 'This organization hosts events regularly.',
      priority: 4
    });
  } else if (scores.frequency < 25 && metrics.totalEvents >= 2) {
    insights.push({
      type: 'opportunity',
      title: 'Engagement Opportunity',
      description: 'Has hosted before but events are infrequent. Could benefit from more regular scheduling.',
      priority: 3
    });
  }

  // Completion insights
  if (scores.completion < 50 && metrics.totalEvents >= 3) {
    insights.push({
      type: 'warning',
      title: 'Low Completion Rate',
      description: `Only ${Math.round(scores.completion)}% of events completed. Review pending requests.`,
      priority: 2
    });
  }

  // Consistency insights
  if (scores.consistency >= 75) {
    insights.push({
      type: 'positive',
      title: 'Consistent Partner',
      description: 'Events are scheduled at regular intervals.',
      priority: 5
    });
  }

  // New organization insight
  if (engagementLevel === 'new') {
    insights.push({
      type: 'info',
      title: 'New Partnership',
      description: 'This is a relatively new organization. Focus on building the relationship.',
      priority: 3
    });
  }

  return insights.sort((a, b) => a.priority - b.priority);
}

/**
 * Generate recommended actions based on engagement analysis
 */
function generateRecommendedActions(
  metrics: EngagementMetrics,
  scores: EngagementScores,
  engagementLevel: OrganizationEngagement['engagementLevel'],
  outreachPriority: OrganizationEngagement['outreachPriority']
): RecommendedAction[] {
  const actions: RecommendedAction[] = [];

  // Actions based on engagement level
  switch (engagementLevel) {
    case 'dormant':
      actions.push({
        action: 'Schedule re-engagement call or email',
        reason: 'Organization has been inactive for over a year',
        priority: 'urgent'
      });
      if (metrics.totalSandwiches > 500) {
        actions.push({
          action: 'Review past event history and prepare personalized outreach',
          reason: 'High-value dormant partner worth re-engaging',
          priority: 'high'
        });
      }
      break;

    case 'at_risk':
      actions.push({
        action: 'Send check-in email to maintain relationship',
        reason: 'Engagement is declining - prevent becoming dormant',
        priority: 'high'
      });
      break;

    case 'low':
      actions.push({
        action: 'Schedule follow-up to discuss future events',
        reason: 'Organization shows potential but needs nurturing',
        priority: 'normal'
      });
      break;

    case 'new':
      actions.push({
        action: 'Send thank you note and schedule follow-up',
        reason: 'Build relationship with new partner',
        priority: 'normal'
      });
      if (metrics.completedEvents > 0) {
        actions.push({
          action: 'Ask for feedback on first event experience',
          reason: 'Learn from new partner experience to improve',
          priority: 'normal'
        });
      }
      break;

    case 'moderate':
      if (scores.frequency < 50) {
        actions.push({
          action: 'Propose recurring event schedule',
          reason: 'Could benefit from more regular engagement',
          priority: 'normal'
        });
      }
      break;

    case 'engaged':
    case 'highly_engaged':
      actions.push({
        action: 'Consider for ambassador or partnership program',
        reason: 'Strong engagement - potential for deeper partnership',
        priority: 'low'
      });
      break;
  }

  // Additional actions based on specific metrics
  if (scores.completion < 50 && metrics.totalEvents - metrics.completedEvents >= 2) {
    actions.push({
      action: 'Review and follow up on pending event requests',
      reason: `${metrics.totalEvents - metrics.completedEvents} pending requests need attention`,
      priority: 'high'
    });
  }

  return actions;
}

/**
 * Determine program suitability based on organization profile
 */
function determineProgramSuitability(
  metrics: EngagementMetrics,
  scores: EngagementScores,
  engagementLevel: OrganizationEngagement['engagementLevel'],
  category: string | null
): ProgramSuitability[] {
  const programs: ProgramSuitability[] = [];

  // Regular scheduling program
  if (scores.frequency >= 50 && scores.completion >= 70) {
    programs.push({
      program: 'Regular Monthly Events',
      score: Math.round((scores.frequency + scores.completion) / 2),
      reason: 'Consistent history makes them ideal for recurring events'
    });
  }

  // High-volume program
  if (metrics.totalSandwiches >= 500 || (metrics.completedEvents > 0 && metrics.totalSandwiches / metrics.completedEvents >= 100)) {
    programs.push({
      program: 'Large-Scale Events',
      score: Math.min(100, Math.round(scores.volume + 20)),
      reason: 'Has capacity for high-volume distributions'
    });
  }

  // Ambassador program
  if (engagementLevel === 'highly_engaged' || engagementLevel === 'engaged') {
    programs.push({
      program: 'Partner Ambassador Program',
      score: Math.round(scores.overall),
      reason: 'Strong engagement makes them excellent ambassadors'
    });
  }

  // Re-engagement program
  if (engagementLevel === 'dormant' && metrics.totalEvents >= 2) {
    programs.push({
      program: 'Partner Re-engagement Initiative',
      score: 80,
      reason: 'Prior relationship worth re-establishing'
    });
  }

  // Category-specific programs
  if (category === 'school') {
    programs.push({
      program: 'School Lunch Support Program',
      score: 75,
      reason: 'Schools benefit from regular sandwich support'
    });
  } else if (category === 'church_faith' || category === 'religious') {
    programs.push({
      program: 'Faith Community Outreach',
      score: 70,
      reason: 'Faith organizations often have community distribution networks'
    });
  } else if (category === 'corp' || category === 'small_medium_corp' || category === 'large_corp') {
    programs.push({
      program: 'Corporate Volunteer Partnership',
      score: 70,
      reason: 'Corporate partners can provide volunteers and resources'
    });
  }

  return programs.sort((a, b) => b.score - a.score);
}

/**
 * Calculate engagement trend by comparing recent vs historical activity
 */
function calculateEngagementTrend(
  metrics: EngagementMetrics
): { trend: OrganizationEngagement['engagementTrend']; percentChange: number } {
  if (metrics.eventDates.length < 2) {
    return { trend: 'new', percentChange: 0 };
  }

  const now = new Date();
  const sixMonthsAgo = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000);
  const oneYearAgo = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);

  // Count events in recent 6 months vs previous 6 months
  const recentEvents = metrics.eventDates.filter(d => d >= sixMonthsAgo).length;
  const olderEvents = metrics.eventDates.filter(d => d >= oneYearAgo && d < sixMonthsAgo).length;

  if (olderEvents === 0) {
    if (recentEvents > 0) return { trend: 'increasing', percentChange: 100 };
    return { trend: 'stable', percentChange: 0 };
  }

  const percentChange = ((recentEvents - olderEvents) / olderEvents) * 100;

  if (percentChange >= 20) return { trend: 'increasing', percentChange: Math.round(percentChange) };
  if (percentChange <= -20) return { trend: 'decreasing', percentChange: Math.round(percentChange) };
  return { trend: 'stable', percentChange: Math.round(percentChange) };
}

// ============================================================================
// Main Service Functions
// ============================================================================

/**
 * Gather metrics for a single organization
 */
async function gatherOrganizationMetrics(
  canonicalName: string,
  allEventRequests: any[],
  allCollections: any[]
): Promise<EngagementMetrics & { displayName: string; category: string | null }> {
  const now = new Date();

  // Filter event requests for this organization
  const orgRequests = allEventRequests.filter(
    req => canonicalizeOrgName(req.organizationName || '') === canonicalName
  );

  // Filter collections for this organization
  const orgCollections = allCollections.filter(collection => {
    const matchesGroup1 = collection.group1Name &&
      canonicalizeOrgName(collection.group1Name) === canonicalName;
    const matchesGroup2 = collection.group2Name &&
      canonicalizeOrgName(collection.group2Name) === canonicalName;
    let matchesGroupCollections = false;
    if (collection.groupCollections && Array.isArray(collection.groupCollections)) {
      matchesGroupCollections = collection.groupCollections.some(
        (group: any) => group.name && canonicalizeOrgName(group.name) === canonicalName
      );
    }
    return matchesGroup1 || matchesGroup2 || matchesGroupCollections;
  });

  // Calculate sandwich totals from collections
  let totalSandwiches = 0;
  orgCollections.forEach(collection => {
    if (collection.group1Name && canonicalizeOrgName(collection.group1Name) === canonicalName) {
      totalSandwiches += collection.group1Count || 0;
    }
    if (collection.group2Name && canonicalizeOrgName(collection.group2Name) === canonicalName) {
      totalSandwiches += collection.group2Count || 0;
    }
    if (collection.groupCollections && Array.isArray(collection.groupCollections)) {
      collection.groupCollections.forEach((group: any) => {
        if (group.name && canonicalizeOrgName(group.name) === canonicalName) {
          totalSandwiches += group.count || 0;
        }
      });
    }
  });

  // Add estimated sandwiches from completed requests
  orgRequests
    .filter(req => req.status === 'completed' || req.status === 'contact_completed')
    .forEach(req => {
      totalSandwiches += req.actualSandwichCount || req.estimatedSandwichCount || 0;
    });

  // Gather all event dates
  const eventDates: Date[] = [];

  orgRequests.forEach(req => {
    const date = req.scheduledEventDate || req.desiredEventDate;
    if (date) {
      eventDates.push(new Date(date));
    }
  });

  orgCollections.forEach(collection => {
    if (collection.collectionDate) {
      eventDates.push(new Date(collection.collectionDate));
    }
  });

  // Sort and dedupe dates (same day = same event)
  const uniqueDates = Array.from(
    new Set(eventDates.map(d => d.toISOString().split('T')[0]))
  ).map(s => new Date(s)).sort((a, b) => a.getTime() - b.getTime());

  // Build set of completed event dates (deduped by date)
  // A date is "completed" if it has either a completed request OR a collection
  const completedEventDates = new Set<string>();

  // Add dates from completed requests
  orgRequests
    .filter(req => req.status === 'completed' || req.status === 'contact_completed')
    .forEach(req => {
      const date = req.scheduledEventDate || req.desiredEventDate;
      if (date) {
        completedEventDates.add(new Date(date).toISOString().split('T')[0]);
      }
    });

  // Add dates from collections (all collections are inherently completed)
  orgCollections.forEach(collection => {
    if (collection.collectionDate) {
      completedEventDates.add(new Date(collection.collectionDate).toISOString().split('T')[0]);
    }
  });

  // Calculate metrics - include both requests AND collections as events
  // Total events = unique dates from both sources (already deduped)
  const totalEvents = uniqueDates.length;

  // Completed events = unique dates with completed activity (deduped to avoid >100% completion)
  const completedEvents = completedEventDates.size;

  const firstEventDate = uniqueDates.length > 0 ? uniqueDates[0] : null;
  const lastEventDate = uniqueDates.length > 0 ? uniqueDates[uniqueDates.length - 1] : null;

  const daysSinceFirstEvent = firstEventDate ? daysBetween(firstEventDate, now) : null;
  const daysSinceLastEvent = lastEventDate ? daysBetween(lastEventDate, now) : null;

  // Calculate average interval between events
  let averageEventInterval: number | null = null;
  if (uniqueDates.length >= 2) {
    let totalInterval = 0;
    for (let i = 1; i < uniqueDates.length; i++) {
      totalInterval += daysBetween(uniqueDates[i-1], uniqueDates[i]);
    }
    averageEventInterval = Math.round(totalInterval / (uniqueDates.length - 1));
  }

  // Get display name and category from first request
  const displayName = orgRequests[0]?.organizationName ||
    orgCollections[0]?.group1Name ||
    orgCollections[0]?.group2Name ||
    canonicalName;

  const category = orgRequests[0]?.category || null;

  return {
    displayName,
    category,
    totalEvents,
    completedEvents,
    totalSandwiches,
    daysSinceLastEvent,
    daysSinceFirstEvent,
    lastEventDate,
    firstEventDate,
    averageEventInterval,
    eventDates: uniqueDates
  };
}

/**
 * Calculate engagement for a single organization
 */
export async function calculateOrganizationEngagement(
  canonicalName: string,
  allEventRequests?: any[],
  allCollections?: any[]
): Promise<OrganizationEngagement> {
  // Fetch data if not provided
  if (!allEventRequests) {
    allEventRequests = await db.query.eventRequests.findMany();
  }
  if (!allCollections) {
    allCollections = await db.query.sandwichCollections.findMany();
  }

  const metrics = await gatherOrganizationMetrics(canonicalName, allEventRequests, allCollections);

  // Calculate individual scores
  const frequencyScore = calculateFrequencyScore(metrics);
  const recencyScore = calculateRecencyScore(metrics);
  const volumeScore = calculateVolumeScore(metrics);
  const completionScore = calculateCompletionScore(metrics);
  const consistencyScore = calculateConsistencyScore(metrics);

  const scores: EngagementScores = {
    frequency: Math.round(frequencyScore * 100) / 100,
    recency: Math.round(recencyScore * 100) / 100,
    volume: Math.round(volumeScore * 100) / 100,
    completion: Math.round(completionScore * 100) / 100,
    consistency: Math.round(consistencyScore * 100) / 100,
    overall: 0
  };

  scores.overall = calculateOverallScore(scores);

  // Determine engagement status
  const engagementLevel = determineEngagementLevel(scores.overall, metrics);
  const outreachPriority = determineOutreachPriority(engagementLevel, metrics, scores);
  const { trend: engagementTrend, percentChange: trendPercentChange } = calculateEngagementTrend(metrics);

  // Generate insights and recommendations
  const insights = generateInsights(metrics, scores, engagementLevel);
  const recommendedActions = generateRecommendedActions(metrics, scores, engagementLevel, outreachPriority);
  const programSuitability = determineProgramSuitability(metrics, scores, engagementLevel, metrics.category);

  return {
    organizationName: metrics.displayName,
    canonicalName,
    category: metrics.category,
    scores,
    metrics: {
      totalEvents: metrics.totalEvents,
      completedEvents: metrics.completedEvents,
      totalSandwiches: metrics.totalSandwiches,
      daysSinceLastEvent: metrics.daysSinceLastEvent,
      daysSinceFirstEvent: metrics.daysSinceFirstEvent,
      lastEventDate: metrics.lastEventDate,
      firstEventDate: metrics.firstEventDate,
      averageEventInterval: metrics.averageEventInterval,
      eventDates: metrics.eventDates
    },
    engagementLevel,
    engagementTrend,
    trendPercentChange,
    outreachPriority,
    insights,
    recommendedActions,
    programSuitability,
    lastCalculatedAt: new Date()
  };
}

/**
 * Calculate engagement scores for all organizations
 */
export async function calculateAllOrganizationEngagement(): Promise<OrganizationEngagement[]> {
  logger.info('Calculating engagement scores for all organizations');

  // Fetch all data once
  const allEventRequests = await db.query.eventRequests.findMany();
  const allCollections = await db.query.sandwichCollections.findMany();

  // Build set of all unique organization canonical names
  const orgNames = new Set<string>();

  allEventRequests.forEach(req => {
    if (req.organizationName) {
      orgNames.add(canonicalizeOrgName(req.organizationName));
    }
  });

  allCollections.forEach(collection => {
    if (collection.group1Name) {
      orgNames.add(canonicalizeOrgName(collection.group1Name));
    }
    if (collection.group2Name) {
      orgNames.add(canonicalizeOrgName(collection.group2Name));
    }
    if (collection.groupCollections && Array.isArray(collection.groupCollections)) {
      collection.groupCollections.forEach((group: any) => {
        if (group.name) {
          orgNames.add(canonicalizeOrgName(group.name));
        }
      });
    }
  });

  // Filter out empty names
  orgNames.delete('');

  logger.info(`Found ${orgNames.size} unique organizations to score`);

  // Calculate engagement for each organization
  const engagements: OrganizationEngagement[] = [];
  const orgNamesArray = Array.from(orgNames);

  for (const canonicalName of orgNamesArray) {
    try {
      const engagement = await calculateOrganizationEngagement(
        canonicalName,
        allEventRequests,
        allCollections
      );
      engagements.push(engagement);
    } catch (error) {
      logger.warn(`Failed to calculate engagement for ${canonicalName}`, { error });
    }
  }

  // Sort by engagement score (lowest first for priority attention)
  engagements.sort((a, b) => a.scores.overall - b.scores.overall);

  logger.info(`Calculated engagement scores for ${engagements.length} organizations`);

  return engagements;
}

/**
 * Get summary insights for the entire groups catalog
 */
export async function getGroupInsightsSummary(): Promise<GroupInsightsSummary> {
  const engagements = await calculateAllOrganizationEngagement();

  // Calculate distribution
  const engagementDistribution = {
    highlyEngaged: 0,
    engaged: 0,
    moderate: 0,
    low: 0,
    atRisk: 0,
    dormant: 0,
    new: 0
  };

  const outreachPriorities = {
    urgent: 0,
    high: 0,
    normal: 0,
    low: 0
  };

  const categoryBreakdown: Record<string, { count: number; totalScore: number }> = {};

  engagements.forEach(eng => {
    // Count engagement levels
    switch (eng.engagementLevel) {
      case 'highly_engaged': engagementDistribution.highlyEngaged++; break;
      case 'engaged': engagementDistribution.engaged++; break;
      case 'moderate': engagementDistribution.moderate++; break;
      case 'low': engagementDistribution.low++; break;
      case 'at_risk': engagementDistribution.atRisk++; break;
      case 'dormant': engagementDistribution.dormant++; break;
      case 'new': engagementDistribution.new++; break;
    }

    // Count outreach priorities
    outreachPriorities[eng.outreachPriority]++;

    // Aggregate by category
    const cat = eng.category || 'uncategorized';
    if (!categoryBreakdown[cat]) {
      categoryBreakdown[cat] = { count: 0, totalScore: 0 };
    }
    categoryBreakdown[cat].count++;
    categoryBreakdown[cat].totalScore += eng.scores.overall;
  });

  // Calculate category averages
  const categoryBreakdownFinal: Record<string, { count: number; avgEngagementScore: number }> = {};
  for (const [cat, data] of Object.entries(categoryBreakdown)) {
    categoryBreakdownFinal[cat] = {
      count: data.count,
      avgEngagementScore: Math.round((data.totalScore / data.count) * 100) / 100
    };
  }

  // Calculate overall average
  const totalScore = engagements.reduce((sum, eng) => sum + eng.scores.overall, 0);
  const averageEngagementScore = engagements.length > 0
    ? Math.round((totalScore / engagements.length) * 100) / 100
    : 0;

  // Get top performers (highest engagement)
  const topPerformers = engagements
    .filter(eng => eng.engagementLevel === 'highly_engaged' || eng.engagementLevel === 'engaged')
    .sort((a, b) => b.scores.overall - a.scores.overall)
    .slice(0, 10);

  // Get organizations needing attention (urgent/high priority)
  const needsAttention = engagements
    .filter(eng => eng.outreachPriority === 'urgent' || eng.outreachPriority === 'high')
    .sort((a, b) => {
      // Urgent first, then by score
      if (a.outreachPriority === 'urgent' && b.outreachPriority !== 'urgent') return -1;
      if (b.outreachPriority === 'urgent' && a.outreachPriority !== 'urgent') return 1;
      return a.scores.overall - b.scores.overall;
    })
    .slice(0, 10);

  // Get new opportunities (new orgs with completed events)
  const newOpportunities = engagements
    .filter(eng => eng.engagementLevel === 'new' && eng.metrics.completedEvents > 0)
    .sort((a, b) => b.scores.overall - a.scores.overall)
    .slice(0, 10);

  return {
    totalOrganizations: engagements.length,
    engagementDistribution,
    outreachPriorities,
    categoryBreakdown: categoryBreakdownFinal,
    averageEngagementScore,
    topPerformers,
    needsAttention,
    newOpportunities
  };
}

/**
 * Save engagement scores to database (for caching/historical tracking)
 */
export async function saveEngagementScores(engagements: OrganizationEngagement[]): Promise<void> {
  logger.info(`Saving ${engagements.length} engagement scores to database`);

  for (const eng of engagements) {
    try {
      await db.insert(organizationEngagementScores)
        .values({
          organizationName: eng.organizationName,
          canonicalName: eng.canonicalName,
          category: eng.category,
          overallEngagementScore: eng.scores.overall.toString(),
          frequencyScore: eng.scores.frequency.toString(),
          recencyScore: eng.scores.recency.toString(),
          volumeScore: eng.scores.volume.toString(),
          completionScore: eng.scores.completion.toString(),
          consistencyScore: eng.scores.consistency.toString(),
          engagementTrend: eng.engagementTrend,
          trendPercentChange: eng.trendPercentChange.toString(),
          totalEvents: eng.metrics.totalEvents,
          completedEvents: eng.metrics.completedEvents,
          totalSandwiches: eng.metrics.totalSandwiches,
          daysSinceLastEvent: eng.metrics.daysSinceLastEvent,
          daysSinceFirstEvent: eng.metrics.daysSinceFirstEvent,
          lastEventDate: eng.metrics.lastEventDate,
          firstEventDate: eng.metrics.firstEventDate,
          averageEventInterval: eng.metrics.averageEventInterval,
          engagementLevel: eng.engagementLevel,
          outreachPriority: eng.outreachPriority,
          recommendedActions: eng.recommendedActions,
          insights: eng.insights,
          programSuitability: eng.programSuitability,
          lastCalculatedAt: eng.lastCalculatedAt,
          calculationVersion: '1.0'
        })
        .onConflictDoUpdate({
          target: organizationEngagementScores.canonicalName,
          set: {
            organizationName: eng.organizationName,
            category: eng.category,
            overallEngagementScore: eng.scores.overall.toString(),
            frequencyScore: eng.scores.frequency.toString(),
            recencyScore: eng.scores.recency.toString(),
            volumeScore: eng.scores.volume.toString(),
            completionScore: eng.scores.completion.toString(),
            consistencyScore: eng.scores.consistency.toString(),
            engagementTrend: eng.engagementTrend,
            trendPercentChange: eng.trendPercentChange.toString(),
            totalEvents: eng.metrics.totalEvents,
            completedEvents: eng.metrics.completedEvents,
            totalSandwiches: eng.metrics.totalSandwiches,
            daysSinceLastEvent: eng.metrics.daysSinceLastEvent,
            daysSinceFirstEvent: eng.metrics.daysSinceFirstEvent,
            lastEventDate: eng.metrics.lastEventDate,
            firstEventDate: eng.metrics.firstEventDate,
            averageEventInterval: eng.metrics.averageEventInterval,
            engagementLevel: eng.engagementLevel,
            outreachPriority: eng.outreachPriority,
            recommendedActions: eng.recommendedActions,
            insights: eng.insights,
            programSuitability: eng.programSuitability,
            lastCalculatedAt: eng.lastCalculatedAt,
            calculationVersion: '1.0',
            updatedAt: new Date()
          }
        });
    } catch (error) {
      logger.warn(`Failed to save engagement score for ${eng.canonicalName}`, { error });
    }
  }

  logger.info('Finished saving engagement scores');
}
