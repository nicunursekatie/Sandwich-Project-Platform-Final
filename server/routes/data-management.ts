import { Router } from 'express';
import type { RouterDependencies } from '../types';
import { DataExporter } from '../data-export';
import { BulkOperationsManager } from '../bulk-operations';
import { AuditLogger } from '../audit-logger';
import { z } from 'zod';
import { PERMISSIONS } from '@shared/auth-utils';
import { db } from '../db';
import { sandwichCollections, hosts, teamBoardItems, teamBoardComments, teamBoardItemLikes, holdingZoneCategories, teamBoardAssignments } from '@shared/schema';
import { sql, eq, desc, inArray } from 'drizzle-orm';
import { logger } from '../utils/production-safe-logger';

export function createDataManagementRouter(deps: RouterDependencies) {
  const router = Router();
  const { requirePermission } = deps;

// Export data endpoints
  router.get(
  '/export/collections',
  requirePermission(PERMISSIONS.DATA_EXPORT),
  async (req, res) => {
    try {
      const { format = 'csv', startDate, endDate } = req.query;

      const options = {
        format: format as 'csv' | 'json',
        dateRange:
          startDate && endDate
            ? {
                start: startDate as string,
                end: endDate as string,
              }
            : undefined,
      };

      const result = await DataExporter.exportSandwichCollections(options);

      if (options.format === 'csv') {
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader(
          'Content-Disposition',
          'attachment; filename="sandwich_collections.csv"'
        );
        res.send(result.data);
      } else {
        res.json(result);
      }
    } catch (error) {
      logger.error('Export failed:', error);
      res.status(500).json({ error: 'Export failed' });
    }
  }
);

  router.get(
  '/export/hosts',
  requirePermission(PERMISSIONS.DATA_EXPORT),
  async (req, res) => {
    try {
      const { format = 'csv', includeInactive = 'false' } = req.query;

      const options = {
        format: format as 'csv' | 'json',
        includeInactive: includeInactive === 'true',
      };

      const result = await DataExporter.exportHosts(options);

      if (options.format === 'csv') {
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename="hosts.csv"');
        res.send(result.data);
      } else {
        res.json(result);
      }
    } catch (error) {
      logger.error('Export failed:', error);
      res.status(500).json({ error: 'Export failed' });
    }
  }
);

  router.get('/export/full-dataset', async (req, res) => {
  try {
    const result = await DataExporter.exportFullDataset({ format: 'json' });

    res.setHeader('Content-Type', 'application/json');
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="full_dataset.json"'
    );
    res.json(result.data);
  } catch (error) {
    logger.error('Full export failed:', error);
    res.status(500).json({ error: 'Full export failed' });
  }
});

  router.get('/summary', async (req, res) => {
  try {
    const summary = await DataExporter.getDataSummary();
    res.json(summary);
  } catch (error) {
    logger.error('Summary failed:', error);
    res.status(500).json({ error: 'Summary failed' });
  }
});

// Bulk operations endpoints
  router.post(
  '/bulk/deduplicate-hosts',
  requirePermission(PERMISSIONS.ADMIN_ACCESS),
  async (req: any, res) => {
    try {
      const context = {
        userId: req.user?.claims?.sub,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        sessionId: req.sessionID,
      };

      const result = await BulkOperationsManager.deduplicateHosts(context);
      res.json(result);
    } catch (error) {
      logger.error('Deduplication failed:', error);
      res.status(500).json({ error: 'Deduplication failed' });
    }
  }
);

  router.delete(
  '/bulk/collections',
  requirePermission(PERMISSIONS.ADMIN_ACCESS),
  async (req: any, res) => {
    try {
      const schema = z.object({
        ids: z.array(z.number()),
      });

      const { ids } = schema.parse(req.body);

      const context = {
        userId: req.user?.claims?.sub,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        sessionId: req.sessionID,
      };

      const result = await BulkOperationsManager.bulkDeleteCollections(
        ids,
        context
      );
      res.json(result);
    } catch (error) {
      logger.error('Bulk deletion failed:', error);
      res.status(500).json({ error: 'Bulk deletion failed' });
    }
  }
);

