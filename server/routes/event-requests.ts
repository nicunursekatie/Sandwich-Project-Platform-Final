import { Router } from "express";
import { z } from "zod";
import { storage } from "../storage-wrapper";
import {
  insertEventRequestSchema,
  insertOrganizationSchema,
  insertEventVolunteerSchema,
} from "@shared/schema";
import { hasPermission, PERMISSIONS } from "@shared/auth-utils";
import { requirePermission } from "../middleware/auth";
import { isAuthenticated } from "../temp-auth";
import { getEventRequestsGoogleSheetsService } from "../google-sheets-event-requests-sync";
import { AuditLogger } from "../audit-logger";

const router = Router();

// Get available drivers for event assignments
router.get("/drivers/available", isAuthenticated, async (req, res) => {
  try {
    console.log("🔍 Driver lookup permission check:", {
      userPermissions: req.user?.permissions,
      requiredPermission: PERMISSIONS.DRIVERS_VIEW,
      hasPermission: hasPermission(req.user?.permissions || 0, PERMISSIONS.DRIVERS_VIEW)
    });
    
    if (!hasPermission(req.user?.permissions || 0, PERMISSIONS.DRIVERS_VIEW)) {
      return res.status(403).json({ error: "Insufficient permissions" });
    }

    const drivers = await storage.getAllDrivers();
    
    // Only return active drivers with essential info
    const availableDrivers = drivers
      .filter(driver => driver.isActive)
      .map(driver => ({
        id: driver.id,
        name: driver.name,
        email: driver.email,
        phone: driver.phone,
        availability: driver.availability,
        availabilityNotes: driver.availabilityNotes,
        hostLocation: driver.hostLocation,
        routeDescription: driver.routeDescription,
        vanApproved: driver.vanApproved,
        vehicleType: driver.vehicleType
      }));

    console.log(`Activity: EVENT_REQUESTS_VIEW - Retrieved ${availableDrivers.length} available drivers for assignment`);
    res.json(availableDrivers);
  } catch (error) {
    console.error("Error fetching available drivers:", error);
    res.status(500).json({ error: "Failed to fetch available drivers" });
  }
});

// Get complete event details by organization and contact
router.get("/details/:organizationName/:contactName", isAuthenticated, async (req, res) => {
  try {
    const { organizationName, contactName } = req.params;
    
    // Get event request matching the organization and contact
    const allEventRequests = await storage.getAllEventRequests();
    const eventRequest = allEventRequests.find((request: any) => 
      request.organizationName === organizationName && 
      (request.firstName + ' ' + request.lastName) === contactName
    );

    if (!eventRequest) {
      return res.status(404).json({ error: "Event request not found" });
    }

    // Return complete event details
    res.json(eventRequest);
  } catch (error) {
    console.error("Error fetching event details:", error);
    res.status(500).json({ error: "Failed to fetch event details" });
  }
});

// Debug middleware to catch all requests to this router
router.use((req, res, next) => {
  if ((req.method === "PATCH" || req.method === "PUT") && req.params.id) {
    console.log(`=== ROUTER DEBUG: ${req.method} ${req.originalUrl} ===`);
    console.log("Request params:", req.params);
    console.log("Request body:", JSON.stringify(req.body, null, 2));
  }
  next();
});

// Enhanced logging function for activity tracking with audit details
const logActivity = async (
  req: any,
  res: any,
  permission: string,
  message: string,
  metadata?: any
) => {
  // Store audit details in res.locals for the activity logger middleware to capture
  if (metadata) {
    res.locals.eventRequestAuditDetails = metadata;
  }
  // Activity logging will be handled by the global middleware
  console.log(`Activity: ${permission} - ${message}`, metadata ? `(with ${Object.keys(metadata).length} metadata fields)` : '');
};

// Enhanced audit logging for event request actions
const logEventRequestAudit = async (
  action: string,
  eventId: string,
  oldData: any,
  newData: any,
  req: any,
  additionalContext?: any
) => {
  try {
    const context = {
      userId: req.user?.id,
      ipAddress: req.ip || req.connection?.remoteAddress,
      userAgent: req.get('User-Agent'),
      sessionId: req.session?.id || req.sessionID
    };

    // Enhanced logging with action-specific details
    const enhancedNewData = {
      ...newData,
      actionContext: additionalContext || {},
      actionTimestamp: new Date().toISOString(),
      performedBy: req.user?.email || req.user?.displayName || 'Unknown User'
    };

    await AuditLogger.log(
      action,
      'event_requests',
      eventId,
      oldData,
      enhancedNewData,
      context
    );

    console.log(`🔍 AUDIT LOG: ${action} on Event ${eventId} by ${req.user?.email}`);
  } catch (error) {
    console.error('Failed to log audit entry:', error);
  }
};

