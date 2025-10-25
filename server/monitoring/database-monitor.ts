/**
 * Database Query Performance Monitor
 *
 * Wraps database operations to track query performance and errors
 */

import { recordDbQuery } from './metrics';
import { logger } from '../utils/logger';
import * as Sentry from '@sentry/node';

interface QueryContext {
  operation: string;
  table: string;
  startTime: bigint;
  span?: any;
}

/**
 * Start monitoring a database query
 */
export function startDbQuery(operation: string, table: string, req?: any): QueryContext {
  const startTime = process.hrtime.bigint();

  // Create Sentry span if request is available
  let span;
  if (req?.sentryTransaction) {
    span = req.sentryTransaction.startChild({
      op: 'db.query',
      description: `${operation} ${table}`,
    });
  }

  return {
    operation,
    table,
    startTime,
    span,
  };
}

/**
 * End monitoring a database query
 */
export function endDbQuery(context: QueryContext, error?: Error): void {
  const endTime = process.hrtime.bigint();
  const duration = Number(endTime - context.startTime) / 1e9; // Convert to seconds

  // Record metrics
  recordDbQuery(context.operation, context.table, duration, !error, error);

  // Finish Sentry span
  if (context.span) {
    if (error) {
      context.span.setStatus('internal_error');
      context.span.setData('error', error.message);
    } else {
      context.span.setStatus('ok');
    }
    context.span.finish();
  }

  // Log slow queries
  if (duration > 0.5) {
    logger.warn('Slow database query detected', {
      operation: context.operation,
      table: context.table,
      duration: `${duration.toFixed(3)}s`,
      error: error?.message,
    });
  }

  // Capture errors
  if (error) {
    logger.error('Database query error', {
      operation: context.operation,
      table: context.table,
      duration: `${duration.toFixed(3)}s`,
      error: error.message,
      stack: error.stack,
    });

    Sentry.captureException(error, {
      extra: {
        operation: context.operation,
        table: context.table,
        duration,
      },
    });
  }
}

/**
 * Wrap a database operation with monitoring
 */
export async function monitorDbOperation<T>(
  operation: string,
  table: string,
  fn: () => Promise<T>,
  req?: any
): Promise<T> {
  const context = startDbQuery(operation, table, req);
  try {
    const result = await fn();
    endDbQuery(context);
    return result;
  } catch (error) {
    endDbQuery(context, error as Error);
    throw error;
  }
}

/**
 * Wrap a database operation with monitoring (sync version)
 */
export function monitorDbOperationSync<T>(
  operation: string,
  table: string,
  fn: () => T,
  req?: any
): T {
  const context = startDbQuery(operation, table, req);
  try {
    const result = fn();
    endDbQuery(context);
    return result;
  } catch (error) {
    endDbQuery(context, error as Error);
    throw error;
  }
}

/**
 * Create a database operation wrapper for a storage method
 */
export function createDbWrapper(storage: any): any {
  return new Proxy(storage, {
    get(target, prop) {
      const original = target[prop];

      // Only wrap functions
      if (typeof original !== 'function') {
        return original;
      }

      // Infer operation and table from method name
      const methodName = String(prop);
      let operation = 'unknown';
      let table = 'unknown';

      // Parse method name (e.g., getChatMessages -> get, chat_messages)
      if (methodName.startsWith('get')) {
        operation = 'SELECT';
        table = methodName.slice(3).replace(/([A-Z])/g, '_$1').toLowerCase();
      } else if (methodName.startsWith('create')) {
        operation = 'INSERT';
        table = methodName.slice(6).replace(/([A-Z])/g, '_$1').toLowerCase();
      } else if (methodName.startsWith('add')) {
        operation = 'INSERT';
        table = methodName.slice(3).replace(/([A-Z])/g, '_$1').toLowerCase();
      } else if (methodName.startsWith('update')) {
        operation = 'UPDATE';
        table = methodName.slice(6).replace(/([A-Z])/g, '_$1').toLowerCase();
      } else if (methodName.startsWith('delete')) {
        operation = 'DELETE';
        table = methodName.slice(6).replace(/([A-Z])/g, '_$1').toLowerCase();
      }

      // Return wrapped function that preserves sync/async behavior
      return function (...args: any[]) {
        const result = original.apply(target, args);

        // If the original method returns a Promise, monitor it asynchronously
        if (result instanceof Promise) {
          return monitorDbOperation(operation, table, () => result);
        }

        // If the original method is synchronous, monitor it synchronously
        return monitorDbOperationSync(operation, table, () => result);
      };
    },
  });
}
