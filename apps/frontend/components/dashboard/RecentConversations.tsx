'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { api } from '../../lib/api';
import { formatPhone } from '../../lib/phone';
import { useSocket } from '../../hooks/useSocket';

interface Conversation {
  id: string;
  contact: {
    name: string | null;
    phone: string;
  };
  lastMessage: string | null;
  lastMessageAt: string | null;
}

export default function RecentConversations() {
  const [conversations, setConversations] = useState<Conversation[]>([]);

  const fetchConversations = useCallback(async () => {
    try {
      const data = await api.get('/api/conversations?limit=5');
      const list = Array.isArray(data) ? data : [];
      setConversations(list.slice(0, 5));
    } catch (error) {
      console.error('Failed to fetch conversations:', error);
      setConversations([]);
    }
  }, []);

  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  const onMessageNew = useCallback(
    ({ conversationId, message }: { conversationId: string; message: { body?: string; createdAt: string } }) => {
      setConversations((prev) => {
        const exists = prev.find((c) => c.id === conversationId);
        if (exists) {
          const updated = { ...exists, lastMessage: message.body ?? exists.lastMessage, lastMessageAt: message.createdAt };
          return [updated, ...prev.filter((c) => c.id !== conversationId)].slice(0, 5);
        }
        // New conversation not in list — fetch to get it
        fetchConversations();
        return prev;
      });
    },
    [fetchConversations],
  );

  const onConversationUpdated = useCallback(
    ({ conversationId, ...fields }: { conversationId: string; [key: string]: any }) => {
      setConversations((prev) =>
        prev.map((c) => c.id === conversationId ? { ...c, ...fields } : c),
      );
    },
    [],
  );

  useSocket('message:new', onMessageNew);
  useSocket('conversation:updated', onConversationUpdated);

  return (
    <div className="rounded-2xl border border-white/10 bg-[#111B21] p-6 shadow-[0_8px_20px_rgba(0,0,0,0.2)]">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-lg font-medium text-white">Recent Conversations</h3>
        <Link
          href="/conversations"
          className="text-sm text-[#25D366] transition hover:text-[#25D366]/80"
        >
          View all
        </Link>
      </div>
      <div className="space-y-4">
        {conversations.map((conv) => (
          <div key={conv.id} className="flex items-center space-x-3 rounded-xl px-3 py-3 transition hover:bg-white/5">
            <div className="flex-shrink-0">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-[#25D366]/20 to-[#128C7E]/20 text-white">
                <span className="text-sm font-medium">
                  {(conv.contact.name || formatPhone(conv.contact.phone)).charAt(0).toUpperCase()}
                </span>
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <p className="truncate text-sm font-medium text-white">
                {conv.contact.name || formatPhone(conv.contact.phone)}
              </p>
              <p className="truncate text-sm text-[#8696A0]">
                {conv.lastMessage || 'No messages yet'}
              </p>
            </div>
            <div className="text-xs text-[#8696A0]">
              {conv.lastMessageAt && new Date(conv.lastMessageAt).toLocaleTimeString()}
            </div>
          </div>
        ))}
        {conversations.length === 0 && (
          <p className="text-sm text-[#8696A0]">No conversations yet</p>
        )}
      </div>
    </div>
  );
}
