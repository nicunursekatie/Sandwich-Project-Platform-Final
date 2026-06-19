### Overview
Full-stack app for The Sandwich Project nonprofit: streamlines sandwich collections, donations, and distributions with data management, analytics, and operational tools for volunteers, hosts, and recipients. Goal is to reduce food waste and hunger. The annual sandwich goal is runtime-configurable via the `app_settings` table.

### User Preferences
- **Communication**: simple, everyday language.
- **Button labels**: extremely clear about function — e.g. "Enter New Data", never ambiguous "Submit".
- **Forms**: no redundant/confusing fields — e.g. host dialogs use a single "Host Location Name" field, not separate "Name" + "Host Location".
- **Mobile UX is critical**: chat positioning and space efficiency matter; vehicle type is NOT required for new driver entries.
- **Documentation**: record all technical findings and fixes in `replit.md` to avoid re-debugging.
- **Analytics**: NEVER compare or rank hosts against each other. TSP is about growing volunteer turnout globally — remove all "top/underperforming hosts" and similar comparison language.
- **Desktop chat**: proper scrolling without nested scroll containers (which cause page-focus issues); handle desktop vs mobile layouts differently.
- **Mobile header**: progressive hiding by breakpoint — user info hidden < xs (480px), comments button < xs, OnlineUsers < sm (640px); smaller button padding on mobile; header is `overflow-x-hidden` + `max-w-full`.

### System Architecture
React 18 + TypeScript + Vite frontend (TanStack Query, Tailwind/shadcn/ui). Express.js (TypeScript) backend with Drizzle ORM, PostgreSQL (Neon serverless), session-based auth. UI follows TSP's official color palette and Roboto typography — clarity, responsiveness, card-based dashboards.

**UI/UX decisions:**
- Compact, modern: white cards, colored left borders for status, warm paper-tone background, subtle shadows, strong tonal hierarchy.
- Operational monitoring uses Wednesday–Tuesday week boundaries.
- Collection trends use two-line charts plus summary cards.
- Map markers: purple = recipients, blue = events, green = hosts. "Nearby Recipients" panel shows recipients within 15 miles of a selected event.

**Core features:**
- **Auth & Permissions**: role-based access control, session management, password security, active-user enforcement (env-var controlled modes).
- **Data Management**: collections, hosts, recipients, users, audit logs; Zod validation, timezone-safe dates, soft deletes. `sandwich_collections` is the source of truth. Totals sum either `jsonb group_collections` OR legacy `group1_count`/`group2_count` — never both (avoids double-counting).
- **Event Requests Management**: requests, duplicates, statuses; Google Sheets integration, van-driver staffing, multi-recipient assignment, intake validation, Leaflet maps with AI assistants, auto-save, corporate/standby follow-ups. (See `EVENT_REQUESTS_RELIABILITY_PLAN_V2.md` for the authoritative, code-verified diagnosis, scope/sequencing, and engine-room bug list.)
- **Messaging & Notifications**: Email (SendGrid), Socket.IO chat, SMS (Twilio), dashboard notifications. All outgoing emails BCC `katie@thesandwichproject.org`. Tiered URGENT/IMPORTANT/DIGEST to avoid alert fatigue; SMS batched per user (emails individual); stale-event escalations batched into a weekly admin summary; notification queries exclude inactive event statuses; corporate escalation SMS rate-limited to once/24h per event. SMS opt-in supports 'hosts' (weekly reminders) and 'events' campaigns. Kudos mark-as-read via messaging service.
- **Real-Time Collaboration**: Socket.IO sync, presence tracking, field-level locking, threaded comments, edit revision history, online-presence toasts.
- **Reminders & Follow-ups**: 24h volunteer reminder cron (configurable email/SMS); TSP contact follow-ups for approaching 'in_progress' events and toolkit follow-ups.
- **Other**: sandwich type tracking (individual + group), interactive route map & driver optimization, user activity logging, TSP Holding Zone (inbox-style ideas/tasks, 3-tier permissions), guided tours/onboarding, organization merge tool, email template customization, external API key auth (SHA-256 hashed, role-based), intake workflow app integration, document storage in Replit Object Storage (GCS).
- **App Settings (configurable annual goal)**: key/value `app_settings` table backs runtime config. Annual goal at key `annual_sandwich_goal`; frontend reads via `useAnnualSandwichGoal()` (falls back to `DEFAULT_ANNUAL_SANDWICH_GOAL`). Admin/super_admin/admin_coordinator edit inline on Analytics → Pace & Comparison. Routes: `GET /api/app-settings`, `GET/PATCH /api/app-settings/:key` (PATCH role-gated).
- **Navigation/Analytics layout**: Weekly Collections Report and Group Collections Viewer are sub-items under Collections Log (`client/src/nav.config.ts`). Analytics view has Pace & Comparison (default) and Low/High Weeks tabs.

