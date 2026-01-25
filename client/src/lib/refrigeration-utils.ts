/**
 * Utility functions for checking refrigeration requirements and warnings
 */

export interface SandwichType {
  type: string;
  quantity: number;
}

/**
 * Sandwich types that require refrigeration
 */
const PERISHABLE_SANDWICH_TYPES = ['turkey', 'ham', 'deli', 'cheese'];

/**
 * Check if a sandwich type requires refrigeration
 */
export function isPerishableSandwichType(type: string): boolean {
  const normalizedType = type.toLowerCase().trim();
  return PERISHABLE_SANDWICH_TYPES.some(perishable =>
    normalizedType.includes(perishable)
  );
}

/**
 * Check if an event has perishable sandwiches planned
 */
export function hasPerishableSandwiches(sandwichTypes: SandwichType[] | null | undefined): boolean {
  if (!sandwichTypes || !Array.isArray(sandwichTypes) || sandwichTypes.length === 0) {
    return false;
  }

  return sandwichTypes.some(sandwich =>
    sandwich.quantity > 0 && isPerishableSandwichType(sandwich.type)
  );
}

/**
 * Check if refrigeration status needs to be confirmed
 * Returns true if status is null/undefined (not answered)
 */
export function needsRefrigerationConfirmation(hasRefrigeration: boolean | null | undefined): boolean {
  return hasRefrigeration === null || hasRefrigeration === undefined;
}

/**
 * CRITICAL: Check if event has perishable sandwiches but NO refrigeration
 * This is a serious food safety issue
 */
export function hasCriticalRefrigerationIssue(
  sandwichTypes: SandwichType[] | null | undefined,
  hasRefrigeration: boolean | null | undefined
): boolean {
  // Only flag as critical if:
  // 1. Event has perishable sandwiches planned
  // 2. Refrigeration is explicitly marked as "No" (false)
  return hasPerishableSandwiches(sandwichTypes) && hasRefrigeration === false;
}

/**
 * Get user-friendly message about refrigeration requirements
 */
export function getRefrigerationMessage(
  sandwichTypes: SandwichType[] | null | undefined,
  hasRefrigeration: boolean | null | undefined
): {
  type: 'error' | 'warning' | 'info' | null;
  message: string;
} | null {
  const hasPerishable = hasPerishableSandwiches(sandwichTypes);
  const needsConfirmation = needsRefrigerationConfirmation(hasRefrigeration);

  // Critical issue: perishable sandwiches with no refrigeration
  if (hasCriticalRefrigerationIssue(sandwichTypes, hasRefrigeration)) {
    return {
      type: 'error',
      message: 'CRITICAL: This event has turkey/ham/deli sandwiches planned but NO refrigeration! This is a food safety issue.',
    };
  }

  // Warning: refrigeration not confirmed yet
  if (needsConfirmation) {
    if (hasPerishable) {
      return {
        type: 'warning',
        message: 'Refrigeration status not confirmed. This event has perishable sandwiches planned.',
      };
    }
    return {
      type: 'warning',
      message: 'Refrigeration status not confirmed.',
    };
  }

  // Info: has refrigeration (good!)
  if (hasRefrigeration === true && hasPerishable) {
    return {
      type: 'info',
      message: 'Refrigeration confirmed - suitable for all sandwich types.',
    };
  }

  // Info: no refrigeration but no perishable sandwiches (that's fine)
  if (hasRefrigeration === false && !hasPerishable) {
    return {
      type: 'info',
      message: 'No refrigeration - plan for PB&J sandwiches only.',
    };
  }

  return null;
}

/**
 * Get list of perishable sandwich types from an array
 */
export function getPerishableSandwichTypes(sandwichTypes: SandwichType[] | null | undefined): string[] {
  if (!sandwichTypes || !Array.isArray(sandwichTypes)) {
    return [];
  }

  return sandwichTypes
    .filter(sandwich => sandwich.quantity > 0 && isPerishableSandwichType(sandwich.type))
    .map(sandwich => sandwich.type);
}
