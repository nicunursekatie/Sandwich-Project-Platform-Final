import { Router } from 'express';
import { userService } from '../../services/users';
import { requirePermission, createErrorHandler } from '../../middleware';
import { applyPermissionDependencies } from '@shared/auth-utils';

const usersRouter = Router();

// Error handling for this module (standard middleware applied at mount level)
const errorHandler = createErrorHandler('users');

// User list for project assignments (available to anyone who can create projects)
usersRouter.get('/for-assignments', async (req, res, next) => {
  try {
    const assignableUsers = await userService.getUsersForAssignments();
    res.json(assignableUsers);
  } catch (error) {
    next(error);
  }
});

// Basic user info for resolving user IDs to names (read-only, no special permission needed)
usersRouter.get('/basic', async (req, res, next) => {
  try {
    const users = await userService.getUsersForAssignments(); // Reuse the same method for now
    res.json(users);
  } catch (error) {
    next(error);
  }
});

// User management routes requiring USERS_EDIT permission
usersRouter.get(
  '/',
  requirePermission('USERS_EDIT'),
  async (req, res, next) => {
    try {
      const users = await userService.getAllUsers();
      res.json(users);
    } catch (error) {
      next(error);
    }
  }
);

usersRouter.post(
  '/',
  requirePermission('USERS_EDIT'),
  async (req, res, next) => {
    try {
      const { email, firstName, lastName, role } = req.body;

      const newUser = await userService.createUser({
        email,
        firstName,
        lastName,
        role,
      });

      res.status(201).json(newUser);
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes('already exists')) {
          return res.status(409).json({ message: error.message });
        }
        if (error.message.includes('required')) {
          return res.status(400).json({ message: error.message });
        }
      }
      next(error);
    }
  }
);

usersRouter.patch(
  '/:id',
  requirePermission('USERS_EDIT'),
  async (req, res, next) => {
    try {
      const { id } = req.params;
      const { role, permissions, metadata } = req.body;

      // Apply permission dependencies (e.g., NAV_EVENT_PLANNING automatically grants EVENT_REQUESTS_VIEW)
      const finalPermissions = permissions ? applyPermissionDependencies(permissions) : permissions;

      const updatedUser = await userService.updateUser(
        id,
        {
          role,
          permissions: finalPermissions,
          metadata,
        },
        req.user?.id
      );

      res.json(updatedUser);
    } catch (error) {
      next(error);
    }
  }
);

usersRouter.patch(
  '/:id/status',
  requirePermission('USERS_EDIT'),
  async (req, res, next) => {
    try {
      const { id } = req.params;
      const { isActive } = req.body;

      const updatedUser = await userService.updateUserStatus(id, isActive);
      res.json(updatedUser);
    } catch (error) {
      next(error);
    }
  }
);

usersRouter.patch(
  '/:id/profile',
  requirePermission('USERS_EDIT'),
  async (req, res, next) => {
    try {
      const { id } = req.params;
      const { email, firstName, lastName, phoneNumber, preferredEmail, role, isActive } = req.body;

      const updatedUser = await userService.updateUserProfile(
        id,
        { email, firstName, lastName, phoneNumber, preferredEmail, role, isActive },
        req.user?.id
      );

      res.json(updatedUser);
    } catch (error) {
      next(error);
    }
  }
);

usersRouter.delete(
  '/:id',
  requirePermission('USERS_EDIT'),
  async (req, res, next) => {
    try {
      const { id } = req.params;
      await userService.deleteUser(id);
      res.json({ success: true, message: 'User deleted successfully' });
    } catch (error) {
      next(error);
    }
  }
);

usersRouter.patch(
  '/:id/password',
  requirePermission('USERS_EDIT'),
  async (req, res, next) => {
    try {
      const { id } = req.params;
      const { password } = req.body;

      await userService.setUserPassword(id, password);
      res.json({ success: true, message: 'Password updated successfully' });
    } catch (error) {
      if (
        error instanceof Error &&
        error.message.includes('must be at least')
      ) {
        return res.status(400).json({ message: error.message });
      }
      next(error);
    }
  }
);

// Apply error handler
usersRouter.use(errorHandler);

export default usersRouter;
