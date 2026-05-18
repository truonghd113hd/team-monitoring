import dotenv from 'dotenv';
dotenv.config();
import connectDB from '../config/database';
import EndpointCheck from '../models/EndpointCheck';
import HostMetric from '../models/HostMetric';

const RETENTION_DAYS = parseInt(process.env.MONITORING_RETENTION_DAYS || '35', 10);

const run = async () => {
  console.log(`[RETENTION] Job started — retention: ${RETENTION_DAYS} days`);
  try {
    await connectDB();
    const cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000);
    const ec = await EndpointCheck.deleteMany({ checkedAt: { $lt: cutoff } });
    const hm = await HostMetric.deleteMany({ sampledAt: { $lt: cutoff } });
    console.log(`[RETENTION] Deleted ${ec.deletedCount} endpoint checks, ${hm.deletedCount} host metrics`);
    process.exit(0);
  } catch (err) {
    console.error('[RETENTION] Fatal error:', err);
    process.exit(1);
  }
};

run();
