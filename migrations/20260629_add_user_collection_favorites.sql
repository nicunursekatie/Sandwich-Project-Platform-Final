-- Per-user "notable" bookmark on a sandwich collection log entry.
-- Powers the star icon next to each collection card. Distinct from
-- the kudos icon, which sends recognition to the submitter; this is
-- a personal bookmark that the user controls.
--
-- Run on BOTH dev (Neon dev branch) and production (Neon production branch).

CREATE TABLE IF NOT EXISTS user_collection_favorites (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  collection_id INTEGER NOT NULL REFERENCES sandwich_collections(id) ON DELETE CASCADE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT unique_user_collection_favorite UNIQUE (user_id, collection_id)
);

CREATE INDEX IF NOT EXISTS idx_user_collection_favorites_user
  ON user_collection_favorites (user_id);

CREATE INDEX IF NOT EXISTS idx_user_collection_favorites_collection
  ON user_collection_favorites (collection_id);
