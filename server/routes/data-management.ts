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

// Collection statistics endpoint
  router.get('/collection-stats', async (req, res) => {
  try {
    const allCollections = await db.select().from(sandwichCollections);
    const allHosts = await db.select({ name: hosts.name }).from(hosts);
    
    const hostNames = new Set(allHosts.map(h => h.name.toLowerCase().trim()));
    
    const mappedRecords = allCollections.filter(c => 
      hostNames.has(c.hostName.toLowerCase().trim())
    );
    
    const unmappedRecords = allCollections.filter(c => 
      !hostNames.has(c.hostName.toLowerCase().trim())
    );
    
    res.json({
      totalRecords: allCollections.length,
      mappedRecords: mappedRecords.length,
      unmappedRecords: unmappedRecords.length,
    });
  } catch (error) {
    logger.error('Collection stats failed:', error);
    res.status(500).json({ error: 'Failed to get collection stats' });
  }
});

// Host mapping distribution statistics
  router.get('/host-mapping-stats', async (req, res) => {
  try {
    const allCollections = await db.select().from(sandwichCollections);
    const allHosts = await db.select({ name: hosts.name }).from(hosts);
    
    const hostNames = new Set(allHosts.map(h => h.name.toLowerCase().trim()));
    
    // Group collections by hostName and count
    const hostDistribution: Record<string, { count: number; mapped: boolean }> = {};
    
    allCollections.forEach(collection => {
      const hostName = collection.hostName;
      if (!hostDistribution[hostName]) {
        hostDistribution[hostName] = {
          count: 0,
          mapped: hostNames.has(hostName.toLowerCase().trim())
        };
      }
      hostDistribution[hostName].count++;
    });
    
    // Convert to array and sort by count
    const distribution = Object.entries(hostDistribution)
      .map(([name, data]) => ({
        hostName: name,
        count: data.count,
        mapped: data.mapped
      }))
      .sort((a, b) => b.count - a.count);
    
    res.json(distribution);
  } catch (error) {
    logger.error('Host mapping stats failed:', error);
    res.status(500).json({ error: 'Failed to get host mapping stats' });
  }
});

// Get collections by specific host
  router.get('/collections-by-host/:host', async (req, res) => {
  try {
    const { host } = req.params;
    
    const collections = await db
      .select()
      .from(sandwichCollections)
      .where(eq(sandwichCollections.hostName, host))
      .orderBy(desc(sandwichCollections.collectionDate));
    
    res.json(collections);
  } catch (error) {
    logger.error('Get collections by host failed:', error);
    res.status(500).json({ error: 'Failed to get collections for host' });
  }
});

// Bulk map hosts - attempt to match collection hostNames to hosts table
  router.post('/bulk-map-hosts', async (req, res) => {
  try {
    const allCollections = await db.select().from(sandwichCollections);
    const allHosts = await db.select().from(hosts);
    
    // Create mapping of lowercase host names to actual host names
    const hostMapping = new Map<string, string>();
    allHosts.forEach(host => {
      hostMapping.set(host.name.toLowerCase().trim(), host.name);
    });
    
    let updatedRecords = 0;
    
    // Update collections where hostName doesn't match exactly but matches case-insensitively
    for (const collection of allCollections) {
      const lowerHostName = collection.hostName.toLowerCase().trim();
      const matchedHostName = hostMapping.get(lowerHostName);
      
      if (matchedHostName && matchedHostName !== collection.hostName) {
        await db
          .update(sandwichCollections)
          .set({ hostName: matchedHostName })
          .where(eq(sandwichCollections.id, collection.id));
        
        updatedRecords++;
      }
    }
    
    res.json({
      success: true,
      updatedRecords,
      message: `Successfully standardized ${updatedRecords} host name(s) to match the hosts directory`
    });
  } catch (error) {
    logger.error('Bulk map hosts failed:', error);
    res.status(500).json({ error: 'Failed to map hosts' });
  }
});

// Fix data corruption in sandwich collections
  router.patch('/sandwich-collections/fix-data-corruption', async (req, res) => {
  try {
    const allCollections = await db.select().from(sandwichCollections);
    
    let fixedCount = 0;
    
    for (const collection of allCollections) {
      let needsUpdate = false;
      const updates: any = {};
      
      // Fix null or negative sandwich counts
      if (collection.individualSandwiches === null || collection.individualSandwiches < 0) {
        updates.individualSandwiches = 0;
        needsUpdate = true;
      }
      
      // Fix null group counts
      if (collection.group1Count !== null && collection.group1Count < 0) {
        updates.group1Count = 0;
        needsUpdate = true;
      }
      
      if (collection.group2Count !== null && collection.group2Count < 0) {
        updates.group2Count = 0;
        needsUpdate = true;
      }
      
      // Fix empty or whitespace-only hostNames
      if (!collection.hostName || collection.hostName.trim() === '') {
        updates.hostName = 'Unknown Host';
        needsUpdate = true;
      }
      
      // Fix invalid dates
      if (collection.collectionDate && isNaN(Date.parse(collection.collectionDate))) {
        // If date is invalid, set to creation date or current date
        updates.collectionDate = new Date().toISOString().split('T')[0];
        needsUpdate = true;
      }
      
      // Fix malformed groupCollections JSON
      try {
        if (typeof collection.groupCollections === 'string') {
          JSON.parse(collection.groupCollections);
        }
      } catch (e) {
        updates.groupCollections = [];
        needsUpdate = true;
      }
      
      if (needsUpdate) {
        await db
          .update(sandwichCollections)
          .set(updates)
          .where(eq(sandwichCollections.id, collection.id));
        
        fixedCount++;
      }
    }
    
    res.json({
      success: true,
      fixedCount,
      totalChecked: allCollections.length,
      message: `Fixed ${fixedCount} data corruption issue(s) out of ${allCollections.length} records checked`
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
router.get('/export/holding-zone', async (req: any, res) => {
  try {
    const { format = 'json' } = req.query;

    // Fetch all data
    const items = await db.select().from(teamBoardItems).orderBy(desc(teamBoardItems.createdAt));
    const categories = await db.select().from(holdingZoneCategories);
    const comments = await db.select().from(teamBoardComments);
    const likes = await db.select().from(teamBoardItemLikes);
    const assignments = await db.select().from(teamBoardAssignments);

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

