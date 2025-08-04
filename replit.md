# Replit.md

## Overview
This is a full-stack sandwich collection management application designed for The Sandwich Project, a nonprofit organization. It facilitates tracking sandwich donations and distributions, offering comprehensive data management, analytics, and operational tools for volunteers, hosts, recipients, and collection activities. The vision is to streamline operations, enhance data visibility, and support the organization's growth and impact in addressing food insecurity.

## Recent Critical Fixes (August 2025)
- **Gmail-Style Inbox Layout Fix**: COMPLETED (August 4, 2025) - Resolved persistent inbox height issue where email interface was cutting off halfway down the screen. Fixed by creating dedicated full-height layout handling for the Gmail-style inbox that bypasses normal dashboard padding constraints, using `h-full` instead of viewport calculations, and removing all padding around inbox content. Inbox now properly fills entire browser window from sidebar to right edge and top to bottom.
- **Broken Reports Feature Removal**: COMPLETED (August 4, 2025) - Completely eliminated broken weekly reports functionality that was causing quality issues and user frustration. Removed reports button from navigation menu, dashboard routing cases, unused imports, and all related broken functionality. Platform now only shows working features in clean navigation interface.
- **Community-Focused Reporting System**: COMPLETED - Completely rebuilt report generation system to focus on community impact rather than performance metrics. New structure includes: 1) Community Impact Overview (total sandwiches provided, recipient organizations served, geographic areas reached, milestone achievements), 2) Collective Achievements (volunteer participation, new areas activated, special event successes, capacity growth), 3) Operational Health (coverage consistency, resource needs identification), 4) Support Opportunities (areas needing volunteers, buddy system candidates, expansion-ready neighborhoods), and 5) Celebration & Stories (milestone moments, volunteer spotlights, recipient feedback, community connections). Reports now emphasize support and collaboration rather than competition or blame.
- **PDF Generation Infrastructure Recovery**: COMPLETED - Fixed major corruption in report generation system caused by thousands of lines of duplicate/corrupted PDF code. Resolved TypeScript errors including wrong method names (getHosts→getAllHosts, getProjects→getAllProjects), variable naming conflicts (format function vs format variable), and missing parameters. Eliminated all LSP diagnostics and restored server stability. PDF generation now produces properly-sized files (74KB vs previous 37-byte empty files) with complete community-focused data structure. CRITICAL FIX (August 2025): Resolved "require is not defined" error by converting PDFKit import from require() to dynamic import() for ES modules compatibility. Fixed automatic fallback to CSV that was masking PDF generation failures.
- **Inventory Calculator Accessibility**: COMPLETED - Made inventory calculator easily accessible throughout the platform with multiple access points: added as first item in dashboard Quick Actions grid with prominent orange styling and calculator icon, integrated into main navigation menu in Core section between Collections and Messages, and enhanced toolkit to support external web tools alongside documents. Calculator opens in new tab from all locations.
- **Operational Capacity Indicators**: COMPLETED - Enhanced dashboard with branded capacity metrics using clean design with colored text/numbers, 1px brand-colored borders, darker #646464 text for authority, and 4px colored left border accents. Removed background fills in favor of subtle shadow hover effects for professional appearance.
- **2 Million Milestone Achievement**: COMPLETED (August 2025) - Successfully reached and surpassed the 2 million sandwich milestone. Database shows 2,050,628 total sandwiches (already includes 100K padding for missing historical logs). Updated analytics dashboard to celebrate this historic achievement instead of showing it as a future goal. Fixed double-padding issue where frontend was incorrectly adding extra 100K to database total.
- **Authentication UI Modernization**: COMPLETED - Completely modernized login and authentication experience with clean, modern design elements. Enhanced landing page with gradient backgrounds, glass-morphism cards, and smooth hover animations (scale, shadow, color transitions). Updated Replit Auth error pages with professional styling, proper typography, and interactive buttons. Added kudos permissions to user management dialog with new "Recognition & Kudos" category. Fixed notification count display from "000" to proper integers by converting database string results to numbers. All authentication-related pages now feature consistent TSP branding and modern hover effects.
- **Group Entry UX Fix**: COMPLETED - Fixed major usability nightmare in both collection forms where users had to click tiny plus buttons to save group entries. Replaced with clear "Add This Group" buttons, added validation to prevent form submission with unsaved group data, and implemented helpful warning messages. Both walkthrough and standard forms now prevent users from accidentally losing group data by requiring explicit saving before advancing/submitting.
- **Collection Walkthrough Tool**: COMPLETED - Built permissions-based collection data entry system with two modes: standard form for experienced users and step-by-step walkthrough for less tech-savvy volunteers. Added `USE_COLLECTION_WALKTHROUGH` permission assigned to Host, Volunteer, and Recipient roles. Walkthrough auto-calculates collection dates to nearest Thursday, guides users through questions one-by-one, and tracks submission method in database. Users without walkthrough permission see only standard form, while authorized users can choose between both methods. Fixed "Plus is not defined" error by adding missing Plus icon import from lucide-react.
- **Kudos System Integration**: FULLY RESOLVED - Fixed critical kudos visibility issues by integrating kudos directly into Gmail-style inbox with prominent yellow/orange highlight section at top. Resolved empty recipient ID validation errors in SendKudosButton for both project cards and task completion. Added proper read tracking with messageRecipients table integration and automatic mark-as-read functionality. Fixed database query column name from `createdAt` to `sentAt`. CRITICAL FIX: Resolved kudos read status and archiving errors by fixing ES6 import syntax in email routes and implementing proper kudo-to-message ID mapping. The system now correctly handles when frontend passes kudo IDs instead of message IDs, validates recipient authorization, and marks corresponding messages as read in the messageRecipients table. Authentication and API endpoints confirmed working properly.
- **Email Read Status Bug**: Fixed critical issue where senders viewing sent messages incorrectly marked emails as read for recipients. Now only recipients can change read status.
- **UI Component Transparency**: Resolved widespread black element issues in Select, Input, Button, Checkbox, and Textarea components by removing problematic CSS variable dependencies.
- **Message Composer**: Fixed user dropdown population in message composer after UI component fixes.
- **Collapsible Navigation**: Implemented collapsible sidebar that shrinks to icon-only view while remaining visually present and easily expandable. Includes smooth transitions and tooltip support for collapsed state.
- **Project Management UX**: Enhanced project edit dialogs with comprehensive forms, improved email display for assignees, repositioned completion checkbox to left of project title with clear visual states (empty checkbox for incomplete, filled checkmark for completed), and changed "Custom assignment" to "External volunteer" for better clarity.
- **Google Analytics Integration**: Implemented comprehensive tracking with both HTML and dynamic script loading, configured with measurement ID G-9M4XDZGN68, excludes development accounts from analytics data.
- **Phone Directory Dark Mode**: Fixed all hardcoded inline styles with proper Tailwind dark mode classes for better contrast and readability.

