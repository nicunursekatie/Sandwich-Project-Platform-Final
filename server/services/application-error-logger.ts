import { db } from '../db';
import { applicationErrorLogs } from '@shared/schema';
import { and, eq, gte } from 'drizzle-orm';
import { logger } from '../utils/production-safe-logger';

export type ApplicationErrorSource =
  | 'sms_parser'
  | 'sms_webhook'
  | 'health_check'
  | 'cron'
  | 'api'
  | 'email'
  | 'database'
  | 'integration';

export type ApplicationErrorSeverity = 'info' | 'warning' | 'error' | 'critical';

export interface ApplicationErrorInput {
  source: ApplicationErrorSource;
  severity?: ApplicationErrorSeverity;
  category?: string;
  message: string;
  details?: Record<string, unknown>;
  userId?: string;
  phoneNumber?: string;
  requestPath?: string;
  /** Email admin for error/critical (deduped within 6 hours for same fingerprint) */
  notifyAdmin?: boolean;
}

const ADMIN_EMAIL = 'katie@thesandwichproject.org';
const DEDUP_HOURS = 6;

async function shouldSendAdminEmail(input: ApplicationErrorInput): Promise<boolean> {
  const since = new Date();
  since.setHours(since.getHours() - DEDUP_HOURS);

  const conditions = [
    eq(applicationErrorLogs.source, input.source),
    eq(applicationErrorLogs.message, input.message),
    gte(applicationErrorLogs.createdAt, since),
    eq(applicationErrorLogs.emailSent, true),
  ];

  if (input.category) {
    conditions.push(eq(applicationErrorLogs.category, input.category));
  }

  const recent = await db
    .select({ id: applicationErrorLogs.id })
    .from(applicationErrorLogs)
    .where(and(...conditions))
    .limit(1);

  return recent.length === 0;
}

async function sendAdminNotification(
  input: ApplicationErrorInput,
  logId: number
): Promise<boolean> {
  try {
    const { sendEmail } = await import('./sendgrid');
    const severity = input.severity || 'error';
    const detailsJson = input.details
      ? JSON.stringify(input.details, null, 2)
      : '';

    await sendEmail({
      to: ADMIN_EMAIL,
      from: 'noreply@thesandwichproject.org',
      subject: `[TSP App ${severity.toUpperCase()}] ${input.source}: ${input.message.slice(0, 80)}`,
      text: [
        `Source: ${input.source}`,
        `Category: ${input.category || 'n/a'}`,
        `Severity: ${severity}`,
        `Time: ${new Date().toISOString()}`,
        input.phoneNumber ? `Phone: ${input.phoneNumber}` : '',
        input.requestPath ? `Path: ${input.requestPath}` : '',
        input.userId ? `User: ${input.userId}` : '',
        `Log ID: #${logId}`,
        '',
        detailsJson ? `Details:\n${detailsJson}` : '',
      ]
        .filter(Boolean)
        .join('\n'),
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px;">
          <h2 style="color: #c0392b;">Application Error — ${severity.toUpperCase()}</h2>
          <p><strong>Source:</strong> ${input.source}</p>
          <p><strong>Category:</strong> ${input.category || 'n/a'}</p>
          <p><strong>Message:</strong> ${input.message}</p>
          ${input.phoneNumber ? `<p><strong>Phone:</strong> ${input.phoneNumber}</p>` : ''}
          ${input.requestPath ? `<p><strong>Path:</strong> ${input.requestPath}</p>` : ''}
          <p><strong>Log ID:</strong> #${logId}</p>
          ${detailsJson ? `<pre style="background:#f4f4f4;padding:12px;border-radius:4px;overflow:auto;">${detailsJson}</pre>` : ''}
        </div>
      `,
    });

    await db
      .update(applicationErrorLogs)
      .set({ emailSent: true })
      .where(eq(applicationErrorLogs.id, logId));

    return true;
  } catch (err) {
    logger.error('[ApplicationErrorLogger] Failed to email admin:', err);
    return false;
  }
}

/**
 * Persist a server-side error for the admin error log. Fire-and-forget — never throws.
 */
export function logApplicationError(input: ApplicationErrorInput): void {
  const severity = input.severity || 'error';

  logger.warn(`[ApplicationError] ${input.source}/${input.category || 'general'}: ${input.message}`, {
    severity,
    details: input.details,
  });

  void (async () => {
    try {
      const [row] = await db
        .insert(applicationErrorLogs)
        .values({
          source: input.source,
          severity,
          category: input.category,
          message: input.message,
          details: input.details || {},
          userId: input.userId,
          phoneNumber: input.phoneNumber,
          requestPath: input.requestPath,
        })
        .returning({ id: applicationErrorLogs.id });

      const shouldNotify =
        input.notifyAdmin !== false &&
        (severity === 'error' || severity === 'critical');

      if (shouldNotify && row?.id) {
        const canEmail = await shouldSendAdminEmail(input);
        if (canEmail) {
          await sendAdminNotification(input, row.id);
        }
      }
    } catch (err) {
      logger.error('[ApplicationErrorLogger] Failed to persist error log:', err);
    }
  })();
}
