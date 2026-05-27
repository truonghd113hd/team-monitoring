'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Header from '@/components/header';
import { trackerApi } from '@/services/api';
import { useSocket } from '@/contexts/SocketContext';
import type { TrackerProject, TrackerProjectStats } from '@/types/api';

const COLOR_PRESETS = ['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#06b6d4', '#ec4899'];

const STAT_ITEMS: Array<{ key: keyof TrackerProjectStats; label: string; color: string }> = [
  { key: 'total', label: 'Total', color: 'text-slate-500 dark:text-slate-400' },
  { key: 'todo', label: 'Todo', color: 'text-slate-500' },
  { key: 'inprogress', label: 'In Progress', color: 'text-blue-500' },
  { key: 'review', label: 'Review', color: 'text-purple-500' },
  { key: 'done', label: 'Done', color: 'text-green-500' },
];

type ImportTab = 'manual' | 'github' | 'sheet';

const IMPORT_TABS: Array<{ value: ImportTab; label: string; icon: string }> = [
  { value: 'manual', label: 'Manual', icon: 'edit' },
  { value: 'github', label: 'GitHub', icon: 'code' },
  { value: 'sheet', label: 'Google Sheet', icon: 'table_chart' },
];

function relativeTime(date: Date | string | null | undefined): string {
  if (!date) return '';
  const diff = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return new Date(date).toLocaleDateString();
}

