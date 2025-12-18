# Performance Analysis Report

## Executive Summary

This report identifies performance anti-patterns, N+1 queries, unnecessary re-renders, and inefficient algorithms found in the Sandwich Project Platform codebase.

---

## 1. N+1 Query Anti-Patterns (HIGH PRIORITY)

### 1.1 Conversation Enrichment - `database-storage.ts:2952-2980`

**Problem**: Each conversation triggers 2 additional database queries inside a `Promise.all(...map)` loop.

```typescript
const enrichedConversations = await Promise.all(
  userConversations.map(async (conv) => {
    // Query 1: Get member count
    const memberCount = await db.select({ count: sql`count(*)` })...
    // Query 2: Get last message
    const lastMessage = await db.select()...
    return { ...conv, memberCount, lastMessage };
  })
);
```

**Impact**: For 50 conversations, this executes 100+ additional queries.

**Fix**: Use JOINs or subqueries to fetch all data in 1-2 queries:
```typescript
// Use window functions and JOINs
const enrichedConversations = await db
  .select({
    ...conversations,
    memberCount: sql`COUNT(*) OVER (PARTITION BY conversation_id)`,
    lastMessage: sql`FIRST_VALUE(message) OVER (PARTITION BY conversation_id ORDER BY created_at DESC)`
  })
  .from(conversations)
  ...
```

---

### 1.2 Instant Messages - Recent Conversations - `instant-messages.ts:199-252`

**Problem**: For each conversation partner, 3 separate queries are executed:
1. User details query
2. Last message query
3. Unread messages query

```typescript
const conversationPartners = await Promise.all(
  Array.from(userIds).map(async (userId) => {
    const [user] = await db.select()...  // Query 1
    const [lastMessage] = await db.select()... // Query 2
    const unreadMessages = await db.select()... // Query 3
    return { user, lastMessage, unreadCount: unreadMessages.length };
  })
);
```

**Impact**: For 20 conversation partners = 60+ queries.

**Fix**: Batch fetch all data:
```typescript
// Fetch all users in one query
const usersMap = await db.select().from(users).where(inArray(users.id, Array.from(userIds)));

// Fetch last messages with window function
const lastMessages = await db.execute(sql`
  SELECT DISTINCT ON (CASE WHEN sender_id = ${currentUserId} THEN recipient_id ELSE sender_id END)
    *, CASE WHEN sender_id = ${currentUserId} THEN recipient_id ELSE sender_id END as partner_id
  FROM instant_messages
  WHERE sender_id = ${currentUserId} OR recipient_id = ${currentUserId}
  ORDER BY partner_id, created_at DESC
`);

// Fetch unread counts in one aggregation query
const unreadCounts = await db.select({
  senderId: instantMessages.senderId,
  count: sql`count(*)`
}).from(instantMessages)
  .where(and(eq(recipientId, currentUserId), eq(read, false)))
  .groupBy(instantMessages.senderId);
```

---

### 1.3 Event Volunteers Enrichment - `event-requests.ts:3525-3535`

**Problem**: Each volunteer record triggers an additional query for event details.

```typescript
const enrichedVolunteers = await Promise.all(
  userVolunteers.map(async (volunteer) => {
    const eventRequest = await storage.getEventRequestById(volunteer.eventRequestId);
    return { ...volunteer, eventRequest };
  })
);
```

**Fix**: Use a JOIN in the storage method or batch fetch:
```typescript
// Batch fetch all event requests
const eventIds = userVolunteers.map(v => v.eventRequestId);
const events = await storage.getEventRequestsByIds(eventIds);
const eventsMap = new Map(events.map(e => [e.id, e]));

const enrichedVolunteers = userVolunteers.map(volunteer => ({
  ...volunteer,
  eventRequest: eventsMap.get(volunteer.eventRequestId)
}));
```

---

### 1.4 Project Tasks with Assignments - `projects/index.ts:363-378`

**Problem**: Each task triggers an assignment lookup query.

```typescript
const tasksWithAssignments = await Promise.all(
  tasks.map(async (task) => {
    const assignments = await taskAssignmentService.getTaskAssignments(task.id);
    return { ...task, assignments };
  })
);
```

**Fix**: Add a batch method to `taskAssignmentService`:
```typescript
const taskIds = tasks.map(t => t.id);
const allAssignments = await taskAssignmentService.getAssignmentsForTasks(taskIds);
const assignmentsMap = groupBy(allAssignments, 'taskId');
```

---

### 1.5 Team Board Items with Assignments - `team-board.ts:342-356`

Same pattern as above - queries inside `Promise.all(...map)`.

---

