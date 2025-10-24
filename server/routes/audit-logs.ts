import { Router } from 'express';
import type { RouterDependencies } from '../types';
import { AuditLogger } from '../audit-logger';
import { PERMISSIONS } from '@shared/auth-utils';

export function createAuditLogsRouter(deps: RouterDependencies) {
  const router = Router();
  const { requirePermission } = deps;

  // Get audit logs with filtering
  router.get(
    '/',
    requirePermission(PERMISSIONS.ADMIN),
    async (req: any, res) => {
      try {
        const {
          tableName,
          recordId,
          userId,
          limit = 100,
          offset = 0
        } = req.query;

        const logs = await AuditLogger.getAuditHistory(
          tableName as string | undefined,
          recordId as string | undefined,
          userId as string | undefined,
          parseInt(limit as string, 10),
          parseInt(offset as string, 10)
        );

        // Parse JSON strings in the logs for easier consumption
        const parsedLogs = logs.map(log => ({
          ...log,
          oldData: log.oldData ? JSON.parse(log.oldData) : null,
          newData: log.newData ? JSON.parse(log.newData) : null
        }));

        res.json(parsedLogs);
      } catch (error) {
        console.error('Failed to fetch audit logs:', error);
        res.status(500).json({ error: 'Failed to fetch audit logs' });
      }
    }
  );

  // Get audit logs for a specific entity
  router.get(
    '/:tableName/:recordId',
    requirePermission(PERMISSIONS.ADMIN),
    async (req: any, res) => {
      try {
        const { tableName, recordId } = req.params;
        const { limit = 50, offset = 0 } = req.query;

        const logs = await AuditLogger.getAuditHistory(
          tableName,
          recordId,
          undefined,
          parseInt(limit as string, 10),
          parseInt(offset as string, 10)
        );

        // Parse JSON strings
        const parsedLogs = logs.map(log => ({
          ...log,
          oldData: log.oldData ? JSON.parse(log.oldData) : null,
          newData: log.newData ? JSON.parse(log.newData) : null
        }));

        res.json(parsedLogs);
      } catch (error) {
        console.error('Failed to fetch audit logs for entity:', error);
        res.status(500).json({ error: 'Failed to fetch audit logs' });
      }
    }
  );

  return router;
}
