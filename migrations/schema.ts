import { pgTable, serial, text, boolean, timestamp, index, varchar, integer, jsonb, foreignKey, unique, numeric, time, uniqueIndex, primaryKey } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"



export const driverAgreements = pgTable("driver_agreements", {
	id: serial().primaryKey().notNull(),
	submittedBy: text("submitted_by").notNull(),
	email: text().notNull(),
	phone: text().notNull(),
	licenseNumber: text("license_number").notNull(),
	vehicleInfo: text("vehicle_info").notNull(),
	emergencyContact: text("emergency_contact").notNull(),
	emergencyPhone: text("emergency_phone").notNull(),
	agreementAccepted: boolean("agreement_accepted").default(false).notNull(),
	submittedAt: timestamp("submitted_at", { mode: 'string' }).defaultNow().notNull(),
});

export const emailDrafts = pgTable("email_drafts", {
	id: serial().primaryKey().notNull(),
	userId: varchar("user_id").notNull(),
	recipientId: varchar("recipient_id").notNull(),
	recipientName: varchar("recipient_name").notNull(),
	subject: text().notNull(),
	content: text().notNull(),
	lastSaved: timestamp("last_saved", { mode: 'string' }).defaultNow(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	index("idx_drafts_user").using("btree", table.userId.asc().nullsLast().op("text_ops")),
]);

export const emailMessages = pgTable("email_messages", {
	id: serial().primaryKey().notNull(),
	senderId: varchar("sender_id").notNull(),
	senderName: varchar("sender_name").notNull(),
	senderEmail: varchar("sender_email").notNull(),
	recipientId: varchar("recipient_id").notNull(),
	recipientName: varchar("recipient_name").notNull(),
	recipientEmail: varchar("recipient_email").notNull(),
	subject: text().notNull(),
	content: text().notNull(),
	isRead: boolean("is_read").default(false).notNull(),
	isStarred: boolean("is_starred").default(false).notNull(),
	isArchived: boolean("is_archived").default(false).notNull(),
	isTrashed: boolean("is_trashed").default(false).notNull(),
	isDraft: boolean("is_draft").default(false).notNull(),
	parentMessageId: integer("parent_message_id"),
	contextType: varchar("context_type"),
	contextId: varchar("context_id"),
	contextTitle: varchar("context_title"),
	attachments: text().array(),
	includeSchedulingLink: boolean("include_scheduling_link").default(false),
	requestPhoneCall: boolean("request_phone_call").default(false),
	readAt: timestamp("read_at", { mode: 'string' }),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	index("idx_email_draft").using("btree", table.isDraft.asc().nullsLast().op("bool_ops")),
	index("idx_email_read").using("btree", table.isRead.asc().nullsLast().op("bool_ops")),
	index("idx_email_recipient").using("btree", table.recipientId.asc().nullsLast().op("text_ops")),
	index("idx_email_sender").using("btree", table.senderId.asc().nullsLast().op("text_ops")),
	index("idx_email_trashed").using("btree", table.isTrashed.asc().nullsLast().op("bool_ops")),
]);

export const eventReminders = pgTable("event_reminders", {
	id: serial().primaryKey().notNull(),
	eventRequestId: integer("event_request_id").notNull(),
	title: varchar().notNull(),
	description: text(),
	reminderType: varchar("reminder_type").notNull(),
	dueDate: timestamp("due_date", { mode: 'string' }).notNull(),
	assignedToUserId: varchar("assigned_to_user_id"),
	assignedToName: varchar("assigned_to_name"),
	status: varchar().default('pending').notNull(),
	priority: varchar().default('medium').notNull(),
	completedAt: timestamp("completed_at", { mode: 'string' }),
	completedBy: varchar("completed_by"),
	completionNotes: text("completion_notes"),
	createdBy: varchar("created_by").notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("idx_event_reminders_assigned").using("btree", table.assignedToUserId.asc().nullsLast().op("text_ops")),
	index("idx_event_reminders_due_date").using("btree", table.dueDate.asc().nullsLast().op("timestamp_ops")),
	index("idx_event_reminders_event_id").using("btree", table.eventRequestId.asc().nullsLast().op("int4_ops")),
	index("idx_event_reminders_status").using("btree", table.status.asc().nullsLast().op("text_ops")),
	index("idx_event_reminders_type_status").using("btree", table.reminderType.asc().nullsLast().op("text_ops"), table.status.asc().nullsLast().op("text_ops")),
]);

export const eventVolunteers = pgTable("event_volunteers", {
	id: serial().primaryKey().notNull(),
	eventRequestId: integer("event_request_id").notNull(),
	volunteerUserId: varchar("volunteer_user_id"),
	volunteerName: varchar("volunteer_name"),
	volunteerEmail: varchar("volunteer_email"),
	volunteerPhone: varchar("volunteer_phone"),
	role: varchar().notNull(),
	status: varchar().default('pending').notNull(),
	notes: text(),
	assignedBy: varchar("assigned_by"),
	signedUpAt: timestamp("signed_up_at", { mode: 'string' }).defaultNow().notNull(),
	confirmedAt: timestamp("confirmed_at", { mode: 'string' }),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
	reminderSentAt: timestamp("reminder_sent_at", { mode: 'string' }),
	emailReminder1SentAt: timestamp("email_reminder_1_sent_at", { mode: 'string' }),
	emailReminder2SentAt: timestamp("email_reminder_2_sent_at", { mode: 'string' }),
	smsReminder1SentAt: timestamp("sms_reminder_1_sent_at", { mode: 'string' }),
	smsReminder2SentAt: timestamp("sms_reminder_2_sent_at", { mode: 'string' }),
}, (table) => [
	index("idx_event_volunteers_event_id").using("btree", table.eventRequestId.asc().nullsLast().op("int4_ops")),
	index("idx_event_volunteers_role_status").using("btree", table.role.asc().nullsLast().op("text_ops"), table.status.asc().nullsLast().op("text_ops")),
	index("idx_event_volunteers_volunteer").using("btree", table.volunteerUserId.asc().nullsLast().op("text_ops")),
]);

export const drivers = pgTable("drivers", {
	id: serial().primaryKey().notNull(),
	name: text().notNull(),
	phone: text(),
	email: text(),
	address: text(),
	notes: text(),
	isActive: boolean("is_active").default(true).notNull(),
	vehicleType: text("vehicle_type"),
	licenseNumber: text("license_number"),
	availability: text().default('available'),
	zone: text(),
	area: text(),
	routeDescription: text("route_description"),
	hostLocation: text("host_location"),
	hostId: integer("host_id"),
	vanApproved: boolean("van_approved").default(false).notNull(),
	homeAddress: text("home_address"),
	availabilityNotes: text("availability_notes"),
	emailAgreementSent: boolean("email_agreement_sent").default(false).notNull(),
	voicemailLeft: boolean("voicemail_left").default(false).notNull(),
	inactiveReason: text("inactive_reason"),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
	isWeeklyDriver: boolean("is_weekly_driver").default(false).notNull(),
	latitude: text(),
	longitude: text(),
	geocodedAt: timestamp("geocoded_at", { mode: 'string' }),
	willingToSpeak: boolean("willing_to_speak").default(false).notNull(),
});

export const agendaItems = pgTable("agenda_items", {
	id: serial().primaryKey().notNull(),
	meetingId: integer("meeting_id").notNull(),
	submittedBy: text("submitted_by").notNull(),
	title: text().notNull(),
	description: text(),
	section: text(),
	status: text().default('pending').notNull(),
	submittedAt: timestamp("submitted_at", { mode: 'string' }).defaultNow().notNull(),
});

export const agendaSections = pgTable("agenda_sections", {
	id: serial().primaryKey().notNull(),
	compiledAgendaId: integer("compiled_agenda_id").notNull(),
	title: text().notNull(),
	orderIndex: integer("order_index").notNull(),
	items: jsonb().default([]).notNull(),
});

export const announcements = pgTable("announcements", {
	id: serial().primaryKey().notNull(),
	title: text().notNull(),
	message: text().notNull(),
	type: varchar().default('general').notNull(),
	priority: varchar().default('medium').notNull(),
	startDate: timestamp("start_date", { mode: 'string' }).notNull(),
	endDate: timestamp("end_date", { mode: 'string' }).notNull(),
	isActive: boolean("is_active").default(true).notNull(),
	link: text(),
	linkText: text("link_text"),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
});

export const archivedProjects = pgTable("archived_projects", {
	id: serial().primaryKey().notNull(),
	originalProjectId: integer("original_project_id").notNull(),
	title: text().notNull(),
	description: text(),
	priority: text().default('medium').notNull(),
	category: text().default('technology').notNull(),
	assigneeId: integer("assignee_id"),
	assigneeName: text("assignee_name"),
	assigneeIds: jsonb("assignee_ids").default([]),
	assigneeNames: text("assignee_names"),
	dueDate: text("due_date"),
	startDate: text("start_date"),
	completionDate: text("completion_date").notNull(),
	progressPercentage: integer("progress_percentage").default(100).notNull(),
	notes: text(),
	requirements: text(),
	deliverables: text(),
	resources: text(),
	blockers: text(),
	tags: text(),
	estimatedHours: integer("estimated_hours"),
	actualHours: integer("actual_hours"),
	budget: varchar(),
	color: text().default('blue').notNull(),
	createdBy: varchar("created_by"),
	createdByName: varchar("created_by_name"),
	createdAt: timestamp("created_at", { mode: 'string' }).notNull(),
	completedAt: timestamp("completed_at", { mode: 'string' }).defaultNow().notNull(),
	archivedAt: timestamp("archived_at", { mode: 'string' }).defaultNow().notNull(),
	archivedBy: varchar("archived_by"),
	archivedByName: varchar("archived_by_name"),
	googleSheetRowId: text("google_sheet_row_id"),
});

export const auditLogs = pgTable("audit_logs", {
	id: serial().primaryKey().notNull(),
	action: varchar().notNull(),
	tableName: varchar("table_name").notNull(),
	recordId: varchar("record_id").notNull(),
	oldData: text("old_data"),
	newData: text("new_data"),
	userId: varchar("user_id"),
	ipAddress: varchar("ip_address"),
	userAgent: text("user_agent"),
	sessionId: varchar("session_id"),
	timestamp: timestamp({ mode: 'string' }).defaultNow().notNull(),
});

export const chatMessageReads = pgTable("chat_message_reads", {
	id: serial().primaryKey().notNull(),
	messageId: integer("message_id"),
	userId: varchar("user_id").notNull(),
	channel: varchar().notNull(),
	readAt: timestamp("read_at", { mode: 'string' }).defaultNow(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	index("idx_chat_reads_user_channel").using("btree", table.userId.asc().nullsLast().op("text_ops"), table.channel.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.messageId],
			foreignColumns: [chatMessages.id],
			name: "chat_message_reads_message_id_chat_messages_id_fk"
		}).onDelete("cascade"),
	unique("chat_message_reads_message_id_user_id_unique").on(table.messageId, table.userId),
]);

export const committeeMemberships = pgTable("committee_memberships", {
	id: serial().primaryKey().notNull(),
	userId: varchar("user_id").notNull(),
	committeeId: integer("committee_id").notNull(),
	role: varchar().default('member').notNull(),
	permissions: jsonb().default([]),
	joinedAt: timestamp("joined_at", { mode: 'string' }).defaultNow(),
	isActive: boolean("is_active").default(true).notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
});

export const committees = pgTable("committees", {
	id: serial().primaryKey().notNull(),
	name: varchar().notNull(),
	description: text(),
	isActive: boolean("is_active").default(true).notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
});

export const chatMessages = pgTable("chat_messages", {
	id: serial().primaryKey().notNull(),
	channel: varchar().default('general').notNull(),
	userId: varchar("user_id").notNull(),
	userName: varchar("user_name").notNull(),
	content: text().notNull(),
	editedAt: timestamp("edited_at", { mode: 'string' }),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
});

export const compiledAgendas = pgTable("compiled_agendas", {
	id: serial().primaryKey().notNull(),
	meetingId: integer("meeting_id").notNull(),
	title: text().notNull(),
	date: text().notNull(),
	status: text().default('draft').notNull(),
	sections: jsonb().default([]).notNull(),
	deferredItems: jsonb("deferred_items").default([]).notNull(),
	compiledBy: text("compiled_by").notNull(),
	compiledAt: timestamp("compiled_at", { mode: 'string' }).defaultNow().notNull(),
	finalizedAt: timestamp("finalized_at", { mode: 'string' }),
	publishedAt: timestamp("published_at", { mode: 'string' }),
});

