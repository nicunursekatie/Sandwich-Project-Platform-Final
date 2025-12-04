### Overview
This full-stack application for The Sandwich Project nonprofit streamlines sandwich collections, donations, and distributions. It provides comprehensive data management, analytics, and operational tools for volunteers, hosts, and recipients. The project aims to enhance data visibility, support organizational growth, and become a vital tool for food security initiatives, ultimately reducing food waste and hunger. The organizational annual goal is to collect 500,000 sandwiches.

### User Preferences
Preferred communication style: Simple, everyday language.
UI Design: Button labels and interface text must be extremely clear about their function - avoid ambiguous labels like "Submit" in favor of specific action descriptions like "Enter New Data".
Form Design: Eliminate redundant or confusing form fields - host dialogs should have a single "Host Location Name" field instead of separate "Name" and "Host Location" fields.
Mobile UX Priority: Mobile user experience is critical - chat positioning and space efficiency are key concerns. Vehicle type should NOT be required for new driver entries.
Documentation: All technical findings and fixes must be documented in replit.md to avoid repeated searching and debugging.
Analytics Philosophy: NEVER compare or rank hosts against each other. The Sandwich Project is about increasing volunteer turnout globally, not about which host reported more/less sandwiches. All host comparison features, "top performing hosts", "underperforming hosts", and similar language must be removed from analytics.
Desktop Chat UX: Desktop users require proper scrolling behavior without nested scrolling containers that cause page focus issues - chat layout must handle desktop and mobile differently.

### System Architecture
The application features a React 18 frontend with TypeScript, Vite, TanStack Query, and Tailwind CSS (with shadcn/ui). The backend uses Express.js (TypeScript), Drizzle ORM, and PostgreSQL (Neon serverless), including session-based authentication. The UI/UX adheres to The Sandwich Project's official color palette and Roboto typography, prioritizing clarity, responsiveness, and card-based dashboards.

**UI/UX Decisions:**
- Modern, compact design with white card backgrounds, colored left borders for status, warm paper tone page background, subtle shadows, and a strong tonal hierarchy.
- Operational monitoring uses Wednesday-Tuesday week boundaries for calculations.
- Visualizations for collection trends include two-line charts (individual vs group sandwiches) and summary cards.

**Technical Implementations & Feature Specifications:**
-   **Authentication & Permissions**: Role-based access control, granular permissions for various modules (e.g., Holding Zone, Projects Standalone Tasks), session management, and password security. Permissions are validated with layered middleware.
-   **Data Management**: Comprehensive management of collections, hosts, recipients, users, and audit logs with Zod validation and timezone-safe date handling. `sandwich_collections` table is the operational source of truth. Soft deletes are implemented using `deleted_at` and `deleted_by` columns.
-   **Messaging & Notifications**: Email (SendGrid), Socket.IO chat, SMS via Twilio, and dashboard notifications, including real-time kudos and @mention notifications. All outgoing emails are BCC'd to `katie@thesandwichproject.org` and SMS activities are monitored with email notifications to admin (phone numbers redacted).
-   **Operational Tools**: Project, meeting, and work log management, user feedback, analytics dashboards, and a permissions-based Collection Walkthrough Tool.
-   **Event Requests Management System**: Tracks requests, handles duplicate detection, manages statuses, integrates with Google Sheets, calculates van driver staffing, supports multi-recipient assignment, performs comprehensive intake validation, and features interactive Leaflet maps with AI Intake and Scheduling Assistants. Includes van conflict detection on event scheduling (warns when another event needs van on same date) and date population badges showing event counts per date (info: 1-2 events, busy: 3+, critical: 2+ need drivers).
-   **Real-Time Collaboration System**: Multi-user collaboration for event editing and other resources (holding zone items, planning workspaces, meetings) with Socket.IO synchronization, including presence tracking, field-level locking, threaded comments, and edit revision history, utilizing a generic `useCollaboration` hook.
-   **User Activity Logging System**: Comprehensive tracking of authenticated user actions with a dedicated API endpoint for retrieval and filtering.
-   **Sandwich Type Tracking System**: Comprehensive tracking for individual and group collections with real-time validation and analytics.
-   **Interactive Route Map & Driver Optimization**: Leaflet map for visualizing host contact locations, route optimization, and driver assignment.
-   **Automated Reminders**: 24-hour volunteer reminder system via cron job.
-   **TSP Holding Zone**: Simple inbox-style system for capturing long-term ideas and tasks with flexible categories, urgent flagging, commenting, likes, assignments, and a three-tier permission system (VIEW/SUBMIT/MANAGE).
-   **Error Handling & Logging**: Robust error handling with `lazyWithRetry` for dynamic component imports and improved production-safe logging that properly serializes error objects.
-   **Timezone Management**: Ensures accurate storage of user-entered times.
-   **Date Handling Rules** (CRITICAL - see `client/src/lib/date-utils.ts`):
    - **Never** use `T12:00:00.000Z` - only use `T12:00:00` (no timezone suffix)
    - **Always** use `timeZone: 'America/New_York'` for display formatting
    - **Always** use the provided utility functions: `parseDateOnly()`, `formatDateDisplay()`, `formatDateForInput()`, `normalizeDate()`, etc.
    - These rules prevent timezone conversion issues that can shift dates by one day
