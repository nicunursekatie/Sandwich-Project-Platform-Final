import { randomUUID } from 'crypto';
import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import OpenAI from 'openai';
import { z } from 'zod';
import type {
  ChatCompletionMessageParam,
  ChatCompletionTool,
} from 'openai/resources/chat/completions/completions';
import { PERMISSIONS } from '@shared/auth-utils';
import {
  aiAnalystRequestSchema,
  aiAnalystResponseSchema,
  type AnalystDataset,
} from '@shared/ai-analyst-contract';
import { checkPermission } from '@shared/unified-auth-utils';
import { AuditLogger } from '../audit-logger';
import {
  formatAnalystRowsForModel,
  runAnalystQuery,
} from '../services/ai-analyst-query-runner';
import type { AnalystRelation } from '../services/ai-analyst-sql-guard';
import { logger } from '../utils/production-safe-logger';
import type { AuthenticatedRequest } from '../types/express';

const MAX_ANALYST_QUERY_ITERATIONS = 12;
const MAX_ANALYST_MODEL_TURNS = MAX_ANALYST_QUERY_ITERATIONS;

const queryToolInputSchema = z.object({
  sql: z.string().trim().min(1).max(12_000),
  purpose: z.string().trim().min(1).max(500),
});

const ANALYST_TOOLS: ChatCompletionTool[] = [
  {
    type: 'function',
    function: {
      name: 'run_analysis_query',
      description:
        'Run one read-only SQL query against the complete permitted event and collection records. ' +
        'Use this to inspect records, group data, compare periods, or test data quality. ' +
        'Only analyst_events and analyst_collections are available; query results are capped.',
      parameters: {
        type: 'object',
        additionalProperties: false,
        properties: {
          sql: {
            type: 'string',
            description:
              'One SELECT or WITH ... SELECT query using analyst_events and/or analyst_collections.',
          },
          purpose: {
            type: 'string',
            description: 'Brief statement of what the query investigates.',
          },
        },
        required: ['sql', 'purpose'],
      },
    },
  },
];

const aiAnalystRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1_000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => `ai-analyst:${req.user?.id ?? 'unauthenticated'}`,
  handler: (req, res) => {
    logger.warn('AI analyst rate limit exceeded', { userId: req.user?.id });
    res.status(429).json({
      error:
        'Too many AI Analyst requests. Please wait a few minutes and try again.',
      code: 'RATE_LIMITED',
    });
  },
});

function getOpenAIClient(): OpenAI {
  const apiKey = process.env.AI_INTEGRATIONS_OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('AI integrations are not configured.');
  }
  return new OpenAI({
    apiKey,
    baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
    timeout: 45_000,
    maxRetries: 0,
  });
}

function canUseAiAnalyst(user: AuthenticatedRequest['user']): boolean {
  return Boolean(
    user &&
    checkPermission(user, PERMISSIONS.AI_ANALYST_VIEW).granted &&
    checkPermission(user, PERMISSIONS.ANALYTICS_VIEW).granted
  );
}

function getAllowedRelations(
  user: NonNullable<AuthenticatedRequest['user']>
): ReadonlySet<AnalystRelation> {
  const allowed = new Set<AnalystRelation>();
  if (checkPermission(user, PERMISSIONS.EVENT_REQUESTS_VIEW).granted) {
    allowed.add('analyst_events');
  }
  if (checkPermission(user, PERMISSIONS.COLLECTIONS_VIEW).granted) {
    allowed.add('analyst_collections');
  }
  return allowed;
}