export const confidentialDocuments = pgTable("confidential_documents", {
	id: serial().primaryKey().notNull(),
	fileName: varchar("file_name").notNull(),
	originalName: varchar("original_name").notNull(),
	filePath: varchar("file_path").notNull(),
	allowedEmails: jsonb("allowed_emails").default([]).notNull(),
	uploadedBy: varchar("uploaded_by").notNull(),
	uploadedAt: timestamp("uploaded_at", { mode: 'string' }).defaultNow().notNull(),
});

export const contacts = pgTable("contacts", {
	id: serial().primaryKey().notNull(),
	name: text().notNull(),
	organization: text(),
	role: text(),
	phone: text().notNull(),
	email: text(),
	address: text(),
	notes: text(),
	category: text().default('general').notNull(),
	status: text().default('active').notNull(),
	isActive: boolean("is_active").default(true),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
});

export const migrations = pgTable("_migrations", {
	id: serial().primaryKey().notNull(),
	name: varchar({ length: 255 }).notNull(),
	executedAt: timestamp("executed_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	unique("_migrations_name_key").on(table.name),
]);

export const documentAccessLogs = pgTable("document_access_logs", {
	id: serial().primaryKey().notNull(),
	documentId: integer("document_id").notNull(),
	userId: varchar("user_id").notNull(),
	userName: text("user_name").notNull(),
	action: text().notNull(),
	ipAddress: varchar("ip_address"),
	userAgent: text("user_agent"),
	sessionId: varchar("session_id"),
	accessedAt: timestamp("accessed_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("idx_document_access_action_time").using("btree", table.action.asc().nullsLast().op("text_ops"), table.accessedAt.asc().nullsLast().op("timestamp_ops")),
	index("idx_document_access_doc").using("btree", table.documentId.asc().nullsLast().op("int4_ops")),
	index("idx_document_access_user").using("btree", table.userId.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.documentId],
			foreignColumns: [documents.id],
			name: "document_access_logs_document_id_documents_id_fk"
		}).onDelete("cascade"),
]);

export const conversations = pgTable("conversations", {
	id: serial().primaryKey().notNull(),
	type: text().notNull(),
	name: text(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
});

export const driveLinks = pgTable("drive_links", {
	id: serial().primaryKey().notNull(),
	title: text().notNull(),
	description: text().notNull(),
	url: text().notNull(),
	icon: text().notNull(),
	iconColor: text("icon_color").notNull(),
});

export const documents = pgTable("documents", {
	id: serial().primaryKey().notNull(),
	title: text().notNull(),
	description: text(),
	fileName: text("file_name").notNull(),
	originalName: text("original_name").notNull(),
	filePath: text("file_path").notNull(),
	fileSize: integer("file_size").notNull(),
	mimeType: text("mime_type").notNull(),
	category: text().default('general').notNull(),
	isActive: boolean("is_active").default(true).notNull(),
	uploadedBy: varchar("uploaded_by").notNull(),
	uploadedByName: text("uploaded_by_name").notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("idx_documents_active").using("btree", table.isActive.asc().nullsLast().op("bool_ops")),
	index("idx_documents_category").using("btree", table.category.asc().nullsLast().op("text_ops")),
	index("idx_documents_uploaded_by").using("btree", table.uploadedBy.asc().nullsLast().op("text_ops")),
]);

export const volunteers = pgTable("volunteers", {
	id: serial().primaryKey().notNull(),
	name: text().notNull(),
	phone: text(),
	email: text(),
	address: text(),
	notes: text(),
	isActive: boolean("is_active").default(true).notNull(),
	vehicleType: text("vehicle_type"),
	licenseNumber: text("license_number"),
	availability: text().default('available'),
	zone: text(),
	routeDescription: text("route_description"),
	hostLocation: text("host_location"),
	hostId: integer("host_id"),
	vanApproved: boolean("van_approved").default(false).notNull(),
	homeAddress: text("home_address"),
	availabilityNotes: text("availability_notes"),
	emailAgreementSent: boolean("email_agreement_sent").default(false).notNull(),
	voicemailLeft: boolean("voicemail_left").default(false).notNull(),
	inactiveReason: text("inactive_reason"),
	volunteerType: text("volunteer_type").default('general').notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
	isDriver: boolean("is_driver").default(false).notNull(),
	latitude: numeric(),
	longitude: numeric(),
	geocodedAt: timestamp("geocoded_at", { mode: 'string' }),
	isSpeaker: boolean("is_speaker").default(false).notNull(),
});

export const hostedFiles = pgTable("hosted_files", {
	id: serial().primaryKey().notNull(),
	title: text().notNull(),
	description: text(),
	fileName: text("file_name").notNull(),
	originalName: text("original_name").notNull(),
	filePath: text("file_path").notNull(),
	fileSize: integer("file_size").notNull(),
	mimeType: text("mime_type").notNull(),
	category: text().default('general').notNull(),
	uploadedBy: text("uploaded_by").notNull(),
	isPublic: boolean("is_public").default(true).notNull(),
	downloadCount: integer("download_count").default(0).notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
});

export const importedExternalIds = pgTable("imported_external_ids", {
	id: serial().primaryKey().notNull(),
	externalId: varchar("external_id").notNull(),
	importedAt: timestamp("imported_at", { mode: 'string' }).defaultNow().notNull(),
	sourceTable: varchar("source_table").default('event_requests').notNull(),
	notes: text(),
}, (table) => [
	index("idx_imported_external_ids_external_id").using("btree", table.externalId.asc().nullsLast().op("text_ops")),
	index("idx_imported_external_ids_imported_at").using("btree", table.importedAt.asc().nullsLast().op("timestamp_ops")),
	index("idx_imported_external_ids_source_table").using("btree", table.sourceTable.asc().nullsLast().op("text_ops")),
	unique("imported_external_ids_external_id_unique").on(table.externalId),
]);

export const meetingMinutes = pgTable("meeting_minutes", {
	id: serial().primaryKey().notNull(),
	title: text().notNull(),
	date: text().notNull(),
	summary: text().notNull(),
	color: text().default('blue').notNull(),
	fileName: text("file_name"),
	filePath: text("file_path"),
	fileType: text("file_type"),
	mimeType: text("mime_type"),
	committeeType: text("committee_type"),
});

export const googleSheets = pgTable("google_sheets", {
	id: serial().primaryKey().notNull(),
	name: varchar().notNull(),
	description: text(),
	sheetId: varchar("sheet_id").notNull(),
	isPublic: boolean("is_public").default(true).notNull(),
	embedUrl: text("embed_url").notNull(),
	directUrl: text("direct_url").notNull(),
	createdBy: varchar("created_by"),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.createdBy],
			foreignColumns: [users.id],
			name: "google_sheets_created_by_users_id_fk"
		}),
]);

export const kudosTracking = pgTable("kudos_tracking", {
	id: serial().primaryKey().notNull(),
	senderId: text("sender_id").notNull(),
	recipientId: text("recipient_id").notNull(),
	contextType: text("context_type").notNull(),
	contextId: text("context_id").notNull(),
	entityName: text("entity_name").default('Legacy Entry').notNull(),
	messageId: integer("message_id"),
	sentAt: timestamp("sent_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	index("idx_kudos_sender").using("btree", table.senderId.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.messageId],
			foreignColumns: [messages.id],
			name: "kudos_tracking_message_id_messages_id_fk"
		}).onDelete("cascade"),
	unique("kudos_tracking_sender_id_recipient_id_context_type_context_id_u").on(table.senderId, table.recipientId, table.contextType, table.contextId),
]);

export const meetings = pgTable("meetings", {
	id: serial().primaryKey().notNull(),
	title: text().notNull(),
	type: text().notNull(),
	date: text().notNull(),
	time: text().notNull(),
	location: text(),
	description: text(),
	finalAgenda: text("final_agenda"),
	status: text().default('planning').notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
});

export const messageRecipients = pgTable("message_recipients", {
	id: serial().primaryKey().notNull(),
	messageId: integer("message_id"),
	recipientId: text("recipient_id").notNull(),
	read: boolean().default(false).notNull(),
	readAt: timestamp("read_at", { mode: 'string' }),
	notificationSent: boolean("notification_sent").default(false).notNull(),
	emailSentAt: timestamp("email_sent_at", { mode: 'string' }),
	contextAccessRevoked: boolean("context_access_revoked").default(false),
	initiallyNotified: boolean("initially_notified").default(false).notNull(),
	initiallyNotifiedAt: timestamp("initially_notified_at", { mode: 'string' }),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	index("idx_message_recipients_unread").using("btree", table.recipientId.asc().nullsLast().op("bool_ops"), table.read.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.messageId],
			foreignColumns: [messages.id],
			name: "message_recipients_message_id_messages_id_fk"
		}).onDelete("cascade"),
	unique("message_recipients_message_id_recipient_id_unique").on(table.messageId, table.recipientId),
]);

export const notificationAbTests = pgTable("notification_ab_tests", {
	id: serial().primaryKey().notNull(),
	name: varchar().notNull(),
	description: text(),
	hypothesis: text(),
	testType: varchar("test_type").notNull(),
	category: varchar(),
	type: varchar(),
	controlGroup: jsonb("control_group").notNull(),
	testGroup: jsonb("test_group").notNull(),
	trafficSplit: integer("traffic_split").default(50).notNull(),
	status: varchar().default('draft').notNull(),
	startDate: timestamp("start_date", { mode: 'string' }),
	endDate: timestamp("end_date", { mode: 'string' }),
	targetSampleSize: integer("target_sample_size").default(1000),
	primaryMetric: varchar("primary_metric").notNull(),
	targetImprovement: numeric("target_improvement", { precision: 5, scale:  2 }).default('5.00'),
	significanceLevel: numeric("significance_level", { precision: 3, scale:  2 }).default('0.05'),
	controlResults: jsonb("control_results").default({}),
	testResults: jsonb("test_results").default({}),
	statisticalSignificance: boolean("statistical_significance"),
	winnerVariant: varchar("winner_variant"),
	createdBy: varchar("created_by"),
	metadata: jsonb().default({}),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("idx_notif_ab_tests_active").using("btree", table.status.asc().nullsLast().op("text_ops"), table.startDate.asc().nullsLast().op("timestamp_ops"), table.endDate.asc().nullsLast().op("timestamp_ops")),
	index("idx_notif_ab_tests_category_type").using("btree", table.category.asc().nullsLast().op("text_ops"), table.type.asc().nullsLast().op("text_ops")),
	index("idx_notif_ab_tests_status").using("btree", table.status.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.createdBy],
			foreignColumns: [users.id],
			name: "notification_ab_tests_created_by_users_id_fk"
		}),
]);

export const messageLikes = pgTable("message_likes", {
	id: serial().primaryKey().notNull(),
	messageId: integer("message_id").notNull(),
	userId: text("user_id").notNull(),
	userName: text("user_name"),
	likedAt: timestamp("liked_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	index("idx_message_likes_message").using("btree", table.messageId.asc().nullsLast().op("int4_ops")),
	index("idx_message_likes_user").using("btree", table.userId.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.messageId],
			foreignColumns: [messages.id],
			name: "message_likes_message_id_messages_id_fk"
		}).onDelete("cascade"),
	unique("message_likes_message_id_user_id_unique").on(table.messageId, table.userId),
]);

export const notificationHistory = pgTable("notification_history", {
	id: serial().primaryKey().notNull(),
	notificationId: integer("notification_id").notNull(),
	userId: varchar("user_id").notNull(),
	deliveryChannel: varchar("delivery_channel").notNull(),
	deliveryStatus: varchar("delivery_status").default('pending').notNull(),
	deliveryAttempts: integer("delivery_attempts").default(0).notNull(),
	lastDeliveryAttempt: timestamp("last_delivery_attempt", { mode: 'string' }),
	deliveredAt: timestamp("delivered_at", { mode: 'string' }),
	failureReason: text("failure_reason"),
	openedAt: timestamp("opened_at", { mode: 'string' }),
	clickedAt: timestamp("clicked_at", { mode: 'string' }),
	dismissedAt: timestamp("dismissed_at", { mode: 'string' }),
	interactionType: varchar("interaction_type"),
	timeToInteraction: integer("time_to_interaction"),
	relevanceScore: numeric("relevance_score", { precision: 5, scale:  2 }),
	contextMetadata: jsonb("context_metadata").default({}),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("idx_notif_history_delivery_status").using("btree", table.deliveryStatus.asc().nullsLast().op("text_ops")),
	index("idx_notif_history_interaction_time").using("btree", table.openedAt.asc().nullsLast().op("timestamp_ops"), table.clickedAt.asc().nullsLast().op("timestamp_ops")),
	index("idx_notif_history_notif_user").using("btree", table.notificationId.asc().nullsLast().op("text_ops"), table.userId.asc().nullsLast().op("int4_ops")),
	index("idx_notif_history_user_channel").using("btree", table.userId.asc().nullsLast().op("text_ops"), table.deliveryChannel.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.notificationId],
			foreignColumns: [notifications.id],
			name: "notification_history_notification_id_notifications_id_fk"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "notification_history_user_id_users_id_fk"
		}).onDelete("cascade"),
]);

