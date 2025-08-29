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