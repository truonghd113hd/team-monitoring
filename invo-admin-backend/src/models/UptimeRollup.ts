import mongoose, { Document, Schema } from 'mongoose';

export interface IUptimeRollup extends Document {
  endpointId: mongoose.Types.ObjectId;
  date: string; // YYYY-MM-DD
  upChecks: number;
  totalChecks: number;
  uptimePct: number;
  avgResponseTimeMs: number;
}

const uptimeRollupSchema = new Schema<IUptimeRollup>({
  endpointId: {
    type: Schema.Types.ObjectId,
    ref: 'Endpoint',
    required: true
  },
  date: { type: String, required: true },
  upChecks: { type: Number, default: 0 },
  totalChecks: { type: Number, default: 0 },
  uptimePct: { type: Number, default: 0 },
  avgResponseTimeMs: { type: Number, default: 0 }
});

uptimeRollupSchema.index({ endpointId: 1, date: 1 }, { unique: true });
uptimeRollupSchema.index({ date: -1 });

export default mongoose.model<IUptimeRollup>('UptimeRollup', uptimeRollupSchema);
