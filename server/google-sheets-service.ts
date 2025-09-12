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
  category: string; // Category column (Column I)
  milestone: string; // Milestone column (Column J)
  subTasksOwners: string; // Individual sub-tasks within the project (Column K)
  deliverable: string;
  notes: string;
  lastDiscussedDate: string; // Column N: Last discussed date
  rowIndex?: number;
}

export class GoogleSheetsService {
  private auth: JWT;
  private sheets: any;

  constructor(private config: GoogleSheetsConfig) {
    // Don't call async initialization in constructor
  }

  private async ensureInitialized() {
    if (!this.sheets) {
      await this.initializeAuth();
    }
  }

  private async initializeAuth() {
    try {
      console.log('🔧 Initializing Google Sheets authentication...');
      
      // Run diagnostics if authentication fails repeatedly
      if (process.env.NODE_ENV === 'development') {
        console.log('🔍 Running authentication diagnostics...');
        const { googleSheetsDiagnostics } = await import('./google-sheets-diagnostics');
        const diagnosticResults = await googleSheetsDiagnostics.runFullDiagnostics();
        const criticalIssues = diagnosticResults.filter(r => r.severity === 'critical');
        
        if (criticalIssues.length > 0) {
          console.log('❌ Critical authentication issues detected:');
          criticalIssues.forEach(issue => {
            console.log(`   - ${issue.issue}: ${issue.description}`);
            console.log(`     Solution: ${issue.solution}`);
          });
          googleSheetsDiagnostics.printDiagnosticReport(diagnosticResults);
        }
      }
      
      // Check for required environment variables - use consistent naming
      const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || process.env.GOOGLE_CLIENT_EMAIL;
      const privateKey = process.env.GOOGLE_PRIVATE_KEY;
      const projectId = process.env.GOOGLE_PROJECT_ID;
      
      if (!clientEmail || !privateKey || !projectId) {
        throw new Error('Missing Google service account credentials (GOOGLE_CLIENT_EMAIL, GOOGLE_PRIVATE_KEY, GOOGLE_PROJECT_ID)');
      }

      // Handle private key format more robustly
      let cleanPrivateKey = privateKey;
      
      console.log('🔧 Original private key format check:', {
        hasBackslashN: cleanPrivateKey.includes('\\n'),
        hasRealNewlines: cleanPrivateKey.includes('\n'),
        hasBeginHeader: cleanPrivateKey.includes('-----BEGIN'),
        length: cleanPrivateKey.length,
        firstChars: cleanPrivateKey.substring(0, 50),
        lastChars: cleanPrivateKey.substring(cleanPrivateKey.length - 50)
      });
      
      // Handle escaped newlines in multiple formats
      if (cleanPrivateKey.includes('\\n')) {
        cleanPrivateKey = cleanPrivateKey.replace(/\\n/g, '\n');
        console.log('🔧 Converted \\n to actual newlines');
      }
      
      // Remove any quotes if the entire key is wrapped in quotes
      if ((cleanPrivateKey.startsWith('"') && cleanPrivateKey.endsWith('"')) ||
          (cleanPrivateKey.startsWith("'") && cleanPrivateKey.endsWith("'"))) {
        cleanPrivateKey = cleanPrivateKey.slice(1, -1);
        console.log('🔧 Removed surrounding quotes from private key');
      }
      
      // Ensure proper PEM format
      if (!cleanPrivateKey.includes('-----BEGIN PRIVATE KEY-----')) {
        // If it's just the key content without headers, add them
        cleanPrivateKey = `-----BEGIN PRIVATE KEY-----\n${cleanPrivateKey}\n-----END PRIVATE KEY-----`;
        console.log('🔧 Added PEM headers to private key');
      }
      
      // Clean up any extra whitespace and normalize line endings
      cleanPrivateKey = cleanPrivateKey.trim().replace(/\r\n/g, '\n');
      
      // Ensure proper line breaks in PEM format
      const lines = cleanPrivateKey.split('\n');
      const properLines = [];
      
      for (let line of lines) {
        line = line.trim();
        if (line === '-----BEGIN PRIVATE KEY-----' || line === '-----END PRIVATE KEY-----') {
          properLines.push(line);
        } else if (line.length > 0) {
          // Break long lines into 64-character chunks (standard PEM format)
          while (line.length > 64) {
            properLines.push(line.substring(0, 64));
            line = line.substring(64);
          }
          if (line.length > 0) {
            properLines.push(line);
          }
        }
      }
      
      cleanPrivateKey = properLines.join('\n');
      
      console.log('🔧 Final private key format:', {
        lineCount: cleanPrivateKey.split('\n').length,
        hasProperHeaders: cleanPrivateKey.includes('-----BEGIN PRIVATE KEY-----') && cleanPrivateKey.includes('-----END PRIVATE KEY-----'),
        properFormat: cleanPrivateKey.split('\n')[0] === '-----BEGIN PRIVATE KEY-----'
      });

      // Use GoogleAuth instead of direct JWT for better Node.js v20 compatibility
      try {
        console.log('🔧 Attempting GoogleAuth with service account...');
        
        const credentials = {
          type: "service_account",
          project_id: projectId,
          private_key_id: "",
          private_key: cleanPrivateKey,
          client_email: clientEmail,
          client_id: "",
          auth_uri: "https://accounts.google.com/o/oauth2/auth",
          token_uri: "https://oauth2.googleapis.com/token",
          auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs"
        };

        const auth = new google.auth.GoogleAuth({
          credentials: credentials,
          scopes: ['https://www.googleapis.com/auth/spreadsheets']
        });

        // Get and test the auth client
        const authClient = await auth.getClient();
        this.auth = authClient as JWT;
        this.sheets = google.sheets({ version: 'v4', auth: authClient });
        
        // Test with a simple API call to verify authentication actually works
        console.log('🔧 Testing authentication with real API call...');
        
        try {
          // Make a minimal API call to test authentication
          const testResponse = await this.sheets.spreadsheets.get({
            spreadsheetId: this.config.spreadsheetId || '1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms', // Use fallback spreadsheet for test
            fields: 'spreadsheetId,properties.title'
          });
          
          console.log('✅ Authentication test successful:', {
            spreadsheetId: testResponse.data.spreadsheetId,
            title: testResponse.data.properties?.title || 'Unknown'
          });
        } catch (testError) {
          console.error('❌ Authentication test failed:', testError.message);
          throw new Error(`JWT authentication test failed: ${testError.message}`);
        }
        
        console.log('✅ Google Sheets GoogleAuth authentication fully verified');
        return;
        
      } catch (authError) {
        console.log('⚠️ GoogleAuth failed, trying file-based auth as fallback:', authError.message);
      }

      // Fallback to file-based authentication if JWT fails
      const fs = await import('fs');
      const path = await import('path');
      
      const serviceAccountContent = JSON.stringify({
        type: "service_account",
        project_id: projectId,
        private_key_id: "",
        private_key: cleanPrivateKey,
        client_email: clientEmail,
        client_id: "",
        auth_uri: "https://accounts.google.com/o/oauth2/auth",
        token_uri: "https://oauth2.googleapis.com/token",
        auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs"
      }, null, 2);
      
      const tempFilePath = path.join(process.cwd(), 'google-service-account.json');
      fs.writeFileSync(tempFilePath, serviceAccountContent);
      console.log('🔧 Created temporary service account file');

      const auth = new google.auth.GoogleAuth({
        keyFile: tempFilePath,
        scopes: ['https://www.googleapis.com/auth/spreadsheets']
      });

      const authClient = await auth.getClient();
      this.auth = authClient as JWT;
      this.sheets = google.sheets({ version: 'v4', auth: authClient });
      
      // Test file-based authentication with real API call
      console.log('🔧 Testing file-based authentication with real API call...');
      
      try {
        const testResponse = await this.sheets.spreadsheets.get({
          spreadsheetId: this.config.spreadsheetId || '1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms',
          fields: 'spreadsheetId,properties.title'
        });
        
        console.log('✅ File-based authentication test successful:', {
          spreadsheetId: testResponse.data.spreadsheetId,
          title: testResponse.data.properties?.title || 'Unknown'
        });
      } catch (testError) {
        console.error('❌ File-based authentication test failed:', testError.message);
        throw new Error(`File-based JWT authentication test failed: ${testError.message}`);
      }
      
      console.log('✅ Google Sheets file-based authentication fully verified');
      
      // Clean up temp file
      fs.unlinkSync(tempFilePath);
      console.log('🔧 Cleaned up temporary service account file');
      
    } catch (error) {
      console.error('❌ Google Sheets authentication failed:', error.message);
      if (error.message.includes('DECODER') || error.message.includes('OSSL_UNSUPPORTED')) {
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
      await this.ensureInitialized();
      
      const response = await this.sheets.spreadsheets.values.get({
        spreadsheetId: this.config.spreadsheetId,
        range: `${this.config.worksheetName}!A:N`, // A through N columns (includes Category and Last Discussed Date)
      });

      const rows = response.data.values || [];
      if (rows.length === 0) return [];

      // Skip header row and parse data - accounting for NEW sheet structure with Category
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
        category: row[8] || '', // Column I: Category (NEW - added after end date)
        milestone: row[9] || '', // Column J: Milestone (shifted from I)
        subTasksOwners: row[10] || '', // Column K: Sub-Tasks | Owners (shifted from J)
        deliverable: row[11] || '', // Column L: Deliverable (shifted from K)
        notes: row[12] || '', // Column M: Notes (shifted from L)
        lastDiscussedDate: row[13] || '', // Column N: Last Discussed Date (shifted from M)
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
          row.task, // Column A - Task/Project Title
          row.reviewStatus, // Column B - Review Status (P1, P2, P3) 
          row.priority, // Column C - Priority
          row.owner, // Column D - Owner
          row.supportPeople, // Column E - Support People
          row.status, // Column F - Status (In progress, Completed, etc.)
          row.startDate, // Column G - Start Date
          row.endDate, // Column H - End Date
          row.category, // Column I - Category (NEW - added after end date)
          row.milestone, // Column J - Milestone (shifted from I)
          row.subTasksOwners, // Column K - Sub-Tasks | Owners (shifted from J)
          row.deliverable, // Column L - Deliverable (shifted from K)
          row.notes, // Column M - Notes (shifted from L)
          row.lastDiscussedDate // Column N - Last Discussed Date (shifted from M)
        ];

        // Column mapping: A=task, B=reviewStatus, C=priority, D=owner, E=supportPeople, F=status

        // Check if this project already exists in the sheet
        const existingRowIndex = existingRowMap.get(row.task.toLowerCase().trim());
        
        if (existingRowIndex) {
          // Update existing row - FORCE full row update to fix column mapping
          updates.push({
            range: `${this.config.worksheetName}!A${existingRowIndex}:N${existingRowIndex}`,
            values: [rowData]
          });
          console.log(`🔄 Updating existing row ${existingRowIndex} for: "${row.task}"`);
        } else {
          // New row to append
          newRows.push(rowData);
          console.log(`➕ Adding new row for: "${row.task}"`);
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

      // Insert new rows at specific location (NOT append to avoid column drift)
      if (newRows.length > 0) {
        // Find the last row with data in column A
        const lastRowResponse = await this.sheets.spreadsheets.values.get({
          spreadsheetId: this.config.spreadsheetId,
          range: `${this.config.worksheetName}!A:A`,
        });
        
        const lastRowWithData = lastRowResponse.data.values?.length || 0;
        const insertRowStart = lastRowWithData + 1;
        const insertRowEnd = insertRowStart + newRows.length - 1;
        
        // Insert directly at specific row range in A:N columns
        await this.sheets.spreadsheets.values.update({
          spreadsheetId: this.config.spreadsheetId,
          range: `${this.config.worksheetName}!A${insertRowStart}:N${insertRowEnd}`,
          valueInputOption: 'USER_ENTERED',
          resource: {
            values: newRows
          }
        });
        
        console.log(`📍 Added ${newRows.length} new rows directly at A${insertRowStart}:N${insertRowEnd}`);
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
          row.notes,
          row.lastDiscussedDate
        ]);

      if (newRows.length > 0) {
        // Find the last row with data in column A (the actual table)
        const lastRowResponse = await this.sheets.spreadsheets.values.get({
          spreadsheetId: this.config.spreadsheetId,
          range: `${this.config.worksheetName}!A:A`,
        });
        
        const lastRowWithData = lastRowResponse.data.values?.length || 0;
        const insertRowStart = lastRowWithData + 1; // Next available row
        const insertRowEnd = insertRowStart + newRows.length - 1;
        
        // Insert directly at specific row range in A:M columns
        await this.sheets.spreadsheets.values.update({
          spreadsheetId: this.config.spreadsheetId,
          range: `${this.config.worksheetName}!A${insertRowStart}:M${insertRowEnd}`,
          valueInputOption: 'USER_ENTERED',
          resource: {
            values: newRows
          }
        });
        
        console.log(`📍 Inserted ${newRows.length} rows directly at A${insertRowStart}:M${insertRowEnd}`);
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