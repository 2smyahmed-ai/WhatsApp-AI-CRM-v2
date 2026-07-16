/**
 * ─── Smart Sending arithmetic ────────────────────────────────────────────────
 *
 * One source of truth for "how many batches, how long will it take" so the
 * compose-time preview and the running-campaign progress can never disagree.
 *
 * The number crunching here is pure. Turning a duration into words ("About 5
 * hours") is done by `humanizeDuration`, which takes the translated unit strings
 * so it reads correctly in every locale.
 */

/** Midpoint of the worker's per-send anti-ban delay (1.5s–4s). */
const AVG_SEND_SECONDS = 2.75;

export interface BatchPlan {
  /** Total recipients. */
  total: number;
  batchSize: number;
  intervalMinutes: number;
  /** How many batches the audience splits into (1 when it fits in a single batch). */
  numBatches: number;
  /** Best estimate of total wall-clock time from first send to last, in seconds. */
  estimatedSeconds: number;
}

/**
 * Split an audience into batches and estimate the total duration.
 *
 * Duration = time spent sending every message + the waits *between* batches.
 * There is no wait after the final batch, hence `numBatches - 1`. A single-batch
 * audience therefore has no waiting at all and behaves like a normal send.
 */
export function planBatches(total: number, batchSize: number, intervalMinutes: number): BatchPlan {
  const safeBatch = Math.max(1, Math.floor(batchSize) || 1);
  const safeInterval = Math.max(0, Math.floor(intervalMinutes) || 0);
  const numBatches = total > 0 ? Math.ceil(total / safeBatch) : 0;

  const sendSeconds = total * AVG_SEND_SECONDS;
  const waitSeconds = Math.max(0, numBatches - 1) * safeInterval * 60;

  return {
    total,
    batchSize: safeBatch,
    intervalMinutes: safeInterval,
    numBatches,
    estimatedSeconds: Math.round(sendSeconds + waitSeconds),
  };
}

/**
 * Which batch a running campaign is on, and how many there are.
 *
 * `completed` counts fully-attempted batches (floor of attempted / size); the
 * one in flight or about to start is `completed + 1`, capped at the total.
 */
export function batchProgress(attempted: number, total: number, batchSize: number) {
  const safeBatch = Math.max(1, Math.floor(batchSize) || 1);
  const numBatches = total > 0 ? Math.ceil(total / safeBatch) : 0;
  const completed = Math.min(numBatches, Math.floor(attempted / safeBatch));
  const current = Math.min(numBatches, completed + (attempted < total ? 1 : 0));
  return { numBatches, completed, current };
}

export interface DurationUnits {
  /** e.g. "hour" / "hours"; the humanizer picks by count. */
  hour: string;
  hours: string;
  minute: string;
  minutes: string;
  /** Prefix, e.g. "About". */
  about: string;
  /** "less than a minute". */
  lessThanAMinute: string;
}

/**
 * "About 5 hours" / "About 30 minutes" from a second count.
 *
 * Rounds to a coarse, honest figure: minutes under an hour, otherwise hours to
 * the nearest half. Nobody planning a campaign needs "4 hours 53 minutes"; they
 * need "about 5 hours".
 */
export function humanizeDuration(totalSeconds: number, u: DurationUnits): string {
  if (totalSeconds < 60) return u.lessThanAMinute;

  const minutes = totalSeconds / 60;
  if (minutes < 60) {
    const m = Math.max(1, Math.round(minutes / 5) * 5); // nearest 5 min
    return `${u.about} ${m} ${m === 1 ? u.minute : u.minutes}`;
  }

  const hours = Math.round((totalSeconds / 3600) * 2) / 2; // nearest half hour
  const label = hours === 1 ? u.hour : u.hours;
  // Drop a trailing ".0" so 5.0 reads as "5", but keep "2.5".
  const value = Number.isInteger(hours) ? String(hours) : hours.toFixed(1);
  return `${u.about} ${value} ${label}`;
}
