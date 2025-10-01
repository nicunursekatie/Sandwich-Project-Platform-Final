CREATE TABLE "imported_external_ids" (
	"id" serial PRIMARY KEY NOT NULL,
	"external_id" varchar NOT NULL,
	"imported_at" timestamp DEFAULT now() NOT NULL,
	"source_table" varchar DEFAULT 'event_requests' NOT NULL,
	"notes" text,
	CONSTRAINT "imported_external_ids_external_id_unique" UNIQUE("external_id")
);
--> statement-breakpoint
CREATE TABLE "meeting_notes" (
	"id" serial PRIMARY KEY NOT NULL,
	"project_id" integer NOT NULL,
	"meeting_id" integer,
	"type" text NOT NULL,
	"content" text NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"created_by" varchar,
	"created_by_name" varchar,
	"created_at" timestamp DEFAULT now() NOT NULL
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
ALTER TABLE "kudos_tracking" DROP CONSTRAINT "kudos_tracking_sender_id_recipient_id_context_type_context_id_u";--> statement-breakpoint
ALTER TABLE "sandwich_distributions" DROP CONSTRAINT "sandwich_distributions_host_id_recipient_id_distribution_date_u";--> statement-breakpoint
DROP INDEX "IDX_session_expire";--> statement-breakpoint
DROP INDEX "idx_chat_reads_user_channel";--> statement-breakpoint
DROP INDEX "idx_kudos_sender";--> statement-breakpoint
DROP INDEX "idx_email_draft";--> statement-breakpoint
DROP INDEX "idx_email_read";--> statement-breakpoint
DROP INDEX "idx_email_recipient";--> statement-breakpoint
DROP INDEX "idx_email_sender";--> statement-breakpoint
DROP INDEX "idx_email_trashed";--> statement-breakpoint
DROP INDEX "idx_drafts_user";--> statement-breakpoint
DROP INDEX "idx_user_activity_section_time";--> statement-breakpoint
DROP INDEX "idx_user_activity_user_action";--> statement-breakpoint
DROP INDEX "idx_user_activity_user_time";--> statement-breakpoint
DROP INDEX "idx_message_likes_message";--> statement-breakpoint
DROP INDEX "idx_message_likes_user";--> statement-breakpoint
DROP INDEX "idx_message_recipients_unread";--> statement-breakpoint
DROP INDEX "idx_distributions_date";--> statement-breakpoint
DROP INDEX "idx_distributions_host";--> statement-breakpoint
DROP INDEX "idx_distributions_recipient";--> statement-breakpoint
DROP INDEX "idx_distributions_week_ending";--> statement-breakpoint
DROP INDEX "idx_recipient_tsp_contacts_primary";--> statement-breakpoint
DROP INDEX "idx_recipient_tsp_contacts_recipient";--> statement-breakpoint
DROP INDEX "idx_recipient_tsp_contacts_user";--> statement-breakpoint
DROP INDEX "idx_document_access_action_time";--> statement-breakpoint
DROP INDEX "idx_document_access_doc";--> statement-breakpoint
DROP INDEX "idx_document_access_user";--> statement-breakpoint
DROP INDEX "idx_documents_active";--> statement-breakpoint
DROP INDEX "idx_documents_category";--> statement-breakpoint
DROP INDEX "idx_documents_uploaded_by";--> statement-breakpoint
DROP INDEX "idx_document_permissions_doc";--> statement-breakpoint
DROP INDEX "idx_document_permissions_doc_user";--> statement-breakpoint
DROP INDEX "idx_document_permissions_user";--> statement-breakpoint
DROP INDEX "idx_organizations_name";--> statement-breakpoint
DROP INDEX "idx_event_reminders_assigned";--> statement-breakpoint
DROP INDEX "idx_event_reminders_due_date";--> statement-breakpoint
DROP INDEX "idx_event_reminders_event_id";--> statement-breakpoint
DROP INDEX "idx_event_reminders_status";--> statement-breakpoint
DROP INDEX "idx_event_reminders_type_status";--> statement-breakpoint
DROP INDEX "idx_event_volunteers_event_id";--> statement-breakpoint
DROP INDEX "idx_event_volunteers_role_status";--> statement-breakpoint
DROP INDEX "idx_event_volunteers_volunteer";--> statement-breakpoint
DROP INDEX "idx_event_requests_desired_date";--> statement-breakpoint
DROP INDEX "idx_event_requests_email";--> statement-breakpoint
DROP INDEX "idx_event_requests_org_name";--> statement-breakpoint
DROP INDEX "idx_event_requests_status";--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "permissions" SET DEFAULT '[]';--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "metadata" SET DEFAULT '{}';--> statement-breakpoint
ALTER TABLE "sandwich_collections" ALTER COLUMN "group_collections" SET DEFAULT '[]';--> statement-breakpoint
ALTER TABLE "projects" ALTER COLUMN "assignee_ids" SET DEFAULT '[]';--> statement-breakpoint
ALTER TABLE "projects" ALTER COLUMN "support_people_ids" SET DEFAULT '[]';--> statement-breakpoint
ALTER TABLE "notifications" ALTER COLUMN "metadata" SET DEFAULT '{}';--> statement-breakpoint
ALTER TABLE "committee_memberships" ALTER COLUMN "permissions" SET DEFAULT '[]';--> statement-breakpoint
ALTER TABLE "suggestions" ALTER COLUMN "tags" SET DEFAULT '{}';--> statement-breakpoint
ALTER TABLE "archived_projects" ALTER COLUMN "assignee_ids" SET DEFAULT '[]';--> statement-breakpoint
ALTER TABLE "user_activity_logs" ALTER COLUMN "metadata" SET DEFAULT '{}';--> statement-breakpoint
ALTER TABLE "user_activity_logs" ALTER COLUMN "details" SET DEFAULT '{}';--> statement-breakpoint
ALTER TABLE "confidential_documents" ALTER COLUMN "allowed_emails" SET DEFAULT '[]';--> statement-breakpoint
ALTER TABLE "agenda_sections" ALTER COLUMN "items" SET DEFAULT '[]';--> statement-breakpoint
ALTER TABLE "compiled_agendas" ALTER COLUMN "sections" SET DEFAULT '[]';--> statement-breakpoint
ALTER TABLE "compiled_agendas" ALTER COLUMN "deferred_items" SET DEFAULT '[]';--> statement-breakpoint
ALTER TABLE "stream_channels" ALTER COLUMN "custom_data" SET DEFAULT '{}';--> statement-breakpoint
ALTER TABLE "stream_threads" ALTER COLUMN "participants" SET DEFAULT '[]';--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "last_pulled_from_sheet_at" timestamp;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "last_pushed_to_sheet_at" timestamp;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "last_sheet_hash" text;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "last_app_hash" text;--> statement-breakpoint
ALTER TABLE "email_messages" ADD COLUMN "attachments" text[];--> statement-breakpoint
ALTER TABLE "email_messages" ADD COLUMN "include_scheduling_link" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "email_messages" ADD COLUMN "request_phone_call" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "recipients" ADD COLUMN "collection_day" text;--> statement-breakpoint
ALTER TABLE "recipients" ADD COLUMN "collection_time" text;--> statement-breakpoint
ALTER TABLE "recipients" ADD COLUMN "feeding_day" text;--> statement-breakpoint
ALTER TABLE "recipients" ADD COLUMN "feeding_time" text;--> statement-breakpoint
ALTER TABLE "recipients" ADD COLUMN "has_shared_post" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "recipients" ADD COLUMN "shared_post_date" timestamp;--> statement-breakpoint
ALTER TABLE "event_requests" ADD COLUMN "toolkit_sent_by" varchar;--> statement-breakpoint
ALTER TABLE "event_requests" ADD COLUMN "pickup_date_time" timestamp;--> statement-breakpoint
ALTER TABLE "event_requests" ADD COLUMN "assigned_recipient_ids" text[];--> statement-breakpoint
ALTER TABLE "event_requests" ADD COLUMN "actual_attendance" integer;--> statement-breakpoint
ALTER TABLE "event_requests" ADD COLUMN "estimated_attendance" integer;--> statement-breakpoint
ALTER TABLE "event_requests" ADD COLUMN "attendance_recorded_date" timestamp;--> statement-breakpoint
ALTER TABLE "event_requests" ADD COLUMN "attendance_recorded_by" varchar;--> statement-breakpoint
ALTER TABLE "event_requests" ADD COLUMN "attendance_notes" text;--> statement-breakpoint
ALTER TABLE "event_requests" ADD COLUMN "google_sheet_row_id" text;--> statement-breakpoint
ALTER TABLE "event_requests" ADD COLUMN "external_id" varchar NOT NULL;--> statement-breakpoint
ALTER TABLE "notification_ab_tests" ADD CONSTRAINT "notification_ab_tests_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_history" ADD CONSTRAINT "notification_history_notification_id_notifications_id_fk" FOREIGN KEY ("notification_id") REFERENCES "public"."notifications"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_history" ADD CONSTRAINT "notification_history_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_preferences" ADD CONSTRAINT "notification_preferences_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_notification_patterns" ADD CONSTRAINT "user_notification_patterns_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_imported_external_ids_external_id" ON "imported_external_ids" USING btree ("external_id");--> statement-breakpoint
CREATE INDEX "idx_imported_external_ids_source_table" ON "imported_external_ids" USING btree ("source_table");--> statement-breakpoint
CREATE INDEX "idx_imported_external_ids_imported_at" ON "imported_external_ids" USING btree ("imported_at");--> statement-breakpoint
CREATE INDEX "idx_notif_ab_tests_status" ON "notification_ab_tests" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_notif_ab_tests_category_type" ON "notification_ab_tests" USING btree ("category","type");--> statement-breakpoint
CREATE INDEX "idx_notif_ab_tests_active" ON "notification_ab_tests" USING btree ("status","start_date","end_date");--> statement-breakpoint
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
CREATE INDEX "idx_user_patterns_engagement" ON "user_notification_patterns" USING btree ("overall_engagement_score");--> statement-breakpoint
CREATE INDEX "idx_user_patterns_model_update" ON "user_notification_patterns" USING btree ("last_model_update");--> statement-breakpoint
CREATE INDEX "IDX_session_expire" ON "sessions" USING btree ("expire");--> statement-breakpoint
CREATE INDEX "idx_chat_reads_user_channel" ON "chat_message_reads" USING btree ("user_id","channel");--> statement-breakpoint
CREATE INDEX "idx_kudos_sender" ON "kudos_tracking" USING btree ("sender_id");--> statement-breakpoint
CREATE INDEX "idx_email_draft" ON "email_messages" USING btree ("is_draft");--> statement-breakpoint
CREATE INDEX "idx_email_read" ON "email_messages" USING btree ("is_read");--> statement-breakpoint
CREATE INDEX "idx_email_recipient" ON "email_messages" USING btree ("recipient_id");--> statement-breakpoint
CREATE INDEX "idx_email_sender" ON "email_messages" USING btree ("sender_id");--> statement-breakpoint
CREATE INDEX "idx_email_trashed" ON "email_messages" USING btree ("is_trashed");--> statement-breakpoint
CREATE INDEX "idx_drafts_user" ON "email_drafts" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_user_activity_section_time" ON "user_activity_logs" USING btree ("section","created_at");--> statement-breakpoint
CREATE INDEX "idx_user_activity_user_action" ON "user_activity_logs" USING btree ("user_id","action");--> statement-breakpoint
CREATE INDEX "idx_user_activity_user_time" ON "user_activity_logs" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_message_likes_message" ON "message_likes" USING btree ("message_id");--> statement-breakpoint
CREATE INDEX "idx_message_likes_user" ON "message_likes" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_message_recipients_unread" ON "message_recipients" USING btree ("recipient_id","read");--> statement-breakpoint
CREATE INDEX "idx_distributions_date" ON "sandwich_distributions" USING btree ("distribution_date");--> statement-breakpoint
CREATE INDEX "idx_distributions_host" ON "sandwich_distributions" USING btree ("host_id");--> statement-breakpoint
CREATE INDEX "idx_distributions_recipient" ON "sandwich_distributions" USING btree ("recipient_id");--> statement-breakpoint
CREATE INDEX "idx_distributions_week_ending" ON "sandwich_distributions" USING btree ("week_ending");--> statement-breakpoint
CREATE INDEX "idx_recipient_tsp_contacts_primary" ON "recipient_tsp_contacts" USING btree ("recipient_id","is_primary");--> statement-breakpoint
CREATE INDEX "idx_recipient_tsp_contacts_recipient" ON "recipient_tsp_contacts" USING btree ("recipient_id");--> statement-breakpoint
CREATE INDEX "idx_recipient_tsp_contacts_user" ON "recipient_tsp_contacts" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_document_access_action_time" ON "document_access_logs" USING btree ("action","accessed_at");--> statement-breakpoint
CREATE INDEX "idx_document_access_doc" ON "document_access_logs" USING btree ("document_id");--> statement-breakpoint
CREATE INDEX "idx_document_access_user" ON "document_access_logs" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_documents_active" ON "documents" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "idx_documents_category" ON "documents" USING btree ("category");--> statement-breakpoint
CREATE INDEX "idx_documents_uploaded_by" ON "documents" USING btree ("uploaded_by");--> statement-breakpoint
CREATE INDEX "idx_document_permissions_doc" ON "document_permissions" USING btree ("document_id","permission_type");--> statement-breakpoint
CREATE INDEX "idx_document_permissions_doc_user" ON "document_permissions" USING btree ("document_id","user_id");--> statement-breakpoint
CREATE INDEX "idx_document_permissions_user" ON "document_permissions" USING btree ("user_id","permission_type");--> statement-breakpoint
CREATE INDEX "idx_organizations_name" ON "organizations" USING btree ("name");--> statement-breakpoint
CREATE INDEX "idx_event_reminders_assigned" ON "event_reminders" USING btree ("assigned_to_user_id");--> statement-breakpoint
CREATE INDEX "idx_event_reminders_due_date" ON "event_reminders" USING btree ("due_date");--> statement-breakpoint
CREATE INDEX "idx_event_reminders_event_id" ON "event_reminders" USING btree ("event_request_id");--> statement-breakpoint
CREATE INDEX "idx_event_reminders_status" ON "event_reminders" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_event_reminders_type_status" ON "event_reminders" USING btree ("reminder_type","status");--> statement-breakpoint
CREATE INDEX "idx_event_volunteers_event_id" ON "event_volunteers" USING btree ("event_request_id");--> statement-breakpoint
CREATE INDEX "idx_event_volunteers_role_status" ON "event_volunteers" USING btree ("role","status");--> statement-breakpoint
CREATE INDEX "idx_event_volunteers_volunteer" ON "event_volunteers" USING btree ("volunteer_user_id");--> statement-breakpoint
CREATE INDEX "idx_event_requests_desired_date" ON "event_requests" USING btree ("desired_event_date");--> statement-breakpoint
CREATE INDEX "idx_event_requests_email" ON "event_requests" USING btree ("email");--> statement-breakpoint
CREATE INDEX "idx_event_requests_org_name" ON "event_requests" USING btree ("organization_name");--> statement-breakpoint
CREATE INDEX "idx_event_requests_status" ON "event_requests" USING btree ("status");--> statement-breakpoint
ALTER TABLE "kudos_tracking" ADD CONSTRAINT "kudos_tracking_sender_id_recipient_id_context_type_context_id_unique" UNIQUE("sender_id","recipient_id","context_type","context_id");--> statement-breakpoint
ALTER TABLE "sandwich_distributions" ADD CONSTRAINT "sandwich_distributions_host_id_recipient_id_distribution_date_unique" UNIQUE("host_id","recipient_id","distribution_date");--> statement-breakpoint
ALTER TABLE "event_requests" ADD CONSTRAINT "event_requests_external_id_unique" UNIQUE("external_id");