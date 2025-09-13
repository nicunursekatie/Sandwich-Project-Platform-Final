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
- **Teal Primary**: #236383
- **Orange Secondary**: #FBAD3F
- **Burgundy Accent**: #A31C41
- **Teal Muted**: #007E8C
Typography uses Roboto font family. UI elements prioritize clarity, responsiveness, and visual hierarchy with card-based dashboards and clear sectioning.

### Technical Implementations
- **Data Management**: Comprehensive management of Sandwich Collections, Hosts, Recipients, Projects, Users (with role-based access), and Audit Logs. Includes Zod validation and timezone-safe date handling.
- **Authentication & Authorization**: Granular permissions system with custom role management, 30-day session management, detailed audit logging, and SendGrid-powered password reset.
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