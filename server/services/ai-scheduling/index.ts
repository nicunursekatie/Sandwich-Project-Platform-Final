import OpenAI from 'openai';
import type { EventRequest } from '@shared/schema';

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

interface DateAnalysis {
  date: string;
  weekStarting: string;
  totalScheduledSandwiches: number;
  eventCount: number;
  isOptimal: boolean;
}

interface AiDateSuggestion {
  recommendedDate: string;
  reasoning: string;
  dateAnalysis: DateAnalysis[];
  confidence: 'high' | 'medium' | 'low';
}

/**
 * Analyzes possible event dates and suggests the optimal date
 * based on current scheduled events and sandwich distribution
 */
export async function suggestOptimalEventDate(
  eventRequest: EventRequest,
  allScheduledEvents: EventRequest[]
): Promise<AiDateSuggestion> {
  // Extract all possible dates from the event request
  const possibleDates = extractPossibleDates(eventRequest);
  
  if (possibleDates.length === 0) {
    throw new Error('No dates found in event request');
  }

  // Analyze each possible date
  const dateAnalyses = possibleDates.map(date => analyzeDateOption(date, allScheduledEvents));

  // Create prompt for OpenAI
  const prompt = buildPrompt(eventRequest, dateAnalyses);

  // Call OpenAI for intelligent recommendation
  const completion = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      {
        role: 'system',
        content: `You are an AI assistant for The Sandwich Project, a nonprofit that coordinates volunteers to make sandwiches for people experiencing food insecurity. Your goal is to help schedule events that balance sandwich production throughout the year, preventing weeks with too many or too few events.

When analyzing dates, consider:
1. Balance - Prefer weeks with fewer scheduled sandwiches
2. Distribution - Avoid clustering too many events in one week
3. Feasibility - Account for the organization's message and constraints
4. Impact - Help maintain steady sandwich production toward the 500,000 annual goal

Provide clear, actionable recommendations with reasoning.`
      },
      {
        role: 'user',
        content: prompt
      }
    ],
    temperature: 0.7,
    max_tokens: 500,
  });

  const aiResponse = completion.choices[0].message.content || '';

  // Parse AI response and determine recommended date
  const recommendedDate = determineRecommendedDate(dateAnalyses, aiResponse);
  const confidence = calculateConfidence(dateAnalyses);

  return {
    recommendedDate,
    reasoning: aiResponse,
    dateAnalysis: dateAnalyses,
    confidence,
  };
}

/**
 * Extracts all possible dates from an event request
 */
function extractPossibleDates(eventRequest: EventRequest): string[] {
  const dates: string[] = [];

  // Add desired event date
  if (eventRequest.desiredEventDate) {
    dates.push(eventRequest.desiredEventDate);
  }

  // Add backup dates if available
  if (eventRequest.backupDates && eventRequest.backupDates.length > 0) {
    dates.push(...eventRequest.backupDates);
  }

  // Parse dates from message field
  if (eventRequest.message) {
    const extractedDates = extractDatesFromText(eventRequest.message);
    extractedDates.forEach(date => {
      if (!dates.includes(date)) {
        dates.push(date);
      }
    });
  }

  return dates.filter(Boolean);
}

/**
 * Extracts dates from natural language text
 */
function extractDatesFromText(text: string): string[] {
  const dates: string[] = [];
  
  // Simple date patterns - can be enhanced
  const datePatterns = [
    /\b(\d{1,2}\/\d{1,2}\/\d{2,4})\b/g, // MM/DD/YYYY or M/D/YY
    /\b(\d{1,2}-\d{1,2}-\d{2,4})\b/g,   // MM-DD-YYYY
  ];

  datePatterns.forEach(pattern => {
    const matches = text.match(pattern);
    if (matches) {
      dates.push(...matches);
    }
  });

  return dates;
}

/**
 * Analyzes a specific date option against scheduled events
 */
