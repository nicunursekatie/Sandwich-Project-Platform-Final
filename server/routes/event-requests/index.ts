/**
 * Event Requests - Combined Router
 *
 * This file combines all event request route modules into a single router.
 * Routes have been extracted from the legacy file for better organization.
 *
 * IMPORTANT: This is the main entry point for all event request routes.
 * The legacy router is imported and mounted FIRST to preserve critical
 * functionality (Google Sheets import, CRUD operations, etc.).
 *
 * Route organization:
 * - ../event-requests-legacy.ts - Core routes (Google Sheets import, CRUD, etc.)
 * - volunteers.ts - Volunteer signup and management
 * - flags.ts - Pre-event flag management
 * - ai.ts - AI-powered features (date suggestions, categorization)
 * - sms.ts - SMS notification routes
 *
 * The legacy file (../event-requests-legacy.ts) still contains:
 * - Google Sheets import/sync (CRITICAL)
 * - Core CRUD operations (create, read, update, delete events)
 * - Audit logging
 * - Driver assignments
 * - TSP contact assignments
 * - Organization management
 * - Toolkit management
 * - And other established routes
 */

import { Router } from 'express';

// Import the main legacy router - contains core functionality
import legacyRouter from '../event-requests-legacy';

// Import extracted sub-route modules
import volunteersRouter from './volunteers';
import flagsRouter from './flags';
import aiRouter from './ai';
import smsRouter from './sms';

const router = Router();

// Mount the legacy router FIRST - this ensures all existing routes work
// The legacy router contains the critical Google Sheets import endpoint
router.use('/', legacyRouter);

// Mount extracted sub-routers (routes have been removed from legacy file)
router.use('/', volunteersRouter);
router.use('/', flagsRouter);
router.use('/', aiRouter);
router.use('/', smsRouter);

export default router;

// Re-export individual routers for testing or selective usage
export { volunteersRouter, flagsRouter, aiRouter, smsRouter };
