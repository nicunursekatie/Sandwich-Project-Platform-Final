import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { eq, desc } from 'drizzle-orm';
import { db } from '../db';
import { 
  teamBoardItems, 
  insertTeamBoardItemSchema,
  type TeamBoardItem,
  type InsertTeamBoardItem 
} from '../../shared/schema';
import { logger } from '../middleware/logger';

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
const createItemSchema = insertTeamBoardItemSchema
  .omit({ createdBy: true, createdByName: true })
  .extend({
    content: z.string().min(1, 'Content is required').max(2000, 'Content too long'),
    type: z.enum(['task', 'note', 'idea', 'reminder']).optional(),
  });

const updateItemSchema = z.object({
  status: z.enum(['open', 'claimed', 'done']).optional(),
  assignedTo: z.string().nullable().optional(),
  assignedToName: z.string().nullable().optional(),
  completedAt: z.string().datetime().optional().nullable(),
});

// Create team board router
export const teamBoardRouter = Router();

// GET /api/team-board - Get all board items
teamBoardRouter.get('/', async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    logger.info('Fetching team board items', { userId: req.user.id });

    // Fetch all items ordered by creation date (newest first), but show incomplete items first
    const items = await db
      .select()
      .from(teamBoardItems)
      .orderBy(desc(teamBoardItems.createdAt));

    // Sort: open/claimed items first, then done items
    const sortedItems = items.sort((a, b) => {
      if (a.status === 'done' && b.status !== 'done') return 1;
      if (a.status !== 'done' && b.status === 'done') return -1;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    logger.info('Successfully fetched team board items', { 
      count: items.length,
      userId: req.user.id 
    });

    res.json(sortedItems);
  } catch (error) {
    logger.error('Failed to fetch team board items', error);
    res.status(500).json({ 
      error: 'Failed to fetch items',
      message: 'An error occurred while retrieving board items' 
    });
  }
});

// POST /api/team-board - Create new board item
teamBoardRouter.post('/', async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Validate input data
    const validation = createItemSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        error: 'Invalid input data',
        details: validation.error.issues
      });
    }

    const itemData = validation.data;

    logger.info('Creating new team board item', { 
      userId: req.user.id,
      type: itemData.type 
    });

    const displayName = req.user.displayName || `${req.user.firstName || ''} ${req.user.lastName || ''}`.trim() || req.user.email;

    // Prepare the item data for insertion
    const newItem: InsertTeamBoardItem = {
      content: itemData.content,
      type: itemData.type || 'note',
      createdBy: req.user.id,
      createdByName: displayName,
      status: 'open',
      assignedTo: null,
      assignedToName: null,
      completedAt: null,
    };

    // Insert the new item
    const [createdItem] = await db
      .insert(teamBoardItems)
      .values(newItem)
      .returning();

    logger.info('Successfully created team board item', { 
      itemId: createdItem.id,
      userId: req.user.id 
    });

    res.status(201).json(createdItem);
  } catch (error) {
    logger.error('Failed to create team board item', error);
    res.status(500).json({ 
      error: 'Failed to create item',
      message: 'An error occurred while creating the item' 
    });
  }
});

// PATCH /api/team-board/:id - Update item (claim, complete, etc.)
teamBoardRouter.patch('/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const itemId = parseInt(req.params.id);
    if (isNaN(itemId)) {
      return res.status(400).json({ error: 'Invalid item ID' });
    }

    // Validate update data
    const validation = updateItemSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        error: 'Invalid update data',
        details: validation.error.issues
      });
    }

    const updateData = validation.data;

    logger.info('Updating team board item', { 
      itemId,
      userId: req.user.id,
      status: updateData.status 
    });

    // Update the item
    const [updatedItem] = await db
      .update(teamBoardItems)
      .set({
        ...updateData,
        ...(updateData.completedAt ? { completedAt: new Date(updateData.completedAt) } : {}),
      })
      .where(eq(teamBoardItems.id, itemId))
      .returning();

    if (!updatedItem) {
      return res.status(404).json({ error: 'Item not found' });
    }

    logger.info('Successfully updated team board item', { 
      itemId,
      userId: req.user.id,
      newStatus: updateData.status 
    });

    res.json(updatedItem);
  } catch (error) {
    logger.error('Failed to update team board item', error);
    res.status(500).json({ 
      error: 'Failed to update item',
      message: 'An error occurred while updating the item' 
    });
  }
});

// DELETE /api/team-board/:id - Delete item
teamBoardRouter.delete('/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const itemId = parseInt(req.params.id);
    if (isNaN(itemId)) {
      return res.status(400).json({ error: 'Invalid item ID' });
    }

    logger.info('Deleting team board item', { 
      itemId,
      userId: req.user.id 
    });

    // Delete the item
    const result = await db
      .delete(teamBoardItems)
      .where(eq(teamBoardItems.id, itemId));

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Item not found' });
    }

    logger.info('Successfully deleted team board item', { 
      itemId,
      userId: req.user.id 
    });

    res.status(204).send();
  } catch (error) {
    logger.error('Failed to delete team board item', error);
    res.status(500).json({ 
      error: 'Failed to delete item',
      message: 'An error occurred while deleting the item' 
    });
  }
});

export default teamBoardRouter;
