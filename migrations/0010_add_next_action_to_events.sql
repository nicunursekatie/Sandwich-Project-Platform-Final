CREATE TABLE "instant_messages" (
	"id" serial PRIMARY KEY NOT NULL,
	"sender_id" varchar NOT NULL,
	"sender_name" varchar NOT NULL,
	"recipient_id" varchar NOT NULL,
	"content" text NOT NULL,
	"read" boolean DEFAULT false,
	"read_at" timestamp,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "team_board_item_categories" (
	"id" serial PRIMARY KEY NOT NULL,
	"item_id" integer NOT NULL,
	"category_id" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "team_board_item_categories_item_id_category_id_unique" UNIQUE("item_id","category_id")
);
--> statement-breakpoint
CREATE TABLE "yearly_calendar_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"month" integer NOT NULL,
	"year" integer NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"category" varchar DEFAULT 'preparation',
	"priority" varchar DEFAULT 'medium',
	"created_by" varchar NOT NULL,
	"created_by_name" varchar NOT NULL,
	"assigned_to" text[],
	"assigned_to_names" text[],
	"is_recurring" boolean DEFAULT true NOT NULL,
	"is_completed" boolean DEFAULT false NOT NULL,
	"completed_at" timestamp,
	"completed_by" varchar,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "event_requests" ADD COLUMN "next_action" text;--> statement-breakpoint
ALTER TABLE "event_requests" ADD COLUMN "next_action_updated_at" timestamp;--> statement-breakpoint
ALTER TABLE "team_board_items" ADD COLUMN "parent_item_id" integer;--> statement-breakpoint
ALTER TABLE "team_board_item_categories" ADD CONSTRAINT "team_board_item_categories_item_id_team_board_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."team_board_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_board_item_categories" ADD CONSTRAINT "team_board_item_categories_category_id_holding_zone_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."holding_zone_categories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_instant_messages_sender" ON "instant_messages" USING btree ("sender_id");--> statement-breakpoint
CREATE INDEX "idx_instant_messages_recipient" ON "instant_messages" USING btree ("recipient_id");--> statement-breakpoint
CREATE INDEX "idx_instant_messages_conversation" ON "instant_messages" USING btree ("sender_id","recipient_id");--> statement-breakpoint
CREATE INDEX "idx_yearly_calendar_month_year" ON "yearly_calendar_items" USING btree ("year","month");--> statement-breakpoint
ALTER TABLE "team_board_items" ADD CONSTRAINT "team_board_items_parent_item_id_team_board_items_id_fk" FOREIGN KEY ("parent_item_id") REFERENCES "public"."team_board_items"("id") ON DELETE set null ON UPDATE no action;