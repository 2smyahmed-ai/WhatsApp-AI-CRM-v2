import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { prisma } from '../lib/prisma';

type Role = 'SUPER_ADMIN' | 'ADMIN' | 'TEAM_LEAD' | 'AGENT' | 'ANALYST' | 'VIEWER';

const ADMIN_ROLES: Role[] = ['SUPER_ADMIN', 'ADMIN'];

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

    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as { id: string };
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

export function requireAdmin(req: AuthRequest, res: Response, next: NextFunction) {
  return authMiddleware(req, res, () => {
    if (!req.user || !ADMIN_ROLES.includes(req.user.role)) {
      return res.status(403).json({ error: 'Admin access required' });
    }
    next();
  });
}

export function checkPermission(action: string, resource: string) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    void action;
    void resource;

    return authMiddleware(req, res, () => {
      const role = req.user?.role;
      if (!role) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      if (role === 'VIEWER' && (action !== 'read' || resource === 'broadcasts' || resource === 'messages')) {
        return res.status(403).json({ error: 'Insufficient permissions' });
      }

      if (role === 'ANALYST' && action !== 'read') {
        return res.status(403).json({ error: 'Insufficient permissions' });
      }

      if (role === 'AGENT' && action === 'delete') {
        return res.status(403).json({ error: 'Insufficient permissions' });
      }

      next();
    });
  };
}
