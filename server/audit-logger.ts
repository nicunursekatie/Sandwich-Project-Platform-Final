import { db } from './db';
import { auditLogs, type InsertAuditLog } from '@shared/schema';
import { sql, desc, eq, and } from 'drizzle-orm';

export interface AuditContext {
  userId?: string;
  ipAddress?: string;
  userAgent?: string;
  sessionId?: string;
}

export interface ChangeContext {
  followUpMethod?: string;
  followUpAction?: string;
  notes?: string;
  actionType?: string;
  updatedEmail?: string;
  operation?: string;
  section?: string;
  [key: string]: any;
}

export interface FieldChange {
  field: string;
  friendlyName: string;
  oldValue: any;
  newValue: any;
  description: string;
}

export interface ChangeMetadata {
  changes: FieldChange[];
  summary: string;
  changeContext?: ChangeContext;
  totalChanges: number;
  significantChanges: string[];
}

export class AuditLogger {
  // Field mapping for event request fields to user-friendly names
  private static readonly FIELD_MAPPINGS: Record<string, string> = {
    // Basic contact information
    firstName: 'First Name',
    lastName: 'Last Name', 
    email: 'Email Address',
    phone: 'Phone Number',
    organizationName: 'Organization Name',
    department: 'Department',
    
    // Event details
    desiredEventDate: 'Desired Event Date',
    scheduledEventDate: 'Scheduled Event Date',
    message: 'Message/Notes',
    previouslyHosted: 'Previously Hosted Events',
    
    // System tracking
    status: 'Status',
    statusChangedAt: 'Status Changed Date',
    assignedTo: 'Assigned To',
    
    // Follow-up tracking
    followUpMethod: 'Follow-up Method',
    updatedEmail: 'Updated Email',
    followUpDate: 'Follow-up Date',
    scheduledCallDate: 'Scheduled Call Date',
    contactedAt: 'Contacted Date',
    
    // Contact completion details
    communicationMethod: 'Communication Method',
    contactCompletionNotes: 'Contact Notes',
    eventAddress: 'Event Address',
    estimatedSandwichCount: 'Estimated Sandwich Count',
    hasRefrigeration: 'Has Refrigeration',
    completedByUserId: 'Completed By',
    
    // TSP contact assignments
    tspContactAssigned: 'TSP Contact Assigned',
    tspContact: 'Primary TSP Contact',
    tspContactAssignedDate: 'TSP Contact Assignment Date',
    additionalTspContacts: 'Additional TSP Contacts',
    additionalContact1: 'Additional Contact 1',
    additionalContact2: 'Additional Contact 2',
    customTspContact: 'Custom TSP Contact',
    
    // Toolkit tracking
    toolkitSent: 'Toolkit Sent',
    toolkitSentDate: 'Toolkit Sent Date',
    toolkitStatus: 'Toolkit Status',
    toolkitSentBy: 'Toolkit Sent By',
    
    // Event timing
    eventStartTime: 'Event Start Time',
    eventEndTime: 'Event End Time',
    pickupTime: 'Pickup Time',
    overnightPickupTime: 'Overnight Pickup Time',
    
    // Event details
    additionalRequirements: 'Additional Requirements',
    planningNotes: 'Planning Notes',
    schedulingNotes: 'Scheduling Notes',
    sandwichTypes: 'Sandwich Types',
    deliveryDestination: 'Delivery Destination',
    overnightHoldingLocation: 'Overnight Holding Location',
    
    // Resource requirements
    driversNeeded: 'Drivers Needed',
    speakersNeeded: 'Speakers Needed',
    volunteersNeeded: 'Volunteers Needed',
    volunteerNotes: 'Volunteer Notes',
    
    // Assignments
    assignedDriverIds: 'Assigned Drivers',
    driverPickupTime: 'Driver Pickup Time',
    driverNotes: 'Driver Notes',
    driversArranged: 'Drivers Arranged',
    assignedSpeakerIds: 'Assigned Speakers',
    assignedDriverSpeakers: 'Driver-Speakers',
    assignedVolunteerIds: 'Assigned Volunteers',
    
    // Van driver
    vanDriverNeeded: 'Van Driver Needed',
    assignedVanDriverId: 'Assigned Van Driver',
    customVanDriverName: 'Custom Van Driver',
    vanDriverNotes: 'Van Driver Notes',
    
    // Follow-up completion
    followUpOneDayCompleted: '1-Day Follow-up Completed',
    followUpOneDayDate: '1-Day Follow-up Date',
    followUpOneMonthCompleted: '1-Month Follow-up Completed',
    followUpOneMonthDate: '1-Month Follow-up Date',
    
    // Social media and tracking
    socialMediaPosted: 'Social Media Posted',
    socialMediaPostDate: 'Social Media Post Date',
    actualSandwichCount: 'Actual Sandwich Count',
    sandwichesDistributed: 'Sandwiches Distributed',
    sandwichDistributionDate: 'Distribution Date',
    
    // Additional fields
    createdAt: 'Created Date',
    updatedAt: 'Last Updated',
    driverDetails: 'Driver Details',
    speakerDetails: 'Speaker Details'
  };

