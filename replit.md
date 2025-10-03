# Replit.md

## Overview
This full-stack application for The Sandwich Project nonprofit manages sandwich collections, donations, and distributions. It provides comprehensive data management, analytics, and operational tools for volunteers, hosts, and recipients, aiming to streamline operations, enhance data visibility, and support the organization's growth. The business vision is to become a vital tool for food security initiatives, with market potential in supporting volunteer-driven community projects, scaling operations, and improving outreach to reduce food waste and hunger.

## User Preferences
Preferred communication style: Simple, everyday language.
UI Design: Button labels and interface text must be extremely clear about their function - avoid ambiguous labels like "Submit" in favor of specific action descriptions like "Enter New Data".
Form Design: Eliminate redundant or confusing form fields - host dialogs should have a single "Host Location Name" field instead of separate "Name" and "Host Location" fields.
Mobile UX Priority: Mobile user experience is critical - chat positioning and space efficiency are key concerns. Vehicle type should NOT be required for new driver entries.
Documentation: All technical findings and fixes must be documented in replit.md to avoid repeated searching and debugging.
Navigation Icons: Collections log icon in simple-nav should use sandwich logo.png from LOGOS folder.
Desktop Chat UX: Desktop users require proper scrolling behavior without nested scrolling containers that cause page focus issues - chat layout must handle desktop and mobile differently.

## System Architecture

### Core Technologies
- **Frontend**: React 18 (TypeScript), Vite, TanStack Query, Tailwind CSS (with shadcn/ui), React Hook Form (with Zod).
- **Backend**: Express.js (TypeScript), Drizzle ORM, PostgreSQL (Neon serverless), Session-based authentication (connect-pg-simple), Replit Auth.
- **Database**: Dev/Production separation with `DATABASE_URL` (development workspace) and `PRODUCTION_DATABASE_URL` (deployed app). `server/db.ts` automatically uses production database when `PRODUCTION_DATABASE_URL` is set, ensuring development changes don't affect live users.
- **Logging**: Winston-based structured logging with service-specific loggers, log rotation, and environment-based configuration.
- **Security**: Centralized CORS configuration with environment-aware origin validation.

### Backend Router Architecture
The application features a modular backend router architecture:
- **server/routes/index.ts**: Central router for orchestrating feature modules and applying consistent middleware.
- **server/middleware/index.ts**: Centralized middleware configuration.
- **Feature Modules (server/routes/)**: Dedicated modules for core, users, projects, tasks, collections, meetings, messaging, reports, search, storage, notifications, and versioning.
- **Middleware Architecture**: Standardized functions (`createStandardMiddleware()`, `createErrorHandler()`, `createPublicMiddleware()`) provide consistent authentication, logging, sanitization, permissions, and error handling.

### UI/UX Decisions
The application uses The Sandwich Project's official color palette (Teal Primary: #236383, Orange Secondary: #FBAD3F, Burgundy Accent: #A31C41, Teal Muted: #007E8C) and Roboto typography. UI elements prioritize clarity, responsiveness, and visual hierarchy with card-based dashboards.

