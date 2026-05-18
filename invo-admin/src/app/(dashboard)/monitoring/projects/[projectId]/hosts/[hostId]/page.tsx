'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import Header from '@/components/header';
import MetricChart from '@/components/monitoring/MetricChart';
import ResourceBar from '@/components/monitoring/ResourceBar';
import { monitoringApi } from '@/services/api';
import type { HostMetric, AlertRule } from '@/types/api';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

export default function HostDetailPage() {
  const { projectId, hostId } = useParams<{ projectId: string; hostId: string }>();
  const [metrics, setMetrics] = useState<HostMetric[]>([]);
  const [rules, setRules] = useState<AlertRule[]>([]);
  const [agentToken, setAgentToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [rotating, setRotating] = useState(false);
  const [showAddRule, setShowAddRule] = useState(false);
  const [ruleForm, setRuleForm] = useState({ name: '', condition: 'cpuPct>80', forMinutes: 5, renotifyMinutes: 60 });
  const [saving, setSaving] = useState(false);

  const load = async () => {
    try {
      const [m, r] = await Promise.all([
        monitoringApi.getHostMetrics(hostId, 24),
        monitoringApi.listAlertRules({ targetId: hostId })
      ]);
      setMetrics(m as HostMetric[]);
      setRules(r as AlertRule[]);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [hostId]);

  const latest = metrics[0];

  const handleRotateToken = async () => {
    if (!confirm('Rotate agent token? The current token will stop working immediately.')) return;
    setRotating(true);
    try {
      const data = await monitoringApi.rotateToken(hostId);
      setAgentToken((data as any).agentToken);
    } catch (err) { alert((err as Error).message); }
    finally { setRotating(false); }
  };

  const handleAddRule = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await monitoringApi.createAlertRule({ ...ruleForm, targetType: 'host', targetId: hostId, projectId });
      setShowAddRule(false);
      await load();
    } catch (err) { alert((err as Error).message); }
    finally { setSaving(false); }
  };

  const handleDeleteRule = async (ruleId: string) => {
    if (!confirm('Delete this alert rule?')) return;
    try { await monitoringApi.deleteAlertRule(ruleId); await load(); }
    catch (err) { alert((err as Error).message); }
  };

  const chartData = [...metrics].reverse().map(m => ({
    sampledAt: m.sampledAt,
    cpuPct: m.cpuPct,
    memPct: m.memPct,
    diskPct: m.disk.length > 0 ? Math.max(...m.disk.map(d => d.usedPct)) : 0
  }));

  return (
    <div className="flex flex-col h-full">
      <Header title="Host Detail" />
      <main className="flex-1 p-8 overflow-auto">
        <div className="flex items-center gap-2 text-sm text-slate-400 mb-6">
          <Link href="/monitoring" className="hover:text-primary">Monitoring</Link>
          <span>/</span>
          <Link href={`/monitoring/projects/${projectId}`} className="hover:text-primary">Project</Link>
          <span>/</span>
          <span className="dark:text-white font-medium">Host</span>
        </div>

        {loading ? (
          <div className="text-slate-400">Loading…</div>
        ) : (
          <div className="space-y-6">
            {/* Current snapshot */}
            {latest && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { label: 'CPU', value: latest.cpuPct },
                  { label: 'Memory', value: latest.memPct },
                  { label: 'Disk (max)', value: latest.disk.length ? Math.max(...latest.disk.map(d => d.usedPct)) : 0 },
                  { label: 'Load 1m', value: latest.loadAvg[0] ?? 0, unit: '' },
                ].map(s => (
                  <div key={s.label} className="bg-white dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
                    <p className="text-xs text-slate-400 mb-2">{s.label}</p>
                    <ResourceBar label="" value={s.unit === '' ? s.value : s.value} unit={s.unit === '' ? '' : '%'} />
                  </div>
                ))}
              </div>
            )}

            {/* Charts */}
            <div className="bg-white dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
              <p className="text-xs font-semibold text-slate-400 mb-3">CPU / MEMORY / DISK — LAST 24H</p>
              <MetricChart
                data={chartData}
                xKey="sampledAt"
                lines={[
                  { key: 'cpuPct', color: '#3b82f6', label: 'CPU' },
                  { key: 'memPct', color: '#a855f7', label: 'Memory' },
                  { key: 'diskPct', color: '#f59e0b', label: 'Disk' },
                ]}
                unit="%"
                height={220}
              />
            </div>

            {/* Disk mounts */}
            {latest && latest.disk.length > 0 && (
              <div className="bg-white dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
                <p className="text-xs font-semibold text-slate-400 mb-3">DISK MOUNTS</p>
                <div className="space-y-3">
                  {latest.disk.map(d => (
                    <div key={d.mount}>
                      <ResourceBar label={`${d.mount} (${d.usedGb.toFixed(1)}GB / ${d.totalGb.toFixed(1)}GB)`} value={d.usedPct} />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Agent install snippet */}
            <div className="bg-white dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-semibold text-slate-400">AGENT SETUP</p>
                <button onClick={handleRotateToken} disabled={rotating} className="text-xs text-amber-500 hover:text-amber-600 border border-amber-400/30 px-2 py-1 rounded disabled:opacity-50">
                  {rotating ? 'Rotating…' : 'Rotate token'}
                </button>
              </div>
              {agentToken && (
                <div className="mb-3 p-3 bg-green-500/10 border border-green-500/20 rounded-lg">
                  <p className="text-xs font-semibold text-green-500 mb-1">New token (copy now, shown once):</p>
                  <code className="text-xs font-mono text-green-400 break-all">{agentToken}</code>
                </div>
              )}
              <pre className="bg-slate-900 text-green-400 rounded-lg p-4 text-xs overflow-auto whitespace-pre-wrap">
{`# On your VPS — install Node.js, then:
export MONITOR_URL=${API_BASE.replace('/api', '')}
export AGENT_TOKEN=<your-agent-token>

# Run with PM2:
pm2 start "npx ts-node agent.ts" --name monitor-agent

# See invo-admin-backend/src/agent/README.md for full instructions`}
              </pre>
            </div>

            {/* Alert rules */}
            <div className="bg-white dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-semibold text-slate-400">ALERT RULES</p>
                <button onClick={() => setShowAddRule(true)} className="text-xs bg-primary/10 text-primary px-2 py-1 rounded font-semibold hover:bg-primary hover:text-white transition-all">+ Add rule</button>
              </div>
              {rules.length === 0 ? <p className="text-sm text-slate-400">No rules configured</p> : (
                <div className="space-y-2">
                  {rules.map(r => (
                    <div key={r._id} className="flex items-center justify-between text-sm">
                      <div>
                        <span className="font-medium dark:text-white">{r.name}</span>
                        <span className="ml-2 font-mono text-xs text-slate-400">{r.condition}</span>
                        <span className="ml-2 text-xs text-slate-400">for {r.forMinutes}m</span>
                      </div>
                      <button onClick={() => handleDeleteRule(r._id)} className="text-slate-400 hover:text-red-500 transition-colors">
                        <span className="material-symbols-outlined text-sm">delete</span>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {showAddRule && (
          <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
            <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 w-full max-w-sm shadow-2xl">
              <h3 className="text-lg font-bold dark:text-white mb-4">Add Alert Rule</h3>
              <form onSubmit={handleAddRule} className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Name *</label>
                  <input required value={ruleForm.name} onChange={e => setRuleForm(f => ({ ...f, name: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 dark:bg-slate-700 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Condition</label>
                  <select value={ruleForm.condition} onChange={e => setRuleForm(f => ({ ...f, condition: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 dark:bg-slate-700 dark:text-white text-sm focus:outline-none mb-1">
                    <option value="cpuPct>80">cpuPct &gt; 80</option>
                    <option value="cpuPct>90">cpuPct &gt; 90</option>
                    <option value="memPct>85">memPct &gt; 85</option>
                    <option value="memPct>95">memPct &gt; 95</option>
                    <option value="diskPct>85">diskPct &gt; 85</option>
                    <option value="diskPct>90">diskPct &gt; 90</option>
                    <option value="agentSilent">agentSilent</option>
                  </select>
                  <input value={ruleForm.condition} onChange={e => setRuleForm(f => ({ ...f, condition: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 dark:bg-slate-700 dark:text-white text-sm font-mono focus:outline-none"
                    placeholder="custom: cpuPct>75" />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1">For (min)</label>
                    <input type="number" min={1} value={ruleForm.forMinutes} onChange={e => setRuleForm(f => ({ ...f, forMinutes: parseInt(e.target.value) }))}
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 dark:bg-slate-700 dark:text-white text-sm focus:outline-none" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1">Re-notify (min)</label>
                    <input type="number" min={5} value={ruleForm.renotifyMinutes} onChange={e => setRuleForm(f => ({ ...f, renotifyMinutes: parseInt(e.target.value) }))}
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 dark:bg-slate-700 dark:text-white text-sm focus:outline-none" />
                  </div>
                </div>
                <div className="flex gap-2 justify-end pt-1">
                  <button type="button" onClick={() => setShowAddRule(false)} className="px-4 py-2 rounded-lg text-sm text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700">Cancel</button>
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
