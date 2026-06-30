import { logger } from '../lib/logger';
import { chatbotSettingsService } from '../services/chatbot-settings.service';
import { qualifyContact } from './lead-qualification.service';

/**
 * Per-contact debounce: after an inbound message we (re)start a quiet-period
 * timer. Only when the customer stops messaging for `qualificationDebounceMs`
 * do we run a single analysis pass — so a burst of rapid messages costs one
 * LLM call, not N. In-memory (single-instance), matching the app's other
 * in-process schedulers.
 */
const timers = new Map<string, NodeJS.Timeout>();
const MIN_DEBOUNCE_MS = 3_000;

/**
 * Schedule (or reschedule) analysis for a contact. No-op when qualification
 * is disabled. The caller must have already excluded WhatsApp groups.
 */
export function scheduleQualification(contactId: string): void {
  const cfg = chatbotSettingsService.qualificationConfig();
  if (!cfg.enabled) return;

  const delay = Math.max(MIN_DEBOUNCE_MS, cfg.debounceMs || 45_000);

  const existing = timers.get(contactId);
  if (existing) clearTimeout(existing);

  const timer = setTimeout(() => {
    timers.delete(contactId);
    void qualifyContact(contactId).catch((err) => {
      logger.warn('lead_qual.scheduled_failed', {
        contactId,
        error: err instanceof Error ? err.message : String(err),
      });
    });
  }, delay);

  // Don't keep the process alive solely for a pending analysis.
  if (typeof timer.unref === 'function') timer.unref();
  timers.set(contactId, timer);
}

/** Cancel a pending analysis (e.g. contact deleted). */
export function cancelQualification(contactId: string): void {
  const existing = timers.get(contactId);
  if (existing) {
    clearTimeout(existing);
    timers.delete(contactId);
  }
}
