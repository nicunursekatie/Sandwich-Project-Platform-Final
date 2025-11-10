import { Server as SocketServer, Socket, Namespace } from 'socket.io';
import { Server as HttpServer } from 'http';
import { storage } from './storage';
import { logger } from './utils/production-safe-logger';
import { z } from 'zod';
import { AuditLogger } from './audit-logger';

/**
 * Event Collaboration Socket.IO Module
 * Handles real-time multi-user editing of event requests with:
 * - Event-scoped rooms
 * - Presence tracking
 * - Field-level locking with auto-expiration
 * - Optimistic concurrency control
 * - Real-time comments
 */

// ==================== Types ====================

interface PresenceMeta {
  userId: string;
  userName: string;
  joinedAt: Date;
  lastHeartbeat: Date;
  socketId: string;
}

interface FieldLockInfo {
  fieldName: string;
  lockedBy: string;
  lockedByName: string;
  expiresAt: Date;
}

interface FieldUpdatePayload {
  fieldName: string;
  value: any;
  updatedAt: Date;
  updatedBy: string;
  updatedByName: string;
}

interface EventState {
  eventRequestId: number;
  version: Date;
  activeLocks: FieldLockInfo[];
  activeUsers: PresenceMeta[];
}

// ==================== Validation Schemas ====================

const JoinEventSchema = z.object({
  eventRequestId: z.number(),
  userId: z.string(),
  userName: z.string(),
});

const AcquireLockSchema = z.object({
  eventRequestId: z.number(),
  fieldName: z.string(),
  userId: z.string(),
  userName: z.string(),
});

const ReleaseLockSchema = z.object({
  eventRequestId: z.number(),
  fieldName: z.string(),
});

const FieldUpdateSchema = z.object({
  eventRequestId: z.number(),
  fieldName: z.string(),
  value: z.any(),
  expectedVersion: z.string(),
  userId: z.string(),
  userName: z.string(),
});

const CreateCommentSchema = z.object({
  eventRequestId: z.number(),
  userId: z.string(),
  userName: z.string(),
  content: z.string(),
  parentCommentId: z.number().optional(),
});

const HeartbeatSchema = z.object({
  eventRequestId: z.number(),
  userId: z.string(),
});

// ==================== In-Memory State ====================

// Map of eventId -> Map of userId -> PresenceMeta
const presenceByEvent = new Map<number, Map<string, PresenceMeta>>();

// Map of socketId -> set of eventIds the socket is subscribed to
const socketEventSubscriptions = new Map<string, Set<number>>();

// Module-level variable to store collaboration namespace
let collaborationNamespace: Namespace | null = null;

/**
 * Get the collaboration namespace instance (for emitting events from routes)
 */
export function getCollaborationNamespace(): Namespace | null {
  return collaborationNamespace;
}

// ==================== Helper Functions ====================

function getRoomName(eventRequestId: number): string {
  return `event:${eventRequestId}`;
}

function getLocksRoomName(eventRequestId: number): string {
  return `locks:${eventRequestId}`;
}

function getCommentsRoomName(eventRequestId: number): string {
  return `comments:${eventRequestId}`;
}

/**
 * Get active presence for an event
 */
function getEventPresence(eventRequestId: number): PresenceMeta[] {
  const presenceMap = presenceByEvent.get(eventRequestId);
  if (!presenceMap) return [];
  return Array.from(presenceMap.values());
}

/**
 * Add user to presence tracking
 */
function addPresence(
  eventRequestId: number,
  userId: string,
  userName: string,
  socketId: string
): void {
  if (!presenceByEvent.has(eventRequestId)) {
    presenceByEvent.set(eventRequestId, new Map());
  }
  const presenceMap = presenceByEvent.get(eventRequestId)!;
  presenceMap.set(userId, {
    userId,
    userName,
    joinedAt: new Date(),
    lastHeartbeat: new Date(),
    socketId,
  });
}

/**
 * Remove user from presence tracking
 */
function removePresence(eventRequestId: number, userId: string): void {
  const presenceMap = presenceByEvent.get(eventRequestId);
  if (presenceMap) {
    presenceMap.delete(userId);
    if (presenceMap.size === 0) {
      presenceByEvent.delete(eventRequestId);
    }
  }
}

/**
 * Update heartbeat for a user
 */
function updateHeartbeat(eventRequestId: number, userId: string): void {
  const presenceMap = presenceByEvent.get(eventRequestId);
  if (presenceMap) {
    const presence = presenceMap.get(userId);
    if (presence) {
      presence.lastHeartbeat = new Date();
    }
  }
}

/**
 * Remove stale presence entries (no heartbeat in last 60 seconds)
 */
