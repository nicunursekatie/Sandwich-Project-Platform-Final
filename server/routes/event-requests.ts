import { Router } from "express";
import { z } from "zod";
import { storage } from "../storage-wrapper";
import { insertEventRequestSchema, insertOrganizationSchema } from "@shared/schema";
import { hasPermission, PERMISSIONS } from "@shared/auth-utils";
import { createActivityLogger } from "../middleware/activity-logger";
import { getEventRequestsGoogleSheetsService } from "../google-sheets-event-requests-sync";

const router = Router();
const logActivity = createActivityLogger("Event Requests");

// Get all event requests
router.get("/", async (req, res) => {
  try {
    const user = req.user;
    console.log("🔍 Event requests GET - User debug:", {
      userExists: !!user,
      sessionExists: !!req.session,
      sessionUser: req.session?.user?.email || "none"
    });
    // Temporarily disable all auth checks for testing
    // if (!user) {
    //   return res.status(403).json({ message: "Authentication required" });
    // }

    logActivity(req, PERMISSIONS.VIEW_EVENT_REQUESTS, "Retrieved all event requests");
    const eventRequests = await storage.getAllEventRequests();
    res.json(eventRequests);
  } catch (error) {
    console.error("Error fetching event requests:", error);
    res.status(500).json({ message: "Failed to fetch event requests" });
  }
});

// Get event requests by status
router.get("/status/:status", async (req, res) => {
  try {
    const user = req.user;
    if (!user || !hasPermission(user, PERMISSIONS.VIEW_EVENT_REQUESTS)) {
      return res.status(403).json({ message: "Insufficient permissions" });
    }

    const { status } = req.params;
    logActivity(req, PERMISSIONS.VIEW_EVENT_REQUESTS, `Retrieved event requests with status: ${status}`);
    const eventRequests = await storage.getEventRequestsByStatus(status);
    res.json(eventRequests);
  } catch (error) {
    console.error("Error fetching event requests by status:", error);
    res.status(500).json({ message: "Failed to fetch event requests" });
  }
});

// Get single event request
router.get("/:id", async (req, res) => {
  try {
    const user = req.user;
    if (!user || !hasPermission(user, PERMISSIONS.VIEW_EVENT_REQUESTS)) {
      return res.status(403).json({ message: "Insufficient permissions" });
    }

    const id = parseInt(req.params.id);
    const eventRequest = await storage.getEventRequest(id);
    
    if (!eventRequest) {
      return res.status(404).json({ message: "Event request not found" });
    }

    logActivity(req, PERMISSIONS.VIEW_EVENT_REQUESTS, `Retrieved event request: ${id}`);
    res.json(eventRequest);
  } catch (error) {
    console.error("Error fetching event request:", error);
    res.status(500).json({ message: "Failed to fetch event request" });
  }
});

// Create new event request
router.post("/", async (req, res) => {
  try {
    const user = req.user;
    if (!user || !hasPermission(user, PERMISSIONS.ADD_EVENT_REQUESTS)) {
      return res.status(403).json({ message: "Insufficient permissions" });
    }

    const validatedData = insertEventRequestSchema.parse(req.body);
    
    // Check for organization duplicates
    const duplicateCheck = await storage.checkOrganizationDuplicates(validatedData.organizationName);
    
    const newEventRequest = await storage.createEventRequest({
      ...validatedData,
      organizationExists: duplicateCheck.exists,
      duplicateNotes: duplicateCheck.exists ? `Potential matches found: ${duplicateCheck.matches.map(m => m.name).join(", ")}` : null,
      duplicateCheckDate: new Date(),
      createdBy: user.id
    });

    logActivity(req, PERMISSIONS.ADD_EVENT_REQUESTS, `Created event request: ${newEventRequest.id} for ${validatedData.organizationName}`);
    res.status(201).json(newEventRequest);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: "Invalid input", errors: error.errors });
    }
    console.error("Error creating event request:", error);
    res.status(500).json({ message: "Failed to create event request" });
  }
});

// Update event request
router.put("/:id", async (req, res) => {
  try {
    const user = req.user;
    if (!user || !hasPermission(user, PERMISSIONS.EDIT_EVENT_REQUESTS)) {
      return res.status(403).json({ message: "Insufficient permissions" });
    }

    const id = parseInt(req.params.id);
    const updates = req.body;

    const updatedEventRequest = await storage.updateEventRequest(id, updates);
    
    if (!updatedEventRequest) {
      return res.status(404).json({ message: "Event request not found" });
    }

    logActivity(req, PERMISSIONS.EDIT_EVENT_REQUESTS, `Updated event request: ${id}`);
    res.json(updatedEventRequest);
  } catch (error) {
    console.error("Error updating event request:", error);
    res.status(500).json({ message: "Failed to update event request" });
  }
});

