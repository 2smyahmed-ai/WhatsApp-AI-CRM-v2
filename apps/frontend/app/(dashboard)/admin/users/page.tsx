'use client';

import { useEffect, useState, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { UserCog, Plus, Pencil, Trash2, ShieldCheck } from 'lucide-react';
import { api } from '../../../../lib/api';
import { cn } from '../../../../lib/utils';

type Role = 'SUPER_ADMIN' | 'ADMIN' | 'TEAM_LEAD' | 'AGENT' | 'ANALYST' | 'VIEWER';

type User = {
  id: string;
  name: string;
  email: string;
  role: Role;
  teamId: string | null;
  createdAt: string;
  team?: { id: string; name: string } | null;
};

type Team = { id: string; name: string };

const ROLES: Role[] = ['SUPER_ADMIN', 'ADMIN', 'TEAM_LEAD', 'AGENT', 'ANALYST', 'VIEWER'];
const ADMIN_ROLES = ['SUPER_ADMIN', 'ADMIN'];

const ROLE_BADGE: Record<Role, string> = {
  SUPER_ADMIN: 'bg-purple-100 text-purple-700 dark:bg-purple-400/15 dark:text-purple-300',
  ADMIN:       'bg-amber-100  text-amber-700  dark:bg-amber-400/15  dark:text-amber-300',
  TEAM_LEAD:   'bg-blue-100   text-blue-700   dark:bg-blue-400/15   dark:text-blue-300',
  AGENT:       'bg-gray-100   text-gray-600   dark:bg-white/10      dark:text-[#8696A0]',
  ANALYST:     'bg-teal-100   text-teal-700   dark:bg-teal-400/15   dark:text-teal-300',
  VIEWER:      'bg-gray-100   text-gray-500   dark:bg-white/5       dark:text-[#8696A0]',
};

const emptyForm = { name: '', email: '', password: '', role: 'AGENT' as Role, teamId: '' };

export default function AdminUsersPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const role = (session?.user as any)?.role;

  const [users, setUsers]         = useState<User[]>([]);
  const [teams, setTeams]         = useState<Team[]>([]);
  const [showForm, setShowForm]   = useState(false);
  const [editing, setEditing]     = useState<User | null>(null);
  const [formData, setFormData]   = useState(emptyForm);
  const [saving, setSaving]       = useState(false);
  const [error, setError]         = useState('');
  const [success, setSuccess]     = useState('');

  // Guard: redirect non-admins
  useEffect(() => {
    if (status === 'loading') return;
    if (!ADMIN_ROLES.includes(role)) router.replace('/dashboard');
  }, [role, status, router]);

  const loadData = useCallback(async () => {
    const [usersData, teamsData] = await Promise.all([
      api.get('/api/users'),
      api.get('/api/teams/all'),
    ]);
    setUsers(Array.isArray(usersData) ? usersData : []);
    setTeams(Array.isArray(teamsData) ? teamsData : []);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  useEffect(() => {
    if (editing) {
      setFormData({ name: editing.name, email: editing.email, password: '', role: editing.role, teamId: editing.teamId || '' });
    } else {
      setFormData(emptyForm);
    }
  }, [editing, showForm]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(''); setSaving(true);
    try {
      const payload: any = { name: formData.name, email: formData.email, role: formData.role, teamId: formData.teamId || null };
      if (!editing || formData.password) payload.password = formData.password;

      if (editing) {
        await api.put(`/api/users/${editing.id}`, payload);
        setSuccess('User updated.');
      } else {
        if (!formData.password) { setError('Password is required for new users'); setSaving(false); return; }
        await api.post('/api/users', payload);
        setSuccess('User created.');
      }
      setShowForm(false); setEditing(null);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save user');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (user: User) => {
    if (!window.confirm(`Delete user "${user.name}"? This cannot be undone.`)) return;
    try {
      await api.delete(`/api/users/${user.id}`);
      setSuccess('User deleted.');
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete user');
    }
  };

  if (status === 'loading' || !ADMIN_ROLES.includes(role)) return null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <section className="rounded-2xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#202C33] p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-amber-300/50 bg-amber-50 dark:bg-amber-400/10 px-3 py-1.5 text-xs font-medium text-amber-600 dark:text-amber-400">
              <ShieldCheck className="h-3.5 w-3.5" />
              Admin Control
            </div>
            <h1 className="mt-3 text-3xl font-semibold text-gray-900 dark:text-white">User Management</h1>
            <p className="mt-1.5 text-sm text-gray-500 dark:text-[#8696A0]">
              Create, edit, and manage all user accounts and their roles.
            </p>
          </div>
          <button
            onClick={() => { setEditing(null); setShowForm(true); }}
            className="inline-flex items-center gap-2 rounded-xl bg-[#25D366] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#25D366]/90 transition-colors"
          >
            <Plus className="h-4 w-4" />
            New User
          </button>
        </div>
      </section>

      {error   && <div className="rounded-xl border border-red-200 dark:border-red-500/30 bg-red-50 dark:bg-red-500/10 px-4 py-3 text-sm text-red-700 dark:text-red-300">{error}</div>}
      {success && <div className="rounded-xl border border-green-200 dark:border-emerald-500/30 bg-green-50 dark:bg-emerald-500/10 px-4 py-3 text-sm text-green-700 dark:text-emerald-300">{success}</div>}

      {/* Users table */}
      <div className="rounded-2xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#111B21] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-[#202C33]">
                {['Name', 'Email', 'Role', 'Team', 'Joined', 'Actions'].map((h) => (
                  <th key={h} className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-600 dark:text-[#8696A0]">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-white/5">
              {users.map((u) => (
                <tr key={u.id} className="hover:bg-gray-50 dark:hover:bg-white/3 transition-colors">
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#25D366] to-[#128C7E] text-xs font-bold text-white">
                        {u.name.charAt(0).toUpperCase()}
                      </div>
                      <span className="text-sm font-medium text-gray-900 dark:text-white">{u.name}</span>
                    </div>
                  </td>
                  <td className="px-5 py-3.5 text-sm text-gray-600 dark:text-[#8696A0]">{u.email}</td>
                  <td className="px-5 py-3.5">
                    <span className={cn('rounded-full px-2.5 py-1 text-xs font-semibold', ROLE_BADGE[u.role])}>
                      {u.role.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-sm text-gray-600 dark:text-[#8696A0]">{u.team?.name ?? '—'}</td>
                  <td className="px-5 py-3.5 text-sm text-gray-600 dark:text-[#8696A0]">
                    {new Date(u.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => { setEditing(u); setShowForm(true); }}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-[#202C33] px-3 py-1.5 text-xs font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/10 transition-colors"
                      >
                        <Pencil className="h-3 w-3" /> Edit
                      </button>
                      <button
                        onClick={() => handleDelete(u)}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 dark:border-red-500/20 bg-red-50 dark:bg-red-500/10 px-3 py-1.5 text-xs font-medium text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-500/20 transition-colors"
                      >
                        <Trash2 className="h-3 w-3" /> Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {users.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-5 py-10 text-center text-sm text-gray-500 dark:text-[#8696A0]">
                    No users yet. Create one to get started.
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
            className="w-full max-w-md rounded-2xl border border-white/10 bg-[#111B21] p-6 shadow-[0_30px_90px_rgba(0,0,0,0.4)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 mb-5">
              <UserCog className="h-5 w-5 text-amber-400" />
              <h2 className="text-lg font-semibold text-white">{editing ? 'Edit User' : 'Create User'}</h2>
            </div>

            <div className="space-y-4">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-[#8696A0]">Full Name *</label>
                <input
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full rounded-lg border border-white/10 bg-[#202C33] px-3 py-2.5 text-sm text-white outline-none focus:border-[#25D366]"
                  placeholder="Ahmed Mohamed"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-[#8696A0]">Email *</label>
                <input
                  required
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full rounded-lg border border-white/10 bg-[#202C33] px-3 py-2.5 text-sm text-white outline-none focus:border-[#25D366]"
                  placeholder="ahmed@company.com"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-[#8696A0]">
                  Password {editing ? '(leave blank to keep current)' : '*'}
                </label>
                <input
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="w-full rounded-lg border border-white/10 bg-[#202C33] px-3 py-2.5 text-sm text-white outline-none focus:border-[#25D366]"
                  placeholder="••••••••"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-[#8696A0]">Role *</label>
                  <select
                    value={formData.role}
                    onChange={(e) => setFormData({ ...formData, role: e.target.value as Role })}
                    className="h-10 w-full rounded-lg border border-white/10 bg-[#202C33] px-3 text-sm text-white outline-none focus:border-[#25D366]"
                  >
                    {ROLES.map((r) => <option key={r} value={r}>{r.replace('_', ' ')}</option>)}
                  </select>
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-[#8696A0]">Team</label>
                  <select
                    value={formData.teamId}
                    onChange={(e) => setFormData({ ...formData, teamId: e.target.value })}
                    className="h-10 w-full rounded-lg border border-white/10 bg-[#202C33] px-3 text-sm text-white outline-none focus:border-[#25D366]"
                  >
                    <option value="">No team</option>
                    {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                </div>
              </div>
            </div>

            {error && <p className="mt-3 text-xs text-red-400">{error}</p>}

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => { setShowForm(false); setEditing(null); }}
                className="rounded-xl border border-white/10 bg-[#202C33] px-4 py-2 text-sm text-white hover:bg-white/10"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="rounded-xl bg-[#25D366] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50 hover:bg-[#25D366]/90"
              >
                {saving ? 'Saving…' : editing ? 'Update User' : 'Create User'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
