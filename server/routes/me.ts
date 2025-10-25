import { Router, type Response } from 'express';
import { logger } from '../middleware/logger';
import type { IStorage } from '../storage';
import { storage } from '../storage-wrapper';
import { logger } from '../utils/production-safe-logger';
import type { AuthenticatedRequest } from '../types/express';
import type { Project, ProjectTask, EventRequest, User } from '@shared/schema';

interface DashboardItem {
  id: number;
  title: string;
  status: string;
  linkPath: string;
  count?: number;
  priority?: string;
  dueDate?: string;
  createdAt?: string;
  assignmentType?: string[];
  organizationName?: string;
}

interface DashboardData {
  projects: DashboardItem[];
  tasks: DashboardItem[];
  events: DashboardItem[];
  messages: DashboardItem[];
  counts: {
    projects: number;
    tasks: number;
    events: number;
    messages: number;
  };
}

const normalizeToString = (value: unknown): string | null => {
  if (value === null || value === undefined) return null;

  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  if (typeof value === 'number' || typeof value === 'bigint') {
    return value.toString();
  }

  return null;
};

const toStringArray = (value: unknown): string[] => {
  if (!value) return [];

  if (Array.isArray(value)) {
    return value
      .map((entry) => normalizeToString(entry))
      .filter((entry): entry is string => Boolean(entry));
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return [];

    if (trimmed.startsWith('[')) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) {
          return toStringArray(parsed);
        }
      } catch {
        // Fallback to comma-separated parsing below
      }
    }

    return trimmed
      .split(',')
      .map((part) => part.trim())
      .filter(Boolean);
  }

  return [];
};

// Create me routes router
const meRouter = Router();

// Helper function to get user from request
const getUser = (req: AuthenticatedRequest) => {
  return req.user || req.session?.user;
};

