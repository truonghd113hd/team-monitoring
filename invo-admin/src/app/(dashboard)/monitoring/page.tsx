'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Header from '@/components/header';
import StatusPill from '@/components/monitoring/StatusPill';
import { monitoringApi } from '@/services/api';
import type { MonitorOverviewProject } from '@/types/api';

export default function MonitoringOverviewPage() {
  const [projects, setProjects] = useState<MonitorOverviewProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewProject, setShowNewProject] = useState(false);
  const [form, setForm] = useState({ name: '', slug: '', description: '', isPublic: false });
  const [saving, setSaving] = useState(false);

  const load = async () => {
    try {
      const data = await monitoringApi.getOverview();
      setProjects(data as MonitorOverviewProject[]);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await monitoringApi.createProject(form);
      setShowNewProject(false);
      setForm({ name: '', slug: '', description: '', isPublic: false });
      await load();
    } catch (err) {
      alert((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const totalFiring = projects.reduce((s, p) =>
    s + p.environments.reduce((es, e) => es + e.firingAlerts, 0), 0);

  return (
    <div className="flex flex-col h-full">
      <Header title="Monitoring" />
      <main className="flex-1 p-8 overflow-auto">
        {/* Summary bar */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <h2 className="text-xl font-bold dark:text-white">Projects</h2>
            {totalFiring > 0 && (
              <span className="bg-red-500 text-white text-xs px-2 py-0.5 rounded-full font-bold animate-pulse">
                {totalFiring} alert{totalFiring > 1 ? 's' : ''} firing
              </span>
            )}
          </div>
          <button
            onClick={() => setShowNewProject(true)}
            className="flex items-center gap-2 bg-primary text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-blue-600 transition-all"
          >
            <span className="material-symbols-outlined text-sm">add</span>
            New Project
          </button>
        </div>

        {loading ? (
          <div className="text-slate-400 text-sm">Loading…</div>
        ) : projects.length === 0 ? (
          <div className="text-center py-20 text-slate-400">
            <span className="material-symbols-outlined text-5xl mb-4 block">monitor_heart</span>
            <p className="text-lg font-medium">No projects yet</p>
            <p className="text-sm mt-1">Create a project to start monitoring your services.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {projects.map(project => (
              <Link
                key={project._id}
                href={`/monitoring/projects/${project._id}`}
                className="block bg-white dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl p-5 hover:shadow-lg hover:border-primary/40 transition-all"
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="font-bold dark:text-white">{project.name}</h3>
                    {project.description && (
                      <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">{project.description}</p>
                    )}
                  </div>
                  {project.isPublic && (
                    <span className="text-[10px] bg-blue-500/10 text-blue-500 border border-blue-500/20 px-2 py-0.5 rounded-full font-bold">PUBLIC</span>
                  )}
                </div>

                <div className="space-y-2">
                  {project.environments.map(env => {
                    const allUp = env.endpoints.down === 0 && env.endpoints.degraded === 0;
                    const hasDown = env.endpoints.down > 0;
                    const overall: any = env.endpoints.total === 0 ? 'unknown' : hasDown ? 'down' : !allUp ? 'degraded' : 'up';
                    return (
                      <div key={env._id} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span
                            className="w-2 h-2 rounded-full"
                            style={{ backgroundColor: env.color }}
                          />
                          <span className="text-sm font-medium dark:text-slate-300 capitalize">{env.name}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          {env.firingAlerts > 0 && (
                            <span className="text-[10px] bg-red-500/10 text-red-500 px-1.5 py-0.5 rounded font-bold">
                              {env.firingAlerts} alert
                            </span>
                          )}
                          <StatusPill status={overall} />
                          <span className="text-xs text-slate-400">
                            {env.endpoints.up}/{env.endpoints.total} up
                          </span>
                        </div>
                      </div>
                    );
                  })}
                  {project.environments.length === 0 && (
                    <p className="text-xs text-slate-400">No environments yet</p>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}

        {/* New project modal */}
        {showNewProject && (
          <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
            <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 w-full max-w-md shadow-2xl">
              <h3 className="text-lg font-bold dark:text-white mb-4">New Monitor Project</h3>
              <form onSubmit={handleCreate} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Name *</label>
                  <input
                    required
                    value={form.name}
                    onChange={e => setForm(f => ({ ...f, name: e.target.value, slug: e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g,'') }))}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 dark:bg-slate-700 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                    placeholder="My API"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Slug (for status page URL) *</label>
                  <input
                    required
                    value={form.slug}
                    onChange={e => setForm(f => ({ ...f, slug: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 dark:bg-slate-700 dark:text-white text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary/50"
                    placeholder="my-api"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Description</label>
                  <textarea
                    value={form.description}
                    onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                    rows={2}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 dark:bg-slate-700 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none"
                  />
                </div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={form.isPublic} onChange={e => setForm(f => ({ ...f, isPublic: e.target.checked }))} className="rounded" />
                  <span className="text-sm dark:text-slate-300">Public status page</span>
                </label>
                <div className="flex gap-2 justify-end pt-2">
                  <button type="button" onClick={() => setShowNewProject(false)} className="px-4 py-2 rounded-lg text-sm font-semibold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 transition-all">Cancel</button>
                  <button type="submit" disabled={saving} className="px-4 py-2 rounded-lg text-sm font-semibold bg-primary text-white hover:bg-blue-600 disabled:opacity-50 transition-all">
                    {saving ? 'Creating…' : 'Create'}
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
