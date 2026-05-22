'use client';

import { useEffect, useState, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { CheckSquare, Plus, Pencil, Trash2 } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { api } from '../../../lib/api';
import { Input } from '../../../components/ui/input';
import { cn } from '../../../lib/utils';
import { useSocket } from '../../../hooks/useSocket';

type TaskStatus   = 'OPEN' | 'IN_PROGRESS' | 'DONE';
type TaskPriority = 'LOW' | 'MEDIUM' | 'HIGH';

type Task = {
  id: string;
  title: string;
  contactId?: string | null;
  assigneeId?: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  dueDate: string | null;
  description?: string | null;
  contact?: { name?: string | null; phone: string };
  assignee?: { name?: string | null; email: string };
};

type ContactOption = { id: string; name: string | null; phone: string };
type MemberOption  = { id: string; name: string | null; email: string };

const STATUS_LABELS: Record<TaskStatus, string> = {
  OPEN:        'To Do',
  IN_PROGRESS: 'In Progress',
  DONE:        'Done',
};

const STATUS_STYLES: Record<TaskStatus, string> = {
  OPEN:        'bg-gray-100 text-gray-600 dark:bg-white/10 dark:text-[#8696A0]',
  IN_PROGRESS: 'bg-blue-100 text-blue-700 dark:bg-blue-400/15 dark:text-blue-300',
  DONE:        'bg-green-100 text-green-700 dark:bg-[#25D366]/15 dark:text-[#25D366]',
};

const PRIORITY_STYLES: Record<TaskPriority, string> = {
  LOW:    'bg-gray-100 text-gray-500 dark:bg-white/5 dark:text-[#8696A0]',
  MEDIUM: 'bg-amber-100 text-amber-600 dark:bg-amber-400/15 dark:text-amber-400',
  HIGH:   'bg-red-100 text-red-600 dark:bg-red-400/15 dark:text-red-400',
};

const ADMIN_ROLES = ['SUPER_ADMIN', 'ADMIN'];

const emptyForm = {
  contactId: '', assigneeId: '', title: '', description: '',
  dueDate: '', status: 'OPEN' as TaskStatus, priority: 'MEDIUM' as TaskPriority,
};

export default function TasksPage() {
  const { data: session } = useSession();
  const searchParams = useSearchParams();
  const role    = (session?.user as any)?.role ?? 'AGENT';
  const isAdmin = ADMIN_ROLES.includes(role);

  const [tasks, setTasks]         = useState<Task[]>([]);
  const [contacts, setContacts]   = useState<ContactOption[]>([]);
  const [members, setMembers]     = useState<MemberOption[]>([]);
  const [error, setError]         = useState<string | null>(null);
  const [success, setSuccess]     = useState<string | null>(null);
  const [editingTask, setEditing] = useState<Task | null>(null);
  const [showForm, setShowForm]   = useState(false);
  const [saving, setSaving]       = useState(false);
  const [formData, setFormData]   = useState(emptyForm);
  const [filterStatus, setFilter] = useState<TaskStatus | 'ALL'>('ALL');

  const presetContactId = searchParams.get('contactId');

  const loadAll = useCallback(async () => {
    try {
      setError(null);
      const [taskData, contactData, agentData] = await Promise.all([
        api.get('/api/tasks'),
        api.get('/api/contacts'),
        api.get('/api/teams/agents'),
      ]);
      setTasks(Array.isArray(taskData) ? taskData : []);
      setContacts(Array.isArray(contactData) ? contactData : []);
      setMembers(Array.isArray(agentData) ? agentData : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load tasks');
    }
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  useEffect(() => {
    if (!presetContactId || editingTask) return;
    setFormData((cur) => ({ ...cur, contactId: presetContactId }));
  }, [editingTask, presetContactId]);

  useEffect(() => {
    if (presetContactId && !editingTask) setShowForm(true);
  }, [editingTask, presetContactId]);

  useEffect(() => {
    if (editingTask) {
      setFormData({
        contactId:   editingTask.contactId   || '',
        assigneeId:  editingTask.assigneeId  || '',
        title:       editingTask.title,
        description: editingTask.description || '',
        dueDate:     editingTask.dueDate ? editingTask.dueDate.slice(0, 10) : '',
        status:      editingTask.status,
        priority:    editingTask.priority ?? 'MEDIUM',
      });
    } else {
      setFormData(emptyForm);
    }
  }, [editingTask, showForm]);

  useEffect(() => {
    if (!showForm) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') { setShowForm(false); setEditing(null); } };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [showForm]);

  const onTaskCreated = useCallback((task: Task) => {
    setTasks((prev) => prev.some((t) => t.id === task.id) ? prev : [task, ...prev]);
  }, []);
  const onTaskUpdated = useCallback((task: Task) => {
    setTasks((prev) => prev.map((t) => t.id === task.id ? task : t));
  }, []);
  const onTaskDeleted = useCallback(({ id }: { id: string }) => {
    setTasks((prev) => prev.filter((t) => t.id !== id));
  }, []);
  useSocket('task:created', onTaskCreated);
  useSocket('task:updated', onTaskUpdated);
  useSocket('task:deleted', onTaskDeleted);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true); setSuccess(null); setError(null);
    try {
      const payload: any = {
        title:      formData.title,
        description: formData.description || undefined,
        dueDate:    formData.dueDate ? new Date(formData.dueDate).toISOString() : undefined,
        status:     formData.status,
        priority:   formData.priority,
        contactId:  formData.contactId || undefined,
      };
      if (isAdmin) payload.assigneeId = formData.assigneeId || undefined;

      if (editingTask) {
        await api.put(`/api/tasks/${editingTask.id}`, payload);
        setSuccess('Task updated.');
      } else {
        await api.post('/api/tasks', payload);
        setSuccess('Task created.');
      }
      setShowForm(false); setEditing(null);
      await loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save task');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this task?')) return;
    try {
      await api.delete(`/api/tasks/${id}`);
      setSuccess('Task deleted.');
      await loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete task');
    }
  };

  const handleStatusChange = async (task: Task, status: TaskStatus) => {
    setTasks((prev) => prev.map((t) => t.id === task.id ? { ...t, status } : t));
    try {
      await api.put(`/api/tasks/${task.id}`, { status });
    } catch (err) {
      setTasks((prev) => prev.map((t) => t.id === task.id ? task : t));
      setError(err instanceof Error ? err.message : 'Failed to update status');
    }
  };

  const filtered = filterStatus === 'ALL' ? tasks : tasks.filter((t) => t.status === filterStatus);

  return (
    <div className="space-y-6">
      {/* Header */}
      <section className="rounded-2xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#202C33] p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-[#25D366]/30 bg-[#25D366]/10 dark:bg-[#25D366]/15 px-3 py-1.5 text-xs font-medium text-[#25D366]">
              <CheckSquare className="h-3.5 w-3.5" />
              {isAdmin ? 'All Team Tasks' : 'My Tasks'}
            </div>
            <h1 className="mt-3 text-3xl font-semibold text-gray-900 dark:text-white">Tasks</h1>
            <p className="mt-1.5 text-sm text-gray-500 dark:text-[#8696A0]">
              {isAdmin ? 'Manage and assign tasks across your team.' : 'Track and update your assigned tasks.'}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {/* Status filter */}
            <select
              value={filterStatus}
              onChange={(e) => setFilter(e.target.value as any)}
              className="h-10 rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#202C33] px-3 text-sm text-gray-900 dark:text-white outline-none"
            >
              <option value="ALL">All Statuses</option>
              <option value="OPEN">To Do</option>
              <option value="IN_PROGRESS">In Progress</option>
              <option value="DONE">Done</option>
            </select>
            <button
              type="button"
              onClick={() => { setEditing(null); setShowForm(true); }}
              className="inline-flex items-center gap-2 rounded-xl bg-[#25D366] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#25D366]/90 transition-colors"
            >
              <Plus className="h-4 w-4" />
              New Task
            </button>
          </div>
        </div>
      </section>

      {error   && <div className="rounded-xl border border-red-300 dark:border-red-400/20 bg-red-50 dark:bg-red-400/10 px-4 py-3 text-sm text-red-700 dark:text-red-200">{error}</div>}
      {success && <div className="rounded-xl border border-green-300 dark:border-emerald-400/20 bg-green-50 dark:bg-emerald-400/10 px-4 py-3 text-sm text-green-700 dark:text-emerald-100">{success}</div>}

      {/* Task table */}
      <div className="rounded-2xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#111B21] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-[#202C33]">
                {['Task', 'Priority', 'Contact', 'Assignee', 'Due', 'Status', 'Actions'].map((h) => (
                  <th key={h} className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-600 dark:text-[#8696A0]">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-white/5">
              {filtered.map((task) => (
                <tr key={task.id} className="hover:bg-gray-50 dark:hover:bg-white/3 transition-colors">
                  <td className="px-5 py-3.5">
                    <p className="text-sm font-medium text-gray-900 dark:text-white">{task.title}</p>
                    {task.description && <p className="mt-0.5 text-xs text-gray-400 dark:text-[#8696A0] line-clamp-1">{task.description}</p>}
                  </td>
                  <td className="px-5 py-3.5">
                    <span className={cn('rounded-full px-2.5 py-1 text-xs font-semibold', PRIORITY_STYLES[task.priority ?? 'MEDIUM'])}>
                      {(task.priority ?? 'MEDIUM').charAt(0) + (task.priority ?? 'MEDIUM').slice(1).toLowerCase()}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-sm text-gray-600 dark:text-[#8696A0]">
                    {task.contact?.name || task.contact?.phone || '—'}
                  </td>
                  <td className="px-5 py-3.5 text-sm text-gray-600 dark:text-[#8696A0]">
                    {task.assignee?.name || task.assignee?.email || '—'}
                  </td>
                  <td className="px-5 py-3.5 text-sm text-gray-600 dark:text-[#8696A0]">
                    {task.dueDate ? new Date(task.dueDate).toLocaleDateString() : '—'}
                  </td>
                  <td className="px-5 py-3.5">
                    <select
                      value={task.status}
                      onChange={(e) => handleStatusChange(task, e.target.value as TaskStatus)}
                      className={cn(
                        'rounded-full border-0 px-2.5 py-1 text-xs font-semibold outline-none cursor-pointer',
                        STATUS_STYLES[task.status],
                      )}
                    >
                      <option value="OPEN">To Do</option>
                      <option value="IN_PROGRESS">In Progress</option>
                      <option value="DONE">Done</option>
                    </select>
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => { setEditing(task); setShowForm(true); }}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-[#202C33] px-3 py-1.5 text-xs font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/10 transition-colors"
                      >
                        <Pencil className="h-3 w-3" /> Edit
                      </button>
                      {isAdmin && (
                        <button
                          type="button"
                          onClick={() => handleDelete(task.id)}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 dark:border-red-400/20 bg-red-50 dark:bg-red-400/10 px-3 py-1.5 text-xs font-medium text-red-600 dark:text-red-300 hover:bg-red-100 dark:hover:bg-red-400/20 transition-colors"
                        >
                          <Trash2 className="h-3 w-3" /> Delete
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-5 py-10 text-center text-sm text-gray-500 dark:text-[#8696A0]">
                    {filterStatus === 'ALL' ? 'No tasks yet.' : `No ${STATUS_LABELS[filterStatus as TaskStatus]} tasks.`}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create / Edit modal */}
      {showForm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onClick={() => { setShowForm(false); setEditing(null); }}
        >
          <form
            onSubmit={handleSubmit}
            className="w-full max-w-lg rounded-2xl border border-white/10 bg-[#111B21] p-6 shadow-[0_30px_90px_rgba(0,0,0,0.3)]"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-xl font-semibold text-white mb-5">{editingTask ? 'Edit Task' : 'New Task'}</h2>
            <div className="space-y-4">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-[#8696A0]">Title *</label>
                <Input required value={formData.title} onChange={(e) => setFormData({ ...formData, title: e.target.value })} placeholder="Follow-up call" />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-[#8696A0]">Description</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={3}
                  className="w-full rounded-lg border border-white/10 bg-[#202C33] px-3 py-2 text-sm text-white outline-none focus:border-[#25D366]"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-[#8696A0]">Contact</label>
                <select value={formData.contactId} onChange={(e) => setFormData({ ...formData, contactId: e.target.value })}
                  className="h-10 w-full rounded-lg border border-white/10 bg-[#202C33] px-3 text-sm text-white outline-none focus:border-[#25D366]">
                  <option value="">No contact</option>
                  {contacts.map((c) => <option key={c.id} value={c.id}>{c.name || c.phone}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-[#8696A0]">Priority</label>
                  <select value={formData.priority} onChange={(e) => setFormData({ ...formData, priority: e.target.value as TaskPriority })}
                    className="h-10 w-full rounded-lg border border-white/10 bg-[#202C33] px-3 text-sm text-white outline-none focus:border-[#25D366]">
                    <option value="LOW">Low</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="HIGH">High</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-[#8696A0]">Status</label>
                  <select value={formData.status} onChange={(e) => setFormData({ ...formData, status: e.target.value as TaskStatus })}
                    className="h-10 w-full rounded-lg border border-white/10 bg-[#202C33] px-3 text-sm text-white outline-none focus:border-[#25D366]">
                    <option value="OPEN">To Do</option>
                    <option value="IN_PROGRESS">In Progress</option>
                    <option value="DONE">Done</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-[#8696A0]">Due date</label>
                  <Input type="date" value={formData.dueDate} onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })} />
                </div>
              </div>
              {isAdmin && (
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-[#8696A0]">Assignee</label>
                  <select value={formData.assigneeId} onChange={(e) => setFormData({ ...formData, assigneeId: e.target.value })}
                    className="h-10 w-full rounded-lg border border-white/10 bg-[#202C33] px-3 text-sm text-white outline-none focus:border-[#25D366]">
                    <option value="">Unassigned</option>
                    {members.map((m) => <option key={m.id} value={m.id}>{m.name || m.email}</option>)}
                  </select>
                </div>
              )}
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button type="button" onClick={() => { setShowForm(false); setEditing(null); }}
                className="rounded-xl border border-white/10 bg-[#202C33] px-4 py-2 text-sm text-white hover:bg-white/10">
                Cancel
              </button>
              <button type="submit" disabled={saving}
                className="rounded-xl bg-[#25D366] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50 hover:bg-[#25D366]/90">
                {saving ? 'Saving…' : 'Save Task'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
