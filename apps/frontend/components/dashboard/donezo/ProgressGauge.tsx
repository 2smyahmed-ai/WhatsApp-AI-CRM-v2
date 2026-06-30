'use client';

import { useTranslation } from 'react-i18next';

interface LegendItem {
  label: string;
  swatch: string;
}

const R = 56;
const C = 2 * Math.PI * R;
const TRACK = C * 0.75;
const GAP = C * 0.25;

export default function ProgressGauge({
  percent,
  caption,
  legend,
}: {
  percent: number;
  caption: string;
  legend: LegendItem[];
}) {
  const { t } = useTranslation('dashboard');
  const value = Math.max(0, Math.min(100, Math.round(percent)));
  const valueArc = (value / 100) * TRACK;

  return (
    <section className="flex h-full flex-col rounded-[20px] bg-white/80 backdrop-blur-xl border border-gray-100 shadow-[0_2px_20px_rgba(0,0,0,0.05)] p-5 dark:bg-[#111B21]/90 dark:border-white/8 dark:shadow-[0_2px_20px_rgba(0,0,0,0.35)]">
      <h2 className="text-[15px] font-bold text-gray-900 dark:text-white">{t('progress.title')}</h2>

      {/* Horizontal layout — gauge + stats side by side */}
      <div className="mt-4 flex flex-1 flex-wrap items-center gap-8">
        {/* Gauge SVG */}
        <div className="relative mx-auto flex w-full max-w-[200px] items-center justify-center sm:mx-0 sm:w-[200px] sm:shrink-0">
          <svg viewBox="0 0 136 136" className="w-full" role="img" aria-label={`${value}%`}>
            <defs>
              <linearGradient id="dzGauge" x1="0" y1="1" x2="1" y2="0">
                <stop offset="0%" stopColor="#0c3a27" />
                <stop offset="50%" stopColor="#1f9255" />
                <stop offset="100%" stopColor="#5ec98a" />
              </linearGradient>
              <filter id="gaugeShadow">
                <feDropShadow dx="0" dy="0" stdDeviation="3" floodColor="#25D366" floodOpacity="0.35" />
              </filter>
            </defs>
            <g transform="rotate(135 68 68)">
              <circle
                cx="68" cy="68" r={R}
                fill="none"
                className="stroke-gray-100 dark:stroke-white/10"
                strokeWidth="14"
                strokeLinecap="round"
                strokeDasharray={`${TRACK} ${GAP}`}
              />
              <circle
                cx="68" cy="68" r={R}
                fill="none"
                stroke="url(#dzGauge)"
                strokeWidth="14"
                strokeLinecap="round"
                strokeDasharray={`${valueArc} ${C}`}
                filter={value > 0 ? 'url(#gaugeShadow)' : undefined}
                style={{ transition: 'stroke-dasharray 0.9s cubic-bezier(0.16,1,0.3,1)' }}
              />
            </g>
          </svg>
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-[36px] font-bold leading-none tabular-nums text-gray-900 dark:text-white">{value}%</span>
            <span className="mt-1 text-[11px] font-medium text-gray-400 dark:text-[#8696A0]">{caption}</span>
          </div>
        </div>

        {/* Stats + legend */}
        <div className="flex flex-1 flex-col gap-4 min-w-0">
          {legend.length > 0 && (
            <div className="flex flex-col gap-3">
              {legend.map((item, i) => {
                const pcts = [value, Math.max(0, 100 - value) * 0.6, Math.max(0, 100 - value) * 0.4];
                const pct = Math.round(pcts[i] ?? 0);
                return (
                  <div key={item.label} className="flex items-center gap-3">
                    <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${item.swatch}`} aria-hidden="true" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <span className="text-[12px] font-medium text-gray-600 dark:text-[#8696A0]">{item.label}</span>
                        <span className="text-[12px] font-bold tabular-nums text-gray-900 dark:text-white">{pct}%</span>
                      </div>
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-white/10">
                        <div
                          className={`h-full rounded-full transition-all duration-700 ${item.swatch}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Summary numbers */}
          <div className="grid grid-cols-2 gap-3 border-t border-gray-100 pt-4 dark:border-white/8">
            <div className="rounded-xl bg-[#25D366]/8 dark:bg-[#25D366]/10 p-3">
              <p className="text-[22px] font-bold tabular-nums text-[#16A34A] dark:text-[#25D366]">
                {value}%
              </p>
              <p className="mt-0.5 text-[11px] text-gray-500 dark:text-[#8696A0]">{t('collab.completed')}</p>
            </div>
            <div className="rounded-xl bg-gray-50 dark:bg-white/5 p-3">
              <p className="text-[22px] font-bold tabular-nums text-gray-700 dark:text-[#8696A0]">
                {100 - value}%
              </p>
              <p className="mt-0.5 text-[11px] text-gray-500 dark:text-[#8696A0]">{t('collab.pending')}</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