function analyzeDateOption(date: string, scheduledEvents: EventRequest[]): DateAnalysis {
  const targetDate = new Date(date);
  const weekStart = getWeekStart(targetDate);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 7);

  // Find all events in the same week
  const eventsInWeek = scheduledEvents.filter(event => {
    if (!event.scheduledEventDate) return false;
    const eventDate = new Date(event.scheduledEventDate);
    return eventDate >= weekStart && eventDate < weekEnd;
  });

  // Calculate total sandwiches for the week
  const totalSandwiches = eventsInWeek.reduce((sum, event) => {
    return sum + (event.estimatedSandwichCount || 0);
  }, 0);

  // Determine if this is an optimal choice (fewer events = better)
  const isOptimal = eventsInWeek.length <= 2 && totalSandwiches < 5000;

  return {
    date,
    weekStarting: weekStart.toISOString().split('T')[0],
    totalScheduledSandwiches: totalSandwiches,
    eventCount: eventsInWeek.length,
    isOptimal,
  };
}

/**
 * Gets the Monday of the week for a given date
 */
function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Adjust when day is Sunday
  return new Date(d.setDate(diff));
}

/**
 * Builds the prompt for OpenAI
 */
function buildPrompt(eventRequest: EventRequest, dateAnalyses: DateAnalysis[]): string {
  const organizationInfo = `
Organization: ${eventRequest.organizationName}
${eventRequest.department ? `Department: ${eventRequest.department}` : ''}
Estimated Participants: ${eventRequest.estimatedSandwichCount || 'Not specified'}
${eventRequest.message ? `Message: ${eventRequest.message}` : ''}
`.trim();

  const dateOptions = dateAnalyses.map((analysis, idx) => {
    return `
Option ${idx + 1}: ${new Date(analysis.date).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
  - Week of: ${new Date(analysis.weekStarting).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
  - Events already scheduled that week: ${analysis.eventCount}
  - Total sandwiches scheduled that week: ${analysis.totalScheduledSandwiches.toLocaleString()}
  - Status: ${analysis.isOptimal ? '✓ Good balance' : '⚠ Busy week'}
`.trim();
  }).join('\n\n');

  return `${organizationInfo}

AVAILABLE DATE OPTIONS:
${dateOptions}

Based on this information, which date would you recommend and why? Consider:
1. Balancing sandwich production across weeks
2. Avoiding overburdening volunteers in busy weeks
3. The organization's needs and constraints

Provide a clear recommendation with specific reasoning.`;
}

/**
 * Determines the recommended date from analyses
 */
function determineRecommendedDate(dateAnalyses: DateAnalysis[], aiResponse: string): string {
  // Find the optimal date (fewest events + sandwiches)
  const sorted = [...dateAnalyses].sort((a, b) => {
    // Prioritize weeks with fewer events
    if (a.eventCount !== b.eventCount) {
      return a.eventCount - b.eventCount;
    }
    // Then by total sandwiches
    return a.totalScheduledSandwiches - b.totalScheduledSandwiches;
  });

  return sorted[0].date;
}

/**
 * Calculates confidence level based on date analysis variance
 */
function calculateConfidence(dateAnalyses: DateAnalysis[]): 'high' | 'medium' | 'low' {
  if (dateAnalyses.length === 1) return 'low';

  const eventCounts = dateAnalyses.map(d => d.eventCount);
  const sandwichCounts = dateAnalyses.map(d => d.totalScheduledSandwiches);

  const maxEvents = Math.max(...eventCounts);
  const minEvents = Math.min(...eventCounts);
  const maxSandwiches = Math.max(...sandwichCounts);
  const minSandwiches = Math.min(...sandwichCounts);

  // High confidence if there's a clear winner
  if (maxEvents - minEvents >= 2 || maxSandwiches - minSandwiches >= 3000) {
    return 'high';
  }

  // Medium confidence if moderate difference
  if (maxEvents - minEvents >= 1 || maxSandwiches - minSandwiches >= 1000) {
    return 'medium';
  }

  return 'low';
}
