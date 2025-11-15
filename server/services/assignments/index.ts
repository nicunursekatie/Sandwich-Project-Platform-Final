/**
 * Assignment Services
 *
 * Provides services for managing assignments across the platform:
 * - Project assignments (owners and support people)
 * - Task assignments (assignees and reviewers)
 * - Team board assignments
 * - Meeting-project relationships
 */

export {
  ProjectAssignmentService,
  type IProjectAssignmentService,
  type AssignmentUser,
} from './project-assignment-service';

export {
  TaskAssignmentService,
  type ITaskAssignmentService,
  type TaskAssignmentUser,
} from './task-assignment-service';

export {
  TeamBoardAssignmentService,
  type ITeamBoardAssignmentService,
  type TeamBoardAssignmentUser,
} from './team-board-assignment-service';

export {
  MeetingProjectService,
  type IMeetingProjectService,
  type MeetingProjectData,
} from './meeting-project-service';

// Create singleton instances for easy import
export const projectAssignmentService = new ProjectAssignmentService();
export const taskAssignmentService = new TaskAssignmentService();
export const teamBoardAssignmentService = new TeamBoardAssignmentService();
export const meetingProjectService = new MeetingProjectService();
