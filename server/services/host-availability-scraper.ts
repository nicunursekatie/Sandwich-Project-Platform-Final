/**
 * Host Availability Scraper Service
 *
 * Scrapes https://nicunursekatie.github.io/sandwichprojectcollectionsites/
 * to get weekly host availability and updates the database.
 *
 * Runs every Monday at 1pm via cron job.
 */

import { storage } from '../storage-wrapper';

const EXTERNAL_SITE_URL = 'https://nicunursekatie.github.io/sandwichprojectcollectionsites/';

interface ScrapeResult {
  success: boolean;
  scrapedHosts: string[];
  matchedContacts: number;
  unmatchedContacts: number;
  error?: string;
  timestamp: Date;
}

/**
 * Fetches and parses host names from the external static HTML site
 */
async function fetchHostNamesFromSite(): Promise<string[]> {
  try {
    const response = await fetch(EXTERNAL_SITE_URL);

    if (!response.ok) {
      throw new Error(`Failed to fetch site: ${response.status} ${response.statusText}`);
    }

    const html = await response.text();

    // Parse host names from HTML
    // Expected format: "FirstName L." (e.g., "Katie S.", "John D.")
    // This regex looks for names in format: Word space single-letter followed by period
    const namePattern = /([A-Z][a-z]+\s+[A-Z]\.)/g;
    const matches = html.match(namePattern);

    if (!matches) {
      console.warn('[Host Scraper] No host names found in HTML');
      return [];
    }

    // Remove duplicates and return unique names
    const uniqueNames = [...new Set(matches)];
    console.log(`[Host Scraper] Found ${uniqueNames.length} unique host names:`, uniqueNames);

    return uniqueNames;
  } catch (error) {
    console.error('[Host Scraper] Error fetching host names:', error);
    throw error;
  }
}

/**
 * Matches scraped host names against database contacts
 * Uses partial matching (e.g., "Katie S." matches "Katie Smith")
 */
function matchHostNameToContact(scrapedName: string, contactName: string): boolean {
  // Normalize both names to lowercase for comparison
  const scrapedLower = scrapedName.toLowerCase().trim();
  const contactLower = contactName.toLowerCase().trim();

  // Check if contact name starts with the scraped name
  // e.g., "katie s." matches "katie smith", "katie stevens", etc.
  return contactLower.startsWith(scrapedLower.replace('.', ''));
}

/**
 * Main scraper function - updates weekly active status for all host contacts
 */
export async function scrapeHostAvailability(): Promise<ScrapeResult> {
  const timestamp = new Date();

  try {
    console.log(`[Host Scraper] Starting scrape at ${timestamp.toISOString()}`);

    // Fetch host names from external site
    const scrapedHosts = await fetchHostNamesFromSite();

    if (scrapedHosts.length === 0) {
      return {
        success: false,
        scrapedHosts: [],
        matchedContacts: 0,
        unmatchedContacts: 0,
        error: 'No host names found on external site',
        timestamp,
      };
    }

    // Get all host contacts from database
    const hostsWithContacts = await storage.getAllHostsWithContacts();
    const allContacts = hostsWithContacts.flatMap(host => host.contacts);

    console.log(`[Host Scraper] Checking ${allContacts.length} contacts against ${scrapedHosts.length} scraped names`);

    let matchedCount = 0;
    let unmatchedCount = 0;

    // Update each contact's weekly active status
    for (const contact of allContacts) {
      // Check if this contact matches any of the scraped host names
      const isActive = scrapedHosts.some(scrapedName =>
        matchHostNameToContact(scrapedName, contact.name)
      );

      // Update the contact's weekly active status and last scraped timestamp
      await storage.updateHostContact(contact.id, {
        weeklyActive: isActive,
        lastScraped: timestamp,
      });

      if (isActive) {
        matchedCount++;
        console.log(`[Host Scraper] ✓ Matched: ${contact.name} -> ACTIVE`);
      } else {
        unmatchedCount++;
        console.log(`[Host Scraper] ✗ No match: ${contact.name} -> INACTIVE`);
      }
    }

    console.log(`[Host Scraper] Scrape complete: ${matchedCount} active, ${unmatchedCount} inactive`);

    return {
      success: true,
      scrapedHosts,
      matchedContacts: matchedCount,
      unmatchedContacts: unmatchedCount,
      timestamp,
    };
  } catch (error) {
    console.error('[Host Scraper] Error during scrape:', error);
    return {
      success: false,
      scrapedHosts: [],
      matchedContacts: 0,
      unmatchedContacts: 0,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp,
    };
  }
}
