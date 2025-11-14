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

// Validate OpenAI API key is configured
if (!process.env.AI_INTEGRATIONS_OPENAI_API_KEY) {
  throw new Error('AI_INTEGRATIONS_OPENAI_API_KEY environment variable is required for impact report generation');
}

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

// Report generation result
export interface ImpactReportGenerationResult {
  title: string;
  executiveSummary: string;
  content: string; // Markdown format
  metrics: {
    eventsCompleted: number;
    sandwichesDistributed: number;
    peopleServed: number;
    volunteersEngaged: number;
    organizationsServed: number;
    hoursVolunteered?: number;
    expensesTotal?: number;
  };
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
    const report = await generateReportWithAI(dataContext, startDate, endDate, reportType, data.metrics);

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
 * Gather all relevant data from the database for the report period
 */
async function gatherReportData(startDate: Date, endDate: Date) {
  logger.info('Gathering report data', { startDate, endDate });

  // Get completed events in the period
  const events = await db.query.eventRequests.findMany({
    where: and(
      eq(eventRequests.status, 'completed'),
      gte(eventRequests.scheduledEventDate, startDate),
      lt(eventRequests.scheduledEventDate, endDate)
    ),
  });

  // Get sandwich collections
  const collections = await db.query.sandwichCollections.findMany({
    where: and(
      gte(sandwichCollections.collectionDate, startDate),
      lt(sandwichCollections.collectionDate, endDate)
    ),
  });

  // Get expenses for the period
  const expensesList = await db.query.expenses.findMany({
    where: and(
      gte(expenses.purchaseDate, startDate),
      lt(expenses.purchaseDate, endDate)
    ),
  });

  // Calculate totals
  const totalSandwiches = collections.reduce((sum, c) => sum + (c.sandwichCount || 0), 0);
  const totalExpenses = expensesList.reduce((sum, e) => {
    if (typeof e.amount === 'number' && !isNaN(e.amount)) {
      return sum + e.amount;
    } else {
      logger.warn('Invalid expense amount encountered', { amount: e.amount, expense: e });
      return sum;
    }
  }, 0);

  const uniqueOrganizations = new Set(events.map(e => e.organizationName).filter(Boolean));
  const uniqueVolunteers = new Set([
    ...events.flatMap(e => e.assignedVolunteerIds || []),
    ...events.flatMap(e => e.assignedDriverIds || []),
    ...events.flatMap(e => e.assignedSpeakerIds || []),
  ].filter(Boolean));

  return {
    events,
    collections,
    expenses: expensesList,
    metrics: {
      eventsCompleted: events.length,
      sandwichesDistributed: totalSandwiches,
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
  context.push(`- Sandwiches Distributed: ${data.metrics.sandwichesDistributed}`);
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
      .sort((a, b) => (b.actualSandwichCount || b.estimatedSandwichCount || 0) -
                       (a.actualSandwichCount || a.estimatedSandwichCount || 0))
      .slice(0, 5);

    context.push(`## Notable Events:`);
    topEvents.forEach((e: EventRequest) => {
      const sandwiches = e.actualSandwichCount || e.estimatedSandwichCount || 0;
      context.push(`- ${e.organizationName || 'Unknown'}: ${sandwiches} sandwiches`);
    });
    context.push('');
  }

  // Add expense breakdown
  if (data.expenses.length > 0) {
    context.push(`# Expense Breakdown`);
    const byCategory: Record<string, number> = {};
    data.expenses.forEach((e: Expense) => {
      const cat = e.category || 'other';
      const amount = typeof e.amount === 'string' ? parseFloat(e.amount) : e.amount;
      byCategory[cat] = (byCategory[cat] || 0) + amount;
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
    organizationsServed: number;
    volunteersEngaged: number;
    expensesTotal: number;
  }
): Promise<ImpactReportGenerationResult> {
  const periodLabel = formatPeriodLabel(startDate, endDate, reportType);

  const completion = await openai.chat.completions.create({
    model: 'gpt-4o',
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
    temperature: 0.7,
    max_tokens: 3000,
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
      // Note: peopleServed is estimated as 1:1 with sandwichesDistributed
      // This is an approximation since actual people served data is not tracked
      // In reality, some people may receive multiple sandwiches, and some sandwiches may go unused
      peopleServed: metrics.sandwichesDistributed,
      volunteersEngaged: metrics.volunteersEngaged,
      organizationsServed: metrics.organizationsServed,
      expensesTotal: metrics.expensesTotal,
    },
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
    return `${monthNames[startDate.getMonth()]} ${startDate.getFullYear()}`;
  } else if (reportType === 'quarterly') {
    const quarter = Math.floor(startDate.getMonth() / 3) + 1;
    return `Q${quarter} ${startDate.getFullYear()}`;
  } else if (reportType === 'annual') {
    return `${startDate.getFullYear()}`;
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
        aiModel: 'gpt-4o',
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
    aiModel: 'gpt-4o',
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
    return `${startDate.getFullYear()}-${String(startDate.getMonth() + 1).padStart(2, '0')}`;
  } else if (reportType === 'quarterly') {
    const quarter = Math.floor(startDate.getMonth() / 3) + 1;
    return `${startDate.getFullYear()}-Q${quarter}`;
  } else if (reportType === 'annual') {
    return `${startDate.getFullYear()}`;
  } else {
    const end = endDate || startDate;
    return `${startDate.toISOString().split('T')[0]}_${end.toISOString().split('T')[0]}`;
  }
}
