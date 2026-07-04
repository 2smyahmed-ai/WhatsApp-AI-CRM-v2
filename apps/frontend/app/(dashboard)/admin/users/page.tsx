'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import {
  UserCog, Plus, Pencil, Trash2, ShieldCheck, Search,
  SlidersHorizontal, ArrowUpDown, ArrowUp, ArrowDown, X,
} from 'lucide-react';
import { api } from '../../../../lib/api';
import { TablePagination } from '../../../../components/ui/TablePagination';
import { Modal } from '../../../../components/ui/modal';
import { cn } from '../../../../lib/utils';
import { useToast } from '../../../../hooks/useToast';
import {
  type SimpleRole,
  SIMPLE_ROLES,
  SIMPLE_ROLE_LABEL,
  SIMPLE_ROLE_BADGE,
  toSimpleRole,
  simpleRoleToStored,
  isManager,
} from '../../../../lib/roles';

type UserSortKey = 'name' | 'email' | 'role' | 'createdAt';

type User = {
  id: string;
  name: string;
  email: string;
  role: string;
  teamId: string | null;
  createdAt: string;
  team?: { id: string; name: string } | null;
};

type Team = { id: string; name: string };

const ROLE_ORDER: Record<SimpleRole, number> = {
  SYSTEM_MANAGER: 2,
  EMPLOYEE: 1,
};

const emptyForm = { name: '', email: '', password: '', role: 'EMPLOYEE' as SimpleRole, teamId: '' };

function SortIcon({ active, dir }: { active: boolean; dir: 'asc' | 'desc' }) {
  if (!active) return <ArrowUpDown className="h-3 w-3 opacity-40" />;
  return dir === 'asc'
    ? <ArrowUp className="h-3 w-3 text-[#25D366]" />
    : <ArrowDown className="h-3 w-3 text-[#25D366]" />;
}

