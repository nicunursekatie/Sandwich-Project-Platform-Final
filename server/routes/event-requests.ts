import { Router, Response } from 'express';
import { z } from 'zod';
import { storage } from '../storage-wrapper';
import {
  insertEventRequestSchema,
  insertOrganizationSchema,
  insertEventVolunteerSchema,
  importFromSheetsSchema,
  auditLogs,
  eventRequests,
  users,
  type EventRequest,
  type User,
} from '@shared/schema';
import { PERMISSIONS } from '@shared/auth-utils';
import { hasPermission } from '@shared/unified-auth-utils';
import { parseDateOnly } from '@shared/date-utils';
import { requirePermission } from '../middleware/auth';
import { isAuthenticated } from '../auth';
import { getEventRequestsGoogleSheetsService } from '../google-sheets-event-requests-sync';
import { AuditLogger } from '../audit-logger';
import { db } from '../db';
import { eq, desc, and, sql, gte, or, isNull, ne } from 'drizzle-orm';
import { EmailNotificationService } from '../services/email-notification-service';
import { logger } from '../middleware/logger';
import type { AuthenticatedRequest } from '../types/express';
import { emitEventRequestUpdate } from '../socket-chat';
import { safeJsonParse } from '../utils/safe-json';
import { geocodeAddress } from '../utils/geocoding';
import { rateLimiter } from '../utils/rate-limiter';

const router = Router();

