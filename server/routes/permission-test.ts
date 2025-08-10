import express from 'express';
import { hasPermission, hasAccessToChat } from '@shared/auth-utils';
import { isAuthenticated } from '../middleware/auth';

const router = express.Router();

// Test endpoint to verify permission system is working correctly
router.get('/verify-permissions', isAuthenticated, (req, res) => {
  try {
    const user = req.user;
    
    if (!user) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const permissionTests = [
      // Test case variations for permissions
      { permission: 'host_chat', expected: true, description: 'host_chat (lowercase)' },
      { permission: 'HOST_CHAT', expected: true, description: 'HOST_CHAT (uppercase)' },
      { permission: 'Host_Chat', expected: true, description: 'Host_Chat (mixed case)' },
      { permission: 'driver_chat', expected: true, description: 'driver_chat (lowercase)' },
      { permission: 'DRIVER_CHAT', expected: true, description: 'DRIVER_CHAT (uppercase)' },
      { permission: 'core_team_chat', expected: true, description: 'core_team_chat (lowercase)' },
      { permission: 'CORE_TEAM_CHAT', expected: true, description: 'CORE_TEAM_CHAT (uppercase)' },
      { permission: 'recipient_chat', expected: null, description: 'recipient_chat (check if exists)' },
      { permission: 'RECIPIENT_CHAT', expected: null, description: 'RECIPIENT_CHAT (check if exists)' },
      { permission: 'nonexistent_permission', expected: false, description: 'nonexistent_permission (should fail)' }
    ];

    const chatAccessTests = [
      { chatRoom: 'host', expected: true, description: 'host chat access' },
      { chatRoom: 'hosts', expected: true, description: 'hosts chat access (plural)' },
      { chatRoom: 'driver', expected: true, description: 'driver chat access' },
      { chatRoom: 'drivers', expected: true, description: 'drivers chat access (plural)' },
      { chatRoom: 'core-team', expected: true, description: 'core-team chat access' },
      { chatRoom: 'general', expected: true, description: 'general chat access' },
      { chatRoom: 'recipient', expected: null, description: 'recipient chat access (check if exists)' },
      { chatRoom: 'nonexistent', expected: false, description: 'nonexistent chat (should fail)' }
    ];

    // Run permission tests
    const permissionResults = permissionTests.map(test => {
      const result = hasPermission(user, test.permission);
      return {
        ...test,
        actual: result,
        passed: test.expected === null ? null : result === test.expected
      };
    });

    // Run chat access tests
    const chatResults = chatAccessTests.map(test => {
      const result = hasAccessToChat(user, test.chatRoom);
      return {
        ...test,
        actual: result,
        passed: test.expected === null ? null : result === test.expected
      };
    });

    // Calculate summary
    const permissionsPassed = permissionResults.filter(r => r.passed === true).length;
    const permissionsTotal = permissionResults.filter(r => r.passed !== null).length;
    const chatPassed = chatResults.filter(r => r.passed === true).length;
    const chatTotal = chatResults.filter(r => r.passed !== null).length;

    res.json({
      user: {
        email: user.email,
        role: user.role,
        totalPermissions: user.permissions?.length || 0,
        permissions: user.permissions || []
      },
      permissionTests: {
        results: permissionResults,
        summary: `${permissionsPassed}/${permissionsTotal} permission tests passed`
      },
      chatAccessTests: {
        results: chatResults,
        summary: `${chatPassed}/${chatTotal} chat access tests passed`
      },
      overallStatus: (permissionsPassed === permissionsTotal && chatPassed === chatTotal) ? 'ALL_TESTS_PASSED' : 'SOME_TESTS_FAILED'
    });
    
  } catch (error: any) {
    console.error('Permission test error:', error);
    res.status(500).json({
      error: 'Permission test failed',
      message: error.message
    });
  }
});

export default router;