import OpenAI from 'openai';
import type { EventRequest } from '@shared/schema';
import { logger } from '../../utils/production-safe-logger';

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

interface NearbyEvent {
  organizationName: string;
  date: string;
  estimatedSandwichCount: number;
}

interface DateAnalysis {
  date: string;
  dayOfWeek: string;
  weekStarting: string;
  totalScheduledSandwiches: number;
  eventCount: number;
  isOptimal: boolean;
  nearbyEvents: NearbyEvent[];
}

interface AiDateSuggestion {
  recommendedDate: string;
  reasoning: string;
  dateAnalysis: DateAnalysis[];
  confidence: 'high' | 'medium' | 'low';
  originallyRequestedDate: string | null;
}

interface OpenAiDateResponse {
  recommendedDate: string;
  reasoning: string;
  confidence: number;
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

  // Call OpenAI for intelligent recommendation with structured JSON output
  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are an AI assistant for The Sandwich Project, a nonprofit that coordinates volunteers to make sandwiches for people experiencing food insecurity. Your goal is to help analyze their requested event date and suggest alternatives only when needed.

CRITICAL CONSTRAINT: You may ONLY recommend dates on or after their originally requested date. NEVER recommend a date before what they requested.

Most event requests are NOT flexible, so:
1. Start by analyzing what's happening on their requested date
2. If their requested date looks fine (fewer than 4 events that week, under 4,000 sandwiches), recommend it
3. Only suggest an alternative if their requested date is very busy or creates an imbalance
4. All alternatives must be on or after their requested date - never suggest earlier dates
5. Explain what events are already scheduled that week so they understand the context

When suggesting alternatives, consider:
- Balance - Prefer weeks with fewer scheduled sandwiches
- Distribution - Avoid clustering too many events in one week  
- Nearby dates - Only suggest dates close to their request (within 1-3 days) and AFTER their request
- Impact - Help maintain steady sandwich production toward the 500,000 annual goal

You must respond with a JSON object containing exactly these fields:
- recommendedDate: The date in YYYY-MM-DD format that you recommend (MUST be on or after their requested date!)
- reasoning: A clear explanation focusing on what's happening that week and why you're recommending this date (2-3 sentences)
- confidence: A number from 0-100 indicating your confidence in this recommendation`
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      response_format: { type: "json_object" },
      temperature: 0.7,
      max_tokens: 500,
    });

    const aiResponse = completion.choices[0].message.content || '';
    
    // Parse the JSON response from OpenAI
    const parsedResponse: OpenAiDateResponse = JSON.parse(aiResponse);
    
    // Validate the response has required fields
    if (!parsedResponse.recommendedDate || !parsedResponse.reasoning || typeof parsedResponse.confidence !== 'number') {
      throw new Error('Invalid AI response structure');
    }

    // Normalize the AI-recommended date to YYYY-MM-DD format (remove timestamps if present)
    const normalizedRecommendedDate = parsedResponse.recommendedDate.split('T')[0];

    // Validate the recommended date is one of the available options
    const isValidDate = dateAnalyses.some(analysis => analysis.date === normalizedRecommendedDate);
    if (!isValidDate) {
      logger.warn(`AI recommended date ${normalizedRecommendedDate} is not in available options, falling back to heuristic`);
      logger.warn(`Available options: ${dateAnalyses.map(d => d.date).join(', ')}`);
      throw new Error('AI recommended date not in available options');
    }

    // CRITICAL VALIDATION: Ensure recommended date is not before the requested date
    const desiredDate = eventRequest.desiredEventDate;
    if (desiredDate && normalizedRecommendedDate < desiredDate) {
      logger.error(`AI recommended date ${normalizedRecommendedDate} is BEFORE requested date ${desiredDate}, falling back to heuristic`);
      throw new Error('AI recommended date before requested date - this should never happen');
    }

    // Convert numeric confidence (0-100) to categorical
    const confidence: 'high' | 'medium' | 'low' = 
      parsedResponse.confidence >= 70 ? 'high' :
      parsedResponse.confidence >= 40 ? 'medium' : 'low';

    logger.log(`AI scheduling recommendation: ${normalizedRecommendedDate} (confidence: ${parsedResponse.confidence})`);

    return {
      recommendedDate: normalizedRecommendedDate,
      reasoning: parsedResponse.reasoning,
      dateAnalysis: dateAnalyses,
      confidence,
      originallyRequestedDate: eventRequest.desiredEventDate || null,
    };
  } catch (error) {
    // Log the error and fall back to heuristic-based recommendation
    logger.error('OpenAI scheduling failed, falling back to heuristic', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      eventRequestId: eventRequest.id,
      hasApiKey: !!process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
      apiKeyLength: process.env.AI_INTEGRATIONS_OPENAI_API_KEY?.length || 0,
    });
    console.error('❌ OpenAI API Error Details:', error);
    
    const fallbackDate = determineRecommendedDateHeuristic(dateAnalyses);
    const fallbackConfidence = calculateConfidence(dateAnalyses);

    return {
      recommendedDate: fallbackDate,
      reasoning: 'Automatic recommendation based on balancing sandwich production across weeks. (AI suggestion unavailable)',
      dateAnalysis: dateAnalyses,
      confidence: fallbackConfidence,
      originallyRequestedDate: eventRequest.desiredEventDate || null,
    };
  }
}

/**
 * Extracts all possible dates from an event request
 * Focus on requested date + a few nearby alternatives if needed
 */
function extractPossibleDates(eventRequest: EventRequest): string[] {
  const dates: string[] = [];
  const desiredDate = eventRequest.desiredEventDate;

  // If no desired date, we can't suggest alternatives
  if (!desiredDate) {
    return dates;
  }

  // Add the desired event date (primary focus)
  dates.push(desiredDate);

  // Add 1-2 nearby alternatives to give AI flexibility for very busy weeks
  // This keeps the analysis focused while still allowing smart suggestions
  const baseDate = new Date(desiredDate);
  
  // Add the day after
  const dayAfter = new Date(baseDate);
  dayAfter.setDate(dayAfter.getDate() + 1);
  dates.push(dayAfter.toISOString().split('T')[0]);
  
  // Add 3 days later as another option
  const threeDaysLater = new Date(baseDate);
  threeDaysLater.setDate(threeDaysLater.getDate() + 3);
  dates.push(threeDaysLater.toISOString().split('T')[0]);

  // Add backup dates if explicitly provided (must be on or after desired date)
  if (eventRequest.backupDates && eventRequest.backupDates.length > 0) {
    eventRequest.backupDates.forEach(backupDate => {
      if (!dates.includes(backupDate) && backupDate >= desiredDate) {
        dates.push(backupDate);
      }
    });
  }

  // Parse dates from message field (must be on or after desired date)
  if (eventRequest.message) {
    const extractedDates = extractDatesFromText(eventRequest.message);
    extractedDates.forEach(date => {
      if (!dates.includes(date) && date >= desiredDate) {
        dates.push(date);
      }
    });
  }

  // CRITICAL: Filter out any dates before the requested date
  // This ensures we never recommend a date earlier than what they asked for
  return dates.filter(date => date && date >= desiredDate);
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

  // Get day of week
  const dayOfWeek = targetDate.toLocaleDateString('en-US', { weekday: 'long', timeZone: 'UTC' });

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

  // Build nearby events list and sort by date
  const nearbyEvents: NearbyEvent[] = eventsInWeek
    .map(event => ({
      organizationName: event.organizationName || 'Unknown Organization',
      date: event.scheduledEventDate!,
      estimatedSandwichCount: event.estimatedSandwichCount || 0,
    }))
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  // Determine if this is an optimal choice (fewer events = better)
  const isOptimal = eventsInWeek.length <= 2 && totalSandwiches < 5000;

  return {
    date,
    dayOfWeek,
    weekStarting: weekStart.toISOString().split('T')[0],
    totalScheduledSandwiches: totalSandwiches,
    eventCount: eventsInWeek.length,
    isOptimal,
    nearbyEvents,
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
  const requestedDate = eventRequest.desiredEventDate 
    ? new Date(eventRequest.desiredEventDate).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' })
    : 'Not specified';

  const organizationInfo = `
Organization: ${eventRequest.organizationName}
${eventRequest.department ? `Department: ${eventRequest.department}` : ''}
Estimated Participants: ${eventRequest.estimatedSandwichCount || 'Not specified'}
Originally Requested Date: ${requestedDate}
${eventRequest.message ? `Message: ${eventRequest.message}` : ''}
`.trim();

  const dateOptions = dateAnalyses.map((analysis, idx) => {
    const isRequestedDate = analysis.date === eventRequest.desiredEventDate;
    return `
Option ${idx + 1}: ${new Date(analysis.date).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' })}${isRequestedDate ? ' [ORIGINALLY REQUESTED]' : ''}
  - Week of: ${new Date(analysis.weekStarting).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })}
  - Events already scheduled that week: ${analysis.eventCount}
  - Total sandwiches scheduled that week: ${analysis.totalScheduledSandwiches.toLocaleString()}
  - Status: ${analysis.isOptimal ? '✓ Good balance' : '⚠ Busy week'}
`.trim();
  }).join('\n\n');

  return `${organizationInfo}

AVAILABLE DATE OPTIONS (all on or after their requested date):
${dateOptions}

IMPORTANT: You may ONLY recommend dates on or after their originally requested date (${requestedDate}).

Based on this information, which date would you recommend and why? Consider:
1. Balancing sandwich production across weeks
2. Avoiding overburdening volunteers in busy weeks
3. The organization's needs and constraints
4. Their originally requested date should be preferred unless there's a compelling reason to suggest an alternative

Provide a clear recommendation with specific reasoning.`;
}

/**
 * Determines the recommended date using heuristics (fallback method)
 * Used when AI recommendation is unavailable or invalid
 */
function determineRecommendedDateHeuristic(dateAnalyses: DateAnalysis[]): string {
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
