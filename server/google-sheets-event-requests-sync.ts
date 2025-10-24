import { google } from 'googleapis';
import { JWT } from 'google-auth-library';
import type { IStorage } from './storage';
import { EventRequest, Organization, eventRequests } from '@shared/schema';
import { AuditLogger } from './audit-logger';
import { db } from './db';
import { eq, sql } from 'drizzle-orm';
import { logger } from './utils/production-safe-logger';

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

export class EventRequestsGoogleSheetsService {
  private auth!: JWT;
  private sheets: any;
  private spreadsheetId: string;
  private worksheetName: string = 'Sheet1';

  constructor(private storage: IStorage) {
    this.spreadsheetId = process.env.EVENT_REQUESTS_SHEET_ID!;
    // Don't call async initialization in constructor
  }

  private async ensureInitialized() {
    if (!this.sheets) {
      await this.initializeAuth();
    }
  }

  private async initializeAuth() {
    // Use JWT authentication (same as other Google Sheets integrations)
    const rawPrivateKey = process.env.GOOGLE_PRIVATE_KEY;
    if (!rawPrivateKey || !process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL) {
      throw new Error('Google Sheets credentials not configured');
    }

    // **NODE.JS v20 COMPATIBILITY FIX** - Handle all newline format issues
    let cleanPrivateKey = rawPrivateKey;

    // Handle escaped newlines
    if (cleanPrivateKey.includes('\\n')) {
      cleanPrivateKey = cleanPrivateKey.replace(/\\n/g, '\n');
    }

    // Additional newline handling
    cleanPrivateKey = cleanPrivateKey
      .replace(/\\r\\n/g, '\n')
      .replace(/\\r/g, '\n')
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n');

    // **CRITICAL NODE.JS v20 FIX** - Handle single-line key format
    if (
      !cleanPrivateKey.includes('\n') &&
      cleanPrivateKey.includes('-----BEGIN PRIVATE KEY-----')
    ) {
      const beginMarker = '-----BEGIN PRIVATE KEY-----';
      const endMarker = '-----END PRIVATE KEY-----';
      const beginIndex = cleanPrivateKey.indexOf(beginMarker);
      const endIndex = cleanPrivateKey.indexOf(endMarker);

      if (beginIndex !== -1 && endIndex !== -1) {
        const keyContent = cleanPrivateKey
          .substring(beginIndex + beginMarker.length, endIndex)
          .trim();

        // Rebuild key with proper line breaks every 64 characters
        const lines = [beginMarker];
        for (let i = 0; i < keyContent.length; i += 64) {
          lines.push(keyContent.substring(i, i + 64));
        }
        lines.push(endMarker);

        cleanPrivateKey = lines.join('\n');
      }
    }

    this.auth = new google.auth.JWT(
      process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      undefined,
      cleanPrivateKey,
      [
        'https://www.googleapis.com/auth/spreadsheets',
        'https://www.googleapis.com/auth/drive',
      ]
    );

    this.sheets = google.sheets({ version: 'v4', auth: this.auth });
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
          logger.error(
            `❌ CRITICAL: Invalid Excel serial number for ${fieldName}: "${dateValue}"`
          );
          return null;
        }

        logger.log(
          `✅ Converted Excel serial number "${dateValue}" (${fieldName}) to:`,
          date.toISOString(),
          `(${date.toLocaleDateString()})`
        );
        
