CREATE TABLE IF NOT EXISTS app_settings (
  key VARCHAR(100) PRIMARY KEY,
  value TEXT NOT NULL,
  description TEXT,
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_by VARCHAR
);
--> statement-breakpoint
INSERT INTO app_settings (key, value, description)
VALUES ('annual_sandwich_goal', '500000', 'Annual sandwich production target for the organization')
ON CONFLICT (key) DO NOTHING;
