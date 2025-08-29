import { GoogleSheetsService, GoogleSheetsConfig } from './google-sheets-service';
import type { IStorage } from './storage';
import { EventRequest, Organization } from '@shared/schema';

export interface EventRequestSheetRow {
  organizationName: string;
  contactName: string;
  email: string;
  phone: string;
  department: string;
  desiredEventDate: string;
  status: string;
  message: string;
  previouslyHosted: string;
  createdDate: string;
  lastUpdated: string;
  duplicateCheck: string;
  notes: string;
  rowIndex?: number;
}

export class EventRequestsGoogleSheetsService extends GoogleSheetsService {
  constructor(private storage: IStorage) {
    const config: GoogleSheetsConfig = {
      spreadsheetId: process.env.EVENT_REQUESTS_SHEET_ID!,
      worksheetName: 'Sheet1'
    };
    super(config);
  }

  // Override the ensureInitialized method to be accessible
  async ensureInitialized() {
    return super['ensureInitialized']();
  }

  /**
   * Convert EventRequest to Google Sheets row format
   */
  private eventRequestToSheetRow(eventRequest: EventRequest): EventRequestSheetRow {
    return {
      organizationName: eventRequest.organizationName || '',
      contactName: `${eventRequest.firstName || ''} ${eventRequest.lastName || ''}`.trim(),
      email: eventRequest.email || '',
      phone: eventRequest.phone || '',
      department: eventRequest.department || '',
      desiredEventDate: eventRequest.desiredEventDate ? new Date(eventRequest.desiredEventDate).toLocaleDateString() : '',
      status: eventRequest.status || 'new',
      message: eventRequest.message || '',
      previouslyHosted: eventRequest.previouslyHosted || '',
      createdDate: eventRequest.createdAt ? new Date(eventRequest.createdAt).toLocaleDateString() : '',
      lastUpdated: eventRequest.updatedAt ? new Date(eventRequest.updatedAt).toLocaleDateString() : '',
      duplicateCheck: eventRequest.organizationExists ? 'Yes' : 'No',
      notes: eventRequest.duplicateNotes || ''
    };
  }

  /**
   * Convert Google Sheets row to EventRequest format
   */
  private sheetRowToEventRequest(row: EventRequestSheetRow): Partial<EventRequest> {
    const nameParts = row.contactName.split(' ');
    const firstName = nameParts[0] || '';
    const lastName = nameParts.slice(1).join(' ') || '';

    // Parse the submission date from Google Sheets
    let submissionDate;
    if (row.createdDate) {
      try {
        submissionDate = new Date(row.createdDate);
      } catch (error) {
        console.warn(`Invalid date format in Google Sheets: ${row.createdDate}`);
        submissionDate = new Date(); // Fallback to current date
      }
    }

    return {
      organizationName: row.organizationName,
      firstName: firstName,
      lastName: lastName,
      email: row.email,
      phone: row.phone,
      department: row.department,
      desiredEventDate: row.desiredEventDate ? new Date(row.desiredEventDate) : null,
      status: row.status || 'new',
      message: row.message,
      previouslyHosted: row.previouslyHosted,
      organizationExists: row.duplicateCheck === 'Yes',
      duplicateNotes: row.notes,
      createdAt: submissionDate // Map Google Sheet submission date to createdAt
    };
  }

  /**
   * Sync event requests from database to Google Sheets
   * DISABLED TO PREVENT DATA LOSS - This function was clearing the user's sheet
   */
  async syncToGoogleSheets(): Promise<{ success: boolean; message: string; synced?: number }> {
    return { 
      success: false, 
      message: "TO-SHEETS sync is DISABLED to prevent data loss. Use FROM-SHEETS sync only."
    };
  }

