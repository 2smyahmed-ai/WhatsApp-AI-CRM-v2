'use client';

import { useState, useCallback, useMemo } from 'react';
import { X, Plus, Trash2, AlertTriangle, Info, CheckCircle2, ChevronDown, ChevronUp, Send } from 'lucide-react';
import type {
  InteractiveButtonsContent,
  InteractiveListContent,
  InteractiveCtaContent,
  InteractiveHeader,
  RenderablePayload,
} from '@crm/messaging-schema';
import { toInteractiveRenderable, validateInteractive, type InteractiveContent } from '../../lib/interactive-engine';
import { MessageRenderer } from '../messages/MessageRenderer';
import { Modal } from '../ui/modal';

type Tab = 'buttons' | 'list' | 'cta';
type Provider = 'baileys';

const TAB_LABELS: Record<Tab, string> = {
  buttons: 'Quick Reply',
  list:    'List Message',
  cta:     'CTA Button',
};

function genId() {
  return Math.random().toString(36).slice(2, 10);
}

// ── Field primitives ──────────────────────────────────────────────────────────

function Label({ children, hint }: { children: React.ReactNode; hint?: string }) {
  return (
    <div className="flex items-center gap-1.5 mb-1">
      <span className="text-[10px] uppercase tracking-widest font-semibold text-gray-500 dark:text-[#8696A0]">{children}</span>
      {hint && <span className="text-[10px] text-gray-400 dark:text-[#8696A0]">({hint})</span>}
    </div>
  );
}

function Input({ value, onChange, placeholder, maxLength, disabled }: {
  value: string; onChange: (v: string) => void; placeholder?: string; maxLength?: number; disabled?: boolean;
}) {
  return (
    <div className="relative">
      <input
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        maxLength={maxLength}
        disabled={disabled}
        className="w-full rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-[#111B21] px-3 py-2 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:border-[#25D366] disabled:opacity-50"
      />
      {maxLength && (
        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-gray-300 dark:text-white/20 pointer-events-none">
          {value.length}/{maxLength}
        </span>
      )}
    </div>
  );
}

function Textarea({ value, onChange, placeholder, maxLength, rows = 3 }: {
  value: string; onChange: (v: string) => void; placeholder?: string; maxLength?: number; rows?: number;
}) {
  return (
    <div className="relative">
      <textarea
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        maxLength={maxLength}
        rows={rows}
        className="w-full resize-none rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-[#111B21] px-3 py-2 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:border-[#25D366]"
      />
      {maxLength && (
        <span className="absolute right-2 bottom-2 text-[10px] text-gray-300 dark:text-white/20 pointer-events-none">
          {value.length}/{maxLength}
        </span>
      )}
    </div>
  );
}

// ── Media header editor ───────────────────────────────────────────────────────

type HeaderKind = 'none' | 'text' | 'image' | 'video' | 'document';

function getHeaderKind(header: InteractiveHeader | undefined): HeaderKind {
  if (!header) return 'none';
  if (header.type === 'text') return 'text';
  return header.media.mediaType as HeaderKind;
}

function makeMediaHeader(kind: 'image' | 'video' | 'document', url: string, mime?: string, fileName?: string): InteractiveHeader {
  const defaultMime = kind === 'image' ? 'image/jpeg' : kind === 'video' ? 'video/mp4' : 'application/octet-stream';
  return {
    type: 'media',
    media: {
      mediaType: kind,
      mime: mime ?? defaultMime,
      url: url || null,
      providerMediaId: null,
      fileName: fileName ?? null,
      sizeBytes: null,
      durationSec: null,
      width: null,
      height: null,
      thumbnailUrl: null,
    },
  };
}

const MEDIA_ACCEPT: Record<'image' | 'video' | 'document', string> = {
  image:    'image/jpeg,image/png,image/webp',
  video:    'video/mp4,video/3gpp',
  document: 'application/pdf,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx',
};

const MEDIA_HINTS: Record<'image' | 'video' | 'document', string> = {
  image:    'JPEG or PNG · max 5 MB',
  video:    'MP4 · max 16 MB',
  document: 'PDF or Office document · max 100 MB',
};

