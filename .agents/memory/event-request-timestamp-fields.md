---
name: Event-request timestamp conversion list
description: Client-sent timestamp fields on event requests must be in the shared string->Date conversion list or the whole save fails
---
Drizzle timestamp columns (default Date mode) throw `value.toISOString is not a function` (PgTimestamp.mapToDriverValue) when handed a raw string — and that kills the ENTIRE update, surfacing as "Primary storage WRITE operation failed after retries" in deploy logs.

**Rule:** any timestamp column on event_requests that the client can send must be in `EVENT_REQUEST_TIMESTAMP_FIELDS` (shared by PATCH + PUT handlers in the legacy event-requests routes).

**Why:** the two handlers used to each have their own hand-maintained list; they drifted, `standbyExpectedDate` was missing from both, and "move to standby" was 100% broken in prod (July 2026). Three sibling fields (`actualSandwichCountRecordedDate`, `followUpOneDayDate`, `followUpOneMonthDate`) had the same latent bug — the full-form save sends them on every submit.

**How to apply:** when debugging a failing event-request save with a toISOString TypeError, check the update's keys against the shared list; when adding a new timestamp column the form sends, add it to the constant. Server-side fix = prod needs a republish.
