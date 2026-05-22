import type { Server as SocketIOServer } from 'socket.io';
import jwt from 'jsonwebtoken';
import { prisma } from '../lib/prisma';

let socketServer: SocketIOServer | null = null;

export function bindRealtimeServer(server: SocketIOServer) {
  socketServer = server;

  server.use(async (socket, next) => {
    try {
      const token =
        socket.handshake.auth?.token ||
        socket.handshake.headers.authorization?.toString().replace(/^Bearer\s+/i, '');
      if (!token) return next(new Error('Unauthorized'));

      const decoded = jwt.verify(token, process.env.JWT_SECRET!) as { id: string };
      const user = await prisma.user.findUnique({
        where: { id: decoded.id },
        select: { id: true, email: true, name: true, role: true, teamId: true },
      });

      if (!user) return next(new Error('Unauthorized'));

      socket.data.user = user;
      next();
    } catch {
      next(new Error('Unauthorized'));
    }
  });

  server.on('connection', (socket) => {
    const user = socket.data.user as { id: string; teamId: string | null };

    // Join team-scoped room so events are isolated per tenant
    if (user.teamId) {
      socket.join(`team:${user.teamId}`);
    }
    // Personal room for direct notifications
    socket.join(`user:${user.id}`);

    // ── Typing indicator relay ──────────────────────────────────────────────
    socket.on('typing:start', (data: { conversationId: string }) => {
      if (!user.teamId) return;
      socket.to(`team:${user.teamId}`).emit('typing:start', {
        conversationId: data.conversationId,
        userId: user.id,
      });
    });

    socket.on('typing:stop', (data: { conversationId: string }) => {
      if (!user.teamId) return;
      socket.to(`team:${user.teamId}`).emit('typing:stop', {
        conversationId: data.conversationId,
        userId: user.id,
      });
    });

    // ── Gap detection: client missed events, requests replay ────────────────
    socket.on('resync', (req: { fromSeq: number; limit?: number }) => {
      if (!user.teamId) return;
      const { getEventsSince, getLatestSeq } = require('./event-bus');
      const events = getEventsSince(user.teamId, req.fromSeq ?? 0, req.limit ?? 200);
      const latestSeq = getLatestSeq(user.teamId);
      socket.emit('resync.batch', { events, hasMore: false, latestSeq });
    });
  });
}

/**
 * Emit a real-time event scoped to a specific team room.
 * Falls back to global broadcast only if teamId is not provided
 * (e.g. system-level WhatsApp status events).
 */
export function emitRealtime(event: string, payload: unknown, teamId?: string | null) {
  if (!socketServer) return;
  if (teamId) {
    socketServer.to(`team:${teamId}`).emit(event, payload);
  } else {
    // Global emit — only for events that truly need it (wa:status, wa:qr)
    socketServer.emit(event, payload);
  }
}

export function emitToUser(userId: string, event: string, payload: unknown) {
  socketServer?.to(`user:${userId}`).emit(event, payload);
}

export function getRealtimeServer() {
  return socketServer;
}