async function cleanupStalePresence(): Promise<void> {
  const now = Date.now();
  const staleThreshold = 60 * 1000; // 60 seconds

  for (const [eventId, presenceMap] of presenceByEvent.entries()) {
    const staleUsers: string[] = [];
    
    for (const [userId, presence] of presenceMap.entries()) {
      const timeSinceHeartbeat = now - presence.lastHeartbeat.getTime();
      if (timeSinceHeartbeat > staleThreshold) {
        logger.log(
          `Removing stale presence for user ${userId} in event ${eventId}`
        );
        staleUsers.push(userId);
      }
    }

    for (const userId of staleUsers) {
      await releaseUserLocks(eventId, userId);
      presenceMap.delete(userId);
    }

    if (staleUsers.length > 0 && collaborationNamespace) {
      collaborationNamespace
        .to(getRoomName(eventId))
        .emit('presence-updated', {
          eventRequestId: eventId,
          activeUsers: Array.from(presenceMap.values()),
        });
    }

    if (presenceMap.size === 0) {
      presenceByEvent.delete(eventId);
    }
  }
}

/**
 * Get initial event state for a newly joined user
 */
async function getInitialEventState(
  eventRequestId: number
): Promise<EventState | null> {
  try {
    // Get event to retrieve current version
    const event = await storage.getEventRequestById(eventRequestId);
    if (!event) return null;

    // Get active locks (storage filters by expiration)
    const activeLocks = await storage.getEventFieldLocks(eventRequestId);

    // Get active presence
    const activeUsers = getEventPresence(eventRequestId);

    return {
      eventRequestId,
      version: event.updatedAt,
      activeLocks: activeLocks.map((lock) => ({
        fieldName: lock.fieldName,
        lockedBy: lock.lockedBy,
        lockedByName: lock.lockedByName,
        expiresAt: lock.expiresAt,
      })),
      activeUsers,
    };
  } catch (error) {
    logger.error('Error getting initial event state:', error);
    return null;
  }
}

/**
 * Release all locks held by a user in an event
 */
async function releaseUserLocks(
  eventRequestId: number,
  userId: string
): Promise<void> {
  try {
    const locks = await storage.getEventFieldLocks(eventRequestId);
    const userLocks = locks.filter((lock) => lock.lockedBy === userId);

    for (const lock of userLocks) {
      await storage.deleteEventFieldLock(eventRequestId, lock.fieldName);
      logger.log(
        `Released lock on ${lock.fieldName} for user ${userId} in event ${eventRequestId}`
      );
    }

    // Broadcast lock release
    if (collaborationNamespace && userLocks.length > 0) {
      collaborationNamespace.to(getLocksRoomName(eventRequestId)).emit('locks-updated', {
        eventRequestId,
        activeLocks: await storage.getEventFieldLocks(eventRequestId),
      });
    }
  } catch (error) {
    logger.error('Error releasing user locks:', error);
  }
}

// ==================== Setup Function ====================

