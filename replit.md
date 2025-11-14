### Overview
This full-stack application for The Sandwich Project nonprofit streamlines sandwich collections, donations, and distributions. It provides comprehensive data management, analytics, and operational tools for volunteers, hosts, and recipients. The project aims to enhance data visibility, support organizational growth, and become a vital tool for food security initiatives, ultimately reducing food waste and hunger.

### User Preferences
Preferred communication style: Simple, everyday language.
UI Design: Button labels and interface text must be extremely clear about their function - avoid ambiguous labels like "Submit" in favor of specific action descriptions like "Enter New Data".
Form Design: Eliminate redundant or confusing form fields - host dialogs should have a single "Host Location Name" field instead of separate "Name" and "Host Location" fields.
Mobile UX Priority: Mobile user experience is critical - chat positioning and space efficiency are key concerns. Vehicle type should NOT be required for new driver entries.
Documentation: All technical findings and fixes must be documented in replit.md to avoid repeated searching and debugging.
Analytics Philosophy: NEVER compare or rank hosts against each other. The Sandwich Project is about increasing volunteer turnout globally, not about which host reported more/less sandwiches. All host comparison features, "top performing hosts", "underperforming hosts", and similar language must be removed from analytics.
Desktop Chat UX: Desktop users require proper scrolling behavior without nested scrolling containers that cause page focus issues - chat layout must handle desktop and mobile differently.

### Recent Technical Fixes
**"Use in Next Agenda" Button Failures Fixed (Nov 14, 2025)**: Fixed 404 errors when clicking "Use in Next Agenda" on meeting notes. **Problem**: User experienced repeated failures with the "Use in Next Agenda" button on the meeting notes page - clicking the button would result in a 404 error: `PATCH /api/projects/[id] 404 (Not Found)`. This happened despite the project appearing to exist in the UI. **Root Cause**: The issue was a consequence of the Archived Projects Recreated bug (see below). During the period when projects were being repeatedly archived and recreated by background sync, meeting notes were created that referenced specific project IDs. When those projects were later archived and recreated, they received new IDs, leaving the old notes "orphaned" - referencing project IDs that no longer existed. Investigation revealed one orphaned note (ID 29) that referenced deleted project ID 62 ("Volunteer recruitment for events and drivers"). **Race Condition**: The error occurred due to a timing issue: (1) Page loaded with project in cache, (2) Background sync archived/recreated the project with a new ID, (3) User clicked "Use in Next Agenda", (4) Frontend check passed using stale cache, (5) PATCH sent to old project ID, (6) Backend returned 404 because that ID no longer existed. **Solution**: (1) Fixed the underlying Archived Projects bug (see below) to prevent future orphaned notes, (2) Cleaned up existing orphaned meeting notes by deleting notes that reference non-existent projects using SQL: `DELETE FROM meeting_notes WHERE project_id IS NOT NULL AND project_id NOT IN (SELECT id FROM projects)`, (3) The frontend already has defensive checks (NotesTab.tsx line 576) to prevent clicking on notes with missing projects - this now works correctly with stable project IDs. **Impact**: "Use in Next Agenda" button now works reliably without 404 errors. No new orphaned notes will be created since projects are no longer being repeatedly archived/recreated. **Verification**: Test by clicking "Use in Next Agenda" on meeting notes - should successfully add projects to agenda without 404 errors. Location: `client/src/components/meetings/dashboard/tabs/NotesTab.tsx` (lines 572-594), database cleanup completed Nov 14, 2025.

