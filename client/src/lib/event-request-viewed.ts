/** Per-user "I've opened this new request" markers — UI only; does not change workflow status. */

const STORAGE_PREFIX = 'eventRequests.viewed.v1';

type ViewedStore = Record<string, number>;

const listeners = new Set<() => void>();

function storageKey(userId: string): string {
  return `${STORAGE_PREFIX}.${userId}`;
}

function loadStore(userId: string): ViewedStore {
  try {
    const raw = localStorage.getItem(storageKey(userId));
    if (!raw) return {};
    const parsed = JSON.parse(raw) as ViewedStore;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function saveStore(userId: string, store: ViewedStore): void {
  try {
    localStorage.setItem(storageKey(userId), JSON.stringify(store));
  } catch {
    // ignore quota / private mode
  }
}

function notify(): void {
  listeners.forEach((listener) => listener());
}

export function subscribeEventRequestViewedChanges(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getViewedEventIds(userId: string): Set<number> {
  const store = loadStore(userId);
  return new Set(
    Object.keys(store)
      .map((id) => parseInt(id, 10))
      .filter((id) => !Number.isNaN(id))
  );
}

export function markEventRequestViewed(userId: string, eventId: number): boolean {
  const store = loadStore(userId);
  const key = String(eventId);
  if (store[key]) return false;
  store[key] = Date.now();
  saveStore(userId, store);
  notify();
  return true;
}

export function pruneViewedEventIds(userId: string, activeNewEventIds: Iterable<number>): void {
  const active = new Set(activeNewEventIds);
  const store = loadStore(userId);
  let changed = false;
  for (const id of Object.keys(store)) {
    if (!active.has(parseInt(id, 10))) {
      delete store[id];
      changed = true;
    }
  }
  if (changed) {
    saveStore(userId, store);
    notify();
  }
}

export function computeUnviewedNewCount(
  userId: string,
  newEvents: Array<{ id: number; status?: string | null }>,
  totalNewCount: number,
  listResolved: boolean
): number {
  if (totalNewCount === 0) return 0;

  const viewed = getViewedEventIds(userId);
  const newOnly = newEvents.filter((event) => event.status === 'new');

  if (newOnly.length > 0) {
    return newOnly.filter((event) => !viewed.has(event.id)).length;
  }

  if (!listResolved) {
    // List still loading: estimate from server total minus persisted views.
    // Never return raw totalNewCount — that ignores opens before the fetch completes.
    return Math.max(0, totalNewCount - Math.min(viewed.size, totalNewCount));
  }

  return 0;
}
