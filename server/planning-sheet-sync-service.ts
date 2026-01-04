import { google } from 'googleapis';
import { JWT } from 'google-auth-library';
import { db } from './db';
import { eq, and, isNull } from 'drizzle-orm';
import { eventRequests, proposedSheetChanges, users } from '@shared/schema';
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
  SOCIAL_POST: 13,            // N - Social Post
  SENT_TOOLKIT: 14,           // O - Sent toolkit?
  CONTACT_NAME: 15,           // P - Contact Name
  EMAIL: 16,                  // Q - Email Address
  PHONE: 17,                  // R - Contact Cell Number
  TSP_CONTACT: 18,            // S - TSP Contact
  ADDRESS: 19,                // T - Address
  RECIPIENT_HOST: 20,         // U - Planned Recipient/Host Home
  AFTER_EVENT_NOTES: 21,      // V - After Event Notes
  CANCELLED: 22,              // W - Cancelled
  NOTES: 23,                  // X - Notes
  ADDL_NOTES: 24,             // Y - Add'l Notes
  WAITING_ON: 25,             // Z - Waiting On
} as const;

/**
 * Staffing format parser and generator
 * Format: D: Name, S: Name, V: Name, VD: Name
 * Unassigned: D, S, V, VD (no colon or name)
 */
export interface StaffingInfo {
  driver: { needed: boolean; assigned: string | null; isVanDriver: boolean };
  speaker: { needed: boolean; assigned: string | null };
  volunteer: { needed: boolean; assigned: string | null };
}

