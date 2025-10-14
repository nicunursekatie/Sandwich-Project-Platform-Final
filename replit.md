# Replit.md

## Overview
This full-stack application for The Sandwich Project nonprofit manages sandwich collections, donations, and distributions. It provides comprehensive data management, analytics, and operational tools for volunteers, hosts, and recipients, aiming to streamline operations, enhance data visibility, and support the organization's growth. The business vision is to become a vital tool for food security initiatives, with market potential in supporting volunteer-driven community projects, scaling operations, and improving outreach to reduce food waste and hunger.

## User Preferences
Preferred communication style: Simple, everyday language.
UI Design: Button labels and interface text must be extremely clear about their function - avoid ambiguous labels like "Submit" in favor of specific action descriptions like "Enter New Data".
Form Design: Eliminate redundant or confusing form fields - host dialogs should have a single "Host Location Name" field instead of separate "Name" and "Host Location" fields.
Mobile UX Priority: Mobile user experience is critical - chat positioning and space efficiency are key concerns. Vehicle type should NOT be required for new driver entries.
Documentation: All technical findings and fixes must be documented in replit.md to avoid repeated searching and debugging.
Date Display Fix: When displaying dates from the database, always use `timeZone: 'UTC'` in toLocaleDateString() to prevent timezone conversion bugs that cause off-by-one-day display errors (e.g., `date.toLocaleDateString('en-US', { timeZone: 'UTC' })`).
Navigation Icons: Collections log icon in simple-nav should use sandwich logo.png from LOGOS folder.
Desktop Chat UX: Desktop users require proper scrolling behavior without nested scrolling containers that cause page focus issues - chat layout must handle desktop and mobile differently.
Analytics Philosophy: NEVER compare or rank hosts against each other. The Sandwich Project is about increasing volunteer turnout globally, not about which host reported more/less sandwiches. All host comparison features, "top performing hosts", "underperforming hosts", and similar language must be removed from analytics.

## System Architecture
The application uses a React 18 frontend with TypeScript, Vite, TanStack Query, and Tailwind CSS (with shadcn/ui). The backend is built with Express.js (TypeScript), Drizzle ORM, and PostgreSQL (Neon serverless), featuring session-based authentication. Database separation for development and production is handled via environment variables. Structured logging is implemented using Winston, and security includes centralized CORS configuration.

**Port Configuration (.replit file)**:
- Development (popout preview): `localPort = 5000`, `externalPort = 5000`
- Production (Autoscale deployment): `localPort = 5000`, `externalPort = 80`
- CRITICAL: Autoscale deployments fail if multiple port definitions exist - keep only ONE `[[ports]]` section.

**Authentication System**: The official authentication system is implemented in `server/temp-auth.ts`, handling login/registration, session management via express-session with PostgreSQL storage, role-based access control, password resets via SendGrid, and profile management. The `isAuthenticated` middleware validates sessions and refreshes user permissions from the database on each request.

The backend employs a modular router architecture with a central router, middleware, and dedicated feature modules. UI/UX design adheres to The Sandwich Project's official color palette and Roboto typography, prioritizing clarity, responsiveness, and visual hierarchy with card-based dashboards.

