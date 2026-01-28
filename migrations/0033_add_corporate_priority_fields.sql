-- Add corporate priority tracking fields to event_requests table
-- These fields track corporate priority events that require immediate attention
-- and a strict follow-up protocol with daily reminders

-- Corporate priority flag and tracking
ALTER TABLE event_requests
ADD COLUMN IF NOT EXISTS is_corporate_priority BOOLEAN DEFAULT FALSE;

--> statement-breakpoint

ALTER TABLE event_requests
ADD COLUMN IF NOT EXISTS corporate_priority_marked_at TIMESTAMP;

--> statement-breakpoint

ALTER TABLE event_requests
ADD COLUMN IF NOT EXISTS corporate_priority_marked_by VARCHAR(255);

--> statement-breakpoint

-- Core team member requirement tracking
ALTER TABLE event_requests
ADD COLUMN IF NOT EXISTS requires_core_team_member BOOLEAN DEFAULT FALSE;

--> statement-breakpoint

ALTER TABLE event_requests
ADD COLUMN IF NOT EXISTS core_team_member_notes TEXT;

--> statement-breakpoint

-- Corporate follow-up protocol tracking (JSONB for structured protocol steps)
-- Structure:
-- {
--   status: 'not_started' | 'active' | 'completed' | 'stalled',
--   protocolStartedAt, protocolStartedBy,
--   initialCallMade, initialCallAt, initialCallBy, initialCallOutcome,
--   voicemailLeft, voicemailLeftAt,
--   toolkitEmailSent, toolkitEmailSentAt, toolkitEmailSentBy,
--   day2CallMade, day2CallAt, day2CallBy, day2CallOutcome,
--   day2TextSent, day2TextSentAt, day2TextSentBy,
--   lastReminderSentAt, reminderCount,
--   successfulContactAt, successfulContactBy, finalOutcome, finalOutcomeNotes
-- }
ALTER TABLE event_requests
ADD COLUMN IF NOT EXISTS corporate_follow_up_protocol JSONB DEFAULT '{"status": "not_started", "initialCallMade": false, "voicemailLeft": false, "toolkitEmailSent": false, "day2CallMade": false, "day2TextSent": false, "reminderCount": 0}';

--> statement-breakpoint

-- Add index for efficient querying of corporate priority events
CREATE INDEX IF NOT EXISTS idx_event_requests_corporate_priority
ON event_requests(is_corporate_priority)
WHERE is_corporate_priority = TRUE;
