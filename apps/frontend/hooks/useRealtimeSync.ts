'use client';

import { useEffect, useRef } from 'react';
import socket from '../lib/socket';
import { useMessagingStore } from '../stores/messaging-store';
import type {
  RealtimeEvent,
  MessageCreatedPayload,
  MessageStatusChangedPayload,
  ConversationUpdatedPayload,
  PresenceTypingPayload,
  ResyncBatch,
} from '@crm/messaging-schema';

export function useRealtimeSync() {
  const lastSeenSeq = useMessagingStore(s => s.lastSeenSeq);
  const lastSeenRef = useRef(lastSeenSeq);
  lastSeenRef.current = lastSeenSeq;

  useEffect(() => {
    function applyEvent(event: RealtimeEvent) {
      const store = useMessagingStore.getState();

      // Idempotency guard: if seq is at or behind what we've seen, skip
      // (but process seq=0 which is used by legacy paths until fully migrated)
      if (event.seq > 0 && event.seq <= lastSeenRef.current) return;

      switch (event.type) {
        case 'message.created': {
          const { message } = event.payload as MessageCreatedPayload;
          if (message.clientId) {
            // Try to reconcile with an optimistic entry first
            store.reconcile(message.clientId, message);
          } else {
            store.upsertMessage(message);
          }
          // Update conversation summary
          store.patchConversation(message.conversationId, {
            lastMessageAt: message.timestamp,
            lastMessagePreview: message.renderable?.blocks
              ?.find(b => b.type === 'body_text' || b.type === 'media')
              ? undefined
              : undefined,
          });
          break;
        }

        case 'message.status_changed': {
          const p = event.payload as MessageStatusChangedPayload;
          store.updateStatus(p.messageId, p.conversationId, p.status, p.at);
          break;
        }

        case 'conversation.updated': {
          const p = event.payload as ConversationUpdatedPayload;
          store.patchConversation(p.conversationId, p.patch);
          break;
        }

        case 'presence.typing': {
          const p = event.payload as PresenceTypingPayload;
          if (p.state === 'start') {
            store.typingStart(p.conversationId, p.userId);
          } else {
            store.typingStop(p.conversationId, p.userId);
          }
          break;
        }

        default:
          break;
      }

      if (event.seq > 0) {
        store.setLastSeenSeq(event.seq);
      }
    }

    function handleCrmEvent(event: RealtimeEvent) {
      const store = useMessagingStore.getState();
      const expected = lastSeenRef.current + 1;

      // Gap detected — resync before applying
      if (event.seq > 0 && event.seq > expected) {
        socket.emit('resync', { fromSeq: lastSeenRef.current, limit: 200 });
        // Still apply the current event after resync arrives
      }

      applyEvent(event);
    }

    function handleResyncBatch(batch: ResyncBatch) {
      for (const event of batch.events) {
        applyEvent(event);
      }
    }

    // Legacy message:status events (Baileys path not yet on crm:event)
    function handleLegacyStatus(data: { messageId: string; conversationId: string; status: string }) {
      if (!data.messageId || !data.conversationId) return;
      const statusMap: Record<string, string> = {
        SENT: 'server_confirmed',
        DELIVERED: 'delivered',
        READ: 'read',
        FAILED: 'failed',
      };
      const mapped = statusMap[data.status?.toUpperCase()];
      if (!mapped) return;
      useMessagingStore.getState().updateStatus(
        data.messageId,
        data.conversationId,
        mapped as any,
        new Date().toISOString(),
      );
    }

    socket.on('crm:event', handleCrmEvent);
    socket.on('resync.batch', handleResyncBatch);
    socket.on('message:status', handleLegacyStatus);

    return () => {
      socket.off('crm:event', handleCrmEvent);
      socket.off('resync.batch', handleResyncBatch);
      socket.off('message:status', handleLegacyStatus);
    };
  }, []);
}
