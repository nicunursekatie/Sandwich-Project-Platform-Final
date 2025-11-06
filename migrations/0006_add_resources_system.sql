-- Migration: Add resources system for unified document and link management
-- Created: 2025-10-30
-- Description: Creates tables for resources, favorites, tags, and tag assignments

-- Main resources table - unified storage for files and links
CREATE TABLE IF NOT EXISTS resources (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  type TEXT NOT NULL, -- 'file', 'link', 'google_drive'
  category TEXT NOT NULL, -- 'legal_governance', 'brand_marketing', 'operations_safety', 'forms_templates', 'training', 'master_documents'

  -- For files - references documents table
  document_id INTEGER REFERENCES documents(id) ON DELETE CASCADE,

  -- For external links
  url TEXT,

  -- Display and organization
  icon TEXT, -- Icon name for display
  icon_color TEXT, -- Color for icon
  is_pinned_global BOOLEAN NOT NULL DEFAULT false, -- Admin global pin
  pinned_order INTEGER, -- Order for pinned items (lower = higher priority)

  -- Usage tracking
  access_count INTEGER NOT NULL DEFAULT 0,
  last_accessed_at TIMESTAMP,

  -- Metadata
  created_by VARCHAR NOT NULL,
  created_by_name TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  is_active BOOLEAN NOT NULL DEFAULT true
);

-- User's personal favorite resources
CREATE TABLE IF NOT EXISTS user_resource_favorites (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  resource_id INTEGER NOT NULL REFERENCES resources(id) ON DELETE CASCADE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT unique_user_resource_favorite UNIQUE (user_id, resource_id)
);

-- Tag definitions for categorizing resources
CREATE TABLE IF NOT EXISTS resource_tags (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  color TEXT, -- Hex color for display
  description TEXT,
  created_by VARCHAR NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Many-to-many relationship between resources and tags
CREATE TABLE IF NOT EXISTS resource_tag_assignments (
  id SERIAL PRIMARY KEY,
  resource_id INTEGER NOT NULL REFERENCES resources(id) ON DELETE CASCADE,
  tag_id INTEGER NOT NULL REFERENCES resource_tags(id) ON DELETE CASCADE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT unique_resource_tag_assignment UNIQUE (resource_id, tag_id)
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_resources_category ON resources(category);
CREATE INDEX IF NOT EXISTS idx_resources_type ON resources(type);
CREATE INDEX IF NOT EXISTS idx_resources_pinned ON resources(is_pinned_global, pinned_order);
CREATE INDEX IF NOT EXISTS idx_resources_access_count ON resources(access_count);
CREATE INDEX IF NOT EXISTS idx_resources_active ON resources(is_active);

CREATE INDEX IF NOT EXISTS idx_user_resource_favorites_user ON user_resource_favorites(user_id);
CREATE INDEX IF NOT EXISTS idx_user_resource_favorites_resource ON user_resource_favorites(resource_id);

CREATE INDEX IF NOT EXISTS idx_resource_tags_name ON resource_tags(name);

CREATE INDEX IF NOT EXISTS idx_resource_tag_assignments_resource ON resource_tag_assignments(resource_id);
CREATE INDEX IF NOT EXISTS idx_resource_tag_assignments_tag ON resource_tag_assignments(tag_id);

-- Add comments to tables
COMMENT ON TABLE resources IS 'Unified storage for both uploaded files and external links with smart discovery features';
COMMENT ON TABLE user_resource_favorites IS 'User personal favorites for quick access to frequently used resources';
COMMENT ON TABLE resource_tags IS 'Tag definitions for cross-referencing and categorizing resources';
COMMENT ON TABLE resource_tag_assignments IS 'Many-to-many relationship between resources and tags';

-- Add comments to key columns
COMMENT ON COLUMN resources.type IS 'Type of resource: file (uploaded document), link (external URL), google_drive (Google Drive link)';
COMMENT ON COLUMN resources.category IS 'Primary category for organization: legal_governance, brand_marketing, operations_safety, forms_templates, training, master_documents';
COMMENT ON COLUMN resources.is_pinned_global IS 'Admin-set global pin that appears at top for all users';
COMMENT ON COLUMN resources.pinned_order IS 'Display order for pinned items (lower numbers appear first)';
COMMENT ON COLUMN resources.access_count IS 'Number of times this resource has been accessed (for usage tracking)';
COMMENT ON COLUMN resources.last_accessed_at IS 'Timestamp of last access (for recently accessed tracking)';
