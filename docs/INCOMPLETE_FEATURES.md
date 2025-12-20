# Incomplete Features Documentation

This document catalogs all incomplete features and TODO items in the codebase, organized by priority and module.

**Notification Infrastructure:** This app uses **SendGrid** (email) and **Twilio** (SMS) for notifications. There is no Firebase/FCM integration.

---

## 🟠 Dead Code / Should Be Removed

### 1. Push Notification Service (Dead Code)
**Location:** `server/services/push-notification-service.ts`

This entire service references Firebase Cloud Messaging (FCM) but **the app doesn't use Firebase**. The service is completely non-functional and returns `NOT_IMPLEMENTED` for all calls.

**Recommendation:** Remove this file entirely or refactor to use Web Push API if browser push notifications are desired in the future.

| Line | Dead Code |
|------|-----------|
| 96 | FCM push notification stub |
| 184 | FCM multicast stub |
| 267-367 | Device token stubs |

---

### 2. Smart Notification Push Channel (Dead Code)
**Location:** `server/services/notifications/smart-delivery.ts:529-539`

References the non-functional push notification service above.

**Recommendation:** Remove push channel from smart delivery or implement Web Push API.

---

## 🟠 Medium Priority (Actual Incomplete Features)

### 3. Database Environment Configuration
**Location:** `server/db.ts:10`

```
TODO: Switch back to DEV_DATABASE_URL once dev database has schema pushed
```

**Current State:** Development environment uses production database URL as a workaround.

**Impact:** Risk of accidental production data modification during development.

**To Fix:** Push schema to dev database and update environment variable logic.

---

### 4. Project Files Endpoint
**Location:** `server/routes/projects/index.ts:477`

```typescript
// TODO: Implement actual file retrieval from storage
// For now, return empty array as the original route does
res.json([]);
```

**Current State:** `GET /api/projects/:id/files` always returns empty array.

**Impact:** Project file attachments feature is non-functional.

---

### 5. Intake Call Data Persistence
**Location:** `client/src/components/event-requests/IntakeCallDialog.tsx:147`

```typescript
// TODO: Save itemAnswers, contact info, and callNotes to event request notes or contact log
```

**Current State:** Intake call checklist answers, contact info, and notes are logged to console but not persisted.

**Impact:** Call data is lost after dialog closes.

---

### 6. Smart Search Actions
**Location:** `client/src/components/SmartSearch.tsx:179`

```typescript
// TODO: If result has an action, trigger it (e.g., open a modal)
if (result.feature.action) {
  console.log('Action to trigger:', result.feature.action);
}
```

**Current State:** Search results with actions just log to console instead of executing.

**Impact:** Action-based search results (like "open create dialog") don't work.

---

### 7. A/B Testing for Notifications
**Location:** `server/routes/notifications/smart.ts:239`

```typescript
abTestVariant: null, // TODO: Implement A/B testing assignment
```

**Current State:** All notifications use default variant, no A/B testing.

---

### 8. Search Analytics Tracking
**Location:** `server/services/search/index.ts:428`

```typescript
// TODO: Implement search analytics tracking
```

**Current State:** Search queries are not tracked for analytics.

---

### 9. Meeting Route Data Joins
**Location:** `server/routes/meetings.ts:589`

```typescript
// TODO: Add joined data (projectTitle, meetingTitle) if needed by frontend
```

**Current State:** Some meeting endpoints may return incomplete data.

---

## 🟡 Low Priority (Memory Storage Stubs)

### 10. In-Memory Storage Conversation Methods
**Location:** `server/storage.ts:2564-2595`

These methods are stubs for the in-memory storage fallback (used when database is unavailable):

| Line | Method | Returns |
|------|--------|---------|
| 2565 | `createConversation()` | `null` |
| 2570 | `getConversationMessages()` | `[]` |
| 2575 | `addConversationMessage()` | `null` |
| 2584 | `updateConversationMessage()` | `null` |
| 2589 | `deleteConversationMessage()` | `false` |
| 2594 | `getConversationParticipants()` | `[]` |

**Impact:** Low - these are only used as fallback when database storage fails. Database implementation exists in `database-storage.ts`.

---

### 11. Storage Interface Types
**Location:** `server/index.ts:471`

```typescript
startBackgroundSync(storage as any); // TODO: Fix storage interface types
```

**Impact:** Type safety issue, not a functional problem.

---

## Summary Statistics

| Priority | Count | Notes |
|----------|-------|-------|
| 🟠 Dead Code | 2 | Push notification stubs (Firebase references - not used) |
| 🟠 Medium | 7 | Actual incomplete features |
| 🟡 Low | 2 | Memory storage stubs, type issues |
| **Total** | **11 items** | |

---

## Recommended Action Order

1. **Remove dead push notification code** - Reduces confusion, removes Firebase references
2. **Intake Call Persistence** - Data loss issue
3. **Project Files Endpoint** - Feature non-functional
4. **Database Environment** - Development safety
5. **Smart Search Actions** - UX improvement
6. Others as time permits

---

*Last updated: December 2024*
*Generated from TODO/FIXME analysis*
