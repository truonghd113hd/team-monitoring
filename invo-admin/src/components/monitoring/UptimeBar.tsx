'use client';

interface UptimeBarProps {
  timeline: Array<{ date: string; uptimePct: number; totalChecks: number }>;
  days?: number;
}

const getColor = (pct: number, total: number) => {
  if (total === 0) return 'bg-slate-200 dark:bg-slate-700';
  if (pct >= 99) return 'bg-green-500';
  if (pct >= 95) return 'bg-yellow-400';
  return 'bg-red-500';
};

export default function UptimeBar({ timeline, days = 90 }: UptimeBarProps) {
  const cells = timeline.slice(-days);
  return (
    <div className="flex items-center gap-0.5">
      {cells.map(cell => (
        <div
          key={cell.date}
          title={`${cell.date}: ${cell.totalChecks === 0 ? 'No data' : `${cell.uptimePct.toFixed(2)}% uptime`}`}
          className={`h-5 flex-1 min-w-[3px] rounded-sm ${getColor(cell.uptimePct, cell.totalChecks)}`}
        />
      ))}
    </div>
  );
}
