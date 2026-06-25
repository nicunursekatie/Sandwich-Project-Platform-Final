# Event Requests Reliability Plan (v2)

> Supersedes `EVENT_REQUESTS_RELIABILITY_PLAN.md` (kept for history).
> Last updated: 2026-06-18 (post-audit sync: Unit 1/3 verified; Units 2/7/8/9 remain)
> Author: Katie + Claude, after end-to-end codebase walkthrough.
>
> **Companion docs** (still authoritative for their narrow topic):
> - `docs/event-requests-behavior-contract.md` — what current behavior must be preserved during refactors
> - `docs/canonical-field-contracts.md` — canonical naming/DTO field decisions (the old lightweight-list/full-record split was removed in Unit 7)
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

1. **Sledgehammer cache invalidation.** *(PATCH saves fixed Unit 1 / B1 — see §1.5; create/delete/bulk/sync still use full invalidation.)*
   `invalidateEventRequestQueries` ([client/src/lib/queryClient.ts](client/src/lib/queryClient.ts)) invalidates AND force-refetches every query whose key starts with `/api/event-requests` or `/api/volunteer-hub`, plus `/api/event-map`. **Before B1:** ran on every save and every cross-tab socket event.

2. **Socket invalidation on every PATCH** *(own-echo fixed §1.5; cross-tab PATCH now surgical via `applyEventRequestUpdateById` — Unit 1)*.
   Server middleware at [server/routes/event-requests/index.ts:57-74](server/routes/event-requests/index.ts) wraps `res.json` to emit `event_request_updated` on any 2xx PATCH/PUT across all sub-routers. Client at [useEventRequestSocket.ts](client/src/hooks/useEventRequestSocket.ts) handles cross-tab updates with a single GET + surgical cache patch. Create/delete socket events still use full invalidation. Before PR #416, your own save also triggered a second full refetch (save → socket echo → invalidate again).

3. **Optimistic updates previously targeted dead cache keys** *(active dead-key writes no longer found; Unit 2 is now a keep/delete decision).*
   List query reads from `['/api/event-requests/list', filterParams, quickFilter, 'v3']` ([eventRequestsListQuery.ts:102](client/src/components/event-requests/lib/eventRequestsListQuery.ts)). The original reliability bug was optimistic patches writing to `['/api/event-requests']` / `['/api/event-requests', 'v2']`, which never overlapped the active list cache. Current audit shows the remaining inline scheduled-field optimistic patch now targets the correct `/api/event-requests/list` cache family via `patchEventInListCaches`; decide in Unit 2 whether to keep that correct-key optimistic feedback or delete it and rely on the Unit 1 success patch.

