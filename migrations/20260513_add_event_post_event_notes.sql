-- Post-event notes — retrospective notes attached to completed events.
-- Distinct from event_collaboration_comments (intake collaboration with replies/likes).
CREATE TABLE IF NOT EXISTS event_post_event_notes (
  id           SERIAL PRIMARY KEY,
  event_request_id INTEGER NOT NULL REFERENCES event_requests(id) ON DELETE CASCADE,
  user_id      VARCHAR NOT NULL REFERENCES users(id),
  user_name    VARCHAR NOT NULL,
  content      TEXT    NOT NULL,
  edited_at    TIMESTAMP,
  created_at   TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_post_event_notes_event_id   ON event_post_event_notes(event_request_id);
CREATE INDEX IF NOT EXISTS idx_post_event_notes_user_id    ON event_post_event_notes(user_id);
CREATE INDEX IF NOT EXISTS idx_post_event_notes_created_at ON event_post_event_notes(created_at);
