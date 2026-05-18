'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import Header from '@/components/header';
import StatusPill from '@/components/monitoring/StatusPill';
import MetricChart from '@/components/monitoring/MetricChart';
import UptimeBar from '@/components/monitoring/UptimeBar';
import { monitoringApi } from '@/services/api';
import type { MonitorEndpoint, EndpointCheck, UptimeResult, AlertRule } from '@/types/api';

export default function EndpointDetailPage() {
  const { projectId, endpointId } = useParams<{ projectId: string; endpointId: string }>();
  const [endpoint, setEndpoint] = useState<MonitorEndpoint | null>(null);
  const [checks, setChecks] = useState<EndpointCheck[]>([]);
  const [uptime7, setUptime7] = useState<UptimeResult | null>(null);
  const [uptime30, setUptime30] = useState<UptimeResult | null>(null);
  const [rules, setRules] = useState<AlertRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);
  const [showAddRule, setShowAddRule] = useState(false);
  const [ruleForm, setRuleForm] = useState({ name: '', condition: 'down', forMinutes: 5, renotifyMinutes: 60 });
  const [saving, setSaving] = useState(false);

  const load = async () => {
    try {
      const [ep, hist, u7, u30, ruleList] = await Promise.all([
        monitoringApi.listEndpoints('').then(() => null).catch(() => null), // skip
        monitoringApi.getEndpointHistory(endpointId, 24),
        monitoringApi.getEndpointUptime(endpointId, 7),
        monitoringApi.getEndpointUptime(endpointId, 30),
        monitoringApi.listAlertRules({ targetId: endpointId })
      ]);
      setChecks(hist as EndpointCheck[]);
      setUptime7(u7 as UptimeResult);
      setUptime30(u30 as UptimeResult);
      setRules(ruleList as AlertRule[]);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  // Load endpoint detail separately from its history because we don't have a standalone endpoint GET route
  // so we piggyback: get the last check and reconstruct or read from cache
  useEffect(() => {
    // Fetch endpoint via parent environment list would require envId — skip, infer from checks
    load();
  }, [endpointId]);

  const handleCheckNow = async () => {
    setChecking(true);
    try { await monitoringApi.checkNow(endpointId); await load(); }
    catch (err) { alert((err as Error).message); }
    finally { setChecking(false); }
  };

  const handleAddRule = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await monitoringApi.createAlertRule({ ...ruleForm, targetType: 'endpoint', targetId: endpointId, projectId });
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

  const chartData = [...checks].reverse().map(c => ({
    checkedAt: c.checkedAt,
    responseTimeMs: c.responseTimeMs
  }));

  return (
    <div className="flex flex-col h-full">
      <Header title="Endpoint Detail" />
      <main className="flex-1 p-8 overflow-auto">
        <div className="flex items-center gap-2 text-sm text-slate-400 mb-6">
          <Link href="/monitoring" className="hover:text-primary">Monitoring</Link>
          <span>/</span>
          <Link href={`/monitoring/projects/${projectId}`} className="hover:text-primary">Project</Link>
          <span>/</span>
          <span className="dark:text-white font-medium">Endpoint</span>
          <button onClick={handleCheckNow} disabled={checking} className="ml-auto flex items-center gap-1 text-xs bg-primary/10 text-primary px-3 py-1 rounded-lg font-semibold hover:bg-primary hover:text-white disabled:opacity-50 transition-all">
            <span className="material-symbols-outlined text-sm">{checking ? 'hourglass_empty' : 'refresh'}</span>
            {checking ? 'Checking…' : 'Check now'}
          </button>
        </div>

        {loading ? (
          <div className="text-slate-400">Loading…</div>
        ) : (
          <div className="space-y-6">
            {/* Stats row */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: '7d uptime', value: uptime7 ? `${uptime7.uptimePct.toFixed(2)}%` : '—', ok: (uptime7?.uptimePct ?? 100) >= 99 },
                { label: '30d uptime', value: uptime30 ? `${uptime30.uptimePct.toFixed(2)}%` : '—', ok: (uptime30?.uptimePct ?? 100) >= 99 },
                { label: 'Avg response', value: uptime7 ? `${Math.round(uptime7.avgResponseTimeMs)}ms` : '—', ok: true },
                { label: 'Incidents (7d)', value: String(uptime7?.downCount ?? 0), ok: (uptime7?.downCount ?? 0) === 0 },
              ].map(s => (
                <div key={s.label} className="bg-white dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
                  <p className="text-xs text-slate-400 mb-1">{s.label}</p>
                  <p className={`text-xl font-bold ${s.ok ? 'text-green-500' : 'text-red-500'}`}>{s.value}</p>
                </div>
              ))}
            </div>

            {/* 7d uptime bar */}
            {uptime7 && (
              <div className="bg-white dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
                <p className="text-xs font-semibold text-slate-400 mb-3">UPTIME — LAST 7 DAYS</p>
                <UptimeBar timeline={uptime7.timeline} days={7} />
              </div>
            )}

            {/* Response time chart */}
            <div className="bg-white dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
              <p className="text-xs font-semibold text-slate-400 mb-3">RESPONSE TIME — LAST 24H</p>
              <MetricChart
                data={chartData}
                xKey="checkedAt"
                lines={[{ key: 'responseTimeMs', color: '#3b82f6', label: 'Response time' }]}
                unit="ms"
                domain={[0, 'auto']}
              />
            </div>

            {/* Recent checks log */}
            <div className="bg-white dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
              <p className="text-xs font-semibold text-slate-400 mb-3">RECENT CHECKS</p>
              <div className="overflow-auto max-h-72">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-slate-100 dark:border-slate-700">
                      <th className="text-left py-2 px-2 text-slate-400 font-semibold">Time</th>
                      <th className="text-center py-2 px-2 text-slate-400 font-semibold">Status</th>
                      <th className="text-right py-2 px-2 text-slate-400 font-semibold">HTTP</th>
                      <th className="text-right py-2 px-2 text-slate-400 font-semibold">Time</th>
                      <th className="text-left py-2 px-2 text-slate-400 font-semibold">Error</th>
                    </tr>
                  </thead>
                  <tbody>
                    {checks.slice(0, 50).map(c => (
                      <tr key={c._id} className="border-b border-slate-50 dark:border-slate-700/40 last:border-0">
                        <td className="py-1.5 px-2 text-slate-400">{new Date(c.checkedAt).toLocaleTimeString()}</td>
                        <td className="py-1.5 px-2 text-center"><StatusPill status={c.status} /></td>
                        <td className="py-1.5 px-2 text-right text-slate-500">{c.httpStatus ?? '—'}</td>
                        <td className="py-1.5 px-2 text-right text-slate-500">{c.responseTimeMs != null ? `${c.responseTimeMs}ms` : '—'}</td>
                        <td className="py-1.5 px-2 text-red-400 max-w-[200px] truncate">{c.error ?? ''}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
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
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 dark:bg-slate-700 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                    placeholder="Down alert" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Condition</label>
                  <select value={ruleForm.condition} onChange={e => setRuleForm(f => ({ ...f, condition: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 dark:bg-slate-700 dark:text-white text-sm focus:outline-none">
                    <option value="down">down</option>
                    <option value="responseTimeMs>2000">responseTimeMs &gt; 2000</option>
                    <option value="responseTimeMs>5000">responseTimeMs &gt; 5000</option>
                  </select>
                  <input value={ruleForm.condition} onChange={e => setRuleForm(f => ({ ...f, condition: e.target.value }))}
                    className="mt-1 w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 dark:bg-slate-700 dark:text-white text-sm font-mono focus:outline-none"
                    placeholder="or type custom: responseTimeMs>3000" />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1">For (minutes)</label>
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
