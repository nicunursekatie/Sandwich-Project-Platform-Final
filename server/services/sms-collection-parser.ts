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

// Parse date from text - supports various formats
function parseDateFromText(text: string): { date: string; remainingText: string } {
  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];
  
  // Check for explicit date patterns at the end of the message
  // Format: MM/DD or MM-DD or MM/DD/YY or MM/DD/YYYY (with or without leading space)
  const dateMatch = text.match(/\s*(\d{1,2})[\/\-](\d{1,2})(?:[\/\-](\d{2,4}))?$/i);
  if (dateMatch) {
    const month = parseInt(dateMatch[1], 10);
    const day = parseInt(dateMatch[2], 10);
    let year = dateMatch[3] ? parseInt(dateMatch[3], 10) : today.getFullYear();
    if (year < 100) year += 2000; // Convert 24 to 2024
    
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const remaining = text.substring(0, text.length - dateMatch[0].length).trim();
      logger.info(`[DateParser] Extracted date ${dateStr} from "${text}", remaining: "${remaining}"`);
      return { date: dateStr, remainingText: remaining };
    }
  }
  
  // Check for "yesterday"
  if (/\s+yesterday$/i.test(text)) {
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    return { 
      date: yesterday.toISOString().split('T')[0], 
      remainingText: text.replace(/\s+yesterday$/i, '').trim() 
    };
  }
  
  // Check for "last Wednesday", "last Monday", etc.
  const lastDayMatch = text.match(/\s+last\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)$/i);
  if (lastDayMatch) {
    const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const targetDay = dayNames.indexOf(lastDayMatch[1].toLowerCase());
    const currentDay = today.getDay();
    let daysBack = currentDay - targetDay;
    if (daysBack <= 0) daysBack += 7; // Go back to previous week
    const targetDate = new Date(today);
    targetDate.setDate(today.getDate() - daysBack);
    return { 
      date: targetDate.toISOString().split('T')[0], 
      remainingText: text.replace(lastDayMatch[0], '').trim() 
    };
  }
  
  // Check for just day name (this week or last occurrence)
  const dayMatch = text.match(/\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)$/i);
  if (dayMatch) {
    const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const targetDay = dayNames.indexOf(dayMatch[1].toLowerCase());
    const currentDay = today.getDay();
    let daysBack = currentDay - targetDay;
    if (daysBack < 0) daysBack += 7; // If target day is ahead, go back a week
    if (daysBack === 0) daysBack = 0; // Today
    const targetDate = new Date(today);
    targetDate.setDate(today.getDate() - daysBack);
    return { 
      date: targetDate.toISOString().split('T')[0], 
      remainingText: text.replace(dayMatch[0], '').trim() 
    };
  }
  
  return { date: todayStr, remainingText: text };
}

