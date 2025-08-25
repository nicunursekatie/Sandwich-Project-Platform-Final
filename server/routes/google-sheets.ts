import { Router } from 'express';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { db } from '../db';
import { googleSheets, insertGoogleSheetSchema } from '@shared/schema';
import { isAuthenticated } from '../temp-auth';

const router = Router();

// Helper function to generate URLs from sheet ID
function generateSheetUrls(sheetId: string) {
  const embedUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/edit?usp=sharing&widget=true&headers=false`;
  const directUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/edit?usp=sharing`;
  return { embedUrl, directUrl };
}

// Get all Google Sheets
router.get('/', async (req, res) => {
  try {
    const sheets = await db
      .select()
      .from(googleSheets)
      .orderBy(googleSheets.createdAt);

    res.json(sheets);
  } catch (error) {
    console.error('Error fetching Google Sheets:', error);
    res.status(500).json({ message: 'Failed to fetch Google Sheets' });
  }
});

// Get a specific Google Sheet
router.get('/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ message: 'Invalid sheet ID' });
    }

    const [sheet] = await db
      .select()
      .from(googleSheets)
      .where(eq(googleSheets.id, id));

    if (!sheet) {
      return res.status(404).json({ message: 'Google Sheet not found' });
    }

    res.json(sheet);
  } catch (error) {
    console.error('Error fetching Google Sheet:', error);
    res.status(500).json({ message: 'Failed to fetch Google Sheet' });
  }
});

// Create a new Google Sheet entry
router.post('/', isAuthenticated, async (req, res) => {
  try {
    const validatedData = insertGoogleSheetSchema.parse(req.body);
    const { embedUrl, directUrl } = generateSheetUrls(validatedData.sheetId);
    
    const user = (req as any).user;
    const userId = user?.id || user?.claims?.sub;

    const [newSheet] = await db
      .insert(googleSheets)
      .values({
        ...validatedData,
        embedUrl,
        directUrl,
        createdBy: userId,
      })
      .returning();

    res.status(201).json(newSheet);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ 
        message: 'Invalid input data',
        errors: error.errors 
      });
    }
    
    console.error('Error creating Google Sheet:', error);
    res.status(500).json({ message: 'Failed to create Google Sheet' });
  }
});

// Update a Google Sheet
router.patch('/:id', isAuthenticated, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ message: 'Invalid sheet ID' });
    }

    const updateData = insertGoogleSheetSchema.partial().parse(req.body);
    
    // If sheetId is being updated, regenerate URLs
    let urlData = {};
    if (updateData.sheetId) {
      const { embedUrl, directUrl } = generateSheetUrls(updateData.sheetId);
      urlData = { embedUrl, directUrl };
    }

    const [updatedSheet] = await db
      .update(googleSheets)
      .set({
        ...updateData,
        ...urlData,
        updatedAt: new Date(),
      })
      .where(eq(googleSheets.id, id))
      .returning();

    if (!updatedSheet) {
      return res.status(404).json({ message: 'Google Sheet not found' });
    }

    res.json(updatedSheet);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ 
        message: 'Invalid input data',
        errors: error.errors 
      });
    }
    
    console.error('Error updating Google Sheet:', error);
    res.status(500).json({ message: 'Failed to update Google Sheet' });
  }
});

// Delete a Google Sheet
router.delete('/:id', isAuthenticated, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ message: 'Invalid sheet ID' });
    }

    const [deletedSheet] = await db
      .delete(googleSheets)
      .where(eq(googleSheets.id, id))
      .returning();

    if (!deletedSheet) {
      return res.status(404).json({ message: 'Google Sheet not found' });
    }

    res.json({ message: 'Google Sheet deleted successfully' });
  } catch (error) {
    console.error('Error deleting Google Sheet:', error);
    res.status(500).json({ message: 'Failed to delete Google Sheet' });
  }
});

// Test Google Sheet accessibility
router.post('/:id/test', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ message: 'Invalid sheet ID' });
    }

    const [sheet] = await db
      .select()
      .from(googleSheets)
      .where(eq(googleSheets.id, id));

    if (!sheet) {
      return res.status(404).json({ message: 'Google Sheet not found' });
    }

    // Test if the sheet is accessible by making a simple HTTP request
    const response = await fetch(sheet.directUrl, { method: 'HEAD' });
    
    res.json({ 
      accessible: response.ok,
      status: response.status,
      message: response.ok ? 'Sheet is accessible' : 'Sheet may not be publicly accessible'
    });
  } catch (error) {
    console.error('Error testing Google Sheet accessibility:', error);
    res.json({ 
      accessible: false,
      message: 'Unable to test sheet accessibility'
    });
  }
});

