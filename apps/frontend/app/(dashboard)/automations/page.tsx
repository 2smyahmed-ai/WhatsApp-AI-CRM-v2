'use client';

import { useState, useEffect, useCallback } from 'react';
import { Plus, Workflow, Zap } from 'lucide-react';
import RuleCard from '../../../components/automations/RuleCard';
import RuleForm from '../../../components/automations/RuleForm';
import FlowBuilder from '../../../components/automations/FlowBuilder';
import { api } from '../../../lib/api';

interface AutomationRule {
  id: string;
  name: string;
  trigger: string;
  keyword: string | null;
  response: string;
  isActive: boolean;
  createdAt: string;
}

interface FlowStep {
  id: string;
  order: number;
  type: 'SEND_MESSAGE' | 'WAIT';
  message?: string;
  delayMs?: number;
}

interface AutomationFlow {
  id: string;
  name: string;
  trigger: string;
  keyword: string | null;
  stopOnReply: boolean;
  isActive: boolean;
  steps: FlowStep[];
  createdAt: string;
}

type Tab = 'rules' | 'flows';

export default function AutomationsPage() {
  const [tab, setTab] = useState<Tab>('rules');

  // Rules state
  const [rules, setRules] = useState<AutomationRule[]>([]);
  const [showRuleForm, setShowRuleForm] = useState(false);
  const [editingRule, setEditingRule] = useState<AutomationRule | null>(null);

  // Flows state
  const [flows, setFlows] = useState<AutomationFlow[]>([]);
  const [showFlowBuilder, setShowFlowBuilder] = useState(false);
  const [editingFlow, setEditingFlow] = useState<AutomationFlow | null>(null);

  const fetchRules = useCallback(async () => {
    try {
      const data = await api.get('/api/automations');
      setRules(Array.isArray(data) ? data : []);
    } catch { setRules([]); }
  }, []);

  const fetchFlows = useCallback(async () => {
    try {
      const data = await api.get('/api/automations/flows');
      setFlows(Array.isArray(data) ? data : []);
    } catch { setFlows([]); }
  }, []);

  useEffect(() => { fetchRules(); fetchFlows(); }, [fetchRules, fetchFlows]);

  // Rule handlers
  const handleSaveRule = async (rule: Partial<AutomationRule>) => {
    if (editingRule) await api.put(`/api/automations/${editingRule.id}`, rule);
    else await api.post('/api/automations', rule);
    setShowRuleForm(false);
    setEditingRule(null);
    fetchRules();
  };

  const handleDeleteRule = async (id: string) => {
    await api.delete(`/api/automations/${id}`);
    fetchRules();
  };

  const handleToggleRule = async (id: string) => {
    await api.put(`/api/automations/${id}/toggle`, {});
    fetchRules();
  };

  // Flow handlers
  const handleSaveFlow = async (data: any) => {
    if (editingFlow) await api.put(`/api/automations/flows/${editingFlow.id}`, data);
    else await api.post('/api/automations/flows', data);
    setShowFlowBuilder(false);
    setEditingFlow(null);
    fetchFlows();
  };

  const handleDeleteFlow = async (id: string) => {
    if (!confirm('Delete this flow?')) return;
    await api.delete(`/api/automations/flows/${id}`);
    fetchFlows();
  };

  const handleToggleFlow = async (id: string) => {
    await api.put(`/api/automations/flows/${id}/toggle`, {});
    fetchFlows();
  };

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-2xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#111B21] p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-[#25D366]/30 bg-[#25D366]/10 dark:bg-[#25D366]/15 px-3 py-1.5 text-xs font-medium text-[#25D366]">
              <Workflow className="h-3.5 w-3.5" />
              Automation center
            </div>
            <h1 className="mt-3 text-3xl font-semibold text-gray-900 dark:text-white">Automations</h1>
            <p className="mt-1.5 text-sm text-gray-500 dark:text-[#8696A0]">
              Simple reply rules and multi-step drip flows.
            </p>
          </div>
          <button
            type="button"
            onClick={() => tab === 'rules' ? setShowRuleForm(true) : setShowFlowBuilder(true)}
            className="inline-flex items-center rounded-xl bg-[#25D366] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#25D366]/90"
          >
            <Plus className="mr-2 h-4 w-4" />
            {tab === 'rules' ? 'Add Rule' : 'Add Flow'}
          </button>
        </div>

        <div className="mt-4 flex gap-1 border-b border-gray-200 dark:border-white/10">
          <button
            type="button"
            onClick={() => setTab('rules')}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              tab === 'rules'
                ? 'border-[#25D366] text-[#25D366]'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            Simple Rules
          </button>
          <button
            type="button"
            onClick={() => setTab('flows')}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              tab === 'flows'
                ? 'border-[#25D366] text-[#25D366]'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            Multi-step Flows
          </button>
        </div>
      </section>

      {tab === 'rules' && (
        <>
          {rules.length === 0 && (
            <div className="rounded-2xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#111B21] p-10 text-center text-sm text-gray-500 dark:text-[#8696A0]">
              No automation rules yet. Click "Add Rule" to create one.
            </div>
          )}
          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {rules.map((rule) => (
              <RuleCard
                key={rule.id}
                rule={rule}
                onEdit={() => { setEditingRule(rule); setShowRuleForm(true); }}
                onDelete={() => handleDeleteRule(rule.id)}
                onToggle={() => handleToggleRule(rule.id)}
              />
            ))}
          </div>
        </>
      )}

      {tab === 'flows' && (
        <>
          {flows.length === 0 && (
            <div className="rounded-2xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#111B21] p-10 text-center text-sm text-gray-500 dark:text-[#8696A0]">
              No multi-step flows yet. Click "Add Flow" to create one.
            </div>
          )}
          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {flows.map((flow) => (
              <div
                key={flow.id}
                className="rounded-2xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#111B21] p-5 space-y-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold text-gray-900 dark:text-white">{flow.name}</p>
                    <p className="text-xs text-gray-500 dark:text-[#8696A0] mt-0.5">
                      {flow.trigger}{flow.keyword ? ` · "${flow.keyword}"` : ''} · {flow.steps.length} steps
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleToggleFlow(flow.id)}
                    className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
                      flow.isActive
                        ? 'bg-[#25D366]/10 text-[#25D366]'
                        : 'bg-gray-100 dark:bg-white/5 text-gray-500 dark:text-[#8696A0]'
                    }`}
                  >
                    {flow.isActive ? 'Active' : 'Paused'}
                  </button>
                </div>

                <div className="space-y-1">
                  {flow.steps.slice(0, 3).map((step, i) => (
                    <div key={step.id} className="flex items-center gap-2 text-xs text-gray-500 dark:text-[#8696A0]">
                      <Zap className="h-3 w-3 shrink-0" />
                      {step.type === 'WAIT'
                        ? `Wait ${Math.round((step.delayMs ?? 0) / 60000)} min`
                        : `Send: ${(step.message ?? '').slice(0, 40)}${(step.message?.length ?? 0) > 40 ? '…' : ''}`}
                    </div>
                  ))}
                  {flow.steps.length > 3 && (
                    <p className="text-xs text-gray-400 dark:text-[#8696A0]">+{flow.steps.length - 3} more steps</p>
                  )}
                </div>

                <div className="flex gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => { setEditingFlow(flow); setShowFlowBuilder(true); }}
                    className="flex-1 rounded-lg border border-gray-200 dark:border-white/10 py-1.5 text-xs font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteFlow(flow.id)}
                    className="flex-1 rounded-lg border border-red-200 dark:border-red-500/30 py-1.5 text-xs font-medium text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {showRuleForm && (
        <RuleForm
          rule={editingRule}
          onSave={handleSaveRule}
          onCancel={() => { setShowRuleForm(false); setEditingRule(null); }}
        />
      )}

      {showFlowBuilder && (
        <FlowBuilder
          initial={editingFlow ? {
            name: editingFlow.name,
            trigger: editingFlow.trigger,
            keyword: editingFlow.keyword ?? undefined,
            stopOnReply: editingFlow.stopOnReply,
            steps: editingFlow.steps.map((s) => ({
              order: s.order,
              type: s.type,
              message: s.message,
              delayMs: s.delayMs,
            })),
          } : undefined}
          onSave={handleSaveFlow}
          onCancel={() => { setShowFlowBuilder(false); setEditingFlow(null); }}
        />
      )}
    </div>
  );
}