-   **Storage Wrapper**: Includes a `StorageWrapper` with fallback mechanisms for database operations.
-   **Event Impact Report Data Source** (CRITICAL - see `server/services/ai-impact-reports/index.ts`):
    - The Event Impact Report ONLY counts sandwiches from actual `sandwichCollections` records
    - It does NOT fall back to estimated/planned counts from `eventRequests` when no collection is linked
    - This ensures consistency with the Group Collections Viewer (`server/routes/reports/group-collections.ts`)
    - Both reports use `sandwichCollections` as the single source of truth for actual sandwich counts
    - The `getCollectionSandwichCount()` function only counts group sandwiches (from organizations/schools/churches), not individual sandwiches

### External Dependencies
-   **Database**: `@neondatabase/serverless`, `drizzle-orm`
-   **Web Framework**: `express`
-   **UI/Styling**: `@radix-ui`, `tailwindcss`, `lucide-react`, `class-variance-authority`, `shadcn/ui`
-   **Data Fetching/State**: `@tanstack/react-query`, `react-hook-form`, `zod`
-   **Email**: `@sendgrid/mail`
-   **Real-time Communication**: `socket.io`, `socket.io-client`
-   **PDF Generation**: `pdfkit`
-   **Authentication**: `connect-pg-simple`
-   **File Uploads**: `multer`
-   **Google Integration**: Google Sheets API, `@google-cloud/storage`, Google Analytics
-   **Mapping**: `leaflet`, `react-leaflet`, `react-leaflet-cluster`
-   **SMS**: `twilio` (using Replit Twilio integration with API Key authentication)

### Twilio SMS Configuration
The SMS system uses Replit's managed Twilio connection for secure API Key authentication. Key files:
-   `server/sms-providers/provider-factory.ts` - Prioritizes Replit integration over manual env vars
-   `server/sms-providers/replit-twilio-connector.ts` - Fetches credentials from Replit's connection API
-   `server/sms-providers/twilio-provider.ts` - Twilio SDK wrapper supporting both auth methods
-   `server/services/notifications/smart-delivery.ts` - Uses lazy async initialization via `getSMSProvider()`

**Important**: The SMS provider uses lazy async initialization to avoid timing issues during server startup. The `smart-delivery.ts` module calls `getSMSProvider()` instead of synchronously accessing the provider at module load time. This ensures the Replit Twilio connection is properly fetched before any SMS operations occur.

### Google Sheets Sync Monitoring & Alerts

The background sync service (`server/background-sync-service.ts`) includes comprehensive monitoring and email alerts:

**Alert Types:**
1. **No Sync Ever Alert** - Triggers if sync has NEVER completed after 15 minutes of server startup. Catches stuck locks, configuration issues, etc.
2. **Stale Sync Alert** - Triggers if no successful sync in 20 minutes (after at least one successful sync)
3. **Failure Alert** - Triggers after 3 consecutive sync failures
4. **Service Stopped Alert** - Triggers when sync service is explicitly stopped

**Key Settings:**
- `STARTUP_GRACE_PERIOD_MINUTES = 15` - Grace period before alerting on initial sync issues
- `STALE_SYNC_THRESHOLD_MINUTES = 20` - Time without sync before stale alert
- `FAILURE_THRESHOLD = 3` - Consecutive failures before alert
- `ALERT_COOLDOWN_MINUTES = 60` - Prevent email spam (max one per hour)

**Critical Fix (December 2025):**
PostgreSQL advisory locks (`pg_try_advisory_lock`) don't work with Neon's serverless connection pooling. Replaced with in-memory locking in `google-sheets-event-requests-sync.ts`. This fixed a 2+ month sync outage where the lock was stuck and no events were being imported.

### React Query Cache Refresh for Event Mutations

**Issue (December 2025):** Inline edits on scheduled event cards showed success toasts but the display didn't update. The backend saved correctly but the UI wasn't reflecting changes.

**Root Cause:** React Query's `invalidateQueries` marks queries as stale but doesn't force an immediate refetch when `staleTime` is set (5 minutes in this case). With `refetchOnWindowFocus: false`, the query might not refetch until the stale time expires.

**Solution:** Changed from `invalidateQueries` to `refetchQueries` in mutation success handlers (`client/src/components/event-requests/hooks/useEventMutations.tsx`):
```typescript
// Instead of:
queryClient.invalidateQueries({ queryKey: ['/api/event-requests', 'v2'] });

// Use:
await queryClient.refetchQueries({ queryKey: ['/api/event-requests', 'v2'], type: 'active' });
```

**Key mutations updated:**
- `updateEventRequestMutation` - main event updates
- `updateScheduledFieldMutation` - inline field edits
- `scheduleCallMutation` - call scheduling
- `oneDayFollowUpMutation` / `oneMonthFollowUpMutation` - follow-up tracking
- `rescheduleEventMutation` - date changes
- `assignRecipientsMutation` / `assignTspContactMutation` - assignments

This ensures the UI immediately reflects saved changes.