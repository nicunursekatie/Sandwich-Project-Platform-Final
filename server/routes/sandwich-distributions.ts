import { Router } from "express";
import { z } from "zod";
import { storage } from "../storage-wrapper";
import { insertSandwichDistributionSchema } from "@shared/schema";

const router = Router();

// Authentication middleware that matches the main routes.ts authentication
const isAuthenticated = async (req: any, res: any, next: any) => {
  try {
    // Get user from session or req.user (temp auth sets req.user)
    let user = req.user || req.session?.user;

    if (!user) {
      return res.status(401).json({ error: "Authentication required" });
    }

    // Always fetch fresh user data from database to ensure permissions are current
    if (user.email) {
      try {
        const freshUser = await storage.getUserByEmail(user.email);
        if (freshUser) {
          user = freshUser;
          req.user = freshUser;
        }
      } catch (dbError) {
        console.error("Database error in sandwich-distributions auth:", dbError);
        // Continue with session user if database fails
      }
    }

    // Ensure user is active
    if (user.isActive === false) {
      return res.status(401).json({ error: "Account is inactive" });
    }

    next();
  } catch (error) {
    console.error("Authentication error in sandwich-distributions:", error);
    res.status(500).json({ error: "Authentication failed" });
  }
};

// GET /api/sandwich-distributions - Get all distributions
router.get("/", isAuthenticated, async (req, res) => {
  try {
    const distributions = await storage.getAllSandwichDistributions();
    res.json(distributions);
  } catch (error) {
    console.error("Error fetching sandwich distributions:", error);
    res.status(500).json({ error: "Failed to fetch sandwich distributions" });
  }
});

// GET /api/sandwich-distributions/:id - Get single distribution
router.get("/:id", isAuthenticated, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: "Invalid distribution ID" });
    }
    
    const distribution = await storage.getSandwichDistribution(id);
    if (!distribution) {
      return res.status(404).json({ error: "Distribution not found" });
    }
    
    res.json(distribution);
  } catch (error) {
    console.error("Error fetching sandwich distribution:", error);
    res.status(500).json({ error: "Failed to fetch sandwich distribution" });
  }
});

// POST /api/sandwich-distributions - Create new distribution
router.post("/", isAuthenticated, async (req, res) => {
  try {
    const validatedData = insertSandwichDistributionSchema.parse(req.body);
    
    const distribution = await storage.createSandwichDistribution(validatedData);
    res.status(201).json(distribution);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ 
        error: "Invalid data", 
        details: error.errors 
      });
    }
    
    console.error("Error creating sandwich distribution:", error);
    res.status(500).json({ error: "Failed to create sandwich distribution" });
  }
});

// PUT /api/sandwich-distributions/:id - Update distribution
router.put("/:id", isAuthenticated, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: "Invalid distribution ID" });
    }
    
    // Check if distribution exists
    const existingDistribution = await storage.getSandwichDistribution(id);
    if (!existingDistribution) {
      return res.status(404).json({ error: "Distribution not found" });
    }
    
    // Validate the update data (partial)
    const updateSchema = insertSandwichDistributionSchema.partial();
    const validatedData = updateSchema.parse(req.body);
    
    const updatedDistribution = await storage.updateSandwichDistribution(id, validatedData);
    if (!updatedDistribution) {
      return res.status(404).json({ error: "Distribution not found after update" });
    }
    
    res.json(updatedDistribution);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ 
        error: "Invalid data", 
        details: error.errors 
      });
    }
    
    console.error("Error updating sandwich distribution:", error);
    res.status(500).json({ error: "Failed to update sandwich distribution" });
  }
});

// DELETE /api/sandwich-distributions/:id - Delete distribution
router.delete("/:id", isAuthenticated, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: "Invalid distribution ID" });
    }
    
    const success = await storage.deleteSandwichDistribution(id);
    if (!success) {
      return res.status(404).json({ error: "Distribution not found" });
    }
    
    res.json({ success: true, message: "Distribution deleted successfully" });
  } catch (error) {
    console.error("Error deleting sandwich distribution:", error);
    res.status(500).json({ error: "Failed to delete sandwich distribution" });
  }
});

// GET /api/sandwich-distributions/by-week/:weekEnding - Get distributions by week
router.get("/by-week/:weekEnding", isAuthenticated, async (req, res) => {
  try {
    const { weekEnding } = req.params;
    
    // Validate date format (YYYY-MM-DD)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(weekEnding)) {
      return res.status(400).json({ error: "Invalid date format. Use YYYY-MM-DD" });
    }
    
    const distributions = await storage.getSandwichDistributionsByWeek(weekEnding);
    res.json(distributions);
  } catch (error) {
    console.error("Error fetching distributions by week:", error);
    res.status(500).json({ error: "Failed to fetch distributions by week" });
  }
});

// GET /api/sandwich-distributions/by-host/:hostId - Get distributions by host
router.get("/by-host/:hostId", isAuthenticated, async (req, res) => {
  try {
    const hostId = parseInt(req.params.hostId);
    if (isNaN(hostId)) {
      return res.status(400).json({ error: "Invalid host ID" });
    }
    
    const distributions = await storage.getSandwichDistributionsByHost(hostId);
    res.json(distributions);
  } catch (error) {
    console.error("Error fetching distributions by host:", error);
    res.status(500).json({ error: "Failed to fetch distributions by host" });
  }
});

// GET /api/sandwich-distributions/by-recipient/:recipientId - Get distributions by recipient
router.get("/by-recipient/:recipientId", isAuthenticated, async (req, res) => {
  try {
    const recipientId = parseInt(req.params.recipientId);
    if (isNaN(recipientId)) {
      return res.status(400).json({ error: "Invalid recipient ID" });
    }
    
    const distributions = await storage.getSandwichDistributionsByRecipient(recipientId);
    res.json(distributions);
  } catch (error) {
    console.error("Error fetching distributions by recipient:", error);
    res.status(500).json({ error: "Failed to fetch distributions by recipient" });
  }
});

export default router;