**CRITICAL: Archived Projects Recreated by Background Sync Bug Fixed (Nov 14, 2025)**: Fixed persistent issue where archiving projects from the meetings agenda planning tab would work initially, but projects would reappear within 5 minutes. **Problem**: User repeatedly tried to archive projects (Zero Waste Grant, Cox Grant, Whole Foods Grant) and they kept coming back. The archive button appeared to work, but projects reappeared after background sync ran. **Root Cause Chain**: (1) The `archivedProjects` table was missing the `google_sheet_row_id` column in the actual database (schema defined it, but ALTER TABLE migration never ran), (2) Some projects had status='archived' in the `projects` table instead of being moved to `archivedProjects` table (improper archiving), (3) Background sync's `bidirectionalSync()` checks `archivedProjects` table for matches by `google_sheet_row_id` before recreating projects from Google Sheets, (4) Without the column, all archived projects had NULL `google_sheet_row_id`, so `bidirectionalSync()` couldn't recognize them and recreated them every 5 minutes. **Solution**: (1) Added missing `google_sheet_row_id text` column to `archivedProjects` table via `ALTER TABLE`, (2) The `archiveProject()` function (line 494 of database-storage.ts) already had code to preserve this field - it just couldn't save it without the column, (3) Properly archived the problem projects by moving them from `projects` table → `archivedProjects` table with their `google_sheet_row_id` values preserved, (4) `bidirectionalSync()` code (lines 311, 420-446 of server/google-sheets-sync.ts) already had archived project checking - it now works correctly because the column exists. **Impact**: Projects stay archived permanently. Background sync tested and verified - no recreations after 5-minute sync cycle. New archives will work correctly going forward because the column exists. **Verification**: Verified Nov 14, 2025 - background sync ran, 0 projects created, archived projects stayed archived. Location: `server/database-storage.ts` (line 494), `server/google-sheets-sync.ts` (lines 311, 420-446), database schema fix via `ALTER TABLE archived_projects ADD COLUMN google_sheet_row_id text`.

### System Architecture
The application features a React 18 frontend with TypeScript, Vite, TanStack Query, and Tailwind CSS (with shadcn/ui). The backend uses Express.js (TypeScript), Drizzle ORM, and PostgreSQL (Neon serverless), including session-based authentication. The UI/UX adheres to The Sandwich Project's official color palette and Roboto typography, prioritizing clarity, responsiveness, and card-based dashboards.

**Key Technical Implementations & Features:**
-   **Authentication & Permissions**: Role-based access control, session management, password security, and unified permissions.
-   **Data Management**: Comprehensive management of collections, hosts, recipients, users, and audit logs with Zod validation and timezone-safe date handling. `sandwich_collections` table is the operational source of truth.
-   **Search & Filtering**: Real-time capabilities across management interfaces.
-   **Performance Optimization**: Query optimization, caching, pagination, and database connection pooling.
-   **Messaging & Notifications**: Email (SendGrid), Socket.IO chat, SMS via Twilio, and dashboard notifications. Includes real-time kudos notifications.
-   **Operational Tools**: Project, meeting, and work log management, user feedback, analytics dashboards, and a permissions-based Collection Walkthrough Tool.
-   **Event Requests Management System**: Tracks requests, handles duplicate detection, manages statuses, integrates with Google Sheets, calculates van driver staffing, supports multi-recipient assignment, and performs comprehensive intake validation. Features an interactive Leaflet map with enhanced popups, geocoding, AI Intake Assistant, and AI Scheduling Assistant.
-   **Real-Time Event Collaboration System**: Full multi-user collaboration for event editing with Socket.IO real-time synchronization, including presence tracking, field-level locking, threaded comments, and edit revision history.
-   **Google Sheets Integration**: Bidirectional automatic synchronization for project tracker and event requests.
-   **User Activity Logging System**: Comprehensive tracking of authenticated user actions.
-   **Sandwich Type Tracking System**: Comprehensive tracking for individual and group collections with real-time validation and analytics.
-   **Interactive Route Map & Driver Optimization**: Leaflet map for visualizing host contact locations, route optimization, and driver assignment.
-   **Automated Reminders**: 24-hour volunteer reminder system via cron job.
-   **Team Board**: Commenting system with real-time counts and multi-user assignment.
-   **Email System**: Uses `katie@thesandwichproject.org` as the verified SendGrid sender with table-based HTML templates.
-   **SMS Notifications**: Opt-in SMS alerts for assignment notifications and event details sharing, secured by Twilio signature validation with mandatory consent verification. Includes emergency correction SMS feature.
-   **Expenses Receipt Upload**: Handles receipt uploads to Google Cloud Storage.
-   **Dashboard Annual Goal Display**: Displays the organizational annual goal of 500,000 sandwiches.
-   **Social Media Graphics**: Supports image and PDF uploads to Google Cloud Storage with optional email notifications.
-   **Progressive Web App (PWA)**: Full PWA support enabling mobile installation, offline access, and real-time updates.
-   **UI Design System**: Modern, compact design with white card backgrounds, colored left borders for status, warm paper tone page background, subtle shadows, and a strong tonal hierarchy.
-   **Robust Error Handling**: Implemented `lazyWithRetry` for dynamic component imports.
-   **Timezone Management**: Fixed critical timezone conversion bugs to ensure accurate storage of user-entered times.
-   **Storage Wrapper**: Includes a `StorageWrapper` with fallback mechanisms for database operations.

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
-   **SMS**: `twilio`