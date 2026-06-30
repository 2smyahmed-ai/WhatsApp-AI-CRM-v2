import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { prisma } from '../lib/prisma';
import { env } from '../lib/env';
import { isManager, type Role } from './authorize';

interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
    name: string;
    role: Role;
    teamId: string | null;
  };
}

export const authMiddleware = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

    if (!token) {
      return res.status(401).json({ error: 'Access token required' });
    }

    const decoded = jwt.verify(token, env.jwtSecret) as { id: string };
    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
      select: { id: true, email: true, name: true, role: true, teamId: true },
    });

    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }

    req.user = user;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid token' });
  }
};

/** Gate a route to System Managers (full-access tier) only. */
export function requireAdmin(req: AuthRequest, res: Response, next: NextFunction) {
  return authMiddleware(req, res, () => {
    if (!req.user || !isManager(req.user.role)) {
      return res.status(403).json({ error: 'Admin access required' });
    }
    next();
  });
}

/**
 * Resources that any authenticated user may delete (they own the content).
 * Critical data (contacts, conversations, users) stays manager-only.
 */
const SELF_SERVICE_DELETABLE = new Set([
  'templates',
  'broadcasts',
  'saved-replies',
  'tags',
]);

/**
 * Two-tier permission gate.
 *   - System Managers (SUPER_ADMIN, ADMIN, TEAM_LEAD): full access.
 *   - Employees (AGENT, ANALYST, VIEWER): read/create/update plus delete on
 *     self-service resources; blocked from deleting critical data.
 */
export function checkPermission(action: string, resource: string) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    return authMiddleware(req, res, () => {
      const role = req.user?.role;
      if (!role) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      if (isManager(role)) {
        return next();
      }

      // Employees: block destructive deletes on critical resources only.
      if (action === 'delete' && !SELF_SERVICE_DELETABLE.has(resource)) {
        return res.status(403).json({ error: 'Insufficient permissions' });
      }

      next();
    });
  };
}
