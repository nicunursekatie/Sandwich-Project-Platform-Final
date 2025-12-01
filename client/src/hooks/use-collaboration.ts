/**
 * useCollaboration - Generic React hook for real-time collaboration on any resource type
 * 
 * This hook provides a complete solution for multi-user collaboration on any resource,
 * including presence tracking, field locking, real-time updates, comments, and revision history.
 * 
 * @example
 * ```tsx
 * function ResourceEditor({ resourceId }: { resourceId: number }) {
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
 *   } = useCollaboration({
 *     resourceType: 'event',
 *     resourceId,
 *   });
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
 * }
 * ```
 * 
 * Features:
 * - Resource-type agnostic (works for events, tasks, planning items, etc.)
 * - Real-time presence tracking (see who's viewing the resource)
 * - Field-level locking to prevent edit conflicts
 * - Optimistic concurrency control with version-based conflict detection
 * - Real-time comments with create/update/delete
 * - Revision history tracking
 * - Automatic heartbeat to maintain connection
 * - Auto-cleanup on unmount
 * - Custom event broadcasting
 */

import { useEffect, useState, useCallback, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuth } from './useAuth';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { logger } from '@/lib/logger';
import type { EventCollaborationComment, EventFieldLock, EventEditRevision } from '@shared/schema';

export type ResourceType = 'event' | 'holding-zone' | 'planning-workspace';

export interface PresenceUser {
  userId: string;
  userName: string;
  joinedAt: Date;
  lastHeartbeat: Date;
  socketId: string;
}

export interface ResourceFieldLock {
  fieldName: string;
  lockedBy: string;
  lockedByName: string;
  lockedAt: Date;
}

export interface ResourceState {
  resourceId: number | string;
  version: Date;
  activeLocks: ResourceFieldLock[];
  activeUsers: PresenceUser[];
}

export interface FieldUpdateData {
  fieldName: string;
  value: any;
  updatedAt: Date;
  updatedBy: string;
  updatedByName: string;
}

export interface FieldUpdateCallback {
  (fieldName: string, value: any, version: Date): void;
}

export interface UseCollaborationParams {
  resourceType: ResourceType;
  resourceId: number | string;
  namespace?: string; // defaults to '/collaboration'
}

export interface MentionNotification {
  id: string;
  resourceType: string;
  resourceId: number | string;
  mentionedBy: string;
  mentionedById: string;
  comment: string;
  commentId?: number;
  timestamp: string;
}

export interface ActivityItem {
  id: string;
  type: 'status_change' | 'field_update' | 'comment' | 'assignment' | 'join' | 'leave';
  userId: string;
  userName: string;
  description: string;
  details?: string;
  timestamp: Date;
  fieldName?: string;
  oldValue?: string;
  newValue?: string;
}

export interface UseCollaborationReturn {
  // Connection state
  isConnected: boolean;
  error: string | null;
  reconnect: () => void;

  // Presence
  presentUsers: PresenceUser[];

  // Field locking
  locks: Map<string, ResourceFieldLock>;
  acquireFieldLock: (fieldName: string) => Promise<void>;
  releaseFieldLock: (fieldName: string) => Promise<void>;
  isFieldLocked: (fieldName: string) => boolean;
  isFieldLockedByMe: (fieldName: string) => boolean;
  isFieldLockedByOther: (fieldName: string) => boolean;

  // Comments
  comments: EventCollaborationComment[];
  addComment: (content: string, parentId?: number) => Promise<void>;
  updateComment: (id: number, content: string) => Promise<void>;
  deleteComment: (id: number) => Promise<void>;
  commentsLoading: boolean;

  // Mentions
  mentions: MentionNotification[];
  clearMentions: () => void;
  clearMention: (id: string) => void;

  // Real-time updates
  onFieldUpdate: (callback: FieldUpdateCallback) => () => void;
  updateField: (fieldName: string, value: any, expectedVersion: Date) => Promise<void>;

  // Revision history
  revisions: EventEditRevision[];
  loadRevisions: () => Promise<EventEditRevision[]>;
  revisionsLoading: boolean;

