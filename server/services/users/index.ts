import { storage } from '../../storage-wrapper';
import { getDefaultPermissionsForRole } from '@shared/auth-utils';
import { AuditLogger } from '../../audit-logger';

export interface IUserService {
  // User CRUD operations
  getAllUsers(): Promise<any[]>;
  getUsersForAssignments(): Promise<any[]>;
  createUser(userData: CreateUserData): Promise<any>;
  updateUser(id: string, updates: UserUpdateData): Promise<any>;
  updateUserStatus(id: string, isActive: boolean): Promise<any>;
  updateUserProfile(
    id: string,
    profileData: UserProfileData,
    requestUserId?: string
  ): Promise<any>;
  deleteUser(id: string): Promise<void>;
  setUserPassword(id: string, password: string): Promise<void>;

  // User validation logic
  validateUserData(userData: any): ValidationResult;
  validatePassword(password: string): ValidationResult;

  // User permission management
  getUserPermissions(userId: string): Promise<string[]>;
  checkUserExists(email: string): Promise<boolean>;
}

export interface CreateUserData {
  email: string;
  firstName: string;
  lastName: string;
  role?: string;
}

export interface UserUpdateData {
  role?: string;
  permissions?: string[];
  metadata?: any;
}

export interface UserProfileData {
  email?: string;
  firstName?: string;
  lastName?: string;
  phoneNumber?: string;
  preferredEmail?: string;
  role?: string;
  isActive?: boolean;
}

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

export class UserService implements IUserService {
  async getAllUsers(): Promise<any[]> {
    try {
      const users = await storage.getAllUsers();
      return users;
    } catch (error) {
      console.error('Error fetching all users:', error);
      throw new Error('Failed to fetch users');
    }
  }

  async getUsersForAssignments(): Promise<any[]> {
    try {
      const users = await storage.getAllUsers();
      // Return basic user info needed for assignments
      const assignableUsers = users.map((user) => ({
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        displayName:
          user.firstName && user.lastName
            ? `${user.firstName} ${user.lastName}`
            : user.displayName || user.email,
      }));
      return assignableUsers;
    } catch (error) {
      console.error('Error fetching users for assignments:', error);
      throw new Error('Failed to fetch users for assignments');
    }
  }

  async createUser(userData: CreateUserData): Promise<any> {
    try {
      // Validate required fields
      const validation = this.validateUserData(userData);
      if (!validation.isValid) {
        throw new Error(validation.errors.join(', '));
      }

      // Check if user already exists
      const existingUser = await storage.getUserByEmail(userData.email);
      if (existingUser) {
        throw new Error('User with this email already exists');
      }

      // Generate user ID and get default permissions for role
      const userId =
        'user_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
      const userRole = userData.role || 'volunteer';
      const defaultPermissions = getDefaultPermissionsForRole(userRole);

      const newUser = await storage.createUser({
        id: userId,
        email: userData.email,
        firstName: userData.firstName,
        lastName: userData.lastName,
        role: userRole,
        permissions: defaultPermissions,
        isActive: true,
        profileImageUrl: null,
        metadata: {},
      });

      return newUser;
    } catch (error) {
      console.error('Error creating user:', error);
      throw error;
    }
  }

  async updateUser(id: string, updates: UserUpdateData): Promise<any> {
    try {
      // Deduplicate permissions to prevent database inconsistencies
      if (updates.permissions) {
        updates.permissions = [...new Set(updates.permissions)];
      }

      // Build update object with only provided fields
      const updateData: any = {};
      if (updates.role !== undefined) updateData.role = updates.role;
      if (updates.permissions !== undefined)
        updateData.permissions = updates.permissions;
      if (updates.metadata !== undefined)
        updateData.metadata = updates.metadata;

      const updatedUser = await storage.updateUser(id, updateData);
      return updatedUser;
    } catch (error) {
      console.error('Error updating user:', error);
      throw new Error('Failed to update user');
    }
  }

  async updateUserStatus(id: string, isActive: boolean): Promise<any> {
    try {
      const updatedUser = await storage.updateUser(id, { isActive });
      return updatedUser;
    } catch (error) {
      console.error('Error updating user status:', error);
      throw new Error('Failed to update user status');
    }
  }

  async updateUserProfile(
    id: string,
    profileData: UserProfileData,
    requestUserId?: string
  ): Promise<any> {
    try {
      // Build update object with only provided fields
      const updateData: any = {};
      if (profileData.email !== undefined) updateData.email = profileData.email;
      if (profileData.firstName !== undefined)
        updateData.firstName = profileData.firstName;
      if (profileData.lastName !== undefined)
        updateData.lastName = profileData.lastName;
      if (profileData.phoneNumber !== undefined)
        updateData.phoneNumber = profileData.phoneNumber;
      if (profileData.preferredEmail !== undefined)
        updateData.preferredEmail = profileData.preferredEmail;
      if (profileData.role !== undefined) updateData.role = profileData.role;
      if (profileData.isActive !== undefined)
        updateData.isActive = profileData.isActive;

      const updatedUser = await storage.updateUser(id, updateData);

      // Log the user profile update
      if (requestUserId) {
        await AuditLogger.log(
          'user_profile_updated',
          'user_management',
          id,
          { updatedFields: Object.keys(updateData), newValues: updateData },
          { userId: requestUserId }
        );
      }

      return updatedUser;
    } catch (error) {
      console.error('Error updating user profile:', error);
      throw new Error('Failed to update user profile');
    }
  }

  async deleteUser(id: string): Promise<void> {
    try {
      await storage.deleteUser(id);
    } catch (error) {
      console.error('Error deleting user:', error);
      throw new Error('Failed to delete user');
    }
  }

  async setUserPassword(id: string, password: string): Promise<void> {
    try {
      const passwordValidation = this.validatePassword(password);
      if (!passwordValidation.isValid) {
        throw new Error(passwordValidation.errors.join(', '));
      }

      await storage.setUserPassword(id, password);
    } catch (error) {
      console.error('Error setting user password:', error);
      throw error;
    }
  }

  validateUserData(userData: any): ValidationResult {
    const errors: string[] = [];

    if (!userData.email) {
      errors.push('Email is required');
    }
    if (!userData.firstName) {
      errors.push('First name is required');
    }
    if (!userData.lastName) {
      errors.push('Last name is required');
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  validatePassword(password: string): ValidationResult {
    const errors: string[] = [];

    if (!password || password.length < 6) {
      errors.push('Password must be at least 6 characters long');
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  async getUserPermissions(userId: string): Promise<string[]> {
    try {
      const user = await storage.getUserById(userId);
      return user?.permissions || [];
    } catch (error) {
      console.error('Error fetching user permissions:', error);
      return [];
    }
  }

  async checkUserExists(email: string): Promise<boolean> {
    try {
      const user = await storage.getUserByEmail(email);
      return !!user;
    } catch (error) {
      console.error('Error checking if user exists:', error);
      return false;
    }
  }
}

export const userService = new UserService();
