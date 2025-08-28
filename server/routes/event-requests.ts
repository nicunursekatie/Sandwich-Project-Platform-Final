import { Router } from "express";
import { z } from "zod";
import { storage } from "../storage-wrapper";
import { insertEventRequestSchema, insertOrganizationSchema } from "@shared/schema";
import { hasPermission } from "@shared/auth-utils";
import { createActivityLogger } from "../middleware/activity-logger";

const router = Router();
const logActivity = createActivityLogger("Event Requests");

// Get all event requests
router.get("/", async (req, res) => {
  try {
    const user = req.user;
    if (!user || !hasPermission(user, "VIEW_EVENT_REQUESTS")) {
      return res.status(403).json({ message: "Insufficient permissions" });
    }

    logActivity(req, "VIEW_EVENT_REQUESTS", "Retrieved all event requests");
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
    if (!user || !hasPermission(user, "VIEW_EVENT_REQUESTS")) {
      return res.status(403).json({ message: "Insufficient permissions" });
    }

    const { status } = req.params;
    logActivity(req, "VIEW_EVENT_REQUESTS", `Retrieved event requests with status: ${status}`);
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
    if (!user || !hasPermission(user, "VIEW_EVENT_REQUESTS")) {
      return res.status(403).json({ message: "Insufficient permissions" });
    }

    const id = parseInt(req.params.id);
    const eventRequest = await storage.getEventRequest(id);
    
    if (!eventRequest) {
      return res.status(404).json({ message: "Event request not found" });
    }

    logActivity(req, "VIEW_EVENT_REQUESTS", `Retrieved event request: ${id}`);
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
    if (!user || !hasPermission(user, "ADD_EVENT_REQUESTS")) {
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

    logActivity(req, "ADD_EVENT_REQUESTS", `Created event request: ${newEventRequest.id} for ${validatedData.organizationName}`);
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
    if (!user || !hasPermission(user, "EDIT_EVENT_REQUESTS")) {
      return res.status(403).json({ message: "Insufficient permissions" });
    }

    const id = parseInt(req.params.id);
    const updates = req.body;

    const updatedEventRequest = await storage.updateEventRequest(id, updates);
    
    if (!updatedEventRequest) {
      return res.status(404).json({ message: "Event request not found" });
    }

    logActivity(req, "EDIT_EVENT_REQUESTS", `Updated event request: ${id}`);
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
    if (!user || !hasPermission(user, "DELETE_EVENT_REQUESTS")) {
      return res.status(403).json({ message: "Insufficient permissions" });
    }

    const id = parseInt(req.params.id);
    const deleted = await storage.deleteEventRequest(id);
    
    if (!deleted) {
      return res.status(404).json({ message: "Event request not found" });
    }

    logActivity(req, "DELETE_EVENT_REQUESTS", `Deleted event request: ${id}`);
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
    if (!user || !hasPermission(user, "VIEW_EVENT_REQUESTS")) {
      return res.status(403).json({ message: "Insufficient permissions" });
    }

    const { organizationName } = req.body;
    if (!organizationName) {
      return res.status(400).json({ message: "Organization name is required" });
    }

    const duplicateCheck = await storage.checkOrganizationDuplicates(organizationName);
    logActivity(req, "VIEW_EVENT_REQUESTS", `Checked duplicates for organization: ${organizationName}`);
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
    if (!user || !hasPermission(user, "VIEW_EVENT_REQUESTS")) {
      return res.status(403).json({ message: "Insufficient permissions" });
    }

    const organizations = await storage.getAllOrganizations();
    logActivity(req, "VIEW_EVENT_REQUESTS", "Retrieved all organizations");
    res.json(organizations);
  } catch (error) {
    console.error("Error fetching organizations:", error);
    res.status(500).json({ message: "Failed to fetch organizations" });
  }
});

router.post("/organizations", async (req, res) => {
  try {
    const user = req.user;
    if (!user || !hasPermission(user, "MANAGE_EVENT_REQUESTS")) {
      return res.status(403).json({ message: "Insufficient permissions" });
    }

    const validatedData = insertOrganizationSchema.parse(req.body);
    const newOrganization = await storage.createOrganization(validatedData);

    logActivity(req, "MANAGE_EVENT_REQUESTS", `Created organization: ${newOrganization.name}`);
    res.status(201).json(newOrganization);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: "Invalid input", errors: error.errors });
    }
    console.error("Error creating organization:", error);
    res.status(500).json({ message: "Failed to create organization" });
  }
});

export default router;