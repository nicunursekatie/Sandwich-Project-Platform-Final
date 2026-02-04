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
Mobile Header Overflow: Dashboard header uses progressive hiding at breakpoints - user info hidden below xs (480px), comments button hidden below xs, OnlineUsers hidden below sm (640px). Button padding reduced on mobile (p-1.5 vs p-2). Header has overflow-x-hidden and max-w-full to prevent any overflow.

### System Architecture
The application features a React 18 frontend with TypeScript, Vite, TanStack Query, and Tailwind CSS (with shadcn/ui). The backend uses Express.js (TypeScript), Drizzle ORM, and PostgreSQL (Neon serverless), including session-based authentication. The UI/UX adheres to The Sandwich Project's official color palette and Roboto typography, prioritizing clarity, responsiveness, and card-based dashboards.

**UI/UX Decisions:**
- Modern, compact design with white card backgrounds, colored left borders for status, warm paper tone page background, subtle shadows, and a strong tonal hierarchy.
- Operational monitoring uses Wednesday-Tuesday week boundaries.
- Visualizations include two-line charts for collection trends and summary cards.
- Purple markers for recipients on maps (distinct from blue events, green hosts).
- "Nearby Recipients" section in right panel showing recipients within 15 miles of selected event.

**Technical Implementations & Feature Specifications:**
- **Authentication & Permissions**: Role-based access control, granular permissions, session management, password security, and active user enforcement. Environment variables control authentication modes. Inactive users are blocked from protected routes. Password hashing and verification use `authService.hashPassword()` and `authService.verifyPassword()`.
- **Database Configuration**: Centralized database URL selection. Uses `DEV_DATABASE_URL` for development and `DATABASE_URL` for production. Neon serverless requires `--> statement-breakpoint` markers for multi-statement SQL migrations and avoids `.returning()` on update operations. `db.execute(sql\``) returns results as an array or with a `rows` property.
- **Data Management**: Comprehensive management of collections, hosts, recipients, users, and audit logs with Zod validation, timezone-safe date handling, and soft deletes. `sandwich_collections` table is the operational source of truth.
- **Sandwich Totals Calculation**: Calculations must correctly sum either `jsonb group_collections` or legacy `group1_count`/`group2_count` fields, but never both, to prevent double-counting.
- **Messaging & Notifications**: Email (SendGrid) with all outgoing emails BCC'd to `katie@thesandwichproject.org`, Socket.IO chat, SMS via Twilio, and dashboard notifications.
- **Operational Tools**: Project, meeting, and work log management, user feedback, analytics dashboards, and a permissions-based Collection Walkthrough Tool. Event impact reports only count actual `sandwichCollections` records.
- **Event Requests Management System**: Tracks requests, handles duplicate detection, manages statuses, integrates with Google Sheets, calculates van driver staffing, supports multi-recipient assignment, performs comprehensive intake validation, and features interactive Leaflet maps with AI Intake and Scheduling Assistants, including van conflict detection. Includes auto-save to localStorage with recovery options. Enhanced save confirmation feedback. Dialog components must use optional chaining when accessing `eventRequest` properties.
  - **Corporate Priority System**: Only Katie and Christine can remove the corporate priority flag. "Call now" notifications only trigger for events with status 'new' or 'in_progress'.
  - **Standby Follow-Up System**: When changing an event to "standby," users are prompted to specify a follow-up date or default to a one-week email reminder. `tsp-contact-followup-service.ts` sends reminders.
- **Real-Time Collaboration System**: Multi-user collaboration using a single Socket.IO instance for synchronization, presence tracking, field-level locking, threaded comments, and edit revision history. Consolidated into a unified comment system using `event_collaboration_comments`.
- **Real-Time Online Presence Notifications**: WebSocket-based instant online presence notifications via Socket.IO. Server broadcasts `user-online` and `user-offline` events. Client hook (`useOnlinePresenceNotifications.ts`) listens for events and shows toast notifications. Fallback polling reduced to 5 minutes.
- **User Activity Logging System**: Comprehensive tracking of authenticated user actions.
- **Sandwich Type Tracking System**: Comprehensive tracking for individual and group collections with real-time validation and analytics.
- **Interactive Route Map & Driver Optimization**: Leaflet map for visualizing host contact locations, route optimization, and driver assignment. Recipients are geocoded and displayed.
- **Automated Reminders**: 24-hour volunteer reminder system via cron job with configurable email/SMS delivery channels, supporting role-specific instructions.
- **TSP Contact Follow-up Notifications**: Automated reminder system for TSP contacts, running twice daily, for events approaching 'in_progress' status and toolkit follow-ups (weekend-aware). Uses SMS or email based on user preferences.
- **Tiered Notification System**: Three-tier architecture (`notification-tiers.ts`, `event-notification-dispatcher.ts`) to prevent alert fatigue: URGENT (SMS), IMPORTANT (Rich Email), DIGEST (Weekly Summary). Standby follow-up reminders are IMPORTANT tier (email-only).
- **Corporate 24h Escalation Rate Limiting**: Corporate escalation SMS is rate-limited to once per 24 hours per event. Cron job runs 3x daily but won't send duplicates within 24 hours. Only events with `status = 'new' or 'in_process'` trigger escalations.
- **Notification Status Filtering**: ALL notification queries MUST exclude inactive event statuses (`['completed', 'declined', 'cancelled', 'stalled', 'postponed', 'standby', 'scheduled']`) and only include active statuses (`['new', 'in_process']`).
- **Smart Follow-up SMS Batching**: SMS notifications are batched per user to prevent multiple individual texts. Users receive one summary SMS. Email notifications remain individual.
- **Stale Event Escalation Email Batching**: Escalation emails for stale events are batched into one weekly summary email to Katie & Christine. Rate limiting via `adminEscalationSentAt` field.
- **SMS Alert Configuration System**: Users can opt-in to SMS notifications, with event reminders supporting SMS. Supports multiple campaign types via `campaignTypes` array: `'hosts'` (weekly collection reminders) and `'events'` (event coordination notifications). Users can opt into both. Weekly collection reminders only send to 'hosts' campaign opt-ins.
- **Kudos Mark-as-Read System**: Kudos messages are tracked in `kudosTracking` table, referencing `messages.id`. Marking kudos as read uses the messaging service. String conversion is required for comparing user IDs with `recipientId` fields.
- **TSP Holding Zone**: Inbox-style system for long-term ideas/tasks with categories, urgent flagging, commenting, likes, assignments, and a three-tier permission system.
- **Guided Tours & Onboarding System**: Interactive, permission-based step-by-step tours for new users.
- **Error Handling & Logging**: Robust error handling with `lazyWithRetry` and improved production-safe logging.
- **Timezone Management**: Ensures accurate storage and display of user-entered times, adhering to `America/New_York`.
- **Google Sheets Sync**: Background service with comprehensive monitoring, alerts, triple deduplication, and message backfill.
- **React Query Cache Management**: Uses `queryClient.refetchQueries` in mutation success handlers for immediate UI updates.
- **Organization Merge System**: Admin tool to merge duplicate organizations, including similarity scoring, merge preview, and batch updates.
- **Email Template Customization System**: Allows admins to customize key text sections of follow-up HTML emails via a dedicated UI, with content stored in `email_template_sections` and supporting placeholders.
- **External API Key Authentication**: Supports API key authentication for external app integrations. API keys are managed via `/api/api-keys` (super_admin only). External apps access event requests via `/api/external/event-requests` with Bearer token authentication. API keys have read-only access (GET only) and are stored as SHA-256 hashes. Keys follow `tsp_` prefix format. Schema table: `api_keys`.

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