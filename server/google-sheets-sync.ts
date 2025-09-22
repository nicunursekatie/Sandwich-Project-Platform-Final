import {
  getProjectsGoogleSheetsService,
  SheetRow,
} from './google-sheets-service';
import type { IStorage } from './storage';
import { Project } from '@shared/schema';

export class GoogleSheetsSyncService {
  constructor(private storage: IStorage) {}

  /**
   * Sync projects from database to Google Sheets - Only syncs meeting projects (those with googleSheetRowId)
   */
  async syncToGoogleSheets(): Promise<{
    success: boolean;
    message: string;
    synced?: number;
  }> {
    const sheetsService = getProjectsGoogleSheetsService();
    if (!sheetsService) {
      return {
        success: false,
        message:
          'Projects Google Sheets service not configured - missing PROJECTS_SHEET_ID',
      };
    }

    try {
      // Get only projects that should sync to sheets (meeting projects)
      const allProjects = await this.storage.getAllProjects();
      const projects = allProjects.filter((p) => p.googleSheetRowId); // Only sync meeting projects

      // Convert projects to sheet format (including sub-tasks)
      const sheetRows: SheetRow[] = [];
      for (const project of projects) {
        const projectTasks = await this.storage.getProjectTasks(project.id);
        sheetRows.push(this.projectToSheetRow(project, projectTasks));
      }

      // Update the sheet
      await sheetsService.updateSheet(sheetRows);

      // Mark projects as synced
      const now = new Date().toISOString();
      for (const project of projects) {
        await this.storage.updateProject(project.id, {
          lastSyncedAt: now,
          syncStatus: 'synced',
        });
      }

      return {
        success: true,
        message: `Successfully synced ${projects.length} projects to Google Sheets`,
        synced: projects.length,
      };
    } catch (error) {
      console.error('Error syncing to Google Sheets:', error);
      return {
        success: false,
        message: `Failed to sync: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  /**
   * Sync from Google Sheets to database - Only syncs projects that have googleSheetRowId
   */
  async syncFromGoogleSheets(): Promise<{
    success: boolean;
    message: string;
    updated?: number;
    created?: number;
  }> {
    const sheetsService = getProjectsGoogleSheetsService();
    if (!sheetsService) {
      return {
        success: false,
        message:
          'Projects Google Sheets service not configured - missing PROJECTS_SHEET_ID',
      };
    }

    try {
      // Read from Google Sheets
      const sheetRows = await sheetsService.readSheet();

      let updatedCount = 0;
      let createdCount = 0;

      for (const row of sheetRows) {
        if (!row.task) continue; // Skip empty rows

        // Try to find existing project by title or sheet row ID
        const existingProjects = await this.storage.getAllProjects();
        const existingProject = existingProjects.find(
          (p) =>
            p.googleSheetRowId === row.rowIndex?.toString() ||
            p.title.toLowerCase().trim() === row.task.toLowerCase().trim()
        );

        const projectData = this.sheetRowToProject(row);

        if (existingProject) {
          // Preserve meeting discussion content - don't overwrite it
          const preservedData = { ...projectData };
          if (existingProject.meetingDiscussionPoints) {
            delete preservedData.description; // Don't overwrite if it has meeting content
          }

          // CRITICAL FIX: Don't override local status changes unless the sheet has newer data
          // Only update status if the project hasn't been manually updated recently (within 1 hour)
          const lastUpdated = existingProject.updatedAt ? new Date(existingProject.updatedAt) : new Date(0);
          const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
          
          if (lastUpdated > oneHourAgo) {
            // Project was updated recently, preserve local status changes
            delete preservedData.status;
            console.log(`🔒 Preserving recent local status change for project "${existingProject.title}" (status: ${existingProject.status})`);
          }

          // Update existing project but preserve meeting content and recent status changes
          await this.storage.updateProject(existingProject.id, {
            ...preservedData,
            syncStatus: 'synced',
            googleSheetRowId: row.rowIndex?.toString(),
          });

          // Sync sub-tasks for this project (with meeting content preservation)
          await this.syncProjectTasksPreservingMeetingContent(
            existingProject.id,
            row.subTasksOwners
          );
          updatedCount++;
        } else {
          // Only create new project if it doesn't exist - mark as meeting project
          const newProject = await this.storage.createProject({
            ...projectData,
            createdBy: 'google-sheets-sync',
            createdByName: 'Google Sheets Import',
            syncStatus: 'synced',
            googleSheetRowId: row.rowIndex?.toString(),
          });

          // Sync sub-tasks for new project
          if (newProject) {
            await this.syncProjectTasks(newProject.id, row.subTasksOwners);
          }
          createdCount++;
        }
      }

      return {
        success: true,
        message: `Sync complete: ${createdCount} created, ${updatedCount} updated`,
        updated: updatedCount,
        created: createdCount,
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
   * True bidirectional sync with hash-based change detection and conflict resolution
   */
  async bidirectionalSync(): Promise<{
    success: boolean;
    message: string;
    details?: any;
  }> {
    const sheetsService = getProjectsGoogleSheetsService();
    if (!sheetsService) {
      return {
        success: false,
        message: 'Projects Google Sheets service not configured - missing PROJECTS_SHEET_ID',
      };
    }

    try {
      console.log('🔄 Starting true bidirectional sync with hash-based change detection...');
      
      // Get all meeting projects from database (those with googleSheetRowId)
      const allProjects = await this.storage.getAllProjects();
      const dbProjects = allProjects.filter((p) => p.googleSheetRowId);
      
      // Read from Google Sheets
      const sheetRows = await sheetsService.readSheet();
      
      let syncStats = {
        conflicts: 0,
        appWins: 0,
        sheetWins: 0,
        noChanges: 0,
        appToSheetUpdates: 0,
        sheetToAppUpdates: 0,
        newFromSheet: 0,
      };

      const now = new Date().toISOString();
      
      // Process each sheet row
      for (const sheetRow of sheetRows) {
        if (!sheetRow.task) continue; // Skip empty rows
        
        // Find corresponding database project
        const dbProject = dbProjects.find(
          (p) => p.googleSheetRowId === sheetRow.rowIndex?.toString() ||
                 p.title.toLowerCase().trim() === sheetRow.task.toLowerCase().trim()
        );

        if (dbProject) {
          // Convert database project to sheet format for comparison
          const appSheetRow = this.projectToSheetRow(dbProject, await this.storage.getProjectTasks(dbProject.id));
          
          // Add metadata to both rows for comparison
          const appRowWithMeta = sheetsService.updateRowWithMetadata(appSheetRow, dbProject.id.toString(), 'app');
          const sheetRowWithMeta = sheetsService.updateRowWithMetadata(sheetRow, dbProject.id.toString(), 'sheet');
          
          // Check if data has changed
          const hasAppChanges = sheetsService.hasRowChanged(
            { ...appRowWithMeta, dataHash: dbProject.lastAppHash }, 
            appRowWithMeta
          );
          const hasSheetChanges = sheetsService.hasRowChanged(
            { ...sheetRowWithMeta, dataHash: dbProject.lastSheetHash }, 
            sheetRowWithMeta
          );

          if (!hasAppChanges && !hasSheetChanges) {
            // No changes on either side
            syncStats.noChanges++;
            continue;
          }

          if (hasAppChanges && hasSheetChanges) {
            // Conflict detected - use conflict resolution
            console.log(`⚠️ Conflict detected for project "${dbProject.title}"`);
            
            const conflict = sheetsService.resolveConflict(appRowWithMeta, sheetRowWithMeta);
            console.log(`🔧 Conflict resolution: ${conflict.winner} wins - ${conflict.reason}`);
            
            syncStats.conflicts++;
            
            if (conflict.winner === 'app') {
              syncStats.appWins++;
              // Update sheet with app data
              await this.updateSheetRow(sheetsService, conflict.resolved, sheetRow.rowIndex!);
              syncStats.appToSheetUpdates++;
              
              // Update database metadata
              await this.storage.updateProject(dbProject.id, {
                lastPushedToSheetAt: now,
                lastAppHash: sheetsService.calculateRowHash(appRowWithMeta),
                lastSheetHash: sheetsService.calculateRowHash(conflict.resolved),
              });
            } else if (conflict.winner === 'sheet') {
              syncStats.sheetWins++;
              // Update database with sheet data
              await this.updateProjectFromSheetRow(dbProject, conflict.resolved);
              syncStats.sheetToAppUpdates++;
              
              // Update database metadata
              await this.storage.updateProject(dbProject.id, {
                lastPulledFromSheetAt: now,
                lastAppHash: sheetsService.calculateRowHash(conflict.resolved),
                lastSheetHash: sheetsService.calculateRowHash(sheetRowWithMeta),
              });
            }
          } else if (hasAppChanges) {
            // App has changes, sheet doesn't - push to sheet
            console.log(`📤 Pushing app changes to sheet for project "${dbProject.title}"`);
            await this.updateSheetRow(sheetsService, appRowWithMeta, sheetRow.rowIndex!);
            syncStats.appToSheetUpdates++;
            
            // Update database metadata
            await this.storage.updateProject(dbProject.id, {
              lastPushedToSheetAt: now,
              lastAppHash: sheetsService.calculateRowHash(appRowWithMeta),
            });
          } else if (hasSheetChanges) {
            // Sheet has changes, app doesn't - pull from sheet
            console.log(`📥 Pulling sheet changes to app for project "${dbProject.title}"`);
            await this.updateProjectFromSheetRow(dbProject, sheetRowWithMeta);
            syncStats.sheetToAppUpdates++;
            
            // Update database metadata
            await this.storage.updateProject(dbProject.id, {
              lastPulledFromSheetAt: now,
              lastSheetHash: sheetsService.calculateRowHash(sheetRowWithMeta),
            });
          }
        } else {
          // New project from sheet - create in database
          console.log(`➕ Creating new project from sheet: "${sheetRow.task}"`);
          const projectData = this.sheetRowToProject(sheetRow);
          const newProject = await this.storage.createProject({
            ...projectData,
            createdBy: 'google-sheets-sync',
            createdByName: 'Google Sheets Import',
            syncStatus: 'synced',
            googleSheetRowId: sheetRow.rowIndex?.toString(),
            lastPulledFromSheetAt: now,
            lastSheetHash: sheetsService.calculateRowHash(sheetRow),
          });
          
          if (newProject) {
            await this.syncProjectTasks(newProject.id, sheetRow.subTasksOwners);
          }
          syncStats.newFromSheet++;
        }
      }

      const message = `✅ Bidirectional sync complete: ${syncStats.conflicts} conflicts (${syncStats.appWins} app wins, ${syncStats.sheetWins} sheet wins), ${syncStats.appToSheetUpdates} app→sheet, ${syncStats.sheetToAppUpdates} sheet→app, ${syncStats.newFromSheet} new from sheet, ${syncStats.noChanges} unchanged`;
      
      console.log(message);
      
      return {
        success: true,
        message,
        details: syncStats,
      };
    } catch (error) {
      console.error('Error in bidirectional sync:', error);
      return {
        success: false,
        message: `Bidirectional sync failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  /**
   * Update a specific row in Google Sheets
   */
  private async updateSheetRow(sheetsService: any, rowData: SheetRow, rowIndex: number): Promise<void> {
    // This would be implemented to update a specific row in the sheet
    // For now, we'll use the existing updateSheet method which updates all rows
    // In a full implementation, this would update just the specific row for efficiency
    const allProjects = await this.storage.getAllProjects();
    const meetingProjects = allProjects.filter((p) => p.googleSheetRowId);
    
    const sheetRows: SheetRow[] = [];
    for (const project of meetingProjects) {
      if (project.id.toString() === rowData.appProjectId) {
        // Use the updated row data for this project
        sheetRows.push(rowData);
      } else {
        // Use existing data for other projects
        const projectTasks = await this.storage.getProjectTasks(project.id);
        sheetRows.push(this.projectToSheetRow(project, projectTasks));
      }
    }
    
    await sheetsService.updateSheet(sheetRows);
  }

  /**
   * Update database project from sheet row data
   */
  private async updateProjectFromSheetRow(project: Project, sheetRow: SheetRow): Promise<void> {
    const projectData = this.sheetRowToProject(sheetRow);
    
    // Preserve meeting discussion content - don't overwrite it
    const preservedData = { ...projectData };
    if (project.meetingDiscussionPoints) {
      delete preservedData.description; // Don't overwrite if it has meeting content
    }

    await this.storage.updateProject(project.id, {
      ...preservedData,
      syncStatus: 'synced',
      googleSheetRowId: sheetRow.rowIndex?.toString(),
    });

    // Sync sub-tasks for this project (with meeting content preservation)
    await this.syncProjectTasksPreservingMeetingContent(project.id, sheetRow.subTasksOwners);
  }

  /**
   * Sync individual project tasks from sheet format - preserving meeting discussion content
   */
  private async syncProjectTasksPreservingMeetingContent(
    projectId: number,
    subTasksOwners: string
  ): Promise<void> {
    if (!subTasksOwners || typeof subTasksOwners !== 'string') return;

    // Parse tasks from string format (e.g., "• Task 1: Katie (C), • Task 2: Chris (IP)")
    const taskItems = this.parseTasksFromString(subTasksOwners);

    // Get existing tasks for this project
    const existingTasks = await this.storage.getProjectTasks(projectId);

    // Track which tasks we've processed
    const processedTaskTitles = new Set<string>();

    // Update existing tasks or create new ones
    for (const taskItem of taskItems) {
      processedTaskTitles.add(taskItem.title);

      // Find existing task with matching title
      const existingTask = existingTasks.find(
        (task) =>
          task.title.trim().toLowerCase() ===
          taskItem.title.trim().toLowerCase()
      );

      if (existingTask) {
        // PRESERVE meeting discussion content - only update status and assignee
        const updateData: any = {};

        if (taskItem.status && taskItem.status !== existingTask.status) {
          updateData.status = taskItem.status;
          console.log(
            `📝 Updating task "${taskItem.title}" status from "${existingTask.status}" to "${taskItem.status}"`
          );
        }

        if (
          taskItem.assignee &&
          taskItem.assignee !== existingTask.assigneeName
        ) {
          updateData.assigneeName = taskItem.assignee;
          updateData.assigneeNames = [taskItem.assignee];
          console.log(
            `👤 Updating task "${taskItem.title}" assignee to "${taskItem.assignee}"`
          );
        }

        // Do NOT update description if it contains meeting discussion content
        if (
          existingTask.description &&
          existingTask.description.includes('Meeting Discussion Notes:')
        ) {
          console.log(
            `🔒 Preserving meeting discussion content for task "${taskItem.title}"`
          );
        }

        if (Object.keys(updateData).length > 0) {
          await this.storage.updateProjectTask(existingTask.id, updateData);
        }
      } else {
        // Create new task (basic version from sheet)
        console.log(
          `➕ Creating new task "${taskItem.title}" with status "${taskItem.status || 'available'}"`
        );
        await this.storage.createProjectTask({
          projectId,
          title: taskItem.title,
          description: taskItem.description || '',
          status: taskItem.status || 'available',
          assigneeName: taskItem.assignee || undefined,
          assigneeNames: taskItem.assignee ? [taskItem.assignee] : [],
        });
      }
    }

    // Remove tasks that are no longer in the sheet (but preserve meeting-generated tasks)
    for (const existingTask of existingTasks) {
      if (!processedTaskTitles.has(existingTask.title)) {
        // Don't delete tasks that have meeting discussion content
        if (
          existingTask.description &&
          existingTask.description.includes('Meeting Discussion Notes:')
        ) {
          console.log(
            `🔒 Preserving meeting-generated task "${existingTask.title}"`
          );
        } else {
          console.log(
            `🗑️ Removing task "${existingTask.title}" as it's no longer in the sheet`
          );
          await this.storage.deleteProjectTask(existingTask.id);
        }
      }
    }
  }

  /**
   * Sync individual project tasks from sheet format
   */
  private async syncProjectTasks(
    projectId: number,
    subTasksOwners: string
  ): Promise<void> {
    if (!subTasksOwners || typeof subTasksOwners !== 'string') return;

    // Parse tasks from string format (e.g., "• Task 1: Katie (C), • Task 2: Chris (IP)")
    const taskItems = this.parseTasksFromString(subTasksOwners);

    // Get existing tasks for this project
    const existingTasks = await this.storage.getProjectTasks(projectId);

    // Track which tasks we've processed
    const processedTaskTitles = new Set<string>();

    // Update existing tasks or create new ones
    for (const taskItem of taskItems) {
      processedTaskTitles.add(taskItem.title);

      // Find existing task with matching title
      const existingTask = existingTasks.find(
        (task) =>
          task.title.trim().toLowerCase() ===
          taskItem.title.trim().toLowerCase()
      );

      if (existingTask) {
        // Update existing task with new status and assignee
        const updateData: any = {};

        if (taskItem.status && taskItem.status !== existingTask.status) {
          updateData.status = taskItem.status;
          console.log(
            `📝 Updating task "${taskItem.title}" status from "${existingTask.status}" to "${taskItem.status}"`
          );
        }

        if (
          taskItem.assignee &&
          taskItem.assignee !== existingTask.assigneeName
        ) {
          updateData.assigneeName = taskItem.assignee;
          updateData.assigneeNames = [taskItem.assignee];
          console.log(
            `👤 Updating task "${taskItem.title}" assignee to "${taskItem.assignee}"`
          );
        }

        if (Object.keys(updateData).length > 0) {
          await this.storage.updateProjectTask(existingTask.id, updateData);
        }
      } else {
        // Create new task
        console.log(
          `➕ Creating new task "${taskItem.title}" with status "${taskItem.status || 'available'}"`
        );
        await this.storage.createProjectTask({
          projectId,
          title: taskItem.title,
          description: taskItem.description || '',
          status: taskItem.status || 'available',
          assigneeName: taskItem.assignee || undefined,
          assigneeNames: taskItem.assignee ? [taskItem.assignee] : [],
        });
      }
    }

    // Remove tasks that are no longer in the sheet
    for (const existingTask of existingTasks) {
      if (!processedTaskTitles.has(existingTask.title)) {
        console.log(
          `🗑️ Removing task "${existingTask.title}" as it's no longer in the sheet`
        );
        await this.storage.deleteProjectTask(existingTask.id);
      }
    }
  }

  /**
   * Convert project to Google Sheets row format
   */
  private projectToSheetRow(
    project: Project,
    projectTasks: any[] = []
  ): SheetRow {
    // Owner = Assigned project owner (assigneeName), fallback to creator
    // Support People = Only the supportPeople field
    const projectOwner =
      project.assigneeName || project.createdByName || project.createdBy || '';
    const supportPeopleOnly = project.supportPeople || '';

    const sheetRow = {
      task: project.title,
      reviewStatus: this.mapReviewStatus(project.reviewInNextMeeting), // P1, P2, etc.
      priority: this.mapPriority(project.priority),
      owner: projectOwner, // Project owner (assignee or creator)
      supportPeople: supportPeopleOnly, // Only support people
      status: this.mapStatus(project.status),
      startDate: project.startDate || '',
      endDate: project.dueDate || '',
      category: project.category || '', // Category column (Column I)
      milestone: project.milestone || '', // Milestone column (Column J)
      subTasksOwners: this.formatTasksForSheet(projectTasks), // Format sub-tasks
      deliverable: project.deliverables || '',
      notes: project.notes || project.description || '',
      lastDiscussedDate: project.lastDiscussedDate || '', // Column N
    };

    // Column mapping verified: task→A, reviewStatus→B, status→F

    return sheetRow;
  }

  /**
   * Convert Google Sheets row to project format
   */
  private sheetRowToProject(row: SheetRow): Partial<Project> {
    const projectData = {
      title: row.task,
      description: row.notes || undefined,
      status: this.mapStatusFromSheet(row.status),
      priority: this.mapPriorityFromSheet(row.priority),
      category: row.category || 'general', // Category from category column
      milestone: row.milestone || undefined, // Milestone from milestone column
      assigneeName: row.owner || undefined, // Owner field maps to assigneeName
      supportPeople: row.supportPeople || undefined, // Support people stay separate
      startDate: row.startDate || undefined,
      dueDate: row.endDate || undefined,
      deliverables: row.deliverable || undefined,
      notes: row.notes || undefined,
      reviewInNextMeeting: this.mapReviewStatusFromSheet(row.reviewStatus),
      lastDiscussedDate: this.parseSheetDate(row.lastDiscussedDate),
    };

    // Filter out empty string values to prevent database type errors
    const cleanedData: any = {};
    for (const [key, value] of Object.entries(projectData)) {
      if (value !== '' && value !== null) {
        cleanedData[key] = value;
      }
    }

    return cleanedData;
  }

  /**
   * Parse date from Google Sheets format
   */
  private parseSheetDate(dateString: string | undefined): string | undefined {
    if (!dateString || dateString.trim() === '') return undefined;

    try {
      // Handle various date formats from Google Sheets
      const cleaned = dateString.trim();

      // Check if it's an Excel serial number (numeric string)
      if (/^\d+(\.\d+)?$/.test(cleaned)) {
        const serialNumber = parseFloat(cleaned);
        
        // Convert Excel serial number to JavaScript Date
        const excelEpoch = new Date(1899, 11, 30); // December 30, 1899 (Excel's day 0)
        const millisecondsPerDay = 24 * 60 * 60 * 1000;
        
        const date = new Date(excelEpoch.getTime() + serialNumber * millisecondsPerDay);
        
        if (isNaN(date.getTime())) {
          console.error(
            `❌ CRITICAL: Invalid Excel serial number from Google Sheets: "${dateString}"`
          );
          return undefined;
        }

        // Get local date components to avoid timezone offset issues
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const isoString = `${year}-${month}-${day}`;

        console.log(`✅ Converted Excel serial number "${dateString}" to: ${isoString}`);
        return isoString;
      } else {
        // Try parsing common formats: MM/DD/YYYY, M/D/YYYY, YYYY-MM-DD
        // Use Date constructor but adjust for timezone to avoid day-off issues
        const date = new Date(cleaned);

        // Check if it's a valid date
        if (isNaN(date.getTime())) {
          console.error(
            `❌ CRITICAL: Invalid date format from Google Sheets: "${dateString}"`
          );
          return undefined;
        }

        // Get local date components to avoid timezone offset issues
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const isoString = `${year}-${month}-${day}`;

        console.log(`✅ Parsed date "${dateString}" to: ${isoString}`);
        return isoString;
      }
    } catch (error) {
      console.error(`❌ CRITICAL: Failed to parse date "${dateString}":`, error);
      return undefined;
    }
  }

  /**
   * Format project tasks for Google Sheets display
   */
  private formatTasksForSheet(projectTasks: any[]): string {
    if (!projectTasks || projectTasks.length === 0) return '';

    return projectTasks
      .map((task) => {
        const assignee =
          task.assigneeName || (task.assigneeNames && task.assigneeNames[0]);
        let statusIndicator = '';

        // Add status indicators
        if (task.status === 'completed') {
          statusIndicator = ' (C)';
        } else if (task.status === 'in_progress') {
          statusIndicator = ' (IP)';
        }

        return assignee
          ? `• ${task.title}: ${assignee}${statusIndicator}`
          : `• ${task.title}${statusIndicator}`;
      })
      .join('\n');
  }

  /**
   * Parse tasks from sheet string format
   */
  private parseTasksFromString(subTasksOwners: string): Array<{
    title: string;
    assignee?: string;
    description?: string;
    status?: string;
  }> {
    if (!subTasksOwners) return [];

    const tasks: Array<{
      title: string;
      assignee?: string;
      description?: string;
      status?: string;
    }> = [];

    // Split by bullet points or line breaks
    const lines = subTasksOwners.split(/[•\n]/).filter((line) => line.trim());

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      // Extract status indicators first
      let taskText = trimmed;
      let status = 'available'; // default status

      // Look for status indicators at the end: (C), (IP), C, IP
      const statusMatch = taskText.match(/\s*\(?(C|IP)\)?$/i);
      if (statusMatch) {
        const statusCode = statusMatch[1].toUpperCase();
        if (statusCode === 'C') {
          status = 'completed';
        } else if (statusCode === 'IP') {
          status = 'in_progress';
        }
        // Remove status indicator from task text
        taskText = taskText.replace(/\s*\(?(C|IP)\)?$/i, '').trim();
      }

      // Look for "Task: Assignee" format
      const colonMatch = taskText.match(/^(.+?):\s*(.+)$/);
      if (colonMatch) {
        tasks.push({
          title: colonMatch[1].trim(),
          assignee: colonMatch[2].trim(),
          status,
        });
      } else {
        // Just a task title
        tasks.push({
          title: taskText,
          status,
        });
      }
    }

    return tasks;
  }

  // Status mapping functions
  private mapReviewStatus(reviewInNextMeeting: boolean): string {
    // Default mapping - can be enhanced to support P1, P2, P3 levels
    return reviewInNextMeeting ? 'P1' : '';
  }

  private mapReviewStatusFromSheet(
    reviewStatus: string | null | undefined
  ): boolean {
    // Handle null, undefined, or empty values
    if (
      !reviewStatus ||
      typeof reviewStatus !== 'string' ||
      reviewStatus.trim() === ''
    ) {
      return false;
    }
    // Any P status means review in next meeting
    return reviewStatus.trim().startsWith('P');
  }

  private mapPriority(priority: string): string {
    const map: Record<string, string> = {
      low: 'Low',
      medium: 'Medium',
      high: 'High',
      urgent: 'Urgent',
    };
    return map[priority] || 'Medium';
  }

  private mapPriorityFromSheet(priority: string): string {
    const map: Record<string, string> = {
      Low: 'low',
      Medium: 'medium',
      High: 'high',
      Urgent: 'urgent',
    };
    return map[priority] || 'medium';
  }

  private mapStatus(status: string): string {
    const map: Record<string, string> = {
      waiting: 'Not started',
      available: 'Not started',
      in_progress: 'In progress',
      completed: 'Completed',
    };
    return map[status] || 'Not started';
  }

  private mapStatusFromSheet(status: string): string {
    const map: Record<string, string> = {
      'Not started': 'available',
      'In progress': 'in_progress',
      Completed: 'completed',
    };
    return map[status] || 'available';
  }
}

// Export singleton
let syncService: GoogleSheetsSyncService | null = null;

export function getGoogleSheetsSyncService(
  storage: IStorage
): GoogleSheetsSyncService {
  if (!syncService) {
    syncService = new GoogleSheetsSyncService(storage);
  }
  return syncService;
}

// Helper function to trigger sync from anywhere in the app
export async function triggerGoogleSheetsSync(): Promise<void> {
  try {
    const { storage } = await import('./storage-wrapper');
    const syncService = getGoogleSheetsSyncService(storage);

    console.log('🔄 Starting automatic Google Sheets sync...');
    const result = await syncService.syncToGoogleSheets();

    if (result.success) {
      console.log(`✅ Google Sheets sync completed: ${result.message}`);
    } else {
      console.error(`❌ Google Sheets sync failed: ${result.message}`);
    }
  } catch (error) {
    console.error('Error during Google Sheets sync trigger:', error);
  }
}
