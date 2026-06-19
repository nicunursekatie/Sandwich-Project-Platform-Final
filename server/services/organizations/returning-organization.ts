/**
 * Organization Services
 *
 * Contains functions for:
 * 1. Returning Organization Detection - Identifies organizations that have worked with TSP before
 *    so intake team can personalize outreach (checkReturningOrganization)
 * 2. Duplicate Organization Detection - Finds potential duplicate org entries in the database
 *    for admin merging/cleanup (findPotentialDuplicates, getOrganizationDetails)
 */

import { db } from '../../db';
import { eventRequests, sandwichCollections } from '../../../shared/schema';
import { sql } from 'drizzle-orm';
import { canonicalizeOrgName, calculateSimilarity, organizationNamesMatch } from '../../utils/organization-canonicalization';
import { logger } from '../../utils/production-safe-logger';
import { getEffectiveEventDate } from '../../../shared/event-validation-utils';

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
        dateCollected: sandwichCollections.collectionDate,
      })
      .from(sandwichCollections)
      .where(
        sql`${sandwichCollections.group1Name} = ${orgName} OR ${sandwichCollections.group2Name} = ${orgName}`
      )
      .orderBy(sql`${sandwichCollections.collectionDate} DESC`)
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
 * Umbrella organization keywords — orgs that have many local chapters/troops/packs.
 * When the org name matches one of these but has NO distinguishing identifier (number),
 * we require a contact match to flag as "returning." Otherwise a generic "Girl Scouts"
 * entry would incorrectly match every other "Girl Scouts" entry regardless of troop.
 *
 * If the name DOES include a number (e.g. "Girl Scout Troop 25126"), exact matching
 * already ensures only the same troop matches, so it's treated normally.
 */
const UMBRELLA_ORG_KEYWORDS = [
  'girl scout',
  'boy scout',
  'cub scout',
  'eagle scout',
  'brownie',
  'daisy troop',
  'jack and jill',   // & is already normalized to 'and'
  'jack & jill',
  'lions club',
  'rotary club',
  'kiwanis',
  'elks lodge',
  'vfw',
  'moose lodge',
  'knights of columbus',
  'church of jesus christ',        // LDS / Latter-day Saints
  'latter day saints',
  'latter-day saints',
];

/**
 * Check whether an org name is a generic umbrella org without a distinguishing
 * identifier (troop number, pack number, lodge number, etc.).
 * If true, we should only flag it as "returning" when the contact also matches.
 */
function isGenericUmbrellaOrg(orgName: string): boolean {
  const normalized = orgName.trim().toLowerCase().replace(/&/g, 'and');

  const matchesUmbrella = UMBRELLA_ORG_KEYWORDS.some(kw => normalized.includes(kw));
  if (!matchesUmbrella) return false;

  // If the name contains a number, it likely has a troop/pack/lodge/chapter identifier
  // e.g. "Girl Scout Troop 25126", "Cub Scout Pack 100", "Elks Lodge 1234"
  const hasNumber = /\d+/.test(normalized);
  return !hasNumber;
}

/**
 * Check if an org name contains any umbrella org keywords (with or without number).
 * Unlike isGenericUmbrellaOrg, this returns true for ALL umbrella orgs including
 * those with specific identifiers like "Cub Scout Pack 100".
 */
function isUmbrellaRelated(orgName: string): boolean {
  const normalized = orgName.trim().toLowerCase().replace(/&/g, 'and');
  return UMBRELLA_ORG_KEYWORDS.some(kw => normalized.includes(kw));
}

/**
 * Extract identifier numbers from an umbrella org name.
 * e.g. "Cub Scout Pack 100" → ["100"], "Girl Scout Troop 25126" → ["25126"],
 * "Girl Scouts" → []
 */
function extractUmbrellaIdentifiers(orgName: string): string[] {
  return orgName.trim().match(/\d+/g) || [];
}

/**
 * Check if two umbrella org names refer to the same specific chapter/troop/pack.
 * Returns true only if both have the same identifier numbers, or both are generic (no numbers).
 * Returns false if one has a number and the other doesn't, or if numbers differ.
 */
