'use client';

import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pause, Play, Square } from 'lucide-react';

function pad(n: number): string {
  return n.toString().padStart(2, '0');
}

export default function UptimeTracker() {
  const { t } = useTranslation('dashboard');
  const [seconds, setSeconds] = useState(0);
  const [running, setRunning] = useState(true);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (running) timer.current = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => { if (timer.current) clearInterval(timer.current); };
  }, [running]);

  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;

  return (
    <section className="relative overflow-hidden rounded-[20px] bg-gradient-to-br from-[#1f9255] via-[#15703f] to-[#0c3a27] p-5 text-white shadow-[0_14px_30px_-14px_rgba(13,77,46,0.6)]">
      {/* topographic texture */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 opacity-[0.18]">
        <div className="absolute -end-16 -bottom-20 h-56 w-56 rounded-full border border-white/40" />
        <div className="absolute -end-10 -bottom-14 h-40 w-40 rounded-full border border-white/40" />
        <div className="absolute -end-4 -bottom-8 h-24 w-24 rounded-full border border-white/40" />
      </div>

      <div className="relative flex items-center justify-between">
        <h2 className="text-[15px] font-bold text-white">{t('tracker.title')}</h2>
        <span className="flex items-center gap-1.5 rounded-full bg-white/15 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-white/90">
          <span className={`h-1.5 w-1.5 rounded-full bg-[#9bf6c0] ${running ? 'animate-pulse' : ''}`} aria-hidden="true" />
          {running ? t('tracker.live') : t('tracker.paused')}
        </span>
      </div>

      <p dir="ltr" className="relative mt-5 text-center font-mono text-[40px] font-bold leading-none tabular-nums tracking-wider text-white">
        {pad(h)}:{pad(m)}:{pad(s)}
      </p>

      <div className="relative mt-5 flex items-center justify-center gap-4">
        <button
          type="button"
          onClick={() => setRunning((r) => !r)}
          aria-label={running ? t('tracker.pause') : t('tracker.resume')}
          className="flex h-12 w-12 items-center justify-center rounded-full bg-white text-[#0c3a27] shadow-md transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
        >
          {running ? <Pause className="h-5 w-5" aria-hidden="true" fill="currentColor" /> : <Play className="h-5 w-5 ms-0.5" aria-hidden="true" fill="currentColor" />}
        </button>
        <button
          type="button"
          onClick={() => { setSeconds(0); setRunning(false); }}
          aria-label={t('tracker.reset')}
          className="flex h-12 w-12 items-center justify-center rounded-full bg-[#ef4444] text-white shadow-md transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
        >
          <Square className="h-4 w-4" aria-hidden="true" fill="currentColor" />
        </button>
      </div>
    </section>
  );
}
