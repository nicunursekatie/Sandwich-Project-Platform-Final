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

  // Top hosts
  const topHosts = Object.entries(hostStats)
    .sort((a, b) => b[1].sandwiches - a[1].sandwiches)
    .slice(0, 15)
    .map(([name, stats]) => ({ name, ...stats }));

  // Average collection size
  const avgCollectionSize = collections.length > 0
    ? Math.round(totalSandwiches / collections.length)
    : 0;

  return `
## Sandwich Collection Data Summary

### Overall Metrics
- Total Collections: ${collections.length}
- Total Sandwiches Collected: ${totalSandwiches.toLocaleString()}
- Average Sandwiches Per Collection: ${avgCollectionSize}
- Unique Hosts: ${Object.keys(hostStats).length}

### Top 15 Hosts by Sandwich Count
${topHosts.map((h, i) => `${i + 1}. ${h.name}: ${h.sandwiches.toLocaleString()} sandwiches (${h.collections} collections)`).join('\n')}

### Collections by Month
${Object.entries(monthlyStats)
  .sort(([a], [b]) => a.localeCompare(b))
  .map(([month, stats]) => `- ${month}: ${stats.collections} collections, ${stats.sandwiches.toLocaleString()} sandwiches`)
  .join('\n')}

### Collections by Day of Week
${dayNames.map(day => {
  const stats = dayOfWeekStats[day] || { collections: 0, sandwiches: 0 };
  return `- ${day}: ${stats.collections} collections, ${stats.sandwiches.toLocaleString()} sandwiches`;
}).join('\n')}
`;
}

// Build context for events
async function buildEventsContext(contextData?: Record<string, any>): Promise<string> {
  const allEvents = await db.query.eventRequests.findMany();

  // Calculate metrics
  const categoryStats: Record<string, { events: number; sandwiches: number }> = {};
  const monthlyStats: Record<string, { events: number; sandwiches: number }> = {};
  const statusCounts: Record<string, number> = {};
  let totalSandwiches = 0;

  allEvents.forEach(e => {
    const sandwichCount = e.actualSandwichCount || e.estimatedSandwichCount || 0;
    totalSandwiches += sandwichCount;

    // Category stats
    const category = e.organizationCategory || 'other';
    if (!categoryStats[category]) {
      categoryStats[category] = { events: 0, sandwiches: 0 };
    }
    categoryStats[category].events++;
    categoryStats[category].sandwiches += sandwichCount;

    // Monthly stats
    const eventDate = e.scheduledEventDate || e.desiredEventDate;
    if (eventDate) {
      const date = eventDate instanceof Date ? eventDate : new Date(eventDate);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      if (!monthlyStats[monthKey]) {
        monthlyStats[monthKey] = { events: 0, sandwiches: 0 };
      }
      monthlyStats[monthKey].events++;
      monthlyStats[monthKey].sandwiches += sandwichCount;
    }

    // Status counts
    const status = e.status || 'unknown';
    statusCounts[status] = (statusCounts[status] || 0) + 1;
  });

  return `
## Event Data Summary

### Overall Metrics
- Total Events: ${allEvents.length}
- Total Sandwiches: ${totalSandwiches.toLocaleString()}
- Average Per Event: ${allEvents.length > 0 ? Math.round(totalSandwiches / allEvents.length) : 0}

### Events by Status
${Object.entries(statusCounts)
  .sort((a, b) => b[1] - a[1])
  .map(([status, count]) => `- ${status}: ${count}`)
  .join('\n')}

### Events by Category
${Object.entries(categoryStats)
  .sort((a, b) => b[1].events - a[1].events)
  .map(([category, stats]) => `- ${category}: ${stats.events} events, ${stats.sandwiches.toLocaleString()} sandwiches`)
  .join('\n')}

### Events by Month
${Object.entries(monthlyStats)
  .sort(([a], [b]) => a.localeCompare(b))
  .map(([month, stats]) => `- ${month}: ${stats.events} events, ${stats.sandwiches.toLocaleString()} sandwiches`)
  .join('\n')}
`;
}

// Get system prompt for context type
function getSystemPrompt(contextType: string, dataSummary: string): string {
  const baseRules = `
CRITICAL RULES - YOU MUST FOLLOW THESE:
1. ONLY use the data provided below. Do NOT invent, assume, or hallucinate any data points, categories, or metrics.
2. The Sandwich Project does NOT track sandwich types (no "vegetarian", "turkey", "ham", etc.). They only track TOTAL sandwich counts.
3. If asked about something not in the data, say "That information is not tracked in the current data."
4. Never make up statistics or trends that aren't directly derivable from the provided data.

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
You help analyze sandwich collection data - who collected sandwiches, when, and how many.
Collections are submitted by hosts (individuals or groups) who organize sandwich-making events.`,

    events: `You are a data analyst assistant for The Sandwich Project's event management system.
You help analyze event request data - organizations requesting sandwich-making events, event categories, and scheduling.`,

    'impact-reports': `You are a data analyst assistant for The Sandwich Project's impact reporting.
You help analyze the overall impact of the organization including events, collections, and sandwich distribution.`,
  };

  const contextDesc = contextDescriptions[contextType] || contextDescriptions['collections'];

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
      default:
        dataSummary = await buildCollectionsContext(contextData);
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
