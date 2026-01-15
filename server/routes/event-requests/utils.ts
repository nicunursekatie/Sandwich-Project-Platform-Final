/**
 * Utility functions for event-requests routes
 */
import type { EventRequest } from '@shared/schema';

/**
 * Convert a time string to a full datetime string
 * Supports formats like "2:30 PM", "14:30", "2:30"
 */
export const convertTimeToDateTime = (timeStr: string, baseDate?: Date | string): string | null => {
  if (!timeStr) return null;

  try {
    // Parse time string (supports formats like "2:30 PM", "14:30", "2:30")
    const timeMatch = timeStr.match(/^(\d{1,2}):(\d{2})(?:\s*(AM|PM))?$/i);
    if (!timeMatch) return null;

    let hours = parseInt(timeMatch[1]);
    const minutes = parseInt(timeMatch[2]);
    const ampm = timeMatch[3]?.toUpperCase();

    // Convert to 24-hour format if needed
    if (ampm === 'PM' && hours !== 12) hours += 12;
    if (ampm === 'AM' && hours === 12) hours = 0;

    // Extract date components safely without timezone conversion
    let year: number, month: string, day: string;

    if (baseDate) {
      const dateStr = typeof baseDate === 'string' ? baseDate : baseDate.toISOString();
      // Extract YYYY-MM-DD directly from the string to avoid timezone issues
      const dateMatch = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
      if (dateMatch) {
        year = parseInt(dateMatch[1]);
        month = dateMatch[2];
        day = dateMatch[3];
      } else {
        // Fallback to Date object if string parsing fails
        const d = new Date(dateStr);
        year = d.getUTCFullYear();
        month = String(d.getUTCMonth() + 1).padStart(2, '0');
        day = String(d.getUTCDate()).padStart(2, '0');
      }
    } else {
      // Use today's date in local timezone
      const now = new Date();
      year = now.getFullYear();
      month = String(now.getMonth() + 1).padStart(2, '0');
      day = String(now.getDate()).padStart(2, '0');
    }

    const hoursStr = String(hours).padStart(2, '0');
    const minutesStr = String(minutes).padStart(2, '0');
    return `${year}-${month}-${day}T${hoursStr}:${minutesStr}:00`;
  } catch (error) {
    return null;
  }
};

/**
 * Extract time string from a datetime string
 */
export const extractTimeFromDateTime = (dateTimeStr: string): string | null => {
  if (!dateTimeStr) return null;

  try {
    const date = new Date(dateTimeStr);
    if (isNaN(date.getTime())) return null;

    // Extract time in 12-hour format with AM/PM
    const timeStr = date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });

    return timeStr;
  } catch (error) {
    return null;
  }
};

/**
 * Data migration logic for pickup time fields
 * Ensures pickupTime and pickupDateTime stay in sync
 */
export const processPickupTimeFields = (updates: Partial<EventRequest>, existingData?: Partial<EventRequest>) => {
  const result = { ...updates };

  // Get existing values for reference
  const existingPickupTime = existingData?.pickupTime;
  const existingPickupDateTime = existingData?.pickupDateTime;
  const existingScheduledDate = existingData?.scheduledEventDate || existingData?.desiredEventDate;

  // Handle the case where both fields are provided in the update
  if (updates.pickupTime && updates.pickupDateTime) {
    // Prioritize pickupDateTime, but ensure pickupTime is consistent
    const extractedTime = extractTimeFromDateTime(updates.pickupDateTime);
    if (extractedTime) {
      result.pickupTime = extractedTime;
    }
  }
  // Handle the case where only pickupDateTime is provided
  else if (updates.pickupDateTime && !updates.pickupTime) {
    const extractedTime = extractTimeFromDateTime(updates.pickupDateTime);
    if (extractedTime) {
      result.pickupTime = extractedTime;
    }
  }
  // Handle the case where only pickupTime is provided
  else if (updates.pickupTime && !updates.pickupDateTime) {
    // Try to convert using scheduled date or today as base
    const baseDate = existingScheduledDate ? new Date(existingScheduledDate) : new Date();
    const convertedDateTime = convertTimeToDateTime(updates.pickupTime, baseDate);
    if (convertedDateTime) {
      result.pickupDateTime = convertedDateTime;
    }
  }
  // Handle existing data scenarios during reads/updates
  else if (!updates.pickupTime && !updates.pickupDateTime && existingData) {
    // Fill in missing fields from existing data
    if (existingPickupTime && !existingPickupDateTime) {
      const baseDate = existingScheduledDate ? new Date(existingScheduledDate) : new Date();
      const convertedDateTime = convertTimeToDateTime(existingPickupTime, baseDate);
      if (convertedDateTime) {
        result.pickupDateTime = convertedDateTime;
      }
    } else if (existingPickupDateTime && !existingPickupTime) {
      const extractedTime = extractTimeFromDateTime(existingPickupDateTime);
      if (extractedTime) {
        result.pickupTime = extractedTime;
      }
    }
  }

  return result;
};

/**
 * Parse staffing column from Google Sheets
 * Format: "D, S, V" (needs) or "D: Katie, S: Kim, V: Christine, VD: Luz" (assigned)
 */
export const parseStaffingColumn = (staffingStr: string | null | undefined): {
  driversNeeded: boolean;
  speakersNeeded: number;
  volunteersNeeded: boolean;
  vanDriverNeeded: boolean;
  driverName?: string;
  speakerName?: string;
  volunteerName?: string;
  vanDriverName?: string;
} => {
  const result = {
    driversNeeded: false,
    speakersNeeded: 0,
    volunteersNeeded: false,
    vanDriverNeeded: false,
  };

  if (!staffingStr) return result;

  const parts = staffingStr.split(',').map(p => p.trim());

  for (const part of parts) {
    // Check for assigned format (e.g., "D: Katie")
    const assignedMatch = part.match(/^(D|S|V|VD):\s*(.+)$/i);
    if (assignedMatch) {
      const [, type, name] = assignedMatch;
      switch (type.toUpperCase()) {
        case 'D':
          result.driversNeeded = true;
          (result as any).driverName = name;
          break;
        case 'S':
          result.speakersNeeded = 1;
          (result as any).speakerName = name;
          break;
        case 'V':
          result.volunteersNeeded = true;
          (result as any).volunteerName = name;
          break;
        case 'VD':
          result.vanDriverNeeded = true;
          (result as any).vanDriverName = name;
          break;
      }
    } else {
      // Check for needs format (e.g., just "D" or "S")
      switch (part.toUpperCase()) {
        case 'D':
          result.driversNeeded = true;
          break;
        case 'S':
          result.speakersNeeded = 1;
          break;
        case 'V':
          result.volunteersNeeded = true;
          break;
        case 'VD':
          result.vanDriverNeeded = true;
          break;
      }
    }
  }

  return result;
};

/**
 * Format a date for display
 */
export const formatDate = (date: Date | string | null | undefined): string => {
  if (!date) return '';
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
};

/**
 * Parse a date string safely
 */
export const parseDate = (dateStr: string | null | undefined): Date | null => {
  if (!dateStr) return null;
  const date = new Date(dateStr);
  return isNaN(date.getTime()) ? null : date;
};
