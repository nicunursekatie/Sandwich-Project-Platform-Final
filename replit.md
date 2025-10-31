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

## System Architecture
The application features a React 18 frontend with TypeScript, Vite, TanStack Query, and Tailwind CSS (with shadcn/ui). The backend uses Express.js (TypeScript), Drizzle ORM, and PostgreSQL (Neon serverless), including session-based authentication. It uses environment variables for database separation, Winston for structured logging, and centralized CORS for security. The UI/UX adheres to The Sandwich Project's official color palette and Roboto typography, prioritizing clarity, responsiveness, and card-based dashboards.

**Key Technical Implementations & Features:**
-   **Authentication System**: Handles login/registration, session management with PostgreSQL storage, role-based access control, password resets, and profile management.
-   **Unified Permissions System**: Consistent frontend/backend logic, visual role templates, and granular functional permissions.
-   **Data Management**: Comprehensive management of collections, hosts, recipients, users, and audit logs with Zod validation and timezone-safe date handling.
-   **Dual Data Architecture**: Uses `sandwich_collections` for operational logging and `authoritative_weekly_collections` (Scott's data) as the source of truth for analytics, with a hybrid analytics endpoint combining both.
-   **Search & Filtering**: Real-time capabilities across management interfaces.
-   **Performance Optimization**: Query optimization, caching, pagination, and database connection pooling.
-   **Messaging & Notifications**: Email (SendGrid), Socket.IO chat, SMS via Twilio, and dashboard notifications.
-   **Operational Tools**: Project, meeting, and work log management, user feedback, analytics dashboards, and a permissions-based Collection Walkthrough Tool.
-   **Meeting Management**: Full-featured system with agenda compilation, project integration, PDF export, and permission-controlled notes.
-   **Event Requests Management System**: Tracking, duplicate detection, status tracking, Google Sheets integration, van driver staffing calculations, and comprehensive intake validation. Supports multi-recipient assignment. Event cards have a clean design with status-colored borders and pastel-background sections.
-   **Google Sheets Integration**: Bidirectional automatic synchronization for project tracker and event requests, with dual-layer duplicate prevention and auto-transition for event statuses.
-   **User Activity Logging System**: Comprehensive tracking of authenticated user actions via middleware, displayed in User Management.
-   **Sandwich Type Tracking System**: Comprehensive tracking for individual and group collections with real-time validation, display, and analytics.
-   **Interactive Route Map & Driver Optimization**: Interactive Leaflet map for visualizing host contact locations, multi-host selection, route optimization, and driver assignment.
-   **Sandwich Forecasting Accuracy**: Uses actual recorded counts for completed events and estimated counts for scheduled/in-process events.
-   **24-Hour Volunteer Reminder System**: Automated email reminder system via cron job.
-   **Team Board Commenting System**: Full-featured commenting system with real-time comment counts and author-specific deletion.
-   **Team Board Multi-User Assignment**: Supports multiple assignees with individual removal and multi-select UI.
-   **Guided Tour UX Improvements**: Enhanced tutorial experience.
-   **Email System Configuration**: Uses `katie@thesandwichproject.org` as the verified SendGrid sender. Email templates are table-based HTML with inline CSS. BCC duplicate prevention logic is implemented.
-   **Password Security**: Stores user passwords as bcrypt hashes; auto-upgrades legacy passwords on login.
-   **User Creation**: New user creation requires and sets passwords correctly.
-   **Assignment Email Notifications**: Sends emails to newly assigned users for tasks, projects, events, and team board items.
-   **Groups Catalog Deduplication**: Skips collection log entries if an event request exists for the same organization within ±7 days to prevent double-counting.
-   **Organizations Data**: Comprehensive organization metadata import with categories, school classifications, and religious flags.
-   **OpenAPI Configuration**: Extends Zod with OpenAPI support for schema validation and documentation.
-   **Expenses Receipt Upload**: Handles receipt uploads to Google Cloud Storage via `ObjectStorageService`, returning signed URLs.
-   **Dashboard Annual Goal Display**: Displays the correct organizational annual goal of 500,000 sandwiches.
-   **Social Media Graphics**: Supports image and PDF uploads (up to 10MB) to Google Cloud Storage with optional email notifications controlled by a user checkbox.
-   **SMS Opt-In Email Campaign**: Admins can select users in User Management and send detailed email instructions with direct profile link, explaining how to opt-in to SMS notifications. Email includes 5-step walkthrough, "what you'll receive" section, and branded HTML template from katie@thesandwichproject.org. Fixed double-message bug - users now receive only confirmation SMS at opt-in, then welcome SMS after confirmation.

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