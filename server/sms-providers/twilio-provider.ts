/**
 * Twilio SMS Provider
 * Wraps Twilio SDK for the common SMS provider interface
 * Supports both manual credentials and Replit's managed Twilio connection
 */

import Twilio from 'twilio';
import { SMSProvider, SMSMessage, SMSResult } from './types';
import { getTwilioClient, getTwilioFromPhoneNumber, isTwilioConnected } from './replit-twilio-connector';
import { logger } from '../utils/production-safe-logger';

export class TwilioProvider implements SMSProvider {
  name = 'twilio';
  
  private client: ReturnType<typeof Twilio> | null = null;
  private phoneNumber: string;
  private useReplitIntegration: boolean;
  private clientPromise: Promise<ReturnType<typeof Twilio>> | null = null;
  private phoneNumberPromise: Promise<string> | null = null;

  constructor(accountSid: string, authToken: string, phoneNumber: string, useReplitIntegration = false) {
    this.phoneNumber = phoneNumber;
    this.useReplitIntegration = useReplitIntegration;
    
    // If using manual credentials
    if (!useReplitIntegration && accountSid && authToken) {
      this.client = Twilio(accountSid, authToken);
    }
  }

  /**
   * Get Twilio client (lazy-loads from Replit integration if enabled)
   */
  private async getClient(): Promise<ReturnType<typeof Twilio> | null> {
    if (this.useReplitIntegration) {
      // Lazy-load client from Replit integration
      if (!this.clientPromise) {
        this.clientPromise = getTwilioClient().catch(error => {
          logger.error('Failed to get Twilio client from Replit integration:', error);
          throw error;
        });
      }
      return this.clientPromise;
    }
    return this.client;
  }

  /**
   * Get phone number (lazy-loads from Replit integration if enabled)
   */
  private async getPhoneNumber(): Promise<string> {
    if (this.useReplitIntegration) {
      // Lazy-load phone number from Replit integration
      if (!this.phoneNumberPromise) {
        this.phoneNumberPromise = getTwilioFromPhoneNumber().catch(error => {
          logger.error('Failed to get Twilio phone number from Replit integration:', error);
          return '';
        });
      }
      return this.phoneNumberPromise;
    }
    return this.phoneNumber;
  }

  isConfigured(): boolean {
    if (this.useReplitIntegration) {
      // For Replit integration, we'll check lazily
      return true;
    }
    return !!this.client && !!this.phoneNumber;
  }

  validateConfig(): { isValid: boolean; missingItems: string[] } {
    if (this.useReplitIntegration) {
      // Replit integration handles validation dynamically
      return {
        isValid: true,
        missingItems: []
      };
    }

    const missingItems: string[] = [];
    
    if (!process.env.TWILIO_ACCOUNT_SID) missingItems.push('TWILIO_ACCOUNT_SID');
    if (!process.env.TWILIO_AUTH_TOKEN) missingItems.push('TWILIO_AUTH_TOKEN');
    if (!process.env.TWILIO_PHONE_NUMBER) missingItems.push('TWILIO_PHONE_NUMBER');

    return {
      isValid: missingItems.length === 0,
      missingItems
    };
  }

  supportsVerification(): boolean {
    return true; // Twilio supports all SMS functionality
  }

  getFromNumber(): string | null {
    return this.phoneNumber || null;
  }

  /**
   * Get the Twilio phone number SID for the configured phone number
   */
  async getPhoneNumberSid(): Promise<string | null> {
    if (!this.client || !this.phoneNumber) {
      return null;
    }

    try {
      // Search for the phone number to get its SID
      const phoneNumbers = await this.client.incomingPhoneNumbers.list({
        phoneNumber: this.phoneNumber,
        limit: 1
      });

      if (phoneNumbers.length > 0) {
        return phoneNumbers[0].sid;
      }

      return null;
    } catch (error) {
      console.error('Error fetching phone number SID:', error);
      return null;
    }
  }

  /**
   * Get the underlying Twilio client (for advanced operations)
   */
  getClient(): ReturnType<typeof Twilio> | null {
    return this.client;
  }

  async sendSMS(message: SMSMessage): Promise<SMSResult> {
    try {
      // Get client and phone number (supports both integration and manual config)
      const client = await this.getClient();
      const phoneNumber = await this.getPhoneNumber();

      if (!client) {
        return {
          success: false,
          message: 'Twilio SMS service not configured - missing credentials',
          error: 'MISSING_CONFIG'
        };
      }

      if (!phoneNumber) {
        return {
          success: false,
          message: 'Twilio SMS service not configured - missing phone number',
          error: 'MISSING_PHONE'
        };
      }

      const result = await client.messages.create({
        body: message.body,
        from: phoneNumber,
        to: message.to,
      });

      logger.log(`✅ SMS sent via Twilio ${this.useReplitIntegration ? '(Replit integration)' : ''} to ${message.to} (${result.sid})`);

      return {
        success: true,
        message: `SMS sent successfully via Twilio to ${message.to}`,
        messageId: result.sid,
        sentTo: message.to
      };
    } catch (error) {
      logger.error('Twilio SMS error:', error);
      return {
        success: false,
        message: `Twilio error: ${(error as Error).message}`,
        error: (error as Error).message
      };
    }
  }
}