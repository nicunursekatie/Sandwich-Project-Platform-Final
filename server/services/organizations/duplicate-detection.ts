/**
 * Organization Duplicate Detection Service
 *
 * Scans event requests and sandwich collections to find potential duplicate
 * organizations. Uses canonicalization and similarity scoring to identify
 * organizations that likely refer to the same entity.
 */

import { db } from '../../db';
import { eventRequests, sandwichCollections } from '../../../shared/schema';
import { sql } from 'drizzle-orm';
import { canonicalizeOrgName, calculateSimilarity } from '../../utils/organization-canonicalization';
import { logger } from '../../utils/production-safe-logger';

export interface DuplicatePair {
  /** First organization name */
  org1: {
    name: string;
    eventCount: number;
    collectionCount: number;
  };
  /** Second organization name */
  org2: {
    name: string;
    eventCount: number;
    collectionCount: number;
  };
  /** Similarity score between 0 and 1 */
  similarityScore: number;
  /** Canonical form used for grouping */
  canonicalName: string;
  /** Suggested action based on confidence */
  suggestedAction: 'merge' | 'review' | 'keep_separate';
}

interface OrganizationStats {
  name: string;
  canonicalName: string;
  eventCount: number;
  collectionCount: number;
}

/**
 * Find potential duplicate organizations across all data sources.
 *
 * Algorithm:
 * 1. Collect all unique organization names from event_requests
 * 2. Collect all unique names from sandwich_collections (group1Name, group2Name, and JSON arrays)
 * 3. Group by canonical name
 * 4. Within each canonical group, calculate pairwise similarity scores
 * 5. Return pairs above threshold, sorted by similarity score
 *
 * @param threshold - Minimum similarity score to consider a duplicate (default: 0.85)
 * @returns Array of potential duplicate pairs
 */
export async function findPotentialDuplicates(
  threshold: number = 0.85
): Promise<DuplicatePair[]> {
  try {
    logger.info('Starting duplicate organization detection', { threshold });

    // Step 1: Get all organization names with counts from event_requests
    const eventOrgs = await db
      .select({
        name: eventRequests.organizationName,
        count: sql<number>`count(*)::int`,
      })
      .from(eventRequests)
      .where(sql`${eventRequests.organizationName} IS NOT NULL AND ${eventRequests.organizationName} != ''`)
      .groupBy(eventRequests.organizationName);

    logger.info(`Found ${eventOrgs.length} unique organizations from event requests`);

    // Step 2: Get all organization names from sandwich_collections
    // This is more complex because org names appear in multiple fields and JSON arrays
    const collectionOrgs = await db
      .select({
        group1Name: sandwichCollections.group1Name,
        group2Name: sandwichCollections.group2Name,
        groupCollections: sandwichCollections.groupCollections,
      })
      .from(sandwichCollections);

    // Extract and count all unique organization names from collections
    const collectionOrgCounts = new Map<string, number>();

    for (const collection of collectionOrgs) {
      // Count group1Name
      if (collection.group1Name) {
        collectionOrgCounts.set(
          collection.group1Name,
          (collectionOrgCounts.get(collection.group1Name) || 0) + 1
        );
      }

      // Count group2Name
      if (collection.group2Name) {
        collectionOrgCounts.set(
          collection.group2Name,
          (collectionOrgCounts.get(collection.group2Name) || 0) + 1
        );
      }

      // Count organizations in groupCollections JSON array
      // Note: The JSON stores "name" field (not "groupName" - that's only used in client display)
      if (collection.groupCollections && Array.isArray(collection.groupCollections)) {
        for (const groupItem of collection.groupCollections) {
          if (groupItem && typeof groupItem === 'object' && 'name' in groupItem) {
            const groupName = (groupItem as any).name as string;
            if (groupName) {
              collectionOrgCounts.set(
                groupName,
                (collectionOrgCounts.get(groupName) || 0) + 1
              );
            }
          }
        }
      }
    }

    logger.info(`Found ${collectionOrgCounts.size} unique organizations from collections`);

    // Step 3: Combine all organization names with their counts
    const allOrgs: OrganizationStats[] = [];

    // Add organizations from events
    for (const eventOrg of eventOrgs) {
      if (!eventOrg.name) continue;

      allOrgs.push({
        name: eventOrg.name,
        canonicalName: canonicalizeOrgName(eventOrg.name),
        eventCount: eventOrg.count,
        collectionCount: collectionOrgCounts.get(eventOrg.name) || 0,
      });
    }

    // Add organizations that only appear in collections (not in events)
    for (const [orgName, count] of collectionOrgCounts.entries()) {
      // Skip if already added from events
      if (eventOrgs.some(e => e.name === orgName)) continue;

      allOrgs.push({
        name: orgName,
        canonicalName: canonicalizeOrgName(orgName),
        eventCount: 0,
        collectionCount: count,
      });
    }

    logger.info(`Total unique organizations: ${allOrgs.length}`);

    // Step 4: Group by canonical name
    const canonicalGroups = new Map<string, OrganizationStats[]>();

    for (const org of allOrgs) {
      if (!org.canonicalName) continue;

      if (!canonicalGroups.has(org.canonicalName)) {
        canonicalGroups.set(org.canonicalName, []);
      }
      canonicalGroups.get(org.canonicalName)!.push(org);
    }

    logger.info(`Grouped into ${canonicalGroups.size} canonical groups`);

    // Step 5: Find duplicates within each canonical group
    const duplicatePairs: DuplicatePair[] = [];

    for (const [canonicalName, orgs] of canonicalGroups.entries()) {
      // Skip groups with only one organization
      if (orgs.length < 2) continue;

      // Calculate pairwise similarity scores
      for (let i = 0; i < orgs.length; i++) {
        for (let j = i + 1; j < orgs.length; j++) {
          const org1 = orgs[i];
          const org2 = orgs[j];

          // Skip if same name
          if (org1.name === org2.name) continue;

          const similarity = calculateSimilarity(org1.name, org2.name);

          // Only include pairs above threshold
          if (similarity >= threshold) {
            duplicatePairs.push({
              org1: {
                name: org1.name,
                eventCount: org1.eventCount,
                collectionCount: org1.collectionCount,
              },
              org2: {
                name: org2.name,
                eventCount: org2.eventCount,
                collectionCount: org2.collectionCount,
              },
              similarityScore: similarity,
              canonicalName,
              suggestedAction: getSuggestedAction(similarity),
            });
          }
        }
      }
    }

    // Step 6: Sort by similarity score (highest first)
    duplicatePairs.sort((a, b) => b.similarityScore - a.similarityScore);

    logger.info(`Found ${duplicatePairs.length} potential duplicate pairs`);

    return duplicatePairs;
  } catch (error) {
    logger.error('Error finding duplicate organizations', { error });
    throw error;
  }
}

