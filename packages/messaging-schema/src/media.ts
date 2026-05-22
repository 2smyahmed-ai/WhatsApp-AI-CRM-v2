/**
 * The class of attachment. Distinct from MIME — a `voice` is `audio/ogg` with
 * `isVoiceNote=true` semantics; a `sticker` is `image/webp` with sticker semantics.
 */
export type MediaType =
  | 'image'
  | 'video'
  | 'audio'
  | 'voice'
  | 'document'
  | 'sticker';

export const MEDIA_TYPES = [
  'image',
  'video',
  'audio',
  'voice',
  'document',
  'sticker',
] as const;

/**
 * Canonical media attachment. Used inside MessageContent (kind=media) and inside
 * RenderableBlock (type=header_media, media, etc.).
 *
 * `url` is populated once the binary has been downloaded and stored locally /
 * uploaded to CDN. `providerMediaId` is the upstream reference (Meta media ID,
 * Baileys directPath) which may be needed for re-download or for re-using on send.
 */
export interface Media {
  /** Semantic class of attachment. */
  mediaType: MediaType;

  /** Full MIME type, e.g. "image/jpeg". */
  mime: string;

  /** Resolved URL once downloaded. Null while pending. */
  url: string | null;

  /** Provider-side ID for re-download / reuse. Null if not applicable. */
  providerMediaId: string | null;

  /** Original filename for documents. Null if unknown. */
  fileName: string | null;

  /** Size in bytes. Null if unknown. */
  sizeBytes: number | null;

  /** Duration in seconds for audio/video. */
  durationSec: number | null;

  /** Pixel dimensions for image/video. */
  width: number | null;
  height: number | null;

  /** Thumbnail / poster URL. */
  thumbnailUrl: string | null;
}
