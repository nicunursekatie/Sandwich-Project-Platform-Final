import { Router, Response } from 'express';
import { storage } from '../../storage-wrapper';
import { GroupsCatalogDependencies, AuthenticatedRequest } from '../../types';
import { logger } from '../../utils/production-safe-logger';
import { canonicalizeOrgName, organizationNamesMatch } from '../../utils/organization-canonicalization';
import { isScheduledOrRescheduled } from '../../../shared/event-status-workflow';
import type { EventRequest, SandwichCollection, Organization } from '@shared/schema';

// ─── Types ───────────────────────────────────────────────────────────────────

type ViewMode = 'aggregated' | 'individual';

interface Contact {
  name: string;
  email: string;
  phone: string;
}

/** Per-card aggregated data (one card = one org+dept+contact grouping) */
interface CatalogCard {
  organizationName: string;
  canonicalName: string;
  department: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  contacts: Contact[];
  totalRequests: number;
  latestStatus: string;
  latestRequestDate: Date;
  latestActivityDate: Date | null;
  hasHostedEvent: boolean;
  totalSandwiches: number;
  actualSandwichTotal: number;
  actualEventCount: number;
  completedEventsFromRequests: number;
  eventDate: string | null;
  eventFrequency: string | null;
  latestCollectionDate: string | null;
  pastEvents: Array<{ date: string; sandwichCount: number; department: string }>;
  tspContact: string | null;
  tspContactAssigned: string | null;
  assignedTo: string | null;
  assignedToName: string | null;
  linkedEventId: number | null;
  eventIds: number[];
  isPartnerEntry: boolean;
  primaryOrganization: string | null;
  partnerRole: string | null;
  isFromCollectionOnly: boolean;
  isCoHostedEvent: boolean;
  coHostNames: string[];
  locations: string[];
}

