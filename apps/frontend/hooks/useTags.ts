'use client';

import { useState, useEffect, useCallback } from 'react';
import { api } from '../lib/api';
import { useSocket } from './useSocket';

export interface Tag {
  id: string;
  name: string;
  color: string;
  _count?: { contacts: number };
}

/**
 * Shared live tag list. Fetches once and stays in sync via socket events.
 * Use this everywhere tags need to be shown — contacts filter, conversations
 * filter, broadcast audience selector, tag assignment dropdowns.
 */
export function useTags(): Tag[] {
  const [tags, setTags] = useState<Tag[]>([]);

  useEffect(() => {
    api
      .get('/api/tags')
      .then((d: unknown) => setTags(Array.isArray(d) ? (d as Tag[]) : []))
      .catch(() => {});
  }, []);

  useSocket(
    'tag:created',
    useCallback((t: Tag) => {
      setTags((prev) => (prev.find((x) => x.id === t.id) ? prev : [...prev, t]));
    }, []),
  );

  useSocket(
    'tag:updated',
    useCallback((t: Tag) => {
      setTags((prev) => prev.map((x) => (x.id === t.id ? { ...x, ...t } : x)));
    }, []),
  );

  useSocket(
    'tag:deleted',
    useCallback(({ tagId }: { tagId: string }) => {
      setTags((prev) => prev.filter((x) => x.id !== tagId));
    }, []),
  );

  return tags;
}
