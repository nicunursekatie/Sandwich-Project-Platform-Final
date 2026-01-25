-- Migration: Fix kudos read status for old kudos
-- Problem: Old kudos don't have corresponding message_recipients entries,
-- so they can never be marked as read.
-- Solution: Create missing message_recipients entries for all kudos in kudos_tracking
-- that don't already have one.

-- First, let's see what we're working with (these are informational queries)
-- SELECT COUNT(*) as total_kudos FROM kudos_tracking;
-- SELECT COUNT(*) as kudos_with_recipients FROM kudos_tracking kt 
--   WHERE EXISTS (SELECT 1 FROM message_recipients mr WHERE mr.message_id = kt.message_id AND mr.recipient_id = kt.recipient_id);
-- SELECT COUNT(*) as kudos_without_recipients FROM kudos_tracking kt 
--   WHERE NOT EXISTS (SELECT 1 FROM message_recipients mr WHERE mr.message_id = kt.message_id AND mr.recipient_id = kt.recipient_id);

-- Insert missing message_recipients entries for kudos
-- This ensures every kudos can be marked as read
-- Note: Both 'read' and 'is_read' columns must be set for proper syncing
INSERT INTO message_recipients (
    message_id, 
    recipient_id, 
    read,           -- Legacy field
    is_read,        -- Canonical field (should be synced)
    notification_sent, 
    initially_notified,
    read_at, 
    created_at
)
SELECT 
    kt.message_id,
    kt.recipient_id,
    false,  -- read: Start as unread
    false,  -- is_read: Start as unread (both columns)
    true,   -- notification_sent: Mark as sent (these are old kudos, don't re-notify)
    true,   -- initially_notified: Already notified
    NULL,   -- read_at: No read_at timestamp yet
    COALESCE(kt.sent_at, NOW())  -- created_at: Use the kudos sent_at or NOW()
FROM kudos_tracking kt
WHERE kt.message_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 
    FROM message_recipients mr 
    WHERE mr.message_id = kt.message_id 
      AND mr.recipient_id = kt.recipient_id
  );

-- Log how many were inserted (for debugging - this won't show in migration but helps with manual runs)
-- SELECT 'Inserted message_recipients for kudos:' as status, COUNT(*) as count
-- FROM kudos_tracking kt
-- WHERE kt.message_id IS NOT NULL
--   AND EXISTS (
--     SELECT 1 
--     FROM message_recipients mr 
--     WHERE mr.message_id = kt.message_id 
--       AND mr.recipient_id = kt.recipient_id
--   );
