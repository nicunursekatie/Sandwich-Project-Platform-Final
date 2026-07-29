-- Defensive sweep: drop NOT NULL on every event_requests column that the
-- code (Drizzle schema + insertEventRequestSchema Zod) explicitly treats as
-- nullable + optional. This is a follow-up to the phone-specific migration
-- (20260622_make_event_requests_phone_nullable.sql) — same class of bug,
-- expanded to every column at risk.
--
-- Why: `drizzle-kit push` adds new columns + indexes but does NOT drop
-- NOT NULL constraints when a column is loosened in code. Any column that
-- was created with NOT NULL early in the project and later changed in code
-- to be nullable will still reject NULLs in the production database. Symptom
-- is "this field is required" errors with no client-side gate — exactly the
-- pattern we just diagnosed for phone.
--
-- Every ALTER below is idempotent: DROP NOT NULL on an already-nullable
-- column is a no-op. Safe to run repeatedly. Safe to run on dev branches
-- that already match the code.
--
-- Run against BOTH Neon branches: dev AND production.

------------------------------------------------------------
-- Primary contact (already partially covered, repeated here so this file
-- is self-contained as the canonical defensive sweep)
------------------------------------------------------------
ALTER TABLE event_requests ALTER COLUMN first_name        DROP NOT NULL;
ALTER TABLE event_requests ALTER COLUMN last_name         DROP NOT NULL;
ALTER TABLE event_requests ALTER COLUMN email             DROP NOT NULL;
ALTER TABLE event_requests ALTER COLUMN phone             DROP NOT NULL;
ALTER TABLE event_requests ALTER COLUMN organization_name DROP NOT NULL;

------------------------------------------------------------
-- Manual entry tracking + event scheduling time fields
------------------------------------------------------------
ALTER TABLE event_requests ALTER COLUMN manual_entry_source DROP NOT NULL;
ALTER TABLE event_requests ALTER COLUMN event_start_time    DROP NOT NULL;
ALTER TABLE event_requests ALTER COLUMN event_end_time      DROP NOT NULL;
ALTER TABLE event_requests ALTER COLUMN pickup_time         DROP NOT NULL;
ALTER TABLE event_requests ALTER COLUMN pickup_date_time    DROP NOT NULL;

------------------------------------------------------------
-- TSP contacts (additional + custom)
------------------------------------------------------------
ALTER TABLE event_requests ALTER COLUMN custom_tsp_contact  DROP NOT NULL;
ALTER TABLE event_requests ALTER COLUMN additional_contact_1 DROP NOT NULL;
ALTER TABLE event_requests ALTER COLUMN additional_contact_2 DROP NOT NULL;

------------------------------------------------------------
-- Notes fields (everything text)
------------------------------------------------------------
ALTER TABLE event_requests ALTER COLUMN planning_notes     DROP NOT NULL;
ALTER TABLE event_requests ALTER COLUMN scheduling_notes   DROP NOT NULL;
ALTER TABLE event_requests ALTER COLUMN follow_up_notes    DROP NOT NULL;
ALTER TABLE event_requests ALTER COLUMN attendance_notes   DROP NOT NULL;
ALTER TABLE event_requests ALTER COLUMN postponement_notes DROP NOT NULL;

------------------------------------------------------------
-- Address + location
------------------------------------------------------------
ALTER TABLE event_requests ALTER COLUMN event_address              DROP NOT NULL;
ALTER TABLE event_requests ALTER COLUMN delivery_destination       DROP NOT NULL;
ALTER TABLE event_requests ALTER COLUMN overnight_holding_location DROP NOT NULL;
ALTER TABLE event_requests ALTER COLUMN overnight_pickup_time      DROP NOT NULL;

------------------------------------------------------------
-- Sandwich count + range fields
------------------------------------------------------------
ALTER TABLE event_requests ALTER COLUMN estimated_sandwich_count       DROP NOT NULL;
ALTER TABLE event_requests ALTER COLUMN estimated_sandwich_count_min   DROP NOT NULL;
ALTER TABLE event_requests ALTER COLUMN estimated_sandwich_count_max   DROP NOT NULL;
ALTER TABLE event_requests ALTER COLUMN estimated_sandwich_range_type  DROP NOT NULL;

------------------------------------------------------------
-- Attendance breakdown (all nullable per Zod)
------------------------------------------------------------
ALTER TABLE event_requests ALTER COLUMN actual_attendance     DROP NOT NULL;
ALTER TABLE event_requests ALTER COLUMN estimated_attendance  DROP NOT NULL;
ALTER TABLE event_requests ALTER COLUMN attendance_adults     DROP NOT NULL;
ALTER TABLE event_requests ALTER COLUMN attendance_teens      DROP NOT NULL;
ALTER TABLE event_requests ALTER COLUMN attendance_kids       DROP NOT NULL;

------------------------------------------------------------
-- Driver / speaker / volunteer assignment helper booleans + JSONB
------------------------------------------------------------
ALTER TABLE event_requests ALTER COLUMN drivers_arranged    DROP NOT NULL;
ALTER TABLE event_requests ALTER COLUMN self_transport      DROP NOT NULL;
ALTER TABLE event_requests ALTER COLUMN driver_details      DROP NOT NULL;
ALTER TABLE event_requests ALTER COLUMN speaker_details     DROP NOT NULL;
ALTER TABLE event_requests ALTER COLUMN volunteer_details   DROP NOT NULL;

------------------------------------------------------------
-- Follow-up tracking (1-day + 1-month)
------------------------------------------------------------
ALTER TABLE event_requests ALTER COLUMN follow_up_one_day_completed   DROP NOT NULL;
ALTER TABLE event_requests ALTER COLUMN follow_up_one_month_completed DROP NOT NULL;
ALTER TABLE event_requests ALTER COLUMN follow_up_one_day_date        DROP NOT NULL;
ALTER TABLE event_requests ALTER COLUMN follow_up_one_month_date      DROP NOT NULL;
ALTER TABLE event_requests ALTER COLUMN next_follow_up_date           DROP NOT NULL;
ALTER TABLE event_requests ALTER COLUMN scheduled_call_date           DROP NOT NULL;

------------------------------------------------------------
-- Postponement tracking
------------------------------------------------------------
ALTER TABLE event_requests ALTER COLUMN postponement_reason DROP NOT NULL;
ALTER TABLE event_requests ALTER COLUMN tentative_new_date  DROP NOT NULL;

------------------------------------------------------------
-- TSP-shopped event tracking
------------------------------------------------------------
ALTER TABLE event_requests ALTER COLUMN is_tsp_shopped              DROP NOT NULL;
ALTER TABLE event_requests ALTER COLUMN tsp_shop_fee_agreed         DROP NOT NULL;
ALTER TABLE event_requests ALTER COLUMN tsp_shop_estimate_provided  DROP NOT NULL;
ALTER TABLE event_requests ALTER COLUMN tsp_shop_estimate_amount    DROP NOT NULL;
ALTER TABLE event_requests ALTER COLUMN tsp_shop_paid               DROP NOT NULL;
ALTER TABLE event_requests ALTER COLUMN tsp_shop_amount_paid        DROP NOT NULL;
ALTER TABLE event_requests ALTER COLUMN tsp_shop_plan_ready         DROP NOT NULL;
ALTER TABLE event_requests ALTER COLUMN tsp_shopping_plan           DROP NOT NULL;

------------------------------------------------------------
-- Toolkit
------------------------------------------------------------
ALTER TABLE event_requests ALTER COLUMN toolkit_sent_date DROP NOT NULL;
