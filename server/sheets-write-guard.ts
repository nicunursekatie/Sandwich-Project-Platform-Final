import { logger } from './utils/production-safe-logger';

/**
 * Central Google Sheets WRITE guard.
 *
 * Owner mandate (Jul 27 2026): the app must NEVER write rows to the planning
 * sheet or the event-request (Squarespace intake) sheet. All app→sheet write
 * code for those sheets was removed; this guard is the belt-and-suspenders
 * choke point that structurally prevents any future code path from writing to
 * them through ANY Google Sheets service in this codebase.
 *
 * Rules:
 * 1. Writes targeting PLANNING_SHEET_ID or EVENT_REQUESTS_SHEET_ID are
 *    hard-blocked UNCONDITIONALLY — no allow flag can override this.
 * 2. All other sheet writes are blocked unless the calling service is on the
 *    explicit allowlist below. Adding a new sheet-writing feature requires a
 *    deliberate edit here.
 * 3. Every blocked attempt is logged loudly and throws SheetWriteBlockedError.
 *
 * Every spreadsheets.values.update/append/batchUpdate/clear and
 * spreadsheets.batchUpdate call in the server MUST call
 * assertSheetWriteAllowed() first.
 */

export class SheetWriteBlockedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SheetWriteBlockedError';
  }
}

/**
 * Services explicitly allowed to write to Google Sheets (never to the
 * protected sheets — rule 1 always wins). Keep this list short and deliberate.
 */
const ALLOWED_WRITE_SERVICES = new Set([
  'projects-sync', // GoogleSheetsService — projects planning spreadsheet (GOOGLE_SPREADSHEET_ID)
  'meeting-export', // GoogleSheetsMeetingExporter — writes to sheets it creates itself
  'error-log-sync', // error-log-sheet-sync — appends to ERROR_LOG_SHEET_ID
]);

/** Spreadsheet IDs the app must never write to, resolved at call time. */
function protectedSpreadsheetIds(): { id: string; label: string }[] {
  const out: { id: string; label: string }[] = [];
  const planning = process.env.PLANNING_SHEET_ID?.trim();
  if (planning) out.push({ id: planning, label: 'Planning Sheet (PLANNING_SHEET_ID)' });
  const eventRequests = process.env.EVENT_REQUESTS_SHEET_ID?.trim();
  if (eventRequests)
    out.push({ id: eventRequests, label: 'Event Requests Sheet (EVENT_REQUESTS_SHEET_ID)' });
  return out;
}

export interface SheetWriteAttempt {
  /** The spreadsheet ID the write targets. undefined = creating a brand-new spreadsheet. */
  spreadsheetId: string | undefined;
  /** Which service is attempting the write (must be on the allowlist). */
  service: string;
  /** Short description of the operation, for logs (e.g. 'values.append A:J'). */
  operation?: string;
}

/**
 * Throws SheetWriteBlockedError unless this write is explicitly allowed.
 * Call this immediately before EVERY mutating Google Sheets API call.
 */
export function assertSheetWriteAllowed(attempt: SheetWriteAttempt): void {
  const { spreadsheetId, service, operation } = attempt;

  // Rule 1: protected sheets are read-only for the app, no exceptions.
  if (spreadsheetId) {
    const hit = protectedSpreadsheetIds().find((p) => p.id === spreadsheetId);
    if (hit) {
      const msg = `BLOCKED sheet write: ${hit.label} is app-read-only by owner mandate. service=${service} operation=${operation ?? 'unknown'}`;
      logger.error(`🚫🚫🚫 [SheetWriteGuard] ${msg}`);
      throw new SheetWriteBlockedError(msg);
    }
  }

  // Rule 2: everything else needs an explicitly allowlisted service.
  if (!ALLOWED_WRITE_SERVICES.has(service)) {
    const msg = `BLOCKED sheet write: service "${service}" is not on the sheet-write allowlist. spreadsheetId=${spreadsheetId ?? '(new spreadsheet)'} operation=${operation ?? 'unknown'}`;
    logger.error(`🚫🚫🚫 [SheetWriteGuard] ${msg}`);
    throw new SheetWriteBlockedError(msg);
  }
}
