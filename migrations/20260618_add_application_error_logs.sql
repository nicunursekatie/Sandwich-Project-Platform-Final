-- Centralized server-side error log for SMS failures, integration outages, cron issues, etc.
-- Viewable in Admin Settings → Error Logs.

CREATE TABLE IF NOT EXISTS application_error_logs (
  id SERIAL PRIMARY KEY,
  source VARCHAR NOT NULL,
  severity VARCHAR NOT NULL DEFAULT 'error',
  category VARCHAR,
  message TEXT NOT NULL,
  details JSONB DEFAULT '{}',
  user_id VARCHAR,
  phone_number VARCHAR,
  request_path VARCHAR,
  email_sent BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_application_error_logs_created_at
  ON application_error_logs (created_at);

CREATE INDEX IF NOT EXISTS idx_application_error_logs_source
  ON application_error_logs (source);

CREATE INDEX IF NOT EXISTS idx_application_error_logs_severity
  ON application_error_logs (severity);
