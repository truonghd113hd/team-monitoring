import { Request, Response, NextFunction } from 'express';
import { verifyToken, JwtPayload } from '../services/authService';
import { UserRole } from '../models/User';

// Extend Express Request so downstream handlers can read req.user
declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

/**
 * Verifies the Bearer JWT. Rejects with 401 if missing/invalid.
 */
export const authenticate = (req: Request, res: Response, next: NextFunction): void => {
  const auth = req.headers.authorization || '';
  if (!auth.startsWith('Bearer ')) {
    res.status(401).json({ success: false, message: 'Authentication required' });
    return;
  }
  const token = auth.slice(7);
  try {
    req.user = verifyToken(token);
    next();
  } catch {
    res.status(401).json({ success: false, message: 'Invalid or expired token' });
  }
};

/**
 * Role hierarchy: admin > editor > viewer
 * Usage: requireRole('editor') — allows editor AND admin.
 */
const ROLE_WEIGHT: Record<UserRole, number> = { viewer: 1, editor: 2, admin: 3 };

export const requireRole = (...roles: UserRole[]) =>
  (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Authentication required' });
      return;
    }
    const userWeight = ROLE_WEIGHT[req.user.role] ?? 0;
    const minRequired = Math.min(...roles.map(r => ROLE_WEIGHT[r]));
    if (userWeight < minRequired) {
      res.status(403).json({ success: false, message: 'Insufficient permissions' });
      return;
    }
    next();
  };

export const requireAdmin = requireRole('admin');
export const requireEditor = requireRole('editor');
export const requireViewer = requireRole('viewer'); // effectively any logged-in user
