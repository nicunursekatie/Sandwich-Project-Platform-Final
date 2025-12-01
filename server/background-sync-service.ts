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
  private lastSuccessfulSync: Date | null = null;
  private consecutiveFailures = 0;
  private lastAlertSent: Date | null = null;
  private readonly ALERT_COOLDOWN_MINUTES = 60; // Don't spam emails - max one per hour
  private readonly FAILURE_THRESHOLD = 3; // Alert after 3 consecutive failures
  private readonly STALE_SYNC_THRESHOLD_MINUTES = 20; // Alert if no successful sync in 20 minutes

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
            // Check for stale sync even if sync attempt failed
            this.checkStaleSync().catch(err => {
              logger.error('Error checking stale sync:', err);
            });
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
  async stop() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
    const wasRunning = this.isRunning;
    this.isRunning = false;
    logger.log('🛑 Background sync service stopped');
    
    // Send alert if service was running and is being stopped
    if (wasRunning) {
      await this.sendServiceStoppedAlert();
    }
  }

  /**
   * Send email alert when sync service stops
   */
  private async sendServiceStoppedAlert() {
    try {
      const { sendEmail } = await import('./sendgrid');
      const adminEmail = process.env.ADMIN_EMAIL || 'katie@thesandwichproject.org';
      
      const lastSuccessTime = this.lastSuccessfulSync 
        ? this.lastSuccessfulSync.toLocaleString()
        : 'Never';
      
      await sendEmail({
        to: adminEmail,
        from: process.env.SENDGRID_FROM_EMAIL || 'noreply@sandwichproject.org',
        subject: '🚨 CRITICAL: Event Requests Sync Service Stopped',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <h2 style="color: #d32f2f;">🚨 Event Requests Sync Service Stopped</h2>
            <p><strong>The background sync service has been stopped!</strong></p>
            <p>New event requests from Google Sheets will NOT be automatically imported until the service is restarted.</p>
            
            <div style="background-color: #ffebee; border-left: 4px solid #d32f2f; padding: 15px; margin: 20px 0;">
              <h3 style="margin-top: 0; color: #c62828;">Details:</h3>
              <ul style="margin: 10px 0; padding-left: 20px;">
                <li><strong>Service Status:</strong> Stopped</li>
                <li><strong>Last Successful Sync:</strong> ${lastSuccessTime}</li>
                <li><strong>Consecutive Failures:</strong> ${this.consecutiveFailures}</li>
                <li><strong>Stopped At:</strong> ${new Date().toLocaleString()}</li>
              </ul>
            </div>
            
            <p><strong>Action Required:</strong></p>
            <ol style="margin: 10px 0; padding-left: 20px;">
              <li>Restart the server to restart the sync service</li>
              <li>Or manually trigger syncs until service is restarted</li>
              <li>Check server logs to understand why service stopped</li>
              <li>Manually sync: <code>POST /api/event-requests/sync/from-sheets</code></li>
            </ol>
            
            <p style="color: #d32f2f; font-weight: bold; margin-top: 20px;">
              ⚠️ No new event requests will be imported automatically until the service is restarted!
            </p>
          </div>
        `,
        text: `
🚨 CRITICAL: Event Requests Sync Service Stopped

The background sync service has been stopped!

New event requests from Google Sheets will NOT be automatically imported until the service is restarted.

Details:
- Service Status: Stopped
- Last Successful Sync: ${lastSuccessTime}
- Consecutive Failures: ${this.consecutiveFailures}
- Stopped At: ${new Date().toLocaleString()}

Action Required:
1. Restart the server to restart the sync service
2. Or manually trigger syncs until service is restarted
3. Check server logs to understand why service stopped
4. Manually sync: POST /api/event-requests/sync/from-sheets

⚠️ No new event requests will be imported automatically until the service is restarted!
        `,
      });

      logger.error(`📧 Sent sync service stopped alert email to ${adminEmail}`);
      syncLogger.info('Sync service stopped alert sent');
    } catch (emailError) {
      logger.error('❌ Failed to send sync stopped alert email:', emailError);
      syncLogger.error('Failed to send stopped alert email', { error: emailError });
    }
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
        
        // Reset failure counter on success
        this.consecutiveFailures = 0;
        this.lastSuccessfulSync = new Date();
        
        if (created > 0) {
          logger.log(`✅ ${created} new event request(s) imported from Google Sheets`);
        }
      } else {
        this.consecutiveFailures++;
        logger.warn('⚠ Event requests sync returned failure:', result.message);
        syncLogger.warn('Event requests sync failed', { 
          message: result.message,
          consecutiveFailures: this.consecutiveFailures
        });
        
        // Check if we should send alert
        if (this.consecutiveFailures >= this.FAILURE_THRESHOLD) {
          await this.sendFailureAlert(result.message || 'Unknown error');
        }
      }
    } catch (error) {
      // CRITICAL: Log error but don't throw - we want sync to continue on next interval
      this.consecutiveFailures++;
      logger.error('❌ Event requests sync error:', error);
      syncLogger.error('Event requests sync threw exception', { 
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        consecutiveFailures: this.consecutiveFailures
      });
      
      // Check if we should send alert
      if (this.consecutiveFailures >= this.FAILURE_THRESHOLD) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        await this.sendFailureAlert(errorMessage);
      }
      
      // Don't rethrow - let the service continue running
    }
    
    // Check if sync is stale (no successful sync in threshold time)
    await this.checkStaleSync();
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
   * Check if sync is stale and send alert if needed
   */
  private async checkStaleSync() {
    if (!this.lastSuccessfulSync) {
      // First sync hasn't completed yet - don't alert
      return;
    }

    const minutesSinceLastSuccess = (Date.now() - this.lastSuccessfulSync.getTime()) / (1000 * 60);
    
    if (minutesSinceLastSuccess > this.STALE_SYNC_THRESHOLD_MINUTES) {
      const shouldAlert = !this.lastAlertSent || 
        (Date.now() - this.lastAlertSent.getTime()) > (this.ALERT_COOLDOWN_MINUTES * 60 * 1000);
      
      if (shouldAlert) {
        await this.sendStaleSyncAlert(minutesSinceLastSuccess);
      }
    }
  }

  /**
   * Send email alert when sync fails multiple times
   */
  private async sendFailureAlert(errorMessage: string) {
    const shouldAlert = !this.lastAlertSent || 
      (Date.now() - this.lastAlertSent.getTime()) > (this.ALERT_COOLDOWN_MINUTES * 60 * 1000);
    
    if (!shouldAlert) {
      return; // Still in cooldown period
    }

    try {
      const { sendEmail } = await import('./sendgrid');
      const adminEmail = process.env.ADMIN_EMAIL || 'katie@thesandwichproject.org';
      
      const lastSuccessTime = this.lastSuccessfulSync 
        ? this.lastSuccessfulSync.toLocaleString()
        : 'Never';
      
      await sendEmail({
        to: adminEmail,
        from: process.env.SENDGRID_FROM_EMAIL || 'noreply@sandwichproject.org',
        subject: '🚨 CRITICAL: Event Requests Sync Failing',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <h2 style="color: #d32f2f;">🚨 Event Requests Sync Alert</h2>
            <p><strong>The background sync for event requests from Google Sheets is failing!</strong></p>
            
            <div style="background-color: #ffebee; border-left: 4px solid #d32f2f; padding: 15px; margin: 20px 0;">
              <h3 style="margin-top: 0; color: #c62828;">Details:</h3>
              <ul style="margin: 10px 0; padding-left: 20px;">
                <li><strong>Consecutive Failures:</strong> ${this.consecutiveFailures}</li>
                <li><strong>Last Successful Sync:</strong> ${lastSuccessTime}</li>
                <li><strong>Error:</strong> ${errorMessage}</li>
                <li><strong>Time:</strong> ${new Date().toLocaleString()}</li>
              </ul>
            </div>
            
            <p><strong>Action Required:</strong></p>
            <ol style="margin: 10px 0; padding-left: 20px;">
              <li>Check server logs for detailed error information</li>
              <li>Verify Google Sheets API credentials are valid</li>
              <li>Check if Google Sheet structure has changed</li>
              <li>Manually trigger sync via: <code>POST /api/event-requests/sync/from-sheets</code></li>
              <li>Check sync status via: <code>GET /api/event-requests/sync/status</code></li>
            </ol>
            
            <p style="color: #666; font-size: 0.9em; margin-top: 30px;">
              This alert will not be sent again for ${this.ALERT_COOLDOWN_MINUTES} minutes unless the issue persists.
            </p>
          </div>
        `,
        text: `
🚨 CRITICAL: Event Requests Sync Failing

The background sync for event requests from Google Sheets is failing!

Details:
- Consecutive Failures: ${this.consecutiveFailures}
- Last Successful Sync: ${lastSuccessTime}
- Error: ${errorMessage}
- Time: ${new Date().toLocaleString()}

Action Required:
1. Check server logs for detailed error information
2. Verify Google Sheets API credentials are valid
3. Check if Google Sheet structure has changed
4. Manually trigger sync via: POST /api/event-requests/sync/from-sheets
5. Check sync status via: GET /api/event-requests/sync/status

This alert will not be sent again for ${this.ALERT_COOLDOWN_MINUTES} minutes unless the issue persists.
        `,
      });

      this.lastAlertSent = new Date();
      logger.error(`📧 Sent sync failure alert email to ${adminEmail}`);
      syncLogger.info('Sync failure alert sent', { 
        consecutiveFailures: this.consecutiveFailures,
        errorMessage 
      });
    } catch (emailError) {
      logger.error('❌ Failed to send sync failure alert email:', emailError);
      syncLogger.error('Failed to send alert email', { error: emailError });
    }
  }

  /**
   * Send email alert when sync hasn't run successfully in a while
   */
  private async sendStaleSyncAlert(minutesSinceLastSuccess: number) {
    try {
      const { sendEmail } = await import('./sendgrid');
      const adminEmail = process.env.ADMIN_EMAIL || 'katie@thesandwichproject.org';
      
      const lastSuccessTime = this.lastSuccessfulSync 
        ? this.lastSuccessfulSync.toLocaleString()
        : 'Never';
      
      await sendEmail({
        to: adminEmail,
        from: process.env.SENDGRID_FROM_EMAIL || 'noreply@sandwichproject.org',
        subject: '⚠️ WARNING: Event Requests Sync Stale',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <h2 style="color: #f57c00;">⚠️ Event Requests Sync Stale</h2>
            <p><strong>The background sync hasn't completed successfully in ${Math.round(minutesSinceLastSuccess)} minutes.</strong></p>
            
            <div style="background-color: #fff3e0; border-left: 4px solid #f57c00; padding: 15px; margin: 20px 0;">
              <h3 style="margin-top: 0; color: #e65100;">Details:</h3>
              <ul style="margin: 10px 0; padding-left: 20px;">
                <li><strong>Last Successful Sync:</strong> ${lastSuccessTime}</li>
                <li><strong>Time Since Last Success:</strong> ${Math.round(minutesSinceLastSuccess)} minutes</li>
                <li><strong>Consecutive Failures:</strong> ${this.consecutiveFailures}</li>
                <li><strong>Sync Service Running:</strong> ${this.isRunning ? 'Yes' : 'No'}</li>
                <li><strong>Time:</strong> ${new Date().toLocaleString()}</li>
              </ul>
            </div>
            
            <p><strong>Action Required:</strong></p>
            <ol style="margin: 10px 0; padding-left: 20px;">
              <li>Check if sync service is still running</li>
              <li>Review recent server logs for errors</li>
              <li>Check sync status: <code>GET /api/event-requests/sync/status</code></li>
              <li>Manually trigger sync: <code>POST /api/event-requests/sync/from-sheets</code></li>
            </ol>
            
            <p style="color: #666; font-size: 0.9em; margin-top: 30px;">
              This alert will not be sent again for ${this.ALERT_COOLDOWN_MINUTES} minutes unless the issue persists.
            </p>
          </div>
        `,
        text: `
⚠️ WARNING: Event Requests Sync Stale

The background sync hasn't completed successfully in ${Math.round(minutesSinceLastSuccess)} minutes.

Details:
- Last Successful Sync: ${lastSuccessTime}
- Time Since Last Success: ${Math.round(minutesSinceLastSuccess)} minutes
- Consecutive Failures: ${this.consecutiveFailures}
- Sync Service Running: ${this.isRunning ? 'Yes' : 'No'}
- Time: ${new Date().toLocaleString()}

Action Required:
1. Check if sync service is still running
2. Review recent server logs for errors
3. Check sync status: GET /api/event-requests/sync/status
4. Manually trigger sync: POST /api/event-requests/sync/from-sheets

This alert will not be sent again for ${this.ALERT_COOLDOWN_MINUTES} minutes unless the issue persists.
        `,
      });

      this.lastAlertSent = new Date();
      logger.warn(`📧 Sent stale sync alert email to ${adminEmail}`);
      syncLogger.info('Stale sync alert sent', { 
        minutesSinceLastSuccess,
        consecutiveFailures: this.consecutiveFailures
      });
    } catch (emailError) {
      logger.error('❌ Failed to send stale sync alert email:', emailError);
      syncLogger.error('Failed to send stale alert email', { error: emailError });
    }
  }

  /**
   * Get sync status
   */
  getStatus() {
    const minutesSinceLastSuccess = this.lastSuccessfulSync
      ? Math.round((Date.now() - this.lastSuccessfulSync.getTime()) / (1000 * 60))
      : null;

    return {
      isRunning: this.isRunning,
      nextSyncIn: this.syncInterval ? '5 minutes' : 'Not scheduled',
      lastSuccessfulSync: this.lastSuccessfulSync?.toISOString() || null,
      minutesSinceLastSuccess,
      consecutiveFailures: this.consecutiveFailures,
      isHealthy: this.isRunning && 
        this.lastSuccessfulSync !== null && 
        minutesSinceLastSuccess !== null && 
        minutesSinceLastSuccess < this.STALE_SYNC_THRESHOLD_MINUTES,
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

export async function stopBackgroundSync() {
  if (backgroundSyncService) {
    await backgroundSyncService.stop();
  }
}

export function getBackgroundSyncService() {
  return backgroundSyncService;
}
