import { google } from 'googleapis';
import type { DatabaseStorage } from './database-storage';
import { MeetingAgendaCompiler } from './meeting-agenda-compiler';

export class GoogleSheetsMeetingExporter {
  private auth: any;
  private sheets: any;
  private storage: DatabaseStorage;
  private agendaCompiler: MeetingAgendaCompiler;

  constructor(storage: DatabaseStorage) {
    this.storage = storage;
    this.agendaCompiler = new MeetingAgendaCompiler(storage);
    this.initializeAuth();
  }

  private async initializeAuth() {
    // Use JWT authentication like the working Google Sheets integrations
    const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n');
    if (!privateKey || !process.env.GOOGLE_CLIENT_EMAIL) {
      throw new Error('Google Sheets credentials not configured');
    }

    this.auth = new google.auth.JWT(
      process.env.GOOGLE_CLIENT_EMAIL,
      undefined,
      privateKey,
      [
        'https://www.googleapis.com/auth/spreadsheets',
        'https://www.googleapis.com/auth/drive'
      ]
    );

    this.sheets = google.sheets({ version: 'v4', auth: this.auth });
  }

  /**
   * Export meeting agenda to Google Sheets using Christine's format
   */
  async exportMeetingAgenda(meetingId: number, sheetId?: string): Promise<{
    sheetId: string;
    sheetUrl: string;
    exportedRows: number;
  }> {
    const meeting = await this.storage.getMeeting(meetingId);
    if (!meeting) {
      throw new Error('Meeting not found');
    }

    // Compile the agenda if not already compiled
    const existingAgendas = await this.storage.getCompiledAgendasByMeeting(meetingId);
    let compiledAgenda;
    
    if (existingAgendas.length === 0) {
      // Compile new agenda
      compiledAgenda = await this.agendaCompiler.compileAgenda(meetingId, 'system');
      await this.agendaCompiler.saveCompiledAgenda(compiledAgenda, 'system');
    } else {
      // Use most recent compiled agenda
      const latestCompiledId = existingAgendas[0].id;
      compiledAgenda = existingAgendas[0];
      
      // Get sections
      const sections = await this.storage.getAgendaSectionsByCompiledAgenda(latestCompiledId);
      compiledAgenda.sections = sections.map(section => ({
        title: section.title,
        orderIndex: section.orderIndex,
        items: section.items || []
      }));
    }

    // Create or update Google Sheet
    const finalSheetId = sheetId || await this.createNewAgendaSheet(meeting);
    
    // Format data for Christine's meeting format
    const sheetData = this.formatMeetingAgendaForSheets(meeting, compiledAgenda);
    
    // Clear existing content and write new data
    await this.clearAndWriteSheetData(finalSheetId, sheetData);
    
    // Apply formatting
    await this.formatMeetingAgendaSheet(finalSheetId, sheetData.length);

    return {
      sheetId: finalSheetId,
      sheetUrl: `https://docs.google.com/spreadsheets/d/${finalSheetId}`,
      exportedRows: sheetData.length
    };
  }

  /**
   * Create a new Google Sheet for the meeting agenda
   */
  private async createNewAgendaSheet(meeting: any): Promise<string> {
    const sheetTitle = `${meeting.title} - Agenda - ${meeting.date}`;
    
    const response = await this.sheets.spreadsheets.create({
      resource: {
        properties: {
          title: sheetTitle,
        },
        sheets: [
          {
            properties: {
              title: 'Meeting Agenda',
              gridProperties: {
                rowCount: 100,
                columnCount: 12, // A through L columns
              },
            },
          },
        ],
      },
    });

    return response.data.spreadsheetId;
  }

