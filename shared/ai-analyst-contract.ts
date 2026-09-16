import { z } from 'zod';

export const ANALYST_DATASETS = [
  'collections',
  'events',
  'groups',
  'distributions',
] as const;
export type AnalystDataset = (typeof ANALYST_DATASETS)[number];

export const MAX_ANALYST_MESSAGE_LENGTH = 2_000;
export const MAX_ANALYST_ASSISTANT_HISTORY_LENGTH = 6_000;
export const MAX_ANALYST_HISTORY_MESSAGES = 12;
export const ANALYST_DISPLAY_LIMITS = {
  monthlyPeriods: 36,
  weeklyPeriods: 104,
  dailyPeriods: 400,
  categoryRows: 20,
  leadTimeYears: 12,
} as const;

/**
 * This is the entire data contract available to AI Analyst operations.
 * Fields not listed here, especially names, contact details, addresses, and
 * free text, are default-denied even when a user can view them elsewhere.
 */
export const ANALYST_DATASET_CATALOG = {
  collections: {
    label: 'Sandwich collections',
    requiredPermission: 'COLLECTIONS_VIEW',
    population: 'All non-deleted collection-log records',
    fields: [
      'collectionDate',
      'Friday–Thursday collection week (derived server-side)',
      'individualSandwiches',
      'individualDeli',
      'individualTurkey',
      'individualHam',
      'individualPbj',
      'individualGeneric',
      'groupCollections.count',
      'groupCollections.sandwichCount',
      'groupCollections sandwich-type counts',
      'group1Count',
      'group2Count',
      'eventRequestId',
    ],
  },
  events: {
    label: 'Event requests and events',
    requiredPermission: 'EVENT_REQUESTS_VIEW',
    population: 'All non-deleted event requests',
    fields: [
      'id (server-side correlation only)',
      'status',
      'statusChangedAt',
      'createdAt (web-form lead-time analysis only)',
      'desiredEventDate',
      'scheduledEventDate',
      'organizationCategory',
      'schoolClassification',
      'dateFlexible',
      'isConfirmed',
      'showOnVolunteerHub',
      'estimatedSandwichCount',
      'estimatedSandwichCountMin',
      'estimatedSandwichCountMax',
      'actualSandwichCount (reference coverage only)',
      'actualAttendance',
      'estimatedAttendance',
    ],
  },
  groups: {
    label: 'Group collection contributions',
    requiredPermission: 'COLLECTIONS_VIEW',
    population: 'All non-deleted collection-log group entries',
    fields: [
      'collectionDate',
      'groupCollections.count',
      'groupCollections.sandwichCount',
      'groupCollections sandwich-type counts',
      'group1Count',
      'group2Count',
      'eventRequestId (server-side correlation only)',
    ],
  },
  distributions: {
    label: 'Sandwich distributions',
    requiredPermission: 'DISTRIBUTIONS_VIEW',
    population: 'All distribution records',
    fields: ['distributionDate', 'sandwichCount', 'hostId', 'recipientId'],
  },
} as const satisfies Record<
  AnalystDataset,
  {
    label: string;
    requiredPermission: string;
    population: string;
    fields: readonly string[];
  }
>;

export const aiAnalystRequestSchema = z.object({
  message: z.string().trim().min(1).max(MAX_ANALYST_MESSAGE_LENGTH),
  conversationHistory: z
    .array(
      z.discriminatedUnion('role', [
        z.object({
          role: z.literal('user'),
          content: z.string().trim().min(1).max(MAX_ANALYST_MESSAGE_LENGTH),
        }),
        z.object({
          role: z.literal('assistant'),
          content: z
            .string()
            .trim()
            .min(1)
            .max(MAX_ANALYST_ASSISTANT_HISTORY_LENGTH),
        }),
      ])
    )
    .max(MAX_ANALYST_HISTORY_MESSAGES)
    .default([]),
});

export const aiAnalystChartSchema = z.object({
  type: z.enum(['bar', 'line', 'pie']),
  title: z.string().trim().min(1).max(120),
  data: z
    .array(
      z.object({
        name: z.string().trim().min(1).max(80),
        value: z.number().finite().min(0),
      })
    )
    .min(1)
    .max(60),
  description: z.string().trim().max(400).optional(),
});

export const aiAnalystTableSchema = z
  .object({
    title: z.string().trim().min(1).max(120),
    columns: z.array(z.string().trim().min(1).max(80)).min(1).max(8),
    rows: z
      .array(
        z
          .array(z.union([z.string().max(160), z.number().finite()]))
          .min(1)
          .max(8)
      )
      .min(1)
      .max(50),
  })
  .superRefine((table, context) => {
    table.rows.forEach((row, index) => {
      if (row.length !== table.columns.length) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['rows', index],
          message: 'Each table row must match the number of columns',
        });
      }
    });
  });

export const aiAnalystResponseSchema = z.object({
  analysis: z.string().trim().min(1).max(6_000),
  table: aiAnalystTableSchema.optional(),
  chart: aiAnalystChartSchema.optional(),
});

export type AiAnalystChart = z.infer<typeof aiAnalystChartSchema>;
export type AiAnalystTable = z.infer<typeof aiAnalystTableSchema>;
export type AiAnalystResponse = z.infer<typeof aiAnalystResponseSchema>;

/**
 * Selects only approved aggregate datasets. It never maps a question to a
 * database table name, column, filter, or executable query.
 */
export function getRequestedAnalystDatasets(message: string): AnalystDataset[] {
  const normalized = message.toLowerCase();
  const requested = new Set<AnalystDataset>();

  if (
    /\b(distribution|distributed|recipient|delivery|deliveries)\b/.test(
      normalized
    )
  ) {
    requested.add('distributions');
  }

  if (
    /\b(group|groups|group collection|group collections)\b/.test(normalized)
  ) {
    requested.add('groups');
  }

  if (
    /\b(event|events|scheduled|schedule|completed|completion|organization|organizations|request|requests|lead time|lead-time|ahead)\b/.test(
      normalized
    )
  ) {
    requested.add('events');
  }

  if (
    /\b(sandwich|sandwiches|collection|collections|impact|trend|trends|volume|total|totals)\b/.test(
      normalized
    )
  ) {
    requested.add('collections');
  }

  // General questions receive only high-level aggregates from every dataset
  // the caller is independently authorized to use.
  return requested.size > 0 ? [...requested] : [...ANALYST_DATASETS];
}
