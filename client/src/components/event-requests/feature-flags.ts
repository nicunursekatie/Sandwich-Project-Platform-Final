/**
 * Build-time UI toggles for the event-requests feature. Default OFF.
 *
 * IMPORTANT: these are plain compile-time constants — NOT the runtime
 * feature-flag system (`/api/feature-flags` + `useFeatureFlag`). There is no
 * admin/runtime control: flipping one requires a code change and a rebuild/
 * deploy. They exist only to gate legacy / in-transition UI so it can be hidden
 * without deleting the code yet.
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
