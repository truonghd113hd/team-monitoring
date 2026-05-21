import Host, { IHost } from '../models/Host';
import HostMetric, { IDiskUsage } from '../models/HostMetric';
import { emit } from './wsService';

export interface RawMetricInput {
  cpuPct: number;
  memPct: number;
  memUsedMb: number;
  memTotalMb: number;
  disk: IDiskUsage[];
  loadAvg: number[];
  uptimeSec: number;
  netRxBytesPerSec: number | null;
  netTxBytesPerSec: number | null;
}

/**
 * Persist a metric sample and update the host's denormalized snapshot.
 */
export const recordMetric = async (
  hostId: string,
  source: 'agent' | 'ssh',
  raw: RawMetricInput
): Promise<void> => {
  await HostMetric.create({ hostId, sampledAt: new Date(), source, ...raw });
  const maxDiskPct = raw.disk.length > 0 ? Math.max(...raw.disk.map(d => d.usedPct)) : 0;
  const sampledAt = new Date();
  await Host.updateOne(
    { _id: hostId },
    {
      $set: {
        lastSampledAt: sampledAt,
        lastCpuPct: raw.cpuPct,
        lastMemPct: raw.memPct,
        lastDiskPct: maxDiskPct,
        lastNetRxBytesPerSec: raw.netRxBytesPerSec,
        lastNetTxBytesPerSec: raw.netTxBytesPerSec
      }
    }
  );
  const host = await Host.findById(hostId).select('environmentId').lean();
  emit('host:updated', {
    _id: hostId,
    environmentId: host ? String(host.environmentId) : undefined,
    lastCpuPct: raw.cpuPct,
    lastMemPct: raw.memPct,
    lastDiskPct: maxDiskPct,
    lastNetRxBytesPerSec: raw.netRxBytesPerSec,
    lastNetTxBytesPerSec: raw.netTxBytesPerSec,
    lastSampledAt: sampledAt
  });
};

// ── /proc/net/dev parser ──────────────────────────────────────────────────────

interface NetSample {
  [iface: string]: { rx: number; tx: number };
}

const parseNetDev = (lines: string[]): NetSample => {
  const result: NetSample = {};
  for (const line of lines) {
    const colonIdx = line.indexOf(':');
    if (colonIdx < 0) continue;
    const iface = line.substring(0, colonIdx).trim();
    if (!iface || iface === 'lo') continue;
    const parts = line.substring(colonIdx + 1).trim().split(/\s+/);
    const rx = parseInt(parts[0], 10);
    const tx = parseInt(parts[8], 10);
    if (Number.isFinite(rx) && Number.isFinite(tx)) {
      result[iface] = { rx, tx };
    }
  }
  return result;
};

const netDeltaBytesPerSec = (s1: NetSample, s2: NetSample, elapsedSec: number): { rx: number; tx: number } => {
  let totalRx1 = 0, totalTx1 = 0, totalRx2 = 0, totalTx2 = 0;
  for (const v of Object.values(s1)) { totalRx1 += v.rx; totalTx1 += v.tx; }
  for (const v of Object.values(s2)) { totalRx2 += v.rx; totalTx2 += v.tx; }
  return {
    rx: Math.max(0, (totalRx2 - totalRx1) / elapsedSec),
    tx: Math.max(0, (totalTx2 - totalTx1) / elapsedSec)
  };
};

/**
 * Parse the canonical SSH probe output.
 * Sections are delimited by marker lines: NET_SAMPLE_1 … NET_SAMPLE_2 … (end)
 */
