-- Migration: Add user_email_templates and email_logs tables
-- Date: 2026-03-15
-- Description: Per-user email template customization and email send logging for events
-- Safe to run on existing database - uses IF NOT EXISTS

-- 1. User Email Templates (per-user customizable email templates)
CREATE TABLE IF NOT EXISTS user_email_templates (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  new_org_subject TEXT,
  new_org_body TEXT,
  returning_contact_subject TEXT,
  returning_contact_body TEXT,
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Unique constraint: one template set per user
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_email_templates_user_id
  ON user_email_templates(user_id);

-- 2. Email Logs (tracks all outbound emails sent via the event system)
CREATE TABLE IF NOT EXISTS email_logs (
  id SERIAL PRIMARY KEY,
  event_id INTEGER REFERENCES event_requests(id) ON DELETE SET NULL,
  sent_at TIMESTAMP DEFAULT NOW(),
  sent_by VARCHAR REFERENCES users(id) ON DELETE SET NULL,
  recipient_email TEXT NOT NULL,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  template_type TEXT
);

-- Index for fast lookup of email logs by event
CREATE INDEX IF NOT EXISTS idx_email_logs_event_id ON email_logs(event_id);

-- Index for fast lookup of email logs by sender
CREATE INDEX IF NOT EXISTS idx_email_logs_sent_by ON email_logs(sent_by);
