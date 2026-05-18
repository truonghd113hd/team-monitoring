import dotenv from 'dotenv';
dotenv.config();
import connectDB from '../config/database';
import { rollupYesterday } from '../services/uptimeService';

const run = async () => {
  console.log(`[UPTIME_ROLLUP] Job started ${new Date().toISOString()}`);
  try {
    await connectDB();
    const count = await rollupYesterday();
    console.log(`[UPTIME_ROLLUP] Rolled up ${count} endpoints for yesterday`);
    process.exit(0);
  } catch (err) {
    console.error('[UPTIME_ROLLUP] Fatal error:', err);
    process.exit(1);
  }
};

run();
