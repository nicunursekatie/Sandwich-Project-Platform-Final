# Event Requests Reliability Plan (v2)

> Supersedes `EVENT_REQUESTS_RELIABILITY_PLAN.md` (kept for history).
> Last updated: 2026-06-18 (scratchpad removal recorded §1.6)
> Author: Katie + Claude, after end-to-end codebase walkthrough.
>
> **Companion docs** (still authoritative for their narrow topic):
> - `docs/event-requests-behavior-contract.md` — what current behavior must be preserved during refactors
> - `docs/canonical-field-contracts.md` — lightweight-list vs full-record field contract
> - `docs/event-request-api-audit.md` — query inventory (30+ API calls on page load)
> - `docs/event-requests-lazy-loading-plan.md` — DB-level status filtering proposal
> - `docs/development/EVENT_REQUESTS_PERFORMANCE_PLAN.md` — payload-size work (mostly done)

---

## 0. Premise

The event-request feature breaks more than it should. It is **not** because event intake is hard — the domain is small: "Sheets import → human enriches → status moves." It breaks because the implementation is a **distributed system disguised as a form**: many writers, many cache layers, many edit paths, all touching the same record through pipelines that grew defensive over time without ever fixing the original symptoms.

This document records:
1. What we verified in the code (root causes, not symptoms)
2. What strategy we picked and why
3. Concrete phased work, ordered by safety and payoff

Everything below has been verified against the actual files in this repo. Specific file paths and line numbers are cited so future-Katie (or any agent picking this up) can confirm without re-deriving.

---

## 1. Verified diagnosis

The full investigation lives in chat history; the verified facts:

### 1.1 Scale

| Measurement | Verified value |
|---|---|
| Files under `client/src/components/event-requests/` | 96 |
| `server/routes/event-requests-legacy.ts` | 5,166 lines |
| `client/src/components/event-requests/index.tsx` | 1,826 lines (223 substring matches for `ialog`) |
| `EventSchedulingForm.tsx` | 1,524 lines |
| `ScheduledCardEnhanced.tsx` | 4,849 lines |
| `CompletedCard.tsx` | 3,252 lines |
| `NewRequestCard.tsx` | 1,490 lines |
| Distinct `PATCH`/`PUT` endpoints under `/api/event-requests` | 18 |
| Client files using `useMutation` in event-requests | 21 |
| Client files issuing `PATCH` to event-requests | 14 |

### 1.2 Engine-room bugs (root causes)

These are the bugs that produce most of the "it ate my edit / it told me there was a conflict / it saved but the field is wrong" complaints. **A UI rebuild alone will not fix them.**

1. **Sledgehammer cache invalidation.**
   `invalidateEventRequestQueries` ([client/src/lib/queryClient.ts:187-217](client/src/lib/queryClient.ts)) invalidates AND force-refetches every query whose key starts with `/api/event-requests` or `/api/volunteer-hub`, plus `/api/event-map`. It runs on every save and every socket event.

2. **Socket invalidation on every PATCH** *(own-echo partially fixed — see §1.5)*.
   Server middleware at [server/routes/event-requests/index.ts:57-74](server/routes/event-requests/index.ts) wraps `res.json` to emit `event_request_updated` on any 2xx PATCH/PUT across all sub-routers. Client at [useEventRequestSocket.ts](client/src/hooks/useEventRequestSocket.ts) handles those events by calling the sledgehammer. **Still true for other users/tabs/background processes.** Before PR #416, your own save also triggered a second full refetch (save → socket echo → invalidate again).

3. **Optimistic updates target dead cache keys.**
   List query reads from `['/api/event-requests/list', filterParams, quickFilter, 'v3']` ([eventRequestsListQuery.ts:102](client/src/components/event-requests/lib/eventRequestsListQuery.ts)). Optimistic patches in `useEventMutations` set `['/api/event-requests']` and `['/api/event-requests', 'v2']` ([useEventMutations.tsx:368-369](client/src/components/event-requests/hooks/useEventMutations.tsx)). **The keys never overlap.** The optimistic-update layer is effectively dead code; `onSettled` then runs the sledgehammer anyway. **History:** added Dec 2025 for inline scheduled edits; list migrated to `/list` … `v3` keys afterward — optimistic path was never rewired (classic AI-accretion half-fix).

