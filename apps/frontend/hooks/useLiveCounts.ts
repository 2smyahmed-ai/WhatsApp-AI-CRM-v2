'use client';

import { useState, useEffect, useCallback } from 'react';
import { api } from '../lib/api';
import { useSocket } from './useSocket';

export function useLiveCounts() {
  const [openConversations, setOpen] = useState(0);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    api.get('/api/analytics/overview')
      .then((data) => {
        if (typeof data?.openConversations === 'number') {
          setOpen(data.openConversations);
        }
      })
      .catch(() => {})
      .finally(() => setReady(true));
  }, []);

  const onConversationUpdated = useCallback((data: { status?: string }) => {
    if (!data.status) return;
    if (data.status === 'OPEN') setOpen((n) => n + 1);
    else setOpen((n) => Math.max(0, n - 1));
  }, []);

  useSocket('conversation:updated', onConversationUpdated);

  return { openConversations: ready ? openConversations : null };
}
