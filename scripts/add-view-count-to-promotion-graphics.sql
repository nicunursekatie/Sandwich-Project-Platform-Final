-- Add view count tracking to promotion graphics
ALTER TABLE promotion_graphics
ADD COLUMN IF NOT EXISTS view_count INTEGER DEFAULT 0;
