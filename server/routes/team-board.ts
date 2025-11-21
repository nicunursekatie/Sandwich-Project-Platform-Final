import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { eq, desc, inArray, count, and } from 'drizzle-orm';
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
  teamBoardItemLikes,
  insertTeamBoardItemLikeSchema,
  type TeamBoardItemLike,
  type InsertTeamBoardItemLike,
  holdingZoneCategories,
  type HoldingZoneCategory,
  users
} from '../../shared/schema';
import { logger } from '../middleware/logger';
import { EmailNotificationService } from '../services/email-notification-service';
// REFACTOR: Import new assignment service for dual-write
import { teamBoardAssignmentService } from '../services/assignments';
import { requirePermission, requireOwnershipPermission } from '../middleware/auth';
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
const createItemSchema = insertTeamBoardItemSchema
  .omit({ createdBy: true, createdByName: true })
  .extend({
    content: z.string().min(1, 'Content is required').max(2000, 'Content too long'),
    type: z.enum(['task', 'note', 'idea']).optional(), // Match database schema - 'reminder' removed
    categoryId: z.number().int().positive().optional().nullable(), // Holding zone category
    isUrgent: z.boolean().optional(), // Urgent flag for priority items
  });

const updateItemSchema = z.object({
  status: z.enum(['open', 'claimed', 'done']).optional(),
  assignedTo: z.array(z.string()).nullable().optional(),
  assignedToNames: z.array(z.string()).nullable().optional(),
  completedAt: z.string().datetime().optional().nullable(),
  categoryId: z.number().int().positive().optional().nullable(), // Holding zone category
  isUrgent: z.boolean().optional(), // Urgent flag for priority items
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
teamBoardRouter.get('/', requirePermission(PERMISSIONS.VIEW_HOLDING_ZONE), async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    logger.info('Fetching team board items', { userId: req.user.id });

    // Fetch all items with category information via left join
    const items = await db
      .select({
        item: teamBoardItems,
        category: holdingZoneCategories,
      })
      .from(teamBoardItems)
      .leftJoin(
        holdingZoneCategories,
        eq(teamBoardItems.categoryId, holdingZoneCategories.id)
      )
      .orderBy(desc(teamBoardItems.createdAt));

    // Flatten the results to include category info
    const flattenedItems = items.map(row => ({
      ...row.item,
      category: row.category,
    }));

    // Get comment counts for all items
    const itemIds = flattenedItems.map(item => item.id);
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
    const itemsWithCounts = flattenedItems.map(item => ({
      ...item,
      commentCount: countMap.get(item.id) || 0,
    }));

    // Sort: open/claimed items first, then done items
    const sortedItems = itemsWithCounts.sort((a, b) => {
      if (a.status === 'done' && b.status !== 'done') return 1;
      if (a.status !== 'done' && b.status === 'done') return -1;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    // REFACTOR: Include assignments from normalized table for each item
    try {
      const itemsWithAssignments = await Promise.all(
        sortedItems.map(async (item) => {
          try {
            const assignments = await teamBoardAssignmentService.getItemAssignments(item.id);
            return {
              ...item,
              assignments,
            };
          } catch (err) {
            logger.error(`Failed to fetch assignments for team board item ${item.id}`, err);
            return item;
          }
        })
      );

      logger.info('Successfully fetched team board items with assignments', {
        count: items.length,
        userId: req.user.id
      });

      res.json(itemsWithAssignments);
    } catch (assignmentError) {
      logger.error('Failed to fetch team board assignments, returning items without assignments', assignmentError);
      logger.info('Successfully fetched team board items', {
        count: items.length,
        userId: req.user.id
      });
      res.json(sortedItems);
    }
  } catch (error) {
    logger.error('Failed to fetch team board items', error);
    res.status(500).json({ 
      error: 'Failed to fetch items',
      message: 'An error occurred while retrieving board items' 
    });
  }
});

// POST /api/team-board - Create new board item
teamBoardRouter.post('/', requirePermission(PERMISSIONS.SUBMIT_HOLDING_ZONE), async (req: AuthenticatedRequest, res: Response) => {
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
      categoryId: itemData.categoryId ?? null,
      isUrgent: itemData.isUrgent ?? false,
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
// SECURITY: Layered permission enforcement
// 1. requirePermission ensures user currently has SUBMIT capability
// 2. requireOwnershipPermission verifies user is owner OR has MANAGE
// This prevents revoked submitters from accessing resources they created
teamBoardRouter.patch('/:id', 
  requirePermission(PERMISSIONS.SUBMIT_HOLDING_ZONE), // First: check user has SUBMIT
  requireOwnershipPermission(
    PERMISSIONS.SUBMIT_HOLDING_ZONE, // Can edit own items
    PERMISSIONS.MANAGE_HOLDING_ZONE, // Can edit any items
    async (req: AuthenticatedRequest) => {
      const itemId = parseInt(req.params.id);
      if (isNaN(itemId)) return null;
      
      const [item] = await db
        .select()
        .from(teamBoardItems)
        .where(eq(teamBoardItems.id, itemId))
        .limit(1);
      
      return item?.createdBy || null;
    }
  ), // Then: check ownership OR MANAGE
  async (req: AuthenticatedRequest, res: Response) => {
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

    // REFACTOR: Dual-write to team_board_assignments table
    if (updateData.assignedTo !== undefined) {
      try {
        // Build assignments from assignedTo and assignedToNames
        const assignedTo = updateData.assignedTo || [];
        const assignedToNames = updateData.assignedToNames || [];

        const assignments = assignedTo.map((userId: string, index: number) => ({
          userId,
          userName: assignedToNames[index] || 'Unknown',
        }));

        await teamBoardAssignmentService.replaceItemAssignments(
          itemId,
          assignments
        );
        logger.info(`Synced ${assignments.length} team board assignments for item ${itemId}`);
      } catch (syncError) {
        logger.error('Failed to sync team board assignments:', syncError);
        // Don't fail the item update if assignment sync fails
      }
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
// SECURITY: Layered permission enforcement
// 1. requirePermission ensures user currently has SUBMIT capability
// 2. requireOwnershipPermission verifies user is owner OR has MANAGE
// This prevents revoked submitters from accessing resources they created
teamBoardRouter.delete('/:id', 
  requirePermission(PERMISSIONS.SUBMIT_HOLDING_ZONE), // First: check user has SUBMIT
  requireOwnershipPermission(
    PERMISSIONS.SUBMIT_HOLDING_ZONE, // Can delete own items
    PERMISSIONS.MANAGE_HOLDING_ZONE, // Can delete any items
    async (req: AuthenticatedRequest) => {
      const itemId = parseInt(req.params.id);
      if (isNaN(itemId)) return null;
      
      const [item] = await db
        .select()
        .from(teamBoardItems)
        .where(eq(teamBoardItems.id, itemId))
        .limit(1);
      
      return item?.createdBy || null;
    }
  ), // Then: check ownership OR MANAGE
  async (req: AuthenticatedRequest, res: Response) => {
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
teamBoardRouter.get('/:id/comments', requirePermission(PERMISSIONS.VIEW_HOLDING_ZONE), async (req: AuthenticatedRequest, res: Response) => {
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
teamBoardRouter.post('/:id/comments', requirePermission(PERMISSIONS.SUBMIT_HOLDING_ZONE), async (req: AuthenticatedRequest, res: Response) => {
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

    // Process mentions in the comment asynchronously (don't block the response)
    // First, fetch the item to get its content
    const [item] = await db
      .select()
      .from(teamBoardItems)
      .where(eq(teamBoardItems.id, itemId))
      .limit(1);

    if (item) {
      EmailNotificationService.processTeamBoardComment(
        commentData.content,
        req.user.id,
        displayName,
        itemId,
        item.content
      ).catch((error) => {
        logger.error('Failed to process team board comment mentions', error);
      });

      logger.info('Team board comment mention processing queued', {
        commentId: createdComment.id,
        itemId
      });
    }

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

// POST /:id/assignments - Add assignment to team board item
teamBoardRouter.post(
  '/:id/assignments',
  requirePermission(PERMISSIONS.SUBMIT_HOLDING_ZONE),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!req.user?.id) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const itemId = parseInt(req.params.id);
      if (isNaN(itemId)) {
        return res.status(400).json({ error: 'Invalid item ID' });
      }

      const { userId, userName } = req.body;

      if (!userId || !userName) {
        return res.status(400).json({
          error: 'Missing required fields: userId and userName are required'
        });
      }

      const assignment = await teamBoardAssignmentService.addAssignment(
        itemId,
        userId
      );

      logger.info('Successfully added team board assignment', {
        itemId,
        userId,
        addedBy: req.user.id
      });

      res.status(201).json(assignment);
    } catch (error) {
      logger.error('Failed to add team board assignment', error);
      res.status(500).json({ error: 'Failed to add team board assignment' });
    }
  }
);

// DELETE /:id/assignments/:userId - Remove assignment from team board item
teamBoardRouter.delete(
  '/:id/assignments/:userId',
  requirePermission(PERMISSIONS.SUBMIT_HOLDING_ZONE),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!req.user?.id) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const itemId = parseInt(req.params.id);
      const { userId } = req.params;

      if (isNaN(itemId)) {
        return res.status(400).json({ error: 'Invalid item ID' });
      }

      if (!userId) {
        return res.status(400).json({ error: 'User ID is required' });
      }

      const success = await teamBoardAssignmentService.removeAssignment(itemId, userId);

      if (!success) {
        return res.status(404).json({ error: 'Assignment not found' });
      }

      logger.info('Successfully removed team board assignment', {
        itemId,
        userId,
        removedBy: req.user.id
      });

      res.status(204).send();
    } catch (error) {
      logger.error('Failed to remove team board assignment', error);
      res.status(500).json({ error: 'Failed to remove team board assignment' });
    }
  }
);

// GET /:id/assignments - Get all assignments for a team board item
teamBoardRouter.get(
  '/:id/assignments',
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!req.user?.id) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const itemId = parseInt(req.params.id);

      if (isNaN(itemId)) {
        return res.status(400).json({ error: 'Invalid item ID' });
      }

      const assignments = await teamBoardAssignmentService.getItemAssignments(itemId);

      logger.info('Successfully fetched team board assignments', {
        itemId,
        count: assignments.length
      });

      res.json(assignments);
    } catch (error) {
      logger.error('Failed to fetch team board assignments', error);
      res.status(500).json({ error: 'Failed to fetch team board assignments' });
    }
  }
);

// ==========================================
// Like/Unlike Team Board Items
// ==========================================

// POST /api/team-board/items/:id/like - Like a team board item
teamBoardRouter.post(
  '/items/:id/like',
  requirePermission(PERMISSIONS.SUBMIT_HOLDING_ZONE),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const itemId = parseInt(req.params.id);
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json({ error: 'Not authenticated' });
      }

      // Check if item exists
      const item = await db
        .select()
        .from(teamBoardItems)
        .where(eq(teamBoardItems.id, itemId))
        .limit(1);

      if (item.length === 0) {
        return res.status(404).json({ error: 'Team board item not found' });
      }

      // Insert like (will fail silently if already liked due to unique constraint)
      try {
        await db.insert(teamBoardItemLikes).values({
          itemId,
          userId,
        });

        logger.info('User liked team board item', { userId, itemId });
      } catch (error: any) {
        // Check if it's a duplicate key error (already liked)
        if (error.code === '23505') {
          // Already liked, just return success
          logger.debug('User already liked this item', { userId, itemId });
        } else {
          throw error;
        }
      }

      // Get updated like count
      const [likeCount] = await db
        .select({ count: count() })
        .from(teamBoardItemLikes)
        .where(eq(teamBoardItemLikes.itemId, itemId));

      res.json({ success: true, likeCount: likeCount?.count || 0 });
    } catch (error) {
      logger.error('Failed to like team board item', error);
      res.status(500).json({ error: 'Failed to like item' });
    }
  }
);

// DELETE /api/team-board/items/:id/like - Unlike a team board item
teamBoardRouter.delete(
  '/items/:id/like',
  requirePermission(PERMISSIONS.SUBMIT_HOLDING_ZONE),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const itemId = parseInt(req.params.id);
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json({ error: 'Not authenticated' });
      }

      // Delete the like
      await db
        .delete(teamBoardItemLikes)
        .where(
          and(
            eq(teamBoardItemLikes.itemId, itemId),
            eq(teamBoardItemLikes.userId, userId)
          )
        );

      logger.info('User unliked team board item', { userId, itemId });

      // Get updated like count
      const [likeCount] = await db
        .select({ count: count() })
        .from(teamBoardItemLikes)
        .where(eq(teamBoardItemLikes.itemId, itemId));

      res.json({ success: true, likeCount: likeCount?.count || 0 });
    } catch (error) {
      logger.error('Failed to unlike team board item', error);
      res.status(500).json({ error: 'Failed to unlike item' });
    }
  }
);

