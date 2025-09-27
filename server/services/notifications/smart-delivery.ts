/**
 * Smart Notification Delivery Service
 * 
 * Handles intelligent notification delivery with:
 * - ML-powered relevance scoring
 * - Optimal timing calculation
 * - Multi-channel delivery (WebSocket, Email, SMS, Push)
 * - Interaction tracking and learning
 * - A/B testing integration
 */

import { db } from '../../db';
import { 
  notifications, 
  notificationHistory,
  notificationABTests,
  users 
} from '../../../shared/schema';
import { eq, and, gte, lte } from 'drizzle-orm';
import { mlEngine } from './ml-engine';
import logger from '../../utils/logger';
import { Server as SocketIOServer } from 'socket.io';

const deliveryLogger = logger.child({ service: 'smart-delivery' });

export interface DeliveryOptions {
  forceChannel?: 'email' | 'sms' | 'in_app' | 'push';
  skipMLScoring?: boolean;
  abTestId?: number;
  abTestVariant?: string;
  scheduledFor?: Date;
  priority?: 'low' | 'medium' | 'high' | 'urgent';
}

export interface DeliveryResult {
  success: boolean;
  notificationId: number;
  channel: string;
  deliveryTime: Date;
  mlScore?: number;
  mlFactors?: any;
  abTestVariant?: string;
  error?: string;
}

export class SmartDeliveryService {
  private io?: SocketIOServer;

  constructor(io?: SocketIOServer) {
    this.io = io;
  }

  /**
   * Send notification using smart delivery logic
   */
  async sendNotification(
    userId: string,
    title: string,
    message: string,
    type: string = 'system_update',
    options: DeliveryOptions = {}
  ): Promise<DeliveryResult> {
    try {
      deliveryLogger.info('Starting smart notification delivery', { 
        userId, 
        type, 
        title: title.substring(0, 50) 
      });

      // Calculate ML relevance score unless skipped
      let relevanceResult;
      if (!options.skipMLScoring) {
        relevanceResult = await mlEngine.calculateRelevanceScore(
          userId,
          type,
          message,
          options
        );
        
        deliveryLogger.debug('ML relevance calculated', { 
          userId, 
          score: relevanceResult.score,
          recommendedChannel: relevanceResult.recommendedChannel
        });
      }

      // Determine delivery channel
      const deliveryChannel = options.forceChannel || 
                             relevanceResult?.recommendedChannel || 
                             'in_app';

      // Calculate optimal delivery time
      const deliveryTime = options.scheduledFor || 
                          new Date(Date.now() + (relevanceResult?.recommendedDelay || 0) * 1000);

      // Handle A/B testing if applicable
      let abTestVariant = options.abTestVariant;
      if (options.abTestId && !abTestVariant) {
        abTestVariant = await this.assignABTestVariant(options.abTestId, userId);
      }

      // Create notification record
      const notificationResult = await db
        .insert(notifications)
        .values({
          userId,
          title,
          message,
          type,
          priority: options.priority || 'medium',
          isRead: false,
          isArchived: false,
          createdAt: new Date()
        })
        .returning();

      const notification = notificationResult[0];

      // Create notification history entry
      await db.insert(notificationHistory).values({
        notificationId: notification.id,
        userId,
        notificationType: type,
        channel: deliveryChannel,
        deliveredAt: deliveryTime,
        mlScore: relevanceResult?.score || 0.5,
        mlFactors: relevanceResult?.factors || {},
        scheduledFor: deliveryTime,
        abTestId: options.abTestId || null,
        abTestVariant,
        metadata: {
          deliveryMethod: 'smart',
          originalOptions: options,
          mlRecommendation: relevanceResult
        }
      });

      // Deliver notification immediately or schedule
      if (deliveryTime <= new Date()) {
        await this.deliverNotificationNow(notification, deliveryChannel, abTestVariant);
      } else {
        deliveryLogger.info('Notification scheduled for future delivery', {
          notificationId: notification.id,
          deliveryTime,
          delay: deliveryTime.getTime() - Date.now()
        });
        // In production, this would use a job queue like Bull or Agenda
        setTimeout(() => {
          this.deliverNotificationNow(notification, deliveryChannel, abTestVariant);
        }, deliveryTime.getTime() - Date.now());
      }

      return {
        success: true,
        notificationId: notification.id,
        channel: deliveryChannel,
        deliveryTime,
        mlScore: relevanceResult?.score,
        mlFactors: relevanceResult?.factors,
        abTestVariant
      };

    } catch (error) {
      deliveryLogger.error('Error in smart notification delivery', { 
        error, 
        userId, 
        type 
      });
      
      return {
        success: false,
        notificationId: 0,
        channel: 'unknown',
        deliveryTime: new Date(),
        error: error.message
      };
    }
  }

