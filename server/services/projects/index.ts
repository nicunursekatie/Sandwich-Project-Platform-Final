import type { IStorage } from '../../storage';
import {
  insertProjectSchema,
  insertProjectTaskSchema,
  insertTaskCompletionSchema,
  type projects,
  type archivedProjects,
  type projectTasks,
  type taskCompletions,
} from '@shared/schema';
import { hasPermission } from '@shared/auth-utils';
import type { z } from 'zod';

// Types
export type Project = typeof projects.$inferSelect;
export type ArchivedProject = typeof archivedProjects.$inferSelect;
export type ProjectTask = typeof projectTasks.$inferSelect;
export type TaskCompletion = typeof taskCompletions.$inferSelect;
export type InsertProject = z.infer<typeof insertProjectSchema>;
export type InsertProjectTask = z.infer<typeof insertProjectTaskSchema>;
export type InsertTaskCompletion = z.infer<typeof insertTaskCompletionSchema>;

export interface User {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  role?: string;
  permissions?: string[];
}

export interface ProjectPermissionContext {
  user: User;
  project?: Project;
  isAgendaUpdate?: boolean;
}

export interface ProjectCreationData {
  data: any;
  user: User;
}

export interface ProjectUpdateData {
  id: number;
  updates: any;
  user: User;
}

export interface TaskCompletionData {
  taskId: number;
  user: User;
  notes?: string;
}

export interface IProjectService {
  // Project CRUD operations
  getAllProjects(): Promise<Project[]>;
  getProjectById(id: number): Promise<Project | null>;
  getArchivedProjects(): Promise<ArchivedProject[]>;
  createProject(data: ProjectCreationData): Promise<Project>;
  updateProject(data: ProjectUpdateData): Promise<Project | null>;
  deleteProject(id: number, user: User): Promise<boolean>;
  claimProject(id: number, assigneeName?: string): Promise<Project | null>;
  archiveProject(id: number, user: User): Promise<boolean>;

  // Task management
  getProjectTasks(projectId: number): Promise<ProjectTask[]>;
  createProjectTask(
    projectId: number,
    taskData: any,
    user: User
  ): Promise<ProjectTask>;
  completeTask(data: TaskCompletionData): Promise<{
    completion: TaskCompletion;
    isFullyCompleted: boolean;
    totalCompletions: number;
    totalAssignees: number;
  }>;
  uncompleteTask(
    taskId: number,
    user: User
  ): Promise<{
    isFullyCompleted: boolean;
    totalCompletions: number;
    totalAssignees: number;
  }>;
  getTaskCompletions(taskId: number): Promise<TaskCompletion[]>;

  // Permission validation
  validateProjectPermissions(
    context: ProjectPermissionContext
  ): Promise<boolean>;
  validateCreatePermissions(user: User): boolean;
  validateDeletePermissions(user: User, project: Project): boolean;
  validateArchivePermissions(user: User): boolean;

  // Data sanitization and validation
  sanitizeProjectData(data: any): any;
  sanitizeProjectUpdates(updates: any): any;
}

export class ProjectService implements IProjectService {
  constructor(private storage: IStorage) {}

  async getAllProjects(): Promise<Project[]> {
    return this.storage.getAllProjects();
  }

  async getProjectById(id: number): Promise<Project | null> {
    const project = await this.storage.getProject(id);
    return project || null;
  }

  async getArchivedProjects(): Promise<ArchivedProject[]> {
    return this.storage.getArchivedProjects();
  }

  async createProject({ data, user }: ProjectCreationData): Promise<Project> {
    // Validate permissions
    if (!this.validateCreatePermissions(user)) {
      throw new Error('Permission denied. You cannot create projects.');
    }

    // Sanitize and validate data
    const sanitizedData = this.sanitizeProjectData(data);

    const projectData = insertProjectSchema.parse({
      ...sanitizedData,
      createdBy: user.id,
      createdByName: user.firstName
        ? `${user.firstName} ${user.lastName || ''}`.trim()
        : user.email,
    });

    return this.storage.createProject(projectData);
  }

