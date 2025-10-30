import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { eq, desc, and, sql } from 'drizzle-orm';
import { db } from '../db';
import {
  promotionGraphics,
  insertPromotionGraphicSchema,
  type PromotionGraphic,
  type InsertPromotionGraphic,
  users
} from '../../shared/schema';
import { logger } from '../middleware/logger';
import { sendEmail } from '../sendgrid';
import { requirePermission } from '../middleware/auth';
import { PERMISSIONS } from '@shared/auth-utils';

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
const createPromotionGraphicSchema = insertPromotionGraphicSchema
  .omit({ uploadedBy: true, uploadedByName: true })
  .extend({
    title: z.string().min(1, 'Title is required').max(200, 'Title too long'),
    description: z.string().min(1, 'Description is required').max(1000, 'Description too long'),
    imageUrl: z.string().url('Invalid image URL'),
    fileName: z.string().min(1, 'File name is required'),
    intendedUseDate: z.string().refine((date) => !date || !isNaN(Date.parse(date)), {
      message: 'Invalid date format',
    }).optional().nullable(),
    targetAudience: z.string().optional(),
    sendNotification: z.boolean().optional().default(false),
  });

const updatePromotionGraphicSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200, 'Title too long').optional(),
  description: z.string().min(1, 'Description is required').max(1000, 'Description too long').optional(),
  intendedUseDate: z.string().refine((date) => !date || !isNaN(Date.parse(date)), {
    message: 'Invalid date format',
  }).optional().nullable(),
  targetAudience: z.string().optional(),
  status: z.enum(['active', 'archived']).optional(),
});

// Create promotion graphics router
export const promotionGraphicsRouter = Router();

// GET /api/promotion-graphics - Get all promotion graphics
promotionGraphicsRouter.get('/', async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    logger.info('Fetching promotion graphics', { userId: req.user.id });

    const graphics = await db
      .select()
      .from(promotionGraphics)
      .orderBy(desc(promotionGraphics.createdAt));

    logger.info('Successfully fetched promotion graphics', {
      count: graphics.length,
      userId: req.user.id
    });

    res.json(graphics);
  } catch (error) {
    logger.error('Failed to fetch promotion graphics', error);
    res.status(500).json({
      error: 'Failed to fetch promotion graphics',
      message: 'An error occurred while retrieving promotion graphics'
    });
  }
});

// GET /api/promotion-graphics/active - Get only active promotion graphics
promotionGraphicsRouter.get('/active', async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    logger.info('Fetching active promotion graphics', { userId: req.user.id });

    const graphics = await db
      .select()
      .from(promotionGraphics)
      .where(eq(promotionGraphics.status, 'active'))
      .orderBy(desc(promotionGraphics.createdAt));

    logger.info('Successfully fetched active promotion graphics', {
      count: graphics.length,
      userId: req.user.id
    });

    res.json(graphics);
  } catch (error) {
    logger.error('Failed to fetch active promotion graphics', error);
    res.status(500).json({
      error: 'Failed to fetch active promotion graphics',
      message: 'An error occurred while retrieving active promotion graphics'
    });
  }
});

// GET /api/promotion-graphics/:id - Get a specific promotion graphic
promotionGraphicsRouter.get('/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const graphicId = parseInt(req.params.id);
    if (isNaN(graphicId)) {
      return res.status(400).json({ error: 'Invalid graphic ID' });
    }

    logger.info('Fetching promotion graphic', { graphicId, userId: req.user.id });

    const [graphic] = await db
      .select()
      .from(promotionGraphics)
      .where(eq(promotionGraphics.id, graphicId));

    if (!graphic) {
      return res.status(404).json({ error: 'Promotion graphic not found' });
    }

    logger.info('Successfully fetched promotion graphic', { graphicId, userId: req.user.id });

    res.json(graphic);
  } catch (error) {
    logger.error('Failed to fetch promotion graphic', error);
    res.status(500).json({
      error: 'Failed to fetch promotion graphic',
      message: 'An error occurred while retrieving the promotion graphic'
    });
  }
});

