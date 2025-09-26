# SMS Troubleshooting Guide

## Twilio Error 30032: UNDELIVERED Status

Your SMS messages are being created in Twilio but showing as UNDELIVERED with error code 30032. This is a carrier-level delivery issue, particularly common with AT&T and Verizon.

### What Error 30032 Means
- **"Unknown destination handset"** - The carrier cannot deliver the message to the phone number
- The message reached Twilio successfully but failed at the carrier level
- This is NOT a code issue - it's a carrier/registration issue

## Solutions (Try in Order)

### 1. Immediate Fix: Have Recipients Text "START" First
**This is the quickest solution for testing:**
1. From the recipient's phone (your AT&T number), send a text message containing just "START" to your Twilio number: +18449441127
2. Wait for Twilio's auto-response confirming opt-in
3. Try the SMS opt-in flow again in your app
4. The verification code should now be delivered

### 2. Register for A2P 10DLC (Required for Production)
AT&T and Verizon now require business messaging to be registered through A2P 10DLC (Application-to-Person 10-Digit Long Code).

**Steps to Register:**
1. Log into your Twilio Console
2. Navigate to **Messaging > Regulatory Compliance > A2P 10DLC**
3. Register your brand (your organization)
4. Create a campaign describing your use case (sandwich collection reminders)
5. Link your phone number to the campaign
6. Wait for approval (usually 24-48 hours)

**Campaign Type:** Choose "Notifications" or "Non-profit" if applicable

### 3. Alternative: Use Twilio Verified Numbers (For Testing Only)
While in Twilio trial mode or for testing:
1. Go to Twilio Console > Phone Numbers > Verified Caller IDs
2. Add and verify each phone number you want to test with
3. Complete the verification process for each number
4. These numbers will then receive SMS without carrier blocking

### 4. Check if Number Can Receive SMS
Some numbers cannot receive SMS:
- Landline phones
- VoIP numbers without SMS capability
- Some business phone systems

**To verify:** Try sending a regular SMS from another phone to confirm the number can receive texts.

### 5. Use a Toll-Free Number (Alternative Solution)
Toll-free numbers have better deliverability:
1. Purchase a toll-free number from Twilio ($2/month)
2. Toll-free numbers bypass many carrier filters
3. Update your `.env` file with the new number

## What We've Already Implemented

### Improved Phone Number Formatting
- Better E.164 formatting for US numbers
- Handles 10-digit and 11-digit formats
- Proper international prefix handling

### Retry Logic with Exponential Backoff
- Automatically retries failed messages up to 2 times
- Waits 2 seconds, then 4 seconds between retries
- Helps with temporary carrier issues

### Simplified Message Content
- Shortened message to avoid carrier spam filters
- Removed emojis from initial line (can trigger filters)
- Under 160 characters to fit in single SMS segment

### Status Webhook Tracking
- Monitors delivery status of all messages
- Logs specific error codes and explanations
- Updates user records with delivery errors

## Monitoring SMS Delivery

Check your server logs for detailed error information:
```bash
# Look for SMS-related logs
grep "SMS" server.log

# Check for specific error codes
grep "30032" server.log

# Monitor delivery status
grep "SMS delivery" server.log
```

## Common Twilio Error Codes

| Error Code | Meaning | Solution |
|------------|---------|----------|
| 30032 | Unknown destination handset | Recipient texts START first, or register A2P 10DLC |
| 30005 | Number doesn't exist | Verify phone number is correct |
| 30003 | Phone unreachable | Phone is off or out of service |
| 30006 | Landline detected | Cannot send SMS to landlines |
| 30007 | Carrier violation | Message blocked, register A2P 10DLC |
| 30008 | Unknown carrier error | Contact Twilio support |
| 21608 | Unverified number (trial) | Add to verified numbers in Twilio |
| 21211 | Invalid phone format | Check E.164 formatting |
| 21610 | Recipient opted out | Recipient must text START to opt back in |

## Testing Checklist

1. ✅ Twilio credentials in `.env` file
2. ✅ Phone number in E.164 format (+1XXXXXXXXXX)
3. ⚠️ Recipient has texted "START" to Twilio number (for testing)
4. ⚠️ A2P 10DLC registration (for production)
5. ✅ Status webhook configured for monitoring

## Next Steps

For your current issue (error 30032 with AT&T):

1. **Immediate:** Text "START" from your AT&T phone to +18449441127
2. **Then:** Try the SMS opt-in flow again
3. **For Production:** Start the A2P 10DLC registration process in Twilio Console

This should resolve the delivery issue and allow your verification codes to be delivered successfully.