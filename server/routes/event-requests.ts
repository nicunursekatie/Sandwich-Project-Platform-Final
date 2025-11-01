import { Router, Response } from 'express';
import { z } from 'zod';
import { storage } from '../storage-wrapper';
import {
  insertEventRequestSchema,
  insertOrganizationSchema,
  insertEventVolunteerSchema,
  auditLogs,
  type EventRequest,
  type User,
} from '@shared/schema';
import { hasPermission, PERMISSIONS } from '@shared/auth-utils';
import { requirePermission } from '../middleware/auth';
import { isAuthenticated } from '../auth';
import { getEventRequestsGoogleSheetsService } from '../google-sheets-event-requests-sync';
import { AuditLogger } from '../audit-logger';
import { db } from '../db';
import { eq, desc, and, sql, gte } from 'drizzle-orm';
import { EmailNotificationService } from '../services/email-notification-service';
import { logger } from '../middleware/logger';
import type { AuthenticatedRequest } from '../types/express';

const router = Router();

// Helper functions for pickup time data migration
const convertTimeToDateTime = (timeStr: string, baseDate?: Date): string | null => {
  if (!timeStr) return null;
  
  try {
    // Use base date or today if not provided
    const date = baseDate || new Date();
    
    // Parse time string (supports formats like "2:30 PM", "14:30", "2:30")
    const timeMatch = timeStr.match(/^(\d{1,2}):(\d{2})(?:\s*(AM|PM))?$/i);
    if (!timeMatch) return null;
    
    let hours = parseInt(timeMatch[1]);
    const minutes = parseInt(timeMatch[2]);
    const ampm = timeMatch[3]?.toUpperCase();
    
    // Convert to 24-hour format if needed
    if (ampm === 'PM' && hours !== 12) hours += 12;
    if (ampm === 'AM' && hours === 12) hours = 0;
    
    // Create datetime with the same date but specified time
    const dateTime = new Date(date.getFullYear(), date.getMonth(), date.getDate(), hours, minutes);
    return dateTime.toISOString(); // Return ISO string as per function signature
  } catch (error) {
    return null;
  }
};

const extractTimeFromDateTime = (dateTimeStr: string): string | null => {
  if (!dateTimeStr) return null;
  
  try {
    const date = new Date(dateTimeStr);
    if (isNaN(date.getTime())) return null;
    
    // Extract time in 12-hour format with AM/PM
    const timeStr = date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
    
    return timeStr;
  } catch (error) {
    return null;
  }
};

// Data migration logic for pickup time fields
const processPickupTimeFields = (updates: Partial<EventRequest>, existingData?: Partial<EventRequest>) => {
  const result = { ...updates };
  
  // Get existing values for reference
  const existingPickupTime = existingData?.pickupTime;
  const existingPickupDateTime = existingData?.pickupDateTime;
  const existingScheduledDate = existingData?.scheduledEventDate || existingData?.desiredEventDate;
  
  // Handle the case where both fields are provided in the update
  if (updates.pickupTime && updates.pickupDateTime) {
    // Prioritize pickupDateTime, but ensure pickupTime is consistent
    const extractedTime = extractTimeFromDateTime(updates.pickupDateTime);
    if (extractedTime) {
      result.pickupTime = extractedTime;
    }
  }
  // Handle the case where only pickupDateTime is provided
  else if (updates.pickupDateTime && !updates.pickupTime) {
    const extractedTime = extractTimeFromDateTime(updates.pickupDateTime);
    if (extractedTime) {
      result.pickupTime = extractedTime;
    }
  }
  // Handle the case where only pickupTime is provided
  else if (updates.pickupTime && !updates.pickupDateTime) {
    // Try to convert using scheduled date or today as base
    const baseDate = existingScheduledDate ? new Date(existingScheduledDate) : new Date();
    const convertedDateTime = convertTimeToDateTime(updates.pickupTime, baseDate);
    if (convertedDateTime) {
      result.pickupDateTime = convertedDateTime;
    }
  }
  // Handle existing data scenarios during reads/updates
  else if (!updates.pickupTime && !updates.pickupDateTime && existingData) {
    // Fill in missing fields from existing data
    if (existingPickupTime && !existingPickupDateTime) {
      const baseDate = existingScheduledDate ? new Date(existingScheduledDate) : new Date();
      const convertedDateTime = convertTimeToDateTime(existingPickupTime, baseDate);
      if (convertedDateTime) {
        result.pickupDateTime = convertedDateTime;
      }
    } else if (existingPickupDateTime && !existingPickupTime) {
      const extractedTime = extractTimeFromDateTime(existingPickupDateTime);
      if (extractedTime) {
        result.pickupTime = extractedTime;
      }
    }
  }
  
  return result;
};

// Get available drivers for event assignments
router.get('/drivers/available', isAuthenticated, async (req, res) => {
  try {
    if (!hasPermission(req.user, PERMISSIONS.DRIVERS_VIEW)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    const drivers = await storage.getAllDrivers();

    // Only return active drivers with essential info
    const availableDrivers = drivers
      .filter((driver) => driver.isActive)
      .map((driver) => ({
        id: driver.id,
        name: driver.name,
        email: driver.email,
        phone: driver.phone,
        availability: driver.availability,
        availabilityNotes: driver.availabilityNotes,
        hostLocation: driver.hostLocation,
        routeDescription: driver.routeDescription,
        vanApproved: driver.vanApproved,
        vehicleType: driver.vehicleType,
      }));

    res.json(availableDrivers);
  } catch (error) {
    logger.error('Failed to fetch available drivers', error);
    res.status(500).json({ error: 'Failed to fetch available drivers' });
  }
});

// Get complete event details by organization and contact
router.get(
  '/details/:organizationName/:contactName',
  isAuthenticated,
  async (req, res) => {
    try {
      const { organizationName, contactName } = req.params;

      // Get event request matching the organization and contact
      const allEventRequests = await storage.getAllEventRequests();
      const eventRequest = allEventRequests.find(
        (request) =>
          request.organizationName === organizationName &&
          request.firstName + ' ' + request.lastName === contactName
      );

      if (!eventRequest) {
        return res.status(404).json({ error: 'Event request not found' });
      }

      // Return complete event details
      res.json(eventRequest);
    } catch (error) {
      logger.error('Failed to fetch event details', error);
      res.status(500).json({ error: 'Failed to fetch event details' });
    }
  }
);


// Enhanced logging function for activity tracking with audit details
const logActivity = async (
  req: AuthenticatedRequest,
  res: Response,
  permission: string,
  message: string,
  metadata?: Record<string, unknown>
) => {
  // Store audit details in res.locals for the activity logger middleware to capture
  if (metadata) {
    res.locals.eventRequestAuditDetails = metadata;
  }
  // Activity logging will be handled by the global middleware
};

// Valid status values for event requests
const VALID_EVENT_REQUEST_STATUSES = [
  'new',
  'followed_up', 
  'in_process',
  'scheduled',
  'completed',
  'declined'
] as const;

// Helper function to validate and sanitize status values
const validateEventRequestStatus = (status: string): string | null => {
  if (!status) return null;
  
  // Convert common invalid statuses to valid ones
  const statusMap: Record<string, string> = {
    'approved': 'scheduled', // Map 'approved' to 'scheduled'
    'pending': 'new',        // Map 'pending' to 'new'
    'in_progress': 'in_process', // Map 'in_progress' to 'in_process'
  };
  
  const normalizedStatus = status.toLowerCase();
  const mappedStatus = statusMap[normalizedStatus] || normalizedStatus;
  
  if (VALID_EVENT_REQUEST_STATUSES.includes(mappedStatus as typeof VALID_EVENT_REQUEST_STATUSES[number])) {
    return mappedStatus;
  }
  
  logger.warn(`Invalid event request status "${status}" - will not be logged in audit`);
  return null;
};

// Enhanced audit logging for event request actions
const logEventRequestAudit = async (
  action: string,
  eventId: string,
  oldData: Partial<EventRequest> | null,
  newData: Partial<EventRequest>,
  req: AuthenticatedRequest,
  additionalContext?: Record<string, unknown>
) => {
  try {
    // PROBLEM 1 FIX: Ensure we have complete event request data
    // If newData is partial (like req.body), get the complete updated event request
    let completeNewData = newData;
    
    // Check if newData has essential fields for audit logging
    if (!newData?.organizationName || !newData?.firstName || !newData?.lastName) {
      try {
        const completeEventData = await storage.getEventRequestById(parseInt(eventId));
        if (completeEventData) {
          completeNewData = completeEventData;
        }
      } catch (error) {
        // Continue with partial data rather than failing
      }
    }
    
    // PROBLEM 2 FIX: Validate status values before logging
    if (completeNewData?.status) {
      const validatedStatus = validateEventRequestStatus(completeNewData.status);
      if (validatedStatus && validatedStatus !== completeNewData.status) {
        completeNewData = {
          ...completeNewData,
          status: validatedStatus
        };
      } else if (!validatedStatus) {
        // Remove invalid status to prevent logging invalid data
        const { status, ...dataWithoutStatus } = completeNewData;
        completeNewData = dataWithoutStatus;
      }
    }
    
    const context = {
      userId: req.user?.id,
      ipAddress: req.ip || req.connection?.remoteAddress,
      userAgent: req.get('User-Agent'),
      sessionId: req.session?.id || req.sessionID,
    };

    // Call the audit logger with complete, validated data
    await AuditLogger.logEventRequestChange(
      eventId,
      oldData,
      completeNewData,
      context,
      additionalContext
    );
  } catch (error) {
    logger.error('Failed to log audit entry', error);
  }
};

// Get event requests assigned to the current user
router.get('/assigned', isAuthenticated, async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(400).json({ error: 'User ID required' });
    }

    const allEventRequests = await storage.getAllEventRequests();
    const users = await storage.getAllUsers();
    const currentUser = users.find((u) => u.id === userId);

    // Filter event requests assigned to this user via multiple assignment methods
    const assignedEvents = allEventRequests.filter((event) => {
      // Method 1: Direct assignment via assignedTo field
      if (event.assignedTo === userId) return true;

      // Method 2: TSP contact assignment
      if (event.tspContact === userId || event.tspContactAssigned === userId)
        return true;

      // Method 2b: Additional TSP contacts (check if user email or name appears in additional contacts)
      if (event.additionalTspContacts && currentUser && currentUser.email) {
        const additionalContacts = event.additionalTspContacts.toLowerCase();
        const userEmail = currentUser.email.toLowerCase();
        const userName = currentUser.displayName?.toLowerCase() || '';
        const userFirstName = currentUser.firstName?.toLowerCase() || '';
        const userLastName = currentUser.lastName?.toLowerCase() || '';

        if (
          additionalContacts.includes(userEmail) ||
          (userName && additionalContacts.includes(userName)) ||
          (userFirstName &&
            userLastName &&
            (additionalContacts.includes(userFirstName) ||
              additionalContacts.includes(userLastName)))
        ) {
          return true;
        }
      }

      // Method 3: Listed in driver details (check if user's name or email appears in driver details)
      if (event.driverDetails && currentUser) {
        // driverDetails is now JSONB - convert to string for text search
        const driverText = (
          typeof event.driverDetails === 'string'
            ? event.driverDetails
            : JSON.stringify(event.driverDetails)
        ).toLowerCase();
        const userEmail = currentUser.email?.toLowerCase() || '';
        const userName = currentUser.displayName?.toLowerCase() || '';
        const userFirstName = currentUser.firstName?.toLowerCase() || '';
        const userLastName = currentUser.lastName?.toLowerCase() || '';

        if (
          driverText.includes(userEmail) ||
          (userName && driverText.includes(userName)) ||
          (userFirstName &&
            userLastName &&
            (driverText.includes(userFirstName) ||
              driverText.includes(userLastName)))
        ) {
          return true;
        }
      }

      // Method 4: Listed in speaker details (check if user's name or email appears in speaker details)
      if (event.speakerDetails && currentUser && currentUser.email) {
        const speakerText = event.speakerDetails.toLowerCase();
        const userEmail = currentUser.email.toLowerCase();
        const userName = currentUser.displayName?.toLowerCase() || '';
        const userFirstName = currentUser.firstName?.toLowerCase() || '';
        const userLastName = currentUser.lastName?.toLowerCase() || '';

        if (
          speakerText.includes(userEmail) ||
          (userName && speakerText.includes(userName)) ||
          (userFirstName &&
            userLastName &&
            (speakerText.includes(userFirstName) ||
              speakerText.includes(userLastName)))
        ) {
          return true;
        }
      }

      return false;
    });

    // Add follow-up tracking for past events
    const now = new Date();
    const eventsWithFollowUp = assignedEvents.map((event) => {
      let followUpNeeded = false;
      let followUpReason = '';

      if (event.status === 'completed' && event.desiredEventDate) {
        try {
          const eventDate = new Date(event.desiredEventDate);
          const daysSinceEvent = Math.floor(
            (now.getTime() - eventDate.getTime()) / (1000 * 60 * 60 * 24)
          );

          // Follow-up needed 1 day after event (if not already done)
          if (daysSinceEvent === 1 && !event.followUpOneDayCompleted) {
            followUpNeeded = true;
            followUpReason = '1-day follow-up needed';
          }

          // Follow-up needed 1 month after event (if not already done)
          if (
            daysSinceEvent >= 30 &&
            daysSinceEvent <= 32 &&
            !event.followUpOneMonthCompleted
          ) {
            followUpNeeded = true;
            followUpReason = '1-month follow-up needed';
          }
        } catch (error) {
          // Silently handle date parsing errors
        }
      }

      return {
        ...event,
        followUpNeeded,
        followUpReason,
        assignmentType: getAssignmentType(event, userId, currentUser),
      };
    });

    await logActivity(
      req,
      res,
      'EVENT_REQUESTS_VIEW',
      `Retrieved ${eventsWithFollowUp.length} assigned event requests`
    );

    res.json(eventsWithFollowUp);
  } catch (error) {
    logger.error('Failed to fetch assigned event requests', error);
    res.status(500).json({ error: 'Failed to fetch assigned event requests' });
  }
});

