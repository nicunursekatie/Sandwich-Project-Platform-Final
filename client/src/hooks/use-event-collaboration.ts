/**
 * useEventCollaboration - Comprehensive React hook for real-time event collaboration
 * 
 * This hook provides a complete solution for multi-user collaboration on event requests,
 * including presence tracking, field locking, real-time updates, comments, and revision history.
 * 
 * @example
 * ```tsx
 * function EventEditor({ eventId }: { eventId: number }) {
 *   const {
 *     isConnected,
 *     presentUsers,
 *     locks,
 *     acquireFieldLock,
 *     releaseFieldLock,
 *     isFieldLockedByOther,
 *     comments,
 *     addComment,
 *     onFieldUpdate,
 *     updateField,
 *   } = useEventCollaboration(eventId);
 * 
 *   // Show who's currently viewing
 *   <div>
 *     Viewers: {presentUsers.map(u => u.userName).join(', ')}
 *   </div>
 * 
 *   // Lock a field before editing
 *   const handleFieldFocus = async (fieldName: string) => {
 *     try {
 *       await acquireFieldLock(fieldName);
 *     } catch (error) {
 *       console.error('Field is locked by another user');
 *     }
 *   };
 * 
 *   // Save field with conflict detection
 *   const handleFieldSave = async (fieldName: string, value: any, currentVersion: Date) => {
 *     try {
 *       await updateField(fieldName, value, currentVersion);
 *       await releaseFieldLock(fieldName);
 *     } catch (error) {
 *       if (error.message.includes('Conflict')) {
 *         alert('This field was modified by another user. Please refresh.');
 *       }
 *     }
 *   };
 * 
 *   // Listen for real-time updates from other users
 *   useEffect(() => {
 *     const cleanup = onFieldUpdate((fieldName, value, version) => {
 *       console.log(`Field ${fieldName} was updated to:`, value);
 *       // Update your local state here
 *     });
 *     return cleanup;
 *   }, [onFieldUpdate]);
 * 
 *   // Add a comment
 *   const handleAddComment = async (content: string) => {
 *     await addComment(content);
 *   };
 * }
 * ```
 * 
 * Features:
 * - Real-time presence tracking (see who's viewing the event)
 * - Field-level locking to prevent edit conflicts
 * - Optimistic concurrency control with version-based conflict detection
 * - Real-time comments with create/update/delete
 * - Revision history tracking
 * - Automatic heartbeat to maintain connection
 * - Auto-cleanup on unmount
 * 
 * @param eventId - The ID of the event request to collaborate on
 * @returns Collaboration interface with state and methods
 */

import { useEffect, useState, useCallback, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuth } from './useAuth';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { logger } from '@/lib/logger';
import type { EventCollaborationComment, EventFieldLock, EventEditRevision } from '@shared/schema';

export interface PresenceUser {
  userId: string;
  userName: string;
  joinedAt: Date;
  lastHeartbeat: Date;
  socketId: string;
}

interface EventState {
  eventRequestId: number;
  version: Date;
  activeLocks: EventFieldLock[];
  activeUsers: PresenceUser[];
}

interface FieldUpdateData {
  fieldName: string;
  value: any;
  updatedAt: Date;
  updatedBy: string;
  updatedByName: string;
}

export interface FieldUpdateCallback {
  (fieldName: string, value: any, version: Date): void;
}

