# Replit.md

## Overview
This full-stack application for The Sandwich Project, a nonprofit, manages sandwich collections, donations, and distributions. It provides comprehensive data management, analytics, and operational tools for volunteers, hosts, and recipients. The project aims to streamline operations, enhance data visibility, and support the organization's growth and impact in addressing food insecurity. Its business vision is to become a vital tool for food security initiatives, with market potential in supporting volunteer-driven community projects. The ambition is to scale operations and improve outreach, ultimately contributing to a significant reduction in food waste and hunger.

## Recent Changes
**September 19, 2025 - Major System Overhaul & Unified Permissions Architecture:**
- **Permissions System Modernization**: Migrated 172 legacy permission references across 24 files to standardized RESOURCE_ACTION format
- **Unified Permission Checking**: Created `shared/unified-auth-utils.ts` (233 lines) as single source of truth for frontend/backend permission logic
- **Modern Permissions Editor**: New `client/src/components/modern-permissions-editor.tsx` (898 lines) with role templates, categorized permissions, and visual UI
- **Enhanced Security**: Eliminated frontend/backend permission mismatches, added strict validation and audit trails
- **TypeScript Integration**: Full type safety with comprehensive test suite in `test/unified-permissions.test.js` (244 lines)
- **Architectural Cleanup**: Removed duplicate components, standardized permission categories into 10 logical groups
- **Future-Ready**: Included permissions for planned features (USERS_ADD/DELETE, EVENT_REQUESTS_SYNC, etc.)

**September 17, 2025 - Send Toolkit Customization & Event Scheduling Enhancement:**
- Made Send Toolkit emails fully customizable with logged-in user's information (name, phone, email)
- Added phoneNumber and preferredEmail fields to user profile management
- Replaced hardcoded Stephanie Carter details with dynamic user data in email composer
- Added optional scheduling link checkbox - users can choose whether to include scheduling call link
- Enhanced Mark Scheduled form with notes field for event requests
- Email signature now dynamically displays user's name, phone (if provided), and preferred email (if provided)

**September 16, 2025 - Agenda Items Routing Fix:**
- Fixed critical bug where `/api/agenda-items` requests were incorrectly routed to meetings creation logic instead of agenda items creation
- Created dedicated agenda items router at `server/routes/agenda-items.ts` with proper validation using `insertAgendaItemSchema`
- Updated `server/routes/index.ts` to use the dedicated agenda items router
- Resolved persistent port conflicts preventing server restart by using `restart_workflow` tool
- Logs now show requests correctly hitting `/api/agenda-items` endpoint instead of meetings logic
- Authentication working properly through web interface for admin@sandwich.project

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
- **Logging**: Winston-based structured logging with service-specific loggers, log rotation, and environment-based configuration.
- **Security**: Centralized CORS configuration with environment-aware origin validation, eliminating wildcard origins in production.

### Backend Router Architecture (Modular Refactoring - 2025)
The application underwent a major architectural refactoring in September 2025, transforming from a monolithic 9,000+ line routes.ts file into a clean, modular structure:

**Router Structure:**
- **server/routes/index.ts**: Central router that orchestrates all feature modules with consistent middleware application
- **server/middleware/index.ts**: Centralized middleware configuration providing standardized middleware stacks

