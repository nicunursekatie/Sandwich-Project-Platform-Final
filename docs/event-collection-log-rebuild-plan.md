# EventCollectionLog Rebuild — Implementation Plan

Status: **proposal / awaiting decision** (no code written yet)
Author: route-drift cleanup follow-up
Related: `docs/route-inventory.md`, route-drift bucket B

## 1. Background

`client/src/components/event-requests/EventCollectionLog.tsx` is a dialog
("Collection Log for {organization}") opened from:

- `client/src/components/event-requests/tabs/MyAssignmentsTab.tsx:424`
- `client/src/components/event-requests/tabs/CompletedTab.tsx:164`

(both via `setShowCollectionLog(true)` + `setCollectionLogEventRequest(event)`).

It is **reachable by users today but broken**. It calls:

- `GET /api/collections` (via `queryKey: ['/api/collections', { eventRequestId }]`)
- `PATCH /api/collections/:id` (destination edit)

Neither route exists on the server (`git log -S'/api/collections'` shows it was
never registered). The collections router is mounted only at
`/api/sandwich-collections`. So every open of this dialog 404s and renders the
empty state.

> Note: the mobile collection pages had the same `/api/collections` drift but
> operate on real data and were already repointed to `/api/sandwich-collections`
> (commit `458989d`). This plan is **only** about the desktop event dialog,
> which is broken at the *data-model* level, not just the URL.

## 2. Root cause: it was built against a record shape that does not exist

Actual `sandwich_collections` columns (`shared/schema.ts`):

```
id, collectionDate, hostName,
individualSandwiches, individualDeli, individualTurkey, individualHam,
individualPbj, individualGeneric,
group1Name, group1Count, group2Name, group2Count,   // legacy
groupCollections (jsonb),                            // canonical groups
createdBy, createdByName, submittedAt, submissionMethod,
deletedAt, deletedBy,
eventRequestId                                       // <-- links a collection to an event
```

What the component reads vs. reality:

| Component reads          | Reality                                                                 |
| ------------------------ | ----------------------------------------------------------------------- |
| `collection.sandwichCount`       | No column. Computed: `individualSandwiches + Σ groupCollections[].count` |
| `collection.collectionDate`      | ✅ exists                                                                |
| `collection.sandwichDestination` | ❌ No column anywhere. Dialog edits + PATCHes a field with no backing.   |
| `collection.sandwichTypes`       | ❌ No column. Type data is in `individual*` columns + per-group fields.  |
| `collection.notes`               | ❌ No `notes` column.                                                    |

The one thing that *is* real and useful: `eventRequestId` lets us answer
"which collections belong to this event." There is currently **no endpoint**
and **no storage method** that filters collections by `eventRequestId`.

## 3. Existing building blocks to reuse

- Per-record total: `individualSandwiches + calculateGroupSandwiches(record)`
  from `client/src/lib/analytics-utils.ts` (`calculateGroupSandwiches(collection)`
  already handles JSONB + legacy + string-encoded groups). This is the app's
  single source of truth for counts — do not hand-roll.
- Type breakdown display: reuse the rendering already in
  `client/src/components/sandwich-collection-log.tsx` (individual + group types).
- Storage/query pattern: Drizzle select with `isNull(deletedAt)` filter, as in
  `getSandwichCollections` (`server/database-storage.ts:1379`) and
  `getSandwichCollectionById` (`:1403`).
- Collections router GET `/` query parsing already reads `page/limit/sort/order`
  (`server/routes/collections/index.ts:178-182`) — the event filter slots in here.

---

## Variant A — Lean, read-only (recommended default)

Make the dialog an accurate **read-only** "what was collected for this event"
view. **No schema change.** Drops the never-backed destination/types/notes
editing.

### A.1 Server

**`server/storage.ts`** (interface, near `:316`) — add:
```ts
getSandwichCollectionsByEventRequestId(eventRequestId: number): Promise<SandwichCollection[]>;
```

**`server/database-storage.ts`** (and the `server/storage.ts` impl class) — add:
```ts
async getSandwichCollectionsByEventRequestId(eventRequestId: number) {
  return await db.select().from(sandwichCollections)
    .where(and(
      eq(sandwichCollections.eventRequestId, eventRequestId),
      isNull(sandwichCollections.deletedAt),
    ))
    .orderBy(desc(sandwichCollections.collectionDate));
}
```

