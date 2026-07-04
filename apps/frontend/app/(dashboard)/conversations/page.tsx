'use client';

import { Suspense, useCallback, useEffect, useState, useRef } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
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
  const [contacts, setContacts] = useState<Contact[]>([]);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  // The open conversation lives in the URL (?c=<id>) so the browser Back/Forward
  // buttons work: opening a chat pushes a history entry, closing it pops back.
  const selectedConversationId = searchParams.get('c');
  const targetPhone = searchParams.get('phone');
  const targetConversationId = searchParams.get('conversationId');
  const conversationListRef = useRef<{ refetch: () => void } | null>(null);
  const setChatOpen = useChatOpen((s) => s.setOpen);
  // True once THIS visit opened a chat from the list (so we pushed a history
  // entry we can safely pop). Stays false when the user deep-linked straight
  // into a chat, so closing then reveals the list instead of leaving the app.
  const pushedFromListRef = useRef(false);

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

  // Build a /conversations URL with `c` set (and one-time deep-link params dropped).
  const buildUrl = useCallback(
    (conversationId: string | null) => {
      const params = new URLSearchParams(Array.from(searchParams.entries()));
      params.delete('phone');
      params.delete('conversationId');
      if (conversationId) params.set('c', conversationId);
      else params.delete('c');
      const qs = params.toString();
      return qs ? `${pathname}?${qs}` : pathname;
    },
    [pathname, searchParams],
  );

  // Select (or switch) the open conversation via the URL. Opening from the list
  // pushes a history entry; switching between chats replaces it, so Back always
  // returns to the list (not the previously-viewed chat) — like WhatsApp Web.
  const selectConversation = useCallback(
    (conversationId: string) => {
      if (!conversationId || conversationId === selectedConversationId) return;
      const url = buildUrl(conversationId);
      if (selectedConversationId) {
        router.replace(url, { scroll: false });
      } else {
        pushedFromListRef.current = true;
        router.push(url, { scroll: false });
      }
    },
    [router, buildUrl, selectedConversationId],
  );

  // Close the open conversation (mobile back arrow / conversation-not-found).
  const closeConversation = useCallback(() => {
    if (pushedFromListRef.current) {
      // Pop the entry we pushed — clean Back with no phantom forward entry.
      pushedFromListRef.current = false;
      router.back();
    } else {
      // Deep-linked straight into a chat: just drop `c` to reveal the list.
      router.replace(buildUrl(null), { scroll: false });
    }
  }, [router, buildUrl]);

  useEffect(() => {
    const resolveConversation = async () => {
      if (!targetPhone) return;
      try {
        const result = await api.get(`/api/conversations/by-phone/${encodeURIComponent(targetPhone)}`);
        if (result?.conversation?.id) {
          // Normalise ?phone=… into the canonical ?c=… (replace: no extra entry).
          router.replace(buildUrl(result.conversation.id), { scroll: false });
        }
      } catch (error) {
        console.error('Failed to resolve conversation from phone:', error);
      }
    };

    void resolveConversation();
  }, [targetPhone, router, buildUrl]);

  // Deep-link straight to a conversation by id (e.g. from a notification):
  // normalise ?conversationId=… into ?c=… without adding a history entry.
  useEffect(() => {
    if (targetConversationId) {
      router.replace(buildUrl(targetConversationId), { scroll: false });
    }
  }, [targetConversationId, router, buildUrl]);

  return (
    <div dir="ltr" className="absolute inset-0 flex sm:relative sm:inset-auto sm:mx-0 sm:my-0 sm:h-full overflow-hidden rounded-none sm:rounded-2xl border-0 sm:border border-gray-200 dark:border-white/10 bg-white dark:bg-[#111B21] shadow-card dark:shadow-[0_8px_20px_rgba(0,0,0,0.2)]">
      {/* Conversation list — full-width on mobile, hidden once a chat is open */}
      <div
        className={`${selectedConversationId ? 'hidden md:flex' : 'flex'} w-full md:w-[300px] lg:w-[340px] xl:w-[360px] shrink-0 flex-col border-r border-gray-200 dark:border-white/5 bg-gray-50 dark:bg-[#0B141A]`}
      >
        <ConversationList
          ref={conversationListRef}
          selectedId={selectedConversationId}
          onSelect={selectConversation}
        />
      </div>

      {/* Chat — full-width on mobile, shown only when a chat is selected */}
      <div className={`${selectedConversationId ? 'flex' : 'hidden md:flex'} min-w-0 flex-1`}>
        <ChatWindow
          conversationId={selectedConversationId}
          recipientContacts={contacts}
          onContactSaved={handleContactSaved}
          onBack={closeConversation}
          onConversationNotFound={() => {
            closeConversation();
            conversationListRef.current?.refetch?.();
          }}
        />
      </div>
      {/* Mobile bottom-nav spacer */}
      <div aria-hidden="true" className="h-[var(--bottom-nav-space)] sm:hidden" />
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
