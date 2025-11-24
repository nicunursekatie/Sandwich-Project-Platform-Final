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
CREATE TABLE "holding_zone_categories" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(100) NOT NULL,
	"color" varchar(50) NOT NULL,
	"created_by" varchar NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL
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
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "unique_report_period_type" UNIQUE("report_period","report_type")
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
CREATE TABLE "team_board_item_likes" (
	"id" serial PRIMARY KEY NOT NULL,
	"item_id" integer NOT NULL,
	"user_id" varchar NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
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
ALTER TABLE "event_requests" ALTER COLUMN "pickup_date_time" SET DATA TYPE varchar;--> statement-breakpoint
ALTER TABLE "meeting_notes" ALTER COLUMN "project_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "meeting_notes" ALTER COLUMN "meeting_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "project_assignments" ALTER COLUMN "role" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "project_tasks" ALTER COLUMN "project_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "team_board_items" ALTER COLUMN "type" SET DEFAULT 'task';--> statement-breakpoint
ALTER TABLE "team_board_items" ALTER COLUMN "assigned_to" SET DATA TYPE text[];--> statement-breakpoint
ALTER TABLE "archived_projects" ADD COLUMN "google_sheet_row_id" text;--> statement-breakpoint
ALTER TABLE "drivers" ADD COLUMN "is_weekly_driver" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "event_requests" ADD COLUMN "auto_categories" jsonb;--> statement-breakpoint
ALTER TABLE "event_requests" ADD COLUMN "categorized_at" timestamp;--> statement-breakpoint
ALTER TABLE "event_requests" ADD COLUMN "categorized_by" varchar;--> statement-breakpoint
ALTER TABLE "event_requests" ADD COLUMN "backup_dates" jsonb;--> statement-breakpoint
ALTER TABLE "event_requests" ADD COLUMN "added_to_official_sheet" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "event_requests" ADD COLUMN "postponement_reason" text;--> statement-breakpoint
ALTER TABLE "event_requests" ADD COLUMN "tentative_new_date" timestamp;--> statement-breakpoint
ALTER TABLE "event_requests" ADD COLUMN "postponement_notes" text;--> statement-breakpoint
ALTER TABLE "event_requests" ADD COLUMN "latitude" varchar;--> statement-breakpoint
ALTER TABLE "event_requests" ADD COLUMN "longitude" varchar;--> statement-breakpoint
ALTER TABLE "event_requests" ADD COLUMN "contact_attempts_log" jsonb;--> statement-breakpoint
ALTER TABLE "event_requests" ADD COLUMN "is_mlk_day_event" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "event_requests" ADD COLUMN "mlk_day_marked_at" timestamp;--> statement-breakpoint
ALTER TABLE "event_requests" ADD COLUMN "mlk_day_marked_by" varchar;--> statement-breakpoint
ALTER TABLE "event_requests" ADD COLUMN "deleted_at" timestamp;--> statement-breakpoint
ALTER TABLE "event_requests" ADD COLUMN "deleted_by" varchar;--> statement-breakpoint
ALTER TABLE "event_requests" ADD COLUMN "version" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "event_volunteers" ADD COLUMN "email_reminder_1_sent_at" timestamp;--> statement-breakpoint
ALTER TABLE "event_volunteers" ADD COLUMN "email_reminder_2_sent_at" timestamp;--> statement-breakpoint
ALTER TABLE "event_volunteers" ADD COLUMN "sms_reminder_1_sent_at" timestamp;--> statement-breakpoint
ALTER TABLE "event_volunteers" ADD COLUMN "sms_reminder_2_sent_at" timestamp;--> statement-breakpoint
ALTER TABLE "meeting_notes" ADD COLUMN "converted_to_task_id" integer;--> statement-breakpoint
ALTER TABLE "meeting_notes" ADD COLUMN "converted_at" timestamp;--> statement-breakpoint
ALTER TABLE "meeting_notes" ADD COLUMN "selected_for_agenda" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "messages" ADD COLUMN "context_title" text;--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "department" varchar;--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "category" varchar;--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "school_classification" varchar;--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "is_religious" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "project_assignments" ADD COLUMN "user_name" text NOT NULL;--> statement-breakpoint
ALTER TABLE "project_assignments" ADD COLUMN "added_at" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "project_assignments" ADD COLUMN "added_by" varchar;--> statement-breakpoint
ALTER TABLE "project_tasks" ADD COLUMN "origin_type" text DEFAULT 'manual' NOT NULL;--> statement-breakpoint
ALTER TABLE "project_tasks" ADD COLUMN "source_note_id" integer;--> statement-breakpoint
ALTER TABLE "project_tasks" ADD COLUMN "source_meeting_id" integer;--> statement-breakpoint
ALTER TABLE "project_tasks" ADD COLUMN "source_team_board_id" integer;--> statement-breakpoint
ALTER TABLE "project_tasks" ADD COLUMN "selected_for_agenda" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "owner_id" text;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "owner_name" text;--> statement-breakpoint
ALTER TABLE "recipients" ADD COLUMN "focus_areas" jsonb DEFAULT '[]'::jsonb;--> statement-breakpoint
ALTER TABLE "sandwich_collections" ADD COLUMN "individual_generic" integer;--> statement-breakpoint
ALTER TABLE "sandwich_collections" ADD COLUMN "deleted_at" timestamp;--> statement-breakpoint
ALTER TABLE "sandwich_collections" ADD COLUMN "deleted_by" text;--> statement-breakpoint
ALTER TABLE "team_board_items" ADD COLUMN "assigned_to_names" text[];--> statement-breakpoint
ALTER TABLE "team_board_items" ADD COLUMN "category_id" integer;--> statement-breakpoint
ALTER TABLE "team_board_items" ADD COLUMN "is_urgent" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "team_board_items" ADD COLUMN "is_private" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "team_board_items" ADD COLUMN "details" text;--> statement-breakpoint
ALTER TABLE "team_board_items" ADD COLUMN "due_date" timestamp;--> statement-breakpoint
ALTER TABLE "team_board_items" ADD COLUMN "project_id" integer;--> statement-breakpoint
ALTER TABLE "team_board_items" ADD COLUMN "promoted_to_task_id" integer;--> statement-breakpoint
ALTER TABLE "team_board_items" ADD COLUMN "promoted_at" timestamp;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "password_backup_20241023" text;--> statement-breakpoint
ALTER TABLE "event_collaboration_comments" ADD CONSTRAINT "event_collaboration_comments_event_request_id_event_requests_id_fk" FOREIGN KEY ("event_request_id") REFERENCES "public"."event_requests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_collaboration_comments" ADD CONSTRAINT "event_collaboration_comments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_edit_revisions" ADD CONSTRAINT "event_edit_revisions_event_request_id_event_requests_id_fk" FOREIGN KEY ("event_request_id") REFERENCES "public"."event_requests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_edit_revisions" ADD CONSTRAINT "event_edit_revisions_changed_by_users_id_fk" FOREIGN KEY ("changed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_field_locks" ADD CONSTRAINT "event_field_locks_event_request_id_event_requests_id_fk" FOREIGN KEY ("event_request_id") REFERENCES "public"."event_requests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_field_locks" ADD CONSTRAINT "event_field_locks_locked_by_users_id_fk" FOREIGN KEY ("locked_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meeting_projects" ADD CONSTRAINT "meeting_projects_meeting_id_meetings_id_fk" FOREIGN KEY ("meeting_id") REFERENCES "public"."meetings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meeting_projects" ADD CONSTRAINT "meeting_projects_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_action_history" ADD CONSTRAINT "notification_action_history_notification_id_notifications_id_fk" FOREIGN KEY ("notification_id") REFERENCES "public"."notifications"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_action_history" ADD CONSTRAINT "notification_action_history_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_action_history" ADD CONSTRAINT "notification_action_history_undone_by_users_id_fk" FOREIGN KEY ("undone_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resource_tag_assignments" ADD CONSTRAINT "resource_tag_assignments_resource_id_resources_id_fk" FOREIGN KEY ("resource_id") REFERENCES "public"."resources"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resource_tag_assignments" ADD CONSTRAINT "resource_tag_assignments_tag_id_resource_tags_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."resource_tags"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resources" ADD CONSTRAINT "resources_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_assignments" ADD CONSTRAINT "task_assignments_task_id_project_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."project_tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_board_assignments" ADD CONSTRAINT "team_board_assignments_item_id_team_board_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."team_board_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_board_comments" ADD CONSTRAINT "team_board_comments_item_id_team_board_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."team_board_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_board_item_likes" ADD CONSTRAINT "team_board_item_likes_item_id_team_board_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."team_board_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
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
CREATE INDEX "idx_dismissed_announcements_user" ON "dismissed_announcements" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_event_collab_comments_event_id" ON "event_collaboration_comments" USING btree ("event_request_id");--> statement-breakpoint
CREATE INDEX "idx_event_collab_comments_user_id" ON "event_collaboration_comments" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_event_collab_comments_created_at" ON "event_collaboration_comments" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_event_edit_revisions_event_id" ON "event_edit_revisions" USING btree ("event_request_id");--> statement-breakpoint
CREATE INDEX "idx_event_edit_revisions_field_name" ON "event_edit_revisions" USING btree ("field_name");--> statement-breakpoint
CREATE INDEX "idx_event_edit_revisions_created_at" ON "event_edit_revisions" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_event_field_locks_event_id" ON "event_field_locks" USING btree ("event_request_id");--> statement-breakpoint
CREATE INDEX "idx_event_field_locks_expires_at" ON "event_field_locks" USING btree ("expires_at");--> statement-breakpoint
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
CREATE INDEX "idx_meeting_projects_meeting" ON "meeting_projects" USING btree ("meeting_id");--> statement-breakpoint
CREATE INDEX "idx_meeting_projects_project" ON "meeting_projects" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "idx_meeting_projects_status" ON "meeting_projects" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_meeting_projects_include" ON "meeting_projects" USING btree ("include_in_agenda");--> statement-breakpoint
CREATE INDEX "idx_notif_action_history_notif" ON "notification_action_history" USING btree ("notification_id");--> statement-breakpoint
CREATE INDEX "idx_notif_action_history_user" ON "notification_action_history" USING btree ("user_id","action_type");--> statement-breakpoint
CREATE INDEX "idx_notif_action_history_status" ON "notification_action_history" USING btree ("action_status");--> statement-breakpoint
CREATE INDEX "idx_promotion_graphics_status" ON "promotion_graphics" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_promotion_graphics_target_audience" ON "promotion_graphics" USING btree ("target_audience");--> statement-breakpoint
CREATE INDEX "idx_promotion_graphics_uploaded_by" ON "promotion_graphics" USING btree ("uploaded_by");--> statement-breakpoint
CREATE INDEX "idx_promotion_graphics_intended_use_date" ON "promotion_graphics" USING btree ("intended_use_date");--> statement-breakpoint
CREATE INDEX "idx_resource_tag_assignments_resource" ON "resource_tag_assignments" USING btree ("resource_id");--> statement-breakpoint
CREATE INDEX "idx_resource_tag_assignments_tag" ON "resource_tag_assignments" USING btree ("tag_id");--> statement-breakpoint
CREATE INDEX "idx_resource_tags_name" ON "resource_tags" USING btree ("name");--> statement-breakpoint
CREATE INDEX "idx_resources_category" ON "resources" USING btree ("category");--> statement-breakpoint
CREATE INDEX "idx_resources_type" ON "resources" USING btree ("type");--> statement-breakpoint
CREATE INDEX "idx_resources_pinned" ON "resources" USING btree ("is_pinned_global","pinned_order");--> statement-breakpoint
CREATE INDEX "idx_resources_access_count" ON "resources" USING btree ("access_count");--> statement-breakpoint
CREATE INDEX "idx_resources_active" ON "resources" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "idx_search_analytics_query" ON "search_analytics" USING btree ("query");--> statement-breakpoint
CREATE INDEX "idx_search_analytics_user" ON "search_analytics" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_search_analytics_timestamp" ON "search_analytics" USING btree ("timestamp");--> statement-breakpoint
CREATE INDEX "idx_search_analytics_clicked" ON "search_analytics" USING btree ("clicked");--> statement-breakpoint
CREATE INDEX "idx_task_assignments_task" ON "task_assignments" USING btree ("task_id");--> statement-breakpoint
CREATE INDEX "idx_task_assignments_user" ON "task_assignments" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_team_board_assignments_item" ON "team_board_assignments" USING btree ("item_id");--> statement-breakpoint
CREATE INDEX "idx_team_board_assignments_user" ON "team_board_assignments" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "unique_team_board_item_like" ON "team_board_item_likes" USING btree ("item_id","user_id");--> statement-breakpoint
CREATE INDEX "idx_team_board_item_likes_item" ON "team_board_item_likes" USING btree ("item_id");--> statement-breakpoint
CREATE INDEX "idx_team_board_item_likes_user" ON "team_board_item_likes" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_user_resource_favorites_user" ON "user_resource_favorites" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_user_resource_favorites_resource" ON "user_resource_favorites" USING btree ("resource_id");--> statement-breakpoint
ALTER TABLE "project_assignments" ADD CONSTRAINT "project_assignments_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_board_items" ADD CONSTRAINT "team_board_items_category_id_holding_zone_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."holding_zone_categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_event_requests_created_at" ON "event_requests" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_event_requests_scheduled_date" ON "event_requests" USING btree ("scheduled_event_date");--> statement-breakpoint
CREATE INDEX "idx_project_assignments_project" ON "project_assignments" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "idx_project_assignments_user" ON "project_assignments" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_project_assignments_role" ON "project_assignments" USING btree ("role");--> statement-breakpoint
ALTER TABLE "project_assignments" DROP COLUMN "assigned_at";--> statement-breakpoint
ALTER TABLE "team_board_items" DROP COLUMN "assigned_to_name";--> statement-breakpoint
ALTER TABLE "project_assignments" ADD CONSTRAINT "project_assignments_project_id_user_id_unique" UNIQUE("project_id","user_id");