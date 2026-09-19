import { Router } from 'express';
import { z } from 'zod';
import { eq, desc, sql } from 'drizzle-orm';
import { workLogs, workLogTimers } from '@shared/schema';
import { db, executeRawSql } from '../db';
import { canEditWorkLog, PERMISSIONS } from '@shared/auth-utils';
import {
  requirePermission,
  requireOwnershipPermission,
} from '../middleware/auth';
import { storage } from '../storage';
import { logger } from '../utils/production-safe-logger';

// Default and maximum limits for pagination to prevent unbounded queries
// Default is set high (1000) to maintain backwards compatibility since client doesn't paginate yet
const DEFAULT_LIMIT = 1000;
const MAX_LIMIT = 5000;

const router = Router();

// Zod schema for validation
const insertWorkLogSchema = z.object({
  description: z.string().min(1),
  hours: z.number().int().min(0).max(24),
  minutes: z.number().int().min(0).max(59),
  workDate: z.string().refine((date) => !isNaN(Date.parse(date)), {
    message: 'Invalid date format',
  }),
}).refine((data) => data.hours < 24 || data.minutes === 0, {
  message: 'Minutes must be 0 when hours is 24',
});

const startTimerSchema = z.object({
  description: z.string().max(2000).optional(),
});

const stopTimerSchema = z.object({
  description: z.string().max(2000).optional(),
});

// Middleware to check if user is super admin or admin
function isSuperAdmin(req: any) {
  return req.user?.role === 'super_admin' || req.user?.role === 'admin';
}

