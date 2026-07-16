/**
 * ─── Wall clock ⇄ instant ────────────────────────────────────────────────────
 *
 * A scheduled broadcast has exactly one correct meaning: "fire at 2:30 PM on
 * July 10th, in the zone the user was thinking in". That is a *wall clock* plus
 * a *zone*, and it resolves to exactly one absolute instant.
 *
 * The old code conflated the two. `new Date(value)` on the client interpreted a
 * zone-less string as browser-local, then `.toISOString()` re-rendered it as
 * UTC, and the edit form fed that UTC string back into a `datetime-local` input
 * — which reads its value as local again. Every save shifted the time by the
 * UTC offset, compounding on each edit. That is the "random dates and times".
 *
 * Here the conversion happens once, server-side, in one direction each way:
 *
 *   wallClockToInstant("2026-07-10T14:30", "Africa/Cairo") → 2026-07-10T11:30Z
 *   instantToWallClock(<that instant>,     "Africa/Cairo") → "2026-07-10T14:30"
 *
 * Both are exact inverses, so what the user typed is what they see forever
 * after, and what fires is the instant that wall clock actually names.
 *
 * No dependency: `Intl` already ships the full IANA database.
 */

/** "YYYY-MM-DDTHH:mm" or "YYYY-MM-DDTHH:mm:ss" — a local time with no zone. */
const WALL_CLOCK_RE = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?$/;

export function isValidTimeZone(timeZone: string): boolean {
  if (!timeZone) return false;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone });
    return true;
  } catch {
    return false;
  }
}

export function isWallClock(value: string): boolean {
  return WALL_CLOCK_RE.test(value.trim());
}

/**
 * How far `timeZone` is ahead of UTC at the given instant, in milliseconds.
 * Positive east of Greenwich. Accounts for DST because it asks Intl what the
 * local calendar actually reads at that moment.
 */
function zoneOffsetMs(instant: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(instant);

  const field: Record<string, string> = {};
  for (const part of parts) {
    if (part.type !== 'literal') field[part.type] = part.value;
  }

  // Some ICU builds render midnight as hour "24" under hour12:false.
  const hour = field.hour === '24' ? 0 : Number(field.hour);

  const localAsIfUtc = Date.UTC(
    Number(field.year),
    Number(field.month) - 1,
    Number(field.day),
    hour,
    Number(field.minute),
    Number(field.second),
  );
  return localAsIfUtc - instant.getTime();
}

/**
 * Resolve a zone-less wall clock into the absolute instant it names in `timeZone`.
 *
 * The offset we need is the one in effect *at the answer*, which we don't know
 * yet — so guess with the offset near the naive instant, then re-derive using
 * the guess. One refinement suffices for every real zone: a DST transition moves
 * the clock by at most a couple of hours, and the guess is already inside that
 * window.
 *
 * Two DST edge cases have no single right answer, so we pin them down:
 *
 *   • Spring-forward gap — 02:30 on a night that jumps 02:00→03:00 never occurs.
 *     Refinement alone lands an hour *before* what was asked (01:30). We detect
 *     that by round-tripping and push forward by the gap instead, so 02:30
 *     becomes 03:30, matching what calendar apps do.
 *
 *   • Fall-back overlap — 01:30 on a night that repeats 01:00–02:00 occurs twice.
 *     We take the first (still-DST) occurrence, the earlier instant.
 */
export function wallClockToInstant(wallClock: string, timeZone: string): Date {
  const trimmed = wallClock.trim();
  const match = WALL_CLOCK_RE.exec(trimmed);
  if (!match) {
    throw new Error(`Invalid date/time "${wallClock}". Expected YYYY-MM-DDTHH:mm.`);
  }
  if (!isValidTimeZone(timeZone)) {
    throw new Error(`Unknown time zone "${timeZone}".`);
  }

  const [, year, month, day, hour, minute, second] = match;
  const naive = Date.UTC(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute),
    Number(second ?? 0),
  );

  const guess = naive - zoneOffsetMs(new Date(naive), timeZone);
  const resolved = new Date(naive - zoneOffsetMs(new Date(guess), timeZone));

  // If the zone's clock never reads what was asked, the request fell in a
  // spring-forward gap. `observed` is the time it does read; the shortfall is
  // exactly the gap, so adding it lands on the first real instant after the jump.
  const observed = instantToWallClock(resolved, timeZone);
  const requested = trimmed.replace(' ', 'T').slice(0, 16);
  if (observed !== requested) {
    const shortfall = wallClockNaiveMs(requested) - wallClockNaiveMs(observed);
    return new Date(resolved.getTime() + shortfall);
  }

  return resolved;
}

/** Parse "YYYY-MM-DDTHH:mm" as if it were UTC — only ever used to diff two of them. */
function wallClockNaiveMs(wallClock: string): number {
  const match = WALL_CLOCK_RE.exec(wallClock);
  if (!match) throw new Error(`Invalid wall clock "${wallClock}".`);
  const [, year, month, day, hour, minute, second] = match;
  return Date.UTC(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute),
    Number(second ?? 0),
  );
}

/** Render an instant as the wall clock it shows on a clock in `timeZone`. */
export function instantToWallClock(instant: Date, timeZone: string): string {
  if (!isValidTimeZone(timeZone)) {
    throw new Error(`Unknown time zone "${timeZone}".`);
  }
  const shifted = new Date(instant.getTime() + zoneOffsetMs(instant, timeZone));
  // `datetime-local` inputs want exactly "YYYY-MM-DDTHH:mm".
  return shifted.toISOString().slice(0, 16);
}

/**
 * Accepts either shape a client can send and returns the absolute instant:
 *   { scheduledAtLocal: "2026-07-10T14:30", timezone: "Africa/Cairo" }  ← preferred
 *   { scheduledAt: "2026-07-10T11:30:00.000Z" }                          ← legacy/API
 *
 * The wall-clock form is authoritative when present: it carries the user's
 * intent unambiguously, while an ISO instant has already lost the zone they
 * meant it in.
 */
export function resolveScheduledInstant(input: {
  scheduledAt?: string | Date | null;
  scheduledAtLocal?: string | null;
  timezone?: string | null;
}): { instant: Date; timezone: string } | null {
  const timezone = input.timezone?.trim() || 'UTC';

  if (input.scheduledAtLocal?.trim()) {
    return { instant: wallClockToInstant(input.scheduledAtLocal, timezone), timezone };
  }

  if (input.scheduledAt) {
    const instant = input.scheduledAt instanceof Date ? input.scheduledAt : new Date(input.scheduledAt);
    if (Number.isNaN(instant.getTime())) {
      throw new Error(`Invalid scheduledAt "${String(input.scheduledAt)}".`);
    }
    return { instant, timezone };
  }

  return null;
}
