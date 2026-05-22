import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { providerManager } from './providers/manager';
import { bindRealtimeServer } from './realtime/socket';
import { startSnoozeWakeupScheduler } from './conversations/snooze-wakeup';
import { ensureFlowWorker } from './automations/flow-executor';
import { startNoReplyDetector } from './automations/no-reply-detector';
import authRoutes from './api/routes/auth.routes';
import whatsappRoutes from './api/routes/whatsapp.routes';
import conversationsRoutes from './api/routes/conversations.routes';
import contactsRoutes from './api/routes/contacts.routes';
import automationsRoutes from './api/routes/automations.routes';
import broadcastsRoutes from './api/routes/broadcasts.routes';
import analyticsRoutes from './api/routes/analytics.routes';
import teamsRoutes from './api/routes/teams.routes';
import tagsRoutes from './api/routes/tags.routes';
import savedRepliesRoutes from './api/routes/saved-replies.routes';
import templatesRoutes from './api/routes/templates.routes';
import dealsRoutes from './api/routes/deals.routes';
import tasksRoutes from './api/routes/tasks.routes';
import usersRoutes from './api/routes/users.routes';
import activityRoutes from './api/routes/activity.routes';
import uploadRoutes from './api/routes/upload.routes';

const app = express();
const server = createServer(app);
const allowedOrigins = new Set([
  process.env.FRONTEND_URL || 'http://localhost:3000',
]);

export const io = new Server(server, {
  cors: {
    origin: [...allowedOrigins],
    methods: ['GET', 'POST'],
    credentials: true,
  },
});
bindRealtimeServer(io);

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.has(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error(`CORS blocked for origin: ${origin}`));
    },
    credentials: true,
  }),
);
app.options(
  '*',
  cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.has(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error(`CORS blocked for origin: ${origin}`));
    },
    credentials: true,
  }),
);
app.set('json replacer', (_key: string, value: unknown) =>
  typeof value === 'bigint' ? Number(value) : value,
);
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));
const uploadsDir = path.resolve(process.cwd(), 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}
app.use('/uploads', express.static(uploadsDir));

app.use('/api/auth', authRoutes);
app.use('/api/whatsapp', whatsappRoutes);
app.use('/api/conversations', conversationsRoutes);
app.use('/api/contacts', contactsRoutes);
app.use('/api/automations', automationsRoutes);
app.use('/api/broadcasts', broadcastsRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/teams', teamsRoutes);
app.use('/api/tags', tagsRoutes);
app.use('/api/saved-replies', savedRepliesRoutes);
app.use('/api/templates', templatesRoutes);
app.use('/api/deals', dealsRoutes);
app.use('/api/tasks', tasksRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/activity', activityRoutes);
app.use('/api/upload', uploadRoutes);

const PORT = process.env.PORT || 4000;

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  startSnoozeWakeupScheduler();
  ensureFlowWorker();
  startNoReplyDetector();
  if (process.env.WHATSAPP_AUTO_CONNECT !== 'false') {
    providerManager.connect().catch((err: Error) => {
      console.error('WhatsApp auto-connect failed:', err.message);
    });
  }
});
