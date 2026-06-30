'use client';

import { Suspense, useState, useCallback, useEffect, useRef, type RefObject } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import {
  ArrowLeft, Save, Loader2, Check, Plus, Trash2, X,
  Smartphone, AlertTriangle, Info, CheckCircle2,
  ChevronDown, ChevronUp, Upload, Type, ImageIcon,
} from 'lucide-react';
import { useSession } from 'next-auth/react';
import { api, apiForm } from '../../../../lib/api';
import type { CanonicalTemplate, CanonicalButton, TemplateCategory, CanonicalHeader } from '../../../../lib/template-engine/schema';
import { TEMPLATE_CATEGORIES, TEMPLATE_LANGUAGES, isCanonicalPayload, isLegacyPayload } from '../../../../lib/template-engine/schema';
import { validateTemplate } from '../../../../lib/template-engine/validator';
import { toRenderable, extractVariableNames, legacyBlocksToCanonical, deriveTemplateType } from '../../../../lib/template-engine/compiler';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

// ── Default template ──────────────────────────────────────────────────────────

const DEFAULT_TEMPLATE: CanonicalTemplate = {
  name: 'Untitled Template',
  category: 'GENERAL',
  language: 'en_US',
  body: { text: '' },
  _meta: { variableNames: [], previewValues: {} },
};

// ── Field primitives ──────────────────────────────────────────────────────────

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2">
        <span className="text-[10px] uppercase tracking-widest font-semibold text-gray-500 dark:text-[#8696A0]">{label}</span>
        {hint && <span className="text-[10px] text-gray-400 dark:text-[#8696A0]">{hint}</span>}
      </div>
      {children}
    </div>
  );
}

function Input({ value, onChange, placeholder, maxLength, className = '' }: {
  value: string; onChange: (v: string) => void; placeholder?: string; maxLength?: number; className?: string;
}) {
  return (
    <div className="relative">
      <input
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        maxLength={maxLength}
        className={`w-full rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-[#111B21] px-3 py-2 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:border-[#25D366] ${className}`}
      />
      {maxLength && (
        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-gray-300 dark:text-white/20 pointer-events-none">
          {value.length}/{maxLength}
        </span>
      )}
    </div>
  );
}

function Textarea({ value, onChange, placeholder, maxLength, rows = 4, textareaRef }: {
  value: string; onChange: (v: string) => void; placeholder?: string; maxLength?: number; rows?: number;
  textareaRef?: RefObject<HTMLTextAreaElement>;
}) {
  return (
    <div className="relative">
      <textarea
        ref={textareaRef}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        maxLength={maxLength}
        rows={rows}
        className="w-full rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-[#111B21] px-3 py-2 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:border-[#25D366] resize-none"
      />
      {maxLength && (
        <span className="absolute end-2 bottom-2 text-[10px] text-gray-300 dark:text-white/20 pointer-events-none">
          {value.length}/{maxLength}
        </span>
      )}
    </div>
  );
}

// ── Section card ──────────────────────────────────────────────────────────────

