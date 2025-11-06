# Smart Notification Delivery System

This directory contains the smart notification delivery system that handles multi-channel notification delivery with ML-powered relevance scoring, optimal timing, and A/B testing.

## Overview

The notification system now includes **actual integrations** for:

- **Email**: SendGrid integration ✅ Implemented
- **SMS**: Twilio integration ✅ Implemented
- **Push Notifications**: Framework ready, needs FCM/APNS setup ⚠️ Partial
- **In-App**: WebSocket delivery ✅ Implemented

## Configuration

### 1. Email Notifications (SendGrid)

**Status**: Fully Implemented

**Setup Steps**:

1. Sign up for a SendGrid account at https://sendgrid.com
2. Create an API key in your SendGrid dashboard
3. Add to your `.env` file:
   ```bash
   SENDGRID_API_KEY=your_sendgrid_api_key_here
   NOTIFICATION_FROM_EMAIL=noreply@thesandwichproject.org
   ```

**Features**:
- Professional HTML email templates
- Personalized greetings
- Priority-based styling
- Action buttons with URLs
- Automatic fallback to plain text

**Testing**:
```typescript
import { smartDeliveryService } from './services/notifications/smart-delivery';

await smartDeliveryService.sendNotification(
  'user-id',
  'Test Email',
  'This is a test email notification',
  'system_update',
  { forceChannel: 'email' }
);
```

### 2. SMS Notifications (Twilio)

**Status**: Fully Implemented

**Setup Steps**:

1. Sign up for a Twilio account at https://www.twilio.com
2. Get your Account SID and Auth Token
3. Purchase or configure a Twilio phone number
4. Add to your `.env` file:
   ```bash
   SMS_PROVIDER=twilio
   TWILIO_ACCOUNT_SID=your_twilio_account_sid_here
   TWILIO_AUTH_TOKEN=your_twilio_auth_token_here
   TWILIO_PHONE_NUMBER=+1234567890
   ```

**Features**:
- Automatic phone number formatting (E.164)
- 160-character message optimization
- Multiple SMS provider support (Twilio, Phone Gateway)
- Comprehensive error handling and logging
- User phone number validation

**Testing**:
```typescript
import { smartDeliveryService } from './services/notifications/smart-delivery';

await smartDeliveryService.sendNotification(
  'user-id',
  'Test SMS',
  'This is a test SMS notification',
  'reminder',
  { forceChannel: 'sms' }
);
```

### 3. Push Notifications (FCM/APNS)

**Status**: Framework Implemented, Needs Configuration

**Setup Steps for Firebase Cloud Messaging (FCM)**:

1. Create a Firebase project at https://console.firebase.google.com
2. Download your service account JSON file
3. Install Firebase Admin SDK:
   ```bash
   npm install firebase-admin
   ```
4. Add to your `.env` file:
   ```bash
   FCM_SERVER_KEY=your_fcm_server_key_here
   FCM_PROJECT_ID=your_fcm_project_id_here
   FCM_SERVICE_ACCOUNT_PATH=/path/to/service-account.json
   ```
5. Uncomment the FCM implementation in `/server/services/push-notification-service.ts`
6. Add device token storage to your database schema

**Setup Steps for Apple Push Notification Service (APNS)**:

1. Generate an APNs auth key in Apple Developer Console
2. Add to your `.env` file:
   ```bash
   APNS_KEY_ID=your_apns_key_id_here
   APNS_TEAM_ID=your_apns_team_id_here
   APNS_KEY_PATH=/path/to/apns-key.p8
   ```

**What's Included**:
- Complete service interface (`push-notification-service.ts`)
- Configuration checking
- Multi-token sending support
- Example FCM implementation (commented out)
- Device token management functions
- Comprehensive error handling

**What's Needed**:
- Install `firebase-admin` package
- Uncomment FCM implementation code
- Add device token storage schema to database
- Implement device token registration endpoints

**Testing** (once configured):
```typescript
import { sendPushToUser } from './services/push-notification-service';

await sendPushToUser('user-id', {
  title: 'Test Push',
  body: 'This is a test push notification',
  priority: 'high'
});
```

### 4. In-App Notifications (WebSocket)

**Status**: Fully Implemented

**How it works**:
- Uses Socket.IO for real-time delivery
- Automatically sends to connected users
- No additional configuration needed

## Usage

### Basic Notification Sending

```typescript
import { smartDeliveryService } from './services/notifications/smart-delivery';

// Send with smart channel selection (ML-powered)
const result = await smartDeliveryService.sendNotification(
  userId,
  'Notification Title',
  'Notification message body',
  'notification_type'
);

// Force specific channel
await smartDeliveryService.sendNotification(
  userId,
  'Email Notification',
  'This will be sent via email',
  'system_update',
  { forceChannel: 'email' }
);

// Set priority
await smartDeliveryService.sendNotification(
  userId,
  'Urgent Alert',
  'This is urgent',
  'alert',
  { priority: 'urgent' }
);
```