  async updateProject({
    id,
    updates,
    user,
  }: ProjectUpdateData): Promise<Project | null> {
    // Get existing project for permission checks
    const existingProject = await this.storage.getProject(id);
    if (!existingProject) {
      return null;
    }

    // Check if this is an agenda update (special permissions)
    const isAgendaUpdate =
      updates.reviewInNextMeeting !== undefined &&
      Object.keys(updates).length === 1;

    // Validate permissions
    const permissionContext = {
      user,
      project: existingProject,
      isAgendaUpdate,
    };
    const hasValidPermission =
      await this.validateProjectPermissions(permissionContext);
    if (!hasValidPermission) {
      const message = isAgendaUpdate
        ? 'Permission denied. You need meeting management permissions to send projects to agenda.'
        : 'Permission denied. You can only edit your own projects or need admin privileges.';
      throw new Error(message);
    }

    // Sanitize updates
    const validUpdates = this.sanitizeProjectUpdates(updates);

    const updatedProject = await this.storage.updateProject(id, validUpdates);

    // Handle Google Sheets sync for support people updates
    if (updates.supportPeople !== undefined && updatedProject) {
      this.triggerGoogleSheetsSync();
    }

    return updatedProject;
  }

  async deleteProject(id: number, user: User): Promise<boolean> {
    // Get project for ownership check
    const existingProject = await this.storage.getProject(id);
    if (!existingProject) {
      return false;
    }

    // Validate permissions
    if (!this.validateDeletePermissions(user, existingProject)) {
      throw new Error(
        'Permission denied. You can only delete your own projects or need admin privileges.'
      );
    }

    return this.storage.deleteProject(id);
  }

  async claimProject(
    id: number,
    assigneeName?: string
  ): Promise<Project | null> {
    return this.storage.updateProject(id, {
      status: 'in_progress',
      assigneeName: assigneeName || 'You',
    });
  }

  async archiveProject(id: number, user: User): Promise<boolean> {
    // Validate permissions
    if (!this.validateArchivePermissions(user)) {
      throw new Error(
        'Permission denied. Admin privileges required to archive projects.'
      );
    }

    // Check if project exists and is completed
    const project = await this.storage.getProject(id);
    if (!project) {
      throw new Error('Project not found');
    }

    if (project.status !== 'completed') {
      throw new Error('Only completed projects can be archived');
    }

    const userFullName =
      user.firstName && user.lastName
        ? `${user.firstName} ${user.lastName}`
        : user.email;

    return this.storage.archiveProject(id, user.id, userFullName);
  }

  async getProjectTasks(projectId: number): Promise<ProjectTask[]> {
    return this.storage.getProjectTasks(projectId);
  }

  async createProjectTask(
    projectId: number,
    taskData: any,
    user: User
  ): Promise<ProjectTask> {
    // Check permissions for task creation
    if (
      !user.permissions?.includes('create_tasks') &&
      !user.permissions?.includes('edit_all_projects') &&
      !user.permissions?.includes('manage_projects')
    ) {
      throw new Error('Permission denied. You cannot create tasks.');
    }

    const sanitizedTaskData = insertProjectTaskSchema.parse({
      ...taskData,
      projectId,
      createdBy: user.id,
    });

    return this.storage.createProjectTask(sanitizedTaskData);
  }

  async completeTask({ taskId, user, notes }: TaskCompletionData): Promise<{
    completion: TaskCompletion;
    isFullyCompleted: boolean;
    totalCompletions: number;
    totalAssignees: number;
  }> {
    // Check if user is assigned to this task
    const task = await this.storage.getTaskById(taskId);
    if (!task) {
      throw new Error('Task not found');
    }

    const assigneeIds = task.assigneeIds || [];
    if (!assigneeIds.includes(user.id)) {
      throw new Error('You are not assigned to this task');
    }

    // Create completion record
    const completionData = insertTaskCompletionSchema.parse({
      taskId: taskId,
      userId: user.id,
      userName:
        user.firstName && user.lastName
          ? `${user.firstName} ${user.lastName}`
          : user.email,
      notes: notes,
    });

    const completion = await this.storage.createTaskCompletion(completionData);

    // Check completion status
    const allCompletions = await this.storage.getTaskCompletions(taskId);
    const isFullyCompleted = allCompletions.length >= assigneeIds.length;

    // If all users completed, update task status
    if (isFullyCompleted && task.status !== 'completed') {
      await this.storage.updateTaskStatus(taskId, 'completed');
    }

    return {
      completion,
      isFullyCompleted,
      totalCompletions: allCompletions.length,
      totalAssignees: assigneeIds.length,
    };
  }

