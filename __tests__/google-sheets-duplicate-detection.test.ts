/**
 * Google Sheets Event Request Duplicate Detection Regression Tests
 *
 * Tests for the critical Tier-2 duplicate detection fix that prevents
 * legitimate separate event requests from being merged due to the
 * dangerous 24-hour timestamp tolerance window.
 *
 * CRITICAL ISSUE FIXED: The old logic used ±24h tolerance which could
 * merge different events from the same person on the same day, causing
 * data loss. The new logic requires exact submission time + event date
 * matching to prevent this.
 */

import { EventRequestsGoogleSheetsService, EventRequestSheetRow } from '../server/google-sheets-event-requests-sync';
import { EventRequest } from '@shared/schema';
import { IStorage } from '../server/storage';

// Mock storage for testing
class MockStorage implements Partial<IStorage> {
  private eventRequests: EventRequest[] = [];

  async getAllEventRequests(): Promise<EventRequest[]> {
    return this.eventRequests;
  }

  // Method to seed test data
  setEventRequests(requests: EventRequest[]) {
    this.eventRequests = requests;
  }

  // Other required methods (minimal implementation for testing)
  async getUser() { return undefined; }
  async getUserById() { return undefined; }
  async getUserByEmail() { return undefined; }
  async upsertUser() { return {} as any; }
  async getAllUsers() { return []; }
  async updateUser() { return undefined; }
  async setUserPassword() {}
  async getUserByUsername() { return undefined; }
  async createUser() { return {} as any; }
}

// Helper to create test event request data
function createTestEventRequest(overrides: Partial<EventRequest> = {}): EventRequest {
  return {
    id: Math.floor(Math.random() * 10000),
    organizationName: 'Test Organization',
    firstName: 'John',
    lastName: 'Doe',
    email: 'john.doe@test.com',
    phone: '555-0123',
    department: 'Test Department',
    desiredEventDate: new Date('2025-10-15T00:00:00.000Z'),
    status: 'new',
    message: 'Test message',
    previouslyHosted: 'No',
    organizationExists: false,
    duplicateNotes: '',
    createdAt: new Date('2025-09-26T10:00:00.000Z'),
    updatedAt: new Date('2025-09-26T10:00:00.000Z'),
    ...overrides,
  };
}

// Helper to create test sheet row data
function createTestSheetRow(overrides: Partial<EventRequestSheetRow> = {}): EventRequestSheetRow {
  return {
    organizationName: 'Test Organization',
    contactName: 'John Doe',
    email: 'john.doe@test.com',
    phone: '555-0123',
    department: 'Test Department',
    desiredEventDate: '10/15/2025',
    status: 'new',
    message: 'Test message',
    previouslyHosted: 'No',
    submittedOn: '9/26/2025 10:00:00',
    createdDate: '9/26/2025',
    lastUpdated: '9/26/2025',
    duplicateCheck: 'No',
    notes: '',
    ...overrides,
  };
}

