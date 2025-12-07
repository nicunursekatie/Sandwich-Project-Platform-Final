CREATE TABLE "event_collaboration_comment_likes" (
	"id" serial PRIMARY KEY NOT NULL,
	"comment_id" integer NOT NULL,
	"user_id" varchar NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "event_collaboration_comment_likes_comment_id_user_id_unique" UNIQUE("comment_id","user_id")
);
--> statement-breakpoint
ALTER TABLE "event_requests" ADD COLUMN "backup_contact_first_name" varchar;--> statement-breakpoint
ALTER TABLE "event_requests" ADD COLUMN "backup_contact_last_name" varchar;--> statement-breakpoint
ALTER TABLE "event_requests" ADD COLUMN "backup_contact_email" varchar;--> statement-breakpoint
ALTER TABLE "event_requests" ADD COLUMN "backup_contact_phone" varchar;--> statement-breakpoint
ALTER TABLE "event_requests" ADD COLUMN "backup_contact_role" varchar;--> statement-breakpoint
ALTER TABLE "event_requests" ADD COLUMN "partner_organizations" jsonb;--> statement-breakpoint
ALTER TABLE "event_requests" ADD COLUMN "pre_event_flags" jsonb DEFAULT '[]';--> statement-breakpoint
ALTER TABLE "volunteers" ADD COLUMN "is_driver" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "volunteers" ADD COLUMN "is_speaker" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "volunteers" ADD COLUMN "latitude" numeric;--> statement-breakpoint
ALTER TABLE "volunteers" ADD COLUMN "longitude" numeric;--> statement-breakpoint
ALTER TABLE "volunteers" ADD COLUMN "geocoded_at" timestamp;--> statement-breakpoint
ALTER TABLE "event_collaboration_comment_likes" ADD CONSTRAINT "event_collaboration_comment_likes_comment_id_event_collaboration_comments_id_fk" FOREIGN KEY ("comment_id") REFERENCES "public"."event_collaboration_comments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_collaboration_comment_likes" ADD CONSTRAINT "event_collaboration_comment_likes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_comment_likes_comment_id" ON "event_collaboration_comment_likes" USING btree ("comment_id");--> statement-breakpoint
CREATE INDEX "idx_comment_likes_user_id" ON "event_collaboration_comment_likes" USING btree ("user_id");