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
ALTER TABLE "recipients" ADD COLUMN "average_people_served" integer;--> statement-breakpoint
ALTER TABLE "recipients" ADD COLUMN "people_served_frequency" text;--> statement-breakpoint
ALTER TABLE "recipients" ADD COLUMN "partnership_start_date" timestamp;--> statement-breakpoint
ALTER TABLE "recipients" ADD COLUMN "partnership_years" integer;--> statement-breakpoint
ALTER TABLE "recipients" ADD COLUMN "receiving_fruit" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "recipients" ADD COLUMN "receiving_snacks" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "recipients" ADD COLUMN "wants_fruit" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "recipients" ADD COLUMN "wants_snacks" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "recipients" ADD COLUMN "fruit_snacks_notes" text;--> statement-breakpoint
ALTER TABLE "recipients" ADD COLUMN "has_seasonal_changes" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "recipients" ADD COLUMN "seasonal_changes_description" text;--> statement-breakpoint
ALTER TABLE "recipients" ADD COLUMN "summer_needs" text;--> statement-breakpoint
ALTER TABLE "recipients" ADD COLUMN "winter_needs" text;--> statement-breakpoint
ALTER TABLE "recipients" ADD COLUMN "collection_schedules" jsonb DEFAULT '[]'::jsonb;--> statement-breakpoint
ALTER TABLE "recipients" ADD COLUMN "feeding_schedules" jsonb DEFAULT '[]'::jsonb;--> statement-breakpoint
ALTER TABLE "sandwich_collections" ADD COLUMN "event_request_id" integer;--> statement-breakpoint
ALTER TABLE "alert_requests" ADD CONSTRAINT "alert_requests_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alert_requests" ADD CONSTRAINT "alert_requests_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_alert_requests_user" ON "alert_requests" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_alert_requests_status" ON "alert_requests" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_alert_requests_created" ON "alert_requests" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_org_engagement_canonical" ON "organization_engagement_scores" USING btree ("canonical_name");--> statement-breakpoint
CREATE INDEX "idx_org_engagement_score" ON "organization_engagement_scores" USING btree ("overall_engagement_score");--> statement-breakpoint
CREATE INDEX "idx_org_engagement_level" ON "organization_engagement_scores" USING btree ("engagement_level");--> statement-breakpoint
CREATE INDEX "idx_org_engagement_priority" ON "organization_engagement_scores" USING btree ("outreach_priority");--> statement-breakpoint
CREATE INDEX "idx_org_engagement_category" ON "organization_engagement_scores" USING btree ("category");--> statement-breakpoint
CREATE INDEX "idx_org_engagement_last_calc" ON "organization_engagement_scores" USING btree ("last_calculated_at");