'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { UserCheck, Users, RefreshCw, Clock } from 'lucide-react';

interface AuditLog {
  id: string;
  action: string;
  resource: string;
  details: Record<string, any>;
  createdAt: string;
  user?: { id: string; name: string; email: string } | null;
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function ActionIcon({ action }: { action: string }) {
  if (action === 'assign_user') return <UserCheck className="h-4 w-4 text-blue-500" />;
  if (action === 'assign_team') return <Users className="h-4 w-4 text-purple-500" />;
  if (action === 'status_change') return <RefreshCw className="h-4 w-4 text-green-500" />;
  return <Clock className="h-4 w-4 text-gray-400" />;
}

function describeAction(log: AuditLog) {
  const actor = log.user?.name || log.user?.email || 'System';
  const d = log.details || {};
  if (log.action === 'assign_user') {
    return d.agentName
      ? `${actor} assigned to ${d.agentName}`
      : `${actor} unassigned agent`;
  }
  if (log.action === 'assign_team') {
    return d.teamName
      ? `${actor} assigned to team ${d.teamName}`
      : `${actor} removed team`;
  }
  if (log.action === 'status_change') {
    return `${actor} changed status to ${d.newStatus || d.status || '?'}`;
  }
  return `${actor} — ${log.action}`;
}

export default function AssignmentHistory({ conversationId }: { conversationId: string }) {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api.get(`/api/activity/conversation/${conversationId}`)
      .then((data) => setLogs(Array.isArray(data) ? data : []))
      .catch(() => setLogs([]))
      .finally(() => setLoading(false));
  }, [conversationId]);

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-100 dark:border-white/10">
        <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-[#8696A0]">
          Assignment History
        </p>
      </div>
      <div className="flex-1 overflow-y-auto p-4">
        {loading ? (
          <p className="text-center text-xs text-gray-400 dark:text-[#8696A0] mt-8">Loading…</p>
        ) : logs.length === 0 ? (
          <p className="text-center text-xs text-gray-400 dark:text-[#8696A0] mt-8">No history yet</p>
        ) : (
          <ol className="relative border-l border-gray-200 dark:border-white/10 ml-2 space-y-4">
            {logs.map((log) => (
              <li key={log.id} className="ml-4">
                <span className="absolute -left-2 flex h-4 w-4 items-center justify-center rounded-full bg-white dark:bg-[#111B21] ring-2 ring-gray-200 dark:ring-white/10">
                  <ActionIcon action={log.action} />
                </span>
                <p className="text-sm text-gray-800 dark:text-[#E9EDEF]">{describeAction(log)}</p>
                <p className="text-xs text-gray-400 dark:text-[#8696A0]">{timeAgo(log.createdAt)}</p>
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  );
}