function MediaUploader({
  kind,
  header,
  onChange,
}: {
  kind: 'image' | 'video' | 'document';
  header: InteractiveHeader | undefined;
  onChange: (h: InteractiveHeader | undefined) => void;
}) {
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [inputMode, setInputMode] = useState<'upload' | 'url'>('upload');

  const mediaUrl  = header?.type === 'media' ? (header.media.url ?? '') : '';
  const mediaName = header?.type === 'media' ? (header.media.fileName ?? '') : '';

  const handleFile = async (file: File) => {
    setUploading(true);
    setUploadError(null);
    try {
      const token = window.localStorage.getItem('accessToken');
      const form = new FormData();
      form.append('file', file);
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL ?? ''}/api/upload`,
        {
          method: 'POST',
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          credentials: 'include',
          body: form,
        },
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? 'Upload failed');
      // Construct absolute URL so Meta can fetch it
      const base = (process.env.NEXT_PUBLIC_API_URL ?? '').replace(/\/$/, '');
      const absoluteUrl = data.url.startsWith('http') ? data.url : `${base}${data.url}`;
      onChange(makeMediaHeader(kind, absoluteUrl, data.mimeType, data.name));
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-2">
      {/* Upload / URL mode toggle */}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setInputMode('upload')}
          className={`text-xs px-3 py-1 rounded-lg border transition-colors ${
            inputMode === 'upload'
              ? 'border-[#25D366] text-[#25D366] bg-[#25D366]/5'
              : 'border-gray-200 dark:border-white/10 text-gray-500 dark:text-[#8696A0] hover:border-[#25D366]/40'
          }`}
        >
          From device
        </button>
        <button
          type="button"
          onClick={() => setInputMode('url')}
          className={`text-xs px-3 py-1 rounded-lg border transition-colors ${
            inputMode === 'url'
              ? 'border-[#25D366] text-[#25D366] bg-[#25D366]/5'
              : 'border-gray-200 dark:border-white/10 text-gray-500 dark:text-[#8696A0] hover:border-[#25D366]/40'
          }`}
        >
          From URL
        </button>
      </div>

      {inputMode === 'upload' && (
        <div>
          {/* Drop zone */}
          <label
            className={`flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 py-5 cursor-pointer transition-colors ${
              uploading
                ? 'border-gray-200 dark:border-white/10 opacity-60 cursor-not-allowed'
                : 'border-gray-200 dark:border-white/10 hover:border-[#25D366]/60 hover:bg-[#25D366]/3'
            }`}
          >
            <input
              type="file"
              accept={MEDIA_ACCEPT[kind]}
              className="sr-only"
              disabled={uploading}
              onChange={e => {
                const f = e.target.files?.[0];
                if (f) handleFile(f);
                e.target.value = '';
              }}
            />
            {uploading ? (
              <span className="h-5 w-5 animate-spin rounded-full border-2 border-[#25D366] border-t-transparent" />
            ) : mediaName ? (
              <>
                <CheckCircle2 className="h-5 w-5 text-[#25D366]" />
                <span className="text-xs text-center text-gray-700 dark:text-white truncate max-w-full px-2">{mediaName}</span>
                <span className="text-[10px] text-gray-400 dark:text-[#8696A0]">Click to replace</span>
              </>
            ) : (
              <>
                <Plus className="h-5 w-5 text-gray-400 dark:text-[#8696A0]" />
                <span className="text-xs text-gray-500 dark:text-[#8696A0]">Click to upload {kind}</span>
                <span className="text-[10px] text-gray-400 dark:text-[#8696A0]">{MEDIA_HINTS[kind]}</span>
              </>
            )}
          </label>
          {uploadError && (
            <p className="mt-1 text-[10px] text-red-500">{uploadError}</p>
          )}
        </div>
      )}

      {inputMode === 'url' && (
        <div className="space-y-1.5">
          <input
            value={mediaUrl}
            onChange={e => onChange(makeMediaHeader(kind, e.target.value))}
            placeholder={`https://example.com/${kind === 'image' ? 'banner.jpg' : kind === 'video' ? 'promo.mp4' : 'invoice.pdf'}`}
            className="w-full rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-[#111B21] px-3 py-2 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:border-[#25D366]"
          />
          <p className="text-[10px] text-gray-400 dark:text-[#8696A0]">Must be a publicly accessible URL.</p>
        </div>
      )}
    </div>
  );
}

