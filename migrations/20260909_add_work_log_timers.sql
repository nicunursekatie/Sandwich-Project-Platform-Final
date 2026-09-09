-- Backing table for the "Start Work / Stop Work" stopwatch on the Work Log page,
-- served by GET/POST/DELETE /api/work-logs/timer. Matches the workLogTimers
-- definition in shared/schema.ts. A row exists only while a timer is running;
-- stopping the timer writes a work_logs row and deletes the row here.
-- Idempotent: safe to run against both the dev and production branches.

CREATE TABLE IF NOT EXISTS work_log_timers (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR NOT NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  description TEXT
);

-- At most one running timer per user.
CREATE UNIQUE INDEX IF NOT EXISTS work_log_timers_user_unique
  ON work_log_timers (user_id);
