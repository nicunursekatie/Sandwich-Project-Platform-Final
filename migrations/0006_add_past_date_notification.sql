ALTER TABLE "event_requests" ADD COLUMN "past_date_notification_sent_at" timestamp;--> statement-breakpoint
ALTER TABLE "recipients" ADD COLUMN "preferred_contact_methods" jsonb DEFAULT '[]'::jsonb;--> statement-breakpoint
ALTER TABLE "recipients" ADD COLUMN "allowed_contact_methods" jsonb DEFAULT '["text","email"]'::jsonb;--> statement-breakpoint
ALTER TABLE "recipients" ADD COLUMN "do_not_contact" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "recipients" ADD COLUMN "contact_method_notes" text;--> statement-breakpoint
ALTER TABLE "recipients" ADD COLUMN "impact_stories" jsonb DEFAULT '[]'::jsonb;