-- Migration: Add impact_reports table
-- Created: 2025-11-14
-- Purpose: Support AI-generated impact reports feature

CREATE TABLE IF NOT EXISTS impact_reports (
  id SERIAL PRIMARY KEY,
  report_type VARCHAR(50) NOT NULL,
  report_period VARCHAR(50) NOT NULL,
  start_date TIMESTAMP NOT NULL,
  end_date TIMESTAMP NOT NULL,

  -- Report content
  title TEXT NOT NULL,
  executive_summary TEXT NOT NULL,
  content TEXT NOT NULL,

  -- Key metrics
  metrics JSONB,
  highlights JSONB,
  trends JSONB,

  -- Generation metadata
  generated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  generated_by VARCHAR(255),
  ai_model VARCHAR(100),
  generation_prompt TEXT,
  regeneration_count INTEGER DEFAULT 0,

  -- Publishing
  status VARCHAR(50) NOT NULL DEFAULT 'draft',
  published_at TIMESTAMP,
  published_by VARCHAR(255),

  -- Export
  pdf_url TEXT,
  pdf_generated_at TIMESTAMP,

  -- Metadata
  tags TEXT[],
  notes TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_impact_reports_period ON impact_reports(report_period);
CREATE INDEX IF NOT EXISTS idx_impact_reports_type ON impact_reports(report_type);
CREATE INDEX IF NOT EXISTS idx_impact_reports_status ON impact_reports(status);
CREATE INDEX IF NOT EXISTS idx_impact_reports_start_date ON impact_reports(start_date);

-- Create unique constraint to prevent duplicate reports for same period/type
CREATE UNIQUE INDEX IF NOT EXISTS unique_report_period_type
ON impact_reports(report_period, report_type);

-- Add comments
COMMENT ON TABLE impact_reports IS 'AI-generated impact reports for stakeholder communication';
COMMENT ON COLUMN impact_reports.metrics IS 'Key metrics: {eventsCompleted, sandwichesDistributed, peopleServed, etc.}';
COMMENT ON COLUMN impact_reports.highlights IS 'Array of highlight objects with title and description';
COMMENT ON COLUMN impact_reports.trends IS 'Array of trend objects identified by AI';
