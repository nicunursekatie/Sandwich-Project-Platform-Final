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
ALTER TABLE "event_requests" ALTER COLUMN "first_name" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "event_requests" ALTER COLUMN "last_name" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "event_requests" ALTER COLUMN "organization_name" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "host_contacts" ADD COLUMN "address" text;--> statement-breakpoint
ALTER TABLE "host_contacts" ADD COLUMN "weekly_active" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "host_contacts" ADD COLUMN "last_scraped" timestamp;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "permissions_modified_at" timestamp;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "permissions_modified_by" varchar;--> statement-breakpoint
ALTER TABLE "availability_slots" ADD CONSTRAINT "availability_slots_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;