export const notificationAnalytics = pgTable("notification_analytics", {
	id: serial().primaryKey().notNull(),
	periodType: varchar("period_type").notNull(),
	periodStart: timestamp("period_start", { mode: 'string' }).notNull(),
	periodEnd: timestamp("period_end", { mode: 'string' }).notNull(),
	category: varchar(),
	type: varchar(),
	deliveryChannel: varchar("delivery_channel"),
	totalSent: integer("total_sent").default(0).notNull(),
	totalDelivered: integer("total_delivered").default(0).notNull(),
	totalOpened: integer("total_opened").default(0).notNull(),
	totalClicked: integer("total_clicked").default(0).notNull(),
	totalDismissed: integer("total_dismissed").default(0).notNull(),
	totalFailed: integer("total_failed").default(0).notNull(),
	deliveryRate: numeric("delivery_rate", { precision: 5, scale:  2 }),
	openRate: numeric("open_rate", { precision: 5, scale:  2 }),
	clickRate: numeric("click_rate", { precision: 5, scale:  2 }),
	dismissalRate: numeric("dismissal_rate", { precision: 5, scale:  2 }),
	averageDeliveryTime: integer("average_delivery_time"),
	averageResponseTime: integer("average_response_time"),
	peakHours: jsonb("peak_hours").default([]),
	insights: jsonb().default({}),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("idx_notif_analytics_category_type_channel").using("btree", table.category.asc().nullsLast().op("text_ops"), table.type.asc().nullsLast().op("text_ops"), table.deliveryChannel.asc().nullsLast().op("text_ops")),
	index("idx_notif_analytics_performance").using("btree", table.openRate.asc().nullsLast().op("numeric_ops"), table.clickRate.asc().nullsLast().op("numeric_ops")),
	index("idx_notif_analytics_period").using("btree", table.periodType.asc().nullsLast().op("timestamp_ops"), table.periodStart.asc().nullsLast().op("timestamp_ops")),
]);

export const notificationPreferences = pgTable("notification_preferences", {
	id: serial().primaryKey().notNull(),
	userId: varchar("user_id").notNull(),
	category: varchar().notNull(),
	type: varchar().notNull(),
	emailEnabled: boolean("email_enabled").default(true).notNull(),
	smsEnabled: boolean("sms_enabled").default(false).notNull(),
	inAppEnabled: boolean("in_app_enabled").default(true).notNull(),
	pushEnabled: boolean("push_enabled").default(true).notNull(),
	priority: varchar().default('medium').notNull(),
	frequency: varchar().default('immediate').notNull(),
	quietHoursStart: time("quiet_hours_start"),
	quietHoursEnd: time("quiet_hours_end"),
	timezone: varchar().default('America/New_York'),
	relevanceScore: numeric("relevance_score", { precision: 5, scale:  2 }).default('50.00'),
	lastInteraction: timestamp("last_interaction", { mode: 'string' }),
	totalReceived: integer("total_received").default(0).notNull(),
	totalOpened: integer("total_opened").default(0).notNull(),
	totalDismissed: integer("total_dismissed").default(0).notNull(),
	engagementMetadata: jsonb("engagement_metadata").default({}),
	isActive: boolean("is_active").default(true).notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("idx_notif_prefs_relevance").using("btree", table.relevanceScore.asc().nullsLast().op("numeric_ops")),
	index("idx_notif_prefs_user_category").using("btree", table.userId.asc().nullsLast().op("text_ops"), table.category.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "notification_preferences_user_id_users_id_fk"
		}).onDelete("cascade"),
	unique("notification_preferences_user_id_category_type_unique").on(table.userId, table.category, table.type),
]);

export const messages = pgTable("messages", {
	id: serial().primaryKey().notNull(),
	conversationId: integer("conversation_id"),
	userId: text("user_id").notNull(),
	senderId: text("sender_id").notNull(),
	content: text().notNull(),
	sender: text(),
	contextType: text("context_type"),
	contextId: text("context_id"),
	read: boolean().default(false).notNull(),
	editedAt: timestamp("edited_at", { mode: 'string' }),
	editedContent: text("edited_content"),
	deletedAt: timestamp("deleted_at", { mode: 'string' }),
	deletedBy: text("deleted_by"),
	replyToMessageId: integer("reply_to_message_id"),
	replyToContent: text("reply_to_content"),
	replyToSender: text("reply_to_sender"),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
	contextTitle: text("context_title"),
}, (table) => [
	foreignKey({
			columns: [table.conversationId],
			foreignColumns: [conversations.id],
			name: "messages_conversation_id_conversations_id_fk"
		}).onDelete("cascade"),
]);

export const notificationRules = pgTable("notification_rules", {
	id: serial().primaryKey().notNull(),
	name: varchar().notNull(),
	description: text(),
	category: varchar(),
	type: varchar(),
	priority: varchar(),
	userRole: varchar("user_role"),
	batchingEnabled: boolean("batching_enabled").default(false).notNull(),
	batchingWindow: integer("batching_window").default(3600),
	maxBatchSize: integer("max_batch_size").default(5),
	respectQuietHours: boolean("respect_quiet_hours").default(true).notNull(),
	minTimeBetween: integer("min_time_between").default(300),
	maxDailyLimit: integer("max_daily_limit"),
	smartChannelSelection: boolean("smart_channel_selection").default(true).notNull(),
	fallbackChannel: varchar("fallback_channel").default('in_app'),
	retryAttempts: integer("retry_attempts").default(3).notNull(),
	retryDelay: integer("retry_delay").default(3600).notNull(),
	testVariant: varchar("test_variant"),
	isActive: boolean("is_active").default(true).notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("idx_notif_rules_active").using("btree", table.isActive.asc().nullsLast().op("bool_ops")),
	index("idx_notif_rules_category_type").using("btree", table.category.asc().nullsLast().op("text_ops"), table.type.asc().nullsLast().op("text_ops")),
]);

export const organizations = pgTable("organizations", {
	id: serial().primaryKey().notNull(),
	name: varchar().notNull(),
	alternateNames: text("alternate_names").array(),
	addresses: text().array(),
	domains: text().array(),
	totalEvents: integer("total_events").default(0).notNull(),
	lastEventDate: timestamp("last_event_date", { mode: 'string' }),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
	category: varchar(),
	schoolClassification: varchar("school_classification"),
	isReligious: boolean("is_religious").default(false),
	department: varchar(),
}, (table) => [
	index("idx_organizations_name").using("btree", table.name.asc().nullsLast().op("text_ops")),
]);

export const recipients = pgTable("recipients", {
	id: serial().primaryKey().notNull(),
	name: text().notNull(),
	contactName: text("contact_name"),
	phone: text().notNull(),
	email: text(),
	website: text(),
	instagramHandle: text("instagram_handle"),
	address: text(),
	region: text(),
	preferences: text(),
	weeklyEstimate: integer("weekly_estimate"),
	status: text().default('active').notNull(),
	contactPersonName: text("contact_person_name"),
	contactPersonPhone: text("contact_person_phone"),
	contactPersonEmail: text("contact_person_email"),
	contactPersonRole: text("contact_person_role"),
	secondContactPersonName: text("second_contact_person_name"),
	secondContactPersonPhone: text("second_contact_person_phone"),
	secondContactPersonEmail: text("second_contact_person_email"),
	secondContactPersonRole: text("second_contact_person_role"),
	reportingGroup: text("reporting_group"),
	estimatedSandwiches: integer("estimated_sandwiches"),
	sandwichType: text("sandwich_type"),
	tspContact: text("tsp_contact"),
	tspContactUserId: varchar("tsp_contact_user_id"),
	contractSigned: boolean("contract_signed").default(false).notNull(),
	contractSignedDate: timestamp("contract_signed_date", { mode: 'string' }),
	collectionDay: text("collection_day"),
	collectionTime: text("collection_time"),
	feedingDay: text("feeding_day"),
	feedingTime: text("feeding_time"),
	hasSharedPost: boolean("has_shared_post").default(false).notNull(),
	sharedPostDate: timestamp("shared_post_date", { mode: 'string' }),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
	focusAreas: jsonb("focus_areas").default([]),
	focusArea: text("focus_area"),
	averagePeopleServed: integer("average_people_served"),
	peopleServedFrequency: text("people_served_frequency"),
	partnershipStartDate: timestamp("partnership_start_date", { mode: 'string' }),
	partnershipYears: integer("partnership_years"),
	receivingFruit: boolean("receiving_fruit").default(false).notNull(),
	receivingSnacks: boolean("receiving_snacks").default(false).notNull(),
	wantsFruit: boolean("wants_fruit").default(false).notNull(),
	wantsSnacks: boolean("wants_snacks").default(false).notNull(),
	fruitSnacksNotes: text("fruit_snacks_notes"),
	hasSeasonalChanges: boolean("has_seasonal_changes").default(false).notNull(),
	seasonalChangesDescription: text("seasonal_changes_description"),
	summerNeeds: text("summer_needs"),
	winterNeeds: text("winter_needs"),
	collectionSchedules: jsonb("collection_schedules").default([]),
	feedingSchedules: jsonb("feeding_schedules").default([]),
	allowedContactMethods: jsonb("allowed_contact_methods").default(["text","email"]),
	doNotContact: boolean("do_not_contact").default(false).notNull(),
	contactMethodNotes: text("contact_method_notes"),
	impactStories: jsonb("impact_stories").default([]),
	preferredContactMethods: jsonb("preferred_contact_methods").default([]),
	latitude: numeric(),
	longitude: numeric(),
	geocodedAt: timestamp("geocoded_at", { mode: 'string' }),
});

export const projectComments = pgTable("project_comments", {
	id: serial().primaryKey().notNull(),
	projectId: integer("project_id").notNull(),
	authorName: text("author_name").notNull(),
	content: text().notNull(),
	commentType: text("comment_type").default('general').notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
});

export const projectDocuments = pgTable("project_documents", {
	id: serial().primaryKey().notNull(),
	projectId: integer("project_id").notNull(),
	fileName: text("file_name").notNull(),
	originalName: text("original_name").notNull(),
	fileSize: integer("file_size").notNull(),
	mimeType: text("mime_type").notNull(),
	uploadedBy: text("uploaded_by").notNull(),
	uploadedAt: timestamp("uploaded_at", { mode: 'string' }).defaultNow().notNull(),
});

export const notifications = pgTable("notifications", {
	id: serial().primaryKey().notNull(),
	userId: varchar("user_id").notNull(),
	type: varchar().notNull(),
	priority: varchar().default('medium').notNull(),
	title: text().notNull(),
	message: text().notNull(),
	isRead: boolean("is_read").default(false).notNull(),
	isArchived: boolean("is_archived").default(false).notNull(),
	category: varchar(),
	relatedType: varchar("related_type"),
	relatedId: integer("related_id"),
	actionUrl: text("action_url"),
	actionText: text("action_text"),
	expiresAt: timestamp("expires_at", { mode: 'string' }),
	metadata: jsonb().default({}),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
});

export const sandwichDistributions = pgTable("sandwich_distributions", {
	id: serial().primaryKey().notNull(),
	distributionDate: text("distribution_date").notNull(),
	weekEnding: text("week_ending").notNull(),
	hostId: integer("host_id").notNull(),
	hostName: text("host_name").notNull(),
	recipientId: integer("recipient_id").notNull(),
	recipientName: text("recipient_name").notNull(),
	sandwichCount: integer("sandwich_count").notNull(),
	notes: text(),
	createdBy: text("created_by").notNull(),
	createdByName: text("created_by_name").notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	index("idx_distributions_date").using("btree", table.distributionDate.asc().nullsLast().op("text_ops")),
	index("idx_distributions_host").using("btree", table.hostId.asc().nullsLast().op("int4_ops")),
	index("idx_distributions_recipient").using("btree", table.recipientId.asc().nullsLast().op("int4_ops")),
	index("idx_distributions_week_ending").using("btree", table.weekEnding.asc().nullsLast().op("text_ops")),
	unique("sandwich_distributions_host_id_recipient_id_distribution_date_u").on(table.distributionDate, table.hostId, table.recipientId),
]);