### Broadcast Notifications

```typescript
// Send to multiple users with smart delivery
const results = await smartDeliveryService.broadcastNotification(
  ['user-id-1', 'user-id-2', 'user-id-3'],
  'Team Update',
  'Important team announcement',
  'announcement'
);
```

### Track User Interactions

```typescript
// Track when users interact with notifications
await smartDeliveryService.trackInteraction(
  notificationId,
  userId,
  'clicked',
  { clickedAt: new Date() }
);
```

## Architecture

### File Structure

```
server/services/notifications/
├── README.md                    # This file
├── smart-delivery.ts           # Main delivery service ✅ INTEGRATED
├── ml-engine.ts                # ML scoring engine
├── ab-testing.ts               # A/B testing functionality
└── notification-triggers.ts    # Event-based triggers

server/services/
├── sendgrid.ts                 # SendGrid email service ✅ INTEGRATED
├── push-notification-service.ts # Push notification framework ⚠️ PARTIAL

server/sms-providers/
├── provider-factory.ts         # SMS provider factory ✅ INTEGRATED
├── twilio-provider.ts          # Twilio implementation ✅ INTEGRATED
└── phone-gateway-provider.ts   # Alternative SMS provider
```

### Integration Points

The smart delivery service (`smart-delivery.ts`) now includes:

1. **Email Integration** (line 304-395)
   - Direct SendGrid integration
   - HTML email templates
   - Configuration checking
   - Error handling

2. **SMS Integration** (line 400-478)
   - SMS provider factory integration
   - Phone number formatting
   - Message optimization (160 chars)
   - Multi-provider support

3. **Push Integration** (line 494-560)
   - Configuration checking for FCM/APNS
   - Framework for token management
   - Extensible implementation
   - Comprehensive documentation

## Notification Channels

### Channel Selection Logic

The system uses ML-powered scoring to select the optimal channel:

1. **In-App** (WebSocket): Default for immediate, less critical updates
2. **Email**: Best for detailed information, non-urgent updates
3. **SMS**: High engagement, use for urgent/time-sensitive
4. **Push**: Mobile users, real-time alerts

You can override with `forceChannel` option or let the ML engine decide.

## Error Handling

All delivery methods include:
- Configuration validation
- Graceful degradation
- Detailed error logging
- Status tracking in database
- Retry logic (where appropriate)

## Monitoring

The system logs all notification delivery attempts with:
- Delivery status (delivered, failed, pending)
- Channel used
- ML scores and recommendations
- Error messages
- Performance metrics

Check logs with:
```bash
# Filter notification logs
grep "smart-delivery" logs/combined.log
```

## Next Steps

To complete the notification system:

1. **For Email** (Ready to use):
   - Add `SENDGRID_API_KEY` to your `.env` file
   - Test with `forceChannel: 'email'`

2. **For SMS** (Ready to use):
   - Add Twilio credentials to `.env` file
   - Ensure users have phone numbers in database
   - Test with `forceChannel: 'sms'`

3. **For Push Notifications**:
   - Install `firebase-admin`: `npm install firebase-admin`
   - Set up Firebase project and download service account
   - Add FCM credentials to `.env` file
   - Uncomment implementation in `push-notification-service.ts`
   - Add device token storage to database schema
   - Create endpoints for device token registration
   - Test with mobile apps

## Database Schema

The system uses these tables:
- `notifications`: Stores notification records
- `notificationHistory`: Tracks delivery attempts and interactions
- `notificationABTests`: Manages A/B test configurations
- `users`: User information including email and phoneNumber

For push notifications, you'll need to add:
```typescript
// Add to shared/schema.ts
export const userDeviceTokens = pgTable('user_device_tokens', {
  id: serial('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id),
  token: text('token').notNull(),
  platform: text('platform').notNull(), // 'ios' | 'android' | 'web'
  createdAt: timestamp('created_at').defaultNow(),
  lastUsed: timestamp('last_used').defaultNow()
});
```

## Support

For issues or questions:
- Check logs in `logs/` directory
- Review error messages in notification history
- Verify environment variables are set correctly
- Check service configuration status

## Status Summary

| Feature | Status | Configuration Required |
|---------|--------|----------------------|
| Email (SendGrid) | ✅ Fully Implemented | `SENDGRID_API_KEY` |
| SMS (Twilio) | ✅ Fully Implemented | Twilio credentials |
| Push (FCM/APNS) | ⚠️ Framework Ready | FCM/APNS setup needed |
| In-App (WebSocket) | ✅ Fully Implemented | None (automatic) |
| ML Scoring | ✅ Implemented | None |
| A/B Testing | ✅ Implemented | None |

The notification delivery system is now **production-ready** for Email, SMS, and In-App channels. Push notifications have a complete framework and just need the FCM/APNS configuration to be activated.