// Data integrity endpoints
  router.get('/integrity/check', async (req, res) => {
  try {
    const result = await BulkOperationsManager.validateDataIntegrity();
    res.json(result);
  } catch (error) {
    logger.error('Integrity check failed:', error);
    res.status(500).json({ error: 'Integrity check failed' });
  }
});

// Audit log endpoints
  router.get('/audit/history', async (req, res) => {
  try {
    const {
      tableName,
      recordId,
      userId,
      limit = '100',
      offset = '0',
    } = req.query;

    const history = await AuditLogger.getAuditHistory(
      tableName as string,
      recordId as string,
      userId as string,
      parseInt(limit as string),
      parseInt(offset as string)
    );

    res.json({ history });
  } catch (error) {
    logger.error('Audit history failed:', error);
    res.status(500).json({ error: 'Audit history failed' });
  }
});

// Collection statistics endpoint - uses SQL aggregation for efficiency
  router.get('/collection-stats', async (req, res) => {
  try {
    // Get total count using SQL COUNT
    const [totalResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(sandwichCollections);

    // Get count of mapped records using a subquery/join
    const [mappedResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(sandwichCollections)
      .innerJoin(
        hosts,
        sql`LOWER(TRIM(${sandwichCollections.hostName})) = LOWER(TRIM(${hosts.name}))`
      );

    const totalRecords = Number(totalResult?.count || 0);
    const mappedRecords = Number(mappedResult?.count || 0);

    res.json({
      totalRecords,
      mappedRecords,
      unmappedRecords: totalRecords - mappedRecords,
    });
  } catch (error) {
    logger.error('Collection stats failed:', error);
    res.status(500).json({ error: 'Failed to get collection stats' });
  }
});

// Host mapping distribution statistics - uses SQL GROUP BY for efficiency
  router.get('/host-mapping-stats', async (req, res) => {
  try {
    // Parse pagination parameters (default limit 200 for stats display)
    const limit = Math.min(parseInt(req.query.limit as string) || 200, 1000);

    // Use SQL GROUP BY to aggregate counts efficiently
    const distribution = await db
      .select({
        hostName: sandwichCollections.hostName,
        count: sql<number>`count(*)`.as('count'),
      })
      .from(sandwichCollections)
      .groupBy(sandwichCollections.hostName)
      .orderBy(sql`count(*) DESC`)
      .limit(limit);

    // Get all host names for mapping check (this is a small lookup table)
    const allHosts = await db.select({ name: hosts.name }).from(hosts);
    const hostNames = new Set(allHosts.map(h => h.name.toLowerCase().trim()));

    // Add mapped status to each result
    const result = distribution.map(item => ({
      hostName: item.hostName,
      count: Number(item.count),
      mapped: hostNames.has(item.hostName.toLowerCase().trim())
    }));

    res.json(result);
  } catch (error) {
    logger.error('Host mapping stats failed:', error);
    res.status(500).json({ error: 'Failed to get host mapping stats' });
  }
});

// Get collections by specific host
  router.get('/collections-by-host/:host', async (req, res) => {
  try {
    const { host } = req.params;
    const limit = Math.min(parseInt(req.query.limit as string) || 500, 2000);
    const offset = parseInt(req.query.offset as string) || 0;

    const collections = await db
      .select()
      .from(sandwichCollections)
      .where(eq(sandwichCollections.hostName, host))
      .orderBy(desc(sandwichCollections.collectionDate))
      .limit(limit)
      .offset(offset);

    res.json(collections);
  } catch (error) {
    logger.error('Get collections by host failed:', error);
    res.status(500).json({ error: 'Failed to get collections for host' });
  }
});

// Bulk map hosts - attempt to match collection hostNames to hosts table
// Uses batch updates instead of individual queries for efficiency
  router.post('/bulk-map-hosts', async (req, res) => {
  try {
    // Get all hosts (small lookup table)
    const allHosts = await db.select().from(hosts);

    // Create mapping of lowercase host names to actual host names
    const hostMapping = new Map<string, string>();
    allHosts.forEach(host => {
      hostMapping.set(host.name.toLowerCase().trim(), host.name);
    });

    let totalUpdated = 0;
    const BATCH_SIZE = 500;
    let offset = 0;
    let hasMore = true;

    // Process in batches to avoid loading all collections at once
    while (hasMore) {
      const batchCollections = await db
        .select({ id: sandwichCollections.id, hostName: sandwichCollections.hostName })
        .from(sandwichCollections)
        .limit(BATCH_SIZE)
        .offset(offset);

      if (batchCollections.length < BATCH_SIZE) {
        hasMore = false;
      }

      // Group collections by their corrected host name
      const updatesByTargetName = new Map<string, number[]>();

      for (const collection of batchCollections) {
        const lowerHostName = collection.hostName.toLowerCase().trim();
        const matchedHostName = hostMapping.get(lowerHostName);

        if (matchedHostName && matchedHostName !== collection.hostName) {
          if (!updatesByTargetName.has(matchedHostName)) {
            updatesByTargetName.set(matchedHostName, []);
          }
          updatesByTargetName.get(matchedHostName)!.push(collection.id);
        }
      }

      // Batch update: one UPDATE query per target host name
      for (const [targetHostName, ids] of updatesByTargetName) {
        if (ids.length > 0) {
          await db
            .update(sandwichCollections)
            .set({ hostName: targetHostName })
            .where(inArray(sandwichCollections.id, ids));
          totalUpdated += ids.length;
        }
      }

      offset += BATCH_SIZE;
    }

    res.json({
      success: true,
      updatedRecords: totalUpdated,
      message: `Successfully standardized ${totalUpdated} host name(s) to match the hosts directory`
    });
  } catch (error) {
    logger.error('Bulk map hosts failed:', error);
    res.status(500).json({ error: 'Failed to map hosts' });
  }
});

// Fix data corruption in sandwich collections
// Uses bulk SQL updates for efficiency instead of individual queries
  router.patch('/sandwich-collections/fix-data-corruption', async (req, res) => {
  try {
    let fixedCount = 0;

    // Fix 1: Negative or null individual sandwich counts (bulk SQL update)
    const negativeSandwichResult = await db
      .update(sandwichCollections)
      .set({ individualSandwiches: 0 })
      .where(sql`${sandwichCollections.individualSandwiches} IS NULL OR ${sandwichCollections.individualSandwiches} < 0`);
    fixedCount += negativeSandwichResult.rowCount || 0;

    // Fix 2: Negative group1Count
    const negativeGroup1Result = await db
      .update(sandwichCollections)
      .set({ group1Count: 0 })
      .where(sql`${sandwichCollections.group1Count} < 0`);
    fixedCount += negativeGroup1Result.rowCount || 0;

    // Fix 3: Negative group2Count
    const negativeGroup2Result = await db
      .update(sandwichCollections)
      .set({ group2Count: 0 })
      .where(sql`${sandwichCollections.group2Count} < 0`);
    fixedCount += negativeGroup2Result.rowCount || 0;

    // Fix 4: Empty or whitespace-only hostNames (bulk update)
    const emptyHostResult = await db
      .update(sandwichCollections)
      .set({ hostName: 'Unknown Host' })
      .where(sql`${sandwichCollections.hostName} IS NULL OR TRIM(${sandwichCollections.hostName}) = ''`);
    fixedCount += emptyHostResult.rowCount || 0;

    // Fix 5: Process JSON validation in batches (can't do this in pure SQL easily)
    const BATCH_SIZE = 500;
    let offset = 0;
    let hasMore = true;
    const idsToFixJson: number[] = [];

    while (hasMore) {
      const batch = await db
        .select({ id: sandwichCollections.id, groupCollections: sandwichCollections.groupCollections })
        .from(sandwichCollections)
        .limit(BATCH_SIZE)
        .offset(offset);

      if (batch.length < BATCH_SIZE) {
        hasMore = false;
      }

      for (const collection of batch) {
        if (typeof collection.groupCollections === 'string') {
          try {
            JSON.parse(collection.groupCollections);
          } catch (e) {
            idsToFixJson.push(collection.id);
          }
        }
      }

      offset += BATCH_SIZE;
    }

    // Batch update malformed JSON records
    if (idsToFixJson.length > 0) {
      await db
        .update(sandwichCollections)
        .set({ groupCollections: [] })
        .where(inArray(sandwichCollections.id, idsToFixJson));
      fixedCount += idsToFixJson.length;
    }

    // Get total count for reporting
    const [totalResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(sandwichCollections);

    res.json({
      success: true,
      fixedCount,
      totalChecked: Number(totalResult?.count || 0),
      message: `Fixed ${fixedCount} data corruption issue(s)`
    });
  } catch (error) {
    logger.error('Fix data corruption failed:', error);
    res.status(500).json({ error: 'Failed to fix data corruption' });
  }
});

// ==========================================
// HOLDING ZONE BACKUP ENDPOINTS
// ==========================================

// Export all holding zone items with their categories, comments, likes, and assignments
// Note: For exports, we need all data but add a safety limit to prevent memory issues
const EXPORT_MAX_ITEMS = 10000;

router.get('/export/holding-zone', async (req: any, res) => {
  try {
    const { format = 'json' } = req.query;

    // Fetch data with safety limits for export
    const items = await db.select().from(teamBoardItems).orderBy(desc(teamBoardItems.createdAt)).limit(EXPORT_MAX_ITEMS);
    const categories = await db.select().from(holdingZoneCategories).limit(1000);
    const comments = await db.select().from(teamBoardComments).limit(EXPORT_MAX_ITEMS);
    const likes = await db.select().from(teamBoardItemLikes).limit(EXPORT_MAX_ITEMS);
    const assignments = await db.select().from(teamBoardAssignments).limit(EXPORT_MAX_ITEMS);

    const backup = {
      exportDate: new Date().toISOString(),
      version: '1.0',
      counts: {
        items: items.length,
        categories: categories.length,
        comments: comments.length,
        likes: likes.length,
        assignments: assignments.length,
      },
      data: {
        categories,
        items,
        comments,
        likes,
        assignments,
      },
    };

    if (format === 'csv') {
      // For CSV, only export items (main data)
      const csvHeaders = [
        'id', 'content', 'type', 'status', 'createdBy', 'createdByName',
        'categoryId', 'isUrgent', 'isPrivate', 'details', 'dueDate',
        'createdAt', 'completedAt'
      ];

      const csvRows = items.map(item => [
        item.id,
        `"${(item.content || '').replace(/"/g, '""')}"`,
        item.type,
        item.status,
        item.createdBy,
        `"${(item.createdByName || '').replace(/"/g, '""')}"`,
        item.categoryId || '',
        item.isUrgent ? 'true' : 'false',
        item.isPrivate ? 'true' : 'false',
        `"${(item.details || '').replace(/"/g, '""')}"`,
        item.dueDate || '',
        item.createdAt,
        item.completedAt || '',
      ].join(','));

      const csv = [csvHeaders.join(','), ...csvRows].join('\n');

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="holding_zone_backup_${new Date().toISOString().split('T')[0]}.csv"`);
      return res.send(csv);
    }

    // JSON format (default)
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="holding_zone_backup_${new Date().toISOString().split('T')[0]}.json"`);
    res.json(backup);
  } catch (error) {
    logger.error('Holding zone export failed:', error);
    res.status(500).json({ error: 'Holding zone export failed' });
  }
});

// Export just the holding zone categories
router.get('/export/holding-zone-categories', async (req, res) => {
  try {
    const categories = await db.select().from(holdingZoneCategories);

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="holding_zone_categories_${new Date().toISOString().split('T')[0]}.json"`);
    res.json({
      exportDate: new Date().toISOString(),
      count: categories.length,
      categories,
    });
  } catch (error) {
    logger.error('Holding zone categories export failed:', error);
    res.status(500).json({ error: 'Holding zone categories export failed' });
  }
});

// Import/restore holding zone items from backup
router.post('/import/holding-zone', async (req: any, res) => {
  try {
    const { data, options = {} } = req.body;
    const { replaceExisting = false, importCategories = true, importItems = true, importComments = true } = options;

    if (!data) {
      return res.status(400).json({ error: 'No backup data provided' });
    }

    const results = {
      categoriesImported: 0,
      itemsImported: 0,
      commentsImported: 0,
      likesImported: 0,
      assignmentsImported: 0,
      errors: [] as string[],
    };

    // Start a transaction-like approach
    try {
      // If replacing existing, clear current data first (in reverse dependency order)
      if (replaceExisting) {
        await db.delete(teamBoardItemLikes);
        await db.delete(teamBoardComments);
        await db.delete(teamBoardAssignments);
        await db.delete(teamBoardItems);
        await db.delete(holdingZoneCategories);
        logger.info('Cleared existing holding zone data for replacement');
      }

      // Import categories first (if they have foreign key relationships)
      if (importCategories && data.categories && data.categories.length > 0) {
        for (const cat of data.categories) {
          try {
            const categoryData: any = {
              name: cat.name,
              color: cat.color,
              description: cat.description,
            };
            if (replaceExisting && cat.id) {
              categoryData.id = cat.id;
            }
            await db.insert(holdingZoneCategories).values(categoryData).onConflictDoNothing();
            results.categoriesImported++;
          } catch (catError: any) {
            results.errors.push(`Category "${cat.name}": ${catError.message}`);
          }
        }
      }

      // Import items
      if (importItems && data.items && data.items.length > 0) {
        for (const item of data.items) {
          try {
            const itemData: any = {
              content: item.content,
              type: item.type || 'task',
              createdBy: item.createdBy,
              createdByName: item.createdByName,
              status: item.status || 'open',
              categoryId: item.categoryId,
              isUrgent: item.isUrgent || false,
              isPrivate: item.isPrivate || false,
              details: item.details,
              dueDate: item.dueDate,
              assignedTo: item.assignedTo,
              assignedToNames: item.assignedToNames,
              createdAt: item.createdAt ? new Date(item.createdAt) : new Date(),
              completedAt: item.completedAt ? new Date(item.completedAt) : null,
            };
            if (replaceExisting && item.id) {
              itemData.id = item.id;
            }
            await db.insert(teamBoardItems).values(itemData).onConflictDoNothing();
            results.itemsImported++;
          } catch (itemError: any) {
            results.errors.push(`Item #${item.id}: ${itemError.message}`);
          }
        }
      }

      // Import comments
      if (importComments && data.comments && data.comments.length > 0) {
        for (const comment of data.comments) {
          try {
            const commentData: any = {
              itemId: comment.itemId,
              userId: comment.userId,
              userName: comment.userName,
              content: comment.content,
              createdAt: comment.createdAt ? new Date(comment.createdAt) : new Date(),
            };
            if (replaceExisting && comment.id) {
              commentData.id = comment.id;
            }
            await db.insert(teamBoardComments).values(commentData).onConflictDoNothing();
            results.commentsImported++;
          } catch (commentError: any) {
            results.errors.push(`Comment #${comment.id}: ${commentError.message}`);
          }
        }
      }

      // Import likes
      if (data.likes && data.likes.length > 0) {
        for (const like of data.likes) {
          try {
            const likeData: any = {
              itemId: like.itemId,
              userId: like.userId,
              createdAt: like.createdAt ? new Date(like.createdAt) : new Date(),
            };
            if (replaceExisting && like.id) {
              likeData.id = like.id;
            }
            await db.insert(teamBoardItemLikes).values(likeData).onConflictDoNothing();
            results.likesImported++;
          } catch (likeError: any) {
            // Likes conflicts are common, don't report as errors
          }
        }
      }

      // Import assignments
      if (data.assignments && data.assignments.length > 0) {
        for (const assignment of data.assignments) {
          try {
            const assignData: any = {
              itemId: assignment.itemId,
              userId: assignment.userId,
              userName: assignment.userName,
              addedAt: assignment.addedAt ? new Date(assignment.addedAt) : new Date(),
            };
            if (replaceExisting && assignment.id) {
              assignData.id = assignment.id;
            }
            await db.insert(teamBoardAssignments).values(assignData).onConflictDoNothing();
            results.assignmentsImported++;
          } catch (assignError: any) {
            // Assignment conflicts are common, don't report as errors
          }
        }
      }

      logger.info('Holding zone import completed:', results);
      res.json({
        success: true,
        message: 'Holding zone data imported successfully',
        results,
      });
    } catch (importError: any) {
      logger.error('Import transaction failed:', importError);
      res.status(500).json({
        error: 'Import failed',
        message: importError.message,
        partialResults: results,
      });
    }
  } catch (error) {
    logger.error('Holding zone import failed:', error);
    res.status(500).json({ error: 'Holding zone import failed' });
  }
});

