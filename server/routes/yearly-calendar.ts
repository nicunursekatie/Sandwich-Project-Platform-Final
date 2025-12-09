import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { eq, and, desc, inArray } from 'drizzle-orm';
import { db } from '../db';
import {
  yearlyCalendarItems,
  insertYearlyCalendarItemSchema,
  type YearlyCalendarItem,
  type InsertYearlyCalendarItem,
} from '../../shared/schema';
import { logger } from '../middleware/logger';
import { requirePermission } from '../middleware/auth';
import { PERMISSIONS } from '../../shared/auth-utils';

// Type definitions for authenticated requests
interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    firstName?: string;
    lastName?: string;
    displayName?: string;
    role?: string;
    permissions?: string[];
  };
}

// Input validation schemas
const createItemSchema = insertYearlyCalendarItemSchema
  .omit({ createdBy: true, createdByName: true })
  .extend({
    title: z.string().min(1, 'Title is required').max(200, 'Title too long'),
    month: z.number().int().min(1).max(12),
    year: z.number().int().min(2000).max(2100),
    description: z.string().max(2000, 'Description too long').optional().nullable(),
    category: z.enum(['preparation', 'event-rush', 'staffing', 'board', 'seasonal', 'other']).optional(),
    priority: z.enum(['low', 'medium', 'high']).optional(),
    assignedTo: z.array(z.string()).nullable().optional(),
    assignedToNames: z.array(z.string()).nullable().optional(),
  });

const updateItemSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).optional().nullable(),
  category: z.enum(['preparation', 'event-rush', 'staffing', 'board', 'seasonal', 'other']).optional(),
  priority: z.enum(['low', 'medium', 'high']).optional(),
  assignedTo: z.array(z.string()).nullable().optional(),
  assignedToNames: z.array(z.string()).nullable().optional(),
  isCompleted: z.boolean().optional(),
  isRecurring: z.boolean().optional(),
});

// Create yearly calendar router
export const yearlyCalendarRouter = Router();

// GET /api/yearly-calendar - Get all calendar items for a specific year
yearlyCalendarRouter.get(
  '/',
  requirePermission(PERMISSIONS.VIEW_HOLDING_ZONE), // Reuse holding zone permission
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!req.user?.id) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const year = req.query.year ? parseInt(req.query.year as string) : new Date().getFullYear();

      if (isNaN(year)) {
        return res.status(400).json({ error: 'Invalid year parameter' });
      }

      logger.info('Fetching yearly calendar items', { year, userId: req.user.id });

      // Fetch all items for the specified year, ordered by month
      const items = await db
        .select()
        .from(yearlyCalendarItems)
        .where(eq(yearlyCalendarItems.year, year))
        .orderBy(yearlyCalendarItems.month, desc(yearlyCalendarItems.createdAt));

      logger.info('Successfully fetched yearly calendar items', {
        year,
        count: items.length,
        userId: req.user.id,
      });

      res.json(items);
    } catch (error) {
      logger.error('Failed to fetch yearly calendar items', error);
      res.status(500).json({
        error: 'Failed to fetch calendar items',
        message: 'An error occurred while retrieving calendar items',
      });
    }
  }
);

// POST /api/yearly-calendar - Create new calendar item
yearlyCalendarRouter.post(
  '/',
  requirePermission(PERMISSIONS.SUBMIT_HOLDING_ZONE), // Reuse holding zone permission
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!req.user?.id) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const validation = createItemSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({
          error: 'Invalid input data',
          details: validation.error.issues,
        });
      }

      const data = validation.data;

      // Get user's display name
      const createdByName =
        req.user.displayName ||
        `${req.user.firstName || ''} ${req.user.lastName || ''}`.trim() ||
        req.user.email ||
        'Unknown User';

      logger.info('Creating yearly calendar item', {
        month: data.month,
        year: data.year,
        title: data.title,
        userId: req.user.id,
      });

      const [newItem] = await db
        .insert(yearlyCalendarItems)
        .values({
          ...data,
          createdBy: req.user.id,
          createdByName,
          updatedAt: new Date(),
        })
        .returning();

      logger.info('Successfully created yearly calendar item', {
        itemId: newItem.id,
        userId: req.user.id,
      });

      res.status(201).json(newItem);
    } catch (error) {
      logger.error('Failed to create yearly calendar item', error);
      res.status(500).json({
        error: 'Failed to create calendar item',
        message: 'An error occurred while creating the calendar item',
      });
    }
  }
);