function getSystemPrompt(
  allowedRelations: ReadonlySet<AnalystRelation>
): string {
  const sources = [...allowedRelations];
  return `You are the Sandwich Project AI Analyst. Answer questions by investigating the complete authorized event and collection history using the run_analysis_query tool.

You may query only these approved read-only relations: ${sources.join(', ') || '(none)'}.

analyst_events contains all non-deleted event requests. Useful fields:
id, organization_name, department, organization_category, school_classification, status, created_at, status_changed_at, desired_event_date, scheduled_event_date, effective_event_date, date_flexible, is_confirmed, show_on_volunteer_hub, estimated_sandwich_count, estimated_sandwich_count_min, estimated_sandwich_count_max, planned_sandwich_estimate, actual_sandwich_count, actual_attendance, estimated_attendance, drivers_needed, volunteers_needed, has_refrigeration, self_transport, previously_hosted, manual_entry_source, external_id.

analyst_collections contains all non-deleted collection log entries. Useful fields:
id, collection_date, host_name, individual_sandwiches, individual_deli, individual_turkey, individual_ham, individual_pbj, individual_generic, group1_name, group1_count, group2_name, group2_count, group_collections, event_request_id, submission_method, submitted_at.

Query rules:
- Use standard PostgreSQL SELECT or WITH queries. You can aggregate across the full relation history, use joins, date filtering, grouping, window functions, and follow-up queries.
- The server permits at most ${MAX_ANALYST_QUERY_ITERATIONS} query calls per answer and caps returned rows. Aggregate in SQL when possible; use LIMIT/OFFSET for record listings.
- Never put a database command, credentials, or SQL text in the final answer. Query execution is server-mediated and read-only.
- Every number or factual claim in the answer must be based on a query result from this conversation. State when there are no matching records or insufficient data.

Data semantics:
- Sandwich collection totals are actuals. Calculate a row total as individual_sandwiches + group contribution total. Prefer a non-empty group_collections JSON array (accept count or sandwichCount per group); otherwise use group1_count + group2_count. Do not use actual_sandwich_count on an event as a reporting sandwich total.
- Event estimated_sandwich_count values and range bounds are plans, not actual collection results. Use planned_sandwich_estimate when totaling plans: it uses a positive exact estimate, otherwise the midpoint of two positive range bounds, otherwise the one positive bound. Label it as an estimate.
- The effective event date is scheduled_event_date when present, otherwise desired_event_date. The platform uses America/New_York for date-only comparisons.
- Exclude soft-deleted records automatically; both relations already do this.
- For request lead time, only treat created_at as reliable for web-form records created on or after 2025-08-25 Eastern time. Exclude external_id beginning planning-sheet: or manual-, and non-null manual_entry_source. The schema has no separate actual-event-date field, so completed-event analysis uses effective_event_date.

Use the available records and fields as needed. For any table or chart, return valid JSON only at the end with:
{
  "analysis": "concise written answer",
  "table": { "title": "optional", "columns": ["..."], "rows": [["...", 123]] },
  "chart": { "type": "bar|line|pie", "title": "optional", "data": [{"name": "label", "value": 123}], "description": "optional" }
}
Omit table/chart when unnecessary. Never include raw SQL in the JSON.`;
}

function parseFinalResponse(content: string | null) {
  if (!content) return { success: false as const };
  try {
    return aiAnalystResponseSchema.safeParse(JSON.parse(content));
  } catch {
    return { success: false as const };
  }
}

function auditQueryMetadata(
  queryLog: Array<{
    purpose: string;
    relations: AnalystRelation[];
    rowCount: number;
    durationMs: number;
    ok: boolean;
  }>
) {
  return {
    queryCount: queryLog.length,
    relations: [...new Set(queryLog.flatMap((query) => query.relations))],
    queries: queryLog,
  };
}

export const aiAnalystRouter = Router();