// Helper function to determine assignment type
function getAssignmentType(
  event: EventRequest,
  userId: string,
  currentUser: User | undefined
): string[] {
  const types: string[] = [];

  if (event.assignedTo === userId) types.push('Direct Assignment');
  if (event.tspContact === userId || event.tspContactAssigned === userId)
    types.push('TSP Contact');

  // Check additional TSP contacts
  if (event.additionalTspContacts && currentUser && currentUser.email) {
    const additionalContacts = event.additionalTspContacts.toLowerCase();
    const userEmail = currentUser.email.toLowerCase();
    const userName = currentUser.displayName?.toLowerCase() || '';
    const userFirstName = currentUser.firstName?.toLowerCase() || '';
    const userLastName = currentUser.lastName?.toLowerCase() || '';

    if (
      additionalContacts.includes(userEmail) ||
      (userName && additionalContacts.includes(userName)) ||
      (userFirstName &&
        userLastName &&
        (additionalContacts.includes(userFirstName) ||
          additionalContacts.includes(userLastName)))
    ) {
      types.push('TSP Contact');
    }
  }

  if (event.driverDetails && currentUser && currentUser.email) {
    // driverDetails is now JSONB - convert to string for text search
    const driverText = (
      typeof event.driverDetails === 'string'
        ? event.driverDetails
        : JSON.stringify(event.driverDetails)
    ).toLowerCase();
    const userEmail = currentUser.email.toLowerCase();
    const userName = currentUser.displayName?.toLowerCase() || '';
    const userFirstName = currentUser.firstName?.toLowerCase() || '';
    const userLastName = currentUser.lastName?.toLowerCase() || '';

    if (
      driverText.includes(userEmail) ||
      (userName && driverText.includes(userName)) ||
      (userFirstName &&
        userLastName &&
        (driverText.includes(userFirstName) ||
          driverText.includes(userLastName)))
    ) {
      types.push('Driver');
    }
  }

  if (event.speakerDetails && currentUser && currentUser.email) {
    const speakerText = event.speakerDetails.toLowerCase();
    const userEmail = currentUser.email.toLowerCase();
    const userName = currentUser.displayName?.toLowerCase() || '';
    const userFirstName = currentUser.firstName?.toLowerCase() || '';
    const userLastName = currentUser.lastName?.toLowerCase() || '';

    if (
      speakerText.includes(userEmail) ||
      (userName && speakerText.includes(userName)) ||
      (userFirstName &&
        userLastName &&
        (speakerText.includes(userFirstName) ||
          speakerText.includes(userLastName)))
    ) {
      types.push('Speaker');
    }
  }

  return types;
}

// Get all event requests
router.get(
  '/',
  isAuthenticated,
  requirePermission('EVENT_REQUESTS_VIEW'),
  async (req, res) => {
    try {
      res.set({
        'Cache-Control': 'no-store, no-cache, must-revalidate, private',
        'Pragma': 'no-cache',
        'Expires': '0'
      });
      
      await logActivity(
        req,
        res,
        'EVENT_REQUESTS_VIEW',
        'Retrieved all event requests'
      );
      const eventRequests = await storage.getAllEventRequests();
      
      // DEBUG: Log details about what we're returning
      const completedCount = eventRequests.filter(e => e.status === 'completed').length;
      logger.log(`📊 API returning ${eventRequests.length} total events (${completedCount} completed)`);
      
      // Check for duplicate IDs
      const ids = eventRequests.map(e => e.id);
      const uniqueIds = new Set(ids);
      if (ids.length !== uniqueIds.size) {
        logger.error(`⚠️ DUPLICATE EVENT IDS DETECTED! Total: ${ids.length}, Unique: ${uniqueIds.size}`);
        const duplicates = ids.filter((id, index) => ids.indexOf(id) !== index);
        logger.error(`Duplicate IDs: ${[...new Set(duplicates)].join(', ')}`);
      }
      
      res.json(eventRequests);
    } catch (error) {
      logger.error('Failed to fetch event requests', error);
      res.status(500).json({ message: 'Failed to fetch event requests' });
    }
  }
);

// Get event requests by status
router.get(
  '/status/:status',
  isAuthenticated,
  requirePermission('EVENT_REQUESTS_VIEW'),
  async (req, res) => {
    try {
      const { status } = req.params;
      await logActivity(
        req,
        res,
        'EVENT_REQUESTS_VIEW',
        `Retrieved event requests with status: ${status}`
      );
      const eventRequests = await storage.getEventRequestsByStatus(status);
      res.json(eventRequests);
    } catch (error) {
      logger.error('Failed to fetch event requests by status', error);
      res.status(500).json({ message: 'Failed to fetch event requests' });
    }
  }
);

// Get organization event counts (completed events only) - MUST BE BEFORE /:id route
router.get('/organization-counts', isAuthenticated, async (req, res) => {
  try {
    const allEventRequests = await storage.getAllEventRequests();

    // Count completed events by organization
    const organizationCounts = new Map();

    allEventRequests.forEach((event) => {
      // Only count completed events
      if (event.status === 'completed' && event.organizationName) {
        const orgName = event.organizationName.trim();
        if (orgName) {
          organizationCounts.set(
            orgName,
            (organizationCounts.get(orgName) || 0) + 1
          );
        }
      }
    });

    // Convert to array and sort by count (descending)
    const sortedCounts = Array.from(organizationCounts.entries())
      .map(([name, count]) => ({ organizationName: name, eventCount: count }))
      .sort((a, b) => b.eventCount - a.eventCount);

    res.json(sortedCounts);
  } catch (error) {
    logger.error('Failed to fetch organization counts', error);
    res.status(500).json({ error: 'Failed to fetch organization counts' });
  }
});

// Get single event request
router.get(
  '/:id(\\d+)',
  isAuthenticated,
  requirePermission('EVENT_REQUESTS_VIEW'),
  async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: 'Invalid event request ID' });
      }
      const eventRequest = await storage.getEventRequest(id);

      if (!eventRequest) {
        return res.status(404).json({ message: 'Event request not found' });
      }

      await logActivity(
        req,
        res,
        'EVENT_REQUESTS_VIEW',
        `Retrieved event request: ${id}`
      );
      res.json(eventRequest);
    } catch (error) {
      logger.error('Failed to fetch event request', error);
      res.status(500).json({ message: 'Failed to fetch event request' });
    }
  }
);

// Create new event request
router.post(
  '/',
  isAuthenticated,
  requirePermission('EVENT_REQUESTS_ADD'),
  async (req, res) => {
    try {
      const user = req.user;

      // Generate externalId for manual entries if not provided
      let requestData = { ...req.body };
      if (!requestData.externalId) {
        const timestamp = new Date().toISOString().replace(/[^0-9]/g, '').slice(0, 14);
        const randomSuffix = Math.random().toString(36).substring(2, 8);
        requestData.externalId = `manual-${timestamp}-${randomSuffix}`;
      }

      let validatedData;
      try {
        validatedData = insertEventRequestSchema.parse(requestData);
      } catch (validationError: unknown) {
        const errorDetails = validationError instanceof z.ZodError
          ? validationError.errors
          : (validationError as Error).message;
        return res.status(400).json({
          error: 'Validation failed',
          details: errorDetails,
          message: 'Please check your input and try again. Make sure you provide at least an organization name or contact information.'
        });
      }

      // Check for organization duplicates
      const duplicateCheck = { exists: false, matches: [] as Array<{ name: string }> };

      const newEventRequest = await storage.createEventRequest({
        ...validatedData,
        organizationExists: duplicateCheck.exists,
        duplicateNotes: duplicateCheck.exists
          ? `Potential matches found: ${duplicateCheck.matches
              .map((m) => m.name)
              .join(', ')}`
          : null,
        duplicateCheckDate: new Date(),
        createdBy: user?.id || 1,
      });

      // Enhanced audit logging for create operation
      await AuditLogger.logEventRequestChange(
        newEventRequest.id?.toString() || 'unknown',
        null,
        newEventRequest,
        {
          userId: req.user?.id,
          ipAddress: req.ip || req.connection?.remoteAddress,
          userAgent: req.get('User-Agent'),
          sessionId: req.session?.id || req.sessionID,
        },
        { actionType: 'CREATE' }
      );

      await logActivity(
        req,
        res,
        'EVENT_REQUESTS_ADD',
        `Created event request: ${newEventRequest.id} for ${validatedData.organizationName}`
      );
      res.status(201).json(newEventRequest);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res
          .status(400)
          .json({ message: 'Invalid input', errors: error.errors });
      }
      logger.error('Failed to create event request', error);
      res.status(500).json({ message: 'Failed to create event request' });
    }
  }
);

// Complete primary contact - comprehensive data collection
router.patch(
  '/:id/details',
  isAuthenticated,
  requirePermission('EVENT_REQUESTS_EDIT'),
  async (req, res) => {
    try {
      const id = parseInt(req.params.id);

      const completionDataSchema = z.object({
        communicationMethod: z.string().min(1, 'Communication method required'),
        eventAddress: z.string().optional(),
        estimatedSandwichCount: z.number().min(1).optional(),
        hasRefrigeration: z.boolean().optional(),
        notes: z.string().optional(),
      });

      const validatedData = completionDataSchema.parse(req.body);

      // Get original data for audit logging
      const originalEvent = await storage.getEventRequestById(id);
      if (!originalEvent) {
        return res.status(404).json({ message: 'Event request not found' });
      }

      const updatedEventRequest = await storage.updateEventRequest(id, {
        contactedAt: new Date(),
        completedByUserId: req.user?.id,
        communicationMethod: validatedData.communicationMethod,
        eventAddress: validatedData.eventAddress,
        estimatedSandwichCount: validatedData.estimatedSandwichCount,
        hasRefrigeration: validatedData.hasRefrigeration,
        contactCompletionNotes: validatedData.notes,
        status: 'contact_completed',
      });

      // REMOVED: No longer updating Google Sheets - one-way sync only

      if (!updatedEventRequest) {
        return res.status(404).json({ message: 'Event request not found' });
      }

      // Enhanced audit logging for contact completion
      await AuditLogger.logEventRequestChange(
        id.toString(),
        originalEvent,
        updatedEventRequest,
        {
          userId: req.user?.id,
          ipAddress: req.ip || req.connection?.remoteAddress,
          userAgent: req.get('User-Agent'),
          sessionId: req.session?.id || req.sessionID,
        }
      );

      await logActivity(
        req,
        res,
        'EVENT_REQUESTS_COMPLETE_CONTACT',
        `Completed contact for event request: ${id}`
      );
      res.json(updatedEventRequest);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res
          .status(400)
          .json({ message: 'Invalid completion data', errors: error.errors });
      }
      logger.error('Error completing contact:', error);
      res.status(500).json({ message: 'Failed to complete contact' });
    }
  }
);

// Complete contact with comprehensive event details - single step workflow
router.post(
  '/complete-contact',
  isAuthenticated,
  requirePermission('EVENT_REQUESTS_EDIT'),
  async (req, res) => {
    try {
      const { id, ...updates } = req.body;


      const updatedEventRequest = await storage.updateEventRequest(id, {
        ...updates,
        contactedAt: new Date(),
        completedByUserId: req.user?.id,
        contactCompletedAt: new Date(),
        updatedAt: new Date(),
      });

      if (!updatedEventRequest) {
        return res.status(404).json({ message: 'Event request not found' });
      }

      // Update Google Sheets with the new status if status was provided
      if (updates.status) {
        try {
          const googleSheetsService =
            getEventRequestsGoogleSheetsService(storage as any);
          if (googleSheetsService) {
            const contactName =
              `${updatedEventRequest.firstName} ${updatedEventRequest.lastName}`.trim();
            await googleSheetsService.updateEventRequestStatus(
              updatedEventRequest.organizationName,
              contactName,
              updates.status
            );
          }
        } catch (error) {
        }
      }

      await logActivity(
        req,
        res,
        'EVENT_REQUESTS_COMPLETE_CONTACT',
        `Completed contact with comprehensive details for event request: ${id}`
      );
      res.json(updatedEventRequest);
    } catch (error) {
      logger.error('Error completing contact:', error);
      res.status(500).json({ message: 'Failed to complete contact' });
    }
  }
);