export default function AdminUsersPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const { success, error: toastError } = useToast();
  const { t } = useTranslation('admin');
  const role = (session?.user as any)?.role;

  // ─── data ─────────────────────────────────────────────────────────────────
  const [users, setUsers]   = useState<User[]>([]);
  const [teams, setTeams]   = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);

  // ─── form ─────────────────────────────────────────────────────────────────
  const [showForm, setShowForm]   = useState(false);
  const [editing, setEditing]     = useState<User | null>(null);
  const [formData, setFormData]   = useState(emptyForm);
  const [saving, setSaving]       = useState(false);
  const [formError, setFormError] = useState('');

  // ─── search ───────────────────────────────────────────────────────────────
  const [search, setSearch] = useState('');

  // ─── advanced filters ─────────────────────────────────────────────────────
  const [showFilters, setShowFilters] = useState(false);
  const [filterRole, setFilterRole]   = useState('');
  const [filterTeam, setFilterTeam]   = useState('');

  // ─── sort ─────────────────────────────────────────────────────────────────
  const [sortKey, setSortKey] = useState<UserSortKey>('name');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  // ─── pagination ───────────────────────────────────────────────────────────
  const [page, setPage]         = useState(1);
  const [pageSize, setPageSize] = useState(25);

  // ─── selection ────────────────────────────────────────────────────────────
  const [selectedIds, setSelectedIds]         = useState<Set<string>>(new Set());
  const [showBulkConfirm, setShowBulkConfirm] = useState(false);
  const [bulkDeleting, setBulkDeleting]       = useState(false);

  // ─── row confirm delete ───────────────────────────────────────────────────
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // ─── Guard ────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (status === 'loading') return;
    if (!isManager(role)) router.replace('/dashboard');
  }, [role, status, router]);

  // ─── Load ─────────────────────────────────────────────────────────────────

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [usersData, teamsData] = await Promise.all([
        api.get('/api/users'),
        api.get('/api/teams/all'),
      ]);
      setUsers(Array.isArray(usersData) ? usersData : []);
      setTeams(Array.isArray(teamsData) ? teamsData : []);
    } catch (err) {
      toastError(err instanceof Error ? err.message : 'Failed to load users');
    } finally {
      setLoading(false);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { loadData(); }, [loadData]);

  useEffect(() => {
    if (editing) {
      setFormData({ name: editing.name, email: editing.email, password: '', role: toSimpleRole(editing.role), teamId: editing.teamId || '' });
    } else {
      setFormData(emptyForm);
    }
  }, [editing, showForm]);

  // ─── Derived data ─────────────────────────────────────────────────────────

  const processedUsers = useMemo(() => {
    let data = [...users];
    if (search) {
      const q = search.toLowerCase();
      data = data.filter(
        (u) => u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q),
      );
    }
    if (filterRole) data = data.filter((u) => toSimpleRole(u.role) === filterRole);
    if (filterTeam) data = data.filter((u) => u.teamId === filterTeam);

    data.sort((a, b) => {
      let cmp = 0;
      if (sortKey === 'role') {
        cmp = ROLE_ORDER[toSimpleRole(a.role)] - ROLE_ORDER[toSimpleRole(b.role)];
      } else if (sortKey === 'createdAt') {
        cmp = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      } else {
        cmp = String(a[sortKey] ?? '').localeCompare(String(b[sortKey] ?? ''));
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });

    return data;
  }, [users, search, filterRole, filterTeam, sortKey, sortDir]);

  const totalCount = processedUsers.length;

  const paginatedUsers = useMemo(() => {
    const start = (page - 1) * pageSize;
    return processedUsers.slice(start, start + pageSize);
  }, [processedUsers, page, pageSize]);

  // ─── Sort ─────────────────────────────────────────────────────────────────

  const handleSort = (key: UserSortKey) => {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortKey(key); setSortDir('asc'); }
    setPage(1);
  };

  const SortTh = ({ k, label }: { k: UserSortKey; label: string }) => (
    <th
      scope="col"
      aria-label={label}
      onClick={() => handleSort(k)}
      className={cn(
        'cursor-pointer select-none px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wider transition-colors',
        sortKey === k
          ? 'text-[#25D366]'
          : 'text-gray-600 dark:text-[#8696A0] hover:text-gray-900 dark:hover:text-white',
      )}
    >
      <span className="flex items-center gap-1.5">
        {label}
        <SortIcon active={sortKey === k} dir={sortDir} />
      </span>
    </th>
  );

  // ─── Selection ────────────────────────────────────────────────────────────

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    const pageIds = paginatedUsers.map((u) => u.id);
    const allSel = pageIds.every((id) => selectedIds.has(id));
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allSel) pageIds.forEach((id) => next.delete(id));
      else pageIds.forEach((id) => next.add(id));
      return next;
    });
  };

  const allPageSelected =
    paginatedUsers.length > 0 && paginatedUsers.every((u) => selectedIds.has(u.id));
  const somePageSelected =
    !allPageSelected && paginatedUsers.some((u) => selectedIds.has(u.id));

  // ─── CRUD ─────────────────────────────────────────────────────────────────

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    setSaving(true);
    try {
      const payload: any = {
        name: formData.name,
        email: formData.email,
        role: simpleRoleToStored(formData.role),
        teamId: formData.teamId || null,
      };
      if (!editing || formData.password) payload.password = formData.password;

      if (editing) {
        await api.put(`/api/users/${editing.id}`, payload);
        success('User updated.');
      } else {
        if (!formData.password) {
          setFormError('Password is required for new users');
          setSaving(false);
          return;
        }
        await api.post('/api/users', payload);
        success('User created.');
      }
      setShowForm(false);
      setEditing(null);
      await loadData();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to save user');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    const snapshot = users;
    setUsers((prev) => prev.filter((u) => u.id !== id));
    setConfirmDeleteId(null);
    setSelectedIds((prev) => { const n = new Set(prev); n.delete(id); return n; });
    try {
      await api.delete(`/api/users/${id}`);
      success('User deleted.');
    } catch (err) {
      setUsers(snapshot);
      toastError(err instanceof Error ? err.message : 'Failed to delete user');
    }
  };

  const handleBulkDelete = async () => {
    setBulkDeleting(true);
    const ids = Array.from(selectedIds);
    const snapshot = users;
    setUsers((prev) => prev.filter((u) => !selectedIds.has(u.id)));
    try {
      await Promise.allSettled(ids.map((id) => api.delete(`/api/users/${id}`)));
      success(`${ids.length} user${ids.length !== 1 ? 's' : ''} deleted.`);
    } catch {
      setUsers(snapshot);
      toastError('Some users could not be deleted.');
    } finally {
      setSelectedIds(new Set());
      setShowBulkConfirm(false);
      setBulkDeleting(false);
    }
  };

  // ─── Derived helpers ──────────────────────────────────────────────────────

  const advancedFilterCount = (filterRole ? 1 : 0) + (filterTeam ? 1 : 0);

  const clearAdvancedFilters = () => {
    setFilterRole('');
    setFilterTeam('');
    setPage(1);
  };

  if (status === 'loading' || !isManager(role)) return null;

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">

      {/* ── Header ── */}
      <section className="rounded-2xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#202C33] p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-amber-300/50 bg-amber-50 dark:bg-amber-400/10 px-3 py-1.5 text-xs font-medium text-amber-600 dark:text-amber-400">
              <ShieldCheck className="h-3.5 w-3.5" />
              {t('badge')}
            </div>
            <h1 className="mt-3 text-3xl font-semibold text-gray-900 dark:text-white">{t('users.title')}</h1>
            <p className="mt-1.5 text-sm text-gray-500 dark:text-[#8696A0]">
              {t('users.subtitle')}
            </p>
          </div>
          <button
            type="button"
            onClick={() => { setEditing(null); setShowForm(true); }}
            className="inline-flex items-center gap-2 rounded-xl bg-[#25D366] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#25D366]/90 transition-colors self-start lg:self-auto"
          >
            <Plus className="h-4 w-4" />
            {t('users.newUser')}
          </button>
        </div>
      </section>

      {/* ── Table ── */}
      <div className="rounded-2xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#111B21] overflow-hidden">

        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-3 border-b border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-[#202C33] px-5 py-3.5">
          {/* Search */}
          <div className="relative flex-1 min-w-[180px]">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400 dark:text-[#8696A0]" />
            <input
              type="text"
              placeholder={t('users.searchPlaceholder')}
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="w-full rounded-xl border border-gray-300 dark:border-white/10 bg-white dark:bg-[#111B21] py-2 pl-10 pr-4 text-sm text-gray-900 dark:text-white placeholder:text-gray-500 dark:placeholder:text-[#8696A0] outline-none focus:border-[#25D366]/50"
            />
          </div>

          {/* Filter toggle */}
          <button
            type="button"
            onClick={() => setShowFilters((f) => !f)}
            className={cn(
              'inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm transition-colors',
              showFilters || advancedFilterCount > 0
                ? 'border-[#25D366]/40 bg-[#25D366]/10 text-[#25D366]'
                : 'border-gray-300 dark:border-white/10 bg-white dark:bg-white/5 text-gray-600 dark:text-[#8696A0] hover:bg-gray-50 dark:hover:bg-white/10',
            )}
          >
            <SlidersHorizontal className="h-4 w-4" />
            {t('common:actions.filter')}
            {advancedFilterCount > 0 && (
              <span className="flex h-4 min-w-[16px] items-center justify-center rounded-full bg-[#25D366] px-1 text-[10px] font-bold text-slate-950">
                {advancedFilterCount}
              </span>
            )}
          </button>

          {/* Results + selection count */}
          <div className="ml-auto flex items-center gap-3">
            <span className="text-xs text-gray-500 dark:text-[#8696A0]">
              {totalCount} {totalCount === 1 ? 'user' : 'users'}
              {selectedIds.size > 0 && (
                <span className="ml-2 font-medium text-[#25D366]">· {selectedIds.size} selected</span>
              )}
            </span>
            {selectedIds.size > 0 && (
              <button
                type="button"
                onClick={() => setSelectedIds(new Set())}
                className="text-xs text-gray-500 dark:text-[#8696A0] hover:text-gray-700 dark:hover:text-white transition-colors"
              >
                {t('users.bulk.clearSelection')}
              </button>
            )}
          </div>
        </div>

        {/* Advanced filter panel */}
        {showFilters && (
          <div className="border-b border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-[#0B141A] px-5 py-4">
            <div className="flex flex-wrap items-end gap-4">
              <div>
                <p className="mb-1.5 text-xs font-medium text-gray-500 dark:text-[#8696A0]">{t('users.filters.role')}</p>
                <select
                  value={filterRole}
                  onChange={(e) => { setFilterRole(e.target.value); setPage(1); }}
                  className="h-9 rounded-xl border border-gray-300 dark:border-white/10 bg-white dark:bg-[#202C33] px-3 text-sm text-gray-900 dark:text-white outline-none focus:border-[#25D366]/50"
                >
                  <option value="">{t('users.filters.allRoles')}</option>
                  {SIMPLE_ROLES.map((r) => (
                    <option key={r} value={r}>{SIMPLE_ROLE_LABEL[r]}</option>
                  ))}
                </select>
              </div>
              <div>
                <p className="mb-1.5 text-xs font-medium text-gray-500 dark:text-[#8696A0]">{t('users.filters.team')}</p>
                <select
                  value={filterTeam}
                  onChange={(e) => { setFilterTeam(e.target.value); setPage(1); }}
                  className="h-9 rounded-xl border border-gray-300 dark:border-white/10 bg-white dark:bg-[#202C33] px-3 text-sm text-gray-900 dark:text-white outline-none focus:border-[#25D366]/50"
                >
                  <option value="">{t('users.filters.allTeams')}</option>
                  {teams.map((team) => (
                    <option key={team.id} value={team.id}>{team.name}</option>
                  ))}
                </select>
              </div>
              {advancedFilterCount > 0 && (
                <button
                  type="button"
                  onClick={clearAdvancedFilters}
                  className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-gray-300 dark:border-white/10 px-3 text-sm text-gray-600 dark:text-[#8696A0] hover:bg-gray-100 dark:hover:bg-white/5 transition-colors"
                >
                  <X className="h-3.5 w-3.5" /> {t('users.filters.clear')}
                </button>
              )}
            </div>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-[#202C33]">
                <th scope="col" className="w-10 px-5 py-3.5">
                  <span className="sr-only">Select</span>
                  <input
                    type="checkbox"
                    checked={allPageSelected}
                    ref={(el) => { if (el) el.indeterminate = somePageSelected; }}
                    onChange={toggleAll}
                    className="h-4 w-4 cursor-pointer rounded border-gray-300 dark:border-white/20 accent-[#25D366]"
                  />
                </th>
                <SortTh k="name"      label={t('users.table.name')} />
                <SortTh k="email"     label={t('users.table.email')} />
                <SortTh k="role"      label={t('users.table.role')} />
                <th scope="col" className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-600 dark:text-[#8696A0]">
                  {t('users.table.team')}
                </th>
                <SortTh k="createdAt" label={t('users.table.createdAt')} />
                <th scope="col" className="px-5 py-3.5"><span className="sr-only">{t('users.table.actions')}</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-white/5">
              {loading ? (
                [...Array(5)].map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td className="px-5 py-4"><div className="h-4 w-4 rounded bg-gray-200 dark:bg-white/8" /></td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-full bg-gray-200 dark:bg-white/8" />
                        <div className="h-4 w-28 rounded bg-gray-200 dark:bg-white/8" />
                      </div>
                    </td>
                    <td className="px-5 py-4"><div className="h-3 w-36 rounded bg-gray-200 dark:bg-white/5" /></td>
                    <td className="px-5 py-4"><div className="h-5 w-20 rounded-full bg-gray-200 dark:bg-white/8" /></td>
                    <td className="px-5 py-4"><div className="h-3 w-20 rounded bg-gray-200 dark:bg-white/5" /></td>
                    <td className="px-5 py-4"><div className="h-3 w-20 rounded bg-gray-200 dark:bg-white/5" /></td>
                    <td className="px-5 py-4"><div className="h-7 w-24 rounded bg-gray-200 dark:bg-white/5" /></td>
                  </tr>
                ))
              ) : paginatedUsers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-16 text-center">
                    <UserCog className="mx-auto mb-3 h-8 w-8 text-gray-300 dark:text-[#8696A0]/30" />
                    <p className="text-sm text-gray-500 dark:text-[#8696A0]">
                      {search || advancedFilterCount > 0
                        ? t('users.noUsersFiltered')
                        : t('users.noUsers')}
                    </p>
                    {(search || advancedFilterCount > 0) && (
                      <button
                        type="button"
                        onClick={() => { setSearch(''); clearAdvancedFilters(); }}
                        className="mt-2 text-xs text-[#25D366] hover:underline"
                      >
                        {t('users.clearAllFilters')}
                      </button>
                    )}
                  </td>
                </tr>
              ) : (
                paginatedUsers.map((u) => (
                  <tr
                    key={u.id}
                    className={cn(
                      'group transition-colors hover:bg-gray-50 dark:hover:bg-white/3',
                      selectedIds.has(u.id) && 'bg-[#25D366]/5 dark:bg-[#25D366]/8',
                    )}
                  >
                    <td className="w-10 px-5 py-3.5">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(u.id)}
                        onChange={() => toggleSelect(u.id)}
                        className="h-4 w-4 cursor-pointer rounded border-gray-300 dark:border-white/20 accent-[#25D366]"
                      />
                    </td>
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
                      <span className={cn('rounded-full px-2.5 py-1 text-xs font-semibold', SIMPLE_ROLE_BADGE[toSimpleRole(u.role)])}>
                        {SIMPLE_ROLE_LABEL[toSimpleRole(u.role)]}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-sm text-gray-600 dark:text-[#8696A0]">
                      {u.team?.name ?? '—'}
                    </td>
                    <td className="px-5 py-3.5 text-sm text-gray-600 dark:text-[#8696A0]">
                      {new Date(u.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-5 py-3.5">
                      {confirmDeleteId === u.id ? (
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-red-400 dark:text-red-300">{t('users.deleteConfirm.inline')}</span>
                          <button
                            type="button"
                            onClick={() => handleDelete(u.id)}
                            className="rounded-lg bg-red-500 px-2.5 py-1 text-xs font-semibold text-white hover:bg-red-600 transition-colors"
                          >
                            {t('users.deleteConfirm.yes')}
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(null)}
                            className="rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 px-2.5 py-1 text-xs text-gray-700 dark:text-white hover:bg-gray-50 dark:hover:bg-white/10 transition-colors"
                          >
                            {t('users.deleteConfirm.no')}
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            type="button"
                            onClick={() => { setEditing(u); setShowForm(true); }}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-[#202C33] px-3 py-1.5 text-xs font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/10 transition-colors"
                          >
                            <Pencil className="h-3 w-3" /> {t('common:actions.edit')}
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(u.id)}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 dark:border-red-500/20 bg-red-50 dark:bg-red-500/10 px-3 py-1.5 text-xs font-medium text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-500/20 transition-colors"
                          >
                            <Trash2 className="h-3 w-3" /> {t('common:actions.delete')}
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <TablePagination
          page={page}
          pageSize={pageSize}
          total={totalCount}
          onPageChange={setPage}
          onPageSizeChange={(s) => { setPageSize(s); setPage(1); }}
        />
      </div>

      {/* ── Bulk action bar ── */}
      {selectedIds.size > 0 && (
        <div className="fixed bottom-[var(--bottom-nav-space)] sm:bottom-6 left-1/2 z-40 -translate-x-1/2 flex flex-wrap items-center gap-3 rounded-2xl border border-white/10 bg-[#202C33] px-5 py-3 shadow-[0_8px_30px_rgba(0,0,0,0.5)]">
          <span className="text-sm font-medium text-white">
            {selectedIds.size} {selectedIds.size === 1 ? 'user' : 'users'} selected
          </span>
          <div className="h-5 w-px bg-white/15" />
          {showBulkConfirm ? (
            <>
              <span className="text-xs text-red-300">{t('users.bulk.deleteConfirm', { count: selectedIds.size })}</span>
              <button
                type="button"
                onClick={handleBulkDelete}
                disabled={bulkDeleting}
                className="rounded-lg bg-red-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-600 disabled:opacity-50 transition-colors"
              >
                {bulkDeleting ? t('users.bulk.deleting') : t('users.bulk.yesDelete')}
              </button>
              <button
                type="button"
                onClick={() => setShowBulkConfirm(false)}
                className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-[#8696A0] hover:bg-white/10 transition-colors"
              >
                {t('users.bulk.cancel')}
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => setShowBulkConfirm(true)}
                className="inline-flex items-center gap-1.5 rounded-lg bg-red-500/90 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-600 transition-colors"
              >
                <Trash2 className="h-3.5 w-3.5" /> {t('users.bulk.delete')}
              </button>
              <button
                type="button"
                onClick={() => setSelectedIds(new Set())}
                className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-[#8696A0] hover:bg-white/10 transition-colors"
              >
                {t('users.bulk.clearSelection')}
              </button>
            </>
          )}
        </div>
      )}

      {/* ── Create / Edit modal ── */}
      <Modal
        open={showForm}
        onClose={() => { setShowForm(false); setEditing(null); }}
        aria-label={editing ? t('users.form.editTitle') : t('users.form.createTitle')}
        overlayClassName="bg-black/70"
        className="w-full max-w-md rounded-2xl border border-white/10 bg-[#111B21] p-6 shadow-[0_30px_90px_rgba(0,0,0,0.4)]"
      >
          <form onSubmit={handleSubmit}>
            <div className="mb-5 flex items-center gap-3">
              <UserCog className="h-5 w-5 text-amber-400" />
              <h2 className="text-lg font-semibold text-white">
                {editing ? t('users.form.editTitle') : t('users.form.createTitle')}
              </h2>
            </div>

            <div className="space-y-4">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-[#8696A0]">{t('users.form.name')}</label>
                <input
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full rounded-lg border border-white/10 bg-[#202C33] px-3 py-2.5 text-sm text-white outline-none focus:border-[#25D366]"
                  placeholder="Ahmed Mohamed"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-[#8696A0]">{t('users.form.email')}</label>
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
                  {editing ? t('users.form.passwordEdit') : t('users.form.passwordCreate')}
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
                  <label className="mb-1.5 block text-xs font-medium text-[#8696A0]">{t('users.form.role')}</label>
                  <select
                    value={formData.role}
                    onChange={(e) => setFormData({ ...formData, role: e.target.value as SimpleRole })}
                    className="h-10 w-full rounded-lg border border-white/10 bg-[#202C33] px-3 text-sm text-white outline-none focus:border-[#25D366]"
                  >
                    {SIMPLE_ROLES.map((r) => <option key={r} value={r}>{SIMPLE_ROLE_LABEL[r]}</option>)}
                  </select>
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-[#8696A0]">{t('users.form.team')}</label>
                  <select
                    value={formData.teamId}
                    onChange={(e) => setFormData({ ...formData, teamId: e.target.value })}
                    className="h-10 w-full rounded-lg border border-white/10 bg-[#202C33] px-3 text-sm text-white outline-none focus:border-[#25D366]"
                  >
                    <option value="">{t('users.form.noTeam')}</option>
                    {teams.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}
                  </select>
                </div>
              </div>
            </div>

            {formError && <p className="mt-3 text-xs text-red-400">{formError}</p>}

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => { setShowForm(false); setEditing(null); }}
                className="rounded-xl border border-white/10 bg-[#202C33] px-4 py-2 text-sm text-white hover:bg-white/10 transition-colors"
              >
                {t('users.form.cancel')}
              </button>
              <button
                type="submit"
                disabled={saving}
                className="rounded-xl bg-[#25D366] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50 hover:bg-[#25D366]/90 transition-colors"
              >
                {saving ? t('users.form.saving') : editing ? t('users.form.updateUser') : t('users.form.createUser')}
              </button>
            </div>
          </form>
      </Modal>
      {/* Mobile bottom-nav spacer */}
      <div aria-hidden="true" className="h-[var(--bottom-nav-space)] sm:hidden" />
    </div>
  );
}
