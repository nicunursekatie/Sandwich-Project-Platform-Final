/**
 * Business Metrics Tracking
 *
 * Tracks key business metrics like active users, event processing,
 * notification delivery, and other domain-specific metrics
 */

import {
  activeUsers,
  eventRequestsTotal,
  eventRequestProcessingDuration,
  notificationsTotal,
  notificationDeliveryDuration,
  sandwichCollectionsTotal,
  activeSessions,
  authAttempts,
  externalApiCalls,
  externalApiDuration,
  externalApiErrors,
  backgroundJobsTotal,
  backgroundJobDuration,
} from './metrics';
import logger from '../utils/logger';

/**
 * Track active user count
 * Call this periodically (e.g., every minute) to update active user gauge
 */
export async function updateActiveUsersCount(storage: any): Promise<void> {
  try {
    // Get users active in last 5 minutes, 1 hour, and 24 hours
    const now = new Date();
    const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    // You'll need to implement these queries in your storage layer
    // For now, we'll use placeholder values
    // In production, query activity_logs or similar table

    const users5min = await countActiveUsers(storage, fiveMinutesAgo);
    const users1hour = await countActiveUsers(storage, oneHourAgo);
    const users24hours = await countActiveUsers(storage, oneDayAgo);

    activeUsers.set({ timeframe: '5m' }, users5min);
    activeUsers.set({ timeframe: '1h' }, users1hour);
    activeUsers.set({ timeframe: '24h' }, users24hours);

    logger.debug('Updated active users count', {
      users5min,
      users1hour,
      users24hours,
    });
  } catch (error: any) {
    logger.error('Failed to update active users count', { error: error.message });
  }
}

/**
 * Helper to count active users since a given time
 */
async function countActiveUsers(storage: any, since: Date): Promise<number> {
  try {
    // This should query your activity_logs table
    // Placeholder implementation
    if (storage.getActiveUsersSince) {
      return await storage.getActiveUsersSince(since);
    }
    return 0;
  } catch (error) {
    return 0;
  }
}

/**
 * Track event request creation
 */
export function trackEventRequestCreated(status: string, type: string = 'standard'): void {
  eventRequestsTotal.inc({ status, type });
  logger.debug('Event request tracked', { status, type });
}

/**
 * Track event request processing time
 */
export function trackEventRequestProcessing(status: string, durationSeconds: number): void {
  eventRequestProcessingDuration.observe({ status }, durationSeconds);

  if (durationSeconds > 60) {
    logger.warn('Slow event request processing', {
      status,
      duration: `${durationSeconds.toFixed(2)}s`,
    });
  }
}

/**
 * Track notification sent
 */
export function trackNotificationSent(
  type: 'email' | 'sms' | 'push' | 'websocket',
  channel: string,
  status: 'success' | 'failed'
): void {
  notificationsTotal.inc({ type, channel, status });
}

/**
 * Track notification delivery time
 */
export function trackNotificationDelivery(
  type: 'email' | 'sms' | 'push' | 'websocket',
  channel: string,
  durationSeconds: number
): void {
  notificationDeliveryDuration.observe({ type, channel }, durationSeconds);

  if (durationSeconds > 5) {
    logger.warn('Slow notification delivery', {
      type,
      channel,
      duration: `${durationSeconds.toFixed(2)}s`,
    });
  }
}

/**
 * Track sandwich collection
 */
export function trackSandwichCollection(status: 'completed' | 'pending' | 'cancelled'): void {
  sandwichCollectionsTotal.inc({ status });
}

/**
 * Track authentication attempt
 */
export function trackAuthAttempt(method: 'local' | 'openid' | 'api_key', status: 'success' | 'failed'): void {
  authAttempts.inc({ method, status });

  if (status === 'failed') {
    logger.warn('Failed authentication attempt', { method });
  }
}

/**
 * Update active sessions count
 * Call this periodically to update the gauge
 */
