import express from 'express';
import { PERMISSIONS, hasPermission } from '@shared/auth-utils';
import { storage } from '../storage-wrapper';

const router = express.Router();

interface TestUser {
  email: string;
  expectedRole?: string;
  description: string;
}

interface PermissionTest {
  permission: number;
  name: string;
  // Dynamic expectation based on user role
  shouldHavePermission: (role: string) => boolean;
}

// Get all real active users dynamically
async function getAllTestUsers(): Promise<TestUser[]> {
  try {
    const users = await storage.getAllUsers();
    return users
      .filter(user => user.isActive)
      .map(user => ({
        email: user.email,
        expectedRole: user.role,
        description: user.firstName && user.lastName 
          ? `${user.firstName} ${user.lastName} (${user.role})`
          : `${user.email} (${user.role})`
      }))
      .sort((a, b) => {
        // Sort by role hierarchy: admin > core_team > committee_member > host > volunteer
        const roleOrder = { admin: 0, super_admin: 0, core_team: 1, committee_member: 2, host: 3, volunteer: 4 };
        return (roleOrder[a.expectedRole] || 5) - (roleOrder[b.expectedRole] || 5);
      });
  } catch (error) {
    console.error('Failed to get all users, using fallback list:', error);
    return [
      { email: 'admin@sandwich.project', expectedRole: 'admin', description: 'Admin User' },
      { email: 'christine@thesandwichproject.org', expectedRole: 'admin', description: 'Christine (Admin)' }
    ];
  }
}