  /**
   * Sync from Google Sheets to database
   */
  async syncFromGoogleSheets(): Promise<{ success: boolean; message: string; updated?: number; created?: number }> {
    try {
      await this.ensureInitialized();
      
      // Read from Google Sheets
      const sheetRows = await this.readEventRequestsSheet();
      
      let updatedCount = 0;
      let createdCount = 0;
      
      for (const row of sheetRows) {
        if (!row.organizationName) continue; // Skip empty rows
        
        // Try to find existing event request by organization name and email
        const existingRequests = await this.storage.getAllEventRequests();
        const existingRequest = existingRequests.find(r => 
          r.organizationName === row.organizationName && r.email === row.email
        );
        
        const eventRequestData = this.sheetRowToEventRequest(row);
        
        if (existingRequest) {
          // Update existing
          await this.storage.updateEventRequest(existingRequest.id, eventRequestData);
          updatedCount++;
        } else {
          // Create new
          await this.storage.createEventRequest({
            ...eventRequestData,
            createdBy: 'google_sheets_sync'
          } as any);
          createdCount++;
        }
      }
      
      return { 
        success: true, 
        message: `Successfully synced from Google Sheets: ${createdCount} created, ${updatedCount} updated`,
        created: createdCount,
        updated: updatedCount
      };
    } catch (error) {
      console.error('Error syncing from Google Sheets:', error);
      return { 
        success: false, 
        message: `Failed to sync: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Update Google Sheets with event requests data
   */
  private async updateEventRequestsSheet(eventRequests: EventRequestSheetRow[]): Promise<void> {
    if (!this.sheets) {
      throw new Error('Google Sheets service not initialized');
    }

    // DISABLED: Clear existing data - this was wiping the user's sheet
    // await this.sheets.spreadsheets.values.clear({
    //   spreadsheetId: (this as any).config.spreadsheetId,
    //   range: `${(this as any).config.worksheetName}!A2:Z1000`,
    // });

    if (eventRequests.length === 0) {
      console.log('No event requests to sync');
      return;
    }

    // Prepare headers
    const headers = [
      'Organization Name',
      'Contact Name', 
      'Email',
      'Phone',
      'Department',
      'Desired Event Date',
      'Status',
      'Message',
      'Previously Hosted',
      'Created Date',
      'Last Updated',
      'Duplicate Check',
      'Notes'
    ];

    // Prepare data rows
    const values = [
      headers,
      ...eventRequests.map(request => [
        request.organizationName,
        request.contactName,
        request.email,
        request.phone,
        request.department,
        request.desiredEventDate,
        request.status,
        request.message,
        request.previouslyHosted,
        request.createdDate,
        request.lastUpdated,
        request.duplicateCheck,
        request.notes
      ])
    ];

    // Update the sheet
    await this.sheets.spreadsheets.values.update({
      spreadsheetId: (this as any).config.spreadsheetId,
      range: `${(this as any).config.worksheetName}!A1`,
      valueInputOption: 'USER_ENTERED',
      resource: { values },
    });

    console.log(`✅ Updated Google Sheets with ${eventRequests.length} event requests`);
  }

  /**
   * Read event requests from Google Sheets
   */
  private async readEventRequestsSheet(): Promise<EventRequestSheetRow[]> {
    if (!this.sheets) {
      throw new Error('Google Sheets service not initialized');
    }

    const response = await this.sheets.spreadsheets.values.get({
      spreadsheetId: (this as any).config.spreadsheetId,
      range: `${(this as any).config.worksheetName}!A2:Z1000`,
    });

    const rows = response.data.values || [];
    console.log(`📊 Reading ${rows.length} rows from Google Sheets`);
    if (rows.length > 0) {
      console.log('📋 First row (headers):', rows[0]);
      if (rows.length > 1) {
        console.log('📋 Second row (sample data):', rows[1]);
      }
    }
    
    return rows.map((row: string[], index: number) => ({
      // Match the actual Google Sheet structure from the screenshot
      createdDate: row[0] || '', // Submitted On (A)
      contactName: row[1] || '', // Name (B)
      email: row[2] || '', // Email (C)
      organizationName: row[3] || '', // Group/Organization Name (D)
      phone: row[4] || '', // Phone (E)
      desiredEventDate: row[5] || '', // Desired Event Date (F)
      message: row[6] || '', // Message (G)
      department: '', // Not in current sheet
      status: 'new', // Default status
      previouslyHosted: 'i_dont_know', // Default value
      lastUpdated: new Date().toISOString(),
      duplicateCheck: 'No',
      notes: '',
      rowIndex: index + 2
    }));
  }

  /**
   * Analyze the sheet structure
   */
  async analyzeSheetStructure(): Promise<{ headers: string[]; rowCount: number; lastUpdate: string }> {
    try {
      await this.ensureInitialized();
      
      const response = await this.sheets.spreadsheets.values.get({
        spreadsheetId: (this as any).config.spreadsheetId,
        range: `${(this as any).config.worksheetName}!A1:Z1`,
      });

      const headers = response.data.values?.[0] || [];
      
      const dataResponse = await this.sheets.spreadsheets.values.get({
        spreadsheetId: (this as any).config.spreadsheetId,
        range: `${(this as any).config.worksheetName}!A2:Z1000`,
      });

      const rowCount = dataResponse.data.values?.length || 0;

      return {
        headers,
        rowCount,
        lastUpdate: new Date().toISOString()
      };
    } catch (error) {
      console.error('Error analyzing event requests sheet structure:', error);
      throw error;
    }
  }
}

/**
 * Get the Event Requests Google Sheets service instance
 */
export function getEventRequestsGoogleSheetsService(storage: IStorage): EventRequestsGoogleSheetsService | null {
  try {
    if (!process.env.EVENT_REQUESTS_SHEET_ID) {
      console.warn('EVENT_REQUESTS_SHEET_ID not configured');
      return null;
    }
    
    return new EventRequestsGoogleSheetsService(storage);
  } catch (error) {
    console.error('Failed to create Event Requests Google Sheets service:', error);
    return null;
  }
}