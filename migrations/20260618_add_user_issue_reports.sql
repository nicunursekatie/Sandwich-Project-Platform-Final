-- User-submitted issue reports (what they were doing, expected vs actual, record context).
-- Viewable in Admin Settings → Error Logs → User Reports.

CREATE TABLE IF NOT EXISTS user_issue_reports (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR NOT NULL,
  user_email VARCHAR,
  user_name VARCHAR,
  page_path TEXT NOT NULL,
  page_label VARCHAR,
  what_doing TEXT NOT NULL,
  expected_outcome TEXT NOT NULL,
  actual_outcome TEXT NOT NULL,
  record_type VARCHAR,
  record_id VARCHAR,
  record_label VARCHAR,
  user_agent TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_issue_reports_created_at
  ON user_issue_reports (created_at);

CREATE INDEX IF NOT EXISTS idx_user_issue_reports_user_id
  ON user_issue_reports (user_id);