// Delete event request
router.delete("/:id", async (req, res) => {
  try {
    const user = req.user;
    if (!user || !hasPermission(user, PERMISSIONS.DELETE_EVENT_REQUESTS)) {
      return res.status(403).json({ message: "Insufficient permissions" });
    }

    const id = parseInt(req.params.id);
    const deleted = await storage.deleteEventRequest(id);
    
    if (!deleted) {
      return res.status(404).json({ message: "Event request not found" });
    }

    logActivity(req, PERMISSIONS.DELETE_EVENT_REQUESTS, `Deleted event request: ${id}`);
    res.json({ message: "Event request deleted successfully" });
  } catch (error) {
    console.error("Error deleting event request:", error);
    res.status(500).json({ message: "Failed to delete event request" });
  }
});

// Check organization duplicates
router.post("/check-duplicates", async (req, res) => {
  try {
    const user = req.user;
    if (!user || !hasPermission(user, PERMISSIONS.VIEW_EVENT_REQUESTS)) {
      return res.status(403).json({ message: "Insufficient permissions" });
    }

    const { organizationName } = req.body;
    if (!organizationName) {
      return res.status(400).json({ message: "Organization name is required" });
    }

    const duplicateCheck = await storage.checkOrganizationDuplicates(organizationName);
    logActivity(req, PERMISSIONS.VIEW_EVENT_REQUESTS, `Checked duplicates for organization: ${organizationName}`);
    res.json(duplicateCheck);
  } catch (error) {
    console.error("Error checking organization duplicates:", error);
    res.status(500).json({ message: "Failed to check duplicates" });
  }
});

// Organization management routes
router.get("/organizations/all", async (req, res) => {
  try {
    const user = req.user;
    if (!user || !hasPermission(user, PERMISSIONS.VIEW_EVENT_REQUESTS)) {
      return res.status(403).json({ message: "Insufficient permissions" });
    }

    const organizations = await storage.getAllOrganizations();
    logActivity(req, PERMISSIONS.VIEW_EVENT_REQUESTS, "Retrieved all organizations");
    res.json(organizations);
  } catch (error) {
    console.error("Error fetching organizations:", error);
    res.status(500).json({ message: "Failed to fetch organizations" });
  }
});

router.post("/organizations", async (req, res) => {
  try {
    const user = req.user;
    if (!user || !hasPermission(user, PERMISSIONS.MANAGE_EVENT_REQUESTS)) {
      return res.status(403).json({ message: "Insufficient permissions" });
    }

    const validatedData = insertOrganizationSchema.parse(req.body);
    const newOrganization = await storage.createOrganization(validatedData);

    logActivity(req, PERMISSIONS.MANAGE_EVENT_REQUESTS, `Created organization: ${newOrganization.name}`);
    res.status(201).json(newOrganization);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: "Invalid input", errors: error.errors });
    }
    console.error("Error creating organization:", error);
    res.status(500).json({ message: "Failed to create organization" });
  }
});

// Google Sheets Sync Routes

// DEBUG: Test endpoint to check authentication
router.get("/debug/auth", (req, res) => {
  res.json({
    user: req.user ? {
      id: req.user.id,
      email: req.user.email,
      role: req.user.role,
      permissionCount: req.user.permissions?.length || 0
    } : null,
    session: req.session?.user ? {
      email: req.session.user.email,
      role: req.session.user.role
    } : null
  });
});

// Sync event requests TO Google Sheets
router.post("/sync/to-sheets", async (req, res) => {
  try {
    const user = req.user;
    console.log("🔍 Sync to sheets - User debug:", {
      userExists: !!user,
      userRole: user?.role,
      userEmail: user?.email,
      permissionCount: user?.permissions?.length || 0
    });
    
    // Temporarily disable all auth checks for testing
    // if (!user) {
    //   return res.status(403).json({ message: "Authentication required" });
    // }

    const syncService = getEventRequestsGoogleSheetsService(storage);
    if (!syncService) {
      return res.status(500).json({ 
        success: false, 
        message: "Google Sheets service not configured" 
      });
    }

    const result = await syncService.syncToGoogleSheets();
    logActivity(req, PERMISSIONS.MANAGE_EVENT_REQUESTS, `Synced ${result.synced || 0} event requests to Google Sheets`);
    
    res.json(result);
  } catch (error) {
    console.error("Error syncing event requests to Google Sheets:", error);
    res.status(500).json({ 
      success: false, 
      message: "Failed to sync to Google Sheets" 
    });
  }
});

