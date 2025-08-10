# Archived Chat Systems

This folder contains chat components that were replaced by the current Socket.IO-based chat system with @mentions functionality.

## Archived Components:

### Socket.IO Duplicates (replaced by socket-chat-hub.tsx and simple-chat.tsx):
- `enhanced-chat.tsx` - Duplicate Socket.IO chat implementation
- `live-chat-hub.tsx` - Another Socket.IO chat hub implementation  
- `chat-hub.tsx` - Basic wrapper around SimpleChat

### Stream Chat Implementation (replaced by Socket.IO):
- `stream-messages.tsx` - Original Stream Chat implementation
- `stream-messages-clean.tsx` - Cleaned up Stream Chat implementation

### Database-based Messaging (replaced by real-time Socket.IO):
- `direct-messaging.tsx` - Database-based direct messaging
- `group-conversation.tsx` - Database-based group conversations
- `unified-messages.tsx` - Unified message management interface
- `direct-messages.tsx` - Direct message page

## Current Active Chat Systems:

### Real-time Socket.IO Chat:
- `socket-chat-hub.tsx` - Main chat interface with @mentions
- `simple-chat.tsx` - Individual channel chat with @mentions  
- `mention-input.tsx` - @mention input component with autocomplete
- `useSocketChat.ts` - Socket.IO hook for real-time communication

### Database-based Messaging:
- `committee-chat.tsx` - Committee-specific messaging with API persistence
- `email-style-messaging.tsx` - Gmail-style interface for internal messaging
- `messaging-system.tsx` - Core messaging infrastructure

## Archived Date: August 10, 2025
## Reason: Consolidated to single Socket.IO-based chat system with mentions feature