// Get holding zone backup summary/stats
router.get('/holding-zone-stats', async (req, res) => {
  try {
    const [itemsResult] = await db.select({ count: sql<number>`count(*)` }).from(teamBoardItems);
    const [categoriesResult] = await db.select({ count: sql<number>`count(*)` }).from(holdingZoneCategories);
    const [commentsResult] = await db.select({ count: sql<number>`count(*)` }).from(teamBoardComments);
    const [likesResult] = await db.select({ count: sql<number>`count(*)` }).from(teamBoardItemLikes);
    const [assignmentsResult] = await db.select({ count: sql<number>`count(*)` }).from(teamBoardAssignments);

    // Get items by status
    const openItems = await db.select({ count: sql<number>`count(*)` }).from(teamBoardItems).where(eq(teamBoardItems.status, 'open'));
    const doneItems = await db.select({ count: sql<number>`count(*)` }).from(teamBoardItems).where(eq(teamBoardItems.status, 'done'));

    // Get items by type
    const taskItems = await db.select({ count: sql<number>`count(*)` }).from(teamBoardItems).where(eq(teamBoardItems.type, 'task'));
    const noteItems = await db.select({ count: sql<number>`count(*)` }).from(teamBoardItems).where(eq(teamBoardItems.type, 'note'));
    const ideaItems = await db.select({ count: sql<number>`count(*)` }).from(teamBoardItems).where(eq(teamBoardItems.type, 'idea'));

    res.json({
      totalItems: Number(itemsResult?.count || 0),
      totalCategories: Number(categoriesResult?.count || 0),
      totalComments: Number(commentsResult?.count || 0),
      totalLikes: Number(likesResult?.count || 0),
      totalAssignments: Number(assignmentsResult?.count || 0),
      itemsByStatus: {
        open: Number(openItems[0]?.count || 0),
        done: Number(doneItems[0]?.count || 0),
      },
      itemsByType: {
        task: Number(taskItems[0]?.count || 0),
        note: Number(noteItems[0]?.count || 0),
        idea: Number(ideaItems[0]?.count || 0),
      },
    });
  } catch (error) {
    logger.error('Holding zone stats failed:', error);
    res.status(500).json({ error: 'Failed to get holding zone stats' });
  }
});

  return router;
}

