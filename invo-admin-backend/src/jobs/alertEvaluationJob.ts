import dotenv from 'dotenv';
dotenv.config();
import connectDB from '../config/database';
import { evaluateAllRules } from '../services/alertEngine';
import { acquireLock, releaseLock } from '../services/jobLockService';

const JOB = 'alert-evaluation';

const run = async () => {
  console.log(`[ALERT_EVAL] Job started ${new Date().toISOString()}`);
  try {
    await connectDB();
    const locked = await acquireLock(JOB, 55);
    if (!locked) {
      console.log('[ALERT_EVAL] Previous run still in progress, skipping');
      process.exit(0);
    }
    await evaluateAllRules();
    console.log('[ALERT_EVAL] Done');
  } catch (err) {
    console.error('[ALERT_EVAL] Fatal error:', err);
    process.exit(1);
  } finally {
    await releaseLock(JOB).catch(() => {});
    process.exit(0);
  }
};

run();
