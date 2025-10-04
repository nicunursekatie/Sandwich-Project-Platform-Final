import { Request, Response, NextFunction, RequestHandler } from 'express';
import { Session } from 'express-session';

// User session data structure
export interface SessionUser {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  displayName?: string;
  profileImageUrl?: string;
  role: string;
  permissions?: string[];
  isActive: boolean;
}

// Replit auth user structure
export interface ReplitUser {
  id?: string;
  email?: string;
  claims?: {
    sub: string;
    email?: string;
  };
}

// Extended session interface
export interface AppSession extends Session {
  user?: SessionUser;
}

// Extended request interface with typed user and session
export interface AuthenticatedRequest extends Request {
  user: SessionUser | ReplitUser;
  session: AppSession;
  fileMetadata?: {
    fileName: string;
    filePath: string;
    fileType: string;
    mimeType: string;
  };
}

// Optional auth request (may or may not have user)
export interface MaybeAuthenticatedRequest extends Request {
  user?: SessionUser | ReplitUser;
  session: AppSession;
}

// Typed middleware signatures
export type AuthMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
) => void | Promise<void>;

export type PermissionMiddleware = (
  permission: string
) => (req: Request, res: Response, next: NextFunction) => void | Promise<void>;

// Typed handler with authenticated request
export type AuthenticatedHandler = (
  req: AuthenticatedRequest,
  res: Response,
  next?: NextFunction
) => void | Promise<void>;

// Typed handler with optional auth
export type MaybeAuthenticatedHandler = (
  req: MaybeAuthenticatedRequest,
  res: Response,
  next?: NextFunction
) => void | Promise<void>;

// Standard handler (no auth required)
export type StandardHandler = RequestHandler;

// Helper to get user ID from request
export function getUserId(req: AuthenticatedRequest | MaybeAuthenticatedRequest): string | undefined {
  if (!req.user) return undefined;

  // Check for Replit auth structure
  if ('claims' in req.user && req.user.claims?.sub) {
    return req.user.claims.sub;
  }

  // Check for session user
  if ('id' in req.user && req.user.id) {
    return req.user.id;
  }

  return undefined;
}

// Helper to get user from session or Replit auth
export function getSessionUser(req: AuthenticatedRequest | MaybeAuthenticatedRequest): SessionUser | undefined {
  return req.session?.user || (req.user as SessionUser);
}