Key technical implementations include:
- **Unified Permissions System**: Consistent frontend/backend logic, visual role templates, and standardized `RESOURCE_ACTION` format for strict validation and audit trails.
- **Data Management**: Comprehensive management of collections, hosts, recipients, users, and audit logs with Zod validation and timezone-safe date handling.
- **Authentication & Authorization**: Role-based access, 30-day session management, and SendGrid-powered password reset.
- **Search & Filtering**: Real-time capabilities across management interfaces.
- **Performance Optimization**: Query optimization, caching, pagination, and database connection pooling.
- **Messaging & Notifications**: Multi-layered communication including email, Socket.IO chat, SMS via Twilio, and dashboard notifications.
- **Operational Tools**: Project, meeting, and work log management, user feedback, analytics dashboards, confidential documents toolkit, and a permissions-based Collection Walkthrough Tool.
- **Analytics**: Dashboard for community impact and user activity tracking.
- **Meeting Management**: Full-featured system with agenda compilation, project integration, PDF export, and database-backed notes with permission-controlled access (MEETINGS_VIEW for reading, MEETINGS_MANAGE for creating/editing).
- **Event Requests Management System**: Tracking, duplicate detection, status tracking, Google Sheets integration, van driver staffing calculations, optional volunteer count, and organization categorization.
- **Multi-Recipient Assignment System**: Events can be assigned to multiple destinations (hosts, recipient organizations, custom text) using a prefixed ID format and badge-based UI.
- **Google Sheets Integration**: Bidirectional automatic synchronization for project tracker and event requests.
- **Enhanced Audit Log Display**: User-friendly audit trail with human-readable field names.
- **Email Compliance**: SendGrid emails include required opt-out text and consistent footers.
- **Team Assignment Auto-Adjustment & Validation**: Comprehensive logic to prevent invalid states in event team assignments.
- **Toolkit Attachment Filtering**: Event toolkit email composer filters attachments to include only essential documents.
- **Event Toolkit Email System**: Professional email system for event contacts with proper formatting, attachments, and SendGrid integration.
- **User Activity Logging System**: Comprehensive tracking of authenticated user actions into `user_activity_logs` table via middleware.
- **Groups Catalog Event Editing**: Direct access from groups catalog to edit individual event request details.
- **Team Availability Calendar**: Calendar integration for tracking team member time off and unavailability, emphasizing unavailability.
- **Interactive Guided Tour System**: On-demand help system with floating help button, categorized menu, step-by-step tours, non-blocking spotlight overlay, keyboard navigation, and localStorage persistence.
- **TSP Contact Assignment Email Notifications**: Automated email notifications when users are assigned as TSP contact for events, including event details and platform link.
- **Duplicate Cleanup Tool Enhancement**: Radio button selection in duplicate detection dialog is respected during deletion, with a single "Delete Duplicates" button.
- **My Assignments Count Fix**: The My Assignments tab badge accurately displays only actionable events.
- **Groups Catalog Organization Grouping**: Organizations in the groups catalog properly consolidate all events into a single organization card.
- **Weekly Monitoring Email Routing**: Fixed location-to-contact email routing to send reminders to actual host contacts with fallback email mapping.
- **Sandwich Type Tracking System**: Comprehensive tracking of sandwich types (deli, turkey, ham, pbj) for individual sandwiches and group collections with real-time validation, display, and analytics utilities.
- **Interactive Route Map & Driver Optimization**: Interactive Leaflet map for visualizing individual host contact locations (not just area names), multi-host selection, route optimization using nearest-neighbor algorithm, driver assignment, and export capabilities (Google Maps, print, clipboard). Geolocation storage (latitude/longitude/geocoded_at) is stored in the `host_contacts` table. Map displays contact name + host location (e.g., "Karen Cohen - Alpharetta"). Production database requires coordinates to be added via SQL UPDATE statements.
- **Host Contact Name Resolution**: The `resolveUserName` function in `client/src/components/event-requests-v2/hooks/useEventAssignments.ts` properly handles host contacts assigned to events (drivers, speakers, volunteers). When a host contact is assigned, their ID is stored with the prefix `host-contact-` (e.g., "host-contact-16"). The function looks up the contact in `hostsWithContacts` data and displays their actual name instead of the raw ID.
- **Sandwich Forecasting Accuracy**: The forecasting tool in `client/src/components/sandwich-forecast-widget.tsx` correctly uses actual recorded sandwich counts (`actualSandwichCount`) for completed events and estimated counts (`estimatedSandwichCount`) for scheduled/in-process events. This ensures past weeks show real impact data while future weeks show planned forecasts. Each event displays a label ("actual" or "estimated") to indicate which count is being used.
- **Cooler Tracking Number Formatting**: Fixed cooler count display in `server/routes/coolers.ts` by casting PostgreSQL SUM() results to integers using `::integer`. This prevents the display of extra decimal places (like "00000") that appeared when numeric types were serialized as strings in JSON responses.

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
- **Mapping**: `leaflet@1.9.4`, `react-leaflet@4.2.1` (OpenStreetMap tiles, no API key required)