### Technical Implementations
- **Unified Permissions System**: Modernized system using `shared/unified-auth-utils.ts` for consistent frontend/backend logic, `client/src/components/modern-permissions-editor.tsx` for visual role templates and categorized permissions, and a standardized `RESOURCE_ACTION` format. Ensures strict validation, audit trails, and full TypeScript integration.
- **Structured Logging**: Winston-based system with service-specific loggers, structured metadata, log levels, and file rotation.
- **Data Management**: Comprehensive management of Sandwich Collections, Hosts, Recipients, Projects, Users (with role-based access), and Audit Logs, including Zod validation and timezone-safe date handling.
- **Date Field Validation Fix**: Resolved critical "value.toISOString is not a function" errors during event creation by implementing hardened Zod date transformations in insertEventRequestSchema for scheduledCallDate, followUpOneDayDate, and followUpOneMonthDate fields. The fix trims whitespace, converts empty strings to null, validates YYYY-MM-DD format with regex, and prevents Invalid Date objects from reaching the database layer. This ensures event creation works properly with both blank optional date fields and valid date inputs.
- **Authentication & Authorization**: Role-based access with consistent permission logic, role templates (Volunteer, Host, Core Team, Admin), 30-day session management, and SendGrid-powered password reset.
- **Search & Filtering**: Real-time search and filtering across management interfaces.
- **Performance**: Optimized with query optimization, LRU caching, pagination, memoization, database connection pooling, and Express compression.
- **Messaging & Notifications**: Multi-layered communication including email interface, committee-specific messaging, real-time Socket.IO chat, dashboard notifications, SMS notifications with Twilio integration, and a Kudos System.
- **Operational Tools**: Project management, meeting management, work logs, user feedback, analytics dashboards, and an important documents toolkit.
- **Collection Walkthrough Tool**: Permissions-based data entry with a standard form and a step-by-step walkthrough.
- **Analytics**: Comprehensive dashboard for community impact insights with interactive visualizations and user activity tracking.
- **Distribution Tracking**: System for logging sandwich distributions.
- **Recipients Focus Area Tracking**: Enhanced recipients management with a focus area field.
- **Wishlist System**: Amazon wishlist suggestion system with database persistence and a responsive UI.
- **Meeting Management**: Full-featured system with automated agenda compilation, project integration, Google Sheets export, task status controls, and PDF export.
- **Meeting Notes System**: Complete database-backed meeting notes with CRUD operations, bulk actions, filtering by project/meeting/type/status, and specialized rendering for different note types (discussion points, decision items, tabled projects, off-agenda items). Fixed recurring issue where API routes were stubbed out - now fully connected to database storage via `server/routes/meeting-notes.ts`.
- **Event Requests Management System**: Complete tracking with database schema, duplicate detection, status tracking, permissions, CRUD API, responsive UI, and Google Sheets integration.
- **Google Sheets Integration**: Bidirectional automatic synchronization with Google Sheets for project tracker and event requests, with intelligent deletion tracking to prevent re-importing manually deleted items.
- **SMS Notifications System**: Complete Twilio-powered SMS reminder system with user opt-in/opt-out functionality, dashboard prompts for adoption, integrated user profile notifications tab, and admin-controlled weekly reminders for missing sandwich collection submissions.
- **Twilio Compliance Documentation**: Public SMS verification docs page (`/sms-verification-docs`) for Twilio compliance review, built with plain HTML/Tailwind to avoid React context dependencies. Shows complete consent process, UI mockups, opt-out methods, message frequency, and data protection policies.
- **Confidential Document Storage**: Secure file storage with email-based access control, audit logging, file type validation, and a 100MB upload limit.
- **Enhanced Audit Log Display**: User-friendly audit trail system with human-readable field names, properly formatted values (dates, booleans, phone numbers), and complete tracking of all meaningful value changes including falsy values (0, empty strings, false). Converts technical field names to plain English and provides clear "Previous/Updated to" formatting for easy comprehension by non-technical users.
- **SendGrid Email Compliance**: All SendGrid emails include required opt-out text for compliance. Centralized footer utility (`server/utils/email-footer.ts`) provides consistent unsubscribe information across all email types: toolkit emails (`server/services/email-service.ts`), suggestion notifications (`server/sendgrid.ts`), notification templates (`server/notifications/email-service.ts`), chat mentions (`server/services/email-notification-service.ts`), and password resets (`server/routes/password-reset.ts`). Footer text: "To unsubscribe from these emails, please contact us at katie@thesandwichproject.org or reply STOP."
- **Team Assignment Auto-Adjustment & Validation**: Implemented comprehensive validation and auto-adjustment logic for event team assignments to prevent impossible states. The system now:
  1. **Prevents Invalid Manual Changes**: When users manually set driversNeeded/speakersNeeded/volunteersNeeded, the system validates that the value is not less than currently assigned staff. If invalid, it auto-corrects to match the assigned count with a warning log.
  2. **Auto-Adjusts on Assignment Changes**: When drivers (including van drivers), speakers, or volunteers are assigned to an event, if assignments exceed current needs, the system automatically increases the needed count to match.
  3. **Counts Van Drivers Properly**: Van drivers are correctly counted alongside regular drivers in all calculations (assignedVanDriverId is treated as 1 driver when not null/empty).
  4. **Null-Safe Handling**: Proper handling for speakerDetails objects and empty string checks for van driver IDs.
  5. **Applied Across All Endpoints**: Validation and auto-adjustment logic implemented in PATCH /:id, PUT /:id, and PATCH /:id/drivers endpoints.
  6. This prevents display bugs like "1/0 assigned" and ensures data consistency. One-time SQL migration executed to fix 3 existing events with mismatched assignment counts.
- **Toolkit Attachment Filtering**: Event toolkit email composer (`/api/storage/documents` endpoint in `server/routes/storage/index.ts`) returns ONLY essential toolkit documents for event communications. Filter criteria matches frontend logic: includes documents containing "food safety" (except for hosts), "deli", "pbj"/"pb&j", or "sandwich making" in title/filename. Currently returns 5 documents: Food Safety Guide for Volunteers, PBJ Sandwich Making 101, Deli Sandwich Making 101, PBJ Sandwich Labels, and Deli Sandwich Labels. Excludes all confidential documents and Food Safety Guide for Hosts to prevent accidental exposure of internal materials.
- **Event Toolkit Email System**: Complete professional email system for event contacts with proper formatting and attachments. System consists of:
  1. **Email Templates**: Event emails (`/api/email/event` endpoint in `server/routes/email-routes.ts`) send clean, professional emails directly via SendGrid WITHOUT internal message wrappers - no "New Message" header or "You have a new message from..." text that appears in user-to-user emails. Templates include professional HTML with gradient headers, organized sections, CTA buttons, and a labeling tip explaining labels go on bag exteriors.
  2. **Attachment Metadata**: Enhanced `server/sendgrid.ts` accepts attachment objects with `{filePath, originalName}` metadata, using `originalName` when provided (with fallback to basename) to ensure proper filenames instead of hash names.
  3. **Document Resolution**: Email service (`server/services/email-service.ts`) automatically fetches document metadata from database when attachments are document IDs, transforming them to `{filePath, originalName}` format for SendGrid.
  4. **Formatting**: HTML emails properly convert line breaks (\n to <br>) and markdown bold (**text** to <strong>) for professional presentation.
  5. **HTML Structure Fix**: CRITICAL - Compliance footer must be injected BEFORE closing `</body></html>` tags, not appended after. Backend uses regex replacement to inject footer inside the HTML document to prevent Gmail from falling back to plain text rendering. Invalid HTML with content after `</html>` breaks email client rendering.
  6. **Dual Handling**: Draft emails saved to internal system; actual sends go directly via SendGrid with clean formatting and proper attachments (Food Safety Volunteers.pdf, PBJ Sandwich Making 101.pdf, etc.).
- **Logger Import Pattern**: Use `import { logger } from '../middleware/logger'` (or appropriate relative path to middleware/logger) for route files. DO NOT use `import { logger } from '../utils/logger'` - the utils/logger only exports a default export, not a named logger export. The middleware/logger provides the named export used throughout route files.

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
- **Google Integration**: Google Sheets API, `@google-cloud/storage`
- **Analytics**: Google Analytics