export const sessions = pgTable("sessions", {
	sid: varchar().primaryKey().notNull(),
	sess: jsonb().notNull(),
	expire: timestamp({ mode: 'string' }).notNull(),
}, (table) => [
	index("IDX_session_expire").using("btree", table.expire.asc().nullsLast().op("timestamp_ops")),
]);

export const streamChannels = pgTable("stream_channels", {
	id: serial().primaryKey().notNull(),
	channelId: varchar("channel_id").notNull(),
	userId: varchar("user_id").notNull(),
	folder: varchar().default('inbox').notNull(),
	lastRead: timestamp("last_read", { mode: 'string' }),
	customData: jsonb("custom_data").default({}),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	unique("stream_channels_channel_id_unique").on(table.channelId),
]);

export const streamUsers = pgTable("stream_users", {
	id: serial().primaryKey().notNull(),
	userId: varchar("user_id").notNull(),
	streamUserId: varchar("stream_user_id").notNull(),
	streamToken: text("stream_token"),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	unique("stream_users_stream_user_id_unique").on(table.streamUserId),
]);

export const suggestionResponses = pgTable("suggestion_responses", {
	id: serial().primaryKey().notNull(),
	suggestionId: integer("suggestion_id").notNull(),
	message: text().notNull(),
	isAdminResponse: boolean("is_admin_response").default(false).notNull(),
	respondedBy: varchar("responded_by").notNull(),
	respondentName: text("respondent_name"),
	isInternal: boolean("is_internal").default(false).notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
});

export const streamMessages = pgTable("stream_messages", {
	id: serial().primaryKey().notNull(),
	streamMessageId: varchar("stream_message_id").notNull(),
	channelId: varchar("channel_id").notNull(),
	userId: varchar("user_id").notNull(),
	isStarred: boolean("is_starred").default(false).notNull(),
	isDraft: boolean("is_draft").default(false).notNull(),
	folder: varchar().default('inbox').notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	unique("stream_messages_stream_message_id_unique").on(table.streamMessageId),
]);

export const sandwichCollections = pgTable("sandwich_collections", {
	id: serial().primaryKey().notNull(),
	collectionDate: text("collection_date").notNull(),
	hostName: text("host_name").notNull(),
	individualSandwiches: integer("individual_sandwiches").default(0).notNull(),
	group1Name: text("group1_name"),
	group1Count: integer("group1_count"),
	group2Name: text("group2_name"),
	group2Count: integer("group2_count"),
	groupCollections: jsonb("group_collections").default([]).notNull(),
	createdBy: text("created_by"),
	createdByName: text("created_by_name"),
	submittedAt: timestamp("submitted_at", { mode: 'string' }).defaultNow().notNull(),
	submissionMethod: text("submission_method").default('standard'),
	individualDeli: integer("individual_deli"),
	individualPbj: integer("individual_pbj"),
	individualTurkey: integer("individual_turkey"),
	individualHam: integer("individual_ham"),
	deletedAt: timestamp("deleted_at", { mode: 'string' }),
	deletedBy: text("deleted_by"),
	individualGeneric: integer("individual_generic"),
	eventRequestId: integer("event_request_id"),
});

export const suggestions = pgTable("suggestions", {
	id: serial().primaryKey().notNull(),
	title: text().notNull(),
	description: text().notNull(),
	category: text().default('general').notNull(),
	priority: text().default('medium').notNull(),
	status: text().default('submitted').notNull(),
	submittedBy: varchar("submitted_by").notNull(),
	submitterEmail: varchar("submitter_email"),
	submitterName: text("submitter_name"),
	isAnonymous: boolean("is_anonymous").default(false).notNull(),
	upvotes: integer().default(0).notNull(),
	tags: text().array().default([""]),
	implementationNotes: text("implementation_notes"),
	estimatedEffort: text("estimated_effort"),
	assignedTo: varchar("assigned_to"),
	completedAt: timestamp("completed_at", { mode: 'string' }),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
});

export const taskCompletions = pgTable("task_completions", {
	id: serial().primaryKey().notNull(),
	taskId: integer("task_id").notNull(),
	userId: text("user_id").notNull(),
	userName: text("user_name").notNull(),
	completedAt: timestamp("completed_at", { mode: 'string' }).defaultNow().notNull(),
	notes: text(),
}, (table) => [
	unique("task_completions_task_id_user_id_unique").on(table.taskId, table.userId),
]);

export const userActivityLogs = pgTable("user_activity_logs", {
	id: serial().primaryKey().notNull(),
	userId: varchar("user_id").notNull(),
	action: varchar().notNull(),
	section: varchar().notNull(),
	details: jsonb().default({}),
	sessionId: varchar("session_id"),
	ipAddress: varchar("ip_address"),
	userAgent: text("user_agent"),
	duration: integer(),
	page: varchar(),
	feature: varchar(),
	metadata: jsonb().default({}),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("idx_user_activity_section_time").using("btree", table.section.asc().nullsLast().op("text_ops"), table.createdAt.asc().nullsLast().op("timestamp_ops")),
	index("idx_user_activity_user_action").using("btree", table.userId.asc().nullsLast().op("text_ops"), table.action.asc().nullsLast().op("text_ops")),
	index("idx_user_activity_user_time").using("btree", table.userId.asc().nullsLast().op("text_ops"), table.createdAt.asc().nullsLast().op("timestamp_ops")),
]);

export const userNotificationPatterns = pgTable("user_notification_patterns", {
	id: serial().primaryKey().notNull(),
	userId: varchar("user_id").notNull(),
	mostActiveHours: jsonb("most_active_hours").default([]),
	mostActiveDays: jsonb("most_active_days").default([]),
	averageResponseTime: integer("average_response_time"),
	preferredChannels: jsonb("preferred_channels").default([]),
	overallEngagementScore: numeric("overall_engagement_score", { precision: 5, scale:  2 }).default('50.00'),
	categoryEngagement: jsonb("category_engagement").default({}),
	recentEngagementTrend: varchar("recent_engagement_trend").default('stable'),
	lastModelUpdate: timestamp("last_model_update", { mode: 'string' }),
	modelVersion: varchar("model_version").default('1.0'),
	learningMetadata: jsonb("learning_metadata").default({}),
	contentPreferences: jsonb("content_preferences").default({}),
	timingPreferences: jsonb("timing_preferences").default({}),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("idx_user_patterns_engagement").using("btree", table.overallEngagementScore.asc().nullsLast().op("numeric_ops")),
	index("idx_user_patterns_model_update").using("btree", table.lastModelUpdate.asc().nullsLast().op("timestamp_ops")),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "user_notification_patterns_user_id_users_id_fk"
		}).onDelete("cascade"),
	unique("user_notification_patterns_user_id_unique").on(table.userId),
]);

export const weeklyReports = pgTable("weekly_reports", {
	id: serial().primaryKey().notNull(),
	weekEnding: text("week_ending").notNull(),
	sandwichCount: integer("sandwich_count").notNull(),
	notes: text(),
	submittedBy: text("submitted_by").notNull(),
	submittedAt: timestamp("submitted_at", { mode: 'string' }).defaultNow().notNull(),
});

export const wishlistSuggestions = pgTable("wishlist_suggestions", {
	id: serial().primaryKey().notNull(),
	item: text().notNull(),
	reason: text(),
	priority: varchar().default('medium').notNull(),
	suggestedBy: varchar("suggested_by").notNull(),
	status: varchar().default('pending').notNull(),
	adminNotes: text("admin_notes"),
	amazonUrl: text("amazon_url"),
	estimatedCost: numeric("estimated_cost", { precision: 10, scale:  2 }),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
	reviewedAt: timestamp("reviewed_at", { mode: 'string' }),
	reviewedBy: varchar("reviewed_by"),
});

export const workLogs = pgTable("work_logs", {
	id: serial().primaryKey().notNull(),
	userId: varchar("user_id").notNull(),
	description: text().notNull(),
	hours: integer().default(0).notNull(),
	minutes: integer().default(0).notNull(),
	workDate: timestamp("work_date", { withTimezone: true, mode: 'string' }).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	status: varchar({ length: 20 }).default('pending'),
	approvedBy: varchar("approved_by"),
	approvedAt: timestamp("approved_at", { withTimezone: true, mode: 'string' }),
	visibility: varchar({ length: 20 }).default('private'),
	sharedWith: jsonb("shared_with").default([]),
	department: varchar({ length: 50 }),
	teamId: varchar("team_id"),
});

export const chatMessageLikes = pgTable("chat_message_likes", {
	id: serial().primaryKey().notNull(),
	messageId: integer("message_id"),
	userId: varchar("user_id").notNull(),
	userName: varchar("user_name").notNull(),
	likedAt: timestamp("liked_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	foreignKey({
			columns: [table.messageId],
			foreignColumns: [chatMessages.id],
			name: "chat_message_likes_message_id_chat_messages_id_fk"
		}).onDelete("cascade"),
	unique("chat_message_likes_message_id_user_id_unique").on(table.messageId, table.userId),
]);

export const documentPermissions = pgTable("document_permissions", {
	id: serial().primaryKey().notNull(),
	documentId: integer("document_id").notNull(),
	userId: varchar("user_id").notNull(),
	permissionType: text("permission_type").notNull(),
	grantedBy: varchar("granted_by").notNull(),
	grantedByName: text("granted_by_name").notNull(),
	grantedAt: timestamp("granted_at", { mode: 'string' }).defaultNow().notNull(),
	expiresAt: timestamp("expires_at", { mode: 'string' }),
	notes: text(),
	isActive: boolean("is_active").default(true).notNull(),
}, (table) => [
	index("idx_document_permissions_doc").using("btree", table.documentId.asc().nullsLast().op("text_ops"), table.permissionType.asc().nullsLast().op("text_ops")),
	index("idx_document_permissions_doc_user").using("btree", table.documentId.asc().nullsLast().op("text_ops"), table.userId.asc().nullsLast().op("int4_ops")),
	index("idx_document_permissions_user").using("btree", table.userId.asc().nullsLast().op("text_ops"), table.permissionType.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.documentId],
			foreignColumns: [documents.id],
			name: "document_permissions_document_id_documents_id_fk"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "document_permissions_user_id_users_id_fk"
		}).onDelete("cascade"),
	unique("document_permissions_document_id_user_id_permission_type_unique").on(table.documentId, table.userId, table.permissionType),
]);

export const recipientTspContacts = pgTable("recipient_tsp_contacts", {
	id: serial().primaryKey().notNull(),
	recipientId: integer("recipient_id").notNull(),
	userId: varchar("user_id"),
	userName: text("user_name"),
	userEmail: text("user_email"),
	contactName: text("contact_name"),
	contactEmail: text("contact_email"),
	contactPhone: text("contact_phone"),
	role: text().default('tsp_contact').notNull(),
	notes: text(),
	isActive: boolean("is_active").default(true).notNull(),
	isPrimary: boolean("is_primary").default(false).notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("idx_recipient_tsp_contacts_primary").using("btree", table.recipientId.asc().nullsLast().op("int4_ops"), table.isPrimary.asc().nullsLast().op("bool_ops")),
	index("idx_recipient_tsp_contacts_recipient").using("btree", table.recipientId.asc().nullsLast().op("int4_ops")),
	index("idx_recipient_tsp_contacts_user").using("btree", table.userId.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.recipientId],
			foreignColumns: [recipients.id],
			name: "recipient_tsp_contacts_recipient_id_recipients_id_fk"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "recipient_tsp_contacts_user_id_users_id_fk"
		}).onDelete("set null"),
]);

export const streamThreads = pgTable("stream_threads", {
	id: serial().primaryKey().notNull(),
	streamThreadId: varchar("stream_thread_id").notNull(),
	parentMessageId: integer("parent_message_id"),
	title: text(),
	participants: jsonb().default([]).notNull(),
	lastReplyAt: timestamp("last_reply_at", { mode: 'string' }),
	replyCount: integer("reply_count").default(0).notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.parentMessageId],
			foreignColumns: [streamMessages.id],
			name: "stream_threads_parent_message_id_stream_messages_id_fk"
		}).onDelete("set null"),
	unique("stream_threads_stream_thread_id_unique").on(table.streamThreadId),
]);

