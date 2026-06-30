'use client';

import { useEffect, useState } from 'react';
import { UserRound } from 'lucide-react';
import { api } from '@/lib/api';

interface AvatarProps {
  src?: string | null;
  name?: string | null;
  size?: number;
  className?: string;
  /** When provided, a failed avatar load silently clears the stale URL from the DB. */
  contactId?: string | null;
}

export default function Avatar({ src, name, size = 40, className = '', contactId }: AvatarProps) {
  const [objectUrl, setObjectUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!src) { setObjectUrl(null); return; }

    let revoked = false;
    let blobUrl: string | null = null;

    // Use fetch instead of <img src> so CDN 404s don't appear in the browser console.
    fetch(src)
      .then((r) => {
        if (!r.ok) throw new Error('avatar_load_failed');
        return r.blob();
      })
      .then((blob) => {
        blobUrl = URL.createObjectURL(blob);
        if (!revoked) setObjectUrl(blobUrl);
      })
      .catch(() => {
        if (!revoked) setObjectUrl(null);
        // Clear the stale URL from DB so it's not retried next session.
        if (contactId) api.delete(`/api/contacts/${contactId}/avatar`).catch(() => {});
      });

    return () => {
      revoked = true;
      if (blobUrl) URL.revokeObjectURL(blobUrl);
    };
  }, [src, contactId]);

  const trimmed = name?.trim() ?? '';
  const isPhone = trimmed.startsWith('+') || (!trimmed && !name);
  const initial = isPhone ? null : (trimmed.charAt(0) || null);

  return (
    <div
      className={`relative flex shrink-0 items-center justify-center overflow-hidden rounded-full font-semibold text-white bg-gradient-to-br from-[#25D366] to-[#128C7E] ${className}`}
      style={{ width: size, height: size, fontSize: Math.max(11, Math.round(size * 0.4)) }}
    >
      {initial
        ? <span aria-hidden={!!objectUrl}>{initial.toUpperCase()}</span>
        : <UserRound aria-hidden="true" style={{ width: Math.round(size * 0.5), height: Math.round(size * 0.5) }} />}
      {objectUrl && (
        <img
          src={objectUrl}
          alt={name || ''}
          className="absolute inset-0 h-full w-full object-cover"
          loading="lazy"
        />
      )}
    </div>
  );
}