function umbrellaIdentifiersMatch(orgName1: string, orgName2: string): boolean {
  const ids1 = extractUmbrellaIdentifiers(orgName1);
  const ids2 = extractUmbrellaIdentifiers(orgName2);

  // Both generic (no identifiers) — could be same chapter but uncertain
  if (ids1.length === 0 && ids2.length === 0) return true;

  // One has identifiers, the other doesn't — different specificity, don't match
  if (ids1.length === 0 || ids2.length === 0) return false;

  // Both have identifiers — at least one number must match
  return ids1.some(id => ids2.includes(id));
}

/**
 * Check if an organization is returning (has past events or exists in catalog)
 *
 * This is used to flag new requests from organizations that have worked with us before,
 * so the intake team can personalize their outreach instead of sending generic first-time emails.
 *
 * For umbrella organizations (Girl Scouts, Cub Scouts, Jack & Jill, etc.) without a
 * distinguishing troop/chapter number, a contact match is required to flag as returning.
 *
 * @param orgName - Organization name to check
 * @param currentEventId - Optional current event request ID to exclude from counts
 * @param contactEmail - Optional contact email for returning contact check
 * @param contactName - Optional contact name for returning contact check (requires email or phone match too)
 * @param contactPhone - Optional contact phone for returning contact check (used with name match)
 * @returns Object with returning status, past event count, and most recent event info
 */