// Analyze the structure of the target Google Sheet
router.get('/sync/analyze', async (req, res) => {
  try {
    const { GoogleSheetsSyncService } = await import('../google-sheets-sync');
    const { StorageWrapper } = await import('../storage-wrapper');
    const storage = new StorageWrapper();
    const syncService = new GoogleSheetsSyncService(storage);
    
    const sheetName = req.query.sheet as string || 'Sheet1';
    const analysis = await syncService.analyzeSheetStructure(sheetName);
    
    res.json({
      success: true,
      analysis,
      sheetUrl: `https://docs.google.com/spreadsheets/d/1mjx5o6boluo8mNx8tzAV76NBGS6tF0um2Rq9bIdxPo8/edit`,
      targetSpreadsheetId: '1mjx5o6boluo8mNx8tzAV76NBGS6tF0um2Rq9bIdxPo8'
    });
  } catch (error) {
    console.error('Error analyzing Google Sheet:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Google Sheets analysis failed. Please check API credentials.',
      error: error.message 
    });
  }
});

// Import data from the target Google Sheet to database
router.post('/sync/import', isAuthenticated, async (req, res) => {
  try {
    const { GoogleSheetsSyncService } = await import('../google-sheets-sync');
    const { StorageWrapper } = await import('../storage-wrapper');
    const storage = new StorageWrapper();
    const syncService = new GoogleSheetsSyncService(storage);
    
    const { 
      sheetName = 'Sheet1',
      dateColumn,
      hostColumn, 
      sandwichColumn,
      groupColumn,
      skipRows = 1,
      dryRun = false
    } = req.body;

    const result = await syncService.importFromGoogleSheet(sheetName, {
      dateColumn,
      hostColumn,
      sandwichColumn,
      groupColumn,
      skipRows,
      dryRun
    });

    res.json({
      success: true,
      result,
      message: dryRun 
        ? `Preview complete: ${result.preview?.length || 0} rows analyzed`
        : `Import complete: ${result.imported} records imported, ${result.skipped} skipped`
    });
  } catch (error) {
    console.error('Error importing from Google Sheet:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Google Sheets import failed',
      error: error.message 
    });
  }
});

// Export database data to Google Sheet
router.post('/sync/export', isAuthenticated, async (req, res) => {
  try {
    const { GoogleSheetsSyncService } = await import('../google-sheets-sync');
    const { StorageWrapper } = await import('../storage-wrapper');
    const storage = new StorageWrapper();
    const syncService = new GoogleSheetsSyncService(storage);
    
    const { sheetName = 'Database_Export' } = req.body;
    const result = await syncService.exportToGoogleSheet(sheetName);

    res.json({
      success: true,
      result,
      message: `Export complete: ${result.exported} records exported to ${sheetName}`
    });
  } catch (error) {
    console.error('Error exporting to Google Sheet:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Google Sheets export failed',
      error: error.message 
    });
  }
});

// Project Management Sync Endpoints
// ===================================

// Get sync status for all projects
router.get('/projects/sync/status', isAuthenticated, async (req, res) => {
  try {
    const { storage } = await import('../storage-wrapper');
    const projects = await storage.getAllProjects();
    
    const syncStats = {
      total: projects.length,
      synced: projects.filter(p => p.syncStatus === 'synced').length,
      unsynced: projects.filter(p => p.syncStatus === 'unsynced' || !p.syncStatus).length,
      conflicted: projects.filter(p => p.syncStatus === 'conflict').length,
      lastSync: projects
        .filter(p => p.lastSyncedAt)
        .sort((a, b) => new Date(b.lastSyncedAt).getTime() - new Date(a.lastSyncedAt).getTime())[0]?.lastSyncedAt,
      projects: projects.map(p => ({
        id: p.id,
        title: p.title,
        syncStatus: p.syncStatus || 'unsynced',
        lastSyncedAt: p.lastSyncedAt,
        googleSheetRowId: p.googleSheetRowId
      }))
    };

    res.json(syncStats);
  } catch (error) {
    console.error('Error fetching sync status:', error);
    res.status(500).json({ 
      error: 'Failed to fetch sync status',
      message: error.message
    });
  }
});

// Sync projects TO Google Sheets
router.post('/projects/sync/to-sheets', isAuthenticated, async (req, res) => {
  try {
    const { getGoogleSheetsSyncService } = await import('../google-sheets-sync');
    const { storage } = await import('../storage-wrapper');
    
    const syncService = getGoogleSheetsSyncService(storage);
    const result = await syncService.syncToGoogleSheets();

    if (result.success) {
      res.json({
        success: true,
        message: result.message,
        synced: result.synced
      });
    } else {
      res.status(400).json({
        success: false,
        error: result.message
      });
    }
  } catch (error) {
    console.error('Error syncing to Google Sheets:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to sync to Google Sheets',
      message: error.message
    });
  }
});