// Complete event details - specific endpoint for comprehensive event planning updates
router.post(
  '/complete-event-details',
  isAuthenticated,
  requirePermission('EVENT_REQUESTS_EDIT'),
  async (req, res) => {
    try {
      // Skip validation entirely and just process the raw data
      const { id, ...updates } = req.body;


      // Handle date conversion properly on server side
      if (
        updates.desiredEventDate &&
        typeof updates.desiredEventDate === 'string'
      ) {
        // Convert string date to proper Date object
        updates.desiredEventDate = new Date(
          updates.desiredEventDate + 'T12:00:00.000Z'
        );
      }

      // CRITICAL FIX: Explicitly set status to 'scheduled' when completing event details
      updates.status = 'scheduled';
      updates.scheduledAt = new Date(); // Add audit trail timestamp

      const updatedEventRequest = await storage.updateEventRequest(id, {
        ...updates,
        updatedAt: new Date(),
      });

      if (!updatedEventRequest) {
        return res.status(404).json({ message: 'Event request not found' });
      }

      await logActivity(
        req,
        res,
        'EVENT_REQUESTS_EDIT',
        `Completed event details for: ${id}`
      );
      res.json(updatedEventRequest);
    } catch (error) {
      if (error instanceof z.ZodError) {
        logger.error('Validation error:', error.errors);
        return res.status(400).json({
          message: 'Invalid event details data',
          errors: error.errors,
        });
      }
      logger.error('Error completing event details:', error);
      res.status(500).json({ message: 'Failed to complete event details' });
    }
  }
);

// Record follow-up action (email sent or callback completed)
router.post(
  '/follow-up',
  isAuthenticated,
  requirePermission('EVENT_REQUESTS_EDIT'),
  async (req, res) => {
    try {
      const { id, method, updatedEmail, notes } = req.body;


      // Get original data for audit logging
      const originalEvent = await storage.getEventRequestById(id);
      if (!originalEvent) {
        return res.status(404).json({ message: 'Event request not found' });
      }

      const updates: Partial<EventRequest> = {
        followUpMethod: method,
        followUpDate: new Date(),
        updatedAt: new Date(),
      };

      // Both email and call follow-ups should move event to in_process
      updates.status = 'in_process';

      // Explicitly preserve critical fields that must not be lost during status transitions
      if (originalEvent.desiredEventDate) {
        updates.desiredEventDate = originalEvent.desiredEventDate;
      }

      if (method === 'call' && updatedEmail) {
        // Update the main email field if a corrected email is provided during call follow-up
        updates.email = updatedEmail;
        updates.updatedEmail = updatedEmail; // Keep for audit trail
      }

      // Add notes to existing followUpNotes if provided
      if (notes) {
        const existingNotes = originalEvent?.followUpNotes || '';
        updates.followUpNotes = existingNotes
          ? `${existingNotes}\n\n${notes}`
          : notes;
      }

      const updatedEventRequest = await storage.updateEventRequest(id, updates);

      if (!updatedEventRequest) {
        return res.status(404).json({ message: 'Event request not found' });
      }

      // Enhanced audit logging with detailed field changes AND follow-up context
      await AuditLogger.logEventRequestChange(
        id.toString(),
        originalEvent,
        updatedEventRequest,
        {
          userId: req.user?.id,
          ipAddress: req.ip || req.connection?.remoteAddress,
          userAgent: req.get('User-Agent'),
          sessionId: req.session?.id || req.sessionID,
        },
        {
          followUpMethod: method,
          followUpAction: method === 'call' ? 'phone_call_completed' : 'email_sent',
          notes: notes || `Follow-up ${method} completed`,
          actionType: 'FOLLOW_UP_COMPLETED',
          updatedEmail: method === 'call' ? updatedEmail : undefined,
        }
      );

      await logActivity(
        req,
        res,
        'EVENT_REQUESTS_FOLLOW_UP',
        `Recorded follow-up (${method}) for event request: ${id}`
      );
      res.json(updatedEventRequest);
    } catch (error) {
      logger.error('Error recording follow-up:', error);
      res.status(500).json({ message: 'Failed to record follow-up' });
    }
  }
);

// Update event request details - specific endpoint for event details updates
router.patch(
  '/:id/event-details',
  isAuthenticated,
  requirePermission('EVENT_REQUESTS_EDIT'),
  async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const updates = req.body;

      // Get original data for audit logging
      const originalEvent = await storage.getEventRequestById(id);
      if (!originalEvent) {
        return res.status(404).json({ message: 'Event request not found' });
      }

      // Process pickup time fields for data migration
      const processedUpdates = processPickupTimeFields(updates, originalEvent);

      // Automatically assign the current user as TSP contact if toolkit is being marked as sent
      // This auto-assignment happens silently (no email) since toolkit sending happens later in workflow
      if ((processedUpdates.toolkitSent === true || processedUpdates.toolkitStatus === 'sent') &&
          !originalEvent.tspContact &&
          req.user?.id) {
        processedUpdates.tspContact = req.user.id;
        processedUpdates.tspContactAssignedDate = new Date();
      }

      // Always update the updatedAt timestamp
      const updatedEventRequest = await storage.updateEventRequest(id, {
        ...processedUpdates,
        updatedAt: new Date(),
      });

      if (!updatedEventRequest) {
        return res.status(404).json({ message: 'Event request not found' });
      }

      // REMOVED: No longer updating Google Sheets - one-way sync only

      // Enhanced audit logging for event details update
      await AuditLogger.logEventRequestChange(
        id.toString(),
        originalEvent,
        updatedEventRequest,
        {
          userId: req.user?.id,
          ipAddress: req.ip || req.connection?.remoteAddress,
          userAgent: req.get('User-Agent'),
          sessionId: req.session?.id || req.sessionID,
        }
      );

      // Create meaningful activity log with event details and what changed
      const organizationName = updatedEventRequest.organizationName || `Event #${id}`;
      const contactName = updatedEventRequest.firstName && updatedEventRequest.lastName 
        ? `${updatedEventRequest.firstName} ${updatedEventRequest.lastName}` 
        : 'contact';
      
      // Prepare audit details for activity logging
      const auditDetails: Record<string, { from: unknown; to: unknown }> = {};
      const changeDescriptions: string[] = [];

      for (const [key, newValue] of Object.entries(updates)) {
        if (key !== 'updatedAt') {
          // Skip timestamp field
          const oldValue = originalEvent[key as keyof EventRequest];
          if (oldValue !== newValue && newValue !== undefined) {
            auditDetails[key] = {
              from: oldValue,
              to: newValue,
            };
            
            // Create human-readable descriptions for key fields
            if (key === 'status') {
              changeDescriptions.push(`status: ${oldValue} → ${newValue}`);
            } else if (key === 'scheduledEventDate' || key === 'desiredEventDate') {
              const dateStr = newValue ? new Date(newValue).toLocaleDateString('en-US') : 'none';
              changeDescriptions.push(`event date: ${dateStr}`);
            } else if (key === 'estimatedSandwichCount') {
              changeDescriptions.push(`estimated sandwiches: ${newValue}`);
            } else if (key === 'pickupTime') {
              changeDescriptions.push(`pickup time: ${newValue}`);
            } else if (key === 'eventAddress') {
              changeDescriptions.push(`address updated`);
            } else {
              changeDescriptions.push(key.replace(/([A-Z])/g, ' $1').toLowerCase());
            }
          }
        }
      }

      const changesSummary = changeDescriptions.length > 0 
        ? changeDescriptions.slice(0, 3).join(', ') + (changeDescriptions.length > 3 ? '...' : '')
        : 'details updated';

      await logActivity(
        req,
        res,
        'EVENT_REQUESTS_EDIT',
        `Updated ${organizationName} (${contactName}): ${changesSummary}`,
        { auditDetails: auditDetails }
      );
      res.json(updatedEventRequest);
    } catch (error) {
      logger.error('Error updating event request details:', error);
      res
        .status(500)
        .json({ message: 'Failed to update event request details' });
    }
  }
);

