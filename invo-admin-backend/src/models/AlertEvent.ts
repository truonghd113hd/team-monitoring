import mongoose, { Document, Schema } from 'mongoose';

export interface IAlertEvent extends Document {
  ruleId: mongoose.Types.ObjectId;
  targetType: 'endpoint' | 'host';
  targetId: mongoose.Types.ObjectId;
  projectId: mongoose.Types.ObjectId;
  firedAt: Date;
  recoveredAt: Date | null;
  state: 'firing' | 'recovered';
  lastNotifiedAt: Date | null;
  message: string;
}

const alertEventSchema = new Schema<IAlertEvent>({
  ruleId: {
    type: Schema.Types.ObjectId,
    ref: 'AlertRule',
    required: true,
    index: true
  },
  targetType: { type: String, enum: ['endpoint', 'host'], required: true },
  targetId: { type: Schema.Types.ObjectId, required: true },
  projectId: {
    type: Schema.Types.ObjectId,
    ref: 'MonitorProject',
    required: true,
    index: true
  },
  firedAt: { type: Date, default: Date.now },
  recoveredAt: { type: Date, default: null },
  state: { type: String, enum: ['firing', 'recovered'], default: 'firing', index: true },
  lastNotifiedAt: { type: Date, default: null },
  message: { type: String, default: '' }
});

alertEventSchema.index({ ruleId: 1, state: 1 });
alertEventSchema.index({ firedAt: -1 });

export default mongoose.model<IAlertEvent>('AlertEvent', alertEventSchema);
