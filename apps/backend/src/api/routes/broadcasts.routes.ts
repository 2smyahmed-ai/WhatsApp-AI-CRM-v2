import { Router } from 'express';
import { z } from 'zod';
import { BroadcastsService } from '../../broadcasts/broadcasts.service';
import { AUDIENCE_OPERATORS } from '../../broadcasts/audience';
import { authMiddleware, checkPermission } from '../../auth/auth.middleware';
import { HttpError } from '../../auth/authorize';
import { validateBody } from '../validate';

const router = Router();

router.use(authMiddleware);

function sendError(res: any, error: unknown) {
  if (error instanceof HttpError) {
    return res.status(error.status).json({ error: error.message });
  }
  return res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
}

const audienceFilterSchema = z.object({
  tags: z.array(z.string()).optional(),
  match: z.enum(['all', 'any']).optional(),
  conditions: z
    .array(
      z.object({
        field: z.string().min(1).max(64),
        operator: z.enum(AUDIENCE_OPERATORS),
        value: z.unknown().optional(),
      }),
    )
    .max(20)
    .optional(),
});

/**
 * `scheduledAtLocal` is the wall clock the user literally picked
 * ("2026-07-10T14:30"), paired with the IANA zone they picked it in. The pair is
 * unambiguous; an ISO instant alone is not, because it has already thrown away
 * which zone the user meant. `scheduledAt` stays accepted for API clients and is
 * only consulted when `scheduledAtLocal` is absent.
 */
const broadcastSchema = z.object({
  name: z.string().trim().min(1, 'Campaign name is required').max(200),
  message: z.string().max(4096).default(''),
  recipients: z.array(z.string().trim().min(1)).max(50_000).optional(),
  tag: z.string().trim().max(100).optional(),
  filter: audienceFilterSchema.nullish(),
  scheduledAtLocal: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(:\d{2})?$/, 'Pick a valid date and time')
    .nullish(),
  scheduledAt: z.union([z.string().datetime({ offset: true }), z.date()]).nullish(),
  timezone: z.string().trim().max(64).nullish(),
  interactiveContent: z.record(z.unknown()).optional(),
  mediaUrl: z.string().trim().max(2048).nullish(),
  mediaType: z.enum(['IMAGE', 'VIDEO', 'DOCUMENT', 'AUDIO', 'VOICE']).nullish(),
  mediaFilename: z.string().trim().max(255).nullish(),
  mediaMimeType: z.string().trim().max(128).nullish(),
  // Smart Sending: batch the audience with a wait between each batch.
  smartSending: z.boolean().optional(),
  batchSize: z.coerce.number().int().min(1).max(5000).nullish(),
  batchIntervalMinutes: z.coerce.number().int().min(1).max(1440).nullish(),
})
  // A broadcast with neither text nor an attachment has nothing to deliver.
  .refine((body) => body.message.trim().length > 0 || Boolean(body.mediaUrl), {
    message: 'Add a message or an attachment.',
    path: ['message'],
  })
  // Storing a wall clock without its zone is exactly the bug this replaces.
  .refine((body) => !body.scheduledAtLocal || Boolean(body.timezone), {
    message: 'A scheduled broadcast must include the time zone it was scheduled in.',
    path: ['timezone'],
  })
  // Smart Sending is meaningless without both numbers; require them together.
  .refine((body) => !body.smartSending || (body.batchSize != null && body.batchIntervalMinutes != null), {
    message: 'Smart Sending needs a batch size and a wait interval.',
    path: ['batchSize'],
  });

router.get('/', checkPermission('read', 'broadcasts'), async (req, res) => {
  try {
    const broadcasts = await BroadcastsService.getBroadcasts((req as any).user?.teamId);
    res.json(broadcasts);
  } catch (error) {
    sendError(res, error);
  }
});

/**
 * `?recipients=none` returns the campaign without its audience array. The edit
 * form needs every phone to repopulate its picker; the detail view does not, and
 * pages the audience separately.
 */
