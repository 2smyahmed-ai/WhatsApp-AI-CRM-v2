'use client';

import { useEffect, useRef, useState } from 'react';
import { ChevronDown, Copy, Forward, Reply, Trash2 } from 'lucide-react';
import type {
  MessageDTO,
  RenderableBlock,
  RenderablePayload,
  Media,
  MessageStatus,
  MessageKind,
  ReplyReference,
} from '@crm/messaging-schema';

// ── Legacy compatibility adapter ──────────────────────────────────────────────
// Converts old flat Message shape (schemaVersion=0) to MessageDTO so the
// single renderer handles both old and new rows.

export interface LegacyMessage {
  id: string;
  fromMe: boolean;
  senderType?: 'agent' | 'user' | string;
  direction?: 'INBOUND' | 'OUTBOUND';
  body: string;
  type?: 'TEXT' | 'IMAGE' | 'DOCUMENT' | 'AUDIO' | 'VIDEO';
  mediaUrl?: string | null;
  mediaMimeType?: string | null;
  mediaFileName?: string | null;
  mediaCaption?: string | null;
  mediaDuration?: number | null;
  timestamp: string;
  status?: string;
  replyToId?: string | null;
  replyToBody?: string | null;
  reactions?: LegacyReaction[];
  schemaVersion?: number;
  renderable?: RenderablePayload;
  clientId?: string;
}

export interface LegacyReaction {
  id: string;
  emoji: string;
  userId?: string | null;
  contactPhone?: string | null;
  user?: { id: string; name: string } | null;
}

function deriveMediaType(type?: string, mime?: string): Media['mediaType'] {
  const m = (mime ?? '').toLowerCase();
  if (m === 'image/webp') return 'sticker';
  if (m.startsWith('image/') || type === 'IMAGE') return 'image';
  if (m.startsWith('video/') || type === 'VIDEO') return 'video';
  if (m.startsWith('audio/') || type === 'AUDIO') return 'audio';
  return 'document';
}

const GENERIC_LABELS = new Set(['IMAGE', 'VIDEO', 'AUDIO', 'DOCUMENT']);

