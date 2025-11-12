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
**CRITICAL CSV Export Bug Fixed (Nov 12, 2025)**: Fixed driver agreement status showing incorrectly as "No" in CSV exports when drivers actually had agreements signed. **Problem**: All drivers in CSV export showed "Agreement Signed" = "No" despite the UI displaying green "Agreement Signed" badges for the same drivers. Database confirmed these drivers had `email_agreement_sent = true`. **Root Cause**: CSV export and UI used different data sources - UI checked `driver.emailAgreementSent` (drivers table) while CSV export looked up `agreement.agreementAccepted` in separate `driverAgreements` table by email. This lookup failed for: (1) drivers without emails (null), (2) drivers whose records weren't synchronized between tables, (3) mismatched or stale agreement data. **Solution**: Changed CSV export to use canonical source `driver.emailAgreementSent` instead of unreliable table lookup. This aligns CSV output with UI display. **Impact**: Critical data integrity issue resolved - CSV exports now accurately reflect driver agreement status matching what users see in the interface. Location: `server/routes/drivers.ts` (line 73). **Architect Review**: Confirmed `emailAgreementSent` is the authoritative field and recommended synchronization or enforcement of email presence if `driverAgreements` table must remain authoritative in the future.

False Positive Field Lock Warnings Fixed (Nov 11, 2025): Fixed collaboration system showing misleading "field locked by another user" warnings for connection errors and timeouts. **Problem**: Users reported getting warnings that a field was being edited by another user when they were certain no one else was editing. Investigation revealed the toast was being shown for ALL lock acquisition failures, not just actual lock conflicts. The system can fail to acquire a lock for three reasons: (1) Socket disconnected - "Not connected to collaboration server", (2) Timeout after 5 seconds - slow network or server response, (3) Actual lock conflict - another user genuinely has the lock. **Root Cause**: `EventSchedulingForm.tsx` caught ANY error from `acquireFieldLock` and unconditionally displayed the "This field is currently being edited by another user" toast, making connection issues appear as collaboration conflicts. **Solution**: Added error message inspection in `handleFieldFocus` - only show the destructive "Field Locked" toast when error message includes "locked by" or "Field is locked" (indicating real conflict). Connection errors and timeouts now log warnings without disruptive user-facing toasts. This prevents false positives while preserving legitimate lock conflict warnings. **Testing**: Verified database had no active locks for the event in question, confirming the warning was a false positive triggered by connection/timeout rather than actual collaboration conflict. Location: `client/src/components/event-requests/EventSchedulingForm.tsx` (lines 685-711).

### System Architecture
The application features a React 18 frontend with TypeScript, Vite, TanStack Query, and Tailwind CSS (with shadcn/ui). The backend uses Express.js (TypeScript), Drizzle ORM, and PostgreSQL (Neon serverless), including session-based authentication. The UI/UX adheres to The Sandwich Project's official color palette and Roboto typography, prioritizing clarity, responsiveness, and card-based dashboards.

**Key Technical Implementations & Features:**
-   **Authentication & Permissions**: Role-based access control, session management, password security, and unified permissions.
-   **Data Management**: Comprehensive management of collections, hosts, recipients, users, and audit logs with Zod validation and timezone-safe date handling. `sandwich_collections` table is the operational source of truth.
-   **Search & Filtering**: Real-time capabilities across management interfaces.
-   **Performance Optimization**: Query optimization, caching, pagination, and database connection pooling.
-   **Messaging & Notifications**: Email (SendGrid), Socket.IO chat, SMS via Twilio, and dashboard notifications.
-   **Operational Tools**: Project, meeting, and work log management, user feedback, analytics dashboards, and a permissions-based Collection Walkthrough Tool.
-   **Event Requests Management System**: Tracks requests, handles duplicate detection, manages statuses, integrates with Google Sheets, calculates van driver staffing, supports multi-recipient assignment, and performs comprehensive intake validation. Features an interactive Leaflet map with enhanced popups showing contact details, event IDs, and Google Sheet row IDs for easy event identification and editing. Includes geocoding, AI Intake Assistant for recommendations, and AI Scheduling Assistant.
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