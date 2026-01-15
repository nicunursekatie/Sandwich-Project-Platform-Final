/**
 * Shared types and imports for event-requests routes
 */
import { Router, Response } from 'express';
import { z } from 'zod';
import { storage } from '../../storage-wrapper';
import {
  insertEventRequestSchema,
  insertOrganizationSchema,
  insertEventVolunteerSchema,
  importFromSheetsSchema,
  auditLogs,
  eventRequests,
  users,
  type EventRequest,
  type User,
} from '@shared/schema';
import { PERMISSIONS } from '@shared/auth-utils';
import { hasPermission } from '@shared/unified-auth-utils';
import { parseDateOnly } from '@shared/date-utils';
import { requirePermission } from '../../middleware/auth';
import { isAuthenticated } from '../../auth';
import { getEventRequestsGoogleSheetsService } from '../../google-sheets-event-requests-sync';
import { AuditLogger } from '../../audit-logger';
import { db } from '../../db';
import { eq, desc, and, sql, gte, or, isNull, ne, lt, lte, inArray, count, asc } from 'drizzle-orm';
import { EmailNotificationService } from '../../services/email-notification-service';
import { logger } from '../../middleware/logger';
import type { AuthenticatedRequest } from '../../types/express';
import { emitEventRequestUpdate } from '../../socket-chat';
import { safeJsonParse } from '../../utils/safe-json';
import { geocodeAddress } from '../../utils/geocoding';
import { rateLimiter } from '../../utils/rate-limiter';

// Re-export everything for use in sub-modules
export {
  Router,
  Response,
  z,
  storage,
  insertEventRequestSchema,
  insertOrganizationSchema,
  insertEventVolunteerSchema,
  importFromSheetsSchema,
  auditLogs,
  eventRequests,
  users,
  type EventRequest,
  type User,
  PERMISSIONS,
  hasPermission,
  parseDateOnly,
  requirePermission,
  isAuthenticated,
  getEventRequestsGoogleSheetsService,
  AuditLogger,
  db,
  eq,
  desc,
  and,
  sql,
  gte,
  or,
  isNull,
  ne,
  lt,
  lte,
  inArray,
  count,
  asc,
  EmailNotificationService,
  logger,
  type AuthenticatedRequest,
  emitEventRequestUpdate,
  safeJsonParse,
  geocodeAddress,
  rateLimiter,
};