**`server/routes/collections/index.ts`** — extend the existing `GET /` handler
so that when `?eventRequestId=N` is present it returns the filtered list
(array; keep the existing paginated shape for the unfiltered case to avoid
breaking current callers). Guarded by the same `isAuthenticated` +
`createStandardMiddleware()` the router already has.

```ts
const eventRequestId = req.query.eventRequestId
  ? parseInt(req.query.eventRequestId as string) : undefined;
if (eventRequestId) {
  const rows = await storage.getSandwichCollectionsByEventRequestId(eventRequestId);
  return res.json(rows); // bare array
}
// ...existing paginated behavior unchanged...
```

> Alternative: a dedicated `GET /api/sandwich-collections/by-event/:id`. Either
> works; extending `GET /` keeps surface area smaller. Pick one and keep it.

### A.2 Client (`EventCollectionLog.tsx`)

- Query:
  ```ts
  queryKey: [`/api/sandwich-collections?eventRequestId=${eventRequest?.id}`],
  enabled: isVisible && !!eventRequest?.id,
  ```
  (id baked into `queryKey[0]` because the default `queryFn` only uses
  `queryKey[0]`.)
- Compute each record's count with `individualSandwiches +
  calculateGroupSandwiches(record)`; sum for the "Total Sandwiches" card.
- Render type breakdown from real fields (reuse `sandwich-collection-log.tsx`
  logic) instead of `collection.sandwichTypes`.
- **Remove**: the destination inline editor (`SandwichDestinationTracker`),
  `handleDestinationSave`/`Cancel`/`Edit`, the `PATCH /api/collections/:id`
  call, and the `notes` block.

### A.3 Touch list (Variant A)
- `server/storage.ts` (interface + impl)
- `server/database-storage.ts`
- `server/routes/collections/index.ts`
- `client/src/components/event-requests/EventCollectionLog.tsx`
- regenerate `docs/route-inventory.md` (`/api/collections` leaves bucket B)

### A.4 Risk / effort
- No DB change. Additive server method + one handler branch. Low risk.
- Est: ~half a day incl. manual verification of the dialog from both tabs.

---

## Variant B — Full, with per-collection destination tracking

Everything in Variant A, **plus** real "where did these sandwiches go" tracking.
Requires a production schema change.

### B.1 Migration (manual, per project process)
- Add column: `ALTER TABLE sandwich_collections ADD COLUMN sandwich_destination text;`
- Run against the **correct Neon branch** (dev first, then production) via the
  Neon SQL editor — there is no automated migration runner (see CLAUDE.md).
- Add `sandwichDestination: text('sandwich_destination')` to the
  `sandwichCollections` table in `shared/schema.ts` and to the relevant
  insert/update Zod schemas.

### B.2 Server
- Extend `PATCH /api/sandwich-collections/:id` (router already has PATCH
  handlers, e.g. `:1111`/`:1201`) to accept `sandwichDestination`, or confirm
  the existing update path already whitelists arbitrary columns.
- Ensure the new column is selectable (it will be via `select()`).

### B.3 Client
- Variant A, but **keep** the `SandwichDestinationTracker` editor.
- Repoint the save to `PATCH /api/sandwich-collections/${id}` with
  `{ sandwichDestination }`.
- Fix the cache update: invalidate by prefix predicate matching
  `/api/sandwich-collections` (the list keys bake params into `queryKey[0]`),
  not an exact `['/api/collections']` key.

### B.4 Touch list (Variant B)
- Everything in A.3, plus:
- migration SQL (dev + prod Neon branches)
- `shared/schema.ts` (column + Zod)
- `PATCH /api/sandwich-collections/:id` whitelist

### B.5 Risk / effort
- Touches production DB and write paths. Medium risk; needs branch discipline
  and a backfill decision (existing rows get `NULL` destination — acceptable).
- Est: ~1.5–2 days incl. migration coordination and verification.

---

## 4. Open questions for product

1. Is per-collection **destination** tracking actually wanted? (A vs B)
2. If a "notes" field is desired on the event view, where should it come from —
   the event request, or a new column? (Currently nothing backs it.)
3. Should this dialog be **read-only**, or also allow adding/editing collections
   for the event from here? (This plan assumes read-only; add/edit lives in the
   main collection log + mobile entry.)

## 5. Recommendation

Ship **Variant A** unless destination tracking is a confirmed requirement. It
converts a broken, user-reachable screen into one that shows correct,
single-source-of-truth data with no schema risk, and clears the last
`/api/collections` entry from the route-drift report. Revisit Variant B only if
the destination feature is explicitly prioritized.
