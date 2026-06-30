'use client';

import { Suspense, useCallback, useEffect, useState, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import ConversationList from '../../../components/conversations/ConversationList';
import ChatWindow from '../../../components/conversations/ChatWindow';
import { api } from '../../../lib/api';
import { useTranslation } from 'react-i18next';
import { useChatOpen } from '../../../stores/chat-open-store';

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
  const targetConversationId = searchParams.get('conversationId');
  const conversationListRef = useRef<{ refetch: () => void } | null>(null);
  const setChatOpen = useChatOpen((s) => s.setOpen);

  useEffect(() => {
    setChatOpen(!!selectedConversationId);
    return () => setChatOpen(false);
  }, [selectedConversationId, setChatOpen]);

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

  // Deep-link straight to a conversation by id (e.g. from a notification).
  useEffect(() => {
    if (targetConversationId) setSelectedConversationId(targetConversationId);
  }, [targetConversationId]);

  return (
    <div dir="ltr" className="absolute inset-0 flex sm:relative sm:inset-auto sm:mx-0 sm:my-0 sm:h-full overflow-hidden rounded-none sm:rounded-2xl border-0 sm:border border-gray-200 dark:border-white/10 bg-white dark:bg-[#111B21] shadow-card dark:shadow-[0_8px_20px_rgba(0,0,0,0.2)]">
      {/* Conversation list — full-width on mobile, hidden once a chat is open */}
      <div
        className={`${selectedConversationId ? 'hidden md:flex' : 'flex'} w-full md:w-[300px] lg:w-[340px] xl:w-[360px] shrink-0 flex-col border-r border-gray-200 dark:border-white/5 bg-gray-50 dark:bg-[#0B141A]`}
      >
        <ConversationList
          ref={conversationListRef}
          selectedId={selectedConversationId}
          onSelect={setSelectedConversationId}
        />
      </div>

      {/* Chat — full-width on mobile, shown only when a chat is selected */}
      <div className={`${selectedConversationId ? 'flex' : 'hidden md:flex'} min-w-0 flex-1`}>
        <ChatWindow
          conversationId={selectedConversationId}
          recipientContacts={contacts}
          onContactSaved={handleContactSaved}
          onBack={() => setSelectedConversationId(null)}
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
  const { t } = useTranslation('common');
  return (
    <Suspense fallback={<div className="rounded-2xl border border-white/10 bg-[#111B21]/50 p-6 text-[#8696A0]">{t('loading')}</div>}>
      <ConversationsPageContent />
    </Suspense>
  );
}