export function parseStaffingColumn(staffingStr: string): StaffingInfo {
  const result: StaffingInfo = {
    driver: { needed: false, assigned: null, isVanDriver: false },
    speaker: { needed: false, assigned: null },
    volunteer: { needed: false, assigned: null },
  };

  if (!staffingStr || !staffingStr.trim()) {
    return result;
  }

  // Split by comma and process each part
  const parts = staffingStr.split(',').map(p => p.trim()).filter(p => p);

  for (const part of parts) {
    // Check for VD (Van Driver) - must check before D
    if (part.startsWith('VD:') || part === 'VD') {
      result.driver.needed = true;
      result.driver.isVanDriver = true;
      if (part.includes(':')) {
        const name = part.split(':')[1]?.trim();
        result.driver.assigned = name || null;
      }
    }
    // Check for D (Driver)
    else if (part.startsWith('D:') || part === 'D') {
      result.driver.needed = true;
      if (part.includes(':')) {
        const name = part.split(':')[1]?.trim();
        result.driver.assigned = name || null;
      }
    }
    // Check for S (Speaker)
    else if (part.startsWith('S:') || part === 'S') {
      result.speaker.needed = true;
      if (part.includes(':')) {
        const name = part.split(':')[1]?.trim();
        result.speaker.assigned = name || null;
      }
    }
    // Check for V (Volunteer) - but not VD
    else if ((part.startsWith('V:') || part === 'V') && !part.startsWith('VD')) {
      result.volunteer.needed = true;
      if (part.includes(':')) {
        const name = part.split(':')[1]?.trim();
        result.volunteer.assigned = name || null;
      }
    }
  }

  return result;
}

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

  constructor(spreadsheetId: string, worksheetName: string = 'Sheet1') {
    this.spreadsheetId = spreadsheetId;
    this.worksheetName = worksheetName;
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
        'https://www.googleapis.com/auth/spreadsheets',
        'https://www.googleapis.com/auth/drive',
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
      range: `${this.worksheetName}!A2:Z1000`, // Skip header row
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

  /**
   * Convert an EventRequest from the app into Planning Sheet row format
   */
  async eventToSheetRow(eventId: number): Promise<string[] | null> {
    const event = await db
      .select()
      .from(eventRequests)
      .where(eq(eventRequests.id, eventId))
      .limit(1);

    if (!event || event.length === 0) {
      return null;
    }

    const e = event[0];

    // Get assigned driver/speaker/volunteer names
    const driverNames = await this.getAssignedNames(e.assignedDriverIds || []);
    const speakerNames = await this.getAssignedNames(e.assignedSpeakerIds || []);
    const volunteerNames = await this.getAssignedNames(e.assignedVolunteerIds || []);

    // Build staffing string
    const staffing: StaffingInfo = {
      driver: {
        needed: (e.driversNeeded || 0) > 0 || driverNames.length > 0,
        assigned: driverNames.length > 0 ? driverNames.join(', ') : null,
        isVanDriver: e.vanDriverNeeded || false,
      },
      speaker: {
        needed: (e.speakersNeeded || 0) > 0 || speakerNames.length > 0,
        assigned: speakerNames.length > 0 ? speakerNames.join(', ') : null,
      },
      volunteer: {
        needed: (e.volunteersNeeded || 0) > 0 || volunteerNames.length > 0,
        assigned: volunteerNames.length > 0 ? volunteerNames.join(', ') : null,
      },
    };

    // Format date
    const eventDate = e.scheduledEventDate || e.desiredEventDate;
    const dateStr = eventDate ? new Date(eventDate).toLocaleDateString('en-US', {
      month: 'numeric',
      day: 'numeric',
      year: 'numeric'
    }) : '';

    const dayOfWeek = eventDate ? new Date(eventDate).toLocaleDateString('en-US', {
      weekday: 'long'
    }) : '';

    // Format sandwich types
    const sandwichTypes = e.sandwichTypes as Array<{ type: string; quantity?: number }> | null;
    const deliOrPbj = sandwichTypes?.map(st => st.type).join(', ') || '';

    // Build the row array matching column order
    const row: string[] = new Array(26).fill('');
    row[PLANNING_SHEET_COLUMNS.DATE] = dateStr;
    row[PLANNING_SHEET_COLUMNS.DAY_OF_WEEK] = dayOfWeek;
    row[PLANNING_SHEET_COLUMNS.GROUP_NAME] = e.organizationName || '';
    row[PLANNING_SHEET_COLUMNS.EVENT_START_TIME] = e.eventStartTime || '';
    row[PLANNING_SHEET_COLUMNS.EVENT_END_TIME] = e.eventEndTime || '';
    row[PLANNING_SHEET_COLUMNS.PICK_UP_TIME] = e.pickupTime || '';
    row[PLANNING_SHEET_COLUMNS.PICK_UP_NEXT_DAY] = e.overnightHoldingLocation ? 'Yes' : '';
    row[PLANNING_SHEET_COLUMNS.ALL_DETAILS] = e.message || '';
    row[PLANNING_SHEET_COLUMNS.VAN_BOOKED] = e.vanDriverNeeded ? 'Yes' : '';
    row[PLANNING_SHEET_COLUMNS.STAFFING] = formatStaffingColumn(staffing);
    row[PLANNING_SHEET_COLUMNS.ESTIMATE_SANDWICHES] = e.estimatedSandwichCount?.toString() || '';
    row[PLANNING_SHEET_COLUMNS.DELI_OR_PBJ] = deliOrPbj;
    row[PLANNING_SHEET_COLUMNS.FINAL_SANDWICHES] = e.actualSandwichCount?.toString() || '';
    row[PLANNING_SHEET_COLUMNS.SOCIAL_POST] = e.socialMediaPostCompleted ? 'Yes' : '';
    row[PLANNING_SHEET_COLUMNS.SENT_TOOLKIT] = e.toolkitSent ? 'Yes' : '';
    row[PLANNING_SHEET_COLUMNS.CONTACT_NAME] = `${e.firstName || ''} ${e.lastName || ''}`.trim();
    row[PLANNING_SHEET_COLUMNS.EMAIL] = e.email || '';
    row[PLANNING_SHEET_COLUMNS.PHONE] = e.phone || '';
    row[PLANNING_SHEET_COLUMNS.TSP_CONTACT] = e.tspContact || '';
    row[PLANNING_SHEET_COLUMNS.ADDRESS] = e.eventAddress || '';
    row[PLANNING_SHEET_COLUMNS.RECIPIENT_HOST] = e.deliveryDestination || '';
    row[PLANNING_SHEET_COLUMNS.AFTER_EVENT_NOTES] = e.followUpNotes || '';
    row[PLANNING_SHEET_COLUMNS.CANCELLED] = e.status === 'cancelled' ? 'Yes' : '';
    row[PLANNING_SHEET_COLUMNS.NOTES] = '';
    row[PLANNING_SHEET_COLUMNS.ADDL_NOTES] = '';
    row[PLANNING_SHEET_COLUMNS.WAITING_ON] = e.nextAction || '';

    return row;
  }

  /**
   * Get display names for assigned user IDs
   */
  private async getAssignedNames(userIds: string[]): Promise<string[]> {
    if (!userIds || userIds.length === 0) return [];

    const names: string[] = [];
    for (const id of userIds) {
      const user = await db
        .select({ firstName: users.firstName, lastName: users.lastName, displayName: users.displayName })
        .from(users)
        .where(eq(users.id, id))
        .limit(1);

      if (user && user.length > 0) {
        const u = user[0];
        const name = u.displayName || `${u.firstName || ''} ${u.lastName || ''}`.trim() || 'Unknown';
        names.push(name);
      }
    }
    return names;
  }

  /**
   * Propose adding a new row to the Planning Sheet
   * Does NOT write to the sheet - creates a proposal for human review
   */
  async proposeNewRow(
    eventId: number,
    proposedBy: string,
    reason: string = 'Event scheduled'
  ): Promise<{ success: boolean; proposalId?: number; message: string }> {
    try {
      const rowData = await this.eventToSheetRow(eventId);
      if (!rowData) {
        return { success: false, message: 'Event not found' };
      }

      // Create the proposal
      const [proposal] = await db
        .insert(proposedSheetChanges)
        .values({
          eventRequestId: eventId,
          targetSheetId: this.spreadsheetId,
          targetSheetName: this.worksheetName,
          targetRowIndex: null, // New row, no existing index
          changeType: 'create_row',
          proposedRowData: rowData,
          proposedBy,
          proposalReason: reason,
          status: 'pending',
          columnMapping: PLANNING_SHEET_COLUMNS,
        })
        .returning({ id: proposedSheetChanges.id });

      logger.log(`Created proposal ${proposal.id} for new row in Planning Sheet`);
      return {
        success: true,
        proposalId: proposal.id,
        message: 'Proposed new row for review'
      };
    } catch (error) {
      logger.error('Error creating new row proposal:', error);
      return {
        success: false,
        message: `Failed to create proposal: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Propose updating a specific cell in the Planning Sheet
   * Does NOT write to the sheet - creates a proposal for human review
   */
  async proposeCellUpdate(
    eventId: number,
    rowIndex: number,
    fieldName: string,
    currentValue: string,
    proposedValue: string,
    proposedBy: string,
    reason: string
  ): Promise<{ success: boolean; proposalId?: number; message: string }> {
    try {
      const [proposal] = await db
        .insert(proposedSheetChanges)
        .values({
          eventRequestId: eventId,
          targetSheetId: this.spreadsheetId,
          targetSheetName: this.worksheetName,
          targetRowIndex: rowIndex,
          changeType: 'update_cell',
          fieldName,
          currentValue,
          proposedValue,
          proposedBy,
          proposalReason: reason,
          status: 'pending',
          columnMapping: PLANNING_SHEET_COLUMNS,
        })
        .returning({ id: proposedSheetChanges.id });

      logger.log(`Created proposal ${proposal.id} for cell update at row ${rowIndex}, field ${fieldName}`);
      return {
        success: true,
        proposalId: proposal.id,
        message: 'Proposed cell update for review'
      };
    } catch (error) {
      logger.error('Error creating cell update proposal:', error);
      return {
        success: false,
        message: `Failed to create proposal: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Get all pending proposals
   */
  async getPendingProposals(): Promise<any[]> {
    return db
      .select()
      .from(proposedSheetChanges)
      .where(eq(proposedSheetChanges.status, 'pending'))
      .orderBy(proposedSheetChanges.proposedAt);
  }

  /**
   * Apply an approved proposal to the sheet
   * This is the ONLY function that actually writes to Google Sheets
   */
  async applyApprovedProposal(
    proposalId: number,
    reviewedBy: string
  ): Promise<{ success: boolean; message: string }> {
    try {
      await this.ensureInitialized();

      // Get the proposal
      const [proposal] = await db
        .select()
        .from(proposedSheetChanges)
        .where(eq(proposedSheetChanges.id, proposalId))
        .limit(1);

      if (!proposal) {
        return { success: false, message: 'Proposal not found' };
      }

      if (proposal.status !== 'pending' && proposal.status !== 'approved') {
        return { success: false, message: `Cannot apply proposal with status: ${proposal.status}` };
      }

      // Mark as approved first
      await db
        .update(proposedSheetChanges)
        .set({
          status: 'approved',
          reviewedBy,
          reviewedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(proposedSheetChanges.id, proposalId));

      // Apply the change based on type
      let result: { success: boolean; message: string };

      if (proposal.changeType === 'create_row') {
        result = await this.applyNewRow(proposal);
      } else if (proposal.changeType === 'update_cell') {
        result = await this.applyCellUpdate(proposal);
      } else {
        result = { success: false, message: `Unknown change type: ${proposal.changeType}` };
      }

      // Update proposal status based on result
      await db
        .update(proposedSheetChanges)
        .set({
          status: result.success ? 'applied' : 'failed',
          appliedAt: result.success ? new Date() : null,
          applyError: result.success ? null : result.message,
          updatedAt: new Date(),
        })
        .where(eq(proposedSheetChanges.id, proposalId));

      return result;
    } catch (error) {
      logger.error('Error applying approved proposal:', error);

      // Mark as failed
      await db
        .update(proposedSheetChanges)
        .set({
          status: 'failed',
          applyError: error instanceof Error ? error.message : 'Unknown error',
          updatedAt: new Date(),
        })
        .where(eq(proposedSheetChanges.id, proposalId));

      return {
        success: false,
        message: `Failed to apply: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Apply a new row to the sheet
   */
  private async applyNewRow(proposal: any): Promise<{ success: boolean; message: string }> {
    const rowData = proposal.proposedRowData as string[];
    if (!rowData || !Array.isArray(rowData)) {
      return { success: false, message: 'Invalid row data in proposal' };
    }

    // Append the row to the sheet
    await this.sheets.spreadsheets.values.append({
      spreadsheetId: this.spreadsheetId,
      range: `${this.worksheetName}!A:Z`,
      valueInputOption: 'USER_ENTERED',
      insertDataOption: 'INSERT_ROWS',
      resource: { values: [rowData] },
    });

    logger.log(`Applied new row to Planning Sheet for proposal ${proposal.id}`);
    return { success: true, message: 'Row added successfully' };
  }

  /**
   * Apply a cell update to the sheet
   */
  private async applyCellUpdate(proposal: any): Promise<{ success: boolean; message: string }> {
    if (!proposal.targetRowIndex || !proposal.fieldName) {
      return { success: false, message: 'Missing row index or field name' };
    }

    // Get column letter from field name
    const columnIndex = PLANNING_SHEET_COLUMNS[proposal.fieldName as keyof typeof PLANNING_SHEET_COLUMNS];
    if (columnIndex === undefined) {
      return { success: false, message: `Unknown field: ${proposal.fieldName}` };
    }

    const columnLetter = String.fromCharCode(65 + columnIndex); // A=0, B=1, etc.
    const range = `${this.worksheetName}!${columnLetter}${proposal.targetRowIndex}`;

    await this.sheets.spreadsheets.values.update({
      spreadsheetId: this.spreadsheetId,
      range,
      valueInputOption: 'USER_ENTERED',
      resource: { values: [[proposal.proposedValue]] },
    });

    logger.log(`Applied cell update to ${range} for proposal ${proposal.id}`);
    return { success: true, message: `Updated ${proposal.fieldName} at row ${proposal.targetRowIndex}` };
  }

  /**
   * Reject a proposal
   */
  async rejectProposal(
    proposalId: number,
    reviewedBy: string,
    notes?: string
  ): Promise<{ success: boolean; message: string }> {
    try {
      await db
        .update(proposedSheetChanges)
        .set({
          status: 'rejected',
          reviewedBy,
          reviewedAt: new Date(),
          reviewNotes: notes,
          updatedAt: new Date(),
        })
        .where(eq(proposedSheetChanges.id, proposalId));

      return { success: true, message: 'Proposal rejected' };
    } catch (error) {
      return {
        success: false,
        message: `Failed to reject: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Find a row in the Planning Sheet that matches an event
   * Used to determine if we should create a new row or update existing
   */
  async findMatchingRow(eventId: number): Promise<PlanningSheetRow | null> {
    const event = await db
      .select()
      .from(eventRequests)
      .where(eq(eventRequests.id, eventId))
      .limit(1);

    if (!event || event.length === 0) {
      return null;
    }

    const e = event[0];
    const sheetRows = await this.readPlanningSheet();

    // Try to match by organization name + date
    const eventDate = e.scheduledEventDate || e.desiredEventDate;
    const eventDateStr = eventDate ? new Date(eventDate).toLocaleDateString('en-US', {
      month: 'numeric',
      day: 'numeric',
      year: 'numeric'
    }) : '';

    for (const row of sheetRows) {
      // Match by organization name (case-insensitive) and date
      const orgMatch = row.groupName.toLowerCase().trim() === (e.organizationName || '').toLowerCase().trim();
      const dateMatch = row.date === eventDateStr;

      if (orgMatch && dateMatch) {
        return row;
      }
    }

    return null;
  }
}

/**
 * Get the Planning Sheet service instance for the test sheet
 * Uses environment variable for sheet ID
 */
export function getPlanningSheetService(): PlanningSheetSyncService | null {
  const sheetId = process.env.PLANNING_SHEET_ID;
  if (!sheetId) {
    logger.warn('PLANNING_SHEET_ID not configured');
    return null;
  }

  if (!process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || !process.env.GOOGLE_PRIVATE_KEY) {
    logger.warn('Google Sheets credentials not configured');
    return null;
  }

  return new PlanningSheetSyncService(sheetId);
}