// POST /api/promotion-graphics - Create a new promotion graphic
// Require ADMIN_ACCESS permission to create graphics
promotionGraphicsRouter.post(
  '/',
  requirePermission(PERMISSIONS.ADMIN_ACCESS),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!req.user?.id) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      logger.info('Creating promotion graphic', { userId: req.user.id, data: req.body });

      // Validate input
      const validatedData = createPromotionGraphicSchema.parse(req.body);

      // Get user's display name
      const userName = req.user.displayName ||
                       `${req.user.firstName || ''} ${req.user.lastName || ''}`.trim() ||
                       req.user.email;

      // Create the promotion graphic
      const [newGraphic] = await db
        .insert(promotionGraphics)
        .values({
          ...validatedData,
          uploadedBy: req.user.id,
          uploadedByName: userName,
          intendedUseDate: validatedData.intendedUseDate ? new Date(validatedData.intendedUseDate) : null,
        })
        .returning();

      logger.info('Successfully created promotion graphic', {
        graphicId: newGraphic.id,
        userId: req.user.id,
        sendNotification: validatedData.sendNotification
      });

      // Send email notification only if explicitly requested
      if (validatedData.sendNotification) {
        sendNotificationEmail(newGraphic, req.user).catch(error => {
          logger.error('Failed to send notification email', error);
        });
        logger.info('Email notifications will be sent', { graphicId: newGraphic.id });
      } else {
        logger.info('Skipping email notifications (not requested)', { graphicId: newGraphic.id });
      }

      res.status(201).json(newGraphic);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          error: 'Validation error',
          details: error.errors
        });
      }

      logger.error('Failed to create promotion graphic', error);
      res.status(500).json({
        error: 'Failed to create promotion graphic',
        message: 'An error occurred while creating the promotion graphic'
      });
    }
  }
);

// PUT /api/promotion-graphics/:id - Update a promotion graphic
// Require ADMIN_ACCESS permission to update graphics
promotionGraphicsRouter.put(
  '/:id',
  requirePermission(PERMISSIONS.ADMIN_ACCESS),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!req.user?.id) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const graphicId = parseInt(req.params.id);
      if (isNaN(graphicId)) {
        return res.status(400).json({ error: 'Invalid graphic ID' });
      }

      logger.info('Updating promotion graphic', { graphicId, userId: req.user.id, data: req.body });

      // Validate input
      const validatedData = updatePromotionGraphicSchema.parse(req.body);

      // Check if graphic exists
      const [existingGraphic] = await db
        .select()
        .from(promotionGraphics)
        .where(eq(promotionGraphics.id, graphicId));

      if (!existingGraphic) {
        return res.status(404).json({ error: 'Promotion graphic not found' });
      }

      // Update the promotion graphic
      // Handle intendedUseDate properly: if present, set to parsed date or null; if absent, don't update
      const updateData: Partial<InsertPromotionGraphic> = {
        ...validatedData,
        updatedAt: new Date(),
      };

      // Only update intendedUseDate if it was provided in the request
      if ('intendedUseDate' in validatedData) {
        updateData.intendedUseDate = validatedData.intendedUseDate
          ? new Date(validatedData.intendedUseDate)
          : null;
      }

      const [updatedGraphic] = await db
        .update(promotionGraphics)
        .set(updateData)
        .where(eq(promotionGraphics.id, graphicId))
        .returning();

      logger.info('Successfully updated promotion graphic', {
        graphicId,
        userId: req.user.id
      });

      res.json(updatedGraphic);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          error: 'Validation error',
          details: error.errors
        });
      }

      logger.error('Failed to update promotion graphic', error);
      res.status(500).json({
        error: 'Failed to update promotion graphic',
        message: 'An error occurred while updating the promotion graphic'
      });
    }
  }
);

// DELETE /api/promotion-graphics/:id - Delete a promotion graphic
// Require ADMIN_ACCESS permission to delete graphics
promotionGraphicsRouter.delete(
  '/:id',
  requirePermission(PERMISSIONS.ADMIN_ACCESS),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!req.user?.id) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const graphicId = parseInt(req.params.id);
      if (isNaN(graphicId)) {
        return res.status(400).json({ error: 'Invalid graphic ID' });
      }

      logger.info('Deleting promotion graphic', { graphicId, userId: req.user.id });

      // Check if graphic exists
      const [existingGraphic] = await db
        .select()
        .from(promotionGraphics)
        .where(eq(promotionGraphics.id, graphicId));

      if (!existingGraphic) {
        return res.status(404).json({ error: 'Promotion graphic not found' });
      }

      // Delete the promotion graphic
      await db
        .delete(promotionGraphics)
        .where(eq(promotionGraphics.id, graphicId));

      logger.info('Successfully deleted promotion graphic', {
        graphicId,
        userId: req.user.id
      });

      res.json({ message: 'Promotion graphic deleted successfully' });
    } catch (error) {
      logger.error('Failed to delete promotion graphic', error);
      res.status(500).json({
        error: 'Failed to delete promotion graphic',
        message: 'An error occurred while deleting the promotion graphic'
      });
    }
  }
);

