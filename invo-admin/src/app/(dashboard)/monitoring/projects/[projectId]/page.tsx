'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import Header from '@/components/header';
import StatusPill from '@/components/monitoring/StatusPill';
import ResourceBar from '@/components/monitoring/ResourceBar';
import { monitoringApi } from '@/services/api';
import { useSocket } from '@/contexts/SocketContext';
import type { MonitorProject, MonitorEnvironment, MonitorEndpoint, MonitorHost } from '@/types/api';

type Tab = { env: MonitorEnvironment; endpoints: MonitorEndpoint[]; hosts: MonitorHost[] };

const formatHostBps = (bps: number | null): string => {
  if (bps == null) return '—';
  if (bps < 1024) return `${bps.toFixed(0)}B/s`;
  if (bps < 1024 * 1024) return `${(bps / 1024).toFixed(1)}KB/s`;
  return `${(bps / 1024 / 1024).toFixed(2)}MB/s`;
};

export default function ProjectDetailPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const router = useRouter();
  const [project, setProject] = useState<MonitorProject | null>(null);
  const [tabs, setTabs] = useState<Tab[]>([]);
  const [activeEnvId, setActiveEnvId] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [showNewEnv, setShowNewEnv] = useState(false);
  const [showNewEndpoint, setShowNewEndpoint] = useState(false);
  const [showNewHost, setShowNewHost] = useState(false);
  const [envForm, setEnvForm] = useState({ name: '', color: '#3b82f6' });
  const [epForm, setEpForm] = useState({ name: '', url: '', method: 'GET' as 'GET' | 'POST' | 'HEAD', expectedStatus: 200, timeoutMs: 10000 });
  const [hostForm, setHostForm] = useState({ name: '', mode: 'agent', sshHost: '', sshPort: 22, sshUser: '', sshKey: '' });
  const [saving, setSaving] = useState(false);
  const { socket } = useSocket();

  const load = async () => {
    try {
      const [proj, envs] = await Promise.all([
        monitoringApi.getProject(projectId),
        monitoringApi.listEnvironments(projectId)
      ]);
      setProject(proj as MonitorProject);
      const validEnvs = (envs as MonitorEnvironment[]).filter(env => env._id);
      const tabsData = await Promise.all(validEnvs.map(async env => {
        const [endpoints, hosts] = await Promise.all([
          monitoringApi.listEndpoints(env._id),
          monitoringApi.listHosts(env._id)
        ]);
        return { env, endpoints: endpoints as MonitorEndpoint[], hosts: hosts as MonitorHost[] };
      }));
      setTabs(tabsData);
      if (!activeEnvId && tabsData.length > 0) setActiveEnvId(tabsData[0].env._id);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [projectId]);

  useEffect(() => {
    if (!socket) return;

    const onEndpointUpdated = (data: { _id: string; environmentId: string; lastStatus: string; lastResponseTimeMs: number | null; lastCheckedAt: string }) => {
      setTabs(prev => prev.map(tab => {
        if (tab.env._id !== data.environmentId) return tab;
        return {
          ...tab,
          endpoints: tab.endpoints.map(ep =>
            ep._id === data._id
              ? { ...ep, lastStatus: data.lastStatus as MonitorEndpoint['lastStatus'], lastResponseTimeMs: data.lastResponseTimeMs, lastCheckedAt: new Date(data.lastCheckedAt) }
              : ep
          )
        };
      }));
    };

    const onHostUpdated = (data: { _id: string; environmentId: string; lastCpuPct: number; lastMemPct: number; lastDiskPct: number; lastNetRxBytesPerSec: number | null; lastNetTxBytesPerSec: number | null; lastSampledAt: string }) => {
      setTabs(prev => prev.map(tab => {
        if (tab.env._id !== data.environmentId) return tab;
        return {
          ...tab,
          hosts: tab.hosts.map(h =>
            h._id === data._id
              ? { ...h, lastCpuPct: data.lastCpuPct, lastMemPct: data.lastMemPct, lastDiskPct: data.lastDiskPct, lastNetRxBytesPerSec: data.lastNetRxBytesPerSec, lastNetTxBytesPerSec: data.lastNetTxBytesPerSec, lastSampledAt: new Date(data.lastSampledAt) }
              : h
          )
        };
      }));
    };

    socket.on('endpoint:updated', onEndpointUpdated);
    socket.on('host:updated', onHostUpdated);
    return () => {
      socket.off('endpoint:updated', onEndpointUpdated);
      socket.off('host:updated', onHostUpdated);
    };
  }, [socket]);

  const activeTab = tabs.find(t => t.env._id === activeEnvId);

  const handleDeleteProject = async () => {
    if (!confirm(`Delete project "${project?.name}"?`)) return;
    try {
      await monitoringApi.deleteProject(projectId);
      router.push('/monitoring');
    } catch (err) {
      alert((err as Error).message);
    }
  };

  const handleCreateEnv = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await monitoringApi.createEnvironment(projectId, envForm);
      setShowNewEnv(false);
      await load();
    } catch (err) { alert((err as Error).message); }
    finally { setSaving(false); }
  };

  const handleCreateEndpoint = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeEnvId) return;
    setSaving(true);
    try {
      await monitoringApi.createEndpoint(activeEnvId, epForm);
      setShowNewEndpoint(false);
      await load();
    } catch (err) { alert((err as Error).message); }
    finally { setSaving(false); }
  };

  const handleCreateHost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeEnvId) return;
    setSaving(true);
    try {
      const payload: any = { name: hostForm.name, mode: hostForm.mode };
      if (hostForm.mode === 'ssh') {
        payload.sshConfig = { host: hostForm.sshHost, port: hostForm.sshPort, user: hostForm.sshUser, privateKeyPath: hostForm.sshKey };
      }
      await monitoringApi.createHost(activeEnvId, payload);
      setShowNewHost(false);
      await load();
    } catch (err) { alert((err as Error).message); }
    finally { setSaving(false); }
  };

  const handleCheckNow = async (epId: string) => {
    try {
      await monitoringApi.checkNow(epId);
      await load();
    } catch (err) { alert((err as Error).message); }
  };

  const handleDeleteEndpoint = async (epId: string, name: string) => {
    if (!confirm(`Delete endpoint "${name}"?`)) return;
    try { await monitoringApi.deleteEndpoint(epId); await load(); }
    catch (err) { alert((err as Error).message); }
  };

  const handleDeleteHost = async (hostId: string, name: string) => {
    if (!confirm(`Delete host "${name}"?`)) return;
    try { await monitoringApi.deleteHost(hostId); await load(); }
    catch (err) { alert((err as Error).message); }
  };

  if (loading) return <div className="flex flex-col h-full"><Header title="Monitoring" /><div className="p-8 text-slate-400">Loading…</div></div>;
  if (!project) return <div className="flex flex-col h-full"><Header title="Monitoring" /><div className="p-8 text-red-400">Project not found</div></div>;

  return (
    <div className="flex flex-col h-full">
      <Header title={`Monitoring — ${project.name}`} />
      <main className="flex-1 p-8 overflow-auto">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-slate-400 mb-6">
          <Link href="/monitoring" className="hover:text-primary">Monitoring</Link>
          <span>/</span>
          <span className="dark:text-white font-medium">{project.name}</span>
          <button onClick={handleDeleteProject} className="ml-auto text-xs text-red-400 hover:text-red-600 border border-red-400/30 px-2 py-1 rounded">
            Delete project
          </button>
        </div>

        {/* Environment tabs */}
        <div className="flex items-center gap-2 mb-6 flex-wrap">
          {tabs.map(t => (
            <button
              key={t.env._id}
              onClick={() => setActiveEnvId(t.env._id)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${activeEnvId === t.env._id ? 'bg-primary text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'}`}
            >
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: t.env.color }} />
              {t.env.name}
            </button>
          ))}
          <button onClick={() => setShowNewEnv(true)} className="px-3 py-1.5 rounded-lg text-sm font-medium border border-dashed border-slate-300 dark:border-slate-600 text-slate-400 hover:border-primary hover:text-primary transition-all">
            + Add env
          </button>
        </div>

        {activeTab && (
          <div className="space-y-6">
            {/* Endpoints */}
            <section>
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold dark:text-white">Endpoints ({activeTab.endpoints.length})</h3>
                <button onClick={() => setShowNewEndpoint(true)} className="text-xs bg-primary/10 text-primary px-3 py-1 rounded-lg font-semibold hover:bg-primary hover:text-white transition-all">
                  + Add endpoint
                </button>
              </div>
              {activeTab.endpoints.length === 0 ? (
                <p className="text-sm text-slate-400">No endpoints yet</p>
              ) : (
                <div className="bg-white dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-100 dark:border-slate-700">
                        <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide">Name</th>
                        <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide">URL</th>
                        <th className="text-center px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide">Status</th>
                        <th className="text-right px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide">Response</th>
                        <th className="text-right px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide">Checked</th>
                        <th className="px-4 py-3" />
                      </tr>
                    </thead>
                    <tbody>
                      {activeTab.endpoints.map(ep => (
                        <tr key={ep._id} className="border-b border-slate-50 dark:border-slate-700/50 last:border-0 hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors">
                          <td className="px-4 py-3 font-medium dark:text-white">
                            <Link href={`/monitoring/projects/${projectId}/endpoints/${ep._id}`} className="hover:text-primary">
                              {ep.name}
                            </Link>
                          </td>
                          <td className="px-4 py-3 text-slate-500 dark:text-slate-400 text-xs font-mono max-w-[200px] truncate">{ep.url}</td>
                          <td className="px-4 py-3 text-center"><StatusPill status={ep.lastStatus} pulse /></td>
                          <td className="px-4 py-3 text-right text-slate-500 dark:text-slate-400 text-xs">
                            {ep.lastResponseTimeMs != null ? `${ep.lastResponseTimeMs}ms` : '—'}
                          </td>
                          <td className="px-4 py-3 text-right text-slate-400 text-xs">
                            {ep.lastCheckedAt ? new Date(ep.lastCheckedAt).toLocaleTimeString() : '—'}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex items-center gap-1 justify-end">
                              <button onClick={() => handleCheckNow(ep._id)} title="Check now" className="p-1 text-slate-400 hover:text-primary transition-colors">
                                <span className="material-symbols-outlined text-sm">refresh</span>
                              </button>
                              <button onClick={() => handleDeleteEndpoint(ep._id, ep.name)} title="Delete" className="p-1 text-slate-400 hover:text-red-500 transition-colors">
                                <span className="material-symbols-outlined text-sm">delete</span>
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            {/* Hosts */}
            <section>
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold dark:text-white">Hosts ({activeTab.hosts.length})</h3>
                <button onClick={() => setShowNewHost(true)} className="text-xs bg-primary/10 text-primary px-3 py-1 rounded-lg font-semibold hover:bg-primary hover:text-white transition-all">
                  + Add host
                </button>
              </div>
              {activeTab.hosts.length === 0 ? (
                <p className="text-sm text-slate-400">No hosts yet</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {activeTab.hosts.map(host => (
                    <div key={host._id} className="bg-white dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
                      <div className="flex items-center justify-between mb-3">
                        <Link href={`/monitoring/projects/${projectId}/hosts/${host._id}`} className="font-semibold dark:text-white hover:text-primary">
                          {host.name}
                        </Link>
                        <div className="flex items-center gap-1">
                          <span className="text-[10px] bg-slate-100 dark:bg-slate-700 text-slate-400 px-1.5 py-0.5 rounded font-mono">{host.mode}</span>
                          <button onClick={() => handleDeleteHost(host._id, host.name)} className="p-1 text-slate-400 hover:text-red-500 transition-colors">
                            <span className="material-symbols-outlined text-sm">delete</span>
                          </button>
                        </div>
                      </div>
                      {host.lastSampledAt ? (
                        <div className="space-y-2">
                          <ResourceBar label="CPU" value={host.lastCpuPct ?? 0} />
                          <ResourceBar label="Memory" value={host.lastMemPct ?? 0} />
                          <ResourceBar label="Disk" value={host.lastDiskPct ?? 0} />
                          {(host.lastNetRxBytesPerSec != null || host.lastNetTxBytesPerSec != null) && (
                            <div className="flex items-center justify-between pt-1">
                              <span className="text-[10px] text-slate-400">Network</span>
                              <span className="text-[10px] font-mono text-slate-500 dark:text-slate-400">
                                ↓ {formatHostBps(host.lastNetRxBytesPerSec)} · ↑ {formatHostBps(host.lastNetTxBytesPerSec)}
                              </span>
                            </div>
                          )}
                          <p className="text-[10px] text-slate-400 mt-2">
                            Last: {new Date(host.lastSampledAt).toLocaleTimeString()}
                          </p>
                        </div>
                      ) : (
                        <p className="text-xs text-slate-400">No data yet</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        )}

        {/* Modals */}
        {showNewEnv && (
          <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
            <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 w-full max-w-sm shadow-2xl">
              <h3 className="text-lg font-bold dark:text-white mb-4">Add Environment</h3>
              <form onSubmit={handleCreateEnv} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Name *</label>
                  <input required value={envForm.name} onChange={e => setEnvForm(f => ({ ...f, name: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 dark:bg-slate-700 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                    placeholder="prod / staging / dev" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Color</label>
                  <input type="color" value={envForm.color} onChange={e => setEnvForm(f => ({ ...f, color: e.target.value }))} className="h-8 w-16 rounded cursor-pointer" />
                </div>
                <div className="flex gap-2 justify-end">
                  <button type="button" onClick={() => setShowNewEnv(false)} className="px-4 py-2 rounded-lg text-sm text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700">Cancel</button>
                  <button type="submit" disabled={saving} className="px-4 py-2 rounded-lg text-sm font-semibold bg-primary text-white hover:bg-blue-600 disabled:opacity-50">
                    {saving ? 'Adding…' : 'Add'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {showNewEndpoint && (
          <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
            <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 w-full max-w-md shadow-2xl">
              <h3 className="text-lg font-bold dark:text-white mb-4">Add Endpoint</h3>
              <form onSubmit={handleCreateEndpoint} className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Name *</label>
                  <input required value={epForm.name} onChange={e => setEpForm(f => ({ ...f, name: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 dark:bg-slate-700 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                    placeholder="Health Check" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">URL *</label>
                  <input required type="url" value={epForm.url} onChange={e => setEpForm(f => ({ ...f, url: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 dark:bg-slate-700 dark:text-white text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary/50"
                    placeholder="https://api.example.com/health" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1">Method</label>
                    <select value={epForm.method} onChange={e => setEpForm(f => ({ ...f, method: e.target.value as 'GET' | 'POST' | 'HEAD' }))}
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 dark:bg-slate-700 dark:text-white text-sm focus:outline-none">
                      <option>GET</option><option>POST</option><option>HEAD</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1">Expected status</label>
                    <input type="number" value={epForm.expectedStatus} onChange={e => setEpForm(f => ({ ...f, expectedStatus: parseInt(e.target.value) }))}
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 dark:bg-slate-700 dark:text-white text-sm focus:outline-none" />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Timeout (ms)</label>
                  <input type="number" value={epForm.timeoutMs} onChange={e => setEpForm(f => ({ ...f, timeoutMs: parseInt(e.target.value) }))}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 dark:bg-slate-700 dark:text-white text-sm focus:outline-none" />
                </div>
                <div className="flex gap-2 justify-end pt-1">
                  <button type="button" onClick={() => setShowNewEndpoint(false)} className="px-4 py-2 rounded-lg text-sm text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700">Cancel</button>
                  <button type="submit" disabled={saving} className="px-4 py-2 rounded-lg text-sm font-semibold bg-primary text-white hover:bg-blue-600 disabled:opacity-50">
                    {saving ? 'Adding…' : 'Add'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {showNewHost && (
          <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
            <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 w-full max-w-md shadow-2xl">
              <h3 className="text-lg font-bold dark:text-white mb-4">Add Host</h3>
              <form onSubmit={handleCreateHost} className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Name *</label>
                  <input required value={hostForm.name} onChange={e => setHostForm(f => ({ ...f, name: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 dark:bg-slate-700 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                    placeholder="prod-vps-01" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Mode *</label>
                  <select value={hostForm.mode} onChange={e => setHostForm(f => ({ ...f, mode: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 dark:bg-slate-700 dark:text-white text-sm focus:outline-none">
                    <option value="agent">Agent (push metrics)</option>
                    <option value="ssh">SSH (pull metrics)</option>
                  </select>
                </div>
                {hostForm.mode === 'ssh' && (
                  <>
                    <div className="grid grid-cols-3 gap-2">
                      <div className="col-span-2">
                        <label className="block text-xs font-semibold text-slate-500 mb-1">SSH Host *</label>
                        <input required value={hostForm.sshHost} onChange={e => setHostForm(f => ({ ...f, sshHost: e.target.value }))}
                          className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 dark:bg-slate-700 dark:text-white text-sm font-mono focus:outline-none"
                          placeholder="1.2.3.4" />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-500 mb-1">Port</label>
                        <input type="number" value={hostForm.sshPort} onChange={e => setHostForm(f => ({ ...f, sshPort: parseInt(e.target.value) }))}
                          className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 dark:bg-slate-700 dark:text-white text-sm focus:outline-none" />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 mb-1">SSH User *</label>
                      <input required value={hostForm.sshUser} onChange={e => setHostForm(f => ({ ...f, sshUser: e.target.value }))}
                        className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 dark:bg-slate-700 dark:text-white text-sm font-mono focus:outline-none"
                        placeholder="ubuntu" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 mb-1">Private key path (on server) *</label>
                      <input required value={hostForm.sshKey} onChange={e => setHostForm(f => ({ ...f, sshKey: e.target.value }))}
                        className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 dark:bg-slate-700 dark:text-white text-sm font-mono focus:outline-none"
                        placeholder="/root/.ssh/id_rsa" />
                    </div>
                  </>
                )}
                <div className="flex gap-2 justify-end pt-1">
                  <button type="button" onClick={() => setShowNewHost(false)} className="px-4 py-2 rounded-lg text-sm text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700">Cancel</button>
                  <button type="submit" disabled={saving} className="px-4 py-2 rounded-lg text-sm font-semibold bg-primary text-white hover:bg-blue-600 disabled:opacity-50">
                    {saving ? 'Adding…' : 'Add'}
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
