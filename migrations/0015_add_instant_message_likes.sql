-- Add likes/reactions support for instant messages

CREATE TABLE IF NOT EXISTS "instant_message_likes" (
  "id" serial PRIMARY KEY NOT NULL,
  "message_id" integer NOT NULL,
  "user_id" varchar NOT NULL,
  "user_name" varchar NOT NULL,
  "emoji" varchar NOT NULL DEFAULT '❤️',
  "created_at" timestamp DEFAULT now()
);

-- Create indexes for efficient queries
CREATE INDEX IF NOT EXISTS "idx_instant_message_likes_message"
ON "instant_message_likes"("message_id");

CREATE INDEX IF NOT EXISTS "idx_instant_message_likes_user"
ON "instant_message_likes"("user_id");

-- Unique constraint: one reaction per user per message per emoji type
CREATE UNIQUE INDEX IF NOT EXISTS "idx_instant_message_likes_unique"
ON "instant_message_likes"("message_id", "user_id", "emoji");
