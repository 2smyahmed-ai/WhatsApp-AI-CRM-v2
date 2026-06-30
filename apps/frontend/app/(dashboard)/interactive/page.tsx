'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { useTranslation } from 'react-i18next';
import {
  Search, Plus, X, Send, Zap, MessageCircle,
  ChevronDown, ChevronUp, Users, AtSign,
} from 'lucide-react';
import { api } from '../../../lib/api';
import { formatPhone } from '../../../lib/phone';

// ── Types ─────────────────────────────────────────────────────────────────────

interface ConversationEntry {
  id: string;
  contact: { id: string; name: string | null; phone: string } | null;
  lastMessage?: string | null;
}

interface ButtonDraft {
  localId: string;
  title: string;
}

interface Draft {
  body: string;
  header: string;
  showHeader: boolean;
  footer: string;
  showFooter: boolean;
  buttons: ButtonDraft[];
}

const EMPTY_DRAFT: Draft = {
  body: '',
  header: '',
  showHeader: false,
  footer: '',
  showFooter: false,
  buttons: [],
};

function makeBtnId() {
  return `btn_${Math.random().toString(36).slice(2, 7)}`;
}

// ── Variable helpers ──────────────────────────────────────────────────────────

const VARIABLES = [
  { token: '{{name}}',  label: 'Name',  example: 'John Doe' },
  { token: '{{phone}}', label: 'Phone', example: '+966501234567' },
] as const;

function resolveVars(text: string, name: string, phone: string): string {
  return text.replace(/\{\{name\}\}/g, name).replace(/\{\{phone\}\}/g, phone);
}

// ── Build content ─────────────────────────────────────────────────────────────

function buildContent(draft: Draft) {
  return {
    kind: 'interactive_buttons' as const,
    body: draft.body.trim(),
    ...(draft.showHeader && draft.header.trim()
      ? { header: { type: 'text' as const, text: draft.header.trim() } }
      : {}),
    ...(draft.showFooter && draft.footer.trim() ? { footer: draft.footer.trim() } : {}),
    buttons: draft.buttons
      .filter(b => b.title.trim())
      .map((b, i) => ({ id: `btn_${i + 1}`, title: b.title.trim() })),
  };
}

// ── Variable chip row ─────────────────────────────────────────────────────────

