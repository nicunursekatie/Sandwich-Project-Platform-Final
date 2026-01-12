### Overview
This full-stack application for The Sandwich Project nonprofit aims to streamline sandwich collections, donations, and distributions. It provides comprehensive data management, analytics, and operational tools for volunteers, hosts, and recipients. The project enhances data visibility, supports organizational growth, and is a vital tool for food security initiatives, ultimately reducing food waste and hunger. The organizational annual goal is to collect 500,000 sandwiches.

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
- Visualizations include two-line charts for collection trends and summary cards.
- Purple markers for recipients on maps (distinct from blue events, green hosts).
- "Nearby Recipients" section in right panel showing recipients within 15 miles of selected event.

**Technical Implementations & Feature Specifications:**
- **Authentication & Permissions**: Role-based access control, granular permissions, session management, password security, and active user enforcement. Environment variables (`APP_ENV`, `NODE_ENV`, `REPLIT_DEPLOYMENT`) control authentication modes. Inactive users are blocked from protected routes. Password hashing and verification must use `authService.hashPassword()` and `authService.verifyPassword()` to ensure proper trimming and prevent hash mismatches.
- **Database Configuration**: Centralized database URL selection. Neon serverless requires `--> statement-breakpoint` markers for multi-statement SQL migrations and avoids `.returning()` on update operations.
- **Data Management**: Comprehensive management of collections, hosts, recipients, users, and audit logs with Zod validation, timezone-safe date handling, and soft deletes. `sandwich_collections` table is the operational source of truth.
- **Messaging & Notifications**: Email (SendGrid) with all outgoing emails BCC'd to `katie@thesandwichproject.org`, Socket.IO chat, SMS via Twilio, and dashboard notifications.
- **Operational Tools**: Project, meeting, and work log management, user feedback, analytics dashboards, and a permissions-based Collection Walkthrough Tool. Event impact reports only count actual `sandwichCollections` records.
- **Event Requests Management System**: Tracks requests, handles duplicate detection, manages statuses, integrates with Google Sheets, calculates van driver staffing, supports multi-recipient assignment, performs comprehensive intake validation, and features interactive Leaflet maps with AI Intake and Scheduling Assistants, including van conflict detection. Includes auto-save to localStorage with recovery options for `EventSchedulingForm`. Enhanced save confirmation feedback shows checkmark (✓), organization name, 8-second duration for success; error handling detects network issues, shows specific messages with auto-save backup references, displays for 10 seconds.
- **Real-Time Collaboration System**: Multi-user collaboration using a single Socket.IO instance for synchronization, presence tracking, field-level locking, threaded comments, and edit revision history. Consolidated into a unified comment system using `event_collaboration_comments`.
- **User Activity Logging System**: Comprehensive tracking of authenticated user actions.
- **Sandwich Type Tracking System**: Comprehensive tracking for individual and group collections with real-time validation and analytics.
- **Interactive Route Map & Driver Optimization**: Leaflet map for visualizing host contact locations, route optimization, and driver assignment. Recipients are geocoded and displayed.
- **Automated Reminders**: 24-hour volunteer reminder system via cron job with configurable email/SMS delivery channels, supporting role-specific instructions.
- **TSP Contact Follow-up Notifications**: Automated reminder system for TSP contacts, running twice daily, for events approaching 'in_progress' status and toolkit follow-ups (weekend-aware). Uses SMS or email.
- **SMS Alert Configuration System**: Users can opt-in to SMS notifications, with event reminders supporting SMS. SMS opt-in supports multiple campaign types via `campaignTypes` array: `'hosts'` (weekly collection reminders) and `'events'` (event coordination notifications). Users can now opt into both campaign types simultaneously using checkboxes. SMSBadge displays multiple icons when user is opted into multiple types. Weekly collection reminders (`sendSMSReminder`) only send to users who opted in to the 'hosts' campaign. For backwards compatibility, users who opted in before campaign types existed (old single `campaignType` field or no field) are included in 'hosts' reminders.
- **Kudos Mark-as-Read System**: Kudos messages are tracked in `kudosTracking` table with `messageId` referencing the `messages` table. When marking kudos as read via `PATCH /api/emails/:id`, the system looks up `kudosTracking.messageId` (not `kudosTracking.id`) because kudos returned to the client have `id = messages.id`. Kudos use the messaging service (`messageRecipients` table) to mark as read, not the email service (`emailMessages` table). IMPORTANT: Always use `String()` conversion when comparing user IDs with `recipientId` fields since `messageRecipients.recipientId` and `kudosTracking.recipientId` are text fields but `user.id` may be a number.
- **TSP Holding Zone**: Inbox-style system for long-term ideas/tasks with categories, urgent flagging, commenting, likes, assignments, and a three-tier permission system.
- **Guided Tours & Onboarding System**: Interactive, permission-based step-by-step tours for new users, covering all major features.
- **Error Handling & Logging**: Robust error handling with `lazyWithRetry` and improved production-safe logging.
- **Timezone Management**: Ensures accurate storage and display of user-entered times, adhering to `America/New_York` and using utility functions to prevent conversion issues.
- **Google Sheets Sync**: Background service with comprehensive monitoring, alerts, triple deduplication, and message backfill.
- **React Query Cache Management**: Uses `queryClient.refetchQueries` in mutation success handlers for immediate UI updates.
- **Organization Merge System**: Admin tool to merge duplicate organizations, including similarity scoring, merge preview, and batch updates.
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
- **SMS**: `twilio`