// Get event requests assigned to the current user
router.get("/assigned", isAuthenticated, async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(400).json({ error: "User ID required" });
    }
    
    const allEventRequests = await storage.getAllEventRequests();
    const users = await storage.getAllUsers();
    const currentUser = users.find((u: any) => u.id === userId);
    
    // Filter event requests assigned to this user via multiple assignment methods
    const assignedEvents = allEventRequests.filter((event: any) => {
      // Method 1: Direct assignment via assignedTo field
      if (event.assignedTo === userId) return true;
      
      // Method 2: TSP contact assignment
      if (event.tspContact === userId || event.tspContactAssigned === userId) return true;
      
      // Method 2b: Additional TSP contacts (check if user email or name appears in additional contacts)
      if (event.additionalTspContacts && currentUser) {
        const additionalContacts = event.additionalTspContacts.toLowerCase();
        const userEmail = currentUser.email.toLowerCase();
        const userName = currentUser.displayName?.toLowerCase() || '';
        const userFirstName = currentUser.firstName?.toLowerCase() || '';
        const userLastName = currentUser.lastName?.toLowerCase() || '';
        
        if (additionalContacts.includes(userEmail) || 
            (userName && additionalContacts.includes(userName)) ||
            (userFirstName && userLastName && 
             (additionalContacts.includes(userFirstName) || additionalContacts.includes(userLastName)))) {
          return true;
        }
      }
      
      // Method 3: Listed in driver details (check if user's name or email appears in driver details)
      if (event.driverDetails && currentUser) {
        const driverText = event.driverDetails.toLowerCase();
        const userEmail = currentUser.email.toLowerCase();
        const userName = currentUser.displayName?.toLowerCase() || '';
        const userFirstName = currentUser.firstName?.toLowerCase() || '';
        const userLastName = currentUser.lastName?.toLowerCase() || '';
        
        if (driverText.includes(userEmail) || 
            (userName && driverText.includes(userName)) ||
            (userFirstName && userLastName && 
             (driverText.includes(userFirstName) || driverText.includes(userLastName)))) {
          return true;
        }
      }
      
      // Method 4: Listed in speaker details (check if user's name or email appears in speaker details)
      if (event.speakerDetails && currentUser) {
        const speakerText = event.speakerDetails.toLowerCase();
        const userEmail = currentUser.email.toLowerCase();
        const userName = currentUser.displayName?.toLowerCase() || '';
        const userFirstName = currentUser.firstName?.toLowerCase() || '';
        const userLastName = currentUser.lastName?.toLowerCase() || '';
        
        if (speakerText.includes(userEmail) || 
            (userName && speakerText.includes(userName)) ||
            (userFirstName && userLastName && 
             (speakerText.includes(userFirstName) || speakerText.includes(userLastName)))) {
          return true;
        }
      }
      
      return false;
    });
    
    // Add follow-up tracking for past events
    const now = new Date();
    const eventsWithFollowUp = assignedEvents.map((event: any) => {
      let followUpNeeded = false;
      let followUpReason = '';
      
      if (event.status === 'completed' && event.desiredEventDate) {
        try {
          const eventDate = new Date(event.desiredEventDate);
          const daysSinceEvent = Math.floor((now.getTime() - eventDate.getTime()) / (1000 * 60 * 60 * 24));
          
          // Follow-up needed 1 day after event (if not already done)
          if (daysSinceEvent === 1 && !event.followUpOneDayCompleted) {
            followUpNeeded = true;
            followUpReason = '1-day follow-up needed';
          }
          
          // Follow-up needed 1 month after event (if not already done)
          if (daysSinceEvent >= 30 && daysSinceEvent <= 32 && !event.followUpOneMonthCompleted) {
            followUpNeeded = true;
            followUpReason = '1-month follow-up needed';
          }
        } catch (error) {
          console.error('Error parsing event date for follow-up:', error);
        }
      }
      
      return {
        ...event,
        followUpNeeded,
        followUpReason,
        assignmentType: getAssignmentType(event, userId, currentUser)
      };
    });
    
    await logActivity(
      req,
      res,
      "EVENT_REQUESTS_VIEW", 
      `Retrieved ${eventsWithFollowUp.length} assigned event requests`,
    );
    
    res.json(eventsWithFollowUp);
  } catch (error) {
    console.error("Error fetching assigned event requests:", error);
    res.status(500).json({ error: "Failed to fetch assigned event requests" });
  }
});

// Helper function to determine assignment type
function getAssignmentType(event: any, userId: string, currentUser: any): string[] {
  const types: string[] = [];
  
  if (event.assignedTo === userId) types.push('Direct Assignment');
  if (event.tspContact === userId || event.tspContactAssigned === userId) types.push('TSP Contact');
  
  // Check additional TSP contacts
  if (event.additionalTspContacts && currentUser) {
    const additionalContacts = event.additionalTspContacts.toLowerCase();
    const userEmail = currentUser.email.toLowerCase();
    const userName = currentUser.displayName?.toLowerCase() || '';
    const userFirstName = currentUser.firstName?.toLowerCase() || '';
    const userLastName = currentUser.lastName?.toLowerCase() || '';
    
    if (additionalContacts.includes(userEmail) || 
        (userName && additionalContacts.includes(userName)) ||
        (userFirstName && userLastName && 
         (additionalContacts.includes(userFirstName) || additionalContacts.includes(userLastName)))) {
      types.push('TSP Contact');
    }
  }
  
  if (event.driverDetails && currentUser) {
    const driverText = event.driverDetails.toLowerCase();
    const userEmail = currentUser.email.toLowerCase();
    const userName = currentUser.displayName?.toLowerCase() || '';
    const userFirstName = currentUser.firstName?.toLowerCase() || '';
    const userLastName = currentUser.lastName?.toLowerCase() || '';
    
    if (driverText.includes(userEmail) || 
        (userName && driverText.includes(userName)) ||
        (userFirstName && userLastName && 
         (driverText.includes(userFirstName) || driverText.includes(userLastName)))) {
      types.push('Driver');
    }
  }
  
  if (event.speakerDetails && currentUser) {
    const speakerText = event.speakerDetails.toLowerCase();
    const userEmail = currentUser.email.toLowerCase();
    const userName = currentUser.displayName?.toLowerCase() || '';
    const userFirstName = currentUser.firstName?.toLowerCase() || '';
    const userLastName = currentUser.lastName?.toLowerCase() || '';
    
    if (speakerText.includes(userEmail) || 
        (userName && speakerText.includes(userName)) ||
        (userFirstName && userLastName && 
         (speakerText.includes(userFirstName) || speakerText.includes(userLastName)))) {
      types.push('Speaker');
    }
  }
  
  return types;
}

// Get all event requests
router.get(
  "/",
  isAuthenticated,
  requirePermission("EVENT_REQUESTS_VIEW"),
  async (req, res) => {
    try {
      await logActivity(
        req,
        res,
        "EVENT_REQUESTS_VIEW",
        "Retrieved all event requests",
      );
      const eventRequests = await storage.getAllEventRequests();
      res.json(eventRequests);
    } catch (error) {
      console.error("Error fetching event requests:", error);
      res.status(500).json({ message: "Failed to fetch event requests" });
    }
  },
);

// Get event requests by status
router.get(
  "/status/:status",
  isAuthenticated,
  requirePermission("EVENT_REQUESTS_VIEW"),
  async (req, res) => {
    try {
      const { status } = req.params;
      await logActivity(
        req,
        res,
        "EVENT_REQUESTS_VIEW",
        `Retrieved event requests with status: ${status}`,
      );
      const eventRequests = await storage.getEventRequestsByStatus(status);
      res.json(eventRequests);
    } catch (error) {
      console.error("Error fetching event requests by status:", error);
      res.status(500).json({ message: "Failed to fetch event requests" });
    }
  },
);

