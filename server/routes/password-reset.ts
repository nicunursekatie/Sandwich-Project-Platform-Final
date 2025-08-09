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
  resetTokens.forEach((data, token) => {
    if (now > data.expires) {
      resetTokens.delete(token);
    }
  });
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

    // Send password reset email
    try {
      const resetLink = `${req.protocol}://${req.get('host') || 'localhost:5000'}/reset-password?token=${resetToken}`;
      
      // Use SendGrid directly for password reset emails since EmailService is template-based
      const sgMail = require('@sendgrid/mail');
      if (!process.env.SENDGRID_API_KEY) {
        throw new Error('SendGrid API key not configured');
      }
      
      sgMail.setApiKey(process.env.SENDGRID_API_KEY);
      
      await sgMail.send({
        to: email,
        from: 'noreply@thesandwichproject.org',
        subject: 'Password Reset - The Sandwich Project',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f8f9fa;">
            <div style="background-color: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
              <div style="text-align: center; margin-bottom: 30px;">
                <h1 style="color: #236383; margin: 0; font-size: 28px;">The Sandwich Project</h1>
                <p style="color: #666; margin: 10px 0 0 0;">Volunteer Management Platform</p>
              </div>
              
              <h2 style="color: #333; margin-bottom: 20px;">Password Reset Request</h2>
              
              <p style="color: #555; line-height: 1.6; margin-bottom: 20px;">
                We received a request to reset the password for your account. If you made this request, 
                click the button below to set a new password:
              </p>
              
              <div style="text-align: center; margin: 30px 0;">
                <a href="${resetLink}" 
                   style="background-color: #236383; color: white; padding: 15px 30px; text-decoration: none; 
                          border-radius: 8px; font-weight: bold; display: inline-block; 
                          transition: background-color 0.3s;">
                  Reset Your Password
                </a>
              </div>
              
              <p style="color: #555; line-height: 1.6; margin-bottom: 15px;">
                This link will expire in 1 hour for security reasons.
              </p>
              
              <p style="color: #555; line-height: 1.6; margin-bottom: 20px;">
                If you didn't request this password reset, please ignore this email. 
                Your account remains secure and no changes have been made.
              </p>
              
              <div style="border-top: 1px solid #eee; padding-top: 20px; margin-top: 30px;">
                <p style="color: #888; font-size: 14px; margin: 0;">
                  If the button doesn't work, copy and paste this link into your browser:<br>
                  <a href="${resetLink}" style="color: #236383; word-break: break-all;">${resetLink}</a>
                </p>
              </div>
              
              <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee;">
                <p style="color: #888; font-size: 12px; margin: 0;">
                  The Sandwich Project<br>
                  Fighting food insecurity one sandwich at a time
                </p>
              </div>
            </div>
          </div>
        `,
        text: `
Password Reset Request - The Sandwich Project

We received a request to reset the password for your account.

To reset your password, visit this link:
${resetLink}

This link will expire in 1 hour for security reasons.

If you didn't request this password reset, please ignore this email. Your account remains secure and no changes have been made.

The Sandwich Project
Fighting food insecurity one sandwich at a time
        `
      });

      console.log(`Password reset email sent successfully to: ${email}`);
    } catch (emailError) {
      console.error("Failed to send password reset email:", emailError);
      // Still log the reset link for development fallback
      console.log(`
=== PASSWORD RESET EMAIL FAILED - DEVELOPMENT FALLBACK ===
Email: ${email}
Reset Link: ${req.protocol}://${req.get('host')}/reset-password?token=${resetToken}
Token expires: ${new Date(expires).toLocaleString()}
===============================
      `);
    }

    const response: any = { 
      success: true, 
      message: "If an account with this email exists, you will receive a password reset link."
    };
    
    // Include reset link in development for testing
    if (process.env.NODE_ENV === 'development') {
      response.resetLink = `${req.protocol}://${req.get('host') || 'localhost:5000'}/reset-password?token=${resetToken}`;
    }
    
    res.json(response);

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