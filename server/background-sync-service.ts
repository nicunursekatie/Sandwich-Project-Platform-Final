import { DatabaseStorage } from './database-storage';
import { GoogleSheetsSyncService } from './google-sheets-sync';
import { getEventRequestsGoogleSheetsService } from './google-sheets-event-requests-sync';

export class BackgroundSyncService {
  private syncInterval: NodeJS.Timeout | null = null;
  private isRunning = false;

  constructor(private storage: DatabaseStorage) {}

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
    this.syncInterval = setInterval(() => {
      this.performSync();
    }, 5 * 60 * 1000); // 5 minutes

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
   */
  private async performSync() {
    console.log('📊 Starting automated background sync...');

    try {
      // Sync Projects from Google Sheets
      await this.syncProjects();
      
      // Sync Event Requests from Google Sheets
      await this.syncEventRequests();

      console.log('✅ Background sync completed successfully');
    } catch (error) {
      console.error('❌ Background sync failed:', error);
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
        console.log(`📋 Projects sync: ${result.updated || 0} updated, ${result.created || 0} created`);
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
      const eventRequestsSyncService = getEventRequestsGoogleSheetsService(this.storage);
      
      if (!eventRequestsSyncService) {
        console.log('⚠ Event requests sync skipped: Google Sheets service not configured');
        return;
      }

      const result = await eventRequestsSyncService.syncFromGoogleSheets();
      
      if (result.success) {
        console.log(`📝 Event requests sync: ${result.updated || 0} updated, ${result.created || 0} created`);
      } else {
        console.log('⚠ Event requests sync skipped:', result.message);
      }
    } catch (error) {
      console.error('❌ Event requests sync error:', error);
    }
  }

  /**
   * Get sync status
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      nextSyncIn: this.syncInterval ? '5 minutes' : 'Not scheduled'
    };
  }
}

// Global instance
let backgroundSyncService: BackgroundSyncService | null = null;

export function startBackgroundSync(storage: DatabaseStorage) {
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