export const eventCollaborationCommentLikes = pgTable("event_collaboration_comment_likes", {
	id: serial().primaryKey().notNull(),
	commentId: integer("comment_id").notNull(),
	userId: varchar("user_id").notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("idx_comment_likes_comment_id").using("btree", table.commentId.asc().nullsLast().op("int4_ops")),
	index("idx_comment_likes_user_id").using("btree", table.userId.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.commentId],
			foreignColumns: [eventCollaborationComments.id],
			name: "event_collaboration_comment_likes_comment_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "event_collaboration_comment_likes_user_id_fkey"
		}).onDelete("cascade"),
	unique("event_collaboration_comment_likes_comment_id_user_id_key").on(table.commentId, table.userId),
]);

export const users = pgTable("users", {
	id: varchar().primaryKey().notNull(),
	email: varchar(),
	password: varchar(),
	firstName: varchar("first_name"),
	lastName: varchar("last_name"),
	displayName: varchar("display_name"),
	profileImageUrl: varchar("profile_image_url"),
	phoneNumber: varchar("phone_number"),
	preferredEmail: varchar("preferred_email"),
	role: varchar().default('volunteer').notNull(),
	permissions: jsonb().default([]),
	metadata: jsonb().default({}),
	isActive: boolean("is_active").default(true).notNull(),
	lastLoginAt: timestamp("last_login_at", { mode: 'string' }),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
	permissionsModifiedAt: timestamp("permissions_modified_at", { mode: 'string' }),
	permissionsModifiedBy: varchar("permissions_modified_by"),
	passwordBackup20241023: text("password_backup_20241023"),
	lastActiveAt: timestamp("last_active_at", { mode: 'string' }),
}, (table) => [
	unique("users_email_unique").on(table.email),
]);

export const coolerTypes = pgTable("cooler_types", {
	id: serial().primaryKey().notNull(),
	name: varchar({ length: 100 }).notNull(),
	description: text(),
	isActive: boolean("is_active").default(true).notNull(),
	sortOrder: integer("sort_order").default(0).notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
});

export const hosts = pgTable("hosts", {
	id: serial().primaryKey().notNull(),
	name: text().notNull(),
	address: text(),
	email: text(),
	phone: text(),
	status: text().default('active').notNull(),
	notes: text(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
	latitude: numeric(),
	longitude: numeric(),
	geocodedAt: timestamp("geocoded_at", { mode: 'string' }),
});

export const hostContacts = pgTable("host_contacts", {
	id: serial().primaryKey().notNull(),
	hostId: integer("host_id").notNull(),
	name: text().notNull(),
	role: text().notNull(),
	phone: text().notNull(),
	email: text(),
	isPrimary: boolean("is_primary").default(false).notNull(),
	notes: text(),
	hostLocation: text("host_location"),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
	address: text(),
	weeklyActive: boolean("weekly_active").default(false),
	lastScraped: timestamp("last_scraped", { mode: 'string' }),
	latitude: numeric(),
	longitude: numeric(),
	geocodedAt: timestamp("geocoded_at", { mode: 'string' }),
});

export const coolerInventory = pgTable("cooler_inventory", {
	id: serial().primaryKey().notNull(),
	hostHomeId: varchar("host_home_id").notNull(),
	coolerTypeId: integer("cooler_type_id").notNull(),
	quantity: integer().default(0).notNull(),
	notes: text(),
	reportedAt: timestamp("reported_at", { mode: 'string' }).defaultNow().notNull(),
	reportedBy: varchar("reported_by").notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.coolerTypeId],
			foreignColumns: [coolerTypes.id],
			name: "cooler_inventory_cooler_type_id_cooler_types_id_fk"
		}),
]);

export const eventRequests = pgTable("event_requests", {
	id: serial().primaryKey().notNull(),
	firstName: varchar("first_name"),
	lastName: varchar("last_name"),
	email: varchar(),
	phone: varchar(),
	organizationName: varchar("organization_name"),
	department: varchar(),
	desiredEventDate: timestamp("desired_event_date", { mode: 'string' }),
	scheduledEventDate: timestamp("scheduled_event_date", { mode: 'string' }),
	message: text(),
	previouslyHosted: varchar("previously_hosted").default('i_dont_know').notNull(),
	status: varchar().default('new').notNull(),
	statusChangedAt: timestamp("status_changed_at", { mode: 'string' }),
	assignedTo: varchar("assigned_to"),
	followUpMethod: varchar("follow_up_method"),
	updatedEmail: varchar("updated_email"),
	followUpDate: timestamp("follow_up_date", { mode: 'string' }),
	scheduledCallDate: timestamp("scheduled_call_date", { mode: 'string' }),
	contactedAt: timestamp("contacted_at", { mode: 'string' }),
	communicationMethod: varchar("communication_method"),
	contactCompletionNotes: text("contact_completion_notes"),
	eventAddress: text("event_address"),
	estimatedSandwichCount: integer("estimated_sandwich_count"),
	hasRefrigeration: boolean("has_refrigeration"),
	completedByUserId: varchar("completed_by_user_id"),
	tspContactAssigned: varchar("tsp_contact_assigned"),
	tspContact: varchar("tsp_contact"),
	tspContactAssignedDate: timestamp("tsp_contact_assigned_date", { mode: 'string' }),
	additionalTspContacts: text("additional_tsp_contacts"),
	additionalContact1: varchar("additional_contact_1"),
	additionalContact2: varchar("additional_contact_2"),
	customTspContact: text("custom_tsp_contact"),
	toolkitSent: boolean("toolkit_sent").default(false),
	toolkitSentDate: timestamp("toolkit_sent_date", { mode: 'string' }),
	toolkitStatus: varchar("toolkit_status").default('not_sent'),
	toolkitSentBy: varchar("toolkit_sent_by"),
	eventStartTime: varchar("event_start_time"),
	eventEndTime: varchar("event_end_time"),
	pickupTime: varchar("pickup_time"),
	pickupDateTime: varchar("pickup_date_time"),
	additionalRequirements: text("additional_requirements"),
	planningNotes: text("planning_notes"),
	schedulingNotes: text("scheduling_notes"),
	sandwichTypes: jsonb("sandwich_types"),
	deliveryDestination: text("delivery_destination"),
	overnightHoldingLocation: text("overnight_holding_location"),
	overnightPickupTime: time("overnight_pickup_time"),
	driversNeeded: integer("drivers_needed").default(0),
	speakersNeeded: integer("speakers_needed").default(0),
	volunteersNeeded: integer("volunteers_needed").default(0),
	volunteerNotes: text("volunteer_notes"),
	assignedDriverIds: text("assigned_driver_ids").array(),
	driverPickupTime: varchar("driver_pickup_time"),
	driverNotes: text("driver_notes"),
	driversArranged: boolean("drivers_arranged").default(false),
	assignedSpeakerIds: text("assigned_speaker_ids").array(),
	assignedDriverSpeakers: text("assigned_driver_speakers").array(),
	assignedVolunteerIds: text("assigned_volunteer_ids").array(),
	assignedRecipientIds: text("assigned_recipient_ids").array(),
	vanDriverNeeded: boolean("van_driver_needed").default(false),
	assignedVanDriverId: text("assigned_van_driver_id"),
	customVanDriverName: text("custom_van_driver_name"),
	vanDriverNotes: text("van_driver_notes"),
	followUpOneDayCompleted: boolean("follow_up_one_day_completed").default(false),
	followUpOneDayDate: timestamp("follow_up_one_day_date", { mode: 'string' }),
	followUpOneMonthCompleted: boolean("follow_up_one_month_completed").default(false),
	followUpOneMonthDate: timestamp("follow_up_one_month_date", { mode: 'string' }),
	followUpNotes: text("follow_up_notes"),
	socialMediaPostRequested: boolean("social_media_post_requested").default(false),
	socialMediaPostRequestedDate: timestamp("social_media_post_requested_date", { mode: 'string' }),
	socialMediaPostCompleted: boolean("social_media_post_completed").default(false),
	socialMediaPostCompletedDate: timestamp("social_media_post_completed_date", { mode: 'string' }),
	socialMediaPostNotes: text("social_media_post_notes"),
	actualAttendance: integer("actual_attendance"),
	estimatedAttendance: integer("estimated_attendance"),
	attendanceRecordedDate: timestamp("attendance_recorded_date", { mode: 'string' }),
	attendanceRecordedBy: varchar("attendance_recorded_by"),
	attendanceNotes: text("attendance_notes"),
	actualSandwichCount: integer("actual_sandwich_count"),
	actualSandwichTypes: jsonb("actual_sandwich_types"),
	actualSandwichCountRecordedDate: timestamp("actual_sandwich_count_recorded_date", { mode: 'string' }),
	actualSandwichCountRecordedBy: varchar("actual_sandwich_count_recorded_by"),
	sandwichDistributions: jsonb("sandwich_distributions"),
	distributionRecordedDate: timestamp("distribution_recorded_date", { mode: 'string' }),
	distributionRecordedBy: varchar("distribution_recorded_by"),
	distributionNotes: text("distribution_notes"),
	organizationExists: boolean("organization_exists").default(false).notNull(),
	duplicateCheckDate: timestamp("duplicate_check_date", { mode: 'string' }),
	duplicateNotes: text("duplicate_notes"),
	contactAttempts: integer("contact_attempts").default(0),
	lastContactAttempt: timestamp("last_contact_attempt", { mode: 'string' }),
	isUnresponsive: boolean("is_unresponsive").default(false),
	markedUnresponsiveAt: timestamp("marked_unresponsive_at", { mode: 'string' }),
	markedUnresponsiveBy: varchar("marked_unresponsive_by"),
	unresponsiveReason: text("unresponsive_reason"),
	contactMethod: varchar("contact_method"),
	nextFollowUpDate: timestamp("next_follow_up_date", { mode: 'string' }),
	unresponsiveNotes: text("unresponsive_notes"),
	googleSheetRowId: text("google_sheet_row_id"),
	externalId: varchar("external_id").notNull(),
	lastSyncedAt: timestamp("last_synced_at", { mode: 'string' }),
	driverDetails: jsonb("driver_details"),
	speakerDetails: jsonb("speaker_details"),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
	createdBy: varchar("created_by"),
	volunteerCount: integer("volunteer_count"),
	organizationCategory: varchar("organization_category"),
	schoolClassification: varchar("school_classification"),
	adultCount: integer("adult_count"),
	childrenCount: integer("children_count"),
	estimatedSandwichCountMin: integer("estimated_sandwich_count_min"),
	estimatedSandwichCountMax: integer("estimated_sandwich_count_max"),
	estimatedSandwichRangeType: varchar("estimated_sandwich_range_type"),
	pickupTimeWindow: text("pickup_time_window"),
	pickupPersonResponsible: text("pickup_person_responsible"),
	speakerAudienceType: text("speaker_audience_type"),
	speakerDuration: text("speaker_duration"),
	deliveryTimeWindow: text("delivery_time_window"),
	deliveryParkingAccess: text("delivery_parking_access"),
	isConfirmed: boolean("is_confirmed").default(false).notNull(),
	addedToOfficialSheet: boolean("added_to_official_sheet").default(false).notNull(),
	deletedAt: timestamp("deleted_at", { mode: 'string' }),
	deletedBy: varchar("deleted_by"),
	backupDates: jsonb("backup_dates"),
	latitude: varchar(),
	longitude: varchar(),
	isMlkDayEvent: boolean("is_mlk_day_event").default(false),
	mlkDayMarkedAt: timestamp("mlk_day_marked_at", { mode: 'string' }),
	mlkDayMarkedBy: varchar("mlk_day_marked_by"),
	contactAttemptsLog: jsonb("contact_attempts_log"),
	version: integer().default(1).notNull(),
	autoCategories: jsonb("auto_categories"),
	categorizedAt: timestamp("categorized_at", { mode: 'string' }),
	categorizedBy: varchar("categorized_by"),
	postponementReason: text("postponement_reason"),
	tentativeNewDate: timestamp("tentative_new_date", { mode: 'string' }),
	postponementNotes: text("postponement_notes"),
	selfTransport: boolean("self_transport").default(false),
	attendanceAdults: integer("attendance_adults"),
	attendanceTeens: integer("attendance_teens"),
	attendanceKids: integer("attendance_kids"),
	pastDateNotificationSentAt: timestamp("past_date_notification_sent_at", { mode: 'string' }),
	backupContactFirstName: varchar("backup_contact_first_name"),
	backupContactLastName: varchar("backup_contact_last_name"),
	backupContactEmail: varchar("backup_contact_email"),
	backupContactPhone: varchar("backup_contact_phone"),
	backupContactRole: varchar("backup_contact_role"),
	preEventFlags: jsonb("pre_event_flags").default([]),
	partnerOrganizations: jsonb("partner_organizations"),
}, (table) => [
	index("idx_event_requests_backup_email").using("btree", table.backupContactEmail.asc().nullsLast().op("text_ops")),
	index("idx_event_requests_created_at").using("btree", table.createdAt.asc().nullsLast().op("timestamp_ops")),
	index("idx_event_requests_desired_date").using("btree", table.desiredEventDate.asc().nullsLast().op("timestamp_ops")),
	index("idx_event_requests_email").using("btree", table.email.asc().nullsLast().op("text_ops")),
	index("idx_event_requests_org_name").using("btree", table.organizationName.asc().nullsLast().op("text_ops")),
	index("idx_event_requests_pre_event_flags").using("gin", table.preEventFlags.asc().nullsLast().op("jsonb_ops")),
	index("idx_event_requests_scheduled_date").using("btree", table.scheduledEventDate.asc().nullsLast().op("timestamp_ops")),
	index("idx_event_requests_status").using("btree", table.status.asc().nullsLast().op("text_ops")),
	unique("event_requests_external_id_unique").on(table.externalId),
]);