router.get('/:id', checkPermission('read', 'broadcasts'), async (req, res) => {
  try {
    const broadcast = await BroadcastsService.getBroadcastById(
      req.params.id,
      (req as any).user?.teamId,
      { includeRecipients: req.query.recipients !== 'none' },
    );
    res.json(broadcast);
  } catch (error) {
    sendError(res, error);
  }
});

const recipientQuerySchema = z.object({
  status: z.enum(['pending', 'sent', 'failed']).optional(),
  search: z.string().trim().max(64).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(25),
});

router.get('/:id/recipients', checkPermission('read', 'broadcasts'), async (req, res) => {
  const query = recipientQuerySchema.safeParse(req.query);
  if (!query.success) {
    return res.status(400).json({ error: query.error.issues[0]?.message ?? 'Invalid query' });
  }

  try {
    const result = await BroadcastsService.getRecipients(req.params.id, {
      ...query.data,
      teamId: (req as any).user?.teamId,
    });
    res.json(result);
  } catch (error) {
    sendError(res, error);
  }
});

router.post('/', checkPermission('create', 'broadcasts'), validateBody(broadcastSchema), async (req, res) => {
  try {
    const broadcast = await BroadcastsService.createBroadcast({
      ...req.body,
      teamId: (req as any).user?.teamId,
    });
    res.json(broadcast);
  } catch (error) {
    sendError(res, error);
  }
});

router.put('/:id', checkPermission('update', 'broadcasts'), validateBody(broadcastSchema), async (req, res) => {
  try {
    const broadcast = await BroadcastsService.updateBroadcast(req.params.id, {
      ...req.body,
      teamId: (req as any).user?.teamId,
    });
    res.json(broadcast);
  } catch (error) {
    sendError(res, error);
  }
});

router.post('/:id/send', checkPermission('create', 'broadcasts'), async (req, res) => {
  try {
    const broadcast = await BroadcastsService.sendBroadcast(req.params.id, (req as any).user?.teamId);
    res.json(broadcast);
  } catch (error) {
    sendError(res, error);
  }
});

router.post('/:id/duplicate', checkPermission('create', 'broadcasts'), async (req, res) => {
  try {
    const broadcast = await BroadcastsService.duplicateBroadcast(req.params.id, (req as any).user?.teamId);
    res.status(201).json(broadcast);
  } catch (error) {
    sendError(res, error);
  }
});

router.post('/:id/unschedule', checkPermission('update', 'broadcasts'), async (req, res) => {
  try {
    const broadcast = await BroadcastsService.cancelSchedule(req.params.id, (req as any).user?.teamId);
    res.json(broadcast);
  } catch (error) {
    sendError(res, error);
  }
});

router.post('/:id/cancel', checkPermission('update', 'broadcasts'), async (req, res) => {
  try {
    const broadcast = await BroadcastsService.cancelBroadcast(req.params.id, (req as any).user?.teamId);
    res.json(broadcast);
  } catch (error) {
    sendError(res, error);
  }
});

router.post('/:id/pause', checkPermission('update', 'broadcasts'), async (req, res) => {
  try {
    const broadcast = await BroadcastsService.pauseBroadcast(req.params.id, (req as any).user?.teamId);
    res.json(broadcast);
  } catch (error) {
    sendError(res, error);
  }
});

router.post('/:id/resume', checkPermission('update', 'broadcasts'), async (req, res) => {
  try {
    const broadcast = await BroadcastsService.resumeBroadcast(req.params.id, (req as any).user?.teamId);
    res.json(broadcast);
  } catch (error) {
    sendError(res, error);
  }
});

router.delete('/:id', checkPermission('delete', 'broadcasts'), async (req, res) => {
  try {
    await BroadcastsService.deleteBroadcast(req.params.id, (req as any).user?.teamId);
    res.json({ success: true });
  } catch (error) {
    sendError(res, error);
  }
});

router.get('/:id/stats', checkPermission('read', 'broadcasts'), async (req, res) => {
  try {
    const stats = await BroadcastsService.getBroadcastStats(req.params.id, (req as any).user?.teamId);
    res.json(stats);
  } catch (error) {
    sendError(res, error);
  }
});

export default router;
