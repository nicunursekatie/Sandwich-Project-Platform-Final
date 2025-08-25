import { google } from 'googleapis';
import { JWT } from 'google-auth-library';

export interface GoogleSheetsConfig {
  spreadsheetId: string;
  worksheetName: string;
  credentialsPath?: string;
}

export interface SheetRow {
  task: string;
  reviewStatus: string; // P1, P2, P3, etc. (Column B)
  priority: string;
  owner: string;
  supportPeople: string;
  status: string; // In progress, Not started, etc. (Column F)
  startDate: string;
  endDate: string;
  milestone: string;
  subTasksOwners: string; // Individual sub-tasks within the project (Column J)
  deliverable: string;
  notes: string;
  rowIndex?: number;
}

export class GoogleSheetsService {
  private auth: JWT;
  private sheets: any;

  constructor(private config: GoogleSheetsConfig) {
    this.initializeAuth();
  }

  private async initializeAuth() {
    try {
      console.log('🔧 Initializing Google Sheets authentication...');
      
      // Check for required environment variables
      if (!process.env.GOOGLE_CLIENT_EMAIL || !process.env.GOOGLE_PRIVATE_KEY || !process.env.GOOGLE_PROJECT_ID) {
        throw new Error('Missing Google service account credentials');
      }

      // Create a temporary service account file to avoid OpenSSL issues
      const fs = await import('fs');
      const path = await import('path');
      
      let privateKey = process.env.GOOGLE_PRIVATE_KEY;
      console.log('🔧 Private key format - length:', privateKey.length);
      
      // Handle escaped newlines
      if (privateKey.includes('\\n')) {
        privateKey = privateKey.replace(/\\n/g, '\n');
        console.log('🔧 Converted \\n to actual newlines');
      }
      
      // Create service account JSON content
      const serviceAccountContent = JSON.stringify({
        type: "service_account",
        project_id: process.env.GOOGLE_PROJECT_ID,
        private_key_id: "",
        private_key: privateKey,
        client_email: process.env.GOOGLE_CLIENT_EMAIL,
        client_id: "",
        auth_uri: "https://accounts.google.com/o/oauth2/auth",
        token_uri: "https://oauth2.googleapis.com/token",
        auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs"
      }, null, 2);
      
      // Write to temp file
      const tempFilePath = path.join(process.cwd(), 'google-service-account.json');
      fs.writeFileSync(tempFilePath, serviceAccountContent);
      console.log('🔧 Created temporary service account file');

      // Use file-based authentication (often resolves OpenSSL issues)
      const auth = new google.auth.GoogleAuth({
        keyFile: tempFilePath,
        scopes: ['https://www.googleapis.com/auth/spreadsheets']
      });

      const authClient = await auth.getClient();
      this.auth = authClient as JWT;
      this.sheets = google.sheets({ version: 'v4', auth: authClient });
      
      console.log('✅ Google Sheets file-based authentication successful');
      
      // Clean up temp file after successful auth
      fs.unlinkSync(tempFilePath);
      console.log('🔧 Cleaned up temporary service account file');
      
    } catch (error) {
      console.error('❌ Google Sheets authentication failed:', error.message);
      if (error.message.includes('DECODER')) {
        console.error('💡 This is a Node.js v20 OpenSSL compatibility issue with the private key format');
        console.error('💡 The private key from your Google Cloud Console may need to be regenerated for Node.js v20+');
      }
      
      // Clean up temp file on error
      try {
        const fs = await import('fs');
        const path = await import('path');
        const tempFilePath = path.join(process.cwd(), 'google-service-account.json');
        if (fs.existsSync(tempFilePath)) {
          fs.unlinkSync(tempFilePath);
        }
      } catch (cleanupError) {
        // Ignore cleanup errors
      }
      
      throw new Error('Failed to initialize Google Sheets service');
    }
  }

