'use client';

import { useEffect, useRef, useState } from 'react';
import { ChevronDown, Copy, Forward, Reply, Star, Trash2 } from 'lucide-react';

interface Reaction {
  id: string;
  emoji: string;
  userId?: string | null;
  contactPhone?: string | null;
  user?: { id: string; name: string } | null;
}

interface Message {
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
  status?: 'SENT' | 'RECEIVED' | 'PROCESSED' | 'DELIVERED' | 'READ' | 'FAILED';
  readAt?: string | null;
  deliveredAt?: string | null;
  timestamp: string;
  replyToId?: string | null;
  replyToBody?: string | null;
  reactions?: Reaction[];
}

interface MessageBubbleProps {
  message: Message;
  conversationId?: string;
  onReactionUpdate?: (messageId: string, reactions: Reaction[]) => void;
}

function formatTime(timestamp: string) {
  return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatDuration(seconds?: number | null) {
  if (seconds === null || seconds === undefined) return '';
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${String(secs).padStart(2, '0')}`;
}

// Single check = sent, double grey = delivered, double blue = read
function MessageTicks({ status }: { status?: string }) {
  const isRead = status === 'READ';
  const isDelivered = status === 'DELIVERED' || isRead;
  const color = isRead ? '#53BDEB' : 'currentColor';
  if (!isDelivered) {
    return (
      <svg viewBox="0 0 16 11" className="h-3 w-3 shrink-0" fill={color} aria-label="Sent">
        <path d="M11.071.653a.75.75 0 0 1 .025 1.06L5.196 8.1 3.12 6.079a.75.75 0 1 0-1.06 1.072L4.67 9.76a.75.75 0 0 0 1.072-.012l6.389-6.889a.75.75 0 0 0-1.061-1.206z" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 20 11" className="h-3 w-auto shrink-0" fill={color} aria-label={isRead ? 'Read' : 'Delivered'}>
      <path d="M15.071.653a.75.75 0 0 1 .025 1.06L9.196 8.1 7.12 6.079a.75.75 0 1 0-1.06 1.072L8.67 9.76a.75.75 0 0 0 1.072-.012l6.389-6.889a.75.75 0 0 0-1.061-1.206z" />
      <path d="M11.071.653a.75.75 0 0 1 .025 1.06L5.196 8.1 3.12 6.079a.75.75 0 1 0-1.06 1.072L4.67 9.76a.75.75 0 0 0 1.072-.012l6.389-6.889a.75.75 0 0 0-1.061-1.206z" />
    </svg>
  );
}

function formatClock(seconds: number) {
  const safe = Number.isFinite(seconds) ? Math.max(0, seconds) : 0;
  const mins = Math.floor(safe / 60);
  const secs = Math.floor(safe % 60);
  return `${mins}:${String(secs).padStart(2, '0')}`;
}

function VoiceNotePlayer({
  src,
  duration,
  isFromMe,
}: {
  src: string;
  duration?: number | null;
  isFromMe: boolean;
}) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [loadedDuration, setLoadedDuration] = useState(duration ?? 0);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    const onEnded = () => { setIsPlaying(false); setCurrentTime(0); };
    const onTimeUpdate = () => setCurrentTime(audio.currentTime || 0);
    const onLoadedMetadata = () => {
      if (Number.isFinite(audio.duration)) setLoadedDuration(audio.duration);
    };

    audio.addEventListener('play', onPlay);
    audio.addEventListener('pause', onPause);
    audio.addEventListener('ended', onEnded);
    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('loadedmetadata', onLoadedMetadata);

    return () => {
      audio.removeEventListener('play', onPlay);
      audio.removeEventListener('pause', onPause);
      audio.removeEventListener('ended', onEnded);
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('loadedmetadata', onLoadedMetadata);
    };
  }, []);

  const remaining = loadedDuration ? Math.max(0, loadedDuration - currentTime) : 0;

  const togglePlayback = async () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) { await audio.play(); } else { audio.pause(); }
  };

  const seek = (value: number) => {
    const audio = audioRef.current;
    if (!audio || !loadedDuration) return;
    const nextTime = Math.min(loadedDuration, Math.max(0, value));
    audio.currentTime = nextTime;
    setCurrentTime(nextTime);
  };

  return (
    <div className={`w-full rounded-2xl border px-3 py-3 ${isFromMe ? 'border-[#25D366]/25 bg-[#DCF8C6]' : 'border-white/10 bg-[#202C33]'}`}>
      <audio ref={audioRef} preload="metadata" className="hidden" controls={false}>
        <source src={src} />
      </audio>
      <div className="flex items-start gap-3">
        <button
          type="button"
          onClick={togglePlayback}
          className="mt-0.5 flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#25D366] text-white hover:bg-[#25D366]/90 transition"
          aria-label={isPlaying ? 'Pause voice note' : 'Play voice note'}
        >
          {isPlaying ? (
            <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current" aria-hidden="true">
              <path d="M6 5h4v14H6zM14 5h4v14h-4z" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current" aria-hidden="true">
              <path d="M8 5v14l11-7z" />
            </svg>
          )}
        </button>

        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className={`truncate text-sm font-medium ${isFromMe ? 'text-gray-900' : 'text-white'}`}>Voice note</p>
              <p className={`truncate text-xs ${isFromMe ? 'text-gray-700' : 'text-[#8696A0]'}`}>Audio message</p>
            </div>
            <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${isFromMe ? 'bg-white/70 text-gray-800' : 'bg-white/10 text-white'}`}>
              {formatClock(loadedDuration || 0)}
            </span>
          </div>

          <div className="mt-3 space-y-2">
            <input
              type="range"
              min={0}
              max={Math.max(0, loadedDuration || 0)}
              step="0.1"
              value={currentTime}
              onChange={(e) => seek(Number(e.target.value))}
              className={`voice-note-range w-full ${isFromMe ? 'voice-note-range-light' : 'voice-note-range-dark'}`}
              aria-label="Seek voice note"
            />
            <div className={`flex items-center justify-between text-xs font-medium ${isFromMe ? 'text-gray-700' : 'text-[#8696A0]'}`}>
              <span>{formatClock(currentTime)}</span>
              <span>{formatClock(remaining)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}


const API_BASE = process.env.NEXT_PUBLIC_API_URL || '';

export default function MessageBubble({ message, conversationId, onReactionUpdate }: MessageBubbleProps) {
  const apiBase = API_BASE;
  const [showReactPicker, setShowReactPicker] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [reactions, setReactions] = useState<Reaction[]>(message.reactions ?? []);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setReactions(message.reactions ?? []); }, [message.reactions]);

  // Close both menus on outside click
  useEffect(() => {
    if (!showMenu && !showReactPicker) return;
    const close = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) {
        setShowMenu(false);
        setShowReactPicker(false);
      }
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [showMenu, showReactPicker]);

  async function toggleReaction(emoji: string) {
    if (!conversationId) return;
    setShowReactPicker(false);
    setShowMenu(false);
    try {
      const token = typeof window !== 'undefined' ? window.localStorage.getItem('accessToken') : null;
      const res = await fetch(`${apiBase}/api/conversations/${conversationId}/messages/${message.id}/reactions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        credentials: 'include',
        body: JSON.stringify({ emoji }),
      });
      if (res.ok) {
        const updated: Reaction[] = await res.json();
        setReactions(updated);
        onReactionUpdate?.(message.id, updated);
      }
    } catch { /* non-critical */ }
  }

  function copyText() {
    const text = message.body;
    if (!text) return;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text).catch(() => fallbackCopy(text));
    } else {
      fallbackCopy(text);
    }
    setShowMenu(false);
  }

  function fallbackCopy(text: string) {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.cssText = 'position:fixed;opacity:0;top:0;left:0';
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    try { document.execCommand('copy'); } catch {}
    document.body.removeChild(ta);
  }

  const grouped = reactions.reduce<Record<string, number>>((acc, r) => {
    acc[r.emoji] = (acc[r.emoji] ?? 0) + 1;
    return acc;
  }, {});

  const resolveMediaUrl = (url?: string | null) => {
    if (!url) return null;
    if (url.startsWith('http://') || url.startsWith('https://')) return url;
    return `${apiBase}${url}`;
  };

  const isFromMe = message.senderType ? message.senderType === 'agent' : (message.fromMe ?? message.direction === 'OUTBOUND');
  const mediaCaption = message.mediaCaption || message.body;
  const mimeType = message.mediaMimeType || '';
  const isSticker = mimeType.includes('webp');
  const isImage = (message.type === 'IMAGE' || mimeType.startsWith('image/')) && !isSticker;
  const isVideo = message.type === 'VIDEO' || mimeType.startsWith('video/');
  const isAudio = message.type === 'AUDIO' || mimeType.startsWith('audio/');
  const isDocument = message.type === 'DOCUMENT';
  const mediaUrl = resolveMediaUrl(message.mediaUrl);
  const mediaSrc = mediaUrl || undefined;
  const hasMedia = Boolean(mediaUrl && (isImage || isVideo || isAudio || isDocument || isSticker));
  const isGenericMediaLabel = ['IMAGE', 'VIDEO', 'AUDIO', 'DOCUMENT'].includes(String(message.body || '').trim().toUpperCase());
  const hasText = Boolean(message.body && !(hasMedia && isGenericMediaLabel));

  const bubbleTone = isFromMe
    ? 'bg-[#DCF8C6] text-gray-900 shadow-[0_1px_2px_rgba(0,0,0,0.15)]'
    : 'bg-[#202C33] text-[#E9EDEF] shadow-[0_1px_2px_rgba(0,0,0,0.15)]';

  const textRef = useRef<HTMLDivElement | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [isClamped, setIsClamped] = useState(false);
  useEffect(() => {
    const el = textRef.current;
    if (!el) { setIsClamped(false); return; }
    setExpanded(false);
    requestAnimationFrame(() => {
      setIsClamped(el.scrollHeight > el.clientHeight + 1);
    });
  }, [message.body]);

  const menuItemCls = 'w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 dark:text-[#E9EDEF] hover:bg-gray-50 dark:hover:bg-white/5 transition-colors text-left';

  return (
    <div className={`w-full min-w-0 flex ${isFromMe ? 'justify-end' : 'justify-start'}`}>
      <div ref={containerRef} className="relative group max-w-[85%] sm:max-w-[72%] min-w-0">

        {/* ── Chevron — only visible control on hover ── */}
        <div className="absolute top-1 right-1 z-20 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            type="button"
            onClick={() => { setShowMenu(v => !v); setShowReactPicker(false); }}
            className={`flex h-5 w-5 items-center justify-center rounded-full transition-colors ${isFromMe ? 'text-gray-500 hover:bg-black/10' : 'text-[#8696A0] hover:bg-white/10'}`}
            title="More options"
          >
            <ChevronDown className="h-3.5 w-3.5" />
          </button>

          {showMenu && (
            <div className="absolute top-6 right-0 min-w-[170px] rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-[#233038] shadow-2xl py-1 overflow-hidden">
              {conversationId && (
                <button
                  type="button"
                  onClick={() => { setShowMenu(false); setShowReactPicker(true); }}
                  className={menuItemCls}
                >
                  <span className="text-base leading-none">😊</span>
                  <span>React</span>
                </button>
              )}
              <button type="button" onClick={() => setShowMenu(false)} className={menuItemCls}>
                <Reply className="h-4 w-4 shrink-0" />
                <span>Reply</span>
              </button>
              <button type="button" onClick={() => setShowMenu(false)} className={menuItemCls}>
                <Forward className="h-4 w-4 shrink-0" />
                <span>Forward</span>
              </button>
              {hasText && (
                <button type="button" onClick={copyText} className={menuItemCls}>
                  <Copy className="h-4 w-4 shrink-0" />
                  <span>Copy</span>
                </button>
              )}
              <button type="button" onClick={() => setShowMenu(false)} className={menuItemCls}>
                <Star className="h-4 w-4 shrink-0" />
                <span>Star</span>
              </button>
              <div className="my-1 h-px bg-gray-100 dark:bg-white/10" />
              <button
                type="button"
                onClick={() => setShowMenu(false)}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors text-left"
              >
                <Trash2 className="h-4 w-4 shrink-0" />
                <span>Delete</span>
              </button>
            </div>
          )}
        </div>

        {/* ── Bubble ── */}
        <div className={`inline-block w-fit rounded-xl px-3 py-2 ${bubbleTone} ${hasMedia ? 'w-full' : ''}`}>
          {message.replyToBody && (
            <div className={`mb-1 rounded-lg border-l-4 px-2 py-1 text-xs ${isFromMe ? 'border-white/40 bg-black/10' : 'border-[#25D366] bg-black/10'}`}>
              <p className="opacity-80 truncate">{message.replyToBody}</p>
            </div>
          )}

          <div className="space-y-2">
            <style>{`
              .voice-note-range {
                appearance: none;
                height: 0.35rem;
                border-radius: 9999px;
                outline: none;
              }
              .voice-note-range::-webkit-slider-runnable-track {
                height: 0.35rem;
                border-radius: 9999px;
              }
              .voice-note-range::-webkit-slider-thumb {
                appearance: none;
                width: 0.95rem;
                height: 0.95rem;
                border-radius: 9999px;
                margin-top: -0.3rem;
                background: white;
                border: 2px solid #25D366;
                box-shadow: 0 2px 8px rgba(0,0,0,0.22);
              }
              .voice-note-range-light::-webkit-slider-runnable-track {
                background: linear-gradient(90deg, #25D366 0%, #25D366 var(--progress, 0%), rgba(255,255,255,0.45) var(--progress, 0%), rgba(255,255,255,0.45) 100%);
              }
              .voice-note-range-dark::-webkit-slider-runnable-track {
                background: linear-gradient(90deg, #25D366 0%, #25D366 var(--progress, 0%), rgba(255,255,255,0.15) var(--progress, 0%), rgba(255,255,255,0.15) 100%);
              }
              .voice-note-range::-moz-range-thumb {
                width: 0.95rem;
                height: 0.95rem;
                border-radius: 9999px;
                background: white;
                border: 2px solid #25D366;
                box-shadow: 0 2px 8px rgba(0,0,0,0.22);
              }
            `}</style>

            {isImage && hasMedia && <img src={mediaSrc} alt={mediaCaption} className="max-h-[360px] w-full rounded-xl object-cover" />}

            {isSticker && hasMedia && (
              <div className="flex justify-center">
                <img src={mediaSrc} alt={mediaCaption} className="max-w-[180px] rounded-xl bg-white/70 p-2" />
              </div>
            )}

            {isVideo && hasMedia && (
              <video controls className="w-full rounded-xl bg-black">
                <source src={mediaSrc} type={message.mediaMimeType || 'video/mp4'} />
              </video>
            )}

            {isAudio && hasMedia && (
              <VoiceNotePlayer src={mediaSrc as string} duration={message.mediaDuration} isFromMe={isFromMe} />
            )}

            {isDocument && hasMedia && (
              <a
                href={mediaSrc}
                target="_blank"
                rel="noreferrer"
                className={`inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium ${isFromMe ? 'bg-black/10 text-slate-900' : 'bg-white/10 text-slate-100'}`}
              >
                Download attachment
              </a>
            )}

            {!hasMedia && (isImage || isAudio || isVideo || isDocument || isSticker) && (
              <p className={`text-xs ${isFromMe ? 'text-cyan-100' : 'text-slate-400'}`}>Attachment unavailable</p>
            )}

            {hasText && (
              <div>
                <div
                  ref={textRef}
                  className={`text-sm leading-6 break-words whitespace-pre-wrap ${expanded ? '' : 'line-clamp-5'}`}
                >
                  {message.body}
                </div>
                {isClamped && (
                  <button type="button" onClick={() => setExpanded(v => !v)} className="mt-1 text-xs font-semibold text-[#25D366]">
                    {expanded ? 'Show less' : 'Read more'}
                  </button>
                )}
              </div>
            )}

            <div className={`flex items-center justify-end gap-1 text-xs ${isFromMe ? 'text-cyan-100/80' : 'text-[#8696A0]'}`}>
              <span className={isFromMe ? 'text-gray-600 dark:text-gray-700' : 'text-gray-400 dark:text-[#8696A0]'}>
                {formatTime(message.timestamp)}
              </span>
              {isFromMe && <MessageTicks status={message.status} />}
            </div>

            {/* Reaction pills */}
            {Object.keys(grouped).length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1">
                {Object.entries(grouped).map(([emoji, count]) => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => toggleReaction(emoji)}
                    className="flex items-center gap-0.5 rounded-full border border-gray-200 dark:border-white/10 bg-white/70 dark:bg-white/10 px-1.5 py-0.5 text-xs hover:bg-gray-100 dark:hover:bg-white/20 transition-colors"
                    title={`React with ${emoji}`}
                  >
                    <span>{emoji}</span>
                    {count > 1 && <span className="text-gray-600 dark:text-[#8696A0]">{count}</span>}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
