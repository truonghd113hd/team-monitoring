import MonitorJobLock from '../models/MonitorJobLock';

/**
 * Try to acquire a named lock. Returns true if we got it. TTL'd in mongo so a
 * crashed job won't block forever.
 */
export const acquireLock = async (jobName: string, ttlSeconds: number): Promise<boolean> => {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + ttlSeconds * 1000);
  try {
    // First, try to take over an expired lock.
    const updated = await MonitorJobLock.findOneAndUpdate(
      { jobName, expiresAt: { $lt: now } },
      { $set: { acquiredAt: now, expiresAt } },
      { new: true }
    );
    if (updated) return true;
    // Otherwise insert fresh.
    await MonitorJobLock.create({ jobName, acquiredAt: now, expiresAt });
    return true;
  } catch (err) {
    if ((err as any).code === 11000) return false;
    throw err;
  }
};

export const releaseLock = async (jobName: string): Promise<void> => {
  await MonitorJobLock.deleteOne({ jobName });
};
