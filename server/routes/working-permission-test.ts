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
  expectAdmin: boolean;
  expectChristine: boolean;
  expectJuliet: boolean;
  expectRegular: boolean;
}

// Test users we'll check permissions for
const TEST_USERS: TestUser[] = [
  { email: 'admin@sandwich.project', expectedRole: 'admin', description: 'Admin User' },
  { email: 'christine@thesandwichproject.org', expectedRole: 'core_team', description: 'Christine (Core Team)' },
  { email: 'juliet@thesandwichproject.org', expectedRole: 'core_team', description: 'Juliet (Core Team)' },
  { email: 'test2@testing.com', expectedRole: 'volunteer', description: 'Test User (Regular)' }
];

// Permissions to test
const PERMISSION_TESTS: PermissionTest[] = [
  // Admin permissions
  { permission: PERMISSIONS.ADMIN_ACCESS, name: 'Admin Access', expectAdmin: true, expectChristine: false, expectJuliet: false, expectRegular: false },
  { permission: PERMISSIONS.USERS_VIEW, name: 'Users View', expectAdmin: true, expectChristine: true, expectJuliet: true, expectRegular: false },
  { permission: PERMISSIONS.USERS_EDIT, name: 'Users Edit', expectAdmin: true, expectChristine: false, expectJuliet: false, expectRegular: false },
  
  // Host permissions
  { permission: PERMISSIONS.HOSTS_VIEW, name: 'Hosts View', expectAdmin: true, expectChristine: true, expectJuliet: true, expectRegular: false },
  { permission: PERMISSIONS.HOSTS_EDIT, name: 'Hosts Edit', expectAdmin: true, expectChristine: true, expectJuliet: true, expectRegular: false },
  
  // Collections permissions
  { permission: PERMISSIONS.COLLECTIONS_VIEW, name: 'Collections View', expectAdmin: true, expectChristine: true, expectJuliet: true, expectRegular: true },
  { permission: PERMISSIONS.COLLECTIONS_EDIT, name: 'Collections Edit', expectAdmin: true, expectChristine: true, expectJuliet: true, expectRegular: false },
  
  // Project permissions
  { permission: PERMISSIONS.PROJECTS_VIEW, name: 'Projects View', expectAdmin: true, expectChristine: true, expectJuliet: true, expectRegular: false },
  { permission: PERMISSIONS.PROJECTS_EDIT, name: 'Projects Edit', expectAdmin: true, expectChristine: true, expectJuliet: true, expectRegular: false },
  
  // Meeting permissions
  { permission: PERMISSIONS.MEETINGS_VIEW, name: 'Meetings View', expectAdmin: true, expectChristine: true, expectJuliet: true, expectRegular: false },
  { permission: PERMISSIONS.MEETINGS_EDIT, name: 'Meetings Edit', expectAdmin: true, expectChristine: true, expectJuliet: true, expectRegular: false },
  
  // Messaging permissions
  { permission: PERMISSIONS.MESSAGES_VIEW, name: 'Messages View', expectAdmin: true, expectChristine: true, expectJuliet: true, expectRegular: false },
  { permission: PERMISSIONS.SEND_KUDOS, name: 'Send Kudos', expectAdmin: true, expectChristine: true, expectJuliet: true, expectRegular: false }
];

router.get('/matrix', async (req, res) => {
  console.log('\n🧪 Starting Permission Matrix Test...');
  
  const results: any[] = [];
  let totalTests = 0;
  let passedTests = 0;

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
      
      // Determine expected result based on user
      switch (testUser.email) {
        case 'admin@sandwich.project':
          expectedResult = permTest.expectAdmin;
          break;
        case 'christine@thesandwichproject.org':
          expectedResult = permTest.expectChristine;
          break;
        case 'juliet@thesandwichproject.org':
          expectedResult = permTest.expectJuliet;
          break;
        case 'test2@testing.com':
          expectedResult = permTest.expectRegular;
          break;
      }

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