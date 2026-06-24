-- Backing table for "Project Threads" compose drafts (gmail-style-inbox auto-save),
-- served by GET/POST/PUT/DELETE /api/drafts. Matches the emailDrafts definition in
-- shared/schema.ts. Idempotent: safe to run against both the dev and production branches.

CREATE TABLE IF NOT EXISTS email_drafts (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR NOT NULL,
  recipient_id VARCHAR NOT NULL,
  recipient_name VARCHAR NOT NULL,
  subject TEXT NOT NULL,
  content TEXT NOT NULL,
  last_saved TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_drafts_user ON email_drafts (user_id);
