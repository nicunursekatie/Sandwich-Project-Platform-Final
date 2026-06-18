/**
 * Feature flags for the event-requests feature. Default OFF.
 *
 * These gate legacy / in-transition UI so it can be hidden without deleting the
 * code yet. Flip a flag to true to re-enable locally if needed.
 */
export const EVENT_REQUEST_FEATURES = {
  /**
   * QuickScheduleButton: an emergency workaround that bypasses the full
   * scheduling form and PATCHes status directly to 'scheduled'. Now that the
   * full-form save path is trusted (and status changes are validated/centralized
   * server-side), it's hidden by default. Kept in the tree for one cycle so it
   * can be re-enabled quickly if anyone relied on it; remove once confirmed.
   */
  quickScheduleButton: false,
} as const;
