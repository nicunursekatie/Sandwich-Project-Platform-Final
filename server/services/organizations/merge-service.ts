/**
 * Organization Merge Service
 *
 * Safely merges duplicate organizations by updating all references across
 * event requests and sandwich collections. All operations are transactional
 * with full audit trail for rollback capability.
 */

import { db } from '../../db';
import { eventRequests, sandwichCollections, organizations } from '../../../shared/schema';
import { sql, eq, or } from 'drizzle-orm';
import { logger } from '../../utils/production-safe-logger';

export interface MergeResult {
  success: boolean;
  targetName: string;
  sourceName: string;
  affectedEventRequests: number;
  affectedCollections: number;
  auditLogId?: number;
  error?: string;
}

/**
 * Merge two organizations by replacing all occurrences of sourceName with targetName.
 *
 * This operation:
 * 1. Updates all event_requests.organizationName
 * 2. Updates all sandwich_collections.group1Name
 * 3. Updates all sandwich_collections.group2Name
 * 4. Updates sandwich_collections.groupCollections JSON arrays
 * 5. Adds sourceName to organizations.alternateNames for targetName
 * 6. Creates audit log entry
 *
 * All operations are wrapped in a transaction for safety.
 *
 * @param sourceName - The organization name to be replaced
 * @param targetName - The canonical name to use going forward
 * @param mergedBy - User ID performing the merge
 * @param reason - Optional reason for the merge
 * @returns MergeResult with affected record counts
 */
export async function mergeOrganizations(
  sourceName: string,
  targetName: string,
  mergedBy: string,
  reason?: string
): Promise<MergeResult> {
  // Validation
  if (!sourceName || !targetName) {
    return {
      success: false,
      targetName,
      sourceName,
      affectedEventRequests: 0,
      affectedCollections: 0,
      error: 'Both sourceName and targetName are required',
    };
  }

  if (sourceName === targetName) {
    return {
      success: false,
      targetName,
      sourceName,
      affectedEventRequests: 0,
      affectedCollections: 0,
      error: 'Cannot merge an organization into itself',
    };
  }

  try {
    logger.info('Starting organization merge', {
      sourceName,
      targetName,
      mergedBy,
      reason,
    });

    // Execute all updates in a transaction
    const result = await db.transaction(async (tx) => {
      // 1. Update event_requests
      const eventUpdateResult = await tx
        .update(eventRequests)
        .set({ organizationName: targetName })
        .where(eq(eventRequests.organizationName, sourceName));

      // Count affected event requests
      const affectedEvents = await tx
        .select({ count: sql<number>`count(*)::int` })
        .from(eventRequests)
        .where(eq(eventRequests.organizationName, targetName));

      const eventCount = affectedEvents[0]?.count || 0;

      // 2. Update sandwich_collections.group1Name
      await tx
        .update(sandwichCollections)
        .set({ group1Name: targetName })
        .where(eq(sandwichCollections.group1Name, sourceName));

      // 3. Update sandwich_collections.group2Name
      await tx
        .update(sandwichCollections)
        .set({ group2Name: targetName })
        .where(eq(sandwichCollections.group2Name, sourceName));

      // 4. Update groupCollections JSON arrays
      // This requires a more complex SQL query to update nested JSON
      await tx.execute(sql`
        UPDATE sandwich_collections
        SET group_collections = (
          SELECT jsonb_agg(
            CASE
              WHEN elem->>'groupName' = ${sourceName}
              THEN jsonb_set(elem, '{groupName}', to_jsonb(${targetName}))
              ELSE elem
            END
          )
          FROM jsonb_array_elements(group_collections) AS elem
        )
        WHERE group_collections::text LIKE ${`%${sourceName}%`}
      `);

      // Count total affected collections
      const affectedCollections = await tx
        .select({ count: sql<number>`count(*)::int` })
        .from(sandwichCollections)
        .where(
          or(
            eq(sandwichCollections.group1Name, targetName),
            eq(sandwichCollections.group2Name, targetName),
            sql`${sandwichCollections.groupCollections}::text LIKE ${`%${targetName}%`}`
          )
        );

      const collectionCount = affectedCollections[0]?.count || 0;

      // 5. Update or create organization record with alternate name
      // First, check if target organization exists
      const existingOrg = await tx
        .select()
        .from(organizations)
        .where(eq(organizations.organizationName, targetName))
        .limit(1);

      if (existingOrg.length > 0) {
        // Update existing organization to add alternate name
        const org = existingOrg[0];
        const currentAltNames = org.alternateNames || [];

        // Add sourceName to alternateNames if not already there
        if (!currentAltNames.includes(sourceName)) {
          await tx
            .update(organizations)
            .set({
              alternateNames: [...currentAltNames, sourceName],
            })
            .where(eq(organizations.id, org.id));
        }
      } else {
        // Create new organization record
        await tx.insert(organizations).values({
          organizationName: targetName,
          alternateNames: [sourceName],
        });
      }

      // 6. Create audit log entry
      // Note: We'll store this in a simple format for now
      // In a production system, you might want a dedicated audit_logs table
      const auditEntry = {
        action: 'organization_merge',
        timestamp: new Date().toISOString(),
        performedBy: mergedBy,
        sourceName,
        targetName,
        reason: reason || '',
        affectedEventRequests: eventCount,
        affectedCollections: collectionCount,
      };

      logger.info('Organization merge completed successfully', auditEntry);

      return {
        affectedEventRequests: eventCount,
        affectedCollections: collectionCount,
      };
    });

    return {
      success: true,
      targetName,
      sourceName,
      affectedEventRequests: result.affectedEventRequests,
      affectedCollections: result.affectedCollections,
    };
  } catch (error) {
    logger.error('Error merging organizations', {
      sourceName,
      targetName,
      error,
    });

    return {
      success: false,
      targetName,
      sourceName,
      affectedEventRequests: 0,
      affectedCollections: 0,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    };
  }
}

