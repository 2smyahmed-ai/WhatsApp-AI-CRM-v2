import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { prisma } from '../../lib/prisma';
import { authMiddleware, requireAdmin } from '../../auth/auth.middleware';

const router = Router();

router.use(authMiddleware);

// List users — admin sees all, others see only their team
router.get('/', async (req, res) => {
  try {
    const user = (req as any).user;
    const isAdmin = ['SUPER_ADMIN', 'ADMIN'].includes(user?.role);

    const users = await prisma.user.findMany({
      where: isAdmin ? {} : { teamId: user?.teamId },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        teamId: true,
        createdAt: true,
        team: { select: { id: true, name: true } },
      },
      orderBy: { name: 'asc' },
    });

    res.json(users);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

// Create user — admin only
router.post('/', requireAdmin, async (req, res) => {
  try {
    const { name, email, password, role, teamId } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Name, email, and password are required' });
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return res.status(409).json({ error: 'Email already in use' });
    }

    const validRoles = ['SUPER_ADMIN', 'ADMIN', 'TEAM_LEAD', 'AGENT', 'ANALYST', 'VIEWER'];
    if (role && !validRoles.includes(role)) {
      return res.status(400).json({ error: 'Invalid role' });
    }

    if (teamId) {
      const team = await prisma.team.findUnique({ where: { id: teamId } });
      if (!team) return res.status(404).json({ error: 'Team not found' });
    }

    const hashedPassword = await bcrypt.hash(password, 12);
    const newUser = await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        role: role || 'AGENT',
        teamId: teamId || null,
      },
      select: { id: true, name: true, email: true, role: true, teamId: true, createdAt: true, team: { select: { id: true, name: true } } },
    });

    res.status(201).json(newUser);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

// Update user — admin only
router.put('/:id', requireAdmin, async (req, res) => {
  try {
    const { name, email, role, teamId, password } = req.body;
    const validRoles = ['SUPER_ADMIN', 'ADMIN', 'TEAM_LEAD', 'AGENT', 'ANALYST', 'VIEWER'];

    if (role && !validRoles.includes(role)) {
      return res.status(400).json({ error: 'Invalid role' });
    }

    const updateData: any = {};
    if (name) updateData.name = name;
    if (email) updateData.email = email;
    if (role) updateData.role = role;
    if (teamId !== undefined) updateData.teamId = teamId || null;
    if (password) updateData.password = await bcrypt.hash(password, 12);

    const updated = await prisma.user.update({
      where: { id: req.params.id },
      data: updateData,
      select: { id: true, name: true, email: true, role: true, teamId: true, team: { select: { id: true, name: true } } },
    });

    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

// Delete user — admin only
router.delete('/:id', requireAdmin, async (req, res) => {
  try {
    const requestingUser = (req as any).user;
    if (req.params.id === requestingUser.id) {
      return res.status(400).json({ error: 'You cannot delete your own account' });
    }

    await prisma.user.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

// Update role — admin only (kept for backward compat)
router.put('/:id/role', requireAdmin, async (req, res) => {
  try {
    const { role } = req.body;
    const validRoles = ['SUPER_ADMIN', 'ADMIN', 'TEAM_LEAD', 'AGENT', 'ANALYST', 'VIEWER'];
    if (!validRoles.includes(role)) {
      return res.status(400).json({ error: 'Invalid role' });
    }

    const updated = await prisma.user.update({
      where: { id: req.params.id },
      data: { role },
      select: { id: true, name: true, email: true, role: true, teamId: true },
    });
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

// Move to team — admin only (kept for backward compat)
router.put('/:id/team', requireAdmin, async (req, res) => {
  try {
    const { teamId } = req.body;
    const updated = await prisma.user.update({
      where: { id: req.params.id },
      data: { teamId: teamId || null },
      select: { id: true, name: true, email: true, role: true, teamId: true },
    });
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

export default router;
