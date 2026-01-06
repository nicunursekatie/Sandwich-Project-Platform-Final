### Overview
This full-stack application for The Sandwich Project nonprofit streamlines sandwich collections, donations, and distributions. It provides comprehensive data management, analytics, and operational tools for volunteers, hosts, and recipients. The project aims to enhance data visibility, support organizational growth, and become a vital tool for food security initiatives, ultimately reducing food waste and hunger. The organizational annual goal is to collect 500,000 sandwiches.

### Debugging Checklist (ALWAYS FOLLOW)
When debugging any issue that involves data flow (auth, forms, API, database):
1. **Grep for the core operation** - Find ALL places in the codebase where the key function is called (e.g., `bcrypt.hash`, `db.update`, date parsing, validation)
2. **Verify consistent transformation** - Check that every entry point applies the same processing (trimming, formatting, validation)
3. **Trace the full lifecycle** - Follow: input → processing → storage → retrieval → comparison/display
4. **Check for centralized helpers** - If a service/utility exists for an operation, verify all code paths use it (not direct calls)
5. **Don't stop at "route works"** - Surface-level access doesn't mean the data layer is consistent

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
- Operational monitoring uses Wednesday-Tuesday week boundaries.
- Visualizations for collection trends include two-line charts (individual vs group sandwiches) and summary cards.
- Purple markers for recipients on maps (distinct from blue events, green hosts).
- "Nearby Recipients" section in right panel showing recipients within 15 miles of selected event.

**Technical Implementations & Feature Specifications:**
- **Authentication & Permissions**: Role-based access control, granular permissions, session management, password security, and active user enforcement. `APP_ENV` and `NODE_ENV` environment variables control authentication mode for development vs. production, with `REPLIT_DEPLOYMENT=1` forcing full authentication in deployed environments. Inactive users are blocked from protected routes via middleware, with an allowlist for public authentication-related routes.
  
  **CRITICAL PASSWORD HANDLING RULE:**
  - **NEVER** call `bcrypt.hash()` or `bcrypt.compare()` directly in route handlers
  - **ALWAYS** use `authService.hashPassword()` and `authService.verifyPassword()` from `server/services/auth.service.ts`
  - **Why**: The auth service trims passwords before hashing/comparing. Direct bcrypt calls skip trimming, causing hash mismatches when users copy/paste passwords with whitespace
  - **Key files**: `server/services/auth.service.ts` (centralized methods), `server/routes/password-reset.ts` (must use authService)
  
  **SUPER ADMIN BYPASS FIX (Dec 2024):**
  - **Issue**: Super admin users weren't getting all permissions because `role` was stripped when `/api/auth/user` fetched fresh user data from storage
  - **Root cause**: Storage layer didn't always return `role`, so `checkPermission` received `role: undefined` and the super_admin bypass at line 62-71 in `unified-auth-utils.ts` failed
  - **Fix**: `/api/auth/user` now explicitly includes `role: userRole` using fallback `freshUser.role ?? req.user.role`
  - **Key file**: `server/routes/auth/index.ts` (lines 228-241)
  
  **DRIVER ADDRESS PRESERVATION FIX (Jan 2026):**
  - **Issue**: Driver addresses were being erased when making partial updates (status toggle, notes, etc.)
  - **Root cause**: PUT/PATCH routes spread `req.body` directly, so undefined/empty address fields overwrote existing data with null
  - **Fix**: Both PUT and PATCH routes now preserve `address`, `homeAddress`, `latitude`, `longitude` fields when they're undefined or empty string in the request
  - **Key file**: `server/routes/drivers.ts` (lines 320-328 for PUT, lines 387-395 for PATCH)
