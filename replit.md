# Replit.md

## Overview
This full-stack application for The Sandwich Project, a nonprofit, manages sandwich collections, donations, and distributions. It provides comprehensive data management, analytics, and operational tools for volunteers, hosts, and recipients. The project aims to streamline operations, enhance data visibility, and support the organization's growth and impact in addressing food insecurity. Its business vision is to become a vital tool for food security initiatives, with market potential in supporting volunteer-driven community projects. The ambition is to scale operations and improve outreach, ultimately contributing to a significant reduction in food waste and hunger.

## User Preferences
Preferred communication style: Simple, everyday language.
UI Design: Button labels and interface text must be extremely clear about their function - avoid ambiguous labels like "Submit" in favor of specific action descriptions like "Enter New Data".
Form Design: Eliminate redundant or confusing form fields - host dialogs should have a single "Host Location Name" field instead of separate "Name" and "Host Location" fields.
Mobile UX Priority: Mobile user experience is critical - chat positioning and space efficiency are key concerns. Vehicle type should NOT be required for new driver entries.
Documentation: All technical findings and fixes must be documented in replit.md to avoid repeated searching and debugging.

## System Architecture

### Core Technologies
- **Frontend**: React 18 (TypeScript), Vite, TanStack Query, Tailwind CSS (with shadcn/ui), React Hook Form (with Zod).
- **Backend**: Express.js (TypeScript), Drizzle ORM, PostgreSQL (Neon serverless), Session-based authentication (connect-pg-simple), Replit Auth.

### UI/UX Decisions
The application features a consistent brand identity using The Sandwich Project's color palette (teal primary, orange secondary, burgundy accent) and Roboto typography. UI elements prioritize clarity with well-defined button labels and interface text. The design is responsive, adapting for mobile and tablet views with features like hamburger menus and compact forms. Visual hierarchy is established through card-based dashboards and clear sectioning. Form elements are enhanced with focus states and subtle hover effects for improved user interaction.

### Technical Implementations
- **Data Models**: Comprehensive management of Sandwich Collections, Hosts, Recipients, Projects, Users (with role-based access), and Audit Logs.
- **Authentication & Authorization**: Comprehensive granular permissions system with custom role management (admin, core team, host, volunteer, viewer), robust 30-day session management, detailed audit logging, and permissions controls for ALL app components accessible through the edit permissions dialog.
- **Performance**: Optimized for speed with query optimization, LRU caching, pagination, memoization, database connection pooling, and Express gzip/brotli compression with 85%+ compression ratios for JS/CSS/JSON/HTML files while preserving caching headers.
- **Messaging & Notifications**: Multi-layered communication system featuring a Gmail-style email interface (EmailStyleMessaging), committee-specific messaging (CommitteeChat), and real-time Socket.IO chat (SocketChatHub/SimpleChat) with @mentions, autocomplete dropdown, persistent like functionality, and email notifications. SendGrid integration powers email alerts and mention notifications. Dashboard bell notifications provide timely updates.
- **Operational Tools**: Includes a project management system for tracking tasks and progress, meeting management for scheduling and minutes, and a comprehensive directory for contacts. Work logs, a user feedback portal, and analytics dashboards with PDF/CSV report generation are also integrated. A toolkit provides organized access to important documents.
- **Data Integrity**: Ensured through automated audit logging, Zod validation for all data inputs, and systems for correcting suspicious entries.
- **Form Validation & Data Conversion**: Critical data type mismatches resolved with automatic conversion handling in backend schemas. Recipients form converts estimatedSandwiches (string→number/null) and contractSignedDate (string→Date/null). Website fields changed from type="url" to type="text" for flexibility. Driver vehicle type is optional (not required).

### Feature Specifications
- **Real-time Chat**: Socket.IO-powered system with SocketChatHub and SimpleChat components, supporting distinct channels (General, Core Team, Committee, Host, Driver, Recipient), real-time message broadcasting, persistent like functionality with visual indicators, and @mentions with autocomplete dropdown and email notifications.
- **Collection Walkthrough Tool**: Provides a permissions-based data entry system with a standard form and a step-by-step walkthrough for different user needs.
- **Kudos System**: Integrated into the Gmail-style inbox with read tracking and archiving capabilities.
- **Analytics**: Comprehensive dashboard providing community impact insights including total sandwiches provided, organizations served, volunteer participation, and support opportunities with interactive visualizations. Features key metrics, user activity tracking, and comprehensive filtering to exclude administrative accounts from analytics data.
- **User Roles**: Includes "Core Team" role with elevated permissions for trusted operational team members.
- **Authentication UI**: Modernized login and authentication experience with enhanced landing pages, professional styling, and consistent branding.
- **Password Reset System**: Complete SendGrid-powered password reset functionality with professional email templates, secure token-based authentication, and environment-aware URL generation for both development and production deployments.
- **Donation Tracking**: System for logging sandwich distributions from host locations to recipient organizations, renamed from "Route Tracking" to better reflect functionality.
- **Streamlined Navigation**: Directory functionality completely removed from navigation and permissions system as requested, with contact management now handled directly within each specific section (Hosts, Drivers, Recipients, Volunteers).
- **Complete Permissions Coverage**: All application components now have proper permissions controls, including Weekly Monitoring, Events, SignUp Genius, Development tools, Work Logs, and Toolkit, all accessible through the enhanced permissions dialog with categorized permission management.

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