  // Format different data types for human-readable display
  private static formatValue(value: any, fieldName: string): string {
    if (value === null || value === undefined) {
      return 'Not set';
    }

    // Handle dates
    if (value instanceof Date || (typeof value === 'string' && fieldName.toLowerCase().includes('date'))) {
      try {
        const date = new Date(value);
        if (!isNaN(date.getTime())) {
          return date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            ...(fieldName.toLowerCase().includes('time') && {
              hour: '2-digit',
              minute: '2-digit'
            })
          });
        }
      } catch (error) {
        // Fall through to default handling
      }
    }

    // Handle booleans
    if (typeof value === 'boolean') {
      return value ? 'Yes' : 'No';
    }

    // Handle arrays
    if (Array.isArray(value)) {
      if (value.length === 0) {
        return 'None';
      }
      return value.join(', ');
    }

    // Handle objects
    if (typeof value === 'object') {
      try {
        return JSON.stringify(value, null, 2);
      } catch (error) {
        return String(value);
      }
    }

    // Handle numbers
    if (typeof value === 'number') {
      return value.toString();
    }

    // Handle strings
    const strValue = String(value).trim();
    return strValue === '' ? 'Not set' : strValue;
  }

  // Generate human-readable change description
  private static generateChangeDescription(
    fieldName: string,
    oldValue: any,
    newValue: any
  ): string {
    const friendlyName = this.FIELD_MAPPINGS[fieldName] || fieldName;
    const oldFormatted = this.formatValue(oldValue, fieldName);
    const newFormatted = this.formatValue(newValue, fieldName);

    if (oldFormatted === 'Not set') {
      return `${friendlyName} set to: ${newFormatted}`;
    }
    
    if (newFormatted === 'Not set') {
      return `${friendlyName} cleared (was: ${oldFormatted})`;
    }

    return `${friendlyName} changed: ${oldFormatted} → ${newFormatted}`;
  }

  // Compare two objects and identify changes
  private static identifyChanges(oldData: any, newData: any): FieldChange[] {
    const changes: FieldChange[] = [];
    const allKeys = new Set([
      ...Object.keys(oldData || {}),
      ...Object.keys(newData || {})
    ]);

    for (const key of Array.from(allKeys)) {
      const oldValue = oldData?.[key];
      const newValue = newData?.[key];

      // Skip if values are identical
      if (this.areValuesEqual(oldValue, newValue)) {
        continue;
      }

      // Skip internal fields and transient metadata that aren't meaningful to users
      if (['updatedAt', 'createdAt', 'id', 'actionContext', 'actionTimestamp', 'performedBy'].includes(key)) {
        continue;
      }

      const friendlyName = this.FIELD_MAPPINGS[key] || key;
      const description = this.generateChangeDescription(key, oldValue, newValue);

      changes.push({
        field: key,
        friendlyName,
        oldValue,
        newValue,
        description
      });
    }

    return changes;
  }

  // Deep equality check for values (handles objects, arrays, primitives)
  private static areValuesEqual(a: any, b: any): boolean {
    if (a === b) return true;
    
    if (a === null || b === null || a === undefined || b === undefined) {
      return a === b;
    }

    if (typeof a !== typeof b) return false;

    if (Array.isArray(a) && Array.isArray(b)) {
      if (a.length !== b.length) return false;
      for (let i = 0; i < a.length; i++) {
        if (!this.areValuesEqual(a[i], b[i])) return false;
      }
      return true;
    }

    if (typeof a === 'object' && typeof b === 'object') {
      const keysA = Object.keys(a);
      const keysB = Object.keys(b);
      
      if (keysA.length !== keysB.length) return false;
      
      for (const key of keysA) {
        if (!keysB.includes(key) || !this.areValuesEqual(a[key], b[key])) {
          return false;
        }
      }
      return true;
    }

    return false;
  }

  // Generate summary of changes based on context
  private static generateChangeSummary(
    changes: FieldChange[],
    changeContext?: ChangeContext
  ): string {
    if (changes.length === 0) {
      return 'No significant changes detected';
    }

    const contextType = changeContext?.actionType || changeContext?.operation;
    const changeCount = changes.length;

    // Context-specific summaries
    if (contextType) {
      switch (contextType) {
        case 'FOLLOW_UP_COMPLETED':
          return `Follow-up completed with ${changeCount} field update${changeCount === 1 ? '' : 's'}`;
        case 'CONTACT_COMPLETION':
          return `Contact marked as completed with ${changeCount} detail update${changeCount === 1 ? '' : 's'}`;
        case 'DRIVER_ASSIGNMENT':
          return `Driver assignment updated with ${changeCount} change${changeCount === 1 ? '' : 's'}`;
        case 'STATUS_UPDATE':
          return `Status updated with ${changeCount} additional change${changeCount === 1 ? '' : 's'}`;
        case 'TOOLKIT_SENT':
          return `Toolkit sent status updated with ${changeCount} change${changeCount === 1 ? '' : 's'}`;
        default:
          break;
      }
    }

    // General summary based on types of changes
    const statusChanges = changes.filter(c => c.field === 'status');
    const assignmentChanges = changes.filter(c => 
      c.field.toLowerCase().includes('assigned') || 
      c.field.toLowerCase().includes('contact')
    );
    const dateChanges = changes.filter(c => 
      c.field.toLowerCase().includes('date') || 
      c.field.toLowerCase().includes('time')
    );

    if (statusChanges.length > 0) {
      const statusChange = statusChanges[0];
      const otherChanges = changeCount - 1;
      return otherChanges > 0 
        ? `${statusChange.description} and ${otherChanges} other change${otherChanges === 1 ? '' : 's'}`
        : statusChange.description;
    }

    if (assignmentChanges.length > 0 && assignmentChanges.length === changeCount) {
      return `Updated ${changeCount} assignment${changeCount === 1 ? '' : 's'}`;
    }

    if (dateChanges.length > 0 && dateChanges.length === changeCount) {
      return `Updated ${changeCount} date/time field${changeCount === 1 ? '' : 's'}`;
    }

    // Default summary
    return `Updated ${changeCount} field${changeCount === 1 ? '' : 's'}: ${changes.slice(0, 3).map(c => c.friendlyName).join(', ')}${changeCount > 3 ? ` and ${changeCount - 3} more` : ''}`;
  }

  // Main method for logging event request changes
  static async logEventRequestChange(
    recordId: string,
    oldData: any,
    newData: any,
    context: AuditContext = {},
    changeContext?: ChangeContext
  ): Promise<void> {
    try {
      // Identify all field-level changes
      const changes = this.identifyChanges(oldData, newData);
      
      // Generate summary
      const summary = this.generateChangeSummary(changes, changeContext);
      
      // Identify significant changes (status, assignments, dates)
      const significantChanges = changes
        .filter(change => {
          const field = change.field.toLowerCase();
          return field.includes('status') || 
                 field.includes('assigned') || 
                 field.includes('contact') ||
                 field.includes('date') ||
                 field === 'email' ||
                 field === 'phone' ||
                 field.includes('toolkit');
        })
        .map(change => change.description);

      // Create comprehensive metadata
      const metadata: ChangeMetadata = {
        changes,
        summary,
        changeContext,
        totalChanges: changes.length,
        significantChanges
      };

      // PROBLEM 3 FIX: Separate change metadata from additional context to prevent duplication
      // Create clean additional context without field change data
      const cleanChangeContext = changeContext ? {
        ...changeContext,
        // Remove any field data that would duplicate the "What Changed" section
        ...(changeContext.notes && { notes: changeContext.notes }), // Keep notes
        ...(changeContext.actionType && { actionType: changeContext.actionType }), // Keep action type
        ...(changeContext.operation && { operation: changeContext.operation }), // Keep operation
        ...(changeContext.section && { section: changeContext.section }), // Keep section
      } : undefined;
      
      // Filter out field-level changes from the clean context to avoid duplication
      const fieldsInChanges = new Set(changes.map(change => change.field.toLowerCase()));
      const filteredContext: any = {};
      
      if (cleanChangeContext) {
        Object.keys(cleanChangeContext).forEach(key => {
          const lowerKey = key.toLowerCase();
          // Only include context items that are NOT already captured in field changes
          if (!fieldsInChanges.has(lowerKey) && 
              !['email', 'phone', 'firstname', 'lastname', 'organizationname', 'status'].includes(lowerKey)) {
            filteredContext[key] = cleanChangeContext[key];
          }
        });
      }

      // Enhanced new data with properly separated metadata
      const enhancedNewData = {
        ...newData,
        _auditMetadata: {
          changes,
          summary,
          totalChanges: changes.length,
          significantChanges,
          changeTimestamp: new Date().toISOString(),
          changedBy: context.userId || 'Unknown User',
          // Only include non-duplicate additional context
          additionalContext: Object.keys(filteredContext).length > 0 ? filteredContext : undefined
        }
      };

      // Log using the existing audit system with clean separation of concerns
      await this.log(
        'EVENT_REQUEST_CHANGE',
        'event_requests',
        recordId,
        oldData,
        enhancedNewData,
        context
      );

      // Log individual significant changes for better searchability
      if (significantChanges.length > 0) {
        await this.log(
          'EVENT_REQUEST_SIGNIFICANT_CHANGE',
          'event_requests',
          recordId,
          { significantChanges: significantChanges },
          { summary, totalChanges: changes.length },
          context
        );
      }

      console.log(`📋 Event Request Audit: ${summary} (${changes.length} total changes)`);
      
    } catch (error) {
      console.error('Failed to log event request change:', error);
      // Don't throw - audit logging shouldn't break the main operation
    }
  }
  static async log(
    action: string,
    tableName: string,
    recordId: string,
    oldData: any = null,
    newData: any = null,
    context: AuditContext = {}
  ) {
    try {
      const auditEntry: InsertAuditLog = {
        action,
        tableName,
        recordId,
        oldData: oldData ? JSON.stringify(oldData) : null,
        newData: newData ? JSON.stringify(newData) : null,
        userId: context.userId || null,
        ipAddress: context.ipAddress || null,
        userAgent: context.userAgent || null,
        sessionId: context.sessionId || null,
      };

      await db.insert(auditLogs).values(auditEntry);
    } catch (error) {
      console.error('Failed to log audit entry:', error);
      // Don't throw - audit logging shouldn't break the main operation
    }
  }

  static async logCreate(
    tableName: string,
    recordId: string,
    newData: any,
    context: AuditContext = {}
  ) {
    return this.log('CREATE', tableName, recordId, null, newData, context);
  }

  static async logUpdate(
    tableName: string,
    recordId: string,
    oldData: any,
    newData: any,
    context: AuditContext = {}
  ) {
    return this.log('UPDATE', tableName, recordId, oldData, newData, context);
  }

  static async logDelete(
    tableName: string,
    recordId: string,
    oldData: any,
    context: AuditContext = {}
  ) {
    // For event_requests table, create proper deletion audit metadata
    if (tableName === 'event_requests' && oldData) {
      const deletionData = {
        ...oldData,
        status: 'deleted', // Show the status as changing to "deleted"
        _auditMetadata: {
          changes: [{
            fieldName: 'status',
            fieldDisplayName: 'Status',
            oldValue: oldData.status || 'new',
            newValue: 'deleted'
          }],
          summary: `Status changed: ${oldData.status || 'new'} → deleted`,
          totalChanges: 1,
          significantChanges: ['status'],
          changeTimestamp: new Date().toISOString(),
          changedBy: context.userId || 'Unknown User',
          isDeletion: true
        }
      };
      return this.log('DELETE', tableName, recordId, oldData, deletionData, context);
    }
    
    // For other tables, use the original logic
    return this.log('DELETE', tableName, recordId, oldData, null, context);
  }

  static async logLogin(userId: string, context: AuditContext = {}) {
    return this.log(
      'LOGIN',
      'users',
      userId,
      null,
      { loginTime: new Date() },
      context
    );
  }

  static async logLogout(userId: string, context: AuditContext = {}) {
    return this.log(
      'LOGOUT',
      'users',
      userId,
      null,
      { logoutTime: new Date() },
      context
    );
  }

  static async getAuditHistory(
    tableName?: string,
    recordId?: string,
    userId?: string,
    limit: number = 100,
    offset: number = 0
  ) {
    try {
      // Build conditions array
      const conditions = [];
      
      if (tableName) {
        conditions.push(eq(auditLogs.tableName, tableName));
      }
      if (recordId) {
        conditions.push(eq(auditLogs.recordId, recordId));
      }
      if (userId) {
        conditions.push(eq(auditLogs.userId, userId));
      }

      const baseQuery = db.select().from(auditLogs);

      // Build query with conditions if they exist
      const queryWithConditions = conditions.length > 0 
        ? baseQuery.where(and(...conditions))
        : baseQuery;

      const results = await queryWithConditions
        .orderBy(desc(auditLogs.timestamp))
        .limit(limit)
        .offset(offset);

      return results;
    } catch (error) {
      console.error('Failed to retrieve audit history:', error);
      return [];
    }
  }
}
