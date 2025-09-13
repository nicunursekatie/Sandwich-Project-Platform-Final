import { Router } from "express";
import createAdminRoutes from "./admin";
import createAuthRoutes from "./auth";
import createGroupsCatalogRoutes from "./groups-catalog";

interface RouterDependencies {
  isAuthenticated: any;
  requirePermission: any;
  sessionStore: any;
}

export function createMainRoutes(deps: RouterDependencies) {
  const router = Router();

  // Mount admin routes
  const adminRoutes = createAdminRoutes({
    isAuthenticated: deps.isAuthenticated,
    requirePermission: deps.requirePermission,
    sessionStore: deps.sessionStore
  });
  router.use("/api", adminRoutes);

  // Mount auth routes
  const authRoutes = createAuthRoutes({
    isAuthenticated: deps.isAuthenticated
  });
  router.use("/api/auth", authRoutes);

  // Mount groups catalog routes
  const groupsCatalogRoutes = createGroupsCatalogRoutes({
    isAuthenticated: deps.isAuthenticated
  });
  router.use("/api/groups-catalog", groupsCatalogRoutes);

  return router;
}

// Backwards compatibility exports
export { createMainRoutes as apiRoutes };
export default createMainRoutes;