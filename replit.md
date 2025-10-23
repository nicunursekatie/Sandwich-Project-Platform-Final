# Replit.md

## Overview
This full-stack application for The Sandwich Project nonprofit manages sandwich collections, donations, and distributions. It provides comprehensive data management, analytics, and operational tools for volunteers, hosts, and recipients. The project aims to streamline operations, enhance data visibility, and support organizational growth, with a vision to become a vital tool for food security initiatives by scaling operations and improving outreach to reduce food waste and hunger.

## Recent Changes
**October 23, 2025** - Removed obsolete validation checks: Removed deliveryTimeWindow and deliveryParkingAccess from getMissingIntakeInfo function in event-request-validation.ts. These fields are no longer used, so they won't trigger "missing" badges on scheduled event cards.

**October 23, 2025** - Fixed inline editing for recipient assignment: Added Save/Cancel buttons to recipient inline editor in ScheduledCard.tsx and special handling in ScheduledTab.tsx saveEdit function to parse JSON string to array before sending to backend mutation.

**October 23, 2025** - Fixed email rendering issue: Updated email-routes.ts to NOT send plain text version when sending full HTML emails. Gmail was choosing to display the plain text fallback instead of the HTML template. Now full HTML emails (toolkit emails) are sent with HTML-only content, forcing proper rendering.

**October 21, 2025** - Fixed event email system: Configured SendGrid to send from verified domain (katie@thesandwichproject.org) instead of Gmail to prevent spam filtering. Rebuilt HTML email templates using table-based layouts with inline styles for proper rendering in all email clients (Gmail, Outlook, mobile). Templates reference attached PDF toolkit files (5 PDFs from cloud storage) plus Budget & Shopping Planner link.

## Email System Configuration
**CRITICAL: DO NOT MODIFY WITHOUT REVIEWING THIS SECTION**

### SendGrid Setup
- **From Address**: `katie@thesandwichproject.org` (configured in `SENDGRID_FROM_EMAIL` environment variable)
- **Domain**: `thesandwichproject.org` is verified in SendGrid with SPF/DKIM records
- **Never use Gmail addresses** (`katielong2316@gmail.com`) for organizational sending - they trigger spam filters

### Email Templates (client/src/components/event-email-composer.tsx)
**Template Structure:**
- Uses **table-based HTML layouts** with **inline CSS styles** (NOT external stylesheets or CSS classes)
- NO `@import` fonts, NO `linear-gradient`, NO class-based styling
- Email clients (Gmail, Outlook) strip out `<style>` blocks and external CSS
- All styling must be inline: `style="padding: 20px; background-color: #007E8C;"`

**Template Content - MUST reference attachments:**
- Opening: "Attached you'll find a toolkit (everything you need to plan a sandwich-making event)..."
- Single button: "Budget & Shopping Planner" (links to inventorycalculator.html)
- Labeling tip: "The attached PDF for labels are intended to go on the **outside of each bag**"
- DO NOT say "Visit our Event Toolkit website" or include "View Event Toolkit" button
- DO reference the **5 attached PDFs** from cloud storage

**Attachments:**
- Food Safety Guide for Volunteers.pdf
- PBJ Sandwich Making 101.pdf
- Deli Sandwich Making 101.pdf
- Deli Sandwich Labels.pdf
- PBJ Sandwich Labels.pdf
- All files stored in Replit Object Storage (Google Cloud Storage backend), NOT local filesystem
- Files pulled from cloud storage in `server/routes/email-routes.ts` and attached to SendGrid emails

**Email Sending Configuration (server/routes/email-routes.ts):**
- Full HTML emails (starting with `<!DOCTYPE html>`) are sent HTML-only (no plain text version)
- Gmail and other clients will choose plain text over HTML if both are provided
- Non-HTML emails include both HTML and plain text versions for compatibility

**Why This Matters:**
- Modern CSS doesn't work in email clients - they strip it out leaving ugly unstyled text
- Sending from Gmail addresses flags emails as spam
- Referencing website instead of attachments caused hours of confusion about attachment availability
- Sending plain text alongside HTML templates causes Gmail to render plain text instead of formatted HTML

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
The application features a React 18 frontend with TypeScript, Vite, TanStack Query, and Tailwind CSS (with shadcn/ui). The backend uses Express.js (TypeScript), Drizzle ORM, and PostgreSQL (Neon serverless), including session-based authentication. It uses environment variables for database separation, Winston for structured logging, and centralized CORS for security. The UI/UX adheres to The Sandwich Project's official color palette and Roboto typography, prioritizing clarity, responsiveness, and card-based dashboards.

**Key Technical Implementations & Features:**
-   **Authentication System**: Handles login/registration, session management with PostgreSQL storage, role-based access control, password resets via SendGrid, and profile management.
-   **Unified Permissions System**: Consistent frontend/backend logic, visual role templates, and granular functional permissions (e.g., `COOLERS_VIEW`, `DOCUMENTS_CONFIDENTIAL`).
-   **Data Management**: Comprehensive management of collections, hosts, recipients, users, and audit logs with Zod validation and timezone-safe date handling.
-   **Search & Filtering**: Real-time capabilities across management interfaces.
-   **Performance Optimization**: Query optimization, caching, pagination, and database connection pooling.
-   **Messaging & Notifications**: Email, Socket.IO chat, SMS via Twilio, and dashboard notifications.
-   **Operational Tools**: Project, meeting, and work log management, user feedback, analytics dashboards, and a permissions-based Collection Walkthrough Tool.
-   **Meeting Management**: Full-featured system with agenda compilation, project integration, PDF export, and permission-controlled notes.
-   **Event Requests Management System**: Tracking, duplicate detection, status tracking, Google Sheets integration, van driver staffing calculations, and comprehensive intake validation.
-   **Multi-Recipient Assignment**: Events can be assigned to multiple destinations with prefixed IDs and badge-based UI. Recipient dropdowns now show individual host contacts (e.g., "Anna Baylin (North Atlanta)") instead of host location areas, making it clear where sandwiches are being delivered. Backward compatibility maintained for legacy host location assignments (displayed as "Location (Legacy - Area)").
-   **Google Sheets Integration**: Bidirectional automatic synchronization for project tracker and event requests.
-   **User Activity Logging System**: Comprehensive tracking of authenticated user actions into `user_activity_logs` table via middleware, displayed in User Management.
-   **Sandwich Type Tracking System**: Comprehensive tracking of sandwich types for individual sandwiches and group collections with real-time validation, display, and analytics.
-   **Interactive Route Map & Driver Optimization**: Interactive Leaflet map for visualizing host contact locations, multi-host selection, route optimization, and driver assignment.
-   **Sandwich Forecasting Accuracy**: Uses actual recorded counts for completed events and estimated counts for scheduled/in-process events.
-   **24-Hour Volunteer Reminder System**: Automated email reminder system via cron job.
-   **Team Board Commenting System**: Full-featured commenting system with real-time comment counts and author-specific deletion.
-   **Guided Tour UX Improvements**: Enhanced tutorial experience with reduced overlay dimming and improved scrolling behavior.
-   **Google Sheets Sync System**: Dual-layer duplicate prevention for event requests using `imported_external_ids` table and unique constraints, with an auto-transition system for event statuses.

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