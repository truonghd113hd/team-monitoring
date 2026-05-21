import mongoose, { Document, Schema } from 'mongoose';

export interface IDiskUsage {
  mount: string;
  usedPct: number;
  usedGb: number;
  totalGb: number;
}

export interface IHostMetric extends Document {
  hostId: mongoose.Types.ObjectId;
  sampledAt: Date;
  cpuPct: number;
  memPct: number;
  memUsedMb: number;
  memTotalMb: number;
  disk: IDiskUsage[];
  loadAvg: number[];
  uptimeSec: number;
  netRxBytesPerSec: number | null;
  netTxBytesPerSec: number | null;
  source: 'agent' | 'ssh';
}

const diskUsageSchema = new Schema<IDiskUsage>({
  mount: { type: String, required: true },
  usedPct: { type: Number, required: true },
  usedGb: { type: Number, required: true },
  totalGb: { type: Number, required: true }
}, { _id: false });

const hostMetricSchema = new Schema<IHostMetric>({
  hostId: {
    type: Schema.Types.ObjectId,
    ref: 'Host',
    required: true
  },
  sampledAt: { type: Date, default: Date.now },
  cpuPct: { type: Number, required: true },
  memPct: { type: Number, required: true },
  memUsedMb: { type: Number, required: true },
  memTotalMb: { type: Number, required: true },
  disk: { type: [diskUsageSchema], default: [] },
  loadAvg: { type: [Number], default: [] },
  uptimeSec: { type: Number, default: 0 },
  netRxBytesPerSec: { type: Number, default: null },
  netTxBytesPerSec: { type: Number, default: null },
  source: { type: String, enum: ['agent', 'ssh'], required: true }
});

hostMetricSchema.index({ hostId: 1, sampledAt: -1 });
// TTL: drop raw samples older than 35 days
hostMetricSchema.index({ sampledAt: 1 }, { expireAfterSeconds: 35 * 24 * 60 * 60 });

export default mongoose.model<IHostMetric>('HostMetric', hostMetricSchema);
