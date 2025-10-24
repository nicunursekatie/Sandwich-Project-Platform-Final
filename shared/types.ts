/**
 * Shared Type Definitions
 *
 * Centralized type definitions to eliminate TypeScript `any` types
 * and provide type safety across the application.
 */

import type { User as DrizzleUser } from './schema';

/**
 * SMS Consent structure stored in user metadata
 */
export interface SmsConsent {
  enabled: boolean;
  phoneNumber: string;
  consentedAt?: string;
  unsubscribedAt?: string | null;
}

/**
 * User Metadata structure
 * Defines all properties that can be stored in the users.metadata JSONB field
 */
export interface UserMetadata {
  // Legacy password storage (deprecated - passwords now in users.password column)
  password?: string;

  // SMS consent and phone number
  smsConsent?: SmsConsent;

  // Additional contact information
  phoneNumber?: string;
  address?: string;

  // Availability and preferences
  availability?: {
    [day: string]: string[]; // e.g., { "Monday": ["9AM-12PM", "2PM-5PM"] }
  };

  // Skills and interests
  skills?: string[];
  interests?: string[];

  // Emergency contact
  emergencyContact?: {
    name: string;
    phone: string;
    relationship: string;
  };

  // Onboarding status
  onboarding?: {
    completed: boolean;
    completedAt?: string;
    steps?: {
      [stepName: string]: boolean;
    };
  };

  // Notification preferences
  notificationPreferences?: {
    email?: boolean;
    sms?: boolean;
    push?: boolean;
    channels?: string[];
  };

  // Additional flexible metadata
  [key: string]: unknown;
}

/**
 * Full User type with properly typed metadata
 * Extends the Drizzle-inferred User type
 */
export interface User extends Omit<DrizzleUser, 'metadata' | 'permissions'> {
  metadata: UserMetadata | null;
  permissions: string[] | null;
}

/**
 * Minimal user interface for permission checking
 * Used in auth-utils and permission checking functions
 *
 * IMPORTANT - Permission Format Security:
 * - string[] (modern format, REQUIRED for unified-auth-utils.ts)
 * - number (legacy bitmask format, UNSAFE - only for TypeScript compatibility)
 * - null/undefined (no permissions assigned)
 *
 * SECURITY WARNING:
 * - unified-auth-utils.ts REJECTS numeric permissions (secure)
 * - auth-utils.ts accepts numeric permissions but unsafely grants all access (insecure)
 * - Numeric format is included in type only to prevent TypeScript errors
 * - All users with numeric permissions MUST be migrated to string[] format
 */
export interface UserForPermissions {
  id: string;
  email?: string | null;
  role: string;
  permissions: string[] | number | null | undefined;
  isActive?: boolean | null;
}

/**
 * Session user data structure
 * Stored in express-session and used for authentication
 */
export interface SessionUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  displayName?: string;
  profileImageUrl: string | null;
  role: string;
  permissions: string[];
  isActive: boolean;
}

/**
 * Type guard to check if user has properly typed metadata
 */
export function hasTypedMetadata(user: DrizzleUser | User): user is User {
  return user.metadata !== null && typeof user.metadata === 'object';
}

/**
 * Helper to safely access user metadata
 */
export function getUserMetadata(user: DrizzleUser | User | null | undefined): UserMetadata {
  if (!user || !user.metadata) {
    return {};
  }

  if (typeof user.metadata !== 'object') {
    return {};
  }

  return user.metadata as UserMetadata;
}

/**
 * Helper to get SMS consent from user metadata
 */
export function getSmsConsent(user: DrizzleUser | User | null | undefined): SmsConsent | null {
  const metadata = getUserMetadata(user);
  return metadata.smsConsent || null;
}

/**
 * Helper to get user phone number (from metadata or direct field)
 */
export function getUserPhoneNumber(user: DrizzleUser | User | null | undefined): string | null {
  if (!user) return null;

  // Check direct phone number field first
  if (user.phoneNumber) {
    return user.phoneNumber;
  }

  // Check SMS consent in metadata
  const smsConsent = getSmsConsent(user);
  if (smsConsent?.phoneNumber) {
    return smsConsent.phoneNumber;
  }

  // Check metadata phone number
  const metadata = getUserMetadata(user);
  if (metadata.phoneNumber) {
    return metadata.phoneNumber;
  }

  return null;
}
