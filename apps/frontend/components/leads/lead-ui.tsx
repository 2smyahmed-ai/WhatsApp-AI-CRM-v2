'use client';

import { AlertTriangle, ShoppingCart, UserRound } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '../../lib/utils';

// ── Shared types ──────────────────────────────────────────────────────────────
export type LeadStatus =
  | 'NEW_LEAD' | 'QUALIFIED' | 'HOT' | 'WARM' | 'COLD'
  | 'CUSTOMER' | 'LOST' | 'NOT_INTERESTED' | 'SPAM';

export type Priority = 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';

export interface LeadSignals {
  pricingRequest: boolean;
  meetingRequest: boolean;
  callRequest: boolean;
  urgency: boolean;
  readyToBuy: boolean;
}

export interface Lead {
  id: string;
  contactId: string;
  status: LeadStatus;
  score: number;
  priority: Priority;
  confidence: number;
  needsAttention: boolean;
  buyingIntent: boolean;
  signals: LeadSignals | null;
  summaryEn: string | null;
  summaryAr: string | null;
  recommendationEn: string | null;
  recommendationAr: string | null;
  lastAnalyzedAt: string | null;
  updatedAt: string;
  contact: { id: string; name: string | null; phone: string; lifecycleStage?: string } | null;
  conversationId: string | null;
  assignedTo?: string | null;
}

export interface LeadStatusEvent {
  id: string;
  fromStatus: LeadStatus | null;
  toStatus: LeadStatus;
  score: number;
  reason: string | null;
  createdAt: string;
}

export const SIGNAL_KEYS: Array<keyof LeadSignals> = [
  'pricingRequest', 'meetingRequest', 'callRequest', 'urgency', 'readyToBuy',
];

// ── Visual config ─────────────────────────────────────────────────────────────
export const STATUS_CFG: Record<LeadStatus, { dot: string; badge: string }> = {
  HOT:            { dot: 'bg-red-500',     badge: 'bg-red-500/10 text-red-400 border-red-500/20' },
  QUALIFIED:      { dot: 'bg-emerald-500', badge: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' },
  WARM:           { dot: 'bg-amber-500',   badge: 'bg-amber-500/10 text-amber-400 border-amber-500/20' },
  COLD:           { dot: 'bg-sky-500',     badge: 'bg-sky-500/10 text-sky-400 border-sky-500/20' },
  NEW_LEAD:       { dot: 'bg-violet-500',  badge: 'bg-violet-500/10 text-violet-300 border-violet-500/20' },
  CUSTOMER:       { dot: 'bg-[#25D366]',   badge: 'bg-[#25D366]/10 text-[#25D366] border-[#25D366]/20' },
  LOST:           { dot: 'bg-gray-500',    badge: 'bg-gray-500/10 text-gray-400 border-gray-500/20' },
  NOT_INTERESTED: { dot: 'bg-gray-500',    badge: 'bg-gray-500/10 text-gray-400 border-gray-500/20' },
  SPAM:           { dot: 'bg-rose-700',    badge: 'bg-rose-700/10 text-rose-400 border-rose-700/20' },
};

export const PRIORITY_CFG: Record<Priority, string> = {
  URGENT: 'bg-red-500/15 text-red-400 border-red-500/25',
  HIGH:   'bg-orange-500/15 text-orange-400 border-orange-500/25',
  NORMAL: 'bg-white/5 text-[#8696A0] border-white/10',
  LOW:    'bg-white/5 text-[#8696A0]/70 border-white/10',
};

export function scoreColor(score: number): string {
  if (score >= 75) return 'text-red-400';
  if (score >= 50) return 'text-amber-400';
  if (score >= 25) return 'text-sky-400';
  return 'text-[#8696A0]';
}

/** Pick the AI free-text field matching the current UI language. */
export function localizedText(lead: Lead, field: 'summary' | 'recommendation', lang: string): string {
  const isAr = lang.startsWith('ar');
  if (field === 'summary') return (isAr ? lead.summaryAr : lead.summaryEn) || lead.summaryEn || lead.summaryAr || '';
  return (isAr ? lead.recommendationAr : lead.recommendationEn) || lead.recommendationEn || lead.recommendationAr || '';
}

// ── Reusable presentational bits ──────────────────────────────────────────────
export function StatusBadge({ status, className }: { status: LeadStatus; className?: string }) {
  const { t } = useTranslation('leads');
  const cfg = STATUS_CFG[status];
  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-semibold', cfg.badge, className)}>
      <span className={cn('h-1.5 w-1.5 rounded-full', cfg.dot)} />
      {t(`status.${status}`)}
    </span>
  );
}

export function PriorityBadge({ priority }: { priority: Priority }) {
  const { t } = useTranslation('leads');
  return (
    <span className={cn('rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide', PRIORITY_CFG[priority])}>
      {t(`priority.${priority}`)}
    </span>
  );
}

export function FlagChips({ lead }: { lead: Lead }) {
  const { t } = useTranslation('leads');
  if (!lead.needsAttention && !lead.buyingIntent) return null;
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {lead.needsAttention && (
        <span className="inline-flex items-center gap-1 rounded-full border border-red-500/25 bg-red-500/10 px-2 py-0.5 text-[10px] font-semibold text-red-400">
          <AlertTriangle className="h-3 w-3" />
          {t('flags.needsAttention')}
        </span>
      )}
      {lead.buyingIntent && (
        <span className="inline-flex items-center gap-1 rounded-full border border-[#25D366]/25 bg-[#25D366]/10 px-2 py-0.5 text-[10px] font-semibold text-[#25D366]">
          <ShoppingCart className="h-3 w-3" />
          {t('flags.buyingIntent')}
        </span>
      )}
    </div>
  );
}

export function SignalChips({ signals }: { signals: LeadSignals | null }) {
  const { t } = useTranslation('leads');
  const active = signals ? SIGNAL_KEYS.filter((k) => signals[k]) : [];
  if (active.length === 0) {
    return <p className="text-xs text-[#8696A0]/60">{t('noSignals')}</p>;
  }
  return (
    <div className="flex flex-wrap gap-1.5">
      {active.map((k) => (
        <span key={k} className="rounded-md border border-white/10 bg-white/5 px-2 py-0.5 text-[11px] text-[#cfd9de]">
          {t(`signalLabels.${k}`)}
        </span>
      ))}
    </div>
  );
}

export function leadInitial(lead: Lead): string {
  return (lead.contact?.name ?? lead.contact?.phone ?? '?').charAt(0).toUpperCase();
}

export function LeadAvatar({ lead, className = '' }: { lead: Lead; className?: string }) {
  const identity = lead.contact?.name ?? lead.contact?.phone ?? '';
  const isPhone = !lead.contact?.name && identity.startsWith('+');
  return (
    <div className={cn('flex shrink-0 items-center justify-center rounded-full bg-[#25D366]/15 font-bold text-[#25D366]', className)}>
      {isPhone
        ? <UserRound aria-hidden="true" className="h-1/2 w-1/2" />
        : (identity.charAt(0) || '?').toUpperCase()}
    </div>
  );
}
