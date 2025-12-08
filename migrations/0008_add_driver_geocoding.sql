ALTER TABLE "drivers" ADD COLUMN "latitude" text;--> statement-breakpoint
ALTER TABLE "drivers" ADD COLUMN "longitude" text;--> statement-breakpoint
ALTER TABLE "drivers" ADD COLUMN "geocoded_at" timestamp;--> statement-breakpoint
ALTER TABLE "recipients" ADD COLUMN "latitude" numeric;--> statement-breakpoint
ALTER TABLE "recipients" ADD COLUMN "longitude" numeric;--> statement-breakpoint
ALTER TABLE "recipients" ADD COLUMN "geocoded_at" timestamp;