// Helper functions for pickup time data migration
const convertTimeToDateTime = (timeStr: string, baseDate?: Date | string): string | null => {
  if (!timeStr) return null;
  
  try {
    // Parse time string (supports formats like "2:30 PM", "14:30", "2:30")
    const timeMatch = timeStr.match(/^(\d{1,2}):(\d{2})(?:\s*(AM|PM))?$/i);
    if (!timeMatch) return null;
    
    let hours = parseInt(timeMatch[1]);
    const minutes = parseInt(timeMatch[2]);
    const ampm = timeMatch[3]?.toUpperCase();
    
    // Convert to 24-hour format if needed
    if (ampm === 'PM' && hours !== 12) hours += 12;
    if (ampm === 'AM' && hours === 12) hours = 0;
    
    // Extract date components safely without timezone conversion
    let year: number, month: string, day: string;
    
    if (baseDate) {
      const dateStr = typeof baseDate === 'string' ? baseDate : baseDate.toISOString();
      // Extract YYYY-MM-DD directly from the string to avoid timezone issues
      const dateMatch = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
      if (dateMatch) {
        year = parseInt(dateMatch[1]);
        month = dateMatch[2];
        day = dateMatch[3];
      } else {
        // Fallback to Date object if string parsing fails
        const d = new Date(dateStr);
        year = d.getUTCFullYear();
        month = String(d.getUTCMonth() + 1).padStart(2, '0');
        day = String(d.getUTCDate()).padStart(2, '0');
      }
    } else {
      // Use today's date in local timezone
      const now = new Date();
      year = now.getFullYear();
      month = String(now.getMonth() + 1).padStart(2, '0');
      day = String(now.getDate()).padStart(2, '0');
    }
    
    const hoursStr = String(hours).padStart(2, '0');
    const minutesStr = String(minutes).padStart(2, '0');
    return `${year}-${month}-${day}T${hoursStr}:${minutesStr}:00`;
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

// ============================================================================
// Google Sheets Import Helper Functions
// ============================================================================

// Parse staffing column from Google Sheets
// Format: "D, S, V" (needs) or "D: Katie, S: Kim, V: Christine, VD: Luz" (assigned)
interface StaffingResult {
  driversNeeded: number;
  speakersNeeded: number;
  volunteersNeeded: number;
  vanDriverNeeded: boolean;
  assignedDriverNames: string[];
  assignedSpeakerNames: string[];
  assignedVolunteerNames: string[];
  customVanDriverName: string | null;
}

const parseStaffingColumn = (staffing: string | undefined): StaffingResult => {
  const result: StaffingResult = {
    driversNeeded: 0,
    speakersNeeded: 0,
    volunteersNeeded: 0,
    vanDriverNeeded: false,
    assignedDriverNames: [],
    assignedSpeakerNames: [],
    assignedVolunteerNames: [],
    customVanDriverName: null,
  };

  if (!staffing || staffing.trim() === '') return result;

  // Split by comma and process each part
  const parts = staffing.split(',').map(p => p.trim());

  for (const part of parts) {
    if (!part) continue;

    // Check if it has an assignment (contains ':')
    if (part.includes(':')) {
      const [role, name] = part.split(':').map(s => s.trim());
      const roleUpper = role.toUpperCase();

      if (roleUpper === 'VD') {
        result.vanDriverNeeded = true;
        result.customVanDriverName = name;
      } else if (roleUpper === 'D') {
        result.assignedDriverNames.push(name);
      } else if (roleUpper === 'S') {
        result.assignedSpeakerNames.push(name);
      } else if (roleUpper === 'V') {
        result.assignedVolunteerNames.push(name);
      }
    } else {
      // Just a role letter means it's needed but not filled
      const roleUpper = part.toUpperCase();
      if (roleUpper === 'VD') {
        result.vanDriverNeeded = true;
      } else if (roleUpper === 'D') {
        result.driversNeeded = 1;
      } else if (roleUpper === 'S') {
        result.speakersNeeded = 1;
      } else if (roleUpper === 'V') {
        result.volunteersNeeded = 1;
      }
    }
  }

  return result;
};

// Parse sandwich types from Google Sheets
// Input: "Deli", "PBJ", "Deli & PBJ", "Turkey, Ham", etc.
const parseSandwichTypes = (
  typesStr: string | undefined,
  estimatedCount?: number
): Array<{ type: string; quantity: number }> | null => {
  if (!typesStr || typesStr.trim() === '') return null;

  const normalizedStr = typesStr.toLowerCase().trim();
  const types: string[] = [];

  // Handle common formats
  if (normalizedStr.includes('&')) {
    // "Deli & PBJ" format
    types.push(...normalizedStr.split('&').map(t => t.trim()));
  } else if (normalizedStr.includes(',')) {
    // "Turkey, Ham" format
    types.push(...normalizedStr.split(',').map(t => t.trim()));
  } else if (normalizedStr.includes('/')) {
    // "Deli/PBJ" format
    types.push(...normalizedStr.split('/').map(t => t.trim()));
  } else {
    // Single type
    types.push(normalizedStr);
  }

  // Calculate quantities - split evenly if we have an estimate
  const count = estimatedCount || 0;
  const perType = types.length > 0 ? Math.floor(count / types.length) : 0;

  return types.map((type, index) => ({
    type: type.charAt(0).toUpperCase() + type.slice(1), // Capitalize first letter
    // Last type gets any remainder
    quantity: index === types.length - 1 ? count - (perType * (types.length - 1)) : perType,
  }));
};

// Parse contact name into first/last name
const parseContactName = (name: string | undefined): { firstName: string | null; lastName: string | null } => {
  if (!name || name.trim() === '') {
    return { firstName: null, lastName: null };
  }

  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) {
    return { firstName: parts[0], lastName: null };
  }

  // First word is first name, rest is last name
  return {
    firstName: parts[0],
    lastName: parts.slice(1).join(' '),
  };
};

// Cached user data for batch name matching (avoids N+1 queries)
interface UserLookupData {
  id: string;
  firstName: string | null;
  lastName: string | null;
  displayName: string | null;
}

// Fetch all active users once for batch matching
const fetchActiveUsersForMatching = async (): Promise<UserLookupData[]> => {
  try {
    return await db
      .select({
        id: users.id,
        firstName: users.firstName,
        lastName: users.lastName,
        displayName: users.displayName,
      })
      .from(users)
      .where(eq(users.isActive, true));
  } catch (error) {
    logger.error('Error fetching users for matching:', error);
    return [];
  }
};

// Match a single name against pre-fetched user list (O(n) single pass)
const matchNameToUser = (
  searchName: string,
  allUsers: UserLookupData[]
): string | null => {
  if (!searchName || searchName.trim() === '') return null;

  const normalizedName = searchName.trim().toLowerCase();

  for (const user of allUsers) {
    // Check displayName first
    if (user.displayName && user.displayName.toLowerCase() === normalizedName) {
      return user.id;
    }

    // Check firstName + lastName combination
    const fullName = `${user.firstName || ''} ${user.lastName || ''}`.trim().toLowerCase();
    if (fullName === normalizedName) {
      return user.id;
    }

    // Check just firstName (for single name matches like "Katie")
    if (user.firstName && user.firstName.toLowerCase() === normalizedName) {
      return user.id;
    }
  }

  return null;
};

// Batch match multiple staff names to user IDs (single DB query)
// This replaces the N+1 pattern of calling findUserByName in a loop
const batchMatchStaffNames = async (
  tspContactName: string | undefined,
  driverNames: string[],
  speakerNames: string[],
  volunteerNames: string[]
): Promise<{
  tspContactUserId: string | null;
  assignedDriverIds: string[];
  assignedSpeakerIds: string[];
  assignedVolunteerIds: string[];
}> => {
  // Single database query for all users
  const allUsers = await fetchActiveUsersForMatching();

  // Match TSP contact
  const tspContactUserId = tspContactName
    ? matchNameToUser(tspContactName, allUsers)
    : null;

  // Match all staff names against cached user list
  const matchNames = (names: string[]): string[] => {
    return names.map(name => {
      const userId = matchNameToUser(name, allUsers);
      // If no match, store the name as-is (the field accepts text)
      return userId || name;
    });
  };

  return {
    tspContactUserId,
    assignedDriverIds: matchNames(driverNames),
    assignedSpeakerIds: matchNames(speakerNames),
    assignedVolunteerIds: matchNames(volunteerNames),
  };
};

// Combine notes fields into planning notes
const combineNotesFields = (
  allDetails?: string,
  notes?: string,
  addlNotes?: string,
  waitingOn?: string
): string | null => {
  const parts: string[] = [];

  if (allDetails && allDetails.trim()) {
    parts.push(allDetails.trim());
  }
  if (notes && notes.trim()) {
    parts.push(`Notes: ${notes.trim()}`);
  }
  if (addlNotes && addlNotes.trim()) {
    parts.push(`Additional Notes: ${addlNotes.trim()}`);
  }
  if (waitingOn && waitingOn.trim()) {
    parts.push(`Waiting On: ${waitingOn.trim()}`);
  }

  return parts.length > 0 ? parts.join('\n\n') : null;
};

// API key validation middleware for Google Sheets import
const validateSheetsApiKey = (req: any, res: any, next: any) => {
  const apiKey = req.headers['x-api-key'];
  const expectedKey = process.env.GOOGLE_SHEETS_API_KEY;

  if (!expectedKey) {
    logger.error('GOOGLE_SHEETS_API_KEY environment variable not set');
    return res.status(500).json({ error: 'Server configuration error' });
  }

  if (!apiKey || apiKey !== expectedKey) {
    return res.status(401).json({ error: 'Invalid or missing API key' });
  }

  next();
};

// ============================================================================
// Google Sheets Import Endpoint
// ============================================================================

router.post('/import-from-sheets', validateSheetsApiKey, async (req, res) => {
  try {
    // Validate incoming data
    const validationResult = importFromSheetsSchema.safeParse(req.body);

    if (!validationResult.success) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: validationResult.error.errors,
      });
    }

    const data = validationResult.data;

    // Parse the date
    const eventDate = new Date(data.date);
    if (isNaN(eventDate.getTime())) {
      return res.status(400).json({
        success: false,
        error: 'Invalid date format. Please use YYYY-MM-DD format.',
      });
    }

    // Check for duplicates (same org + same date)
    // Exclude soft-deleted events and cancelled/declined/postponed events
    // Check both scheduledEventDate and desiredEventDate to catch events that might not be fully scheduled yet
    const eventDateStr = eventDate.toISOString().split('T')[0]; // YYYY-MM-DD format
    const existingEvents = await db
      .select({ 
        id: eventRequests.id, 
        organizationName: eventRequests.organizationName,
        status: eventRequests.status,
        deletedAt: eventRequests.deletedAt,
        scheduledEventDate: eventRequests.scheduledEventDate,
        desiredEventDate: eventRequests.desiredEventDate
      })
      .from(eventRequests)
      .where(
        and(
          sql`LOWER(${eventRequests.organizationName}) = LOWER(${data['Group Name']})`,
          // Check if either scheduledEventDate or desiredEventDate matches the target date
          or(
            sql`DATE(${eventRequests.scheduledEventDate}) = DATE(${eventDate.toISOString()})`,
            sql`DATE(${eventRequests.desiredEventDate}) = DATE(${eventDate.toISOString()})`
          ),
          isNull(eventRequests.deletedAt), // Exclude soft-deleted events
          // Only check against active statuses - allow duplicates if the existing event is cancelled/declined/postponed
          sql`${eventRequests.status} NOT IN ('cancelled', 'declined', 'postponed')`
        )
      );

    if (existingEvents.length > 0) {
      const existing = existingEvents[0];
      logger.warn(`Duplicate event detected: "${data['Group Name']}" on ${data.date}`, {
        existingEventId: existing.id,
        existingStatus: existing.status,
        existingScheduledDate: existing.scheduledEventDate,
        existingDesiredDate: existing.desiredEventDate,
        existingDeletedAt: existing.deletedAt,
        targetDate: data.date
      });
      return res.status(409).json({
        success: false,
        error: `Event already exists for "${data['Group Name']}" on ${data.date}`,
        existingEventId: existing.id,
        existingStatus: existing.status,
        existingScheduledDate: existing.scheduledEventDate,
        existingDesiredDate: existing.desiredEventDate,
        existingDeletedAt: existing.deletedAt,
        link: `/event-requests/${existing.id}`,
        debug: {
          message: 'This event was found by duplicate check. If it should not block creation, check:',
          checks: {
            isDeleted: !!existing.deletedAt,
            isInactiveStatus: ['cancelled', 'declined', 'postponed'].includes(existing.status),
            shouldExclude: !!existing.deletedAt || ['cancelled', 'declined', 'postponed'].includes(existing.status)
          }
        }
      });
    }

    // Parse staffing column
    const staffing = parseStaffingColumn(data['Staffing']);

    // Parse sandwich count
    const sandwichCountRaw = data['Estimate # sandwiches'];
    const estimatedSandwichCount = sandwichCountRaw
      ? typeof sandwichCountRaw === 'number'
        ? sandwichCountRaw
        : parseInt(String(sandwichCountRaw).replace(/[^\d]/g, ''), 10) || null
      : null;

    // Parse sandwich types
    const sandwichTypes = parseSandwichTypes(data['Deli or PBJ?'], estimatedSandwichCount || undefined);

    // Parse contact name
    const contactNameParts = parseContactName(data['Contact Name']);

    // Batch match all staff names to user IDs (single DB query instead of N+1)
    const {
      tspContactUserId,
      assignedDriverIds,
      assignedSpeakerIds,
      assignedVolunteerIds,
    } = await batchMatchStaffNames(
      data['TSP Contact'],
      staffing.assignedDriverNames,
      staffing.assignedSpeakerNames,
      staffing.assignedVolunteerNames
    );

    // Combine notes
    const planningNotes = combineNotesFields(
      data['ALL DETAILS'],
      data['Notes'],
      data["Add'l Notes"],
      data['Waiting On']
    );

    // Determine status
    const isCancelled = data['Cancelled']?.toLowerCase() === 'yes' ||
                        data['Cancelled']?.toLowerCase() === 'cancelled' ||
                        data['Cancelled']?.toLowerCase() === 'true';
    const status = isCancelled ? 'cancelled' : 'scheduled';

    // Parse toolkit sent
    const toolkitSent = data['Sent toolkit']?.toLowerCase() === 'yes' ||
                        data['Sent toolkit']?.toLowerCase() === 'true';

    // Generate external ID for duplicate prevention
    const externalId = `sheets-import-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // Build the event request data
    const eventRequestData = {
      // Required fields
      organizationName: data['Group Name'],
      scheduledEventDate: eventDate,
      status,
      externalId,

      // Contact info
      firstName: contactNameParts.firstName,
      lastName: contactNameParts.lastName,
      email: data['Email Address'] || null,
      phone: data['Contact Cell Number'] || null,

      // Event timing
      eventStartTime: data['Event Start time (MUST when volunteer needed)'] || null,
      eventEndTime: data['Event end time (MUST when volunteer needed)'] || null,
      pickupTime: data['Pick up time'] || null,

      // Location
      eventAddress: data['Address'] || null,
      deliveryDestination: data['Planned Recipient/Host Home'] || null,

      // Sandwich info
      estimatedSandwichCount,
      sandwichTypes: sandwichTypes ? JSON.stringify(sandwichTypes) : null,

      // Staffing needs
      driversNeeded: staffing.driversNeeded,
      speakersNeeded: staffing.speakersNeeded,
      volunteersNeeded: staffing.volunteersNeeded,
      vanDriverNeeded: staffing.vanDriverNeeded,

      // Staffing assignments
      assignedDriverIds: assignedDriverIds.length > 0 ? assignedDriverIds : null,
      assignedSpeakerIds: assignedSpeakerIds.length > 0 ? assignedSpeakerIds : null,
      assignedVolunteerIds: assignedVolunteerIds.length > 0 ? assignedVolunteerIds : null,
      customVanDriverName: staffing.customVanDriverName,

      // TSP Contact
      tspContact: tspContactUserId || data['TSP Contact'] || null,

      // Toolkit
      toolkitSent,
      toolkitStatus: toolkitSent ? 'sent' : 'not_sent',

      // Notes
      planningNotes,

      // Event is confirmed and on calendar since it's coming from the official sheet
      isConfirmed: true,
      addedToOfficialSheet: true,

      // Audit
      createdBy: 'google-sheets-import',
    };

    // Create the event request
    const createdEvent = await storage.createEventRequest(eventRequestData as any);

    // Log the import
    logger.info(`Google Sheets import: Created event request ${createdEvent.id} for "${data['Group Name']}" on ${data.date}`);

    // Emit real-time update to all connected clients
    emitEventRequestUpdate('event_request_created', createdEvent);

    return res.status(201).json({
      success: true,
      eventId: createdEvent.id,
      message: `Event created successfully for "${data['Group Name']}"`,
      link: `/event-requests/${createdEvent.id}`,
    });
  } catch (error) {
    logger.error('Google Sheets import error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to import event',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Get available drivers for event assignments
router.get('/drivers/available', isAuthenticated, async (req, res) => {
  try {
    if (!hasPermission(req.user, PERMISSIONS.DRIVERS_VIEW)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    const drivers = await storage.getAllDrivers();

    // Only return active drivers who are not busy or off-duty
    const availableDrivers = drivers
      .filter((driver) => driver.isActive && driver.availability !== 'busy' && driver.availability !== 'off-duty')
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
  'declined',
  'postponed',
  'cancelled'
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

    // Parallel fetch: get events and current user simultaneously
    const [allEventRequests, currentUser] = await Promise.all([
      storage.getAllEventRequests(),
      storage.getUserById(userId),
    ]);

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
        // speakerDetails is now JSONB - convert to string for text search
        const speakerText = (
          typeof event.speakerDetails === 'string'
            ? event.speakerDetails
            : JSON.stringify(event.speakerDetails)
        ).toLowerCase();
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
    // speakerDetails is now JSONB - convert to string for text search
    const speakerText = (
      typeof event.speakerDetails === 'string'
        ? event.speakerDetails
        : JSON.stringify(event.speakerDetails)
    ).toLowerCase();
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

// Get all event requests (with optional filtering)
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
        'Retrieved event requests'
      );
      
      let eventRequests = await storage.getAllEventRequests();
      
      // Parse query parameters for filtering
      const daysParam = req.query.days as string | undefined;
      const statusParam = req.query.status as string | undefined;
      const needsActionParam = req.query.needsAction as string | undefined;
      
      // Filter by days (next N days from today)
      if (daysParam) {
        const days = parseInt(daysParam, 10);
        if (!isNaN(days) && days > 0) {
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          const futureDate = new Date(today);
          futureDate.setDate(futureDate.getDate() + days);
          
          eventRequests = eventRequests.filter(event => {
            // Check both scheduledEventDate and desiredEventDate
            const eventDate = event.scheduledEventDate || event.desiredEventDate;
            if (!eventDate) return false;
            
            const eventDateObj = new Date(eventDate);
            eventDateObj.setHours(0, 0, 0, 0);
            
            return eventDateObj >= today && eventDateObj <= futureDate;
          });
        }
      }
      
      // Filter by status (comma-separated list)
      if (statusParam && statusParam !== 'all') {
        const statuses = statusParam.split(',').map(s => s.trim()).filter(Boolean);
        if (statuses.length > 0) {
          eventRequests = eventRequests.filter(event => statuses.includes(event.status));
        }
      }
      
      // Filter by "needs action" - events that need attention
      if (needsActionParam === 'true') {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const twoWeeksFromNow = new Date(today);
        twoWeeksFromNow.setDate(twoWeeksFromNow.getDate() + 14);
        
        eventRequests = eventRequests.filter(event => {
          // Include events in the next 14 days that need action
          const eventDate = event.scheduledEventDate || event.desiredEventDate;
          if (!eventDate) return true; // Events without dates need action
          
          const eventDateObj = new Date(eventDate);
          eventDateObj.setHours(0, 0, 0, 0);
          
          // Only include events in the next 14 days
          if (eventDateObj > twoWeeksFromNow) return false;
          
          // Events needing drivers
          const driversNeeded = event.driversNeeded || 0;
          const assignedDrivers = event.assignedDriverIds 
            ? (Array.isArray(event.assignedDriverIds) ? event.assignedDriverIds.length : 1)
            : 0;
          const needsDriver = driversNeeded > assignedDrivers;
          
          // Events needing speakers
          const speakersNeeded = event.speakersNeeded || 0;
          const assignedSpeakers = event.speakerDetails 
            ? (typeof event.speakerDetails === 'string' 
                ? Object.keys(JSON.parse(event.speakerDetails || '{}')).length 
                : Object.keys(event.speakerDetails || {}).length)
            : 0;
          const needsSpeaker = speakersNeeded > assignedSpeakers;
          
          // Events needing volunteers
          const volunteersNeeded = event.volunteersNeeded || 0;
          const assignedVolunteers = event.volunteerDetails
            ? (typeof event.volunteerDetails === 'string'
                ? Object.keys(JSON.parse(event.volunteerDetails || '{}')).length
                : Object.keys(event.volunteerDetails || {}).length)
            : 0;
          const needsVolunteer = volunteersNeeded > assignedVolunteers;
          
          // Events needing van driver
          const needsVanDriver = event.vanDriverNeeded && !event.assignedVanDriverId && !event.isDhlVan;
          
          // Events without confirmed dates (new/in_process)
          const needsDateConfirmation = (event.status === 'new' || event.status === 'in_process') && !event.isConfirmed;
          
          return needsDriver || needsSpeaker || needsVolunteer || needsVanDriver || needsDateConfirmation;
        });
      }
      
      // DEBUG: Log details about what we're returning
      const completedCount = eventRequests.filter(e => e.status === 'completed').length;
      logger.info(`📊 API returning ${eventRequests.length} filtered events (${completedCount} completed)`);
      
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

// Lightweight list endpoint - returns only fields needed for list/card view
// This reduces payload by 60-80% compared to full event data
router.get(
  '/list',
  isAuthenticated,
  requirePermission('EVENT_REQUESTS_VIEW'),
  async (req, res) => {
    try {
      // Parse query parameters for filtering (same as main endpoint)
      const daysParam = req.query.days as string | undefined;
      const statusParam = req.query.status as string | undefined;
      const needsActionParam = req.query.needsAction as string | undefined;

      let eventRequests = await storage.getAllEventRequests();

      // Apply same filters as main endpoint
      if (daysParam) {
        const days = parseInt(daysParam, 10);
        if (!isNaN(days) && days > 0) {
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          const futureDate = new Date(today);
          futureDate.setDate(futureDate.getDate() + days);

          eventRequests = eventRequests.filter(event => {
            const eventDate = event.scheduledEventDate || event.desiredEventDate;
            if (!eventDate) return false;
            const eventDateObj = new Date(eventDate);
            eventDateObj.setHours(0, 0, 0, 0);
            return eventDateObj >= today && eventDateObj <= futureDate;
          });
        }
      }

      if (statusParam && statusParam !== 'all') {
        const statuses = statusParam.split(',').map(s => s.trim()).filter(Boolean);
        if (statuses.length > 0) {
          eventRequests = eventRequests.filter(event => statuses.includes(event.status));
        }
      }

      if (needsActionParam === 'true') {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const twoWeeksFromNow = new Date(today);
        twoWeeksFromNow.setDate(twoWeeksFromNow.getDate() + 14);

        eventRequests = eventRequests.filter(event => {
          const eventDate = event.scheduledEventDate || event.desiredEventDate;
          if (!eventDate) return true;
          const eventDateObj = new Date(eventDate);
          eventDateObj.setHours(0, 0, 0, 0);
          if (eventDateObj > twoWeeksFromNow) return false;

          const driversNeeded = event.driversNeeded || 0;
          const assignedDrivers = event.assignedDriverIds
            ? (Array.isArray(event.assignedDriverIds) ? event.assignedDriverIds.length : 1)
            : 0;
          const needsDriver = driversNeeded > assignedDrivers;

          const speakersNeeded = event.speakersNeeded || 0;
          const assignedSpeakers = event.speakerDetails
            ? (typeof event.speakerDetails === 'string'
                ? Object.keys(JSON.parse(event.speakerDetails || '{}')).length
                : Object.keys(event.speakerDetails || {}).length)
            : 0;
          const needsSpeaker = speakersNeeded > assignedSpeakers;

          const volunteersNeeded = event.volunteersNeeded || 0;
          const assignedVolunteers = event.volunteerDetails
            ? (typeof event.volunteerDetails === 'string'
                ? Object.keys(JSON.parse(event.volunteerDetails || '{}')).length
                : Object.keys(event.volunteerDetails || {}).length)
            : 0;
          const needsVolunteer = volunteersNeeded > assignedVolunteers;

          const needsVanDriver = event.vanDriverNeeded && !event.assignedVanDriverId && !event.isDhlVan;
          const needsDateConfirmation = (event.status === 'new' || event.status === 'in_process') && !event.isConfirmed;

          return needsDriver || needsSpeaker || needsVolunteer || needsVanDriver || needsDateConfirmation;
        });
      }

      // Map to lightweight format - only fields needed for list/card display
      const lightweightEvents = eventRequests.map(event => ({
        // Identity
        id: event.id,

        // Organization basics
        organizationName: event.organizationName,
        organizationCategory: event.organizationCategory,
        department: event.department,

        // Contact (minimal)
        firstName: event.firstName,
        lastName: event.lastName,
        email: event.email,
        phone: event.phone,

        // Dates
        desiredEventDate: event.desiredEventDate,
        scheduledEventDate: event.scheduledEventDate,
        isConfirmed: event.isConfirmed,

        // Status & workflow
        status: event.status,
        statusChangedAt: event.statusChangedAt,
        assignedTo: event.assignedTo,
        nextAction: event.nextAction,

        // Location (for map/display)
        eventAddress: event.eventAddress,
        latitude: event.latitude,
        longitude: event.longitude,

        // Counts for badges
        estimatedSandwichCount: event.estimatedSandwichCount,
        actualSandwichCount: event.actualSandwichCount,
        volunteerCount: event.volunteerCount,
        actualAttendance: event.actualAttendance,

        // Staffing status (for "needs" indicators)
        driversNeeded: event.driversNeeded,
        assignedDriverIds: event.assignedDriverIds,
        selfTransport: event.selfTransport,
        speakersNeeded: event.speakersNeeded,
        assignedSpeakerIds: event.assignedSpeakerIds,
        volunteersNeeded: event.volunteersNeeded,
        assignedVolunteerIds: event.assignedVolunteerIds,
        vanDriverNeeded: event.vanDriverNeeded,
        assignedVanDriverId: event.assignedVanDriverId,
        isDhlVan: event.isDhlVan,
        tentativeDriverIds: event.tentativeDriverIds,

        // TSP contact for display
        tspContactAssigned: event.tspContactAssigned,

        // Toolkit status
        toolkitSent: event.toolkitSent,
        toolkitStatus: event.toolkitStatus,

        // Times for display
        eventStartTime: event.eventStartTime,
        eventEndTime: event.eventEndTime,
        pickupTime: event.pickupTime,
        pickupDateTime: event.pickupDateTime,

        // Tracking flags
        addedToOfficialSheet: event.addedToOfficialSheet,
        isUnresponsive: event.isUnresponsive,
        contactAttempts: event.contactAttempts,

        // Timestamps
        createdAt: event.createdAt,
        updatedAt: event.updatedAt,
      }));

      logger.info(`📋 List endpoint returning ${lightweightEvents.length} lightweight events`);
      res.json(lightweightEvents);
    } catch (error) {
      logger.error('Failed to fetch lightweight event list', error);
      res.status(500).json({ message: 'Failed to fetch event requests' });
    }
  }
);

// Status counts endpoint - lightweight endpoint for tab counts
router.get(
  '/status-counts',
  isAuthenticated,
  requirePermission('EVENT_REQUESTS_VIEW'),
  async (req, res) => {
    try {
      const eventRequests = await storage.getAllEventRequests();

      const counts = {
        all: eventRequests.length,
        new: 0,
        in_process: 0,
        scheduled: 0,
        completed: 0,
        declined: 0,
        postponed: 0,
        cancelled: 0,
      };

      for (const event of eventRequests) {
        const status = event.status as keyof typeof counts;
        if (status && status in counts && status !== 'all') {
          counts[status]++;
        }
      }

      res.json(counts);
    } catch (error) {
      logger.error('Failed to fetch status counts', error);
      res.status(500).json({ message: 'Failed to fetch status counts' });
    }
  }
);

// Search endpoint - server-side search across multiple fields
router.get(
  '/search',
  isAuthenticated,
  requirePermission('EVENT_REQUESTS_VIEW'),
  async (req, res) => {
    try {
      const searchQuery = (req.query.q as string || '').trim().toLowerCase();
      const statusParam = req.query.status as string | undefined;

      if (!searchQuery || searchQuery.length < 2) {
        return res.json([]);
      }

      let eventRequests = await storage.getAllEventRequests();

      // Filter by status first if provided
      if (statusParam && statusParam !== 'all') {
        const statuses = statusParam.split(',').map(s => s.trim()).filter(Boolean);
        if (statuses.length > 0) {
          eventRequests = eventRequests.filter(event => statuses.includes(event.status));
        }
      }

      // Search across multiple fields
      const searchResults = eventRequests.filter(event => {
        const searchableFields = [
          event.organizationName,
          event.firstName,
          event.lastName,
          event.email,
          event.phone,
          event.eventAddress,
          event.department,
          event.message,
          event.nextAction,
          String(event.id),
        ].filter(Boolean);

        return searchableFields.some(field =>
          field!.toLowerCase().includes(searchQuery)
        );
      });

      // Return lightweight format for search results
      const lightweightResults = searchResults.map(event => ({
        id: event.id,
        organizationName: event.organizationName,
        organizationCategory: event.organizationCategory,
        department: event.department,
        firstName: event.firstName,
        lastName: event.lastName,
        email: event.email,
        phone: event.phone,
        desiredEventDate: event.desiredEventDate,
        scheduledEventDate: event.scheduledEventDate,
        isConfirmed: event.isConfirmed,
        status: event.status,
        statusChangedAt: event.statusChangedAt,
        assignedTo: event.assignedTo,
        nextAction: event.nextAction,
        eventAddress: event.eventAddress,
        latitude: event.latitude,
        longitude: event.longitude,
        estimatedSandwichCount: event.estimatedSandwichCount,
        actualSandwichCount: event.actualSandwichCount,
        volunteerCount: event.volunteerCount,
        actualAttendance: event.actualAttendance,
        driversNeeded: event.driversNeeded,
        assignedDriverIds: event.assignedDriverIds,
        selfTransport: event.selfTransport,
        speakersNeeded: event.speakersNeeded,
        assignedSpeakerIds: event.assignedSpeakerIds,
        volunteersNeeded: event.volunteersNeeded,
        assignedVolunteerIds: event.assignedVolunteerIds,
        vanDriverNeeded: event.vanDriverNeeded,
        assignedVanDriverId: event.assignedVanDriverId,
        isDhlVan: event.isDhlVan,
        tentativeDriverIds: event.tentativeDriverIds,
        tspContactAssigned: event.tspContactAssigned,
        toolkitSent: event.toolkitSent,
        toolkitStatus: event.toolkitStatus,
        eventStartTime: event.eventStartTime,
        eventEndTime: event.eventEndTime,
        pickupTime: event.pickupTime,
        pickupDateTime: event.pickupDateTime,
        addedToOfficialSheet: event.addedToOfficialSheet,
        isUnresponsive: event.isUnresponsive,
        contactAttempts: event.contactAttempts,
        createdAt: event.createdAt,
        updatedAt: event.updatedAt,
      }));

      logger.info(`🔍 Search for "${searchQuery}" returned ${lightweightResults.length} results`);
      res.json(lightweightResults);
    } catch (error) {
      logger.error('Failed to search event requests', error);
      res.status(500).json({ message: 'Failed to search event requests' });
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

// Diagnostic endpoint to check if event exists in database
// This bypasses the storage wrapper to directly query the database
router.get(
  '/:id(\\d+)/diagnose',
  isAuthenticated,
  requirePermission('EVENT_REQUESTS_VIEW'),
  async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      logger.info(`[DIAGNOSE] Checking event ${id}`);

      // Method 1: Storage wrapper (normal method)
      const storageResult = await storage.getEventRequest(id);

      // Method 2: Direct database query
      const { db } = await import('../db');
      const { eventRequests } = await import('@shared/schema');
      const { eq } = await import('drizzle-orm');
      const [directResult] = await db.select().from(eventRequests).where(eq(eventRequests.id, id));

      const diagnosis = {
        requestedId: id,
        storageFound: !!storageResult,
        directDbFound: !!directResult,
        storageSummary: storageResult ? {
          id: storageResult.id,
          organizationName: storageResult.organizationName,
          status: storageResult.status,
          deletedAt: storageResult.deletedAt,
        } : null,
        directDbSummary: directResult ? {
          id: directResult.id,
          organizationName: directResult.organizationName,
          status: directResult.status,
          deletedAt: directResult.deletedAt,
        } : null,
        mismatch: !!storageResult !== !!directResult,
      };

      logger.info(`[DIAGNOSE] Results:`, JSON.stringify(diagnosis, null, 2));
      res.json(diagnosis);
    } catch (error) {
      logger.error('[DIAGNOSE] Error:', error);
      res.status(500).json({ error: String(error) });
    }
  }
);

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

      // Geocode address asynchronously (don't block response)
      if (validatedData.eventAddress) {
        geocodeAddress(validatedData.eventAddress)
          .then(async (coords) => {
            if (coords) {
              await storage.updateEventRequest(newEventRequest.id!, {
                latitude: coords.latitude,
                longitude: coords.longitude,
              });
              logger.log(`✅ Geocoded event ${newEventRequest.id}: ${validatedData.eventAddress}`);
            }
          })
          .catch((error) => {
            logger.error(`Failed to geocode event ${newEventRequest.id}:`, error);
          });
      }

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

      // Build the contact log entry template (attempt number will be calculated in SQL)
      const timestamp = new Date().toISOString();
      const userName = req.user?.firstName && req.user?.lastName
        ? `${req.user.firstName} ${req.user.lastName}`
        : req.user?.email || 'System';

      // Build dynamic SET clauses - only update fields that are actually provided
      const setFields = [
        sql`contact_attempts_log = COALESCE(er.contact_attempts_log, '[]'::jsonb) || 
            jsonb_build_array(
              jsonb_build_object(
                'attemptNumber', locked.next_attempt_number,
                'timestamp', ${timestamp},
                'method', ${validatedData.communicationMethod},
                'outcome', 'Got response',
                'notes', ${validatedData.notes || 'Contact completed'},
                'createdBy', ${req.user?.id || 'system'},
                'createdByName', ${userName}
              )
            )`,
        sql`contacted_at = ${new Date()}`,
        sql`completed_by_user_id = ${req.user?.id}`,
        sql`communication_method = ${validatedData.communicationMethod}`,
        sql`status = 'contact_completed'`,
        sql`updated_at = NOW()`,
      ];

      // Only add optional field updates if they're provided
      if (validatedData.eventAddress !== undefined) {
        setFields.push(sql`event_address = ${validatedData.eventAddress}`);
      }
      if (validatedData.estimatedSandwichCount !== undefined) {
        setFields.push(sql`estimated_sandwich_count = ${validatedData.estimatedSandwichCount}`);
      }
      if (validatedData.hasRefrigeration !== undefined) {
        setFields.push(sql`has_refrigeration = ${validatedData.hasRefrigeration}`);
      }
      if (validatedData.notes !== undefined) {
        setFields.push(sql`contact_completion_notes = ${validatedData.notes}`);
      }

      // Atomically update with row-level locking using CTE to prevent race conditions
      await db.execute(
        sql`WITH locked AS (
              SELECT 
                id,
                COALESCE(
                  (SELECT MAX((entry->>'attemptNumber')::int) 
                   FROM jsonb_array_elements(COALESCE(contact_attempts_log, '[]'::jsonb)) AS entry),
                  0
                ) + 1 AS next_attempt_number
              FROM event_requests
              WHERE id = ${id}
              FOR UPDATE
            )
            UPDATE event_requests er
            SET ${sql.join(setFields, sql`, `)}
            FROM locked
            WHERE er.id = locked.id`
      );

      // Fetch the updated event request for response and audit logging
      const updatedEventRequest = await storage.getEventRequestById(id);

      // REMOVED: No longer updating Google Sheets - one-way sync only

      if (!updatedEventRequest) {
        return res.status(404).json({ message: 'Event request not found' });
      }

      // Geocode address asynchronously if it was updated and doesn't have coordinates
      if (validatedData.eventAddress && (!updatedEventRequest.latitude || !updatedEventRequest.longitude)) {
        geocodeAddress(validatedData.eventAddress)
          .then(async (coords) => {
            if (coords) {
              await storage.updateEventRequest(id, {
                latitude: coords.latitude,
                longitude: coords.longitude,
              });
              logger.log(`✅ Geocoded event ${id}: ${validatedData.eventAddress}`);
            }
          })
          .catch((error) => {
            logger.error(`Failed to geocode event ${id}:`, error);
          });
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
        // Convert string date to proper Date object using timezone-safe utility
        // IMPORTANT: Do NOT use 'Z' suffix - it causes dates to shift by one day!
        updates.desiredEventDate = parseDateOnly(updates.desiredEventDate);
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

      // Build the follow-up log entry template (attempt number will be calculated in SQL)
      const timestamp = new Date().toISOString();
      const userName = req.user?.firstName && req.user?.lastName
        ? `${req.user.firstName} ${req.user.lastName}`
        : req.user?.email || 'System';
      const outcome = method === 'call' ? 'Completed call' : 'Sent email';

      // Build dynamic SET clauses - only update fields that are actually provided
      const setFields = [
        sql`contact_attempts_log = COALESCE(er.contact_attempts_log, '[]'::jsonb) || 
            jsonb_build_array(
              jsonb_build_object(
                'attemptNumber', locked.next_attempt_number,
                'timestamp', ${timestamp},
                'method', ${method},
                'outcome', ${outcome},
                'notes', ${notes || `Follow-up ${method} completed`},
                'createdBy', ${req.user?.id || 'system'},
                'createdByName', ${userName}
              )
            )`,
        sql`follow_up_method = ${method}`,
        sql`follow_up_date = NOW()`,
        sql`status = 'in_process'`,
        sql`updated_at = NOW()`,
      ];

      // Only add optional field updates if they're provided
      if (updates.desiredEventDate !== undefined && updates.desiredEventDate !== null) {
        setFields.push(sql`desired_event_date = ${updates.desiredEventDate}`);
      }
      if (method === 'call' && updatedEmail) {
        setFields.push(sql`email = ${updatedEmail}`);
        setFields.push(sql`updated_email = ${updatedEmail}`);
      }
      if (updates.followUpNotes !== undefined && updates.followUpNotes !== null) {
        setFields.push(sql`follow_up_notes = ${updates.followUpNotes}`);
      }

      // Atomically update with row-level locking using CTE to prevent race conditions
      await db.execute(
        sql`WITH locked AS (
              SELECT 
                id,
                COALESCE(
                  (SELECT MAX((entry->>'attemptNumber')::int) 
                   FROM jsonb_array_elements(COALESCE(contact_attempts_log, '[]'::jsonb)) AS entry),
                  0
                ) + 1 AS next_attempt_number
              FROM event_requests
              WHERE id = ${id}
              FOR UPDATE
            )
            UPDATE event_requests er
            SET ${sql.join(setFields, sql`, `)}
            FROM locked
            WHERE er.id = locked.id`
      );

      // Fetch the updated event request for response and audit logging
      const updatedEventRequest = await storage.getEventRequestById(id);

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

      // Geocode address asynchronously if it was updated and doesn't have coordinates
      if (processedUpdates.eventAddress && (!updatedEventRequest.latitude || !updatedEventRequest.longitude)) {
        geocodeAddress(processedUpdates.eventAddress)
          .then(async (coords) => {
            if (coords) {
              await storage.updateEventRequest(id, {
                latitude: coords.latitude,
                longitude: coords.longitude,
              });
              logger.log(`✅ Geocoded event ${id}: ${processedUpdates.eventAddress}`);
            }
          })
          .catch((error) => {
            logger.error(`Failed to geocode event ${id}:`, error);
          });
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

      if (isNaN(id)) {
        logger.error(`[PATCH /:id] Invalid ID: ${req.params.id}`);
        return res.status(400).json({ message: 'Invalid event request ID', id: req.params.id });
      }

      logger.info(`[PATCH /:id] Request received for event ${id}, path: ${req.path}, originalUrl: ${req.originalUrl}`);
      logger.info(`[PATCH /:id] Updates:`, JSON.stringify(updates, null, 2));
      
      // DEBUG: Log department field specifically
      logger.info(`[PATCH /:id] DEPARTMENT DEBUG: department in updates = "${updates.department}", type = ${typeof updates.department}`);

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
      logger.info(`[PATCH /:id] About to fetch event ${id} from storage`);
      const originalEvent = await storage.getEventRequestById(id);
      logger.info(`[PATCH /:id] Storage returned:`, originalEvent ? `Event found (${originalEvent.organizationName})` : 'null/undefined');

      if (!originalEvent) {
        logger.error(`[PATCH /:id] Event request ${id} not found in database`);
        logger.error(`[PATCH /:id] Attempted update fields:`, Object.keys(updates).join(', '));
        logger.error(`[PATCH /:id] User: ${req.user?.id} (${req.user?.email})`);
        logger.error(`[PATCH /:id] Request body preview:`, JSON.stringify(updates).substring(0, 200));

        // Try direct database check to see if event exists but is soft-deleted
        try {
          const { db } = await import('../db');
          const { eventRequests } = await import('@shared/schema');
          const { eq } = await import('drizzle-orm');
          const [directCheck] = await db.select().from(eventRequests).where(eq(eventRequests.id, id));
          if (directCheck) {
            logger.error(`[PATCH /:id] DIAGNOSTIC: Event ${id} EXISTS in DB but storage returned null!`);
            logger.error(`[PATCH /:id] DIAGNOSTIC: deletedAt = ${directCheck.deletedAt}, status = ${directCheck.status}`);
          } else {
            logger.error(`[PATCH /:id] DIAGNOSTIC: Event ${id} truly does NOT exist in database`);
          }
        } catch (diagError) {
          logger.error(`[PATCH /:id] DIAGNOSTIC check failed:`, diagError);
        }

        return res.status(404).json({
          message: 'Event request not found',
          eventId: id,
          error: 'EVENT_NOT_FOUND',
          details: 'The event request may have been deleted or the ID is incorrect. Please refresh the page and try again.'
        });
      }

      // Process pickup time fields for data migration
      const pickupProcessedUpdates = processPickupTimeFields(updates, originalEvent);

      // Process timestamp fields to ensure they're proper Date objects
      const processedUpdates = { ...pickupProcessedUpdates };

      // Convert timestamp fields that might come as strings to Date objects
      // NOTE: pickupDateTime is intentionally excluded - it should remain as a local datetime string
      // to avoid timezone conversion issues (keep as YYYY-MM-DDTHH:MM:SS format)
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
            // Use timezone-safe date parsing utility
            // IMPORTANT: Do NOT use 'Z' suffix - it causes dates to shift by one day!
            const dateValue = parseDateOnly(dateString);

            // Check if the date is valid
            if (!dateValue) {
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
      
      const usesDhlVan = processedUpdates.isDhlVan !== undefined
        ? processedUpdates.isDhlVan === true
        : (originalEvent as any).isDhlVan === true;
      const hasAssignedVanDriver = usesDhlVan
        || (processedUpdates.assignedVanDriverId !== undefined && processedUpdates.assignedVanDriverId !== null && processedUpdates.assignedVanDriverId !== '')
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
      logger.info(`[PATCH /:id] Saving to database. Processed updates:`, JSON.stringify(processedUpdates, null, 2));
      
      // DEBUG: Log department field specifically before save
      logger.info(`[PATCH /:id] DEPARTMENT DEBUG: Before save, processedUpdates.department = "${processedUpdates.department}", type = ${typeof processedUpdates.department}`);

      const updatedEventRequest = await storage.updateEventRequest(id, {
        ...processedUpdates,
        updatedAt: new Date(),
      });

      logger.info(`[PATCH /:id] Database update result:`, updatedEventRequest ? 'Success' : 'Not found');
      if (updatedEventRequest) {
        logger.info(`[PATCH /:id] Updated desiredEventDate: ${updatedEventRequest.desiredEventDate}`);
      }

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
      // NOTE: pickupDateTime is intentionally excluded - it should remain as a local datetime string
      // to avoid timezone conversion issues (keep as YYYY-MM-DDTHH:MM:SS format)
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
        'scheduledEventDate',
        'nextActionUpdatedAt',
      ];
      
      timestampFields.forEach((field) => {
        if (
          processedUpdates[field] &&
          typeof processedUpdates[field] === 'string'
        ) {
          try {
            const dateString = processedUpdates[field] as string;
            // Use timezone-safe date parsing utility
            // IMPORTANT: Do NOT use 'Z' suffix - it causes dates to shift by one day!
            const dateValue = parseDateOnly(dateString);

            // Check if the date is valid
            if (!dateValue) {
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
        'isDhlVan',
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

      // Keep van-related flags in sync when transport changes
      if (processedUpdates.selfTransport === true) {
        processedUpdates.vanDriverNeeded = false;
        processedUpdates.assignedVanDriverId = null;
        processedUpdates.isDhlVan = false;
      }
      if (processedUpdates.vanDriverNeeded === false) {
        processedUpdates.isDhlVan = false;
      }

      // Process comprehensive scheduling data if status is scheduled
      if (processedUpdates.status === 'scheduled') {

        // Process sandwich types if provided
        if (processedUpdates.sandwichTypes) {
          if (typeof processedUpdates.sandwichTypes === 'string') {
            const parseResult = safeJsonParse(
              processedUpdates.sandwichTypes,
              [],  // Default to empty array
              'sandwichTypes field'
            );

            if (!parseResult.success) {
              logger.error('Failed to parse sandwichTypes', {
                error: parseResult.error,
                value: processedUpdates.sandwichTypes.substring(0, 100)
              });
              return res.status(400).json({
                error: 'Invalid sandwichTypes: must be valid JSON array.'
              });
            }

            processedUpdates.sandwichTypes = parseResult.data;
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
      
      const putUsesDhlVan = processedUpdates.isDhlVan !== undefined
        ? processedUpdates.isDhlVan === true
        : (originalEvent as any).isDhlVan === true;
      const putHasAssignedVanDriver = putUsesDhlVan
        || (processedUpdates.assignedVanDriverId !== undefined && processedUpdates.assignedVanDriverId !== null && processedUpdates.assignedVanDriverId !== '')
        || (processedUpdates.assignedVanDriverId === undefined && originalEvent.assignedVanDriverId !== null && originalEvent.assignedVanDriverId !== '');
      
      const putTotalAssignedDrivers = putAssignedRegularDrivers + (putHasAssignedVanDriver ? 1 : 0);
      
      // If driversNeeded is being manually updated, ensure it's not less than assigned drivers
      if (processedUpdates.driversNeeded !== undefined) {
        if (processedUpdates.driversNeeded < putTotalAssignedDrivers) {
          processedUpdates.driversNeeded = putTotalAssignedDrivers;
        }
      }
      
      // Auto-adjust driversNeeded when assignments change (if assignments exceed current need)
      if (processedUpdates.assignedDriverIds !== undefined || processedUpdates.assignedVanDriverId !== undefined || processedUpdates.isDhlVan !== undefined) {
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

      // Geocode address asynchronously if it was updated and doesn't have coordinates
      if (processedUpdates.eventAddress && (!updatedEventRequest.latitude || !updatedEventRequest.longitude)) {
        geocodeAddress(processedUpdates.eventAddress)
          .then(async (coords) => {
            if (coords) {
              await storage.updateEventRequest(id, {
                latitude: coords.latitude,
                longitude: coords.longitude,
              });
              logger.log(`✅ Geocoded event ${id}: ${processedUpdates.eventAddress}`);
            }
          })
          .catch((error) => {
            logger.error(`Failed to geocode event ${id}:`, error);
          });
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

        // Add contact log entry when moved to in_process (toolkit sent)
        if (updatedEventRequest.status === 'in_process' && originalEvent.status !== 'in_process') {
          const existingLog = Array.isArray(updatedEventRequest.contactAttemptsLog)
            ? updatedEventRequest.contactAttemptsLog
            : [];
          const nextAttemptNumber = existingLog.length > 0
            ? Math.max(...existingLog.map((a: any) => a.attemptNumber || 0)) + 1
            : 1;

          const toolkitDate = updatedEventRequest.toolkitSentDate || new Date();
          const toolkitLogEntry = {
            attemptNumber: nextAttemptNumber,
            timestamp: toolkitDate.toISOString(),
            method: 'email',
            outcome: 'Toolkit Sent',
            notes: `Event moved to In Process${updatedEventRequest.toolkitSent ? ' - Toolkit sent' : ''}`,
            createdBy: req.user?.id || 'system',
            createdByName: req.user?.firstName && req.user?.lastName
              ? `${req.user.firstName} ${req.user.lastName}`
              : req.user?.email || 'System',
          };

          await storage.updateEventRequest(id, {
            contactAttemptsLog: [...existingLog, toolkitLogEntry],
          });
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

      const deleted = await storage.deleteEventRequest(id, req.user?.id);

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

// Restore (undo delete) event request
router.post(
  '/:id/restore',
  isAuthenticated,
  requirePermission('EVENT_REQUESTS_DELETE_CARD'), // Same permission as delete
  async (req, res) => {
    try {
      const id = parseInt(req.params.id);

      const restored = await storage.restoreEventRequest(id);

      if (!restored) {
        return res.status(404).json({ message: 'Event request not found or not deleted' });
      }

      // Get the restored event for audit logging
      const restoredEvent = await storage.getEventRequestById(id);

      // Log the restoration
      if (restoredEvent) {
        await AuditLogger.logEventRequestChange(
          id.toString(),
          null,
          restoredEvent,
          {
            userId: req.user?.id,
            ipAddress: req.ip || req.connection?.remoteAddress,
            userAgent: req.get('User-Agent'),
            sessionId: req.session?.id || req.sessionID,
          },
          { actionType: 'RESTORE' }
        );
      }

      await logActivity(
        req,
        res,
        'EVENT_REQUESTS_RESTORE',
        `Restored event request: ${id}`
      );

      res.json({ message: 'Event request restored successfully', eventRequest: restoredEvent });
    } catch (error) {
      logger.error('Error restoring event request:', error);
      res.status(500).json({ message: 'Failed to restore event request' });
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
  requirePermission('EVENT_REQUESTS_SYNC'),
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
  requirePermission('EVENT_REQUESTS_SYNC'),
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

// Get sync status and health check
router.get(
  '/sync/status',
  isAuthenticated,
  requirePermission('EVENT_REQUESTS_VIEW'),
  async (req, res) => {
    try {
      const { getBackgroundSyncService } = await import('../background-sync-service');
      const syncService = getBackgroundSyncService();
      
      if (!syncService) {
        return res.json({
          running: false,
          message: 'Background sync service not initialized',
        });
      }

      const status = syncService.getStatus();
      return res.json({
        running: status.isRunning,
        nextSyncIn: status.nextSyncIn,
        lastSuccessfulSync: status.lastSuccessfulSync,
        minutesSinceLastSuccess: status.minutesSinceLastSuccess,
        consecutiveFailures: status.consecutiveFailures,
        isHealthy: status.isHealthy,
        message: status.isRunning 
          ? (status.isHealthy 
              ? 'Background sync is running and healthy' 
              : `Background sync is running but stale (${status.minutesSinceLastSuccess} minutes since last success)`)
          : 'Background sync is not running',
      });
    } catch (error) {
      logger.error('Error getting sync status:', error);
      return res.status(500).json({
        running: false,
        message: 'Failed to get sync status',
        error: error instanceof Error ? error.message : 'Unknown error',
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
      tentativeDriverIds,
      driverPickupTime,
      driverNotes,
      driversArranged,
      // Van driver fields
      vanDriverNeeded,
      assignedVanDriverId,
      customVanDriverName,
      vanDriverNotes,
      isDhlVan,
    } = req.body;

    // Validate that the event exists first
    const existingEvent = await storage.getEventRequestById(eventId);
    if (!existingEvent) {
      return res.status(404).json({ error: 'Event request not found' });
    }

    // Update the event with driver assignments
    const updateData: Partial<EventRequest> = {
      assignedDriverIds: assignedDriverIds || [],
      tentativeDriverIds: tentativeDriverIds !== undefined ? (tentativeDriverIds || []) : undefined,
      driverPickupTime: driverPickupTime || null,
      driverNotes: driverNotes || null,
      driversArranged:
        driversArranged !== undefined
          ? driversArranged
          : assignedDriverIds && assignedDriverIds.length > 0,
    };

    // Only include tentativeDriverIds if it was actually provided in the request
    if (tentativeDriverIds === undefined) {
      delete updateData.tentativeDriverIds;
    }

    // Add van driver fields if provided
    if (vanDriverNeeded !== undefined)
      updateData.vanDriverNeeded = vanDriverNeeded;
    if (assignedVanDriverId !== undefined)
      updateData.assignedVanDriverId = assignedVanDriverId;
    if (customVanDriverName !== undefined)
      updateData.customVanDriverName = customVanDriverName;
    if (vanDriverNotes !== undefined)
      updateData.vanDriverNotes = vanDriverNotes;
    if (isDhlVan !== undefined)
      updateData.isDhlVan = !!isDhlVan;
    if (vanDriverNeeded === false) {
      updateData.isDhlVan = false;
      if (assignedVanDriverId === undefined) {
        updateData.assignedVanDriverId = null;
      }
    }

    // Validate and auto-adjust driversNeeded based on assignments
    const regularDriverCount = Array.isArray(assignedDriverIds) ? assignedDriverIds.length : 0;
    
    // Check if van driver is assigned (either being set now or already exists)
    const dhlVan =
      isDhlVan !== undefined ? !!isDhlVan : (existingEvent as any).isDhlVan === true;
    const hasVanDriver = dhlVan ||
      (assignedVanDriverId !== undefined && assignedVanDriverId !== null && assignedVanDriverId !== '')
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

// Add pre-event flag to an event
router.post('/:id/flags', isAuthenticated, async (req, res) => {
  try {
    const eventId = parseInt(req.params.id);
    const { type, message, createdBy, createdByName, dueDate } = req.body;

    if (!type || !message) {
      return res.status(400).json({ error: 'Type and message are required' });
    }

    // Fetch current event
    const existingEvent = await storage.getEventRequestById(eventId);
    if (!existingEvent) {
      return res.status(404).json({ error: 'Event request not found' });
    }

    // Get current flags or initialize empty array
    const currentFlags = existingEvent.preEventFlags || [];

    // Create new flag
    const newFlag = {
      id: `flag-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type,
      message,
      createdAt: new Date().toISOString(),
      createdBy,
      createdByName,
      resolvedAt: null,
      resolvedBy: null,
      resolvedByName: null,
      dueDate: dueDate || null,
    };

    // Add flag to array
    const updatedFlags = [...currentFlags, newFlag];

    // Update event
    const updatedEvent = await storage.updateEventRequest(eventId, {
      preEventFlags: updatedFlags,
    });

    // Log activity
    await logActivity(
      req,
      res,
      'EVENT_FLAGS_ADD',
      `Added ${type} flag to event: ${existingEvent.organizationName}`
    );

    res.json(updatedEvent);
  } catch (error) {
    logger.error('Error adding pre-event flag:', error);
    res.status(500).json({ error: 'Failed to add pre-event flag' });
  }
});

