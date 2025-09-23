import {
  GoogleSheetsService,
  GoogleSheetsConfig,
} from './google-sheets-service';
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
      worksheetName: 'Sheet1',
    };
    super(config);
  }

  // Make ensureInitialized method accessible
  async ensureInitialized() {
    return super.ensureInitialized();
  }

  /**
   * Convert Excel serial number or date string to JavaScript Date
   * Handles both submission dates and event dates properly
   */
  private parseExcelDate(dateValue: string | undefined, fieldName: string = 'date'): Date | null {
    if (!dateValue || !dateValue.trim()) return null;

    try {
      const cleaned = dateValue.trim();

      // Check if it's an Excel serial number (numeric string)
      if (/^\d+(\.\d+)?$/.test(cleaned)) {
        const serialNumber = parseFloat(cleaned);
        
        // Convert Excel serial number to JavaScript Date
        // Excel epoch starts from January 1, 1900 (with a leap year bug adjustment)
        const excelEpoch = new Date(1899, 11, 30); // December 30, 1899 (Excel's day 0)
        const millisecondsPerDay = 24 * 60 * 60 * 1000;
        
        const date = new Date(excelEpoch.getTime() + serialNumber * millisecondsPerDay);
        
        if (isNaN(date.getTime())) {
          console.error(
            `❌ CRITICAL: Invalid Excel serial number for ${fieldName}: "${dateValue}"`
          );
          return null;
        }

        console.log(
          `✅ Converted Excel serial number "${dateValue}" (${fieldName}) to:`,
          date.toISOString(),
          `(${date.toLocaleDateString()})`
        );
        
        return date;
      } else {
        // Try parsing as regular date string
        const date = new Date(cleaned);
        
        if (isNaN(date.getTime())) {
          console.error(
            `❌ CRITICAL: Invalid ${fieldName} format: "${dateValue}"`
          );
          return null;
        }

        console.log(
          `✅ Parsed ${fieldName} "${dateValue}" to:`,
          date.toISOString()
        );
        
        return date;
      }
    } catch (error) {
      console.error(
        `❌ CRITICAL: Error parsing ${fieldName} "${dateValue}":`,
        error
      );
      return null;
    }
  }

  /**
   * Convert EventRequest to Google Sheets row format
   */
  private eventRequestToSheetRow(
    eventRequest: EventRequest
  ): EventRequestSheetRow {
    return {
      submittedOn: eventRequest.createdAt
        ? (() => {
            const date =
              eventRequest.createdAt instanceof Date
                ? eventRequest.createdAt
                : new Date(eventRequest.createdAt);
            return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
          })()
        : '',
      organizationName: eventRequest.organizationName || '',
      contactName:
        `${eventRequest.firstName || ''} ${eventRequest.lastName || ''}`.trim(),
      email: eventRequest.email || '',
      phone: eventRequest.phone || '',
      department: eventRequest.department || '',
      desiredEventDate: eventRequest.desiredEventDate
        ? (() => {
            // Timezone-safe date formatting for Google Sheets
            const date =
              eventRequest.desiredEventDate instanceof Date
                ? eventRequest.desiredEventDate
                : new Date(eventRequest.desiredEventDate);
            return date.toLocaleDateString();
          })()
        : '',
      status: eventRequest.status || 'new',
      message: eventRequest.message || '',
      previouslyHosted: eventRequest.previouslyHosted || '',
      createdDate: eventRequest.createdAt
        ? (() => {
            const date =
              eventRequest.createdAt instanceof Date
                ? eventRequest.createdAt
                : new Date(eventRequest.createdAt);
            return date.toLocaleDateString();
          })()
        : '',
      lastUpdated: eventRequest.updatedAt
        ? (() => {
            const date =
              eventRequest.updatedAt instanceof Date
                ? eventRequest.updatedAt
                : new Date(eventRequest.updatedAt);
            return date.toLocaleDateString();
          })()
        : '',
      duplicateCheck: eventRequest.organizationExists ? 'Yes' : 'No',
      notes: eventRequest.duplicateNotes || '',
    };
  }

  /**
   * Convert Google Sheets row to EventRequest format
   */
  private sheetRowToEventRequest(
    row: EventRequestSheetRow
  ): Partial<EventRequest> {
    const nameParts = row.contactName.split(' ');
    const firstName = nameParts[0] || '';
    const lastName = nameParts.slice(1).join(' ') || '';

    // Parse the submission date from Google Sheets using proper Excel serial number handling
    const submissionDate = this.parseExcelDate(row.submittedOn, 'submission date') || new Date();

    return {
      organizationName: row.organizationName,
      firstName: firstName,
      lastName: lastName,
      email: row.email,
      phone: row.phone,
      department: row.department,
      desiredEventDate: this.parseExcelDate(row.desiredEventDate, 'desired event date'),
      status: (() => {
        // Smart status assignment: preserve existing status or determine based on event date
        if (
          row.status &&
          row.status.trim() &&
          row.status.trim().toLowerCase() !== 'new'
        ) {
          return row.status.trim();
        }

        // For events without status, check if it's a past event
        if (row.desiredEventDate && row.desiredEventDate.trim()) {
          try {
            const eventDate = new Date(row.desiredEventDate.trim());
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            if (!isNaN(eventDate.getTime()) && eventDate < today) {
              return 'completed'; // Past events are marked as completed
            }
          } catch (error) {
            console.warn(
              'Error parsing event date for status determination:',
              row.desiredEventDate
            );
          }
        }

        return 'new'; // Default for future events or unclear dates
      })(),
      message: row.message,
      previouslyHosted: row.previouslyHosted,
      organizationExists: row.duplicateCheck === 'Yes',
      duplicateNotes: row.notes,
      createdAt: submissionDate, // Map Google Sheet submission date to createdAt
    };
  }

  /**
   * Update a specific event request's status in Google Sheets
   */
  async updateEventRequestStatus(
    organizationName: string,
    contactName: string,
    newStatus: string
  ): Promise<{ success: boolean; message: string }> {
    try {
      await this.ensureInitialized();

      // Read current sheet to find the row
      const response = await this.sheets.spreadsheets.values.get({
        spreadsheetId: (this as any).config.spreadsheetId,
        range: `${(this as any).config.worksheetName}!A2:K1000`,
      });

      const rows = response.data.values || [];

      // Find the matching row (case-insensitive)
      const rowIndex = rows.findIndex((row) => {
        const sheetOrgName = row[3] || ''; // Organization Name is column D (index 3)
        const sheetContactName = row[1] || ''; // Contact Name is column B (index 1)

        return (
          sheetOrgName.toLowerCase() === organizationName.toLowerCase() &&
          sheetContactName.toLowerCase() === contactName.toLowerCase()
        );
      });

      if (rowIndex === -1) {
        return {
          success: false,
          message: `Event request not found in Google Sheets: ${organizationName} - ${contactName}`,
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

      console.log(
        `✅ Updated Google Sheets status for ${organizationName} - ${contactName} to: ${newStatus}`
      );
      return {
        success: true,
        message: `Updated status to ${newStatus} in Google Sheets`,
      };
    } catch (error) {
      console.error('Error updating Google Sheets status:', error);
      return {
        success: false,
        message: `Failed to update Google Sheets: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  /**
   * Sync event requests from database to Google Sheets
   * DISABLED TO PREVENT DATA LOSS - This function was clearing the user's sheet
   */
  async syncToGoogleSheets(): Promise<{
    success: boolean;
    message: string;
    synced?: number;
  }> {
    return {
      success: false,
      message:
        'TO-SHEETS sync is DISABLED to prevent data loss. Use FROM-SHEETS sync only.',
    };
  }

  /**
   * Sync from Google Sheets to database
   */
  async syncFromGoogleSheets(): Promise<{
    success: boolean;
    message: string;
    updated?: number;
    created?: number;
  }> {
    try {
      await this.ensureInitialized();

      // Read from Google Sheets
      const sheetRows = await this.readEventRequestsSheet();

      let updatedCount = 0;
      let createdCount = 0;

      for (const row of sheetRows) {
        if (!row.organizationName) continue; // Skip empty rows

        // Convert row to event request data first to access parsed submission date
        const eventRequestData = this.sheetRowToEventRequest(row);

        // Try to find existing event request by organization name and contact name (case-insensitive)
        const existingRequests = await this.storage.getAllEventRequests();
        const nameParts = row.contactName.split(' ');
        const firstName = nameParts[0] || '';
        const lastName = nameParts.slice(1).join(' ') || '';

        const existingRequest = existingRequests.find((r) => {
          // Match by organization name and contact name (case-insensitive)
          const orgMatch =
            r.organizationName?.toLowerCase().trim() ===
            row.organizationName?.toLowerCase().trim();

          // Require both first AND last name to match (not just one)
          const fullNameMatch =
            r.firstName?.toLowerCase().trim() ===
              firstName.toLowerCase().trim() &&
            r.lastName?.toLowerCase().trim() ===
              lastName.toLowerCase().trim() &&
            firstName.trim() &&
            lastName.trim(); // Both names must exist

          // Email match (both must exist and match)
          const emailMatch =
            r.email &&
            row.email &&
            r.email.toLowerCase().trim() === row.email.toLowerCase().trim();

          // Phone match (both must exist and match)
          const phoneMatch =
            r.phone &&
            row.phone &&
            r.phone.replace(/\D/g, '') === row.phone.replace(/\D/g, ''); // Compare digits only

          // Since submission timestamp is not available in this spreadsheet,
          // use more precise matching without time dependency
          const hasStrongIdentifier = emailMatch || phoneMatch;
          const hasFullNameAndOrg = fullNameMatch && orgMatch;

          // Only consider duplicate if we have either:
          // 1. Strong identifier match (email or phone) + org match, OR
          // 2. Full name + org match AND neither email nor phone exists in either record
          if (hasStrongIdentifier && orgMatch) {
            return true; // Strong match via email/phone + org
          }

          if (hasFullNameAndOrg) {
            // Only match on name if both records lack email/phone (to avoid false positives)
            const bothLackEmail = !r.email && !row.email;
            const bothLackPhone = !r.phone && !row.phone;
            return bothLackEmail && bothLackPhone;
          }

          return false;
        });

        if (existingRequest) {
          // Selectively update message field from Google Sheets if missing in database
          const hasSheetMessage = row.message && row.message.trim() && row.message.trim().length > 0;
          const hasDbMessage = existingRequest.message && existingRequest.message.trim() && existingRequest.message.trim().length > 0;
          const shouldUpdateMessage = hasSheetMessage && !hasDbMessage;
          
          console.log(`🔍 DEBUG: Checking message update for ${row.organizationName} - ${row.contactName}`);
          console.log(`🔍 Sheet message: "${row.message?.substring(0, 50)}..."`);
          console.log(`🔍 DB message: "${existingRequest.message?.substring(0, 50) || 'NULL'}..."`);
          console.log(`🔍 hasSheetMessage: ${hasSheetMessage}, hasDbMessage: ${hasDbMessage}`);
          
          if (shouldUpdateMessage) {
            console.log(
              `📝 Updating message field for existing request: ${row.organizationName} - ${row.contactName}`
            );
            
            try {
              await this.storage.updateEventRequest(existingRequest.id, {
                message: row.message.trim(),
                updatedAt: new Date()
              });
              updatedCount++;
              console.log(
                `✅ Successfully updated message for: ${row.organizationName} - ${row.contactName}`
              );
            } catch (error) {
              console.error(
                `❌ Failed to update message for ${row.organizationName} - ${row.contactName}:`,
                error
              );
            }
          } else {
            console.log(
              `⏭️ Skipping existing event request (no message update needed): ${row.organizationName} - ${row.contactName}`
            );
          }
        } else {
          // Create new
          console.log(
            `✨ Creating new event request: ${eventRequestData.phone} - ${eventRequestData.firstName} ${eventRequestData.lastName} ${eventRequestData.email}`
          );

          // Ensure dates are valid before saving to database
          const sanitizedData = {
            ...eventRequestData,
            createdBy: 'google_sheets_sync',
            // Ensure all date fields are either valid Date objects or null
            desiredEventDate:
              eventRequestData.desiredEventDate &&
              !isNaN(new Date(eventRequestData.desiredEventDate).getTime())
                ? eventRequestData.desiredEventDate
                : null,
            createdAt:
              eventRequestData.createdAt &&
              !isNaN(new Date(eventRequestData.createdAt).getTime())
                ? eventRequestData.createdAt
                : new Date(),
            updatedAt: new Date(),
          };

          try {
            console.log(
              `🔍 Attempting to create event request with data:`,
              JSON.stringify(sanitizedData, null, 2)
            );
            const result = await this.storage.createEventRequest(
              sanitizedData as any
            );
            console.log(
              `✅ Successfully created event request with ID: ${result.id}`
            );
            createdCount++;
          } catch (error) {
            console.error('❌ Primary storage operation failed:', error);
            console.error(
              '❌ Failed data was:',
              JSON.stringify(sanitizedData, null, 2)
            );

            try {
              // Fallback: try with minimal required fields only
              const fallbackData = {
                organizationName:
                  eventRequestData.organizationName || 'Unknown Organization',
                firstName: eventRequestData.firstName || '',
                lastName: eventRequestData.lastName || '',
                email: eventRequestData.email || '',
                phone: eventRequestData.phone || '',
                status: eventRequestData.status || 'new',
                createdBy: 'google_sheets_sync',
                createdAt: new Date(),
                updatedAt: new Date(),
              };
              console.log(
                `🔄 Attempting fallback creation with minimal data:`,
                JSON.stringify(fallbackData, null, 2)
              );
              const fallbackResult = await this.storage.createEventRequest(
                fallbackData as any
              );
              console.log(
                `✅ Fallback creation succeeded with ID: ${fallbackResult.id}`
              );
              createdCount++;
            } catch (fallbackError) {
              console.error(
                '❌ Fallback storage operation also failed:',
                fallbackError
              );
              console.error(
                '❌ Skipping this record - unable to create event request'
              );
              // Do NOT increment createdCount if both attempts failed
            }
          }
        }
      }

      return {
        success: true,
        message: `Successfully synced from Google Sheets: ${createdCount} created, ${updatedCount} updated`,
        created: createdCount,
        updated: updatedCount,
      };
    } catch (error) {
      console.error('Error syncing from Google Sheets:', error);
      return {
        success: false,
        message: `Failed to sync: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  /**
   * Smart sync: Update Google Sheets with event requests data while preserving manual edits
   */
  private async updateEventRequestsSheet(
    eventRequests: EventRequestSheetRow[]
  ): Promise<void> {
    if (!this.sheets) {
      throw new Error('Google Sheets service not initialized');
    }

    if (eventRequests.length === 0) {
      console.log('No event requests to sync');
      return;
    }

    // First, read existing data to preserve manual edits
    let existingData: any[][] = [];
    try {
      const response = await this.sheets.spreadsheets.values.get({
        spreadsheetId: (this as any).config.spreadsheetId,
        range: `${(this as any).config.worksheetName}!A:Z`,
      });
      existingData = response.data.values || [];
    } catch (error) {
      console.warn(
        'Could not read existing event requests sheet data, proceeding with full overwrite:',
        error
      );
    }

    // Prepare app-managed headers (columns A-M)
    const appManagedHeaders = [
      'Organization Name', // A
      'Contact Name', // B
      'Email', // C
      'Phone', // D
      'Desired Event Date', // E
      'Message', // F
      'Department', // G
      'Previously Hosted', // H
      'Status', // I
      'Created Date', // J
      'Last Updated', // K
      'Duplicate Check', // L
      'Notes', // M
    ];

    // Smart merge: preserve manual columns beyond M (columns N, O, P, etc.)
    const mergedData = this.mergeEventRequestsSheetData(
      eventRequests,
      existingData,
      appManagedHeaders
    );

    // Update the sheet with merged data
    await this.sheets.spreadsheets.values.update({
      spreadsheetId: (this as any).config.spreadsheetId,
      range: `${(this as any).config.worksheetName}!A1`,
      valueInputOption: 'USER_ENTERED',
      resource: { values: mergedData },
    });

    console.log(
      `✅ Smart-synced Google Sheets with ${eventRequests.length} event requests (preserving manual columns N+)`
    );
  }

  /**
   * Merge new app data with existing manual edits
   * Preserves columns beyond M (manual tracking columns)
   * Updates columns A-M (app-managed data)
   */
  private mergeEventRequestsSheetData(
    eventRequests: EventRequestSheetRow[],
    existingData: any[][],
    appHeaders: string[]
  ): any[][] {
    const merged: any[][] = [];

    // Handle headers row
    const existingHeaders = existingData[0] || [];
    const mergedHeaders = [...appHeaders];

    // Preserve any manual headers beyond column M (index 12)
    for (let i = appHeaders.length; i < existingHeaders.length; i++) {
      if (existingHeaders[i] && existingHeaders[i].trim()) {
        mergedHeaders[i] = existingHeaders[i];
      }
    }
    merged[0] = mergedHeaders;

    // Create lookup map for existing data by organization + contact name
    const existingRowMap = new Map<string, any[]>();
    for (let i = 1; i < existingData.length; i++) {
      const row = existingData[i] || [];
      const orgName = row[0] || '';
      const contactName = row[1] || '';
      const key = `${orgName.toLowerCase().trim()}|${contactName.toLowerCase().trim()}`;
      if (key !== '|') {
        existingRowMap.set(key, row);
      }
    }

    // Process each new event request
    eventRequests.forEach((request) => {
      const key = `${(request.organizationName || '').toLowerCase().trim()}|${(request.contactName || '').toLowerCase().trim()}`;
      const existingRow = existingRowMap.get(key) || [];

      // Create merged row: app data (A-M) + preserved manual data (N+)
      const newRow = [
        request.organizationName, // A
        request.contactName, // B
        request.email, // C
        request.phone, // D
        request.desiredEventDate, // E
        request.message, // F
        request.department, // G
        request.previouslyHosted, // H
        request.status, // I
        request.createdDate, // J
        request.lastUpdated, // K
        request.duplicateCheck, // L
        request.notes, // M
      ];

      // Preserve manual columns (N, O, P, etc.) from existing data
      for (
        let i = appHeaders.length;
        i < Math.max(mergedHeaders.length, existingRow.length);
        i++
      ) {
        newRow[i] = existingRow[i] || '';
      }

      merged.push(newRow);
      existingRowMap.delete(key); // Mark as processed
    });

    // Add any remaining existing rows that weren't in the new data
    existingRowMap.forEach((existingRow) => {
      if (existingRow.some((cell) => cell && cell.toString().trim())) {
        merged.push(existingRow);
      }
    });

    return merged;
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
      // Match the corrected Google Sheet structure based on actual layout
      submittedOn: row[0] || '', // Submission Date/Time (A)
      contactName: `${row[1] || ''} ${row[2] || ''}`.trim(), // First Name (B) + Last Name (C) combined
      email: row[3] || '', // Email (D)
      organizationName: row[4] || '', // Group/Organization Name (E)
      message: row[5] || '', // Message (F) - CORRECTED COLUMN MAPPING!
      phone: row[6] || '', // Phone (G) - CORRECTED COLUMN MAPPING!
      desiredEventDate: row[7] || '', // Desired Event Date (H) - CORRECTED COLUMN MAPPING!
      department: row[8] || '', // Additional fields if present (I)
      previouslyHosted: row[9] || 'i_dont_know', // Additional fields if present (J)
      status: row[10] || 'new', // Status column if present (K) - default to 'new'
      createdDate: '', // Legacy field, not used for mapping
      lastUpdated: new Date().toISOString(),
      duplicateCheck: 'No',
      notes: '',
      rowIndex: index + 2,
    }));
  }

  /**
   * Analyze the sheet structure
   */
  async analyzeSheetStructure(): Promise<{
    headers: string[];
    rowCount: number;
    lastUpdate: string;
  }> {
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
        lastUpdate: new Date().toISOString(),
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
export function getEventRequestsGoogleSheetsService(
  storage: IStorage
): EventRequestsGoogleSheetsService | null {
  try {
    // Validate all required environment variables for Google Sheets authentication
    if (
      !process.env.GOOGLE_PROJECT_ID ||
      !process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL ||
      !process.env.GOOGLE_PRIVATE_KEY
    ) {
      console.warn(
        'Google Sheets authentication not configured - missing GOOGLE_PROJECT_ID, GOOGLE_SERVICE_ACCOUNT_EMAIL, or GOOGLE_PRIVATE_KEY'
      );
      return null;
    }

    if (!process.env.EVENT_REQUESTS_SHEET_ID) {
      console.warn('EVENT_REQUESTS_SHEET_ID not configured');
      return null;
    }

    console.log(
      '✅ All Event Requests Google Sheets environment variables validated'
    );
    return new EventRequestsGoogleSheetsService(storage);
  } catch (error) {
    console.error(
      'Failed to create Event Requests Google Sheets service:',
      error
    );
    return null;
  }
}
