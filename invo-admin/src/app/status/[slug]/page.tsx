import UptimeBar from '@/components/monitoring/UptimeBar';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

async function getStatusData(slug: string) {
  try {
    const res = await fetch(`${API_BASE}/public/status/${slug}`, { next: { revalidate: 60 } });
    if (!res.ok) return null;
    const json = await res.json();
    return json.data;
  } catch {
    return null;
  }
}

const statusColor: Record<string, string> = {
  up: 'bg-green-500',
  down: 'bg-red-500',
  degraded: 'bg-yellow-400',
  unknown: 'bg-slate-300 dark:bg-slate-600'
};

const statusLabel: Record<string, string> = {
  up: 'Operational',
  down: 'Down',
  degraded: 'Degraded',
  unknown: 'No data'
};

export default async function PublicStatusPage({ params }: { params: { slug: string } }) {
  const data = await getStatusData(params.slug);

  if (!data) {
    return (
      <main className="min-h-screen bg-slate-50 dark:bg-slate-900 flex items-center justify-center p-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold dark:text-white mb-2">Status page not found</h1>
          <p className="text-slate-400">This project does not have a public status page.</p>
        </div>
      </main>
    );
  }

  const allUp = data.environments.every((env: any) =>
    env.endpoints.every((ep: any) => ep.lastStatus === 'up' || ep.lastStatus === 'unknown') &&
    env.firingAlerts.length === 0
  );

  return (
    <main className="min-h-screen bg-slate-50 dark:bg-slate-900 py-12 px-4">
      <div className="max-w-3xl mx-auto space-y-8">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-3xl font-bold dark:text-white">{data.project.name}</h1>
          {data.project.description && (
            <p className="text-slate-500 mt-2">{data.project.description}</p>
          )}
          <div className={`inline-flex items-center gap-2 mt-4 px-4 py-2 rounded-full text-sm font-semibold ${allUp ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'}`}>
            <span className={`w-2 h-2 rounded-full ${allUp ? 'bg-green-500' : 'bg-red-500 animate-pulse'}`} />
            {allUp ? 'All systems operational' : 'Some systems are experiencing issues'}
          </div>
        </div>

        {/* Environments */}
        {data.environments.map((env: any) => (
          <section key={env._id} className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
            <div className="flex items-center gap-3 px-6 py-4 border-b border-slate-100 dark:border-slate-700">
              <span className="w-3 h-3 rounded-full" style={{ backgroundColor: env.color }} />
              <h2 className="font-bold dark:text-white capitalize">{env.name}</h2>
              {env.firingAlerts.length > 0 && (
                <span className="ml-auto bg-red-500/10 text-red-500 text-xs px-2 py-0.5 rounded-full font-bold">
                  {env.firingAlerts.length} alert{env.firingAlerts.length > 1 ? 's' : ''}
                </span>
              )}
            </div>

            <div className="divide-y divide-slate-50 dark:divide-slate-700/50">
              {env.endpoints.length === 0 ? (
                <p className="px-6 py-4 text-sm text-slate-400">No endpoints configured</p>
              ) : env.endpoints.map((ep: any) => (
                <div key={ep._id} className="px-6 py-4">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <span className="font-medium dark:text-white">{ep.name}</span>
                      <span className="ml-2 text-xs text-slate-400 font-mono">{ep.url}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      {ep.lastResponseTimeMs != null && (
                        <span className="text-xs text-slate-400">{ep.lastResponseTimeMs}ms</span>
                      )}
                      <div className="flex items-center gap-1.5">
                        <span className={`w-2.5 h-2.5 rounded-full ${statusColor[ep.lastStatus] ?? statusColor.unknown} ${ep.lastStatus === 'down' ? 'animate-pulse' : ''}`} />
                        <span className="text-xs font-semibold dark:text-white">
                          {statusLabel[ep.lastStatus] ?? 'Unknown'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* 90-day uptime bar */}
                  {ep.timeline90d && ep.timeline90d.length > 0 && (
                    <div>
                      <div className="flex items-center justify-between text-[10px] text-slate-400 mb-1">
                        <span>90 days ago</span>
                        <span className="font-semibold">{ep.uptimePct90d?.toFixed(2) ?? '—'}% uptime</span>
                        <span>Today</span>
                      </div>
                      <UptimeBar timeline={ep.timeline90d} days={90} />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>
        ))}

        <p className="text-center text-xs text-slate-400">
          Last updated {new Date(data.generatedAt).toLocaleString()}
        </p>
      </div>
    </main>
  );
}