// Get organization event counts (completed events only) - MUST BE BEFORE /:id route
router.get("/organization-counts", isAuthenticated, async (req, res) => {
  try {
    console.log('🔍 Organization Counts API called by user:', req.user?.email);
    console.log('🔍 User permissions:', req.user?.permissions);
    
    const allEventRequests = await storage.getAllEventRequests();
    console.log('📊 Total event requests retrieved:', allEventRequests.length);
    
    // Count completed events by organization
    const organizationCounts = new Map();
    
    allEventRequests.forEach((event: any) => {
      // Only count completed events
      if (event.status === 'completed' && event.organizationName) {
        const orgName = event.organizationName.trim();
        if (orgName) {
          organizationCounts.set(orgName, (organizationCounts.get(orgName) || 0) + 1);
        }
      }
    });
    
    // Convert to array and sort by count (descending)
    const sortedCounts = Array.from(organizationCounts.entries())
      .map(([name, count]) => ({ organizationName: name, eventCount: count }))
      .sort((a, b) => b.eventCount - a.eventCount);
    
    console.log('📊 Organization counts calculated:', sortedCounts.length, 'organizations');
    res.json(sortedCounts);
  } catch (error) {
    console.error('❌ Error in organization counts API:', error);
    res.status(500).json({ error: "Failed to fetch organization counts" });
  }
});

// Get single event request
router.get(
  "/:id",
  isAuthenticated,
  requirePermission("EVENT_REQUESTS_VIEW"),
  async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid event request ID" });
      }
      const eventRequest = await storage.getEventRequest(id);

      if (!eventRequest) {
        return res.status(404).json({ message: "Event request not found" });
      }

      await logActivity(
        req,
        res,
        "EVENT_REQUESTS_VIEW",
        `Retrieved event request: ${id}`,
      );
      res.json(eventRequest);
    } catch (error) {
      console.error("Error fetching event request:", error);
      res.status(500).json({ message: "Failed to fetch event request" });
    }
  },
);

// Create new event request
router.post(
  "/",
  isAuthenticated,
  requirePermission("EVENT_REQUESTS_ADD"),
  async (req, res) => {
    try {
      const user = req.user;

      const validatedData = insertEventRequestSchema.parse(req.body);

      // Check for organization duplicates
      const duplicateCheck = { exists: false, matches: [] as any[] };

      const newEventRequest = await storage.createEventRequest({
        ...validatedData,
        organizationExists: duplicateCheck.exists,
        duplicateNotes: duplicateCheck.exists
          ? `Potential matches found: ${duplicateCheck.matches.map((m: any) => m.name).join(", ")}`
          : null,
        duplicateCheckDate: new Date(),
        createdBy: user?.id || 1,
      });

      // Enhanced audit logging for create operation
      await logEventRequestAudit(
        'CREATE',
        newEventRequest.id?.toString() || 'unknown',
        null,
        newEventRequest,
        req,
        {
          action: 'Event Request Created',
          organizationName: validatedData.organizationName,
          contactName: `${validatedData.firstName} ${validatedData.lastName}`,
          createdBy: user?.email || user?.displayName || 'Unknown User'
        }
      );

      await logActivity(
        req,
        res,
        "EVENT_REQUESTS_ADD",
        `Created event request: ${newEventRequest.id} for ${validatedData.organizationName}`,
      );
      res.status(201).json(newEventRequest);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res
          .status(400)
          .json({ message: "Invalid input", errors: error.errors });
      }
      console.error("Error creating event request:", error);
      res.status(500).json({ message: "Failed to create event request" });
    }
  },
);

// Complete primary contact - comprehensive data collection
router.patch(
  "/:id/details",
  isAuthenticated,
  requirePermission("EVENT_REQUESTS_EDIT"),
  async (req, res) => {
    try {
      const id = parseInt(req.params.id);

      const completionDataSchema = z.object({
        communicationMethod: z.string().min(1, "Communication method required"),
        eventAddress: z.string().optional(),
        estimatedSandwichCount: z.number().min(1).optional(),
        hasRefrigeration: z.boolean().optional(),
        notes: z.string().optional(),
      });

      const validatedData = completionDataSchema.parse(req.body);

      // Get original data for audit logging
      const originalEvent = await storage.getEventRequestById(id);
      if (!originalEvent) {
        return res.status(404).json({ message: "Event request not found" });
      }

      const updatedEventRequest = await storage.updateEventRequest(id, {
        contactedAt: new Date(),
        completedByUserId: req.user?.id,
        communicationMethod: validatedData.communicationMethod,
        eventAddress: validatedData.eventAddress,
        estimatedSandwichCount: validatedData.estimatedSandwichCount,
        hasRefrigeration: validatedData.hasRefrigeration,
        contactCompletionNotes: validatedData.notes,
        status: "contact_completed",
      });

      // Update Google Sheets with the new status
      try {
        const googleSheetsService = getEventRequestsGoogleSheetsService(storage);
        if (googleSheetsService && updatedEventRequest) {
          const contactName = `${updatedEventRequest.firstName} ${updatedEventRequest.lastName}`.trim();
          await googleSheetsService.updateEventRequestStatus(
            updatedEventRequest.organizationName,
            contactName,
            "contact_completed"
          );
        }
      } catch (error) {
        console.warn('Failed to update Google Sheets status:', error);
      }

      if (!updatedEventRequest) {
        return res.status(404).json({ message: "Event request not found" });
      }

      // Enhanced audit logging for contact completion
      await logEventRequestAudit(
        'PRIMARY_CONTACT_COMPLETED',
        id.toString(),
        originalEvent,
        updatedEventRequest,
        req,
        {
          action: 'Primary Contact Completed',
          organizationName: originalEvent.organizationName,
          contactName: `${originalEvent.firstName} ${originalEvent.lastName}`,
          completedBy: req.user?.email || req.user?.displayName || 'Unknown User',
          communicationMethod: validatedData.communicationMethod,
          estimatedSandwichCount: validatedData.estimatedSandwichCount,
          statusChange: `${originalEvent.status} → contact_completed`
        }
      );

      await logActivity(
        req,
        res,
        "EVENT_REQUESTS_COMPLETE_CONTACT",
        `Completed contact for event request: ${id}`,
      );
      res.json(updatedEventRequest);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res
          .status(400)
          .json({ message: "Invalid completion data", errors: error.errors });
      }
      console.error("Error completing contact:", error);
      res.status(500).json({ message: "Failed to complete contact" });
    }
  },
);