// Sync projects FROM Google Sheets
router.post('/projects/sync/from-sheets', isAuthenticated, async (req, res) => {
  try {
    const { getGoogleSheetsSyncService } = await import('../google-sheets-sync');
    const { storage } = await import('../storage-wrapper');
    
    const syncService = getGoogleSheetsSyncService(storage);
    const result = await syncService.syncFromGoogleSheets();

    if (result.success) {
      res.json({
        success: true,
        message: result.message,
        updated: result.updated,
        created: result.created
      });
    } else {
      res.status(400).json({
        success: false,
        error: result.message
      });
    }
  } catch (error) {
    console.error('Error syncing from Google Sheets:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to sync from Google Sheets',
      message: error.message
    });
  }
});

// Bidirectional project sync
router.post('/projects/sync/bidirectional', isAuthenticated, async (req, res) => {
  try {
    const { getGoogleSheetsSyncService } = await import('../google-sheets-sync');
    const { storage } = await import('../storage-wrapper');
    
    const syncService = getGoogleSheetsSyncService(storage);
    const result = await syncService.bidirectionalSync();

    if (result.success) {
      res.json({
        success: true,
        message: result.message,
        details: result.details
      });
    } else {
      res.status(400).json({
        success: false,
        error: result.message
      });
    }
  } catch (error) {
    console.error('Error performing bidirectional sync:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to perform bidirectional sync',
      message: error.message
    });
  }
});

// Check Google Sheets configuration
router.get('/projects/config/check', async (req, res) => {
  try {
    const requiredEnvVars = [
      'GOOGLE_PROJECT_ID',
      'GOOGLE_CLIENT_EMAIL', 
      'GOOGLE_PRIVATE_KEY',
      'GOOGLE_SPREADSHEET_ID'
    ];

    const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
    const isConfigured = missingVars.length === 0;

    res.json({
      configured: isConfigured,
      missingVariables: missingVars,
      spreadsheetId: process.env.GOOGLE_SPREADSHEET_ID || null,
      worksheetName: process.env.GOOGLE_WORKSHEET_NAME || 'Sheet1'
    });
  } catch (error) {
    console.error('Error checking configuration:', error);
    res.status(500).json({ 
      configured: false,
      error: 'Failed to check configuration',
      message: error.message
    });
  }
});

// Append-only sync (safe for formatted sheets)
router.post('/projects/sync/append-only', isAuthenticated, async (req, res) => {
  try {
    const { getGoogleSheetsService } = await import('../google-sheets-service');
    
    const config = {
      spreadsheetId: process.env.GOOGLE_SPREADSHEET_ID,
      worksheetName: process.env.GOOGLE_WORKSHEET_NAME || 'Sheet1'
    };

    const sheetsService = getGoogleSheetsService(config);
    if (!sheetsService) {
      return res.status(500).json({
        success: false,
        error: 'Google Sheets service not configured'
      });
    }

    // Get projects from database
    const { storage } = await import('../storage-wrapper');
    const projects = await storage.getAllProjects();
    
    // Convert to sheet format
    const sheetRows = [];
    for (const project of projects) {
      const projectTasks = await storage.getProjectTasks(project.id);
      const formattedTasks = projectTasks
        .map(task => {
          const assignee = task.assigneeName || (task.assigneeNames && task.assigneeNames[0]);
          return assignee ? `• ${task.title}: ${assignee}` : `• ${task.title}`;
        })
        .join('\n');

      sheetRows.push({
        task: project.title,
        reviewStatus: project.reviewInNextMeeting ? 'P1' : '',
        priority: project.priority || 'Medium',
        owner: project.assigneeName || project.assigneeNames || '',
        supportPeople: project.supportPeople || '',
        status: project.status || 'Not started',
        startDate: project.startDate || '',
        endDate: project.dueDate || '',
        milestone: project.category || '',
        subTasksOwners: formattedTasks,
        deliverable: project.deliverables || '',
        notes: project.notes || project.description || ''
      });
    }

    const result = await sheetsService.appendOnlySync(sheetRows);

    res.json({
      success: true,
      message: `Append-only sync complete: ${result.added} new projects added, ${result.skipped} existing projects skipped`,
      added: result.added,
      skipped: result.skipped
    });
  } catch (error) {
    console.error('Error in append-only sync:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to perform append-only sync',
      message: error.message
    });
  }
});

