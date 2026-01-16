/**
 * Event Requests - Combined Router
 *
 * This file combines all event request route modules into a single router.
 * The legacy routes remain in event-requests-legacy.ts for safety,
 * while new/extracted routes are organized in this directory.
 *
 * IMPORTANT: This is the main entry point for all event request routes.
 * The legacy router is imported and mounted FIRST to preserve critical
 * functionality (Google Sheets import, CRUD operations, etc.).
 *
 * Route organization:
 * - ../event-requests-legacy.ts - CRITICAL: All core routes (DO NOT MODIFY)
 * - volunteers.ts - Volunteer signup and management (DUPLICATE - remove from legacy later)
 * - flags.ts - Pre-event flag management (DUPLICATE - remove from legacy later)
 * - ai.ts - AI-powered features (DUPLICATE - remove from legacy later)
 * - sms.ts - SMS notification routes (DUPLICATE - remove from legacy later)
 *
 * The main legacy file (../event-requests-legacy.ts) contains:
 * - Google Sheets import/sync (CRITICAL - do not modify)
 * - Core CRUD operations (create, read, update, delete events)
 * - Audit logging
 * - Driver assignments
 * - TSP contact assignments
 * - Organization management
 * - And other established routes
 *
 * NOTE: Currently the split routes are duplicates of routes in the legacy file.
 * Once we verify everything works, we can remove them from the legacy file.
 */

import { Router } from 'express';

// Import the main legacy router - this contains ALL existing functionality
// and MUST be mounted first to preserve critical paths like Google Sheets import
import legacyRouter from '../event-requests-legacy';

// Import sub-route modules
import volunteersRouter from './volunteers';
import flagsRouter from './flags';
// import aiRouter from './ai';
// import smsRouter from './sms';

const router = Router();

// Mount the legacy router FIRST - this ensures all existing routes work
// The legacy router contains ~6000 lines of battle-tested code including
// the critical Google Sheets import endpoint
router.use('/', legacyRouter);

// Mount extracted sub-routers (routes have been removed from legacy file)
router.use('/', volunteersRouter);
router.use('/', flagsRouter);

// NOTE: The following sub-routers are NOT mounted yet because they would
// create duplicate routes. Once we verify the legacy routes work, we can:
// 1. Remove the corresponding routes from event-requests-legacy.ts
// 2. Uncomment the sub-router mounts below
//
// router.use('/', aiRouter);
// router.use('/', smsRouter);

export default router;

// Re-export individual routers for testing or selective usage
// export { volunteersRouter, flagsRouter, aiRouter, smsRouter };
