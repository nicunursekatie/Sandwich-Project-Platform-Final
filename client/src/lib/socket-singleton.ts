import { io, Socket } from 'socket.io-client';
import { logger } from './logger';
import { getDefaultSocketIoOptions } from './socket-io-config';

let socketInstance: Socket | null = null;
let connectionPromise: Promise<Socket> | null = null;

/** Debounce stale-session resets so we don't stack reconnects on top of Socket.IO's own backoff. */
let lastSessionResetAt = 0;
const SESSION_RESET_COOLDOWN_MS = 30_000;

function isStaleSessionError(message: string): boolean {
  const lower = message.toLowerCase();
  // Invalid/expired Socket.IO session — not generic transport failures during outages.
  return (
    lower.includes('invalid sid') ||
    lower.includes('unknown sid') ||
    lower.includes('session id unknown') ||
    (lower.includes('session') && lower.includes('invalid'))
  );
}

export function getSocketInstance(): Socket | null {
  return socketInstance;
}

export function getOrCreateSocket(): Socket {
  if (socketInstance) {
    return socketInstance;
  }

  const socketUrl = typeof window !== 'undefined' ? window.location.origin : '';

  logger.log('[SocketSingleton] Creating new Socket.IO connection to:', socketUrl);

  socketInstance = io(socketUrl, getDefaultSocketIoOptions());

  socketInstance.on('connect', () => {
    logger.log('[SocketSingleton] Connected successfully');
  });

  socketInstance.on('disconnect', (reason) => {
    logger.log('[SocketSingleton] Disconnected:', reason);
  });

  socketInstance.on('connect_error', (error) => {
    logger.error('[SocketSingleton] Connection error:', error.message);

    // Only reset the session for explicit stale-session errors — NOT generic
    // xhr poll/post errors during Replit restarts (those cause reconnect storms + 429s).
    if (!isStaleSessionError(error.message)) {
      return;
    }

    const now = Date.now();
    if (now - lastSessionResetAt < SESSION_RESET_COOLDOWN_MS) {
      logger.log('[SocketSingleton] Stale session detected but reset is on cooldown');
      return;
    }
    lastSessionResetAt = now;

    logger.log('[SocketSingleton] Stale session detected, resetting connection once');
    if (socketInstance) {
      socketInstance.io.opts.query = {};
      socketInstance.disconnect();
      setTimeout(() => {
        if (socketInstance && !socketInstance.connected) {
          socketInstance.connect();
        }
      }, 3000);
    }
  });

  return socketInstance;
}

/** Run handler on connect; also runs immediately when the socket is already connected. */
export function onSocketConnect(socket: Socket, handler: () => void): () => void {
  socket.on('connect', handler);
  if (socket.connected) {
    handler();
  }
  return () => {
    socket.off('connect', handler);
  };
}

export function disconnectSocket(): void {
  if (socketInstance) {
    logger.log('[SocketSingleton] Disconnecting socket');
    socketInstance.disconnect();
    socketInstance = null;
    connectionPromise = null;
  }
}

export function isSocketConnected(): boolean {
  return socketInstance?.connected ?? false;
}