function VarChips({ onInsert, label }: { onInsert: (token: string) => void; label: string }) {
  return (
    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
      <span className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-gray-500 dark:text-[#8696A0]/70">
        <AtSign className="h-3 w-3" />
        {label}
      </span>
      {VARIABLES.map(v => (
        <button
          key={v.token}
          type="button"
          onClick={() => onInsert(v.token)}
          className="rounded-full border border-[#25D366]/30 bg-[#25D366]/10 px-2.5 py-0.5 font-mono text-[11px] font-semibold text-[#25D366] transition-colors hover:bg-[#25D366]/20"
        >
          {v.token}
        </button>
      ))}
    </div>
  );
}

// ── WhatsApp text renderer (supports *bold*, _italic_, ~strikethrough~) ────────

function WaText({ text }: { text: string }) {
  const html = text
    .replace(/\*(.*?)\*/g, '<strong>$1</strong>')
    .replace(/_(.*?)_/g, '<em>$1</em>')
    .replace(/~(.*?)~/g, '<s>$1</s>')
    .replace(/\n/g, '<br />');
  return <span dangerouslySetInnerHTML={{ __html: html }} className="whitespace-pre-wrap break-words" />;
}

// ── Professional WhatsApp bubble preview ──────────────────────────────────────

function BubblePreview({
  draft,
  sampleName,
  samplePhone,
  previewTypingLabel,
  previewingLabel,
}: {
  draft: Draft;
  sampleName: string;
  samplePhone: string;
  previewTypingLabel: string;
  previewingLabel: string;
}) {
  const resolve = (t: string) => resolveVars(t, sampleName, samplePhone);

  const body = resolve(draft.body.trim());
  const header = draft.showHeader ? resolve(draft.header.trim()) : '';
  const footer = draft.showFooter ? resolve(draft.footer.trim()) : '';
  const buttons = draft.buttons.filter(b => b.title.trim());
  const isEmpty = !body && !header && buttons.length === 0;

  return (
    <div className="flex flex-col h-full">
      {/* Header bar — matches template builder style */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-white/10 bg-[#202C33] flex-shrink-0">
        <div className="h-7 w-7 rounded-full bg-[#25D366]/20 flex items-center justify-center text-xs">💬</div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-white">WhatsApp Preview</p>
          <p className="text-[10px] text-white/40">Renders the exact compiled payload</p>
        </div>
        <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium bg-green-500/20 text-green-300">
          📱 Baileys
        </span>
      </div>

      {/* Bubble area */}
      <div
        className="flex-1 overflow-y-auto p-4 bg-[#0B141A] bg-[radial-gradient(circle_at_1px_1px,rgba(255,255,255,0.025)_1px,transparent_0)] [background-size:18px_18px]"
      >
        {isEmpty ? (
          <div className="flex flex-col items-center justify-center h-full text-white/20 text-sm text-center gap-2">
            <MessageCircle className="h-8 w-8" />
            <p>{previewTypingLabel}</p>
          </div>
        ) : (
          <div className="flex flex-col items-end">
            {sampleName !== VARIABLES[0].example && (
              <p className="text-[10px] mb-2 text-white/40">
                {previewingLabel} <span className="text-white/70">{sampleName}</span>
                {' · '}
                <span className="text-white/70">{samplePhone}</span>
              </p>
            )}
            <div className="max-w-[90%] min-w-[160px] rounded-2xl rounded-tr-sm bg-[#005C4B] text-white shadow-lg overflow-hidden">
              {/* Header */}
              {header && (
                <div className="border-b border-white/10 px-3 pt-2.5 pb-2 font-bold text-sm">
                  <WaText text={header} />
                </div>
              )}
              {/* Body */}
              {body && (
                <div className="px-3 pt-2.5 pb-1 text-sm">
                  <WaText text={body} />
                </div>
              )}
              {/* Footer */}
              {footer && (
                <div className="px-3 pb-1 text-[11px] text-white/50">
                  {footer}
                </div>
              )}
              {/* Timestamp */}
              <div className="flex items-center justify-end gap-1 px-3 pb-1.5">
                <span className="text-[10px] text-white/40">now</span>
                <span className="text-[10px] text-[#53BDEB]">✓✓</span>
              </div>
              {/* Buttons — inside the bubble, WhatsApp-native style */}
              {buttons.length > 0 && (
                <div className="border-t border-white/20">
                  {buttons.map((b, i) => (
                    <div
                      key={b.localId}
                      className={`px-3 py-2.5 text-center text-sm font-semibold text-[#53BDEB] ${
                        i > 0 ? 'border-t border-white/10' : ''
                      }`}
                    >
                      {b.title.trim()}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Contact row ───────────────────────────────────────────────────────────────

function ContactRow({
  conv,
  checked,
  onToggle,
}: {
  conv: ConversationEntry;
  checked: boolean;
  onToggle: () => void;
}) {
  const name = conv.contact?.name || formatPhone(conv.contact?.phone ?? '') || 'Unknown';
  const phone = conv.contact?.phone ? formatPhone(conv.contact.phone) : '';
  const initials = name.slice(0, 2).toUpperCase();

  return (
    <button
      type="button"
      onClick={onToggle}
      className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-all ${
        checked ? 'bg-[#25D366]/12' : 'hover:bg-gray-50 dark:hover:bg-white/5'
      }`}
    >
      <div
        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 transition-all ${
          checked ? 'border-[#25D366] bg-[#25D366]' : 'border-gray-300 dark:border-white/30 bg-transparent'
        }`}
      >
        {checked && (
          <svg viewBox="0 0 12 10" className="h-3 w-3" aria-hidden>
            <path d="M1 5l3 3 7-7" stroke="white" strokeWidth="2" fill="none" strokeLinecap="round" />
          </svg>
        )}
      </div>

      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#25D366] to-[#128C7E] text-xs font-semibold text-white">
        {initials}
      </div>

      <div className="min-w-0 flex-1">
        <p className={`truncate text-sm font-medium ${checked ? 'text-white' : 'text-gray-900 dark:text-[#E9EDEF]'}`}>
          <bdi>{name}</bdi>
        </p>
        {phone && <p className="truncate text-xs text-gray-500 dark:text-[#8696A0]"><bdi>{phone}</bdi></p>}
      </div>
    </button>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function InteractivePage() {
  const { t } = useTranslation(['chat', 'common']);
  const { status } = useSession();
  const [conversations, setConversations] = useState<ConversationEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ ok: number; fail: number } | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [mobileTab, setMobileTab] = useState<'contacts' | 'build' | 'preview'>('build');

  // Refs for cursor-position variable insertion
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const headerRef = useRef<HTMLInputElement>(null);

  // ── Fetch conversations (wait for authenticated session to avoid 401) ─────

  useEffect(() => {
    if (status !== 'authenticated') return;
    let cancelled = false;
    (async () => {
      try {
        const data = await api.get('/api/conversations');
        if (!cancelled) {
          const list: ConversationEntry[] = Array.isArray(data)
            ? data
            : Array.isArray(data?.conversations)
            ? data.conversations
            : [];
          setConversations(list);
        }
      } catch {
        // silently fail
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [status]);

  // ── Variable insertion ────────────────────────────────────────────────────

  function insertVariable(field: 'body' | 'header', token: string) {
    const el = field === 'body' ? bodyRef.current : headerRef.current;
    const currentVal = field === 'body' ? draft.body : draft.header;
    const start = el?.selectionStart ?? currentVal.length;
    const end = el?.selectionEnd ?? currentVal.length;
    const newVal = currentVal.slice(0, start) + token + currentVal.slice(end);

    setDraft(d => ({ ...d, [field]: newVal }));

    // Restore cursor after re-render
    requestAnimationFrame(() => {
      if (!el) return;
      el.focus();
      const cursor = start + token.length;
      el.setSelectionRange(cursor, cursor);
    });
  }

  // ── Contact helpers ───────────────────────────────────────────────────────

  const toggleContact = useCallback((id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const addButton = () => {
    if (draft.buttons.length >= 3) return;
    setDraft(d => ({ ...d, buttons: [...d.buttons, { localId: makeBtnId(), title: '' }] }));
  };

  const removeButton = (localId: string) => {
    setDraft(d => ({ ...d, buttons: d.buttons.filter(b => b.localId !== localId) }));
  };

  const updateButton = (localId: string, title: string) => {
    setDraft(d => ({
      ...d,
      buttons: d.buttons.map(b => b.localId === localId ? { ...b, title } : b),
    }));
  };

  // ── Send ──────────────────────────────────────────────────────────────────

  const handleSend = useCallback(async () => {
    if (selected.size === 0 || !draft.body.trim() || sending) return;
    setSending(true);
    setResult(null);

    // Resolve variables per-contact and send individually
    const selectedConvs = conversations.filter(c => selected.has(c.id));

    const outcomes = await Promise.allSettled(
      selectedConvs.map(conv => {
        const name = conv.contact?.name || formatPhone(conv.contact?.phone ?? '') || '';
        const phone = conv.contact?.phone ? formatPhone(conv.contact.phone) : '';
        const resolved = buildContent({
          ...draft,
          body: resolveVars(draft.body, name, phone),
          header: resolveVars(draft.header, name, phone),
          footer: resolveVars(draft.footer, name, phone),
        });
        return api.post(`/api/conversations/${conv.id}/interactive`, {
          content: resolved,
          clientId: `client-${Date.now()}-${conv.id}`,
        });
      }),
    );

    const ok = outcomes.filter(r => r.status === 'fulfilled').length;
    const fail = outcomes.filter(r => r.status === 'rejected').length;

    setResult({ ok, fail });
    setSending(false);
    if (ok > 0) {
      setSelected(new Set());
      setDraft(EMPTY_DRAFT);
    }
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setResult(null), 5000);
  }, [selected, draft, sending, conversations]);

  // ── Preview sample values (first selected contact, else placeholder) ──────

  const firstSelected = conversations.find(c => selected.has(c.id));
  const previewName = firstSelected?.contact?.name || VARIABLES[0].example;
  const previewPhone = firstSelected?.contact?.phone
    ? formatPhone(firstSelected.contact.phone)
    : VARIABLES[1].example;

  // ── Filter ────────────────────────────────────────────────────────────────

  const filtered = conversations.filter(c => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      (c.contact?.name ?? '').toLowerCase().includes(q) ||
      (c.contact?.phone ?? '').includes(q)
    );
  });

  const allVisibleChecked = filtered.length > 0 && filtered.every(c => selected.has(c.id));
  const someVisibleChecked = filtered.some(c => selected.has(c.id));
  const canSend = selected.size > 0 && draft.body.trim().length > 0;

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <>
    {/* ── Mobile layout (below sm) ─────────────────────────────────────────── */}
    <div className="flex flex-col sm:hidden rounded-2xl overflow-hidden bg-white dark:bg-[#182229] shadow-[0_4px_24px_rgba(0,0,0,0.12)] dark:shadow-[0_4px_24px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.05)]">

      {/* Mobile tab bar — violet accent header */}
      <div className="flex bg-gradient-to-r from-[#6d28d9] to-[#7c3aed] dark:from-[#3b1a6b] dark:to-[#4a1d8a] flex-shrink-0">
        <button
          type="button"
          onClick={() => setMobileTab('contacts')}
          className={`flex-1 flex items-center justify-center gap-1 py-3 text-[11px] font-semibold border-b-2 transition-colors ${
            mobileTab === 'contacts'
              ? 'border-white text-white'
              : 'border-transparent text-white/50'
          }`}
        >
          {t('interactive.selectRecipients', { defaultValue: 'Recipients' })}
          {selected.size > 0 && (
            <span className="flex h-4 min-w-[16px] items-center justify-center rounded-full bg-white/25 px-1 text-[9px] font-bold text-white">
              {selected.size}
            </span>
          )}
        </button>
        <button
          type="button"
          onClick={() => setMobileTab('build')}
          className={`flex-1 py-3 text-[11px] font-semibold border-b-2 transition-colors ${
            mobileTab === 'build'
              ? 'border-white text-white'
              : 'border-transparent text-white/50'
          }`}
        >
          {t('interactive.buildMessage', { defaultValue: 'Compose' })}
        </button>
        <button
          type="button"
          onClick={() => setMobileTab('preview')}
          className={`flex-1 py-3 text-[11px] font-semibold border-b-2 transition-colors ${
            mobileTab === 'preview'
              ? 'border-white text-white'
              : 'border-transparent text-white/50'
          }`}
        >
          Preview
        </button>
      </div>

      {/* ── Mobile: Contacts tab ── */}
      {mobileTab === 'contacts' && (
        <div className="flex flex-col overflow-hidden h-[65vh]">
          <div className="border-b border-gray-200 px-4 py-3 dark:border-white/[0.04] flex-shrink-0">
            <div className="flex items-center gap-2.5">
              <Users className="h-4 w-4 text-[#25D366]" />
              <h2 className="text-sm font-semibold text-gray-900 dark:text-white">{t('interactive.selectRecipients')}</h2>
              {selected.size > 0 && (
                <span className="ml-auto flex h-5 min-w-[20px] items-center justify-center rounded-full bg-[#25D366] px-1.5 text-[10px] font-bold text-white">
                  {selected.size}
                </span>
              )}
            </div>
          </div>
          <div className="px-3 py-2 flex-shrink-0">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#8696A0]" />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder={t('interactive.searchContacts')}
                className="w-full rounded-xl border border-gray-200 bg-white py-1.5 pl-8 pr-3 text-sm text-gray-900 placeholder:text-gray-400 focus:border-[#16A34A]/50 focus:outline-none transition-colors dark:border-white/10 dark:bg-[#111B21] dark:text-white dark:placeholder:text-[#8696A0] dark:focus:border-[#25D366]/50"
              />
            </div>
          </div>
          {filtered.length > 0 && (
            <div className="border-b border-gray-200 px-3 pb-2 dark:border-white/[0.04] flex-shrink-0">
              <button
                type="button"
                onClick={() => {
                  const visible = filtered.map(c => c.id);
                  const allChecked = visible.every(id => selected.has(id));
                  setSelected(prev => {
                    const next = new Set(prev);
                    if (allChecked) visible.forEach(id => next.delete(id));
                    else visible.forEach(id => next.add(id));
                    return next;
                  });
                }}
                className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-xs font-medium text-gray-500 hover:bg-gray-50 hover:text-gray-900 transition-colors dark:text-[#8696A0] dark:hover:bg-white/5 dark:hover:text-white"
              >
                <div className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-all ${
                  allVisibleChecked ? 'border-[#25D366] bg-[#25D366]' : someVisibleChecked ? 'border-[#25D366] bg-[#25D366]/30' : 'border-gray-300 dark:border-white/30'
                }`}>
                  {(allVisibleChecked || someVisibleChecked) && (
                    <svg viewBox="0 0 12 10" className="h-2.5 w-2.5" aria-hidden>
                      <path d="M1 5l3 3 7-7" stroke="white" strokeWidth="2" fill="none" strokeLinecap="round" />
                    </svg>
                  )}
                </div>
                {allVisibleChecked ? t('common:actions.deselectAll') : t('common:actions.selectAll')}
                <span className="ml-auto text-[#8696A0]">{filtered.length}</span>
              </button>
            </div>
          )}
          <div className="flex-1 overflow-y-auto px-2 py-1">
            {loading ? (
              <div className="space-y-1 p-1">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-3 rounded-xl px-3 py-2.5">
                    <div className="h-5 w-5 animate-pulse rounded bg-gray-200 dark:bg-white/10" />
                    <div className="h-9 w-9 animate-pulse rounded-full bg-gray-200 dark:bg-white/10" />
                    <div className="flex-1 space-y-1.5">
                      <div className="h-3 w-24 animate-pulse rounded-full bg-gray-200 dark:bg-white/10" />
                      <div className="h-2.5 w-16 animate-pulse rounded-full bg-gray-100 dark:bg-white/8" />
                    </div>
                  </div>
                ))}
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
                <MessageCircle className="h-8 w-8 text-[#8696A0] opacity-40" />
                <p className="text-sm text-gray-500 dark:text-[#8696A0]">
                  {search ? t('interactive.noContactsMatch') : t('noConversations')}
                </p>
              </div>
            ) : (
              <div className="space-y-0.5">
                {filtered.map(conv => (
                  <ContactRow key={conv.id} conv={conv} checked={selected.has(conv.id)} onToggle={() => toggleContact(conv.id)} />
                ))}
              </div>
            )}
          </div>
          {selected.size > 0 && (
            <div className="border-t border-gray-200 dark:border-white/[0.04] p-3 flex-shrink-0">
              <button
                type="button"
                onClick={() => setMobileTab('build')}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#25D366] py-2.5 text-sm font-semibold text-white"
              >
                <Send className="h-4 w-4" />
                Compose for {selected.size} contact{selected.size !== 1 ? 's' : ''}
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── Mobile: Compose tab ── */}
      {mobileTab === 'build' && (
        <div className="flex flex-col gap-4 overflow-y-auto px-4 py-4 pb-6">
          {/* Header toggle */}
          <div>
            <button
              type="button"
              onClick={() => setDraft(d => ({ ...d, showHeader: !d.showHeader }))}
              className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-gray-500 transition-colors hover:text-gray-900 dark:text-[#8696A0] dark:hover:text-white"
            >
              {draft.showHeader ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
              {t('interactive.header')}
              <span className="ml-1 normal-case font-normal text-[#8696A0]/60">{t('interactive.optional')}</span>
            </button>
            {draft.showHeader && (
              <>
                <input
                  ref={headerRef}
                  type="text"
                  value={draft.header}
                  onChange={e => setDraft(d => ({ ...d, header: e.target.value }))}
                  placeholder="Header text…"
                  maxLength={60}
                  className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-[#16A34A]/50 focus:outline-none transition-colors dark:border-white/10 dark:bg-[#111B21] dark:text-white dark:placeholder:text-[#8696A0] dark:focus:border-[#25D366]/50"
                />
                <VarChips onInsert={token => insertVariable('header', token)} label={t('interactive.insertVar')} />
              </>
            )}
          </div>
          {/* Body */}
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-[#8696A0]">
              {t('interactive.messageBody')} <span className="text-red-400">*</span>
            </label>
            <textarea
              ref={bodyRef}
              value={draft.body}
              onChange={e => setDraft(d => ({ ...d, body: e.target.value }))}
              placeholder="Type your message… Use variable chips below to personalise"
              rows={5}
              maxLength={1024}
              className="w-full resize-none rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-[#16A34A]/50 focus:outline-none transition-colors dark:border-white/10 dark:bg-[#111B21] dark:text-white dark:placeholder:text-[#8696A0] dark:focus:border-[#25D366]/50"
            />
            <div className="mt-1 flex items-start justify-between gap-2">
              <VarChips onInsert={token => insertVariable('body', token)} label={t('interactive.insertVar')} />
              <p className="shrink-0 text-right text-[10px] text-gray-500 dark:text-[#8696A0]">{draft.body.length}/1024</p>
            </div>
          </div>
          {/* Footer toggle */}
          <div>
            <button
              type="button"
              onClick={() => setDraft(d => ({ ...d, showFooter: !d.showFooter }))}
              className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-gray-500 transition-colors hover:text-gray-900 dark:text-[#8696A0] dark:hover:text-white"
            >
              {draft.showFooter ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
              {t('interactive.footer')}
              <span className="ml-1 normal-case font-normal text-[#8696A0]/60">{t('interactive.optional')}</span>
            </button>
            {draft.showFooter && (
              <input
                type="text"
                value={draft.footer}
                onChange={e => setDraft(d => ({ ...d, footer: e.target.value }))}
                placeholder="Footer text…"
                maxLength={60}
                className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-[#16A34A]/50 focus:outline-none transition-colors dark:border-white/10 dark:bg-[#111B21] dark:text-white dark:placeholder:text-[#8696A0] dark:focus:border-[#25D366]/50"
              />
            )}
          </div>
          {/* Buttons */}
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-[#8696A0]">
              {t('interactive.buttons')} <span className="normal-case font-normal">({draft.buttons.length}/3)</span>
            </p>
            <div className="space-y-2">
              {draft.buttons.map((btn, i) => (
                <div key={btn.localId} className="flex items-center gap-2">
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-gray-200 dark:bg-white/8 text-[11px] font-bold text-gray-500 dark:text-[#8696A0]">{i + 1}</div>
                  <input
                    type="text"
                    value={btn.title}
                    onChange={e => updateButton(btn.localId, e.target.value)}
                    placeholder={`Button ${i + 1} label…`}
                    maxLength={20}
                    className="flex-1 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm placeholder:text-gray-400 focus:border-[#16A34A]/50 focus:outline-none transition-colors dark:border-white/10 dark:bg-[#111B21] dark:text-white dark:placeholder:text-[#8696A0]"
                  />
                  <button
                    type="button"
                    onClick={() => removeButton(btn.localId)}
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-gray-500 transition-colors hover:bg-gray-100 hover:text-red-500 dark:text-[#8696A0] dark:hover:bg-white/5"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
              {draft.buttons.length < 3 && (
                <button
                  type="button"
                  onClick={addButton}
                  className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-gray-300 py-2 text-sm font-medium text-gray-500 transition-all hover:border-[#25D366]/40 hover:text-[#25D366] dark:border-white/20 dark:text-[#8696A0]"
                >
                  <Plus className="h-4 w-4" /> {t('interactive.addButton')}
                </button>
              )}
            </div>
          </div>
          {/* Send */}
          <button
            type="button"
            onClick={handleSend}
            disabled={!canSend || sending}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#25D366] py-3 text-sm font-semibold text-white transition-all hover:bg-[#1FAA5C] disabled:cursor-not-allowed disabled:opacity-40 active:scale-[0.98]"
          >
            {sending ? (
              <>
                <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden>
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" className="opacity-25" />
                  <path d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="3" strokeLinecap="round" className="opacity-75" />
                </svg>
                {t('interactive.sending')}
              </>
            ) : (
              <>
                <Send className="h-4 w-4" />
                {selected.size === 0
                  ? t('interactive.selectContactsToSend')
                  : t('interactive.sendToContacts', { count: selected.size })}
              </>
            )}
          </button>
          {selected.size === 0 && (
            <p className="text-center text-xs text-gray-500 dark:text-[#8696A0]">
              {t('interactive.selectRecipientsHint')}
            </p>
          )}
        </div>
      )}

      {/* ── Mobile: Preview tab ── */}
      {mobileTab === 'preview' && (
        <div className="h-[60vh]">
          <BubblePreview
            draft={draft}
            sampleName={previewName}
            samplePhone={previewPhone}
            previewTypingLabel={t('interactive.previewTyping')}
            previewingLabel={t('interactive.previewing')}
          />
        </div>
      )}
    </div>

    {/* ── Desktop layout (sm+) ─────────────────────────────────────────────── */}
    <div className="hidden sm:flex h-[calc(100vh-9rem)] min-h-[680px] overflow-hidden rounded-2xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#111B21] shadow-card dark:shadow-[0_8px_20px_rgba(0,0,0,0.2)]">

      {/* ── LEFT: contact list ────────────────────────────────────────────────── */}
      <div className="flex w-[300px] shrink-0 flex-col border-r border-gray-200 bg-white dark:border-white/[0.04] dark:bg-[#0B141A]">

        {/* Header */}
        <div className="border-b border-gray-200 px-4 py-3.5 dark:border-white/[0.04]">
          <div className="flex items-center gap-2.5">
            <Users className="h-4 w-4 text-[#25D366]" />
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white">{t('interactive.selectRecipients')}</h2>
            {selected.size > 0 && (
              <span className="ml-auto flex h-5 min-w-[20px] items-center justify-center rounded-full bg-[#25D366] px-1.5 text-[10px] font-bold text-white">
                {selected.size}
              </span>
            )}
          </div>
        </div>

        {/* Search */}
        <div className="px-3 py-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#8696A0]" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder={t('interactive.searchContacts')}
              className="w-full rounded-xl border border-gray-200 bg-white py-1.5 pl-8 pr-3 text-sm text-gray-900 placeholder:text-gray-400 focus:border-[#16A34A]/50 focus:outline-none transition-colors dark:border-white/10 dark:bg-[#111B21] dark:text-white dark:placeholder:text-[#8696A0] dark:focus:border-[#25D366]/50"
            />
          </div>
        </div>

        {/* Select all */}
        {filtered.length > 0 && (
          <div className="border-b border-gray-200 px-3 pb-2 dark:border-white/[0.04]">
            <button
              type="button"
              onClick={() => {
                const visible = filtered.map(c => c.id);
                const allChecked = visible.every(id => selected.has(id));
                setSelected(prev => {
                  const next = new Set(prev);
                  if (allChecked) visible.forEach(id => next.delete(id));
                  else visible.forEach(id => next.add(id));
                  return next;
                });
              }}
              className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-xs font-medium text-gray-500 hover:bg-gray-50 hover:text-gray-900 transition-colors dark:text-[#8696A0] dark:hover:bg-white/5 dark:hover:text-white"
            >
              <div
                className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-all ${
                  allVisibleChecked
                    ? 'border-[#25D366] bg-[#25D366]'
                    : someVisibleChecked
                    ? 'border-[#25D366] bg-[#25D366]/30'
                    : 'border-gray-300 dark:border-white/30'
                }`}
              >
                {(allVisibleChecked || someVisibleChecked) && (
                  <svg viewBox="0 0 12 10" className="h-2.5 w-2.5" aria-hidden>
                    <path d="M1 5l3 3 7-7" stroke="white" strokeWidth="2" fill="none" strokeLinecap="round" />
                  </svg>
                )}
              </div>
              {allVisibleChecked ? t('common:actions.deselectAll') : t('common:actions.selectAll')}
              <span className="ml-auto text-[#8696A0]">{filtered.length}</span>
            </button>
          </div>
        )}

        {/* List */}
        <div className="flex-1 overflow-y-auto px-2 py-1">
          {loading ? (
            <div className="space-y-1 p-1">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 rounded-xl px-3 py-2.5">
                  <div className="h-5 w-5 animate-pulse rounded bg-gray-200 dark:bg-white/10" />
                  <div className="h-9 w-9 animate-pulse rounded-full bg-gray-200 dark:bg-white/10" />
                  <div className="flex-1 space-y-1.5">
                    <div className="h-3 w-24 animate-pulse rounded-full bg-gray-200 dark:bg-white/10" />
                    <div className="h-2.5 w-16 animate-pulse rounded-full bg-gray-100 dark:bg-white/8" />
                  </div>
                </div>
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
              <MessageCircle className="h-8 w-8 text-[#8696A0] opacity-40" />
              <p className="text-sm text-gray-500 dark:text-[#8696A0]">
                {search ? t('interactive.noContactsMatch') : t('noConversations')}
              </p>
            </div>
          ) : (
            <div className="space-y-0.5">
              {filtered.map(conv => (
                <ContactRow
                  key={conv.id}
                  conv={conv}
                  checked={selected.has(conv.id)}
                  onToggle={() => toggleContact(conv.id)}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── RIGHT: builder + preview ──────────────────────────────────────────── */}
      <div className="flex flex-1 flex-col overflow-hidden">

        {/* Header */}
        <div className="border-b border-gray-200 px-5 py-3.5 dark:border-white/[0.04]">
          <div className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-[#25D366] to-[#128C7E]">
              <Zap className="h-3.5 w-3.5 text-white" />
            </div>
            <h1 className="text-sm font-semibold text-gray-900 dark:text-white">{t('interactive.buildMessage')}</h1>
          </div>
        </div>

        <div className="flex flex-1 overflow-hidden">

          {/* ── Form ─────────────────────────────────────────────────────────── */}
          <div className="flex w-1/2 flex-col gap-5 overflow-y-auto border-r border-gray-200 px-5 py-4 dark:border-white/[0.04]">

            {/* Header field */}
            <div>
              <button
                type="button"
                onClick={() => setDraft(d => ({ ...d, showHeader: !d.showHeader }))}
                className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-gray-500 transition-colors hover:text-gray-900 dark:text-[#8696A0] dark:hover:text-white"
              >
                {draft.showHeader ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                {t('interactive.header')}
                <span className="ml-1 normal-case font-normal text-[#8696A0]/60">{t('interactive.optional')}</span>
              </button>
              {draft.showHeader && (
                <>
                  <input
                    ref={headerRef}
                    type="text"
                    value={draft.header}
                    onChange={e => setDraft(d => ({ ...d, header: e.target.value }))}
                    placeholder="Header text…"
                    maxLength={60}
                    className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-[#16A34A]/50 focus:outline-none transition-colors dark:border-white/10 dark:bg-[#111B21] dark:text-white dark:placeholder:text-[#8696A0] dark:focus:border-[#25D366]/50"
                  />
                  <VarChips onInsert={token => insertVariable('header', token)} label={t('interactive.insertVar')} />
                </>
              )}
            </div>

            {/* Body field */}
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-[#8696A0]">
                {t('interactive.messageBody')} <span className="text-red-400">*</span>
              </label>
              <textarea
                ref={bodyRef}
                value={draft.body}
                onChange={e => setDraft(d => ({ ...d, body: e.target.value }))}
                placeholder="Type your message… Use variable chips below to personalise"
                rows={5}
                maxLength={1024}
                className="w-full resize-none rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-[#16A34A]/50 focus:outline-none transition-colors dark:border-white/10 dark:bg-[#111B21] dark:text-white dark:placeholder:text-[#8696A0] dark:focus:border-[#25D366]/50"
              />
              <div className="mt-1 flex items-start justify-between gap-2">
                <VarChips onInsert={token => insertVariable('body', token)} label={t('interactive.insertVar')} />
                <p className="shrink-0 text-right text-[10px] text-gray-500 dark:text-[#8696A0]">
                  {draft.body.length}/1024
                </p>
              </div>
            </div>

            {/* Footer field */}
            <div>
              <button
                type="button"
                onClick={() => setDraft(d => ({ ...d, showFooter: !d.showFooter }))}
                className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-gray-500 transition-colors hover:text-gray-900 dark:text-[#8696A0] dark:hover:text-white"
              >
                {draft.showFooter ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                {t('interactive.footer')}
                <span className="ml-1 normal-case font-normal text-[#8696A0]/60">{t('interactive.optional')}</span>
              </button>
              {draft.showFooter && (
                <input
                  type="text"
                  value={draft.footer}
                  onChange={e => setDraft(d => ({ ...d, footer: e.target.value }))}
                  placeholder="Footer text…"
                  maxLength={60}
                  className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-[#16A34A]/50 focus:outline-none transition-colors dark:border-white/10 dark:bg-[#111B21] dark:text-white dark:placeholder:text-[#8696A0] dark:focus:border-[#25D366]/50"
                />
              )}
            </div>

            {/* Buttons */}
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-[#8696A0]">
                {t('interactive.buttons')}
                <span className="ml-1 normal-case font-normal">({draft.buttons.length}/3)</span>
              </p>

              <div className="space-y-2">
                {draft.buttons.map((btn, i) => (
                  <div key={btn.localId} className="flex items-center gap-2">
                    <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-gray-200 dark:bg-white/8 text-[11px] font-bold text-gray-500 dark:text-[#8696A0]">
                      {i + 1}
                    </div>
                    <input
                      type="text"
                      value={btn.title}
                      onChange={e => updateButton(btn.localId, e.target.value)}
                      placeholder={`Button ${i + 1} label…`}
                      maxLength={20}
                      className="flex-1 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-[#16A34A]/50 focus:outline-none transition-colors dark:border-white/10 dark:bg-[#111B21] dark:text-white dark:placeholder:text-[#8696A0] dark:focus:border-[#25D366]/50"
                    />
                    <button
                      type="button"
                      onClick={() => removeButton(btn.localId)}
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-gray-500 transition-colors hover:bg-gray-100 hover:text-red-500 dark:text-[#8696A0] dark:hover:bg-white/5 dark:hover:text-red-400"
                      aria-label="Remove button"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}

                {draft.buttons.length < 3 && (
                  <button
                    type="button"
                    onClick={addButton}
                    className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-gray-300 py-2 text-sm font-medium text-gray-500 transition-all hover:border-[#25D366]/40 hover:text-[#25D366] dark:border-white/20 dark:text-[#8696A0]"
                  >
                    <Plus className="h-4 w-4" />
                    {t('interactive.addButton')}
                  </button>
                )}
              </div>
            </div>

            {/* Send */}
            <div className="mt-auto pt-2">
              <button
                type="button"
                onClick={handleSend}
                disabled={!canSend || sending}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#25D366] py-3 text-sm font-semibold text-white transition-all hover:bg-[#1FAA5C] disabled:cursor-not-allowed disabled:opacity-40 active:scale-[0.98]"
              >
                {sending ? (
                  <>
                    <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden>
                      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" className="opacity-25" />
                      <path d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="3" strokeLinecap="round" className="opacity-75" />
                    </svg>
                    {t('interactive.sending')}
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4" />
                    {selected.size === 0
                      ? t('interactive.selectContactsToSend')
                      : t('interactive.sendToContacts', { count: selected.size })}
                  </>
                )}
              </button>
              {selected.size === 0 && (
                <p className="mt-2 text-center text-xs text-gray-500 dark:text-[#8696A0]">
                  {t('interactive.selectRecipientsHint')}
                </p>
              )}
            </div>
          </div>

          {/* ── Preview ──────────────────────────────────────────────────────── */}
          <div className="flex w-1/2 flex-col overflow-hidden">
            <BubblePreview
              draft={draft}
              sampleName={previewName}
              samplePhone={previewPhone}
              previewTypingLabel={t('interactive.previewTyping')}
              previewingLabel={t('interactive.previewing')}
            />
          </div>
        </div>
      </div>

    </div>

    {/* ── Result toast (shared, fixed-positioned) ──────────────────────────── */}
    {result && (
      <div className="fixed bottom-24 sm:bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-xl border border-gray-200 bg-white px-5 py-3 text-sm font-semibold text-gray-900 shadow-xl dark:border-white/10 dark:bg-[#111B21] dark:text-white">
        {result.ok > 0 && (
          <span className="text-[#25D366]">✓ {t('interactive.sentToContacts', { count: result.ok })}</span>
        )}
        {result.ok > 0 && result.fail > 0 && <span className="mx-2 text-white/30">·</span>}
        {result.fail > 0 && (
          <span className="text-red-400">{t('interactive.failedCount', { count: result.fail })}</span>
        )}
      </div>
    )}
    </>
  );
}
