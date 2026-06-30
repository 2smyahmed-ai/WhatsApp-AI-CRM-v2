'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { getSocket } from '../../lib/socket';
import {
  playNotificationSound,
  showBrowserNotification,
  requestNotificationPermission,
  primeNotificationSound,
} from '../../lib/notifications';
import { useToastStore } from '../../hooks/useToast';
import { useChatUnread } from '../../stores/chat-unread-store';
import { formatPhone } from '../../lib/phone';

/**
 * Mounted once in the dashboard layout. The single hub for new-message alerts:
 * in-app toast + sound + browser notification + unread badge, driven by the
 * realtime `message:new` event. Runs in every tab, so all tabs stay in sync.
 *
 * Suppression: while the user is actively looking at the inbox (on
 * /conversations with the tab focused) we stay quiet — the conversation list
 * already shows the message live — and we keep the unread badge cleared.
 */
export default function NotificationProvider() {
  const pathname = usePathname();
  const pathRef = useRef(pathname);
  pathRef.current = pathname;
  const lastNotifiedRef = useRef<{ id: string; at: number } | null>(null);

  // Clear the unread badge whenever the user opens the inbox.
  useEffect(() => {
    if (pathname?.startsWith('/conversations')) {
      useChatUnread.getState().reset();
    }
  }, [pathname]);

  useEffect(() => {
    requestNotificationPermission();
    primeNotificationSound();

    const socket = getSocket();

    function onNewMessage(data: {
      conversationId: string;
      message?: {
        id?: string;
        direction?: string;
        body?: string;
        fromMe?: boolean;
        senderName?: string | null;
        phone?: string | null;
        from?: string | null;
      };
      contactName?: string;
    }) {
      const msg = data.message;
      if (!msg) return;
      // Inbound only.
      if (msg.fromMe) return;
      if (msg.direction && msg.direction.toUpperCase() === 'OUTBOUND') return;

      // De-dupe: the same message can arrive via more than one emit path.
      const msgId = msg.id || `${data.conversationId}:${msg.body}`;
      const now = Date.now();
      if (lastNotifiedRef.current && lastNotifiedRef.current.id === msgId && now - lastNotifiedRef.current.at < 4000) {
        return;
      }
      lastNotifiedRef.current = { id: msgId, at: now };

      const focused = typeof document !== 'undefined' && document.hasFocus();
      const inInbox = !!pathRef.current?.startsWith('/conversations');
      // Actively watching the inbox → the list already reflects it; stay quiet.
      const suppressInApp = inInbox && focused;

      const name =
        data.contactName ||
        msg.senderName ||
        (msg.phone || msg.from ? formatPhone(msg.phone || msg.from || '') : '') ||
        'New message';
      const body = msg.body || 'Sent a message';
      const href = `/conversations?conversationId=${encodeURIComponent(data.conversationId)}`;

      if (!suppressInApp) {
        useChatUnread.getState().bump();
        playNotificationSound();
        useToastStore.getState().add(body, 'message', { title: name, href });
      }

      // Browser notification only fires when the tab is unfocused (handled inside).
      showBrowserNotification(name, body, { tag: `conv-${data.conversationId}`, href });
    }

    socket.on('message:new', onNewMessage);
    return () => { socket.off('message:new', onNewMessage); };
  }, []);

  return null;
}
