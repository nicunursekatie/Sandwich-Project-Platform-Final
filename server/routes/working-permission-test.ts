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
// This is a pure reporting tool that shows what permissions each user actually has
const PERMISSION_TESTS: PermissionTest[] = [
  // === ADMINISTRATIVE PERMISSIONS ===
  { permission: PERMISSIONS.ADMIN_ACCESS, name: 'Admin Access' },
  { permission: PERMISSIONS.MANAGE_ANNOUNCEMENTS, name: 'Manage Announcements' },
  
  // === USER MANAGEMENT ===
  { permission: PERMISSIONS.USERS_VIEW, name: 'Users View' },
  { permission: PERMISSIONS.USERS_ADD, name: 'Users Add' },
  { permission: PERMISSIONS.USERS_EDIT, name: 'Users Edit' },
  { permission: PERMISSIONS.USERS_DELETE, name: 'Users Delete' },
  
  // === HOSTS MANAGEMENT ===
  { permission: PERMISSIONS.HOSTS_VIEW, name: 'Hosts View' },
  { permission: PERMISSIONS.HOSTS_ADD, name: 'Hosts Add' },
  { permission: PERMISSIONS.HOSTS_EDIT, name: 'Hosts Edit' },
  { permission: PERMISSIONS.HOSTS_DELETE, name: 'Hosts Delete' },
  
  // === RECIPIENTS MANAGEMENT ===
  { permission: PERMISSIONS.RECIPIENTS_VIEW, name: 'Recipients View' },
  { permission: PERMISSIONS.RECIPIENTS_ADD, name: 'Recipients Add' },
  { permission: PERMISSIONS.RECIPIENTS_EDIT, name: 'Recipients Edit' },
  { permission: PERMISSIONS.RECIPIENTS_DELETE, name: 'Recipients Delete' },
  
  // === DRIVERS MANAGEMENT ===
  { permission: PERMISSIONS.DRIVERS_VIEW, name: 'Drivers View' },
  { permission: PERMISSIONS.DRIVERS_ADD, name: 'Drivers Add' },
  { permission: PERMISSIONS.DRIVERS_EDIT, name: 'Drivers Edit' },
  { permission: PERMISSIONS.DRIVERS_DELETE, name: 'Drivers Delete' },
  
  // === COLLECTIONS MANAGEMENT ===
  { permission: PERMISSIONS.COLLECTIONS_VIEW, name: 'Collections View' },
  { permission: PERMISSIONS.COLLECTIONS_ADD, name: 'Collections Add' },
  { permission: PERMISSIONS.COLLECTIONS_EDIT_OWN, name: 'Collections Edit Own' },
  { permission: PERMISSIONS.COLLECTIONS_EDIT_ALL, name: 'Collections Edit All' },
  { permission: PERMISSIONS.COLLECTIONS_DELETE_OWN, name: 'Collections Delete Own' },
  { permission: PERMISSIONS.COLLECTIONS_DELETE_ALL, name: 'Collections Delete All' },
  { permission: PERMISSIONS.COLLECTIONS_WALKTHROUGH, name: 'Collections Walkthrough' },
  
  // === PROJECTS MANAGEMENT ===
  { permission: PERMISSIONS.PROJECTS_VIEW, name: 'Projects View' },
  { permission: PERMISSIONS.PROJECTS_ADD, name: 'Projects Add' },
  { permission: PERMISSIONS.PROJECTS_EDIT_OWN, name: 'Projects Edit Own' },
  { permission: PERMISSIONS.PROJECTS_EDIT_ALL, name: 'Projects Edit All' },
  { permission: PERMISSIONS.PROJECTS_DELETE_OWN, name: 'Projects Delete Own' },
  { permission: PERMISSIONS.PROJECTS_DELETE_ALL, name: 'Projects Delete All' },
  
  // === DISTRIBUTIONS ===
  { permission: PERMISSIONS.DISTRIBUTIONS_VIEW, name: 'Distributions View' },
  { permission: PERMISSIONS.DISTRIBUTIONS_ADD, name: 'Distributions Add' },
  { permission: PERMISSIONS.DISTRIBUTIONS_EDIT, name: 'Distributions Edit' },
  { permission: PERMISSIONS.DISTRIBUTIONS_DELETE, name: 'Distributions Delete' },
  
  // === EVENT REQUESTS ===
  { permission: PERMISSIONS.EVENT_REQUESTS_VIEW, name: 'Event Requests View' },
  { permission: PERMISSIONS.EVENT_REQUESTS_ADD, name: 'Event Requests Add' },
  { permission: PERMISSIONS.EVENT_REQUESTS_EDIT, name: 'Event Requests Edit' },
  { permission: PERMISSIONS.EVENT_REQUESTS_DELETE, name: 'Event Requests Delete' },
  { permission: PERMISSIONS.EVENT_REQUESTS_DELETE_CARD, name: 'Event Requests Delete Card Button' },
  { permission: PERMISSIONS.EVENT_REQUESTS_SYNC, name: 'Event Requests Sync' },
  { permission: PERMISSIONS.EVENT_REQUESTS_COMPLETE_CONTACT, name: 'Event Requests Complete Contact' },
  
  // === MESSAGING SYSTEM ===
  { permission: PERMISSIONS.MESSAGES_VIEW, name: 'Messages View' },
  { permission: PERMISSIONS.MESSAGES_SEND, name: 'Messages Send' },
  { permission: PERMISSIONS.MESSAGES_EDIT, name: 'Messages Edit' },
  { permission: PERMISSIONS.MESSAGES_DELETE, name: 'Messages Delete' },
  { permission: PERMISSIONS.MESSAGES_MODERATE, name: 'Messages Moderate' },
  
  // === WORK LOGS ===
  { permission: PERMISSIONS.WORK_LOGS_VIEW, name: 'Work Logs View' },
  { permission: PERMISSIONS.WORK_LOGS_VIEW_ALL, name: 'Work Logs View All' },
  { permission: PERMISSIONS.WORK_LOGS_ADD, name: 'Work Logs Add' },
  { permission: PERMISSIONS.WORK_LOGS_EDIT_OWN, name: 'Work Logs Edit Own' },
  { permission: PERMISSIONS.WORK_LOGS_EDIT_ALL, name: 'Work Logs Edit All' },
  { permission: PERMISSIONS.WORK_LOGS_DELETE_OWN, name: 'Work Logs Delete Own' },
  { permission: PERMISSIONS.WORK_LOGS_DELETE_ALL, name: 'Work Logs Delete All' },
  
  // === SUGGESTIONS SYSTEM ===
  { permission: PERMISSIONS.SUGGESTIONS_VIEW, name: 'Suggestions View' },
  { permission: PERMISSIONS.SUGGESTIONS_ADD, name: 'Suggestions Add' },
  { permission: PERMISSIONS.SUGGESTIONS_EDIT_OWN, name: 'Suggestions Edit Own' },
  { permission: PERMISSIONS.SUGGESTIONS_EDIT_ALL, name: 'Suggestions Edit All' },
  { permission: PERMISSIONS.SUGGESTIONS_DELETE_OWN, name: 'Suggestions Delete Own' },
  { permission: PERMISSIONS.SUGGESTIONS_DELETE_ALL, name: 'Suggestions Delete All' },
  { permission: PERMISSIONS.SUGGESTIONS_MANAGE, name: 'Suggestions Manage' },
  
  // === CHAT PERMISSIONS ===
  { permission: PERMISSIONS.CHAT_GENERAL, name: 'Chat General' },
  { permission: PERMISSIONS.CHAT_GRANTS_COMMITTEE, name: 'Chat Grants Committee' },
  { permission: PERMISSIONS.CHAT_EVENTS_COMMITTEE, name: 'Chat Events Committee' },
  { permission: PERMISSIONS.CHAT_BOARD, name: 'Chat Board' },
  { permission: PERMISSIONS.CHAT_WEB_COMMITTEE, name: 'Chat Web Committee' },
  { permission: PERMISSIONS.CHAT_VOLUNTEER_MANAGEMENT, name: 'Chat Volunteer Management' },
  { permission: PERMISSIONS.CHAT_HOST, name: 'Chat Host' },
  { permission: PERMISSIONS.CHAT_DRIVER, name: 'Chat Driver' },
  { permission: PERMISSIONS.CHAT_RECIPIENT, name: 'Chat Recipient' },
  { permission: PERMISSIONS.CHAT_CORE_TEAM, name: 'Chat Core Team' },
  { permission: PERMISSIONS.CHAT_DIRECT, name: 'Chat Direct' },
  { permission: PERMISSIONS.CHAT_GROUP, name: 'Chat Group' },
  
  // === KUDOS SYSTEM ===
  { permission: PERMISSIONS.KUDOS_SEND, name: 'Kudos Send' },
  { permission: PERMISSIONS.KUDOS_RECEIVE, name: 'Kudos Receive' },
  { permission: PERMISSIONS.KUDOS_VIEW, name: 'Kudos View' },
  { permission: PERMISSIONS.KUDOS_MANAGE, name: 'Kudos Manage' },
  
  // === ANALYTICS & REPORTING ===
  { permission: PERMISSIONS.ANALYTICS_VIEW, name: 'Analytics View' },
  
  // === MEETINGS ===
  { permission: PERMISSIONS.MEETINGS_VIEW, name: 'Meetings View' },
  { permission: PERMISSIONS.MEETINGS_MANAGE, name: 'Meetings Manage' },
  
  // === DOCUMENTS ===
  { permission: PERMISSIONS.DOCUMENTS_VIEW, name: 'Documents View' },
  { permission: PERMISSIONS.DOCUMENTS_MANAGE, name: 'Documents Manage' },
  { permission: PERMISSIONS.DOCUMENTS_CONFIDENTIAL, name: 'Documents Confidential' },
  
  // === DATA IMPORT/EXPORT ===
  { permission: PERMISSIONS.DATA_EXPORT, name: 'Data Export' },
  { permission: PERMISSIONS.DATA_IMPORT, name: 'Data Import' },
  
  // === ORGANIZATIONS ===
  { permission: PERMISSIONS.ORGANIZATIONS_VIEW, name: 'Organizations View' },
  
  // === TOOLKIT ===
  { permission: PERMISSIONS.TOOLKIT_ACCESS, name: 'Toolkit Access' },
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
      let status = 'ERROR';
      
      if (user && userStatus === 'ACTIVE') {
        try {
          actualResult = hasPermission(user, permTest.permission);
          status = actualResult ? 'HAS_PERMISSION' : 'NO_ACCESS';
          if (actualResult) passedTests++;
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
        hasPermission: actualResult,
        status
      };

      results.push(result);
      
      if (status === 'HAS_PERMISSION') {
        console.log(`  ✅ ${permTest.name}: HAS ACCESS`);
      } else if (status === 'NO_ACCESS') {
        console.log(`  ⭕ ${permTest.name}: NO ACCESS`);
      } else {
        console.log(`  ⚠️ ${permTest.name}: ${status}`);
      }
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