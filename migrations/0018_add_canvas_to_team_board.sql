-- Add canvas support to team board items (holding zone)
ALTER TABLE team_board_items
  ADD COLUMN IF NOT EXISTS is_canvas BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS canvas_sections JSONB,
  ADD COLUMN IF NOT EXISTS canvas_status VARCHAR DEFAULT 'draft',
  ADD COLUMN IF NOT EXISTS canvas_published_snapshot JSONB,
  ADD COLUMN IF NOT EXISTS canvas_published_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS canvas_published_by VARCHAR;
