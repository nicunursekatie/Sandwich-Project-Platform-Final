import {
  computeSheetPlacement,
  parsePlanningSheetDate,
  type PlanningSheetRow,
} from '../../server/planning-sheet-sync-service';

function makeRow(
  rowIndex: number,
  date: string,
  overrides: Partial<PlanningSheetRow> = {}
): PlanningSheetRow {
  return {
    rowIndex,
    date,
    dayOfWeek: '',
    groupName: `Group ${rowIndex}`,
    eventStartTime: '',
    eventEndTime: '',
    pickUpTime: '',
    pickUpNextDay: '',
    allDetails: '',
    vanBooked: '',
    staffing: '',
    staffingParsed: {
      driver: { needed: false, assigned: null, isVanDriver: false },
      speaker: { needed: false, assigned: null },
      volunteer: { needed: false, assigned: null },
    },
    estimateSandwiches: '',
    deliOrPbj: '',
    finalSandwiches: '',
    totalInApp: '',
    socialPost: '',
    sentToolkit: '',
    contactName: '',
    email: '',
    phone: '',
    tspContact: '',
    address: '',
    recipientHost: '',
    afterEventNotes: '',
    cancelled: '',
    notes: '',
    addlNotes: '',
    waitingOn: '',
    ...overrides,
  };
}

/** A year's worth of events in date order, the way the team keeps the sheet. */
const sortedSheet = [
  makeRow(2, '1/15/26'),
  makeRow(3, '3/14/26'),
  makeRow(4, '6/2/26'),
  makeRow(5, '10/20/26'),
  makeRow(6, '12/5/26'),
];

describe('parsePlanningSheetDate', () => {
  it('reads the formats the sheet actually contains', () => {
    expect(parsePlanningSheetDate('3/14/26')).toEqual(new Date(2026, 2, 14));
    expect(parsePlanningSheetDate('3/14/2026')).toEqual(new Date(2026, 2, 14));
    expect(parsePlanningSheetDate('03/14/2026')).toEqual(new Date(2026, 2, 14));
    expect(parsePlanningSheetDate('Mar 14, 2026')).toEqual(new Date(2026, 2, 14));
  });

  it('applies the sheet year to cells that omit it', () => {
    // Without the hint these resolve to 2001 and sort before every real event.
    expect(parsePlanningSheetDate('3/14', 2026)).toEqual(new Date(2026, 2, 14));
    expect(parsePlanningSheetDate('Mar 14', 2026)).toEqual(new Date(2026, 2, 14));
  });

  it('returns null for cells that are not dates', () => {
    expect(parsePlanningSheetDate('')).toBeNull();
    expect(parsePlanningSheetDate('   ')).toBeNull();
    expect(parsePlanningSheetDate('TBD')).toBeNull();
  });
});

