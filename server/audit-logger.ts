import { db } from './db';
import { auditLogs, type InsertAuditLog } from '@shared/schema';
import { sql, desc, eq, and } from 'drizzle-orm';

export interface AuditContext {
  userId?: string;
  ipAddress?: string;
  userAgent?: string;
  sessionId?: string;
}

interface FieldChange {
  field: string;
  fieldDisplayName: string;
  oldValue: any;
  newValue: any;
  changeDescription: string;
}

interface DetailedAuditData {
  changes: FieldChange[];
  summary: string;
  actionType: string;
  context?: any;
}

export class AuditLogger {
  // Enhanced logging method with detailed field-level change tracking
  static async logChange(
    action: string,
    tableName: string,
    recordId: string,
    oldData: any = null,
    newData: any = null,
    context: AuditContext = {}
  ) {
    try {
      // Generate detailed audit data with field changes
      const detailedData = this.generateDetailedAuditData(action, oldData, newData, tableName);
      
      const auditEntry: InsertAuditLog = {
        action: detailedData.actionType,
        tableName,
        recordId,
        oldData: oldData ? JSON.stringify({
          ...oldData,
          _auditMetadata: {
            changes: detailedData.changes,
            summary: detailedData.summary
          }
        }) : null,
        newData: newData ? JSON.stringify({
          ...newData,
          _auditMetadata: {
            changes: detailedData.changes,
            summary: detailedData.summary
          }
        }) : null,
        userId: context.userId || null,
        ipAddress: context.ipAddress || null,
        userAgent: context.userAgent || null,
        sessionId: context.sessionId || null,
      };

      await db.insert(auditLogs).values(auditEntry);
      
      console.log(`🔍 Enhanced audit log created: ${detailedData.summary}`);
      return detailedData;
    } catch (error) {
      console.error('Failed to log detailed audit entry:', error);
      // Fall back to basic logging
      return this.log(action, tableName, recordId, oldData, newData, context);
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

      let query = db.select().from(auditLogs);

      // Apply all conditions at once using and()
      if (conditions.length > 0) {
        query = query.where(and(...conditions));
      }

      const results = await query
        .orderBy(desc(auditLogs.timestamp))
        .limit(limit)
        .offset(offset);

      return results;
    } catch (error) {
      console.error('Failed to retrieve audit history:', error);
      return [];
    }
  }

  // Generate detailed audit data with field-level changes
  private static generateDetailedAuditData(
    action: string,
    oldData: any,
    newData: any,
    tableName: string
  ): DetailedAuditData {
    const changes: FieldChange[] = [];
    
    if (!oldData && newData) {
      // Create operation
      return {
        changes: [],
        summary: this.getCreateSummary(newData, tableName),
        actionType: 'CREATE',
      };
    }
    
    if (oldData && !newData) {
      // Delete operation
      return {
        changes: [],
        summary: this.getDeleteSummary(oldData, tableName),
        actionType: 'DELETE',
      };
    }
    
    if (!oldData || !newData) {
      return {
        changes: [],
        summary: 'Data change occurred',
        actionType: action,
      };
    }

    // Compare fields for updates
    const fieldsToCheck = this.getRelevantFields(tableName);
    const detectedChanges = this.compareFields(oldData, newData, fieldsToCheck);
    
    changes.push(...detectedChanges);
    
    const summary = this.generateChangeSummary(changes, tableName);
    const actionType = this.determineActionType(changes, action);
    
    return {
      changes,
      summary,
      actionType,
    };
  }

  // Compare specific fields between old and new data
  private static compareFields(oldData: any, newData: any, fieldsToCheck: Record<string, string>): FieldChange[] {
    const changes: FieldChange[] = [];
    
    for (const [field, displayName] of Object.entries(fieldsToCheck)) {
      const oldValue = oldData[field];
      const newValue = newData[field];
      
      if (this.hasValueChanged(oldValue, newValue)) {
        const changeDescription = this.formatFieldChange(field, oldValue, newValue, displayName);
        
        changes.push({
          field,
          fieldDisplayName: displayName,
          oldValue,
          newValue,
          changeDescription,
        });
      }
    }
    
    return changes;
  }

  // Check if a value has actually changed
  private static hasValueChanged(oldValue: any, newValue: any): boolean {
    // Handle null/undefined values
    if (oldValue === null || oldValue === undefined) {
      return newValue !== null && newValue !== undefined && newValue !== '';
    }
    if (newValue === null || newValue === undefined) {
      return oldValue !== null && oldValue !== undefined && oldValue !== '';
    }
    
    // Handle dates
    if (oldValue instanceof Date && newValue instanceof Date) {
      return oldValue.getTime() !== newValue.getTime();
    }
    
    // Handle arrays
    if (Array.isArray(oldValue) && Array.isArray(newValue)) {
      return JSON.stringify(oldValue.sort()) !== JSON.stringify(newValue.sort());
    }
    
    // Handle objects
    if (typeof oldValue === 'object' && typeof newValue === 'object') {
      return JSON.stringify(oldValue) !== JSON.stringify(newValue);
    }
    
    // Handle strings (trim whitespace)
    if (typeof oldValue === 'string' && typeof newValue === 'string') {
      return oldValue.trim() !== newValue.trim();
    }
    
    return oldValue !== newValue;
  }

