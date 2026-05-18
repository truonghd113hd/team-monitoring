'use client';

import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid
} from 'recharts';

interface MetricChartProps {
  data: Array<Record<string, any>>;
  xKey: string;
  lines: Array<{ key: string; color: string; label: string }>;
  unit?: string;
  height?: number;
  domain?: [number | 'auto', number | 'auto'];
}

const formatTime = (val: string) => {
  try {
    const d = new Date(val);
    return `${d.getHours().toString().padStart(2,'0')}:${d.getMinutes().toString().padStart(2,'0')}`;
  } catch {
    return val;
  }
};

export default function MetricChart({ data, xKey, lines, unit = '%', height = 200, domain = [0, 100] }: MetricChartProps) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 4, right: 8, left: -16, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-slate-200 dark:text-slate-700 opacity-40" />
        <XAxis dataKey={xKey} tickFormatter={formatTime} tick={{ fontSize: 10 }} stroke="currentColor" className="text-slate-400" />
        <YAxis domain={domain} tickFormatter={v => `${v}${unit}`} tick={{ fontSize: 10 }} stroke="currentColor" className="text-slate-400" />
        <Tooltip
          contentStyle={{ fontSize: 12, background: 'var(--tooltip-bg, #1e293b)', border: 'none', borderRadius: 8, color: '#e2e8f0' }}
          formatter={(val: any, name: string) => [`${typeof val === 'number' ? val.toFixed(1) : val}${unit}`, name]}
          labelFormatter={(label) => {
            try { return new Date(label).toLocaleTimeString(); } catch { return label; }
          }}
        />
        {lines.map(l => (
          <Line
            key={l.key}
            type="monotone"
            dataKey={l.key}
            name={l.label}
            stroke={l.color}
            dot={false}
            strokeWidth={2}
            connectNulls
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}
