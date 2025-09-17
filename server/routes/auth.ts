import { Router } from 'express';
import { storage } from '../storage-wrapper';

interface AuthDependencies {
  isAuthenticated?: any;
}

export function createAuthRoutes(deps: AuthDependencies = {}) {
  const router = Router();

  // Login endpoint - moved from temp-auth.ts to proper auth router
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
      if (!user || !user.isActive) {
        return res.status(401).json({
          success: false,
          message: 'Invalid email or password',
        });
      }

      // Check password (stored in metadata for now)
      const storedPassword = (user.metadata as any)?.password;
      if (storedPassword !== password) {
        return res.status(401).json({
          success: false,
          message: 'Invalid email or password',
        });
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
      req.session.save((err: any) => {
        if (err) {
          console.error('Session save error:', err);
          return res
            .status(500)
            .json({ success: false, message: 'Session save failed' });
        }
        console.log('Session saved successfully for user:', sessionUser.email);
        console.log('Session ID:', req.sessionID);
        console.log('Session data:', req.session);
        res.json({ success: true, user: sessionUser });
      });
    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({ success: false, message: 'Login failed' });
    }
  });

  // Development-only GET /login route for auto-login (fixes infinite auth loop)
  router.get('/login', async (req: any, res) => {
    try {
      // Allow auto-login in Replit development environment
      // Don't check NODE_ENV as Replit may set it to production
      const isLocalDev = process.env.REPL_ID || process.env.REPLIT_DB_URL || 
                        req.hostname === 'localhost' || req.hostname === '127.0.0.1';
      
      if (!isLocalDev) {
        return res.status(400).json({
          success: false,
          message: 'Auto-login only available in development environment',
        });
      }

      // Auto-login as admin in development
      const adminEmail = 'admin@sandwich.project';
      const user = await storage.getUserByEmail(adminEmail);
      
      if (!user || !user.isActive) {
        return res.status(500).json({
          success: false,
          message: 'Admin user not found or inactive',
        });
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

      // Store user in session with explicit save
      req.session.user = sessionUser;
      req.user = sessionUser;

      // Force session save to ensure persistence
      req.session.save((err: any) => {
        if (err) {
          console.error('Dev auto-login session save error:', err);
          return res.status(500).json({ 
            success: false, 
            message: 'Session save failed' 
          });
        }
        console.log('🔧 DEV AUTO-LOGIN: Session created for', sessionUser.email);
        console.log('🔧 Session ID:', req.sessionID);
        
        // Redirect to dashboard after successful login
        res.redirect('/');
      });
    } catch (error) {
      console.error('Dev auto-login error:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Auto-login failed' 
      });
    }
  });

  // Get current authenticated user
  router.get('/user', async (req: any, res) => {
    try {
      // Get user from session (temp auth) or req.user (Replit auth)
      const user = req.session?.user || req.user;

      if (!user) {
        return res.status(401).json({ message: 'No user in session' });
      }

      // For temp auth, user is directly in session, but get fresh data from database
      if (req.session?.user) {
        try {
          const dbUser = await storage.getUserByEmail(req.session.user.email);
          if (dbUser && dbUser.isActive) {
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
          }
        } catch (error) {
          console.error('Error getting fresh user data:', error);
          // Fallback to session user if database error
          res.json(user);
          return;
        }
      }

      // For Replit auth, get user from database
      const userId = req.user.claims?.sub || req.user.id;
      const dbUser = await storage.getUser(userId);
      res.json(dbUser || user);
    } catch (error) {
      console.error('Error fetching user:', error);
      res.status(500).json({ message: 'Failed to fetch user' });
    }
  });

  return router;
}

export default createAuthRoutes;
