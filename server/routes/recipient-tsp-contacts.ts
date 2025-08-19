import { Router } from "express";
import { db } from "../db";
import { recipientTspContacts, users } from "@shared/schema";
import { eq, and } from "drizzle-orm";
import { insertRecipientTspContactSchema } from "@shared/schema";
import { z } from "zod";

import { PERMISSIONS } from "@shared/auth-utils";
import { isAuthenticated as requireAuth, requirePermission } from "../temp-auth";

const router = Router();

// Get all TSP contacts for a specific recipient
router.get("/:recipientId", requireAuth, requirePermission(PERMISSIONS.ACCESS_RECIPIENTS), async (req, res) => {
  try {
    const recipientId = parseInt(req.params.recipientId);
    
    const contacts = await db
      .select({
        id: recipientTspContacts.id,
        recipientId: recipientTspContacts.recipientId,
        userId: recipientTspContacts.userId,
        userName: recipientTspContacts.userName,
        userEmail: recipientTspContacts.userEmail,
        contactName: recipientTspContacts.contactName,
        contactEmail: recipientTspContacts.contactEmail,
        contactPhone: recipientTspContacts.contactPhone,
        role: recipientTspContacts.role,
        notes: recipientTspContacts.notes,
        isActive: recipientTspContacts.isActive,
        isPrimary: recipientTspContacts.isPrimary,
        createdAt: recipientTspContacts.createdAt,
        updatedAt: recipientTspContacts.updatedAt,
      })
      .from(recipientTspContacts)
      .where(and(
        eq(recipientTspContacts.recipientId, recipientId),
        eq(recipientTspContacts.isActive, true)
      ))
      .orderBy(recipientTspContacts.isPrimary, recipientTspContacts.createdAt);

    res.json(contacts);
  } catch (error) {
    console.error("Error fetching TSP contacts:", error);
    res.status(500).json({ error: "Failed to fetch TSP contacts" });
  }
});

// Add a new TSP contact
router.post("/", requireAuth, requirePermission(PERMISSIONS.MANAGE_RECIPIENTS), async (req, res) => {
  try {
    const validatedData = insertRecipientTspContactSchema.parse(req.body);

    // If this is being set as primary, unset other primary contacts for this recipient
    if (validatedData.isPrimary) {
      await db
        .update(recipientTspContacts)
        .set({ isPrimary: false })
        .where(eq(recipientTspContacts.recipientId, validatedData.recipientId));
    }

    // If linking to a user, fetch and cache user info
    if (validatedData.userId) {
      const [user] = await db
        .select({ 
          firstName: users.firstName, 
          lastName: users.lastName, 
          email: users.email 
        })
        .from(users)
        .where(eq(users.id, validatedData.userId));
      
      if (user) {
        validatedData.userName = user.firstName && user.lastName ? `${user.firstName} ${user.lastName}` : user.email;
        validatedData.userEmail = user.email;
      }
    }

    const [contact] = await db
      .insert(recipientTspContacts)
      .values(validatedData)
      .returning();

    res.status(201).json(contact);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid data", details: error.errors });
    }
    console.error("Error creating TSP contact:", error);
    res.status(500).json({ error: "Failed to create TSP contact" });
  }
});

// Update a TSP contact
router.patch("/:id", requireAuth, requirePermission(PERMISSIONS.MANAGE_RECIPIENTS), async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const updateData = insertRecipientTspContactSchema.partial().parse(req.body);

    // If this is being set as primary, unset other primary contacts for this recipient
    if (updateData.isPrimary) {
      const [currentContact] = await db
        .select({ recipientId: recipientTspContacts.recipientId })
        .from(recipientTspContacts)
        .where(eq(recipientTspContacts.id, id));
      
      if (currentContact) {
        await db
          .update(recipientTspContacts)
          .set({ isPrimary: false })
          .where(and(
            eq(recipientTspContacts.recipientId, currentContact.recipientId),
            eq(recipientTspContacts.id, id) // Don't unset the one we're updating
          ));
      }
    }

    // If updating user link, fetch and cache user info
    if (updateData.userId) {
      const [user] = await db
        .select({ 
          firstName: users.firstName, 
          lastName: users.lastName, 
          email: users.email 
        })
        .from(users)
        .where(eq(users.id, updateData.userId));
      
      if (user) {
        updateData.userName = user.firstName && user.lastName ? `${user.firstName} ${user.lastName}` : user.email;
        updateData.userEmail = user.email;
      }
    }

    const [contact] = await db
      .update(recipientTspContacts)
      .set({ ...updateData, updatedAt: new Date() })
      .where(eq(recipientTspContacts.id, id))
      .returning();

    if (!contact) {
      return res.status(404).json({ error: "TSP contact not found" });
    }

    res.json(contact);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid data", details: error.errors });
    }
    console.error("Error updating TSP contact:", error);
    res.status(500).json({ error: "Failed to update TSP contact" });
  }
});

// Delete (deactivate) a TSP contact
router.delete("/:id", requireAuth, requirePermission(PERMISSIONS.MANAGE_RECIPIENTS), async (req, res) => {
  try {
    const id = parseInt(req.params.id);

    const [contact] = await db
      .update(recipientTspContacts)
      .set({ isActive: false, updatedAt: new Date() })
      .where(eq(recipientTspContacts.id, id))
      .returning();

    if (!contact) {
      return res.status(404).json({ error: "TSP contact not found" });
    }

    res.json({ message: "TSP contact deactivated successfully" });
  } catch (error) {
    console.error("Error deleting TSP contact:", error);
    res.status(500).json({ error: "Failed to delete TSP contact" });
  }
});

export default router;