  /**
   * Read all rows from the Google Sheet
   */
  async readSheet(): Promise<SheetRow[]> {
    try {
      const response = await this.sheets.spreadsheets.values.get({
        spreadsheetId: this.config.spreadsheetId,
        range: `${this.config.worksheetName}!A:L`, // A through L columns (added Tasks column)
      });

      const rows = response.data.values || [];
      if (rows.length === 0) return [];

      // Skip header row and parse data
      const dataRows = rows.slice(1);
      return dataRows.map((row: any[], index: number) => ({
        task: row[0] || '', // Column A: Task
        reviewStatus: row[1] || '', // Column B: Review Status (P1, P2, etc.)
        priority: row[2] || '', // Column C: Priority
        owner: row[3] || '', // Column D: Owner
        supportPeople: row[4] || '', // Column E: Support people
        status: row[5] || '', // Column F: Status (actual project status)
        startDate: row[6] || '', // Column G: Start
        endDate: row[7] || '', // Column H: End date
        milestone: row[8] || '', // Column I: Milestone
        subTasksOwners: row[9] || '', // Column J: Sub-Tasks | Owners
        deliverable: row[10] || '', // Column K: Deliverable
        notes: row[11] || '', // Column L: Notes
        rowIndex: index + 2, // +2 because sheets are 1-indexed and we skip header
      }));
    } catch (error) {
      console.error('Error reading Google Sheet:', error);
      throw new Error('Failed to read from Google Sheets');
    }
  }

  /**
   * Write or update rows in the Google Sheet (preserves formatting)
   */
  async updateSheet(rows: SheetRow[]): Promise<boolean> {
    try {
      // Get existing data to identify what rows to update vs append
      const existingRows = await this.readSheet();
      const existingRowMap = new Map();
      existingRows.forEach(row => {
        if (row.task && row.rowIndex) {
          existingRowMap.set(row.task.toLowerCase().trim(), row.rowIndex);
        }
      });

      const updates: any[] = [];
      const newRows: any[] = [];

      for (const row of rows) {
        const rowData = [
          row.task, // Column A
          row.reviewStatus, // Column B
          row.priority, // Column C
          row.owner, // Column D
          row.supportPeople, // Column E
          row.status, // Column F
          row.startDate, // Column G
          row.endDate, // Column H
          row.milestone, // Column I
          row.subTasksOwners, // Column J
          row.deliverable, // Column K
          row.notes // Column L
        ];

        // Check if this project already exists in the sheet
        const existingRowIndex = existingRowMap.get(row.task.toLowerCase().trim());
        
        if (existingRowIndex) {
          // Update existing row
          updates.push({
            range: `${this.config.worksheetName}!A${existingRowIndex}:L${existingRowIndex}`,
            values: [rowData]
          });
        } else {
          // New row to append
          newRows.push(rowData);
        }
      }

      // Batch update existing rows (preserves formatting)
      if (updates.length > 0) {
        await this.sheets.spreadsheets.values.batchUpdate({
          spreadsheetId: this.config.spreadsheetId,
          resource: {
            valueInputOption: 'USER_ENTERED',
            data: updates
          }
        });
        console.log(`Updated ${updates.length} existing rows`);
      }

      // Append new rows
      if (newRows.length > 0) {
        await this.sheets.spreadsheets.values.append({
          spreadsheetId: this.config.spreadsheetId,
          range: `${this.config.worksheetName}!A:L`,
          valueInputOption: 'USER_ENTERED',
          resource: {
            values: newRows
          }
        });
        console.log(`Added ${newRows.length} new rows`);
      }

      return true;
    } catch (error) {
      console.error('Error updating Google Sheet:', error);
      throw new Error('Failed to update Google Sheets');
    }
  }

  /**
   * Safe append-only mode for highly formatted sheets
   */
  async appendOnlySync(rows: SheetRow[]): Promise<{ added: number; skipped: number }> {
    try {
      // Get existing project titles to avoid duplicates
      const existingRows = await this.readSheet();
      const existingTitles = new Set(existingRows.map(row => row.task.toLowerCase().trim()));

      // Only append truly new projects
      const newRows = rows
        .filter(row => row.task && !existingTitles.has(row.task.toLowerCase().trim()))
        .map(row => [
          row.task,
          row.reviewStatus,
          row.priority,
          row.owner,
          row.supportPeople,
          row.status,
          row.startDate,
          row.endDate,
          row.milestone,
          row.subTasksOwners,
          row.deliverable,
          row.notes
        ]);

      if (newRows.length > 0) {
        await this.sheets.spreadsheets.values.append({
          spreadsheetId: this.config.spreadsheetId,
          range: `${this.config.worksheetName}!A:L`,
          valueInputOption: 'USER_ENTERED',
          resource: {
            values: newRows
          }
        });
      }

      return {
        added: newRows.length,
        skipped: rows.length - newRows.length
      };
    } catch (error) {
      console.error('Error in append-only sync:', error);
      throw new Error('Failed to perform append-only sync');
    }
  }