function HeaderEditor({
  header,
  onChange,
  supportMedia = true,
}: {
  header: InteractiveHeader | undefined;
  onChange: (h: InteractiveHeader | undefined) => void;
  supportMedia?: boolean;
}) {
  const kind = getHeaderKind(header);
  const textVal = header?.type === 'text' ? header.text : '';

  const KINDS: { value: HeaderKind; label: string }[] = supportMedia
    ? [
        { value: 'none',     label: 'None' },
        { value: 'text',     label: 'Text' },
        { value: 'image',    label: 'Image' },
        { value: 'video',    label: 'Video' },
        { value: 'document', label: 'Doc' },
      ]
    : [
        { value: 'none', label: 'None' },
        { value: 'text', label: 'Text' },
      ];

  const handleKindChange = (k: HeaderKind) => {
    if (k === 'none') { onChange(undefined); return; }
    if (k === 'text') { onChange({ type: 'text', text: textVal }); return; }
    // Preserve existing media URL when switching between image/video/document
    const existingUrl = header?.type === 'media' ? (header.media.url ?? '') : '';
    onChange(makeMediaHeader(k as 'image' | 'video' | 'document', existingUrl));
  };

  return (
    <div className="space-y-2">
      <Label hint="optional">Header</Label>

      {/* Kind picker */}
      <div className="flex gap-1 rounded-xl border border-gray-200 dark:border-white/10 p-1">
        {KINDS.map(({ value, label }) => (
          <button
            key={value}
            type="button"
            onClick={() => handleKindChange(value)}
            className={`flex-1 rounded-lg py-1.5 text-xs font-medium transition-colors ${
              kind === value
                ? 'bg-[#25D366] text-white'
                : 'text-gray-500 dark:text-[#8696A0] hover:bg-gray-100 dark:hover:bg-white/5'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Text input */}
      {kind === 'text' && (
        <Input
          value={textVal}
          onChange={v => onChange({ type: 'text', text: v })}
          placeholder="E.g. Order update"
          maxLength={60}
        />
      )}

      {/* Media upload/URL */}
      {(kind === 'image' || kind === 'video' || kind === 'document') && (
        <MediaUploader kind={kind} header={header} onChange={onChange} />
      )}

      {/* List restriction notice */}
      {!supportMedia && (
        <p className="text-[10px] text-amber-500 dark:text-amber-400">
          List messages only support text headers — image/video/document headers are not available.
        </p>
      )}
    </div>
  );
}

// ── Validation panel ──────────────────────────────────────────────────────────

function ValidationPanel({ content, provider }: { content: InteractiveContent; provider: Provider }) {
  const result = useMemo(() => validateInteractive(content, provider), [content, provider]);
  if (result.issues.length === 0) return null;

  return (
    <div className="space-y-1 mt-3">
      {result.issues.map((issue, i) => {
        const icon = issue.level === 'error' ? <AlertTriangle className="h-3 w-3 shrink-0 text-red-500" />
          : issue.level === 'warning' ? <AlertTriangle className="h-3 w-3 shrink-0 text-amber-500" />
          : <Info className="h-3 w-3 shrink-0 text-blue-400" />;
        const cls = issue.level === 'error' ? 'border-red-200 dark:border-red-500/20 bg-red-50 dark:bg-red-500/5 text-red-700 dark:text-red-300'
          : issue.level === 'warning' ? 'border-amber-200 dark:border-amber-500/20 bg-amber-50 dark:bg-amber-500/5 text-amber-700 dark:text-amber-300'
          : 'border-blue-200 dark:border-blue-500/20 bg-blue-50 dark:bg-blue-500/5 text-blue-700 dark:text-blue-300';
        return (
          <div key={i} className={`flex items-start gap-2 rounded-lg border px-2.5 py-2 ${cls}`}>
            {icon}
            <div className="min-w-0">
              <p className="text-xs leading-snug">{issue.message}</p>
              {issue.downgrade && (
                <p className="mt-0.5 font-mono text-[10px] opacity-70">{issue.downgrade}</p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Preview pane ──────────────────────────────────────────────────────────────

function PreviewPane({ content }: { content: InteractiveContent }) {
  const renderable: RenderablePayload = useMemo(
    () => toInteractiveRenderable(content, 'baileys_native'),
    [content],
  );

  const fakeDto = {
    schemaVersion: 1 as const,
    id: 'preview',
    clientId: 'preview',
    externalId: null,
    provider: 'baileys' as const,
    sessionId: '',
    conversationId: '',
    contactPhone: '',
    teamId: null,
    direction: 'outbound' as const,
    content: { kind: 'text' as const, body: '', previewUrl: false },
    status: 'delivered' as const,
    reply: null,
    timestamp: new Date().toISOString(),
    renderable,
    meta: {
      sequenceNumber: 0,
      origin: null,
      errorReason: null,
      errorCode: null,
      compatibilityMode: 'baileys_native' as const,
      timestamps: {},
    },
  };

  return (
    <div className="rounded-2xl border border-gray-200 dark:border-white/10 bg-[#f0f2f5] dark:bg-[#0B141A] p-4">
      <p className="mb-3 text-[10px] uppercase tracking-widest font-semibold text-gray-400 dark:text-[#8696A0]">
        WhatsApp Preview
      </p>
      <MessageRenderer message={fakeDto as any} variant="preview" />
    </div>
  );
}

// ── Quick Reply tab ───────────────────────────────────────────────────────────

function ButtonsTab({
  content,
  onChange,
}: {
  content: InteractiveButtonsContent;
  onChange: (c: InteractiveButtonsContent) => void;
}) {
  const update = useCallback((patch: Partial<InteractiveButtonsContent>) => onChange({ ...content, ...patch }), [content, onChange]);

  return (
    <div className="space-y-4">
      <HeaderEditor
        header={content.header}
        onChange={h => update({ header: h })}
      />

      <div>
        <Label hint="required, max 1024">Body</Label>
        <Textarea
          value={content.body}
          onChange={v => update({ body: v })}
          placeholder="What would you like the customer to reply to?"
          maxLength={1024}
          rows={3}
        />
      </div>

      <div>
        <Label hint="optional, max 60">Footer</Label>
        <Input
          value={content.footer ?? ''}
          onChange={v => update({ footer: v.trim() || undefined })}
          placeholder="E.g. Reply within 24 hours"
          maxLength={60}
        />
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <Label>Buttons (max 3)</Label>
          {content.buttons.length < 3 && (
            <button
              type="button"
              onClick={() => update({ buttons: [...content.buttons, { id: genId(), title: '' }] })}
              className="flex items-center gap-1 text-xs text-[#25D366] hover:text-[#1FAA5C] transition-colors"
            >
              <Plus className="h-3 w-3" /> Add button
            </button>
          )}
        </div>
        <div className="space-y-2">
          {content.buttons.map((btn, i) => (
            <div key={btn.id} className="flex items-center gap-2">
              <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#25D366]/10 text-[10px] font-bold text-[#25D366]">
                {i + 1}
              </div>
              <Input
                value={btn.title}
                onChange={v => {
                  const btns = [...content.buttons];
                  btns[i] = { ...btn, title: v };
                  update({ buttons: btns });
                }}
                placeholder="Button label (max 20 chars)"
                maxLength={20}
              />
              <button
                type="button"
                onClick={() => update({ buttons: content.buttons.filter((_, j) => j !== i) })}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
          {content.buttons.length === 0 && (
            <p className="text-xs text-gray-400 dark:text-[#8696A0] italic">No buttons yet — click &ldquo;Add button&rdquo; above.</p>
          )}
        </div>
      </div>
    </div>
  );
}

// ── List tab ──────────────────────────────────────────────────────────────────

function ListTab({
  content,
  onChange,
}: {
  content: InteractiveListContent;
  onChange: (c: InteractiveListContent) => void;
}) {
  const [openSection, setOpenSection] = useState<number | null>(0);
  const update = useCallback((patch: Partial<InteractiveListContent>) => onChange({ ...content, ...patch }), [content, onChange]);

  const addSection = () => {
    const sections = [...content.sections, { title: `Section ${content.sections.length + 1}`, rows: [] }];
    onChange({ ...content, sections });
    setOpenSection(sections.length - 1);
  };

  const removeSection = (si: number) => {
    const sections = content.sections.filter((_, i) => i !== si);
    onChange({ ...content, sections });
    setOpenSection(null);
  };

  const addRow = (si: number) => {
    const sections = content.sections.map((sec, i) =>
      i === si ? { ...sec, rows: [...sec.rows, { id: genId(), title: '', description: '' }] } : sec
    );
    onChange({ ...content, sections });
  };

  const removeRow = (si: number, ri: number) => {
    const sections = content.sections.map((sec, i) =>
      i === si ? { ...sec, rows: sec.rows.filter((_, j) => j !== ri) } : sec
    );
    onChange({ ...content, sections });
  };

  const updateRow = (si: number, ri: number, patch: Partial<{ id: string; title: string; description: string }>) => {
    const sections = content.sections.map((sec, i) =>
      i === si ? { ...sec, rows: sec.rows.map((r, j) => j === ri ? { ...r, ...patch } : r) } : sec
    );
    onChange({ ...content, sections });
  };

  return (
    <div className="space-y-4">
      <HeaderEditor
        header={content.header}
        onChange={h => update({ header: h })}
        supportMedia={false}
      />

      <div>
        <Label hint="required">Body</Label>
        <Textarea
          value={content.body}
          onChange={v => update({ body: v })}
          placeholder="Describe what the customer is choosing from"
          maxLength={1024}
          rows={3}
        />
      </div>

      <div>
        <Label hint="optional">Footer</Label>
        <Input
          value={content.footer ?? ''}
          onChange={v => update({ footer: v.trim() || undefined })}
          placeholder="E.g. Choose one from the list"
          maxLength={60}
        />
      </div>

      <div>
        <Label hint="max 20 chars">List button text</Label>
        <Input
          value={content.buttonText}
          onChange={v => update({ buttonText: v })}
          placeholder="E.g. View options"
          maxLength={20}
        />
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <Label>Sections (max 10)</Label>
          {content.sections.length < 10 && (
            <button type="button" onClick={addSection}
              className="flex items-center gap-1 text-xs text-[#25D366] hover:text-[#1FAA5C] transition-colors">
              <Plus className="h-3 w-3" /> Add section
            </button>
          )}
        </div>

        {content.sections.length === 0 && (
          <p className="text-xs text-gray-400 dark:text-[#8696A0] italic">No sections — add at least one.</p>
        )}

        <div className="space-y-2">
          {content.sections.map((sec, si) => (
            <div key={si} className="rounded-xl border border-gray-200 dark:border-white/10 overflow-hidden">
              <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 dark:bg-white/5">
                <button type="button" onClick={() => setOpenSection(openSection === si ? null : si)}
                  className="flex-1 flex items-center gap-2 text-left">
                  {openSection === si ? <ChevronUp className="h-3.5 w-3.5 text-gray-400" /> : <ChevronDown className="h-3.5 w-3.5 text-gray-400" />}
                  <span className="text-sm font-medium text-gray-700 dark:text-white truncate">{sec.title || `Section ${si + 1}`}</span>
                  <span className="text-xs text-gray-400">({sec.rows.length} rows)</span>
                </button>
                <button type="button" onClick={() => removeSection(si)}
                  className="flex h-6 w-6 items-center justify-center rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>

              {openSection === si && (
                <div className="p-3 space-y-3 border-t border-gray-200 dark:border-white/10">
                  <div>
                    <Label>Section title</Label>
                    <Input
                      value={sec.title}
                      onChange={v => {
                        const sections = content.sections.map((s, i) => i === si ? { ...s, title: v } : s);
                        onChange({ ...content, sections });
                      }}
                      placeholder="E.g. Shipping options"
                    />
                  </div>

                  <div className="space-y-2">
                    {sec.rows.map((row, ri) => (
                      <div key={row.id} className="rounded-lg border border-gray-200 dark:border-white/10 p-2.5 space-y-2">
                        <div className="flex items-center gap-2">
                          <Input
                            value={row.title}
                            onChange={v => updateRow(si, ri, { title: v })}
                            placeholder="Row title (max 24 chars)"
                            maxLength={24}
                          />
                          <button type="button" onClick={() => removeRow(si, ri)}
                            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors">
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                        <Input
                          value={row.description ?? ''}
                          onChange={v => updateRow(si, ri, { description: v })}
                          placeholder="Description (optional, max 72 chars)"
                          maxLength={72}
                        />
                      </div>
                    ))}
                    {sec.rows.length < 10 && (
                      <button type="button" onClick={() => addRow(si)}
                        className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-gray-200 dark:border-white/10 py-2 text-xs text-gray-400 hover:text-[#25D366] hover:border-[#25D366]/40 transition-colors">
                        <Plus className="h-3 w-3" /> Add row
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── CTA tab ───────────────────────────────────────────────────────────────────

function CtaTab({
  content,
  onChange,
}: {
  content: InteractiveCtaContent;
  onChange: (c: InteractiveCtaContent) => void;
}) {
  const update = useCallback((patch: Partial<InteractiveCtaContent>) => onChange({ ...content, ...patch }), [content, onChange]);

  return (
    <div className="space-y-4">
      <HeaderEditor
        header={content.header}
        onChange={h => update({ header: h })}
      />

      <div>
        <Label hint="required">Body</Label>
        <Textarea
          value={content.body}
          onChange={v => update({ body: v })}
          placeholder="Describe what the link is for"
          maxLength={1024}
          rows={3}
        />
      </div>

      <div>
        <Label hint="optional">Footer</Label>
        <Input
          value={content.footer ?? ''}
          onChange={v => update({ footer: v.trim() || undefined })}
          placeholder="E.g. Link expires in 24 hours"
          maxLength={60}
        />
      </div>

      <div className="rounded-xl border border-gray-200 dark:border-white/10 p-3 space-y-3">
        <Label>CTA Button</Label>
        <div>
          <span className="text-[10px] uppercase tracking-wider text-gray-400 dark:text-[#8696A0]">Button label (max 20)</span>
          <Input
            value={content.cta.displayText}
            onChange={v => update({ cta: { ...content.cta, displayText: v } })}
            placeholder="E.g. Track my order"
            maxLength={20}
          />
        </div>
        <div>
          <span className="text-[10px] uppercase tracking-wider text-gray-400 dark:text-[#8696A0]">URL</span>
          <Input
            value={content.cta.url}
            onChange={v => update({ cta: { ...content.cta, url: v } })}
            placeholder="https://your-domain.com/track/..."
          />
        </div>
      </div>
    </div>
  );
}

// ── Default content factories ─────────────────────────────────────────────────

const defaultButtons = (): InteractiveButtonsContent => ({
  kind: 'interactive_buttons',
  body: '',
  buttons: [],
});

const defaultList = (): InteractiveListContent => ({
  kind: 'interactive_list',
  body: '',
  buttonText: 'Select',
  sections: [{ title: 'Options', rows: [] }],
});

const defaultCta = (): InteractiveCtaContent => ({
  kind: 'interactive_cta',
  body: '',
  cta: { displayText: '', url: '' },
});

// ── Main composer ─────────────────────────────────────────────────────────────

interface InteractiveComposerProps {
  conversationId: string;
  phone: string;
  provider?: Provider;
  onClose: () => void;
  onSent?: () => void;
}

export default function InteractiveComposer({
  conversationId,
  phone,
  provider = 'baileys',
  onClose,
  onSent,
}: InteractiveComposerProps) {
  const [tab, setTab]             = useState<Tab>('buttons');
  const [showPreview, setShowPreview] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [sent, setSent]           = useState(false);

  const [buttonsContent, setButtonsContent] = useState<InteractiveButtonsContent>(defaultButtons);
  const [listContent,    setListContent]    = useState<InteractiveListContent>(defaultList);
  const [ctaContent,     setCtaContent]     = useState<InteractiveCtaContent>(defaultCta);

  const currentContent: InteractiveContent =
    tab === 'buttons' ? buttonsContent :
    tab === 'list'    ? listContent    :
    ctaContent;

  const validation = useMemo(
    () => validateInteractive(currentContent, provider),
    [currentContent, provider],
  );

  const canSend = validation.valid && !isSending && !sent;

  const handleSend = async () => {
    if (!canSend) return;
    setIsSending(true);
    setSendError(null);
    try {
      const token = window.localStorage.getItem('accessToken');
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL ?? ''}/api/conversations/${conversationId}/interactive`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          credentials: 'include',
          body: JSON.stringify({ phone, content: currentContent }),
        }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? 'Failed to send interactive message');
      setSent(true);
      onSent?.();
      setTimeout(onClose, 1200);
    } catch (err) {
      setSendError(err instanceof Error ? err.message : 'Failed to send');
    } finally {
      setIsSending(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      aria-label="Interactive Message"
      overlayClassName="bg-black/50"
      className="w-full max-w-3xl max-h-[90vh] rounded-2xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#111B21] shadow-2xl flex flex-col overflow-hidden"
    >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 dark:border-white/10 px-5 py-4">
          <div>
            <h2 className="text-base font-semibold text-gray-900 dark:text-white">Interactive Message</h2>
            <p className="text-xs text-gray-500 dark:text-[#8696A0] mt-0.5">
              Requires active 24-hour session window — customer must have messaged first
            </p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/10 transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200 dark:border-white/10 px-5">
          {(Object.keys(TAB_LABELS) as Tab[]).map(t => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                tab === t
                  ? 'border-[#25D366] text-[#25D366]'
                  : 'border-transparent text-gray-500 dark:text-[#8696A0] hover:text-gray-700 dark:hover:text-white'
              }`}
            >
              {TAB_LABELS[t]}
            </button>
          ))}
        </div>

        {/* Body — split: form + preview */}
        <div className="flex flex-1 overflow-hidden">
          {/* Form */}
          <div className="flex-1 overflow-y-auto p-5 space-y-1">
            {tab === 'buttons' && (
              <ButtonsTab content={buttonsContent} onChange={setButtonsContent} />
            )}
            {tab === 'list' && (
              <ListTab content={listContent} onChange={setListContent} />
            )}
            {tab === 'cta' && (
              <CtaTab content={ctaContent} onChange={setCtaContent} />
            )}

            <ValidationPanel content={currentContent} provider={provider} />
          </div>

          {/* Preview */}
          {showPreview && (
            <div className="w-72 shrink-0 border-l border-gray-200 dark:border-white/10 overflow-y-auto p-4 bg-gray-50 dark:bg-[#0B141A] space-y-3">
              <span className="text-[10px] uppercase tracking-widest font-semibold text-gray-400 dark:text-[#8696A0]">Live Preview</span>
              <PreviewPane content={currentContent} />
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-gray-200 dark:border-white/10 px-5 py-3 bg-gray-50 dark:bg-[#0B141A]">
          <button
            type="button"
            onClick={() => setShowPreview(v => !v)}
            className="text-xs text-gray-500 dark:text-[#8696A0] hover:text-gray-700 dark:hover:text-white transition-colors"
          >
            {showPreview ? 'Hide preview' : 'Show preview'}
          </button>

          <div className="flex items-center gap-3">
            {sendError && (
              <p className="text-xs text-red-500">{sendError}</p>
            )}
            {sent && (
              <div className="flex items-center gap-1.5 text-xs text-[#25D366]">
                <CheckCircle2 className="h-4 w-4" />
                <span>Sent!</span>
              </div>
            )}
            <button type="button" onClick={onClose}
              className="rounded-xl border border-gray-200 dark:border-white/10 px-4 py-2 text-sm text-gray-600 dark:text-[#8696A0] hover:bg-gray-100 dark:hover:bg-white/5 transition-colors">
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSend}
              disabled={!canSend}
              className="flex items-center gap-2 rounded-xl bg-[#25D366] px-4 py-2 text-sm font-semibold text-white hover:bg-[#1FAA5C] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {isSending
                ? <><span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" /> Sending…</>
                : <><Send className="h-4 w-4" /> Send</>
              }
            </button>
          </div>
        </div>
    </Modal>
  );
}
