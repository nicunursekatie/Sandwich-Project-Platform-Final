/**
 * Replit Twilio Connector
 * Fetches Twilio credentials from Replit's managed connection API
 * This works in both development and production deployments
 */

import twilio from 'twilio';
import { logger } from '../utils/production-safe-logger';

interface TwilioCredentials {
  accountSid: string;
  apiKey: string;
  apiKeySecret: string;
  phoneNumber: string;
}

let cachedCredentials: TwilioCredentials | null = null;
let cachedClient: ReturnType<typeof twilio> | null = null;

/**
 * Get Twilio credentials from Replit's managed connection
 * Uses REPL_IDENTITY in development and WEB_REPL_RENEWAL in production
 */
async function getCredentials(): Promise<TwilioCredentials> {
  // Return cached credentials if available
  if (cachedCredentials) {
    return cachedCredentials;
  }

  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  
  // Determine the authentication token based on environment
  const xReplitToken = process.env.REPL_IDENTITY 
    ? 'repl ' + process.env.REPL_IDENTITY 
    : process.env.WEB_REPL_RENEWAL 
    ? 'depl ' + process.env.WEB_REPL_RENEWAL 
    : null;

  if (!xReplitToken) {
    throw new Error('Replit authentication token not found (REPL_IDENTITY or WEB_REPL_RENEWAL)');
  }

  if (!hostname) {
    throw new Error('REPLIT_CONNECTORS_HOSTNAME not found');
  }

  try {
    const response = await fetch(
      `https://${hostname}/api/v2/connection?include_secrets=true&connector_names=twilio`,
      {
        headers: {
          'Accept': 'application/json',
          'X_REPLIT_TOKEN': xReplitToken
        }
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch Twilio credentials: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    const connectionSettings = data.items?.[0];

    if (!connectionSettings || 
        !connectionSettings.settings.account_sid || 
        !connectionSettings.settings.api_key || 
        !connectionSettings.settings.api_key_secret) {
      throw new Error('Twilio not connected or missing required settings');
    }

    cachedCredentials = {
      accountSid: connectionSettings.settings.account_sid,
      apiKey: connectionSettings.settings.api_key,
      apiKeySecret: connectionSettings.settings.api_key_secret,
      phoneNumber: connectionSettings.settings.phone_number || ''
    };

    // Debug: Log credential info (not the secrets themselves)
    logger.log('✅ Twilio credentials loaded from Replit connection');
    logger.log(`📱 Twilio Account SID prefix: ${cachedCredentials.accountSid?.substring(0, 8)}...`);
    logger.log(`📱 Twilio API Key prefix: ${cachedCredentials.apiKey?.substring(0, 8)}...`);
    logger.log(`📱 Twilio API Key Secret length: ${cachedCredentials.apiKeySecret?.length || 0}`);
    logger.log(`📱 Twilio Phone Number: ${cachedCredentials.phoneNumber}`);
    
    return cachedCredentials;
  } catch (error) {
    logger.error('Failed to load Twilio credentials from Replit connection:', error);
    throw error;
  }
}

/**
 * Get a configured Twilio client using Replit's managed connection
 * Uses API Key authentication (more secure than auth token)
 */
export async function getTwilioClient(): Promise<ReturnType<typeof twilio>> {
  // Return cached client if available
  if (cachedClient) {
    return cachedClient;
  }

  const { accountSid, apiKey, apiKeySecret } = await getCredentials();
  
  cachedClient = twilio(apiKey, apiKeySecret, {
    accountSid: accountSid
  });

  return cachedClient;
}

/**
 * Get the Twilio phone number from Replit's managed connection
 */
export async function getTwilioFromPhoneNumber(): Promise<string> {
  const { phoneNumber } = await getCredentials();
  return phoneNumber;
}

/**
 * Check if Twilio connection is available
 */
export async function isTwilioConnected(): Promise<boolean> {
  try {
    await getCredentials();
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Clear cached credentials (for testing or reconnection)
 */
export function clearTwilioCache(): void {
  logger.log('🔄 Clearing Twilio cache...');
  cachedCredentials = null;
  cachedClient = null;
}

/**
 * Force reload credentials (bypasses cache)
 */
export async function reloadCredentials(): Promise<TwilioCredentials> {
  clearTwilioCache();
  return getCredentials();
}