  /**
   * Add header row to the sheet if needed
   */
  async ensureHeaders(): Promise<void> {
    try {
      const headers = [
        'Task', // Column A (Project title)
        'Status', // Column B (Review Status: P1, P2, etc.)
        'Priority', // Column C
        'Owner', // Column D
        'Support people', // Column E
        'Status', // Column F (Actual project status)
        'Start', // Column G
        'End date', // Column H
        'Milestone', // Column I
        'Sub-Tasks | Owners', // Column J (Individual tasks within project)
        'Deliverable', // Column K
        'Notes' // Column L
      ];

      await this.sheets.spreadsheets.values.update({
        spreadsheetId: this.config.spreadsheetId,
        range: `${this.config.worksheetName}!A1:L1`,
        valueInputOption: 'USER_ENTERED',
        requestBody: {
          values: [headers]
        }
      });
    } catch (error) {
      console.error('Error setting headers:', error);
      throw new Error('Failed to set sheet headers');
    }
  }

  /**
   * Parse tasks and owners from text format
   */
  parseTasksAndOwners(text: string): Array<{ task: string, owner: string | null }> {
    if (!text || typeof text !== 'string') return [];

    const tasks: Array<{ task: string, owner: string | null }> = [];
    
    // Split by commas first
    const segments = text.split(',').map(s => s.trim());
    
    for (const segment of segments) {
      // Look for "Name: Task" format
      const colonMatch = segment.match(/^([^:]+):\s*(.+)$/);
      if (colonMatch) {
        const owner = colonMatch[1].trim();
        const task = colonMatch[2].trim();
        tasks.push({ task, owner });
        continue;
      }
      
      // Look for "Task (Name)" format
      const parenMatch = segment.match(/^(.+?)\s*\(([^)]+)\)$/);
      if (parenMatch) {
        const task = parenMatch[1].trim();
        const owner = parenMatch[2].trim();
        tasks.push({ task, owner });
        continue;
      }
      
      // Just a task with no owner
      if (segment) {
        tasks.push({ task: segment, owner: null });
      }
    }
    
    return tasks;
  }

  /**
   * Format tasks and owners into text format
   */
  formatTasksAndOwners(tasks: Array<{ task: string, owner: string | null }>): string {
    return tasks
      .map(({ task, owner }) => owner ? `${owner}: ${task}` : task)
      .join(', ');
  }

  private parseBoolean(value: any): boolean {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'string') {
      return ['yes', 'true', '1', 'on'].includes(value.toLowerCase());
    }
    return false;
  }
}

// Export singleton instance
let sheetsService: GoogleSheetsService | null = null;

export function getGoogleSheetsService(): GoogleSheetsService | null {
  if (!process.env.GOOGLE_PROJECT_ID || !process.env.GOOGLE_CLIENT_EMAIL || !process.env.GOOGLE_PRIVATE_KEY) {
    console.log('Google Sheets service not configured - missing environment variables');
    return null;
  }

  if (!sheetsService) {
    const config: GoogleSheetsConfig = {
      spreadsheetId: process.env.GOOGLE_SPREADSHEET_ID || '',
      worksheetName: process.env.GOOGLE_WORKSHEET_NAME || 'Sheet1'
    };
    
    if (!config.spreadsheetId) {
      console.log('Google Sheets service not configured - missing GOOGLE_SPREADSHEET_ID');
      return null;
    }

    sheetsService = new GoogleSheetsService(config);
  }

  return sheetsService;
}