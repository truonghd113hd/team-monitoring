'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import Header from '@/components/header';
import StatusPill from '@/components/monitoring/StatusPill';
import MetricChart from '@/components/monitoring/MetricChart';
import UptimeBar from '@/components/monitoring/UptimeBar';
import { monitoringApi } from '@/services/api';
import { useSocket } from '@/contexts/SocketContext';
import type { MonitorEndpoint, EndpointCheck, UptimeResult, AlertRule, AlertEvent, HealthCheckBody, HealthCheckServiceStatus, MonitorHost } from '@/types/api';

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
  const [ruleForm, setRuleForm] = useState({
    name: '', condition: 'down', forMinutes: 5, renotifyMinutes: 60,
    restartOnFire: false, restartHostId: '', restartPm2Process: ''
  });
  const [saving, setSaving] = useState(false);
  const [hosts, setHosts] = useState<MonitorHost[]>([]);
  const [checksPage, setChecksPage] = useState(0);
  const [checksTotal, setChecksTotal] = useState(0);
  const CHECKS_PER_PAGE = 20;
  const checksPageRef = useRef(0);
  const [alertEvents, setAlertEvents] = useState<AlertEvent[]>([]);
  const [alertEventsPage, setAlertEventsPage] = useState(0);
  const [alertEventsTotal, setAlertEventsTotal] = useState(0);
  const ALERT_EVENTS_PER_PAGE = 20;
  const { socket } = useSocket();

  const loadAlertEvents = async (page: number) => {
    try {
      const res = await monitoringApi.getAlertEventHistory(endpointId, page, ALERT_EVENTS_PER_PAGE);
      setAlertEvents(res.data as AlertEvent[]);
      setAlertEventsTotal(res.total);
    } catch (err) { console.error(err); }
  };

  const loadChecks = async (page: number) => {
    try {
      const res = await monitoringApi.getEndpointHistory(endpointId, 24, page);
      setChecks(res.data as EndpointCheck[]);
      setChecksTotal(res.total);
    } catch (err) { console.error(err); }
  };

  const load = async () => {
    try {
      const [hist, u7, u30, ruleList, hostList, events] = await Promise.all([
        monitoringApi.getEndpointHistory(endpointId, 24, 0),
        monitoringApi.getEndpointUptime(endpointId, 7),
        monitoringApi.getEndpointUptime(endpointId, 30),
        monitoringApi.listAlertRules({ targetId: endpointId }),
        monitoringApi.listHostsByProject(projectId),
        monitoringApi.getAlertEventHistory(endpointId, 0, ALERT_EVENTS_PER_PAGE)
      ]);
      setChecks(hist.data as EndpointCheck[]);
      setChecksTotal(hist.total);
      setUptime7(u7 as UptimeResult);
      setUptime30(u30 as UptimeResult);
      setRules(ruleList as AlertRule[]);
      setHosts(hostList as MonitorHost[]);
      setAlertEvents(events.data as AlertEvent[]);
      setAlertEventsTotal(events.total);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  useEffect(() => { checksPageRef.current = checksPage; }, [checksPage]);

  useEffect(() => { load(); setChecksPage(0); setAlertEventsPage(0); }, [endpointId]);

  useEffect(() => {
    if (!socket) return;
    const onEndpointUpdated = (data: {
      _id: string;
      lastStatus: string;
      lastResponseTimeMs: number | null;
      lastCheckedAt: string;
      check?: Omit<EndpointCheck, '_id'> & { _id: null };
    }) => {
      if (data._id !== endpointId) return;
      setChecksTotal(prev => prev + 1);
      // Only inject into the visible list when viewing page 0
      if (checksPageRef.current === 0 && data.check) {
        const newCheck: EndpointCheck = {
          ...data.check,
          _id: `ws-${Date.now()}`,
          checkedAt: new Date(data.lastCheckedAt)
        };
        setChecks(prev => [newCheck, ...prev].slice(0, CHECKS_PER_PAGE));
      }
    };
    socket.on('endpoint:updated', onEndpointUpdated);
    return () => { socket.off('endpoint:updated', onEndpointUpdated); };
  }, [socket, endpointId]);

  useEffect(() => {
    if (!socket) return;
    const onAlertEvent = (data: { targetId: string }) => {
      if (data.targetId !== endpointId) return;
      if (alertEventsPage === 0) loadAlertEvents(0);
      else setAlertEventsTotal(prev => prev + 1);
    };
    socket.on('alert:event', onAlertEvent);
    return () => { socket.off('alert:event', onAlertEvent); };
  }, [socket, endpointId, alertEventsPage]);

  const handleCheckNow = async () => {
    setChecking(true);
    try {
      await monitoringApi.checkNow(endpointId);
      setChecksPage(0);
      await load();
    }
    catch (err) { alert((err as Error).message); }
    finally { setChecking(false); }
  };

  const handleAddRule = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await monitoringApi.createAlertRule({
        ...ruleForm,
        restartHostId: ruleForm.restartOnFire ? ruleForm.restartHostId || null : null,
        restartPm2Process: ruleForm.restartOnFire ? ruleForm.restartPm2Process || null : null,
        targetType: 'endpoint', targetId: endpointId, projectId
      });
      setShowAddRule(false);
      setRuleForm({ name: '', condition: 'down', forMinutes: 5, renotifyMinutes: 60, restartOnFire: false, restartHostId: '', restartPm2Process: '' });
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

  const isHealthBody = (b: Record<string, unknown> | null): boolean =>
    !!b && ('status' in b) && ('services' in b || 'system' in b);

  const latestHealthBody = checks.length > 0 && isHealthBody(checks[0].responseBody)
    ? checks[0].responseBody as unknown as HealthCheckBody
    : null;

  const serviceStatusColor = (s: HealthCheckServiceStatus) => {
    if (s.status === 'ok') return 'text-green-500';
    if (s.status === 'degraded') return 'text-amber-500';
    return 'text-red-500';
  };

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

            {/* Health check details (parsed from response body) */}
            {latestHealthBody && (
              <div className="bg-white dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
                <p className="text-xs font-semibold text-slate-400 mb-3">HEALTH CHECK DETAILS</p>

                {/* System metrics */}
                {latestHealthBody.system && (
                  <div className="grid grid-cols-3 gap-3 mb-4">
                    {latestHealthBody.system.cpuLoad1m != null && (
                      <div className="bg-slate-50 dark:bg-slate-700/50 rounded-lg p-3">
                        <p className="text-xs text-slate-400">CPU Load 1m</p>
                        <p className="text-lg font-bold dark:text-white">{latestHealthBody.system.cpuLoad1m.toFixed(2)}</p>
                      </div>
                    )}
                    {latestHealthBody.system.memoryUsedPct != null && (
                      <div className="bg-slate-50 dark:bg-slate-700/50 rounded-lg p-3">
                        <p className="text-xs text-slate-400">Memory</p>
                        <p className="text-lg font-bold dark:text-white">{latestHealthBody.system.memoryUsedPct}%</p>
                      </div>
                    )}
                    {latestHealthBody.system.diskUsedPct != null && (
                      <div className="bg-slate-50 dark:bg-slate-700/50 rounded-lg p-3">
                        <p className="text-xs text-slate-400">Disk</p>
                        <p className="text-lg font-bold dark:text-white">{latestHealthBody.system.diskUsedPct}%</p>
                      </div>
                    )}
                  </div>
                )}

                {/* Services */}
                {latestHealthBody.services && Object.keys(latestHealthBody.services).length > 0 && (
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-slate-100 dark:border-slate-700">
                        <th className="text-left py-2 px-2 text-slate-400 font-semibold">Service</th>
                        <th className="text-center py-2 px-2 text-slate-400 font-semibold">Status</th>
                        <th className="text-right py-2 px-2 text-slate-400 font-semibold">Response</th>
                        <th className="text-left py-2 px-2 text-slate-400 font-semibold">Error</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(latestHealthBody.services).map(([name, svc]) => (
                        <tr key={name} className="border-b border-slate-50 dark:border-slate-700/40 last:border-0">
                          <td className="py-1.5 px-2 font-medium dark:text-white capitalize">{name}</td>
                          <td className="py-1.5 px-2 text-center">
                            <span className={`font-semibold uppercase ${serviceStatusColor(svc)}`}>{svc.status}</span>
                          </td>
                          <td className="py-1.5 px-2 text-right text-slate-500">
                            {svc.responseTimeMs != null ? `${svc.responseTimeMs}ms` : '—'}
                          </td>
                          <td className="py-1.5 px-2 text-red-400 max-w-[180px] truncate">{svc.error ?? ''}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}

                {latestHealthBody.uptimeSeconds != null && (
                  <p className="text-xs text-slate-400 mt-3">
                    Uptime: <span className="font-medium dark:text-white">{Math.floor(latestHealthBody.uptimeSeconds / 3600)}h {Math.floor((latestHealthBody.uptimeSeconds % 3600) / 60)}m</span>
                    {latestHealthBody.timestamp && (
                      <span className="ml-3">Sampled: {new Date(latestHealthBody.timestamp).toLocaleTimeString()}</span>
                    )}
                  </p>
                )}
              </div>
            )}

            {/* Recent checks log */}
            <div className="bg-white dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-semibold text-slate-400">
                  RECENT CHECKS
                  <span className="ml-2 font-normal">({checksTotal} total)</span>
                </p>
                <div className="flex items-center gap-2 text-xs text-slate-400">
                  <span>Page {checksPage + 1} / {Math.max(1, Math.ceil(checksTotal / CHECKS_PER_PAGE))}</span>
                  <button
                    onClick={() => { const p = checksPage - 1; setChecksPage(p); loadChecks(p); }}
                    disabled={checksPage === 0}
                    className="px-2 py-0.5 rounded border border-slate-200 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-30 transition-colors"
                  >‹</button>
                  <button
                    onClick={() => { const p = checksPage + 1; setChecksPage(p); loadChecks(p); }}
                    disabled={(checksPage + 1) * CHECKS_PER_PAGE >= checksTotal}
                    className="px-2 py-0.5 rounded border border-slate-200 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-30 transition-colors"
                  >›</button>
                </div>
              </div>
              <div className="overflow-y-auto" style={{ maxHeight: '26rem' }}>
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-white dark:bg-slate-800 z-10">
                    <tr className="border-b border-slate-100 dark:border-slate-700">
                      <th className="text-left py-2 px-2 text-slate-400 font-semibold">Time</th>
                      <th className="text-center py-2 px-2 text-slate-400 font-semibold">Status</th>
                      <th className="text-right py-2 px-2 text-slate-400 font-semibold">HTTP</th>
                      <th className="text-right py-2 px-2 text-slate-400 font-semibold">Response</th>
                      <th className="text-left py-2 px-2 text-slate-400 font-semibold">Error</th>
                    </tr>
                  </thead>
                  <tbody>
                    {checks.map(c => (
                      <tr key={c._id} className="border-b border-slate-50 dark:border-slate-700/40 last:border-0">
                        <td className="py-2 px-2 text-slate-400 whitespace-nowrap">{new Date(c.checkedAt).toLocaleString()}</td>
                        <td className="py-2 px-2 text-center"><StatusPill status={c.status} /></td>
                        <td className="py-2 px-2 text-right text-slate-500">{c.httpStatus ?? '—'}</td>
                        <td className="py-2 px-2 text-right text-slate-500">{c.responseTimeMs != null ? `${c.responseTimeMs}ms` : '—'}</td>
                        <td className="py-2 px-2 text-red-400 max-w-[200px] truncate">{c.error ?? ''}</td>
                      </tr>
                    ))}
                    {checks.length === 0 && (
                      <tr><td colSpan={5} className="py-6 text-center text-slate-400">No checks yet</td></tr>
                    )}
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
                        {r.restartOnFire && r.restartPm2Process && (
                          <span className="ml-2 text-xs text-amber-500">
                            <span className="material-symbols-outlined text-xs align-middle">restart_alt</span> {r.restartPm2Process}
                          </span>
                        )}
                      </div>
                      <button onClick={() => handleDeleteRule(r._id)} className="text-slate-400 hover:text-red-500 transition-colors">
                        <span className="material-symbols-outlined text-sm">delete</span>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Alert history */}
            <div className="bg-white dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-semibold text-slate-400">
                  ALERT HISTORY
                  <span className="ml-2 font-normal">({alertEventsTotal} total)</span>
                </p>
                <div className="flex items-center gap-2 text-xs text-slate-400">
                  <span>Page {alertEventsPage + 1} / {Math.max(1, Math.ceil(alertEventsTotal / ALERT_EVENTS_PER_PAGE))}</span>
                  <button
                    onClick={() => { const p = alertEventsPage - 1; setAlertEventsPage(p); loadAlertEvents(p); }}
                    disabled={alertEventsPage === 0}
                    className="px-2 py-0.5 rounded border border-slate-200 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-30 transition-colors"
                  >‹</button>
                  <button
                    onClick={() => { const p = alertEventsPage + 1; setAlertEventsPage(p); loadAlertEvents(p); }}
                    disabled={(alertEventsPage + 1) * ALERT_EVENTS_PER_PAGE >= alertEventsTotal}
                    className="px-2 py-0.5 rounded border border-slate-200 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-30 transition-colors"
                  >›</button>
                </div>
              </div>
              <div className="overflow-y-auto" style={{ maxHeight: '26rem' }}>
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-white dark:bg-slate-800 z-10">
                    <tr className="border-b border-slate-100 dark:border-slate-700">
                      <th className="text-left py-2 px-2 text-slate-400 font-semibold">Fired</th>
                      <th className="text-center py-2 px-2 text-slate-400 font-semibold">State</th>
                      <th className="text-left py-2 px-2 text-slate-400 font-semibold">Message</th>
                      <th className="text-left py-2 px-2 text-slate-400 font-semibold">Recovered</th>
                    </tr>
                  </thead>
                  <tbody>
                    {alertEvents.map(ev => (
                      <tr key={ev._id} className="border-b border-slate-50 dark:border-slate-700/40 last:border-0">
                        <td className="py-2 px-2 text-slate-400 whitespace-nowrap">{new Date(ev.firedAt).toLocaleString()}</td>
                        <td className="py-2 px-2 text-center">
                          <span className={`font-semibold uppercase text-xs ${ev.state === 'firing' ? 'text-red-500' : 'text-green-500'}`}>{ev.state}</span>
                        </td>
                        <td className="py-2 px-2 text-slate-500 max-w-[320px] truncate">{ev.message}</td>
                        <td className="py-2 px-2 text-slate-400 whitespace-nowrap">{ev.recoveredAt ? new Date(ev.recoveredAt).toLocaleString() : '—'}</td>
                      </tr>
                    ))}
                    {alertEvents.length === 0 && (
                      <tr><td colSpan={4} className="py-6 text-center text-slate-400">No alert events yet</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
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
                    <option value="5xx">5xx (HTTP 500+)</option>
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
                <div className="pt-1 border-t border-slate-100 dark:border-slate-700">
                  <label className="flex items-center gap-2 text-xs font-semibold text-slate-500 mb-2 mt-2 cursor-pointer">
                    <input type="checkbox" checked={ruleForm.restartOnFire} onChange={e => setRuleForm(f => ({ ...f, restartOnFire: e.target.checked }))}
                      className="rounded border-slate-300" />
                    Restart pm2 process via SSH when firing
                  </label>
                  {ruleForm.restartOnFire && (
                    <div className="space-y-2">
                      <div>
                        <label className="block text-xs font-semibold text-slate-500 mb-1">Host</label>
                        <select required value={ruleForm.restartHostId} onChange={e => setRuleForm(f => ({ ...f, restartHostId: e.target.value }))}
                          className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 dark:bg-slate-700 dark:text-white text-sm focus:outline-none">
                          <option value="">Select a host…</option>
                          {hosts.map(h => <option key={h._id} value={h._id}>{h.name}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-500 mb-1">pm2 process name</label>
                        <input required value={ruleForm.restartPm2Process} onChange={e => setRuleForm(f => ({ ...f, restartPm2Process: e.target.value }))}
                          className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 dark:bg-slate-700 dark:text-white text-sm font-mono focus:outline-none"
                          placeholder="api-server" />
                      </div>
                    </div>
                  )}
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
