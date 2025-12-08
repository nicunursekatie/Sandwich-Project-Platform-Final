/**
 * Authentication Routes
 *
 * Single source of truth for all authentication endpoints
 * - POST /api/auth/login - User login
 * - POST /api/auth/logout - User logout
 * - GET /api/auth/me - Get current user (new endpoint)
 * - GET /api/auth/user - Get current user (legacy compatibility)
 * - GET /api/auth/profile - Get current user's profile
 * - PUT /api/auth/profile - Update current user's profile
 * - PUT /api/auth/change-password - Change user's password
 */

import { Router, type Request, type Response } from 'express';
import { storage } from '../../storage-wrapper';
import { authService, AuthError } from '../../services/auth.service';
import { getDefaultPermissionsForRole } from '../../../shared/auth-utils';
import { logger } from '../../utils/production-safe-logger';
import { isAuthenticated } from '../../middleware/auth';
import type { AuthenticatedRequest, MaybeAuthenticatedRequest } from '../../types/express';

export function createAuthRouter() {
  const router = Router();

  /**
   * POST /api/auth/login
   * Authenticate user and create session
   */
  router.post('/login', async (req: MaybeAuthenticatedRequest, res: Response) => {
    try {
      const { email, password } = req.body;

      // Validate input
      authService.validateLoginInput(email, password);

      // Find user by email
      const user = await storage.getUserByEmail(email);
      if (!user) {
        logger.warn(`Failed login attempt for non-existent user: ${email}`);
        return res.status(401).json({
          success: false,
          message: 'Invalid email or password',
        });
      }

      // Check if user is active
      try {
        authService.validateUserActive(user);
      } catch (error) {
        if (error instanceof AuthError) {
          logger.log(`❌ Inactive user attempted login: ${email}`);
          return res.status(error.statusCode).json({
            success: false,
            code: error.code,
            message: error.message,
          });
        }
        throw error;
      }

      // Verify password (bcrypt only - no plaintext)
      let isValidPassword = false;
      try {
        isValidPassword = await authService.verifyPassword(password, user.password);
      } catch (error) {
        if (error instanceof AuthError) {
          logger.error(`Password verification error for ${email}: ${error.code}`);
          return res.status(error.statusCode).json({
            success: false,
            code: error.code,
            message: error.message,
          });
        }
        throw error;
      }

      if (!isValidPassword) {
        logger.warn(`Failed login attempt for ${email} - invalid password`);
        return res.status(401).json({
          success: false,
          message: 'Invalid email or password',
        });
      }

      // Get user permissions
      const permissions = getDefaultPermissionsForRole(user.role);

      // Create session user object
      const sessionUser = authService.createSessionUser(user, permissions);

      // Save to session
      try {
        await authService.saveSession(req, sessionUser);
      } catch (error) {
        if (error instanceof AuthError) {
          return res.status(error.statusCode).json({
            success: false,
            message: error.message,
          });
        }
        throw error;
      }

      logger.log(`✅ Successful login: ${email} (${user.role})`);

      return res.json({
        success: true,
        user: sessionUser,
      });
    } catch (error) {
      logger.error('Login error:', error);
      return res.status(500).json({
        success: false,
        message: 'An error occurred during login',
      });
    }
  });

  /**
   * POST /api/auth/logout
   * Destroy session and log out user
   */
  router.post('/logout', async (req: MaybeAuthenticatedRequest, res: Response) => {
    try {
      const userEmail = req.session.user?.email || 'unknown';

      await authService.destroySession(req);

      logger.log(`👋 User logged out: ${userEmail}`);

      return res.json({
        success: true,
        message: 'Logged out successfully',
      });
    } catch (error) {
      if (error instanceof AuthError) {
        return res.status(error.statusCode).json({
          success: false,
          message: error.message,
        });
      }

      logger.error('Logout error:', error);
      return res.status(500).json({
        success: false,
        message: 'An error occurred during logout',
      });
    }
  });

  /**
   * GET /api/auth/me
   * Get currently authenticated user
   */
  router.get('/me', isAuthenticated, async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: 'Not authenticated',
        });
      }

      return res.json({
        success: true,
        user: req.user,
      });
    } catch (error) {
      logger.error('Get current user error:', error);
      return res.status(500).json({
        success: false,
        message: 'An error occurred',
      });
    }
  });

  /**
   * GET /api/auth/user
   * Legacy endpoint for backward compatibility
   * Redirects to /me internally
   */
  router.get('/user', isAuthenticated, async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: 'Not authenticated' });
      }

      // Fetch fresh user data from database
      const freshUser = await storage.getUserByEmail(req.user.email);

      if (!freshUser) {
        return res.status(401).json({ message: 'User not found' });
      }

      // Get permissions
      const permissions = getDefaultPermissionsForRole(freshUser.role);

      return res.json({
        ...freshUser,
        permissions,
      });
    } catch (error) {
      logger.error('Get user error:', error);
      return res.status(500).json({ message: 'An error occurred' });
    }
  });

  /**
   * GET /api/auth/profile
   * Get current user's profile data
   */
  router.get('/profile', isAuthenticated, async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: 'Not authenticated' });
      }

      // Fetch fresh user data from database
      const freshUser = await storage.getUserByEmail(req.user.email);

      if (!freshUser) {
        return res.status(401).json({ message: 'User not found' });
      }

      // Return profile data (exclude sensitive fields like password)
      return res.json({
        id: freshUser.id,
        email: freshUser.email,
        firstName: freshUser.firstName,
        lastName: freshUser.lastName,
        displayName: freshUser.displayName,
        preferredEmail: freshUser.preferredEmail,
        phoneNumber: freshUser.phoneNumber,
        profileImageUrl: freshUser.profileImageUrl,
        role: freshUser.role,
        isActive: freshUser.isActive,
      });
    } catch (error) {
      logger.error('Get profile error:', error);
      return res.status(500).json({ message: 'An error occurred' });
    }
  });

  /**
   * PUT /api/auth/profile
   * Update current user's profile
   */
  router.put('/profile', isAuthenticated, async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: 'Not authenticated' });
      }

      const { firstName, lastName, displayName, preferredEmail, phoneNumber } = req.body;

      // Build update object with only provided fields
      const updateData: any = {};
      if (firstName !== undefined) updateData.firstName = firstName;
      if (lastName !== undefined) updateData.lastName = lastName;
      if (displayName !== undefined) updateData.displayName = displayName;
      if (preferredEmail !== undefined) updateData.preferredEmail = preferredEmail;
      if (phoneNumber !== undefined) updateData.phoneNumber = phoneNumber;

      // Update user profile
      const updatedUser = await storage.updateUser(req.user.id, updateData);

      if (!updatedUser) {
        return res.status(404).json({ message: 'User not found' });
      }

      // Update session with fresh data
      if (req.session?.user) {
        req.session.user = {
          ...req.session.user,
          firstName: updatedUser.firstName,
          lastName: updatedUser.lastName,
        };
      }

      // Return updated profile (exclude sensitive fields)
      return res.json({
        id: updatedUser.id,
        email: updatedUser.email,
        firstName: updatedUser.firstName,
        lastName: updatedUser.lastName,
        displayName: updatedUser.displayName,
        preferredEmail: updatedUser.preferredEmail,
        phoneNumber: updatedUser.phoneNumber,
        profileImageUrl: updatedUser.profileImageUrl,
        role: updatedUser.role,
        isActive: updatedUser.isActive,
      });
    } catch (error) {
      logger.error('Update profile error:', error);
      return res.status(500).json({ message: 'An error occurred' });
    }
  });

  /**
   * PUT /api/auth/change-password
   * Change current user's password (requires current password verification)
   */
  router.put('/change-password', isAuthenticated, async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: 'Not authenticated' });
      }

      const { currentPassword, newPassword } = req.body;

      if (!currentPassword || !newPassword) {
        return res.status(400).json({
          message: 'Current password and new password are required',
        });
      }

      // Fetch user to get current password hash
      const user = await storage.getUserByEmail(req.user.email);
      if (!user) {
        return res.status(401).json({ message: 'User not found' });
      }

      // Verify current password
      const isValidPassword = await authService.verifyPassword(currentPassword, user.password);
      if (!isValidPassword) {
        return res.status(401).json({
          message: 'Current password is incorrect',
        });
      }

      // Validate new password
      if (newPassword.length < 8) {
        return res.status(400).json({
          message: 'New password must be at least 8 characters long',
        });
      }

      // Hash and update password
      const hashedPassword = await authService.hashPassword(newPassword);
      await storage.updateUser(user.id, { password: hashedPassword });

      logger.log(`Password changed successfully for user: ${user.email}`);

      return res.json({
        success: true,
        message: 'Password changed successfully',
      });
    } catch (error) {
      if (error instanceof AuthError) {
        return res.status(error.statusCode).json({
          message: error.message,
        });
      }

      logger.error('Change password error:', error);
      return res.status(500).json({ message: 'An error occurred' });
    }
  });

  return router;
}

export default createAuthRouter;
