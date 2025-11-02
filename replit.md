## Overview
This full-stack application for The Sandwich Project nonprofit manages sandwich collections, donations, and distributions. It provides comprehensive data management, analytics, and operational tools for volunteers, hosts, and recipients. The project aims to streamline operations, enhance data visibility, and support organizational growth, with a vision to become a vital tool for food security initiatives by scaling operations and improving outreach to reduce food waste and hunger.

## User Preferences
Preferred communication style: Simple, everyday language.
UI Design: Button labels and interface text must be extremely clear about their function - avoid ambiguous labels like "Submit" in favor of specific action descriptions like "Enter New Data".
Form Design: Eliminate redundant or confusing form fields - host dialogs should have a single "Host Location Name" field instead of separate "Name" and "Host Location" fields.
Mobile UX Priority: Mobile user experience is critical - chat positioning and space efficiency are key concerns. Vehicle type should NOT be required for new driver entries.
Documentation: All technical findings and fixes must be documented in replit.md to avoid repeated searching and debugging.
Date Display & Search Fix: When displaying OR searching dates from the database, always use `timeZone: 'UTC'` in toLocaleDateString() and UTC methods (getUTCMonth, getUTCDate, getUTCFullYear) to prevent timezone conversion bugs that cause off-by-one-day errors (e.g., `date.toLocaleDateString('en-US', { timeZone: 'UTC' })`). This applies to both display formatting AND search/filter logic.
Navigation Icons: Collections log icon in simple-nav should use sandwich logo.png from LOGOS folder.
Desktop Chat UX: Desktop users require proper scrolling behavior without nested scrolling containers that cause page focus issues - chat layout must handle desktop and mobile differently.
Analytics Philosophy: NEVER compare or rank hosts against each other. The Sandwich Project is about increasing volunteer turnout globally, not about which host reported more/less sandwiches. All host comparison features, "top performing hosts", "underperforming hosts", and similar language must be removed from analytics.
Activity Notifications UX: User activity displays must show meaningful action descriptions from the `details` field (e.g., "Updated user account settings", "Created new project") NOT generic actions+URLs (e.g., "View /dashboard"). The activity logger middleware generates detailed human-readable descriptions - always display these to users. Replace generic "Top Actions" lists with "Most Used Features" showing actual sections worked in.
Recipient Name Display Fix: The `resolveRecipientName` function in ScheduledCardEnhanced handles multiple ID formats: (1) Custom entries like `custom-1761977247368-David` display as just "David" by extracting the name after the timestamp, (2) Plain numeric IDs like "16" search through host contacts/locations/recipients and display the proper name (e.g., "Marcy Louza (Dunwoody/PTC)"), (3) Prefixed IDs like `host:16` or `recipient:10` are also properly resolved. This ensures scheduled event cards always show human-readable names instead of IDs or technical identifiers.

## System Architecture
The application features a React 18 frontend with TypeScript, Vite, TanStack Query, and Tailwind CSS (with shadcn/ui). The backend uses Express.js (TypeScript), Drizzle ORM, and PostgreSQL (Neon serverless), including session-based authentication. It uses environment variables for database separation, Winston for structured logging, and centralized CORS for security. The UI/UX adheres to The Sandwich Project's official color palette and Roboto typography, prioritizing clarity, responsiveness, and card-based dashboards.

