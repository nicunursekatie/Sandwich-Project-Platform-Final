import type { IStorage } from './storage';
import { GoogleSheetsSyncService } from './google-sheets-sync';
import { getEventRequestsGoogleSheetsService } from './google-sheets-event-requests-sync';
import { db } from './db.js';
import { sql, and, or, eq, lt, isNull, isNotNull } from 'drizzle-orm';
import { eventRequests } from '@shared/schema';
import { createServiceLogger } from './utils/logger.js';

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
      console.log('⚠ Background sync already running');
      return;
    }

    console.log('🚀 Starting background Google Sheets sync service...');
    console.log('🛡️ PROTECTED: Now using permanent external_id blacklist system');
    console.log('🔒 GUARANTEE: External_ids will NEVER be imported twice, even after deletion');
    this.isRunning = true;

    // Run sync immediately on startup with error handling
    this.performSync().catch((error) => {
      syncLogger.error('Initial background sync failed', { error });
      console.error('❌ Initial background sync failed:', error);
    });

    // Set up recurring sync every 5 minutes
    this.syncInterval = setInterval(
      () => {
        this.performSync().catch((error) => {
          syncLogger.error('Scheduled background sync failed', { error });
          console.error('❌ Scheduled background sync failed:', error);
        });
      },
      5 * 60 * 1000
    ); // 5 minutes

    console.log('✅ Background sync service started - syncing every 5 minutes with blacklist protection');
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
    console.log('🛑 Background sync service stopped');
  }

  /**
   * Perform sync for both projects and event requests
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
      console.log('📊 Starting automated background sync...');

      try {
        // Sync Projects from Google Sheets
        await this.syncProjects();

        // Sync Event Requests from Google Sheets
        await this.syncEventRequests();

        // Auto-transition scheduled events to completed if their date has passed
        await this.autoTransitionPastEvents();

        const duration = Date.now() - startTime;
        syncLogger.info('Background sync completed successfully', {
          lockKey: SYNC_LOCK_KEY,
          duration: `${duration}ms`
        });
        console.log('✅ Background sync completed successfully');

      } catch (syncError) {
        const duration = Date.now() - startTime;
        syncLogger.error('Background sync failed during execution', {
          lockKey: SYNC_LOCK_KEY,
          duration: `${duration}ms`,
          error: syncError
        });
        console.error('❌ Background sync failed:', syncError);

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
      console.error('❌ Background sync coordination failed:', coordinationError);
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
        console.log(
          `📋 Projects sync: ${result.updated || 0} updated, ${result.created || 0} created`
        );
      } else {
        console.log('⚠ Projects sync skipped:', result.message);
      }
    } catch (error) {
      console.error('❌ Projects sync error:', error);
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
        console.log(
          '⚠ Event requests sync skipped: Google Sheets service not configured'
        );
        return;
      }

      const result = await eventRequestsSyncService.syncFromGoogleSheets();

      if (result.success) {
        console.log(
          `📝 Event requests sync: ${result.updated || 0} updated, ${result.created || 0} created`
        );
      } else {
        console.log('⚠ Event requests sync skipped:', result.message);
      }
    } catch (error) {
      console.error('❌ Event requests sync error:', error);
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
      // WHERE logic: Prefer scheduledEventDate when present, fallback to desiredEventDate
      // This prevents premature completion of rescheduled events with old desiredEventDate
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
        console.log(`🗓️ Auto-transitioned ${transitionedEvents.length} past events from scheduled to completed`);
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
      console.error('❌ Auto-transition of past events failed:', error);
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