export const onboardingProgress = pgTable("onboarding_progress", {
	id: serial().primaryKey().notNull(),
	userId: varchar("user_id").notNull(),
	challengeId: integer("challenge_id").notNull(),
	completedAt: timestamp("completed_at", { mode: 'string' }).defaultNow().notNull(),
	metadata: jsonb().default({}),
}, (table) => [
	unique("onboarding_progress_user_id_challenge_id_unique").on(table.userId, table.challengeId),
]);

export const teamBoardComments = pgTable("team_board_comments", {
	id: serial().primaryKey().notNull(),
	itemId: integer("item_id").notNull(),
	userId: varchar("user_id").notNull(),
	userName: varchar("user_name").notNull(),
	content: text().notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.itemId],
			foreignColumns: [teamBoardItems.id],
			name: "team_board_comments_item_id_team_board_items_id_fk"
		}).onDelete("cascade"),
]);

export const dashboardDocuments = pgTable("dashboard_documents", {
	id: serial().primaryKey().notNull(),
	documentId: varchar("document_id").notNull(),
	displayOrder: integer("display_order").default(0).notNull(),
	isActive: boolean("is_active").default(true).notNull(),
	addedBy: varchar("added_by"),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	unique("dashboard_documents_document_id_unique").on(table.documentId),
]);

export const availabilitySlots = pgTable("availability_slots", {
	id: serial().primaryKey().notNull(),
	userId: varchar("user_id").notNull(),
	startAt: timestamp("start_at", { mode: 'string' }).notNull(),
	endAt: timestamp("end_at", { mode: 'string' }).notNull(),
	status: varchar().notNull(),
	notes: text(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "availability_slots_user_id_users_id_fk"
		}).onDelete("cascade"),
]);

export const onboardingChallenges = pgTable("onboarding_challenges", {
	id: serial().primaryKey().notNull(),
	actionKey: varchar("action_key").notNull(),
	title: varchar().notNull(),
	description: text(),
	category: varchar().notNull(),
	points: integer().default(10).notNull(),
	icon: varchar(),
	order: integer().default(0).notNull(),
	isActive: boolean("is_active").default(true).notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	promotion: text(),
}, (table) => [
	unique("onboarding_challenges_action_key_unique").on(table.actionKey),
]);

export const featureFlags = pgTable("feature_flags", {
	id: serial().primaryKey().notNull(),
	flagName: varchar("flag_name", { length: 255 }).notNull(),
	description: text(),
	enabled: boolean().default(false).notNull(),
	enabledForUsers: jsonb("enabled_for_users").default([]),
	enabledForRoles: jsonb("enabled_for_roles").default([]),
	enabledPercentage: integer("enabled_percentage").default(0),
	metadata: jsonb().default({}),
	createdBy: varchar("created_by"),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	index("idx_feature_flags_enabled").using("btree", table.enabled.asc().nullsLast().op("bool_ops")),
	index("idx_feature_flags_flag_name").using("btree", table.flagName.asc().nullsLast().op("text_ops")),
	unique("feature_flags_flag_name_unique").on(table.flagName),
]);

export const teamBoardItems = pgTable("team_board_items", {
	id: serial().primaryKey().notNull(),
	content: text().notNull(),
	type: varchar().default('task'),
	createdBy: varchar("created_by").notNull(),
	createdByName: varchar("created_by_name").notNull(),
	assignedTo: text("assigned_to").array(),
	assignedToNames: text("assigned_to_names").array(),
	status: varchar().default('open').notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	completedAt: timestamp("completed_at", { mode: 'string' }),
	projectId: integer("project_id"),
	promotedToTaskId: integer("promoted_to_task_id"),
	promotedAt: timestamp("promoted_at", { mode: 'string' }),
	categoryId: integer("category_id"),
	isUrgent: boolean("is_urgent").default(false).notNull(),
	isPrivate: boolean("is_private").default(false).notNull(),
	details: text(),
	dueDate: timestamp("due_date", { mode: 'string' }),
	parentItemId: integer("parent_item_id"),
}, (table) => [
	foreignKey({
			columns: [table.categoryId],
			foreignColumns: [holdingZoneCategories.id],
			name: "team_board_items_category_id_holding_zone_categories_id_fk"
		}),
	foreignKey({
			columns: [table.parentItemId],
			foreignColumns: [table.id],
			name: "team_board_items_parent_item_id_team_board_items_id_fk"
		}),
]);

export const projects = pgTable("projects", {
	id: serial().primaryKey().notNull(),
	title: text().notNull(),
	description: text(),
	status: text().notNull(),
	priority: text().default('medium').notNull(),
	category: text().default('technology').notNull(),
	milestone: text(),
	assigneeId: integer("assignee_id"),
	assigneeName: text("assignee_name"),
	assigneeIds: jsonb("assignee_ids").default([]),
	assigneeNames: text("assignee_names"),
	supportPeopleIds: jsonb("support_people_ids").default([]),
	supportPeople: text("support_people"),
	dueDate: text("due_date"),
	startDate: text("start_date"),
	completionDate: text("completion_date"),
	progressPercentage: integer("progress_percentage").default(0).notNull(),
	notes: text(),
	requirements: text(),
	deliverables: text(),
	resources: text(),
	blockers: text(),
	tags: text(),
	estimatedHours: integer("estimated_hours"),
	actualHours: integer("actual_hours"),
	budget: varchar(),
	color: text().default('blue').notNull(),
	createdBy: varchar("created_by"),
	createdByName: varchar("created_by_name"),
	reviewInNextMeeting: boolean("review_in_next_meeting").default(false).notNull(),
	lastDiscussedDate: text("last_discussed_date"),
	meetingDiscussionPoints: text("meeting_discussion_points"),
	meetingDecisionItems: text("meeting_decision_items"),
	googleSheetRowId: text("google_sheet_row_id"),
	lastSyncedAt: timestamp("last_synced_at", { mode: 'string' }),
	syncStatus: text("sync_status").default('unsynced'),
	lastPulledFromSheetAt: timestamp("last_pulled_from_sheet_at", { mode: 'string' }),
	lastPushedToSheetAt: timestamp("last_pushed_to_sheet_at", { mode: 'string' }),
	lastSheetHash: text("last_sheet_hash"),
	lastAppHash: text("last_app_hash"),
	tasksAndOwners: text("tasks_and_owners"),
	estimatedhours: integer(),
	actualhours: integer(),
	startdate: text(),
	enddate: text(),
	risklevel: varchar(),
	stakeholders: text(),
	milestones: text(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
	ownerId: text("owner_id"),
	ownerName: text("owner_name"),
});

export const activities = pgTable("activities", {
	id: varchar().primaryKey().notNull(),
	type: varchar({ length: 50 }).notNull(),
	title: text().notNull(),
	content: text(),
	createdBy: varchar("created_by").notNull(),
	assignedTo: jsonb("assigned_to").default([]),
	status: varchar({ length: 50 }),
	priority: varchar({ length: 20 }),
	parentId: varchar("parent_id"),
	rootId: varchar("root_id"),
	contextType: varchar("context_type", { length: 50 }),
	contextId: varchar("context_id"),
	metadata: jsonb().default({}),
	isDeleted: boolean("is_deleted").default(false),
	threadCount: integer("thread_count").default(0),
	lastActivityAt: timestamp("last_activity_at", { mode: 'string' }).defaultNow(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	index("idx_activities_context").using("btree", table.contextType.asc().nullsLast().op("text_ops"), table.contextId.asc().nullsLast().op("text_ops")),
	index("idx_activities_created_at").using("btree", table.createdAt.asc().nullsLast().op("timestamp_ops")),
	index("idx_activities_created_by").using("btree", table.createdBy.asc().nullsLast().op("text_ops")),
	index("idx_activities_is_deleted").using("btree", table.isDeleted.asc().nullsLast().op("bool_ops")),
	index("idx_activities_last_activity").using("btree", table.lastActivityAt.asc().nullsLast().op("timestamp_ops")),
	index("idx_activities_parent_id").using("btree", table.parentId.asc().nullsLast().op("text_ops")),
	index("idx_activities_root_id").using("btree", table.rootId.asc().nullsLast().op("text_ops")),
	index("idx_activities_status").using("btree", table.status.asc().nullsLast().op("text_ops")),
	index("idx_activities_type").using("btree", table.type.asc().nullsLast().op("text_ops")),
]);

export const activityAttachments = pgTable("activity_attachments", {
	id: serial().primaryKey().notNull(),
	activityId: varchar("activity_id").notNull(),
	fileUrl: text("file_url").notNull(),
	fileType: varchar("file_type", { length: 100 }),
	fileName: text("file_name").notNull(),
	fileSize: integer("file_size"),
	uploadedBy: varchar("uploaded_by").notNull(),
	uploadedAt: timestamp("uploaded_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	index("idx_activity_attachments_activity").using("btree", table.activityId.asc().nullsLast().op("text_ops")),
	index("idx_activity_attachments_uploaded_by").using("btree", table.uploadedBy.asc().nullsLast().op("text_ops")),
]);

export const activityParticipants = pgTable("activity_participants", {
	id: serial().primaryKey().notNull(),
	activityId: varchar("activity_id").notNull(),
	userId: varchar("user_id").notNull(),
	role: varchar({ length: 50 }).notNull(),
	lastReadAt: timestamp("last_read_at", { mode: 'string' }),
	notificationsEnabled: boolean("notifications_enabled").default(true),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	index("idx_activity_participants_activity").using("btree", table.activityId.asc().nullsLast().op("text_ops")),
	index("idx_activity_participants_activity_user").using("btree", table.activityId.asc().nullsLast().op("text_ops"), table.userId.asc().nullsLast().op("text_ops")),
	index("idx_activity_participants_user").using("btree", table.userId.asc().nullsLast().op("text_ops")),
	unique("activity_participants_activity_id_user_id_role_unique").on(table.activityId, table.userId, table.role),
]);

export const activityReactions = pgTable("activity_reactions", {
	id: serial().primaryKey().notNull(),
	activityId: varchar("activity_id").notNull(),
	userId: varchar("user_id").notNull(),
	reactionType: varchar("reaction_type", { length: 50 }).notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	index("idx_activity_reactions_activity").using("btree", table.activityId.asc().nullsLast().op("text_ops")),
	index("idx_activity_reactions_user").using("btree", table.userId.asc().nullsLast().op("text_ops")),
	unique("activity_reactions_activity_id_user_id_reaction_type_unique").on(table.activityId, table.userId, table.reactionType),
]);

export const expenses = pgTable("expenses", {
	id: serial().primaryKey().notNull(),
	contextType: varchar("context_type", { length: 50 }),
	contextId: integer("context_id"),
	description: text().notNull(),
	amount: numeric({ precision: 10, scale:  2 }).notNull(),
	category: varchar({ length: 100 }),
	vendor: varchar({ length: 255 }),
	purchaseDate: timestamp("purchase_date", { mode: 'string' }),
	receiptUrl: text("receipt_url"),
	receiptFileName: text("receipt_file_name"),
	receiptFileSize: integer("receipt_file_size"),
	uploadedBy: varchar("uploaded_by").notNull(),
	uploadedAt: timestamp("uploaded_at", { mode: 'string' }).defaultNow(),
	approvedBy: varchar("approved_by"),
	approvedAt: timestamp("approved_at", { mode: 'string' }),
	status: varchar({ length: 50 }).default('pending').notNull(),
	notes: text(),
	metadata: jsonb().default({}),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	index("idx_expenses_category").using("btree", table.category.asc().nullsLast().op("text_ops")),
	index("idx_expenses_context").using("btree", table.contextType.asc().nullsLast().op("text_ops"), table.contextId.asc().nullsLast().op("text_ops")),
	index("idx_expenses_purchase_date").using("btree", table.purchaseDate.asc().nullsLast().op("timestamp_ops")),
	index("idx_expenses_status").using("btree", table.status.asc().nullsLast().op("text_ops")),
	index("idx_expenses_uploaded_by").using("btree", table.uploadedBy.asc().nullsLast().op("text_ops")),
]);

export const promotionGraphics = pgTable("promotion_graphics", {
	id: serial().primaryKey().notNull(),
	title: text().notNull(),
	description: text().notNull(),
	imageUrl: text("image_url").notNull(),
	fileName: text("file_name").notNull(),
	fileSize: integer("file_size"),
	fileType: varchar("file_type", { length: 100 }),
	intendedUseDate: timestamp("intended_use_date", { mode: 'string' }),
	targetAudience: text("target_audience").default('hosts'),
	status: varchar({ length: 50 }).default('active'),
	notificationSent: boolean("notification_sent").default(false),
	notificationSentAt: timestamp("notification_sent_at", { mode: 'string' }),
	uploadedBy: varchar("uploaded_by").notNull(),
	uploadedByName: text("uploaded_by_name").notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
	viewCount: integer("view_count").default(0),
}, (table) => [
	index("idx_promotion_graphics_intended_use_date").using("btree", table.intendedUseDate.asc().nullsLast().op("timestamp_ops")),
	index("idx_promotion_graphics_status").using("btree", table.status.asc().nullsLast().op("text_ops")),
	index("idx_promotion_graphics_target_audience").using("btree", table.targetAudience.asc().nullsLast().op("text_ops")),
	index("idx_promotion_graphics_uploaded_by").using("btree", table.uploadedBy.asc().nullsLast().op("text_ops")),
]);

export const authoritativeWeeklyCollections = pgTable("authoritative_weekly_collections", {
	id: serial().primaryKey().notNull(),
	weekDate: text("week_date").notNull(),
	location: text().notNull(),
	sandwiches: integer().notNull(),
	weekOfYear: integer("week_of_year").notNull(),
	weekOfProgram: integer("week_of_program").notNull(),
	year: integer().notNull(),
	importedAt: timestamp("imported_at", { mode: 'string' }).defaultNow().notNull(),
	sourceFile: text("source_file").default('New Sandwich Totals Scott (5)_1761847323011.xlsx'),
});

export const resourceTagAssignments = pgTable("resource_tag_assignments", {
	id: serial().primaryKey().notNull(),
	resourceId: integer("resource_id").notNull(),
	tagId: integer("tag_id").notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("idx_resource_tag_assignments_resource").using("btree", table.resourceId.asc().nullsLast().op("int4_ops")),
	index("idx_resource_tag_assignments_tag").using("btree", table.tagId.asc().nullsLast().op("int4_ops")),
	foreignKey({
			columns: [table.resourceId],
			foreignColumns: [resources.id],
			name: "resource_tag_assignments_resource_id_resources_id_fk"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.tagId],
			foreignColumns: [resourceTags.id],
			name: "resource_tag_assignments_tag_id_resource_tags_id_fk"
		}).onDelete("cascade"),
	unique("unique_resource_tag_assignment").on(table.resourceId, table.tagId),
]);

export const resources = pgTable("resources", {
	id: serial().primaryKey().notNull(),
	title: text().notNull(),
	description: text(),
	type: text().notNull(),
	category: text().notNull(),
	documentId: integer("document_id"),
	url: text(),
	icon: text(),
	iconColor: text("icon_color"),
	isPinnedGlobal: boolean("is_pinned_global").default(false).notNull(),
	pinnedOrder: integer("pinned_order"),
	accessCount: integer("access_count").default(0).notNull(),
	lastAccessedAt: timestamp("last_accessed_at", { mode: 'string' }),
	createdBy: varchar("created_by").notNull(),
	createdByName: text("created_by_name").notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
	isActive: boolean("is_active").default(true).notNull(),
}, (table) => [
	index("idx_resources_access_count").using("btree", table.accessCount.asc().nullsLast().op("int4_ops")),
	index("idx_resources_active").using("btree", table.isActive.asc().nullsLast().op("bool_ops")),
	index("idx_resources_category").using("btree", table.category.asc().nullsLast().op("text_ops")),
	index("idx_resources_pinned").using("btree", table.isPinnedGlobal.asc().nullsLast().op("bool_ops"), table.pinnedOrder.asc().nullsLast().op("int4_ops")),
	index("idx_resources_type").using("btree", table.type.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.documentId],
			foreignColumns: [documents.id],
			name: "resources_document_id_documents_id_fk"
		}).onDelete("cascade"),
]);