## User Preferences
Preferred communication style: Simple, everyday language.
UI Design: Button labels and interface text must be extremely clear about their function - avoid ambiguous labels like "Submit" in favor of specific action descriptions like "Enter New Data".

## Recent Critical Fixes (August 2025 - Continued)
- **Core Team User Classification**: COMPLETED - Added new "Core Team" user role with comprehensive permissions including: create collections, access general/core team/host chat, direct messages, full directory editing (hosts/recipients/drivers), analytics, reports, suggestions management, and complete kudos system access. This role provides elevated permissions between regular volunteers and committee members, designed for trusted team members who need broader operational access.
- **Weekly Impact Report System**: COMPLETED - Implemented sophisticated weekly impact report generation system with comprehensive analysis capabilities. Features include: executive summary with key metrics, comparative metrics table, location performance analysis with status categorization (high performers, needs attention, steady contributors), trends and insights analysis, next week preparation data, and success celebration sections. Reports can be generated for any week and downloaded as PDFs. Integrated as fourth tab in reporting dashboard.
- **Mobile/Tablet Responsive Design Improvements**: COMPLETED - Enhanced mobile and tablet responsive design across weekly impact reports and reporting dashboard. Improvements include: responsive grid layouts that adapt from 1 column on mobile to 4 columns on desktop, flexible button layouts that stack vertically on small screens, improved typography scaling, touch-friendly tab navigation, optimized table scrolling with minimum widths, and better card layouts with appropriate padding for different screen sizes.

