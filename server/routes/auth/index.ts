/**
 * Authentication Routes
 *
 * Single source of truth for all authentication endpoints
 * - POST /api/auth/login - User login
 * - POST /api/auth/logout - User logout
 * - GET /api/auth/me - Get current user
 */

import { Router, type Request, type Response } from 'express';
import { storage } from '../../storage-wrapper';
import { authService, AuthError } from '../../services/auth.service';
import { getDefaultPermissionsForRole } from '../../../shared/auth-utils';
import { logger } from '../../utils/production-safe-logger';
import { isAuthenticated } from '../../middleware/auth';

export function createAuthRouter() {
  const router = Router();

  /**
   * POST /api/auth/login
   * Authenticate user and create session
   */
  router.post('/login', async (req: Request, res: Response) => {
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
  router.post('/logout', async (req: Request, res: Response) => {
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
  router.get('/me', isAuthenticated, async (req: Request, res: Response) => {
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
  router.get('/user', isAuthenticated, async (req: Request, res: Response) => {
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

  return router;
}

export default createAuthRouter;
