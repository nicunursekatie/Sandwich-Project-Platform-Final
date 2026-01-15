/**
 * Event Requests Routes - Modular Structure
 *
 * This file combines the legacy monolithic router with new modular sub-routers.
 * Routes are being gradually migrated to separate modules for better maintainability.
 *
 * Module Status:
 * - ai.ts: READY (date suggestions, intake assist, categorization)
 * - volunteers.ts: READY (volunteer signup, management)
 * - communications.ts: READY (SMS notifications)
 * - utils.ts: READY (helper functions)
 * - types.ts: READY (shared imports/types)
 *
 * TODO: Migrate remaining routes from legacy event-requests.ts:
 * - Core CRUD operations
 * - Listing/filtering routes
 * - Driver management
 * - Flags management
 * - Organization management
 * - Google Sheets import
 */

import { Router } from 'express';

// Import the legacy router (still contains most routes)
// Note: This import path goes up one level then into the file
import legacyRouter from '../event-requests-legacy';

// Import new modular routers
import { aiRouter } from './ai';
import { volunteersRouter } from './volunteers';
import { communicationsRouter } from './communications';

const router = Router();

// Mount modular routers first (they take precedence for their specific routes)
// These routes will override any duplicates in the legacy router

// AI routes: /:id/ai-suggest-dates, /:id/ai-intake-assist, /:id/ai-categorize
router.use('/', aiRouter);

// Volunteer routes: /:eventId/volunteers, /volunteers/:id, /all-volunteers, /my-volunteers
router.use('/', volunteersRouter);

// Communication routes: /:id/send-details-sms, /:id/send-correction-sms
router.use('/', communicationsRouter);

// Mount the legacy router for all remaining routes
router.use('/', legacyRouter);

export default router;

// Also export individual routers for testing/documentation
export { aiRouter, volunteersRouter, communicationsRouter };
