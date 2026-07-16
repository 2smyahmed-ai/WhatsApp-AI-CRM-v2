/**
 * ─── Displaying a scheduled time ─────────────────────────────────────────────
 *
 * The client deliberately performs **no** wall-clock ⇄ instant conversion.
 *
 * The old code did, and that was the bug: `new Date(value)` read a zone-less
 * string as browser-local, `.toISOString()` re-rendered it as UTC, and feeding
 * that back into a `datetime-local` input (which reads its value as local again)
 * shifted the time by the UTC offset on every save.
 *
 * Now the server sends `scheduledAtLocal` — the exact wall clock the user
 * picked, e.g. "2026-07-10T14:30" — alongside the `timezone` they picked it in.
 * The input binds that string verbatim, and the form posts it back verbatim.
 * There is nowhere left for an offset to creep in.
 *
 * These helpers only *format* for reading. Formatting is a one-way projection:
 * it can never feed back into what gets stored.
 */

/** The viewer's IANA zone, e.g. "Africa/Cairo". Falls back to UTC on exotic runtimes. */
export function browserTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

/** "YYYY-MM-DDTHH:mm" for a `datetime-local` input, in the viewer's own zone. */
export function nowAsWallClock(offsetMinutes = 0): string {
  const now = new Date(Date.now() + offsetMinutes * 60_000);
  // getTimezoneOffset() is minutes *behind* UTC, so subtracting it yields local.
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

/**
 * Render the stored wall clock for humans — without ever reinterpreting it.
 * "2026-07-10T14:30" is split and formatted as the literal date and time it is,
 * because that string already *is* the time in `timeZone`.
 */
export function formatWallClock(wallClock: string, locale?: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/.exec(wallClock);
  if (!match) return wallClock;
  const [, year, month, day, hour, minute] = match;

  // Constructed in UTC and formatted in UTC, so the numbers pass through untouched.
  const asUtc = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute)));
  return new Intl.DateTimeFormat(locale, {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'UTC',
  }).format(asUtc);
}

/** Short zone label for the schedule summary, e.g. "GMT+3". */
export function timeZoneLabel(timeZone: string, locale?: string): string {
  try {
    const parts = new Intl.DateTimeFormat(locale, { timeZone, timeZoneName: 'shortOffset' }).formatToParts(new Date());
    return parts.find((part) => part.type === 'timeZoneName')?.value ?? timeZone;
  } catch {
    return timeZone;
  }
}

/**
 * The full, unambiguous rendering used everywhere a schedule is shown:
 * "10 Jul 2026, 2:30 PM (Africa/Cairo, GMT+3)".
 */
export function formatSchedule(wallClock: string | null, timeZone: string, locale?: string): string {
  if (!wallClock) return '';
  return `${formatWallClock(wallClock, locale)} (${timeZone}, ${timeZoneLabel(timeZone, locale)})`;
}

/** A curated shortlist, with the viewer's own zone pinned first. */
export function timeZoneOptions(): string[] {
  const common = [
    'Africa/Cairo', 'Asia/Riyadh', 'Asia/Dubai', 'Europe/London', 'Europe/Paris', 'Europe/Berlin',
    'Europe/Istanbul', 'Asia/Karachi', 'Asia/Kolkata', 'Asia/Jakarta', 'Asia/Singapore', 'Asia/Tokyo',
    'Australia/Sydney', 'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles',
    'America/Sao_Paulo', 'UTC',
  ];

  // `supportedValuesOf` exists in modern browsers and gives the full IANA list;
  // the shortlist is the fallback and also seeds the order.
  let all: string[] = [];
  try {
    all = (Intl as unknown as { supportedValuesOf?: (key: string) => string[] }).supportedValuesOf?.('timeZone') ?? [];
  } catch {
    all = [];
  }

  const mine = browserTimeZone();
  const merged = all.length ? all : common;
  return [mine, ...merged.filter((zone) => zone !== mine)];
}
