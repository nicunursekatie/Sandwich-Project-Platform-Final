import { eq, sql } from 'drizzle-orm';
import { db } from '../db';
import { users } from '@shared/schema';
import { logger } from '../utils/production-safe-logger';

/**
 * Linked account groups.
 *
 * Accounts in the same group share a single, merged in-app view of incoming
 * messages, kudos, and notifications: when logged into ANY account in a group,
 * the user sees items addressed to EVERY account in that group, and marking an
 * item read/archived applies across the whole group.
 *
 * Accounts remain otherwise fully separate (login, permissions, profile, etc.).
 *
 * Emails are matched case-insensitively. To link more accounts, add their
 * emails to an existing group, or add a new array for a new group.
 */
export const LINKED_ACCOUNT_GROUPS: string[][] = [
  ['katielong2316@gmail.com', 'admin@sandwich.project'],
];

const CACHE_TTL_MS = 5 * 60 * 1000;

interface CacheEntry {
  ids: string[];
  expiresAt: number;
}

// Cache keyed by the originating user id -> the full set of linked ids.
const linkedIdsCache = new Map<string, CacheEntry>();

function findGroupForEmail(email: string): string[] | null {
  const normalized = email.trim().toLowerCase();
  for (const group of LINKED_ACCOUNT_GROUPS) {
    if (group.some((e) => e.trim().toLowerCase() === normalized)) {
      return group;
    }
  }
  return null;
}

/**
 * Resolve the full set of user IDs that share a merged inbox with the given
 * user. Always includes the passed userId itself. Returns just [userId] when
 * the account is not part of any linked group.
 */
export async function getLinkedUserIds(userId: string): Promise<string[]> {
  if (!userId) return [];

  const cached = linkedIdsCache.get(userId);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.ids;
  }

  let ids = [userId];

  try {
    const [me] = await db
      .select({ email: users.email })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (me?.email) {
      const group = findGroupForEmail(me.email);
      if (group) {
        const normalizedEmails = group.map((e) => e.trim().toLowerCase());
        const groupUsers = await db
          .select({ id: users.id })
          .from(users)
          .where(
            sql`lower(${users.email}) IN (${sql.join(
              normalizedEmails.map((e) => sql`${e}`),
              sql`, `
            )})`
          );
        const resolved = groupUsers.map((u) => u.id).filter(Boolean);
        // Ensure the current user id is always present and ids are unique.
        ids = Array.from(new Set([userId, ...resolved]));
      }
    }
  } catch (error) {
    logger.error('[linked-accounts] Failed to resolve linked user ids:', error);
    ids = [userId];
  }

  linkedIdsCache.set(userId, { ids, expiresAt: Date.now() + CACHE_TTL_MS });
  return ids;
}