// Helper function to send notification emails
async function sendNotificationEmail(graphic: PromotionGraphic, uploader: any) {
  try {
    logger.info('Sending notification emails for new promotion graphic', {
      graphicId: graphic.id,
      targetAudience: graphic.targetAudience
    });

    // Determine which users to notify based on target audience
    let targetUsers: any[] = [];

    if (graphic.targetAudience === 'hosts') {
      // Get all users with the 'host' role
      targetUsers = await db
        .select({
          id: users.id,
          email: users.email,
          firstName: users.firstName,
          lastName: users.lastName,
          displayName: users.displayName,
          preferredEmail: users.preferredEmail,
        })
        .from(users)
        .where(
          and(
            eq(users.isActive, true),
            eq(users.role, 'host')
          )
        );
    } else if (graphic.targetAudience === 'volunteers') {
      // Get all users with volunteer-related roles (volunteer, driver, core_team, committee_member)
      targetUsers = await db
        .select({
          id: users.id,
          email: users.email,
          firstName: users.firstName,
          lastName: users.lastName,
          displayName: users.displayName,
          preferredEmail: users.preferredEmail,
        })
        .from(users)
        .where(
          and(
            eq(users.isActive, true),
            sql`${users.role} IN ('volunteer', 'driver', 'core_team', 'committee_member')`
          )
        );
    } else {
      // Default to all active users
      targetUsers = await db
        .select({
          id: users.id,
          email: users.email,
          firstName: users.firstName,
          lastName: users.lastName,
          displayName: users.displayName,
          preferredEmail: users.preferredEmail,
        })
        .from(users)
        .where(eq(users.isActive, true));
    }

    logger.info(`Found ${targetUsers.length} users to notify`);

    // Send emails to all target users
    const emailPromises = targetUsers.map(async (user) => {
      const recipientEmail = user.preferredEmail || user.email;
      const recipientName = user.displayName ||
                           `${user.firstName || ''} ${user.lastName || ''}`.trim() ||
                           user.email;

      const intendedDateText = graphic.intendedUseDate
        ? `\nIntended Use Date: ${new Date(graphic.intendedUseDate).toLocaleDateString()}`
        : '';

      try {
        await sendEmail({
          to: recipientEmail,
          from: 'katielong2316@gmail.com',
          subject: `New Social Media Graphic Available: ${graphic.title}`,
          text: `Hello ${recipientName},

A new social media graphic is now available for you to share!

Title: ${graphic.title}
Description: ${graphic.description}${intendedDateText}

Uploaded by: ${graphic.uploadedByName}

Please log in to the platform to view and download the graphic.

Thank you for helping us spread the word about our mission!`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #236383;">New Social Media Graphic Available</h2>
              <p>Hello ${recipientName},</p>
              <p>A new social media graphic is now available for you to share!</p>
              <div style="background-color: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
                <h3 style="margin-top: 0; color: #007E8C;">${graphic.title}</h3>
                <p style="color: #333;"><strong>Description:</strong> ${graphic.description}</p>
                ${graphic.intendedUseDate ? `<p style="color: #333;"><strong>Intended Use Date:</strong> ${new Date(graphic.intendedUseDate).toLocaleDateString()}</p>` : ''}
                <p style="color: #666; font-size: 0.9em;"><strong>Uploaded by:</strong> ${graphic.uploadedByName}</p>
              </div>
              <p>Please log in to the platform to view and download the graphic.</p>
              <p>Thank you for helping us spread the word about our mission!</p>
              <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; color: #666; font-size: 0.8em;">
                <p>This is an automated message from the Sandwich Project Platform.</p>
              </div>
            </div>
          `,
        });

        logger.info(`Sent notification email to ${recipientEmail}`);
      } catch (emailError) {
        logger.error(`Failed to send notification email to ${recipientEmail}`, emailError);
      }
    });

    await Promise.all(emailPromises);

    // Update the graphic to mark notification as sent
    await db
      .update(promotionGraphics)
      .set({
        notificationSent: true,
        notificationSentAt: new Date(),
      })
      .where(eq(promotionGraphics.id, graphic.id));

    logger.info('Successfully sent all notification emails', {
      graphicId: graphic.id,
      recipientCount: targetUsers.length
    });
  } catch (error) {
    logger.error('Error in sendNotificationEmail', error);
    throw error;
  }
}
