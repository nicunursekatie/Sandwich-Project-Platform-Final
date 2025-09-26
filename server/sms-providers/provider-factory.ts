/**
 * SMS Provider Factory
 * Creates and manages SMS providers based on configuration
 */

import { SMSProvider, SMSProviderConfig } from './types';
import { TwilioProvider } from './twilio-provider';
import { PhoneGatewayProvider } from './phone-gateway-provider';

export class SMSProviderFactory {
  private static instance: SMSProviderFactory;
  private currentProvider: SMSProvider | null = null;

  private constructor() {}

  static getInstance(): SMSProviderFactory {
    if (!SMSProviderFactory.instance) {
      SMSProviderFactory.instance = new SMSProviderFactory();
    }
    return SMSProviderFactory.instance;
  }

  /**
   * Get SMS provider based on environment configuration
   * Always revalidates configuration to support environment variable changes
   */
  getProvider(): SMSProvider {
    // Always reload config to support environment variable changes
    const config = this.loadConfigFromEnv();
    return this.createProvider(config);
  }

  /**
   * Create provider from explicit config (for testing)
   */
  createProvider(config: SMSProviderConfig): SMSProvider {
    switch (config.provider) {
      case 'phone_gateway':
        // Allow PhoneGatewayProvider creation with missing config for graceful fallback
        return new PhoneGatewayProvider(
          config.phoneGateway?.gatewayUrl || '',
          config.phoneGateway?.apiKey,
          config.phoneGateway?.deviceNumber,
          config.phoneGateway?.timeout
        );

      case 'twilio':
        // Allow TwilioProvider creation with missing credentials for graceful fallback
        // The provider will handle missing credentials gracefully in its methods
        return new TwilioProvider(
          config.twilio?.accountSid || '',
          config.twilio?.authToken || '',
          config.twilio?.phoneNumber || ''
        );

      default:
        throw new Error(`Unsupported SMS provider: ${config.provider}`);
    }
  }

  /**
   * Load configuration from environment variables
   */
  private loadConfigFromEnv(): SMSProviderConfig {
    // Determine which provider to use based on environment
    const provider = (process.env.SMS_PROVIDER as 'twilio' | 'phone_gateway') || 'twilio';

    const config: SMSProviderConfig = {
      provider
    };

    if (provider === 'phone_gateway') {
      config.phoneGateway = {
        gatewayUrl: process.env.PHONE_GATEWAY_URL || '',
        apiKey: process.env.PHONE_GATEWAY_API_KEY,
        deviceNumber: process.env.PHONE_GATEWAY_DEVICE_NUMBER,
        timeout: parseInt(process.env.PHONE_GATEWAY_TIMEOUT || '30000', 10)
      };
    } else if (provider === 'twilio') {
      config.twilio = {
        accountSid: process.env.TWILIO_ACCOUNT_SID || '',
        authToken: process.env.TWILIO_AUTH_TOKEN || '',
        phoneNumber: process.env.TWILIO_PHONE_NUMBER || ''
      };
    }

    return config;
  }

  /**
   * Get available providers and their configuration status
   */
  getProvidersStatus(): { [key: string]: { configured: boolean; missingItems: string[] } } {
    const providers = ['twilio', 'phone_gateway'];
    const status: { [key: string]: { configured: boolean; missingItems: string[] } } = {};

    for (const providerName of providers) {
      try {
        const config: SMSProviderConfig = {
          provider: providerName as 'twilio' | 'phone_gateway'
        };

        if (providerName === 'twilio') {
          config.twilio = {
            accountSid: process.env.TWILIO_ACCOUNT_SID || '',
            authToken: process.env.TWILIO_AUTH_TOKEN || '',
            phoneNumber: process.env.TWILIO_PHONE_NUMBER || ''
          };
        } else if (providerName === 'phone_gateway') {
          config.phoneGateway = {
            gatewayUrl: process.env.PHONE_GATEWAY_URL || ''
          };
        }

        const provider = this.createProvider(config);
        const validation = provider.validateConfig();

        status[providerName] = {
          configured: validation.isValid,
          missingItems: validation.missingItems
        };
      } catch (error) {
        status[providerName] = {
          configured: false,
          missingItems: ['CONFIGURATION_ERROR']
        };
      }
    }

    return status;
  }

  /**
   * Reset provider (for testing or config changes)
   */
  reset(): void {
    this.currentProvider = null;
  }
}