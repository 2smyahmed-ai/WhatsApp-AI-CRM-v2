import type { LeadStatus, Priority } from '@prisma/client';

/** The 9 canonical AI statuses — kept in sync with the Prisma `LeadStatus` enum. */
export const LEAD_STATUSES: LeadStatus[] = [
  'NEW_LEAD', 'QUALIFIED', 'HOT', 'WARM', 'COLD',
  'CUSTOMER', 'LOST', 'NOT_INTERESTED', 'SPAM',
];

export const PRIORITIES: Priority[] = ['LOW', 'NORMAL', 'HIGH', 'URGENT'];

/** Discrete buying/intent signals extracted by the analyzer. */
export interface QualificationSignals {
  pricingRequest: boolean;
  meetingRequest: boolean;
  callRequest: boolean;
  urgency: boolean;
  readyToBuy: boolean;
}

/** Validated, normalized result of one analysis pass. */
export interface QualificationResult {
  status: LeadStatus;
  score: number;          // 0–100
  priority: Priority;
  confidence: number;     // 0–1
  needsAttention: boolean;
  buyingIntent: boolean;
  signals: QualificationSignals;
  summaryEn: string;
  summaryAr: string;
  recommendationEn: string;
  recommendationAr: string;
}

/** Context handed to the analyzer for a single contact. */
export interface QualificationContext {
  contactId: string;
  conversationId: string;
  teamId: string | null;
  contactName: string | null;
  /** Oldest → newest. `fromMe` true = the business/agent, false = the customer. */
  messages: Array<{ fromMe: boolean; body: string }>;
}
