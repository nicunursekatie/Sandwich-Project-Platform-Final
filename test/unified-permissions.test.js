/**
 * Unified Permissions System Test
 * 
 * Tests the new unified permission checking system to ensure
 * frontend and backend behavior is consistent.
 */

const { checkPermission, checkOwnershipPermission, hasPermission, debugPermissions } = require('../shared/unified-auth-utils');
const { PERMISSIONS } = require('../shared/auth-utils');

describe('Unified Permission System', () => {
  
  describe('Basic Permission Checking', () => {
    
    test('should deny access for null user', () => {
      const result = checkPermission(null, PERMISSIONS.HOSTS_VIEW);
      expect(result.granted).toBe(false);
      expect(result.reason).toBe('No user provided');
    });

    test('should deny access for invalid permission', () => {
      const user = { id: '1', role: 'volunteer', permissions: [] };
      const result = checkPermission(user, '');
      expect(result.granted).toBe(false);
      expect(result.reason).toBe('Invalid permission string');
    });

    test('should deny access for inactive user', () => {
      const user = { 
        id: '1', 
        role: 'volunteer', 
        permissions: [PERMISSIONS.HOSTS_VIEW],
        isActive: false 
      };
      const result = checkPermission(user, PERMISSIONS.HOSTS_VIEW);
      expect(result.granted).toBe(false);
      expect(result.reason).toBe('User account is inactive');
    });

    test('should grant access for super admin', () => {
      const user = { id: '1', role: 'super_admin', permissions: [] };
      const result = checkPermission(user, PERMISSIONS.HOSTS_VIEW);
      expect(result.granted).toBe(true);
      expect(result.reason).toBe('Super admin access');
    });

    test('should grant access for user with permission', () => {
      const user = { 
        id: '1', 
        role: 'volunteer', 
        permissions: [PERMISSIONS.HOSTS_VIEW] 
      };
      const result = checkPermission(user, PERMISSIONS.HOSTS_VIEW);
      expect(result.granted).toBe(true);
      expect(result.reason).toBe('Permission granted');
    });

    test('should deny access for user without permission', () => {
      const user = { 
        id: '1', 
        role: 'volunteer', 
        permissions: [PERMISSIONS.DRIVERS_VIEW] 
      };
      const result = checkPermission(user, PERMISSIONS.HOSTS_VIEW);
      expect(result.granted).toBe(false);
      expect(result.reason).toContain('not found in user permissions');
    });

    test('should reject bitmask permissions', () => {
      const user = { 
        id: '1', 
        role: 'volunteer', 
        permissions: 123 // bitmask format
      };
      const result = checkPermission(user, PERMISSIONS.HOSTS_VIEW);
      expect(result.granted).toBe(false);
      expect(result.reason).toContain('Unsupported permission format');
    });
  });

  describe('Ownership Permission Checking', () => {
    
    test('should grant access with ALL permission', () => {
      const user = { 
        id: '1', 
        role: 'admin', 
        permissions: [PERMISSIONS.COLLECTIONS_EDIT_ALL] 
      };
      const result = checkOwnershipPermission(
        user,
        PERMISSIONS.COLLECTIONS_EDIT_OWN,
        PERMISSIONS.COLLECTIONS_EDIT_ALL,
        'other_user_id'
      );
      expect(result.granted).toBe(true);
      expect(result.reason).toBe('All-access permission granted');
    });

    test('should grant access with OWN permission for owned resource', () => {
      const user = { 
        id: '1', 
        role: 'volunteer', 
        permissions: [PERMISSIONS.COLLECTIONS_EDIT_OWN] 
      };
      const result = checkOwnershipPermission(
        user,
        PERMISSIONS.COLLECTIONS_EDIT_OWN,
        PERMISSIONS.COLLECTIONS_EDIT_ALL,
        '1' // user owns this resource
      );
      expect(result.granted).toBe(true);
      expect(result.reason).toBe('Own-resource permission granted');
    });

    test('should deny access with OWN permission for non-owned resource', () => {
      const user = { 
        id: '1', 
        role: 'volunteer', 
        permissions: [PERMISSIONS.COLLECTIONS_EDIT_OWN] 
      };
      const result = checkOwnershipPermission(
        user,
        PERMISSIONS.COLLECTIONS_EDIT_OWN,
        PERMISSIONS.COLLECTIONS_EDIT_ALL,
        '2' // user does not own this resource
      );
      expect(result.granted).toBe(false);
      expect(result.reason).toBe('User does not own this resource');
    });

    test('should require resource owner ID for OWN permission', () => {
      const user = { 
        id: '1', 
        role: 'volunteer', 
        permissions: [PERMISSIONS.COLLECTIONS_EDIT_OWN] 
      };
      const result = checkOwnershipPermission(
        user,
        PERMISSIONS.COLLECTIONS_EDIT_OWN,
        PERMISSIONS.COLLECTIONS_EDIT_ALL
        // No resource owner ID provided
      );
      expect(result.granted).toBe(false);
      expect(result.reason).toBe('Resource owner ID required for ownership check');
    });
  });

  describe('Frontend Compatibility', () => {
    
    test('hasPermission should return boolean', () => {
      const user = { 
        id: '1', 
        role: 'volunteer', 
        permissions: [PERMISSIONS.HOSTS_VIEW] 
      };
      
      const hasAccess = hasPermission(user, PERMISSIONS.HOSTS_VIEW);
      expect(typeof hasAccess).toBe('boolean');
      expect(hasAccess).toBe(true);
      
      const noAccess = hasPermission(user, PERMISSIONS.DRIVERS_VIEW);
      expect(noAccess).toBe(false);
    });
  });

  describe('Debug Utilities', () => {
    
    test('should provide debug information', () => {
      const user = { 
        id: '1', 
        role: 'volunteer', 
        permissions: [PERMISSIONS.HOSTS_VIEW] 
      };
      
      const debug = debugPermissions(user, PERMISSIONS.HOSTS_VIEW);
      expect(debug.userId).toBe('1');
      expect(debug.userRole).toBe('volunteer');
      expect(debug.permissionFormat).toBe('array');
      expect(debug.permissionCheck.granted).toBe(true);
    });
  });

  describe('Edge Cases', () => {
    
    test('should handle null permissions', () => {
      const user = { 
        id: '1', 
        role: 'volunteer', 
        permissions: null 
      };
      const result = checkPermission(user, PERMISSIONS.HOSTS_VIEW);
      expect(result.granted).toBe(false);
    });

    test('should handle undefined permissions', () => {
      const user = { 
        id: '1', 
        role: 'volunteer' 
        // permissions undefined
      };
      const result = checkPermission(user, PERMISSIONS.HOSTS_VIEW);
      expect(result.granted).toBe(false);
    });

    test('should handle empty permissions array', () => {
      const user = { 
        id: '1', 
        role: 'volunteer', 
        permissions: [] 
      };
      const result = checkPermission(user, PERMISSIONS.HOSTS_VIEW);
      expect(result.granted).toBe(false);
      expect(result.reason).toContain('not found in user permissions');
    });
  });

  describe('Case Sensitivity', () => {
    
    test('should be case-sensitive (no fallbacks)', () => {
      const user = { 
        id: '1', 
        role: 'volunteer', 
        permissions: ['hosts_view'] // lowercase
      };
      const result = checkPermission(user, 'HOSTS_VIEW'); // uppercase
      expect(result.granted).toBe(false);
      expect(result.reason).toContain('not found in user permissions');
    });

    test('should match exact permission strings', () => {
      const user = { 
        id: '1', 
        role: 'volunteer', 
        permissions: ['HOSTS_VIEW'] // exact match
      };
      const result = checkPermission(user, 'HOSTS_VIEW');
      expect(result.granted).toBe(true);
    });
  });
});

console.log('🧪 Unified Permission System Tests Ready!');
console.log('Run: npm test unified-permissions.test.js');