aiAnalystRouter.post(
  '/',
  aiAnalystRateLimiter,
  async (req: AuthenticatedRequest, res) => {
    if (!req.user?.id) {
      return res
        .status(401)
        .json({ error: 'Authentication required', code: 'AUTH_REQUIRED' });
    }
    if (!canUseAiAnalyst(req.user)) {
      return res.status(403).json({
        error:
          'AI Analyst access requires the AI Analyst and Analytics View permissions.',
        code: 'PERMISSION_DENIED',
        required: [PERMISSIONS.AI_ANALYST_VIEW, PERMISSIONS.ANALYTICS_VIEW],
      });
    }

    const parsedRequest = aiAnalystRequestSchema.safeParse(req.body);
    if (!parsedRequest.success) {
      return res.status(400).json({
        error:
          'Provide a question of up to 2,000 characters and no more than 12 prior messages.',
        code: 'INVALID_REQUEST',
      });
    }

    const allowedRelations = getAllowedRelations(req.user);
    if (allowedRelations.size === 0) {
      return res.status(403).json({
        error:
          'You need Event Requests View or Collections View permission to analyze data.',
        code: 'DATASET_ACCESS_DENIED',
      });
    }

    const auditRecordId = randomUUID();
    const queryLog: Array<{
      purpose: string;
      relations: AnalystRelation[];
      rowCount: number;
      durationMs: number;
      ok: boolean;
    }> = [];
    await AuditLogger.log(
      'AI_ANALYST_QUERY',
      'ai_analyst',
      auditRecordId,
      null,
      {
        messageLength: parsedRequest.data.message.length,
        outcome: 'requested',
        allowedRelations: [...allowedRelations],
      },
      {
        userId: req.user.id,
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
        sessionId: req.sessionID,
      }
    );

    try {
      const messages: ChatCompletionMessageParam[] = [
        { role: 'system', content: getSystemPrompt(allowedRelations) },
        ...parsedRequest.data.conversationHistory.map((message) => ({
          role: message.role,
          content: message.content,
        })),
        { role: 'user', content: parsedRequest.data.message },
      ];
      const client = getOpenAIClient();
      let finalResponse:
        | ReturnType<typeof aiAnalystResponseSchema.safeParse>
        | { success: false } = { success: false };

      let modelTurns = 0;
      while (modelTurns < MAX_ANALYST_MODEL_TURNS) {
        modelTurns += 1;
        const completion = await client.chat.completions.create({
          model: 'gpt-5',
          messages,
          tools: ANALYST_TOOLS,
          tool_choice: 'auto',
          parallel_tool_calls: false,
          max_completion_tokens: 4_000,
          reasoning_effort: 'minimal',
        });
        const assistantMessage = completion.choices[0]?.message;
        if (!assistantMessage) break;

        if (!assistantMessage.tool_calls?.length) {
          finalResponse = parseFinalResponse(assistantMessage.content);
          break;
        }

        messages.push({
          role: 'assistant',
          content: assistantMessage.content ?? '',
          tool_calls: assistantMessage.tool_calls,
        });
        const toolCall = assistantMessage.tool_calls[0];
        if (toolCall.type !== 'function') {
          messages.push({
            role: 'tool',
            tool_call_id: toolCall.id,
            content: 'Only the run_analysis_query function tool is available.',
          });
          continue;
        }
        let toolArguments: unknown;
        try {
          toolArguments = JSON.parse(toolCall.function.arguments || '{}');
        } catch {
          toolArguments = null;
        }
        const parsedTool = queryToolInputSchema.safeParse(toolArguments);

        if (!parsedTool.success) {
          messages.push({
            role: 'tool',
            tool_call_id: toolCall.id,
            content:
              'The query tool requires a SQL query and a brief purpose, within the allowed size.',
          });
          continue;
        }

        const queryResult = await runAnalystQuery(
          parsedTool.data.sql,
          allowedRelations
        );
        queryLog.push({
          purpose: parsedTool.data.purpose,
          relations: queryResult.relations ?? [],
          rowCount: queryResult.rowCount ?? 0,
          durationMs: queryResult.durationMs ?? 0,
          ok: queryResult.ok,
        });
        messages.push({
          role: 'tool',
          tool_call_id: toolCall.id,
          content: queryResult.ok
            ? JSON.stringify({
                rowCount: queryResult.rowCount,
                truncated: queryResult.truncated,
                result: formatAnalystRowsForModel(queryResult.rows ?? []),
              })
            : (queryResult.error ?? 'The query could not be run.'),
        });
      }

      if (!finalResponse.success) {
        const completion = await client.chat.completions.create({
          model: 'gpt-5',
          messages,
          tools: ANALYST_TOOLS,
          tool_choice: 'none',
          max_completion_tokens: 4_000,
          reasoning_effort: 'minimal',
        });
        finalResponse = parseFinalResponse(
          completion.choices[0]?.message.content ?? null
        );
      }

      if (!finalResponse.success) {
        return res.status(502).json({
          error:
            'AI Analyst could not produce a valid final response. Please try a narrower question.',
          code: 'INVALID_AI_RESPONSE',
        });
      }

      const successfulRelations = new Set(
        queryLog.filter((query) => query.ok).flatMap((query) => query.relations)
      );
      const datasets = [
        ...(successfulRelations.has('analyst_events') ? ['events'] : []),
        ...(successfulRelations.has('analyst_collections')
          ? ['collections']
          : []),
      ] as AnalystDataset[];
      await AuditLogger.log(
        'AI_ANALYST_QUERY',
        'ai_analyst',
        auditRecordId,
        null,
        {
          messageLength: parsedRequest.data.message.length,
          outcome: 'answered',
          ...auditQueryMetadata(queryLog),
        },
        {
          userId: req.user.id,
          ipAddress: req.ip,
          userAgent: req.get('user-agent'),
          sessionId: req.sessionID,
        }
      );

      return res.json({
        ...finalResponse.data,
        datasets,
        unavailableDatasets: [],
        dataQualityNotes: [
          'Analysis used complete authorized non-deleted event and collection records through server-mediated read-only queries.',
          'Results may be bounded by query row limits; totals and grouped results can still use the full matching population.',
        ],
      });
    } catch (error) {
      logger.error('AI Analyst request failed', {
        userId: req.user.id,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return res.status(503).json({
        error:
          'AI Analyst is temporarily unavailable. Please try again shortly.',
        code: 'AI_ANALYST_UNAVAILABLE',
      });
    }
  }
);
