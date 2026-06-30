'use client';

import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLanguage } from '../providers/I18nProvider';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell, type TooltipProps,
} from 'recharts';

interface MessagesChartProps {
  data: Array<{ date: string; incoming: number; outgoing: number }>;
}

function useIsDark() {
  const [isDark, setIsDark] = useState(false);
  useEffect(() => {
    const update = () => setIsDark(document.documentElement.classList.contains('dark'));
    update();
    const observer = new MutationObserver(update);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);
  return isDark;
}

function ChartTooltip({ active, payload, label }: TooltipProps<number, string>) {
  const { language } = useLanguage();
  const locale = language === 'ar' ? 'ar-SA' : 'en-US';
  if (!active || !payload?.length) return null;
  const total = (payload[0]?.value ?? 0) + (payload[1]?.value ?? 0);
  return (
    <div className="rounded-xl border border-gray-200/80 bg-white/95 backdrop-blur-md px-4 py-3 shadow-xl dark:border-white/10 dark:bg-[#1A2530]/95">
      <p className="mb-2.5 text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-[#8696A0]">
        {new Date(label).toLocaleDateString(locale, { weekday: 'short', month: 'short', day: 'numeric' })}
      </p>
      {payload.map((entry) => (
        <div key={entry.name} className="flex items-center gap-2.5 text-sm">
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: entry.color ?? '#fff' }} />
          <span className="text-gray-500 dark:text-[#8696A0]">{entry.name}:</span>
          <span className="font-bold text-gray-900 dark:text-white">{(entry.value as number).toLocaleString(locale)}</span>
        </div>
      ))}
      {payload.length > 1 && (
        <div className="mt-2 border-t border-gray-100 pt-2 dark:border-white/10">
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-gray-400 dark:text-[#8696A0]">Total</span>
            <span className="font-bold text-gray-900 dark:text-white">{total.toLocaleString(locale)}</span>
          </div>
        </div>
      )}
    </div>
  );
}

export default function MessagesChart({ data }: MessagesChartProps) {
  const { t } = useTranslation('dashboard');
  const { language } = useLanguage();
  const locale = language === 'ar' ? 'ar-SA' : 'en-US';
  const isDark = useIsDark();

  const chartData = data.slice(-7);
  const totalOutgoing = chartData.reduce((s, d) => s + d.outgoing, 0);
  const totalIncoming = chartData.reduce((s, d) => s + d.incoming, 0);
  const maxVal = Math.max(1, ...chartData.map((d) => d.outgoing + d.incoming));

  const axisTickColor = isDark ? '#8696A0' : '#9CA3AF';
  const gridStroke = isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)';
  const cursorFill = isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)';

  return (
    <div className="rounded-[20px] bg-white/80 backdrop-blur-xl border border-gray-100 shadow-[0_2px_20px_rgba(0,0,0,0.05)] p-6 dark:bg-[#182229] dark:border-transparent dark:shadow-[0_4px_24px_rgba(0,0,0,0.45),inset_0_1px_0_rgba(255,255,255,0.05)]">

      {/* Header */}
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h3 className="text-base font-semibold text-gray-900 dark:text-white">{t('chart.title')}</h3>
          <p className="mt-0.5 text-xs text-gray-500 dark:text-[#8696A0]">{t('chart.subtitle')}</p>
        </div>

        <div className="flex items-center gap-5">
          <div className="text-end">
            <p className="text-xl font-bold tabular-nums text-[#16A34A] dark:text-[#25D366]">
              {totalOutgoing.toLocaleString(locale)}
            </p>
            <div className="mt-0.5 flex items-center justify-end gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm bg-[#25D366]" aria-hidden="true" />
              <span className="text-[11px] text-gray-500 dark:text-[#8696A0]">{t('chart.sent')}</span>
            </div>
          </div>
          <div className="text-end">
            <p className="text-xl font-bold tabular-nums text-blue-500 dark:text-blue-400">
              {totalIncoming.toLocaleString(locale)}
            </p>
            <div className="mt-0.5 flex items-center justify-end gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm bg-blue-400" aria-hidden="true" />
              <span className="text-[11px] text-gray-500 dark:text-[#8696A0]">{t('chart.received')}</span>
            </div>
          </div>
        </div>
      </div>

      {data.length === 0 ? (
        <div className="flex h-56 items-center justify-center" role="status">
          <p className="text-sm text-gray-500 dark:text-[#8696A0]">{t('chart.noData')}</p>
        </div>
      ) : (
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={chartData}
              margin={{ top: 4, right: 4, left: -20, bottom: 0 }}
              barGap={4}
              barCategoryGap="18%"
            >
              <defs>
                <linearGradient id="barGradOut" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#25D366" stopOpacity={1} />
                  <stop offset="100%" stopColor="#1FAA5C" stopOpacity={0.85} />
                </linearGradient>
                <linearGradient id="barGradIn" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#60a5fa" stopOpacity={1} />
                  <stop offset="100%" stopColor="#3b82f6" stopOpacity={0.85} />
                </linearGradient>
              </defs>

              <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} vertical={false} />

              <XAxis
                dataKey="date"
                tick={{ fill: axisTickColor, fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) =>
                  new Date(v).toLocaleDateString(locale, { weekday: 'short' })
                }
              />
              <YAxis
                tick={{ fill: axisTickColor, fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                allowDecimals={false}
              />

              <Tooltip
                content={<ChartTooltip />}
                cursor={{ fill: cursorFill, radius: 4 }}
              />

              <Bar
                dataKey="outgoing"
                name={t('chart.sent')}
                fill="url(#barGradOut)"
                radius={[4, 4, 0, 0]}
                maxBarSize={48}
              >
                {data.map((entry, i) => {
                  const intensity = maxVal > 0 ? entry.outgoing / maxVal : 0;
                  const opacity = 0.55 + intensity * 0.45;
                  return <Cell key={i} fill="url(#barGradOut)" fillOpacity={opacity} />;
                })}
              </Bar>

              <Bar
                dataKey="incoming"
                name={t('chart.received')}
                fill="url(#barGradIn)"
                radius={[4, 4, 0, 0]}
                maxBarSize={48}
              >
                {data.map((entry, i) => {
                  const intensity = maxVal > 0 ? entry.incoming / maxVal : 0;
                  const opacity = 0.55 + intensity * 0.45;
                  return <Cell key={i} fill="url(#barGradIn)" fillOpacity={opacity} />;
                })}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
