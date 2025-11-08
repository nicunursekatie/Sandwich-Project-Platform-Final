## Overview
This full-stack application for The Sandwich Project nonprofit streamlines sandwich collections, donations, and distributions. It provides comprehensive data management, analytics, and operational tools for volunteers, hosts, and recipients. The project aims to enhance data visibility, support organizational growth, and become a vital tool for food security initiatives, ultimately reducing food waste and hunger.

## User Preferences
Preferred communication style: Simple, everyday language.
UI Design: Button labels and interface text must be extremely clear about their function - avoid ambiguous labels like "Submit" in favor of specific action descriptions like "Enter New Data".
Form Design: Eliminate redundant or confusing form fields - host dialogs should have a single "Host Location Name" field instead of separate "Name" and "Host Location" fields.
Mobile UX Priority: Mobile user experience is critical - chat positioning and space efficiency are key concerns. Vehicle type should NOT be required for new driver entries.
Documentation: All technical findings and fixes must be documented in replit.md to avoid repeated searching and debugging.
Analytics Philosophy: NEVER compare or rank hosts against each other. The Sandwich Project is about increasing volunteer turnout globally, not about which host reported more/less sandwiches. All host comparison features, "top performing hosts", "underperforming hosts", and similar language must be removed from analytics.
Desktop Chat UX: Desktop users require proper scrolling behavior without nested scrolling containers that cause page focus issues - chat layout must handle desktop and mobile differently.

## Recent Technical Fixes
Send Event Details via SMS Button UX Improvement (Nov 8, 2025): Moved "Send Event Details via SMS" button from Event Details dialog to event cards for better discoverability and added dedicated permission control. **Problem**: Button was hidden inside the edit dialog and only visible when editing scheduled events, making it hard to discover and use. Additionally, there was no dedicated permission for this feature. **Solution**: (1) Created new permission `EVENT_REQUESTS_SEND_SMS` that appears in the permissions editor. (2) Moved button to event cards (ScheduledCardEnhanced and ScheduledCard) in action buttons section with Phone icon. (3) Button appears next to Message, Edit, and Delete buttons for easy access. (4) Removed button from EventSchedulingForm to avoid duplication. (5) Button visibility controlled by `EVENT_REQUESTS_SEND_SMS` permission, allowing granular access control. Location: `shared/auth-utils.ts` line 136 (permission definition), `client/src/components/event-requests/cards/ScheduledCardEnhanced.tsx` (imports, state, button at lines 589-600, dialog), `client/src/components/event-requests/cards/ScheduledCard.tsx` (imports, state, button at lines 1888-1899, dialog), `client/src/components/event-requests/EventSchedulingForm.tsx` (removed button and dialog).

SMS Notification Preferences UX Improvement (Nov 8, 2025): Fixed confusing UX where users thought they needed to configure notification preferences before signing up for SMS. **Problem**: The SMS signup form and notification preferences form appeared together without clear separation, making users think they had to set preferences before submitting their phone number for verification. Additionally, the default 72-hour SMS notification setting wasn't visible to users. **Solution**: (1) Added clear visual separator with "Optional: Customize Your Reminder Settings" label between SMS signup and preferences sections. (2) Added prominent "Already configured!" banner in preferences card that explains the automatic 72-hour default when users sign up for SMS. (3) Updated warning messages to correctly reference section locations. This makes it clear that preferences are optional customization and the system automatically configures sensible defaults. Location: `client/src/components/notification-preferences.tsx` lines 144-155, `client/src/components/user-profile.tsx` lines 845-855.

Sandwich Type Validation in Spreadsheet View (Nov 8, 2025): Replaced free-text input for sandwich types with a validated dialog featuring dropdowns and number inputs. **Problem**: Spreadsheet view allowed users to type any text for sandwich types (e.g., "pizza: 100, tacos: 50"), breaking data integrity since only 5 valid types exist (pbj, deli, deli_turkey, deli_ham, unknown). **Solution**: Created a dialog-based editor that replaces inline text input with dropdown selectors for sandwich types and number inputs for quantities. Users can add/remove multiple types with validation enforcing only valid selections. This prevents invalid data entry and maintains consistency with analytics/reporting. Location: `client/src/components/event-requests/views/ScheduledSpreadsheetView.tsx` lines 15-21 (Dialog import), 102-104 (state), 358-399 (handlers), 869-887 (cell rendering), 1244-1328 (dialog JSX).

AI Intake Assistant Pickup Time Validation (Nov 7, 2025): Fixed validation rule that incorrectly required start/end times even when pickup time was provided. The `event_times_required` rule now accepts EITHER event start/end times OR pickup time as satisfactory for scheduling. Location: `server/services/ai-intake-assistant/index.ts` lines 105-129.

