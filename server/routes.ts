import type { Express } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { z } from "zod";
import { eq, and, or, sql, desc, isNull, isNotNull, ne, inArray, not } from "drizzle-orm";
import express from "express";
import session from "express-session";
import connectPg from "connect-pg-simple";
import multer from "multer";
import { parse } from "csv-parse/sync";
import fs from "fs/promises";
import { createReadStream } from "fs";
import path from "path";
import mammoth from "mammoth";
import { storage } from "./storage-wrapper";
// import { sendDriverAgreementNotification } from "./sendgrid"; // Removed for now
import { registerMessageNotificationRoutes } from "./routes/message-notifications";
import googleSheetsRoutes from "./routes/google-sheets";
import suggestionsRoutes from "./suggestions-routes";
import realTimeMessagesRoutes from "./routes/real-time-messages";
import chatRoutes from "./routes/chat-simple";
import emailRoutes from "./routes/email-routes";
import shoutoutRoutes from "./routes/shoutouts";
import { createUserActivityRoutes } from "./routes/user-activity";
import { createEnhancedUserActivityRoutes } from "./routes/enhanced-user-activity";
import { createActivityLogRoutes } from "./routes/activity-log";
import { createErrorLogsRoutes } from "./routes/error-logs";

// import { generalRateLimit, strictRateLimit, uploadRateLimit, clearRateLimit } from "./middleware/rateLimiter";
import { sanitizeMiddleware } from "./middleware/sanitizer";
import { requestLogger, errorLogger, logger } from "./middleware/logger";
import { createActivityLogger } from "./middleware/activity-logger";
import {
  insertProjectSchema,
  insertProjectTaskSchema,
  insertProjectCommentSchema,
  insertTaskCompletionSchema,
  insertMessageSchema,
  insertWeeklyReportSchema,
  insertSandwichCollectionSchema,
  insertMeetingMinutesSchema,
  insertAgendaItemSchema,
  insertMeetingSchema,
  insertDriverAgreementSchema,
  insertDriverSchema,
  insertVolunteerSchema,
  insertHostSchema,
  insertHostContactSchema,
  insertRecipientSchema,
  insertContactSchema,
  insertAnnouncementSchema,
  insertDocumentSchema,
  insertDocumentPermissionSchema,
  insertDocumentAccessLogSchema,
  insertEventRequestSchema,
  insertOrganizationSchema,
  drivers,
  volunteers,
  projectTasks,
  taskCompletions,
  conversations,
  conversationParticipants,
  messages as messagesTable,
  emailMessages,
  users,
  wishlistSuggestions,
  documents,
  documentPermissions,
  documentAccessLogs,
} from "@shared/schema";

import { getDefaultPermissionsForRole, hasPermission, hasAccessToChat } from "@shared/auth-utils";

// Extend Request interface to include file metadata
declare global {
  namespace Express {
    interface Request {
      fileMetadata?: {
        fileName: string;
        filePath: string;
        fileType: string;
        mimeType: string;
      };
    }
  }
}
import dataManagementRoutes from "./routes/data-management";
import recipientTspContactRoutes from "./routes/recipient-tsp-contacts";
import eventRequestRoutes from "./routes/event-requests";
import importEventsRoutes from "./routes/import-events";
import { checkWeeklySubmissions, sendMissingSubmissionsEmail, runWeeklyMonitoring } from "./weekly-monitoring";
import { registerPerformanceRoutes } from "./routes/performance";
import { SearchEngine } from "./search-engine";
import { CacheManager } from "./performance/cache-manager";
import { ReportGenerator } from "./reporting/report-generator";
import { WeeklyImpactReportGenerator } from "./reporting/weekly-impact-report";
import { EmailService } from "./notifications/email-service";
import { VersionControl } from "./middleware/version-control";
import { BackupManager } from "./operations/backup-manager";
import { QueryOptimizer } from "./performance/query-optimizer";
import { db } from "./db";
import { StreamChat } from "stream-chat";
import { requirePermission, requireOwnershipPermission } from "./middleware/auth";
import { AuditLogger } from "./audit-logger";


// Configure multer for file uploads
const upload = multer({
  dest: "uploads/",
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    if (file.mimetype === "text/csv" || file.originalname.endsWith(".csv")) {
      cb(null, true);
    } else {
      cb(new Error("Only CSV files are allowed"));
    }
  },
});

// Configure multer for meeting minutes file uploads
const meetingMinutesUpload = multer({
  dest: "uploads/temp/", // Use temp directory first
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    const allowedMimeTypes = [
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ];
    const allowedExtensions = [".pdf", ".doc", ".docx"];
    const hasValidMimeType = allowedMimeTypes.includes(file.mimetype);
    const hasValidExtension = allowedExtensions.some((ext) =>
      file.originalname.toLowerCase().endsWith(ext),
    );

    if (hasValidMimeType || hasValidExtension) {
      cb(null, true);
    } else {
      cb(
        new Error(
          "Only PDF, DOC, and DOCX files are allowed for meeting minutes",
        ),
      );
    }
  },
});

// Configure multer for import operations (memory storage)
const importUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      "text/csv",
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ];
    const allowedExtensions = [".csv", ".xls", ".xlsx"];
    const hasValidType = allowedTypes.includes(file.mimetype);
    const hasValidExtension = allowedExtensions.some((ext) =>
      file.originalname.toLowerCase().endsWith(ext),
    );

    if (hasValidType || hasValidExtension) {
      cb(null, true);
    } else {
      cb(new Error("Only CSV and Excel files are allowed"));
    }
  },
});

// Configure multer for project files (supports various file types)
const projectFilesUpload = multer({
  dest: "uploads/projects/",
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit per file
  fileFilter: (req, file, cb) => {
    // Allow most common file types for project documentation
    const allowedTypes = [
      "image/jpeg",
      "image/jpg",
      "image/png",
      "image/gif",
      "image/webp",
      "application/pdf",
      "text/plain",
      "text/csv",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/vnd.ms-powerpoint",
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      "application/zip",
      "application/x-zip-compressed",
    ];

    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("File type not supported"));
    }
  },
});

// Configure multer for project data sheet uploads (fallback files)
const projectDataUpload = multer({
  dest: "uploads/project-data/",
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    // Allow Excel files, CSV files, and PDFs
    const allowedTypes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
      'application/vnd.ms-excel', // .xls
      'text/csv', // .csv
      'application/pdf' // .pdf
    ];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only Excel, CSV, and PDF files are allowed for project data uploads'));
    }
  }
});