// Complete contact with comprehensive event details - single step workflow
router.post(
  "/complete-contact",
  isAuthenticated,
  requirePermission("EVENT_REQUESTS_EDIT"),
  async (req, res) => {
    try {
      const { id, ...updates } = req.body;

      console.log("=== COMPLETE CONTACT WITH DETAILS ===");
      console.log("Event ID:", id);
      console.log("Updates:", JSON.stringify(updates, null, 2));

      const updatedEventRequest = await storage.updateEventRequest(id, {
        ...updates,
        contactedAt: new Date(),
        completedByUserId: req.user?.id,
        contactCompletedAt: new Date(),
        updatedAt: new Date(),
      });

      if (!updatedEventRequest) {
        return res.status(404).json({ message: "Event request not found" });
      }

      // Update Google Sheets with the new status if status was provided
      if (updates.status) {
        try {
          const googleSheetsService = getEventRequestsGoogleSheetsService(storage);
          if (googleSheetsService) {
            const contactName = `${updatedEventRequest.firstName} ${updatedEventRequest.lastName}`.trim();
            await googleSheetsService.updateEventRequestStatus(
              updatedEventRequest.organizationName,
              contactName,
              updates.status
            );
          }
        } catch (error) {
          console.warn('Failed to update Google Sheets status:', error);
        }
      }

      console.log("Successfully completed contact with details for:", id);
      await logActivity(
        req,
        res,
        "EVENT_REQUESTS_COMPLETE_CONTACT",
        `Completed contact with comprehensive details for event request: ${id}`,
      );
      res.json(updatedEventRequest);
    } catch (error) {
      console.error("Error completing contact:", error);
      res.status(500).json({ message: "Failed to complete contact" });
    }
  },
);

// Complete event details - specific endpoint for comprehensive event planning updates
router.post(
  "/complete-event-details",
  isAuthenticated,
  requirePermission("EVENT_REQUESTS_EDIT"),
  async (req, res) => {
    try {
      // Skip validation entirely and just process the raw data
      const { id, ...updates } = req.body;

      console.log("=== COMPLETE EVENT DETAILS ===");
      console.log("Event ID:", id);
      console.log("Updates:", JSON.stringify(updates, null, 2));

      const updatedEventRequest = await storage.updateEventRequest(id, {
        ...updates,
        updatedAt: new Date(),
      });

      if (!updatedEventRequest) {
        return res.status(404).json({ message: "Event request not found" });
      }

      console.log("Successfully updated event details for:", id);
      await logActivity(
        req,
        res,
        "EVENT_REQUESTS_EDIT",
        `Completed event details for: ${id}`,
      );
      res.json(updatedEventRequest);
    } catch (error) {
      if (error instanceof z.ZodError) {
        console.error("Validation error:", error.errors);
        return res
          .status(400)
          .json({ message: "Invalid event details data", errors: error.errors });
      }
      console.error("Error completing event details:", error);
      res.status(500).json({ message: "Failed to complete event details" });
    }
  },
);

// Record follow-up action (email sent or callback completed)
router.post(
  "/follow-up",
  isAuthenticated,
  requirePermission("EVENT_REQUESTS_EDIT"),
  async (req, res) => {
    try {
      const { id, method, updatedEmail, notes } = req.body;

      console.log("=== FOLLOW-UP RECORDING ===");
      console.log("Event ID:", id);
      console.log("Method:", method);
      console.log("Updated email:", updatedEmail);

      // Get original data for audit logging
      const originalEvent = await storage.getEventRequestById(id);
      if (!originalEvent) {
        return res.status(404).json({ message: "Event request not found" });
      }

      const updates: any = {
        followUpMethod: method,
        followUpDate: new Date(),
        updatedAt: new Date(),
      };

      // Both email and call follow-ups should move event to in_process
      updates.status = 'in_process';
      if (method === 'call') {
        updates.updatedEmail = updatedEmail;
      }

      // Add notes to existing followUpNotes if provided
      if (notes) {
        const existingNotes = originalEvent?.followUpNotes || '';
        updates.followUpNotes = existingNotes ? `${existingNotes}\n\n${notes}` : notes;
      }

      const updatedEventRequest = await storage.updateEventRequest(id, updates);

      if (!updatedEventRequest) {
        return res.status(404).json({ message: "Event request not found" });
      }

      // Enhanced audit logging with detailed context
      await logEventRequestAudit(
        'FOLLOW_UP_RECORDED',
        id.toString(),
        originalEvent,
        updatedEventRequest,
        req,
        {
          followUpMethod: method,
          followUpAction: method === 'email' ? 'Email Follow-up Sent' : 'Call Follow-up Scheduled',
          statusChange: `${originalEvent.status} → ${updatedEventRequest.status}`,
          organizationName: originalEvent.organizationName,
          contactName: `${originalEvent.firstName} ${originalEvent.lastName}`,
          notes: notes || null,
          updatedEmail: updatedEmail || null
        }
      );

      console.log("Successfully recorded follow-up for:", id);
      await logActivity(
        req,
        res,
        "EVENT_REQUESTS_FOLLOW_UP",
        `Recorded follow-up (${method}) for event request: ${id}`,
      );
      res.json(updatedEventRequest);
    } catch (error) {
      console.error("Error recording follow-up:", error);
      res.status(500).json({ message: "Failed to record follow-up" });
    }
  },
);