DateTimePicker Timezone Fix (Nov 7-8, 2025): Fixed critical timezone conversion bug where pickup times entered in the DateTimePicker (e.g., 10:30 AM) were being saved and displayed incorrectly (e.g., 5:30 AM). **Root Cause**: Multiple code paths were calling `.toISOString()` which converts local time to UTC, causing a 5-hour shift for EST/EDT users. Additionally, Drizzle ORM's `timestamp()` column type was forcing Date object conversion. **Solution**: (1) Modified all datetime handling code to construct local datetime strings (`YYYY-MM-DDTHH:MM:SS`) directly without timezone conversion. (2) Changed `pickup_date_time` database column from `timestamp` to `varchar` to store strings directly without ORM conversion. (3) Updated Zod validation to accept strings instead of Date objects. (4) Removed `pickupDateTime` from backend timestamp conversion arrays to prevent Date object creation. Fixed in four iterations: (a) DateTimePicker component, (b) Backend conversion functions, (c) `getPickupDateTimeForInput()` utility function, (d) **Final fix**: Schema change and backend timestamp exclusion. Location: `client/src/components/ui/datetime-picker.tsx` lines 72-96, `server/routes/event-requests.ts` lines 30-59 and 1180-1199 and 1440-1457, `server/routes/import-events.ts` lines 18-48, `client/src/components/event-requests/utils.ts` lines 435-483, `shared/schema.ts` lines 1763 and 2062.

Quick SMS Links Security & URL Fix (Nov 7, 2025): Fixed three critical issues: (1) **Phone Format Validation**: Removed overly strict E.164 regex that rejected formats like `(678) 555-1234`. Backend now accepts any format and normalizes. (2) **SMS Consent Checking**: Added mandatory opt-in verification - verifies `smsConsent.status === 'confirmed' && smsConsent.enabled` before sending. (3) **App URL Fix**: SMS links were sending placeholder URL instead of actual app URL. Fixed to always use deployed public app URL (`PUBLIC_APP_URL` env var or hardcoded fallback) regardless of preview/deployed environment. Location: `server/routes/quick-sms.ts`, `client/src/pages/quick-sms-links.tsx`.

## System Architecture
The application features a React 18 frontend with TypeScript, Vite, TanStack Query, and Tailwind CSS (with shadcn/ui). The backend uses Express.js (TypeScript), Drizzle ORM, and PostgreSQL (Neon serverless), including session-based authentication. The UI/UX adheres to The Sandwich Project's official color palette and Roboto typography, prioritizing clarity, responsiveness, and card-based dashboards.

**Key Technical Implementations & Features:**
-   **Authentication & Permissions**: Role-based access control, session management, password security, and a unified permissions system with secure new user signup flows.
-   **Data Management**: Comprehensive management of collections, hosts, recipients, users, and audit logs with Zod validation and timezone-safe date handling. `sandwich_collections` table is the operational source of truth for grant metrics.
-   **Search & Filtering**: Real-time capabilities across management interfaces.
-   **Performance Optimization**: Query optimization, caching, pagination, and database connection pooling.
-   **Messaging & Notifications**: Email (SendGrid), Socket.IO chat, SMS via Twilio, and dashboard notifications.
-   **Operational Tools**: Project, meeting, and work log management, user feedback, analytics dashboards, and a permissions-based Collection Walkthrough Tool.
-   **Event Requests Management System**: Tracks requests, handles duplicate detection, manages statuses, integrates with Google Sheets, calculates van driver staffing, supports multi-recipient assignment, and performs comprehensive intake validation. Features an interactive Leaflet map with cluster/all-pins views, TSP-branded icons, color-coding by status, search/filter, and dual-layer geocoding. Includes a sophisticated AI Intake Assistant for actionable recommendations and an AI Scheduling Assistant with flexible date analysis, with robust validation for sandwich types and pickup times.
-   **Google Sheets Integration**: Bidirectional automatic synchronization for project tracker and event requests.
-   **User Activity Logging System**: Comprehensive tracking of authenticated user actions via middleware.
-   **Sandwich Type Tracking System**: Comprehensive tracking for individual and group collections with real-time validation and analytics.
-   **Interactive Route Map & Driver Optimization**: Leaflet map for visualizing host contact locations, route optimization, and driver assignment.
-   **Automated Reminders**: 24-hour volunteer reminder system via cron job.
-   **Team Board**: Commenting system with real-time counts and multi-user assignment.
-   **Email System**: Uses `katie@thesandwichproject.org` as the verified SendGrid sender with table-based HTML templates.
-   **SMS Notifications**: Opt-in SMS alerts for assignment notifications, secured by Twilio signature validation, with improved phone format validation and secure consent checks.
-   **Expenses Receipt Upload**: Handles receipt uploads to Google Cloud Storage.
-   **Dashboard Annual Goal Display**: Displays the organizational annual goal of 500,000 sandwiches.
-   **Social Media Graphics**: Supports image and PDF uploads to Google Cloud Storage with optional email notifications.
-   **Progressive Web App (PWA)**: Full PWA support enabling mobile installation, offline access, and real-time updates.
-   **UI Design System**: Modern, compact design with white card backgrounds, colored left borders for status, warm paper tone page background, subtle shadows, and a strong tonal hierarchy to distinguish app shell, sidebar, and main content. Increased border radius to 12px for a modern feel.
-   **Robust Error Handling**: Implemented `lazyWithRetry` for dynamic component imports to gracefully handle transient network or HMR errors.
-   **Timezone Management**: Fixed critical timezone conversion bugs in DateTimePicker to ensure accurate storage of user-entered times.
-   **Storage Wrapper**: Includes a `StorageWrapper` with fallback mechanisms for database operations, ensuring resilience.

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
-   **Mapping**: `leaflet`, `react-leaflet`, `react-leaflet-cluster`
-   **SMS**: `twilio`