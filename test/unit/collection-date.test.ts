import {
  aggregateCollectionsByMonth,
  getCollectionMonthKey,
  parseCollectionDate,
} from '../../client/src/lib/date-utils';

describe('parseCollectionDate', () => {
  it('parses ISO date strings without timezone drift', () => {
    const august = parseCollectionDate('2024-08-01');
    expect(august).not.toBeNull();
    expect(august?.getFullYear()).toBe(2024);
    expect(august?.getMonth()).toBe(7);
    expect(august?.getDate()).toBe(1);

    const july = parseCollectionDate('2024-07-31');
    expect(july).not.toBeNull();
    expect(july?.getFullYear()).toBe(2024);
    expect(july?.getMonth()).toBe(6);
    expect(july?.getDate()).toBe(31);
  });

  it('returns null for invalid input', () => {
    expect(parseCollectionDate('')).toBeNull();
    expect(parseCollectionDate('not-a-date')).toBeNull();
    expect(parseCollectionDate(undefined)).toBeNull();
  });

  it('accepts Date instances', () => {
    const source = new Date(2024, 7, 15);
    const parsed = parseCollectionDate(source);
    expect(parsed).not.toBe(source);
    expect(parsed?.getTime()).toBe(source.getTime());
  });
});

describe('getCollectionMonthKey', () => {
  it('creates YYYY-MM keys for boundary dates', () => {
    expect(getCollectionMonthKey('2024-08-01')).toBe('2024-08');
    expect(getCollectionMonthKey('2024-07-31')).toBe('2024-07');
  });

  it('returns null for invalid dates', () => {
    expect(getCollectionMonthKey(null)).toBeNull();
    expect(getCollectionMonthKey('invalid')).toBeNull();
  });
});

describe('aggregateCollectionsByMonth', () => {
  interface SampleCollection {
    id: number;
    collectionDate: string;
    sandwiches: number;
  }

  const sampleData: SampleCollection[] = [
    { id: 1, collectionDate: '2024-07-31', sandwiches: 10 },
    { id: 2, collectionDate: '2024-08-01', sandwiches: 20 },
    { id: 3, collectionDate: '2024-08-15', sandwiches: 5 },
    { id: 4, collectionDate: 'invalid-date', sandwiches: 100 },
  ];

  it('groups totals by month key', () => {
    const result = aggregateCollectionsByMonth(sampleData, {
      getValue: (item) => item.sandwiches,
    });

    expect(result['2024-07']).toBeDefined();
    expect(result['2024-07'].total).toBe(10);
    expect(result['2024-07'].count).toBe(1);
    expect(result['2024-07'].items.map((item) => item.id)).toEqual([1]);

    expect(result['2024-08']).toBeDefined();
    expect(result['2024-08'].total).toBe(25);
    expect(result['2024-08'].count).toBe(2);
    expect(result['2024-08'].items.map((item) => item.id).sort()).toEqual([2, 3]);

    expect(result['invalid-date']).toBeUndefined();
  });

  it('returns an empty record when no valid dates are present', () => {
    const result = aggregateCollectionsByMonth<SampleCollection>(
      [{ id: 5, collectionDate: '', sandwiches: 1 }],
      {
        getValue: (item) => item.sandwiches,
      }
    );

    expect(result).toEqual({});
  });
});