export default function TrackerHomePage() {
  const [projects, setProjects] = useState<TrackerProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [importTab, setImportTab] = useState<ImportTab>('manual');
  const [form, setForm] = useState({ name: '', description: '', color: '#3b82f6', githubProjectId: '', githubProjectUrl: '', githubRepo: '' });
  const [githubUrl, setGithubUrl] = useState('');
  const [resolving, setResolving] = useState(false);
  const [resolveError, setResolveError] = useState('');
  const [sheetUrl, setSheetUrl] = useState('');
  const [sheetError, setSheetError] = useState('');
  const [saving, setSaving] = useState(false);
  const { socket } = useSocket();

  const load = async () => {
    try {
      const data = await trackerApi.listProjects();
      setProjects(data as TrackerProject[]);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  // Reload project list when any project syncs
  useEffect(() => {
    if (!socket) return;
    const handler = () => { load(); };
    socket.on('tracker:project:synced', handler);
    return () => { socket.off('tracker:project:synced', handler); };
  }, [socket]);

  const resetModal = () => {
    setShowNew(false);
    setImportTab('manual');
    setForm({ name: '', description: '', color: '#3b82f6', githubProjectId: '', githubProjectUrl: '', githubRepo: '' });
    setGithubUrl(''); setResolveError('');
    setSheetUrl(''); setSheetError('');
  };

  const handleResolveGithubUrl = async () => {
    if (!githubUrl.trim()) return;
    setResolving(true); setResolveError('');
    try {
      const result = await trackerApi.resolveGithubProject(githubUrl.trim());
      setForm(f => ({
        ...f,
        githubProjectId: result.githubProjectId,
        githubProjectUrl: (result as any).githubProjectUrl ?? githubUrl.trim(),
        name: f.name || result.title,
        description: f.description || result.description,
      }));
    } catch (err) { setResolveError((err as Error).message); }
    finally { setResolving(false); }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      const project = await trackerApi.createProject({
        ...form,
        githubProjectId: importTab === 'github' ? form.githubProjectId.trim() || null : null,
        githubProjectUrl: importTab === 'github' ? form.githubProjectUrl.trim() || null : null,
        githubRepo: importTab === 'github' ? form.githubRepo.trim() || null : null,
      }) as TrackerProject;

      if (importTab === 'sheet' && sheetUrl.trim()) {
        await trackerApi.importGoogleSheet(project._id, { googleSheetUrl: sheetUrl.trim() });
      }

      resetModal();
      await load();
    } catch (err) { alert((err as Error).message); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Delete project "${name}" and all its issues?`)) return;
    try { await trackerApi.deleteProject(id); await load(); }
    catch (err) { alert((err as Error).message); }
  };

  return (
    <div className="flex flex-col h-full">
      <Header title="Tracker" />
      <main className="flex-1 p-8 overflow-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-bold dark:text-white">Projects</h2>
            <p className="text-sm text-slate-400 mt-0.5">{projects.length} project{projects.length !== 1 ? 's' : ''}</p>
          </div>
          <button
            onClick={() => setShowNew(true)}
            className="flex items-center gap-2 bg-primary text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-blue-600 transition-colors shadow-lg shadow-primary/20"
          >
            <span className="material-symbols-outlined text-sm">add</span>
            New Project
          </button>
        </div>

        {loading ? (
          <div className="text-slate-400">Loading…</div>
        ) : projects.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-slate-400">
            <span className="material-symbols-outlined text-5xl mb-3">task_alt</span>
            <p className="text-lg font-medium">No projects yet</p>
            <p className="text-sm mt-1">Create a project to start tracking issues.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {projects.map(p => {
              const stats = p.stats ?? { total: 0, todo: 0, inprogress: 0, review: 0, done: 0 };
              const doneRatio = stats.total > 0 ? (stats.done / stats.total) * 100 : 0;
              return (
                <div key={p._id} className="bg-white dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700 p-5 flex flex-col gap-4 hover:shadow-lg transition-shadow">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: p.color }} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <Link href={`/tracker/${p._id}`} className="font-bold dark:text-white hover:text-primary transition-colors truncate">
                            {p.name}
                          </Link>
                          {p.githubProjectId && (
                            <span title={`GitHub: ${p.githubProjectId}`} className="text-[9px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-700 text-slate-500 font-mono shrink-0">GH</span>
                          )}
                          {p.googleSheetId && (
                            <span className="text-[9px] px-1.5 py-0.5 rounded bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 font-mono shrink-0">GS</span>
                          )}
                          {stats.hasTestcase && (
                            <span title="Has test cases" className="text-[9px] px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 font-mono shrink-0">TC</span>
                          )}
                          {stats.hasIssue && (
                            <span title="Has issues" className="text-[9px] px-1.5 py-0.5 rounded bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 font-mono shrink-0">IS</span>
                          )}
                          {stats.hasBug && (
                            <span title="Has bugs" className="text-[9px] px-1.5 py-0.5 rounded bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 font-mono shrink-0">Bug</span>
                          )}
                        </div>
                        {p.description && (
                          <p className="text-xs text-slate-400 mt-0.5 truncate">{p.description}</p>
                        )}
                        {p.googleSheetLastSync && (
                          <p className="text-[10px] text-slate-400 mt-0.5 flex items-center gap-1">
                            <span className="material-symbols-outlined text-[11px]">sync</span>
                            {relativeTime(p.googleSheetLastSync)}
                          </p>
                        )}
                      </div>
                    </div>
                    <button onClick={() => handleDelete(p._id, p.name)} className="text-slate-300 hover:text-red-500 transition-colors shrink-0">
                      <span className="material-symbols-outlined text-sm">delete</span>
                    </button>
                  </div>

                  <div className="w-full h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                    <div className="h-full bg-green-500 rounded-full transition-all" style={{ width: `${doneRatio}%` }} />
                  </div>

                  <div className="grid grid-cols-5 gap-1 text-center">
                    {STAT_ITEMS.map(s => (
                      <Link key={s.key} href={`/tracker/${p._id}${s.key !== 'total' ? `?status=${s.key}` : ''}`} className="group">
                        <p className={`text-lg font-bold group-hover:scale-110 transition-transform ${s.color}`}>{stats[s.key]}</p>
                        <p className="text-[9px] text-slate-400 uppercase tracking-wide">{s.label}</p>
                      </Link>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* New Project modal */}
      {showNew && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <h3 className="text-lg font-bold dark:text-white mb-4">New Project</h3>
            <form onSubmit={handleCreate} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Name *</label>
                <input required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 dark:bg-slate-700 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                  placeholder="My Project" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Description</label>
                <input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 dark:bg-slate-700 dark:text-white text-sm focus:outline-none"
                  placeholder="Optional description" />
              </div>

              {/* Import source tabs */}
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-2">Import from</label>
                <div className="flex rounded-lg border border-slate-200 dark:border-slate-600 overflow-hidden text-xs">
                  {IMPORT_TABS.map(t => (
                    <button key={t.value} type="button" onClick={() => setImportTab(t.value)}
                      className={`flex-1 py-1.5 font-medium transition-colors flex items-center justify-center gap-1 ${importTab === t.value ? 'bg-primary text-white' : 'text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-700'}`}>
                      <span className="material-symbols-outlined text-sm">{t.icon}</span>
                      <span className="hidden sm:inline">{t.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* GitHub import panel */}
              {importTab === 'github' && (
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">GitHub Project URL</label>
                  <div className="flex gap-2">
                    <input value={githubUrl} onChange={e => { setGithubUrl(e.target.value); setResolveError(''); }}
                      onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), handleResolveGithubUrl())}
                      className="flex-1 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 dark:bg-slate-700 dark:text-white text-sm focus:outline-none"
                      placeholder="https://github.com/orgs/org/projects/1" />
                    <button type="button" onClick={handleResolveGithubUrl} disabled={resolving || !githubUrl.trim()}
                      className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 text-sm font-medium hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-40 whitespace-nowrap">
                      {resolving ? <span className="material-symbols-outlined text-sm animate-spin">refresh</span> : 'Import'}
                    </button>
                  </div>
                  {resolveError && <p className="text-[11px] text-red-500 mt-1">{resolveError}</p>}
                  {form.githubProjectId && !resolveError && (
                    <p className="text-[11px] text-green-500 mt-1 flex items-center gap-1">
                      <span className="material-symbols-outlined text-sm">check_circle</span>
                      Linked: <span className="font-mono">{form.githubProjectId}</span>
                    </p>
                  )}
                  <div className="mt-2">
                    <label className="block text-xs font-semibold text-slate-500 mb-1">GitHub Repo <span className="font-normal text-slate-400">(owner/repo — for creating issues)</span></label>
                    <input value={form.githubRepo} onChange={e => setForm(f => ({ ...f, githubRepo: e.target.value }))}
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 dark:bg-slate-700 dark:text-white text-sm focus:outline-none"
                      placeholder="e.g. invo-ring/invo-issues" />
                  </div>
                </div>
              )}

              {/* Google Sheet import panel */}
              {importTab === 'sheet' && (
                <div className="space-y-2">
                  <label className="block text-xs font-semibold text-slate-500">Google Sheet URL</label>
                  <input
                    value={sheetUrl}
                    onChange={e => { setSheetUrl(e.target.value); setSheetError(''); }}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 dark:bg-slate-700 dark:text-white text-sm focus:outline-none"
                    placeholder="https://docs.google.com/spreadsheets/d/…" />
                  {sheetError && <p className="text-[11px] text-red-500">{sheetError}</p>}
                  <p className="text-[11px] text-slate-400">
                    All sheets are scanned automatically. Testcase (priority in col C) and issue (priority in col L) formats are auto-detected per tab.
                  </p>
                </div>
              )}

              {/* Color picker */}
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-2">Color</label>
                <div className="flex gap-2 flex-wrap">
                  {COLOR_PRESETS.map(c => (
                    <button key={c} type="button" onClick={() => setForm(f => ({ ...f, color: c }))}
                      className="w-7 h-7 rounded-full border-2 transition-all"
                      style={{ backgroundColor: c, borderColor: form.color === c ? '#fff' : 'transparent', boxShadow: form.color === c ? `0 0 0 2px ${c}` : 'none' }} />
                  ))}
                </div>
              </div>

              <div className="flex gap-2 justify-end pt-1">
                <button type="button" onClick={resetModal} className="px-4 py-2 rounded-lg text-sm text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700">Cancel</button>
                <button type="submit" disabled={saving} className="px-4 py-2 rounded-lg text-sm font-semibold bg-primary text-white hover:bg-blue-600 disabled:opacity-50">
                  {saving ? 'Creating…' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