describe('computeSheetPlacement', () => {
  it('inserts directly below the event it follows', () => {
    const placement = computeSheetPlacement(sortedSheet, new Date(2026, 6, 4));
    expect(placement.insertBeforeRow).toBe(5); // after 6/2/26 (row 4), before 10/20/26
    expect(placement.reason).toBe('insert_after_previous_event');
  });

  it('inserts at the top when the event precedes everything', () => {
    const placement = computeSheetPlacement(sortedSheet, new Date(2026, 0, 1));
    expect(placement.insertBeforeRow).toBe(2);
    expect(placement.reason).toBe('insert_before_later_event');
  });

  // The sheet is grouped into week blocks: dated events, then any empty slots
  // reserved for that week, then a total row. None of the structural rows carry
  // a date, and stepping over them drops the event into the following week and
  // out of the total that should count it.
  it('stays inside its own week block instead of stepping over the total row', () => {
    const weekBlocks = [
      makeRow(363, '9/2/26'),
      makeRow(365, '9/6/26'),
      makeRow(366, '', { groupName: '', estimateSandwiches: '4250' }), // week total
      makeRow(367, '9/8/26'),
      makeRow(368, '9/9/26'),
    ];

    const placement = computeSheetPlacement(weekBlocks, new Date(2026, 8, 7));
    expect(placement.insertBeforeRow).toBe(366); // not 367, below the total
    expect(placement.note).toContain('close out the week');
  });

  it('fills a week that has empty slots reserved for it', () => {
    const weekBlocks = [
      makeRow(419, '10/24/26'),
      makeRow(420, ''),
      makeRow(421, ''),
      makeRow(424, '', { groupName: '', estimateSandwiches: '1050' }), // week total
      makeRow(425, '11/4/26'),
    ];

    expect(
      computeSheetPlacement(weekBlocks, new Date(2026, 9, 25)).insertBeforeRow
    ).toBe(420);
  });

  // The bug that started all this: one row mistyped as 2029 is "later" than
  // every event, so scanning from the top for the first later-dated row stopped
  // there every single time and every push landed on that one row.
  it('is not hijacked by a single mistyped year', () => {
    const withTypo = [
      makeRow(2, '1/15/26'),
      makeRow(3, '2/10/26'),
      makeRow(4, '3/14/26'),
      makeRow(5, '12/1/2029'), // typo — should have been 2026
      makeRow(6, '4/2/26'),
      makeRow(7, '5/8/26'),
      makeRow(8, '6/2/26'),
      makeRow(9, '7/4/26'),
    ];

    const placement = computeSheetPlacement(withTypo, new Date(2026, 5, 20));
    expect(placement.insertBeforeRow).toBe(9); // after 6/2, before 7/4
    expect(placement.outOfOrderRows).toEqual([{ rowIndex: 5, date: '12/1/2029' }]);
    expect(placement.note).toContain('row 5');
  });

  it('is not dragged to the bottom by a stray past date either', () => {
    const withStrayPast = [
      makeRow(2, '1/15/26'),
      makeRow(3, '2/10/26'),
      makeRow(4, '3/14/26'),
      makeRow(5, '4/2/26'),
      makeRow(6, '5/8/26'),
      makeRow(7, '4/18/25'), // typo — should have been 2026
      makeRow(8, '7/4/26'),
      makeRow(9, '8/1/26'),
    ];

    const placement = computeSheetPlacement(withStrayPast, new Date(2026, 5, 20));
    expect(placement.insertBeforeRow).toBe(8); // after 5/8, before 7/4
    // The stray sits above the chosen position and is dated before the event,
    // so it doesn't argue with this placement — nothing to warn about here.
    expect(placement.outOfOrderRows).toEqual([]);
  });

  it('orders by start time within the same date', () => {
    const sameDay = [
      makeRow(2, '3/14/26', { eventStartTime: '9:00 AM' }),
      makeRow(3, '3/14/26', { eventStartTime: '2:00 PM' }),
      makeRow(4, '4/1/26'),
    ];

    expect(
      computeSheetPlacement(sameDay, new Date(2026, 2, 14), { eventTime: '11:00' })
        .insertBeforeRow
    ).toBe(3);
    expect(
      computeSheetPlacement(sameDay, new Date(2026, 2, 14), { eventTime: '8:00' })
        .insertBeforeRow
    ).toBe(2);
    // Later than every event that day: sits below the last of them.
    expect(
      computeSheetPlacement(sameDay, new Date(2026, 2, 14), { eventTime: '18:00' })
        .insertBeforeRow
    ).toBe(4);
  });

  it('falls back to pickup time when a row has no start time', () => {
    const sameDay = [
      makeRow(2, '3/14/26', { pickUpTime: '4:00 PM' }),
      makeRow(3, '4/1/26'),
    ];
    expect(
      computeSheetPlacement(sameDay, new Date(2026, 2, 14), { eventTime: '10:00' })
        .insertBeforeRow
    ).toBe(2);
  });

  it('treats a blank date cell as structure, not as a bad value', () => {
    const withGaps = [
      makeRow(2, '1/15/26'),
      makeRow(3, ''),
      makeRow(4, '10/20/26'),
    ];
    const placement = computeSheetPlacement(withGaps, new Date(2026, 5, 2));
    expect(placement.insertBeforeRow).toBe(3);
    expect(placement.unreadableDates).toHaveLength(0);
  });

  it('appends only when nothing in the sheet is dated later', () => {
    const placement = computeSheetPlacement(sortedSheet, new Date(2026, 11, 31));
    expect(placement.insertBeforeRow).toBeNull();
    expect(placement.reason).toBe('append_event_is_latest');
    expect(placement.lastDatedRow).toEqual({ rowIndex: 6, date: '12/5/26' });
  });

  it('places against year-less date cells using the sheet year', () => {
    // The regression this guards: "10/20" reads as the year 2001, so nothing
    // looks later than the event and every push lands at the bottom.
    const yearless = [makeRow(2, '1/15'), makeRow(3, '10/20'), makeRow(4, '12/5')];

    expect(computeSheetPlacement(yearless, new Date(2026, 5, 2)).insertBeforeRow).toBeNull();
    expect(
      computeSheetPlacement(yearless, new Date(2026, 5, 2), { fallbackYear: 2026 })
        .insertBeforeRow
    ).toBe(3);
  });

  it('reports date cells it could not read when it gives up and appends', () => {
    const unreadable = [
      makeRow(2, 'Nov 3rd?'),
      makeRow(3, 'date TBD'),
      makeRow(4, '1/15/26'),
    ];
    const placement = computeSheetPlacement(unreadable, new Date(2026, 5, 2));

    expect(placement.insertBeforeRow).toBeNull();
    expect(placement.unreadableDates).toEqual([
      { rowIndex: 2, value: 'Nov 3rd?' },
      { rowIndex: 3, value: 'date TBD' },
    ]);
    expect(placement.note).toContain('could not be read');
  });

  it('appends on an empty sheet', () => {
    const placement = computeSheetPlacement([], new Date(2026, 5, 2));
    expect(placement.insertBeforeRow).toBeNull();
    expect(placement.reason).toBe('append_no_dated_rows');
  });
});