  /**
   * Deliver notification immediately through appropriate channel
   */
  private async deliverNotificationNow(
    notification: any,
    channel: string,
    abTestVariant?: string
  ): Promise<void> {
    try {
      deliveryLogger.info('Delivering notification now', { 
        notificationId: notification.id, 
        channel, 
        userId: notification.userId 
      });

      switch (channel) {
        case 'in_app':
          await this.deliverInApp(notification);
          break;
        case 'email':
          await this.deliverEmail(notification);
          break;
        case 'sms':
          await this.deliverSMS(notification);
          break;
        case 'push':
          await this.deliverPush(notification);
          break;
        default:
          deliveryLogger.warn('Unknown delivery channel, falling back to in-app', { 
            channel, 
            notificationId: notification.id 
          });
          await this.deliverInApp(notification);
      }

      // Update delivery status in history
      await db
        .update(notificationHistory)
        .set({ 
          deliveredAt: new Date(),
          deliveryStatus: 'delivered'
        })
        .where(and(
          eq(notificationHistory.notificationId, notification.id),
          eq(notificationHistory.userId, notification.userId)
        ));

    } catch (error) {
      deliveryLogger.error('Error delivering notification', { 
        error, 
        notificationId: notification.id, 
        channel 
      });

      // Update delivery status to failed
      await db
        .update(notificationHistory)
        .set({ 
          deliveryStatus: 'failed',
          metadata: { error: error.message }
        })
        .where(and(
          eq(notificationHistory.notificationId, notification.id),
          eq(notificationHistory.userId, notification.userId)
        ));
    }
  }

  /**
   * Deliver notification via WebSocket (in-app)
   */
  private async deliverInApp(notification: any): Promise<void> {
    if (!this.io) {
      deliveryLogger.warn('Socket.IO not available for in-app delivery', { 
        notificationId: notification.id 
      });
      return;
    }

    try {
      // Send to specific user via WebSocket
      this.io.to(`user:${notification.userId}`).emit('notification', {
        id: notification.id,
        title: notification.title,
        message: notification.message,
        type: notification.type,
        priority: notification.priority,
        createdAt: notification.createdAt,
        actionUrl: notification.actionUrl,
        actionText: notification.actionText,
        metadata: notification.metadata
      });

      deliveryLogger.debug('In-app notification delivered via WebSocket', { 
        notificationId: notification.id, 
        userId: notification.userId 
      });

    } catch (error) {
      deliveryLogger.error('Error delivering in-app notification', { 
        error, 
        notificationId: notification.id 
      });
      throw error;
    }
  }

  /**
   * Deliver notification via email
   */
  private async deliverEmail(notification: any): Promise<void> {
    try {
      // Get user email
      const user = await db
        .select({ email: users.email, firstName: users.firstName })
        .from(users)
        .where(eq(users.id, notification.userId))
        .limit(1);

      if (!user[0]?.email) {
        throw new Error('User email not found');
      }

      // TODO: Integrate with email service (SendGrid, etc.)
      deliveryLogger.info('Email notification would be sent', {
        notificationId: notification.id,
        email: user[0].email,
        subject: notification.title
      });

      // For now, just log the email content
      deliveryLogger.debug('Email content', {
        to: user[0].email,
        subject: notification.title,
        body: notification.message,
        notificationId: notification.id
      });

    } catch (error) {
      deliveryLogger.error('Error delivering email notification', { 
        error, 
        notificationId: notification.id 
      });
      throw error;
    }
  }

  /**
   * Deliver notification via SMS
   */
  private async deliverSMS(notification: any): Promise<void> {
    try {
      // Get user phone number
      const user = await db
        .select({ phoneNumber: users.phoneNumber })
        .from(users)
        .where(eq(users.id, notification.userId))
        .limit(1);

      if (!user[0]?.phoneNumber) {
        throw new Error('User phone number not found');
      }

      // TODO: Integrate with SMS service (Twilio, etc.)
      deliveryLogger.info('SMS notification would be sent', {
        notificationId: notification.id,
        phoneNumber: user[0].phoneNumber.replace(/\d(?=\d{4})/g, '*'),
        message: notification.message.substring(0, 160)
      });

    } catch (error) {
      deliveryLogger.error('Error delivering SMS notification', { 
        error, 
        notificationId: notification.id 
      });
      throw error;
    }
  }

  /**
   * Deliver notification via push notification
   */
  private async deliverPush(notification: any): Promise<void> {
    try {
      // TODO: Integrate with push notification service (FCM, APNS, etc.)
      deliveryLogger.info('Push notification would be sent', {
        notificationId: notification.id,
        userId: notification.userId,
        title: notification.title,
        body: notification.message
      });

    } catch (error) {
      deliveryLogger.error('Error delivering push notification', { 
        error, 
        notificationId: notification.id 
      });
      throw error;
    }
  }

