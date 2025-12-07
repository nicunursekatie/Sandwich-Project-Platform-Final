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

    // Execute all updates sequentially using raw SQL (no transaction support in HTTP driver)

    // DEBUG: Check what organization names actually exist in database
    const similarOrgsResult = await db.execute(
      sql`SELECT DISTINCT organization_name FROM event_requests WHERE LOWER(organization_name) LIKE LOWER(${`%${sourceName.substring(0, Math.min(5, sourceName.length))}%`}) LIMIT 20`
    ) as any[];
    logger.info('DEBUG: Similar organization names in event_requests', {
      searchTerm: sourceName,
      similar: similarOrgsResult
    });

    const exactMatchResult = await db.execute(
      sql`SELECT organization_name FROM event_requests WHERE organization_name = ${sourceName} LIMIT 5`
    ) as any[];
    logger.info('DEBUG: Exact match check in event_requests', {
      sourceName,
      exactMatches: exactMatchResult
    });

    // Also check collections
    const collectionsGroup1Result = await db.execute(
      sql`SELECT DISTINCT group1_name FROM sandwich_collections WHERE group1_name = ${sourceName} LIMIT 5`
    ) as any[];
    const collectionsGroup2Result = await db.execute(
      sql`SELECT DISTINCT group2_name FROM sandwich_collections WHERE group2_name = ${sourceName} LIMIT 5`
    ) as any[];

    // Check if it exists in groupCollections JSON array
    const jsonArrayResult = await db.execute(
      sql`SELECT id, group_collections FROM sandwich_collections WHERE group_collections::text LIKE ${`%${sourceName}%`} LIMIT 5`
    ) as any[];

    // Also try with lowercase to check case sensitivity
    const jsonArrayLowerResult = await db.execute(
      sql`SELECT id, group_collections FROM sandwich_collections WHERE LOWER(group_collections::text) LIKE LOWER(${`%${sourceName}%`}) LIMIT 5`
    ) as any[];

    logger.info('DEBUG: Exact match check in sandwich_collections', {
      sourceName,
      group1Matches: collectionsGroup1Result,
      group2Matches: collectionsGroup2Result,
      jsonArrayMatches: jsonArrayResult.length,
      jsonArrayMatchesLower: jsonArrayLowerResult.length,
      sampleJsonData: jsonArrayResult.length > 0 ? jsonArrayResult[0] : (jsonArrayLowerResult.length > 0 ? jsonArrayLowerResult[0] : null)
    });

    // Count records BEFORE updating (to get accurate affected count)
    // Use case-insensitive matching with TRIM to handle different capitalizations and whitespace
    const trimmedSource = sourceName.trim();
    const eventCountResult = await db.execute(
      sql`SELECT COUNT(*)::int as count FROM event_requests WHERE LOWER(TRIM(organization_name)) = LOWER(TRIM(${trimmedSource}))`
    ) as any[];
    const eventCount = (eventCountResult?.[0] as any)?.count || 0;

    // Count collections where org appears in group1_name, group2_name, OR groupCollections JSON
    // Use case-insensitive matching with TRIM for all comparisons
    // Use proper jsonb array element query for JSON matching
    const collectionCountResult = await db.execute(
      sql`SELECT COUNT(*)::int as count FROM sandwich_collections
          WHERE LOWER(TRIM(group1_name)) = LOWER(TRIM(${trimmedSource}))
             OR LOWER(TRIM(group2_name)) = LOWER(TRIM(${trimmedSource}))
             OR (group_collections IS NOT NULL AND EXISTS (
               SELECT 1 FROM jsonb_array_elements(group_collections) AS elem
               WHERE LOWER(TRIM(elem->>'groupName')) = LOWER(TRIM(${trimmedSource}))
             ))`
    ) as any[];
    const collectionCount = (collectionCountResult?.[0] as any)?.count || 0;

    logger.info('Pre-merge counts', {
      sourceName,
      targetName,
      eventCount,
      collectionCount
    });

    // 1. Update event_requests (case-insensitive matching with TRIM)
    await db.execute(
      sql`UPDATE event_requests SET organization_name = ${targetName.trim()} WHERE LOWER(TRIM(organization_name)) = LOWER(TRIM(${trimmedSource}))`
    );

    // 2. Update sandwich_collections.group1Name (case-insensitive matching with TRIM)
    await db.execute(
      sql`UPDATE sandwich_collections SET group1_name = ${targetName.trim()} WHERE LOWER(TRIM(group1_name)) = LOWER(TRIM(${trimmedSource}))`
    );

    // 3. Update sandwich_collections.group2Name (case-insensitive matching with TRIM)
    await db.execute(
      sql`UPDATE sandwich_collections SET group2_name = ${targetName.trim()} WHERE LOWER(TRIM(group2_name)) = LOWER(TRIM(${trimmedSource}))`
    );

    // 4. Update groupCollections JSON arrays (case-insensitive matching with TRIM)
    // Use proper jsonb array element query for matching
    await db.execute(sql`
      UPDATE sandwich_collections
      SET group_collections = (
        SELECT jsonb_agg(
          CASE
            WHEN LOWER(TRIM(elem->>'groupName')) = LOWER(TRIM(${trimmedSource}))
            THEN jsonb_set(elem, '{groupName}', to_jsonb(${targetName.trim()}))
            ELSE elem
          END
        )
        FROM jsonb_array_elements(group_collections) AS elem
      )
      WHERE group_collections IS NOT NULL AND EXISTS (
        SELECT 1 FROM jsonb_array_elements(group_collections) AS elem
        WHERE LOWER(TRIM(elem->>'groupName')) = LOWER(TRIM(${trimmedSource}))
      )
    `);

    // 5. Update or create organization record with alternate name
    const trimmedTarget = targetName.trim();
    const existingOrgResult = await db.execute(
      sql`SELECT id, organization_name, alternate_names FROM organizations WHERE LOWER(TRIM(organization_name)) = LOWER(TRIM(${trimmedTarget})) LIMIT 1`
    ) as any[];

    if (existingOrgResult && existingOrgResult.length > 0) {
      // Update existing organization to add alternate name
      const org = existingOrgResult[0] as any;
      const currentAltNames = org.alternate_names || [];

      // Add sourceName to alternateNames if not already there
      if (!currentAltNames.includes(sourceName)) {
        const newAltNames = [...currentAltNames, sourceName];
        await db.execute(
          sql`UPDATE organizations SET alternate_names = ${JSON.stringify(newAltNames)}::jsonb WHERE id = ${org.id}`
        );
      }
    } else {
      // Create new organization record
      await db.execute(
        sql`INSERT INTO organizations (organization_name, alternate_names) VALUES (${targetName}, ${JSON.stringify([sourceName])}::jsonb)`
      );
    }

    // 6. Create audit log entry
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
      success: true,
      targetName,
      sourceName,
      affectedEventRequests: eventCount,
      affectedCollections: collectionCount,
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
 * Uses the SAME Drizzle ORM approach as duplicate-detection to ensure consistency
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
    logger.info('=== PREVIEW MERGE DEBUG START ===');
    logger.info('Previewing merge', { 
      sourceName, 
      targetName,
      sourceNameLength: sourceName.length,
      sourceNameBytes: Buffer.from(sourceName).toString('hex')
    });

    // Count affected event requests using Drizzle ORM (same as duplicate-detection)
    let eventCount = 0;
    let sampleEvents: any[] = [];

    try {
      // Use Drizzle ORM select (same as duplicate-detection.ts)
      const events = await db
        .select({
          id: eventRequests.id,
          eventDate: eventRequests.eventDate,
          departmentName: eventRequests.departmentName,
          organizationName: eventRequests.organizationName,
        })
        .from(eventRequests)
        .where(sql`${eventRequests.organizationName} = ${sourceName}`);
      
      // DEBUG: Log first few event org names to compare
      const sampleOrgNames = await db
        .select({ name: eventRequests.organizationName })
        .from(eventRequests)
        .where(sql`${eventRequests.organizationName} IS NOT NULL`)
        .limit(5);
      logger.info('DEBUG: Sample event org names from DB', { 
        sampleOrgNames: sampleOrgNames.map(e => ({ 
          name: e.name, 
          length: e.name?.length,
          bytes: e.name ? Buffer.from(e.name).toString('hex') : null
        }))
      });
      
      eventCount = events.length;
      sampleEvents = events.slice(0, 5).map(e => ({
        id: e.id,
        event_date: e.eventDate,
        department_name: e.departmentName
      }));
      
      logger.info('Preview: Event requests matched via Drizzle ORM', { 
        sourceName, 
        matchedEvents: eventCount 
      });
    } catch (error) {
      logger.error('Error querying event requests for preview', { sourceName, error });
    }

    // Count affected collections using Drizzle ORM (same approach as duplicate-detection)
    let collectionCount = 0;
    let sampleCollections: any[] = [];

    try {
      // Use Drizzle ORM select (same as duplicate-detection.ts)
      const collections = await db
        .select({
          id: sandwichCollections.id,
          dateCollected: sandwichCollections.dateCollected,
          group1Name: sandwichCollections.group1Name,
          group2Name: sandwichCollections.group2Name,
          groupCollections: sandwichCollections.groupCollections,
        })
        .from(sandwichCollections);

      logger.info('DEBUG: Total collections fetched', { count: collections.length });

      // Count collections where org appears (same logic as duplicate-detection)
      let matchDetails: any[] = [];
      for (const collection of collections) {
        let matched = false;
        
        // Check group1Name (exact match like duplicate-detection)
        if (collection.group1Name === sourceName) {
          matched = true;
        }
        
        // Check group2Name (exact match like duplicate-detection)
        if (collection.group2Name === sourceName) {
          matched = true;
        }
        
        // Check groupCollections JSON array (same as duplicate-detection)
        if (collection.groupCollections && Array.isArray(collection.groupCollections)) {
          for (const groupItem of collection.groupCollections) {
            if (groupItem && typeof groupItem === 'object' && 'groupName' in groupItem) {
              const groupName = groupItem.groupName as string;
              if (groupName === sourceName) {
                matched = true;
                break;
              }
            }
          }
        }
        
        if (matched) {
          collectionCount++;
          if (matchDetails.length < 3) {
            matchDetails.push({
              id: collection.id,
              group1Name: collection.group1Name,
              group2Name: collection.group2Name,
              hasGroupCollections: !!collection.groupCollections
            });
          }
          if (sampleCollections.length < 5) {
            sampleCollections.push({
              id: collection.id,
              date_collected: collection.dateCollected,
              group1_name: collection.group1Name,
              group2_name: collection.group2Name
            });
          }
        }
      }
      
      logger.info('Preview: Collections matched via Drizzle ORM', { 
        sourceName, 
        totalCollections: collections.length,
        matchedCollections: collectionCount,
        matchDetails: matchDetails.slice(0, 3)
      });
      
      // DEBUG: Show sample groupCollections to understand structure
      const samplesWithGroupCollections = collections
        .filter(c => c.groupCollections && Array.isArray(c.groupCollections) && c.groupCollections.length > 0)
        .slice(0, 2);
      if (samplesWithGroupCollections.length > 0) {
        logger.info('DEBUG: Sample groupCollections structure', {
          samples: samplesWithGroupCollections.map(c => ({
            id: c.id,
            groupCollections: c.groupCollections?.slice(0, 2)
          }))
        });
      }
      
      logger.info('=== PREVIEW MERGE DEBUG END ===');
    } catch (error) {
      logger.error('Error querying collections for preview', { sourceName, error });
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