export async function checkReturningOrganization(
  orgName: string,
  currentEventId?: number,
  contactEmail?: string,
  contactName?: string,
  contactPhone?: string,
  department?: string
): Promise<{
  isReturning: boolean;
  isReturningContact: boolean;
  inCatalog: boolean;
  pastEventCount: number;
  collectionCount: number;
  pastDepartments: string[];
  mostRecentEvent?: {
    id: number;
    eventDate: Date | null;
    status: string | null;
  };
  mostRecentCollection?: {
    id: number;
    dateCollected: string | null;
  };
  pastContactName?: string;
  /** When contact matches but org doesn't, these are the orgs the contact previously submitted under */
  contactPastOrgs?: string[];
  /** When contact matches with a different org name, similarity score between current and past org names (0-1) */
  orgSimilarityScore?: number;
}> {
  try {
    // Validate input
    if (!orgName || typeof orgName !== 'string' || orgName.trim().length === 0) {
      return {
        isReturning: false,
        isReturningContact: false,
        inCatalog: false,
        pastEventCount: 0,
        collectionCount: 0,
        pastDepartments: [],
      };
    }

    // Exact match (case-insensitive) against past events
    // Data has been cleaned so we can rely on exact org name matching
    // Normalize & → and so "William & Reed" matches "William and Reed"
    // Also collapse multiple spaces to single space for consistent matching
    const normalizedOrgName = orgName.trim().toLowerCase().replace(/&/g, 'and').replace(/\s+/g, ' ');

    // SQL normalization: lowercase, trim, replace & with 'and', AND collapse multiple spaces
    // REGEXP_REPLACE(str, '\\s+', ' ', 'g') collapses whitespace in PostgreSQL
    const eventCondition = currentEventId
      ? sql`REGEXP_REPLACE(REPLACE(LOWER(TRIM(${eventRequests.organizationName})), '&', 'and'), '\\s+', ' ', 'g') = ${normalizedOrgName}
            AND ${eventRequests.id} != ${currentEventId}
            AND ${eventRequests.deletedAt} IS NULL`
      : sql`REGEXP_REPLACE(REPLACE(LOWER(TRIM(${eventRequests.organizationName})), '&', 'and'), '\\s+', ' ', 'g') = ${normalizedOrgName}
            AND ${eventRequests.deletedAt} IS NULL`;

    let matchingEvents: { id: number; organizationName: string | null; department: string | null; desiredEventDate: Date | null; scheduledEventDate: Date | null; status: string | null; firstName: string | null; lastName: string | null; email: string | null; phone: string | null }[] = [];
    try {
      matchingEvents = await db
        .select({
          id: eventRequests.id,
          organizationName: eventRequests.organizationName,
          department: eventRequests.department,
          desiredEventDate: eventRequests.desiredEventDate,
          scheduledEventDate: eventRequests.scheduledEventDate,
          status: eventRequests.status,
          firstName: eventRequests.firstName,
          lastName: eventRequests.lastName,
          email: eventRequests.email,
          phone: eventRequests.phone,
        })
        .from(eventRequests)
        .where(eventCondition)
        .orderBy(sql`COALESCE(${eventRequests.scheduledEventDate}, ${eventRequests.desiredEventDate}) DESC`);
    } catch (eventQueryError) {
      logger.warn('Failed to query event requests for returning org check, skipping event check', { error: eventQueryError });
    }

    // Exact match against sandwich collections
    let matchingCollections: { id: number; dateCollected: string | null; group1Name: string | null; group2Name: string | null }[] = [];
    try {
      matchingCollections = await db
        .select({
          id: sandwichCollections.id,
          dateCollected: sandwichCollections.collectionDate,
          group1Name: sandwichCollections.group1Name,
          group2Name: sandwichCollections.group2Name,
        })
        .from(sandwichCollections)
        .where(
          sql`(
              REGEXP_REPLACE(REPLACE(LOWER(TRIM(${sandwichCollections.group1Name})), '&', 'and'), '\\s+', ' ', 'g') = ${normalizedOrgName}
              OR REGEXP_REPLACE(REPLACE(LOWER(TRIM(${sandwichCollections.group2Name})), '&', 'and'), '\\s+', ' ', 'g') = ${normalizedOrgName}
            )
            AND ${sandwichCollections.deletedAt} IS NULL`
        )
        .orderBy(sql`${sandwichCollections.collectionDate} DESC`);
    } catch (collectionQueryError) {
      logger.warn('Failed to query sandwich collections for returning org check, skipping collection check', { error: collectionQueryError });
    }

    // Fuzzy fallback: if exact match found nothing, try canonical/substring matching
    // This handles cases like "OpenText Sandwich Project" matching "OpenText" in the catalog
    if (matchingEvents.length === 0 && matchingCollections.length === 0) {
      try {
        const canonicalSearch = canonicalizeOrgName(orgName);
        if (canonicalSearch.length >= 6) {
          // Fetch distinct org names from events to check against
          const allEventOrgs = await db
            .selectDistinct({ organizationName: eventRequests.organizationName })
            .from(eventRequests)
            .where(sql`${eventRequests.organizationName} IS NOT NULL AND ${eventRequests.deletedAt} IS NULL`);

          let fuzzyEventMatches = allEventOrgs
            .filter(row => row.organizationName && organizationNamesMatch(orgName, row.organizationName))
            .map(row => row.organizationName!);

          // For umbrella orgs, filter fuzzy matches to only those with matching identifiers.
          // This prevents "Girl Scouts" from matching "Girl Scout Troop 25126" or
          // "Cub Scout Pack 100" from matching "Cub Scout Pack 200".
          if (isUmbrellaRelated(orgName) && fuzzyEventMatches.length > 0) {
            fuzzyEventMatches = fuzzyEventMatches.filter(matchName => {
              // Non-umbrella matches pass through (e.g. unrelated org that substring-matches)
              if (!isUmbrellaRelated(matchName)) return true;
              return umbrellaIdentifiersMatch(orgName, matchName);
            });
          }

          if (fuzzyEventMatches.length > 0) {
            // Re-query events with the matched org names
            matchingEvents = await db
              .select({
                id: eventRequests.id,
                organizationName: eventRequests.organizationName,
                department: eventRequests.department,
                desiredEventDate: eventRequests.desiredEventDate,
                scheduledEventDate: eventRequests.scheduledEventDate,
                status: eventRequests.status,
                firstName: eventRequests.firstName,
                lastName: eventRequests.lastName,
                email: eventRequests.email,
                phone: eventRequests.phone,
              })
              .from(eventRequests)
              .where(sql`LOWER(TRIM(${eventRequests.organizationName})) IN (${sql.join(fuzzyEventMatches.map(n => sql`${n.trim().toLowerCase()}`), sql`, `)}) AND ${eventRequests.deletedAt} IS NULL`)
              .orderBy(sql`COALESCE(${eventRequests.scheduledEventDate}, ${eventRequests.desiredEventDate}) DESC`);

            // Exclude current event if specified
            if (currentEventId) {
              matchingEvents = matchingEvents.filter(e => e.id !== currentEventId);
            }
          }

          // Also check collections with fuzzy matching
          const allCollectionOrgs = await db
            .selectDistinct({
              group1Name: sandwichCollections.group1Name,
              group2Name: sandwichCollections.group2Name,
            })
            .from(sandwichCollections);

          const fuzzyCollectionNames = new Set<string>();
          const incomingIsUmbrella = isUmbrellaRelated(orgName);
          for (const row of allCollectionOrgs) {
            if (row.group1Name && organizationNamesMatch(orgName, row.group1Name)) {
              // Filter umbrella orgs to require matching identifiers
              if (incomingIsUmbrella && isUmbrellaRelated(row.group1Name) && !umbrellaIdentifiersMatch(orgName, row.group1Name)) {
                continue;
              }
              fuzzyCollectionNames.add(row.group1Name.trim().toLowerCase());
            }
            if (row.group2Name && organizationNamesMatch(orgName, row.group2Name)) {
              if (incomingIsUmbrella && isUmbrellaRelated(row.group2Name) && !umbrellaIdentifiersMatch(orgName, row.group2Name)) {
                continue;
              }
              fuzzyCollectionNames.add(row.group2Name.trim().toLowerCase());
            }
          }

          if (fuzzyCollectionNames.size > 0) {
            const fuzzyNames = Array.from(fuzzyCollectionNames);
            matchingCollections = await db
              .select({
                id: sandwichCollections.id,
                dateCollected: sandwichCollections.collectionDate,
                group1Name: sandwichCollections.group1Name,
                group2Name: sandwichCollections.group2Name,
              })
              .from(sandwichCollections)
              .where(
                sql`LOWER(TRIM(${sandwichCollections.group1Name})) IN (${sql.join(fuzzyNames.map(n => sql`${n}`), sql`, `)})
                    OR LOWER(TRIM(${sandwichCollections.group2Name})) IN (${sql.join(fuzzyNames.map(n => sql`${n}`), sql`, `)})`
              )
              .orderBy(sql`${sandwichCollections.collectionDate} DESC`);
          }
        }
      } catch (fuzzyError) {
        logger.warn('Fuzzy matching fallback failed, continuing with exact match results', { error: fuzzyError });
      }
    }

    const isReturning = matchingEvents.length > 0 || matchingCollections.length > 0;
    const mostRecentEvent = matchingEvents[0];
    const mostRecentCollection = matchingCollections[0];

    // Check if the current contact matches any past event contacts.
    // This is done INDEPENDENTLY of org matching — a returning contact should be
    // flagged even if their org name is slightly different this time.
    //
    // IMPORTANT: Name-only matching is NOT sufficient since people can share names.
    // We require either:
    // 1. Email match (strongest signal), OR
    // 2. Name match + phone match (secondary validation)
    // Name alone is NOT enough to flag as returning contact.
    let isReturningContact = false;
    let pastContactName: string | undefined;
    let contactPastOrgs: string[] | undefined;
    let orgSimilarityScore: number | undefined;

    const normalizedContactEmail = contactEmail?.trim().toLowerCase();
    const normalizedContactName = contactName?.trim().toLowerCase();
    const normalizedContactPhone = contactPhone?.replace(/\D/g, '');

    // First check within org-matched events (if any)
    if (isReturning && matchingEvents.length > 0) {
      for (const event of matchingEvents) {
        const eventEmail = event.email?.trim().toLowerCase();
        const eventFullName = [event.firstName, event.lastName]
          .filter(Boolean)
          .join(' ')
          .trim()
          .toLowerCase();
        const eventPhone = event.phone?.replace(/\D/g, '');

        if (normalizedContactEmail && eventEmail && normalizedContactEmail === eventEmail) {
          isReturningContact = true;
          pastContactName = [event.firstName, event.lastName].filter(Boolean).join(' ') || undefined;
          break;
        }

        if (normalizedContactName && eventFullName && normalizedContactName === eventFullName) {
          if (normalizedContactPhone && eventPhone && normalizedContactPhone === eventPhone) {
            isReturningContact = true;
            pastContactName = [event.firstName, event.lastName].filter(Boolean).join(' ') || undefined;
            break;
          }
        }
      }

      // If not a returning contact within matched org, grab past contact name for context
      if (!isReturningContact && mostRecentEvent) {
        const recentName = [mostRecentEvent.firstName, mostRecentEvent.lastName].filter(Boolean).join(' ');
        if (recentName) {
          pastContactName = recentName;
        }
      }
    }

    // INDEPENDENT CONTACT CHECK: If the contact wasn't found within org-matched events,
    // search ALL past events by email (or name+phone). This catches the case where
    // the same person submits under a slightly different org name.
    if (!isReturningContact && (normalizedContactEmail || (normalizedContactName && normalizedContactPhone))) {
      try {
        const excludeCondition = currentEventId
          ? sql`AND ${eventRequests.id} != ${currentEventId}`
          : sql``;

        let contactMatchedEvents: { id: number; organizationName: string | null; department: string | null; firstName: string | null; lastName: string | null; email: string | null; phone: string | null; scheduledEventDate: Date | null; desiredEventDate: Date | null; status: string | null }[] = [];

        if (normalizedContactEmail) {
          // Search by email across ALL past events
          contactMatchedEvents = await db
            .select({
              id: eventRequests.id,
              organizationName: eventRequests.organizationName,
              department: eventRequests.department,
              firstName: eventRequests.firstName,
              lastName: eventRequests.lastName,
              email: eventRequests.email,
              phone: eventRequests.phone,
              scheduledEventDate: eventRequests.scheduledEventDate,
              desiredEventDate: eventRequests.desiredEventDate,
              status: eventRequests.status,
            })
            .from(eventRequests)
            .where(sql`LOWER(TRIM(${eventRequests.email})) = ${normalizedContactEmail}
                       AND ${eventRequests.deletedAt} IS NULL
                       ${excludeCondition}`)
            .orderBy(sql`COALESCE(${eventRequests.scheduledEventDate}, ${eventRequests.desiredEventDate}) DESC`);
        }

        // If no email match, try name + phone
        if (contactMatchedEvents.length === 0 && normalizedContactName && normalizedContactPhone) {
          contactMatchedEvents = await db
            .select({
              id: eventRequests.id,
              organizationName: eventRequests.organizationName,
              department: eventRequests.department,
              firstName: eventRequests.firstName,
              lastName: eventRequests.lastName,
              email: eventRequests.email,
              phone: eventRequests.phone,
              scheduledEventDate: eventRequests.scheduledEventDate,
              desiredEventDate: eventRequests.desiredEventDate,
              status: eventRequests.status,
            })
            .from(eventRequests)
            .where(sql`LOWER(TRIM(CONCAT(${eventRequests.firstName}, ' ', ${eventRequests.lastName}))) = ${normalizedContactName}
                       AND REGEXP_REPLACE(${eventRequests.phone}, '[^0-9]', '', 'g') = ${normalizedContactPhone}
                       AND ${eventRequests.deletedAt} IS NULL
                       ${excludeCondition}`)
            .orderBy(sql`COALESCE(${eventRequests.scheduledEventDate}, ${eventRequests.desiredEventDate}) DESC`);
        }

        if (contactMatchedEvents.length > 0) {
          isReturningContact = true;
          const firstMatch = contactMatchedEvents[0];
          pastContactName = [firstMatch.firstName, firstMatch.lastName].filter(Boolean).join(' ') || undefined;

          // Collect the unique org names this contact previously submitted under
          const pastOrgNames = [...new Set(
            contactMatchedEvents
              .map(e => e.organizationName)
              .filter((n): n is string => !!n && n.trim().length > 0)
          )];
          contactPastOrgs = pastOrgNames;

          // If the org didn't match through normal matching, check how similar the
          // current org name is to the contact's past org names. A high similarity
          // suggests it's the same org with a slight name variation (e.g. missing "& Youth").
          if (!isReturning && pastOrgNames.length > 0) {
            let bestSimilarity = 0;
            for (const pastOrg of pastOrgNames) {
              const similarity = calculateSimilarity(orgName, pastOrg);
              if (similarity > bestSimilarity) {
                bestSimilarity = similarity;
              }
            }
            orgSimilarityScore = bestSimilarity;
          }
        }
      } catch (contactQueryError) {
        logger.warn('Independent contact lookup failed, continuing with org-based results', { error: contactQueryError });
      }
    }

    // For umbrella orgs without a distinguishing identifier (no troop/pack/chapter number),
    // only flag as returning if the department or contact also matches. This prevents generic
    // "Girl Scouts" or "Church of Jesus Christ of Latter-day Saints" from being flagged as
    // returning just because a different troop/ward worked with us.
    const isUmbrellaOrg = isGenericUmbrellaOrg(orgName);

    // Check if the department matches any past event's department
    let isDepartmentMatch = false;
    if (isUmbrellaOrg && department && matchingEvents.length > 0) {
      const normalizedDept = department.trim().replace(/\s+/g, ' ').toLowerCase();
      isDepartmentMatch = matchingEvents.some(evt => {
        const evtDept = evt.department?.trim().replace(/\s+/g, ' ').toLowerCase();
        return evtDept && evtDept === normalizedDept;
      });
    }

    // For generic umbrella orgs, require department match OR contact match
    // to confirm it's the same chapter/ward/troop
    const effectiveIsReturning = isUmbrellaOrg
      ? (isReturning && (isDepartmentMatch || isReturningContact))
      : isReturning;

    // Collect unique past departments from matching events (for "new department" detection)
    // Normalize departments (trim, collapse whitespace, lowercase) to avoid duplicates like "Outreach" vs "outreach"
    const pastDepartments = isReturning
      ? [...new Set(matchingEvents
          .map(e => e.department)
          .filter((d): d is string => !!d && d.trim().length > 0)
          .map(d => d.trim().replace(/\s+/g, ' ').toLowerCase())
        )]
      : [];

    return {
      isReturning: effectiveIsReturning,
      isReturningContact,
      // inCatalog stays based on raw match — the org type IS in our system even if we
      // can't confirm it's the exact same chapter
      inCatalog: isReturning,
      pastEventCount: effectiveIsReturning ? matchingEvents.length : 0,
      collectionCount: effectiveIsReturning ? matchingCollections.length : 0,
      pastDepartments,
      mostRecentEvent: effectiveIsReturning && mostRecentEvent ? {
        id: mostRecentEvent.id,
        eventDate: getEffectiveEventDate(mostRecentEvent),
        status: mostRecentEvent.status,
      } : undefined,
      mostRecentCollection: effectiveIsReturning && mostRecentCollection ? {
        id: mostRecentCollection.id,
        dateCollected: mostRecentCollection.dateCollected,
      } : undefined,
      pastContactName: (effectiveIsReturning || isReturningContact) ? pastContactName : undefined,
      contactPastOrgs,
      orgSimilarityScore,
    };
  } catch (error) {
    logger.error('Error checking returning organization', { orgName, currentEventId, error });
    throw error;
  }
}

