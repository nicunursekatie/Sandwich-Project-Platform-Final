import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { eq, desc, inArray, count } from 'drizzle-orm';
import { db } from '../db';
import { 
  teamBoardItems, 
  insertTeamBoardItemSchema,
  type TeamBoardItem,
  type InsertTeamBoardItem,
  teamBoardComments,
  insertTeamBoardCommentSchema,
  type TeamBoardComment,
  type InsertTeamBoardComment,
  users
} from '../../shared/schema';
import { logger } from '../middleware/logger';
import { EmailNotificationService } from '../services/email-notification-service';

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
  assignedTo: z.array(z.string()).nullable().optional(),
  assignedToNames: z.array(z.string()).nullable().optional(),
  completedAt: z.string().datetime().optional().nullable(),
});

const createCommentSchema = insertTeamBoardCommentSchema
  .omit({ userId: true, userName: true })
  .extend({
    content: z.string().min(1, 'Comment cannot be empty').max(1000, 'Comment too long'),
  });

// Create team board router
export const teamBoardRouter = Router();

// GET /api/team-board/users - Get all active users for assignment
teamBoardRouter.get('/users', async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    logger.info('Fetching active users for team board assignment', { userId: req.user.id });

    // Fetch all active users
    const activeUsers = await db
      .select({
        id: users.id,
        email: users.email,
        firstName: users.firstName,
        lastName: users.lastName,
        displayName: users.displayName,
      })
      .from(users)
      .where(eq(users.isActive, true));

    // Format user names for display
    const formattedUsers = activeUsers.map(user => ({
      id: user.id,
      email: user.email,
      name: user.displayName || `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email,
    }));

    logger.info('Successfully fetched active users', { 
      count: formattedUsers.length,
      userId: req.user.id 
    });

    res.json(formattedUsers);
  } catch (error) {
    logger.error('Failed to fetch active users', error);
    res.status(500).json({ 
      error: 'Failed to fetch users',
      message: 'An error occurred while retrieving users' 
    });
  }
});

// GET /api/team-board - Get all board items with comment counts
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

    // Get comment counts for all items
    const itemIds = items.map(item => item.id);
    const commentCounts = itemIds.length > 0 
      ? await db
          .select({
            itemId: teamBoardComments.itemId,
            count: count(teamBoardComments.id),
          })
          .from(teamBoardComments)
          .where(inArray(teamBoardComments.itemId, itemIds))
          .groupBy(teamBoardComments.itemId)
      : [];

    // Create a map of itemId -> comment count
    const countMap = new Map(commentCounts.map(c => [c.itemId, Number(c.count)]));

    // Add comment counts to items
    const itemsWithCounts = items.map(item => ({
      ...item,
      commentCount: countMap.get(item.id) || 0,
    }));

    // Sort: open/claimed items first, then done items
    const sortedItems = itemsWithCounts.sort((a, b) => {
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
      assignedToNames: null,
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

    // Get the existing item before updating to check for assignment changes
    const [existingItem] = await db
      .select()
      .from(teamBoardItems)
      .where(eq(teamBoardItems.id, itemId))
      .limit(1);

    if (!existingItem) {
      return res.status(404).json({ error: 'Item not found' });
    }

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

    // Check if assignment changed and send email notifications to newly assigned users
    if (updateData.assignedTo && updateData.assignedTo.length > 0) {
      const oldAssignedTo = existingItem.assignedTo || [];
      const newAssignedTo = updateData.assignedTo;
      
      // Find newly assigned users (those not previously assigned)
      const newlyAssignedUsers = newAssignedTo.filter(
        (userId) => !oldAssignedTo.includes(userId)
      );

      // Send email notifications to newly assigned users
      if (newlyAssignedUsers.length > 0) {
        const assignerName = req.user.displayName || 
                            `${req.user.firstName || ''} ${req.user.lastName || ''}`.trim() || 
                            req.user.email;
        
        // Send notifications asynchronously (don't block the response)
        EmailNotificationService.sendTeamBoardAssignmentNotification(
          newlyAssignedUsers,
          updatedItem.id,
          updatedItem.content,
          updatedItem.type,
          assignerName
        ).catch((error) => {
          logger.error('Failed to send team board assignment notification', error);
        });

        logger.info('Team board assignment notifications queued', {
          itemId: updatedItem.id,
          newlyAssignedCount: newlyAssignedUsers.length
        });
      }
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

// GET /api/team-board/:id/comments - Get all comments for a board item
teamBoardRouter.get('/:id/comments', async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const itemId = parseInt(req.params.id);
    if (isNaN(itemId)) {
      return res.status(400).json({ error: 'Invalid item ID' });
    }

    logger.info('Fetching comments for team board item', { 
      itemId,
      userId: req.user.id 
    });

    // Fetch all comments for this item, ordered by creation date (oldest first for chronological reading)
    const comments = await db
      .select()
      .from(teamBoardComments)
      .where(eq(teamBoardComments.itemId, itemId))
      .orderBy(teamBoardComments.createdAt);

    logger.info('Successfully fetched comments', { 
      itemId,
      count: comments.length,
      userId: req.user.id 
    });

    res.json(comments);
  } catch (error) {
    logger.error('Failed to fetch comments', error);
    res.status(500).json({ 
      error: 'Failed to fetch comments',
      message: 'An error occurred while retrieving comments' 
    });
  }
});

// POST /api/team-board/:id/comments - Create a new comment
teamBoardRouter.post('/:id/comments', async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const itemId = parseInt(req.params.id);
    if (isNaN(itemId)) {
      return res.status(400).json({ error: 'Invalid item ID' });
    }

    // Validate input data
    const validation = createCommentSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        error: 'Invalid comment data',
        details: validation.error.issues
      });
    }

    const commentData = validation.data;

    logger.info('Creating comment on team board item', { 
      itemId,
      userId: req.user.id 
    });

    const displayName = req.user.displayName || `${req.user.firstName || ''} ${req.user.lastName || ''}`.trim() || req.user.email;

    // Prepare the comment data for insertion
    const newComment: InsertTeamBoardComment = {
      itemId,
      userId: req.user.id,
      userName: displayName,
      content: commentData.content,
    };

    // Insert the new comment
    const [createdComment] = await db
      .insert(teamBoardComments)
      .values(newComment)
      .returning();

    logger.info('Successfully created comment', { 
      commentId: createdComment.id,
      itemId,
      userId: req.user.id 
    });

    res.status(201).json(createdComment);
  } catch (error) {
    logger.error('Failed to create comment', error);
    res.status(500).json({ 
      error: 'Failed to create comment',
      message: 'An error occurred while creating the comment' 
    });
  }
});

// DELETE /api/team-board/comments/:commentId - Delete a comment
teamBoardRouter.delete('/comments/:commentId', async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const commentId = parseInt(req.params.commentId);
    if (isNaN(commentId)) {
      return res.status(400).json({ error: 'Invalid comment ID' });
    }

    logger.info('Deleting team board comment', { 
      commentId,
      userId: req.user.id 
    });

    // Check if comment exists and belongs to user (or user is admin)
    const [comment] = await db
      .select()
      .from(teamBoardComments)
      .where(eq(teamBoardComments.id, commentId));

    if (!comment) {
      return res.status(404).json({ error: 'Comment not found' });
    }

    // Only allow deletion if the user created the comment or is an admin
    const isAdmin = req.user.permissions?.includes('ADMIN_ACCESS');
    if (comment.userId !== req.user.id && !isAdmin) {
      return res.status(403).json({ error: 'You can only delete your own comments' });
    }

    // Delete the comment
    const result = await db
      .delete(teamBoardComments)
      .where(eq(teamBoardComments.id, commentId));

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Comment not found' });
    }

    logger.info('Successfully deleted comment', { 
      commentId,
      userId: req.user.id 
    });

    res.status(204).send();
  } catch (error) {
    logger.error('Failed to delete comment', error);
    res.status(500).json({ 
      error: 'Failed to delete comment',
      message: 'An error occurred while deleting the comment' 
    });
  }
});

export default teamBoardRouter;