**Feature Modules (server/routes/):**
- **core/**: Health checks, system monitoring, and core application routes
- **users/**: User management, role assignment, and authentication
- **projects/**: Project management, assignments, and task coordination
- **tasks/**: Task management, completion tracking, and notifications  
- **collections/**: Sandwich collection data entry and management
- **meetings/**: Meeting management, agendas, and minutes
- **messaging/**: Internal messaging system and notifications
- **reports/**: Analytics and report generation
- **search/**: Search functionality across the application
- **storage/**: File uploads and document management
- **notifications/**: System notifications and alerts
- **versioning/**: Data versioning and change tracking

**Middleware Architecture:**
- **createStandardMiddleware()**: Provides consistent middleware ordering (authentication, logging, sanitization, permissions)
- **createErrorHandler()**: Standardized error handling with module-specific logging
- **createPublicMiddleware()**: For routes that don't require authentication
- Centralized import point for all middleware components

### UI/UX Decisions
The application features a consistent brand identity using The Sandwich Project's official color palette:
- **Teal Primary**: #236383
- **Orange Secondary**: #FBAD3F
- **Burgundy Accent**: #A31C41
- **Teal Muted**: #007E8C
Typography uses Roboto font family. UI elements prioritize clarity, responsiveness, and visual hierarchy with card-based dashboards and clear sectioning.

### Technical Implementations
- **Unified Permissions System (September 2025)**: Complete modernization with `shared/unified-auth-utils.ts` as single source of truth, `client/src/components/modern-permissions-editor.tsx` with visual role templates and categorized permissions, standardized RESOURCE_ACTION format across 24+ files, and comprehensive test suite in `test/unified-permissions.test.js`. Eliminates frontend/backend permission mismatches with strict validation and TypeScript integration.
- **Structured Logging (September 2025)**: Implemented winston-based logging system replacing scattered console.log statements. Features service-specific loggers, structured metadata, log levels (error/warn/info/http/debug), helper functions for common patterns, console output for development, and file rotation for production.
- **Data Management**: Comprehensive management of Sandwich Collections, Hosts, Recipients, Projects, Users (with role-based access), and Audit Logs. Includes Zod validation and timezone-safe date handling.
- **Authentication & Authorization**: Modern unified permissions system with `shared/unified-auth-utils.ts` providing consistent frontend/backend permission logic. Features standardized RESOURCE_ACTION format, role templates (Volunteer, Host, Core Team, Admin), modern permissions editor with 10 categorized permission groups, strict validation, audit trails, and comprehensive TypeScript integration. Includes 30-day session management and SendGrid-powered password reset.
- **Search & Filtering**: Comprehensive search and filter functionality across management interfaces with real-time filtering and dynamic search bars.
- **Host Contact Directory**: Integrated view toggle within host management for individual contact person cards with search capabilities.
- **Performance**: Optimized with query optimization, LRU caching, pagination, memoization, database connection pooling, and Express gzip/brotli compression.
- **Messaging & Notifications**: Multi-layered communication system including Gmail-style email interface, committee-specific messaging, real-time Socket.IO chat with @mentions and persistent likes, and dashboard bell notifications. Includes a Kudos System.
- **Drivers Management**: Full CRUD operations for drivers with agreement tracking and input validation.
- **Operational Tools**: Project management, meeting management, work logs, user feedback portal, analytics dashboards with PDF/CSV report generation, and an important documents toolkit.
- **Collection Walkthrough Tool**: Permissions-based data entry with a standard form and a step-by-step walkthrough.
- **Analytics**: Comprehensive dashboard for community impact insights (sandwiches, organizations, volunteers) with interactive visualizations. User activity tracking includes login times and behavior patterns.
- **Distribution Tracking**: System for logging sandwich distributions.
- **Recipients Focus Area Tracking**: Enhanced recipients management with focus area field (youth, veterans, seniors, families).
- **Wishlist System**: Amazon wishlist suggestion system with database persistence, API, responsive UI, and admin review.
- **Meeting Management**: Full-featured system with automated agenda compilation, project integration, Google Sheets export, task status controls, enhanced discussion interface, and PDF export for agendas. Includes task creation from meeting notes.
- **Event Requests Management System**: Complete tracking system with database schema, duplicate detection, status tracking, permissions, CRUD API, responsive UI, and full Google Sheets integration. Includes workflow for unresponsive contacts.
- **Google Sheets Integration**: Complete bidirectional automatic synchronization with Google Sheets for project tracker and event requests.
- **Confidential Document Storage**: Secure file storage system with email-based access control restricted to admin@sandwich.project and katielong2316@gmail.com only. Features audit logging, file type validation, comprehensive security measures, and 100MB file upload limit (increased from 10MB in September 2025).

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