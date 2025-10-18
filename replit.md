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

## System Architecture
The application uses a React 18 frontend with TypeScript, Vite, TanStack Query, and Tailwind CSS (with shadcn/ui). The backend is built with Express.js (TypeScript), Drizzle ORM, and PostgreSQL (Neon serverless), featuring session-based authentication. Database separation for development and production is handled via environment variables. Structured logging is implemented using Winston, and security includes centralized CORS configuration.

**Port Configuration (.replit file)**:
- Development (popout preview): `localPort = 5000`, `externalPort = 5000`
- Production (Autoscale deployment): `localPort = 5000`, `externalPort = 80`
- CRITICAL: Autoscale deployments fail if multiple port definitions exist - keep only ONE `[[ports]]` section.

**Authentication System**: The official authentication system is implemented in `server/temp-auth.ts`, handling login/registration, session management via express-session with PostgreSQL storage, role-based access control, password resets via SendGrid, and profile management. The `isAuthenticated` middleware validates sessions and refreshes user permissions from the database on each request. Environment-aware session cookie configuration supports both development and production, detecting Replit development mode to adjust cookie security (`secure: false`, `sameSite: 'lax'` for dev; `secure: true`, `sameSite: 'none'` for prod). All fetch() requests for login, register, and forgot password forms must include `credentials: 'include'` for proper session cookie handling.

The backend employs a modular router architecture with a central router, middleware, and dedicated feature modules. UI/UX design adheres to The Sandwich Project's official color palette and Roboto typography, prioritizing clarity, responsiveness, and visual hierarchy with card-based dashboards.

Key technical implementations include:
- **Unified Permissions System**: Consistent frontend/backend logic, visual role templates, and standardized `RESOURCE_ACTION` format.
- **Data Management**: Comprehensive management of collections, hosts, recipients, users, and audit logs with Zod validation and timezone-safe date handling.
- **Authentication & Authorization**: Role-based access and 30-day session management.
- **Search & Filtering**: Real-time capabilities across management interfaces.
- **Performance Optimization**: Query optimization, caching, pagination, and database connection pooling.
- **Messaging & Notifications**: Multi-layered communication including email, Socket.IO chat, SMS via Twilio, and dashboard notifications.
- **Operational Tools**: Project, meeting, and work log management, user feedback, analytics dashboards, confidential documents toolkit, and a permissions-based Collection Walkthrough Tool.
- **Meeting Management**: Full-featured system with agenda compilation, project integration, PDF export, and permission-controlled notes.
- **Event Requests Management System**: Tracking, duplicate detection, status tracking, Google Sheets integration, van driver staffing calculations, and organization categorization.
- **Multi-Recipient Assignment System**: Events can be assigned to multiple destinations using a prefixed ID format and badge-based UI.
- **Google Sheets Integration**: Bidirectional automatic synchronization for project tracker and event requests.
- **User Activity Logging System**: Comprehensive tracking of authenticated user actions into `user_activity_logs` table via middleware.
- **Sandwich Type Tracking System**: Comprehensive tracking of sandwich types for individual sandwiches and group collections with real-time validation, display, and analytics.
- **Interactive Route Map & Driver Optimization**: Interactive Leaflet map for visualizing host contact locations, multi-host selection, route optimization using nearest-neighbor algorithm, driver assignment, and export capabilities. Geolocation storage in `host_contacts` table.
- **Meeting Notes Content Transfer**: Note content (discussion points and decision items) can be parsed from `meeting_notes.content` JSON and copied into project's `meetingDiscussionPoints` and `meetingDecisionItems` fields for agenda planning.
- **Meeting Notes History System**: Comprehensive notes browsing and project-specific history display. Features a dedicated "Notes History" tab in the meeting dashboard with filtering by project, meeting, status, type, date range, and full-text search. Also displays past notes inline within each project card in the Agenda Planning tab via the ProjectNotesHistory component, providing context for current discussions.
- **Host Contact Name Resolution**: The `resolveUserName` function correctly handles host contacts assigned to events, prioritizing host contact lookups and displaying "Loading..." until data is available.
- **Sandwich Forecasting Accuracy**: Forecasting tool uses actual recorded sandwich counts for completed events and estimated counts for scheduled/in-process events, with labels indicating the count type.
- **Cooler Tracking Number Formatting**: Cooler count display casts PostgreSQL SUM() results to integers to prevent extra decimal places.
- **Groups Catalog Individual Event Display**: Each event request displays as its own card within organization groups, using an aggregation key including `request.id` to ensure accurate per-event tracking.
- **Sandwich Type Display Bug Fix**: Corrected mapping for sandwich type display (e.g., 'deli_turkey' now correctly maps to 'Turkey').
- **Event Times Dialog Scrolling Fix**: Implemented scrolling for the "Add Event Times" dialog to ensure the Save button remains accessible when the date/time picker expands.
- **24-Hour Volunteer Reminder System**: Automated email reminder system that sends volunteers a reminder 24 hours before their assigned events. Runs twice daily (9 AM and 3 PM ET) via cron job, queries events in the 20-28 hour window, sends branded reminder emails with role-specific instructions, and tracks `reminderSentAt` in `eventVolunteers` table to prevent duplicates. Times are displayed in America/New_York timezone for accuracy.
- **Project Archiving Fix**: Corrected archive mutations to use proper `POST /api/projects/:id/archive` endpoint instead of just setting status field. This ensures projects are properly copied to `archived_projects` table and deleted from active `projects` table, with full cache invalidation across all project queries.
- **Event Request Intake Validation System**: Comprehensive validation badges that flag incomplete intake information on in-process and scheduled event cards. Uses shared `getMissingIntakeInfo` utility function to check for missing contact info (email OR phone), sandwich details (count and types, including sandwichTypes array/object forms), and address (eventAddress, deliveryDestination, or overnightHoldingLocation). Mobile-responsive design collapses multiple warnings into a single badge with dialog on smaller screens or when >2 items are missing, showing individual badges on desktop with ≤2 items. Includes a centralized Missing Info Summary Dialog accessible via header button that displays all events with incomplete intake information, listing what's missing from each event with click-to-navigate functionality (scrolls to and highlights the specific event card). Event cards have unique IDs (`event-card-${id}`) to enable smooth scroll navigation from the summary. Prevents events from "falling through the cracks" by ensuring critical planning information is complete.

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
- **Mapping**: `leaflet@1.9.4`, `react-leaflet@4.2.1` (OpenStreetMap tiles)