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
- **Authentication & Authorization**: Granular permissions system with custom role management, 30-day session management, detailed audit logging, and permissions controls for all application components.
- **Search & Filtering System**: Comprehensive search and filter functionality implemented across all management interfaces (Hosts, Drivers, Recipients) with real-time filtering, dynamic search bars, specialized filter options, and results summaries. TSP Contact filtering enhanced to split combined names into individual searchable options.
- **Host Contact Directory**: Integrated view toggle within host management providing individual contact person cards with search capabilities.
- **Performance**: Optimized with query optimization, LRU caching, pagination, memoization, database connection pooling, and Express gzip/brotli compression. Google Sheets synchronization runs asynchronously.
- **Messaging & Notifications**: Multi-layered communication system featuring a Gmail-style email interface, committee-specific messaging, and real-time Socket.IO chat with @mentions, autocomplete, persistent like functionality, and email notifications. Dashboard bell notifications provide timely updates.
- **Drivers Management**: Fully functional drivers management component with agreement tracking, CRUD operations, permissions, and input validation.
- **Operational Tools**: Includes a project management system, meeting management, work logs, user feedback portal, analytics dashboards with PDF/CSV report generation, and a toolkit for important documents.
- **Data Integrity**: Ensured through automated audit logging, Zod validation, and timezone-safe date handling. Critical timezone fixes implemented across all date displays to prevent date shifting issues (August 31, 2025).
- **Form Validation & Data Conversion**: Critical data type mismatches resolved with automatic conversion handling in backend schemas.
- **Collection Walkthrough Tool**: Permissions-based data entry system with a standard form and a step-by-step walkthrough, assigning collection dates to the most recent Wednesday.
- **Kudos System**: Integrated into the Gmail-style inbox with read tracking and archiving.
- **Analytics**: Comprehensive dashboard providing community impact insights including total sandwiches provided, organizations served, volunteer participation, and support opportunities with interactive visualizations. Excludes administrative accounts from analytics data.
- **User Activity Tracking**: Detailed activity analytics tab in User Management showing login times, user behavior patterns, action tracking, and usage analytics with real-time filtering.
- **Authentication UI**: Modernized login and authentication experience with enhanced landing pages, professional styling, and consistent branding.
- **Password Reset System**: Complete SendGrid-powered password reset functionality with professional email templates, secure token-based authentication, and environment-aware URL generation.
- **Distribution Tracking**: System for logging sandwich distributions from host locations to recipient organizations.
- **Recipients Focus Area Tracking**: Recipients management enhanced with focus area field (youth, veterans, seniors, families) for tracking, display, and search.
- **Streamlined Navigation**: Contact management is handled directly within each specific section (Hosts, Drivers, Recipients, Volunteers).
- **Wishlist System**: Amazon wishlist suggestion system fully implemented with database persistence, API endpoints, responsive UI, and admin review functionality.
- **Mobile Header Optimization**: Header layout optimized for tablets/iPads ensuring logout button remains accessible.
- **Comprehensive Meeting Management**: Full-featured meeting system with automated agenda compilation, intelligent project integration, and Google Sheets export. Includes task status controls and Google Sheets task status integration.
- **Project Display Consistency**: Project cards and detail views consistently display Owner and Support roles. Automatic Google Sheets synchronization triggers when support people are updated.
- **Seamless Three-System Integration**: Project owner and support people fields are consistently managed across meetings component, projects component, and Google Sheets synchronization, maintaining clear role separation and data integrity.
- **Complete Bidirectional Google Sheets Integration**: Fully implemented automatic synchronization between app and Google Sheets for both project tracker and event requests. Includes automatic 5-minute background sync service plus manual sync controls for immediate updates.
- **Milestone Display Enhancement**: Milestone badges removed from project cards, with milestone information appearing only in dedicated sections on project detail pages.
- **Enhanced Meeting Discussion Interface**: Redesigned meeting management tab with individual project actions ("Send to Agenda", "Table for Later"), compact project views, and clear, intuitive discussion fields with auto-save functionality.
- **Finalize Agenda PDF Export**: Generates professionally formatted meeting agendas with TSP branding, agenda items, and tabled projects section, including agenda status summary.
- **Event Requests Management System**: Complete event request tracking system with database schema, duplicate detection, status tracking, permissions-based access, CRUD API endpoints, responsive UI, and full Google Sheets integration with automatic 5-minute background sync plus manual sync controls. Cards feature contact tracking workflow buttons instead of edit/delete functionality for standard users, focusing on operational workflow management. Enhanced Google Sheets sync with improved duplicate detection using case-insensitive matching for organization and contact names (August 31, 2025).

## Recent Technical Fixes & Improvements

### August 31, 2025 - Timezone and Date Display Fixes
- **Critical Timezone Bug Resolution**: Fixed application-wide timezone conversion issues that were causing dates to display one day earlier than intended (e.g., showing August 26 instead of August 27).
- **Organizations Catalog Date Display**: Resolved "Not specified" event date issue by fixing API field name mismatch (`eventDate` vs `desiredEventDate`) and implementing proper timezone-safe date parsing for database timestamps.
- **Event Planning Tab**: Fixed "Invalid date" displays throughout the Event Planning component by replacing problematic date-fns format calls with timezone-safe native JavaScript date formatting.
- **Google Sheets Sync Enhancement**: Improved duplicate detection logic to prevent case-sensitive duplicates (e.g., "KERRI GARFINKLE" vs "Kerri Garfinkle") by implementing case-insensitive matching for organization names and contact names.
- **Database Field Mapping**: Corrected organizations catalog API to properly use `desiredEventDate` field from database instead of non-existent `eventDate` field.
- **Date Parsing Standardization**: Implemented consistent timezone-safe date parsing across all components using `T12:00:00` injection to prevent UTC conversion issues.

### Key Technical Learning Points
- Database timestamps in format "YYYY-MM-DD HH:MM:SS" require careful parsing to avoid timezone conversion.
- Google Sheets sync duplicate detection must account for case variations and missing email fields.
- Event requests API field mappings must align with actual database schema column names.
- Frontend date parsing should use regex pattern matching to handle different timestamp formats consistently.

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