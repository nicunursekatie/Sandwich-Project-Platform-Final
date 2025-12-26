-- Make migration idempotent by checking if column already exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'messages' AND column_name = 'attachments'
  ) THEN
    ALTER TABLE "messages" ADD COLUMN "attachments" text;
  END IF;
END $$;
