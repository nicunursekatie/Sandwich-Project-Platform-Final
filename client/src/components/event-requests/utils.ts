import { SANDWICH_TYPES } from './constants';

// Utility function to convert 24-hour time to 12-hour format
export const formatTime12Hour = (time24: string): string => {
  if (!time24) return '';

  const [hours, minutes] = time24.split(':');
  const hour24 = parseInt(hours);

  if (hour24 === 0) return `12:${minutes} AM`;
  if (hour24 < 12) return `${hour24}:${minutes} AM`;
  if (hour24 === 12) return `12:${minutes} PM`;

  return `${hour24 - 12}:${minutes} PM`;
};

// Utility function to convert 24-hour time to 12-hour format for input display
export const formatTimeForInput = (time24: string): string => {
  if (!time24) return '';

  const [hours, minutes] = time24.split(':');
  const hour24 = parseInt(hours);

  if (hour24 === 0) return `12:${minutes}`;
  if (hour24 < 12) return `${hour24}:${minutes}`;
  if (hour24 === 12) return `12:${minutes}`;

  return `${hour24 - 12}:${minutes}`;
};

// Helper function to get sandwich types summary for new standardized format
export const getSandwichTypesSummary = (request: any) => {
  // Handle new standardized sandwich types format (array of {type, quantity})
  let sandwichTypes = request.sandwichTypes;

  // If sandwichTypes is a string, try to parse it as JSON
  if (typeof sandwichTypes === 'string') {
    try {
      sandwichTypes = JSON.parse(sandwichTypes);
    } catch (e) {
      console.warn('Failed to parse sandwich types JSON:', sandwichTypes);
      sandwichTypes = null;
    }
  }

  if (sandwichTypes && Array.isArray(sandwichTypes)) {
    const total = sandwichTypes.reduce(
      (sum: number, item: any) => sum + (item.quantity || 0),
      0
    );

    if (sandwichTypes.length === 1) {
      // Single type
      const type = sandwichTypes[0].type;
      const typeLabel =
        SANDWICH_TYPES.find((t) => t.value === type)?.label || type;
      return {
        total,
        breakdown: `${total} ${typeLabel}`,
        hasBreakdown: true,
      };
    } else if (sandwichTypes.length > 1) {
      // Multiple types
      const breakdown = sandwichTypes
        .filter((item: any) => item.quantity > 0)
        .map((item: any) => {
          const typeLabel =
            SANDWICH_TYPES.find((t) => t.value === item.type)?.label ||
            item.type;
          return `${item.quantity} ${typeLabel}`;
        })
        .join(', ');
      return {
        total,
        breakdown,
        hasBreakdown: true,
      };
    }
  }

  // Legacy format fallback
  if (request.estimatedSandwichCount) {
    const total = request.estimatedSandwichCount;
    const type = request.sandwichType || 'Unknown';
    // Convert sandwich type code to readable label
    const typeLabel =
      type !== 'Unknown' && type !== 'unknown'
        ? SANDWICH_TYPES.find((t) => t.value === type)?.label || type
        : 'Unknown';
    return {
      total,
      breakdown:
        typeLabel !== 'Unknown'
          ? `${total} ${typeLabel}`
          : `${total} sandwiches`,
      hasBreakdown: typeLabel !== 'Unknown',
    };
  }

  return { total: 0, breakdown: 'Unknown', hasBreakdown: false };
};

// Enhanced date formatting with day-of-week and color coding
export const formatEventDate = (dateString: string) => {
  try {
    if (!dateString)
      return { text: 'No date provided', className: 'text-[#007E8C]' };

    // Parse the date string safely - handle database timestamps, YYYY-MM-DD, and ISO dates
    let date: Date;
    if (
      dateString &&
      typeof dateString === 'string' &&
      dateString.match(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/)
    ) {
      // Database timestamp format: "2025-09-03 00:00:00"
      // Extract just the date part and create at noon to avoid timezone issues
      const dateOnly = dateString.split(' ')[0];
      date = new Date(dateOnly + 'T12:00:00');
    } else if (
      dateString &&
      typeof dateString === 'string' &&
      dateString.match(/^\d{4}-\d{2}-\d{2}T00:00:00(\.\d{3})?Z?$/)
    ) {
      // ISO format with midnight time (e.g., "2025-09-03T00:00:00.000Z")
      // Extract just the date part and create at noon to avoid timezone issues
      const dateOnly = dateString.split('T')[0];
      date = new Date(dateOnly + 'T12:00:00');
    } else if (dateString.includes('T') || dateString.includes('Z')) {
      date = new Date(dateString);
    } else if (
      dateString &&
      typeof dateString === 'string' &&
      dateString.match(/^\d{4}-\d{2}-\d{2}$/)
    ) {
      // For YYYY-MM-DD format, add noon to prevent timezone shift
      date = new Date(dateString + 'T12:00:00');
    } else {
      date = new Date(dateString);
    }

    if (isNaN(date.getTime())) return { text: 'Invalid date', className: '' };

    const dayOfWeek = date.getDay();
    // Add timezone offset to ensure local date interpretation 
    const localDate = new Date(date.getTime() + date.getTimezoneOffset() * 60000);
    const dayName = localDate.toLocaleDateString('en-US', { weekday: 'long' });
    const dateFormatted = localDate.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    const isWedOrThu = dayOfWeek === 3 || dayOfWeek === 4;
    let className = 'text-[#1A2332] font-medium';

    return {
      text: dateFormatted,
      className,
      dayName,
      isWedOrThu,
    };
  } catch (error) {
    return { text: 'Invalid date', className: '' };
  }
};