export function useEventCollaboration(eventId: number) {
  const { user } = useAuth();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Presence tracking
  const [presentUsers, setPresentUsers] = useState<PresenceUser[]>([]);

  // Field locking
  const [locks, setLocks] = useState<Map<string, EventFieldLock>>(new Map());

  // Comments
  const [comments, setComments] = useState<EventCollaborationComment[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(false);

  // Revisions
  const [revisions, setRevisions] = useState<EventEditRevision[]>([]);
  const [revisionsLoading, setRevisionsLoading] = useState(false);

  // Field update callbacks
  const fieldUpdateCallbacks = useRef<Set<FieldUpdateCallback>>(new Set());

  // Heartbeat interval
  const heartbeatInterval = useRef<NodeJS.Timeout | null>(null);

  // ==================== Socket Connection ====================

  useEffect(() => {
    if (!user || !eventId) return;

    // Use current origin for Socket.IO connection (or env variable if provided)
    const socketUrl = import.meta.env.VITE_SOCKET_URL || window.location.origin;
    logger.log(`[EventCollaboration] Connecting to: ${socketUrl}/collaboration`);

    const newSocket = io(`${socketUrl}/collaboration`, {
      path: '/socket.io/',
      transports: ['polling', 'websocket'],
      upgrade: true,
      timeout: 30000,
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: 5,
    });

    // Connection events
    newSocket.on('connect', () => {
      logger.log('[EventCollaboration] ✅ Connected');
      setIsConnected(true);
      setError(null);

      // Join event room
      const userName = user.display_name || `${user.first_name} ${user.last_name}` || user.email || 'Anonymous';
      newSocket.emit('join-event', {
        eventRequestId: eventId,
        userId: user.id,
        userName,
      });
    });

    newSocket.on('disconnect', () => {
      logger.log('[EventCollaboration] ❌ Disconnected');
      setIsConnected(false);
    });

    newSocket.on('connect_error', (err) => {
      logger.error('[EventCollaboration] Connection error:', err);
      setIsConnected(false);
      setError('Failed to connect to collaboration server');
    });

    // ==================== Event State ====================

    newSocket.on('event-state', (state: EventState) => {
      logger.log('[EventCollaboration] Received initial state:', state);
      setPresentUsers(state.activeUsers || []);
      
      // Convert locks array to Map
      const locksMap = new Map<string, EventFieldLock>();
      (state.activeLocks || []).forEach((lock) => {
        locksMap.set(lock.fieldName, lock);
      });
      setLocks(locksMap);
    });

    // ==================== Presence Events ====================

    newSocket.on('presence-updated', (data: { eventRequestId: number; activeUsers: PresenceUser[] }) => {
      if (data.eventRequestId === eventId) {
        logger.log('[EventCollaboration] Presence updated:', data.activeUsers);
        setPresentUsers(data.activeUsers || []);
      }
    });

    newSocket.on('user-joined', (data: { eventRequestId: number; user: PresenceUser }) => {
      if (data.eventRequestId === eventId) {
        logger.log('[EventCollaboration] User joined:', data.user);
        setPresentUsers((prev) => {
          const existing = prev.find((u) => u.userId === data.user.userId);
          if (existing) return prev;
          return [...prev, data.user];
        });
      }
    });

    newSocket.on('user-left', (data: { eventRequestId: number; userId: string }) => {
      if (data.eventRequestId === eventId) {
        logger.log('[EventCollaboration] User left:', data.userId);
        setPresentUsers((prev) => prev.filter((u) => u.userId !== data.userId));
      }
    });

    // ==================== Lock Events ====================

    newSocket.on('locks-updated', (data: { eventRequestId: number; activeLocks: EventFieldLock[] }) => {
      if (data.eventRequestId === eventId) {
        logger.log('[EventCollaboration] Locks updated:', data.activeLocks);
        const locksMap = new Map<string, EventFieldLock>();
        (data.activeLocks || []).forEach((lock) => {
          locksMap.set(lock.fieldName, lock);
        });
        setLocks(locksMap);
      }
    });

    newSocket.on('lock-acquired', (data: { eventRequestId: number; lock: EventFieldLock }) => {
      if (data.eventRequestId === eventId) {
        logger.log('[EventCollaboration] Lock acquired:', data.lock);
        setLocks((prev) => {
          const newLocks = new Map(prev);
          newLocks.set(data.lock.fieldName, data.lock);
          return newLocks;
        });
      }
    });

    newSocket.on('lock-released', (data: { eventRequestId: number; fieldName: string }) => {
      if (data.eventRequestId === eventId) {
        logger.log('[EventCollaboration] Lock released:', data.fieldName);
        setLocks((prev) => {
          const newLocks = new Map(prev);
          newLocks.delete(data.fieldName);
          return newLocks;
        });
      }
    });

    // ==================== Field Update Events ====================

    newSocket.on('field-updated', (data: FieldUpdateData & { eventRequestId: number }) => {
      if (data.eventRequestId === eventId) {
        logger.log('[EventCollaboration] Field updated:', data);
        
        // Notify all registered callbacks
        fieldUpdateCallbacks.current.forEach((callback) => {
          callback(data.fieldName, data.value, data.updatedAt);
        });

        // Invalidate event request query to refresh data
        queryClient.invalidateQueries({ 
          queryKey: ['/api/event-requests', eventId] 
        });
      }
    });

    // ==================== Comment Events ====================

    newSocket.on('comment-created', (data: { eventRequestId: number; comment: EventCollaborationComment }) => {
      if (data.eventRequestId === eventId) {
        logger.log('[EventCollaboration] Comment created:', data.comment);
        setComments((prev) => [...prev, data.comment]);
      }
    });

    newSocket.on('comment-updated', (data: { eventRequestId: number; comment: EventCollaborationComment }) => {
      if (data.eventRequestId === eventId) {
        logger.log('[EventCollaboration] Comment updated:', data.comment);
        setComments((prev) =>
          prev.map((c) => (c.id === data.comment.id ? data.comment : c))
        );
      }
    });

    newSocket.on('comment-deleted', (data: { eventRequestId: number; commentId: number }) => {
      if (data.eventRequestId === eventId) {
        logger.log('[EventCollaboration] Comment deleted:', data.commentId);
        setComments((prev) => prev.filter((c) => c.id !== data.commentId));
      }
    });

    // ==================== Error Events ====================

    newSocket.on('error', (data: { message: string }) => {
      logger.error('[EventCollaboration] Error:', data.message);
      setError(data.message);
    });

    setSocket(newSocket);

    // ==================== Heartbeat ====================

    // Send heartbeat every 30 seconds
    heartbeatInterval.current = setInterval(() => {
      if (newSocket.connected) {
        newSocket.emit('heartbeat', {
          eventRequestId: eventId,
          userId: user.id,
        });
      }
    }, 30000);

    // ==================== Cleanup ====================

    return () => {
      logger.log('[EventCollaboration] Cleaning up...');
      
      // Clear heartbeat interval
      if (heartbeatInterval.current) {
        clearInterval(heartbeatInterval.current);
      }

      // Leave event room
      if (newSocket.connected) {
        newSocket.emit('leave-event', {
          eventRequestId: eventId,
          userId: user.id,
        });
      }

      // Disconnect socket
      newSocket.disconnect();
    };
  }, [user, eventId]);

  // ==================== Load Initial Comments ====================

  useEffect(() => {
    if (!eventId || !user) return;

    const loadComments = async () => {
      setCommentsLoading(true);
      try {
        const response = await apiRequest(
          'GET',
          `/api/event-requests/${eventId}/collaboration/comments`
        );
        setComments(response.comments || []);
      } catch (err) {
        logger.error('[EventCollaboration] Error loading comments:', err);
        setError('Failed to load comments');
      } finally {
        setCommentsLoading(false);
      }
    };

    loadComments();
  }, [eventId, user]);

  // ==================== Field Locking ====================

  const acquireFieldLock = useCallback(
    async (fieldName: string): Promise<void> => {
      if (!socket || !isConnected || !user) {
        throw new Error('Not connected to collaboration server');
      }

      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Lock acquisition timeout'));
        }, 5000);

        socket.emit(
          'acquire-lock',
          {
            eventRequestId: eventId,
            fieldName,
            userId: user.id,
            userName: user.display_name || `${user.first_name} ${user.last_name}`,
          },
          (response: { success: boolean; lock?: EventFieldLock; error?: string }) => {
            clearTimeout(timeout);
            if (response.success && response.lock) {
              resolve();
            } else {
              reject(new Error(response.error || 'Failed to acquire lock'));
            }
          }
        );
      });
    },
    [socket, isConnected, user, eventId]
  );

  const releaseFieldLock = useCallback(
    async (fieldName: string): Promise<void> => {
      if (!socket || !isConnected) {
        throw new Error('Not connected to collaboration server');
      }

      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Lock release timeout'));
        }, 5000);

        socket.emit(
          'release-lock',
          {
            eventRequestId: eventId,
            fieldName,
          },
          (response: { success: boolean; error?: string }) => {
            clearTimeout(timeout);
            if (response.success) {
              resolve();
            } else {
              reject(new Error(response.error || 'Failed to release lock'));
            }
          }
        );
      });
    },
    [socket, isConnected, eventId]
  );

  const isFieldLocked = useCallback(
    (fieldName: string): boolean => {
      return locks.has(fieldName);
    },
    [locks]
  );

  const isFieldLockedByMe = useCallback(
    (fieldName: string): boolean => {
      if (!user) return false;
      const lock = locks.get(fieldName);
      return lock ? lock.lockedBy === user.id : false;
    },
    [locks, user]
  );

  const isFieldLockedByOther = useCallback(
    (fieldName: string): boolean => {
      if (!user) return false;
      const lock = locks.get(fieldName);
      return lock ? lock.lockedBy !== user.id : false;
    },
    [locks, user]
  );

  // ==================== Comments ====================

  const addComment = useCallback(
    async (content: string, parentId?: number): Promise<void> => {
      if (!user) {
        throw new Error('User not authenticated');
      }

      try {
        const response = await apiRequest(
          'POST',
          `/api/event-requests/${eventId}/collaboration/comments`,
          {
            content,
            parentCommentId: parentId,
          }
        );

        // Socket.IO will handle real-time update, but update local state as backup
        if (response.comment) {
          setComments((prev) => [...prev, response.comment]);
        }
      } catch (err) {
        logger.error('[EventCollaboration] Error adding comment:', err);
        throw err;
      }
    },
    [eventId, user]
  );

  const updateComment = useCallback(
    async (id: number, content: string): Promise<void> => {
      if (!user) {
        throw new Error('User not authenticated');
      }

      try {
        const response = await apiRequest(
          'PATCH',
          `/api/event-requests/${eventId}/collaboration/comments/${id}`,
          { content }
        );

        // Socket.IO will handle real-time update, but update local state as backup
        if (response.comment) {
          setComments((prev) =>
            prev.map((c) => (c.id === id ? response.comment : c))
          );
        }
      } catch (err) {
        logger.error('[EventCollaboration] Error updating comment:', err);
        throw err;
      }
    },
    [eventId, user]
  );

  const deleteComment = useCallback(
    async (id: number): Promise<void> => {
      if (!user) {
        throw new Error('User not authenticated');
      }

      try {
        await apiRequest(
          'DELETE',
          `/api/event-requests/${eventId}/collaboration/comments/${id}`
        );

        // Socket.IO will handle real-time update, but update local state as backup
        setComments((prev) => prev.filter((c) => c.id !== id));
      } catch (err) {
        logger.error('[EventCollaboration] Error deleting comment:', err);
        throw err;
      }
    },
    [eventId, user]
  );

  // ==================== Field Updates ====================

  const onFieldUpdate = useCallback((callback: FieldUpdateCallback) => {
    fieldUpdateCallbacks.current.add(callback);

    // Return cleanup function
    return () => {
      fieldUpdateCallbacks.current.delete(callback);
    };
  }, []);

  const updateField = useCallback(
    async (fieldName: string, value: any, expectedVersion: Date): Promise<void> => {
      if (!socket || !isConnected || !user) {
        throw new Error('Not connected to collaboration server');
      }

      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Field update timeout'));
        }, 10000);

        socket.emit(
          'field-update',
          {
            eventRequestId: eventId,
            fieldName,
            value,
            expectedVersion: expectedVersion.toISOString(),
            userId: user.id,
            userName: user.display_name || `${user.first_name} ${user.last_name}`,
          },
          (response: { success: boolean; conflict?: boolean; currentVersion?: Date; error?: string }) => {
            clearTimeout(timeout);
            if (response.success) {
              resolve();
            } else if (response.conflict) {
              reject(new Error(`Conflict: Field was modified by another user. Current version: ${response.currentVersion}`));
            } else {
              reject(new Error(response.error || 'Failed to update field'));
            }
          }
        );
      });
    },
    [socket, isConnected, user, eventId]
  );

  // ==================== Revision History ====================

  const loadRevisions = useCallback(async (): Promise<EventEditRevision[]> => {
    if (!eventId || !user) {
      throw new Error('Cannot load revisions: missing event ID or user');
    }

    setRevisionsLoading(true);
    try {
      const response = await apiRequest(
        'GET',
        `/api/event-requests/${eventId}/collaboration/revisions`
      );
      const revs = response.revisions || [];
      setRevisions(revs);
      return revs;
    } catch (err) {
      logger.error('[EventCollaboration] Error loading revisions:', err);
      throw err;
    } finally {
      setRevisionsLoading(false);
    }
  }, [eventId, user]);

  // ==================== Reconnection ====================

  const reconnect = useCallback(() => {
    if (socket) {
      logger.log('[EventCollaboration] Manual reconnection requested');
      socket.connect();
    }
  }, [socket]);

  // ==================== Return Hook API ====================

  return {
    // Connection state
    isConnected,
    error,
    reconnect,

    // Presence
    presentUsers,

    // Field locking
    locks,
    acquireFieldLock,
    releaseFieldLock,
    isFieldLocked,
    isFieldLockedByMe,
    isFieldLockedByOther,

    // Comments
    comments,
    addComment,
    updateComment,
    deleteComment,
    commentsLoading,

    // Real-time updates
    onFieldUpdate,
    updateField,

    // Revision history
    revisions,
    loadRevisions,
    revisionsLoading,
  };
}
