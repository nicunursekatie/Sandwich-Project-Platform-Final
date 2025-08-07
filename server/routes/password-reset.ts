import { Router } from "express";
import { z } from "zod";
import { storage } from "../storage-wrapper";
import crypto from "crypto";

const router = Router();

// Store password reset tokens temporarily (in production, use Redis or database)
const resetTokens = new Map<string, { userId: string, email: string, expires: number }>();

// Clean up expired tokens periodically
setInterval(() => {
  const now = Date.now();
  for (const [token, data] of resetTokens.entries()) {
    if (now > data.expires) {
      resetTokens.delete(token);
    }
  }
}, 60000 * 60); // Clean up every hour

// Request password reset
router.post("/forgot-password", async (req, res) => {
  try {
    const schema = z.object({
      email: z.string().email("Please enter a valid email address")
    });

    const { email } = schema.parse(req.body);

    // Check if user exists
    const user = await storage.getUserByEmail(email);
    if (!user) {
      // Don't reveal if email exists for security reasons
      return res.json({ 
        success: true, 
        message: "If an account with this email exists, you will receive a password reset link." 
      });
    }

    // Generate secure reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    const expires = Date.now() + (60 * 60 * 1000); // 1 hour

    // Store token
    resetTokens.set(resetToken, {
      userId: user.id,
      email: user.email,
      expires
    });

    // In a real application, you would send an email here
    // For now, we'll log the reset link for testing
    console.log(`
=== PASSWORD RESET REQUEST ===
Email: ${email}
Reset Link: ${req.protocol}://${req.get('host')}/reset-password?token=${resetToken}
Token expires: ${new Date(expires).toLocaleString()}
===============================
    `);

    res.json({ 
      success: true, 
      message: "If an account with this email exists, you will receive a password reset link.",
      // Include reset link in development for testing
      ...(process.env.NODE_ENV === 'development' && {
        resetLink: `${req.protocol}://${req.get('host')}/reset-password?token=${resetToken}`
      })
    });

  } catch (error) {
    console.error("Forgot password error:", error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        message: "Please enter a valid email address"
      });
    }
    res.status(500).json({
      success: false,
      message: "An error occurred. Please try again later."
    });
  }
});

// Reset password with token
router.post("/reset-password", async (req, res) => {
  try {
    const schema = z.object({
      token: z.string().min(1, "Reset token is required"),
      newPassword: z.string()
        .min(8, "Password must be at least 8 characters")
        .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, "Password must contain at least one lowercase letter, one uppercase letter, and one number")
    });

    const { token, newPassword } = schema.parse(req.body);

    // Check if token exists and is valid
    const tokenData = resetTokens.get(token);
    if (!tokenData || Date.now() > tokenData.expires) {
      return res.status(400).json({
        success: false,
        message: "Invalid or expired reset token. Please request a new password reset."
      });
    }

    // Get user and update password
    const user = await storage.getUserById(tokenData.userId);
    if (!user) {
      resetTokens.delete(token);
      return res.status(400).json({
        success: false,
        message: "User not found"
      });
    }

    // Update user's password in metadata
    const updatedUser = {
      ...user,
      metadata: {
        ...user.metadata,
        password: newPassword
      }
    };

    await storage.updateUser(user.id, updatedUser);

    // Remove used token
    resetTokens.delete(token);

    console.log(`Password reset successful for user: ${user.email}`);

    res.json({
      success: true,
      message: "Password has been reset successfully. You can now log in with your new password."
    });

  } catch (error) {
    console.error("Reset password error:", error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        message: error.errors[0].message
      });
    }
    res.status(500).json({
      success: false,
      message: "An error occurred while resetting your password. Please try again."
    });
  }
});

// Verify reset token (for frontend to check if token is valid)
router.get("/verify-reset-token/:token", (req, res) => {
  const { token } = req.params;
  const tokenData = resetTokens.get(token);
  
  if (!tokenData || Date.now() > tokenData.expires) {
    return res.status(400).json({
      valid: false,
      message: "Invalid or expired reset token"
    });
  }

  res.json({
    valid: true,
    email: tokenData.email
  });
});

export default router;