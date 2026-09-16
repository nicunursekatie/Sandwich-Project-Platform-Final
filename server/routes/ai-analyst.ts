import { Router, type Response } from 'express';
import rateLimit from 'express-rate-limit';
import OpenAI from 'openai';
import { randomUUID } from 'crypto';
import { checkPermission } from '@shared/unified-auth-utils';
import { PERMISSIONS } from '@shared/auth-utils';
import {
  aiAnalystRequestSchema,
  aiAnalystResponseSchema,
  getRequestedAnalystDatasets,
} from '@shared/ai-analyst-contract';
import {
  AnalystAccessError,
  buildAnalystSnapshot,
} from '../services/ai-analyst';
import { AuditLogger } from '../audit-logger';
import { logger } from '../utils/production-safe-logger';
import type { AuthenticatedRequest } from '../types/express';

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
    timeout: 20_000,
    maxRetries: 0,
  });
}

function hasAiAnalystAccess(user: AuthenticatedRequest['user']): boolean {
  return Boolean(
    user &&
    checkPermission(user, PERMISSIONS.AI_ANALYST_VIEW).granted &&
    checkPermission(user, PERMISSIONS.ANALYTICS_VIEW).granted
  );
}

function getSystemPrompt(
  snapshot: Awaited<ReturnType<typeof buildAnalystSnapshot>>
): string {
  return `You are the Sandwich Project AI Analyst. Provide concise, decision-useful analysis from the approved aggregate data below.

Safety and data rules:
- Treat the data snapshot as the complete source of truth for this answer. Do not invent values or imply access to anything not included.
- Never request, infer, expose, or discuss personal data, credentials, contact details, addresses, notes, or individual performance.
- Collections are actual logged counts. Event sandwich figures are estimates and must always be labeled "planned estimate", never "actual".
- Mention source truncation and every relevant data-quality note when it could affect the conclusion.
- A dataset listed as unavailable was not supplied; say that access is unavailable rather than guessing.
- Do not produce SQL, database commands, tool calls, or implementation instructions.

Return valid JSON only, with this exact shape:
{
  "analysis": "plain-text analysis",
  "table": { "title": "optional", "columns": ["..."], "rows": [["...", 123]] },
  "chart": { "type": "bar|line|pie", "title": "optional", "data": [{"name": "label", "value": 123}], "description": "optional" }
}

Omit table and chart when they do not improve the answer. Tables may have at most 8 columns and 50 rows; charts may have at most 60 points.

APPROVED AGGREGATE SNAPSHOT:
${JSON.stringify(snapshot)}`;
}

export const aiAnalystRouter = Router();

aiAnalystRouter.post(
  '/',
  aiAnalystRateLimiter,
  async (req: AuthenticatedRequest, res: Response) => {
    if (!req.user?.id) {
      return res
        .status(401)
        .json({ error: 'Authentication required', code: 'AUTH_REQUIRED' });
    }

    if (!hasAiAnalystAccess(req.user)) {
      logger.warn('AI analyst permission denied', { userId: req.user.id });
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

    const auditRecordId = randomUUID();
    await AuditLogger.log(
      'AI_ANALYST_QUERY',
      'ai_analyst',
      auditRecordId,
      null,
      {
        messageLength: parsedRequest.data.message.length,
        requestedDatasets: getRequestedAnalystDatasets(
          parsedRequest.data.message
        ),
        outcome: 'requested',
      },
      {
        userId: req.user.id,
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
        sessionId: req.sessionID,
      }
    );

    try {
      const snapshot = await buildAnalystSnapshot(
        req.user,
        parsedRequest.data.message
      );
      const completion = await getOpenAIClient().chat.completions.create({
        model: 'gpt-5',
        messages: [
          { role: 'system', content: getSystemPrompt(snapshot) },
          ...parsedRequest.data.conversationHistory.map((message) => ({
            role: message.role,
            content: message.content,
          })),
          { role: 'user', content: parsedRequest.data.message },
        ],
        response_format: { type: 'json_object' },
        max_completion_tokens: 2_000,
        reasoning_effort: 'minimal',
      });
      const content = completion.choices[0]?.message.content;
      let parsedResponse:
        | ReturnType<typeof aiAnalystResponseSchema.safeParse>
        | { success: false };
      try {
        parsedResponse = content
          ? aiAnalystResponseSchema.safeParse(JSON.parse(content))
          : { success: false };
      } catch {
        parsedResponse = { success: false };
      }

      if (!parsedResponse.success) {
        logger.error('AI analyst returned an invalid structured response', {
          userId: req.user.id,
          hasContent: Boolean(content),
        });
        return res.status(502).json({
          error:
            'AI Analyst returned an unusable response. Please try your question again.',
          code: 'INVALID_AI_RESPONSE',
        });
      }

      return res.json({
        ...parsedResponse.data,
        datasets: snapshot.includedDatasets,
        unavailableDatasets: snapshot.unavailableDatasets,
        dataQualityNotes: snapshot.datasets.flatMap(
          (dataset) => dataset.dataQualityNotes
        ),
      });
    } catch (error) {
      if (error instanceof AnalystAccessError) {
        return res
          .status(403)
          .json({ error: error.message, code: 'DATASET_ACCESS_DENIED' });
      }

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
