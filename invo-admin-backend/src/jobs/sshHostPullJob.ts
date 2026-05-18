import dotenv from 'dotenv';
dotenv.config();
import connectDB from '../config/database';
import Host from '../models/Host';
import { pullSshMetrics } from '../services/hostMetricsCollector';
import { acquireLock, releaseLock } from '../services/jobLockService';

const JOB = 'ssh-host-pull';

const run = async () => {
  console.log(`[SSH_HOST_PULL] Job started ${new Date().toISOString()}`);
  try {
    await connectDB();
    const locked = await acquireLock(JOB, 55);
    if (!locked) {
      console.log('[SSH_HOST_PULL] Previous run still in progress, skipping');
      process.exit(0);
    }
    const hosts = await Host.find({ mode: 'ssh', enabled: true });
    console.log(`[SSH_HOST_PULL] Pulling ${hosts.length} SSH hosts`);
    const results = await Promise.allSettled(hosts.map(h => pullSshMetrics(h)));
    const ok = results.filter(r => r.status === 'fulfilled' && r.value).length;
    console.log(`[SSH_HOST_PULL] Done: ${ok}/${hosts.length} succeeded`);
  } catch (err) {
    console.error('[SSH_HOST_PULL] Fatal error:', err);
    process.exit(1);
  } finally {
    await releaseLock(JOB).catch(() => {});
    process.exit(0);
  }
};

run();