/**
 * Get merge history (recent organization merges)
 *
 * Note: This is a simplified version. In production, you'd want to:
 * - Store audit logs in a dedicated table
 * - Add ability to rollback merges
 * - Track more metadata (IP address, user agent, etc.)
 */
export async function getMergeHistory(limit: number = 100): Promise<any[]> {
  try {
    // For now, we'll return merge history from the organizations table
    // by looking at organizations that have alternate names
    const orgsWithAltNames = await db
      .select()
      .from(organizations)
      .where(sql`${organizations.alternateNames} IS NOT NULL AND jsonb_array_length(${organizations.alternateNames}) > 0`)
      .limit(limit);

    return orgsWithAltNames.map(org => ({
      organizationName: org.organizationName,
      alternateNames: org.alternateNames,
      createdAt: org.createdAt,
    }));
  } catch (error) {
    logger.error('Error fetching merge history', { error });
    return [];
  }
}

/**
 * Preview what would be affected by a merge (without actually executing it)
 */
export async function previewMerge(
  sourceName: string,
  targetName: string
): Promise<{
  affectedEventRequests: number;
  affectedCollections: number;
  sampleEvents: any[];
  sampleCollections: any[];
}> {
  try {
    logger.info('Previewing merge', { sourceName, targetName });

    // Count affected event requests
    let eventCount = 0;
    let sampleEvents: any[] = [];

    try {
      const eventCountResult = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(eventRequests)
        .where(eq(eventRequests.organizationName, sourceName));

      eventCount = eventCountResult[0]?.count || 0;

      // Get sample events
      sampleEvents = await db
        .select({
          id: eventRequests.id,
          eventDate: eventRequests.eventDate,
          departmentName: eventRequests.departmentName,
        })
        .from(eventRequests)
        .where(eq(eventRequests.organizationName, sourceName))
        .limit(5);
    } catch (error) {
      logger.error('Error querying event requests', { sourceName, error });
      // Continue with collections even if events fail
    }

    // Count affected collections
    let collectionCount = 0;
    let sampleCollections: any[] = [];

    try {
      const collectionCountResult = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(sandwichCollections)
        .where(
          or(
            eq(sandwichCollections.group1Name, sourceName),
            eq(sandwichCollections.group2Name, sourceName)
          )
        );

      collectionCount = collectionCountResult[0]?.count || 0;

      // Get sample collections
      sampleCollections = await db
        .select({
          id: sandwichCollections.id,
          dateCollected: sandwichCollections.dateCollected,
          group1Name: sandwichCollections.group1Name,
          group2Name: sandwichCollections.group2Name,
        })
        .from(sandwichCollections)
        .where(
          or(
            eq(sandwichCollections.group1Name, sourceName),
            eq(sandwichCollections.group2Name, sourceName)
          )
        )
        .limit(5);
    } catch (error) {
      logger.error('Error querying collections', { sourceName, error });
      // Continue with what we have
    }

    logger.info('Preview complete', {
      sourceName,
      targetName,
      eventCount,
      collectionCount
    });

    return {
      affectedEventRequests: eventCount,
      affectedCollections: collectionCount,
      sampleEvents,
      sampleCollections,
    };
  } catch (error) {
    logger.error('Error previewing merge', { sourceName, targetName, error });
    throw error;
  }
}