  /**
   * Assign A/B test variant to user
   */
  private async assignABTestVariant(abTestId: number, userId: string): Promise<string> {
    try {
      // Get A/B test details
      const abTest = await db
        .select()
        .from(notificationABTests)
        .where(and(
          eq(notificationABTests.id, abTestId),
          eq(notificationABTests.status, 'active')
        ))
        .limit(1);

      if (!abTest[0]) {
        throw new Error('A/B test not found or not active');
      }

      const test = abTest[0];
      
      // Simple hash-based assignment for consistent variant selection
      const userHash = this.hashUserId(userId);
      const variants = test.variants as any[];
      const trafficSplit = test.trafficSplit as number[];
      
      let cumulativeWeight = 0;
      const userPercentile = userHash % 100;
      
      for (let i = 0; i < trafficSplit.length; i++) {
        cumulativeWeight += trafficSplit[i];
        if (userPercentile < cumulativeWeight) {
          return variants[i].name;
        }
      }
      
      // Fallback to first variant
      return variants[0].name;

    } catch (error) {
      deliveryLogger.error('Error assigning A/B test variant', { 
        error, 
        abTestId, 
        userId 
      });
      return 'control';
    }
  }

  /**
   * Simple hash function for consistent user assignment
   */
  private hashUserId(userId: string): number {
    let hash = 0;
    for (let i = 0; i < userId.length; i++) {
      const char = userId.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }

  /**
   * Track notification interaction for ML learning
   */
  async trackInteraction(
    notificationId: number,
    userId: string,
    interactionType: 'opened' | 'clicked' | 'dismissed' | 'ignored',
    metadata: any = {}
  ): Promise<void> {
    try {
      deliveryLogger.info('Tracking notification interaction', { 
        notificationId, 
        userId, 
        interactionType 
      });

      const interactionTime = new Date();

      // Update notification history
      const updateData: any = {
        [`${interactionType}At`]: interactionTime,
        interactionMetadata: metadata
      };

      await db
        .update(notificationHistory)
        .set(updateData)
        .where(and(
          eq(notificationHistory.notificationId, notificationId),
          eq(notificationHistory.userId, userId)
        ));

      // Get notification history for channel info
      const history = await db
        .select({ channel: notificationHistory.channel })
        .from(notificationHistory)
        .where(and(
          eq(notificationHistory.notificationId, notificationId),
          eq(notificationHistory.userId, userId)
        ))
        .limit(1);

      if (history[0]) {
        // Calculate response time
        const deliveryTime = await db
          .select({ deliveredAt: notificationHistory.deliveredAt })
          .from(notificationHistory)
          .where(and(
            eq(notificationHistory.notificationId, notificationId),
            eq(notificationHistory.userId, userId)
          ))
          .limit(1);

        let responseTime;
        if (deliveryTime[0]?.deliveredAt) {
          responseTime = Math.floor(
            (interactionTime.getTime() - new Date(deliveryTime[0].deliveredAt).getTime()) / 1000
          );
        }

        // Update ML engine with interaction
        await mlEngine.updateUserBehaviorFromInteraction(
          userId,
          notificationId,
          interactionType,
          history[0].channel,
          responseTime
        );
      }

      // Mark notification as read if opened or clicked
      if (['opened', 'clicked'].includes(interactionType)) {
        await db
          .update(notifications)
          .set({ isRead: true })
          .where(eq(notifications.id, notificationId));
      }

    } catch (error) {
      deliveryLogger.error('Error tracking interaction', { 
        error, 
        notificationId, 
        userId, 
        interactionType 
      });
    }
  }

  /**
   * Broadcast notification to multiple users with smart delivery
   */
  async broadcastNotification(
    userIds: string[],
    title: string,
    message: string,
    type: string = 'announcement',
    options: DeliveryOptions = {}
  ): Promise<DeliveryResult[]> {
    deliveryLogger.info('Broadcasting smart notification', { 
      userCount: userIds.length, 
      type, 
      title: title.substring(0, 50) 
    });

    const results: DeliveryResult[] = [];

    // Process users in batches to avoid overwhelming the system
    const batchSize = 50;
    for (let i = 0; i < userIds.length; i += batchSize) {
      const batch = userIds.slice(i, i + batchSize);
      
      const batchPromises = batch.map(userId => 
        this.sendNotification(userId, title, message, type, options)
      );

      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);

      // Add small delay between batches to prevent rate limiting
      if (i + batchSize < userIds.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    deliveryLogger.info('Broadcast notification completed', { 
      userCount: userIds.length,
      successCount: results.filter(r => r.success).length,
      failureCount: results.filter(r => !r.success).length
    });

    return results;
  }

  /**
   * Set Socket.IO instance for real-time delivery
   */
  setSocketIO(io: SocketIOServer): void {
    this.io = io;
    deliveryLogger.info('Socket.IO instance configured for smart delivery');
  }
}

// Export singleton instance
export const smartDeliveryService = new SmartDeliveryService();