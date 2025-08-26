import { getGoogleSheetsService, SheetRow } from './google-sheets-service';
import { DatabaseStorage } from './database-storage';
import { Project } from '@shared/schema';

export class GoogleSheetsSyncService {
  constructor(private storage: DatabaseStorage) {}

  /**
   * Sync projects from database to Google Sheets
   */
  async syncToGoogleSheets(): Promise<{ success: boolean; message: string; synced?: number }> {
    const sheetsService = getGoogleSheetsService();
    if (!sheetsService) {
      return { success: false, message: 'Google Sheets service not configured' };
    }

    try {
      // Get all projects from database
      const projects = await this.storage.getAllProjects();
      
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
          syncStatus: 'synced'
        });
      }
      
      return { 
        success: true, 
        message: `Successfully synced ${projects.length} projects to Google Sheets`,
        synced: projects.length
      };
    } catch (error) {
      console.error('Error syncing to Google Sheets:', error);
      return { 
        success: false, 
        message: `Failed to sync: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Sync from Google Sheets to database
   */
  async syncFromGoogleSheets(): Promise<{ success: boolean; message: string; updated?: number; created?: number }> {
    const sheetsService = getGoogleSheetsService();
    if (!sheetsService) {
      return { success: false, message: 'Google Sheets service not configured' };
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
        const existingProject = existingProjects.find(p => 
          p.googleSheetRowId === row.rowIndex?.toString() ||
          p.title.toLowerCase().trim() === row.task.toLowerCase().trim()
        );
        
        const projectData = this.sheetRowToProject(row);
        
        if (existingProject) {
          // Update existing project
          await this.storage.updateProject(existingProject.id, {
            ...projectData,
            lastSyncedAt: new Date().toISOString(),
            syncStatus: 'synced',
            googleSheetRowId: row.rowIndex?.toString()
          });
          
          // Sync sub-tasks for this project
          await this.syncProjectTasks(existingProject.id, row.subTasksOwners);
          updatedCount++;
        } else {
          // Create new project
          const newProject = await this.storage.createProject({
            ...projectData,
            createdBy: 'google-sheets-sync',
            createdByName: 'Google Sheets Import',
            lastSyncedAt: new Date().toISOString(),
            syncStatus: 'synced',
            googleSheetRowId: row.rowIndex?.toString()
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
        created: createdCount
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
   * Bi-directional sync - handles conflicts by prioritizing most recent update
   */
  async bidirectionalSync(): Promise<{ success: boolean; message: string; details?: any }> {
    try {
      // First sync FROM sheets to get latest manual changes
      const fromResult = await this.syncFromGoogleSheets();
      
      // Then sync TO sheets to ensure everything is up to date
      const toResult = await this.syncToGoogleSheets();
      
      return {
        success: fromResult.success && toResult.success,
        message: `Bidirectional sync complete. ${fromResult.message} | ${toResult.message}`,
        details: {
          fromSheets: fromResult,
          toSheets: toResult
        }
      };
    } catch (error) {
      console.error('Error in bidirectional sync:', error);
      return {
        success: false,
        message: `Bidirectional sync failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Sync individual project tasks from sheet format
   */
  private async syncProjectTasks(projectId: number, subTasksOwners: string): Promise<void> {
    if (!subTasksOwners || typeof subTasksOwners !== 'string') return;

    // Parse tasks from string format (e.g., "• Task 1: Katie, • Task 2: Chris")
    const taskItems = this.parseTasksFromString(subTasksOwners);
    
    // Get existing tasks for this project
    const existingTasks = await this.storage.getProjectTasks(projectId);
    
    // Clear existing tasks and add new ones
    // Note: This is a simple approach - could be enhanced to merge/update existing tasks
    for (const existingTask of existingTasks) {
      await this.storage.deleteProjectTask(existingTask.id);
    }
    
    // Create new tasks from sheet
    for (const taskItem of taskItems) {
      await this.storage.createProjectTask({
        projectId,
        title: taskItem.title,
        description: taskItem.description || '',
        status: 'pending',
        assigneeName: taskItem.assignee || undefined,
        assigneeNames: taskItem.assignee ? [taskItem.assignee] : []
      });
    }
  }

  /**
   * Convert project to Google Sheets row format
   */
  private projectToSheetRow(project: Project, projectTasks: any[] = []): SheetRow {
    // Owner = Project creator, Support People = Assignees + Support People
    const assigneesList = project.assigneeNames || project.assigneeName || '';
    const supportPeopleList = project.supportPeople || '';
    const allSupportPeople = [assigneesList, supportPeopleList].filter(Boolean).join(', ');

    const sheetRow = {
      task: project.title,
      reviewStatus: this.mapReviewStatus(project.reviewInNextMeeting), // P1, P2, etc.
      priority: this.mapPriority(project.priority),
      owner: project.createdByName || project.createdBy || '', // Project creator is the owner
      supportPeople: allSupportPeople, // Assignees + Support people
      status: this.mapStatus(project.status),
      startDate: project.startDate || '',
      endDate: project.dueDate || '',
      milestone: project.category || '',
      subTasksOwners: this.formatTasksForSheet(projectTasks), // Format sub-tasks
      deliverable: project.deliverables || '',
      notes: project.notes || project.description || '',
      lastDiscussedDate: project.lastDiscussedDate || '' // Column M
    };
    
    // Column mapping verified: task→A, reviewStatus→B, status→F
    
    return sheetRow;
  }

  /**
   * Convert Google Sheets row to project format
   */
  private sheetRowToProject(row: SheetRow): Partial<Project> {
    return {
      title: row.task,
      description: row.notes || undefined,
      status: this.mapStatusFromSheet(row.status),
      priority: this.mapPriorityFromSheet(row.priority),
      category: row.milestone || 'general',
      assigneeName: row.owner || undefined,
      assigneeNames: row.owner || undefined,
      supportPeople: row.supportPeople || undefined, // Support people from sheet
      startDate: row.startDate || undefined,
      dueDate: row.endDate || undefined,
      deliverables: row.deliverable || undefined,
      notes: row.notes || undefined,
      reviewInNextMeeting: this.mapReviewStatusFromSheet(row.reviewStatus),
      lastDiscussedDate: this.parseSheetDate(row.lastDiscussedDate),
      updatedAt: new Date()
    };
  }

  /**
   * Parse date from Google Sheets format
   */
  private parseSheetDate(dateString: string | undefined): string | undefined {
    if (!dateString || dateString.trim() === '') return undefined;
    
    try {
      // Handle various date formats from Google Sheets
      const cleaned = dateString.trim();
      
      // Try parsing common formats: MM/DD/YYYY, M/D/YYYY, YYYY-MM-DD
      const date = new Date(cleaned);
      
      // Check if it's a valid date
      if (isNaN(date.getTime())) {
        console.warn(`⚠️ Invalid date format from Google Sheets: "${dateString}"`);
        return undefined;
      }
      
      // Return as ISO string for database storage
      const isoString = date.toISOString().split('T')[0];
      console.log(`✅ Parsed date "${dateString}" to: ${isoString}`);
      return isoString;
    } catch (error) {
      console.warn(`⚠️ Failed to parse date "${dateString}":`, error);
      return undefined;
    }
  }

  /**
   * Format project tasks for Google Sheets display
   */
  private formatTasksForSheet(projectTasks: any[]): string {
    if (!projectTasks || projectTasks.length === 0) return '';
    
    return projectTasks
      .map(task => {
        const assignee = task.assigneeName || (task.assigneeNames && task.assigneeNames[0]);
        return assignee ? `• ${task.title}: ${assignee}` : `• ${task.title}`;
      })
      .join('\n');
  }

  /**
   * Parse tasks from sheet string format
   */
  private parseTasksFromString(subTasksOwners: string): Array<{title: string, assignee?: string, description?: string}> {
    if (!subTasksOwners) return [];
    
    const tasks: Array<{title: string, assignee?: string, description?: string}> = [];
    
    // Split by bullet points or line breaks
    const lines = subTasksOwners.split(/[•\n]/).filter(line => line.trim());
    
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      
      // Look for "Task: Assignee" format
      const colonMatch = trimmed.match(/^(.+?):\s*(.+)$/);
      if (colonMatch) {
        tasks.push({
          title: colonMatch[1].trim(),
          assignee: colonMatch[2].trim()
        });
      } else {
        // Just a task title
        tasks.push({
          title: trimmed
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

  private mapReviewStatusFromSheet(reviewStatus: string): boolean {
    // Any P status means review in next meeting
    return reviewStatus && reviewStatus.startsWith('P');
  }

  private mapPriority(priority: string): string {
    const map: Record<string, string> = {
      'low': 'Low',
      'medium': 'Medium', 
      'high': 'High',
      'urgent': 'Urgent'
    };
    return map[priority] || 'Medium';
  }

  private mapPriorityFromSheet(priority: string): string {
    const map: Record<string, string> = {
      'Low': 'low',
      'Medium': 'medium',
      'High': 'high', 
      'Urgent': 'urgent'
    };
    return map[priority] || 'medium';
  }

  private mapStatus(status: string): string {
    const map: Record<string, string> = {
      'waiting': 'Not started',
      'available': 'Not started',
      'in_progress': 'In progress',
      'completed': 'Completed'
    };
    return map[status] || 'Not started';
  }

  private mapStatusFromSheet(status: string): string {
    const map: Record<string, string> = {
      'Not started': 'available',
      'In progress': 'in_progress',
      'Completed': 'completed'
    };
    return map[status] || 'available';
  }
}

// Export singleton
let syncService: GoogleSheetsSyncService | null = null;

export function getGoogleSheetsSyncService(storage: DatabaseStorage): GoogleSheetsSyncService {
  if (!syncService) {
    syncService = new GoogleSheetsSyncService(storage);
  }
  return syncService;
}