# Minimum Event Management — Scope & Sequencing Map

**Purpose:** decide what to *keep visible and invest in* vs. what to *freeze, hide, or remove later* in the event management feature — so we make the small core boringly reliable instead of stacking more layers on top.

**Status:** Planning only. No code has been changed by this document.

**Context:** Event management is, at its heart, a small workflow:
**Google Sheet intake → someone enriches the event → it moves through statuses.**
That core = *one list, one form, one save path, one sync job*. Almost everything else is "enterprise-app" machinery that got added on top of a CRUD screen that never got a clean first version. The pain ("simple thing, keeps breaking") comes from the simple path sharing a codebase with realtime sync, multiple save paths, AI, and defensive recovery code.

Related doc: `EVENT_REQUESTS_RELIABILITY_PLAN.md` (older, fix-list framing — partially stale).

---

## PART 1 — Fix the core FIRST (do these before anything else)

These are the three real, confirmed daily failures. Make these boring and reliable before touching scope.

### Bug #1 — "It erased what I typed"
- **What happens:** a background refresh reloads the open scheduling form and favors the server's copy over your unsaved typing.
- **Root cause:** the form re-initialization/merge logic re-runs on *any* refetch and prefers server data (`EventSchedulingForm.tsx`, the re-init `useEffect` + `intelligentMergeFormData`).
- **Already shipped (partial):** a tab now ignores the echo of its *own* save (`X-Socket-Id` → `originSocketId`, in `apiRequest`, `useEventRequestSocket`, server `event-requests/index.ts`). This reduces self-inflicted refetches but does **not** fix the root cause — refreshes from other users, the background Sheets sync, the 60s auto-refresh, and window-focus refetch can still clobber an open form.
- **Real fix:** guard the form so it will not overwrite fields the user has touched while the form is open, regardless of what triggered the refresh.

### Bug #2 — "Someone else edited this" (when nobody did)
- **What happens:** a normal save is blocked by a false 409 conflict.
- **Root cause:** optimistic locking uses the event's `updatedAt` as the version stamp, and the background Google Sheets sync bumps `updatedAt` (e.g. message backfill) without a human editing anything (`server/google-sheets-event-requests-sync.ts`, `server/routes/event-requests-legacy.ts` PATCH version check).
- **Real fix:** stop automated background writes from bumping the version stamp (and/or skip rows a human edited recently). Smallest, lowest-risk of the three.

### Bug #3 — "Saved!" but a field is wrong
- **Two causes:**
  1. Change-detection drops a field it wrongly judges "unchanged" (`detectChangedFields` + `ALWAYS_INCLUDE_FIELDS` in `form-utils.ts`).
  2. The lightweight list view is built from a hand-maintained field allow-list, so a newer field saves to the database but never shows in the cards (`/api/event-requests/list` mapper in `event-requests-legacy.ts`).
- **Real fix:** tighten change-detection so real edits stop getting dropped, and ensure any field a card shows is in the list mapper. (Keep the existing save-verification warning until this is solid.)

---

## PART 2 — The map

### ✅ KEEP — the core, invest here
| Item | Where | Note |
|------|-------|------|
| One list by status | cards + status tabs | The home screen for intake staff |
| **One** edit form | `EventSchedulingForm.tsx` | Pick this as the single edit UI |
| One save path | converge toward a single `saveEvent` | Today there are ~17 save call-sites |
| Google Sheets intake sync | `google-sheets-event-requests-sync.ts` | **The front door — non-negotiable** |
| Status changes that stick | PATCH `/api/event-requests/:id` | Core workflow |
| Basic enrich: driver/speaker, toolkit sent, log contact | `useEventMutations` | Real day-to-day needs |

### 🧊 FREEZE — no new work (leave as-is, don't extend)
| Item | Where | Why freeze |
|------|-------|-----------|
| Second edit dialog | `dialogs/EventEditDialog.tsx` (used in driver-planning) | Duplicate of the scheduling form; converge later, don't grow |
| New realtime/invalidation layers | `useEventRequestSocket`, `invalidateEventRequestQueries` | Stop adding band-aids on top |
| New AI surfaces | `ai-intake-assistant/`, `AiIntakeAssistantDialog.tsx` | Nice later; not core to "does it save?" |
| New views / extra tabs | various | One good list + form is enough for now |

### 😴 DEFER — turn down / hide until the core is solid (mind the couplings)
| Item | Where | Caution |
|------|-------|---------|
| Field-level locking + presence on the form | `EventSchedulingForm.tsx`, `NotesSection`, `TspContactSection`, `fieldConfig.ts` | Rarely two people on the same field; safe to quiet down |
| Realtime socket sync | `useEventRequestSocket`, server broadcast | ⚠️ **Load-bearing** — also keeps the Volunteer Hub fresh and powers the "new event from Sheets" alert. Calm it, don't hard-kill it. |
| Call-notes scratchpad 5s auto-save | `CallNotesScratchpadDialog.tsx` | Band-aid for save/refetch chaos; retire once the form is stable |
| Scary 409 conflict toasts | PATCH version check | Soften to a light check after Bug #2's sync fix lands |
| Extra admin map/calendar variants | various | But **KEEP** the volunteer calendar + driver map — different audiences (see below) |
| Corporate escalation SMS, traffic-conflict badges | notifications, `shared/traffic-conflicts.ts` | Operational polish, not foundation |

### 🗑️ DELETE LATER — only after the core is proven reliable (~a calm week in dev)
| Item | Where | Why it's safe only after core is solid |
|------|-------|----------------------------------------|
| Emergency "quick schedule" workaround | `QuickScheduleButton.tsx` (self-described "emergency workaround… bypasses the full form") | It only exists because the normal path was unreliable |
| Duplicate save paths | ~17 PATCH call-sites | Consolidate toward one `saveEvent` |
| Dead optimistic-update code on unused cache keys | various | Adds confusion, no benefit |
| Defensive save-verification / merge scaffolding | `event-save-verification.ts`, merge logic | **Only remove AFTER Bug #3 root cause is fixed** — it's currently catching real data loss |
| The second edit dialog | `EventEditDialog.tsx` | After converging onto the single form |

---

## PART 3 — Coupling cheat-sheet (what's safe vs risky to touch)

- **Non-negotiable:** Google Sheets intake sync — it's how events enter the system.
- **Handle with care (wired to the volunteer-facing side):** realtime invalidation. Project rule: *any* event mutation must refresh **both** `/api/event-requests*` and `/api/volunteer-hub*` caches, or volunteer-facing role needs go stale.
- **Don't remove before fixing the root cause:** save-verification / partial-save warning — it's the net currently catching dropped fields (e.g. the van-driver flags).
- **Genuinely separate audiences, keep both:** the **volunteer calendar** (volunteers sign up) and the **driver map** (route planning) are *not* redundant views of the same data.
- **Safe to quiet/hide:** field locks, presence, collaboration, extra admin tabs.

---

## PART 4 — Suggested order

1. **Bug #2** — stop background sync bumping the version stamp (smallest, lowest risk).
2. **Bug #1 root cause** — guard the form from overwriting touched fields on any refresh.
3. **Bug #3** — fix change-detection drops + list-mapper gaps.
4. **Freeze** everything in the FREEZE list — no new layers while the core stabilizes.
5. Once saves + status changes are boring for ~a week in dev: **converge to one edit UI + one save path**.
6. Then, and only then: **delete** the scaffolding and workarounds in the DELETE-LATER list.

Each step is testable in dev before publishing, and every step is reversible via checkpoints.
