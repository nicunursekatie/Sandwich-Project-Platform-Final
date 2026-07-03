import {
  camelToSnakeCase,
  parsePgError,
  getUndefinedColumn,
  dropColumnKey,
  humanizeColumn,
  classifyDbError,
  PG_ERROR_CODES,
} from '../../server/utils/pg-error-utils';

/** Build a fake node-postgres error. */
function pgError(fields: Record<string, any>): Error {
  return Object.assign(new Error(fields.message ?? 'db error'), fields);
}

describe('camelToSnakeCase', () => {
  it('converts camelCase Drizzle keys to snake_case columns', () => {
    expect(camelToSnakeCase('addedToOfficialSheetAt')).toBe('added_to_official_sheet_at');
    expect(camelToSnakeCase('status')).toBe('status');
    expect(camelToSnakeCase('scheduledEventDate')).toBe('scheduled_event_date');
  });
});

describe('parsePgError', () => {
  it('prefers the driver-provided column', () => {
    const info = parsePgError(pgError({ code: '23502', column: 'organization_name', message: 'null value' }));
    expect(info.code).toBe('23502');
    expect(info.column).toBe('organization_name');
  });

  it('recovers the column from the message when the driver omits it (42703)', () => {
    const info = parsePgError(
      pgError({ code: '42703', message: 'column "added_to_official_sheet_at" of relation "event_requests" does not exist' })
    );
    expect(info.column).toBe('added_to_official_sheet_at');
  });

  it('never throws on non-Postgres / empty errors', () => {
    expect(parsePgError(undefined).message).toBeDefined();
    expect(parsePgError(null).code).toBeUndefined();
    expect(parsePgError('boom').message).toBe('boom');
  });
});

describe('getUndefinedColumn', () => {
  it('returns the column only for undefined_column (42703)', () => {
    expect(
      getUndefinedColumn(pgError({ code: '42703', message: 'column "van_needed_likely" does not exist' }))
    ).toBe('van_needed_likely');
    expect(getUndefinedColumn(pgError({ code: '23502', column: 'x', message: 'not null' }))).toBeNull();
    expect(getUndefinedColumn(new Error('random'))).toBeNull();
  });
});

describe('dropColumnKey', () => {
  it('removes the camelCase key matching a snake_case column and returns it', () => {
    const updates: Record<string, any> = { status: 'scheduled', addedToOfficialSheetAt: new Date(), foo: 1 };
    const removed = dropColumnKey(updates, 'added_to_official_sheet_at');
    expect(removed).toBe('addedToOfficialSheetAt');
    expect(updates).not.toHaveProperty('addedToOfficialSheetAt');
    expect(updates).toHaveProperty('status');
  });

  it('matches a key that is already snake_case', () => {
    const updates: Record<string, any> = { some_column: 1 };
    expect(dropColumnKey(updates, 'some_column')).toBe('some_column');
  });

  it('returns null when no key maps to the column', () => {
    const updates: Record<string, any> = { status: 'scheduled' };
    expect(dropColumnKey(updates, 'nonexistent_column')).toBeNull();
    expect(updates).toHaveProperty('status');
  });
});

describe('humanizeColumn', () => {
  it('produces a readable label from snake_case or camelCase', () => {
    expect(humanizeColumn('organization_name')).toBe('organization name');
    expect(humanizeColumn('scheduledEventDate')).toBe('scheduled event date');
    expect(humanizeColumn(undefined)).toBe('a field');
  });
});

describe('classifyDbError', () => {
  it('classifies not-null violations as an actionable 400 naming the field', () => {
    const c = classifyDbError(pgError({ code: PG_ERROR_CODES.NOT_NULL_VIOLATION, column: 'organization_name', message: 'null value' }));
    expect(c?.status).toBe(400);
    expect(c?.error).toBe('REQUIRED_FIELD_MISSING');
    expect(c?.message).toContain('organization name');
  });

  it('classifies invalid input syntax (by message, no code) as 400', () => {
    const c = classifyDbError(new Error('invalid input syntax for type integer: "abc"'));
    expect(c?.status).toBe(400);
    expect(c?.error).toBe('INVALID_DATA_FORMAT');
  });

  it('classifies numeric overflow as 400', () => {
    const c = classifyDbError(pgError({ code: PG_ERROR_CODES.NUMERIC_VALUE_OUT_OF_RANGE, message: 'out of range' }));
    expect(c?.status).toBe(400);
    expect(c?.error).toBe('NUMBER_OUT_OF_RANGE');
  });

  it('classifies foreign-key violations as 400', () => {
    const c = classifyDbError(pgError({ code: PG_ERROR_CODES.FOREIGN_KEY_VIOLATION, message: 'fk' }));
    expect(c?.status).toBe(400);
    expect(c?.error).toBe('LINKED_RECORD_MISSING');
  });

  it('classifies unique violations as 409', () => {
    const c = classifyDbError(pgError({ code: PG_ERROR_CODES.UNIQUE_VIOLATION, message: 'dup' }));
    expect(c?.status).toBe(409);
  });

  it('returns null for undefined_column (handled by drop-and-retry, not the catch)', () => {
    expect(classifyDbError(pgError({ code: PG_ERROR_CODES.UNDEFINED_COLUMN, message: 'column "x" does not exist' }))).toBeNull();
  });

  it('returns null for unrecognized errors so the caller keeps its generic 500', () => {
    expect(classifyDbError(new Error('some unexpected failure'))).toBeNull();
  });
});
