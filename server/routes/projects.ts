import { Router } from "express";
import { z } from "zod";
import multer from "multer";
import path from "path";
import { storage } from "../storage-wrapper";
import { sanitizeMiddleware } from "../middleware/sanitizer";
import { insertProjectSchema, insertProjectTaskSchema, insertProjectCommentSchema } from "@shared/schema";
import { hasPermission, PERMISSIONS } from "@shared/auth-utils";

// Configure multer for file uploads
const taskUpload = multer({
  dest: 'uploads/tasks/',
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|pdf|doc|docx|txt|csv|xlsx/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (mimetype && extname) {
      cb(null, true);
    } else {
      cb(new Error('Only images, PDFs, and documents are allowed'));
    }
  }
});

const router = Router();

// Authentication middleware
const isAuthenticated = (req: any, res: any, next: any) => {
  const user = req.user || req.session?.user;
  if (!user) {
    return res.status(401).json({ error: "Authentication required" });
  }
  req.user = user; // Ensure req.user is set
  next();
};

// Permission check for project creation
function canCreateProjects(req: any) {
  const user = req.user;
  console.log('🔍 Permission check:', {
    user: user?.email,
    userId: user?.id,
    permissions: user?.permissions,
    checkingFor: PERMISSIONS.CREATE_PROJECTS,
    hasPermission: hasPermission(user, PERMISSIONS.CREATE_PROJECTS)
  });
  return hasPermission(user, PERMISSIONS.CREATE_PROJECTS);
}

// Permission check for project editing
function canEditProjects(req: any) {
  const user = req.user;
  return hasPermission(user, PERMISSIONS.PROJECTS_EDIT_ALL) || 
         hasPermission(user, PERMISSIONS.PROJECTS_EDIT_OWN);
}

// Permission check for project deletion
function canDeleteProjects(req: any) {
  const user = req.user;
  return hasPermission(user, PERMISSIONS.PROJECTS_DELETE_ALL) || 
         hasPermission(user, PERMISSIONS.PROJECTS_DELETE_OWN);
}

// Get projects assigned to the current user
router.get("/projects/assigned", isAuthenticated, async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(400).json({ error: "User ID required" });
    }
    
    const allProjects = await storage.getAllProjects();
    
    // Filter projects where user is assigned or supporting
    const assignedProjects = allProjects.filter((project: any) => {
      // Handle JSON stored arrays (projects table uses jsonb)
      const assigneeIds = Array.isArray(project.assigneeIds) ? project.assigneeIds : 
                         (project.assigneeIds ? JSON.parse(project.assigneeIds) : []);
      const supportPeopleIds = Array.isArray(project.supportPeopleIds) ? project.supportPeopleIds : 
                              (project.supportPeopleIds ? JSON.parse(project.supportPeopleIds) : []);
      
      return assigneeIds.includes(userId) || supportPeopleIds.includes(userId);
    });
    
    res.json(assignedProjects);
  } catch (error) {
    console.error("Error fetching assigned projects:", error);
    res.status(500).json({ error: "Failed to fetch assigned projects" });
  }
});

// Get tasks assigned to the current user
router.get("/tasks/assigned", isAuthenticated, async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(400).json({ error: "User ID required" });
    }
    
    const allProjects = await storage.getAllProjects();
    const assignedTasks: any[] = [];
    
    // Get all tasks for each project and filter by user assignment
    for (const project of allProjects) {
      try {
        const projectTasks = await storage.getProjectTasks(project.id);
        const userTasks = projectTasks.filter((task: any) => {
          // Handle text array format (project_tasks table uses text[])
          const assigneeIds = Array.isArray(task.assigneeIds) ? task.assigneeIds : 
                             (task.assigneeIds ? task.assigneeIds.split(',') : []);
          return assigneeIds.includes(userId);
        });
        
        // Add project context to each task
        userTasks.forEach((task: any) => {
          assignedTasks.push({
            ...task,
            project: {
              title: project.title,
              category: project.category
            }
          });
        });
      } catch (taskError) {
        console.error(`Error fetching tasks for project ${project.id}:`, taskError);
        // Continue with other projects if one fails
      }
    }
    
    res.json(assignedTasks);
  } catch (error) {
    console.error("Error fetching assigned tasks:", error);
    res.status(500).json({ error: "Failed to fetch assigned tasks" });
  }
});

// Project management routes
router.get("/projects", isAuthenticated, async (req, res) => {
  try {
    const projects = await storage.getAllProjects();
    res.json(projects);
  } catch (error) {
    console.error("Error fetching projects:", error);
    res.status(500).json({ error: "Failed to fetch projects" });
  }
});