export async function registerRoutes(app: Express): Promise<Server> {
  // Health check endpoint for deployment monitoring
  app.get("/api/health", (req, res) => {
    res.status(200).json({
      status: "healthy",
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: process.env.NODE_ENV || "development",
      dependencies: {
        googleCloudStorage: "@google-cloud/storage",
        database: process.env.DATABASE_URL ? "connected" : "not configured"
      }
    });
  });

  // Use database-backed session store for deployment persistence
  console.log("Using database-backed session store for deployment persistence");
  const PgSession = connectPg(session);
  const sessionStore = new PgSession({
    conString: process.env.DATABASE_URL,
    createTableIfMissing: true,
    ttl: 30 * 24 * 60 * 60, // 30 days in seconds (matches cookie maxAge)
    tableName: "sessions",
  });

  // Add CORS middleware before session middleware
  app.use((req, res, next) => {
    const origin = req.headers.origin;
    
    // Enhanced CORS handling for frontend/backend communication
    console.log(`CORS: Request from origin: ${origin || 'undefined'}`);
    
    // In development, allow from any Replit dev domain or localhost
    if (process.env.NODE_ENV === 'development') {
      if (origin && (origin.includes('.replit.dev') || origin.includes('localhost') || origin.includes('127.0.0.1'))) {
        res.header('Access-Control-Allow-Origin', origin);
        console.log(`CORS: Allowing origin: ${origin}`);
      } else {
        // For development, allow all origins as fallback
        res.header('Access-Control-Allow-Origin', '*');
        console.log('CORS: Allowing all origins (development fallback)');
      }
    } else {
      // In production, be more restrictive
      if (origin && origin.includes('.replit.dev')) {
        res.header('Access-Control-Allow-Origin', origin);
        console.log(`CORS: Allowing origin: ${origin}`);
      } else {
        res.header('Access-Control-Allow-Origin', '*');
        console.log('CORS: Allowing all origins (production fallback)');
      }
    }
    
    res.header('Access-Control-Allow-Credentials', 'true');
    res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS,PATCH');
    res.header('Access-Control-Allow-Headers', 'Origin,X-Requested-With,Content-Type,Accept,Authorization,Cache-Control,Pragma');
    
    if (req.method === 'OPTIONS') {
      res.sendStatus(200);
    } else {
      next();
    }
  });

  // Add session middleware with enhanced stability
  app.use(
    session({
      store: sessionStore,
      secret: process.env.SESSION_SECRET || "temp-secret-key-for-development",
      resave: true, // Force session save on every request to prevent data loss
      saveUninitialized: false,
      cookie: {
        secure: false, // Should be true in production with HTTPS, false for development
        httpOnly: false, // Allow frontend to access cookies for debugging in Replit
        maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days for extended user sessions
        sameSite: "lax", // CSRF protection
        domain: undefined, // Let Express auto-detect domain for Replit
      },
      name: "tsp.session", // Custom session name
      rolling: true, // Reset maxAge on every request to keep active sessions alive
    }),
  );

  // Setup temporary authentication (stable and crash-free)
  const {
    setupTempAuth,
    isAuthenticated,
    initializeTempAuth,
  } = await import("./temp-auth");
  setupTempAuth(app);

  // Initialize with default admin user for persistent login
  await initializeTempAuth();

  // Add activity logging middleware after authentication setup
  app.use(createActivityLogger({ storage }));

  // Import and register signup routes
  const { signupRoutes } = await import("./routes/signup");
  app.use("/api", signupRoutes);

  // Import and register password reset routes
  const passwordResetRoutes = await import("./routes/password-reset");
  app.use("/api", passwordResetRoutes.default);
  
  // Register Stream Chat routes with authentication
  const { streamRoutes } = await import("./routes/stream");
  app.use("/api/stream", isAuthenticated, streamRoutes);

  // Permission migration endpoint (admin only)
  app.post("/api/migrate-permissions", isAuthenticated, requirePermission("ADMIN_ACCESS"), async (req: any, res) => {
    try {
      console.log("🔄 Starting permission migration...");
      
      // Get all users
      const allUsers = await storage.getAllUsers();
      console.log(`Found ${allUsers.length} users to migrate`);

      let migratedCount = 0;
      let unchangedCount = 0;

      // Permission mapping from old to new format
      const PERMISSION_MAPPING: Record<string, string> = {
        // Host management
        "access_hosts": "HOSTS_VIEW",
        "manage_hosts": "HOSTS_EDIT", 
        "view_hosts": "HOSTS_VIEW",
        "add_hosts": "HOSTS_ADD",
        "edit_hosts": "HOSTS_EDIT",
        "delete_hosts": "HOSTS_DELETE",

        // Recipient management  
        "access_recipients": "RECIPIENTS_VIEW",
        "manage_recipients": "RECIPIENTS_EDIT",
        "view_recipients": "RECIPIENTS_VIEW", 
        "add_recipients": "RECIPIENTS_ADD",
        "edit_recipients": "RECIPIENTS_EDIT",
        "delete_recipients": "RECIPIENTS_DELETE",

        // Driver management
        "access_drivers": "DRIVERS_VIEW", 
        "manage_drivers": "DRIVERS_EDIT",
        "view_drivers": "DRIVERS_VIEW",
        "add_drivers": "DRIVERS_ADD",
        "edit_drivers": "DRIVERS_EDIT",
        "delete_drivers": "DRIVERS_DELETE",

        // User management
        "manage_users": "USERS_EDIT",
        "view_users": "USERS_VIEW",

        // Collections  
        "access_collections": "COLLECTIONS_VIEW",
        "manage_collections": "COLLECTIONS_EDIT",
        "create_collections": "COLLECTIONS_ADD",
        "edit_all_collections": "COLLECTIONS_EDIT_ALL", 
        "delete_all_collections": "COLLECTIONS_DELETE_ALL",
        "use_collection_walkthrough": "COLLECTIONS_WALKTHROUGH",

        // Projects
        "access_projects": "PROJECTS_VIEW",
        "manage_projects": "PROJECTS_EDIT",
        "create_projects": "PROJECTS_ADD",
        "edit_all_projects": "PROJECTS_EDIT_ALL",
        "delete_all_projects": "PROJECTS_DELETE_ALL",

        // Distributions
        "access_donation_tracking": "DISTRIBUTIONS_VIEW",
        "manage_donation_tracking": "DISTRIBUTIONS_EDIT",
        "view_donation_tracking": "DISTRIBUTIONS_VIEW", 
        "add_donation_tracking": "DISTRIBUTIONS_ADD",
        "edit_donation_tracking": "DISTRIBUTIONS_EDIT",
        "delete_donation_tracking": "DISTRIBUTIONS_DELETE",

        // Event requests
        "access_event_requests": "EVENT_REQUESTS_VIEW",
        "manage_event_requests": "EVENT_REQUESTS_EDIT",
        "view_event_requests": "EVENT_REQUESTS_VIEW",
        "add_event_requests": "EVENT_REQUESTS_ADD", 
        "edit_event_requests": "EVENT_REQUESTS_EDIT",
        "delete_event_requests": "EVENT_REQUESTS_DELETE",

        // Messages  
        "access_messages": "MESSAGES_VIEW",
        "send_messages": "MESSAGES_SEND",
        "moderate_messages": "MESSAGES_MODERATE",

        // Work logs
        "access_work_logs": "WORK_LOGS_VIEW",
        "create_work_logs": "WORK_LOGS_ADD",
        "view_all_work_logs": "WORK_LOGS_VIEW_ALL",
        "edit_all_work_logs": "WORK_LOGS_EDIT_ALL", 
        "delete_all_work_logs": "WORK_LOGS_DELETE_ALL",

        // Chat permissions
        "access_chat": "CHAT_GENERAL",
        "general_chat": "CHAT_GENERAL",
        "committee_chat": "CHAT_COMMITTEE",
        "host_chat": "CHAT_HOST", 
        "driver_chat": "CHAT_DRIVER",
        "recipient_chat": "CHAT_RECIPIENT",
        "core_team_chat": "CHAT_CORE_TEAM",
        "direct_messages": "CHAT_DIRECT",
        "GENERAL_CHAT": "CHAT_GENERAL",
        "COMMITTEE_CHAT": "CHAT_COMMITTEE",
        "HOST_CHAT": "CHAT_HOST",
        "DRIVER_CHAT": "CHAT_DRIVER", 
        "RECIPIENT_CHAT": "CHAT_RECIPIENT",
        "CORE_TEAM_CHAT": "CHAT_CORE_TEAM",

        // Analytics and other features
        "access_analytics": "ANALYTICS_VIEW",
        "access_meetings": "MEETINGS_VIEW", 
        "manage_meetings": "MEETINGS_MANAGE",
        "access_suggestions": "SUGGESTIONS_VIEW",
        "create_suggestions": "SUGGESTIONS_ADD",
        "manage_suggestions": "SUGGESTIONS_MANAGE",
        "access_toolkit": "DOCUMENTS_VIEW",
        "access_documents": "DOCUMENTS_VIEW",
        "manage_documents": "DOCUMENTS_MANAGE",
        "export_data": "DATA_EXPORT",
        "import_data": "DATA_IMPORT",
        "edit_data": "DATA_EXPORT"
      };

      for (const user of allUsers) {
        if (!user.permissions || user.permissions.length === 0) {
          console.log(`⏭️  Skipping ${user.email} - no permissions`);
          unchangedCount++;
          continue;
        }

        // Map old permissions to new ones
        const newPermissions = user.permissions
          .map((oldPerm: string) => {
            const newPerm = PERMISSION_MAPPING[oldPerm.toLowerCase()];
            if (newPerm) {
              console.log(`  📝 ${oldPerm} → ${newPerm}`);
              return newPerm;
            } else {
              // Keep permission as-is if already in new format or unrecognized
              if (oldPerm.includes('_')) {
                console.log(`  ✅ ${oldPerm} (already new format)`);
              } else {
                console.log(`  ⚠️  Unknown permission: ${oldPerm} (keeping as-is)`);
              }
              return oldPerm;
            }
          })
          // Remove duplicates
          .filter((perm: string, index: number, array: string[]) => array.indexOf(perm) === index);

        // Check if anything changed
        const hasChanges = JSON.stringify(user.permissions.sort()) !== JSON.stringify(newPermissions.sort());

        if (hasChanges) {
          console.log(`🔄 Migrating ${user.email}:`);
          console.log(`   Old: ${user.permissions.join(', ')}`);
          console.log(`   New: ${newPermissions.join(', ')}`);
          
          await storage.updateUser(user.id, { permissions: newPermissions });
          migratedCount++;
        } else {
          console.log(`✅ ${user.email} - no migration needed`);
          unchangedCount++;
        }
      }

      console.log(`\n🎉 Migration complete!`);
      console.log(`   ✅ ${migratedCount} users migrated`);
      console.log(`   ➡️  ${unchangedCount} users unchanged`);

      res.json({ 
        success: true, 
        migrated: migratedCount, 
        unchanged: unchangedCount,
        message: `Migration complete: ${migratedCount} users updated, ${unchangedCount} unchanged`
      });
    } catch (error) {
      console.error("❌ Permission migration failed:", error);
      res.status(500).json({ 
        success: false, 
        error: "Migration failed", 
        details: error instanceof Error ? error.message : 'Unknown error' 
      });
    }
  });

  // Comprehensive debug endpoints for authentication troubleshooting
  app.get("/api/debug/session", async (req: any, res) => {
    try {
      const sessionUser = req.session?.user;
      const reqUser = req.user;

      res.json({
        hasSession: !!req.session,
        sessionId: req.sessionID,
        sessionStore: !!sessionStore,
        sessionUser: sessionUser
          ? {
              id: sessionUser.id,
              email: sessionUser.email,
              role: sessionUser.role,
              isActive: sessionUser.isActive,
            }
          : null,
        reqUser: reqUser
          ? {
              id: reqUser.id,
              email: reqUser.email,
              role: reqUser.role,
              isActive: reqUser.isActive,
            }
          : null,
        cookies: req.headers.cookie,
        userAgent: req.headers["user-agent"],
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || "development",
      });
    } catch (error) {
      console.error("Debug session error:", error);
      res.status(500).json({ error: "Failed to get session info" });
    }
  });

  // Debug endpoint to check authentication status
  app.get("/api/debug/auth-status", async (req: any, res) => {
    try {
      const user = req.session?.user || req.user;

      res.json({
        isAuthenticated: !!user,
        sessionExists: !!req.session,
        userInSession: !!req.session?.user,
        userInRequest: !!req.user,
        userId: user?.id || null,
        userEmail: user?.email || null,
        userRole: user?.role || null,
        sessionId: req.sessionID,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error("Debug auth status error:", error);
      res.status(500).json({ error: "Failed to get auth status" });
    }
  });

  // Auth routes - Fixed to work with temp auth system
  app.get("/api/auth/user", async (req: any, res) => {
    try {
      // Get user from session (temp auth) or req.user (Replit auth)
      const user = req.session?.user || req.user;

      if (!user) {
        return res.status(401).json({ message: "No user in session" });
      }

      // For temp auth, user is directly in session, but get fresh data from database
      if (req.session?.user) {
        try {
          const dbUser = await storage.getUserByEmail(req.session.user.email);
          if (dbUser && dbUser.isActive) {
            // Return fresh user data with updated permissions
            res.json({
              id: dbUser.id,
              email: dbUser.email,
              firstName: dbUser.firstName,
              lastName: dbUser.lastName,
              displayName: `${dbUser.firstName} ${dbUser.lastName}`,
              profileImageUrl: dbUser.profileImageUrl,
              role: dbUser.role,
              permissions: dbUser.permissions,
              isActive: dbUser.isActive
            });
            return;
          }
        } catch (error) {
          console.error("Error getting fresh user data:", error);
          // Fallback to session user if database error
          res.json(user);
          return;
        }
      }

      // For Replit auth, get user from database
      const userId = req.user.claims?.sub || req.user.id;
      const dbUser = await storage.getUser(userId);
      res.json(dbUser || user);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // Import and use the new modular routes
  const routesModule = await import("./routes/index");
  if (routesModule.apiRoutes) {
    app.use(routesModule.apiRoutes);
  }

  // Import and register sandwich distributions routes
  const sandwichDistributionsRoutes = await import("./routes/sandwich-distributions");
  app.use("/api/sandwich-distributions", sandwichDistributionsRoutes.default);

  // Recipients routes are handled directly in this file below
  // const recipientsRoutes = await import("./routes/recipients");
  // app.use("/api/recipients", recipientsRoutes.default);

  // Import and register recipient TSP contacts routes
  app.use("/api/recipient-tsp-contacts", recipientTspContactRoutes);

  // Register event request routes
  app.use("/api/event-requests", eventRequestRoutes);
  
  // Register import events routes
  app.use("/api/import", importEventsRoutes);
  
  // Groups Catalog: Complete directory of all organizations (current requests + historical hosts)
  app.get("/api/groups-catalog", isAuthenticated, async (req, res) => {
    try {
      const user = req.user;
      
      // Get all event requests and aggregate by organization + department
      const allEventRequests = await storage.getAllEventRequests();
      
      // Get all historical host organizations from sandwich collections
      const allCollections = await storage.getAllSandwichCollections();
      
      // Create a map to aggregate data by organization and department
      const departmentsMap = new Map();
      
      allEventRequests.forEach(request => {
        const orgName = request.organizationName;
        const department = request.department || '';
        const contactName = request.firstName && request.lastName 
          ? `${request.firstName} ${request.lastName}`.trim()
          : request.firstName || request.lastName || '';
        const contactEmail = request.email;
        
        if (!orgName || !contactName) return;
        
        // Create a unique key for organization + department combination
        const departmentKey = `${orgName}|${department}`;
        
        // Track department-level aggregation
        if (!departmentsMap.has(departmentKey)) {
          departmentsMap.set(departmentKey, {
            organizationName: orgName,
            department: department,
            contacts: [],
            totalRequests: 0,
            latestStatus: 'new',
            latestRequestDate: request.createdAt || new Date(),
            hasHostedEvent: false,
            totalSandwiches: 0,
            eventDate: null
          });
        }
        
        const dept = departmentsMap.get(departmentKey);
        dept.totalRequests += 1;
        
        // Add contact if not already present
        const existingContact = dept.contacts.find(c => 
          c.name === contactName && c.email === contactEmail
        );
        
        if (!existingContact) {
          dept.contacts.push({
            name: contactName,
            email: contactEmail,
            phone: request.phone
          });
        }
        
        // Update department status based on most recent request
        const requestDate = new Date(request.createdAt || new Date());
        if (requestDate >= dept.latestRequestDate) {
          dept.latestRequestDate = requestDate;
          
          // Determine status: check if scheduled (future event) or completed/past
          if (request.status === 'completed' || request.status === 'contact_completed') {
            dept.latestStatus = request.status;
            dept.hasHostedEvent = true;
            // Add sandwich count for completed events
            if (request.estimatedSandwichCount) {
              dept.totalSandwiches += request.estimatedSandwichCount;
            }
          } else if (request.status === 'scheduled') {
            // Check if the scheduled event is in the future or past
            const eventDate = request.desiredEventDate ? new Date(request.desiredEventDate) : null;
            const now = new Date();
            if (eventDate && eventDate > now) {
              dept.latestStatus = 'scheduled'; // Upcoming event
              dept.eventDate = request.desiredEventDate;
            } else if (eventDate && eventDate <= now) {
              dept.latestStatus = 'past'; // Past scheduled event
              dept.hasHostedEvent = true;
              dept.eventDate = request.desiredEventDate;
            } else {
              dept.latestStatus = 'scheduled'; // Scheduled but no date specified
            }
          } else {
            dept.latestStatus = request.status || 'new';
          }
          
          // Update event date from most recent request
          if (request.desiredEventDate) {
            dept.eventDate = request.desiredEventDate;
          }
        }
      });
      
      // Add historical host organizations from sandwich collections
      const historicalGroups = new Set();
      allCollections.forEach(collection => {
        // Add group1_name if it exists and looks like an organization
        if (collection.group1Name && 
            collection.group1Name !== 'Group' && 
            collection.group1Name !== 'Groups' && 
            collection.group1Name !== 'Unnamed Groups' &&
            collection.group1Name.trim()) {
          historicalGroups.add(collection.group1Name.trim());
        }
        
        // Add group2_name if it exists and looks like an organization
        if (collection.group2Name && 
            collection.group2Name !== 'Group' && 
            collection.group2Name !== 'Groups' && 
            collection.group2Name !== 'Unnamed Groups' &&
            collection.group2Name.trim()) {
          historicalGroups.add(collection.group2Name.trim());
        }
      });
      
      // Add historical groups to departments map if not already present
      historicalGroups.forEach(groupName => {
        const departmentKey = `${groupName}|`; // Empty department for historical entries
        
        if (!departmentsMap.has(departmentKey)) {
          departmentsMap.set(departmentKey, {
            organizationName: groupName,
            department: '',
            contacts: [],
            totalRequests: 0,
            latestStatus: 'past',
            latestRequestDate: new Date('2020-01-01'), // Historical placeholder
            hasHostedEvent: true,
            totalSandwiches: 0,
            eventDate: null
          });
        } else {
          // Update existing entry to show it has hosted events
          const dept = departmentsMap.get(departmentKey);
          dept.hasHostedEvent = true;
        }
      });
      
      // Convert Map to array and group by organization
      const organizationsMap = new Map();
      
      departmentsMap.forEach((dept) => {
        const orgName = dept.organizationName;
        
        if (!organizationsMap.has(orgName)) {
          organizationsMap.set(orgName, {
            name: orgName,
            departments: []
          });
        }
        
        const org = organizationsMap.get(orgName);
        org.departments.push({
          organizationName: orgName,
          department: dept.department,
          contactName: dept.contacts[0]?.name || 'Historical Organization',
          email: dept.contacts[0]?.email || '',
          phone: dept.contacts[0]?.phone || '',
          allContacts: dept.contacts,
          status: dept.latestStatus,
          totalRequests: dept.totalRequests,
          hasHostedEvent: dept.hasHostedEvent,
          totalSandwiches: dept.totalSandwiches,
          eventDate: dept.eventDate,
          latestRequestDate: dept.latestRequestDate
        });
      });
      
      // Convert to final format and sort
      const organizations = Array.from(organizationsMap.entries()).map(([_, org]) => ({
        name: org.name,
        departments: org.departments.sort((a, b) => 
          new Date(b.latestRequestDate).getTime() - new Date(a.latestRequestDate).getTime()
        )
      }));
      
      // Sort organizations by most recent activity across all departments
      organizations.sort((a, b) => {
        const aLatest = Math.max(...a.departments.map(d => new Date(d.latestRequestDate).getTime()));
        const bLatest = Math.max(...b.departments.map(d => new Date(d.latestRequestDate).getTime()));
        return bLatest - aLatest;
      });
      
      res.json({ groups: organizations });
      
    } catch (error) {
      console.error("Error fetching organizations catalog:", error);
      res.status(500).json({ message: "Failed to fetch organizations catalog" });
    }
  });

  // Register work log routes


  // Register performance optimization routes
  registerPerformanceRoutes(app);
  // Apply global middleware
  app.use(requestLogger);
  // Temporarily disable rate limiting to fix sandwich collections
  // app.use(generalRateLimit);
  app.use(sanitizeMiddleware);

  // User list for project assignments (available to anyone who can create projects)
  app.get(
    "/api/users/for-assignments",
    isAuthenticated,
    async (req, res) => {
      try {
        const users = await storage.getAllUsers();
        // Return basic user info needed for assignments
        const assignableUsers = users.map(user => ({
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role
        }));
        res.json(assignableUsers);
      } catch (error) {
        console.error("Error fetching users for assignments:", error);
        res.status(500).json({ message: "Failed to fetch users" });
      }
    },
  );

  // User management routes
  app.get(
    "/api/users",
    isAuthenticated,
    requirePermission("USERS_EDIT"),
    async (req, res) => {
      try {
        const users = await storage.getAllUsers();
        res.json(users);
      } catch (error) {
        console.error("Error fetching users:", error);
        res.status(500).json({ message: "Failed to fetch users" });
      }
    },
  );

  app.patch(
    "/api/users/:id",
    isAuthenticated,
    requirePermission("USERS_EDIT"),
    async (req, res) => {
      try {
        const { id } = req.params;
        const { role, permissions, metadata } = req.body;
        
        // Deduplicate permissions to prevent database inconsistencies
        const deduplicatedPermissions = permissions ? [...new Set(permissions)] : [];
        
        // Build update object with only provided fields
        const updateData: any = {};
        if (role !== undefined) updateData.role = role;
        if (permissions !== undefined) updateData.permissions = deduplicatedPermissions;
        if (metadata !== undefined) updateData.metadata = metadata;
        
        const updatedUser = await storage.updateUser(id, updateData);
        res.json(updatedUser);
      } catch (error) {
        console.error("Error updating user:", error);
        res.status(500).json({ message: "Failed to update user" });
      }
    },
  );

  app.patch(
    "/api/users/:id/status",
    isAuthenticated,
    requirePermission("USERS_EDIT"),
    async (req, res) => {
      try {
        const { id } = req.params;
        const { isActive } = req.body;
        const updatedUser = await storage.updateUser(id, { isActive });
        res.json(updatedUser);
      } catch (error) {
        console.error("Error updating user status:", error);
        res.status(500).json({ message: "Failed to update user status" });
      }
    },
  );

  app.patch(
    "/api/users/:id/profile",
    isAuthenticated,
    requirePermission("USERS_EDIT"),
    async (req, res) => {
      try {
        const { id } = req.params;
        const { email, firstName, lastName, role, isActive } = req.body;
        
        // Build update object with only provided fields
        const updateData: any = {};
        if (email !== undefined) updateData.email = email;
        if (firstName !== undefined) updateData.firstName = firstName;
        if (lastName !== undefined) updateData.lastName = lastName;
        if (role !== undefined) updateData.role = role;
        if (isActive !== undefined) updateData.isActive = isActive;
        
        const updatedUser = await storage.updateUser(id, updateData);
        
        // Log the user profile update
        await AuditLogger.log(
          'user_profile_updated',
          'user_management',
          id,
          { updatedFields: Object.keys(updateData), newValues: updateData },
          { userId: req.user?.id }
        );
        
        res.json(updatedUser);
      } catch (error) {
        console.error("Error updating user profile:", error);
        res.status(500).json({ message: "Failed to update user profile" });
      }
    },
  );

  app.post(
    "/api/users",
    isAuthenticated,
    requirePermission("USERS_EDIT"),
    async (req, res) => {
      try {
        const { email, firstName, lastName, role } = req.body;
        
        // Validate required fields
        if (!email || !firstName || !lastName) {
          return res.status(400).json({ message: "Email, first name, and last name are required" });
        }

        // Check if user already exists
        const existingUser = await storage.getUserByEmail(email);
        if (existingUser) {
          return res.status(409).json({ message: "User with this email already exists" });
        }

        // Generate user ID and get default permissions for role
        const userId = "user_" + Date.now() + "_" + Math.random().toString(36).substr(2, 9);
        const userRole = role || "volunteer";
        const defaultPermissions = getDefaultPermissionsForRole(userRole);

        const newUser = await storage.createUser({
          id: userId,
          email,
          firstName,
          lastName,
          role: userRole,
          permissions: defaultPermissions,
          isActive: true,
          profileImageUrl: null,
          metadata: {}
        });

        res.status(201).json(newUser);
      } catch (error) {
        console.error("Error creating user:", error);
        res.status(500).json({ message: "Failed to create user" });
      }
    },
  );

  app.delete(
    "/api/users/:id",
    isAuthenticated,
    requirePermission("USERS_EDIT"),
    async (req, res) => {
      try {
        const { id } = req.params;
        await storage.deleteUser(id);
        res.json({ success: true, message: "User deleted successfully" });
      } catch (error) {
        console.error("Error deleting user:", error);
        res.status(500).json({ message: "Failed to delete user" });
      }
    },
  );

  app.patch(
    "/api/users/:id/password",
    isAuthenticated,
    requirePermission("USERS_EDIT"),
    async (req, res) => {
      try {
        const { id } = req.params;
        const { password } = req.body;

        if (!password || password.length < 6) {
          return res.status(400).json({ message: "Password must be at least 6 characters long" });
        }

        await storage.setUserPassword(id, password);
        res.json({ success: true, message: "Password updated successfully" });
      } catch (error) {
        console.error("Error setting user password:", error);
        res.status(500).json({ message: "Failed to set user password" });
      }
    },
  );

  // Projects
  app.get("/api/projects", async (req, res) => {
    try {
      const projects = await storage.getAllProjects();
      res.json(projects);
    } catch (error) {
      logger.error("Failed to fetch projects", error);
      res.status(500).json({ message: "Failed to fetch projects" });
    }
  });

  app.post(
    "/api/projects",
    isAuthenticated,
    async (req, res) => {
      try {
        // User has create_projects permission, proceed with creation

        // Check if user can create projects
        if (!req.user?.permissions?.includes('create_projects') && 
            !req.user?.permissions?.includes('edit_all_projects') &&
            !req.user?.permissions?.includes('manage_projects')) {
          return res.status(403).json({ message: "Permission denied. You cannot create projects." });
        }

        console.log("Received project data:", req.body);
        
        // Sanitize numeric fields - convert empty strings to null to prevent database errors
        const sanitizedBody = { ...req.body };
        if (sanitizedBody.estimatedHours === '') sanitizedBody.estimatedHours = null;
        if (sanitizedBody.actualHours === '') sanitizedBody.actualHours = null;
        if (sanitizedBody.dueDate === '') sanitizedBody.dueDate = null;
        if (sanitizedBody.startDate === '') sanitizedBody.startDate = null;
        if (sanitizedBody.budget === '') sanitizedBody.budget = null;
        
        const projectData = insertProjectSchema.parse({
          ...sanitizedBody,
          createdBy: req.user.id,
          createdByName: req.user.firstName ? `${req.user.firstName} ${req.user.lastName || ''}`.trim() : req.user.email
        });
        console.log("Parsed project data with creator:", projectData);
        const project = await storage.createProject(projectData);
        res.status(201).json(project);
      } catch (error) {
        console.error("Project creation error details:", error);
        logger.error("Failed to create project", error);
        res.status(400).json({
          message: "Invalid project data",
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    },
  );

  app.post("/api/projects/:id/claim", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { assigneeName } = req.body;

      const updatedProject = await storage.updateProject(id, {
        status: "in_progress",
        assigneeName: assigneeName || "You",
      });

      if (!updatedProject) {
        return res.status(404).json({ message: "Project not found" });
      }

      res.json(updatedProject);
    } catch (error) {
      res.status(500).json({ message: "Failed to claim project" });
    }
  });

  // Task completion routes for multi-user tasks
  app.post("/api/tasks/:taskId/complete", async (req, res) => {
    try {
      const taskId = parseInt(req.params.taskId);
      const user = req.session?.user;
      const { notes } = req.body;

      if (!user) {
        return res.status(401).json({ error: "Authentication required" });
      }

      // Check if user is assigned to this task
      const task = await storage.getTaskById(taskId);
      if (!task) {
        return res.status(404).json({ error: "Task not found" });
      }

      const assigneeIds = task.assigneeIds || [];
      if (!assigneeIds.includes(user.id)) {
        return res
          .status(403)
          .json({ error: "You are not assigned to this task" });
      }

      // Add completion record
      const completionData = insertTaskCompletionSchema.parse({
        taskId: taskId,
        userId: user.id,
        userName: user.firstName && user.lastName ? `${user.firstName} ${user.lastName}` : user.email,
        notes: notes,
      });

      const completion = await storage.createTaskCompletion(completionData);

      // Check completion status
      const allCompletions = await storage.getTaskCompletions(taskId);
      const isFullyCompleted = allCompletions.length >= assigneeIds.length;

      // If all users completed, update task status
      if (isFullyCompleted && task.status !== "completed") {
        await storage.updateTaskStatus(taskId, "completed");
      }

      res.json({
        completion: completion,
        isFullyCompleted,
        totalCompletions: allCompletions.length,
        totalAssignees: assigneeIds.length,
      });
    } catch (error) {
      console.error("Error completing task:", error);
      res.status(500).json({ error: "Failed to complete task" });
    }
  });

  // Remove completion by current user
  app.delete("/api/tasks/:taskId/complete", async (req, res) => {
    try {
      const taskId = parseInt(req.params.taskId);
      const user = req.session?.user;

      if (!user) {
        return res.status(401).json({ error: "Authentication required" });
      }

      // Remove completion record
      const success = await storage.removeTaskCompletion(taskId, user.id);
      if (!success) {
        return res.status(404).json({ error: "Completion not found" });
      }

      // Update task status back to in_progress if it was completed
      const task = await storage.getTaskById(taskId);
      if (task?.status === "completed") {
        await storage.updateTaskStatus(taskId, "in_progress");
      }

      res.json({ success: true });
    } catch (error) {
      console.error("Error removing completion:", error);
      res.status(500).json({ error: "Failed to remove completion" });
    }
  });

  // Get task completions
  app.get("/api/tasks/:taskId/completions", async (req, res) => {
    try {
      const taskId = parseInt(req.params.taskId);
      const completions = await storage.getTaskCompletions(taskId);
      res.json(completions);
    } catch (error) {
      console.error("Error fetching completions:", error);
      res.status(500).json({ error: "Failed to fetch completions" });
    }
  });

  app.put(
    "/api/projects/:id",
    requirePermission("DATA_EXPORT"),
    async (req, res) => {
      try {
        const id = parseInt(req.params.id);
        const updates = req.body;

        // Filter out timestamp fields that shouldn't be updated directly
        const { createdAt, updatedAt, ...validUpdates } = updates;

        const updatedProject = await storage.updateProject(id, validUpdates);

        if (!updatedProject) {
          return res.status(404).json({ message: "Project not found" });
        }

        res.json(updatedProject);
      } catch (error) {
        logger.error("Failed to update project", error);
        res.status(500).json({ message: "Failed to update project" });
      }
    },
  );

  app.patch(
    "/api/projects/:id",
    isAuthenticated,
    async (req, res) => {
      try {
        const id = parseInt(req.params.id);
        const updates = req.body;

        console.log('=== SERVER PROJECT PATCH DEBUG ===');
        console.log('Project ID:', id);
        console.log('Updates received:', updates);
        console.log('Support People value:', updates.supportPeople);
        console.log('User:', req.user?.email);

        // Get the existing project to check ownership
        const existingProject = await storage.getProject(id);
        if (!existingProject) {
          console.log('Project not found:', id);
          return res.status(404).json({ message: "Project not found" });
        }

        console.log('Existing project found:', existingProject.title);
        console.log('Current supportPeople:', existingProject.supportPeople);

        // Check permissions using shared auth utils
        const { hasPermission, PERMISSIONS } = await import("@shared/auth-utils");
        
        // Special handling for "Send to Agenda" - this is a meeting management function, not project editing
        const isAgendaUpdate = updates.reviewInNextMeeting !== undefined && Object.keys(updates).length === 1;
        
        if (isAgendaUpdate) {
          // For agenda updates, only need MEETINGS_MANAGE permission
          const canManageMeetings = hasPermission(req.user, PERMISSIONS.MEETINGS_MANAGE);
          console.log('Agenda update detected - checking MEETINGS_MANAGE permission:', canManageMeetings);
          
          if (!canManageMeetings) {
            console.log('Permission denied for agenda update - user lacks MEETINGS_MANAGE:', req.user?.email);
            return res.status(403).json({ 
              message: "Permission denied. You need meeting management permissions to send projects to agenda." 
            });
          }
        } else {
          // For other project updates, use standard project edit permissions
          const canEditAll = hasPermission(req.user, PERMISSIONS.PROJECTS_EDIT_ALL) ||
                            hasPermission(req.user, PERMISSIONS.MANAGE_ALL_PROJECTS);
          const canEditOwn = hasPermission(req.user, PERMISSIONS.PROJECTS_EDIT_OWN) && 
                            (existingProject.createdBy === req.user.id);

          console.log('Regular project edit - canEditAll:', canEditAll, 'canEditOwn:', canEditOwn);

          if (!canEditAll && !canEditOwn) {
            console.log('Permission denied for project edit:', req.user?.email);
            return res.status(403).json({ 
              message: "Permission denied. You can only edit your own projects or need admin privileges." 
            });
          }
        }

        // Filter out fields that shouldn't be updated directly
        const { createdAt, updatedAt, created_by, created_by_name, ...validUpdates } = updates;

        console.log('Valid updates to apply:', validUpdates);

        const updatedProject = await storage.updateProject(id, validUpdates);

        if (!updatedProject) {
          console.log('Failed to update project in storage');
          return res.status(404).json({ message: "Project not found" });
        }

        console.log('Project updated successfully:', updatedProject.supportPeople);

        // Auto-sync to Google Sheets if supportPeople was updated (async, non-blocking)
        if (updates.supportPeople !== undefined) {
          console.log('Support people updated, triggering async Google Sheets sync...');
          // Run sync in the background without blocking the response
          setImmediate(async () => {
            try {
              const { getGoogleSheetsSyncService } = await import('./google-sheets-sync');
              const syncService = getGoogleSheetsSyncService(storage);
              await syncService.syncToGoogleSheets();
              console.log('Projects synced to Google Sheets successfully (background)');
            } catch (syncError) {
              console.error('Failed to sync to Google Sheets (background):', syncError);
            }
          });
        }

        res.json(updatedProject);
      } catch (error) {
        console.error('=== PROJECT PATCH ERROR ===');
        console.error('Error details:', error);
        logger.error("Failed to update project", error);
        res.status(500).json({ message: "Failed to update project" });
      }
    },
  );

  app.delete(
    "/api/projects/:id",
    isAuthenticated,
    async (req, res) => {
      try {
        const id = parseInt(req.params.id);
        if (isNaN(id)) {
          return res.status(400).json({ message: "Invalid project ID" });
        }

        // Get the existing project to check ownership
        const existingProject = await storage.getProject(id);
        if (!existingProject) {
          return res.status(404).json({ message: "Project not found" });
        }

        // Check permissions - ownership-based or admin
        const canDeleteAll = req.user?.permissions?.includes('PROJECTS_DELETE_ALL') || 
                            req.user?.role === 'admin' || req.user?.role === 'super_admin';
        
        const canDeleteOwn = req.user?.permissions?.includes('PROJECTS_DELETE_OWN') && 
                            (existingProject.createdBy === req.user.id);

        if (!canDeleteAll && !canDeleteOwn) {
          return res.status(403).json({ 
            message: "Permission denied. You can only delete your own projects or need admin privileges." 
          });
        }

        const deleted = await storage.deleteProject(id);
        if (!deleted) {
          return res.status(404).json({ message: "Project not found" });
        }

        res.status(204).send();
      } catch (error) {
        logger.error("Failed to delete project", error);
        res.status(500).json({ message: "Failed to delete project" });
      }
    },
  );

  // Archive project route
  app.post(
    "/api/projects/:id/archive",
    isAuthenticated,
    async (req, res) => {
      try {
        const id = parseInt(req.params.id);
        if (isNaN(id)) {
          return res.status(400).json({ message: "Invalid project ID" });
        }

        // Check if project exists and is completed
        const project = await storage.getProject(id);
        if (!project) {
          return res.status(404).json({ message: "Project not found" });
        }

        if (project.status !== "completed") {
          return res.status(400).json({ message: "Only completed projects can be archived" });
        }

        // Check permissions
        const canArchive = req.user?.permissions?.includes('manage_projects') ||
                          req.user?.role === 'admin' || req.user?.role === 'super_admin';
        
        if (!canArchive) {
          return res.status(403).json({ 
            message: "Permission denied. Admin privileges required to archive projects." 
          });
        }

        const archived = await storage.archiveProject(id, req.user?.id, req.user?.firstName + ' ' + req.user?.lastName);
        if (!archived) {
          return res.status(500).json({ message: "Failed to archive project" });
        }

        res.json({ message: "Project archived successfully" });
      } catch (error) {
        logger.error("Failed to archive project", error);
        res.status(500).json({ message: "Failed to archive project" });
      }
    }
  );

  // Get archived projects
  app.get("/api/projects/archived", async (req, res) => {
    try {
      const archivedProjects = await storage.getArchivedProjects();
      res.json(archivedProjects);
    } catch (error) {
      logger.error("Failed to fetch archived projects", error);
      res.status(500).json({ message: "Failed to fetch archived projects" });
    }
  });

  // Project Files
  app.post(
    "/api/projects/:id/files",
    projectFilesUpload.array("files"),
    async (req, res) => {
      try {
        const projectId = parseInt(req.params.id);
        if (isNaN(projectId)) {
          return res.status(400).json({ message: "Invalid project ID" });
        }

        const files = req.files as Express.Multer.File[];
        if (!files || files.length === 0) {
          return res.status(400).json({ message: "No files uploaded" });
        }

        // Process uploaded files and return metadata
        const fileMetadata = files.map((file) => ({
          name: file.originalname,
          size: file.size,
          mimetype: file.mimetype,
          path: file.path,
          uploadedAt: new Date().toISOString(),
        }));

        res.status(201).json({
          message: "Files uploaded successfully",
          files: fileMetadata,
        });
      } catch (error) {
        logger.error("Failed to upload project files", error);
        res.status(500).json({ message: "Failed to upload files" });
      }
    },
  );

  app.get("/api/projects/:id/files", async (req, res) => {
    try {
      const projectId = parseInt(req.params.id);
      if (isNaN(projectId)) {
        return res.status(400).json({ message: "Invalid project ID" });
      }

      // For now, return empty array as file storage is basic
      // In a production app, you'd store file metadata in database
      res.json([]);
    } catch (error) {
      logger.error("Failed to fetch project files", error);
      res.status(500).json({ message: "Failed to fetch files" });
    }
  });

  // Project Tasks
  app.get("/api/projects/:id/tasks", async (req, res) => {
    try {
      const projectId = parseInt(req.params.id);
      if (isNaN(projectId)) {
        return res.status(400).json({ message: "Invalid project ID" });
      }

      const tasks = await storage.getProjectTasks(projectId);
      res.json(tasks);
    } catch (error) {
      logger.error("Failed to fetch project tasks", error);
      res.status(500).json({ message: "Failed to fetch project tasks" });
    }
  });

  app.post("/api/projects/:id/tasks", isAuthenticated, async (req, res) => {
    try {
      const projectId = parseInt(req.params.id);
      if (isNaN(projectId)) {
        return res.status(400).json({ message: "Invalid project ID" });
      }

      const { title, description, status = 'pending', priority = 'medium' } = req.body;
      
      if (!title?.trim()) {
        return res.status(400).json({ message: "Task title is required" });
      }

      // Check if project exists
      const project = await storage.getProject(projectId);
      if (!project) {
        return res.status(404).json({ message: "Project not found" });
      }

      // Check permissions - user should be able to add tasks to projects they can edit
      const canEditAll = req.user?.permissions?.includes('edit_all_projects') || 
                        req.user?.permissions?.includes('manage_projects') ||
                        req.user?.role === 'admin' || req.user?.role === 'super_admin';
      
      const canEditOwn = req.user?.permissions?.includes('edit_own_projects') && 
                        (project.createdBy === req.user.id);

      if (!canEditAll && !canEditOwn) {
        return res.status(403).json({ 
          message: "Permission denied. You can only add tasks to projects you can edit." 
        });
      }

      const taskData = {
        projectId,
        title: title.trim(),
        description: description?.trim() || null,
        status,
        priority,
        createdBy: req.user.id,
        createdByName: req.user.firstName && req.user.lastName 
          ? `${req.user.firstName} ${req.user.lastName}` 
          : req.user.email
      };

      const newTask = await storage.createProjectTask(taskData);
      res.status(201).json(newTask);
    } catch (error) {
      logger.error("Failed to create project task", error);
      res.status(500).json({ message: "Failed to create project task" });
    }
  });

  // OLD CONFLICTING ENDPOINT COMPLETELY REMOVED - existing /api/messages at line 6283 handles Gmail folders

  app.delete(
    "/api/messages/:id",
    requirePermission("MESSAGES_SEND"),
    async (req, res) => {
      try {
        const id = parseInt(req.params.id);

        // Check if user is authenticated
        if (!req.user?.id) {
          return res.status(401).json({ message: "Authentication required" });
        }

        // Get message to check ownership
        const message = await storage.getMessageById(id);
        if (!message) {
          return res.status(404).json({ message: "Message not found" });
        }

        // Check if user owns the message or has admin privileges
        const user = req.user as any;
        const isOwner = message.userId === user.id;
        const isSuperAdmin = user.role === "super_admin";
        const isAdmin = user.role === "admin";
        const hasModeratePermission =
          user.permissions?.includes("moderate_messages");

        if (!isOwner && !isSuperAdmin && !isAdmin && !hasModeratePermission) {
          return res
            .status(403)
            .json({ message: "You can only delete your own messages" });
        }

        const deleted = await storage.deleteMessage(id);
        if (!deleted) {
          return res.status(404).json({ message: "Message not found" });
        }
        res.status(204).send();
      } catch (error) {
        logger.error("Failed to delete message", error);
        res.status(500).json({ message: "Failed to delete message" });
      }
    },
  );

  // Notifications & Celebrations
  app.get("/api/notifications/:userId", async (req, res) => {
    try {
      const userId = req.params.userId;
      const notifications = await storage.getUserNotifications(userId);
      res.json(notifications);
    } catch (error) {
      logger.error("Failed to fetch notifications", error);
      res.status(500).json({ message: "Failed to fetch notifications" });
    }
  });

  app.post("/api/notifications", async (req, res) => {
    try {
      const notificationData = req.body;
      const notification = await storage.createNotification(notificationData);
      res.status(201).json(notification);
    } catch (error) {
      logger.error("Failed to create notification", error);
      res.status(500).json({ message: "Failed to create notification" });
    }
  });

  app.patch("/api/notifications/:id/read", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const success = await storage.markNotificationRead(id);
      if (!success) {
        return res.status(404).json({ message: "Notification not found" });
      }
      res.json({ success: true });
    } catch (error) {
      logger.error("Failed to mark notification as read", error);
      res.status(500).json({ message: "Failed to mark notification as read" });
    }
  });

  app.delete("/api/notifications/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const success = await storage.deleteNotification(id);
      if (!success) {
        return res.status(404).json({ message: "Notification not found" });
      }
      res.status(204).send();
    } catch (error) {
      logger.error("Failed to delete notification", error);
      res.status(500).json({ message: "Failed to delete notification" });
    }
  });

  app.post("/api/celebrations", async (req, res) => {
    try {
      const { userId, taskId, message } = req.body;
      const celebration = await storage.createCelebration(
        userId,
        taskId,
        message,
      );
      res.status(201).json(celebration);
    } catch (error) {
      logger.error("Failed to create celebration", error);
      res.status(500).json({ message: "Failed to create celebration" });
    }
  });

  // Weekly Reports
  app.get("/api/weekly-reports", async (req, res) => {
    try {
      const reports = await storage.getAllWeeklyReports();
      res.json(reports);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch weekly reports" });
    }
  });

  app.post("/api/weekly-reports", async (req, res) => {
    try {
      const reportData = insertWeeklyReportSchema.parse(req.body);
      const report = await storage.createWeeklyReport(reportData);
      res.status(201).json(report);
    } catch (error) {
      res.status(400).json({ message: "Invalid report data" });
    }
  });

  // Sandwich Collections Stats - Complete totals including individual + group collections (Optimized)
  app.get("/api/sandwich-collections/stats", async (req, res) => {
    try {
      const stats = await QueryOptimizer.getCachedQuery(
        "sandwich-collections-stats",
        async () => {
          const collections = await storage.getAllSandwichCollections();

          let individualTotal = 0;
          let groupTotal = 0;

          collections.forEach((collection) => {
            individualTotal += collection.individualSandwiches || 0;

            // PHASE 5: Use new column structure only
            const collectionGroupTotal = (collection.group1Count || 0) + (collection.group2Count || 0);
            
            groupTotal += collectionGroupTotal;
          });

          // Data recovery completed: 148,907 sandwiches recovered, exceeding the 50K adjustment
          // Removing temporary adjustment since actual missing data was recovered
          
          return {
            totalEntries: collections.length,
            individualSandwiches: individualTotal,
            groupSandwiches: groupTotal,
            completeTotalSandwiches: individualTotal + groupTotal,
          };
        },
        60000, // Cache for 1 minute since this data doesn't change frequently
      );

      res.json(stats);
    } catch (error) {
      res
        .status(500)
        .json({ message: "Failed to fetch sandwich collection stats" });
    }
  });

  // Sandwich Collections
  app.get("/api/sandwich-collections", async (req, res) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 50;
      const offset = (page - 1) * limit;
      const sortField = req.query.sort as string || 'collectionDate';
      const sortOrder = req.query.order as string || 'desc';

      const result = await storage.getSandwichCollections(limit, offset, sortField, sortOrder);
      const totalCount = await storage.getSandwichCollectionsCount();

      res.json({
        collections: result,
        pagination: {
          page,
          limit,
          total: totalCount,
          totalPages: Math.ceil(totalCount / limit),
          hasNext: page < Math.ceil(totalCount / limit),
          hasPrev: page > 1,
        },
      });
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch sandwich collections" });
    }
  });

  app.post(
    "/api/sandwich-collections",
    requirePermission("COLLECTIONS_ADD"),
    async (req, res) => {
      try {
        console.log("=== POST /api/sandwich-collections DEBUG ===");
        console.log("Raw request body:", JSON.stringify(req.body, null, 2));
        
        // Test what the schema actually expects
        console.log("Testing schema validation...");
        try {
          const testData = {
            collectionDate: "2023-11-28",
            hostName: "Test",
            individualSandwiches: 0,
            group1_name: "Test Group",
            group1_count: 5,
            group2_name: null,
            group2_count: null
          };
          const testResult = insertSandwichCollectionSchema.parse(testData);
          console.log("Schema accepts test data:", JSON.stringify(testResult, null, 2));
        } catch (schemaError) {
          console.error("Schema validation test failed:", schemaError);
        }
        
        const collectionData = insertSandwichCollectionSchema.parse(req.body);
        console.log("Parsed collection data:", JSON.stringify(collectionData, null, 2));
        
        // Add user attribution to the collection
        const user = req.user || req.session?.user;
        const enrichedCollectionData = {
          ...collectionData,
          createdBy: user?.id || 'unknown',
          createdByName: user?.firstName && user?.lastName 
            ? `${user.firstName} ${user.lastName}` 
            : user?.email || 'Unknown User'
        };
        
        console.log("Enriched collection data to save:", JSON.stringify(enrichedCollectionData, null, 2));
        
        const collection = await storage.createSandwichCollection(enrichedCollectionData);
        console.log("Created collection result:", JSON.stringify(collection, null, 2));

        // Invalidate cache when new collection is created
        QueryOptimizer.invalidateCache("sandwich-collections");
        QueryOptimizer.invalidateCache("sandwich-collections-stats");

        res.status(201).json(collection);
      } catch (error) {
        if (error instanceof z.ZodError) {
          logger.warn("Invalid sandwich collection input", {
            error: error.errors,
            ip: req.ip,
          });
          res
            .status(400)
            .json({ message: "Invalid collection data", errors: error.errors });
        } else {
          logger.error("Failed to create sandwich collection", error);
          res.status(500).json({ message: "Failed to create collection" });
        }
      }
    },
  );

  // GET individual sandwich collection by ID
  app.get("/api/sandwich-collections/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid collection ID" });
      }

      const collection = await storage.getSandwichCollectionById(id);
      if (!collection) {
        return res.status(404).json({ message: "Collection not found" });
      }

      res.json(collection);
    } catch (error) {
      logger.error("Failed to fetch sandwich collection", error);
      res.status(500).json({ message: "Failed to fetch collection" });
    }
  });

  app.put(
    "/api/sandwich-collections/:id",
    requireOwnershipPermission(
      "COLLECTIONS_EDIT_OWN", 
      "COLLECTIONS_EDIT_ALL", 
      async (req) => {
        const id = parseInt(req.params.id);
        const collection = await storage.getSandwichCollectionById(id);
        return collection?.userId || null;
      }
    ),
    async (req, res) => {
      try {
        const id = parseInt(req.params.id);
        const updates = req.body;
        const collection = await storage.updateSandwichCollection(id, updates);
        if (!collection) {
          return res.status(404).json({ message: "Collection not found" });
        }

        // Invalidate cache when collection is updated
        QueryOptimizer.invalidateCache("sandwich-collections");

        res.json(collection);
      } catch (error) {
        logger.error("Failed to update sandwich collection", error);
        res.status(400).json({ message: "Invalid update data" });
      }
    },
  );

  // Fix data corruption in sandwich collections - MUST be before /:id route
  app.patch("/api/sandwich-collections/fix-data-corruption", 
    requirePermission("COLLECTIONS_EDIT_ALL"),
    async (req, res) => {
    try {
      const collections = await storage.getAllSandwichCollections();
      let fixedCount = 0;
      const fixes = [];

      for (const collection of collections) {
        let needsUpdate = false;
        const updates: any = {};
        const fixType = [];

        // PHASE 5: Check group collections using new column structure
        const individual = Number(collection.individualSandwiches) || 0;
        const groupTotal = (collection.group1Count || 0) + (collection.group2Count || 0);

        // Fix 1: Check if individual count equals group total (duplication issue)
        if (individual > 0 && groupTotal > 0 && individual === groupTotal) {
          updates.individualSandwiches = 0;
          needsUpdate = true;
          fixType.push("removed duplicate individual count");
        }

        // Fix 2: Check if host name is "Groups" with individual count but no group data
        if ((collection.hostName === "Groups" || collection.hostName === "groups") && 
            individual > 0 && groupTotal === 0) {
          // Move individual count to group data
          const newGroupData = [{
            name: "Group",
            count: individual,
            groupName: "Group", 
            sandwichCount: individual
          }];
          updates.individualSandwiches = 0;
          updates.groupCollections = JSON.stringify(newGroupData);
          needsUpdate = true;
          fixType.push("moved individual count to group data for Groups entry");
        }

        if (needsUpdate) {
          try {
            await storage.updateSandwichCollection(collection.id, updates);
            fixedCount++;
            fixes.push({
              id: collection.id,
              hostName: collection.hostName,
              originalIndividual: individual,
              originalGroup: groupTotal,
              newIndividual: updates.individualSandwiches !== undefined ? updates.individualSandwiches : individual,
              newGroupData: updates.groupCollections || collection.groupCollections,
              fixType: fixType.join(", ")
            });
          } catch (updateError) {
            logger.warn(`Failed to fix collection ${collection.id}:`, updateError);
          }
        }
      }

      res.json({
        message: `Successfully fixed ${fixedCount} data corruption issues`,
        fixedCount,
        totalChecked: collections.length,
        fixes: fixes.slice(0, 10) // Return first 10 fixes for review
      });
    } catch (error) {
      logger.error("Failed to fix data corruption:", error);
      res.status(500).json({ message: "Failed to fix data corruption" });
    }
  });

  app.patch(
    "/api/sandwich-collections/:id",
    requireOwnershipPermission(
      "COLLECTIONS_EDIT_OWN", 
      "COLLECTIONS_EDIT_ALL", 
      async (req) => {
        const id = parseInt(req.params.id);
        const collection = await storage.getSandwichCollectionById(id);
        return collection?.userId || null;
      }
    ),
    async (req, res) => {
      try {
        const id = parseInt(req.params.id);
        if (isNaN(id)) {
          return res.status(400).json({ message: "Invalid collection ID" });
        }

        const updates = req.body;
        const collection = await storage.updateSandwichCollection(id, updates);
        if (!collection) {
          return res.status(404).json({ message: "Collection not found" });
        }

        // Invalidate cache when collection is updated
        QueryOptimizer.invalidateCache("sandwich-collections");

        res.json(collection);
      } catch (error) {
        logger.error("Failed to patch sandwich collection", error);
        res.status(500).json({ message: "Failed to update collection" });
      }
    },
  );

  app.delete("/api/sandwich-collections/bulk", async (req, res) => {
    try {
      const collections = await storage.getAllSandwichCollections();
      const collectionsToDelete = collections.filter((collection) => {
        const hostName = collection.hostName;
        return hostName.startsWith("Loc ") || /^Group [1-8]/.test(hostName);
      });

      let deletedCount = 0;
      // Delete in reverse order by ID to maintain consistency
      const sortedCollections = collectionsToDelete.sort((a, b) => b.id - a.id);

      for (const collection of sortedCollections) {
        try {
          const deleted = await storage.deleteSandwichCollection(collection.id);
          if (deleted) {
            deletedCount++;
          }
        } catch (error) {
          console.error(`Failed to delete collection ${collection.id}:`, error);
        }
      }

      res.json({
        message: `Successfully deleted ${deletedCount} duplicate entries`,
        deletedCount,
        patterns: ["Loc *", "Group 1-8"],
      });
    } catch (error) {
      logger.error("Failed to bulk delete sandwich collections", error);
      res.status(500).json({ message: "Failed to delete duplicate entries" });
    }
  });

  // Batch delete sandwich collections (must be before :id route)
  app.delete("/api/sandwich-collections/batch-delete", async (req, res) => {
    try {
      const { ids } = req.body;

      if (!Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({ message: "Invalid or empty IDs array" });
      }

      let deletedCount = 0;
      const errors = [];

      // Delete in reverse order to maintain consistency
      const sortedIds = ids.sort((a, b) => b - a);

      for (const id of sortedIds) {
        try {
          const deleted = await storage.deleteSandwichCollection(id);
          if (deleted) {
            deletedCount++;
          } else {
            errors.push(`Collection with ID ${id} not found`);
          }
        } catch (error) {
          errors.push(
            `Failed to delete collection ${id}: ${error instanceof Error ? error.message : "Unknown error"}`,
          );
        }
      }

      res.json({
        message: `Successfully deleted ${deletedCount} of ${ids.length} collections`,
        deletedCount,
        totalRequested: ids.length,
        errors: errors.length > 0 ? errors.slice(0, 5) : undefined,
      });
    } catch (error) {
      logger.error("Failed to batch delete collections", error);
      res.status(500).json({ message: "Failed to batch delete collections" });
    }
  });

  // Clean duplicates from sandwich collections (must be before :id route)
  app.delete("/api/sandwich-collections/clean-duplicates", async (req, res) => {
    try {
      const { mode = "exact" } = req.body; // 'exact', 'suspicious', or 'og-duplicates'
      const collections = await storage.getAllSandwichCollections();

      let collectionsToDelete = [];

      if (mode === "exact") {
        // Find exact duplicates based on date, host, and counts
        const duplicateGroups = new Map();

        collections.forEach((collection) => {
          const key = `${collection.collectionDate}-${collection.hostName}-${collection.individualSandwiches}-${collection.groupCollections}`;

          if (!duplicateGroups.has(key)) {
            duplicateGroups.set(key, []);
          }
          duplicateGroups.get(key).push(collection);
        });

        // Keep only the newest entry from each duplicate group
        duplicateGroups.forEach((group) => {
          if (group.length > 1) {
            const sorted = group.sort(
              (a, b) =>
                new Date(b.submittedAt).getTime() -
                new Date(a.submittedAt).getTime(),
            );
            collectionsToDelete.push(...sorted.slice(1)); // Keep first (newest), delete rest
          }
        });
      } else if (mode === "og-duplicates") {
        // Find duplicates between OG Sandwich Project and early collections with no location data
        const ogCollections = collections.filter(
          (c) => c.hostName === "OG Sandwich Project",
        );
        const earlyCollections = collections.filter(
          (c) =>
            c.hostName !== "OG Sandwich Project" &&
            (c.hostName === "" ||
              c.hostName === null ||
              c.hostName.trim() === "" ||
              c.hostName.toLowerCase().includes("unknown") ||
              c.hostName.toLowerCase().includes("no location")),
        );

        // Create a map of OG entries by date and count
        const ogMap = new Map();
        ogCollections.forEach((og) => {
          const key = `${og.collectionDate}-${og.individualSandwiches}`;
          if (!ogMap.has(key)) {
            ogMap.set(key, []);
          }
          ogMap.get(key).push(og);
        });

        // Find matching early collections and mark older/duplicate entries for deletion
        earlyCollections.forEach((early) => {
          const key = `${early.collectionDate}-${early.individualSandwiches}`;
          if (ogMap.has(key)) {
            const ogEntries = ogMap.get(key);
            // If we have matching OG entries, mark the early collection for deletion
            // as OG entries are the authoritative historical record
            collectionsToDelete.push(early);
          }
        });

        // Also check for duplicate OG entries with same date/count and keep only the newest
        ogMap.forEach((ogGroup) => {
          if (ogGroup.length > 1) {
            const sorted = ogGroup.sort(
              (a, b) =>
                new Date(b.submittedAt).getTime() -
                new Date(a.submittedAt).getTime(),
            );
            collectionsToDelete.push(...sorted.slice(1)); // Keep newest, delete duplicates
          }
        });
      } else if (mode === "suspicious") {
        // Remove entries with suspicious patterns
        collectionsToDelete = collections.filter((collection) => {
          const hostName = collection.hostName.toLowerCase();
          return (
            hostName.startsWith("loc ") ||
            hostName.match(/^group \d-\d$/) ||
            hostName.match(/^group \d+$/) || // Matches "Group 8", "Group 1", etc.
            hostName.includes("test") ||
            hostName.includes("duplicate")
          );
        });
      }

      let deletedCount = 0;
      const errors = [];

      // Delete in reverse order by ID to maintain consistency
      const sortedCollections = collectionsToDelete.sort((a, b) => b.id - a.id);

      for (const collection of sortedCollections) {
        try {
          // Ensure ID is a valid number
          const id = Number(collection.id);
          if (isNaN(id)) {
            errors.push(`Invalid collection ID: ${collection.id}`);
            continue;
          }

          const deleted = await storage.deleteSandwichCollection(id);
          if (deleted) {
            deletedCount++;
          }
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : "Unknown error";
          errors.push(
            `Failed to delete collection ${collection.id}: ${errorMessage}`,
          );
          console.error(`Failed to delete collection ${collection.id}:`, error);
        }
      }

      res.json({
        message: `Successfully cleaned ${deletedCount} duplicate entries using ${mode} mode`,
        deletedCount,
        totalRequested: collectionsToDelete.length,
        errors: errors.length > 0 ? errors.slice(0, 5) : undefined,
      });
    } catch (error) {
      console.error("Failed to clean duplicates", error);
      res.status(500).json({ message: "Failed to clean duplicate entries" });
    }
  });

  app.delete(
    "/api/sandwich-collections/:id",
    requirePermission("COLLECTIONS_DELETE"),
    async (req, res) => {
      try {
        const id = parseInt(req.params.id);
        if (isNaN(id)) {
          return res.status(400).json({ message: "Invalid collection ID" });
        }

        const deleted = await storage.deleteSandwichCollection(id);
        if (!deleted) {
          return res.status(404).json({ message: "Collection not found" });
        }

        // Invalidate cache when collection is deleted
        QueryOptimizer.invalidateCache("sandwich-collections");

        res.status(204).send();
      } catch (error) {
        logger.error("Failed to delete sandwich collection", error);
        res.status(500).json({ message: "Failed to delete collection" });
      }
    },
  );

  // Analyze duplicates in sandwich collections
  app.get("/api/sandwich-collections/analyze-duplicates", async (req, res) => {
    try {
      const collections = await storage.getAllSandwichCollections();

      // Group by date, host, and sandwich counts to find exact duplicates
      const duplicateGroups = new Map();
      const suspiciousPatterns = [];
      const ogDuplicates = [];

      collections.forEach((collection) => {
        const key = `${collection.collectionDate}-${collection.hostName}-${collection.individualSandwiches}-${collection.groupCollections}`;

        if (!duplicateGroups.has(key)) {
          duplicateGroups.set(key, []);
        }
        duplicateGroups.get(key).push(collection);

        // Check for suspicious patterns - ONLY truly problematic entries
        const hostName = (collection.hostName || "").toLowerCase().trim();
        if (
          hostName.startsWith("loc ") ||
          hostName.match(/^group \d+(-\d+)?$/) ||
          hostName.match(/^loc\d+$/) ||
          hostName === "test" ||
          hostName.includes("test") ||
          hostName.includes("duplicate") ||
          hostName.includes("unknown") ||
          hostName.includes("no location") ||
          hostName === "" ||
          hostName === "null" ||
          // Check for obviously incorrect host names
          hostName.length < 3 ||
          hostName.match(/^\d+$/) || // Pure numbers
          hostName.match(/^[a-z]{1,2}$/) // Single/double letters
        ) {
          suspiciousPatterns.push(collection);
        }
      });

      // Find OG Sandwich Project duplicates with early collections
      const ogCollections = collections.filter(
        (c) => c.hostName === "OG Sandwich Project",
      );
      const earlyCollections = collections.filter(
        (c) =>
          c.hostName !== "OG Sandwich Project" &&
          (c.hostName === "" ||
            c.hostName === null ||
            c.hostName.trim() === "" ||
            c.hostName.toLowerCase().includes("unknown") ||
            c.hostName.toLowerCase().includes("no location")),
      );

      const ogMap = new Map();
      ogCollections.forEach((og) => {
        const key = `${og.collectionDate}-${og.individualSandwiches}`;
        if (!ogMap.has(key)) {
          ogMap.set(key, []);
        }
        ogMap.get(key).push(og);
      });

      earlyCollections.forEach((early) => {
        const key = `${early.collectionDate}-${early.individualSandwiches}`;
        if (ogMap.has(key)) {
          const ogEntries = ogMap.get(key);
          ogDuplicates.push({
            ogEntry: ogEntries[0],
            earlyEntry: early,
            reason: "Same date and sandwich count as OG Project entry",
          });
        }
      });

      // Also find duplicate OG entries
      ogMap.forEach((ogGroup) => {
        if (ogGroup.length > 1) {
          const sorted = ogGroup.sort(
            (a, b) =>
              new Date(b.submittedAt).getTime() -
              new Date(a.submittedAt).getTime(),
          );
          sorted.slice(1).forEach((duplicate) => {
            ogDuplicates.push({
              ogEntry: sorted[0],
              duplicateOgEntry: duplicate,
              reason: "Duplicate OG Project entry",
            });
          });
        }
      });

      // Find actual duplicates (groups with more than 1 entry)
      const duplicates = Array.from(duplicateGroups.values())
        .filter((group) => group.length > 1)
        .map((group) => ({
          entries: group,
          count: group.length,
          keepNewest: group.sort(
            (a, b) =>
              new Date(b.submittedAt).getTime() -
              new Date(a.submittedAt).getTime(),
          )[0],
          toDelete: group.slice(1),
        }));

      res.json({
        totalCollections: collections.length,
        duplicateGroups: duplicates.length,
        totalDuplicateEntries: duplicates.reduce(
          (sum, group) => sum + group.toDelete.length,
          0,
        ),
        suspiciousPatterns: suspiciousPatterns.length,
        ogDuplicates: ogDuplicates.length,
        duplicates,
        suspiciousEntries: suspiciousPatterns,
        ogDuplicateEntries: ogDuplicates,
      });
    } catch (error) {
      logger.error("Failed to analyze duplicates", error);
      res.status(500).json({ message: "Failed to analyze duplicates" });
    }
  });

  // Clean selected suspicious entries from sandwich collections
  app.delete("/api/sandwich-collections/clean-selected", 
    requirePermission("DATA_EXPORT"),
    async (req, res) => {
    try {
      const { ids } = req.body;
      
      if (!Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({ message: "Invalid or empty IDs array" });
      }

      let deletedCount = 0;
      for (const id of ids) {
        try {
          await storage.deleteSandwichCollection(id);
          deletedCount++;
        } catch (error) {
          logger.warn(`Failed to delete collection ${id}:`, error);
        }
      }

      res.json({ 
        message: `Successfully deleted ${deletedCount} selected entries`,
        deletedCount 
      });
    } catch (error) {
      logger.error("Failed to delete selected suspicious entries:", error);
      res.status(500).json({ message: "Failed to delete selected entries" });
    }
  });



  // Clean duplicates from sandwich collections
  app.delete("/api/sandwich-collections/clean-duplicates", 
    requirePermission("DATA_EXPORT"),
    async (req, res) => {
    try {
      const { mode = "exact" } = req.body; // 'exact', 'suspicious', or 'og-duplicates'
      const collections = await storage.getAllSandwichCollections();

      let collectionsToDelete = [];

      if (mode === "exact") {
        // Find exact duplicates based on date, host, and counts
        const duplicateGroups = new Map();

        collections.forEach((collection) => {
          const key = `${collection.collectionDate}-${collection.hostName}-${collection.individualSandwiches}-${collection.groupCollections}`;

          if (!duplicateGroups.has(key)) {
            duplicateGroups.set(key, []);
          }
          duplicateGroups.get(key).push(collection);
        });

        // Keep only the newest entry from each duplicate group
        duplicateGroups.forEach((group) => {
          if (group.length > 1) {
            const sorted = group.sort(
              (a, b) =>
                new Date(b.submittedAt).getTime() -
                new Date(a.submittedAt).getTime(),
            );
            collectionsToDelete.push(...sorted.slice(1)); // Keep first (newest), delete rest
          }
        });
      } else if (mode === "suspicious") {
        // Remove entries with suspicious patterns (improved detection)
        collectionsToDelete = collections.filter((collection) => {
          const hostName = (collection.hostName || "").toLowerCase().trim();
          return (
            hostName.startsWith("loc ") ||
            hostName.startsWith("group ") ||
            hostName.match(/^group \d+(-\d+)?$/) ||
            hostName.match(/^loc\d+$/) ||
            hostName === "groups" ||
            hostName === "test" ||
            hostName.includes("test") ||
            hostName.includes("duplicate") ||
            hostName.includes("unknown") ||
            hostName.includes("no location") ||
            hostName === "" ||
            hostName === "null" ||
            // Check for obviously incorrect host names
            hostName.length < 3 ||
            hostName.match(/^\d+$/) || // Pure numbers
            hostName.match(/^[a-z]{1,2}$/) // Single/double letters
          );
        });
      }

      let deletedCount = 0;
      const errors = [];

      // Delete in reverse order by ID to maintain consistency
      const sortedCollections = collectionsToDelete.sort((a, b) => b.id - a.id);

      for (const collection of sortedCollections) {
        try {
          // Ensure ID is a valid number
          const id = Number(collection.id);
          if (isNaN(id)) {
            errors.push(`Invalid collection ID: ${collection.id}`);
            continue;
          }

          const deleted = await storage.deleteSandwichCollection(id);
          if (deleted) {
            deletedCount++;
          }
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : "Unknown error";
          errors.push(
            `Failed to delete collection ${collection.id}: ${errorMessage}`,
          );
          console.error(`Failed to delete collection ${collection.id}:`, error);
        }
      }

      res.json({
        message: `Successfully cleaned ${deletedCount} duplicate entries using ${mode} mode`,
        deletedCount,
        totalFound: collectionsToDelete.length,
        errors: errors.length > 0 ? errors.slice(0, 5) : undefined,
        mode,
      });
    } catch (error) {
      logger.error("Failed to clean duplicates", error);
      res.status(500).json({ message: "Failed to clean duplicate entries" });
    }
  });

  // Batch edit sandwich collections
  app.patch(
    "/api/sandwich-collections/batch-edit",
    requirePermission("DATA_EXPORT"),
    async (req, res) => {
      try {
        const { ids, updates } = req.body;

        if (!Array.isArray(ids) || ids.length === 0) {
          return res
            .status(400)
            .json({ message: "Invalid or empty IDs array" });
        }

        if (!updates || Object.keys(updates).length === 0) {
          return res.status(400).json({ message: "No updates provided" });
        }

        let updatedCount = 0;
        const errors = [];

        for (const id of ids) {
          try {
            const updated = await storage.updateSandwichCollection(id, updates);
            if (updated) {
              updatedCount++;
            } else {
              errors.push(`Collection with ID ${id} not found`);
            }
          } catch (error) {
            errors.push(
              `Failed to update collection ${id}: ${error instanceof Error ? error.message : "Unknown error"}`,
            );
          }
        }

        res.json({
          message: `Successfully updated ${updatedCount} of ${ids.length} collections`,
          updatedCount,
          totalRequested: ids.length,
          errors: errors.length > 0 ? errors.slice(0, 5) : undefined,
        });
      } catch (error) {
        logger.error("Failed to batch edit collections", error);
        res.status(500).json({ message: "Failed to batch edit collections" });
      }
    },
  );

  // CSV Import for Sandwich Collections
  app.post(
    "/api/import-collections",
    upload.single("csvFile"),
    async (req, res) => {
      try {
        if (!req.file) {
          return res.status(400).json({ message: "No CSV file uploaded" });
        }

        const csvContent = await fs.readFile(req.file.path, "utf-8");
        logger.info(`CSV content preview: ${csvContent.substring(0, 200)}...`);

        // Detect CSV format type
        const lines = csvContent.split("\n");
        let formatType = "standard";

        // Check for complex weekly totals format
        if (lines[0].includes("WEEK #") || lines[0].includes("Hosts:")) {
          formatType = "complex";
        }
        // Check for structured weekly data format
        else if (
          lines[0].includes("Week_Number") &&
          lines[0].includes("Total_Sandwiches")
        ) {
          formatType = "structured";
        }

        let records = [];

        if (formatType === "complex") {
          logger.info("Complex weekly totals format detected");
          // Find the row with actual data (skip header rows)
          let startRow = 0;
          for (let i = 0; i < lines.length; i++) {
            if (lines[i].match(/^\d+,/) && lines[i].includes("TRUE")) {
              startRow = i;
              break;
            }
          }

          // Parse the complex format manually
          for (let i = startRow; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line || !line.includes("TRUE")) continue;

            const parts = line.split(",");
            if (parts.length >= 5 && parts[4]) {
              const weekNum = parts[0];
              const date = parts[3];
              const totalSandwiches = parts[4].replace(/[",]/g, "");

              if (
                date &&
                totalSandwiches &&
                !isNaN(parseInt(totalSandwiches))
              ) {
                records.push({
                  "Host Name": `Week ${weekNum} Total`,
                  "Sandwich Count": totalSandwiches,
                  Date: date,
                  "Logged By": "CSV Import",
                  Notes: `Weekly total import from complex spreadsheet`,
                  "Created At": new Date().toISOString(),
                });
              }
            }
          }
        } else if (formatType === "structured") {
          logger.info("Structured weekly data format detected");
          // Parse the structured format
          const parsedData = parse(csvContent, {
            columns: true,
            skip_empty_lines: true,
            trim: true,
            delimiter: ",",
            quote: '"',
          });

          // Convert structured data to standard format
          for (const row of parsedData) {
            if (
              row.Week_Number &&
              row.Date &&
              row.Total_Sandwiches &&
              parseInt(row.Total_Sandwiches) > 0
            ) {
              // Parse the date to a more readable format
              const date = new Date(row.Date);
              const formattedDate = date.toISOString().split("T")[0]; // YYYY-MM-DD format

              records.push({
                "Host Name": `Week ${row.Week_Number} Complete Data`,
                "Sandwich Count": row.Total_Sandwiches,
                Date: formattedDate,
                "Logged By": "CSV Import",
                Notes: `Structured weekly data import with location and group details`,
                "Created At": new Date().toISOString(),
              });
            }
          }
        } else {
          logger.info("Standard CSV format detected");
          // Parse normal CSV format
          records = parse(csvContent, {
            columns: true,
            skip_empty_lines: true,
            trim: true,
            delimiter: ",",
            quote: '"',
          });
        }

        logger.info(`Parsed ${records.length} records`);
        if (records.length > 0) {
          logger.info(`First record: ${JSON.stringify(records[0])}`);
        }

        let successCount = 0;
        let errorCount = 0;
        const errors: string[] = [];

        // Process each record
        for (let i = 0; i < records.length; i++) {
          const record = records[i];

          try {
            // Debug log the record structure
            logger.info(`Processing row ${i + 1}:`, {
              record: JSON.stringify(record),
            });

            // Check for alternative column names
            const hostName =
              record["Host Name"] ||
              record["Host"] ||
              record["host_name"] ||
              record["HostName"];
            const sandwichCountStr =
              record["Individual Sandwiches"] ||
              record["Sandwich Count"] ||
              record["Count"] ||
              record["sandwich_count"] ||
              record["SandwichCount"] ||
              record["Sandwiches"];
            const date =
              record["Collection Date"] ||
              record["Date"] ||
              record["date"] ||
              record["CollectionDate"];

            // Validate required fields with more detailed error reporting
            if (!hostName) {
              const availableKeys = Object.keys(record).join(", ");
              throw new Error(
                `Missing Host Name (available columns: ${availableKeys}) in row ${i + 1}`,
              );
            }
            if (!sandwichCountStr) {
              const availableKeys = Object.keys(record).join(", ");
              throw new Error(
                `Missing Individual Sandwiches (available columns: ${availableKeys}) in row ${i + 1}`,
              );
            }
            if (!date) {
              const availableKeys = Object.keys(record).join(", ");
              throw new Error(
                `Missing Collection Date (available columns: ${availableKeys}) in row ${i + 1}`,
              );
            }

            // Parse sandwich count as integer
            const sandwichCount = parseInt(sandwichCountStr.toString().trim());
            if (isNaN(sandwichCount)) {
              throw new Error(
                `Invalid sandwich count "${sandwichCountStr}" in row ${i + 1}`,
              );
            }

            // Parse dates
            let collectionDate = date;
            let submittedAt = new Date();

            // Try to parse Created At if provided
            const createdAt =
              record["Created At"] ||
              record["created_at"] ||
              record["CreatedAt"];
            if (createdAt) {
              const parsedDate = new Date(createdAt);
              if (!isNaN(parsedDate.getTime())) {
                submittedAt = parsedDate;
              }
            }

            // Handle Group Collections data
            const groupCollectionsStr = record["Group Collections"] || "";
            let groupCollections = "[]";
            if (groupCollectionsStr && groupCollectionsStr.trim() !== "") {
              // If it's a number, convert to simple array format
              const groupCount = parseInt(groupCollectionsStr.trim());
              if (!isNaN(groupCount) && groupCount > 0) {
                groupCollections = JSON.stringify([
                  { count: groupCount, description: "Group Collection" },
                ]);
              }
            }

            // Create sandwich collection
            await storage.createSandwichCollection({
              hostName: hostName.trim(),
              individualSandwiches: sandwichCount,
              collectionDate: collectionDate.trim(),
              groupCollections: groupCollections,
              submittedAt: submittedAt,
            });

            successCount++;
          } catch (error) {
            errorCount++;
            const errorMsg = `Row ${i + 1}: ${error instanceof Error ? error.message : "Unknown error"}`;
            errors.push(errorMsg);
            logger.error(errorMsg);
          }
        }

        // Clean up uploaded file
        await fs.unlink(req.file.path);

        const result = {
          totalRecords: records.length,
          successCount,
          errorCount,
          errors: errors.slice(0, 10), // Return first 10 errors
        };

        logger.info(
          `CSV import completed: ${successCount}/${records.length} records imported`,
        );
        res.json(result);
      } catch (error) {
        // Clean up uploaded file if it exists
        if (req.file?.path) {
          try {
            await fs.unlink(req.file.path);
          } catch (cleanupError) {
            logger.error("Failed to clean up uploaded file", cleanupError);
          }
        }

        logger.error("CSV import failed", error);
        res.status(500).json({
          message: "Failed to import CSV file",
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    },
  );

  // Meeting Minutes
  app.get("/api/meeting-minutes", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub || req.user?.id;
      if (!userId) {
        return res.status(401).json({ message: "User ID not found" });
      }
      const user = await storage.getUser(userId);

      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const limit = req.query.limit
        ? parseInt(req.query.limit as string)
        : undefined;
      const minutes = limit
        ? await storage.getRecentMeetingMinutes(limit)
        : await storage.getAllMeetingMinutes();

      // Filter meeting minutes based on user role and committee membership
      if (
        user.role === "admin" ||
        user.role === "admin_coordinator" ||
        user.role === "admin_viewer"
      ) {
        // Admins see all meeting minutes
        res.json(minutes);
      } else if (user.role === "committee_member") {
        // Committee members only see minutes for their committees
        const userCommittees = await storage.getUserCommittees(userId);
        const committeeTypes = userCommittees.map(
          (membership) => membership.membership.committeeId,
        );

        const filteredMinutes = minutes.filter(
          (minute) =>
            !minute.committeeType || // General meeting minutes (no committee assignment)
            committeeTypes.includes(minute.committeeType),
        );
        res.json(filteredMinutes);
      } else {
        // Other roles see general meeting minutes and their role-specific minutes
        const filteredMinutes = minutes.filter(
          (minute) =>
            !minute.committeeType || // General meeting minutes
            minute.committeeType === user.role,
        );
        res.json(filteredMinutes);
      }
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch meeting minutes" });
    }
  });

  app.post("/api/meeting-minutes", async (req, res) => {
    try {
      const minutesData = insertMeetingMinutesSchema.parse(req.body);
      const minutes = await storage.createMeetingMinutes(minutesData);
      res.status(201).json(minutes);
    } catch (error) {
      res.status(400).json({ message: "Invalid meeting minutes data" });
    }
  });

  app.delete("/api/meeting-minutes/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const success = await storage.deleteMeetingMinutes(id);

      if (success) {
        logger.info("Meeting minutes deleted", {
          minutesId: id,
          method: req.method,
          url: req.url,
          ip: req.ip,
        });
        res.json({
          success: true,
          message: "Meeting minutes deleted successfully",
        });
      } else {
        res.status(404).json({ message: "Meeting minutes not found" });
      }
    } catch (error: any) {
      logger.error("Failed to delete meeting minutes", error);
      res.status(500).json({ message: "Failed to delete meeting minutes" });
    }
  });

  // Meeting minutes file upload endpoint
  app.post(
    "/api/meeting-minutes/upload",
    meetingMinutesUpload.single("file"),
    async (req, res) => {
      try {
        const { meetingId, title, date, summary, googleDocsUrl } = req.body;

        if (!meetingId || !title || !date) {
          return res.status(400).json({
            message: "Missing required fields: meetingId, title, date",
          });
        }

        let finalSummary = summary;
        let documentContent = "";

        // Handle file upload and store file
        if (req.file) {
          logger.info("Meeting minutes file uploaded", {
            filename: req.file.filename,
            originalname: req.file.originalname,
            size: req.file.size,
            meetingId: meetingId,
          });

          try {
            // Create permanent storage path with consistent filename
            const uploadsDir = path.join(
              process.cwd(),
              "uploads",
              "meeting-minutes",
            );
            await fs.mkdir(uploadsDir, { recursive: true });

            // Generate a consistent filename using the multer-generated filename
            const permanentFilename = req.file.filename;
            const permanentPath = path.join(uploadsDir, permanentFilename);
            await fs.copyFile(req.file.path, permanentPath);

            // Determine file type
            let fileType = "unknown";
            if (req.file.mimetype === "application/pdf") {
              fileType = "pdf";
              finalSummary = `PDF document: ${req.file.originalname}`;
            } else if (
              req.file.mimetype ===
                "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
              req.file.originalname.toLowerCase().endsWith(".docx")
            ) {
              fileType = "docx";
              finalSummary = `DOCX document: ${req.file.originalname}`;
            } else if (
              req.file.mimetype === "application/msword" ||
              req.file.originalname.toLowerCase().endsWith(".doc")
            ) {
              fileType = "doc";
              finalSummary = `DOC document: ${req.file.originalname}`;
            } else {
              finalSummary = `Document: ${req.file.originalname}`;
            }

            // Store file metadata for later retrieval
            req.fileMetadata = {
              fileName: req.file.originalname,
              filePath: permanentPath,
              fileType: fileType,
              mimeType: req.file.mimetype,
            };

            // Clean up temporary file
            await fs.unlink(req.file.path);
          } catch (fileError) {
            logger.error("Failed to store document file", fileError);
            finalSummary = `Document uploaded: ${req.file.originalname} (storage failed)`;
            // Clean up uploaded file even if storage failed
            try {
              await fs.unlink(req.file.path);
            } catch (unlinkError) {
              logger.error("Failed to clean up uploaded file", unlinkError);
            }
          }
        }

        // Handle Google Docs URL
        if (googleDocsUrl) {
          finalSummary = `Google Docs link: ${googleDocsUrl}`;
        }

        if (!finalSummary) {
          return res
            .status(400)
            .json({ message: "Must provide either a file or Google Docs URL" });
        }

        // Create meeting minutes record
        const minutesData = {
          title,
          date,
          summary: finalSummary,
          fileName: req.fileMetadata?.fileName || null,
          filePath: req.fileMetadata?.filePath || null,
          fileType:
            req.fileMetadata?.fileType ||
            (googleDocsUrl ? "google_docs" : "text"),
          mimeType: req.fileMetadata?.mimeType || null,
        };

        const minutes = await storage.createMeetingMinutes(minutesData);

        logger.info("Meeting minutes created successfully", {
          minutesId: minutes.id,
          meetingId: meetingId,
          method: req.method,
          url: req.url,
          ip: req.ip,
        });

        res.status(201).json({
          success: true,
          message: "Meeting minutes uploaded successfully",
          minutes: minutes,
          filename: req.file?.originalname,
          extractedContent: documentContent ? true : false,
        });
      } catch (error: any) {
        logger.error("Failed to upload meeting minutes", error);
        res.status(500).json({
          message: "Failed to upload meeting minutes",
          error: error.message,
        });
      }
    },
  );

  // File serving endpoint for meeting minutes documents by ID
  app.get(
    "/api/meeting-minutes/:id/file",
    isAuthenticated,
    async (req: any, res) => {
      try {
        const minutesId = parseInt(req.params.id);
        if (isNaN(minutesId)) {
          return res
            .status(400)
            .json({ message: "Invalid meeting minutes ID" });
        }

        // Get all meeting minutes and find the specific one
        const allMinutes = await storage.getAllMeetingMinutes();
        const minutes = allMinutes.find((m: any) => m.id === minutesId);
        if (!minutes) {
          return res.status(404).json({ message: "Meeting minutes not found" });
        }

        if (!minutes.filePath) {
          return res
            .status(404)
            .json({ message: "No file associated with these meeting minutes" });
        }

        // Debug logging
        logger.info("Meeting minutes file debug", {
          minutesId,
          storedFilePath: minutes.filePath,
          fileName: minutes.fileName,
        });

        // Handle both absolute and relative paths
        const filePath = path.isAbsolute(minutes.filePath)
          ? minutes.filePath
          : path.join(process.cwd(), minutes.filePath);

        // Check if file exists
        try {
          await fs.access(filePath);
        } catch (error) {
          logger.error("File access failed", {
            filePath,
            storedPath: minutes.filePath,
            error: error.message,
          });
          return res.status(404).json({ message: "File not found on disk" });
        }

        // Get file info
        const stats = await fs.stat(filePath);

        // Detect actual file type by reading first few bytes
        const buffer = Buffer.alloc(50);
        const fd = await fs.open(filePath, "r");
        await fd.read(buffer, 0, 50, 0);
        await fd.close();

        let contentType = "application/octet-stream";
        const fileHeader = buffer.toString("utf8", 0, 20);

        if (fileHeader.startsWith("%PDF")) {
          contentType = "application/pdf";
        } else if (
          fileHeader.includes("[Content_Types].xml") ||
          fileHeader.startsWith("PK")
        ) {
          // This is a Microsoft Office document (DOCX, XLSX, etc.)
          if (minutes.fileName.toLowerCase().endsWith(".docx")) {
            contentType =
              "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
          } else if (minutes.fileName.toLowerCase().endsWith(".xlsx")) {
            contentType =
              "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
          } else {
            contentType =
              "application/vnd.openxmlformats-officedocument.wordprocessingml.document"; // Default to DOCX
          }
        }

        logger.info("File type detected", {
          fileName: minutes.fileName,
          detectedType: contentType,
          fileHeader: fileHeader.substring(0, 20),
        });

        // Set appropriate headers
        res.setHeader("Content-Type", contentType);
        res.setHeader("Content-Length", stats.size);
        res.setHeader(
          "Content-Disposition",
          contentType === "application/pdf"
            ? `inline; filename="${minutes.fileName}"`
            : `attachment; filename="${minutes.fileName}"`,
        );

        // Stream the file
        const fileStream = createReadStream(filePath);
        fileStream.pipe(res);
      } catch (error) {
        logger.error("Failed to serve meeting minutes file", error);
        res.status(500).json({ message: "Failed to serve file" });
      }
    },
  );

  // File serving endpoint for meeting minutes documents by filename (legacy)
  app.get("/api/files/:filename", async (req, res) => {
    try {
      const filename = req.params.filename;
      const filePath = path.join(
        process.cwd(),
        "uploads",
        "meeting-minutes",
        filename,
      );

      // Check if file exists
      try {
        await fs.access(filePath);
      } catch {
        return res.status(404).json({ message: "File not found" });
      }

      // Get file info
      const stats = await fs.stat(filePath);
      const fileBuffer = await fs.readFile(filePath);

      // Check file signature to determine actual type (since filename may not have extension)
      let contentType = "application/octet-stream";
      let displayName = filename;

      // Check for PDF signature (%PDF)
      if (
        fileBuffer.length > 4 &&
        fileBuffer.toString("ascii", 0, 4) === "%PDF"
      ) {
        contentType = "application/pdf";
        // Add .pdf extension to display name if not present
        if (!filename.toLowerCase().endsWith(".pdf")) {
          displayName = filename + ".pdf";
        }
      } else {
        // Fallback to extension-based detection
        const ext = path.extname(filename).toLowerCase();
        if (ext === ".pdf") {
          contentType = "application/pdf";
        } else if (ext === ".docx") {
          contentType =
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
        } else if (ext === ".doc") {
          contentType = "application/msword";
        }
      }

      // Set headers for inline display
      res.setHeader("Content-Type", contentType);
      res.setHeader("Content-Length", stats.size);
      res.setHeader("Content-Disposition", `inline; filename="${displayName}"`);
      res.setHeader("Cache-Control", "public, max-age=31536000"); // Cache for 1 year
      res.setHeader("X-Content-Type-Options", "nosniff");

      res.send(fileBuffer);
    } catch (error) {
      logger.error("Failed to serve file", error);
      res.status(500).json({ message: "Failed to serve file" });
    }
  });

  // Drive Links
  app.get("/api/drive-links", async (req, res) => {
    try {
      const links = await storage.getAllDriveLinks();
      res.json(links);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch drive links" });
    }
  });

  // Agenda Items
  app.get("/api/agenda-items", async (req, res) => {
    try {
      const items = await storage.getAllAgendaItems();
      res.json(items);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch agenda items" });
    }
  });

  app.post("/api/agenda-items", async (req, res) => {
    try {
      const itemData = insertAgendaItemSchema.parse(req.body);
      const item = await storage.createAgendaItem(itemData);
      res.status(201).json(item);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res
          .status(400)
          .json({ message: "Invalid agenda item data", errors: error.errors });
      } else {
        res.status(500).json({ message: "Failed to create agenda item" });
      }
    }
  });

  app.patch("/api/agenda-items/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub || req.user?.id;
      if (!userId) {
        return res.status(401).json({ message: "User ID not found" });
      }
      const user = await storage.getUser(userId);

      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Committee members cannot modify agenda item statuses
      if (user.role === "committee_member") {
        return res.status(403).json({
          message: "Committee members cannot modify agenda item statuses",
        });
      }

      const id = parseInt(req.params.id);
      const { status } = req.body;

      if (!["pending", "approved", "rejected", "postponed"].includes(status)) {
        res.status(400).json({ message: "Invalid status" });
        return;
      }

      const updatedItem = await storage.updateAgendaItemStatus(id, status);
      if (!updatedItem) {
        res.status(404).json({ message: "Agenda item not found" });
        return;
      }

      res.json(updatedItem);
    } catch (error) {
      res.status(500).json({ message: "Failed to update agenda item" });
    }
  });

  app.put("/api/agenda-items/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { title, description } = req.body;

      const updatedItem = await storage.updateAgendaItem(id, {
        title,
        description,
      });
      if (!updatedItem) {
        res.status(404).json({ message: "Agenda item not found" });
        return;
      }

      res.json(updatedItem);
    } catch (error) {
      res.status(500).json({ message: "Failed to update agenda item" });
    }
  });

  app.delete(
    "/api/agenda-items/:id",
    isAuthenticated,
    async (req: any, res) => {
      try {
        const userId = req.user?.claims?.sub || req.user?.id;
        if (!userId) {
          return res.status(401).json({ message: "User ID not found" });
        }
        const user = await storage.getUser(userId);

        if (!user) {
          return res.status(404).json({ message: "User not found" });
        }

        // Committee members cannot delete agenda items
        if (user.role === "committee_member") {
          return res
            .status(403)
            .json({ message: "Committee members cannot delete agenda items" });
        }

        const id = parseInt(req.params.id);
        const success = await storage.deleteAgendaItem(id);

        if (!success) {
          res.status(404).json({ message: "Agenda item not found" });
          return;
        }

        res.json({ message: "Agenda item deleted successfully" });
      } catch (error) {
        res.status(500).json({ message: "Failed to delete agenda item" });
      }
    },
  );

  // Meetings
  app.get("/api/current-meeting", async (req, res) => {
    try {
      const meeting = await storage.getCurrentMeeting();
      res.json(meeting);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch current meeting" });
    }
  });

  app.post("/api/meetings", async (req, res) => {
    try {
      const meetingData = insertMeetingSchema.parse(req.body);
      const meeting = await storage.createMeeting(meetingData);
      res.status(201).json(meeting);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res
          .status(400)
          .json({ message: "Invalid meeting data", errors: error.errors });
      } else {
        res.status(500).json({ message: "Failed to create meeting" });
      }
    }
  });

  app.patch("/api/meetings/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid meeting ID" });
      }

      const updates = req.body;
      const updatedMeeting = await storage.updateMeeting(id, updates);

      if (!updatedMeeting) {
        return res.status(404).json({ message: "Meeting not found" });
      }

      res.json(updatedMeeting);
    } catch (error) {
      logger.error("Failed to update meeting", error);
      res.status(500).json({ message: "Failed to update meeting" });
    }
  });

  app.delete("/api/meetings/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid meeting ID" });
      }

      const deleted = await storage.deleteMeeting(id);

      if (!deleted) {
        return res.status(404).json({ message: "Meeting not found" });
      }

      res.status(204).send();
    } catch (error) {
      logger.error("Failed to delete meeting", error);
      res.status(500).json({ message: "Failed to delete meeting" });
    }
  });

  app.post("/api/meetings/:id/upload-agenda", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid meeting ID" });
      }

      // Mark the agenda as uploaded in the meeting record
      const agendaInfo = "agenda_uploaded_" + new Date().toISOString();
      const meeting = await storage.updateMeetingAgenda(id, agendaInfo);

      if (!meeting) {
        return res.status(404).json({ message: "Meeting not found" });
      }

      res.json({
        message: "Agenda uploaded successfully",
        meeting,
      });
    } catch (error) {
      logger.error("Failed to upload agenda", error);
      res.status(500).json({ message: "Failed to upload agenda" });
    }
  });

  // Enhanced Meeting Management Routes for Comprehensive Meeting System

  // Compile meeting agenda with structured sections: Old Business, Urgent Items, Housekeeping, New Business
  app.post("/api/meetings/:id/compile-agenda", isAuthenticated, async (req: any, res) => {
    try {
      if (!hasPermission(req.user, 'manage_meetings')) {
        return res.status(403).json({ error: "Insufficient permissions to compile agenda" });
      }

      const meetingId = parseInt(req.params.id);
      const compiledBy = req.user?.id || 'unknown';

      // Import here to avoid circular dependencies
      const { MeetingAgendaCompiler } = await import('./meeting-agenda-compiler');
      const compiler = new MeetingAgendaCompiler(storage);

      const compiledAgenda = await compiler.compileAgenda(meetingId, compiledBy);
      const compiledAgendaId = await compiler.saveCompiledAgenda(compiledAgenda, compiledBy);

      res.json({
        success: true,
        compiledAgendaId,
        agenda: compiledAgenda,
        message: "Agenda compiled successfully with all sections: Old Business, Urgent Items, Housekeeping, New Business"
      });
    } catch (error) {
      logger.error("Error compiling meeting agenda:", error);
      res.status(500).json({ error: "Failed to compile agenda" });
    }
  });

  // Get compiled agenda for a meeting
  app.get("/api/meetings/:id/compiled-agenda", isAuthenticated, async (req: any, res) => {
    try {
      if (!hasPermission(req.user, 'access_meetings')) {
        return res.status(403).json({ error: "Insufficient permissions to view agenda" });
      }

      const meetingId = parseInt(req.params.id);
      const compiledAgendas = await storage.getCompiledAgendasByMeeting(meetingId);

      if (compiledAgendas.length === 0) {
        return res.status(404).json({ error: "No compiled agenda found for this meeting" });
      }

      // Get the most recent compiled agenda with sections
      const latestAgenda = compiledAgendas[0];
      const sections = await storage.getAgendaSectionsByCompiledAgenda(latestAgenda.id);
      
      res.json({
        ...latestAgenda,
        sections: sections.sort((a, b) => a.orderIndex - b.orderIndex)
      });
    } catch (error) {
      logger.error("Error fetching compiled agenda:", error);
      res.status(500).json({ error: "Failed to fetch compiled agenda" });
    }
  });

  // Export meeting agenda to Google Sheets using Christine's format
  app.post("/api/meetings/:id/export-to-sheets", isAuthenticated, async (req: any, res) => {
    try {
      if (!hasPermission(req.user, 'manage_meetings')) {
        return res.status(403).json({ error: "Insufficient permissions to export to Google Sheets" });
      }

      const meetingId = parseInt(req.params.id);
      const { sheetId } = req.body; // Optional - if provided, will update existing sheet

      // Import Google Sheets exporter
      const { GoogleSheetsMeetingExporter } = await import('./google-sheets-meeting-export');
      const exporter = new GoogleSheetsMeetingExporter(storage);

      const result = await exporter.exportMeetingAgenda(meetingId, sheetId);

      res.json({
        success: true,
        ...result,
        message: "Meeting agenda exported to Google Sheets with precise column mapping"
      });
    } catch (error) {
      logger.error("Error exporting to Google Sheets:", error);
      res.status(500).json({ 
        error: "Failed to export to Google Sheets",
        details: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // Export meeting minutes to Google Sheets
  app.post("/api/meetings/:id/export-minutes-to-sheets", isAuthenticated, async (req: any, res) => {
    try {
      if (!hasPermission(req.user, 'manage_meetings')) {
        return res.status(403).json({ error: "Insufficient permissions to export to Google Sheets" });
      }

      const meetingId = parseInt(req.params.id);
      const { sheetId } = req.body; // Optional

      // Import Google Sheets exporter
      const { GoogleSheetsMeetingExporter } = await import('./google-sheets-meeting-export');
      const exporter = new GoogleSheetsMeetingExporter(storage);

      const result = await exporter.exportMeetingMinutes(meetingId, sheetId);

      res.json({
        success: true,
        ...result,
        message: "Meeting minutes template exported to Google Sheets successfully"
      });
    } catch (error) {
      logger.error("Error exporting minutes to Google Sheets:", error);
      res.status(500).json({ 
        error: "Failed to export minutes to Google Sheets",
        details: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // Download meeting agenda as PDF
  app.get("/api/meetings/:id/download-pdf", isAuthenticated, async (req: any, res) => {
    try {
      if (!hasPermission(req.user, 'access_meetings')) {
        return res.status(403).json({ error: "Insufficient permissions to download meeting agenda" });
      }

      const meetingId = parseInt(req.params.id);
      if (isNaN(meetingId)) {
        return res.status(400).json({ error: "Invalid meeting ID" });
      }

      const meeting = await storage.getMeeting(meetingId);
      if (!meeting) {
        return res.status(404).json({ error: "Meeting not found" });
      }

      // Get compiled agenda if available (optional for PDF generation)
      let compiledAgenda = null;
      try {
        const compiledAgendas = await storage.getCompiledAgendasByMeeting(meetingId);
        if (compiledAgendas.length > 0) {
          const latestAgenda = compiledAgendas[0];
          const sections = await storage.getAgendaSectionsByCompiledAgenda(latestAgenda.id);
          compiledAgenda = {
            ...latestAgenda,
            sections: sections.sort((a, b) => a.orderIndex - b.orderIndex)
          };
        }
      } catch (error) {
        logger.warn("Could not fetch compiled agenda for PDF, using basic agenda structure:", error);
      }

      const { MeetingAgendaPDFGenerator } = await import('./meeting-agenda-pdf-generator');
      const pdfBuffer = await MeetingAgendaPDFGenerator.generatePDF(meeting, compiledAgenda);
      
      // Set appropriate headers for PDF download
      const filename = `${meeting.title.replace(/[^a-zA-Z0-9\s]/g, '_')}_${meeting.date}.pdf`;
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Content-Length', pdfBuffer.length);
      
      res.send(pdfBuffer);
    } catch (error) {
      logger.error('PDF download error:', error);
      res.status(500).json({ error: "Failed to generate meeting agenda PDF" });
    }
  });

  // Finalize compiled agenda
  app.patch("/api/compiled-agendas/:id/finalize", isAuthenticated, async (req: any, res) => {
    try {
      if (!hasPermission(req.user, 'manage_meetings')) {
        return res.status(403).json({ error: "Insufficient permissions to finalize agenda" });
      }

      const compiledAgendaId = parseInt(req.params.id);
      const finalizedBy = req.user?.id || 'unknown';

      const finalizedAgenda = await storage.finalizeCompiledAgenda(compiledAgendaId, finalizedBy);
      
      if (!finalizedAgenda) {
        return res.status(404).json({ error: "Compiled agenda not found" });
      }

      res.json({
        success: true,
        agenda: finalizedAgenda,
        message: "Agenda finalized successfully"
      });
    } catch (error) {
      logger.error("Error finalizing agenda:", error);
      res.status(500).json({ error: "Failed to finalize agenda" });
    }
  });

  // Finalize and export custom agenda as PDF
  app.post("/api/meetings/finalize-agenda-pdf", isAuthenticated, async (req: any, res) => {
    try {
      if (!hasPermission(req.user, 'manage_meetings')) {
        return res.status(403).json({ error: "Insufficient permissions to generate agenda PDF" });
      }

      const agendaData = req.body;
      
      // Validate agenda data structure
      if (!agendaData.meetingDate || !agendaData.agendaProjects) {
        return res.status(400).json({ error: "Invalid agenda data structure - missing meetingDate or agendaProjects" });
      }

      // Log received data for debugging
      console.log('=== PDF GENERATION REQUEST ===');
      console.log('User:', req.user?.email);
      console.log('User permissions count:', req.user?.permissions);
      console.log('Meeting date:', agendaData.meetingDate);
      console.log('Agenda projects count:', agendaData.agendaProjects.length);
      console.log('Tabled projects count:', agendaData.tabledProjects?.length || 0);
      console.log('===============================');

      // Dynamic import for ES modules
      const PDFKit = (await import("pdfkit")).default;
      const doc = new PDFKit({ margin: 50 });

      const chunks: Buffer[] = [];
      doc.on('data', chunk => chunks.push(chunk));
      
      const pdfBuffer = await new Promise<Buffer>((resolve) => {
        doc.on('end', () => resolve(Buffer.concat(chunks)));

        // TSP Brand Colors
        const colors = {
          orange: '#FBAD3F',
          navy: '#236383',
          lightBlue: '#47B3CB',
          darkGray: '#333333',
          lightGray: '#666666',
          white: '#FFFFFF'
        };

        let yPosition = 50;

        // HEADER WITH TSP BRANDING
        doc.fontSize(24).fillColor(colors.navy).text('The Sandwich Project', 50, yPosition);
        doc.fontSize(18).fillColor(colors.orange).text('Meeting Agenda', 50, yPosition + 30);
        
        // Meeting date
        const meetingDate = new Date(agendaData.meetingDate).toLocaleDateString('en-US', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        });
        
        doc.fontSize(14).fillColor(colors.darkGray)
           .text(`Meeting Date: ${meetingDate}`, 50, yPosition + 70)
           .text(`Generated: ${new Date().toLocaleDateString()}`, 50, yPosition + 90);

        yPosition += 140;

        // AGENDA PROJECTS SECTION
        if (agendaData.agendaProjects.length > 0) {
          doc.fontSize(16).fillColor(colors.navy).text('AGENDA ITEMS', 50, yPosition);
          yPosition += 30;

          agendaData.agendaProjects.forEach((project, index) => {
            // Check if we need a new page
            if (yPosition > 650) {
              doc.addPage();
              yPosition = 50;
            }

            // Project header
            doc.fontSize(14).fillColor(colors.navy)
               .text(`${index + 1}. ${project.title}`, 50, yPosition);
            yPosition += 20;

            // Owner and support people
            doc.fontSize(11).fillColor(colors.darkGray);
            if (project.owner && project.owner !== 'Unassigned') {
              doc.text(`Owner: ${project.owner}`, 60, yPosition);
              yPosition += 15;
            }
            if (project.supportPeople) {
              doc.text(`Support: ${project.supportPeople}`, 60, yPosition);
              yPosition += 15;
            }

            // Discussion points
            if (project.discussionPoints) {
              doc.fontSize(10).fillColor(colors.darkGray)
                 .text('Discussion Points:', 60, yPosition);
              yPosition += 12;
              doc.fontSize(9).fillColor(colors.lightGray)
                 .text(project.discussionPoints, 70, yPosition, { width: 470 });
              yPosition += 20;
            }

            // Decision items
            if (project.decisionItems) {
              doc.fontSize(10).fillColor(colors.darkGray)
                 .text('Decisions Needed:', 60, yPosition);
              yPosition += 12;
              doc.fontSize(9).fillColor(colors.lightGray)
                 .text(project.decisionItems, 70, yPosition, { width: 470 });
              yPosition += 20;
            }

            // Tasks (if any exist)
            if (project.tasks && project.tasks.length > 0) {
              // Check if we need a new page for tasks
              if (yPosition > 650) {
                doc.addPage();
                yPosition = 50;
              }

              doc.fontSize(10).fillColor(colors.darkGray)
                 .text('Active Tasks:', 60, yPosition);
              yPosition += 12;

              project.tasks.forEach((task, taskIndex) => {
                // Check if we need a new page for individual tasks
                if (yPosition > 700) {
                  doc.addPage();
                  yPosition = 50;
                }

                // Task status indicator
                const statusIndicator = task.status === 'in-progress' ? '(IP)' : 
                                       task.status === 'pending' ? '(P)' : 
                                       task.status === 'on-hold' ? '(H)' : '';

                doc.fontSize(9).fillColor(colors.lightGray)
                   .text(`• ${task.title} ${statusIndicator}`, 70, yPosition, { width: 460 });
                yPosition += 12;

                // Task assignee
                if (task.assignee && task.assignee !== 'Unassigned') {
                  doc.fontSize(8).fillColor('#666666')
                     .text(`Assigned to: ${task.assignee}`, 80, yPosition, { width: 450 });
                  yPosition += 10;
                }

                // Task description (if available)
                if (task.description) {
                  doc.fontSize(8).fillColor('#888888')
                     .text(`${task.description}`, 80, yPosition, { width: 450 });
                  yPosition += 10;
                }
              });
              yPosition += 10; // Extra space after tasks
            }

            yPosition += 10; // Space between projects
          });
        }

        // TABLED PROJECTS SECTION
        if (agendaData.tabledProjects && agendaData.tabledProjects.length > 0) {
          // Check if we need a new page
          if (yPosition > 600) {
            doc.addPage();
            yPosition = 50;
          }

          yPosition += 20;
          doc.fontSize(16).fillColor(colors.navy).text('TABLED FOR FUTURE MEETINGS', 50, yPosition);
          yPosition += 30;

          agendaData.tabledProjects.forEach((project, index) => {
            if (yPosition > 700) {
              doc.addPage();
              yPosition = 50;
            }

            doc.fontSize(12).fillColor(colors.darkGray)
               .text(`• ${project.title}`, 60, yPosition);
            yPosition += 15;
            
            if (project.owner && project.owner !== 'Unassigned') {
              doc.fontSize(10).fillColor(colors.lightGray)
                 .text(`Owner: ${project.owner}`, 70, yPosition);
              yPosition += 12;
            }
            
            if (project.reason && project.reason !== 'No reason specified') {
              doc.fontSize(9).fillColor(colors.lightGray)
                 .text(`Reason: ${project.reason}`, 70, yPosition, { width: 450 });
              yPosition += 15;
            }
            
            yPosition += 8;
          });
        }

        // Footer
        const pageRange = doc.bufferedPageRange();
        for (let i = pageRange.start; i < pageRange.start + pageRange.count; i++) {
          doc.switchToPage(i);
          doc.fontSize(8).fillColor(colors.lightGray)
             .text(`The Sandwich Project • Meeting Agenda • Page ${i - pageRange.start + 1} of ${pageRange.count}`, 
                    50, doc.page.height - 50, { align: 'center', width: doc.page.width - 100 });
        }

        doc.end();
      });

      // Set response headers for PDF download
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="meeting-agenda-${agendaData.meetingDate}.pdf"`);
      res.setHeader('Content-Length', pdfBuffer.length);
      
      res.send(pdfBuffer);
    } catch (error) {
      logger.error('Finalize agenda PDF error:', error);
      console.error('=== PDF GENERATION ERROR DETAILS ===');
      console.error('Error:', error);
      console.error('Agenda data received:', JSON.stringify(agendaData, null, 2));
      console.error('User permissions:', req.user?.permissions);
      console.error('User ID:', req.user?.id);
      console.error('=====================================');
      
      const errorMessage = error instanceof Error 
        ? `PDF generation failed: ${error.message}`
        : "Failed to generate finalized agenda PDF";
      
      res.status(500).json({ 
        error: errorMessage,
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Get projects marked for review in next meeting
  app.get("/api/projects/for-review", isAuthenticated, requirePermission("PROJECTS_VIEW"), async (req: any, res) => {
    try {
      const projectsForReview = await storage.getProjectsForReview();
      
      res.json(projectsForReview);
    } catch (error) {
      logger.error("Error fetching projects for review:", error);
      res.status(500).json({ error: "Failed to fetch projects for review" });
    }
  });

  // Drivers API endpoints
  app.get("/api/drivers", isAuthenticated, requirePermission("DRIVERS_VIEW"), async (req, res) => {
    try {
      const drivers = await storage.getAllDrivers();
      res.json(drivers);
    } catch (error) {
      logger.error("Failed to get drivers", error);
      res.status(500).json({ message: "Failed to get drivers" });
    }
  });

  app.get("/api/drivers/:id", isAuthenticated, requirePermission("DRIVERS_VIEW"), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const driver = await storage.getDriver(id);
      if (!driver) {
        return res.status(404).json({ message: "Driver not found" });
      }
      res.json(driver);
    } catch (error) {
      logger.error("Failed to get driver", error);
      res.status(500).json({ message: "Failed to get driver" });
    }
  });

  app.post("/api/drivers", isAuthenticated, requirePermission("DRIVERS_EDIT"), sanitizeMiddleware, async (req, res) => {
    try {
      const result = insertDriverSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ message: "Invalid driver data" });
      }
      const driver = await storage.createDriver(result.data);
      res.status(201).json(driver);
    } catch (error) {
      logger.error("Failed to create driver", error);
      res.status(500).json({ message: "Failed to create driver" });
    }
  });

  app.put("/api/drivers/:id", isAuthenticated, requirePermission("DRIVERS_EDIT"), sanitizeMiddleware, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const updates = req.body;
      
      console.log(`🔧 PUT /api/drivers/${id} - Storage update`, { id, updates });

      // Ensure critical boolean fields are properly handled and remove timestamp fields
      const cleanUpdates = {
        ...updates,
        ...(updates.isActive !== undefined && { isActive: Boolean(updates.isActive) }),
        ...(updates.emailAgreementSent !== undefined && { emailAgreementSent: Boolean(updates.emailAgreementSent) }),
        ...(updates.vanApproved !== undefined && { vanApproved: Boolean(updates.vanApproved) }),
        ...(updates.voicemailLeft !== undefined && { voicemailLeft: Boolean(updates.voicemailLeft) }),
        // Remove timestamp fields that cause database issues
        createdAt: undefined,
        updatedAt: undefined
      };

      const driver = await storage.updateDriver(id, cleanUpdates);
      if (!driver) {
        return res.status(404).json({ message: "Driver not found" });
      }
      
      console.log(`✅ Driver ${id} updated successfully via PUT`);
      res.json(driver);
    } catch (error) {
      console.error(`❌ Failed to update driver ${req.params.id} via PUT:`, error);
      logger.error("Failed to update driver", error);
      res.status(500).json({ message: "Failed to update driver" });
    }
  });

  app.delete("/api/drivers/:id", isAuthenticated, requirePermission("DRIVERS_EDIT"), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const success = await storage.deleteDriver(id);
      if (!success) {
        return res.status(404).json({ message: "Driver not found" });
      }
      res.status(204).send();
    } catch (error) {
      logger.error("Failed to delete driver", error);
      res.status(500).json({ message: "Failed to delete driver" });
    }
  });

  // Export drivers to CSV
  app.get("/api/drivers/export", isAuthenticated, requirePermission("DRIVERS_VIEW"), async (req, res) => {
    try {
      const drivers = await storage.getAllDrivers();
      
      // Create CSV headers
      const headers = [
        "Name",
        "Phone", 
        "Email",
        "Zone",
        "Active",
        "Agreement Signed",
        "Van Approved",
        "Home Address",
        "Availability Notes",
        "Email Agreement Sent",
        "Voicemail Left",
        "Inactive Reason",
        "Notes",
        "Created At",
        "Updated At"
      ];

      // Create CSV rows
      const csvRows = [
        headers.join(","),
        ...drivers.map((driver: any) => {
          // Check if driver has signed agreement (look for agreement indicators in notes)
          const hasSignedAgreement = driver.notes && 
            (driver.notes.toLowerCase().includes('agreement: yes') ||
             driver.notes.toLowerCase().includes('agreement signed') ||
             driver.notes.toLowerCase().includes('agreement received'));

          return [
            `"${driver.name || ""}"`,
            `"${driver.phone || ""}"`,
            `"${driver.email || ""}"`, 
            `"${driver.zone || ""}"`,
            driver.isActive ? "Yes" : "No",
            hasSignedAgreement ? "Yes" : "No",
            driver.vanApproved ? "Yes" : "No",
            `"${driver.homeAddress || ""}"`,
            `"${driver.availabilityNotes || ""}"`,
            driver.emailAgreementSent ? "Yes" : "No",
            driver.voicemailLeft ? "Yes" : "No",
            `"${driver.inactiveReason || ""}"`,
            `"${driver.notes || ""}"`,
            `"${driver.createdAt || ""}"`,
            `"${driver.updatedAt || ""}"`
          ].join(",");
        })
      ];

      const csvContent = csvRows.join("\n");
      
      // Set headers for file download
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="drivers-export-${new Date().toISOString().split('T')[0]}.csv"`);
      
      res.send(csvContent);
    } catch (error) {
      logger.error("Failed to export drivers", error);
      res.status(500).json({ message: "Failed to export drivers" });
    }
  });

  // Export hosts to CSV
  app.get("/api/hosts/export", isAuthenticated, requirePermission("access_hosts"), async (req, res) => {
    try {
      const hosts = await storage.getAllHosts();
      
      const headers = [
        "Name",
        "Address",
        "Contact Person",
        "Contact Phone", 
        "Contact Email",
        "Contact Role",
        "Type",
        "Status",
        "Special Instructions",
        "Capacity",
        "Notes",
        "Created At",
        "Updated At"
      ];

      const csvRows = [
        headers.join(","),
        ...hosts.map((host: any) => [
          `"${host.name || ""}"`,
          `"${host.address || ""}"`,
          `"${host.contactPersonName || ""}"`,
          `"${host.contactPersonPhone || ""}"`,
          `"${host.contactPersonEmail || ""}"`,
          `"${host.contactPersonRole || ""}"`,
          `"${host.type || ""}"`,
          `"${host.status || ""}"`,
          `"${host.specialInstructions || ""}"`,
          `"${host.capacity || ""}"`,
          `"${host.notes || ""}"`,
          `"${host.createdAt || ""}"`,
          `"${host.updatedAt || ""}"`
        ].join(","))
      ];

      const csvContent = csvRows.join("\n");
      
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="hosts-export-${new Date().toISOString().split('T')[0]}.csv"`);
      
      res.send(csvContent);
    } catch (error) {
      logger.error("Failed to export hosts", error);
      res.status(500).json({ message: "Failed to export hosts" });
    }
  });

  // Export recipients to CSV
  app.get("/api/recipients/export", isAuthenticated, requirePermission("access_recipients"), async (req, res) => {
    try {
      const recipients = await storage.getAllRecipients();
      
      const headers = [
        "Name",
        "Phone",
        "Email", 
        "Website",
        "Address",
        "Region",
        "Status",
        "Contact Person Name",
        "Contact Person Phone",
        "Contact Person Email",
        "Contact Person Role",
        "Reporting Group",
        "Estimated Sandwiches",
        "Sandwich Type",
        "TSP Contact",
        "Contract Signed",
        "Contract Signed Date",
        "Notes",
        "Created At",
        "Updated At"
      ];

      const csvRows = [
        headers.join(","),
        ...recipients.map((recipient: any) => [
          `"${recipient.name || ""}"`,
          `"${recipient.phone || ""}"`,
          `"${recipient.email || ""}"`,
          `"${recipient.website || ""}"`,
          `"${recipient.address || ""}"`,
          `"${recipient.region || ""}"`,
          `"${recipient.status || ""}"`,
          `"${recipient.contactPersonName || ""}"`,
          `"${recipient.contactPersonPhone || ""}"`,
          `"${recipient.contactPersonEmail || ""}"`,
          `"${recipient.contactPersonRole || ""}"`,
          `"${recipient.reportingGroup || ""}"`,
          `"${recipient.estimatedSandwiches || ""}"`,
          `"${recipient.sandwichType || ""}"`,
          `"${recipient.tspContact || ""}"`,
          recipient.contractSigned ? "Yes" : "No",
          `"${recipient.contractSignedDate || ""}"`,
          `"${recipient.notes || ""}"`,
          `"${recipient.createdAt || ""}"`,
          `"${recipient.updatedAt || ""}"`
        ].join(","))
      ];

      const csvContent = csvRows.join("\n");
      
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="recipients-export-${new Date().toISOString().split('T')[0]}.csv"`);
      
      res.send(csvContent);
    } catch (error) {
      logger.error("Failed to export recipients", error);
      res.status(500).json({ message: "Failed to export recipients" });
    }
  });

  // Export volunteers to CSV
  app.get("/api/volunteers/export", isAuthenticated, requirePermission("access_volunteers"), async (req, res) => {
    try {
      const volunteers = await storage.getAllVolunteers();
      
      const headers = [
        "Name",
        "Email",
        "Phone",
        "Address",
        "Availability",
        "Active",
        "Notes",
        "Created At",
        "Updated At"
      ];

      const csvRows = [
        headers.join(","),
        ...volunteers.map((volunteer: any) => [
          `"${volunteer.name || ""}"`,
          `"${volunteer.email || ""}"`,
          `"${volunteer.phone || ""}"`,
          `"${volunteer.address || ""}"`,
          `"${volunteer.availability || ""}"`,
          volunteer.isActive ? "Yes" : "No",
          `"${volunteer.notes || ""}"`,
          `"${volunteer.createdAt || ""}"`,
          `"${volunteer.updatedAt || ""}"`
        ].join(","))
      ];

      const csvContent = csvRows.join("\n");
      
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="volunteers-export-${new Date().toISOString().split('T')[0]}.csv"`);
      
      res.send(csvContent);
    } catch (error) {
      logger.error("Failed to export volunteers", error);
      res.status(500).json({ message: "Failed to export volunteers" });
    }
  });

  // Export users to CSV (for user management)
  app.get("/api/users/export", isAuthenticated, requirePermission("USERS_EDIT"), async (req, res) => {
    try {
      const users = await storage.getAllUsers();
      
      const headers = [
        "Email",
        "First Name",
        "Last Name",
        "Role",
        "Active",
        "Last Login",
        "Created At",
        "Permissions Count"
      ];

      const csvRows = [
        headers.join(","),
        ...users.map((user: any) => [
          `"${user.email || ""}"`,
          `"${user.firstName || ""}"`,
          `"${user.lastName || ""}"`,
          `"${user.role || ""}"`,
          user.isActive ? "Yes" : "No",
          `"${user.lastLoginAt || ""}"`,
          `"${user.createdAt || ""}"`,
          `"${Array.isArray(user.permissions) ? user.permissions.length : 0}"`
        ].join(","))
      ];

      const csvContent = csvRows.join("\n");
      
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="users-export-${new Date().toISOString().split('T')[0]}.csv"`);
      
      res.send(csvContent);
    } catch (error) {
      logger.error("Failed to export users", error);
      res.status(500).json({ message: "Failed to export users" });
    }
  });

  // PATCH endpoint for partial driver updates (used by frontend)
  app.patch("/api/drivers/:id", sanitizeMiddleware, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const updates = req.body;

      console.log(`🔧 PATCH /api/drivers/${id} - Direct DB update`, { id, updates });

      // Validate that we have some updates to apply
      if (!updates || Object.keys(updates).length === 0) {
        return res.status(400).json({ message: "No updates provided" });
      }

      // Direct database update to bypass storage issues
      const { drivers } = await import("@shared/schema");
      const { eq } = await import("drizzle-orm");
      
      // Clean updates to only include valid driver fields
      const cleanUpdates = {
        ...(updates.name && { name: updates.name }),
        ...(updates.phone && { phone: updates.phone }),
        ...(updates.email && { email: updates.email }),
        ...(updates.address && { address: updates.address }),
        ...(updates.notes !== undefined && { notes: updates.notes }),
        ...(updates.vehicleType && { vehicleType: updates.vehicleType }),
        ...(updates.licenseNumber && { licenseNumber: updates.licenseNumber }),
        ...(updates.availability && { availability: updates.availability }),
        ...(updates.zone && { zone: updates.zone }),
        ...(updates.routeDescription && { routeDescription: updates.routeDescription }),
        ...(updates.hostId !== undefined && { hostId: updates.hostId }),
        ...(updates.homeAddress !== undefined && { homeAddress: updates.homeAddress }),
        ...(updates.availabilityNotes !== undefined && { availabilityNotes: updates.availabilityNotes }),
        ...(updates.isActive !== undefined && { isActive: updates.isActive }),
        ...(updates.emailAgreementSent !== undefined && { emailAgreementSent: updates.emailAgreementSent }),
        ...(updates.vanApproved !== undefined && { vanApproved: updates.vanApproved }),
        ...(updates.voicemailLeft !== undefined && { voicemailLeft: updates.voicemailLeft }),
        ...(updates.inactiveReason !== undefined && { inactiveReason: updates.inactiveReason }),
        updatedAt: new Date()
      };

      const [updatedDriver] = await db.update(drivers)
        .set(cleanUpdates)
        .where(eq(drivers.id, id))
        .returning();
        
      if (!updatedDriver) {
        return res.status(404).json({ message: "Driver not found" });
      }

      console.log(`✅ Driver ${id} updated successfully`);
      res.json(updatedDriver);
    } catch (error) {
      console.error(`❌ Failed to update driver ${req.params.id}:`, error);
      logger.error("Failed to update driver", error);
      res.status(500).json({ message: "Failed to update driver" });
    }
  });

  // DELETE endpoint for drivers
  app.delete("/api/drivers/:id", sanitizeMiddleware, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      console.log(`Deleting driver ${id}`);

      const success = await storage.deleteDriver(id);
      if (!success) {
        return res.status(404).json({ message: "Driver not found" });
      }

      console.log(`Driver ${id} deleted successfully`);
      res.json({ message: "Driver deleted successfully" });
    } catch (error) {
      logger.error("Failed to delete driver", error);
      res.status(500).json({ message: "Failed to delete driver" });
    }
  });

  // Driver Agreements (admin access only)
  app.post("/api/driver-agreements", async (req, res) => {
    try {
      const result = insertDriverAgreementSchema.safeParse(req.body);
      if (!result.success) {
        return res
          .status(400)
          .json({ message: "Invalid driver agreement data" });
      }

      const agreement = await storage.createDriverAgreement(result.data);

      // Send notification email if available
      try {
        await sendDriverAgreementNotification(agreement);
      } catch (emailError) {
        logger.error(
          "Failed to send driver agreement notification",
          emailError,
        );
      }

      res.status(201).json(agreement);
    } catch (error) {
      logger.error("Failed to create driver agreement", error);
      res.status(500).json({ message: "Failed to create driver agreement" });
    }
  });

  // Volunteers API endpoints
  app.get("/api/volunteers", isAuthenticated, requirePermission("access_volunteers"), async (req, res) => {
    try {
      const volunteers = await storage.getAllVolunteers();
      res.json(volunteers);
    } catch (error) {
      logger.error("Failed to get volunteers", error);
      res.status(500).json({ message: "Failed to get volunteers" });
    }
  });

  app.get("/api/volunteers/:id", isAuthenticated, requirePermission("access_volunteers"), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const volunteer = await storage.getVolunteer(id);
      if (!volunteer) {
        return res.status(404).json({ message: "Volunteer not found" });
      }
      res.json(volunteer);
    } catch (error) {
      logger.error("Failed to get volunteer", error);
      res.status(500).json({ message: "Failed to get volunteer" });
    }
  });

  app.post("/api/volunteers", isAuthenticated, requirePermission("manage_volunteers"), sanitizeMiddleware, async (req, res) => {
    try {
      const result = insertVolunteerSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ message: "Invalid volunteer data" });
      }
      const volunteer = await storage.createVolunteer(result.data);
      res.status(201).json(volunteer);
    } catch (error) {
      logger.error("Failed to create volunteer", error);
      res.status(500).json({ message: "Failed to create volunteer" });
    }
  });

  app.put("/api/volunteers/:id", isAuthenticated, requirePermission("manage_volunteers"), sanitizeMiddleware, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const updates = req.body;
      const volunteer = await storage.updateVolunteer(id, updates);
      if (!volunteer) {
        return res.status(404).json({ message: "Volunteer not found" });
      }
      res.json(volunteer);
    } catch (error) {
      logger.error("Failed to update volunteer", error);
      res.status(500).json({ message: "Failed to update volunteer" });
    }
  });

  app.patch("/api/volunteers/:id", sanitizeMiddleware, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const updates = req.body;

      // Validate that we have some updates to apply
      if (!updates || Object.keys(updates).length === 0) {
        return res.status(400).json({ message: "No updates provided" });
      }

      const volunteer = await storage.updateVolunteer(id, updates);
      if (!volunteer) {
        return res.status(404).json({ message: "Volunteer not found" });
      }

      res.json(volunteer);
    } catch (error) {
      logger.error("Failed to update volunteer", error);
      res.status(500).json({ message: "Failed to update volunteer" });
    }
  });

  app.delete("/api/volunteers/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const success = await storage.deleteVolunteer(id);
      if (!success) {
        return res.status(404).json({ message: "Volunteer not found" });
      }
      res.status(204).send();
    } catch (error) {
      logger.error("Failed to delete volunteer", error);
      res.status(500).json({ message: "Failed to delete volunteer" });
    }
  });

  // Get all meetings - this endpoint was missing
  app.get("/api/meetings", isAuthenticated, async (req, res) => {
    try {
      const meetings = await storage.getAllMeetings();
      res.json(meetings);
    } catch (error) {
      logger.error("Failed to get meetings", error);
      res.status(500).json({ message: "Failed to get meetings" });
    }
  });

  // Driver agreement submission route (secure, private)
  app.post("/api/driver-agreements", async (req, res) => {
    try {
      const validatedData = insertDriverAgreementSchema.parse(req.body);

      // Store in database
      const agreement = await storage.createDriverAgreement(validatedData);

      // Send email notification
      const { sendDriverAgreementNotification } = await import("./sendgrid");
      const emailSent = await sendDriverAgreementNotification(agreement);

      if (!emailSent) {
        console.warn(
          "Failed to send email notification for driver agreement:",
          agreement.id,
        );
      }

      // Return success without sensitive data
      res.json({
        success: true,
        message:
          "Driver agreement submitted successfully. You will be contacted soon.",
        id: agreement.id,
      });
    } catch (error: any) {
      console.error("Error submitting driver agreement:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Hosts API endpoints
  app.get("/api/hosts", isAuthenticated, (req, res, next) => {
    // Allow access if user can view hosts OR create collections (since they need hosts for collection forms)
    if (req.user && (
      req.user.permissions.includes("HOSTS_VIEW") || 
      req.user.permissions.includes("COLLECTIONS_ADD")
    )) {
      next();
    } else {
      return res.status(403).json({ message: "Access denied" });
    }
  }, async (req, res) => {
    try {
      const hosts = await storage.getAllHosts();
      res.json(hosts);
    } catch (error) {
      logger.error("Failed to get hosts", error);
      res.status(500).json({ message: "Failed to get hosts" });
    }
  });

  app.get("/api/hosts/:id", isAuthenticated, requirePermission("access_hosts"), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const host = await storage.getHost(id);
      if (!host) {
        return res.status(404).json({ message: "Host not found" });
      }
      res.json(host);
    } catch (error) {
      logger.error("Failed to get host", error);
      res.status(500).json({ message: "Failed to get host" });
    }
  });

  app.post("/api/hosts", requirePermission("DATA_EXPORT"), async (req, res) => {
    try {
      const hostData = insertHostSchema.parse(req.body);
      const host = await storage.createHost(hostData);
      res.status(201).json(host);
    } catch (error) {
      if (error instanceof z.ZodError) {
        logger.warn("Invalid host input", { errors: error.errors, ip: req.ip });
        res
          .status(400)
          .json({ message: "Invalid host data", errors: error.errors });
      } else {
        logger.error("Failed to create host", error);
        res.status(500).json({ message: "Failed to create host" });
      }
    }
  });

  app.put(
    "/api/hosts/:id",
    requirePermission("DATA_EXPORT"),
    async (req, res) => {
      try {
        const id = parseInt(req.params.id);
        const updates = req.body;

        // Get current host info
        const currentHost = await storage.getHost(id);
        if (!currentHost) {
          return res.status(404).json({ message: "Host not found" });
        }

        console.log("Host update request:", {
          currentHostName: currentHost.name,
          newName: updates.name,
        });

        // Check if this is a location reassignment (when the host name matches an existing host)
        const allHosts = await storage.getAllHosts();
        const targetHost = allHosts.find(
          (h) =>
            h.id !== id &&
            h.name.toLowerCase().trim() === updates.name.toLowerCase().trim(),
        );

        if (targetHost) {
          console.log(
            "Reassignment detected: moving contacts from",
            currentHost.name,
            "to",
            targetHost.name,
          );

          // This is a location reassignment - merge contacts to the target host
          const contactsToMove = await storage.getHostContacts(id);
          console.log("Moving", contactsToMove.length, "contacts");

          // Update all contacts to point to the target host
          for (const contact of contactsToMove) {
            console.log(
              "Moving contact:",
              contact.name,
              "from host",
              id,
              "to host",
              targetHost.id,
            );
            await storage.updateHostContact(contact.id, {
              hostId: targetHost.id,
            });
          }

          // Update any sandwich collections that reference the old host name
          const collectionsUpdated = await storage.updateCollectionHostNames(
            currentHost.name,
            targetHost.name,
          );
          console.log(
            "Updated",
            collectionsUpdated,
            "sandwich collection records",
          );

          // Delete the original host since its contacts have been moved
          await storage.deleteHost(id);
          console.log("Deleted original host:", currentHost.name);

          // Return the target host with success message
          res.json({
            ...targetHost,
            message: `Host reassigned successfully. ${contactsToMove.length} contacts moved from "${currentHost.name}" to "${targetHost.name}".`,
          });
        } else {
          // Normal host update
          console.log("Normal host update for:", currentHost.name);
          const host = await storage.updateHost(id, updates);
          if (!host) {
            return res.status(404).json({ message: "Host not found" });
          }
          res.json(host);
        }
      } catch (error) {
        logger.error("Failed to update host", error);
        res.status(500).json({ message: "Failed to update host" });
      }
    },
  );

  app.patch("/api/hosts/:id", async (req, res) => {
    console.log(`🔥 PATCH route hit for host ${req.params.id}`);
    try {
      const id = parseInt(req.params.id);
      const updates = req.body;

      console.log(
        "PATCH host update - ID:",
        id,
        "Updates:",
        JSON.stringify(updates, null, 2),
      );

      // Clean up any problematic timestamp fields that might be strings
      const cleanUpdates = { ...updates };
      if (cleanUpdates.createdAt) delete cleanUpdates.createdAt;
      if (cleanUpdates.updatedAt) delete cleanUpdates.updatedAt;

      console.log("Cleaned updates:", JSON.stringify(cleanUpdates, null, 2));

      const host = await storage.updateHost(id, cleanUpdates);
      if (!host) {
        console.log("Host not found in storage for ID:", id);
        return res.status(404).json({ error: "Host not found" });
      }
      console.log("Host updated successfully:", host);
      res.json(host);
    } catch (error) {
      logger.error("Failed to update host", error);
      console.error("Host update error details:", error);
      res.status(500).json({ error: "Failed to update host" });
    }
  });

  app.delete("/api/hosts/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const deleted = await storage.deleteHost(id);
      if (!deleted) {
        return res.status(404).json({ message: "Host not found" });
      }
      res.status(204).send();
    } catch (error) {
      logger.error("Failed to delete host", error);
      // Check if it's a constraint error (has associated records)
      if (error.message && error.message.includes("associated collection")) {
        return res.status(409).json({ 
          message: error.message,
          error: "Constraint violation - host has associated data"
        });
      }
      res.status(500).json({ message: "Failed to delete host" });
    }
  });

  // Host Contacts
  app.get("/api/host-contacts", async (req, res) => {
    try {
      // Get all host contacts across all hosts
      const hosts = await storage.getAllHosts();
      const allContacts = [];

      for (const host of hosts) {
        const contacts = await storage.getHostContacts(host.id);
        allContacts.push(...contacts);
      }

      res.json(allContacts);
    } catch (error) {
      logger.error("Failed to get all host contacts", error);
      res.status(500).json({ message: "Failed to get host contacts" });
    }
  });

  app.post("/api/host-contacts", async (req, res) => {
    try {
      const contactData = insertHostContactSchema.parse(req.body);
      
      // Standardize role names
      const roleMapping: { [key: string]: string } = {
        'collection site host': 'host',
        'Collection Site Host': 'host',
        'primary': 'host',
        'backup': 'alternate',
        'coordinator': 'host',
        'manager': 'Lead',
        'lead': 'Lead',
        'Lead': 'Lead',
        'host': 'host',
        'alternate': 'alternate',
        'volunteer': 'volunteer',
        'head of school': 'head of school',
        'Head of School': 'head of school'
      };
      
      if (contactData.role) {
        contactData.role = roleMapping[contactData.role] || 'host';
      }
      
      const contact = await storage.createHostContact(contactData);
      res.status(201).json(contact);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res
          .status(400)
          .json({ message: "Invalid host contact data", errors: error.errors });
      } else if (error instanceof Error && error.message.includes("already exists")) {
        res.status(409).json({ 
          message: error.message,
          type: "duplicate_contact"
        });
      } else {
        logger.error("Failed to create host contact", error);
        res.status(500).json({ message: "Failed to create host contact" });
      }
    }
  });

  app.get("/api/hosts/:hostId/contacts", isAuthenticated, requirePermission("access_hosts"), async (req, res) => {
    try {
      const hostId = parseInt(req.params.hostId);
      const contacts = await storage.getHostContacts(hostId);
      res.json(contacts);
    } catch (error) {
      logger.error("Failed to get host contacts", error);
      res.status(500).json({ message: "Failed to get host contacts" });
    }
  });

  app.put("/api/host-contacts/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const updates = req.body;
      const updatedContact = await storage.updateHostContact(id, updates);
      if (!updatedContact) {
        return res.status(404).json({ message: "Host contact not found" });
      }
      res.json(updatedContact);
    } catch (error) {
      logger.error("Failed to update host contact", error);
      res.status(500).json({ message: "Failed to update host contact" });
    }
  });

  app.patch("/api/host-contacts/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const updates = req.body;
      
      console.log(`🔧 PATCH /api/host-contacts/${id} - Direct DB update`, { id, updates });
      
      // Direct database update to bypass storage issues
      const { hostContacts } = await import("@shared/schema");
      const { eq } = await import("drizzle-orm");
      
      // Clean updates to only include valid host contact fields
      const cleanUpdates = {
        ...(updates.name && { name: updates.name }),
        ...(updates.role && { role: updates.role }),
        ...(updates.phone && { phone: updates.phone }),
        ...(updates.email && { email: updates.email }),
        ...(updates.notes !== undefined && { notes: updates.notes }),
        updatedAt: new Date()
      };
      
      const [updatedContact] = await db.update(hostContacts)
        .set(cleanUpdates)
        .where(eq(hostContacts.id, id))
        .returning();
        
      if (!updatedContact) {
        return res.status(404).json({ message: "Host contact not found" });
      }
      
      console.log(`✅ Host contact ${id} updated successfully`);
      res.json(updatedContact);
    } catch (error) {
      console.error(`❌ Failed to update host contact ${req.params.id}:`, error);
      logger.error("Failed to update host contact", error);
      res.status(500).json({ message: "Failed to update host contact" });
    }
  });

  app.delete("/api/host-contacts/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const deleted = await storage.deleteHostContact(id);
      if (!deleted) {
        return res.status(404).json({ message: "Host contact not found" });
      }
      res.status(204).send();
    } catch (error) {
      logger.error("Failed to delete host contact", error);
      res.status(500).json({ message: "Failed to delete host contact" });
    }
  });

  // Optimized endpoint to get all hosts with their contacts in one call
  app.get("/api/hosts-with-contacts", isAuthenticated, requirePermission("access_hosts"), async (req, res) => {
    try {
      const hostsWithContacts = await storage.getAllHostsWithContacts();
      res.json(hostsWithContacts);
    } catch (error) {
      logger.error("Failed to fetch hosts with contacts", error);
      res.status(500).json({ message: "Failed to fetch hosts with contacts" });
    }
  });

  // Get collections by host name
  app.get("/api/collections-by-host/:hostName", async (req, res) => {
    try {
      const hostName = decodeURIComponent(req.params.hostName);
      const collections = await storage.getAllSandwichCollections();

      // Filter collections by host name (case insensitive)
      const hostCollections = collections.filter(
        (collection) =>
          collection.hostName.toLowerCase() === hostName.toLowerCase(),
      );

      res.json(hostCollections);
    } catch (error) {
      logger.error("Failed to fetch collections by host", error);
      res.status(500).json({ message: "Failed to fetch collections by host" });
    }
  });

  // Recipients
  app.get("/api/recipients", isAuthenticated, requirePermission("access_recipients"), async (req, res) => {
    try {
      const recipients = await storage.getAllRecipients();
      res.json(recipients);
    } catch (error) {
      logger.error("Failed to fetch recipients", error);
      res.status(500).json({ message: "Failed to fetch recipients" });
    }
  });

  app.post("/api/recipients", isAuthenticated, requirePermission("manage_recipients"), async (req, res) => {
    try {
      const recipientData = insertRecipientSchema.parse(req.body);
      const recipient = await storage.createRecipient(recipientData);
      res.status(201).json(recipient);
    } catch (error) {
      if (error instanceof z.ZodError) {
        logger.error("Invalid recipient data", error);
        return res.status(400).json({ 
          error: "Invalid data",
          details: error.errors 
        });
      }
      logger.error("Failed to create recipient", error);
      res.status(500).json({ message: "Failed to create recipient" });
    }
  });

  app.put("/api/recipients/:id", isAuthenticated, requirePermission("manage_recipients"), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      
      // Validate the request body using the schema
      const updates = insertRecipientSchema.partial().parse(req.body);
      
      const updatedRecipient = await storage.updateRecipient(id, updates);
      if (!updatedRecipient) {
        return res.status(404).json({ message: "Recipient not found" });
      }
      res.json(updatedRecipient);
    } catch (error) {
      if (error instanceof z.ZodError) {
        logger.error("Invalid recipient data", error);
        res.status(400).json({ 
          message: "Invalid recipient data", 
          errors: error.errors 
        });
      } else {
        logger.error("Failed to update recipient", error);
        res.status(500).json({ message: "Failed to update recipient" });
      }
    }
  });

  app.patch("/api/recipients/:id", isAuthenticated, requirePermission("manage_recipients"), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      
      // Validate the request body using the schema
      const updates = insertRecipientSchema.partial().parse(req.body);
      
      const updatedRecipient = await storage.updateRecipient(id, updates);
      if (!updatedRecipient) {
        return res.status(404).json({ message: "Recipient not found" });
      }
      res.json(updatedRecipient);
    } catch (error) {
      if (error instanceof z.ZodError) {
        logger.error("Invalid recipient data", error);
        res.status(400).json({ 
          message: "Invalid recipient data", 
          errors: error.errors 
        });
      } else {
        logger.error("Failed to update recipient", error);
        res.status(500).json({ message: "Failed to update recipient" });
      }
    }
  });

  app.delete("/api/recipients/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const deleted = await storage.deleteRecipient(id);
      if (!deleted) {
        return res.status(404).json({ message: "Recipient not found" });
      }
      res.status(204).send();
    } catch (error) {
      logger.error("Failed to delete recipient", error);
      res.status(500).json({ message: "Failed to delete recipient" });
    }
  });

  // General Contacts
  app.get("/api/contacts", async (req, res) => {
    try {
      const contacts = await storage.getAllContacts();
      res.json(contacts);
    } catch (error) {
      logger.error("Failed to fetch contacts", error);
      res.status(500).json({ message: "Failed to fetch contacts" });
    }
  });

  app.post("/api/contacts", async (req, res) => {
    try {
      const contactData = insertContactSchema.parse(req.body);
      const contact = await storage.createContact(contactData);
      res.status(201).json(contact);
    } catch (error) {
      logger.error("Failed to create contact", error);
      res.status(400).json({ message: "Invalid contact data" });
    }
  });

  app.put("/api/contacts/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const updates = req.body;
      const updatedContact = await storage.updateContact(id, updates);
      if (!updatedContact) {
        return res.status(404).json({ message: "Contact not found" });
      }
      res.json(updatedContact);
    } catch (error) {
      logger.error("Failed to update contact", error);
      res.status(500).json({ message: "Failed to update contact" });
    }
  });

  app.patch("/api/contacts/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const updates = req.body;
      const updatedContact = await storage.updateContact(id, updates);
      if (!updatedContact) {
        return res.status(404).json({ message: "Contact not found" });
      }
      res.json(updatedContact);
    } catch (error) {
      logger.error("Failed to update contact", error);
      res.status(500).json({ message: "Failed to update contact" });
    }
  });

  app.delete("/api/contacts/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const deleted = await storage.deleteContact(id);
      if (!deleted) {
        return res.status(404).json({ message: "Contact not found" });
      }
      res.status(204).send();
    } catch (error) {
      logger.error("Failed to delete contact", error);
      res.status(500).json({ message: "Failed to delete contact" });
    }
  });

  // Universal contact update endpoint for role changes
  app.put("/api/contacts/universal/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { 
        name, 
        phone, 
        email, 
        address, 
        notes, 
        newRoleType, 
        assignedHostId, 
        volunteerType, 
        zone, 
        vanApproved, 
        originalSource 
      } = req.body;

      // First, update the existing record
      if (originalSource === 'volunteers') {
        const volunteerData = {
          name,
          phone,
          email,
          homeAddress: address,
          notes,
          zone: zone || '',
          volunteerType: volunteerType || 'General'
        };
        await storage.updateVolunteer(id, volunteerData);
      } else if (originalSource === 'drivers') {
        const driverData = {
          name,
          phone,
          email,
          homeAddress: address,
          notes,
          zone: zone || '',
          vanApproved: vanApproved || false
        };
        await storage.updateDriver(id, driverData);
      } else if (originalSource === 'recipients') {
        const recipientData = {
          name,
          phone,
          email,
          address,
          preferences: notes
        };
        await storage.updateRecipient(id, recipientData);
      } else if (originalSource === 'host_contacts') {
        const hostContactData = {
          name,
          phone,
          email,
          notes
        };
        await storage.updateHostContact(id, hostContactData);
      }

      // Handle role type changes - create new records if role is changing
      if (newRoleType && newRoleType !== originalSource) {
        if (newRoleType === 'host_contacts' && assignedHostId) {
          // Create new host contact
          const hostContactData = {
            hostId: parseInt(assignedHostId),
            name,
            role: 'Contact',
            phone,
            email: email || null,
            isPrimary: false,
            notes: notes || null
          };
          await storage.createHostContact(hostContactData);

          // Remove from original source if different
          if (originalSource === 'volunteers') {
            await storage.deleteVolunteer(id);
          } else if (originalSource === 'drivers') {
            await storage.deleteDriver(id);
          }
        } else if (newRoleType === 'volunteers') {
          // Create new volunteer
          const volunteerData = {
            name,
            phone,
            email,
            homeAddress: address || '',
            zone: zone || '',
            volunteerType: volunteerType || 'General',
            notes: notes || '',
            isActive: true
          };
          await storage.createVolunteer(volunteerData);

          // Remove from original source if different
          if (originalSource === 'drivers') {
            await storage.deleteDriver(id);
          } else if (originalSource === 'host_contacts') {
            await storage.deleteHostContact(id);
          }
        } else if (newRoleType === 'drivers') {
          // Create new driver
          const driverData = {
            name,
            phone,
            email,
            zone: zone || '',
            homeAddress: address || '',
            vanApproved: vanApproved || false,
            notes: notes || '',
            isActive: true
          };
          await storage.createDriver(driverData);

          // Remove from original source if different
          if (originalSource === 'volunteers') {
            await storage.deleteVolunteer(id);
          } else if (originalSource === 'host_contacts') {
            await storage.deleteHostContact(id);
          }
        }
      }

      res.json({ message: "Contact updated and role changed successfully" });
    } catch (error) {
      logger.error("Failed to update universal contact", error);
      res.status(500).json({ message: "Failed to update contact" });
    }
  });

  // Contact assignment endpoints
  app.post("/api/contact-assignments", async (req, res) => {
    try {
      const { contactId, targetType, targetId } = req.body;
      
      // Validate input
      if (!contactId || !targetType || !targetId) {
        return res.status(400).json({ message: "Missing required fields: contactId, targetType, targetId" });
      }
      
      if (!['host', 'recipient'].includes(targetType)) {
        return res.status(400).json({ message: "targetType must be 'host' or 'recipient'" });
      }

      // Get the contact details
      const contact = await storage.getContact(contactId);
      if (!contact) {
        return res.status(404).json({ message: "Contact not found" });
      }

      if (targetType === 'host') {
        // Check if this contact is already assigned as a host contact to prevent duplicates
        const existingHostContacts = await storage.getHostContacts();
        const existingAssignment = existingHostContacts.find(hc => 
          hc.email === contact.email && hc.name === contact.name
        );
        
        if (existingAssignment) {
          return res.status(400).json({ 
            message: "This contact is already assigned as a host contact",
            existingAssignment: existingAssignment
          });
        }

        // Link the contact to the host location by creating a host contact record
        const hostContactData = {
          hostId: parseInt(targetId),
          name: contact.name,
          role: contact.role || 'Contact',
          phone: contact.phone,
          email: contact.email || null,
          isPrimary: false,
          notes: `Linked from general contacts - ${contact.notes || ''}`.trim()
        };

        const hostContact = await storage.createHostContact(hostContactData);
        
        // Update the original contact with assignment note
        const assignmentNote = `Linked to host location ID: ${targetId}`;
        await storage.updateContact(contactId, { 
          notes: contact.notes ? `${contact.notes}\n\n${assignmentNote}` : assignmentNote
        });
        
        res.status(201).json({ 
          message: "Contact successfully linked to host location",
          assignment: { contactId, targetType, targetId },
          hostContact: hostContact
        });
      } else {
        // For recipient assignments, just update the contact notes for now
        const assignmentNote = `Assigned to ${targetType}: ${targetId}`;
        const updatedContact = await storage.updateContact(contactId, { 
          notes: contact.notes ? `${contact.notes}\n\n${assignmentNote}` : assignmentNote
        });
        
        res.status(201).json({ 
          message: "Contact assigned successfully",
          assignment: { contactId, targetType, targetId }
        });
      }
    } catch (error) {
      logger.error("Failed to assign contact", error);
      res.status(500).json({ message: "Failed to assign contact" });
    }
  });

  // Import recipients from CSV/XLSX
  app.post(
    "/api/recipients/import",
    importUpload.single("file"),
    async (req, res) => {
      try {
        if (!req.file) {
          return res.status(400).json({ message: "No file uploaded" });
        }

        const fileExtension = req.file.originalname
          .toLowerCase()
          .split(".")
          .pop();
        let records: any[] = [];

        if (fileExtension === "csv") {
          // Parse CSV
          const csvContent = req.file.buffer.toString("utf-8");
          const { parse } = await import("csv-parse/sync");
          records = parse(csvContent, {
            columns: true,
            skip_empty_lines: true,
            trim: true,
          });
        } else if (fileExtension === "xlsx" || fileExtension === "xls") {
          // Parse Excel
          const XLSX = await import("xlsx");
          const workbook = XLSX.read(req.file.buffer, { type: "buffer" });
          const sheetName = workbook.SheetNames[0];
          const sheet = workbook.Sheets[sheetName];
          records = XLSX.utils.sheet_to_json(sheet);
        } else {
          return res.status(400).json({ message: "Unsupported file format" });
        }

        let imported = 0;
        let skipped = 0;
        const errors: string[] = [];

        for (const record of records) {
          try {
            // Normalize column names (case-insensitive)
            const normalizedRecord: any = {};
            Object.keys(record).forEach((key) => {
              const normalizedKey = key.toLowerCase().trim();
              normalizedRecord[normalizedKey] = record[key];
            });

            // Required fields validation - support more column variations
            const name =
              normalizedRecord.name ||
              normalizedRecord["recipient name"] ||
              normalizedRecord["full name"] ||
              normalizedRecord["organization"] ||
              normalizedRecord["org"] ||
              normalizedRecord["client name"];
            const phone =
              normalizedRecord.phone ||
              normalizedRecord["phone number"] ||
              normalizedRecord["mobile"] ||
              normalizedRecord["phone#"] ||
              normalizedRecord["contact phone"];

            if (!name || !phone) {
              errors.push(
                `Row skipped: Missing required fields (name: "${name}", phone: "${phone}")`,
              );
              skipped++;
              continue;
            }

            // Skip empty rows
            if (!String(name).trim() || !String(phone).trim()) {
              skipped++;
              continue;
            }

            // Optional fields with defaults
            const email =
              normalizedRecord.email ||
              normalizedRecord["email address"] ||
              null;
            const address =
              normalizedRecord.address || normalizedRecord.location || null;
            const preferences =
              normalizedRecord.preferences ||
              normalizedRecord.notes ||
              normalizedRecord.dietary ||
              normalizedRecord["sandwich type"] ||
              normalizedRecord["weekly estimate"] ||
              normalizedRecord["tsp contact"] ||
              null;
            const status = normalizedRecord.status || "active";

            // Check for duplicate (by phone number)
            const existingRecipients = await storage.getAllRecipients();
            const phoneToCheck = String(phone).trim().replace(/\D/g, ""); // Remove non-digits for comparison
            const isDuplicate = existingRecipients.some((r) => {
              const existingPhone = r.phone.replace(/\D/g, "");
              return existingPhone === phoneToCheck;
            });

            if (isDuplicate) {
              errors.push(
                `Row skipped: Duplicate phone number "${phoneToCheck}"`,
              );
              skipped++;
              continue;
            }

            // Create recipient
            await storage.createRecipient({
              name: String(name).trim(),
              phone: phoneToCheck,
              email: email ? String(email).trim() : null,
              address: address ? String(address).trim() : null,
              preferences: preferences ? String(preferences).trim() : null,
              status:
                String(status).toLowerCase() === "inactive"
                  ? "inactive"
                  : "active",
            });

            imported++;
          } catch (error) {
            console.error("Import error:", error);
            errors.push(
              `Row skipped: ${error instanceof Error ? error.message : "Unknown error"}`,
            );
            skipped++;
          }
        }

        res.json({
          imported,
          skipped,
          total: records.length,
          errors: errors.slice(0, 10), // Limit error messages
        });
      } catch (error) {
        logger.error("Failed to import recipients", error);
        res.status(500).json({ message: "Failed to process import file" });
      }
    },
  );

  // Import host and driver contacts from Excel/CSV
  app.post(
    "/api/import-contacts",
    importUpload.single("file"),
    async (req, res) => {
      try {
        if (!req.file) {
          return res.status(400).json({ message: "No file uploaded" });
        }

        const fileExtension = req.file.originalname
          .toLowerCase()
          .split(".")
          .pop();
        let records: any[] = [];

        if (fileExtension === "csv") {
          // Parse CSV
          const csvContent = req.file.buffer.toString("utf-8");
          const { parse } = await import("csv-parse/sync");
          records = parse(csvContent, {
            columns: true,
            skip_empty_lines: true,
            trim: true,
          });
        } else if (fileExtension === "xlsx" || fileExtension === "xls") {
          // Parse Excel
          const XLSX = await import("xlsx");
          const workbook = XLSX.read(req.file.buffer, { type: "buffer" });
          const sheetName = workbook.SheetNames[0];
          const sheet = workbook.Sheets[sheetName];
          const rawData = XLSX.utils.sheet_to_json(sheet, { defval: "" });

          // Handle Excel files where headers are in the first data row
          if (rawData.length > 0) {
            const firstRow = rawData[0];
            const hasGenericHeaders = Object.keys(firstRow).some((key) =>
              key.startsWith("__EMPTY"),
            );

            if (hasGenericHeaders && rawData.length > 1) {
              // Use the first row as headers and map the rest of the data
              const headers = Object.values(firstRow) as string[];
              records = rawData.slice(1).map((row) => {
                const mappedRow: any = {};
                const values = Object.values(row) as string[];
                headers.forEach((header, index) => {
                  if (header && header.trim()) {
                    mappedRow[header.trim()] = values[index] || "";
                  }
                });
                return mappedRow;
              });
            } else {
              records = rawData;
            }
          }
        } else {
          return res.status(400).json({ message: "Unsupported file format" });
        }

        let hostsCreated = 0;
        let contactsImported = 0;
        let skipped = 0;
        const errors: string[] = [];

        // Process each record from the Excel file
        for (const record of records) {
          try {
            // Normalize field names (case-insensitive)
            const normalizedRecord: any = {};
            Object.keys(record).forEach((key) => {
              normalizedRecord[key.toLowerCase().trim()] = record[key];
            });

            // Extract host/location information from your Excel structure
            const hostName =
              normalizedRecord.area ||
              normalizedRecord.location ||
              normalizedRecord.host ||
              normalizedRecord["host location"] ||
              normalizedRecord.site ||
              normalizedRecord.venue;

            // Extract contact information - combine first and last name
            const firstName =
              normalizedRecord["first name"] ||
              normalizedRecord.firstname ||
              "";
            const lastName =
              normalizedRecord["last name"] || normalizedRecord.lastname || "";
            const contactName =
              `${firstName} ${lastName}`.trim() ||
              normalizedRecord.name ||
              normalizedRecord["contact name"] ||
              normalizedRecord["driver name"] ||
              normalizedRecord["volunteer name"];

            const phone =
              normalizedRecord.phone ||
              normalizedRecord["phone number"] ||
              normalizedRecord.mobile ||
              normalizedRecord.cell;

            const email =
              normalizedRecord.email ||
              normalizedRecord["email address"] ||
              null;

            const role =
              normalizedRecord.role ||
              normalizedRecord.position ||
              normalizedRecord.type ||
              "Host/Driver";

            // Skip if missing essential data
            if (!hostName || !contactName || !phone) {
              skipped++;
              continue;
            }

            // Find or create host
            const existingHosts = await storage.getAllHosts();
            let host = existingHosts.find(
              (h) =>
                h.name.toLowerCase().trim() ===
                String(hostName).toLowerCase().trim(),
            );

            if (!host) {
              // Create new host
              host = await storage.createHost({
                name: String(hostName).trim(),
                address: normalizedRecord.address || null,
                status: "active",
                notes: null,
              });
              hostsCreated++;
            }

            // Clean phone number
            const cleanPhone = String(phone).trim().replace(/\D/g, "");
            if (cleanPhone.length < 10) {
              errors.push(`Skipped ${contactName}: Invalid phone number`);
              skipped++;
              continue;
            }

            // Check for duplicate contact across the entire system (not just this host)
            const allHostContacts = await storage.getHostContacts();
            const emailMatch = email ? allHostContacts.find(c => c.email === String(email).trim()) : null;
            const phoneMatch = allHostContacts.find(c => c.phone.replace(/\D/g, "") === cleanPhone);
            
            if (emailMatch || phoneMatch) {
              const reason = emailMatch ? "email already exists" : "phone number already exists";
              errors.push(`Skipped ${contactName}: ${reason} in system`);
              skipped++;
              continue;
            }

            // Standardize role names to prevent "Collection Site Host" entries
            const roleMapping: { [key: string]: string } = {
              'collection site host': 'host',
              'Collection Site Host': 'host',
              'primary': 'host',
              'backup': 'alternate',
              'coordinator': 'host',
              'manager': 'Lead',
              'lead': 'Lead',
              'Lead': 'Lead',
              'host': 'host',
              'alternate': 'alternate',
              'volunteer': 'volunteer',
              'head of school': 'head of school',
              'Head of School': 'head of school'
            };

            const standardizedRole = roleMapping[String(role).trim()] || 'host';

            // Create host contact
            await storage.createHostContact({
              hostId: host.id,
              name: String(contactName).trim(),
              role: standardizedRole,
              phone: cleanPhone,
              email: email ? String(email).trim() : null,
              isPrimary: false, // Can be updated manually later
              notes: normalizedRecord.notes || null,
              hostLocation: host.name, // Set location for grouping
            });

            contactsImported++;
          } catch (error) {
            errors.push(
              `Error processing record: ${error instanceof Error ? error.message : "Unknown error"}`,
            );
            skipped++;
          }
        }

        res.json({
          message: "Import completed",
          imported: contactsImported,
          hosts: hostsCreated,
          skipped,
          total: records.length,
          errors: errors.slice(0, 10), // Limit error messages
        });
      } catch (error) {
        logger.error("Failed to import contacts", error);
        res.status(500).json({ message: "Failed to process import file" });
      }
    },
  );

  // Permission system validation test endpoint
  app.get("/api/test-permissions", isAuthenticated, (req: any, res) => {
    try {
      const user = req.user;
      
      if (!user) {
        return res.status(401).json({ error: 'User not authenticated' });
      }

      const permissionTests = [
        { permission: 'host_chat', description: 'host_chat (lowercase)' },
        { permission: 'HOST_CHAT', description: 'HOST_CHAT (uppercase)' },
        { permission: 'driver_chat', description: 'driver_chat (lowercase)' },
        { permission: 'DRIVER_CHAT', description: 'DRIVER_CHAT (uppercase)' },
        { permission: 'core_team_chat', description: 'core_team_chat (lowercase)' },
        { permission: 'CORE_TEAM_CHAT', description: 'CORE_TEAM_CHAT (uppercase)' },
        { permission: 'recipient_chat', description: 'recipient_chat (lowercase)' },
        { permission: 'RECIPIENT_CHAT', description: 'RECIPIENT_CHAT (uppercase)' },
        { permission: 'nonexistent_permission', description: 'nonexistent_permission (should fail)' }
      ];

      const chatAccessTests = [
        { chatRoom: 'host', description: 'host chat access' },
        { chatRoom: 'driver', description: 'driver chat access' },
        { chatRoom: 'core-team', description: 'core-team chat access' },
        { chatRoom: 'recipient', description: 'recipient chat access' },
        { chatRoom: 'general', description: 'general chat access' }
      ];

      // Run permission tests
      const permissionResults = permissionTests.map(test => ({
        ...test,
        result: hasPermission(user, test.permission)
      }));

      // Run chat access tests
      const chatResults = chatAccessTests.map(test => ({
        ...test,
        result: hasAccessToChat(user, test.chatRoom)
      }));

      res.json({
        user: {
          email: user.email,
          role: user.role,
          totalPermissions: user.permissions?.length || 0
        },
        permissionTests: permissionResults,
        chatAccessTests: chatResults
      });
      
    } catch (error: any) {
      console.error('Permission test error:', error);
      res.status(500).json({
        error: 'Permission test failed',
        message: error.message
      });
    }
  });

  // Collection statistics for bulk data manager
  app.get("/api/collection-stats", async (req, res) => {
    try {
      const totalRecords = await storage.getSandwichCollectionsCount();
      const allCollections = await storage.getAllSandwichCollections();

      // Count mapped vs unmapped records based on host assignment
      const hosts = await storage.getAllHosts();
      const hostNames = new Set(hosts.map((h) => h.name));

      let mappedRecords = 0;
      let unmappedRecords = 0;

      for (const collection of allCollections) {
        // Consider "groups" as mapped hosts
        if (
          hostNames.has(collection.hostName) ||
          collection.hostName.toLowerCase().includes("group")
        ) {
          mappedRecords++;
        } else {
          unmappedRecords++;
        }
      }

      res.json({
        totalRecords: Number(totalRecords),
        processedRecords: Number(totalRecords),
        mappedRecords,
        unmappedRecords,
      });
    } catch (error) {
      res
        .status(500)
        .json({ message: "Failed to fetch collection statistics" });
    }
  });

  // Host mapping statistics
  app.get("/api/host-mapping-stats", async (req, res) => {
    try {
      const allCollections = await storage.getAllSandwichCollections();
      const hosts = await storage.getAllHosts();
      const hostNames = new Set(hosts.map((h) => h.name));

      // Group collections by host name and count them
      const hostCounts = new Map<string, number>();

      for (const collection of allCollections) {
        const count = hostCounts.get(collection.hostName) || 0;
        hostCounts.set(collection.hostName, count + 1);
      }

      // Convert to array with mapping status
      // Consider "groups" as mapped hosts
      const mappingStats = Array.from(hostCounts.entries())
        .map(([hostName, count]) => ({
          hostName,
          count,
          mapped:
            hostNames.has(hostName) || hostName.toLowerCase().includes("group"),
        }))
        .sort((a, b) => b.count - a.count); // Sort by count descending

      res.json(mappingStats);
    } catch (error) {
      res
        .status(500)
        .json({ message: "Failed to fetch host mapping statistics" });
    }
  });

  // Direct task update routes (for frontend compatibility)
  app.patch("/api/tasks/:id", sanitizeMiddleware, async (req, res) => {
    try {
      const taskId = parseInt(req.params.id);
      const updates = req.body;
      
      console.log(`Direct PATCH request - Task ID: ${taskId}`);
      console.log("Updates payload:", updates);
      
      // Get original task to compare assignees
      const originalTask = await storage.getProjectTask(taskId);
      
      const task = await storage.updateProjectTask(taskId, updates);
      if (!task) {
        console.log(`Task ${taskId} not found in database`);
        return res.status(404).json({ error: "Task not found" });
      }
      
      // Check if assignees were added (new assigneeIds that weren't in original)
      if (updates.assigneeIds && Array.isArray(updates.assigneeIds)) {
        const originalAssigneeIds = originalTask?.assigneeIds || [];
        const newAssigneeIds = updates.assigneeIds.filter(id => 
          id && id.trim() && !originalAssigneeIds.includes(id)
        );
        
        // Create notifications for newly assigned users
        if (newAssigneeIds.length > 0) {
          const user = (req as any).user; // Standardized authentication
          
          for (const assigneeId of newAssigneeIds) {
            try {
              // Create notification in database
              const notification = await storage.createNotification({
                userId: assigneeId,
                type: 'task_assignment',
                title: 'New Task Assignment',
                content: `You have been assigned to task: ${task.title}`,
                relatedType: 'task',
                relatedId: task.id
              });

              // Emit WebSocket notification if available
              if (typeof (global as any).broadcastTaskAssignment === 'function') {
                (global as any).broadcastTaskAssignment(assigneeId, {
                  type: 'task_assignment',
                  message: 'You have been assigned a new task',
                  taskId: task.id,
                  taskTitle: task.title,
                  notificationId: notification.id
                });
              }
            } catch (notificationError) {
              console.error(`Error creating notification for user ${assigneeId}:`, notificationError);
              // Don't fail task update if notification fails
            }
          }
        }
      }
      
      console.log(`Task ${taskId} updated successfully`);
      
      // Trigger Google Sheets sync after task status change
      try {
        const { triggerGoogleSheetsSync } = await import('./google-sheets-sync');
        console.log('Triggering Google Sheets sync after task status update...');
        setImmediate(() => {
          triggerGoogleSheetsSync().catch(error => {
            console.error('Google Sheets sync failed after task update:', error);
          });
        });
      } catch (syncError) {
        console.error('Error triggering Google Sheets sync:', syncError);
        // Don't fail the task update if sync fails
      }
      
      res.json(task);
    } catch (error) {
      console.error("Error updating project task:", error);
      res.status(500).json({ error: "Failed to update task" });
    }
  });

  app.delete("/api/tasks/:id", async (req, res) => {
    try {
      const taskId = parseInt(req.params.id);
      const success = await storage.deleteProjectTask(taskId);
      if (!success) {
        return res.status(404).json({ error: "Task not found" });
      }
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting project task:", error);
      res.status(500).json({ error: "Failed to delete task" });
    }
  });

  // Register project routes
  const { projectsRoutes } = await import("./routes/projects");
  app.use("/api", projectsRoutes);

  // Register work logs routes
  const workLogsModule = await import("./routes/work-logs");
  app.use("/api", workLogsModule.default);

  // Static file serving for documents
  app.use("/documents", express.static("public/documents"));

  // Add data management routes
  app.use("/api/data", dataManagementRoutes);

  // Object storage routes for file uploads
  app.post("/api/objects/upload", isAuthenticated, async (req, res) => {
    try {
      const { ObjectStorageService } = await import('./objectStorage');
      const objectStorageService = new ObjectStorageService();
      const uploadURL = await objectStorageService.getObjectEntityUploadURL();
      res.json({ uploadURL });
    } catch (error) {
      console.error("Error getting upload URL:", error);
      res.status(500).json({ error: "Failed to get upload URL" });
    }
  });

  // Route to serve public objects (like logos)
  app.get("/public-objects/:filePath(*)", async (req, res) => {
    const filePath = req.params.filePath;
    try {
      const { ObjectStorageService } = await import('./objectStorage');
      const objectStorageService = new ObjectStorageService();
      const file = await objectStorageService.searchPublicObject(filePath);
      if (!file) {
        return res.status(404).json({ error: "File not found" });
      }
      await objectStorageService.downloadObject(file, res);
    } catch (error) {
      console.error("Error serving public object:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  });

  // Global search endpoint
  app.get("/api/search", async (req, res) => {
    try {
      const { q: query, type, limit = "50" } = req.query;

      if (!query || typeof query !== "string") {
        return res.status(400).json({ error: "Query parameter is required" });
      }

      const searchLimit = Math.min(parseInt(limit as string) || 50, 200);

      if (type && typeof type === "string") {
        // Type-specific search
        let results: any[] = [];
        switch (type) {
          case "collections":
            results = await SearchEngine.searchCollections(
              query,
              {},
              searchLimit,
            );
            break;
          case "hosts":
            results = await SearchEngine.searchHosts(query, {}, searchLimit);
            break;
          case "projects":
            results = await SearchEngine.searchProjects(query, {}, searchLimit);
            break;
          case "contacts":
            results = await SearchEngine.searchContacts(query, searchLimit);
            break;
          default:
            return res.status(400).json({ error: "Invalid search type" });
        }
        res.json({ results, type });
      } else {
        // Global search
        const result = await SearchEngine.globalSearch(query, {}, searchLimit);
        res.json(result);
      }
    } catch (error) {
      logger.error("Search failed:", error);
      res.status(500).json({ error: "Search failed" });
    }
  });

  // Search suggestions endpoint
  app.get("/api/search/suggestions", async (req, res) => {
    try {
      const { q: query, type } = req.query;

      if (!query || typeof query !== "string") {
        return res.status(400).json({ suggestions: [] });
      }

      const suggestions = await SearchEngine.getSearchSuggestions(
        query,
        type as "collection" | "host" | "project" | "contact" | undefined,
      );

      res.json({ suggestions });
    } catch (error) {
      logger.error("Search suggestions failed:", error);
      res.status(500).json({ suggestions: [] });
    }
  });

  // Reporting and Analytics Routes

  // Generate report
  app.post("/api/reports/generate", async (req, res) => {
    try {
      console.log("Report generation request body:", JSON.stringify(req.body, null, 2));
      
      // Check if this is a weekly report request
      if (req.body.type === 'weekly' || req.body.reportType === 'weekly') {
        const { WeeklyReportTemplate } = await import('./reporting/weekly-report-template');
        const { WeeklyPDFGenerator } = await import('./reporting/weekly-pdf-generator');
        
        const weeklyReporter = new WeeklyReportTemplate(storage);
        const weeklyData = await weeklyReporter.generateWeeklyReport(req.body.targetDate);
        
        const reportId = Date.now().toString();
        let reportBuffer: Buffer;
        
        if (req.body.format === 'pdf' || !req.body.format) {
          reportBuffer = await WeeklyPDFGenerator.generatePDF(weeklyData);
        } else {
          // For CSV/other formats, we'd implement different generators
          reportBuffer = await WeeklyPDFGenerator.generatePDF(weeklyData);
        }
        
        const reportData = {
          id: reportId,
          metadata: {
            title: "Weekly Impact Report",
            generatedAt: new Date().toISOString(),
            dateRange: `${weeklyData.collection_week.start} - ${weeklyData.collection_week.end}`,
            totalRecords: weeklyData.summary.total_sandwiches,
            format: req.body.format || 'pdf'
          },
          data: weeklyData,
          buffer: reportBuffer
        };

        // Cache the report
        const reportsCache = CacheManager.getCache("reports", {
          maxSize: 100,
          ttl: 24 * 60 * 60 * 1000,
        });
        reportsCache.set(`report:${reportId}`, reportData);

        console.log("Generated weekly report metadata:", JSON.stringify(reportData.metadata, null, 2));
        res.json(reportData);
        return;
      }
      
      // Original report generation for other types
      const reportData = await ReportGenerator.generateReport(req.body);
      console.log("Generated report metadata:", JSON.stringify(reportData.metadata, null, 2));

      // Store report for download (in production, this would use cloud storage)
      const reportId = Date.now().toString();
      reportData.id = reportId;

      // Cache the report for 24 hours using the reports cache
      const reportsCache = CacheManager.getCache("reports", {
        maxSize: 100,
        ttl: 24 * 60 * 60 * 1000,
      });
      reportsCache.set(`report:${reportId}`, reportData);

      res.json(reportData);
    } catch (error) {
      console.error("Report generation failed:", error);
      res.status(500).json({ error: "Failed to generate report" });
    }
  });

  // Download report
  app.get("/api/reports/download/:id", async (req, res) => {
    try {
      const reportId = req.params.id;
      const reportsCache = CacheManager.getCache("reports", {
        maxSize: 100,
        ttl: 24 * 60 * 60 * 1000,
      });
      const reportData = reportsCache.get(`report:${reportId}`);

      if (!reportData) {
        return res.status(404).json({ error: "Report not found or expired" });
      }

      const format = reportData.metadata.format || "json";

      res.setHeader(
        "Content-Disposition",
        `attachment; filename="report-${reportId}.${format}"`,
      );

      if (format === "csv") {
        res.setHeader("Content-Type", "text/csv");
        // Convert to CSV format
        if (Array.isArray(reportData.data)) {
          const csvHeader = Object.keys(reportData.data[0] || {}).join(",");
          const csvRows = reportData.data.map((row) =>
            Object.values(row)
              .map((val) => `"${val}"`)
              .join(","),
          );
          res.send([csvHeader, ...csvRows].join("\n"));
        } else {
          res.send("No data available");
        }
      } else if (format === "pdf") {
        try {
          // Use dynamic import for PDFKit in ES modules
          const PDFKit = (await import("pdfkit")).default;
          const doc = new PDFKit({ margin: 50 });

          // Set response headers for PDF
          res.setHeader("Content-Type", "application/pdf");
          res.setHeader(
            "Content-Disposition",
            `attachment; filename="report-${reportId}.pdf"`,
          );

          // Pipe the PDF to the response
          doc.pipe(res);

          // Add content to PDF - start simple
          doc.fontSize(20).text(reportData.metadata.title || "Sandwich Collection Report", { align: 'center' });
          doc.moveDown(2);

          // Basic metadata
          doc.fontSize(12);
          doc.text(`Generated: ${new Date().toLocaleDateString()}`);
          doc.text(`Date Range: ${reportData.metadata?.dateRange || 'All available data'}`);
          doc.text(`Total Records: ${reportData.metadata?.totalRecords || reportData.data?.length || 0}`);
          doc.moveDown();

          // Summary section
          doc.fontSize(16).text("Summary", { underline: true });
          doc.moveDown();
          
          doc.fontSize(12);
          const totalSandwiches = reportData.summary?.totalSandwiches || 0;
          doc.text(`Total Sandwiches: ${totalSandwiches.toLocaleString()}`);
          
          if (Array.isArray(reportData.data)) {
            const uniqueHosts = new Set(reportData.data.map(item => item.hostName).filter(Boolean)).size;
            doc.text(`Unique Host Locations: ${uniqueHosts}`);
          }
          doc.moveDown();

          // Data section
          if (Array.isArray(reportData.data) && reportData.data.length > 0) {
            doc.fontSize(16).text("Collection Data", { underline: true });
            doc.moveDown();
            
            doc.fontSize(10);
            const maxRecords = Math.min(reportData.data.length, 50); // Limit to prevent oversized PDFs
            
            for (let i = 0; i < maxRecords; i++) {
              const record = reportData.data[i];
              const individual = record.individualSandwiches || 0;
              const group = (record.group1Count || 0) + (record.group2Count || 0);
              const total = individual + group;
              const date = record.collectionDate ? new Date(record.collectionDate).toLocaleDateString() : 'N/A';
              const host = record.hostName || 'Unknown Host';
              
              doc.text(`${i + 1}. ${date} - ${host}: ${individual} individual + ${group} group = ${total} total`);
              
              // Add page break if needed
              if (doc.y > 700) {
                doc.addPage();
              }
            }
            
            if (reportData.data.length > maxRecords) {
              doc.moveDown();
              doc.text(`... and ${reportData.data.length - maxRecords} more records (download CSV for complete data)`);
            }
          }

          // End the PDF properly
          doc.end();
        } catch (error) {
          console.error("PDF generation failed with error:", error);
          console.error("Error stack:", error.stack);
          console.error("Error name:", error.name);
          console.error("Error message:", error.message);
          
          // Don't fall back to CSV - instead send error and let frontend handle it
          return res.status(500).json({ error: "PDF generation failed", details: error.message });
        }
      } else {
        res.setHeader("Content-Type", "application/json");
        res.json(reportData);
      }
    } catch (error) {
      console.error("Report download failed:", error);
      res.status(500).json({ error: "Failed to download report" });
    }
  });

  // Weekly Impact Report Routes
  
  // Generate weekly impact report
  app.post("/api/reports/weekly-impact", async (req, res) => {
    try {
      const { weekEndingDate = new Date().toISOString().split('T')[0] } = req.body;
      const weeklyGenerator = new WeeklyImpactReportGenerator(storage);
      const reportData = await weeklyGenerator.generateWeeklyReport(weekEndingDate);
      
      res.json({
        metadata: {
          title: "Weekly Impact Report",
          generatedAt: new Date().toISOString(),
          weekEnding: weekEndingDate,
          format: "json"
        },
        data: reportData
      });
    } catch (error) {
      console.error("Weekly impact report generation failed:", error);
      res.status(500).json({ error: "Failed to generate weekly impact report" });
    }
  });

  // Download weekly impact report as PDF
  app.get("/api/reports/weekly-impact/download/:weekEndingDate", async (req, res) => {
    try {
      const { weekEndingDate } = req.params;
      const weeklyGenerator = new WeeklyImpactReportGenerator(storage);
      const reportData = await weeklyGenerator.generateWeeklyReport(weekEndingDate);
      const pdfBuffer = await weeklyGenerator.generatePDFReport(reportData);

      res.setHeader("Content-Type", "application/pdf");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="weekly-impact-report-${weekEndingDate}.pdf"`
      );
      res.send(pdfBuffer);
    } catch (error) {
      console.error("Weekly impact PDF generation failed:", error);
      res.status(500).json({ error: "Failed to generate weekly impact PDF" });
    }
  });

  // Analytics Dashboard Routes  
  app.get("/api/dashboard/stats", async (req, res) => {
    try {
      const stats = await storage.getCollectionStats();
      res.json(stats);
    } catch (error) {
      console.error("Failed to fetch dashboard stats:", error);
      res.status(500).json({ error: "Failed to fetch dashboard stats" });
    }
  });

  // Schedule report
  app.post("/api/reports/schedule", async (req, res) => {
    try {
      const { config, schedule } = req.body;
      const scheduledReport = await ReportGenerator.scheduleReport(
        config,
        schedule,
      );

      res.json(scheduledReport);
    } catch (error) {
      console.error("Report scheduling failed:", error);
      res.status(500).json({ error: "Failed to schedule report" });
    }
  });

  // Get scheduled reports
  app.get("/api/reports/scheduled", async (req, res) => {
    try {
      // In production, this would fetch from database
      const reportsCache = CacheManager.getCache("reports", {
        maxSize: 100,
        ttl: 24 * 60 * 60 * 1000,
      });
      const scheduledReports = reportsCache.get("scheduled_reports") || [];
      res.json(scheduledReports);
    } catch (error) {
      console.error("Failed to fetch scheduled reports:", error);
      res.status(500).json({ error: "Failed to fetch scheduled reports" });
    }
  });

  // Get recent reports
  app.get("/api/reports/recent", async (req, res) => {
    try {
      // In production, this would fetch from database
      const recentReports = [];
      res.json(recentReports);
    } catch (error) {
      console.error("Failed to fetch recent reports:", error);
      res.status(500).json({ error: "Failed to fetch recent reports" });
    }
  });

  // Email notification routes

  // Send test email
  app.post("/api/notifications/test", async (req, res) => {
    try {
      const { to, template, variables } = req.body;

      const success = await EmailService.sendEmail({
        to,
        template,
        variables,
      });

      res.json({
        success,
        message: success ? "Email sent successfully" : "Email sending failed",
      });
    } catch (error) {
      console.error("Test email failed:", error);
      res.status(500).json({ error: "Failed to send test email" });
    }
  });

  // Get available email templates
  app.get("/api/notifications/templates", async (req, res) => {
    try {
      const templates = EmailService.getAvailableTemplates();
      res.json(templates);
    } catch (error) {
      console.error("Failed to fetch email templates:", error);
      res.status(500).json({ error: "Failed to fetch email templates" });
    }
  });

  // Send milestone notification
  app.post("/api/notifications/milestone", async (req, res) => {
    try {
      const { milestone, recipients } = req.body;

      const success = await EmailService.sendMilestoneNotification(
        milestone,
        recipients,
      );

      res.json({
        success,
        message: success
          ? "Milestone notification sent"
          : "Failed to send notification",
      });
    } catch (error) {
      console.error("Milestone notification failed:", error);
      res.status(500).json({ error: "Failed to send milestone notification" });
    }
  });

  // Send project deadline reminder
  app.post("/api/notifications/deadline-reminder", async (req, res) => {
    try {
      const { project, recipients } = req.body;

      const success = await EmailService.sendProjectDeadlineReminder(
        project,
        recipients,
      );

      res.json({
        success,
        message: success ? "Deadline reminder sent" : "Failed to send reminder",
      });
    } catch (error) {
      console.error("Deadline reminder failed:", error);
      res.status(500).json({ error: "Failed to send deadline reminder" });
    }
  });

  // Send weekly summary
  app.post("/api/notifications/weekly-summary", async (req, res) => {
    try {
      const { summaryData, recipients } = req.body;

      const success = await EmailService.sendWeeklySummary(
        summaryData,
        recipients,
      );

      res.json({
        success,
        message: success ? "Weekly summary sent" : "Failed to send summary",
      });
    } catch (error) {
      console.error("Weekly summary failed:", error);
      res.status(500).json({ error: "Failed to send weekly summary" });
    }
  });

  // Version Control API Routes
  app.get(
    "/api/version-control/:entityType/:entityId/history",
    async (req, res) => {
      try {
        const { entityType, entityId } = req.params;
        const history = await VersionControl.getVersionHistory(
          entityType as any,
          parseInt(entityId),
        );
        res.json(history);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    },
  );

  app.get(
    "/api/version-control/:entityType/:entityId/version/:version",
    async (req, res) => {
      try {
        const { entityType, entityId, version } = req.params;
        const versionData = await VersionControl.getVersion(
          entityType as any,
          parseInt(entityId),
          parseInt(version),
        );
        if (!versionData) {
          return res.status(404).json({ error: "Version not found" });
        }
        res.json(versionData);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    },
  );

  app.post(
    "/api/version-control/:entityType/:entityId/restore/:version",
    async (req, res) => {
      try {
        const { entityType, entityId, version } = req.params;
        const userId = req.user?.claims?.sub;

        const success = await VersionControl.restoreVersion(
          entityType as any,
          parseInt(entityId),
          parseInt(version),
          userId,
        );

        if (success) {
          res.json({ success: true, message: "Version restored successfully" });
        } else {
          res.status(400).json({ error: "Failed to restore version" });
        }
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    },
  );

  app.get(
    "/api/version-control/:entityType/:entityId/compare/:version1/:version2",
    async (req, res) => {
      try {
        const { entityType, entityId, version1, version2 } = req.params;
        const comparison = await VersionControl.compareVersions(
          entityType as any,
          parseInt(entityId),
          parseInt(version1),
          parseInt(version2),
        );
        res.json(comparison);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    },
  );

  app.post("/api/version-control/changeset", async (req, res) => {
    try {
      const userId = req.user?.claims?.sub;
      const result = await VersionControl.createChangeset({
        ...req.body,
        userId,
      });
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/version-control/stats", async (req, res) => {
    try {
      const { entityType, userId, startDate, endDate } = req.query;
      const stats = await VersionControl.getChangeStats(
        entityType as any,
        userId as string,
        startDate ? new Date(startDate as string) : undefined,
        endDate ? new Date(endDate as string) : undefined,
      );
      res.json(stats);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/version-control/export", async (req, res) => {
    try {
      const { entityType, entityId } = req.query;
      const history = await VersionControl.exportVersionHistory(
        entityType as any,
        entityId ? parseInt(entityId as string) : undefined,
      );
      res.json(history);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // Integration API Routes for external systems
  app.get("/api/integration/summary", async (req, res) => {
    try {
      const stats = await storage.getCollectionStats();
      const hosts = await storage.getAllHosts();
      const projects = await storage.getAllProjects();

      const summary = {
        totalSandwiches: stats.totalSandwiches,
        totalHosts: hosts.length,
        activeHosts: hosts.filter((h) => h.status === "active").length,
        totalProjects: projects.length,
        activeProjects: projects.filter((p) => p.status === "in_progress")
          .length,
        lastUpdated: new Date().toISOString(),
      };

      res.json(summary);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/integration/collections/recent", async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 10;
      const collections = await storage.getAllSandwichCollections(limit);

      const recentCollections = collections
        .slice(0, limit)
        .map((collection) => ({
          id: collection.id,
          hostName: collection.hostName,
          individualSandwiches: collection.individualSandwiches,
          groupCollections: collection.groupCollections,
          collectionDate: collection.collectionDate,
          submittedAt: collection.submittedAt,
        }));

      res.json(recentCollections);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/integration/webhook", async (req, res) => {
    try {
      const { event, data } = req.body;

      // Log webhook event
      // Log webhook event
      console.log("Webhook received:", event, Object.keys(data || {}));

      // Process different webhook events
      switch (event) {
        case "collection_submitted":
          // Handle external collection submission
          if (data.hostName && data.sandwiches) {
            await storage.createSandwichCollection({
              hostName: data.hostName,
              individualSandwiches: data.sandwiches,
              groupCollections: data.groupCollections || "{}",
              collectionDate:
                data.date || new Date().toISOString().split("T")[0],
            });
          }
          break;

        case "host_updated":
          // Handle external host updates
          if (data.hostId && data.updates) {
            await storage.updateHost(data.hostId, data.updates);
          }
          break;

        default:
          console.log(`Unknown webhook event: ${event}`);
      }

      res.json({ success: true, processed: event });
    } catch (error) {
      console.error("Webhook processing error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Backup Management API Routes for Phase 5: Operations & Reliability
  app.post("/api/backups/create", async (req, res) => {
    try {
      const userId = req.user?.claims?.sub;
      const { reason } = req.body;

      const manifest = await BackupManager.createBackup(
        "manual",
        userId,
        reason,
      );
      res.json({ success: true, manifest });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/backups", async (req, res) => {
    try {
      const backups = await BackupManager.listBackups();
      res.json(backups);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/backups/:backupId", async (req, res) => {
    try {
      const { backupId } = req.params;
      const backup = await BackupManager.getBackupInfo(backupId);

      if (!backup) {
        return res.status(404).json({ error: "Backup not found" });
      }

      res.json(backup);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/backups/:backupId/validate", async (req, res) => {
    try {
      const { backupId } = req.params;
      const validation = await BackupManager.validateBackup(backupId);
      res.json(validation);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.delete("/api/backups/:backupId", async (req, res) => {
    try {
      const { backupId } = req.params;
      const userId = req.user?.claims?.sub;

      const success = await BackupManager.deleteBackup(backupId, userId);

      if (success) {
        res.json({ success: true, message: "Backup deleted successfully" });
      } else {
        res.status(400).json({ error: "Failed to delete backup" });
      }
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/backups/stats/storage", async (req, res) => {
    try {
      const stats = await BackupManager.getStorageStats();
      res.json(stats);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // Operations Dashboard API for comprehensive system monitoring
  app.get("/api/operations/system-health", async (req, res) => {
    try {
      const stats = await storage.getCollectionStats();
      const hosts = await storage.getAllHosts();
      const projects = await storage.getAllProjects();
      const backupStats = await BackupManager.getStorageStats();
      const cacheStats = CacheManager.getStats();

      const systemHealth = {
        database: {
          status: "healthy",
          totalRecords: stats.totalEntries,
          totalSandwiches: stats.totalSandwiches,
          lastActivity: new Date().toISOString(),
        },
        hosts: {
          total: hosts.length,
          active: hosts.filter((h) => h.status === "active").length,
          inactive: hosts.filter((h) => h.status === "inactive").length,
        },
        projects: {
          total: projects.length,
          active: projects.filter((p) => p.status === "in_progress").length,
          completed: projects.filter((p) => p.status === "completed").length,
        },
        backups: {
          total: backupStats.totalBackups,
          totalSize: backupStats.diskUsage,
          lastBackup: backupStats.newestBackup,
        },
        cache: {
          hitRate: cacheStats.hitRate,
          size: cacheStats.size,
          memory: `${Math.round(cacheStats.memoryUsage / 1024 / 1024)}MB`,
        },
        uptime: process.uptime(),
        memory: {
          used: `${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`,
          total: `${Math.round(process.memoryUsage().heapTotal / 1024 / 1024)}MB`,
        },
      };

      res.json(systemHealth);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // Initialize backup system
  BackupManager.initialize().then(() => {
    BackupManager.scheduleAutoBackup();
    console.log("Backup system initialized with automated daily backups");
  });

  const httpServer = createServer(app);
  // Committee management routes
  app.get("/api/committees", isAuthenticated, async (req: any, res) => {
    try {
      const committees = await storage.getAllCommittees();
      res.json({ committees });
    } catch (error) {
      console.error("Error fetching committees:", error);
      res.status(500).json({ message: "Failed to fetch committees" });
    }
  });

  app.get("/api/committees/:id", isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      const committee = await storage.getCommittee(id);
      if (!committee) {
        return res.status(404).json({ message: "Committee not found" });
      }
      res.json(committee);
    } catch (error) {
      console.error("Error fetching committee:", error);
      res.status(500).json({ message: "Failed to fetch committee" });
    }
  });

  app.post(
    "/api/committees",
    isAuthenticated,
    requirePermission("manage_committees"),
    async (req: any, res) => {
      try {
        const committee = await storage.createCommittee(req.body);
        res.json(committee);
      } catch (error) {
        console.error("Error creating committee:", error);
        res.status(500).json({ message: "Failed to create committee" });
      }
    },
  );

  app.get(
    "/api/committees/:id/members",
    isAuthenticated,
    async (req: any, res) => {
      try {
        const { id } = req.params;
        const members = await storage.getCommitteeMembers(id);
        res.json({ members });
      } catch (error) {
        console.error("Error fetching committee members:", error);
        res.status(500).json({ message: "Failed to fetch committee members" });
      }
    },
  );

  app.post(
    "/api/committees/:id/members",
    isAuthenticated,
    requirePermission("manage_committees"),
    async (req: any, res) => {
      try {
        const { id } = req.params;
        const { userId, role } = req.body;
        const membership = await storage.addUserToCommittee({
          userId,
          committeeId: id,
          role: role || "member",
        });
        res.json(membership);
      } catch (error) {
        console.error("Error adding committee member:", error);
        res.status(500).json({ message: "Failed to add committee member" });
      }
    },
  );

  app.delete(
    "/api/committees/:id/members/:userId",
    isAuthenticated,
    requirePermission("manage_committees"),
    async (req: any, res) => {
      try {
        const { id, userId } = req.params;
        const success = await storage.removeUserFromCommittee(userId, id);
        if (success) {
          res.json({ message: "Member removed successfully" });
        } else {
          res.status(404).json({ message: "Membership not found" });
        }
      } catch (error) {
        console.error("Error removing committee member:", error);
        res.status(500).json({ message: "Failed to remove committee member" });
      }
    },
  );

  app.get(
    "/api/users/:id/committees",
    isAuthenticated,
    async (req: any, res) => {
      try {
        const { id } = req.params;
        const userCommittees = await storage.getUserCommittees(id);
        res.json({ committees: userCommittees });
      } catch (error) {
        console.error("Error fetching user committees:", error);
        res.status(500).json({ message: "Failed to fetch user committees" });
      }
    },
  );

  // Announcement routes
  app.get("/api/announcements", async (req, res) => {
    try {
      const announcements = await storage.getAllAnnouncements();
      res.json(announcements);
    } catch (error) {
      console.error("Error fetching announcements:", error);
      res.status(500).json({ message: "Failed to fetch announcements" });
    }
  });

  app.post(
    "/api/announcements",
    isAuthenticated,
    requirePermission("USERS_EDIT"),
    async (req: any, res) => {
      try {
        console.log("Received announcement data:", req.body);

        // Convert ISO strings to Date objects for validation
        const processedData = {
          ...req.body,
          startDate: new Date(req.body.startDate),
          endDate: new Date(req.body.endDate),
        };

        const result = insertAnnouncementSchema.safeParse(processedData);
        if (!result.success) {
          console.log("Validation errors:", result.error.errors);
          return res.status(400).json({
            message: "Invalid announcement data",
            errors: result.error.errors,
          });
        }

        const announcement = await storage.createAnnouncement(result.data);
        res.status(201).json(announcement);
      } catch (error) {
        console.error("Error creating announcement:", error);
        res.status(500).json({ message: "Failed to create announcement" });
      }
    },
  );

  app.patch(
    "/api/announcements/:id",
    isAuthenticated,
    requirePermission("USERS_EDIT"),
    async (req: any, res) => {
      try {
        const id = parseInt(req.params.id);
        const updates = { ...req.body };

        // Convert ISO strings to Date objects if present
        if (updates.startDate) {
          updates.startDate = new Date(updates.startDate);
        }
        if (updates.endDate) {
          updates.endDate = new Date(updates.endDate);
        }

        const announcement = await storage.updateAnnouncement(id, updates);
        if (!announcement) {
          return res.status(404).json({ message: "Announcement not found" });
        }

        res.json(announcement);
      } catch (error) {
        console.error("Error updating announcement:", error);
        res.status(500).json({ message: "Failed to update announcement" });
      }
    },
  );

  app.delete(
    "/api/announcements/:id",
    isAuthenticated,
    requirePermission("USERS_EDIT"),
    async (req: any, res) => {
      try {
        const id = parseInt(req.params.id);

        const success = await storage.deleteAnnouncement(id);
        if (!success) {
          return res.status(404).json({ message: "Announcement not found" });
        }

        res.status(204).send();
      } catch (error) {
        console.error("Error deleting announcement:", error);
        res.status(500).json({ message: "Failed to delete announcement" });
      }
    },
  );

  // Custom Message Groups API
  app.get("/api/message-groups", isAuthenticated, async (req, res) => {
    try {
      const userId = (req as any).user?.id;
      const user = (req as any).user;

      // Check if user has moderation permissions (super_admin or admin with moderate_messages)
      const canModerateMessages =
        user.role === "super_admin" ||
        (user.permissions && user.permissions.includes("moderate_messages"));

      let userGroups;

      if (canModerateMessages) {
        // TEMPORARILY DISABLED: Super admins and moderators see ALL group conversations
        // userGroups = await db
        //   .select({
        //     id: conversations.id,
        //     name: conversations.name,
        //     description: sql<string>`null`, // No description field in conversations table
        //     createdBy: sql<string>`null`, // No createdBy field in conversations table
        //     isActive: sql<boolean>`true`, // All conversations are active by default
        //     createdAt: conversations.createdAt,
        //     userRole: sql<string>`'moderator'` // Mark as moderator role for super admins
        //   })
        //   .from(conversations)
        //   .where(eq(conversations.type, 'group'));

        userGroups = [];
      } else {
        // TEMPORARILY DISABLED: Regular users only see group conversations where they are participants
        // userGroups = await db
        //   .select({
        //     id: conversations.id,
        //     name: conversations.name,
        //     description: sql<string>`null`, // No description field in conversations table
        //     createdBy: sql<string>`null`, // No createdBy field in conversations table
        //     isActive: sql<boolean>`true`, // All conversations are active by default
        //     createdAt: conversations.createdAt,
        //     userRole: sql<string>`'member'` // Regular participants are members
        //   })
        //   .from(conversations)
        //   .innerJoin(conversationParticipants, eq(conversations.id, conversationParticipants.conversationId))
        //   .where(
        //     and(
        //       eq(conversations.type, 'group'),
        //       eq(conversationParticipants.userId, userId)
        //     )
        //   );

        userGroups = [];
      }

      // Get member counts for each group separately
      const groupsWithCounts = await Promise.all(
        userGroups.map(async (group) => {
          const memberCount = await db
            .select({ count: sql<number>`count(*)` })
            .from(conversationParticipants)
            .where(eq(conversationParticipants.conversationId, group.id));

          return {
            ...group,
            memberCount: memberCount[0]?.count || 0,
          };
        }),
      );

      res.json(groupsWithCounts);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch message groups" });
    }
  });

  app.post("/api/message-groups", isAuthenticated, async (req, res) => {
    try {
      const { name, description, memberIds } = req.body;
      const userId = (req as any).user?.id;

      if (!name?.trim()) {
        return res.status(400).json({ message: "Group name is required" });
      }

      // Create the group
      const [group] = await db
        .insert(conversations)
        .values({
          name: name.trim(),
          description: description?.trim() || null,
          createdBy: userId,
        })
        .returning();

      // Create a conversation for this group
      const [thread] = await db
        .insert(conversations)
        .values({
          type: "group", 
          name: name.trim(),
          createdAt: new Date(),
        })
        .returning();

      console.log(
        `[DEBUG] Created thread ${thread.id} for group ${group.id} (${name})`,
      );

      // Add creator as admin to group membership
      await db.insert(conversationParticipants).values({
        groupId: group.id,
        userId: userId,
        role: "admin",
      });

      // Add creator as participant to thread
      await db.insert(conversationParticipants).values({
        threadId: thread.id,
        userId: userId,
        status: "active",
        joinedAt: new Date(),
      });

      // Add other members to both group and thread
      if (memberIds && Array.isArray(memberIds)) {
        const memberships = memberIds
          .filter((id) => id !== userId) // Don't duplicate creator
          .map((memberId) => ({
            groupId: group.id,
            userId: memberId,
            role: "member" as const,
          }));

        const participants = memberIds
          .filter((id) => id !== userId) // Don't duplicate creator
          .map((memberId) => ({
            threadId: thread.id,
            userId: memberId,
            status: "active" as const,
            joinedAt: new Date(),
          }));

        if (memberships.length > 0) {
          await db.insert(conversationParticipants).values(memberships);
          await db.insert(conversationParticipants).values(participants);
        }
      }

      // Send welcome message notification
      if ((global as any).broadcastNewMessage) {
        (global as any).broadcastNewMessage({
          content: `Welcome to ${name}! This group has been created for team collaboration.`,
          sender: "System",
          threadId: thread.id,
          timestamp: new Date(),
        });
      }

      res.status(201).json({ ...group, threadId: thread.id });
    } catch (error) {
      console.error("Error creating message group:", error);
      res.status(500).json({ message: "Failed to create message group" });
    }
  });

  // Add members to existing group
  app.post(
    "/api/message-groups/:groupId/members",
    isAuthenticated,
    async (req, res) => {
      try {
        const { groupId } = req.params;
        const { memberIds } = req.body;
        const currentUser = (req as any).user;
        const userId = currentUser?.id;

        // Platform super admins can add members to any group
        const isPlatformSuperAdmin = currentUser?.role === "super_admin";

        if (!isPlatformSuperAdmin) {
          // Check if user is admin of the group
          const userMembership = await db
            .select()
            .from(conversationParticipants)
            .where(
              and(
                eq(conversationParticipants.groupId, parseInt(groupId)),
                eq(conversationParticipants.userId, userId),
                eq(conversationParticipants.role, "admin"),
                eq(conversationParticipants.isActive, true),
              ),
            )
            .limit(1);

          if (userMembership.length === 0) {
            return res
              .status(403)
              .json({ message: "Only group admins can add members" });
          }
        }

        if (!memberIds || !Array.isArray(memberIds) || memberIds.length === 0) {
          return res.status(400).json({ message: "Member IDs are required" });
        }

        // Get existing members to avoid duplicates
        const existingMembers = await db
          .select({ userId: conversationParticipants.userId })
          .from(conversationParticipants)
          .where(
            and(
              eq(conversationParticipants.groupId, parseInt(groupId)),
              eq(conversationParticipants.isActive, true),
            ),
          );

        const existingMemberIds = existingMembers.map((m) => m.userId);
        const newMemberIds = memberIds.filter(
          (id) => !existingMemberIds.includes(id),
        );

        if (newMemberIds.length === 0) {
          return res
            .status(400)
            .json({ message: "All selected users are already members" });
        }

        // Add new members
        const memberships = newMemberIds.map((memberId) => ({
          groupId: parseInt(groupId),
          userId: memberId,
          role: "member" as const,
        }));

        await db.insert(conversationParticipants).values(memberships);

        res.json({
          message: "Members added successfully",
          addedCount: newMemberIds.length,
        });
      } catch (error) {
        res.status(500).json({ message: "Failed to add members to group" });
      }
    },
  );

  app.get(
    "/api/message-groups/:groupId/members",
    isAuthenticated,
    async (req, res) => {
      try {
        const groupId = parseInt(req.params.groupId);
        const userId = (req as any).user?.id;
        const user = (req as any).user;

        console.log(
          `[DEBUG] Fetching members for group ${groupId}, user ${userId}`,
        );

        // Check if user has moderation permissions (super_admin or admin with moderate_messages)
        const canModerateMessages =
          user.role === "super_admin" ||
          (user.permissions && user.permissions.includes("moderate_messages"));

        console.log(
          `[DEBUG] User moderation permissions: ${canModerateMessages}`,
        );

        if (!canModerateMessages) {
          try {
            // Regular users need to be members of the group
            const membership = await db
              .select()
              .from(conversationParticipants)
              .where(
                and(
                  eq(conversationParticipants.groupId, groupId),
                  eq(conversationParticipants.userId, userId),
                  eq(conversationParticipants.isActive, true),
                ),
              )
              .limit(1);

            if (membership.length === 0) {
              return res
                .status(403)
                .json({ message: "Not a member of this group" });
            }
          } catch (membershipError) {
            console.error(
              `[ERROR] Error checking membership:`,
              membershipError,
            );
            // If conversationParticipants table doesn't exist, allow super admins to proceed
            if (!canModerateMessages) {
              return res
                .status(500)
                .json({ message: "Group membership system not available" });
            }
          }
        }

        try {
          // Get all group members with user details
          const members = await db
            .select({
              userId: conversationParticipants.userId,
              role: conversationParticipants.role,
              joinedAt: conversationParticipants.joinedAt,
              firstName: users.firstName,
              lastName: users.lastName,
              email: users.email,
            })
            .from(conversationParticipants)
            .leftJoin(users, eq(conversationParticipants.userId, users.id))
            .where(
              and(
                eq(conversationParticipants.groupId, groupId),
                eq(conversationParticipants.isActive, true),
              ),
            );

          console.log(
            `[DEBUG] Found ${members.length} members for group ${groupId}`,
          );
          res.json(members);
        } catch (membersError) {
          console.error(`[ERROR] Error fetching group members:`, membersError);
          // If conversationParticipants table doesn't exist, return empty array for now
          res.json([]);
        }
      } catch (error) {
        console.error(
          `[ERROR] General error in group members endpoint:`,
          error,
        );
        res
          .status(500)
          .json({
            message: "Failed to fetch group members",
            details: error.message,
          });
      }
    },
  );

  // TEMPORARILY DISABLED: Thread Participant Management API - Using new conversation system instead
  // app.get("/api/threads/:threadId/participants", isAuthenticated, async (req, res) => {
  //   // This endpoint is disabled - use /api/conversations/:conversationId/participants instead
  //   res.status(404).json({ message: "Endpoint disabled - use conversation system" });
  // });

  app.patch(
    "/api/threads/:threadId/my-status",
    isAuthenticated,
    async (req, res) => {
      try {
        const threadId = parseInt(req.params.threadId);
        const userId = (req as any).user?.id;
        const { status } = req.body;

        if (!["active", "archived", "left", "muted"].includes(status)) {
          return res.status(400).json({ message: "Invalid status" });
        }

        // Update participant status with timestamp
        const timestampField =
          status === "left"
            ? "left_at"
            : status === "archived"
              ? "archived_at"
              : status === "muted"
                ? "muted_at"
                : null;

        const updates: any = { status };
        if (timestampField) {
          updates[timestampField] = new Date();
        }

        const result = await db
          .update(conversationParticipants)
          .set(updates)
          .where(
            and(
              eq(conversationParticipants.threadId, threadId),
              eq(conversationParticipants.userId, userId),
            ),
          );

        if (result.rowCount === 0) {
          return res
            .status(404)
            .json({ message: "Participant record not found" });
        }

        res.json({ message: `Thread status updated to ${status}`, status });
      } catch (error) {
        res.status(500).json({ message: "Failed to update thread status" });
      }
    },
  );

  app.patch(
    "/api/threads/:threadId/mark-read",
    isAuthenticated,
    async (req, res) => {
      try {
        const threadId = parseInt(req.params.threadId);
        const userId = (req as any).user?.id;

        const result = await db
          .update(conversationParticipants)
          .set({ lastReadAt: new Date() })
          .where(
            and(
              eq(conversationParticipants.threadId, threadId),
              eq(conversationParticipants.userId, userId),
            ),
          );

        res.json({ message: "Thread marked as read" });
      } catch (error) {
        res.status(500).json({ message: "Failed to mark thread as read" });
      }
    },
  );

  app.get(
    "/api/threads/:threadId/my-status",
    isAuthenticated,
    async (req, res) => {
      try {
        const threadId = parseInt(req.params.threadId);
        const userId = (req as any).user?.id;

        const [participant] = await db
          .select({
            status: conversationParticipants.status,
            lastReadAt: conversationParticipants.lastReadAt,
            joinedAt: conversationParticipants.joinedAt,
          })
          .from(conversationParticipants)
          .where(
            and(
              eq(conversationParticipants.threadId, threadId),
              eq(conversationParticipants.userId, userId),
            ),
          );

        if (!participant) {
          return res
            .status(404)
            .json({ message: "Not a participant in this thread" });
        }

        res.json(participant);
      } catch (error) {
        res.status(500).json({ message: "Failed to fetch thread status" });
      }
    },
  );

  // Updated group messages endpoint to respect individual participant status
  app.get(
    "/api/message-groups/:groupId/messages",
    isAuthenticated,
    async (req, res) => {
      try {
        const groupId = parseInt(req.params.groupId);
        const userId = (req as any).user?.id;

        console.log(
          `[DEBUG] Fetching messages for group ${groupId}, user ${userId}`,
        );

        try {
          // Get the thread ID for this group
          const [thread] = await db
            .select({ threadId: conversations.id })
            .from(conversations)
            .where(
              and(
                eq(conversations.type, "group"),
                eq(conversations.referenceId, groupId.toString()),
                eq(conversations.isActive, true),
              ),
            );

          if (!thread) {
            console.log(`[DEBUG] No thread found for group ${groupId}`);
            return res.json([]);
          }

          // Check if user has access to this thread (not left)
          const participantStatus = await db
            .select({ status: conversationParticipants.status })
            .from(conversationParticipants)
            .where(
              and(
                eq(conversationParticipants.threadId, thread.threadId),
                eq(conversationParticipants.userId, userId),
              ),
            );

          if (
            participantStatus.length === 0 ||
            participantStatus[0].status === "left"
          ) {
            console.log(
              `[DEBUG] User ${userId} has no access to thread ${thread.threadId} for group ${groupId}`,
            );
            return res.json([]); // Return empty array for users who left
          }

          // Get messages from the thread
          const groupMessages = await db
            .select()
            .from(messagesTable)
            .where(eq(messagesTable.threadId, thread.threadId))
            .orderBy(messagesTable.createdAt);

          console.log(
            `[DEBUG] Found ${groupMessages.length} messages for group ${groupId} thread ${thread.threadId}`,
          );
          res.json(groupMessages);
        } catch (threadError) {
          console.log(
            `[DEBUG] Thread system not available, falling back to conversation-based messages`,
          );

          // Fallback: try to get messages from conversations table using the groupId
          const groupMessages = await db
            .select({
              id: messagesTable.id,
              content: messagesTable.content,
              userId: messagesTable.userId,
              sender: messagesTable.sender,
              timestamp: messagesTable.createdAt,
              createdAt: messagesTable.createdAt,
            })
            .from(messagesTable)
            .where(eq(messagesTable.conversationId, groupId))
            .orderBy(messagesTable.createdAt);

          console.log(
            `[DEBUG] Fallback: Found ${groupMessages.length} messages for conversation ${groupId}`,
          );
          res.json(groupMessages);
        }
      } catch (error) {
        console.error("Error fetching group messages:", error);
        res
          .status(500)
          .json({
            message: "Failed to fetch group messages",
            details: error.message,
          });
      }
    },
  );

  // POST endpoint for sending messages to group threads
  app.post(
    "/api/message-groups/:groupId/messages",
    isAuthenticated,
    async (req, res) => {
      try {
        const groupId = parseInt(req.params.groupId);
        const userId = (req as any).user?.id;
        const { content, sender } = req.body;

        if (!content?.trim()) {
          return res
            .status(400)
            .json({ message: "Message content is required" });
        }

        // Get the thread ID for this group
        const [thread] = await db
          .select({ threadId: conversations.id })
          .from(conversations)
          .where(
            and(
              eq(conversations.type, "group"),
              eq(conversations.referenceId, groupId.toString()),
              eq(conversations.isActive, true),
            ),
          );

        if (!thread) {
          return res.status(404).json({ message: "Group thread not found" });
        }

        // Check if user has access to this thread
        const participantStatus = await db
          .select({ status: conversationParticipants.status })
          .from(conversationParticipants)
          .where(
            and(
              eq(conversationParticipants.threadId, thread.threadId),
              eq(conversationParticipants.userId, userId),
            ),
          );

        if (
          participantStatus.length === 0 ||
          participantStatus[0].status === "left"
        ) {
          return res
            .status(403)
            .json({ message: "Not authorized to send messages to this group" });
        }

        // Insert the message
        const [message] = await db
          .insert(messagesTable)
          .values({
            content: content.trim(),
            sender: sender || "Anonymous",
            userId: userId,
            threadId: thread.threadId,
            timestamp: new Date(),
          })
          .returning();

        // Update thread's last message timestamp
        await db
          .update(conversations)
          .set({ lastMessageAt: new Date() })
          .where(eq(conversations.id, thread.threadId));

        console.log(
          `[DEBUG] Message sent to group ${groupId} thread ${thread.threadId}`,
        );

        // Broadcast notification via WebSocket if available
        if (typeof (global as any).broadcastNewMessage === "function") {
          await (global as any).broadcastNewMessage(message);
        }

        res.json(message);
      } catch (error) {
        console.error("Error sending group message:", error);
        res.status(500).json({ message: "Failed to send message" });
      }
    },
  );

  // Remove member from group endpoint
  app.delete(
    "/api/message-groups/:groupId/members/:userId",
    isAuthenticated,
    async (req, res) => {
      try {
        const groupId = parseInt(req.params.groupId);
        const targetUserId = req.params.userId;
        const currentUserId = (req as any).user?.id;

        // Platform super admin can manage any group, otherwise check group admin permission
        const currentUser = (req as any).user;
        const isPlatformSuperAdmin = currentUser?.role === "super_admin";

        console.log(
          `[DEBUG] Delete member - Current user:`,
          JSON.stringify(currentUser, null, 2),
        );
        console.log(
          `[DEBUG] Delete member - isPlatformSuperAdmin:`,
          isPlatformSuperAdmin,
        );
        console.log(
          `[DEBUG] Delete member - User role check:`,
          currentUser?.role,
        );
        console.log(
          `[DEBUG] Delete member - User role === 'super_admin':`,
          currentUser?.role === "super_admin",
        );

        if (!isPlatformSuperAdmin) {
          const membership = await db
            .select({ role: conversationParticipants.role })
            .from(conversationParticipants)
            .where(
              and(
                eq(conversationParticipants.groupId, groupId),
                eq(conversationParticipants.userId, currentUserId),
                eq(conversationParticipants.isActive, true),
              ),
            );

          if (membership.length === 0 || membership[0].role !== "admin") {
            return res
              .status(403)
              .json({ message: "Only group admins can remove members" });
          }
        }

        // Only prevent removing other admins if current user is not a platform super admin
        if (!isPlatformSuperAdmin) {
          const targetMembership = await db
            .select({ role: conversationParticipants.role })
            .from(conversationParticipants)
            .where(
              and(
                eq(conversationParticipants.groupId, groupId),
                eq(conversationParticipants.userId, targetUserId),
                eq(conversationParticipants.isActive, true),
              ),
            );

          if (
            targetMembership.length > 0 &&
            targetMembership[0].role === "admin"
          ) {
            return res
              .status(403)
              .json({ message: "Cannot remove group administrators" });
          }
        }

        // Get the thread for this group
        const [thread] = await db
          .select({ threadId: conversations.id })
          .from(conversations)
          .where(
            and(
              eq(conversations.type, "group"),
              eq(conversations.referenceId, groupId.toString()),
              eq(conversations.isActive, true),
            ),
          );

        if (thread) {
          // Update thread participant status to 'left'
          await db
            .update(conversationParticipants)
            .set({ status: "left" })
            .where(
              and(
                eq(conversationParticipants.threadId, thread.threadId),
                eq(conversationParticipants.userId, targetUserId),
              ),
            );
        }

        // Remove from group membership
        await db
          .update(conversationParticipants)
          .set({ isActive: false })
          .where(
            and(
              eq(conversationParticipants.groupId, groupId),
              eq(conversationParticipants.userId, targetUserId),
            ),
          );

        console.log(
          `[DEBUG] Removed user ${targetUserId} from group ${groupId}`,
        );
        res.json({ success: true });
      } catch (error) {
        console.error("Error removing member from group:", error);
        res.status(500).json({ message: "Failed to remove member" });
      }
    },
  );

  // Update member role in group (promote/demote)
  app.patch(
    "/api/message-groups/:groupId/members/:userId/role",
    isAuthenticated,
    async (req, res) => {
      try {
        const groupId = parseInt(req.params.groupId);
        const targetUserId = req.params.userId;
        const currentUserId = (req as any).user?.id;
        const { role } = req.body;
        const currentUser = (req as any).user;

        if (!role || !["admin", "member"].includes(role)) {
          return res
            .status(400)
            .json({ message: "Invalid role. Must be 'admin' or 'member'" });
        }

        // Platform super admin can manage any group, otherwise check group admin permission
        const isPlatformSuperAdmin = currentUser?.role === "super_admin";

        if (!isPlatformSuperAdmin) {
          const membership = await db
            .select({ role: conversationParticipants.role })
            .from(conversationParticipants)
            .where(
              and(
                eq(conversationParticipants.groupId, groupId),
                eq(conversationParticipants.userId, currentUserId),
                eq(conversationParticipants.isActive, true),
              ),
            );

          if (membership.length === 0 || membership[0].role !== "admin") {
            return res
              .status(403)
              .json({ message: "Only group admins can manage member roles" });
          }
        }

        // Update the member's role
        await db
          .update(conversationParticipants)
          .set({ role })
          .where(
            and(
              eq(conversationParticipants.groupId, groupId),
              eq(conversationParticipants.userId, targetUserId),
              eq(conversationParticipants.isActive, true),
            ),
          );

        console.log(
          `[DEBUG] Updated user ${targetUserId} role to ${role} in group ${groupId}`,
        );
        res.json({ success: true });
      } catch (error) {
        console.error("Error updating member role:", error);
        res.status(500).json({ message: "Failed to update member role" });
      }
    },
  );

  // Delete entire group message thread (super admin only)
  app.delete(
    "/api/message-groups/:groupId",
    isAuthenticated,
    async (req, res) => {
      try {
        const groupId = parseInt(req.params.groupId);
        const currentUser = (req as any).user;

        console.log(
          `[DEBUG] Attempting to delete group ${groupId} by user ${currentUser?.id} with role ${currentUser?.role}`,
        );

        // Only platform super admins can delete entire groups
        if (currentUser?.role !== "super_admin") {
          return res
            .status(403)
            .json({
              message: "Only platform super admins can delete message groups",
            });
        }

        // Sequential deletion (Neon HTTP doesn't support transactions)

        // 1. Get the conversation thread for this group
        const [thread] = await db
          .select({ threadId: conversations.id })
          .from(conversations)
          .where(
            and(
              eq(conversations.type, "group"),
              eq(conversations.referenceId, groupId.toString()),
              eq(conversations.isActive, true),
            ),
          );

        console.log(`[DEBUG] Found thread for group ${groupId}:`, thread);

        if (thread) {
          // 2. Delete all messages in the thread (use messagesTable alias)
          const deletedMessages = await db
            .delete(messagesTable)
            .where(eq(messagesTable.threadId, thread.threadId));
          console.log(`[DEBUG] Deleted messages in thread ${thread.threadId}`);

          // 3. Delete all thread participants
          const deletedParticipants = await db
            .delete(conversationParticipants)
            .where(eq(conversationParticipants.threadId, thread.threadId));
          console.log(
            `[DEBUG] Deleted participants for thread ${thread.threadId}`,
          );

          // 4. Mark conversation thread as inactive
          await db
            .update(conversations)
            .set({ isActive: false })
            .where(eq(conversations.id, thread.threadId));
          console.log(`[DEBUG] Marked thread ${thread.threadId} as inactive`);
        }

        // 5. Delete all group memberships
        const deletedMemberships = await db
          .delete(conversationParticipants)
          .where(eq(conversationParticipants.groupId, groupId));
        console.log(`[DEBUG] Deleted memberships for group ${groupId}`);

        // 6. Mark the group as inactive
        await db
          .update(conversations)
          .set({ isActive: false })
          .where(eq(conversations.id, groupId));
        console.log(`[DEBUG] Marked group ${groupId} as inactive`);

        console.log(
          `[DEBUG] Super admin successfully deleted entire group ${groupId}`,
        );
        res.json({ success: true, message: "Group deleted successfully" });
      } catch (error) {
        console.error("Error deleting group:", error);
        console.error("Full error details:", error.message, error.stack);
        res
          .status(500)
          .json({ message: `Failed to delete group: ${error.message}` });
      }
    },
  );

  // System performance monitoring endpoint
  app.get("/api/system/health", isAuthenticated, (req, res) => {
    try {
      const stats = QueryOptimizer.getCacheStats();
      const memoryUsage = process.memoryUsage();

      res.json({
        status: "healthy",
        timestamp: new Date().toISOString(),
        cache: {
          size: stats.size,
          activeKeys: stats.keys.length,
        },
        memory: {
          used: Math.round(memoryUsage.heapUsed / 1024 / 1024) + "MB",
          total: Math.round(memoryUsage.heapTotal / 1024 / 1024) + "MB",
        },
        uptime: Math.round(process.uptime()) + "s",
      });
    } catch (error) {
      res.status(500).json({ status: "error", message: "Health check failed" });
    }
  });

  // Weekly monitoring endpoints
  app.get("/api/monitoring/weekly-status", isAuthenticated, async (req, res) => {
    try {
      const submissionStatus = await checkWeeklySubmissions();
      res.json(submissionStatus);
    } catch (error) {
      console.error('Error checking weekly submissions:', error);
      res.status(500).json({ error: 'Failed to check weekly submissions' });
    }
  });

  app.get("/api/monitoring/stats", isAuthenticated, async (req, res) => {
    try {
      const submissionStatus = await checkWeeklySubmissions();
      const now = new Date();
      const dayOfWeek = now.getDay();
      
      // Calculate next scheduled check
      let nextCheck = "Thursday 7:00 PM";
      if (dayOfWeek === 4 && now.getHours() >= 19) {
        nextCheck = "Friday 8:00 AM";
      } else if (dayOfWeek === 5 && now.getHours() >= 8) {
        nextCheck = "Next Thursday 7:00 PM";
      }

      // Get current week range (Wednesday to Tuesday) to display proper week period
      const { getCurrentWeekRange } = await import('./weekly-monitoring');
      const { startDate, endDate } = getCurrentWeekRange();
      
      // Format week display as "Wed Aug 14 - Tue Aug 20, 2025"
      const weekDisplay = `${startDate.toLocaleDateString('en-US', { 
        weekday: 'short', 
        month: 'short', 
        day: 'numeric' 
      })} - ${endDate.toLocaleDateString('en-US', { 
        weekday: 'short', 
        month: 'short', 
        day: 'numeric',
        year: 'numeric' 
      })}`;

      const stats = {
        currentWeek: weekDisplay,
        totalExpectedLocations: submissionStatus.length,
        submittedLocations: submissionStatus.filter(s => s.hasSubmitted).length,
        missingLocations: submissionStatus.filter(s => !s.hasSubmitted).length,
        lastCheckTime: now.toLocaleString(),
        nextScheduledCheck: nextCheck
      };

      res.json(stats);
    } catch (error) {
      console.error('Error getting monitoring stats:', error);
      res.status(500).json({ error: 'Failed to get monitoring stats' });
    }
  });

  app.post("/api/monitoring/check-now", isAuthenticated, async (req, res) => {
    try {
      await runWeeklyMonitoring();
      res.json({ success: true, message: 'Weekly monitoring check completed' });
    } catch (error) {
      console.error('Error running weekly monitoring:', error);
      res.status(500).json({ error: 'Failed to run weekly monitoring' });
    }
  });

  app.post("/api/monitoring/test-email", isAuthenticated, async (req, res) => {
    try {
      // Create sample test data for the email
      const testSubmissionStatus = [
        {
          location: "Sample Host Location 1",
          hasSubmitted: false,
          lastSubmissionDate: undefined,
          missingSince: "2025-08-10"
        },
        {
          location: "Sample Host Location 2", 
          hasSubmitted: false,
          lastSubmissionDate: "2025-08-10",
          missingSince: "2025-08-10"
        },
        {
          location: "Sample Host Location 3 (Submitted)", 
          hasSubmitted: true,
          lastSubmissionDate: new Date().toISOString().split('T')[0],
          missingSince: undefined
        }
      ];

      // Send test email with sample data
      const emailSent = await sendMissingSubmissionsEmail(testSubmissionStatus, true); // Add isTest flag
      
      if (emailSent) {
        res.json({ success: true, message: 'Test email sent successfully with sample data' });
      } else {
        res.json({ success: false, message: 'Test email not sent - SendGrid not configured' });
      }
    } catch (error) {
      console.error('Error sending test email:', error);
      res.status(500).json({ error: 'Failed to send test email' });
    }
  });

  // New enhanced monitoring routes
  app.get("/api/monitoring/weekly-status/:weeksAgo", isAuthenticated, async (req, res) => {
    try {
      const weeksAgo = parseInt(req.params.weeksAgo) || 0;
      const { checkWeeklySubmissions } = await import('./weekly-monitoring');
      const submissionStatus = await checkWeeklySubmissions(weeksAgo);
      res.json(submissionStatus);
    } catch (error) {
      console.error('Error checking weekly submissions:', error);
      res.status(500).json({ error: 'Failed to check weekly submissions' });
    }
  });

  app.get("/api/monitoring/multi-week-report/:numberOfWeeks", isAuthenticated, async (req, res) => {
    try {
      const numberOfWeeks = parseInt(req.params.numberOfWeeks) || 4;
      const { generateMultiWeekReport } = await import('./weekly-monitoring');
      const report = await generateMultiWeekReport(numberOfWeeks);
      res.json(report);
    } catch (error) {
      console.error('Error generating multi-week report:', error);
      res.status(500).json({ error: 'Failed to generate multi-week report' });
    }
  });

  app.post("/api/monitoring/check-week/:weeksAgo", isAuthenticated, async (req, res) => {
    try {
      const weeksAgo = parseInt(req.params.weeksAgo) || 0;
      const { checkWeeklySubmissions, sendMissingSubmissionsEmail, getWeekRange } = await import('./weekly-monitoring');
      
      const submissionStatus = await checkWeeklySubmissions(weeksAgo);
      const { startDate } = getWeekRange(weeksAgo);
      const weekLabel = `Week of ${startDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`;
      
      // Optionally send email for missing submissions
      const missingSubmissions = submissionStatus.filter(s => !s.hasSubmitted);
      if (missingSubmissions.length > 0) {
        await sendMissingSubmissionsEmail(submissionStatus, false, weekLabel);
      }
      
      res.json({ 
        success: true, 
        message: `Check completed for ${weekLabel}`,
        submissionStatus,
        missingCount: missingSubmissions.length
      });
    } catch (error) {
      console.error('Error checking specific week:', error);
      res.status(500).json({ error: 'Failed to check specific week' });
    }
  });

  // SMS Reminder Routes
  app.post("/api/monitoring/send-sms-reminders", isAuthenticated, async (req, res) => {
    try {
      const { missingLocations, appUrl } = req.body;
      const { sendWeeklyReminderSMS } = await import('./sms-service');
      
      if (!missingLocations || !Array.isArray(missingLocations)) {
        return res.status(400).json({ error: 'Missing locations array is required' });
      }

      const results = await sendWeeklyReminderSMS(missingLocations, appUrl);
      
      const successCount = Object.values(results).filter(r => r.success).length;
      const totalCount = Object.keys(results).length;
      
      res.json({
        success: successCount > 0,
        message: `SMS reminders sent to ${successCount}/${totalCount} locations`,
        results
      });
    } catch (error) {
      console.error('Error sending SMS reminders:', error);
      res.status(500).json({ error: 'Failed to send SMS reminders' });
    }
  });

  app.post("/api/monitoring/send-sms-reminder/:location", isAuthenticated, async (req, res) => {
    try {
      const location = decodeURIComponent(req.params.location);
      const { appUrl } = req.body;
      const { sendSMSReminder } = await import('./sms-service');
      
      const result = await sendSMSReminder(location, appUrl);
      
      res.json(result);
    } catch (error) {
      console.error('Error sending SMS reminder:', error);
      res.status(500).json({ error: 'Failed to send SMS reminder' });
    }
  });

  app.post("/api/monitoring/test-sms", isAuthenticated, async (req, res) => {
    try {
      const { phoneNumber, appUrl } = req.body;
      const { sendTestSMS } = await import('./sms-service');
      
      if (!phoneNumber) {
        return res.status(400).json({ error: 'Phone number is required' });
      }
      
      const result = await sendTestSMS(phoneNumber, appUrl);
      
      res.json(result);
    } catch (error) {
      console.error('Error sending test SMS:', error);
      res.status(500).json({ error: 'Failed to send test SMS' });
    }
  });

  app.get("/api/monitoring/sms-config", isAuthenticated, async (req, res) => {
    try {
      const { validateSMSConfig } = await import('./sms-service');
      
      const config = validateSMSConfig();
      
      res.json(config);
    } catch (error) {
      console.error('Error checking SMS config:', error);
      res.status(500).json({ error: 'Failed to check SMS configuration' });
    }
  });

  // Email Reminder Routes
  app.post("/api/monitoring/send-email-reminder/:location", isAuthenticated, async (req, res) => {
    try {
      const location = decodeURIComponent(req.params.location);
      const { appUrl } = req.body;
      const { sendEmailReminder } = await import('./weekly-monitoring');
      
      const result = await sendEmailReminder(location, appUrl);
      
      res.json(result);
    } catch (error) {
      console.error('Error sending email reminder:', error);
      res.status(500).json({ error: 'Failed to send email reminder' });
    }
  });

  // SMS user routes
  app.get("/api/users/sms-status", isAuthenticated, async (req, res) => {
    try {
      const user = req.user;
      if (!user?.id) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const userRecord = await storage.getUserById(user.id);
      if (!userRecord) {
        return res.status(404).json({ error: 'User not found' });
      }

      const metadata = userRecord.metadata || {};
      const smsConsent = metadata.smsConsent || {};

      res.json({
        hasOptedIn: !!smsConsent.enabled,
        phoneNumber: smsConsent.phoneNumber || null,
        optInDate: smsConsent.optInDate || null
      });
    } catch (error) {
      console.error('Error getting SMS status:', error);
      res.status(500).json({ error: 'Failed to get SMS status' });
    }
  });

  app.post("/api/users/sms-opt-in", isAuthenticated, async (req, res) => {
    try {
      const user = req.user;
      const { phoneNumber, consent } = req.body;

      if (!user?.id) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      if (!phoneNumber || !consent) {
        return res.status(400).json({ error: 'Phone number and consent are required' });
      }

      // Clean and format phone number
      const cleanPhone = phoneNumber.replace(/\D/g, '');
      if (cleanPhone.length !== 10) {
        return res.status(400).json({ error: 'Please enter a valid 10-digit phone number' });
      }
      const formattedPhone = `+1${cleanPhone}`;

      // Update user metadata with SMS consent
      const userRecord = await storage.getUserById(user.id);
      if (!userRecord) {
        return res.status(404).json({ error: 'User not found' });
      }

      const metadata = userRecord.metadata || {};
      metadata.smsConsent = {
        enabled: true,
        phoneNumber: formattedPhone,
        displayPhone: phoneNumber, // Keep original formatted version for display
        optInDate: new Date().toISOString(),
        consent: true
      };

      await storage.updateUser(user.id, { metadata });

      console.log(`✅ User ${user.email} opted in to SMS with phone ${formattedPhone}`);

      res.json({
        success: true,
        message: 'Successfully opted in to SMS reminders',
        phoneNumber: formattedPhone
      });
    } catch (error) {
      console.error('Error opting in to SMS:', error);
      res.status(500).json({ error: 'Failed to opt in to SMS reminders' });
    }
  });

  app.post("/api/users/sms-opt-out", isAuthenticated, async (req, res) => {
    try {
      const user = req.user;
      if (!user?.id) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      // Update user metadata to disable SMS consent
      const userRecord = await storage.getUserById(user.id);
      if (!userRecord) {
        return res.status(404).json({ error: 'User not found' });
      }

      const metadata = userRecord.metadata || {};
      metadata.smsConsent = {
        enabled: false,
        phoneNumber: null,
        displayPhone: null,
        optOutDate: new Date().toISOString(),
        consent: false
      };

      await storage.updateUser(user.id, { metadata });

      console.log(`✅ User ${user.email} opted out of SMS`);

      res.json({
        success: true,
        message: 'Successfully opted out of SMS reminders'
      });
    } catch (error) {
      console.error('Error opting out of SMS:', error);
      res.status(500).json({ error: 'Failed to opt out of SMS reminders' });
    }
  });

  // Register SMS announcement routes
  const { smsAnnouncementRoutes } = await import('./routes/sms-announcement');
  app.use("/api/sms-announcement", smsAnnouncementRoutes);

  // Register Google Sheets routes
  app.use("/api/google-sheets", googleSheetsRoutes);
  
  // Register Suggestions Portal routes
  app.use("/api/suggestions", suggestionsRoutes);
  
  // Register Email-style messaging routes

  
  // Register Messaging routes
  const { messagingRoutes } = await import("./routes/messaging");
  app.use("/api/messaging", messagingRoutes);

  // Google Sheets sync endpoint for individual collection entries
  app.post("/api/google-sheets/sync-entry", async (req, res) => {
    try {
      const { collectionData } = req.body;

      if (!collectionData) {
        return res.status(400).json({ error: "Collection data is required" });
      }

      // Import the sync service dynamically to avoid dependency issues
      const { GoogleSheetsSyncService } = await import("./google-sheets-sync");

      // Create minimal storage interface for the sync
      const mockStorage = {
        getAllSandwichCollections: async () => [],
        createSandwichCollection: async (data: any) => data,
      };

      const syncService = new GoogleSheetsSyncService(mockStorage);

      // Add the entry to the ReplitDatabase sheet
      await syncService.addEntryToSheet(collectionData);

      res.json({
        success: true,
        message: "Entry synced to Google Sheets successfully",
      });
    } catch (error: any) {
      console.error("Error syncing entry to Google Sheets:", error);
      res.status(500).json({
        error: "Failed to sync to Google Sheets",
        details: error.message,
      });
    }
  });

  // Set up WebSocket server for real-time notifications
  const wss = new WebSocketServer({
    server: httpServer,
    path: "/notifications",
  });
  const connectedClients = new Map<string, WebSocket[]>();

  wss.on("connection", (ws: WebSocket, request) => {
    console.log("WebSocket client connected");

    // Add connection state tracking
    let isAlive = true;
    let userId: string | null = null;

    // Setup heartbeat to detect disconnected clients
    const heartbeatInterval = setInterval(() => {
      if (!isAlive) {
        // Connection is dead, clean up
        clearInterval(heartbeatInterval);
        ws.terminate();
        return;
      }
      isAlive = false;
      ws.ping();
    }, 30000); // Ping every 30 seconds

    ws.on("pong", () => {
      isAlive = true;
    });

    ws.on("message", (message: string) => {
      try {
        const data = JSON.parse(message);

        if (data.type === "identify" && data.userId) {
          userId = data.userId;
          // Associate WebSocket with user ID
          if (!connectedClients.has(data.userId)) {
            connectedClients.set(data.userId, []);
          }
          connectedClients.get(data.userId)!.push(ws);
          console.log(`User ${data.userId} connected via WebSocket`);
        }
      } catch (error) {
        console.error("Error parsing WebSocket message:", error);
      }
    });

    ws.on("close", () => {
      // Clean up heartbeat
      clearInterval(heartbeatInterval);

      // Remove WebSocket from all user associations
      if (userId) {
        const clients = connectedClients.get(userId);
        if (clients) {
          const index = clients.indexOf(ws);
          if (index > -1) {
            clients.splice(index, 1);
            if (clients.length === 0) {
              connectedClients.delete(userId);
            }
            console.log(`User ${userId} disconnected from WebSocket`);
          }
        }
      }
    });

    ws.on("error", (error) => {
      console.error("WebSocket error:", error);
      // Clean up on error
      clearInterval(heartbeatInterval);
      ws.terminate();
    });
  });

  // Helper function to get users with access to a specific chat
  const getUsersWithChatAccess = async (
    chatName: string,
  ): Promise<string[]> => {
    try {
      // Import chat permissions from shared utilities
      const { CHAT_PERMISSIONS } = await import("../shared/auth-utils.js");
      const requiredPermission =
        CHAT_PERMISSIONS[chatName as keyof typeof CHAT_PERMISSIONS];

      if (!requiredPermission) {
        console.log(`No permission mapping found for chat: ${chatName}`);
        return [];
      }

      // Get all users with the required permission
      const users = await storage.getAllUsers();
      const usersWithAccess = users
        .filter(
          (user) =>
            user.permissions && user.permissions.includes(requiredPermission),
        )
        .map((user) => user.id);

      console.log(`Users with access to ${chatName} chat:`, usersWithAccess);
      return usersWithAccess;
    } catch (error) {
      console.error("Error getting users with chat access:", error);
      return [];
    }
  };

  // Function to broadcast new message notifications
  const broadcastNewMessage = async (message: any) => {
    try {
      console.log("broadcastNewMessage called with:", message);
      console.log("Connected clients count:", connectedClients.size);

      const notificationData = {
        type: "new_message",
        messageId: message.id,
        sender: message.sender,
        content: message.content,
        committee: message.committee,
        timestamp: message.timestamp,
        recipientId: message.recipientId,
      };

      // Determine who should receive this notification based on chat permissions
      let targetUsers = new Set<string>();

      if (message.committee === "direct" && message.recipientId) {
        // Direct message - notify recipient only
        targetUsers.add(message.recipientId);
        console.log(
          "Direct message, notifying recipient:",
          message.recipientId,
        );
      } else {
        // Committee/chat room message - notify only users with access to that specific chat
        const usersWithAccess = await getUsersWithChatAccess(message.committee);

        for (const userId of usersWithAccess) {
          // Don't notify the sender
          if (userId !== message.userId) {
            targetUsers.add(userId);
          }
        }
        console.log(
          `${message.committee} chat message, target users:`,
          Array.from(targetUsers),
        );
      }

      // Send notifications to target users
      let sentCount = 0;
      for (const userId of targetUsers) {
        const userClients = connectedClients.get(userId);
        console.log(
          `Checking user ${userId}, clients:`,
          userClients?.length || 0,
        );
        if (userClients) {
          userClients.forEach((client) => {
            if (client.readyState === WebSocket.OPEN) {
              console.log("Sending notification to client:", notificationData);
              client.send(JSON.stringify(notificationData));
              sentCount++;
            } else {
              console.log("Client not ready, readyState:", client.readyState);
            }
          });
        }
      }
      console.log(`Sent ${sentCount} notifications total`);
    } catch (error) {
      console.error("Error broadcasting message notification:", error);
    }
  };

  // Task assignment notification broadcasting function
  const broadcastTaskAssignment = (userId: string, notificationData: any) => {
    try {
      console.log(
        `Broadcasting task assignment notification to user: ${userId}`,
      );
      const userClients = connectedClients.get(userId);

      if (userClients) {
        let sentCount = 0;
        userClients.forEach((client) => {
          if (client.readyState === WebSocket.OPEN) {
            console.log(
              "Sending task assignment notification to client:",
              notificationData,
            );
            client.send(
              JSON.stringify({
                type: "notification",
                data: notificationData,
              }),
            );
            sentCount++;
          }
        });
        console.log(
          `Sent task assignment notification to ${sentCount} clients for user ${userId}`,
        );
      } else {
        console.log(`No connected clients found for user ${userId}`);
      }
    } catch (error) {
      console.error("Error broadcasting task assignment notification:", error);
    }
  };

  // Notification API endpoints
  app.get("/api/notifications", isAuthenticated, async (req: any, res) => {
    try {
      const user = (req as any).user; // Standardized authentication
      const notifications = await storage.getUserNotifications(user.id);
      res.json(notifications);
    } catch (error) {
      console.error("Error fetching notifications:", error);
      res.status(500).json({ error: "Failed to fetch notifications" });
    }
  });

  app.patch(
    "/api/notifications/:id/read",
    isAuthenticated,
    async (req: any, res) => {
      try {
        const notificationId = parseInt(req.params.id);
        const success = await storage.markNotificationAsRead(notificationId);
        if (!success) {
          return res.status(404).json({ error: "Notification not found" });
        }
        res.json({ success: true });
      } catch (error) {
        console.error("Error marking notification as read:", error);
        res.status(500).json({ error: "Failed to mark notification as read" });
      }
    },
  );

  app.patch(
    "/api/notifications/mark-all-read",
    isAuthenticated,
    async (req: any, res) => {
      try {
        const user = (req as any).user; // Standardized authentication
        const success = await storage.markAllNotificationsAsRead(user.id);
        res.json({ success });
      } catch (error) {
        console.error("Error marking all notifications as read:", error);
        res
          .status(500)
          .json({ error: "Failed to mark all notifications as read" });
      }
    },
  );

  // Helper function to format messages for Gmail interface
  async function formatMessagesForGmail(messages: any[], user: any, db: any) {
    // Get conversation participants for each message to determine recipients
    const conversationIds = [...new Set(messages.map(msg => msg.conversationId))].filter(id => id);
    let participantsByConversation = {};
    
    if (conversationIds.length > 0) {
      const participantsData = await db
        .select({
          conversationId: conversationParticipants.conversationId,
          userId: conversationParticipants.userId,
          firstName: users.firstName,
          lastName: users.lastName,
          email: users.email,
          displayName: users.displayName,
        })
        .from(conversationParticipants)
        .leftJoin(users, eq(conversationParticipants.userId, users.id))
        .where(inArray(conversationParticipants.conversationId, conversationIds));

      // Group participants by conversation
      participantsByConversation = participantsData.reduce((acc, p) => {
        if (!acc[p.conversationId]) acc[p.conversationId] = [];
        acc[p.conversationId].push(p);
        return acc;
      }, {} as Record<number, any[]>);
    }

    // Transform to match Gmail inbox expected format with proper user data
    return messages.map((msg) => {
      // Construct sender name from available data with proper null checks
      let senderName = "Unknown User";
      if (msg.senderDisplayName) {
        senderName = msg.senderDisplayName;
      } else if (msg.sender) {
        senderName = msg.sender;
      } else if (msg.senderFirstName || msg.senderLastName) {
        senderName = `${msg.senderFirstName || ''} ${msg.senderLastName || ''}`.trim();
      } else if (msg.senderEmail) {
        senderName = msg.senderEmail;
      }
      
      // Get participants for this conversation
      const participants = participantsByConversation[msg.conversationId] || [];
      
      // Filter out current user and sender from recipients list
      const recipients = participants.filter(p => 
        p.userId !== user.id && p.userId !== msg.senderId
      );
      
      // Construct recipient names list for "To:" field
      let recipientNames = "Unknown Recipients";
      if (recipients.length > 0) {
        recipientNames = recipients.map(r => {
          if (r.displayName) return r.displayName;
          if (r.firstName || r.lastName) return `${r.firstName || ''} ${r.lastName || ''}`.trim();
          return r.email || "Unknown";
        }).join(", ");
      } else if (participants.length > 1) {
        // Group conversation - show all other participants
        recipientNames = participants
          .filter(p => p.userId !== user.id)
          .map(r => {
            if (r.displayName) return r.displayName;
            if (r.firstName || r.lastName) return `${r.firstName || ''} ${r.lastName || ''}`.trim();
            return r.email || "Unknown";
          }).join(", ");
      }

      return {
        id: msg.id,
        content: msg.content,
        senderId: msg.senderId,
        senderName: senderName,
        senderEmail: msg.senderEmail || "unknown@example.com",
        recipientId: recipients.length > 0 ? recipients[0].userId : user.id,
        recipientName: recipientNames, // This will show "John, Sarah" for group conversations
        recipientEmail: recipients.length > 0 ? recipients[0].email : user.email,
        subject: participants.length > 2 ? `Group Chat (${participants.length} people)` : "Direct Message",
        createdAt: msg.createdAt,
        threadId: msg.conversationId,
        isRead: true,
        isStarred: msg.isStarred || false,
        folder: "inbox",
        committee: "conversation",
      };
    });
  }

  // Gmail-style inbox endpoints - using emailMessages table with proper Gmail fields
  app.get("/api/messages", isAuthenticated, async (req, res) => {
    console.log("=== GMAIL INBOX DEBUG ===");
    console.log("User:", (req as any).user?.email, "ID:", (req as any).user?.id);
    console.log("Query:", req.query);
    
    try {
      const user = (req as any).user;
      if (!user?.id) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const chatType = req.query.chatType as string;
      console.log("Chat type requested:", chatType);

      // Handle different Gmail folder types using emailMessages table
      if (chatType === "starred") {
        console.log("Starred folder requested - showing starred email messages");
        
        // Get starred email messages for this user
        const starredEmails = await db
          .select()
          .from(emailMessages)
          .where(and(
            or(
              eq(emailMessages.senderId, user.id),
              eq(emailMessages.recipientId, user.id)
            ),
            eq(emailMessages.isStarred, true),
            eq(emailMessages.isTrashed, false)
          ))
          .orderBy(desc(emailMessages.createdAt))
          .limit(50);
          
        console.log(`Found ${starredEmails.length} starred email messages`);
        return res.json(starredEmails.map(email => ({
          id: email.id,
          senderId: email.senderId,
          senderName: email.senderName,
          senderEmail: email.senderEmail,
          recipientId: email.recipientId,
          recipientName: email.recipientName,
          recipientEmail: email.recipientEmail,
          content: email.content,
          subject: email.subject,
          createdAt: email.createdAt,
          threadId: email.parentMessageId || email.id,
          isRead: email.isRead,
          isStarred: email.isStarred,
          folder: "starred",
          committee: email.contextType || "email"
        })));
      }
      
      if (chatType === "drafts") {
        console.log("Drafts folder requested - showing draft email messages");
        
        // Get draft email messages for this user
        const draftEmails = await db
          .select()
          .from(emailMessages)
          .where(and(
            eq(emailMessages.senderId, user.id),
            eq(emailMessages.isDraft, true)
          ))
          .orderBy(desc(emailMessages.createdAt))
          .limit(50);
          
        console.log(`Found ${draftEmails.length} draft email messages`);
        return res.json(draftEmails.map(email => ({
          id: email.id,
          senderId: email.senderId,
          senderName: email.senderName,
          senderEmail: email.senderEmail,
          recipientId: email.recipientId,
          recipientName: email.recipientName,
          recipientEmail: email.recipientEmail,
          content: email.content,
          subject: email.subject,
          createdAt: email.createdAt,
          threadId: email.parentMessageId || email.id,
          isRead: email.isRead,
          isStarred: email.isStarred,
          folder: "drafts",
          committee: email.contextType || "email"
        })));
      }
      
      if (chatType === "sent") {
        console.log("Sent folder requested - showing email messages sent by this user");
        
        // Get email messages sent BY this user
        const sentEmails = await db
          .select()
          .from(emailMessages)
          .where(and(
            eq(emailMessages.senderId, user.id),
            eq(emailMessages.isDraft, false),
            eq(emailMessages.isTrashed, false)
          ))
          .orderBy(desc(emailMessages.createdAt))
          .limit(50);
          
        console.log(`Found ${sentEmails.length} sent email messages`);
        return res.json(sentEmails.map(email => ({
          id: email.id,
          senderId: email.senderId,
          senderName: email.senderName,
          senderEmail: email.senderEmail,
          recipientId: email.recipientId,
          recipientName: email.recipientName,
          recipientEmail: email.recipientEmail,
          content: email.content,
          subject: email.subject,
          createdAt: email.createdAt,
          threadId: email.parentMessageId || email.id,
          isRead: email.isRead,
          isStarred: email.isStarred,
          folder: "sent",
          committee: email.contextType || "email"
        })));
      }
      
      if (chatType === "archived") {
        console.log("Archived folder requested - showing archived email messages");
        
        // Get archived email messages for this user
        const archivedEmails = await db
          .select()
          .from(emailMessages)
          .where(and(
            or(
              eq(emailMessages.senderId, user.id),
              eq(emailMessages.recipientId, user.id)
            ),
            eq(emailMessages.isArchived, true),
            eq(emailMessages.isTrashed, false)
          ))
          .orderBy(desc(emailMessages.createdAt))
          .limit(50);
          
        console.log(`Found ${archivedEmails.length} archived email messages`);
        return res.json(archivedEmails.map(email => ({
          id: email.id,
          senderId: email.senderId,
          senderName: email.senderName,
          senderEmail: email.senderEmail,
          recipientId: email.recipientId,
          recipientName: email.recipientName,
          recipientEmail: email.recipientEmail,
          content: email.content,
          subject: email.subject,
          createdAt: email.createdAt,
          threadId: email.parentMessageId || email.id,
          isRead: email.isRead,
          isStarred: email.isStarred,
          folder: "archived",
          committee: email.contextType || "email"
        })));
      }
      
      if (chatType === "trash") {
        console.log("Trash folder requested - showing trashed email messages");
        
        // Get trashed email messages for this user
        const trashedEmails = await db
          .select()
          .from(emailMessages)
          .where(and(
            or(
              eq(emailMessages.senderId, user.id),
              eq(emailMessages.recipientId, user.id)
            ),
            eq(emailMessages.isTrashed, true)
          ))
          .orderBy(desc(emailMessages.createdAt))
          .limit(50);
          
        console.log(`Found ${trashedEmails.length} trashed email messages`);
        return res.json(trashedEmails.map(email => ({
          id: email.id,
          senderId: email.senderId,
          senderName: email.senderName,
          senderEmail: email.senderEmail,
          recipientId: email.recipientId,
          recipientName: email.recipientName,
          recipientEmail: email.recipientEmail,
          content: email.content,
          subject: email.subject,
          createdAt: email.createdAt,
          threadId: email.parentMessageId || email.id,
          isRead: email.isRead,
          isStarred: email.isStarred,
          folder: "trash",
          committee: email.contextType || "email"
        })));
      }

      // For inbox and any other context (default case), show inbox email messages
      console.log("Inbox folder requested - showing inbox email messages");
      
      // Get inbox email messages for this user (not drafts, not trashed, not archived)
      const inboxEmails = await db
        .select()
        .from(emailMessages)
        .where(and(
          or(
            eq(emailMessages.senderId, user.id),
            eq(emailMessages.recipientId, user.id)
          ),
          eq(emailMessages.isDraft, false),
          eq(emailMessages.isTrashed, false),
          eq(emailMessages.isArchived, false)
        ))
        .orderBy(desc(emailMessages.createdAt))
        .limit(50);

      console.log(`Found ${inboxEmails.length} inbox email messages`);
      return res.json(inboxEmails.map(email => ({
        id: email.id,
        senderId: email.senderId,
        senderName: email.senderName,
        senderEmail: email.senderEmail,
        recipientId: email.recipientId,
        recipientName: email.recipientName,
        recipientEmail: email.recipientEmail,
        content: email.content,
        subject: email.subject,
        createdAt: email.createdAt,
        threadId: email.parentMessageId || email.id,
        isRead: email.isRead,
        isStarred: email.isStarred,
        folder: "inbox",
        committee: email.contextType || "email"
      })));

      console.log("=== INBOX DEBUG END ===");
    } catch (error) {
      console.error("[API] Error fetching messages:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/messages", isAuthenticated, async (req, res) => {
    console.log("=== POST /api/messages START ===");
    try {
      const user = (req as any).user;
      console.log("[STEP 1] User authentication check:");
      console.log("  - req.user exists:", !!user);
      console.log("  - user object:", user);
      console.log("  - user.id:", user?.id);
      console.log("  - user.firstName:", user?.firstName);
      console.log("  - user.lastName:", user?.lastName);
      console.log("  - user.email:", user?.email);

      console.log("[STEP 2] Request body:");
      console.log("  - req.body:", req.body);
      console.log("  - content:", req.body?.content);
      console.log("  - sender:", req.body?.sender);
      console.log("  - conversationName:", req.body?.conversationName);
      console.log("  - recipientId:", req.body?.recipientId);
      console.log("  - conversationId:", req.body?.conversationId);

      if (!user?.id) {
        console.log("[ERROR] No user.id found, returning 401");
        return res.status(401).json({ message: "Unauthorized" });
      }

      const { content, sender, conversationName, recipientId, conversationId } = req.body;

      if (!content || !content.trim()) {
        console.log("[ERROR] No content provided, returning 400");
        return res.status(400).json({ message: "Message content is required" });
      }

      console.log("[STEP 3] Finding or creating conversation...");
      console.log("  - conversationId:", req.body?.conversationId);

      let targetConversation;
      let conversationType = "channel";
      let finalConversationName = conversationName && conversationName.trim() ? conversationName.trim() : null;

      // Check if this is a reply to an existing conversation
      if (conversationId) {
        console.log("  - Looking for existing conversation with ID:", conversationId);
        try {
          const existingConversations = await db
            .select()
            .from(conversations)
            .where(eq(conversations.id, conversationId))
            .limit(1);
          
          if (existingConversations.length > 0) {
            targetConversation = existingConversations[0];
            console.log("  - Found existing conversation for reply:", targetConversation);
          } else {
            console.log("  - No conversation found with ID:", conversationId);
            return res.status(400).json({ message: "Conversation not found" });
          }
        } catch (dbError) {
          console.error("[ERROR] Database query for conversation ID failed:", dbError);
          throw dbError;
        }
      }
      // If recipientId is provided, create/find direct conversation
      else
      if (recipientId && recipientId !== user.id) {
        console.log("  - Creating/finding direct conversation with user:", recipientId);
        conversationType = "direct";
        finalConversationName = null; // Direct messages don't have names
        
        // Look for existing direct conversation between these two users
        try {
          const existingDirectConversations = await db
            .select()
            .from(conversations)
            .innerJoin(conversationParticipants, eq(conversations.id, conversationParticipants.conversationId))
            .where(
              and(
                eq(conversations.type, "direct"),
                or(
                  eq(conversationParticipants.userId, user.id),
                  eq(conversationParticipants.userId, recipientId)
                )
              )
            );

          // Check if we found a conversation with both participants
          for (const conv of existingDirectConversations) {
            const participants = await db
              .select()
              .from(conversationParticipants)
              .where(eq(conversationParticipants.conversationId, conv.conversations.id));
            
            const participantIds = participants.map(p => p.userId);
            if (participantIds.includes(user.id) && participantIds.includes(recipientId) && participantIds.length === 2) {
              targetConversation = conv.conversations;
              console.log("  - Found existing direct conversation:", targetConversation);
              break;
            }
          }
        } catch (dbError) {
          console.error("[ERROR] Database query for direct conversations failed:", dbError);
          throw dbError;
        }
      } else {
        // Look for named channel conversation (or default "team-chat" if no name provided)
        if (!finalConversationName) {
          finalConversationName = "team-chat";
        }
        try {
          const existingConversations = await db
            .select()
            .from(conversations)
            .where(
              and(
                eq(conversations.type, "channel"),
                eq(conversations.name, finalConversationName),
              ),
            );

          console.log("  - Found existing conversations:", existingConversations.length);
          targetConversation = existingConversations[0];

          if (targetConversation) {
            console.log("  - Using existing conversation:", targetConversation);
          }
        } catch (dbError) {
          console.error("[ERROR] Database query for conversations failed:", dbError);
          throw dbError;
        }
      }

      if (!targetConversation) {
        console.log("[STEP 4] Creating new conversation...");
        try {
          const newConversationData = {
            type: conversationType,
            name: finalConversationName,
          };
          console.log("  - Conversation data to insert:", newConversationData);

          const newConversations = await db
            .insert(conversations)
            .values(newConversationData)
            .returning();

          targetConversation = newConversations[0];
          console.log("  - Created new conversation:", targetConversation);

          // Add participants to the conversation
          if (conversationType === "direct" && recipientId) {
            // Add both sender and recipient to direct conversation
            await db.insert(conversationParticipants).values([
              { conversationId: targetConversation.id, userId: user.id },
              { conversationId: targetConversation.id, userId: recipientId }
            ]);
            console.log("  - Added participants to direct conversation");
          } else {
            // Add sender to channel conversation
            await db.insert(conversationParticipants).values({
              conversationId: targetConversation.id,
              userId: user.id
            });
            console.log("  - Added sender to channel conversation");
          }
        } catch (dbError) {
          console.error("[ERROR] Database insert for conversations failed:", dbError);
          throw dbError;
        }
      } else {
        // Ensure user is a participant in existing conversation
        try {
          const existingParticipant = await db
            .select()
            .from(conversationParticipants)
            .where(
              and(
                eq(conversationParticipants.conversationId, targetConversation.id),
                eq(conversationParticipants.userId, user.id)
              )
            );

          if (existingParticipant.length === 0) {
            await db.insert(conversationParticipants).values({
              conversationId: targetConversation.id,
              userId: user.id
            });
            console.log("  - Added user as participant to existing conversation");
          }
        } catch (dbError) {
          console.error("[ERROR] Failed to add participant:", dbError);
          throw dbError;
        }
      }

      const userName =
        sender ||
        `${user.firstName} ${user.lastName}` ||
        user.email ||
        "Unknown User";
      console.log("[STEP 5] Preparing message data:");
      console.log("  - userName:", userName);
      console.log("  - conversationId:", targetConversation.id);
      console.log("  - userId:", user.id);
      console.log("  - content:", content.trim());

      const messageData = {
        conversationId: targetConversation.id,
        userId: user.id,
        senderId: user.id,
        content: content.trim(),
        sender: userName,
      };
      console.log("  - Complete message data:", messageData);

      console.log("[STEP 6] Inserting message into database...");
      let message;
      try {
        const insertedMessages = await db
          .insert(messagesTable)
          .values(messageData)
          .returning();

        message = insertedMessages[0];
        console.log("  - Inserted message successfully:", message);
      } catch (dbError) {
        console.error("[ERROR] Database insert for messages failed:", dbError);
        console.error("  - Error details:", {
          message: dbError.message,
          code: dbError.code,
          detail: dbError.detail,
          hint: dbError.hint,
        });
        throw dbError;
      }

      console.log("[STEP 7] Broadcasting message...");
      // Broadcast via WebSocket if available
      if (broadcastNewMessage) {
        const broadcastData = {
          type: "new_message",
          conversationId: targetConversation.id,
          message: {
            id: message.id,
            content: message.content,
            userId: message.userId,
            sender: userName,
            timestamp: message.createdAt,
            committee: conversationType === "direct" ? "direct" : finalConversationName || "general",
          },
        };
        console.log("  - Broadcasting data:", broadcastData);
        broadcastNewMessage(broadcastData);
      } else {
        console.log("  - No broadcast function available");
      }

      const responseData = {
        id: message.id,
        content: message.content,
        userId: message.userId,
        sender: userName,
        timestamp: message.createdAt,
        conversationId: targetConversation.id,
        conversationType: conversationType,
        conversationName: finalConversationName,
        committee: conversationType === "direct" ? "direct" : finalConversationName || "general",
      };
      console.log("[STEP 8] Sending response:", responseData);
      console.log("=== POST /api/messages SUCCESS ===");

      res.json(responseData);
    } catch (error) {
      console.error("=== POST /api/messages ERROR ===");
      console.error("[ERROR] Full error object:", error);
      console.error("[ERROR] Error name:", error.name);
      console.error("[ERROR] Error message:", error.message);
      console.error("[ERROR] Error stack:", error.stack);
      if (error.code) console.error("[ERROR] Error code:", error.code);
      if (error.detail) console.error("[ERROR] Error detail:", error.detail);
      if (error.hint) console.error("[ERROR] Error hint:", error.hint);
      console.error("=== POST /api/messages ERROR END ===");

      res.status(500).json({
        message: "Internal server error",
        error: error.message,
        details: error.detail || "No additional details",
      });
    }
  });

  app.delete("/api/messages/:id", isAuthenticated, async (req, res) => {
    try {
      const user = (req as any).user;
      if (!user?.id) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const messageId = parseInt(req.params.id);

      // Use storage wrapper instead of direct database access
      const message = await storage.getMessageById(messageId);

      if (!message) {
        return res.status(404).json({ message: "Message not found" });
      }

      // Check if user can delete (owner, admin, or super admin)
      const isOwner = message.userId === user.id;
      const isAdmin = user.role === "admin" || user.role === "super_admin";
      const hasModeratePermission =
        user.permissions?.includes("moderate_messages");

      if (!isOwner && !isAdmin && !hasModeratePermission) {
        return res.status(403).json({ message: "Access denied" });
      }

      // Delete the message using storage wrapper
      const deleted = await storage.deleteMessage(messageId);

      if (!deleted) {
        return res.status(404).json({ message: "Message not found" });
      }

      res.status(204).send();
    } catch (error) {
      console.error("[API] Error deleting message:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Archive messages endpoint
  app.patch("/api/messages/archive", isAuthenticated, async (req, res) => {
    try {
      const user = (req as any).user;
      if (!user?.id) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const { messageIds } = req.body;
      if (!messageIds || !Array.isArray(messageIds)) {
        return res.status(400).json({ message: "Invalid messageIds array" });
      }

      // For now, we'll use deletion as archive (since we don't have archive functionality in schema)
      // In a real implementation, you'd update an "archived" field
      let archivedCount = 0;
      
      for (const messageId of messageIds) {
        const message = await storage.getMessageById(messageId);
        if (!message) continue;
        
        // Check permissions - user can archive their own messages, admins can archive any
        const isOwner = message.userId === user.id;
        const isAdmin = user.role === "admin" || user.role === "super_admin";
        const canModerate = user.permissions?.includes("moderate_messages");
        
        if (isOwner || isAdmin || canModerate) {
          // For now we simulate archiving by marking it as archived in content
          // In production you'd have an archived field in schema
          const success = await storage.deleteMessage(messageId);
          if (success) archivedCount++;
        }
      }

      res.json({ 
        message: `${archivedCount} message(s) archived`,
        archivedCount 
      });
    } catch (error) {
      console.error("[API] Error archiving messages:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Trash messages endpoint
  app.patch("/api/messages/trash", isAuthenticated, async (req, res) => {
    try {
      const user = (req as any).user;
      if (!user?.id) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const { messageIds } = req.body;
      if (!messageIds || !Array.isArray(messageIds)) {
        return res.status(400).json({ message: "Invalid messageIds array" });
      }

      // For now, we'll use deletion as trash (since we don't have trash functionality in schema)
      // In a real implementation, you'd update a "trashed" field
      let trashedCount = 0;
      
      for (const messageId of messageIds) {
        const message = await storage.getMessageById(messageId);
        if (!message) continue;
        
        // Check permissions - user can trash their own messages, admins can trash any
        const isOwner = message.userId === user.id;
        const isAdmin = user.role === "admin" || user.role === "super_admin";
        const canModerate = user.permissions?.includes("moderate_messages");
        
        if (isOwner || isAdmin || canModerate) {
          const success = await storage.deleteMessage(messageId);
          if (success) trashedCount++;
        }
      }

      res.json({ 
        message: `${trashedCount} message(s) moved to trash`,
        trashedCount 
      });
    } catch (error) {
      console.error("[API] Error trashing messages:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Simple conversation API endpoints for the new 3-table messaging system
  app.get("/api/conversations", isAuthenticated, async (req, res) => {
    try {
      const user = (req as any).user;
      if (!user?.id) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      // Check for type filter in query params
      const typeFilter = req.query.type as string;

      // Super admins with moderate_messages permission can see all conversations
      const canModerateMessages =
        user.role === "super_admin" ||
        (user.permissions && user.permissions.includes("moderate_messages"));

      let userConversations;

      if (typeFilter === "group") {
        if (canModerateMessages) {
          // Super admins see ALL group conversations
          userConversations = await db
            .select({
              id: conversations.id,
              type: conversations.type,
              name: conversations.name,
              createdAt: conversations.createdAt,
            })
            .from(conversations)
            .where(eq(conversations.type, "group"));
        } else {
          // Regular users see only group conversations they participate in
          userConversations = await db
            .select({
              id: conversations.id,
              type: conversations.type,
              name: conversations.name,
              createdAt: conversations.createdAt,
            })
            .from(conversations)
            .innerJoin(
              conversationParticipants,
              eq(conversations.id, conversationParticipants.conversationId),
            )
            .where(
              and(
                eq(conversations.type, "group"),
                eq(conversationParticipants.userId, user.id),
              ),
            );
        }
      } else {
        // Get all channel conversations (these are public) and user's private conversations
        const channelConversations = await db
          .select({
            id: conversations.id,
            type: conversations.type,
            name: conversations.name,
            createdAt: conversations.createdAt,
          })
          .from(conversations)
          .where(eq(conversations.type, "channel"))
          .orderBy(conversations.id);

        const privateConversations = await db
          .select({
            id: conversations.id,
            type: conversations.type,
            name: conversations.name,
            createdAt: conversations.createdAt,
          })
          .from(conversations)
          .innerJoin(
            conversationParticipants,
            eq(conversations.id, conversationParticipants.conversationId),
          )
          .where(
            and(
              eq(conversations.type, "direct"),
              eq(conversationParticipants.userId, user.id),
            ),
          )
          .groupBy(
            conversations.id,
            conversations.type,
            conversations.name,
            conversations.createdAt,
          );

        userConversations = [...channelConversations, ...privateConversations];
      }

      // Add member counts for group conversations
      if (typeFilter === "group") {
        const conversationsWithCounts = await Promise.all(
          userConversations.map(async (conv) => {
            const memberCount = await db
              .select({ count: sql<number>`count(*)` })
              .from(conversationParticipants)
              .where(eq(conversationParticipants.conversationId, conv.id));

            return {
              id: conv.id,
              name: conv.name,
              description: "", // No description field in current schema
              memberCount: memberCount[0]?.count || 0,
              userRole: "member",
              isActive: true,
              createdAt: conv.createdAt,
              createdBy: "system",
            };
          }),
        );
        res.json(conversationsWithCounts);
      } else {
        res.json(userConversations);
      }
    } catch (error) {
      console.error("[API] Error fetching conversations:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/conversations", isAuthenticated, async (req, res) => {
    try {
      const user = (req as any).user;
      if (!user?.id) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const { type, name, participants = [] } = req.body;

      // Create conversation
      const [conversation] = await db
        .insert(conversations)
        .values({
          type,
          name: name || null,
        })
        .returning();

      // Add participants
      const participantData = participants.map((userId: string) => ({
        conversationId: conversation.id,
        userId,
      }));

      if (participantData.length > 0) {
        await db.insert(conversationParticipants).values(participantData);
      }

      res.json(conversation);
    } catch (error) {
      console.error("[API] Error creating conversation:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get(
    "/api/conversations/:id/messages",
    isAuthenticated,
    async (req, res) => {
      try {
        console.log("[CONVERSATION MESSAGES] Request received for conversation:", req.params.id);
        const user = (req as any).user;
        console.log("[CONVERSATION MESSAGES] User object:", user ? "exists" : "missing");
        if (!user?.id) {
          console.log("[CONVERSATION MESSAGES] No user.id found, returning 401");
          return res.status(401).json({ message: "Unauthorized" });
        }

        const conversationId = parseInt(req.params.id);

        // Check access: participant in conversation OR channel conversations are public
        const [conversation] = await db
          .select({ type: conversations.type })
          .from(conversations)
          .where(eq(conversations.id, conversationId));

        if (!conversation) {
          return res.status(404).json({ message: "Conversation not found" });
        }

        // Channel conversations are accessible to all users
        if (conversation.type !== "channel") {
          // Super admins with moderate_messages permission can access all conversations
          const isSuperAdmin =
            user.role === "super_admin" &&
            user.permissions?.includes("moderate_messages");

          if (!isSuperAdmin) {
            const [participant] = await db
              .select()
              .from(conversationParticipants)
              .where(
                and(
                  eq(conversationParticipants.conversationId, conversationId),
                  eq(conversationParticipants.userId, user.id),
                ),
              );

            if (!participant) {
              return res.status(403).json({ message: "Access denied" });
            }
          }
        }

        console.log(
          "[DEBUG] Fetching messages for conversation ID:",
          conversationId,
        );

        // Use simple select all to avoid field mapping issues
        const conversationMessages = await db
          .select()
          .from(messagesTable)
          .where(eq(messagesTable.conversationId, conversationId))
          .orderBy(messagesTable.createdAt);

        console.log("[DEBUG] Found messages:", conversationMessages.length);
        console.log("[DEBUG] Sample message:", conversationMessages[0]);

        // Transform to match expected format
        const formattedMessages = conversationMessages.map((msg) => ({
          id: msg.id,
          content: msg.content,
          userId: msg.userId,
          user_id: msg.userId,
          sender: msg.sender || "Unknown User",
          createdAt: msg.createdAt,
          created_at: msg.createdAt,
          timestamp: msg.createdAt,
          committee: "conversation", // For compatibility
        }));

        res.json(formattedMessages);
      } catch (error) {
        console.error("[CONVERSATION MESSAGES] Full error details:", error);
        console.error("[CONVERSATION MESSAGES] Error message:", error.message);
        console.error("[CONVERSATION MESSAGES] Error stack:", error.stack);
        res
          .status(500)
          .json({ message: "Internal server error", details: error.message });
      }
    },
  );

  app.post(
    "/api/conversations/:id/messages",
    isAuthenticated,
    async (req, res) => {
      try {
        console.log("=== POST /api/conversations/:id/messages ===");
        console.log("Request params:", req.params);
        console.log("Request body:", req.body);
        
        const user = (req as any).user;
        console.log("User:", user ? { id: user.id, email: user.email } : "none");
        
        if (!user?.id) {
          return res.status(401).json({ message: "Unauthorized" });
        }

        const conversationId = parseInt(req.params.id);
        const { content } = req.body;

        console.log("Conversation ID:", conversationId);
        console.log("Content:", content);

        if (!content || !content.trim()) {
          console.log("ERROR: No content provided");
          return res
            .status(400)
            .json({ message: "Message content is required" });
        }

        // Check access: participant in conversation OR channel conversations are public
        const [conversation] = await db
          .select({ type: conversations.type })
          .from(conversations)
          .where(eq(conversations.id, conversationId));

        if (!conversation) {
          return res.status(404).json({ message: "Conversation not found" });
        }

        // Channel conversations are accessible to all users
        if (conversation.type !== "channel") {
          // Super admins with moderate_messages permission can access all conversations
          const isSuperAdmin =
            user.role === "super_admin" &&
            user.permissions?.includes("moderate_messages");

          if (!isSuperAdmin) {
            const [participant] = await db
              .select()
              .from(conversationParticipants)
              .where(
                and(
                  eq(conversationParticipants.conversationId, conversationId),
                  eq(conversationParticipants.userId, user.id),
                ),
              );

            if (!participant) {
              return res.status(403).json({ message: "Access denied" });
            }
          }
        }

        const userName =
          `${user.firstName} ${user.lastName}` || user.email || "Unknown User";

        const [message] = await db
          .insert(messagesTable)
          .values({
            conversationId,
            userId: user.id,
            senderId: user.id,
            content: content.trim(),
            sender: userName,
          })
          .returning();

        // Broadcast via WebSocket if available
        if (broadcastNewMessage) {
          broadcastNewMessage({
            type: "new_message",
            conversationId,
            message: {
              id: message.id,
              content: message.content,
              userId: message.userId,
              sender: userName,
              timestamp: message.createdAt,
            },
          });
        }

        res.json(message);
      } catch (error) {
        console.error("[API] Error sending message:", error);
        res.status(500).json({ message: "Internal server error" });
      }
    },
  );

  // Get participants for a conversation
  app.get("/api/conversations/:id/participants", isAuthenticated, async (req, res) => {
    try {
      const user = (req as any).user;
      if (!user?.id) {
        console.log('DEBUG: No user ID found in get participants, user object:', user);
        return res.status(401).json({ error: "User not authenticated" });
      }
      
      const conversationId = parseInt(req.params.id);
      const participants = await storage.getConversationParticipants(conversationId);
      console.log(`[PARTICIPANTS] Found ${participants.length} participants for conversation ${conversationId}`);
      res.json(participants);
    } catch (error) {
      console.error("Error fetching conversation participants:", error);
      res.status(500).json({ error: "Failed to fetch participants" });
    }
  });

  // Message Likes API Routes
  
  // Like a message
  app.post("/api/messages/:id/like", isAuthenticated, async (req, res) => {
    try {
      const user = (req as any).user;
      if (!user?.id) {
        return res.status(401).json({ error: "User not authenticated" });
      }

      const messageId = parseInt(req.params.id);
      if (isNaN(messageId)) {
        return res.status(400).json({ error: "Invalid message ID" });
      }

      const userName = `${user.firstName} ${user.lastName}`.trim() || user.email || "Unknown User";
      
      const like = await storage.likeMessage(messageId, user.id, userName);
      
      if (like === null) {
        return res.status(409).json({ error: "Message already liked" });
      }

      res.json({ success: true, like });
    } catch (error) {
      console.error("Error liking message:", error);
      res.status(500).json({ error: "Failed to like message" });
    }
  });

  // Unlike a message
  app.delete("/api/messages/:id/like", isAuthenticated, async (req, res) => {
    try {
      const user = (req as any).user;
      if (!user?.id) {
        return res.status(401).json({ error: "User not authenticated" });
      }

      const messageId = parseInt(req.params.id);
      if (isNaN(messageId)) {
        return res.status(400).json({ error: "Invalid message ID" });
      }

      const success = await storage.unlikeMessage(messageId, user.id);
      
      if (!success) {
        return res.status(404).json({ error: "Like not found" });
      }

      res.json({ success: true });
    } catch (error) {
      console.error("Error unliking message:", error);
      res.status(500).json({ error: "Failed to unlike message" });
    }
  });

  // Get likes for a message
  app.get("/api/messages/:id/likes", isAuthenticated, async (req, res) => {
    try {
      const messageId = parseInt(req.params.id);
      if (isNaN(messageId)) {
        return res.status(400).json({ error: "Invalid message ID" });
      }

      const likes = await storage.getMessageLikes(messageId);
      res.json(likes);
    } catch (error) {
      console.error("Error getting message likes:", error);
      res.status(500).json({ error: "Failed to get message likes" });
    }
  });

  // Chat Message Likes API Routes (for Socket.IO chat messages)
  
  // Like a chat message
  app.post("/api/chat-messages/:id/like", isAuthenticated, async (req, res) => {
    try {
      const user = (req as any).user;
      if (!user?.id) {
        return res.status(401).json({ error: "User not authenticated" });
      }

      const messageId = parseInt(req.params.id);
      if (isNaN(messageId)) {
        return res.status(400).json({ error: "Invalid message ID" });
      }

      const userName = `${user.firstName} ${user.lastName}`.trim() || user.email || "Unknown User";
      
      const like = await storage.likeChatMessage(messageId, user.id, userName);
      
      if (like === null) {
        return res.status(409).json({ error: "Message already liked" });
      }

      res.json({ success: true, like });
    } catch (error) {
      console.error("Error liking chat message:", error);
      res.status(500).json({ error: "Failed to like chat message" });
    }
  });

  // Unlike a chat message
  app.delete("/api/chat-messages/:id/like", isAuthenticated, async (req, res) => {
    try {
      const user = (req as any).user;
      if (!user?.id) {
        return res.status(401).json({ error: "User not authenticated" });
      }

      const messageId = parseInt(req.params.id);
      if (isNaN(messageId)) {
        return res.status(400).json({ error: "Invalid message ID" });
      }

      const success = await storage.unlikeChatMessage(messageId, user.id);
      
      if (!success) {
        return res.status(404).json({ error: "Like not found" });
      }

      res.json({ success: true });
    } catch (error) {
      console.error("Error unliking chat message:", error);
      res.status(500).json({ error: "Failed to unlike chat message" });
    }
  });

  // Get likes for a chat message
  app.get("/api/chat-messages/:id/likes", isAuthenticated, async (req, res) => {
    try {
      const messageId = parseInt(req.params.id);
      if (isNaN(messageId)) {
        return res.status(400).json({ error: "Invalid message ID" });
      }

      const likes = await storage.getChatMessageLikes(messageId);
      res.json(likes);
    } catch (error) {
      console.error("Error getting chat message likes:", error);
      res.status(500).json({ error: "Failed to get chat message likes" });
    }
  });

  // Create or get direct conversation between two users
  app.post("/api/conversations/direct", isAuthenticated, async (req, res) => {
    console.log("=== POST /api/conversations/direct START ===");
    try {
      const user = (req as any).user;
      console.log("User:", user);
      console.log("Request body:", req.body);

      const { otherUserId } = req.body;

      if (!otherUserId) {
        return res.status(400).json({ message: "Other user ID is required" });
      }

      // Check if direct conversation already exists between these users
      const existingConversation = await db
        .select({
          id: conversations.id,
          type: conversations.type,
          name: conversations.name,
          createdAt: conversations.createdAt,
        })
        .from(conversations)
        .innerJoin(
          conversationParticipants,
          eq(conversations.id, conversationParticipants.conversationId),
        )
        .where(
          and(
            eq(conversations.type, "direct"),
            eq(conversationParticipants.userId, user.id),
          ),
        );

      // Find conversation that includes both users
      for (const conv of existingConversation) {
        const participants = await db
          .select({ userId: conversationParticipants.userId })
          .from(conversationParticipants)
          .where(eq(conversationParticipants.conversationId, conv.id));

        const userIds = participants.map((p) => p.userId);
        if (userIds.includes(otherUserId) && userIds.length === 2) {
          return res.json(conv);
        }
      }

      // Create new direct conversation
      const [newConversation] = await db
        .insert(conversations)
        .values({
          type: "direct",
          name: null,
        })
        .returning();

      // Add both users as participants
      await db.insert(conversationParticipants).values([
        {
          conversationId: newConversation.id,
          userId: user.id,
        },
        {
          conversationId: newConversation.id,
          userId: otherUserId,
        },
      ]);

      res.json(newConversation);
    } catch (error) {
      console.error("=== POST /api/conversations/direct ERROR ===");
      console.error("[ERROR] Full error object:", error);
      console.error("[ERROR] Error name:", error.name);
      console.error("[ERROR] Error message:", error.message);
      console.error("[ERROR] Error stack:", error.stack);
      if (error.code) console.error("[ERROR] Error code:", error.code);
      if (error.detail) console.error("[ERROR] Error detail:", error.detail);
      if (error.hint) console.error("[ERROR] Error hint:", error.hint);
      console.error("=== POST /api/conversations/direct ERROR END ===");

      res.status(500).json({
        message: "Failed to create conversation",
        error: error.message,
        details: error.detail || "No additional details",
      });
    }
  });

  // Upload project data sheet (fallback file)
  app.post('/api/project-data/upload', 
    requirePermission('manage_files'), 
    projectDataUpload.single('file'),
    async (req: any, res) => {
      try {
        if (!req.file) {
          return res.status(400).json({ message: 'No file uploaded' });
        }

        const originalName = req.file.originalname;
        const filePath = req.file.path;
        const fileSize = req.file.size;
        const mimeType = req.file.mimetype;

        // Store file metadata (you could add to database if needed)
        const fileInfo = {
          originalName,
          filePath,
          fileSize,
          mimeType,
          uploadedAt: new Date().toISOString(),
          uploadedBy: req.user?.email || 'unknown'
        };

        res.json({
          success: true,
          message: 'Project data file uploaded successfully',
          file: fileInfo
        });
      } catch (error) {
        console.error('Project data upload error:', error);
        res.status(500).json({ message: 'Failed to upload project data file' });
      }
    }
  );

  // Serve project data sheet files
  app.get('/api/project-data/current', async (req, res) => {
    try {
      const projectDataDir = path.join(process.cwd(), 'uploads', 'project-data');
      
      // Check if directory exists
      try {
        await fs.access(projectDataDir);
      } catch {
        return res.status(404).json({ message: 'No project data files available' });
      }

      // Find the most recent file
      const files = await fs.readdir(projectDataDir);
      if (files.length === 0) {
        return res.status(404).json({ message: 'No project data files found' });
      }

      // Sort files by modification time and get the newest
      const filesWithStats = await Promise.all(
        files.map(async (file) => {
          const filePath = path.join(projectDataDir, file);
          const stats = await fs.stat(filePath);
          return { file, stats, filePath };
        })
      );

      const newestFile = filesWithStats.sort(
        (a, b) => b.stats.mtime.getTime() - a.stats.mtime.getTime()
      )[0];

      // Determine content type
      const ext = path.extname(newestFile.file).toLowerCase();
      let contentType = 'application/octet-stream';
      
      if (ext === '.pdf') contentType = 'application/pdf';
      else if (ext === '.xlsx') contentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
      else if (ext === '.xls') contentType = 'application/vnd.ms-excel';
      else if (ext === '.csv') contentType = 'text/csv';

      // Set headers
      res.setHeader('Content-Type', contentType);
      res.setHeader('Content-Length', newestFile.stats.size);
      res.setHeader('Content-Disposition', `inline; filename="${newestFile.file}"`);

      // Stream the file
      const fileStream = createReadStream(newestFile.filePath);
      fileStream.pipe(res);
    } catch (error) {
      console.error('Project data serving error:', error);
      res.status(500).json({ message: 'Failed to serve project data file' });
    }
  });

  // Check if fallback file is available
  app.get('/api/project-data/status', async (req, res) => {
    try {
      const projectDataDir = path.join(process.cwd(), 'uploads', 'project-data');
      
      try {
        await fs.access(projectDataDir);
        const files = await fs.readdir(projectDataDir);
        
        if (files.length > 0) {
          // Get info about the newest file
          const filesWithStats = await Promise.all(
            files.map(async (file) => {
              const filePath = path.join(projectDataDir, file);
              const stats = await fs.stat(filePath);
              return { file, stats, filePath };
            })
          );

          const newestFile = filesWithStats.sort(
            (a, b) => b.stats.mtime.getTime() - a.stats.mtime.getTime()
          )[0];

          res.json({
            hasFile: true,
            fileName: newestFile.file,
            uploadedAt: newestFile.stats.mtime.toISOString(),
            fileSize: newestFile.stats.size
          });
        } else {
          res.json({ hasFile: false });
        }
      } catch {
        res.json({ hasFile: false });
      }
    } catch (error) {
      console.error('Project data status error:', error);
      res.status(500).json({ message: 'Failed to check project data status' });
    }
  });

  // Register message notification routes
  registerMessageNotificationRoutes(app);

  // Register error logging routes
  app.use("/api/error-logs", createErrorLogsRoutes(storage));

  // Register email routes (completely separate from chat)
  app.use("/api/emails", emailRoutes);
  
  // Register shoutout routes
  app.use("/api/shoutouts", shoutoutRoutes);
  
  // Register user activity tracking routes with authentication
  app.use("/api/user-activity", isAuthenticated, createUserActivityRoutes(storage));
  
  // Register enhanced user activity analytics routes
  app.use("/api/enhanced-user-activity", createEnhancedUserActivityRoutes(storage));
  
  // Register client-side activity logging routes
  app.use("/api/activity-log", isAuthenticated, createActivityLogRoutes(storage));

  // Register real-time messages routes
  const { default: realTimeMessagesRoutes } = await import("./routes/real-time-messages");
  app.use("/api/real-time-messages", realTimeMessagesRoutes);
  
  // Socket.IO chat system
  app.use("/api", chatRoutes);

  // Stream Chat token generation endpoint
  app.post("/api/stream/token", isAuthenticated, async (req, res) => {
    try {
      const { userId } = req.body;
      const requestingUserId = (req as any).user?.id;

      // Verify user is requesting their own token or is admin
      if (userId !== requestingUserId.toString() && (req as any).user?.role !== 'admin') {
        return res.status(403).json({ error: "Unauthorized to get token for other users" });
      }

      // Initialize Stream Chat with server credentials
      const serverClient = StreamChat.getInstance(
        process.env.STREAM_API_KEY!,
        process.env.STREAM_API_SECRET!
      );

      // Generate token for user
      const token = serverClient.createToken(userId);

      res.json({
        token,
        apiKey: process.env.STREAM_API_KEY!,
        userId
      });
    } catch (error) {
      console.error('Error generating Stream token:', error);
      res.status(500).json({ error: 'Failed to generate Stream token' });
    }
  });

  // Stream Chat user synchronization endpoint
  app.post("/api/stream/sync-users", isAuthenticated, async (req, res) => {
    try {
      console.log('🔄 Server-side Stream user sync started...');
      
      // Initialize Stream Chat with server credentials
      const serverClient = StreamChat.getInstance(
        process.env.STREAM_API_KEY!,
        process.env.STREAM_API_SECRET!
      );
      
      console.log('✅ Stream server client initialized');
      
      // Get all active users from database
      const allUsers = await db.select().from(users);
      console.log(`📊 Found ${allUsers.length} users in database`);
      
      // Prepare users for Stream
      const streamUsers = allUsers
        .filter(user => user.isActive && user.email)
        .map(user => ({
          id: user.id.toString(),
          name: user.firstName ? `${user.firstName} ${user.lastName || ''}`.trim() : user.email,
          email: user.email,
          role: 'user' // Always use 'user' role for Stream compatibility
        }));
        
      console.log(`🔄 Syncing ${streamUsers.length} active users to Stream...`);
      
      // Batch upsert users using server credentials
      await serverClient.upsertUsers(streamUsers);
      
      console.log('✅ Successfully synced all users to Stream via server');
      
      res.json({ 
        success: true, 
        syncedUsers: streamUsers.length,
        message: 'Users successfully synchronized to Stream' 
      });
    } catch (error) {
      console.error('❌ Server-side Stream user sync failed:', error);
      res.status(500).json({ 
        success: false, 
        error: 'Failed to sync users to Stream',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // ===========================================
  // TEAM CHAT SYSTEM - Uses chatMessages table
  // ===========================================
  
  // Get team chat messages (Socket.io real-time chat)
  app.get("/api/team-chat/:channel/messages", isAuthenticated, async (req, res) => {
    try {
      const { channel } = req.params;
      const user = (req as any).user;
      
      console.log(`=== TEAM CHAT GET /api/team-chat/${channel}/messages ===`);
      console.log("User:", user?.email);
      
      // Validate channel access permissions
      const validChannels = {
        'general': 'general_chat',
        'core-team': 'core_team_chat', 
        'driver': 'driver_chat',
        'host': 'host_chat',
        'recipient': 'recipient_chat',
        'committee': 'committee_chat'
      };
      
      const requiredPermission = validChannels[channel];
      if (!requiredPermission || !user.permissions?.includes(requiredPermission)) {
        return res.status(403).json({ message: "Access denied to this channel" });
      }
      
      // Get messages from chatMessages table
      const { chatMessages } = await import("@shared/schema");
      const messages = await db
        .select()
        .from(chatMessages)
        .where(eq(chatMessages.channel, channel))
        .orderBy(desc(chatMessages.createdAt))
        .limit(50);
      
      console.log(`FOUND ${messages.length} team chat messages in ${channel}`);
      res.json(messages);
      
    } catch (error) {
      console.error("Team chat get messages error:", error);
      res.status(500).json({ message: "Failed to get team chat messages" });
    }
  });
  
  // Post team chat message (Socket.io real-time chat)
  app.post("/api/team-chat/:channel/messages", isAuthenticated, async (req, res) => {
    try {
      const { channel } = req.params;
      const { content } = req.body;
      const user = (req as any).user;
      
      console.log(`=== TEAM CHAT POST /api/team-chat/${channel}/messages ===`);
      console.log("User:", user?.email);
      console.log("Content:", content);
      
      if (!content?.trim()) {
        return res.status(400).json({ message: "Message content required" });
      }
      
      // Validate channel access permissions
      const validChannels = {
        'general': 'general_chat',
        'core-team': 'core_team_chat', 
        'driver': 'driver_chat',
        'host': 'host_chat',
        'recipient': 'recipient_chat',
        'committee': 'committee_chat'
      };
      
      const requiredPermission = validChannels[channel];
      if (!requiredPermission || !user.permissions?.includes(requiredPermission)) {
        return res.status(403).json({ message: "Access denied to this channel" });
      }
      
      // Save to chatMessages table (NOT messages table)
      const { chatMessages } = await import("@shared/schema");
      const userName = user.displayName || user.firstName || user.email?.split('@')[0] || 'Team Member';
      
      const [newMessage] = await db
        .insert(chatMessages)
        .values({
          channel,
          userId: user.id,
          userName,
          content: content.trim()
        })
        .returning();
      
      console.log(`SAVED team chat message to chatMessages table:`, newMessage.id);
      
      // Broadcast via WebSocket to team chat users only
      if (global.wss) {
        const notification = {
          type: 'team_chat_message',
          channel,
          message: newMessage,
          timestamp: new Date().toISOString()
        };
        
        global.wss.clients.forEach(client => {
          if (client.readyState === 1) { // WebSocket.OPEN
            try {
              client.send(JSON.stringify(notification));
            } catch (error) {
              console.error('WebSocket broadcast error:', error);
            }
          }
        });
      }
      
      res.json(newMessage);
      
    } catch (error) {
      console.error("Team chat post message error:", error);
      res.status(500).json({ message: "Failed to send team chat message" });
    }
  });
  
  // Delete team chat message
  app.delete("/api/team-chat/:channel/messages/:messageId", isAuthenticated, async (req, res) => {
    try {
      const { channel, messageId } = req.params;
      const user = (req as any).user;
      
      console.log(`=== TEAM CHAT DELETE /api/team-chat/${channel}/messages/${messageId} ===`);
      console.log("User:", user?.email);
      
      // Validate channel access permissions
      const validChannels = {
        'general': 'general_chat',
        'core-team': 'core_team_chat', 
        'driver': 'driver_chat',
        'host': 'host_chat',
        'recipient': 'recipient_chat',
        'committee': 'committee_chat'
      };
      
      const requiredPermission = validChannels[channel];
      if (!requiredPermission || !user.permissions?.includes(requiredPermission)) {
        return res.status(403).json({ message: "Access denied to this channel" });
      }
      
      // Get message to check ownership
      const { chatMessages } = await import("@shared/schema");
      const [message] = await db
        .select()
        .from(chatMessages)
        .where(eq(chatMessages.id, parseInt(messageId)))
        .limit(1);
      
      if (!message) {
        return res.status(404).json({ message: "Message not found" });
      }
      
      // Check if user can delete (owner, admin, or super admin)
      const isOwner = message.userId === user.id;
      const isAdmin = user.role === "admin" || user.role === "super_admin";
      const hasModeratePermission = user.permissions?.includes("moderate_messages");
      
      if (!isOwner && !isAdmin && !hasModeratePermission) {
        return res.status(403).json({ message: "Cannot delete other users' messages" });
      }
      
      // Delete the message
      await db
        .delete(chatMessages)
        .where(eq(chatMessages.id, parseInt(messageId)));
      
      console.log(`DELETED team chat message ${messageId} from chatMessages table`);
      
      // Broadcast deletion via WebSocket
      if (global.wss) {
        const notification = {
          type: 'team_chat_message_deleted',
          channel,
          messageId: parseInt(messageId),
          timestamp: new Date().toISOString()
        };
        
        global.wss.clients.forEach(client => {
          if (client.readyState === 1) { // WebSocket.OPEN
            try {
              client.send(JSON.stringify(notification));
            } catch (error) {
              console.error('WebSocket broadcast error:', error);
            }
          }
        });
      }
      
      res.status(204).send();
      
    } catch (error) {
      console.error("Team chat delete message error:", error);
      res.status(500).json({ message: "Failed to delete team chat message" });
    }
  });

  // Wishlist Suggestions API endpoints
  app.get("/api/wishlist-suggestions", isAuthenticated, async (req, res) => {
    try {
      // Get suggestions with user information
      const suggestions = await db
        .select({
          id: wishlistSuggestions.id,
          item: wishlistSuggestions.item,
          reason: wishlistSuggestions.reason,
          priority: wishlistSuggestions.priority,
          suggestedBy: wishlistSuggestions.suggestedBy,
          status: wishlistSuggestions.status,
          adminNotes: wishlistSuggestions.adminNotes,
          amazonUrl: wishlistSuggestions.amazonUrl,
          estimatedCost: wishlistSuggestions.estimatedCost,
          createdAt: wishlistSuggestions.createdAt,
          updatedAt: wishlistSuggestions.updatedAt,
          reviewedAt: wishlistSuggestions.reviewedAt,
          reviewedBy: wishlistSuggestions.reviewedBy,
          suggestedByFirstName: users.firstName,
          suggestedByLastName: users.lastName,
          suggestedByEmail: users.email,
        })
        .from(wishlistSuggestions)
        .leftJoin(users, eq(wishlistSuggestions.suggestedBy, users.id))
        .orderBy(desc(wishlistSuggestions.createdAt));
      
      res.json(suggestions);
    } catch (error) {
      logger.error("Failed to get wishlist suggestions", error);
      res.status(500).json({ message: "Failed to get wishlist suggestions" });
    }
  });

  app.get("/api/wishlist-suggestions/:id", isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const suggestion = await storage.getWishlistSuggestion(id);
      if (!suggestion) {
        return res.status(404).json({ message: "Wishlist suggestion not found" });
      }
      res.json(suggestion);
    } catch (error) {
      logger.error("Failed to get wishlist suggestion", error);
      res.status(500).json({ message: "Failed to get wishlist suggestion" });
    }
  });

  app.post("/api/wishlist-suggestions", isAuthenticated, sanitizeMiddleware, async (req, res) => {
    try {
      const { insertWishlistSuggestionSchema } = await import("@shared/schema");
      const result = insertWishlistSuggestionSchema.safeParse({
        ...req.body,
        suggestedBy: req.user?.id || 'anonymous'
      });
      
      if (!result.success) {
        return res.status(400).json({ 
          message: "Invalid wishlist suggestion data", 
          errors: result.error.issues 
        });
      }
      
      const suggestion = await storage.createWishlistSuggestion(result.data);
      res.status(201).json(suggestion);
    } catch (error) {
      logger.error("Failed to create wishlist suggestion", error);
      res.status(500).json({ message: "Failed to create wishlist suggestion" });
    }
  });

  app.put("/api/wishlist-suggestions/:id", isAuthenticated, requirePermission("manage_settings"), sanitizeMiddleware, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const updates = {
        ...req.body,
        ...(req.body.status && req.body.status !== 'pending' && { 
          reviewedAt: new Date(), 
          reviewedBy: req.user?.id 
        })
      };
      
      const suggestion = await storage.updateWishlistSuggestion(id, updates);
      if (!suggestion) {
        return res.status(404).json({ message: "Wishlist suggestion not found" });
      }
      res.json(suggestion);
    } catch (error) {
      logger.error("Failed to update wishlist suggestion", error);
      res.status(500).json({ message: "Failed to update wishlist suggestion" });
    }
  });

  app.patch("/api/wishlist-suggestions/:id", isAuthenticated, requirePermission("manage_wishlist"), sanitizeMiddleware, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const updates = {
        ...req.body,
        ...(req.body.status && req.body.status !== 'pending' && { 
          reviewedAt: new Date(), 
          reviewedBy: req.user?.id 
        })
      };
      
      const suggestion = await storage.updateWishlistSuggestion(id, updates);
      if (!suggestion) {
        return res.status(404).json({ message: "Wishlist suggestion not found" });
      }
      res.json(suggestion);
    } catch (error) {
      logger.error("Failed to update wishlist suggestion", error);
      res.status(500).json({ message: "Failed to update wishlist suggestion" });
    }
  });

  app.delete("/api/wishlist-suggestions/:id", isAuthenticated, requirePermission("manage_wishlist"), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const success = await storage.deleteWishlistSuggestion(id);
      if (!success) {
        return res.status(404).json({ message: "Wishlist suggestion not found" });
      }
      res.status(204).send();
    } catch (error) {
      logger.error("Failed to delete wishlist suggestion", error);
      res.status(500).json({ message: "Failed to delete wishlist suggestion" });
    }
  });

  app.patch("/api/wishlist-suggestions/:id", isAuthenticated, requirePermission("manage_settings"), sanitizeMiddleware, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const updates = {
        ...req.body,
        ...(req.body.status && req.body.status !== 'pending' && { 
          reviewedAt: new Date(), 
          reviewedBy: req.user?.id 
        })
      };
      
      const suggestion = await storage.updateWishlistSuggestion(id, updates);
      if (!suggestion) {
        return res.status(404).json({ message: "Wishlist suggestion not found" });
      }
      res.json(suggestion);
    } catch (error) {
      logger.error("Failed to update wishlist suggestion", error);
      res.status(500).json({ message: "Failed to update wishlist suggestion" });
    }
  });

  app.delete("/api/wishlist-suggestions/:id", isAuthenticated, requirePermission("manage_settings"), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const success = await storage.deleteWishlistSuggestion(id);
      if (!success) {
        return res.status(404).json({ message: "Wishlist suggestion not found" });
      }
      res.status(204).send();
    } catch (error) {
      logger.error("Failed to delete wishlist suggestion", error);
      res.status(500).json({ message: "Failed to delete wishlist suggestion" });
    }
  });

  app.get("/api/wishlist-activity", isAuthenticated, async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 10;
      const activity = await storage.getRecentWishlistActivity(limit);
      res.json(activity);
    } catch (error) {
      logger.error("Failed to get wishlist activity", error);
      res.status(500).json({ message: "Failed to get wishlist activity" });
    }
  });

  // Document Management API Routes
  app.get("/api/documents", isAuthenticated, async (req, res) => {
    try {
      const documents = await storage.getDocumentsForUser(req.user!.id);
      res.json(documents);
    } catch (error) {
      logger.error("Failed to get documents", error);
      res.status(500).json({ message: "Failed to get documents" });
    }
  });

  app.get("/api/documents/:id", isAuthenticated, async (req, res) => {
    try {
      const documentId = parseInt(req.params.id);
      const hasAccess = await storage.checkUserDocumentAccess(documentId, req.user!.id, 'view');
      
      if (!hasAccess) {
        return res.status(403).json({ message: "Access denied" });
      }

      const document = await storage.getDocument(documentId);
      if (!document) {
        return res.status(404).json({ message: "Document not found" });
      }

      // Log access
      await storage.logDocumentAccess({
        documentId,
        userId: req.user!.id,
        userName: `${req.user!.firstName} ${req.user!.lastName}`.trim(),
        action: 'view',
        ipAddress: req.ip,
        userAgent: req.get('User-Agent') || '',
        sessionId: req.sessionID
      });

      res.json(document);
    } catch (error) {
      logger.error("Failed to get document", error);
      res.status(500).json({ message: "Failed to get document" });
    }
  });

  app.post("/api/documents", isAuthenticated, requirePermission("manage_documents"), async (req, res) => {
    try {
      const result = insertDocumentSchema.safeParse({
        ...req.body,
        uploadedBy: req.user!.id,
        uploadedByName: `${req.user!.firstName} ${req.user!.lastName}`.trim()
      });

      if (!result.success) {
        return res.status(400).json({ 
          message: "Invalid document data", 
          errors: result.error.issues 
        });
      }

      const document = await storage.createDocument(result.data);

      // Log creation
      await storage.logDocumentAccess({
        documentId: document.id,
        userId: req.user!.id,
        userName: `${req.user!.firstName} ${req.user!.lastName}`.trim(),
        action: 'upload',
        ipAddress: req.ip,
        userAgent: req.get('User-Agent') || '',
        sessionId: req.sessionID
      });

      res.status(201).json(document);
    } catch (error) {
      logger.error("Failed to create document", error);
      res.status(500).json({ message: "Failed to create document" });
    }
  });

  app.put("/api/documents/:id", isAuthenticated, async (req, res) => {
    try {
      const documentId = parseInt(req.params.id);
      const hasAccess = await storage.checkUserDocumentAccess(documentId, req.user!.id, 'edit');
      
      if (!hasAccess) {
        return res.status(403).json({ message: "Access denied" });
      }

      const document = await storage.updateDocument(documentId, req.body);
      if (!document) {
        return res.status(404).json({ message: "Document not found" });
      }

      res.json(document);
    } catch (error) {
      logger.error("Failed to update document", error);
      res.status(500).json({ message: "Failed to update document" });
    }
  });

  app.delete("/api/documents/:id", isAuthenticated, async (req, res) => {
    try {
      const documentId = parseInt(req.params.id);
      const hasAccess = await storage.checkUserDocumentAccess(documentId, req.user!.id, 'admin');
      
      if (!hasAccess) {
        return res.status(403).json({ message: "Access denied" });
      }

      const success = await storage.deleteDocument(documentId);
      if (!success) {
        return res.status(404).json({ message: "Document not found" });
      }

      // Log deletion
      await storage.logDocumentAccess({
        documentId,
        userId: req.user!.id,
        userName: `${req.user!.firstName} ${req.user!.lastName}`.trim(),
        action: 'delete',
        ipAddress: req.ip,
        userAgent: req.get('User-Agent') || '',
        sessionId: req.sessionID
      });

      res.status(204).send();
    } catch (error) {
      logger.error("Failed to delete document", error);
      res.status(500).json({ message: "Failed to delete document" });
    }
  });

  // Document Permissions API Routes
  app.get("/api/documents/:id/permissions", isAuthenticated, requirePermission("manage_documents"), async (req, res) => {
    try {
      const documentId = parseInt(req.params.id);
      const permissions = await storage.getDocumentPermissions(documentId);
      res.json(permissions);
    } catch (error) {
      logger.error("Failed to get document permissions", error);
      res.status(500).json({ message: "Failed to get document permissions" });
    }
  });

  app.post("/api/documents/:id/permissions", isAuthenticated, requirePermission("manage_documents"), async (req, res) => {
    try {
      const documentId = parseInt(req.params.id);
      
      const result = insertDocumentPermissionSchema.safeParse({
        ...req.body,
        documentId,
        grantedBy: req.user!.id,
        grantedByName: `${req.user!.firstName} ${req.user!.lastName}`.trim()
      });

      if (!result.success) {
        return res.status(400).json({ 
          message: "Invalid permission data", 
          errors: result.error.issues 
        });
      }

      const permission = await storage.grantDocumentPermission(result.data);
      res.status(201).json(permission);
    } catch (error) {
      logger.error("Failed to grant document permission", error);
      res.status(500).json({ message: "Failed to grant document permission" });
    }
  });

  app.delete("/api/documents/:id/permissions/:userId/:permissionType", isAuthenticated, requirePermission("manage_documents"), async (req, res) => {
    try {
      const documentId = parseInt(req.params.id);
      const { userId, permissionType } = req.params;
      
      const success = await storage.revokeDocumentPermission(documentId, userId, permissionType);
      if (!success) {
        return res.status(404).json({ message: "Permission not found" });
      }

      res.status(204).send();
    } catch (error) {
      logger.error("Failed to revoke document permission", error);
      res.status(500).json({ message: "Failed to revoke document permission" });
    }
  });

  app.get("/api/documents/:id/access-logs", isAuthenticated, requirePermission("manage_documents"), async (req, res) => {
    try {
      const documentId = parseInt(req.params.id);
      const logs = await storage.getDocumentAccessLogs(documentId);
      res.json(logs);
    } catch (error) {
      logger.error("Failed to get document access logs", error);
      res.status(500).json({ message: "Failed to get document access logs" });
    }
  });

  // Make broadcast functions available globally for use in other routes
  (global as any).broadcastNewMessage = broadcastNewMessage;
  (global as any).broadcastTaskAssignment = broadcastTaskAssignment;

  return httpServer;
}