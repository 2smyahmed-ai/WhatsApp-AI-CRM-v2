import { Router } from 'express';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { ConversationsService } from '../../conversations/conversations.service';
import { NotesService } from '../../conversations/notes.service';
import { authMiddleware, checkPermission } from '../../auth/auth.middleware';
import { getOrCreateConversationByPhone } from '../../conversations/conversation-resolver';
import interactiveMessageService from '../../services/interactive-message.service';

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });
const uploadsDir = path.resolve(process.cwd(), 'uploads');

router.use(authMiddleware);

// ── List conversations ──────────────────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const { status, search, assignedTo, view, teamId } = req.query;
    const user = (req as any).user;

    const conversations = await ConversationsService.getConversations({
      status: status as string,
      search: search as string,
      assignedTo:
        assignedTo === 'me'
          ? user?.id
          : typeof assignedTo === 'string' && assignedTo.trim()
          ? assignedTo
          : undefined,
      view: view as any,
      teamId: teamId as string,
      currentUserId: user?.id,
      currentUserTeamId: user?.teamId,
    });
    res.json(conversations);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

// ── Get single conversation (no messages — use /messages endpoint) ──────────
router.get('/by-phone/:phone', async (req, res) => {
  try {
    const result = await getOrCreateConversationByPhone(req.params.phone, (req as any).user?.teamId);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const conversation = await ConversationsService.getConversation(req.params.id);
    if (!conversation) return res.status(404).json({ error: 'Conversation not found' });
    res.json(conversation);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

// ── Paginated messages ───────────────────────────────────────────────────────
// GET /conversations/:id/messages?limit=50&cursor=<messageId>
router.get('/:id/messages', async (req, res) => {
  try {
    const { cursor, limit } = req.query;
    const result = await ConversationsService.getMessages(
      req.params.id,
      cursor as string | undefined,
      limit ? Number(limit) : 50,
    );
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

// ── Message search ──────────────────────────────────────────────────────────
router.get('/:id/messages/search', async (req, res) => {
  try {
    const { q } = req.query;
    if (!q || typeof q !== 'string' || !q.trim()) {
      return res.status(400).json({ error: 'Search query is required' });
    }
    const { prisma } = await import('../../lib/prisma');
    const messages = await prisma.message.findMany({
      where: {
        conversationId: req.params.id,
        body: { contains: q.trim(), mode: 'insensitive' },
      },
      orderBy: { timestamp: 'desc' },
      take: 30,
    });
    res.json(messages);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

// ── Status ───────────────────────────────────────────────────────────────────
router.put('/:id/status', checkPermission('update', 'conversations'), async (req, res) => {
  try {
    const { status } = req.body;
    const user = (req as any).user;
    const conversation = await ConversationsService.updateConversationStatus(req.params.id, status, user?.id);
    res.json(conversation);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

// ── Read ─────────────────────────────────────────────────────────────────────
router.put('/:id/read', async (req, res) => {
  try {
    const conversation = await ConversationsService.markAsRead(req.params.id);
    res.json(conversation);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

// ── Assign agent ─────────────────────────────────────────────────────────────
router.put('/:id/assign', checkPermission('update', 'conversations'), async (req, res) => {
  try {
    const { agentId } = req.body;
    const user = (req as any).user;
    const conversation = await ConversationsService.assignConversation(req.params.id, agentId || null, user?.id);
    res.json(conversation);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

// ── Assign team ───────────────────────────────────────────────────────────────
router.put('/:id/assign-team', checkPermission('update', 'conversations'), async (req, res) => {
  try {
    const { teamId } = req.body;
    const user = (req as any).user;
    const conversation = await ConversationsService.assignTeam(req.params.id, teamId || null, user?.id);
    res.json(conversation);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

// ── Pipeline ──────────────────────────────────────────────────────────────────
router.put('/:id/pipeline', checkPermission('update', 'conversations'), async (req, res) => {
  try {
    const { pipeline } = req.body;
    const user = (req as any).user;
    const conversation = await ConversationsService.updatePipeline(req.params.id, pipeline || null, user?.id);
    res.json(conversation);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

// ── Pin / Unpin ───────────────────────────────────────────────────────────────
router.put('/:id/pin', async (req, res) => {
  try {
    const { isPinned } = req.body;
    const conversation = await ConversationsService.pinConversation(req.params.id, Boolean(isPinned));
    res.json(conversation);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

// ── Snooze ────────────────────────────────────────────────────────────────────
// Body: { snoozedUntil: ISO string } to snooze, or { snoozedUntil: null } to unsnooze
router.put('/:id/snooze', async (req, res) => {
  try {
    const { snoozedUntil } = req.body;
    const date = snoozedUntil ? new Date(snoozedUntil) : null;
    if (snoozedUntil && isNaN(date!.getTime())) {
      return res.status(400).json({ error: 'Invalid snoozedUntil date' });
    }
    const conversation = await ConversationsService.snoozeConversation(req.params.id, date);
    res.json(conversation);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

// ── Internal notes ────────────────────────────────────────────────────────────
router.get('/:id/notes', async (req, res) => {
  try {
    const notes = await NotesService.getNotes(req.params.id);
    res.json(notes);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

router.post('/:id/notes', async (req, res) => {
  try {
    const { body } = req.body;
    const user = (req as any).user;
    if (!body?.trim()) return res.status(400).json({ error: 'Note body is required' });
    const note = await NotesService.addNote(req.params.id, user.id, body.trim());
    res.status(201).json(note);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

router.delete('/:id/notes/:noteId', async (req, res) => {
  try {
    const user = (req as any).user;
    const result = await NotesService.deleteNote(req.params.noteId, user.id, user.role);
    res.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(message === 'Forbidden' ? 403 : 500).json({ error: message });
  }
});

// ── Message reactions ─────────────────────────────────────────────────────────
router.post('/:id/messages/:messageId/reactions', async (req, res) => {
  try {
    const { emoji } = req.body;
    const userId = (req as any).user?.id;
    if (!emoji || !userId) return res.status(400).json({ error: 'emoji and auth required' });

    const { prisma } = await import('../../lib/prisma');
    const existing = await prisma.messageReaction.findUnique({
      where: { messageId_userId: { messageId: req.params.messageId, userId } },
    });

    let reactionEmoji = emoji;
    if (existing) {
      if (existing.emoji === emoji) {
        await prisma.messageReaction.delete({ where: { id: existing.id } });
        reactionEmoji = '';
      } else {
        await prisma.messageReaction.update({ where: { id: existing.id }, data: { emoji } });
      }
    } else {
      await prisma.messageReaction.create({ data: { messageId: req.params.messageId, userId, emoji } });
    }

    // Sync reaction to WhatsApp
    try {
      const { providerManager } = await import('../../providers/manager');
      const msg = await prisma.message.findUnique({
        where: { id: req.params.messageId },
        select: { externalId: true, fromMe: true },
      });
      const conv = await prisma.conversation.findUnique({
        where: { id: req.params.id },
        include: { contact: true },
      });
      if (msg?.externalId && conv?.contact?.phone) {
        await providerManager.sendReaction(conv.contact.phone, msg.externalId, msg.fromMe, reactionEmoji);
      }
    } catch {
      // non-critical — DB already updated
    }

    const reactions = await prisma.messageReaction.findMany({
      where: { messageId: req.params.messageId },
      include: { user: { select: { id: true, name: true } } },
    });

    const { emitRealtime } = await import('../../realtime/socket');
    const { emitEvent } = await import('../../realtime/event-bus');
    const conv = await prisma.conversation.findUnique({ where: { id: req.params.id }, select: { teamId: true } });

    // Legacy event
    emitRealtime('message:reaction', { conversationId: req.params.id, messageId: req.params.messageId, reactions }, conv?.teamId ?? null);

    // Envelope event — Zustand store applies replace semantics on the full array
    if (conv?.teamId) {
      emitEvent('message.reaction_changed', {
        conversationId: req.params.id,
        messageId: req.params.messageId,
        reactions: reactions
          .filter((r: any) => r.emoji)
          .map((r: any) => ({
            emoji: r.emoji,
            reactor: { kind: 'user' as const, userId: r.userId ?? '' },
          })),
      }, conv.teamId);
    }

    res.json(reactions);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

// ── Send reply ────────────────────────────────────────────────────────────────
router.post('/:id/reply', checkPermission('create', 'messages'), upload.single('media'), async (req, res) => {
  try {
    const { message, contactId, mediaCaption, replyToId, replyToBody, clientId } = req.body;
    const hasMedia = Boolean(req.file);
    if ((!message || !String(message).trim()) && !hasMedia) {
      return res.status(400).json({ error: 'Message cannot be empty' });
    }

    let mediaInfo;
    if (req.file) {
      if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
      const ext = path.extname(req.file.originalname) || '';
      const isVoiceNote = req.file.mimetype.startsWith('audio/') && req.file.originalname.startsWith('voice-note-');
      const fileName = `${crypto.randomUUID()}${ext}`;
      const filePath = path.join(uploadsDir, fileName);
      fs.writeFileSync(filePath, req.file.buffer);
      mediaInfo = {
        mediaBuffer: req.file.buffer,
        mediaMimeType: req.file.mimetype,
        mediaFileName: req.file.originalname,
        mediaCaption: mediaCaption ?? message ?? '',
        mediaUrl: `/uploads/${fileName}`,
        mediaIsVoiceNote: isVoiceNote,
      };
    }

    await ConversationsService.sendReply(
      req.params.id,
      message,
      contactId,
      req.file
        ? {
            mediaBuffer: mediaInfo!.mediaBuffer,
            mediaMimeType: mediaInfo!.mediaMimeType,
            mediaFileName: mediaInfo!.mediaFileName,
            mediaCaption: mediaInfo!.mediaCaption,
            mediaIsVoiceNote: mediaInfo!.mediaIsVoiceNote,
            mediaUrl: mediaInfo!.mediaUrl,
          }
        : undefined,
      replyToId ? { replyToId, replyToBody } : undefined,
      clientId ?? undefined,
    );
    res.json({ success: true, clientId: clientId ?? null });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Failed to send conversation reply:', error);
    const status = message.includes('not connected') ? 503 : 500;
    res.status(status).json({ error: message });
  }
});

// ── Send interactive message ──────────────────────────────────────────────────
router.post('/:id/interactive', checkPermission('create', 'messages'), async (req, res) => {
  try {
    const { phone, content } = req.body;
    if (!phone) return res.status(400).json({ error: 'phone is required' });
    if (!content?.kind) return res.status(400).json({ error: 'content.kind is required (interactive_buttons | interactive_list | interactive_cta)' });

    const result = await interactiveMessageService.sendViaMeta(phone, content);
    res.json({ success: true, messageId: result.messageId });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Failed to send interactive message:', error);
    const status = message.includes('session') || message.includes('window') ? 400 : 500;
    res.status(status).json({ error: message });
  }
});

export default router;
