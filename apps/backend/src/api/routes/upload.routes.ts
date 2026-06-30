import { Router } from 'express';
import multer from 'multer';
import crypto from 'crypto';
import { authMiddleware } from '../../auth/auth.middleware';
import { uploadFile } from '../../lib/storage';

const router = Router();

// Allowlist of accepted upload types. The stored file extension is derived from
// the (validated) MIME type rather than the user-supplied filename, so a
// malicious name like `x.html` can never be written or served back as HTML.
const ALLOWED_TYPES: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/gif': '.gif',
  'image/webp': '.webp',
  'video/mp4': '.mp4',
  'video/3gpp': '.3gp',
  'video/quicktime': '.mov',
  'audio/mpeg': '.mp3',
  'audio/ogg': '.ogg',
  'audio/mp4': '.m4a',
  'audio/aac': '.aac',
  'audio/wav': '.wav',
  'application/pdf': '.pdf',
  'application/msword': '.doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
  'application/vnd.ms-excel': '.xls',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '.xlsx',
  'text/plain': '.txt',
  'text/csv': '.csv',
};

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 32 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_TYPES[file.mimetype]) {
      cb(null, true);
    } else {
      cb(new Error(`Unsupported file type: ${file.mimetype}`));
    }
  },
});

router.use(authMiddleware);

router.post('/', (req, res) => {
  upload.single('file')(req, res, async (err) => {
    if (err) {
      const message = err instanceof Error ? err.message : 'Upload failed';
      return res.status(400).json({ error: message });
    }
    try {
      if (!req.file) return res.status(400).json({ error: 'No file provided' });
      const ext = ALLOWED_TYPES[req.file.mimetype];
      const filename = `${crypto.randomUUID()}${ext}`;
      const result = await uploadFile(req.file.buffer, filename, req.file.mimetype);
      res.json({
        url: result.url,
        key: result.key,
        name: req.file.originalname,
        size: req.file.size,
        mimeType: req.file.mimetype,
      });
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : 'Upload failed' });
    }
  });
});

export default router;