export type ReturningOrganizationResult = Awaited<ReturnType<typeof checkReturningOrganization>>;

export interface ReturningOrgBulkItem {
  eventId: number;
  orgName: string;
  contactEmail?: string | null;
  contactName?: string | null;
  contactPhone?: string | null;
  department?: string | null;
}

const EMPTY_RETURNING_RESULT: ReturningOrganizationResult = {
  isReturning: false,
  isReturningContact: false,
  inCatalog: false,
  pastEventCount: 0,
  collectionCount: 0,
  pastDepartments: [],
};

/**
 * Batch returning-org checks for a visible event list.
 * One HTTP round-trip replaces N per-card calls; dedupes identical checks in the batch.
 */
export async function checkReturningOrganizationsBulk(
  items: ReturningOrgBulkItem[]
): Promise<Record<number, ReturningOrganizationResult>> {
  const result: Record<number, ReturningOrganizationResult> = {};
  if (!items.length) return result;

  const deduped = new Map<
    string,
    { item: ReturningOrgBulkItem; eventIds: number[] }
  >();

  for (const item of items) {
    if (!item.orgName?.trim()) {
      result[item.eventId] = EMPTY_RETURNING_RESULT;
      continue;
    }

    const key = [
      item.orgName.trim().toLowerCase(),
      item.eventId,
      item.contactEmail?.trim().toLowerCase() ?? '',
      item.contactName?.trim().toLowerCase() ?? '',
      item.contactPhone?.trim() ?? '',
      item.department?.trim().toLowerCase() ?? '',
    ].join('|');

    const existing = deduped.get(key);
    if (existing) {
      existing.eventIds.push(item.eventId);
    } else {
      deduped.set(key, { item, eventIds: [item.eventId] });
    }
  }

  const checks = Array.from(deduped.values());
  const CONCURRENCY = 6;

  for (let i = 0; i < checks.length; i += CONCURRENCY) {
    const chunk = checks.slice(i, i + CONCURRENCY);
    await Promise.all(
      chunk.map(async ({ item, eventIds }) => {
        const checkResult = await checkReturningOrganization(
          item.orgName,
          item.eventId,
          item.contactEmail ?? undefined,
          item.contactName ?? undefined,
          item.contactPhone ?? undefined,
          item.department ?? undefined
        );
        for (const eventId of eventIds) {
          result[eventId] = checkResult;
        }
      })
    );
  }

  return result;
}
