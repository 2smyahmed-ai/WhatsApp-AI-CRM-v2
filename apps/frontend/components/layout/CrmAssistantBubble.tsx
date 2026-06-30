'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { usePathname } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useTranslation } from 'react-i18next';
import { api } from '../../lib/api';
import { useLanguage } from '../providers/I18nProvider';
import { useDirection } from '../../hooks/useDirection';
import { cn } from '@/lib/utils';
import {
  Bot,
  X,
  Send,
  Sparkles,
  Minimize2,
  ChevronDown,
} from 'lucide-react';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  ts: number;
  failed?: boolean;
}

const PAGE_CONTEXT_EN: Record<string, string> = {
  '/conversations': 'conversations inbox',
  '/contacts': 'contacts management',
  '/templates': 'message templates',
  '/templates/builder': 'template builder',
  '/broadcasts': 'broadcasts',
  '/broadcasts/new': 'new broadcast',
  '/automations': 'automations',
  '/deals': 'deals pipeline',
  '/tasks': 'tasks',
  '/dashboard': 'dashboard analytics',
  '/settings': 'settings',
  '/tags': 'tags management',
  '/saved-replies': 'saved replies',
  '/admin/users': 'admin users',
  '/admin/teams': 'admin teams',
  '/admin/chatbot': 'AI chatbot settings',
};

const PAGE_CONTEXT_AR: Record<string, string> = {
  '/conversations': 'صندوق المحادثات',
  '/contacts': 'جهات الاتصال',
  '/templates': 'قوالب الرسائل',
  '/templates/builder': 'منشئ القوالب',
  '/broadcasts': 'الحملات',
  '/broadcasts/new': 'حملة جديدة',
  '/automations': 'الأتمتة',
  '/deals': 'خط الصفقات',
  '/tasks': 'المهام',
  '/dashboard': 'لوحة التحليلات',
  '/settings': 'الإعدادات',
  '/tags': 'الوسوم',
  '/saved-replies': 'الردود المحفوظة',
  '/admin/users': 'إدارة المستخدمين',
  '/admin/teams': 'إدارة الفرق',
  '/admin/chatbot': 'إعدادات الذكاء الاصطناعي',
};

const SESSION_KEY = 'crm-assistant-history';

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function MarkdownText({ text }: { text: string }) {
  const lines = text.split('\n');
  return (
    <span className="block space-y-0.5">
      {lines.map((line, i) => {
        const isBullet = /^[-•*]\s/.test(line);
        const content = parseBold(isBullet ? line.replace(/^[-•*]\s/, '') : line);
        return (
          <span key={i} className={cn('block', isBullet && 'flex gap-1')}>
            {isBullet && <span className="mt-1 text-[#25D366] shrink-0">•</span>}
            <span>{content}</span>
          </span>
        );
      })}
    </span>
  );
}

function parseBold(text: string): React.ReactNode {
  const parts = text.split(/\*\*(.*?)\*\*/g);
  return parts.map((part, i) =>
    i % 2 === 1 ? (
      <strong key={i} className="font-semibold text-white">
        {part}
      </strong>
    ) : (
      part
    ),
  );
}

function TypingDots() {
  return (
    <div className="flex items-center gap-1 px-1 py-0.5">
      <span className="h-2 w-2 rounded-full bg-[#8696A0] animate-bounce [animation-delay:0ms] [animation-duration:900ms]" />
      <span className="h-2 w-2 rounded-full bg-[#8696A0] animate-bounce [animation-delay:150ms] [animation-duration:900ms]" />
      <span className="h-2 w-2 rounded-full bg-[#8696A0] animate-bounce [animation-delay:300ms] [animation-duration:900ms]" />
    </div>
  );
}

