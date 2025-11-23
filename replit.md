### Overview
This full-stack application for The Sandwich Project nonprofit is designed to streamline sandwich collections, donations, and distributions. It provides comprehensive data management, analytics, and operational tools for volunteers, hosts, and recipients. The project aims to enhance data visibility, support organizational growth, and become a vital tool for food security initiatives, ultimately reducing food waste and hunger.

### Recent Fixes (November 23, 2025)
**Comprehensive Communication Monitoring System:**
- **Automatic Email BCC**: All outgoing SendGrid emails automatically BCC katie@thesandwichproject.org for complete communication oversight
- **SMS Monitoring & Notifications**: Created `server/utils/sms-monitoring.ts` utility that sends email notifications to admin for every SMS sent (success or failure)
- **Complete Coverage**: Integrated monitoring into all 5 SMS functions in `server/sms-service.ts`:
  - `sendSMSReminder` - Weekly volunteer reminders (per-user + system-level error paths)
  - `sendTestSMS` - Test SMS functionality
  - `sendConfirmationSMS` - Verification codes (primary provider + Twilio fallback paths)
  - `sendWelcomeSMS` - Welcome messages for new SMS opt-ins
  - `sendTspContactAssignmentSMS` - TSP contact assignment notifications
- **Security & Privacy**: Phone numbers redacted in email notifications (shows last 4 digits only)
- **Non-Blocking Design**: All monitoring wrapped in try-catch blocks - monitoring failures never break SMS/email delivery
- **Key Files**: `server/sendgrid.ts`, `server/sms-service.ts`, `server/utils/sms-monitoring.ts`
- **Architecture Pattern**: Monitoring uses dynamic imports to avoid circular dependencies and safely handles all success/failure/exception paths

### Recent Fixes (November 22, 2025)
**Real-Time Collaboration System & Granular Permissions Enhancement:**
- **Re-enabled Socket.IO Event Collaboration**: Restored and fixed real-time collaboration features for event editing (presence tracking, field locking, comments, revision history)
- **Generic Collaboration Hook**: Created reusable `useCollaboration` hook that works with any resource type (events, holding zone items, planning workspaces, meetings) - eliminates code duplication
- **TSP Holding Zone Live Updates**: Added real-time presence tracking showing active viewers with avatar stack, connection status, and live item updates when users add/edit/delete items
- **Meeting Calendar Real-Time Broadcasting**: Enhanced Meeting Calendar to broadcast real-time updates when meetings are created, edited, or deleted - all users see changes instantly
- **@Mention Notification System**: Built comprehensive @mention detection and notifications - server detects mentions in comments, sends real-time notifications via Socket.IO user rooms, UI component displays unread mentions
- **Granular Permission System**: Expanded permissions with fine-grained controls:
  - **Holding Zone**: 7 new permissions (VIEW, ADD, EDIT_OWN, EDIT_ALL, DELETE_OWN, DELETE_ALL, MANAGE) replacing legacy 3-tier system while maintaining backward compatibility
  - **Projects Standalone Tasks**: 5 new permissions (TASK_ADD, TASK_EDIT_OWN, TASK_EDIT_ALL, TASK_DELETE_OWN, TASK_DELETE_ALL) for granular control over who can manage tasks
  - **Permission Groups**: Created HOLDING_ZONE group and updated PROJECTS group in permission configuration for organized UI display
- **Key Files**: `client/src/hooks/use-collaboration.ts`, `client/src/hooks/use-event-collaboration.ts`, `client/src/pages/HoldingZone.tsx`, `client/src/pages/meeting-calendar.tsx`, `server/socket-collaboration.ts`, `client/src/components/MentionNotifications.tsx`, `shared/auth-utils.ts`, `shared/permission-config.ts`
- **Architecture Pattern**: Generic collaboration hook enables multi-user editing features across different resource types without code duplication - presence tracking, field locking, comments, and real-time synchronization work uniformly

### Recent Fixes (November 21, 2025)
**CRITICAL: Database Schema Synchronization Fix**
- **Root Cause**: Development database was missing columns that exist in production (`deleted_at`, `deleted_by`, `individual_generic`)
- **Impact**: Code was incorrectly modified to work with incomplete dev database, breaking production queries
- **Fix**: 
  - Added missing columns to dev database: `individual_generic`, `deleted_at`, `deleted_by`
  - Restored all `deletedAt` filters in queries (they were incorrectly commented out)
  - Files updated: `server/database-storage.ts`, `server/data-export.ts`
- **Production Database Schema Confirmed**:
  - Has `deleted_at` and `deleted_by` columns (used for soft deletes)
  - Has `individual_generic` column (for generic sandwich type tracking)
  - Contains 1,794 collections with 2,071,167 total sandwiches
- **Lesson**: Always verify production schema before making code changes based on dev environment

**Production Logging Issue Resolution:**
- Fixed `[object Object]` errors in production logs by improving error serialization in `server/utils/production-safe-logger.ts`
- Logger now properly serializes Error objects, showing full error messages and stack traces instead of `[object Object]`
- Applied fix to all logging levels (info, warn, error) for consistent error reporting

**Activity Logs API Endpoint:**
- Added missing GET endpoint to `/api/activity-log` route to retrieve user activity logs with filtering options (startDate, endDate, action, section, limit)
- Added plural alias `/api/activity-logs` to match client-side calls from SpreadsheetAnalyticsDashboard
- Resolves 404 errors from production environment when fetching activity logs for analytics

**TSP Holding Zone - Complete Team Board Transformation (November 21, 2025):**
- **Replaced Kanban-style Team Board** with simple inbox-style "TSP Holding Zone" optimized for volunteers over 40
- **Flexible Category System**: Created `holding_zone_categories` table with 6 initial categories (group events, hosts, weekly collections, volunteers, tech, fundraising) plus dynamic creation capability
- **Three-Tier Permission System**: VIEW_HOLDING_ZONE (view only), SUBMIT_HOLDING_ZONE (create/edit own items), MANAGE_HOLDING_ZONE (manage all items and categories)
- **Production-Safe Security Implementation**: 
  - Layered middleware approach: requirePermission + requireOwnershipPermission
  - Both middleware functions fetch fresh user data from database on every request
  - Users whose permissions are revoked cannot access resources they created (verified by architect)
  - Pattern: All PATCH/DELETE endpoints check SUBMIT permission FIRST, then verify ownership OR MANAGE permission
  - Service layer protected by middleware at route level (no direct service calls without auth)
- **Database Integrity**: `createdBy` column has NOT NULL constraint, verified 0 null values in production
- **UI Features**: Simple list view, category filtering, urgent flag, status badges, comments, likes, assignments, @mentions
- **Key Files**: `client/src/pages/HoldingZone.tsx`, `server/routes/team-board.ts`, `server/routes/holding-zone-categories.ts`, `shared/schema.ts`
- **Security Requirement**: All future Holding Zone mutations MUST include the middleware sequence to maintain security guarantees

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
-   **TSP Holding Zone**: Simple inbox-style system for capturing long-term ideas and tasks with flexible categories, urgent flagging, commenting, likes, assignments, and three-tier permission system (VIEW/SUBMIT/MANAGE). Designed for volunteers over 40 with straightforward UX replacing complex Kanban-style Team Board.
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