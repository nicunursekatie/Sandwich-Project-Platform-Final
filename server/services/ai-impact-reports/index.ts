import OpenAI from 'openai';
import { db } from '../../db';
import {
  eventRequests,
  sandwichCollections,
  expenses,
  impactReports,
  type EventRequest,
  type Expense
} from '../../../shared/schema';
import { and, eq, gte, lt } from 'drizzle-orm';
import { logger } from '../../utils/production-safe-logger';
import { parseJsonStrict } from '../../utils/safe-json';
import { getReportableSandwichCount } from '../../../shared/sandwich-count-utils';
import { getEffectiveEventDate } from '../../../shared/event-validation-utils';

// Lazy-initialize OpenAI client to avoid crashing app if API key is not configured
let openai: OpenAI | null = null;

function getOpenAIClient(): OpenAI {
  if (!process.env.AI_INTEGRATIONS_OPENAI_API_KEY) {
    throw new Error('AI_INTEGRATIONS_OPENAI_API_KEY environment variable is required for impact report generation');
  }

  if (!openai) {
    openai = new OpenAI({
      apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
      baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
    });
  }

  return openai;
}

// Report generation result
export interface ImpactReportGenerationResult {
  title: string;
  executiveSummary: string;
  content: string; // Markdown format
  metrics: {
    eventsCompleted: number;
    sandwichesDistributed: number;
    /** Subset of sandwichesDistributed attributable to group-event collections. */
    groupEventSandwiches?: number;
    /** groupEventSandwiches as a percentage of sandwichesDistributed. */
    groupEventPercentage?: number;
    peopleServed: number;
    volunteersEngaged: number;
    organizationsServed: number;
    hoursVolunteered?: number;
    expensesTotal?: number;
  };
  sandwichTypeBreakdown?: {
    deli: number;
    turkey: number;
    ham: number;
    pbj: number;
    generic: number;
  } | null;
  highlights: Array<{
    title: string;
    description: string;
    metric?: string;
  }>;
  trends: Array<{
    category: string;
    description: string;
  }>;
}

/**
 * Generate an AI-powered impact report for a specific time period
 */
export async function generateImpactReport(
  startDate: Date,
  endDate: Date,
  reportType: 'monthly' | 'quarterly' | 'annual' | 'custom' = 'monthly'
): Promise<ImpactReportGenerationResult> {
  const startTime = Date.now();

  try {
    logger.info('Starting AI impact report generation', {
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      reportType,
    });

    // 1. Gather data from database
    const data = await gatherReportData(startDate, endDate);

    // 2. Build context for AI
    const dataContext = buildDataContext(data);

    // 3. Generate report with AI (passing metrics directly to avoid fragile string parsing)
    const report = await generateReportWithAI(dataContext, startDate, endDate, reportType, data.metrics, data.sandwichTypeBreakdown);

    const duration = Date.now() - startTime;
    logger.info('AI impact report generation completed', {
      reportType,
      eventsCount: data.events.length,
      duration,
    });

    return report;

  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error('AI impact report generation failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
      duration,
    });

    throw error;
  }
}

/**
 * Calculate GROUP sandwich count from a collection record (groups only,
 * excluding individualSandwiches). Used to surface the group-event subset
 * of the period total — i.e., sandwiches contributed by organized group
 * collections (schools, churches, corporate, etc.) as distinct from host
 * weekly drop-offs / individual contributions.
 */
