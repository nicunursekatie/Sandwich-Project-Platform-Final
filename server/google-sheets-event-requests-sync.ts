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
  submittedOn: string; // The actual submission date from Squarespace form
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
      desiredEventDate: eventRequest.desiredEventDate ? (() => {
        // Timezone-safe date formatting for Google Sheets
        const dateStr = eventRequest.desiredEventDate;
        if (dateStr.match(/^\d{4}-\d{2}-\d{2}T00:00:00(\.\d{3})?Z?$/)) {
          // Handle ISO midnight format that causes timezone shifting
          const datePart = dateStr.split('T')[0];
          const safeDate = new Date(datePart + 'T12:00:00');
          return safeDate.toLocaleDateString();
        } else {
          // Standard date parsing
          const date = new Date(dateStr + 'T12:00:00');
          return date.toLocaleDateString();
        }
      })() : '',
      status: eventRequest.status || 'new',
      message: eventRequest.message || '',
      previouslyHosted: eventRequest.previouslyHosted || '',
      createdDate: eventRequest.createdAt ? (() => {
        // Timezone-safe date formatting for Google Sheets
        if (eventRequest.createdAt.match(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/)) {
          // Database timestamp format
          const [datePart] = eventRequest.createdAt.split(' ');
          const date = new Date(datePart + 'T12:00:00');
          return date.toLocaleDateString();
        } else {
          const date = new Date(eventRequest.createdAt + 'T12:00:00');
          return date.toLocaleDateString();
        }
      })() : '',
      lastUpdated: eventRequest.updatedAt ? (() => {
        // Timezone-safe date formatting for Google Sheets
        if (eventRequest.updatedAt.match(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/)) {
          // Database timestamp format
          const [datePart] = eventRequest.updatedAt.split(' ');
          const date = new Date(datePart + 'T12:00:00');
          return date.toLocaleDateString();
        } else {
          const date = new Date(eventRequest.updatedAt + 'T12:00:00');
          return date.toLocaleDateString();
        }
      })() : '',
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
    if (row.submittedOn) {
      try {
        submissionDate = new Date(row.submittedOn);
        console.log(`✅ Parsed submission date "${row.submittedOn}" to:`, submissionDate.toISOString());
      } catch (error) {
        console.warn(`Invalid submission date format in Google Sheets: ${row.submittedOn}`);
        submissionDate = new Date(); // Fallback to current date
      }
    } else {
      console.warn('No submittedOn field found, using current date');
      submissionDate = new Date();
    }

    return {
      organizationName: row.organizationName,
      firstName: firstName,
      lastName: lastName,
      email: row.email,
      phone: row.phone,
      department: row.department,
      desiredEventDate: row.desiredEventDate ? (() => {
        // Timezone-safe date parsing from Google Sheets
        const dateStr = row.desiredEventDate;
        if (dateStr.match(/^\d{1,2}\/\d{1,2}\/\d{4}$/)) {
          // Handle MM/DD/YYYY format from Google Sheets
          const [month, day, year] = dateStr.split('/');
          return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
        } else if (dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
          // Handle YYYY-MM-DD format
          return new Date(dateStr + 'T12:00:00');
        } else {
          // Fallback with noon time to avoid timezone issues
          return new Date(dateStr + 'T12:00:00');
        }
      })() : null,
      status: row.status || 'new',
      message: row.message,
      previouslyHosted: row.previouslyHosted,
      organizationExists: row.duplicateCheck === 'Yes',
      duplicateNotes: row.notes,
      createdAt: submissionDate // Map Google Sheet submission date to createdAt
    };
  }

  /**
   * Update a specific event request's status in Google Sheets
   */
  async updateEventRequestStatus(organizationName: string, contactName: string, newStatus: string): Promise<{ success: boolean; message: string }> {
    try {
      await this.ensureInitialized();
      
      // Read current sheet to find the row
      const response = await this.sheets.spreadsheets.values.get({
        spreadsheetId: (this as any).config.spreadsheetId,
        range: `${(this as any).config.worksheetName}!A2:K1000`,
      });

      const rows = response.data.values || [];
      
      // Find the matching row (case-insensitive)
      const rowIndex = rows.findIndex(row => {
        const sheetOrgName = row[3] || ''; // Organization Name is column D (index 3)
        const sheetContactName = row[1] || ''; // Contact Name is column B (index 1)
        
        return sheetOrgName.toLowerCase() === organizationName.toLowerCase() && 
               sheetContactName.toLowerCase() === contactName.toLowerCase();
      });

      if (rowIndex === -1) {
        return { 
          success: false, 
          message: `Event request not found in Google Sheets: ${organizationName} - ${contactName}`
        };
      }

      // Update the status in column K (index 10)
      const actualRowNumber = rowIndex + 2; // +2 because: +1 for header row, +1 for 1-based indexing
      await this.sheets.spreadsheets.values.update({
        spreadsheetId: (this as any).config.spreadsheetId,
        range: `${(this as any).config.worksheetName}!K${actualRowNumber}`,
        valueInputOption: 'USER_ENTERED',
        resource: { values: [[newStatus]] },
      });

      console.log(`✅ Updated Google Sheets status for ${organizationName} - ${contactName} to: ${newStatus}`);
      return { 
        success: true, 
        message: `Updated status to ${newStatus} in Google Sheets`
      };
    } catch (error) {
      console.error('Error updating Google Sheets status:', error);
      return { 
        success: false, 
        message: `Failed to update Google Sheets: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
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
        
        // Try to find existing event request by organization name and contact name (case-insensitive)
        const existingRequests = await this.storage.getAllEventRequests();
        const nameParts = row.contactName.split(' ');
        const firstName = nameParts[0] || '';
        const lastName = nameParts.slice(1).join(' ') || '';
        
        const existingRequest = existingRequests.find(r => {
          // Match by organization name and contact name (case-insensitive)
          const orgMatch = r.organizationName?.toLowerCase() === row.organizationName?.toLowerCase();
          const nameMatch = (
            r.firstName?.toLowerCase() === firstName.toLowerCase() && 
            r.lastName?.toLowerCase() === lastName.toLowerCase()
          );
          
          // Also match by email if both have emails
          const emailMatch = r.email && row.email && 
            r.email.toLowerCase() === row.email.toLowerCase();
          
          return orgMatch && (nameMatch || emailMatch);
        });
        
        const eventRequestData = this.sheetRowToEventRequest(row);
        
        if (existingRequest) {
          // SKIP updating existing requests - let the app be the authoritative source
          console.log(`⏭️ Skipping existing event request (app is authoritative): ${row.organizationName} - ${row.contactName}`);
          // Do not update existing requests to preserve user changes
        } else {
          // Create new
          console.log(`✨ Creating new event request: ${row.organizationName} - ${row.contactName}`);
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
      // Match the updated Google Sheet structure from the screenshot
      submittedOn: row[0] || '', // Submitted On (A) - the actual form submission date
      contactName: row[1] || '', // Name (B)
      email: row[2] || '', // Email (C)
      organizationName: row[3] || '', // Group/Organization Name (D)
      phone: row[4] || '', // Phone (E)
      desiredEventDate: row[5] || '', // Desired Event Date (F)
      message: row[6] || '', // Message (G)
      previouslyHosted: row[7] || 'i_dont_know', // has your organization done an event with us before (H)
      department: row[8] || '', // departmentteam if applicable (I)
      // Note: row[9] appears to be "your email" - duplicate of email field
      status: row[10] || 'new', // status (K) - read from your new status column, default to 'new'
      createdDate: '', // Legacy field, not used for mapping
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