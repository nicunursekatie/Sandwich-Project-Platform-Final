import { relations } from "drizzle-orm/relations";
import { chatMessages, chatMessageReads, documents, documentAccessLogs, users, googleSheets, messages, kudosTracking, messageRecipients, notificationAbTests, messageLikes, notifications, notificationHistory, notificationPreferences, conversations, userNotificationPatterns, chatMessageLikes, documentPermissions, recipients, recipientTspContacts, streamMessages, streamThreads, eventCollaborationComments, eventCollaborationCommentLikes, coolerTypes, coolerInventory, teamBoardItems, teamBoardComments, availabilitySlots, holdingZoneCategories, resources, resourceTagAssignments, resourceTags, userResourceFavorites, notificationActionHistory, eventRequests, eventFieldLocks, eventEditRevisions, meetings, meetingProjects, projects, teamBoardItemLikes, projectAssignments, teamBoardAssignments, projectTasks, taskAssignments, alertRequests, conversationParticipants } from "./schema";

export const chatMessageReadsRelations = relations(chatMessageReads, ({one}) => ({
	chatMessage: one(chatMessages, {
		fields: [chatMessageReads.messageId],
		references: [chatMessages.id]
	}),
}));

export const chatMessagesRelations = relations(chatMessages, ({many}) => ({
	chatMessageReads: many(chatMessageReads),
	chatMessageLikes: many(chatMessageLikes),
}));

export const documentAccessLogsRelations = relations(documentAccessLogs, ({one}) => ({
	document: one(documents, {
		fields: [documentAccessLogs.documentId],
		references: [documents.id]
	}),
}));

export const documentsRelations = relations(documents, ({many}) => ({
	documentAccessLogs: many(documentAccessLogs),
	documentPermissions: many(documentPermissions),
	resources: many(resources),
}));

export const googleSheetsRelations = relations(googleSheets, ({one}) => ({
	user: one(users, {
		fields: [googleSheets.createdBy],
		references: [users.id]
	}),
}));

export const usersRelations = relations(users, ({many}) => ({
	googleSheets: many(googleSheets),
	notificationAbTests: many(notificationAbTests),
	notificationHistories: many(notificationHistory),
	notificationPreferences: many(notificationPreferences),
	userNotificationPatterns: many(userNotificationPatterns),
	documentPermissions: many(documentPermissions),
	recipientTspContacts: many(recipientTspContacts),
	eventCollaborationCommentLikes: many(eventCollaborationCommentLikes),
	availabilitySlots: many(availabilitySlots),
	userResourceFavorites: many(userResourceFavorites),
	notificationActionHistories_userId: many(notificationActionHistory, {
		relationName: "notificationActionHistory_userId_users_id"
	}),
	notificationActionHistories_undoneBy: many(notificationActionHistory, {
		relationName: "notificationActionHistory_undoneBy_users_id"
	}),
	eventFieldLocks: many(eventFieldLocks),
	eventCollaborationComments: many(eventCollaborationComments),
	eventEditRevisions: many(eventEditRevisions),
	alertRequests_userId: many(alertRequests, {
		relationName: "alertRequests_userId_users_id"
	}),
	alertRequests_reviewedBy: many(alertRequests, {
		relationName: "alertRequests_reviewedBy_users_id"
	}),
}));

export const kudosTrackingRelations = relations(kudosTracking, ({one}) => ({
	message: one(messages, {
		fields: [kudosTracking.messageId],
		references: [messages.id]
	}),
}));

export const messagesRelations = relations(messages, ({one, many}) => ({
	kudosTrackings: many(kudosTracking),
	messageRecipients: many(messageRecipients),
	messageLikes: many(messageLikes),
	conversation: one(conversations, {
		fields: [messages.conversationId],
		references: [conversations.id]
	}),
}));

export const messageRecipientsRelations = relations(messageRecipients, ({one}) => ({
	message: one(messages, {
		fields: [messageRecipients.messageId],
		references: [messages.id]
	}),
}));

export const notificationAbTestsRelations = relations(notificationAbTests, ({one}) => ({
	user: one(users, {
		fields: [notificationAbTests.createdBy],
		references: [users.id]
	}),
}));

export const messageLikesRelations = relations(messageLikes, ({one}) => ({
	message: one(messages, {
		fields: [messageLikes.messageId],
		references: [messages.id]
	}),
}));

export const notificationHistoryRelations = relations(notificationHistory, ({one}) => ({
	notification: one(notifications, {
		fields: [notificationHistory.notificationId],
		references: [notifications.id]
	}),
	user: one(users, {
		fields: [notificationHistory.userId],
		references: [users.id]
	}),
}));

