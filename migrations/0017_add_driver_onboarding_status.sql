ALTER TABLE "drivers" ADD COLUMN IF NOT EXISTS "never_fully_onboarded" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "drivers" ADD COLUMN IF NOT EXISTS "wants_to_restart" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "drivers" ADD COLUMN IF NOT EXISTS "unavailable_follow_up" text;--> statement-breakpoint
ALTER TABLE "drivers" ADD COLUMN IF NOT EXISTS "interested_in_van_driving" boolean DEFAULT false NOT NULL;
