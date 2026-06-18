---
name: Event management strategy
description: How to approach fixing the event-management feature — phase-mismatch CRUD, the 3 core bugs, fix order, and couplings that make removal dangerous.
---

**Rule:** Treat event management as a small CRUD workflow (Google Sheet intake → enrich → status moves) buried under enterprise machinery. Fix the 3 core reliability bugs first, freeze new layers, defer realtime/locks, and delete scaffolding only after the core is solid. Do NOT add more safeguards.

**The 3 core bugs:**
1. Open form gets clobbered by a background refetch because the scheduling form's re-init/merge favors server data on ANY refetch. The shipped `X-Socket-Id`→`originSocketId` self-echo suppression only removes the tab's *own* echo — it is a PARTIAL fix; other users, the background Sheets sync, the 60s auto-refresh, and window-focus refetch still clobber. Real fix = guard the form from overwriting fields the user has touched.
2. False 409 "someone else edited this" because the background Google Sheets sync bumps `event_requests.updatedAt` (the optimistic-lock version stamp) without a human editing. Real fix = stop automated writes from bumping the stamp / skip recently human-edited rows.
3. Silent dropped fields from over-strict change-detection (`detectChangedFields`/`ALWAYS_INCLUDE_FIELDS`) plus the hand-maintained `/api/event-requests/list` allow-list mapper (new DB column saves but never shows in cards).

**Couplings that make "just remove it" dangerous:**
- Realtime invalidation is load-bearing — also feeds Volunteer Hub freshness + the "new from Sheets" toast. Project rule: every event mutation must invalidate BOTH `/api/event-requests*` and `/api/volunteer-hub*`.
- Save-verification (`event-save-verification.ts`) is currently catching real data loss — do NOT remove before fixing bug #3's root cause.
- Google Sheets intake sync is the front door — non-negotiable.
- Volunteer calendar and driver map serve different audiences — not redundant views.

**Why:** the user's recurring pain is "simple thing keeps breaking"; the cause is the simple path sharing a codebase with realtime sync, ~17 save call-sites, two edit UIs (`EventEditDialog` + `EventSchedulingForm`), AI intake, and defensive recovery code. More safeguards make it worse; shrinking + stabilizing the core is the fix.

**How to apply:** see `EVENT_MANAGEMENT_MINIMUM_MAP.md` (repo root) for the Keep/Freeze/Defer/Delete map. Order: bug #2 (smallest), then #1 root cause, then #3, then freeze, then converge to one edit UI + one save path, then delete scaffolding/workarounds.
