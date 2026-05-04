CREATE TABLE "activities" (
	"id" varchar PRIMARY KEY NOT NULL,
	"type" varchar(50) NOT NULL,
	"title" text NOT NULL,
	"content" text,
	"created_by" varchar NOT NULL,
	"assigned_to" jsonb DEFAULT '[]',
	"status" varchar(50),
	"priority" varchar(20),
	"parent_id" varchar,
	"root_id" varchar,
	"context_type" varchar(50),
	"context_id" varchar,
	"metadata" jsonb DEFAULT '{}',
	"is_deleted" boolean DEFAULT false,
	"thread_count" integer DEFAULT 0,
	"last_activity_at" timestamp DEFAULT now(),
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "activity_attachments" (
	"id" serial PRIMARY KEY NOT NULL,
	"activity_id" varchar NOT NULL,
	"file_url" text NOT NULL,
	"file_type" varchar(100),
	"file_name" text NOT NULL,
	"file_size" integer,
	"uploaded_by" varchar NOT NULL,
	"uploaded_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "activity_participants" (
	"id" serial PRIMARY KEY NOT NULL,
	"activity_id" varchar NOT NULL,
	"user_id" varchar NOT NULL,
	"role" varchar(50) NOT NULL,
	"last_read_at" timestamp,
	"notifications_enabled" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "activity_participants_activity_id_user_id_role_unique" UNIQUE("activity_id","user_id","role")
);
--> statement-breakpoint
CREATE TABLE "activity_reactions" (
	"id" serial PRIMARY KEY NOT NULL,
	"activity_id" varchar NOT NULL,
	"user_id" varchar NOT NULL,
	"reaction_type" varchar(50) NOT NULL,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "activity_reactions_activity_id_user_id_reaction_type_unique" UNIQUE("activity_id","user_id","reaction_type")
);
--> statement-breakpoint
CREATE TABLE "agenda_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"meeting_id" integer NOT NULL,
	"submitted_by" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"section" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"submitted_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "agenda_sections" (
	"id" serial PRIMARY KEY NOT NULL,
	"compiled_agenda_id" integer NOT NULL,
	"title" text NOT NULL,
	"order_index" integer NOT NULL,
	"items" jsonb DEFAULT '[]' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "alert_requests" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar NOT NULL,
	"alert_description" text NOT NULL,
	"preferred_channel" varchar DEFAULT 'no_preference' NOT NULL,
	"frequency" varchar DEFAULT 'immediate' NOT NULL,
	"additional_notes" text,
	"status" varchar DEFAULT 'pending' NOT NULL,
	"admin_notes" text,
	"reviewed_by" varchar,
	"reviewed_at" timestamp,
	"implemented_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ambassador_candidates" (
	"id" serial PRIMARY KEY NOT NULL,
	"organization_name" varchar NOT NULL,
	"canonical_name" varchar NOT NULL,
	"category" varchar,
	"status" varchar DEFAULT 'identified' NOT NULL,
	"priority" varchar DEFAULT 'normal',
	"added_by" varchar,
	"added_at" timestamp DEFAULT now() NOT NULL,
	"added_reason" text,
	"last_contacted_at" timestamp,
	"last_contacted_by" varchar,
	"contact_method" varchar,
	"next_follow_up_date" timestamp,
	"notes" text,
	"contact_info" jsonb,
	"engagement_score_at_add" numeric(5, 2),
	"total_events_at_add" integer,
	"total_sandwiches_at_add" integer,
	"outcome_notes" text,
	"confirmed_at" timestamp,
	"declined_at" timestamp,
	"decline_reason" text,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "ambassador_candidates_canonical_name_unique" UNIQUE("canonical_name")
);
--> statement-breakpoint
CREATE TABLE "announcements" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"message" text NOT NULL,
	"type" varchar DEFAULT 'general' NOT NULL,
	"priority" varchar DEFAULT 'medium' NOT NULL,
	"start_date" timestamp NOT NULL,
	"end_date" timestamp NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"link" text,
	"link_text" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "api_keys" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar NOT NULL,
	"key_hash" varchar NOT NULL,
	"key_prefix" varchar NOT NULL,
	"permissions" jsonb DEFAULT '["EVENT_REQUESTS_VIEW"]',
	"created_by" varchar NOT NULL,
	"last_used_at" timestamp,
	"expires_at" timestamp,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "api_keys_key_hash_unique" UNIQUE("key_hash")
);
--> statement-breakpoint
CREATE TABLE "archived_projects" (
	"id" serial PRIMARY KEY NOT NULL,
	"original_project_id" integer NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"priority" text DEFAULT 'medium' NOT NULL,
	"category" text DEFAULT 'technology' NOT NULL,
	"assignee_id" integer,
	"assignee_name" text,
	"assignee_ids" jsonb DEFAULT '[]',
	"assignee_names" text,
	"due_date" text,
	"start_date" text,
	"completion_date" text NOT NULL,
	"progress_percentage" integer DEFAULT 100 NOT NULL,
	"notes" text,
	"requirements" text,
	"deliverables" text,
	"resources" text,
	"blockers" text,
	"tags" text,
	"estimated_hours" integer,
	"actual_hours" integer,
	"budget" varchar,
	"color" text DEFAULT 'blue' NOT NULL,
	"created_by" varchar,
	"created_by_name" varchar,
	"created_at" timestamp NOT NULL,
	"completed_at" timestamp DEFAULT now() NOT NULL,
	"archived_at" timestamp DEFAULT now() NOT NULL,
	"archived_by" varchar,
	"archived_by_name" varchar,
	"google_sheet_row_id" text
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"action" varchar NOT NULL,
	"table_name" varchar NOT NULL,
	"record_id" varchar NOT NULL,
	"old_data" text,
	"new_data" text,
	"user_id" varchar,
	"ip_address" varchar,
	"user_agent" text,
	"session_id" varchar,
	"timestamp" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "authoritative_weekly_collections" (
	"id" serial PRIMARY KEY NOT NULL,
	"week_date" text NOT NULL,
	"location" text NOT NULL,
	"sandwiches" integer NOT NULL,
	"week_of_year" integer NOT NULL,
	"week_of_program" integer NOT NULL,
	"year" integer NOT NULL,
	"imported_at" timestamp DEFAULT now() NOT NULL,
	"source_file" text DEFAULT 'New Sandwich Totals Scott (5)_1761847323011.xlsx'
);
--> statement-breakpoint
CREATE TABLE "availability_slots" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar NOT NULL,
	"start_at" timestamp NOT NULL,
	"end_at" timestamp NOT NULL,
	"status" varchar NOT NULL,
	"notes" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "chat_message_likes" (
	"id" serial PRIMARY KEY NOT NULL,
	"message_id" integer,
	"user_id" varchar NOT NULL,
	"user_name" varchar NOT NULL,
	"liked_at" timestamp DEFAULT now(),
	CONSTRAINT "chat_message_likes_message_id_user_id_unique" UNIQUE("message_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "chat_message_reads" (
	"id" serial PRIMARY KEY NOT NULL,
	"message_id" integer,
	"user_id" varchar NOT NULL,
	"channel" varchar NOT NULL,
	"read_at" timestamp DEFAULT now(),
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "chat_message_reads_message_id_user_id_unique" UNIQUE("message_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "chat_messages" (
	"id" serial PRIMARY KEY NOT NULL,
	"channel" varchar DEFAULT 'general' NOT NULL,
	"user_id" varchar NOT NULL,
	"user_name" varchar NOT NULL,
	"content" text NOT NULL,
	"edited_at" timestamp,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "client_error_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar,
	"user_email" varchar,
	"user_name" varchar,
	"user_role" varchar,
	"message" text NOT NULL,
	"stack" text,
	"component_stack" text,
	"url" text,
	"referrer" text,
	"user_agent" text,
	"viewport_width" integer,
	"viewport_height" integer,
	"ip_address" varchar,
	"session_id" varchar,
	"email_sent" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "committee_memberships" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar NOT NULL,
	"committee_id" integer NOT NULL,
	"role" varchar DEFAULT 'member' NOT NULL,
	"permissions" jsonb DEFAULT '[]',
	"joined_at" timestamp DEFAULT now(),
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "committees" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar NOT NULL,
	"description" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "compiled_agendas" (
	"id" serial PRIMARY KEY NOT NULL,
	"meeting_id" integer NOT NULL,
	"title" text NOT NULL,
	"date" text NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"sections" jsonb DEFAULT '[]' NOT NULL,
	"deferred_items" jsonb DEFAULT '[]' NOT NULL,
	"compiled_by" text NOT NULL,
	"compiled_at" timestamp DEFAULT now() NOT NULL,
	"finalized_at" timestamp,
	"published_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "confidential_documents" (
	"id" serial PRIMARY KEY NOT NULL,
	"file_name" varchar NOT NULL,
	"original_name" varchar NOT NULL,
	"file_path" varchar NOT NULL,
	"allowed_emails" jsonb DEFAULT '[]' NOT NULL,
	"uploaded_by" varchar NOT NULL,
	"uploaded_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "contacts" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"organization" text,
	"role" text,
	"phone" text NOT NULL,
	"email" text,
	"address" text,
	"notes" text,
	"category" text DEFAULT 'general' NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "conversation_participants" (
	"conversation_id" integer NOT NULL,
	"user_id" text NOT NULL,
	"joined_at" timestamp DEFAULT now(),
	"last_read_at" timestamp DEFAULT now(),
	CONSTRAINT "conversation_participants_conversation_id_user_id_pk" PRIMARY KEY("conversation_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "conversations" (
	"id" serial PRIMARY KEY NOT NULL,
	"type" text NOT NULL,
	"name" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "cooler_inventory" (
	"id" serial PRIMARY KEY NOT NULL,
	"host_home_id" varchar NOT NULL,
	"cooler_type_id" integer NOT NULL,
	"quantity" integer DEFAULT 0 NOT NULL,
	"notes" text,
	"reported_at" timestamp DEFAULT now() NOT NULL,
	"reported_by" varchar NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cooler_types" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(100) NOT NULL,
	"description" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "dashboard_documents" (
	"id" serial PRIMARY KEY NOT NULL,
	"document_id" varchar NOT NULL,
	"display_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"added_by" varchar,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "dashboard_documents_document_id_unique" UNIQUE("document_id")
);
--> statement-breakpoint
CREATE TABLE "dismissed_announcements" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar NOT NULL,
	"announcement_id" varchar NOT NULL,
	"dismissed_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "unique_user_announcement" UNIQUE("user_id","announcement_id")
);
--> statement-breakpoint
CREATE TABLE "document_access_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"document_id" integer NOT NULL,
	"user_id" varchar NOT NULL,
	"user_name" text NOT NULL,
	"action" text NOT NULL,
	"ip_address" varchar,
	"user_agent" text,
	"session_id" varchar,
	"accessed_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "document_permissions" (
	"id" serial PRIMARY KEY NOT NULL,
	"document_id" integer NOT NULL,
	"user_id" varchar NOT NULL,
	"permission_type" text NOT NULL,
	"granted_by" varchar NOT NULL,
	"granted_by_name" text NOT NULL,
	"granted_at" timestamp DEFAULT now() NOT NULL,
	"expires_at" timestamp,
	"notes" text,
	"is_active" boolean DEFAULT true NOT NULL,
	CONSTRAINT "document_permissions_document_id_user_id_permission_type_unique" UNIQUE("document_id","user_id","permission_type")
);
--> statement-breakpoint
CREATE TABLE "documents" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"file_name" text NOT NULL,
	"original_name" text NOT NULL,
	"file_path" text NOT NULL,
	"file_size" integer NOT NULL,
	"mime_type" text NOT NULL,
	"category" text DEFAULT 'general' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"uploaded_by" varchar NOT NULL,
	"uploaded_by_name" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "drive_links" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"url" text NOT NULL,
	"icon" text NOT NULL,
	"icon_color" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "driver_agreements" (
	"id" serial PRIMARY KEY NOT NULL,
	"submitted_by" text NOT NULL,
	"email" text NOT NULL,
	"phone" text NOT NULL,
	"license_number" text NOT NULL,
	"vehicle_info" text NOT NULL,
	"emergency_contact" text NOT NULL,
	"emergency_phone" text NOT NULL,
	"agreement_accepted" boolean DEFAULT false NOT NULL,
	"submitted_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "driver_vehicles" (
	"id" serial PRIMARY KEY NOT NULL,
	"driver_id" integer NOT NULL,
	"make" text NOT NULL,
	"model" text NOT NULL,
	"year" integer,
	"color" text,
	"cooler_capacity" integer,
	"is_primary" boolean DEFAULT false NOT NULL,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "drivers" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"phone" text,
	"email" text,
	"address" text,
	"notes" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"vehicle_type" text,
	"license_number" text,
	"availability" text DEFAULT 'available',
	"zone" text,
	"area" text,
	"route_description" text,
	"host_location" text,
	"host_id" integer,
	"van_approved" boolean DEFAULT false NOT NULL,
	"home_address" text,
	"availability_notes" text,
	"email_agreement_sent" boolean DEFAULT false NOT NULL,
	"voicemail_left" boolean DEFAULT false NOT NULL,
	"inactive_reason" text,
	"is_weekly_driver" boolean DEFAULT false NOT NULL,
	"willing_to_speak" boolean DEFAULT false NOT NULL,
	"is_speaker" boolean DEFAULT false NOT NULL,
	"is_event_driver" boolean DEFAULT false NOT NULL,
	"wants_app_walkthrough" boolean DEFAULT false NOT NULL,
	"wants_text_alerts" boolean DEFAULT false NOT NULL,
	"temporarily_unavailable" boolean DEFAULT false NOT NULL,
	"unavailable_note" text,
	"unavailable_until" timestamp,
	"unavailable_follow_up" text,
	"availability_status" text DEFAULT 'available' NOT NULL,
	"unavailable_start_date" timestamp,
	"check_in_date" timestamp,
	"unavailable_reason" text,
	"cooler_status" text,
	"agreement_in_database" boolean DEFAULT false NOT NULL,
	"never_fully_onboarded" boolean DEFAULT false NOT NULL,
	"wants_to_restart" boolean DEFAULT false NOT NULL,
	"interested_in_van_driving" boolean DEFAULT false NOT NULL,
	"latitude" numeric,
	"longitude" numeric,
	"geocoded_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "email_drafts" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar NOT NULL,
	"recipient_id" varchar NOT NULL,
	"recipient_name" varchar NOT NULL,
	"subject" text NOT NULL,
	"content" text NOT NULL,
	"last_saved" timestamp DEFAULT now(),
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "email_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"event_id" integer,
	"sent_at" timestamp DEFAULT now(),
	"sent_by" varchar,
	"recipient_email" text NOT NULL,
	"subject" text NOT NULL,
	"body" text NOT NULL,
	"template_type" text
);
--> statement-breakpoint
CREATE TABLE "email_messages" (
	"id" serial PRIMARY KEY NOT NULL,
	"sender_id" varchar NOT NULL,
	"sender_name" varchar NOT NULL,
	"sender_email" varchar NOT NULL,
	"recipient_id" varchar NOT NULL,
	"recipient_name" varchar NOT NULL,
	"recipient_email" varchar NOT NULL,
	"subject" text NOT NULL,
	"content" text NOT NULL,
	"is_read" boolean DEFAULT false NOT NULL,
	"is_starred" boolean DEFAULT false NOT NULL,
	"is_archived" boolean DEFAULT false NOT NULL,
	"is_trashed" boolean DEFAULT false NOT NULL,
	"is_draft" boolean DEFAULT false NOT NULL,
	"parent_message_id" integer,
	"context_type" varchar,
	"context_id" varchar,
	"context_title" varchar,
	"attachments" text[],
	"include_scheduling_link" boolean DEFAULT false,
	"request_phone_call" boolean DEFAULT false,
	"read_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "email_template_sections" (
	"id" serial PRIMARY KEY NOT NULL,
	"template_type" varchar NOT NULL,
	"section_key" varchar NOT NULL,
	"section_label" varchar NOT NULL,
	"default_content" text NOT NULL,
	"current_content" text,
	"description" text,
	"placeholder_hints" text,
	"last_updated_by" varchar,
	"last_updated_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "event_check_in_reminders" (
	"id" serial PRIMARY KEY NOT NULL,
	"event_request_id" integer NOT NULL,
	"user_id" varchar NOT NULL,
	"rule_type" varchar DEFAULT 'general_checkin' NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"threshold_days" integer DEFAULT 7,
	"frequency" varchar DEFAULT 'weekly' NOT NULL,
	"channel" varchar DEFAULT 'email' NOT NULL,
	"last_sent_at" timestamp,
	"next_due_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "event_collaboration_comment_likes" (
	"id" serial PRIMARY KEY NOT NULL,
	"comment_id" integer NOT NULL,
	"user_id" varchar NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "event_collaboration_comment_likes_comment_id_user_id_unique" UNIQUE("comment_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "event_collaboration_comments" (
	"id" serial PRIMARY KEY NOT NULL,
	"event_request_id" integer NOT NULL,
	"user_id" varchar NOT NULL,
	"user_name" varchar NOT NULL,
	"content" text NOT NULL,
	"parent_comment_id" integer,
	"edited_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "event_edit_revisions" (
	"id" serial PRIMARY KEY NOT NULL,
	"event_request_id" integer NOT NULL,
	"field_name" varchar NOT NULL,
	"old_value" text,
	"new_value" text,
	"changed_by" varchar NOT NULL,
	"changed_by_name" varchar NOT NULL,
	"change_type" varchar NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "event_field_locks" (
	"id" serial PRIMARY KEY NOT NULL,
	"event_request_id" integer NOT NULL,
	"field_name" varchar NOT NULL,
	"locked_by" varchar NOT NULL,
	"locked_by_name" varchar NOT NULL,
	"locked_at" timestamp DEFAULT now() NOT NULL,
	"expires_at" timestamp NOT NULL,
	CONSTRAINT "event_field_locks_event_request_id_field_name_unique" UNIQUE("event_request_id","field_name")
);
--> statement-breakpoint
CREATE TABLE "event_reminder_snoozes" (
	"id" serial PRIMARY KEY NOT NULL,
	"event_request_id" integer NOT NULL,
	"user_id" varchar NOT NULL,
	"snooze_type" varchar NOT NULL,
	"snoozed_until" timestamp,
	"reason" text,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"cancelled_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "event_reminders" (
	"id" serial PRIMARY KEY NOT NULL,
	"event_request_id" integer NOT NULL,
	"title" varchar NOT NULL,
	"description" text,
	"reminder_type" varchar NOT NULL,
	"due_date" timestamp NOT NULL,
	"assigned_to_user_id" varchar,
	"assigned_to_name" varchar,
	"status" varchar DEFAULT 'pending' NOT NULL,
	"priority" varchar DEFAULT 'medium' NOT NULL,
	"completed_at" timestamp,
	"completed_by" varchar,
	"completion_notes" text,
	"created_by" varchar NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "event_requests" (
	"id" serial PRIMARY KEY NOT NULL,
	"first_name" varchar,
	"last_name" varchar,
	"email" varchar,
	"phone" varchar,
	"backup_contact_first_name" varchar,
	"backup_contact_last_name" varchar,
	"backup_contact_email" varchar,
	"backup_contact_phone" varchar,
	"backup_contact_role" varchar,
	"organization_name" varchar,
	"department" varchar,
	"organization_category" varchar,
	"school_classification" varchar,
	"partner_organizations" jsonb,
	"auto_categories" jsonb,
	"categorized_at" timestamp,
	"categorized_by" varchar,
	"desired_event_date" timestamp,
	"backup_dates" jsonb,
	"date_flexible" boolean,
	"scheduled_event_date" timestamp,
	"is_confirmed" boolean DEFAULT false NOT NULL,
	"added_to_official_sheet" boolean DEFAULT false NOT NULL,
	"added_to_official_sheet_at" timestamp,
	"show_on_volunteer_hub" boolean DEFAULT false NOT NULL,
	"message" text,
	"previously_hosted" varchar DEFAULT 'i_dont_know' NOT NULL,
	"status" varchar DEFAULT 'new' NOT NULL,
	"status_changed_at" timestamp,
	"assigned_to" varchar,
	"next_action" text,
	"next_action_updated_at" timestamp,
	"declined_reason" text,
	"declined_notes" text,
	"declined_at" timestamp,
	"declined_by" varchar,
	"cancelled_reason" text,
	"cancelled_notes" text,
	"cancelled_at" timestamp,
	"cancelled_by" varchar,
	"postponement_reason" text,
	"tentative_new_date" timestamp,
	"postponement_notes" text,
	"original_scheduled_date" timestamp,
	"postponed_at" timestamp,
	"postponed_by" varchar,
	"was_postponed" boolean DEFAULT false,
	"postponement_count" integer DEFAULT 0,
	"standby_reason" text,
	"standby_expected_date" timestamp,
	"standby_notes" text,
	"standby_marked_at" timestamp,
	"standby_marked_by" varchar,
	"stalled_reason" text,
	"stalled_last_outreach_date" timestamp,
	"stalled_next_outreach_date" timestamp,
	"stalled_outreach_count" integer DEFAULT 0,
	"stalled_notes" text,
	"stalled_marked_at" timestamp,
	"stalled_marked_by" varchar,
	"stalled_original_event_date" timestamp,
	"non_event_reason" text,
	"non_event_notes" text,
	"non_event_at" timestamp,
	"non_event_by" varchar,
	"admin_escalation_sent_at" timestamp,
	"follow_up_date" timestamp,
	"scheduled_call_date" timestamp,
	"communication_method" varchar,
	"event_address" text,
	"latitude" varchar,
	"longitude" varchar,
	"estimated_sandwich_count" integer,
	"estimated_sandwich_count_min" integer,
	"estimated_sandwich_count_max" integer,
	"estimated_sandwich_range_type" varchar,
	"volunteer_count" integer,
	"adult_count" integer,
	"children_count" integer,
	"has_refrigeration" boolean,
	"tsp_contact_assigned" varchar,
	"tsp_contact" varchar,
	"tsp_contact_assigned_date" timestamp,
	"additional_tsp_contacts" text,
	"additional_contact_1" varchar,
	"additional_contact_2" varchar,
	"custom_tsp_contact" text,
	"toolkit_sent" boolean DEFAULT false,
	"toolkit_sent_date" timestamp,
	"toolkit_status" varchar DEFAULT 'not_sent',
	"toolkit_sent_by" varchar,
	"event_start_time" varchar,
	"event_end_time" varchar,
	"pickup_time" varchar,
	"pickup_date_time" varchar,
	"pickup_time_window" text,
	"pickup_person_responsible" text,
	"additional_requirements" text,
	"planning_notes" text,
	"scheduling_notes" text,
	"sandwich_types" jsonb,
	"delivery_destination" text,
	"overnight_holding_location" text,
	"overnight_pickup_time" time,
	"drivers_needed" integer DEFAULT 0,
	"self_transport" boolean DEFAULT false,
	"speakers_needed" integer DEFAULT 0,
	"volunteers_needed" integer DEFAULT 0,
	"volunteer_notes" text,
	"assigned_driver_ids" text[],
	"tentative_driver_ids" text[],
	"driver_pickup_time" varchar,
	"driver_notes" text,
	"drivers_arranged" boolean DEFAULT false,
	"assigned_speaker_ids" text[],
	"tentative_speaker_ids" text[],
	"assigned_volunteer_ids" text[],
	"tentative_volunteer_ids" text[],
	"volunteer_details" jsonb,
	"assigned_recipient_ids" text[],
	"recipient_allocations" jsonb,
	"van_driver_needed" boolean DEFAULT false,
	"assigned_van_driver_id" text,
	"custom_van_driver_name" text,
	"van_driver_notes" text,
	"is_dhl_van" boolean DEFAULT false NOT NULL,
	"follow_up_one_day_completed" boolean DEFAULT false,
	"follow_up_one_day_date" timestamp,
	"follow_up_one_month_completed" boolean DEFAULT false,
	"follow_up_one_month_date" timestamp,
	"follow_up_notes" text,
	"social_media_post_requested" boolean DEFAULT false,
	"social_media_post_requested_date" timestamp,
	"social_media_post_completed" boolean DEFAULT false,
	"social_media_post_completed_date" timestamp,
	"social_media_post_notes" text,
	"actual_attendance" integer,
	"estimated_attendance" integer,
	"attendance_adults" integer,
	"attendance_teens" integer,
	"attendance_kids" integer,
	"kids_age_range" text,
	"attendance_recorded_date" timestamp,
	"attendance_recorded_by" varchar,
	"attendance_notes" text,
	"actual_sandwich_count" integer,
	"actual_sandwich_types" jsonb,
	"actual_sandwich_count_recorded_date" timestamp,
	"actual_sandwich_count_recorded_by" varchar,
	"sandwich_distributions" jsonb,
	"distribution_recorded_date" timestamp,
	"distribution_recorded_by" varchar,
	"distribution_notes" text,
	"organization_exists" boolean DEFAULT false NOT NULL,
	"duplicate_check_date" timestamp,
	"duplicate_notes" text,
	"contact_attempts" integer DEFAULT 0,
	"last_contact_attempt" timestamp,
	"is_unresponsive" boolean DEFAULT false,
	"marked_unresponsive_at" timestamp,
	"marked_unresponsive_by" varchar,
	"contact_method" varchar,
	"next_follow_up_date" timestamp,
	"unresponsive_notes" text,
	"contact_attempts_log" jsonb,
	"past_date_notification_sent_at" timestamp,
	"manual_entry_source" varchar,
	"google_sheet_row_id" text,
	"external_id" varchar NOT NULL,
	"last_synced_at" timestamp,
	"driver_details" jsonb,
	"pre_event_flags" jsonb DEFAULT '[]',
	"speaker_details" jsonb,
	"speaker_audience_type" text,
	"speaker_duration" text,
	"delivery_time_window" text,
	"delivery_parking_access" text,
	"is_mlk_day_event" boolean DEFAULT false,
	"mlk_day_marked_at" timestamp,
	"mlk_day_marked_by" varchar,
	"is_corporate_priority" boolean DEFAULT false,
	"corporate_priority_marked_at" timestamp,
	"corporate_priority_marked_by" varchar,
	"requires_core_team_member" boolean DEFAULT false,
	"core_team_member_notes" text,
	"corporate_follow_up_protocol" jsonb DEFAULT '{"status": "not_started", "initialCallMade": false, "voicemailLeft": false, "toolkitEmailSent": false, "day2CallMade": false, "day2TextSent": false, "reminderCount": 0}',
	"driver_instructions" text,
	"volunteer_instructions" text,
	"speaker_instructions" text,
	"instructions_last_updated_at" timestamp,
	"instructions_last_updated_by" varchar,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"created_by" varchar,
	"deleted_at" timestamp,
	"deleted_by" varchar,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "event_requests_external_id_unique" UNIQUE("external_id")
);
--> statement-breakpoint
CREATE TABLE "event_volunteers" (
	"id" serial PRIMARY KEY NOT NULL,
	"event_request_id" integer NOT NULL,
	"volunteer_user_id" varchar,
	"volunteer_name" varchar,
	"volunteer_email" varchar,
	"volunteer_phone" varchar,
	"role" varchar NOT NULL,
	"status" varchar DEFAULT 'pending' NOT NULL,
	"notes" text,
	"assigned_by" varchar,
	"signed_up_at" timestamp DEFAULT now() NOT NULL,
	"confirmed_at" timestamp,
	"reminder_sent_at" timestamp,
	"email_reminder_1_sent_at" timestamp,
	"email_reminder_2_sent_at" timestamp,
	"sms_reminder_1_sent_at" timestamp,
	"sms_reminder_2_sent_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "expenses" (
	"id" serial PRIMARY KEY NOT NULL,
	"context_type" varchar(50),
	"context_id" integer,
	"description" text NOT NULL,
	"amount" numeric(10, 2) NOT NULL,
	"category" varchar(100),
	"vendor" varchar(255),
	"purchase_date" timestamp,
	"receipt_url" text,
	"receipt_file_name" text,
	"receipt_file_size" integer,
	"uploaded_by" varchar NOT NULL,
	"uploaded_at" timestamp DEFAULT now(),
	"approved_by" varchar,
	"approved_at" timestamp,
	"status" varchar(50) DEFAULT 'pending' NOT NULL,
	"notes" text,
	"metadata" jsonb DEFAULT '{}',
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "feature_flags" (
	"id" serial PRIMARY KEY NOT NULL,
	"flag_name" varchar(255) NOT NULL,
	"description" text,
	"enabled" boolean DEFAULT false NOT NULL,
	"enabled_for_users" jsonb DEFAULT '[]',
	"enabled_for_roles" jsonb DEFAULT '[]',
	"enabled_percentage" integer DEFAULT 0,
	"metadata" jsonb DEFAULT '{}',
	"created_by" varchar,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "feature_flags_flag_name_unique" UNIQUE("flag_name")
);
--> statement-breakpoint
CREATE TABLE "google_sheets" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar NOT NULL,
	"description" text,
	"sheet_id" varchar NOT NULL,
	"is_public" boolean DEFAULT true NOT NULL,
	"embed_url" text NOT NULL,
	"direct_url" text NOT NULL,
	"created_by" varchar,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "holding_zone_categories" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(100) NOT NULL,
	"color" varchar(50) NOT NULL,
	"created_by" varchar NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "host_contacts" (
	"id" serial PRIMARY KEY NOT NULL,
	"host_id" integer NOT NULL,
	"name" text NOT NULL,
	"role" text NOT NULL,
	"phone" text NOT NULL,
	"email" text,
	"address" text,
	"is_primary" boolean DEFAULT false NOT NULL,
	"notes" text,
	"host_location" text,
	"driver_agreement_signed" boolean DEFAULT false,
	"van_approved" boolean DEFAULT false,
	"weekly_active" boolean DEFAULT false,
	"last_scraped" timestamp,
	"latitude" numeric,
	"longitude" numeric,
	"geocoded_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "host_resources" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" varchar(255) NOT NULL,
	"description" text NOT NULL,
	"category" varchar(50) NOT NULL,
	"file_type" varchar(20),
	"file_url" text NOT NULL,
	"file_name" varchar(255),
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "hosted_files" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"file_name" text NOT NULL,
	"original_name" text NOT NULL,
	"file_path" text NOT NULL,
	"file_size" integer NOT NULL,
	"mime_type" text NOT NULL,
	"category" text DEFAULT 'general' NOT NULL,
	"uploaded_by" text NOT NULL,
	"is_public" boolean DEFAULT true NOT NULL,
	"download_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "hosts" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"address" text,
	"email" text,
	"phone" text,
	"status" text DEFAULT 'active' NOT NULL,
	"notes" text,
	"latitude" numeric,
	"longitude" numeric,
	"geocoded_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "impact_reports" (
	"id" serial PRIMARY KEY NOT NULL,
	"report_type" varchar(50) NOT NULL,
	"report_period" varchar(50) NOT NULL,
	"start_date" timestamp NOT NULL,
	"end_date" timestamp NOT NULL,
	"title" text NOT NULL,
	"executive_summary" text NOT NULL,
	"content" text NOT NULL,
	"metrics" jsonb,
	"highlights" jsonb,
	"trends" jsonb,
	"generated_at" timestamp DEFAULT now() NOT NULL,
	"generated_by" varchar,
	"ai_model" varchar(100),
	"generation_prompt" text,
	"regeneration_count" integer DEFAULT 0,
	"status" varchar(50) DEFAULT 'draft' NOT NULL,
	"published_at" timestamp,
	"published_by" varchar,
	"pdf_url" text,
	"pdf_generated_at" timestamp,
	"tags" text[],
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "imported_external_ids" (
	"id" serial PRIMARY KEY NOT NULL,
	"external_id" varchar NOT NULL,
	"imported_at" timestamp DEFAULT now() NOT NULL,
	"source_table" varchar DEFAULT 'event_requests' NOT NULL,
	"notes" text,
	CONSTRAINT "imported_external_ids_external_id_unique" UNIQUE("external_id")
);
--> statement-breakpoint
CREATE TABLE "instant_message_likes" (
	"id" serial PRIMARY KEY NOT NULL,
	"message_id" integer NOT NULL,
	"user_id" varchar NOT NULL,
	"user_name" varchar NOT NULL,
	"emoji" varchar DEFAULT '❤️' NOT NULL,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "instant_message_likes_message_id_user_id_emoji_unique" UNIQUE("message_id","user_id","emoji")
);
--> statement-breakpoint
CREATE TABLE "instant_messages" (
	"id" serial PRIMARY KEY NOT NULL,
	"sender_id" varchar NOT NULL,
	"sender_name" varchar NOT NULL,
	"recipient_id" varchar NOT NULL,
	"content" text NOT NULL,
	"read" boolean DEFAULT false,
	"is_read" boolean DEFAULT false,
	"read_at" timestamp,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "kudos_tracking" (
	"id" serial PRIMARY KEY NOT NULL,
	"sender_id" text NOT NULL,
	"recipient_id" text NOT NULL,
	"context_type" text NOT NULL,
	"context_id" text NOT NULL,
	"entity_name" text DEFAULT 'Legacy Entry' NOT NULL,
	"message_id" integer,
	"sent_at" timestamp DEFAULT now(),
	CONSTRAINT "kudos_tracking_sender_id_recipient_id_context_type_context_id_unique" UNIQUE("sender_id","recipient_id","context_type","context_id")
);
--> statement-breakpoint
CREATE TABLE "meeting_minutes" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"date" text NOT NULL,
	"summary" text NOT NULL,
	"color" text DEFAULT 'blue' NOT NULL,
	"file_name" text,
	"file_path" text,
	"file_type" text,
	"mime_type" text,
	"committee_type" text
);
--> statement-breakpoint
CREATE TABLE "meeting_notes" (
	"id" serial PRIMARY KEY NOT NULL,
	"meeting_id" integer NOT NULL,
	"project_id" integer,
	"type" text NOT NULL,
	"content" text NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"created_by" varchar,
	"created_by_name" varchar,
	"converted_to_task_id" integer,
	"converted_at" timestamp,
	"selected_for_agenda" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "meeting_projects" (
	"id" serial PRIMARY KEY NOT NULL,
	"meeting_id" integer NOT NULL,
	"project_id" integer NOT NULL,
	"discussion_points" text,
	"questions_to_address" text,
	"discussion_summary" text,
	"decisions_reached" text,
	"status" text DEFAULT 'planned' NOT NULL,
	"include_in_agenda" boolean DEFAULT true NOT NULL,
	"agenda_order" integer,
	"section" text,
	"added_at" timestamp DEFAULT now() NOT NULL,
	"added_by" varchar,
	"discussed_at" timestamp,
	CONSTRAINT "meeting_projects_meeting_id_project_id_unique" UNIQUE("meeting_id","project_id")
);
--> statement-breakpoint
CREATE TABLE "meetings" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"type" text NOT NULL,
	"date" text NOT NULL,
	"time" text NOT NULL,
	"location" text,
	"description" text,
	"final_agenda" text,
	"status" text DEFAULT 'planning' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "message_likes" (
	"id" serial PRIMARY KEY NOT NULL,
	"message_id" integer NOT NULL,
	"user_id" text NOT NULL,
	"user_name" text,
	"liked_at" timestamp DEFAULT now(),
	CONSTRAINT "message_likes_message_id_user_id_unique" UNIQUE("message_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "message_recipients" (
	"id" serial PRIMARY KEY NOT NULL,
	"message_id" integer,
	"recipient_id" text NOT NULL,
	"read" boolean DEFAULT false NOT NULL,
	"is_read" boolean DEFAULT false NOT NULL,
	"read_at" timestamp,
	"notification_sent" boolean DEFAULT false NOT NULL,
	"email_sent_at" timestamp,
	"context_access_revoked" boolean DEFAULT false,
	"initially_notified" boolean DEFAULT false NOT NULL,
	"initially_notified_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "message_recipients_message_id_recipient_id_unique" UNIQUE("message_id","recipient_id")
);
--> statement-breakpoint
CREATE TABLE "messages" (
	"id" serial PRIMARY KEY NOT NULL,
	"conversation_id" integer,
	"user_id" text NOT NULL,
	"sender_id" text NOT NULL,
	"content" text NOT NULL,
	"sender" text,
	"context_type" text,
	"context_id" text,
	"context_title" text,
	"read" boolean DEFAULT false NOT NULL,
	"is_read" boolean DEFAULT false NOT NULL,
	"edited_at" timestamp,
	"edited_content" text,
	"deleted_at" timestamp,
	"deleted_by" text,
	"reply_to_message_id" integer,
	"reply_to_content" text,
	"reply_to_sender" text,
	"attachments" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "_migrations" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL,
	"executed_at" timestamp DEFAULT now(),
	CONSTRAINT "_migrations_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "notification_ab_tests" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar NOT NULL,
	"description" text,
	"hypothesis" text,
	"test_type" varchar NOT NULL,
	"category" varchar,
	"type" varchar,
	"control_group" jsonb NOT NULL,
	"test_group" jsonb NOT NULL,
	"traffic_split" integer DEFAULT 50 NOT NULL,
	"status" varchar DEFAULT 'draft' NOT NULL,
	"start_date" timestamp,
	"end_date" timestamp,
	"target_sample_size" integer DEFAULT 1000,
	"primary_metric" varchar NOT NULL,
	"target_improvement" numeric(5, 2) DEFAULT '5.00',
	"significance_level" numeric(3, 2) DEFAULT '0.05',
	"control_results" jsonb DEFAULT '{}',
	"test_results" jsonb DEFAULT '{}',
	"statistical_significance" boolean,
	"winner_variant" varchar,
	"created_by" varchar,
	"metadata" jsonb DEFAULT '{}',
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notification_action_history" (
	"id" serial PRIMARY KEY NOT NULL,
	"notification_id" integer NOT NULL,
	"user_id" varchar NOT NULL,
	"action_type" varchar NOT NULL,
	"action_status" varchar DEFAULT 'pending' NOT NULL,
	"started_at" timestamp DEFAULT now() NOT NULL,
	"completed_at" timestamp,
	"error_message" text,
	"related_type" varchar,
	"related_id" integer,
	"undone_at" timestamp,
	"undone_by" varchar,
	"metadata" jsonb DEFAULT '{}'
);
--> statement-breakpoint
CREATE TABLE "notification_analytics" (
	"id" serial PRIMARY KEY NOT NULL,
	"period_type" varchar NOT NULL,
	"period_start" timestamp NOT NULL,
	"period_end" timestamp NOT NULL,
	"category" varchar,
	"type" varchar,
	"delivery_channel" varchar,
	"total_sent" integer DEFAULT 0 NOT NULL,
	"total_delivered" integer DEFAULT 0 NOT NULL,
	"total_opened" integer DEFAULT 0 NOT NULL,
	"total_clicked" integer DEFAULT 0 NOT NULL,
	"total_dismissed" integer DEFAULT 0 NOT NULL,
	"total_failed" integer DEFAULT 0 NOT NULL,
	"delivery_rate" numeric(5, 2),
	"open_rate" numeric(5, 2),
	"click_rate" numeric(5, 2),
	"dismissal_rate" numeric(5, 2),
	"average_delivery_time" integer,
	"average_response_time" integer,
	"peak_hours" jsonb DEFAULT '[]',
	"insights" jsonb DEFAULT '{}',
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notification_history" (
	"id" serial PRIMARY KEY NOT NULL,
	"notification_id" integer NOT NULL,
	"user_id" varchar NOT NULL,
	"delivery_channel" varchar NOT NULL,
	"delivery_status" varchar DEFAULT 'pending' NOT NULL,
	"delivery_attempts" integer DEFAULT 0 NOT NULL,
	"last_delivery_attempt" timestamp,
	"delivered_at" timestamp,
	"failure_reason" text,
	"opened_at" timestamp,
	"clicked_at" timestamp,
	"dismissed_at" timestamp,
	"interaction_type" varchar,
	"time_to_interaction" integer,
	"relevance_score" numeric(5, 2),
	"context_metadata" jsonb DEFAULT '{}',
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notification_preferences" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar NOT NULL,
	"category" varchar NOT NULL,
	"type" varchar NOT NULL,
	"email_enabled" boolean DEFAULT true NOT NULL,
	"sms_enabled" boolean DEFAULT false NOT NULL,
	"in_app_enabled" boolean DEFAULT true NOT NULL,
	"push_enabled" boolean DEFAULT true NOT NULL,
	"priority" varchar DEFAULT 'medium' NOT NULL,
	"frequency" varchar DEFAULT 'immediate' NOT NULL,
	"quiet_hours_start" time,
	"quiet_hours_end" time,
	"timezone" varchar DEFAULT 'America/New_York',
	"relevance_score" numeric(5, 2) DEFAULT '50.00',
	"last_interaction" timestamp,
	"total_received" integer DEFAULT 0 NOT NULL,
	"total_opened" integer DEFAULT 0 NOT NULL,
	"total_dismissed" integer DEFAULT 0 NOT NULL,
	"engagement_metadata" jsonb DEFAULT '{}',
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "notification_preferences_user_id_category_type_unique" UNIQUE("user_id","category","type")
);
--> statement-breakpoint
CREATE TABLE "notification_rules" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar NOT NULL,
	"description" text,
	"category" varchar,
	"type" varchar,
	"priority" varchar,
	"user_role" varchar,
	"batching_enabled" boolean DEFAULT false NOT NULL,
	"batching_window" integer DEFAULT 3600,
	"max_batch_size" integer DEFAULT 5,
	"respect_quiet_hours" boolean DEFAULT true NOT NULL,
	"min_time_between" integer DEFAULT 300,
	"max_daily_limit" integer,
	"smart_channel_selection" boolean DEFAULT true NOT NULL,
	"fallback_channel" varchar DEFAULT 'in_app',
	"retry_attempts" integer DEFAULT 3 NOT NULL,
	"retry_delay" integer DEFAULT 3600 NOT NULL,
	"test_variant" varchar,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar NOT NULL,
	"type" varchar NOT NULL,
	"priority" varchar DEFAULT 'medium' NOT NULL,
	"title" text NOT NULL,
	"message" text NOT NULL,
	"is_read" boolean DEFAULT false NOT NULL,
	"is_archived" boolean DEFAULT false NOT NULL,
	"category" varchar,
	"related_type" varchar,
	"related_id" integer,
	"action_url" text,
	"action_text" text,
	"expires_at" timestamp,
	"metadata" jsonb DEFAULT '{}',
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "onboarding_challenges" (
	"id" serial PRIMARY KEY NOT NULL,
	"action_key" varchar NOT NULL,
	"title" varchar NOT NULL,
	"description" text,
	"category" varchar NOT NULL,
	"points" integer DEFAULT 10 NOT NULL,
	"icon" varchar,
	"order" integer DEFAULT 0 NOT NULL,
	"promotion" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "onboarding_challenges_action_key_unique" UNIQUE("action_key")
);
--> statement-breakpoint
CREATE TABLE "onboarding_progress" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar NOT NULL,
	"challenge_id" integer NOT NULL,
	"completed_at" timestamp DEFAULT now() NOT NULL,
	"metadata" jsonb DEFAULT '{}',
	CONSTRAINT "onboarding_progress_user_id_challenge_id_unique" UNIQUE("user_id","challenge_id")
);
--> statement-breakpoint
CREATE TABLE "organization_engagement_scores" (
	"id" serial PRIMARY KEY NOT NULL,
	"organization_name" varchar NOT NULL,
	"canonical_name" varchar NOT NULL,
	"category" varchar,
	"overall_engagement_score" numeric(5, 2) DEFAULT '50.00' NOT NULL,
	"frequency_score" numeric(5, 2) DEFAULT '0',
	"recency_score" numeric(5, 2) DEFAULT '0',
	"volume_score" numeric(5, 2) DEFAULT '0',
	"completion_score" numeric(5, 2) DEFAULT '0',
	"consistency_score" numeric(5, 2) DEFAULT '0',
	"engagement_trend" varchar DEFAULT 'stable',
	"trend_percent_change" numeric(5, 2) DEFAULT '0',
	"total_events" integer DEFAULT 0 NOT NULL,
	"completed_events" integer DEFAULT 0 NOT NULL,
	"total_sandwiches" integer DEFAULT 0 NOT NULL,
	"days_since_last_event" integer,
	"days_since_first_event" integer,
	"last_event_date" timestamp,
	"first_event_date" timestamp,
	"average_event_interval" integer,
	"engagement_level" varchar DEFAULT 'unknown' NOT NULL,
	"outreach_priority" varchar DEFAULT 'normal',
	"recommended_actions" jsonb DEFAULT '[]',
	"insights" jsonb DEFAULT '[]',
	"program_suitability" jsonb DEFAULT '[]',
	"last_calculated_at" timestamp DEFAULT now() NOT NULL,
	"calculation_version" varchar DEFAULT '1.0',
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "organization_engagement_scores_canonical_name_unique" UNIQUE("canonical_name")
);
--> statement-breakpoint
CREATE TABLE "organizations" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar NOT NULL,
	"department" varchar,
	"alternate_names" text[],
	"addresses" text[],
	"domains" text[],
	"category" varchar,
	"school_classification" varchar,
	"is_religious" boolean DEFAULT false,
	"total_events" integer DEFAULT 0 NOT NULL,
	"last_event_date" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "password_reset_tokens" (
	"id" serial PRIMARY KEY NOT NULL,
	"token" varchar(64) NOT NULL,
	"user_id" varchar NOT NULL,
	"email" varchar NOT NULL,
	"token_type" varchar(32) DEFAULT 'password_reset' NOT NULL,
	"expires_at" timestamp NOT NULL,
	"used_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "password_reset_tokens_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "project_assignments" (
	"id" serial PRIMARY KEY NOT NULL,
	"project_id" integer NOT NULL,
	"user_id" text NOT NULL,
	"user_name" text NOT NULL,
	"role" text NOT NULL,
	"added_at" timestamp DEFAULT now() NOT NULL,
	"added_by" varchar,
	CONSTRAINT "project_assignments_project_id_user_id_unique" UNIQUE("project_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "project_comments" (
	"id" serial PRIMARY KEY NOT NULL,
	"project_id" integer NOT NULL,
	"author_name" text NOT NULL,
	"content" text NOT NULL,
	"comment_type" text DEFAULT 'general' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "project_documents" (
	"id" serial PRIMARY KEY NOT NULL,
	"project_id" integer NOT NULL,
	"file_name" text NOT NULL,
	"original_name" text NOT NULL,
	"file_size" integer NOT NULL,
	"mime_type" text NOT NULL,
	"uploaded_by" text NOT NULL,
	"uploaded_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "project_tasks" (
	"id" serial PRIMARY KEY NOT NULL,
	"project_id" integer,
	"title" text NOT NULL,
	"description" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"priority" text DEFAULT 'medium' NOT NULL,
	"assignee_id" text,
	"assignee_name" text,
	"assignee_ids" text[],
	"assignee_names" text[],
	"due_date" text,
	"completed_at" timestamp,
	"attachments" text,
	"order" integer DEFAULT 0 NOT NULL,
	"order_num" integer DEFAULT 0,
	"completed_by" text,
	"completed_by_name" text,
	"origin_type" text DEFAULT 'manual' NOT NULL,
	"source_note_id" integer,
	"source_meeting_id" integer,
	"source_team_board_id" integer,
	"selected_for_agenda" boolean DEFAULT false NOT NULL,
	"parent_task_id" integer,
	"promoted_to_todo" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "projects" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"status" text NOT NULL,
	"priority" text DEFAULT 'medium' NOT NULL,
	"category" text DEFAULT 'technology' NOT NULL,
	"milestone" text,
	"assignee_id" integer,
	"assignee_name" text,
	"assignee_ids" jsonb DEFAULT '[]',
	"assignee_names" text,
	"support_people_ids" jsonb DEFAULT '[]',
	"support_people" text,
	"due_date" text,
	"start_date" text,
	"completion_date" text,
	"progress_percentage" integer DEFAULT 0 NOT NULL,
	"notes" text,
	"requirements" text,
	"deliverables" text,
	"resources" text,
	"blockers" text,
	"tags" text,
	"estimated_hours" integer,
	"actual_hours" integer,
	"budget" varchar,
	"color" text DEFAULT 'blue' NOT NULL,
	"created_by" varchar,
	"created_by_name" varchar,
	"review_in_next_meeting" boolean DEFAULT false NOT NULL,
	"last_discussed_date" text,
	"meeting_discussion_points" text,
	"meeting_decision_items" text,
	"google_sheet_row_id" text,
	"last_synced_at" timestamp,
	"sync_status" text DEFAULT 'unsynced',
	"last_pulled_from_sheet_at" timestamp,
	"last_pushed_to_sheet_at" timestamp,
	"last_sheet_hash" text,
	"last_app_hash" text,
	"tasks_and_owners" text,
	"estimatedhours" integer,
	"actualhours" integer,
	"startdate" text,
	"enddate" text,
	"risklevel" varchar,
	"stakeholders" text,
	"milestones" text,
	"owner_id" text,
	"owner_name" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "promotion_graphics" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"image_url" text NOT NULL,
	"file_name" text NOT NULL,
	"file_size" integer,
	"file_type" varchar(100),
	"intended_use_date" timestamp,
	"target_audience" text DEFAULT 'hosts',
	"status" varchar(50) DEFAULT 'active',
	"notification_sent" boolean DEFAULT false,
	"notification_sent_at" timestamp,
	"view_count" integer DEFAULT 0,
	"uploaded_by" varchar NOT NULL,
	"uploaded_by_name" text NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "proposed_sheet_changes" (
	"id" serial PRIMARY KEY NOT NULL,
	"event_request_id" integer,
	"target_sheet_id" varchar NOT NULL,
	"target_sheet_name" varchar DEFAULT 'Schedule',
	"target_row_index" integer,
	"change_type" varchar NOT NULL,
	"field_name" varchar,
	"current_value" text,
	"proposed_value" text,
	"proposed_row_data" jsonb,
	"column_mapping" jsonb,
	"proposed_by" varchar,
	"proposed_at" timestamp DEFAULT now() NOT NULL,
	"proposal_reason" text,
	"status" varchar DEFAULT 'pending' NOT NULL,
	"reviewed_by" varchar,
	"reviewed_at" timestamp,
	"review_notes" text,
	"applied_at" timestamp,
	"apply_error" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "recipient_tsp_contacts" (
	"id" serial PRIMARY KEY NOT NULL,
	"recipient_id" integer NOT NULL,
	"user_id" varchar,
	"user_name" text,
	"user_email" text,
	"contact_name" text,
	"contact_email" text,
	"contact_phone" text,
	"role" text DEFAULT 'tsp_contact' NOT NULL,
	"notes" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"is_primary" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "recipients" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"contact_name" text,
	"phone" text NOT NULL,
	"email" text,
	"website" text,
	"instagram_handle" text,
	"address" text,
	"region" text,
	"preferences" text,
	"weekly_estimate" integer,
	"focus_area" text,
	"focus_areas" jsonb DEFAULT '[]'::jsonb,
	"status" text DEFAULT 'active' NOT NULL,
	"contact_person_name" text,
	"contact_person_phone" text,
	"contact_person_email" text,
	"contact_person_role" text,
	"second_contact_person_name" text,
	"second_contact_person_phone" text,
	"second_contact_person_email" text,
	"second_contact_person_role" text,
	"reporting_group" text,
	"estimated_sandwiches" integer,
	"sandwich_type" text,
	"tsp_contact" text,
	"tsp_contact_user_id" varchar,
	"contract_signed" boolean DEFAULT false NOT NULL,
	"contract_signed_date" timestamp,
	"collection_day" text,
	"collection_time" text,
	"feeding_day" text,
	"feeding_time" text,
	"has_shared_post" boolean DEFAULT false NOT NULL,
	"shared_post_date" timestamp,
	"average_people_served" integer,
	"people_served_frequency" text,
	"partnership_start_date" timestamp,
	"partnership_years" integer,
	"receiving_fruit" boolean DEFAULT false NOT NULL,
	"receiving_snacks" boolean DEFAULT false NOT NULL,
	"wants_fruit" boolean DEFAULT false NOT NULL,
	"wants_snacks" boolean DEFAULT false NOT NULL,
	"fruit_snacks_notes" text,
	"has_seasonal_changes" boolean DEFAULT false NOT NULL,
	"seasonal_changes_description" text,
	"summer_needs" text,
	"winter_needs" text,
	"preferred_contact_methods" jsonb DEFAULT '[]'::jsonb,
	"allowed_contact_methods" jsonb DEFAULT '["text","email"]'::jsonb,
	"do_not_contact" boolean DEFAULT false NOT NULL,
	"contact_method_notes" text,
	"impact_stories" jsonb DEFAULT '[]'::jsonb,
	"collection_schedules" jsonb DEFAULT '[]'::jsonb,
	"feeding_schedules" jsonb DEFAULT '[]'::jsonb,
	"latitude" numeric,
	"longitude" numeric,
	"geocoded_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "resource_tag_assignments" (
	"id" serial PRIMARY KEY NOT NULL,
	"resource_id" integer NOT NULL,
	"tag_id" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "unique_resource_tag_assignment" UNIQUE("resource_id","tag_id")
);
--> statement-breakpoint
CREATE TABLE "resource_tags" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"color" text,
	"description" text,
	"created_by" varchar NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "resource_tags_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "resources" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"type" text NOT NULL,
	"category" text NOT NULL,
	"document_id" integer,
	"url" text,
	"icon" text,
	"icon_color" text,
	"is_pinned_global" boolean DEFAULT false NOT NULL,
	"pinned_order" integer,
	"access_count" integer DEFAULT 0 NOT NULL,
	"last_accessed_at" timestamp,
	"created_by" varchar NOT NULL,
	"created_by_name" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sandwich_collections" (
	"id" serial PRIMARY KEY NOT NULL,
	"collection_date" text NOT NULL,
	"host_name" text NOT NULL,
	"individual_sandwiches" integer DEFAULT 0 NOT NULL,
	"individual_deli" integer,
	"individual_turkey" integer,
	"individual_ham" integer,
	"individual_pbj" integer,
	"individual_generic" integer,
	"group1_name" text,
	"group1_count" integer,
	"group2_name" text,
	"group2_count" integer,
	"group_collections" jsonb DEFAULT '[]' NOT NULL,
	"created_by" text,
	"created_by_name" text,
	"submitted_at" timestamp DEFAULT now() NOT NULL,
	"submission_method" text DEFAULT 'standard',
	"deleted_at" timestamp,
	"deleted_by" text,
	"event_request_id" integer
);
--> statement-breakpoint
CREATE TABLE "sandwich_distributions" (
	"id" serial PRIMARY KEY NOT NULL,
	"distribution_date" text NOT NULL,
	"week_ending" text NOT NULL,
	"host_id" integer NOT NULL,
	"host_name" text NOT NULL,
	"recipient_id" integer NOT NULL,
	"recipient_name" text NOT NULL,
	"sandwich_count" integer NOT NULL,
	"notes" text,
	"created_by" text NOT NULL,
	"created_by_name" text NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "sandwich_distributions_host_id_recipient_id_distribution_date_unique" UNIQUE("host_id","recipient_id","distribution_date")
);
--> statement-breakpoint
CREATE TABLE "search_analytics" (
	"id" serial PRIMARY KEY NOT NULL,
	"query" text NOT NULL,
	"result_id" varchar,
	"clicked" boolean DEFAULT false NOT NULL,
	"timestamp" timestamp DEFAULT now() NOT NULL,
	"user_id" varchar,
	"user_role" varchar,
	"used_ai" boolean DEFAULT false NOT NULL,
	"results_count" integer DEFAULT 0 NOT NULL,
	"query_time" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"sid" varchar PRIMARY KEY NOT NULL,
	"sess" jsonb NOT NULL,
	"expire" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stream_channels" (
	"id" serial PRIMARY KEY NOT NULL,
	"channel_id" varchar NOT NULL,
	"user_id" varchar NOT NULL,
	"folder" varchar DEFAULT 'inbox' NOT NULL,
	"last_read" timestamp,
	"custom_data" jsonb DEFAULT '{}',
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "stream_channels_channel_id_unique" UNIQUE("channel_id")
);
--> statement-breakpoint
CREATE TABLE "stream_messages" (
	"id" serial PRIMARY KEY NOT NULL,
	"stream_message_id" varchar NOT NULL,
	"channel_id" varchar NOT NULL,
	"user_id" varchar NOT NULL,
	"is_starred" boolean DEFAULT false NOT NULL,
	"is_draft" boolean DEFAULT false NOT NULL,
	"folder" varchar DEFAULT 'inbox' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "stream_messages_stream_message_id_unique" UNIQUE("stream_message_id")
);
--> statement-breakpoint
CREATE TABLE "stream_threads" (
	"id" serial PRIMARY KEY NOT NULL,
	"stream_thread_id" varchar NOT NULL,
	"parent_message_id" integer,
	"title" text,
	"participants" jsonb DEFAULT '[]' NOT NULL,
	"last_reply_at" timestamp,
	"reply_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "stream_threads_stream_thread_id_unique" UNIQUE("stream_thread_id")
);
--> statement-breakpoint
CREATE TABLE "stream_users" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar NOT NULL,
	"stream_user_id" varchar NOT NULL,
	"stream_token" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "stream_users_stream_user_id_unique" UNIQUE("stream_user_id")
);
--> statement-breakpoint
CREATE TABLE "suggestion_responses" (
	"id" serial PRIMARY KEY NOT NULL,
	"suggestion_id" integer NOT NULL,
	"message" text NOT NULL,
	"is_admin_response" boolean DEFAULT false NOT NULL,
	"responded_by" varchar NOT NULL,
	"respondent_name" text,
	"is_internal" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "suggestions" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"category" text DEFAULT 'general' NOT NULL,
	"priority" text DEFAULT 'medium' NOT NULL,
	"status" text DEFAULT 'submitted' NOT NULL,
	"submitted_by" varchar NOT NULL,
	"submitter_email" varchar,
	"submitter_name" text,
	"is_anonymous" boolean DEFAULT false NOT NULL,
	"upvotes" integer DEFAULT 0 NOT NULL,
	"tags" text[] DEFAULT '{}',
	"implementation_notes" text,
	"estimated_effort" text,
	"assigned_to" varchar,
	"completed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "task_assignments" (
	"id" serial PRIMARY KEY NOT NULL,
	"task_id" integer NOT NULL,
	"user_id" text NOT NULL,
	"user_name" text NOT NULL,
	"role" text DEFAULT 'assignee' NOT NULL,
	"added_at" timestamp DEFAULT now() NOT NULL,
	"added_by" varchar,
	CONSTRAINT "task_assignments_task_id_user_id_unique" UNIQUE("task_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "task_completions" (
	"id" serial PRIMARY KEY NOT NULL,
	"task_id" integer NOT NULL,
	"user_id" text NOT NULL,
	"user_name" text NOT NULL,
	"completed_at" timestamp DEFAULT now() NOT NULL,
	"notes" text,
	CONSTRAINT "task_completions_task_id_user_id_unique" UNIQUE("task_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "team_board_assignments" (
	"id" serial PRIMARY KEY NOT NULL,
	"item_id" integer NOT NULL,
	"user_id" text NOT NULL,
	"user_name" text NOT NULL,
	"added_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "team_board_assignments_item_id_user_id_unique" UNIQUE("item_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "team_board_comments" (
	"id" serial PRIMARY KEY NOT NULL,
	"item_id" integer NOT NULL,
	"user_id" varchar NOT NULL,
	"user_name" varchar NOT NULL,
	"content" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "team_board_item_categories" (
	"id" serial PRIMARY KEY NOT NULL,
	"item_id" integer NOT NULL,
	"category_id" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "team_board_item_categories_item_id_category_id_unique" UNIQUE("item_id","category_id")
);
--> statement-breakpoint
CREATE TABLE "team_board_item_likes" (
	"id" serial PRIMARY KEY NOT NULL,
	"item_id" integer NOT NULL,
	"user_id" varchar NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "team_board_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"content" text NOT NULL,
	"type" varchar DEFAULT 'task',
	"created_by" varchar NOT NULL,
	"created_by_name" varchar NOT NULL,
	"assigned_to" text[],
	"assigned_to_names" text[],
	"status" varchar DEFAULT 'open' NOT NULL,
	"category_id" integer,
	"is_urgent" boolean DEFAULT false NOT NULL,
	"is_private" boolean DEFAULT false NOT NULL,
	"shared_with_user_id" varchar,
	"details" text,
	"due_date" timestamp,
	"project_id" integer,
	"promoted_to_task_id" integer,
	"promoted_at" timestamp,
	"parent_item_id" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"completed_at" timestamp,
	"is_canvas" boolean DEFAULT false NOT NULL,
	"canvas_sections" jsonb,
	"canvas_status" varchar DEFAULT 'draft',
	"canvas_published_snapshot" jsonb,
	"canvas_published_at" timestamp,
	"canvas_published_by" varchar
);
--> statement-breakpoint
CREATE TABLE "tracked_calendar_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"external_id" varchar,
	"category" varchar NOT NULL,
	"title" text NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date NOT NULL,
	"notes" text,
	"metadata" jsonb DEFAULT '{}',
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "tracked_calendar_items_external_id_unique" UNIQUE("external_id")
);
--> statement-breakpoint
CREATE TABLE "tsp_contact_followups" (
	"id" serial PRIMARY KEY NOT NULL,
	"event_request_id" integer NOT NULL,
	"tsp_contact_user_id" varchar NOT NULL,
	"reminder_type" varchar NOT NULL,
	"delivery_channel" varchar NOT NULL,
	"sent_at" timestamp DEFAULT now() NOT NULL,
	"delivery_status" varchar DEFAULT 'sent',
	"event_organization" varchar,
	"event_date" timestamp,
	"message_preview" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_activity_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar NOT NULL,
	"action" varchar NOT NULL,
	"section" varchar NOT NULL,
	"details" jsonb DEFAULT '{}',
	"session_id" varchar,
	"ip_address" varchar,
	"user_agent" text,
	"duration" integer,
	"page" varchar,
	"feature" varchar,
	"metadata" jsonb DEFAULT '{}',
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_email_templates" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar NOT NULL,
	"new_org_subject" text,
	"new_org_body" text,
	"returning_contact_subject" text,
	"returning_contact_body" text,
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "user_notification_patterns" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar NOT NULL,
	"most_active_hours" jsonb DEFAULT '[]',
	"most_active_days" jsonb DEFAULT '[]',
	"average_response_time" integer,
	"preferred_channels" jsonb DEFAULT '[]',
	"overall_engagement_score" numeric(5, 2) DEFAULT '50.00',
	"category_engagement" jsonb DEFAULT '{}',
	"recent_engagement_trend" varchar DEFAULT 'stable',
	"last_model_update" timestamp,
	"model_version" varchar DEFAULT '1.0',
	"learning_metadata" jsonb DEFAULT '{}',
	"content_preferences" jsonb DEFAULT '{}',
	"timing_preferences" jsonb DEFAULT '{}',
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_notification_patterns_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "user_resource_favorites" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar NOT NULL,
	"resource_id" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "unique_user_resource_favorite" UNIQUE("user_id","resource_id")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" varchar PRIMARY KEY NOT NULL,
	"email" varchar,
	"password" varchar,
	"first_name" varchar,
	"last_name" varchar,
	"display_name" varchar,
	"profile_image_url" varchar,
	"phone_number" varchar,
	"preferred_email" varchar,
	"role" varchar DEFAULT 'volunteer' NOT NULL,
	"permissions" jsonb DEFAULT '[]',
	"permissions_modified_at" timestamp,
	"permissions_modified_by" varchar,
	"address" text,
	"van_approved" boolean DEFAULT false,
	"latitude" varchar,
	"longitude" varchar,
	"geocoded_at" timestamp,
	"metadata" jsonb DEFAULT '{}',
	"is_active" boolean DEFAULT true NOT NULL,
	"needs_password_setup" boolean DEFAULT false,
	"last_login_at" timestamp,
	"last_active_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	"password_backup_20241023" text,
	"approval_status" text,
	"approved_by" varchar,
	"approved_at" timestamp,
	"platform_user_id" varchar,
	"sms_alerts_enabled" boolean,
	"email_notifications_enabled" boolean,
	"notify_on_new_intake" boolean,
	"notify_on_task_due" boolean,
	"notify_on_status_change" boolean,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "volunteers" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"phone" text,
	"email" text,
	"address" text,
	"notes" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"vehicle_type" text,
	"license_number" text,
	"availability" text DEFAULT 'available',
	"zone" text,
	"route_description" text,
	"host_location" text,
	"host_id" integer,
	"van_approved" boolean DEFAULT false NOT NULL,
	"home_address" text,
	"availability_notes" text,
	"email_agreement_sent" boolean DEFAULT false NOT NULL,
	"voicemail_left" boolean DEFAULT false NOT NULL,
	"inactive_reason" text,
	"volunteer_type" text DEFAULT 'general' NOT NULL,
	"is_driver" boolean DEFAULT false NOT NULL,
	"is_speaker" boolean DEFAULT false NOT NULL,
	"latitude" numeric,
	"longitude" numeric,
	"geocoded_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "weekly_reports" (
	"id" serial PRIMARY KEY NOT NULL,
	"week_ending" text NOT NULL,
	"sandwich_count" integer NOT NULL,
	"notes" text,
	"submitted_by" text NOT NULL,
	"submitted_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wishlist_suggestions" (
	"id" serial PRIMARY KEY NOT NULL,
	"item" text NOT NULL,
	"reason" text,
	"priority" varchar DEFAULT 'medium' NOT NULL,
	"suggested_by" varchar NOT NULL,
	"status" varchar DEFAULT 'pending' NOT NULL,
	"admin_notes" text,
	"amazon_url" text,
	"estimated_cost" numeric(10, 2),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"reviewed_at" timestamp,
	"reviewed_by" varchar
);
--> statement-breakpoint
CREATE TABLE "work_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar NOT NULL,
	"description" text NOT NULL,
	"hours" integer DEFAULT 0 NOT NULL,
	"minutes" integer DEFAULT 0 NOT NULL,
	"work_date" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	"status" varchar(20) DEFAULT 'pending',
	"approved_by" varchar,
	"approved_at" timestamp with time zone,
	"visibility" varchar(20) DEFAULT 'private',
	"shared_with" jsonb DEFAULT '[]'::jsonb,
	"department" varchar(50),
	"team_id" varchar
);
--> statement-breakpoint
CREATE TABLE "yearly_calendar_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"month" integer NOT NULL,
	"year" integer NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"category" varchar DEFAULT 'preparation',
	"priority" varchar DEFAULT 'medium',
	"start_date" date,
	"end_date" date,
	"created_by" varchar NOT NULL,
	"created_by_name" varchar NOT NULL,
	"assigned_to" text[],
	"assigned_to_names" text[],
	"is_recurring" boolean DEFAULT true NOT NULL,
	"recurrence_type" varchar DEFAULT 'none',
	"recurrence_pattern" jsonb,
	"recurrence_end_date" date,
	"is_completed" boolean DEFAULT false NOT NULL,
	"completed_at" timestamp,
	"completed_by" varchar,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "alert_requests" ADD CONSTRAINT "alert_requests_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alert_requests" ADD CONSTRAINT "alert_requests_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ambassador_candidates" ADD CONSTRAINT "ambassador_candidates_added_by_users_id_fk" FOREIGN KEY ("added_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ambassador_candidates" ADD CONSTRAINT "ambassador_candidates_last_contacted_by_users_id_fk" FOREIGN KEY ("last_contacted_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "availability_slots" ADD CONSTRAINT "availability_slots_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_message_likes" ADD CONSTRAINT "chat_message_likes_message_id_chat_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."chat_messages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_message_reads" ADD CONSTRAINT "chat_message_reads_message_id_chat_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."chat_messages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversation_participants" ADD CONSTRAINT "conversation_participants_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cooler_inventory" ADD CONSTRAINT "cooler_inventory_cooler_type_id_cooler_types_id_fk" FOREIGN KEY ("cooler_type_id") REFERENCES "public"."cooler_types"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_access_logs" ADD CONSTRAINT "document_access_logs_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_permissions" ADD CONSTRAINT "document_permissions_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_permissions" ADD CONSTRAINT "document_permissions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_logs" ADD CONSTRAINT "email_logs_event_id_event_requests_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."event_requests"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_logs" ADD CONSTRAINT "email_logs_sent_by_users_id_fk" FOREIGN KEY ("sent_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_collaboration_comment_likes" ADD CONSTRAINT "event_collaboration_comment_likes_comment_id_event_collaboration_comments_id_fk" FOREIGN KEY ("comment_id") REFERENCES "public"."event_collaboration_comments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_collaboration_comment_likes" ADD CONSTRAINT "event_collaboration_comment_likes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_collaboration_comments" ADD CONSTRAINT "event_collaboration_comments_event_request_id_event_requests_id_fk" FOREIGN KEY ("event_request_id") REFERENCES "public"."event_requests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_collaboration_comments" ADD CONSTRAINT "event_collaboration_comments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_edit_revisions" ADD CONSTRAINT "event_edit_revisions_event_request_id_event_requests_id_fk" FOREIGN KEY ("event_request_id") REFERENCES "public"."event_requests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_edit_revisions" ADD CONSTRAINT "event_edit_revisions_changed_by_users_id_fk" FOREIGN KEY ("changed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_field_locks" ADD CONSTRAINT "event_field_locks_event_request_id_event_requests_id_fk" FOREIGN KEY ("event_request_id") REFERENCES "public"."event_requests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_field_locks" ADD CONSTRAINT "event_field_locks_locked_by_users_id_fk" FOREIGN KEY ("locked_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "google_sheets" ADD CONSTRAINT "google_sheets_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kudos_tracking" ADD CONSTRAINT "kudos_tracking_message_id_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."messages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meeting_projects" ADD CONSTRAINT "meeting_projects_meeting_id_meetings_id_fk" FOREIGN KEY ("meeting_id") REFERENCES "public"."meetings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meeting_projects" ADD CONSTRAINT "meeting_projects_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message_likes" ADD CONSTRAINT "message_likes_message_id_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."messages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message_recipients" ADD CONSTRAINT "message_recipients_message_id_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."messages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_ab_tests" ADD CONSTRAINT "notification_ab_tests_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_action_history" ADD CONSTRAINT "notification_action_history_notification_id_notifications_id_fk" FOREIGN KEY ("notification_id") REFERENCES "public"."notifications"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_action_history" ADD CONSTRAINT "notification_action_history_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_action_history" ADD CONSTRAINT "notification_action_history_undone_by_users_id_fk" FOREIGN KEY ("undone_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_history" ADD CONSTRAINT "notification_history_notification_id_notifications_id_fk" FOREIGN KEY ("notification_id") REFERENCES "public"."notifications"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_history" ADD CONSTRAINT "notification_history_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_preferences" ADD CONSTRAINT "notification_preferences_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "password_reset_tokens" ADD CONSTRAINT "password_reset_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_assignments" ADD CONSTRAINT "project_assignments_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proposed_sheet_changes" ADD CONSTRAINT "proposed_sheet_changes_event_request_id_event_requests_id_fk" FOREIGN KEY ("event_request_id") REFERENCES "public"."event_requests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proposed_sheet_changes" ADD CONSTRAINT "proposed_sheet_changes_proposed_by_users_id_fk" FOREIGN KEY ("proposed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proposed_sheet_changes" ADD CONSTRAINT "proposed_sheet_changes_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recipient_tsp_contacts" ADD CONSTRAINT "recipient_tsp_contacts_recipient_id_recipients_id_fk" FOREIGN KEY ("recipient_id") REFERENCES "public"."recipients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recipient_tsp_contacts" ADD CONSTRAINT "recipient_tsp_contacts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resource_tag_assignments" ADD CONSTRAINT "resource_tag_assignments_resource_id_resources_id_fk" FOREIGN KEY ("resource_id") REFERENCES "public"."resources"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resource_tag_assignments" ADD CONSTRAINT "resource_tag_assignments_tag_id_resource_tags_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."resource_tags"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resources" ADD CONSTRAINT "resources_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stream_threads" ADD CONSTRAINT "stream_threads_parent_message_id_stream_messages_id_fk" FOREIGN KEY ("parent_message_id") REFERENCES "public"."stream_messages"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_assignments" ADD CONSTRAINT "task_assignments_task_id_project_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."project_tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_board_assignments" ADD CONSTRAINT "team_board_assignments_item_id_team_board_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."team_board_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_board_comments" ADD CONSTRAINT "team_board_comments_item_id_team_board_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."team_board_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_board_item_categories" ADD CONSTRAINT "team_board_item_categories_item_id_team_board_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."team_board_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_board_item_categories" ADD CONSTRAINT "team_board_item_categories_category_id_holding_zone_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."holding_zone_categories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_board_item_likes" ADD CONSTRAINT "team_board_item_likes_item_id_team_board_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."team_board_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_board_items" ADD CONSTRAINT "team_board_items_category_id_holding_zone_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."holding_zone_categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_board_items" ADD CONSTRAINT "team_board_items_parent_item_id_team_board_items_id_fk" FOREIGN KEY ("parent_item_id") REFERENCES "public"."team_board_items"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tsp_contact_followups" ADD CONSTRAINT "tsp_contact_followups_event_request_id_event_requests_id_fk" FOREIGN KEY ("event_request_id") REFERENCES "public"."event_requests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tsp_contact_followups" ADD CONSTRAINT "tsp_contact_followups_tsp_contact_user_id_users_id_fk" FOREIGN KEY ("tsp_contact_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_email_templates" ADD CONSTRAINT "user_email_templates_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_notification_patterns" ADD CONSTRAINT "user_notification_patterns_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_resource_favorites" ADD CONSTRAINT "user_resource_favorites_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_resource_favorites" ADD CONSTRAINT "user_resource_favorites_resource_id_resources_id_fk" FOREIGN KEY ("resource_id") REFERENCES "public"."resources"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_activities_type" ON "activities" USING btree ("type");--> statement-breakpoint
CREATE INDEX "idx_activities_created_by" ON "activities" USING btree ("created_by");--> statement-breakpoint
CREATE INDEX "idx_activities_parent_id" ON "activities" USING btree ("parent_id");--> statement-breakpoint
CREATE INDEX "idx_activities_root_id" ON "activities" USING btree ("root_id");--> statement-breakpoint
CREATE INDEX "idx_activities_context" ON "activities" USING btree ("context_type","context_id");--> statement-breakpoint
CREATE INDEX "idx_activities_last_activity" ON "activities" USING btree ("last_activity_at");--> statement-breakpoint
CREATE INDEX "idx_activities_is_deleted" ON "activities" USING btree ("is_deleted");--> statement-breakpoint
CREATE INDEX "idx_activities_status" ON "activities" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_activities_created_at" ON "activities" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_activity_attachments_activity" ON "activity_attachments" USING btree ("activity_id");--> statement-breakpoint
CREATE INDEX "idx_activity_attachments_uploaded_by" ON "activity_attachments" USING btree ("uploaded_by");--> statement-breakpoint
CREATE INDEX "idx_activity_participants_activity" ON "activity_participants" USING btree ("activity_id");--> statement-breakpoint
CREATE INDEX "idx_activity_participants_user" ON "activity_participants" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_activity_participants_activity_user" ON "activity_participants" USING btree ("activity_id","user_id");--> statement-breakpoint
CREATE INDEX "idx_activity_reactions_activity" ON "activity_reactions" USING btree ("activity_id");--> statement-breakpoint
CREATE INDEX "idx_activity_reactions_user" ON "activity_reactions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_alert_requests_user" ON "alert_requests" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_alert_requests_status" ON "alert_requests" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_alert_requests_created" ON "alert_requests" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_ambassador_canonical" ON "ambassador_candidates" USING btree ("canonical_name");--> statement-breakpoint
CREATE INDEX "idx_ambassador_status" ON "ambassador_candidates" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_ambassador_priority" ON "ambassador_candidates" USING btree ("priority");--> statement-breakpoint
CREATE INDEX "idx_ambassador_next_followup" ON "ambassador_candidates" USING btree ("next_follow_up_date");--> statement-breakpoint
CREATE INDEX "idx_chat_reads_user_channel" ON "chat_message_reads" USING btree ("user_id","channel");--> statement-breakpoint
CREATE INDEX "idx_client_error_logs_created_at" ON "client_error_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_client_error_logs_user_id" ON "client_error_logs" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_dismissed_announcements_user" ON "dismissed_announcements" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_document_access_doc" ON "document_access_logs" USING btree ("document_id");--> statement-breakpoint
CREATE INDEX "idx_document_access_user" ON "document_access_logs" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_document_access_action_time" ON "document_access_logs" USING btree ("action","accessed_at");--> statement-breakpoint
CREATE INDEX "idx_document_permissions_doc_user" ON "document_permissions" USING btree ("document_id","user_id");--> statement-breakpoint
CREATE INDEX "idx_document_permissions_user" ON "document_permissions" USING btree ("user_id","permission_type");--> statement-breakpoint
CREATE INDEX "idx_document_permissions_doc" ON "document_permissions" USING btree ("document_id","permission_type");--> statement-breakpoint
CREATE INDEX "idx_documents_category" ON "documents" USING btree ("category");--> statement-breakpoint
CREATE INDEX "idx_documents_uploaded_by" ON "documents" USING btree ("uploaded_by");--> statement-breakpoint
CREATE INDEX "idx_documents_active" ON "documents" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "idx_drafts_user" ON "email_drafts" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_email_logs_event_id" ON "email_logs" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "idx_email_logs_sent_by" ON "email_logs" USING btree ("sent_by");--> statement-breakpoint
CREATE INDEX "idx_email_sender" ON "email_messages" USING btree ("sender_id");--> statement-breakpoint
CREATE INDEX "idx_email_recipient" ON "email_messages" USING btree ("recipient_id");--> statement-breakpoint
CREATE INDEX "idx_email_read" ON "email_messages" USING btree ("is_read");--> statement-breakpoint
CREATE INDEX "idx_email_trashed" ON "email_messages" USING btree ("is_trashed");--> statement-breakpoint
CREATE INDEX "idx_email_draft" ON "email_messages" USING btree ("is_draft");--> statement-breakpoint
CREATE INDEX "idx_email_template_type" ON "email_template_sections" USING btree ("template_type");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_email_template_section_unique" ON "email_template_sections" USING btree ("template_type","section_key");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_checkin_reminders_event_user_rule" ON "event_check_in_reminders" USING btree ("event_request_id","user_id","rule_type");--> statement-breakpoint
CREATE INDEX "idx_checkin_reminders_next_due" ON "event_check_in_reminders" USING btree ("next_due_at");--> statement-breakpoint
CREATE INDEX "idx_checkin_reminders_enabled" ON "event_check_in_reminders" USING btree ("enabled");--> statement-breakpoint
CREATE INDEX "idx_checkin_reminders_rule_type" ON "event_check_in_reminders" USING btree ("rule_type");--> statement-breakpoint
CREATE INDEX "idx_comment_likes_comment_id" ON "event_collaboration_comment_likes" USING btree ("comment_id");--> statement-breakpoint
CREATE INDEX "idx_comment_likes_user_id" ON "event_collaboration_comment_likes" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_event_collab_comments_event_id" ON "event_collaboration_comments" USING btree ("event_request_id");--> statement-breakpoint
CREATE INDEX "idx_event_collab_comments_user_id" ON "event_collaboration_comments" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_event_collab_comments_created_at" ON "event_collaboration_comments" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_event_edit_revisions_event_id" ON "event_edit_revisions" USING btree ("event_request_id");--> statement-breakpoint
CREATE INDEX "idx_event_edit_revisions_field_name" ON "event_edit_revisions" USING btree ("field_name");--> statement-breakpoint
CREATE INDEX "idx_event_edit_revisions_created_at" ON "event_edit_revisions" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_event_field_locks_event_id" ON "event_field_locks" USING btree ("event_request_id");--> statement-breakpoint
CREATE INDEX "idx_event_field_locks_expires_at" ON "event_field_locks" USING btree ("expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_reminder_snoozes_active_event_user" ON "event_reminder_snoozes" USING btree ("event_request_id","user_id") WHERE active = true;--> statement-breakpoint
CREATE INDEX "idx_reminder_snoozes_active" ON "event_reminder_snoozes" USING btree ("active");--> statement-breakpoint
CREATE INDEX "idx_event_reminders_event_id" ON "event_reminders" USING btree ("event_request_id");--> statement-breakpoint
CREATE INDEX "idx_event_reminders_due_date" ON "event_reminders" USING btree ("due_date");--> statement-breakpoint
CREATE INDEX "idx_event_reminders_status" ON "event_reminders" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_event_reminders_assigned" ON "event_reminders" USING btree ("assigned_to_user_id");--> statement-breakpoint
CREATE INDEX "idx_event_reminders_type_status" ON "event_reminders" USING btree ("reminder_type","status");--> statement-breakpoint
CREATE INDEX "idx_event_requests_org_name" ON "event_requests" USING btree ("organization_name");--> statement-breakpoint
CREATE INDEX "idx_event_requests_status" ON "event_requests" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_event_requests_email" ON "event_requests" USING btree ("email");--> statement-breakpoint
CREATE INDEX "idx_event_requests_desired_date" ON "event_requests" USING btree ("desired_event_date");--> statement-breakpoint
CREATE INDEX "idx_event_requests_created_at" ON "event_requests" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_event_requests_scheduled_date" ON "event_requests" USING btree ("scheduled_event_date");--> statement-breakpoint
CREATE INDEX "idx_event_volunteers_event_id" ON "event_volunteers" USING btree ("event_request_id");--> statement-breakpoint
CREATE INDEX "idx_event_volunteers_volunteer" ON "event_volunteers" USING btree ("volunteer_user_id");--> statement-breakpoint
CREATE INDEX "idx_event_volunteers_role_status" ON "event_volunteers" USING btree ("role","status");--> statement-breakpoint
CREATE INDEX "idx_expenses_context" ON "expenses" USING btree ("context_type","context_id");--> statement-breakpoint
CREATE INDEX "idx_expenses_uploaded_by" ON "expenses" USING btree ("uploaded_by");--> statement-breakpoint
CREATE INDEX "idx_expenses_status" ON "expenses" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_expenses_category" ON "expenses" USING btree ("category");--> statement-breakpoint
CREATE INDEX "idx_expenses_purchase_date" ON "expenses" USING btree ("purchase_date");--> statement-breakpoint
CREATE INDEX "idx_feature_flags_enabled" ON "feature_flags" USING btree ("enabled");--> statement-breakpoint
CREATE INDEX "idx_feature_flags_flag_name" ON "feature_flags" USING btree ("flag_name");--> statement-breakpoint
CREATE INDEX "idx_impact_reports_period" ON "impact_reports" USING btree ("report_period");--> statement-breakpoint
CREATE INDEX "idx_impact_reports_type" ON "impact_reports" USING btree ("report_type");--> statement-breakpoint
CREATE INDEX "idx_impact_reports_status" ON "impact_reports" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_impact_reports_start_date" ON "impact_reports" USING btree ("start_date");--> statement-breakpoint
CREATE UNIQUE INDEX "unique_report_period_type" ON "impact_reports" USING btree ("report_period","report_type");--> statement-breakpoint
CREATE INDEX "idx_imported_external_ids_external_id" ON "imported_external_ids" USING btree ("external_id");--> statement-breakpoint
CREATE INDEX "idx_imported_external_ids_source_table" ON "imported_external_ids" USING btree ("source_table");--> statement-breakpoint
CREATE INDEX "idx_imported_external_ids_imported_at" ON "imported_external_ids" USING btree ("imported_at");--> statement-breakpoint
CREATE INDEX "idx_instant_message_likes_message" ON "instant_message_likes" USING btree ("message_id");--> statement-breakpoint
CREATE INDEX "idx_instant_message_likes_user" ON "instant_message_likes" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_instant_messages_sender" ON "instant_messages" USING btree ("sender_id");--> statement-breakpoint
CREATE INDEX "idx_instant_messages_recipient" ON "instant_messages" USING btree ("recipient_id");--> statement-breakpoint
CREATE INDEX "idx_instant_messages_conversation" ON "instant_messages" USING btree ("sender_id","recipient_id");--> statement-breakpoint
CREATE INDEX "idx_kudos_sender" ON "kudos_tracking" USING btree ("sender_id");--> statement-breakpoint
CREATE INDEX "idx_meeting_projects_meeting" ON "meeting_projects" USING btree ("meeting_id");--> statement-breakpoint
CREATE INDEX "idx_meeting_projects_project" ON "meeting_projects" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "idx_meeting_projects_status" ON "meeting_projects" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_meeting_projects_include" ON "meeting_projects" USING btree ("include_in_agenda");--> statement-breakpoint
CREATE INDEX "idx_message_likes_message" ON "message_likes" USING btree ("message_id");--> statement-breakpoint
CREATE INDEX "idx_message_likes_user" ON "message_likes" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_message_recipients_unread" ON "message_recipients" USING btree ("recipient_id","read");--> statement-breakpoint
CREATE INDEX "idx_notif_ab_tests_status" ON "notification_ab_tests" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_notif_ab_tests_category_type" ON "notification_ab_tests" USING btree ("category","type");--> statement-breakpoint
CREATE INDEX "idx_notif_ab_tests_active" ON "notification_ab_tests" USING btree ("status","start_date","end_date");--> statement-breakpoint
CREATE INDEX "idx_notif_action_history_notif" ON "notification_action_history" USING btree ("notification_id");--> statement-breakpoint
CREATE INDEX "idx_notif_action_history_user" ON "notification_action_history" USING btree ("user_id","action_type");--> statement-breakpoint
CREATE INDEX "idx_notif_action_history_status" ON "notification_action_history" USING btree ("action_status");--> statement-breakpoint
CREATE INDEX "idx_notif_analytics_period" ON "notification_analytics" USING btree ("period_type","period_start");--> statement-breakpoint
CREATE INDEX "idx_notif_analytics_category_type_channel" ON "notification_analytics" USING btree ("category","type","delivery_channel");--> statement-breakpoint
CREATE INDEX "idx_notif_analytics_performance" ON "notification_analytics" USING btree ("open_rate","click_rate");--> statement-breakpoint
CREATE INDEX "idx_notif_history_notif_user" ON "notification_history" USING btree ("notification_id","user_id");--> statement-breakpoint
CREATE INDEX "idx_notif_history_user_channel" ON "notification_history" USING btree ("user_id","delivery_channel");--> statement-breakpoint
CREATE INDEX "idx_notif_history_delivery_status" ON "notification_history" USING btree ("delivery_status");--> statement-breakpoint
CREATE INDEX "idx_notif_history_interaction_time" ON "notification_history" USING btree ("opened_at","clicked_at");--> statement-breakpoint
CREATE INDEX "idx_notif_prefs_user_category" ON "notification_preferences" USING btree ("user_id","category");--> statement-breakpoint
CREATE INDEX "idx_notif_prefs_relevance" ON "notification_preferences" USING btree ("relevance_score");--> statement-breakpoint
CREATE INDEX "idx_notif_rules_category_type" ON "notification_rules" USING btree ("category","type");--> statement-breakpoint
CREATE INDEX "idx_notif_rules_active" ON "notification_rules" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "idx_org_engagement_canonical" ON "organization_engagement_scores" USING btree ("canonical_name");--> statement-breakpoint
CREATE INDEX "idx_org_engagement_score" ON "organization_engagement_scores" USING btree ("overall_engagement_score");--> statement-breakpoint
CREATE INDEX "idx_org_engagement_level" ON "organization_engagement_scores" USING btree ("engagement_level");--> statement-breakpoint
CREATE INDEX "idx_org_engagement_priority" ON "organization_engagement_scores" USING btree ("outreach_priority");--> statement-breakpoint
CREATE INDEX "idx_org_engagement_category" ON "organization_engagement_scores" USING btree ("category");--> statement-breakpoint
CREATE INDEX "idx_org_engagement_last_calc" ON "organization_engagement_scores" USING btree ("last_calculated_at");--> statement-breakpoint
CREATE INDEX "idx_organizations_name" ON "organizations" USING btree ("name");--> statement-breakpoint
CREATE INDEX "idx_password_reset_tokens_token" ON "password_reset_tokens" USING btree ("token");--> statement-breakpoint
CREATE INDEX "idx_password_reset_tokens_user_id" ON "password_reset_tokens" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_password_reset_tokens_expires" ON "password_reset_tokens" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "idx_project_assignments_project" ON "project_assignments" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "idx_project_assignments_user" ON "project_assignments" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_project_assignments_role" ON "project_assignments" USING btree ("role");--> statement-breakpoint
CREATE INDEX "idx_promotion_graphics_status" ON "promotion_graphics" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_promotion_graphics_target_audience" ON "promotion_graphics" USING btree ("target_audience");--> statement-breakpoint
CREATE INDEX "idx_promotion_graphics_uploaded_by" ON "promotion_graphics" USING btree ("uploaded_by");--> statement-breakpoint
CREATE INDEX "idx_promotion_graphics_intended_use_date" ON "promotion_graphics" USING btree ("intended_use_date");--> statement-breakpoint
CREATE INDEX "idx_recipient_tsp_contacts_recipient" ON "recipient_tsp_contacts" USING btree ("recipient_id");--> statement-breakpoint
CREATE INDEX "idx_recipient_tsp_contacts_user" ON "recipient_tsp_contacts" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_recipient_tsp_contacts_primary" ON "recipient_tsp_contacts" USING btree ("recipient_id","is_primary");--> statement-breakpoint
CREATE INDEX "idx_resource_tag_assignments_resource" ON "resource_tag_assignments" USING btree ("resource_id");--> statement-breakpoint
CREATE INDEX "idx_resource_tag_assignments_tag" ON "resource_tag_assignments" USING btree ("tag_id");--> statement-breakpoint
CREATE INDEX "idx_resource_tags_name" ON "resource_tags" USING btree ("name");--> statement-breakpoint
CREATE INDEX "idx_resources_category" ON "resources" USING btree ("category");--> statement-breakpoint
CREATE INDEX "idx_resources_type" ON "resources" USING btree ("type");--> statement-breakpoint
CREATE INDEX "idx_resources_pinned" ON "resources" USING btree ("is_pinned_global","pinned_order");--> statement-breakpoint
CREATE INDEX "idx_resources_access_count" ON "resources" USING btree ("access_count");--> statement-breakpoint
CREATE INDEX "idx_resources_active" ON "resources" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "idx_distributions_week_ending" ON "sandwich_distributions" USING btree ("week_ending");--> statement-breakpoint
CREATE INDEX "idx_distributions_host" ON "sandwich_distributions" USING btree ("host_id");--> statement-breakpoint
CREATE INDEX "idx_distributions_recipient" ON "sandwich_distributions" USING btree ("recipient_id");--> statement-breakpoint
CREATE INDEX "idx_distributions_date" ON "sandwich_distributions" USING btree ("distribution_date");--> statement-breakpoint
CREATE INDEX "idx_search_analytics_query" ON "search_analytics" USING btree ("query");--> statement-breakpoint
CREATE INDEX "idx_search_analytics_user" ON "search_analytics" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_search_analytics_timestamp" ON "search_analytics" USING btree ("timestamp");--> statement-breakpoint
CREATE INDEX "idx_search_analytics_clicked" ON "search_analytics" USING btree ("clicked");--> statement-breakpoint
CREATE INDEX "IDX_session_expire" ON "sessions" USING btree ("expire");--> statement-breakpoint
CREATE INDEX "idx_task_assignments_task" ON "task_assignments" USING btree ("task_id");--> statement-breakpoint
CREATE INDEX "idx_task_assignments_user" ON "task_assignments" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_team_board_assignments_item" ON "team_board_assignments" USING btree ("item_id");--> statement-breakpoint
CREATE INDEX "idx_team_board_assignments_user" ON "team_board_assignments" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "unique_team_board_item_like" ON "team_board_item_likes" USING btree ("item_id","user_id");--> statement-breakpoint
CREATE INDEX "idx_team_board_item_likes_item" ON "team_board_item_likes" USING btree ("item_id");--> statement-breakpoint
CREATE INDEX "idx_team_board_item_likes_user" ON "team_board_item_likes" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_tracked_calendar_category" ON "tracked_calendar_items" USING btree ("category");--> statement-breakpoint
CREATE INDEX "idx_tracked_calendar_dates" ON "tracked_calendar_items" USING btree ("start_date","end_date");--> statement-breakpoint
CREATE INDEX "idx_tracked_calendar_external_id" ON "tracked_calendar_items" USING btree ("external_id");--> statement-breakpoint
CREATE INDEX "idx_tsp_followup_event" ON "tsp_contact_followups" USING btree ("event_request_id");--> statement-breakpoint
CREATE INDEX "idx_tsp_followup_contact" ON "tsp_contact_followups" USING btree ("tsp_contact_user_id");--> statement-breakpoint
CREATE INDEX "idx_tsp_followup_type" ON "tsp_contact_followups" USING btree ("reminder_type");--> statement-breakpoint
CREATE INDEX "idx_tsp_followup_sent" ON "tsp_contact_followups" USING btree ("sent_at");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_tsp_followup_unique" ON "tsp_contact_followups" USING btree ("event_request_id","tsp_contact_user_id","reminder_type");--> statement-breakpoint
CREATE INDEX "idx_user_activity_user_action" ON "user_activity_logs" USING btree ("user_id","action");--> statement-breakpoint
CREATE INDEX "idx_user_activity_section_time" ON "user_activity_logs" USING btree ("section","created_at");--> statement-breakpoint
CREATE INDEX "idx_user_activity_user_time" ON "user_activity_logs" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_user_email_templates_user_id" ON "user_email_templates" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_user_patterns_engagement" ON "user_notification_patterns" USING btree ("overall_engagement_score");--> statement-breakpoint
CREATE INDEX "idx_user_patterns_model_update" ON "user_notification_patterns" USING btree ("last_model_update");--> statement-breakpoint
CREATE INDEX "idx_user_resource_favorites_user" ON "user_resource_favorites" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_user_resource_favorites_resource" ON "user_resource_favorites" USING btree ("resource_id");--> statement-breakpoint
CREATE INDEX "idx_yearly_calendar_month_year" ON "yearly_calendar_items" USING btree ("year","month");--> statement-breakpoint
CREATE INDEX "idx_yearly_calendar_dates" ON "yearly_calendar_items" USING btree ("start_date","end_date");