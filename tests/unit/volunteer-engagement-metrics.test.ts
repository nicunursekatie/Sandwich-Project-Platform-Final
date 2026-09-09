import {
  GROUP_SANDWICHES_PER_ENGAGEMENT_CENTRAL,
  INDIVIDUAL_SANDWICHES_PER_ENGAGEMENT_CENTRAL,
  SANDWICHES_PER_ACTIVE_VOLUNTEER_HOUR,
  calculateVolunteerEconomicValueUsd,
  estimateHouseholdEngagements,
  estimateVolunteerEngagement,
  roundEngagementsForDisplay,
} from '../../shared/volunteer-engagement-metrics';

describe('methodology constants', () => {
  it('uses 22 sandwiches per group engagement and 20 per household engagement', () => {
    expect(GROUP_SANDWICHES_PER_ENGAGEMENT_CENTRAL).toBe(22);
    expect(INDIVIDUAL_SANDWICHES_PER_ENGAGEMENT_CENTRAL).toBe(20);
    expect(SANDWICHES_PER_ACTIVE_VOLUNTEER_HOUR).toBe(25);
  });
});

describe('estimateVolunteerEngagement', () => {
  it('splits group and individual streams at their own central rates', () => {
    const estimate = estimateVolunteerEngagement({
      groupSandwiches: 2200,
      individualSandwiches: 2000,
    });

    expect(estimate.groupEngagements).toBe(100);
    expect(estimate.individualEngagements).toBe(100);
    expect(estimate.centralEngagements).toBe(200);
    expect(estimate.totalSandwiches).toBe(4200);
  });

  it('applies no household-size multiplier to individual sandwiches', () => {
    const estimate = estimateVolunteerEngagement({
      groupSandwiches: 0,
      individualSandwiches: 2000,
    });

    // The retired methodology produced (2000 / 20) * 2.5 = 250 here.
    expect(estimate.centralEngagements).toBe(100);
  });

  it('builds the range from 25 (low) and 20 (high) sandwiches per engagement', () => {
    const estimate = estimateVolunteerEngagement({
      groupSandwiches: 1000,
      individualSandwiches: 1000,
    });

    expect(estimate.lowEngagements).toBe(80);
    expect(estimate.highEngagements).toBe(100);
    expect(estimate.centralEngagements).toBeGreaterThan(estimate.lowEngagements);
    expect(estimate.centralEngagements).toBeLessThan(estimate.highEngagements);
  });

  it('derives active volunteer hours from total production, not engagements', () => {
    const estimate = estimateVolunteerEngagement({
      groupSandwiches: 1500,
      individualSandwiches: 1000,
    });

    expect(estimate.activeVolunteerHours).toBe(100);
  });

  it('treats missing and negative inputs as zero', () => {
    const estimate = estimateVolunteerEngagement({
      groupSandwiches: -500,
      individualSandwiches: 0,
    });

    expect(estimate.centralEngagements).toBe(0);
    expect(estimate.activeVolunteerHours).toBe(0);
  });
});

describe('calculateVolunteerEconomicValueUsd', () => {
  it('multiplies hours by the published hourly rate', () => {
    expect(calculateVolunteerEconomicValueUsd(1000, 36.14)).toBe(36140);
  });
});

describe('roundEngagementsForDisplay', () => {
  it('rounds five-figure headlines to the nearest hundred', () => {
    expect(roundEngagementsForDisplay(26304)).toBe(26300);
    expect(roundEngagementsForDisplay(21043)).toBe(21000);
  });

  it('rounds four-figure headlines to the nearest ten', () => {
    expect(roundEngagementsForDisplay(1234)).toBe(1230);
  });

  it('rounds small figures to whole engagements', () => {
    expect(roundEngagementsForDisplay(12.4)).toBe(12);
    expect(roundEngagementsForDisplay(0)).toBe(0);
  });
});

describe('estimateHouseholdEngagements', () => {
  it('follows TSP household buckets', () => {
    expect(estimateHouseholdEngagements(0)).toBe(0);
    expect(estimateHouseholdEngagements(20)).toBe(1);
    expect(estimateHouseholdEngagements(21)).toBe(2);
    expect(estimateHouseholdEngagements(49)).toBe(2);
    expect(estimateHouseholdEngagements(50)).toBe(3);
    expect(estimateHouseholdEngagements(79)).toBe(3);
    expect(estimateHouseholdEngagements(80)).toBe(5);
  });

  it('maps non-finite and negative inputs to zero rather than the 80+ bucket', () => {
    expect(estimateHouseholdEngagements(NaN)).toBe(0);
    expect(estimateHouseholdEngagements(Infinity)).toBe(0);
    expect(estimateHouseholdEngagements(-5)).toBe(0);
  });
});

describe('per-year engagement estimates', () => {
  it('estimates each year independently from its own group/individual split', () => {
    const years = [
      { year: 2025, groupSandwiches: 227245, individualSandwiches: 298838 },
      { year: 2024, groupSandwiches: 110000, individualSandwiches: 200000 },
    ];

    const estimates = years.map((y) => ({
      year: y.year,
      engagements: roundEngagementsForDisplay(
        estimateVolunteerEngagement(y).centralEngagements
      ),
    }));

    expect(estimates).toEqual([
      { year: 2025, engagements: 25300 },
      { year: 2024, engagements: 15000 },
    ]);
  });
});

describe('2025 validation case', () => {
  const INDIVIDUAL_SANDWICHES_2025 = 298838;
  const GROUP_SANDWICHES_2025 = 227245;

  const estimate = estimateVolunteerEngagement({
    groupSandwiches: GROUP_SANDWICHES_2025,
    individualSandwiches: INDIVIDUAL_SANDWICHES_2025,
  });

  it('totals 526,083 sandwiches', () => {
    expect(estimate.totalSandwiches).toBe(526083);
  });

  it('estimates about 10,329 group and 14,942 individual engagements', () => {
    expect(Math.round(estimate.groupEngagements)).toBe(10329);
    expect(Math.round(estimate.individualEngagements)).toBe(14942);
  });

  it('estimates about 25,300 volunteer engagements', () => {
    expect(Math.round(estimate.centralEngagements)).toBe(25271);
    expect(roundEngagementsForDisplay(estimate.centralEngagements)).toBe(25300);
  });

  it('publishes a range of about 21,000 to 26,300', () => {
    expect(roundEngagementsForDisplay(estimate.lowEngagements)).toBe(21000);
    expect(roundEngagementsForDisplay(estimate.highEngagements)).toBe(26300);
  });

  it('estimates about 21,000 active volunteer hours', () => {
    expect(Math.round(estimate.activeVolunteerHours)).toBe(21043);
    expect(roundEngagementsForDisplay(estimate.activeVolunteerHours)).toBe(21000);
  });

  it('values those hours at the 2025 Independent Sector rate', () => {
    expect(calculateVolunteerEconomicValueUsd(estimate.activeVolunteerHours, 36.14)).toBe(
      760506
    );
  });
});