// Update event request details - specific endpoint for event details updates
router.patch(
  "/:id/event-details",
  isAuthenticated,
  requirePermission("EVENT_REQUESTS_EDIT"),
  async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const updates = req.body;

      // Get original data for audit logging
      const originalEvent = await storage.getEventRequestById(id);
      if (!originalEvent) {
        return res.status(404).json({ message: "Event request not found" });
      }

      // Always update the updatedAt timestamp
      const updatedEventRequest = await storage.updateEventRequest(id, {
        ...updates,
        updatedAt: new Date(),
      });

      if (!updatedEventRequest) {
        return res.status(404).json({ message: "Event request not found" });
      }

      // Update Google Sheets if status was changed
      if (updates.status) {
        try {
          const googleSheetsService = getEventRequestsGoogleSheetsService(storage);
          if (googleSheetsService) {
            const contactName = `${updatedEventRequest.firstName} ${updatedEventRequest.lastName}`.trim();
            await googleSheetsService.updateEventRequestStatus(
              updatedEventRequest.organizationName,
              contactName,
              updates.status
            );
          }
        } catch (error) {
          console.warn('Failed to update Google Sheets status:', error);
        }
      }

      // Enhanced audit logging for event details update
      await logEventRequestAudit(
        'EVENT_DETAILS_UPDATED',
        id.toString(),
        originalEvent,
        updatedEventRequest,
        req,
        {
          action: 'Event Details Updated',
          organizationName: originalEvent.organizationName,
          contactName: `${originalEvent.firstName} ${originalEvent.lastName}`,
          updatedBy: req.user?.email || req.user?.displayName || 'Unknown User',
          updatedFields: Object.keys(updates),
          statusChange: updates.status ? `${originalEvent.status} → ${updates.status}` : null
        }
      );

      // Prepare audit details for activity logging
      const auditDetails: any = {};
      for (const [key, newValue] of Object.entries(updates)) {
        if (key !== 'updatedAt') { // Skip timestamp field
          const oldValue = (originalEvent as any)[key];
          if (oldValue !== newValue && newValue !== undefined) {
            auditDetails[key] = {
              from: oldValue,
              to: newValue
            };
          }
        }
      }

      await logActivity(
        req,
        res,
        "EVENT_REQUESTS_EDIT",
        `Updated event request details: ${Object.keys(auditDetails).join(', ')}`,
        { auditDetails: auditDetails }
      );
      res.json(updatedEventRequest);
    } catch (error) {
      console.error("Error updating event request details:", error);
      res
        .status(500)
        .json({ message: "Failed to update event request details" });
    }
  },
);

// Update event request (PUT)
router.put(
  "/:id",
  isAuthenticated,
  requirePermission("EVENT_REQUESTS_EDIT"),
  async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const updates = req.body;

      console.log("=== EVENT REQUEST UPDATE (PUT) ===");
      console.log("Request ID:", id);
      console.log("Updates received:", JSON.stringify(updates, null, 2));

      // Get original data for audit logging
      const originalEvent = await storage.getEventRequestById(id);
      if (!originalEvent) {
        return res.status(404).json({ message: "Event request not found" });
      }

      // Process ALL date/timestamp fields to ensure they're proper Date objects
      const processedUpdates = { ...updates };
      
      // Convert timestamp fields that might come as strings to Date objects
      const timestampFields = [
        'desiredEventDate', 'contactedAt', 'toolkitSentDate', 'duplicateCheckDate',
        'markedUnresponsiveAt', 'lastContactAttempt', 'nextFollowUpDate',
        'contactCompletedAt', 'callScheduledAt', 'callCompletedAt'
      ];
      timestampFields.forEach(field => {
        if (processedUpdates[field] && typeof processedUpdates[field] === 'string') {
          try {
            processedUpdates[field] = new Date(processedUpdates[field]);
          } catch (error) {
            console.error(`Failed to parse date field ${field}:`, processedUpdates[field]);
            delete processedUpdates[field]; // Remove invalid date fields
          }
        }
      });

      // Always update the updatedAt timestamp
      const updatedEventRequest = await storage.updateEventRequest(id, {
        ...processedUpdates,
        updatedAt: new Date(),
      });

      if (!updatedEventRequest) {
        return res.status(404).json({ message: "Event request not found" });
      }

      // Determine action type based on changes
      let actionType = 'EVENT_REQUEST_UPDATED';
      let actionContext: any = {
        organizationName: originalEvent.organizationName,
        contactName: `${originalEvent.firstName} ${originalEvent.lastName}`,
        fieldsUpdated: Object.keys(processedUpdates)
      };

      // Check for specific status changes
      if (originalEvent.status !== updatedEventRequest.status) {
        actionType = 'STATUS_CHANGED';
        actionContext.statusChange = `${originalEvent.status} → ${updatedEventRequest.status}`;
      }

      // Check for unresponsive marking
      if (updates.isUnresponsive && !originalEvent.isUnresponsive) {
        actionType = 'MARKED_UNRESPONSIVE';
        actionContext.unresponsiveReason = updates.unresponsiveReason;
        actionContext.contactMethod = updates.contactMethod;
      }

      // Enhanced audit logging with detailed context
      await logEventRequestAudit(
        actionType,
        id.toString(),
        originalEvent,
        updatedEventRequest,
        req,
        actionContext
      );

      console.log(
        "Updated event request:",
        JSON.stringify(updatedEventRequest, null, 2),
      );
      await logActivity(
        req,
        res,
        "EVENT_REQUESTS_EDIT",
        `Updated event request: ${id}`,
      );
      res.json(updatedEventRequest);
    } catch (error) {
      console.error("Error updating event request:", error);
      console.error("Error details:", {
        message: error.message,
        stack: error.stack,
        name: error.name
      });
      res.status(500).json({ 
        message: "Failed to update event request",
        error: error.message,
        details: "Check server logs for full error details"
      });
    }
  },
);

// Delete event request
router.delete(
  "/:id",
  isAuthenticated,
  requirePermission("EVENT_REQUESTS_DELETE"),
  async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      
      // Get original data for audit logging before deletion
      const originalEvent = await storage.getEventRequestById(id);
      if (!originalEvent) {
        return res.status(404).json({ message: "Event request not found" });
      }

      const deleted = await storage.deleteEventRequest(id);

      if (!deleted) {
        return res.status(404).json({ message: "Event request not found" });
      }

      // Enhanced audit logging for deletion
      await logEventRequestAudit(
        'DELETE',
        id.toString(),
        originalEvent,
        null,
        req,
        {
          action: 'Event Request Deleted',
          organizationName: originalEvent.organizationName,
          contactName: `${originalEvent.firstName} ${originalEvent.lastName}`,
          deletedBy: req.user?.email || req.user?.displayName || 'Unknown User',
          deletionReason: 'Manual deletion via UI'
        }
      );

      await logActivity(
        req,
        res,
        "EVENT_REQUESTS_DELETE",
        `Deleted event request: ${id}`,
      );
      res.json({ message: "Event request deleted successfully" });
    } catch (error) {
      console.error("Error deleting event request:", error);
      res.status(500).json({ message: "Failed to delete event request" });
    }
  },
);

