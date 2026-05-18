import mongoose, { Document, Schema } from 'mongoose';

export interface IAlertRule extends Document {
  targetType: 'endpoint' | 'host';
  targetId: mongoose.Types.ObjectId;
  projectId: mongoose.Types.ObjectId;
  name: string;
  condition: string;
  forMinutes: number;
  renotifyMinutes: number;
  enabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const alertRuleSchema = new Schema<IAlertRule>({
  targetType: { type: String, enum: ['endpoint', 'host'], required: true },
  targetId: { type: Schema.Types.ObjectId, required: true, index: true },
  projectId: {
    type: Schema.Types.ObjectId,
    ref: 'MonitorProject',
    required: true,
    index: true
  },
  name: { type: String, required: true, trim: true },
  // e.g. "down", "responseTimeMs>2000", "cpuPct>80", "memPct>90", "diskPct>85", "agentSilent"
  condition: { type: String, required: true, trim: true },
  forMinutes: { type: Number, default: 5 },
  renotifyMinutes: { type: Number, default: 60 },
  enabled: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

alertRuleSchema.pre('save', function (next) {
  this.updatedAt = new Date();
  next();
});

export default mongoose.model<IAlertRule>('AlertRule', alertRuleSchema);