/** Collection-derived sandwich data per org+department */
interface CollectionOrgData {
  canonicalName: string;
  originalName: string;
  department: string;
  totalSandwiches: number;
  eventCount: number;
  eventDates: Set<string>;
  pastEvents: Array<{ date: string; sandwichCount: number; department: string }>;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatContactName(request: EventRequest): string {
  if (request.firstName && request.lastName) {
    return `${request.firstName} ${request.lastName}`.trim();
  }
  return request.firstName || request.lastName || request.email || 'Unknown Contact';
}

function normalizeDate(dateValue: string | Date | null | undefined): string | null {
  if (!dateValue) return null;
  try {
    const d = new Date(dateValue);
    if (isNaN(d.getTime())) return null;
    return d.toISOString().split('T')[0];
  } catch {
    return null;
  }
}

function buildUserNameMap(users: Array<{ id: string; displayName?: string | null; firstName?: string | null; lastName?: string | null; email?: string | null }>): Map<string, string> {
  const map = new Map<string, string>();
  for (const u of users) {
    const name = u.displayName
      || `${u.firstName || ''} ${u.lastName || ''}`.trim()
      || u.email
      || u.id;
    map.set(u.id, name);
  }
  return map;
}

function resolveUserName(userId: string | null | undefined, userMap: Map<string, string>): string | null {
  if (!userId) return null;
  return userMap.get(userId) || null;
}

/**
 * Build a mapping from every org name seen to its canonical form.
 * Uses fuzzy matching so that "Allstate" and "Allstate/Pebble Tossers" share a canonical.
 */
function buildCanonicalNameMap(orgNames: string[]): Map<string, string> {
  const map = new Map<string, string>();
  const knownCanonicals = new Set<string>();

  for (const name of orgNames) {
    if (!name) continue;
    if (map.has(name)) continue;

    const candidate = canonicalizeOrgName(name);
    let matched: string | null = null;

    for (const existing of knownCanonicals) {
      if (organizationNamesMatch(candidate, existing)) {
        matched = existing;
        break;
      }
    }

    const final = matched || candidate;
    map.set(name, final);
    knownCanonicals.add(final);
  }

  return map;
}

function getCanonicalName(name: string, nameMap: Map<string, string>): string {
  const existing = nameMap.get(name);
  if (existing) return existing;

  const candidate = canonicalizeOrgName(name);
  // Check for fuzzy match against existing entries
  for (const known of new Set(nameMap.values())) {
    if (organizationNamesMatch(candidate, known)) {
      nameMap.set(name, known);
      return known;
    }
  }
  nameMap.set(name, candidate);
  return candidate;
}

/**
 * Determine the effective status for a request, accounting for date-relative logic.
 */
function deriveStatus(request: EventRequest): string {
  const status = request.status || 'new';
  const eventDate = request.desiredEventDate ? new Date(request.desiredEventDate) : null;
  const now = new Date();

  if (status === 'completed' || status === 'contact_completed') {
    return status;
  }
  if (isScheduledOrRescheduled(status)) {
    if (eventDate && eventDate <= now) return 'past';
    return 'scheduled';
  }
  if (status === 'contacted') {
    if (eventDate && eventDate > now) return 'in_process';
    return 'contacted';
  }
  return status;
}

function isCompletedStatus(status: string): boolean {
  return status === 'completed' || status === 'contact_completed';
}

/**
 * Calculate a human-readable frequency string from a set of event dates.
 */
function calculateEventFrequency(eventDatesInput: string[], totalEventCount?: number): string | null {
  if (eventDatesInput.length === 0) return null;

  const dates = eventDatesInput
    .map(d => new Date(d))
    .filter(d => !isNaN(d.getTime()))
    .sort((a, b) => a.getTime() - b.getTime());

  if (dates.length === 0) return null;

  // Use total event count when provided (handles multiple events on the same date)
  const eventCount = totalEventCount ?? dates.length;

  if (eventCount === 1) {
    const daysSince = Math.floor((Date.now() - dates[0].getTime()) / (1000 * 60 * 60 * 24));
    if (daysSince < 30) return `${daysSince} days ago`;
    if (daysSince < 365) {
      const months = Math.floor(daysSince / 30);
      return `${months} month${months > 1 ? 's' : ''} ago`;
    }
    const years = Math.floor(daysSince / 365);
    return `${years} year${years > 1 ? 's' : ''} ago`;
  }

  const first = dates[0];
  const last = dates[dates.length - 1];
  const daysDiff = (last.getTime() - first.getTime()) / (1000 * 60 * 60 * 24);
  const yearsDiff = daysDiff / 365.25;

  if (yearsDiff < 1) {
    return `${eventCount} events in ${Math.round(daysDiff / 30)} months`;
  }
  const perYear = eventCount / yearsDiff;
  if (perYear >= 1) {
    return `${Math.round(perYear * 10) / 10} events/year`;
  }
  return `${eventCount} events in ${Math.round(yearsDiff)} years`;
}

/**
 * Build a lookup of event-request dates per canonical org name, for deduplication against collections.
 */
function buildEventRequestDateLookup(
  requests: EventRequest[],
  nameMap: Map<string, string>,
): Map<string, Set<string>> {
  const lookup = new Map<string, Set<string>>();
  for (const r of requests) {
    if (!r.organizationName || !r.desiredEventDate) continue;
    const canon = getCanonicalName(r.organizationName, nameMap);
    const dateStr = normalizeDate(r.desiredEventDate);
    if (!dateStr) continue;
    if (!lookup.has(canon)) lookup.set(canon, new Set());
    lookup.get(canon)!.add(dateStr);
  }
  return lookup;
}

/**
 * Check if a collection date is within ±7 days of any event request date for the same org.
 * This prevents double-counting events that appear in both event_requests and sandwich_collections.
 */
function isCollectionDuplicate(
  canonicalOrgName: string,
  collectionDate: string,
  requestDateLookup: Map<string, Set<string>>,
): boolean {
  const collDate = new Date(collectionDate);
  if (isNaN(collDate.getTime())) return false;

  for (const [requestCanon, dates] of requestDateLookup) {
    if (!organizationNamesMatch(canonicalOrgName, requestCanon)) continue;
    for (const dateStr of dates) {
      const daysDiff = Math.abs(
        (collDate.getTime() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24)
      );
      if (daysDiff <= 7) return true;
    }
  }
  return false;
}

function buildOrganizationCategoryMap(orgs: Organization[]): Map<string, {
  category: string | null;
  schoolClassification: string | null;
  isReligious: boolean | null;
  department: string | null;
}> {
  const map = new Map<string, {
    category: string | null;
    schoolClassification: string | null;
    isReligious: boolean | null;
    department: string | null;
  }>();

  for (const org of orgs) {
    const key = canonicalizeOrgName(org.name);
    const existing = map.get(key);
    // Prefer org-level entries (no department) over department-specific ones
    if (!existing || (existing.department && !org.department)) {
      map.set(key, {
        category: org.category,
        schoolClassification: org.schoolClassification,
        isReligious: org.isReligious,
        department: org.department,
      });
    }
  }
  return map;
}

function lookupCategory(
  canonicalName: string,
  categoryMap: Map<string, { category: string | null; schoolClassification: string | null; isReligious: boolean | null }>,
) {
  // Direct lookup first
  const direct = categoryMap.get(canonicalName);
  if (direct) return direct;
  // Fuzzy match
  for (const [key, info] of categoryMap) {
    if (organizationNamesMatch(key, canonicalName)) return info;
  }
  return null;
}

function isGenericGroupName(name: string): boolean {
  return !name || !name.trim() || name === 'Group' || name === 'Groups' || name === 'Unnamed Groups';
}

function createEmptyCard(overrides: Partial<CatalogCard>): CatalogCard {
  return {
    organizationName: '',
    canonicalName: '',
    department: '',
    contactName: '',
    contactEmail: '',
    contactPhone: '',
    contacts: [],
    totalRequests: 0,
    latestStatus: 'new',
    latestRequestDate: new Date(),
    latestActivityDate: null,
    hasHostedEvent: false,
    totalSandwiches: 0,
    actualSandwichTotal: 0,
    actualEventCount: 0,
    completedEventsFromRequests: 0,
    eventDate: null,
    eventFrequency: null,
    latestCollectionDate: null,
    pastEvents: [],
    tspContact: null,
    tspContactAssigned: null,
    assignedTo: null,
    assignedToName: null,
    linkedEventId: null,
    eventIds: [],
    isPartnerEntry: false,
    primaryOrganization: null,
    partnerRole: null,
    isFromCollectionOnly: false,
    isCoHostedEvent: false,
    coHostNames: [],
    locations: [],
    ...overrides,
  };
}

// ─── Main catalog builder ────────────────────────────────────────────────────

/**
 * Build the groups catalog from event requests and sandwich collections.
 *
 * Data pipeline:
 * 1. Build canonical name mapping across all org names
 * 2. Process event requests into cards (keyed by org+dept+contact)
 * 3. Process partner organizations into additional cards
 * 4. Process sandwich collections (deduplicating against event requests)
 * 5. Merge collection data into matching cards, or create new historical cards
 * 6. Group cards by canonical org name for the final response
 */
function buildCatalog(
  allEventRequests: EventRequest[],
  allCollections: SandwichCollection[],
  allOrganizations: Organization[],
  userNameMap: Map<string, string>,
  viewMode: ViewMode,
) {
  // Step 1: Build canonical name map from all org names (event requests + collections)
  const allOrgNames: string[] = [];
  for (const r of allEventRequests) {
    if (r.organizationName) allOrgNames.push(r.organizationName);
    if (r.partnerOrganizations && Array.isArray(r.partnerOrganizations)) {
      for (const p of r.partnerOrganizations) {
        if (p && p.name) allOrgNames.push(p.name);
      }
    }
  }
  for (const c of allCollections) {
    if (c.group1Name) allOrgNames.push(c.group1Name);
    if (c.group2Name) allOrgNames.push(c.group2Name);
    if (c.groupCollections && Array.isArray(c.groupCollections)) {
      for (const g of c.groupCollections as Array<{ name?: string }>) {
        if (g.name) allOrgNames.push(g.name);
      }
    }
  }
  const nameMap = buildCanonicalNameMap(allOrgNames);

  // Step 2: Process event requests into cards
  const cards = new Map<string, CatalogCard>();

  for (const request of allEventRequests) {
    if (!request.organizationName) continue;

    const canonName = getCanonicalName(request.organizationName, nameMap);
    const dept = request.department || '';
    const contactName = formatContactName(request);
    const contactEmail = request.email || '';

    const cardKey = viewMode === 'individual'
      ? `${canonName}|${dept}|${contactEmail}|${request.id}`
      : `${canonName}|${dept}|${contactEmail}`;

    // Detect co-hosts
    const partnerOrgs = (request.partnerOrganizations || []) as Array<{ name?: string; role?: string }>;
    const coHostNames = partnerOrgs
      .filter(p => p?.name?.trim() && p.name.trim() !== request.organizationName)
      .map(p => p.name!.trim());

    if (!cards.has(cardKey)) {
      cards.set(cardKey, createEmptyCard({
        organizationName: request.organizationName,
        canonicalName: canonName,
        department: dept,
        contactName,
        contactEmail,
        contactPhone: request.phone || '',
        contacts: [{ name: contactName, email: contactEmail, phone: request.phone || '' }],
        latestRequestDate: request.createdAt ? new Date(request.createdAt) : new Date(),
        linkedEventId: request.id,
        eventIds: [request.id],
        isCoHostedEvent: coHostNames.length > 0,
        coHostNames,
      }));
    } else {
      const card = cards.get(cardKey)!;
      if (!card.eventIds.includes(request.id)) {
        card.eventIds.push(request.id);
      }
      // Multiple events -> clear single-event link
      if (card.eventIds.length > 1) card.linkedEventId = null;
      // Merge co-host info
      if (coHostNames.length > 0) {
        card.isCoHostedEvent = true;
        card.coHostNames = [...new Set([...card.coHostNames, ...coHostNames])];
      }
    }

    const card = cards.get(cardKey)!;
    card.totalRequests += 1;

    // Collect event locations
    if (request.eventAddress && !card.locations.includes(request.eventAddress)) {
      card.locations.push(request.eventAddress);
    }

    const derivedStatus = deriveStatus(request);
    if (isCompletedStatus(derivedStatus)) {
      card.completedEventsFromRequests += 1;
      card.hasHostedEvent = true;
      if (request.estimatedSandwichCount) {
        card.totalSandwiches += request.estimatedSandwichCount;
      }
    }

    // Update card from the most recent request
    const requestDate = new Date(request.createdAt || new Date());
    if (requestDate >= card.latestRequestDate) {
      card.latestRequestDate = requestDate;
      card.latestStatus = derivedStatus;

      card.eventDate = normalizeDate(request.desiredEventDate);

      card.tspContact = resolveUserName(request.tspContact, userNameMap) || request.tspContact || null;
      card.tspContactAssigned = resolveUserName(request.tspContactAssigned, userNameMap) || request.tspContactAssigned || null;
      card.assignedTo = request.assignedTo || null;
      card.assignedToName = resolveUserName(request.assignedTo, userNameMap);
    }
  }

  // Step 3: Process partner organizations
  for (const request of allEventRequests) {
    if (!request.organizationName) continue;
    const partners = request.partnerOrganizations as Array<{ name?: string; department?: string; role?: string }> | null;
    if (!partners || !Array.isArray(partners)) continue;

    const primaryCanon = getCanonicalName(request.organizationName, nameMap);

    for (const partner of partners) {
      if (!partner.name?.trim()) continue;
      const partnerName = partner.name.trim();
      const partnerCanon = getCanonicalName(partnerName, nameMap);

      // Skip if partner matches the primary org
      if (organizationNamesMatch(partnerCanon, primaryCanon)) continue;

      const dept = partner.department || request.department || '';
      const contactName = formatContactName(request);
      const contactEmail = request.email || '';

      const partnerKey = viewMode === 'individual'
        ? `${partnerCanon}|${dept}|${contactEmail}|${request.id}`
        : `${partnerCanon}|${dept}|${contactEmail}`;

      if (!cards.has(partnerKey)) {
        cards.set(partnerKey, createEmptyCard({
          organizationName: partnerName,
          canonicalName: partnerCanon,
          department: dept,
          contactName,
          contactEmail,
          contactPhone: request.phone || '',
          contacts: [{ name: contactName, email: contactEmail, phone: request.phone || '' }],
          latestRequestDate: request.createdAt ? new Date(request.createdAt) : new Date(),
          isPartnerEntry: true,
          primaryOrganization: request.organizationName,
          partnerRole: partner.role || 'partner',
          linkedEventId: request.id,
        }));
      }

      const partnerCard = cards.get(partnerKey)!;
      partnerCard.totalRequests += 1;

      const derivedStatus = deriveStatus(request);
      if (isCompletedStatus(derivedStatus)) {
        partnerCard.completedEventsFromRequests += 1;
        partnerCard.hasHostedEvent = true;
      }

      if (request.desiredEventDate) {
        partnerCard.eventDate = normalizeDate(request.desiredEventDate);
      }

      const requestDate = new Date(request.createdAt || new Date());
      if (requestDate >= partnerCard.latestRequestDate) {
        partnerCard.latestRequestDate = requestDate;
        partnerCard.latestStatus = request.status || 'new';
      }
    }
  }

  // Step 4: Process sandwich collections
  const requestDateLookup = buildEventRequestDateLookup(allEventRequests, nameMap);
  const collectionData = new Map<string, CollectionOrgData>();
  // Unique sandwich totals from every collection row. The ±7 day event-request
  // skip below only hides duplicate event-history; collections remain the source
  // of truth for ranking groups by sandwiches made.
  const orgCollectionTotals = new Map<string, Map<string, number>>();
  const addOrgTotal = (canonicalName: string, collectionKey: string, sandwiches: number) => {
    if (!orgCollectionTotals.has(canonicalName)) {
      orgCollectionTotals.set(canonicalName, new Map());
    }
    const byKey = orgCollectionTotals.get(canonicalName)!;
    byKey.set(collectionKey, (byKey.get(collectionKey) || 0) + (sandwiches || 0));
  };

  for (const collection of allCollections) {
    const collectionDate = collection.collectionDate;

    const processGroup = (orgName: string, sandwichCount: number, dept: string = '') => {
      if (isGenericGroupName(orgName)) return;

      const clean = orgName.trim();
      const cleanDept = (dept || '').trim();
      const canon = getCanonicalName(clean, nameMap);
      const key = `${canon}|${cleanDept}`;
      addOrgTotal(canon, key, sandwichCount || 0);

      // Deduplicate event history only: skip if this collection matches an event request within ±7 days
      if (collectionDate && isCollectionDuplicate(canon, collectionDate, requestDateLookup)) {
        return;
      }
      if (!collectionData.has(key)) {
        collectionData.set(key, {
          canonicalName: canon,
          originalName: clean,
          department: cleanDept,
          totalSandwiches: 0,
          eventCount: 0,
          eventDates: new Set(),
          pastEvents: [],
        });
      }

      const data = collectionData.get(key)!;
      data.totalSandwiches += sandwichCount || 0;

      if (collectionDate) {
        data.eventDates.add(collectionDate);
        data.eventCount = data.eventDates.size;
        data.pastEvents.push({ date: collectionDate, sandwichCount: sandwichCount || 0, department: cleanDept });
      }
    };

    // Prefer JSON groupCollections over legacy fields
    const groups = collection.groupCollections as Array<{ name?: string; count?: number; department?: string }> | null;
    if (groups && Array.isArray(groups) && groups.length > 0) {
      for (const g of groups) {
        if (g.name && g.count != null) {
          processGroup(g.name, g.count, g.department || '');
        }
      }
    } else {
      // Fall back to legacy fields
      if (collection.group1Name && collection.group1Count != null) {
        processGroup(collection.group1Name, collection.group1Count);
      }
      if (collection.group2Name && collection.group2Count != null) {
        processGroup(collection.group2Name, collection.group2Count);
      }
    }
  }

  // Step 5: Merge collection data into existing cards or create historical-only cards
  // Card-level actualSandwichTotal is copied onto every matching contact and is
  // not safe to sum. Organization ranking uses orgCollectionTotals from Step 4.
  for (const [, orgData] of collectionData) {
    const sortedPastEvents = orgData.pastEvents.sort((a, b) =>
      new Date(b.date).getTime() - new Date(a.date).getTime()
    );

    let foundExisting = false;

    for (const [, card] of cards) {
      const orgMatches = organizationNamesMatch(card.canonicalName, orgData.canonicalName);
      if (!orgMatches) continue;

      const cardDept = (card.department || '').toLowerCase().trim();
      const collDept = (orgData.department || '').toLowerCase().trim();
      const deptMatches = !collDept || cardDept === collDept;

      if (!deptMatches) continue;

      foundExisting = true;
      card.actualSandwichTotal += orgData.totalSandwiches;
      card.actualEventCount += orgData.eventCount;
      card.eventFrequency = calculateEventFrequency(Array.from(orgData.eventDates));
      card.hasHostedEvent = true;
      card.pastEvents = [...card.pastEvents, ...sortedPastEvents].sort((a, b) =>
        new Date(b.date).getTime() - new Date(a.date).getTime()
      );

      if (orgData.eventDates.size > 0) {
        const latestMs = Math.max(
          ...Array.from(orgData.eventDates).map(d => new Date(d).getTime())
        );
        card.latestCollectionDate = new Date(latestMs).toISOString().split('T')[0];

        const requestMs = card.latestRequestDate.getTime();
        card.latestActivityDate = new Date(Math.max(requestMs, latestMs));
      }
    }

    if (!foundExisting) {
      // Create a historical-only card from collection data
      const latestMs = orgData.eventDates.size > 0
        ? Math.max(...Array.from(orgData.eventDates).map(d => new Date(d).getTime()))
        : Date.now();
      const latestDateStr = new Date(latestMs).toISOString().split('T')[0];

      const key = `${orgData.canonicalName}|${orgData.department}|`;
      cards.set(key, createEmptyCard({
        organizationName: orgData.originalName,
        canonicalName: orgData.canonicalName,
        department: orgData.department,
        latestStatus: 'past',
        latestRequestDate: new Date(latestMs),
        latestActivityDate: new Date(latestMs),
        hasHostedEvent: true,
        actualSandwichTotal: orgData.totalSandwiches,
        actualEventCount: orgData.eventCount,
        eventFrequency: calculateEventFrequency(Array.from(orgData.eventDates)),
        eventDate: latestDateStr,
        latestCollectionDate: latestDateStr,
        pastEvents: sortedPastEvents,
        isFromCollectionOnly: true,
      }));
    }
  }

  // Step 6: Finalize cards - set latestActivityDate and actualEventCount defaults
  for (const [, card] of cards) {
    if (!card.latestActivityDate) {
      card.latestActivityDate = card.latestRequestDate;
    }
    if (!card.actualEventCount && card.completedEventsFromRequests > 0) {
      card.actualEventCount = card.completedEventsFromRequests;
    }
  }

  // Step 7: Group cards by canonical org name
  const categoryMap = buildOrganizationCategoryMap(allOrganizations);
  const orgsMap = new Map<string, {
    canonicalName: string;
    displayName: string;
    nameVariations: Set<string>;
    departments: CatalogCard[];
  }>();

  for (const [, card] of cards) {
    const key = card.canonicalName;
    if (!orgsMap.has(key)) {
      orgsMap.set(key, {
        canonicalName: key,
        displayName: card.organizationName,
        nameVariations: new Set([card.organizationName]),
        departments: [],
      });
    }

    const org = orgsMap.get(key)!;
    org.nameVariations.add(card.organizationName);

    // Use the longest name as display name (most complete)
    if (card.organizationName.length > org.displayName.length) {
      org.displayName = card.organizationName;
    }

    // Determine contact label for collection-only entries
    let contactLabel = 'Historical Organization';
    if (!card.contactName && card.latestCollectionDate) {
      const year = new Date(card.latestCollectionDate).getFullYear();
      if (year >= 2025) contactLabel = 'Collection Logged Only';
    }

    org.departments.push({
      ...card,
      organizationName: org.displayName,
      contactName: card.contactName || contactLabel,
    });
  }

  // Step 8: Build final sorted output
  const organizations = Array.from(orgsMap.values()).map(org => {
    const catInfo = lookupCategory(org.canonicalName, categoryMap);
    const sandwichBuckets = new Map<string, number>();
    for (const [canon, buckets] of orgCollectionTotals) {
      if (canon === org.canonicalName || organizationNamesMatch(canon, org.canonicalName)) {
        for (const [collectionKey, sandwiches] of buckets) {
          if (!sandwichBuckets.has(collectionKey)) {
            sandwichBuckets.set(collectionKey, sandwiches);
          }
        }
      }
    }
    const actualSandwichTotal = Array.from(sandwichBuckets.values()).reduce((sum, n) => sum + n, 0);

    return {
      name: org.displayName,
      canonicalName: org.canonicalName,
      nameVariations: Array.from(org.nameVariations),
      category: catInfo?.category || null,
      schoolClassification: catInfo?.schoolClassification || null,
      isReligious: catInfo?.isReligious || false,
      // Unique collection total, including rows skipped from event-history dedup.
      actualSandwichTotal,
      departments: org.departments
        .map(card => ({
          organizationName: card.organizationName,
          department: card.department,
          contactName: card.contactName,
          email: card.contactEmail,
          phone: card.contactPhone,
          allContacts: card.contacts,
          status: card.latestStatus,
          totalRequests: card.totalRequests,
          hasHostedEvent: card.hasHostedEvent,
          totalSandwiches: card.totalSandwiches,
          actualSandwichTotal: card.actualSandwichTotal,
          actualEventCount: card.actualEventCount,
          eventFrequency: card.eventFrequency,
          eventDate: card.eventDate,
          latestRequestDate: card.latestRequestDate,
          latestCollectionDate: card.latestCollectionDate,
          latestActivityDate: card.latestActivityDate,
          tspContact: card.tspContact,
          tspContactAssigned: card.tspContactAssigned,
          assignedTo: card.assignedTo,
          assignedToName: card.assignedToName,
          pastEvents: card.pastEvents,
          isPartnerEntry: card.isPartnerEntry,
          primaryOrganization: card.primaryOrganization,
          partnerRole: card.partnerRole,
          linkedEventId: card.linkedEventId,
          eventIds: card.eventIds,
          isFromCollectionOnly: card.isFromCollectionOnly,
          isCoHostedEvent: card.isCoHostedEvent,
          coHostNames: card.coHostNames,
          locations: card.locations,
        }))
        .sort((a, b) =>
          new Date(b.latestActivityDate!).getTime() - new Date(a.latestActivityDate!).getTime()
        ),
    };
  });

  organizations.sort((a, b) => {
    const aLatest = Math.max(...a.departments.map(d => new Date(d.latestActivityDate!).getTime()));
    const bLatest = Math.max(...b.departments.map(d => new Date(d.latestActivityDate!).getTime()));
    return bLatest - aLatest;
  });

  return organizations;
}

// ─── Details builder ─────────────────────────────────────────────────────────

function buildOrganizationDetails(
  decodedOrgName: string,
  allEventRequests: EventRequest[],
  allCollections: SandwichCollection[],
) {
  const canonicalSearchName = canonicalizeOrgName(decodedOrgName);

  // Find matching event requests (fuzzy)
  const orgEventRequests = allEventRequests.filter(r =>
    organizationNamesMatch(canonicalizeOrgName(r.organizationName || ''), canonicalSearchName)
  );

  // Find matching collections (fuzzy across all group fields)
  const orgCollections = allCollections.filter(collection => {
    if (collection.group1Name && organizationNamesMatch(canonicalizeOrgName(collection.group1Name), canonicalSearchName)) return true;
    if (collection.group2Name && organizationNamesMatch(canonicalizeOrgName(collection.group2Name), canonicalSearchName)) return true;
    const groups = collection.groupCollections as Array<{ name?: string }> | null;
    if (groups && Array.isArray(groups)) {
      return groups.some(g => g.name && organizationNamesMatch(canonicalizeOrgName(g.name), canonicalSearchName));
    }
    return false;
  });

  // Process event requests
  const eventRequestHistory = orgEventRequests.map(r => ({
    type: 'event_request' as const,
    id: r.id,
    date: r.desiredEventDate || r.createdAt,
    status: r.status,
    department: r.department || '',
    contactName: formatContactName(r),
    email: r.email,
    phone: r.phone,
    estimatedSandwiches: r.estimatedSandwichCount || 0,
    actualSandwiches: 0,
    notes: r.message || '',
    createdAt: r.createdAt,
    lastUpdated: r.updatedAt || r.createdAt,
  }));

  // Process collections
  const collectionHistory = orgCollections.map(collection => {
    let sandwichCount = 0;

    // Legacy fields
    if (collection.group1Name && canonicalizeOrgName(collection.group1Name) === canonicalSearchName) {
      sandwichCount += collection.group1Count || 0;
    }
    if (collection.group2Name && canonicalizeOrgName(collection.group2Name) === canonicalSearchName) {
      sandwichCount += collection.group2Count || 0;
    }

    // JSON group collections
    const groups = collection.groupCollections as Array<{ name?: string; count?: number }> | null;
    if (groups && Array.isArray(groups)) {
      for (const g of groups) {
        if (g.name && canonicalizeOrgName(g.name) === canonicalSearchName) {
          sandwichCount += g.count || 0;
        }
      }
    }

    return {
      type: 'sandwich_collection' as const,
      id: collection.id,
      date: collection.collectionDate,
      status: 'completed',
      hostName: collection.hostName,
      department: '',
      contactName: collection.createdByName || 'Unknown',
      email: '',
      phone: '',
      estimatedSandwiches: 0,
      actualSandwiches: sandwichCount,
      notes: `Collection hosted by ${collection.hostName}`,
      createdAt: collection.submittedAt,
      lastUpdated: collection.submittedAt,
    };
  });

  // Combine and sort
  const allEvents = [...eventRequestHistory, ...collectionHistory].sort((a, b) => {
    const dateA = new Date(a.date || a.createdAt!).getTime();
    const dateB = new Date(b.date || b.createdAt!).getTime();
    return dateB - dateA;
  });

  // Summary stats
  const completedEvents = allEvents.filter(
    e => e.status === 'completed' || e.status === 'contact_completed' || e.type === 'sandwich_collection'
  ).length;

  const totalActualSandwiches = allEvents.reduce((sum, e) => sum + e.actualSandwiches, 0);
  const totalEstimatedSandwiches = allEvents.reduce((sum, e) => sum + e.estimatedSandwiches, 0);

  // Unique contacts
  const contactMap = new Map<string, { name: string; email: string; phone: string; department: string }>();
  for (const e of allEvents) {
    if (e.email) {
      contactMap.set(e.email, {
        name: e.contactName,
        email: e.email,
        phone: e.phone || '',
        department: e.department,
      });
    }
  }

  // Event frequency
  const eventDatesList = allEvents
    .map(e => normalizeDate(e.date || e.createdAt))
    .filter((d): d is string => d !== null);

  return {
    organizationName: decodedOrgName,
    summary: {
      totalEvents: allEvents.length,
      completedEvents,
      totalActualSandwiches,
      totalEstimatedSandwiches,
      eventFrequency: calculateEventFrequency(eventDatesList, allEvents.length),
    },
    contacts: Array.from(contactMap.values()),
    events: allEvents,
  };
}

// ─── Route handler ───────────────────────────────────────────────────────────

export function createGroupsCatalogRoutes(deps: GroupsCatalogDependencies) {
  const router = Router();

  // GET / - Groups Catalog: directory of all organizations
  router.get('/', deps.isAuthenticated, async (req, res) => {
    try {
      const viewMode = (req.query.viewMode as string) || 'aggregated';
      if (viewMode !== 'aggregated' && viewMode !== 'individual') {
        return res.status(400).json({ message: 'Invalid viewMode. Must be "aggregated" or "individual"' });
      }

      const [allEventRequests, allCollections, allUsers, allOrganizations] = await Promise.all([
        storage.getAllEventRequests(),
        storage.getAllSandwichCollections(),
        storage.getAllUsers(),
        storage.getAllOrganizations(),
      ]);

      const userNameMap = buildUserNameMap(allUsers);

      const organizations = buildCatalog(
        allEventRequests,
        allCollections,
        allOrganizations,
        userNameMap,
        viewMode as ViewMode,
      );

      res.json({ groups: organizations });
    } catch (error) {
      logger.error('Error fetching organizations catalog:', error);
      res.status(500).json({ message: 'Failed to fetch organizations catalog' });
    }
  });

  // GET /details/:organizationName - Detailed event history for one org
  router.get('/details/:organizationName', deps.isAuthenticated, async (req, res) => {
    try {
      const decodedOrgName = decodeURIComponent(req.params.organizationName);

      const [allEventRequests, allCollections] = await Promise.all([
        storage.getAllEventRequests(),
        storage.getAllSandwichCollections(),
      ]);

      const result = buildOrganizationDetails(decodedOrgName, allEventRequests, allCollections);
      res.json(result);
    } catch (error) {
      logger.error(`Error fetching details for organization ${req.params.organizationName}:`, error);
      res.status(500).json({ message: 'Failed to fetch organization details' });
    }
  });

  // POST /rename - Rename organization/department across all source records
  router.post('/rename', deps.isAuthenticated, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { oldName, newName, oldDepartment, newDepartment, partnerOrganizations, eventId, eventIds } = req.body;

      if (!oldName || typeof oldName !== 'string') {
        return res.status(400).json({ message: 'Current organization name is required' });
      }

      const trimmedOldName = oldName.trim();
      const trimmedNewName = (newName && typeof newName === 'string') ? newName.trim() : '';
      const trimmedOldDept = typeof oldDepartment === 'string' ? oldDepartment.trim() : null;
      const trimmedNewDept = typeof newDepartment === 'string' ? newDepartment.trim() : null;
      const specificEventId = (eventId && typeof eventId === 'number') ? eventId : null;
      const specificEventIds = Array.isArray(eventIds) && eventIds.length > 0
        ? eventIds.filter((id: unknown) => typeof id === 'number') as number[]
        : null;

      // Validate partner organizations
      const validPartnerOrgs = Array.isArray(partnerOrganizations)
        ? partnerOrganizations
            .filter((p: { name?: string }) => p && typeof p.name === 'string' && p.name.trim())
            .map((p: { name: string; role?: string }) => ({
              name: p.name.trim(),
              role: (['co-host', 'partner', 'sponsor'] as const).includes(p.role as 'co-host' | 'partner' | 'sponsor')
                ? p.role as string
                : 'partner',
            }))
        : null;

      const hasCoHosts = validPartnerOrgs && validPartnerOrgs.length > 0;
      if (!trimmedNewName && !hasCoHosts) {
        return res.status(400).json({ message: 'Please provide an organization name or add co-hosting organizations' });
      }

      const effectiveNewName = trimmedNewName || (hasCoHosts ? validPartnerOrgs![0].name : '');

      logger.info('Renaming organization', {
        oldName: trimmedOldName,
        newName: effectiveNewName,
        oldDepartment: trimmedOldDept,
        newDepartment: trimmedNewDept,
        partnerOrganizations: validPartnerOrgs,
        eventId: specificEventId,
        eventIds: specificEventIds,
        userId: req.user?.id,
      });

      let updatedEventRequests = 0;
      let updatedCollections = 0;

      // Helper to build update payload for an event request
      const buildEventUpdates = () => {
        const updates: Record<string, unknown> = { organizationName: effectiveNewName };
        if (validPartnerOrgs && validPartnerOrgs.length > 0) {
          updates.partnerOrganizations = validPartnerOrgs;
        }
        if (trimmedNewDept !== null || newDepartment === '') {
          updates.department = trimmedNewDept || null;
        }
        return updates;
      };

      if (specificEventId) {
        // Single event update
        const request = await storage.getEventRequest(specificEventId);
        if (request && request.organizationName === trimmedOldName) {
          await storage.updateEventRequest(specificEventId, buildEventUpdates());
          updatedEventRequests = 1;
        }
      } else if (specificEventIds && specificEventIds.length > 0) {
        // Aggregated card update (specific event IDs)
        for (const id of specificEventIds) {
          const request = await storage.getEventRequest(id);
          if (request && request.organizationName === trimmedOldName) {
            await storage.updateEventRequest(id, buildEventUpdates());
            updatedEventRequests++;
          }
        }
      } else {
        // Bulk rename - all events matching org + dept
        const allEventRequests = await storage.getAllEventRequests();
        for (const request of allEventRequests) {
          if (request.organizationName !== trimmedOldName) continue;

          // Check department filter
          if (trimmedOldDept !== null) {
            const currentDept = request.department || '';
            if (currentDept !== trimmedOldDept && !(trimmedOldDept === '' && !request.department)) continue;
          }

          const updates: Record<string, unknown> = { organizationName: effectiveNewName };
          if (validPartnerOrgs && validPartnerOrgs.length > 0) {
            updates.partnerOrganizations = validPartnerOrgs;
          }

          // Update department if changing
          if (trimmedOldDept !== null) {
            const currentDept = request.department || null;
            const isClearing = trimmedNewDept === null;
            const isChanging = trimmedNewDept !== null && trimmedNewDept !== currentDept;
            if (isClearing || isChanging) {
              updates.department = trimmedNewDept;
            }
          }

          try {
            await storage.updateEventRequest(request.id, updates);
            updatedEventRequests++;
          } catch (updateError) {
            logger.error('Failed to update event request', {
              requestId: request.id,
              updates,
              error: updateError instanceof Error ? updateError.message : updateError,
            });
            throw updateError;
          }
        }
      }

      // Update sandwich_collections only in bulk mode, not for department-level edits
      const isDepartmentEdit = (trimmedOldDept !== null && trimmedOldDept !== '') || (trimmedNewDept !== null && trimmedNewDept !== '');
      if (!specificEventId && !specificEventIds && !isDepartmentEdit) {
        const allCollections = await storage.getAllSandwichCollections();
        for (const collection of allCollections) {
          let shouldUpdate = false;
          const updates: Record<string, unknown> = {};

          if (collection.group1Name === trimmedOldName) {
            updates.group1Name = effectiveNewName;
            shouldUpdate = true;
          }
          if (collection.group2Name === trimmedOldName) {
            updates.group2Name = effectiveNewName;
            shouldUpdate = true;
          }

          const groups = collection.groupCollections as Array<{ name?: string; department?: string; [k: string]: unknown }> | null;
          if (groups && Array.isArray(groups)) {
            const updated = groups.map(g => {
              if (g && typeof g === 'object' && g.name === trimmedOldName) {
                shouldUpdate = true;
                const copy = { ...g, name: effectiveNewName };
                if (trimmedOldDept !== null && g.department === trimmedOldDept && trimmedNewDept !== null) {
                  copy.department = trimmedNewDept;
                }
                return copy;
              }
              return g;
            });
            if (shouldUpdate) updates.groupCollections = updated;
          }

          if (shouldUpdate) {
            await storage.updateSandwichCollection(collection.id, updates);
            updatedCollections++;
          }
        }

        // Update organizations table
        const allOrganizations = await storage.getAllOrganizations();
        for (const org of allOrganizations) {
          if (org.name === trimmedOldName) {
            await storage.updateOrganization(org.id, { name: effectiveNewName });
          }
        }
      }

      logger.info('Organization rename completed', {
        oldName: trimmedOldName,
        newName: effectiveNewName,
        isCoHostedEvent: !trimmedNewName && hasCoHosts,
        updatedEventRequests,
        updatedCollections,
      });

      res.json({
        success: true,
        oldName: trimmedOldName,
        newName: effectiveNewName,
        isCoHostedEvent: !trimmedNewName && hasCoHosts,
        updatedEventRequests,
        updatedCollections,
      });
    } catch (error) {
      logger.error('Error renaming organization:', error);
      res.status(500).json({ message: 'Failed to rename organization' });
    }
  });

  // POST /upsert - Create or update organization category
  router.post('/upsert', deps.isAuthenticated, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { name, category, schoolClassification, isReligious } = req.body;

      if (!name || typeof name !== 'string') {
        return res.status(400).json({ message: 'Organization name is required' });
      }
      if (!category || typeof category !== 'string') {
        return res.status(400).json({ message: 'Category is required' });
      }

      const trimmedCategory = category.trim().toLowerCase();
      if (trimmedCategory.length < 2 || trimmedCategory.length > 50) {
        return res.status(400).json({ message: 'Category must be between 2 and 50 characters' });
      }
      if (!/^[a-z0-9_]+$/.test(trimmedCategory)) {
        return res.status(400).json({ message: 'Category can only contain letters, numbers, and underscores' });
      }

      // Find existing org by fuzzy name match
      const allOrganizations = await storage.getAllOrganizations();
      const canonicalSearchName = canonicalizeOrgName(name);

      let existingOrg: Organization | null = null;
      for (const org of allOrganizations) {
        if (organizationNamesMatch(canonicalizeOrgName(org.name), canonicalSearchName)) {
          // Prefer org-level entries (no department)
          if (!existingOrg || (!org.department && existingOrg.department)) {
            existingOrg = org;
          }
        }
      }

      const categoryData = {
        category: trimmedCategory,
        schoolClassification: trimmedCategory === 'school' ? (schoolClassification || null) : null,
        isReligious: isReligious || false,
      };

      let result;
      if (existingOrg) {
        result = await storage.updateOrganization(existingOrg.id, categoryData);
        logger.log(`Updated organization category: ${name} (ID: ${existingOrg.id}) -> ${trimmedCategory}`);
      } else {
        result = await storage.createOrganization({
          name,
          ...categoryData,
          totalEvents: 0,
        });
        logger.log(`Created new organization: ${name} with category ${trimmedCategory}`);
      }

      res.json(result);
    } catch (error) {
      logger.error('Error upserting organization:', error);
      res.status(500).json({ message: 'Failed to upsert organization' });
    }
  });

  return router;
}

export default createGroupsCatalogRoutes;