// Check organization duplicates
router.post("/check-duplicates", async (req, res) => {
  try {
    const user = req.user;
    if (!user || !hasPermission(user, "EVENT_REQUESTS_VIEW")) {
      return res.status(403).json({ message: "Insufficient permissions" });
    }

    const { organizationName } = req.body;
    if (!organizationName) {
      return res.status(400).json({ message: "Organization name is required" });
    }

    const duplicateCheck = { exists: false, matches: [] };
    await logActivity(
      req,
      res,
      "EVENT_REQUESTS_VIEW",
      `Checked duplicates for organization: ${organizationName}`,
    );
    res.json(duplicateCheck);
  } catch (error) {
    console.error("Error checking organization duplicates:", error);
    res.status(500).json({ message: "Failed to check duplicates" });
  }
});

// Get recent audit logs for event requests - useful for tracking specific actions
router.get("/audit-logs", isAuthenticated, requirePermission("EVENT_REQUESTS_VIEW"), async (req, res) => {
  try {
    const { 
      limit = 50, 
      offset = 0, 
      eventId, 
      action, 
      userId,
      hours = 24 
    } = req.query;

    // Calculate time filter for recent actions (default last 24 hours)
    const sinceTime = new Date();
    sinceTime.setHours(sinceTime.getHours() - parseInt(hours as string));

    const auditHistory = await AuditLogger.getAuditHistory(
      'event_requests',
      eventId as string,
      userId as string,
      parseInt(limit as string),
      parseInt(offset as string)
    );

    // Filter for recent actions and enhance with readable context
    const recentLogs = auditHistory
      .filter(log => new Date(log.timestamp) > sinceTime)
      .filter(log => action ? log.action === action : true)
      .map(log => {
        let parsedNewData = null;
        let parsedOldData = null;
        
        try {
          parsedNewData = log.newData ? JSON.parse(log.newData) : null;
          parsedOldData = log.oldData ? JSON.parse(log.oldData) : null;
        } catch (e) {
          // Handle parsing errors gracefully
        }

        return {
          id: log.id,
          action: log.action,
          eventId: log.recordId,
          timestamp: log.timestamp,
          userId: log.userId,
          userEmail: parsedNewData?.performedBy || 'Unknown User',
          organizationName: parsedNewData?.actionContext?.organizationName || 'Unknown',
          contactName: parsedNewData?.actionContext?.contactName || 'Unknown',
          actionDescription: getActionDescription(log.action, parsedNewData?.actionContext),
          details: parsedNewData?.actionContext || null,
          statusChange: parsedNewData?.actionContext?.statusChange || null,
          followUpMethod: parsedNewData?.actionContext?.followUpMethod || null
        };
      });

    res.json({
      logs: recentLogs,
      total: recentLogs.length,
      timeRange: `Last ${hours} hours`,
      filters: { eventId, action, userId }
    });

  } catch (error) {
    console.error("Error fetching audit logs:", error);
    res.status(500).json({ message: "Failed to fetch audit logs" });
  }
});

// Helper function to generate readable action descriptions
function getActionDescription(action: string, context: any): string {
  switch (action) {
    case 'FOLLOW_UP_RECORDED':
      return `${context?.followUpAction || 'Follow-up recorded'} - ${context?.statusChange || ''}`;
    case 'STATUS_CHANGED':
      return `Status changed: ${context?.statusChange || 'Status updated'}`;
    case 'MARKED_UNRESPONSIVE':
      return `Marked unresponsive: ${context?.unresponsiveReason || 'No reason provided'}`;
    case 'EVENT_REQUEST_UPDATED':
      return `Updated fields: ${context?.fieldsUpdated?.join(', ') || 'Multiple fields'}`;
    default:
      return action.replace(/_/g, ' ').toLowerCase();
  }
}

// Organization management routes
router.get("/organizations/all", async (req, res) => {
  try {
    const user = req.user;
    if (!user || !hasPermission(user, "EVENT_REQUESTS_VIEW")) {
      return res.status(403).json({ message: "Insufficient permissions" });
    }

    const organizations = await storage.getAllOrganizations();
    await logActivity(
      req,
      res,
      "EVENT_REQUESTS_VIEW",
      "Retrieved all organizations",
    );
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

    await logActivity(
      req,
      res,
      PERMISSIONS.MANAGE_EVENT_REQUESTS,
      `Created organization: ${newOrganization.name}`,
    );
    res.status(201).json(newOrganization);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res
        .status(400)
        .json({ message: "Invalid input", errors: error.errors });
    }
    console.error("Error creating organization:", error);
    res.status(500).json({ message: "Failed to create organization" });
  }
});

// Google Sheets Sync Routes

