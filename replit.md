# Replit.md

## Overview
This full-stack application for The Sandwich Project nonprofit manages sandwich collections, donations, and distributions. It provides comprehensive data management, analytics, and operational tools for volunteers, hosts, and recipients, aiming to streamline operations, enhance data visibility, and support the organization's growth. The business vision is to become a vital tool for food security initiatives, with market potential in supporting volunteer-driven community projects, scaling operations, and improving outreach to reduce food waste and hunger.

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

## System Architecture
The application uses a React 18 frontend with TypeScript, Vite, TanStack Query, and Tailwind CSS (with shadcn/ui). The backend is built with Express.js (TypeScript), Drizzle ORM, and PostgreSQL (Neon serverless), featuring session-based authentication. Database separation for development and production is handled via environment variables. Structured logging is implemented using Winston, and security includes centralized CORS configuration.

**Google Analytics Integration**: Properly configured with gtag.js dynamically loaded via `client/src/lib/analytics.ts`. The `useAnalytics` hook provides convenience methods for tracking downloads, form submissions, button clicks, navigation, searches, errors, and feature usage. Requires `VITE_GA_MEASUREMENT_ID` environment variable to be set. Events are sent to Google Analytics using the gtag API with proper event categories, actions, and labels.

**User Activity Tracking System**: Dual tracking system - (1) Google Analytics for behavioral analytics and (2) Database activity logging via `useUserActivityTracking` hook for detailed user work tracking. Database tracking captures granular interactions (kudos sent, files downloaded, forms submitted) with full context in `user_activity_logs` table, displayed in User Management dialog.

**Port Configuration (.replit file)**:
- Development (popout preview): `localPort = 5000`, `externalPort = 5000`
- Production (Autoscale deployment): `localPort = 5000`, `externalPort = 80`
- CRITICAL: Autoscale deployments fail if multiple port definitions exist - keep only ONE `[[ports]]` section.

**Authentication System**: The official authentication system in `server/temp-auth.ts` handles login/registration, session management via express-session with PostgreSQL storage, role-based access control, password resets via SendGrid, and profile management. The `isAuthenticated` middleware validates sessions, refreshes user permissions from the database, and updates `lastLoginAt` hourly for active users to track actual activity (not just login events). Environment-aware session cookie configuration supports both development and production. All fetch() requests for login, register, and forgot password forms must include `credentials: 'include'`.

The backend employs a modular router architecture. UI/UX design adheres to The Sandwich Project's official color palette and Roboto typography, prioritizing clarity, responsiveness, and visual hierarchy with card-based dashboards.

Key technical implementations include:
- **Unified Permissions System**: Consistent frontend/backend logic, visual role templates, and standardized `RESOURCE_ACTION` format, including granular functional permissions (e.g., `COOLERS_VIEW`, `COOLERS_REPORT_OWN`).
- **Data Management**: Comprehensive management of collections, hosts, recipients, users, and audit logs with Zod validation and timezone-safe date handling.
- **Authentication & Authorization**: Role-based access and 30-day session management.
- **Search & Filtering**: Real-time capabilities across management interfaces.
- **Performance Optimization**: Query optimization, caching, pagination, and database connection pooling.
- **Messaging & Notifications**: Multi-layered communication including email, Socket.IO chat, SMS via Twilio, and dashboard notifications.
- **Operational Tools**: Project, meeting, and work log management, user feedback, analytics dashboards, confidential documents toolkit, and a permissions-based Collection Walkthrough Tool.
- **Meeting Management**: Full-featured system with agenda compilation, project integration, PDF export, and permission-controlled notes. Includes a comprehensive history system and content transfer for discussion points and decision items.
- **Event Requests Management System**: Tracking, duplicate detection, status tracking, Google Sheets integration, van driver staffing calculations, organization categorization, and a comprehensive intake validation system with visual badges and a summary dialog.
- **Multi-Recipient Assignment System**: Events can be assigned to multiple destinations using a prefixed ID format and badge-based UI.
- **Google Sheets Integration**: Bidirectional automatic synchronization for project tracker and event requests. Official Sheet Tracking via a toggle badge.
- **User Activity Logging System**: Comprehensive tracking of authenticated user actions into `user_activity_logs` table via middleware.
- **Sandwich Type Tracking System**: Comprehensive tracking of sandwich types for individual sandwiches and group collections with real-time validation, display, and analytics.
- **Interactive Route Map & Driver Optimization**: Interactive Leaflet map for visualizing host contact locations, multi-host selection, route optimization, driver assignment, and export capabilities.
- **Sandwich Forecasting Accuracy**: Forecasting tool uses actual recorded counts for completed events and estimated counts for scheduled/in-process events.
- **24-Hour Volunteer Reminder System**: Automated email reminder system via cron job, sending branded, role-specific emails with timezone accuracy.
- **Project Archiving**: Correct endpoint usage for archiving projects to `archived_projects` table and deleting from `projects`, with full cache invalidation.
- **Team Board Commenting System**: Full-featured commenting system on all team board items with real-time comment counts, author-specific deletion, and efficient data aggregation.
- **HTML Email Rendering Fix**: Prioritizes HTML content for SendGrid emails to ensure proper branding and styling.
- **User Management Dialog Scope**: Streamlined to focus solely on user administration (Profile, Permissions, Activity), with other feature pages existing as standalone dashboard navigations.
- **Granular Functional Permissions System**: In addition to navigation permissions (`NAV_*`), the system implements granular functional permissions that control what users can DO within each feature. This includes functional permissions for Grant Metrics (`GRANT_METRICS_VIEW`, `GRANT_METRICS_EXPORT`, `GRANT_METRICS_EDIT`), Cooler Tracking (`COOLERS_VIEW` for seeing all cooler locations, `COOLERS_REPORT` for reporting/updating cooler locations, `COOLERS_MANAGE` for admin cooler type management), and Volunteer Calendar (`VOLUNTEER_CALENDAR_VIEW`, `VOLUNTEER_CALENDAR_SYNC`, `VOLUNTEER_CALENDAR_MANAGE`). These functional permissions are automatically granted via `PERMISSION_DEPENDENCIES` when the corresponding navigation permission is assigned (e.g., `NAV_COOLER_TRACKING` automatically grants `COOLERS_VIEW` and `COOLERS_REPORT` since the entire point of cooler tracking is for everyone to see where all coolers are and who has how many). Permissions are organized in the permissions editor under dedicated groups (Grant Metrics, Cooler Tracking, Volunteer Calendar) separate from the Navigation Tabs group, allowing administrators to fine-tune access control beyond just navigation visibility.
- **Mobile Login Whitespace Fix**: Authentication endpoint now trims both email and password inputs before validation to handle mobile keyboard whitespace issues. Email is trimmed and converted to lowercase, and password comparison trims both stored and input values before strict comparison. This resolves mobile login failures caused by autocorrect adding spaces or paste operations including trailing whitespace.
- **Password Storage Consolidation (October 2025)**: Completed migration to consolidate password storage from dual locations (metadata->password JSON field and password column) into a single password column. All 29 active users migrated successfully - 20 passwords moved from metadata, 9 users assigned temporary password "sandwich123" for lacking any password. All authentication endpoints (login, registration, change password, admin reset) updated to use password column exclusively with whitespace trimming for mobile compatibility. Migration script (`server/migrate-passwords.ts`) handles metadata extraction, JSON-wrapped password column values, and temporary password generation. See PRODUCTION-PASSWORD-MIGRATION.md for complete migration documentation and list of users requiring password resets.

## External Dependencies
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
- **Mapping**: `leaflet@1.9.4`, `react-leaflet@4.2.1`