### 1.6 Projects with Assignee Names - `database-storage.ts:305-324`

**Problem**: For projects with missing assignee names, individual user lookups occur.

```typescript
projectsFromDb.map(async (project) => {
  if (project.assigneeIds && !project.assigneeNames) {
    // Fetches user details for each assignee individually
  }
});
```

---

### 1.7 Socket Collaboration - Lock Release - `socket-collaboration.ts:299-304`

**Problem**: Sequential delete operations inside a loop.

```typescript
for (const lock of userLocks) {
  await storage.deleteEventFieldLock(eventRequestId, lock.fieldName);
}
```

**Fix**: Use batch delete:
```typescript
await storage.deleteEventFieldLocks(eventRequestId, userLocks.map(l => l.fieldName));
```

---

## 2. React Performance Issues

### 2.1 Components with Excessive useState (Potential Re-render Issues)

The following components have 5+ useState hooks, which can cause cascading re-renders:

| Component | File |
|-----------|------|
| EventRequestContext | `event-requests/context/EventRequestContext.tsx` |
| EventSchedulingForm | `event-requests/EventSchedulingForm.tsx` |
| GmailStyleInbox | `gmail-style-inbox.tsx` |
| GroupMessaging | `group-messaging.tsx` |
| HostsManagementConsolidated | `hosts-management-consolidated.tsx` |
| WeeklyMonitoringDashboard | `weekly-monitoring-dashboard.tsx` |
| SandwichCollectionLog | `sandwich-collection-log.tsx` |
| RecipientsManagement | `recipients-management.tsx` |
| VolunteerManagement | `volunteer-management.tsx` |
| SmartSearch | `SmartSearch.tsx` |
| ActionCenter | `action-center.tsx` |

**Recommendation**:
1. Group related state with `useReducer`
2. Split into smaller components
3. Use `useMemo` and `useCallback` for expensive computations

### 2.2 Missing Memoization

**Current Usage**: 450 occurrences of `useMemo/useCallback/React.memo` across 104 files

**Files with useEffect but potentially missing memoization**: 154 files use `useEffect` - review for:
- Inline object/array dependencies causing infinite loops
- Missing dependency arrays
- Heavy computations without memoization

### 2.3 useEffect with Empty Dependency Arrays

Found in 154 files - verify these are intentional mount-only effects and not missing dependencies.

---

## 3. Missing Database Indexes

### 3.1 Tables Without Indexes (Should Add)

| Table | Recommended Index | Reason |
|-------|-------------------|--------|
| `users` | `idx_users_role` on `role` | Frequently filtered by role |
| `users` | `idx_users_is_active` on `isActive` | Filtered for active users |
| `users` | `idx_users_last_active` on `lastActiveAt` | Sorted for activity |
| `projects` | `idx_projects_status` on `status` | Filtered by status |
| `projects` | `idx_projects_assignee` on `assigneeId` | Filtered by assignee |
| `project_tasks` | `idx_tasks_project_id` on `projectId` | JOIN with projects |
| `project_tasks` | `idx_tasks_status` on `status` | Filtered by status |
| `drivers` | `idx_drivers_is_active` on `isActive` | Filtered for active |
| `hosts` | `idx_hosts_status` on `status` | Filtered by status |
| `recipients` | `idx_recipients_status` on `status` | Filtered by status |
| `messages` | `idx_messages_conversation` on `conversationId` | JOIN/filter |
| `messages` | `idx_messages_created_at` on `createdAt` | Sorted by time |
| `chat_messages` | `idx_chat_messages_channel` on `channel` | Filtered by channel |
| `chat_messages` | `idx_chat_messages_created_at` on `createdAt` | Sorted |
| `conversations` | `idx_conversations_type` on `type` | Filtered by type |
| `conversation_participants` | Already has composite PK | Good |

### 3.2 Well-Indexed Tables (Good Examples)

The following tables have proper indexing:
- `eventRequests` - Has 6 indexes covering common queries
- `userActivityLogs` - Has 3 composite indexes
- `documents`, `resources` - Multiple useful indexes
- `sandwichDistributions` - Proper indexes for reporting

---

## 4. Inefficient Algorithms

### 4.1 Full Table Scans in Loops - `populate-documents.js:131-134`

```javascript
for (const fileName of files) {
  const existingDocs = await storage.getAllDocuments(); // Full table scan each iteration
  const existingDoc = existingDocs.find(doc => doc.fileName === fileName);
}
```

**Fix**: Fetch once before loop or use `WHERE` clause.

### 4.2 Unread Count Without COUNT() - `instant-messages.ts:147-161`

