import {
  assertSheetWriteAllowed,
  SheetWriteBlockedError,
} from '../../server/sheets-write-guard';

const PLANNING_ID = 'planning-sheet-spreadsheet-id-123';
const EVENT_REQUESTS_ID = 'event-requests-spreadsheet-id-456';
const OTHER_ID = 'some-other-spreadsheet-id-789';

describe('assertSheetWriteAllowed', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env.PLANNING_SHEET_ID = PLANNING_ID;
    process.env.EVENT_REQUESTS_SHEET_ID = EVENT_REQUESTS_ID;
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('hard-blocks writes to the planning sheet even from an allowlisted service', () => {
    expect(() =>
      assertSheetWriteAllowed({
        spreadsheetId: PLANNING_ID,
        service: 'projects-sync',
        operation: 'values.update test',
      })
    ).toThrow(SheetWriteBlockedError);
  });

  it('hard-blocks writes to the event-request sheet regardless of service', () => {
    for (const service of ['projects-sync', 'meeting-export', 'error-log-sync', 'event-requests-sync', 'anything']) {
      expect(() =>
        assertSheetWriteAllowed({
          spreadsheetId: EVENT_REQUESTS_ID,
          service,
        })
      ).toThrow(SheetWriteBlockedError);
    }
  });

  it('allows an explicitly-enabled service to write to a non-protected sheet', () => {
    expect(() =>
      assertSheetWriteAllowed({
        spreadsheetId: OTHER_ID,
        service: 'projects-sync',
      })
    ).not.toThrow();
    expect(() =>
      assertSheetWriteAllowed({
        spreadsheetId: OTHER_ID,
        service: 'error-log-sync',
      })
    ).not.toThrow();
    expect(() =>
      assertSheetWriteAllowed({
        spreadsheetId: undefined, // creating a brand-new spreadsheet
        service: 'meeting-export',
      })
    ).not.toThrow();
  });

  it('blocks non-allowlisted services from writing to ANY sheet', () => {
    expect(() =>
      assertSheetWriteAllowed({
        spreadsheetId: OTHER_ID,
        service: 'event-requests-sync',
      })
    ).toThrow(SheetWriteBlockedError);
    expect(() =>
      assertSheetWriteAllowed({
        spreadsheetId: OTHER_ID,
        service: 'some-future-feature',
      })
    ).toThrow(SheetWriteBlockedError);
  });

  it('still blocks protected sheets when env IDs have surrounding whitespace', () => {
    process.env.PLANNING_SHEET_ID = `  ${PLANNING_ID}  `;
    expect(() =>
      assertSheetWriteAllowed({
        spreadsheetId: PLANNING_ID,
        service: 'projects-sync',
      })
    ).toThrow(SheetWriteBlockedError);
  });
});
