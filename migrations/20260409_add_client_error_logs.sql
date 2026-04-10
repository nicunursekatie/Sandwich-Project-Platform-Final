-- Client error logs table
-- Stores errors caught by the React ErrorBoundary for debugging
-- These are also emailed to the admin at katie@thesandwichproject.org
CREATE TABLE IF NOT EXISTS client_error_logs (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR,
  user_email VARCHAR,
  user_name VARCHAR,
  user_role VARCHAR,
  message TEXT NOT NULL,
  stack TEXT,
  component_stack TEXT,
  url TEXT,
  referrer TEXT,
  user_agent TEXT,
  viewport_width INTEGER,
  viewport_height INTEGER,
  ip_address VARCHAR,
  session_id VARCHAR,
  email_sent BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_client_error_logs_created_at ON client_error_logs (created_at);
CREATE INDEX IF NOT EXISTS idx_client_error_logs_user_id ON client_error_logs (user_id);
