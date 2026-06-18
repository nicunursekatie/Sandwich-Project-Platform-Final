---
name: Event management strategy
description: Authoritative plan pointer + verified diagnosis for the event-requests reliability work (root causes, fix order, couplings).
---

**Source of truth:** `EVENT_REQUESTS_RELIABILITY_PLAN_V2.md` (repo root) — code-verified with file/line citations + a production audit. Trust it over older framing. It supersedes the v1 `EVENT_REQUESTS_RELIABILITY_PLAN.md` (kept only as history); the earlier `EVENT_MANAGEMENT_MINIMUM_MAP.md` was deleted as redundant/partly inaccurate.

**Strategy:** event intake is a small CRUD workflow (Sheets import → human enriches → status moves) buried under enterprise machinery. Shrink the critical path; stop adding defensive layers. Phase A = safe UI cleanup; Phase B = engine room; Phase C = delete dead/hidden code.

**Verified root causes (NOT timers — I misdiagnosed this earlier):**
- "Erased my edits" = the sledgehammer `invalidateEventRequestQueries` force-refetches ALL event + volunteer-hub + event-map queries on every save (and on other users'/processes' socket events) while a form is open. Real fix = B1 surgical, by-ID cache patching. There is NO 60s polling and `refetchOnWindowFocus: false`; form re-init is guarded by `formInitSessionRef`. So it is NOT timers / window-focus / blind re-init.
- False 409 = row-level `_expectedVersion` vs `updatedAt`. Production audit (0 message-only PATCHs in 90 days) showed the dominant solo trigger was the Call Notes Scratchpad — now DELETED and DEPLOYED (2026-06-18). Remaining: two-tab/double-save (now #1), rare Sheets message-backfill, real co-edit. Do NOT remove `_expectedVersion`; fix triggers (e.g. don't bump `updatedAt` on backfill-only writes).
- "Saved but wrong field" = partial/full payload split (cards read lightweight `/list`; form fetches full `/:id`) + silent `_droppedFields`. Keep `event-save-verification.ts` until the PATCH pipeline is fixed.
- Optimistic updates are DEAD CODE: list reads `['/api/event-requests/list', …, 'v3']` but optimistic writes hit `['/api/event-requests']` / `[…,'v2']` — keys never overlap. Delete after B1/B2.

**Couplings (don't "just remove"):**
- Surgical invalidation (B1) must still refresh `/api/volunteer-hub/*` + `/api/event-map` when hub-affecting fields change (showOnVolunteerHub, dates, staffing). Project rule: event mutations invalidate BOTH `/api/event-requests*` and `/api/volunteer-hub*`.
- Google Sheets intake sync = the front door (non-negotiable).
- Two edit paths: `EventSchedulingForm` (primary) + `EventEditDialog` (driver-planning) — converge in B6.
- ~8 status-change paths; `QuickScheduleButton` is a self-described emergency workaround (hide once main path is trusted).

**Why:** recurring user pain "simple thing keeps breaking" = the simple path shares a codebase with realtime sync, ~18 PATCH endpoints, dead optimistic code, two edit UIs, AI, and stacked defensive layers. Adding safeguards makes it worse.

**How to apply:** follow v2's Phase A → B → C order. Highest-payoff engine fix now is B1 (surgical cache invalidation). Reproduce each race deliberately (two windows/two users) before declaring it fixed.
