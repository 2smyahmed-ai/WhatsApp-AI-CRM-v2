import { Router } from 'express';
import { z } from 'zod';
import { authMiddleware, checkPermission } from '../../auth/auth.middleware';
import { HttpError } from '../../auth/authorize';
import { validateBody } from '../validate';
import { CUSTOM_FIELD_TYPES } from '../../contacts/custom-fields.constants';
import {
  createDefinition,
  deleteDefinition,
  listDefinitions,
  reorderDefinitions,
  updateDefinition,
} from '../../contacts/custom-fields.service';

const router = Router();

router.use(authMiddleware);

function sendError(res: any, error: unknown) {
  if (error instanceof HttpError) {
    return res.status(error.status).json({ error: error.message });
  }
  return res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
}

const optionSchema = z.object({
  value: z.string().trim().min(1).max(120),
  label: z.string().trim().min(1).max(120),
  color: z.string().trim().max(32).optional(),
});

const createSchema = z.object({
  key: z.string().trim().max(48).optional(),
  label: z.string().trim().min(1).max(120),
  type: z.enum(CUSTOM_FIELD_TYPES),
  options: z.array(optionSchema).max(200).optional(),
  required: z.boolean().optional(),
  defaultValue: z.unknown().optional(),
  placeholder: z.string().trim().max(200).nullish(),
  helpText: z.string().trim().max(500).nullish(),
  currency: z.string().trim().length(3).nullish(),
});

const updateSchema = createSchema.partial().omit({ key: true }).extend({
  isActive: z.boolean().optional(),
});

const reorderSchema = z.object({
  ids: z.array(z.string().min(1)).min(1).max(500),
});

/** Definitions are shared config: any authenticated user may read them, only managers may change them. */
router.get('/', async (req, res) => {
  try {
    const definitions = await listDefinitions((req as any).user?.teamId ?? null, {
      includeInactive: req.query.includeInactive === 'true',
    });
    res.json(definitions);
  } catch (error) {
    sendError(res, error);
  }
});

router.post('/', checkPermission('create', 'contacts'), validateBody(createSchema), async (req, res) => {
  try {
    const definition = await createDefinition((req as any).user?.teamId ?? null, req.body);
    res.status(201).json(definition);
  } catch (error) {
    sendError(res, error);
  }
});

// Reorder must be declared before `/:id` so "reorder" is never read as an id.
router.put('/reorder', checkPermission('update', 'contacts'), validateBody(reorderSchema), async (req, res) => {
  try {
    const definitions = await reorderDefinitions((req as any).user?.teamId ?? null, req.body.ids);
    res.json(definitions);
  } catch (error) {
    sendError(res, error);
  }
});

router.put('/:id', checkPermission('update', 'contacts'), validateBody(updateSchema), async (req, res) => {
  try {
    const definition = await updateDefinition((req as any).user?.teamId ?? null, req.params.id, req.body);
    res.json(definition);
  } catch (error) {
    sendError(res, error);
  }
});

router.delete('/:id', checkPermission('delete', 'contacts'), async (req, res) => {
  try {
    // Values survive a delete unless the caller explicitly asks to purge them,
    // so an accidental delete is recoverable by re-creating the same key.
    const result = await deleteDefinition((req as any).user?.teamId ?? null, req.params.id, {
      purgeValues: req.query.purgeValues === 'true',
    });
    res.json({ success: true, ...result });
  } catch (error) {
    sendError(res, error);
  }
});

export default router;
