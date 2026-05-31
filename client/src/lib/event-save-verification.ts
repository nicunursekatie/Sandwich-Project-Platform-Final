import { apiRequest } from '@/lib/queryClient';

export interface DroppedEventField {
  field: string;
  reason: string;
}

export class EventPatchVerificationError extends Error {
  droppedFields: DroppedEventField[];
  mismatchedFields: string[];
  savedEvent: Record<string, any> | null | undefined;

  constructor({
    droppedFields,
    mismatchedFields,
    savedEvent,
  }: {
    droppedFields: DroppedEventField[];
    mismatchedFields: string[];
    savedEvent: Record<string, any> | null | undefined;
  }) {
    const pieces = [
      droppedFields.length > 0
        ? `Not saved: ${droppedFields.map((d) => `${d.field} (${d.reason})`).join(', ')}`
        : '',
      mismatchedFields.length > 0
        ? `Needs review: ${mismatchedFields.join(', ')} did not match the saved response.`
        : '',
    ].filter(Boolean);

    super(pieces.join(' ') || 'Some event fields may not have saved correctly.');
    this.name = 'EventPatchVerificationError';
    this.droppedFields = droppedFields;
    this.mismatchedFields = mismatchedFields;
    this.savedEvent = savedEvent;
  }
}

function normalizeDateForCompare(value: any): string | null {
  if (!value) return null;
  if (typeof value !== 'string') return String(value);
  const match = value.match(/^(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : value;
}

/**
 * Return the fields the server *explicitly* reported as dropped during a save.
 *
 * This is the only authoritative signal that a successful (HTTP 200) PATCH did
 * not fully persist. `findMismatchedSavedFields` below is a heuristic best-effort
 * comparison and is NOT reliable enough to block a save: the server legitimately
 * transforms many fields (auto-bumps `driversNeeded`/`speakersNeeded`, sets
 * `isConfirmed`, normalizes dates, returns `null` where the client sent `false`,
 * stores recipients/assignments in join tables, parses JSON columns, etc.).
 * Treating those heuristic mismatches as failures made every "Mark Scheduled"
 * save appear to silently not save — the dialog stayed open and the draft was
 * preserved even though the event had actually been saved.
 */
export function getDroppedServerFields(
  savedEvent: Record<string, any> | null | undefined
): DroppedEventField[] {
  return Array.isArray(savedEvent?._droppedFields)
    ? (savedEvent!._droppedFields as DroppedEventField[])
    : [];
}

export function findMismatchedSavedFields(
  expectedUpdates: Record<string, any>,
  savedEvent: Record<string, any> | null | undefined
): string[] {
  if (!savedEvent) return Object.keys(expectedUpdates).filter((field) => !field.startsWith('_'));

  const normalizeForCompare = (value: any): any => {
    if (value === '' || value === undefined) return null;
    if (value instanceof Date) return normalizeDateForCompare(value.toISOString());
    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
        return normalizeDateForCompare(trimmed);
      }
      if (
        (trimmed.startsWith('[') && trimmed.endsWith(']')) ||
        (trimmed.startsWith('{') && trimmed.endsWith('}'))
      ) {
        try {
          return normalizeForCompare(JSON.parse(trimmed));
        } catch {
          if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
            return trimmed
              .slice(1, -1)
              .split(',')
              .map((item) => item.replace(/^"|"$/g, '').trim())
              .filter(Boolean);
          }
          return trimmed;
        }
      }
      return trimmed;
    }
    if (Array.isArray(value)) {
      return value.map((item) => normalizeForCompare(item));
    }
    if (value && typeof value === 'object') {
      return Object.keys(value)
        .sort()
        .reduce<Record<string, any>>((acc, key) => {
          acc[key] = normalizeForCompare(value[key]);
          return acc;
        }, {});
    }
    return value ?? null;
  };

  return Object.keys(expectedUpdates).filter((field) => {
    if (field.startsWith('_')) return false;
    return JSON.stringify(normalizeForCompare(expectedUpdates[field])) !==
      JSON.stringify(normalizeForCompare(savedEvent[field]));
  });
}

export function verifyEventPatchResponse(
  updates: Record<string, any>,
  savedEvent: Record<string, any> | null | undefined
) {
  const droppedFields = Array.isArray(savedEvent?._droppedFields)
    ? savedEvent._droppedFields as DroppedEventField[]
    : [];
  const mismatchedFields = findMismatchedSavedFields(updates, savedEvent);

  if (droppedFields.length > 0 || mismatchedFields.length > 0) {
    throw new EventPatchVerificationError({
      droppedFields,
      mismatchedFields,
      savedEvent,
    });
  }
}

export async function patchEventRequestVerified(
  eventId: number,
  updates: Record<string, any>
) {
  const savedEvent = await apiRequest('PATCH', `/api/event-requests/${eventId}`, updates);
  verifyEventPatchResponse(updates, savedEvent);
  return savedEvent;
}