// DEBUG: Test endpoint to check authentication
router.get("/debug/auth", (req, res) => {
  res.json({
    user: req.user
      ? {
          id: req.user.id,
          email: req.user.email,
          role: req.user.role,
          permissionCount: req.user.permissions?.length || 0,
        }
      : null,
    session: req.session?.user
      ? {
          email: req.session.user.email,
          role: req.session.user.role,
        }
      : null,
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
      permissionCount: user?.permissions?.length || 0,
    });

    // Temporarily disable all auth checks for testing
    // if (!user) {
    //   return res.status(403).json({ message: "Authentication required" });
    // }

    const syncService = getEventRequestsGoogleSheetsService(storage as any);
    if (!syncService) {
      return res.status(500).json({
        success: false,
        message: "Google Sheets service not configured",
      });
    }

    const result = await syncService.syncToGoogleSheets();
    await logActivity(
      req,
      res,
      PERMISSIONS.MANAGE_EVENT_REQUESTS,
      `Smart-synced ${result.synced || 0} event requests to Google Sheets (preserving manual columns N+)`,
    );

    res.json(result);
  } catch (error) {
    console.error("Error syncing event requests to Google Sheets:", error);
    res.status(500).json({
      success: false,
      message: "Failed to sync to Google Sheets",
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

    const syncService = getEventRequestsGoogleSheetsService(storage as any);
    if (!syncService) {
      return res.status(500).json({
        success: false,
        message: "Google Sheets service not configured",
      });
    }

    const result = await syncService.syncFromGoogleSheets();
    await logActivity(
      req,
      res,
      PERMISSIONS.MANAGE_EVENT_REQUESTS,
      `Synced from Google Sheets: ${result.created || 0} created, ${result.updated || 0} updated`,
    );

    res.json(result);
  } catch (error) {
    console.error("Error syncing event requests from Google Sheets:", error);
    res.status(500).json({
      success: false,
      message: "Failed to sync from Google Sheets",
    });
  }
});

// Analyze Google Sheets structure
router.get("/sync/analyze", async (req, res) => {
  try {
    // Temporarily disable all auth checks for testing
    // const user = req.user;
    // if (!user || (user.role !== 'super_admin' && !hasPermission(user, "EVENT_REQUESTS_VIEW"))) {
    //   return res.status(403).json({ message: "Insufficient permissions" });
    // }

    const syncService = getEventRequestsGoogleSheetsService(storage as any);
    if (!syncService) {
      return res.status(500).json({
        success: false,
        message: "Google Sheets service not configured",
      });
    }

    const analysis = await syncService.analyzeSheetStructure();
    await logActivity(
      req,
      res,
      "EVENT_REQUESTS_VIEW",
      "Analyzed Event Requests Google Sheet structure",
    );

    res.json({
      success: true,
      analysis,
      sheetUrl: `https://docs.google.com/spreadsheets/d/${process.env.EVENT_REQUESTS_SHEET_ID}/edit`,
      targetSpreadsheetId: process.env.EVENT_REQUESTS_SHEET_ID,
    });
  } catch (error) {
    console.error("Error analyzing Event Requests Google Sheet:", error);
    res.status(500).json({
      success: false,
      message: "Google Sheets analysis failed. Please check API credentials.",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// Get organizations catalog - aggregated data from event requests
router.get("/orgs-catalog-test", async (req, res) => {
  try {
    const user = req.user;
    console.log("🔍 Organizations catalog GET - Full debug:", {
      userExists: !!user,
      userId: user?.id,
      userEmail: user?.email,
      sessionExists: !!req.session,
      sessionUser: req.session?.user?.email || "none",
      userPermissionsCount: user?.permissions?.length || 0,
      hasViewOrgsPermission: user
        ? hasPermission(user, PERMISSIONS.VIEW_ORGANIZATIONS_CATALOG)
        : false,
      permissionConstant: PERMISSIONS.VIEW_ORGANIZATIONS_CATALOG,
    });

    // TEMP: Completely bypass auth for testing
    console.log("🔧 TEMP: Bypassing all auth checks for testing");

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
        if (
          new Date(request.createdAt) > new Date(existing.latestRequestDate)
        ) {
          existing.latestRequestDate = request.createdAt;
          existing.status = request.status;
        }

        // If any request has been contacted, update status
        if (request.contactedAt && existing.status === "new") {
          existing.status = "contacted";
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
          status: request.contactedAt ? "contacted" : request.status,
        });
      }
    });

    // Convert map to array
    const organizations = Array.from(organizationMap.values());

    logActivity(
      req,
      res,
      PERMISSIONS.VIEW_ORGANIZATIONS_CATALOG,
      `Retrieved organizations catalog: ${organizations.length} organizations`,
    );
    res.json(organizations);
  } catch (error) {
    console.error("Error fetching organizations catalog:", error);
    res.status(500).json({ message: "Failed to fetch organizations catalog" });
  }
});

// Mark follow-up as completed for an event
router.patch("/:id/follow-up", isAuthenticated, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { followUpType, notes } = req.body;
    
    if (!followUpType || !['one_day', 'one_month'].includes(followUpType)) {
      return res.status(400).json({ error: "Invalid follow-up type. Must be 'one_day' or 'one_month'" });
    }
    
    const userId = req.user?.id;
    if (!userId) {
      return res.status(400).json({ error: "User ID required" });
    }
    
    const eventRequest = await storage.getEventRequest(id);
    if (!eventRequest) {
      return res.status(404).json({ error: "Event request not found" });
    }
    
    // Prepare update data based on follow-up type
    const updateData: any = {
      followUpNotes: notes || eventRequest.followUpNotes
    };
    
    if (followUpType === 'one_day') {
      updateData.followUpOneDayCompleted = true;
      updateData.followUpOneDayDate = new Date();
    } else if (followUpType === 'one_month') {
      updateData.followUpOneMonthCompleted = true;
      updateData.followUpOneMonthDate = new Date();
    }
    
    const updatedEventRequest = await storage.updateEventRequest(id, updateData);
    
    await logActivity(
      req,
      res,
      "EVENT_REQUESTS_EDIT",
      `Marked ${followUpType} follow-up as completed for event: ${eventRequest.organizationName}`,
    );
    
    res.json(updatedEventRequest);
  } catch (error) {
    console.error("Error marking follow-up as completed:", error);
    res.status(500).json({ error: "Failed to mark follow-up as completed" });
  }
});

// Get organization event counts (completed events only)
router.get("/organization-counts", isAuthenticated, async (req, res) => {
  try {
    console.log('🔍 Organization Counts API called by user:', req.user?.email);
    console.log('🔍 User permissions:', req.user?.permissions);
    
    // Super admins can access this data, and it's general event statistics
    // Remove restrictive permission check for now
    // if (!hasPermission(req.user!, PERMISSIONS.VIEW_ORGANIZATIONS_CATALOG)) {
    //   console.log('❌ Insufficient permissions for organization counts');
    //   return res.status(403).json({ error: "Insufficient permissions" });
    // }

    const allEventRequests = await storage.getAllEventRequests();
    console.log('📊 Total event requests retrieved:', allEventRequests.length);
    
    // Count completed events by organization
    const organizationCounts = new Map();
    
    allEventRequests.forEach((event: any) => {
      // Only count completed events
      if (event.status === 'completed' && event.organizationName) {
        const orgName = event.organizationName.trim();
        const currentCount = organizationCounts.get(orgName) || 0;
        organizationCounts.set(orgName, currentCount + 1);
        
        // Debug specific organizations
        if (orgName === 'Volunteer Emory' || orgName === 'Christ the King School (August)') {
          console.log('🔍 Counting completed event:', {
            organization: orgName,
            status: event.status,
            newCount: currentCount + 1
          });
        }
      }
    });

    // Convert to object for easier consumption
    const countsObject = Object.fromEntries(organizationCounts);
    console.log('📈 Final organization counts:', countsObject);

    // logActivity(
    //   req,
    //   res,
    //   PERMISSIONS.VIEW_ORGANIZATIONS_CATALOG,
    //   `Retrieved event counts for ${organizationCounts.size} organizations`,
    // );
    
    res.json(countsObject);
  } catch (error) {
    console.error("Error fetching organization event counts:", error);
    res.status(500).json({ message: "Failed to fetch organization event counts" });
  }
});


