'use client';

interface ResourceBarProps {
  label: string;
  value: number;
  max?: number;
  unit?: string;
}

const getBarColor = (pct: number) => {
  if (pct >= 90) return 'bg-red-500';
  if (pct >= 75) return 'bg-yellow-400';
  return 'bg-green-500';
};

export default function ResourceBar({ label, value, unit = '%' }: ResourceBarProps) {
  const pct = Math.min(100, Math.max(0, value));
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="text-slate-500 dark:text-slate-400">{label}</span>
        <span className="font-semibold dark:text-white">{pct.toFixed(1)}{unit}</span>
      </div>
      <div className="h-2 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${getBarColor(pct)}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