// Update event request (PATCH) - handles basic updates like toolkit sent
router.patch(
  '/:id',
  isAuthenticated,
  requirePermission('EVENT_REQUESTS_EDIT'),
  async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const updates = req.body;


      // Validate scheduledCallDate if present using z.coerce.date()
      if (updates.scheduledCallDate !== undefined) {
        const scheduleCallSchema = z.object({
          scheduledCallDate: z
            .union([z.coerce.date(), z.literal('').transform(() => null)])
            .nullable(),
        });

        try {
          const validated = scheduleCallSchema.parse({
            scheduledCallDate: updates.scheduledCallDate,
          });
          updates.scheduledCallDate = validated.scheduledCallDate;
        } catch (error) {
          logger.error('❌ Invalid scheduledCallDate:', error);
          return res.status(400).json({
            message: 'Invalid scheduledCallDate format',
            error: error instanceof z.ZodError ? error.errors : error instanceof Error ? error.message : String(error),
          });
        }
      }

      // Get original data for audit logging
      const originalEvent = await storage.getEventRequestById(id);
      if (!originalEvent) {
        return res.status(404).json({ message: 'Event request not found' });
      }

      // Process pickup time fields for data migration
      const pickupProcessedUpdates = processPickupTimeFields(updates, originalEvent);

      // Process timestamp fields to ensure they're proper Date objects
      const processedUpdates = { ...pickupProcessedUpdates };

      // Convert timestamp fields that might come as strings to Date objects
      const timestampFields = [
        'toolkitSentDate',
        'contactedAt',
        'desiredEventDate',
        'duplicateCheckDate',
        'markedUnresponsiveAt',
        'lastContactAttempt',
        'nextFollowUpDate',
        'contactCompletedAt',
        'callScheduledAt',
        'callCompletedAt',
        'scheduledCallDate',
        'tspContactAssignedDate',
        'statusChangedAt',
        'pickupDateTime',
        'scheduledEventDate',
        'socialMediaPostRequestedDate',
        'socialMediaPostCompletedDate',
      ];
      
      timestampFields.forEach((field) => {
        if (
          processedUpdates[field] &&
          typeof processedUpdates[field] === 'string'
        ) {
          try {
            const dateString = processedUpdates[field] as string;
            // Handle YYYY-MM-DD format from HTML5 date inputs by adding time component
            let dateValue: Date;
            if (/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
              // Date only format (YYYY-MM-DD) - add noon UTC to avoid timezone issues
              dateValue = new Date(dateString + 'T12:00:00.000Z');
            } else {
              dateValue = new Date(dateString);
            }

            // Check if the date is valid
            if (isNaN(dateValue.getTime())) {
              logger.error(`[PATCH] Invalid date value for field ${field}:`, dateString);
              delete processedUpdates[field]; // Remove invalid date fields
            } else {
              processedUpdates[field] = dateValue;
              logger.info(`[PATCH] Converted ${field} from "${dateString}" to ${dateValue.toISOString()}`);
            }
          } catch (error) {
            logger.error(`[PATCH] Error parsing date for field ${field}:`, error);
            delete processedUpdates[field]; // Remove invalid date fields
          }
        } else if (processedUpdates[field] === null || processedUpdates[field] === '') {
          // Allow null or empty string to clear date fields
          processedUpdates[field] = null;
        }
      });

      // Check if status is changing and set statusChangedAt accordingly
      if (
        processedUpdates.status &&
        processedUpdates.status !== originalEvent.status
      ) {
        processedUpdates.statusChangedAt = new Date();

        // If status is changing to 'completed', auto-confirm the event
        if (processedUpdates.status === 'completed') {
          processedUpdates.isConfirmed = true;
        }
      }

      // Automatically set isConfirmed = true when scheduledEventDate is set
      if (processedUpdates.scheduledEventDate && !originalEvent.scheduledEventDate) {
        processedUpdates.isConfirmed = true;
      }

      // Allow manual override: if isConfirmed is explicitly provided, respect it
      // Exception: completed events are always confirmed
      if (processedUpdates.status === 'completed' || originalEvent.status === 'completed') {
        processedUpdates.isConfirmed = true;
      }

      // Automatically assign the current user as TSP contact if toolkit is being marked as sent
      // This auto-assignment happens silently (no email) since toolkit sending happens later in workflow
      if ((processedUpdates.toolkitSent === true || processedUpdates.toolkitStatus === 'sent') &&
          !originalEvent.tspContact &&
          req.user?.id) {
        processedUpdates.tspContact = req.user.id;
        processedUpdates.tspContactAssignedDate = new Date();
      }

      // Validate and auto-adjust "needed" fields to prevent impossible states
      // Count currently assigned drivers (regular + van)
      const assignedRegularDrivers = processedUpdates.assignedDriverIds !== undefined
        ? (Array.isArray(processedUpdates.assignedDriverIds) ? processedUpdates.assignedDriverIds.length : 0)
        : (Array.isArray(originalEvent.assignedDriverIds) ? originalEvent.assignedDriverIds.length : 0);
      
      const hasAssignedVanDriver = (processedUpdates.assignedVanDriverId !== undefined && processedUpdates.assignedVanDriverId !== null && processedUpdates.assignedVanDriverId !== '')
        || (processedUpdates.assignedVanDriverId === undefined && originalEvent.assignedVanDriverId !== null && originalEvent.assignedVanDriverId !== '');
      
      const totalAssignedDrivers = assignedRegularDrivers + (hasAssignedVanDriver ? 1 : 0);
      
      // If driversNeeded is being manually updated, ensure it's not less than assigned drivers
      if (processedUpdates.driversNeeded !== undefined) {
        if (processedUpdates.driversNeeded < totalAssignedDrivers) {
          processedUpdates.driversNeeded = totalAssignedDrivers;
        }
      }
      
      // Auto-adjust driversNeeded when assignments change (if assignments exceed current need)
      if (processedUpdates.assignedDriverIds !== undefined || processedUpdates.assignedVanDriverId !== undefined) {
        const currentDriversNeeded = processedUpdates.driversNeeded !== undefined ? processedUpdates.driversNeeded : (originalEvent.driversNeeded || 0);
        
        if (totalAssignedDrivers > currentDriversNeeded) {
          processedUpdates.driversNeeded = totalAssignedDrivers;
        }
      }

      if (processedUpdates.speakerDetails !== undefined) {
        const assignedSpeakerCount = (typeof processedUpdates.speakerDetails === 'object' && processedUpdates.speakerDetails !== null)
          ? Object.keys(processedUpdates.speakerDetails).length 
          : 0;
        const currentSpeakersNeeded = originalEvent.speakersNeeded || 0;
        
        if (assignedSpeakerCount > currentSpeakersNeeded) {
          processedUpdates.speakersNeeded = assignedSpeakerCount;
        }
      }

      if (processedUpdates.assignedVolunteerIds !== undefined) {
        const assignedVolunteerCount = Array.isArray(processedUpdates.assignedVolunteerIds) 
          ? processedUpdates.assignedVolunteerIds.length 
          : 0;
        const currentVolunteersNeeded = originalEvent.volunteersNeeded || 0;
        
        if (assignedVolunteerCount > currentVolunteersNeeded) {
          processedUpdates.volunteersNeeded = assignedVolunteerCount;
        }
      }

      // Always update the updatedAt timestamp
      const updatedEventRequest = await storage.updateEventRequest(id, {
        ...processedUpdates,
        updatedAt: new Date(),
      });

      if (!updatedEventRequest) {
        return res.status(404).json({ message: 'Event request not found' });
      }

      // REMOVED: No longer updating Google Sheets - one-way sync only

      // Enhanced audit logging with detailed field changes
      await AuditLogger.logEventRequestChange(
        id.toString(),
        originalEvent,
        updatedEventRequest,
        {
          userId: req.user?.id,
          ipAddress: req.ip || req.connection?.remoteAddress,
          userAgent: req.get('User-Agent'),
          sessionId: req.session?.id || req.sessionID,
        }
      );

      // Create meaningful activity log with event details and what changed
      const organizationName = updatedEventRequest.organizationName || `Event #${id}`;
      const contactName = updatedEventRequest.firstName && updatedEventRequest.lastName 
        ? `${updatedEventRequest.firstName} ${updatedEventRequest.lastName}` 
        : 'contact';
      
      // Build human-readable change summary
      const changedFields = Object.keys(processedUpdates).filter(key => 
        key !== 'updatedAt' && processedUpdates[key] !== undefined
      );
      
      const changeDescriptions: string[] = [];
      changedFields.forEach(field => {
        const oldValue = (originalEvent as any)[field];
        const newValue = processedUpdates[field];
        
        // Skip if values are the same
        if (oldValue === newValue) return;
        
        // Create human-readable descriptions for key fields
        if (field === 'status') {
          changeDescriptions.push(`status: ${oldValue} → ${newValue}`);
        } else if (field === 'scheduledEventDate' || field === 'desiredEventDate') {
          const dateStr = newValue ? new Date(newValue).toLocaleDateString('en-US') : 'none';
          changeDescriptions.push(`event date: ${dateStr}`);
        } else if (field === 'estimatedSandwichCount') {
          changeDescriptions.push(`estimated sandwiches: ${newValue}`);
        } else if (field === 'assignedDriverIds' && Array.isArray(newValue)) {
          changeDescriptions.push(`drivers assigned: ${newValue.length}`);
        } else if (field === 'recipientIds' && Array.isArray(newValue)) {
          changeDescriptions.push(`destinations: ${newValue.length}`);
        } else if (field === 'toolkitSent' || field === 'toolkitStatus') {
          changeDescriptions.push('toolkit sent');
        } else {
          // For other fields, just include the field name
          changeDescriptions.push(field.replace(/([A-Z])/g, ' $1').toLowerCase());
        }
      });
      
      const changesSummary = changeDescriptions.length > 0 
        ? changeDescriptions.slice(0, 3).join(', ') + (changeDescriptions.length > 3 ? '...' : '')
        : 'details updated';
      
      await logActivity(
        req,
        res,
        'EVENT_REQUESTS_EDIT',
        `Updated ${organizationName} (${contactName}): ${changesSummary}`
      );

      res.json(updatedEventRequest);
    } catch (error: unknown) {
      const err = error as Error;
      logger.error('Error updating event request:', error);
      logger.error('Error stack:', err?.stack);

      // Check for specific database errors
      if (err?.message?.includes('invalid input syntax')) {
        return res.status(400).json({
          message: 'Invalid data format',
          error: err.message,
          details: 'Please check that all fields contain valid data'
        });
      }

      res.status(500).json({
        message: 'Failed to update event request',
        error: err?.message || 'Unknown error',
        details: process.env.NODE_ENV === 'development' ? err?.stack : undefined
      });
    }
  }
);

// Update event request (PUT)
router.put(
  '/:id',
  isAuthenticated,
  requirePermission('EVENT_REQUESTS_EDIT'),
  async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const updates = req.body;


      // Get original data for audit logging
      const originalEvent = await storage.getEventRequestById(id);
      if (!originalEvent) {
        return res.status(404).json({ message: 'Event request not found' });
      }

      // Process pickup time fields for data migration
      const pickupProcessedUpdates = processPickupTimeFields(updates, originalEvent);

      // Process ALL date/timestamp fields to ensure they're proper Date objects
      const processedUpdates = { ...pickupProcessedUpdates };

      // Convert timestamp fields that might come as strings to Date objects
      const timestampFields = [
        'toolkitSentDate',
        'contactedAt',
        'desiredEventDate',
        'duplicateCheckDate',
        'markedUnresponsiveAt',
        'lastContactAttempt',
        'nextFollowUpDate',
        'contactCompletedAt',
        'callScheduledAt',
        'callCompletedAt',
        'scheduledCallDate',
        'tspContactAssignedDate',
        'statusChangedAt',
        'pickupDateTime',
        'scheduledEventDate',
      ];
      
      timestampFields.forEach((field) => {
        if (
          processedUpdates[field] &&
          typeof processedUpdates[field] === 'string'
        ) {
          try {
            const dateString = processedUpdates[field] as string;
            // Handle YYYY-MM-DD format from HTML5 date inputs by adding time component
            let dateValue: Date;
            if (/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
              // Date only format (YYYY-MM-DD) - add noon UTC to avoid timezone issues
              dateValue = new Date(dateString + 'T12:00:00.000Z');
            } else {
              dateValue = new Date(dateString);
            }

            // Check if the date is valid
            if (isNaN(dateValue.getTime())) {
              logger.error(`Invalid date value for field ${field}:`, dateString);
              delete processedUpdates[field]; // Remove invalid date fields
            } else {
              processedUpdates[field] = dateValue;
              logger.info(`Converted ${field} from "${dateString}" to ${dateValue.toISOString()}`);
            }
          } catch (error) {
            logger.error(`Error parsing date for field ${field}:`, error);
            delete processedUpdates[field]; // Remove invalid fields
          }
        } else if (processedUpdates[field] === null || processedUpdates[field] === '') {
          // Allow null or empty string to clear date fields
          processedUpdates[field] = null;
        }
      });

      timestampFields.forEach(field => {
        if (processedUpdates[field] !== undefined) {
        }
      });

      // Clean up phone field if it contains invalid data
      if (processedUpdates.phone) {
        const phoneStr = String(processedUpdates.phone).trim();

        // Check if phone field contains an Excel serial number (5-6 digits)
        if (/^\d{5,6}$/.test(phoneStr)) {
          processedUpdates.phone = ''; // Clear invalid phone number
        } else if (phoneStr.length > 30) {
          // If phone field is too long, it might contain message text
          processedUpdates.phone = '';
        } else {
          // Clean the phone number - keep only digits and common separators
          processedUpdates.phone = phoneStr.replace(/[^\d\s\-\(\)\+\.]/g, '').trim();
        }
      }

      // Validate message field doesn't contain a phone number
      if (processedUpdates.message) {
        const messageStr = String(processedUpdates.message).trim();

        // Check if message looks like a phone number
        if (/^[\d\s\-\(\)\+\.]{7,20}$/.test(messageStr)) {
          // You might want to swap with phone field if phone is empty
          if (!processedUpdates.phone || processedUpdates.phone === '') {
            processedUpdates.phone = messageStr;
            processedUpdates.message = '';
          }
        }
      }

      // Validate that in_process status is not set for past/current date events
      if (processedUpdates.status === 'in_process') {
        let eventDate = processedUpdates.desiredEventDate;

        // If date wasn't updated, check the existing event's date
        if (!eventDate && originalEvent.desiredEventDate) {
          eventDate = new Date(originalEvent.desiredEventDate);
        }

        if (eventDate) {
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          eventDate.setHours(0, 0, 0, 0);

          if (eventDate <= today) {
            return res.status(400).json({
              message:
                'Cannot set in_process status for events with past or current dates',
              error: 'Invalid status for event date',
            });
          }
        }
      }

      // Validate scheduled status transition and required fields
      // Only enforce strict validation when TRANSITIONING TO scheduled status (not when editing existing scheduled events)
      if (
        processedUpdates.status === 'scheduled' &&
        originalEvent.status !== 'scheduled'
      ) {
        // Check required fields for NEW scheduled events
        const requiredFields = {
          desiredEventDate:
            processedUpdates.desiredEventDate || originalEvent.desiredEventDate,
          eventAddress:
            processedUpdates.eventAddress || originalEvent.eventAddress,
          estimatedSandwichCount:
            processedUpdates.estimatedSandwichCount ||
            originalEvent.estimatedSandwichCount,
        };

        const missingFields = [];
        if (!requiredFields.desiredEventDate) missingFields.push('Event Date');
        // Make Event Address and Estimated Sandwich Count optional for basic scheduled status
        // They can be filled in later during the workflow

        if (missingFields.length > 0) {
          return res.status(400).json({
            message: `Cannot mark event as scheduled. Missing required fields: ${missingFields.join(
              ', '
            )}`,
            error: 'Missing required scheduling data',
            missingFields,
          });
        }
      } else if (processedUpdates.status === 'scheduled') {
      }

      // Ensure boolean fields are properly typed (for ALL updates)
      const booleanFields = [
        'hasRefrigeration',
        'volunteersNeeded',
        'vanDriverNeeded',
        'isConfirmed',
        'addedToOfficialSheet',
      ];
      booleanFields.forEach((field) => {
        if (processedUpdates[field] !== undefined) {
          const originalValue = processedUpdates[field];
          const convertedValue =
            processedUpdates[field] === true ||
            processedUpdates[field] === 'true';
          processedUpdates[field] = convertedValue;
          logger.info(`[PUT] Boolean field ${field}: ${JSON.stringify(originalValue)} (${typeof originalValue}) → ${convertedValue}`);
        }
      });

      // Process comprehensive scheduling data if status is scheduled
      if (processedUpdates.status === 'scheduled') {

        // Process sandwich types if provided
        if (processedUpdates.sandwichTypes) {
          try {
            if (typeof processedUpdates.sandwichTypes === 'string') {
              processedUpdates.sandwichTypes = JSON.parse(
                processedUpdates.sandwichTypes
              );
            }
          } catch (error) {
          }
        }

        // Log sandwich count for debugging

        // Ensure numeric fields are properly typed
        const numericFields = [
          'driversNeeded',
          'speakersNeeded',
          'estimatedSandwichCount',
          'estimatedSandwichCountMin',
          'estimatedSandwichCountMax',
        ];
        numericFields.forEach((field) => {
          if (processedUpdates[field] !== undefined && processedUpdates[field] !== null) {
            processedUpdates[field] = parseInt(processedUpdates[field]) || 0;
          }
        });

      }

      // Check if status is changing and set statusChangedAt accordingly
      if (
        processedUpdates.status &&
        processedUpdates.status !== originalEvent.status
      ) {
        processedUpdates.statusChangedAt = new Date();
      }

      // Validate and auto-adjust "needed" fields to prevent impossible states (PUT endpoint)
      // Count currently assigned drivers (regular + van)
      const putAssignedRegularDrivers = processedUpdates.assignedDriverIds !== undefined
        ? (Array.isArray(processedUpdates.assignedDriverIds) ? processedUpdates.assignedDriverIds.length : 0)
        : (Array.isArray(originalEvent.assignedDriverIds) ? originalEvent.assignedDriverIds.length : 0);
      
      const putHasAssignedVanDriver = (processedUpdates.assignedVanDriverId !== undefined && processedUpdates.assignedVanDriverId !== null && processedUpdates.assignedVanDriverId !== '')
        || (processedUpdates.assignedVanDriverId === undefined && originalEvent.assignedVanDriverId !== null && originalEvent.assignedVanDriverId !== '');
      
      const putTotalAssignedDrivers = putAssignedRegularDrivers + (putHasAssignedVanDriver ? 1 : 0);
      
      // If driversNeeded is being manually updated, ensure it's not less than assigned drivers
      if (processedUpdates.driversNeeded !== undefined) {
        if (processedUpdates.driversNeeded < putTotalAssignedDrivers) {
          processedUpdates.driversNeeded = putTotalAssignedDrivers;
        }
      }
      
      // Auto-adjust driversNeeded when assignments change (if assignments exceed current need)
      if (processedUpdates.assignedDriverIds !== undefined || processedUpdates.assignedVanDriverId !== undefined) {
        const currentDriversNeeded = processedUpdates.driversNeeded !== undefined ? processedUpdates.driversNeeded : (originalEvent.driversNeeded || 0);
        
        if (putTotalAssignedDrivers > currentDriversNeeded) {
          processedUpdates.driversNeeded = putTotalAssignedDrivers;
        }
      }

      if (processedUpdates.speakerDetails !== undefined) {
        const assignedSpeakerCount = (typeof processedUpdates.speakerDetails === 'object' && processedUpdates.speakerDetails !== null)
          ? Object.keys(processedUpdates.speakerDetails).length 
          : 0;
        const currentSpeakersNeeded = originalEvent.speakersNeeded || 0;
        
        if (assignedSpeakerCount > currentSpeakersNeeded) {
          processedUpdates.speakersNeeded = assignedSpeakerCount;
        }
      }

      if (processedUpdates.assignedVolunteerIds !== undefined) {
        const assignedVolunteerCount = Array.isArray(processedUpdates.assignedVolunteerIds) 
          ? processedUpdates.assignedVolunteerIds.length 
          : 0;
        const currentVolunteersNeeded = originalEvent.volunteersNeeded || 0;
        
        if (assignedVolunteerCount > currentVolunteersNeeded) {
          processedUpdates.volunteersNeeded = assignedVolunteerCount;
        }
      }

      // Always update the updatedAt timestamp
      const updatedEventRequest = await storage.updateEventRequest(id, {
        ...processedUpdates,
        updatedAt: new Date(),
      });

      if (!updatedEventRequest) {
        return res.status(404).json({ message: 'Event request not found' });
      }

      // Determine action type based on changes
      let actionType = 'EVENT_REQUEST_UPDATED';
      let actionContext: Record<string, unknown> = {
        organizationName: originalEvent.organizationName,
        contactName: `${originalEvent.firstName} ${originalEvent.lastName}`,
        fieldsUpdated: Object.keys(processedUpdates),
      };

      // Check for specific status changes with enhanced context
      if (originalEvent.status !== updatedEventRequest.status) {
        actionType = 'STATUS_CHANGED';
        actionContext.statusChange = `${originalEvent.status} → ${updatedEventRequest.status}`;

        // Add comprehensive context for scheduled status
        if (updatedEventRequest.status === 'scheduled') {
          actionType = 'EVENT_SCHEDULED';
          actionContext = {
            ...actionContext,
            eventDate: updatedEventRequest.desiredEventDate,
            eventAddress: updatedEventRequest.eventAddress,
            estimatedSandwichCount: updatedEventRequest.estimatedSandwichCount,
            eventStartTime: updatedEventRequest.eventStartTime,
            eventEndTime: updatedEventRequest.eventEndTime,
            pickupTime: updatedEventRequest.pickupTime,
            driversNeeded: updatedEventRequest.driversNeeded || 0,
            speakersNeeded: updatedEventRequest.speakersNeeded || 0,
            volunteersNeeded: updatedEventRequest.volunteersNeeded || false,
            hasRefrigeration: updatedEventRequest.hasRefrigeration,
            deliveryDestination: updatedEventRequest.deliveryDestination,
            tspContact: updatedEventRequest.tspContact,
            additionalTspContacts: updatedEventRequest.additionalTspContacts,
            sandwichTypes: updatedEventRequest.sandwichTypes,
            toolkitStatus: updatedEventRequest.toolkitStatus,
            communicationMethod: updatedEventRequest.communicationMethod,
            scheduledBy:
              req.user?.email || 'Unknown User',
            scheduledAt: new Date().toISOString(),
            comprehensiveDataProcessed: true,
          };
        }
      }

      // Check for unresponsive marking
      if (updates.isUnresponsive && !originalEvent.isUnresponsive) {
        actionType = 'MARKED_UNRESPONSIVE';
        actionContext.unresponsiveReason = updates.unresponsiveReason;
        actionContext.contactMethod = updates.contactMethod;
      }

      // Enhanced audit logging with detailed field changes
      await AuditLogger.logEventRequestChange(
        id.toString(),
        originalEvent,
        updatedEventRequest,
        {
          userId: req.user?.id,
          ipAddress: req.ip || req.connection?.remoteAddress,
          userAgent: req.get('User-Agent'),
          sessionId: req.session?.id || req.sessionID,
        }
      );

      await logActivity(
        req,
        res,
        'EVENT_REQUESTS_EDIT',
        `Updated event request: ${id}`
      );
      res.json(updatedEventRequest);
    } catch (error) {
      logger.error('Error updating event request', error);
      res.status(500).json({
        message: 'Failed to update event request',
        error: error instanceof Error ? error.message : String(error),
        details: 'Check server logs for full error details',
      });
    }
  }
);