## Recent Technical Fixes & Architecture Details

### Form Data Type Conversion Issues (Aug 2025)
**Problem**: HTML forms send all data as strings, causing 400 errors when backend expects numbers/dates.
**Solution**: Enhanced `insertRecipientSchema` in `shared/schema.ts` with automatic type conversion:
- `estimatedSandwiches`: String→Number/null conversion with `z.union([z.string().transform(...), z.number(), z.null()])`  
- `contractSignedDate`: String→Date/null conversion with similar union pattern
- Changed website fields from `type="url"` to `type="text"` for validation flexibility

**Files Affected**: 
- `shared/schema.ts` (lines 672-688): Enhanced recipient schema with data conversion
- `client/src/components/recipients-management.tsx`: Form submission with type conversion
- `client/src/components/drivers-management.tsx` (line 851): Vehicle type made optional

### Mobile Chat Positioning (Aug 2025)
**Problem**: Chat loading too far down screen on mobile devices
**Solution**: Fixed using proper viewport calculations `h-[calc(100vh-140px)]` for mobile-optimized positioning
**Files Affected**: `client/src/components/socket-chat-hub.tsx`

### Driver Management Form Validation (Aug 2025)
**Database Schema**: `drivers.vehicleType: text("vehicle_type")` - nullable field (no `.notNull()` constraint)
**Frontend**: Removed asterisk from "Vehicle Type *" label and updated placeholder to indicate optional field
**Validation**: Backend `insertDriverSchema` requires no custom validation - basic schema supports nullable vehicle types
**Critical Fix**: Removed `!newDriver.vehicleType` from `handleAdd` validation (line 285) - was causing "Please fill in required fields" error despite vehicle type being optional
**New Driver Form Enhancement**: Added missing agreement status, van approval, and active/inactive status fields to "Add New Driver" dialog (lines 932-972) with proper state management and form reset functionality
**Agreement Status System Refactored (Aug 2025)**: Completely refactored agreement status system to use dedicated `emailAgreementSent` boolean field instead of complex notes parsing. Removed `updateAgreementMutation`, `updateAgreementInNotes` functions, and `hasSignedAgreement(notes)` parsing. Agreement status now managed through simple dropdown in edit modal that updates the boolean field directly, with signed agreement badges displayed on driver cards based on `driver.emailAgreementSent` value.

**Add New Driver Form Enhancement (Aug 2025)**: Enhanced Add New Driver dialog to include missing fields for form consistency with Edit Driver dialog:
- Added `availabilityNotes` field to new driver form with proper state management
- Fixed `agreementSigned` → `emailAgreementSent` field naming for consistency with refactored agreement system
- Updated `newDriver` state initialization to include all necessary fields
- System is fully functional - users can successfully add/edit drivers with agreement status updates working correctly
- **CRITICAL FIX**: Fixed agreement status persistence issue where users had to update 2-3 times - was caused by Select value reading from old `hasSignedAgreement(editingDriver)` function while onChange updated `emailAgreementSent` field, creating UI/data mismatch
- **Agreement Status Bug Fixed (Aug 2025)**: Resolved issue where new drivers created with "Agreement Signed" selected would still show "Missing Agreement" badge. Problem was handleAdd function incorrectly mapping `newDriver.agreementSigned` instead of using `newDriver.emailAgreementSent` directly. Agreement status now saves and displays correctly for new drivers.
- **Availability Field Corrected (Aug 2025)**: Removed dropdown availability status field from forms. Only using availabilityNotes as free text field for scheduling details like "M-F after 3" as intended. Driver cards display availabilityNotes content when present.

### Key Component Locations
- **Driver Forms**: `client/src/components/drivers-management.tsx`, `client/src/components/drivers/driver-form.tsx`
- **Recipient Forms**: `client/src/components/recipients-management.tsx` 
- **Chat Components**: `client/src/components/socket-chat-hub.tsx`, `client/src/components/simple-chat.tsx`
- **Schema Definitions**: `shared/schema.ts` (all database models and validation schemas)
- **Backend Routes**: `server/routes.ts` (API endpoints with schema validation)

### Common Debugging Patterns
1. **Form Validation Errors**: Check schema in `shared/schema.ts`, look for data type mismatches (string vs number/date)
2. **Field Requirements**: Database nullable fields don't require frontend validation - remove asterisks from labels
3. **Mobile Issues**: Use viewport calculations for positioning, prioritize vertical space efficiency
4. **Data Conversion**: Use Zod union types with transform functions for automatic type conversion