# Event Request Save Path — Consolidation Spec

**Goal:** collapse the event-request save path onto **one serialization contract** and **one validation contract**, shared by client and server, without a big-bang rewrite. Each step below ships and is verifiable on its own.

**Non-goal:** rebuilding the event-requests feature. This is scoped to *how an edit becomes a persisted PATCH* — nothing about lists, cards, filters, or analytics.

---

## 1. Why (current state)

Editing an event request today flows through **three independent, hand-maintained layers**, none of which share a definition of "what a valid update looks like."

### 1a. Two client serializers
| Surface | File | How it builds the PATCH body |
|---|---|---|
| Main editor | `EventSchedulingForm.tsx` → `buildEventDataForServer()` (`form-utils.ts`) | Maps a ~70-field `EventFormData` to server fields; **diff-based** since PR #462 (re-serialize the original snapshot, drop unchanged keys). |
| Driver-planning editor | `dialogs/EventEditDialog.tsx` | Hand-rolls an `updates` object, field-by-field, with its own change detection. |

Plus many narrow mutation callsites (`useEventMutations`, inline card edits, quick toggles) that PATCH `/api/event-requests/:id` directly.

**Problem:** the two editors don't share the field→server mapping. A mapping fix in one isn't a fix in the other; a new column must be wired into both. PR #462 made them *behave* the same (both diff-based) but left the duplication.

### 1b. Server does no schema validation on PATCH
`server/routes/event-requests-legacy.ts` PATCH `/:id` (~L2491–3090) takes `req.body` and processes it **imperatively**: date parsing, status-transition checks, reason requirements, auto-confirm, toolkit side-effects, needs-count auto-adjust, corporate-priority gate, geocoding, and a `_droppedFields` accumulator for fields it silently skips. There is **no Zod parse of the body** — invalid shapes either throw a blanket 500 or get silently dropped.

### 1c. Validation lives in three styles
- **Main form:** imperative `if (...) { toast(); return; }` blockers in `performSubmit`. No Zod.
- **Side dialogs** (`NonEventDialog`, `StatusReasonDialog`, `DuplicateEventDialog`): `react-hook-form` + `zodResolver`.
- **Server:** imperative checks.

