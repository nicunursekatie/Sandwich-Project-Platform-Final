import { pgTable, serial, text, timestamp, integer, varchar, boolean, check, jsonb, unique, inet, numeric, pgView, bigint, pgSequence } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"
import { createInsertSchema } from "drizzle-zod"


export const archivedProjectsIdSeq = pgSequence("archived_projects_id_seq", {  startWith: "1", increment: "1", minValue: "1", maxValue: "2147483647", cache: "1", cycle: false })

export const agendaItems = pgTable("agenda_items", {
        id: serial().notNull(),
        submittedBy: text("submitted_by").notNull(),
        title: text().notNull(),
        description: text(),
        status: text().default('pending').notNull(),
        submittedAt: timestamp("submitted_at", { mode: 'string' }).defaultNow().notNull(),
        meetingId: integer("meeting_id").default(1).notNull(),
});

export const announcements = pgTable("announcements", {
        id: serial().notNull(),
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

export const auditLogs = pgTable("audit_logs", {
        id: serial().notNull(),
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

export const chatMessageLikes = pgTable("chat_message_likes", {
        id: serial().notNull(),
        messageId: integer("message_id").notNull(),
        userId: varchar("user_id").notNull(),
        userName: varchar("user_name").notNull(),
        likedAt: timestamp("liked_at", { mode: 'string' }).defaultNow(),
});

export const chatMessageReads = pgTable("chat_message_reads", {
        id: serial().notNull(),
        messageId: integer("message_id"),
        userId: varchar("user_id").notNull(),
        channel: varchar().notNull(),
        readAt: timestamp("read_at", { mode: 'string' }).defaultNow(),
        createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
});

export const chatMessages = pgTable("chat_messages", {
        id: serial().notNull(),
        channel: varchar().default('general').notNull(),
        userId: varchar("user_id").notNull(),
        userName: varchar("user_name").notNull(),
        content: text().notNull(),
        createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
        editedAt: timestamp("edited_at", { mode: 'string' }),
});

export const committeeMemberships = pgTable("committee_memberships", {
        id: serial().notNull(),
        committeeId: integer("committee_id"),
        userId: varchar("user_id", { length: 255 }).notNull(),
        createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
        role: varchar({ length: 100 }).default('member'),
        permissions: text().array(),
        joinedAt: timestamp("joined_at", { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
        isActive: boolean("is_active").default(true).notNull(),
});

export const committees = pgTable("committees", {
        id: serial().notNull(),
        name: varchar({ length: 255 }).notNull(),
        description: text(),
        createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
        isActive: boolean("is_active").default(true),
        updatedAt: timestamp("updated_at", { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
});

export const contacts = pgTable("contacts", {
        id: serial().notNull(),
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

export const conversationParticipants = pgTable("conversation_participants", {
        conversationId: integer("conversation_id").notNull(),
        userId: text("user_id").notNull(),
        joinedAt: timestamp("joined_at", { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
        lastReadAt: timestamp("last_read_at", { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
});

export const conversations = pgTable("conversations", {
        id: serial().notNull(),
        type: varchar({ length: 20 }).notNull(),
        name: varchar({ length: 255 }),
        createdAt: timestamp("created_at", { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
        check("conversations_type_check", sql`(type)::text = ANY (ARRAY[('direct'::character varying)::text, ('group'::character varying)::text, ('channel'::character varying)::text])`),
]);

export const documentAccessLogs = pgTable("document_access_logs", {
        id: serial().notNull(),
        documentId: integer("document_id").notNull(),
        userId: varchar("user_id").notNull(),
        userName: text("user_name").notNull(),
        action: text().notNull(),
        ipAddress: varchar("ip_address"),
        userAgent: text("user_agent"),
        sessionId: varchar("session_id"),
        accessedAt: timestamp("accessed_at", { mode: 'string' }).defaultNow().notNull(),
});

export const documentPermissions = pgTable("document_permissions", {
        id: serial().notNull(),
        documentId: integer("document_id").notNull(),
        userId: varchar("user_id").notNull(),
        permissionType: text("permission_type").notNull(),
        grantedBy: varchar("granted_by").notNull(),
        grantedByName: text("granted_by_name").notNull(),
        grantedAt: timestamp("granted_at", { mode: 'string' }).defaultNow().notNull(),
        expiresAt: timestamp("expires_at", { mode: 'string' }),
        notes: text(),
        isActive: boolean("is_active").default(true).notNull(),
});

export const documents = pgTable("documents", {
        id: serial().notNull(),
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

export const driveLinks = pgTable("drive_links", {
        id: serial().notNull(),
        title: text().notNull(),
        description: text().notNull(),
        url: text().notNull(),
        icon: text().notNull(),
        iconColor: text("icon_color").notNull(),
});

export const driverAgreements = pgTable("driver_agreements", {
        id: serial().notNull(),
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
        id: serial().notNull(),
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
});

export const emailDrafts = pgTable("email_drafts", {
        id: serial().notNull(),
        userId: varchar("user_id").notNull(),
        recipientId: varchar("recipient_id").notNull(),
        recipientName: varchar("recipient_name").notNull(),
        subject: text().notNull(),
        content: text().notNull(),
        lastSaved: timestamp("last_saved", { mode: 'string' }).defaultNow(),
        createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
});

export const emailMessages = pgTable("email_messages", {
        id: serial().notNull(),
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
});

export const eventReminders = pgTable("event_reminders", {
        id: serial().notNull(),
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
});

export const eventRequests = pgTable("event_requests", {
        id: serial().notNull(),
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
        assignedDriverIds: jsonb("assigned_driver_ids"),
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
        storageLocation: text("storage_location"),
        finalDeliveryMethod: varchar("final_delivery_method"),
        overnightStorageRequired: boolean("overnight_storage_required").default(false),
        transportDriver1: varchar("transport_driver_1", { length: 255 }),
        transportDriver2: varchar("transport_driver_2", { length: 255 }),
        pickupOrganization: varchar("pickup_organization", { length: 255 }),
        finalRecipientOrg: varchar("final_recipient_org", { length: 255 }),
        assignedSpeakerIds: jsonb("assigned_speaker_ids"),
});

export const eventVolunteers = pgTable("event_volunteers", {
        id: serial().notNull(),
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
});

export const groupMemberships = pgTable("group_memberships", {
        id: serial().notNull(),
        userId: varchar("user_id", { length: 255 }).notNull(),
        groupId: integer("group_id").notNull(),
        role: varchar({ length: 50 }).default('member'),
        isActive: boolean("is_active").default(true),
        joinedAt: timestamp("joined_at", { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
        createdAt: timestamp("created_at", { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
        updatedAt: timestamp("updated_at", { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
});

export const hostContacts = pgTable("host_contacts", {
        id: serial().notNull(),
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

export const hostedFiles = pgTable("hosted_files", {
        id: serial().notNull(),
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
        id: serial().notNull(),
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
        email: varchar().notNull(),
        firstName: varchar("first_name"),
        lastName: varchar("last_name"),
        profileImageUrl: varchar("profile_image_url"),
        createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
        updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
        role: varchar().default('volunteer'),
        permissions: jsonb().default([]),
        isActive: boolean("is_active").default(true),
        metadata: jsonb().default({}),
}, (table) => [
        unique("users_email_unique").on(table.email),
]);

export const messageLikes = pgTable("message_likes", {
        id: serial().notNull(),
        messageId: integer("message_id").notNull(),
        userId: text("user_id").notNull(),
        userName: text("user_name").notNull(),
        likedAt: timestamp("liked_at", { mode: 'string' }).defaultNow(),
});

export const kudosTracking = pgTable("kudos_tracking", {
        id: serial().notNull(),
        senderId: text("sender_id").notNull(),
        recipientId: text("recipient_id").notNull(),
        contextType: text("context_type").notNull(),
        contextId: text("context_id").notNull(),
        messageId: integer("message_id"),
        sentAt: timestamp("sent_at", { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
        check("kudos_tracking_context_type_check", sql`context_type = ANY (ARRAY['project'::text, 'task'::text])`),
]);

export const meetingMinutes = pgTable("meeting_minutes", {
        id: serial().notNull(),
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

export const meetings = pgTable("meetings", {
        id: serial().notNull(),
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

export const messageReads = pgTable("message_reads", {
        id: serial().notNull(),
        messageId: integer("message_id").notNull(),
        userId: text("user_id").notNull(),
        readAt: timestamp("read_at", { mode: 'string' }).defaultNow(),
});

export const messageRecipients = pgTable("message_recipients", {
        id: serial().notNull(),
        messageId: integer("message_id").notNull(),
        recipientId: text("recipient_id").notNull(),
        read: boolean().default(false).notNull(),
        readAt: timestamp("read_at", { mode: 'string' }),
        notificationSent: boolean("notification_sent").default(false).notNull(),
        emailSentAt: timestamp("email_sent_at", { mode: 'string' }),
        contextAccessRevoked: boolean("context_access_revoked").default(false),
        createdAt: timestamp("created_at", { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
});

export const messageThreads = pgTable("message_threads", {
        id: serial().notNull(),
        rootMessageId: integer("root_message_id"),
        messageId: integer("message_id").notNull(),
        depth: integer().default(0).notNull(),
        path: text().notNull(),
        createdAt: timestamp("created_at", { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
        check("message_threads_depth_check", sql`depth >= 0`),
]);

export const projects = pgTable("projects", {
        id: serial().primaryKey().notNull(),
        title: text().notNull(),
        description: text(),
        status: text().default('pending'),
        assigneeId: varchar("assignee_id"),
        priority: text().default('medium'),
        category: text().default('general'),
        dueDate: timestamp("due_date", { mode: 'string' }),
        startDate: timestamp("start_date", { mode: 'string' }),
        completionDate: timestamp("completion_date", { mode: 'string' }),
        progressPercentage: integer("progress_percentage").default(0),
        notes: text(),
        tags: text(),
        estimatedHours: integer("estimated_hours"),
        actualHours: integer("actual_hours"),
        createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
        updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
        requirements: text(),
        deliverables: text(),
        resources: text(),
        blockers: text(),
        assigneeIds: jsonb("assignee_ids").default([]),
        createdBy: varchar("created_by"),
});

export const projectTasks = pgTable("project_tasks", {
        id: serial().primaryKey().notNull(),
        title: text(),
        description: text(),
        status: varchar().default('pending'),
        dueDate: timestamp("due_date", { mode: 'string' }),
        createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
        updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
        projectId: integer("project_id"),
        completedAt: timestamp("completed_at", { mode: 'string' }),
        assigneeId: varchar("assignee_id"),
        assigneeIds: jsonb("assignee_ids"),
        completedBy: varchar("completed_by"),
});

export const messages = pgTable("messages", {
        id: serial().notNull(),
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
        check("chk_messages_context_type", sql`(context_type = ANY (ARRAY['suggestion'::text, 'project'::text, 'task'::text, 'direct'::text])) OR (context_type IS NULL)`),
        check("chk_messages_edit", sql`((edited_at IS NULL) AND (edited_content IS NULL)) OR ((edited_at IS NOT NULL) AND (edited_content IS NOT NULL))`),
]);

export const notifications = pgTable("notifications", {
        id: serial().notNull(),
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

export const organizations = pgTable("organizations", {
        id: serial().notNull(),
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

export const projectAssignments = pgTable("project_assignments", {
        id: serial().notNull(),
        projectId: integer("project_id").notNull(),
        userId: text("user_id").notNull(),
        role: text().default('member').notNull(),
        assignedAt: timestamp("assigned_at", { mode: 'string' }).defaultNow().notNull(),
});

export const projectComments = pgTable("project_comments", {
        id: serial().notNull(),
        content: text().notNull(),
        authorName: text("author_name").notNull(),
        commentType: varchar("comment_type", { length: 50 }).default('general').notNull(),
        createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
        projectId: integer("project_id").notNull(),
});

export const projectCongratulations = pgTable("project_congratulations", {
        id: serial().notNull(),
        projectId: integer("project_id").notNull(),
        userId: text("user_id").notNull(),
        userName: text("user_name").notNull(),
        message: text().notNull(),
        createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
});

export const projectDocuments = pgTable("project_documents", {
        id: serial().notNull(),
        projectId: integer("project_id").notNull(),
        fileName: text("file_name").notNull(),
        originalName: text("original_name").notNull(),
        fileSize: integer("file_size").notNull(),
        mimeType: text("mime_type").notNull(),
        uploadedBy: text("uploaded_by").notNull(),
        uploadedAt: timestamp("uploaded_at", { mode: 'string' }).defaultNow().notNull(),
});

export const recipientTspContacts = pgTable("recipient_tsp_contacts", {
        id: serial().notNull(),
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
});

export const recipients = pgTable("recipients", {
        id: serial().notNull(),
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

export const sandwichCollections = pgTable("sandwich_collections", {
        id: serial().notNull(),
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
});

export const sandwichDistributions = pgTable("sandwich_distributions", {
        id: serial().notNull(),
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
});

export const sessions = pgTable("sessions", {
        sid: varchar().notNull(),
        sess: jsonb().notNull(),
        expire: timestamp({ mode: 'string' }).notNull(),
});

export const suggestionResponses = pgTable("suggestion_responses", {
        id: serial().notNull(),
        suggestionId: integer("suggestion_id").notNull(),
        message: text().notNull(),
        isAdminResponse: boolean("is_admin_response").default(false).notNull(),
        respondedBy: varchar("responded_by", { length: 255 }).notNull(),
        respondentName: text("respondent_name"),
        isInternal: boolean("is_internal").default(false).notNull(),
        createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
});

export const suggestions = pgTable("suggestions", {
        id: serial().notNull(),
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

export const taskCompletions = pgTable("task_completions", {
        id: serial().notNull(),
        taskId: integer("task_id").notNull(),
        userId: text("user_id").notNull(),
        userName: text("user_name").notNull(),
        completedAt: timestamp("completed_at", { mode: 'string' }).defaultNow().notNull(),
        notes: text(),
});

export const userActivityLogs = pgTable("user_activity_logs", {
        id: serial().notNull(),
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

export const volunteers = pgTable("volunteers", {
        id: serial().notNull(),
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

export const weeklyReports = pgTable("weekly_reports", {
        id: serial().notNull(),
        weekEnding: text("week_ending").notNull(),
        sandwichCount: integer("sandwich_count").notNull(),
        notes: text(),
        submittedBy: text("submitted_by").notNull(),
        submittedAt: timestamp("submitted_at", { mode: 'string' }).defaultNow().notNull(),
});

export const wishlistSuggestions = pgTable("wishlist_suggestions", {
        id: serial().notNull(),
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

export const workLogs = pgTable("work_logs", {
        id: serial().notNull(),
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
});

export const archivedProjects = pgTable("archived_projects", {
});
export const vMessageThreads = pgView("v_message_threads", {    id: integer(),
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

export const vUnreadCounts = pgView("v_unread_counts", {        recipientId: text("recipient_id"),
        contextType: text("context_type"),
        // You can use { mode: "bigint" } if numbers are exceeding js number limitations
        unreadCount: bigint("unread_count", { mode: "number" }),
        sendername: text(),
        senderId: varchar("sender_id"),
}).as(sql`SELECT mr.recipient_id, m.context_type, count(*) AS unread_count, (u.first_name::text || ' '::text) || u.last_name::text AS sendername, u.id AS sender_id FROM message_recipients mr JOIN messages m ON m.id = mr.message_id JOIN users u ON m.sender_id = u.id::text WHERE mr.read = false AND m.deleted_at IS NULL AND mr.context_access_revoked = false AND u.id IS NOT NULL GROUP BY mr.recipient_id, m.context_type, u.id, u.first_name, u.last_name`);

// =====================================================
// VALIDATION SCHEMAS - Generated using drizzle-zod
// =====================================================

// Project Management Schemas
export const insertProjectSchema = createInsertSchema(projects).omit({ id: true });
export const insertProjectTaskSchema = createInsertSchema(projectTasks).omit({ id: true });
export const insertProjectCommentSchema = createInsertSchema(projectComments).omit({ id: true });
export const insertTaskCompletionSchema = createInsertSchema(taskCompletions).omit({ id: true });

// Communication Schemas
export const insertMessageSchema = createInsertSchema(messages).omit({ id: true });

// Reporting Schemas
export const insertWeeklyReportSchema = createInsertSchema(weeklyReports).omit({ id: true });

// Collection Schemas
export const insertSandwichCollectionSchema = createInsertSchema(sandwichCollections).omit({ id: true });

// Meeting Management Schemas
export const insertMeetingMinutesSchema = createInsertSchema(meetingMinutes).omit({ id: true });
export const insertAgendaItemSchema = createInsertSchema(agendaItems).omit({ id: true });
export const insertMeetingSchema = createInsertSchema(meetings).omit({ id: true });

// Driver Management Schemas
export const insertDriverAgreementSchema = createInsertSchema(driverAgreements).omit({ id: true });
export const insertDriverSchema = createInsertSchema(drivers).omit({ id: true });

// Volunteer Management Schemas
export const insertVolunteerSchema = createInsertSchema(volunteers).omit({ id: true });

// Host Management Schemas
export const insertHostSchema = createInsertSchema(hosts).omit({ id: true });
export const insertHostContactSchema = createInsertSchema(hostContacts).omit({ id: true });

// Recipient Management Schemas
export const insertRecipientSchema = createInsertSchema(recipients).omit({ id: true });

// Contact Management Schemas
export const insertContactSchema = createInsertSchema(contacts).omit({ id: true });

// Announcement Schemas
export const insertAnnouncementSchema = createInsertSchema(announcements).omit({ id: true });

// Document Management Schemas
export const insertDocumentSchema = createInsertSchema(documents).omit({ id: true });
export const insertDocumentPermissionSchema = createInsertSchema(documentPermissions).omit({ id: true });
export const insertDocumentAccessLogSchema = createInsertSchema(documentAccessLogs).omit({ id: true });

// Event Request Schemas
export const insertEventRequestSchema = createInsertSchema(eventRequests).omit({ id: true });
export const insertEventReminderSchema = createInsertSchema(eventReminders).omit({ id: true });
export const insertOrganizationSchema = createInsertSchema(organizations).omit({ id: true });

// Additional Route-Specific Schemas
export const insertRecipientTspContactSchema = createInsertSchema(recipientTspContacts).omit({ id: true });
export const insertSandwichDistributionSchema = createInsertSchema(sandwichDistributions).omit({ id: true });
export const insertEventVolunteerSchema = createInsertSchema(eventVolunteers).omit({ id: true });