router.get("/projects/:id", isAuthenticated, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const project = await storage.getProject(id);
    if (!project) {
      return res.status(404).json({ error: "Project not found" });
    }
    res.json(project);
  } catch (error) {
    console.error("Error fetching project:", error);
    res.status(500).json({ error: "Failed to fetch project" });
  }
});

router.post("/projects", isAuthenticated, sanitizeMiddleware, async (req, res) => {
  try {
    console.log('🚨 Project creation request from:', req.user?.email);
    console.log('🚨 User permissions:', req.user?.permissions);
    console.log('🚨 Required permission:', PERMISSIONS.CREATE_PROJECTS);
    
    // Check if user has permission to create projects
    if (!canCreateProjects(req)) {
      console.log('🚨 PERMISSION DENIED');
      return res.status(403).json({ message: "Permission denied. You cannot create projects." });
    }
    console.log('🚨 PERMISSION GRANTED');
    
    // Sanitize numeric fields - convert empty strings to null to prevent database errors
    const sanitizedBody = { ...req.body };
    if (sanitizedBody.estimatedHours === '') sanitizedBody.estimatedHours = null;
    if (sanitizedBody.actualHours === '') sanitizedBody.actualHours = null;
    if (sanitizedBody.dueDate === '') sanitizedBody.dueDate = null;
    if (sanitizedBody.startDate === '') sanitizedBody.startDate = null;
    if (sanitizedBody.budget === '') sanitizedBody.budget = null;
    
    const result = insertProjectSchema.safeParse(sanitizedBody);
    if (!result.success) {
      return res.status(400).json({ error: result.error.message });
    }
    const project = await storage.createProject(result.data);
    
    // Send email notifications to assignees
    if (project.assigneeIds && project.assigneeIds.length > 0) {
      try {
        const { NotificationService } = await import('../notification-service');
        const user = (req as any).user;
        const assignerName = user ? (user.displayName || user.firstName || user.email || 'Admin User') : 'Admin User';
        
        // Get assignee emails
        const assigneeEmails = [];
        for (const assigneeId of project.assigneeIds) {
          if (assigneeId && assigneeId.trim()) {
            const assignee = await storage.getUser(assigneeId);
            if (assignee && assignee.email) {
              assigneeEmails.push(assignee.email);
            }
          }
        }
        
        if (assigneeEmails.length > 0) {
          await NotificationService.sendProjectAssignmentNotification(
            project.id.toString(),
            project.title,
            assigneeEmails,
            assignerName
          );
        }
      } catch (emailError) {
        console.error('Error sending project assignment emails:', emailError);
        // Don't fail the project creation if email fails
      }
    }
    
    res.status(201).json(project);
  } catch (error) {
    console.error("Error creating project:", error);
    res.status(500).json({ error: "Failed to create project" });
  }
});