  /**
   * Format meeting agenda data to match Christine's Google Sheets format
   */
  private formatMeetingAgendaForSheets(meeting: any, compiledAgenda: any): any[][] {
    const data: any[][] = [];
    
    // Header section
    data.push([meeting.title]); // A1
    data.push([`Date: ${meeting.date}`]); // A2
    data.push([`Time: ${meeting.time}`]); // A3
    data.push([`Location: ${meeting.location || 'TBD'}`]); // A4
    data.push(['']); // A5 - Empty row
    
    // Headers row
    data.push([
      'Section', // A
      'Item', // B
      'Description', // C
      'Owner', // D - For project creator / presenter
      'Support People', // E - For assignees / support
      'Priority', // F
      'Time Estimate', // G
      'Status', // H
      'Notes', // I
      'Action Items', // J
      'Follow Up', // K
      'Decision' // L
    ]);

    // Process each agenda section with proper column mapping
    compiledAgenda.sections?.forEach((section: any) => {
      if (section.items && section.items.length > 0) {
        section.items.forEach((item: any, index: number) => {
          data.push([
            index === 0 ? section.title : '', // A - Section name only on first item
            item.title, // B - Item title
            item.description || '', // C - Description
            item.submittedBy || '', // D - Owner (presenter/creator)
            this.getSupportPeople(item), // E - Support people (for projects)
            this.getPriority(item), // F - Priority
            item.estimatedTime || '5 min', // G - Time estimate
            this.formatStatus(item.status, item.type), // H - Status (properly formatted)
            '', // I - Notes (empty for user input)
            '', // J - Action items (empty for user input)
            '', // K - Follow up (empty for user input)
            '' // L - Decision (empty for user input)
          ]);
        });
      } else {
        // Empty section
        data.push([
          section.title, // A
          'No items', // B
          '', // C
          '', // D
          '', // E
          '', // F
          '', // G
          'Not Started', // H - Default status for empty sections
          '', // I
          '', // J
          '', // K
          '' // L
        ]);
      }
      
      // Add separator row between sections
      data.push(Array(12).fill(''));
    });

    // Footer with meeting summary
    data.push(['']); // Empty row
    data.push([
      'Meeting Summary:', // A
      '', // B
      'Total Estimated Time:', // C
      compiledAgenda.totalEstimatedTime || 'TBD', // D
      '', // E
      'Total Items:', // F
      this.getTotalItemCount(compiledAgenda), // G
      '', // H
      '', // I
      '', // J
      '', // K
      '' // L
    ]);

    return data;
  }

  /**
   * Get support people for a project item
   */
  private getSupportPeople(item: any): string {
    if (item.type === 'project_review' && item.projectId) {
      // For project reviews, we could fetch assignees
      // For now, return empty string - could be enhanced later
      return '';
    }
    return '';
  }

  /**
   * Get priority for display
   */
  private getPriority(item: any): string {
    if (item.type === 'project_review') {
      return 'Medium'; // Default for project reviews
    }
    
    // Parse priority from title/description
    const text = `${item.title} ${item.description}`.toLowerCase();
    if (text.includes('urgent') || text.includes('critical')) {
      return 'High';
    }
    if (text.includes('low') || text.includes('minor')) {
      return 'Low';
    }
    return 'Medium';
  }

  /**
   * Format status to match Christine's sheet integration requirements
   * Maps internal status values to: "Completed", "In Progress", "Not Started", or "Blocked"
   */
  private formatStatus(status?: string, itemType?: string): string {
    if (!status) {
      return 'Not Started';
    }

    const normalizedStatus = status.toLowerCase();
    
    // Map common status values to the required format
    switch (normalizedStatus) {
      case 'completed':
      case 'done':
      case 'finished':
      case 'resolved':
        return 'Completed';
        
      case 'in_progress':
      case 'in progress':
      case 'active':
      case 'working':
      case 'ongoing':
        return 'In Progress';
        
      case 'blocked':
      case 'stuck':
      case 'waiting':
      case 'on_hold':
      case 'on hold':
        return 'Blocked';
        
      case 'approved':
        // Approved agenda items are ready to discuss (in progress)
        return 'In Progress';
        
      case 'pending':
      case 'new':
      case 'submitted':
      case 'review':
      case 'planning':
        return 'Not Started';
        
      case 'rejected':
      case 'cancelled':
      case 'deferred':
      case 'postponed':
        return 'Blocked';
        
      default:
        // For project reviews, map project statuses
        if (itemType === 'project_review') {
          switch (normalizedStatus) {
            case 'not_started':
            case 'idea':
            case 'proposed':
              return 'Not Started';
            case 'in_development':
            case 'testing':
            case 'review':
              return 'In Progress';
            case 'deployed':
            case 'live':
              return 'Completed';
            case 'paused':
            case 'cancelled':
              return 'Blocked';
            default:
              return 'Not Started';
          }
        }
        
        // Default fallback
        return 'Not Started';
    }
  }

