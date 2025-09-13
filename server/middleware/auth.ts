import type { RequestHandler } from "express";
import { storage } from "../storage-wrapper";
import { PERMISSIONS } from "../../shared/auth-utils";

// Single, authoritative requirePermission middleware
// DENIES ACCESS BY DEFAULT - only grants access if explicitly authorized
export const requirePermission = (permission: string): RequestHandler => {
  return async (req: any, res, next) => {
    try {
      // STEP 1: Ensure user is authenticated - DENY if not
      const user = req.user || req.session?.user;
      if (!user) {
        console.log(`❌ AUTH: No user context for ${permission} - DENIED`);
        return res.status(401).json({ message: "Authentication required" });
      }

      // STEP 2: Fetch fresh user data to ensure current permissions
      let currentUser = user;
      if (user.email) {
        try {
          const freshUser = await storage.getUserByEmail(user.email);
          if (freshUser && freshUser.isActive) {
            currentUser = freshUser;
            req.user = freshUser;
          } else {
            console.log(`❌ AUTH: User ${user.email} not found or inactive - DENIED`);
            return res.status(401).json({ message: "User account not found or inactive" });
          }
        } catch (dbError) {
          console.error("Database error fetching user in requirePermission:", dbError);
          // DENY access if we can't verify user status
          return res.status(500).json({ message: "Unable to verify user permissions" });
        }
      }

      // STEP 3: Admin bypass for FEATURE permissions only (not user-private data)
      if (currentUser.role === "super_admin" || currentUser.role === "admin") {
        console.log(`✅ AUTH: Admin access granted for ${permission} to ${currentUser.email}`);
        return next();
      }

      // STEP 4: Check specific permission - DENY if not found
      if (currentUser.permissions && Array.isArray(currentUser.permissions) && currentUser.permissions.includes(permission)) {
        console.log(`✅ AUTH: Permission ${permission} granted to ${currentUser.email}`);
        return next();
      }

      // DEFAULT: DENY ACCESS
      console.log(`❌ AUTH: Permission ${permission} DENIED for ${currentUser.email} (role: ${currentUser.role})`);
      console.log(`   Available permissions:`, currentUser.permissions);
      return res.status(403).json({ 
        message: "Insufficient permissions",
        required: permission,
        userRole: currentUser.role,
        userPermissions: currentUser.permissions || []
      });
    } catch (error) {
      console.error("❌ AUTH: Permission check failed:", error);
      // DENY access on any error
      return res.status(500).json({ message: "Permission check failed" });
    }
  };
};

// Helper function for ownership-aware permission checks
export const requireOwnershipPermission = (ownPermission: string, allPermission: string, getResourceUserId: (req: any) => Promise<string | null>): RequestHandler => {
  return async (req: any, res, next) => {
    try {
      // STEP 1: Ensure user is authenticated
      const user = req.user || req.session?.user;
      if (!user) {
        console.log(`❌ AUTH: No user context for ownership check - DENIED`);
        return res.status(401).json({ message: "Authentication required" });
      }

      // STEP 2: Fetch fresh user data
      let currentUser = user;
      if (user.email) {
        try {
          const freshUser = await storage.getUserByEmail(user.email);
          if (freshUser && freshUser.isActive) {
            currentUser = freshUser;
            req.user = freshUser;
          } else {
            return res.status(401).json({ message: "User account not found or inactive" });
          }
        } catch (dbError) {
          console.error("Database error in ownership check:", dbError);
          return res.status(500).json({ message: "Unable to verify user permissions" });
        }
      }

      // STEP 3: Admin bypass
      if (currentUser.role === "super_admin" || currentUser.role === "admin") {
        console.log(`✅ AUTH: Admin access granted for ${allPermission} to ${currentUser.email}`);
        return next();
      }

      // STEP 4: Check for "ALL" permission first (can edit any resource)
      if (currentUser.permissions && Array.isArray(currentUser.permissions) && currentUser.permissions.includes(allPermission)) {
        console.log(`✅ AUTH: ALL permission ${allPermission} granted to ${currentUser.email}`);
        return next();
      }

      // STEP 5: Check for "OWN" permission and verify ownership
      if (currentUser.permissions && Array.isArray(currentUser.permissions) && currentUser.permissions.includes(ownPermission)) {
        const resourceUserId = await getResourceUserId(req);
        if (resourceUserId === currentUser.id || resourceUserId === null) {
          if (resourceUserId === null) {
            console.log(`✅ AUTH: OWN permission ${ownPermission} granted to ${currentUser.email} (ownerless resource)`);
          } else {
            console.log(`✅ AUTH: OWN permission ${ownPermission} granted to ${currentUser.email} (owns resource)`);
          }
          return next();
        } else {
          console.log(`❌ AUTH: OWN permission ${ownPermission} DENIED for ${currentUser.email} (not owner: ${resourceUserId} vs ${currentUser.id})`);
          return res.status(403).json({ message: "Can only edit own resources" });
        }
      }

      // DEFAULT: DENY ACCESS
      console.log(`❌ AUTH: No ownership permissions for ${currentUser.email}`);
      return res.status(403).json({ 
        message: "Insufficient permissions",
        required: `${ownPermission} or ${allPermission}`,
        userPermissions: currentUser.permissions || []
      });
    } catch (error) {
      console.error("❌ AUTH: Ownership check failed:", error);
      return res.status(500).json({ message: "Permission check failed" });
    }
  };
};