/**
 * Lightweight haptic feedback for the installed app. Uses the Vibration API
 * (Android / Chrome). iOS Safari ignores navigator.vibrate, so it's a silent
 * no-op there — safe to call from anywhere.
 *
 * Usage: haptic('light') on taps, haptic('success') on confirmations, etc.
 */
export type HapticPattern =
  | 'light'
  | 'medium'
  | 'heavy'
  | 'selection'
  | 'success'
  | 'warning'
  | 'error';

const PATTERNS: Record<HapticPattern, number | number[]> = {
  light: 8,
  medium: 15,
  heavy: 25,
  selection: 5,
  success: [12, 40, 12],
  warning: [20, 60, 20],
  error: [30, 50, 30, 50, 30],
};

export function haptic(pattern: HapticPattern = 'light'): void {
  try {
    if (typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') return;
    navigator.vibrate(PATTERNS[pattern]);
  } catch {
    /* unsupported — silent no-op */
  }
}