// GET /dashboard - Get user's dashboard data
meRouter.get('/dashboard', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = getUser(req);
    if (!user) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    const normalizedUserId = normalizeToString(user.id);
    if (!normalizedUserId) {
      return res.status(400).json({ message: 'Invalid user identifier' });
    }
    const userId = normalizedUserId;

    logger.info(`Fetching dashboard data for user: ${userId}`);

    // Fetch assigned projects (excluding completed, order by priority)
    const allProjects = await storage.getAllProjects();
    const allUsers = await storage.getAllUsers();
    
    // Find current user details
    const currentUser = allUsers.find(
      (u) => normalizeToString(u.id) === userId
    );
    const userFullName = currentUser ? `${currentUser.firstName} ${currentUser.lastName}`.trim() : '';
    const userDisplayName = currentUser?.displayName || '';
    
    logger.info(
      `Looking for projects assigned to user: ${userId}, name: "${userFullName}", display: "${userDisplayName}"`
    );
    logger.info(`Total projects to check: ${allProjects.length}`);
    
    const assignedProjects = allProjects
      .filter((project) => {
        // Check if user is assigned via ID fields (new way)
        const idAssigned = (
          normalizeToString(project.assigneeId) === userId ||
          normalizeToString(project.assignee_id) === userId ||
          toStringArray(project.assigneeIds).includes(userId) ||
          toStringArray(project.assignee_ids).includes(userId) ||
          toStringArray(project.supportPeopleIds).includes(userId) ||
          toStringArray(project.support_people_ids).includes(userId)
        );
        
        // Check if user is assigned via name fields (current way)
        const nameAssigned = currentUser && (
          (project.assigneeName && (project.assigneeName.includes(userFullName) || project.assigneeName.includes(userDisplayName))) ||
          (project.assigneeNames && (project.assigneeNames.includes(userFullName) || project.assigneeNames.includes(userDisplayName))) ||
          (project.supportPeople && (project.supportPeople.includes(userFullName) || project.supportPeople.includes(userDisplayName)))
        );
        
        // Debug logging for each project
        if (project.assigneeName || project.assigneeNames || project.supportPeople) {
          logger.info(`Project ${project.id}: assigneeName="${project.assigneeName}", assigneeNames="${project.assigneeNames}", supportPeople="${project.supportPeople}"`);
          logger.info(`  nameAssigned: ${nameAssigned}, idAssigned: ${idAssigned}`);
        }
        
        const isAssigned = idAssigned || nameAssigned;
        if (isAssigned) {
          logger.info(`Found assigned project: ${project.id} - ${project.title}`);
        }
        
        return isAssigned;
      })
      .filter((project) => project.status !== 'completed')
      .sort((a, b) => {
        // Priority order: urgent > high > medium > low
        const priorityOrder = { urgent: 4, high: 3, medium: 2, low: 1 };
        return (priorityOrder[b.priority] || 0) - (priorityOrder[a.priority] || 0);
      })
      .slice(0, 3)
      .map((project) => ({
        id: project.id,
        title: project.title,
        status: project.status,
        linkPath: `/dashboard?section=projects&view=detail&id=${project.id}`,
        priority: project.priority,
        dueDate: project.dueDate,
      }));

    // Fetch assigned tasks using storage interface
    const allTasks = await storage.getAssignedTasks(userId);
    const assignedTasks = allTasks
      .filter((task) => {
        return ['pending', 'in_progress'].includes(task.status);
      })
      .sort((a, b) => {
        // Priority order: urgent > high > medium > low
        const priorityOrder = { urgent: 4, high: 3, medium: 2, low: 1 };
        return (priorityOrder[b.priority] || 0) - (priorityOrder[a.priority] || 0);
      })
      .slice(0, 3)
      .map((task) => ({
        id: task.id,
        title: task.title,
        status: task.status,
        linkPath: `/dashboard?section=projects&view=detail&id=${task.projectId}`,
        priority: task.priority,
        dueDate: task.dueDate,
      }));

    // Fetch assigned events (using same logic as existing /assigned endpoint)
    const allEventRequests = await storage.getAllEventRequests();
    // Note: currentUser already defined above

    const assignedEvents = allEventRequests
      .filter((event) => {
        // Exclude completed and declined events - only show active/upcoming events
        if (event.status === 'completed' || event.status === 'declined') return false;

        // Method 1: Direct assignment via assignedTo field
        if (event.assignedTo === userId) return true;

        // Method 2: TSP contact assignment
        if (event.tspContact === userId || event.tspContactAssigned === userId) return true;

        // Method 2b: Additional TSP contacts
        if (event.additionalTspContacts && currentUser) {
          const additionalContacts = (typeof event.additionalTspContacts === 'string' ? event.additionalTspContacts : JSON.stringify(event.additionalTspContacts || '')).toLowerCase();
          const userEmail = currentUser.email.toLowerCase();
          const userName = currentUser.displayName?.toLowerCase() || '';
          const userFirstName = currentUser.firstName?.toLowerCase() || '';
          const userLastName = currentUser.lastName?.toLowerCase() || '';

          if (
            additionalContacts.includes(userEmail) ||
            (userName && additionalContacts.includes(userName)) ||
            (userFirstName &&
              userLastName &&
              (additionalContacts.includes(userFirstName) ||
                additionalContacts.includes(userLastName)))
          ) {
            return true;
          }
        }

        // Method 3: Driver details
        if (event.driverDetails && currentUser) {
          const driverText = (
            typeof event.driverDetails === 'string'
              ? event.driverDetails
              : JSON.stringify(event.driverDetails)
          ).toLowerCase();
          const userEmail = currentUser.email.toLowerCase();
          const userName = currentUser.displayName?.toLowerCase() || '';

          if (driverText.includes(userEmail) || (userName && driverText.includes(userName))) {
            return true;
          }
        }

        // Method 4: Speaker details
        if (event.speakerDetails && currentUser) {
          const speakerText = (
            typeof event.speakerDetails === 'string'
              ? event.speakerDetails
              : JSON.stringify(event.speakerDetails)
          ).toLowerCase();
          const userEmail = currentUser.email.toLowerCase();
          const userName = currentUser.displayName?.toLowerCase() || '';

          if (speakerText.includes(userEmail) || (userName && speakerText.includes(userName))) {
            return true;
          }
        }

        return false;
      })
      .sort((a, b) => {
        // Sort by event date, upcoming first
        if (a.desiredEventDate && b.desiredEventDate) {
          return new Date(a.desiredEventDate).getTime() - new Date(b.desiredEventDate).getTime();
        }
        return 0;
      })
      .slice(0, 3)
      .map((event) => ({
        id: event.id,
        title: `${event.firstName} ${event.lastName}`,
        status: event.status,
        linkPath: `/dashboard?section=event-requests&tab=new&eventId=${event.id}`,
        organizationName: event.organizationName,
        dueDate: event.desiredEventDate,
      }));

    // Fetch unread messages - try to get from message_recipients table
    let unreadMessages: DashboardItem[] = [];
    try {
      // Try to get unread messages from messaging system
      const allMessages = await storage.getAllMessages?.() || [];
      const messageRecipients = await storage.getMessageRecipients?.(userId) || [];
      
      unreadMessages = messageRecipients
        .filter((recipient) => !recipient.read)
        .slice(0, 3)
        .map((recipient) => {
          const message = allMessages.find((m) => m.id === recipient.messageId);
          return {
            id: recipient.messageId,
            title: message?.subject || message?.content?.substring(0, 50) || 'New Message',
            status: 'unread',
            linkPath: '/dashboard?section=messages',
            createdAt: message?.createdAt || recipient.createdAt,
          };
        });
    } catch (error) {
      logger.warn('Could not fetch messages, using fallback', error);
      // Fallback - use empty array
      unreadMessages = [];
    }

    // Get total counts - use the already filtered assignedProjects array
    const totalProjectsCount = assignedProjects.length;

    const totalTasksCount = allTasks.filter((task) => {
      return ['pending', 'in_progress'].includes(task.status);
    }).length;

    const totalEventsCount = allEventRequests.filter((event) => {
      if (event.status === 'completed' || event.status === 'declined') return false;
      return (
        event.assignedTo === userId ||
        event.tspContact === userId ||
        event.tspContactAssigned === userId ||
        (event.additionalTspContacts && currentUser && (typeof event.additionalTspContacts === 'string' ? event.additionalTspContacts : JSON.stringify(event.additionalTspContacts || '')).toLowerCase().includes(currentUser.email.toLowerCase())) ||
        (event.driverDetails && currentUser && JSON.stringify(event.driverDetails).toLowerCase().includes(currentUser.email.toLowerCase())) ||
        (event.speakerDetails && currentUser && JSON.stringify(event.speakerDetails).toLowerCase().includes(currentUser.email.toLowerCase()))
      );
    }).length;

    // For messages count, try to get unread count
    let totalMessagesCount = 0;
    try {
      const allUnreadRecipients = await storage.getMessageRecipients?.(userId) || [];
      totalMessagesCount = allUnreadRecipients.filter((r) => !r.read).length;
    } catch (error) {
      totalMessagesCount = 0;
    }

    const dashboardData: DashboardData = {
      projects: assignedProjects,
      tasks: assignedTasks,
      events: assignedEvents,
      messages: unreadMessages,
      counts: {
        projects: totalProjectsCount,
        tasks: totalTasksCount,
        events: totalEventsCount,
        messages: totalMessagesCount,
      },
    };

    logger.info(`Dashboard data prepared for user ${userId}: ${totalProjectsCount} projects, ${totalTasksCount} tasks, ${totalEventsCount} events, ${totalMessagesCount} messages`);
    res.json(dashboardData);
  } catch (error) {
    logger.error('Failed to fetch dashboard data', error);
    logger.error('Dashboard endpoint error:', error);
    res.status(500).json({ message: 'Failed to fetch dashboard data' });
  }
});

export default meRouter;