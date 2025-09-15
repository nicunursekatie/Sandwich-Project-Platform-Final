---
description: Repository Information Overview
alwaysApply: true
---

# Repository Information Overview

## Repository Summary
The Sandwich Project Platform is a full-stack application for a nonprofit organization that manages sandwich collections, donations, and distributions. It provides comprehensive data management, analytics, and operational tools for volunteers, hosts, and recipients. The platform aims to streamline operations, enhance data visibility, and support the organization's growth and impact in addressing food insecurity.

## Repository Structure
- **client/**: React frontend application with TypeScript
- **server/**: Express.js backend with TypeScript
- **shared/**: Shared types, schemas, and utilities
- **migrations/**: Database migration files for Drizzle ORM
- **public/**: Static assets and public files
- **tests/**: Test files for backend and integration tests
- **__tests__/**: Additional test files for routes
- **__checks__/**: Checkly monitoring tests

### Main Repository Components
- **Frontend Application**: React-based UI with shadcn/ui components
- **Backend API**: Express.js server with modular route structure
- **Database Layer**: PostgreSQL with Drizzle ORM
- **Authentication System**: Session-based auth with connect-pg-simple
- **Real-time Communication**: Socket.IO for chat and notifications
- **Document Management**: File storage and document handling
- **Analytics Dashboard**: Reporting and data visualization

## Projects

### Frontend Application (React)
**Configuration File**: client/package.json (inferred from main package.json)

#### Language & Runtime
**Language**: TypeScript
**Version**: TypeScript 5.6.3
**Build System**: Vite 5.4.20
**Package Manager**: npm/yarn

#### Dependencies
**Main Dependencies**:
- React 18.3.1
- TanStack Query 5.60.5
- Radix UI components
- Tailwind CSS 3.4.17
- Lucide React 0.453.0
- React Hook Form 7.55.0
- Zod 3.24.2

#### Build & Installation
```bash
npm install
npm run build
```

#### Testing
**Framework**: Jest 30.1.3
**Test Location**: __tests__/ directory
**Run Command**:
```bash
npm test
```

### Backend Application (Express)
**Configuration File**: server/index.ts

#### Language & Runtime
**Language**: TypeScript
**Version**: TypeScript 5.6.3
**Build System**: esbuild
**Package Manager**: npm/yarn

#### Dependencies
**Main Dependencies**:
- Express 4.21.2
- Drizzle ORM 0.44.5
- @neondatabase/serverless 0.10.4
- Socket.IO 4.8.1
- @sendgrid/mail 8.1.5
- Winston 3.17.0
- Multer 2.0.1

#### Build & Installation
```bash
npm install
npm run build
```

#### Testing
**Framework**: Jest 30.1.3
**Test Location**: tests/ directory
**Run Command**:
```bash
npm test
npm run test:integration
```

### Database Layer
**Configuration File**: drizzle.config.ts

#### Language & Runtime
**Type**: PostgreSQL (Neon serverless)
**ORM**: Drizzle ORM 0.44.5

#### Key Resources
**Main Files**:
- shared/schema.ts: Database schema definitions
- migrations/: Database migration files
- server/db.ts: Database connection setup

#### Usage & Operations
```bash
npm run db:push # Push schema changes to database
```

### Authentication System
**Configuration File**: server/middleware/auth.ts

#### Language & Runtime
**Type**: Session-based authentication
**Libraries**: connect-pg-simple, express-session

#### Key Resources
**Main Files**:
- server/routes/auth.ts: Authentication routes
- server/routes/users/: User management
- shared/auth-utils.ts: Authentication utilities

### Real-time Communication
**Configuration File**: server/socket-chat.ts

#### Language & Runtime
**Type**: WebSocket-based real-time communication
**Libraries**: Socket.IO 4.8.1

#### Key Resources
**Main Files**:
- server/socket-chat.ts: Socket.IO server setup
- client/src/hooks/useSocketChat.ts: Client-side Socket.IO hooks
- client/src/components/socket-chat-hub.tsx: Chat UI components

### Document Management
**Configuration File**: server/storage.ts

#### Language & Runtime
**Type**: File storage system
**Libraries**: @google-cloud/storage 7.7.0, Multer 2.0.1

#### Key Resources
**Main Files**:
- server/objectStorage.ts: Object storage implementation
- server/routes/storage/: Storage routes
- client/src/components/DocumentViewer.tsx: Document viewing components

### Analytics Dashboard
**Configuration File**: server/reporting/report-generator.ts

#### Language & Runtime
**Type**: Data visualization and reporting
**Libraries**: Recharts 2.15.2, pdfkit 0.17.1

#### Key Resources
**Main Files**:
- server/reporting/: Report generation logic
- client/src/components/analytics-dashboard.tsx: Analytics UI
- client/src/pages/impact-dashboard.tsx: Impact metrics dashboard