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

        // Safely parse limit and offset with validation
        const parsedLimit = parseInt(limit as string, 10);
        const parsedOffset = parseInt(offset as string, 10);

        const validLimit = !isNaN(parsedLimit) && parsedLimit > 0 ? parsedLimit : 100;
        const validOffset = !isNaN(parsedOffset) && parsedOffset >= 0 ? parsedOffset : 0;

        const logs = await AuditLogger.getAuditHistory(
          tableName as string | undefined,
          recordId as string | undefined,
          userId as string | undefined,
          validLimit,
          validOffset
        );

        // Parse JSON strings in the logs for easier consumption
        const parsedLogs = logs.map(log => {
          let oldData = null;
          let newData = null;

          // Safely parse oldData
          if (log.oldData) {
            try {
              oldData = JSON.parse(log.oldData);
            } catch (error) {
              console.error(`Failed to parse oldData for audit log ${log.id}:`, error);
              oldData = { _parseError: 'Malformed JSON', _raw: log.oldData };
            }
          }

          // Safely parse newData
          if (log.newData) {
            try {
              newData = JSON.parse(log.newData);
            } catch (error) {
              console.error(`Failed to parse newData for audit log ${log.id}:`, error);
              newData = { _parseError: 'Malformed JSON', _raw: log.newData };
            }
          }

          return {
            ...log,
            oldData,
            newData
          };
        });

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

        // Safely parse limit and offset with validation
        const parsedLimit = parseInt(limit as string, 10);
        const parsedOffset = parseInt(offset as string, 10);

        const validLimit = !isNaN(parsedLimit) && parsedLimit > 0 ? parsedLimit : 50;
        const validOffset = !isNaN(parsedOffset) && parsedOffset >= 0 ? parsedOffset : 0;

        const logs = await AuditLogger.getAuditHistory(
          tableName,
          recordId,
          undefined,
          validLimit,
          validOffset
        );

        // Parse JSON strings with error handling
        const parsedLogs = logs.map(log => {
          let oldData = null;
          let newData = null;

          // Safely parse oldData
          if (log.oldData) {
            try {
              oldData = JSON.parse(log.oldData);
            } catch (error) {
              console.error(`Failed to parse oldData for audit log ${log.id}:`, error);
              oldData = { _parseError: 'Malformed JSON', _raw: log.oldData };
            }
          }

          // Safely parse newData
          if (log.newData) {
            try {
              newData = JSON.parse(log.newData);
            } catch (error) {
              console.error(`Failed to parse newData for audit log ${log.id}:`, error);
              newData = { _parseError: 'Malformed JSON', _raw: log.newData };
            }
          }

          return {
            ...log,
            oldData,
            newData
          };
        });

        res.json(parsedLogs);
      } catch (error) {
        console.error('Failed to fetch audit logs for entity:', error);
        res.status(500).json({ error: 'Failed to fetch audit logs' });
      }
    }
  );

  return router;
}
