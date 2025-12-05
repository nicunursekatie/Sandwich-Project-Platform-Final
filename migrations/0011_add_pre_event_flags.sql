-- Add pre-event flags field to event_requests table
-- This field stores critical, time-sensitive flags that need attention before the event

ALTER TABLE "event_requests"
  ADD COLUMN IF NOT EXISTS "pre_event_flags" jsonb DEFAULT '[]';

-- Add index for querying events with active flags
CREATE INDEX IF NOT EXISTS "idx_event_requests_pre_event_flags"
  ON "event_requests" USING gin ("pre_event_flags");

-- Pre-event flags structure:
-- [
--   {
--     id: string (uuid),
--     type: 'critical' | 'important' | 'attention',
--     message: string,
--     createdAt: timestamp,
--     createdBy: string (user id),
--     createdByName: string,
--     resolvedAt: timestamp | null,
--     resolvedBy: string | null,
--     resolvedByName: string | null,
--     dueDate: timestamp | null (when this needs to be handled by)
--   }
-- ]