export default function CrmAssistantBubble() {
  const { data: session } = useSession();
  const pathname = usePathname();
  const { t } = useTranslation('chat');
  const { language } = useLanguage();
  const { isRTL } = useDirection();

  const [open, setOpen] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [enabled, setEnabled] = useState(true);
  const [hasChecked, setHasChecked] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Load persisted conversation
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(SESSION_KEY);
      if (saved) setMessages(JSON.parse(saved));
    } catch {}
  }, []);

  // Persist conversation
  useEffect(() => {
    if (messages.length === 0) return;
    try {
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(messages.slice(-30)));
    } catch {}
  }, [messages]);

  // Check if CRM assistant is enabled
  useEffect(() => {
    if (!session || hasChecked) return;
    setHasChecked(true);
    api
      .get('/api/chatbot/settings')
      .then((s: { crmAssistantEnabled?: boolean }) => {
        setEnabled(s.crmAssistantEnabled !== false);
      })
      .catch(() => setEnabled(true));
  }, [session, hasChecked]);

  // Scroll to bottom on new messages
  useEffect(() => {
    if (open && !minimized) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, open, minimized]);

  // Focus input when opened
  useEffect(() => {
    if (open && !minimized) {
      setTimeout(() => inputRef.current?.focus(), 80);
    }
  }, [open, minimized]);

  // Mobile header Bot button dispatches this event
  useEffect(() => {
    const handler = () => { setOpen((v) => !v); setMinimized(false); };
    document.addEventListener('toggle-crm-assistant', handler);
    return () => document.removeEventListener('toggle-crm-assistant', handler);
  }, []);

  const pageContextMap = language === 'ar' ? PAGE_CONTEXT_AR : PAGE_CONTEXT_EN;
  const currentPage = (() => {
    for (const [path, label] of Object.entries(pageContextMap)) {
      if (pathname?.startsWith(path)) return label;
    }
    return null;
  })();

  const quickPrompts = t('assistant.quickPrompts', { returnObjects: true }) as string[];

  const send = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || loading) return;
      setInput('');

      const userMsg: Message = { role: 'user', content: trimmed, ts: Date.now() };
      setMessages((prev) => [...prev, userMsg]);
      setLoading(true);

      const contextPrefix = currentPage
        ? language === 'ar'
          ? `[المستخدم الآن في: ${currentPage}]\n\n`
          : `[User is currently on: ${currentPage}]\n\n`
        : '';

      const history = [...messages, userMsg]
        .slice(-12)
        .map(({ role, content }) => ({ role, content }));

      try {
        const data = (await api.post('/api/chatbot/chat', {
          message: contextPrefix + trimmed,
          history: history.slice(0, -1),
          locale: language,
        })) as { reply: string; error?: string };

        setMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            content: data.reply ?? data.error ?? t('assistant.error.generic'),
            ts: Date.now(),
          },
        ]);
      } catch (err: unknown) {
        let msg = t('assistant.error.generic');
        if (err instanceof Error) {
          const status = (err as Error & { status?: number }).status;
          if (status === 503 || err.message.toLowerCase().includes('api key')) {
            msg = t('assistant.error.noApiKey');
          } else if (status === 404) {
            msg = t('assistant.error.notFound');
          } else {
            msg = err.message;
          }
        }
        setMessages((prev) => [
          ...prev,
          { role: 'assistant', content: msg, ts: Date.now(), failed: true },
        ]);
      } finally {
        setLoading(false);
      }
    },
    [loading, messages, currentPage, language, t],
  );

  const handleKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send(input);
    }
  };

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    e.target.style.height = 'auto';
    e.target.style.height = Math.min(e.target.scrollHeight, 96) + 'px';
  };

  const clearChat = () => {
    setMessages([]);
    try { sessionStorage.removeItem(SESSION_KEY); } catch {}
  };

  if (!session || !enabled) return null;

  return (
    <>
      {/* ── Chat panel ── */}
      <div
        dir={isRTL ? 'rtl' : 'ltr'}
        className={cn(
          'fixed z-50 flex flex-col overflow-hidden bg-[#111B21]',
          'border border-white/10',
          'shadow-[0_20px_60px_rgba(0,0,0,0.5)]',
          'transition-all duration-300 ease-out',
          /* mobile: full-screen sheet from top of header */
          'inset-x-0 bottom-0 top-[57px] rounded-none sm:inset-x-auto sm:bottom-20 sm:end-5 sm:top-auto sm:rounded-2xl',
          open
            ? minimized
              ? 'sm:h-14 sm:w-80 opacity-100'
              : 'sm:h-[540px] sm:w-80 opacity-100'
            : 'pointer-events-none opacity-0 sm:h-0 sm:w-80',
        )}
      >
        {/* ── Header ── */}
        <div className="flex shrink-0 items-center gap-2.5 border-b border-white/10 bg-[#202C33] px-4 py-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#25D366] to-[#128C7E] shadow-[0_2px_8px_rgba(37,211,102,0.3)]">
            <Sparkles className="h-4 w-4 text-white" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-white">{t('assistant.title')}</p>
            {currentPage && !minimized && (
              <p className="truncate text-[10px] text-[#8696A0]">
                {t('assistant.subtitle', { page: currentPage })}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={() => setMinimized((v) => !v)}
            className="rounded-lg p-1.5 text-[#8696A0] hover:bg-white/10 hover:text-white transition-colors"
            aria-label={minimized ? t('assistant.expand') : t('assistant.minimize')}
          >
            {minimized ? (
              <ChevronDown className="h-4 w-4 rotate-180" />
            ) : (
              <Minimize2 className="h-4 w-4" />
            )}
          </button>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="rounded-lg p-1.5 text-[#8696A0] hover:bg-white/10 hover:text-white transition-colors"
            aria-label={t('assistant.close')}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {!minimized && (
          <>
            {/* ── Messages ── */}
            <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-white/10">
              {messages.length === 0 ? (
                <div className="space-y-3 pt-1">
                  {/* Welcome */}
                  <div className="flex gap-2 items-start">
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#25D366]/20 mt-0.5">
                      <Sparkles className="h-3.5 w-3.5 text-[#25D366]" />
                    </div>
                    <div className="rounded-2xl rounded-ss-sm bg-[#202C33] px-3 py-2.5 text-xs leading-relaxed text-[#E9EDEF]">
                      {t('assistant.emptyHint')}
                    </div>
                  </div>

                  {/* Quick prompts */}
                  <div className="space-y-1.5 ps-9">
                    {Array.isArray(quickPrompts) &&
                      quickPrompts.map((p) => (
                        <button
                          key={p}
                          type="button"
                          onClick={() => send(p)}
                          className="w-full rounded-xl border border-white/10 bg-[#202C33] px-3 py-2 text-start text-[11px] text-[#8696A0] hover:border-[#25D366]/40 hover:bg-[#25D366]/10 hover:text-white transition-all"
                        >
                          {p}
                        </button>
                      ))}
                  </div>
                </div>
              ) : (
                <>
                  {messages.map((msg, idx) => {
                    const isUser = msg.role === 'user';
                    const prevSame = idx > 0 && messages[idx - 1].role === msg.role;

                    return (
                      <div
                        key={msg.ts}
                        className={cn(
                          'flex items-end gap-1.5',
                          isUser ? 'justify-end' : 'justify-start',
                          prevSame ? 'mt-0.5' : 'mt-2',
                        )}
                      >
                        {/* AI avatar */}
                        {!isUser && !prevSame && (
                          <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#25D366]/20 mb-0.5">
                            <Sparkles className="h-3 w-3 text-[#25D366]" />
                          </div>
                        )}
                        {!isUser && prevSame && <div className="w-6 shrink-0" />}

                        <div className="flex max-w-[78%] flex-col gap-0.5">
                          <div
                            dir="auto"
                            className={cn(
                              'rounded-2xl px-3 py-2 text-xs leading-relaxed',
                              isUser
                                ? 'rounded-ee-sm bg-[#005C4B] text-white'
                                : cn(
                                    'rounded-ss-sm bg-[#202C33] text-[#E9EDEF]',
                                    msg.failed && 'border border-red-500/30 bg-red-500/10',
                                  ),
                            )}
                          >
                            <MarkdownText text={msg.content} />
                          </div>
                          <span
                            dir="ltr"
                            className={cn(
                              'text-[9px] text-[#8696A0] px-1',
                              isUser ? 'text-end' : 'text-start',
                            )}
                          >
                            {formatTime(msg.ts)}
                          </span>
                        </div>
                      </div>
                    );
                  })}

                  {/* Typing indicator */}
                  {loading && (
                    <div className="flex items-end gap-1.5 mt-2">
                      <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#25D366]/20 mb-0.5">
                        <Sparkles className="h-3 w-3 text-[#25D366]" />
                      </div>
                      <div className="rounded-2xl rounded-ss-sm bg-[#202C33] px-3 py-2.5">
                        <TypingDots />
                      </div>
                    </div>
                  )}
                </>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* ── Input ── */}
            <div className="shrink-0 border-t border-white/10 bg-[#111B21] px-3 pb-3 pt-2">
              {messages.length > 0 && (
                <button
                  type="button"
                  onClick={clearChat}
                  className="mb-2 block text-[10px] text-[#8696A0] hover:text-white transition-colors"
                >
                  {t('assistant.clearChat')}
                </button>
              )}
              <div className="flex items-end gap-2 rounded-xl border border-white/10 bg-[#202C33] px-3 py-2 focus-within:border-[#25D366]/50 transition-colors">
                <textarea
                  ref={inputRef}
                  dir="auto"
                  value={input}
                  onChange={handleInput}
                  onKeyDown={handleKey}
                  placeholder={t('assistant.inputPlaceholder')}
                  disabled={loading}
                  rows={1}
                  className="flex-1 resize-none overflow-hidden max-h-24 bg-transparent text-xs text-white placeholder:text-[#8696A0] outline-none disabled:opacity-50 leading-relaxed"
                />
                <button
                  type="button"
                  onClick={() => send(input)}
                  disabled={!input.trim() || loading}
                  className={cn(
                    'flex h-7 w-7 shrink-0 items-center justify-center rounded-lg',
                    'bg-[#25D366] text-white transition-all hover:bg-[#128C7E]',
                    'disabled:opacity-40 disabled:cursor-not-allowed',
                  )}
                  aria-label={t('composer.sendMessage')}
                >
                  <Send className={cn('h-3.5 w-3.5', isRTL && 'scale-x-[-1]')} />
                </button>
              </div>
              <p className="mt-1.5 text-center text-[9px] text-[#8696A0]/60">
                {t('assistant.title')} · AI
              </p>
            </div>
          </>
        )}
      </div>

      {/* ── Floating button (desktop only — mobile uses header Bot icon) ── */}
      <button
        type="button"
        onClick={() => {
          setOpen((v) => !v);
          setMinimized(false);
        }}
        className={cn(
          'fixed bottom-5 end-5 z-50 hidden sm:flex h-14 w-14 items-center justify-center rounded-full',
          'bg-gradient-to-br from-[#25D366] to-[#128C7E] text-white',
          'shadow-[0_4px_20px_rgba(37,211,102,0.4)]',
          'transition-all duration-200 hover:scale-105 active:scale-95',
          open && 'shadow-[0_4px_20px_rgba(37,211,102,0.6)] scale-105',
        )}
        aria-label={t('assistant.toggle')}
      >
        <div className={cn('transition-transform duration-200', open && 'rotate-90')}>
          {open ? <X className="h-6 w-6" /> : <Bot className="h-6 w-6" />}
        </div>
        {/* Unread badge */}
        {!open && messages.length > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-white text-[9px] font-bold text-[#128C7E]">
            {messages.length > 9 ? '9+' : messages.length}
          </span>
        )}
      </button>
    </>
  );
}