  // Format a field change into human-readable description
  private static formatFieldChange(field: string, oldValue: any, newValue: any, displayName: string): string {
    const formatValue = (value: any): string => {
      if (value === null || value === undefined || value === '') {
        return '(empty)';
      }
      
      if (typeof value === 'boolean') {
        return value ? 'Yes' : 'No';
      }
      
      if (value instanceof Date) {
        return value.toLocaleDateString();
      }
      
      if (Array.isArray(value)) {
        return value.length > 0 ? value.join(', ') : '(empty)';
      }
      
      if (typeof value === 'object') {
        // Handle special objects
        if (value.name) return value.name;
        if (value.email) return value.email;
        return JSON.stringify(value);
      }
      
      // Truncate long strings
      const stringValue = String(value);
      return stringValue.length > 100 ? `${stringValue.substring(0, 97)}...` : stringValue;
    };

    const oldFormatted = formatValue(oldValue);
    const newFormatted = formatValue(newValue);
    
    // Special formatting for specific fields
    switch (field) {
      case 'status':
        return `Status changed: ${oldFormatted} → ${newFormatted}`;
      case 'phone':
      case 'phoneNumber':
        return `Phone updated: ${oldFormatted} → ${newFormatted}`;
      case 'email':
        return `Email updated: ${oldFormatted} → ${newFormatted}`;
      case 'desiredEventDate':
        return `Event date changed: ${oldFormatted} → ${newFormatted}`;
      case 'tspContact':
        return newValue ? `TSP contact assigned: ${newFormatted}` : `TSP contact removed (was: ${oldFormatted})`;
      default:
        return `${displayName} changed: ${oldFormatted} → ${newFormatted}`;
    }
  }

  // Get relevant fields to track for each table - COMPREHENSIVE coverage
  private static getRelevantFields(tableName: string): Record<string, string> {
    switch (tableName) {
      case 'event_requests':
        return {
          // Core contact information
          status: 'Status',
          firstName: 'First Name',
          lastName: 'Last Name',
          email: 'Email',
          phone: 'Phone',
          organizationName: 'Organization',
          department: 'Department',
          
          // Event planning and scheduling
          desiredEventDate: 'Desired Event Date',
          scheduledEventDate: 'Scheduled Event Date',
          eventStartTime: 'Event Start Time',
          eventEndTime: 'Event End Time',
          pickupTime: 'Pickup Time',
          message: 'Message/Notes',
          
          // Assignment and contacts
          assignedTo: 'Assigned To',
          tspContact: 'TSP Contact',
          customTspContact: 'Custom TSP Contact',
          additionalTspContacts: 'Additional TSP Contacts',
          additionalContact1: 'Additional Contact 1',
          additionalContact2: 'Additional Contact 2',
          
          // Follow-up tracking (CRITICAL - was missing)
          followUpMethod: 'Follow-up Method',
          updatedEmail: 'Updated Email',
          followUpOneDayCompleted: '1-Day Follow-up',
          followUpOneMonthCompleted: '1-Month Follow-up',
          followUpOneWeekCompleted: '1-Week Follow-up',
          scheduledCallDate: 'Scheduled Call Date',
          primaryContactCompletedDate: 'Primary Contact Date',
          
          // Event execution
          participantCount: 'Participant Count',
          actualSandwichCount: 'Actual Sandwich Count',
          sandwichesDelivered: 'Sandwiches Delivered',
          driverDetails: 'Driver Details',
          speakerDetails: 'Speaker Details',
          deliveryVehicle: 'Delivery Vehicle',
          
          // Event completion and feedback
          eventCompletedDate: 'Event Completion Date',
          eventFeedback: 'Event Feedback',
          socialMediaPostRequested: 'Social Media Post Requested',
          socialMediaCaption: 'Social Media Caption',
          photoPermissionGranted: 'Photo Permission',
          
          // Toolkit and logistics (MISSING - causing "no changes detected")
          hostToolkitSent: 'Host Toolkit Sent',
          driverToolkitSent: 'Driver Toolkit Sent',
          speakerToolkitSent: 'Speaker Toolkit Sent',
          toolkitNotes: 'Toolkit Notes',
          planningNotes: 'Planning Notes',
          internalNotes: 'Internal Notes',
          
          // Contact status and follow-up outcomes
          contactMethod: 'Contact Method',
          contactOutcome: 'Contact Outcome',
          unresponsiveReason: 'Unresponsive Reason',
          declineReason: 'Decline Reason',
          declineDetails: 'Decline Details',
          postponeReason: 'Postpone Reason',
          
          // Timing and scheduling
          estimatedDuration: 'Estimated Duration',
          actualDuration: 'Actual Duration',
          setupTime: 'Setup Time',
          cleanupTime: 'Cleanup Time',
          
          // Experience and history
          previouslyHosted: 'Previously Hosted',
          organizationNotes: 'Organization Notes',
          locationDetails: 'Location Details',
          specialRequirements: 'Special Requirements',
          accessibilityNeeds: 'Accessibility Needs',
          
          // Administrative and metadata
          priority: 'Priority',
          source: 'Source',
          referralSource: 'Referral Source',
          submittedViaForm: 'Submitted Via Form',
          googleSheetsRowId: 'Google Sheets Row ID',
          statusChangedAt: 'Status Changed At',
          createdBy: 'Created By',
        };
      default:
        return {};
    }
  }

