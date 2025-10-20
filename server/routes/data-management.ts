import { Router } from 'express';
import { DataExporter } from '../data-export';
import { BulkOperationsManager } from '../bulk-operations';
import { AuditLogger } from '../audit-logger';
import { z } from 'zod';
import { PERMISSIONS } from '@shared/auth-utils';
import { requirePermission } from '../middleware/auth';
import { db } from '../db';
import { sandwichCollections, hosts } from '@shared/schema';
import { sql, eq, desc } from 'drizzle-orm';

const router = Router();

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
      console.error('Export failed:', error);
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
      console.error('Export failed:', error);
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
    console.error('Full export failed:', error);
    res.status(500).json({ error: 'Full export failed' });
  }
});

router.get('/summary', async (req, res) => {
  try {
    const summary = await DataExporter.getDataSummary();
    res.json(summary);
  } catch (error) {
    console.error('Summary failed:', error);
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
      console.error('Deduplication failed:', error);
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
      console.error('Bulk deletion failed:', error);
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
    console.error('Integrity check failed:', error);
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
    console.error('Audit history failed:', error);
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
    console.error('Collection stats failed:', error);
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
    console.error('Host mapping stats failed:', error);
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
    console.error('Get collections by host failed:', error);
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
    console.error('Bulk map hosts failed:', error);
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
    console.error('Fix data corruption failed:', error);
    res.status(500).json({ error: 'Failed to fix data corruption' });
  }
});

export default router;