// Update driver assignments for an event
router.patch("/:id/drivers", isAuthenticated, async (req, res) => {
  try {
    const eventId = parseInt(req.params.id);
    const { assignedDriverIds, driverPickupTime, driverNotes, driversArranged } = req.body;
    
    // Validate that the event exists first
    const existingEvent = await storage.getEventRequestById(eventId);
    if (!existingEvent) {
      return res.status(404).json({ error: "Event request not found" });
    }
    
    // Update the event with driver assignments
    const updateData = {
      assignedDriverIds: assignedDriverIds || [],
      driverPickupTime: driverPickupTime || null,
      driverNotes: driverNotes || null,
      driversArranged: driversArranged !== undefined ? driversArranged : (assignedDriverIds && assignedDriverIds.length > 0)
    };
    
    const updatedEvent = await storage.updateEventRequest(eventId, updateData);
    
    console.log(`Updated driver assignments for event ${eventId}:`, updateData);
    
    // Log activity
    await logActivity(
      req,
      res,
      "update_event_drivers",
      `Updated driver assignments for event: ${existingEvent.organizationName}`
    );
    
    res.json(updatedEvent);
  } catch (error) {
    console.error("Error updating driver assignments:", error);
    res.status(500).json({ error: "Failed to update driver assignments" });
  }
});

// Event Volunteers Routes

// Get all event volunteers for a specific event
router.get("/:eventId/volunteers", isAuthenticated, async (req, res) => {
  try {
    const eventId = parseInt(req.params.eventId);
    
    if (!eventId || isNaN(eventId)) {
      return res.status(400).json({ error: "Valid event ID required" });
    }
    
    const volunteers = await storage.getEventVolunteersByEventId(eventId);
    
    console.log(`Retrieved ${volunteers.length} volunteers for event ${eventId}`);
    res.json(volunteers);
  } catch (error) {
    console.error("Error fetching event volunteers:", error);
    res.status(500).json({ error: "Failed to fetch event volunteers" });
  }
});

// Sign up a user as a volunteer for an event
router.post("/:eventId/volunteers", isAuthenticated, async (req, res) => {
  try {
    const eventId = parseInt(req.params.eventId);
    const userId = req.user?.id;
    
    if (!eventId || isNaN(eventId)) {
      return res.status(400).json({ error: "Valid event ID required" });
    }
    
    if (!userId) {
      return res.status(400).json({ error: "User authentication required" });
    }
    
    // Validate request body against schema
    const volunteerData = insertEventVolunteerSchema.parse({
      ...req.body,
      eventRequestId: eventId,
      volunteerUserId: userId
    });
    
    // Check if user is already signed up for this event with the same role
    const existingVolunteers = await storage.getEventVolunteersByEventId(eventId);
    const alreadySignedUp = existingVolunteers.find(v => 
      v.volunteerUserId === userId && v.role === volunteerData.role
    );
    
    if (alreadySignedUp) {
      return res.status(400).json({ 
        error: `You are already signed up as a ${volunteerData.role} for this event` 
      });
    }
    
    const newVolunteer = await storage.createEventVolunteer(volunteerData);
    
    await logActivity(
      req,
      res,
      "volunteer_signup",
      `Signed up as ${volunteerData.role} for event: ${eventId}`
    );
    
    res.status(201).json(newVolunteer);
  } catch (error) {
    console.error("Error creating event volunteer signup:", error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid volunteer data", details: error.errors });
    }
    res.status(500).json({ error: "Failed to sign up for event" });
  }
});

// Update volunteer status or assignment
router.patch("/volunteers/:volunteerId", isAuthenticated, async (req, res) => {
  try {
    const volunteerId = parseInt(req.params.volunteerId);
    
    if (!volunteerId || isNaN(volunteerId)) {
      return res.status(400).json({ error: "Valid volunteer ID required" });
    }
    
    const updates = req.body;
    
    const updatedVolunteer = await storage.updateEventVolunteer(volunteerId, updates);
    
    if (!updatedVolunteer) {
      return res.status(404).json({ error: "Volunteer assignment not found" });
    }
    
    await logActivity(
      req,
      res,
      "volunteer_update",
      `Updated volunteer assignment: ${volunteerId}`
    );
    
    res.json(updatedVolunteer);
  } catch (error) {
    console.error("Error updating event volunteer:", error);
    res.status(500).json({ error: "Failed to update volunteer assignment" });
  }
});

// Remove volunteer from event
router.delete("/volunteers/:volunteerId", isAuthenticated, async (req, res) => {
  try {
    const volunteerId = parseInt(req.params.volunteerId);
    
    if (!volunteerId || isNaN(volunteerId)) {
      return res.status(400).json({ error: "Valid volunteer ID required" });
    }
    
    const deleted = await storage.deleteEventVolunteer(volunteerId);
    
    if (!deleted) {
      return res.status(404).json({ error: "Volunteer assignment not found" });
    }
    
    await logActivity(
      req,
      res,
      "volunteer_removal",
      `Removed volunteer assignment: ${volunteerId}`
    );
    
    res.json({ success: true });
  } catch (error) {
    console.error("Error removing event volunteer:", error);
    res.status(500).json({ error: "Failed to remove volunteer assignment" });
  }
});

// Get all volunteer signups for the current user
router.get("/my-volunteers", isAuthenticated, async (req, res) => {
  try {
    const userId = req.user?.id;
    
    if (!userId) {
      return res.status(400).json({ error: "User authentication required" });
    }
    
    const userVolunteers = await storage.getEventVolunteersByUserId(userId);
    
    // Enrich with event details
    const enrichedVolunteers = await Promise.all(
      userVolunteers.map(async (volunteer) => {
        const eventRequest = await storage.getEventRequestById(volunteer.eventRequestId);
        return {
          ...volunteer,
          eventRequest
        };
      })
    );
    
    console.log(`Retrieved ${userVolunteers.length} volunteer signups for user ${userId}`);
    res.json(enrichedVolunteers);
  } catch (error) {
    console.error("Error fetching user volunteers:", error);
    res.status(500).json({ error: "Failed to fetch volunteer signups" });
  }
});

export default router;
