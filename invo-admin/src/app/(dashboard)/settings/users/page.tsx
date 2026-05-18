'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Header from '@/components/header';
import { useAuth } from '@/contexts/AuthContext';
import { apiGet, apiPost, apiPut, apiDelete } from '@/lib/api-client';

type UserRole = 'admin' | 'editor' | 'viewer';

interface TeamUser {
  _id: string;
  email: string;
  name: string;
  role: UserRole;
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string;
}

const ROLE_STYLE: Record<UserRole, string> = {
  admin: 'bg-red-500/10 text-red-500 border-red-500/20',
  editor: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
  viewer: 'bg-slate-500/10 text-slate-400 border-slate-500/20'
};

const ROLE_DESC: Record<UserRole, string> = {
  admin: 'Full access including user management',
  editor: 'Create/edit/delete endpoints, hosts, rules',
  viewer: 'Read-only access'
};

export default function UsersPage() {
  const router = useRouter();
  const { isAdmin, user: currentUser } = useAuth();
  const [users, setUsers] = useState<TeamUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [editUser, setEditUser] = useState<TeamUser | null>(null);
  const [form, setForm] = useState({ email: '', password: '', name: '', role: 'viewer' as UserRole });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isAdmin) { router.replace('/'); return; }
    load();
  }, [isAdmin]);

  const load = async () => {
    try {
      const data = await apiGet<TeamUser[]>('/auth/users');
      setUsers(data);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      await apiPost('/auth/users', form);
      setShowNew(false);
      setForm({ email: '', password: '', name: '', role: 'viewer' });
      await load();
    } catch (err) { setError((err as Error).message); }
    finally { setSaving(false); }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editUser) return;
    setError('');
    setSaving(true);
    try {
      await apiPut(`/auth/users/${editUser._id}`, {
        name: form.name,
        role: form.role,
        isActive: editUser.isActive,
        ...(form.password ? { password: form.password } : {})
      });
      setEditUser(null);
      await load();
    } catch (err) { setError((err as Error).message); }
    finally { setSaving(false); }
  };

  const handleToggleActive = async (u: TeamUser) => {
    try { await apiPut(`/auth/users/${u._id}`, { isActive: !u.isActive }); await load(); }
    catch (err) { alert((err as Error).message); }
  };

  const handleDelete = async (u: TeamUser) => {
    if (!confirm(`Delete user "${u.name}"? This cannot be undone.`)) return;
    try { await apiDelete(`/auth/users/${u._id}`); await load(); }
    catch (err) { alert((err as Error).message); }
  };

  const openEdit = (u: TeamUser) => {
    setForm({ email: u.email, password: '', name: u.name, role: u.role });
    setEditUser(u);
    setError('');
  };

  if (!isAdmin) return null;

  return (
    <div className="flex flex-col h-full">
      <Header title="User Management" />
      <main className="flex-1 p-8 overflow-auto">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold dark:text-white">Team Members</h2>
          <button
            onClick={() => { setShowNew(true); setError(''); }}
            className="flex items-center gap-2 bg-primary text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-blue-600 transition-all"
          >
            <span className="material-symbols-outlined text-sm">person_add</span>
            Add User
          </button>
        </div>

        {/* Role legend */}
        <div className="flex gap-4 mb-6 flex-wrap">
          {(Object.keys(ROLE_DESC) as UserRole[]).map(role => (
            <div key={role} className="flex items-center gap-2 text-sm">
              <span className={`text-[10px] px-2 py-0.5 rounded border font-bold uppercase tracking-wider ${ROLE_STYLE[role]}`}>{role}</span>
              <span className="text-slate-400">{ROLE_DESC[role]}</span>
            </div>
          ))}
        </div>

        {loading ? (
          <div className="text-slate-400 text-sm">Loading…</div>
        ) : (
          <div className="bg-white dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-700">
                  <th className="text-left px-6 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide">Name</th>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide">Email</th>
                  <th className="text-center px-6 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide">Role</th>
                  <th className="text-center px-6 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide">Status</th>
                  <th className="text-right px-6 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide">Last login</th>
                  <th className="px-6 py-3" />
                </tr>
              </thead>
              <tbody>
                {users.map(u => (
                  <tr key={u._id} className="border-b border-slate-50 dark:border-slate-700/50 last:border-0 hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors">
                    <td className="px-6 py-3 font-medium dark:text-white">
                      {u.name}
                      {u._id === currentUser?.userId && (
                        <span className="ml-2 text-[10px] text-slate-400">(you)</span>
                      )}
                    </td>
                    <td className="px-6 py-3 text-slate-500 dark:text-slate-400">{u.email}</td>
                    <td className="px-6 py-3 text-center">
                      <span className={`text-[10px] px-2 py-0.5 rounded border font-bold uppercase tracking-wider ${ROLE_STYLE[u.role]}`}>
                        {u.role}
                      </span>
                    </td>
                    <td className="px-6 py-3 text-center">
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${u.isActive ? 'bg-green-500/10 text-green-500' : 'bg-slate-200 dark:bg-slate-700 text-slate-400'}`}>
                        {u.isActive ? 'Active' : 'Disabled'}
                      </span>
                    </td>
                    <td className="px-6 py-3 text-right text-xs text-slate-400">
                      {u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleDateString() : 'Never'}
                    </td>
                    <td className="px-6 py-3 text-right">
                      <div className="flex items-center gap-1 justify-end">
                        <button onClick={() => openEdit(u)} className="p-1 text-slate-400 hover:text-primary transition-colors" title="Edit">
                          <span className="material-symbols-outlined text-sm">edit</span>
                        </button>
                        {u._id !== currentUser?.userId && (
                          <>
                            <button onClick={() => handleToggleActive(u)} className="p-1 text-slate-400 hover:text-amber-500 transition-colors" title={u.isActive ? 'Disable' : 'Enable'}>
                              <span className="material-symbols-outlined text-sm">{u.isActive ? 'block' : 'check_circle'}</span>
                            </button>
                            <button onClick={() => handleDelete(u)} className="p-1 text-slate-400 hover:text-red-500 transition-colors" title="Delete">
                              <span className="material-symbols-outlined text-sm">delete</span>
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Create modal */}
        {showNew && (
          <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
            <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 w-full max-w-md shadow-2xl">
              <h3 className="text-lg font-bold dark:text-white mb-4">Add User</h3>
              <form onSubmit={handleCreate} className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2">
                    <label className="block text-xs font-semibold text-slate-500 mb-1">Full name *</label>
                    <input required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 dark:bg-slate-700 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-xs font-semibold text-slate-500 mb-1">Email *</label>
                    <input required type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 dark:bg-slate-700 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-xs font-semibold text-slate-500 mb-1">Password *</label>
                    <input required type="password" minLength={6} value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 dark:bg-slate-700 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                      placeholder="Min. 6 characters" />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-xs font-semibold text-slate-500 mb-1">Role</label>
                    <select value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value as UserRole }))}
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 dark:bg-slate-700 dark:text-white text-sm focus:outline-none">
                      <option value="viewer">Viewer — read-only</option>
                      <option value="editor">Editor — add/edit/delete</option>
                      <option value="admin">Admin — full access</option>
                    </select>
                  </div>
                </div>
                {error && <p className="text-red-500 text-xs">{error}</p>}
                <div className="flex gap-2 justify-end pt-1">
                  <button type="button" onClick={() => setShowNew(false)} className="px-4 py-2 rounded-lg text-sm text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700">Cancel</button>
                  <button type="submit" disabled={saving} className="px-4 py-2 rounded-lg text-sm font-semibold bg-primary text-white hover:bg-blue-600 disabled:opacity-50">
                    {saving ? 'Creating…' : 'Create'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Edit modal */}
        {editUser && (
          <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
            <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 w-full max-w-md shadow-2xl">
              <h3 className="text-lg font-bold dark:text-white mb-4">Edit User — {editUser.email}</h3>
              <form onSubmit={handleUpdate} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Full name *</label>
                  <input required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 dark:bg-slate-700 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Role</label>
                  <select value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value as UserRole }))}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 dark:bg-slate-700 dark:text-white text-sm focus:outline-none">
                    <option value="viewer">Viewer — read-only</option>
                    <option value="editor">Editor — add/edit/delete</option>
                    <option value="admin">Admin — full access</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">New password (leave blank to keep current)</label>
                  <input type="password" minLength={6} value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 dark:bg-slate-700 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                    placeholder="••••••••" />
                </div>
                {error && <p className="text-red-500 text-xs">{error}</p>}
                <div className="flex gap-2 justify-end pt-1">
                  <button type="button" onClick={() => setEditUser(null)} className="px-4 py-2 rounded-lg text-sm text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700">Cancel</button>
                  <button type="submit" disabled={saving} className="px-4 py-2 rounded-lg text-sm font-semibold bg-primary text-white hover:bg-blue-600 disabled:opacity-50">
                    {saving ? 'Saving…' : 'Save'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