// Resolve a pre-event flag
router.patch('/:id/flags/:flagId/resolve', isAuthenticated, async (req, res) => {
  try {
    const eventId = parseInt(req.params.id);
    const { flagId } = req.params;
    const { resolvedBy, resolvedByName } = req.body;

    // Fetch current event
    const existingEvent = await storage.getEventRequestById(eventId);
    if (!existingEvent) {
      return res.status(404).json({ error: 'Event request not found' });
    }

    // Get current flags
    const currentFlags = existingEvent.preEventFlags || [];

    // Find and update the flag
    const updatedFlags = currentFlags.map(flag => {
      if (flag.id === flagId) {
        return {
          ...flag,
          resolvedAt: new Date().toISOString(),
          resolvedBy,
          resolvedByName,
        };
      }
      return flag;
    });

    // Update event
    const updatedEvent = await storage.updateEventRequest(eventId, {
      preEventFlags: updatedFlags,
    });

    // Log activity
    await logActivity(
      req,
      res,
      'EVENT_FLAGS_RESOLVE',
      `Resolved flag for event: ${existingEvent.organizationName}`
    );

    res.json(updatedEvent);
  } catch (error) {
    logger.error('Error resolving pre-event flag:', error);
    res.status(500).json({ error: 'Failed to resolve pre-event flag' });
  }
});

