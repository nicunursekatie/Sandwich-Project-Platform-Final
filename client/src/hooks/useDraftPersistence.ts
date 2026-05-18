import { useEffect, useRef, useState } from 'react';

const STORAGE_PREFIX = 'tsp-draft:';

export interface Draft<T> {
  data: T;
  savedAt: string;
  // version of the server record at the time the draft was saved (e.g. event.updatedAt),
  // so the UI can warn when restoring a draft based on now-stale server data.
  version?: string | null;
}

function storageAvailable(): boolean {
  try {
    const probe = '__tsp_draft_probe__';
    localStorage.setItem(probe, probe);
    localStorage.removeItem(probe);
    return true;
  } catch {
    return false;
  }
}

export function loadDraft<T>(key: string | null | undefined): Draft<T> | null {
  if (!key || !storageAvailable()) return null;
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + key);
    if (!raw) return null;
    const draft = JSON.parse(raw) as Draft<T>;
    if (!draft || typeof draft !== 'object' || !draft.savedAt) return null;
    return draft;
  } catch {
    return null;
  }
}

export function clearDraft(key: string | null | undefined): void {
  if (!key || !storageAvailable()) return;
  try {
    localStorage.removeItem(STORAGE_PREFIX + key);
  } catch {
    // ignore
  }
}

function writeDraft<T>(key: string, data: T, version: string | null): boolean {
  try {
    const payload: Draft<T> = {
      data,
      savedAt: new Date().toISOString(),
      version,
    };
    localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(payload));
    return true;
  } catch {
    return false;
  }
}

interface UseDraftPersistenceOptions<T> {
  key: string | null;
  data: T;
  // Set false to suspend autosave (e.g. before the user has made any changes,
  // or while the dialog is closed). Prevents overwriting a saved draft with
  // the initial form state when a dialog mounts.
  enabled: boolean;
  // Server-side version of the underlying record (event.updatedAt).
  // Stored with the draft so callers can flag stale drafts.
  version?: string | Date | null;
  debounceMs?: number;
}

/**
 * Auto-persists form state to localStorage with debouncing.
 * Returns the ISO timestamp of the most recent successful save (or null).
 */
export function useDraftPersistence<T>({
  key,
  data,
  enabled,
  version,
  debounceMs = 500,
}: UseDraftPersistenceOptions<T>): { savedAt: string | null } {
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const serialized = JSON.stringify(data);
  const versionString = version
    ? version instanceof Date
      ? version.toISOString()
      : String(version)
    : null;

  useEffect(() => {
    if (!enabled || !key) return;
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      const ok = writeDraft(key, JSON.parse(serialized), versionString);
      if (ok) setSavedAt(new Date().toISOString());
    }, debounceMs);
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [key, serialized, enabled, debounceMs, versionString]);

  return { savedAt };
}

export function formatDraftTimestamp(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString();
}
