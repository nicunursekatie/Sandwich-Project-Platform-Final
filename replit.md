# Replit.md

## Overview
This full-stack application for The Sandwich Project, a nonprofit, manages sandwich collections, donations, and distributions. It provides comprehensive data management, analytics, and operational tools for volunteers, hosts, and recipients. The project aims to streamline operations, enhance data visibility, and support the organization's growth and impact in addressing food insecurity. Its business vision is to become a vital tool for food security initiatives, with market potential in supporting volunteer-driven community projects. The ambition is to scale operations and improve outreach, ultimately contributing to a significant reduction in food waste and hunger.

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

### UI/UX Decisions
The application features a consistent brand identity using The Sandwich Project's color palette (teal primary, orange secondary, burgundy accent) and Roboto typography. UI elements prioritize clarity with well-defined button labels and interface text. The design is responsive, adapting for mobile and tablet views with features like hamburger menus and compact forms. Visual hierarchy is established through card-based dashboards and clear sectioning. Form elements are enhanced with focus states and subtle hover effects for improved user interaction.

### Technical Implementations
- **Data Models**: Comprehensive management of Sandwich Collections, Hosts, Recipients, Projects, Users (with role-based access), and Audit Logs.
- **Authentication & Authorization**: Comprehensive granular permissions system with custom role management, robust 30-day session management, detailed audit logging, and permissions controls for all application components.
- **Search & Filtering System**: Comprehensive search and filter functionality implemented across all management interfaces (Hosts, Drivers, Recipients) with real-time filtering, dynamic search bars, specialized filter options (status, region, contract, agreement, van approval), results summaries, and clear filter controls. Includes responsive UI with collapsible filter panels and results counters. TSP Contact filtering enhanced to split combined names (e.g., "Vicki/Henry") into individual searchable options with inclusive matching.
- **Host Contact Directory**: Integrated view toggle within host management providing individual contact person cards. Users can switch between "Locations" view (original host-centric cards) and "Contacts" view (individual contact person cards). Contact cards display each person with their name, role, contact information, host location, and edit capabilities. Comprehensive search works across contact names, roles, phone numbers, emails, and host locations. Provides direct access to individual contact information with clickable phone/email links.
- **Performance**: Optimized for speed with query optimization, LRU caching, pagination, memoization, database connection pooling, and Express gzip/brotli compression.
- **Messaging & Notifications**: Multi-layered communication system featuring a Gmail-style email interface, committee-specific messaging, and real-time Socket.IO chat with @mentions, autocomplete dropdown, persistent like functionality, and email notifications. Dashboard bell notifications provide timely updates. Desktop chat layout properly handles scrolling without nested containers that cause focus/scrolling issues. Mobile chat height optimized to ensure message input box remains visible without requiring scrolling.
- **Drivers Management**: Fully functional drivers management component with agreement tracking badges. Shows emailAgreementSent status with green "Agreement Sent" or orange "Missing Agreement" badges to indicate driver compliance status. Driver form includes name, email, phone (required), host location dropdown populated from database, availability notes (free text), agreement signed checkbox, van approved checkbox, and active/inactive status toggle. Database timestamp error resolved by removing timestamp fields from update operations. Complete CRUD operations with proper permissions: frontend uses PERMISSIONS.MANAGE_DRIVERS, backend requires "manage_drivers" permission for POST/PUT/DELETE operations and "access_drivers" for GET operations. Delete functionality includes confirmation dialog and proper error handling.
- **Operational Tools**: Includes a project management system, meeting management, work logs, a user feedback portal, analytics dashboards with PDF/CSV report generation, and a toolkit for important documents.
- **Data Integrity**: Ensured through automated audit logging, Zod validation for all data inputs, and systems for correcting suspicious entries.
- **Form Validation & Data Conversion**: Critical data type mismatches resolved with automatic conversion handling in backend schemas. Recipients form converts estimatedSandwiches (string→number/null) and contractSignedDate (string→Date/null). Website fields changed from type="url" to type="text" for flexibility. Driver vehicle type is optional.
- **Real-time Chat**: Socket.IO-powered system supporting distinct channels, real-time message broadcasting, persistent like functionality, and @mentions with autocomplete dropdown and email notifications.
- **Collection Walkthrough Tool**: Provides a permissions-based data entry system with a standard form and a step-by-step walkthrough. Automatically assigns collection dates to the most recent Wednesday for consistent reporting.
- **Kudos System**: Integrated into the Gmail-style inbox with read tracking and archiving capabilities.
- **Analytics**: Comprehensive dashboard providing community impact insights including total sandwiches provided, organizations served, volunteer participation, and support opportunities with interactive visualizations. Features key metrics, user activity tracking, and comprehensive filtering to exclude administrative accounts from analytics data.
- **User Roles**: Includes "Core Team" role with elevated permissions.
- **User Activity Tracking**: Comprehensive detailed activity analytics tab in User Management showing login times, user behavior patterns, action tracking, and usage analytics with real-time filtering capabilities. Fixed JSON parsing error in DetailedActivityAnalytics component by removing JSON.parse() calls on metadata field that was already an object. Activity data now properly displays 9,500+ logs with working filters and real-time updates.
- **Authentication UI**: Modernized login and authentication experience with enhanced landing pages, professional styling, and consistent branding.
- **Password Reset System**: Complete SendGrid-powered password reset functionality with professional email templates, secure token-based authentication, and environment-aware URL generation.
- **Donation Tracking**: System for logging sandwich distributions from host locations to recipient organizations.
- **Streamlined Navigation**: Contact management is handled directly within each specific section (Hosts, Drivers, Recipients, Volunteers).
- **Complete Permissions Coverage**: All application components have proper permissions controls, including Weekly Monitoring, Events, SignUp Genius, Development tools, Work Logs, and Toolkit.
- **Wishlist System**: Amazon wishlist suggestion system fully implemented with database persistence, API endpoints, responsive UI, and admin review functionality with MANAGE_WISHLIST permissions.
- **Mobile Header Optimization**: Header layout optimized for tablets/iPads ensuring logout button remains accessible even with console open. Uses gap-based spacing and flex-shrink-0 constraints.
- **Comprehensive Meeting Management**: Full-featured meeting system with automated agenda compilation using required sections ("Old Business", "Urgent Items", "Housekeeping", "New Business"), intelligent project integration (projects marked with reviewInNextMeeting automatically appear in agendas), and Google Sheets export with precise column mapping (A:L) for Christine's proven format. Includes MeetingAgendaCompiler service for structured agenda generation, GoogleSheetsMeetingExporter for real-time synchronization, enhanced database methods for compiled agendas, complete API endpoints, and sophisticated UI dashboard with compilation and export capabilities.

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
- **Analytics**: Google Analytics (G-9M4XDZGN68)

## Recent Changes
### August 26, 2025 - Deployment Fix Complete & Verified
- **Issue**: Deployment failed due to missing `@google-cloud/storage` dependency and build configuration
- **Root Cause**: Build process was bundling Google Cloud Storage but excluding it from final deployment, causing runtime import errors
- **Comprehensive Solution Applied**: 
  - ✅ Enhanced custom build script (build.js) with pre-build dependency verification
  - ✅ Updated .replitdeployconfig with comprehensive install and build commands
  - ✅ All Google Cloud dependencies confirmed present in package.json (@google-cloud/storage@7.7.0)
  - ✅ Runtime dependency imports tested and working correctly
  - ✅ Build process completed without errors/warnings
- **Build Configuration**: Proper .replitdeployconfig with `npm install && node build.js` build command and `npm ci` install command
- **Health Monitoring**: /api/health endpoint working correctly (200 OK responses confirmed)
- **Status**: ✅ All deployment fixes verified and working. Project is deployment-ready with comprehensive dependency management. Ready for production deployment.