// Delete event request
router.delete(
  '/:id',
  isAuthenticated,
  requirePermission('EVENT_REQUESTS_DELETE_CARD'),
  async (req, res) => {
    try {
      const id = parseInt(req.params.id);

      // Get original data for audit logging before deletion
      const originalEvent = await storage.getEventRequestById(id);
      if (!originalEvent) {
        return res.status(404).json({ message: 'Event request not found' });
      }

      const deleted = await storage.deleteEventRequest(id);

      if (!deleted) {
        return res.status(404).json({ message: 'Event request not found' });
      }

      // Enhanced audit logging for deletion
      await AuditLogger.logEventRequestChange(
        id.toString(),
        originalEvent,
        null,
        {
          userId: req.user?.id,
          ipAddress: req.ip || req.connection?.remoteAddress,
          userAgent: req.get('User-Agent'),
          sessionId: req.session?.id || req.sessionID,
        },
        { actionType: 'DELETE' }
      );

      await logActivity(
        req,
        res,
        'EVENT_REQUESTS_DELETE_CARD',
        `Deleted event request: ${id}`
      );
      res.json({ message: 'Event request deleted successfully' });
    } catch (error) {
      logger.error('Error deleting event request:', error);
      res.status(500).json({ message: 'Failed to delete event request' });
    }
  }
);

// Check organization duplicates
router.post('/check-duplicates', async (req, res) => {
  try {
    const user = req.user;
    if (!user || !hasPermission(user, 'EVENT_REQUESTS_VIEW')) {
      return res.status(403).json({ message: 'Insufficient permissions' });
    }

    const { organizationName } = req.body;
    if (!organizationName) {
      return res.status(400).json({ message: 'Organization name is required' });
    }

    const duplicateCheck = { exists: false, matches: [] };
    await logActivity(
      req,
      res,
      'EVENT_REQUESTS_VIEW',
      `Checked duplicates for organization: ${organizationName}`
    );
    res.json(duplicateCheck);
  } catch (error) {
    logger.error('Error checking organization duplicates:', error);
    res.status(500).json({ message: 'Failed to check duplicates' });
  }
});

// Organization management routes
router.get('/organizations/all', async (req, res) => {
  try {
    const user = req.user;
    if (!user || !hasPermission(user, 'EVENT_REQUESTS_VIEW')) {
      return res.status(403).json({ message: 'Insufficient permissions' });
    }

    const organizations = await storage.getAllOrganizations();
    await logActivity(
      req,
      res,
      'EVENT_REQUESTS_VIEW',
      'Retrieved all organizations'
    );
    res.json(organizations);
  } catch (error) {
    logger.error('Error fetching organizations:', error);
    res.status(500).json({ message: 'Failed to fetch organizations' });
  }
});

router.post('/organizations', async (req, res) => {
  try {
    const user = req.user;
    if (!user || !hasPermission(user, PERMISSIONS.EVENT_REQUESTS_EDIT)) {
      return res.status(403).json({ message: 'Insufficient permissions' });
    }

    const validatedData = insertOrganizationSchema.parse(req.body);
    const newOrganization = await storage.createOrganization(validatedData);

    await logActivity(
      req,
      res,
      PERMISSIONS.EVENT_REQUESTS_EDIT,
      `Created organization: ${newOrganization.name}`
    );
    res.status(201).json(newOrganization);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res
        .status(400)
        .json({ message: 'Invalid input', errors: error.errors });
    }
    logger.error('Error creating organization:', error);
    res.status(500).json({ message: 'Failed to create organization' });
  }
});

// Google Sheets Sync Routes

// DEBUG: Test endpoint to check authentication
router.get('/debug/auth', (req, res) => {
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
router.post(
  '/sync/to-sheets',
  isAuthenticated,
  requirePermission('EVENT_REQUESTS_MANAGE'),
  async (req, res) => {
    try {
      const user = req.user;

      if (!user) {
        return res.status(403).json({ message: 'Authentication required' });
      }

      const syncService = getEventRequestsGoogleSheetsService(storage as any);
      if (!syncService) {
        return res.status(500).json({
          success: false,
          message: 'Google Sheets service not configured',
        });
      }

      const result = await syncService.syncToGoogleSheets();
      await logActivity(
        req,
        res,
        PERMISSIONS.EVENT_REQUESTS_EDIT,
        `Smart-synced ${
          result.synced || 0
        } event requests to Google Sheets (preserving manual columns N+)`
      );

      res.json(result);
    } catch (error) {
      logger.error('Error syncing event requests to Google Sheets:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to sync to Google Sheets',
      });
    }
  }
);

// Sync event requests FROM Google Sheets
router.post(
  '/sync/from-sheets',
  isAuthenticated,
  requirePermission('EVENT_REQUESTS_MANAGE'),
  async (req, res) => {
    try {
      const user = req.user;
      if (!user) {
        return res.status(403).json({ message: 'Authentication required' });
      }

      const syncService = getEventRequestsGoogleSheetsService(storage as any);
      if (!syncService) {
        return res.status(500).json({
          success: false,
          message: 'Google Sheets service not configured',
        });
      }

      const result = await syncService.syncFromGoogleSheets();
      await logActivity(
        req,
        res,
        PERMISSIONS.EVENT_REQUESTS_EDIT,
        `Synced from Google Sheets: ${
          result.created || 0
        } created, ${result.updated || 0} updated`
      );

      res.json(result);
    } catch (error) {
      logger.error('Error syncing event requests from Google Sheets:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to sync from Google Sheets',
      });
    }
  }
);

