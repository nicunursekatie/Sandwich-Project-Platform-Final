import { 
  users, projects, archivedProjects, projectTasks, projectComments, projectAssignments, taskCompletions, messages, messageLikes, conversations, conversationParticipants, weeklyReports, meetingMinutes, driveLinks, sandwichCollections, agendaItems, meetings, compiledAgendas, agendaSections, driverAgreements, drivers, volunteers, hosts, hostContacts, recipients, contacts, committees, committeeMemberships, notifications, suggestions, suggestionResponses, chatMessages, chatMessageLikes, userActivityLogs, announcements, sandwichDistributions, wishlistSuggestions, documents, documentPermissions, documentAccessLogs, eventRequests, organizations, eventVolunteers,
  type User, type InsertUser, type UpsertUser,
  type Project, type InsertProject,
  type ProjectTask, type InsertProjectTask,
  type ProjectComment, type InsertProjectComment,
  type ProjectAssignment, type InsertProjectAssignment,
  type TaskCompletion, type InsertTaskCompletion,
  type Message, type InsertMessage,
  type MessageLike, type InsertMessageLike,
  type WeeklyReport, type InsertWeeklyReport,
  type SandwichCollection, type InsertSandwichCollection,
  type MeetingMinutes, type InsertMeetingMinutes,
  type DriveLink, type InsertDriveLink,
  type AgendaItem, type InsertAgendaItem,
  type Meeting, type InsertMeeting,
  type DriverAgreement, type InsertDriverAgreement,
  type Driver, type InsertDriver,
  type Volunteer, type InsertVolunteer,
  type Host, type InsertHost,
  type HostContact, type InsertHostContact,
  type Recipient, type InsertRecipient,
  type Contact, type InsertContact,
  type Committee, type InsertCommittee,
  type CommitteeMembership, type InsertCommitteeMembership,
  type Notification, type InsertNotification,
  type Suggestion, type InsertSuggestion,
  type SuggestionResponse, type InsertSuggestionResponse,
  type ChatMessageLike, type InsertChatMessageLike,
  type UserActivityLog, type InsertUserActivityLog,
  type SandwichDistribution, type InsertSandwichDistribution,
  type WishlistSuggestion, type InsertWishlistSuggestion,
  type Document, type InsertDocument,
  type DocumentPermission, type InsertDocumentPermission,
  type DocumentAccessLog, type InsertDocumentAccessLog,
  type EventRequest, type InsertEventRequest,
  type Organization, type InsertOrganization,
  type EventVolunteer, type InsertEventVolunteer
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, asc, sql, and, or, isNull, ne, isNotNull, gt, gte, lte, inArray, like, ilike } from "drizzle-orm";
import type { IStorage } from "./storage";

export class DatabaseStorage implements IStorage {
  // Users (required for authentication)
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserById(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user || undefined;
  }

  async createUser(userData: InsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(userData)
      .returning();
    return user;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(userData)
      .onConflictDoUpdate({
        target: users.id,
        set: {
          ...userData,
          updatedAt: new Date(),
        },
      })
      .returning();
    return user;
  }

  async getAllUsers(): Promise<User[]> {
    return await db.select().from(users).orderBy(users.createdAt);
  }

  async updateUser(id: string, updates: Partial<User>): Promise<User | undefined> {
    const [user] = await db
      .update(users)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning();
    return user || undefined;
  }

  async setUserPassword(id: string, password: string): Promise<void> {
    await db
      .update(users)
      .set({ passwordHash: password, updatedAt: new Date() })
      .where(eq(users.id, id));
  }

  async deleteUser(id: string): Promise<boolean> {
    const result = await db.delete(users).where(eq(users.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  // Legacy user methods (for backwards compatibility)
  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, username));
    return user || undefined;
  }

  // Projects
  async getAllProjects(): Promise<Project[]> {
    const projectsFromDb = await db.select().from(projects).orderBy(desc(projects.createdAt));
    
    // Populate missing assignee names
    const projectsWithNames = await Promise.all(
      projectsFromDb.map(async (project) => {
        // If assigneeIds exist but assigneeNames is missing or empty, populate them
        if (project.assigneeIds && project.assigneeIds.length > 0 && (!project.assigneeNames || !project.assigneeNames.trim())) {
          const names = [];
          for (const assigneeId of project.assigneeIds) {
            if (assigneeId && assigneeId.trim()) {
              const user = await this.getUser(assigneeId);
              if (user) {
                names.push(user.displayName || user.firstName || user.email || 'Unknown User');
              } else {
                names.push('Unknown User');
              }
            }
          }
          
          // Update the database with the resolved names
          if (names.length > 0) {
            const assigneeNames = names.join(', ');
            await db.update(projects)
              .set({ assigneeNames })
              .where(eq(projects.id, project.id));
            
            return { ...project, assigneeNames };
          }
        }
        
        return project;
      })
    );
    
    return projectsWithNames;
  }

  async getProject(id: number): Promise<Project | undefined> {
    const [project] = await db.select().from(projects).where(eq(projects.id, id));
    return project || undefined;
  }

  async createProject(insertProject: InsertProject): Promise<Project> {
    const [project] = await db.insert(projects).values(insertProject).returning();
    return project;
  }

  async updateProject(id: number, updates: Partial<Project>): Promise<Project | undefined> {
    // Get the current project to check its current state
    const currentProject = await this.getProject(id);
    if (!currentProject) return undefined;

    // Auto-update status based on assignee changes
    const updateData = { ...updates, updatedAt: new Date() };

    // If assigneeName is being set and project is currently available, change to in_progress
    if (updateData.assigneeName && updateData.assigneeName.trim() && currentProject.status === "available") {
      updateData.status = "in_progress";
    }
    // If assigneeName is being removed and project is currently in_progress, change to available
    else if (updateData.assigneeName === "" && currentProject.status === "in_progress") {
      updateData.status = "available";
    }

    const [project] = await db.update(projects).set(updateData).where(eq(projects.id, id)).returning();
    return project || undefined;
  }

