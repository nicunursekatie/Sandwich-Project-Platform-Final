export interface SandwichCountParseResult {
  count: number | null;
  min: number | null;
  max: number | null;
  isRange: boolean;
}

export interface SandwichCountFields {
  actualSandwichCount?: number | string | null;
  estimatedSandwichCount?: number | string | null;
  estimatedSandwichCountMin?: number | string | null;
  estimatedSandwichCountMax?: number | string | null;
}

export interface ReportableSandwichCountOptions {
  ignoreSuspiciousEstimatedCounts?: boolean;
  suspiciousEstimatedThreshold?: number;
}

function toFiniteCount(value: number | string | null | undefined): number | null {
  if (value === null || value === undefined || value === '') return null;
  const numeric = typeof value === 'number' ? value : Number(String(value).replace(/,/g, '').trim());
  return Number.isFinite(numeric) && numeric > 0 ? Math.round(numeric) : null;
}

export function parseSandwichCountInput(value: number | string | null | undefined): SandwichCountParseResult {
  if (typeof value === 'number') {
    return { count: toFiniteCount(value), min: null, max: null, isRange: false };
  }

  if (!value) {
    return { count: null, min: null, max: null, isRange: false };
  }

  const text = String(value).trim();
  const numberPattern = String.raw`\d{1,3}(?:,\d{3})+|\d+`;
  const rangePattern = new RegExp(`(${numberPattern})\\s*(?:-|–|—|to|through|thru)\\s*(${numberPattern})`, 'i');
  const rangeMatch = text.match(rangePattern);

  if (rangeMatch) {
    const first = toFiniteCount(rangeMatch[1]);
    const second = toFiniteCount(rangeMatch[2]);

    if (first !== null && second !== null) {
      const min = Math.min(first, second);
      const max = Math.max(first, second);
      return {
        count: Math.round((min + max) / 2),
        min,
        max,
        isRange: true,
      };
    }
  }

  const singleMatch = text.match(new RegExp(numberPattern));
  const count = singleMatch ? toFiniteCount(singleMatch[0]) : null;
  return { count, min: null, max: null, isRange: false };
}

export function getRangeMidpoint(minValue: number | string | null | undefined, maxValue: number | string | null | undefined): number | null {
  const min = toFiniteCount(minValue);
  const max = toFiniteCount(maxValue);

  if (min !== null && max !== null) {
    return Math.round((Math.min(min, max) + Math.max(min, max)) / 2);
  }

  return min ?? max;
}

export function getReportableSandwichCount(
  event: SandwichCountFields,
  options: ReportableSandwichCountOptions = {},
): number {
  const actualCount = toFiniteCount(event.actualSandwichCount);
  if (actualCount !== null) return actualCount;

  const rangeMidpoint = getRangeMidpoint(event.estimatedSandwichCountMin, event.estimatedSandwichCountMax);
  if (rangeMidpoint !== null) return rangeMidpoint;

  const estimatedCount = toFiniteCount(event.estimatedSandwichCount);
  if (estimatedCount === null) return 0;

  if (
    options.ignoreSuspiciousEstimatedCounts &&
    estimatedCount >= (options.suspiciousEstimatedThreshold ?? 50000)
  ) {
    return 0;
  }

  return estimatedCount;
}