// Comprehensive permissions test - covers all major permission categories
const PERMISSION_TESTS: PermissionTest[] = [
  // === ADMINISTRATIVE PERMISSIONS ===
  { permission: PERMISSIONS.ADMIN_ACCESS, name: 'Admin Access', 
    shouldHavePermission: (role) => false }, // Test actual vs expected, no assumptions
  { permission: PERMISSIONS.MANAGE_ANNOUNCEMENTS, name: 'Manage Announcements', 
    shouldHavePermission: (role) => false },
  
  // === USER MANAGEMENT ===
  { permission: PERMISSIONS.USERS_VIEW, name: 'Users View', 
    shouldHavePermission: (role) => false },
  { permission: PERMISSIONS.USERS_ADD, name: 'Users Add', 
    shouldHavePermission: (role) => false },
  { permission: PERMISSIONS.USERS_EDIT, name: 'Users Edit', 
    shouldHavePermission: (role) => false },
  { permission: PERMISSIONS.USERS_DELETE, name: 'Users Delete', 
    shouldHavePermission: (role) => false },
  
  // === HOSTS MANAGEMENT ===
  { permission: PERMISSIONS.HOSTS_VIEW, name: 'Hosts View', 
    shouldHavePermission: (role) => false },
  { permission: PERMISSIONS.HOSTS_ADD, name: 'Hosts Add', 
    shouldHavePermission: (role) => false },
  { permission: PERMISSIONS.HOSTS_EDIT, name: 'Hosts Edit', 
    shouldHavePermission: (role) => false },
  { permission: PERMISSIONS.HOSTS_DELETE, name: 'Hosts Delete', 
    shouldHavePermission: (role) => false },
  
  // === RECIPIENTS MANAGEMENT ===
  { permission: PERMISSIONS.RECIPIENTS_VIEW, name: 'Recipients View', 
    shouldHavePermission: (role) => false },
  { permission: PERMISSIONS.RECIPIENTS_ADD, name: 'Recipients Add', 
    shouldHavePermission: (role) => false },
  { permission: PERMISSIONS.RECIPIENTS_EDIT, name: 'Recipients Edit', 
    shouldHavePermission: (role) => false },
  { permission: PERMISSIONS.RECIPIENTS_DELETE, name: 'Recipients Delete', 
    shouldHavePermission: (role) => false },
  
  // === DRIVERS MANAGEMENT ===
  { permission: PERMISSIONS.DRIVERS_VIEW, name: 'Drivers View', 
    shouldHavePermission: (role) => false },
  { permission: PERMISSIONS.DRIVERS_ADD, name: 'Drivers Add', 
    shouldHavePermission: (role) => false },
  { permission: PERMISSIONS.DRIVERS_EDIT, name: 'Drivers Edit', 
    shouldHavePermission: (role) => false },
  { permission: PERMISSIONS.DRIVERS_DELETE, name: 'Drivers Delete', 
    shouldHavePermission: (role) => false },
  
  // === COLLECTIONS MANAGEMENT ===
  { permission: PERMISSIONS.COLLECTIONS_VIEW, name: 'Collections View', 
    shouldHavePermission: (role) => false },
  { permission: PERMISSIONS.COLLECTIONS_ADD, name: 'Collections Add', 
    shouldHavePermission: (role) => false },
  { permission: PERMISSIONS.COLLECTIONS_EDIT_OWN, name: 'Collections Edit Own', 
    shouldHavePermission: (role) => false },
  { permission: PERMISSIONS.COLLECTIONS_EDIT_ALL, name: 'Collections Edit All', 
    shouldHavePermission: (role) => false },
  { permission: PERMISSIONS.COLLECTIONS_DELETE_OWN, name: 'Collections Delete Own', 
    shouldHavePermission: (role) => false },
  { permission: PERMISSIONS.COLLECTIONS_DELETE_ALL, name: 'Collections Delete All', 
    shouldHavePermission: (role) => false },
  { permission: PERMISSIONS.COLLECTIONS_WALKTHROUGH, name: 'Collections Walkthrough', 
    shouldHavePermission: (role) => false },
  
  // === PROJECTS MANAGEMENT ===
  { permission: PERMISSIONS.PROJECTS_VIEW, name: 'Projects View', 
    shouldHavePermission: (role) => false },
  { permission: PERMISSIONS.PROJECTS_ADD, name: 'Projects Add', 
    shouldHavePermission: (role) => false },
  { permission: PERMISSIONS.PROJECTS_EDIT_OWN, name: 'Projects Edit Own', 
    shouldHavePermission: (role) => false },
  { permission: PERMISSIONS.PROJECTS_EDIT_ALL, name: 'Projects Edit All', 
    shouldHavePermission: (role) => false },
  { permission: PERMISSIONS.PROJECTS_DELETE_OWN, name: 'Projects Delete Own', 
    shouldHavePermission: (role) => false },
  { permission: PERMISSIONS.PROJECTS_DELETE_ALL, name: 'Projects Delete All', 
    shouldHavePermission: (role) => false },
  
  // === DISTRIBUTIONS ===
  { permission: PERMISSIONS.DISTRIBUTIONS_VIEW, name: 'Distributions View', 
    shouldHavePermission: (role) => false },
  { permission: PERMISSIONS.DISTRIBUTIONS_ADD, name: 'Distributions Add', 
    shouldHavePermission: (role) => false },
  { permission: PERMISSIONS.DISTRIBUTIONS_EDIT, name: 'Distributions Edit', 
    shouldHavePermission: (role) => false },
  { permission: PERMISSIONS.DISTRIBUTIONS_DELETE, name: 'Distributions Delete', 
    shouldHavePermission: (role) => false },
  
  // === EVENT REQUESTS ===
  { permission: PERMISSIONS.EVENT_REQUESTS_VIEW, name: 'Event Requests View', 
    shouldHavePermission: (role) => false },
  { permission: PERMISSIONS.EVENT_REQUESTS_ADD, name: 'Event Requests Add', 
    shouldHavePermission: (role) => false },
  { permission: PERMISSIONS.EVENT_REQUESTS_EDIT, name: 'Event Requests Edit', 
    shouldHavePermission: (role) => false },
  { permission: PERMISSIONS.EVENT_REQUESTS_DELETE, name: 'Event Requests Delete', 
    shouldHavePermission: (role) => false },
  { permission: PERMISSIONS.EVENT_REQUESTS_SYNC, name: 'Event Requests Sync', 
    shouldHavePermission: (role) => false },
  { permission: PERMISSIONS.EVENT_REQUESTS_COMPLETE_CONTACT, name: 'Event Requests Complete Contact', 
    shouldHavePermission: (role) => false },
  
  // === MESSAGING SYSTEM ===
  { permission: PERMISSIONS.MESSAGES_VIEW, name: 'Messages View', 
    shouldHavePermission: (role) => false },
  { permission: PERMISSIONS.MESSAGES_SEND, name: 'Messages Send', 
    shouldHavePermission: (role) => false },
  { permission: PERMISSIONS.MESSAGES_EDIT, name: 'Messages Edit', 
    shouldHavePermission: (role) => false },
  { permission: PERMISSIONS.MESSAGES_DELETE, name: 'Messages Delete', 
    shouldHavePermission: (role) => false },
  { permission: PERMISSIONS.MESSAGES_MODERATE, name: 'Messages Moderate', 
    shouldHavePermission: (role) => false },
  
  // === WORK LOGS ===
  { permission: PERMISSIONS.WORK_LOGS_VIEW, name: 'Work Logs View', 
    shouldHavePermission: (role) => false },
  { permission: PERMISSIONS.WORK_LOGS_VIEW_ALL, name: 'Work Logs View All', 
    shouldHavePermission: (role) => false },
  { permission: PERMISSIONS.WORK_LOGS_ADD, name: 'Work Logs Add', 
    shouldHavePermission: (role) => false },
  { permission: PERMISSIONS.WORK_LOGS_EDIT_OWN, name: 'Work Logs Edit Own', 
    shouldHavePermission: (role) => false },
  { permission: PERMISSIONS.WORK_LOGS_EDIT_ALL, name: 'Work Logs Edit All', 
    shouldHavePermission: (role) => false },
  { permission: PERMISSIONS.WORK_LOGS_DELETE_OWN, name: 'Work Logs Delete Own', 
    shouldHavePermission: (role) => false },
  { permission: PERMISSIONS.WORK_LOGS_DELETE_ALL, name: 'Work Logs Delete All', 
    shouldHavePermission: (role) => false },
  
  // === SUGGESTIONS SYSTEM ===
  { permission: PERMISSIONS.SUGGESTIONS_VIEW, name: 'Suggestions View', 
    shouldHavePermission: (role) => false },
  { permission: PERMISSIONS.SUGGESTIONS_ADD, name: 'Suggestions Add', 
    shouldHavePermission: (role) => false },
  { permission: PERMISSIONS.SUGGESTIONS_EDIT_OWN, name: 'Suggestions Edit Own', 
    shouldHavePermission: (role) => false },
  { permission: PERMISSIONS.SUGGESTIONS_EDIT_ALL, name: 'Suggestions Edit All', 
    shouldHavePermission: (role) => false },
  { permission: PERMISSIONS.SUGGESTIONS_DELETE_OWN, name: 'Suggestions Delete Own', 
    shouldHavePermission: (role) => false },
  { permission: PERMISSIONS.SUGGESTIONS_DELETE_ALL, name: 'Suggestions Delete All', 
    shouldHavePermission: (role) => false },
  { permission: PERMISSIONS.SUGGESTIONS_MANAGE, name: 'Suggestions Manage', 
    shouldHavePermission: (role) => false },
  
  // === CHAT PERMISSIONS ===
  { permission: PERMISSIONS.CHAT_GENERAL, name: 'Chat General', 
    shouldHavePermission: (role) => false },
  { permission: PERMISSIONS.CHAT_GRANTS_COMMITTEE, name: 'Chat Grants Committee', 
    shouldHavePermission: (role) => false },
  { permission: PERMISSIONS.CHAT_EVENTS_COMMITTEE, name: 'Chat Events Committee', 
    shouldHavePermission: (role) => false },
  { permission: PERMISSIONS.CHAT_BOARD, name: 'Chat Board', 
    shouldHavePermission: (role) => false },
  { permission: PERMISSIONS.CHAT_WEB_COMMITTEE, name: 'Chat Web Committee', 
    shouldHavePermission: (role) => false },
  { permission: PERMISSIONS.CHAT_VOLUNTEER_MANAGEMENT, name: 'Chat Volunteer Management', 
    shouldHavePermission: (role) => false },
  { permission: PERMISSIONS.CHAT_HOST, name: 'Chat Host', 
    shouldHavePermission: (role) => false },
  { permission: PERMISSIONS.CHAT_DRIVER, name: 'Chat Driver', 
    shouldHavePermission: (role) => false },
  { permission: PERMISSIONS.CHAT_RECIPIENT, name: 'Chat Recipient', 
    shouldHavePermission: (role) => false },
  { permission: PERMISSIONS.CHAT_CORE_TEAM, name: 'Chat Core Team', 
    shouldHavePermission: (role) => false },
  { permission: PERMISSIONS.CHAT_DIRECT, name: 'Chat Direct', 
    shouldHavePermission: (role) => false },
  { permission: PERMISSIONS.CHAT_GROUP, name: 'Chat Group', 
    shouldHavePermission: (role) => false },
  
  // === KUDOS SYSTEM ===
  { permission: PERMISSIONS.KUDOS_SEND, name: 'Kudos Send', 
    shouldHavePermission: (role) => false },
  { permission: PERMISSIONS.KUDOS_RECEIVE, name: 'Kudos Receive', 
    shouldHavePermission: (role) => false },
  { permission: PERMISSIONS.KUDOS_VIEW, name: 'Kudos View', 
    shouldHavePermission: (role) => false },
  { permission: PERMISSIONS.KUDOS_MANAGE, name: 'Kudos Manage', 
    shouldHavePermission: (role) => false },
  
  // === ANALYTICS & REPORTING ===
  { permission: PERMISSIONS.ANALYTICS_VIEW, name: 'Analytics View', 
    shouldHavePermission: (role) => false },
  
  // === MEETINGS ===
  { permission: PERMISSIONS.MEETINGS_VIEW, name: 'Meetings View', 
    shouldHavePermission: (role) => false },
  { permission: PERMISSIONS.MEETINGS_MANAGE, name: 'Meetings Manage', 
    shouldHavePermission: (role) => false },
  
  // === DOCUMENTS ===
  { permission: PERMISSIONS.DOCUMENTS_VIEW, name: 'Documents View', 
    shouldHavePermission: (role) => false },
  { permission: PERMISSIONS.DOCUMENTS_MANAGE, name: 'Documents Manage', 
    shouldHavePermission: (role) => false },
  
  // === DATA IMPORT/EXPORT ===
  { permission: PERMISSIONS.DATA_EXPORT, name: 'Data Export', 
    shouldHavePermission: (role) => false },
  { permission: PERMISSIONS.DATA_IMPORT, name: 'Data Import', 
    shouldHavePermission: (role) => false },
  
  // === ORGANIZATIONS ===
  { permission: PERMISSIONS.ORGANIZATIONS_VIEW, name: 'Organizations View', 
    shouldHavePermission: (role) => false },
  
  // === TOOLKIT ===
  { permission: PERMISSIONS.TOOLKIT_ACCESS, name: 'Toolkit Access', 
    shouldHavePermission: (role) => false },
];

