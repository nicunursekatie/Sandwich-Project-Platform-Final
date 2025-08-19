import { Router } from "express";
import { z } from "zod";
import { storage } from "../storage-wrapper";
import { sanitizeMiddleware } from "../middleware/sanitizer";
import { insertMessageSchema } from "@shared/schema";
import { hasPermission, PERMISSIONS } from "@shared/auth-utils";

const router = Router();

// Authentication middleware
const isAuthenticated = (req: any, res: any, next: any) => {
  const user = req.user || req.session?.user;
  if (!user) {
    return res.status(401).json({ error: "Authentication required" });
  }
  req.user = user; // Ensure req.user is set
  next();
};

// Permission check functions
function canAccessMessages(req: any) {
  const user = req.user;
  return hasPermission(user, PERMISSIONS.ACCESS_MESSAGES);
}

// UPDATED: Unified message management routes using new conversation system
router.get("/messages", isAuthenticated, async (req, res) => {
  // Check if user has permission to access messages
  if (!canAccessMessages(req)) {
    return res.status(403).json({ error: "Insufficient permissions to view messages" });
  }
  try {
    const limit = req.query.limit ? parseInt(req.query.limit as string) : undefined;

    console.log(`🔍 API QUERY: /messages - limit: ${limit}`);

    let messages;
    if (limit) {
      messages = await storage.getRecentMessages(limit);
    } else {
      messages = await storage.getAllMessages();
    }
    
    console.log(`📤 API RESPONSE: Returning ${messages.length} messages`);
    res.json(messages);
  } catch (error) {
    console.error("Error fetching messages:", error);
    res.status(500).json({ error: "Failed to fetch messages" });
  }
});

router.get("/messages/:id/thread", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const messages = await storage.getThreadMessages(id);
    res.json(messages);
  } catch (error) {
    console.error("Error fetching thread messages:", error);
    res.status(500).json({ error: "Failed to fetch thread messages" });
  }
});

router.post("/messages", isAuthenticated, sanitizeMiddleware, async (req, res) => {
  // Check if user has permission to send messages
  if (!canAccessMessages(req)) {
    return res.status(403).json({ error: "Insufficient permissions to send messages" });
  }
  try {
    const result = insertMessageSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ error: result.error.message });
    }
    
    const { parentId, ...messageData } = result.data;
    
    let message;
    if (parentId) {
      message = await storage.createReply(messageData, parentId);
    } else {
      message = await storage.createMessage(messageData);
    }
    
    // Broadcast notification for new messages
    console.log('Broadcasting new message notification:', message);
    if ((global as any).broadcastNewMessage) {
      (global as any).broadcastNewMessage(message);
      console.log('Message broadcast sent successfully');
    } else {
      console.error('broadcastNewMessage function not available');
    }
    
    res.status(201).json(message);
  } catch (error) {
    console.error("Error creating message:", error);
    res.status(500).json({ error: "Failed to create message" });
  }
});

router.delete("/messages/:id", isAuthenticated, async (req, res) => {
  // Check if user has permission to delete messages
  if (!canAccessMessages(req)) {
    return res.status(403).json({ error: "Insufficient permissions to delete messages" });
  }
  try {
    const id = parseInt(req.params.id);
    const success = await storage.deleteMessage(id);
    if (!success) {
      return res.status(404).json({ error: "Message not found" });
    }
    res.status(204).send();
  } catch (error) {
    console.error("Error deleting message:", error);
    res.status(500).json({ error: "Failed to delete message" });
  }
});

export { router as messagesRoutes };