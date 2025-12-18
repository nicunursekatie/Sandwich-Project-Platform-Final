import { logger } from '@/lib/logger';

// WebSocket connection utility to handle various deployment environments
// Supports: Replit, Firebase Hosting, Cloud Run, local development, and more

export interface WebSocketConfig {
  path: string;
  protocol?: 'ws' | 'wss';
  maxRetries?: number;
  retryDelay?: number;
}

/**
 * Detect the deployment environment
 */
function detectEnvironment(hostname: string): 'replit' | 'firebase' | 'cloudrun' | 'localhost' | 'production' {
  if (hostname.includes('replit.app') || hostname.includes('replit.dev') || hostname.includes('replit.com')) {
    return 'replit';
  }
  if (hostname.includes('web.app') || hostname.includes('firebaseapp.com')) {
    return 'firebase';
  }
  if (hostname.includes('run.app')) {
    return 'cloudrun';
  }
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return 'localhost';
  }
  return 'production';
}

export function getWebSocketUrl(config: WebSocketConfig): string {
  if (typeof window === 'undefined') return '';

  const { path, protocol: forcedProtocol } = config;

  // Determine protocol
  const protocol = forcedProtocol || (window.location.protocol === 'https:' ? 'wss:' : 'ws:');

  // Get hostname and port from current location
  const hostname = window.location.hostname;
  const port = window.location.port;

  const environment = detectEnvironment(hostname);

  logger.log('WebSocket URL Construction:', {
    hostname,
    port,
    protocol,
    path,
    environment
  });

  let host;

  switch (environment) {
    case 'replit':
      // Replit environments - DO NOT add port, reverse proxy handles routing
      // Adding port causes "Invalid frame header" errors
      host = hostname;
      break;

    case 'firebase':
    case 'cloudrun':
    case 'production':
      // Cloud environments typically don't need explicit ports
      // The load balancer/proxy handles routing
      host = port ? `${hostname}:${port}` : hostname;
      break;

    case 'localhost':
      // Local development - use port from URL or default to 5000
      const resolvedPort = port || '5000';
      host = `${hostname}:${resolvedPort}`;
      break;

    default:
      // Fallback - use full host
      host = port ? `${hostname}:${port}` : hostname;
  }

  const url = `${protocol}//${host}${path}`;
  logger.log('Final WebSocket URL:', url);

  return url;
}

export function createWebSocketConnection(
  config: WebSocketConfig,
  options: {
    onOpen?: (ws: WebSocket) => void;
    onMessage?: (event: MessageEvent) => void;
    onError?: (event: Event) => void;
    onClose?: (event: CloseEvent) => void;
    autoReconnect?: boolean;
  } = {}
): { ws: WebSocket | null; cleanup: () => void } {
  const { onOpen, onMessage, onError, onClose, autoReconnect = true } = options;
  let ws: WebSocket | null = null;
  let reconnectAttempts = 0;
  let reconnectTimeout: NodeJS.Timeout | null = null;
  let isCleanedUp = false;

  const connect = () => {
    if (isCleanedUp) return;

    try {
      const url = getWebSocketUrl(config);
      logger.log(`Attempting WebSocket connection to: ${url}`);

      ws = new WebSocket(url);

      ws.onopen = (event) => {
        logger.log('WebSocket connected successfully');
        reconnectAttempts = 0;
        onOpen?.(ws!);
      };

      ws.onmessage = (event) => {
        onMessage?.(event);
      };

      ws.onerror = (event) => {
        logger.error('WebSocket error:', event);
        onError?.(event);
      };

      ws.onclose = (event) => {
        logger.log('WebSocket closed:', event.code, event.reason);
        onClose?.(event);

        // Auto-reconnect if not a normal closure and not cleaned up
        if (autoReconnect && !isCleanedUp && event.code !== 1000) {
          const maxRetries = config.maxRetries || 5;
          if (reconnectAttempts < maxRetries) {
            reconnectAttempts++;
            const delay = (config.retryDelay || 5000) * reconnectAttempts;
            logger.log(`Attempting reconnect ${reconnectAttempts}/${maxRetries} in ${delay}ms`);

            reconnectTimeout = setTimeout(connect, delay);
          } else {
            logger.error('Max reconnection attempts reached');
          }
        }
      };

    } catch (error) {
      logger.error('Failed to create WebSocket:', error);
      onError?.(new Event('error'));
    }
  };

  const cleanup = () => {
    isCleanedUp = true;
    if (reconnectTimeout) {
      clearTimeout(reconnectTimeout);
      reconnectTimeout = null;
    }
    if (ws && ws.readyState !== WebSocket.CLOSED) {
      ws.close(1000, 'Component cleanup');
    }
  };

  // Start initial connection
  connect();

  return { ws, cleanup };
}