export const resourceTags = pgTable("resource_tags", {
	id: serial().primaryKey().notNull(),
	name: text().notNull(),
	color: text(),
	description: text(),
	createdBy: varchar("created_by").notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("idx_resource_tags_name").using("btree", table.name.asc().nullsLast().op("text_ops")),
	unique("resource_tags_name_unique").on(table.name),
]);

export const userResourceFavorites = pgTable("user_resource_favorites", {
	id: serial().primaryKey().notNull(),
	userId: varchar("user_id").notNull(),
	resourceId: integer("resource_id").notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("idx_user_resource_favorites_resource").using("btree", table.resourceId.asc().nullsLast().op("int4_ops")),
	index("idx_user_resource_favorites_user").using("btree", table.userId.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "user_resource_favorites_user_id_users_id_fk"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.resourceId],
			foreignColumns: [resources.id],
			name: "user_resource_favorites_resource_id_resources_id_fk"
		}).onDelete("cascade"),
	unique("unique_user_resource_favorite").on(table.userId, table.resourceId),
]);

export const dismissedAnnouncements = pgTable("dismissed_announcements", {
	id: serial().primaryKey().notNull(),
	userId: varchar("user_id").notNull(),
	announcementId: varchar("announcement_id").notNull(),
	dismissedAt: timestamp("dismissed_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("idx_dismissed_announcements_user").using("btree", table.userId.asc().nullsLast().op("text_ops")),
	unique("unique_user_announcement").on(table.userId, table.announcementId),
]);

export const searchAnalytics = pgTable("search_analytics", {
	id: serial().primaryKey().notNull(),
	query: text().notNull(),
	resultId: varchar("result_id"),
	clicked: boolean().default(false).notNull(),
	timestamp: timestamp({ mode: 'string' }).defaultNow().notNull(),
	userId: varchar("user_id"),
	userRole: varchar("user_role"),
	usedAi: boolean("used_ai").default(false).notNull(),
	resultsCount: integer("results_count").default(0).notNull(),
	queryTime: integer("query_time").default(0).notNull(),
}, (table) => [
	index("idx_search_analytics_clicked").using("btree", table.clicked.asc().nullsLast().op("bool_ops")),
	index("idx_search_analytics_query").using("btree", table.query.asc().nullsLast().op("text_ops")),
	index("idx_search_analytics_timestamp").using("btree", table.timestamp.asc().nullsLast().op("timestamp_ops")),
	index("idx_search_analytics_user").using("btree", table.userId.asc().nullsLast().op("text_ops")),
]);

export const notificationActionHistory = pgTable("notification_action_history", {
	id: serial().primaryKey().notNull(),
	notificationId: integer("notification_id").notNull(),
	userId: varchar("user_id").notNull(),
	actionType: varchar("action_type").notNull(),
	actionStatus: varchar("action_status").default('pending').notNull(),
	startedAt: timestamp("started_at", { mode: 'string' }).defaultNow().notNull(),
	completedAt: timestamp("completed_at", { mode: 'string' }),
	errorMessage: text("error_message"),
	relatedType: varchar("related_type"),
	relatedId: integer("related_id"),
	undoneAt: timestamp("undone_at", { mode: 'string' }),
	undoneBy: varchar("undone_by"),
	metadata: jsonb().default({}),
}, (table) => [
	index("idx_notif_action_history_notif").using("btree", table.notificationId.asc().nullsLast().op("int4_ops")),
	index("idx_notif_action_history_status").using("btree", table.actionStatus.asc().nullsLast().op("text_ops")),
	index("idx_notif_action_history_user").using("btree", table.userId.asc().nullsLast().op("text_ops"), table.actionType.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.notificationId],
			foreignColumns: [notifications.id],
			name: "notification_action_history_notification_id_notifications_id_fk"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "notification_action_history_user_id_users_id_fk"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.undoneBy],
			foreignColumns: [users.id],
			name: "notification_action_history_undone_by_users_id_fk"
		}),
]);

export const eventFieldLocks = pgTable("event_field_locks", {
	id: serial().primaryKey().notNull(),
	eventRequestId: integer("event_request_id").notNull(),
	fieldName: varchar("field_name").notNull(),
	lockedBy: varchar("locked_by").notNull(),
	lockedByName: varchar("locked_by_name").notNull(),
	lockedAt: timestamp("locked_at", { mode: 'string' }).defaultNow().notNull(),
	expiresAt: timestamp("expires_at", { mode: 'string' }).notNull(),
}, (table) => [
	index("idx_event_field_locks_event_id").using("btree", table.eventRequestId.asc().nullsLast().op("int4_ops")),
	index("idx_event_field_locks_expires_at").using("btree", table.expiresAt.asc().nullsLast().op("timestamp_ops")),
	foreignKey({
			columns: [table.eventRequestId],
			foreignColumns: [eventRequests.id],
			name: "event_field_locks_event_request_id_event_requests_id_fk"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.lockedBy],
			foreignColumns: [users.id],
			name: "event_field_locks_locked_by_users_id_fk"
		}),
	unique("event_field_locks_event_request_id_field_name_unique").on(table.eventRequestId, table.fieldName),
]);

export const eventCollaborationComments = pgTable("event_collaboration_comments", {
	id: serial().primaryKey().notNull(),
	eventRequestId: integer("event_request_id").notNull(),
	userId: varchar("user_id").notNull(),
	userName: varchar("user_name").notNull(),
	content: text().notNull(),
	parentCommentId: integer("parent_comment_id"),
	editedAt: timestamp("edited_at", { mode: 'string' }),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("idx_event_collab_comments_created_at").using("btree", table.createdAt.asc().nullsLast().op("timestamp_ops")),
	index("idx_event_collab_comments_event_id").using("btree", table.eventRequestId.asc().nullsLast().op("int4_ops")),
	index("idx_event_collab_comments_user_id").using("btree", table.userId.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.eventRequestId],
			foreignColumns: [eventRequests.id],
			name: "event_collaboration_comments_event_request_id_event_requests_id"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "event_collaboration_comments_user_id_users_id_fk"
		}),
]);

export const eventEditRevisions = pgTable("event_edit_revisions", {
	id: serial().primaryKey().notNull(),
	eventRequestId: integer("event_request_id").notNull(),
	fieldName: varchar("field_name").notNull(),
	oldValue: text("old_value"),
	newValue: text("new_value"),
	changedBy: varchar("changed_by").notNull(),
	changedByName: varchar("changed_by_name").notNull(),
	changeType: varchar("change_type").notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("idx_event_edit_revisions_created_at").using("btree", table.createdAt.asc().nullsLast().op("timestamp_ops")),
	index("idx_event_edit_revisions_event_id").using("btree", table.eventRequestId.asc().nullsLast().op("int4_ops")),
	index("idx_event_edit_revisions_field_name").using("btree", table.fieldName.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.eventRequestId],
			foreignColumns: [eventRequests.id],
			name: "event_edit_revisions_event_request_id_event_requests_id_fk"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.changedBy],
			foreignColumns: [users.id],
			name: "event_edit_revisions_changed_by_users_id_fk"
		}),
]);

export const meetingNotes = pgTable("meeting_notes", {
	id: serial().primaryKey().notNull(),
	projectId: integer("project_id"),
	meetingId: integer("meeting_id").notNull(),
	type: text().notNull(),
	content: text().notNull(),
	status: text().default('active').notNull(),
	createdBy: varchar("created_by"),
	createdByName: varchar("created_by_name"),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	convertedToTaskId: integer("converted_to_task_id"),
	convertedAt: timestamp("converted_at", { mode: 'string' }),
	selectedForAgenda: boolean("selected_for_agenda").default(false).notNull(),
});

