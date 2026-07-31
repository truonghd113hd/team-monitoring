import { IHost } from '../models/Host';

export interface Pm2RestartResult {
  ok: boolean;
  message: string;
}

/**
 * SSH into an ssh-mode host and run `pm2 restart <processName>`.
 * Mirrors the connect/execCommand/dispose pattern used by pullSshMetrics.
 */
export const restartPm2Process = async (host: IHost, processName: string): Promise<Pm2RestartResult> => {
  if (host.mode !== 'ssh' || !host.sshConfig) {
    return { ok: false, message: `Host ${host.name} is not configured for SSH` };
  }
  let NodeSSH: any;
  try {
    NodeSSH = require('node-ssh').NodeSSH;
  } catch (err) {
    return { ok: false, message: `node-ssh not installed: ${(err as Error).message}` };
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
    const quotedName = `'${processName.replace(/'/g, `'\\''`)}'`;
    const result = await ssh.execCommand(`pm2 restart ${quotedName}`);
    if (result.code !== 0) {
      return { ok: false, message: `pm2 restart failed (code ${result.code}): ${result.stderr || result.stdout}` };
    }
    return { ok: true, message: result.stdout.trim() || `pm2 restart ${processName} succeeded` };
  } catch (err) {
    return { ok: false, message: `SSH error: ${(err as Error).message}` };
  } finally {
    try { ssh.dispose(); } catch { /* ignore */ }
  }
};
