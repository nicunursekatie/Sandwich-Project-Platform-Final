/**
 * Volunteer engagement methodology — the single source of truth for every
 * sandwich-derived volunteer figure TSP reports (grant metrics, exports,
 * narrative copy).
 *
 * WHY "ENGAGEMENTS" AND NOT "VOLUNTEERS":
 * TSP's collection log records sandwich production, not person-level records.
 * One physical person who makes sandwiches twelve times in a year produces
 * twelve engagements. Until donor/drop-off-level data exists we cannot
 * deduplicate people, so nothing here may be labeled "unique volunteers",
 * "total volunteers", or "individual volunteers".
 */

/**
 * Sandwiches per adult participant at a group/deli event.
 *
 * TSP's historical group-event data supports roughly 20-25 sandwiches per
 * adult participant per event, with known adult/deli groups centering around
 * 20-22. The central figure is deliberately near the middle of that band;
 * the bounds define the published uncertainty range (fewer sandwiches per
 * person means more people, so the LOW engagement bound uses the HIGH
 * divisor).
 */
export const GROUP_SANDWICHES_PER_ENGAGEMENT_CENTRAL = 22;
export const GROUP_SANDWICHES_PER_ENGAGEMENT_LOW_BOUND = 25;
export const GROUP_SANDWICHES_PER_ENGAGEMENT_HIGH_BOUND = 20;

/**
 * Sandwiches per individual/household participant.
 *
 * Historical collection records store an area or host's aggregate individual
 * total rather than each household's drop-off, so the household buckets in
 * `estimateHouseholdEngagements` cannot be applied to them. Until
 * drop-off-level data exists, ~20 sandwiches per engagement is the planning
 * assumption. There is deliberately NO household-size multiplier — the old
 * "every 20 sandwiches is a family of 2.5" assumption was not supported by
 * TSP's data and materially inflated this figure.
 */
export const INDIVIDUAL_SANDWICHES_PER_ENGAGEMENT_CENTRAL = 20;
export const INDIVIDUAL_SANDWICHES_PER_ENGAGEMENT_LOW_BOUND = 25;
export const INDIVIDUAL_SANDWICHES_PER_ENGAGEMENT_HIGH_BOUND = 20;

/**
 * Conservative production rate for an actively working adult volunteer.
 * Volunteer hours are derived from sandwich output at this rate — never by
 * assuming each engagement is worth some fixed number of hours.
 */
export const SANDWICHES_PER_ACTIVE_VOLUNTEER_HOUR = 25;

export interface SandwichSplit {
  /** Sandwiches attributable to organized group collections/events. */
  groupSandwiches: number;
  /** Sandwiches attributable to individual/household drop-offs. */
  individualSandwiches: number;
}

export interface VolunteerEngagementEstimate {
  groupSandwiches: number;
  individualSandwiches: number;
  totalSandwiches: number;
  /** Unrounded so callers can combine before rounding. */
  groupEngagements: number;
  individualEngagements: number;
  /** groupSandwiches / 22 + individualSandwiches / 20 */
  centralEngagements: number;
  /** Both streams at 25 sandwiches per engagement. */
  lowEngagements: number;
  /** Both streams at 20 sandwiches per engagement. */
  highEngagements: number;
  /** totalSandwiches / 25 — active sandwich-making time only. */
  activeVolunteerHours: number;
}

/**
 * Estimate volunteer engagements and active volunteer hours from a period's
 * sandwich totals. Every value is returned unrounded — round only at display
 * time so combined figures don't accumulate rounding error.
 */
export function estimateVolunteerEngagement({
  groupSandwiches,
  individualSandwiches,
}: SandwichSplit): VolunteerEngagementEstimate {
  const group = Math.max(0, groupSandwiches || 0);
  const individual = Math.max(0, individualSandwiches || 0);
  const totalSandwiches = group + individual;

  const groupEngagements = group / GROUP_SANDWICHES_PER_ENGAGEMENT_CENTRAL;
  const individualEngagements =
    individual / INDIVIDUAL_SANDWICHES_PER_ENGAGEMENT_CENTRAL;

  return {
    groupSandwiches: group,
    individualSandwiches: individual,
    totalSandwiches,
    groupEngagements,
    individualEngagements,
    centralEngagements: groupEngagements + individualEngagements,
    lowEngagements:
      group / GROUP_SANDWICHES_PER_ENGAGEMENT_LOW_BOUND +
      individual / INDIVIDUAL_SANDWICHES_PER_ENGAGEMENT_LOW_BOUND,
    highEngagements:
      group / GROUP_SANDWICHES_PER_ENGAGEMENT_HIGH_BOUND +
      individual / INDIVIDUAL_SANDWICHES_PER_ENGAGEMENT_HIGH_BOUND,
    activeVolunteerHours: totalSandwiches / SANDWICHES_PER_ACTIVE_VOLUNTEER_HOUR,
  };
}

/**
 * Dollar value of volunteer time. Driven by hours, never by the engagement
 * count — engagements have no fixed hour value attached to them.
 */
export function calculateVolunteerEconomicValueUsd(
  activeVolunteerHours: number,
  usdPerVolunteerHour: number
): number {
  return Math.round(activeVolunteerHours * usdPerVolunteerHour);
}

/**
 * TSP's operational assumption for how many people make sandwiches together
 * when a single household drops off a given quantity.
 *
 * NOT applied to historical collection records: those store an area or host's
 * aggregate individual total, not per-household drop-offs. Reserved for
 * drop-off-level data.
 */
export function estimateHouseholdEngagements(householdSandwiches: number): number {
  if (householdSandwiches <= 0) return 0;
  if (householdSandwiches <= 20) return 1;
  if (householdSandwiches <= 49) return 2;
  if (householdSandwiches <= 79) return 3;
  return 5;
}

/**
 * Human-friendly rounding for headline figures — 26,304 reads as 26,300,
 * which is honest about the precision an estimate actually carries.
 */
export function roundEngagementsForDisplay(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 0;
  if (value >= 10_000) return Math.round(value / 100) * 100;
  if (value >= 1_000) return Math.round(value / 10) * 10;
  return Math.round(value);
}

export const VOLUNTEER_ENGAGEMENT_METHODOLOGY_NOTE =
  'Estimated volunteer engagements are derived from sandwich production rather than unique-person records. ' +
  `TSP historical group-event data supports approximately ${GROUP_SANDWICHES_PER_ENGAGEMENT_HIGH_BOUND}-${GROUP_SANDWICHES_PER_ENGAGEMENT_LOW_BOUND} sandwiches per participant, ` +
  `with adult events generally centering around 20-${GROUP_SANDWICHES_PER_ENGAGEMENT_CENTRAL} sandwiches per participant. ` +
  `Individual/household engagement estimates currently use approximately ${INDIVIDUAL_SANDWICHES_PER_ENGAGEMENT_CENTRAL} sandwiches per participant because historical collection records do not consistently capture household-level participant counts. ` +
  'Repeat volunteers may be represented more than once. Drivers, host homes, sorting, distribution, and other support roles are not added here because person-level records are incomplete and adding them could double-count sandwich makers.';

export const VOLUNTEER_HOURS_METHODOLOGY_NOTE =
  `Estimated active volunteer hours are calculated using approximately ${SANDWICHES_PER_ACTIVE_VOLUNTEER_HOUR} sandwiches produced per active sandwich-making hour. ` +
  'This estimate excludes additional volunteer time for setup, cleanup, transportation, hosting, collection, distribution, and other support activities, so it is intentionally conservative.';
