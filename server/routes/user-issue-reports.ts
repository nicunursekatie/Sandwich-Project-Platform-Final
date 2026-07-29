import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db';
import { userIssueReports } from '@shared/schema';
import { desc, gte } from 'drizzle-orm';
import type { AuthenticatedRequest } from '../types/express';
import { getSessionUser, getUserId } from '../types/express';
import { logger } from '../utils/production-safe-logger';
import { appendErrorLogToSheet } from '../services/error-log-sheet-sync';

const submitReportSchema = z.object({
  pagePath: z.string().min(1).max(2000),
  pageLabel: z.string().max(500).optional(),
  whatDoing: z.string().min(1).max(10000),
  expectedOutcome: z.string().min(1).max(10000),
  actualOutcome: z.string().min(1).max(10000),
  recordType: z.string().max(100).optional(),
  recordId: z.string().max(100).optional(),
  recordLabel: z.string().max(500).optional(),
  clientTimestamp: z.string().optional(),
});

export function createUserIssueReportsRoutes(deps: {
  isAuthenticated: (req: AuthenticatedRequest, res: any, next: any) => void;
  requirePermission: (permission: string) => (req: AuthenticatedRequest, res: any, next: any) => void;
}) {
  const router = Router();

  router.post('/', deps.isAuthenticated, async (req: AuthenticatedRequest, res) => {
    try {
      const body = submitReportSchema.parse(req.body);
      const sessionUser = getSessionUser(req);
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const displayName =
        sessionUser
          ? [sessionUser.firstName, sessionUser.lastName].filter(Boolean).join(' ')
          : [req.user?.firstName, req.user?.lastName].filter(Boolean).join(' ') ||
            req.user?.displayName ||
            sessionUser?.email ||
            req.user?.email ||
            userId;

      const [report] = await db
        .insert(userIssueReports)
        .values({
          userId,
          userEmail: sessionUser?.email ?? req.user?.email ?? null,
          userName: displayName,
          pagePath: body.pagePath,
          pageLabel: body.pageLabel ?? null,
          whatDoing: body.whatDoing,
          expectedOutcome: body.expectedOutcome,
          actualOutcome: body.actualOutcome,
          recordType: body.recordType ?? null,
          recordId: body.recordId ?? null,
          recordLabel: body.recordLabel ?? null,
          userAgent: req.get('User-Agent') ?? null,
        })
        .returning();

      logger.log('[UserIssueReport] Submitted', {
        id: report.id,
        userId,
        pagePath: body.pagePath,
        recordType: body.recordType,
        recordId: body.recordId,
      });

      appendErrorLogToSheet({
        type: 'user_report',
        timestamp: report.createdAt ?? new Date(),
        userName: displayName,
        userEmail: sessionUser?.email ?? req.user?.email ?? null,
        page: body.pageLabel || body.pagePath,
        summary: body.actualOutcome,
        details: [
          `What doing: ${body.whatDoing}`,
          `Expected: ${body.expectedOutcome}`,
          body.pagePath ? `Path: ${body.pagePath}` : '',
        ]
          .filter(Boolean)
          .join('\n'),
        record: body.recordLabel || body.recordId || body.recordType || null,
        sourceId: report.id,
      });

      res.status(201).json(report);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Invalid report data', details: error.errors });
      }
      logger.error('[UserIssueReport] Failed to submit:', error);
      res.status(500).json({ error: 'Failed to submit report' });
    }
  });

  router.get(
    '/admin',
    deps.isAuthenticated,
    deps.requirePermission('ADMIN_PANEL_ACCESS'),
    async (req: AuthenticatedRequest, res) => {
      try {
        const daysParam = parseInt((req.query.days as string) || '30', 10);
        const days = !Number.isNaN(daysParam) && daysParam > 0 && daysParam <= 365 ? daysParam : 30;
        const limitParam = parseInt((req.query.limit as string) || '200', 10);
        const limit =
          !Number.isNaN(limitParam) && limitParam > 0 && limitParam <= 1000 ? limitParam : 200;

        const sinceDate = new Date();
        sinceDate.setDate(sinceDate.getDate() - days);

        const reports = await db
          .select()
          .from(userIssueReports)
          .where(gte(userIssueReports.createdAt, sinceDate))
          .orderBy(desc(userIssueReports.createdAt))
          .limit(limit);

        res.json(reports);
      } catch (error) {
        logger.error('[UserIssueReport] Failed to fetch admin list:', error);
        res.status(500).json({ error: 'Failed to fetch user issue reports' });
      }
    }
  );

  return router;
}
