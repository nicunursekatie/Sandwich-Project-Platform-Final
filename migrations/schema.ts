import { pgTable, serial, text, boolean, timestamp, integer, index, varchar, unique, jsonb, time, foreignKey, numeric, real, primaryKey } from "drizzle-orm/pg-core"
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
}, (table) => [
	index("idx_event_volunteers_event_id").using("btree", table.eventRequestId.asc().nullsLast().op("int4_ops")),
	index("idx_event_volunteers_role_status").using("btree", table.role.asc().nullsLast().op("text_ops"), table.status.asc().nullsLast().op("text_ops")),
	index("idx_event_volunteers_volunteer").using("btree", table.volunteerUserId.asc().nullsLast().op("text_ops")),
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
	pickupDateTime: timestamp("pickup_date_time", { mode: 'string' }),
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
}, (table) => [
	index("idx_event_requests_desired_date").using("btree", table.desiredEventDate.asc().nullsLast().op("timestamp_ops")),
	index("idx_event_requests_email").using("btree", table.email.asc().nullsLast().op("text_ops")),
	index("idx_event_requests_org_name").using("btree", table.organizationName.asc().nullsLast().op("text_ops")),
	index("idx_event_requests_status").using("btree", table.status.asc().nullsLast().op("text_ops")),
	unique("event_requests_external_id_unique").on(table.externalId),
]);

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
	index("idx_document_access_action_time").using("btree", table.action.asc().nullsLast().op("text_ops"), table.accessedAt.asc().nullsLast().op("text_ops")),
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

export const meetingNotes = pgTable("meeting_notes", {
	id: serial().primaryKey().notNull(),
	projectId: integer("project_id").notNull(),
	meetingId: integer("meeting_id"),
	type: text().notNull(),
	content: text().notNull(),
	status: text().default('active').notNull(),
	createdBy: varchar("created_by"),
	createdByName: varchar("created_by_name"),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
});

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
	index("idx_message_recipients_unread").using("btree", table.recipientId.asc().nullsLast().op("text_ops"), table.read.asc().nullsLast().op("bool_ops")),
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
	index("idx_notif_ab_tests_active").using("btree", table.status.asc().nullsLast().op("text_ops"), table.startDate.asc().nullsLast().op("text_ops"), table.endDate.asc().nullsLast().op("text_ops")),
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
	index("idx_notif_history_notif_user").using("btree", table.notificationId.asc().nullsLast().op("int4_ops"), table.userId.asc().nullsLast().op("text_ops")),
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
	index("idx_notif_analytics_period").using("btree", table.periodType.asc().nullsLast().op("text_ops"), table.periodStart.asc().nullsLast().op("timestamp_ops")),
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
}, (table) => [
	foreignKey({
			columns: [table.conversationId],
			foreignColumns: [conversations.id],
			name: "messages_conversation_id_conversations_id_fk"
		}).onDelete("cascade"),
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
}, (table) => [
	index("idx_organizations_name").using("btree", table.name.asc().nullsLast().op("text_ops")),
]);

export const projectAssignments = pgTable("project_assignments", {
	id: serial().primaryKey().notNull(),
	projectId: integer("project_id").notNull(),
	userId: text("user_id").notNull(),
	role: text().default('member').notNull(),
	assignedAt: timestamp("assigned_at", { mode: 'string' }).defaultNow().notNull(),
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

export const projectTasks = pgTable("project_tasks", {
	id: serial().primaryKey().notNull(),
	projectId: integer("project_id").notNull(),
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
});

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
	focusArea: text("focus_area"),
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
});

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
	index("idx_user_activity_user_time").using("btree", table.userId.asc().nullsLast().op("timestamp_ops"), table.createdAt.asc().nullsLast().op("text_ops")),
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
});

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
	index("idx_document_permissions_doc").using("btree", table.documentId.asc().nullsLast().op("int4_ops"), table.permissionType.asc().nullsLast().op("int4_ops")),
	index("idx_document_permissions_doc_user").using("btree", table.documentId.asc().nullsLast().op("int4_ops"), table.userId.asc().nullsLast().op("text_ops")),
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
	index("idx_recipient_tsp_contacts_primary").using("btree", table.recipientId.asc().nullsLast().op("bool_ops"), table.isPrimary.asc().nullsLast().op("int4_ops")),
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

export const playingWithNeon = pgTable("playing_with_neon", {
	id: serial().primaryKey().notNull(),
	name: text().notNull(),
	value: real(),
});

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
}, (table) => [
	unique("users_email_unique").on(table.email),
]);

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
});

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
