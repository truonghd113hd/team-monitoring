/**
 * Lightweight monitoring agent — deploy on each VPS and run with:
 *   node agent.js
 * Env vars required:
 *   MONITOR_URL   — base URL of the monitoring backend, e.g. https://dashboard.example.com
 *   AGENT_TOKEN   — token shown in the dashboard when adding a host
 */

import * as os from 'os';
import * as fs from 'fs';
import * as https from 'https';
import * as http from 'http';
import { execSync } from 'child_process';

const MONITOR_URL = process.env.MONITOR_URL || '';
const AGENT_TOKEN = process.env.AGENT_TOKEN || '';
const INTERVAL_MS = 60_000;

if (!MONITOR_URL || !AGENT_TOKEN) {
  console.error('[AGENT] MONITOR_URL and AGENT_TOKEN must be set');
  process.exit(1);
}

// ── CPU tracking ──────────────────────────────────────────────────────────────

let prevCpuTotal = 0;
let prevCpuIdle = 0;

const getCpuPct = (): number => {
  const cpus = os.cpus();
  let total = 0, idle = 0;
  for (const cpu of cpus) {
    const t = cpu.times;
    total += t.user + t.nice + t.sys + t.irq + t.idle;
    idle += t.idle;
  }
  const totalDelta = total - prevCpuTotal;
  const idleDelta = idle - prevCpuIdle;
  prevCpuTotal = total;
  prevCpuIdle = idle;
  if (totalDelta === 0) return 0;
  return Math.max(0, Math.min(100, ((totalDelta - idleDelta) / totalDelta) * 100));
};

// ── Disk ──────────────────────────────────────────────────────────────────────

interface DiskEntry {
  mount: string;
  usedPct: number;
  usedGb: number;
  totalGb: number;
}

const getDisk = (): DiskEntry[] => {
  try {
    const out = execSync(
      'df -k --output=target,used,size -x tmpfs -x devtmpfs 2>/dev/null || df -k',
      { timeout: 5000 }
    ).toString();
    return out.trim().split('\n').slice(1).flatMap(line => {
      const parts = line.trim().split(/\s+/);
      if (parts.length < 3) return [];
      const mount = parts[0];
      const used1K = parseInt(parts[1], 10);
      const size1K = parseInt(parts[2], 10);
      if (!Number.isFinite(used1K) || !Number.isFinite(size1K) || size1K === 0) return [];
      return [{ mount, usedPct: (used1K / size1K) * 100, usedGb: used1K / 1048576, totalGb: size1K / 1048576 }];
    });
  } catch {
    return [];
  }
};

// ── Network I/O ───────────────────────────────────────────────────────────────

interface NetTotals { rx: number; tx: number; ts: number }
let prevNet: NetTotals = { rx: 0, tx: 0, ts: Date.now() };

const readNetTotals = (): { rx: number; tx: number } => {
  try {
    const content = fs.readFileSync('/proc/net/dev', 'utf-8');
    let totalRx = 0, totalTx = 0;
    for (const line of content.trim().split('\n').slice(2)) {
      const colonIdx = line.indexOf(':');
      if (colonIdx < 0) continue;
      const iface = line.substring(0, colonIdx).trim();
      if (!iface || iface === 'lo') continue;
      const parts = line.substring(colonIdx + 1).trim().split(/\s+/);
      totalRx += parseInt(parts[0], 10) || 0;
      totalTx += parseInt(parts[8], 10) || 0;
    }
    return { rx: totalRx, tx: totalTx };
  } catch {
    return { rx: 0, tx: 0 };
  }
};

const getNetBytesPerSec = (): { netRxBytesPerSec: number | null; netTxBytesPerSec: number | null } => {
  try {
    const cur = readNetTotals();
    const elapsed = (Date.now() - prevNet.ts) / 1000;
    const rx = elapsed > 0 ? Math.max(0, (cur.rx - prevNet.rx) / elapsed) : null;
    const tx = elapsed > 0 ? Math.max(0, (cur.tx - prevNet.tx) / elapsed) : null;
    prevNet = { ...cur, ts: Date.now() };
    return { netRxBytesPerSec: rx, netTxBytesPerSec: tx };
  } catch {
    return { netRxBytesPerSec: null, netTxBytesPerSec: null };
  }
};

// ── HTTP push ─────────────────────────────────────────────────────────────────

const post = (url: string, body: string, token: string): Promise<void> =>
  new Promise((resolve, reject) => {
    const u = new URL(url);
    const isHttps = u.protocol === 'https:';
    const options = {
      hostname: u.hostname,
      port: u.port ? parseInt(u.port, 10) : (isHttps ? 443 : 80),
      path: u.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
        Authorization: `Bearer ${token}`
      }
    };
    const req = (isHttps ? https : http).request(options, res => {
      res.resume();
      if (res.statusCode && res.statusCode >= 400) reject(new Error(`HTTP ${res.statusCode}`));
      else resolve();
    });
    req.on('error', reject);
    req.setTimeout(10_000, () => { req.destroy(); reject(new Error('timeout')); });
    req.write(body);
    req.end();
  });

// ── Report loop ───────────────────────────────────────────────────────────────

const report = async () => {
  try {
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;
    const payload = {
      cpuPct: getCpuPct(),
      memPct: (usedMem / totalMem) * 100,
      memUsedMb: usedMem / 1048576,
      memTotalMb: totalMem / 1048576,
      disk: getDisk(),
      loadAvg: os.loadavg(),
      uptimeSec: os.uptime(),
      ...getNetBytesPerSec()
    };
    await post(`${MONITOR_URL}/api/agent/metrics`, JSON.stringify(payload), AGENT_TOKEN);
    console.log(`[AGENT] Reported at ${new Date().toISOString()}`);
  } catch (err) {
    console.error('[AGENT] Report failed:', (err as Error).message);
  }
};

// Warm up CPU and network deltas so the first real sample has a valid baseline
getCpuPct();
prevNet = { ...readNetTotals(), ts: Date.now() };
setTimeout(() => {
  report();
  setInterval(report, INTERVAL_MS);
}, 1000);