router.patch("/projects/:id", isAuthenticated, sanitizeMiddleware, async (req, res) => {
  const updates = req.body;
  
  // Check if this is a meeting-related update (agenda planning functions)
  const isMeetingRelatedUpdate = 'reviewInNextMeeting' in updates || 
                                'meetingDiscussionPoints' in updates || 
                                'meetingDecisionItems' in updates;
  
  // Check if this is ONLY meeting-related fields (no other project fields being updated)
  const meetingOnlyFields = ['reviewInNextMeeting', 'meetingDiscussionPoints', 'meetingDecisionItems'];
  const isMeetingOnlyUpdate = Object.keys(updates).every(key => meetingOnlyFields.includes(key));
  
  if (isMeetingRelatedUpdate && isMeetingOnlyUpdate) {
    // For meeting-only updates, check meeting management permissions
    if (!hasPermission(req, PERMISSIONS.MEETINGS_MANAGE)) {
      return res.status(403).json({ 
        error: "You need meeting management permissions to update agenda items and discussion points" 
      });
    }
  } else {
    // For regular project edits, check project edit permissions
    if (!canEditProjects(req)) {
      return res.status(403).json({ error: "Insufficient permissions to edit projects" });
    }
  }
  try {
    const id = parseInt(req.params.id);
    
    // Sanitize numeric fields in updates - convert empty strings to null
    const updates = { ...req.body };
    if (updates.estimatedHours === '') updates.estimatedHours = null;
    if (updates.actualHours === '') updates.actualHours = null;
    if (updates.dueDate === '') updates.dueDate = null;
    if (updates.startDate === '') updates.startDate = null;
    if (updates.budget === '') updates.budget = null;
    
    // Get original project to compare assignees
    const originalProject = await storage.getProject(id);
    
    const project = await storage.updateProject(id, updates);
    if (!project) {
      return res.status(404).json({ error: "Project not found" });
    }
    
    // Send email notifications to newly assigned users
    if (updates.assigneeIds && originalProject) {
      try {
        const { NotificationService } = await import('../notification-service');
        const user = (req as any).user;
        const assignerName = user ? (user.displayName || user.firstName || user.email || 'Admin User') : 'Admin User';
        
        // Find newly assigned users
        const originalAssignees = originalProject.assigneeIds || [];
        const newAssignees = updates.assigneeIds.filter((id: string) => 
          id && id.trim() && !originalAssignees.includes(id)
        );
        
        if (newAssignees.length > 0) {
          // Get assignee emails
          const assigneeEmails = [];
          for (const assigneeId of newAssignees) {
            const assignee = await storage.getUser(assigneeId);
            if (assignee && assignee.email) {
              assigneeEmails.push(assignee.email);
            }
          }
          
          if (assigneeEmails.length > 0) {
            await NotificationService.sendProjectAssignmentNotification(
              project.id.toString(),
              project.title,
              assigneeEmails,
              assignerName
            );
          }
        }
      } catch (emailError) {
        console.error('Error sending project assignment emails:', emailError);
        // Don't fail the project update if email fails
      }
    }
    
    // Trigger Google Sheets sync after project status change
    try {
      const { triggerGoogleSheetsSync } = await import('../google-sheets-sync');
      console.log('Triggering Google Sheets sync after project status update...');
      setImmediate(() => {
        triggerGoogleSheetsSync().catch(error => {
          console.error('Google Sheets sync failed after project update:', error);
        });
      });
    } catch (syncError) {
      console.error('Error triggering Google Sheets sync:', syncError);
      // Don't fail the project update if sync fails
    }
    
    res.json(project);
  } catch (error) {
    console.error("Error updating project:", error);
    res.status(500).json({ error: "Failed to update project" });
  }
});

router.delete("/projects/:id", isAuthenticated, async (req, res) => {
  // Check if user has permission to delete projects
  if (!canDeleteProjects(req)) {
    return res.status(403).json({ error: "Insufficient permissions to delete projects" });
  }
  try {
    const id = parseInt(req.params.id);
    const success = await storage.deleteProject(id);
    if (!success) {
      return res.status(404).json({ error: "Project not found" });
    }
    res.status(204).send();
  } catch (error) {
    console.error("Error deleting project:", error);
    res.status(500).json({ error: "Failed to delete project" });
  }
});

// Project Task routes
router.get("/projects/:projectId/tasks", async (req, res) => {
  try {
    const projectId = parseInt(req.params.projectId);
    const tasks = await storage.getProjectTasks(projectId);
    res.json(tasks);
  } catch (error) {
    console.error("Error fetching project tasks:", error);
    res.status(500).json({ error: "Failed to fetch tasks" });
  }
});

router.post("/projects/:projectId/tasks", sanitizeMiddleware, async (req, res) => {
  try {
    const projectId = parseInt(req.params.projectId);
    const taskData = { ...req.body, projectId };
    const result = insertProjectTaskSchema.safeParse(taskData);
    if (!result.success) {
      return res.status(400).json({ error: result.error.message });
    }
    const task = await storage.createProjectTask(result.data);
    
    // Create task assignment notifications and emit WebSocket events
    if (task.assigneeIds && task.assigneeIds.length > 0) {
      const user = (req as any).user; // Standardized authentication
      
      for (const assigneeId of task.assigneeIds) {
        if (assigneeId && assigneeId.trim()) {
          try {
            // Create notification in database
            const notification = await storage.createNotification({
              userId: assigneeId,
              type: 'task_assignment',
              title: 'New Task Assignment',
              message: `${task.title} has been assigned to you`,
              relatedType: 'task',
              relatedId: task.id,
              isRead: false
            });

            // Emit WebSocket notification if available
            if (typeof (global as any).broadcastTaskAssignment === 'function') {
              (global as any).broadcastTaskAssignment(assigneeId, {
                type: 'task_assignment',
                message: 'You have been assigned a new task',
                taskId: task.id,
                taskTitle: task.title,
                notificationId: notification.id
              });
            }
          } catch (notificationError) {
            console.error(`Error creating notification for user ${assigneeId}:`, notificationError);
            // Don't fail task creation if notification fails
          }
        }
      }
    }
    
    res.status(201).json(task);
  } catch (error) {
    console.error("Error creating project task:", error);
    res.status(500).json({ error: "Failed to create task" });
  }
});

