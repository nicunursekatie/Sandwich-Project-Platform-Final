# Routing System Consolidation Plan

## Current Problem

We have **TWO routing systems** running in parallel:

### 1. **Modular System** (✅ Good - Modern, Standardized)
- Location: `server/routes/index.ts` (createMainRoutes)
- Uses: `RouterDependencies` pattern
- Benefits:
  - Consistent authentication middleware
  - Standardized error handling
  - Proper dependency injection
  - Better testability
  - Activity logging built-in

### 2. **Legacy System** (❌ Problem - Fragmented, Inconsistent)
- Location: `server/routes.ts` (registerRoutes function)
- Issues:
  - Direct imports scattered throughout
  - Inconsistent middleware application
  - Some routes bypass security
  - Direct storage singleton access
  - Hard to maintain

## Routes Currently in Legacy System

**Need to migrate these to modular system:**

1. `/api/drivers` - Entity management
2. `/api/volunteers` - Entity management
3. `/api/hosts` - Entity management (partial - some already in modular)
4. `/api/recipients` - Entity management (duplicate!)
5. `/api/recipient-tsp-contacts` - Related entity
6. `/api/event-requests` - Event management (duplicate!)
7. `/api/event-reminders` - Event management
8. `/api/sandwich-distributions` - Data management
9. `/api/import` - Import functionality
10. `/api/emails` - Communication
11. `/api/stream` - Communication (duplicate!)
12. `/api/onboarding` - Gamification
13. `/api/google-sheets` - External integrations
14. `/api/google-calendar` - External integrations
15. `/api/monitoring` - System monitoring (duplicate!)
16. `/api/routes` - Route optimization
17. Message notifications (custom registration)
18. Announcements (custom registration)
19. Performance routes (custom registration)
20. Password reset routes

## Duplicates Found (⚠️ Critical!)

These routes are registered in **BOTH** systems:
- `/api/recipients` - Lines 114 (legacy) AND in modular system
- `/api/event-requests` - Lines 123 (legacy) AND in modular system
- `/api/stream` - Lines 151 (legacy) AND in modular system
- `/api/monitoring` - Lines 185 (legacy) AND in modular system
- `/api/dashboard-documents` - Both systems

**Risk**: Last one wins! This could cause unpredictable behavior.

## Migration Strategy

### Phase 1: Identify & Document (✅ DONE)
- [x] Map all routes in both systems
- [x] Identify duplicates
- [x] Document dependencies

### Phase 2: Remove Duplicates (HIGH PRIORITY)
1. Remove duplicate registrations from `server/routes.ts`
2. Keep only modular system versions
3. Test each removal

### Phase 3: Migrate Legacy Routes
For each legacy route:
1. Create new router file in `server/routes/[feature]/`
2. Convert to `RouterDependencies` pattern
3. Add to `server/routes/index.ts`
4. Remove from `server/routes.ts`
5. Test thoroughly

### Phase 4: Cleanup
1. Remove all legacy route registrations
2. Keep only session setup and modular system call
3. Update documentation

## Migration Priority Order

### 🔴 Critical (Do First - Duplicates)
1. Remove duplicate `/api/recipients` from legacy
2. Remove duplicate `/api/event-requests` from legacy
3. Remove duplicate `/api/stream` from legacy
4. Remove duplicate `/api/monitoring` from legacy
5. Remove duplicate `/api/dashboard-documents` from legacy

### 🟡 High (Core Entities)
6. Migrate `/api/drivers`
7. Migrate `/api/volunteers`
8. Migrate `/api/hosts` (consolidate)

### 🟢 Medium (Features)
9. Migrate `/api/event-reminders`
10. Migrate `/api/onboarding`
11. Migrate `/api/emails`

### 🔵 Low (External/Utilities)
12. Migrate `/api/google-sheets`
13. Migrate `/api/google-calendar`
14. Migrate `/api/routes` (route optimization)
15. Migrate announcements, message-notifications, performance

## Example Migration

**Before (Legacy - server/routes.ts):**
```typescript
const driversRoutes = await import('./routes/drivers');
app.use('/api/drivers', driversRoutes.default(isAuthenticated, storage));
```

**After (Modular - server/routes/drivers/index.ts):**
```typescript
import { Router } from 'express';
import { RouterDependencies } from '../types';

export function createDriversRouter(deps: RouterDependencies) {
  const router = Router();

  // Routes use deps.storage, deps.isAuthenticated, etc.
  router.get('/', async (req, res) => {
    const drivers = await deps.storage.getDrivers();
    res.json(drivers);
  });

  return router;
}
```

**Register (server/routes/index.ts):**
```typescript
import { createDriversRouter } from './drivers';

const driversRouter = createDriversRouter(deps);
router.use('/api/drivers',
  deps.isAuthenticated,
  ...createStandardMiddleware(),
  driversRouter
);
router.use('/api/drivers', createErrorHandler('drivers'));
```

## Testing Checklist

For each migrated route:
- [ ] Authentication works
- [ ] Permissions checked
- [ ] Error handling works
- [ ] Logging appears in activity logs
- [ ] Frontend still works
- [ ] API responses unchanged

## Success Criteria

✅ All routes use `RouterDependencies` pattern
✅ No duplicates
✅ Consistent middleware on all routes
✅ All routes have error handlers
✅ Activity logging on all authenticated routes
✅ Legacy system removed from `server/routes.ts`

## Timeline

- **Day 1**: Remove duplicates (critical)
- **Day 2-3**: Migrate core entities (drivers, volunteers, hosts)
- **Day 4-5**: Migrate features (events, onboarding, emails)
- **Day 6**: Migrate external integrations
- **Day 7**: Final testing and cleanup
