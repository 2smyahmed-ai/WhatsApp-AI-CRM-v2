'use client';

import { useState } from 'react';
import { Plus, Trash2, GripVertical, MessageSquare, Clock } from 'lucide-react';

type StepType = 'SEND_MESSAGE' | 'WAIT';

interface FlowStep {
  order: number;
  type: StepType;
  message?: string;
  delayMs?: number;
}

interface FlowData {
  name: string;
  trigger: string;
  keyword?: string;
  stopOnReply: boolean;
  steps: FlowStep[];
}

interface Props {
  initial?: FlowData;
  onSave: (data: FlowData) => Promise<void>;
  onCancel: () => void;
}

const TRIGGERS = [
  { value: 'KEYWORD', label: 'Keyword match' },
  { value: 'FIRST_MESSAGE', label: 'First message' },
  { value: 'ANY_MESSAGE', label: 'Any message' },
  { value: 'OUTSIDE_HOURS', label: 'Outside business hours' },
];

const DELAY_PRESETS = [
  { label: '1 min', ms: 60000 },
  { label: '5 min', ms: 300000 },
  { label: '1 hr', ms: 3600000 },
  { label: '24 hr', ms: 86400000 },
];

export default function FlowBuilder({ initial, onSave, onCancel }: Props) {
  const [name, setName] = useState(initial?.name ?? '');
  const [trigger, setTrigger] = useState(initial?.trigger ?? 'KEYWORD');
  const [keyword, setKeyword] = useState(initial?.keyword ?? '');
  const [stopOnReply, setStopOnReply] = useState(initial?.stopOnReply ?? true);
  const [steps, setSteps] = useState<FlowStep[]>(
    initial?.steps ?? [{ order: 0, type: 'SEND_MESSAGE', message: '' }],
  );
  const [saving, setSaving] = useState(false);

  const addStep = (type: StepType) => {
    setSteps((prev) => [...prev, { order: prev.length, type, message: '', delayMs: 60000 }]);
  };

  const removeStep = (idx: number) => {
    setSteps((prev) => prev.filter((_, i) => i !== idx).map((s, i) => ({ ...s, order: i })));
  };

  const updateStep = (idx: number, patch: Partial<FlowStep>) => {
    setSteps((prev) => prev.map((s, i) => (i === idx ? { ...s, ...patch } : s)));
  };

  const handleSave = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      await onSave({ name, trigger, keyword: keyword || undefined, stopOnReply, steps });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white dark:bg-[#1C2B33] p-6 shadow-xl">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          {initial ? 'Edit Flow' : 'New Automation Flow'}
        </h2>

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-[#8696A0] mb-1">Flow name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Welcome sequence"
              className="w-full rounded-lg border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-[#111B21] px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#25D366]/50"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-[#8696A0] mb-1">Trigger</label>
              <select
                value={trigger}
                onChange={(e) => setTrigger(e.target.value)}
                className="w-full rounded-lg border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-[#111B21] px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none"
              >
                {TRIGGERS.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
            {trigger === 'KEYWORD' && (
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-[#8696A0] mb-1">Keyword</label>
                <input
                  value={keyword}
                  onChange={(e) => setKeyword(e.target.value)}
                  placeholder="e.g. hello"
                  className="w-full rounded-lg border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-[#111B21] px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none"
                />
              </div>
            )}
          </div>

          <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 cursor-pointer">
            <input
              type="checkbox"
              checked={stopOnReply}
              onChange={(e) => setStopOnReply(e.target.checked)}
              className="rounded"
            />
            Stop flow when contact replies
          </label>

          {/* Steps */}
          <div>
            <p className="text-xs font-medium text-gray-600 dark:text-[#8696A0] mb-2">Steps</p>
            <div className="space-y-2">
              {steps.map((step, idx) => (
                <div
                  key={idx}
                  className="flex items-start gap-3 rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-[#111B21] p-3"
                >
                  <div className="mt-1 text-gray-400">
                    {step.type === 'WAIT' ? <Clock className="h-4 w-4" /> : <MessageSquare className="h-4 w-4" />}
                  </div>
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-gray-500 dark:text-[#8696A0]">
                        {idx + 1}. {step.type === 'WAIT' ? 'Wait' : 'Send message'}
                      </span>
                    </div>
                    {step.type === 'SEND_MESSAGE' && (
                      <textarea
                        value={step.message ?? ''}
                        onChange={(e) => updateStep(idx, { message: e.target.value })}
                        rows={2}
                        placeholder="Message text..."
                        className="w-full rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-[#1C2B33] px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none resize-none"
                      />
                    )}
                    {step.type === 'WAIT' && (
                      <div className="flex gap-2 flex-wrap">
                        {DELAY_PRESETS.map((p) => (
                          <button
                            key={p.ms}
                            type="button"
                            onClick={() => updateStep(idx, { delayMs: p.ms })}
                            className={`rounded-lg px-3 py-1 text-xs font-medium border transition-colors ${
                              step.delayMs === p.ms
                                ? 'bg-[#25D366] text-white border-[#25D366]'
                                : 'border-gray-200 dark:border-white/10 text-gray-600 dark:text-gray-400 hover:border-[#25D366]/50'
                            }`}
                          >
                            {p.label}
                          </button>
                        ))}
                        <input
                          type="number"
                          value={Math.round((step.delayMs ?? 60000) / 1000)}
                          onChange={(e) => updateStep(idx, { delayMs: Number(e.target.value) * 1000 })}
                          className="w-20 rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-[#1C2B33] px-2 py-1 text-xs text-gray-900 dark:text-white focus:outline-none"
                          placeholder="sec"
                        />
                        <span className="self-center text-xs text-gray-500">sec</span>
                      </div>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => removeStep(idx)}
                    className="mt-1 text-gray-400 hover:text-red-500 transition-colors"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>

            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={() => addStep('SEND_MESSAGE')}
                className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 dark:border-white/10 px-3 py-1.5 text-xs font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors"
              >
                <Plus className="h-3.5 w-3.5" />
                Add message
              </button>
              <button
                type="button"
                onClick={() => addStep('WAIT')}
                className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 dark:border-white/10 px-3 py-1.5 text-xs font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors"
              >
                <Clock className="h-3.5 w-3.5" />
                Add delay
              </button>
            </div>
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-xl border border-gray-200 dark:border-white/10 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || !name.trim()}
            className="rounded-xl bg-[#25D366] px-4 py-2 text-sm font-semibold text-white hover:bg-[#25D366]/90 disabled:opacity-50 transition-colors"
          >
            {saving ? 'Saving...' : 'Save Flow'}
          </button>
        </div>
      </div>
    </div>
  );
}
