-- Current sql file was generated after introspecting the database
-- If you want to run this migration please uncomment this code before executing migrations
/*
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
CREATE TABLE "agenda_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"submitted_by" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"submitted_at" timestamp DEFAULT now() NOT NULL,
	"meeting_id" integer NOT NULL,
	"section" text
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" varchar PRIMARY KEY NOT NULL,
	"email" varchar,
	"first_name" varchar,
	"last_name" varchar,
	"profile_image_url" varchar,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	"role" varchar DEFAULT 'volunteer' NOT NULL,
	"permissions" jsonb DEFAULT '[]'::jsonb,
	"is_active" boolean DEFAULT true NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"display_name" varchar,
	"password" varchar,
	"last_login_at" timestamp,
	"phone_number" varchar,
	"preferred_email" varchar,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "meetings" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"date" text NOT NULL,
	"time" text NOT NULL,
	"final_agenda" text,
	"status" text DEFAULT 'planning' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"type" text NOT NULL,
	"location" text,
	"description" text
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
CREATE TABLE "sandwich_collections" (
	"id" serial PRIMARY KEY NOT NULL,
	"collection_date" text NOT NULL,
	"host_name" text NOT NULL,
	"individual_sandwiches" integer DEFAULT 0 NOT NULL,
	"submitted_at" timestamp DEFAULT now() NOT NULL,
	"created_by" text,
	"created_by_name" text,
	"group1_name" text,
	"group1_count" integer,
	"group2_name" text,
	"group2_count" integer,
	"submission_method" text DEFAULT 'standard',
	"group_collections" jsonb DEFAULT '[]'::jsonb NOT NULL
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
CREATE TABLE "hosts" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text,
	"phone" text,
	"status" text DEFAULT 'active' NOT NULL,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"address" text
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"sid" varchar PRIMARY KEY NOT NULL,
	"sess" jsonb NOT NULL,
	"expire" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "projects" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"status" text NOT NULL,
	"assignee_id" integer,
	"assignee_name" text,
	"color" text DEFAULT 'blue' NOT NULL,
	"priority" text DEFAULT 'medium' NOT NULL,
	"category" text DEFAULT 'technology' NOT NULL,
	"due_date" text,
	"start_date" text,
	"completion_date" text,
	"progress_percentage" integer DEFAULT 0 NOT NULL,
	"notes" text,
	"tags" text,
	"estimated_hours" integer,
	"actual_hours" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"requirements" text,
	"deliverables" text,
	"resources" text,
	"blockers" text,
	"estimatedhours" integer,
	"actualhours" integer,
	"startdate" text,
	"enddate" text,
	"budget" varchar,
	"risklevel" varchar,
	"stakeholders" text,
	"milestones" text,
	"assignee_ids" jsonb DEFAULT '[]'::jsonb,
	"assignee_names" text,
	"created_by" varchar,
	"created_by_name" varchar,
	"support_people_ids" jsonb DEFAULT '[]'::jsonb,
	"support_people" text,
	"review_in_next_meeting" boolean DEFAULT false NOT NULL,
	"sync_status" text DEFAULT 'unsynced',
	"last_synced_at" timestamp,
	"google_sheet_row_id" text,
	"tasks_and_owners" text,
	"last_discussed_date" text,
	"milestone" text,
	"meeting_discussion_points" text,
	"meeting_decision_items" text
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
CREATE TABLE "host_contacts" (
	"id" serial PRIMARY KEY NOT NULL,
	"host_id" integer NOT NULL,
	"name" text NOT NULL,
	"role" text NOT NULL,
	"phone" text NOT NULL,
	"email" text,
	"is_primary" boolean DEFAULT false NOT NULL,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"host_location" text
);
--> statement-breakpoint
CREATE TABLE "project_comments" (
	"id" serial PRIMARY KEY NOT NULL,
	"content" text NOT NULL,
	"author_name" text NOT NULL,
	"comment_type" text DEFAULT 'general' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"project_id" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "project_tasks" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"priority" text DEFAULT 'medium' NOT NULL,
	"assignee_name" text,
	"due_date" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"order_num" integer DEFAULT 0,
	"project_id" integer NOT NULL,
	"completed_at" timestamp,
	"order" integer DEFAULT 0 NOT NULL,
	"attachments" text,
	"assignee_id" text,
	"assignee_ids" text[],
	"assignee_names" text[],
	"completed_by" text,
	"completed_by_name" text
);
--> statement-breakpoint
CREATE TABLE "project_assignments" (
	"id" serial PRIMARY KEY NOT NULL,
	"project_id" integer NOT NULL,
	"user_id" text NOT NULL,
	"role" text DEFAULT 'member' NOT NULL,
	"assigned_at" timestamp DEFAULT now() NOT NULL
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
CREATE TABLE "notifications" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar NOT NULL,
	"type" varchar NOT NULL,
	"title" text NOT NULL,
	"message" text NOT NULL,
	"is_read" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"priority" varchar DEFAULT 'medium' NOT NULL,
	"is_archived" boolean DEFAULT false NOT NULL,
	"category" varchar,
	"action_url" text,
	"action_text" text,
	"expires_at" timestamp,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"related_type" varchar,
	"related_id" integer
);
--> statement-breakpoint
CREATE TABLE "contacts" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"phone" text NOT NULL,
	"email" text,
	"role" text,
	"notes" text,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"organization" text,
	"address" text,
	"category" text DEFAULT 'general' NOT NULL,
	"status" text DEFAULT 'active' NOT NULL
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
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"van_approved" boolean DEFAULT false NOT NULL,
	"home_address" text,
	"availability_notes" text,
	"email_agreement_sent" boolean DEFAULT false NOT NULL,
	"voicemail_left" boolean DEFAULT false NOT NULL,
	"inactive_reason" text,
	"host_id" integer,
	"route_description" text,
	"host_location" text,
	"area" text
);
--> statement-breakpoint
CREATE TABLE "conversations" (
	"id" serial PRIMARY KEY NOT NULL,
	"type" text NOT NULL,
	"name" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "committees" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar NOT NULL,
	"description" text,
	"created_at" timestamp DEFAULT now(),
	"is_active" boolean DEFAULT true NOT NULL,
	"updated_at" timestamp DEFAULT now()
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
CREATE TABLE "messages" (
	"id" serial PRIMARY KEY NOT NULL,
	"conversation_id" integer,
	"user_id" text NOT NULL,
	"content" text NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"sender" text,
	"updated_at" timestamp DEFAULT now(),
	"sender_id" text NOT NULL,
	"context_type" text,
	"context_id" text,
	"edited_at" timestamp,
	"edited_content" text,
	"deleted_at" timestamp,
	"deleted_by" text,
	"read" boolean DEFAULT false NOT NULL,
	"reply_to_message_id" integer,
	"reply_to_content" text,
	"reply_to_sender" text
);
--> statement-breakpoint
CREATE TABLE "committee_memberships" (
	"id" serial PRIMARY KEY NOT NULL,
	"committee_id" integer NOT NULL,
	"user_id" varchar NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"role" varchar DEFAULT 'member' NOT NULL,
	"permissions" jsonb DEFAULT '[]'::jsonb,
	"joined_at" timestamp DEFAULT now(),
	"is_active" boolean DEFAULT true NOT NULL
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
	"tags" text[] DEFAULT '{""}',
	"implementation_notes" text,
	"estimated_effort" text,
	"assigned_to" varchar,
	"completed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
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
CREATE TABLE "work_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar NOT NULL,
	"description" text NOT NULL,
	"hours" integer DEFAULT 0 NOT NULL,
	"minutes" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	"status" varchar(20) DEFAULT 'pending',
	"approved_by" varchar,
	"approved_at" timestamp with time zone,
	"visibility" varchar(20) DEFAULT 'private',
	"shared_with" jsonb DEFAULT '[]'::jsonb,
	"department" varchar(50),
	"team_id" varchar,
	"work_date" timestamp with time zone NOT NULL
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
CREATE TABLE "archived_projects" (
	"id" serial PRIMARY KEY NOT NULL,
	"original_project_id" integer NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"priority" text DEFAULT 'medium' NOT NULL,
	"category" text DEFAULT 'technology' NOT NULL,
	"assignee_id" integer,
	"assignee_name" text,
	"assignee_ids" jsonb DEFAULT '[]'::jsonb,
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
	"archived_by_name" varchar
);
--> statement-breakpoint
CREATE TABLE "kudos_tracking" (
	"id" serial PRIMARY KEY NOT NULL,
	"sender_id" text NOT NULL,
	"recipient_id" text NOT NULL,
	"context_type" text NOT NULL,
	"context_id" text NOT NULL,
	"message_id" integer,
	"sent_at" timestamp DEFAULT now(),
	"entity_name" text DEFAULT 'Legacy Entry' NOT NULL,
	CONSTRAINT "kudos_tracking_sender_id_recipient_id_context_type_context_id_u" UNIQUE("sender_id","recipient_id","context_type","context_id")
);
--> statement-breakpoint
CREATE TABLE "chat_messages" (
	"id" serial PRIMARY KEY NOT NULL,
	"channel" varchar DEFAULT 'general' NOT NULL,
	"user_id" varchar NOT NULL,
	"user_name" varchar NOT NULL,
	"content" text NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"edited_at" timestamp
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
	"read_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
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
CREATE TABLE "user_activity_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar NOT NULL,
	"session_id" varchar,
	"action" varchar NOT NULL,
	"page" varchar,
	"feature" varchar,
	"ip_address" varchar,
	"user_agent" text,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"section" varchar NOT NULL,
	"details" jsonb DEFAULT '{}'::jsonb,
	"duration" integer
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
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"van_approved" boolean DEFAULT false NOT NULL,
	"home_address" text,
	"availability_notes" text,
	"email_agreement_sent" boolean DEFAULT false NOT NULL,
	"voicemail_left" boolean DEFAULT false NOT NULL,
	"inactive_reason" text,
	"host_id" integer,
	"route_description" text,
	"host_location" text,
	"volunteer_type" text DEFAULT 'general' NOT NULL
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
	"read_at" timestamp,
	"notification_sent" boolean DEFAULT false NOT NULL,
	"email_sent_at" timestamp,
	"context_access_revoked" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now(),
	"initially_notified" boolean DEFAULT false NOT NULL,
	"initially_notified_at" timestamp,
	CONSTRAINT "message_recipients_message_id_recipient_id_unique" UNIQUE("message_id","recipient_id")
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
	CONSTRAINT "sandwich_distributions_host_id_recipient_id_distribution_date_u" UNIQUE("distribution_date","host_id","recipient_id")
);
--> statement-breakpoint
CREATE TABLE "confidential_documents" (
	"id" serial PRIMARY KEY NOT NULL,
	"file_name" varchar NOT NULL,
	"original_name" varchar NOT NULL,
	"file_path" varchar NOT NULL,
	"allowed_emails" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"uploaded_by" varchar NOT NULL,
	"uploaded_at" timestamp DEFAULT now() NOT NULL
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
CREATE TABLE "organizations" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar NOT NULL,
	"alternate_names" text[],
	"addresses" text[],
	"domains" text[],
	"total_events" integer DEFAULT 0 NOT NULL,
	"last_event_date" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "recipients" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"phone" text NOT NULL,
	"email" text,
	"address" text,
	"preferences" text,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"contact_name" text,
	"weekly_estimate" integer,
	"region" text,
	"contact_person_name" text,
	"contact_person_phone" text,
	"contact_person_email" text,
	"contact_person_role" text,
	"reporting_group" text,
	"estimated_sandwiches" integer,
	"sandwich_type" text,
	"tsp_contact" text,
	"tsp_contact_user_id" varchar,
	"contract_signed" boolean DEFAULT false NOT NULL,
	"contract_signed_date" timestamp,
	"website" text,
	"focus_area" text,
	"instagram_handle" text,
	"second_contact_person_name" text,
	"second_contact_person_phone" text,
	"second_contact_person_email" text,
	"second_contact_person_role" text
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
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
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
CREATE TABLE "agenda_sections" (
	"id" serial PRIMARY KEY NOT NULL,
	"compiled_agenda_id" integer NOT NULL,
	"title" text NOT NULL,
	"order_index" integer NOT NULL,
	"items" jsonb DEFAULT '[]'::jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "compiled_agendas" (
	"id" serial PRIMARY KEY NOT NULL,
	"meeting_id" integer NOT NULL,
	"title" text NOT NULL,
	"date" text NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"sections" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"deferred_items" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"compiled_by" text NOT NULL,
	"compiled_at" timestamp DEFAULT now() NOT NULL,
	"finalized_at" timestamp,
	"published_at" timestamp
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
CREATE TABLE "event_requests" (
	"id" serial PRIMARY KEY NOT NULL,
	"first_name" varchar NOT NULL,
	"last_name" varchar NOT NULL,
	"email" varchar,
	"phone" varchar,
	"organization_name" varchar NOT NULL,
	"department" varchar,
	"desired_event_date" timestamp,
	"message" text,
	"previously_hosted" varchar DEFAULT 'i_dont_know' NOT NULL,
	"status" varchar DEFAULT 'new' NOT NULL,
	"assigned_to" varchar,
	"organization_exists" boolean DEFAULT false NOT NULL,
	"duplicate_notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"duplicate_check_date" timestamp,
	"last_synced_at" timestamp,
	"created_by" varchar,
	"contacted_at" timestamp,
	"communication_method" varchar,
	"contact_completion_notes" text,
	"event_address" text,
	"estimated_sandwich_count" integer,
	"has_refrigeration" boolean,
	"completed_by_user_id" varchar,
	"tsp_contact_assigned" varchar,
	"toolkit_sent" boolean DEFAULT false,
	"toolkit_sent_date" timestamp,
	"event_start_time" varchar,
	"event_end_time" varchar,
	"pickup_time" varchar,
	"additional_requirements" text,
	"planning_notes" text,
	"tsp_contact" varchar,
	"additional_tsp_contacts" text,
	"custom_tsp_contact" text,
	"toolkit_status" varchar DEFAULT 'not_sent',
	"sandwich_types" jsonb,
	"drivers_arranged" boolean DEFAULT false,
	"driver_details" jsonb,
	"speaker_details" jsonb,
	"follow_up_one_day_completed" boolean DEFAULT false,
	"follow_up_one_day_date" timestamp,
	"follow_up_one_month_completed" boolean DEFAULT false,
	"follow_up_one_month_date" timestamp,
	"follow_up_notes" text,
	"additional_contact_1" varchar,
	"additional_contact_2" varchar,
	"assigned_driver_ids" text[],
	"driver_pickup_time" varchar,
	"driver_notes" text,
	"drivers_needed" integer DEFAULT 0,
	"volunteer_notes" text,
	"speakers_needed" integer DEFAULT 0,
	"contact_attempts" integer DEFAULT 0,
	"last_contact_attempt" timestamp,
	"is_unresponsive" boolean DEFAULT false,
	"marked_unresponsive_at" timestamp,
	"marked_unresponsive_by" varchar,
	"unresponsive_reason" text,
	"contact_method" varchar,
	"next_follow_up_date" timestamp,
	"unresponsive_notes" text,
	"follow_up_method" varchar,
	"updated_email" varchar,
	"follow_up_date" timestamp,
	"delivery_destination" text,
	"assigned_speaker_ids" text[],
	"van_driver_needed" boolean DEFAULT false,
	"assigned_van_driver_id" text,
	"custom_van_driver_name" text,
	"van_driver_notes" text,
	"social_media_post_requested" boolean DEFAULT false,
	"social_media_post_requested_date" timestamp,
	"social_media_post_completed" boolean DEFAULT false,
	"social_media_post_completed_date" timestamp,
	"social_media_post_notes" text,
	"actual_sandwich_count" integer,
	"actual_sandwich_types" jsonb,
	"actual_sandwich_count_recorded_date" timestamp,
	"actual_sandwich_count_recorded_by" varchar,
	"sandwich_distributions" jsonb,
	"distribution_recorded_date" timestamp,
	"distribution_recorded_by" varchar,
	"distribution_notes" text,
	"volunteers_needed" integer DEFAULT 0,
	"assigned_volunteer_ids" text[],
	"assigned_driver_speakers" text[],
	"scheduled_call_date" timestamp,
	"scheduling_notes" text,
	"tsp_contact_assigned_date" timestamp,
	"status_changed_at" timestamp,
	"scheduled_event_date" timestamp,
	"overnight_holding_location" text,
	"overnight_pickup_time" time
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
CREATE TABLE "stream_channels" (
	"id" serial PRIMARY KEY NOT NULL,
	"channel_id" varchar NOT NULL,
	"user_id" varchar NOT NULL,
	"folder" varchar DEFAULT 'inbox' NOT NULL,
	"last_read" timestamp,
	"custom_data" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "stream_channels_channel_id_unique" UNIQUE("channel_id")
);
--> statement-breakpoint
CREATE TABLE "stream_threads" (
	"id" serial PRIMARY KEY NOT NULL,
	"stream_thread_id" varchar NOT NULL,
	"parent_message_id" integer,
	"title" text,
	"participants" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"last_reply_at" timestamp,
	"reply_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "stream_threads_stream_thread_id_unique" UNIQUE("stream_thread_id")
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
ALTER TABLE "messages" ADD CONSTRAINT "messages_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_message_reads" ADD CONSTRAINT "chat_message_reads_message_id_chat_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."chat_messages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kudos_tracking" ADD CONSTRAINT "kudos_tracking_message_id_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."messages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_message_likes" ADD CONSTRAINT "chat_message_likes_message_id_chat_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."chat_messages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message_likes" ADD CONSTRAINT "message_likes_message_id_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."messages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message_recipients" ADD CONSTRAINT "message_recipients_message_id_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."messages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recipient_tsp_contacts" ADD CONSTRAINT "recipient_tsp_contacts_recipient_id_recipients_id_fk" FOREIGN KEY ("recipient_id") REFERENCES "public"."recipients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recipient_tsp_contacts" ADD CONSTRAINT "recipient_tsp_contacts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_access_logs" ADD CONSTRAINT "document_access_logs_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_permissions" ADD CONSTRAINT "document_permissions_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_permissions" ADD CONSTRAINT "document_permissions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "google_sheets" ADD CONSTRAINT "google_sheets_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stream_threads" ADD CONSTRAINT "stream_threads_parent_message_id_stream_messages_id_fk" FOREIGN KEY ("parent_message_id") REFERENCES "public"."stream_messages"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversation_participants" ADD CONSTRAINT "conversation_participants_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "IDX_session_expire" ON "sessions" USING btree ("expire" timestamp_ops);--> statement-breakpoint
CREATE INDEX "idx_chat_reads_user_channel" ON "chat_message_reads" USING btree ("user_id" text_ops,"channel" text_ops);--> statement-breakpoint
CREATE INDEX "idx_kudos_sender" ON "kudos_tracking" USING btree ("sender_id" text_ops);--> statement-breakpoint
CREATE INDEX "idx_email_draft" ON "email_messages" USING btree ("is_draft" bool_ops);--> statement-breakpoint
CREATE INDEX "idx_email_read" ON "email_messages" USING btree ("is_read" bool_ops);--> statement-breakpoint
CREATE INDEX "idx_email_recipient" ON "email_messages" USING btree ("recipient_id" text_ops);--> statement-breakpoint
CREATE INDEX "idx_email_sender" ON "email_messages" USING btree ("sender_id" text_ops);--> statement-breakpoint
CREATE INDEX "idx_email_trashed" ON "email_messages" USING btree ("is_trashed" bool_ops);--> statement-breakpoint
CREATE INDEX "idx_drafts_user" ON "email_drafts" USING btree ("user_id" text_ops);--> statement-breakpoint
CREATE INDEX "idx_user_activity_section_time" ON "user_activity_logs" USING btree ("section" timestamp_ops,"created_at" text_ops);--> statement-breakpoint
CREATE INDEX "idx_user_activity_user_action" ON "user_activity_logs" USING btree ("user_id" text_ops,"action" text_ops);--> statement-breakpoint
CREATE INDEX "idx_user_activity_user_time" ON "user_activity_logs" USING btree ("user_id" timestamp_ops,"created_at" timestamp_ops);--> statement-breakpoint
CREATE INDEX "idx_message_likes_message" ON "message_likes" USING btree ("message_id" int4_ops);--> statement-breakpoint
CREATE INDEX "idx_message_likes_user" ON "message_likes" USING btree ("user_id" text_ops);--> statement-breakpoint
CREATE INDEX "idx_message_recipients_unread" ON "message_recipients" USING btree ("recipient_id" text_ops,"read" text_ops) WHERE (read = false);--> statement-breakpoint
CREATE INDEX "idx_distributions_date" ON "sandwich_distributions" USING btree ("distribution_date" text_ops);--> statement-breakpoint
CREATE INDEX "idx_distributions_host" ON "sandwich_distributions" USING btree ("host_id" int4_ops);--> statement-breakpoint
CREATE INDEX "idx_distributions_recipient" ON "sandwich_distributions" USING btree ("recipient_id" int4_ops);--> statement-breakpoint
CREATE INDEX "idx_distributions_week_ending" ON "sandwich_distributions" USING btree ("week_ending" text_ops);--> statement-breakpoint
CREATE INDEX "idx_recipient_tsp_contacts_primary" ON "recipient_tsp_contacts" USING btree ("recipient_id" int4_ops,"is_primary" int4_ops);--> statement-breakpoint
CREATE INDEX "idx_recipient_tsp_contacts_recipient" ON "recipient_tsp_contacts" USING btree ("recipient_id" int4_ops);--> statement-breakpoint
CREATE INDEX "idx_recipient_tsp_contacts_user" ON "recipient_tsp_contacts" USING btree ("user_id" text_ops);--> statement-breakpoint
CREATE INDEX "idx_document_access_action_time" ON "document_access_logs" USING btree ("action" text_ops,"accessed_at" text_ops);--> statement-breakpoint
CREATE INDEX "idx_document_access_doc" ON "document_access_logs" USING btree ("document_id" int4_ops);--> statement-breakpoint
CREATE INDEX "idx_document_access_user" ON "document_access_logs" USING btree ("user_id" text_ops);--> statement-breakpoint
CREATE INDEX "idx_documents_active" ON "documents" USING btree ("is_active" bool_ops);--> statement-breakpoint
CREATE INDEX "idx_documents_category" ON "documents" USING btree ("category" text_ops);--> statement-breakpoint
CREATE INDEX "idx_documents_uploaded_by" ON "documents" USING btree ("uploaded_by" text_ops);--> statement-breakpoint
CREATE INDEX "idx_document_permissions_doc" ON "document_permissions" USING btree ("document_id" int4_ops,"permission_type" int4_ops);--> statement-breakpoint
CREATE INDEX "idx_document_permissions_doc_user" ON "document_permissions" USING btree ("document_id" int4_ops,"user_id" text_ops);--> statement-breakpoint
CREATE INDEX "idx_document_permissions_user" ON "document_permissions" USING btree ("user_id" text_ops,"permission_type" text_ops);--> statement-breakpoint
CREATE INDEX "idx_organizations_name" ON "organizations" USING btree ("name" text_ops);--> statement-breakpoint
CREATE INDEX "idx_event_reminders_assigned" ON "event_reminders" USING btree ("assigned_to_user_id" text_ops);--> statement-breakpoint
CREATE INDEX "idx_event_reminders_due_date" ON "event_reminders" USING btree ("due_date" timestamp_ops);--> statement-breakpoint
CREATE INDEX "idx_event_reminders_event_id" ON "event_reminders" USING btree ("event_request_id" int4_ops);--> statement-breakpoint
CREATE INDEX "idx_event_reminders_status" ON "event_reminders" USING btree ("status" text_ops);--> statement-breakpoint
CREATE INDEX "idx_event_reminders_type_status" ON "event_reminders" USING btree ("reminder_type" text_ops,"status" text_ops);--> statement-breakpoint
CREATE INDEX "idx_event_volunteers_event_id" ON "event_volunteers" USING btree ("event_request_id" int4_ops);--> statement-breakpoint
CREATE INDEX "idx_event_volunteers_role_status" ON "event_volunteers" USING btree ("role" text_ops,"status" text_ops);--> statement-breakpoint
CREATE INDEX "idx_event_volunteers_volunteer" ON "event_volunteers" USING btree ("volunteer_user_id" text_ops);--> statement-breakpoint
CREATE INDEX "idx_event_requests_desired_date" ON "event_requests" USING btree ("desired_event_date" timestamp_ops);--> statement-breakpoint
CREATE INDEX "idx_event_requests_email" ON "event_requests" USING btree ("email" text_ops);--> statement-breakpoint
CREATE INDEX "idx_event_requests_org_name" ON "event_requests" USING btree ("organization_name" text_ops);--> statement-breakpoint
CREATE INDEX "idx_event_requests_status" ON "event_requests" USING btree ("status" text_ops);
*/