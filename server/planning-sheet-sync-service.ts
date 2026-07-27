import { google } from 'googleapis';
import { JWT } from 'google-auth-library';
import { logger } from './utils/production-safe-logger';

/**
 * Planning Sheet Column Mapping
 * Maps the Google Sheet columns to app fields
 */
export const PLANNING_SHEET_COLUMNS = {
  DATE: 0,                    // A - Date
  DAY_OF_WEEK: 1,             // B - Day of Week
  GROUP_NAME: 2,              // C - Group Name
  EVENT_START_TIME: 3,        // D - Event Start time
  EVENT_END_TIME: 4,          // E - Event end time
  PICK_UP_TIME: 5,            // F - Pick up time
  PICK_UP_NEXT_DAY: 6,        // G - Pick up next day?
  ALL_DETAILS: 7,             // H - ALL DETAILS
  VAN_BOOKED: 8,              // I - Van Booked?
  STAFFING: 9,                // J - Staffing (special format: D: Name, S: Name, V: Name)
  ESTIMATE_SANDWICHES: 10,    // K - Estimate # sandwiches
  DELI_OR_PBJ: 11,            // L - Deli or PBJ?
  FINAL_SANDWICHES: 12,       // M - Final # sandwiches made
  TOTAL_IN_APP: 13,           // N - Total in app? (manually maintained in the sheet; app leaves blank on new rows)
  SOCIAL_POST: 14,            // O - Social Post
  SENT_TOOLKIT: 15,           // P - Sent toolkit?
  CONTACT_NAME: 16,           // Q - Contact Name
  EMAIL: 17,                  // R - Email Address
  PHONE: 18,                  // S - Contact Cell Number
  TSP_CONTACT: 19,            // T - TSP Contact
  ADDRESS: 20,                // U - Address
  RECIPIENT_HOST: 21,         // V - Planned Recipient/Host Home
  AFTER_EVENT_NOTES: 22,      // W - After Event Notes
  CANCELLED: 23,              // X - Cancelled
  NOTES: 24,                  // Y - Notes
  ADDL_NOTES: 25,             // Z - Add'l Notes
  WAITING_ON: 26,             // AA - Waiting On
} as const;

/**
 * Staffing format parser and generator
 *
 * Format specifications:
 * - The staffing column contains role assignments separated by role prefixes
 * - Format: "D: Name1, Name2, S: Name3, V: Name4, VD: Name5"
 * - Each role can have multiple people assigned (comma-separated names)
 * - Each role can be:
 *   - Assigned with name(s): "D: John Doe, Jane Smith" (role needed, assigned to John and Jane)
 *   - Unassigned but needed: "D:" or "D: " (role needed but no one assigned)
 *   - Not needed: role is omitted from the string
 *
 * Roles:
 * - D: Driver (regular)
 * - VD: Van Driver (special type of driver, checked before D)
 * - S: Speaker
 * - V: Volunteer
 *
 * Examples:
 * - "D: John Doe, S: Jane Smith" = Driver assigned to John, Speaker assigned to Jane
 * - "D: John, Jane, S: Bob" = Drivers assigned to John AND Jane, Speaker assigned to Bob
 * - "D:, S:" = Driver and Speaker needed but unassigned
 * - "VD: Bob Jones, V:" = Van Driver assigned to Bob, Volunteer needed but unassigned
 * - "" = No roles needed
 *
 * Note: When parsing, VD must be checked before D to avoid false matches.
 * Note: Unassigned positions may include trailing space after colon (e.g., "D: ").
 * Note: Comma-separated names within a role are preserved as a single string.
 */
export interface StaffingInfo {
  driver: { needed: boolean; assigned: string | null; isVanDriver: boolean };
  speaker: { needed: boolean; assigned: string | null };
  volunteer: { needed: boolean; assigned: string | null };
}

/**
 * Parse a staffing column string into structured staffing information.
 *
 * Uses regex to split on role prefixes (VD:, D:, S:, V:) to correctly handle
 * multiple comma-separated names within a single role.
 *
 * See StaffingInfo documentation for format details.
 */
