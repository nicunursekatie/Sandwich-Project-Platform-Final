-- Proposed Sheet Changes - Safety gate for app-to-sheet writes
-- Changes proposed by the app are queued here for human review before being written to Google Sheets

CREATE TABLE IF NOT EXISTS "proposed_sheet_changes" (
  "id" SERIAL PRIMARY KEY,

  -- Which event this change relates to
  "event_request_id" INTEGER REFERENCES "event_requests"("id") ON DELETE CASCADE,

  -- Target sheet information
  "target_sheet_id" VARCHAR NOT NULL,
  "target_sheet_name" VARCHAR DEFAULT 'Schedule',
  "target_row_index" INTEGER,

  -- The proposed change
  "change_type" VARCHAR NOT NULL,
  "field_name" VARCHAR,
  "current_value" TEXT,
  "proposed_value" TEXT,
  "proposed_row_data" JSONB,

  -- Mapping info for safety
  "column_mapping" JSONB,

  -- Who proposed it
  "proposed_by" VARCHAR REFERENCES "users"("id"),
  "proposed_at" TIMESTAMP DEFAULT NOW() NOT NULL,
  "proposal_reason" TEXT,

  -- Review status
  "status" VARCHAR NOT NULL DEFAULT 'pending',
  "reviewed_by" VARCHAR REFERENCES "users"("id"),
  "reviewed_at" TIMESTAMP,
  "review_notes" TEXT,

  -- If approved and applied
  "applied_at" TIMESTAMP,
  "apply_error" TEXT,

  -- Audit trail
  "created_at" TIMESTAMP DEFAULT NOW() NOT NULL,
  "updated_at" TIMESTAMP DEFAULT NOW() NOT NULL
);

--> statement-breakpoint

-- Index for quick lookup of pending changes
CREATE INDEX IF NOT EXISTS "idx_proposed_sheet_changes_status" ON "proposed_sheet_changes" ("status");

--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "idx_proposed_sheet_changes_event" ON "proposed_sheet_changes" ("event_request_id");

--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "idx_proposed_sheet_changes_proposed_at" ON "proposed_sheet_changes" ("proposed_at");

--> statement-breakpoint

COMMENT ON TABLE "proposed_sheet_changes" IS 'Safety gate for app-to-sheet writes. All changes proposed by the app are queued here for human review before being written to Google Sheets.';
