import { Router } from 'express';
import { storage } from '../storage-wrapper';
import bcrypt from 'bcrypt';
import { logger } from '../utils/production-safe-logger';

interface AuthDependencies {
  isAuthenticated?: any;
}

export function createAuthRoutes(deps: AuthDependencies = {}) {
  const router = Router();

  // Login endpoint - moved from auth.ts to proper auth router
  router.post('/login', async (req: any, res) => {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        return res.status(400).json({
          success: false,
          message: 'Email and password are required',
        });
      }

      // Find user by email
      const user = await storage.getUserByEmail(email);
      if (!user) {
        return res.status(401).json({
          success: false,
          message: 'Invalid email or password',
        });
      }
      
      // SECURITY: Check if user is pending approval
      if (!user.isActive) {
        logger.log(`❌ Pending user attempted login: ${email}`);
        return res.status(403).json({
          success: false,
          code: 'PENDING_APPROVAL',
          message: 'Your account is pending approval. You will be notified once an admin reviews your application.',
        });
      }

      // Check password with automatic migration to bcrypt hashing
      let storedPassword = user.password;
      if (!storedPassword) {
        return res.status(401).json({
          success: false,
          message: 'Invalid email or password',
        });
      }

      let isValidPassword = false;
      let needsHashUpgrade = false;
      let plaintextPassword: string | null = null;

      // Try bcrypt comparison first (for already-hashed passwords)
      // CRITICAL: Trim password to match registration behavior
      try {
        isValidPassword = await bcrypt.compare(password.trim(), storedPassword);
      } catch (bcryptError) {
        // bcrypt.compare failed - password might be in legacy format
        isValidPassword = false;
      }

      // If bcrypt failed, check for legacy plaintext formats
      if (!isValidPassword) {
        // Format 1: JSON wrapped password {"password": "xxx"}
        try {
          const parsed = JSON.parse(storedPassword);
          if (parsed.password && typeof parsed.password === 'string') {
            plaintextPassword = parsed.password.trim();
            isValidPassword = plaintextPassword === password.trim();
            needsHashUpgrade = isValidPassword; // Upgrade if valid
          }
        } catch {
          // Not JSON - check Format 2: plain string
          if (storedPassword.trim() === password.trim()) {
            plaintextPassword = storedPassword.trim();
            isValidPassword = true;
            needsHashUpgrade = true;
          }
        }
      }

      // Reject if password doesn't match in any format
      if (!isValidPassword) {
        return res.status(401).json({
          success: false,
          message: 'Invalid email or password',
        });
      }

      // AUTO-UPGRADE: Hash plaintext password on successful login
      if (needsHashUpgrade && plaintextPassword) {
        logger.log(`🔐 Auto-upgrading password to bcrypt hash for: ${email}`);
        const SALT_ROUNDS = 10;
        const hashedPassword = await bcrypt.hash(plaintextPassword, SALT_ROUNDS);
        
        // Update password in database
        await storage.updateUser(user.id, { password: hashedPassword });
        logger.log(`✅ Password upgraded successfully for: ${email}`);
      }

      // Create session user object
      const sessionUser = {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        profileImageUrl: user.profileImageUrl,
        role: user.role,
        permissions: user.permissions,
        isActive: user.isActive,
      };

      // Update last login time
      await storage.updateUser(user.id, { lastLoginAt: new Date() });

      // Store user in session with explicit save
      req.session.user = sessionUser;
      req.user = sessionUser;

      // Force session save to ensure persistence
      try {
        await new Promise((resolve, reject) => {
          req.session.save((err: any) => {
            if (err) {
              logger.error('Session save error:', err);
              reject(err);
            } else {
              resolve(undefined);
            }
          });
        });
        
        logger.log('Session saved successfully for user:', sessionUser.email);
        logger.log('Session ID:', req.sessionID);
        logger.log('Session data:', req.session);

        // Redirect to dashboard after successful login
        res.redirect('/');
      } catch (sessionError) {
        logger.error('Session save error:', sessionError);
        res.status(500).json({ success: false, message: 'Session save failed' });
      }
    } catch (error) {
      logger.error('Login error:', error);
      res.status(500).json({ success: false, message: 'Login failed' });
    }
  });

  // GET /login - Redirect to login page (no auto-login for security)
  router.get('/login', async (req: any, res) => {
    // Simply redirect to the login page - no auto-login to prevent unauthorized access
    res.redirect('/login');
  });

  // Logout endpoint
  router.post('/logout', async (req: any, res) => {
    try {
      // Determine if we're in production (same logic as session setup)
      const isProduction = process.env.NODE_ENV === 'production';
      
      // Destroy the session
      req.session.destroy((err: any) => {
        if (err) {
          logger.error('Session destroy error:', err);
          return res.status(500).json({ 
            success: false, 
            message: 'Failed to logout' 
          });
        }
        
        // Clear the session cookie with matching options (must match session cookie config)
        res.clearCookie('tsp.session', {
          path: '/',
          httpOnly: true,
          secure: isProduction,
          sameSite: isProduction ? 'none' : 'lax'
        });
        res.json({ 
          success: true, 
          message: 'Logged out successfully' 
        });
      });
    } catch (error) {
      logger.error('Logout error:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Logout failed' 
      });
    }
  });

  // Get current authenticated user
  router.get('/user', async (req: any, res) => {
    try {
      // Debug logging
      logger.log('🔍 /api/auth/user Debug:', {
        hasSession: !!req.session,
        sessionID: req.sessionID,
        hasSessionUser: !!req.session?.user,
        hasReqUser: !!req.user,
        cookies: req.headers.cookie
      });

      // Get user from session (temp auth) or req.user (Replit auth)
      const user = req.session?.user || req.user;

      if (!user) {
        logger.log('❌ No user found in session');
        return res.status(401).json({ message: 'No user in session' });
      }

      // For temp auth, user is directly in session, but get fresh data from database
      if (req.session?.user) {
        try {
          const dbUser = await storage.getUserByEmail(req.session.user.email);
          
          // SECURITY: Block inactive users - they must be approved first
          if (!dbUser) {
            logger.log(`❌ User not found in database: ${req.session.user.email}`);
            return res.status(401).json({ message: 'User not found' });
          }
          
          if (!dbUser.isActive) {
            logger.log(`❌ Inactive user blocked: ${dbUser.email}`);
            return res.status(403).json({ 
              message: 'Account pending approval',
              code: 'PENDING_APPROVAL',
              details: 'Your account is awaiting admin approval. You will be notified once approved.',
            });
          }
          
          // Update last login time to track session start
          await storage.updateUser(dbUser.id, { lastLoginAt: new Date() });
          
          // Return fresh user data with updated permissions
          res.json({
            id: dbUser.id,
            email: dbUser.email,
            firstName: dbUser.firstName,
            lastName: dbUser.lastName,
            displayName: `${dbUser.firstName} ${dbUser.lastName}`,
            profileImageUrl: dbUser.profileImageUrl,
            role: dbUser.role,
            permissions: dbUser.permissions,
            isActive: dbUser.isActive,
          });
          return;
        } catch (error) {
          logger.error('Error getting fresh user data:', error);
          return res.status(500).json({ message: 'Failed to verify user' });
        }
      }

      // For Replit auth, get user from database
      const userId = req.user.claims?.sub || req.user.id;
      const dbUser = await storage.getUser(userId);
      
      // SECURITY: Block inactive users
      if (!dbUser) {
        return res.status(401).json({ message: 'User not found' });
      }
      
      if (!dbUser.isActive) {
        logger.log(`❌ Inactive user blocked: ${dbUser.email}`);
        return res.status(403).json({ 
          message: 'Account pending approval',
          code: 'PENDING_APPROVAL',
          details: 'Your account is awaiting admin approval. You will be notified once approved.',
        });
      }
      
      // Update last login time for Replit auth too
      await storage.updateUser(dbUser.id, { lastLoginAt: new Date() });
      
      res.json(dbUser);
    } catch (error) {
      logger.error('Error fetching user:', error);
      res.status(500).json({ message: 'Failed to fetch user' });
    }
  });

  // Get user profile with additional contact info
  router.get('/profile', async (req: any, res) => {
    try {
      const user = req.session?.user || req.user;
      if (!user) {
        return res.status(401).json({ message: 'No user in session' });
      }

      let dbUser;
      if (req.session?.user) {
        dbUser = await storage.getUserByEmail(req.session.user.email);
      } else {
        const userId = req.user.claims?.sub || req.user.id;
        dbUser = await storage.getUser(userId);
      }

      if (!dbUser) {
        return res.status(404).json({ message: 'User not found' });
      }

      res.json({
        id: dbUser.id,
        email: dbUser.email,
        firstName: dbUser.firstName,
        lastName: dbUser.lastName,
        displayName: `${dbUser.firstName} ${dbUser.lastName}`,
        preferredEmail: dbUser.preferredEmail,
        phoneNumber: dbUser.phoneNumber,
        profileImageUrl: dbUser.profileImageUrl,
        role: dbUser.role,
        isActive: dbUser.isActive,
      });
    } catch (error) {
      logger.error('Error fetching user profile:', error);
      res.status(500).json({ message: 'Failed to fetch user profile' });
    }
  });

  // Update own profile (self-service)
  router.put('/profile', async (req: any, res) => {
    try {
      const user = req.session?.user || req.user;
      if (!user) {
        return res.status(401).json({ message: 'No user in session' });
      }

      // Get user ID from session
      let userId;
      if (req.session?.user) {
        const dbUser = await storage.getUserByEmail(req.session.user.email);
        if (!dbUser) {
          return res.status(404).json({ message: 'User not found' });
        }
        userId = dbUser.id;
      } else {
        userId = req.user.claims?.sub || req.user.id;
      }

      const { firstName, lastName, displayName, email, preferredEmail, phoneNumber } = req.body;

      // Update user profile
      const updatedUser = await storage.updateUser(userId, {
        firstName,
        lastName,
        email,
        preferredEmail,
        phoneNumber,
      });

      // Update session if using temp auth
      if (req.session?.user) {
        req.session.user = {
          ...req.session.user,
          firstName: updatedUser.firstName,
          lastName: updatedUser.lastName,
          email: updatedUser.email,
        };
      }

      res.json({
        id: updatedUser.id,
        email: updatedUser.email,
        firstName: updatedUser.firstName,
        lastName: updatedUser.lastName,
        displayName: `${updatedUser.firstName} ${updatedUser.lastName}`,
        preferredEmail: updatedUser.preferredEmail,
        phoneNumber: updatedUser.phoneNumber,
        profileImageUrl: updatedUser.profileImageUrl,
        role: updatedUser.role,
        isActive: updatedUser.isActive,
      });
    } catch (error) {
      logger.error('Error updating user profile:', error);
      res.status(500).json({ message: 'Failed to update user profile' });
    }
  });

  return router;
}

export default createAuthRoutes;