export function parseStaffingColumn(staffingStr: string): StaffingInfo {
  const result: StaffingInfo = {
    driver: { needed: false, assigned: null, isVanDriver: false },
    speaker: { needed: false, assigned: null },
    volunteer: { needed: false, assigned: null },
  };

  if (!staffingStr || !staffingStr.trim()) {
    return result;
  }

  // Use regex to find role sections - split on role prefixes
  // Match: VD: or D: or S: or V: (case insensitive, VD must come before D)
  // The lookahead ensures we capture content until the next role prefix
  const rolePattern = /\b(VD|D|S|V)\s*:/gi;
  const matches: { role: string; startIndex: number }[] = [];
  let match;

  while ((match = rolePattern.exec(staffingStr)) !== null) {
    matches.push({ role: match[1].toUpperCase(), startIndex: match.index });
  }

  // Process each role section
  for (let i = 0; i < matches.length; i++) {
    const currentMatch = matches[i];
    const nextMatch = matches[i + 1];

    // Extract content from after the colon to the next role prefix (or end of string)
    const colonIndex = staffingStr.indexOf(':', currentMatch.startIndex);
    const endIndex = nextMatch ? nextMatch.startIndex : staffingStr.length;
    const content = staffingStr.slice(colonIndex + 1, endIndex).trim();

    // Remove trailing comma if present (from being before the next role)
    const cleanedContent = content.replace(/,\s*$/, '').trim();

    switch (currentMatch.role) {
      case 'VD':
        result.driver.needed = true;
        result.driver.isVanDriver = true;
        result.driver.assigned = cleanedContent || null;
        break;
      case 'D':
        // Only set if not already set by VD
        if (!result.driver.isVanDriver) {
          result.driver.needed = true;
          result.driver.assigned = cleanedContent || null;
        }
        break;
      case 'S':
        result.speaker.needed = true;
        result.speaker.assigned = cleanedContent || null;
        break;
      case 'V':
        result.volunteer.needed = true;
        result.volunteer.assigned = cleanedContent || null;
        break;
    }
  }

  return result;
}

/**
 * Format a StaffingInfo object into the string format for the Planning Sheet.
 * 
 * Trailing space behavior:
 * - When a role is needed but unassigned, the format includes a trailing space after the colon.
 * - Examples: "D: ", "S: ", "V: ", "VD: "
 * - This is intentional to indicate the position is open/needed but not yet filled.
 * - The parser handles both "D:" and "D: " as unassigned positions.
 * 
 * See StaffingInfo documentation for complete format specification.
 */
export function formatStaffingColumn(staffing: StaffingInfo): string {
  const parts: string[] = [];

  // Driver or Van Driver
  if (staffing.driver.needed) {
    const prefix = staffing.driver.isVanDriver ? 'VD' : 'D';
    if (staffing.driver.assigned) {
      parts.push(`${prefix}: ${staffing.driver.assigned}`);
    } else {
      parts.push(`${prefix}: `); // Unassigned but needed
    }
  }

  // Speaker
  if (staffing.speaker.needed) {
    if (staffing.speaker.assigned) {
      parts.push(`S: ${staffing.speaker.assigned}`);
    } else {
      parts.push(`S: `); // Unassigned but needed
    }
  }

  // Volunteer
  if (staffing.volunteer.needed) {
    if (staffing.volunteer.assigned) {
      parts.push(`V: ${staffing.volunteer.assigned}`);
    } else {
      parts.push(`V: `); // Unassigned but needed
    }
  }

  return parts.join(', ');
}

/**
 * Planning Sheet row data - represents one row in the Planning Sheet
 */
export interface PlanningSheetRow {
  rowIndex: number;
  date: string;
  dayOfWeek: string;
  groupName: string;
  eventStartTime: string;
  eventEndTime: string;
  pickUpTime: string;
  pickUpNextDay: string;
  allDetails: string;
  vanBooked: string;
  staffing: string;
  staffingParsed: StaffingInfo;
  estimateSandwiches: string;
  deliOrPbj: string;
  finalSandwiches: string;
  totalInApp: string;
  socialPost: string;
  sentToolkit: string;
  contactName: string;
  email: string;
  phone: string;
  tspContact: string;
  address: string;
  recipientHost: string;
  afterEventNotes: string;
  cancelled: string;
  notes: string;
  addlNotes: string;
  waitingOn: string;
}

/**
 * Planning Sheet Sync Service
 * Handles reading from and proposing changes to the Planning/Schedule Google Sheet
 *
 * IMPORTANT: This is SEPARATE from the Squarespace form responses sync.
 * This syncs with the team's planning sheet where scheduled events are tracked.
 */
export class PlanningSheetSyncService {
  private auth!: JWT;
  private sheets: any;
  private spreadsheetId: string;
  private worksheetName: string;

  constructor(spreadsheetId: string, worksheetName: string = 'Schedule') {
    this.spreadsheetId = spreadsheetId;
    this.worksheetName = worksheetName;
  }

  private getSheetRange(a1Range: string) {
    const safeSheetName = this.worksheetName.replace(/'/g, "''");
    return `'${safeSheetName}'!${a1Range}`;
  }

  private async ensureInitialized() {
    if (!this.sheets) {
      await this.initializeAuth();
    }
  }

  private async initializeAuth() {
    const rawPrivateKey = process.env.GOOGLE_PRIVATE_KEY;
    if (!rawPrivateKey || !process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL) {
      throw new Error('Google Sheets credentials not configured');
    }

    // Handle escaped newlines in private key
    let cleanPrivateKey = rawPrivateKey;
    if (cleanPrivateKey.includes('\\n')) {
      cleanPrivateKey = cleanPrivateKey.replace(/\\n/g, '\n');
    }
    cleanPrivateKey = cleanPrivateKey
      .replace(/\\r\\n/g, '\n')
      .replace(/\\r/g, '\n')
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n');

    // Handle single-line key format
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
        // Read-only on purpose: the app must never write to the Planning Sheet.
        // Even if write code is reintroduced by mistake, Google will reject it.
        'https://www.googleapis.com/auth/spreadsheets.readonly',
      ]
    );

