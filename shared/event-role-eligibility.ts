/**
 * Single source of truth for which event roles a user may sign up for on the
 * Volunteer Hub.
 *
 * Two axes per role:
 *   - Willingness ("willing*") — self-declared by the user in their profile.
 *     What they actually want to do.
 *   - Approval ("*Approved")  — coordinator-granted vetting for roles that
 *     carry responsibility (speaker = representing the org; van = the vehicle).
 *
 * A user is eligible for a role when they're willing AND (where the role
 * requires it) approved. General volunteering is the baseline everyone can do.
 *
 * Both the client (to tailor the signup UI) and the server (to enforce
 * self-signups) import from here, so the "what does each role require" rule
 * lives in exactly one place. When the org finalizes its definition — e.g.
 * "drivers don't need approval, only van drivers do" — change ROLE_RULES below
 * and both sides update together.
 */

export type EventRole = 'speaker' | 'driver' | 'general' | 'van';

/** The roles a volunteer can self-sign-up for via the hub signup dialog. */
export const SELF_SIGNUP_ROLES: Array<Exclude<EventRole, 'van'>> = [
  'speaker',
  'driver',
  'general',
];

/** Capability flags read off the `users` row (all nullable in the DB). */
export interface UserRoleCapabilities {
  willingToVolunteer?: boolean | null;
  willingToSpeak?: boolean | null;
  willingToDrive?: boolean | null;
  speakerApproved?: boolean | null;
  driverApproved?: boolean | null;
  vanApproved?: boolean | null;
}

interface RoleRule {
  /** Which willingness flag gates this role. */
  willing: keyof UserRoleCapabilities;
  /**
   * Willingness flags that default to "yes" when unset (null/undefined).
   * General volunteering is the baseline, so an untouched account still counts
   * as willing. Approval flags never default on.
   */
  willingDefaultsTrue: boolean;
  /** Coordinator-approval flag this role requires, or null if none. */
  approval: keyof UserRoleCapabilities | null;
}

const ROLE_RULES: Record<EventRole, RoleRule> = {
  general: { willing: 'willingToVolunteer', willingDefaultsTrue: true, approval: null },
  speaker: { willing: 'willingToSpeak', willingDefaultsTrue: false, approval: 'speakerApproved' },
  driver: { willing: 'willingToDrive', willingDefaultsTrue: false, approval: 'driverApproved' },
  van: { willing: 'willingToDrive', willingDefaultsTrue: false, approval: 'vanApproved' },
};

function flag(value: boolean | null | undefined, defaultsTrue: boolean): boolean {
  if (value === null || value === undefined) return defaultsTrue;
  return value === true;
}

/**
 * Whether the given user is eligible to take on the given event role —
 * i.e. they're willing and (where required) approved.
 */
export function isEligibleForRole(
  user: UserRoleCapabilities | null | undefined,
  role: EventRole
): boolean {
  if (!user) return false;
  const rule = ROLE_RULES[role];
  if (!rule) return false;

  if (!flag(user[rule.willing], rule.willingDefaultsTrue)) return false;
  if (rule.approval && !flag(user[rule.approval], false)) return false;
  return true;
}

/** All event roles the user is currently eligible for. */
export function getEligibleEventRoles(
  user: UserRoleCapabilities | null | undefined
): EventRole[] {
  return (Object.keys(ROLE_RULES) as EventRole[]).filter((role) =>
    isEligibleForRole(user, role)
  );
}

/**
 * Why a user isn't eligible for a role, or null if they are. Lets callers give
 * an accurate message instead of guessing from the role name — a user who just
 * hasn't opted in ('not_willing') is a different case from one who's willing but
 * awaiting coordinator approval ('not_approved').
 */
export type IneligibilityReason = 'not_willing' | 'not_approved';

export function getIneligibilityReason(
  user: UserRoleCapabilities | null | undefined,
  role: EventRole
): IneligibilityReason | null {
  const rule = ROLE_RULES[role];
  if (!rule) return null;
  if (!flag(user?.[rule.willing], rule.willingDefaultsTrue)) return 'not_willing';
  if (rule.approval && !flag(user?.[rule.approval], false)) return 'not_approved';
  return null;
}

