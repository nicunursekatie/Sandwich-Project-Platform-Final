/**
 * Cron Jobs Service
 *
 * Manages scheduled background tasks for the application.
 */

import cron from 'node-cron';
import { scrapeHostAvailability } from './host-availability-scraper';
import { createServiceLogger, logError } from '../utils/logger';

const cronLogger = createServiceLogger('cron');

/**
 * Initialize all cron jobs
 */
export function initializeCronJobs() {
  cronLogger.info('Initializing scheduled jobs...');

  // Host availability scraper - runs every Monday at 1:00 PM
  // Cron format: minute hour day-of-month month day-of-week
  // '0 13 * * 1' = At 13:00 (1 PM) on Monday
  const hostScraperJob = cron.schedule('0 13 * * 1', async () => {
    cronLogger.info('Running weekly host availability scraper...');
    try {
      const result = await scrapeHostAvailability();
      if (result.success) {
        cronLogger.info('Host availability scrape completed successfully', {
          matchedContacts: result.matchedContacts,
          unmatchedContacts: result.unmatchedContacts,
          scrapedHostsCount: result.scrapedHosts.length,
          timestamp: result.timestamp,
        });
      } else {
        cronLogger.error('Host availability scrape failed', {
          error: result.error,
          timestamp: result.timestamp,
        });
      }
    } catch (error) {
      logError(
        error as Error,
        'Error running host availability scraper in cron job',
        undefined,
        { jobType: 'host-availability-scraper' }
      );
    }
  }, {
    scheduled: true,
    timezone: 'America/New_York' // Adjust timezone as needed
  });

  cronLogger.info('Host availability scraper scheduled successfully', {
    schedule: 'Mondays at 1:00 PM',
    timezone: 'America/New_York',
  });

  // Return job references in case we need to manage them later
  return {
    hostScraperJob,
  };
}

/**
 * Stop all cron jobs (useful for graceful shutdown)
 */
export function stopAllCronJobs(jobs: ReturnType<typeof initializeCronJobs>) {
  cronLogger.info('Stopping all scheduled jobs...');
  jobs.hostScraperJob.stop();
  cronLogger.info('All cron jobs stopped successfully');
}
