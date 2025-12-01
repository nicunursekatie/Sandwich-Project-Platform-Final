import type { IStorage } from './storage';
import { GoogleSheetsSyncService } from './google-sheets-sync';
import { getEventRequestsGoogleSheetsService } from './google-sheets-event-requests-sync';
import { db } from './db.js';
import { sql, and, or, eq, lt, isNull, isNotNull } from 'drizzle-orm';
import { eventRequests } from '@shared/schema';
import { createServiceLogger } from './utils/logger.js';
import { logger } from './utils/production-safe-logger';

const syncLogger = createServiceLogger('background-sync');

export class BackgroundSyncService {
  private syncInterval: NodeJS.Timeout | null = null;
  private isRunning = false;

  constructor(private storage: IStorage) {}

  /**
   * Start automatic background sync every 5 minutes
   * ✅ RE-ENABLED with permanent external_id blacklist protection
   */
  start() {
    if (this.isRunning) {
      logger.log('⚠ Background sync already running');
      return;
    }

    logger.log('🚀 Starting background Google Sheets sync service...');
    logger.log('🛡️ PROTECTED: Now using permanent external_id blacklist system');
    logger.log('🔒 GUARANTEE: External_ids will NEVER be imported twice, even after deletion');
    logger.log('🔄 CRITICAL: Sync will continue running even if individual syncs fail');
    this.isRunning = true;

    // Run sync immediately on startup with error handling
    this.performSync()
      .then(() => {
        logger.log('✅ Initial background sync completed successfully');
        syncLogger.info('Initial background sync completed');
      })
      .catch((error) => {
        syncLogger.error('Initial background sync failed', { 
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined
        });
        logger.error('❌ Initial background sync failed:', error);
        logger.log('⚠️ Background sync service will continue running and retry on next interval');
        // CRITICAL: Don't stop the service - it will retry on the next interval
      });

    // Set up recurring sync every 5 minutes
    // CRITICAL: Use a wrapper that ensures sync continues even if errors occur
    this.syncInterval = setInterval(
      () => {
        this.performSync()
          .catch((error) => {
            syncLogger.error('Scheduled background sync failed', { error });
            logger.error('❌ Scheduled background sync failed:', error);
            // CRITICAL: Log but don't stop - sync will retry on next interval
            logger.log('⚠️ Background sync will retry on next interval (every 5 minutes)');
          })
          .finally(() => {
            // Ensure we always log that we're still running
            syncLogger.debug('Background sync cycle completed, will retry in 5 minutes');
          });
      },
      5 * 60 * 1000
    ); // 5 minutes

    logger.log('✅ Background sync service started - syncing every 5 minutes with blacklist protection');
    logger.log('🔄 Sync will continue running even if individual syncs fail - errors are logged but service continues');
  }

