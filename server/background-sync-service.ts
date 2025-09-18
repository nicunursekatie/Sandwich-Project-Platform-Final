import type { IStorage } from './storage';
import { GoogleSheetsSyncService } from './google-sheets-sync';
import { getEventRequestsGoogleSheetsService } from './google-sheets-event-requests-sync';
import { db } from './db.js';
import { sql } from 'drizzle-orm';
import { createServiceLogger } from './utils/logger.js';

const syncLogger = createServiceLogger('background-sync');

export class BackgroundSyncService {
  private syncInterval: NodeJS.Timeout | null = null;
  private isRunning = false;

  constructor(private storage: IStorage) {}

  /**
   * Start automatic background sync every 5 minutes
   */
  start() {
    if (this.isRunning) {
      console.log('⚠ Background sync already running');
      return;
    }

    console.log('🚀 Starting background Google Sheets sync service...');
    this.isRunning = true;

    // Run sync immediately on startup
    this.performSync();

    // Set up recurring sync every 5 minutes
    this.syncInterval = setInterval(
      () => {
        this.performSync();
      },
      5 * 60 * 1000
    ); // 5 minutes

    console.log('✅ Background sync service started - syncing every 5 minutes');
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
   * Sync projects from Google Sheets
   */
  private async syncProjects() {
    try {
      const projectSyncService = new GoogleSheetsSyncService(this.storage);
      const result = await projectSyncService.syncFromGoogleSheets();

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
   */
  private async autoTransitionPastEvents() {
    try {
      syncLogger.info('Starting auto-transition of past events');
      
      // Get all scheduled event requests
      const allEventRequests = await this.storage.getAllEventRequests();
      const scheduledEvents = allEventRequests.filter(event => event.status === 'scheduled');
      
      if (scheduledEvents.length === 0) {
        syncLogger.debug('No scheduled events found for auto-transition');
        return;
      }

      const today = new Date();
      today.setHours(23, 59, 59, 999); // End of today for comparison
      
      let transitionedCount = 0;
      
      for (const event of scheduledEvents) {
        if (event.desiredEventDate && new Date(event.desiredEventDate) < today) {
          try {
            await this.storage.updateEventRequest(event.id, {
              status: 'completed',
              updatedAt: new Date()
            });
            
            transitionedCount++;
            syncLogger.info('Auto-transitioned past event', {
              eventId: event.id,
              organizationName: event.organizationName,
              desiredEventDate: event.desiredEventDate,
              fromStatus: 'scheduled',
              toStatus: 'completed'
            });
          } catch (updateError) {
            syncLogger.error('Failed to auto-transition event', {
              eventId: event.id,
              error: updateError
            });
          }
        }
      }
      
      if (transitionedCount > 0) {
        console.log(`🗓️ Auto-transitioned ${transitionedCount} past events from scheduled to completed`);
        syncLogger.info('Auto-transition completed', { transitionedCount });
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