// Analyze Google Sheets structure
router.get(
  '/sync/analyze',
  isAuthenticated,
  requirePermission('EVENT_REQUESTS_VIEW'),
  async (req, res) => {
    try {
      const user = req.user;
      if (!user) {
        return res.status(403).json({ message: 'Authentication required' });
      }

      const syncService = getEventRequestsGoogleSheetsService(storage as any);
      if (!syncService) {
        return res.status(500).json({
          success: false,
          message: 'Google Sheets service not configured',
        });
      }

      const analysis = await syncService.analyzeSheetStructure();
      await logActivity(
        req,
        res,
        'EVENT_REQUESTS_VIEW',
        'Analyzed Event Requests Google Sheet structure'
      );

      res.json({
        success: true,
        analysis,
        sheetUrl: `https://docs.google.com/spreadsheets/d/${process.env.EVENT_REQUESTS_SHEET_ID}/edit`,
        targetSpreadsheetId: process.env.EVENT_REQUESTS_SHEET_ID,
      });
    } catch (error) {
      logger.error('Error analyzing Event Requests Google Sheet:', error);
      res.status(500).json({
        success: false,
        message: 'Google Sheets analysis failed. Please check API credentials.',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
);

// Get organizations catalog - aggregated data from event requests
router.get('/orgs-catalog-test', async (req, res) => {
  try {
    const user = req.user;

    // TEMP: Completely bypass auth for testing

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
          status: request.contactedAt ? 'contacted' : request.status,
        });
      }
    });

    // Convert map to array
    const organizations = Array.from(organizationMap.values());

    logActivity(
      req,
      res,
      PERMISSIONS.ORGANIZATIONS_VIEW,
      `Retrieved organizations catalog: ${organizations.length} organizations`
    );
    res.json(organizations);
  } catch (error) {
    logger.error('Error fetching organizations catalog:', error);
    res.status(500).json({ message: 'Failed to fetch organizations catalog' });
  }
});

// Mark follow-up as completed for an event
router.patch(
  '/:id/follow-up',
  isAuthenticated,
  requirePermission('EVENT_REQUESTS_EDIT'),
  async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { followUpType, notes } = req.body;

      if (!followUpType || !['one_day', 'one_month'].includes(followUpType)) {
        return res.status(400).json({
          error: "Invalid follow-up type. Must be 'one_day' or 'one_month'",
        });
      }

      const userId = req.user?.id;
      if (!userId) {
        return res.status(400).json({ error: 'User ID required' });
      }

      const eventRequest = await storage.getEventRequest(id);
      if (!eventRequest) {
        return res.status(404).json({ error: 'Event request not found' });
      }

      // Prepare update data based on follow-up type
      const updateData: Partial<EventRequest> = {
        followUpNotes: notes || eventRequest.followUpNotes,
      };

      if (followUpType === 'one_day') {
        updateData.followUpOneDayCompleted = true;
        updateData.followUpOneDayDate = new Date();
      } else if (followUpType === 'one_month') {
        updateData.followUpOneMonthCompleted = true;
        updateData.followUpOneMonthDate = new Date();
      }

      const updatedEventRequest = await storage.updateEventRequest(
        id,
        updateData
      );

      // Enhanced audit logging for follow-up completion with specific context
      await AuditLogger.logEventRequestChange(
        id.toString(),
        eventRequest,
        updatedEventRequest,
        {
          userId: req.user?.id,
          ipAddress: req.ip || req.connection?.remoteAddress,
          userAgent: req.get('User-Agent'),
          sessionId: req.session?.id || req.sessionID,
        },
        {
          followUpMethod: followUpType === 'one_day' ? 'one_day_follow_up' : 'one_month_follow_up',
          followUpAction: `${followUpType}_follow_up_completed`,
          notes: notes || `${followUpType} follow-up marked as completed`,
          actionType: 'FOLLOW_UP_COMPLETED',
        }
      );

      await logActivity(
        req,
        res,
        'EVENT_REQUESTS_EDIT',
        `Marked ${followUpType} follow-up as completed for event: ${eventRequest.organizationName}`
      );

      res.json(updatedEventRequest);
    } catch (error) {
      logger.error('Error marking follow-up as completed:', error);
      res.status(500).json({ error: 'Failed to mark follow-up as completed' });
    }
  }
);

// Duplicate route removed - organization-counts already exists at line 376

// Update driver assignments for an event
router.patch('/:id/drivers', isAuthenticated, async (req, res) => {
  try {
    const eventId = parseInt(req.params.id);
    const {
      assignedDriverIds,
      driverPickupTime,
      driverNotes,
      driversArranged,
      // Van driver fields
      vanDriverNeeded,
      assignedVanDriverId,
      customVanDriverName,
      vanDriverNotes,
    } = req.body;

    // Validate that the event exists first
    const existingEvent = await storage.getEventRequestById(eventId);
    if (!existingEvent) {
      return res.status(404).json({ error: 'Event request not found' });
    }

    // Update the event with driver assignments
    const updateData: Partial<EventRequest> = {
      assignedDriverIds: assignedDriverIds || [],
      driverPickupTime: driverPickupTime || null,
      driverNotes: driverNotes || null,
      driversArranged:
        driversArranged !== undefined
          ? driversArranged
          : assignedDriverIds && assignedDriverIds.length > 0,
    };

    // Add van driver fields if provided
    if (vanDriverNeeded !== undefined)
      updateData.vanDriverNeeded = vanDriverNeeded;
    if (assignedVanDriverId !== undefined)
      updateData.assignedVanDriverId = assignedVanDriverId;
    if (customVanDriverName !== undefined)
      updateData.customVanDriverName = customVanDriverName;
    if (vanDriverNotes !== undefined)
      updateData.vanDriverNotes = vanDriverNotes;

    // Validate and auto-adjust driversNeeded based on assignments
    const regularDriverCount = Array.isArray(assignedDriverIds) ? assignedDriverIds.length : 0;
    
    // Check if van driver is assigned (either being set now or already exists)
    const hasVanDriver = (assignedVanDriverId !== undefined && assignedVanDriverId !== null && assignedVanDriverId !== '')
      || (assignedVanDriverId === undefined && existingEvent.assignedVanDriverId !== null && existingEvent.assignedVanDriverId !== '');
    
    const totalDriverCount = regularDriverCount + (hasVanDriver ? 1 : 0);
    const currentDriversNeeded = existingEvent.driversNeeded || 0;
    
    // Ensure driversNeeded is at least equal to total assigned drivers (prevent impossible states)
    if (totalDriverCount > currentDriversNeeded) {
      updateData.driversNeeded = totalDriverCount;
    }

    const updatedEvent = await storage.updateEventRequest(eventId, updateData);


    // Enhanced audit logging for driver assignment updates
    await AuditLogger.logEventRequestChange(
      eventId.toString(),
      existingEvent,
      updatedEvent,
      {
        userId: req.user?.id,
        ipAddress: req.ip || req.connection?.remoteAddress,
        userAgent: req.get('User-Agent'),
        sessionId: req.session?.id || req.sessionID,
      }
    );

    // Log activity
    await logActivity(
      req,
      res,
      'update_event_drivers',
      `Updated driver assignments for event: ${existingEvent.organizationName}`
    );

    res.json(updatedEvent);
  } catch (error) {
    logger.error('Error updating driver assignments:', error);
    res.status(500).json({ error: 'Failed to update driver assignments' });
  }
});

// Event Volunteers Routes

// Get all event volunteers for a specific event
router.get('/:eventId/volunteers', isAuthenticated, async (req, res) => {
  try {
    const eventId = parseInt(req.params.eventId);

    if (!eventId || isNaN(eventId)) {
      return res.status(400).json({ error: 'Valid event ID required' });
    }

    const volunteers = await storage.getEventVolunteersByEventId(eventId);

    res.json(volunteers);
  } catch (error) {
    logger.error('Error fetching event volunteers:', error);
    res.status(500).json({ error: 'Failed to fetch event volunteers' });
  }
});

// Sign up a user as a volunteer for an event
router.post('/:eventId/volunteers', isAuthenticated, async (req, res) => {
  try {
    const eventId = parseInt(req.params.eventId);
    const userId = req.user?.id;

    if (!eventId || isNaN(eventId)) {
      return res.status(400).json({ error: 'Valid event ID required' });
    }

    if (!userId) {
      return res.status(400).json({ error: 'User authentication required' });
    }

    // Validate request body against schema
    const volunteerData = insertEventVolunteerSchema.parse({
      ...req.body,
      eventRequestId: eventId,
      volunteerUserId: userId,
    });

    // Check if user is already signed up for this event with the same role
    const existingVolunteers =
      await storage.getEventVolunteersByEventId(eventId);
    const alreadySignedUp = existingVolunteers.find(
      (v) => v.volunteerUserId === userId && v.role === volunteerData.role
    );

    if (alreadySignedUp) {
      return res.status(400).json({
        error: `You are already signed up as a ${volunteerData.role} for this event`,
      });
    }

    const newVolunteer = await storage.createEventVolunteer(volunteerData);

    await logActivity(
      req,
      res,
      'volunteer_signup',
      `Signed up as ${volunteerData.role} for event: ${eventId}`
    );

    res.status(201).json(newVolunteer);
  } catch (error) {
    logger.error('Error creating event volunteer signup:', error);
    if (error instanceof z.ZodError) {
      return res
        .status(400)
        .json({ error: 'Invalid volunteer data', details: error.errors });
    }
    res.status(500).json({ error: 'Failed to sign up for event' });
  }
});

// Update volunteer status or assignment
router.patch('/volunteers/:volunteerId', isAuthenticated, async (req, res) => {
  try {
    const volunteerId = parseInt(req.params.volunteerId);

    if (!volunteerId || isNaN(volunteerId)) {
      return res.status(400).json({ error: 'Valid volunteer ID required' });
    }

    const updates = req.body;

    const updatedVolunteer = await storage.updateEventVolunteer(
      volunteerId,
      updates
    );

    if (!updatedVolunteer) {
      return res.status(404).json({ error: 'Volunteer assignment not found' });
    }

    await logActivity(
      req,
      res,
      'volunteer_update',
      `Updated volunteer assignment: ${volunteerId}`
    );

    res.json(updatedVolunteer);
  } catch (error) {
    logger.error('Error updating event volunteer:', error);
    res.status(500).json({ error: 'Failed to update volunteer assignment' });
  }
});

// Mark toolkit as sent for an event request
router.patch(
  '/:id/toolkit-sent',
  isAuthenticated,
  requirePermission('EVENT_REQUESTS_EDIT'),
  async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { toolkitSentDate } = req.body;


      // Get original data for audit logging
      const originalEvent = await storage.getEventRequestById(id);
      if (!originalEvent) {
        return res.status(404).json({ message: 'Event request not found' });
      }

      // Parse the toolkit sent date
      const sentDate = toolkitSentDate ? new Date(toolkitSentDate) : new Date();

      const updates: Partial<EventRequest> = {
        toolkitSent: true,
        toolkitSentDate: sentDate,
        toolkitStatus: 'sent',
        toolkitSentBy: req.user?.id, // Record who sent the toolkit
        status: 'in_process', // Move to in_process when toolkit is sent
        updatedAt: new Date(),
      };

      // Automatically assign the current user as TSP contact if not already assigned
      // This auto-assignment happens silently (no email) since toolkit sending happens later in workflow
      if (!originalEvent.tspContact && req.user?.id) {
        updates.tspContact = req.user.id;
        updates.tspContactAssignedDate = new Date();
      }

      const updatedEventRequest = await storage.updateEventRequest(id, updates);

      if (!updatedEventRequest) {
        return res.status(404).json({ message: 'Event request not found' });
      }

      // REMOVED: No longer updating Google Sheets - one-way sync only

      // Enhanced audit logging for toolkit sent action
      await AuditLogger.logEventRequestChange(
        id.toString(),
        originalEvent,
        updatedEventRequest,
        {
          userId: req.user?.id,
          ipAddress: req.ip || req.connection?.remoteAddress,
          userAgent: req.get('User-Agent'),
          sessionId: req.session?.id || req.sessionID,
        }
      );

      await logActivity(
        req,
        res,
        'EVENT_REQUESTS_TOOLKIT_SENT',
        `Marked toolkit as sent for event request: ${id}`
      );

      res.json(updatedEventRequest);
    } catch (error) {
      logger.error('Error marking toolkit as sent:', error);
      res.status(500).json({ message: 'Failed to mark toolkit as sent' });
    }
  }
);

// Remove volunteer from event
router.delete('/volunteers/:volunteerId', isAuthenticated, async (req, res) => {
  try {
    const volunteerId = parseInt(req.params.volunteerId);

    if (!volunteerId || isNaN(volunteerId)) {
      return res.status(400).json({ error: 'Valid volunteer ID required' });
    }

    const deleted = await storage.deleteEventVolunteer(volunteerId);

    if (!deleted) {
      return res.status(404).json({ error: 'Volunteer assignment not found' });
    }

    await logActivity(
      req,
      res,
      'volunteer_removal',
      `Removed volunteer assignment: ${volunteerId}`
    );

    res.json({ success: true });
  } catch (error) {
    logger.error('Error removing event volunteer:', error);
    res.status(500).json({ error: 'Failed to remove volunteer assignment' });
  }
});

// Get all volunteer signups for the current user
router.get('/my-volunteers', isAuthenticated, async (req, res) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(400).json({ error: 'User authentication required' });
    }

    const userVolunteers = await storage.getEventVolunteersByUserId(userId);

    // Enrich with event details
    const enrichedVolunteers = await Promise.all(
      userVolunteers.map(async (volunteer) => {
        const eventRequest = await storage.getEventRequestById(
          volunteer.eventRequestId
        );
        return {
          ...volunteer,
          eventRequest,
        };
      })
    );

    res.json(enrichedVolunteers);
  } catch (error) {
    logger.error('Error fetching user volunteers:', error);
    res.status(500).json({ error: 'Failed to fetch volunteer signups' });
  }
});

