/**
 * Utility functions for handling sandwich types data
 * Ensures consistent JSON string storage and safe parsing
 */

export interface SandwichType {
  type: string;
  quantity: number;
}

/**
 * Safely parse sandwich types from database
 * Handles both string and object formats
 */
export function parseSandwichTypes(sandwichTypes: any): SandwichType[] | null {
  if (!sandwichTypes) return null;

  try {
    // If it's already an array, validate and return
    if (Array.isArray(sandwichTypes)) {
      return sandwichTypes.filter(item =>
        item && typeof item.type === 'string' && typeof item.quantity === 'number'
      );
    }

    // If it's a string, parse it
    if (typeof sandwichTypes === 'string') {
      const parsed = JSON.parse(sandwichTypes);
      if (Array.isArray(parsed)) {
        return parsed.filter(item =>
          item && typeof item.type === 'string' && typeof item.quantity === 'number'
        );
      }
    }

    // If it's an object but not an array, try to handle PostgreSQL array format
    if (typeof sandwichTypes === 'object') {
      // Convert object with numeric keys to array
      const values = Object.values(sandwichTypes);
      if (values.every(item => typeof item === 'object' && 'type' in item && 'quantity' in item)) {
        return values as SandwichType[];
      }
    }

    console.warn('Unable to parse sandwich types:', sandwichTypes);
    return null;
  } catch (error) {
    console.error('Error parsing sandwich types:', error, sandwichTypes);
    return null;
  }
}

/**
 * Format sandwich types for database storage
 * Always returns a JSON string or null
 */
export function stringifySandwichTypes(sandwichTypes: SandwichType[] | null): string | null {
  if (!sandwichTypes || sandwichTypes.length === 0) {
    return null;
  }

  try {
    // Validate the data before stringifying
    const valid = sandwichTypes.every(item =>
      item &&
      typeof item.type === 'string' &&
      typeof item.quantity === 'number' &&
      item.quantity >= 0
    );

    if (!valid) {
      console.warn('Invalid sandwich types data:', sandwichTypes);
      return null;
    }

    return JSON.stringify(sandwichTypes);
  } catch (error) {
    console.error('Error stringifying sandwich types:', error);
    return null;
  }
}

/**
 * Format sandwich types for display
 * Returns a human-readable string
 */
export function formatSandwichTypesDisplay(
  sandwichTypes: any,
  fallbackCount?: number
): string {
  const parsed = parseSandwichTypes(sandwichTypes);

  if (parsed && parsed.length > 0) {
    // Filter out "unknown" types completely
    const validTypes = parsed.filter(item => 
      item.quantity > 0 && 
      item.type.toLowerCase() !== 'unknown'
    );

    // If no valid types after filtering, don't show anything
    if (validTypes.length === 0) {
      if (fallbackCount) {
        return `${fallbackCount} total`;
      }
      return 'Not specified';
    }

    const total = validTypes.reduce((sum, item) => sum + item.quantity, 0);

    if (validTypes.length === 1) {
      return `${validTypes[0].quantity} ${validTypes[0].type}`;
    }

    const breakdown = validTypes
      .map(item => `${item.quantity} ${item.type}`)
      .join(', ');

    return breakdown || `${total} total`;
  }

  if (fallbackCount) {
    return `${fallbackCount} total`;
  }

  return 'Not specified';
}

/**
 * Calculate total sandwich count from types
 */
export function calculateTotalSandwiches(sandwichTypes: any): number {
  const parsed = parseSandwichTypes(sandwichTypes);

  if (parsed && parsed.length > 0) {
    return parsed.reduce((sum, item) => sum + item.quantity, 0);
  }

  return 0;
}

/**
 * Validate sandwich types data structure
 */
export function validateSandwichTypes(sandwichTypes: any): boolean {
  const parsed = parseSandwichTypes(sandwichTypes);

  if (!parsed) return false;

  return parsed.every(item =>
    item &&
    typeof item.type === 'string' &&
    item.type.length > 0 &&
    typeof item.quantity === 'number' &&
    item.quantity >= 0
  );
}