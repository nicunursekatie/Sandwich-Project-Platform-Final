import OpenAI from 'openai';
import { logger } from '../utils/production-safe-logger';

/**
 * SMS Collection Parser Service
 * Parses natural language text messages into structured collection log data
 *
 * Supports various formats:
 * - "50 sandwiches at Downtown Library"
 * - "Made 30 today, 20 deli 10 pbj"
 * - "25 Youth Group, 15 Seniors at Community Center"
 * - "LOG 45 Main St Church"
 */

export interface ParsedCollectionData {
  hostName: string;
  individualSandwiches: number;
  individualDeli?: number;
  individualTurkey?: number;
  individualHam?: number;
  individualPbj?: number;
  groupCollections?: Array<{
    name: string;
    count: number;
    deli?: number;
    turkey?: number;
    ham?: number;
    pbj?: number;
  }>;
  collectionDate: string; // YYYY-MM-DD
  confidence: number; // 0.0-1.0
  needsClarification: boolean;
  clarificationMessage?: string;
}

export interface CollectionParseResult {
  success: boolean;
  data?: ParsedCollectionData;
  error?: string;
  rawMessage: string;
}

// Simple regex-based parser for structured messages
function parseStructuredMessage(message: string): CollectionParseResult | null {
  // Format: LOG <count> <host> or LOG <count> at <host>
  const logMatch = message.match(/^LOG\s+(\d+)\s+(?:at\s+)?(.+)$/i);
  if (logMatch) {
    const count = parseInt(logMatch[1], 10);
    const host = logMatch[2].trim();

    if (count > 0 && host.length >= 2) {
      return {
        success: true,
        data: {
          hostName: host,
          individualSandwiches: count,
          collectionDate: new Date().toISOString().split('T')[0],
          confidence: 0.95,
          needsClarification: false,
        },
        rawMessage: message,
      };
    }
  }

  // Format: <count> sandwiches at <host>
  const simpleMatch = message.match(/^(\d+)\s+(?:sandwiches?\s+)?(?:at\s+)?(.+)$/i);
  if (simpleMatch) {
    const count = parseInt(simpleMatch[1], 10);
    const host = simpleMatch[2].trim();

    if (count > 0 && host.length >= 2) {
      return {
        success: true,
        data: {
          hostName: host,
          individualSandwiches: count,
          collectionDate: new Date().toISOString().split('T')[0],
          confidence: 0.85,
          needsClarification: false,
        },
        rawMessage: message,
      };
    }
  }

  return null;
}

