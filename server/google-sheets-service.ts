import { google } from 'googleapis';
import { JWT } from 'google-auth-library';

export interface GoogleSheetsConfig {
  spreadsheetId: string;
  worksheetName: string;
  credentialsPath?: string;
}

export interface SheetRow {
  task: string;
  priority: string;
  owner: string;
  support: string;
  status: string;
  startDate: string;
  endDate: string;
  milestone: string;
  deliverable: string;
  notes: string;
  reviewInNextMeeting: boolean;
  tasksAndOwners: string;
  lastUpdated: string;
  appStatus: string;
}

export class GoogleSheetsService {
  private auth: JWT;
  private sheets: any;

  constructor(private config: GoogleSheetsConfig) {
    this.initializeAuth();
  }

  private async initializeAuth() {
    try {
      // Use service account credentials from environment
      const credentials = {
        type: 'service_account',
        project_id: process.env.GOOGLE_PROJECT_ID,
        private_key_id: process.env.GOOGLE_PRIVATE_KEY_ID,
        private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
        client_email: process.env.GOOGLE_CLIENT_EMAIL,
        client_id: process.env.GOOGLE_CLIENT_ID,
        auth_uri: 'https://accounts.google.com/o/oauth2/auth',
        token_uri: 'https://oauth2.googleapis.com/token',
        auth_provider_x509_cert_url: 'https://www.googleapis.com/oauth2/v1/certs',
        client_x509_cert_url: `https://www.googleapis.com/robot/v1/metadata/x509/${process.env.GOOGLE_CLIENT_EMAIL}`,
      };

      this.auth = new google.auth.JWT(
        credentials.client_email,
        undefined,
        credentials.private_key,
        ['https://www.googleapis.com/auth/spreadsheets']
      );

      this.sheets = google.sheets({ version: 'v4', auth: this.auth });
    } catch (error) {
      console.error('Google Sheets authentication failed:', error);
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
        range: `${this.config.worksheetName}!A:N`, // Adjust range based on columns
      });

      const rows = response.data.values || [];
      if (rows.length === 0) return [];

      // Skip header row and parse data
      const dataRows = rows.slice(1);
      return dataRows.map((row: any[], index: number) => ({
        task: row[0] || '',
        priority: row[1] || '',
        owner: row[2] || '',
        support: row[3] || '',
        status: row[4] || '',
        startDate: row[5] || '',
        endDate: row[6] || '',
        milestone: row[7] || '',
        deliverable: row[8] || '',
        notes: row[9] || '',
        reviewInNextMeeting: this.parseBoolean(row[10]),
        tasksAndOwners: row[11] || '',
        lastUpdated: row[12] || '',
        appStatus: row[13] || 'unsynced',
        rowIndex: index + 2, // +2 because sheets are 1-indexed and we skip header
      }));
    } catch (error) {
      console.error('Error reading Google Sheet:', error);
      throw new Error('Failed to read from Google Sheets');
    }
  }

  /**
   * Write or update rows in the Google Sheet
   */
  async updateSheet(rows: SheetRow[]): Promise<boolean> {
    try {
      const values = rows.map(row => [
        row.task,
        row.priority,
        row.owner,
        row.support,
        row.status,
        row.startDate,
        row.endDate,
        row.milestone,
        row.deliverable,
        row.notes,
        row.reviewInNextMeeting ? 'YES' : 'NO',
        row.tasksAndOwners,
        new Date().toISOString(),
        'synced'
      ]);

      // Clear existing data and write new data
      await this.sheets.spreadsheets.values.clear({
        spreadsheetId: this.config.spreadsheetId,
        range: `${this.config.worksheetName}!A2:N`,
      });

      await this.sheets.spreadsheets.values.update({
        spreadsheetId: this.config.spreadsheetId,
        range: `${this.config.worksheetName}!A2:N`,
        valueInputOption: 'USER_ENTERED',
        requestBody: {
          values
        }
      });

      return true;
    } catch (error) {
      console.error('Error updating Google Sheet:', error);
      throw new Error('Failed to update Google Sheets');
    }
  }

  /**
   * Add header row to the sheet if needed
   */
  async ensureHeaders(): Promise<void> {
    try {
      const headers = [
        'Task',
        'Priority', 
        'Owner',
        'Support',
        'Status',
        'Start Date',
        'End Date',
        'Milestone',
        'Deliverable',
        'Notes',
        'Review Next Meeting',
        'Tasks & Owners',
        'Last Updated',
        'App Status'
      ];

      await this.sheets.spreadsheets.values.update({
        spreadsheetId: this.config.spreadsheetId,
        range: `${this.config.worksheetName}!A1:N1`,
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