/**
 * Determine suggested action based on similarity score
 */
function getSuggestedAction(similarity: number): 'merge' | 'review' | 'keep_separate' {
  if (similarity >= 0.95) {
    return 'merge'; // Very high confidence - likely same organization
  } else if (similarity >= 0.85) {
    return 'review'; // Moderate confidence - needs human review
  } else {
    return 'keep_separate'; // Low confidence - probably different organizations
  }
}

/**
 * Get detailed statistics about a specific organization
 * (useful for showing in the merge preview)
 */
export async function getOrganizationDetails(orgName: string) {
  try {
    // Get event request count and recent events
    const events = await db
      .select({
        id: eventRequests.id,
        eventDate: eventRequests.eventDate,
        departmentName: eventRequests.departmentName,
      })
      .from(eventRequests)
      .where(sql`${eventRequests.organizationName} = ${orgName}`)
      .orderBy(sql`${eventRequests.eventDate} DESC`)
      .limit(5);

    // Get collection count
    const collections = await db
      .select({
        id: sandwichCollections.id,
        dateCollected: sandwichCollections.dateCollected,
      })
      .from(sandwichCollections)
      .where(
        sql`${sandwichCollections.group1Name} = ${orgName} OR ${sandwichCollections.group2Name} = ${orgName}`
      )
      .orderBy(sql`${sandwichCollections.dateCollected} DESC`)
      .limit(5);

    return {
      name: orgName,
      canonicalName: canonicalizeOrgName(orgName),
      eventCount: events.length,
      collectionCount: collections.length,
      recentEvents: events,
      recentCollections: collections,
    };
  } catch (error) {
    logger.error('Error getting organization details', { orgName, error });
    throw error;
  }
}

/**
 * Check if an organization is returning (has past events or exists in catalog)
 *
 * This is used to flag new requests from organizations that have worked with us before,
 * so the intake team can personalize their outreach instead of sending generic first-time emails.
 *
 * @param orgName - Organization name to check
 * @param currentEventId - Optional current event request ID to exclude from counts
 * @returns Object with returning status, past event count, and most recent event info
 */