router.patch("/projects/:projectId/tasks/:taskId", sanitizeMiddleware, async (req, res) => {
  try {
    const taskId = parseInt(req.params.taskId);
    const projectId = parseInt(req.params.projectId);
    const updates = req.body;
    
    console.log(`PATCH request - Task ID: ${taskId}, Project ID: ${projectId}`);
    console.log("Updates payload:", updates);
    
    // Get original task to compare assignees
    const originalTask = await storage.getProjectTask(taskId);
    
    const task = await storage.updateProjectTask(taskId, updates);
    if (!task) {
      console.log(`Task ${taskId} not found in database`);
      return res.status(404).json({ error: "Task not found" });
    }
    
    // Check if assignees were added (new assigneeIds that weren't in original)
    if (updates.assigneeIds && Array.isArray(updates.assigneeIds)) {
      const originalAssigneeIds = originalTask?.assigneeIds || [];
      const newAssigneeIds = updates.assigneeIds.filter(id => 
        id && id.trim() && !originalAssigneeIds.includes(id)
      );
      
      // Create notifications for newly assigned users
      if (newAssigneeIds.length > 0) {
        const user = (req as any).user; // Standardized authentication
        
        for (const assigneeId of newAssigneeIds) {
          try {
            // Create notification in database
            const notification = await storage.createNotification({
              userId: assigneeId,
              type: 'task_assignment',
              title: 'New Task Assignment',
              message: `${task.title} has been assigned to you`,
              relatedType: 'task',
              relatedId: task.id,
              isRead: false
            });

            // Emit WebSocket notification if available
            if (typeof (global as any).broadcastTaskAssignment === 'function') {
              (global as any).broadcastTaskAssignment(assigneeId, {
                type: 'task_assignment',
                message: 'You have been assigned a new task',
                taskId: task.id,
                taskTitle: task.title,
                notificationId: notification.id
              });
            }
          } catch (notificationError) {
            console.error(`Error creating notification for user ${assigneeId}:`, notificationError);
            // Don't fail task update if notification fails
          }
        }
      }
    }
    
    console.log(`Task ${taskId} updated successfully`);
    
    // Trigger Google Sheets sync after task status change
    try {
      const { triggerGoogleSheetsSync } = await import('../google-sheets-sync');
      console.log('Triggering Google Sheets sync after task status update...');
      setImmediate(() => {
        triggerGoogleSheetsSync().catch(error => {
          console.error('Google Sheets sync failed after task update:', error);
        });
      });
    } catch (syncError) {
      console.error('Error triggering Google Sheets sync:', syncError);
      // Don't fail the task update if sync fails
    }
    
    res.json(task);
  } catch (error) {
    console.error("Error updating project task:", error);
    res.status(500).json({ error: "Failed to update task" });
  }
});

router.delete("/projects/:projectId/tasks/:taskId", async (req, res) => {
  try {
    const taskId = parseInt(req.params.taskId);
    const success = await storage.deleteProjectTask(taskId);
    if (!success) {
      return res.status(404).json({ error: "Task not found" });
    }
    res.status(204).send();
  } catch (error) {
    console.error("Error deleting project task:", error);
    res.status(500).json({ error: "Failed to delete task" });
  }
});

// Get project congratulations
router.get("/projects/:projectId/congratulations", async (req, res) => {
  try {
    const projectId = parseInt(req.params.projectId);
    const congratulations = await storage.getProjectCongratulations(projectId);
    res.json(congratulations);
  } catch (error) {
    console.error("Error fetching project congratulations:", error);
    res.status(500).json({ error: "Failed to fetch congratulations" });
  }
});

// Task file upload route
router.post("/projects/:projectId/tasks/:taskId/upload", taskUpload.array('files', 5), async (req, res) => {
  try {
    const taskId = parseInt(req.params.taskId);
    const files = req.files as Express.Multer.File[];
    
    if (!files || files.length === 0) {
      return res.status(400).json({ error: "No files uploaded" });
    }

    // Get current task to append to existing attachments
    const task = await storage.getProjectTasks(parseInt(req.params.projectId));
    const currentTask = task.find(t => t.id === taskId);
    
    if (!currentTask) {
      return res.status(404).json({ error: "Task not found" });
    }

    // Parse existing attachments
    let existingAttachments = [];
    if (currentTask.attachments) {
      try {
        existingAttachments = JSON.parse(currentTask.attachments);
      } catch (e) {
        existingAttachments = [];
      }
    }

    // Add new file info
    const newAttachments = files.map(file => ({
      filename: file.filename,
      originalname: file.originalname,
      mimetype: file.mimetype,
      size: file.size,
      uploadedAt: new Date().toISOString()
    }));

    const allAttachments = [...existingAttachments, ...newAttachments];

    // Update task with new attachments
    const updatedTask = await storage.updateProjectTask(taskId, {
      attachments: JSON.stringify(allAttachments)
    });

    res.json({ task: updatedTask, uploadedFiles: newAttachments });
  } catch (error) {
    console.error("Error uploading task files:", error);
    res.status(500).json({ error: "Failed to upload files" });
  }
});

