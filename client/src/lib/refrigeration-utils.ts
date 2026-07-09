/**
 * Refrigeration validation utilities
 * Re-exports from shared code for backwards compatibility
 */
export type { SandwichType } from '@shared/event-validation-utils';
export {
  isPerishableSandwichType,
  hasPerishableSandwiches,
  needsRefrigerationConfirmation,
  cannotRuleOutPerishableSandwiches,
  shouldConfirmRefrigerationBeforeSchedule,
  hasCriticalRefrigerationIssue,
  getRefrigerationMessage,
  getPerishableSandwichTypes,
} from '@shared/event-validation-utils';
