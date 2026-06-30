'use client';

import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { LayoutGrid, X } from 'lucide-react';
import { api } from '@/lib/api';
import type { AiConfigTemplate } from '@/app/(dashboard)/admin/ai-config/types';

/** Ready-made business presets the admin can apply as a starting point. */
export function TemplatesModal({ onApply, onClose, isRTL }: { onApply: (t: AiConfigTemplate) => void; onClose: () => void; isRTL: boolean }) {
  const { t } = useTranslation('aiconfig');
  const [templates, setTemplates] = useState<AiConfigTemplate[]>([]);
  const [loading, setLoading]     = useState(true);
  useEffect(() => {
    api.get('/api/chatbot/ai-config/templates').then((data) => setTemplates(data)).catch(() => setTemplates([])).finally(() => setLoading(false));
  }, []);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div dir={isRTL ? 'rtl' : 'ltr'} onClick={(e) => e.stopPropagation()} className="flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#111B21] shadow-2xl">
        <div className="flex items-start justify-between gap-3 border-b border-gray-200 dark:border-white/10 p-4">
          <div>
            <div className="flex items-center gap-2 text-sm font-semibold text-black dark:text-white"><LayoutGrid className="h-4 w-4 text-[#25D366]" /> {t('easy.templatesModal.title')}</div>
            <p className="mt-1 text-xs text-gray-600 dark:text-[#8696A0]">{t('easy.templatesModal.subtitle')}</p>
          </div>
          <button type="button" onClick={onClose} className="shrink-0 rounded-md p-1 text-gray-600 dark:text-[#8696A0] hover:bg-gray-100 dark:hover:bg-white/5 hover:text-black dark:hover:text-white"><X className="h-4 w-4" /></button>
        </div>
        <div className="grid gap-3 overflow-auto p-4 sm:grid-cols-2">
          {templates.map((tpl) => (
            <button key={tpl.id} type="button" onClick={() => onApply(tpl)} className="flex flex-col items-start gap-1.5 rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-[#202C33] p-4 text-start transition-all hover:border-[#25D366]/40 hover:bg-[#25D366]/5">
              <span className="text-sm font-semibold text-black dark:text-white">{tpl.name}</span>
              <span className="text-xs text-gray-600 dark:text-[#8696A0]">{tpl.description}</span>
              <span className="mt-1 rounded-md bg-[#25D366]/15 px-2 py-0.5 text-[10px] font-medium text-[#25D366]">{t('templates.apply')}</span>
            </button>
          ))}
          {(loading || templates.length === 0) && <p className="text-sm text-gray-600 dark:text-[#8696A0]">{t('templates.loading')}</p>}
        </div>
      </div>
    </div>
  );
}
