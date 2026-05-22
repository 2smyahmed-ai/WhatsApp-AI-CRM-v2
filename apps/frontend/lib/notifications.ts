'use client';

let audioContext: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!audioContext) {
    try {
      audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    } catch {
      return null;
    }
  }
  return audioContext;
}

/** Play a short, WhatsApp-like notification chime using the Web Audio API */
export function playNotificationSound() {
  const ctx = getAudioContext();
  if (!ctx) return;

  // Resume context if suspended (browser autoplay policy)
  if (ctx.state === 'suspended') ctx.resume();

  const now = ctx.currentTime;

  // Two-tone chime: high note then lower
  const notes = [
    { freq: 1200, start: 0, duration: 0.1 },
    { freq: 880, start: 0.12, duration: 0.15 },
  ];

  for (const note of notes) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'sine';
    osc.frequency.value = note.freq;
    gain.gain.setValueAtTime(0.3, now + note.start);
    gain.gain.exponentialRampToValueAtTime(0.001, now + note.start + note.duration);
    osc.start(now + note.start);
    osc.stop(now + note.start + note.duration + 0.05);
  }
}

/** Request browser notification permission (call once on user interaction) */
export async function requestNotificationPermission(): Promise<boolean> {
  if (typeof window === 'undefined' || !('Notification' in window)) return false;
  if (Notification.permission === 'granted') return true;
  if (Notification.permission === 'denied') return false;
  const result = await Notification.requestPermission();
  return result === 'granted';
}

/** Show a browser notification */
export function showBrowserNotification(title: string, body: string, options?: { icon?: string; tag?: string }) {
  if (typeof window === 'undefined' || !('Notification' in window)) return;
  if (Notification.permission !== 'granted') return;
  if (document.hasFocus()) return; // don't spam when user is looking at the tab

  new Notification(title, {
    body,
    icon: options?.icon || '/favicon.ico',
    tag: options?.tag,
    silent: true, // we play our own sound
  });
}

/** Combined: play sound + show browser notification for a new inbound message */
export function notifyNewMessage(contactName: string, body: string, conversationId: string) {
  playNotificationSound();
  showBrowserNotification(
    `New message from ${contactName}`,
    body || 'Sent a message',
    { tag: `conv-${conversationId}` },
  );
}
