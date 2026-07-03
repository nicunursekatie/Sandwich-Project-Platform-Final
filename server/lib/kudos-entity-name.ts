import { eq, sql } from 'drizzle-orm';
import { db } from '../db';

const PLACEHOLDER_ENTITY_NAMES = new Set([
  'unknown',
  'unknown entity',
  'legacy entry',
]);

export function isDisplayableKudosEntityName(
  name: string | null | undefined
): boolean {
  if (!name?.trim()) return false;
  return !PLACEHOLDER_ENTITY_NAMES.has(name.trim().toLowerCase());
}

/** Resolve the linked project/task/challenge title for a kudos entry. */
export async function resolveKudosEntityName(params: {
  contextType: string;
  contextId: string;
  storedEntityName?: string | null;
}): Promise<string | undefined> {
  const stored = params.storedEntityName?.trim();
  if (stored && isDisplayableKudosEntityName(stored)) {
    return stored;
  }

  if (params.contextType === 'task') {
    try {
      const [task] = await db
        .select({ title: sql<string>`title` })
        .from(sql`project_tasks`)
        .where(sql`id = ${params.contextId}`)
        .limit(1);
      const title = task?.title?.trim();
      if (title && isDisplayableKudosEntityName(title)) return title;
    } catch {
      // ignore lookup failures
    }
    return undefined;
  }

  if (params.contextType === 'project') {
    try {
      const [project] = await db
        .select({ title: sql<string>`title` })
        .from(sql`projects`)
        .where(sql`id = ${params.contextId}`)
        .limit(1);
      const title = project?.title?.trim();
      if (title && isDisplayableKudosEntityName(title)) return title;
    } catch {
      // ignore lookup failures
    }
    return undefined;
  }

  // general, onboarding_challenge, etc. — only the stored name applies
  return undefined;
}
