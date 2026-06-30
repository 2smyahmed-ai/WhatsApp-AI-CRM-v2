/**
 * Session warm-up phase calculation and gating.
 *
 * New WhatsApp sessions are heavily scrutinized by WhatsApp's abuse detection.
 * A brand-new session that immediately sends 100 messages is a classic bot pattern
 * and triggers instant account suspension.
 *
 * This module implements a 15-day ramp-up strategy:
 * - Days 0-3: Max 20 msgs/day
 * - Days 4-7: Max 50 msgs/day
 * - Days 8-14: Max 100 msgs/day
 * - Day 15+: Full throughput (no daily limit, only per-minute rate control)
 */

export interface WarmupPhase {
  active: boolean;
  phaseName: 'new' | 'growing' | 'maturing' | 'established';
  dayNumber: number; // Days since session created
  dailyLimit: number | null; // null = unlimited
  perMinuteCap: number; // Always enforced
  fullyUnlockedAt: Date | null; // Date when day 15 is reached
}

export interface WarmupGateError extends Error {
  code: 'WARMUP_DAILY_LIMIT';
  limit: number;
  sent: number;
  phaseName: string;
  resetAt: string; // ISO date
  fullyUnlockedAt: string | null; // ISO date
  dayNumber: number;
}

/**
 * Calculate the warmup phase based on session creation date.
 *
 * @param sessionCreatedAt - The date the WhatsAppSession was created in DB
 * @returns WarmupPhase with active status, daily limit, and unlock date
 */
export function getWarmupPhase(sessionCreatedAt: Date): WarmupPhase {
  const now = new Date();
  const dayNumber = Math.floor((now.getTime() - sessionCreatedAt.getTime()) / (1000 * 60 * 60 * 24));

  // An operator can declare an already-trusted, long-lived number as established
  // (WHATSAPP_ESTABLISHED=true) so it isn't crawled through the 15-day ramp that
  // exists to protect brand-new numbers. It still reports a per-minute cap.
  if (process.env.WHATSAPP_ESTABLISHED === 'true') {
    return {
      active: false,
      phaseName: 'established',
      dayNumber,
      dailyLimit: null,
      perMinuteCap: 20,
      fullyUnlockedAt: null,
    };
  }

  let phaseName: 'new' | 'growing' | 'maturing' | 'established';
  let dailyLimit: number | null;
  let active: boolean;

  if (dayNumber < 4) {
    phaseName = 'new';
    dailyLimit = 20;
    active = true;
  } else if (dayNumber < 8) {
    phaseName = 'growing';
    dailyLimit = 50;
    active = true;
  } else if (dayNumber < 15) {
    phaseName = 'maturing';
    dailyLimit = 100;
    active = true;
  } else {
    phaseName = 'established';
    dailyLimit = null;
    active = false;
  }

  // Calculate the date when day 15 is reached (session created + 15 days)
  const fullyUnlockedAt = new Date(sessionCreatedAt.getTime() + 15 * 24 * 60 * 60 * 1000);

  return {
    active,
    phaseName,
    dayNumber,
    dailyLimit,
    perMinuteCap: 20, // Always 20 msgs/min global, 5 msgs/min per JID
    fullyUnlockedAt: active ? fullyUnlockedAt : null,
  };
}

/**
 * Create a structured warm-up gate error with all details needed by frontend.
 *
 * @param limit - The daily limit for this phase
 * @param sent - Number of messages sent today
 * @param phase - The WarmupPhase object
 * @returns A WarmupGateError ready to throw
 */
export function createWarmupLimitError(limit: number, sent: number, phase: WarmupPhase): WarmupGateError {
  const now = new Date();
  const resetAt = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);

  const error = new Error(
    `Daily warm-up limit reached: ${sent}/${limit} messages sent today (Day ${phase.dayNumber} of 15 warm-up). ` +
    `Resets at midnight. Full capacity on ${phase.fullyUnlockedAt?.toLocaleDateString() || 'N/A'}.`,
  ) as WarmupGateError;

  error.code = 'WARMUP_DAILY_LIMIT';
  error.limit = limit;
  error.sent = sent;
  error.phaseName = phase.phaseName;
  error.resetAt = resetAt.toISOString();
  error.fullyUnlockedAt = phase.fullyUnlockedAt?.toISOString() || null;
  error.dayNumber = phase.dayNumber;

  return error;
}

/**
 * Start of today (00:00:00 UTC).
 */
export function startOfToday(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0));
}

/**
 * Start of tomorrow (00:00:00 UTC).
 */
export function startOfTomorrow(): Date {
  const today = startOfToday();
  return new Date(today.getTime() + 24 * 60 * 60 * 1000);
}