export const projectTasks = pgTable("project_tasks", {
	id: serial().primaryKey().notNull(),
	projectId: integer("project_id"),
	title: text().notNull(),
	description: text(),
	status: text().default('pending').notNull(),
	priority: text().default('medium').notNull(),
	assigneeId: text("assignee_id"),
	assigneeName: text("assignee_name"),
	assigneeIds: text("assignee_ids").array(),
	assigneeNames: text("assignee_names").array(),
	dueDate: text("due_date"),
	completedAt: timestamp("completed_at", { mode: 'string' }),
	attachments: text(),
	order: integer().default(0).notNull(),
	orderNum: integer("order_num").default(0),
	completedBy: text("completed_by"),
	completedByName: text("completed_by_name"),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
	originType: text("origin_type").default('manual').notNull(),
	sourceNoteId: integer("source_note_id"),
	sourceMeetingId: integer("source_meeting_id"),
	sourceTeamBoardId: integer("source_team_board_id"),
	selectedForAgenda: boolean("selected_for_agenda").default(false).notNull(),
});

export const meetingProjects = pgTable("meeting_projects", {
	id: serial().primaryKey().notNull(),
	meetingId: integer("meeting_id").notNull(),
	projectId: integer("project_id").notNull(),
	discussionPoints: text("discussion_points"),
	questionsToAddress: text("questions_to_address"),
	discussionSummary: text("discussion_summary"),
	decisionsReached: text("decisions_reached"),
	status: text().default('planned').notNull(),
	includeInAgenda: boolean("include_in_agenda").default(true).notNull(),
	agendaOrder: integer("agenda_order"),
	section: text(),
	addedAt: timestamp("added_at", { mode: 'string' }).defaultNow().notNull(),
	addedBy: varchar("added_by"),
	discussedAt: timestamp("discussed_at", { mode: 'string' }),
}, (table) => [
	index("idx_meeting_projects_include").using("btree", table.includeInAgenda.asc().nullsLast().op("bool_ops")),
	index("idx_meeting_projects_meeting").using("btree", table.meetingId.asc().nullsLast().op("int4_ops")),
	index("idx_meeting_projects_project").using("btree", table.projectId.asc().nullsLast().op("int4_ops")),
	index("idx_meeting_projects_status").using("btree", table.status.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.meetingId],
			foreignColumns: [meetings.id],
			name: "meeting_projects_meeting_id_meetings_id_fk"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.projectId],
			foreignColumns: [projects.id],
			name: "meeting_projects_project_id_projects_id_fk"
		}).onDelete("cascade"),
	unique("meeting_projects_meeting_id_project_id_unique").on(table.meetingId, table.projectId),
]);

export const impactReports = pgTable("impact_reports", {
	id: serial().primaryKey().notNull(),
	reportType: varchar("report_type", { length: 50 }).notNull(),
	reportPeriod: varchar("report_period", { length: 50 }).notNull(),
	startDate: timestamp("start_date", { mode: 'string' }).notNull(),
	endDate: timestamp("end_date", { mode: 'string' }).notNull(),
	title: text().notNull(),
	executiveSummary: text("executive_summary").notNull(),
	content: text().notNull(),
	metrics: jsonb(),
	highlights: jsonb(),
	trends: jsonb(),
	generatedAt: timestamp("generated_at", { mode: 'string' }).defaultNow().notNull(),
	generatedBy: varchar("generated_by"),
	aiModel: varchar("ai_model", { length: 100 }),
	generationPrompt: text("generation_prompt"),
	regenerationCount: integer("regeneration_count").default(0),
	status: varchar({ length: 50 }).default('draft').notNull(),
	publishedAt: timestamp("published_at", { mode: 'string' }),
	publishedBy: varchar("published_by"),
	pdfUrl: text("pdf_url"),
	pdfGeneratedAt: timestamp("pdf_generated_at", { mode: 'string' }),
	tags: text().array(),
	notes: text(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("idx_impact_reports_period").using("btree", table.reportPeriod.asc().nullsLast().op("text_ops")),
	index("idx_impact_reports_start_date").using("btree", table.startDate.asc().nullsLast().op("timestamp_ops")),
	index("idx_impact_reports_status").using("btree", table.status.asc().nullsLast().op("text_ops")),
	index("idx_impact_reports_type").using("btree", table.reportType.asc().nullsLast().op("text_ops")),
	unique("unique_report_period_type").on(table.reportType, table.reportPeriod),
]);

export const teamBoardItemLikes = pgTable("team_board_item_likes", {
	id: serial().primaryKey().notNull(),
	itemId: integer("item_id").notNull(),
	userId: varchar("user_id").notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("idx_team_board_item_likes_item").using("btree", table.itemId.asc().nullsLast().op("int4_ops")),
	index("idx_team_board_item_likes_user").using("btree", table.userId.asc().nullsLast().op("text_ops")),
	uniqueIndex("unique_team_board_item_like").using("btree", table.itemId.asc().nullsLast().op("text_ops"), table.userId.asc().nullsLast().op("int4_ops")),
	foreignKey({
			columns: [table.itemId],
			foreignColumns: [teamBoardItems.id],
			name: "team_board_item_likes_item_id_team_board_items_id_fk"
		}).onDelete("cascade"),
]);

export const projectAssignments = pgTable("project_assignments", {
	id: serial().primaryKey().notNull(),
	projectId: integer("project_id").notNull(),
	userId: text("user_id").notNull(),
	userName: text("user_name").notNull(),
	role: text().notNull(),
	addedAt: timestamp("added_at", { mode: 'string' }).defaultNow().notNull(),
	addedBy: varchar("added_by"),
}, (table) => [
	index("idx_project_assignments_project").using("btree", table.projectId.asc().nullsLast().op("int4_ops")),
	index("idx_project_assignments_role").using("btree", table.role.asc().nullsLast().op("text_ops")),
	index("idx_project_assignments_user").using("btree", table.userId.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.projectId],
			foreignColumns: [projects.id],
			name: "project_assignments_project_id_projects_id_fk"
		}).onDelete("cascade"),
	unique("project_assignments_project_id_user_id_unique").on(table.projectId, table.userId),
]);

export const teamBoardAssignments = pgTable("team_board_assignments", {
	id: serial().primaryKey().notNull(),
	itemId: integer("item_id").notNull(),
	userId: text("user_id").notNull(),
	userName: text("user_name").notNull(),
	addedAt: timestamp("added_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("idx_team_board_assignments_item").using("btree", table.itemId.asc().nullsLast().op("int4_ops")),
	index("idx_team_board_assignments_user").using("btree", table.userId.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.itemId],
			foreignColumns: [teamBoardItems.id],
			name: "team_board_assignments_item_id_team_board_items_id_fk"
		}).onDelete("cascade"),
	unique("team_board_assignments_item_id_user_id_unique").on(table.itemId, table.userId),
]);

export const taskAssignments = pgTable("task_assignments", {
	id: serial().primaryKey().notNull(),
	taskId: integer("task_id").notNull(),
	userId: text("user_id").notNull(),
	userName: text("user_name").notNull(),
	role: text().default('assignee').notNull(),
	addedAt: timestamp("added_at", { mode: 'string' }).defaultNow().notNull(),
	addedBy: varchar("added_by"),
}, (table) => [
	index("idx_task_assignments_task").using("btree", table.taskId.asc().nullsLast().op("int4_ops")),
	index("idx_task_assignments_user").using("btree", table.userId.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.taskId],
			foreignColumns: [projectTasks.id],
			name: "task_assignments_task_id_project_tasks_id_fk"
		}).onDelete("cascade"),
	unique("task_assignments_task_id_user_id_unique").on(table.taskId, table.userId),
]);

export const holdingZoneCategories = pgTable("holding_zone_categories", {
	id: serial().primaryKey().notNull(),
	name: varchar({ length: 100 }).notNull(),
	color: varchar({ length: 50 }).notNull(),
	createdBy: varchar("created_by").notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	isActive: boolean("is_active").default(true).notNull(),
});

export const organizationEngagementScores = pgTable("organization_engagement_scores", {
	id: serial().primaryKey().notNull(),
	organizationName: varchar("organization_name").notNull(),
	canonicalName: varchar("canonical_name").notNull(),
	category: varchar(),
	overallEngagementScore: numeric("overall_engagement_score", { precision: 5, scale:  2 }).default('50.00').notNull(),
	frequencyScore: numeric("frequency_score", { precision: 5, scale:  2 }).default('0'),
	recencyScore: numeric("recency_score", { precision: 5, scale:  2 }).default('0'),
	volumeScore: numeric("volume_score", { precision: 5, scale:  2 }).default('0'),
	completionScore: numeric("completion_score", { precision: 5, scale:  2 }).default('0'),
	consistencyScore: numeric("consistency_score", { precision: 5, scale:  2 }).default('0'),
	engagementTrend: varchar("engagement_trend").default('stable'),
	trendPercentChange: numeric("trend_percent_change", { precision: 5, scale:  2 }).default('0'),
	totalEvents: integer("total_events").default(0).notNull(),
	completedEvents: integer("completed_events").default(0).notNull(),
	totalSandwiches: integer("total_sandwiches").default(0).notNull(),
	daysSinceLastEvent: integer("days_since_last_event"),
	daysSinceFirstEvent: integer("days_since_first_event"),
	lastEventDate: timestamp("last_event_date", { mode: 'string' }),
	firstEventDate: timestamp("first_event_date", { mode: 'string' }),
	averageEventInterval: integer("average_event_interval"),
	engagementLevel: varchar("engagement_level").default('unknown').notNull(),
	outreachPriority: varchar("outreach_priority").default('normal'),
	recommendedActions: jsonb("recommended_actions").default([]),
	insights: jsonb().default([]),
	programSuitability: jsonb("program_suitability").default([]),
	lastCalculatedAt: timestamp("last_calculated_at", { mode: 'string' }).defaultNow().notNull(),
	calculationVersion: varchar("calculation_version").default('1.0'),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("idx_org_engagement_canonical").using("btree", table.canonicalName.asc().nullsLast().op("text_ops")),
	index("idx_org_engagement_category").using("btree", table.category.asc().nullsLast().op("text_ops")),
	index("idx_org_engagement_last_calc").using("btree", table.lastCalculatedAt.asc().nullsLast().op("timestamp_ops")),
	index("idx_org_engagement_level").using("btree", table.engagementLevel.asc().nullsLast().op("text_ops")),
	index("idx_org_engagement_priority").using("btree", table.outreachPriority.asc().nullsLast().op("text_ops")),
	index("idx_org_engagement_score").using("btree", table.overallEngagementScore.asc().nullsLast().op("numeric_ops")),
	unique("organization_engagement_scores_canonical_name_unique").on(table.canonicalName),
]);

export const alertRequests = pgTable("alert_requests", {
	id: serial().primaryKey().notNull(),
	userId: varchar("user_id").notNull(),
	alertDescription: text("alert_description").notNull(),
	preferredChannel: varchar("preferred_channel").default('no_preference').notNull(),
	frequency: varchar().default('immediate').notNull(),
	additionalNotes: text("additional_notes"),
	status: varchar().default('pending').notNull(),
	adminNotes: text("admin_notes"),
	reviewedBy: varchar("reviewed_by"),
	reviewedAt: timestamp("reviewed_at", { mode: 'string' }),
	implementedAt: timestamp("implemented_at", { mode: 'string' }),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("idx_alert_requests_created").using("btree", table.createdAt.asc().nullsLast().op("timestamp_ops")),
	index("idx_alert_requests_status").using("btree", table.status.asc().nullsLast().op("text_ops")),
	index("idx_alert_requests_user").using("btree", table.userId.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "alert_requests_user_id_users_id_fk"
		}),
	foreignKey({
			columns: [table.reviewedBy],
			foreignColumns: [users.id],
			name: "alert_requests_reviewed_by_users_id_fk"
		}),
]);

export const conversationParticipants = pgTable("conversation_participants", {
	conversationId: integer("conversation_id").notNull(),
	userId: text("user_id").notNull(),
	joinedAt: timestamp("joined_at", { mode: 'string' }).defaultNow(),
	lastReadAt: timestamp("last_read_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	foreignKey({
			columns: [table.conversationId],
			foreignColumns: [conversations.id],
			name: "conversation_participants_conversation_id_conversations_id_fk"
		}).onDelete("cascade"),
	primaryKey({ columns: [table.conversationId, table.userId], name: "conversation_participants_conversation_id_user_id_pk"}),
]);