  /**
   * Get total item count across all sections
   */
  private getTotalItemCount(compiledAgenda: any): number {
    if (!compiledAgenda.sections) return 0;
    
    return compiledAgenda.sections.reduce((total: number, section: any) => {
      return total + (section.items?.length || 0);
    }, 0);
  }

  /**
   * Smart sync: Preserve manual columns while updating app-managed columns
   */
  private async clearAndWriteSheetData(sheetId: string, data: any[][]): Promise<void> {
    // First, try to read existing data to preserve manual edits
    let existingData: any[][] = [];
    try {
      const response = await this.sheets.spreadsheets.values.get({
        spreadsheetId: sheetId,
        range: 'A:L',
      });
      existingData = response.data.values || [];
    } catch (error) {
      console.warn('Could not read existing sheet data, proceeding with full overwrite:', error);
    }

    // Merge data intelligently: preserve manual columns (I, J, K, L)
    const mergedData = this.mergeSheetData(data, existingData);

    // Clear existing content
    await this.sheets.spreadsheets.values.clear({
      spreadsheetId: sheetId,
      range: 'A:L',
    });

    // Write merged data
    await this.sheets.spreadsheets.values.update({
      spreadsheetId: sheetId,
      range: 'A1',
      valueInputOption: 'USER_ENTERED',
      resource: {
        values: mergedData,
      },
    });
  }

  /**
   * Merge new app data with existing manual edits
   * Preserves columns: I (Notes), J (Action Items), K (Follow Up), L (Decision)
   * Updates columns: A-H (app-managed data)
   */
  private mergeSheetData(newData: any[][], existingData: any[][]): any[][] {
    const merged: any[][] = [];
    
    // Always use new data for headers and meeting info (first 6 rows)
    for (let i = 0; i < 6 && i < newData.length; i++) {
      merged[i] = [...newData[i]];
    }

    // For data rows (starting from row 6), merge intelligently
    for (let i = 6; i < newData.length; i++) {
      const newRow = newData[i] || [];
      const existingRow = existingData[i] || [];
      
      // Create merged row: app data (A-H) + preserved manual data (I-L)
      const mergedRow = [
        // App-managed columns (A-H): Section, Item, Description, Owner, Support, Priority, Time, Status
        newRow[0] || '', // A - Section
        newRow[1] || '', // B - Item
        newRow[2] || '', // C - Description  
        newRow[3] || '', // D - Owner
        newRow[4] || '', // E - Support People
        newRow[5] || '', // F - Priority
        newRow[6] || '', // G - Time Estimate
        newRow[7] || '', // H - Status
        
        // Manual columns (I-L): preserve existing user input
        existingRow[8] || newRow[8] || '', // I - Notes (preserve existing)
        existingRow[9] || newRow[9] || '', // J - Action Items (preserve existing)
        existingRow[10] || newRow[10] || '', // K - Follow Up (preserve existing)
        existingRow[11] || newRow[11] || ''  // L - Decision (preserve existing)
      ];
      
      merged[i] = mergedRow;
    }

    // If existing data has more rows than new data, preserve them
    for (let i = newData.length; i < existingData.length; i++) {
      if (existingData[i] && existingData[i].some(cell => cell && cell.toString().trim())) {
        merged[i] = existingData[i];
      }
    }

    return merged;
  }

