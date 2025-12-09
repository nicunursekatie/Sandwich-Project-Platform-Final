# Project Context - The Sandwich Project Application

This file documents architecture rules, environment constraints, and critical implementation details.
**Last Updated**: December 2024

---

## 1. Socket Architecture

We use ONE Socket.IO singleton per namespace. Components MUST NOT create socket connections directly.

### Namespaces

| Namespace | Manager File | Purpose |
|-----------|-------------|---------|
| `/collaboration` | `client/src/lib/collaboration-manager.ts` | Real-time event editing, presence, comments, field locking |
| `/` (default) | `client/src/lib/socket-singleton.ts` | Notifications, messaging |
| `/chat` | `client/src/hooks/useSocketChat.ts` | Chat functionality |

### Rules

1. **NO component should call `io()` directly** - always use the singleton/manager
2. **MUST use polling-only** for `/collaboration` namespace in Replit environment
3. **MUST NOT attempt WebSocket upgrade** for collaboration - causes 'Invalid frame header' errors
4. **MUST use path `/socket.io`** for all socket connections
5. **Use `window.location.origin`** for socket URL - never hardcode localhost

### Collaboration Socket Pattern

```typescript
// CORRECT: Use collaboration-manager
import { collaborationManager } from '@/lib/collaboration-manager';

const unsubscribe = collaborationManager.subscribe('event', eventId, {
  onConnect: () => {},
  onPresenceUpdate: (users) => {},
  onLocksUpdated: (locks) => {},
});

// WRONG: Never do this
import { io } from 'socket.io-client';
const socket = io('/collaboration'); // ❌ NEVER
```

### Socket Configuration

```typescript
// For /collaboration namespace (POLLING ONLY)
{
  path: '/socket.io',
  transports: ['polling'],  // NO websocket
  upgrade: false,
  reconnection: true,
  reconnectionAttempts: Infinity,
}

// For other namespaces (can try upgrade)
{
  path: '/socket.io/',
  transports: ['polling', 'websocket'],
  upgrade: true,
}
```

---

## 2. Environment Constraints (Replit-Specific)

### WebSocket Limitations

- **WebSockets frequently fail** with 'Invalid frame header' → use polling-only for critical features
- **Replit proxy returns 502** intermittently → clients must reconnect with infinite attempts
- **Dev server port is dynamic** → use `window.location.origin`, never hardcode `localhost:5000`

### Socket URL Resolution

```typescript
// CORRECT
const socketUrl = typeof window !== 'undefined' ? window.location.origin : '';

// WRONG
const socketUrl = 'http://localhost:5000'; // ❌ Never hardcode
```

### Vite HMR Note

The Vite HMR WebSocket may show errors like `wss://localhost:undefined` - this is a known Replit issue with Vite's hot reload, NOT our application sockets. Ignore these errors.

---

## 3. Authentication Rules

### Auth Flow

1. All authentication goes through `/api/auth/login`
2. Session managed via `express-session` with PostgreSQL store (`connect-pg-simple`)
3. `/api/auth/me` is the **single source of truth** for current user
4. New users register with `isActive: false` and require admin approval

### Password Security

- **ONLY bcrypt passwords allowed** - all passwords are hashed with bcrypt
- **Legacy plaintext login paths MUST NOT be used**
- Password reset via `/api/auth/password-reset` with secure tokens

### Session Configuration

```typescript
// Session stored in PostgreSQL
// Secure cookies enabled in production
// SameSite: 'lax' for CSRF protection
```

### Auth Files

| File | Purpose |
|------|---------|
| `server/auth.ts` | Core authentication logic, password hashing |
| `server/routes/auth.ts` | Auth API routes (login, logout, register, me) |
| `server/middleware/` | Authentication and authorization middleware |

---

## 4. Folder Structure & Responsibilities

### Client

```
client/src/
├── lib/
│   ├── collaboration-manager.ts  → OWNS collaboration socket singleton
│   ├── socket-singleton.ts       → OWNS notifications socket singleton
│   ├── queryClient.ts           → React Query configuration
│   └── date-utils.ts            → parseCollectionDate() for timezone-safe dates
├── hooks/
│   ├── use-collaboration.ts     → Generic collaboration hook (uses manager)
│   ├── use-event-collaboration.ts → Event-specific wrapper
│   ├── use-event-collaboration-lite.ts → Lightweight presence-only hook
│   ├── useAuth.ts               → Authentication state
│   └── useNotificationSocket.ts → Notification socket hook
├── components/
│   ├── event-requests/cards/    → Event card components
│   └── collaboration/           → Collaboration UI components
└── pages/                       → Route pages
```

### Server

```
server/
├── routes/
│   ├── auth.ts                  → Single modern auth router
│   ├── event-requests.ts        → HTTP source of truth for events
│   └── collections/             → Sandwich collections API
├── services/                    → Business logic services
├── middleware/                  → Express middleware
├── socket-collaboration.ts      → Collaboration socket server
├── socket-chat.ts              → Chat socket server
├── database-storage.ts         → Database operations (Drizzle ORM)
├── storage.ts                  → IStorage interface
├── background-sync-service.ts  → Google Sheets sync service
└── sms-service.ts              → Twilio SMS integration
```

### Shared

```
shared/
├── schema.ts                   → Drizzle ORM schemas (source of truth)
├── auth-utils.ts               → PERMISSIONS constants
└── unified-auth-utils.ts       → hasPermission() helper
```