### 1d. What already exists to build on
- `insertEventRequestSchema` (`shared/schema.ts:3074`) — `createInsertSchema(eventRequests)` with `.omit/.extend`, email/phone trims + refines, date unions. **Create-only today.**
- `shared/event-status-workflow.ts` — `isValidTransition`, `requiresReason`, `getScheduledDateDefault`, etc. (the state machine is already shared and pure).
- `client/src/lib/event-save-verification.ts` — `_droppedFields` is the authoritative "partial save" signal; `findMismatchedSavedFields` is explicitly a *heuristic* (server legitimately transforms fields, so mismatches ≠ failures).
- DB layer `updateEventRequest` now uses `UPDATE … RETURNING` as the authoritative post-write state (PR #463).

---

## 2. Target architecture

```
                 ┌─────────────────────────────────────────────┐
                 │  shared/event-request-patch.ts               │
                 │                                              │
                 │  eventRequestPatchSchema   (Zod, partial)    │  ← ONE shape/validation contract
                 │  diffEventPatch(current, baseline)           │  ← ONE diff util
                 │  type EventRequestPatch = z.infer<…>         │
                 └───────────────┬──────────────────────────────┘
                                 │ imported by both sides
        ┌────────────────────────┼─────────────────────────────┐
        │ CLIENT                  │                    SERVER    │
        │                         │                              │
  buildEventPatch(formData)  ─────┤   PATCH /:id:                │
   (the ONE serializer, used by   │     1. eventRequestPatchSchema.safeParse(body)
    BOTH dialogs)                 │        → 400 w/ field errors on shape failure
        │                         │     2. applyEventRequestTransition(original, patch)
   react-hook-form + zodResolver  │        (ONE pure fn: transitions, reason,
   (schema-driven inline errors,  │         auto-confirm, needs auto-adjust, defaults)
    replaces imperative blockers) │     3. storage.updateEventRequest(id, resolved)
        │                         │        (RETURNING-authoritative — already done)
        └─────────────────────────┴─────────────────────────────┘
```

Three shared primitives, one canonical UI contract:

### 2a. `eventRequestPatchSchema` — the shape/validation contract
- Derive from `insertEventRequestSchema.partial()` so it **tracks the table** (no hand-listed column set to drift).
- Fold in the coercions currently scattered across `buildEventDataForServer` and the server handler:
  - date strings → Date (the `parseDateOnly`/local-noon rule, so no UTC day-shift);
  - `hasRefrigeration` `'true'|'false'|''` → `boolean|null`;
  - needs counts → `parseInt`-coerced non-negative ints;
  - `sandwichTypes` array ↔ JSON;
  - email/phone trim+refine (already present).
- **Coerce, don't reject**, for anything the server legitimately transforms. Only reject genuinely malformed shapes (bad email, non-numeric count, unparseable date) — those become explicit field errors instead of silent `_droppedFields`.
- Self-contained cross-field rules via `.superRefine()` (e.g. range `min ≤ max`; `standbyExpectedDate` required when `status==='standby'`).
- Rules that need the **prior DB state** (valid transition, reason-required, scheduled-date default) do **not** go here — they belong in 2c.

### 2b. `buildEventPatch()` — the one serializer
- Promote `buildEventDataForServer` to the single form→patch function (move to `shared/` or keep in `form-utils` and import server-side is not needed — server takes the already-serialized body).
- `EventEditDialog` **deletes its hand-rolled diff** and calls `buildEventPatch` + `diffEventPatch`.
- `diffEventPatch(current, baseline)` extracts the "re-serialize baseline, drop unchanged keys" logic from PR #462 so both dialogs share the exact diff semantics.

### 2c. `applyEventRequestTransition(original, patch)` — the one state-transition fn
- A pure function (extends `event-status-workflow.ts`) that takes the stored record + the parsed patch and returns `{ resolvedPatch, errors }`, centralizing everything the server handler does imperatively today: transition validity, reason requirement, `statusChangedAt`, scheduled-date default, auto-confirm, `showOnVolunteerHub` on scheduling, toolkit auto-assign/attempt, needs-count auto-adjust, corporate-priority gate.
- Server calls it; the client *may* call it read-only to preview side-effects (e.g. "saving will also confirm the date"), but that's optional.

### 2d. Canonical UI
- **`EventSchedulingForm` is canonical** (richer, primary). Two viable end states — pick one:
  - **(Recommended, lower risk) Shared contract, two thin UIs:** keep both dialogs but both consume `buildEventPatch` + `eventRequestPatchSchema`. Eliminates the duplication that matters (serialization + validation) while leaving the driver-planning UI as-is.
  - **(Higher effort) One component:** driver-planning renders `EventSchedulingForm` in a compact mode; delete `EventEditDialog`. Do this only if the two UIs are close enough that one component cleanly serves both.

### 2e. Validation UX
- Replace the main form's imperative `if/return + toast` blockers with `zodResolver(eventRequestPatchSchema)` via `react-hook-form`, rendering errors **inline at the field**. This also structurally ends the "ghost popup then form resets" class (no more nested error/confirmation dialogs racing the non-modal parent).

---

## 3. Migration plan (each PR independently shippable + verifiable)

| PR | Scope | Verify |
|---|---|---|
| **A** | Add `eventRequestPatchSchema` in `shared/`. Server PATCH `safeParse`s the body and **logs** shape violations without rejecting (shadow mode, env-flagged via `EVENT_PATCH_SHADOW_VALIDATION`). `diffEventPatch` is deferred to PR-D so it lands with its consumer (no unused code). | No legit save changes behavior; logs show which real payloads would fail so the schema can be tightened safely. |
| **B** | Extract `applyEventRequestTransition` from the imperative handler; server uses it. Add unit tests (extend `__tests__/mark-scheduled-save.test.ts`). | Existing save flows unchanged; new tests green. |
| **C** | Flip PR-A validation from shadow → enforced: shape errors return `400` with field-level messages instead of silent `_droppedFields`. | Manually drive an invalid field; confirm inline error, not a swallowed drop. |
| **D** | Extract `diffEventPatch` (from PR #462's inline diff logic) into `shared/`, then switch `EventEditDialog` to `buildEventPatch` + `diffEventPatch`; delete its hand-rolled diff. | Driver-planning edit saves identically; diff-based (no clobber). |
| **E** | Main form validation → `zodResolver` inline errors; remove imperative blockers + nested error dialogs. | The conditional rules render inline; ghost-reset path gone. |
| **F** *(optional)* | Collapse to one canonical dialog component. | Both entry points save through one component. |

---

## 4. Risks & guardrails

- **Over-rejection breaks saves.** The server does many legitimate transforms; a strict schema that rejects them would reintroduce "refusing to save." Mitigation: derive from `createInsertSchema` (tracks columns), **coerce not reject**, and ship PR-A in shadow/log mode first to catch real payloads before enforcing.
- **Missing a column → silent drop.** Because the schema is derived from the table, new columns are covered automatically; don't hand-maintain an allowlist.
- **Keep the safety nets during migration:** `_droppedFields` surfacing, the sticky save-failure toasts, and the RETURNING-authoritative DB write (PR #463) all stay in place until D/E prove out.
- **Feature-flag enforcement** (PR-C) so it can be disabled in production if it over-rejects.
- **Transition logic must stay server-authoritative** — the client preview in 2c is advisory only; the server re-runs `applyEventRequestTransition` as the source of truth.

---

## 5. Definition of done

- One Zod schema (`eventRequestPatchSchema`) is the single validator, imported by both client dialogs and the server PATCH handler.
- One serializer (`buildEventPatch`) and one diff (`diffEventPatch`) — no hand-rolled field mapping remains in any dialog.
- One transition function (`applyEventRequestTransition`) — no transition/side-effect logic inline in the route handler.
- Shape-invalid saves return field-level `400`s; nothing invalid is silently dropped.
- The main form shows validation inline; no nested error dialogs in the save path.