// Get work logs - Check permissions first
router.get('/', async (req, res) => {
  try {
    // Check authentication
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const userId = req.user?.id;
    const userEmail = req.user?.email;
    const userRole = req.user?.role;

    // Parse pagination params with safe defaults
    const requestedLimit = parseInt(req.query.limit as string) || DEFAULT_LIMIT;
    const limit = Math.min(Math.max(1, requestedLimit), MAX_LIMIT);
    const offset = Math.max(0, parseInt(req.query.offset as string) || 0);

    logger.log(
      `[WORK LOGS] User: ${userId}, Email: ${userEmail}, Role: ${userRole}`
    );

    // Check if user has any work log permissions
    const canCreate = req.user?.permissions?.includes(PERMISSIONS.WORK_LOGS_ADD);
    const canViewAll = req.user?.permissions?.includes(PERMISSIONS.WORK_LOGS_VIEW_ALL);
    const isAdmin = isSuperAdmin(req) || userEmail === 'mdlouza@gmail.com';

    logger.log(
      `[WORK LOGS] Permissions - canCreate: ${canCreate}, canViewAll: ${canViewAll}, isAdmin: ${isAdmin}`
    );

    // User must have at least WORK_LOGS_ADD permission to access work logs
    if (!canCreate && !canViewAll && !isAdmin) {
      return res
        .status(403)
        .json({ error: 'Insufficient permissions to view work logs' });
    }

    // Only users with explicit WORK_LOGS_VIEW_ALL permission can see ALL work logs
    if (canViewAll || isAdmin) {
      logger.log(`[WORK LOGS] ViewAll permission - fetching logs with limit ${limit}, offset ${offset}`);
      
      // Get total count for pagination
      const [totalResult] = await db.select({ count: sql<number>`count(*)` }).from(workLogs);
      const total = Number(totalResult?.count || 0);
      
      const logs = await db
        .select()
        .from(workLogs)
        .orderBy(desc(workLogs.workDate))
        .limit(limit)
        .offset(offset);
      logger.log(
        `[WORK LOGS] Found ${logs.length} logs (page)`
      );
      return res.json({
        data: logs,
        total,
        limit,
        offset,
        hasMore: offset + logs.length < total
      });
    }

    if (!userId) {
      return res.status(400).json({ error: 'User context missing' });
    }

    logger.log(
      `[WORK LOGS] Regular user access - fetching logs for ${userId} with limit ${limit}, offset ${offset}`
    );
    
    // Get total count for pagination
    const [totalResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(workLogs)
      .where(eq(workLogs.userId, userId));
    const total = Number(totalResult?.count || 0);
    
    const logs = await db
      .select()
      .from(workLogs)
      .where(eq(workLogs.userId, userId))
      .orderBy(desc(workLogs.workDate))
      .limit(limit)
      .offset(offset);
    logger.log(
      `[WORK LOGS] Found ${logs.length} logs for user ${userId} (page)`
    );
    return res.json({
      data: logs,
      total,
      limit,
      offset,
      hasMore: offset + logs.length < total
    });
  } catch (error) {
    logger.error('Error fetching work logs:', error);
    res.status(500).json({ error: 'Failed to fetch work logs' });
  }
});

// Create a new work log
router.post(
  '/',
  requirePermission(PERMISSIONS.WORK_LOGS_ADD),
  async (req, res) => {
    const result = insertWorkLogSchema.safeParse(req.body);
    if (!result.success)
      return res.status(400).json({ error: result.error.message });
    
    if (!req.user?.id) {
      return res.status(400).json({ error: 'User context missing' });
    }
    
    try {
      const log = await db
        .insert(workLogs)
        .values({
          userId: req.user.id,
          description: result.data.description,
          hours: result.data.hours,
          minutes: result.data.minutes,
          workDate: new Date(result.data.workDate),
        })
        .returning();
      res.status(201).json(log[0]);
    } catch (error) {
      logger.error('Error creating work log:', error);
      res.status(500).json({ error: 'Failed to create work log' });
    }
  }
);

// --- Start/stop stopwatch ---------------------------------------------------
// Declared before the '/:id' handlers so '/timer' isn't swallowed by the param route.

// Get the caller's running timer (null when nothing is running)
router.get(
  '/timer',
  requirePermission(PERMISSIONS.WORK_LOGS_ADD),
  async (req, res) => {
    if (!req.user?.id) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    try {
      const [timer] = await db
        .select()
        .from(workLogTimers)
        .where(eq(workLogTimers.userId, req.user.id));
      res.json({ timer: timer || null });
    } catch (error) {
      logger.error('Error fetching work log timer:', error);
      res.status(500).json({ error: 'Failed to fetch work log timer' });
    }
  }
);

// Start the clock
router.post(
  '/timer/start',
  requirePermission(PERMISSIONS.WORK_LOGS_ADD),
  async (req, res) => {
    if (!req.user?.id) {
      return res.status(400).json({ error: 'User context missing' });
    }
    const result = startTimerSchema.safeParse(req.body ?? {});
    if (!result.success)
      return res.status(400).json({ error: result.error.message });

    try {
      // Let the unique index on user_id decide the winner, so two tabs clicking
      // "Start Work" at once can't create two timers.
      const [timer] = await db
        .insert(workLogTimers)
        .values({
          userId: req.user.id,
          startedAt: new Date(),
          description: result.data.description?.trim() || null,
        })
        .onConflictDoNothing({ target: workLogTimers.userId })
        .returning();

      if (!timer) {
        const [existing] = await db
          .select()
          .from(workLogTimers)
          .where(eq(workLogTimers.userId, req.user.id));
        return res
          .status(409)
          .json({ error: 'A timer is already running', timer: existing || null });
      }

      res.status(201).json({ timer });
    } catch (error) {
      logger.error('Error starting work log timer:', error);
      res.status(500).json({ error: 'Failed to start work log timer' });
    }
  }
);

// Stop the clock and turn the elapsed time into a work log entry
router.post(
  '/timer/stop',
  requirePermission(PERMISSIONS.WORK_LOGS_ADD),
  async (req, res) => {
    if (!req.user?.id) {
      return res.status(400).json({ error: 'User context missing' });
    }
    const result = stopTimerSchema.safeParse(req.body ?? {});
    if (!result.success)
      return res.status(400).json({ error: result.error.message });

    try {
      // The Neon HTTP driver has no interactive transactions. This one statement
      // locks the active timer, writes its log entry, and removes the timer
      // atomically, so an insert failure can never discard tracked time.
      const [timerResult] = await executeRawSql<{
        log: typeof workLogs.$inferSelect;
        elapsedSeconds: number;
        capped: boolean;
      }>(sql`
        WITH active_timer AS (
          SELECT id, started_at, description
          FROM work_log_timers
          WHERE user_id = ${req.user.id}
          FOR UPDATE
        ),
        timer_duration AS (
          SELECT
            id,
            started_at,
            description,
            GREATEST(
              0,
              ROUND(EXTRACT(EPOCH FROM NOW() - started_at))
            )::integer AS elapsed_seconds,
            GREATEST(
              1,
              ROUND(EXTRACT(EPOCH FROM NOW() - started_at) / 60.0)
            )::integer AS raw_minutes
          FROM active_timer
        ),
        created_log AS (
          INSERT INTO work_logs (
            user_id,
            description,
            hours,
            minutes,
            work_date
          )
          SELECT
            ${req.user.id},
            COALESCE(
              NULLIF(BTRIM(${result.data.description ?? ''}), ''),
              NULLIF(BTRIM(description), ''),
              'Work logged'
            ),
            (LEAST(1440, raw_minutes) / 60)::integer,
            (LEAST(1440, raw_minutes) % 60)::integer,
            date_trunc(
              'day',
              started_at AT TIME ZONE 'America/New_York'
            ) + INTERVAL '12 hours'
          FROM timer_duration
          RETURNING *
        ),
        deleted_timer AS (
          DELETE FROM work_log_timers
          WHERE id IN (SELECT id FROM timer_duration)
          RETURNING id
        )
        SELECT
          json_build_object(
            'id', created_log.id,
            'userId', created_log.user_id,
            'description', created_log.description,
            'hours', created_log.hours,
            'minutes', created_log.minutes,
            'workDate', created_log.work_date,
            'createdAt', created_log.created_at,
            'status', created_log.status,
            'approvedBy', created_log.approved_by,
            'approvedAt', created_log.approved_at,
            'visibility', created_log.visibility,
            'sharedWith', created_log.shared_with,
            'department', created_log.department,
            'teamId', created_log.team_id
          ) AS log,
          timer_duration.elapsed_seconds AS "elapsedSeconds",
          (timer_duration.raw_minutes > 1440) AS capped
        FROM created_log
        CROSS JOIN timer_duration
      `);

      if (!timerResult) {
        return res.status(404).json({ error: 'No timer is running' });
      }

      res.status(201).json(timerResult);
    } catch (error) {
      logger.error('Error stopping work log timer:', error);
      res.status(500).json({ error: 'Failed to stop work log timer' });
    }
  }
);

// Throw away a running timer without logging anything
router.delete(
  '/timer',
  requirePermission(PERMISSIONS.WORK_LOGS_ADD),
  async (req, res) => {
    if (!req.user?.id) {
      return res.status(400).json({ error: 'User context missing' });
    }
    try {
      await db.delete(workLogTimers).where(eq(workLogTimers.userId, req.user.id));
      res.status(204).send();
    } catch (error) {
      logger.error('Error discarding work log timer:', error);
      res.status(500).json({ error: 'Failed to discard work log timer' });
    }
  }
);

// Update a work log (own entries, or any if the user has edit-all)
router.put('/:id', async (req, res) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const logId = parseInt(req.params.id);
  if (isNaN(logId)) return res.status(400).json({ error: 'Invalid log ID' });

  const result = insertWorkLogSchema.safeParse(req.body);
  if (!result.success)
    return res.status(400).json({ error: result.error.message });

  try {
    const existing = await db
      .select()
      .from(workLogs)
      .where(eq(workLogs.id, logId));
    const currentLog = existing[0];
    if (!currentLog) {
      return res.status(404).json({ error: 'Work log not found' });
    }

    let currentUser = req.user;
    if (req.user.id) {
      try {
        const freshUser = await storage.getUser(req.user.id);
        if (freshUser && freshUser.isActive) {
          currentUser = freshUser;
        } else {
          return res
            .status(401)
            .json({ error: 'User account not found or inactive' });
        }
      } catch (dbError) {
        logger.error('Database error verifying work log edit permissions:', dbError);
        return res
          .status(500)
          .json({ error: 'Unable to verify user permissions' });
      }
    }

    if (!canEditWorkLog(currentUser, currentLog)) {
      return res
        .status(403)
        .json({ error: 'Insufficient permissions to edit this work log' });
    }

    const updated = await db
      .update(workLogs)
      .set({
        description: result.data.description,
        hours: result.data.hours,
        minutes: result.data.minutes,
        workDate: new Date(result.data.workDate),
      })
      .where(eq(workLogs.id, logId))
      .returning();
    res.json(updated[0]);
  } catch (error) {
    logger.error('Error updating work log:', error);
    res.status(500).json({ error: 'Failed to update work log' });
  }
});

// Delete a work log (own or any if super admin)
router.delete(
  '/:id',
  requireOwnershipPermission(
    PERMISSIONS.WORK_LOGS_DELETE_OWN,
    PERMISSIONS.WORK_LOGS_DELETE_ALL,
    async (req) => {
      const logId = parseInt(req.params.id);
      const log = await db
        .select()
        .from(workLogs)
        .where(eq(workLogs.id, logId));
      return log[0]?.userId || null;
    }
  ),
  async (req, res) => {
    const logId = parseInt(req.params.id);
    logger.log('[WORK LOGS DELETE] Attempting to delete log ID:', logId);

    if (isNaN(logId)) return res.status(400).json({ error: 'Invalid log ID' });

    try {
      logger.log('[WORK LOGS DELETE] Deleting log...');
      await db.delete(workLogs).where(eq(workLogs.id, logId));
      logger.log('[WORK LOGS DELETE] Successfully deleted log ID:', logId);

      res.status(204).send();
    } catch (error) {
      logger.error('[WORK LOGS DELETE] Error:', error);
      logger.error('[WORK LOGS DELETE] Stack trace:', (error as Error).stack);
      res.status(500).json({ error: 'Failed to delete work log' });
    }
  }
);

export default router;