// PATCH /api/yearly-calendar/:id - Update calendar item
yearlyCalendarRouter.patch(
  '/:id',
  requirePermission(PERMISSIONS.MANAGE_HOLDING_ZONE), // Reuse holding zone permission
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!req.user?.id) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const itemId = parseInt(req.params.id);
      if (isNaN(itemId)) {
        return res.status(400).json({ error: 'Invalid item ID' });
      }

      const validation = updateItemSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({
          error: 'Invalid input data',
          details: validation.error.issues,
        });
      }

      const data = validation.data;

      // Check if item exists
      const [existingItem] = await db
        .select()
        .from(yearlyCalendarItems)
        .where(eq(yearlyCalendarItems.id, itemId))
        .limit(1);

      if (!existingItem) {
        return res.status(404).json({ error: 'Calendar item not found' });
      }

      // If marking as completed, set completedBy and completedAt
      const updateData: any = {
        ...data,
        updatedAt: new Date(),
      };

      if (data.isCompleted !== undefined) {
        if (data.isCompleted && !existingItem.isCompleted) {
          updateData.completedAt = new Date();
          updateData.completedBy = req.user.id;
        } else if (!data.isCompleted) {
          updateData.completedAt = null;
          updateData.completedBy = null;
        }
      }

      logger.info('Updating yearly calendar item', {
        itemId,
        updates: Object.keys(data),
        userId: req.user.id,
      });

      const [updatedItem] = await db
        .update(yearlyCalendarItems)
        .set(updateData)
        .where(eq(yearlyCalendarItems.id, itemId))
        .returning();

      logger.info('Successfully updated yearly calendar item', {
        itemId,
        userId: req.user.id,
      });

      res.json(updatedItem);
    } catch (error) {
      logger.error('Failed to update yearly calendar item', error);
      res.status(500).json({
        error: 'Failed to update calendar item',
        message: 'An error occurred while updating the calendar item',
      });
    }
  }
);

// DELETE /api/yearly-calendar/:id - Delete calendar item
yearlyCalendarRouter.delete(
  '/:id',
  requirePermission(PERMISSIONS.MANAGE_HOLDING_ZONE), // Reuse holding zone permission
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!req.user?.id) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const itemId = parseInt(req.params.id);
      if (isNaN(itemId)) {
        return res.status(400).json({ error: 'Invalid item ID' });
      }

      logger.info('Deleting yearly calendar item', { itemId, userId: req.user.id });

      // Check if item exists
      const [existingItem] = await db
        .select()
        .from(yearlyCalendarItems)
        .where(eq(yearlyCalendarItems.id, itemId))
        .limit(1);

      if (!existingItem) {
        return res.status(404).json({ error: 'Calendar item not found' });
      }

      await db.delete(yearlyCalendarItems).where(eq(yearlyCalendarItems.id, itemId));

      logger.info('Successfully deleted yearly calendar item', {
        itemId,
        userId: req.user.id,
      });

      res.status(204).send();
    } catch (error) {
      logger.error('Failed to delete yearly calendar item', error);
      res.status(500).json({
        error: 'Failed to delete calendar item',
        message: 'An error occurred while deleting the calendar item',
      });
    }
  }
);

// POST /api/yearly-calendar/:id/copy-to-next-year - Copy recurring item to next year
yearlyCalendarRouter.post(
  '/:id/copy-to-next-year',
  requirePermission(PERMISSIONS.MANAGE_HOLDING_ZONE),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!req.user?.id) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const itemId = parseInt(req.params.id);
      if (isNaN(itemId)) {
        return res.status(400).json({ error: 'Invalid item ID' });
      }

      logger.info('Copying yearly calendar item to next year', {
        itemId,
        userId: req.user.id,
      });

      // Get the existing item
      const [existingItem] = await db
        .select()
        .from(yearlyCalendarItems)
        .where(eq(yearlyCalendarItems.id, itemId))
        .limit(1);

      if (!existingItem) {
        return res.status(404).json({ error: 'Calendar item not found' });
      }

      // Create a copy for next year
      const [newItem] = await db
        .insert(yearlyCalendarItems)
        .values({
          month: existingItem.month,
          year: existingItem.year + 1,
          title: existingItem.title,
          description: existingItem.description,
          category: existingItem.category,
          priority: existingItem.priority,
          createdBy: existingItem.createdBy,
          createdByName: existingItem.createdByName,
          assignedTo: existingItem.assignedTo,
          assignedToNames: existingItem.assignedToNames,
          isRecurring: existingItem.isRecurring,
          isCompleted: false, // Reset completion status
          completedAt: null,
          completedBy: null,
          updatedAt: new Date(),
        })
        .returning();

      logger.info('Successfully copied yearly calendar item to next year', {
        originalItemId: itemId,
        newItemId: newItem.id,
        userId: req.user.id,
      });

      res.status(201).json(newItem);
    } catch (error) {
      logger.error('Failed to copy yearly calendar item', error);
      res.status(500).json({
        error: 'Failed to copy calendar item',
        message: 'An error occurred while copying the calendar item',
      });
    }
  }
);

export default yearlyCalendarRouter;