```typescript
const unreadMessages = await db.select().from(instantMessages)
  .where(and(eq(recipientId, currentUserId), eq(read, false)));
// Returns all rows just to get .length
```

**Fix**: Use COUNT:
```typescript
const [{ count }] = await db.select({ count: sql`count(*)` })...
```

### 4.3 Double Filter in JSX - `action-center.tsx:720`

```tsx
{actionItems.filter(a => a.priority === 'high').length} ...
{actionItems.filter(a => a.priority === 'high').length === 1 ? 'Item' : 'Items'}
```

**Fix**: Calculate once:
```tsx
const highPriorityCount = useMemo(() =>
  actionItems.filter(a => a.priority === 'high').length,
  [actionItems]
);
```

---

## 5. API Route Performance Issues

### 5.1 Large Route Files

| File | Size | Concern |
|------|------|---------|
| `event-requests.ts` | 179KB | Should be split into sub-routes |
| `database-storage.ts` | ~5000 lines | Consider splitting by domain |
| `storage.ts` | ~3600 lines | Same - split by domain |

### 5.2 Missing Pagination

Review endpoints that return unbounded results:
- `/api/event-requests` - Should have default limit
- `/api/projects` - Should have pagination
- `/api/users` - May return all users

### 5.3 Redundant Audit Logging

Pattern seen in `event-requests.ts:3586-3597`:
```typescript
const updatedEventRequest = await storage.updateEventRequest(id, updates);
// Then immediately fetches it again for audit
const originalEvent = await storage.getEventRequestById(id);
```

**Fix**: The `updateEventRequest` should return both old and new values, or audit should be done before update.

---

## 6. Positive Findings (Already Optimized)

1. **React Query Configuration** (`queryClient.ts`):
   - `staleTime: 5 minutes` - Good caching
   - `gcTime: 10 minutes` - Appropriate GC
   - Smart retry logic for network errors

2. **Good Index Coverage** on critical tables:
   - `eventRequests` - 6 indexes
   - `userActivityLogs` - 3 composite indexes
   - Messaging tables - Multiple useful indexes

3. **Performance Monitoring** exists:
   - `performance-middleware.ts` - Slow request detection
   - `metrics.ts` - Prometheus metrics
   - `performance-optimizer.ts` - Debounce/throttle utilities

4. **Compression & Caching**:
   - Gzip compression enabled
   - CDN caching headers configured

---

## 7. Priority Recommendations

### Immediate (High Impact)

1. **Fix N+1 in conversation loading** - Affects messaging performance
2. **Add missing indexes** on `users.role`, `projects.status`, `messages.conversationId`
3. **Fix instant-messages recent conversations** - 3 queries per user → 1 batch query

### Short Term

4. Split `event-requests.ts` into sub-modules
5. Add pagination to unbounded API endpoints
6. Convert unread counts to use `COUNT()` aggregation

### Medium Term

7. Audit React components with 5+ useState for re-render issues
8. Consider adding database connection pooling metrics
9. Add query performance logging to identify slow queries

---

## 8. Code Examples for Critical Fixes

### Fix for Conversation Loading (Priority #1)

```typescript
// Before: N+1 queries
async getUserConversations(userId: string) {
  const conversations = await db.select()...;
  return Promise.all(conversations.map(async (conv) => {
    const memberCount = await db.select({ count: sql`count(*)` })...;
    const lastMessage = await db.select()...;
    return { ...conv, memberCount, lastMessage };
  }));
}

// After: 2 queries total
async getUserConversations(userId: string) {
  // Query 1: Get conversations with member count
  const conversationsWithCount = await db
    .select({
      id: conversations.id,
      type: conversations.type,
      name: conversations.name,
      memberCount: sql<number>`(
        SELECT COUNT(*) FROM conversation_participants
        WHERE conversation_id = conversations.id
      )`
    })
    .from(conversations)
    .innerJoin(conversationParticipants, eq(conversations.id, conversationParticipants.conversationId))
    .where(eq(conversationParticipants.userId, userId));

  // Query 2: Get last messages for all conversations
  const conversationIds = conversationsWithCount.map(c => c.id);
  const lastMessages = await db.execute(sql`
    SELECT DISTINCT ON (conversation_id) *
    FROM messages
    WHERE conversation_id = ANY(${conversationIds})
    ORDER BY conversation_id, created_at DESC
  `);

  const lastMessageMap = new Map(lastMessages.map(m => [m.conversation_id, m]));

  return conversationsWithCount.map(conv => ({
    ...conv,
    lastMessage: lastMessageMap.get(conv.id) || null
  }));
}
```

---

*Generated on: December 18, 2025*
