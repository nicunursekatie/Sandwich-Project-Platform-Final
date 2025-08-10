# Replit.md

## Overview
This full-stack application for The Sandwich Project, a nonprofit, manages sandwich collections, donations, and distributions. It provides comprehensive data management, analytics, and operational tools for volunteers, hosts, and recipients. The project aims to streamline operations, enhance data visibility, and support the organization's growth and impact in addressing food insecurity. Its business vision is to become a vital tool for food security initiatives, with market potential in supporting volunteer-driven community projects. The ambition is to scale operations and improve outreach, ultimately contributing to a significant reduction in food waste and hunger.

## User Preferences
Preferred communication style: Simple, everyday language.
UI Design: Button labels and interface text must be extremely clear about their function - avoid ambiguous labels like "Submit" in favor of specific action descriptions like "Enter New Data".

## System Architecture

### Core Technologies
- **Frontend**: React 18 (TypeScript), Vite, TanStack Query, Tailwind CSS (with shadcn/ui), React Hook Form (with Zod).
- **Backend**: Express.js (TypeScript), Drizzle ORM, PostgreSQL (Neon serverless), Session-based authentication (connect-pg-simple), Replit Auth.

### UI/UX Decisions
The application features a consistent brand identity using The Sandwich Project's color palette (teal primary, orange secondary, burgundy accent) and Roboto typography. UI elements prioritize clarity with well-defined button labels and interface text. The design is responsive, adapting for mobile and tablet views with features like hamburger menus and compact forms. Visual hierarchy is established through card-based dashboards and clear sectioning. Form elements are enhanced with focus states and subtle hover effects for improved user interaction.

### Technical Implementations
- **Data Models**: Comprehensive management of Sandwich Collections, Hosts, Recipients, Projects, Users (with role-based access), and Audit Logs.
- **Authentication & Authorization**: Replit-based authentication with custom role management (admin, core team, host, volunteer, viewer), robust session management, and detailed audit logging.
- **Performance**: Optimized for speed with query optimization, LRU caching, pagination, memoization, and database connection pooling.
- **Messaging & Notifications**: Features a Gmail-style email system with folders, composition, and SendGrid integration. Real-time chat is powered by Socket.IO, supporting distinct channels, real-time broadcasting, @mentions with autocomplete, email notifications for mentions, and unread message notifications. Dashboard bell notifications and email alerts provide timely updates.
- **Operational Tools**: Includes a project management system for tracking tasks and progress, meeting management for scheduling and minutes, and a comprehensive directory for contacts. Work logs, a user feedback portal, and analytics dashboards with PDF/CSV report generation are also integrated. A toolkit provides organized access to important documents.
- **Data Integrity**: Ensured through automated audit logging, Zod validation for all data inputs, and systems for correcting suspicious entries.

### Feature Specifications
- **Real-time Chat**: Supports distinct channels (General, Core Team, Committee, Host, Driver, Recipient), real-time message broadcasting, edit/delete functionality, and @mentions with email notifications.
- **Collection Walkthrough Tool**: Provides a permissions-based data entry system with a standard form and a step-by-step walkthrough for different user needs.
- **Kudos System**: Integrated into the Gmail-style inbox with read tracking and archiving capabilities.
- **Analytics**: Comprehensive dashboard providing community impact insights including total sandwiches provided, organizations served, volunteer participation, and support opportunities with interactive visualizations. Features key metrics, user activity tracking, and comprehensive filtering to exclude administrative accounts from analytics data.
- **User Roles**: Includes "Core Team" role with elevated permissions for trusted operational team members.
- **Authentication UI**: Modernized login and authentication experience with enhanced landing pages, professional styling, and consistent branding.
- **Password Reset System**: Complete SendGrid-powered password reset functionality with professional email templates, secure token-based authentication, and environment-aware URL generation for both development and production deployments.

## External Dependencies
- **Database**: `@neondatabase/serverless`, `drizzle-orm`
- **Web Framework**: `express`
- **UI/Styling**: `@radix-ui`, `tailwindcss`, `lucide-react`, `class-variance-authority`, `shadcn/ui`
- **Data Fetching/State**: `@tanstack/react-query`, `react-hook-form`, `zod`
- **Email**: `@sendgrid/mail`
- **Real-time Communication**: `socket.io`, `socket.io-client`
- **PDF Generation**: `pdfkit`
- **Authentication**: `connect-pg-simple` (for session storage), SendGrid (for password reset emails)
- **File Uploads**: `multer`
- **Google Integration**: Google Sheets API
- **Analytics**: Google Analytics (G-9M4XDZGN68)