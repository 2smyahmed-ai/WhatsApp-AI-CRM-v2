'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { api } from '../lib/api';
import { useSocket } from './useSocket';

/**
 * Live count of leads that need attention (for the sidebar badge). Seeds from
 * /api/leads/stats, then refetches (debounced) whenever a lead is re-qualified.
 */
export function useLeadAlerts() {
  const [needsAttention, setNeedsAttention] = useState<number | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const refetch = useCallback(() => {
    api.get('/api/leads/stats')
      .then((d) => setNeedsAttention(typeof d?.needsAttention === 'number' ? d.needsAttention : 0))
      .catch(() => {});
  }, []);

  useEffect(() => {
    refetch();
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [refetch]);

  const onLeadUpdated = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(refetch, 1500);
  }, [refetch]);

  useSocket('lead:updated', onLeadUpdated);

  return { needsAttention };
}