export const notificationsRelations = relations(notifications, ({many}) => ({
	notificationHistories: many(notificationHistory),
	notificationActionHistories: many(notificationActionHistory),
}));

export const notificationPreferencesRelations = relations(notificationPreferences, ({one}) => ({
	user: one(users, {
		fields: [notificationPreferences.userId],
		references: [users.id]
	}),
}));

export const conversationsRelations = relations(conversations, ({many}) => ({
	messages: many(messages),
	conversationParticipants: many(conversationParticipants),
}));

export const userNotificationPatternsRelations = relations(userNotificationPatterns, ({one}) => ({
	user: one(users, {
		fields: [userNotificationPatterns.userId],
		references: [users.id]
	}),
}));

export const chatMessageLikesRelations = relations(chatMessageLikes, ({one}) => ({
	chatMessage: one(chatMessages, {
		fields: [chatMessageLikes.messageId],
		references: [chatMessages.id]
	}),
}));

export const documentPermissionsRelations = relations(documentPermissions, ({one}) => ({
	document: one(documents, {
		fields: [documentPermissions.documentId],
		references: [documents.id]
	}),
	user: one(users, {
		fields: [documentPermissions.userId],
		references: [users.id]
	}),
}));

export const recipientTspContactsRelations = relations(recipientTspContacts, ({one}) => ({
	recipient: one(recipients, {
		fields: [recipientTspContacts.recipientId],
		references: [recipients.id]
	}),
	user: one(users, {
		fields: [recipientTspContacts.userId],
		references: [users.id]
	}),
}));

export const recipientsRelations = relations(recipients, ({many}) => ({
	recipientTspContacts: many(recipientTspContacts),
}));

export const streamThreadsRelations = relations(streamThreads, ({one}) => ({
	streamMessage: one(streamMessages, {
		fields: [streamThreads.parentMessageId],
		references: [streamMessages.id]
	}),
}));

export const streamMessagesRelations = relations(streamMessages, ({many}) => ({
	streamThreads: many(streamThreads),
}));

export const eventCollaborationCommentLikesRelations = relations(eventCollaborationCommentLikes, ({one}) => ({
	eventCollaborationComment: one(eventCollaborationComments, {
		fields: [eventCollaborationCommentLikes.commentId],
		references: [eventCollaborationComments.id]
	}),
	user: one(users, {
		fields: [eventCollaborationCommentLikes.userId],
		references: [users.id]
	}),
}));

export const eventCollaborationCommentsRelations = relations(eventCollaborationComments, ({one, many}) => ({
	eventCollaborationCommentLikes: many(eventCollaborationCommentLikes),
	eventRequest: one(eventRequests, {
		fields: [eventCollaborationComments.eventRequestId],
		references: [eventRequests.id]
	}),
	user: one(users, {
		fields: [eventCollaborationComments.userId],
		references: [users.id]
	}),
}));

export const coolerInventoryRelations = relations(coolerInventory, ({one}) => ({
	coolerType: one(coolerTypes, {
		fields: [coolerInventory.coolerTypeId],
		references: [coolerTypes.id]
	}),
}));

export const coolerTypesRelations = relations(coolerTypes, ({many}) => ({
	coolerInventories: many(coolerInventory),
}));

export const teamBoardCommentsRelations = relations(teamBoardComments, ({one}) => ({
	teamBoardItem: one(teamBoardItems, {
		fields: [teamBoardComments.itemId],
		references: [teamBoardItems.id]
	}),
}));

export const teamBoardItemsRelations = relations(teamBoardItems, ({one, many}) => ({
	teamBoardComments: many(teamBoardComments),
	holdingZoneCategory: one(holdingZoneCategories, {
		fields: [teamBoardItems.categoryId],
		references: [holdingZoneCategories.id]
	}),
	teamBoardItemLikes: many(teamBoardItemLikes),
	teamBoardAssignments: many(teamBoardAssignments),
}));

export const availabilitySlotsRelations = relations(availabilitySlots, ({one}) => ({
	user: one(users, {
		fields: [availabilitySlots.userId],
		references: [users.id]
	}),
}));

export const holdingZoneCategoriesRelations = relations(holdingZoneCategories, ({many}) => ({
	teamBoardItems: many(teamBoardItems),
}));

export const resourceTagAssignmentsRelations = relations(resourceTagAssignments, ({one}) => ({
	resource: one(resources, {
		fields: [resourceTagAssignments.resourceId],
		references: [resources.id]
	}),
	resourceTag: one(resourceTags, {
		fields: [resourceTagAssignments.tagId],
		references: [resourceTags.id]
	}),
}));

