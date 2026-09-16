import { sql, type SQL } from 'drizzle-orm';
import { createDbWithFetchOptions } from '../db';
import { checkPermission } from '@shared/unified-auth-utils';
import { PERMISSIONS } from '@shared/auth-utils';
import {
  ANALYST_DATASET_CATALOG,
  ANALYST_DISPLAY_LIMITS,
  getRequestedAnalystDatasets,
  type AnalystDataset,
} from '@shared/ai-analyst-contract';

const QUERY_TIMEOUT_MS = 8_000;
const LEAD_TIME_RELIABILITY_START_DATE = '2025-08-25';

const DATASET_PERMISSIONS: Record<AnalystDataset, string> = {
  collections: PERMISSIONS.COLLECTIONS_VIEW,
  events: PERMISSIONS.EVENT_REQUESTS_VIEW,
  groups: PERMISSIONS.COLLECTIONS_VIEW,
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
  population: string;
  dataQualityNotes: string[];
  metrics: Record<string, unknown>;
}

interface QueryRow {
  [key: string]: unknown;
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

function numberValue(row: QueryRow | undefined, key: string): number {
  return asNonNegativeNumber(row?.[key]);
}

function stringValue(row: QueryRow | undefined, key: string): string {
  const value = row?.[key];
  return typeof value === 'string' ? value : String(value ?? '');
}

function aggregateRows(value: unknown): QueryRow[] {
  if (Array.isArray(value)) {
    return value.filter(
      (row): row is QueryRow => typeof row === 'object' && row !== null
    );
  }
  if (
    typeof value === 'object' &&
    value !== null &&
    Array.isArray((value as { rows?: unknown }).rows)
  ) {
    return aggregateRows((value as { rows: unknown }).rows);
  }
  throw new Error('Analytics query returned an unexpected result shape.');
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

async function runAggregateQuery(query: SQL): Promise<QueryRow[]> {
  const result = await withinQueryTimeout((queryDb) => queryDb.execute(query));
  return aggregateRows(result);
}

function toNamedValues(
  rows: QueryRow[]
): Array<{ name: string; value: number }> {
  return rows
    .map((row) => ({
      name: stringValue(row, 'name'),
      value: numberValue(row, 'value'),
    }))
    .filter((row) => row.name.length > 0);
}

const collectionValues = sql`
  WITH collection_values AS (
    SELECT
      sc.collection_date,
      CASE
        WHEN jsonb_typeof(sc.group_collections) = 'array' THEN sc.group_collections
        WHEN jsonb_typeof(sc.group_collections) = 'string'
          AND TRIM(sc.group_collections #>> '{}') ~ '^\\[.*\\]$'
          THEN (sc.group_collections #>> '{}')::jsonb
        ELSE '[]'::jsonb
      END AS normalized_group_collections,
      CASE
        WHEN sc.collection_date ~ '^\\d{4}-\\d{2}-\\d{2}$'
          AND SUBSTRING(sc.collection_date, 6, 2)::integer BETWEEN 1 AND 12
          AND SUBSTRING(sc.collection_date, 9, 2)::integer BETWEEN 1 AND
            CASE
              WHEN SUBSTRING(sc.collection_date, 6, 2)::integer IN (1, 3, 5, 7, 8, 10, 12) THEN 31
              WHEN SUBSTRING(sc.collection_date, 6, 2)::integer IN (4, 6, 9, 11) THEN 30
              WHEN MOD(SUBSTRING(sc.collection_date, 1, 4)::integer, 400) = 0
                OR (
                  MOD(SUBSTRING(sc.collection_date, 1, 4)::integer, 4) = 0
                  AND MOD(SUBSTRING(sc.collection_date, 1, 4)::integer, 100) <> 0
                )
                THEN 29
              ELSE 28
            END
          THEN true
        ELSE false
      END AS has_valid_collection_date,
      GREATEST(COALESCE(sc.individual_sandwiches, 0), 0)::numeric AS individual_sandwiches,
      GREATEST(COALESCE(sc.group1_count, 0), 0)::numeric AS legacy_group1_sandwiches,
      GREATEST(COALESCE(sc.group2_count, 0), 0)::numeric AS legacy_group2_sandwiches
    FROM sandwich_collections sc
    WHERE sc.deleted_at IS NULL
  ),
  normalized_collection_values AS (
    SELECT
      *,
      CASE
        WHEN jsonb_array_length(normalized_group_collections) > 0
          THEN COALESCE((
            SELECT SUM(
              CASE
                WHEN COALESCE(group_item->>'count', group_item->>'sandwichCount', '') ~ '^-?[0-9]+(\\.[0-9]+)?$'
                  THEN GREATEST(COALESCE(group_item->>'count', group_item->>'sandwichCount')::numeric, 0)
                ELSE 0
              END
            )
            FROM jsonb_array_elements(normalized_group_collections) AS group_item
          ), 0)
        ELSE legacy_group1_sandwiches + legacy_group2_sandwiches
      END::numeric AS group_sandwiches,
      CASE
        WHEN jsonb_array_length(normalized_group_collections) > 0
          THEN jsonb_array_length(normalized_group_collections)
        ELSE
          CASE WHEN legacy_group1_sandwiches > 0 THEN 1 ELSE 0 END +
          CASE WHEN legacy_group2_sandwiches > 0 THEN 1 ELSE 0 END
      END AS group_entries
    FROM collection_values
  )
`;

async function buildCollectionsSnapshot(): Promise<DatasetSnapshot> {
  const [summaryRows, monthlyRows, weeklyRows, dailyRows] = await Promise.all([
    runAggregateQuery(sql`
      ${collectionValues}
      SELECT
        COUNT(*)::bigint AS total_collections,
        COALESCE(SUM(individual_sandwiches + group_sandwiches), 0)::bigint AS total_sandwiches,
        COALESCE(SUM(individual_sandwiches), 0)::bigint AS individual_sandwiches,
        COALESCE(SUM(group_sandwiches), 0)::bigint AS group_sandwiches,
        COUNT(*) FILTER (WHERE group_entries > 0)::bigint AS collections_with_groups
      FROM normalized_collection_values
    `),
    runAggregateQuery(sql`
      ${collectionValues}
      SELECT
        SUBSTRING(collection_date, 1, 7) AS name,
        COALESCE(SUM(individual_sandwiches + group_sandwiches), 0)::bigint AS value
      FROM normalized_collection_values
      WHERE has_valid_collection_date
      GROUP BY 1
      ORDER BY 1 DESC
      LIMIT ${ANALYST_DISPLAY_LIMITS.monthlyPeriods}
    `),
    runAggregateQuery(sql`
      ${collectionValues}
      SELECT
        TO_CHAR(
          collection_date::date -
            ((EXTRACT(DOW FROM collection_date::date)::int + 2) % 7),
          'YYYY-MM-DD'
        ) AS name,
        COALESCE(SUM(individual_sandwiches + group_sandwiches), 0)::bigint AS value
      FROM normalized_collection_values
      WHERE has_valid_collection_date
      GROUP BY 1
      ORDER BY 1 DESC
      LIMIT ${ANALYST_DISPLAY_LIMITS.weeklyPeriods}
    `),
    runAggregateQuery(sql`
      ${collectionValues}
      SELECT
        collection_date AS name,
        COALESCE(SUM(individual_sandwiches + group_sandwiches), 0)::bigint AS value
      FROM normalized_collection_values
      WHERE has_valid_collection_date
      GROUP BY 1
      ORDER BY 1 DESC
      LIMIT ${ANALYST_DISPLAY_LIMITS.dailyPeriods}
    `),
  ]);
  const summary = summaryRows[0];

  return {
    dataset: 'collections',
    population: ANALYST_DATASET_CATALOG.collections.population,
    dataQualityNotes: [
      'All non-deleted collection records contribute to headline totals; no collection-row cap is applied.',
      'Collection totals are actual logged sandwiches. Native and string-encoded JSON group arrays take precedence; legacy group 1 and group 2 counts are used only when no usable group array is present.',
      'Negative count values are treated as zero. Invalid collection calendar dates are retained in headline totals but excluded from date-based series.',
      `Monthly charts are limited to the ${ANALYST_DISPLAY_LIMITS.monthlyPeriods} most recent valid YYYY-MM months, weekly series to ${ANALYST_DISPLAY_LIMITS.weeklyPeriods} Friday–Thursday weeks, and daily series to ${ANALYST_DISPLAY_LIMITS.dailyPeriods} dates; these display limits do not limit headline totals.`,
      'Host names, creator identity, and other raw collection fields are not available to the model or browser.',
    ],
    metrics: {
      totalCollections: numberValue(summary, 'total_collections'),
      totalSandwiches: numberValue(summary, 'total_sandwiches'),
      individualSandwiches: numberValue(summary, 'individual_sandwiches'),
      groupSandwiches: numberValue(summary, 'group_sandwiches'),
      collectionsWithGroups: numberValue(summary, 'collections_with_groups'),
      monthlySandwiches: toNamedValues(monthlyRows).reverse(),
      weeklySandwichesFridayToThursday: toNamedValues(weeklyRows).reverse(),
      dailySandwiches: toNamedValues(dailyRows).reverse(),
    },
  };
}

async function buildGroupsSnapshot(): Promise<DatasetSnapshot> {
  const [summaryRows, monthlyRows] = await Promise.all([
    runAggregateQuery(sql`
      ${collectionValues}
      SELECT
        COALESCE(SUM(group_entries), 0)::bigint AS group_contribution_entries,
        COALESCE(SUM(group_sandwiches), 0)::bigint AS group_sandwiches,
        COUNT(*) FILTER (WHERE group_entries > 0)::bigint AS collections_with_groups
      FROM normalized_collection_values
    `),
    runAggregateQuery(sql`
      ${collectionValues}
      SELECT
        SUBSTRING(collection_date, 1, 7) AS name,
        COALESCE(SUM(group_sandwiches), 0)::bigint AS value
      FROM normalized_collection_values
      WHERE has_valid_collection_date
      GROUP BY 1
      ORDER BY 1 DESC
      LIMIT ${ANALYST_DISPLAY_LIMITS.monthlyPeriods}
    `),
  ]);
  const summary = summaryRows[0];

  return {
    dataset: 'groups',
    population: ANALYST_DATASET_CATALOG.groups.population,
    dataQualityNotes: [
      'Group analysis uses all non-deleted collection-log group entries, not a capped sample.',
      'A group contribution entry is a named JSON group entry or a populated legacy group 1/group 2 slot; it is not a count of unique organizations.',
      'Group, host, and organization names are intentionally excluded. The analyst can describe aggregate contribution patterns, not rank or identify groups.',
      'Negative count values are treated as zero. Invalid collection calendar dates are excluded from date-based series.',
      `Monthly charts are limited to the ${ANALYST_DISPLAY_LIMITS.monthlyPeriods} most recent valid YYYY-MM months; this display limit does not limit headline totals.`,
    ],
    metrics: {
      groupContributionEntries: numberValue(
        summary,
        'group_contribution_entries'
      ),
      groupSandwiches: numberValue(summary, 'group_sandwiches'),
      collectionsWithGroups: numberValue(summary, 'collections_with_groups'),
      monthlyGroupSandwiches: toNamedValues(monthlyRows).reverse(),
    },
  };
}

const eligibleEvents = sql`
  WITH eligible_events AS (
    SELECT
      e.status,
      e.organization_category,
      e.school_classification,
      e.desired_event_date,
      e.scheduled_event_date,
      e.status_changed_at,
      e.created_at,
      e.external_id,
      e.manual_entry_source,
      e.is_confirmed,
      e.show_on_volunteer_hub,
      e.date_flexible,
      e.estimated_sandwich_count,
      e.estimated_sandwich_count_min,
      e.estimated_sandwich_count_max,
      e.actual_sandwich_count,
      COALESCE(e.scheduled_event_date, e.desired_event_date) AS effective_event_date,
      CASE
        WHEN e.estimated_sandwich_count > 0
          THEN e.estimated_sandwich_count
        WHEN e.estimated_sandwich_count_min > 0
          AND e.estimated_sandwich_count_max > 0
          THEN ROUND((e.estimated_sandwich_count_min + e.estimated_sandwich_count_max) / 2.0)
        WHEN e.estimated_sandwich_count_min > 0 THEN e.estimated_sandwich_count_min
        WHEN e.estimated_sandwich_count_max > 0 THEN e.estimated_sandwich_count_max
        ELSE 0
      END AS planned_estimate
    FROM event_requests e
    WHERE e.deleted_at IS NULL
  ),
  completed_event_lead_time_candidates AS (
    SELECT
      effective_event_date::date AS completed_event_date,
      (created_at AT TIME ZONE 'UTC' AT TIME ZONE 'America/New_York')::date AS request_received_date,
      CASE
        WHEN external_id LIKE 'planning-sheet:%'
          OR external_id LIKE 'manual-%'
          OR manual_entry_source IS NOT NULL
          THEN 'unreliable_request_provenance'
        WHEN (created_at AT TIME ZONE 'UTC' AT TIME ZONE 'America/New_York')::date < ${LEAD_TIME_RELIABILITY_START_DATE}::date
          THEN 'before_reliable_date'
        WHEN effective_event_date IS NULL
          THEN 'missing_event_date'
        WHEN effective_event_date::date < (created_at AT TIME ZONE 'UTC' AT TIME ZONE 'America/New_York')::date
          THEN 'negative_lead_time'
        ELSE 'eligible'
      END AS lead_time_eligibility,
      (
        effective_event_date::date -
        (created_at AT TIME ZONE 'UTC' AT TIME ZONE 'America/New_York')::date
      )::int AS lead_time_days
    FROM eligible_events
    WHERE status = 'completed'
  ),
  reliable_completed_lead_times AS (
    SELECT completed_event_date, lead_time_days
    FROM completed_event_lead_time_candidates
    WHERE lead_time_eligibility = 'eligible'
  )
`;

async function buildEventsSnapshot(): Promise<DatasetSnapshot> {
  const [
    summaryRows,
    statusRows,
    categoryRows,
    monthlyRows,
    leadSummaryRows,
    leadDistributionRows,
    leadYearRows,
  ] = await Promise.all([
    runAggregateQuery(sql`
        ${eligibleEvents}
        SELECT
          COUNT(*)::bigint AS total_events,
          COUNT(*) FILTER (WHERE status = 'completed')::bigint AS completed_events,
          COUNT(*) FILTER (WHERE status IN ('scheduled', 'rescheduled'))::bigint AS scheduled_events,
          COUNT(*) FILTER (
            WHERE status IN ('scheduled', 'rescheduled')
              AND effective_event_date::date >= (CURRENT_TIMESTAMP AT TIME ZONE 'America/New_York')::date
          )::bigint AS upcoming_scheduled_events,
          COUNT(*) FILTER (WHERE effective_event_date IS NULL)::bigint AS events_without_effective_date,
          COUNT(*) FILTER (WHERE actual_sandwich_count IS NOT NULL)::bigint AS events_with_recorded_actual_count,
          COALESCE(SUM(planned_estimate) FILTER (
            WHERE estimated_sandwich_count IS NULL
              OR estimated_sandwich_count <= 0
              OR estimated_sandwich_count < 50000
          ), 0)::bigint AS planned_sandwich_estimate
        FROM eligible_events
      `),
    runAggregateQuery(sql`
        ${eligibleEvents}
        SELECT COALESCE(status, 'unknown') AS name, COUNT(*)::bigint AS value
        FROM eligible_events
        GROUP BY 1
        ORDER BY 1
      `),
    runAggregateQuery(sql`
        ${eligibleEvents}
        SELECT COALESCE(NULLIF(TRIM(organization_category), ''), 'uncategorized') AS name, COUNT(*)::bigint AS value
        FROM eligible_events
        GROUP BY 1
        ORDER BY value DESC, name
        LIMIT ${ANALYST_DISPLAY_LIMITS.categoryRows}
      `),
    runAggregateQuery(sql`
        ${eligibleEvents}
        SELECT TO_CHAR(effective_event_date, 'YYYY-MM') AS name, COUNT(*)::bigint AS value
        FROM eligible_events
        WHERE effective_event_date IS NOT NULL
        GROUP BY 1
        ORDER BY 1 DESC
        LIMIT ${ANALYST_DISPLAY_LIMITS.monthlyPeriods}
      `),
    runAggregateQuery(sql`
        ${eligibleEvents}
        SELECT
          (SELECT COUNT(*) FROM eligible_events WHERE status = 'completed')::bigint AS completed_events,
          COUNT(*)::bigint AS completed_events,
          COUNT(*) FILTER (WHERE lead_time_eligibility = 'unreliable_request_provenance')::bigint AS excluded_unreliable_request_date,
          COUNT(*) FILTER (WHERE lead_time_eligibility = 'before_reliable_date')::bigint AS excluded_before_reliable_lead_time_date,
          COUNT(*) FILTER (WHERE lead_time_eligibility = 'missing_event_date')::bigint AS excluded_missing_event_date,
          COUNT(*) FILTER (WHERE lead_time_eligibility = 'negative_lead_time')::bigint AS excluded_negative_lead_time,
          COUNT(*) FILTER (WHERE lead_time_eligibility = 'eligible')::bigint AS valid_lead_time_events,
          COALESCE(ROUND(AVG(lead_time_days) FILTER (WHERE lead_time_eligibility = 'eligible'))::bigint, 0) AS mean_lead_time_days,
          COALESCE(ROUND((PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY lead_time_days) FILTER (WHERE lead_time_eligibility = 'eligible'))::numeric)::bigint, 0) AS median_lead_time_days
        FROM completed_event_lead_time_candidates
      `),
    runAggregateQuery(sql`
        ${eligibleEvents}
        SELECT
          CASE
            WHEN lead_time_days <= 7 THEN '0-7 days'
            WHEN lead_time_days <= 30 THEN '8-30 days'
            WHEN lead_time_days <= 60 THEN '31-60 days'
            WHEN lead_time_days <= 90 THEN '61-90 days'
            ELSE '91+ days'
          END AS name,
          COUNT(*)::bigint AS value
        FROM reliable_completed_lead_times
        GROUP BY 1
        ORDER BY MIN(lead_time_days)
      `),
    runAggregateQuery(sql`
        ${eligibleEvents}
        SELECT
          EXTRACT(YEAR FROM completed_event_date)::text AS name,
          COUNT(*)::bigint AS value,
          ROUND(AVG(lead_time_days))::bigint AS mean_lead_time_days,
          ROUND((PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY lead_time_days))::numeric)::bigint AS median_lead_time_days
        FROM reliable_completed_lead_times
        GROUP BY 1
        ORDER BY name DESC
        LIMIT ${ANALYST_DISPLAY_LIMITS.leadTimeYears}
      `),
  ]);
  const summary = summaryRows[0];
  const leadSummary = leadSummaryRows[0];

  return {
    dataset: 'events',
    population: ANALYST_DATASET_CATALOG.events.population,
    dataQualityNotes: [
      'All non-deleted event requests contribute to event totals; no event-row cap is applied.',
      'Scheduled includes both scheduled and rescheduled workflow statuses. Completed means the current event status is completed.',
      'The effective event date follows the application rule: scheduled event date first, then desired event date. The schema has no separate actual-event-date field.',
      'Planned sandwich figures are estimates (including range midpoints when only a range is recorded), never actual collection totals. Event-record actual sandwich counts are reference coverage only; reporting totals come from the collection log.',
      `Lead time includes only completed web-form records with a non-negative effective event date and an Eastern-date createdAt on or after ${LEAD_TIME_RELIABILITY_START_DATE}. Planning-sheet imports and manual entries are excluded because createdAt records app-entry time, not when the group requested the event.`,
      'Organization names, contacts, addresses, free text, and event IDs are not available to the model or browser.',
      `Category breakdowns show the ${ANALYST_DISPLAY_LIMITS.categoryRows} largest categories. Monthly charts are limited to the ${ANALYST_DISPLAY_LIMITS.monthlyPeriods} most recent months and lead-time year segments to the ${ANALYST_DISPLAY_LIMITS.leadTimeYears} most recent years; headline metrics use the full eligible population.`,
    ],
    metrics: {
      totalEvents: numberValue(summary, 'total_events'),
      completedEvents: numberValue(summary, 'completed_events'),
      scheduledEvents: numberValue(summary, 'scheduled_events'),
      upcomingScheduledEvents: numberValue(
        summary,
        'upcoming_scheduled_events'
      ),
      eventsWithoutEffectiveDate: numberValue(
        summary,
        'events_without_effective_date'
      ),
      plannedSandwichEstimate: numberValue(
        summary,
        'planned_sandwich_estimate'
      ),
      eventsWithRecordedActualCount: numberValue(
        summary,
        'events_with_recorded_actual_count'
      ),
      eventsByStatus: toNamedValues(statusRows),
      eventsByCategory: toNamedValues(categoryRows),
      eventsByEffectiveMonth: toNamedValues(monthlyRows).reverse(),
      completedEventLeadTime: {
        completedEvents: numberValue(leadSummary, 'completed_events'),
        validLeadTimeEvents: numberValue(leadSummary, 'valid_lead_time_events'),
        excludedUnreliableRequestDate: numberValue(
          leadSummary,
          'excluded_unreliable_request_date'
        ),
        excludedBeforeReliableLeadTimeDate: numberValue(
          leadSummary,
          'excluded_before_reliable_lead_time_date'
        ),
        excludedMissingEventDate: numberValue(
          leadSummary,
          'excluded_missing_event_date'
        ),
        excludedNegativeLeadTime: numberValue(
          leadSummary,
          'excluded_negative_lead_time'
        ),
        meanDays: numberValue(leadSummary, 'mean_lead_time_days'),
        medianDays: numberValue(leadSummary, 'median_lead_time_days'),
        distribution: toNamedValues(leadDistributionRows),
        byCompletedEventYear: leadYearRows
          .map((row) => ({
            year: stringValue(row, 'name'),
            completedEvents: numberValue(row, 'value'),
            meanDays: numberValue(row, 'mean_lead_time_days'),
            medianDays: numberValue(row, 'median_lead_time_days'),
          }))
          .reverse(),
      },
    },
  };
}

async function buildDistributionsSnapshot(): Promise<DatasetSnapshot> {
  const [summaryRows, monthlyRows] = await Promise.all([
    runAggregateQuery(sql`
      SELECT
        COUNT(*)::bigint AS total_distribution_records,
        COALESCE(SUM(GREATEST(COALESCE(sandwich_count, 0), 0)), 0)::bigint AS total_distributed_sandwiches
      FROM sandwich_distributions
    `),
    runAggregateQuery(sql`
      SELECT
        SUBSTRING(distribution_date, 1, 7) AS name,
        COALESCE(SUM(GREATEST(COALESCE(sandwich_count, 0), 0)), 0)::bigint AS value
      FROM sandwich_distributions
      WHERE distribution_date ~ '^\\d{4}-\\d{2}-\\d{2}$'
      GROUP BY 1
      ORDER BY 1 DESC
      LIMIT ${ANALYST_DISPLAY_LIMITS.monthlyPeriods}
    `),
  ]);
  const summary = summaryRows[0];

  return {
    dataset: 'distributions',
    population: ANALYST_DATASET_CATALOG.distributions.population,
    dataQualityNotes: [
      'All distribution records contribute to headline totals; no distribution-row cap is applied.',
      'Negative distribution counts are treated as zero.',
      'Distribution totals may not equal collections because dates, partial deliveries, and data-entry timing differ.',
      'Recipient and host identities are intentionally excluded; only de-identified delivery volume is available.',
      `Monthly charts are limited to the ${ANALYST_DISPLAY_LIMITS.monthlyPeriods} most recent valid YYYY-MM months; this display limit does not limit headline totals.`,
    ],
    metrics: {
      totalDistributedSandwiches: numberValue(
        summary,
        'total_distributed_sandwiches'
      ),
      totalDistributionRecords: numberValue(
        summary,
        'total_distribution_records'
      ),
      monthlyDistributedSandwiches: toNamedValues(monthlyRows).reverse(),
    },
  };
}

const SNAPSHOT_BUILDERS: Record<
  AnalystDataset,
  () => Promise<DatasetSnapshot>
> = {
  collections: buildCollectionsSnapshot,
  events: buildEventsSnapshot,
  groups: buildGroupsSnapshot,
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