describe('Google Sheets Duplicate Detection Regression Tests', () => {
  let service: EventRequestsGoogleSheetsService;
  let mockStorage: MockStorage;

  beforeEach(() => {
    mockStorage = new MockStorage();
    service = new EventRequestsGoogleSheetsService(mockStorage as IStorage);
  });

  describe('CRITICAL FIX: Tier-2 Matching Precision', () => {
    test('should NOT merge different events from same person on same day', async () => {
      // Scenario: Same person submits two different event requests on the same day
      // Old logic: Would merge these as duplicates (DATA LOSS)
      // New logic: Should keep them separate due to different event dates

      const baseDate = new Date('2025-09-26T10:00:00.000Z');
      
      // Existing event request in database
      const existingRequest = createTestEventRequest({
        email: 'jane.smith@school.com',
        organizationName: 'Springfield Elementary',
        desiredEventDate: new Date('2025-11-15T00:00:00.000Z'), // Event 1: November 15
        createdAt: baseDate,
      });

      mockStorage.setEventRequests([existingRequest]);

      // New sheet row for DIFFERENT event from same person on same day
      const newSheetRow = createTestSheetRow({
        email: 'jane.smith@school.com',
        organizationName: 'Springfield Elementary PTA', // Slightly different org name
        contactName: 'Jane Smith',
        desiredEventDate: '12/20/2025', // Event 2: December 20 (DIFFERENT DATE)
        submittedOn: '9/26/2025 10:01:00', // Same day, 1 minute later
      });

      // Use reflection to access private method for testing
      const findExistingMethod = (service as any).findExistingEventRequest.bind(service);
      
      const eventRequestData = {
        createdAt: new Date('2025-09-26T10:01:00.000Z'),
        desiredEventDate: new Date('2025-12-20T00:00:00.000Z'),
        email: 'jane.smith@school.com',
      };

      const match = await findExistingMethod(newSheetRow, eventRequestData);

      // CRITICAL: Should NOT find a match because event dates are different
      expect(match).toBeUndefined();
    });

    test('should still match identical submissions (legitimate duplicates)', async () => {
      // Scenario: Same person accidentally submits the same event request twice
      // Should still be detected as duplicate

      const baseDate = new Date('2025-09-26T10:00:00.000Z');
      
      const existingRequest = createTestEventRequest({
        email: 'jane.smith@school.com',
        organizationName: 'Springfield Elementary',
        desiredEventDate: new Date('2025-11-15T00:00:00.000Z'),
        createdAt: baseDate,
      });

      mockStorage.setEventRequests([existingRequest]);

      const duplicateSheetRow = createTestSheetRow({
        email: 'jane.smith@school.com',
        organizationName: 'Springfield Elementary',
        contactName: 'Jane Smith',
        desiredEventDate: '11/15/2025', // SAME event date
        submittedOn: '9/26/2025 10:02:00', // Within 5-minute window
      });

      const findExistingMethod = (service as any).findExistingEventRequest.bind(service);
      
      const eventRequestData = {
        createdAt: new Date('2025-09-26T10:02:00.000Z'),
        desiredEventDate: new Date('2025-11-15T00:00:00.000Z'), // SAME event date
        email: 'jane.smith@school.com',
      };

      const match = await findExistingMethod(duplicateSheetRow, eventRequestData);

      // Should find match because email, submission time (within 5 min), AND event date all match
      expect(match).toBeDefined();
      expect(match?.id).toBe(existingRequest.id);
    });

    test('should NOT match when submission times are more than 5 minutes apart', async () => {
      // Testing the new 5-minute tolerance window

      const baseDate = new Date('2025-09-26T10:00:00.000Z');
      
      const existingRequest = createTestEventRequest({
        email: 'test@example.com',
        desiredEventDate: new Date('2025-11-15T00:00:00.000Z'),
        createdAt: baseDate,
      });

      mockStorage.setEventRequests([existingRequest]);

      const sheetRow = createTestSheetRow({
        email: 'test@example.com',
        desiredEventDate: '11/15/2025', // Same event date
        submittedOn: '9/26/2025 10:06:00', // 6 minutes later (outside tolerance)
      });

      const findExistingMethod = (service as any).findExistingEventRequest.bind(service);
      
      const eventRequestData = {
        createdAt: new Date('2025-09-26T10:06:00.000Z'), // 6 minutes later
        desiredEventDate: new Date('2025-11-15T00:00:00.000Z'),
        email: 'test@example.com',
      };

      const match = await findExistingMethod(sheetRow, eventRequestData);

      // Should NOT match because time difference exceeds 5-minute tolerance
      expect(match).toBeUndefined();
    });

    test('should match within 5-minute tolerance window', async () => {
      // Testing the new 5-minute tolerance window (positive case)

      const baseDate = new Date('2025-09-26T10:00:00.000Z');
      
      const existingRequest = createTestEventRequest({
        email: 'test@example.com',
        desiredEventDate: new Date('2025-11-15T00:00:00.000Z'),
        createdAt: baseDate,
      });

      mockStorage.setEventRequests([existingRequest]);

      const sheetRow = createTestSheetRow({
        email: 'test@example.com',
        desiredEventDate: '11/15/2025', // Same event date
        submittedOn: '9/26/2025 10:04:00', // 4 minutes later (within tolerance)
      });

      const findExistingMethod = (service as any).findExistingEventRequest.bind(service);
      
      const eventRequestData = {
        createdAt: new Date('2025-09-26T10:04:00.000Z'), // 4 minutes later
        desiredEventDate: new Date('2025-11-15T00:00:00.000Z'),
        email: 'test@example.com',
      };

      const match = await findExistingMethod(sheetRow, eventRequestData);

      // Should match because all criteria met within tolerance
      expect(match).toBeDefined();
      expect(match?.id).toBe(existingRequest.id);
    });
  });

  describe('Marietta High School Restructuring Case Compatibility', () => {
    test('should still handle organization name changes through fuzzy matching', async () => {
      // Scenario: Organization restructures and changes name
      // Should still match through lower-priority fuzzy matching logic

      const existingRequest = createTestEventRequest({
        email: 'admin@marietta.edu',
        organizationName: 'Marietta High School',
        firstName: 'Sarah',
        lastName: 'Johnson',
        desiredEventDate: new Date('2025-11-15T00:00:00.000Z'),
        createdAt: new Date('2025-09-20T15:30:00.000Z'), // Different day
      });

      mockStorage.setEventRequests([existingRequest]);

      // New submission after organization restructuring
      const restructuredSheetRow = createTestSheetRow({
        email: 'admin@marietta.edu', // Same email
        organizationName: 'Marietta High School National Honor Society', // Extended name
        contactName: 'Sarah Johnson', // Same person
        desiredEventDate: '11/15/2025', // Same event
        submittedOn: '9/26/2025 10:00:00', // Different day (won't match Tier-2)
      });

      const findExistingMethod = (service as any).findExistingEventRequest.bind(service);
      
      const eventRequestData = {
        createdAt: new Date('2025-09-26T10:00:00.000Z'),
        desiredEventDate: new Date('2025-11-15T00:00:00.000Z'),
        email: 'admin@marietta.edu',
      };

      const match = await findExistingMethod(restructuredSheetRow, eventRequestData);

      // Should find match through fuzzy logic (Priority 3 or 4)
      expect(match).toBeDefined();
      expect(match?.id).toBe(existingRequest.id);
    });
  });

  describe('Edge Cases and Data Integrity', () => {
    test('should handle missing event dates gracefully', async () => {
      const existingRequest = createTestEventRequest({
        email: 'test@example.com',
        desiredEventDate: null as any, // Missing event date
      });

      mockStorage.setEventRequests([existingRequest]);

      const sheetRow = createTestSheetRow({
        email: 'test@example.com',
        desiredEventDate: '', // Empty event date
      });

      const findExistingMethod = (service as any).findExistingEventRequest.bind(service);
      
      const eventRequestData = {
        createdAt: new Date('2025-09-26T10:00:00.000Z'),
        desiredEventDate: null,
        email: 'test@example.com',
      };

      const match = await findExistingMethod(sheetRow, eventRequestData);

      // Should not crash and fall back to other matching logic
      expect(() => match).not.toThrow();
    });

    test('should preserve GoogleSheetRowId priority matching', async () => {
      // Priority 1: GoogleSheetRowId should still work and take precedence

      const existingRequest = createTestEventRequest({
        googleSheetRowId: '123',
        email: 'test@example.com',
      });

      mockStorage.setEventRequests([existingRequest]);

      const sheetRow = createTestSheetRow({
        rowIndex: 123,
        email: 'different@example.com', // Different email
      });

      const findExistingMethod = (service as any).findExistingEventRequest.bind(service);
      
      const eventRequestData = {
        createdAt: new Date('2025-09-26T10:00:00.000Z'),
        desiredEventDate: new Date('2025-11-15T00:00:00.000Z'),
        email: 'different@example.com',
      };

      const match = await findExistingMethod(sheetRow, eventRequestData);

      // Should match based on GoogleSheetRowId despite different email
      expect(match).toBeDefined();
      expect(match?.id).toBe(existingRequest.id);
    });

    test('comprehensive same-day multiple events scenario', async () => {
      // Real-world scenario: School coordinator submits 3 different events on same day

      const baseSubmissionTime = new Date('2025-09-26T09:00:00.000Z');
      
      // Existing events in database
      const existingEvents = [
        createTestEventRequest({
          id: 1,
          email: 'coordinator@school.edu',
          organizationName: 'Lincoln High School Drama Club',
          desiredEventDate: new Date('2025-11-01T00:00:00.000Z'), // Halloween event
          createdAt: baseSubmissionTime,
        }),
        createTestEventRequest({
          id: 2,
          email: 'coordinator@school.edu',
          organizationName: 'Lincoln High School Band',
          desiredEventDate: new Date('2025-11-15T00:00:00.000Z'), // Concert event
          createdAt: new Date('2025-09-26T09:30:00.000Z'), // 30 min later
        }),
      ];

      mockStorage.setEventRequests(existingEvents);

      // New third event from same coordinator on same day
      const newEventRow = createTestSheetRow({
        email: 'coordinator@school.edu',
        organizationName: 'Lincoln High School Basketball Team',
        contactName: 'Jane Coordinator',
        desiredEventDate: '12/10/2025', // Basketball game (DIFFERENT from existing)
        submittedOn: '9/26/2025 14:00:00', // Same day, much later (5 hours)
      });

      const findExistingMethod = (service as any).findExistingEventRequest.bind(service);
      
      const eventRequestData = {
        createdAt: new Date('2025-09-26T14:00:00.000Z'), // 5 hours later
        desiredEventDate: new Date('2025-12-10T00:00:00.000Z'), // Different date
        email: 'coordinator@school.edu',
      };

      const match = await findExistingMethod(newEventRow, eventRequestData);

      // CRITICAL: Should NOT match any existing event because:
      // 1. Submission time difference > 5 minutes (rules out Tier-2)
      // 2. Different event dates
      // 3. Different organizations (though fuzzy matching might catch some similarity)
      expect(match).toBeUndefined();
    });
  });

  describe('CRITICAL FIX: Tier-3 Fallback Event Date Validation', () => {
    test('Tier-3 PRIORITY 3: Should NOT match same email + org similarity with different event dates', async () => {
      // CRITICAL TEST: This scenario was causing data loss in the old logic
      // Same person, similar organization, but DIFFERENT events = should be separate records

      const existingRequest = createTestEventRequest({
        email: 'admin@mariettahs.edu',
        organizationName: 'Marietta High School',
        desiredEventDate: new Date('2025-10-15T00:00:00.000Z'), // Fall fundraiser
        createdAt: new Date('2025-09-01T10:00:00.000Z'),
      });

      mockStorage.setEventRequests([existingRequest]);

      const newEventRow = createTestSheetRow({
        email: 'admin@mariettahs.edu', // SAME email
        organizationName: 'Marietta High School NHS', // Similar org (>60% similarity) 
        contactName: 'School Admin',
        desiredEventDate: '12/20/2025', // DIFFERENT event date (winter fundraiser)
        submittedOn: '10/15/2025 14:30:00', // Much later submission
      });

      const findExistingMethod = (service as any).findExistingEventRequest.bind(service);
      
      const eventRequestData = {
        createdAt: new Date('2025-10-15T14:30:00.000Z'),
        desiredEventDate: new Date('2025-12-20T00:00:00.000Z'), // DIFFERENT date
        email: 'admin@mariettahs.edu',
      };

      const match = await findExistingMethod(newEventRow, eventRequestData);

      // CRITICAL: Should NOT match because event dates are different
      // Old logic would match due to email + org similarity > 0.6
      // New logic requires matching event dates
      expect(match).toBeUndefined();
    });

    test('Tier-3 PRIORITY 3: Should still match organizational restructuring for SAME event', async () => {
      // This should still work: same person, same event, restructured organization name
      
      const existingRequest = createTestEventRequest({
        email: 'admin@mariettahs.edu',
        organizationName: 'Marietta High School',
        desiredEventDate: new Date('2025-10-15T00:00:00.000Z'), // SAME event
        createdAt: new Date('2025-09-01T10:00:00.000Z'),
      });

      mockStorage.setEventRequests([existingRequest]);

      const restructuredRow = createTestSheetRow({
        email: 'admin@mariettahs.edu', // SAME email
        organizationName: 'Marietta High School National Honor Society', // Restructured name
        contactName: 'School Admin',
        desiredEventDate: '10/15/2025', // SAME event date
        submittedOn: '9/15/2025 11:00:00', // Different submission (org restructure update)
      });

      const findExistingMethod = (service as any).findExistingEventRequest.bind(service);
      
      const eventRequestData = {
        createdAt: new Date('2025-09-15T11:00:00.000Z'),
        desiredEventDate: new Date('2025-10-15T00:00:00.000Z'), // SAME event date
        email: 'admin@mariettahs.edu',
      };

      const match = await findExistingMethod(restructuredRow, eventRequestData);

      // Should match because: same email + same event date + high org similarity
      expect(match).toBeDefined();
      expect(match?.id).toBe(existingRequest.id);
    });

    test('Tier-3 PRIORITY 4: Fuzzy email matching should require same event date', async () => {
      // Test that fuzzy matching (email + org similarity) requires event date match

      const existingRequest = createTestEventRequest({
        email: 'john.smith@company.com',
        organizationName: 'Tech Solutions Inc',
        firstName: 'John',
        lastName: 'Smith',
        desiredEventDate: new Date('2025-11-01T00:00:00.000Z'),
        createdAt: new Date('2025-09-01T10:00:00.000Z'),
      });

      mockStorage.setEventRequests([existingRequest]);

      const newEventRow = createTestSheetRow({
        email: 'john.smith@company.com', // SAME email
        organizationName: 'Tech Solutions LLC', // Similar org name  
        contactName: 'John Smith', // SAME name
        desiredEventDate: '12/15/2025', // DIFFERENT event date
        submittedOn: '10/01/2025 09:00:00',
      });

      const findExistingMethod = (service as any).findExistingEventRequest.bind(service);
      
      const eventRequestData = {
        createdAt: new Date('2025-10-01T09:00:00.000Z'),
        desiredEventDate: new Date('2025-12-15T00:00:00.000Z'), // DIFFERENT event date
        email: 'john.smith@company.com',
      };

      const match = await findExistingMethod(newEventRow, eventRequestData);

      // Should NOT match due to different event dates, even though email and org are similar
      expect(match).toBeUndefined();
    });

    test('Tier-3 PRIORITY 4: Fuzzy phone matching should require same event date', async () => {
      // Test that fuzzy matching (phone + org similarity) requires event date match

      const existingRequest = createTestEventRequest({
        email: 'jane@school.edu',
        phone: '555-123-4567',
        organizationName: 'Franklin Elementary School',
        desiredEventDate: new Date('2025-10-30T00:00:00.000Z'), // Halloween event
        createdAt: new Date('2025-09-01T10:00:00.000Z'),
      });

      mockStorage.setEventRequests([existingRequest]);

      const newEventRow = createTestSheetRow({
        email: 'different@school.edu', // Different email
        phone: '(555) 123-4567', // SAME phone (different format)
        organizationName: 'Franklin Elementary PTA', // High org similarity
        contactName: 'Jane Teacher',
        desiredEventDate: '11/20/2025', // DIFFERENT event date (Thanksgiving)
        submittedOn: '10/01/2025 09:00:00',
      });

      const findExistingMethod = (service as any).findExistingEventRequest.bind(service);
      
      const eventRequestData = {
        createdAt: new Date('2025-10-01T09:00:00.000Z'),
        desiredEventDate: new Date('2025-11-20T00:00:00.000Z'), // DIFFERENT event date
        email: 'different@school.edu',
      };

      const match = await findExistingMethod(newEventRow, eventRequestData);

      // Should NOT match due to different event dates, even though phone and org are similar
      expect(match).toBeUndefined();
    });

    test('Tier-3 PRIORITY 4: Fuzzy name matching should require same event date', async () => {
      // Test that fuzzy matching (full name + org similarity) requires event date match

      const existingRequest = createTestEventRequest({
        email: 'old.email@school.com',
        firstName: 'Sarah',
        lastName: 'Johnson',
        organizationName: 'Cherokee Middle School',
        desiredEventDate: new Date('2025-09-30T00:00:00.000Z'), // September event
        createdAt: new Date('2025-08-15T10:00:00.000Z'),
      });

      mockStorage.setEventRequests([existingRequest]);

      const newEventRow = createTestSheetRow({
        email: 'new.email@school.com', // Different email
        phone: '555-999-8888', // Different phone
        organizationName: 'Cherokee Middle School Band', // High org similarity  
        contactName: 'Sarah Johnson', // SAME full name
        desiredEventDate: '12/01/2025', // DIFFERENT event date (December)
        submittedOn: '10/01/2025 09:00:00',
      });

      const findExistingMethod = (service as any).findExistingEventRequest.bind(service);
      
      const eventRequestData = {
        createdAt: new Date('2025-10-01T09:00:00.000Z'),
        desiredEventDate: new Date('2025-12-01T00:00:00.000Z'), // DIFFERENT event date
        email: 'new.email@school.com',
      };

      const match = await findExistingMethod(newEventRow, eventRequestData);

      // Should NOT match due to different event dates, even though name and org are similar
      expect(match).toBeUndefined();
    });
  });

  describe('INTEGRATION TEST: All Three Tiers Working Together', () => {
    test('Complex real-world scenario: Multiple tiers with data loss prevention', async () => {
      // Comprehensive test of all matching logic working together

      const baseDate = new Date('2025-09-26T08:00:00.000Z');
      
      // Complex set of existing requests simulating real-world data
      const existingRequests = [
        // Request 1: Exact duplicate (should match via Tier-2)
        createTestEventRequest({
          id: 1,
          googleSheetRowId: '10',
          email: 'coordinator@school.edu',
          organizationName: 'Lincoln High School Drama',
          desiredEventDate: new Date('2025-11-01T00:00:00.000Z'),
          createdAt: baseDate,
        }),
        // Request 2: Same person, different event (should NOT match)  
        createTestEventRequest({
          id: 2,
          email: 'coordinator@school.edu',
          organizationName: 'Lincoln High School Band',
          desiredEventDate: new Date('2025-11-15T00:00:00.000Z'), // Different date
          createdAt: new Date('2025-09-26T09:30:00.000Z'),
        }),
        // Request 3: Organizational restructure of Request 1 (should match via Tier-3)
        createTestEventRequest({
          id: 3,
          email: 'admin@anotherplace.com', 
          organizationName: 'Separate Organization',
          desiredEventDate: new Date('2025-12-01T00:00:00.000Z'),
          createdAt: new Date('2025-09-20T10:00:00.000Z'),
        }),
      ];

      mockStorage.setEventRequests(existingRequests);

      // Test Case 1: Should match Request 1 via GoogleSheetRowId (Tier-1)
      const tierOneTest = createTestSheetRow({
        rowIndex: 10, // Matches googleSheetRowId  
        email: 'different@email.com', // Different email shouldn't matter
        organizationName: 'Completely Different Org', // Different org shouldn't matter
        contactName: 'Different Person',
        desiredEventDate: '12/25/2025', // Different date shouldn't matter for Tier-1
        submittedOn: '10/01/2025 14:00:00',
      });

      const findExistingMethod = (service as any).findExistingEventRequest.bind(service);
      
      let tierOneMatch = await findExistingMethod(tierOneTest, {
        createdAt: new Date('2025-10-01T14:00:00.000Z'),
        desiredEventDate: new Date('2025-12-25T00:00:00.000Z'),
        email: 'different@email.com',
      });

      // Should match via Tier-1 (GoogleSheetRowId)
      expect(tierOneMatch).toBeDefined();
      expect(tierOneMatch?.id).toBe(1);

      // Test Case 2: Should match Request 1 via Tier-2 (exact submission + event date)
      const tierTwoTest = createTestSheetRow({
        email: 'coordinator@school.edu', // Same email
        organizationName: 'Lincoln HS Drama Club', // Similar org
        contactName: 'Event Coordinator',
        desiredEventDate: '11/01/2025', // SAME event date
        submittedOn: '9/26/2025 08:02:00', // Within 5-minute window
      });

      let tierTwoMatch = await findExistingMethod(tierTwoTest, {
        createdAt: new Date('2025-09-26T08:02:00.000Z'),
        desiredEventDate: new Date('2025-11-01T00:00:00.000Z'), // SAME event date
        email: 'coordinator@school.edu',
      });

      // Should match via Tier-2 (submission time + email + event date)
      expect(tierTwoMatch).toBeDefined();
      expect(tierTwoMatch?.id).toBe(1);

      // Test Case 3: Should match Request 1 via Tier-3 (organizational restructure)
      const tierThreeTest = createTestSheetRow({
        email: 'coordinator@school.edu', // Same email
        organizationName: 'Lincoln High School Drama Club', // Restructured org name
        contactName: 'Event Coordinator',
        desiredEventDate: '11/01/2025', // SAME event date (key!)
        submittedOn: '10/15/2025 14:00:00', // Much later submission (org restructure)
      });

      let tierThreeMatch = await findExistingMethod(tierThreeTest, {
        createdAt: new Date('2025-10-15T14:00:00.000Z'),
        desiredEventDate: new Date('2025-11-01T00:00:00.000Z'), // SAME event date
        email: 'coordinator@school.edu',
      });

      // Should match via Tier-3 (email + org similarity + same event date)
      expect(tierThreeMatch).toBeDefined();
      expect(tierThreeMatch?.id).toBe(1);

      // Test Case 4: Should NOT match - same person, different event (DATA LOSS PREVENTION)
      const differentEventTest = createTestSheetRow({
        email: 'coordinator@school.edu', // Same email as existing
        organizationName: 'Lincoln High School Basketball', // Different activity
        contactName: 'Event Coordinator', // Same person
        desiredEventDate: '01/15/2026', // DIFFERENT event date (winter sports)
        submittedOn: '11/01/2025 10:00:00', // New submission
      });

      let differentEventMatch = await findExistingMethod(differentEventTest, {
        createdAt: new Date('2025-11-01T10:00:00.000Z'),
        desiredEventDate: new Date('2026-01-15T00:00:00.000Z'), // DIFFERENT event date
        email: 'coordinator@school.edu',
      });

      // CRITICAL: Should NOT match any existing request because event date is different
      // This prevents data loss from legitimate separate events
      expect(differentEventMatch).toBeUndefined();
    });
  });
});