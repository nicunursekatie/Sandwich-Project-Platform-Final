-- Migration: Add promotion_graphics table for social media graphics sharing
-- Created: 2025-10-29
-- Description: This table stores social media graphics that can be shared by team members

CREATE TABLE IF NOT EXISTS promotion_graphics (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  image_url TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_size INTEGER,
  file_type VARCHAR(100),
  intended_use_date TIMESTAMP,
  target_audience TEXT DEFAULT 'hosts',
  status VARCHAR(50) DEFAULT 'active',
  notification_sent BOOLEAN DEFAULT false,
  notification_sent_at TIMESTAMP,
  uploaded_by VARCHAR NOT NULL,
  uploaded_by_name TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_promotion_graphics_status ON promotion_graphics(status);
CREATE INDEX IF NOT EXISTS idx_promotion_graphics_target_audience ON promotion_graphics(target_audience);
CREATE INDEX IF NOT EXISTS idx_promotion_graphics_uploaded_by ON promotion_graphics(uploaded_by);
CREATE INDEX IF NOT EXISTS idx_promotion_graphics_intended_use_date ON promotion_graphics(intended_use_date);

-- Add comment to table
COMMENT ON TABLE promotion_graphics IS 'Stores social media graphics for team sharing and promotion';
COMMENT ON COLUMN promotion_graphics.title IS 'Title of the graphic';
COMMENT ON COLUMN promotion_graphics.description IS 'Description of what the graphic is for and how to use it';
COMMENT ON COLUMN promotion_graphics.image_url IS 'URL to the uploaded graphic in object storage';
COMMENT ON COLUMN promotion_graphics.intended_use_date IS 'When the graphic should be used (optional)';
COMMENT ON COLUMN promotion_graphics.target_audience IS 'Who should receive notifications (hosts, volunteers, all)';
COMMENT ON COLUMN promotion_graphics.status IS 'Status of the graphic (active, archived)';
COMMENT ON COLUMN promotion_graphics.notification_sent IS 'Whether email notifications have been sent';