---

## 5. DO NOT TOUCH Without Approval

These sections are critical and have complex dependencies:

### Configuration

- [ ] Express session configuration (`server/index.ts`)
- [ ] Socket.IO namespace definitions
- [ ] Drizzle schema primary key types

### Business Logic

- [ ] Event request status transition logic
- [ ] Background sync scheduler (`background-sync-service.ts`)
- [ ] Google Sheets ingestion pipeline (`google-sheets-*.ts`)
- [ ] Cron jobs (`server/index.ts` - cron section)

### Data Integrity

- [ ] `sandwich_collections` table - operational source of truth
- [ ] External ID blacklist system (prevents duplicate imports)
- [ ] User permission system (`PERMISSIONS` constants)

---

## 6. When Modifying Socket Code

### Checklist

- [ ] Use polling-only for `/collaboration` → `transports: ['polling']`
- [ ] Use `/socket.io` path
- [ ] Do NOT create additional socket instances
- [ ] Always reuse the existing namespace singleton
- [ ] No direct `io()` calls inside components or hooks
- [ ] Add new events only via managers/singletons
- [ ] Test reconnection behavior (Replit proxies can drop connections)

### Adding New Socket Events

```typescript
// In collaboration-manager.ts (client)
// 1. Add to event handlers in connect()
socket.on('new_event', (data) => {
  // Handle event
});

// In socket-collaboration.ts (server)
// 2. Add emit in appropriate handler
socket.emit('new_event', data);
```

---

## 7. Database Rules

### Drizzle ORM Patterns

```typescript
// CORRECT: Use .array() as method
sandwichTypes: text('sandwich_types').array(),

// WRONG: Don't wrap with array()
sandwichTypes: array(text('sandwich_types')), // ❌
```

### Date Handling

```typescript
// ALWAYS use parseCollectionDate for date parsing
import { parseCollectionDate } from '@/lib/date-utils';

// Timezone is America/New_York
const date = parseCollectionDate(dateString);
```

### ID Column Types

**NEVER change primary key ID column types** - this breaks migrations

```typescript
// Keep existing type - don't convert serial ↔ varchar
id: serial("id").primaryKey(),  // If already serial, keep it
```

---

## 8. React Query Patterns

### Query Keys

```typescript
// CORRECT: Use array for hierarchical keys
queryKey: ['/api/event-requests', eventId]

// WRONG: Don't interpolate into string
queryKey: [`/api/event-requests/${eventId}`] // ❌
```

### Mutations

```typescript
// Always invalidate cache after mutation
const mutation = useMutation({
  mutationFn: async (data) => {
    return apiRequest('/api/endpoint', { method: 'POST', body: data });
  },
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['/api/endpoint'] });
  },
});
```

---

## 9. UI/UX Conventions

### Form Labels

- Button labels must be specific: "Save Event" not "Submit"
- Avoid ambiguous labels

### Mobile Priority

- Chat positioning and space efficiency are critical
- Desktop requires proper scrolling without nested containers

### Analytics Philosophy

**NEVER compare or rank hosts against each other** - The Sandwich Project focuses on increasing volunteer turnout globally, not ranking hosts.

---

## 10. External Integrations

### Twilio SMS

- Uses Replit Twilio integration with API Key authentication
- Configured via environment secrets: `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER`
- Text-to-App (Holding Zone ideas) pipeline:
  - Inbound SMS webhook at `/api/sms/webhook` (Twilio signature validated) handled in `server/routes/sms-users.ts`
  - Users text `IDEA <their idea>`; message is turned into a Holding Zone item (`teamBoardItems` table) with `createdByName` marked as “(via SMS)” and `createdBy` set to the matched user or `sms-system`
  - Confirmation SMS is sent back; failures return a polite error via Twilio response
  - Opt-in/consent is stored on the user (`metadata.smsConsent`) and checked before use
  - Keep the webhook URL in Twilio console synced with deployment URL (`https://<host>/api/sms/webhook`)

### SendGrid Email

- All outgoing emails are BCC'd to `katie@thesandwichproject.org`
- Configured via Replit integration

### Google Sheets

- Background sync every 5 minutes
- Uses permanent external_id blacklist to prevent duplicate imports
- Advisory locks replaced with in-memory locking (Neon serverless limitation)

---

## 11. Common Pitfalls

### Import Errors

```typescript
// Toast hook location
import { useToast } from '@/hooks/use-toast';

// React NOT explicitly imported (Vite JSX transformer handles it)
// import React from 'react'; // ❌ Not needed
```

### SelectItem Value

```tsx
// CORRECT: Always provide value
<SelectItem value="option1">Option 1</SelectItem>

// WRONG: Missing value causes error
<SelectItem>Option 1</SelectItem> // ❌
```

### Tooltip + ConfirmationDialog

Never wrap `ConfirmationDialog` triggers with `Tooltip` - causes ref forwarding issues.

---

## 12. Testing Checklist

Before completing any socket-related changes:

1. [ ] Verify only ONE socket connection per namespace in Network tab
2. [ ] Confirm polling transport (no WebSocket frames)
3. [ ] Test reconnection after simulated disconnect
4. [ ] Check server logs for duplicate connections
5. [ ] Verify presence/locks update correctly across tabs