4. **Row-level `_expectedVersion` check is over-triggered → spurious 409s.**
   PATCH at [event-requests-legacy.ts:2646-2660](server/routes/event-requests-legacy.ts) returns 409 when client `_expectedVersion` ≠ server `updatedAt`. The check is **row-level**: any `updatedAt` bump blocks the **entire** save, even when edits touch different fields. Codebase already bypasses this for additive updates via `_skipVersionCheck` ([useEventMutations.tsx:83-88](client/src/components/event-requests/hooks/useEventMutations.tsx), [index.tsx:1029](client/src/components/event-requests/index.tsx)) — evidence the team knew the check is too aggressive. **Do not remove locking outright** (real co-edit → silent overwrite); fix the triggers below.

   **Verified 409 trigger ranking** (solo intake, most → least common):

   | Trigger | Mechanism |
   |---|---|
   | 1. Two quick saves / two tabs | First save bumps `updatedAt`; second PATCH still sends stale `_expectedVersion` |
   | 2. Mutation invalidates while form open | Full refetch can desync version refs (less common now that own-echo is suppressed) |
   | 3. Sheets message backfill (rare) | Sync updates **existing** rows only when DB `message` is empty and sheet has content — sets `updatedAt` ([google-sheets-event-requests-sync.ts:573-578, 685-692](server/google-sheets-event-requests-sync.ts)). **Not** "sync rewrites all events every 30 min." |
   | 4. Real two-human same-field edit | Legitimate 409 — keep this signal |

   ~~Scratchpad + form~~ — **removed 2026-06-18** (production audit: 0 message-only PATCHs in 90 days).

   **Lighter fixes (B4):** don't bump `updatedAt` on backfill-only sync writes; keep `_expectedVersion` on intentional human saves (form submit, status change).

5. **Partial/full payload split with a hand-maintained contract.**
   Cards read from `/api/event-requests/list` (lightweight, ~30 fields). Edit form refetches via `/api/event-requests/:id` (full record) — see [EventSchedulingForm.tsx:274-288](client/src/components/event-requests/EventSchedulingForm.tsx). The contract is documented as comments at [event-requests-legacy.ts:1248-1268](server/routes/event-requests-legacy.ts). Past bugs (e.g., `vanDriverNeeded` not persisting) trace to this split — when a field is missing from the lightweight contract, cards show wrong data; when baseline comparison goes wrong, saves drop fields silently.

6. **Two edit paths.**
   `EventSchedulingForm` is the primary edit dialog. `EventEditDialog` is a parallel edit path used by driver planning ([driver-planning.tsx:51, :7371](client/src/pages/driver-planning.tsx)). Different PATCH payloads, different cache handling, different error UX.

7. **Silent field drops (`_droppedFields`).**
   Server's PATCH at [event-requests-legacy.ts:3113-3117](server/routes/event-requests-legacy.ts) attaches `_droppedFields` metadata describing fields that were silently rejected. Client has `event-save-verification.ts` to detect this. "Save succeeded" and "everything you typed was persisted" are not the same thing.

8. **Strangler refactor is half-done.**
   Sub-routers exist (`volunteers.ts`, `flags.ts`, `ai.ts`, `sms.ts`, `organizations.ts`, `sync.ts`, `audit.ts`, `conflicts.ts`, `lifecycle.ts`) but the main CRUD pipeline is still inside the 5,166-line legacy file. The easy stuff got extracted; the hard stuff didn't.

9. **God-context with an incomplete split.**
   `EventRequestContext` owns ~50 state fields and spreads in `EventDialogContext` via `...rest` ([EventRequestContext.tsx:664-668](client/src/components/event-requests/context/EventRequestContext.tsx)). The comment in the code apologizes for this. Opening any dialog re-renders the whole tree.

10. **Eight status-change paths, one entity.**
    Status moves through separate code with different PATCH shapes — not one function. Verified paths include: `handleStatusChange` in [useEventAssignments.tsx](client/src/components/event-requests/hooks/useEventAssignments.tsx) (most tab buttons), `EventSchedulingForm` save via `detectChangedFields`, [QuickScheduleButton.tsx](client/src/components/event-requests/QuickScheduleButton.tsx) (comment: *"Emergency workaround… Bypasses the full form submission flow"*), [RescheduleDialog](client/src/components/event-requests/dialogs/RescheduleDialog.tsx), [NonEventDialog](client/src/components/event-requests/dialogs/NonEventDialog.tsx), [StatusReasonDialog](client/src/components/event-requests/dialogs/StatusReasonDialog.tsx), [DuplicateEventDialog](client/src/components/event-requests/dialogs/DuplicateEventDialog.tsx), [IntakeCallDialog](client/src/components/event-requests/IntakeCallDialog.tsx), inline paths in [index.tsx](client/src/components/event-requests/index.tsx). "Status won't move" and "didn't save" overlap here — different buttons, different failure modes.

