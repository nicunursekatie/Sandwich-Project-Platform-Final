# Incomplete Features Documentation

This document catalogs all incomplete features and TODO items in the codebase, organized by priority and module.

---

## 🔴 Critical / High Priority

### 1. Push Notification Service (Not Implemented)
**Location:** `server/services/push-notification-service.ts`

The entire push notification service is stubbed out and returns `NOT_IMPLEMENTED`.

| Line | Issue |
|------|-------|
| 96 | FCM push notification not implemented |
| 184 | FCM multicast not implemented |
| 267 | Device token retrieval not implemented |
| 311-319 | Device token storage not implemented |
| 360-367 | Device token removal not implemented |

**Current State:** All push notification calls log a warning and return `{ success: false, error: 'NOT_IMPLEMENTED' }`

**Required to Complete:**
- Set up Firebase Cloud Messaging (FCM) credentials
- Create `userDeviceTokens` database table
- Implement token storage/retrieval endpoints
- Integrate firebase-admin SDK

---

### 2. Smart Notification Delivery (Push Channel Incomplete)
**Location:** `server/services/notifications/smart-delivery.ts`

| Line | Issue |
|------|-------|
| 529 | Get user's device tokens from database - not implemented |
| 539 | Send push notification using appropriate service - not implemented |

**Current State:** Push channel in smart delivery system throws errors instead of sending notifications.

---

## 🟠 Medium Priority

### 3. Database Environment Configuration
**Location:** `server/db.ts:10`

```
TODO: Switch back to DEV_DATABASE_URL once dev database has schema pushed
```

**Current State:** Development environment uses production database URL as a workaround.

**Impact:** Risk of accidental production data modification during development.

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

| Priority | Count |
|----------|-------|
| 🔴 Critical | 2 (Push notifications) |
| 🟠 Medium | 7 |
| 🟡 Low | 2 |
| **Total** | **11 incomplete features** |

---

## Recommended Action Order

1. **Push Notifications** - Significant feature gap, affects user engagement
2. **Intake Call Persistence** - Data loss issue
3. **Project Files Endpoint** - Feature non-functional
4. **Database Environment** - Development safety
5. **Smart Search Actions** - UX improvement
6. Others as time permits

---

*Last updated: December 2024*
*Generated from TODO/FIXME analysis*