**Key Technical Implementations & Features:**
-   **Authentication System**: Handles login/registration, session management with PostgreSQL storage, role-based access control, password resets, and profile management.
-   **Unified Permissions System**: Consistent frontend/backend logic, visual role templates, and granular functional permissions.
-   **Data Management**: Comprehensive management of collections, hosts, recipients, users, and audit logs with Zod validation and timezone-safe date handling.
-   **Weekly Monitoring - Dunwoody Logic**: Dunwoody requires two separate entries: (1) Lisa Hiles AND (2) either Stephanie/Marcy OR admin submissions (Katie/Christine) that count as accounting for Stephanie/Marcy's data.
-   **Collection Log Data Architecture**: The `sandwich_collections` table is the operational source of truth (~2.1M sandwiches total). Scott's Excel (`authoritative_weekly_collections`) was historical reference data that stopped being updated in August 2025. Grant metrics calculates directly from the collection log. IMPORTANT: "Groups" entries in the collection log are legitimate data and must be included in totals (previously they were incorrectly filtered out as duplicates).
-   **Search & Filtering**: Real-time capabilities across management interfaces.
-   **Performance Optimization**: Query optimization, caching, pagination, and database connection pooling.
-   **Messaging & Notifications**: Email (SendGrid), Socket.IO chat, SMS via Twilio, and dashboard notifications.
-   **Operational Tools**: Project, meeting, and work log management, user feedback, analytics dashboards, and a permissions-based Collection Walkthrough Tool.
-   **Meeting Management**: Full-featured system with agenda compilation, project integration, PDF export, and permission-controlled notes.
-   **Event Requests Management System**: Tracking, duplicate detection, status tracking, Google Sheets integration, van driver staffing calculations, and comprehensive intake validation. Supports multi-recipient assignment. Event cards have a clean design with status-colored borders and pastel-background sections.
-   **Google Sheets Integration**: Bidirectional automatic synchronization for project tracker and event requests, with dual-layer duplicate prevention and auto-transition for event statuses.
-   **User Activity Logging System**: Comprehensive tracking of authenticated user actions via middleware, displayed in User Management.
-   **Sandwich Type Tracking System**: Comprehensive tracking for individual and group collections with real-time validation, display, and analytics.
-   **Interactive Route Map & Driver Optimization**: Interactive Leaflet map for visualizing host contact locations, multi-host selection, route optimization, and driver assignment.
-   **Sandwich Forecasting Accuracy**: Uses actual recorded counts for completed events and estimated counts for scheduled/in-process events.
-   **24-Hour Volunteer Reminder System**: Automated email reminder system via cron job.
-   **Team Board Commenting System**: Full-featured commenting system with real-time comment counts and author-specific deletion.
-   **Team Board Multi-User Assignment**: Supports multiple assignees with individual removal and multi-select UI.
-   **Guided Tour UX Improvements**: Enhanced tutorial experience.
-   **Email System Configuration**: Uses `katie@thesandwichproject.org` as the verified SendGrid sender. Email templates are table-based HTML with inline CSS. BCC duplicate prevention logic is implemented.
-   **Password Security**: Stores user passwords as bcrypt hashes; auto-upgrades legacy passwords on login.
-   **User Creation**: New user creation requires and sets passwords correctly.
-   **Assignment Email Notifications**: Sends emails to newly assigned users for tasks, projects, events, and team board items.
-   **Groups Catalog Deduplication**: Skips collection log entries if an event request exists for the same organization within ±7 days to prevent double-counting.
-   **Organizations Data**: Comprehensive organization metadata import with categories, school classifications, and religious flags.
-   **OpenAPI Configuration**: Extends Zod with OpenAPI support for schema validation and documentation.
-   **Expenses Receipt Upload**: Handles receipt uploads to Google Cloud Storage via `ObjectStorageService`, returning signed URLs.
-   **Dashboard Annual Goal Display**: Displays the correct organizational annual goal of 500,000 sandwiches.
-   **Social Media Graphics**: Supports image and PDF uploads (up to 10MB) to Google Cloud Storage with optional email notifications controlled by a user checkbox.
-   **SMS Opt-In Email Campaign**: Admins can select users in User Management and send detailed email instructions with direct profile link, explaining how to opt-in to SMS notifications. Email includes 5-step walkthrough, "what you'll receive" section, and branded HTML template from katie@thesandwichproject.org. Fixed double-message bug - users now receive only confirmation SMS at opt-in, then welcome SMS after confirmation.
-   **TSP Contact SMS Notifications**: When users are assigned as TSP contact on event requests, they receive an SMS with organization name, event date, and direct link to view the event in the app. Only sends to users who have confirmed SMS opt-in. Messages are generic about event assignments and notifications, not specific to sandwich counts.
-   **SMS Launch Announcement Modal**: One-time popup shown to all users on login announcing SMS alerts are live. Links directly to profile settings for easy signup. Tracked via dismissed_announcements table to ensure users only see it once. Generic announcement system supports future one-time announcements.
-   **SMS Webhook Authentication Fix**: The Twilio SMS webhook endpoint (`/api/sms/webhook`) must NOT have session-based authentication because Twilio makes unauthenticated POST requests. The endpoint is secured by Twilio signature validation instead. Individual SMS routes have their own authentication middleware where needed. CRITICAL: Never add global `isAuthenticated` middleware to smsUserRoutes - it causes Twilio Error 11200 (webhook 401 Unauthorized failures).
-   **Event Request Audit Logging Data Integrity Fix (Nov 2025)**: Fixed critical audit logging gap where event requests created through import paths (Google Sheets, Excel, scheduled events imports) were missing audit trail entries. ROOT CAUSE: Only the manual API creation endpoint (`POST /api/event-requests`) had audit logging - all import paths either called `storage.createEventRequest()` directly or used direct database insertion without logging. This caused events imported with TSP contact assignments to appear in the system with no audit history. FIX: Added `AuditLogger.logEventRequestChange()` calls to all import paths: (1) Google Sheets bulk imports (`/import-events` - 4 routes), (2) Google Sheets automatic sync (`syncFromGoogleSheets()` - uses direct DB insert), (3) Excel import service (`excel-import-service.ts`), (4) Scheduled events import (`import-scheduled-events.ts`). All imports now create audit logs with `userId: 'SYSTEM'`, descriptive `userAgent` values (e.g., "Excel - Historical 2024 Import", "Google Sheets - Automatic Sync"), and operation context (e.g., `operation: 'GOOGLE_SHEETS_IMPORT'`, `GOOGLE_SHEETS_SYNC`). This ensures complete audit trail for all event request creation paths, regardless of entry method.
-   **Event Requests Interactive Map (Nov 2025)**: Created map view displaying event requests with addresses on an interactive Leaflet map. Features include: color-coded markers by status (gold=new, yellow=in_process, blue=scheduled, green=completed, grey=declined), search and status filtering, click-to-geocode sidebar for events without coordinates, popup details for each event. Uses free OpenStreetMap Nominatim API with server-side rate limiting (1 req/sec) enforced via singleton rate limiter to comply with usage policy and prevent IP blacklisting. Added latitude/longitude fields to eventRequests schema.
-   **Progressive Web App (PWA) Implementation (Nov 2025)**: Full PWA support enabling mobile installation, offline access, and real-time updates. Includes: web app manifest (`client/public/manifest.json`) with app metadata, icons, shortcuts to Collection Log/Event Requests/Messages; service worker (`client/public/service-worker.js`) with network-first strategy for API calls, cache-first for static assets, offline fallback responses, and push notification handlers; PWA install prompt component with dismissible UI appearing after 3-second delay; PWA status indicators showing app mode and online/offline state; Apple iOS and Microsoft Tiles support with meta tags. Service worker auto-registers on load and provides background sync capability for future enhancements. Users can install the app on mobile devices directly from browser without app stores.

## External Dependencies
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
-   **Mapping**: `leaflet@1.9.4`, `react-leaflet@4.2.1`