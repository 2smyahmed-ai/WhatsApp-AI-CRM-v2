'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import socket from '../lib/socket';
import { api } from '../lib/api';
import { useMessagingStore } from '../stores/messaging-store';

type ConnectionState = 'connected' | 'connecting' | 'disconnected';

interface SyncStatus {
  connection: ConnectionState;
  syncing: boolean;
  lastSynced: Date | null;
  sync: () => Promise<void>;
}

export function useSyncStatus(): SyncStatus {
  // Always start as 'connecting' so server and client first renders match.
  // A useEffect reads the real socket state after hydration.
  const [connection, setConnection] = useState<ConnectionState>('connecting');
  const [syncing, setSyncing] = useState(false);
  const [lastSynced, setLastSynced] = useState<Date | null>(null);
  const syncingRef = useRef(false);

  // Track socket connection state — runs only on the client, after hydration
  useEffect(() => {
    // Sync real state immediately
    setConnection(socket.connected ? 'connected' : 'connecting');

    const onConnect    = () => setConnection('connected');
    const onDisconnect = () => setConnection('disconnected');
    const onConnecting = () => setConnection('connecting');

    socket.on('connect',            onConnect);
    socket.on('disconnect',         onDisconnect);
    socket.on('reconnect_attempt',  onConnecting);
    socket.on('reconnect',          onConnect);

    return () => {
      socket.off('connect',           onConnect);
      socket.off('disconnect',        onDisconnect);
      socket.off('reconnect_attempt', onConnecting);
      socket.off('reconnect',         onConnect);
    };
  }, []);

  const sync = useCallback(async () => {
    if (syncingRef.current) return;
    syncingRef.current = true;
    setSyncing(true);

    try {
      // 1. Re-fetch conversations from API and re-seed the store
      const data = await api.get('/api/conversations');
      if (Array.isArray(data)) {
        useMessagingStore.getState().seedConversations(data);
      }

      // 2. Ask the socket server for any events we may have missed
      const lastSeq = useMessagingStore.getState().lastSeenSeq;
      if (socket.connected) {
        socket.emit('resync', { fromSeq: lastSeq, limit: 500 });
      } else {
        socket.connect();
      }

      setLastSynced(new Date());
    } catch {
      // silently fail — user can retry
    } finally {
      syncingRef.current = false;
      setSyncing(false);
    }
  }, []);

  // Auto-sync once shortly after mount so the header shows a real lastSynced
  // time. Deferred to idle: this fetches the FULL conversation list, and firing
  // it immediately on cold start competes with the visible screen's critical
  // requests. Real-time socket events cover the gap until it runs.
  useEffect(() => {
    const hasIdle = typeof window.requestIdleCallback === 'function';
    const id = hasIdle
      ? window.requestIdleCallback(() => { void sync(); }, { timeout: 4000 })
      : window.setTimeout(() => { void sync(); }, 2500);
    return () => {
      if (hasIdle) window.cancelIdleCallback(id);
      else window.clearTimeout(id);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { connection, syncing, lastSynced, sync };
}