  async uncompleteTask(
    taskId: number,
    user: User
  ): Promise<{
    isFullyCompleted: boolean;
    totalCompletions: number;
    totalAssignees: number;
  }> {
    // Get task info for assignee validation
    const task = await this.storage.getTaskById(taskId);
    if (!task) {
      throw new Error('Task not found');
    }

    const assigneeIds = task.assigneeIds || [];
    if (!assigneeIds.includes(user.id)) {
      throw new Error('You are not assigned to this task');
    }

    // Remove completion
    const removed = await this.storage.removeTaskCompletion(taskId, user.id);
    if (!removed) {
      throw new Error('No completion found to remove');
    }

    // Check completion status after removal
    const allCompletions = await this.storage.getTaskCompletions(taskId);
    const isFullyCompleted = allCompletions.length >= assigneeIds.length;

    // If no longer fully completed, update task status
    if (!isFullyCompleted && task.status === 'completed') {
      await this.storage.updateTaskStatus(taskId, 'in_progress');
    }

    return {
      isFullyCompleted,
      totalCompletions: allCompletions.length,
      totalAssignees: assigneeIds.length,
    };
  }

  async getTaskCompletions(taskId: number): Promise<TaskCompletion[]> {
    return this.storage.getTaskCompletions(taskId);
  }

  async validateProjectPermissions({
    user,
    project,
    isAgendaUpdate,
  }: ProjectPermissionContext): Promise<boolean> {
    if (isAgendaUpdate) {
      // For agenda updates, only need MEETINGS_MANAGE permission
      return hasPermission(user, 'MEETINGS_MANAGE');
    }

    // For regular project updates
    const canEditAll =
      hasPermission(user, 'PROJECTS_EDIT_ALL') ||
      hasPermission(user, 'MANAGE_ALL_PROJECTS');
    const canEditOwn =
      hasPermission(user, 'PROJECTS_EDIT_OWN') &&
      project &&
      project.createdBy === user.id;

    return canEditAll || canEditOwn;
  }

  validateCreatePermissions(user: User): boolean {
    return (
      user.permissions?.includes('create_projects') ||
      user.permissions?.includes('edit_all_projects') ||
      user.permissions?.includes('manage_projects') ||
      false
    );
  }

  validateDeletePermissions(user: User, project: Project): boolean {
    const canDeleteAll =
      user.permissions?.includes('PROJECTS_DELETE_ALL') ||
      user.role === 'admin' ||
      user.role === 'super_admin';

    const canDeleteOwn =
      user.permissions?.includes('PROJECTS_DELETE_OWN') &&
      project.createdBy === user.id;

    return canDeleteAll || canDeleteOwn;
  }

  validateArchivePermissions(user: User): boolean {
    return (
      user.permissions?.includes('manage_projects') ||
      user.role === 'admin' ||
      user.role === 'super_admin' ||
      false
    );
  }

  sanitizeProjectData(data: any): any {
    const sanitized = { ...data };

    // Convert empty strings to null for numeric fields
    if (sanitized.estimatedHours === '') sanitized.estimatedHours = null;
    if (sanitized.actualHours === '') sanitized.actualHours = null;
    if (sanitized.dueDate === '') sanitized.dueDate = null;
    if (sanitized.startDate === '') sanitized.startDate = null;
    if (sanitized.budget === '') sanitized.budget = null;

    return sanitized;
  }

  sanitizeProjectUpdates(updates: any): any {
    // Filter out fields that shouldn't be updated directly
    const {
      createdAt,
      updatedAt,
      created_by,
      created_by_name,
      ...validUpdates
    } = updates;
    return validUpdates;
  }

  private triggerGoogleSheetsSync(): void {
    // Auto-sync to Google Sheets if supportPeople was updated (async, non-blocking)
    setImmediate(async () => {
      try {
        const { getGoogleSheetsSyncService } = await import(
          '../../google-sheets-sync'
        );
        const syncService = getGoogleSheetsSyncService(this.storage);
        await syncService.syncToGoogleSheets();
        console.log(
          'Projects synced to Google Sheets successfully (background)'
        );
      } catch (syncError) {
        console.error(
          'Failed to sync to Google Sheets (background):',
          syncError
        );
      }
    });
  }
}

// Factory function for creating project service instance
export function createProjectService(storage: IStorage): ProjectService {
  return new ProjectService(storage);
}