function Section({ title, badge, onRemove, children, hasError, hasWarning }: {
  title: string; badge?: string; onRemove?: () => void; children: React.ReactNode;
  hasError?: boolean; hasWarning?: boolean;
}) {
  const [open, setOpen] = useState(true);
  return (
    <div className={`rounded-2xl border bg-white dark:bg-[#202C33] overflow-hidden ${
      hasError ? 'border-rose-400/60' : hasWarning ? 'border-amber-400/60' : 'border-gray-200 dark:border-white/10'
    }`}>
      <div
        className="flex items-center gap-2 px-4 py-2.5 border-b border-gray-100 dark:border-white/5 cursor-pointer select-none"
        onClick={() => setOpen(o => !o)}
      >
        <span className="text-xs font-semibold text-gray-700 dark:text-white flex-1">{title}</span>
        {badge && (
          <span className="rounded-full bg-gray-100 dark:bg-white/10 px-2 py-0.5 text-[10px] text-gray-500 dark:text-[#8696A0]">
            {badge}
          </span>
        )}
        {hasError   && <AlertTriangle className="h-3.5 w-3.5 text-rose-500 flex-shrink-0" />}
        {hasWarning && !hasError && <AlertTriangle className="h-3.5 w-3.5 text-amber-500 flex-shrink-0" />}
        {onRemove && (
          <button
            type="button"
            onClick={e => { e.stopPropagation(); onRemove(); }}
            className="text-gray-400 hover:text-rose-500 transition-colors"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
        {open ? <ChevronUp className="h-3.5 w-3.5 text-gray-400" /> : <ChevronDown className="h-3.5 w-3.5 text-gray-400" />}
      </div>
      {open && <div className="p-4 space-y-3">{children}</div>}
    </div>
  );
}

// ── Header editor ─────────────────────────────────────────────────────────────

function HeaderEditor({
  header, onChange, onRemove, hasError, hasWarning,
}: {
  header: CanonicalHeader; onChange: (h: CanonicalHeader) => void; onRemove: () => void;
  hasError?: boolean; hasWarning?: boolean;
}) {
  const { t } = useTranslation('templates');
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const headerTypes: Array<{ type: CanonicalHeader['type']; label: string }> = [
    { type: 'TEXT', label: '📝 Text' },
    { type: 'IMAGE', label: '🖼️ Image' },
    { type: 'VIDEO', label: '🎥 Video' },
    { type: 'DOCUMENT', label: '📄 Document' },
  ];

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setUploadError(null);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await apiForm('/api/upload', fd);
      const url = `${API_BASE}${res.url}`;
      const type = file.type.startsWith('image/') ? 'IMAGE' : file.type.startsWith('video/') ? 'VIDEO' : 'DOCUMENT';
      onChange({ type, url, filename: file.name } as CanonicalHeader);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  return (
    <Section title={t('builder.header')} badge={t('builder.optional')} onRemove={onRemove} hasError={hasError} hasWarning={hasWarning}>
      <div className="flex gap-1.5 flex-wrap">
        {headerTypes.map(({ type, label }) => (
          <button
            key={type}
            type="button"
            onClick={() => {
              if (type === 'TEXT') onChange({ type: 'TEXT', text: '' });
              else onChange({ type, url: '' } as CanonicalHeader);
            }}
            className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
              header.type === type
                ? 'bg-[#25D366] text-white border-[#25D366]'
                : 'border-gray-200 dark:border-white/10 text-gray-600 dark:text-[#8696A0] hover:border-[#25D366]/50'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {header.type === 'TEXT' && (
        <Field label={t('builder.headerText')} hint={t('builder.headerTextHint')}>
          <Input
            value={header.text}
            onChange={v => onChange({ ...header, text: v })}
            placeholder="e.g. ✅ Order #{{order_id}} Confirmed"
            maxLength={60}
          />
        </Field>
      )}

      {(header.type === 'IMAGE' || header.type === 'VIDEO' || header.type === 'DOCUMENT') && (
        <>
          <Field label={t('builder.uploadFile')}>
            <input
              ref={fileRef}
              type="file"
              accept={header.type === 'IMAGE' ? 'image/*' : header.type === 'VIDEO' ? 'video/*' : '*/*'}
              onChange={handleFile}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="w-full flex items-center justify-center gap-2 rounded-xl border border-dashed border-gray-300 dark:border-white/20 py-2.5 text-sm text-gray-600 dark:text-[#8696A0] hover:border-[#25D366]/50 hover:text-[#25D366] disabled:opacity-50 transition-colors"
            >
              {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              {uploading ? t('builder.uploading') : t('builder.pickFromDevice')}
            </button>
            {uploadError && <p className="text-xs text-rose-500 mt-1">{uploadError}</p>}
          </Field>
          <Field label={t('builder.orEnterUrl')}>
            <Input
              value={(header as any).url ?? ''}
              onChange={v => onChange({ ...header, url: v } as CanonicalHeader)}
              placeholder="https://example.com/image.jpg"
            />
          </Field>
          {header.type === 'DOCUMENT' && (
            <Field label={t('builder.filenameOptional')}>
              <Input
                value={(header as any).filename ?? ''}
                onChange={v => onChange({ ...header, filename: v } as CanonicalHeader)}
                placeholder="invoice.pdf"
              />
            </Field>
          )}
          {(header as any).url && header.type === 'IMAGE' && (
            <img
              src={(header as any).url}
              alt=""
              className="w-full rounded-xl object-cover max-h-32"
              onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
            />
          )}
        </>
      )}
    </Section>
  );
}

// ── Buttons editor ────────────────────────────────────────────────────────────

function ButtonsEditor({
  buttons, onChange, onRemove, hasError, hasWarning,
}: {
  buttons: CanonicalButton[]; onChange: (b: CanonicalButton[]) => void; onRemove: () => void;
  hasError?: boolean; hasWarning?: boolean;
}) {
  const { t } = useTranslation('templates');
  const qr  = buttons.filter(b => b.type === 'QUICK_REPLY');
  const cta = buttons.filter(b => b.type !== 'QUICK_REPLY');
  const mode = cta.length > 0 ? 'CTA' : 'QR';

  const switchMode = (next: 'QR' | 'CTA') => {
    if (next === 'QR')  onChange([{ type: 'QUICK_REPLY', text: 'Option 1' }]);
    if (next === 'CTA') onChange([{ type: 'URL', text: 'Learn More', url: '' }]);
  };

  const updateBtn = (i: number, patch: Partial<CanonicalButton>) =>
    onChange(buttons.map((b, idx) => idx === i ? { ...b, ...patch } as CanonicalButton : b));

  const removeBtn = (i: number) => onChange(buttons.filter((_, idx) => idx !== i));

  const addQR = () => {
    if (buttons.length < 10) onChange([...buttons, { type: 'QUICK_REPLY', text: `Option ${buttons.length + 1}` }]);
  };
  const addCTA = () => {
    const hasUrl   = buttons.some(b => b.type === 'URL');
    const hasPhone = buttons.some(b => b.type === 'PHONE_NUMBER');
    if (!hasUrl) onChange([...buttons, { type: 'URL', text: 'Visit Website', url: '' }]);
    else if (!hasPhone) onChange([...buttons, { type: 'PHONE_NUMBER', text: 'Call Us', phone_number: '' }]);
  };

  return (
    <Section title={t('builder.buttons')} badge={t('builder.optional')} onRemove={onRemove} hasError={hasError} hasWarning={hasWarning}>
      <Field label={t('builder.buttonType')}>
        <div className="flex gap-1.5">
          {(['QR', 'CTA'] as const).map(m => (
            <button
              key={m}
              type="button"
              onClick={() => switchMode(m)}
              className={`flex-1 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                mode === m
                  ? 'bg-[#25D366] text-white border-[#25D366]'
                  : 'border-gray-200 dark:border-white/10 text-gray-600 dark:text-[#8696A0] hover:border-[#25D366]/50'
              }`}
            >
              {m === 'QR' ? t('builder.quickReplyBtn') : t('builder.ctaBtn')}
            </button>
          ))}
        </div>
      </Field>

      {mode === 'QR' && (
        <p className="text-[11px] text-gray-400 dark:text-[#8696A0]">
          Quick replies are sent as numbered options in WhatsApp — up to 10 options.
        </p>
      )}

      <div className="space-y-2.5">
        {buttons.map((btn, i) => (
          <div key={i} className="rounded-xl border border-gray-200 dark:border-white/10 p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 dark:text-[#8696A0]">
                {btn.type === 'QUICK_REPLY' ? t('builder.buttonTypes.QUICK_REPLY') : btn.type === 'URL' ? t('builder.buttonTypes.URL') : t('builder.buttonTypes.PHONE_NUMBER')}
              </span>
              {buttons.length > 1 && (
                <button type="button" onClick={() => removeBtn(i)} className="text-rose-400 hover:text-rose-500">
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            <Field label={t('builder.buttonLabel')} hint={t('builder.buttonLabelHint')}>
              <Input
                value={btn.text}
                onChange={v => updateBtn(i, { text: v })}
                placeholder={btn.type === 'QUICK_REPLY' ? 'Confirm' : btn.type === 'URL' ? 'Visit Website' : 'Call Us'}
                maxLength={60}
              />
            </Field>
            {btn.type === 'URL' && (
              <Field label={t('builder.buttonUrl')} hint={t('builder.buttonUrlHint')}>
                <Input
                  value={btn.url}
                  onChange={v => updateBtn(i, { url: v } as any)}
                  placeholder="https://example.com/{{tracking_id}}"
                />
              </Field>
            )}
            {btn.type === 'PHONE_NUMBER' && (
              <Field label={t('builder.buttonPhone')}>
                <Input
                  value={btn.phone_number}
                  onChange={v => updateBtn(i, { phone_number: v } as any)}
                  placeholder="+1 234 567 8900"
                />
              </Field>
            )}
          </div>
        ))}
      </div>

      {mode === 'QR' && buttons.length < 10 && (
        <button
          type="button"
          onClick={addQR}
          className="w-full rounded-xl border border-dashed border-gray-200 dark:border-white/10 py-2 text-xs text-gray-500 hover:border-[#25D366]/50 hover:text-[#25D366] transition-colors flex items-center justify-center gap-1"
        >
          <Plus className="h-3.5 w-3.5" /> {t('builder.addQuickReply')}
        </button>
      )}
      {mode === 'CTA' && buttons.length < 2 && (
        <button
          type="button"
          onClick={addCTA}
          className="w-full rounded-xl border border-dashed border-gray-200 dark:border-white/10 py-2 text-xs text-gray-500 hover:border-[#25D366]/50 hover:text-[#25D366] transition-colors flex items-center justify-center gap-1"
        >
          <Plus className="h-3.5 w-3.5" /> {t('builder.addButton')} {!buttons.some(b => b.type === 'URL') ? 'URL' : t('builder.buttonTypes.PHONE_NUMBER')}
        </button>
      )}
    </Section>
  );
}

// ── WhatsApp preview ──────────────────────────────────────────────────────────

function WaText({ text }: { text: string }) {
  const html = text
    .replace(/\*(.*?)\*/g, '<strong>$1</strong>')
    .replace(/_(.*?)_/g, '<em>$1</em>')
    .replace(/~(.*?)~/g, '<s>$1</s>')
    .replace(/\n/g, '<br />');
  return <span dangerouslySetInnerHTML={{ __html: html }} className="whitespace-pre-wrap break-words" />;
}

function WhatsAppPreview({ template, vars, onVarChange }: {
  template: CanonicalTemplate; vars: Record<string, string>;
  onVarChange?: (name: string, value: string) => void;
}) {
  const { t } = useTranslation('templates');
  const renderable = toRenderable(template, vars);
  const isEmpty = !renderable.body.trim() && !renderable.header;

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-200 dark:border-white/10 bg-[#202C33]">
        <div className="h-7 w-7 rounded-full bg-[#25D366]/20 flex items-center justify-center text-xs">💬</div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-white">WhatsApp Preview</p>
          <p className="text-[10px] text-white/40">Exact rendering via Baileys</p>
        </div>
        <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium bg-green-500/20 text-green-300">
          📱 Baileys
        </span>
      </div>

      <div
        className="flex-1 overflow-y-auto p-4 bg-[#0B141A]"
        style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(255,255,255,0.025) 1px, transparent 0)', backgroundSize: '18px 18px' }}
      >
        {isEmpty ? (
          <div className="flex flex-col items-center justify-center h-full text-white/20 text-sm text-center gap-2">
            <Type className="h-8 w-8" />
            <p>{t('builder.previewVariablesHint')}</p>
          </div>
        ) : (
          <div className="flex flex-col items-end">
            <div className="max-w-[90%] min-w-[160px] rounded-2xl rounded-tr-sm bg-[#005C4B] text-white shadow-lg overflow-hidden">
              {renderable.header && (
                <div className="border-b border-white/10">
                  {renderable.header.type === 'TEXT' && (
                    <div className="px-3 pt-2.5 font-bold text-sm">
                      <WaText text={renderable.header.text ?? ''} />
                    </div>
                  )}
                  {renderable.header.type === 'IMAGE' && renderable.header.url && (
                    <img
                      src={renderable.header.url}
                      alt=""
                      className="w-full object-cover max-h-40"
                      onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                    />
                  )}
                  {renderable.header.type === 'IMAGE' && !renderable.header.url && (
                    <div className="h-24 bg-white/10 flex items-center justify-center text-white/40 text-sm">
                      <ImageIcon className="h-6 w-6" />
                    </div>
                  )}
                  {(renderable.header.type === 'VIDEO' || renderable.header.type === 'DOCUMENT') && (
                    <div className="flex items-center gap-2 px-3 py-2 bg-white/10">
                      <span className="text-lg">{renderable.header.type === 'VIDEO' ? '🎥' : '📄'}</span>
                      <span className="text-xs text-white/70 truncate">
                        {renderable.header.filename ?? renderable.header.type.toLowerCase()}
                      </span>
                    </div>
                  )}
                </div>
              )}

              <div className="px-3 pt-2.5 pb-1 text-sm">
                <WaText text={renderable.body} />
              </div>

              {renderable.footer && (
                <div className="px-3 pb-1 text-[11px] text-white/50">
                  {renderable.footer}
                </div>
              )}

              <div className="flex items-center justify-end gap-1 px-3 pb-1.5">
                <span className="text-[10px] text-white/40">now</span>
                <span className="text-[10px] text-[#53BDEB]">✓✓</span>
              </div>

              {renderable.buttons && renderable.buttons.length > 0 && (
                <div className="border-t border-white/20">
                  {renderable.buttons.map((btn, i) => (
                    <div key={i} className={`px-3 py-2 text-center text-sm font-semibold text-[#53BDEB] ${i > 0 ? 'border-t border-white/10' : ''}`}>
                      {btn.type === 'URL' && '🔗 '}
                      {btn.type === 'PHONE_NUMBER' && '📞 '}
                      {btn.text}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Auto-downgrade note for buttons */}
            {renderable.buttons && renderable.buttons.length > 0 && (
              <div className="mt-2 max-w-[90%] rounded-xl bg-amber-500/10 border border-amber-500/20 px-3 py-1.5 text-[10px] text-amber-400">
                ↳ Sent as numbered text options in WhatsApp
              </div>
            )}
          </div>
        )}
      </div>

      <div className="border-t border-white/10 bg-[#111B21] px-4 py-3 space-y-2 max-h-52 overflow-y-auto">
        <p className="text-[10px] text-white/30 uppercase tracking-wider">{t('builder.previewVariables')}</p>
        {(template._meta?.variableNames ?? []).length === 0 ? (
          <p className="text-[11px] text-white/20">{t('builder.noVariables')}</p>
        ) : (
          (template._meta?.variableNames ?? []).map(v => (
            <div key={v} className="flex items-center gap-2">
              <span className="text-[10px] font-mono text-[#25D366] w-24 flex-shrink-0">{`{{${v}}}`}</span>
              <input
                value={vars[v] ?? ''}
                onChange={e => onVarChange?.(v, e.target.value)}
                placeholder={`e.g. ${v}`}
                className="flex-1 bg-white/5 rounded-lg px-2 py-1 text-[11px] text-white/70 border border-white/10 focus:outline-none focus:border-[#25D366]/50 placeholder:text-white/20"
              />
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// ── Validation panel ──────────────────────────────────────────────────────────

function ValidationPanel({ template }: { template: CanonicalTemplate }) {
  const { t } = useTranslation('templates');
  const result = validateTemplate(template);
  return (
    <div className="space-y-2 px-3 py-3">
      <div className={`flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold ${
        result.sendable
          ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
          : result.errors > 0
          ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20'
          : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20'
      }`}>
        {result.sendable ? (
          <><CheckCircle2 className="h-3.5 w-3.5" /> Ready to send</>
        ) : result.errors > 0 ? (
          <><AlertTriangle className="h-3.5 w-3.5" /> {result.errors} issue{result.errors !== 1 ? 's' : ''} to fix</>
        ) : (
          <><Info className="h-3.5 w-3.5" /> {result.warnings} warning{result.warnings !== 1 ? 's' : ''}</>
        )}
      </div>

      {result.issues.map((issue, i) => (
        <div key={i} className={`flex items-start gap-1.5 text-[11px] rounded-lg px-2.5 py-1.5 ${
          issue.level === 'error'   ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400' :
          issue.level === 'warning' ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400' :
          'bg-blue-500/10 text-blue-600 dark:text-blue-300'
        }`}>
          {issue.level === 'error'   && <AlertTriangle className="h-3 w-3 mt-0.5 flex-shrink-0" />}
          {issue.level === 'warning' && <AlertTriangle className="h-3 w-3 mt-0.5 flex-shrink-0" />}
          {issue.level === 'info'    && <Info className="h-3 w-3 mt-0.5 flex-shrink-0" />}
          <span>{issue.message}</span>
        </div>
      ))}

      {result.issues.length === 0 && (
        <p className="text-[11px] text-gray-400 dark:text-[#8696A0] text-center py-2">{t('builder.noIssues')}</p>
      )}
    </div>
  );
}

// ── Common template variables ─────────────────────────────────────────────────

const COMMON_VARS = ['name', 'first_name', 'phone', 'company', 'order_id', 'date', 'amount', 'link'];

// ── Main builder ──────────────────────────────────────────────────────────────

function BuilderContent() {
  const { t } = useTranslation('templates');
  const router = useRouter();
  const params = useSearchParams();
  const templateId = params.get('id');
  const { status } = useSession();

  const bodyRef = useRef<HTMLTextAreaElement>(null);

  const [template, setTemplate] = useState<CanonicalTemplate>(DEFAULT_TEMPLATE);
  const [previewVars, setPreviewVars] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [showTestSend, setShowTestSend] = useState(false);
  const [testPhone, setTestPhone] = useState('');
  const [testSending, setTestSending] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [mobileTab, setMobileTab] = useState<'build' | 'preview'>('build');

  // ── Load existing template ────────────────────────────────────────────────
  useEffect(() => {
    if (!templateId || status !== 'authenticated') return;
    api.get('/api/templates').then((templates: any[]) => {
      const found = templates.find((x: any) => x.id === templateId);
      if (!found) return;
      let canonical: CanonicalTemplate;
      if (isCanonicalPayload(found.payload)) {
        canonical = found.payload;
      } else if (isLegacyPayload(found.payload)) {
        canonical = legacyBlocksToCanonical(
          found.payload.blocks, found.name, found.payload.category ?? found.category, found.language,
        );
      } else {
        canonical = {
          name: found.name,
          category: (found.category as TemplateCategory) ?? 'GENERAL',
          language: found.language ?? 'en_US',
          body: { text: found.content ?? '' },
        };
      }
      const varNames = extractVariableNames(canonical);
      canonical._meta = {
        ...canonical._meta,
        variableNames: canonical._meta?.variableNames ?? varNames,
        previewValues: canonical._meta?.previewValues ?? {},
      };
      setTemplate(canonical);
      setPreviewVars(canonical._meta?.previewValues ?? {});
    }).catch(() => {});
  }, [templateId, status]);

  const update = useCallback((patch: Partial<CanonicalTemplate>) => {
    setTemplate(prev => {
      const next = { ...prev, ...patch };
      const varNames = extractVariableNames(next);
      return { ...next, _meta: { ...next._meta, variableNames: varNames } };
    });
  }, []);

  const insertVariable = useCallback((varName: string) => {
    const ta = bodyRef.current;
    const token = `{{${varName}}}`;
    if (!ta) {
      update({ body: { text: template.body.text + token } });
      return;
    }
    const start = ta.selectionStart ?? ta.value.length;
    const end = ta.selectionEnd ?? ta.value.length;
    const newText = ta.value.substring(0, start) + token + ta.value.substring(end);
    update({ body: { text: newText } });
    requestAnimationFrame(() => {
      ta.focus();
      const pos = start + token.length;
      ta.setSelectionRange(pos, pos);
    });
  }, [template.body.text, update]);

  // ── Save ──────────────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!template.name.trim()) { setSaveError('Template name is required'); return; }
    if (!template.body.text.trim()) { setSaveError('Body text is required'); return; }

    setSaving(true);
    setSaveError(null);

    const varNames = extractVariableNames(template);
    const canonical: CanonicalTemplate = {
      ...template,
      _meta: { ...template._meta, variableNames: varNames, previewValues: previewVars },
    };

    try {
      const body = {
        name: template.name.trim(),
        content: template.body.text,
        type: deriveTemplateType(template),
        status: 'DRAFT',
        category: template.category,
        language: template.language,
        payload: canonical,
        variables: varNames,
      };
      if (templateId) {
        await api.put(`/api/templates/${templateId}`, { ...body, status: 'PUBLISHED' });
      } else {
        await api.post('/api/templates', body);
      }
      setSaved(true);
      setTimeout(() => { setSaved(false); router.push('/templates'); }, 1500);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleTestSend = async () => {
    if (!templateId) {
      setTestResult({ ok: false, message: 'Save the template first before sending a test.' });
      return;
    }
    if (!testPhone.trim()) {
      setTestResult({ ok: false, message: 'Enter a phone number (e.g. +1234567890).' });
      return;
    }
    setTestSending(true);
    setTestResult(null);
    try {
      const res = await api.post(`/api/templates/${templateId}/send`, {
        phone: testPhone.trim(),
        variables: previewVars,
      });
      setTestResult({ ok: true, message: `Sent via Baileys! Message ID: ${res.messageId ?? '—'}` });
    } catch (err) {
      setTestResult({ ok: false, message: err instanceof Error ? err.message : 'Failed to send test' });
    } finally {
      setTestSending(false);
    }
  };

  const varNames = template._meta?.variableNames ?? [];
  const validation = validateTemplate(template);

  return (
    <>
    {/* ── Mobile layout (below lg) ─────────────────────────────────────────── */}
    <div className="flex flex-col lg:hidden -mx-4 sm:-mx-6 -my-6 bg-gray-50 dark:bg-[#0B141A]">

      {/* Mobile action bar — green gradient header */}
      <div className="sticky top-0 z-20 flex items-center gap-2 px-3 py-2.5 bg-gradient-to-r from-[#16A34A] to-[#15803D] dark:from-[#0d4a21] dark:to-[#0b3d1c] shadow-[0_2px_12px_rgba(22,163,74,0.35)]">
        <button
          type="button"
          onClick={() => router.push('/templates')}
          className="flex items-center gap-1 shrink-0 text-white/80 hover:text-white transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <input
          value={template.name}
          onChange={e => update({ name: e.target.value })}
          className="flex-1 min-w-0 bg-transparent text-[13px] font-semibold text-white focus:outline-none placeholder:text-white/50"
          placeholder={t('builder.templateNamePlaceholder')}
        />
        {saveError && <AlertTriangle className="h-4 w-4 text-rose-300 shrink-0" />}
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="shrink-0 flex items-center gap-1.5 rounded-xl bg-white/20 backdrop-blur-sm border border-white/30 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60 transition-colors active:bg-white/30"
        >
          {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : saved ? <Check className="h-3 w-3" /> : <Save className="h-3 w-3" />}
          {saving ? t('builder.saving') : saved ? t('builder.saved') : t('builder.save')}
        </button>
      </div>

      {/* Mobile tabs */}
      <div className="bg-white dark:bg-[#182229] border-b border-gray-100 dark:border-white/[0.04]">
        <div className="flex">
          {(['build', 'preview'] as const).map(tab => (
            <button
              key={tab}
              type="button"
              onClick={() => setMobileTab(tab)}
              className={`flex-1 py-2.5 text-xs font-semibold border-b-2 transition-colors ${
                mobileTab === tab
                  ? 'border-[#16A34A] dark:border-[#25D366] text-[#16A34A] dark:text-[#25D366]'
                  : 'border-transparent text-gray-400 dark:text-[#8696A0]'
              }`}
            >
              {tab === 'build' ? t('builder.buildTab', { defaultValue: 'Build' }) : t('builder.previewTab', { defaultValue: 'Preview' })}
            </button>
          ))}
        </div>

        {/* Section add chips + category/language — only visible in build tab */}
        {mobileTab === 'build' && (
          <div className="flex items-center gap-1.5 px-3 py-2 overflow-x-auto">
            <button
              type="button"
              onClick={() => { if (!template.header) update({ header: { type: 'TEXT', text: '' } }); }}
              className={`shrink-0 flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium border transition-colors ${
                template.header
                  ? 'bg-[#25D366]/10 border-[#25D366]/30 text-[#25D366]'
                  : 'border-gray-200 dark:border-white/[0.08] text-gray-500 dark:text-[#8696A0]'
              }`}
            >
              {template.header ? <Check className="h-2.5 w-2.5" /> : <Plus className="h-2.5 w-2.5" />}
              {t('builder.addHeader')}
            </button>
            <button
              type="button"
              onClick={() => { if (!template.footer) update({ footer: { text: '' } }); }}
              className={`shrink-0 flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium border transition-colors ${
                template.footer
                  ? 'bg-[#25D366]/10 border-[#25D366]/30 text-[#25D366]'
                  : 'border-gray-200 dark:border-white/[0.08] text-gray-500 dark:text-[#8696A0]'
              }`}
            >
              {template.footer ? <Check className="h-2.5 w-2.5" /> : <Plus className="h-2.5 w-2.5" />}
              {t('builder.addFooter')}
            </button>
            <button
              type="button"
              onClick={() => { if (!template.buttons) update({ buttons: [{ type: 'QUICK_REPLY', text: 'Option 1' }] }); }}
              className={`shrink-0 flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium border transition-colors ${
                template.buttons
                  ? 'bg-[#25D366]/10 border-[#25D366]/30 text-[#25D366]'
                  : 'border-gray-200 dark:border-white/[0.08] text-gray-500 dark:text-[#8696A0]'
              }`}
            >
              {template.buttons ? <Check className="h-2.5 w-2.5" /> : <Plus className="h-2.5 w-2.5" />}
              {t('builder.addButtons')}
            </button>
            <div className="h-4 w-px bg-gray-200 dark:bg-white/[0.06] shrink-0" />
            <select
              value={template.category}
              onChange={e => update({ category: e.target.value as TemplateCategory })}
              className="shrink-0 rounded-xl border border-gray-200 dark:border-white/[0.08] bg-gray-50 dark:bg-[#1C2B34] px-2 py-1 text-[11px] text-gray-700 dark:text-white focus:outline-none focus:border-[#25D366]"
            >
              {TEMPLATE_CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
            <select
              value={template.language}
              onChange={e => update({ language: e.target.value })}
              className="shrink-0 rounded-xl border border-gray-200 dark:border-white/[0.08] bg-gray-50 dark:bg-[#1C2B34] px-2 py-1 text-[11px] text-gray-700 dark:text-white focus:outline-none focus:border-[#25D366]"
            >
              {TEMPLATE_LANGUAGES.map(l => <option key={l.code} value={l.code}>{l.label}</option>)}
            </select>
          </div>
        )}
      </div>

      {/* Build tab content */}
      {mobileTab === 'build' && (
        <div className="p-4 space-y-3 pb-6">
          {template.header && (
            <HeaderEditor
              header={template.header}
              onChange={h => update({ header: h })}
              onRemove={() => update({ header: undefined })}
              hasError={validation.issues.some(i => i.field === 'header' && i.level === 'error')}
              hasWarning={validation.issues.some(i => i.field === 'header' && i.level === 'warning')}
            />
          )}
          <Section
            title={t('builder.body')}
            badge={t('builder.required')}
            hasError={validation.issues.some(i => i.field === 'body' && i.level === 'error')}
          >
            <Textarea
              value={template.body.text}
              onChange={v => update({ body: { text: v } })}
              placeholder={t('builder.bodyPlaceholder')}
              maxLength={4096}
              rows={5}
              textareaRef={bodyRef}
            />
            <div className="flex flex-wrap items-center gap-1.5 pt-1">
              <span className="text-[10px] text-gray-400 dark:text-[#8696A0] shrink-0">Insert:</span>
              {COMMON_VARS.map(v => (
                <button
                  key={v}
                  type="button"
                  onClick={() => insertVariable(v)}
                  className="rounded-full bg-[#25D366]/10 border border-[#25D366]/20 px-2 py-0.5 text-[10px] font-mono text-[#25D366] hover:bg-[#25D366]/20 transition-colors"
                >
                  {`{{${v}}}`}
                </button>
              ))}
            </div>
            <p className="text-[11px] text-gray-400">{t('builder.bodyHint')}</p>
          </Section>
          {template.footer && (
            <Section
              title={t('builder.footer')}
              badge={t('builder.optional')}
              onRemove={() => update({ footer: undefined })}
              hasError={validation.issues.some(i => i.field === 'footer' && i.level === 'error')}
              hasWarning={validation.issues.some(i => i.field === 'footer' && i.level === 'warning')}
            >
              <Input
                value={template.footer.text}
                onChange={v => update({ footer: { text: v } })}
                placeholder={t('builder.footerPlaceholder')}
                maxLength={60}
              />
              <p className="text-[11px] text-gray-400">{t('builder.footerHint')}</p>
            </Section>
          )}
          {template.buttons && (
            <ButtonsEditor
              buttons={template.buttons}
              onChange={b => update({ buttons: b.length > 0 ? b : undefined })}
              onRemove={() => update({ buttons: undefined })}
              hasError={validation.issues.some(i => i.field === 'buttons' && i.level === 'error')}
              hasWarning={validation.issues.some(i => i.field === 'buttons' && i.level === 'warning')}
            />
          )}
          <ValidationPanel template={template} />
        </div>
      )}

      {/* Preview tab content */}
      {mobileTab === 'preview' && (
        <div className="h-[520px]">
          <WhatsAppPreview
            template={template}
            vars={previewVars}
            onVarChange={(name, value) => setPreviewVars(prev => ({ ...prev, [name]: value }))}
          />
        </div>
      )}
    </div>

    {/* ── Desktop layout (lg+) ──────────────────────────────────────────────── */}
    <div className="hidden lg:flex overflow-hidden -mx-4 sm:-mx-6 lg:-mx-8 -my-6" style={{ height: 'calc(100vh - 56px)' }}>

      {/* ── Left sidebar ── */}
      <aside className="w-56 flex-shrink-0 border-r border-gray-200 dark:border-white/10 bg-white dark:bg-[#111B21] flex flex-col overflow-hidden">
        <div className="px-3 py-3 border-b border-gray-200 dark:border-white/10">
          <button
            type="button"
            onClick={() => router.push('/templates')}
            className="flex items-center gap-1.5 text-sm text-gray-500 dark:text-[#8696A0] hover:text-gray-900 dark:hover:text-white transition-colors"
          >
            <ArrowLeft className="h-4 w-4" /> {t('title')}
          </button>
        </div>

        <div className="px-3 pt-3 pb-2">
          <p className="text-[10px] uppercase tracking-widest font-semibold text-gray-400 dark:text-[#8696A0] mb-2">{t('builder.sections')}</p>
          <div className="space-y-1.5">
            <button
              type="button"
              onClick={() => { if (!template.header) update({ header: { type: 'TEXT', text: '' } }); }}
              className={`w-full flex items-center gap-2 rounded-xl border px-2.5 py-2 text-xs font-medium transition-colors ${
                template.header
                  ? 'border-[#25D366]/40 bg-[#25D366]/5 text-[#25D366]'
                  : 'border-gray-200 dark:border-white/10 text-gray-600 dark:text-[#8696A0] hover:border-[#25D366]/40 hover:bg-[#25D366]/5'
              }`}
            >
              <Type className="h-3.5 w-3.5" />
              {template.header ? t('builder.headerAdded') : t('builder.addHeader')}
            </button>
            <button
              type="button"
              onClick={() => { if (!template.footer) update({ footer: { text: '' } }); }}
              className={`w-full flex items-center gap-2 rounded-xl border px-2.5 py-2 text-xs font-medium transition-colors ${
                template.footer
                  ? 'border-[#25D366]/40 bg-[#25D366]/5 text-[#25D366]'
                  : 'border-gray-200 dark:border-white/10 text-gray-600 dark:text-[#8696A0] hover:border-[#25D366]/40 hover:bg-[#25D366]/5'
              }`}
            >
              <Type className="h-3.5 w-3.5" />
              {template.footer ? t('builder.footerAdded') : t('builder.addFooter')}
            </button>
            <button
              type="button"
              onClick={() => { if (!template.buttons) update({ buttons: [{ type: 'QUICK_REPLY', text: 'Option 1' }] }); }}
              className={`w-full flex items-center gap-2 rounded-xl border px-2.5 py-2 text-xs font-medium transition-colors ${
                template.buttons
                  ? 'border-[#25D366]/40 bg-[#25D366]/5 text-[#25D366]'
                  : 'border-gray-200 dark:border-white/10 text-gray-600 dark:text-[#8696A0] hover:border-[#25D366]/40 hover:bg-[#25D366]/5'
              }`}
            >
              <Type className="h-3.5 w-3.5" />
              {template.buttons ? t('builder.buttonsAdded') : t('builder.addButtons')}
            </button>
          </div>
        </div>

        {varNames.length > 0 && (
          <div className="border-t border-gray-200 dark:border-white/10 px-3 py-3">
            <p className="text-[10px] uppercase tracking-widest text-gray-400 dark:text-[#8696A0] mb-1.5">{t('builder.variables')}</p>
            <div className="flex flex-wrap gap-1">
              {varNames.map(v => (
                <span key={v} className="rounded-full bg-[#25D366]/10 border border-[#25D366]/20 px-2 py-0.5 text-[10px] font-mono text-[#25D366]">
                  {`{{${v}}}`}
                </span>
              ))}
            </div>
          </div>
        )}

        <div className="border-t border-gray-200 dark:border-white/10 mt-auto">
          <ValidationPanel template={template} />
        </div>
      </aside>

      {/* ── Center canvas ── */}
      <main className="flex-1 flex flex-col overflow-hidden bg-gray-50 dark:bg-[#0B141A]">
        {/* Top bar */}
        <div className="flex items-center gap-2 px-4 py-2.5 bg-white dark:bg-[#111B21] border-b border-gray-200 dark:border-white/10 flex-shrink-0">
          <input
            value={template.name}
            onChange={e => update({ name: e.target.value })}
            className="flex-1 bg-transparent text-base font-semibold text-gray-900 dark:text-white focus:outline-none placeholder:text-gray-400 min-w-0"
            placeholder={t('builder.templateNamePlaceholder')}
          />

          {/* Category */}
          <select
            value={template.category}
            onChange={e => update({ category: e.target.value as TemplateCategory })}
            className="rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-[#202C33] px-2.5 py-1.5 text-xs text-gray-700 dark:text-white focus:outline-none focus:border-[#25D366]"
          >
            {TEMPLATE_CATEGORIES.map(c => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </select>

          {/* Language */}
          <select
            value={template.language}
            onChange={e => update({ language: e.target.value })}
            className="rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-[#202C33] px-2.5 py-1.5 text-xs text-gray-700 dark:text-white focus:outline-none focus:border-[#25D366]"
          >
            {TEMPLATE_LANGUAGES.map(l => (
              <option key={l.code} value={l.code}>{l.label}</option>
            ))}
          </select>

          {saveError && <span className="text-xs text-rose-500 max-w-[160px] truncate">{saveError}</span>}

          {/* Test Send */}
          {templateId && (
            <button
              type="button"
              onClick={() => { setShowTestSend(v => !v); setTestResult(null); }}
              className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-medium flex-shrink-0 transition-colors ${
                showTestSend
                  ? 'border-[#25D366]/60 bg-[#25D366]/10 text-[#25D366]'
                  : 'border-gray-200 dark:border-white/10 text-gray-600 dark:text-[#8696A0] hover:border-[#25D366]/40 hover:bg-[#25D366]/5'
              }`}
            >
              <Smartphone className="h-3.5 w-3.5" />
              {t('builder.testSend')}
            </button>
          )}

          <button
            onClick={handleSave}
            disabled={saving}
            className="inline-flex items-center gap-1.5 rounded-xl bg-[#25D366] px-4 py-2 text-sm font-semibold text-white hover:bg-[#25D366]/90 disabled:opacity-60 transition-colors flex-shrink-0"
          >
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : saved ? <Check className="h-3.5 w-3.5" /> : <Save className="h-3.5 w-3.5" />}
            {saving ? t('builder.saving') : saved ? t('builder.saved') : t('builder.save')}
          </button>
        </div>

        {/* Test Send panel */}
        {showTestSend && (
          <div className="border-b border-gray-200 dark:border-white/10 bg-white dark:bg-[#111B21] px-4 py-3 flex items-start gap-3 flex-shrink-0">
            <div className="flex-1 min-w-0 space-y-2">
              <p className="text-[11px] font-semibold text-gray-500 dark:text-[#8696A0] uppercase tracking-widest">
                Send test via Baileys
              </p>
              <div className="flex items-center gap-2">
                <input
                  type="tel"
                  value={testPhone}
                  onChange={e => setTestPhone(e.target.value)}
                  placeholder="+1 234 567 8900"
                  className="flex-1 rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-[#202C33] px-3 py-2 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:border-[#25D366]"
                />
                <button
                  type="button"
                  onClick={handleTestSend}
                  disabled={testSending || !testPhone.trim()}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-[#25D366] px-4 py-2 text-sm font-semibold text-white hover:bg-[#1FAA5C] disabled:opacity-50 transition-colors flex-shrink-0"
                >
                  {testSending
                    ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Sending…</>
                    : <><Save className="h-3.5 w-3.5" /> Send Test</>
                  }
                </button>
              </div>
              {testResult && (
                <div className={`flex items-center gap-2 text-xs rounded-lg px-2.5 py-1.5 ${
                  testResult.ok
                    ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                    : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20'
                }`}>
                  {testResult.ok ? <CheckCircle2 className="h-3.5 w-3.5 flex-shrink-0" /> : <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0" />}
                  {testResult.message}
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={() => setShowTestSend(false)}
              className="mt-0.5 text-gray-400 hover:text-gray-600 dark:hover:text-white transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* Sections */}
        <div className="flex-1 overflow-y-auto p-5">
          <div className="max-w-2xl mx-auto space-y-3">
            {template.header && (
              <HeaderEditor
                header={template.header}
                onChange={h => update({ header: h })}
                onRemove={() => update({ header: undefined })}
                hasError={validation.issues.some(i => i.field === 'header' && i.level === 'error')}
                hasWarning={validation.issues.some(i => i.field === 'header' && i.level === 'warning')}
              />
            )}

            <Section
              title={t('builder.body')}
              badge={t('builder.required')}
              hasError={validation.issues.some(i => i.field === 'body' && i.level === 'error')}
            >
              <Textarea
                value={template.body.text}
                onChange={v => update({ body: { text: v } })}
                placeholder={t('builder.bodyPlaceholder')}
                maxLength={4096}
                rows={6}
                textareaRef={bodyRef}
              />
              {/* Variable insertion chips */}
              <div className="flex flex-wrap items-center gap-1.5 pt-1">
                <span className="text-[10px] text-gray-400 dark:text-[#8696A0] shrink-0">Insert:</span>
                {COMMON_VARS.map(v => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => insertVariable(v)}
                    className="rounded-full bg-[#25D366]/10 border border-[#25D366]/20 px-2 py-0.5 text-[10px] font-mono text-[#25D366] hover:bg-[#25D366]/20 hover:border-[#25D366]/40 transition-colors"
                  >
                    {`{{${v}}}`}
                  </button>
                ))}
              </div>
              <p className="text-[11px] text-gray-400">
                {t('builder.bodyHint')}
              </p>
            </Section>

            {template.footer && (
              <Section
                title={t('builder.footer')}
                badge={t('builder.optional')}
                onRemove={() => update({ footer: undefined })}
                hasError={validation.issues.some(i => i.field === 'footer' && i.level === 'error')}
                hasWarning={validation.issues.some(i => i.field === 'footer' && i.level === 'warning')}
              >
                <Input
                  value={template.footer.text}
                  onChange={v => update({ footer: { text: v } })}
                  placeholder={t('builder.footerPlaceholder')}
                  maxLength={60}
                />
                <p className="text-[11px] text-gray-400">{t('builder.footerHint')}</p>
              </Section>
            )}

            {template.buttons && (
              <ButtonsEditor
                buttons={template.buttons}
                onChange={b => update({ buttons: b.length > 0 ? b : undefined })}
                onRemove={() => update({ buttons: undefined })}
                hasError={validation.issues.some(i => i.field === 'buttons' && i.level === 'error')}
                hasWarning={validation.issues.some(i => i.field === 'buttons' && i.level === 'warning')}
              />
            )}
          </div>
        </div>
      </main>

      {/* ── Right: preview ── */}
      <aside className="w-72 flex-shrink-0 border-l border-gray-200 dark:border-white/10 flex flex-col overflow-hidden">
        <WhatsAppPreview
          template={template}
          vars={previewVars}
          onVarChange={(name, value) => setPreviewVars(prev => ({ ...prev, [name]: value }))}
        />
      </aside>
    </div>
    </>
  );
}

export default function BuilderPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center h-64 text-gray-400">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    }>
      <BuilderContent />
    </Suspense>
  );
}