## System Architecture

### Core Technologies
- **Frontend**: React 18 (TypeScript), Vite, TanStack Query, Tailwind CSS (with shadcn/ui), React Hook Form (with Zod).
- **Backend**: Express.js (TypeScript), Drizzle ORM, PostgreSQL (Neon serverless), Session-based authentication (connect-pg-simple), Replit Auth.

### Key Features
- **Data Models**: Manages Sandwich Collections, Hosts, Recipients, Projects, Users (role-based), and Audit Logs.
- **Authentication & Authorization**: Replit-based auth with custom role management (admin, coordinator, volunteer, viewer), session management, and audit logging.
- **UI/UX**: Consistent brand styling using TSP color palette (teal primary, orange secondary, burgundy accent), Roboto typography, clear button labels, responsive layouts with mobile optimizations (e.g., hamburger menu, compact forms), and professional visual hierarchy (e.g., card-based dashboards, clear sectioning). Form elements include enhanced styling for inputs, selects, and buttons with focus states and subtle hover effects.
- **Performance**: Query optimization, LRU caching, pagination, memoization, and database connection pooling.
- **Messaging & Notifications**:
    - **Email System**: Gmail-style inbox with folders, composition, threaded conversations, bulk actions, and SendGrid integration for notifications.
    - **Real-time Chat**: Socket.IO-based chat with persistent storage (PostgreSQL), distinct channels (General, Core Team, Committee, Host, Driver, Recipient), real-time message broadcasting, edit/delete functionality, and unread count notifications.
    - **Notifications**: Real-time bell notifications in dashboard header, email alerts for new suggestions, and congratulations for project/task completion.
- **Operational Tools**:
    - **Project Management**: Project creation, editing, deletion, multi-user assignment, task tracking with completion kudos system, and dynamic progress calculation.
    - **Meeting Management**: Scheduling, agenda tracking, minutes management with file attachments, and 12-hour time formatting.
    - **Directory**: Comprehensive management for Hosts, Recipients, and Drivers with search, filtering, and detailed profiles.
    - **Work Logs**: Track work hours with administrative oversight and user-specific visibility.
    - **Suggestions Portal**: Two-way communication platform for user feedback with workflow management (status tracking, admin responses) and email notifications.
    - **Analytics & Reporting**: Dashboard overview with key metrics (sandwiches delivered, peak performance), user activity tracking, and PDF/CSV report generation.
    - **Toolkit**: Organized repository of documents (safety guidelines, labels, guides) with modal preview and download functionality.
- **Data Integrity**: Automated audit logging, Zod validation for data input, and data correction systems for suspicious entries.

## External Dependencies
- **Database**: `@neondatabase/serverless`, `drizzle-orm`
- **Web Framework**: `express`
- **UI/Styling**: `@radix-ui`, `tailwindcss`, `lucide-react`, `class-variance-authority`, `shadcn/ui`
- **Data Fetching/State**: `@tanstack/react-query`, `react-hook-form`, `zod`
- **Email**: `@sendgrid/mail`
- **Real-time Communication**: `socket.io`, `socket.io-client`
- **PDF Generation**: `pdfkit` (server-side)
- **Authentication**: `connect-pg-simple` (for session storage)
- **File Uploads**: `multer`
- **Google Integration**: Google Sheets API (for data viewing, with fallback to static files)