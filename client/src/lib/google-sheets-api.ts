/**
 * TSP Google Sheet API Integration
 * Adds events to the official TSP Google Sheet for tracking
 */

const API_URL = 'https://script.google.com/macros/s/AKfycbzR0WlK4UoHYrPv0L7EzIfOPyhspehlIoWTj9yKsUmWLu-2QfZWSzCNOHFuPuxBZS0jdg/exec';
const API_KEY = 'f47ac10b-58cc-4372-a567-0e02b2c3d479';

export interface GoogleSheetEventData {
  date: string;           // Required. Format: 'YYYY-MM-DD'
  groupName: string;      // Required. Name of the group
  startTime?: string;     // Optional. e.g., '10:00 AM'
  endTime?: string;       // Optional. e.g., '12:00 PM'
  pickupTime?: string;    // Optional. e.g., '9:30 AM'
  details?: string;       // Optional. Any notes
  socialPost?: string;    // Optional.
  staffing?: string;      // Optional.
  estimate?: string;      // Optional. Sandwich count estimate
}

export interface GoogleSheetResponse {
  success: boolean;
  message: string;
  rowNumber?: number;
  timestamp?: string;
}

/**
 * Adds an event to the TSP Google Sheet
 * Inserts in chronological order, cannot overwrite existing rows
 */
export async function addEventToGoogleSheet(eventData: GoogleSheetEventData): Promise<GoogleSheetResponse> {
  // Validate required fields
  if (!eventData.date || !eventData.groupName) {
    return { success: false, message: 'Missing required fields: date and groupName' };
  }

  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' }, // Required for Apps Script CORS
      body: JSON.stringify({
        apiKey: API_KEY,
        date: eventData.date,
        groupName: eventData.groupName,
        startTime: eventData.startTime || '',
        endTime: eventData.endTime || '',
        pickupTime: eventData.pickupTime || '',
        details: eventData.details || '',
        socialPost: eventData.socialPost || '',
        staffing: eventData.staffing || '',
        estimate: eventData.estimate || ''
      })
    });

    const text = await response.text();

    try {
      const result = JSON.parse(text);
      return result;
    } catch {
      return { success: false, message: 'Invalid response from server: ' + text.substring(0, 100) };
    }

  } catch (error) {
    console.error('TSP Sheet API Error:', error);
    return { success: false, message: 'Network error: ' + (error instanceof Error ? error.message : 'Unknown error') };
  }
}

/**
 * Formats a date string to YYYY-MM-DD format required by the API
 */
export function formatDateForGoogleSheet(dateStr: string | Date | null | undefined): string {
  if (!dateStr) return '';

  // Handle Date objects
  if (dateStr instanceof Date) {
    return dateStr.toISOString().split('T')[0];
  }

  // Handle ISO strings or date strings
  const str = String(dateStr);
  if (str.includes('T')) {
    return str.split('T')[0];
  }

  // Already in YYYY-MM-DD format
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    return str;
  }

  // Try to parse and format
  try {
    const date = new Date(str);
    if (!isNaN(date.getTime())) {
      return date.toISOString().split('T')[0];
    }
  } catch {
    // Fall through
  }

  return '';
}
