'use client';

import { useState, useEffect, useCallback } from 'react';
import { Plus, Send, Megaphone, Pause, Play } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api } from '../../../lib/api';
import { useSocket } from '../../../hooks/useSocket';

interface Broadcast {
  id: string;
  name: string;
  status: string;
  totalSent: number;
  totalFailed: number;
  createdAt: string;
}

export default function BroadcastsPage() {
  const router = useRouter();
  const [broadcasts, setBroadcasts] = useState<Broadcast[]>([]);
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [pausingId, setPausingId] = useState<string | null>(null);

  const fetchBroadcasts = useCallback(async () => {
    try {
      const data = await api.get('/api/broadcasts');
      setBroadcasts(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Failed to fetch broadcasts:', error);
      setBroadcasts([]);
    }
  }, []);

  const handleSendBroadcast = async (id: string) => {
    try {
      setSendingId(id);
      await api.post(`/api/broadcasts/${id}/send`, {});
      await fetchBroadcasts();
    } catch (error) {
      console.error('Failed to send broadcast:', error);
    } finally {
      setSendingId(null);
    }
  };

  const handlePauseBroadcast = async (id: string) => {
    try {
      setPausingId(id);
      await api.post(`/api/broadcasts/${id}/pause`, {});
      await fetchBroadcasts();
    } catch (error) {
      console.error('Failed to pause broadcast:', error);
    } finally {
      setPausingId(null);
    }
  };

  const handleResumeBroadcast = async (id: string) => {
    try {
      setPausingId(id);
      await api.post(`/api/broadcasts/${id}/resume`, {});
      await fetchBroadcasts();
    } catch (error) {
      console.error('Failed to resume broadcast:', error);
    } finally {
      setPausingId(null);
    }
  };

  const handleDeleteBroadcast = async (id: string) => {
    const confirmed = window.confirm('Delete this broadcast? This cannot be undone.');
    if (!confirmed) return;

    try {
      setDeletingId(id);
      await api.delete(`/api/broadcasts/${id}`);
      await fetchBroadcasts();
      router.refresh();
    } catch (error) {
      console.error('Failed to delete broadcast:', error);
    } finally {
      setDeletingId(null);
    }
  };

  useEffect(() => {
    fetchBroadcasts();
  }, [fetchBroadcasts]);

  const onBroadcastProgress = useCallback(
    ({ broadcastId, sent, failed }: { broadcastId: string; sent: number; failed: number; total: number }) => {
      setBroadcasts((prev) =>
        prev.map((b) =>
          b.id === broadcastId ? { ...b, totalSent: sent, totalFailed: failed, status: 'SENDING' } : b,
        ),
      );
    },
    [],
  );
  const onBroadcastComplete = useCallback(
    ({ broadcastId, sent, failed, status }: { broadcastId: string; sent: number; failed: number; total: number; status: string }) => {
      setBroadcasts((prev) =>
        prev.map((b) =>
          b.id === broadcastId ? { ...b, totalSent: sent, totalFailed: failed, status } : b,
        ),
      );
    },
    [],
  );
  useSocket('broadcast:progress', onBroadcastProgress);
  useSocket('broadcast:complete', onBroadcastComplete);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'DRAFT':     return 'bg-gray-100 text-gray-700 dark:bg-white/10 dark:text-[#8696A0]';
      case 'SCHEDULED': return 'bg-blue-100 text-blue-700 dark:bg-blue-400/15 dark:text-blue-300';
      case 'SENDING':   return 'bg-amber-100 text-amber-700 dark:bg-amber-400/15 dark:text-amber-300';
      case 'PAUSED':    return 'bg-orange-100 text-orange-700 dark:bg-orange-400/15 dark:text-orange-300';
      case 'SENT':      return 'bg-green-100 text-green-700 dark:bg-[#25D366]/15 dark:text-[#25D366]';
      case 'FAILED':    return 'bg-red-100 text-red-700 dark:bg-red-400/15 dark:text-red-300';
      default:          return 'bg-gray-100 text-gray-700 dark:bg-white/10 dark:text-[#8696A0]';
    }
  };

  const totals = broadcasts.reduce(
    (acc, broadcast) => {
      acc.total += 1;
      acc.sent += broadcast.totalSent;
      acc.failed += broadcast.totalFailed;
      if (broadcast.status === 'SCHEDULED') acc.scheduled += 1;
      if (broadcast.status === 'SENDING') acc.sending += 1;
      if (broadcast.status === 'DRAFT') acc.drafts += 1;
      return acc;
    },
    { total: 0, sent: 0, failed: 0, scheduled: 0, sending: 0, drafts: 0 },
  );

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-2xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#111B21] p-6 shadow-card dark:shadow-[0_8px_20px_rgba(0,0,0,0.2)]">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-[#25D366]/30 dark:border-[#25D366]/30 bg-[#25D366]/10 dark:bg-[#25D366]/15 px-3 py-1.5 text-xs font-medium text-[#25D366]">
              <Megaphone className="h-3.5 w-3.5" />
              Broadcast center
            </div>
            <h1 className="mt-3 text-3xl font-semibold text-gray-900 dark:text-white">Broadcasts</h1>
            <p className="mt-2 text-sm leading-6 text-gray-600 dark:text-[#8696A0]">Create, edit, send, and track only the broadcast workflows already available in your backend.</p>
          </div>
          <Link
            href="/broadcasts/new"
            className="inline-flex items-center rounded-xl bg-[#25D366] dark:bg-[#25D366] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#25D366]/90 dark:hover:bg-[#25D366]/90"
          >
            <Plus className="mr-2 h-4 w-4" />
            New Broadcast
          </Link>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#111B21] p-5 shadow-card dark:shadow-[0_8px_20px_rgba(0,0,0,0.2)]">
          <p className="text-xs uppercase tracking-[0.24em] text-gray-600 dark:text-[#8696A0]">Broadcasts</p>
          <p className="mt-2 text-3xl font-semibold text-gray-900 dark:text-white">{totals.total}</p>
          <p className="mt-1 text-sm text-gray-600 dark:text-[#8696A0]">All broadcast definitions in the workspace.</p>
        </div>
        <div className="rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#111B21] p-5 shadow-card dark:shadow-[0_8px_20px_rgba(0,0,0,0.2)]">
          <p className="text-xs uppercase tracking-[0.24em] text-gray-600 dark:text-[#8696A0]">Sent messages</p>
          <p className="mt-2 text-3xl font-semibold text-gray-900 dark:text-white">{totals.sent}</p>
          <p className="mt-1 text-sm text-gray-600 dark:text-[#8696A0]">Cumulative successful deliveries from this list.</p>
        </div>
        <div className="rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#111B21] p-5 shadow-card dark:shadow-[0_8px_20px_rgba(0,0,0,0.2)]">
          <p className="text-xs uppercase tracking-[0.24em] text-gray-600 dark:text-[#8696A0]">Failed</p>
          <p className="mt-2 text-3xl font-semibold text-gray-900 dark:text-white">{totals.failed}</p>
          <p className="mt-1 text-sm text-gray-600 dark:text-[#8696A0]">Failures reported by the send pipeline.</p>
        </div>
        <div className="rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#111B21] p-5 shadow-card dark:shadow-[0_8px_20px_rgba(0,0,0,0.2)]">
          <p className="text-xs uppercase tracking-[0.24em] text-gray-600 dark:text-[#8696A0]">In flight</p>
          <p className="mt-2 text-3xl font-semibold text-gray-900 dark:text-white">{totals.scheduled + totals.sending + totals.drafts}</p>
          <p className="mt-1 text-sm text-gray-600 dark:text-[#8696A0]">Drafts, scheduled, and actively sending broadcasts.</p>
        </div>
      </section>

      <div className="rounded-2xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#111B21] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-[#111B21]">
                <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-gray-700 dark:text-[#8696A0] dark:text-slate-300">Name</th>
                <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-gray-700 dark:text-[#8696A0] dark:text-slate-300">Status</th>
                <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-gray-700 dark:text-[#8696A0] dark:text-slate-300">Sent</th>
                <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-gray-700 dark:text-[#8696A0] dark:text-slate-300">Failed</th>
                <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-gray-700 dark:text-[#8696A0] dark:text-slate-300">Created</th>
                <th className="px-6 py-4 text-right text-xs font-semibold uppercase tracking-wider text-gray-700 dark:text-[#8696A0] dark:text-slate-300">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-white/5">
              {broadcasts.map((broadcast) => (
                <tr key={broadcast.id} className="hover:bg-gray-50 dark:hover:bg-white/3 transition-colors">
                  <td className="px-6 py-3 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-gray-100">{broadcast.name}</td>
                  <td className="px-6 py-3 whitespace-nowrap">
                    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${getStatusColor(broadcast.status)}`}>
                      {broadcast.status}
                    </span>
                  </td>
                  <td className="px-6 py-3 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">{broadcast.totalSent}</td>
                  <td className="px-6 py-3 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">{broadcast.totalFailed}</td>
                  <td className="px-6 py-3 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">{new Date(broadcast.createdAt).toLocaleDateString()}</td>
                  <td className="px-6 py-3 whitespace-nowrap text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Link
                        href={`/broadcasts/${broadcast.id}/edit`}
                        className="inline-flex items-center rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-[#111B21] px-3 py-1.5 text-xs font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/10 transition-colors"
                      >
                        Edit
                      </Link>
                      {broadcast.status === 'SENDING' && (
                        <button
                          type="button"
                          onClick={() => handlePauseBroadcast(broadcast.id)}
                          disabled={pausingId === broadcast.id}
                          className="inline-flex items-center rounded-lg bg-orange-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-orange-600 disabled:opacity-50 transition-colors"
                        >
                          <Pause className="mr-1.5 h-3.5 w-3.5" />
                          Pause
                        </button>
                      )}
                      {broadcast.status === 'PAUSED' && (
                        <button
                          type="button"
                          onClick={() => handleResumeBroadcast(broadcast.id)}
                          disabled={pausingId === broadcast.id}
                          className="inline-flex items-center rounded-lg bg-blue-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-600 disabled:opacity-50 transition-colors"
                        >
                          <Play className="mr-1.5 h-3.5 w-3.5" />
                          Resume
                        </button>
                      )}
                      {(broadcast.status === 'DRAFT' || broadcast.status === 'SCHEDULED') && (
                        <button
                          type="button"
                          onClick={() => handleSendBroadcast(broadcast.id)}
                          disabled={sendingId === broadcast.id}
                          className="inline-flex items-center rounded-lg bg-brand-500 dark:bg-brand-500 px-3 py-1.5 text-xs font-medium text-white dark:text-white hover:bg-brand-600 dark:hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-50 transition-colors"
                        >
                          <Send className="mr-1.5 h-3.5 w-3.5" />
                          {sendingId === broadcast.id ? 'Sending...' : 'Send'}
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => handleDeleteBroadcast(broadcast.id)}
                        disabled={deletingId === broadcast.id}
                        className="inline-flex items-center rounded-lg bg-rose-500 text-white px-3 py-1.5 text-xs font-medium hover:bg-rose-600 disabled:cursor-not-allowed disabled:opacity-50 transition-colors"
                      >
                        {deletingId === broadcast.id ? 'Deleting...' : 'Delete'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
