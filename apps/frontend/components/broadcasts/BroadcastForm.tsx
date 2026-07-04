'use client';

import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import {
  Users, MessageSquare, Calendar, Send, ChevronDown, ChevronUp,
  Tag, Search, X, Check, Clock, Zap, AlertCircle, Smartphone,
  ChevronLeft, ChevronRight, Type, Image as ImageIcon, Video, FileText, Upload, Loader2,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { api, apiForm } from '../../lib/api';
import { cn } from '../../lib/utils';
import { useTags } from '../../hooks/useTags';
import { useDirection } from '../../hooks/useDirection';
import { useChatOpen } from '../../stores/chat-open-store';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
const QUICK_EMOJI = ['😊', '👋', '🎉', '✅', '🔥', '🙏', '📦', '💳', '📅', '⭐'];

type MsgType = 'TEXT' | 'IMAGE' | 'VIDEO' | 'DOCUMENT';
const MESSAGE_TYPES: Array<{ type: MsgType; icon: typeof Type; labelKey: string; fallback: string }> = [
  { type: 'TEXT',     icon: Type,      labelKey: 'form.typeText',     fallback: 'Text' },
  { type: 'IMAGE',    icon: ImageIcon, labelKey: 'form.typeImage',    fallback: 'Image' },
  { type: 'VIDEO',    icon: Video,     labelKey: 'form.typeVideo',    fallback: 'Video' },
  { type: 'DOCUMENT', icon: FileText,  labelKey: 'form.typeDocument', fallback: 'Document' },
];

interface Contact {
  id: string;
  phone: string;
  name: string | null;
  contactTags?: { tag: { id: string; name: string; color: string } }[];
}

interface BroadcastFormProps {
  contacts: Contact[];
  initialValues?: {
    name: string;
    message: string;
    recipients: string[];
    tag?: string;
    scheduledAt?: string;
    mediaUrl?: string;
    mediaType?: string;
    mediaFilename?: string;
  };
  submitLabel?: string;
  onBack?: () => void;
  onSave: (broadcast: {
    name: string;
    message: string;
    recipients: string[];
    tag?: string;
    scheduledAt?: Date;
    interactiveContent?: object;
    mediaUrl?: string;
    mediaType?: string;
    mediaFilename?: string;
  }) => void;
}

const VARIABLES = [
  { key: '{{name}}',    labelKey: 'form.varName' },
  { key: '{{phone}}',   labelKey: 'form.varPhone' },
  { key: '{{company}}', labelKey: 'form.varCompany' },
  { key: '{{1}}',       labelKey: 'form.var1' },
  { key: '{{2}}',       labelKey: 'form.var2' },
];
const TOTAL_STEPS = 4;

function PhonePreview({ message, mediaType, mediaUrl, mediaFilename }: {
  message: string; mediaType?: MsgType; mediaUrl?: string; mediaFilename?: string;
}) {
  const { t } = useTranslation('broadcasts');
  const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const hasMedia = mediaType && mediaType !== 'TEXT' && !!mediaUrl;
  const hasContent = message.trim() || hasMedia;
  return (
    <div className="mx-auto w-[210px] rounded-[28px] border-[3px] border-[#2A3942] bg-[#0B141A] p-1.5 shadow-2xl">
      <div className="mb-1 flex items-center justify-between px-2 pt-0.5 text-[8px] text-white/40">
        <span>9:41</span>
        <span className="tracking-tighter">●●●</span>
      </div>
      <div className="flex items-center gap-1.5 rounded-t-xl bg-[#202C33] px-3 py-2">
        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[#25D366]/20">
          <span className="text-[8px] font-bold text-[#25D366]">B</span>
        </div>
        <span className="text-[10px] font-medium text-white">{t('form.businessPreview')}</span>
      </div>
      <div className="min-h-[150px] rounded-b-xl bg-[#0B141A] p-2">
        {hasContent ? (
          <div className="max-w-[170px] overflow-hidden rounded-[6px] rounded-tl-none bg-[#202C33] shadow-sm">
            {hasMedia && (
              <div className="overflow-hidden">
                {mediaType === 'IMAGE' ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={mediaUrl} alt="" className="max-h-24 w-full object-cover"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                ) : mediaType === 'VIDEO' ? (
                  <div className="flex h-20 items-center justify-center bg-black/40 text-white/60"><Video className="h-6 w-6" /></div>
                ) : (
                  <div className="flex items-center gap-1.5 bg-white/5 px-2 py-2">
                    <FileText className="h-4 w-4 shrink-0 text-white/70" />
                    <span className="truncate text-[9px] text-white/80">{mediaFilename || 'document.pdf'}</span>
                  </div>
                )}
              </div>
            )}
            <div className="p-2">
              {message.trim() && (
                <p className="whitespace-pre-wrap break-words text-[10px] leading-[1.5] text-white">
                  {message.length > 200 ? message.slice(0, 200) + '…' : message}
                </p>
              )}
              <div className="mt-1 flex items-center justify-end gap-1">
                <span className="text-[8px] text-[#8696A0]">{now}</span>
                <svg className="h-3 w-3 text-[#25D366]" viewBox="0 0 18 18" fill="currentColor">
                  <path d="M17.394 5.035l-.57-.444a.434.434 0 00-.6.076L8.175 15.35l-4.306-3.396a.434.434 0 00-.6.076l-.47.595a.434.434 0 00.076.6l5.055 3.985a.434.434 0 00.6-.076l9.44-12.5a.434.434 0 00-.076-.599z" />
                </svg>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex h-[140px] items-center justify-center">
            <p className="text-center text-[9px] leading-relaxed text-[#8696A0]/70">
              {t('form.messagePreviewHint').split('\n').map((line, i) => (
                <span key={i}>{line}{i === 0 && <br />}</span>
              ))}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function SectionCard({
  step,
  icon: Icon,
  title,
  subtitle,
  children,
}: {
  step: number;
  icon: React.ElementType;
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-[#111B21] p-5 sm:p-6">
      <div className="mb-5 flex items-start gap-3">
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-[#25D366]/30 bg-[#25D366]/10">
          <span className="text-[11px] font-bold text-[#25D366]">{step}</span>
        </div>
        <div>
          <h3 className="flex items-center gap-1.5 text-sm font-semibold text-white">
            <Icon className="h-4 w-4 text-[#25D366]" />
            {title}
          </h3>
          <p className="mt-0.5 text-xs text-[#8696A0]">{subtitle}</p>
        </div>
      </div>
      {children}
    </div>
  );
}

export default function BroadcastForm({
  contacts,
  initialValues,
  submitLabel,
  onBack,
  onSave,
}: BroadcastFormProps) {
  const { t } = useTranslation('broadcasts');
  const { isRTL: isRtl } = useDirection();
  const setNavHidden = useChatOpen((s) => s.setOpen);
  const initialRecipientSet = Array.from(new Set(initialValues?.recipients ?? []));

  // Hide BottomNav while this form is mounted (it has its own mobile action bar)
  useEffect(() => {
    setNavHidden(true);
    return () => setNavHidden(false);
  }, [setNavHidden]);

  const [formData, setFormData] = useState({
    name: initialValues?.name ?? '',
    message: initialValues?.message ?? '',
    tag: initialValues?.tag ?? '',
    scheduledAt: initialValues?.scheduledAt ?? '',
    sendNow: !initialValues?.scheduledAt,
  });

  const [selectedContacts, setSelectedContacts] = useState<string[]>(initialRecipientSet);
  const [manualPhones, setManualPhones] = useState('');
  const [contactSearch, setContactSearch] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Message type + media (image / video / document broadcasts)
  const [messageType, setMessageType] = useState<MsgType>(
    (initialValues?.mediaType as MsgType) || 'TEXT',
  );
  const [mediaUrl, setMediaUrl] = useState<string>(initialValues?.mediaUrl ?? '');
  const [mediaFilename, setMediaFilename] = useState<string>(initialValues?.mediaFilename ?? '');
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isMedia = messageType !== 'TEXT';
  const acceptFor = messageType === 'IMAGE' ? 'image/*' : messageType === 'VIDEO' ? 'video/*' : '*/*';

  const [templates, setTemplates] = useState<Array<{ id: string; name: string; content: string }>>([]);
  const [showTemplates, setShowTemplates] = useState(false);
  const [templateSearch, setTemplateSearch] = useState('');

  // Mobile wizard step (1-4)
  const [mobileStep, setMobileStep] = useState(1);

  const messageRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    api
      .get('/api/templates')
      .then((data: unknown) => setTemplates(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, []);

  const normalizePhoneList = (value: string) =>
    value.split('\n').map((p) => p.trim()).filter(Boolean);

  const normalizeTag = (value: string) => value.trim().toLowerCase();

  const allTags = useTags();

  const contactHasTag = (c: Contact, tagName: string): boolean =>
    c.contactTags?.some((ct) => normalizeTag(ct.tag.name) === normalizeTag(tagName)) ?? false;

  const selectedTagSet = useMemo(() => {
    const set = new Set<string>();
    allTags.forEach((tag) => {
      const tagContacts = contacts.filter((c) => contactHasTag(c, tag.name));
      if (tagContacts.length > 0 && tagContacts.every((c) => selectedContacts.includes(c.phone))) {
        set.add(tag.name);
      }
    });
    return set;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedContacts, contacts, allTags]);

  const filteredContacts = useMemo(() => {
    if (!contactSearch.trim()) return contacts;
    const q = contactSearch.toLowerCase();
    return contacts.filter(
      (c) => (c.name ?? '').toLowerCase().includes(q) || c.phone.includes(q),
    );
  }, [contacts, contactSearch]);

  const selectedSet = useMemo(() => new Set(selectedContacts), [selectedContacts]);
  const filteredPhones = useMemo(() => filteredContacts.map((c) => c.phone), [filteredContacts]);
  const allFilteredSelected =
    filteredPhones.length > 0 && filteredPhones.every((p) => selectedSet.has(p));

  const selectAllFiltered = useCallback(() => {
    setSelectedContacts((prev) => Array.from(new Set([...prev, ...filteredPhones])));
  }, [filteredPhones]);

  const deselectAllFiltered = useCallback(() => {
    const drop = new Set(filteredPhones);
    setSelectedContacts((prev) => prev.filter((p) => !drop.has(p)));
  }, [filteredPhones]);

  const resolvedAudience = useMemo(() => {
    const manualList = normalizePhoneList(manualPhones);
    const tagValue = formData.tag.trim();
    const tagMatches = tagValue ? contacts.filter((c) => contactHasTag(c, tagValue)) : [];

    const map = new Map<string, { phone: string; name: string | null; source: 'selected' | 'manual' | 'tag' }>();
    selectedContacts.forEach((phone) => {
      const c = contacts.find((x) => x.phone === phone);
      map.set(phone, { phone, name: c?.name ?? null, source: 'selected' });
    });
    manualList.forEach((phone) => {
      if (!map.has(phone)) map.set(phone, { phone, name: null, source: 'manual' });
    });
    tagMatches.forEach((c) => {
      if (!map.has(c.phone)) map.set(c.phone, { phone: c.phone, name: c.name, source: 'tag' });
    });

    return {
      count: map.size,
      selectedCount: selectedContacts.length,
      manualCount: manualList.length,
      tagCount: tagMatches.length,
      preview: Array.from(map.values()).slice(0, 6),
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contacts, formData.tag, manualPhones, selectedContacts]);

  // The broadcast must ONLY be sent by an explicit tap on the real Send button.
  // We never send via the form's onSubmit, so implicit submission — the mobile
  // keyboard "Go", an Enter keypress, or a stray enabled submit button — can
  // never fire the broadcast before the user reaches the final step.
  const handleFormKeyDown = (e: React.KeyboardEvent<HTMLFormElement>) => {
    if (e.key === 'Enter' && (e.target as HTMLElement).tagName === 'INPUT') {
      e.preventDefault();
    }
  };

  const submitBroadcast = () => {
    setError(null);

    if (!isValid) {
      setError(t('form.errorIncomplete', { defaultValue: 'Please complete every step before sending.' }));
      return;
    }

    const recipients = Array.from(new Set([...selectedContacts, ...normalizePhoneList(manualPhones)]));

    if (!recipients.length && !formData.tag.trim()) {
      setError(t('form.errorNoRecipients'));
      return;
    }
    if (!formData.sendNow && !formData.scheduledAt) {
      setError(t('form.errorNoSchedule'));
      return;
    }

    onSave({
      name: formData.name,
      message: formData.message,
      recipients,
      tag: formData.tag.trim() || undefined,
      scheduledAt: formData.sendNow ? undefined : new Date(formData.scheduledAt),
      mediaUrl: isMedia ? (mediaUrl || undefined) : undefined,
      mediaType: isMedia ? messageType : undefined,
      mediaFilename: isMedia ? (mediaFilename || undefined) : undefined,
    });
  };

  const toggleContact = (phone: string) =>
    setSelectedContacts((prev) =>
      prev.includes(phone) ? prev.filter((p) => p !== phone) : [...prev, phone],
    );

  const selectByTag = (tagName: string) => {
    const phones = contacts.filter((c) => contactHasTag(c, tagName)).map((c) => c.phone);
    setSelectedContacts((prev) => Array.from(new Set([...prev, ...phones])));
  };

  const deselectByTag = (tagName: string) => {
    const phones = new Set(contacts.filter((c) => contactHasTag(c, tagName)).map((c) => c.phone));
    setSelectedContacts((prev) => prev.filter((p) => !phones.has(p)));
  };

  const insertAtCursor = (token: string) => {
    const el = messageRef.current;
    if (!el) {
      setFormData((prev) => ({ ...prev, message: prev.message + token }));
      return;
    }
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const next = formData.message.slice(0, start) + token + formData.message.slice(end);
    setFormData((prev) => ({ ...prev, message: next }));
    setTimeout(() => {
      el.selectionStart = el.selectionEnd = start + token.length;
      el.focus();
    }, 0);
  };
  const insertVariable = insertAtCursor;

  const changeMessageType = (type: MsgType) => {
    if (type === messageType) return;
    setMessageType(type);
    setUploadError(null);
    setMediaUrl('');
    setMediaFilename('');
  };

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setUploadError(null);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await apiForm('/api/upload', fd);
      setMediaUrl(`${API_BASE}${res.url}`);
      setMediaFilename(file.name);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : t('form.uploadFailed', { defaultValue: 'Upload failed' }));
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const filteredTemplates = useMemo(() => {
    if (!templateSearch.trim()) return templates;
    const q = templateSearch.toLowerCase();
    return templates.filter((t) => t.name.toLowerCase().includes(q) || t.content.toLowerCase().includes(q));
  }, [templates, templateSearch]);

  const charCount = formData.message.length;
  const charWarning = charCount > 1000;
  const charLimit = charCount > 4096;

  // Text broadcasts need a message; media broadcasts just need an attachment (caption optional).
  const messageReady = isMedia ? mediaUrl.trim().length > 0 : formData.message.trim().length > 0;

  const hasAudience =
    selectedContacts.length > 0 ||
    normalizePhoneList(manualPhones).length > 0 ||
    formData.tag.trim().length > 0;

  const isValid = formData.name.trim().length > 0 && messageReady && hasAudience;

  // Per-step validation for the mobile wizard
  const stepValid = [
    formData.name.trim().length > 0,
    messageReady,
    hasAudience,
    formData.sendNow || !!formData.scheduledAt,
  ];

  const stepTitles = [
    t('form.nameSection'),
    t('form.messageSection'),
    t('form.audienceSection'),
    t('form.deliverySection'),
  ];

  const previewText = formData.message;

  const BackIcon = isRtl ? ChevronRight : ChevronLeft;

  // ── Audience section content (shared between mobile/desktop) ──
  const audienceContent = (
    <>
      {allTags.length > 0 && (
        <div className="mb-5">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-[#8696A0]">
            {t('form.quickSelectByTag')}
          </p>
          <div className="flex flex-wrap gap-2">
            {allTags.map((tag) => {
              const active = selectedTagSet.has(tag.name);
              return (
                <button
                  key={tag.id}
                  type="button"
                  onClick={() => active ? deselectByTag(tag.name) : selectByTag(tag.name)}
                  className={cn(
                    'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-all',
                    active
                      ? 'border-transparent text-white'
                      : 'border-white/10 bg-white/5 text-[#8696A0] hover:border-white/20 hover:text-white',
                  )}
                  style={active ? { backgroundColor: tag.color, borderColor: tag.color } : undefined}
                >
                  <span
                    className="h-2.5 w-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: active ? 'rgba(255,255,255,0.5)' : tag.color }}
                  />
                  {tag.name}
                  {tag._count !== undefined && (
                    <span className={cn('rounded-full px-1.5 py-0.5 text-[9px] font-bold',
                      active ? 'bg-white/20 text-white' : 'bg-white/10 text-[#8696A0]')}>
                      {tag._count.contacts}
                    </span>
                  )}
                  {active && <Check className="h-3 w-3 shrink-0" />}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div className="mb-5">
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-[#8696A0]">
          {t('form.tagFilterLabel')}
        </p>
        {formData.tag ? (
          <div className="flex flex-wrap gap-2">
            {(() => {
              const found = allTags.find((x) => x.name === formData.tag);
              return (
                <span
                  className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium text-white"
                  style={found ? { backgroundColor: found.color } : { backgroundColor: '#25D366' }}
                >
                  <Tag className="h-3 w-3 shrink-0" />
                  {formData.tag}
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, tag: '' })}
                    className="opacity-70 hover:opacity-100"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              );
            })()}
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {allTags.length === 0 && (
              <p className="text-xs text-[#8696A0]">{t('form.tagFilterPlaceholder')}</p>
            )}
            {allTags.map((tag) => (
              <button
                key={tag.id}
                type="button"
                onClick={() => setFormData({ ...formData, tag: tag.name })}
                className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-[#8696A0] hover:border-white/20 hover:text-white transition-all"
              >
                <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: tag.color }} />
                {tag.name}
                {tag._count !== undefined && (
                  <span className="rounded-full bg-white/10 px-1.5 py-0.5 text-[9px] font-bold text-[#8696A0]">
                    {tag._count.contacts}
                  </span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="mb-5">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-[#8696A0]">
            {t('form.contactsLabel', { count: contacts.length })}
            {selectedContacts.length > 0 && (
              <span className="ms-2 rounded-full bg-[#25D366]/15 px-2 py-0.5 text-[10px] font-bold normal-case tracking-normal text-[#25D366]">
                {t('form.selectedCount', { count: selectedContacts.length })}
              </span>
            )}
          </p>
          <div className="flex items-center gap-3">
            {selectedContacts.length > 0 && (
              <button type="button" onClick={() => setSelectedContacts([])} className="text-[10px] text-[#8696A0] transition hover:text-red-400">
                {t('form.clearAll')}
              </button>
            )}
            <button
              type="button"
              onClick={() => allFilteredSelected ? deselectAllFiltered() : selectAllFiltered()}
              disabled={filteredPhones.length === 0}
              className="text-[10px] font-medium text-[#25D366] transition hover:underline disabled:opacity-40"
            >
              {allFilteredSelected
                ? t('form.deselectResults', { count: filteredPhones.length })
                : contactSearch.trim()
                  ? t('form.selectResults', { count: filteredPhones.length })
                  : t('form.selectAll')}
            </button>
          </div>
        </div>

        <div className="relative mb-2">
          <Search className="absolute start-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#8696A0]" />
          <input
            value={contactSearch}
            onChange={(e) => setContactSearch(e.target.value)}
            placeholder={t('form.contactSearchPlaceholder')}
            className="w-full rounded-xl border border-white/10 bg-[#202C33] py-2.5 ps-9 pe-10 text-sm text-white placeholder-[#8696A0] outline-none transition focus:border-[#25D366]/50"
          />
          {contactSearch && (
            <button type="button" onClick={() => setContactSearch('')} className="absolute end-3 top-1/2 -translate-y-1/2">
              <X className="h-3.5 w-3.5 text-[#8696A0]" />
            </button>
          )}
        </div>

        <div className="max-h-72 overflow-y-auto rounded-xl border border-white/10 bg-[#0B141A]">
          {filteredContacts.length === 0 ? (
            <p className="py-8 text-center text-xs text-[#8696A0]">{t('form.noContactsFound')}</p>
          ) : (
            filteredContacts.map((c) => {
              const selected = selectedContacts.includes(c.phone);
              const initials = (c.name ?? c.phone).slice(0, 2).toUpperCase();
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => toggleContact(c.phone)}
                  aria-pressed={selected}
                  className={cn(
                    'flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors',
                    selected ? 'bg-[#25D366]/8' : 'hover:bg-white/4',
                  )}
                >
                  <span className={cn('flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-all',
                    selected ? 'border-[#25D366] bg-[#25D366] text-slate-950' : 'border-white/25 bg-transparent')}>
                    {selected && <Check className="h-3 w-3" strokeWidth={3} />}
                  </span>
                  <div className={cn('flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-bold transition-all',
                    selected ? 'bg-[#25D366]/20 text-[#25D366]' : 'bg-white/10 text-[#8696A0]')}>
                    {initials}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className={cn('truncate text-xs font-medium', selected ? 'text-white' : 'text-[#8696A0]')}>
                      {c.name ?? c.phone}
                    </p>
                    {c.name && <p className="truncate text-[10px] text-[#8696A0]/60">{c.phone}</p>}
                  </div>
                  {(c.contactTags ?? []).slice(0, 2).map(({ tag }) => (
                    <span key={tag.id} className="shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-medium text-white" style={{ backgroundColor: tag.color }}>
                      {tag.name}
                    </span>
                  ))}
                </button>
              );
            })
          )}
        </div>
      </div>

      <div className="mb-5">
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-[#8696A0]">
          {t('form.addManually')}
        </p>
        <textarea
          rows={3}
          value={manualPhones}
          onChange={(e) => setManualPhones(e.target.value)}
          className="w-full resize-none rounded-xl border border-white/10 bg-[#202C33] px-4 py-3 font-mono text-sm text-white placeholder-[#8696A0] outline-none transition focus:border-[#25D366]/50 focus:ring-1 focus:ring-[#25D366]/20"
          placeholder={'+1234567890\n+0987654321\n+4412345678'}
          dir="ltr"
        />
        <p className="mt-1 text-[10px] text-[#8696A0]">{t('form.manualHint')}</p>
      </div>

      <div className="rounded-xl border border-white/10 bg-[#0B141A] p-4">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold text-white">{t('form.resolvedAudience')}</p>
          <span className={cn('rounded-full border px-2.5 py-1 text-xs font-bold',
            resolvedAudience.count > 0
              ? 'border-[#25D366]/30 bg-[#25D366]/10 text-[#25D366]'
              : 'border-white/10 bg-white/5 text-[#8696A0]')}>
            {resolvedAudience.count}{' '}{resolvedAudience.count === 1 ? t('form.recipientSingular') : t('form.recipientPlural')}
          </span>
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2">
          {[
            { label: t('form.sourceSelected'), value: resolvedAudience.selectedCount },
            { label: t('form.sourceManual'), value: resolvedAudience.manualCount },
            { label: t('form.sourceTag'), value: resolvedAudience.tagCount },
          ].map(({ label, value }) => (
            <div key={label} className="rounded-lg bg-white/5 p-2.5 text-center">
              <p className="text-lg font-semibold text-white">{value}</p>
              <p className="text-[9px] uppercase tracking-wider text-[#8696A0]">{label}</p>
            </div>
          ))}
        </div>
        {resolvedAudience.preview.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {resolvedAudience.preview.map((r) => (
              <span key={r.phone} className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[10px] text-white">
                {r.name ?? r.phone}
                <span className="text-[#8696A0]">· {r.source}</span>
              </span>
            ))}
            {resolvedAudience.count > resolvedAudience.preview.length && (
              <span className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[10px] text-[#8696A0]">
                {t('form.moreRecipients', { count: resolvedAudience.count - resolvedAudience.preview.length })}
              </span>
            )}
          </div>
        )}
      </div>
    </>
  );

  // ── Delivery section content ──
  const deliveryContent = (
    <>
      <div className="grid gap-3 sm:grid-cols-2">
        <button
          type="button"
          onClick={() => setFormData({ ...formData, sendNow: true })}
          className={cn(
            'flex items-start gap-3 rounded-xl border p-4 text-left transition-all',
            formData.sendNow ? 'border-[#25D366]/40 bg-[#25D366]/10' : 'border-white/10 bg-[#202C33] hover:border-white/20',
          )}
        >
          <Zap className={cn('mt-0.5 h-5 w-5 shrink-0', formData.sendNow ? 'text-[#25D366]' : 'text-[#8696A0]')} />
          <div className="flex-1">
            <p className={cn('text-sm font-semibold', formData.sendNow ? 'text-[#25D366]' : 'text-white')}>
              {t('form.sendNowOption')}
            </p>
            <p className="mt-0.5 text-xs text-[#8696A0]">{t('form.sendNowDesc')}</p>
          </div>
          {formData.sendNow && <Check className="h-4 w-4 shrink-0 text-[#25D366]" />}
        </button>

        <button
          type="button"
          onClick={() => setFormData({ ...formData, sendNow: false })}
          className={cn(
            'flex items-start gap-3 rounded-xl border p-4 text-left transition-all',
            !formData.sendNow ? 'border-[#25D366]/40 bg-[#25D366]/10' : 'border-white/10 bg-[#202C33] hover:border-white/20',
          )}
        >
          <Clock className={cn('mt-0.5 h-5 w-5 shrink-0', !formData.sendNow ? 'text-[#25D366]' : 'text-[#8696A0]')} />
          <div className="flex-1">
            <p className={cn('text-sm font-semibold', !formData.sendNow ? 'text-[#25D366]' : 'text-white')}>
              {t('form.scheduleOption')}
            </p>
            <p className="mt-0.5 text-xs text-[#8696A0]">{t('form.scheduleDesc')}</p>
          </div>
          {!formData.sendNow && <Check className="h-4 w-4 shrink-0 text-[#25D366]" />}
        </button>
      </div>

      {!formData.sendNow && (
        <div className="mt-4">
          <p className="mb-1.5 text-xs font-medium text-[#8696A0]">{t('form.scheduleTime')}</p>
          <input
            type="datetime-local"
            value={formData.scheduledAt}
            onChange={(e) => setFormData({ ...formData, scheduledAt: e.target.value })}
            className="w-full rounded-xl border border-white/10 bg-[#202C33] px-4 py-3 text-sm text-white outline-none transition focus:border-[#25D366]/50 focus:ring-1 focus:ring-[#25D366]/20 [color-scheme:dark]"
          />
        </div>
      )}

      {/* Mini summary on step 4 mobile */}
      {resolvedAudience.count > 0 && (
        <div className="mt-4 rounded-xl border border-[#25D366]/20 bg-[#25D366]/8 px-4 py-3 sm:hidden">
          <p className="text-center text-2xl font-bold text-[#25D366]">{resolvedAudience.count}</p>
          <p className="text-center text-xs text-[#8696A0]">
            {resolvedAudience.count === 1 ? t('form.recipientSingular') : t('form.recipientPlural')} {t('form.recipientsReady')}
          </p>
        </div>
      )}
    </>
  );

  return (
    <form onSubmit={(e) => e.preventDefault()} onKeyDown={handleFormKeyDown} className="relative pb-24 sm:pb-0">

      {/* ── Mobile wizard header ── */}
      <div className="sm:hidden mb-6">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={mobileStep === 1 ? onBack : () => setMobileStep((s) => s - 1)}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-white transition hover:bg-white/10"
          >
            <BackIcon className="h-4 w-4" />
          </button>
          <div className="flex-1 min-w-0">
            <div className="mb-1.5 flex items-center justify-between gap-2">
              <span className="truncate text-sm font-semibold text-white">{stepTitles[mobileStep - 1]}</span>
              <span className="shrink-0 text-[11px] text-[#8696A0]">{mobileStep}/{TOTAL_STEPS}</span>
            </div>
            <div className="h-1 w-full rounded-full bg-white/10">
              <div
                className="h-1 rounded-full bg-[#25D366] transition-all duration-300"
                style={{ width: `${(mobileStep / TOTAL_STEPS) * 100}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_260px]">
        {/* ── Left: form sections ── */}
        <div className="space-y-4">

          {/* 1 · Campaign name */}
          <div className={mobileStep === 1 ? 'block' : 'hidden sm:block'}>
            <SectionCard step={1} icon={Tag} title={t('form.nameSection')} subtitle={t('form.nameSubtitle')}>
              <div className="relative">
                <Tag className="pointer-events-none absolute start-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[#25D366]" />
                <input
                  type="text"
                  required
                  autoFocus
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full rounded-2xl border-2 border-white/10 bg-[#202C33] py-4 ps-12 pe-4 text-base font-semibold text-white placeholder-[#8696A0]/70 outline-none transition focus:border-[#25D366]/60 focus:ring-2 focus:ring-[#25D366]/20"
                  placeholder={t('form.namePlaceholder2')}
                />
              </div>
              <p className="mt-2.5 flex items-center gap-1.5 text-[11px] text-[#8696A0]">
                <MessageSquare className="h-3.5 w-3.5 shrink-0 text-[#8696A0]/70" />
                {t('form.nameHelper', { defaultValue: 'Only you see this — it helps you find the broadcast later. Recipients never see it.' })}
              </p>
            </SectionCard>
          </div>

          {/* 2 · Message */}
          <div className={mobileStep === 2 ? 'block' : 'hidden sm:block'}>
            <SectionCard step={2} icon={MessageSquare} title={t('form.messageSection')} subtitle={t('form.messageSubtitle')}>
                  {/* Message type — segmented control */}
                  <div className="mb-4">
                    <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-[#8696A0]">
                      {t('form.messageType', { defaultValue: 'Message type' })}
                    </p>
                    <div className="grid grid-cols-4 gap-1.5 rounded-2xl border border-white/10 bg-[#0B141A] p-1.5">
                      {MESSAGE_TYPES.map(({ type, icon: Icon, labelKey, fallback }) => {
                        const active = messageType === type;
                        return (
                          <button
                            key={type}
                            type="button"
                            onClick={() => changeMessageType(type)}
                            className={cn(
                              'flex flex-col items-center gap-1.5 rounded-xl px-1 py-2.5 transition-all',
                              active ? 'bg-[#202C33] text-[#25D366] shadow-sm' : 'text-[#8696A0] hover:text-white',
                            )}
                          >
                            <Icon className="h-[18px] w-[18px]" />
                            <span className="text-[11px] font-medium">{t(labelKey, { defaultValue: fallback })}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Media upload (image / video / document) */}
                  {isMedia && (
                    <div className="mb-4">
                      <input ref={fileInputRef} type="file" accept={acceptFor} onChange={handleFile} className="hidden" />
                      {mediaUrl ? (
                        <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-[#0B141A] p-3">
                          {messageType === 'IMAGE' ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={mediaUrl} alt="" className="h-14 w-14 shrink-0 rounded-xl object-cover"
                              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                          ) : (
                            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-[#25D366]/10 text-[#25D366]">
                              {messageType === 'VIDEO' ? <Video className="h-6 w-6" /> : <FileText className="h-6 w-6" />}
                            </div>
                          )}
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium text-white">{mediaFilename || t('form.fileAttached', { defaultValue: 'File attached' })}</p>
                            <button type="button" onClick={() => fileInputRef.current?.click()} className="text-xs text-[#25D366] hover:underline">
                              {t('form.replaceFile', { defaultValue: 'Replace' })}
                            </button>
                          </div>
                          <button
                            type="button"
                            onClick={() => { setMediaUrl(''); setMediaFilename(''); }}
                            className="flex h-8 w-8 items-center justify-center rounded-lg text-[#8696A0] transition hover:bg-red-500/10 hover:text-red-400"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          disabled={uploading}
                          className="flex w-full flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-white/15 bg-[#0B141A] py-8 text-[#8696A0] transition hover:border-[#25D366]/50 hover:text-[#25D366] disabled:opacity-60"
                        >
                          {uploading ? <Loader2 className="h-6 w-6 animate-spin" /> : <Upload className="h-6 w-6" />}
                          <span className="text-sm font-medium">
                            {uploading ? t('form.uploading', { defaultValue: 'Uploading…' }) : t('form.tapToUpload', { defaultValue: 'Tap to upload' })}
                          </span>
                        </button>
                      )}
                      {uploadError && <p className="mt-1.5 text-xs text-red-400">{uploadError}</p>}
                    </div>
                  )}

                  {/* Use a saved template as the message body / caption */}
                  {templates.length > 0 && (
                    <div className="mb-4">
                      <button
                        type="button"
                        onClick={() => setShowTemplates((v) => !v)}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-[#202C33] px-3 py-2 text-xs font-medium text-[#8696A0] transition hover:bg-white/10"
                      >
                        {t('form.useTemplate')}
                        {showTemplates ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                      </button>
                      {showTemplates && (
                        <div className="mt-3 rounded-xl border border-white/10 bg-[#0B141A] p-3">
                          <input
                            value={templateSearch}
                            onChange={(e) => setTemplateSearch(e.target.value)}
                            placeholder={t('form.searchTemplates')}
                            className="mb-2 w-full rounded-lg border border-white/10 bg-[#202C33] px-3 py-2 text-xs text-white placeholder-[#8696A0] outline-none focus:border-[#25D366]/40"
                          />
                          <div className="max-h-52 space-y-1.5 overflow-y-auto pe-1">
                            {filteredTemplates.length === 0 ? (
                              <p className="py-4 text-center text-xs text-[#8696A0]">{t('form.noTemplates')}</p>
                            ) : (
                              filteredTemplates.map((tpl) => (
                                <button
                                  key={tpl.id}
                                  type="button"
                                  onClick={() => {
                                    setFormData((prev) => ({ ...prev, message: tpl.content }));
                                    setShowTemplates(false);
                                    setTemplateSearch('');
                                  }}
                                  className="w-full rounded-lg border border-white/5 bg-[#202C33] p-3 text-left transition hover:border-[#25D366]/30 hover:bg-white/5"
                                >
                                  <p className="text-xs font-medium text-white">{tpl.name}</p>
                                  <p className="mt-0.5 line-clamp-2 text-[10px] text-[#8696A0]">{tpl.content}</p>
                                </button>
                              ))
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Personalization variables */}
                  <div className="mb-2.5">
                    <p className="mb-1.5 text-[10px] text-[#8696A0]">{t('form.insertVariable')}</p>
                    <div className="flex flex-wrap gap-2">
                      {VARIABLES.map((v) => (
                        <button
                          key={v.key}
                          type="button"
                          onClick={() => insertVariable(v.key)}
                          className="flex flex-col items-center rounded-xl border border-[#25D366]/20 bg-[#25D366]/8 px-3 py-1.5 transition hover:bg-[#25D366]/15 active:scale-95"
                        >
                          <span className="font-mono text-[11px] font-semibold text-[#25D366]">{v.key}</span>
                          <span className="mt-0.5 text-[9px] text-[#8696A0]">{t(v.labelKey)}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Message / caption with embedded emoji toolbar */}
                  <div className={cn(
                    'rounded-2xl border bg-[#202C33] transition focus-within:ring-1',
                    charLimit
                      ? 'border-red-400/50 focus-within:ring-red-400/20'
                      : charWarning
                        ? 'border-amber-400/40 focus-within:ring-amber-400/20'
                        : 'border-white/10 focus-within:border-[#25D366]/50 focus-within:ring-[#25D366]/20',
                  )}>
                    <textarea
                      ref={messageRef}
                      rows={5}
                      value={formData.message}
                      onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                      className="w-full resize-none rounded-t-2xl bg-transparent px-4 py-3 text-sm text-white placeholder-[#8696A0] outline-none"
                      placeholder={isMedia
                        ? t('form.captionPlaceholder', { defaultValue: 'Add a caption… (optional)' })
                        : t('form.messagePlaceholder')}
                    />
                    <div className="flex flex-wrap items-center gap-1 border-t border-white/5 px-2 py-2">
                      {QUICK_EMOJI.map((e) => (
                        <button
                          key={e}
                          type="button"
                          onClick={() => insertAtCursor(e)}
                          className="flex h-8 w-8 items-center justify-center rounded-lg text-lg transition hover:bg-white/5"
                        >
                          {e}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="mt-1.5 flex items-center justify-between">
                    <p className="text-[10px] text-[#8696A0]">
                      {isMedia
                        ? t('form.captionHint', { defaultValue: 'Caption is optional · *bold* _italic_' })
                        : t('form.variablesHint')}
                    </p>
                    <span className={cn('text-[10px] font-semibold tabular-nums',
                      charLimit ? 'text-red-400' : charWarning ? 'text-amber-400' : 'text-[#8696A0]')}>
                      {charCount.toLocaleString()} / 4,096
                    </span>
                  </div>
            </SectionCard>
          </div>

          {/* 3 · Audience */}
          <div className={mobileStep === 3 ? 'block' : 'hidden sm:block'}>
            <SectionCard step={3} icon={Users} title={t('form.audienceSection')} subtitle={t('form.audienceSubtitle')}>
              {audienceContent}
            </SectionCard>
          </div>

          {/* 4 · Delivery */}
          <div className={mobileStep === 4 ? 'block' : 'hidden sm:block'}>
            <SectionCard step={4} icon={Calendar} title={t('form.deliverySection')} subtitle={t('form.deliverySubtitle')}>
              {deliveryContent}
            </SectionCard>
          </div>

          {/* Error */}
          {error && (
            <div className={cn(
              'flex items-start gap-2.5 rounded-xl border border-red-400/20 bg-red-400/8 px-4 py-3',
              mobileStep < TOTAL_STEPS ? 'hidden sm:flex' : 'flex',
            )}>
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
              <p className="text-sm text-red-300">{error}</p>
            </div>
          )}

          {/* Submit bar — desktop only */}
          <div className="hidden sm:flex items-center justify-between rounded-2xl border border-white/10 bg-[#111B21] px-6 py-4">
            <div>
              <p className="text-sm font-semibold text-white">
                {resolvedAudience.count}{' '}
                {resolvedAudience.count === 1 ? t('form.recipientSingular') : t('form.recipientPlural')}
              </p>
              <p className="mt-0.5 text-xs text-[#8696A0]">
                {formData.sendNow
                  ? t('form.sendsNow')
                  : formData.scheduledAt
                    ? t('form.scheduledFor', { date: new Date(formData.scheduledAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) })
                    : t('form.noScheduleSet')}
              </p>
            </div>
            <button
              type="button"
              onClick={submitBroadcast}
              disabled={!isValid}
              className="inline-flex items-center gap-2 rounded-xl bg-[#25D366] px-5 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-[#25D366]/90 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Send className="h-4 w-4" />
              {submitLabel ?? t('form.createTitle')}
            </button>
          </div>
        </div>

        {/* ── Right: live preview sidebar — desktop only ── */}
        <div className="hidden lg:block">
          <div className="sticky top-6 space-y-4">
            <div className="rounded-2xl border border-white/10 bg-[#111B21] p-5">
              <div className="mb-4 flex items-center gap-2">
                <Smartphone className="h-4 w-4 text-[#25D366]" />
                <p className="text-sm font-semibold text-white">{t('form.livePreview')}</p>
              </div>
              <PhonePreview
                message={previewText}
                mediaType={messageType}
                mediaUrl={mediaUrl}
                mediaFilename={mediaFilename}
              />
            </div>

            {resolvedAudience.count > 0 && (
              <div className="rounded-2xl border border-[#25D366]/20 bg-[#25D366]/8 p-4 text-center">
                <p className="text-2xl font-bold text-[#25D366]">{resolvedAudience.count}</p>
                <p className="text-xs text-[#8696A0]">
                  {resolvedAudience.count === 1 ? t('form.recipientSingular') : t('form.recipientPlural')} {t('form.recipientsReady')}
                </p>
              </div>
            )}

            {formData.name && (
              <div className="rounded-2xl border border-white/10 bg-[#111B21] p-4">
                <p className="text-[10px] uppercase tracking-wider text-[#8696A0]">{t('form.campaign')}</p>
                <p className="mt-1 text-sm font-medium text-white line-clamp-2">{formData.name}</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Mobile fixed bottom action bar ── */}
      <div className="fixed bottom-0 inset-x-0 z-30 sm:hidden border-t border-white/10 bg-[#0B141A] px-4 py-3">
        <div className="flex gap-3">
          {mobileStep > 1 && (
            <button
              type="button"
              onClick={() => setMobileStep((s) => s - 1)}
              className="h-12 rounded-xl border border-white/15 bg-white/5 px-5 text-sm font-semibold text-white transition hover:bg-white/10 active:scale-95"
            >
              {t('form.back')}
            </button>
          )}
          {mobileStep < TOTAL_STEPS ? (
            <button
              type="button"
              onClick={() => { if (stepValid[mobileStep - 1]) setMobileStep((s) => s + 1); }}
              disabled={!stepValid[mobileStep - 1]}
              className="flex flex-1 h-12 items-center justify-center rounded-xl bg-[#25D366] text-sm font-bold text-slate-950 transition hover:bg-[#25D366]/90 disabled:cursor-not-allowed disabled:opacity-40 active:scale-95"
            >
              {t('form.next')}
            </button>
          ) : (
            <button
              type="button"
              onClick={submitBroadcast}
              disabled={!isValid}
              className="flex flex-1 h-12 items-center justify-center gap-2 rounded-xl bg-[#25D366] text-sm font-bold text-slate-950 transition hover:bg-[#25D366]/90 disabled:cursor-not-allowed disabled:opacity-40 active:scale-95"
            >
              <Send className="h-4 w-4" />
              {submitLabel ?? t('form.createTitle')}
            </button>
          )}
        </div>
      </div>
    </form>
  );
}
