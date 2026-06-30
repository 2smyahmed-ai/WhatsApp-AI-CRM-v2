'use client';

import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { X, Plus, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

// ─────────────────────────────────────────────────────────────────────────────
// Reusable form primitives for the AI Configuration screen. Styled to match the
// existing admin/chatbot page (WhatsApp dark theme).
// ─────────────────────────────────────────────────────────────────────────────

export function Toggle({
  checked,
  onChange,
  disabled,
}: {
  checked: boolean;
  onChange: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={onChange}
      className={cn(
        'relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#25D366]/50',
        checked ? 'bg-[#25D366]' : 'bg-gray-300 dark:bg-white/20',
        disabled && 'opacity-50 cursor-not-allowed',
      )}
    >
      <span
        className={cn(
          'inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform',
          // Direction-aware: in RTL the track is mirrored, so flip the slide.
          checked ? 'translate-x-6 rtl:-translate-x-6' : 'translate-x-1 rtl:-translate-x-1',
        )}
      />
    </button>
  );
}

export function SettingRow({
  label,
  description,
  children,
}: {
  label: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-[#202C33] p-4">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-black dark:text-white">{label}</p>
        {description && <p className="mt-0.5 text-xs text-gray-600 dark:text-[#8696A0]">{description}</p>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

export function FieldLabel({ children, hint }: { children: React.ReactNode; hint?: string }) {
  return (
    <label className="flex items-center gap-2 text-xs font-medium text-gray-700 dark:text-[#8696A0]">
      {children}
      {hint && <span className="text-[10px] text-gray-500 dark:text-[#8696A0]/60">{hint}</span>}
    </label>
  );
}

export function TextInput({
  value,
  onChange,
  placeholder,
  type = 'text',
  className,
  dir,
}: {
  value: string | number;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  className?: string;
  dir?: 'ltr' | 'rtl' | 'auto';
}) {
  return (
    <input
      type={type}
      value={value}
      dir={dir}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className={cn(
        'w-full rounded-lg border border-gray-300 dark:border-white/10 bg-white dark:bg-[#111B21] px-3 py-2 text-sm text-black dark:text-white placeholder:text-gray-500 dark:placeholder:text-[#8696A0] focus:outline-none focus:ring-2 focus:ring-[#25D366]/30',
        className,
      )}
    />
  );
}

export function TextArea({
  value,
  onChange,
  placeholder,
  rows = 3,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  rows?: number;
}) {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      rows={rows}
      dir="auto"
      placeholder={placeholder}
      className="w-full min-h-[88px] rounded-lg border border-gray-300 dark:border-white/10 bg-white dark:bg-[#111B21] px-3 py-2.5 text-sm leading-relaxed text-black dark:text-white placeholder:text-gray-500 dark:placeholder:text-[#8696A0] resize-y focus:outline-none focus:ring-2 focus:ring-[#25D366]/30"
    />
  );
}

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <FieldLabel hint={hint}>{label}</FieldLabel>
      {children}
    </div>
  );
}

export function Slider({
  label,
  value,
  onChange,
  min = 0,
  max = 1,
  step = 0.1,
  display,
  icon,
  hint,
  minLabel,
  maxLabel,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
  display?: string;
  icon?: React.ReactNode;
  hint?: string;
  minLabel?: string;
  maxLabel?: string;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {icon}
          <label className="text-xs font-medium text-gray-700 dark:text-[#8696A0]">{label}</label>
        </div>
        <span className="rounded-lg bg-gray-100 dark:bg-[#111B21] px-2 py-0.5 text-xs font-mono text-[#25D366]">
          {display ?? value}
        </span>
      </div>
      {hint && <p className="text-[11px] leading-4 text-gray-600 dark:text-[#8696A0]">{hint}</p>}
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full accent-[#25D366]"
      />
      {(minLabel || maxLabel) && (
        <div className="flex justify-between text-[10px] text-gray-600 dark:text-[#8696A0]">
          <span>{minLabel}</span>
          <span>{maxLabel}</span>
        </div>
      )}
    </div>
  );
}

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
}: {
  options: Array<{ value: T; label: string }>;
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={cn(
            'rounded-lg border px-3 py-1.5 text-xs font-medium transition-all',
            value === o.value
              ? 'border-[#25D366] bg-[#25D366]/10 text-[#25D366]'
              : 'border-gray-300 dark:border-white/10 bg-gray-100 dark:bg-[#202C33] text-gray-700 dark:text-[#8696A0] hover:border-gray-400 dark:hover:border-white/20 hover:text-black dark:hover:text-white',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** Add/remove an unlimited list of free-text strings (rules, topics, questions). */
export function TagListEditor({
  items,
  onChange,
  placeholder,
  multiline,
}: {
  items: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
  multiline?: boolean;
}) {
  const { t } = useTranslation('aiconfig');
  const [draft, setDraft] = useState('');

  const add = () => {
    const v = draft.trim();
    if (!v) return;
    onChange([...items, v]);
    setDraft('');
  };

  return (
    <div className="space-y-2">
      <div className="space-y-2">
        {items.map((item, i) => (
          <div key={i} className="flex items-start gap-2 rounded-lg border border-gray-300 dark:border-white/10 bg-gray-50 dark:bg-[#111B21] p-2.5">
            <textarea
              value={item}
              dir="auto"
              rows={multiline ? 2 : 1}
              onChange={(e) => {
                const next = [...items];
                next[i] = e.target.value;
                onChange(next);
              }}
              className="flex-1 resize-none bg-transparent text-sm text-black dark:text-white placeholder:text-gray-500 dark:placeholder:text-[#8696A0] focus:outline-none"
            />
            <button
              type="button"
              onClick={() => onChange(items.filter((_, idx) => idx !== i))}
              className="mt-0.5 shrink-0 rounded-md p-1 text-gray-500 dark:text-[#8696A0] hover:bg-gray-200 dark:hover:bg-white/5 hover:text-red-600 dark:hover:text-red-400"
              aria-label="Remove"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
        {items.length === 0 && (
          <p className="rounded-lg border border-dashed border-gray-300 dark:border-white/10 px-3 py-2 text-xs text-gray-600 dark:text-[#8696A0]">
            {t('common.noneYet')}
          </p>
        )}
      </div>
      <div className="flex items-center gap-2">
        <input
          value={draft}
          dir="auto"
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              add();
            }
          }}
          placeholder={placeholder}
          className="flex-1 rounded-lg border border-gray-300 dark:border-white/10 bg-white dark:bg-[#111B21] px-3 py-2 text-sm text-black dark:text-white placeholder:text-gray-500 dark:placeholder:text-[#8696A0] focus:outline-none focus:ring-2 focus:ring-[#25D366]/30"
        />
        <button
          type="button"
          onClick={add}
          className="inline-flex items-center gap-1 rounded-lg bg-[#25D366]/15 px-3 py-2 text-xs font-medium text-[#25D366] hover:bg-[#25D366]/25"
        >
          <Plus className="h-3.5 w-3.5" /> {t('common.add')}
        </button>
      </div>
    </div>
  );
}

/** Key/value editor for custom variables. */
export function KeyValueEditor({
  items,
  onChange,
}: {
  items: Array<{ key: string; value: string }>;
  onChange: (next: Array<{ key: string; value: string }>) => void;
}) {
  const { t } = useTranslation('aiconfig');
  return (
    <div className="space-y-2">
      {items.map((item, i) => (
        <div key={i} className="flex items-center gap-2">
          <input
            value={item.key}
            onChange={(e) => {
              const next = [...items];
              next[i] = { ...next[i], key: e.target.value };
              onChange(next);
            }}
            placeholder={t('common.variableName')}
            className="w-40 rounded-lg border border-gray-300 dark:border-white/10 bg-white dark:bg-[#111B21] px-3 py-2 text-sm text-black dark:text-white placeholder:text-gray-500 dark:placeholder:text-[#8696A0] focus:outline-none focus:ring-2 focus:ring-[#25D366]/30"
          />
          <input
            value={item.value}
            dir="auto"
            onChange={(e) => {
              const next = [...items];
              next[i] = { ...next[i], value: e.target.value };
              onChange(next);
            }}
            placeholder={t('common.value')}
            className="flex-1 rounded-lg border border-gray-300 dark:border-white/10 bg-white dark:bg-[#111B21] px-3 py-2 text-sm text-black dark:text-white placeholder:text-gray-500 dark:placeholder:text-[#8696A0] focus:outline-none focus:ring-2 focus:ring-[#25D366]/30"
          />
          <button
            type="button"
            onClick={() => onChange(items.filter((_, idx) => idx !== i))}
            className="shrink-0 rounded-md p-1.5 text-gray-500 dark:text-[#8696A0] hover:bg-gray-200 dark:hover:bg-white/5 hover:text-red-600 dark:hover:text-red-400"
            aria-label="Remove"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={() => onChange([...items, { key: '', value: '' }])}
        className="inline-flex items-center gap-1 rounded-lg bg-[#25D366]/15 px-3 py-2 text-xs font-medium text-[#25D366] hover:bg-[#25D366]/25"
      >
        <Plus className="h-3.5 w-3.5" /> {t('common.addVariable')}
      </button>
    </div>
  );
}

/**
 * Toggle a set of values on/off from a known list of options (e.g. tags or
 * lifecycle stages). Selected values are highlighted. `selected` may contain
 * values not present in `options` (e.g. a tag that was deleted) — those still
 * render as removable chips so the admin can clear them.
 */
export function ChipMultiSelect({
  options,
  selected,
  onChange,
  emptyLabel,
}: {
  options: string[];
  selected: string[];
  onChange: (next: string[]) => void;
  emptyLabel?: string;
}) {
  const toggle = (v: string) => {
    onChange(selected.includes(v) ? selected.filter((x) => x !== v) : [...selected, v]);
  };
  // Values selected but no longer in the options list.
  const orphans = selected.filter((v) => !options.includes(v));
  const all = [...options, ...orphans];

  if (all.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-gray-300 dark:border-white/10 px-3 py-2 text-xs text-gray-600 dark:text-[#8696A0]">
        {emptyLabel ?? 'No options available.'}
      </p>
    );
  }

  return (
    <div className="flex flex-wrap gap-2">
      {all.map((v) => {
        const active = selected.includes(v);
        return (
          <button
            key={v}
            type="button"
            onClick={() => toggle(v)}
            className={cn(
              'inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-xs font-medium transition-all',
              active
                ? 'border-[#25D366] bg-[#25D366]/15 text-[#25D366]'
                : 'border-gray-300 dark:border-white/10 bg-gray-100 dark:bg-[#202C33] text-gray-700 dark:text-[#8696A0] hover:border-gray-400 dark:hover:border-white/20 hover:text-black dark:hover:text-white',
            )}
          >
            {active && <X className="h-3 w-3" />}
            {v}
          </button>
        );
      })}
    </div>
  );
}

export function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-700 dark:text-[#8696A0]">{children}</p>
  );
}

export function Card({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('rounded-2xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-[#202C33] p-4 space-y-4', className)}>
      {children}
    </div>
  );
}

/**
 * Top-level "card" for the easy/single-page builder: an emoji + plain-language
 * title + subtitle, with the body below. Mobile-first (full width, generous
 * spacing). Use one per topic the business owner cares about.
 */
export function SectionCard({
  emoji,
  title,
  subtitle,
  badge,
  children,
}: {
  emoji: string;
  title: string;
  subtitle?: string;
  badge?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#111B21] p-4 sm:p-6 space-y-5">
      <header className="flex items-start gap-3">
        <span aria-hidden className="text-2xl leading-none shrink-0">{emoji}</span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-base sm:text-lg font-semibold text-black dark:text-white">{title}</h2>
            {badge}
          </div>
          {subtitle && <p className="mt-1 text-xs sm:text-sm leading-5 text-gray-600 dark:text-[#8696A0]">{subtitle}</p>}
        </div>
      </header>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

/**
 * Collapsible "More options" disclosure for the rarely-used / technical settings
 * inside a SectionCard. Closed by default so the page stays simple, but nothing
 * is lost — power users expand it to reach everything.
 */
export function MoreOptions({
  label,
  children,
  defaultOpen = false,
}: {
  label?: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const { t } = useTranslation('aiconfig');
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-xl border border-gray-200 dark:border-white/10 bg-gray-100/50 dark:bg-[#0B141A]/40">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-xs font-semibold uppercase tracking-wider text-gray-700 dark:text-[#8696A0] hover:text-black dark:hover:text-white"
      >
        <span>{label ?? t('common.moreOptions')}</span>
        <ChevronDown className={cn('h-4 w-4 shrink-0 transition-transform', open && 'rotate-180')} />
      </button>
      {open && <div className="space-y-4 border-t border-gray-200 dark:border-white/10 p-3">{children}</div>}
    </div>
  );
}
