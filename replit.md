### Overview
This full-stack application for The Sandwich Project nonprofit streamlines sandwich collections, donations, and distributions. It provides comprehensive data management, analytics, and operational tools for volunteers, hosts, and recipients. The project enhances data visibility, supports organizational growth, and is a vital tool for food security initiatives, aiming to reduce food waste and hunger. The annual sandwich goal is runtime-configurable via the `app_settings` table.

### User Preferences
Preferred communication style: Simple, everyday language.
UI Design: Button labels and interface text must be extremely clear about their function - avoid ambiguous labels like "Submit" in favor of specific action descriptions like "Enter New Data".
Form Design: Eliminate redundant or confusing form fields - host dialogs should have a single "Host Location Name" field instead of separate "Name" and "Host Location" fields.
Mobile UX Priority: Mobile user experience is critical - chat positioning and space efficiency are key concerns. Vehicle type should NOT be required for new driver entries.
Documentation: All technical findings and fixes must be documented in replit.md to avoid repeated searching and debugging.
Analytics Philosophy: NEVER compare or rank hosts against each other. The Sandwich Project is about increasing volunteer turnout globally, not about which host reported more/less sandwiches. All host comparison features, "top performing hosts", "underperforming hosts", and similar language must be removed from analytics.
Desktop Chat UX: Desktop users require proper scrolling behavior without nested scrolling containers that cause page focus issues - chat layout must handle desktop and mobile differently.
Mobile Header Overflow: Dashboard header uses progressive hiding at breakpoints - user info hidden below xs (480px), comments button hidden below xs, OnlineUsers hidden below sm (640px). Button padding reduced on mobile (p-1.5 vs p-2). Header has overflow-x-hidden and max-w-full to prevent any overflow.

### System Architecture
React 18 + TypeScript + Vite frontend with TanStack Query and Tailwind/shadcn/ui. Express.js (TypeScript) backend with Drizzle ORM and PostgreSQL (Neon serverless) and session-based auth. UI/UX follows TSP's official color palette and Roboto typography, prioritizing clarity, responsiveness, and card-based dashboards.

**UI/UX Decisions:**
- Modern, compact design: white card backgrounds, colored left borders for status, warm paper-tone page background, subtle shadows, strong tonal hierarchy.
- Operational monitoring uses Wednesday-Tuesday week boundaries.
- Two-line charts for collection trends plus summary cards.
- Map markers: purple = recipients, blue = events, green = hosts. "Nearby Recipients" panel shows recipients within 15 miles of a selected event.

**Core Features:**
- **Auth & Permissions**: Role-based access control, session management, password security, active-user enforcement (env vars control modes).
- **Data Management**: Collections, hosts, recipients, users, audit logs with Zod validation, timezone-safe dates, soft deletes. `sandwich_collections` is the operational source of truth. Totals sum either `jsonb group_collections` OR legacy `group1_count`/`group2_count` (never both, to avoid double-counting).
- **Event Requests Management**: Tracks requests, duplicates, statuses; Google Sheets integration, van-driver staffing, multi-recipient assignment, intake validation, Leaflet maps with AI assistants, auto-save, corporate/standby follow-ups, optimistic-lock bypass for contact logs.
- **Messaging & Notifications**: Email (SendGrid), Socket.IO chat, SMS (Twilio), dashboard notifications. All outgoing emails BCC `katie@thesandwichproject.org`. Tiered (URGENT/IMPORTANT/DIGEST) to avoid alert fatigue; SMS batched per user (emails individual); stale-event escalations batched into a weekly admin summary; notification queries exclude inactive event statuses; corporate escalation SMS rate-limited to once/24h per event. SMS opt-in supports 'hosts' (weekly reminders) and 'events' campaigns. Kudos mark-as-read via messaging service.
- **Real-Time Collaboration**: Socket.IO sync, presence tracking, field-level locking, threaded comments, edit revision history, instant online-presence toasts.
- **Reminders & Follow-ups**: 24h volunteer reminder cron (configurable email/SMS); TSP contact follow-ups for approaching 'in_progress' events and toolkit follow-ups.
- **Other**: Sandwich type tracking (individual + group), interactive route map & driver optimization, user activity logging, TSP Holding Zone (inbox-style ideas/tasks with 3-tier permissions), guided tours/onboarding, organization merge tool, email template customization, external API key auth (SHA-256 hashed, role-based), intake workflow app integration, document storage in Replit Object Storage (GCS).
- **App Settings (Configurable Annual Goal)**: Key/value `app_settings` table backs runtime config. Annual goal lives at key `annual_sandwich_goal`; frontend reads via `useAnnualSandwichGoal()` (falls back to `DEFAULT_ANNUAL_SANDWICH_GOAL`). Admin/super_admin/admin_coordinator edit inline on Analytics → Pace & Comparison. Routes: `GET /api/app-settings`, `GET/PATCH /api/app-settings/:key` (PATCH role-gated).
- **Navigation/Analytics layout**: Weekly Collections Report and Group Collections Viewer are sub-items under Collections Log in `client/src/nav.config.ts`. Dashboard analytics view includes Pace & Comparison (default) and Low/High Weeks tabs.

