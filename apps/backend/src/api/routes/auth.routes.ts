import { Router } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { prisma } from '../../lib/prisma';

const router = Router();

const ACCESS_TOKEN_TTL = '15m';
const REFRESH_TOKEN_TTL_SECONDS = 60 * 60 * 24 * 7;
const loginAttempts = new Map<string, { count: number; resetAt: number }>();
const revokedRefreshTokens = new Set<string>();

function getClientKey(req: any) {
  return req.ip || req.headers['x-forwarded-for'] || 'unknown';
}

function signAccessToken(user: { id: string; email: string; name: string; role?: string; teamId?: string | null }) {
  return jwt.sign(
    { id: user.id, email: user.email, name: user.name, role: user.role, teamId: user.teamId },
    process.env.JWT_SECRET!,
    { expiresIn: ACCESS_TOKEN_TTL }
  );
}

function signRefreshToken(user: { id: string; email: string; role?: string; teamId?: string | null }) {
  const refreshToken = jwt.sign(
    { id: user.id, email: user.email, role: user.role, teamId: user.teamId, tokenId: crypto.randomUUID() },
    process.env.JWT_SECRET!,
    { expiresIn: `${REFRESH_TOKEN_TTL_SECONDS}s` }
  );
  return refreshToken;
}

function setRefreshCookie(res: any, token: string) {
  res.setHeader(
    'Set-Cookie',
    `refreshToken=${token}; HttpOnly; Path=/; Max-Age=${REFRESH_TOKEN_TTL_SECONDS}; SameSite=Lax`
  );
}

function clearRefreshCookie(res: any) {
  res.setHeader('Set-Cookie', 'refreshToken=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax');
}

router.post('/register', (_req, res) => {
  return res.status(403).json({ error: 'Public registration is disabled. Contact your administrator to create an account.' });
});

router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  try {
    const clientKey = String(getClientKey(req));
    const entry = loginAttempts.get(clientKey);
    if (entry && entry.resetAt > Date.now() && entry.count >= 5) {
      return res.status(429).json({ error: 'Too many login attempts. Try again later.' });
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      loginAttempts.set(clientKey, {
        count: (entry?.count || 0) + 1,
        resetAt: entry?.resetAt || Date.now() + 15 * 60 * 1000,
      });
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      loginAttempts.set(clientKey, {
        count: (entry?.count || 0) + 1,
        resetAt: entry?.resetAt || Date.now() + 15 * 60 * 1000,
      });
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    loginAttempts.delete(clientKey);

    const token = signAccessToken(user);
    const refreshToken = signRefreshToken(user);
    setRefreshCookie(res, refreshToken);

    res.json({
      token,
      refreshToken,
      user: { id: user.id, email: user.email, name: user.name, role: user.role, teamId: user.teamId },
    });
  } catch (error) {
    res.status(500).json({ error: 'Login failed' });
  }
});

router.post('/refresh', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    const headerToken = authHeader && authHeader.startsWith('Bearer ')
      ? authHeader.slice('Bearer '.length)
      : null;
    const cookieToken = req.headers.cookie?.split(';').find((part: string) => part.trim().startsWith('refreshToken='))
      ?.split('=')[1];
    const refreshToken = headerToken || cookieToken;

    if (!refreshToken || revokedRefreshTokens.has(refreshToken)) {
      return res.status(401).json({ error: 'Refresh token required' });
    }

    const decoded = jwt.verify(refreshToken, process.env.JWT_SECRET!) as { id: string; email: string };
    const user = await prisma.user.findUnique({ where: { id: decoded.id } });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const token = signAccessToken(user);
    res.json({ token, user: { id: user.id, email: user.email, name: user.name, role: user.role, teamId: user.teamId } });
  } catch (error) {
    res.status(401).json({ error: 'Invalid refresh token' });
  }
});

router.post('/logout', async (req, res) => {
  try {
    const refreshToken = req.headers.cookie?.split(';').find((part: string) => part.trim().startsWith('refreshToken='))
      ?.split('=')[1];
    if (refreshToken) {
      revokedRefreshTokens.add(refreshToken);
    }
    clearRefreshCookie(res);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Logout failed' });
  }
});

router.get('/me', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) {
      return res.status(401).json({ error: 'Access token required' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as { id: string; email: string; name?: string };
    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
      select: { id: true, email: true, name: true, role: true, teamId: true, createdAt: true },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ user });
  } catch (error) {
    res.status(401).json({ error: 'Invalid token' });
  }
});

router.post('/verify-email', async (req, res) => {
  res.status(501).json({ error: 'Email verification is not implemented yet' });
});

router.post('/forgot-password', async (req, res) => {
  res.status(501).json({ error: 'Password reset request is not implemented yet' });
});

router.post('/reset-password', async (req, res) => {
  res.status(501).json({ error: 'Password reset is not implemented yet' });
});

export default router;