  // Activity feed
  activities: ActivityItem[];
  clearActivities: () => void;

  // Custom events
  emit: (eventName: string, data: any) => void;
  on: (eventName: string, handler: (data: any) => void) => () => void;
}

export function useCollaboration({
  resourceType,
  resourceId,
  namespace = '/collaboration',
}: UseCollaborationParams): UseCollaborationReturn {
  const { user } = useAuth();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Presence tracking
  const [presentUsers, setPresentUsers] = useState<PresenceUser[]>([]);

  // Field locking
  const [locks, setLocks] = useState<Map<string, ResourceFieldLock>>(new Map());

  // Comments
  const [comments, setComments] = useState<EventCollaborationComment[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(false);

  // Revisions
  const [revisions, setRevisions] = useState<EventEditRevision[]>([]);
  const [revisionsLoading, setRevisionsLoading] = useState(false);

  // Mentions
  const [mentions, setMentions] = useState<MentionNotification[]>([]);

  // Activities
  const [activities, setActivities] = useState<ActivityItem[]>([]);

  // Field update callbacks
  const fieldUpdateCallbacks = useRef<Set<FieldUpdateCallback>>(new Set());

  // Custom event handlers
  const customEventHandlers = useRef<Map<string, Set<(data: any) => void>>>(new Map());

  // Heartbeat interval
  const heartbeatInterval = useRef<NodeJS.Timeout | null>(null);

  // ==================== Socket Connection ====================

  useEffect(() => {
    if (!user || !resourceId) return;

    // Use current origin for Socket.IO connection (or env variable if provided)
    // For Replit environments, don't include port - the proxy handles routing
    const socketUrl = import.meta.env.VITE_SOCKET_URL || (() => {
      const protocol = window.location.protocol;
      const hostname = window.location.hostname;

      // Check if we're in a Replit environment - don't add port as proxy handles it
      const isReplit = hostname.includes('replit.dev') ||
                       hostname.includes('replit.app') ||
                       hostname.includes('replit.com');

      if (isReplit) {
        return `${protocol}//${hostname}`;
      }

      // For local development, include the port
      const port = window.location.port || (protocol === 'https:' ? '443' : '80');
      return `${protocol}//${hostname}:${port}`;
    })();
    logger.log(`[Collaboration] Connecting to: ${socketUrl}${namespace}`);

    const newSocket = io(`${socketUrl}${namespace}`, {
      path: '/socket.io/',
      transports: ['polling', 'websocket'],
      upgrade: true,
      timeout: 30000,
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: 5,
      auth: {
        // Send authentication credentials with connection
        userId: user.id,
        userEmail: user.email,
      },
    });

    // Connection events
    newSocket.on('connect', () => {
      logger.log('[Collaboration] ✅ Connected');
      setIsConnected(true);
      setError(null);

      // Join resource room
      const userName = user.display_name || `${user.first_name} ${user.last_name}` || user.email || 'Anonymous';
      
      // Use resource-specific event names
      const joinEvent = resourceType === 'event' ? 'join-event' : 'join-resource';
      const payload = resourceType === 'event' 
        ? { eventRequestId: resourceId, userId: user.id, userName }
        : { resourceType, resourceId, userId: user.id, userName };

      newSocket.emit(joinEvent, payload);
    });

    newSocket.on('disconnect', () => {
      logger.log('[Collaboration] ❌ Disconnected');
      setIsConnected(false);
    });

    newSocket.on('connect_error', (err) => {
      logger.error('[Collaboration] Connection error:', err);
      setIsConnected(false);
      setError('Failed to connect to collaboration server');
    });

    // ==================== Resource State ====================

    newSocket.on('event-state', (state: ResourceState) => {
      logger.log('[Collaboration] Received initial state:', state);
      setPresentUsers(state.activeUsers || []);
      
      // Convert locks array to Map
      const locksMap = new Map<string, ResourceFieldLock>();
      (state.activeLocks || []).forEach((lock) => {
        locksMap.set(lock.fieldName, lock);
      });
      setLocks(locksMap);
    });

    // Also listen for generic resource-state event
    newSocket.on('resource-state', (state: ResourceState) => {
      logger.log('[Collaboration] Received initial resource state:', state);
      setPresentUsers(state.activeUsers || []);
      
      const locksMap = new Map<string, ResourceFieldLock>();
      (state.activeLocks || []).forEach((lock) => {
        locksMap.set(lock.fieldName, lock);
      });
      setLocks(locksMap);
    });

    // ==================== Presence Events ====================

    const handlePresenceUpdated = (data: { resourceId?: number | string; eventRequestId?: number; activeUsers: PresenceUser[] }) => {
      const dataResourceId = data.resourceId ?? data.eventRequestId;
      if (dataResourceId === resourceId) {
        logger.log('[Collaboration] Presence updated:', data.activeUsers);
        setPresentUsers(data.activeUsers || []);
      }
    };

    const handleUserJoined = (data: { resourceId?: number | string; eventRequestId?: number; user: PresenceUser }) => {
      const dataResourceId = data.resourceId ?? data.eventRequestId;
      if (dataResourceId === resourceId) {
        logger.log('[Collaboration] User joined:', data.user);
        setPresentUsers((prev) => {
          const existing = prev.find((u) => u.userId === data.user.userId);
          if (existing) return prev;
          return [...prev, data.user];
        });
      }
    };

    const handleUserLeft = (data: { resourceId?: number | string; eventRequestId?: number; userId: string }) => {
      const dataResourceId = data.resourceId ?? data.eventRequestId;
      if (dataResourceId === resourceId) {
        logger.log('[Collaboration] User left:', data.userId);
        setPresentUsers((prev) => prev.filter((u) => u.userId !== data.userId));
      }
    };

    newSocket.on('presence-updated', handlePresenceUpdated);
    newSocket.on('user-joined', handleUserJoined);
    newSocket.on('user-left', handleUserLeft);

    // ==================== Activity Events ====================

    const handleActivityUpdate = (data: { resourceId?: number | string; eventRequestId?: number; activity: ActivityItem }) => {
      // Accept either resourceId or eventRequestId for backward compatibility
      const dataResourceId = data.resourceId ?? data.eventRequestId;
      // Convert to numbers for comparison since resourceId may be string or number
      if (String(dataResourceId) === String(resourceId)) {
        logger.log('[Collaboration] Activity update:', data.activity);
        setActivities((prev) => {
          // Keep last 50 activities
          const updated = [data.activity, ...prev].slice(0, 50);
          return updated;
        });
      }
    };

    newSocket.on('activity-update', handleActivityUpdate);

    // ==================== Lock Events ====================

    const handleLocksUpdated = (data: { resourceId?: number | string; eventRequestId?: number; activeLocks: ResourceFieldLock[] }) => {
      const dataResourceId = data.resourceId ?? data.eventRequestId;
      if (dataResourceId === resourceId) {
        logger.log('[Collaboration] Locks updated:', data.activeLocks);
        const locksMap = new Map<string, ResourceFieldLock>();
        (data.activeLocks || []).forEach((lock) => {
          // Safety check: ensure lock has required fields
          if (lock && lock.fieldName) {
            locksMap.set(lock.fieldName, lock);
          } else {
            logger.error('[Collaboration] Invalid lock in activeLocks:', lock);
          }
        });
        setLocks(locksMap);
      }
    };

    const handleLockAcquired = (data: { resourceId?: number | string; eventRequestId?: number; lock: ResourceFieldLock }) => {
      const dataResourceId = data.resourceId ?? data.eventRequestId;
      if (dataResourceId === resourceId) {
        // Safety check: ensure lock object exists
        if (!data.lock || !data.lock.fieldName) {
          logger.error('[Collaboration] Invalid lock data received:', data);
          return;
        }
        logger.log('[Collaboration] Lock acquired:', data.lock);
        setLocks((prev) => {
          const newLocks = new Map(prev);
          newLocks.set(data.lock.fieldName, data.lock);
          return newLocks;
        });
      }
    };

    const handleLockReleased = (data: { resourceId?: number | string; eventRequestId?: number; fieldName: string }) => {
      const dataResourceId = data.resourceId ?? data.eventRequestId;
      if (dataResourceId === resourceId) {
        logger.log('[Collaboration] Lock released:', data.fieldName);
        setLocks((prev) => {
          const newLocks = new Map(prev);
          newLocks.delete(data.fieldName);
          return newLocks;
        });
      }
    };

    newSocket.on('locks-updated', handleLocksUpdated);
    newSocket.on('lock-acquired', handleLockAcquired);
    newSocket.on('lock-released', handleLockReleased);

    // ==================== Field Update Events ====================

    const handleFieldUpdated = (data: FieldUpdateData & { resourceId?: number | string; eventRequestId?: number }) => {
      const dataResourceId = data.resourceId ?? data.eventRequestId;
      if (dataResourceId === resourceId) {
        logger.log('[Collaboration] Field updated:', data);
        
        // Notify all registered callbacks
        fieldUpdateCallbacks.current.forEach((callback) => {
          callback(data.fieldName, data.value, data.updatedAt);
        });

        // Invalidate query to refresh data
        const queryKey = resourceType === 'event' 
          ? ['/api/event-requests', resourceId]
          : [`/api/${resourceType}`, resourceId];
        
        queryClient.invalidateQueries({ queryKey });
      }
    };

    newSocket.on('field-updated', handleFieldUpdated);

    // ==================== Comment Events ====================

    const handleCommentCreated = (data: { resourceId?: number | string; eventRequestId?: number; comment: EventCollaborationComment }) => {
      const dataResourceId = data.resourceId ?? data.eventRequestId;
      if (dataResourceId === resourceId) {
        logger.log('[Collaboration] Comment created:', data.comment);
        setComments((prev) => [...prev, data.comment]);
      }
    };

    const handleCommentUpdated = (data: { resourceId?: number | string; eventRequestId?: number; comment: EventCollaborationComment }) => {
      const dataResourceId = data.resourceId ?? data.eventRequestId;
      if (dataResourceId === resourceId) {
        logger.log('[Collaboration] Comment updated:', data.comment);
        setComments((prev) =>
          prev.map((c) => (c.id === data.comment.id ? data.comment : c))
        );
      }
    };

    const handleCommentDeleted = (data: { resourceId?: number | string; eventRequestId?: number; commentId: number }) => {
      const dataResourceId = data.resourceId ?? data.eventRequestId;
      if (dataResourceId === resourceId) {
        logger.log('[Collaboration] Comment deleted:', data.commentId);
        setComments((prev) => prev.filter((c) => c.id !== data.commentId));
      }
    };

    newSocket.on('comment-created', handleCommentCreated);
    newSocket.on('comment-updated', handleCommentUpdated);
    newSocket.on('comment-deleted', handleCommentDeleted);

    // ==================== Mention Events ====================

    const handleUserMentioned = (data: Omit<MentionNotification, 'id'>) => {
      logger.log('[Collaboration] User mentioned:', data);
      
      // Create a unique ID for the mention notification
      const mentionId = `${data.resourceType}-${data.resourceId}-${data.timestamp}`;
      
      // Add to mentions list
      setMentions((prev) => [
        ...prev,
        {
          ...data,
          id: mentionId,
        },
      ]);
    };

    newSocket.on('user-mentioned', handleUserMentioned);

    // ==================== Error Events ====================

    newSocket.on('error', (data: { message: string }) => {
      logger.error('[Collaboration] Error:', data.message);
      setError(data.message);
    });

    setSocket(newSocket);

    // ==================== Heartbeat ====================

    // Send heartbeat every 30 seconds
    heartbeatInterval.current = setInterval(() => {
      if (newSocket.connected) {
        const payload = resourceType === 'event'
          ? { eventRequestId: resourceId, userId: user.id }
          : { resourceType, resourceId, userId: user.id };
        
        newSocket.emit('heartbeat', payload);
      }
    }, 30000);

    // ==================== Cleanup ====================

    return () => {
      logger.log('[Collaboration] Cleaning up...');
      
      // Clear heartbeat interval
      if (heartbeatInterval.current) {
        clearInterval(heartbeatInterval.current);
      }

      // Leave resource room
      if (newSocket.connected) {
        const leaveEvent = resourceType === 'event' ? 'leave-event' : 'leave-resource';
        const payload = resourceType === 'event'
          ? { eventRequestId: resourceId, userId: user.id }
          : { resourceType, resourceId, userId: user.id };
        
        newSocket.emit(leaveEvent, payload);
      }

      // Disconnect socket
      newSocket.disconnect();
    };
  }, [user, resourceId, resourceType, namespace]);

  // ==================== Load Initial Comments ====================

  useEffect(() => {
    if (!resourceId || !user) return;

    const loadComments = async () => {
      setCommentsLoading(true);
      try {
        const endpoint = resourceType === 'event'
          ? `/api/event-requests/${resourceId}/collaboration/comments`
          : `/api/${resourceType}/${resourceId}/collaboration/comments`;
        
        const response = await apiRequest('GET', endpoint);
        setComments(response.comments || []);
      } catch (err) {
        logger.error('[Collaboration] Error loading comments:', err);
        setError('Failed to load comments');
      } finally {
        setCommentsLoading(false);
      }
    };

    loadComments();
  }, [resourceId, resourceType, user]);

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

        const payload = resourceType === 'event'
          ? {
              eventRequestId: resourceId,
              fieldName,
              userId: user.id,
              userName: user.display_name || `${user.first_name} ${user.last_name}`,
            }
          : {
              resourceType,
              resourceId,
              fieldName,
              userId: user.id,
              userName: user.display_name || `${user.first_name} ${user.last_name}`,
            };

        socket.emit(
          'acquire-lock',
          payload,
          (response: { success: boolean; lock?: ResourceFieldLock; error?: string }) => {
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
    [socket, isConnected, user, resourceId, resourceType]
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

        const payload = resourceType === 'event'
          ? { eventRequestId: resourceId, fieldName }
          : { resourceType, resourceId, fieldName };

        socket.emit(
          'release-lock',
          payload,
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
    [socket, isConnected, resourceId, resourceType]
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
        const endpoint = resourceType === 'event'
          ? `/api/event-requests/${resourceId}/collaboration/comments`
          : `/api/${resourceType}/${resourceId}/collaboration/comments`;

        const response = await apiRequest('POST', endpoint, {
          content,
          parentCommentId: parentId,
        });

        logger.log('[Collaboration] Comment created, response:', response);

        // Socket.IO will handle real-time update, but update local state as backup
        if (response && response.comment) {
          setComments((prev) => [...prev, response.comment]);
        } else {
          // If response doesn't contain comment, refetch all comments
          logger.warn('[Collaboration] Response missing comment, refetching all comments');
          const refetchEndpoint = resourceType === 'event'
            ? `/api/event-requests/${resourceId}/collaboration/comments`
            : `/api/${resourceType}/${resourceId}/collaboration/comments`;
          const refreshResponse = await apiRequest('GET', refetchEndpoint);
          if (refreshResponse && refreshResponse.comments) {
            setComments(refreshResponse.comments);
          }
        }
      } catch (err) {
        logger.error('[Collaboration] Error adding comment:', err);
        throw err;
      }
    },
    [resourceId, resourceType, user]
  );

  const updateComment = useCallback(
    async (id: number, content: string): Promise<void> => {
      if (!user) {
        throw new Error('User not authenticated');
      }

      try {
        const endpoint = resourceType === 'event'
          ? `/api/event-requests/${resourceId}/collaboration/comments/${id}`
          : `/api/${resourceType}/${resourceId}/collaboration/comments/${id}`;

        const response = await apiRequest('PATCH', endpoint, { content });

        // Socket.IO will handle real-time update, but update local state as backup
        if (response.comment) {
          setComments((prev) =>
            prev.map((c) => (c.id === id ? response.comment : c))
          );
        }
      } catch (err) {
        logger.error('[Collaboration] Error updating comment:', err);
        throw err;
      }
    },
    [resourceId, resourceType, user]
  );

  const deleteComment = useCallback(
    async (id: number): Promise<void> => {
      if (!user) {
        throw new Error('User not authenticated');
      }

      try {
        const endpoint = resourceType === 'event'
          ? `/api/event-requests/${resourceId}/collaboration/comments/${id}`
          : `/api/${resourceType}/${resourceId}/collaboration/comments/${id}`;

        await apiRequest('DELETE', endpoint);

        // Socket.IO will handle real-time update, but update local state as backup
        setComments((prev) => prev.filter((c) => c.id !== id));
      } catch (err) {
        logger.error('[Collaboration] Error deleting comment:', err);
        throw err;
      }
    },
    [resourceId, resourceType, user]
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

        const payload = resourceType === 'event'
          ? {
              eventRequestId: resourceId,
              fieldName,
              value,
              expectedVersion: expectedVersion.toISOString(),
              userId: user.id,
              userName: user.display_name || `${user.first_name} ${user.last_name}`,
            }
          : {
              resourceType,
              resourceId,
              fieldName,
              value,
              expectedVersion: expectedVersion.toISOString(),
              userId: user.id,
              userName: user.display_name || `${user.first_name} ${user.last_name}`,
            };

        socket.emit(
          'field-update',
          payload,
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
    [socket, isConnected, user, resourceId, resourceType]
  );

  // ==================== Revision History ====================

  const loadRevisions = useCallback(async (): Promise<EventEditRevision[]> => {
    if (!resourceId || !user) {
      throw new Error('Cannot load revisions: missing resource ID or user');
    }

    setRevisionsLoading(true);
    try {
      const endpoint = resourceType === 'event'
        ? `/api/event-requests/${resourceId}/collaboration/revisions`
        : `/api/${resourceType}/${resourceId}/collaboration/revisions`;

      const response = await apiRequest('GET', endpoint);
      const revs = response.revisions || [];
      setRevisions(revs);
      return revs;
    } catch (err) {
      logger.error('[Collaboration] Error loading revisions:', err);
      throw err;
    } finally {
      setRevisionsLoading(false);
    }
  }, [resourceId, resourceType, user]);

  // ==================== Custom Events ====================

  const emit = useCallback(
    (eventName: string, data: any) => {
      if (!socket || !isConnected) {
        logger.warn('[Collaboration] Cannot emit event: not connected');
        return;
      }

      socket.emit(eventName, data);
    },
    [socket, isConnected]
  );

  const on = useCallback(
    (eventName: string, handler: (data: any) => void) => {
      if (!socket) {
        logger.warn('[Collaboration] Cannot register event handler: socket not initialized');
        return () => {};
      }

      // Track custom event handlers
      if (!customEventHandlers.current.has(eventName)) {
        customEventHandlers.current.set(eventName, new Set());
      }
      customEventHandlers.current.get(eventName)!.add(handler);

      // Register with socket
      socket.on(eventName, handler);

      // Return cleanup function
      return () => {
        socket.off(eventName, handler);
        const handlers = customEventHandlers.current.get(eventName);
        if (handlers) {
          handlers.delete(handler);
          if (handlers.size === 0) {
            customEventHandlers.current.delete(eventName);
          }
        }
      };
    },
    [socket]
  );

  // ==================== Mentions ====================

  const clearMentions = useCallback(() => {
    setMentions([]);
  }, []);

  const clearMention = useCallback((id: string) => {
    setMentions((prev) => prev.filter((m) => m.id !== id));
  }, []);

  // ==================== Activities ====================

  const clearActivities = useCallback(() => {
    setActivities([]);
  }, []);

  // ==================== Reconnection ====================

  const reconnect = useCallback(() => {
    if (socket) {
      logger.log('[Collaboration] Manual reconnection requested');
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

    // Mentions
    mentions,
    clearMentions,
    clearMention,

    // Real-time updates
    onFieldUpdate,
    updateField,

    // Revision history
    revisions,
    loadRevisions,
    revisionsLoading,

    // Activities
    activities,
    clearActivities,

    // Custom events
    emit,
    on,
  };
}