// Update social media post tracking for an event
router.patch(
  '/:id/social-media',
  isAuthenticated,
  requirePermission('EVENT_REQUESTS_EDIT'),
  async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { socialMediaPostRequested, socialMediaPostCompleted, notes } =
        req.body;

      if (!id || isNaN(id)) {
        return res.status(400).json({ error: 'Valid event ID required' });
      }

      const updates: Partial<EventRequest> = {};

      if (socialMediaPostRequested !== undefined) {
        updates.socialMediaPostRequested = socialMediaPostRequested;
        updates.socialMediaPostRequestedDate = socialMediaPostRequested
          ? new Date()
          : null;
      }

      if (socialMediaPostCompleted !== undefined) {
        updates.socialMediaPostCompleted = socialMediaPostCompleted;
        updates.socialMediaPostCompletedDate = socialMediaPostCompleted
          ? new Date()
          : null;
      }

      if (notes !== undefined) {
        updates.socialMediaPostNotes = notes;
      }

      const updatedEventRequest = await storage.updateEventRequest(id, updates);

      if (!updatedEventRequest) {
        return res.status(404).json({ error: 'Event request not found' });
      }

      // Enhanced audit logging for social media tracking
      const originalEvent = await storage.getEventRequestById(id);
      await AuditLogger.logEventRequestChange(
        id.toString(),
        originalEvent,
        updatedEventRequest,
        {
          userId: req.user?.id,
          ipAddress: req.ip || req.connection?.remoteAddress,
          userAgent: req.get('User-Agent'),
          sessionId: req.session?.id || req.sessionID,
        }
      );

      await logActivity(
        req,
        res,
        'EVENT_REQUESTS_EDIT',
        `Updated social media tracking for event: ${id}`
      );

      res.json(updatedEventRequest);
    } catch (error) {
      logger.error('Error updating social media tracking:', error);
      res.status(500).json({ error: 'Failed to update social media tracking' });
    }
  }
);

// Record actual sandwich count for a completed event
router.patch(
  '/:id/actual-sandwich-count',
  isAuthenticated,
  requirePermission('EVENT_REQUESTS_EDIT'),
  async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { actualSandwichCount, actualSandwichTypes } = req.body;

      if (!id || isNaN(id)) {
        return res.status(400).json({ error: 'Valid event ID required' });
      }

      if (!actualSandwichCount || actualSandwichCount <= 0) {
        return res.status(400).json({ error: 'Valid sandwich count required' });
      }

      const updates = {
        actualSandwichCount,
        actualSandwichTypes: actualSandwichTypes || null,
        actualSandwichCountRecordedDate: new Date(),
        actualSandwichCountRecordedBy: req.user?.id,
      };

      const updatedEventRequest = await storage.updateEventRequest(id, updates);

      if (!updatedEventRequest) {
        return res.status(404).json({ error: 'Event request not found' });
      }

      // Enhanced audit logging for actual sandwich count
      const originalEvent = await storage.getEventRequestById(id);
      await AuditLogger.logEventRequestChange(
        id.toString(),
        originalEvent,
        updatedEventRequest,
        {
          userId: req.user?.id,
          ipAddress: req.ip || req.connection?.remoteAddress,
          userAgent: req.get('User-Agent'),
          sessionId: req.session?.id || req.sessionID,
        }
      );

      await logActivity(
        req,
        res,
        'EVENT_REQUESTS_EDIT',
        `Recorded actual sandwich count (${actualSandwichCount}) for event: ${id}`
      );

      res.json(updatedEventRequest);
    } catch (error) {
      logger.error('Error recording actual sandwich count:', error);
      res.status(500).json({ error: 'Failed to record actual sandwich count' });
    }
  }
);

// Record sandwich distribution for a completed event
router.patch(
  '/:id/distribution',
  isAuthenticated,
  requirePermission('EVENT_REQUESTS_EDIT'),
  async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { sandwichDistributions, distributionNotes } = req.body;

      if (!id || isNaN(id)) {
        return res.status(400).json({ error: 'Valid event ID required' });
      }

      if (
        !sandwichDistributions ||
        !Array.isArray(sandwichDistributions) ||
        sandwichDistributions.length === 0
      ) {
        return res
          .status(400)
          .json({ error: 'Valid distribution data required' });
      }

      // Validate distribution format
      for (const dist of sandwichDistributions) {
        if (!dist.destination || !dist.totalCount || dist.totalCount <= 0) {
          return res.status(400).json({
            error: 'Each distribution must have a destination and valid count',
          });
        }
      }

      const updates = {
        sandwichDistributions,
        distributionNotes: distributionNotes || null,
        distributionRecordedDate: new Date(),
        distributionRecordedBy: req.user?.id,
      };

      const updatedEventRequest = await storage.updateEventRequest(id, updates);

      if (!updatedEventRequest) {
        return res.status(404).json({ error: 'Event request not found' });
      }

      const totalDistributed = sandwichDistributions.reduce(
        (sum, dist) => sum + dist.totalCount,
        0
      );

      // Enhanced audit logging for sandwich distribution
      const originalEvent = await storage.getEventRequestById(id);
      await AuditLogger.logEventRequestChange(
        id.toString(),
        originalEvent,
        updatedEventRequest,
        {
          userId: req.user?.id,
          ipAddress: req.ip || req.connection?.remoteAddress,
          userAgent: req.get('User-Agent'),
          sessionId: req.session?.id || req.sessionID,
        }
      );

      await logActivity(
        req,
        res,
        'EVENT_REQUESTS_EDIT',
        `Recorded sandwich distribution (${totalDistributed} sandwiches to ${sandwichDistributions.length} locations) for event: ${id}`
      );

      res.json(updatedEventRequest);
    } catch (error) {
      logger.error('Error recording sandwich distribution:', error);
      res.status(500).json({ error: 'Failed to record sandwich distribution' });
    }
  }
);

// Record actual sandwich counts for scheduled events
router.patch(
  '/:id/actual-sandwiches',
  isAuthenticated,
  requirePermission(PERMISSIONS.EVENT_REQUESTS_EDIT),
  async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const {
        actualSandwichCount,
        actualSandwichCountRecordedDate,
        actualSandwichCountRecordedBy,
        distributionNotes,
      } = req.body;

      if (!id || isNaN(id)) {
        return res.status(400).json({ error: 'Valid event ID required' });
      }

      // Create validation schema for the payload
      const actualSandwichDataSchema = z.object({
        actualSandwichCount: z.coerce
          .number()
          .min(1, 'Actual sandwich count must be greater than 0'),
        actualSandwichCountRecordedDate: z.string().optional(),
        actualSandwichCountRecordedBy: z.string().optional(),
        distributionNotes: z.string().optional(),
      });

      const validatedData = actualSandwichDataSchema.parse(req.body);

      // Get original data for audit logging
      const originalEvent = await storage.getEventRequestById(id);
      if (!originalEvent) {
        return res.status(404).json({ error: 'Event request not found' });
      }

      // Prepare updates object
      const updates = {
        actualSandwichCount: validatedData.actualSandwichCount,
        distributionNotes: validatedData.distributionNotes || null,
        // Handle recorded date - use provided date or current timestamp
        actualSandwichCountRecordedDate:
          validatedData.actualSandwichCountRecordedDate
            ? new Date(validatedData.actualSandwichCountRecordedDate)
            : new Date(),
        // Handle recorded by - use provided user or current user
        actualSandwichCountRecordedBy:
          validatedData.actualSandwichCountRecordedBy || req.user?.id,
        updatedAt: new Date(),
      };

      const updatedEventRequest = await storage.updateEventRequest(id, updates);

      if (!updatedEventRequest) {
        return res.status(404).json({ error: 'Event request not found' });
      }

      // Enhanced audit logging for this operation
      await AuditLogger.logEventRequestChange(
        id.toString(),
        originalEvent,
        updatedEventRequest,
        {
          userId: req.user?.id,
          ipAddress: req.ip || req.connection?.remoteAddress,
          userAgent: req.get('User-Agent'),
          sessionId: req.session?.id || req.sessionID,
        }
      );

      await logActivity(
        req,
        res,
        'EVENT_REQUESTS_EDIT',
        `Recorded actual sandwich count (${validatedData.actualSandwichCount}) and distribution notes for event: ${id}`,
        {
          eventId: id,
          actualSandwichCount: validatedData.actualSandwichCount,
          hasDistributionNotes: !!validatedData.distributionNotes,
          recordedBy: updates.actualSandwichCountRecordedBy,
        }
      );

      res.json(updatedEventRequest);
    } catch (error) {
      logger.error('Error recording actual sandwich data:', error);

      // Handle validation errors specifically
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          error: 'Validation failed',
          details: error.errors,
        });
      }

      res.status(500).json({ error: 'Failed to record actual sandwich data' });
    }
  }
);

// Update TSP contact assignment for event requests
router.patch('/:id/tsp-contact', isAuthenticated, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { tspContact } = req.body;

    if (!id || isNaN(id)) {
      return res.status(400).json({ error: 'Valid event ID required' });
    }

    // Check permissions - only admin@sandwich.project, katielong2316@gmail.com, and christine@thesandwichproject.org
    const userEmail = req.user?.email;
    const allowedEmails = [
      'admin@sandwich.project',
      'katielong2316@gmail.com',
      'christine@thesandwichproject.org'
    ];

    if (!userEmail || !allowedEmails.includes(userEmail)) {
      return res.status(403).json({
        error:
          'Insufficient permissions. Only Christine and Katie can assign TSP contacts.',
      });
    }

    // Create validation schema for the payload
    const tspContactSchema = z.object({
      tspContact: z.string().optional().nullable(),
      customTspContact: z.string().optional().nullable(),
    });

    const validatedData = tspContactSchema.parse(req.body);

    // Get original data for audit logging
    const originalEvent = await storage.getEventRequestById(id);
    if (!originalEvent) {
      return res.status(404).json({ error: 'Event request not found' });
    }

    // Prepare updates object
    const updates: Partial<EventRequest> = {
      tspContact: validatedData.tspContact || null,
      customTspContact: validatedData.customTspContact || null,
      updatedAt: new Date(),
    };

    // If assigning a TSP contact (user or custom text, not removing), set the assignment date
    if (validatedData.tspContact || validatedData.customTspContact) {
      updates.tspContactAssignedDate = new Date();
    } else {
      // If removing TSP contact, clear the assignment date
      updates.tspContactAssignedDate = null;
    }

    const updatedEventRequest = await storage.updateEventRequest(id, updates);

    if (!updatedEventRequest) {
      return res.status(404).json({ error: 'Event request not found' });
    }

    // Send email and SMS notifications if:
    // 1. TSP contact was assigned (not removed)
    // 2. It changed from previous value
    // 3. Event is not already completed or declined
    if (
      validatedData.tspContact && 
      originalEvent.tspContact !== validatedData.tspContact &&
      originalEvent.status !== 'completed' &&
      originalEvent.status !== 'declined'
    ) {
      try {
        // Send email notification
        await EmailNotificationService.sendTspContactAssignmentNotification(
          validatedData.tspContact!,
          id,
          originalEvent.organizationName,
          originalEvent.scheduledEventDate || originalEvent.desiredEventDate
        );
      } catch (error) {
        // Log error but don't fail the request if email notification fails
        logger.error('Failed to send TSP contact assignment email:', error);
      }

      // Send SMS notification if user has opted in
      try {
        const assignedUser = await storage.getUserById(validatedData.tspContact!);
        if (assignedUser) {
          const metadata = assignedUser.metadata as any || {};
          const smsConsent = metadata.smsConsent || {};
          
          // Only send SMS if user has confirmed SMS opt-in
          if (smsConsent.status === 'confirmed' && smsConsent.enabled && smsConsent.phoneNumber) {
            const { sendTspContactAssignmentSMS } = await import('../sms-service');
            const smsResult = await sendTspContactAssignmentSMS(
              smsConsent.phoneNumber,
              originalEvent.organizationName,
              id,
              originalEvent.scheduledEventDate || originalEvent.desiredEventDate
            );
            
            if (smsResult.success) {
              logger.log(`✅ TSP contact assignment SMS sent to ${assignedUser.email}`);
            } else {
              logger.warn(`⚠️ TSP contact assignment SMS failed: ${smsResult.message}`);
            }
          }
        }
      } catch (error) {
        // Log error but don't fail the request if SMS notification fails
        logger.error('Failed to send TSP contact assignment SMS:', error);
      }
    }

    // Enhanced audit logging for this operation
    await AuditLogger.logEventRequestChange(
      id.toString(),
      originalEvent,
      updatedEventRequest,
      {
        userId: req.user?.id,
        ipAddress: req.ip || req.connection?.remoteAddress,
        userAgent: req.get('User-Agent'),
        sessionId: req.session?.id || req.sessionID,
      }
    );

    await logActivity(
      req,
      res,
      'EVENT_REQUESTS_EDIT',
      `${validatedData.tspContact ? 'Assigned' : 'Removed'} TSP contact for event: ${id}`,
      {
        eventId: id,
        tspContact: validatedData.tspContact,
        assignedBy: req.user?.email,
        organizationName: originalEvent.organizationName,
      }
    );

    res.json(updatedEventRequest);
  } catch (error) {
    logger.error('Error updating TSP contact:', error);

    // Handle validation errors specifically
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Validation failed',
        details: error.errors,
      });
    }

    res.status(500).json({ error: 'Failed to update TSP contact' });
  }
});

