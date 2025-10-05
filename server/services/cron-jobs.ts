/**
 * Cron Jobs Service
 *
 * Manages scheduled background tasks for the application.
 */

import cron from 'node-cron';
import { scrapeHostAvailability } from './host-availability-scraper';

/**
 * Initialize all cron jobs
 */
export function initializeCronJobs() {
  console.log('[Cron] Initializing scheduled jobs...');

  // Host availability scraper - runs every Monday at 1:00 PM
  // Cron format: minute hour day-of-month month day-of-week
  // '0 13 * * 1' = At 13:00 (1 PM) on Monday
  const hostScraperJob = cron.schedule('0 13 * * 1', async () => {
    console.log('[Cron] Running weekly host availability scraper...');
    try {
      const result = await scrapeHostAvailability();
      if (result.success) {
        console.log(`[Cron] ✓ Scrape successful: ${result.matchedContacts} active, ${result.unmatchedContacts} inactive`);
      } else {
        console.error(`[Cron] ✗ Scrape failed: ${result.error}`);
      }
    } catch (error) {
      console.error('[Cron] Error running host availability scraper:', error);
    }
  }, {
    scheduled: true,
    timezone: 'America/New_York' // Adjust timezone as needed
  });

  console.log('[Cron] ✓ Host availability scraper scheduled for Mondays at 1:00 PM');

  // Return job references in case we need to manage them later
  return {
    hostScraperJob,
  };
}

/**
 * Stop all cron jobs (useful for graceful shutdown)
 */
export function stopAllCronJobs(jobs: ReturnType<typeof initializeCronJobs>) {
  console.log('[Cron] Stopping all scheduled jobs...');
  jobs.hostScraperJob.stop();
  console.log('[Cron] All jobs stopped');
}
