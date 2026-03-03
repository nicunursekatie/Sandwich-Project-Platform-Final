# 401 Error Fix - Session Validation & Global Error Handling

## Problem

The app was showing 401 (Unauthorized) errors in the console for:
- `/api/event-reminders/count`
- `/api/users/heartbeat`
- `/api/emails/unread-count`

### Root Cause

Queries were firing when the `user` object existed in React state, but before the session was validated or after the session expired. This happened because:

1. **Race condition on mount**: Queries used `enabled: !!user?.id`, which checks if user exists in cache/state but doesn't verify the session is valid
2. **Stale state during expiration**: When sessions expired, the user object remained in React state, so queries continued firing
3. **No global 401 handler**: When authentication failed, there was no centralized handler to clear the user state and redirect to login

## Solution Implemented

### 1. Global Error Handlers (queryClient.ts)

Added global error handlers that detect 401 errors and automatically:
- Clear the authentication state
- Redirect to login page
- Prevent further failed requests

```typescript
// For queries
onError: (error: any) => {
  if (error?.status === 401 || error?.code === 'AUTH_EXPIRED') {
    logger.warn('🔒 [QueryClient] 401 error in query, clearing auth state');
    queryClient.setQueryData(['/api/auth/user'], null);
    if (typeof window !== 'undefined' && !window.location.pathname.includes('/login')) {
      window.location.href = '/login';
    }
  }
}

// For mutations (same logic)
onError: (error: any) => {
  if (error?.status === 401 || error?.code === 'AUTH_EXPIRED') {
    logger.warn('🔒 [QueryClient] 401 error detected, clearing auth state');
    queryClient.setQueryData(['/api/auth/user'], null);
    if (typeof window !== 'undefined' && !window.location.pathname.includes('/login')) {
      window.location.href = '/login';
    }
  }
}
```

### 2. Improved Query Enablement (simple-nav.tsx)

Changed from checking just `!!user?.id` to verifying proper authentication:

**Before:**
```typescript
enabled: !!(user as any)?.id
```

**After:**
```typescript
enabled: isAuthenticated && !!(user as any)?.id
```

This ensures queries only fire when:
- The auth query has completed (`isAuthenticated` is true)
- The user object exists and has an ID
- The session is valid

### 3. Improved Heartbeat Logic (useOnlinePresenceNotifications.ts)

**Before:**
```typescript
const sendHeartbeat = useCallback(async () => {
  if (!currentUser) return;
  // ...
}, [currentUser]);

useEffect(() => {
  if (!currentUser) return;
  // ...
}, [currentUser, sendHeartbeat]);
```

**After:**
```typescript
const sendHeartbeat = useCallback(async () => {
  if (!isAuthenticated || !currentUser?.id) return;
  // ...
}, [currentUser, isAuthenticated]);

useEffect(() => {
  if (!isAuthenticated || !currentUser?.id) return;
  // ...
}, [isAuthenticated, currentUser, sendHeartbeat]);
```

## Files Modified

1. **client/src/lib/queryClient.ts**
   - Added global query error handler (lines 236-243)
   - Added global mutation error handler (lines 261-269)

2. **client/src/components/simple-nav.tsx**
   - Destructured `isAuthenticated` from `useAuth()` (line 34)
   - Updated Gmail unread query enablement (line 58)
   - Updated event reminders query enablement (line 76)
   - Removed redundant user ID checks in queryFn (queries now only run when authenticated)
   - Removed user ID from query keys (no longer needed since enabled handles it)

3. **client/src/hooks/useOnlinePresenceNotifications.ts**
   - Destructured `isAuthenticated` from `useAuth()` (line 47)
   - Updated `sendHeartbeat` to check `isAuthenticated` (line 56)
   - Updated heartbeat interval useEffect (line 70)
   - Updated WebSocket useEffect (line 83)
   - Updated polling query enablement (line 204)

## How It Works

### Normal Flow (Authenticated)
1. User logs in
2. `/api/auth/user` query succeeds, `isAuthenticated` becomes `true`
3. Other queries enabled by `isAuthenticated` start firing
4. All requests succeed with valid session

### Session Expiration Flow
1. User's 30-day session expires
2. Next query to any protected endpoint returns 401
3. Global error handler detects 401
4. Auth state cleared: `queryClient.setQueryData(['/api/auth/user'], null)`
5. User redirected to `/login`
6. All queries disabled (because `isAuthenticated` is now `false`)
7. No more 401 errors logged

### Page Load Flow (Prevents Race Condition)
1. Page loads, `useAuth()` queries `/api/auth/user`
2. While auth query is loading, `isAuthenticated` is `false`
3. Other queries are disabled via `enabled: isAuthenticated && !!user?.id`
4. Once auth query completes, `isAuthenticated` becomes `true`
5. Other queries now enabled and fire with valid session

## Expected Impact

### ✅ Fixes
- **No more 401 console errors** during normal use
- **No race conditions** on page load
- **Automatic logout** when session expires
- **Better UX**: Users redirected to login instead of seeing broken UI

### ⚠️ Trade-offs
- Slight delay before badge counts load (waits for auth to complete)
- Auto-redirect to login on session expiration (can't recover without re-login)

## Testing Checklist

- [ ] Load app fresh - no 401 errors on mount
- [ ] Let session expire (or manually delete session cookie) - auto-redirect to login
- [ ] Multiple tabs - one tab logout doesn't cause 401s in other tabs
- [ ] Network offline/online transitions - no 401 spam
- [ ] Navigate between sections - badge counts load correctly
- [ ] Long-running session (30 days) - clean expiration and redirect

## Monitoring

Watch for:
- Reduction in 401 error logs in production
- No user reports of "broken" badge counts
- Session expiration handling working smoothly
- No infinite redirect loops to /login

## Rollback Plan

If issues arise, revert these 3 files:
1. `client/src/lib/queryClient.ts` (remove onError handlers)
2. `client/src/components/simple-nav.tsx` (revert to `enabled: !!user?.id`)
3. `client/src/hooks/useOnlinePresenceNotifications.ts` (revert to checking just `currentUser`)
