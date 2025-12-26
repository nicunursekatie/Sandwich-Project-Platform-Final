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
ALTER TABLE "event_requests" ADD COLUMN "volunteer_details" jsonb;--> statement-breakpoint
CREATE INDEX "idx_email_template_type" ON "email_template_sections" USING btree ("template_type");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_email_template_section_unique" ON "email_template_sections" USING btree ("template_type","section_key");