        return date;
      } else {
        // Try parsing as regular date string
        const date = new Date(cleaned);
        
        if (isNaN(date.getTime())) {
          logger.error(
            `❌ CRITICAL: Invalid ${fieldName} format: "${dateValue}"`
          );
          return null;
        }

        logger.log(
          `✅ Parsed ${fieldName} "${dateValue}" to:`,
          date.toISOString()
        );
        
        return date;
      }
    } catch (error) {
      logger.error(
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
          logger.log(`📊 Using sheet status: "${row.status.trim()}" for new import: ${row.organizationName}`);
          return row.status.trim();
        }

        // For events without status, check if it's a past event
        if (row.desiredEventDate && row.desiredEventDate.trim()) {
          try {
            const eventDate = new Date(row.desiredEventDate.trim());
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            if (!isNaN(eventDate.getTime()) && eventDate < today) {
              logger.log(`📊 Assigning 'completed' status for past event: ${row.organizationName} (${eventDate.toLocaleDateString()})`);
              return 'completed'; // Past events are marked as completed
            }
          } catch (error) {
            logger.warn(
              'Error parsing event date for status determination:',
              row.desiredEventDate
            );
          }
        }

        logger.log(`📊 Assigning default 'new' status for: ${row.organizationName}`);
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
    logger.warn('⚠️ updateEventRequestStatus called but is disabled - one-way sync only');
    return {
      success: false,
      message: 'Google Sheets updates are disabled - one-way sync only'
    };

    /* Original implementation commented out:
    try {
      await this.ensureInitialized();

      // Read current sheet to find the row
      const response = await this.sheets.spreadsheets.values.get({
        spreadsheetId: this.spreadsheetId,
        range: `${this.worksheetName}!A2:K1000`,
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
        spreadsheetId: this.spreadsheetId,
        range: `${this.worksheetName}!K${actualRowNumber}`,
        valueInputOption: 'USER_ENTERED',
        resource: { values: [[newStatus]] },
      });

      logger.log(
        `✅ Updated Google Sheets status for ${organizationName} - ${contactName} to: ${newStatus}`
      );
      return {
        success: true,
        message: `Updated status to ${newStatus} in Google Sheets`,
      };
    } catch (error) {
      logger.error('Error updating Google Sheets status:', error);
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
    logger.log(`\n🔍 DUPLICATE DETECTION START for: ${row.organizationName} - ${row.contactName}`);
    logger.log(`   📧 Email: ${row.email}`);
    logger.log(`   📅 Event Date (raw): ${row.desiredEventDate}`);
    logger.log(`   📅 Event Date (parsed): ${eventRequestData.desiredEventDate?.toISOString() || 'NULL'}`);
    logger.log(`   📝 Row Index: ${row.rowIndex}`);
    
    const existingRequests = await this.storage.getAllEventRequests();
    logger.log(`   🗃️ Total existing records to check: ${existingRequests.length}`);
    
    const nameParts = row.contactName.split(' ');
    const firstName = nameParts[0] || '';
    const lastName = nameParts.slice(1).join(' ') || '';

    // PRIORITY 1: Google Sheets Row ID (most stable identifier)
    logger.log(`\n🏆 PRIORITY 1: GoogleSheetRowId matching...`);
    if (row.rowIndex) {
      logger.log(`   🔍 Looking for googleSheetRowId = '${row.rowIndex.toString()}'`);
      const rowIdMatch = existingRequests.find((r) => {
        const hasMatch = r.googleSheetRowId === row.rowIndex?.toString();
        if (hasMatch) {
          logger.log(`   ✅ Found match by GoogleSheetRowId: ${r.id} - ${r.organizationName}`);
        }
        return hasMatch;
      });
      if (rowIdMatch) {
        logger.log(`✅ MATCH FOUND (GoogleSheetRowId): Row ${row.rowIndex} for ${row.organizationName}`);
        logger.log(`🔍 DUPLICATE DETECTION END: MATCHED\n`);
        return rowIdMatch;
      } else {
        logger.log(`   ❌ No existing records found with googleSheetRowId = '${row.rowIndex}'`);
        const recordsWithRowIds = existingRequests.filter(r => r.googleSheetRowId).length;
        logger.log(`   📊 Total existing records with googleSheetRowId: ${recordsWithRowIds}`);
      }
    } else {
      logger.log(`   ⚠️ No row.rowIndex provided`);
    }

    // PRIORITY 2: Submission timestamp + email + desiredEventDate combination (very stable, prevents merging different events)
    logger.log(`\n🥈 PRIORITY 2: Submission timestamp + email + event date matching...`);
    if (row.submittedOn && row.email && eventRequestData.createdAt && eventRequestData.desiredEventDate) {
      logger.log(`   🔍 Looking for: email='${row.email}', submittedOn='${row.submittedOn}', eventDate='${eventRequestData.desiredEventDate.toISOString()}'`);
      
      const submissionTimeMatch = existingRequests.find((r, index) => {
        if (!r.email || !r.createdAt || !r.desiredEventDate) {
          if (index < 5) logger.log(`   ⚠️ Record ${r.id}: Missing required fields (email=${!!r.email}, createdAt=${!!r.createdAt}, desiredEventDate=${!!r.desiredEventDate})`);
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
          logger.log(`   🔍 Record ${r.id}: email match, timeDiff=${Math.round(timeDiff/1000)}s (max ${Math.round(maxTimeDiff/1000)}s), eventDateMatch=${eventDateMatch}`);
          logger.log(`      Existing: ${existingDate.toISOString()} → ${existingEventDate.toISOString()}`);
          logger.log(`      Sheet:    ${sheetDate.toISOString()} → ${sheetEventDate.toISOString()}`);
        }
        
        if (emailMatch && timeMatch && eventDateMatch) {
          logger.log(`✅ MATCH FOUND (SubmissionTime+Email+EventDate): ${row.email} submitted ${sheetDate.toLocaleDateString()} for event on ${sheetEventDate.toLocaleDateString()} - ${row.organizationName}`);
          return true;
        }
        
        return false;
      });
      
      if (submissionTimeMatch) {
        logger.log(`🔍 DUPLICATE DETECTION END: MATCHED\n`);
        return submissionTimeMatch;
      } else {
        logger.log(`   ❌ No matches found with exact submission time + email + event date`);
      }
    } else {
      logger.log(`   ⚠️ Missing required data for Priority 2 matching`);
      logger.log(`      submittedOn: ${!!row.submittedOn}, email: ${!!row.email}`);
      logger.log(`      createdAt: ${!!eventRequestData.createdAt}, desiredEventDate: ${!!eventRequestData.desiredEventDate}`);
    }

    // PRIORITY 3: Exact email match with event date validation (same person, same org, same event)
    logger.log(`\n🥉 PRIORITY 3: Email + event date + organization similarity matching...`);
    if (row.email && eventRequestData.desiredEventDate) {
      logger.log(`   🔍 Looking for: email='${row.email}', eventDate='${eventRequestData.desiredEventDate.toISOString()}'`);
      
      const emailOnlyMatch = existingRequests.find((r, index) => {
        if (!r.email || !r.desiredEventDate) {
          if (index < 5) logger.log(`   ⚠️ Record ${r.id}: Missing required fields (email=${!!r.email}, desiredEventDate=${!!r.desiredEventDate})`);
          return false;
        }
        
        const emailMatch = r.email.toLowerCase().trim() === row.email.toLowerCase().trim();
        if (!emailMatch) return false;
        
        // CRITICAL: Require matching event dates to prevent merging different events
        const existingEventDate = new Date(r.desiredEventDate);
        const sheetEventDate = new Date(eventRequestData.desiredEventDate!);
        const eventDateMatch = existingEventDate.getTime() === sheetEventDate.getTime();
        
        if (emailMatch && index < 3) {
          logger.log(`   🔍 Record ${r.id} (${r.organizationName}): email match, eventDateMatch=${eventDateMatch}`);
          logger.log(`      Existing event date: ${existingEventDate.toISOString()}`);
          logger.log(`      Sheet event date:    ${sheetEventDate.toISOString()}`);
        }
        
        if (!eventDateMatch) {
          if (emailMatch && index < 3) {
            logger.log(`   ❌ Record ${r.id}: Different event dates - keeping separate`);
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
          logger.log(`   🔍 Record ${r.id}: email + event date match, org similarity=${(orgSimilarity * 100).toFixed(1)}%`);
          logger.log(`      Existing org: "${r.organizationName}" + dept: "${r.department || ''}"`);
          logger.log(`      Sheet org:    "${row.organizationName}" + dept: "${row.department || ''}"`);
        }
        
        if (orgSimilarity > 0.6) { // 60% similarity threshold
          logger.log(`✅ MATCH FOUND (Email+EventDate+OrgSimilarity): ${row.email} on ${sheetEventDate.toLocaleDateString()} with ${(orgSimilarity * 100).toFixed(0)}% org similarity for ${row.organizationName}`);
          return true;
        }
        
        return false;
      });
      
      if (emailOnlyMatch) {
        logger.log(`🔍 DUPLICATE DETECTION END: MATCHED\n`);
        return emailOnlyMatch;
      } else {
        logger.log(`   ❌ No matches found with email + event date + sufficient org similarity`);
      }
    } else {
      logger.log(`   ⚠️ Missing required data for Priority 3 matching`);
      logger.log(`      email: ${!!row.email}, desiredEventDate: ${!!eventRequestData.desiredEventDate}`);
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
        logger.log(`🔍 Fuzzy matching ${row.organizationName} (Event: ${sheetEventDate.toLocaleDateString()}):`);
        logger.log(`  Event date match: ${eventDateMatch} (${existingEventDate.toLocaleDateString()} vs ${sheetEventDate.toLocaleDateString()})`);
        logger.log(`  Email match: ${emailMatch} (${row.email} vs ${r.email})`);
        logger.log(`  Name match: ${fullNameMatch} (${firstName} ${lastName} vs ${r.firstName} ${r.lastName})`);
        logger.log(`  Phone match: ${phoneMatch}`);
        logger.log(`  Org similarity: ${(orgSimilarity * 100).toFixed(1)}% ("${r.organizationName}" + "${r.department || ''}" vs "${row.organizationName}" + "${r.department || ''}")`);
      }

      // Match criteria (any of these strong combinations) - all require same event date
      if (emailMatch && orgSimilarity > 0.5) {
        logger.log(`✅ MATCH FOUND (Email+EventDate+FuzzyOrg): ${row.email} on ${sheetEventDate.toLocaleDateString()} with ${(orgSimilarity * 100).toFixed(0)}% org similarity for ${row.organizationName}`);
        return true;
      }
      
      if (phoneMatch && orgSimilarity > 0.7) {
        logger.log(`✅ MATCH FOUND (Phone+EventDate+FuzzyOrg): ${row.phone} on ${sheetEventDate.toLocaleDateString()} with ${(orgSimilarity * 100).toFixed(0)}% org similarity for ${row.organizationName}`);
        return true;
      }
      
      if (fullNameMatch && orgSimilarity > 0.8) {
        logger.log(`✅ MATCH FOUND (FullName+EventDate+FuzzyOrg): ${firstName} ${lastName} on ${sheetEventDate.toLocaleDateString()} with ${(orgSimilarity * 100).toFixed(0)}% org similarity for ${row.organizationName}`);
        return true;
      }

      return false;
    });

    if (fuzzyMatch) {
      logger.log(`🔍 DUPLICATE DETECTION END: MATCHED\n`);
      return fuzzyMatch;
    } else {
      logger.log(`   ❌ No matches found with fuzzy matching criteria`);
      logger.log(`🔍 DUPLICATE DETECTION END: NO MATCH FOUND - WILL CREATE NEW RECORD\n`);
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
   * Sync from Google Sheets to database - INSERT ONLY, never update existing records
   * CRITICAL GUARANTEE: Once a record is imported, it will NEVER be touched again by sync
   * 
   * REQUIREMENTS:
   * 1. Generate external_id from sheet data if not provided
   * 2. INSERT new records only (onConflictDoNothing ensures existing records are skipped)
   * 3. Manual database edits are PRESERVED - sync will never overwrite them
   * 4. Each external_id is imported exactly once
   * 5. Users can safely edit organization names, departments, contact info without fear of sync overwriting
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
      let updatedCount = 0;
      let skippedNoExternalId = 0;

      logger.log(`🔍 SYNC ANALYSIS: Processing ${sheetRows.length} rows from Google Sheets`);
      logger.log(`✨ INSERT-ONLY MODE: Will insert new records, skip existing ones (preserves manual edits)`);

      for (const row of sheetRows) {
        // UPDATED: External ID is now optional - generate one if missing
        if (!row.externalId || !row.externalId.trim()) {
          // Generate a STABLE identifier based on email + submittedOn + organization
          // NOTE: No timestamp - must be deterministic so the same row always gets the same ID
          const uniqueParts = [
            row.email || 'no-email',
            row.submittedOn || 'no-date',
            row.organizationName || 'no-org',
            row.contactName || 'no-name'
          ].join('|');
          
          // Create a stable hash-like identifier (no timestamp!)
          const hash = Buffer.from(uniqueParts).toString('base64').substring(0, 20).replace(/[^a-zA-Z0-9]/g, '');
          row.externalId = `auto-${hash}`;
          
          logger.log(`📝 Generated STABLE external_id for row: ${row.externalId} - ${row.organizationName || 'Unknown Org'} - ${row.contactName || 'Unknown Contact'}`);
        }

        const externalIdTrimmed = row.externalId.trim();

        // Convert row to event request data
        const eventRequestData = this.sheetRowToEventRequest(row);

        // Log info about event date if available
        const eventDate = this.parseExcelDate(row.desiredEventDate, 'desired event date');
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        if (eventDate && eventDate < today) {
          const daysSinceEvent = Math.floor((today.getTime() - eventDate.getTime()) / (1000 * 60 * 60 * 24));
          logger.warn(
            `⚠️ Importing past event (${daysSinceEvent} days ago) - external_id: ${row.externalId} - ${row.organizationName || 'Unknown Org'}`
          );
        }
        // Prepare data for Drizzle insertion using external_id for conflict detection
        logger.log(`✨ PROCESSING: external_id: ${row.externalId} - ${row.organizationName} - ${row.contactName}`);

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
          // DEBUG: Log the exact external_id we're checking
          logger.log(`🔍 DEBUG: Checking for external_id: "${externalIdTrimmed}"`);
          logger.log(`🔍 DEBUG: external_id length: ${externalIdTrimmed.length}, type: ${typeof externalIdTrimmed}`);
          
          // Check if record exists BEFORE upsert
          const existingRecord = await db
            .select({ 
              id: eventRequests.id, 
              status: eventRequests.status,
              externalId: eventRequests.externalId,
              organizationName: eventRequests.organizationName
            })
            .from(eventRequests)
            .where(eq(eventRequests.externalId, externalIdTrimmed))
            .limit(1);

          logger.log(`🔍 DEBUG: Query returned ${existingRecord.length} matches`);
          if (existingRecord.length > 0) {
            logger.log(`🔍 DEBUG: Matched record:`, {
              id: existingRecord[0].id,
              externalId: existingRecord[0].externalId,
              org: existingRecord[0].organizationName,
              status: existingRecord[0].status
            });
          } else {
            logger.log(`🔍 DEBUG: No existing record found - this should be an INSERT`);
          }

          const recordExisted = existingRecord && existingRecord.length > 0;

          // Use INSERT ON CONFLICT DO NOTHING - once imported, never touched again
          // This ensures manual edits in the database are NEVER overwritten by Google Sheets sync
          const result = await db
            .insert(eventRequests)
            .values(sanitizedData as any)
            .onConflictDoNothing({
              target: eventRequests.externalId,
            })
            .returning({ 
              id: eventRequests.id, 
              externalId: eventRequests.externalId
            });

          if (result && result.length > 0) {
            // If result has data, it means INSERT succeeded (new record)
            logger.log(`✅ INSERTED new record: ID ${result[0].id} - external_id: ${result[0].externalId} - ${row.organizationName}`);
            createdCount++;
          } else {
            // If result is empty, it means conflict was detected and nothing was done (existing record skipped)
            if (recordExisted) {
              logger.log(`⏭️ SKIPPED existing record (no changes): external_id: ${externalIdTrimmed} - ${row.organizationName}`);
              updatedCount++; // Track as "updated" (but really just skipped) for stats
            }
          }
        } catch (error) {
          logger.error(`❌ Failed to upsert record for external_id: ${row.externalId} - ${row.organizationName}:`, error);
          logger.error(`❌ Error details:`, error);
          // Continue processing other records
        }
      }

      logger.log(`🔍 SYNC COMPLETE: ${createdCount} new records inserted, ${updatedCount} existing records skipped (manual edits preserved)`);
      logger.log(`✅ INSERT-ONLY SUCCESS: Total ${createdCount + updatedCount} records processed`);

      return {
        success: true,
        message: `Successfully synced from Google Sheets: ${createdCount} created, ${updatedCount} skipped (existing)`,
        created: createdCount,
        updated: updatedCount,
      };
    } catch (error) {
      logger.error('Error syncing from Google Sheets:', error);
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
    logger.warn('⚠️ updateEventRequestsSheet called but is disabled - one-way sync only');
    return;

    /* Original implementation commented out:
    if (!this.sheets) {
      throw new Error('Google Sheets service not initialized');
    }

    if (eventRequests.length === 0) {
      logger.log('No event requests to sync');
      return;
    }

    // First, read existing data to preserve manual edits
    let existingData: any[][] = [];
    try {
      const response = await this.sheets.spreadsheets.values.get({
        spreadsheetId: this.spreadsheetId,
        range: `${this.worksheetName}!A:Z`,
      });
      existingData = response.data.values || [];
    } catch (error) {
      logger.warn(
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
      spreadsheetId: this.spreadsheetId,
      range: `${this.worksheetName}!A1`,
      valueInputOption: 'USER_ENTERED',
      resource: { values: mergedData },
    });

    logger.log(
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
      spreadsheetId: this.spreadsheetId,
      range: `${this.worksheetName}!A1:Z1`,
    });

    const headers = headerResponse.data.values?.[0] || [];
    logger.log('📋 Actual sheet headers:', headers);

    // Build header to index mapping (case-insensitive)
    const headerMap = new Map<string, number>();
    headers.forEach((header: string, index: number) => {
      if (header && header.trim()) {
        const normalizedHeader = header.trim().toLowerCase();
        headerMap.set(normalizedHeader, index);
        logger.log(`📋 Header mapping: "${header}" (${normalizedHeader}) → column ${index}`);
      }
    });

    // Define expected headers and their possible variations
    const getColumnIndex = (possibleHeaders: string[]): number => {
      for (const header of possibleHeaders) {
        const index = headerMap.get(header.toLowerCase());
        if (index !== undefined) {
          logger.log(`✅ Found header "${header}" at column ${index}`);
          return index;
        }
      }
      logger.warn(`⚠️ Header not found for: ${possibleHeaders.join(', ')}`);
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
      organizationName: getColumnIndex(['grouporganization name', 'grouporganization', 'group/organization name', 'organization', 'group', 'organization name', 'company', 'org name']),
      department: getColumnIndex(['departmentteam', 'department/team if applicable', 'department', 'team', 'dept', 'division', 'department/team']),
      phone: getColumnIndex(['phone number', 'phone', 'contact phone', 'telephone', 'mobile', 'cell phone']),
      desiredEventDate: getColumnIndex(['desired event date', 'event date', 'date requested', 'preferred date', 'requested date']),
      previouslyHosted: getColumnIndex(['has your organization done an event with us before?', 'previously hosted', 'previous event', 'hosted before', 'past event']),
      message: getColumnIndex(['message', 'additional details', 'details', 'description', 'comments', 'notes', 'additional information']),
      status: getColumnIndex(['status', 'current status', 'state', 'event status']),
    };

    logger.log('📋 Column mapping results:', columnMapping);

    // Check if we failed to detect most headers - might need fallback to fixed positions
    const mappedColumnsCount = Object.values(columnMapping).filter(idx => idx >= 0).length;
    const useFixedPositions = mappedColumnsCount < 5; // If less than 5 columns were found, use fixed positions

    if (useFixedPositions) {
      logger.warn('⚠️ Header detection failed for most columns. Using fallback fixed column positions.');
      logger.warn('⚠️ Detected headers:', headers);
      logger.warn('⚠️ This may indicate the Google Sheet headers have changed.');

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

      logger.log('📋 Using FIXED column positions:', columnMapping);
    }

    // Read data rows
    const response = await this.sheets.spreadsheets.values.get({
      spreadsheetId: this.spreadsheetId,
      range: `${this.worksheetName}!A2:Z1000`,
    });

    const rows = response.data.values || [];
    logger.log(`📊 Reading ${rows.length} rows from Google Sheets`);
    if (rows.length > 0) {
      logger.log('📋 First data row (raw values):', rows[0]);
      logger.log('📋 First row field mapping:');
      logger.log(`  Col ${columnMapping.name}: ${rows[0][columnMapping.name]}`);
      logger.log(`  Col ${columnMapping.email}: ${rows[0][columnMapping.email]}`);
      logger.log(`  Col ${columnMapping.phone}: ${rows[0][columnMapping.phone]}`);
      logger.log(`  Col ${columnMapping.message}: ${rows[0][columnMapping.message]}`);
      logger.log(`  Col ${columnMapping.desiredEventDate}: ${rows[0][columnMapping.desiredEventDate]}`);
      if (rows.length > 1) {
        logger.log('📋 Second data row:', rows[1]);
      }
    }

    return rows.map((row: string[], index: number) => {
      // ACTUALLY USE the dynamic column mapping computed above!
      const getFieldValue = (colIndex: number, defaultValue = '') => {
        if (colIndex < 0) {
          if (index === 0) { // Only warn once for missing columns
            logger.warn(`⚠️ Column not found in sheet, using default: "${defaultValue}"`);
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
            logger.warn(`⚠️ Phone field contains Excel serial number: "${value}" - likely a date field misplaced`);
            value = ''; // Clear invalid phone numbers
          } else {
            // Clean normal phone numbers
            value = value.replace(/[^\d\s\-\(\)\+\.]/g, '').trim();
            if (value !== originalValue && index < 3) {
              logger.log(`📱 Cleaned phone: "${originalValue}" → "${value}"`);
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
        logger.log(`🔍 Field extraction for row ${index + 2}:`);
        logger.log(`  Phone column [${columnMapping.phone}]: "${phoneValue}"`);
        logger.log(`  Message column [${columnMapping.message}]: "${messageValue}"`);
        logger.log(`  Date column [${columnMapping.desiredEventDate}]: "${dateValue}"`);

        // Check if values seem to be in wrong columns
        if (phoneValue && phoneValue.length > 20 && !phoneValue.match(/^[\d\s\-\(\)\+]+$/)) {
          logger.warn(`⚠️ Phone field contains non-phone data: "${phoneValue.substring(0, 50)}..."`);
        }
        if (messageValue && messageValue.match(/^[\d\s\-\(\)\+]+$/) && messageValue.length < 20) {
          logger.warn(`⚠️ Message field might contain phone number: "${messageValue}"`);
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
        logger.log(`🔍 DYNAMIC Row ${index + 2} mapping (using header detection):`);
        logger.log(`  externalId[${columnMapping.externalId}]: "${result.externalId}"`);
        if (columnMapping.name >= 0) {
          logger.log(`  name[${columnMapping.name}]: "${contactName}" → firstName: "${firstName}", lastName: "${lastName}"`);
        } else {
          logger.log(`  firstName[${columnMapping.firstName}]: "${firstName}"`);
          logger.log(`  lastName[${columnMapping.lastName}]: "${lastName}"`);
        }
        logger.log(`  email[${columnMapping.email}]: "${result.email}"`);
        logger.log(`  organization[${columnMapping.organizationName}]: "${result.organizationName}"`);
        logger.log(`  department[${columnMapping.department}]: "${result.department}"`);
        logger.log(`  previouslyHosted[${columnMapping.previouslyHosted}]: "${result.previouslyHosted}"`);
        logger.log(`  message[${columnMapping.message}]: "${result.message?.substring(0, 50)}..."`);
        logger.log(`  desiredEventDate[${columnMapping.desiredEventDate}]: "${result.desiredEventDate}"`);
        logger.log(`  status[${columnMapping.status}]: "${result.status}"`);
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
        spreadsheetId: this.spreadsheetId,
        range: `${this.worksheetName}!A1:Z1`,
      });

      const headers = response.data.values?.[0] || [];

      const dataResponse = await this.sheets.spreadsheets.values.get({
        spreadsheetId: this.spreadsheetId,
        range: `${this.worksheetName}!A2:Z1000`,
      });

      const rowCount = dataResponse.data.values?.length || 0;

      return {
        headers,
        rowCount,
        lastUpdate: new Date().toISOString(),
      };
    } catch (error) {
      logger.error('Error analyzing event requests sheet structure:', error);
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
      logger.warn(
        'Google Sheets authentication not configured - missing GOOGLE_PROJECT_ID, GOOGLE_SERVICE_ACCOUNT_EMAIL, or GOOGLE_PRIVATE_KEY'
      );
      return null;
    }

    if (!process.env.EVENT_REQUESTS_SHEET_ID) {
      logger.warn('EVENT_REQUESTS_SHEET_ID not configured');
      return null;
    }

    logger.log(
      '✅ All Event Requests Google Sheets environment variables validated'
    );
    return new EventRequestsGoogleSheetsService(storage);
  } catch (error) {
    logger.error(
      'Failed to create Event Requests Google Sheets service:',
      error
    );
    return null;
  }
}
