import OpenAI from 'openai';
import { validateSMSConfig } from '../sms-service';
import { logApplicationError } from './application-error-logger';

export interface IntegrationCheckResult {
  name: string;
  configured: boolean;
  healthy: boolean | null; // null = not tested live
  message: string;
  latencyMs?: number;
  details?: Record<string, unknown>;
}

export interface SystemHealthReport {
  checkedAt: string;
  overallStatus: 'healthy' | 'degraded' | 'unhealthy';
  integrations: IntegrationCheckResult[];
}

async function checkOpenAIForSmsParser(
  liveCheck: boolean
): Promise<IntegrationCheckResult> {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    return {
      name: 'OpenAI (SMS collection parser)',
      configured: false,
      healthy: false,
      message: 'OPENAI_API_KEY is not set — complex SMS formats will fail to parse',
    };
  }

  if (!liveCheck) {
    return {
      name: 'OpenAI (SMS collection parser)',
      configured: true,
      healthy: null,
      message: 'API key present (run live check to verify)',
    };
  }

  try {
    const client = new OpenAI({ apiKey });
    const start = Date.now();
    await client.chat.completions.create({
      model: 'gpt-4o-mini',
      max_tokens: 5,
      messages: [{ role: 'user', content: 'Reply with OK' }],
    });

    return {
      name: 'OpenAI (SMS collection parser)',
      configured: true,
      healthy: true,
      message: 'API key valid and responding',
      latencyMs: Date.now() - start,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      name: 'OpenAI (SMS collection parser)',
      configured: true,
      healthy: false,
      message: `API call failed: ${message}`,
    };
  }
}

function checkSendGrid(): IntegrationCheckResult {
  const configured = !!process.env.SENDGRID_API_KEY;
  return {
    name: 'SendGrid (email)',
    configured,
    healthy: configured ? null : false,
    message: configured ? 'API key present' : 'SENDGRID_API_KEY is not set',
  };
}

function checkTwilio(): IntegrationCheckResult {
  const config = validateSMSConfig();
  return {
    name: 'Twilio (SMS)',
    configured: config.isConfigured,
    healthy: config.isConfigured ? null : false,
    message: config.isConfigured
      ? 'Credentials configured'
      : `Missing: ${config.missingItems.join(', ') || 'credentials'}`,
    details: config.providersStatus,
  };
}

function checkSentry(): IntegrationCheckResult {
  const configured = !!process.env.SENTRY_DSN;
  return {
    name: 'Sentry (error tracking)',
    configured,
    healthy: configured ? null : false,
    message: configured ? 'DSN configured' : 'SENTRY_DSN not set — external error tracking disabled',
  };
}

function checkAnthropicIntegrations(): IntegrationCheckResult {
  const configured = !!process.env.AI_INTEGRATIONS_OPENAI_API_KEY;
  return {
    name: 'AI Integrations (Replit)',
    configured,
    healthy: configured ? null : false,
    message: configured
      ? 'AI_INTEGRATIONS_OPENAI_API_KEY present'
      : 'AI_INTEGRATIONS_OPENAI_API_KEY not set — AI features in app may fail',
  };
}

export async function runIntegrationHealthCheck(options?: {
  liveCheck?: boolean;
  logFailures?: boolean;
}): Promise<SystemHealthReport> {
  const liveCheck = options?.liveCheck ?? false;
  const logFailures = options?.logFailures ?? false;

  const integrations = await Promise.all([
    checkOpenAIForSmsParser(liveCheck),
    Promise.resolve(checkSendGrid()),
    Promise.resolve(checkTwilio()),
    Promise.resolve(checkSentry()),
    Promise.resolve(checkAnthropicIntegrations()),
  ]);

  const unhealthy = integrations.filter((i) => i.healthy === false);
  const degraded = integrations.filter((i) => !i.configured && i.healthy !== true);

  let overallStatus: SystemHealthReport['overallStatus'] = 'healthy';
  if (unhealthy.length > 0) {
    overallStatus = 'unhealthy';
  } else if (degraded.length > 0) {
    overallStatus = 'degraded';
  }

  if (logFailures) {
    for (const integration of integrations) {
      if (integration.healthy === false) {
        logApplicationError({
          source: 'health_check',
          severity: 'error',
          category: integration.name.toLowerCase().replace(/\s+/g, '_'),
          message: `${integration.name}: ${integration.message}`,
          details: integration.details,
          notifyAdmin: true,
        });
      }
    }
  }

  return {
    checkedAt: new Date().toISOString(),
    overallStatus,
    integrations,
  };
}
