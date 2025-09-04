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

// Permissions to test - expectations based on role hierarchy
const PERMISSION_TESTS: PermissionTest[] = [
  // Admin-only permissions
  { permission: PERMISSIONS.ADMIN_ACCESS, name: 'Admin Access', 
    shouldHavePermission: (role) => role === 'admin' || role === 'super_admin' },
  { permission: PERMISSIONS.USERS_EDIT, name: 'Users Edit', 
    shouldHavePermission: (role) => role === 'admin' || role === 'super_admin' },
  
  // Management permissions (admin + core_team)
  { permission: PERMISSIONS.USERS_VIEW, name: 'Users View', 
    shouldHavePermission: (role) => ['admin', 'super_admin', 'core_team'].includes(role) },
  { permission: PERMISSIONS.HOSTS_VIEW, name: 'Hosts View', 
    shouldHavePermission: (role) => ['admin', 'super_admin', 'core_team', 'committee_member'].includes(role) },
  { permission: PERMISSIONS.HOSTS_EDIT, name: 'Hosts Edit', 
    shouldHavePermission: (role) => ['admin', 'super_admin', 'core_team'].includes(role) },
  
  // Collections permissions
  { permission: PERMISSIONS.COLLECTIONS_VIEW, name: 'Collections View', 
    shouldHavePermission: (role) => true }, // Everyone can view
  { permission: PERMISSIONS.COLLECTIONS_EDIT_ALL, name: 'Collections Edit All', 
    shouldHavePermission: (role) => ['admin', 'super_admin', 'core_team'].includes(role) },
  
  // Project permissions
  { permission: PERMISSIONS.PROJECTS_VIEW, name: 'Projects View', 
    shouldHavePermission: (role) => ['admin', 'super_admin', 'core_team', 'committee_member'].includes(role) },
  { permission: PERMISSIONS.PROJECTS_EDIT_ALL, name: 'Projects Edit All', 
    shouldHavePermission: (role) => ['admin', 'super_admin', 'core_team'].includes(role) },
  
  // Meeting permissions  
  { permission: PERMISSIONS.MEETINGS_VIEW, name: 'Meetings View', 
    shouldHavePermission: (role) => ['admin', 'super_admin', 'core_team', 'committee_member'].includes(role) },
  { permission: PERMISSIONS.MEETINGS_MANAGE, name: 'Meetings Manage', 
    shouldHavePermission: (role) => ['admin', 'super_admin', 'core_team'].includes(role) },
  
  // Communication permissions
  { permission: PERMISSIONS.MESSAGES_VIEW, name: 'Messages View', 
    shouldHavePermission: (role) => ['admin', 'super_admin', 'core_team', 'committee_member'].includes(role) },
  { permission: PERMISSIONS.SEND_KUDOS, name: 'Send Kudos', 
    shouldHavePermission: (role) => ['admin', 'super_admin', 'core_team', 'committee_member'].includes(role) },
  
  // Suggestions permissions
  { permission: PERMISSIONS.SUGGESTIONS_VIEW, name: 'Suggestions View', 
    shouldHavePermission: (role) => ['admin', 'super_admin', 'core_team', 'committee_member'].includes(role) },
  { permission: PERMISSIONS.SUGGESTIONS_ADD, name: 'Suggestions Add', 
    shouldHavePermission: (role) => ['admin', 'super_admin', 'core_team', 'committee_member'].includes(role) },
  { permission: PERMISSIONS.SUGGESTIONS_MANAGE, name: 'Suggestions Manage', 
    shouldHavePermission: (role) => ['admin', 'super_admin', 'core_team'].includes(role) }
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