- **Database Configuration**: Centralized database URL selection in `server/db-url.ts` based on `NODE_ENV` (development/production) to connect to appropriate Neon branches. Critical rule: Avoid `.returning()` on update operations with Neon serverless; always use an explicit fetch after update pattern.
- **Data Management**: Comprehensive management of collections, hosts, recipients, users, and audit logs with Zod validation, timezone-safe date handling, and soft deletes. `sandwich_collections` table is the operational source of truth.
- **Messaging & Notifications**: Email (SendGrid), Socket.IO chat, SMS via Twilio, and dashboard notifications. All outgoing emails are BCC'd to `katie@thesandwichproject.org`.
- **Operational Tools**: Project, meeting, and work log management, user feedback, analytics dashboards, and a permissions-based Collection Walkthrough Tool. Event impact reports only count actual `sandwichCollections` records.
- **Event Requests Management System**: Tracks requests, handles duplicate detection, manages statuses, integrates with Google Sheets, calculates van driver staffing, supports multi-recipient assignment, performs comprehensive intake validation, and features interactive Leaflet maps with AI Intake and Scheduling Assistants, including van conflict detection.
- **Real-Time Collaboration System**: Multi-user collaboration using a single Socket.IO instance for synchronization, presence tracking, field-level locking, threaded comments, and edit revision history.
- **User Activity Logging System**: Comprehensive tracking of authenticated user actions.
- **Sandwich Type Tracking System**: Comprehensive tracking for individual and group collections with real-time validation and analytics.
- **Interactive Route Map & Driver Optimization**: Leaflet map for visualizing host contact locations, route optimization, and driver assignment. Recipients are geocoded and displayed.
- **Automated Reminders**: 24-hour volunteer reminder system via cron job with configurable email/SMS delivery channels.
- **SMS Alert Configuration System**: Users can opt-in to SMS notifications. Event reminders support SMS delivery; other alert types are "Coming Soon" for SMS but support email.
- **TSP Holding Zone**: Inbox-style system for long-term ideas/tasks with categories, urgent flagging, commenting, likes, assignments, and a three-tier permission system.
- **Guided Tours & Onboarding System**: Interactive, permission-based step-by-step tours for new users, covering all major features, defined in `client/src/lib/tourDefinitions.ts`.
- **Error Handling & Logging**: Robust error handling with `lazyWithRetry` and improved production-safe logging.
- **Timezone Management**: Ensures accurate storage and display of user-entered times, strictly adhering to `timeZone: 'America/New_York'` and using utility functions to prevent timezone conversion issues. Critical rule: Never use `new Date(dateString)` directly on date-only strings; always use provided `date-utils.ts` helpers.
- **Google Sheets Sync**: Background service with comprehensive monitoring and alerts for sync status. Features triple deduplication (SHA-256 hash, legacy hash, fallback) and message backfill.
- **React Query Cache Management**: Uses `queryClient.refetchQueries` in mutation success handlers for immediate UI updates.
- **Organization Merge System**: Admin tool to merge duplicate organizations, including similarity scoring, merge preview, and batch updates. Note on `db.execute()`: results are QueryResult objects, access data via `.rows`.
- **Email Template Customization System**: Allows admins to customize key text sections of follow-up HTML emails via a dedicated UI, with content stored in `email_template_sections` and supporting placeholders.

### External Dependencies
- **Database**: `@neondatabase/serverless`, `drizzle-orm`
- **Web Framework**: `express`
- **UI/Styling**: `@radix-ui`, `tailwindcss`, `lucide-react`, `class-variance-authority`, `shadcn/ui`
- **Data Fetching/State**: `@tanstack/react-query`, `react-hook-form`, `zod`
- **Email**: `@sendgrid/mail`
- **Real-time Communication**: `socket.io`, `socket.io-client`
- **PDF Generation**: `pdfkit`
- **Authentication**: `connect-pg-simple`
- **File Uploads**: `multer`
- **Google Integration**: Google Sheets API, `@google-cloud/storage`, Google Analytics
- **Mapping**: `leaflet`, `react-leaflet`, `react-leaflet-cluster`
- **SMS**: `twilio` (using Replit Twilio integration)