4. **Row-level `_expectedVersion` check → spurious 409s** *(row-level gate **removed** PR #417 — see §1.5)*.
   PATCH at [event-requests-legacy.ts:2637-2649](server/routes/event-requests-legacy.ts) now **strips** `_expectedVersion` and does not 409 on `updatedAt` drift. Current audit shows active client PATCH sends have been removed/avoided in `EventSchedulingForm`, `useEventMutations`, and `EventEditDialog`; only defensive server stripping, comments, and generic non-`_expectedVersion` 409 handling remain (§B8 / Unit 3).

   **Historical 409 triggers** (pre-#417; scratchpad removed §1.6):

   | Trigger | Mechanism |
   |---|---|
   | ~~Scratchpad + form~~ | Removed §1.6 |
   | Two quick saves / two tabs | Stale client baseline (still possible if partial save + refetch desyncs form) |
   | Sheets message backfill (rare) | Sets `updatedAt` on empty-message backfill |
   | Real two-human same-field edit | Was blocked whole row; now last-write-wins unless field-level check added later |

   **Remaining work (§B8 / Unit 3):** active client `_expectedVersion` sends are stripped; keep server-side stripping for stale clients and handle any future true conflicts at field level, not row level. Separately, evaluate whether backfill-only sync writes should avoid bumping `updatedAt` if they still create user-visible churn.

5. **Partial/full payload split removed (Unit 7, 2026-06-19).**
   `/api/event-requests/list` now returns full event records, and `EventSchedulingForm` initializes from the passed `eventRequest` without a second `['/api/event-requests', id, 'full']` query. The former lightweight projection and hand-maintained field contract were deleted, closing the main dual-shape bug gap.

6. **Two edit paths.**
   `EventSchedulingForm` is the primary edit dialog. `EventEditDialog` is a parallel edit path used by driver planning ([driver-planning.tsx:51, :7371](client/src/pages/driver-planning.tsx)). Different PATCH payloads, different cache handling, different error UX.

7. **Silent field drops (`_droppedFields`).**
   Server's PATCH at [event-requests-legacy.ts:3113-3117](server/routes/event-requests-legacy.ts) attaches `_droppedFields` metadata describing fields that were silently rejected. Client has `event-save-verification.ts` to detect this. "Save succeeded" and "everything you typed was persisted" are not the same thing.

8. **Strangler refactor is half-done.**
   Sub-routers exist (`volunteers.ts`, `flags.ts`, `ai.ts`, `sms.ts`, `organizations.ts`, `sync.ts`, `audit.ts`, `conflicts.ts`, `lifecycle.ts`) but the main CRUD pipeline is still inside the 5,166-line legacy file. The easy stuff got extracted; the hard stuff didn't.

9. **God-context with an incomplete split.**
   `EventRequestContext` owns ~50 state fields and spreads in `EventDialogContext` via `...rest` ([EventRequestContext.tsx:664-668](client/src/components/event-requests/context/EventRequestContext.tsx)). The comment in the code apologizes for this. Opening any dialog re-renders the whole tree.

10. **Eight status-change paths, one entity.**
    Status moves through separate code with different PATCH shapes — not one function. Verified paths include: `handleStatusChange` in [useEventAssignments.tsx](client/src/components/event-requests/hooks/useEventAssignments.tsx) (most tab buttons), `EventSchedulingForm` full-form save path (formerly `detectChangedFields`), [QuickScheduleButton.tsx](client/src/components/event-requests/QuickScheduleButton.tsx) (comment: *"Emergency workaround… Bypasses the full form submission flow"*), [RescheduleDialog](client/src/components/event-requests/dialogs/RescheduleDialog.tsx), [NonEventDialog](client/src/components/event-requests/dialogs/NonEventDialog.tsx), [StatusReasonDialog](client/src/components/event-requests/dialogs/StatusReasonDialog.tsx), [DuplicateEventDialog](client/src/components/event-requests/dialogs/DuplicateEventDialog.tsx), [IntakeCallDialog](client/src/components/event-requests/IntakeCallDialog.tsx), inline paths in [index.tsx](client/src/components/event-requests/index.tsx). "Status won't move" and "didn't save" overlap here — different buttons, different failure modes.

11. **Stale list cache → false "invalid status change."**
    `handleStatusChange` reads `request.status` from the **list cache** ([useEventAssignments.tsx:632-640](client/src/components/event-requests/hooks/useEventAssignments.tsx)) and validates client-side before PATCH. Server validates `originalEvent.status → requested status` from DB. If UI is stale (DB moved to B, UI still shows A), user can get blocked with a transition error they didn't cause. Calmer cache + fresh status before status PATCH addresses this; consolidating status paths is the long-term fix.

12. **Mutation success still runs the sledgehammer.** *(PATCH paths fixed Unit 1 — see §1.5)*
    PR #416 removed the **double** refetch (own socket echo). **Before Unit 1:** every save path that called `invalidateEventRequestQueries` in `onSuccess` force-refetched all event + volunteer-hub queries once — the main "it ate my edit" trigger while a form was open. **After Unit 1:** PATCH/PUT saves patch list rows surgically; full invalidation remains only for create, delete, restore, Sheets sync, and bulk admin tools.

### 1.3 How user complaints map (don't need a top-10 list)

Staff say **"didn't save"** or **"status won't move"** — these are **cluster labels**, not single bugs:

| What they experienced | Likely cluster |
|---|---|
| Text disappeared while typing | Refetch mid-edit (§1.2 #1, #12; own-echo fixed §1.5) |
| "Someone else edited this" (409) | Stale `_expectedVersion` (§1.2 #4 — two-tab/double-save, rare Sheets backfill, or real co-edit) |
| "Saved" but field wrong on card | Partial PATCH / `_droppedFields` (§1.2 #5, #7) or timing before refetch completes |
| Status button did nothing / wrong error | Eight paths (§1.2 #10) or stale status (§1.2 #11) |
| **Mark Scheduled sporadically fails (click → nothing happens / silently fails)** | **See §1.3.1 below — multi-cause; the main symptom that produced the "QuickSchedule backup button" confession** |
| Mark Scheduled only works via QuickSchedule | Workaround for the above; live evidence in [InProcessCard.tsx:1755](client/src/components/event-requests/cards/InProcessCard.tsx) — comment reads *"Backup quick schedule button - bypasses form if main button has issues"* |

**One triage question for live reports:** *"Were you in the big form, a card button, or Quick Schedule?"* — routes to the right cluster.

#### 1.3.1 The "Mark Scheduled sporadically fails" pattern

This deserves its own writeup because it was the daily complaint that produced QuickScheduleButton — a hardcoded "if the main button doesn't work, use this one" workaround sitting next to the main Mark Scheduled button in every InProcessCard.

**Symptom:** User clicks "Mark Scheduled" on an in-process event card. Sometimes:
- Nothing happens (no dialog opens, no error)
- The form opens but the save silently fails
- The form opens, the save appears to succeed, but the event doesn't move to Scheduled
- The form opens but the dropdown still shows In Process even though the click meant "schedule it"

**Underlying causes (all overlap; any one of these can produce the symptom):**

| Underlying cause | Mechanism | Plan reference |
|---|---|---|
| Stale list cache during status transition | User clicks Mark Scheduled → status PATCH starts → refetch storm refetches the list with old status → form opens in "wrong" state | §1.2 #1, #11 → fixed by **Unit 1** (surgical cache) |
| Form pre-fill race | Formerly: `EventSchedulingForm` opened before the full-record fetch completed, and `status: 'scheduled'` could get lost in the partial→full merge. Unit 7 removed that second-fetch upgrade path. | §1.2 #5 → **Unit 7 shipped**; Unit 6 may still clean up remaining generic form-init/debug state |
| Partial PATCH drops `status` field | Server's `_droppedFields` pipeline rejects the status change as an "invalid transition" because it compared against stale baseline | §1.2 #7, #11 → reduced by **Unit 1**, eliminated by **Unit 7** |
| Eight status paths, one of them broken | Mark Scheduled goes through `handleStatusChange` in [useEventAssignments.tsx](client/src/components/event-requests/hooks/useEventAssignments.tsx); other status buttons go through different paths; if `handleStatusChange` regresses, only Mark Scheduled breaks | §1.2 #10 → fixed by **Unit 9** (consolidate status paths) |
| Socket echo wiped the form | Pre-PR #416: user clicks Mark Scheduled, save starts, server emits `event_request_updated`, client refetches and resets the form before save completes | §1.2 #2 → **own-echo fixed PR #416**; cross-tab refetch storm fixed **Unit 1** |

**Why it was sporadic, not consistent:** Before Unit 7, it depended on whether a refetch was in flight when you clicked, whether the partial→full merge had completed, whether the sync just bumped `updatedAt`, and whether another user happened to save anything in the last few seconds. None of those things were visible to the user. From their POV, "sometimes the button works, sometimes it doesn't" — which is exactly what they reported.

**Why QuickScheduleButton "fixed" it (and why it's a confession):**
[QuickScheduleButton.tsx](client/src/components/event-requests/QuickScheduleButton.tsx) bypasses the form entirely. It sends a minimal status PATCH and skips the partial/full load, the merge logic, and the form initialization race. So it works more reliably — but it works by *avoiding* the broken path, not by fixing it. It also means users learned "if Mark Scheduled fails, use the other button," which is not a workflow you want to teach.

**What fixes it permanently:**
- **Unit 1** (surgical cache) → eliminates the refetch storm that interrupts the click
- **Unit 6** (form init race) → eliminates the open-before-loaded window
- **Unit 7** (collapse partial/full) → eliminates the merge logic that loses the schedule intent
- **Unit 9** (consolidate status paths) → guarantees Mark Scheduled goes through the same path as every other status change, so a regression in one is a regression in all

After Units 1, 6, 7, and 9 ship, QuickScheduleButton should be deletable. Until then, leave it visible — the user behavior is already adapted to it.

**Cluster label for triage:** if a user reports "Mark Scheduled didn't work," ask: *"Did the dialog open at all? If yes, did Save appear to do something?"* That distinguishes the form-init race (dialog never opens) from the partial-PATCH drop (dialog opens, Save does nothing visible).

### 1.4 Verified non-triggers (common misdiagnoses)

These are **not** causing event-management wipes in the current code:

- **No 60-second polling** on event lists or the scheduling form (`refetchInterval: false` globally; [EventRequestContext.tsx:330](client/src/components/event-requests/context/EventRequestContext.tsx) sets `refetchOnWindowFocus: false`).
- **Not every background refresh re-initializes the form** — after Unit 7, `EventSchedulingForm` has one full-record source and no partial→full merge path. Remaining form re-init concerns are generic dialog/form state, not dual-shape data loading.
- **Sheets sync is not continuously rewriting in-progress events** — insert-only except empty-message backfill (§1.2 #4).

### 1.5 Already shipped (2026-06-18, PRs #416–#419 + Unit 1)

Do not rebuild these:

| Change | Commits | What it fixed |
|---|---|---|
| Ignore own socket echo | `b20a1e220` | `X-Socket-Id` on [apiRequest](client/src/lib/queryClient.ts); server echoes `originSocketId`; [useEventRequestSocket.ts](client/src/hooks/useEventRequestSocket.ts) skips matching id. Removes redundant refetch on your own save. Fails safe if socket not connected. |
| Scratchpad list sync without refetch storm | `13f049395` | Surgical list-cache patch in scratchpad (component since removed §1.6). Pattern reimplemented in `queryClient.ts` for Unit 1. |
| Intake paths surgical cache | Unit 1 | [IntakeCallDialog.tsx](client/src/components/event-requests/IntakeCallDialog.tsx) uses `applyPatchResponseToCache` after save-notes / move-to-non-event (was sledgehammer post-#416). |
| Remove row-level version gate on PATCH | `4c2ff41fd` (PR #417) | [event-requests-legacy.ts:2637-2649](server/routes/event-requests-legacy.ts) strips `_expectedVersion`; no 409 on `updatedAt` drift. **Unblocks Cause A root fix** (§2.5, §B5) — partial saves no longer needed to avoid row-level collisions. Follow-up audit verified active client sends are removed/avoided in the main remaining PATCH paths; keep the server strip defensively (§B8 / Unit 3). |
| Full-form save (Cause A root fix) | `08ca814a7` (PR #418) | [EventSchedulingForm.tsx](client/src/components/event-requests/EventSchedulingForm.tsx) PATCHes full `buildEventDataForServer()` output; `detectChangedFields` deleted. Unit 7 later removed the partial→full form-load guard by making the list provide full records. |
| List read contract (#419) | PR #419 / superseded by Unit 7 | Originally centralized the lightweight list projection; Unit 7 later removed the separate projection by making `/api/event-requests/list` return full event records. |
| **Surgical cache invalidation (Unit 1 / B1)** | *(this commit)* | [queryClient.ts](client/src/lib/queryClient.ts): `patchEventInListCaches`, `applyEventRequestSaveToCache`, `applyPatchResponseToCache`, `applyEventRequestUpdateById`. Migrated ~20 PATCH save callsites; sledgehammer kept for create/delete/restore/Sheets sync/bulk. Status moves refresh list + counts only; volunteer hub / event map invalidate only when touched fields require it. |
| Call Notes Scratchpad removed | `4f46dcd3e` | See §1.6 — ~400 lines deleted; audit showed zero usage. |
| Resources Open button fix | `188fd17eb` | [resources.tsx](client/src/pages/resources.tsx) — URL priority + anchor click for reliable open. |

**Still open after Unit 7:** remaining correct-key optimistic inline edit behavior needs a keep/delete decision (§B6 / Unit 2), status paths still need consolidation (§1.2 #10, §B11 / Unit 9), and production smoke checks for B5 + Unit 1/7. Dead client `_expectedVersion` sends have been stripped (§B8 / Unit 3); only server-side stripping/comments and generic conflict handling remain.

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
- Historical `_expectedVersion` form-save state (`callNotesExpectedVersionRef` — misnamed; applied to all form fields before client sends were removed/avoided)
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
- **§1.2 #4 / §B8:** scratchpad 409 source gone; active client `_expectedVersion` sends stripped; Sheets backfill `updatedAt` behavior only if it still creates churn
- **B1:** ✅ shipped Unit 1 — surgical helpers in [queryClient.ts](client/src/lib/queryClient.ts); PATCH saves no longer sledgehammer

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
- **Not** removing server-side `_droppedFields` reporting. Keep until PATCH pipeline is clean; full-form save (§B5) fixes client-side omission.
- **Not** reinstating row-level `_expectedVersion` (removed PR #417). If co-edit becomes real, add field-level conflict check — not row-level gate.
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

### 2.5 Bandaid vs root fixes (the shrink-or-patch decision)

Each major complaint class has two fixes. **Bandaids add or maintain complexity; root fixes delete layers.** Stacking bandaids is how the component got to 96 files.

#### Cause A — "it didn't save the field"

| | Approach | Effect on codebase |
|---|---|---|
| **Bandaid** | Add field to `ALWAYS_INCLUDE_FIELDS` in [form-utils.ts:278](client/src/components/event-requests/form-utils.ts) | Grows forever — one entry per dropped field |
| **Root** | **Full-form save** from `EventSchedulingForm` — send entire `buildEventDataForServer()` payload every time, not `detectChangedFields()` subset | **Deletes** `detectChangedFields`, `ALWAYS_INCLUDE_FIELDS`, schedule-mode strip logic in change detection, and much of the save-verification scaffolding that only exists to catch silent drops |

**Why root is viable now:** PR #417 removed the row-level `_expectedVersion` gate. Partial saves existed partly to minimize collision surface — with solo-editor reality + no row lock, writing the whole form is acceptable.

**Scope:** `EventSchedulingForm` only. Card quick-toggles, status buttons, intake dialog, and other dialogs stay partial PATCH by design.

#### Cause B — "it saved but the card doesn't show it"

| | Approach | Effect on codebase |
|---|---|---|
| **Bandaid** | Add missing field to hand-maintained list contract at [event-requests-legacy.ts:1248](server/routes/event-requests-legacy.ts) + update docs | Same whack-a-mole as Cause A |
| **Root** | **One read shape** — card and form share one cached event object (or list returns enough fields that form doesn't need a second fetch) | **Deletes** the lightweight/full contract split |

**Tradeoff:** Bigger lift; touches list payload size. Audit-first, same as Cause A.

#### Recommendation (2026-06-18)

Do **Unit 2 (decide keep/delete for remaining correct-key optimistic inline edit)** next — now that B1 is shipped. Cause B (§B9 / Unit 7) follows once saves + cache are trustworthy in production. ~~Cause A (§B5)~~ ✅ shipped PR #418. ~~B1 surgical invalidation~~ ✅ shipped Unit 1.

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
- The optimistic locking with `_expectedVersion` (server gate removed PR #417; active client sends removed/avoided in §B8 / Unit 3)

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
| `event-save-verification.ts` | Server's PATCH silently drops fields (`_droppedFields`) + partial save omits fields client-side | **Root:** full-form save (§B5) eliminates client-side omission; keep `getDroppedServerFields` until server drops are fixed; delete heuristic `findMismatchedSavedFields` blocking later |
| Scary 409 toasts | Was row-level version check (fixed #417) | Client `_expectedVersion` sends are stripped; fix Sheets backfill `updatedAt` only if still causing visible churn |
| Auto-save & form-init race defenses | Two-phase load (list → full record) and socket-driven refetches collide with open forms | Collapse partial/full split OR silence socket-driven invalidation on records under edit |
| Form initialization race flag | Same root cause | Fix in Phase B as part of cache work |
| Remaining optimistic inline edit patch | Original wrong-key optimistic writes appear gone; one correct-key patch remains | Decide keep/delete after Unit 1 production smoke |

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

**B1. Surgical cache invalidation** — ✅ **Done (Unit 1, 2026-06-18)**

Replace the sledgehammer `invalidateEventRequestQueries` with by-ID updates on PATCH saves. Helpers in `queryClient.ts`: `patchEventInListCaches`, `applyEventRequestSaveToCache`, `applyPatchResponseToCache`, `applyEventRequestUpdateById`. Full invalidation remains for create/delete/bulk/Sheets sync.

**B5. Full-form save — Cause A root fix** — ✅ **Done (PR #418, 2026-06-18)**

Stop sending only changed fields from `EventSchedulingForm`. Send the full `buildEventDataForServer()` output every save.

**Why:** `detectChangedFields` + `ALWAYS_INCLUDE_FIELDS` is the bandaid stack that causes "didn't save" (van driver flags, SpeakerWarningDialog pause race, baseline drift). Full-form save removes the bug *class* by subtraction.

**Audit confirmed (2026-06-18):**

| Question | Answer |
|---|---|
| Who used `detectChangedFields` before PR #418? | **Only** [EventSchedulingForm.tsx](client/src/components/event-requests/EventSchedulingForm.tsx) + [mark-scheduled-save.test.ts](client/src/components/event-requests/__tests__/mark-scheduled-save.test.ts); current code has deleted the runtime helper |
| Who stays partial PATCH? | Card toggles (`useEventMutations`), status buttons, intake/reschedule/decline dialogs, assignments — **unchanged** |
| Blocked by version lock? | **No** — PR #417 (`4c2ff41fd`) removed server 409 on `updatedAt` drift |
| What got deleted? | `detectChangedFields()` (~80 lines), `ALWAYS_INCLUDE_FIELDS`, schedule-mode strip logic inside it, and the main form's client `_expectedVersion` send |
| What stays? | `buildEventDataForServer()` (single serialization source), `getDroppedServerFields()` (server `_droppedFields` still authoritative), `originalFormDataRef` (form init + localStorage recovery) |

**Implementation (1 PR):**

1. [EventSchedulingForm.tsx](client/src/components/event-requests/EventSchedulingForm.tsx) `performSubmit`: PATCH `eventData` instead of `detectChangedFields(eventData, originalFormDataRef.current, mode)`
2. Delete `detectChangedFields` from [form-utils.ts](client/src/components/event-requests/form-utils.ts)
3. Remove `callNotesExpectedVersionRef` + `_expectedVersion` from form mutation (server ignores it anyway) — completed in the main form path
4. Rewrite [mark-scheduled-save.test.ts](client/src/components/event-requests/__tests__/mark-scheduled-save.test.ts) to assert `buildEventDataForServer` output includes critical booleans (van flags, status, dates)
5. Update [replit.md](replit.md) — remove `ALWAYS_INCLUDE_FIELDS` rule (obsolete)

**Risks to verify in dev:**

- Stale form baseline → full save writes back untouched fields that drifted on server (mitigated by solo-editor workflow; worse case = refetch mid-edit from sledgehammer — fix in B1)
- Server `_droppedFields` on fields not in allow-list (full payload may surface more server rejects — good, surfaces real bugs)
- "No changes" guard in edit mode — replace with compare of full `eventData` vs baseline-built payload, or drop guard

**Post-merge smoke checklist (production, ~15–20 min + spot-check over 2–3 days):**

*Plain English:* Before B5, the edit form only sent fields it *thought* changed — sometimes missing van flags, checkboxes, etc. ("saved" toast, then value snaps back). Full-form save sends the whole form on Save, with guards so it won't save until the full event record has loaded.

**Before you start:** Pick 2–3 real in-process events you can safely edit. After each test, hard refresh (Cmd+Shift+R) and confirm the value stuck. If something fails, note: event, what you clicked, expected vs actual.

#### Priority 1 — bugs people actually reported

| # | Do this | Pass if… | Fail if… |
|---|---|---|---|
| 1 | Edit in-process event → check **Van driver needed** → Save → refresh | Checkbox + card **Van Needed** badge still set | Unchecked or badge gone after refresh |
| 2 | On card: **Needs Van?** → **For sure** or **Possibly** → refresh | Badge still shows (teal or amber) | Badge gone *(different save path — confirms no regression)* |
| 3 | Edit → check **Self transport** → save → refresh; then uncheck, check van → save → refresh | Each state sticks; badge matches | Van stuck on with self-transport, or flags won't save |
| 4 | Event with lots filled in → edit **one field only** (e.g. scheduling notes) → save → refresh → reopen | Change saved; address, counts, other notes untouched | Blank/wrong fields you didn't touch |

#### Priority 2 — scheduling flows (date bugs hid here)

| # | Do this | Pass if… | Fail if… |
|---|---|---|---|
| 5 | **Mark Scheduled** → confirm date/time → **Schedule Event** → refresh | On Scheduled tab; date correct | Still In Process, wrong date, or error |
| 6 | **Mark Scheduled** → status **Standby** (don't change date) → save | Standby tab; no wrongly stamped confirmed date | Shows scheduled with locked date when you chose Standby |
| 7 | **Scheduled** event → edit something else, **don't touch date box** → save → refresh | Edit saved; date unchanged | Date reverted to old requested date or blank |
| 8 | 500+ sandwiches, 0 speakers → Save → speaker warning → confirm → save → refresh | Completes; van/other fields still set | Hangs or van flags lost after dialog |

#### Priority 3 — protective guards (annoying but good)

| # | Do this | Pass if… | Fail if… |
|---|---|---|---|
| 9 | Open edit → hit Save within ~1 second | **Please wait** / **Still loading** — blocked, nothing corrupted | Save goes through and wipes random fields |
| 10 | *(Optional)* Slow 3G in devtools → open edit → save before loaded | Blocked with clear message; works after load | Partial save overwrites data |

#### Priority 4 — other paths unchanged by B5

| Action | Pass if… |
|---|---|
| Card toggles (Date Confirmed, Volunteer Hub, etc.) | Stick after refresh |
| Intake call dialog → planning notes | Visible on card/form after refresh |
| Inline edit on scheduled card | Field sticks after refresh |
| Same-day van badge **+N** on in-process card | Shows when another event that day also needs van |

#### Red flags — stop and note immediately

- Field you **didn't touch** goes blank after save + refresh
- **Date jumps** when you only edited notes
- **Saved successfully** but refresh shows old data
- **Couldn't load this event** on every open (full fetch failing)
- **409 / conflict** on save *(should be rare after #417)*

#### Exit criteria

Priority 1–2 pass on real events over 2–3 days of normal use → B5 is doing its job. **Unit 1 smoke test still required in production:** save a field → network-tab clean; two-tab edit of different events → form not wiped.

**Dev smoke (engineer):** Network panel — PATCH body includes full form payload, not a 3-key subset.

**Effort:** ~2–4 hours (shipped) · **Risk:** medium · **Payoff:** deletes a whole defensive layer

**B6. Fix the optimistic-update key mismatch**
- Make `useEventMutations.setQueryData` target the same keys the list reads from (`['/api/event-requests/list', filterParams, quickFilter, 'v3']`).
- Alternatively: delete the optimistic layer entirely if B1 surgical invalidation makes it unnecessary.
- Files: `useEventMutations.tsx`
- Risk: low (worst case: optimistic UI doesn't appear; save still works)
- Smoke: inline-edit a field; verify card updates without a flicker; verify no full-page refetch.

**B7. Stop socket-driven refetch on your own saves** — ✅ **Done (PR #416)**
- Implemented via `X-Socket-Id` / `originSocketId` echo suppression — not the "recently-saved IDs" sketch, but same outcome.
- Smoke (regression): save a field; confirm no *second* full refetch from own echo in Network panel.

**B8. Strip dead client `_expectedVersion` + Sheets backfill fix**
- Server already strips `_expectedVersion` (PR #417). Current audit shows active sends are removed/avoided in `EventSchedulingForm`, [useEventMutations.tsx](client/src/components/event-requests/hooks/useEventMutations.tsx), and [EventEditDialog.tsx](client/src/components/event-requests/dialogs/EventEditDialog.tsx); keep the server strip defensively for stale clients.
- If needed: don't bump `updatedAt` on Sheets backfill-only writes.
- Formerly overlapped §B5 step 3; current audit treats active client sends as complete and leaves only server defensive stripping / any Sheets backfill behavior decision.

**B9. One read shape — Cause B root fix** *(bigger lift; after B5)*
- Option 1 (bigger): make `/api/event-requests/list` return enough fields that the edit form doesn't need a second fetch. Larger payload, simpler client.
- Option 2 (smaller): keep the split but generate the field contract from a single source of truth (a constant array in shared code) so cards and the list endpoint cannot drift.
- File: `server/routes/event-requests-legacy.ts` around line 1248, `eventRequestsListQuery.ts`, individual card consumers.
- Risk: medium
- Smoke: open every card type; confirm no missing fields. Save through every flow; confirm no silent drops in `_droppedFields` metadata.

**B10. Retire one of the two edit paths**
- Make `EventEditDialog` a thin wrapper around `EventSchedulingForm`, or fold the driver-planning use case into the main form.
- Files: `client/src/pages/driver-planning.tsx`, `client/src/components/event-requests/dialogs/EventEditDialog.tsx`
- Risk: medium
- Smoke: edit event from driver-planning view; confirm same behavior as editing from event-requests view.

**B11. Consolidate status-change paths (optional, after B1/B5)**
- Funnel common moves (`new → in_process → scheduled`, decline/cancel with reason) through one function that re-fetches fresh status before PATCH.
- Retire or hide `QuickScheduleButton` once main form path is trusted.
- Files: [useEventAssignments.tsx](client/src/components/event-requests/hooks/useEventAssignments.tsx), tab/card consumers
- Risk: medium
- Smoke: each status transition from each tab; no "invalid transition" from stale cache.

### Phase C — Cleanup & deferred items

After A and B prove stable for a few weeks.

- Delete the dead optimistic-update code if B1+B6 made it unnecessary.
- Delete hidden items from List 3 if no complaints surfaced in 60 days.
- Remove DEBUG console.logs.
- Address type-safety / network timeout items from v1 plan if motivation remains.
- Consider extracting CRUD from the legacy monolith into a clean handler.

---

## 5. What we explicitly chose NOT to do

For each, why:

- **Per-user feature flags before Phase A.** Dev environment is enough isolation. Flags become a maintenance burden if every change carries one.
- **Full UI duplicate ("renovation in the next room") for Phase A.** The engine room is shared. A duplicate UI doesn't fix engine bugs, and doubles the maintenance surface for the duration.
- **Remove `_expectedVersion` optimistic locking outright.** Row-level gate already removed server-side (PR #417). Active client sends are removed/avoided (§B8 / Unit 3); do not reinstate row-level 409s.
- **Add retry logic / auto-retry on 409.** Defensive layer on a defensive stack. If saves fail, fix the trigger or the save path.
- **Reduce TanStack Query stale time from 5min → 2min.** Runs counter to "calmer cache" direction.
- **Build a new monitoring stack.** The `application_error_logs` table from the SMS investigation work is enough infrastructure for now.

---

## 6. Instrumentation & exit criteria

### What to measure

For each Phase B fix, log a counter to `application_error_logs` or stdout:

- Number of socket-driven invalidations per minute, broken down by "originated by current user" vs "another user/process"
- Number of saves that came back with `_droppedFields` metadata (should drop after §B5 full-form save)
- Time from "form opened" to "form initialized" (P50, P95)

### Exit criteria — "Phase A is done"

- No `formInitialized === false` blocks reported in two weeks of daily use.
- Katie can list five UI complaints from before A and confirm at least four are gone.
- No new bugs introduced (judged by absence of new complaints, not absence of bugs).

### Exit criteria — "Phase B is done"

- 409 rate drops to near-zero (only real concurrent human edits on overlapping fields).
- Save → see new value without manual refresh works in 100% of smoke-test cases.
- `detectChangedFields` / `ALWAYS_INCLUDE_FIELDS` deleted (§B5).
- Optimistic update either works (visible flicker-free save) or has been deleted.
- Volunteer hub still updates when admin toggles hub-visible fields.
- The two-edit-paths divergence is gone (or status paths consolidated per B11).

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
- `docs/canonical-field-contracts.md` — the LIGHTWEIGHT FIELD CONTRACT. Critical for §B9 (Cause B).
- `docs/event-request-api-audit.md` — query inventory. Useful for B1 (knowing what cache keys exist).
- `docs/event-requests-lazy-loading-plan.md` — DB-level status filtering. Independent of this plan; can be done any time.
- `docs/development/EVENT_REQUESTS_PERFORMANCE_PLAN.md` — payload work, mostly complete.
- `CLAUDE.md` — project-level conventions (dev/prod DB split, status workflow, etc.).

---

## 9. Executable backlog — work this from the top

This is the **fully sequenced** list of what remains. Items are ordered by (1) what unblocks the next item, then (2) what kills the loudest remaining bug per unit of risk.

Each item is a self-contained work unit. You can pick one up cold, do it, ship it, and come back tomorrow for the next.

**How to use this section:**
- Work top to bottom. Don't skip.
- One unit per work session. They're sized for that.
- After shipping each unit, update `[ ]` → `[x]` and add a one-line "what I noticed" note.
- If a unit reveals new structural problems, write them down in §1.2 as a new bug, then decide whether to insert a new unit here or defer.
- **Do not** start a unit without re-reading its "smoke test" and "exit criteria" first. That's the bar; nothing is "done" until both pass.

### Glossary of recurring smoke-test phrases

- **"Two-window concurrency test"**: open two browser windows, log in as two different users (or two different sessions), edit the same event in both, save in one, observe the other.
- **"Sit-and-watch deploy"**: after pushing to production, tail logs and watch the UI for the first 2–4 hours. Do not deploy at the start of a high-intake day.
- **"Network-tab clean"**: open Chrome devtools Network tab, perform the action, confirm **only** the expected request fires (not a cascade of `/api/event-requests*` refetches).

---

### Unit 1 — Surgical cache invalidation (B1) 🔴 highest payoff

**Closes:** #1 (sledgehammer), #11 (false "invalid transition"), most of remaining #2 (other-tab refetch storm), #12 (mutation success runs sledgehammer)

**Status:** [x] Shipped (2026-06-18)

**Why it's first:** This is the single highest-leverage remaining change. It closes the loudest open issue (forms wiped mid-edit by unrelated saves) and makes Units 2 and 5 trivially simpler.

**Scope:**
1. Replace `invalidateEventRequestQueries` calls with surgical `setQueryData` patches keyed by event ID. ✅
2. For list cache: patch the single row inside `['/api/event-requests/list', filterParams, quickFilter, 'v3']` array data, don't refetch the list. ✅
3. For status-counts cache (`['/api/event-requests/status-counts']`): only re-invalidate when status actually changed, not on every save. ✅
4. For volunteer hub cache: only invalidate if the save actually touched a field volunteer hub reads. ✅
5. Keep `invalidateEventRequestQueries` available as the fallback for status changes, deletes, and creates — but make it the exception, not the default. ✅

**Files:**
- `client/src/lib/queryClient.ts` (`invalidateEventRequestQueries`)
- `client/src/components/event-requests/hooks/useEventMutations.tsx` (rewrite `onSuccess` / `onSettled` to use surgical updates)
- `client/src/hooks/useEventRequestSocket.ts` (apply same surgical pattern to socket handlers)
- All per-card mutation callsites (~14 files) — audit which ones can use the surgical helper

**Prereqs:** Read §1.2 #1, #2, #11, #12 and the optimistic-update key mismatch in §1.2 #3.

**Smoke test:**
- Edit a field, save, network-tab clean (only the save request, no refetch cascade).
- Open event in tab A, edit field. In tab B, save a *different* event. Confirm tab A's form is NOT wiped.
- Change status: confirm `status-counts` refetches once (it should — counts changed). Confirm the list cache reflects new status via patch, not refetch.
- Two-window concurrency test: user B saves field X on event 47. User A is on event 47's tab but in a different card. User A's view updates without losing in-progress work.

**Exit criteria:**
- Saving any field triggers zero `GET /api/event-requests*` requests (only the PATCH).
- Socket events from other users still update the relevant card data, but do not refetch lists.
- No regression in "I save and then see the new value" scenarios.

**Estimated effort:** 4–6 hours. The cache change is small; the audit of all callsites is the slow part.

**Risk:** medium-high. Stale-data complaints could resurface if a patch misses a field. Mitigate by sitting-and-watching the deploy.

**Notes after shipping:**
- Helpers live in `queryClient.ts`; ~20 PATCH callsites migrated across cards, dialogs, hooks, modals, and socket handler.
- Sledgehammer intentionally kept for: create, delete, restore, Google Sheets sync, bulk import tools.
- `updateScheduledFieldMutation` still has `onMutate` optimistic patch on correct list keys — Unit 2 cleanup candidate.
- **Production smoke test pending** — run §Unit 1 smoke checklist before calling this fully stable.

---

### Unit 2 — Decide whether to keep the remaining optimistic inline-edit patch (was B6)

**Closes:** #3 (optimistic updates on dead keys)

**Status:** [~] Partially superseded by Unit 1 cleanup (2026-06-18 audit)

**Why now:** With Unit 1 done, the original dead-key optimistic updates targeting `['/api/event-requests']` and `['/api/event-requests', 'v2']` appear gone from the active event-request mutation path. The remaining inline scheduled-field optimistic patch now targets the correct `/api/event-requests/list` cache family via `patchEventInListCaches`. Decide whether that correct-key optimistic patch is still useful, or delete it if Unit 1's surgical success patch is fast enough.

**Scope:**
1. Verify no active event-request mutation still writes optimistic data to `['/api/event-requests']` or `['/api/event-requests', 'v2']`.
2. Audit the remaining `updateScheduledFieldMutation.onMutate` path, which patches `/api/event-requests/list` caches correctly.
3. Either keep it and document why inline scheduled edits need pre-response feedback, or delete the `onMutate` / rollback pair and rely on `applyEventRequestSaveToCache` in `onSuccess`.
4. Check no other file (search: `rg -n "setQueryData\(\[['\"]/api/event-requests['\"]" client/src`) still uses the old dead keys for event-request list data.

**Files:**
- `client/src/components/event-requests/hooks/useEventMutations.tsx` (lines around 354–400)
- Any per-card mutations that copied the pattern

**Prereqs:** Unit 1 must be shipped and stable for at least 3 days.

**Smoke test:**
- Inline-edit a field on a card. Save. Confirm no flicker, no visual regression.
- Confirm the UI doesn't get noticeably slower (the optimistic layer was supposed to provide instant feedback; Unit 1's surgical patches should serve the same role).

**Exit criteria:**
- No active event-request list optimistic update targets `['/api/event-requests']` or `['/api/event-requests', 'v2']`.
- The remaining inline scheduled edit path is intentionally either kept on correct `/list` keys or removed.
- No new "save feels slow" complaints in the week after.

**Estimated effort:** 1–2 hours. Mostly deletion.

**Risk:** low.

**Notes after shipping:**
- 2026-06-18 audit: old dead-key writes were not found in the active `useEventMutations` inline edit path; remaining optimistic patch targets `/api/event-requests/list` through `patchEventInListCaches`. Treat this unit as a small keep/delete decision, not a dead-key rewrite.

---

### Unit 3 — Strip the dead `_expectedVersion` client code (finishes #417)

**Closes:** the dead-code half of #4 (server-side gate already removed in PR #417)

**Status:** [x] Shipped / verified in code (2026-06-18 audit)

**Why now:** Server already ignores `_expectedVersion`. The three planned client sends have been removed/avoided: the main scheduling form no longer sends it, `useEventMutations` sends a clean payload, and `EventEditDialog` documents that client-side `_expectedVersion` is no longer sent. Keep the server strip as defensive cleanup so stale clients cannot write the field.

**Scope:**
1. Find every `_expectedVersion` in `client/src/`. ✅
2. Remove from `EventSchedulingForm.tsx`, `useEventMutations.tsx`, `EventEditDialog.tsx`. ✅
3. Leave only generic 409 handling if it can still be reached by a non-`_expectedVersion` server-side conflict guard; otherwise remove it during the next cleanup pass.

**Files:**
- `client/src/components/event-requests/EventSchedulingForm.tsx`
- `client/src/components/event-requests/hooks/useEventMutations.tsx`
- `client/src/components/event-requests/dialogs/EventEditDialog.tsx`

**Prereqs:** None. Independent of Units 1–2.

**Smoke test:**
- Save through `EventSchedulingForm`. Confirm save works.
- Save through `EventEditDialog` (driver-planning view). Confirm save works.
- Inline-edit via `useEventMutations`. Confirm save works.
- Verify the 409 error toast is no longer reachable (search and confirm no codepath calls it).

**Exit criteria:**
- No active client PATCH payload adds `_expectedVersion`. ✅
- Any remaining `_expectedVersion` references in `client/src/` are comments only, or are removed during cleanup.
- No `_expectedVersion`-specific 409 UI remains; generic conflict handling may stay if it documents a reachable non-version conflict.

**Estimated effort:** 30–60 minutes.

**Risk:** very low.

**Notes after shipping:**
- 2026-06-18 audit: `EventSchedulingForm` explicitly no longer sends `_expectedVersion`; `useEventMutations` strips legacy skip/version noise and sends a clean payload; `EventEditDialog` keeps only generic conflict UX and notes that client-side `_expectedVersion` is no longer sent.

---

### Unit 4 — Stop sync from bumping `updatedAt` on backfill-only writes (was §B8)

**Closes:** the "Sheets backfill rare 409" trigger in §1.2 #4

**Status:** [ ] Not started

**Why now:** With row-level locking removed (#417), this is no longer a *user-visible* 409 problem. But it's a future-proofing fix: if you ever want field-level locking back (for real multi-editor cases), the sync needs to mark its writes so they don't count as "another editor."

**Scope:**
1. Add a `lastSyncedFromSheets` or `syncedAt` column to `event_requests` (migration).
2. In `BackgroundSyncService` writes: set `syncedAt` instead of relying on `updatedAt`.
3. Optionally: have the sync's UPDATE statement explicitly NOT bump `updatedAt` when the only changes are backfill-only fields (message, raw row data).

**Files:**
- `migrations/<date>_add_synced_at_to_event_requests.sql`
- `server/background-sync-service.ts`
- `shared/schema.ts` (add column)

**Prereqs:** None for the migration. If you want field-level locking later, that's a separate unit.

**Smoke test:**
- Trigger a sync run (or wait for the cron). Verify `syncedAt` updates and `updatedAt` does NOT change for backfill-only writes.
- Confirm legitimate field changes by the sync (e.g., new event imported) still bump `updatedAt`.

**Exit criteria:**
- Sync writes that don't change user-editable fields no longer touch `updatedAt`.
- Future field-level locking would have a clean signal to distinguish human edits from sync writes.

**Estimated effort:** 2–3 hours.

**Risk:** low-medium (migration touches production table; run in dev first).

**Notes after shipping:**
_[fill in]_

---

### Unit 5 — Collapse the dialog flag mess into one `activeDialog` state (A1)

**Closes:** the visible side of #9 (god-context re-renders), part of UI chaos

**Status:** [x] Shipped 2026-06-24 — the 23 `showXDialog` booleans in `EventDialogContext`
collapsed into a single `activeDialog` discriminated union with `openDialog()` /
`closeDialog(only?)` actions. `closeDialog` takes an optional dialog name so
"open A, close B" sequences stay order-independent (closing B is a no-op once A
is open), preserving the old independent-boolean semantics. Per-dialog event
refs (`schedulingEventRequest`, etc.) intentionally stay separate — several are
shared across dialogs, so folding them into the union would duplicate, not
simplify. ~16 consumers migrated; net 0 new TypeScript errors; build green.
**Still requires manual dialog click-through in dev before merge.**

**Why now:** This is the biggest UI cleanup payoff. After Units 1–4 the engine is calm; now the orchestrator's 40+ boolean dialog flags become the main remaining source of "weird state" bugs. Collapse them.

**Scope:**
1. Define a discriminated union: `type ActiveDialog = { type: 'none' } | { type: 'scheduling'; request } | { type: 'toolkit'; request } | …`
2. In `EventRequestContext`, replace 40+ boolean flags with a single `activeDialog` state.
3. Update each dialog consumer to read from `activeDialog.type === 'scheduling'` etc. instead of separate booleans.
4. Update the orchestrator `index.tsx` (223 `ialog` substring matches) to use the new state.

**Files:**
- `client/src/components/event-requests/context/EventRequestContext.tsx` (state definition + reducer)
- `client/src/components/event-requests/index.tsx` (the orchestrator)
- All 12 dialog components in `client/src/components/event-requests/dialogs/`
- All callers that open dialogs

**Prereqs:** None mechanically, but easier if Unit 1 is done so the re-render storm doesn't mask state bugs during dev.

**Smoke test:**
- Open each dialog type from each entry point. Confirm it opens, saves, closes correctly.
- Open dialog A, close it, open dialog B. Confirm only B is visible.
- Try to open two dialogs at once (e.g., schedule + reschedule). Confirm the second one replaces the first cleanly.
- Confirm dialog state doesn't survive across event changes (open dialog on event 47, close, open same dialog on event 48 — should be fresh, not stale).

**Exit criteria:**
- `EventRequestContext` has one `activeDialog` field, not 40 booleans.
- No dialog consumer reads from multiple boolean flags to determine its open state.
- Orchestrator `index.tsx` shrinks meaningfully (target: under 1500 lines).

**Estimated effort:** 3–4 hours. Mechanical but touches many files.

**Risk:** medium. Touches many consumers; one wrong import == regression. Test every dialog before deploy.

**Notes after shipping:**
_[fill in]_

---

### Unit 6 — Fix the form initialization race (was A2)

**Closes:** the "form empty, save submitted empty" class of bugs

**Status:** [x] Shipped 2026-06-24 — Added an explicit `isFormLoading` derived
state (`!!eventRequest && !formInitialized`) and wired it into the Save button:
it is now **disabled and shows "Loading…"** until the edit form has populated
from the record, instead of letting the user click Save and bounce off a
"please wait" toast. The performSubmit guard remains as defense-in-depth (Enter
key / form submit). The raw `❌ [PROD DEBUG] console.error` was replaced with
`logger.error`. The underlying `formInitialized` flag was **kept** rather than
removed: it is still required by the autosave and localStorage-recovery effects
to avoid persisting an empty form before init, and the async two-phase load that
originally made it a *race* is already gone (Unit 7), so it no longer behaves as
the defensive band-aid the plan flagged. Build + undefined-refs gate green.

**Why now:** After Unit 1, the refetch storms that *cause* the race are mostly gone. But the defensive `formInitialized` flag and DEBUG logs are still there. Remove them properly.

**Scope:**
1. Audit the two-phase load in `EventSchedulingForm.tsx` (lines ~274–340).
2. Replace the `formInitialized` flag with an explicit loading state.
3. Show a skeleton/spinner until full record is loaded; do not allow Save until loaded.
4. Remove DEBUG console.logs.

**Files:**
- `client/src/components/event-requests/EventSchedulingForm.tsx`

**Prereqs:** Unit 1 (so refetches no longer interrupt the form mid-load).

**Smoke test:**
- Open form on slow connection (devtools throttling). Confirm spinner shows until ready, Save button disabled until then.
- Open form, immediately try to save. Confirm no empty save.
- Trigger a save from another tab while form is open. Confirm form does not reset (this is the Unit 1 fix; verify it).

**Exit criteria:**
- No `formInitialized` flag remains.
- No DEBUG logs in `EventSchedulingForm`.
- Form save button is disabled when form is not ready.

**Estimated effort:** 1–2 hours.

**Risk:** low.

**Notes after shipping:**
_[fill in]_

---

### Unit 7 — Collapse partial/full payload split (was B9, the big one)

**Closes:** #5 (LIGHTWEIGHT contract), reduces #7 (silent field drops)

**Status:** [x] Shipped 2026-06-19

**Why now:** This is the biggest structural simplification remaining. After Units 1–6 the engine is calm and the UI is sane. Now address the dual-shape data problem.

**Scope:** Pick one of two approaches.

**Approach A — Single read shape (recommended for solo dev):**
1. Make `/api/event-requests/list` return the full record for every event.
2. Delete the `LIGHTWEIGHT FIELD CONTRACT` comment block and its hand-maintained field list.
3. Remove the second fetch in `EventSchedulingForm` (the `['/api/event-requests', id, 'full']` query).
4. Accept the larger list payload — at your scale (~1147 records) this is still small (~500KB to ~2MB).
5. Verify performance is acceptable (the `EVENT_REQUESTS_PERFORMANCE_PLAN` work bought enough headroom).

**Approach B — Generate the contract from one source:**
1. Define a TypeScript constant `LIST_FIELDS = ['id', 'organizationName', ...]` in shared code.
2. Server reads from this constant when building `/list` response.
3. Card components use this constant via a type alias.
4. CI check: card types must only use fields in `LIST_FIELDS`.

**Files (Approach A):**
- `server/routes/event-requests-legacy.ts` (around line 1248–1268 — remove the contract comments and the field-selection logic)
- `client/src/components/event-requests/EventSchedulingForm.tsx` (remove second fetch)
- All card components (verify they handle additional fields harmlessly)

**Prereqs:** Unit 1 (surgical cache) and Unit 5 (dialog cleanup) shipped and stable.

**Smoke test:**
- Open every card type. Confirm no missing data.
- Open edit form. Confirm full data present immediately (no two-phase loading).
- Save through every flow. Confirm `_droppedFields` metadata is empty in responses.
- Watch list response size — confirm acceptable.

**Exit criteria:**
- LIGHTWEIGHT contract comment block is deleted.
- `EventSchedulingForm` has one data source, not two.
- `_droppedFields` is empty for all normal save paths.

**Estimated effort:** 4–6 hours.

**Risk:** medium. Larger payloads could slow list load; mitigate by measuring before/after. Cards may have edge-case logic depending on field-absent vs field-empty.

**Notes after shipping:**
- 2026-06-19: `/api/event-requests/list` now returns the full event records directly. Removed `shared/event-list-projection.ts`, deleted the legacy lightweight field-contract comment block, removed the second full-record fetch from `EventSchedulingForm`, and simplified form initialization to one server baseline.

---

### Unit 8 — Retire `EventEditDialog` (was B10)

**Closes:** #6 (two edit paths)

**Status:** [WON'T DO] — reclassified 2026-06-25 after a code audit. See decision below.

**Decision (2026-06-25): do not unify; the divergence is justified.**
An audit found `EventEditDialog` is **not** a redundant copy of `EventSchedulingForm`:
- It is a *focused driver-planning editor* with three tabs — Logistics, Staffing, and **Activity (audit log)** — plus an inline people-search assignment UI for drivers/speakers/volunteers.
- It does a **diff-based partial PATCH** (sends only changed fields, e.g. `assignedDriverIds`) and already uses the Unit-1 surgical cache (`applyPatchResponseToCache`).
- It operates directly on the **partial `EventMapData`** the map/driver-planning page already has — it never needs the full record.

`EventSchedulingForm`, by contrast, is the full-form scheduler: it requires the **full** event record and writes the *entire* form on save. There is **no `GET /api/event-requests/:id`** endpoint, so driving it from driver-planning would require adding a full-record fetch first, and would replace driver-planning's focused logistics/assignment workflow with the large scheduling form — a real UX regression for that page, for no correctness gain. The original "two edit paths" worry (#6) was about *divergent PATCH/cache/error handling causing inconsistency*; that no longer applies here, since `EventEditDialog` already shares the surgical-cache write path. Leaving both as distinct, purpose-built tools is the right call. If they ever drift, prefer extracting shared field-mapping/assignment helpers over forcing one dialog onto the other.

**Why now (historical):** With Unit 7 done, both edit dialogs read the same data shape. Now make them share save logic too — or delete one.

**Scope:**
1. Audit what `EventEditDialog` does that `EventSchedulingForm` doesn't (driver-planning–specific assignments).
2. Either:
   - Make `EventEditDialog` a thin wrapper around `EventSchedulingForm` with driver-planning–specific props, OR
   - Add a "driver-planning mode" to `EventSchedulingForm` and delete `EventEditDialog`.
3. Update driver-planning to use the unified dialog.

**Files:**
- `client/src/components/event-requests/dialogs/EventEditDialog.tsx` (delete or shrink)
- `client/src/pages/driver-planning.tsx` (update consumer)
- `client/src/components/event-requests/EventSchedulingForm.tsx` (add mode prop if needed)

**Prereqs:** Unit 7 (single read shape) shipped.

**Smoke test:**
- Edit an event from event-requests view. Save.
- Edit the same event from driver-planning view. Confirm same fields, same save behavior, same UI.
- Confirm driver-planning–specific features (driver assignment etc.) still work.

**Exit criteria:**
- One edit dialog in the codebase, not two.
- Driver-planning edits and event-management edits produce identical PATCH payloads.

**Estimated effort:** 3–4 hours.

**Risk:** medium. Driver-planning users may notice UI differences.

**Notes after shipping:**
_[fill in]_

---

### Unit 9 — Consolidate the 8 status-change paths (was B11)

**Closes:** #10 (eight status-change paths)

**Status:** [ ] Not started

**Why now:** With Units 1, 5, 7, 8 done, the rest of the orchestration is sane. The eight separate status-change codepaths are the last structural mess.

**Scope:**
1. Inventory every place a status PATCH is sent (QuickScheduleButton, dialog Save buttons, inline status pills, bulk actions, etc.).
2. Define one `changeStatus(eventId, newStatus, reason?)` helper in `useEventMutations`.
3. Replace all eight callsites with the helper.
4. Delete `QuickScheduleButton` if it has no remaining unique behavior (it was a "confession in code" — symptom of the broken main path).

**Files:**
- `client/src/components/event-requests/hooks/useEventMutations.tsx` (new helper)
- All eight status-change callsites
- `client/src/components/event-requests/QuickScheduleButton.tsx` (audit / delete)

**Prereqs:** Units 1, 5, 7. Status changes touch cache invalidation, dialog state, and full-record data.

**Smoke test:**
- Change status from every entry point (each card, each tab, each dialog).
- Confirm same PATCH payload shape, same UI feedback, same audit log entries.
- Verify status-count cache updates correctly via Unit 1's surgical patches.

**Exit criteria:**
- Grep for direct status PATCHes returns one helper, called from many places.
- `QuickScheduleButton` is gone or has a documented reason to exist.

**Estimated effort:** 3–4 hours.

**Risk:** medium. Status changes touch a lot of workflow logic; reason dialogs (cancelled/declined) must still work.

**Notes after shipping:**
_[fill in]_

---

### Unit 10 — Status-change reason dialogs (carried from v1 plan)

**Closes:** TODO at line 1617 (cancelled / declined / postponed need reasons)

**Status:** [ ] Not started

**Why now:** Natural extension of Unit 9. The unified status helper from Unit 9 should accept an optional reason; this unit wires up the dialogs that collect it.

**Scope:**
1. For statuses `cancelled`, `declined`, `postponed` (and any others that need explanation), open a dialog before submitting the change.
2. Dialog collects reason text.
3. Reason is appended to event audit log and stored on the event record.

**Files:**
- `client/src/components/event-requests/dialogs/StatusReasonDialog.tsx` (already exists — wire it up)
- `client/src/components/event-requests/hooks/useEventMutations.tsx` (extend `changeStatus` from Unit 9)

**Prereqs:** Unit 9.

**Smoke test:**
- Change status to cancelled. Confirm dialog appears, reason is required.
- Confirm reason persists in audit log.
- Try to cancel without reason. Confirm save is blocked.

**Exit criteria:**
- The TODO comment at line 1617 is deleted.
- Cancelled/declined/postponed cannot be set without a reason.

**Estimated effort:** 1–2 hours.

**Risk:** low.

**Notes after shipping:**
_[fill in]_

---

### Unit 11 — Extract CRUD from the legacy monolith (was Phase C, the long-haul one)

**Closes:** #8 (5,166-line legacy file)

**Status:** [ ] Not started

**Why now:** This is the last big structural item, and the lowest-payoff per hour. Do it only if you intend to keep maintaining this codebase for years. Skip if Units 1–10 have made daily work tolerable and you don't anticipate major future work here.

**Scope:**
1. Identify the main `PATCH /:id` handler in `event-requests-legacy.ts` (lines ~2584–3145).
2. Extract into a new sub-router `server/routes/event-requests/crud.ts` (matching the pattern of the already-extracted sub-routers).
3. Move the field transformation pipeline, dropped-fields tracking, audit logging into focused helpers.
4. Migrate the smaller endpoints (GET /:id, DELETE /:id) similarly.
5. Once `event-requests-legacy.ts` is empty of real logic, delete it.

**Files:**
- `server/routes/event-requests/crud.ts` (new)
- `server/routes/event-requests/index.ts` (mount the new router)
- `server/routes/event-requests-legacy.ts` (shrink and eventually delete)

**Prereqs:** Units 1, 7, 9 should be done — they remove client-side workarounds that the legacy file's quirks justified.

**Smoke test:**
- Every PATCH endpoint that existed before still works.
- Every GET, POST, DELETE endpoint still works.
- Audit logs still generate.
- Optimistic locking (if you re-add field-level later) still hooks in correctly.

**Exit criteria:**
- `server/routes/event-requests-legacy.ts` is deleted.
- All CRUD logic lives in focused sub-router files under 500 lines each.

**Estimated effort:** 8–12 hours, spread across multiple sessions. The slow part is making sure no edge case in the field-transformation pipeline gets lost.

**Risk:** high. This touches the central save path of the entire feature. Sit-and-watch every deploy. Do not skip the concurrency tests.

**Notes after shipping:**
_[fill in]_

---

### Unit 12 — Cleanup sweep

**Closes:** the remaining items from v1 plan (DEBUG logs, type safety, network timeouts, etc.)

**Status:** [ ] Not started

**Why now:** Last. By now the engine and UI are both clean; this is polish.

**Scope:**
- Delete all remaining DEBUG console.logs throughout event-requests files.
- Tighten error types (replace `any` with proper types).
- Add 30-second mutation timeouts with user-friendly messages.
- Hide remaining List 3 items (real-time socket UI updates for other users' edits, field-level collaboration locks, traffic-conflict badges, corporate escalation SMS).
- After 60 days of List 3 items being hidden with no complaints: delete them.
- Move calendars nav under communication (already done — confirm).

**Files:** Wide sweep across `client/src/components/event-requests/`.

**Prereqs:** All prior units.

**Smoke test:**
- Confirm no DEBUG output in production console.
- Confirm error messages are user-friendly.
- Confirm hidden List 3 features are no longer in the UI.

**Exit criteria:**
- This list is exhausted.
- §1.2 has no open bugs.

**Estimated effort:** 4–8 hours, spread across sessions.

**Risk:** low.

**Notes after shipping:**
_[fill in]_

---

### Total estimate

| Unit | Effort | Cumulative | Cumulative engine improvement |
|---|---|---|---|
| 1 — Surgical cache | 4–6h | 6h | Massive — closes the loudest bug |
| 2 — Optimistic keep/delete | 1–2h | 8h | Cleanup / decision |
| 3 — Strip `_expectedVersion` client code | 30–60m | 9h | Cleanup |
| 4 — Sync `updatedAt` fix | 2–3h | 12h | Future-proofing |
| 5 — Dialog state collapse | 3–4h | 16h | Visible UI calm |
| 6 — Form init race | 1–2h | 18h | Closes a complaint class |
| 7 — Partial/full collapse | 4–6h | 24h | Structural simplification |
| 8 — Retire EventEditDialog | 3–4h | 28h | Structural simplification |
| 9 — Consolidate status paths | 3–4h | 32h | Structural simplification |
| 10 — Reason dialogs | 1–2h | 34h | Quality of life |
| 11 — Extract legacy monolith | 8–12h | 46h | Long-term maintainability |
| 12 — Cleanup sweep | 4–8h | 54h | Polish |

**~50 hours of focused work, spread across as many sessions as you need.**

If you do one unit per week, that's 12 weeks. If you do one per month, that's a year. Either pace closes out the architecture properly without burning anyone out.

---

### Status board (update as you go)

| Unit | Status | Shipped date | Notes |
|---|---|---|---|
| 1 — Surgical cache | [x] | 2026-06-18 | Implemented in `queryClient.ts`; production smoke still called out in §1.5. |
| 2 — Optimistic keep/delete | [x] | 2026-06-25 | Audit confirmed no dead-key writes remain (the only `['/api/event-requests', id]` write is the by-id cache helper, not the dead list key). Decision: **KEEP** the one inline scheduled-field optimistic patch — correct-key, cancels in-flight fetches, snapshots + rolls back, and gives inline cell edits pre-response feedback. Documented in code at `updateScheduledFieldMutation.onMutate`. |
| 3 — Strip `_expectedVersion` | [x] | 2026-06-18 audit | Client sends removed/avoided; server strip remains defensive. |
| 4 — Sync `updatedAt` fix | [ ] | | |
| 5 — Dialog state collapse | [x] | 2026-06-24 | 23 `showXDialog` booleans → one `activeDialog` discriminated union + `openDialog`/`closeDialog` in `EventDialogContext`; ~16 consumers migrated. Type-clean (net 0 new tsc errors) + build green. **Manual click-through of every dialog still pending in dev.** |
| 6 — Form init race | [x] | 2026-06-24 | Explicit `isFormLoading` state; Save button disabled + "Loading…" until the edit form populates (was click-then-toast); raw `[PROD DEBUG] console.error` → `logger.error`. Underlying `formInitialized` init-tracking kept (still used by autosave/localStorage effects; async-load cause already gone via Unit 7). Build + undefined-refs green. |
| 7 — Partial/full collapse | [x] | 2026-06-19 | `/list` returns full records; form second fetch removed; lightweight projection deleted. |
| 8 — Retire EventEditDialog | [WON'T DO] | 2026-06-25 | Reclassified after audit: `EventEditDialog` is **not a redundant duplicate** — it's a focused driver-planning editor (Logistics/Staffing/Activity-audit tabs, inline people-search assignment UI, diff-based partial PATCH off partial `EventMapData`, already on Unit-1 surgical cache). `EventSchedulingForm` is the full-form scheduler needing the full record (no `GET /:id` exists). Unifying would replace driver-planning's focused UX with the big form for no correctness gain. Divergence is justified; see §Unit 8 note. |
| 9 — Consolidate status paths | [ ] | | |
| 10 — Reason dialogs | [ ] | | |
| 11 — Extract legacy monolith | [ ] | | |
| 12 — Cleanup sweep | [ ] | | |

When a unit ships, mark `[x]`, fill in the date, and write a one-line note. Future-you (or whoever picks this up) will be grateful.
