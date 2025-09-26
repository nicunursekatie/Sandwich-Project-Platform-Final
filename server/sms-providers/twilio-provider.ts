/**
 * Twilio SMS Provider
 * Wraps Twilio SDK for the common SMS provider interface
 */

import Twilio from 'twilio';
import { SMSProvider, SMSMessage, SMSResult } from './types';

export class TwilioProvider implements SMSProvider {
  name = 'twilio';
  
  private client: ReturnType<typeof Twilio> | null = null;
  private phoneNumber: string;

  constructor(accountSid: string, authToken: string, phoneNumber: string) {
    this.phoneNumber = phoneNumber;
    
    if (accountSid && authToken) {
      this.client = Twilio(accountSid, authToken);
    }
  }

  isConfigured(): boolean {
    return !!this.client && !!this.phoneNumber;
  }

  validateConfig(): { isValid: boolean; missingItems: string[] } {
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

  async sendSMS(message: SMSMessage): Promise<SMSResult> {
    if (!this.client) {
      return {
        success: false,
        message: 'Twilio SMS service not configured - missing credentials',
        error: 'MISSING_CONFIG'
      };
    }

    if (!this.phoneNumber) {
      return {
        success: false,
        message: 'Twilio SMS service not configured - missing phone number',
        error: 'MISSING_PHONE'
      };
    }

    try {
      const result = await this.client.messages.create({
        body: message.body,
        from: this.phoneNumber,
        to: message.to,
      });

      console.log(`✅ SMS sent via Twilio to ${message.to} (${result.sid})`);

      return {
        success: true,
        message: `SMS sent successfully via Twilio to ${message.to}`,
        messageId: result.sid,
        sentTo: message.to
      };
    } catch (error) {
      console.error('Twilio SMS error:', error);
      return {
        success: false,
        message: `Twilio error: ${(error as Error).message}`,
        error: (error as Error).message
      };
    }
  }
}