**Grant Metrics page (`grant-reporting`):**
- YoY growth derived from completed annual totals (not hard-coded years); the in-progress year is called out separately.
- Key achievements are a compact highlight row in the YoY section (duplicate hero/volunteer/financial cards removed).
- Estimated participants = total sandwiches ÷ 10 (≈8–12 each); admin/coordination time = 1.5h per event (conservative). Both stated plainly on the page.
- Ingredient-cost methodology documents deli (Nature's Own Honey Wheat bread, Kirkland cheddar + deli turkey, sandwich bags) and PB&J (same bread, Jif PB ~2–3 tbsp, jelly ~2 tsp) baselines; food value uses the deli baseline (data lacks a deli/PB&J split).
- Recipient need labeled "Estimated Weekly Bare Minimum Need" (a likely undercount, not a ceiling).
- Group Events stat = average sandwich output per completed group event (NOT social-media engagement/attendance — not reliably recorded).
- Technology value uses number-free language: TSP avoided a substantial custom-software expense via AI-assisted internal development + volunteer labor, while still needing ongoing maintenance/hosting/security/integrations. No firm dollar claims.
- Capacity argument frames grant need as paid coordination capacity (operations, group-event coordination, recipient comms, transport logistics, reporting, tech upkeep, follow-up) plus one additional smaller refrigerated van — NOT a full-time admin, ingredients, office, or sandwich-making staff.

**Volunteer Hub (`client/src/pages/volunteer-event-hub.tsx`):**
- Defaults to Calendar; view chooser ordered Calendar, List, Map ("Events" renamed "List"). Calendar uses TSP's warm palette, monthly summary stats, day cards with event/open-spot counts, and a selected-day detail panel with sign-up/assignment actions. Keep plain-language and action-focused for non-technical volunteers.
- Calendar shows ALL upcoming events even when List/Map default to "only events that need help"; fully-staffed events show "Extra help welcome"/needs-met language.
- Banner uses stronger contrast / larger text for readability.
- Permissions are separate toggles: `NAV_VOLUNTEER_HUB` (open page), `EVENT_REQUESTS_SELF_SIGNUP`, `EVENT_REQUESTS_ASSIGN_OTHERS`, `VOLUNTEER_SIGNUP_APPROVE` (manage pending approvals); driver-role approval also needs `DRIVER_SIGNUP_APPROVE`. Shown in the common permissions editor with plain-language labels.
- **Rule**: any Event Management mutation must invalidate BOTH `/api/event-requests*` and `/api/volunteer-hub*` caches, or role needs go stale. The hub API treats an uncovered van-driver requirement as unfilled and hides it once `assignedVanDriverId` or `isDhlVan` is present.

### Critical Rules & Known Fixes

**Database, Migrations & Runtime:**
- **Two separate dev databases**: the app uses a **Neon** DB via `DATABASE_URL` (`server/db-url.ts` → `getDatabaseUrl()`, branch `dev`). The agent's `executeSql` tool targets Replit's **built-in** Postgres — a DIFFERENT database. **Rule: to change the schema/data the app uses, run SQL via a script importing `getDatabaseUrl()`+`neon()` (like `server/migrate.ts`) or `npm run db:push` — NOT `executeSql`.**
- **Migrations can be multi-statement**: `server/migrate.ts` `splitSqlStatements()` splits on top-level semicolons (respecting quotes/dollar-blocks/comments) and normalizes `--> statement-breakpoint`. **Rule: never assume one statement per file.** (Neon's HTTP driver otherwise throws `cannot insert multiple commands into a prepared statement`.) `20260526_add_app_settings.sql` was applied manually to dev+prod because broken migration `20260315` blocks the auto-runner.
- **Neon HTTP driver has NO transactions**: `db.transaction()` throws in production. **Rule: never use `db.transaction()` in server code** — use sequential `db.*` calls.
- **SIGTERM exit prevention**: production overrides `process.exit` (to block accidental library exits), which also swallowed `process.exit(0)` in the shutdown handler → ports held forever → EADDRINUSE. **Fix: save `realExit = process.exit.bind(process)` BEFORE the override and use it in the shutdown function.**
- **Dev ports**: `Start application` runs `PORT=5000 npm run start`; `Start Server` runs `npm run dev` on port 3000. Replit proxy forwards the preview to port 5000 (`waitForPort = 5000`). Do NOT bind port 80 (Replit system process); `lsof -ti:80 | xargs kill -9` kills the Node server — avoid it.

**Production CSP & External Embeds** (CSP is DISABLED in dev — this class of bug only appears on the published app; Helmet config in `server/index.ts`):
- **Rule: any browser-side `fetch`/PUT to a new external origin must be added to `connectSrc`.** Presigned uploads PUT to `https://storage.googleapis.com/...`; missing it broke uploads ("Failed to fetch"). Downloads stream same-origin via `/api/documents/:id` (covered by `'self'`).
- **Rule: `<object>`/`<embed>` need `object-src` — `'none'` silently shows fallback.** PDF previews use `<object data="/api/documents/:id/preview">`; `objectSrc` is `["'self'"]`.
- **Rule: any new external URL embedded via the `GET /api/proxy/page?url=...` proxy must have its origin added to `ALLOWED_PROXY_ORIGINS` in `server/routes/index.ts`** (else `403 "URL not in allowlist"`). The proxy bypasses upstream `X-Frame-Options` by fetching HTML and injecting `<base>`. Toolkit / Important Links embeds (e.g. Volunteer Handbook `https://tsp-host-handbook-ylfb92u.gamma.site`) flow through it.

**Event Save Integrity:**
- **Full-form save**: `EventSchedulingForm` sends the entire `buildEventDataForServer()` payload on every save (it no longer change-detects a subset). This removes the silent-dropped-field bug class at the root — `detectChangedFields` and `ALWAYS_INCLUDE_FIELDS` were deleted (was: van flags `vanDriverNeeded`/`isDhlVan`/`selfTransport` dropped by a change-detection race during the SpeakerWarningDialog pause). **Unit 7 removed the old partial/full split: `/api/event-requests/list` returns full event records, and `EventSchedulingForm` no longer performs a second full-record fetch. Schedule-mode date coupling lives in `buildEventDataForServer` — `scheduledEventDate` is attached only when the resolved status is `scheduled`.**
- **Save verification**: EventSchedulingForm does NOT treat every 200 as a clean save — after PATCH it checks the server's `_droppedFields` marker. **Only `_droppedFields` blocks completion**: when present, the form stays open, auto-save is preserved, queries refresh, and a sticky "Partial Save - Please Review" warning shows. `findMismatchedSavedFields()` (`form-utils.ts`) is logged as **non-blocking diagnostics only** (it false-positives on routine server transforms, so it must never gate saves). Quick-edits to `/api/event-requests/:id` must use `patchEventRequestVerified()` (`client/src/lib/event-save-verification.ts`), not raw `fetch` — it throws a sticky error if the save didn't round-trip; on failure, don't clear edit state. Converted: Driver Planning, Event Map address edits, ScheduledCard, NewRequest confirmation toggles, CompletedCard inline edits.
- **Event list shape**: `/api/event-requests/list` now returns full event records. Do not reintroduce a lightweight allow-list mapper for card fields; that split caused silent UI drift (for example social-media fields saving but badges not flipping).

**Documents & Uploads:**
- Two-step presigned-URL JSON flow: POST `/api/documents/request-upload-url`, PUT bytes to the returned `uploadURL`, then POST `/api/documents` JSON with `objectPath` (create returns `{ document }`). **Rule: never POST file bytes to `/api/documents` — that route only accepts JSON metadata.** Files serve from cloud via `/api/documents/:id` with legacy local fallback.
- Reference Materials (`client/src/pages/resources.tsx`): "Open" uses `/api/documents/:id/preview` (inline), "Copy link" uses `/:id/download`. Bare `/api/documents/:id` has NO route.
- **Rule: never use `require(...)` in server code** — it only works in dev under `tsx` and throws in the prod ESM bundle (`"type": "module"`, `esbuild --format=esm`, no `createRequire` banner); use top-level ESM `import`. This caused a prod-only 500 on legacy local-file downloads (`server/routes/documents.ts`). All `require()` was swept from the server (`storage.ts`, `routes/storage/index.ts`, `monitoring/health-checks.ts`); `rg "require\("  server/` is clean. Local file streams also have `.on('error')` handlers. Fix requires republish.

**Google Sheets Sync:**
- Background service with monitoring, alerts, triple dedup, message backfill. Active sheet ID is in the `EVENT_REQUESTS_SHEET_ID` secret — when Squarespace publishes a new sheet, only update the secret (sync reads `A2:K1000`). Manual trigger: `POST /api/google-sheets/event-requests/sync/from-sheets`.
- **Sheet-migration dedup bugs (fixed in `server/google-sheets-event-requests-sync.ts`)**: when a new sheet resets row IDs to 1, three false-duplicate paths silently skipped new submissions — (1) cross-sheet row-ID match (fixed with org-name validation), (2) stale carried-over `sheets-import-*` externalIds (fixed with org-name agreement), (3) null-date email-hash match where `null === null` (fixed to not-a-match when either date is missing).

**Data Parsing & Reports:**
- **Sandwich range parsing**: text like `500-600`, `500 – 600`, `500 to 600`, `500 through 600` is a range stored/reported as the midpoint (`550`), NOT `500600`. Helper: `shared/sandwich-count-utils.ts`. Sheets imports preserve min/max; AI reports and Event Impact Reports use midpoints and ignore suspiciously huge estimated-only counts (50,000+).
- **Event Impact Reports**: current week/month/quarter/year cover the full named period (not year-to-date); "All Time" includes future scheduled events. Scheduled count/filter include both `scheduled` and `rescheduled`. Org categories normalized before filtering/charting/exporting; corporate variants (`corp`, `corporate`, `company`, `small_medium_corp`, `small/medium business`, `large_corp`, `large company`) grouped under `Corporate`.
- **AI Impact Report PDF**: jsPDF Helvetica can't render emoji (mojibake). The route sanitizes AI text to printable ASCII, strips mojibake prefixes, replaces trend emoji with plain labels (`Growth:`, `Seasonal:`), uses an ASCII footer; the prompt also asks for plain text.

**Messaging — Linked Admin Accounts (merged inbox):**
- Linked admin accounts share a merged view of messages, kudos, and notifications (shared read/archive/delete), while login/permissions/profile stay separate. Defined in `server/lib/linked-accounts.ts` (`LINKED_ACCOUNT_GROUPS` + `getLinkedUserIds(userId)`; 5-min cache, case-insensitive email match, always includes self). Pattern: recipient/owner-scoped read/count/mutate filters use `inArray(col, linkedIds)`; 403 guards use `linkedIds.includes(...)`. Covered: `messaging-service`, `notifications` (index + actions), `email-service`, `message-notifications`, `email-routes`. **Sent and Drafts stay per-account (NOT merged).**
- **Rule: to add a linked pair, edit only `LINKED_ACCOUNT_GROUPS`; any new recipient/owner-scoped query must use `getLinkedUserIds`+`inArray`, never bare `eq(...userId)`.** Server-side — requires republish.

**Team Chat (Stream) — group member editing:**
- **Rule: create group chats with an EXPLICIT channel ID, never `undefined`.** A `messaging` channel created with no ID + a member list becomes a Stream "distinct" channel (identity = member set), which rejects `addMembers`/`removeMembers` with error 17. In `server/routes/stream.ts` `POST /channels`, groups (3+ members or any `channelName`) get `group_<random>` IDs; only 1:1 DMs stay distinct (no ID) so a pair reuses one channel. Pre-fix groups are permanently distinct — the members handler returns a plain-language "start a new group" message for error 17. (`client/src/components/group-messaging.tsx` is a separate legacy DB system — unrelated.)

**Traffic Conflict Badges (World Cup / Atlanta):**
- Known high-traffic dates live in `shared/traffic-conflicts.ts` (`TRAFFIC_CONFLICTS`, YYYY-MM-DD Eastern). `getTrafficConflictForEvent(...dates)` hits if ANY supplied date matches. **Rule: on event cards pass only the operative date — `[request.scheduledEventDate ?? request.desiredEventDate]`, NOT both.** Passing both left a stale badge after an event was rescheduled off a conflict date. Fixed in `ScheduledCardEnhanced`, `NewRequestCard`, `InProcessCard`. (Atlanta 2026 WC semifinal is July 15; final July 19.)

**UI — floating help button vs chat send button:**
- The `GuidedTour` floating help button (`fixed bottom-4 right-4`) is hidden on sections with a bottom-anchored composer (`HELP_BUTTON_HIDDEN_SECTIONS` in `client/src/pages/dashboard.tsx`: `chat`, `messages`, `inbox`, `stream-messages`, `gmail-inbox`) so it doesn't cover the send button. **Rule: `GuidedTourGate` must check the dashboard's real `activeSection` AND the multi-view panel sections — in single-view nav the panel state lags `activeSection`, so checking panels alone left the button visible over Team Chat.**

**Code Health Baseline (May 2026):** `npm run build` passes; `npm run check` still fails on pre-existing TS debt. Cleanup excluded `*.test.tsx` from app type-check, set TS target `ES2020` (Node 20), routed GA imports through `client/src/lib/analytics`, and hardened shared permission helpers (non-array permission data → no permissions). Remaining: Drizzle JSON fields typed `unknown`, oversized event-request card files, storage interface drift, legacy fields. Most prod-only fixes (CSP, proxy, etc.) can only be verified on the published app.

### External Dependencies
- **Database**: `@neondatabase/serverless`, `drizzle-orm`
- **Web framework**: `express`
- **UI/styling**: `@radix-ui`, `tailwindcss`, `lucide-react`, `class-variance-authority`, `shadcn/ui`
- **Data/state**: `@tanstack/react-query`, `react-hook-form`, `zod`
- **Email**: `@sendgrid/mail`
- **Real-time**: `socket.io`, `socket.io-client`
- **PDF**: `pdfkit`
- **Auth**: `connect-pg-simple`
- **File uploads**: `multer`, `@uppy/core`, `@uppy/aws-s3`, `@uppy/dashboard`, `@uppy/react`
- **Cloud storage**: `@google-cloud/storage`
- **Google**: Google Sheets API, Google Analytics
- **Mapping**: `leaflet`, `react-leaflet`, `react-leaflet-cluster`
- **SMS**: `twilio`
