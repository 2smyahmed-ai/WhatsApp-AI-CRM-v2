'use client';

import { Suspense, useCallback, useEffect, useState, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import ConversationList from '../../../components/conversations/ConversationList';
import ChatWindow from '../../../components/conversations/ChatWindow';
import { api } from '../../../lib/api';

interface Contact {
  id: string;
  name: string | null;
  phone: string;
}

function ConversationsPageContent() {
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const searchParams = useSearchParams();
  const targetPhone = searchParams.get('phone');
  const conversationListRef = useRef<{ refetch: () => void } | null>(null);

  const fetchContacts = useCallback(async () => {
    try {
      const data = await api.get('/api/contacts');
      setContacts(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Failed to fetch contacts:', error);
      setContacts([]);
    }
  }, []);

  const handleContactSaved = useCallback(() => {
    fetchContacts();
    conversationListRef.current?.refetch?.();
  }, [fetchContacts]);

  useEffect(() => {
    fetchContacts();
  }, [fetchContacts]);

  useEffect(() => {
    const resolveConversation = async () => {
      if (!targetPhone) return;
      try {
        const result = await api.get(`/api/conversations/by-phone/${encodeURIComponent(targetPhone)}`);
        if (result?.conversation?.id) {
          setSelectedConversationId(result.conversation.id);
        }
      } catch (error) {
        console.error('Failed to resolve conversation from phone:', error);
      }
    };

    void resolveConversation();
  }, [targetPhone]);

  return (
    <div className="flex h-[calc(100vh-9rem)] min-h-[680px] overflow-hidden rounded-2xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#111B21] shadow-card dark:shadow-[0_8px_20px_rgba(0,0,0,0.2)]">
      <div className="w-[360px] shrink-0 border-r border-gray-200 dark:border-white/5 bg-gray-50 dark:bg-[#0B141A]">
        <ConversationList
          ref={conversationListRef}
          selectedId={selectedConversationId}
          onSelect={setSelectedConversationId}
        />
      </div>
      <div className="flex-1">
        <ChatWindow
          conversationId={selectedConversationId}
          recipientContacts={contacts}
          onContactSaved={handleContactSaved}
          onConversationNotFound={() => {
            setSelectedConversationId(null);
            conversationListRef.current?.refetch?.();
          }}
        />
      </div>
    </div>
  );
}

export default function ConversationsPage() {
  return (
    <Suspense fallback={<div className="rounded-2xl border border-white/10 bg-[#111B21]/50 p-6 text-[#8696A0]">Loading conversations...</div>}>
      <ConversationsPageContent />
    </Suspense>
  );
}
