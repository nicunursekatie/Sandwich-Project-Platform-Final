import {
  GoogleSheetsService,
  GoogleSheetsConfig,
} from './google-sheets-service';
import type { IStorage } from './storage';
import { EventRequest, Organization, eventRequests } from '@shared/schema';
import { AuditLogger } from './audit-logger';
import { db } from './db';

export interface EventRequestSheetRow {
  externalId: string;
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
      externalId: eventRequest.externalId || '',
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
      externalId: row.externalId,
      organizationName: row.organizationName,
      firstName: firstName,
      lastName: lastName,
      email: row.email,
      phone: row.phone,
      department: row.department,
      desiredEventDate: this.parseExcelDate(row.desiredEventDate, 'desired event date'),
      status: (() => {
        // CRITICAL FIX: Only assign status for NEW imports, never for existing records
        // This function should only be called for genuinely new records
        
        // If status exists in sheet and is not empty, use it
        if (
          row.status &&
          row.status.trim() &&
          row.status.trim().toLowerCase() !== 'new'
        ) {
          console.log(`📊 Using sheet status: "${row.status.trim()}" for new import: ${row.organizationName}`);
          return row.status.trim();
        }

        // For events without status, check if it's a past event
        if (row.desiredEventDate && row.desiredEventDate.trim()) {
          try {
            const eventDate = new Date(row.desiredEventDate.trim());
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            if (!isNaN(eventDate.getTime()) && eventDate < today) {
              console.log(`📊 Assigning 'completed' status for past event: ${row.organizationName} (${eventDate.toLocaleDateString()})`);
              return 'completed'; // Past events are marked as completed
            }
          } catch (error) {
            console.warn(
              'Error parsing event date for status determination:',
              row.desiredEventDate
            );
          }
        }

        console.log(`📊 Assigning default 'new' status for: ${row.organizationName}`);
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
   * DEPRECATED: No longer updating Google Sheets - one-way sync only
   * @deprecated This method is no longer used as we only sync FROM sheets, not TO sheets
   */
  async updateEventRequestStatus(
    organizationName: string,
    contactName: string,
    newStatus: string
  ): Promise<{ success: boolean; message: string }> {
    // DISABLED: One-way sync only - we don't write back to Google Sheets
    console.warn('⚠️ updateEventRequestStatus called but is disabled - one-way sync only');
    return {
      success: false,
      message: 'Google Sheets updates are disabled - one-way sync only'
    };

    /* Original implementation commented out:
    try {
      await this.ensureInitialized();

      // Read current sheet to find the row
      const response = await this.sheets.spreadsheets.values.get({
        spreadsheetId: (this as any).config.spreadsheetId,
        range: `${(this as any).config.worksheetName}!A2:K1000`,
      });

      const rows = response.data.values || [];

      // Find the matching row (case-insensitive)
      const rowIndex = rows.findIndex((row: string[]) => {
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
    */
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
   * ENHANCED duplicate detection using stable identifiers with fuzzy fallback
   * CRITICAL FIX: Better error handling and comprehensive logging for debugging
   * Prioritizes: googleSheetRowId > submission timestamp + email > fuzzy organization name matching
   */
  private async findExistingEventRequest(
    row: EventRequestSheetRow,
    eventRequestData: Partial<EventRequest>
  ): Promise<EventRequest | undefined> {
    console.log(`\n🔍 DUPLICATE DETECTION START for: ${row.organizationName} - ${row.contactName}`);
    console.log(`   📧 Email: ${row.email}`);
    console.log(`   📅 Event Date (raw): ${row.desiredEventDate}`);
    console.log(`   📅 Event Date (parsed): ${eventRequestData.desiredEventDate?.toISOString() || 'NULL'}`);
    console.log(`   📝 Row Index: ${row.rowIndex}`);
    
    const existingRequests = await this.storage.getAllEventRequests();
    console.log(`   🗃️ Total existing records to check: ${existingRequests.length}`);
    
    const nameParts = row.contactName.split(' ');
    const firstName = nameParts[0] || '';
    const lastName = nameParts.slice(1).join(' ') || '';

    // PRIORITY 1: Google Sheets Row ID (most stable identifier)
    console.log(`\n🏆 PRIORITY 1: GoogleSheetRowId matching...`);
    if (row.rowIndex) {
      console.log(`   🔍 Looking for googleSheetRowId = '${row.rowIndex.toString()}'`);
      const rowIdMatch = existingRequests.find((r) => {
        const hasMatch = r.googleSheetRowId === row.rowIndex?.toString();
        if (hasMatch) {
          console.log(`   ✅ Found match by GoogleSheetRowId: ${r.id} - ${r.organizationName}`);
        }
        return hasMatch;
      });
      if (rowIdMatch) {
        console.log(`✅ MATCH FOUND (GoogleSheetRowId): Row ${row.rowIndex} for ${row.organizationName}`);
        console.log(`🔍 DUPLICATE DETECTION END: MATCHED\n`);
        return rowIdMatch;
      } else {
        console.log(`   ❌ No existing records found with googleSheetRowId = '${row.rowIndex}'`);
        const recordsWithRowIds = existingRequests.filter(r => r.googleSheetRowId).length;
        console.log(`   📊 Total existing records with googleSheetRowId: ${recordsWithRowIds}`);
      }
    } else {
      console.log(`   ⚠️ No row.rowIndex provided`);
    }

    // PRIORITY 2: Submission timestamp + email + desiredEventDate combination (very stable, prevents merging different events)
    console.log(`\n🥈 PRIORITY 2: Submission timestamp + email + event date matching...`);
    if (row.submittedOn && row.email && eventRequestData.createdAt && eventRequestData.desiredEventDate) {
      console.log(`   🔍 Looking for: email='${row.email}', submittedOn='${row.submittedOn}', eventDate='${eventRequestData.desiredEventDate.toISOString()}'`);
      
      const submissionTimeMatch = existingRequests.find((r, index) => {
        if (!r.email || !r.createdAt || !r.desiredEventDate) {
          if (index < 5) console.log(`   ⚠️ Record ${r.id}: Missing required fields (email=${!!r.email}, createdAt=${!!r.createdAt}, desiredEventDate=${!!r.desiredEventDate})`);
          return false;
        }
        
        const emailMatch = r.email.toLowerCase().trim() === row.email.toLowerCase().trim();
        
        // Compare submission timestamps with minimal tolerance for minor timing differences only
        const existingDate = new Date(r.createdAt);
        const sheetDate = new Date(eventRequestData.createdAt!);
        
        // Allow only 5 minutes difference for submission timestamp matching to handle minor timing differences
        const timeDiff = Math.abs(existingDate.getTime() - sheetDate.getTime());
        const maxTimeDiff = 5 * 60 * 1000; // 5 minutes in milliseconds
        
        const timeMatch = timeDiff <= maxTimeDiff;
        
        // CRITICAL: Also match desired event dates to prevent merging different events from same person
        const existingEventDate = new Date(r.desiredEventDate);
        const sheetEventDate = new Date(eventRequestData.desiredEventDate!);
        const eventDateMatch = existingEventDate.getTime() === sheetEventDate.getTime();
        
        if (emailMatch && index < 3) {
          console.log(`   🔍 Record ${r.id}: email match, timeDiff=${Math.round(timeDiff/1000)}s (max ${Math.round(maxTimeDiff/1000)}s), eventDateMatch=${eventDateMatch}`);
          console.log(`      Existing: ${existingDate.toISOString()} → ${existingEventDate.toISOString()}`);
          console.log(`      Sheet:    ${sheetDate.toISOString()} → ${sheetEventDate.toISOString()}`);
        }
        
        if (emailMatch && timeMatch && eventDateMatch) {
          console.log(`✅ MATCH FOUND (SubmissionTime+Email+EventDate): ${row.email} submitted ${sheetDate.toLocaleDateString()} for event on ${sheetEventDate.toLocaleDateString()} - ${row.organizationName}`);
          return true;
        }
        
        return false;
      });
      
      if (submissionTimeMatch) {
        console.log(`🔍 DUPLICATE DETECTION END: MATCHED\n`);
        return submissionTimeMatch;
      } else {
        console.log(`   ❌ No matches found with exact submission time + email + event date`);
      }
    } else {
      console.log(`   ⚠️ Missing required data for Priority 2 matching`);
      console.log(`      submittedOn: ${!!row.submittedOn}, email: ${!!row.email}`);
      console.log(`      createdAt: ${!!eventRequestData.createdAt}, desiredEventDate: ${!!eventRequestData.desiredEventDate}`);
    }

    // PRIORITY 3: Exact email match with event date validation (same person, same org, same event)
    console.log(`\n🥉 PRIORITY 3: Email + event date + organization similarity matching...`);
    if (row.email && eventRequestData.desiredEventDate) {
      console.log(`   🔍 Looking for: email='${row.email}', eventDate='${eventRequestData.desiredEventDate.toISOString()}'`);
      
      const emailOnlyMatch = existingRequests.find((r, index) => {
        if (!r.email || !r.desiredEventDate) {
          if (index < 5) console.log(`   ⚠️ Record ${r.id}: Missing required fields (email=${!!r.email}, desiredEventDate=${!!r.desiredEventDate})`);
          return false;
        }
        
        const emailMatch = r.email.toLowerCase().trim() === row.email.toLowerCase().trim();
        if (!emailMatch) return false;
        
        // CRITICAL: Require matching event dates to prevent merging different events
        const existingEventDate = new Date(r.desiredEventDate);
        const sheetEventDate = new Date(eventRequestData.desiredEventDate!);
        const eventDateMatch = existingEventDate.getTime() === sheetEventDate.getTime();
        
        if (emailMatch && index < 3) {
          console.log(`   🔍 Record ${r.id} (${r.organizationName}): email match, eventDateMatch=${eventDateMatch}`);
          console.log(`      Existing event date: ${existingEventDate.toISOString()}`);
          console.log(`      Sheet event date:    ${sheetEventDate.toISOString()}`);
        }
        
        if (!eventDateMatch) {
          if (emailMatch && index < 3) {
            console.log(`   ❌ Record ${r.id}: Different event dates - keeping separate`);
          }
          return false; // Different events - must be kept separate
        }
        
        // Additional validation: check if organization names could be the same entity
        const orgSimilarity = this.calculateOrganizationSimilarity(
          r.organizationName || '', 
          row.organizationName || '',
          r.department || '',
          row.department || ''
        );
        
        if (emailMatch && eventDateMatch) {
          console.log(`   🔍 Record ${r.id}: email + event date match, org similarity=${(orgSimilarity * 100).toFixed(1)}%`);
          console.log(`      Existing org: "${r.organizationName}" + dept: "${r.department || ''}"`);
          console.log(`      Sheet org:    "${row.organizationName}" + dept: "${row.department || ''}"`);
        }
        
        if (orgSimilarity > 0.6) { // 60% similarity threshold
          console.log(`✅ MATCH FOUND (Email+EventDate+OrgSimilarity): ${row.email} on ${sheetEventDate.toLocaleDateString()} with ${(orgSimilarity * 100).toFixed(0)}% org similarity for ${row.organizationName}`);
          return true;
        }
        
        return false;
      });
      
      if (emailOnlyMatch) {
        console.log(`🔍 DUPLICATE DETECTION END: MATCHED\n`);
        return emailOnlyMatch;
      } else {
        console.log(`   ❌ No matches found with email + event date + sufficient org similarity`);
      }
    } else {
      console.log(`   ⚠️ Missing required data for Priority 3 matching`);
      console.log(`      email: ${!!row.email}, desiredEventDate: ${!!eventRequestData.desiredEventDate}`);
    }

    // PRIORITY 4: Fallback fuzzy matching for organization name changes (with event date validation)
    const fuzzyMatch = existingRequests.find((r) => {
      // CRITICAL: Require event date match first to prevent merging different events
      if (!r.desiredEventDate || !eventRequestData.desiredEventDate) {
        return false; // Cannot safely match without event date information
      }
      
      const existingEventDate = new Date(r.desiredEventDate);
      const sheetEventDate = new Date(eventRequestData.desiredEventDate!);
      const eventDateMatch = existingEventDate.getTime() === sheetEventDate.getTime();
      
      if (!eventDateMatch) {
        return false; // Different event dates = different events, must be kept separate
      }
      
      // Basic field matches (only proceed if event dates match)
      const emailMatch = r.email && row.email && 
        r.email.toLowerCase().trim() === row.email.toLowerCase().trim();
      
      const phoneMatch = r.phone && row.phone && 
        r.phone.replace(/\D/g, '') === row.phone.replace(/\D/g, '');
      
      const fullNameMatch = 
        r.firstName?.toLowerCase().trim() === firstName.toLowerCase().trim() &&
        r.lastName?.toLowerCase().trim() === lastName.toLowerCase().trim() &&
        firstName.trim() && lastName.trim();

      // Enhanced organization matching to handle restructuring
      const orgSimilarity = this.calculateOrganizationSimilarity(
        r.organizationName || '', 
        row.organizationName || '',
        r.department || '',
        row.department || ''
      );

      // Log debug info for suspicious matches
      if (row.organizationName?.toLowerCase().includes('marietta') ||
          row.organizationName?.toLowerCase().includes('franklin') ||
          row.organizationName?.toLowerCase().includes('cherokee')) {
        console.log(`🔍 Fuzzy matching ${row.organizationName} (Event: ${sheetEventDate.toLocaleDateString()}):`);
        console.log(`  Event date match: ${eventDateMatch} (${existingEventDate.toLocaleDateString()} vs ${sheetEventDate.toLocaleDateString()})`);
        console.log(`  Email match: ${emailMatch} (${row.email} vs ${r.email})`);
        console.log(`  Name match: ${fullNameMatch} (${firstName} ${lastName} vs ${r.firstName} ${r.lastName})`);
        console.log(`  Phone match: ${phoneMatch}`);
        console.log(`  Org similarity: ${(orgSimilarity * 100).toFixed(1)}% ("${r.organizationName}" + "${r.department || ''}" vs "${row.organizationName}" + "${r.department || ''}")`);
      }

      // Match criteria (any of these strong combinations) - all require same event date
      if (emailMatch && orgSimilarity > 0.5) {
        console.log(`✅ MATCH FOUND (Email+EventDate+FuzzyOrg): ${row.email} on ${sheetEventDate.toLocaleDateString()} with ${(orgSimilarity * 100).toFixed(0)}% org similarity for ${row.organizationName}`);
        return true;
      }
      
      if (phoneMatch && orgSimilarity > 0.7) {
        console.log(`✅ MATCH FOUND (Phone+EventDate+FuzzyOrg): ${row.phone} on ${sheetEventDate.toLocaleDateString()} with ${(orgSimilarity * 100).toFixed(0)}% org similarity for ${row.organizationName}`);
        return true;
      }
      
      if (fullNameMatch && orgSimilarity > 0.8) {
        console.log(`✅ MATCH FOUND (FullName+EventDate+FuzzyOrg): ${firstName} ${lastName} on ${sheetEventDate.toLocaleDateString()} with ${(orgSimilarity * 100).toFixed(0)}% org similarity for ${row.organizationName}`);
        return true;
      }

      return false;
    });

    if (fuzzyMatch) {
      console.log(`🔍 DUPLICATE DETECTION END: MATCHED\n`);
      return fuzzyMatch;
    } else {
      console.log(`   ❌ No matches found with fuzzy matching criteria`);
      console.log(`🔍 DUPLICATE DETECTION END: NO MATCH FOUND - WILL CREATE NEW RECORD\n`);
      return undefined;
    }
  }

  /**
   * Calculate organization similarity to handle name restructuring
   * Considers: exact matches, word overlap, department combinations, common abbreviations
   */
  private calculateOrganizationSimilarity(
    existingOrg: string, 
    newOrg: string, 
    existingDept: string = '', 
    newDept: string = ''
  ): number {
    if (!existingOrg || !newOrg) return 0;

    // Normalize strings for comparison
    const normalize = (str: string) => str.toLowerCase().trim().replace(/[^\w\s]/g, ' ').replace(/\s+/g, ' ');
    
    const existing = normalize(existingOrg + ' ' + existingDept);
    const newValue = normalize(newOrg + ' ' + newDept);
    
    // Exact match
    if (existing === newValue) return 1.0;
    
    // Check if one contains the other (handles "School" vs "School NHS")
    if (existing.includes(newValue) || newValue.includes(existing)) {
      return 0.9;
    }
    
    // Word-based similarity
    const existingWords = new Set(existing.split(' ').filter(w => w.length > 2));
    const newWords = new Set(newValue.split(' ').filter(w => w.length > 2));
    
    const intersection = new Set([...existingWords].filter(w => newWords.has(w)));
    const union = new Set([...existingWords, ...newWords]);
    
    if (union.size === 0) return 0;
    
    const jaccardSimilarity = intersection.size / union.size;
    
    // Boost score for common organization patterns
    const hasCommonSchoolPattern = 
      (existing.includes('school') && newValue.includes('school')) ||
      (existing.includes('high') && newValue.includes('high')) ||
      (existing.includes('middle') && newValue.includes('middle'));
    
    if (hasCommonSchoolPattern && jaccardSimilarity > 0.3) {
      return Math.min(jaccardSimilarity + 0.2, 1.0);
    }
    
    return jaccardSimilarity;
  }

  /**
   * Sync from Google Sheets to database using permanent blacklist for external_id tracking
   * REQUIREMENTS:
   * 1. Require external_id from the sheet
   * 2. Check permanent blacklist before attempting any insertions
   * 3. Skip external_ids that have EVER been imported (even if deleted)
   * 4. Add external_id to blacklist when successfully inserting new records
   * 5. Skip blank external_id rows
   * 6. Never update existing records - only insert new records
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

      let createdCount = 0;
      let skippedNoExternalId = 0;
      let skippedOldCount = 0;
      let conflictSkippedCount = 0;
      let blacklistSkippedCount = 0;

      console.log(`🔍 SYNC ANALYSIS: Processing ${sheetRows.length} rows from Google Sheets`);
      console.log(`🔍 SYNC SAFETY: Using permanent blacklist system for external_id duplicate prevention`);
      console.log(`🛡️ BLACKLIST: Checking imported_external_ids table to prevent re-importing deleted records`);

      for (const row of sheetRows) {
        // REQUIREMENT: Skip rows without external_id (blank/missing/null)
        if (!row.externalId || !row.externalId.trim()) {
          skippedNoExternalId++;
          console.log(`⏭️ SKIPPED: Row missing external_id - ${row.organizationName || 'Unknown Org'} - ${row.contactName || 'Unknown Contact'}`);
          continue;
        }

        // CRITICAL: Check permanent blacklist BEFORE attempting any insertion
        const externalIdTrimmed = row.externalId.trim();
        const isBlacklisted = await this.storage.checkExternalIdExists(externalIdTrimmed, 'event_requests');
        
        if (isBlacklisted) {
          blacklistSkippedCount++;
          console.log(`🚫 BLACKLIST: External_id already imported (permanently blocked): ${externalIdTrimmed} - ${row.organizationName}`);
          console.log(`    ↳ This external_id has been imported before and will NEVER be imported again`);
          continue;
        }

        console.log(`✅ BLACKLIST: External_id ${externalIdTrimmed} is clear for import - ${row.organizationName}`);

        if (!row.organizationName) {
          console.log(`⏭️ SKIPPED: Row missing organization name - external_id: ${row.externalId}`);
          continue;
        }

        // Convert row to event request data
        const eventRequestData = this.sheetRowToEventRequest(row);

        // Check if this is an old event that shouldn't be imported
        const eventDate = this.parseExcelDate(row.desiredEventDate, 'desired event date');
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        if (eventDate && eventDate < today) {
          const daysSinceEvent = Math.floor((today.getTime() - eventDate.getTime()) / (1000 * 60 * 60 * 24));
          
          // Skip importing events that are more than 30 days in the past
          if (daysSinceEvent > 30) {
            skippedOldCount++;
            console.log(
              `⏭️ SKIPPED: Old event (${daysSinceEvent} days ago) - external_id: ${row.externalId} - ${row.organizationName}`
            );
            continue;
          } else {
            console.warn(
              `⚠️ Importing past event (${daysSinceEvent} days ago) - external_id: ${row.externalId} - ${row.organizationName}`
            );
          }
        }
        // Prepare data for Drizzle insertion using external_id for conflict detection
        console.log(`✨ PROCESSING: external_id: ${row.externalId} - ${row.organizationName} - ${row.contactName}`);

        // Ensure dates are valid before saving to database
        const sanitizedData = {
          ...eventRequestData,
          createdBy: 'google_sheets_sync',
          googleSheetRowId: row.rowIndex?.toString(),
          lastSyncedAt: new Date(),
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
          // SAFE INSERT: Since we've checked the blacklist, this should be a new record
          // No need for onConflictDoNothing() since blacklist already prevents duplicates
          const result = await db
            .insert(eventRequests)
            .values(sanitizedData as any)
            .returning({ id: eventRequests.id, externalId: eventRequests.externalId });

          if (result && result.length > 0) {
            // Record was successfully inserted
            console.log(`✅ INSERTED new record: ID ${result[0].id} - external_id: ${result[0].externalId} - ${row.organizationName}`);
            
            // CRITICAL: Add external_id to permanent blacklist immediately after successful insertion
            try {
              await this.storage.addExternalIdToBlacklist(
                externalIdTrimmed,
                'event_requests',
                `Imported from Google Sheets on ${new Date().toISOString()}`
              );
              console.log(`🛡️ BLACKLIST: Added external_id ${externalIdTrimmed} to permanent blacklist`);
            } catch (blacklistError) {
              console.error(`⚠️ WARNING: Failed to add external_id ${externalIdTrimmed} to blacklist:`, blacklistError);
              // Continue processing - the record was still inserted successfully
            }
            
            createdCount++;
          } else {
            // This shouldn't happen since we checked the blacklist, but handle gracefully
            console.warn(`⚠️ UNEXPECTED: Insert returned no result for external_id: ${row.externalId} - ${row.organizationName}`);
            conflictSkippedCount++;
          }
        } catch (error) {
          console.error(`❌ Failed to insert record for external_id: ${row.externalId} - ${row.organizationName}:`, error);
          // Continue processing other records
        }
      }

      console.log(`🔍 SYNC COMPLETE: ${createdCount} new records inserted, ${blacklistSkippedCount} blocked by permanent blacklist, ${conflictSkippedCount} other conflicts, ${skippedNoExternalId} rows without external_id skipped, ${skippedOldCount} old events skipped`);
      console.log(`🛡️ SAFETY CONFIRMATION: Permanent blacklist system ensures external_ids are NEVER imported twice`);
      console.log(`🛡️ IMPORT ONCE GUARANTEE: ${blacklistSkippedCount} external_ids were permanently blocked from re-import`);

      return {
        success: true,
        message: `Successfully synced using permanent blacklist: ${createdCount} created, ${blacklistSkippedCount} permanently blocked, ${skippedNoExternalId} missing external_id skipped`,
        created: createdCount,
        updated: 0, // Always 0 - we never update existing records
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
   * DEPRECATED: No longer updating Google Sheets - one-way sync only
   * @deprecated This method is no longer used as we only sync FROM sheets, not TO sheets
   */
  private async updateEventRequestsSheet(
    eventRequests: EventRequestSheetRow[]
  ): Promise<void> {
    // DISABLED: One-way sync only - we don't write back to Google Sheets
    console.warn('⚠️ updateEventRequestsSheet called but is disabled - one-way sync only');
    return;

    /* Original implementation commented out:
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
    */
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
   * Read event requests from Google Sheets with dynamic header mapping
   */
  private async readEventRequestsSheet(): Promise<EventRequestSheetRow[]> {
    if (!this.sheets) {
      throw new Error('Google Sheets service not initialized');
    }

    // First, read the header row to build dynamic column mapping
    const headerResponse = await this.sheets.spreadsheets.values.get({
      spreadsheetId: (this as any).config.spreadsheetId,
      range: `${(this as any).config.worksheetName}!A1:Z1`,
    });

    const headers = headerResponse.data.values?.[0] || [];
    console.log('📋 Actual sheet headers:', headers);

    // Build header to index mapping (case-insensitive)
    const headerMap = new Map<string, number>();
    headers.forEach((header: string, index: number) => {
      if (header && header.trim()) {
        const normalizedHeader = header.trim().toLowerCase();
        headerMap.set(normalizedHeader, index);
        console.log(`📋 Header mapping: "${header}" (${normalizedHeader}) → column ${index}`);
      }
    });

    // Define expected headers and their possible variations
    const getColumnIndex = (possibleHeaders: string[]): number => {
      for (const header of possibleHeaders) {
        const index = headerMap.get(header.toLowerCase());
        if (index !== undefined) {
          console.log(`✅ Found header "${header}" at column ${index}`);
          return index;
        }
      }
      console.warn(`⚠️ Header not found for: ${possibleHeaders.join(', ')}`);
      return -1;
    };

    // Map expected fields to their column indices - Updated for new sheet structure
    const columnMapping = {
      externalId: getColumnIndex(['external_id', 'external id', 'id', 'unique_id', 'unique id', 'record_id', 'record id']),
      submittedOn: getColumnIndex(['submitted on', 'timestamp', 'submission date', 'date submitted', 'created']),
      name: getColumnIndex(['name', 'full name', 'contact name', 'your name']), // Single name field
      firstName: getColumnIndex(['first name', 'fname', 'first']), // Legacy support
      lastName: getColumnIndex(['last name', 'lname', 'last']), // Legacy support
      email: getColumnIndex(['your email', 'email', 'email address', 'e-mail', 'contact email']),
      organizationName: getColumnIndex(['grouporganization', 'group/organization name', 'organization', 'group', 'organization name', 'company', 'org name']),
      department: getColumnIndex(['department/team if applicable', 'department', 'team', 'dept', 'division', 'department/team']),
      phone: getColumnIndex(['phone number', 'phone', 'contact phone', 'telephone', 'mobile', 'cell phone']),
      desiredEventDate: getColumnIndex(['desired event date', 'event date', 'date requested', 'preferred date', 'requested date']),
      previouslyHosted: getColumnIndex(['has your organization done an event with us before?', 'previously hosted', 'previous event', 'hosted before', 'past event']),
      message: getColumnIndex(['message', 'additional details', 'details', 'description', 'comments', 'notes', 'additional information']),
      status: getColumnIndex(['status', 'current status', 'state', 'event status']),
    };

    console.log('📋 Column mapping results:', columnMapping);

    // Check if we failed to detect most headers - might need fallback to fixed positions
    const mappedColumnsCount = Object.values(columnMapping).filter(idx => idx >= 0).length;
    const useFixedPositions = mappedColumnsCount < 5; // If less than 5 columns were found, use fixed positions

    if (useFixedPositions) {
      console.warn('⚠️ Header detection failed for most columns. Using fallback fixed column positions.');
      console.warn('⚠️ Detected headers:', headers);
      console.warn('⚠️ This may indicate the Google Sheet headers have changed.');

      // Common Squarespace form export column order (adjust based on your actual sheet)
      // These are typical positions - you may need to adjust based on your actual sheet
      columnMapping.submittedOn = 0; // Column A - Timestamp/Submitted On
      columnMapping.name = 1; // Column B - Name
      columnMapping.email = 2; // Column C - Email
      columnMapping.phone = 3; // Column D - Phone
      columnMapping.organizationName = 4; // Column E - Organization
      columnMapping.department = 5; // Column F - Department
      columnMapping.desiredEventDate = 6; // Column G - Desired Event Date
      columnMapping.message = 7; // Column H - Message
      columnMapping.previouslyHosted = 8; // Column I - Previously Hosted
      columnMapping.status = 9; // Column J - Status (if exists)

      console.log('📋 Using FIXED column positions:', columnMapping);
    }

    // Read data rows
    const response = await this.sheets.spreadsheets.values.get({
      spreadsheetId: (this as any).config.spreadsheetId,
      range: `${(this as any).config.worksheetName}!A2:Z1000`,
    });

    const rows = response.data.values || [];
    console.log(`📊 Reading ${rows.length} rows from Google Sheets`);
    if (rows.length > 0) {
      console.log('📋 First data row (raw values):', rows[0]);
      console.log('📋 First row field mapping:');
      console.log(`  Col ${columnMapping.name}: ${rows[0][columnMapping.name]}`);
      console.log(`  Col ${columnMapping.email}: ${rows[0][columnMapping.email]}`);
      console.log(`  Col ${columnMapping.phone}: ${rows[0][columnMapping.phone]}`);
      console.log(`  Col ${columnMapping.message}: ${rows[0][columnMapping.message]}`);
      console.log(`  Col ${columnMapping.desiredEventDate}: ${rows[0][columnMapping.desiredEventDate]}`);
      if (rows.length > 1) {
        console.log('📋 Second data row:', rows[1]);
      }
    }

    return rows.map((row: string[], index: number) => {
      // ACTUALLY USE the dynamic column mapping computed above!
      const getFieldValue = (colIndex: number, defaultValue = '') => {
        if (colIndex < 0) {
          if (index === 0) { // Only warn once for missing columns
            console.warn(`⚠️ Column not found in sheet, using default: "${defaultValue}"`);
          }
          return defaultValue;
        }

        let value = row[colIndex] || defaultValue;

        // Clean up phone numbers if detected in phone column
        if (colIndex === columnMapping.phone && value) {
          // Remove any non-digit characters except common phone separators
          const originalValue = value;
          // Check if this looks like an Excel serial number (all digits, 5-6 digits long)
          if (/^\d{5,6}$/.test(value)) {
            console.warn(`⚠️ Phone field contains Excel serial number: "${value}" - likely a date field misplaced`);
            value = ''; // Clear invalid phone numbers
          } else {
            // Clean normal phone numbers
            value = value.replace(/[^\d\s\-\(\)\+\.]/g, '').trim();
            if (value !== originalValue && index < 3) {
              console.log(`📱 Cleaned phone: "${originalValue}" → "${value}"`);
            }
          }
        }

        return value;
      };

      // Handle single Name field from new sheet structure or legacy firstName/lastName
      let firstName = '';
      let lastName = '';
      let contactName = '';

      if (columnMapping.name >= 0) {
        // New sheet structure: single Name field
        const fullName = getFieldValue(columnMapping.name);
        contactName = fullName;
        
        // Split name into firstName and lastName
        if (fullName && fullName.trim()) {
          const nameParts = fullName.trim().split(/\s+/);
          firstName = nameParts[0] || '';
          lastName = nameParts.slice(1).join(' ') || '';
        }
      } else {
        // Legacy sheet structure: separate firstName/lastName fields
        firstName = getFieldValue(columnMapping.firstName);
        lastName = getFieldValue(columnMapping.lastName);
        contactName = `${firstName} ${lastName}`.trim();
      }

      // Extract values with detailed logging for debugging
      const phoneValue = getFieldValue(columnMapping.phone);
      const messageValue = getFieldValue(columnMapping.message);
      const dateValue = getFieldValue(columnMapping.desiredEventDate);

      // Log potential issues with field extraction
      if (index < 5 && (phoneValue || messageValue)) {
        console.log(`🔍 Field extraction for row ${index + 2}:`);
        console.log(`  Phone column [${columnMapping.phone}]: "${phoneValue}"`);
        console.log(`  Message column [${columnMapping.message}]: "${messageValue}"`);
        console.log(`  Date column [${columnMapping.desiredEventDate}]: "${dateValue}"`);

        // Check if values seem to be in wrong columns
        if (phoneValue && phoneValue.length > 20 && !phoneValue.match(/^[\d\s\-\(\)\+]+$/)) {
          console.warn(`⚠️ Phone field contains non-phone data: "${phoneValue.substring(0, 50)}..."`);
        }
        if (messageValue && messageValue.match(/^[\d\s\-\(\)\+]+$/) && messageValue.length < 20) {
          console.warn(`⚠️ Message field might contain phone number: "${messageValue}"`);
        }
      }

      const result = {
        externalId: getFieldValue(columnMapping.externalId),
        submittedOn: getFieldValue(columnMapping.submittedOn),
        contactName: contactName || 'Unknown Contact',
        email: getFieldValue(columnMapping.email),
        organizationName: getFieldValue(columnMapping.organizationName),
        message: messageValue,
        phone: phoneValue || '', // Will default to '' if not found
        desiredEventDate: dateValue,
        department: getFieldValue(columnMapping.department),
        previouslyHosted: getFieldValue(columnMapping.previouslyHosted, 'i_dont_know'),
        status: (() => {
          // CRITICAL FIX: Only assign status if column exists, otherwise don't default to 'new'
          const statusValue = getFieldValue(columnMapping.status, '');
          if (statusValue && statusValue.trim()) {
            return statusValue.trim();
          }
          // Don't default to 'new' - let the sheetRowToEventRequest logic handle it
          return '';
        })(),
        createdDate: '',
        lastUpdated: new Date().toISOString(),
        duplicateCheck: 'No',
        notes: getFieldValue(columnMapping.previouslyHosted), // Use same as previouslyHosted for notes
        rowIndex: index + 2, // Data starts from row 2 (index 0 = row 2)
      };

      // Log the first few rows for debugging
      if (index < 3) {
        console.log(`🔍 DYNAMIC Row ${index + 2} mapping (using header detection):`);
        console.log(`  externalId[${columnMapping.externalId}]: "${result.externalId}"`);
        if (columnMapping.name >= 0) {
          console.log(`  name[${columnMapping.name}]: "${contactName}" → firstName: "${firstName}", lastName: "${lastName}"`);
        } else {
          console.log(`  firstName[${columnMapping.firstName}]: "${firstName}"`);
          console.log(`  lastName[${columnMapping.lastName}]: "${lastName}"`);
        }
        console.log(`  email[${columnMapping.email}]: "${result.email}"`);
        console.log(`  organization[${columnMapping.organizationName}]: "${result.organizationName}"`);
        console.log(`  department[${columnMapping.department}]: "${result.department}"`);
        console.log(`  previouslyHosted[${columnMapping.previouslyHosted}]: "${result.previouslyHosted}"`);
        console.log(`  message[${columnMapping.message}]: "${result.message?.substring(0, 50)}..."`);
        console.log(`  desiredEventDate[${columnMapping.desiredEventDate}]: "${result.desiredEventDate}"`);
        console.log(`  status[${columnMapping.status}]: "${result.status}"`);
      }

      return result;
    });
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
