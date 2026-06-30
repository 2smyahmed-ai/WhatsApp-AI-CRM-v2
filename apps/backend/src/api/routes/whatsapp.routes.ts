import { Router } from 'express';
import { providerManager } from '../../providers/manager';
import { handleMetaWebhook } from '../../providers/meta-webhook.handler';
import qrcode from 'qrcode';
import fs from 'fs';
import path from 'path';
import { authMiddleware, checkPermission } from '../../auth/auth.middleware';
import { processIncomingMessage } from '../../workflow/inbound-workflow';
import { logger } from '../../lib/logger';
import { prisma } from '../../lib/prisma';
import { getSessionId } from '../../whatsapp/client';
import { getWarmupPhase, startOfToday } from '../../whatsapp/warmup';
import { getFromCache, setInCache, invalidateCache } from '../../lib/status-cache';

const router = Router();

router.use((req, res, next) => {
  if (req.path === '/webhook' || req.path === '/meta-webhook') {
    return next();
  }
  return authMiddleware(req, res, next);
});

router.post('/connect', checkPermission('update', 'whatsapp'), async (req, res) => {
  try {
    await providerManager.connect();
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

router.post('/reset-auth', checkPermission('update', 'whatsapp'), async (req, res) => {
  try {
    await providerManager.disconnect();
    const authDir = path.resolve(process.cwd(), 'auth_info_baileys');
    if (fs.existsSync(authDir)) {
      fs.rmSync(authDir, { recursive: true, force: true });
    }
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

router.get('/status', checkPermission('read', 'whatsapp'), async (req, res) => {
  try {
    // Get connection status immediately (from memory, no DB queries)
    const { status, connectedPhone, error } = providerManager.getStatus();

    // Check in-memory cache first (30-second TTL)
    const sessionId = getSessionId();
    const cacheKey = `whatsapp_session_${sessionId}`;
    const cachedSession = getFromCache(cacheKey);

    if (cachedSession !== null) {
      return res.json({
        status,
        connectedPhone,
        error,
        queueDepth: 0,
        session: cachedSession,
      });
    }

    // Fetch session data (parallel queries for speed)
    let session: any = null;

    if (sessionId && sessionId !== 'default') {
      try {
        // Fetch both session creation date and daily count in parallel
        const [whatsappSession, dailySent] = await Promise.all([
          prisma.whatsAppSession.findUnique({
            where: { sessionId },
            select: { createdAt: true, warmupEnabled: true },
          }).catch(() => null),
          // Fast path: Analytics table has pre-aggregated daily counts
          (async () => {
            try {
              const today = startOfToday();
              const analytics = await prisma.analytics.findUnique({
                where: { date: today },
                select: { outgoingMessages: true },
              });
              return analytics?.outgoingMessages ?? 0;
            } catch {
              // If Analytics unavailable, return 0 (don't block response)
              return 0;
            }
          })(),
        ]);

        // Self-heal: if the number is connected but has no session row yet
        // (e.g. it connected before this feature existed), create it now so the
        // dashboard's warm-up card populates without requiring a reconnect.
        let sessionRow = whatsappSession;
        if (!sessionRow && status === 'connected') {
          sessionRow = await prisma.whatsAppSession
            .upsert({ where: { sessionId }, create: { sessionId, data: {}, warmupEnabled: false }, update: {}, select: { createdAt: true, warmupEnabled: true } })
            .catch(() => null);
        }

        if (sessionRow) {
          const warmup = getWarmupPhase(sessionRow.createdAt);
          const dailyRemaining = warmup.dailyLimit ? Math.max(0, warmup.dailyLimit - dailySent) : null;

          session = {
            createdAt: sessionRow.createdAt.toISOString(),
            dayNumber: warmup.dayNumber,
            warmupEnabled: sessionRow.warmupEnabled,
            warmup: {
              active: warmup.active,
              phaseName: warmup.phaseName,
              dailyLimit: warmup.dailyLimit,
              dailySent,
              dailyRemaining,
              fullyUnlockedAt: warmup.fullyUnlockedAt?.toISOString() || null,
              perMinuteCap: warmup.perMinuteCap,
            },
          };

          // Cache for 30 seconds to avoid repeated queries
          setInCache(cacheKey, session);
        }
      } catch (err) {
        logger.warn('whatsapp_status_session_fetch_failed', { error: err instanceof Error ? err.message : String(err) });
        // Session stays null, that's ok
      }
    }

    // Always respond immediately (no timeouts)
    res.json({
      status,
      connectedPhone,
      error,
      queueDepth: 0,
      session,
    });
  } catch (err) {
    logger.error('whatsapp_status_error', { error: err instanceof Error ? err.message : String(err) });
    const { status, connectedPhone, error } = providerManager.getStatus();
    res.json({
      status,
      connectedPhone,
      error,
      queueDepth: 0,
      session: null,
    });
  }
});

router.patch('/session-settings', checkPermission('update', 'whatsapp'), async (req, res) => {
  try {
    const { warmupEnabled } = req.body;
    if (typeof warmupEnabled !== 'boolean') {
      return res.status(400).json({ error: 'warmupEnabled must be a boolean' });
    }
    const sessionId = getSessionId();
    await prisma.whatsAppSession.upsert({
      where: { sessionId },
      create: { sessionId, data: {}, warmupEnabled },
      update: { warmupEnabled },
    });
    invalidateCache(`whatsapp_session_${sessionId}`);
    res.json({ success: true, warmupEnabled });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

router.get('/qr', checkPermission('read', 'whatsapp'), (req, res) => {
  const { qr } = providerManager.getStatus();
  if (qr) {
    qrcode.toDataURL(qr, (err, url) => {
      if (err) return res.status(500).json({ error: 'Failed to generate QR' });
      res.json({ qr: url });
    });
  } else {
    res.json({ qr: null });
  }
});

router.post('/disconnect', checkPermission('update', 'whatsapp'), async (req, res) => {
  if (providerManager.getStatus().status === 'disconnected') {
    return res.status(400).json({ error: 'Not connected' });
  }

  await providerManager.disconnect();
  res.json({ success: true });
});

router.post('/send', checkPermission('create', 'messages'), async (req, res) => {
  const { phone, contactId, message } = req.body;
  try {
    if (contactId) {
      const contact = await (await import('../../lib/prisma')).prisma.contact.findUnique({
        where: { id: contactId },
      });
      if (!contact) {
        return res.status(404).json({ error: 'Contact not found' });
      }
      await providerManager.sendMessage({ phone: contact.phone, text: message });
    } else {
      await providerManager.sendMessage({ phone, text: message });
    }
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

router.post('/webhook', async (req, res) => {
  try {
    const secret = process.env.WHATSAPP_WEBHOOK_SECRET;
    if (secret && req.headers['x-webhook-secret'] !== secret) {
      return res.status(401).json({ error: 'Invalid webhook secret' });
    }

    const sessionId = String(req.body?.sessionId || process.env.WHATSAPP_SESSION_ID || 'default').trim();
    const result = await processIncomingMessage(req.body, { sessionId });
    res.json({ success: true, result });
  } catch (error) {
    logger.error('Webhook ingestion failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

// ── Meta Cloud API webhook ──────────────────────────────────────────────────

router.get('/meta-webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === process.env.META_WEBHOOK_VERIFY_TOKEN) {
    return res.status(200).send(challenge);
  }
  res.status(403).json({ error: 'Forbidden' });
});

router.post('/meta-webhook', async (req, res) => {
  try {
    if (req.body?.object !== 'whatsapp_business_account') {
      return res.status(400).json({ error: 'Invalid webhook object' });
    }
    const sessionId = process.env.META_PHONE_NUMBER_ID ?? 'meta-default';
    await handleMetaWebhook(req.body, sessionId);
    res.status(200).json({ success: true });
  } catch (err) {
    logger.error('meta_webhook.failed', {
      error: err instanceof Error ? err.message : String(err),
    });
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

export default router;
