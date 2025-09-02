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
The application features a consistent brand identity using The Sandwich Project's official color palette:
- **Teal Primary**: #236383 (main brand color)
- **Orange Secondary**: #FBAD3F (secondary brand color)
- **Burgundy Accent**: #A31C41 (accent color, used for warnings/postponed events)
- **Teal Muted**: #007E8C (supporting color)
Typography uses Roboto font family. UI elements prioritize clarity with well-defined button labels and interface text. The design is responsive, adapting for mobile and tablet views with features like hamburger menus and compact forms. Visual hierarchy is established through card-based dashboards and clear sectioning. Form elements are enhanced with focus states and subtle hover effects for improved user interaction.

### Technical Implementations
- **Data Models**: Comprehensive management of Sandwich Collections, Hosts, Recipients, Projects, Users (with role-based access), and Audit Logs.
- **Authentication & Authorization**: Granular permissions system with custom role management, 30-day session management, detailed audit logging, and permissions controls for all application components. Includes a SendGrid-powered password reset system.
- **Search & Filtering System**: Comprehensive search and filter functionality implemented across all management interfaces (Hosts, Drivers, Recipients) with real-time filtering, dynamic search bars, specialized filter options, and results summaries.
- **Host Contact Directory**: Integrated view toggle within host management providing individual contact person cards with search capabilities.
- **Performance**: Optimized with query optimization, LRU caching, pagination, memoization, database connection pooling, and Express gzip/brotli compression.
- **Messaging & Notifications**: Multi-layered communication system featuring a Gmail-style email interface, committee-specific messaging, and real-time Socket.IO chat with @mentions, autocomplete, persistent like functionality, and email notifications. Dashboard bell notifications provide timely updates. Includes a Kudos System.
- **Drivers Management**: Fully functional drivers management component with agreement tracking, CRUD operations, permissions, and input validation.
- **Operational Tools**: Includes a project management system, meeting management, work logs, user feedback portal, analytics dashboards with PDF/CSV report generation, and a toolkit for important documents.
- **Data Integrity**: Ensured through automated audit logging, Zod validation, and comprehensive timezone-safe date handling throughout meeting management and event import systems. All date parsing functions now use local date construction to prevent timezone shifts that could cause dates to display incorrectly (e.g., preventing 9/9 from showing as 9/8).
- **Collection Walkthrough Tool**: Permissions-based data entry system with a standard form and a step-by-step walkthrough, assigning collection dates to the most recent Wednesday.
- **Analytics**: Comprehensive dashboard providing community impact insights including total sandwiches provided, organizations served, volunteer participation, and support opportunities with interactive visualizations, excluding administrative accounts.
- **User Activity Tracking**: Detailed activity analytics tab in User Management showing login times, user behavior patterns, action tracking, and usage analytics with real-time filtering.
- **Authentication UI**: Modernized login and authentication experience with enhanced landing pages, professional styling, and consistent branding.
- **Distribution Tracking**: System for logging sandwich distributions from host locations to recipient organizations.
- **Recipients Focus Area Tracking**: Recipients management enhanced with focus area field (youth, veterans, seniors, families) for tracking, display, and search.
- **Streamlined Navigation**: Contact management is handled directly within each specific section (Hosts, Drivers, Recipients, Volunteers).
- **Wishlist System**: Amazon wishlist suggestion system fully implemented with database persistence, API endpoints, responsive UI, and admin review functionality.
- **Mobile Header Optimization**: Header layout optimized for tablets/iPads ensuring logout button remains accessible.
- **Comprehensive Meeting Management**: Full-featured meeting system with automated agenda compilation, intelligent project integration, Google Sheets export, and task status controls. Includes enhanced discussion interface and PDF export for agendas.
- **Project Display Consistency**: Project cards and detail views consistently display Owner and Support roles.
- **Seamless Three-System Integration**: Project owner and support people fields are consistently managed across meetings, projects, and Google Sheets synchronization, maintaining clear role separation and data integrity.
- **Complete Bidirectional Google Sheets Integration**: Fully implemented automatic synchronization between app and Google Sheets for both project tracker and event requests, with background and manual sync controls.
- **Milestone Display Enhancement**: Milestone information appears only in dedicated sections on project detail pages.
- **Event Requests Management System**: Complete event request tracking system with database schema, duplicate detection, status tracking, permissions-based access, CRUD API endpoints, responsive UI, and full Google Sheets integration. Cards feature contact tracking workflow buttons.
- **Meeting Agenda Interface Enhancements**: Enhanced meeting agenda planning with visual improvements including alternating row backgrounds for easier scanning, improved action buttons with state indicators, progress tracking, floating action panel, and organized section headers. Features responsive design with proper badge wrapping and button layout optimization for all screen sizes.
- **Task Creation from Meeting Notes**: Implemented functionality to automatically convert meeting discussion notes and decision items into actionable project tasks via the "Create Tasks from Notes" button, with appropriate priority levels and due dates.
- **Meeting PDF Generation Debugging**: Enhanced PDF generation system with comprehensive error handling, detailed logging for troubleshooting permission issues, and improved user feedback for successful agenda exports.
- **Organization EIN Display**: Added prominent EIN (87-0939484) display in sidebar navigation and Important Documents page for easy access and tracking.

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