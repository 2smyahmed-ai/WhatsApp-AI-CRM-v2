'use client';

import { useState, useEffect, useCallback } from 'react';
import { api } from '../lib/api';
import { useSocket } from './useSocket';

export type NotificationType = 'BUYING_INTENT' | 'NEEDS_ATTENTION' | 'STATUS_UPGRADE';

export interface AppNotification {
  id: string;
  type: NotificationType;
  priority: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';
  title: { en: string; ar: string };
  body: { en: string; ar: string } | null;
  contactId: string | null;
  conversationId: string | null;
  isRead: boolean;
  createdAt: string;
}

/**
 * Loads the current user's notifications, keeps an unread counter, and live-
 * appends new ones pushed over the socket (`notification:new`, user-scoped).
 */
export function useNotifications() {
  const [items, setItems] = useState<AppNotification[]>([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(false);

  const refetch = useCallback(async () => {
    setLoading(true);
    try {
      const [list, count] = await Promise.all([
        api.get('/api/notifications?limit=30'),
        api.get('/api/notifications/unread-count'),
      ]);
      setItems(Array.isArray(list) ? list : []);
      setUnread(typeof count?.count === 'number' ? count.count : 0);
    } catch {
      /* keep prior state on failure */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refetch(); }, [refetch]);

  const onNew = useCallback((n: AppNotification) => {
    setItems((prev) => (prev.some((x) => x.id === n.id) ? prev : [n, ...prev].slice(0, 50)));
    setUnread((c) => c + 1);
  }, []);
  useSocket('notification:new', onNew);

  const markRead = useCallback(async (id: string) => {
    setItems((prev) => prev.map((x) => (x.id === id ? { ...x, isRead: true } : x)));
    setUnread((c) => Math.max(0, c - 1));
    try { await api.post(`/api/notifications/${id}/read`, {}); } catch { /* best-effort */ }
  }, []);

  const markAllRead = useCallback(async () => {
    setItems((prev) => prev.map((x) => ({ ...x, isRead: true })));
    setUnread(0);
    try { await api.post('/api/notifications/read-all', {}); } catch { /* best-effort */ }
  }, []);

  return { items, unread, loading, refetch, markRead, markAllRead };
}