function getCollectionSandwichCount(collection: any): number {
  let total = 0;

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

/**
 * Calculate TOTAL sandwich count from a collection record — the project-wide
 * single-source-of-truth formula: individualSandwiches + sum(groupCollections).
 * This is what we mean by "sandwiches distributed" at the headline level.
 */
function getCollectionTotalSandwichCount(collection: any): number {
  return (collection.individualSandwiches || 0) + getCollectionSandwichCount(collection);
}

/**
 * Convert a Date to YYYY-MM-DD string for consistent comparisons
 * This avoids timezone issues by comparing date strings directly
 */
function toDateString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Gather all relevant data from the database for the report period
 */
async function gatherReportData(startDate: Date, endDate: Date) {
  logger.info('Gathering report data', { startDate, endDate });

  // Convert dates to YYYY-MM-DD strings for consistent comparison (avoids timezone issues)
  const startDateStr = toDateString(startDate);
  const endDateStr = toDateString(endDate);

  // Statuses that should be excluded from statistics (events that didn't/won't happen)
  const EXCLUDED_STATUSES = ['cancelled', 'declined'];

  // Get all events in the period - use scheduledEventDate OR desiredEventDate (matching component)
  const allEventRequests = await db.query.eventRequests.findMany();

  // Filter events by date range and exclude cancelled/declined (same as component does client-side)
  const events = allEventRequests.filter(e => {
    const eventDate = getEffectiveEventDate(e);
    if (!eventDate) return false;
    // Exclude events that didn't happen (cancelled, declined)
    if (e.status && EXCLUDED_STATUSES.includes(e.status)) return false;
    // Convert event date to string for comparison
    const eventDateStr = toDateString(new Date(eventDate));
    return eventDateStr >= startDateStr && eventDateStr < endDateStr;
  });

  // Get sandwich collections for the period
  const allCollections = await db.query.sandwichCollections.findMany();

  // Filter collections by date range using string comparison (avoids timezone issues)
  const collections = allCollections.filter(c => {
    if (c.deletedAt) return false; // Skip soft-deleted records
    const collectionDateStr = c.collectionDate;
    if (!collectionDateStr) return false;
    // YYYY-MM-DD strings are lexicographically sortable, so direct comparison works
    return collectionDateStr >= startDateStr && collectionDateStr < endDateStr;
  });

  // Get expenses for the period
  const expensesList = await db.query.expenses.findMany({
    where: and(
      gte(expenses.purchaseDate, startDate),
      lt(expenses.purchaseDate, endDate)
    ),
  });

  // Build a map of collections by eventRequestId for merging (matching component logic)
  const collectionsByEventId = new Map<number, typeof collections[0]>();
  const unlinkedCollections: typeof collections = [];
  const validEventIds = new Set(events.map(e => e.id));

  collections.forEach(c => {
    if (c.eventRequestId) {
      // Only use first collection per event (same as component)
      if (!collectionsByEventId.has(c.eventRequestId)) {
        collectionsByEventId.set(c.eventRequestId, c);
      }
    } else {
      // Truly unlinked collection
      unlinkedCollections.push(c);
    }
  });

  // Two distinct period totals, both computed from actual collection records
  // (consistent with the Group Collections Viewer and the project-wide single
  // source of truth in `sandwich_collections`):
  //
  //   totalSandwiches       — ALL sandwiches collected during the period
  //                           (individualSandwiches + groupCollections, across
  //                           every collection record in the date window).
  //                           This is the headline "Sandwiches Distributed".
  //
  //   groupEventSandwiches  — Subset attributable to group events: sandwiches
  //                           from the `groupCollections` JSONB array only.
  //                           Surfaced so the AI can report group % of total.
  let totalSandwiches = 0;
  let groupEventSandwiches = 0;
  let eventsWithCollections = 0;

  // Headline total: every collection in the period contributes its full count.
  collections.forEach(c => {
    totalSandwiches += getCollectionTotalSandwichCount(c);
    groupEventSandwiches += getCollectionSandwichCount(c);
  });

  // Bookkeeping for `totalEvents` (events that actually happened — measured by
  // having a linked collection record). Mirrors the prior logic so the
  // eventsCompleted metric does not change.
  events.forEach(e => {
    if (collectionsByEventId.has(e.id)) eventsWithCollections++;
  });
  let orphanedCollectionCount = 0;
  collectionsByEventId.forEach((_collection, eventRequestId) => {
    if (!validEventIds.has(eventRequestId)) orphanedCollectionCount++;
  });

  // Total events with actual collection data = events with collections + unlinked + orphaned
  const totalEvents = eventsWithCollections + unlinkedCollections.length + orphanedCollectionCount;

  const groupEventPercentage = totalSandwiches > 0
    ? (groupEventSandwiches / totalSandwiches) * 100
    : 0;

  const totalExpenses = expensesList.reduce((sum, e) => {
    if (typeof e.amount === 'number' && !isNaN(e.amount)) {
      return sum + e.amount;
    } else {
      logger.warn('Invalid expense amount encountered', { amount: e.amount, expense: e });
      return sum;
    }
  }, 0);

  // Include organizations from both events and unlinked collections
  const uniqueOrganizations = new Set([
    ...events.map(e => e.organizationName).filter(Boolean),
    ...unlinkedCollections.map(c => c.hostName).filter(Boolean),
  ]);
  const uniqueVolunteers = new Set([
    ...events.flatMap(e => e.assignedVolunteerIds || []),
    ...events.flatMap(e => e.assignedDriverIds || []),
    ...events.flatMap(e => e.assignedSpeakerIds || []),
  ].filter(Boolean));

  // Aggregate sandwich type data
  const sandwichTypeBreakdown: {
    deli: number;
    turkey: number;
    ham: number;
    pbj: number;
    generic: number;
  } = {
    deli: 0,
    turkey: 0,
    ham: 0,
    pbj: 0,
    generic: 0,
  };

  // From collections - individual sandwiches
  collections.forEach((c) => {
    sandwichTypeBreakdown.deli += c.individualDeli || 0;
    sandwichTypeBreakdown.turkey += c.individualTurkey || 0;
    sandwichTypeBreakdown.ham += c.individualHam || 0;
    sandwichTypeBreakdown.pbj += c.individualPbj || 0;
    sandwichTypeBreakdown.generic += c.individualGeneric || 0;

    // From groupCollections JSONB
    if (c.groupCollections && Array.isArray(c.groupCollections)) {
      c.groupCollections.forEach((group: any) => {
        sandwichTypeBreakdown.deli += group.deli || 0;
        sandwichTypeBreakdown.turkey += group.turkey || 0;
        sandwichTypeBreakdown.ham += group.ham || 0;
        sandwichTypeBreakdown.pbj += group.pbj || 0;
      });
    }
  });

  // From events - actualSandwichTypes
  events.forEach((e) => {
    if (e.actualSandwichTypes && Array.isArray(e.actualSandwichTypes)) {
      (e.actualSandwichTypes as Array<{ type: string; quantity: number }>).forEach((st) => {
        const type = st.type?.toLowerCase() || 'generic';
        if (type.includes('deli')) sandwichTypeBreakdown.deli += st.quantity || 0;
        else if (type.includes('turkey')) sandwichTypeBreakdown.turkey += st.quantity || 0;
        else if (type.includes('ham')) sandwichTypeBreakdown.ham += st.quantity || 0;
        else if (type.includes('pbj') || type.includes('peanut')) sandwichTypeBreakdown.pbj += st.quantity || 0;
        else sandwichTypeBreakdown.generic += st.quantity || 0;
      });
    }
  });

  // Calculate if we have meaningful type data
  const totalTypedSandwiches = Object.values(sandwichTypeBreakdown).reduce((a, b) => a + b, 0);
  const hasSandwichTypeData = totalTypedSandwiches > 0;

  return {
    events,
    collections,
    expenses: expensesList,
    sandwichTypeBreakdown: hasSandwichTypeData ? sandwichTypeBreakdown : null,
    metrics: {
      eventsCompleted: totalEvents, // Use totalEvents which includes unlinked + orphaned collections
      sandwichesDistributed: totalSandwiches,
      groupEventSandwiches,
      groupEventPercentage,
      organizationsServed: uniqueOrganizations.size,
      volunteersEngaged: uniqueVolunteers.size,
      expensesTotal: totalExpenses,
    },
  };
}

/**
 * Build context string from data for AI prompt
 */
function buildDataContext(data: any): string {
  const context: string[] = [];

  context.push(`# Overall Metrics`);
  context.push(`- Events Completed: ${data.metrics.eventsCompleted}`);
  context.push(
    `- Total Sandwiches Distributed (period total, all collections — individual + group): ${data.metrics.sandwichesDistributed.toLocaleString()}`
  );
  context.push(
    `- Group-Event Sandwiches (subset of the total above, contributed by organized group collections such as schools, churches, and corporate groups): ${data.metrics.groupEventSandwiches.toLocaleString()} (${data.metrics.groupEventPercentage.toFixed(1)}% of total distributed)`
  );
  context.push(
    `  NOTE: When referencing "sandwiches distributed" in the narrative, always use the Total. Use the Group-Event number and percentage when specifically discussing group participation; do not present it as the overall distribution figure.`
  );
  context.push(`- Organizations Served: ${data.metrics.organizationsServed}`);
  context.push(`- Volunteers Engaged: ${data.metrics.volunteersEngaged}`);
  context.push(`- Total Expenses: $${data.metrics.expensesTotal.toFixed(2)}`);
  context.push('');

  // Add event breakdown
  if (data.events.length > 0) {
    context.push(`# Event Breakdown`);

    // Group by organization category
    const byCategory: Record<string, number> = {};
    data.events.forEach((e: any) => {
      const cat = e.organizationCategory || 'other';
      byCategory[cat] = (byCategory[cat] || 0) + 1;
    });

    context.push(`## By Category:`);
    Object.entries(byCategory).forEach(([cat, count]) => {
      context.push(`- ${cat}: ${count} events`);
    });
    context.push('');

    // Notable events (top 5 by sandwich count)
    const topEvents = [...data.events]
      .sort((a, b) => getReportableSandwichCount(b, { ignoreSuspiciousEstimatedCounts: true }) -
                       getReportableSandwichCount(a, { ignoreSuspiciousEstimatedCounts: true }))
      .slice(0, 5);

    context.push(`## Notable Events:`);
    topEvents.forEach((e: EventRequest) => {
      const sandwiches = getReportableSandwichCount(e, { ignoreSuspiciousEstimatedCounts: true });
      context.push(`- ${e.organizationName || 'Unknown'}: ${sandwiches} sandwiches`);
    });
    context.push('');
  }

  // Add sandwich type breakdown if available
  if (data.sandwichTypeBreakdown) {
    const types = data.sandwichTypeBreakdown;
    const totalTyped = types.deli + types.turkey + types.ham + types.pbj + types.generic;

    context.push(`# Sandwich Type Breakdown`);
    context.push(`- Deli: ${types.deli.toLocaleString()} (${totalTyped > 0 ? ((types.deli / totalTyped) * 100).toFixed(1) : 0}%)`);
    context.push(`- Turkey: ${types.turkey.toLocaleString()} (${totalTyped > 0 ? ((types.turkey / totalTyped) * 100).toFixed(1) : 0}%)`);
    context.push(`- Ham: ${types.ham.toLocaleString()} (${totalTyped > 0 ? ((types.ham / totalTyped) * 100).toFixed(1) : 0}%)`);
    context.push(`- PB&J: ${types.pbj.toLocaleString()} (${totalTyped > 0 ? ((types.pbj / totalTyped) * 100).toFixed(1) : 0}%)`);
    if (types.generic > 0) {
      context.push(`- Other/Unspecified: ${types.generic.toLocaleString()} (${totalTyped > 0 ? ((types.generic / totalTyped) * 100).toFixed(1) : 0}%)`);
    }
    context.push(`- Total with type data: ${totalTyped.toLocaleString()}`);
    context.push('');
  }

  // Add expense breakdown
  if (data.expenses.length > 0) {
    context.push(`# Expense Breakdown`);
    const byCategory: Record<string, number> = {};
    data.expenses.forEach((e: Expense) => {
      const cat = e.category || 'other';
      const amount = typeof e.amount === 'string' ? parseFloat(e.amount) : e.amount;
      if (typeof amount === 'number' && !isNaN(amount)) {
        byCategory[cat] = (byCategory[cat] || 0) + amount;
      } else {
        logger.warn('Invalid expense amount in breakdown', { amount: e.amount, expense: e });
      }
    });

    Object.entries(byCategory).forEach(([cat, total]) => {
      context.push(`- ${cat}: $${total.toFixed(2)}`);
    });
    context.push('');
  }

  return context.join('\n');
}

/**
 * Generate report using AI
 */
async function generateReportWithAI(
  dataContext: string,
  startDate: Date,
  endDate: Date,
  reportType: string,
  metrics: {
    eventsCompleted: number;
    sandwichesDistributed: number;
    groupEventSandwiches: number;
    groupEventPercentage: number;
    organizationsServed: number;
    volunteersEngaged: number;
    expensesTotal: number;
  },
  sandwichTypeBreakdown?: {
    deli: number;
    turkey: number;
    ham: number;
    pbj: number;
    generic: number;
  } | null
): Promise<ImpactReportGenerationResult> {
  const periodLabel = formatPeriodLabel(startDate, endDate, reportType);

  const client = getOpenAIClient();
  const completion = await client.chat.completions.create({
    model: 'gpt-5',
    messages: [
      {
        role: 'system',
        content: `You are an impact report writer for The Sandwich Project, a nonprofit organization that makes and distributes sandwiches to people in need.

Your task is to create compelling, data-driven impact reports that showcase achievements and tell the story of community impact.

REPORT STRUCTURE:

1. **Title**: Create an engaging title (e.g., "Making a Difference: January 2025 Impact Report")

2. **Executive Summary** (2-3 paragraphs):
   - High-level overview of the period's achievements
   - Most impressive metrics
   - Key takeaways for stakeholders

3. **Content** (full report in markdown format with sections):
   - Introduction: Set the context
   - Key Achievements: Highlight major accomplishments
   - Impact Stories: Bring data to life with narrative
   - Volunteer Spotlight: Recognize volunteer contributions
   - Looking Ahead: Forward-looking statement
   - Thank You: Express gratitude to supporters

4. **Highlights** (3-5 key achievements):
   - Each with a title, description, and optional metric

5. **Trends** (2-4 observations):
   - Growth, seasonal patterns, emerging opportunities
   - Category: 'growth', 'decline', 'seasonal', or 'emerging'

WRITING GUIDELINES:
- Be inspiring but authentic - use real numbers
- Focus on human impact, not just metrics
- Use active voice and storytelling
- Acknowledge challenges if relevant
- Be concise yet comprehensive
- Use markdown formatting for content section
- Do not use emoji, icon characters, decorative bullets, or non-standard symbols. Plain text only.
- The "Total Sandwiches Distributed" figure is the period-wide total across ALL collection records (individual + group). Use this as the headline number whenever you say "sandwiches distributed".
- The "Group-Event Sandwiches" figure is a SUBSET of that total — sandwiches from organized group collections. When you mention it, always frame it as a portion of the total (e.g., "X group-event sandwiches, representing Y% of the period total") and never present it as the overall distribution figure.

Return JSON with this structure:
{
  "title": "string",
  "executiveSummary": "string (2-3 paragraphs)",
  "content": "string (full markdown report)",
  "highlights": [{"title": "string", "description": "string", "metric": "string optional"}],
  "trends": [{"category": "growth|decline|seasonal|emerging", "description": "string"}]
}`,
      },
      {
        role: 'user',
        content: `Generate an impact report for ${periodLabel}.\n\nData for the period:\n\n${dataContext}`,
      },
    ],
    response_format: { type: 'json_object' },
    max_completion_tokens: 8000,
    reasoning_effort: 'minimal',
  });

  const responseContent = completion.choices[0].message.content;
  if (!responseContent) {
    throw new Error('No response content from OpenAI');
  }

  const result = parseJsonStrict<any>(responseContent);

  // Use the metrics passed in directly (already calculated in gatherReportData)
  return {
    title: result.title,
    executiveSummary: result.executiveSummary,
    content: result.content,
    metrics: {
      eventsCompleted: metrics.eventsCompleted,
      sandwichesDistributed: metrics.sandwichesDistributed,
      groupEventSandwiches: metrics.groupEventSandwiches,
      groupEventPercentage: metrics.groupEventPercentage,
      // Note: peopleServed is estimated as 1:1 with sandwichesDistributed
      // This is an approximation since actual people served data is not tracked
      // In reality, some people may receive multiple sandwiches, and some sandwiches may go unused
      peopleServed: metrics.sandwichesDistributed,
      volunteersEngaged: metrics.volunteersEngaged,
      organizationsServed: metrics.organizationsServed,
      expensesTotal: metrics.expensesTotal,
    },
    sandwichTypeBreakdown: sandwichTypeBreakdown || null,
    highlights: result.highlights || [],
    trends: result.trends || [],
  };
}

/**
 * Format period label for display
 */
function formatPeriodLabel(startDate: Date, endDate: Date, reportType: string): string {
  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'];

  if (reportType === 'monthly') {
    return `${monthNames[startDate.getUTCMonth()]} ${startDate.getUTCFullYear()}`;
  } else if (reportType === 'quarterly') {
    const quarter = Math.floor(startDate.getUTCMonth() / 3) + 1;
    return `Q${quarter} ${startDate.getUTCFullYear()}`;
  } else if (reportType === 'annual') {
    return `${startDate.getUTCFullYear()}`;
  } else {
    return `${startDate.toLocaleDateString()} - ${endDate.toLocaleDateString()}`;
  }
}

/**
 * Save generated report to database
 */
export async function saveImpactReport(
  report: ImpactReportGenerationResult,
  startDate: Date,
  endDate: Date,
  reportType: 'monthly' | 'quarterly' | 'annual' | 'custom',
  generatedBy: string = 'ai'
): Promise<number> {
  const reportPeriod = formatReportPeriod(startDate, reportType, endDate);

  // Check if a report already exists for this period/type
  const existingReport = await db.query.impactReports.findFirst({
    where: and(
      eq(impactReports.reportPeriod, reportPeriod),
      eq(impactReports.reportType, reportType)
    ),
  });

  if (existingReport) {
    logger.info('Report already exists for this period, updating instead', {
      reportId: existingReport.id,
      reportPeriod,
      reportType,
    });

    // Update existing report instead of creating a new one
    await db.update(impactReports)
      .set({
        title: report.title,
        executiveSummary: report.executiveSummary,
        content: report.content,
        metrics: report.metrics as any,
        highlights: report.highlights as any,
        trends: report.trends as any,
        generatedBy,
        aiModel: 'gpt-5',
        regenerationCount: (existingReport.regenerationCount || 0) + 1,
        updatedAt: new Date(),
      })
      .where(eq(impactReports.id, existingReport.id));

    return existingReport.id;
  }

  // Create new report
  const [inserted] = await db.insert(impactReports).values({
    reportType,
    reportPeriod,
    startDate,
    endDate,
    title: report.title,
    executiveSummary: report.executiveSummary,
    content: report.content,
    metrics: report.metrics as any,
    highlights: report.highlights as any,
    trends: report.trends as any,
    generatedBy,
    aiModel: 'gpt-5',
    status: 'draft',
  }).returning();

  logger.info('Impact report saved to database', {
    reportId: inserted.id,
    reportPeriod,
    reportType,
  });

  return inserted.id;
}

/**
 * Format report period string
 */
function formatReportPeriod(startDate: Date, reportType: string, endDate?: Date): string {
  if (reportType === 'monthly') {
    return `${startDate.getUTCFullYear()}-${String(startDate.getUTCMonth() + 1).padStart(2, '0')}`;
  } else if (reportType === 'quarterly') {
    const quarter = Math.floor(startDate.getUTCMonth() / 3) + 1;
    return `${startDate.getUTCFullYear()}-Q${quarter}`;
  } else if (reportType === 'annual') {
    return `${startDate.getUTCFullYear()}`;
  } else {
    const end = endDate || startDate;
    return `${startDate.toISOString().split('T')[0]}_${end.toISOString().split('T')[0]}`;
  }
}
