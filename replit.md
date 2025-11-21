### Overview
This full-stack application for The Sandwich Project nonprofit is designed to streamline sandwich collections, donations, and distributions. It provides comprehensive data management, analytics, and operational tools for volunteers, hosts, and recipients. The project aims to enhance data visibility, support organizational growth, and become a vital tool for food security initiatives, ultimately reducing food waste and hunger.

### Recent Fixes (November 21, 2025)
**CRITICAL: Database Schema Fixes for Sandwich Total Display**
- **Issue 1 - deletedAt Column**: Database queries were filtering by `deletedAt` column that doesn't exist in production
  - **Files Fixed**: `server/database-storage.ts`, `server/data-export.ts` - Commented out all `deletedAt` filters
  - **Next Steps**: Need to add `deletedAt` and `deletedBy` columns via proper migration
- **Issue 2 - individual_generic Column**: Schema defined `individual_generic` but column didn't exist in database
  - **Root Cause**: Query failed with "column individual_generic does not exist" error, causing 0 sandwiches to display
  - **Fix**: Added missing column via `ALTER TABLE sandwich_collections ADD COLUMN IF NOT EXISTS individual_generic INTEGER`
  - **Impact**: Restored correct sandwich totals display
- **Verification**: Database contains 1,794 collections with 2,071,167 total sandwiches (individual: 1,649,717 + groups: 421,450)

**Production Logging Issue Resolution:**
- Fixed `[object Object]` errors in production logs by improving error serialization in `server/utils/production-safe-logger.ts`
- Logger now properly serializes Error objects, showing full error messages and stack traces instead of `[object Object]`
- Applied fix to all logging levels (info, warn, error) for consistent error reporting

**Activity Logs API Endpoint:**
- Added missing GET endpoint to `/api/activity-log` route to retrieve user activity logs with filtering options (startDate, endDate, action, section, limit)
- Added plural alias `/api/activity-logs` to match client-side calls from SpreadsheetAnalyticsDashboard
- Resolves 404 errors from production environment when fetching activity logs for analytics

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

**Key Technical Implementations & Features:**
-   **Authentication & Permissions**: Role-based access control, session management, and password security.
-   **Data Management**: Comprehensive management of collections, hosts, recipients, users, and audit logs with Zod validation and timezone-safe date handling. `sandwich_collections` table is the operational source of truth. Department names are stored in the groupCollections JSONB array and displayed in the collections log under each group name.
-   **Search & Filtering**: Real-time capabilities across management interfaces.
-   **Performance Optimization**: Query optimization, caching, pagination, and database connection pooling.
-   **Messaging & Notifications**: Email (SendGrid), Socket.IO chat, SMS via Twilio, and dashboard notifications, including real-time kudos.
-   **Operational Tools**: Project, meeting, and work log management, user feedback, analytics dashboards, and a permissions-based Collection Walkthrough Tool.
-   **Event Requests Management System**: Tracks requests, handles duplicate detection, manages statuses, integrates with Google Sheets, calculates van driver staffing, supports multi-recipient assignment, performs comprehensive intake validation, and features interactive Leaflet maps with AI Intake and Scheduling Assistants.
-   **Real-Time Event Collaboration System**: Multi-user collaboration for event editing with Socket.IO synchronization, including presence tracking, field-level locking, threaded comments, and edit revision history.
-   **User Activity Logging System**: Comprehensive tracking of authenticated user actions.
-   **Sandwich Type Tracking System**: Comprehensive tracking for individual and group collections with real-time validation and analytics.
-   **Interactive Route Map & Driver Optimization**: Leaflet map for visualizing host contact locations, route optimization, and driver assignment.
-   **Automated Reminders**: 24-hour volunteer reminder system via cron job.
-   **Team Board**: Commenting system with real-time counts and multi-user assignment.
-   **Email System**: Uses `katie@thesandwichproject.org` as the verified SendGrid sender with table-based HTML templates.
-   **SMS Notifications**: Opt-in SMS alerts for assignment notifications and event details sharing, secured by Twilio signature validation with mandatory consent verification, and an emergency correction SMS feature.
-   **Expenses Receipt Upload**: Handles receipt uploads to Google Cloud Storage.
-   **Dashboard Annual Goal Display**: Displays the organizational annual goal of 500,000 sandwiches.
-   **Social Media Graphics**: Supports image and PDF uploads to Google Cloud Storage with optional email notifications.
-   **UI Design System**: Modern, compact design with white card backgrounds, colored left borders for status, warm paper tone page background, subtle shadows, and a strong tonal hierarchy.
-   **Robust Error Handling**: Implemented `lazyWithRetry` for dynamic component imports.
-   **Timezone Management**: Ensures accurate storage of user-entered times.
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