export const parseSshProbeOutput = (out: string): RawMetricInput => {
  const lines = out.split('\n').map(l => l.trim());

  // CPU from `top` line "%Cpu(s):  3.4 us,  1.2 sy, ..."
  let cpuPct = 0;
  const cpuLine = lines.find(l => l.startsWith('%Cpu(s)') || l.startsWith('Cpu(s)'));
  if (cpuLine) {
    const m = cpuLine.match(/([\d.]+)\s*id/);
    if (m) cpuPct = Math.max(0, Math.min(100, 100 - parseFloat(m[1])));
  }

  // RAM from `free -m` → "Mem: total used ..."
  let memTotalMb = 0, memUsedMb = 0;
  const memLine = lines.find(l => l.startsWith('Mem:'));
  if (memLine) {
    const parts = memLine.split(/\s+/);
    memTotalMb = parseInt(parts[1], 10) || 0;
    memUsedMb = parseInt(parts[2], 10) || 0;
  }
  const memPct = memTotalMb > 0 ? (memUsedMb / memTotalMb) * 100 : 0;

  // Disk from `df -k`
  const disk: IDiskUsage[] = [];
  const dfStart = lines.findIndex(l => /^Mounted/.test(l) && /Used/.test(l));
  if (dfStart >= 0) {
    for (let i = dfStart + 1; i < lines.length; i++) {
      const l = lines[i];
      if (!l || /^\s*$/.test(l) || l.startsWith('NET_SAMPLE')) break;
      const parts = l.split(/\s+/);
      if (parts.length < 3) continue;
      const mount = parts[0];
      const used1K = parseInt(parts[1], 10);
      const size1K = parseInt(parts[2], 10);
      if (!Number.isFinite(used1K) || !Number.isFinite(size1K) || size1K === 0) continue;
      if (!mount.startsWith('/')) break;
      disk.push({ mount, usedPct: (used1K / size1K) * 100, usedGb: used1K / 1024 / 1024, totalGb: size1K / 1024 / 1024 });
    }
  }

  // Load average from /proc/loadavg
  let loadAvg: number[] = [];
  const procLoad = lines.find(l => /^\d+\.\d+\s+\d+\.\d+\s+\d+\.\d+/.test(l));
  if (procLoad) loadAvg = procLoad.split(/\s+/).slice(0, 3).map(parseFloat);

  // Uptime
  let uptimeSec = 0;
  const uptimeLine = lines.find(l => /\bup\b/.test(l) && /load average/.test(l));
  if (uptimeLine) {
    const m = uptimeLine.match(/up\s+(.+?),\s+\d+\s+user/);
    if (m) {
      const txt = m[1];
      const days = /(\d+)\s+day/.exec(txt);
      const hm = /(\d+):(\d+)/.exec(txt);
      const minsOnly = /(\d+)\s+min/.exec(txt);
      let sec = 0;
      if (days) sec += parseInt(days[1], 10) * 86400;
      if (hm) sec += parseInt(hm[1], 10) * 3600 + parseInt(hm[2], 10) * 60;
      else if (minsOnly) sec += parseInt(minsOnly[1], 10) * 60;
      uptimeSec = sec;
    }
  }

  // Network: two /proc/net/dev readings separated by NET_SAMPLE_1 / NET_SAMPLE_2 markers
  let netRxBytesPerSec: number | null = null;
  let netTxBytesPerSec: number | null = null;
  const idx1 = lines.indexOf('NET_SAMPLE_1');
  const idx2 = lines.indexOf('NET_SAMPLE_2');
  if (idx1 >= 0 && idx2 > idx1) {
    const s1 = parseNetDev(lines.slice(idx1 + 1, idx2));
    const s2 = parseNetDev(lines.slice(idx2 + 1));
    const delta = netDeltaBytesPerSec(s1, s2, 1);
    netRxBytesPerSec = delta.rx;
    netTxBytesPerSec = delta.tx;
  }

  return { cpuPct, memPct, memUsedMb, memTotalMb, disk, loadAvg, uptimeSec, netRxBytesPerSec, netTxBytesPerSec };
};

export const SSH_PROBE_COMMAND =
  'top -bn1 | head -3; echo ---; free -m; echo ---; df -k --output=target,used,size -x tmpfs -x devtmpfs; echo ---; uptime; echo ---; cat /proc/loadavg; echo NET_SAMPLE_1; cat /proc/net/dev; sleep 1; echo NET_SAMPLE_2; cat /proc/net/dev';

/**
 * Pull metrics from one ssh-mode host. Returns true on success.
 */
export const pullSshMetrics = async (host: IHost): Promise<boolean> => {
  if (host.mode !== 'ssh' || !host.sshConfig) return false;
  let NodeSSH: any;
  try {
    NodeSSH = require('node-ssh').NodeSSH;
  } catch (err) {
    console.error('[HOST_METRICS] node-ssh not installed:', (err as Error).message);
    return false;
  }
  const ssh = new NodeSSH();
  try {
    await ssh.connect({
      host: host.sshConfig.host,
      port: host.sshConfig.port,
      username: host.sshConfig.user,
      privateKeyPath: host.sshConfig.privateKeyPath,
      readyTimeout: 10_000
    });
    const result = await ssh.execCommand(SSH_PROBE_COMMAND);
    if (result.code !== 0) {
      console.error(`[HOST_METRICS] SSH probe failed for ${host.name}: ${result.stderr}`);
      return false;
    }
    const raw = parseSshProbeOutput(result.stdout);
    await recordMetric(String(host._id), 'ssh', raw);
    return true;
  } catch (err) {
    console.error(`[HOST_METRICS] SSH error for ${host.name}:`, (err as Error).message);
    return false;
  } finally {
    try { ssh.dispose(); } catch { /* ignore */ }
  }
};
