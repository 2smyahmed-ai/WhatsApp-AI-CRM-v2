'use client';

import { useCallback, useEffect, useState } from 'react';
import { api } from '../lib/api';
import { getSocket } from '../lib/socket';

/**
 * Live view of the global AI-bot master switch (`aiConfig.enabled`), the SAME
 * source the AI settings page reads/writes.
 *
 * - Reads the current state on mount via `GET /api/chatbot/status`.
 * - Stays in sync across tabs / with the settings page via the realtime
 *   `aiConfig:updated` event (broadcast whenever the config is saved).
 * - `toggle()` persists through `PUT /api/chatbot/ai-config`, the exact endpoint
 *   the settings page uses, so the header button and settings never drift.
 *
 * `enabled` is `null` until the first load resolves (used to show a neutral
 * state instead of a misleading "off").
 */
export function useGlobalBot() {
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const status = await api.get('/api/chatbot/status');
        if (!cancelled) setEnabled(Boolean(status?.customerBot?.enabled));
      } catch {
        /* leave as null — header shows a neutral, non-interactive state */
      }
    })();

    const socket = getSocket();
    const onUpdate = (data: { enabled?: boolean }) => {
      if (typeof data?.enabled === 'boolean') setEnabled(data.enabled);
    };
    socket.on('aiConfig:updated', onUpdate);

    return () => {
      cancelled = true;
      socket.off('aiConfig:updated', onUpdate);
    };
  }, []);

  const toggle = useCallback(async (next: boolean) => {
    setSaving(true);
    setEnabled(next); // optimistic
    try {
      const updated = await api.put('/api/chatbot/ai-config', { enabled: next });
      setEnabled(Boolean(updated?.enabled));
    } catch (err) {
      setEnabled(!next); // revert on failure (binary state)
      throw err;
    } finally {
      setSaving(false);
    }
  }, []);

  return { enabled, saving, toggle };
}
