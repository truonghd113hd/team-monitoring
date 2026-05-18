import dotenv from 'dotenv';
dotenv.config();
import connectDB from '../config/database';
import Endpoint from '../models/Endpoint';
import { checkEndpointsBatch } from '../services/endpointCheckerService';
import { acquireLock, releaseLock } from '../services/jobLockService';

const JOB = 'endpoint-check';

const run = async () => {
  console.log(`[ENDPOINT_CHECK] Job started ${new Date().toISOString()}`);
  try {
    await connectDB();
    const locked = await acquireLock(JOB, 55);
    if (!locked) {
      console.log('[ENDPOINT_CHECK] Previous run still in progress, skipping');
      process.exit(0);
    }
    const now = new Date();
    const allEndpoints = await Endpoint.find({ enabled: true });

    const endpoints = allEndpoints.filter(ep => {
      if (!ep.lastCheckedAt) return true;
      const intervalMs = (ep.intervalMinutes || 1) * 60 * 1000;
      return now.getTime() - ep.lastCheckedAt.getTime() >= intervalMs;
    });

    console.log(`[ENDPOINT_CHECK] ${endpoints.length}/${allEndpoints.length} endpoints due for check`);
    await checkEndpointsBatch(endpoints, 20);
    console.log('[ENDPOINT_CHECK] Done');
  } catch (err) {
    console.error('[ENDPOINT_CHECK] Fatal error:', err);
    process.exit(1);
  } finally {
    await releaseLock(JOB).catch(() => {});
    process.exit(0);
  }
};

run();