  async deleteProject(id: number): Promise<boolean> {
    const result = await db.delete(projects).where(eq(projects.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  // Archive functionality for completed projects
  async archiveProject(id: number, userId?: string, userName?: string): Promise<boolean> {
    const project = await this.getProject(id);
    if (!project) return false;

    // Create archived version
    const archiveData = {
      originalProjectId: project.id,
      title: project.title,
      description: project.description,
      priority: project.priority,
      category: project.category,
      assigneeId: project.assigneeId,
      assigneeName: project.assigneeName,
      assigneeIds: project.assigneeIds,
      assigneeNames: project.assigneeNames,
      dueDate: project.dueDate,
      startDate: project.startDate,
      completionDate: project.completionDate || new Date().toISOString(),
      progressPercentage: 100,
      notes: project.notes,
      requirements: project.requirements,
      deliverables: project.deliverables,
      resources: project.resources,
      blockers: project.blockers,
      tags: project.tags,
      estimatedHours: project.estimatedHours,
      actualHours: project.actualHours,
      budget: project.budget,
      createdBy: project.createdBy,
      createdByName: project.createdByName,
      createdAt: project.createdAt || new Date(), // Ensure we have a valid timestamp
      originalCreatedAt: project.createdAt,
      originalUpdatedAt: project.updatedAt,
      archivedBy: userId,
      archivedByName: userName,
    };

    // Insert into archived table
    await db.insert(archivedProjects).values(archiveData);
    
    // Delete from active projects
    await this.deleteProject(id);
    
    return true;
  }

  async getArchivedProjects(): Promise<any[]> {
    return await db.select().from(archivedProjects).orderBy(desc(archivedProjects.createdAt));
  }

  async getArchivedProject(id: number): Promise<any | undefined> {
    const [project] = await db.select().from(archivedProjects).where(eq(archivedProjects.id, id));
    return project || undefined;
  }

  // Project Tasks
  async getProjectTasks(projectId: number): Promise<ProjectTask[]> {
    return await db.select().from(projectTasks).where(eq(projectTasks.projectId, projectId)).orderBy(projectTasks.order);
  }

  async getProjectTask(taskId: number): Promise<ProjectTask | undefined> {
    const [task] = await db.select().from(projectTasks).where(eq(projectTasks.id, taskId));
    return task || undefined;
  }

  async createProjectTask(insertTask: InsertProjectTask): Promise<ProjectTask> {
    const [task] = await db.insert(projectTasks).values(insertTask).returning();
    return task;
  }

  async updateProjectTask(id: number, updates: Partial<ProjectTask>): Promise<ProjectTask | undefined> {
    // Log for debugging
    console.log(`Updating task ${id} with updates:`, updates);

    // Handle timestamp fields properly and filter out fields that shouldn't be updated
    const processedUpdates = { ...updates };

    // Remove fields that shouldn't be updated directly
    delete processedUpdates.id;
    delete processedUpdates.projectId;
    delete processedUpdates.createdAt;

    if (processedUpdates.completedAt && typeof processedUpdates.completedAt === 'string') {
      processedUpdates.completedAt = new Date(processedUpdates.completedAt);
    }
    if (processedUpdates.dueDate && typeof processedUpdates.dueDate === 'string') {
      processedUpdates.dueDate = new Date(processedUpdates.dueDate);
    }

    // Always update the updatedAt timestamp
    processedUpdates.updatedAt = new Date();

    console.log(`Processed updates for task ${id}:`, processedUpdates);

    try {
      const [task] = await db.update(projectTasks).set(processedUpdates).where(eq(projectTasks.id, id)).returning();
      console.log(`Task ${id} updated successfully:`, task);
      return task || undefined;
    } catch (error) {
      console.error(`Error updating task ${id}:`, error);
      throw error;
    }
  }

  async deleteProjectTask(id: number): Promise<boolean> {
    const result = await db.delete(projectTasks).where(eq(projectTasks.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  async getProjectCongratulations(projectId: number): Promise<any[]> {
    const result = await db.select().from(notifications)
      .where(
        and(
          eq(notifications.relatedType, 'project'),
          eq(notifications.relatedId, projectId),
          eq(notifications.type, 'congratulations')
        )
      )
      .orderBy(desc(notifications.createdAt));
    return result;
  }

  async getTaskById(id: number): Promise<ProjectTask | undefined> {
    const result = await db.select().from(projectTasks)
      .where(eq(projectTasks.id, id))
      .limit(1);
    return result[0];
  }

  async updateTaskStatus(id: number, status: string): Promise<boolean> {
    const result = await db.update(projectTasks)
      .set({ status: status })
      .where(eq(projectTasks.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  // Task completion methods
  async createTaskCompletion(completion: InsertTaskCompletion): Promise<TaskCompletion> {
    const [result] = await db.insert(taskCompletions).values(completion).returning();
    return result;
  }

  async getTaskCompletions(taskId: number): Promise<TaskCompletion[]> {
    return await db.select().from(taskCompletions)
      .where(eq(taskCompletions.taskId, taskId))
      .orderBy(taskCompletions.completedAt);
  }

  async removeTaskCompletion(taskId: number, userId: string): Promise<boolean> {
    const result = await db.delete(taskCompletions)
      .where(and(
        eq(taskCompletions.taskId, taskId),
        eq(taskCompletions.userId, userId)
      ));
    return (result.rowCount ?? 0) > 0;
  }

  // Project Comments
  async getProjectComments(projectId: number): Promise<ProjectComment[]> {
    return await db.select().from(projectComments).where(eq(projectComments.projectId, projectId)).orderBy(desc(projectComments.createdAt));
  }

  async createProjectComment(insertComment: InsertProjectComment): Promise<ProjectComment> {
    const [comment] = await db.insert(projectComments).values(insertComment).returning();
    return comment;
  }

  async deleteProjectComment(id: number): Promise<boolean> {
    const result = await db.delete(projectComments).where(eq(projectComments.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  // Messages
  async getAllMessages(): Promise<Message[]> {
    try {
      const result = await db
        .select({
          id: messages.id,
          content: messages.content,
          sender: messages.sender,
          timestamp: messages.createdAt,
          userId: messages.userId,
          conversationId: messages.conversationId
        })
        .from(messages)
        .orderBy(messages.createdAt);

      return result;
    } catch (error) {
      // If sender column doesn't exist, query without it and add default sender
      console.log('Sender column not found, using fallback query');
      const result = await db
        .select({
          id: messages.id,
          content: messages.content,
          timestamp: messages.createdAt,
          userId: messages.userId,
          conversationId: messages.conversationId
        })
        .from(messages)
        .orderBy(messages.createdAt);

      // Add default sender for compatibility
      return result.map(msg => ({
        ...msg,
        sender: 'Unknown User'
      }));
    }
  }

  async getRecentMessages(limit: number): Promise<Message[]> {
    return await db.select().from(messages).orderBy(messages.id).limit(limit);
  }

  // REMOVED: getMessagesByCommittee - no longer needed with new conversation system

  // UPDATED: Get messages by conversationId (preferred method)
  async getMessagesByConversationId(conversationId: number): Promise<Message[]> {
    const results = await db
      .select({
        id: messages.id,
        conversationId: messages.conversationId,
        userId: messages.userId,
        senderId: messages.senderId,
        content: messages.content,
        sender: sql<string>`COALESCE(CONCAT(${users.firstName}, ' ', ${users.lastName}), ${users.firstName}, ${users.email}, ${messages.sender}, 'Member')`,
        contextType: messages.contextType,
        contextId: messages.contextId,
        editedAt: messages.editedAt,
        editedContent: messages.editedContent,
        deletedAt: messages.deletedAt,
        deletedBy: messages.deletedBy,
        createdAt: messages.createdAt,
        updatedAt: messages.updatedAt,
      })
      .from(messages)
      .leftJoin(users, eq(users.id, messages.senderId))
      .where(eq(messages.conversationId, conversationId))
      .orderBy(messages.createdAt);
    
    return results.map(row => ({
      ...row,
      sender: row.sender || 'Member'
    }));
  }

  // Get participants for a conversation
  async getConversationParticipants(conversationId: number): Promise<Array<{
    userId: string;
    role: string;
    firstName: string;
    lastName: string;
    email: string;
  }>> {
    // Note: conversationParticipants table doesn't have role column, so we'll default to 'member'
    const results = await db
      .select({
        userId: conversationParticipants.userId,
        firstName: users.firstName,
        lastName: users.lastName,
        email: users.email,
      })
      .from(conversationParticipants)
      .leftJoin(users, eq(users.id, conversationParticipants.userId))
      .where(eq(conversationParticipants.conversationId, conversationId));
    
    console.log(`[DB] Found ${results.length} participants for conversation ${conversationId}`);
    return results.map(row => ({
      userId: row.userId,
      role: 'member', // Default role since table doesn't have role column
      firstName: row.firstName || '',
      lastName: row.lastName || '',
      email: row.email || '',
    }));
  }

  // ALIAS: getMessagesByThreadId for backwards compatibility
  async getMessagesByThreadId(threadId: number): Promise<Message[]> {
    return await this.getMessagesByConversationId(threadId);
  }

  // ALIAS: getMessages for backwards compatibility
  async getMessages(messageContext: string, limit?: number): Promise<Message[]> {
    if (limit) {
      return await this.getRecentMessages(limit);
    } else {
      // For backwards compatibility, return all messages since committee filtering is removed
      return await this.getAllMessages();
    }
  }

  // NEW: Get or create conversation for specific conversation types
  async getOrCreateThreadId(type: string, referenceId?: string): Promise<number> {
    try {
      // For the new simple system, we'll use conversation IDs as thread IDs
      // Check if conversation already exists
      const [existing] = await db.select()
        .from(conversations)
        .where(and(
          eq(conversations.type, type),
          referenceId ? eq(conversations.name, referenceId) : isNull(conversations.name)
        ));

      if (existing) {
        return existing.id;
      }

      // Create new conversation
      const [newConversation] = await db.insert(conversations).values({
        type,
        name: referenceId || this.generateThreadTitle(type, referenceId),
      }).returning();

      return newConversation.id;
    } catch (error) {
      console.error("Error getting/creating conversation:", error);
      throw error;
    }
  }

  private generateThreadTitle(type: string, referenceId?: string): string {
    switch (type) {
      case 'general': return 'General Chat';
      case 'committee': return `Committee Chat - ${referenceId}`;
      case 'host': return 'Host Chat';
      case 'driver': return 'Driver Chat';
      case 'recipient': return 'Recipient Chat';
      case 'core_team': return 'Core Team';
      case 'direct': return `Direct Messages - ${referenceId}`;
      case 'group': return `Group Chat - ${referenceId}`;
      default: return `${type} Chat`;
    }
  }

  // FIXED: Direct messages must use conversationId for proper isolation
  async getDirectMessages(userId1: string, userId2: string): Promise<Message[]> {
    // Create consistent reference ID for direct message conversation
    const userIds = [userId1, userId2].sort();
    const referenceId = userIds.join('_');
    const conversationId = await this.getOrCreateThreadId('direct', referenceId);

    console.log(`🔍 QUERY: getDirectMessages - conversationId: ${conversationId}, users: ${userId1} <-> ${userId2}, referenceId: ${referenceId}`);

    const messageResults = await db.select().from(messages)
      .where(eq(messages.conversationId, conversationId))
      .orderBy(messages.createdAt);

    console.log(`🔍 RESULT: Found ${messageResults.length} direct messages for conversationId ${conversationId}`);
    return messageResults;
  }

  async getMessageById(id: number): Promise<Message | undefined> {
    console.log(`[DEBUG] getMessageById called with id: ${id}`);
    try {
      const [message] = await db.select().from(messages).where(eq(messages.id, id));
      console.log(`[DEBUG] getMessageById result:`, message);
      return message || undefined;
    } catch (error) {
      console.error(`[ERROR] getMessageById failed for id ${id}:`, error);
      return undefined;
    }
  }

  async markMessageAsRead(messageId: string, userId: string): Promise<void> {
    console.log(`[DB] Marking message ${messageId} as read for user ${userId}`);
    try {
      // Update the message read status
      await db
        .update(messages)
        .set({ read: true })
        .where(eq(messages.id, parseInt(messageId)));
      console.log(`[DB] Message ${messageId} marked as read for user ${userId}`);
    } catch (error) {
      console.error(`[ERROR] Failed to mark message ${messageId} as read for user ${userId}:`, error);
      throw error;
    }
  }

  async createMessage(insertMessage: InsertMessage): Promise<Message> {
    // Ensure conversationId is set for proper conversation isolation
    if (!insertMessage.conversationId) {
      // Auto-assign conversationId based on message type
      let conversationType = 'channel';
      let conversationName = 'general'; // Default to general chat

      // For now, create a general conversation if none exists
      const [conversation] = await db
        .select()
        .from(conversations)
        .where(
          and(
            eq(conversations.type, 'channel'),
            eq(conversations.name, 'general')
          )
        )
        .limit(1);

      if (conversation) {
        insertMessage.conversationId = conversation.id;
        console.log(`✅ SEND: Using existing conversationId ${conversation.id} for general message from ${insertMessage.userId}`);
      } else {
        // Create new general conversation
        const [newConversation] = await db
          .insert(conversations)
          .values({
            type: 'channel',
            name: 'general'
          })
          .returning();
        
        insertMessage.conversationId = newConversation.id;
        console.log(`✅ SEND: Created new conversationId ${newConversation.id} for general message from ${insertMessage.userId}`);
      }
    } else {
      console.log(`🔄 SEND: Using existing conversationId ${insertMessage.conversationId} for message from ${insertMessage.userId}`);
    }

    const [message] = await db.insert(messages).values(insertMessage).returning();
    console.log(`📤 MESSAGE SENT: id=${message.id}, conversationId=${message.conversationId}, sender=${message.userId}`);
    return message;
  }


  async createReply(insertMessage: InsertMessage, parentId: number): Promise<Message> {
    const [message] = await db.insert(messages).values(insertMessage).returning();
    await this.updateReplyCount(parentId);
    return message;
  }

  async updateReplyCount(messageId: number): Promise<void> {
    await db.update(messages)
      .set({ replyCount: sql`${messages.replyCount} + 1` })
      .where(eq(messages.id, messageId));
  }

  async deleteMessage(id: number): Promise<boolean> {
    console.log(`[DEBUG] deleteMessage called with id: ${id}`);
    try {
      const result = await db.delete(messages).where(eq(messages.id, id));
      console.log(`[DEBUG] deleteMessage result:`, result);
      const success = (result.rowCount ?? 0) > 0;
      console.log(`[DEBUG] deleteMessage success: ${success}`);
      return success;
    } catch (error) {
      console.error(`[ERROR] deleteMessage failed for id ${id}:`, error);
      return false;
    }
  }

  async getMessagesBySender(senderId: string): Promise<Message[]> {
    console.log(`[DEBUG] getMessagesBySender called with senderId: ${senderId}`);
    try {
      const result = await db.select()
        .from(messages)
        .where(eq(messages.senderId, senderId))
        .orderBy(desc(messages.createdAt));
      console.log(`[DEBUG] Found ${result.length} messages sent by ${senderId}`);
      return result;
    } catch (error) {
      console.error(`[ERROR] getMessagesBySender failed for senderId ${senderId}:`, error);
      return [];
    }
  }

  async getMessagesBySenderWithReadStatus(senderId: string): Promise<any[]> {
    console.log(`[DEBUG] getMessagesBySenderWithReadStatus called with senderId: ${senderId}`);
    try {
      const { messageRecipients } = await import("@shared/schema");
      
      // Get messages with recipient read status
      const result = await db
        .select({
          message: messages,
          recipientRead: messageRecipients.read,
          recipientReadAt: messageRecipients.readAt,
          recipientId: messageRecipients.recipientId
        })
        .from(messages)
        .leftJoin(messageRecipients, eq(messages.id, messageRecipients.messageId))
        .where(eq(messages.senderId, senderId))
        .orderBy(desc(messages.createdAt));
      
      console.log(`[DEBUG] Found ${result.length} message-recipient pairs for sender ${senderId}`);
      return result;
    } catch (error) {
      console.error(`[ERROR] getMessagesBySenderWithReadStatus failed for senderId ${senderId}:`, error);
      return [];
    }
  }

  async getMessagesForRecipient(recipientId: string): Promise<Message[]> {
    console.log(`[DEBUG] getMessagesForRecipient called with recipientId: ${recipientId}`);
    try {
      const result = await db.select()
        .from(messages)
        .where(eq(messages.contextId, recipientId))
        .orderBy(desc(messages.createdAt));
      console.log(`[DEBUG] Found ${result.length} messages for recipient ${recipientId}`);
      return result;
    } catch (error) {
      console.error(`[ERROR] getMessagesForRecipient failed for recipientId ${recipientId}:`, error);
      return [];
    }
  }

  // Conversation management methods
  async getDirectConversation(userId1: string, userId2: string): Promise<any | undefined> {
    try {
      // Find direct conversations where both users are participants
      const directConversations = await db
        .select({ conversation: conversations })
        .from(conversations)
        .innerJoin(conversationParticipants, eq(conversations.id, conversationParticipants.conversationId))
        .where(
          and(
            eq(conversations.type, 'direct'),
            eq(conversationParticipants.userId, userId1)
          )
        );

      // Check if any of these conversations also include userId2
      for (const conv of directConversations) {
        const participant2 = await db
          .select()
          .from(conversationParticipants)
          .where(
            and(
              eq(conversationParticipants.conversationId, conv.conversation.id),
              eq(conversationParticipants.userId, userId2)
            )
          )
          .limit(1);

        if (participant2.length > 0) {
          return conv.conversation;
        }
      }

      return undefined;
    } catch (error) {
      console.error('Error finding direct conversation:', error);
      return undefined;
    }
  }



  async addConversationParticipant(participantData: any): Promise<any> {
    const [participant] = await db
      .insert(conversationParticipants)
      .values(participantData)
      .returning();
    return participant;
  }

  // REMOVED: Old group messaging methods - replaced with simple conversation system
  // These methods referenced non-existent tables (messageGroups, groupMessageParticipants)
  // The new system uses conversations, conversationParticipants, and messages tables

  // Weekly Reports
  async getAllWeeklyReports(): Promise<WeeklyReport[]> {
    return await db.select().from(weeklyReports).orderBy(weeklyReports.id);
  }

  async createWeeklyReport(insertReport: InsertWeeklyReport): Promise<WeeklyReport> {
    const [report] = await db.insert(weeklyReports).values(insertReport).returning();
    return report;
  }

  // Sandwich Collections
  async getAllSandwichCollections(): Promise<SandwichCollection[]> {
    return await db.select().from(sandwichCollections).orderBy(desc(sandwichCollections.collectionDate));
  }

  async getSandwichCollections(limit: number, offset: number, sortField = 'collectionDate', sortOrder = 'desc'): Promise<SandwichCollection[]> {
    const orderByClause = sortOrder === 'asc' ? 
      asc(sandwichCollections[sortField as keyof typeof sandwichCollections]) :
      desc(sandwichCollections[sortField as keyof typeof sandwichCollections]);
      
    return await db.select()
      .from(sandwichCollections)
      .orderBy(orderByClause)
      .limit(limit)
      .offset(offset);
  }

  async getSandwichCollectionById(id: number): Promise<SandwichCollection | null> {
    const result = await db.select().from(sandwichCollections).where(eq(sandwichCollections.id, id));
    return result[0] || null;
  }

  async getSandwichCollectionsCount(): Promise<number> {
    const result = await db.select({ count: sql<number>`count(*)::int` }).from(sandwichCollections);
    return Number(result[0].count);
  }

  async getCollectionStats(): Promise<{ totalEntries: number; totalSandwiches: number; }> {
    const result = await db.select({ 
      totalEntries: sql<number>`count(*)::int`,
      totalSandwiches: sql<number>`coalesce(sum(individual_sandwiches), 0)::int + coalesce(sum(group1_count), 0)::int + coalesce(sum(group2_count), 0)::int`
    }).from(sandwichCollections);

    return {
      totalEntries: Number(result[0].totalEntries),
      totalSandwiches: Number(result[0].totalSandwiches)
    };
  }

  async createSandwichCollection(insertCollection: InsertSandwichCollection): Promise<SandwichCollection> {
    const [collection] = await db.insert(sandwichCollections).values(insertCollection).returning();
    return collection;
  }

  async updateSandwichCollection(id: number, updates: Partial<SandwichCollection>): Promise<SandwichCollection | undefined> {
    const [collection] = await db.update(sandwichCollections).set(updates).where(eq(sandwichCollections.id, id)).returning();
    return collection || undefined;
  }

  async deleteSandwichCollection(id: number): Promise<boolean> {
    const result = await db.delete(sandwichCollections).where(eq(sandwichCollections.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  // Meeting Minutes
  async getAllMeetingMinutes(): Promise<MeetingMinutes[]> {
    return await db.select().from(meetingMinutes).orderBy(meetingMinutes.id);
  }

  async getRecentMeetingMinutes(limit: number): Promise<MeetingMinutes[]> {
    return await db.select().from(meetingMinutes).orderBy(meetingMinutes.id).limit(limit);
  }

  async createMeetingMinutes(insertMinutes: InsertMeetingMinutes): Promise<MeetingMinutes> {
    const [minutes] = await db.insert(meetingMinutes).values(insertMinutes).returning();
    return minutes;
  }

  async deleteMeetingMinutes(id: number): Promise<boolean> {
    const result = await db.delete(meetingMinutes).where(eq(meetingMinutes.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  // Drive Links
  async getAllDriveLinks(): Promise<DriveLink[]> {
    return await db.select().from(driveLinks).orderBy(driveLinks.id);
  }

  async createDriveLink(insertLink: InsertDriveLink): Promise<DriveLink> {
    const [link] = await db.insert(driveLinks).values(insertLink).returning();
    return link;
  }

  // Agenda Items
  async getAllAgendaItems(): Promise<AgendaItem[]> {
    return await db.select().from(agendaItems).orderBy(agendaItems.id);
  }

  async createAgendaItem(insertItem: InsertAgendaItem): Promise<AgendaItem> {
    const [item] = await db.insert(agendaItems).values(insertItem).returning();
    return item;
  }

  async updateAgendaItemStatus(id: number, status: string): Promise<AgendaItem | undefined> {
    const [item] = await db.update(agendaItems).set({ status }).where(eq(agendaItems.id, id)).returning();
    return item || undefined;
  }

  async updateAgendaItem(id: number, updates: Partial<AgendaItem>): Promise<AgendaItem | undefined> {
    const [item] = await db.update(agendaItems).set(updates).where(eq(agendaItems.id, id)).returning();
    return item || undefined;
  }

  async deleteAgendaItem(id: number): Promise<boolean> {
    const result = await db.delete(agendaItems).where(eq(agendaItems.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  // Meetings
  async getCurrentMeeting(): Promise<Meeting | undefined> {
    const [meeting] = await db.select().from(meetings).where(eq(meetings.status, 'active')).limit(1);
    return meeting || undefined;
  }

  async getAllMeetings(): Promise<Meeting[]> {
    return await db.select().from(meetings).orderBy(desc(meetings.date));
  }

  async getMeetingsByType(type: string): Promise<Meeting[]> {
    return await db.select().from(meetings).where(eq(meetings.type, type)).orderBy(desc(meetings.date));
  }

  async createMeeting(insertMeeting: InsertMeeting): Promise<Meeting> {
    const [meeting] = await db.insert(meetings).values(insertMeeting).returning();
    return meeting;
  }

  async updateMeetingAgenda(id: number, agenda: string): Promise<Meeting | undefined> {
    const [meeting] = await db.update(meetings).set({ finalAgenda: agenda }).where(eq(meetings.id, id)).returning();
    return meeting || undefined;
  }

  async updateMeeting(id: number, updates: Partial<Meeting>): Promise<Meeting | undefined> {
    const [meeting] = await db.update(meetings).set(updates).where(eq(meetings.id, id)).returning();
    return meeting || undefined;
  }

  async deleteMeeting(id: number): Promise<boolean> {
    const result = await db.delete(meetings).where(eq(meetings.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  // Driver Agreements
  async createDriverAgreement(insertAgreement: InsertDriverAgreement): Promise<DriverAgreement> {
    const [agreement] = await db.insert(driverAgreements).values(insertAgreement).returning();
    return agreement;
  }

  // Drivers
  async getAllDrivers(): Promise<Driver[]> {
    return await db.select().from(drivers).orderBy(drivers.name);
  }

  async getDriver(id: number): Promise<Driver | undefined> {
    const [driver] = await db.select().from(drivers).where(eq(drivers.id, id));
    return driver || undefined;
  }

  async createDriver(insertDriver: InsertDriver): Promise<Driver> {
    const [driver] = await db.insert(drivers).values(insertDriver).returning();
    return driver;
  }

  async updateDriver(id: number, updates: Partial<Driver>): Promise<Driver | undefined> {
    const [driver] = await db.update(drivers).set(updates).where(eq(drivers.id, id)).returning();
    return driver || undefined;
  }

  async deleteDriver(id: number): Promise<boolean> {
    const result = await db.delete(drivers).where(eq(drivers.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  // Volunteers
  async getAllVolunteers(): Promise<Volunteer[]> {
    return await db.select().from(volunteers).orderBy(volunteers.name);
  }

  async getVolunteer(id: number): Promise<Volunteer | undefined> {
    const [volunteer] = await db.select().from(volunteers).where(eq(volunteers.id, id));
    return volunteer || undefined;
  }

  async createVolunteer(insertVolunteer: InsertVolunteer): Promise<Volunteer> {
    const [volunteer] = await db.insert(volunteers).values(insertVolunteer).returning();
    return volunteer;
  }

  async updateVolunteer(id: number, updates: Partial<Volunteer>): Promise<Volunteer | undefined> {
    const [volunteer] = await db.update(volunteers)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(volunteers.id, id))
      .returning();
    return volunteer || undefined;
  }

  async deleteVolunteer(id: number): Promise<boolean> {
    const result = await db.delete(volunteers).where(eq(volunteers.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  // Hosts
  async getAllHosts(): Promise<Host[]> {
    return await db.select().from(hosts).orderBy(hosts.name);
  }

  async getHost(id: number): Promise<Host | undefined> {
    const [host] = await db.select().from(hosts).where(eq(hosts.id, id));
    return host || undefined;
  }

  async createHost(insertHost: InsertHost): Promise<Host> {
    const [host] = await db.insert(hosts).values(insertHost).returning();
    return host;
  }

  async updateHost(id: number, updates: Partial<Host>): Promise<Host | undefined> {
    const [host] = await db.update(hosts)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(hosts.id, id))
      .returning();
    return host || undefined;
  }

  async deleteHost(id: number): Promise<boolean> {
    // First check if this host has any associated sandwich collections
    const host = await db.select().from(hosts).where(eq(hosts.id, id)).limit(1);
    if (host.length === 0) {
      return false; // Host doesn't exist
    }

    const hostName = host[0].name;
    const [collectionCount] = await db
      .select({ count: sql`count(*)` })
      .from(sandwichCollections)
      .where(eq(sandwichCollections.hostName, hostName));

    if (Number(collectionCount.count) > 0) {
      throw new Error(`Cannot delete host "${hostName}" because it has ${collectionCount.count} associated collection records. Please update or remove these records first.`);
    }

    // Also delete any host contacts first
    await db.delete(hostContacts).where(eq(hostContacts.hostId, id));

    // Now delete the host
    const result = await db.delete(hosts).where(eq(hosts.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  async updateCollectionHostNames(oldHostName: string, newHostName: string): Promise<number> {
    const result = await db
      .update(sandwichCollections)
      .set({ hostName: newHostName })
      .where(eq(sandwichCollections.hostName, oldHostName));
    return result.rowCount ?? 0;
  }

  // Recipients
  async getAllRecipients(): Promise<Recipient[]> {
    return await db.select().from(recipients).orderBy(recipients.name);
  }

  async getRecipient(id: number): Promise<Recipient | undefined> {
    const [recipient] = await db.select().from(recipients).where(eq(recipients.id, id));
    return recipient || undefined;
  }

  async createRecipient(insertRecipient: InsertRecipient): Promise<Recipient> {
    const [recipient] = await db.insert(recipients).values(insertRecipient).returning();
    return recipient;
  }

  async updateRecipient(id: number, updates: Partial<Recipient>): Promise<Recipient | undefined> {
    const [recipient] = await db.update(recipients).set(updates).where(eq(recipients.id, id)).returning();
    return recipient || undefined;
  }

  async deleteRecipient(id: number): Promise<boolean> {
    const result = await db.delete(recipients).where(eq(recipients.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  // Sandwich Distributions
  async getAllSandwichDistributions(): Promise<SandwichDistribution[]> {
    return await db.select().from(sandwichDistributions).orderBy(desc(sandwichDistributions.distributionDate));
  }

  async getSandwichDistribution(id: number): Promise<SandwichDistribution | undefined> {
    const [distribution] = await db.select().from(sandwichDistributions).where(eq(sandwichDistributions.id, id));
    return distribution || undefined;
  }

  async createSandwichDistribution(insertDistribution: InsertSandwichDistribution): Promise<SandwichDistribution> {
    const [distribution] = await db.insert(sandwichDistributions).values(insertDistribution).returning();
    return distribution;
  }

  async updateSandwichDistribution(id: number, updates: Partial<SandwichDistribution>): Promise<SandwichDistribution | undefined> {
    const [distribution] = await db.update(sandwichDistributions)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(sandwichDistributions.id, id))
      .returning();
    return distribution || undefined;
  }

  async deleteSandwichDistribution(id: number): Promise<boolean> {
    const result = await db.delete(sandwichDistributions).where(eq(sandwichDistributions.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  async getSandwichDistributionsByWeek(weekEnding: string): Promise<SandwichDistribution[]> {
    return await db.select().from(sandwichDistributions)
      .where(eq(sandwichDistributions.weekEnding, weekEnding))
      .orderBy(sandwichDistributions.hostName, sandwichDistributions.recipientName);
  }

  async getSandwichDistributionsByHost(hostId: number): Promise<SandwichDistribution[]> {
    return await db.select().from(sandwichDistributions)
      .where(eq(sandwichDistributions.hostId, hostId))
      .orderBy(desc(sandwichDistributions.distributionDate));
  }

  async getSandwichDistributionsByRecipient(recipientId: number): Promise<SandwichDistribution[]> {
    return await db.select().from(sandwichDistributions)
      .where(eq(sandwichDistributions.recipientId, recipientId))
      .orderBy(desc(sandwichDistributions.distributionDate));
  }

  // General Contacts
  async getAllContacts(): Promise<Contact[]> {
    return await db.select().from(contacts).orderBy(contacts.name);
  }

  async getContact(id: number): Promise<Contact | undefined> {
    const [contact] = await db.select().from(contacts).where(eq(contacts.id, id));
    return contact || undefined;
  }

  async createContact(insertContact: InsertContact): Promise<Contact> {
    const [contact] = await db.insert(contacts).values(insertContact).returning();
    return contact;
  }

  async updateContact(id: number, updates: Partial<Contact>): Promise<Contact | undefined> {
    const [contact] = await db.update(contacts).set(updates).where(eq(contacts.id, id)).returning();
    return contact || undefined;
  }

  async deleteContact(id: number): Promise<boolean> {
    const result = await db.delete(contacts).where(eq(contacts.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  // Cross-table duplicate checking helper
  private async checkCrossTableDuplicate(name: string, email?: string, phone?: string): Promise<{
    exists: boolean,
    source: string,
    contactId?: number
  }> {
    // Normalize phone for comparison (remove non-digits)
    const normalizePhone = (phoneStr?: string) => phoneStr?.replace(/\D/g, '') || '';
    const normalizedPhone = normalizePhone(phone);

    // Check volunteers table
    if (email) {
      const volunteerMatch = await db.select()
        .from(volunteers)
        .where(
          and(
            eq(volunteers.name, name),
            eq(volunteers.email, email)
          )
        )
        .limit(1);
      
      if (volunteerMatch.length > 0) {
        return { exists: true, source: 'volunteers', contactId: volunteerMatch[0].id };
      }
    }

    // Check by phone across tables if provided
    if (normalizedPhone) {
      const volunteerPhoneMatch = await db.select()
        .from(volunteers)
        .where(
          and(
            eq(volunteers.name, name),
            or(
              eq(volunteers.phone, phone || ''),
              eq(volunteers.phone, normalizedPhone),
              eq(sql`REGEXP_REPLACE(${volunteers.phone}, '[^0-9]', '', 'g')`, normalizedPhone)
            )
          )
        )
        .limit(1);
      
      if (volunteerPhoneMatch.length > 0) {
        return { exists: true, source: 'volunteers', contactId: volunteerPhoneMatch[0].id };
      }
    }

    // Check general contacts table
    if (email) {
      const contactMatch = await db.select()
        .from(contacts)
        .where(
          and(
            eq(contacts.name, name),
            eq(contacts.email, email)
          )
        )
        .limit(1);
      
      if (contactMatch.length > 0) {
        return { exists: true, source: 'contacts', contactId: contactMatch[0].id };
      }
    }

    return { exists: false, source: '' };
  }

  // Host Contact methods
  async createHostContact(insertContact: InsertHostContact): Promise<HostContact> {
    // Check for existing contact within host_contacts table
    if (insertContact.name && insertContact.email) {
      const existingContact = await db.select()
        .from(hostContacts)
        .where(
          and(
            eq(hostContacts.name, insertContact.name),
            eq(hostContacts.email, insertContact.email)
          )
        )
        .limit(1);
      
      if (existingContact.length > 0) {
        console.log(`Duplicate host contact prevented: ${insertContact.name} (${insertContact.email})`);
        throw new Error(`Contact "${insertContact.name}" with email "${insertContact.email}" already exists for this host. Each contact must have a unique name and email combination.`);
      }
    }

    // Check for cross-table duplicates
    const crossTableCheck = await this.checkCrossTableDuplicate(
      insertContact.name, 
      insertContact.email, 
      insertContact.phone
    );
    
    if (crossTableCheck.exists) {
      console.log(`❌ CROSS-TABLE DUPLICATE DETECTED: ${insertContact.name} already exists in ${crossTableCheck.source} table (ID: ${crossTableCheck.contactId})`);
      console.log(`   - Attempted to create in host_contacts: ${insertContact.email}, ${insertContact.phone}`);
      console.log(`   - Use contact assignment/linking instead of creating duplicate records`);
      
      // Instead of creating a duplicate, throw an error or return a special response
      throw new Error(`Contact "${insertContact.name}" already exists in ${crossTableCheck.source} table. Use contact assignment instead of creating duplicates.`);
    }
    
    const [contact] = await db.insert(hostContacts).values(insertContact).returning();
    console.log(`✅ New host contact created: ${contact.name} (${contact.email})`);
    return contact;
  }

  async getHostContacts(hostId: number): Promise<HostContact[]> {
    return await db.select().from(hostContacts).where(eq(hostContacts.hostId, hostId));
  }

  async updateHostContact(id: number, updates: Partial<HostContact>): Promise<HostContact | undefined> {
    // Ensure updatedAt is properly formatted as a Date object
    const updateData = {
      ...updates,
      updatedAt: new Date()
    };
    
    const [contact] = await db.update(hostContacts)
      .set(updateData)
      .where(eq(hostContacts.id, id))
      .returning();
    return contact;
  }

  async deleteHostContact(id: number): Promise<boolean> {
    const result = await db.delete(hostContacts).where(eq(hostContacts.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  // Optimized query to get all hosts with their contacts in one call
  async getAllHostsWithContacts(): Promise<Array<Host & { contacts: HostContact[] }>> {
    const hostsData = await db.select().from(hosts).orderBy(hosts.name);
    const contactsData = await db.select().from(hostContacts);

    return hostsData.map(host => ({
      ...host,
      contacts: contactsData.filter(contact => contact.hostId === host.id)
    }));
  }

  // Project Assignments
  async getProjectAssignments(projectId: number): Promise<ProjectAssignment[]> {
    return await db.select().from(projectAssignments).where(eq(projectAssignments.projectId, projectId));
  }

  async createProjectAssignment(assignment: InsertProjectAssignment): Promise<ProjectAssignment> {
    const [created] = await db.insert(projectAssignments).values(assignment).returning();
    return created;
  }

  async deleteProjectAssignment(projectId: number, userId: string): Promise<boolean> {
    const result = await db.delete(projectAssignments)
      .where(and(
        eq(projectAssignments.projectId, projectId),
        eq(projectAssignments.userId, userId)
      ));
    return (result.rowCount ?? 0) > 0;
  }

  async getUserProjectAssignments(userId: string): Promise<ProjectAssignment[]> {
    return await db.select().from(projectAssignments).where(eq(projectAssignments.userId, userId));
  }

  // Modified project methods to support user-specific visibility
  async getProjectsForUser(userId: string): Promise<Project[]> {
    // Get projects where user is assigned
    const assignedProjects = await db
      .select()
      .from(projects)
      .innerJoin(projectAssignments, eq(projects.id, projectAssignments.projectId))
      .where(eq(projectAssignments.userId, userId));

    return assignedProjects.map(result => result.projects);
  }

  async getAllProjectsWithAssignments(): Promise<Array<Project & { assignments: ProjectAssignment[] }>> {
    const projectsData = await db.select().from(projects).orderBy(projects.createdAt);
    const assignmentsData = await db.select().from(projectAssignments);

    return projectsData.map(project => ({
      ...project,
      assignments: assignmentsData.filter(assignment => assignment.projectId === project.id)
    }));
  }

  // Committee management
  async getAllCommittees(): Promise<Committee[]> {
    return await db.select().from(committees).orderBy(committees.createdAt);
  }

  async getCommittee(id: number): Promise<Committee | undefined> {
    const [committee] = await db.select().from(committees).where(eq(committees.id, id));
    return committee || undefined;
  }

  async createCommittee(committee: InsertCommittee): Promise<Committee> {
    const [newCommittee] = await db.insert(committees).values(committee).returning();
    return newCommittee;
  }

  async updateCommittee(id: number, updates: Partial<Committee>): Promise<Committee | undefined> {
    const [committee] = await db
      .update(committees)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(committees.id, id))
      .returning();
    return committee || undefined;
  }

  async deleteCommittee(id: number): Promise<boolean> {
    const result = await db.delete(committees).where(eq(committees.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  // Committee membership management
  async getUserCommittees(userId: string): Promise<Array<Committee & { membership: CommitteeMembership }>> {
    const userCommittees = await db
      .select()
      .from(committeeMemberships)
      .innerJoin(committees, eq(committeeMemberships.committeeId, committees.id))
      .where(eq(committeeMemberships.userId, userId));

    return userCommittees.map(result => ({
      ...result.committees,
      membership: result.committee_memberships
    }));
  }

  async getCommitteeMembers(committeeId: number): Promise<Array<User & { membership: CommitteeMembership }>> {
    const members = await db
      .select()
      .from(committeeMemberships)
      .innerJoin(users, eq(committeeMemberships.userId, users.id))
      .where(eq(committeeMemberships.committeeId, committeeId));

    return members.map(result => ({
      ...result.users,
      membership: result.committee_memberships
    }));
  }

  async addUserToCommittee(membership: InsertCommitteeMembership): Promise<CommitteeMembership> {
    const [newMembership] = await db.insert(committeeMemberships).values(membership).returning();
    return newMembership;
  }

  async updateCommitteeMembership(id: number, updates: Partial<CommitteeMembership>): Promise<CommitteeMembership | undefined> {
    const [membership] = await db
      .update(committeeMemberships)
      .set(updates)
      .where(eq(committeeMemberships.id, id))
      .returning();
    return membership || undefined;
  }

  async removeUserFromCommittee(userId: string, committeeId: number): Promise<boolean> {
    const result = await db
      .delete(committeeMemberships)
      .where(and(eq(committeeMemberships.userId, userId), eq(committeeMemberships.committeeId, committeeId)));
    return (result.rowCount ?? 0) > 0;
  }

  async isUserCommitteeMember(userId: string, committeeId: number): Promise<boolean> {
    const [membership] = await db
      .select()
      .from(committeeMemberships)
      .where(and(eq(committeeMemberships.userId, userId), eq(committeeMemberships.committeeId, committeeId)));
    return !!membership;
  }

  // Notifications & Celebrations
  async getUserNotifications(userId: string): Promise<Notification[]> {
    try {
      return await db.select().from(notifications).where(eq(notifications.userId, userId)).orderBy(desc(notifications.createdAt));
    } catch (error) {
      console.error('Failed to get user notifications:', error);
      return [];
    }
  }

  async createNotification(notification: InsertNotification): Promise<Notification> {
    try {
      const [createdNotification] = await db
        .insert(notifications)
        .values(notification)
        .returning();
      return createdNotification;
    } catch (error) {
      console.error('Failed to create notification:', error);
      throw error;
    }
  }

  async markNotificationRead(id: number): Promise<boolean> {
    try {
      const result = await db
        .update(notifications)
        .set({ isRead: true })
        .where(eq(notifications.id, id));
      return (result.rowCount ?? 0) > 0;
    } catch (error) {
      console.error('Failed to mark notification as read:', error);
      return false;
    }
  }

  async deleteNotification(id: number): Promise<boolean> {
    try {
      const result = await db
        .delete(notifications)
        .where(eq(notifications.id, id));
      return (result.rowCount ?? 0) > 0;
    } catch (error) {
      console.error('Failed to delete notification:', error);
      return false;
    }
  }

  async createCelebration(userId: string, taskId: number, message: string): Promise<Notification> {
    const celebrationEmojis = ["🎉", "🌟", "🎊", "🥳", "🏆", "✨", "👏", "💪"];
    const randomEmoji = celebrationEmojis[Math.floor(Math.random() * celebrationEmojis.length)];
    
    return this.createNotification({
      userId,
      type: "celebration",
      title: `${randomEmoji} Task Completed!`,
      message: `Thanks for completing your task! ${message}`,
      isRead: false,
      relatedType: "task",
      relatedId: taskId,
      celebrationData: {
        emoji: randomEmoji,
        achievementType: "task_completion",
        taskId,
        completedAt: new Date().toISOString()
      }
    });
  }

  // Announcements
  async getAllAnnouncements(): Promise<any[]> {
    const result = await db.select().from(announcements).orderBy(desc(announcements.createdAt));
    return result;
  }

  async createAnnouncement(announcement: any): Promise<any> {
    const [result] = await db.insert(announcements).values(announcement).returning();
    return result;
  }

  async updateAnnouncement(id: number, updates: any): Promise<any | undefined> {
    const [result] = await db.update(announcements)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(announcements.id, id))
      .returning();
    return result;
  }

  async deleteAnnouncement(id: number): Promise<boolean> {
    const result = await db.delete(announcements).where(eq(announcements.id, id));
    return result.rowCount! > 0;
  }

  // Consolidated notification methods (removing duplicates)
  async markNotificationAsRead(notificationId: number): Promise<boolean> {
    try {
      const result = await db
        .update(notifications)
        .set({ isRead: true })
        .where(eq(notifications.id, notificationId));
      return (result.rowCount ?? 0) > 0;
    } catch (error) {
      console.error("Error marking notification as read:", error);
      return false;
    }
  }

  async markAllNotificationsAsRead(userId: string): Promise<boolean> {
    try {
      const result = await db
        .update(notifications)
        .set({ isRead: true })
        .where(and(eq(notifications.userId, userId), eq(notifications.isRead, false)));
      return (result.rowCount ?? 0) > 0;
    } catch (error) {
      console.error("Error marking all notifications as read:", error);
      return false;
    }
  }



  async addProjectAssignment(assignment: { projectId: number; userId: string; role: string }): Promise<any> {
    try {
      const [newAssignment] = await db
        .insert(projectAssignments)
        .values({
          projectId: assignment.projectId,
          userId: assignment.userId,
          role: assignment.role,
          assignedAt: new Date()
        })
        .returning();
      
      return newAssignment;
    } catch (error) {
      console.error('Error adding project assignment:', error);
      return null;
    }
  }

  async removeProjectAssignment(projectId: number, userId: string): Promise<boolean> {
    try {
      const result = await db
        .delete(projectAssignments)
        .where(and(
          eq(projectAssignments.projectId, projectId),
          eq(projectAssignments.userId, userId)
        ));
      
      return (result.rowCount ?? 0) > 0;
    } catch (error) {
      console.error('Error removing project assignment:', error);
      return false;
    }
  }

  async updateProjectAssignment(projectId: number, userId: string, updates: { role: string }): Promise<any> {
    try {
      const [updatedAssignment] = await db
        .update(projectAssignments)
        .set({ role: updates.role })
        .where(and(
          eq(projectAssignments.projectId, projectId),
          eq(projectAssignments.userId, userId)
        ))
        .returning();
      
      return updatedAssignment;
    } catch (error) {
      console.error('Error updating project assignment:', error);
      return null;
    }
  }

  async initialize(): Promise<void> {
    try {
      console.log('Initializing database storage...');

      // Test database connection
      await this.testConnection();

      // Check and add missing sender column if needed
      try {
        await db.execute(sql`SELECT sender FROM messages LIMIT 1`);
        console.log('Sender column exists');
      } catch (error) {
        console.log('Adding missing sender column to messages table...');
        try {
          await db.execute(sql`ALTER TABLE messages ADD COLUMN sender TEXT DEFAULT 'Unknown User'`);
          console.log('Sender column added successfully');
        } catch (alterError) {
          console.log('Could not add sender column, will use fallback queries');
        }
      }

      console.log('Database storage initialized successfully');
    } catch (error) {
      console.error('Failed to initialize database storage:', error);
      throw error;
    }
  }

  // Suggestions Portal methods
  async getAllSuggestions(): Promise<Suggestion[]> {
    try {
      const result = await db.select().from(suggestions).orderBy(suggestions.createdAt);
      return result as Suggestion[];
    } catch (error) {
      console.error('Error fetching suggestions:', error);
      return [];
    }
  }

  async getSuggestion(id: number): Promise<Suggestion | undefined> {
    try {
      const result = await db.select().from(suggestions).where(eq(suggestions.id, id)).limit(1);
      return result[0] as Suggestion | undefined;
    } catch (error) {
      console.error('Error fetching suggestion:', error);
      return undefined;
    }
  }

  async createSuggestion(suggestion: InsertSuggestion): Promise<Suggestion> {
    try {
      const result = await db.insert(suggestions).values(suggestion).returning();
      return result[0] as Suggestion;
    } catch (error) {
      console.error('Error creating suggestion:', error);
      throw error;
    }
  }

  async updateSuggestion(id: number, updates: Partial<Suggestion>): Promise<Suggestion | undefined> {
    try {
      const result = await db.update(suggestions)
        .set({ ...updates, updatedAt: new Date() })
        .where(eq(suggestions.id, id))
        .returning();
      return result[0] as Suggestion | undefined;
    } catch (error) {
      console.error('Error updating suggestion:', error);
      return undefined;
    }
  }

  async deleteSuggestion(id: number): Promise<boolean> {
    try {
      // First delete all responses
      await db.delete(suggestionResponses).where(eq(suggestionResponses.suggestionId, id));
      // Then delete the suggestion
      const result = await db.delete(suggestions).where(eq(suggestions.id, id));
      return true;
    } catch (error) {
      console.error('Error deleting suggestion:', error);
      return false;
    }
  }

  async upvoteSuggestion(id: number): Promise<boolean> {
    try {
      await db.update(suggestions)
        .set({ upvotes: sql`${suggestions.upvotes} + 1` })
        .where(eq(suggestions.id, id));
      return true;
    } catch (error) {
      console.error('Error upvoting suggestion:', error);
      return false;
    }
  }

  // Suggestion responses
  async getSuggestionResponses(suggestionId: number): Promise<SuggestionResponse[]> {
    try {
      const result = await db.select().from(suggestionResponses)
        .where(eq(suggestionResponses.suggestionId, suggestionId))
        .orderBy(suggestionResponses.createdAt);
      return result as SuggestionResponse[];
    } catch (error) {
      console.error('Error fetching suggestion responses:', error);
      return [];
    }
  }

  async createSuggestionResponse(response: InsertSuggestionResponse): Promise<SuggestionResponse> {
    try {
      const result = await db.insert(suggestionResponses).values(response).returning();
      return result[0] as SuggestionResponse;
    } catch (error) {
      console.error('Error creating suggestion response:', error);
      throw error;
    }
  }

  async deleteSuggestionResponse(id: number): Promise<boolean> {
    try {
      await db.delete(suggestionResponses).where(eq(suggestionResponses.id, id));
      return true;
    } catch (error) {
      console.error('Error deleting suggestion response:', error);
      return false;
    }
  }

  // Messaging System methods
  async getUserConversations(userId: string): Promise<any[]> {
    try {
      console.log(`[DB] Getting conversations for user: ${userId}`);
      
      // Get all conversations where the user is a participant
      const userConversations = await db
        .select({
          id: conversations.id,
          type: conversations.type,
          name: conversations.name,
          createdAt: conversations.createdAt,
          lastReadAt: conversationParticipants.lastReadAt,
          joinedAt: conversationParticipants.joinedAt,
        })
        .from(conversations)
        .innerJoin(conversationParticipants, eq(conversations.id, conversationParticipants.conversationId))
        .where(eq(conversationParticipants.userId, userId))
        .orderBy(conversations.createdAt);

      console.log(`[DB] Found ${userConversations.length} conversations for user ${userId}`);

      // For each conversation, get additional metadata
      const enrichedConversations = await Promise.all(
        userConversations.map(async (conv) => {
          // Get member count
          const memberCount = await db
            .select({ count: sql<number>`count(*)` })
            .from(conversationParticipants)
            .where(eq(conversationParticipants.conversationId, conv.id));

          // Get last message
          const lastMessage = await db
            .select({
              id: messages.id,
              content: messages.content,
              createdAt: messages.createdAt,
              sender: messages.sender,
              userId: messages.userId,
            })
            .from(messages)
            .where(eq(messages.conversationId, conv.id))
            .orderBy(messages.createdAt)
            .limit(1);

          return {
            ...conv,
            memberCount: memberCount[0]?.count || 0,
            lastMessage: lastMessage[0] || null,
          };
        })
      );

      return enrichedConversations;
    } catch (error) {
      console.error('Error getting user conversations:', error);
      return [];
    }
  }

  async createConversation(conversationData: {
    type: string;
    name?: string;
    createdBy: string;
  }, participants: string[]): Promise<any> {
    try {
      console.log(`[DB] Creating conversation:`, conversationData);
      
      // Create the conversation
      const [newConversation] = await db
        .insert(conversations)
        .values({
          type: conversationData.type,
          name: conversationData.name,
        })
        .returning();

      console.log(`[DB] Created conversation with ID: ${newConversation.id}`);

      // Add participants
      const participantData = participants.map(userId => ({
        conversationId: newConversation.id,
        userId: userId,
      }));

      await db.insert(conversationParticipants).values(participantData);

      console.log(`[DB] Added ${participants.length} participants to conversation ${newConversation.id}`);

      return {
        ...newConversation,
        memberCount: participants.length,
      };
    } catch (error) {
      console.error('Error creating conversation:', error);
      throw error;
    }
  }

  async getConversationMessages(conversationId: number, userId: string): Promise<any[]> {
    try {
      console.log(`[DB] Getting messages for conversation ${conversationId} and user ${userId}`);
      
      // First verify user has access to this conversation
      const hasAccess = await db
        .select()
        .from(conversationParticipants)
        .where(and(
          eq(conversationParticipants.conversationId, conversationId),
          eq(conversationParticipants.userId, userId)
        ))
        .limit(1);

      if (hasAccess.length === 0) {
        console.log(`[DB] User ${userId} does not have access to conversation ${conversationId}`);
        return [];
      }

      // Get messages with sender information
      const messages = await db
        .select({
          id: messages.id,
          conversationId: messages.conversationId,
          userId: messages.userId,
          senderId: messages.senderId,
          content: messages.content,
          sender: messages.sender,
          contextType: messages.contextType,
          contextId: messages.contextId,
          createdAt: messages.createdAt,
          updatedAt: messages.updatedAt,
          editedAt: messages.editedAt,
          deletedAt: messages.deletedAt,
        })
        .from(messages)
        .where(and(
          eq(messages.conversationId, conversationId),
          isNull(messages.deletedAt)
        ))
        .orderBy(messages.createdAt);

      console.log(`[DB] Found ${messages.length} messages for conversation ${conversationId}`);
      return messages;
    } catch (error) {
      console.error('Error getting conversation messages:', error);
      return [];
    }
  }

  async addConversationMessage(messageData: {
    conversationId: number;
    userId: string;
    content: string;
    sender?: string;
    contextType?: string;
    contextId?: string;
    replyToMessageId?: number | null;
    replyToContent?: string | null;
    replyToSender?: string | null;
  }): Promise<any> {
    try {
      console.log(`[DB] Adding message to conversation ${messageData.conversationId}`);
      
      const [newMessage] = await db
        .insert(messages)
        .values({
          conversationId: messageData.conversationId,
          userId: messageData.userId,
          senderId: messageData.userId,
          content: messageData.content,
          sender: messageData.sender || 'Unknown User',
          contextType: messageData.contextType || 'direct',
          contextId: messageData.contextId,
          replyToMessageId: messageData.replyToMessageId,
          replyToContent: messageData.replyToContent,
          replyToSender: messageData.replyToSender,
        })
        .returning();

      console.log(`[DB] Created message with ID: ${newMessage.id}`);
      return newMessage;
    } catch (error) {
      console.error('Error adding conversation message:', error);
      throw error;
    }
  }

  async updateConversationMessage(messageId: number, userId: string, updates: {
    content?: string;
    editedAt?: Date;
  }): Promise<any> {
    try {
      console.log(`[DB] Updating message ${messageId} by user ${userId}`);
      
      const [updatedMessage] = await db
        .update(messages)
        .set({
          ...updates,
          editedAt: new Date(),
        })
        .where(and(
          eq(messages.id, messageId),
          eq(messages.userId, userId)
        ))
        .returning();

      return updatedMessage;
    } catch (error) {
      console.error('Error updating conversation message:', error);
      throw error;
    }
  }

  async deleteConversationMessage(messageId: number, userId: string): Promise<boolean> {
    try {
      console.log(`[DB] Deleting message ${messageId} by user ${userId}`);
      
      const result = await db
        .update(messages)
        .set({
          deletedAt: new Date(),
          deletedBy: userId,
        })
        .where(and(
          eq(messages.id, messageId),
          eq(messages.userId, userId)
        ));

      return (result.rowCount ?? 0) > 0;
    } catch (error) {
      console.error('Error deleting conversation message:', error);
      return false;
    }
  }

  // Message Like methods
  async likeMessage(messageId: number, userId: string, userName: string): Promise<MessageLike | null> {
    try {
      const [like] = await db
        .insert(messageLikes)
        .values({
          messageId,
          userId,
          userName,
        })
        .returning();
      
      return like;
    } catch (error: any) {
      if (error.code === '23505') { // Unique constraint violation
        return null; // Already liked
      }
      console.error('Error liking message:', error);
      throw error;
    }
  }

  async unlikeMessage(messageId: number, userId: string): Promise<boolean> {
    try {
      const result = await db
        .delete(messageLikes)
        .where(and(
          eq(messageLikes.messageId, messageId),
          eq(messageLikes.userId, userId)
        ));
      
      return (result.rowCount ?? 0) > 0;
    } catch (error) {
      console.error('Error unliking message:', error);
      return false;
    }
  }

  async getMessageLikes(messageId: number): Promise<MessageLike[]> {
    try {
      const likes = await db
        .select()
        .from(messageLikes)
        .where(eq(messageLikes.messageId, messageId))
        .orderBy(messageLikes.likedAt);
      
      return likes;
    } catch (error) {
      console.error('Error getting message likes:', error);
      return [];
    }
  }

  async hasUserLikedMessage(messageId: number, userId: string): Promise<boolean> {
    try {
      const [like] = await db
        .select()
        .from(messageLikes)
        .where(and(
          eq(messageLikes.messageId, messageId),
          eq(messageLikes.userId, userId)
        ))
        .limit(1);
      
      return !!like;
    } catch (error) {
      console.error('Error checking if user liked message:', error);
      return false;
    }
  }

  // Chat Message Like methods
  async likeChatMessage(messageId: number, userId: string, userName: string): Promise<ChatMessageLike | null> {
    try {
      const [like] = await db
        .insert(chatMessageLikes)
        .values({
          messageId,
          userId,
          userName,
        })
        .returning();
      
      return like;
    } catch (error: any) {
      if (error.code === '23505') { // Unique constraint violation
        return null; // Already liked
      }
      console.error('Error liking chat message:', error);
      throw error;
    }
  }

  async unlikeChatMessage(messageId: number, userId: string): Promise<boolean> {
    try {
      const result = await db
        .delete(chatMessageLikes)
        .where(and(
          eq(chatMessageLikes.messageId, messageId),
          eq(chatMessageLikes.userId, userId)
        ));
      
      return (result.rowCount ?? 0) > 0;
    } catch (error) {
      console.error('Error unliking chat message:', error);
      return false;
    }
  }

  async getChatMessageLikes(messageId: number): Promise<ChatMessageLike[]> {
    try {
      const likes = await db
        .select()
        .from(chatMessageLikes)
        .where(eq(chatMessageLikes.messageId, messageId))
        .orderBy(chatMessageLikes.likedAt);
      
      return likes;
    } catch (error) {
      console.error('Error getting chat message likes:', error);
      return [];
    }
  }

  async hasUserLikedChatMessage(messageId: number, userId: string): Promise<boolean> {
    try {
      const [like] = await db
        .select()
        .from(chatMessageLikes)
        .where(and(
          eq(chatMessageLikes.messageId, messageId),
          eq(chatMessageLikes.userId, userId)
        ))
        .limit(1);
      
      return !!like;
    } catch (error) {
      console.error('Error checking if user liked chat message:', error);
      return false;
    }
  }

  // Chat message methods for Socket.IO
  async createChatMessage(data: { channel: string; userId: string; userName: string; content: string }): Promise<any> {
    try {
      const [message] = await db
        .insert(chatMessages)
        .values({
          channel: data.channel,
          userId: data.userId,
          userName: data.userName,
          content: data.content,
          createdAt: new Date()
        })
        .returning();
      return message;
    } catch (error: any) {
      if (error.code === '23505') {
        // Retry with a small delay to avoid ID collision
        await new Promise(resolve => setTimeout(resolve, 10));
        const [message] = await db
          .insert(chatMessages)
          .values({
            channel: data.channel,
            userId: data.userId,
            userName: data.userName,
            content: data.content,
            createdAt: new Date()
          })
          .returning();
        return message;
      }
      throw error;
    }
  }

  async getChatMessages(channel: string, limit: number = 50): Promise<any[]> {
    return await db
      .select()
      .from(chatMessages)
      .where(eq(chatMessages.channel, channel))  // CRITICAL: Filter by channel field in chatMessages table
      .orderBy(desc(chatMessages.createdAt))
      .limit(limit);
  }

  async updateChatMessage(id: number, updates: { content: string }): Promise<void> {
    await db
      .update(chatMessages)
      .set({ 
        content: updates.content,
        editedAt: new Date()
      })
      .where(eq(chatMessages.id, id));
  }

  async deleteChatMessage(id: number): Promise<void> {
    await db.delete(chatMessages).where(eq(chatMessages.id, id));
  }

  async markChannelMessagesAsRead(userId: string, channel: string): Promise<void> {
    // Chat read tracking disabled - no database table
    console.log(`Chat read tracking not implemented for user ${userId} in channel ${channel}`);
  }

  // Shoutout methods
  async createShoutoutLog(log: {
    templateName: string;
    subject: string;
    message: string;
    recipientCount: number;
    sentAt: string;
    status: string;
    sentBy: string;
    successCount?: number;
    failureCount?: number;
  }): Promise<any> {
    // Store in memory as a simple fallback since there's no shoutout_logs table
    // This will work with the fallback storage system
    throw new Error('Database shoutout logging not implemented - using memory storage');
  }

  async getShoutoutHistory(): Promise<any[]> {
    // Fallback to memory storage for shoutout history
    throw new Error('Database shoutout history not implemented - using memory storage');
  }


  async getAllUsersActivitySummary(days: number = 30): Promise<{
    userId: string;
    email: string;
    firstName: string;
    lastName: string;
    totalActions: number;
    lastActive: Date | null;
    topSection: string;
  }[]> {
    const { userActivityLogs, users } = await import("@shared/schema");
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Get all users with their activity summary
    const userActivities = await db
      .select({
        userId: userActivityLogs.userId,
        email: users.email,
        firstName: users.firstName,
        lastName: users.lastName,
        activityCount: sql<number>`COUNT(${userActivityLogs.id})::int`,
        lastActive: sql<Date>`MAX(${userActivityLogs.createdAt})`,
        topSection: sql<string>`
          COALESCE(
            (SELECT ${userActivityLogs.section} 
             FROM ${userActivityLogs} u2 
             WHERE u2.user_id = ${users.id} 
             AND u2.created_at >= ${startDate}
             GROUP BY ${userActivityLogs.section} 
             ORDER BY COUNT(*) DESC 
             LIMIT 1), 
            'none'
          )
        `
      })
      .from(users)
      .leftJoin(userActivityLogs, and(
        eq(users.id, userActivityLogs.userId),
        sql`${userActivityLogs.createdAt} >= ${startDate}`
      ))
      .groupBy(users.id, users.email, users.firstName, users.lastName);

    return userActivities.map(user => ({
      userId: user.userId || '',
      email: user.email || '',
      firstName: user.firstName || '',
      lastName: user.lastName || '',
      totalActions: user.activityCount || 0,
      lastActive: user.lastActive,
      topSection: user.topSection || 'none'
    }));
  }

  // User Activity Tracking methods
  async logUserActivity(activity: InsertUserActivityLog): Promise<UserActivityLog> {
    const [log] = await db
      .insert(userActivityLogs)
      .values(activity)
      .returning();
    return log;
  }

  async getUserActivityStats(userId: string, days: number = 30): Promise<{
    totalActions: number;
    sectionsUsed: string[];
    topActions: { action: string; count: number }[];
    dailyActivity: { date: string; count: number }[];
  }> {
    const sinceDate = new Date();
    sinceDate.setDate(sinceDate.getDate() - days);

    // Get total actions
    const totalResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(userActivityLogs)
      .where(and(
        eq(userActivityLogs.userId, userId),
        gte(userActivityLogs.createdAt, sinceDate)
      ));

    // Get sections used
    const sectionsResult = await db
      .select({ section: userActivityLogs.section })
      .from(userActivityLogs)
      .where(and(
        eq(userActivityLogs.userId, userId),
        gte(userActivityLogs.createdAt, sinceDate)
      ))
      .groupBy(userActivityLogs.section);

    // Get top actions
    const actionsResult = await db
      .select({
        action: userActivityLogs.action,
        count: sql<number>`count(*)`
      })
      .from(userActivityLogs)
      .where(and(
        eq(userActivityLogs.userId, userId),
        gte(userActivityLogs.createdAt, sinceDate)
      ))
      .groupBy(userActivityLogs.action)
      .orderBy(desc(sql`count(*)`))
      .limit(5);

    // Get daily activity
    const dailyResult = await db
      .select({
        date: sql<string>`date(created_at)`,
        count: sql<number>`count(*)`
      })
      .from(userActivityLogs)
      .where(and(
        eq(userActivityLogs.userId, userId),
        gte(userActivityLogs.createdAt, sinceDate)
      ))
      .groupBy(sql`date(created_at)`)
      .orderBy(sql`date(created_at)`);

    return {
      totalActions: totalResult[0]?.count || 0,
      sectionsUsed: sectionsResult.map(r => r.section),
      topActions: actionsResult.map(r => ({ action: r.action, count: r.count })),
      dailyActivity: dailyResult.map(r => ({ date: r.date, count: r.count }))
    };
  }



  // Wishlist Suggestions
  async getAllWishlistSuggestions(): Promise<WishlistSuggestion[]> {
    const results = await db.select()
      .from(wishlistSuggestions)
      .orderBy(desc(wishlistSuggestions.createdAt));
    return results;
  }

  async getWishlistSuggestion(id: number): Promise<WishlistSuggestion | undefined> {
    const [result] = await db.select()
      .from(wishlistSuggestions)
      .where(eq(wishlistSuggestions.id, id));
    return result || undefined;
  }

  async createWishlistSuggestion(suggestion: InsertWishlistSuggestion): Promise<WishlistSuggestion> {
    const [result] = await db.insert(wishlistSuggestions)
      .values(suggestion)
      .returning();
    return result;
  }

  async updateWishlistSuggestion(id: number, updates: Partial<WishlistSuggestion>): Promise<WishlistSuggestion | undefined> {
    const [result] = await db.update(wishlistSuggestions)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(wishlistSuggestions.id, id))
      .returning();
    return result || undefined;
  }

  async deleteWishlistSuggestion(id: number): Promise<boolean> {
    const result = await db.delete(wishlistSuggestions)
      .where(eq(wishlistSuggestions.id, id));
    return result.rowCount > 0;
  }

  async getRecentWishlistActivity(limit: number = 10): Promise<WishlistSuggestion[]> {
    const results = await db.select()
      .from(wishlistSuggestions)
      .where(or(
        eq(wishlistSuggestions.status, 'approved'),
        eq(wishlistSuggestions.status, 'added')
      ))
      .orderBy(desc(wishlistSuggestions.updatedAt))
      .limit(limit);
    return results;
  }

  // Meeting Management - Enhanced methods for comprehensive meeting workflow
  async getMeeting(id: number): Promise<Meeting | undefined> {
    const [result] = await db.select()
      .from(meetings)
      .where(eq(meetings.id, id));
    return result || undefined;
  }

  async getAgendaItemsByMeeting(meetingId: number): Promise<AgendaItem[]> {
    const results = await db.select()
      .from(agendaItems)
      .where(eq(agendaItems.meetingId, meetingId))
      .orderBy(agendaItems.submittedAt);
    return results;
  }

  async getProjectsForReview(): Promise<Project[]> {
    const results = await db.select()
      .from(projects)
      .where(and(
        eq(projects.reviewInNextMeeting, true),
        ne(projects.status, 'completed'),
        ne(projects.status, 'archived')
      ))
      .orderBy(desc(projects.priority), desc(projects.createdAt));
    return results;
  }

  async createCompiledAgenda(agenda: any): Promise<number> {
    const [result] = await db.insert(compiledAgendas)
      .values(agenda)
      .returning({ id: compiledAgendas.id });
    return result.id;
  }

  async getCompiledAgenda(id: number): Promise<any | undefined> {
    const [result] = await db.select()
      .from(compiledAgendas)
      .where(eq(compiledAgendas.id, id));
    return result || undefined;
  }

  async createAgendaSection(section: any): Promise<number> {
    const [result] = await db.insert(agendaSections)
      .values(section)
      .returning({ id: agendaSections.id });
    return result.id;
  }

  async getAgendaSectionsByCompiledAgenda(compiledAgendaId: number): Promise<any[]> {
    const results = await db.select()
      .from(agendaSections)
      .where(eq(agendaSections.compiledAgendaId, compiledAgendaId))
      .orderBy(agendaSections.orderIndex);
    return results;
  }

  async updateMeetingStatus(id: number, status: string): Promise<Meeting | undefined> {
    const [result] = await db.update(meetings)
      .set({ status })
      .where(eq(meetings.id, id))
      .returning();
    return result || undefined;
  }

  async finalizeCompiledAgenda(id: number, finalizedBy: string): Promise<any | undefined> {
    const [result] = await db.update(compiledAgendas)
      .set({ 
        status: 'finalized',
        finalizedAt: new Date()
      })
      .where(eq(compiledAgendas.id, id))
      .returning();
    return result || undefined;
  }

  async getCompiledAgendasByMeeting(meetingId: number): Promise<any[]> {
    const results = await db.select()
      .from(compiledAgendas)
      .where(eq(compiledAgendas.meetingId, meetingId))
      .orderBy(desc(compiledAgendas.compiledAt));
    return results;
  }

  // Document Management Methods
  async getAllDocuments(): Promise<Document[]> {
    return await db.select()
      .from(documents)
      .where(eq(documents.isActive, true))
      .orderBy(desc(documents.createdAt));
  }

  async getDocument(id: number): Promise<Document | undefined> {
    const [result] = await db.select()
      .from(documents)
      .where(and(eq(documents.id, id), eq(documents.isActive, true)));
    return result || undefined;
  }

  async getDocumentsForUser(userId: string): Promise<Document[]> {
    // Check if user has confidential documents access
    const user = await this.getUserById(userId);
    const hasConfidentialAccess = user?.permissions?.includes("DOCUMENTS_CONFIDENTIAL") || false;

    // Get documents that the user has permissions for or that they uploaded
    const results = await db.select({
      id: documents.id,
      title: documents.title,
      description: documents.description,
      fileName: documents.fileName,
      originalName: documents.originalName,
      filePath: documents.filePath,
      fileSize: documents.fileSize,
      mimeType: documents.mimeType,
      category: documents.category,
      isActive: documents.isActive,
      uploadedBy: documents.uploadedBy,
      uploadedByName: documents.uploadedByName,
      createdAt: documents.createdAt,
      updatedAt: documents.updatedAt
    })
    .from(documents)
    .leftJoin(documentPermissions, and(
      eq(documentPermissions.documentId, documents.id),
      eq(documentPermissions.userId, userId),
      eq(documentPermissions.isActive, true)
    ))
    .where(and(
      eq(documents.isActive, true),
      // Exclude confidential documents unless user has special permission
      hasConfidentialAccess ? undefined : ne(documents.category, "confidential"),
      or(
        eq(documents.uploadedBy, userId), // User uploaded this document
        isNotNull(documentPermissions.id) // User has explicit permission
      )
    ))
    .orderBy(desc(documents.createdAt));

    return results;
  }

  async createDocument(insertDocument: InsertDocument): Promise<Document> {
    const [result] = await db.insert(documents)
      .values(insertDocument)
      .returning();
    return result;
  }

  async updateDocument(id: number, updates: Partial<Document>): Promise<Document | undefined> {
    const [result] = await db.update(documents)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(documents.id, id))
      .returning();
    return result || undefined;
  }

  async deleteDocument(id: number): Promise<boolean> {
    // Soft delete
    const result = await db.update(documents)
      .set({ isActive: false, updatedAt: new Date() })
      .where(eq(documents.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  // Document Permissions Methods
  async getDocumentPermissions(documentId: number): Promise<DocumentPermission[]> {
    return await db.select()
      .from(documentPermissions)
      .where(and(
        eq(documentPermissions.documentId, documentId),
        eq(documentPermissions.isActive, true)
      ))
      .orderBy(documentPermissions.grantedAt);
  }

  async getUserDocumentPermission(documentId: number, userId: string): Promise<DocumentPermission | undefined> {
    const [result] = await db.select()
      .from(documentPermissions)
      .where(and(
        eq(documentPermissions.documentId, documentId),
        eq(documentPermissions.userId, userId),
        eq(documentPermissions.isActive, true)
      ));
    return result || undefined;
  }

  async checkUserDocumentAccess(documentId: number, userId: string, permission: string): Promise<boolean> {
    // Check if user is the uploader
    const [document] = await db.select()
      .from(documents)
      .where(eq(documents.id, documentId));
    
    if (document && document.uploadedBy === userId) {
      return true; // Uploaders have full access
    }

    // Check explicit permissions
    const [userPermission] = await db.select()
      .from(documentPermissions)
      .where(and(
        eq(documentPermissions.documentId, documentId),
        eq(documentPermissions.userId, userId),
        eq(documentPermissions.isActive, true)
      ));

    if (!userPermission) return false;

    // Check if permission type allows the requested action
    const permissionHierarchy = ['view', 'download', 'edit', 'admin'];
    const userLevel = permissionHierarchy.indexOf(userPermission.permissionType);
    const requiredLevel = permissionHierarchy.indexOf(permission);
    
    return userLevel >= requiredLevel;
  }

  async grantDocumentPermission(insertPermission: InsertDocumentPermission): Promise<DocumentPermission> {
    const [result] = await db.insert(documentPermissions)
      .values(insertPermission)
      .returning();
    return result;
  }

  async revokeDocumentPermission(documentId: number, userId: string, permissionType: string): Promise<boolean> {
    const result = await db.update(documentPermissions)
      .set({ isActive: false })
      .where(and(
        eq(documentPermissions.documentId, documentId),
        eq(documentPermissions.userId, userId),
        eq(documentPermissions.permissionType, permissionType),
        eq(documentPermissions.isActive, true)
      ));
    return (result.rowCount ?? 0) > 0;
  }

  async updateDocumentPermission(id: number, updates: Partial<DocumentPermission>): Promise<DocumentPermission | undefined> {
    const [result] = await db.update(documentPermissions)
      .set(updates)
      .where(eq(documentPermissions.id, id))
      .returning();
    return result || undefined;
  }

  // Document Access Logging Methods
  async logDocumentAccess(insertAccess: InsertDocumentAccessLog): Promise<DocumentAccessLog> {
    const [result] = await db.insert(documentAccessLogs)
      .values(insertAccess)
      .returning();
    return result;
  }

  async getDocumentAccessLogs(documentId: number): Promise<DocumentAccessLog[]> {
    return await db.select()
      .from(documentAccessLogs)
      .where(eq(documentAccessLogs.documentId, documentId))
      .orderBy(desc(documentAccessLogs.accessedAt));
  }

  // Event Request Management Methods
  async getAllEventRequests(): Promise<EventRequest[]> {
    return await db.select().from(eventRequests).orderBy(desc(eventRequests.createdAt));
  }

  async getEventRequest(id: number): Promise<EventRequest | undefined> {
    const [result] = await db.select()
      .from(eventRequests)
      .where(eq(eventRequests.id, id));
    return result || undefined;
  }

  async createEventRequest(insertEventRequest: InsertEventRequest): Promise<EventRequest> {
    const [result] = await db.insert(eventRequests)
      .values({
        ...insertEventRequest,
        updatedAt: new Date()
      })
      .returning();
    return result;
  }

  async updateEventRequest(id: number, updates: Partial<EventRequest>): Promise<EventRequest | undefined> {
    const [result] = await db.update(eventRequests)
      .set({
        ...updates,
        updatedAt: new Date()
      })
      .where(eq(eventRequests.id, id))
      .returning();
    return result || undefined;
  }

  async deleteEventRequest(id: number): Promise<boolean> {
    const result = await db.delete(eventRequests)
      .where(eq(eventRequests.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  async getEventRequestsByStatus(status: string): Promise<EventRequest[]> {
    return await db.select()
      .from(eventRequests)
      .where(eq(eventRequests.status, status))
      .orderBy(desc(eventRequests.createdAt));
  }

  async getEventRequestsByOrganization(organizationName: string): Promise<EventRequest[]> {
    return await db.select()
      .from(eventRequests)
      .where(ilike(eventRequests.organizationName, `%${organizationName}%`))
      .orderBy(desc(eventRequests.createdAt));
  }

  async checkOrganizationDuplicates(organizationName: string): Promise<{ exists: boolean; matches: Organization[] }> {
    const matches = await db.select()
      .from(organizations)
      .where(or(
        ilike(organizations.name, `%${organizationName}%`),
        sql`${organizations.alternateNames} && ARRAY[${organizationName}]::text[]`
      ));
    
    return {
      exists: matches.length > 0,
      matches
    };
  }

  // Organization Management Methods
  async getAllOrganizations(): Promise<Organization[]> {
    return await db.select().from(organizations).orderBy(organizations.name);
  }

  async getOrganization(id: number): Promise<Organization | undefined> {
    const [result] = await db.select()
      .from(organizations)
      .where(eq(organizations.id, id));
    return result || undefined;
  }

  async createOrganization(insertOrganization: InsertOrganization): Promise<Organization> {
    const [result] = await db.insert(organizations)
      .values({
        ...insertOrganization,
        updatedAt: new Date()
      })
      .returning();
    return result;
  }

  async updateOrganization(id: number, updates: Partial<Organization>): Promise<Organization | undefined> {
    const [result] = await db.update(organizations)
      .set({
        ...updates,
        updatedAt: new Date()
      })
      .where(eq(organizations.id, id))
      .returning();
    return result || undefined;
  }

  async deleteOrganization(id: number): Promise<boolean> {
    const result = await db.delete(organizations)
      .where(eq(organizations.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  async searchOrganizations(query: string): Promise<Organization[]> {
    return await db.select()
      .from(organizations)
      .where(or(
        ilike(organizations.name, `%${query}%`),
        sql`${organizations.alternateNames} && ARRAY[${query}]::text[]`
      ))
      .orderBy(organizations.name);
  }

  // Event volunteers methods
  async getAllEventVolunteers(): Promise<EventVolunteer[]> {
    return await db.select()
      .from(eventVolunteers)
      .orderBy(desc(eventVolunteers.signedUpAt));
  }

  async getEventVolunteersByEventId(eventRequestId: number): Promise<EventVolunteer[]> {
    return await db.select()
      .from(eventVolunteers)
      .where(eq(eventVolunteers.eventRequestId, eventRequestId))
      .orderBy(eventVolunteers.role, eventVolunteers.signedUpAt);
  }

  async getEventVolunteersByUserId(userId: string): Promise<EventVolunteer[]> {
    return await db.select()
      .from(eventVolunteers)
      .where(eq(eventVolunteers.volunteerUserId, userId))
      .orderBy(desc(eventVolunteers.signedUpAt));
  }

  async createEventVolunteer(volunteer: InsertEventVolunteer): Promise<EventVolunteer> {
    const [result] = await db.insert(eventVolunteers)
      .values({
        ...volunteer,
        updatedAt: new Date()
      })
      .returning();
    return result;
  }

  async updateEventVolunteer(id: number, updates: Partial<EventVolunteer>): Promise<EventVolunteer | undefined> {
    const [result] = await db.update(eventVolunteers)
      .set({
        ...updates,
        updatedAt: new Date()
      })
      .where(eq(eventVolunteers.id, id))
      .returning();
    return result || undefined;
  }

  async deleteEventVolunteer(id: number): Promise<boolean> {
    const result = await db.delete(eventVolunteers)
      .where(eq(eventVolunteers.id, id));
    return (result.rowCount ?? 0) > 0;
  }
}