// GET /api/event-requests/audit-logs - Fetch audit log entries for event requests
router.get('/audit-logs', isAuthenticated, async (req, res) => {
  try {
    // Disable caching for audit logs - they should always be fresh
    res.set({
      'Cache-Control': 'no-store, no-cache, must-revalidate, private',
      'Pragma': 'no-cache',
      'Expires': '0'
    });

    // Check permissions
    if (!hasPermission(req.user, PERMISSIONS.EVENT_REQUESTS_VIEW)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    // Parse query parameters
    const hours = parseInt(req.query.hours as string) || 24;
    const limit = Math.min(parseInt(req.query.limit as string) || 100, 500); // Cap at 500
    const offset = parseInt(req.query.offset as string) || 0;
    const action = req.query.action as string;
    const userId = req.query.userId as string;
    const eventId = req.query.eventId as string;

    // Calculate time cutoff
    const hoursAgo = new Date();
    hoursAgo.setHours(hoursAgo.getHours() - hours);

    // Build query conditions using Drizzle ORM
    const conditions = [];

    // Always filter for event_requests table
    conditions.push(eq(auditLogs.tableName, 'event_requests'));

    // Add time filter if specified - using SQL comparison as a workaround
    if (hours > 0) {
      // Use SQL template for date comparison instead of gte
      conditions.push(sql`${auditLogs.timestamp} >= ${hoursAgo.toISOString()}`);
    }

    // Add action filter if specified
    if (action && action !== 'all') {
      conditions.push(eq(auditLogs.action, action));
    }

    // Add user filter if specified
    if (userId && userId !== 'all') {
      conditions.push(eq(auditLogs.userId, userId));
    }

    // Add event ID filter if specified
    if (eventId) {
      conditions.push(eq(auditLogs.recordId, eventId));
    }


    // Execute query using Drizzle ORM
    const rawLogs = await db
      .select()
      .from(auditLogs)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(auditLogs.timestamp))
      .limit(limit)
      .offset(offset);


    // Get users for enriching the audit log data
    // Get users for enriching the audit log data
    const allUsers = await storage.getAllUsers();
    // Normalize keys to string
    const userMap = new Map(allUsers.map((u) => [String(u.id), u]));

    // Get all event requests for enriching audit data
    const allEventRequests = await storage.getAllEventRequests();
    const eventMap = new Map(allEventRequests.map((e) => [String(e.id), e]));

    // Helper to pull from camelCase or snake_case
    const getField = (row: Record<string, unknown>, camel: string, snake: string) =>
      row[camel] !== undefined ? row[camel] : row[snake];

    // Transform raw logs to the expected format
    const enrichedLogs = rawLogs.map((log) => {
      const recordId = String(getField(log, 'recordId', 'record_id'));
      const userId = String(getField(log, 'userId', 'user_id'));

      let newData: Partial<EventRequest> | null = null;
      let oldData: Partial<EventRequest> | null = null;
      try {
        newData = getField(log, 'newData', 'new_data')
          ? JSON.parse(getField(log, 'newData', 'new_data'))
          : null;
      } catch {}
      try {
        oldData = getField(log, 'oldData', 'old_data')
          ? JSON.parse(getField(log, 'oldData', 'old_data'))
          : null;
      } catch {}

      const user = userMap.get(userId);
      const event = eventMap.get(recordId);

      // Extract follow-up context and audit metadata from newData or oldData
      let followUpMethod = null;
      let followUpAction = null;
      let notes = null;
      let actionDescription = '';
      let changeDescription = '';
      let statusChange = null;

      // Try to extract follow-up context from newData first, then oldData
      const dataWithContext = newData || oldData;
      if (dataWithContext) {
        // Extract follow-up context fields
        followUpMethod = dataWithContext.followUpMethod || dataWithContext._auditMetadata?.followUpMethod || null;
        followUpAction = dataWithContext.followUpAction || dataWithContext._auditMetadata?.followUpAction || null;
        notes = dataWithContext.notes || dataWithContext._auditMetadata?.notes || null;
        
        // Extract action descriptions
        actionDescription = dataWithContext._auditMetadata?.actionDescription || 
                           dataWithContext.actionDescription || 
                           getField(log, 'action', 'action') || '';
        
        changeDescription = dataWithContext._auditMetadata?.changeDescription || 
                           dataWithContext.changeDescription || '';
        
        // Extract status change information
        statusChange = dataWithContext._auditMetadata?.statusChange || 
                      dataWithContext.statusChange || null;

        // If we have both old and new data, try to determine status change
        if (newData && oldData && newData.status !== oldData.status) {
          statusChange = `${oldData.status || 'unknown'} → ${newData.status || 'unknown'}`;
        }
      }

      return {
        id: getField(log, 'id', 'id'),
        action: getField(log, 'action', 'action'),
        eventId: recordId,
        timestamp: getField(log, 'timestamp', 'timestamp'),
        userId,
        userEmail: user?.email || user?.preferredEmail || 'Unknown User',
        organizationName:
          event?.organizationName ||
          oldData?.organizationName ||
          'Unknown Organization',
        contactName: event
          ? `${event.firstName} ${event.lastName}`
          : oldData
            ? `${oldData.firstName} ${oldData.lastName}`
            : 'Unknown Contact',
        // CRITICAL FIX: Expose oldData/newData at top level (not buried in details)
        oldData,
        newData,
        // CRITICAL FIX: Expose follow-up context fields that frontend expects
        followUpMethod,
        followUpAction,
        notes,
        actionDescription,
        changeDescription,
        statusChange,
        // Keep details for backward compatibility but make it secondary
        details: { oldData, newData },
      };
    });

    
    // Debug: Log unique users in the returned logs
    const uniqueUserIds = new Set(enrichedLogs.map(log => log.userId));
    const uniqueUserEmails = new Set(enrichedLogs.map(log => log.userEmail));

    res.json({
      logs: enrichedLogs,
      total: enrichedLogs.length,
      offset,
      limit,
    });
  } catch (error: unknown) {
    const err = error as Error;
    logger.error('Failed to fetch audit logs', error);

    res.status(500).json({
      error: 'Failed to fetch audit logs',
      message: err?.message || 'Unknown error occurred'
    });
  }
});

// Update recipient assignment for event requests
router.patch('/:id/recipients', isAuthenticated, async (req, res) => {
  try {
    const eventId = parseInt(req.params.id);
    const { assignedRecipientIds } = req.body;

    if (!eventId || isNaN(eventId)) {
      return res.status(400).json({ error: 'Valid event ID required' });
    }


    // Check permissions
    if (!hasPermission(req.user, PERMISSIONS.EVENT_REQUESTS_EDIT)) {
      return res.status(403).json({ error: 'Insufficient permissions to assign recipients' });
    }

    // Validate that the event exists
    const existingEvent = await storage.getEventRequestById(eventId);
    if (!existingEvent) {
      return res.status(404).json({ error: 'Event request not found' });
    }

    // Update the event with recipient assignment
    const updatedEventRequest = await storage.updateEventRequest(eventId, {
      assignedRecipientIds: assignedRecipientIds || [],
      updatedAt: new Date(),
    });

    if (!updatedEventRequest) {
      return res.status(404).json({ error: 'Failed to update event request' });
    }

    await logActivity(
      req,
      res,
      'EVENT_REQUESTS_EDIT',
      `Updated recipient assignments for event request: ${eventId}`,
      { recipientIds: assignedRecipientIds }
    );

    res.json(updatedEventRequest);
  } catch (error) {
    logger.error('Error updating recipient assignment:', error);
    res.status(500).json({ error: 'Failed to update recipient assignment' });
  }
});

// Send email to event organizer with toolkit documents
router.post('/:id/send-email', isAuthenticated, async (req, res) => {
  try {
    const eventId = parseInt(req.params.id);
    const { recipientEmail, subject, content, attachments = [] } = req.body;

    if (!eventId || isNaN(eventId)) {
      return res.status(400).json({ error: 'Valid event ID required' });
    }

    // Check permissions
    if (!hasPermission(req.user, PERMISSIONS.EVENT_REQUESTS_SEND_TOOLKIT)) {
      return res.status(403).json({ error: 'Insufficient permissions to send emails' });
    }

    // Validate required fields
    if (!recipientEmail || !subject || !content) {
      return res.status(400).json({ error: 'Recipient email, subject, and content are required' });
    }

    // Get event details
    const eventRequest = await storage.getEventRequestById(eventId);
    if (!eventRequest) {
      return res.status(404).json({ error: 'Event request not found' });
    }

    // Import SendGrid service and email footer
    const { sendEmail } = await import('../sendgrid');
    const { EMAIL_FOOTER_TEXT, EMAIL_FOOTER_HTML } = await import('../utils/email-footer');
    const path = await import('path');

    // Use the HTML content as-is (already styled from EventEmailComposer)
    // Only add footer to the existing content
    const emailBodyText = content + EMAIL_FOOTER_TEXT;
    const emailBodyHtml = content + EMAIL_FOOTER_HTML;

    // Determine from and reply-to addresses
    const fromEmail = process.env.SENDGRID_FROM_EMAIL || 'katielong2316@gmail.com';
    const replyToEmail = req.user?.preferredEmail || req.user?.email || fromEmail;

    // Convert attachment paths to absolute file system paths
    const attachmentPaths = attachments.map((filePath: string) => {
      // If path starts with /, it's already an absolute path from /uploads
      // Convert to filesystem path
      if (filePath.startsWith('/uploads/')) {
        return path.join(process.cwd(), filePath);
      }
      return filePath;
    });

    // Send email via SendGrid with actual file attachments
    const emailSent = await sendEmail({
      to: recipientEmail,
      from: fromEmail,
      replyTo: replyToEmail,
      subject,
      text: emailBodyText,
      html: emailBodyHtml, // Use the styled HTML as-is, no wrapping
      attachments: attachmentPaths, // Pass actual file paths for attachment
    });

    if (!emailSent) {
      return res.status(500).json({ error: 'Failed to send email via SendGrid' });
    }

    // Log activity
    await logActivity(
      req,
      res,
      'EVENT_REQUESTS_SEND_TOOLKIT',
      `Sent email to event organizer for event request: ${eventId}`,
      { 
        recipientEmail, 
        subject, 
        attachmentsCount: attachments.length 
      }
    );

    res.json({ 
      success: true, 
      message: 'Email sent successfully' 
    });
  } catch (error: unknown) {
    const err = error as Error;
    logger.error('❌ Error sending email:', error);
    res.status(500).json({
      error: 'Failed to send email',
      message: err?.message || 'Unknown error occurred'
    });
  }
});

// Schedule a follow-up call
router.patch('/:id/schedule-call', isAuthenticated, requirePermission('EVENT_REQUESTS_EDIT'), async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { scheduledCallDate } = req.body;


    // Validate the date
    if (!scheduledCallDate) {
      return res.status(400).json({ message: 'Scheduled call date is required' });
    }

    // Get original data for audit logging
    const originalEvent = await storage.getEventRequestById(id);
    if (!originalEvent) {
      return res.status(404).json({ message: 'Event request not found' });
    }

    // Update the event request with the scheduled call date
    const updatedEventRequest = await storage.updateEventRequest(id, {
      scheduledCallDate: new Date(scheduledCallDate),
      callScheduledAt: new Date(),
      scheduledBy: req.user?.id,
    });

    if (!updatedEventRequest) {
      return res.status(404).json({ message: 'Event request not found' });
    }

    // Log the change
    await AuditLogger.logEventRequestChange(
      id.toString(),
      originalEvent,
      updatedEventRequest,
      {
        userId: req.user?.id,
        ipAddress: req.ip || req.connection?.remoteAddress,
        userAgent: req.get('User-Agent'),
        sessionId: req.session?.id || req.sessionID,
      }
    );

    await logActivity(
      req,
      res,
      'EVENT_REQUESTS_SCHEDULE_CALL',
      `Scheduled call for event request: ${id}`,
      { scheduledCallDate }
    );

    res.json(updatedEventRequest);
  } catch (error) {
    logger.error('Error scheduling call:', error);
    res.status(500).json({ 
      message: 'Failed to schedule call',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;