    this.sheets = google.sheets({ version: 'v4', auth: this.auth });
  }

  /**
   * Read all rows from the Planning Sheet
   */
  async readPlanningSheet(): Promise<PlanningSheetRow[]> {
    await this.ensureInitialized();

    const response = await this.sheets.spreadsheets.values.get({
      spreadsheetId: this.spreadsheetId,
      range: this.getSheetRange('A2:AA'), // Skip header row
    });

    const rows = response.data.values || [];
    logger.log(`Read ${rows.length} rows from Planning Sheet`);

    return rows.map((row: string[], index: number) => {
      const staffingStr = row[PLANNING_SHEET_COLUMNS.STAFFING] || '';
      return {
        rowIndex: index + 2, // +2 because we start at A2 and arrays are 0-indexed
        date: row[PLANNING_SHEET_COLUMNS.DATE] || '',
        dayOfWeek: row[PLANNING_SHEET_COLUMNS.DAY_OF_WEEK] || '',
        groupName: row[PLANNING_SHEET_COLUMNS.GROUP_NAME] || '',
        eventStartTime: row[PLANNING_SHEET_COLUMNS.EVENT_START_TIME] || '',
        eventEndTime: row[PLANNING_SHEET_COLUMNS.EVENT_END_TIME] || '',
        pickUpTime: row[PLANNING_SHEET_COLUMNS.PICK_UP_TIME] || '',
        pickUpNextDay: row[PLANNING_SHEET_COLUMNS.PICK_UP_NEXT_DAY] || '',
        allDetails: row[PLANNING_SHEET_COLUMNS.ALL_DETAILS] || '',
        vanBooked: row[PLANNING_SHEET_COLUMNS.VAN_BOOKED] || '',
        staffing: staffingStr,
        staffingParsed: parseStaffingColumn(staffingStr),
        estimateSandwiches: row[PLANNING_SHEET_COLUMNS.ESTIMATE_SANDWICHES] || '',
        deliOrPbj: row[PLANNING_SHEET_COLUMNS.DELI_OR_PBJ] || '',
        finalSandwiches: row[PLANNING_SHEET_COLUMNS.FINAL_SANDWICHES] || '',
        totalInApp: row[PLANNING_SHEET_COLUMNS.TOTAL_IN_APP] || '',
        socialPost: row[PLANNING_SHEET_COLUMNS.SOCIAL_POST] || '',
        sentToolkit: row[PLANNING_SHEET_COLUMNS.SENT_TOOLKIT] || '',
        contactName: row[PLANNING_SHEET_COLUMNS.CONTACT_NAME] || '',
        email: row[PLANNING_SHEET_COLUMNS.EMAIL] || '',
        phone: row[PLANNING_SHEET_COLUMNS.PHONE] || '',
        tspContact: row[PLANNING_SHEET_COLUMNS.TSP_CONTACT] || '',
        address: row[PLANNING_SHEET_COLUMNS.ADDRESS] || '',
        recipientHost: row[PLANNING_SHEET_COLUMNS.RECIPIENT_HOST] || '',
        afterEventNotes: row[PLANNING_SHEET_COLUMNS.AFTER_EVENT_NOTES] || '',
        cancelled: row[PLANNING_SHEET_COLUMNS.CANCELLED] || '',
        notes: row[PLANNING_SHEET_COLUMNS.NOTES] || '',
        addlNotes: row[PLANNING_SHEET_COLUMNS.ADDL_NOTES] || '',
        waitingOn: row[PLANNING_SHEET_COLUMNS.WAITING_ON] || '',
      };
    });
  }

}

/**
 * Get the Planning Sheet service instance for the test sheet
 * Uses environment variable for sheet ID
 */
export function getPlanningSheetService(): PlanningSheetSyncService | null {
  const sheetId = process.env.PLANNING_SHEET_ID;
  const worksheetName = process.env.PLANNING_SHEET_WORKSHEET_NAME || '2026 Groups';
  if (!sheetId) {
    logger.warn('PLANNING_SHEET_ID not configured');
    return null;
  }

  if (!process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || !process.env.GOOGLE_PRIVATE_KEY) {
    logger.warn('Google Sheets credentials not configured');
    return null;
  }

  return new PlanningSheetSyncService(sheetId, worksheetName);
}