// Helper function to format date for input field
export const formatDateForInput = (dateString: string | null | undefined): string => {
  if (!dateString) return '';

  // If it's already in YYYY-MM-DD format, return as is
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
    return dateString;
  }

  // Try to parse various date formats and convert to YYYY-MM-DD
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return '';

    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');

    return `${year}-${month}-${day}`;
  } catch (error) {
    console.warn('Error formatting date:', error);
    return '';
  }
};

// Timezone-safe toolkit date formatter - prevents date shifting by a day
export const formatToolkitDate = (dateString: string | null | undefined): string => {
  if (!dateString) return '';

  try {
    // Parse the date string safely - handle database timestamps, ISO dates, and other formats
    let date: Date;
    if (
      dateString &&
      typeof dateString === 'string' &&
      dateString.match(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/)
    ) {
      // Database timestamp format: "2025-09-03 00:00:00"
      // Extract just the date part and create at noon to avoid timezone issues
      const dateOnly = dateString.split(' ')[0];
      date = new Date(dateOnly + 'T12:00:00');
    } else if (
      dateString &&
      typeof dateString === 'string' &&
      dateString.match(/^\d{4}-\d{2}-\d{2}T00:00:00(\.\d{3})?Z?$/)
    ) {
      // ISO format with midnight time (e.g., "2025-09-03T00:00:00.000Z")
      // Extract just the date part and create at noon to avoid timezone issues
      const dateOnly = dateString.split('T')[0];
      date = new Date(dateOnly + 'T12:00:00');
    } else if (dateString.includes('T') || dateString.includes('Z')) {
      // Handle full ISO timestamps by parsing them directly
      date = new Date(dateString);
    } else if (
      dateString &&
      typeof dateString === 'string' &&
      dateString.match(/^\d{4}-\d{2}-\d{2}$/)
    ) {
      // For YYYY-MM-DD format, add noon to prevent timezone shift
      date = new Date(dateString + 'T12:00:00');
    } else {
      // Fallback for other formats - use noon to prevent shifts
      const tempDate = new Date(dateString);
      if (isNaN(tempDate.getTime())) return 'Invalid date';
      
      // Extract date components and recreate at noon to avoid timezone issues
      const year = tempDate.getFullYear();
      const month = String(tempDate.getMonth() + 1).padStart(2, '0');
      const day = String(tempDate.getDate()).padStart(2, '0');
      date = new Date(`${year}-${month}-${day}T12:00:00`);
    }

    if (isNaN(date.getTime())) return 'Invalid date';

    // Format the date safely
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric' 
    });
  } catch (error) {
    console.warn('Error formatting toolkit date:', error);
    return 'Invalid date';
  }
};

// Utility functions for pickup date and time formatting with backward compatibility

/**
 * Formats pickup time for display with full date and time support
 * Handles both legacy pickupTime (time only) and new pickupDateTime (full datetime) fields
 * @param pickupDateTime - Full datetime string (preferred)
 * @param pickupTime - Legacy time string (fallback)
 * @param eventDate - Event date for context when only time is available
 * @returns Formatted pickup datetime string or fallback
 */
