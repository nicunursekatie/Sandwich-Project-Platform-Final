-- Create yearly calendar items table for month-based planning
CREATE TABLE IF NOT EXISTS "yearly_calendar_items" (
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

-- Create index for efficient month/year queries
CREATE INDEX IF NOT EXISTS "idx_yearly_calendar_month_year" 
ON "yearly_calendar_items"("year", "month");