  /**
   * Stop the background sync
   */
  stop() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
    this.isRunning = false;
    logger.log('🛑 Background sync service stopped');
  }

  /**
   * Perform sync for event requests only
   * Projects are no longer synced to Google Sheets - managed entirely in-app
   * Uses database coordination to ensure only one instance syncs at a time
   */
  private async performSync() {
    const SYNC_LOCK_KEY = 1001; // Advisory lock key for Google Sheets sync
    const startTime = Date.now();

    try {
      // Try to acquire the advisory lock (non-blocking)
      const lockResult = await db.execute(
        sql`SELECT pg_try_advisory_lock(${SYNC_LOCK_KEY}) as acquired`
      );

      const acquired = lockResult.rows?.[0]?.acquired;

      if (!acquired) {
        syncLogger.debug('Background sync skipped - another instance is running it', {
          lockKey: SYNC_LOCK_KEY
        });
        return;
      }

      syncLogger.info('Background sync acquired lock - starting execution', {
        lockKey: SYNC_LOCK_KEY
      });
      logger.log('📊 Starting automated background sync...');

      try {
        // DISABLED: Projects sync from Google Sheets
        // Projects are now managed entirely within the app to prevent sync conflicts
        // await this.syncProjects();

        // Sync Event Requests from Google Sheets
        await this.syncEventRequests();

        // Auto-transition scheduled events to completed if their date has passed
        await this.autoTransitionPastEvents();

        const duration = Date.now() - startTime;
        syncLogger.info('Background sync completed successfully', {
          lockKey: SYNC_LOCK_KEY,
          duration: `${duration}ms`
        });
        logger.log('✅ Background sync completed successfully');

      } catch (syncError) {
        const duration = Date.now() - startTime;
        syncLogger.error('Background sync failed during execution', {
          lockKey: SYNC_LOCK_KEY,
          duration: `${duration}ms`,
          error: syncError instanceof Error ? error.message : String(syncError),
          stack: syncError instanceof Error ? syncError.stack : undefined
        });
        logger.error('❌ Background sync failed:', syncError);
        // CRITICAL: Don't rethrow - we want the service to keep running
        // The error is logged, and sync will retry on the next interval

      } finally {
        // Always release the lock when done
        await db.execute(sql`SELECT pg_advisory_unlock(${SYNC_LOCK_KEY})`);
        syncLogger.debug('Released lock for background sync', { lockKey: SYNC_LOCK_KEY });
      }

    } catch (coordinationError) {
      syncLogger.error('Background sync coordination failed', {
        lockKey: SYNC_LOCK_KEY,
        error: coordinationError
      });
      logger.error('❌ Background sync coordination failed:', coordinationError);
    }
  }

  /**
   * Sync projects from Google Sheets (bidirectional sync with hash-based change detection)
   */
  private async syncProjects() {
    try {
      const projectSyncService = new GoogleSheetsSyncService(this.storage);
      const result = await projectSyncService.bidirectionalSync();

      if (result.success) {
        logger.log(
          `📋 Projects sync: ${result.updated || 0} updated, ${result.created || 0} created`
        );
      } else {
        logger.log('⚠ Projects sync skipped:', result.message);
      }
    } catch (error) {
      logger.error('❌ Projects sync error:', error);
    }
  }

  /**
   * Sync event requests from Google Sheets
   */
  private async syncEventRequests() {
    try {
      const eventRequestsSyncService = getEventRequestsGoogleSheetsService(
        this.storage
      );

      if (!eventRequestsSyncService) {
        logger.warn(
          '⚠ Event requests sync skipped: Google Sheets service not configured'
        );
        syncLogger.warn('Google Sheets service not available - check environment variables');
        return;
      }

      syncLogger.info('Starting event requests sync from Google Sheets');
      const result = await eventRequestsSyncService.syncFromGoogleSheets();

      if (result.success) {
        const created = result.created || 0;
        const updated = result.updated || 0;
        logger.log(
          `📝 Event requests sync: ${updated} skipped (existing), ${created} created`
        );
        syncLogger.info('Event requests sync completed', { created, updated });
        
        if (created > 0) {
          logger.log(`✅ ${created} new event request(s) imported from Google Sheets`);
        }
      } else {
        logger.warn('⚠ Event requests sync returned failure:', result.message);
        syncLogger.warn('Event requests sync failed', { message: result.message });
      }
    } catch (error) {
      // CRITICAL: Log error but don't throw - we want sync to continue on next interval
      logger.error('❌ Event requests sync error:', error);
      syncLogger.error('Event requests sync threw exception', { 
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      });
      // Don't rethrow - let the service continue running
    }
  }

  /**
   * Auto-transition scheduled events to completed if their date has passed
   * Events only transition the night after they end, not on the day of the event
   *
   * Uses direct database query to avoid storage layer mismatches
   */
  private async autoTransitionPastEvents() {
    try {
      syncLogger.info('Starting auto-transition of past events');

      // Calculate cutoff date: events should transition at start of day AFTER they occur
      // If event is Sept 30, it transitions Oct 1 at 00:00 (start of next day)
      // Use UTC to ensure timezone consistency with database
      const now = new Date();
      const cutoffDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

      syncLogger.debug('Auto-transition cutoff calculation', {
        now: now.toISOString(),
        cutoffDate: cutoffDate.toISOString(),
        cutoffUTC: `${cutoffDate.getUTCFullYear()}-${String(cutoffDate.getUTCMonth() + 1).padStart(2, '0')}-${String(cutoffDate.getUTCDate()).padStart(2, '0')}`,
        explanation: 'Events with date < cutoffDate (strictly before today) will be transitioned to completed'
      });

      // Use direct database query to ensure we get authoritative data
      // WHERE logic:
      // 1. Must be in 'scheduled' status
      // 2. Event date must be in the past (Prefer scheduledEventDate, fallback to desiredEventDate)
      // Use strict lt (<) not lte (<=) to prevent same-day transitions
      const transitionedEvents = await db
        .update(eventRequests)
        .set({
          status: 'completed',
          updatedAt: now
        })
        .where(
          and(
            eq(eventRequests.status, 'scheduled'),
            or(
              and(isNotNull(eventRequests.scheduledEventDate), lt(eventRequests.scheduledEventDate, cutoffDate)),
              and(isNull(eventRequests.scheduledEventDate), lt(eventRequests.desiredEventDate, cutoffDate))
            )
          )
        )
        .returning();
      
      if (transitionedEvents.length > 0) {
        logger.log(`🗓️ Auto-transitioned ${transitionedEvents.length} past events from scheduled to completed`);
        syncLogger.info('Auto-transition completed', {
          transitionedCount: transitionedEvents.length,
          events: transitionedEvents.map(e => ({
            id: e.id,
            organizationName: e.organizationName,
            scheduledEventDate: e.scheduledEventDate,
            desiredEventDate: e.desiredEventDate
          }))
        });
      } else {
        syncLogger.debug('No past events found to transition');
      }
      
    } catch (error) {
      syncLogger.error('Auto-transition of past events failed', { error });
      logger.error('❌ Auto-transition of past events failed:', error);
    }
  }

  /**
   * Get sync status
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      nextSyncIn: this.syncInterval ? '5 minutes' : 'Not scheduled',
    };
  }
}

// Global instance
let backgroundSyncService: BackgroundSyncService | null = null;

export function startBackgroundSync(storage: IStorage) {
  if (!backgroundSyncService) {
    backgroundSyncService = new BackgroundSyncService(storage);
  }
  backgroundSyncService.start();
  return backgroundSyncService;
}

export function stopBackgroundSync() {
  if (backgroundSyncService) {
    backgroundSyncService.stop();
  }
}

export function getBackgroundSyncService() {
  return backgroundSyncService;
}
