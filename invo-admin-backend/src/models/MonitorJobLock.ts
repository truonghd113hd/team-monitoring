import mongoose, { Document, Schema } from 'mongoose';

export interface IMonitorJobLock extends Document {
  jobName: string;
  acquiredAt: Date;
  expiresAt: Date;
}

const monitorJobLockSchema = new Schema<IMonitorJobLock>({
  jobName: { type: String, required: true, unique: true },
  acquiredAt: { type: Date, default: Date.now },
  expiresAt: { type: Date, required: true }
});

// TTL: auto-release locks past their expiresAt
monitorJobLockSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export default mongoose.model<IMonitorJobLock>('MonitorJobLock', monitorJobLockSchema);
