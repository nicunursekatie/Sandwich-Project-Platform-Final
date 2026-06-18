import type { ManagerOptions, SocketOptions } from 'socket.io-client';

/**
 * Socket.IO transport policy for this app.
 *
 * Production and hosted environments sit behind reverse proxies that often break
 * the WebSocket upgrade ("Invalid frame header"). The README documents polling-only
 * as the supported transport there; local dev may use upgrade for faster iteration.
 */
export function shouldUsePollingOnlyTransport(): boolean {
  if (typeof window === 'undefined') return true;

  if (import.meta.env.VITE_SOCKET_POLLING_ONLY === 'true') return true;
  if (import.meta.env.VITE_SOCKET_POLLING_ONLY === 'false') return false;

  const hostname = window.location.hostname;
  const isLocalDev =
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname.endsWith('.local');

  // All non-local deployments (Replit, tspapp.org, etc.) use polling-only.
  return import.meta.env.PROD || !isLocalDev;
}

export type AppSocketIoOptions = Partial<ManagerOptions & SocketOptions>;

export function getDefaultSocketIoOptions(
  overrides: AppSocketIoOptions = {}
): AppSocketIoOptions {
  const pollingOnly = shouldUsePollingOnlyTransport();

  return {
    path: '/socket.io/',
    transports: pollingOnly ? ['polling'] : ['polling', 'websocket'],
    upgrade: !pollingOnly,
    timeout: 30000,
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    reconnectionAttempts: pollingOnly ? Infinity : 10,
    autoConnect: true,
    ...overrides,
  };
}
