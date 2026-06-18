import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import {
  StickyNote,
  X,
  Minimize2,
  Maximize2,
  GripVertical,
  Check,
  AlertCircle,
  Clock,
} from 'lucide-react';
import type { EventRequest } from '@shared/schema';

interface CallNotesScratchpadDialogProps {
  eventRequest: EventRequest | null;
  isOpen: boolean;
  onClose: () => void;
}

export function CallNotesScratchpadDialog({
  eventRequest,
  isOpen,
  onClose,
}: CallNotesScratchpadDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [notes, setNotes] = useState('');
  const [localSavedAt, setLocalSavedAt] = useState<Date | null>(null);
  const [syncedAt, setSyncedAt] = useState<Date | null>(null);
  const [syncError, setSyncError] = useState('');
  const [isMinimized, setIsMinimized] = useState(false);
  const [position, setPosition] = useState({ x: 20, y: 100 });
  const [isDragging, setIsDragging] = useState(false);
  const dragOffset = useRef({ x: 0, y: 0 });

  const lastSyncedValueRef = useRef('');
  const expectedVersionRef = useRef<string | null>(null);
  const initializedRef = useRef(false);

  // Fetch latest event data to get current message
  const { data: latestEvent } = useQuery<EventRequest>({
    queryKey: ['/api/event-requests', eventRequest?.id, 'full'],
    queryFn: () => apiRequest('GET', `/api/event-requests/${eventRequest!.id}`),
    enabled: isOpen && !!eventRequest?.id,
    staleTime: 0,
  });

  const getLocalStorageKey = useCallback(() => {
    return `scratchpad_notes_event_${eventRequest?.id || 'none'}`;
  }, [eventRequest?.id]);

  // Initialize notes from server when opening
  useEffect(() => {
    if (!isOpen || !eventRequest?.id) {
      initializedRef.current = false;
      return;
    }

    const source = latestEvent || eventRequest;
    const serverMessage = source.message || '';

    // Check for local draft
    try {
      const raw = localStorage.getItem(getLocalStorageKey());
      if (raw) {
        const draft = JSON.parse(raw);
        if (draft && typeof draft.message === 'string') {
          const serverVersion = source.updatedAt ? String(source.updatedAt) : null;
          const draftVersion = draft.baseUpdatedAt;

          // Use draft if it's based on the current server version or newer
          if (draftVersion && serverVersion && draftVersion === serverVersion && draft.message !== serverMessage) {
            setNotes(draft.message);
            lastSyncedValueRef.current = serverMessage;
            expectedVersionRef.current = serverVersion;
            initializedRef.current = true;
            setSyncError('Local draft restored');
            return;
          }
        }
      }
    } catch {
      // ignore
    }

    setNotes(serverMessage);
    lastSyncedValueRef.current = serverMessage;
    expectedVersionRef.current = source.updatedAt ? String(source.updatedAt) : null;
    initializedRef.current = true;
    setSyncError('');
    setSyncedAt(null);
    setLocalSavedAt(null);
  }, [isOpen, eventRequest?.id, latestEvent, getLocalStorageKey]);

  // Save to localStorage on every change
  useEffect(() => {
    if (!isOpen || !initializedRef.current) return;
    try {
      localStorage.setItem(getLocalStorageKey(), JSON.stringify({
        message: notes,
        savedAt: new Date().toISOString(),
        baseUpdatedAt: expectedVersionRef.current,
      }));
      setLocalSavedAt(new Date());
    } catch {
      // ignore
    }
  }, [isOpen, notes, getLocalStorageKey]);

  // Auto-sync to server every 5 seconds
  const syncMutation = useMutation({
    mutationFn: ({ id, message }: { id: number; message: string }) => {
      const payload: Record<string, any> = { message };
      if (expectedVersionRef.current) {
        payload._expectedVersion = expectedVersionRef.current;
      }
      return apiRequest('PATCH', `/api/event-requests/${id}`, payload);
    },
    networkMode: 'always',
    onSuccess: (updatedEvent: any, variables) => {
      lastSyncedValueRef.current = variables.message;
      const newVersion = updatedEvent?.updatedAt ? String(updatedEvent.updatedAt) : null;
      if (newVersion) expectedVersionRef.current = newVersion;
      if (updatedEvent && variables?.id) {
        queryClient.setQueryData(['/api/event-requests', variables.id, 'full'], (prev: any) => ({
          ...(prev || {}),
          ...updatedEvent,
        }));

        // Keep cached list views in sync WITHOUT a full refetch. This dialog
        // auto-saves every 5s, so a nuclear invalidate here would cause a
        // refetch storm — and since the originating tab now ignores its own
        // socket echo, the list won't refresh on its own. Patch the changed
        // event into any cached list query by id (no-op if its shape doesn't
        // match or the event isn't present).
        queryClient.setQueriesData(
          {
            predicate: (query) =>
              Array.isArray(query.queryKey) &&
              query.queryKey[0] === '/api/event-requests/list',
          },
          (data: any) => {
            if (!data) return data;
            const patchArray = (arr: any[]) =>
              arr.map((item) =>
                item?.id === variables.id ? { ...item, ...updatedEvent } : item
              );
            if (Array.isArray(data)) return patchArray(data);
            if (Array.isArray(data?.requests)) return { ...data, requests: patchArray(data.requests) };
            if (Array.isArray(data?.items)) return { ...data, items: patchArray(data.items) };
            return data;
          }
        );
      }
      setSyncedAt(new Date());
      setSyncError('');
      // Clear local draft after successful sync
      try { localStorage.removeItem(getLocalStorageKey()); } catch { /* ignore */ }
    },
    onError: (error: any) => {
      const conflict = error?.status === 409 || error?.code?.includes?.('CONFLICT');
      setSyncError(conflict ? 'Sync conflict - close and reopen' : 'Sync pending');
    },
  });

  useEffect(() => {
    if (!isOpen || !eventRequest?.id || !initializedRef.current) return;

    const interval = setInterval(() => {
      const hasUnsyncedChanges = notes !== lastSyncedValueRef.current;
      if (!hasUnsyncedChanges || syncMutation.isPending) return;
      syncMutation.mutate({ id: eventRequest.id, message: notes });
    }, 5000);

    return () => clearInterval(interval);
  }, [isOpen, eventRequest?.id, notes, syncMutation]);

  // Sync on close if there are unsaved changes
  const handleClose = () => {
    if (eventRequest?.id && notes !== lastSyncedValueRef.current) {
      syncMutation.mutate({ id: eventRequest.id, message: notes });
    }
    try { localStorage.removeItem(getLocalStorageKey()); } catch { /* ignore */ }
    initializedRef.current = false;
    onClose();
  };

  // Dragging logic
  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    dragOffset.current = {
      x: e.clientX - position.x,
      y: e.clientY - position.y,
    };
    e.preventDefault();
  };

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      setPosition({
        x: Math.max(0, Math.min(e.clientX - dragOffset.current.x, window.innerWidth - 400)),
        y: Math.max(0, Math.min(e.clientY - dragOffset.current.y, window.innerHeight - 100)),
      });
    };

    const handleMouseUp = () => setIsDragging(false);

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging]);

  if (!isOpen || !eventRequest) return null;

  const hasUnsyncedChanges = notes !== lastSyncedValueRef.current;

  return (
    <div
      className="fixed z-[60] shadow-2xl rounded-lg border border-amber-300 bg-amber-50 overflow-hidden"
      style={{
        left: position.x,
        top: position.y,
        width: isMinimized ? '280px' : '420px',
        maxHeight: isMinimized ? 'auto' : '70vh',
      }}
    >
      {/* Header - draggable */}
      <div
        className="flex items-center justify-between px-3 py-2 bg-amber-100 border-b border-amber-300 cursor-move select-none"
        onMouseDown={handleMouseDown}
      >
        <div className="flex items-center gap-2 min-w-0">
          <GripVertical className="w-4 h-4 text-amber-600 flex-shrink-0" />
          <StickyNote className="w-4 h-4 text-amber-700 flex-shrink-0" />
          <span className="text-sm font-semibold text-amber-900 truncate">
            Call Notes — {eventRequest.organizationName || 'Event'}
          </span>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          {/* Sync indicator */}
          {hasUnsyncedChanges ? (
            <Clock className="w-3.5 h-3.5 text-amber-600" title="Unsaved changes" />
          ) : syncedAt ? (
            <Check className="w-3.5 h-3.5 text-green-600" title={`Synced ${syncedAt.toLocaleTimeString()}`} />
          ) : null}
          {syncError && (
            <AlertCircle className="w-3.5 h-3.5 text-red-500" title={syncError} />
          )}
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 text-amber-700 hover:bg-amber-200"
            onClick={() => setIsMinimized(!isMinimized)}
          >
            {isMinimized ? <Maximize2 className="w-3.5 h-3.5" /> : <Minimize2 className="w-3.5 h-3.5" />}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 text-amber-700 hover:bg-amber-200"
            onClick={handleClose}
          >
            <X className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      {/* Content */}
      {!isMinimized && (
        <div className="p-3">
          <div className="flex items-center justify-between mb-2">
            <Label className="text-xs font-medium text-amber-800">
              Capture everything from the call here. Saves automatically.
            </Label>
          </div>
          <Textarea
            value={notes}
            onChange={(e) => {
              setNotes(e.target.value);
              setSyncError('');
            }}
            placeholder="Type your call notes here..."
            className="min-h-[200px] bg-white border-amber-200 focus:border-amber-400 text-sm resize-y"
            autoFocus
          />
          <div className="flex items-center justify-between mt-2 text-xs text-amber-700">
            <span>
              {localSavedAt ? `Saved locally ${localSavedAt.toLocaleTimeString()}` : 'Not saved yet'}
              {syncedAt ? ` · Synced ${syncedAt.toLocaleTimeString()}` : ''}
            </span>
            {hasUnsyncedChanges && (
              <Button
                variant="ghost"
                size="sm"
                className="h-6 text-xs text-amber-800 hover:bg-amber-200 px-2"
                onClick={() => {
                  if (eventRequest.id) {
                    syncMutation.mutate({ id: eventRequest.id, message: notes });
                  }
                }}
                disabled={syncMutation.isPending}
              >
                {syncMutation.isPending ? 'Saving...' : 'Save now'}
              </Button>
            )}
          </div>
          {syncError && (
            <p className="text-xs text-red-600 mt-1">{syncError}</p>
          )}
        </div>
      )}
    </div>
  );
}
