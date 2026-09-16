import { desc, isNull, sql } from 'drizzle-orm';
import { createDbWithFetchOptions } from '../db';
import {
  sandwichCollections,
  sandwichDistributions,
  eventRequests,
} from '@shared/schema';
import { checkPermission } from '@shared/unified-auth-utils';
import { PERMISSIONS } from '@shared/auth-utils';
import {
  getRequestedAnalystDatasets,
  type AnalystDataset,
} from '@shared/ai-analyst-contract';
import { getReportableSandwichCount } from '@shared/sandwich-count-utils';

const MAX_SOURCE_ROWS = 1_000;
const MAX_MONTHS = 36;
const QUERY_TIMEOUT_MS = 8_000;

const DATASET_PERMISSIONS: Record<AnalystDataset, string> = {
  collections: PERMISSIONS.COLLECTIONS_VIEW,
  events: PERMISSIONS.EVENT_REQUESTS_VIEW,
  distributions: PERMISSIONS.DISTRIBUTIONS_VIEW,
};

interface AnalystUser {
  id: string;
  email?: string | null;
  role: string;
  permissions: unknown;
  isActive?: boolean | null;
}

interface DatasetSnapshot {
  dataset: AnalystDataset;
  sourceRows: number;
  truncated: boolean;
  dataQualityNotes: string[];
  metrics: Record<string, unknown>;
}

export interface AnalystSnapshot {
  requestedDatasets: AnalystDataset[];
  includedDatasets: AnalystDataset[];
  unavailableDatasets: AnalystDataset[];
  datasets: DatasetSnapshot[];
}

export class AnalystAccessError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AnalystAccessError';
  }
}

function asNonNegativeNumber(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function collectionTotal(collection: {
  individualSandwiches: number | null;
  groupCollections: unknown;
  group1Count: number | null;
  group2Count: number | null;
}): number {
  const individual = asNonNegativeNumber(collection.individualSandwiches);
  if (
    Array.isArray(collection.groupCollections) &&
    collection.groupCollections.length > 0
  ) {
    return (
      individual +
      collection.groupCollections.reduce((sum, group) => {
        if (!group || typeof group !== 'object') return sum;
        const value = group as { count?: unknown; sandwichCount?: unknown };
        return sum + asNonNegativeNumber(value.count ?? value.sandwichCount);
      }, 0)
    );
  }

  return (
    individual +
    asNonNegativeNumber(collection.group1Count) +
    asNonNegativeNumber(collection.group2Count)
  );
}

function dateMonth(value: string | Date | null): string | null {
  if (typeof value === 'string') {
    const match = value.match(/^(\d{4}-\d{2})/);
    return match?.[1] ?? null;
  }
  if (!value || Number.isNaN(value.getTime())) return null;

  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
  }).formatToParts(value);
  const year = parts.find((part) => part.type === 'year')?.value;
  const month = parts.find((part) => part.type === 'month')?.value;
  return year && month ? `${year}-${month}` : null;
}

