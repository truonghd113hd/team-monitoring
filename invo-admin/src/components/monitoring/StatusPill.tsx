'use client';

type Status = 'up' | 'down' | 'degraded' | 'unknown' | 'firing' | 'recovered';

const config: Record<Status, { bg: string; text: string; dot: string; label: string }> = {
  up:        { bg: 'bg-green-500/10',  text: 'text-green-500',  dot: 'bg-green-500',  label: 'UP' },
  down:      { bg: 'bg-red-500/10',    text: 'text-red-500',    dot: 'bg-red-500',    label: 'DOWN' },
  degraded:  { bg: 'bg-yellow-500/10', text: 'text-yellow-500', dot: 'bg-yellow-500', label: 'DEGRADED' },
  unknown:   { bg: 'bg-slate-500/10',  text: 'text-slate-400',  dot: 'bg-slate-400',  label: 'UNKNOWN' },
  firing:    { bg: 'bg-red-500/10',    text: 'text-red-500',    dot: 'bg-red-500',    label: 'FIRING' },
  recovered: { bg: 'bg-green-500/10',  text: 'text-green-500',  dot: 'bg-green-500',  label: 'OK' },
};

interface StatusPillProps {
  status: Status;
  label?: string;
  pulse?: boolean;
}

export default function StatusPill({ status, label, pulse }: StatusPillProps) {
  const c = config[status] ?? config.unknown;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${c.bg} ${c.text} border-current/20`}>
      <span className={`w-1.5 h-1.5 rounded-full ${c.dot} ${pulse && (status === 'down' || status === 'firing') ? 'animate-pulse' : ''}`} />
      {label ?? c.label}
    </span>
  );
}