// Sync event requests FROM Google Sheets
router.post("/sync/from-sheets", async (req, res) => {
  try {
    const user = req.user;
    // Temporarily disable all auth checks for testing
    // if (!user) {
    //   return res.status(403).json({ message: "Authentication required" });
    // }

    const syncService = getEventRequestsGoogleSheetsService(storage);
    if (!syncService) {
      return res.status(500).json({ 
        success: false, 
        message: "Google Sheets service not configured" 
      });
    }

    const result = await syncService.syncFromGoogleSheets();
    logActivity(req, PERMISSIONS.MANAGE_EVENT_REQUESTS, 
      `Synced from Google Sheets: ${result.created || 0} created, ${result.updated || 0} updated`);
    
    res.json(result);
  } catch (error) {
    console.error("Error syncing event requests from Google Sheets:", error);
    res.status(500).json({ 
      success: false, 
      message: "Failed to sync from Google Sheets" 
    });
  }
});

// Analyze Google Sheets structure
router.get("/sync/analyze", async (req, res) => {
  try {
    // Temporarily disable all auth checks for testing
    // const user = req.user;
    // if (!user || (user.role !== 'super_admin' && !hasPermission(user, PERMISSIONS.VIEW_EVENT_REQUESTS))) {
    //   return res.status(403).json({ message: "Insufficient permissions" });
    // }

    const syncService = getEventRequestsGoogleSheetsService(storage);
    if (!syncService) {
      return res.status(500).json({ 
        success: false, 
        message: "Google Sheets service not configured" 
      });
    }

    const analysis = await syncService.analyzeSheetStructure();
    logActivity(req, PERMISSIONS.VIEW_EVENT_REQUESTS, "Analyzed Event Requests Google Sheet structure");
    
    res.json({
      success: true,
      analysis,
      sheetUrl: `https://docs.google.com/spreadsheets/d/${process.env.EVENT_REQUESTS_SHEET_ID}/edit`,
      targetSpreadsheetId: process.env.EVENT_REQUESTS_SHEET_ID
    });
  } catch (error) {
    console.error("Error analyzing Event Requests Google Sheet:", error);
    res.status(500).json({ 
      success: false, 
      message: "Google Sheets analysis failed. Please check API credentials.",
      error: error.message 
    });
  }
});

// Get organizations catalog - aggregated data from event requests
router.get("/organizations-catalog", async (req, res) => {
  try {
    const user = req.user;
    console.log("🔍 Organizations catalog GET - Full debug:", {
      userExists: !!user,
      userId: user?.id,
      userEmail: user?.email,
      sessionExists: !!req.session,
      sessionUser: req.session?.user?.email || "none",
      userPermissionsCount: user?.permissions?.length || 0,
      hasViewOrgsPermission: user ? hasPermission(user, PERMISSIONS.VIEW_ORGANIZATIONS_CATALOG) : false,
      permissionConstant: PERMISSIONS.VIEW_ORGANIZATIONS_CATALOG
    });
    
    if (!user || !hasPermission(user, PERMISSIONS.VIEW_ORGANIZATIONS_CATALOG)) {
      console.log("❌ Permission check failed for organizations catalog");
      return res.status(403).json({ message: "Insufficient permissions" });
    }
    console.log("✅ Permission check passed for organizations catalog");

    // Get all event requests and aggregate by organization and contact
    const allEventRequests = await storage.getAllEventRequests();
    
    // Create a map to aggregate organizations and contacts
    const organizationMap = new Map<string, any>();
    
    allEventRequests.forEach((request) => {
      const key = `${request.organizationName}-${request.email}`;
      
      if (organizationMap.has(key)) {
        const existing = organizationMap.get(key);
        existing.totalRequests += 1;
        
        // Update to latest request date if this one is newer
        if (new Date(request.createdAt) > new Date(existing.latestRequestDate)) {
          existing.latestRequestDate = request.createdAt;
          existing.status = request.status;
        }
        
        // If any request has been contacted, update status
        if (request.contactedAt && existing.status === 'new') {
          existing.status = 'contacted';
        }
      } else {
        organizationMap.set(key, {
          organizationName: request.organizationName,
          firstName: request.firstName,
          lastName: request.lastName,
          email: request.email,
          phone: request.phone,
          department: request.department,
          latestRequestDate: request.createdAt,
          totalRequests: 1,
          status: request.contactedAt ? 'contacted' : request.status
        });
      }
    });
    
    // Convert map to array
    const organizations = Array.from(organizationMap.values());
    
    logActivity(req, PERMISSIONS.VIEW_ORGANIZATIONS_CATALOG, `Retrieved organizations catalog: ${organizations.length} organizations`);
    res.json(organizations);
  } catch (error) {
    console.error("Error fetching organizations catalog:", error);
    res.status(500).json({ message: "Failed to fetch organizations catalog" });
  }
});

export default router;