**Grant Metrics page (grant-reporting):**
- YoY growth is derived from completed annual totals (not hard-coded years); current in-progress year called out separately.
- Trimmed of duplicate hero/volunteer/financial cards; key achievements live as a compact highlight row in the YoY section.
- Estimated participants = total sandwiches ÷ 10 (≈8-12 per participant); admin/coordination time = 1.5h per event (conservative). Stated plainly on the page.
- Ingredient cost methodology documents deli (Nature's Own Honey Wheat bread, Kirkland sliced cheddar + deli turkey, sandwich bags) and PB&J (same bread, Jif PB ~2-3 tbsp, strawberry/grape jelly ~2 tsp) baselines; food value uses deli baseline since data lacks a deli/PB&J split.
- Recipient need labeled "Estimated Weekly Bare Minimum Need" (a likely-undercount baseline, not a ceiling).
- Group Events stat is average sandwich output per completed group event (NOT social-media engagement or attendance — not reliably recorded).
- Technology value uses number-free language: TSP avoided a substantial custom-software expense via AI-assisted internal development + volunteer labor, while still needing ongoing maintenance, hosting, security, integrations, improvements. No firm-cost dollar claims.
- Capacity argument frames grant need as paid coordination capacity (operations, group-event coordination, recipient comms, transport logistics, reporting, tech upkeep, follow-up) plus one additional smaller refrigerated van — NOT a single full-time admin, ingredients, office, or hands-on sandwich-making staff.

**Volunteer Hub** (`client/src/pages/volunteer-event-hub.tsx`):
- Defaults to Calendar view; view chooser ordered Calendar, List, Map ("Events" renamed "List"). Calendar uses TSP's warm/bright palette, monthly summary stats, day cards with event/open-spot counts, and a selected-day detail panel with full event info and clear sign-up/assignment actions. Keep plain-language and action-focused for non-technical volunteers.
- Calendar intentionally shows ALL upcoming events even when List/Map default to "only events that need help"; fully-staffed events show "Extra help welcome"/needs-met language.
- Banner uses stronger contrast/larger text for readability.
- Permissions are separate toggles: `NAV_VOLUNTEER_HUB` (open page), `EVENT_REQUESTS_SELF_SIGNUP` (sign self up), `EVENT_REQUESTS_ASSIGN_OTHERS` (assign others), `VOLUNTEER_SIGNUP_APPROVE` (manage pending approvals); driver role approval also needs `DRIVER_SIGNUP_APPROVE`. Shown in the common permissions editor with plain-language labels.
- **Rule**: Any Event Management mutation must invalidate BOTH `/api/event-requests*` and `/api/volunteer-hub*` caches, or role needs go stale. The hub API treats an uncovered van-driver requirement as unfilled and hides it once `assignedVanDriverId` or `isDhlVan` is present.

### Critical Rules & Known Fixes

**Database, Migrations & Runtime:**
- **Two separate dev databases**: The app connects to a **Neon** DB via `DATABASE_URL` (`server/db-url.ts` → `getDatabaseUrl()`, branch `dev`). The agent's `executeSql` tool targets Replit's **built-in** Postgres — a DIFFERENT database. **Rule: to change the dev schema/data the app uses, run SQL via a script importing `getDatabaseUrl()`+`neon()` (like `server/migrate.ts`) or `npm run db:push` — NOT `executeSql`.**
- **Migration runner splits multi-statement files**: `server/migrate.ts` `splitSqlStatements()` splits on top-level semicolons (respecting quotes/dollar-blocks/comments) and normalizes `--> statement-breakpoint`. **Rule: migration files can contain multiple semicolon-separated statements; never assume one statement.** (Neon's HTTP driver throws `cannot insert multiple commands into a prepared statement` otherwise.) Migration `20260526_add_app_settings.sql` was applied manually to dev+prod because broken migration `20260315` blocks the auto-runner.
- **Neon HTTP driver has NO transactions**: `db.transaction()` throws `No transactions support in neon-http driver` in production. **Rule: never use `db.transaction()` anywhere in server code** — use sequential `db.*` calls.
- **SIGTERM exit prevention**: Production overrides `process.exit` to prevent accidental library exits, which also swallowed `process.exit(0)` in the shutdown handler (ports held forever → EADDRINUSE). Fix: save `realExit = process.exit.bind(process)` BEFORE the override and use it in the shutdown function.
- **Dev ports**: `Start application` runs `PORT=5000 npm run start`; `Start Server` runs `npm run dev` on port 3000. Replit proxy forwards the preview to port 5000 (`waitForPort = 5000`). Port 80 is a Replit system process — do NOT bind to it; `lsof -ti:80 | xargs kill -9` will kill the Node server, so avoid it.

**Production CSP & External Embeds** (CSP is DISABLED in dev — this whole class of bug only appears on the published app; Helmet config in `server/index.ts` ~line 66):
- **Rule: any browser-side `fetch`/PUT to a new external origin must be added to `connectSrc`.** Presigned uploads PUT bytes to `https://storage.googleapis.com/...`; missing it blocked uploads with a CSP/"Failed to fetch" error. (Downloads stream same-origin via `/api/documents/:id`, covered by `'self'`.)
- **Rule: `<object>`/`<embed>` need `object-src` — `'none'` silently shows fallback content.** PDF previews use `<object data="/api/documents/:id/preview">`; `objectSrc` is `["'self'"]` (PDF streams same-origin).
- **Rule: any new external URL embedded via the `GET /api/proxy/page?url=...` proxy must have its origin added to `ALLOWED_PROXY_ORIGINS` in `server/routes/index.ts`** (else returns `403 {"message":"URL not in allowlist"}`). The proxy bypasses upstream `X-Frame-Options` by fetching HTML and injecting `<base>`. Toolkit & Apps / Important Links embeds (e.g. Volunteer Handbook `https://tsp-host-handbook-ylfb92u.gamma.site`) flow through it.

**Event Save Integrity:**
- **Van Driver checkbox fix**: `vanDriverNeeded`, `isDhlVan`, `selfTransport` are ALWAYS included in every PATCH payload via `ALWAYS_INCLUDE_FIELDS` in `detectChangedFields` (`client/src/components/event-requests/form-utils.ts`). The SpeakerWarningDialog pause (events >500 sandwiches, no speakers) caused a race where change-detection saw no diff and dropped these flags. **Rule: these booleans must never be dropped by change-detection.**
- **Save verification**: The main EventSchedulingForm no longer treats every 200 as a clean save. After PATCH it checks server `_droppedFields` and round-trips the payload via `findMismatchedSavedFields()` (`form-utils.ts`); on mismatch the form stays open, auto-save is preserved, queries refresh, and a sticky "Partial Save - Please Review" warning shows. Event quick-edits should use `patchEventRequestVerified()` from `client/src/lib/event-save-verification.ts` (not raw `fetch`) for `/api/event-requests/:id` — it throws a sticky error if the save didn't round-trip; on failure, do not clear edit state. Converted paths: Driver Planning, Event Map address edits, ScheduledCard, NewRequest confirmation toggles, CompletedCard inline edits.
- **Rule: when adding any new persisted field a card UI reads, also add it to the lightweight `/api/event-requests/list` mapper** (`server/routes/event-requests-legacy.ts`) — it's a deliberate field allow-list, not a full row passthrough. (Social-media fields like `socialMediaPostCompleted` were silently dropped, so "Mark Posted" toast fired but the badge never flipped.)

**Documents & Uploads:**
- Documents use a two-step presigned-URL JSON flow: POST `/api/documents/request-upload-url`, PUT bytes to the returned `uploadURL`, then POST `/api/documents` JSON with `objectPath` (create returns `{ document }`, read `document.id`). **Rule: never POST file bytes to `/api/documents` — that route only accepts JSON metadata.** Files are served from cloud via `/api/documents/:id` with legacy local fallback.
- Reference Materials (`client/src/pages/resources.tsx`): "Open" uses `/api/documents/:id/preview` (inline), "Copy link" uses `/:id/download`. The bare `/api/documents/:id` has NO route.

**Google Sheets Sync:**
- Background service with monitoring, alerts, triple dedup, message backfill. Active event-requests sheet ID is in the `EVENT_REQUESTS_SHEET_ID` secret — when Squarespace publishes a new sheet, only update the secret (sync reads `A2:K1000`). Manual trigger: `POST /api/google-sheets/event-requests/sync/from-sheets`.
- **Sheet-migration dedup bugs (fixed in `server/google-sheets-event-requests-sync.ts`)**: when a new sheet resets row IDs to 1, three false-duplicate paths silently skipped new submissions — (1) row-ID match across sheets (fixed with org-name validation), (2) stale carried-over `sheets-import-*` externalIds (fixed with org-name agreement), (3) null-date email-hash match where `null === null` (fixed to return not-a-match when either date is missing).

**Data Parsing & Reports:**
- **Sandwich range parsing**: text like `500-600`, `500 – 600`, `500 to 600`, `500 through 600` is a range stored/reported as the midpoint (`550`), NOT `500600`. Shared helper `shared/sandwich-count-utils.ts`. Sheets imports preserve min/max; AI impact reports, AI data chat, and Event Impact Reports use midpoints and ignore suspiciously huge estimated-only counts (50,000+).
- **Event Impact Reports**: current week/month/quarter/year cover the full named period (not year-to-date); "All Time" includes future scheduled events. Scheduled count/filter include both `scheduled` and `rescheduled`. Org categories normalized before filtering/charting/exporting; corporate variants (`corp`, `corporate`, `company`, `small_medium_corp`, `small/medium business`, `large_corp`, `large company`) grouped under `Corporate`.
- **AI Impact Report PDF**: jsPDF Helvetica can't render emoji (printed mojibake). The PDF route sanitizes AI text to printable ASCII, strips mojibake prefixes, replaces trend emoji with plain labels (`Growth:`, `Seasonal:`), uses ASCII footer; the prompt also asks for plain text.

**Messaging — Linked Admin Accounts (Merged Inbox):**
Linked admin accounts share a merged in-app view of messages, kudos, and notifications (shared read/archive/delete), while login/permissions/profile stay separate. Defined in `server/lib/linked-accounts.ts` (`LINKED_ACCOUNT_GROUPS` + `getLinkedUserIds(userId)`; 5-min cache, case-insensitive email match, always includes self). Pattern: recipient/owner-scoped read/count/mutate filters use `inArray(col, linkedIds)` (on `messageRecipients.recipientId`, `emailMessages.recipientId`, `notifications.userId`, kudos recipient) and 403 guards use `linkedIds.includes(...)`. Covered: `services/messaging-service.ts`, `routes/notifications/index.ts` & `actions.ts`, `services/email-service.ts`, `routes/message-notifications.ts`, `routes/email-routes.ts`. **Sent and Drafts stay per-account (NOT merged).** **Rule: to add a linked pair, edit only `LINKED_ACCOUNT_GROUPS`; any new recipient/owner-scoped query must use `getLinkedUserIds`+`inArray`, never bare `eq(...userId)`.** Server-side — requires republish.

**Code Health Baseline (May 2026):** `npm run build` passes; `npm run check` still fails on pre-existing TS debt. Cleanup excluded `*.test.tsx` from app type-check, set TS target `ES2020` (Node 20), routed GA imports through `client/src/lib/analytics`, and hardened shared permission helpers (non-array permission data → no permissions). Remaining cleanup areas: Drizzle JSON fields typed `unknown`, oversized event-request card files, storage interface drift, feature-specific legacy fields. **Note: most prod-only fixes (CSP, proxy, etc.) can only be verified on the published app.**

### External Dependencies
- **Database**: `@neondatabase/serverless`, `drizzle-orm`
- **Web Framework**: `express`
- **UI/Styling**: `@radix-ui`, `tailwindcss`, `lucide-react`, `class-variance-authority`, `shadcn/ui`
- **Data Fetching/State**: `@tanstack/react-query`, `react-hook-form`, `zod`
- **Email**: `@sendgrid/mail`
- **Real-time Communication**: `socket.io`, `socket.io-client`
- **PDF Generation**: `pdfkit`
- **Authentication**: `connect-pg-simple`
- **File Uploads**: `multer`, `@uppy/core`, `@uppy/aws-s3`, `@uppy/dashboard`, `@uppy/react`
- **Cloud Storage**: `@google-cloud/storage`
- **Google Integration**: Google Sheets API, Google Analytics
- **Mapping**: `leaflet`, `react-leaflet`, `react-leaflet-cluster`
- **SMS**: `twilio`
