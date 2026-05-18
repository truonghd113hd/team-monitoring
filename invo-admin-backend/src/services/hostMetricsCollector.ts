import Host, { IHost } from '../models/Host';
import HostMetric, { IDiskUsage } from '../models/HostMetric';

export interface RawMetricInput {
  cpuPct: number;
  memPct: number;
  memUsedMb: number;
  memTotalMb: number;
  disk: IDiskUsage[];
  loadAvg: number[];
  uptimeSec: number;
}

/**
 * Persist a metric sample and update the host's denormalized snapshot.
 */
export const recordMetric = async (
  hostId: string,
  source: 'agent' | 'ssh',
  raw: RawMetricInput
): Promise<void> => {
  await HostMetric.create({
    hostId,
    sampledAt: new Date(),
    source,
    ...raw
  });
  const maxDiskPct = raw.disk.length > 0 ? Math.max(...raw.disk.map(d => d.usedPct)) : 0;
  await Host.updateOne(
    { _id: hostId },
    {
      $set: {
        lastSampledAt: new Date(),
        lastCpuPct: raw.cpuPct,
        lastMemPct: raw.memPct,
        lastDiskPct: maxDiskPct
      }
    }
  );
};

/**
 * Parse the canonical SSH probe output, which is:
 *
 *   top -bn1 | head -3
 *   free -m
 *   df -k --output=target,used,size
 *   uptime
 *   cat /proc/loadavg
 *
 * Concatenated with newlines.
 */
export const parseSshProbeOutput = (out: string): RawMetricInput => {
  const lines = out.split('\n').map(l => l.trim());

  // CPU from `top` line "%Cpu(s):  3.4 us,  1.2 sy, ..."
  let cpuPct = 0;
  const cpuLine = lines.find(l => l.startsWith('%Cpu(s)') || l.startsWith('Cpu(s)'));
  if (cpuLine) {
    const idleMatch = cpuLine.match(/([\d.]+)\s*id/);
    if (idleMatch) {
      const idle = parseFloat(idleMatch[1]);
      cpuPct = Math.max(0, Math.min(100, 100 - idle));
    }
  }

  // RAM from `free -m` second line "Mem: total used free shared buff/cache available"
  let memTotalMb = 0;
  let memUsedMb = 0;
  const memLine = lines.find(l => l.startsWith('Mem:'));
  if (memLine) {
    const parts = memLine.split(/\s+/);
    memTotalMb = parseInt(parts[1], 10) || 0;
    memUsedMb = parseInt(parts[2], 10) || 0;
  }
  const memPct = memTotalMb > 0 ? (memUsedMb / memTotalMb) * 100 : 0;

  // Disk: lines after "Mounted on Used 1K-blocks" / "Mounted Used Size" header
  const disk: IDiskUsage[] = [];
  const dfStart = lines.findIndex(l => /^Mounted/.test(l) && /Used/.test(l));
  if (dfStart >= 0) {
    for (let i = dfStart + 1; i < lines.length; i++) {
      const l = lines[i];
      if (!l || /^\s*$/.test(l)) break;
      const parts = l.split(/\s+/);
      if (parts.length < 3) continue;
      const mount = parts[0];
      const used1K = parseInt(parts[1], 10);
      const size1K = parseInt(parts[2], 10);
      if (!Number.isFinite(used1K) || !Number.isFinite(size1K) || size1K === 0) continue;
      if (!mount.startsWith('/')) break;
      disk.push({
        mount,
        usedPct: (used1K / size1K) * 100,
        usedGb: used1K / 1024 / 1024,
        totalGb: size1K / 1024 / 1024
      });
    }
  }

  // loadavg from /proc/loadavg "0.05 0.10 0.12 1/123 4567"
  let loadAvg: number[] = [];
  const procLoad = lines.find(l => /^\d+\.\d+\s+\d+\.\d+\s+\d+\.\d+/.test(l));
  if (procLoad) {
    loadAvg = procLoad.split(/\s+/).slice(0, 3).map(parseFloat);
  }

  // uptime from `uptime` output: " 12:34:56 up 3 days,  5:42, 1 user, load avg..."
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

  return { cpuPct, memPct, memUsedMb, memTotalMb, disk, loadAvg, uptimeSec };
};

export const SSH_PROBE_COMMAND =
  'top -bn1 | head -3; echo ---; free -m; echo ---; df -k --output=target,used,size -x tmpfs -x devtmpfs; echo ---; uptime; echo ---; cat /proc/loadavg';

/**
 * Pull metrics from one ssh-mode host. Returns true on success.
 */
export const pullSshMetrics = async (host: IHost): Promise<boolean> => {
  if (host.mode !== 'ssh' || !host.sshConfig) return false;
  // Lazy-load node-ssh so the dep isn't required at import time
  // (allows the rest of the backend to start even if not installed).
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