export function setupSocketCollaboration(httpServer: HttpServer, io: SocketServer) {
  // Create collaboration namespace
  const collaboration = io.of('/collaboration');
  collaborationNamespace = collaboration;

  logger.log('✓ Socket.IO collaboration namespace initialized on /collaboration');

  // Heartbeat cleanup interval (every 30 seconds)
  setInterval(() => {
    cleanupStalePresence();
  }, 30 * 1000);

  // Expired locks cleanup interval (every minute)
  setInterval(async () => {
    try {
      const deletedCount = await storage.cleanupExpiredLocks();
      if (deletedCount > 0) {
        logger.log(`Cleaned up ${deletedCount} expired field locks`);
      }
    } catch (error) {
      logger.error('Error cleaning up expired locks:', error);
    }
  }, 60 * 1000);

  // ==================== Connection Handler ====================

  collaboration.on('connection', (socket: Socket) => {
    logger.log(`✅ Collaboration socket connected: ${socket.id}`);

    // ==================== Join Event ====================

    socket.on('join-event', async (data) => {
      try {
        const validated = JoinEventSchema.parse(data);
        const { eventRequestId, userId, userName } = validated;

        // Verify event exists and user has access
        const event = await storage.getEventRequestById(eventRequestId);
        if (!event) {
          socket.emit('error', { message: 'Event not found' });
          return;
        }

        // Join rooms
        const roomName = getRoomName(eventRequestId);
        const locksRoom = getLocksRoomName(eventRequestId);
        const commentsRoom = getCommentsRoomName(eventRequestId);

        socket.join(roomName);
        socket.join(locksRoom);
        socket.join(commentsRoom);

        // Track subscription
        if (!socketEventSubscriptions.has(socket.id)) {
          socketEventSubscriptions.set(socket.id, new Set());
        }
        socketEventSubscriptions.get(socket.id)!.add(eventRequestId);

        // Add to presence
        addPresence(eventRequestId, userId, userName, socket.id);

        // Get initial state
        const initialState = await getInitialEventState(eventRequestId);

        // Send initial state to joining user
        socket.emit('event-state', initialState);

        // Broadcast presence update to all users in room
        collaboration.to(roomName).emit('presence-updated', {
          eventRequestId,
          activeUsers: getEventPresence(eventRequestId),
        });

        // Load and send recent comments
        const comments = await storage.getEventCollaborationComments(eventRequestId);
        socket.emit('comments-loaded', {
          eventRequestId,
          comments,
        });

        logger.log(
          `User ${userName} (${userId}) joined event collaboration: ${eventRequestId}`
        );
      } catch (error) {
        logger.error('Error joining event:', error);
        socket.emit('error', {
          message: error instanceof Error ? error.message : 'Failed to join event',
        });
      }
    });

    // ==================== Leave Event ====================

    socket.on('leave-event', async (data: { eventRequestId: number; userId: string }) => {
      try {
        const { eventRequestId, userId } = data;

        // Leave rooms
        socket.leave(getRoomName(eventRequestId));
        socket.leave(getLocksRoomName(eventRequestId));
        socket.leave(getCommentsRoomName(eventRequestId));

        // Remove from subscriptions
        socketEventSubscriptions.get(socket.id)?.delete(eventRequestId);

        // Remove from presence
        removePresence(eventRequestId, userId);

        // Release all locks held by this user
        await releaseUserLocks(eventRequestId, userId);

        // Broadcast presence update
        collaboration.to(getRoomName(eventRequestId)).emit('presence-updated', {
          eventRequestId,
          activeUsers: getEventPresence(eventRequestId),
        });

        logger.log(`User ${userId} left event collaboration: ${eventRequestId}`);
      } catch (error) {
        logger.error('Error leaving event:', error);
      }
    });

    // ==================== Heartbeat ====================

    socket.on('heartbeat', async (data) => {
      try {
        const validated = HeartbeatSchema.parse(data);
        const { eventRequestId, userId } = validated;

        updateHeartbeat(eventRequestId, userId);
      } catch (error) {
        logger.error('Error processing heartbeat:', error);
      }
    });

    // ==================== Acquire Field Lock ====================

    socket.on('acquire-lock', async (data) => {
      try {
        const validated = AcquireLockSchema.parse(data);
        const { eventRequestId, fieldName, userId, userName } = validated;

        // Check if field is already locked
        const existingLocks = await storage.getEventFieldLocks(eventRequestId);
        const existingLock = existingLocks.find((lock) => lock.fieldName === fieldName);

        if (existingLock && existingLock.lockedBy !== userId) {
          // Lock is held by another user
          socket.emit('lock-denied', {
            eventRequestId,
            fieldName,
            lockedBy: existingLock.lockedByName,
            expiresAt: existingLock.expiresAt,
          });
          return;
        }

        // Create or renew lock
        const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes
        await storage.createEventFieldLock({
          eventRequestId,
          fieldName,
          lockedBy: userId,
          lockedByName: userName,
          expiresAt,
        });

        // Broadcast lock acquisition
        collaboration.to(getLocksRoomName(eventRequestId)).emit('lock-acquired', {
          eventRequestId,
          fieldName,
          lockedBy: userId,
          lockedByName: userName,
          expiresAt,
        });

        logger.log(
          `Lock acquired: ${fieldName} by ${userName} in event ${eventRequestId}`
        );
      } catch (error) {
        logger.error('Error acquiring lock:', error);
        socket.emit('error', {
          message: error instanceof Error ? error.message : 'Failed to acquire lock',
        });
      }
    });

    // ==================== Release Field Lock ====================

    socket.on('release-lock', async (data) => {
      try {
        const validated = ReleaseLockSchema.parse(data);
        const { eventRequestId, fieldName } = validated;

        await storage.deleteEventFieldLock(eventRequestId, fieldName);

        // Broadcast lock release
        collaboration.to(getLocksRoomName(eventRequestId)).emit('lock-released', {
          eventRequestId,
          fieldName,
        });

        logger.log(`Lock released: ${fieldName} in event ${eventRequestId}`);
      } catch (error) {
        logger.error('Error releasing lock:', error);
      }
    });

    // ==================== Field Update ====================

    socket.on('field-update', async (data) => {
      try {
        const validated = FieldUpdateSchema.parse(data);
        const { eventRequestId, fieldName, value, expectedVersion, userId, userName } =
          validated;

        const expectedVersionDate = new Date(expectedVersion);

        if (isNaN(expectedVersionDate.getTime())) {
          socket.emit('error', {
            message: 'Invalid version format',
          });
          logger.error(`Invalid version string: ${expectedVersion}`);
          return;
        }

        const updateData = { [fieldName]: value };

        try {
          // Get original event data before update for audit logging
          const originalEvent = await storage.getEventRequestById(eventRequestId);
          if (!originalEvent) {
            socket.emit('error', { message: 'Event not found' });
            return;
          }

          await storage.updateEventRequest(eventRequestId, updateData, expectedVersionDate);

          // Get updated event to retrieve new version
          const updatedEvent = await storage.getEventRequestById(eventRequestId);
          if (!updatedEvent) {
            throw new Error('Event not found after update');
          }

          // Create revision entry in eventEditRevisions table
          await storage.createEventEditRevision({
            eventRequestId,
            fieldName,
            oldValue: originalEvent[fieldName as keyof typeof originalEvent] !== undefined
              ? JSON.stringify(originalEvent[fieldName as keyof typeof originalEvent])
              : null,
            newValue: JSON.stringify(value),
            changedBy: userId,
            changedByName: userName,
            changeType: 'update',
          });

          // Create audit log entry in auditLogs table for activity history
          await AuditLogger.logEventRequestChange(
            eventRequestId.toString(),
            originalEvent,
            updatedEvent,
            {
              userId: userId,
              ipAddress: socket.handshake.address,
              userAgent: socket.handshake.headers['user-agent'],
              sessionId: socket.id,
            },
            {
              actionType: 'REAL_TIME_UPDATE',
              operation: 'field_update',
              fieldName: fieldName,
            }
          );

          // Broadcast field update to all users
          const updatePayload: FieldUpdatePayload = {
            fieldName,
            value,
            updatedAt: updatedEvent.updatedAt,
            updatedBy: userId,
            updatedByName: userName,
          };

          collaboration.to(getRoomName(eventRequestId)).emit('field-updated', {
            eventRequestId,
            ...updatePayload,
            version: updatedEvent.updatedAt,
          });

          logger.log(
            `Field updated: ${fieldName} by ${userName} in event ${eventRequestId} (with audit log)`
          );
        } catch (updateError: any) {
          // Version conflict detected
          if (updateError.message?.includes('version conflict')) {
            const currentEvent = await storage.getEventRequestById(eventRequestId);
            socket.emit('update-rejected', {
              eventRequestId,
              fieldName,
              reason: 'version_conflict',
              currentVersion: currentEvent?.updatedAt,
              currentValue: currentEvent ? currentEvent[fieldName as keyof typeof currentEvent] : null,
            });
            logger.log(
              `Version conflict on ${fieldName} in event ${eventRequestId}`
            );
          } else {
            throw updateError;
          }
        }
      } catch (error) {
        logger.error('Error updating field:', error);
        socket.emit('error', {
          message: error instanceof Error ? error.message : 'Failed to update field',
        });
      }
    });

    // ==================== Create Comment ====================

    socket.on('create-comment', async (data) => {
      try {
        const validated = CreateCommentSchema.parse(data);
        const { eventRequestId, userId, userName, content, parentCommentId } = validated;

        const comment = await storage.createEventCollaborationComment({
          eventRequestId,
          userId,
          userName,
          content,
          parentCommentId: parentCommentId || null,
        });

        // Broadcast new comment to all users
        collaboration.to(getCommentsRoomName(eventRequestId)).emit('comment-created', {
          eventRequestId,
          comment,
        });

        logger.log(`Comment created by ${userName} in event ${eventRequestId}`);
      } catch (error) {
        logger.error('Error creating comment:', error);
        socket.emit('error', {
          message: error instanceof Error ? error.message : 'Failed to create comment',
        });
      }
    });

    // ==================== Disconnect Handler ====================

    socket.on('disconnect', async () => {
      logger.log(`Collaboration socket disconnected: ${socket.id}`);

      // Get all events this socket was subscribed to
      const subscribedEvents = socketEventSubscriptions.get(socket.id);
      if (subscribedEvents) {
        for (const eventId of subscribedEvents) {
          // Find user in presence
          const presenceMap = presenceByEvent.get(eventId);
          if (presenceMap) {
            for (const [userId, presence] of presenceMap.entries()) {
              if (presence.socketId === socket.id) {
                // Remove presence
                removePresence(eventId, userId);

                // Release locks
                await releaseUserLocks(eventId, userId);

                // Broadcast presence update
                collaboration.to(getRoomName(eventId)).emit('presence-updated', {
                  eventRequestId: eventId,
                  activeUsers: getEventPresence(eventId),
                });
              }
            }
          }
        }

        socketEventSubscriptions.delete(socket.id);
      }
    });
  });

  return collaboration;
}