// Delete a pre-event flag
router.delete('/:id/flags/:flagId', isAuthenticated, async (req, res) => {
  try {
    const eventId = parseInt(req.params.id);
    const { flagId } = req.params;

    // Fetch current event
    const existingEvent = await storage.getEventRequestById(eventId);
    if (!existingEvent) {
      return res.status(404).json({ error: 'Event request not found' });
    }

    // Get current flags and filter out the one to delete
    const currentFlags = existingEvent.preEventFlags || [];
    const updatedFlags = currentFlags.filter(flag => flag.id !== flagId);

    // Update event
    const updatedEvent = await storage.updateEventRequest(eventId, {
      preEventFlags: updatedFlags,
    });

    // Log activity
    await logActivity(
      req,
      res,
      'EVENT_FLAGS_DELETE',
      `Deleted flag from event: ${existingEvent.organizationName}`
    );

    res.json(updatedEvent);
  } catch (error) {
    logger.error('Error deleting pre-event flag:', error);
    res.status(500).json({ error: 'Failed to delete pre-event flag' });
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

      // Add contact attempt log entry for toolkit sent
      const existingLog = Array.isArray(updatedEventRequest.contactAttemptsLog)
        ? updatedEventRequest.contactAttemptsLog
        : [];
      const nextAttemptNumber = existingLog.length > 0
        ? Math.max(...existingLog.map((a: any) => a.attemptNumber || 0)) + 1
        : 1;

      const toolkitLogEntry = {
        attemptNumber: nextAttemptNumber,
        timestamp: sentDate.toISOString(),
        method: 'email',
        outcome: 'Toolkit Sent',
        notes: `Toolkit sent and event moved to In Process`,
        createdBy: req.user?.id || 'system',
        createdByName: req.user?.firstName && req.user?.lastName
          ? `${req.user.firstName} ${req.user.lastName}`
          : req.user?.email || 'System',
      };

      await storage.updateEventRequest(id, {
        contactAttemptsLog: [...existingLog, toolkitLogEntry],
      });

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

// Get all event volunteers (for admin search/filtering)
router.get('/all-volunteers', isAuthenticated, async (req, res) => {
  try {
    const allVolunteers = await storage.getAllEventVolunteers();
    res.json(allVolunteers);
  } catch (error) {
    logger.error('Error fetching all event volunteers:', error);
    res.status(500).json({ error: 'Failed to fetch all event volunteers' });
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
          
          // Only send SMS if user has confirmed SMS opt-in for the 'events' campaign
          if (smsConsent.status === 'confirmed' && smsConsent.enabled && smsConsent.phoneNumber && smsConsent.campaignType === 'events') {
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

// Helper function to convert camelCase/snake_case field names to human-readable format
const formatFieldName = (fieldName: string): string => {
  return fieldName
    .replace(/_/g, ' ')
    .replace(/([A-Z])/g, ' $1')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
};

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

    // Filter for event_requests table by default, but allow users table entries for user management
    const tableFilter = req.query.tableName as string;
    if (tableFilter === 'users' || tableFilter === 'user_management') {
      // Allow both users and user_management for backward compatibility
      conditions.push(
        or(
          eq(auditLogs.tableName, 'users'),
          eq(auditLogs.tableName, 'user_management')
        )
      );
    } else {
      // Default to event_requests table
      conditions.push(eq(auditLogs.tableName, 'event_requests'));
    }

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
    // Filter out internal tracking entries that aren't useful for end users
    const enrichedLogs = rawLogs
      .filter((log) => {
        const action = String(getField(log, 'action', 'action'));
        // Skip internal tracking entries that are redundant or not user-facing
        return action !== 'EVENT_REQUEST_SIGNIFICANT_CHANGE';
      })
      .map((log) => {
      const recordId = String(getField(log, 'recordId', 'record_id'));
      const userId = String(getField(log, 'userId', 'user_id'));

      let newData: Partial<EventRequest> | null = null;
      let oldData: Partial<EventRequest> | null = null;

      // Safely parse newData with error handling
      const newDataField = getField(log, 'newData', 'new_data');
      if (newDataField) {
        const parseResult = safeJsonParse(String(newDataField), {}, 'event audit log newData');
        newData = parseResult.data;
      }

      // Safely parse oldData with error handling
      const oldDataField = getField(log, 'oldData', 'old_data');
      if (oldDataField) {
        const parseResult = safeJsonParse(String(oldDataField), {}, 'event audit log oldData');
        oldData = parseResult.data;
      }

      const user = userMap.get(userId); // User who made the change
      const event = eventMap.get(recordId);
      const tableName = String(getField(log, 'tableName', 'table_name'));
      
      // For user management logs, get the user being updated
      let updatedUser = null;
      if (tableName === 'users' || tableName === 'user_management') {
        updatedUser = userMap.get(recordId) || newData || oldData;
      }

      // Extract follow-up context and audit metadata from newData or oldData
      let followUpMethod = null;
      let followUpAction = null;
      let notes = null;
      let actionDescription = '';
      let changeDescription = '';
      let statusChange = null;

      // Extract change metadata from _auditMetadata if available
      const metadata = newData?._auditMetadata || oldData?._auditMetadata;
      if (metadata) {
        // Always prefer the summary - it's human-readable
        if (metadata.summary) {
          changeDescription = metadata.summary;
        } else if (metadata.changes && Array.isArray(metadata.changes)) {
          // Fallback: Build a user-friendly summary from the metadata changes
          // Only show friendly names, not raw field data
          const changeDescriptions = metadata.changes
            .slice(0, 3)
            .map((change: any) => {
              const fieldName = change.friendlyName || change.fieldDisplayName || change.fieldName || change.field;
              // Apply transformation as final fallback if field name looks raw (camelCase or snake_case)
              return fieldName && (fieldName.includes('_') || /[a-z][A-Z]/.test(fieldName)) 
                ? formatFieldName(fieldName) 
                : fieldName;
            });
          if (changeDescriptions.length > 0) {
            const count = metadata.changes.length;
            if (count === 1) {
              changeDescription = `Updated ${changeDescriptions[0]}`;
            } else if (count === 2) {
              changeDescription = `Updated ${changeDescriptions[0]} and ${changeDescriptions[1]}`;
            } else if (count === 3) {
              changeDescription = `Updated ${changeDescriptions[0]}, ${changeDescriptions[1]}, and ${changeDescriptions[2]}`;
            } else {
              changeDescription = `Updated ${changeDescriptions[0]}, ${changeDescriptions[1]}, ${changeDescriptions[2]}, and ${count - 3} more field${count - 3 === 1 ? '' : 's'}`;
            }
          }
        }
      }

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
        
        // Only override changeDescription if we don't already have one from metadata
        if (!changeDescription) {
          changeDescription = dataWithContext._auditMetadata?.changeDescription || 
                             dataWithContext.changeDescription || '';
        }
        
        // Extract status change information
        statusChange = dataWithContext._auditMetadata?.statusChange || 
                      dataWithContext.statusChange || null;

        // If we have both old and new data, try to determine status change
        if (newData && oldData && newData.status !== oldData.status) {
          statusChange = `${oldData.status || 'unknown'} → ${newData.status || 'unknown'}`;
        }
      }

      // For user management entries, show the updated user's name instead of organization/contact
      let organizationName = 'Unknown Organization';
      let contactName = 'Unknown Contact';
      
      if (tableName === 'users' || tableName === 'user_management') {
        // This is a user profile update - show the updated user's info
        const displayName = updatedUser?.displayName ||
                          (updatedUser?.firstName && updatedUser?.lastName 
                            ? `${updatedUser.firstName} ${updatedUser.lastName}`.trim()
                            : updatedUser?.email?.split('@')[0] ||
                              updatedUser?.email ||
                              'Unknown User');
        organizationName = displayName;
        contactName = updatedUser?.email || updatedUser?.preferredEmail || '';
      } else {
        // Event request entry - use existing logic
        organizationName =
          event?.organizationName ||
          oldData?.organizationName ||
          newData?.organizationName ||
          'Unknown Organization';
        contactName = event
          ? `${event.firstName || ''} ${event.lastName || ''}`.trim()
          : oldData
            ? `${oldData.firstName || ''} ${oldData.lastName || ''}`.trim()
            : newData
              ? `${newData.firstName || ''} ${newData.lastName || ''}`.trim()
              : 'Unknown Contact';
      }

      // Improve user display for system actions
      let displayUserEmail = user?.email || user?.preferredEmail || '';
      if (!displayUserEmail && userId) {
        // Check if this is a system/automated action
        if (userId === 'google_sheets_sync' || userId === 'system' || userId.toLowerCase().includes('sync')) {
          displayUserEmail = 'Automated Import';
        } else {
          displayUserEmail = userId;
        }
      }
      if (!displayUserEmail) {
        displayUserEmail = 'System';
      }

      return {
        id: getField(log, 'id', 'id'),
        action: getField(log, 'action', 'action'),
        eventId: recordId,
        timestamp: getField(log, 'timestamp', 'timestamp'),
        userId,
        userEmail: displayUserEmail,
        organizationName,
        contactName,
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
        // Include table name for filtering
        tableName,
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
    const { assignedRecipientIds, recipientAllocations } = req.body;

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

    // Build update data
    const updateData: Record<string, unknown> = {
      updatedAt: new Date(),
    };

    // Update assignedRecipientIds if provided
    if (assignedRecipientIds !== undefined) {
      updateData.assignedRecipientIds = assignedRecipientIds || [];
    }

    // Update recipientAllocations if provided
    if (recipientAllocations !== undefined) {
      updateData.recipientAllocations = recipientAllocations || [];
    }

    // Update the event with recipient assignment
    const updatedEventRequest = await storage.updateEventRequest(eventId, updateData);

    if (!updatedEventRequest) {
      return res.status(404).json({ error: 'Failed to update event request' });
    }

    await logActivity(
      req,
      res,
      'EVENT_REQUESTS_EDIT',
      `Updated recipient assignments for event request: ${eventId}`,
      { recipientIds: assignedRecipientIds, recipientAllocations }
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

// AI Date Suggestion - Analyze possible dates and suggest optimal scheduling
router.post('/:id/ai-suggest-dates', isAuthenticated, async (req, res) => {
  try {
    const eventId = parseInt(req.params.id);

    if (!eventId || isNaN(eventId)) {
      return res.status(400).json({ error: 'Valid event ID required' });
    }

    // Check permissions
    if (!hasPermission(req.user, PERMISSIONS.EVENT_REQUESTS_VIEW)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    // Get flexibility options from request body
    const flexibilityOptions = {
      canChangeDayOfWeek: req.body?.canChangeDayOfWeek || false,
      canChangeWeek: req.body?.canChangeWeek || false,
      canChangeMonth: req.body?.canChangeMonth || false,
    };

    // Get the event request
    const eventRequest = await storage.getEventRequestById(eventId);
    if (!eventRequest) {
      return res.status(404).json({ error: 'Event request not found' });
    }

    // Get all scheduled events for analysis
    const allEventRequests = await storage.getAllEventRequests();
    const scheduledEvents = allEventRequests.filter(e => 
      e.status === 'scheduled' && e.scheduledEventDate
    );

    // Import and call AI scheduling assistant with flexibility options
    const { suggestOptimalEventDate } = await import('../services/ai-scheduling');
    const suggestion = await suggestOptimalEventDate(eventRequest, scheduledEvents, flexibilityOptions);

    // Log activity
    await logActivity(
      req,
      res,
      'EVENT_REQUESTS_VIEW',
      `Used AI assistant to analyze dates for event request: ${eventId}`,
      { organizationName: eventRequest.organizationName, flexibility: flexibilityOptions }
    );

    res.json(suggestion);
  } catch (error: unknown) {
    const err = error as Error;
    logger.error('❌ Error generating AI date suggestion:', error);
    res.status(500).json({
      error: 'Failed to generate AI suggestion',
      message: err?.message || 'Unknown error occurred'
    });
  }
});

// AI Intake Assistant - Comprehensive analysis and suggestions for intake coordinators
router.post('/:id/ai-intake-assist', isAuthenticated, async (req, res) => {
  try {
    const eventId = parseInt(req.params.id);

    if (!eventId || isNaN(eventId)) {
      return res.status(400).json({ error: 'Valid event ID required' });
    }

    // Check permissions
    if (!hasPermission(req.user, PERMISSIONS.EVENT_REQUESTS_VIEW)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    // Get the event request
    const eventRequest = await storage.getEventRequestById(eventId);
    if (!eventRequest) {
      return res.status(404).json({ error: 'Event request not found' });
    }

    // Get all scheduled events for context (for date conflict analysis)
    const allEventRequests = await storage.getAllEventRequests();
    const scheduledEvents = allEventRequests.filter(e =>
      e.status === 'scheduled' && e.scheduledEventDate
    );

    // Import and call AI intake assistant
    const { analyzeEventRequest } = await import('../services/ai-intake-assistant');
    const analysis = await analyzeEventRequest(eventRequest, scheduledEvents);

    // Log activity
    await logActivity(
      req,
      res,
      'EVENT_REQUESTS_VIEW',
      `Used AI intake assistant for event request: ${eventId}`,
      { organizationName: eventRequest.organizationName }
    );

    res.json(analysis);
  } catch (error: unknown) {
    const err = error as Error;
    logger.error('❌ Error generating AI intake assistance:', error);
    res.status(500).json({
      error: 'Failed to generate AI assistance',
      message: err?.message || 'Unknown error occurred'
    });
  }
});

// AI Event Categorization - Automatically categorize event based on organization and details
router.post('/:id/ai-categorize', isAuthenticated, async (req, res) => {
  try {
    const eventId = parseInt(req.params.id);

    if (!eventId || isNaN(eventId)) {
      return res.status(400).json({ error: 'Valid event ID required' });
    }

    // Check permissions
    if (!hasPermission(req.user, PERMISSIONS.EVENT_REQUESTS_VIEW)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    // Get the event request
    const eventRequest = await storage.getEventRequestById(eventId);
    if (!eventRequest) {
      return res.status(404).json({ error: 'Event request not found' });
    }

    // Import and call AI categorization service
    const { categorizeEventRequest } = await import('../services/ai-event-categorization');
    const categorization = await categorizeEventRequest({
      organizationName: eventRequest.organizationName || '',
      organizationCategory: eventRequest.organizationCategory || undefined,
      description: eventRequest.message || undefined,
      estimatedSandwichCount: eventRequest.estimatedSandwichCount || undefined,
      eventType: eventRequest.organizationCategory || undefined,
      location: eventRequest.eventAddress || undefined,
      deliveryDestination: eventRequest.deliveryDestination || undefined,
    });

    // Update the event request with categorization
    // The categorization object structure matches the schema definition exactly
    await storage.updateEventRequest(eventId, {
      autoCategories: {
        eventType: categorization.eventType,
        eventSize: categorization.eventSize,
        specialNeeds: categorization.specialNeeds,
        targetAudience: categorization.targetAudience,
        confidence: categorization.confidence,
        reasoning: categorization.reasoning,
        suggestedTags: categorization.suggestedTags,
      },
      categorizedAt: new Date(),
      categorizedBy: 'ai',
      updatedAt: new Date(),
    });

    // Log activity
    await logActivity(
      req,
      res,
      'EVENT_REQUESTS_VIEW',
      `Used AI categorization for event request: ${eventId}`,
      { organizationName: eventRequest.organizationName, eventType: categorization.eventType }
    );

    res.json(categorization);
  } catch (error: unknown) {
    const err = error as Error;
    logger.error('❌ Error generating AI categorization:', error);
    res.status(500).json({
      error: 'Failed to generate AI categorization',
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

// Mark event as MLK Day event
router.patch('/:id/mlk-day', isAuthenticated, requirePermission('EVENT_REQUESTS_EDIT'), async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { isMlkDayEvent } = req.body;

    // Get original data for audit logging
    const originalEvent = await storage.getEventRequestById(id);
    if (!originalEvent) {
      return res.status(404).json({ message: 'Event request not found' });
    }

    // Update the event request
    const updatedEventRequest = await storage.updateEventRequest(id, {
      isMlkDayEvent,
      mlkDayMarkedAt: isMlkDayEvent ? new Date() : null,
      mlkDayMarkedBy: isMlkDayEvent ? req.user?.id : null,
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
      'EVENT_REQUESTS_MLK_DAY_UPDATE',
      `${isMlkDayEvent ? 'Marked' : 'Unmarked'} event as MLK Day event: ${id}`,
      { isMlkDayEvent }
    );

    res.json(updatedEventRequest);
  } catch (error) {
    logger.error('Error updating MLK Day status:', error);
    res.status(500).json({ 
      message: 'Failed to update MLK Day status',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Mark event as postponed
router.post('/:id/postpone', isAuthenticated, requirePermission('EVENT_REQUESTS_EDIT'), async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { postponementReason, tentativeNewDate, postponementNotes } = req.body;

    // Validate required field
    if (!postponementReason) {
      return res.status(400).json({ message: 'Postponement reason is required' });
    }

    // Get original data for audit logging
    const originalEvent = await storage.getEventRequestById(id);
    if (!originalEvent) {
      return res.status(404).json({ message: 'Event request not found' });
    }

    // Prepare update data with proper snake_case database column names
    const updateData: any = {
      status: 'postponed',
      postponement_reason: postponementReason,
      postponement_notes: postponementNotes || null,
      statusChangedAt: new Date(),
    };

    // Add tentative new date if provided
    if (tentativeNewDate) {
      updateData.tentative_new_date = new Date(tentativeNewDate);
    }

    // Update the event request
    const updatedEventRequest = await storage.updateEventRequest(id, updateData);

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
      'EVENT_REQUESTS_STATUS_CHANGE',
      `Marked event request as postponed: ${id}`,
      { 
        postponementReason,
        tentativeNewDate: tentativeNewDate || null,
        organizationName: originalEvent.organizationName 
      }
    );

    res.json(updatedEventRequest);
  } catch (error) {
    logger.error('Error postponing event:', error);
    res.status(500).json({ 
      message: 'Failed to postpone event',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Send event details via SMS to selected users
router.post('/:id/send-details-sms', isAuthenticated, requirePermission('EVENT_REQUESTS_VIEW'), async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { userIds } = req.body;

    if (!Array.isArray(userIds) || userIds.length === 0) {
      return res.status(400).json({ message: 'Please select at least one user' });
    }

    // Get event details
    const event = await storage.getEventRequestById(id);
    if (!event) {
      return res.status(404).json({ message: 'Event request not found' });
    }

    // Import SMS service
    const { SMSProviderFactory } = await import('../sms-providers/provider-factory');
    const factory = SMSProviderFactory.getInstance();
    const smsProvider = factory.getProvider();

    if (!smsProvider || !smsProvider.isConfigured()) {
      return res.status(500).json({ message: 'SMS service not configured' });
    }

    // Get users and their phone numbers
    const users = await Promise.all(
      userIds.map(userId => storage.getUserById(userId))
    );

    const results = [];
    for (const user of users) {
      if (!user) {
        results.push({ userId: 'unknown', success: false, error: 'User not found' });
        continue;
      }

      // Verify SMS consent - only send to users who have confirmed opt-in
      const smsConsent = (user.metadata as any)?.smsConsent;
      if (!smsConsent || smsConsent.status !== 'confirmed' || !smsConsent.enabled || !smsConsent.phoneNumber) {
        results.push({
          userId: user.id,
          userName: user.displayName || user.email,
          success: false,
          error: 'User has not confirmed SMS opt-in'
        });
        continue;
      }

      const phoneNumber = smsConsent.phoneNumber;

      // Format event details for SMS
      const organizationName = event.organizationName || 'Organization';
      const contactName = event.firstName && event.lastName 
        ? `${event.firstName} ${event.lastName}` 
        : event.firstName || 'Contact';
      
      const eventDate = event.scheduledEventDate 
        ? new Date(event.scheduledEventDate).toLocaleDateString('en-US', { 
            month: 'long', day: 'numeric', year: 'numeric' 
          })
        : 'TBD';

      const eventTime = event.eventStartTime && event.eventEndTime
        ? `${event.eventStartTime} - ${event.eventEndTime}`
        : event.pickupDateTime 
          ? `Pickup at ${event.pickupDateTime.split('T')[1]?.substring(0, 5) || ''}`
          : 'Time TBD';

      // Create Google Maps link if address exists
      let locationText = event.eventAddress || 'Location TBD';
      if (event.eventAddress) {
        const mapsLink = `https://maps.google.com/?q=${encodeURIComponent(event.eventAddress)}`;
        locationText = `${event.eventAddress}\n📍 ${mapsLink}`;
      }

      // Build SMS message
      const message = `🥪 The Sandwich Project Event Details

Organization: ${organizationName}
Date: ${eventDate}
Time: ${eventTime}

Location:
${locationText}

Contact: ${contactName}
${event.phone ? `Phone: ${event.phone}` : ''}
${event.email ? `Email: ${event.email}` : ''}

Thank you for volunteering!`;

      try {
        const result = await smsProvider.sendSMS({
          to: phoneNumber,
          body: message,
        });

        results.push({
          userId: user.id,
          userName: user.displayName || user.email,
          phone: phoneNumber.replace(/\d(?=\d{4})/g, '*'), // Mask phone for privacy
          success: result.success,
          messageId: result.messageId,
        });
      } catch (error) {
        results.push({
          userId: user.id,
          userName: user.displayName || user.email,
          success: false,
          error: error instanceof Error ? error.message : 'Failed to send'
        });
      }
    }

    // Count successes
    const successCount = results.filter(r => r.success).length;
    
    // Log activity
    await logActivity(
      req,
      res,
      'EVENT_DETAILS_SMS_SENT',
      `Sent event details for event ${id} to ${successCount}/${results.length} users`,
      { eventId: id, results }
    );

    res.json({
      success: true,
      message: `Sent to ${successCount} of ${results.length} users`,
      results,
    });
  } catch (error) {
    logger.error('Error sending event details SMS:', error);
    res.status(500).json({ 
      message: 'Failed to send event details',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Send correction SMS for event details
router.post('/:id/send-correction-sms', isAuthenticated, requirePermission('EVENT_REQUESTS_SEND_SMS'), async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { userIds, customMessage } = req.body;

    if (!Array.isArray(userIds) || userIds.length === 0) {
      return res.status(400).json({ message: 'Please select at least one user' });
    }

    if (!customMessage || typeof customMessage !== 'string' || customMessage.trim().length === 0) {
      return res.status(400).json({ message: 'Please provide a correction message' });
    }

    // Get event details
    const event = await storage.getEventRequestById(id);
    if (!event) {
      return res.status(404).json({ message: 'Event request not found' });
    }

    // Import SMS service
    const { SMSProviderFactory } = await import('../sms-providers/provider-factory');
    const factory = SMSProviderFactory.getInstance();
    const smsProvider = factory.getProvider();

    if (!smsProvider || !smsProvider.isConfigured()) {
      return res.status(500).json({ message: 'SMS service not configured' });
    }

    // Get users and their phone numbers
    const users = await Promise.all(
      userIds.map(userId => storage.getUserById(userId))
    );

    const results = [];
    for (const user of users) {
      if (!user) {
        results.push({ userId: 'unknown', success: false, error: 'User not found' });
        continue;
      }

      // Verify SMS consent - only send to users who have confirmed opt-in
      const smsConsent = (user.metadata as any)?.smsConsent;
      if (!smsConsent || smsConsent.status !== 'confirmed' || !smsConsent.enabled || !smsConsent.phoneNumber) {
        results.push({
          userId: user.id,
          userName: user.displayName || user.email,
          success: false,
          error: 'User has not confirmed SMS opt-in'
        });
        continue;
      }

      const phoneNumber = smsConsent.phoneNumber;

      // Build correction SMS message
      const message = `🥪 The Sandwich Project - CORRECTION

${customMessage.trim()}

We apologize for any confusion!`;

      try {
        const result = await smsProvider.sendSMS({
          to: phoneNumber,
          body: message,
        });

        results.push({
          userId: user.id,
          userName: user.displayName || user.email,
          phone: phoneNumber.replace(/\d(?=\d{4})/g, '*'), // Mask phone for privacy
          success: result.success,
          messageId: result.messageId,
        });
      } catch (error) {
        results.push({
          userId: user.id,
          userName: user.displayName || user.email,
          success: false,
          error: error instanceof Error ? error.message : 'Failed to send'
        });
      }
    }

    // Count successes
    const successCount = results.filter(r => r.success).length;
    
    // Log activity
    await logActivity(
      req,
      res,
      'EVENT_CORRECTION_SMS_SENT',
      `Sent correction SMS for event ${id} to ${successCount}/${results.length} users`,
      { eventId: id, results }
    );

    res.json({
      success: true,
      message: `Sent correction to ${successCount} of ${results.length} users`,
      results,
    });
  } catch (error) {
    logger.error('Error sending correction SMS:', error);
    res.status(500).json({
      message: 'Failed to send correction SMS',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Manually trigger auto-complete for past events (admin only)
router.post('/admin/auto-complete-passed', isAuthenticated, requirePermission('ADMIN_ACCESS'), async (req, res) => {
  try {
    const { autoCompletePassedEvents } = await import('../services/cron-jobs');
    const result = await autoCompletePassedEvents();

    res.json({
      message: `Auto-complete completed: ${result.eventsCompleted} events moved to completed status`,
      eventsCompleted: result.eventsCompleted,
      errors: result.errors,
      timestamp: result.timestamp,
    });
  } catch (error) {
    logger.error('Error running manual auto-complete:', error);
    res.status(500).json({
      message: 'Failed to run auto-complete',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Check for scheduling conflicts for an event
 * POST /api/event-requests/check-conflicts
 *
 * Body:
 * - id?: number (if editing existing event)
 * - scheduledEventDate: string (ISO date)
 * - eventStartTime?: string
 * - eventEndTime?: string
 * - vanBooked?: string
 * - driverName?: string
 * - recipientId?: number
 * - organizationName?: string
 *
 * Returns conflicts/warnings without blocking event creation
 */
router.post('/check-conflicts', isAuthenticated, async (req, res) => {
  try {
    const { checkEventConflicts } = await import('../services/event-conflict-detection');

    const eventData = {
      id: req.body.id,
      scheduledEventDate: req.body.scheduledEventDate,
      eventStartTime: req.body.eventStartTime,
      eventEndTime: req.body.eventEndTime,
      vanBooked: req.body.vanBooked,
      driverName: req.body.driverName,
      recipientId: req.body.recipientId,
      organizationName: req.body.organizationName,
    };

    const result = await checkEventConflicts(eventData);

    res.json(result);
  } catch (error) {
    logger.error('Error checking event conflicts:', error);
    res.status(500).json({
      hasConflicts: false,
      warnings: [],
      summary: 'Error checking conflicts',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * Get all conflicts for a specific date
 * GET /api/event-requests/conflicts-for-date?date=2024-01-15
 */
router.get('/conflicts-for-date', isAuthenticated, async (req, res) => {
  try {
    const dateStr = req.query.date as string;
    if (!dateStr) {
      return res.status(400).json({ error: 'Date parameter required' });
    }

    const { getConflictsForDate } = await import('../services/event-conflict-detection');
    const date = new Date(dateStr);

    if (isNaN(date.getTime())) {
      return res.status(400).json({ error: 'Invalid date format' });
    }

    const result = await getConflictsForDate(date);
    res.json(result);
  } catch (error) {
    logger.error('Error getting conflicts for date:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;
