import express from 'express';
import { PERMISSIONS } from '@shared/auth-utils';
import { storage } from '../storage-wrapper';

const router = express.Router();

// Simple health check endpoint (no auth required)
router.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'Permission test routes are working',
    timestamp: new Date().toISOString(),
    availableEndpoints: [
      'GET /api/permission-test/health',
      'GET /api/permission-test/verify-permissions',
      'GET /api/permission-test/test-permission/:permission'
    ]
  });
});

// Test endpoint to verify current permission system is working correctly
router.get('/verify-permissions', async (req, res) => {
  console.log('Permission test - Session exists:', !!req.session);
  console.log('Permission test - Session user exists:', !!req.session?.user);
  console.log('Permission test - req.user exists:', !!req.user);
  try {
    const user = req.user || req.session?.user;
    
    if (!user) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    // Get fresh user data from database
    let currentUser = user;
    if (user.email) {
      try {
        const freshUser = await storage.getUserByEmail(user.email);
        if (freshUser && freshUser.isActive) {
          currentUser = freshUser;
        }
      } catch (error) {
        console.error('Error fetching fresh user data:', error);
      }
    }

    // Test core administrative permissions that admin should have
    const adminPermissionTests = [
      { permission: PERMISSIONS.ADMIN_ACCESS, description: 'Admin Access' },
      { permission: PERMISSIONS.USERS_VIEW, description: 'Users View' },
      { permission: PERMISSIONS.USERS_EDIT, description: 'Users Edit' },
      { permission: PERMISSIONS.HOSTS_VIEW, description: 'Hosts View' },
      { permission: PERMISSIONS.HOSTS_EDIT, description: 'Hosts Edit' },
      { permission: PERMISSIONS.RECIPIENTS_VIEW, description: 'Recipients View' },
      { permission: PERMISSIONS.COLLECTIONS_VIEW, description: 'Collections View' },
      { permission: PERMISSIONS.PROJECTS_VIEW, description: 'Projects View' },
      { permission: PERMISSIONS.ANALYTICS_VIEW, description: 'Analytics View' }
    ];

    // Test chat permissions
    const chatPermissionTests = [
      { permission: PERMISSIONS.CHAT_GENERAL, description: 'General Chat' },
      { permission: PERMISSIONS.CHAT_HOST, description: 'Host Chat' },
      { permission: PERMISSIONS.CHAT_DRIVER, description: 'Driver Chat' },
      { permission: PERMISSIONS.CHAT_CORE_TEAM, description: 'Core Team Chat' },
      { permission: PERMISSIONS.CHAT_BOARD, description: 'Board Chat' }
    ];

    // Test messaging permissions
    const messagingPermissionTests = [
      { permission: PERMISSIONS.MESSAGES_VIEW, description: 'Messages View' },
      { permission: PERMISSIONS.MESSAGES_SEND, description: 'Messages Send' },
      { permission: PERMISSIONS.KUDOS_SEND, description: 'Kudos Send' },
      { permission: PERMISSIONS.KUDOS_VIEW, description: 'Kudos View' }
    ];

    // Helper function to test permissions
    const testPermissions = (tests: any[], expectedForAdmin = true) => {
      return tests.map(test => {
        const hasPermission = currentUser.permissions && Array.isArray(currentUser.permissions) 
          ? currentUser.permissions.includes(test.permission)
          : false;
        
        const isAdmin = currentUser.role === 'admin' || currentUser.role === 'super_admin';
        const expected = isAdmin ? expectedForAdmin : false; // For non-admin users, we expect false for most permissions
        
        return {
          ...test,
          actual: hasPermission,
          passed: hasPermission === expected,
          adminBypass: isAdmin && !hasPermission // Admin should have access even without explicit permission
        };
      });
    };

    // Run all permission tests
    const adminResults = testPermissions(adminPermissionTests);
    const chatResults = testPermissions(chatPermissionTests);
    const messagingResults = testPermissions(messagingPermissionTests);

    // Test some permissions that shouldn't exist
    const invalidPermissionTests = [
      { permission: 'INVALID_PERMISSION', description: 'Invalid Permission Test' },
      { permission: 'host_chat', description: 'Old lowercase host_chat (should not exist)' },
      { permission: 'core_team_chat', description: 'Old lowercase core_team_chat (should not exist)' }
    ];
    const invalidResults = testPermissions(invalidPermissionTests, false); // Even admin shouldn't have these

    // Calculate summary
    const allResults = [...adminResults, ...chatResults, ...messagingResults, ...invalidResults];
    const totalPassed = allResults.filter(r => r.passed).length;
    const totalTests = allResults.length;

    // Check if user structure is correct
    const userStructureCheck = {
      hasId: !!currentUser.id,
      hasEmail: !!currentUser.email,
      hasRole: !!currentUser.role,
      hasPermissions: Array.isArray(currentUser.permissions),
      permissionCount: Array.isArray(currentUser.permissions) ? currentUser.permissions.length : 0,
      isActive: currentUser.isActive !== false
    };

    res.json({
      user: {
        id: currentUser.id,
        email: currentUser.email,
        role: currentUser.role,
        isActive: currentUser.isActive,
        permissionCount: Array.isArray(currentUser.permissions) ? currentUser.permissions.length : 0,
        permissions: Array.isArray(currentUser.permissions) ? currentUser.permissions.slice(0, 10) : [] // Show first 10 permissions
      },
      userStructureCheck,
      permissionTests: {
        administrative: {
          results: adminResults,
          summary: `${adminResults.filter(r => r.passed).length}/${adminResults.length} admin tests passed`
        },
        chat: {
          results: chatResults,
          summary: `${chatResults.filter(r => r.passed).length}/${chatResults.length} chat tests passed`
        },
        messaging: {
          results: messagingResults,
          summary: `${messagingResults.filter(r => r.passed).length}/${messagingResults.length} messaging tests passed`
        },
        invalid: {
          results: invalidResults,
          summary: `${invalidResults.filter(r => r.passed).length}/${invalidResults.length} invalid permission tests passed (should be 0)`
        }
      },
      overallSummary: `${totalPassed}/${totalTests} total tests passed`,
      overallStatus: totalPassed === totalTests ? 'ALL_TESTS_PASSED' : 'SOME_TESTS_FAILED',
      recommendations: totalPassed < totalTests ? [
        'Check that user has correct role assignment',
        'Verify permission array is properly populated',
        'Ensure admin users have proper access',
        'Check authentication middleware is working'
      ] : ['All permission tests passed successfully!']
    });
    
  } catch (error: any) {
    console.error('Permission test error:', error);
    res.status(500).json({
      error: 'Permission test failed',
      message: error.message,
      stack: error.stack
    });
  }
});

// Test specific permission endpoint  
router.get('/test-permission/:permission', async (req, res) => {
  try {
    const permission = req.params.permission;
    const user = req.user || req.session?.user;
    
    if (!user) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    // Get fresh user data
    let currentUser = user;
    if (user.email) {
      try {
        const freshUser = await storage.getUserByEmail(user.email);
        if (freshUser && freshUser.isActive) {
          currentUser = freshUser;
        }
      } catch (error) {
        console.error('Error fetching fresh user data:', error);
      }
    }

    const hasPermission = currentUser.permissions && Array.isArray(currentUser.permissions) 
      ? currentUser.permissions.includes(permission)
      : false;

    const isAdmin = currentUser.role === 'admin' || currentUser.role === 'super_admin';

    res.json({
      permission,
      hasPermission,
      isAdmin,
      userRole: currentUser.role,
      userId: currentUser.id,
      email: currentUser.email,
      allPermissions: Array.isArray(currentUser.permissions) ? currentUser.permissions : [],
      adminBypass: isAdmin,
      effectiveAccess: hasPermission || isAdmin
    });
    
  } catch (error: any) {
    console.error('Single permission test error:', error);
    res.status(500).json({
      error: 'Permission test failed',
      message: error.message
    });
  }
});

export default router;