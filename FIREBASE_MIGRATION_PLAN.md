# Firebase Migration Plan - Sandwich Project Platform

## CRITICAL SAFETY PRECAUTIONS

### What This Migration Does NOT Touch
- **Main branch**: All changes are on `claude/migrate-firebase-replit-J7Ta9`
- **Production database**: We keep PostgreSQL, just change where it's hosted
- **Existing data**: Zero data changes, only infrastructure
- **Core business logic**: All routes, services, and features remain identical

### Rollback Strategy
If anything goes wrong:
1. `git checkout main` - Return to working version
2. Keep Replit deployment running until Firebase is fully tested
3. Run both environments in parallel during transition

---

## Migration Overview

### Strategy: Partial Migration (Safest Approach)
We are **keeping PostgreSQL** and only removing Replit-specific dependencies. This means:
- No database schema changes
- No query rewrites
- No data migration needed
- Minimal code changes

### What Changes
| Component | Current (Replit) | Target (Firebase/Cloud) |
|-----------|------------------|------------------------|
| File Storage | Replit Object Storage | Firebase Storage |
| SMS Provider | Replit Twilio Connector | Direct Twilio API |
| Vite Plugins | @replit/vite-plugin-* | Removed |
| Domain Detection | Replit-specific URLs | Generic URL handling |
| Deployment | Replit Autoscale | Cloud Run or Firebase Hosting |
| Database | PostgreSQL (Neon) | PostgreSQL (Neon) - NO CHANGE |

---

## Phase 1: Firebase Project Setup

### Step 1: Create Firebase Project
1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click "Add Project"
3. Name it: `sandwich-project-platform` (or similar)
4. Disable Google Analytics (optional, simplifies setup)
5. Click "Create Project"

### Step 2: Enable Required Services
In the Firebase Console, enable:
- **Storage**: For file uploads (receipts, images)
- **Hosting**: For frontend deployment (optional)

### Step 3: Get Firebase Configuration
1. Go to Project Settings (gear icon)
2. Under "Your apps", click web icon (</>)
3. Register app with name: `sandwich-platform-web`
4. Copy the configuration object:

```javascript
// Firebase configuration - save these values
const firebaseConfig = {
  apiKey: "your-api-key",
  authDomain: "your-project.firebaseapp.com",
  projectId: "your-project-id",
  storageBucket: "your-project.appspot.com",
  messagingSenderId: "123456789",
  appId: "your-app-id"
};
```

### Step 4: Create Service Account for Server
1. Go to Project Settings → Service Accounts
2. Click "Generate new private key"
3. Save the JSON file securely
4. This is your `FIREBASE_SERVICE_ACCOUNT_KEY`

### Step 5: Set Up Firebase Storage Rules
In Firebase Console → Storage → Rules:

```javascript
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    // Public read for certain paths
    match /public/{allPaths=**} {
      allow read: if true;
      allow write: if request.auth != null;
    }

    // Private files require authentication
    match /private/{userId}/{allPaths=**} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }

    // Receipts - authenticated users only
    match /receipts/{allPaths=**} {
      allow read, write: if request.auth != null;
    }
  }
}
```

---

## Phase 2: Environment Variables

### New Environment Variables Required
Add these to your deployment environment:

```bash
# Firebase Configuration (Client-side)
VITE_FIREBASE_API_KEY=your-api-key
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
VITE_FIREBASE_APP_ID=your-app-id

# Firebase Service Account (Server-side) - Base64 encoded JSON
FIREBASE_SERVICE_ACCOUNT_KEY=base64-encoded-service-account-json

# Twilio Direct API (replacing Replit connector)
TWILIO_ACCOUNT_SID=your-account-sid
TWILIO_AUTH_TOKEN=your-auth-token
TWILIO_PHONE_NUMBER=+1234567890

# Keep existing variables
DATABASE_URL=your-neon-database-url
SENDGRID_API_KEY=your-sendgrid-key
# ... all other existing env vars
```

### Variables to Remove (Replit-specific)
These will no longer be needed:
- `REPLIT_DOMAIN`
- `REPLIT_DOMAINS`
- `REPLIT_DEPLOYMENT`
- `REPLIT_ID`
- `REPL_IDENTITY`
- `REPLIT_CONNECTORS_HOSTNAME`
- `WEB_REPL_RENEWAL`
- `PUBLIC_OBJECT_SEARCH_PATHS` (Replit object storage)
- `PRIVATE_OBJECT_DIR` (Replit object storage)

---

## Phase 3: Code Changes

### Files to Modify

#### 1. Remove Replit Vite Plugins
**File:** `vite.config.ts`
- Remove `@replit/vite-plugin-runtime-error-modal`
- Remove `@replit/vite-plugin-cartographer`

#### 2. Replace Object Storage
**File:** `server/objectStorage.ts`
- Replace Replit GCS sidecar with Firebase Admin SDK
- Update all file upload/download functions

#### 3. Replace Twilio Connector
**File:** `server/sms-providers/replit-twilio-connector.ts`
- Replace with direct Twilio SDK using env vars
- Much simpler implementation

#### 4. Simplify WebSocket URL Detection
**File:** `client/src/utils/websocket-helper.ts`
- Remove Replit-specific domain checks
- Use standard URL construction

#### 5. Update Domain References
**Files:**
- `server/routes/password-reset.ts`
- `server/routes/auth/index.ts`
- Use `process.env.APP_URL` instead of Replit domain detection

#### 6. Remove Replit Config Files
**Files to remove/update:**
- `.replit` - Can be deleted or kept for reference
- Update `package.json` - Remove Replit-specific scripts

---

## Phase 4: Deployment Options

### Option A: Google Cloud Run (Recommended)
Best for Express.js apps, scales automatically.

1. Install Google Cloud CLI
2. Build Docker image
3. Deploy to Cloud Run
4. Set environment variables

```bash
# Build and deploy
gcloud run deploy sandwich-platform \
  --source . \
  --region us-central1 \
  --allow-unauthenticated
```

### Option B: Firebase Hosting + Cloud Functions
Good for static frontend + serverless backend.

### Option C: Railway / Render / Fly.io
Simple PaaS options with easy deployment.

---

## Phase 5: Testing Checklist

Before switching from Replit:

- [ ] File uploads work (receipts, images)
- [ ] SMS sending works
- [ ] All authentication flows work
- [ ] Database connections work
- [ ] WebSocket connections work
- [ ] All API routes respond correctly
- [ ] Email sending works
- [ ] AI features work (OpenAI, Anthropic)

---

## Parallel Running Strategy

**Week 1-2: Development**
- Make all changes on migration branch
- Test locally

**Week 3: Staging**
- Deploy to Firebase/Cloud Run staging environment
- Test all features
- Keep Replit running

**Week 4: Transition**
- Update DNS to point to new deployment
- Monitor for issues
- Keep Replit as fallback

**Week 5+: Cleanup**
- Confirm everything works
- Decommission Replit deployment

---

## Emergency Rollback

If anything breaks after deployment:

1. **DNS Rollback**: Point domain back to Replit
2. **Code Rollback**: `git checkout main`
3. **Database**: No changes needed (same PostgreSQL)

Your data is safe because we're not migrating the database.

---

## Questions to Answer Before Proceeding

1. Do you have a Firebase project, or should I help you create one?
2. Do you have direct Twilio API credentials (not from Replit connector)?
3. Where would you like to deploy? (Cloud Run, Railway, Render, etc.)
4. Do you have a custom domain, or using Replit's domain?
