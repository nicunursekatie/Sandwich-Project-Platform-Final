/**
 * Normalizes and groups recipient focus areas for consistent display in grant metrics,
 * recipients management, and other reporting. Maps fragmented/custom DB values to
 * canonical grouped labels.
 *
 * Same concept may be stored in many ways: "Youth" vs "youth", "Homeless" vs "Unhoused",
 * "Working Poor" vs "Working poor", etc. This maps them to one display label per concept.
 */

/** Maps raw focus area strings (case-insensitive) to canonical display labels */
const RAW_TO_CANONICAL: Record<string, string> = {
  // Unhoused / Homeless
  unhoused: 'Unhoused',
  homeless: 'Unhoused',
  homelessness: 'Unhoused',
  'homeless men and women and children': 'Unhoused',
  'emergency shelter': 'Unhoused',

  // Youth
  youth: 'Youth',
  'youth and seniors': 'Youth & Seniors',

  // Seniors
  seniors: 'Seniors',
  elderly: 'Seniors',

  // Women
  women: 'Women',

  // Veterans
  veterans: 'Veterans',

  // Families
  families: 'Families',
  'single-parent families': 'Families',
  'families, hispanic and others': 'Families',

  // LGBTQ+ & Health
  'lgbtq+': 'LGBTQ+ & Health',
  lgbtq: 'LGBTQ+ & Health',
  'lgbtq+, hiv, substance-abuse': 'LGBTQ+ & Health',
  'lgbtq+, hiv, substance abuse': 'LGBTQ+ & Health',
  hiv: 'LGBTQ+ & Health',
  'substance-abuse': 'LGBTQ+ & Health',
  'substance abuse': 'LGBTQ+ & Health',

  // International / Immigrants
  'international communities': 'International Communities',
  refugees: 'International Communities',
  immigrants: 'International Communities',

  // Economic
  'working poor': 'Working Poor',

  // Justice-involved
  'incarcerated women and men': 'Justice-Involved',
  'incarcerated': 'Justice-Involved',
  'reentry': 'Justice-Involved',

  // Other specific populations
  'victims of trafficking': 'Trafficking Survivors',
  'trafficking': 'Trafficking Survivors',
  recovery: 'Recovery',
  'underrepresented populations': 'Underrepresented Populations',
  disabilities: 'Disabilities',
  other: 'Other',
};

/** Canonical display order (by priority) when sorting */
const CANONICAL_ORDER = [
  'Unhoused',
  'Youth',
  'Youth & Seniors',
  'Seniors',
  'Families',
  'Women',
  'Veterans',
  'LGBTQ+ & Health',
  'International Communities',
  'Working Poor',
  'Justice-Involved',
  'Trafficking Survivors',
  'Recovery',
  'Underrepresented Populations',
  'Disabilities',
  'Other',
];

/**
 * Normalize a raw focus area string to its canonical grouped label.
 * Handles case insensitivity and strips surrounding whitespace.
 */
export function normalizeFocusArea(raw: string): string {
  const key = raw.trim().toLowerCase();
  if (!key) return '';
  return RAW_TO_CANONICAL[key] ?? toTitleCase(raw.trim());
}

/**
 * Fallback: convert unknown values to title case for cleaner display
 */
function toTitleCase(s: string): string {
  return s.replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Aggregate raw focus area counts into canonical groups.
 * Use for grant metrics and any display that should show grouped counts.
 */
export function aggregateFocusAreas(
  rawCounts: Record<string, number>
): Record<string, number> {
  const grouped: Record<string, number> = {};
  for (const [raw, count] of Object.entries(rawCounts)) {
    const canonical = normalizeFocusArea(raw);
    if (canonical) {
      grouped[canonical] = (grouped[canonical] ?? 0) + count;
    }
  }
  return grouped;
}

/**
 * Sort canonical focus area entries for display (by count desc, then by defined order).
 */
export function sortFocusAreaEntries(
  entries: [string, number][]
): [string, number][] {
  const orderIndex = (name: string) => {
    const i = CANONICAL_ORDER.indexOf(name);
    return i >= 0 ? i : CANONICAL_ORDER.length;
  };
  return [...entries].sort((a, b) => {
    const countDiff = (b[1] as number) - (a[1] as number);
    if (countDiff !== 0) return countDiff;
    return orderIndex(a[0]) - orderIndex(b[0]);
  });
}
