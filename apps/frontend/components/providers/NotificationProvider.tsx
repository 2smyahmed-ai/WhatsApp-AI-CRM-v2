'use client';

import { useEffect, useRef } from 'react';
import { getSocket } from '../../lib/socket';
import { notifyNewMessage, requestNotificationPermission } from '../../lib/notifications';

/**
 * Mounts once in the dashboard layout.
 * Requests notification permission and listens for inbound messages.
 */
export default function NotificationProvider() {
  const permissionRequested = useRef(false);

  useEffect(() => {
    // Request permission on first user interaction to satisfy browser policy
    if (!permissionRequested.current) {
      permissionRequested.current = true;
      requestNotificationPermission();
    }

    const socket = getSocket();

    function onNewMessage(data: {
      conversationId: string;
      message: {
        direction?: string;
        body?: string;
        fromMe?: boolean;
      };
      contactName?: string;
    }) {
      // Only notify for inbound messages
      if (data.message?.fromMe) return;
      if (data.message?.direction === 'OUTBOUND') return;

      const name = data.contactName || 'Unknown';
      const body = data.message?.body || '';
      notifyNewMessage(name, body, data.conversationId);
    }

    socket.on('message:new', onNewMessage);
    return () => { socket.off('message:new', onNewMessage); };
  }, []);

  return null;
}
