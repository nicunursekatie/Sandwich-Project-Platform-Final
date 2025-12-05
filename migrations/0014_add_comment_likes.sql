-- Add comment likes table for event collaboration comments
-- This table allows users to like/react to comments on event requests

CREATE TABLE IF NOT EXISTS "event_collaboration_comment_likes" (
  "id" SERIAL PRIMARY KEY,
  "comment_id" INTEGER NOT NULL REFERENCES "event_collaboration_comments"("id") ON DELETE CASCADE,
  "user_id" VARCHAR NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "created_at" TIMESTAMP DEFAULT NOW() NOT NULL,
  UNIQUE("comment_id", "user_id")
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS "idx_comment_likes_comment_id" ON "event_collaboration_comment_likes"("comment_id");
CREATE INDEX IF NOT EXISTS "idx_comment_likes_user_id" ON "event_collaboration_comment_likes"("user_id");

-- Add comment for documentation
COMMENT ON TABLE "event_collaboration_comment_likes" IS 'Tracks user likes/reactions on event collaboration comments';
COMMENT ON COLUMN "event_collaboration_comment_likes"."comment_id" IS 'The comment being liked';
COMMENT ON COLUMN "event_collaboration_comment_likes"."user_id" IS 'The user who liked the comment';