// Simple regex-based parser for structured messages
function parseStructuredMessage(message: string): CollectionParseResult | null {
  // Format with groups: LOG <count> <host> [date], <group1> <count1>, <group2> <count2>
  // Example: "LOG 1074 Dunwoody 12/10, Willis Towers Watson 400"
  const groupMatch = message.match(/^LOG\s+(\d+)\s+(.+?)(?:\s+(\d{1,2}[\/\-]\d{1,2}(?:[\/\-]\d{2,4})?))?\s*,\s*(.+)$/i);
  if (groupMatch) {
    const individualCount = parseInt(groupMatch[1], 10);
    const hostName = groupMatch[2].trim();
    const dateStr = groupMatch[3];
    const groupsPart = groupMatch[4];
    
    // Parse the date
    let collectionDate: string;
    if (dateStr) {
      const parts = dateStr.split(/[\/\-]/);
      const month = parseInt(parts[0], 10);
      const day = parseInt(parts[1], 10);
      let year = parts[2] ? parseInt(parts[2], 10) : new Date().getFullYear();
      if (year < 100) year += 2000;
      collectionDate = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    } else {
      collectionDate = new Date().toISOString().split('T')[0];
    }
    
    // Parse groups: "Willis Towers Watson 400, Another Group 200"
    const groupCollections: Array<{ name: string; count: number }> = [];
    const groupEntries = groupsPart.split(/\s*,\s*/);
    let totalGroupCount = 0;
    
    for (const entry of groupEntries) {
      // Match "Group Name 123" pattern - number at end
      const entryMatch = entry.match(/^(.+?)\s+(\d+)$/);
      if (entryMatch) {
        const groupName = entryMatch[1].trim();
        const groupCount = parseInt(entryMatch[2], 10);
        if (groupName && groupCount > 0) {
          groupCollections.push({ name: groupName, count: groupCount });
          totalGroupCount += groupCount;
        }
      }
    }
    
    if (individualCount > 0 && hostName.length >= 2) {
      logger.info(`[StructuredParser] Parsed with groups: ${individualCount} individual + ${groupCollections.length} groups at ${hostName} on ${collectionDate}`);
      return {
        success: true,
        data: {
          hostName,
          individualSandwiches: individualCount, // Individual count stays separate from groups
          groupCollections: groupCollections.length > 0 ? groupCollections : undefined,
          collectionDate,
          confidence: 0.95,
          needsClarification: false,
        },
        rawMessage: message,
      };
    }
  }

  // Format: LOG <count> <host> [date]
  const logMatch = message.match(/^LOG\s+(\d+)\s+(?:at\s+)?(.+)$/i);
  if (logMatch) {
    const count = parseInt(logMatch[1], 10);
    const hostAndDate = logMatch[2].trim();
    const { date, remainingText: host } = parseDateFromText(hostAndDate);

    if (count > 0 && host.length >= 2) {
      return {
        success: true,
        data: {
          hostName: host,
          individualSandwiches: count,
          collectionDate: date,
          confidence: 0.95,
          needsClarification: false,
        },
        rawMessage: message,
      };
    }
  }

  // Format: <count> sandwiches at <host> [date]
  const simpleMatch = message.match(/^(\d+)\s+(?:sandwiches?\s+)?(?:at\s+)?(.+)$/i);
  if (simpleMatch) {
    const count = parseInt(simpleMatch[1], 10);
    const hostAndDate = simpleMatch[2].trim();
    const { date, remainingText: host } = parseDateFromText(hostAndDate);

    if (count > 0 && host.length >= 2) {
      return {
        success: true,
        data: {
          hostName: host,
          individualSandwiches: count,
          collectionDate: date,
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
- individualSandwiches: number (TOTAL individual count - sum of all typed sandwiches, REQUIRED, minimum 1)
- individualDeli: number (optional, deli sandwiches count)
- individualTurkey: number (optional, turkey sandwiches count)
- individualHam: number (optional, ham sandwiches count)
- individualPbj: number (optional, PB&J sandwiches count)
- individualGeneric: number (optional, generic/untyped sandwiches count)
- groupCollections: array of {name, count, deli?, turkey?, ham?, pbj?} (optional, for group/organization breakdowns with optional type breakdowns)
- collectionDate: string YYYY-MM-DD (interpret dates like "12/10", "yesterday", "last Wednesday", "Wednesday" - default to ${today} if not specified)
- confidence: number 0-1 (how confident you are in the parse)
- needsClarification: boolean (true if message is ambiguous)
- clarificationMessage: string (what to ask if clarification needed)

Sandwich type keywords:
- "PBJ" or "pb&j" or "peanut butter" = pbj
- "Deli" or "deli meat" = deli
- "Ham" = ham
- "Turkey" = turkey
- "Generic" or no type specified = generic/untyped

Date interpretation rules:
- "12/10" or "12-10" = December 10 of current year (${today.substring(0,4)})
- "yesterday" = ${new Date(Date.now() - 86400000).toISOString().split('T')[0]}
- "last Wednesday" = most recent Wednesday before today
- "Wednesday" = this week's Wednesday (or last if today is before Wednesday)
- No date mentioned = use ${today}

IMPORTANT RULES:
1. individualSandwiches = sum of ALL individual typed sandwiches (pbj + deli + ham + turkey + generic)
2. Group counts are recorded SEPARATELY in groupCollections - do NOT add to individualSandwiches
3. Groups can also have sandwich types (e.g., "Willis Towers Watson 500 Ham")

Examples:
"50 sandwiches at Downtown Library" → {hostName: "Downtown Library", individualSandwiches: 50, collectionDate: "${today}", confidence: 0.95, needsClarification: false}
"LOG 30 First Baptist 12/10" → {hostName: "First Baptist", individualSandwiches: 30, collectionDate: "${today.substring(0,4)}-12-10", confidence: 0.95, needsClarification: false}
"LOG 100 PBJ 245 Deli 400 Generic Dunwoody 12/10, Willis Towers Watson 500 Ham" → {hostName: "Dunwoody", individualSandwiches: 745, individualPbj: 100, individualDeli: 245, collectionDate: "${today.substring(0,4)}-12-10", groupCollections: [{name: "Willis Towers Watson", count: 500, ham: 500}], confidence: 0.95, needsClarification: false}
"LOG 200 turkey 150 ham Intown 12/11, Google 200 pbj" → {hostName: "Intown", individualSandwiches: 350, individualTurkey: 200, individualHam: 150, collectionDate: "${today.substring(0,4)}-12-11", groupCollections: [{name: "Google", count: 200, pbj: 200}], confidence: 0.95, needsClarification: false}
"LOG 1074 Dunwoody 12/10, Willis Towers Watson 400" → {hostName: "Dunwoody", individualSandwiches: 1074, groupCollections: [{name: "Willis Towers Watson", count: 400}], collectionDate: "${today.substring(0,4)}-12-10", confidence: 0.95, needsClarification: false}
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
export function generateConfirmationMessage(data: ParsedCollectionData, matchedHostName?: string): string {
  const displayHost = matchedHostName || data.hostName;
  let message = `✅ Logged ${data.individualSandwiches} sandwiches at ${displayHost}`;
  
  // Add date if not today
  const today = new Date().toISOString().split('T')[0];
  if (data.collectionDate && data.collectionDate !== today) {
    const dateObj = new Date(data.collectionDate + 'T12:00:00');
    const dateStr = dateObj.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'America/New_York' });
    message += ` for ${dateStr}`;
  }

  // Add sandwich type breakdown if available (for individual)
  const breakdowns: string[] = [];
  if (data.individualPbj) breakdowns.push(`${data.individualPbj} PBJ`);
  if (data.individualDeli) breakdowns.push(`${data.individualDeli} deli`);
  if (data.individualTurkey) breakdowns.push(`${data.individualTurkey} turkey`);
  if (data.individualHam) breakdowns.push(`${data.individualHam} ham`);

  if (breakdowns.length > 0) {
    message += `\n(${breakdowns.join(', ')})`;
  }

  // Add group info if available (show prominently with types)
  if (data.groupCollections && data.groupCollections.length > 0) {
    const groupStrs = data.groupCollections.map(g => {
      let groupStr = `${g.name}: ${g.count}`;
      const typeBreakdown: string[] = [];
      if (g.pbj) typeBreakdown.push(`${g.pbj} PBJ`);
      if (g.deli) typeBreakdown.push(`${g.deli} deli`);
      if (g.turkey) typeBreakdown.push(`${g.turkey} turkey`);
      if (g.ham) typeBreakdown.push(`${g.ham} ham`);
      if (typeBreakdown.length > 0) {
        groupStr += ` (${typeBreakdown.join(', ')})`;
      }
      return groupStr;
    });
    message += `\nGroups: ${groupStrs.join('; ')}`;
  }

  message += '\n\n🥪 Thanks for making sandwiches!';

  return message;
}
