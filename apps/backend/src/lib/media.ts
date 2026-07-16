import fs from 'fs/promises';
import path from 'path';
import { LOCAL_UPLOADS_DIR, storageMode } from './storage';
import { logger } from './logger';

/**
 * ─── Media references ────────────────────────────────────────────────────────
 *
 * Attachments used to be persisted as whatever absolute URL the browser happened
 * to build (`http://localhost:4000/uploads/x.jpg`). That value outlives the
 * process that produced it: change the port, the host, or move behind a domain
 * and every stored broadcast/template attachment 404s. Worse, the broadcast
 * worker then re-fetched that dead URL over HTTP and silently downgraded the
 * send to plain text.
 *
 * The fix is a single canonical form. What we persist is a **storage ref**:
 *
 *   local storage → "/uploads/<file>"   (host-independent, resolved at read time)
 *   S3 / R2       → the absolute object URL (already host-independent)
 *
 * `toStorageRef` normalizes anything into that form on write. `resolveMediaUrl`
 * expands it into something a browser can load. `loadMedia` reads the bytes for
 * sending — from disk when local, so a send never depends on the API being
 * reachable from itself.
 */

// ── Public base URL ──────────────────────────────────────────────────────────

/** Absolute origin the frontend uses to reach this API, without a trailing slash. */
function publicApiOrigin(): string {
  const configured = process.env.PUBLIC_API_URL || process.env.API_URL;
  if (configured?.trim()) return configured.trim().replace(/\/+$/, '');
  const port = process.env.PORT || '4000';
  return `http://localhost:${port}`;
}

const LOCAL_PREFIX = '/uploads/';

function isAbsoluteUrl(value: string): boolean {
  return /^https?:\/\//i.test(value);
}

/**
 * Normalize a media URL into the canonical stored form. Accepts anything a
 * client might send: a bare filename, "/uploads/x.jpg", or a fully-qualified URL
 * pointing at any host this API has ever been served from.
 *
 * The collapse of an absolute URL to a path is gated on `storageMode` because
 * an S3 object also lives under `/uploads/` — its key is `uploads/<file>`. In S3
 * mode `https://bucket.s3.../uploads/a.jpg` is already portable, and rewriting
 * it to `/uploads/a.jpg` would send every later read looking on the local disk.
 */
export function toStorageRef(input?: string | null): string | null {
  const value = input?.trim();
  if (!value) return null;

  if (isAbsoluteUrl(value)) {
    if (storageMode !== 'local') return value;
    let parsed: URL;
    try {
      parsed = new URL(value);
    } catch {
      return null;
    }
    // A local-storage URL from any origin collapses back to its host-free path.
    if (parsed.pathname.startsWith(LOCAL_PREFIX)) return parsed.pathname;
    return value;
  }

  if (value.startsWith(LOCAL_PREFIX)) return value;
  // A bare filename — assume it came from the local uploads dir.
  if (!value.includes('/')) return `${LOCAL_PREFIX}${value}`;
  return value;
}

/** Expand a stored ref into a URL a browser can fetch. */
export function resolveMediaUrl(ref?: string | null): string | null {
  const value = ref?.trim();
  if (!value) return null;
  if (isAbsoluteUrl(value)) return value;
  if (value.startsWith(LOCAL_PREFIX)) return `${publicApiOrigin()}${value}`;
  return value;
}

// ── Reading bytes ────────────────────────────────────────────────────────────

/**
 * Extension → MIME, mirroring the allowlist in api/routes/upload.routes.ts.
 * Uploads are always written with an extension derived from a validated MIME
 * type, so this reverse lookup is exact for anything we stored ourselves.
 */
const MIME_BY_EXTENSION: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.mp4': 'video/mp4',
  '.3gp': 'video/3gpp',
  '.mov': 'video/quicktime',
  '.mp3': 'audio/mpeg',
  '.ogg': 'audio/ogg',
  '.m4a': 'audio/mp4',
  '.aac': 'audio/aac',
  '.wav': 'audio/wav',
  '.webm': 'audio/webm',
  '.pdf': 'application/pdf',
  '.doc': 'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.xls': 'application/vnd.ms-excel',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.txt': 'text/plain',
  '.csv': 'text/csv',
};

/** Fallback MIME per broadcast/template media type. */
const MIME_BY_MEDIA_TYPE: Record<string, string> = {
  IMAGE: 'image/jpeg',
  VIDEO: 'video/mp4',
  DOCUMENT: 'application/octet-stream',
  AUDIO: 'audio/ogg',
  VOICE: 'audio/ogg',
};

/** A recorded voice note and a plain audio clip both ship as WhatsApp audio. */
export function isAudioMediaType(mediaType?: string | null): boolean {
  return mediaType === 'VOICE' || mediaType === 'AUDIO';
}

export interface LoadedMedia {
  buffer: Buffer;
  mimetype: string;
  filename?: string;
}

function mimeForRef(ref: string, mediaType?: string | null, headerMime?: string | null): string {
  // A browser-recorded .webm is served as video/webm by the static file server,
  // which would make the sender treat a voice note as a video. Force audio.
  if (isAudioMediaType(mediaType)) {
    return headerMime?.startsWith('audio/') ? headerMime : 'audio/ogg';
  }
  if (headerMime && headerMime !== 'application/octet-stream') return headerMime;

  const ext = path.extname(new URL(ref, 'http://x').pathname).toLowerCase();
  return (
    MIME_BY_EXTENSION[ext] ||
    (mediaType ? MIME_BY_MEDIA_TYPE[mediaType] : undefined) ||
    'application/octet-stream'
  );
}

/**
 * Read the bytes behind a stored ref. Local refs are read straight off disk —
 * no self-directed HTTP call, so a send can't fail because the API can't reach
 * its own public URL. Returns null when the attachment is gone, letting callers
 * decide whether to fall back or fail.
 */
export async function loadMedia(
  ref: string | null | undefined,
  mediaType?: string | null,
  filename?: string | null,
): Promise<LoadedMedia | null> {
  const storageRef = toStorageRef(ref);
  if (!storageRef) return null;

  try {
    if (!isAbsoluteUrl(storageRef) && storageRef.startsWith(LOCAL_PREFIX)) {
      // `basename` neutralizes any "../" a caller might have smuggled into the ref.
      const safeName = path.basename(storageRef);
      const filePath = path.join(LOCAL_UPLOADS_DIR, safeName);
      const buffer = await fs.readFile(filePath);
      return {
        buffer,
        mimetype: mimeForRef(storageRef, mediaType, null),
        filename: filename ?? undefined,
      };
    }

    const response = await fetch(storageRef);
    if (!response.ok) throw new Error(`status ${response.status}`);
    const buffer = Buffer.from(await response.arrayBuffer());
    const headerMime = response.headers.get('content-type')?.split(';')[0]?.trim() ?? null;
    return {
      buffer,
      mimetype: mimeForRef(storageRef, mediaType, headerMime),
      filename: filename ?? undefined,
    };
  } catch (error) {
    logger.warn('media.load_failed', {
      ref: storageRef,
      storageMode,
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}
