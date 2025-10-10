import { relations } from "drizzle-orm/relations";
import { chatMessages, chatMessageReads, documents, documentAccessLogs, users, googleSheets, messages, kudosTracking, messageRecipients, notificationAbTests, messageLikes, notifications, notificationHistory, notificationPreferences, conversations, userNotificationPatterns, chatMessageLikes, documentPermissions, recipients, recipientTspContacts, streamMessages, streamThreads, conversationParticipants } from "./schema";

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

export const conversationParticipantsRelations = relations(conversationParticipants, ({one}) => ({
	conversation: one(conversations, {
		fields: [conversationParticipants.conversationId],
		references: [conversations.id]
	}),
}));