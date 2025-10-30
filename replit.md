# Replit.md

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
Password Security: All user passwords are stored as bcrypt hashes. Auto-upgrade on login converts any legacy plaintext/JSON passwords to bcrypt automatically (server/routes/auth.ts). Migration completed Oct 24, 2025 - all 29 users migrated from JSON/plaintext to bcrypt hashes.
User Creation Password Fix: Fixed critical issue (Oct 29, 2025) where creating new users didn't set passwords, leaving accounts unable to log in. User creation now requires a password field (min 6 chars) and automatically calls both POST /api/users and PATCH /api/users/:id/password APIs. Password field is required in UserFormDialog and handleAddUser in user-management-redesigned.tsx handles the two-step process automatically with proper success/error feedback.
Assignment Email Notifications: Comprehensive email notification system sends emails whenever users are assigned to tasks, projects, events, or team board items. Implemented Oct 25, 2025 using SendGrid with EmailNotificationService for team board/event assignments and NotificationService for project assignments. Only newly assigned users (not previously assigned) receive notifications to avoid spam.
Groups Catalog Deduplication: All events post-launch exist in BOTH event_requests AND sandwich_collections tables. Groups Catalog deduplicates by skipping collection log entries if an event request exists for the same organization within ±7 days (server/routes/collections/groups-catalog.ts:234-252). This prevents double-counting while preserving historical pre-request-system collections.
Organizations Data Import: Successfully imported 605 organizations (Oct 25, 2025) with comprehensive metadata including category, school_classification, is_religious flag, and department tracking. Database includes 21 unique organization categories and 69 religious organizations. Import script available at server/scripts/import-organizations.ts for future updates.
OpenAPI Configuration Fix: To resolve "z.object(...).openapi is not a function" errors, created server/lib/zod-openapi.ts that extends Zod with OpenAPI support before any schema files are loaded. All OpenAPI doc files (server/docs/*.openapi.ts) must import { z } from '../lib/zod-openapi' instead of from 'zod' directly. This prevents circular dependency issues and ensures the .openapi() method is available globally.
Event Request Card Design: Scheduled event cards (client/src/components/event-requests/cards/ScheduledCard.tsx) use clean white background with 4px status-colored left border. Font sizing updated from oversized (text-5xl font-black) to readable (text-xl sm:text-2xl font-bold). Sections use subtle pastel backgrounds: Contact Info (gray-50), Event Details (blue-50), Delivery & Logistics (teal-50), Team Assignments (purple-50), Notes (amber-50). Oct 28, 2025.
TSP Contact Assignment Permissions: Only specific emails can assign TSP contacts to events. Whitelist maintained at server/routes/event-requests.ts lines 2788-2794 includes: admin@sandwich.project, katielong2316@gmail.com, and christine@thesandwichproject.org. Oct 29, 2025.
Expenses Receipt Upload Fix: Fixed critical bug (Oct 29, 2025) where server crashed on startup due to missing uploadToStorage function. Created ObjectStorageService.uploadLocalFile() method in server/objectStorage.ts to handle receipt uploads to Google Cloud Storage. Expenses route (server/routes/expenses.ts) now properly uploads receipt files and returns signed URLs for storage.
Dashboard Annual Goal Display: Fixed mislabeled "Annual Target" metric (Oct 30, 2025) that showed calculated historical average (~447k) instead of actual organizational goal. Dashboard now displays the correct annual goal of 500,000 sandwiches. Changed label from "Annual Target" to "Annual Goal" and subtitle from "Current year" to "2025 Target" (client/src/components/dashboard-overview.tsx:361-362, 585-587).
Social Media Graphics Notification Control: Added optional notification checkbox (Oct 30, 2025) to prevent automatic email spam when uploading social media graphics. By default, graphics upload without sending notifications. Users must explicitly check the "Send email notifications" checkbox to notify the target audience. Checkbox shows dynamic messaging based on selected audience (hosts/volunteers/everyone). Backend only sends emails if sendNotification flag is true (server/routes/promotion-graphics.ts:45, 194-201; client/src/pages/promotion-graphics.tsx:86, 465-484).
Peak Year Data Analysis: Database analysis (Oct 30, 2025) confirms 2022 was the organization's peak year with 361,505 total sandwiches across 451 collections. Annual totals: 2022 (361,505), 2024 (303,236), 2021 (278,395), 2025 (242,299 incomplete), 2020 (44,958). NOTE: Zero 2023 data exists in the database. Fixed hardcoded "Nov 15, 2023" peak week date on dashboard to display actual calculated peak week from real data (client/src/components/dashboard-overview.tsx:576).

## System Architecture
The application features a React 18 frontend with TypeScript, Vite, TanStack Query, and Tailwind CSS (with shadcn/ui). The backend uses Express.js (TypeScript), Drizzle ORM, and PostgreSQL (Neon serverless), including session-based authentication. It uses environment variables for database separation, Winston for structured logging, and centralized CORS for security. The UI/UX adheres to The Sandwich Project's official color palette and Roboto typography, prioritizing clarity, responsiveness, and card-based dashboards.

**Key Technical Implementations & Features:**
-   **Authentication System**: Handles login/registration, session management with PostgreSQL storage, role-based access control, password resets, and profile management.
-   **Unified Permissions System**: Consistent frontend/backend logic, visual role templates, and granular functional permissions.
-   **Data Management**: Comprehensive management of collections, hosts, recipients, users, and audit logs with Zod validation and timezone-safe date handling.
-   **Search & Filtering**: Real-time capabilities across management interfaces.
-   **Performance Optimization**: Query optimization, caching, pagination, and database connection pooling.
-   **Messaging & Notifications**: Email, Socket.IO chat, SMS via Twilio, and dashboard notifications.
-   **Operational Tools**: Project, meeting, and work log management, user feedback, analytics dashboards, and a permissions-based Collection Walkthrough Tool.
-   **Meeting Management**: Full-featured system with agenda compilation, project integration, PDF export, and permission-controlled notes.
-   **Event Requests Management System**: Tracking, duplicate detection, status tracking, Google Sheets integration, van driver staffing calculations, and comprehensive intake validation.
-   **Multi-Recipient Assignment**: Events can be assigned to multiple destinations with prefixed IDs and badge-based UI, showing individual host contacts.
-   **Google Sheets Integration**: Bidirectional automatic synchronization for project tracker and event requests, with dual-layer duplicate prevention and auto-transition for event statuses.
-   **User Activity Logging System**: Comprehensive tracking of authenticated user actions into `user_activity_logs` table via middleware, displayed in User Management.
-   **Sandwich Type Tracking System**: Comprehensive tracking of sandwich types for individual sandwiches and group collections with real-time validation, display, and analytics.
-   **Interactive Route Map & Driver Optimization**: Interactive Leaflet map for visualizing host contact locations, multi-host selection, route optimization, and driver assignment.
-   **Sandwich Forecasting Accuracy**: Uses actual recorded counts for completed events and estimated counts for scheduled/in-process events.
-   **24-Hour Volunteer Reminder System**: Automated email reminder system via cron job.
-   **Team Board Commenting System**: Full-featured commenting system with real-time comment counts and author-specific deletion.
-   **Team Board Multi-User Assignment**: Team board items support multiple assignees via text[] arrays for assignedTo and assignedToNames fields, with individual remove buttons and multi-select UI.
-   **Guided Tour UX Improvements**: Enhanced tutorial experience with reduced overlay dimming and improved scrolling behavior.

**Email System Configuration (CRITICAL):**
-   **SendGrid Setup**: Uses `katie@thesandwichproject.org` as the verified sender domain.
-   **Email Templates**: Table-based HTML layouts with inline CSS (no external stylesheets). Must reference 5 attached PDFs and a "Budget & Shopping Planner" link. Sent HTML-only to ensure proper rendering.
-   **BCC Duplicate Prevention**: Fixed Oct 29, 2025 - SendGrid rejects emails when same address appears in both 'to' and 'bcc' fields. System now skips BCC field when it matches recipient email (server/routes/email-routes.ts:723-729). This prevents silent email failures when toolkit emails are sent to the BCC address itself.

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