// Project Comment routes
router.get("/projects/:projectId/comments", async (req, res) => {
  try {
    const projectId = parseInt(req.params.projectId);
    const comments = await storage.getProjectComments(projectId);
    res.json(comments);
  } catch (error) {
    console.error("Error fetching project comments:", error);
    res.status(500).json({ error: "Failed to fetch comments" });
  }
});

router.post("/projects/:projectId/comments", sanitizeMiddleware, async (req, res) => {
  try {
    const projectId = parseInt(req.params.projectId);
    const commentData = { ...req.body, projectId };
    const result = insertProjectCommentSchema.safeParse(commentData);
    if (!result.success) {
      return res.status(400).json({ error: result.error.message });
    }
    const comment = await storage.createProjectComment(result.data);
    res.status(201).json(comment);
  } catch (error) {
    console.error("Error creating project comment:", error);
    res.status(500).json({ error: "Failed to create comment" });
  }
});

router.delete("/projects/:projectId/comments/:commentId", async (req, res) => {
  try {
    const commentId = parseInt(req.params.commentId);
    const success = await storage.deleteProjectComment(commentId);
    if (!success) {
      return res.status(404).json({ error: "Comment not found" });
    }
    res.status(204).send();
  } catch (error) {
    console.error("Error deleting project comment:", error);
    res.status(500).json({ error: "Failed to delete comment" });
  }
});

// Project assignments endpoints
router.get("/projects/:id/assignments", async (req, res) => {
  try {
    const projectId = parseInt(req.params.id);
    
    // Set no-cache headers for fresh user data
    res.set({
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    });
    
    const assignments = await storage.getProjectAssignments(projectId);
    res.json(assignments);
  } catch (error) {
    console.error('Error fetching project assignments:', error);
    res.status(500).json({ error: 'Failed to fetch project assignments' });
  }
});

router.post("/projects/:id/assignments", async (req, res) => {
  try {
    const projectId = parseInt(req.params.id);
    const { userId, role, sendNotification } = req.body;
    
    const assignment = await storage.addProjectAssignment({
      projectId,
      userId,
      role: role || 'member'
    });

    // Send notification if requested
    if (sendNotification && assignment) {
      const project = await storage.getProject(projectId);
      const assignedUser = await storage.getUser(userId);
      
      if (project && assignedUser && assignedUser.email) {
        const { NotificationService } = await import('../notification-service');
        const { NotificationTypes } = await import('../../shared/notification-types');
        
        await NotificationService.sendProjectNotification(
          NotificationTypes.PROJECT_ASSIGNED,
          {
            projectId: project.id,
            projectTitle: project.title,
            assignedBy: 'Admin User', // TODO: Get from auth context
            assignedTo: [assignedUser.email]
          },
          [assignedUser.email]
        );
      }
    }

    res.json(assignment);
  } catch (error) {
    console.error('Error adding project assignment:', error);
    res.status(500).json({ error: 'Failed to add project assignment' });
  }
});

router.delete("/projects/:id/assignments/:userId", async (req, res) => {
  try {
    const projectId = parseInt(req.params.id);
    const userId = req.params.userId;
    
    const success = await storage.removeProjectAssignment(projectId, userId);
    
    if (success) {
      res.json({ success: true });
    } else {
      res.status(404).json({ error: 'Assignment not found' });
    }
  } catch (error) {
    console.error('Error removing project assignment:', error);
    res.status(500).json({ error: 'Failed to remove project assignment' });
  }
});

router.patch("/projects/:id/assignments/:userId", async (req, res) => {
  try {
    const projectId = parseInt(req.params.id);
    const userId = req.params.userId;
    const { role } = req.body;
    
    const assignment = await storage.updateProjectAssignment(projectId, userId, { role });
    
    if (assignment) {
      res.json(assignment);
    } else {
      res.status(404).json({ error: 'Assignment not found' });
    }
  } catch (error) {
    console.error('Error updating project assignment:', error);
    res.status(500).json({ error: 'Failed to update project assignment' });
  }
});

export { router as projectsRoutes };