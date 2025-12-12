CREATE TABLE "instant_message_likes" (
	"id" serial PRIMARY KEY NOT NULL,
	"message_id" integer NOT NULL,
	"user_id" varchar NOT NULL,
	"user_name" varchar NOT NULL,
	"emoji" varchar DEFAULT '❤️' NOT NULL,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "instant_message_likes_message_id_user_id_emoji_unique" UNIQUE("message_id","user_id","emoji")
);
--> statement-breakpoint
ALTER TABLE "project_tasks" ADD COLUMN "parent_task_id" integer;--> statement-breakpoint
ALTER TABLE "project_tasks" ADD COLUMN "promoted_to_todo" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "needs_password_setup" boolean DEFAULT false;--> statement-breakpoint
CREATE INDEX "idx_instant_message_likes_message" ON "instant_message_likes" USING btree ("message_id");--> statement-breakpoint
CREATE INDEX "idx_instant_message_likes_user" ON "instant_message_likes" USING btree ("user_id");