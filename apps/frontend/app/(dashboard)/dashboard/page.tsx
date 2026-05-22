'use client';

import { useState, useEffect, useCallback } from 'react';
import { Activity, MessagesSquare, ShieldCheck, Sparkles, Clock3, Users2 } from 'lucide-react';
import { api } from '../../../lib/api';
import StatsCards from '../../../components/dashboard/StatsCards';
import MessagesChart from '../../../components/dashboard/MessagesChart';
import RecentConversations from '../../../components/dashboard/RecentConversations';
import ConnectionStatus from '../../../components/shared/ConnectionStatus';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useSocket } from '../../../hooks/useSocket';

interface OverviewData {
  totalContacts: number;
  openConversations: number;
  todayMessages: number;
  automationsFired: number;
}

interface AgentStat {
  agentId: string;
  name: string;
  email: string;
  openConversations: number;
  resolvedConversations: number;
  avgFirstResponseMin: number | null;
}

interface PipelineStats {
  stages: { stage: string; count: number; value: number }[];
  totalDeals: number;
  totalValue: number;
  closedDeals: number;
  conversionRate: number;
}

export default function DashboardPage() {
  const [overview, setOverview] = useState<OverviewData | null>(null);
  const [messagesData, setMessagesData] = useState<any[]>([]);
  const [agentStats, setAgentStats] = useState<AgentStat[]>([]);
  const [pipelineStats, setPipelineStats] = useState<PipelineStats | null>(null);
  const [status, setStatus] = useState<'connected' | 'disconnected' | 'connecting'>('disconnected');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 60000); // Refresh every minute
    return () => clearInterval(interval);
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [overviewData, messagesData, statusData, agentData, pipelineData] = await Promise.all([
        api.get('/api/analytics/overview'),
        api.get('/api/analytics/messages'),
        api.get('/api/whatsapp/status'),
        api.get('/api/analytics/agents').catch(() => []),
        api.get('/api/analytics/pipeline').catch(() => null),
      ]);

      setOverview(overviewData);
      setMessagesData(messagesData);
      setStatus(statusData.status);
      setAgentStats(Array.isArray(agentData) ? agentData : []);
      setPipelineStats(pipelineData?.totalDeals !== undefined ? pipelineData : null);
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const onMessageNew = useCallback((data: { isNewContact?: boolean }) => {
    setOverview((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        todayMessages: prev.todayMessages + 1,
        ...(data.isNewContact ? { totalContacts: prev.totalContacts + 1 } : {}),
      };
    });
  }, []);
  const onConversationUpdated = useCallback((data: { status?: string }) => {
    if (!data.status) return;
    setOverview((prev) => {
      if (!prev) return prev;
      if (data.status === 'OPEN') return { ...prev, openConversations: prev.openConversations + 1 };
      return { ...prev, openConversations: Math.max(0, prev.openConversations - 1) };
    });
  }, []);
  useSocket('message:new', onMessageNew);
  useSocket('conversation:updated', onConversationUpdated);

  if (loading && !overview) {
    return (
      <div className="space-y-6">
        <section className="overflow-hidden rounded-2xl border border-white/10 bg-[#111B21] p-6 shadow-[0_8px_20px_rgba(0,0,0,0.15)]">
          <div className="grid gap-6 lg:grid-cols-[1.4fr_0.9fr]">
            <div className="space-y-4">
              <div className="h-6 w-28 rounded-full bg-white/10" />
              <div className="h-10 w-3/4 rounded-xl bg-white/10" />
              <div className="h-5 w-full max-w-2xl rounded-full bg-white/8" />
              <div className="grid gap-3 sm:grid-cols-3">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="h-24 rounded-xl border border-white/10 bg-[#202C33]" />
                ))}
              </div>
            </div>
            <div className="rounded-xl border border-white/10 bg-[#202C33]/60 p-5">
              <div className="h-5 w-24 rounded-full bg-white/10" />
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {[...Array(2)].map((_, i) => (
                  <div key={i} className="h-24 rounded-xl border border-white/10 bg-[#202C33]" />
                ))}
              </div>
            </div>
          </div>
        </section>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-28 rounded-2xl border border-white/10 bg-[#202C33]" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-2xl border border-white/10 bg-[#111B21] p-6 shadow-[0_8px_20px_rgba(0,0,0,0.15)]">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(37,211,102,0.12),transparent_32%)]" />
        <div className="relative grid gap-6 lg:grid-cols-[1.4fr_0.9fr]">
          <div className="space-y-4">
            <div className="inline-flex items-center gap-2 rounded-full border border-[#25D366]/30 bg-[#25D366]/10 px-3 py-1.5 text-xs font-medium text-[#25D366]">
              <Sparkles className="h-3.5 w-3.5" />
              CRM overview
            </div>
            <div>
              <h1 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">WhatsApp command center</h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-[#8696A0] sm:text-base">
                Track contacts, conversations, broadcasts, and automations from a single workspace built for operators.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                <Users2 className="h-5 w-5 text-cyan-300" />
                <p className="mt-2 text-xs uppercase tracking-[0.25em] text-[#8696A0]">Contacts</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                <MessagesSquare className="h-5 w-5 text-emerald-300" />
                <p className="mt-2 text-xs uppercase tracking-[0.25em] text-[#8696A0]">Conversations</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                <Activity className="h-5 w-5 text-amber-300" />
                <p className="mt-2 text-xs uppercase tracking-[0.25em] text-[#8696A0]">Automation</p>
              </div>
            </div>
          </div>
          <Card>
            <CardHeader>
              <CardTitle className="text-white">Live status</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 ">
              <ConnectionStatus status={status} />
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-2xl bg-[#202C33] p-3">
                  <Clock3 className="h-4 w-4 text-cyan-300" />
                  <p className="mt-2 text-[#8696A0]">Refresh</p>
                  <p className="font-medium text-white">Every minute</p>
                </div>
                <div className="rounded-2xl bg-[#202C33] p-3">
                  <ShieldCheck className="h-4 w-4 text-emerald-300" />
                  <p className="mt-2 text-[#8696A0]">Sync</p>
                  <p className="font-medium text-white">Connected</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {overview && <StatsCards data={overview} />}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <MessagesChart data={messagesData} />
        <RecentConversations />
      </div>

      {agentStats.length > 0 && (
        <section className="rounded-2xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#111B21] overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-white/5">
            <h2 className="text-base font-semibold text-gray-900 dark:text-white">Agent Performance</h2>
            <p className="text-xs text-gray-500 dark:text-[#8696A0] mt-0.5">Response time and workload per agent</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100 dark:border-white/5 bg-gray-50 dark:bg-[#202C33]">
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-[#8696A0]">Agent</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-[#8696A0]">Open</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-[#8696A0]">Resolved</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-[#8696A0]">Avg. First Response</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                {agentStats.map((agent) => (
                  <tr key={agent.agentId} className="hover:bg-gray-50 dark:hover:bg-white/3 transition-colors">
                    <td className="px-6 py-3">
                      <div>
                        <p className="text-sm font-medium text-gray-900 dark:text-white">{agent.name}</p>
                        <p className="text-xs text-gray-500 dark:text-[#8696A0]">{agent.email}</p>
                      </div>
                    </td>
                    <td className="px-6 py-3 text-sm text-gray-700 dark:text-gray-300">{agent.openConversations}</td>
                    <td className="px-6 py-3 text-sm text-gray-700 dark:text-gray-300">{agent.resolvedConversations}</td>
                    <td className="px-6 py-3 text-sm text-gray-700 dark:text-gray-300">
                      {agent.avgFirstResponseMin !== null
                        ? agent.avgFirstResponseMin < 60
                          ? `${agent.avgFirstResponseMin}m`
                          : `${Math.round(agent.avgFirstResponseMin / 60)}h`
                        : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {pipelineStats && pipelineStats.totalDeals > 0 && (
        <section className="rounded-2xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#111B21] overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-white/5 flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-gray-900 dark:text-white">Pipeline Analytics</h2>
              <p className="text-xs text-gray-500 dark:text-[#8696A0] mt-0.5">Deal funnel and conversion</p>
            </div>
            <div className="flex items-center gap-6 text-sm">
              <div className="text-center">
                <p className="text-lg font-bold text-gray-900 dark:text-white">{pipelineStats.totalDeals}</p>
                <p className="text-xs text-gray-500 dark:text-[#8696A0]">Total Deals</p>
              </div>
              <div className="text-center">
                <p className="text-lg font-bold text-[#25D366]">{pipelineStats.conversionRate}%</p>
                <p className="text-xs text-gray-500 dark:text-[#8696A0]">Conversion</p>
              </div>
              <div className="text-center">
                <p className="text-lg font-bold text-gray-900 dark:text-white">${pipelineStats.totalValue.toLocaleString()}</p>
                <p className="text-xs text-gray-500 dark:text-[#8696A0]">Total Value</p>
              </div>
            </div>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-4 gap-4">
              {pipelineStats.stages.map((s, i) => {
                const pct = pipelineStats.totalDeals > 0 ? Math.round((s.count / pipelineStats.totalDeals) * 100) : 0;
                const colors = ['bg-blue-400', 'bg-purple-400', 'bg-amber-400', 'bg-[#25D366]'];
                return (
                  <div key={s.stage} className="rounded-xl border border-gray-100 dark:border-white/5 bg-gray-50 dark:bg-[#202C33] p-4">
                    <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-[#8696A0]">{s.stage}</p>
                    <p className="mt-2 text-2xl font-bold text-gray-900 dark:text-white">{s.count}</p>
                    <p className="text-xs text-gray-500 dark:text-[#8696A0]">${s.value.toLocaleString()}</p>
                    <div className="mt-3 h-1.5 w-full rounded-full bg-gray-200 dark:bg-white/10">
                      <div
                        className={`h-1.5 rounded-full ${colors[i]} ${
                          pct === 0 ? 'w-0' : pct <= 10 ? 'w-[10%]' : pct <= 25 ? 'w-1/4' : pct <= 50 ? 'w-1/2' : pct <= 75 ? 'w-3/4' : 'w-full'
                        }`}
                      />
                    </div>
                    <p className="mt-1 text-xs text-gray-400 dark:text-[#8696A0]">{pct}% of total</p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