// AI-powered parser for complex messages
async function parseWithAI(message: string): Promise<CollectionParseResult> {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    logger.warn('[SMSCollectionParser] No OpenAI API key, falling back to simple parsing');
    return {
      success: false,
      error: 'Could not parse message. Try: LOG [count] [location name]',
      rawMessage: message,
    };
  }

  try {
    const client = new OpenAI({ apiKey });

    const today = new Date().toISOString().split('T')[0];

    const response = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      response_format: { type: 'json_object' },
      temperature: 0.1,
      max_tokens: 500,
      messages: [
        {
          role: 'system',
          content: `You are a parser for sandwich collection log SMS messages. Extract structured data from natural language texts about sandwich making events.

Output JSON with these fields:
- hostName: string (location/organization name, REQUIRED)
- individualSandwiches: number (total sandwiches made, REQUIRED, minimum 1)
- individualDeli: number (optional, deli sandwiches)
- individualTurkey: number (optional, turkey sandwiches)
- individualHam: number (optional, ham sandwiches)
- individualPbj: number (optional, PB&J sandwiches)
- groupCollections: array of {name, count, deli?, turkey?, ham?, pbj?} (optional, for group breakdowns)
- collectionDate: string YYYY-MM-DD (default to ${today} if not specified)
- confidence: number 0-1 (how confident you are in the parse)
- needsClarification: boolean (true if message is ambiguous)
- clarificationMessage: string (what to ask if clarification needed)

Examples:
"50 sandwiches at Downtown Library" → {hostName: "Downtown Library", individualSandwiches: 50, collectionDate: "${today}", confidence: 0.95, needsClarification: false}
"Made 30 today 20 deli 10 pbj at First Baptist" → {hostName: "First Baptist", individualSandwiches: 30, individualDeli: 20, individualPbj: 10, collectionDate: "${today}", confidence: 0.9, needsClarification: false}
"Youth group made 25, seniors made 15 at Community Center" → {hostName: "Community Center", individualSandwiches: 40, groupCollections: [{name: "Youth group", count: 25}, {name: "Seniors", count: 15}], collectionDate: "${today}", confidence: 0.85, needsClarification: false}
"made some sandwiches" → {needsClarification: true, clarificationMessage: "How many sandwiches and where? Reply: LOG [count] [location]", confidence: 0.2}

If the message doesn't seem to be about logging sandwiches at all, return needsClarification: true.`,
        },
        {
          role: 'user',
          content: message,
        },
      ],
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      return {
        success: false,
        error: 'Could not parse message. Try: LOG [count] [location name]',
        rawMessage: message,
      };
    }

    const parsed = JSON.parse(content);

    // Validate required fields
    if (parsed.needsClarification) {
      return {
        success: false,
        error: parsed.clarificationMessage || 'Could not understand message. Try: LOG [count] [location name]',
        rawMessage: message,
      };
    }

    if (!parsed.hostName || !parsed.individualSandwiches || parsed.individualSandwiches < 1) {
      return {
        success: false,
        error: 'Missing count or location. Try: LOG [count] [location name]',
        rawMessage: message,
      };
    }

    return {
      success: true,
      data: {
        hostName: parsed.hostName,
        individualSandwiches: parsed.individualSandwiches,
        individualDeli: parsed.individualDeli,
        individualTurkey: parsed.individualTurkey,
        individualHam: parsed.individualHam,
        individualPbj: parsed.individualPbj,
        groupCollections: parsed.groupCollections,
        collectionDate: parsed.collectionDate || today,
        confidence: parsed.confidence || 0.7,
        needsClarification: false,
      },
      rawMessage: message,
    };
  } catch (error) {
    logger.error('[SMSCollectionParser] AI parsing error:', error);
    return {
      success: false,
      error: 'Could not parse message. Try: LOG [count] [location name]',
      rawMessage: message,
    };
  }
}

/**
 * Main parsing function - tries simple regex first, then AI
 */
export async function parseCollectionSMS(message: string): Promise<CollectionParseResult> {
  const trimmedMessage = message.trim();

  // Try simple structured parsing first (fast, no API call)
  const simpleResult = parseStructuredMessage(trimmedMessage);
  if (simpleResult) {
    logger.info('[SMSCollectionParser] Parsed with simple regex:', simpleResult.data);
    return simpleResult;
  }

  // Fall back to AI parsing for complex messages
  logger.info('[SMSCollectionParser] Attempting AI parsing for:', trimmedMessage);
  return parseWithAI(trimmedMessage);
}

/**
 * Generate a confirmation message for parsed collection
 */
export function generateConfirmationMessage(data: ParsedCollectionData): string {
  let message = `✅ Logged ${data.individualSandwiches} sandwiches at ${data.hostName}`;

  // Add breakdown if available
  const breakdowns: string[] = [];
  if (data.individualDeli) breakdowns.push(`${data.individualDeli} deli`);
  if (data.individualTurkey) breakdowns.push(`${data.individualTurkey} turkey`);
  if (data.individualHam) breakdowns.push(`${data.individualHam} ham`);
  if (data.individualPbj) breakdowns.push(`${data.individualPbj} PB&J`);

  if (breakdowns.length > 0) {
    message += ` (${breakdowns.join(', ')})`;
  }

  // Add group info if available
  if (data.groupCollections && data.groupCollections.length > 0) {
    const groups = data.groupCollections.map(g => `${g.name}: ${g.count}`).join(', ');
    message += `\nGroups: ${groups}`;
  }

  message += '\n\n🥪 Thanks for making sandwiches!';

  return message;
}
