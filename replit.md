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

**Port Configuration (.replit file)**: 
- Development (popout preview): `localPort = 5000`, `externalPort = 5000` - required for dev preview to work
- Production (Autoscale deployment): `localPort = 5000`, `externalPort = 80` - Autoscale requires single port, uses 80 for standard HTTP
- CRITICAL: Autoscale deployments fail if multiple port definitions exist - keep only ONE `[[ports]]` section

**Authentication System**: The official authentication system is implemented in `server/temp-auth.ts` (note: despite the legacy filename, this is the production authentication system, not temporary). It handles login/registration, session management via express-session with PostgreSQL storage, role-based access control, password resets via SendGrid, and profile management. The `isAuthenticated` middleware validates sessions and refreshes user permissions from the database on each request.

The backend employs a modular router architecture with a central router, middleware, and dedicated feature modules for users, collections, messaging, and more. A standardized middleware approach ensures consistent authentication, logging, and error handling.

UI/UX design adheres to The Sandwich Project's official color palette and Roboto typography, prioritizing clarity, responsiveness, and visual hierarchy with card-based dashboards.

Key technical implementations include:
- **Unified Permissions System**: Consistent frontend/backend logic, visual role templates, and standardized `RESOURCE_ACTION` format for strict validation and audit trails. Permission dependencies (e.g., NAV_VOLUNTEERS → VOLUNTEERS_VIEW) are applied at runtime in both `hasPermission()` and `checkPermission()` functions, ensuring users with navigation permissions automatically get corresponding functional permissions even if they were granted before the dependency system was implemented.
- **Data Management**: Comprehensive management of collections, hosts, recipients, users, and audit logs with Zod validation and timezone-safe date handling. Includes robust date field validation.
- **Authentication & Authorization**: Role-based access, 30-day session management, and SendGrid-powered password reset.
- **Search & Filtering**: Real-time capabilities across management interfaces.
- **Performance Optimization**: Query optimization, caching, pagination, and database connection pooling.
- **Messaging & Notifications**: Multi-layered communication including email, Socket.IO chat, SMS via Twilio, and dashboard notifications. Includes a Twilio compliance page.
- **Operational Tools**: Project, meeting, and work log management, user feedback, analytics dashboards, and a confidential documents toolkit.
- **Collection Walkthrough Tool**: Permissions-based data entry with a standard form and step-by-step guidance.
- **Analytics**: Dashboard for community impact and user activity tracking.
- **Meeting Management**: Full-featured system with agenda compilation, project integration, and PDF export, including a database-backed meeting notes system.
- **Event Requests Management System**: Complete tracking, duplicate detection, status tracking, and Google Sheets integration. Van drivers are correctly counted toward total driver count in staffing calculations across all event card types. Includes optional volunteer count field for tracking expected number of volunteers participating in group events - available in manual add event, mark scheduled, and all edit forms. Organization categorization system enables classification of event groups (Small/Medium Corporation, Large Corporation, Church/Faith Group, School, Neighborhood, Club, Other) with conditional school classification (Public, Private, Charter) appearing when School category is selected.
- **Multi-Recipient Assignment System**: Events can be assigned to multiple destinations including hosts, recipient organizations, and custom text entries. The `assignedRecipientIds` field (stored as `text().array()` in PostgreSQL) uses a prefix-based format to distinguish types: "host:ID" for host organizations, "recipient:ID" for recipient organizations, and "custom:text" for custom destinations. The MultiRecipientSelector component provides a badge-based UI with visual distinction (Home icon for hosts, Building icon for recipients) and custom text input capability. Integrated into both the Edit Event dialog and "Completed Event Details" section with proper display in CompletedCard. PostgreSQL array parsing handles complex cases including commas and quotes in custom text (supports both "" doubled quotes and \" backslash escapes). Legacy numeric IDs are automatically migrated to "recipient:ID" format on load.
- **Google Sheets Integration**: Bidirectional automatic synchronization for project tracker and event requests.
- **Enhanced Audit Log Display**: User-friendly audit trail with human-readable field names and formatted values.
- **Email Compliance**: SendGrid emails include required opt-out text, with a centralized utility for consistent footers and proper HTML structure.
- **Team Assignment Auto-Adjustment & Validation**: Comprehensive logic to prevent invalid states in event team assignments, ensuring data consistency across endpoints.
- **Toolkit Attachment Filtering**: Event toolkit email composer filters attachments to include only essential documents for event communications.
- **Event Toolkit Email System**: Professional email system for event contacts with proper formatting, attachments, and SendGrid integration, bypassing internal message wrappers.
- **User Activity Logging System**: Comprehensive tracking of authenticated user actions into `user_activity_logs` table via middleware, powering enhanced analytics.
- **Groups Catalog Event Editing**: Direct access from groups catalog to edit individual event request details. Each event request in the organization history dialog includes an "Edit Request" button that navigates to the event management interface with the specific event pre-loaded for editing, enabling quick data cleanup and corrections for imported records.
- **Team Availability Calendar**: Calendar integration for tracking team member time off and unavailability. The system focuses on marking when team members are UNAVAILABLE rather than available (more practical for operations). Users mark their time off via "My Schedule & Time Off" page, coordinators view team unavailability via "Team Time Off & Unavailability" dashboard. Features include orange-highlighted time off periods, de-emphasized available times in gray, and "Mark Time Off" interface. Uses overlap-based date range queries and enforces proper CRUD permissions (AVAILABILITY_VIEW, AVAILABILITY_ADD, AVAILABILITY_EDIT_OWN/ALL, AVAILABILITY_DELETE_OWN/ALL). All three availability pages (My Schedule & Time Off, Team Time Off & Unavailability, and Volunteer Calendar) include "Back to Dashboard" navigation buttons for easy return to main application. Volunteer Calendar embeds live Google Calendar showing TSP team member availability with public-friendly parameters (wkst=1, bgcolor=#ffffff) for viewing without Google sign-in requirement.
- **Interactive Guided Tour System**: Revolutionary on-demand help system with floating help button (?), categorized "What are you looking for?" menu, and step-by-step guided tours. Features 7 comprehensive tours covering Files & Resources (logos, forms), Events & Calendar (calendar view, symbols), Analytics & Reports (tabs overview), My Work (dashboard assignments, action hub, event assignments), and Team Management. Non-blocking spotlight overlay system highlights actual UI elements with smooth animations, keyboard navigation (ESC, arrows), localStorage persistence for tour progress, and full mobile responsiveness. Includes searchable Help page (/help) with expandable sections and "Launch Tour" buttons. Brand-consistent design using #236383, #fbad3f, #007e8c colors. Users can skip ahead, go back, or close anytime without forced completion - truly on-demand feature discovery.
- **TSP Contact Assignment Email Notifications**: Automated email notifications when users are assigned as TSP contact for events. Uses SendGrid with compliant footer, includes event details (organization name, event date), and provides platform link. Notifications trigger only on actual assignment changes to prevent spam. Error handling ensures assignment succeeds even if email delivery fails.
- **Duplicate Cleanup Tool Enhancement**: Radio button selection in duplicate detection dialog correctly respected during deletion. Single "Delete Duplicates" button removes only non-selected entries while keeping user's chosen record. Previous "Delete All" button removed to prevent accidental deletion of selected entries.

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