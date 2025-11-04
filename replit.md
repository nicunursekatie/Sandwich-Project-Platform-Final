## Overview
This full-stack application for The Sandwich Project nonprofit streamlines sandwich collections, donations, and distributions. It provides comprehensive data management, analytics, and operational tools for volunteers, hosts, and recipients. The project aims to enhance data visibility, support organizational growth, and become a vital tool for food security initiatives, ultimately reducing food waste and hunger.

## User Preferences
Preferred communication style: Simple, everyday language.
UI Design: Button labels and interface text must be extremely clear about their function - avoid ambiguous labels like "Submit" in favor of specific action descriptions like "Enter New Data".
Form Design: Eliminate redundant or confusing form fields - host dialogs should have a single "Host Location Name" field instead of separate "Name" and "Host Location" fields.
Mobile UX Priority: Mobile user experience is critical - chat positioning and space efficiency are key concerns. Vehicle type should NOT be required for new driver entries.
Documentation: All technical findings and fixes must be documented in replit.md to avoid repeated searching and debugging.
AI Intake Assistant Sandwich Type Detection (Nov 3, 2025): Fixed validation rule that incorrectly suggested "Encourage Deli Meat Sandwiches" when events already had deli meat mentioned in notes fields. The validation now checks BOTH the structured `sandwichTypes` array field AND all notes fields (planningNotes, schedulingNotes, additionalRequirements, message) for mentions of turkey, ham, roast beef, chicken, or deli. This prevents false positives where sandwich type information is written in notes instead of the structured field. Location: `server/services/ai-intake-assistant/index.ts` line 228-293, `prefer_deli_meat` validation rule.
Storage Wrapper Missing Method Fix (Nov 3, 2025): Fixed "storage.getHostContact is not a function" error when deleting host contacts. Root cause: The `StorageWrapper` class (`server/storage-wrapper.ts`) was missing the `getHostContact(id)` method (singular) even though it had `getHostContacts(hostId)` (plural). The delete and update routes in `server/routes/hosts.ts` call `storage.getHostContact(id)` to verify the contact exists before deletion/update, causing a runtime error. Solution: Added the missing `getHostContact` method to StorageWrapper at line 1011-1016 with proper fallback delegation to both primaryStorage (DatabaseStorage) and fallbackStorage (MemStorage). This wrapper pattern ensures database operations work with automatic fallback to memory storage if needed. **Additional Fix**: Also fixed "logger is not defined" error when updating host contacts by adding the missing logger import (`import { logger } from '../utils/production-safe-logger';`) to `server/routes/hosts.ts` line 16.
Event Request Status Colors Vibrant Update (Nov 3, 2025): Completely revamped event request card status colors from muted/gloomy to bright and vibrant for maximum visibility. Location: `client/src/components/event-requests/constants.ts`. New colors: New=#00C9FF (bright cyan), In Process=#FF9500 (bright orange), Scheduled=#007AFF (bright blue), Completed=#34C759 (bright green), Declined=#FF3B30 (bright red). Also increased border width to 2px, added shadows, and doubled background tint opacity for better visual presence.
Analytics Philosophy: NEVER compare or rank hosts against each other. The Sandwich Project is about increasing volunteer turnout globally, not about which host reported more/less sandwiches. All host comparison features, "top performing hosts", "underperforming hosts", and similar language must be removed from analytics.
Desktop Chat UX: Desktop users require proper scrolling behavior without nested scrolling containers that cause page focus issues - chat layout must handle desktop and mobile differently.

## System Architecture
The application features a React 18 frontend with TypeScript, Vite, TanStack Query, and Tailwind CSS (with shadcn/ui). The backend uses Express.js (TypeScript), Drizzle ORM, and PostgreSQL (Neon serverless), including session-based authentication. The UI/UX adheres to The Sandwich Project's official color palette and Roboto typography, prioritizing clarity, responsiveness, and card-based dashboards.

**Key Technical Implementations & Features:**
-   **Authentication & Permissions**: Role-based access control, session management, password security, and a unified permissions system.
-   **Data Management**: Comprehensive management of collections, hosts, recipients, users, and audit logs with Zod validation and timezone-safe date handling. `sandwich_collections` table is the operational source of truth for grant metrics.
-   **Search & Filtering**: Real-time capabilities across management interfaces.
-   **Performance Optimization**: Query optimization, caching, pagination, and database connection pooling.
-   **Messaging & Notifications**: Email (SendGrid), Socket.IO chat, SMS via Twilio, and dashboard notifications.
-   **Operational Tools**: Project, meeting, and work log management, user feedback, analytics dashboards, and a permissions-based Collection Walkthrough Tool.
-   **Event Requests Management System**: Tracks requests, handles duplicate detection, manages statuses, integrates with Google Sheets, calculates van driver staffing, supports multi-recipient assignment, and performs comprehensive intake validation. Features an interactive Leaflet map with cluster/all-pins views, TSP-branded icons, color-coding by status, search/filter, and dual-layer geocoding. Includes a sophisticated AI Intake Assistant for actionable recommendations and an AI Scheduling Assistant with flexible date analysis.
-   **Google Sheets Integration**: Bidirectional automatic synchronization for project tracker and event requests.
-   **User Activity Logging System**: Comprehensive tracking of authenticated user actions via middleware.
-   **Sandwich Type Tracking System**: Comprehensive tracking for individual and group collections with real-time validation and analytics.
-   **Interactive Route Map & Driver Optimization**: Leaflet map for visualizing host contact locations, route optimization, and driver assignment.
-   **Automated Reminders**: 24-hour volunteer reminder system via cron job.
-   **Team Board**: Commenting system with real-time counts and multi-user assignment.
-   **Email System**: Uses `katie@thesandwichproject.org` as the verified SendGrid sender with table-based HTML templates.
-   **SMS Notifications**: Opt-in SMS alerts for assignment notifications, secured by Twilio signature validation.
-   **Expenses Receipt Upload**: Handles receipt uploads to Google Cloud Storage.
-   **Dashboard Annual Goal Display**: Displays the organizational annual goal of 500,000 sandwiches.
-   **Social Media Graphics**: Supports image and PDF uploads to Google Cloud Storage with optional email notifications.
-   **Progressive Web App (PWA)**: Full PWA support enabling mobile installation, offline access, and real-time updates.

## External Dependencies
-   **Database**: `@neondatabase/serverless`, `drizzle-orm`
-   **Web Framework**: `express`
-   **UI/Styling**: `@radix-ui`, `tailwindcss`, `lucide-react`, `class-variance-authority`, `shadcn/ui`
-   **Data Fetching/State**: `@tanstack/react-query`, `react-hook-form`, `zod`
-   **Email**: `@sendgrid/mail`
-   **Real-time Communication**: `socket.io`, `socket.io-client`
-   **PDF Generation**: `pdfkit`
-   **Authentication**: `connect-pg-simple`
-   **File Uploads**: `multer`
-   **Google Integration**: Google Sheets API, `@google-cloud/storage`, Google Analytics
-   **Mapping**: `leaflet`, `react-leaflet`, `react-leaflet-cluster`