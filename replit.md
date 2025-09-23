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
- **Authentication & Authorization**: Role-based access with consistent permission logic, role templates (Volunteer, Host, Core Team, Admin), 30-day session management, and SendGrid-powered password reset.
- **Search & Filtering**: Real-time search and filtering across management interfaces.
- **Performance**: Optimized with query optimization, LRU caching, pagination, memoization, database connection pooling, and Express compression.
- **Messaging & Notifications**: Multi-layered communication including email interface, committee-specific messaging, real-time Socket.IO chat, dashboard notifications, and a Kudos System.
- **Operational Tools**: Project management, meeting management, work logs, user feedback, analytics dashboards, and an important documents toolkit.
- **Collection Walkthrough Tool**: Permissions-based data entry with a standard form and a step-by-step walkthrough.
- **Analytics**: Comprehensive dashboard for community impact insights with interactive visualizations and user activity tracking.
- **Distribution Tracking**: System for logging sandwich distributions.
- **Recipients Focus Area Tracking**: Enhanced recipients management with a focus area field.
- **Wishlist System**: Amazon wishlist suggestion system with database persistence and a responsive UI.
- **Meeting Management**: Full-featured system with automated agenda compilation, project integration, Google Sheets export, task status controls, and PDF export.
- **Event Requests Management System**: Complete tracking with database schema, duplicate detection, status tracking, permissions, CRUD API, responsive UI, and Google Sheets integration.
- **Google Sheets Integration**: Bidirectional automatic synchronization with Google Sheets for project tracker and event requests.
- **Confidential Document Storage**: Secure file storage with email-based access control, audit logging, file type validation, and a 100MB upload limit.

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