router.get('/matrix', async (req, res) => {
  console.log('\n🧪 Starting Permission Matrix Test...');
  
  const results: any[] = [];
  let totalTests = 0;
  let passedTests = 0;

  // Get all real active users
  const TEST_USERS = await getAllTestUsers();
  console.log(`📋 Testing ${TEST_USERS.length} active users`);

  for (const testUser of TEST_USERS) {
    console.log(`\n👤 Testing user: ${testUser.email}`);
    
    // Fetch user from database
    let user: any = null;
    let userStatus = 'NOT_FOUND';
    
    try {
      user = await storage.getUserByEmail(testUser.email);
      if (user) {
        userStatus = user.isActive ? 'ACTIVE' : 'INACTIVE';
        console.log(`✅ Found user: ${user.email} (${user.role}) - ${userStatus}`);
      } else {
        console.log(`❌ User not found: ${testUser.email}`);
      }
    } catch (error) {
      userStatus = 'ERROR';
      console.log(`💥 Error fetching user ${testUser.email}:`, error);
    }

    // Test each permission
    for (const permTest of PERMISSION_TESTS) {
      totalTests++;
      
      let actualResult = false;
      let expectedResult = false;
      let status = 'ERROR';
      
      // Determine expected result based on user role
      expectedResult = permTest.shouldHavePermission(testUser.expectedRole);

      if (user && userStatus === 'ACTIVE') {
        try {
          actualResult = hasPermission(user, permTest.permission);
          status = actualResult === expectedResult ? 'PASS' : 'FAIL';
          if (status === 'PASS') passedTests++;
        } catch (error) {
          status = 'ERROR';
          console.log(`💥 Permission check error for ${permTest.name}:`, error);
        }
      } else {
        status = userStatus === 'NOT_FOUND' ? 'USER_NOT_FOUND' : userStatus;
      }

      const result = {
        user: testUser.email,
        userDescription: testUser.description,
        userStatus,
        permission: permTest.name,
        expected: expectedResult,
        actual: actualResult,
        status,
        passed: status === 'PASS'
      };

      results.push(result);
      
      const icon = status === 'PASS' ? '✅' : status === 'FAIL' ? '❌' : '⚠️';
      console.log(`  ${icon} ${permTest.name}: Expected ${expectedResult}, Got ${actualResult} (${status})`);
    }
  }

  console.log(`\n📊 Test Summary: ${passedTests}/${totalTests} tests passed`);
  
  const summary = {
    totalTests,
    passedTests,
    failedTests: totalTests - passedTests,
    successRate: Math.round((passedTests / totalTests) * 100),
    timestamp: new Date().toISOString()
  };

  res.json({
    summary,
    results,
    testUsers: TEST_USERS.map(u => ({
      ...u,
      found: results.some(r => r.user === u.email && r.userStatus === 'ACTIVE')
    })),
    permissions: PERMISSION_TESTS.map(p => ({ 
      name: p.name, 
      value: p.permission 
    }))
  });
});

// Health check
router.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'Working Permission Test is ready',
    timestamp: new Date().toISOString()
  });
});

export default router;