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
The application uses a React 18 frontend with TypeScript, Vite, TanStack Query, and Tailwind CSS (with shadcn/ui). The backend is built with Express.js (TypeScript), Drizzle ORM, and PostgreSQL (Neon serverless), featuring session-based authentication. Database separation for development and production is handled via environment variables. Structured logging is implemented using Winston, and security includes centralized CORS configuration.

The backend employs a modular router architecture with a central router, middleware, and dedicated feature modules for users, collections, messaging, and more. A standardized middleware approach ensures consistent authentication, logging, and error handling.

UI/UX design adheres to The Sandwich Project's official color palette and Roboto typography, prioritizing clarity, responsiveness, and visual hierarchy with card-based dashboards.

Key technical implementations include:
- **Unified Permissions System**: Consistent frontend/backend logic, visual role templates, and standardized `RESOURCE_ACTION` format for strict validation and audit trails.
- **Data Management**: Comprehensive management of collections, hosts, recipients, users, and audit logs with Zod validation and timezone-safe date handling. Includes robust date field validation.
- **Authentication & Authorization**: Role-based access, 30-day session management, and SendGrid-powered password reset.
- **Search & Filtering**: Real-time capabilities across management interfaces.
- **Performance Optimization**: Query optimization, caching, pagination, and database connection pooling.
- **Messaging & Notifications**: Multi-layered communication including email, Socket.IO chat, SMS via Twilio, and dashboard notifications. Includes a Twilio compliance page.
- **Operational Tools**: Project, meeting, and work log management, user feedback, analytics dashboards, and a confidential documents toolkit.
- **Collection Walkthrough Tool**: Permissions-based data entry with a standard form and step-by-step guidance.
- **Analytics**: Dashboard for community impact and user activity tracking.
- **Meeting Management**: Full-featured system with agenda compilation, project integration, and PDF export, including a database-backed meeting notes system.
- **Event Requests Management System**: Complete tracking, duplicate detection, status tracking, and Google Sheets integration.
- **Google Sheets Integration**: Bidirectional automatic synchronization for project tracker and event requests.
- **Enhanced Audit Log Display**: User-friendly audit trail with human-readable field names and formatted values.
- **Email Compliance**: SendGrid emails include required opt-out text, with a centralized utility for consistent footers and proper HTML structure.
- **Team Assignment Auto-Adjustment & Validation**: Comprehensive logic to prevent invalid states in event team assignments, ensuring data consistency across endpoints.
- **Toolkit Attachment Filtering**: Event toolkit email composer filters attachments to include only essential documents for event communications.
- **Event Toolkit Email System**: Professional email system for event contacts with proper formatting, attachments, and SendGrid integration, bypassing internal message wrappers.
- **User Activity Logging System**: Comprehensive tracking of authenticated user actions into `user_activity_logs` table via middleware, powering enhanced analytics.

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