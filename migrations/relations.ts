import { relations } from "drizzle-orm/relations";
import { conversations, messages, chatMessages, chatMessageReads, kudosTracking, chatMessageLikes, messageLikes, messageRecipients, recipients, recipientTspContacts, users, documents, documentAccessLogs, documentPermissions, googleSheets, streamMessages, streamThreads, conversationParticipants } from "./schema";

export const messagesRelations = relations(messages, ({one, many}) => ({
	conversation: one(conversations, {
		fields: [messages.conversationId],
		references: [conversations.id]
	}),
	kudosTrackings: many(kudosTracking),
	messageLikes: many(messageLikes),
	messageRecipients: many(messageRecipients),
}));

export const conversationsRelations = relations(conversations, ({many}) => ({
	messages: many(messages),
	conversationParticipants: many(conversationParticipants),
}));

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

export const kudosTrackingRelations = relations(kudosTracking, ({one}) => ({
	message: one(messages, {
		fields: [kudosTracking.messageId],
		references: [messages.id]
	}),
}));

export const chatMessageLikesRelations = relations(chatMessageLikes, ({one}) => ({
	chatMessage: one(chatMessages, {
		fields: [chatMessageLikes.messageId],
		references: [chatMessages.id]
	}),
}));

export const messageLikesRelations = relations(messageLikes, ({one}) => ({
	message: one(messages, {
		fields: [messageLikes.messageId],
		references: [messages.id]
	}),
}));

export const messageRecipientsRelations = relations(messageRecipients, ({one}) => ({
	message: one(messages, {
		fields: [messageRecipients.messageId],
		references: [messages.id]
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

export const usersRelations = relations(users, ({many}) => ({
	recipientTspContacts: many(recipientTspContacts),
	documentPermissions: many(documentPermissions),
	googleSheets: many(googleSheets),
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

export const googleSheetsRelations = relations(googleSheets, ({one}) => ({
	user: one(users, {
		fields: [googleSheets.createdBy],
		references: [users.id]
	}),
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