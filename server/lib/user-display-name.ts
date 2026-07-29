import { eq, inArray } from 'drizzle-orm';
import { db } from '../db';
import { users } from '@shared/schema';
import { getLinkedUserIds } from './linked-accounts';

const PLACEHOLDER_USER_NAMES = new Set(['unknown user', 'someone']);

export function isPlaceholderUserName(name: string | null | undefined): boolean {
  if (!name?.trim()) return true;
  return PLACEHOLDER_USER_NAMES.has(name.trim().toLowerCase());
}

export function formatUserDisplayName(user: {
  firstName?: string | null;
  lastName?: string | null;
  displayName?: string | null;
  email?: string | null;
} | null | undefined): string | null {
  if (!user) return null;
  const full = `${user.firstName || ''} ${user.lastName || ''}`.trim();
  const name = full || user.displayName?.trim() || user.email?.trim() || null;
  if (!name || isPlaceholderUserName(name)) return null;
  return name;
}

/** Resolve a platform user id to a display name, checking linked accounts. */
export async function resolveUserDisplayName(
  userId: string | null | undefined
): Promise<string | null> {
  if (!userId) return null;

  const linkedIds = await getLinkedUserIds(String(userId));
  const idsToTry = [...new Set([String(userId), ...linkedIds.map(String)])];

  const rows = await db
    .select({
      id: users.id,
      firstName: users.firstName,
      lastName: users.lastName,
      displayName: users.displayName,
      email: users.email,
    })
    .from(users)
    .where(inArray(users.id, idsToTry));

  for (const id of idsToTry) {
    const row = rows.find((r) => r.id === id);
    const name = formatUserDisplayName(row);
    if (name) return name;
  }

  return null;
}

/** Some kudos templates embed the recipient name before the trailing "!". */
export function extractRecipientNameFromKudosContent(
  content: string | null | undefined
): string | null {
  if (!content) return null;
  const match = content.match(/,\s*([^!\n]{2,80})!/);
  if (!match?.[1]) return null;
  const candidate = match[1].trim();
  if (isPlaceholderUserName(candidate)) return null;
  return candidate;
}

export function resolveKudosSenderName(params: {
  joinedUser?: {
    firstName?: string | null;
    lastName?: string | null;
    displayName?: string | null;
    email?: string | null;
  } | null;
  storedSenderName?: string | null;
}): string | null {
  return (
    formatUserDisplayName(params.joinedUser) ||
    (params.storedSenderName && !isPlaceholderUserName(params.storedSenderName)
      ? params.storedSenderName.trim()
      : null)
  );
}

export function resolveKudosRecipientName(params: {
  lookedUpName?: string | null;
  messageContent?: string | null;
}): string | null {
  if (params.lookedUpName && !isPlaceholderUserName(params.lookedUpName)) {
    return params.lookedUpName.trim();
  }
  return extractRecipientNameFromKudosContent(params.messageContent);
}