export function legacyToDto(msg: LegacyMessage): MessageDTO & { _reactions?: LegacyReaction[] } {
  const isOutbound = msg.senderType === 'agent' || msg.fromMe || msg.direction === 'OUTBOUND';
  const direction = isOutbound ? 'outbound' : ('inbound' as const);
  const status = ((msg.status ?? 'received').toLowerCase()) as MessageStatus;
  const reply: ReplyReference | null = msg.replyToBody
    ? { messageId: msg.replyToId ?? null, externalId: null, preview: msg.replyToBody, kind: 'text' }
    : null;

  // schemaVersion=1 messages already carry renderable from the server
  if (msg.schemaVersion === 1 && msg.renderable) {
    return {
      schemaVersion: 1,
      id: msg.id,
      clientId: msg.clientId ?? msg.id,
      externalId: null,
      provider: 'baileys',
      sessionId: '',
      conversationId: '',
      contactPhone: '',
      teamId: null,
      direction,
      content: { kind: 'text', body: msg.body ?? '', previewUrl: false },
      status,
      reply,
      timestamp: msg.timestamp,
      renderable: msg.renderable,
      meta: {
        sequenceNumber: 0,
        origin: null,
        errorReason: null,
        errorCode: null,
        compatibilityMode: 'fallback_text',
        timestamps: {},
      },
      _reactions: msg.reactions,
    } as any;
  }

  // Synthesize RenderablePayload from legacy flat fields
  const blocks: RenderableBlock[] = [];
  const mime = msg.mediaMimeType ?? '';
  const hasMedia = Boolean(msg.mediaUrl && msg.type !== 'TEXT');
  const isGenericBody = GENERIC_LABELS.has((msg.body ?? '').toUpperCase().trim());

  if (msg.replyToBody) {
    blocks.push({ type: 'reply_quote', preview: msg.replyToBody, kind: 'text' });
  }

  if (hasMedia && msg.mediaUrl) {
    const media: Media = {
      mediaType: deriveMediaType(msg.type, mime),
      mime: mime || 'application/octet-stream',
      url: msg.mediaUrl,
      providerMediaId: null,
      fileName: msg.mediaFileName ?? null,
      sizeBytes: null,
      durationSec: msg.mediaDuration ?? null,
      width: null,
      height: null,
      thumbnailUrl: null,
    };
    blocks.push({ type: 'media', media, caption: msg.mediaCaption ?? undefined });
  }

  if (msg.body && !(hasMedia && isGenericBody)) {
    blocks.push({ type: 'body_text', text: msg.body });
  }

  if (!blocks.length) blocks.push({ type: 'body_text', text: '' });

  const kind: MessageKind = hasMedia ? 'media' : 'text';
  const renderable: RenderablePayload = {
    kind,
    blocks,
    compatibility: { mode: 'fallback_text', originalKind: kind, effectiveKind: kind, downgraded: false, downgradeReason: null, warnings: [] },
  };

  return {
    schemaVersion: 1,
    id: msg.id,
    clientId: msg.clientId ?? msg.id,
    externalId: null,
    provider: 'baileys',
    sessionId: '',
    conversationId: '',
    contactPhone: '',
    teamId: null,
    direction,
    content: { kind: 'text', body: msg.body ?? '', previewUrl: false },
    status,
    reply,
    timestamp: msg.timestamp,
    renderable,
    meta: {
      sequenceNumber: 0,
      origin: null,
      errorReason: null,
      errorCode: null,
      compatibilityMode: 'fallback_text',
      timestamps: {},
    },
    _reactions: msg.reactions,
  } as any;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const API_BASE = typeof window !== 'undefined'
  ? (process.env.NEXT_PUBLIC_API_URL ?? '')
  : '';

function resolveUrl(url?: string | null): string | null {
  if (!url) return null;
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  return `${API_BASE}${url}`;
}

function formatTime(ts: string) {
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatClock(s: number) {
  const n = Number.isFinite(s) ? Math.max(0, s) : 0;
  return `${Math.floor(n / 60)}:${String(Math.floor(n % 60)).padStart(2, '0')}`;
}

// ── Status ticks (§7.2 of design doc) ────────────────────────────────────────

function StatusTick({ status }: { status: MessageStatus }) {
  if (status === 'received' || status === 'processed' || !status) return null;

  if (status === 'failed') {
    return <span className="text-red-500 text-xs leading-none" title="Failed">⚠</span>;
  }
  if (status === 'queued' || status === 'sending') {
    return <span className="text-gray-400 text-xs leading-none" title="Sending">🕒</span>;
  }
  if (status === 'expired') {
    return <span className="text-red-400 text-xs leading-none" title="Expired">🕒</span>;
  }
  if (status === 'provider_accepted') {
    return (
      <svg viewBox="0 0 16 11" className="h-3 w-3 shrink-0 text-gray-400" fill="currentColor" aria-label="Sent">
        <path d="M11.071.653a.75.75 0 0 1 .025 1.06L5.196 8.1 3.12 6.079a.75.75 0 1 0-1.06 1.072L4.67 9.76a.75.75 0 0 0 1.072-.012l6.389-6.889a.75.75 0 0 0-1.061-1.206z" />
      </svg>
    );
  }
  if (status === 'server_confirmed') {
    return (
      <svg viewBox="0 0 16 11" className="h-3 w-3 shrink-0 text-gray-500" fill="currentColor" aria-label="Confirmed">
        <path d="M11.071.653a.75.75 0 0 1 .025 1.06L5.196 8.1 3.12 6.079a.75.75 0 1 0-1.06 1.072L4.67 9.76a.75.75 0 0 0 1.072-.012l6.389-6.889a.75.75 0 0 0-1.061-1.206z" />
      </svg>
    );
  }
  const isRead = status === 'read';
  const color = isRead ? '#53BDEB' : 'currentColor';
  return (
    <svg viewBox="0 0 20 11" className="h-3 w-auto shrink-0" fill={color} aria-label={isRead ? 'Read' : 'Delivered'}>
      <path d="M15.071.653a.75.75 0 0 1 .025 1.06L9.196 8.1 7.12 6.079a.75.75 0 1 0-1.06 1.072L8.67 9.76a.75.75 0 0 0 1.072-.012l6.389-6.889a.75.75 0 0 0-1.061-1.206z" />
      <path d="M11.071.653a.75.75 0 0 1 .025 1.06L5.196 8.1 3.12 6.079a.75.75 0 1 0-1.06 1.072L4.67 9.76a.75.75 0 0 0 1.072-.012l6.389-6.889a.75.75 0 0 0-1.061-1.206z" />
    </svg>
  );
}

// ── Voice note player ─────────────────────────────────────────────────────────

function VoiceNotePlayer({ src, duration, isFromMe }: { src: string; duration?: number | null; isFromMe: boolean }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(0);
  const [total, setTotal] = useState(duration ?? 0);

  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    const handlers = {
      play:            () => setPlaying(true),
      pause:           () => setPlaying(false),
      ended:           () => { setPlaying(false); setCurrent(0); },
      timeupdate:      () => setCurrent(el.currentTime || 0),
      loadedmetadata:  () => { if (Number.isFinite(el.duration)) setTotal(el.duration); },
    };
    for (const [e, fn] of Object.entries(handlers)) el.addEventListener(e, fn as EventListener);
    return () => { for (const [e, fn] of Object.entries(handlers)) el.removeEventListener(e, fn as EventListener); };
  }, []);

  const progress = total ? Math.min(100, (current / total) * 100) : 0;
  const remaining = total ? Math.max(0, total - current) : 0;

  const toggle = async () => {
    const el = audioRef.current;
    if (!el) return;
    el.paused ? await el.play() : el.pause();
  };

  const seek = (v: number) => {
    const el = audioRef.current;
    if (!el || !total) return;
    el.currentTime = Math.min(total, Math.max(0, v));
    setCurrent(el.currentTime);
  };

  return (
    <div className={`w-full rounded-2xl border px-3 py-3 ${isFromMe ? 'border-[#25D366]/25 bg-[#DCF8C6]' : 'border-white/10 bg-[#202C33]'}`}>
      <audio ref={audioRef} preload="metadata" className="hidden"><source src={src} /></audio>
      <div className="flex items-start gap-3">
        <button type="button" onClick={toggle}
          className="mt-0.5 flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#25D366] text-white transition hover:bg-[#25D366]/90"
          aria-label={playing ? 'Pause' : 'Play'}>
          {playing
            ? <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current"><path d="M6 5h4v14H6zM14 5h4v14h-4z" /></svg>
            : <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current"><path d="M8 5v14l11-7z" /></svg>}
        </button>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className={`truncate text-sm font-medium ${isFromMe ? 'text-gray-900' : 'text-white'}`}>Voice note</p>
              <p className={`truncate text-xs ${isFromMe ? 'text-gray-700' : 'text-[#8696A0]'}`}>Audio message</p>
            </div>
            <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${isFromMe ? 'bg-white/70 text-gray-800' : 'bg-white/10 text-white'}`}>
              {formatClock(total || 0)}
            </span>
          </div>
          <div className="mt-3 space-y-2">
            <style>{`
              .vn-range{appearance:none;height:.35rem;border-radius:9999px;outline:none;width:100%}
              .vn-range::-webkit-slider-runnable-track{height:.35rem;border-radius:9999px}
              .vn-range::-webkit-slider-thumb{appearance:none;width:.95rem;height:.95rem;border-radius:9999px;margin-top:-.3rem;background:white;border:2px solid #25D366;box-shadow:0 2px 8px rgba(0,0,0,.22)}
              .vn-light::-webkit-slider-runnable-track{background:linear-gradient(90deg,#25D366 0%,#25D366 ${progress}%,rgba(255,255,255,.45) ${progress}%,rgba(255,255,255,.45) 100%)}
              .vn-dark::-webkit-slider-runnable-track{background:linear-gradient(90deg,#25D366 0%,#25D366 ${progress}%,rgba(255,255,255,.15) ${progress}%,rgba(255,255,255,.15) 100%)}
              .vn-range::-moz-range-thumb{width:.95rem;height:.95rem;border-radius:9999px;background:white;border:2px solid #25D366}
            `}</style>
            <input type="range" min={0} max={Math.max(0, total || 0)} step="0.1" value={current}
              onChange={(e) => seek(Number(e.target.value))}
              className={`vn-range ${isFromMe ? 'vn-light' : 'vn-dark'}`}
              aria-label="Seek" />
            <div className={`flex items-center justify-between text-xs font-medium ${isFromMe ? 'text-gray-700' : 'text-[#8696A0]'}`}>
              <span>{formatClock(current)}</span>
              <span>{formatClock(remaining)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Individual block renderers ─────────────────────────────────────────────────

function ReplyQuoteView({ block, isFromMe }: { block: { preview: string; kind: MessageKind }; isFromMe: boolean }) {
  return (
    <div className={`mb-1 rounded-lg border-l-4 px-2 py-1 text-xs ${isFromMe ? 'border-white/40 bg-black/10' : 'border-[#25D366] bg-black/10'}`}>
      <p className="opacity-80 truncate">{block.preview || '(message)'}</p>
    </div>
  );
}

function MediaBlockView({ media, caption, isFromMe }: { media: Media; caption?: string; isFromMe: boolean }) {
  const src = resolveUrl(media.url) ?? undefined;
  const type = media.mediaType;

  if (type === 'image' || type === 'sticker') {
    return (
      <div className={type === 'sticker' ? 'flex justify-center' : undefined}>
        <img src={src} alt={caption ?? ''} className={type === 'sticker' ? 'max-w-[180px] rounded-xl bg-white/70 p-2' : 'max-h-[360px] w-full rounded-xl object-cover'} />
        {caption && <p className="mt-1 text-sm leading-5 break-words">{caption}</p>}
      </div>
    );
  }

  if (type === 'video') {
    return (
      <div>
        <video controls className="w-full rounded-xl bg-black max-h-[360px]">
          <source src={src} type={media.mime || 'video/mp4'} />
        </video>
        {caption && <p className="mt-1 text-sm leading-5 break-words">{caption}</p>}
      </div>
    );
  }

  if (type === 'audio' || type === 'voice') {
    return src
      ? <VoiceNotePlayer src={src} duration={media.durationSec} isFromMe={isFromMe} />
      : <p className={`text-xs ${isFromMe ? 'text-cyan-100' : 'text-slate-400'}`}>Audio unavailable</p>;
  }

  // document
  if (!src) return <p className={`text-xs ${isFromMe ? 'text-cyan-100' : 'text-slate-400'}`}>Attachment unavailable</p>;
  return (
    <a href={src} target="_blank" rel="noreferrer"
      className={`inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium ${isFromMe ? 'bg-black/10 text-slate-900' : 'bg-white/10 text-slate-100'}`}>
      <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0 fill-current" aria-hidden>
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zm4 18H6V4h7v5h5v11z"/>
      </svg>
      {media.fileName ?? 'Download attachment'}
      {caption && <span className="text-xs opacity-70 ml-1">{caption}</span>}
    </a>
  );
}

function BodyTextView({ text, isFromMe }: { text: string; isFromMe: boolean }) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [clamped, setClamped] = useState(false);

  useEffect(() => {
    setExpanded(false);
    requestAnimationFrame(() => {
      const el = ref.current;
      if (!el) { setClamped(false); return; }
      setClamped(el.scrollHeight > el.clientHeight + 1);
    });
  }, [text]);

  return (
    <div>
      <div ref={ref} className="text-sm leading-6 break-words"
        style={expanded
          ? { whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', wordBreak: 'break-word' }
          : { whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', wordBreak: 'break-word', display: '-webkit-box', WebkitBoxOrient: 'vertical', WebkitLineClamp: 5, overflow: 'hidden' } as any}>
        {text}
      </div>
      {clamped && (
        <button type="button" onClick={() => setExpanded((v) => !v)} className="mt-1 text-xs font-semibold text-[#25D366]">
          {expanded ? 'Show less' : 'Read more'}
        </button>
      )}
    </div>
  );
}

function ButtonsView({ blocks, isFromMe }: { blocks: Array<{ type: 'reply_button' | 'url_button' | 'phone_button'; id?: string; title: string; url?: string; phoneNumber?: string; disabled?: boolean }>; isFromMe: boolean }) {
  return (
    <div className={`mt-2 divide-y border-t ${isFromMe ? 'divide-black/10 border-black/10' : 'divide-white/10 border-white/10'}`}>
      {blocks.map((b, i) => {
        const base = `w-full py-2 px-1 text-sm font-medium text-center transition ${isFromMe ? 'text-[#1D9BF0] hover:bg-black/5' : 'text-[#53BDEB] hover:bg-white/5'}`;
        if (b.type === 'url_button' && b.url) {
          return (
            <a key={i} href={b.url} target="_blank" rel="noreferrer" className={`${base} flex items-center justify-center gap-1`}>
              {b.title}
              <svg viewBox="0 0 24 24" className="h-3 w-3 fill-current opacity-60" aria-hidden><path d="M19 19H5V5h7V3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7h-2v7zM14 3v2h3.59l-9.83 9.83 1.41 1.41L19 6.41V10h2V3h-7z"/></svg>
            </a>
          );
        }
        if (b.type === 'phone_button' && b.phoneNumber) {
          return (
            <a key={i} href={`tel:${b.phoneNumber}`} className={`${base} flex items-center justify-center gap-1`}>
              <svg viewBox="0 0 24 24" className="h-3 w-3 fill-current" aria-hidden><path d="M6.6 10.8c1.4 2.8 3.8 5.1 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1C10.6 21 3 13.4 3 4c0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.3 0 .7-.2 1L6.6 10.8z"/></svg>
              {b.title}
            </a>
          );
        }
        // reply_button
        return (
          <button key={i} type="button" disabled={b.disabled} className={`${base} ${b.disabled ? 'opacity-50 cursor-default' : ''}`}>
            {b.title}
          </button>
        );
      })}
    </div>
  );
}

function ListButtonView({ block, isFromMe }: { block: { buttonText: string; sections: any[] }; isFromMe: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <div className={`mt-2 border-t ${isFromMe ? 'border-black/10' : 'border-white/10'}`}>
        <button type="button" onClick={() => setOpen(true)}
          className={`w-full py-2 text-sm font-medium text-center flex items-center justify-center gap-1.5 transition ${isFromMe ? 'text-[#1D9BF0] hover:bg-black/5' : 'text-[#53BDEB] hover:bg-white/5'}`}>
          <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 fill-current" aria-hidden><path d="M3 13h2v-2H3v2zm0 4h2v-2H3v2zm0-8h2V7H3v2zm4 4h14v-2H7v2zm0 4h14v-2H7v2zM7 7v2h14V7H7z"/></svg>
          {block.buttonText}
        </button>
      </div>
      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50" onClick={() => setOpen(false)}>
          <div className="w-full max-w-md rounded-t-2xl bg-white dark:bg-[#202C33] max-h-[70vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="sticky top-0 flex items-center justify-between border-b border-gray-200 dark:border-white/10 bg-white dark:bg-[#202C33] px-4 py-3">
              <span className="font-semibold text-gray-900 dark:text-white">Select an option</span>
              <button type="button" onClick={() => setOpen(false)} className="text-gray-500 dark:text-gray-400 hover:text-gray-700">✕</button>
            </div>
            {block.sections.map((sec: any, si: number) => (
              <div key={si}>
                {sec.title && <p className="px-4 pt-3 pb-1 text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-[#8696A0]">{sec.title}</p>}
                {(sec.rows ?? []).map((row: any, ri: number) => (
                  <button key={ri} type="button" onClick={() => setOpen(false)}
                    className="w-full px-4 py-3 text-left hover:bg-gray-50 dark:hover:bg-white/5 border-b border-gray-100 dark:border-white/5 last:border-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-white">{row.title}</p>
                    {row.description && <p className="text-xs text-gray-500 dark:text-[#8696A0]">{row.description}</p>}
                  </button>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}

function NumberedOptionsView({ block, isFromMe }: { block: { intro?: string; options: Array<{ number: number; label: string }> }; isFromMe: boolean }) {
  const textColor = isFromMe ? 'text-gray-900' : 'text-[#E9EDEF]';
  const mutedColor = isFromMe ? 'text-gray-500' : 'text-[#8696A0]';
  return (
    <div className="space-y-1.5">
      {block.intro && <p className={`text-sm ${textColor}`}>{block.intro}</p>}
      <div className="space-y-0.5">
        {block.options.map((o) => (
          <p key={o.number} className={`text-sm ${textColor}`}>
            <span className="font-semibold">{o.number}.</span> {o.label}
          </p>
        ))}
      </div>
      <p className={`text-xs italic ${mutedColor}`}>Reply with the number of your choice.</p>
    </div>
  );
}

function LocationView({ block }: { block: { latitude: number; longitude: number; name?: string; address?: string } }) {
  const mapsUrl = `https://maps.google.com/?q=${block.latitude},${block.longitude}`;
  return (
    <a href={mapsUrl} target="_blank" rel="noreferrer"
      className="flex items-center gap-2 rounded-xl bg-black/10 px-3 py-2 text-sm hover:bg-black/20 transition">
      <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0 fill-[#25D366]" aria-hidden><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>
      <div className="min-w-0">
        {block.name && <p className="font-medium truncate">{block.name}</p>}
        {block.address && <p className="text-xs opacity-70 truncate">{block.address}</p>}
        {!block.name && !block.address && <p className="text-xs opacity-70">{block.latitude.toFixed(4)}, {block.longitude.toFixed(4)}</p>}
      </div>
    </a>
  );
}

function TemplateMarkerView({ block, isFromMe }: { block: { templateName: string; language: string }; isFromMe: boolean }) {
  return (
    <div className={`mb-1 flex items-center gap-1 text-xs ${isFromMe ? 'text-gray-500' : 'text-[#8696A0]'}`}>
      <svg viewBox="0 0 24 24" className="h-3 w-3 fill-current shrink-0" aria-hidden><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-5 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z"/></svg>
      <span className="truncate">Template: {block.templateName} ({block.language})</span>
    </div>
  );
}

// ── Block dispatcher ──────────────────────────────────────────────────────────

function BlockRenderer({ block, isFromMe, buttonBuffer, onFlush }: {
  block: RenderableBlock;
  isFromMe: boolean;
  buttonBuffer: RenderableBlock[];
  onFlush: (blocks: RenderableBlock[]) => void;
}) {
  switch (block.type) {
    case 'reply_quote':
      return <ReplyQuoteView block={block} isFromMe={isFromMe} />;

    case 'header_text':
      return <p className={`text-sm font-bold leading-snug ${isFromMe ? 'text-gray-900' : 'text-white'}`}>{block.text}</p>;

    case 'header_media':
      return <MediaBlockView media={block.media} isFromMe={isFromMe} />;

    case 'body_text':
      return <BodyTextView text={block.text} isFromMe={isFromMe} />;

    case 'media':
      return <MediaBlockView media={block.media} caption={block.caption} isFromMe={isFromMe} />;

    case 'footer':
      return <p className={`text-xs ${isFromMe ? 'text-gray-500' : 'text-[#8696A0]'}`}>{block.text}</p>;

    case 'reply_button':
    case 'url_button':
    case 'phone_button':
      // Accumulate into button group — flushed by parent
      return null;

    case 'list_button':
      return <ListButtonView block={block} isFromMe={isFromMe} />;

    case 'cta_card':
      return (
        <div className={`mt-2 border-t ${isFromMe ? 'border-black/10' : 'border-white/10'}`}>
          <a href={block.url} target="_blank" rel="noreferrer"
            className={`w-full py-2 text-sm font-medium text-center flex items-center justify-center gap-1.5 transition ${isFromMe ? 'text-[#1D9BF0] hover:bg-black/5' : 'text-[#53BDEB] hover:bg-white/5'}`}>
            {block.displayText}
            <svg viewBox="0 0 24 24" className="h-3 w-3 fill-current opacity-60" aria-hidden><path d="M19 19H5V5h7V3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7h-2v7zM14 3v2h3.59l-9.83 9.83 1.41 1.41L19 6.41V10h2V3h-7z"/></svg>
          </a>
        </div>
      );

    case 'numbered_options':
      return <NumberedOptionsView block={block} isFromMe={isFromMe} />;

    case 'location':
      return <LocationView block={block} />;

    case 'contact_card':
      return (
        <div className={`flex items-center gap-2 rounded-xl bg-black/10 px-3 py-2 text-sm ${isFromMe ? 'text-gray-900' : 'text-white'}`}>
          <svg viewBox="0 0 24 24" className="h-8 w-8 shrink-0 fill-gray-400" aria-hidden><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>
          <div className="min-w-0">
            {block.contacts.slice(0, 2).map((c, i) => (
              <p key={i} className="truncate font-medium">{c.name.formattedName}</p>
            ))}
            {block.contacts.length > 2 && <p className="text-xs opacity-60">+{block.contacts.length - 2} more</p>}
          </div>
        </div>
      );

    case 'product_card':
      return (
        <div className="rounded-xl bg-black/10 overflow-hidden">
          {block.image && <MediaBlockView media={block.image} isFromMe={isFromMe} />}
          <div className="px-3 py-2">
            {block.title && <p className={`text-sm font-medium ${isFromMe ? 'text-gray-900' : 'text-white'}`}>{block.title}</p>}
            {block.price && <p className={`text-xs ${isFromMe ? 'text-gray-500' : 'text-[#8696A0]'}`}>{block.price}</p>}
          </div>
        </div>
      );

    case 'template_marker':
      return <TemplateMarkerView block={block} isFromMe={isFromMe} />;

    case 'unsupported':
      return (
        <p className={`text-xs italic ${isFromMe ? 'text-gray-500' : 'text-[#8696A0]'}`}>
          {block.reason || 'Unsupported message type'}
          {block.providerKind && ` (${block.providerKind})`}
        </p>
      );

    default:
      return null;
  }
}

// ── Bubble footer ─────────────────────────────────────────────────────────────

function BubbleFooter({ timestamp, status, downgraded, isFromMe }: {
  timestamp: string;
  status: MessageStatus;
  downgraded: boolean;
  isFromMe: boolean;
}) {
  const color = isFromMe ? 'text-gray-500' : 'text-[#8696A0]';
  return (
    <div className={`flex items-center justify-end gap-1 text-xs ${color} mt-1`}>
      {downgraded && (
        <span className="mr-0.5 text-[10px] opacity-60" title="Sent as text — buttons unsupported on this conversation">📝</span>
      )}
      <span>{formatTime(timestamp)}</span>
      {isFromMe && <StatusTick status={status} />}
    </div>
  );
}

// ── Reaction pills ────────────────────────────────────────────────────────────

const QUICK_REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🙏'];

interface ReactionPillsProps {
  reactions: LegacyReaction[];
  messageId: string;
  conversationId?: string;
  onUpdate?: (messageId: string, reactions: LegacyReaction[]) => void;
}

function ReactionPills({ reactions, messageId, conversationId, onUpdate }: ReactionPillsProps) {
  const [list, setList] = useState<LegacyReaction[]>(reactions);
  const [pickerOpen, setPickerOpen] = useState(false);

  const reactionsSig = reactions.map(r => `${r.id}${r.emoji}`).join('|');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { setList(reactions); }, [reactionsSig]);

  async function toggle(emoji: string) {
    setPickerOpen(false);
    if (!conversationId) return;
    try {
      const token = window.localStorage.getItem('accessToken');
      const res = await fetch(`${API_BASE}/api/conversations/${conversationId}/messages/${messageId}/reactions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        credentials: 'include',
        body: JSON.stringify({ emoji }),
      });
      if (res.ok) {
        const updated: LegacyReaction[] = await res.json();
        setList(updated);
        onUpdate?.(messageId, updated);
      }
    } catch { /* non-critical */ }
  }

  const grouped = list.reduce<Record<string, number>>((acc, r) => { acc[r.emoji] = (acc[r.emoji] ?? 0) + 1; return acc; }, {});

  return { grouped, toggle, pickerOpen, setPickerOpen };
}

// ── Main renderer ─────────────────────────────────────────────────────────────

export interface MessageRendererProps {
  message: MessageDTO;
  reactions?: LegacyReaction[];
  conversationId?: string;
  onReactionUpdate?: (messageId: string, reactions: LegacyReaction[]) => void;
  onReply?: (message: MessageDTO) => void;
  onDelete?: (messageId: string) => void;
  onForward?: (body: string) => void;
  variant?: 'chat' | 'preview';
}

export function MessageRenderer({ message, reactions: reactionsProp = [], conversationId, onReactionUpdate, onReply, onDelete, onForward, variant = 'chat' }: MessageRendererProps) {
  const isFromMe = message.direction === 'outbound';
  const { renderable, status, timestamp } = message;
  const blocks = renderable.blocks;

  const [reactions, setReactions] = useState<LegacyReaction[]>(reactionsProp);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const reactionsSig = reactionsProp.map(r => `${r.id}${r.emoji}`).join('|');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { setReactions(reactionsProp); }, [reactionsSig]);

  useEffect(() => {
    if (!showMenu && !pickerOpen) return;
    const close = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) {
        setShowMenu(false);
        setPickerOpen(false);
      }
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [showMenu, pickerOpen]);

  async function toggleReaction(emoji: string) {
    setPickerOpen(false);
    if (!conversationId || !message.id) return;
    try {
      const token = window.localStorage.getItem('accessToken');
      const res = await fetch(`${API_BASE}/api/conversations/${conversationId}/messages/${message.id}/reactions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        credentials: 'include',
        body: JSON.stringify({ emoji }),
      });
      if (res.ok) {
        const updated: LegacyReaction[] = await res.json();
        setReactions(updated);
        onReactionUpdate?.(message.id, updated);
      }
    } catch { /* non-critical */ }
  }

  const messageText = blocks
    .filter(b => b.type === 'body_text' || b.type === 'header_text')
    .map(b => (b as any).text ?? '')
    .filter(Boolean)
    .join('\n')
    .trim();

  function handleCopy() {
    if (!messageText) return;
    const fallback = (t: string) => {
      const ta = document.createElement('textarea');
      ta.value = t; ta.style.cssText = 'position:fixed;opacity:0';
      document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy'); } catch {}
      document.body.removeChild(ta);
    };
    if (navigator.clipboard) {
      navigator.clipboard.writeText(messageText).catch(() => fallback(messageText));
    } else {
      fallback(messageText);
    }
    setShowMenu(false);
  }

  const menuItemCls = 'w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 dark:text-[#E9EDEF] hover:bg-gray-50 dark:hover:bg-white/5 transition-colors text-left';

  const grouped = reactions.reduce<Record<string, number>>((acc, r) => { acc[r.emoji] = (acc[r.emoji] ?? 0) + 1; return acc; }, {});
  const bubbleTone = isFromMe
    ? 'bg-[#DCF8C6] text-gray-900 shadow-[0_1px_2px_rgba(0,0,0,0.15)]'
    : 'bg-[#202C33] text-[#E9EDEF] shadow-[0_1px_2px_rgba(0,0,0,0.15)]';

  // Collect consecutive action buttons into a single group
  const buttonTypes = new Set<RenderableBlock['type']>(['reply_button', 'url_button', 'phone_button']);
  const segments: Array<{ kind: 'single'; block: RenderableBlock } | { kind: 'buttons'; blocks: RenderableBlock[] }> = [];
  for (const block of blocks) {
    if (buttonTypes.has(block.type)) {
      const last = segments[segments.length - 1];
      if (last?.kind === 'buttons') { last.blocks.push(block); }
      else segments.push({ kind: 'buttons', blocks: [block] });
    } else {
      segments.push({ kind: 'single', block });
    }
  }

  return (
    <div className={`w-full min-w-0 flex ${isFromMe ? 'justify-end' : 'justify-start'}`}>
      <div ref={containerRef} className="relative group max-w-[85%] sm:max-w-[72%] min-w-0">

        {/* Quick reaction picker — floats above bubble, within bounds */}
        {pickerOpen && (
          <div className={`absolute bottom-full mb-1.5 z-30 flex gap-1.5 rounded-full border border-gray-200 dark:border-white/10 bg-white dark:bg-[#202C33] px-2.5 py-1.5 shadow-xl ${isFromMe ? 'right-0' : 'left-0'}`}>
            {QUICK_REACTIONS.map((e) => (
              <button key={e} type="button" onClick={() => toggleReaction(e)}
                className="text-lg leading-none hover:scale-125 transition-transform">{e}</button>
            ))}
          </div>
        )}

        {/* Chevron — shows on hover, anchored top-right inside the container */}
        {variant === 'chat' && (
          <div className="absolute top-1 right-1 z-20 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              type="button"
              onClick={() => { setShowMenu(v => !v); setPickerOpen(false); }}
              className={`flex h-5 w-5 items-center justify-center rounded-full transition-colors ${isFromMe ? 'text-gray-500 hover:bg-black/10' : 'text-[#8696A0] hover:bg-white/10'}`}
              title="More options"
            >
              <ChevronDown className="h-3.5 w-3.5" />
            </button>

            {showMenu && (
              <div className="absolute top-6 right-0 min-w-[170px] rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-[#233038] shadow-2xl py-1 overflow-hidden">
                {conversationId && (
                  <button type="button" onClick={() => { setShowMenu(false); setPickerOpen(true); }} className={menuItemCls}>
                    <span className="text-base leading-none">😊</span>
                    <span>React</span>
                  </button>
                )}
                {onReply && (
                  <button type="button" onClick={() => { setShowMenu(false); onReply(message); }} className={menuItemCls}>
                    <Reply className="h-4 w-4 shrink-0" />
                    <span>Reply</span>
                  </button>
                )}
                {onForward && (
                  <button type="button" onClick={() => { setShowMenu(false); onForward(messageText || (message.content as any)?.body || ''); }} className={menuItemCls}>
                    <Forward className="h-4 w-4 shrink-0" />
                    <span>Forward</span>
                  </button>
                )}
                {messageText && (
                  <button type="button" onClick={handleCopy} className={menuItemCls}>
                    <Copy className="h-4 w-4 shrink-0" />
                    <span>Copy</span>
                  </button>
                )}
                {isFromMe && onDelete && (
                  <>
                    <div className="my-1 h-px bg-gray-100 dark:bg-white/10" />
                    <button type="button" onClick={() => { setShowMenu(false); onDelete(message.id); }}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors text-left">
                      <Trash2 className="h-4 w-4 shrink-0" />
                      <span>Delete</span>
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        )}

        {/* Bubble */}
        <div className={`inline-block w-fit rounded-xl px-3 py-2 ${bubbleTone}`}
          style={{ minWidth: segments.some(s => s.kind === 'buttons') ? '200px' : undefined }}>

          <div className="space-y-1.5">
            {segments.map((seg, i) => {
              if (seg.kind === 'buttons') {
                return <ButtonsView key={i} blocks={seg.blocks as any} isFromMe={isFromMe} />;
              }
              return <BlockRenderer key={i} block={seg.block} isFromMe={isFromMe} buttonBuffer={[]} onFlush={() => {}} />;
            })}
          </div>

          {status === 'failed' && isFromMe && (
            <div className="mt-1.5 flex items-center gap-1.5 rounded-lg bg-red-500/10 px-2 py-1 text-xs text-red-500">
              <span>⚠</span>
              <span>Failed to send</span>
            </div>
          )}

          <BubbleFooter timestamp={timestamp} status={status} downgraded={renderable.compatibility.downgraded} isFromMe={isFromMe} />
        </div>

        {/* Reaction pills — outside bubble for clean layout */}
        {Object.keys(grouped).length > 0 && (
          <div className={`flex flex-wrap gap-1 mt-1 ${isFromMe ? 'justify-end' : 'justify-start'}`}>
            {Object.entries(grouped).map(([emoji, count]) => (
              <button key={emoji} type="button" onClick={() => toggleReaction(emoji)}
                className="flex items-center gap-0.5 rounded-full border border-gray-200 dark:border-white/10 bg-white dark:bg-[#202C33] px-2 py-0.5 text-xs shadow-sm hover:bg-gray-50 dark:hover:bg-white/5 transition-colors"
                title={`React with ${emoji}`}>
                <span>{emoji}</span>
                {count > 1 && <span className="ml-0.5 font-semibold text-gray-600 dark:text-[#AEBAC1]">{count}</span>}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Legacy wrapper — drop-in replacement for MessageBubble ────────────────────

interface LegacyMessageBubbleProps {
  message: LegacyMessage;
  conversationId?: string;
  onReactionUpdate?: (messageId: string, reactions: LegacyReaction[]) => void;
  onReply?: (message: LegacyMessage) => void;
  onDelete?: (messageId: string) => void;
  onForward?: (body: string) => void;
}

export function LegacyMessageBubble({ message, conversationId, onReactionUpdate, onReply, onDelete, onForward }: LegacyMessageBubbleProps) {
  const dto = legacyToDto(message);
  return (
    <MessageRenderer
      message={dto}
      reactions={message.reactions}
      conversationId={conversationId}
      onReactionUpdate={onReactionUpdate}
      onReply={onReply ? () => onReply(message) : undefined}
      onDelete={onDelete}
      onForward={onForward}
    />
  );
}

export default LegacyMessageBubble;
