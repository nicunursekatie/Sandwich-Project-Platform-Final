/**
 * Utilities for turning raw Postgres/node-postgres errors into actionable API
 * responses instead of opaque 500s.
 *
 * Why this exists: event-request saves (the scheduling form especially) write a
 * wide, ever-growing set of columns. When a write fails, the driver throws a
 * low-level error whose useful detail (which column, which constraint) lives in
 * `.code` / `.column` / `.detail` or is buried in the message. The API route
 * used to collapse all of these into "Failed to update event request" / a bare
 * 500, which told neither the user nor whoever reads the error report anything.
 *
 * Two things use this:
 *  1. A retry that gracefully drops columns that exist in the Drizzle schema but
 *     not on the current database branch (migrations are applied manually per
 *     Neon branch, so dev and production drift). Those raise 42703
 *     (undefined_column) and previously failed the ENTIRE save.
 *  2. A classifier that maps common constraint errors to specific 4xx messages.
 */

/** Postgres error codes we translate into actionable API responses. */
export const PG_ERROR_CODES = {
  UNDEFINED_COLUMN: '42703',
  NOT_NULL_VIOLATION: '23502',
  FOREIGN_KEY_VIOLATION: '23503',
  UNIQUE_VIOLATION: '23505',
  INVALID_TEXT_REPRESENTATION: '22P02',
  NUMERIC_VALUE_OUT_OF_RANGE: '22003',
  STRING_DATA_RIGHT_TRUNCATION: '22001',
  DATETIME_FIELD_OVERFLOW: '22008',
} as const;

export interface PgErrorInfo {
  /** SQLSTATE code, e.g. "42703". Undefined for non-Postgres errors. */
  code?: string;
  /** The column named by the error (snake_case), when the driver/message exposes one. */
  column?: string;
  /** Constraint name, when present (e.g. a foreign-key or unique constraint). */
  constraint?: string;
  /** The driver's `detail` field, when present. */
  detail?: string;
  /** Always populated — the raw error message (or a fallback). */
  message: string;
}

/** Convert a camelCase Drizzle field name to its snake_case column name. */
export function camelToSnakeCase(key: string): string {
  return key.replace(/[A-Z]/g, (m) => `_${m.toLowerCase()}`);
}

/**
 * Best-effort structured info from a thrown DB error. Prefers the driver's own
 * fields (`code`, `column`, `constraint`, `detail`) and falls back to parsing
 * the message for the column name when the driver didn't set it (notably 42703,
 * which does not populate `.column`).
 */
export function parsePgError(error: unknown): PgErrorInfo {
  // A thrown string carries its own message and no structured fields.
  if (typeof error === 'string') {
    return { message: error };
  }
  const err = (error ?? {}) as Record<string, any>;
  const message = typeof err.message === 'string' ? err.message : String(err.message ?? 'Unknown database error');

  let column: string | undefined =
    typeof err.column === 'string' && err.column.length > 0 ? err.column : undefined;

  // 42703 (and some driver versions) leave `.column` empty — the name is in the
  // message: `column "foo" of relation "event_requests" does not exist` or
  // `column "foo" does not exist`.
  if (!column) {
    const m = message.match(/column "([^"]+)"/i);
    if (m) column = m[1];
  }

  return {
    code: typeof err.code === 'string' ? err.code : undefined,
    column,
    constraint: typeof err.constraint === 'string' ? err.constraint : undefined,
    detail: typeof err.detail === 'string' ? err.detail : undefined,
    message,
  };
}

/**
 * The snake_case column an undefined_column (42703) error refers to, or null if
 * the error is not an undefined-column error (or the column can't be recovered).
 */
export function getUndefinedColumn(error: unknown): string | null {
  const info = parsePgError(error);
  if (info.code !== PG_ERROR_CODES.UNDEFINED_COLUMN) return null;
  return info.column ?? null;
}

/**
 * Remove from `updates` the key whose column maps to `snakeColumn`, mutating the
 * object. Matching is done on the snake_case form so a camelCase Drizzle key
 * (e.g. `addedToOfficialSheetAt`) matches the DB column (`added_to_official_sheet_at`).
 * Returns the removed camelCase key, or null when nothing matched.
 */
export function dropColumnKey(updates: Record<string, any>, snakeColumn: string): string | null {
  const target = snakeColumn.toLowerCase();
  for (const key of Object.keys(updates)) {
    if (camelToSnakeCase(key).toLowerCase() === target || key.toLowerCase() === target) {
      delete updates[key];
      return key;
    }
  }
  return null;
}

/** Turn a snake_case / camelCase column into a human-readable field label. */
export function humanizeColumn(column: string | undefined): string {
  if (!column) return 'a field';
  return column
    .replace(/[A-Z]/g, (m) => ` ${m.toLowerCase()}`)
    .replace(/_/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export interface ClassifiedDbError {
  /** HTTP status to respond with. */
  status: number;
  /** User-facing message. */
  message: string;
  /** Stable error code for the client to branch on. */
  error: string;
  /** The column involved, when known (for the client / error report). */
  column?: string;
}

/**
 * Map a DB error to an actionable HTTP response. Returns null when the error is
 * not a recognized constraint/type error, so the caller keeps its generic 500.
 */
export function classifyDbError(error: unknown): ClassifiedDbError | null {
  const info = parsePgError(error);
  const field = humanizeColumn(info.column);

  // Some deployments surface type errors only in the message (no SQLSTATE).
  const looksLikeInvalidSyntax =
    info.code === PG_ERROR_CODES.INVALID_TEXT_REPRESENTATION ||
    /invalid input syntax/i.test(info.message);

  if (looksLikeInvalidSyntax) {
    return {
      status: 400,
      message: 'One of the fields has an invalid value. Please check numbers and dates and try again.',
      error: 'INVALID_DATA_FORMAT',
      column: info.column,
    };
  }

  switch (info.code) {
    case PG_ERROR_CODES.NOT_NULL_VIOLATION:
      return {
        status: 400,
        message: `The field "${field}" is required and can't be left empty.`,
        error: 'REQUIRED_FIELD_MISSING',
        column: info.column,
      };
    case PG_ERROR_CODES.NUMERIC_VALUE_OUT_OF_RANGE:
      return {
        status: 400,
        message: 'A number you entered is too large. Please enter a smaller value.',
        error: 'NUMBER_OUT_OF_RANGE',
        column: info.column,
      };
    case PG_ERROR_CODES.STRING_DATA_RIGHT_TRUNCATION:
      return {
        status: 400,
        message: 'One of the text fields is too long. Please shorten it and try again.',
        error: 'VALUE_TOO_LONG',
        column: info.column,
      };
    case PG_ERROR_CODES.DATETIME_FIELD_OVERFLOW:
      return {
        status: 400,
        message: 'One of the dates is invalid. Please re-check the date fields.',
        error: 'INVALID_DATE',
        column: info.column,
      };
    case PG_ERROR_CODES.FOREIGN_KEY_VIOLATION:
      return {
        status: 400,
        message:
          'A linked record (driver, speaker, or recipient) no longer exists. Please refresh the page and reselect it.',
        error: 'LINKED_RECORD_MISSING',
        column: info.column,
      };
    case PG_ERROR_CODES.UNIQUE_VIOLATION:
      return {
        status: 409,
        message: 'That value is already in use by another record.',
        error: 'DUPLICATE_VALUE',
        column: info.column,
      };
    default:
      return null;
  }
}