  // Generate summary of all changes
  private static generateChangeSummary(changes: FieldChange[], tableName: string): string {
    if (changes.length === 0) {
      return 'No significant changes detected';
    }
    
    if (changes.length === 1) {
      return changes[0].changeDescription;
    }
    
    const changeCount = changes.length;
    const primaryChange = changes[0].changeDescription;
    
    return `${primaryChange} (and ${changeCount - 1} other change${changeCount > 2 ? 's' : ''})`;
  }

  // Determine action type based on changes - Enhanced for follow-up context
  private static determineActionType(changes: FieldChange[], originalAction: string): string {
    if (changes.length === 0) {
      return originalAction;
    }
    
    // Look for specific change patterns
    const statusChange = changes.find(c => c.field === 'status');
    if (statusChange) {
      return 'STATUS_CHANGED';
    }
    
    // Follow-up related changes (CRITICAL - was missing)
    const followUpChanges = changes.filter(c => 
      ['followUpMethod', 'followUpOneDayCompleted', 'followUpOneMonthCompleted', 'followUpOneWeekCompleted'].includes(c.field)
    );
    if (followUpChanges.length > 0) {
      return 'FOLLOW_UP_COMPLETED';
    }
    
    const contactChanges = changes.filter(c => 
      ['firstName', 'lastName', 'email', 'phone', 'updatedEmail'].includes(c.field)
    );
    if (contactChanges.length > 0) {
      return 'CONTACT_INFO_UPDATED';
    }
    
    const tspContactChange = changes.find(c => c.field === 'tspContact');
    if (tspContactChange) {
      return 'TSP_CONTACT_UPDATED';
    }
    
    // Event execution changes
    const executionChanges = changes.filter(c => 
      ['driverDetails', 'speakerDetails', 'actualSandwichCount', 'eventCompletedDate'].includes(c.field)
    );
    if (executionChanges.length > 0) {
      return 'EVENT_EXECUTION_UPDATED';
    }
    
    // Toolkit changes
    const toolkitChanges = changes.filter(c => 
      ['hostToolkitSent', 'driverToolkitSent', 'speakerToolkitSent'].includes(c.field)
    );
    if (toolkitChanges.length > 0) {
      return 'TOOLKIT_UPDATED';
    }
    
    return 'DETAILS_UPDATED';
  }

  // Generate create summary
  private static getCreateSummary(data: any, tableName: string): string {
    switch (tableName) {
      case 'event_requests':
        return `Event request created for ${data.organizationName || 'Unknown Organization'}`;
      default:
        return `New ${tableName} record created`;
    }
  }

  // Generate delete summary  
  private static getDeleteSummary(data: any, tableName: string): string {
    switch (tableName) {
      case 'event_requests':
        return `Event request deleted for ${data.organizationName || 'Unknown Organization'}`;
      default:
        return `${tableName} record deleted`;
    }
  }

  // Enhanced logging method for event requests specifically
  static async logEventRequestChange(
    recordId: string,
    oldData: any,
    newData: any,
    context: AuditContext = {},
    actionContext?: {
      followUpMethod?: string;
      followUpAction?: string;
      notes?: string;
      actionType?: string;
      [key: string]: any;
    }
  ) {
    try {
      // Enhanced context with follow-up and action-specific data that frontend expects
      const enhancedNewData = {
        ...newData,
        _auditActionContext: {
          followUpMethod: actionContext?.followUpMethod,
          followUpAction: actionContext?.followUpAction, 
          notes: actionContext?.notes,
          actionType: actionContext?.actionType,
          timestamp: new Date().toISOString(),
          ...actionContext
        }
      };
      
      const enhancedOldData = {
        ...oldData,
        _auditActionContext: {} // Preserve structure for comparison
      };
      
      return this.logChange('UPDATE', 'event_requests', recordId, enhancedOldData, enhancedNewData, context);
    } catch (error) {
      console.error('Failed to log event request change with action context:', error);
      // Fallback to basic logging
      return this.logChange('UPDATE', 'event_requests', recordId, oldData, newData, context);
    }
  }
}
