'use client';

import { useEffect, useState, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { UsersRound, Plus, Pencil, Trash2, ShieldCheck, UserMinus, UserPlus } from 'lucide-react';
import { api } from '../../../../lib/api';

type Member = { id: string; name: string; email: string; role: string };
type Team   = { id: string; name: string; autoAssign: boolean; owner: { id: string; name: string }; members: Member[] };
type User   = { id: string; name: string; email: string; role: string; teamId: string | null };

const ADMIN_ROLES = ['SUPER_ADMIN', 'ADMIN'];

export default function AdminTeamsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const role = (session?.user as any)?.role;

  const [teams, setTeams]           = useState<Team[]>([]);
  const [allUsers, setAllUsers]     = useState<User[]>([]);
  const [showForm, setShowForm]     = useState(false);
  const [editing, setEditing]       = useState<Team | null>(null);
  const [teamName, setTeamName]     = useState('');
  const [saving, setSaving]         = useState(false);
  const [error, setError]           = useState('');
  const [success, setSuccess]       = useState('');
  const [expandedTeam, setExpanded] = useState<string | null>(null);
  const [addUserId, setAddUserId]   = useState('');

  useEffect(() => {
    if (status === 'loading') return;
    if (!ADMIN_ROLES.includes(role)) router.replace('/dashboard');
  }, [role, status, router]);

  const loadData = useCallback(async () => {
    const [teamsData, usersData] = await Promise.all([
      api.get('/api/teams/all'),
      api.get('/api/users'),
    ]);
    setTeams(Array.isArray(teamsData) ? teamsData : []);
    setAllUsers(Array.isArray(usersData) ? usersData : []);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  useEffect(() => {
    setTeamName(editing ? editing.name : '');
  }, [editing, showForm]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!teamName.trim()) { setError('Team name is required'); return; }
    setError(''); setSaving(true);
    try {
      if (editing) {
        await api.put(`/api/teams/${editing.id}`, { name: teamName });
        setSuccess('Team updated.');
      } else {
        await api.post('/api/teams', { name: teamName });
        setSuccess('Team created.');
      }
      setShowForm(false); setEditing(null);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save team');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (team: Team) => {
    if (!window.confirm(`Delete team "${team.name}"? Members will be unassigned.`)) return;
    try {
      await api.delete(`/api/teams/${team.id}`);
      setSuccess('Team deleted.');
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete team');
    }
  };

  const handleAddMember = async (teamId: string) => {
    if (!addUserId) return;
    try {
      await api.post(`/api/teams/${teamId}/members`, { userId: addUserId });
      setAddUserId(''); setSuccess('Member added.');
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add member');
    }
  };

  const handleToggleAutoAssign = async (team: Team) => {
    try {
      await api.put(`/api/teams/${team.id}/auto-assign`, { autoAssign: !team.autoAssign });
      setSuccess(`Auto-assign ${!team.autoAssign ? 'enabled' : 'disabled'} for ${team.name}`);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update setting');
    }
  };

  const handleRemoveMember = async (teamId: string, userId: string) => {
    try {
      await api.delete(`/api/teams/${teamId}/members/${userId}`);
      setSuccess('Member removed.');
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove member');
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
            <h1 className="mt-3 text-3xl font-semibold text-gray-900 dark:text-white">Team Management</h1>
            <p className="mt-1.5 text-sm text-gray-500 dark:text-[#8696A0]">
              Create teams, assign members, and organize your workforce.
            </p>
          </div>
          <button
            onClick={() => { setEditing(null); setShowForm(true); }}
            className="inline-flex items-center gap-2 rounded-xl bg-[#25D366] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#25D366]/90 transition-colors"
          >
            <Plus className="h-4 w-4" />
            New Team
          </button>
        </div>
      </section>

      {error   && <div className="rounded-xl border border-red-200 dark:border-red-500/30 bg-red-50 dark:bg-red-500/10 px-4 py-3 text-sm text-red-700 dark:text-red-300">{error}</div>}
      {success && <div className="rounded-xl border border-green-200 dark:border-emerald-500/30 bg-green-50 dark:bg-emerald-500/10 px-4 py-3 text-sm text-green-700 dark:text-emerald-300">{success}</div>}

      {/* Teams list */}
      <div className="space-y-4">
        {teams.length === 0 && (
          <div className="rounded-2xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#111B21] p-10 text-center text-sm text-gray-500 dark:text-[#8696A0]">
            No teams yet. Create one to get started.
          </div>
        )}
        {teams.map((team) => {
          const isExpanded  = expandedTeam === team.id;
          const memberIds   = new Set(team.members.map((m) => m.id));
          const available   = allUsers.filter((u) => !memberIds.has(u.id));

          return (
            <div key={team.id} className="rounded-2xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#111B21] overflow-hidden">
              {/* Team header row */}
              <div className="flex items-center justify-between px-5 py-4">
                <button
                  type="button"
                  className="flex items-center gap-3 text-left"
                  onClick={() => setExpanded(isExpanded ? null : team.id)}
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#25D366] to-[#128C7E]">
                    <UsersRound className="h-4 w-4 text-white" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-900 dark:text-white">{team.name}</p>
                    <p className="text-xs text-gray-500 dark:text-[#8696A0]">{team.members.length} member{team.members.length !== 1 ? 's' : ''}</p>
                  </div>
                </button>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleToggleAutoAssign(team)}
                    title={team.autoAssign ? 'Disable auto-assign' : 'Enable auto-assign'}
                    className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                      team.autoAssign
                        ? 'border-[#25D366]/40 bg-[#25D366]/10 text-[#25D366]'
                        : 'border-gray-200 dark:border-white/10 bg-white dark:bg-[#202C33] text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-white/5'
                    }`}
                  >
                    Auto-assign {team.autoAssign ? 'ON' : 'OFF'}
                  </button>
                  <button
                    onClick={() => { setEditing(team); setShowForm(true); }}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-[#202C33] px-3 py-1.5 text-xs font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/10 transition-colors"
                  >
                    <Pencil className="h-3 w-3" /> Rename
                  </button>
                  <button
                    onClick={() => handleDelete(team)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 dark:border-red-500/20 bg-red-50 dark:bg-red-500/10 px-3 py-1.5 text-xs font-medium text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-500/20 transition-colors"
                  >
                    <Trash2 className="h-3 w-3" /> Delete
                  </button>
                </div>
              </div>

              {/* Expanded: members */}
              {isExpanded && (
                <div className="border-t border-gray-100 dark:border-white/5 px-5 py-4 space-y-3">
                  {/* Member list */}
                  {team.members.length > 0 ? (
                    <ul className="space-y-2">
                      {team.members.map((m) => (
                        <li key={m.id} className="flex items-center justify-between rounded-lg bg-gray-50 dark:bg-[#202C33] px-3 py-2">
                          <div className="flex items-center gap-2">
                            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#25D366] to-[#128C7E] text-xs font-bold text-white">
                              {m.name.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <p className="text-sm font-medium text-gray-900 dark:text-white">{m.name}</p>
                              <p className="text-xs text-gray-500 dark:text-[#8696A0]">{m.role.replace('_', ' ')}</p>
                            </div>
                          </div>
                          <button
                            onClick={() => handleRemoveMember(team.id, m.id)}
                            className="inline-flex items-center gap-1 rounded-lg border border-red-200 dark:border-red-500/20 bg-red-50 dark:bg-red-500/10 px-2.5 py-1 text-xs text-red-600 dark:text-red-400 hover:bg-red-100 transition-colors"
                          >
                            <UserMinus className="h-3 w-3" /> Remove
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-xs text-gray-400 dark:text-[#8696A0]">No members yet.</p>
                  )}

                  {/* Add member */}
                  {available.length > 0 && (
                    <div className="flex items-center gap-2 pt-1">
                      <select
                        value={addUserId}
                        onChange={(e) => setAddUserId(e.target.value)}
                        className="flex-1 h-9 rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-[#202C33] px-3 text-xs text-gray-900 dark:text-white outline-none focus:border-[#25D366]"
                      >
                        <option value="">Select user to add…</option>
                        {available.map((u) => (
                          <option key={u.id} value={u.id}>{u.name} ({u.email})</option>
                        ))}
                      </select>
                      <button
                        onClick={() => handleAddMember(team.id)}
                        disabled={!addUserId}
                        className="inline-flex items-center gap-1 rounded-lg bg-[#25D366] px-3 py-2 text-xs font-semibold text-white disabled:opacity-40 hover:bg-[#25D366]/90 transition-colors"
                      >
                        <UserPlus className="h-3 w-3" /> Add
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Create / Edit modal */}
      {showForm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onClick={() => { setShowForm(false); setEditing(null); }}
        >
          <form
            onSubmit={handleSubmit}
            className="w-full max-w-sm rounded-2xl border border-white/10 bg-[#111B21] p-6 shadow-[0_30px_90px_rgba(0,0,0,0.4)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 mb-5">
              <UsersRound className="h-5 w-5 text-amber-400" />
              <h2 className="text-lg font-semibold text-white">{editing ? 'Rename Team' : 'Create Team'}</h2>
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-[#8696A0]">Team Name *</label>
              <input
                required
                value={teamName}
                onChange={(e) => setTeamName(e.target.value)}
                className="w-full rounded-lg border border-white/10 bg-[#202C33] px-3 py-2.5 text-sm text-white outline-none focus:border-[#25D366]"
                placeholder="Sales Team"
              />
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
                {saving ? 'Saving…' : editing ? 'Rename' : 'Create Team'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