// Mark project for review in next meeting
router.post('/projects/:id/mark-for-review', isAuthenticated, async (req, res) => {
  try {
    const projectId = parseInt(req.params.id);
    const { reviewInNextMeeting } = req.body;
    const { storage } = await import('../storage-wrapper');

    if (isNaN(projectId)) {
      return res.status(400).json({ error: 'Invalid project ID' });
    }

    await storage.updateProject(projectId, { 
      reviewInNextMeeting: Boolean(reviewInNextMeeting),
      updatedAt: new Date().toISOString()
    });

    res.json({
      success: true,
      message: `Project ${reviewInNextMeeting ? 'marked' : 'unmarked'} for review in next meeting`
    });
  } catch (error) {
    console.error('Error updating project review status:', error);
    res.status(500).json({ 
      error: 'Failed to update project review status',
      message: error.message
    });
  }
});

// Bidirectional sync between database and Google Sheet
router.post('/sync/bidirectional', isAuthenticated, async (req, res) => {
  try {
    const { GoogleSheetsSyncService } = await import('../google-sheets-sync');
    const { StorageWrapper } = await import('../storage-wrapper');
    const storage = new StorageWrapper();
    const syncService = new GoogleSheetsSyncService(storage);
    
    const { 
      importFrom = 'Sheet1',
      exportTo = 'Database_Export',
      direction = 'both'
    } = req.body;

    const result = await syncService.syncWithGoogleSheet({
      importFrom,
      exportTo,
      direction
    });

    res.json({
      success: true,
      result,
      message: `Sync complete: ${result.syncSummary}`
    });
  } catch (error) {
    console.error('Error syncing with Google Sheet:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Google Sheets sync failed',
      error: error.message 
    });
  }
});

// Test endpoint using service account JSON directly
router.post('/test-direct-auth', async (req, res) => {
  try {
    const { google } = await import('googleapis');
    
    // Use the service account credentials directly (matching your JSON file)
    const credentials = {
      type: 'service_account',
      project_id: 'robust-cycle-454402-s6',
      private_key_id: '0cd197ef614d36dcf29cb22074c2b02a1a58e945',
      private_key: `-----BEGIN PRIVATE KEY-----
MIIEvwIBADANBgkqhkiG9w0BAQEFAASCBKkwggSlAgEAAoIBAQDE9P7yeKo1LFSw
MoxRrVpjEHc9S4nts1IUKt+tliStCvINITCN8cZIN6giaVJ+/6dpQB9XlHwpinA0
BcK2eLeJ+FEsQOzOVb+Pv2y/lsLowfvkx0x+V1NT990PhasJanA50Vx10Q0+fnxP
+1YDltXTrtHsbdLo0Y+L6KFUr5CsS3a65zB0AxeKBgftqWoHt3ru+ldlBkItEEa/
Jz9yMPoLe9+1w6sP0IPpyK1RRdPtZe7ACSe7a7YX5635V84EVrog93kBeN7du6ZM
LLMwtFRnbM8B8XV9ECMqIJNBHdYcjkST0iOE0ZvfrB+sFJyVgYo+I4gTGRfMx4DN
TqvVOJ0zAgMBAAECggEAGMsmlOtvscXk21FhrJ5/9F[...truncated for security...]
-----END PRIVATE KEY-----`,
      client_email: 'replit-sheets-access@robust-cycle-454402-s6.iam.gserviceaccount.com',
      client_id: '105718929942176184562',
      auth_uri: 'https://accounts.google.com/o/oauth2/auth',
      token_uri: 'https://oauth2.googleapis.com/token',
      auth_provider_x509_cert_url: 'https://www.googleapis.com/oauth2/v1/certs',
      client_x509_cert_url: 'https://www.googleapis.com/robot/v1/metadata/x509/replit-sheets-access%40robust-cycle-454402-s6.iam.gserviceaccount.com',
      universe_domain: 'googleapis.com'
    };

    const auth = new google.auth.JWT(
      credentials.client_email,
      undefined,
      credentials.private_key,
      ['https://www.googleapis.com/auth/spreadsheets']
    );

    const sheets = google.sheets({ version: 'v4', auth });

    // Test reading your spreadsheet
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: '1qXUDSvjya2mdXLAaIn9QWKhOwb8RlnyD-mjUcufNnQM',
      range: 'Sheet1!A1:L10',
    });

    res.json({ 
      success: true, 
      message: 'Direct auth test successful',
      rowCount: response.data.values?.length || 0
    });
    
  } catch (error) {
    console.error('Direct auth test failed:', error);
    res.status(400).json({ 
      success: false, 
      error: 'Direct auth failed: ' + (error as Error).message 
    });
  }
});

export default router;