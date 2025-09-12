CREATE TABLE "agenda_sections" (
	"id" serial PRIMARY KEY NOT NULL,
	"compiled_agenda_id" integer NOT NULL,
	"title" text NOT NULL,
	"order_index" integer NOT NULL,
	"items" jsonb DEFAULT '[]' NOT NULL
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
	"first_name" varchar NOT NULL,
	"last_name" varchar NOT NULL,
	"email" varchar NOT NULL,
	"phone" varchar,
	"organization_name" varchar NOT NULL,
	"department" varchar,
	"desired_event_date" timestamp,
	"message" text,
	"previously_hosted" varchar DEFAULT 'i_dont_know' NOT NULL,
	"status" varchar DEFAULT 'new' NOT NULL,
	"assigned_to" varchar,
	"follow_up_method" varchar,
	"updated_email" varchar,
	"follow_up_date" timestamp,
	"contacted_at" timestamp,
	"communication_method" varchar,
	"contact_completion_notes" text,
	"event_address" text,
	"estimated_sandwich_count" integer,
	"has_refrigeration" boolean,
	"completed_by_user_id" varchar,
	"tsp_contact_assigned" varchar,
	"tsp_contact" varchar,
	"additional_tsp_contacts" text,
	"additional_contact_1" varchar,
	"additional_contact_2" varchar,
	"custom_tsp_contact" text,
	"toolkit_sent" boolean DEFAULT false,
	"toolkit_sent_date" timestamp,
	"toolkit_status" varchar DEFAULT 'not_sent',
	"event_start_time" varchar,
	"event_end_time" varchar,
	"pickup_time" varchar,
	"additional_requirements" text,
	"planning_notes" text,
	"sandwich_types" jsonb,
	"delivery_destination" text,
	"drivers_needed" integer DEFAULT 0,
	"speakers_needed" integer DEFAULT 0,
	"volunteers_needed" boolean DEFAULT false,
	"volunteer_notes" text,
	"assigned_driver_ids" text[],
	"driver_pickup_time" varchar,
	"driver_notes" text,
	"drivers_arranged" boolean DEFAULT false,
	"assigned_speaker_ids" text[],
	"assigned_driver_speakers" text[],
	"assigned_volunteer_ids" text[],
	"van_driver_needed" boolean DEFAULT false,
	"assigned_van_driver_id" text,
	"custom_van_driver_name" text,
	"van_driver_notes" text,
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
	"unresponsive_reason" text,
	"contact_method" varchar,
	"next_follow_up_date" timestamp,
	"unresponsive_notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"created_by" varchar
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
CREATE TABLE "message_likes" (
	"id" serial PRIMARY KEY NOT NULL,
	"message_id" integer NOT NULL,
	"user_id" text NOT NULL,
	"user_name" text,
	"liked_at" timestamp DEFAULT now(),
	CONSTRAINT "message_likes_message_id_user_id_unique" UNIQUE("message_id","user_id")
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
ALTER TABLE "message_threads" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "message_threads" CASCADE;--> statement-breakpoint
ALTER TABLE "sandwich_collections" ALTER COLUMN "individual_sandwiches" SET DEFAULT 0;--> statement-breakpoint
ALTER TABLE "sandwich_collections" ALTER COLUMN "group_collections" SET DATA TYPE jsonb;--> statement-breakpoint
ALTER TABLE "sandwich_collections" ALTER COLUMN "group_collections" SET DEFAULT '[]';--> statement-breakpoint
ALTER TABLE "drivers" ADD COLUMN "area" text;--> statement-breakpoint
ALTER TABLE "drivers" ADD COLUMN "created_at" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "drivers" ADD COLUMN "updated_at" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "host_contacts" ADD COLUMN "host_location" text;--> statement-breakpoint
ALTER TABLE "messages" ADD COLUMN "reply_to_message_id" integer;--> statement-breakpoint
ALTER TABLE "messages" ADD COLUMN "reply_to_content" text;--> statement-breakpoint
ALTER TABLE "messages" ADD COLUMN "reply_to_sender" text;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "milestone" text;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "support_people_ids" jsonb DEFAULT '[]';--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "support_people" text;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "review_in_next_meeting" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "last_discussed_date" text;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "meeting_discussion_points" text;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "meeting_decision_items" text;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "google_sheet_row_id" text;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "last_synced_at" timestamp;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "sync_status" text DEFAULT 'unsynced';--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "tasks_and_owners" text;--> statement-breakpoint
ALTER TABLE "recipients" ADD COLUMN "website" text;--> statement-breakpoint
ALTER TABLE "recipients" ADD COLUMN "instagram_handle" text;--> statement-breakpoint
ALTER TABLE "recipients" ADD COLUMN "region" text;--> statement-breakpoint
ALTER TABLE "recipients" ADD COLUMN "focus_area" text;--> statement-breakpoint
ALTER TABLE "recipients" ADD COLUMN "contact_person_name" text;--> statement-breakpoint
ALTER TABLE "recipients" ADD COLUMN "contact_person_phone" text;--> statement-breakpoint
ALTER TABLE "recipients" ADD COLUMN "contact_person_email" text;--> statement-breakpoint
ALTER TABLE "recipients" ADD COLUMN "contact_person_role" text;--> statement-breakpoint
ALTER TABLE "recipients" ADD COLUMN "second_contact_person_name" text;--> statement-breakpoint
ALTER TABLE "recipients" ADD COLUMN "second_contact_person_phone" text;--> statement-breakpoint
ALTER TABLE "recipients" ADD COLUMN "second_contact_person_email" text;--> statement-breakpoint
ALTER TABLE "recipients" ADD COLUMN "second_contact_person_role" text;--> statement-breakpoint
ALTER TABLE "recipients" ADD COLUMN "reporting_group" text;--> statement-breakpoint
ALTER TABLE "recipients" ADD COLUMN "estimated_sandwiches" integer;--> statement-breakpoint
ALTER TABLE "recipients" ADD COLUMN "sandwich_type" text;--> statement-breakpoint
ALTER TABLE "recipients" ADD COLUMN "tsp_contact" text;--> statement-breakpoint
ALTER TABLE "recipients" ADD COLUMN "tsp_contact_user_id" varchar;--> statement-breakpoint
ALTER TABLE "recipients" ADD COLUMN "contract_signed" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "recipients" ADD COLUMN "contract_signed_date" timestamp;--> statement-breakpoint
ALTER TABLE "sandwich_collections" ADD COLUMN "group1_name" text;--> statement-breakpoint
ALTER TABLE "sandwich_collections" ADD COLUMN "group1_count" integer;--> statement-breakpoint
ALTER TABLE "sandwich_collections" ADD COLUMN "group2_name" text;--> statement-breakpoint
ALTER TABLE "sandwich_collections" ADD COLUMN "group2_count" integer;--> statement-breakpoint
ALTER TABLE "sandwich_collections" ADD COLUMN "submission_method" text DEFAULT 'standard';--> statement-breakpoint
ALTER TABLE "work_logs" ADD COLUMN "work_date" timestamp with time zone NOT NULL;--> statement-breakpoint
ALTER TABLE "chat_message_likes" ADD CONSTRAINT "chat_message_likes_message_id_chat_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."chat_messages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_access_logs" ADD CONSTRAINT "document_access_logs_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_permissions" ADD CONSTRAINT "document_permissions_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_permissions" ADD CONSTRAINT "document_permissions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message_likes" ADD CONSTRAINT "message_likes_message_id_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."messages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recipient_tsp_contacts" ADD CONSTRAINT "recipient_tsp_contacts_recipient_id_recipients_id_fk" FOREIGN KEY ("recipient_id") REFERENCES "public"."recipients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recipient_tsp_contacts" ADD CONSTRAINT "recipient_tsp_contacts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_document_access_doc" ON "document_access_logs" USING btree ("document_id");--> statement-breakpoint
CREATE INDEX "idx_document_access_user" ON "document_access_logs" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_document_access_action_time" ON "document_access_logs" USING btree ("action","accessed_at");--> statement-breakpoint
CREATE INDEX "idx_document_permissions_doc_user" ON "document_permissions" USING btree ("document_id","user_id");--> statement-breakpoint
CREATE INDEX "idx_document_permissions_user" ON "document_permissions" USING btree ("user_id","permission_type");--> statement-breakpoint
CREATE INDEX "idx_document_permissions_doc" ON "document_permissions" USING btree ("document_id","permission_type");--> statement-breakpoint
CREATE INDEX "idx_documents_category" ON "documents" USING btree ("category");--> statement-breakpoint
CREATE INDEX "idx_documents_uploaded_by" ON "documents" USING btree ("uploaded_by");--> statement-breakpoint
CREATE INDEX "idx_documents_active" ON "documents" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "idx_event_reminders_event_id" ON "event_reminders" USING btree ("event_request_id");--> statement-breakpoint
CREATE INDEX "idx_event_reminders_due_date" ON "event_reminders" USING btree ("due_date");--> statement-breakpoint
CREATE INDEX "idx_event_reminders_status" ON "event_reminders" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_event_reminders_assigned" ON "event_reminders" USING btree ("assigned_to_user_id");--> statement-breakpoint
CREATE INDEX "idx_event_reminders_type_status" ON "event_reminders" USING btree ("reminder_type","status");--> statement-breakpoint
CREATE INDEX "idx_event_requests_org_name" ON "event_requests" USING btree ("organization_name");--> statement-breakpoint
CREATE INDEX "idx_event_requests_status" ON "event_requests" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_event_requests_email" ON "event_requests" USING btree ("email");--> statement-breakpoint
CREATE INDEX "idx_event_requests_desired_date" ON "event_requests" USING btree ("desired_event_date");--> statement-breakpoint
CREATE INDEX "idx_event_volunteers_event_id" ON "event_volunteers" USING btree ("event_request_id");--> statement-breakpoint
CREATE INDEX "idx_event_volunteers_volunteer" ON "event_volunteers" USING btree ("volunteer_user_id");--> statement-breakpoint
CREATE INDEX "idx_event_volunteers_role_status" ON "event_volunteers" USING btree ("role","status");--> statement-breakpoint
CREATE INDEX "idx_message_likes_message" ON "message_likes" USING btree ("message_id");--> statement-breakpoint
CREATE INDEX "idx_message_likes_user" ON "message_likes" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_organizations_name" ON "organizations" USING btree ("name");--> statement-breakpoint
CREATE INDEX "idx_recipient_tsp_contacts_recipient" ON "recipient_tsp_contacts" USING btree ("recipient_id");--> statement-breakpoint
CREATE INDEX "idx_recipient_tsp_contacts_user" ON "recipient_tsp_contacts" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_recipient_tsp_contacts_primary" ON "recipient_tsp_contacts" USING btree ("recipient_id","is_primary");--> statement-breakpoint
CREATE INDEX "idx_distributions_week_ending" ON "sandwich_distributions" USING btree ("week_ending");--> statement-breakpoint
CREATE INDEX "idx_distributions_host" ON "sandwich_distributions" USING btree ("host_id");--> statement-breakpoint
CREATE INDEX "idx_distributions_recipient" ON "sandwich_distributions" USING btree ("recipient_id");--> statement-breakpoint
CREATE INDEX "idx_distributions_date" ON "sandwich_distributions" USING btree ("distribution_date");--> statement-breakpoint
CREATE INDEX "idx_user_activity_user_action" ON "user_activity_logs" USING btree ("user_id","action");--> statement-breakpoint
CREATE INDEX "idx_user_activity_section_time" ON "user_activity_logs" USING btree ("section","created_at");--> statement-breakpoint
CREATE INDEX "idx_user_activity_user_time" ON "user_activity_logs" USING btree ("user_id","created_at");--> statement-breakpoint
ALTER TABLE "email_messages" DROP COLUMN "parent_message_id";--> statement-breakpoint
ALTER TABLE "messages" DROP COLUMN "is_starred";--> statement-breakpoint
ALTER TABLE "messages" DROP COLUMN "is_draft";--> statement-breakpoint
ALTER TABLE "messages" DROP COLUMN "is_archived";--> statement-breakpoint
ALTER TABLE "sandwich_collections" DROP COLUMN "group_sandwiches";