export async function checkReturningOrganization(
  orgName: string,
  currentEventId?: number
): Promise<{
  isReturning: boolean;
  inCatalog: boolean;
  pastEventCount: number;
  collectionCount: number;
  mostRecentEvent?: {
    id: number;
    eventDate: Date | null;
    status: string | null;
  };
  mostRecentCollection?: {
    id: number;
    dateCollected: Date | null;
  };
  similarNames?: string[];
}> {
  try {
    // Validate input
    if (!orgName || typeof orgName !== 'string' || orgName.trim().length === 0) {
      return {
        isReturning: false,
        inCatalog: false,
        pastEventCount: 0,
        collectionCount: 0,
      };
    }

    const canonicalName = canonicalizeOrgName(orgName);
    if (!canonicalName) {
      return {
        isReturning: false,
        inCatalog: false,
        pastEventCount: 0,
        collectionCount: 0,
      };
    }

    // Check for exact matches and similar names in past events
    // Exclude the current event request if provided
    // Limit results for performance - we only need to detect if there are past events
    const eventCondition = currentEventId
      ? sql`${eventRequests.organizationName} IS NOT NULL
            AND ${eventRequests.organizationName} != ''
            AND ${eventRequests.id} != ${currentEventId}`
      : sql`${eventRequests.organizationName} IS NOT NULL
            AND ${eventRequests.organizationName} != ''`;

    const pastEvents = await db
      .select({
        id: eventRequests.id,
        organizationName: eventRequests.organizationName,
        desiredEventDate: eventRequests.desiredEventDate,
        scheduledEventDate: eventRequests.scheduledEventDate,
        status: eventRequests.status,
      })
      .from(eventRequests)
      .where(eventCondition)
      .orderBy(sql`COALESCE(${eventRequests.scheduledEventDate}, ${eventRequests.desiredEventDate}) DESC`)
      .limit(500); // Limit to prevent performance issues

    // Find events with matching or similar organization names
    const matchingEvents: typeof pastEvents = [];
    const similarNames = new Set<string>();

    for (const event of pastEvents) {
      if (!event.organizationName) continue;

      const eventCanonical = canonicalizeOrgName(event.organizationName);
      const similarity = calculateSimilarity(canonicalName, eventCanonical);

      // Include exact matches and high similarity matches (>0.85)
      if (similarity > 0.85 || event.organizationName.toLowerCase() === orgName.toLowerCase()) {
        matchingEvents.push(event);
        if (event.organizationName.toLowerCase() !== orgName.toLowerCase()) {
          similarNames.add(event.organizationName);
        }
      }
    }

    // Check sandwich collections for matching organization
    // Limit to recent collections for performance
    const collections = await db
      .select({
        id: sandwichCollections.id,
        dateCollected: sandwichCollections.dateCollected,
        group1Name: sandwichCollections.group1Name,
        group2Name: sandwichCollections.group2Name,
      })
      .from(sandwichCollections)
      .orderBy(sql`${sandwichCollections.dateCollected} DESC`)
      .limit(500);

    // Find collections with matching organization names
    const matchingCollections: typeof collections = [];

    for (const collection of collections) {
      const group1Canonical = collection.group1Name ? canonicalizeOrgName(collection.group1Name) : '';
      const group2Canonical = collection.group2Name ? canonicalizeOrgName(collection.group2Name) : '';

      const similarity1 = group1Canonical ? calculateSimilarity(canonicalName, group1Canonical) : 0;
      const similarity2 = group2Canonical ? calculateSimilarity(canonicalName, group2Canonical) : 0;

      if (similarity1 > 0.85 || similarity2 > 0.85 ||
          (collection.group1Name && collection.group1Name.toLowerCase() === orgName.toLowerCase()) ||
          (collection.group2Name && collection.group2Name.toLowerCase() === orgName.toLowerCase())) {
        matchingCollections.push(collection);
        if (collection.group1Name && collection.group1Name.toLowerCase() !== orgName.toLowerCase() && similarity1 > 0.85) {
          similarNames.add(collection.group1Name);
        }
        if (collection.group2Name && collection.group2Name.toLowerCase() !== orgName.toLowerCase() && similarity2 > 0.85) {
          similarNames.add(collection.group2Name);
        }
      }
    }

    const isReturning = matchingEvents.length > 0 || matchingCollections.length > 0;
    const mostRecentEvent = matchingEvents[0];
    const mostRecentCollection = matchingCollections[0];

    return {
      isReturning,
      inCatalog: false, // TODO: Check organizations table when properly implemented
      pastEventCount: matchingEvents.length,
      collectionCount: matchingCollections.length,
      mostRecentEvent: mostRecentEvent ? {
        id: mostRecentEvent.id,
        eventDate: mostRecentEvent.scheduledEventDate || mostRecentEvent.desiredEventDate,
        status: mostRecentEvent.status,
      } : undefined,
      mostRecentCollection: mostRecentCollection ? {
        id: mostRecentCollection.id,
        dateCollected: mostRecentCollection.dateCollected,
      } : undefined,
      similarNames: similarNames.size > 0 ? Array.from(similarNames).slice(0, 5) : undefined,
    };
  } catch (error) {
    logger.error('Error checking returning organization', { orgName, currentEventId, error });
    throw error;
  }
}