  /**
   * Apply formatting to make the agenda readable
   */
  private async formatMeetingAgendaSheet(sheetId: string, dataRows: number): Promise<void> {
    const requests = [
      // Header formatting (rows 1-4)
      {
        repeatCell: {
          range: {
            sheetId: 0,
            startRowIndex: 0,
            endRowIndex: 4,
            startColumnIndex: 0,
            endColumnIndex: 12,
          },
          cell: {
            userEnteredFormat: {
              textFormat: {
                bold: true,
                fontSize: 12,
              },
            },
          },
          fields: 'userEnteredFormat.textFormat',
        },
      },
      // Column headers formatting (row 6, 0-indexed row 5)
      {
        repeatCell: {
          range: {
            sheetId: 0,
            startRowIndex: 5,
            endRowIndex: 6,
            startColumnIndex: 0,
            endColumnIndex: 12,
          },
          cell: {
            userEnteredFormat: {
              backgroundColor: {
                red: 0.9,
                green: 0.9,
                blue: 0.9,
              },
              textFormat: {
                bold: true,
                fontSize: 11,
              },
              borders: {
                top: { style: 'SOLID' },
                bottom: { style: 'SOLID' },
                left: { style: 'SOLID' },
                right: { style: 'SOLID' },
              },
            },
          },
          fields: 'userEnteredFormat',
        },
      },
      // Auto-resize columns
      {
        autoResizeDimensions: {
          dimensions: {
            sheetId: 0,
            dimension: 'COLUMNS',
            startIndex: 0,
            endIndex: 12,
          },
        },
      },
      // Freeze header rows
      {
        updateSheetProperties: {
          properties: {
            sheetId: 0,
            gridProperties: {
              frozenRowCount: 6,
            },
          },
          fields: 'gridProperties.frozenRowCount',
        },
      },
    ];

    await this.sheets.spreadsheets.batchUpdate({
      spreadsheetId: sheetId,
      resource: { requests },
    });
  }

  /**
   * Export meeting minutes to Google Sheets
   */
  async exportMeetingMinutes(meetingId: number, sheetId?: string): Promise<{
    sheetId: string;
    sheetUrl: string;
  }> {
    const meeting = await this.storage.getMeeting(meetingId);
    if (!meeting) {
      throw new Error('Meeting not found');
    }

    // Create new sheet if needed
    const finalSheetId = sheetId || await this.createNewMinutesSheet(meeting);
    
    // Format minutes data
    const minutesData = this.formatMeetingMinutesForSheets(meeting);
    
    // Write to sheet
    await this.clearAndWriteSheetData(finalSheetId, minutesData);
    
    return {
      sheetId: finalSheetId,
      sheetUrl: `https://docs.google.com/spreadsheets/d/${finalSheetId}`
    };
  }

  /**
   * Create a new Google Sheet for meeting minutes
   */
  private async createNewMinutesSheet(meeting: any): Promise<string> {
    const sheetTitle = `${meeting.title} - Minutes - ${meeting.date}`;
    
    const response = await this.sheets.spreadsheets.create({
      resource: {
        properties: {
          title: sheetTitle,
        },
      },
    });

    return response.data.spreadsheetId;
  }

  /**
   * Format meeting minutes for Google Sheets
   */
  private formatMeetingMinutesForSheets(meeting: any): any[][] {
    const data: any[][] = [];
    
    // Header
    data.push([`${meeting.title} - Meeting Minutes`]);
    data.push([`Date: ${meeting.date}`]);
    data.push([`Time: ${meeting.time}`]);
    data.push([`Location: ${meeting.location || 'TBD'}`]);
    data.push(['']);
    
    // Template structure for minutes
    data.push(['Attendees:']);
    data.push(['']);
    data.push(['Key Decisions:']);
    data.push(['']);
    data.push(['Action Items:']);
    data.push(['Task', 'Owner', 'Due Date', 'Status']);
    data.push(['', '', '', '']);
    data.push(['']);
    data.push(['Discussion Summary:']);
    data.push(['']);
    data.push(['Next Steps:']);
    data.push(['']);

    return data;
  }
}