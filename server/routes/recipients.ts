import { Router } from "express";
import { z } from "zod";
import { storage } from "../storage-wrapper";
import { insertRecipientSchema } from "@shared/schema";
import { PERMISSIONS } from "@shared/auth-utils";
import { requirePermission } from "../middleware/auth";

const router = Router();

// GET /api/recipients - Get all recipients
router.get("/", requirePermission(PERMISSIONS.RECIPIENTS_VIEW), async (req, res) => {
  try {
    const recipients = await storage.getAllRecipients();
    res.json(recipients);
  } catch (error) {
    console.error("Error fetching recipients:", error);
    res.status(500).json({ error: "Failed to fetch recipients" });
  }
});

// GET /api/recipients/:id - Get single recipient
router.get("/:id", requirePermission(PERMISSIONS.RECIPIENTS_VIEW), async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: "Invalid recipient ID" });
    }
    
    const recipient = await storage.getRecipient(id);
    if (!recipient) {
      return res.status(404).json({ error: "Recipient not found" });
    }
    
    res.json(recipient);
  } catch (error) {
    console.error("Error fetching recipient:", error);
    res.status(500).json({ error: "Failed to fetch recipient" });
  }
});

// POST /api/recipients - Create new recipient
router.post("/", requirePermission(PERMISSIONS.RECIPIENTS_ADD), async (req, res) => {
  try {
    const validatedData = insertRecipientSchema.parse(req.body);
    
    const recipient = await storage.createRecipient(validatedData);
    res.status(201).json(recipient);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ 
        error: "Invalid data", 
        details: error.errors 
      });
    }
    
    console.error("Error creating recipient:", error);
    res.status(500).json({ error: "Failed to create recipient" });
  }
});

// PUT /api/recipients/:id - Update recipient
router.put("/:id", requirePermission(PERMISSIONS.RECIPIENTS_EDIT), async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: "Invalid recipient ID" });
    }
    
    // Check if recipient exists
    const existingRecipient = await storage.getRecipient(id);
    if (!existingRecipient) {
      return res.status(404).json({ error: "Recipient not found" });
    }
    
    // Validate the update data (partial)
    const updateSchema = insertRecipientSchema.partial();
    const validatedData = updateSchema.parse(req.body);
    
    const updatedRecipient = await storage.updateRecipient(id, validatedData);
    if (!updatedRecipient) {
      return res.status(404).json({ error: "Recipient not found after update" });
    }
    
    res.json(updatedRecipient);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ 
        error: "Invalid data", 
        details: error.errors 
      });
    }
    
    console.error("Error updating recipient:", error);
    res.status(500).json({ error: "Failed to update recipient" });
  }
});

// DELETE /api/recipients/:id - Delete recipient
router.delete("/:id", requirePermission(PERMISSIONS.RECIPIENTS_DELETE), async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: "Invalid recipient ID" });
    }
    
    const success = await storage.deleteRecipient(id);
    if (!success) {
      return res.status(404).json({ error: "Recipient not found" });
    }
    
    res.json({ success: true, message: "Recipient deleted successfully" });
  } catch (error) {
    console.error("Error deleting recipient:", error);
    res.status(500).json({ error: "Failed to delete recipient" });
  }
});

// PATCH /api/recipients/:id/status - Update recipient status
router.patch("/:id/status", requirePermission(PERMISSIONS.RECIPIENTS_EDIT), async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: "Invalid recipient ID" });
    }
    
    const { status } = req.body;
    if (!status || !['active', 'inactive'].includes(status)) {
      return res.status(400).json({ error: "Status must be 'active' or 'inactive'" });
    }
    
    const updatedRecipient = await storage.updateRecipient(id, { status });
    if (!updatedRecipient) {
      return res.status(404).json({ error: "Recipient not found" });
    }
    
    res.json(updatedRecipient);
  } catch (error) {
    console.error("Error updating recipient status:", error);
    res.status(500).json({ error: "Failed to update recipient status" });
  }
});

export default router;