// GET /api/team-board/items/:id/likes - Get likes for an item
teamBoardRouter.get(
  '/items/:id/likes',
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const itemId = parseInt(req.params.id);

      const likes = await db
        .select()
        .from(teamBoardItemLikes)
        .where(eq(teamBoardItemLikes.itemId, itemId));

      const userHasLiked = req.user?.id
        ? likes.some(like => like.userId === req.user?.id)
        : false;

      res.json({
        likes: likes.length,
        userHasLiked,
        likedBy: likes.map(like => like.userId),
      });
    } catch (error) {
      logger.error('Failed to fetch likes for team board item', error);
      res.status(500).json({ error: 'Failed to fetch likes' });
    }
  }
);

// POST /api/team-board/:id/promote - Promote holding zone item to a standalone task
teamBoardRouter.post(
  '/:id/promote',
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

      // Validation schema for promote request
      const promoteSchema = z.object({
        projectId: z.number().int().positive().optional().nullable(), // Optional project to attach to
        priority: z.enum(['low', 'medium', 'high']).optional().default('medium'),
        dueDate: z.string().optional().nullable(),
      });

      const validation = promoteSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({
          error: 'Invalid input data',
          details: validation.error.issues,
        });
      }

      const { projectId, priority, dueDate } = validation.data;

      logger.info('Promoting holding zone item to task', {
        itemId,
        projectId,
        userId: req.user.id,
      });

      // Get the holding zone item
      const [holdingZoneItem] = await db
        .select()
        .from(teamBoardItems)
        .where(eq(teamBoardItems.id, itemId))
        .limit(1);

      if (!holdingZoneItem) {
        return res.status(404).json({ error: 'Holding zone item not found' });
      }

      // Check if already promoted
      if (holdingZoneItem.promotedToTaskId) {
        return res.status(400).json({
          error: 'Item already promoted to a task',
          taskId: holdingZoneItem.promotedToTaskId,
        });
      }

      // Import projectTasks schema
      const { projectTasks } = await import('../../shared/schema');

      // Create a new project task
      const [newTask] = await db
        .insert(projectTasks)
        .values({
          projectId: projectId || null, // Nullable for standalone tasks
          title: holdingZoneItem.content.substring(0, 255), // Use content as title
          description: holdingZoneItem.content,
          status: 'pending',
          priority: priority,
          assigneeIds: holdingZoneItem.assignedTo || [],
          assigneeNames: holdingZoneItem.assignedToNames || [],
          dueDate: dueDate || null,
          originType: 'team_board',
          sourceTeamBoardId: itemId,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .returning();

      // Update the holding zone item to mark as promoted
      await db
        .update(teamBoardItems)
        .set({
          promotedToTaskId: newTask.id,
          promotedAt: new Date(),
          status: 'done', // Mark as done since it's been promoted
        })
        .where(eq(teamBoardItems.id, itemId));

      logger.info('Successfully promoted holding zone item to task', {
        itemId,
        taskId: newTask.id,
        projectId: projectId || 'standalone',
        userId: req.user.id,
      });

      res.status(201).json({
        success: true,
        task: newTask,
        message: projectId
          ? 'Item promoted to project task'
          : 'Item promoted to standalone task',
      });
    } catch (error) {
      logger.error('Failed to promote holding zone item', error);
      res.status(500).json({
        error: 'Failed to promote item',
        message: 'An error occurred while promoting the item to a task',
      });
    }
  }
);

export default teamBoardRouter;