export async function updateActiveSessionsCount(sessionStore: any): Promise<void> {
  try {
    // Count active sessions from session store
    const count = await new Promise<number>((resolve, reject) => {
      sessionStore.length((err: any, length: number) => {
        if (err) reject(err);
        else resolve(length || 0);
      });
    });

    activeSessions.set(count);
    logger.debug('Updated active sessions count', { count });
  } catch (error: any) {
    logger.error('Failed to update active sessions count', { error: error.message });
  }
}

/**
 * Track external API call
 */
export function trackExternalApiCall(
  service: string,
  endpoint: string,
  status: 'success' | 'failed',
  durationSeconds: number
): void {
  externalApiCalls.inc({ service, endpoint, status });
  externalApiDuration.observe({ service, endpoint }, durationSeconds);

  if (durationSeconds > 10) {
    logger.warn('Slow external API call', {
      service,
      endpoint,
      duration: `${durationSeconds.toFixed(2)}s`,
    });
  }

  if (status === 'failed') {
    logger.error('External API call failed', { service, endpoint });
  }
}

/**
 * Track external API error
 */
export function trackExternalApiError(service: string, errorType: string): void {
  externalApiErrors.inc({ service, error_type: errorType });
}

/**
 * Track background job execution
 */
export function trackBackgroundJob(
  jobType: string,
  status: 'success' | 'failed',
  durationSeconds: number
): void {
  backgroundJobsTotal.inc({ job_type: jobType, status });
  backgroundJobDuration.observe({ job_type: jobType }, durationSeconds);

  logger.info('Background job completed', {
    jobType,
    status,
    duration: `${durationSeconds.toFixed(2)}s`,
  });

  if (durationSeconds > 300) {
    logger.warn('Slow background job', {
      jobType,
      duration: `${durationSeconds.toFixed(2)}s`,
    });
  }
}

/**
 * Wrap external API call with metrics tracking
 */
export async function monitorExternalApi<T>(
  service: string,
  endpoint: string,
  fn: () => Promise<T>
): Promise<T> {
  const startTime = process.hrtime.bigint();
  try {
    const result = await fn();
    const endTime = process.hrtime.bigint();
    const duration = Number(endTime - startTime) / 1e9;
    trackExternalApiCall(service, endpoint, 'success', duration);
    return result;
  } catch (error: any) {
    const endTime = process.hrtime.bigint();
    const duration = Number(endTime - startTime) / 1e9;
    trackExternalApiCall(service, endpoint, 'failed', duration);
    trackExternalApiError(service, error.name || 'UnknownError');
    throw error;
  }
}

/**
 * Wrap background job with metrics tracking
 */
export async function monitorBackgroundJob<T>(
  jobType: string,
  fn: () => Promise<T>
): Promise<T> {
  const startTime = process.hrtime.bigint();
  try {
    const result = await fn();
    const endTime = process.hrtime.bigint();
    const duration = Number(endTime - startTime) / 1e9;
    trackBackgroundJob(jobType, 'success', duration);
    return result;
  } catch (error) {
    const endTime = process.hrtime.bigint();
    const duration = Number(endTime - startTime) / 1e9;
    trackBackgroundJob(jobType, 'failed', duration);
    throw error;
  }
}

/**
 * Start periodic metrics updates
 * Call this once during server initialization
 */
export function startMetricsUpdates(storage: any, sessionStore: any): void {
  // Update active users every minute
  const updateUsers = async () => {
    await updateActiveUsersCount(storage);
  };

  // Update active sessions every minute
  const updateSessions = async () => {
    await updateActiveSessionsCount(sessionStore);
  };

  // Run immediately
  updateUsers();
  updateSessions();

  // Then run every minute
  setInterval(updateUsers, 60 * 1000);
  setInterval(updateSessions, 60 * 1000);

  logger.info('Started periodic metrics updates');
}