function recentMonthlyTotals(
  values: Array<{ month: string | null; value: number }>
): Array<{ month: string; value: number }> {
  const totals = new Map<string, number>();
  for (const value of values) {
    if (!value.month) continue;
    totals.set(value.month, (totals.get(value.month) ?? 0) + value.value);
  }
  return [...totals.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .slice(-MAX_MONTHS)
    .map(([month, value]) => ({ month, value }));
}

async function withinQueryTimeout<T>(
  operation: (
    queryDb: ReturnType<typeof createDbWithFetchOptions>
  ) => Promise<T>
): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), QUERY_TIMEOUT_MS);

  try {
    return await operation(
      createDbWithFetchOptions({ signal: controller.signal })
    );
  } catch (error) {
    if (controller.signal.aborted) {
      throw new Error('The analytics query exceeded the allowed time limit.');
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

async function buildCollectionsSnapshot(): Promise<DatasetSnapshot> {
  const rows = await withinQueryTimeout((queryDb) =>
    queryDb
      .select({
        collectionDate: sandwichCollections.collectionDate,
        individualSandwiches: sandwichCollections.individualSandwiches,
        groupCollections: sandwichCollections.groupCollections,
        group1Count: sandwichCollections.group1Count,
        group2Count: sandwichCollections.group2Count,
      })
      .from(sandwichCollections)
      .where(isNull(sandwichCollections.deletedAt))
      .orderBy(desc(sandwichCollections.collectionDate))
      .limit(MAX_SOURCE_ROWS + 1)
  );
  const included = rows.slice(0, MAX_SOURCE_ROWS);
  const monthlyTotals = recentMonthlyTotals(
    included.map((row) => ({
      month: dateMonth(row.collectionDate),
      value: collectionTotal(row),
    }))
  );
  const totalSandwiches = included.reduce(
    (sum, row) => sum + collectionTotal(row),
    0
  );

  return {
    dataset: 'collections',
    sourceRows: included.length,
    truncated: rows.length > MAX_SOURCE_ROWS,
    dataQualityNotes: [
      'Collection totals are actual logged sandwiches from non-deleted collection records.',
      'Group collection JSON counts take precedence; legacy group 1 and group 2 counts are used only when no group JSON is present.',
      'Monthly series show the most recent 36 months; headline totals include all approved records selected for this snapshot.',
    ],
    metrics: {
      totalSandwiches,
      totalCollections: included.length,
      monthlySandwiches: monthlyTotals,
    },
  };
}

async function buildEventsSnapshot(): Promise<DatasetSnapshot> {
  const rows = await withinQueryTimeout((queryDb) =>
    queryDb
      .select({
        status: eventRequests.status,
        organizationCategory: eventRequests.organizationCategory,
        scheduledEventDate: eventRequests.scheduledEventDate,
        desiredEventDate: eventRequests.desiredEventDate,
        estimatedSandwichCount: eventRequests.estimatedSandwichCount,
        estimatedSandwichCountMin: eventRequests.estimatedSandwichCountMin,
        estimatedSandwichCountMax: eventRequests.estimatedSandwichCountMax,
      })
      .from(eventRequests)
      .where(isNull(eventRequests.deletedAt))
      .orderBy(
        sql`coalesce(${eventRequests.scheduledEventDate}, ${eventRequests.desiredEventDate}) desc nulls last`
      )
      .limit(MAX_SOURCE_ROWS + 1)
  );
  const included = rows.slice(0, MAX_SOURCE_ROWS);
  const statusCounts = new Map<string, number>();
  const categoryCounts = new Map<string, number>();
  let plannedSandwiches = 0;

  for (const row of included) {
    const status = row.status || 'unknown';
    statusCounts.set(status, (statusCounts.get(status) ?? 0) + 1);
    const category = row.organizationCategory || 'uncategorized';
    categoryCounts.set(category, (categoryCounts.get(category) ?? 0) + 1);
    plannedSandwiches += getReportableSandwichCount(row, {
      ignoreSuspiciousEstimatedCounts: true,
    });
  }

  return {
    dataset: 'events',
    sourceRows: included.length,
    truncated: rows.length > MAX_SOURCE_ROWS,
    dataQualityNotes: [
      'Event sandwich counts are planning estimates, not actual collection totals.',
      'Event status and category reporting excludes organization, contact, address, and notes fields.',
    ],
    metrics: {
      totalEvents: included.length,
      plannedSandwiches,
      eventsByScheduledMonth: recentMonthlyTotals(
        included.map((row) => ({
          month: dateMonth(row.scheduledEventDate ?? row.desiredEventDate),
          value: 1,
        }))
      ),
      eventsByStatus: [...statusCounts.entries()]
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([name, value]) => ({ name, value })),
      eventsByCategory: [...categoryCounts.entries()]
        .sort(([, left], [, right]) => right - left)
        .slice(0, 20)
        .map(([name, value]) => ({ name, value })),
    },
  };
}

async function buildDistributionsSnapshot(): Promise<DatasetSnapshot> {
  const rows = await withinQueryTimeout((queryDb) =>
    queryDb
      .select({
        distributionDate: sandwichDistributions.distributionDate,
        sandwichCount: sandwichDistributions.sandwichCount,
      })
      .from(sandwichDistributions)
      .orderBy(desc(sandwichDistributions.distributionDate))
      .limit(MAX_SOURCE_ROWS + 1)
  );
  const included = rows.slice(0, MAX_SOURCE_ROWS);
  const monthlyTotals = recentMonthlyTotals(
    included.map((row) => ({
      month: dateMonth(row.distributionDate),
      value: asNonNegativeNumber(row.sandwichCount),
    }))
  );
  const totalDistributedSandwiches = included.reduce(
    (sum, row) => sum + asNonNegativeNumber(row.sandwichCount),
    0
  );

  return {
    dataset: 'distributions',
    sourceRows: included.length,
    truncated: rows.length > MAX_SOURCE_ROWS,
    dataQualityNotes: [
      'Distribution totals represent logged delivery records and may not equal collections because dates, partial deliveries, and data entry timing differ.',
      'Recipient and host identities are intentionally excluded from analyst context.',
      'Monthly series show the most recent 36 months; headline totals include all approved records selected for this snapshot.',
    ],
    metrics: {
      totalDistributedSandwiches,
      totalDistributionRecords: included.length,
      monthlyDistributedSandwiches: monthlyTotals,
    },
  };
}

const SNAPSHOT_BUILDERS: Record<
  AnalystDataset,
  () => Promise<DatasetSnapshot>
> = {
  collections: buildCollectionsSnapshot,
  events: buildEventsSnapshot,
  distributions: buildDistributionsSnapshot,
};

export async function buildAnalystSnapshot(
  user: AnalystUser,
  question: string
): Promise<AnalystSnapshot> {
  const requestedDatasets = getRequestedAnalystDatasets(question);
  const includedDatasets = requestedDatasets.filter(
    (dataset) => checkPermission(user, DATASET_PERMISSIONS[dataset]).granted
  );
  const unavailableDatasets = requestedDatasets.filter(
    (dataset) => !includedDatasets.includes(dataset)
  );

  if (includedDatasets.length === 0) {
    throw new AnalystAccessError(
      'You do not have access to the analytics data requested.'
    );
  }

  const datasets = await Promise.all(
    includedDatasets.map((dataset) => SNAPSHOT_BUILDERS[dataset]())
  );

  return {
    requestedDatasets,
    includedDatasets,
    unavailableDatasets,
    datasets,
  };
}

export function getAnalystDatasetPermission(dataset: AnalystDataset): string {
  return DATASET_PERMISSIONS[dataset];
}
