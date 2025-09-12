import { pgTable, serial, text, boolean, timestamp, integer, check, unique, varchar, jsonb, index, date, numeric, foreignKey, inet, primaryKey, pgView, bigint } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"



export const driveLinks = pgTable("drive_links", {
	id: serial().primaryKey().notNull(),
	title: text().notNull(),
	description: text().notNull(),
	url: text().notNull(),
	icon: text().notNull(),
	iconColor: text("icon_color").notNull(),
});

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

export const agendaItems = pgTable("agenda_items", {
	id: serial().primaryKey().notNull(),
	submittedBy: text("submitted_by").notNull(),
	title: text().notNull(),
	description: text(),
	status: text().default('pending').notNull(),
	submittedAt: timestamp("submitted_at", { mode: 'string' }).defaultNow().notNull(),
	meetingId: integer("meeting_id").default(1).notNull(),
});

export const hosts = pgTable("hosts", {
	id: serial().primaryKey().notNull(),
	name: text().notNull(),
	email: text(),
	phone: text(),
	status: text().default('active').notNull(),
	notes: text(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
	address: text(),
}, (table) => [
	check("hosts_name_not_empty", sql`(name IS NOT NULL) AND (TRIM(BOTH FROM name) <> ''::text)`),
]);

export const users = pgTable("users", {
	id: varchar().primaryKey().notNull(),
	email: varchar(),
	firstName: varchar("first_name"),
	lastName: varchar("last_name"),
	profileImageUrl: varchar("profile_image_url"),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
	role: varchar().default('volunteer'),
	permissions: jsonb().default([]),
	isActive: boolean("is_active").default(true),
	metadata: jsonb(),
	displayName: varchar("display_name"),
	password: varchar({ length: 255 }),
	lastLoginAt: timestamp("last_login_at", { mode: 'string' }),
}, (table) => [
	unique("users_email_unique").on(table.email),
]);

export const meetings = pgTable("meetings", {
	id: serial().primaryKey().notNull(),
	title: text().notNull(),
	date: text().notNull(),
	time: text().notNull(),
	finalAgenda: text("final_agenda"),
	status: text().default('planning').notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	type: text().notNull(),
	location: text(),
	description: text(),
});

export const weeklyReports = pgTable("weekly_reports", {
	id: serial().primaryKey().notNull(),
	weekEnding: text("week_ending").notNull(),
	sandwichCount: integer("sandwich_count").notNull(),
	notes: text(),
	submittedBy: text("submitted_by").notNull(),
	submittedAt: timestamp("submitted_at", { mode: 'string' }).defaultNow().notNull(),
});

export const sandwichCollections = pgTable("sandwich_collections", {
	id: serial().primaryKey().notNull(),
	collectionDate: text("collection_date").notNull(),
	hostName: text("host_name").notNull(),
	individualSandwiches: integer("individual_sandwiches").notNull(),
	submittedAt: timestamp("submitted_at", { mode: 'string' }).defaultNow().notNull(),
	createdBy: varchar("created_by", { length: 255 }),
	createdByName: varchar("created_by_name", { length: 255 }),
	group1Name: text("group1_name"),
	group1Count: integer("group1_count"),
	group2Name: text("group2_name"),
	group2Count: integer("group2_count"),
	submissionMethod: text("submission_method").default('standard'),
	groupCollections: jsonb("group_collections").default([]).notNull(),
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

export const sessions = pgTable("sessions", {
	sid: varchar().primaryKey().notNull(),
	sess: jsonb().notNull(),
	expire: timestamp({ mode: 'string' }).notNull(),
}, (table) => [
	index("IDX_session_expire").using("btree", table.expire.asc().nullsLast().op("timestamp_ops")),
	index("idx_session_expire").using("btree", table.expire.asc().nullsLast().op("timestamp_ops")),
	index("idx_sessions_expire").using("btree", table.expire.asc().nullsLast().op("timestamp_ops")),
]);

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

export const hostContacts = pgTable("host_contacts", {
	id: serial().primaryKey().notNull(),
	hostId: integer("host_id").notNull(),
	name: text().notNull(),
	role: text().notNull(),
	phone: text().notNull(),
	email: text(),
	isPrimary: boolean("is_primary").default(false).notNull(),
	notes: text(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
	hostLocation: varchar("host_location", { length: 255 }),
});

export const projects = pgTable("projects", {
	id: serial().primaryKey().notNull(),
	title: text().notNull(),
	description: text(),
	status: text().notNull(),
	assigneeId: integer("assignee_id"),
	assigneeName: text("assignee_name"),
	color: text().default('blue').notNull(),
	priority: text().default('medium').notNull(),
	category: text().default('general').notNull(),
	dueDate: text("due_date"),
	startDate: text("start_date"),
	completionDate: text("completion_date"),
	progressPercentage: integer("progress_percentage").default(0).notNull(),
	notes: text(),
	tags: text(),
	estimatedHours: integer("estimated_hours"),
	actualHours: integer("actual_hours"),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
	requirements: text(),
	deliverables: text(),
	resources: text(),
	blockers: text(),
	estimatedhours: integer(),
	actualhours: integer(),
	startdate: date(),
	enddate: date(),
	budget: numeric({ precision: 10, scale:  2 }),
	risklevel: varchar({ length: 50 }),
	stakeholders: text(),
	milestones: text(),
	assigneeIds: jsonb("assignee_ids").default([]),
	assigneeNames: text("assignee_names"),
	createdBy: varchar("created_by", { length: 255 }),
	createdByName: varchar("created_by_name", { length: 255 }),
	supportPeopleIds: jsonb("support_people_ids").default([]),
	supportPeople: text("support_people"),
	reviewInNextMeeting: boolean("review_in_next_meeting").default(false),
	syncStatus: text("sync_status").default('unsynced'),
	lastSyncedAt: timestamp("last_synced_at", { mode: 'string' }),
	googleSheetRowId: text("google_sheet_row_id"),
	tasksAndOwners: text("tasks_and_owners"),
	lastDiscussedDate: text("last_discussed_date"),
	milestone: text(),
	meetingDiscussionPoints: text("meeting_discussion_points"),
	meetingDecisionItems: text("meeting_decision_items"),
});

export const projectComments = pgTable("project_comments", {
	id: serial().primaryKey().notNull(),
	content: text().notNull(),
	authorName: text("author_name").notNull(),
	commentType: varchar("comment_type", { length: 50 }).default('general').notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	projectId: integer("project_id").notNull(),
}, (table) => [
	foreignKey({
			columns: [table.projectId],
			foreignColumns: [projects.id],
			name: "project_comments_project_id_fkey"
		}).onDelete("cascade"),
]);

export const projectTasks = pgTable("project_tasks", {
	id: serial().primaryKey().notNull(),
	title: text().notNull(),
	description: text(),
	status: varchar({ length: 50 }).default('pending').notNull(),
	priority: varchar({ length: 50 }).default('medium').notNull(),
	assigneeName: text("assignee_name"),
	dueDate: text("due_date"),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
	orderNum: integer("order_num").default(0).notNull(),
	projectId: integer("project_id").notNull(),
	completedAt: timestamp("completed_at", { mode: 'string' }),
	order: integer().default(0).notNull(),
	attachments: text(),
	assigneeId: text("assignee_id"),
	assigneeIds: text("assignee_ids").array(),
	assigneeNames: text("assignee_names").array(),
	completedBy: text("completed_by"),
	completedByName: text("completed_by_name"),
}, (table) => [
	foreignKey({
			columns: [table.projectId],
			foreignColumns: [projects.id],
			name: "project_tasks_project_id_fkey"
		}).onDelete("cascade"),
]);

export const projectAssignments = pgTable("project_assignments", {
	id: serial().primaryKey().notNull(),
	projectId: integer("project_id").notNull(),
	userId: text("user_id").notNull(),
	role: text().default('member').notNull(),
	assignedAt: timestamp("assigned_at", { mode: 'string' }).defaultNow().notNull(),
});

export const notifications = pgTable("notifications", {
	id: serial().primaryKey().notNull(),
	userId: varchar("user_id").notNull(),
	type: varchar().notNull(),
	title: text().notNull(),
	message: text().notNull(),
	isRead: boolean("is_read").default(false).notNull(),
	relatedType: varchar("related_type"),
	relatedId: integer("related_id"),
	celebrationData: jsonb("celebration_data"),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
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
	createdAt: timestamp("created_at", { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
	updatedAt: timestamp("updated_at", { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
});

export const contacts = pgTable("contacts", {
	id: serial().primaryKey().notNull(),
	name: text().notNull(),
	phone: text(),
	email: text(),
	role: text().default('volunteer'),
	notes: text(),
	isActive: boolean("is_active").default(true).notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
	organization: text(),
	address: text(),
	category: text(),
	status: text().default('active'),
});

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
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
	vanApproved: boolean("van_approved").default(false),
	homeAddress: text("home_address"),
	availabilityNotes: text("availability_notes"),
	emailAgreementSent: boolean("email_agreement_sent").default(false),
	voicemailLeft: boolean("voicemail_left").default(false),
	inactiveReason: text("inactive_reason"),
	hostId: integer("host_id"),
	routeDescription: text("route_description"),
	hostLocation: text("host_location"),
	area: text(),
});

export const committees = pgTable("committees", {
	id: serial().primaryKey().notNull(),
	name: varchar({ length: 255 }).notNull(),
	description: text(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	isActive: boolean("is_active").default(true),
	updatedAt: timestamp("updated_at", { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
	unique("committees_name_key").on(table.name),
]);

export const committeeMemberships = pgTable("committee_memberships", {
	id: serial().primaryKey().notNull(),
	committeeId: integer("committee_id"),
	userId: varchar("user_id", { length: 255 }).notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	role: varchar({ length: 100 }).default('member'),
	permissions: text().array(),
	joinedAt: timestamp("joined_at", { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
	isActive: boolean("is_active").default(true).notNull(),
}, (table) => [
	foreignKey({
			columns: [table.committeeId],
			foreignColumns: [committees.id],
			name: "committee_memberships_committee_id_fkey"
		}).onDelete("cascade"),
	unique("committee_memberships_committee_id_user_id_key").on(table.committeeId, table.userId),
]);

export const taskCompletions = pgTable("task_completions", {
	id: serial().primaryKey().notNull(),
	taskId: integer("task_id").notNull(),
	userId: text("user_id").notNull(),
	userName: text("user_name").notNull(),
	completedAt: timestamp("completed_at", { mode: 'string' }).defaultNow().notNull(),
	notes: text(),
}, (table) => [
	foreignKey({
			columns: [table.taskId],
			foreignColumns: [projectTasks.id],
			name: "task_completions_task_id_fkey"
		}).onDelete("cascade"),
	unique("task_completions_task_id_user_id_key").on(table.taskId, table.userId),
]);

export const conversations = pgTable("conversations", {
	id: serial().primaryKey().notNull(),
	type: varchar({ length: 20 }).notNull(),
	name: varchar({ length: 255 }),
	createdAt: timestamp("created_at", { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
	check("conversations_type_check", sql`(type)::text = ANY ((ARRAY['direct'::character varying, 'group'::character varying, 'channel'::character varying])::text[])`),
]);

export const projectCongratulations = pgTable("project_congratulations", {
	id: serial().primaryKey().notNull(),
	projectId: integer("project_id").notNull(),
	userId: text("user_id").notNull(),
	userName: text("user_name").notNull(),
	message: text().notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	foreignKey({
			columns: [table.projectId],
			foreignColumns: [projects.id],
			name: "project_congratulations_project_id_fkey"
		}),
]);

export const messages = pgTable("messages", {
	id: serial().primaryKey().notNull(),
	conversationId: integer("conversation_id"),
	userId: text("user_id").notNull(),
	content: text().notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
	sender: text(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
	senderId: text("sender_id").notNull(),
	contextType: text("context_type"),
	contextId: text("context_id"),
	editedAt: timestamp("edited_at", { mode: 'string' }),
	editedContent: text("edited_content"),
	deletedAt: timestamp("deleted_at", { mode: 'string' }),
	deletedBy: text("deleted_by"),
	read: boolean().default(false),
	replyToMessageId: integer("reply_to_message_id"),
	replyToContent: text("reply_to_content"),
	replyToSender: text("reply_to_sender"),
}, (table) => [
	index("idx_messages_context").using("btree", table.contextType.asc().nullsLast().op("text_ops"), table.contextId.asc().nullsLast().op("text_ops")).where(sql`(context_type IS NOT NULL)`),
	index("idx_messages_context_lookup").using("btree", table.contextId.asc().nullsLast().op("text_ops")).where(sql`(context_type IS NOT NULL)`),
	index("idx_messages_conversation_id").using("btree", table.conversationId.asc().nullsLast().op("int4_ops")),
	index("idx_messages_created_at").using("btree", table.createdAt.asc().nullsLast().op("timestamp_ops")),
	index("idx_messages_deleted").using("btree", table.deletedAt.asc().nullsLast().op("timestamp_ops")).where(sql`(deleted_at IS NULL)`),
	index("idx_messages_sender").using("btree", table.senderId.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.replyToMessageId],
			foreignColumns: [table.id],
			name: "messages_reply_to_message_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.conversationId],
			foreignColumns: [conversations.id],
			name: "messages_conversation_id_fkey"
		}).onDelete("cascade"),
	check("chk_messages_context_type", sql`(context_type = ANY (ARRAY['suggestion'::text, 'project'::text, 'task'::text, 'direct'::text])) OR (context_type IS NULL)`),
	check("chk_messages_edit", sql`((edited_at IS NULL) AND (edited_content IS NULL)) OR ((edited_at IS NOT NULL) AND (edited_content IS NOT NULL))`),
]);

export const groupMemberships = pgTable("group_memberships", {
	id: serial().primaryKey().notNull(),
	userId: varchar("user_id", { length: 255 }).notNull(),
	groupId: integer("group_id").notNull(),
	role: varchar({ length: 50 }).default('member'),
	isActive: boolean("is_active").default(true),
	joinedAt: timestamp("joined_at", { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
	createdAt: timestamp("created_at", { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
	updatedAt: timestamp("updated_at", { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
});

export const messageRecipients = pgTable("message_recipients", {
	id: serial().primaryKey().notNull(),
	messageId: integer("message_id").notNull(),
	recipientId: text("recipient_id").notNull(),
	read: boolean().default(false).notNull(),
	readAt: timestamp("read_at", { mode: 'string' }),
	notificationSent: boolean("notification_sent").default(false).notNull(),
	emailSentAt: timestamp("email_sent_at", { mode: 'string' }),
	contextAccessRevoked: boolean("context_access_revoked").default(false),
	createdAt: timestamp("created_at", { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
	index("idx_message_recipients_email_pending").using("btree", table.recipientId.asc().nullsLast().op("timestamp_ops"), table.read.asc().nullsLast().op("timestamp_ops"), table.emailSentAt.asc().nullsLast().op("text_ops")).where(sql`((read = false) AND (email_sent_at IS NULL))`),
	index("idx_message_recipients_message").using("btree", table.messageId.asc().nullsLast().op("int4_ops")),
	index("idx_message_recipients_recipient").using("btree", table.recipientId.asc().nullsLast().op("text_ops")),
	index("idx_message_recipients_unread").using("btree", table.recipientId.asc().nullsLast().op("text_ops"), table.read.asc().nullsLast().op("text_ops")).where(sql`(read = false)`),
	index("idx_message_recipients_unread_counts").using("btree", table.recipientId.asc().nullsLast().op("text_ops"), table.read.asc().nullsLast().op("text_ops"), table.messageId.asc().nullsLast().op("int4_ops")).where(sql`(read = false)`),
	foreignKey({
			columns: [table.messageId],
			foreignColumns: [messages.id],
			name: "message_recipients_message_id_fkey"
		}).onDelete("cascade"),
	unique("uq_message_recipient").on(table.messageId, table.recipientId),
]);

export const suggestions = pgTable("suggestions", {
	id: serial().primaryKey().notNull(),
	title: text().notNull(),
	description: text().notNull(),
	category: text().default('general').notNull(),
	priority: text().default('medium').notNull(),
	status: text().default('submitted').notNull(),
	submittedBy: varchar("submitted_by", { length: 255 }).notNull(),
	submitterEmail: varchar("submitter_email", { length: 255 }),
	submitterName: text("submitter_name"),
	isAnonymous: boolean("is_anonymous").default(false).notNull(),
	upvotes: integer().default(0).notNull(),
	tags: text().array().default([""]),
	implementationNotes: text("implementation_notes"),
	estimatedEffort: text("estimated_effort"),
	assignedTo: varchar("assigned_to", { length: 255 }),
	completedAt: timestamp("completed_at", { mode: 'string' }),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
});

export const suggestionResponses = pgTable("suggestion_responses", {
	id: serial().primaryKey().notNull(),
	suggestionId: integer("suggestion_id").notNull(),
	message: text().notNull(),
	isAdminResponse: boolean("is_admin_response").default(false).notNull(),
	respondedBy: varchar("responded_by", { length: 255 }).notNull(),
	respondentName: text("respondent_name"),
	isInternal: boolean("is_internal").default(false).notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
});

export const messageThreads = pgTable("message_threads", {
	id: serial().primaryKey().notNull(),
	rootMessageId: integer("root_message_id"),
	messageId: integer("message_id").notNull(),
	depth: integer().default(0).notNull(),
	path: text().notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
	index("idx_thread_depth").using("btree", table.depth.asc().nullsLast().op("int4_ops")),
	index("idx_thread_path").using("btree", table.path.asc().nullsLast().op("text_pattern_ops")),
	index("idx_thread_root").using("btree", table.rootMessageId.asc().nullsLast().op("int4_ops")),
	index("idx_thread_traversal").using("btree", table.rootMessageId.asc().nullsLast().op("text_ops"), table.path.asc().nullsLast().op("text_ops"), table.depth.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.rootMessageId],
			foreignColumns: [messages.id],
			name: "message_threads_root_message_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.messageId],
			foreignColumns: [messages.id],
			name: "message_threads_message_id_fkey"
		}).onDelete("cascade"),
	unique("uq_message_thread").on(table.messageId),
	check("message_threads_depth_check", sql`depth >= 0`),
]);

export const workLogs = pgTable("work_logs", {
	id: serial().primaryKey().notNull(),
	userId: varchar("user_id").notNull(),
	description: text().notNull(),
	hours: integer().default(0).notNull(),
	minutes: integer().default(0).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
	status: varchar({ length: 20 }).default('pending'),
	approvedBy: varchar("approved_by"),
	approvedAt: timestamp("approved_at", { withTimezone: true, mode: 'string' }),
	visibility: varchar({ length: 20 }).default('private'),
	sharedWith: jsonb("shared_with").default([]),
	department: varchar({ length: 50 }),
	teamId: varchar("team_id", { length: 50 }),
	workDate: timestamp("work_date", { withTimezone: true, mode: 'string' }),
}, (table) => [
	index("idx_work_logs_status").using("btree", table.status.asc().nullsLast().op("text_ops")),
	index("idx_work_logs_user_id").using("btree", table.userId.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "work_logs_user_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.approvedBy],
			foreignColumns: [users.id],
			name: "work_logs_approved_by_fkey"
		}),
]);

export const chatMessageReads = pgTable("chat_message_reads", {
	id: serial().primaryKey().notNull(),
	messageId: integer("message_id"),
	userId: varchar("user_id").notNull(),
	channel: varchar().notNull(),
	readAt: timestamp("read_at", { mode: 'string' }).defaultNow(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	index("idx_chat_reads_channel_user").using("btree", table.channel.asc().nullsLast().op("text_ops"), table.userId.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.messageId],
			foreignColumns: [chatMessages.id],
			name: "chat_message_reads_message_id_fkey"
		}).onDelete("cascade"),
	unique("chat_message_reads_message_id_user_id_key").on(table.messageId, table.userId),
]);

export const kudosTracking = pgTable("kudos_tracking", {
	id: serial().primaryKey().notNull(),
	senderId: text("sender_id").notNull(),
	recipientId: text("recipient_id").notNull(),
	contextType: text("context_type").notNull(),
	contextId: text("context_id").notNull(),
	messageId: integer("message_id"),
	sentAt: timestamp("sent_at", { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
	index("idx_kudos_context").using("btree", table.contextType.asc().nullsLast().op("text_ops"), table.contextId.asc().nullsLast().op("text_ops")),
	index("idx_kudos_recipient").using("btree", table.recipientId.asc().nullsLast().op("text_ops")),
	index("idx_kudos_sender").using("btree", table.senderId.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.messageId],
			foreignColumns: [messages.id],
			name: "kudos_tracking_message_id_fkey"
		}).onDelete("cascade"),
	unique("uq_kudos_unique").on(table.senderId, table.recipientId, table.contextType, table.contextId),
	check("kudos_tracking_context_type_check", sql`context_type = ANY (ARRAY['project'::text, 'task'::text])`),
]);

export const messageReads = pgTable("message_reads", {
	id: serial().primaryKey().notNull(),
	messageId: integer("message_id").notNull(),
	userId: text("user_id").notNull(),
	readAt: timestamp("read_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	index("idx_message_reads_message").using("btree", table.messageId.asc().nullsLast().op("int4_ops")),
	index("idx_message_reads_user").using("btree", table.userId.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.messageId],
			foreignColumns: [messages.id],
			name: "message_reads_message_id_fkey"
		}).onDelete("cascade"),
	unique("message_reads_message_id_user_id_key").on(table.messageId, table.userId),
]);

export const chatMessages = pgTable("chat_messages", {
	id: serial().primaryKey().notNull(),
	channel: varchar().default('general').notNull(),
	userId: varchar("user_id").notNull(),
	userName: varchar("user_name").notNull(),
	content: text().notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	editedAt: timestamp("edited_at", { mode: 'string' }),
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
});

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

export const messageLikes = pgTable("message_likes", {
	id: serial().primaryKey().notNull(),
	messageId: integer("message_id").notNull(),
	userId: text("user_id").notNull(),
	userName: text("user_name").notNull(),
	likedAt: timestamp("liked_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	unique("message_likes_message_id_user_id_key").on(table.messageId, table.userId),
]);

export const chatMessageLikes = pgTable("chat_message_likes", {
	id: serial().primaryKey().notNull(),
	messageId: integer("message_id").notNull(),
	userId: varchar("user_id").notNull(),
	userName: varchar("user_name").notNull(),
	likedAt: timestamp("liked_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	foreignKey({
			columns: [table.messageId],
			foreignColumns: [chatMessages.id],
			name: "chat_message_likes_message_id_fkey"
		}).onDelete("cascade"),
	unique("chat_message_likes_message_id_user_id_key").on(table.messageId, table.userId),
]);

export const volunteers = pgTable("volunteers", {
	id: serial().primaryKey().notNull(),
	name: text(),
	phone: text(),
	email: text(),
	address: text(),
	notes: text(),
	isActive: boolean("is_active").default(true),
	vehicleType: text("vehicle_type"),
	licenseNumber: text("license_number"),
	availability: text(),
	zone: text(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
	vanApproved: boolean("van_approved").default(false),
	homeAddress: text("home_address"),
	availabilityNotes: text("availability_notes"),
	emailAgreementSent: boolean("email_agreement_sent").default(false),
	voicemailLeft: boolean("voicemail_left").default(false),
	inactiveReason: text("inactive_reason"),
	hostId: integer("host_id"),
	routeDescription: text("route_description"),
	hostLocation: text("host_location"),
	volunteerType: text("volunteer_type").default('general'),
});

export const userActivityLogs = pgTable("user_activity_logs", {
	id: serial().primaryKey().notNull(),
	userId: varchar("user_id", { length: 255 }).notNull(),
	sessionId: varchar("session_id", { length: 255 }),
	action: varchar({ length: 100 }).notNull(),
	page: varchar({ length: 255 }),
	feature: varchar({ length: 100 }),
	ipAddress: inet("ip_address"),
	userAgent: text("user_agent"),
	metadata: jsonb(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	section: varchar(),
	details: jsonb().default({}),
	duration: integer(),
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
	unique("sandwich_distributions_host_id_recipient_id_distribution_da_key").on(table.distributionDate, table.hostId, table.recipientId),
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
	index("idx_recipient_tsp_contacts_primary").using("btree", table.recipientId.asc().nullsLast().op("int4_ops"), table.isPrimary.asc().nullsLast().op("int4_ops")),
	index("idx_recipient_tsp_contacts_recipient").using("btree", table.recipientId.asc().nullsLast().op("int4_ops")),
	index("idx_recipient_tsp_contacts_user").using("btree", table.userId.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.recipientId],
			foreignColumns: [recipients.id],
			name: "recipient_tsp_contacts_recipient_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "recipient_tsp_contacts_user_id_fkey"
		}).onDelete("set null"),
]);

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
	createdAt: timestamp("created_at", { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	reviewedAt: timestamp("reviewed_at", { mode: 'string' }),
	reviewedBy: varchar("reviewed_by"),
});

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
	foreignKey({
			columns: [table.documentId],
			foreignColumns: [documents.id],
			name: "document_access_logs_document_id_fkey"
		}).onDelete("cascade"),
]);

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
});

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
	foreignKey({
			columns: [table.documentId],
			foreignColumns: [documents.id],
			name: "document_permissions_document_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "document_permissions_user_id_fkey"
		}).onDelete("cascade"),
	unique("document_permissions_document_id_user_id_permission_type_key").on(table.documentId, table.userId, table.permissionType),
]);

export const organizations = pgTable("organizations", {
	id: serial().primaryKey().notNull(),
	name: varchar().notNull(),
	alternateNames: text("alternate_names").array(),
	addresses: text().array(),
	domains: text().array(),
	totalEvents: integer("total_events").default(0).notNull(),
	lastEventDate: timestamp("last_event_date", { mode: 'string' }),
	category: varchar(),
	description: text(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
});

export const recipients = pgTable("recipients", {
	id: serial().primaryKey().notNull(),
	name: text().notNull(),
	phone: text().notNull(),
	email: text(),
	address: text(),
	preferences: text(),
	status: text().default('active').notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
	contactName: text("contact_name"),
	weeklyEstimate: integer("weekly_estimate"),
	region: text(),
	contactPersonName: text("contact_person_name"),
	contactPersonPhone: text("contact_person_phone"),
	contactPersonEmail: text("contact_person_email"),
	contactPersonRole: text("contact_person_role"),
	reportingGroup: text("reporting_group"),
	estimatedSandwiches: integer("estimated_sandwiches"),
	sandwichType: text("sandwich_type"),
	tspContact: text("tsp_contact"),
	tspContactUserId: varchar("tsp_contact_user_id"),
	contractSigned: boolean("contract_signed").default(false).notNull(),
	contractSignedDate: timestamp("contract_signed_date", { mode: 'string' }),
	website: text(),
	focusArea: text("focus_area"),
	instagramHandle: text("instagram_handle"),
	secondContactPersonName: text("second_contact_person_name"),
	secondContactPersonPhone: text("second_contact_person_phone"),
	secondContactPersonEmail: text("second_contact_person_email"),
	secondContactPersonRole: text("second_contact_person_role"),
});

export const auditLogs = pgTable("audit_logs", {
	id: serial().primaryKey().notNull(),
	action: varchar({ length: 255 }).notNull(),
	tableName: varchar("table_name", { length: 255 }).notNull(),
	recordId: varchar("record_id", { length: 255 }).notNull(),
	oldData: text("old_data"),
	newData: text("new_data"),
	userId: varchar("user_id", { length: 255 }),
	ipAddress: varchar("ip_address", { length: 255 }),
	userAgent: text("user_agent"),
	sessionId: varchar("session_id", { length: 255 }),
	timestamp: timestamp({ mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
});

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
	role: varchar().default('general').notNull(),
	status: varchar().default('pending').notNull(),
	notes: text(),
	assignedBy: varchar("assigned_by"),
	signedUpAt: timestamp("signed_up_at", { mode: 'string' }).defaultNow().notNull(),
	confirmedAt: timestamp("confirmed_at", { mode: 'string' }),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("idx_event_volunteers_event_id").using("btree", table.eventRequestId.asc().nullsLast().op("int4_ops")),
	index("idx_event_volunteers_role_status").using("btree", table.role.asc().nullsLast().op("text_ops"), table.status.asc().nullsLast().op("text_ops")),
	index("idx_event_volunteers_volunteer").using("btree", table.volunteerUserId.asc().nullsLast().op("text_ops")),
]);

export const eventRequests = pgTable("event_requests", {
	id: serial().primaryKey().notNull(),
	firstName: varchar("first_name").notNull(),
	lastName: varchar("last_name").notNull(),
	email: varchar().notNull(),
	phone: varchar(),
	organizationName: varchar("organization_name").notNull(),
	department: varchar(),
	desiredEventDate: timestamp("desired_event_date", { mode: 'string' }),
	message: text(),
	previouslyHosted: text("previously_hosted").default('i_dont_know'),
	status: text().default('new'),
	assignedTo: varchar("assigned_to"),
	organizationExists: boolean("organization_exists").default(false),
	duplicateNotes: text("duplicate_notes"),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
	duplicateCheckDate: timestamp("duplicate_check_date", { mode: 'string' }),
	lastSyncedAt: timestamp("last_synced_at", { mode: 'string' }),
	createdBy: varchar("created_by"),
	contactedAt: timestamp("contacted_at", { mode: 'string' }),
	communicationMethod: varchar("communication_method"),
	contactCompletionNotes: text("contact_completion_notes"),
	eventAddress: text("event_address"),
	estimatedSandwichCount: integer("estimated_sandwich_count"),
	hasRefrigeration: boolean("has_refrigeration"),
	completedByUserId: varchar("completed_by_user_id"),
	tspContactAssigned: varchar("tsp_contact_assigned"),
	toolkitSent: boolean("toolkit_sent").default(false),
	toolkitSentDate: timestamp("toolkit_sent_date", { mode: 'string' }),
	eventStartTime: varchar("event_start_time"),
	eventEndTime: varchar("event_end_time"),
	pickupTime: varchar("pickup_time"),
	additionalRequirements: text("additional_requirements"),
	planningNotes: text("planning_notes"),
	tspContact: varchar("tsp_contact"),
	additionalTspContacts: text("additional_tsp_contacts"),
	customTspContact: text("custom_tsp_contact"),
	toolkitStatus: varchar("toolkit_status").default('not_sent'),
	sandwichTypes: varchar("sandwich_types"),
	driversArranged: boolean("drivers_arranged").default(false),
	driverDetails: text("driver_details"),
	speakerDetails: text("speaker_details"),
	followUpOneDayCompleted: boolean("follow_up_one_day_completed").default(false),
	followUpOneDayDate: timestamp("follow_up_one_day_date", { mode: 'string' }),
	followUpOneMonthCompleted: boolean("follow_up_one_month_completed").default(false),
	followUpOneMonthDate: timestamp("follow_up_one_month_date", { mode: 'string' }),
	followUpNotes: text("follow_up_notes"),
	additionalContact1: varchar("additional_contact_1"),
	additionalContact2: varchar("additional_contact_2"),
	assignedDriverIds: text("assigned_driver_ids").array(),
	driverPickupTime: varchar("driver_pickup_time"),
	driverNotes: text("driver_notes"),
	driversNeeded: integer("drivers_needed").default(0),
	volunteerNotes: text("volunteer_notes"),
	speakersNeeded: integer("speakers_needed").default(0),
	contactAttempts: integer("contact_attempts").default(0),
	lastContactAttempt: timestamp("last_contact_attempt", { mode: 'string' }),
	isUnresponsive: boolean("is_unresponsive").default(false),
	markedUnresponsiveAt: timestamp("marked_unresponsive_at", { mode: 'string' }),
	markedUnresponsiveBy: varchar("marked_unresponsive_by"),
	unresponsiveReason: text("unresponsive_reason"),
	contactMethod: varchar("contact_method"),
	nextFollowUpDate: timestamp("next_follow_up_date", { mode: 'string' }),
	unresponsiveNotes: text("unresponsive_notes"),
	followUpMethod: varchar("follow_up_method", { length: 10 }),
	updatedEmail: varchar("updated_email", { length: 255 }),
	followUpDate: timestamp("follow_up_date", { mode: 'string' }),
	deliveryDestination: text("delivery_destination"),
	assignedSpeakerIds: text("assigned_speaker_ids").array(),
	vanDriverNeeded: boolean("van_driver_needed").default(false),
	assignedVanDriverId: text("assigned_van_driver_id"),
	customVanDriverName: text("custom_van_driver_name"),
	vanDriverNotes: text("van_driver_notes"),
	socialMediaPostRequested: boolean("social_media_post_requested").default(false),
	socialMediaPostRequestedDate: timestamp("social_media_post_requested_date", { mode: 'string' }),
	socialMediaPostCompleted: boolean("social_media_post_completed").default(false),
	socialMediaPostCompletedDate: timestamp("social_media_post_completed_date", { mode: 'string' }),
	socialMediaPostNotes: text("social_media_post_notes"),
	actualSandwichCount: integer("actual_sandwich_count"),
	actualSandwichTypes: text("actual_sandwich_types"),
	actualSandwichCountRecordedDate: timestamp("actual_sandwich_count_recorded_date", { mode: 'string' }),
	actualSandwichCountRecordedBy: varchar("actual_sandwich_count_recorded_by"),
	sandwichDistributions: jsonb("sandwich_distributions"),
	distributionRecordedDate: timestamp("distribution_recorded_date", { mode: 'string' }),
	distributionRecordedBy: varchar("distribution_recorded_by"),
	distributionNotes: text("distribution_notes"),
	volunteersNeeded: boolean("volunteers_needed").default(false),
	assignedVolunteerIds: text("assigned_volunteer_ids").array().default([""]),
	assignedDriverSpeakers: text("assigned_driver_speakers").array(),
});

export const conversationParticipants = pgTable("conversation_participants", {
	conversationId: integer("conversation_id").notNull(),
	userId: text("user_id").notNull(),
	joinedAt: timestamp("joined_at", { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
	lastReadAt: timestamp("last_read_at", { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
	index("idx_conversation_participants_user_id").using("btree", table.userId.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.conversationId],
			foreignColumns: [conversations.id],
			name: "conversation_participants_conversation_id_fkey"
		}).onDelete("cascade"),
	primaryKey({ columns: [table.conversationId, table.userId], name: "conversation_participants_pkey"}),
]);
export const vMessageThreads = pgView("v_message_threads", {	id: integer(),
	rootMessageId: integer("root_message_id"),
	messageId: integer("message_id"),
	depth: integer(),
	path: text(),
	createdAt: timestamp("created_at", { mode: 'string' }),
	senderId: text("sender_id"),
	content: text(),
	editedContent: text("edited_content"),
	messageCreatedAt: timestamp("message_created_at", { mode: 'string' }),
	contextType: text("context_type"),
	contextId: text("context_id"),
}).as(sql`SELECT mt.id, mt.root_message_id, mt.message_id, mt.depth, mt.path, mt.created_at, m.sender_id, m.content, m.edited_content, m.created_at AS message_created_at, m.context_type, m.context_id FROM message_threads mt JOIN messages m ON m.id = mt.message_id WHERE m.deleted_at IS NULL ORDER BY mt.path`);

export const vUnreadCounts = pgView("v_unread_counts", {	recipientId: text("recipient_id"),
	contextType: text("context_type"),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	unreadCount: bigint("unread_count", { mode: "number" }),
	sendername: text(),
	senderId: varchar("sender_id"),
}).as(sql`SELECT mr.recipient_id, m.context_type, count(*) AS unread_count, (u.first_name::text || ' '::text) || u.last_name::text AS sendername, u.id AS sender_id FROM message_recipients mr JOIN messages m ON m.id = mr.message_id JOIN users u ON m.sender_id = u.id::text WHERE mr.read = false AND m.deleted_at IS NULL AND mr.context_access_revoked = false AND u.id IS NOT NULL GROUP BY mr.recipient_id, m.context_type, u.id, u.first_name, u.last_name`);