export const formatPickupDateTime = (
  pickupDateTime?: string | null,
  pickupTime?: string | null,
  eventDate?: string | null
): string => {
  try {
    // Priority 1: Use pickupDateTime if available (new format)
    if (pickupDateTime) {
      const date = new Date(pickupDateTime);
      if (!isNaN(date.getTime())) {
        return date.toLocaleDateString('en-US', {
          weekday: 'short',
          year: 'numeric',
          month: 'short',
          day: 'numeric',
          hour: 'numeric',
          minute: '2-digit',
          hour12: true
        });
      }
    }

    // Priority 2: Combine pickupTime with eventDate (legacy format)
    if (pickupTime && eventDate) {
      try {
        // Parse the event date
        let baseDateStr = eventDate;
        if (eventDate.includes('T')) {
          baseDateStr = eventDate.split('T')[0];
        }
        
        // Combine date and time
        const combinedDateTime = new Date(`${baseDateStr}T${pickupTime}:00`);
        if (!isNaN(combinedDateTime.getTime())) {
          return combinedDateTime.toLocaleDateString('en-US', {
            weekday: 'short',
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
            hour12: true
          });
        }
      } catch (error) {
        console.warn('Error combining pickupTime with eventDate:', error);
      }
    }

    // Priority 3: Show just the time if no date context available
    if (pickupTime) {
      return `${formatTime12Hour(pickupTime)} (time only)`;
    }

    return 'Not set';
  } catch (error) {
    console.warn('Error formatting pickup datetime:', error);
    return pickupTime ? `${formatTime12Hour(pickupTime)} (time only)` : 'Not set';
  }
};

/**
 * Formats pickup time for display with enhanced context
 * Similar to formatPickupDateTime but with more compact output
 * @param pickupDateTime - Full datetime string (preferred)
 * @param pickupTime - Legacy time string (fallback)
 * @param eventDate - Event date for context when only time is available
 * @returns Formatted pickup datetime string or fallback
 */
export const formatPickupTimeDisplay = (
  pickupDateTime?: string | null,
  pickupTime?: string | null,
  eventDate?: string | null
): string => {
  try {
    // Priority 1: Use pickupDateTime if available (new format)
    if (pickupDateTime) {
      const date = new Date(pickupDateTime);
      if (!isNaN(date.getTime())) {
        const today = new Date();
        const isToday = date.toDateString() === today.toDateString();
        
        if (isToday) {
          return `Today at ${date.toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
            hour12: true
          })}`;
        } else {
          return `${date.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: date.getFullYear() !== today.getFullYear() ? 'numeric' : undefined
          })} at ${date.toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
            hour12: true
          })}`;
        }
      }
    }

    // Priority 2: Combine pickupTime with eventDate (legacy format)
    if (pickupTime && eventDate) {
      try {
        let baseDateStr = eventDate;
        if (eventDate.includes('T')) {
          baseDateStr = eventDate.split('T')[0];
        }
        
        const combinedDateTime = new Date(`${baseDateStr}T${pickupTime}:00`);
        if (!isNaN(combinedDateTime.getTime())) {
          const today = new Date();
          const isToday = combinedDateTime.toDateString() === today.toDateString();
          
          if (isToday) {
            return `Today at ${formatTime12Hour(pickupTime)}`;
          } else {
            return `${combinedDateTime.toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
              year: combinedDateTime.getFullYear() !== today.getFullYear() ? 'numeric' : undefined
            })} at ${formatTime12Hour(pickupTime)}`;
          }
        }
      } catch (error) {
        console.warn('Error combining pickupTime with eventDate:', error);
      }
    }

    // Priority 3: Show just the time if no date context available
    if (pickupTime) {
      return formatTime12Hour(pickupTime);
    }

    return 'Not set';
  } catch (error) {
    console.warn('Error formatting pickup time display:', error);
    return pickupTime ? formatTime12Hour(pickupTime) : 'Not set';
  }
};

/**
 * Gets the effective pickup datetime value for editing purposes
 * Prioritizes pickupDateTime over pickupTime
 * @param pickupDateTime - Full datetime string (preferred)
 * @param pickupTime - Legacy time string (fallback)
 * @param eventDate - Event date for context when only time is available
 * @returns ISO datetime string for input fields
 */
export const getPickupDateTimeForInput = (
  pickupDateTime?: string | null,
  pickupTime?: string | null,
  eventDate?: string | null
): string => {
  try {
    // Priority 1: Use pickupDateTime if available
    if (pickupDateTime) {
      const date = new Date(pickupDateTime);
      if (!isNaN(date.getTime())) {
        return date.toISOString().slice(0, 16); // Format for datetime-local input
      }
    }

    // Priority 2: Combine pickupTime with eventDate
    if (pickupTime && eventDate) {
      try {
        let baseDateStr = eventDate;
        if (eventDate.includes('T')) {
          baseDateStr = eventDate.split('T')[0];
        }
        
        const combinedDateTime = new Date(`${baseDateStr}T${pickupTime}:00`);
        if (!isNaN(combinedDateTime.getTime())) {
          return combinedDateTime.toISOString().slice(0, 16);
        }
      } catch (error) {
        console.warn('Error combining pickupTime with eventDate for input:', error);
      }
    }

    return '';
  } catch (error) {
    console.warn('Error getting pickup datetime for input:', error);
    return '';
  }
};