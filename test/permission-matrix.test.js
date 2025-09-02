const request = require('supertest');

// Test configuration
const API_BASE = 'http://localhost:5000';

// Define test users with their expected permissions (using real users from your system)
const TEST_USERS = [
  {
    email: 'admin@sandwich.project',
    password: 'password123',
    role: 'super_admin',
    expected_permissions: ['all'] // Super admin should access everything
  },
  {
    email: 'christine@thesandwichproject.org',
    password: 'password123', 
    role: 'core_team',
    expected_permissions: ['meetings_manage', 'projects_view', 'projects_edit_all', 'send_to_agenda']
  },
  {
    email: 'juliet@thesandwichproject.org',
    password: 'password123',
    role: 'volunteer', 
    expected_permissions: ['projects_view', 'meetings_view'] // Volunteer has limited access
  },
  {
    email: 'test2@testing.com',
    password: 'password123',
    role: 'viewer',
    expected_permissions: ['projects_view'] // Viewer has minimal access
  }
];

// Define critical endpoints with their permission requirements
const CRITICAL_ENDPOINTS = [
  {
    method: 'GET',
    path: '/api/projects',
    name: 'List Projects',
    permission_needed: 'projects_view',
    expected_users: ['admin@sandwich.project', 'christine@thesandwichproject.org', 'katielong2316@gmail.com']
  },
  {
    method: 'GET', 
    path: '/api/meetings',
    name: 'List Meetings',
    permission_needed: 'meetings_view',
    expected_users: ['admin@sandwich.project', 'christine@thesandwichproject.org', 'katielong2316@gmail.com']
  },
  {
    method: 'PATCH',
    path: '/api/projects/49',
    name: 'Send to Agenda (Meeting Management)',
    body: { reviewInNextMeeting: true },
    permission_needed: 'meetings_manage',
    expected_users: ['admin@sandwich.project', 'christine@thesandwichproject.org']
  },
  {
    method: 'PATCH',
    path: '/api/projects/49', 
    name: 'Edit Project Details',
    body: { title: 'Updated Project Title' },
    permission_needed: 'projects_edit',
    expected_users: ['admin@sandwich.project', 'christine@thesandwichproject.org']
  },
  {
    method: 'POST',
    path: '/api/projects',
    name: 'Create Project',
    body: { title: 'Test Project', description: 'Test Description', status: 'planning' },
    permission_needed: 'projects_create',
    expected_users: ['admin@sandwich.project', 'christine@thesandwichproject.org']
  }
];

// Helper function to login and get session cookie
async function loginUser(email, password) {
  try {
    const response = await request(API_BASE)
      .post('/api/auth/login')
      .send({ email, password });
      
    if (response.status !== 200) {
      throw new Error(`Login failed for ${email}: ${response.body?.message || response.status}`);
    }
    
    const cookies = response.headers['set-cookie'];
    return cookies ? cookies[0] : null;
  } catch (error) {
    console.error(`❌ Login failed for ${email}:`, error.message);
    return null;
  }
}

// Helper function to test endpoint access
async function testEndpointAccess(cookie, endpoint) {
  try {
    let req = request(API_BASE);
    
    // Set HTTP method
    if (endpoint.method === 'GET') req = req.get(endpoint.path);
    else if (endpoint.method === 'POST') req = req.post(endpoint.path);
    else if (endpoint.method === 'PATCH') req = req.patch(endpoint.path);
    else if (endpoint.method === 'DELETE') req = req.delete(endpoint.path);
    
    // Add cookie for authentication
    if (cookie) req = req.set('Cookie', cookie);
    
    // Add body if needed
    if (endpoint.body) req = req.send(endpoint.body);
    
    const response = await req;
    
    return {
      status: response.status,
      success: response.status >= 200 && response.status < 300,
      data: response.body
    };
  } catch (error) {
    return {
      status: error.response?.status || 500,
      success: false,
      error: error.message
    };
  }
}

// Main permission matrix test runner
async function runPermissionMatrix() {
  console.log('🧪 Starting Permission Matrix Test Suite');
  console.log('=' .repeat(60));
  
  const results = [];
  const failures = [];
  
  for (const user of TEST_USERS) {
    console.log(`\n👤 Testing user: ${user.email} (${user.role})`);
    
    // Login as this user
    const cookie = await loginUser(user.email, user.password);
    if (!cookie) {
      failures.push(`Failed to login as ${user.email}`);
      continue;
    }
    
    // Test each endpoint
    for (const endpoint of CRITICAL_ENDPOINTS) {
      const shouldHaveAccess = endpoint.expected_users.includes(user.email);
      
      console.log(`  🔍 Testing: ${endpoint.method} ${endpoint.path}`);
      
      const result = await testEndpointAccess(cookie, endpoint);
      
      const testResult = {
        user: user.email,
        endpoint: `${endpoint.method} ${endpoint.path}`,
        name: endpoint.name,
        expected: shouldHaveAccess ? 'ALLOW' : 'DENY',
        actual: result.success ? 'ALLOW' : (result.status === 403 ? 'DENY' : `ERROR_${result.status}`),
        status_code: result.status,
        match: (shouldHaveAccess && result.success) || (!shouldHaveAccess && result.status === 403)
      };
      
      results.push(testResult);
      
      if (testResult.match) {
        console.log(`    ✅ ${endpoint.name}: ${testResult.actual} (expected ${testResult.expected})`);
      } else {
        console.log(`    ❌ ${endpoint.name}: ${testResult.actual} (expected ${testResult.expected})`);
        failures.push(`${user.email}: ${endpoint.name} - expected ${testResult.expected}, got ${testResult.actual}`);
      }
    }
  }
  
  // Print comprehensive results
  console.log('\n📊 PERMISSION MATRIX RESULTS:');
  console.log('=' .repeat(80));
  console.table(results);
  
  // Print failures summary
  if (failures.length > 0) {
    console.log('\n🚨 PERMISSION FAILURES DETECTED:');
    console.log('=' .repeat(50));
    failures.forEach(failure => console.log(`❌ ${failure}`));
    console.log(`\nTotal failures: ${failures.length}`);
    process.exit(1);
  } else {
    console.log('\n🎉 ALL PERMISSION TESTS PASSED!');
    console.log('✅ Authentication and authorization working correctly');
    process.exit(0);
  }
}

// Run the test if this file is executed directly
if (require.main === module) {
  runPermissionMatrix().catch(error => {
    console.error('💥 Test suite crashed:', error);
    process.exit(1);
  });
}

module.exports = { runPermissionMatrix, TEST_USERS, CRITICAL_ENDPOINTS };