export const resourcesRelations = relations(resources, ({one, many}) => ({
	resourceTagAssignments: many(resourceTagAssignments),
	document: one(documents, {
		fields: [resources.documentId],
		references: [documents.id]
	}),
	userResourceFavorites: many(userResourceFavorites),
}));

export const resourceTagsRelations = relations(resourceTags, ({many}) => ({
	resourceTagAssignments: many(resourceTagAssignments),
}));

export const userResourceFavoritesRelations = relations(userResourceFavorites, ({one}) => ({
	user: one(users, {
		fields: [userResourceFavorites.userId],
		references: [users.id]
	}),
	resource: one(resources, {
		fields: [userResourceFavorites.resourceId],
		references: [resources.id]
	}),
}));

export const notificationActionHistoryRelations = relations(notificationActionHistory, ({one}) => ({
	notification: one(notifications, {
		fields: [notificationActionHistory.notificationId],
		references: [notifications.id]
	}),
	user_userId: one(users, {
		fields: [notificationActionHistory.userId],
		references: [users.id],
		relationName: "notificationActionHistory_userId_users_id"
	}),
	user_undoneBy: one(users, {
		fields: [notificationActionHistory.undoneBy],
		references: [users.id],
		relationName: "notificationActionHistory_undoneBy_users_id"
	}),
}));

export const eventFieldLocksRelations = relations(eventFieldLocks, ({one}) => ({
	eventRequest: one(eventRequests, {
		fields: [eventFieldLocks.eventRequestId],
		references: [eventRequests.id]
	}),
	user: one(users, {
		fields: [eventFieldLocks.lockedBy],
		references: [users.id]
	}),
}));

export const eventRequestsRelations = relations(eventRequests, ({many}) => ({
	eventFieldLocks: many(eventFieldLocks),
	eventCollaborationComments: many(eventCollaborationComments),
	eventEditRevisions: many(eventEditRevisions),
}));

export const eventEditRevisionsRelations = relations(eventEditRevisions, ({one}) => ({
	eventRequest: one(eventRequests, {
		fields: [eventEditRevisions.eventRequestId],
		references: [eventRequests.id]
	}),
	user: one(users, {
		fields: [eventEditRevisions.changedBy],
		references: [users.id]
	}),
}));

export const meetingProjectsRelations = relations(meetingProjects, ({one}) => ({
	meeting: one(meetings, {
		fields: [meetingProjects.meetingId],
		references: [meetings.id]
	}),
	project: one(projects, {
		fields: [meetingProjects.projectId],
		references: [projects.id]
	}),
}));

export const meetingsRelations = relations(meetings, ({many}) => ({
	meetingProjects: many(meetingProjects),
}));

export const projectsRelations = relations(projects, ({many}) => ({
	meetingProjects: many(meetingProjects),
	projectAssignments: many(projectAssignments),
}));

export const teamBoardItemLikesRelations = relations(teamBoardItemLikes, ({one}) => ({
	teamBoardItem: one(teamBoardItems, {
		fields: [teamBoardItemLikes.itemId],
		references: [teamBoardItems.id]
	}),
}));

export const projectAssignmentsRelations = relations(projectAssignments, ({one}) => ({
	project: one(projects, {
		fields: [projectAssignments.projectId],
		references: [projects.id]
	}),
}));

export const teamBoardAssignmentsRelations = relations(teamBoardAssignments, ({one}) => ({
	teamBoardItem: one(teamBoardItems, {
		fields: [teamBoardAssignments.itemId],
		references: [teamBoardItems.id]
	}),
}));

export const taskAssignmentsRelations = relations(taskAssignments, ({one}) => ({
	projectTask: one(projectTasks, {
		fields: [taskAssignments.taskId],
		references: [projectTasks.id]
	}),
}));

export const projectTasksRelations = relations(projectTasks, ({many}) => ({
	taskAssignments: many(taskAssignments),
}));

export const alertRequestsRelations = relations(alertRequests, ({one}) => ({
	user_userId: one(users, {
		fields: [alertRequests.userId],
		references: [users.id],
		relationName: "alertRequests_userId_users_id"
	}),
	user_reviewedBy: one(users, {
		fields: [alertRequests.reviewedBy],
		references: [users.id],
		relationName: "alertRequests_reviewedBy_users_id"
	}),
}));

export const conversationParticipantsRelations = relations(conversationParticipants, ({one}) => ({
	conversation: one(conversations, {
		fields: [conversationParticipants.conversationId],
		references: [conversations.id]
	}),
}));