11. **Stale list cache → false "invalid status change."**
    `handleStatusChange` reads `request.status` from the **list cache** ([useEventAssignments.tsx:632-640](client/src/components/event-requests/hooks/useEventAssignments.tsx)) and validates client-side before PATCH. Server validates `originalEvent.status → requested status` from DB. If UI is stale (DB moved to B, UI still shows A), user can get blocked with a transition error they didn't cause. Calmer cache + fresh status before status PATCH addresses this; consolidating status paths is the long-term fix.

12. **Mutation success still runs the sledgehammer.**
    PR #416 removed the **double** refetch (own socket echo). Every save path that calls `invalidateEventRequestQueries` in `onSuccess`/`onSettled` still force-refetches all event + volunteer-hub queries once. That remains the main "it ate my edit" trigger while a form is open.

### 1.3 How user complaints map (don't need a top-10 list)

Staff say **"didn't save"** or **"status won't move"** — these are **cluster labels**, not single bugs:

| What they experienced | Likely cluster |
|---|---|
| Text disappeared while typing | Refetch mid-edit (§1.2 #1, #12; own-echo fixed §1.5) |
| "Someone else edited this" (409) | Stale `_expectedVersion` (§1.2 #4 — two-tab/double-save, rare Sheets backfill, or real co-edit) |
| "Saved" but field wrong on card | Partial PATCH / `_droppedFields` (§1.2 #5, #7) or timing before refetch completes |
| Status button did nothing / wrong error | Eight paths (§1.2 #10) or stale status (§1.2 #11) |
| Mark Scheduled only works via QuickSchedule | Normal form path unreliable; workaround button is a confession in code |

**One triage question for live reports:** *"Were you in the big form, a card button, or Quick Schedule?"* — routes to the right cluster.

### 1.4 Verified non-triggers (common misdiagnoses)

These are **not** causing event-management wipes in the current code:

- **No 60-second polling** on event lists or the scheduling form (`refetchInterval: false` globally; [EventRequestContext.tsx:330](client/src/components/event-requests/context/EventRequestContext.tsx) sets `refetchOnWindowFocus: false`).
- **Not every background refresh re-initializes the form** — `EventSchedulingForm` guards re-init with `formInitSessionRef` / `${eventId}-partial|full` ([EventSchedulingForm.tsx:541-548](client/src/components/event-requests/EventSchedulingForm.tsx)) plus partial→full merge logic. Wipes still happen from refetch/version races, but not from a timer.
- **Sheets sync is not continuously rewriting in-progress events** — insert-only except empty-message backfill (§1.2 #4).

### 1.5 Already shipped (2026-06-18, PR #416)

Do not rebuild these:

| Change | Commits | What it fixed |
|---|---|---|
| Ignore own socket echo | `b20a1e220` | `X-Socket-Id` on [apiRequest](client/src/lib/queryClient.ts); server echoes `originSocketId`; [useEventRequestSocket.ts](client/src/hooks/useEventRequestSocket.ts) skips matching id. Removes redundant refetch on your own save. Fails safe if socket not connected. |
| Scratchpad list sync without refetch storm | `13f049395` | Surgical list-cache patch in scratchpad (component since removed). Pattern to reimplement in `queryClient.ts` for B1. |
| Intake paths no longer rely on echo | same PR | [IntakeCallDialog.tsx](client/src/components/event-requests/IntakeCallDialog.tsx) calls `invalidateEventRequestQueries` after save-notes / move-to-non-event. |

**Still open after PR #416:** mutation `onSuccess` sledgehammer (§1.2 #12), dead optimistic keys (§1.2 #3), spurious 409 triggers from Sheets backfill (§1.2 #4), eight status paths (§1.2 #10).

### 1.6 Removed (2026-06-18) — Call Notes Scratchpad

**Decision:** Delete (not hide). Production audit showed zero usage; staff write call notes via `IntakeCallDialog` → `planningNotes` and the main form → `schedulingNotes`. The scratchpad was a second writer on the same `message` column with 5s autosave + `_expectedVersion` — former #1 solo-editor 409 trigger — plus ~400 lines of merge/sync guards in the form.

#### Production audit (Neon SQL, 2026-06-18)

Run against production branch before removal:

| Query | Result | Interpretation |
|---|---|---|
| Message-only PATCHs (90 days) | `message_only_patch_count: 0`, `distinct_events_touched: 0` | No PATCH changed **only** `message` — scratchpad autosave never ran successfully |
| Rapid message-only bursts (≤15s apart) | `rapid_message_only_bursts: 0`, `events_with_bursts: 0` | No scratchpad autosave fingerprint |
| Notes field usage (6 months, active statuses) | See table below | Staff use `planningNotes` / `schedulingNotes`; `message` is mostly Sheets import text |

**Notes field population (last 6 months):**

| status | total | has `planning_notes` | has `scheduling_notes` | has `message` |
|---|---:|---:|---:|---:|
| new | 9 | 0 | 1 | 6 |
| in_process | 24 | 3 | 5 | 14 |
| scheduled | 25 | 8 | 12 | 13 |
| completed | 189 | 62 | 64 | 111 |

*`message` counts include organizer text from Sheets import at create time — not scratchpad call notes.*

Audit SQL (re-run in Neon production SQL editor before similar deletions):

```sql
-- Message-only PATCHs (90 days)
WITH message_only_updates AS (
  SELECT al.record_id, al.user_id, al.timestamp
  FROM audit_logs al
  WHERE al.table_name = 'event_requests'
    AND al.action = 'UPDATE'
    AND al.timestamp >= NOW() - INTERVAL '90 days'
    AND (al.new_data::jsonb -> '_auditMetadata' ->> 'totalChanges')::int = 1
    AND EXISTS (
      SELECT 1 FROM jsonb_array_elements(al.new_data::jsonb -> '_auditMetadata' -> 'changes') e
      WHERE e ->> 'field' = 'message'
    )
)
SELECT COUNT(*) AS message_only_patch_count, COUNT(DISTINCT record_id) AS distinct_events_touched
FROM message_only_updates;

-- Rapid bursts (scratchpad autosave fingerprint)
WITH message_only_updates AS (
  SELECT al.record_id, al.user_id, al.timestamp
  FROM audit_logs al
  WHERE al.table_name = 'event_requests' AND al.action = 'UPDATE'
    AND al.timestamp >= NOW() - INTERVAL '90 days'
    AND (al.new_data::jsonb -> '_auditMetadata' ->> 'totalChanges')::int = 1
    AND EXISTS (
      SELECT 1 FROM jsonb_array_elements(al.new_data::jsonb -> '_auditMetadata' -> 'changes') e
      WHERE e ->> 'field' = 'message'
    )
), pairs AS (
  SELECT *, LAG(timestamp) OVER (PARTITION BY record_id, user_id ORDER BY timestamp) AS prev_ts
  FROM message_only_updates
)
SELECT COUNT(*) AS rapid_message_only_bursts, COUNT(DISTINCT record_id) AS events_with_bursts
FROM pairs WHERE prev_ts IS NOT NULL AND timestamp - prev_ts <= INTERVAL '15 seconds';

-- Notes field usage (6 months)
SELECT status, COUNT(*) AS total,
  COUNT(*) FILTER (WHERE NULLIF(TRIM(planning_notes), '') IS NOT NULL) AS has_planning_notes,
  COUNT(*) FILTER (WHERE NULLIF(TRIM(scheduling_notes), '') IS NOT NULL) AS has_scheduling_notes,
  COUNT(*) FILTER (WHERE NULLIF(TRIM(message), '') IS NOT NULL) AS has_message
FROM event_requests
WHERE created_at >= NOW() - INTERVAL '6 months'
  AND status IN ('new', 'in_process', 'scheduled', 'completed')
GROUP BY status ORDER BY status;
```

#### Code removed (~404 lines)

| File | Change |
|---|---|
| `client/src/components/event-requests/CallNotesScratchpadDialog.tsx` | **Deleted** (327 lines) — 5s PATCH loop, `_expectedVersion`, localStorage drafts, surgical list-cache patch |
| `client/src/components/event-requests/EventSchedulingForm.tsx` | Removed scratchpad button, context hook, scratchpad→form `message` sync `useEffect` |
| `client/src/components/event-requests/index.tsx` | Removed `<CallNotesScratchpadDialog />` render + imports |
| `client/src/components/event-requests/context/EventDialogContext.tsx` | Removed `showScratchpad`, `scratchpadEventRequest` state |
| `client/src/components/event-requests/context/EventRequestContext.tsx` | Removed matching type definitions |

#### Defensive layers removed with the feature (no longer needed)

- Scratchpad→form message merge effect (prevented form save overwriting scratchpad notes)
- PR #416 surgical list-cache patch inside scratchpad (only existed because scratchpad autosaved every 5s)
- Context state for floating dialog (`showScratchpad`, `scratchpadEventRequest`)

#### Intentionally kept (not scratchpad-specific)

- `message` field in `NotesSection` (“Initial Request Message” from organizer)
- `planningNotes` / `schedulingNotes` in form + `IntakeCallDialog`
- `_expectedVersion` on form save (`callNotesExpectedVersionRef` — misnamed; applies to all form fields)
- Own socket echo suppression (PR #416)
- `event-save-verification.ts` / `_droppedFields` handling

#### Smoke test after deploy

1. Open event → **Notes & Requirements** — initial message, scheduling notes, planning notes still editable
2. Intake call dialog — saves notes to `planningNotes`
3. Save big form — no spurious 409
4. No “Open Call Notes Scratchpad” button

#### Plan impact

- **List 3:** scratchpad marked ✅ removed (skipped 60-day hide — audit proved zero usage)
- **§1.2 #4:** scratchpad removed from 409 trigger ranking
- **B4:** dominant solo-editor 409 source eliminated; remaining triggers are two-tab/double-save, Sheets backfill, real co-edit
- **B1:** surgical cache helper to be written fresh in `queryClient.ts` (scratchpad implementation deleted with component)

**Status:** Code change complete locally; pending commit/deploy.

### 1.7 UI-room problems (visible chaos)

These produce the daily annoyances that aren't engine bugs — they're visible chaos.

- **40+ boolean dialog flags** in `EventRequestContext`. A `useState<DialogState>` enum would replace them. (Carried over from v1 plan.)
- **3,252-line `CompletedCard.tsx`** and **4,849-line `ScheduledCardEnhanced.tsx`** — both rendered everything top-to-bottom until recent two-column refactors. Still oversized.
- **5,166-line `event-requests-legacy.ts`** server file owns the core PATCH pipeline.
- **20+ `useMutation` callsites** with different PATCH payload shapes (per-card mutations, per-dialog mutations, plus the centralized `useEventMutations`).
- **Form initialization race** — `formInitialized` flag with DEBUG logging suggests recurring bug where form submits before data loads. (From v1 plan.)
- **Empty saves and form-not-initialized blocks** — defensive logic around two-phase load. (From v1 plan.)

### 1.8 Items inherited from v1 reliability plan

Cleaned and re-classified:

| v1 item | Status | Re-classified as |
|---|---|---|
| Unhandled promise in field lock cleanup | ✅ Done | Keep |
| Unhandled promise in van conflict check | ✅ Done | Keep |
| Granular error boundary for Event Requests | ✅ Done | Keep |
| Simplify dialog state management (40+ flags → enum) | Open | **Phase A** |
| Add React Error Boundaries (duplicate of #3) | ✅ Done | Drop — already covered |
| Fix form initialization race | Open | **Phase A** |
| Reduce query stale time 5 min → 2 min | Open | **Rejected** — runs counter to "calmer cache" direction |
| Status change reason dialogs (TODO at line 1617) | Open | **Phase B** |
| Add retry logic to mutations | Open | **Deferred** — adds defensive layer on a defensive stack; find root cause first |
| Replace DEBUG console.logs | Open | **Phase C** — opportunistic cleanup |
| Type safety improvements | Open | **Deferred** |
| Network timeout handling | Open | **Deferred** |
| React.memo / split EventSchedulingForm | Open | **Phase B** — partially natural outcome of dialog cleanup |

---

## 2. Strategy

### 2.1 Constraints

- Solo developer (Katie), AI-assisted, intermittent time.
- Working dev environment with separate Neon branch (`db-url.ts` enforces this).
- Production has live intake daily; cannot break it.
- No automated test suite covering this feature.

### 2.2 Principles

1. **Shrink the critical path. Stop adding layers.**
   The pattern that got us here: a bug appears → a defensive layer covers it → the original bug never gets fixed. Examples: invalidation → socket → optimistic lock → auto-save merge → save verification heuristics → `QuickScheduleButton` bypass. Phase A and B fixes are about *removing* layers (dead optimistic code, sledgehammer invalidation, redundant edit paths), not adding new ones.

2. **Phase mismatch, not wrong code.**
   Collaboration locks, AI assistants, optimistic locking, real-time sync, etc. are not bad engineering. They're patterns for problems Katie does not have at her current scale (~1 editor at a time, manual workflow, small team). Hide or freeze them; don't necessarily delete them.

3. **UI rebuild fixes visible chaos. Engine work fixes "it ate my edit."**
   Half the user-facing pain comes from engine-room bugs. The strategy is: do the UI cleanup in parallel (Phase A) because it's safe and visible, but commit to a Phase B for the engine work. Stopping after Phase A will leave the "it erased what I typed" complaints intact.

4. **Dev is the isolation layer.**
   No need for per-user feature flags before Phase A. Dev environment + smoke tests + a careful production deploy is enough. Add flags later only if a specific rollout case demands them.

5. **Verify race-condition fixes deliberately.**
   Single-user happy-path testing in dev cannot prove that concurrent-edit and background-sync races are fixed. For each engine fix, deliberately reproduce the race before declaring done (two browser windows, two users, simulate the sync write).

### 2.3 What we are NOT doing

- **Not** duplicating the entire 96-file event-requests folder into a "v2" sandbox. The renovation analogy is appealing but the engine room is shared — copying the UI alone fixes only half the bugs and doubles the maintenance surface.
- **Not** building feature flags before Phase A. Dev environment + careful prod deploy is enough.
- **Not** removing `_expectedVersion` optimistic locking. Fix the trigger (background sync bumping `updatedAt`) instead. Removing the safeguard would trade visible 409s for silent overwrites — that's worse.
- **Not** writing new defensive layers. If saves are unreliable, fix the save path, don't retry harder.

### 2.4 What we ARE doing (decision tree)

For every item in scope, the question is:

```
Does this item address an engine-room bug (cache, race, save pipeline)?
├── Yes → Phase B. Plan carefully, reproduce the failure first, smallest possible change.
└── No → Is it a visible chaos / quality-of-life UI issue?
         ├── Yes → Phase A. Behind dev-test, ship in small commits.
         └── No → Is it a feature that's overkill for current scale?
                  ├── Yes → Freeze (no new work) or Hide (turn off in UI).
                  └── No → Out of scope.
```

---

## 3. Four-list inventory

Concrete files and features, classified.

### List 1 — Visible & invested in (the core path)

These are the things Katie uses daily and must work reliably.

- The five status tabs and the cards inside them (New, In Process, Scheduled, Completed, plus side tracks)
- The main edit dialog (`EventSchedulingForm`)
- The status-change buttons on each card
- The intake call dialog and the new-request flow
- The Sheets import job
- The driver/speaker/volunteer assignment dialogs
- The toolkit-sent flow (now wired into the new-request card per recent work)

### List 2 — Visible but frozen (no new work)

These work today, don't add to them, don't extend them without reverting.

- The Map view of event locations (kept; mature; not part of any current bug)
- AI date suggestion + AI intake assistant (working; do not add more AI surfaces)
- The calendar view (kept; light usage)
- The spreadsheet view (kept; light usage)
- The Collaboration / presence indicators (kept; rarely two editors at once but harmless when one)
- The optimistic locking with `_expectedVersion` (kept — fix the trigger, not the safeguard)

### List 3 — Hidden (turn off in UI, leave code, observe)

If nobody complains in 60 days, that's a real signal to delete in Phase C.

- ~~**Call Notes Scratchpad**~~ — ✅ **Removed 2026-06-18** (see §1.6)
- `QuickScheduleButton` ("emergency workaround") — symptom of broken main path; remove the visible affordance, see if anyone notices
- Full socket-driven UI invalidation for **other users' edits** (optional experiment — **own-echo suppression is already shipped §1.5**; turning off all socket refresh risks stale volunteer hub / multi-tab awareness)
- Field-level collaboration locks on the form (rarely contended)
- Traffic-conflict badges (operational polish, not foundational)
- Corporate escalation SMS (separate from the core CRUD path)

### List 4 — Items that look like overkill but mask real bugs (do not just remove)

These items exist because there's an underlying bug. Removing the visible defense without fixing the bug makes things worse.

| Item | Underlying bug | Right action |
|---|---|---|
| `event-save-verification.ts` | Server's PATCH silently drops fields (`_droppedFields`) | Fix the PATCH pipeline; then verify-then-delete the layer |
| Scary 409 toasts | Row-level version check (§1.2 #4); rare Sheets backfill | Fix backfill `updatedAt`; keep check for real human co-edit |
| Auto-save & form-init race defenses | Two-phase load (list → full record) and socket-driven refetches collide with open forms | Collapse partial/full split OR silence socket-driven invalidation on records under edit |
| Form initialization race flag | Same root cause | Fix in Phase B as part of cache work |
| Dead optimistic update code | Wrong query keys + sledgehammer invalidation make it useless | Delete after Phase B (key mismatch fix + surgical invalidation) |

---

## 4. Phased plan

### Phase A — UI cleanup & safe wins

Ordered from highest payoff / lowest risk first. Dev-test each before deploy.

**A1. Collapse the 40+ dialog flags into a single `activeDialog` enum**
*(carried from v1 plan; restated)*
- File: `EventRequestContext.tsx`, all dialog consumers (~15-20 files)
- Risk: medium (touches many consumers; one wrong import == regression)
- Smoke: open each dialog type, save, close. Open one dialog from another (e.g. Edit → Reschedule).
- Effort estimate: 3-4 hours
- Payoff: reduces re-renders, makes dialog state debuggable, kills a whole class of "stuck dialog" bugs.

**A2. Fix form initialization race**
- File: `EventSchedulingForm.tsx` lines ~1220-1236
- Add explicit loading state, remove DEBUG logs once verified.
- Risk: low
- Smoke: open form on slow connection; verify no empty saves; confirm `formInitialized` always reaches true.

**A3. Hide the no-longer-needed features (List 3)**
- Add a single config object or feature flag (constant in code, not per-user) for: real-time socket UI updates, field-level collaboration locks, QuickScheduleButton, traffic conflicts, corporate SMS escalation.
- Default to off in production.
- Risk: low (code path remains; just no UI affordance)
- Smoke: confirm nothing else in the app depends on these being visible.

**A4. Two-column layout cleanup for cards**
- Already done for `CompletedCard`. Apply same shape to `ScheduledCardEnhanced` if the visual chaos is still an issue.
- Risk: low
- Smoke: visual sanity check.

**A5. Status-change reason dialogs (cancelled / declined / postponed)**
- TODO already exists at line 1617.
- Risk: low
- Smoke: change status to cancelled/declined; verify dialog appears and reason persists.

**A6. Move calendars nav under communication** — *done in prior commit*. Note for completeness.

### Phase B — Engine room (the hard, high-payoff work)

Small, reversible engine fixes (e.g. PR #416) may ship alongside Phase A. Do not start **large** Phase B items until Phase A is stable unless the fix is already proven in dev.

**B1. Surgical cache invalidation**
- Replace the sledgehammer `invalidateEventRequestQueries` with by-ID updates where possible.
- When you save event 47, only patch the cache entry for event 47; don't refetch every tab.
- Add a shared `patchEventInListCaches(id, updatedEvent)` helper in `queryClient.ts`; use from `useEventMutations` and other save paths.
- **Blast radius:** must still refresh `/api/volunteer-hub/*` and `/api/event-map` when fields that affect those views change (`showOnVolunteerHub`, dates, staffing) — surgical list patch alone is not enough for volunteer-facing screens.
- Files: `client/src/lib/queryClient.ts`, `client/src/components/event-requests/hooks/useEventMutations.tsx`
- Risk: medium-high — this is where stale-data complaints could resurface
- Smoke: edit event in one tab, navigate to another tab, confirm new value visible without manual refresh. Toggle `showOnVolunteerHub`; confirm volunteer hub updates. Edit event, save, confirm no other queries refetched (watch Network panel).
- **Concurrency test required:** two browser windows, two users, edit same event, save in one, observe what the other does.

**B2. Fix the optimistic-update key mismatch**
- Make `useEventMutations.setQueryData` target the same keys the list reads from (`['/api/event-requests/list', filterParams, quickFilter, 'v3']`).
- Alternatively: delete the optimistic layer entirely if B1 surgical invalidation makes it unnecessary.
- Files: `useEventMutations.tsx`
- Risk: low (worst case: optimistic UI doesn't appear; save still works)
- Smoke: inline-edit a field; verify card updates without a flicker; verify no full-page refetch.

**B3. Stop socket-driven refetch on your own saves** — ✅ **Done (PR #416)**
- Implemented via `X-Socket-Id` / `originSocketId` echo suppression — not the "recently-saved IDs" sketch, but same outcome.
- Smoke (regression): save a field; confirm no *second* full refetch from own echo in Network panel.

**B4. Fix spurious 409 triggers (keep `_expectedVersion` for human saves)**
- Scratchpad removed (§1.6) — dominant solo-editor trigger gone.
- **If 409s persist:** don't bump `updatedAt` on Sheets backfill-only writes (message empty → sheet content).
- **Avoid:** removing row-level locking entirely; avoid auto-retry-on-409.
- Files: [google-sheets-event-requests-sync.ts](server/google-sheets-event-requests-sync.ts), optionally [event-requests-legacy.ts](server/routes/event-requests-legacy.ts)
- Smoke: save form — no spurious 409. Two humans, same event, same field — 409 still appears.

**B5. Collapse partial/full payload split, OR document & test the contract**
- Option 1 (bigger): make `/api/event-requests/list` return enough fields that the edit form doesn't need a second fetch. Larger payload, simpler client.
- Option 2 (smaller): keep the split but generate the field contract from a single source of truth (a constant array in shared code) so cards and the list endpoint cannot drift.
- File: `server/routes/event-requests-legacy.ts` around line 1248, `eventRequestsListQuery.ts`, individual card consumers.
- Risk: medium
- Smoke: open every card type; confirm no missing fields. Save through every flow; confirm no silent drops in `_droppedFields` metadata.

**B6. Retire one of the two edit paths**
- Make `EventEditDialog` a thin wrapper around `EventSchedulingForm`, or fold the driver-planning use case into the main form.
- Files: `client/src/pages/driver-planning.tsx`, `client/src/components/event-requests/dialogs/EventEditDialog.tsx`
- Risk: medium
- Smoke: edit event from driver-planning view; confirm same behavior as editing from event-requests view.

**B7. Consolidate status-change paths (optional, after B1/B4)**
- Funnel common moves (`new → in_process → scheduled`, decline/cancel with reason) through one function that re-fetches fresh status before PATCH.
- Retire or hide `QuickScheduleButton` once main form path is trusted.
- Files: [useEventAssignments.tsx](client/src/components/event-requests/hooks/useEventAssignments.tsx), tab/card consumers
- Risk: medium
- Smoke: each status transition from each tab; no "invalid transition" from stale cache.

### Phase C — Cleanup & deferred items

After A and B prove stable for a few weeks.

- Delete the dead optimistic-update code if B1+B2 made it unnecessary.
- Delete hidden items from List 3 if no complaints surfaced in 60 days.
- Remove DEBUG console.logs.
- Address type-safety / network timeout items from v1 plan if motivation remains.
- Consider extracting CRUD from the legacy monolith into a clean handler.

---

## 5. What we explicitly chose NOT to do

For each, why:

- **Per-user feature flags before Phase A.** Dev environment is enough isolation. Flags become a maintenance burden if every change carries one.
- **Full UI duplicate ("renovation in the next room") for Phase A.** The engine room is shared. A duplicate UI doesn't fix engine bugs, and doubles the maintenance surface for the duration.
- **Remove `_expectedVersion` optimistic locking outright.** Trades visible 409s for silent overwrites. Fix spurious triggers in B4 (Sheets backfill, not blanket sync pause).
- **Add retry logic / auto-retry on 409.** Defensive layer on a defensive stack. If saves fail, fix the trigger or the save path.
- **Reduce TanStack Query stale time from 5min → 2min.** Runs counter to "calmer cache" direction.
- **Build a new monitoring stack.** The `application_error_logs` table from the SMS investigation work is enough infrastructure for now.

---

## 6. Instrumentation & exit criteria

### What to measure

For each Phase B fix, log a counter to `application_error_logs` or stdout:

- Number of socket-driven invalidations per minute, broken down by "originated by current user" vs "another user/process"
- Number of 409 conflicts per day, broken down by trigger: two-tab/double-save vs Sheets backfill vs real co-edit
- Number of saves that came back with `_droppedFields` metadata
- Time from "form opened" to "form initialized" (P50, P95)

### Exit criteria — "Phase A is done"

- No `formInitialized === false` blocks reported in two weeks of daily use.
- Katie can list five UI complaints from before A and confirm at least four are gone.
- No new bugs introduced (judged by absence of new complaints, not absence of bugs).

### Exit criteria — "Phase B is done"

- 409 rate drops to near-zero (only real concurrent human edits on overlapping fields).
- Save → see new value without manual refresh works in 100% of smoke-test cases.
- Optimistic update either works (visible flicker-free save) or has been deleted.
- Volunteer hub still updates when admin toggles hub-visible fields.
- The two-edit-paths divergence is gone (or status paths consolidated per B7).

---

## 7. Operating norms

A few rules to keep this from drifting back into the old pattern.

1. **No new defensive layers without first finding and fixing the underlying bug.**
   If save verification, retry logic, or "fallback" code is being added, that's a signal to stop and trace why the underlying call is unreliable.

2. **Freeze means freeze.**
   Items in List 2 don't get new features added during this work, even if a request comes in. The default answer is "not until the core is stable; here's what's in progress instead."

3. **Hide before delete — with an exception.**
   Items in List 3 are turned off in the UI first. Code stays. Only delete after 60 days of no complaints and ideally after a Phase C sweep. **Exception:** if production audit proves zero usage (see §1.6 scratchpad), delete immediately with the associated defensive code — don't leave dead layers in the tree.

4. **Smoke test the unhappy path.**
   Every Phase A and B change has a deliberate test for the failure mode it claims to fix — not just "the happy path still works."

5. **Production deploy = sit-and-watch for the first few hours.**
   Each Phase B deploy in particular. The `application_error_logs` table and stdout logs are the substitute for the per-user feature flag we chose not to build.

---

## 8. References to other docs

- `docs/event-requests-behavior-contract.md` — what current behavior is, so refactors can preserve it. **Read before touching anything in Phase B.**
- `docs/canonical-field-contracts.md` — the LIGHTWEIGHT FIELD CONTRACT. Critical for B5.
- `docs/event-request-api-audit.md` — query inventory. Useful for B1 (knowing what cache keys exist).
- `docs/event-requests-lazy-loading-plan.md` — DB-level status filtering. Independent of this plan; can be done any time.
- `docs/development/EVENT_REQUESTS_PERFORMANCE_PLAN.md` — payload work, mostly complete.
- `CLAUDE.md` — project-level conventions (dev/prod DB split, status workflow, etc.).
