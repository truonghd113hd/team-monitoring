import mongoose, { Document, Schema } from 'mongoose';

export interface IEndpoint extends Document {
  environmentId: mongoose.Types.ObjectId;
  projectId: mongoose.Types.ObjectId;
  name: string;
  url: string;
  method: 'GET' | 'POST' | 'HEAD';
  expectedStatus: number;
  timeoutMs: number;
  intervalMinutes: number;
  enabled: boolean;
  lastStatus: 'up' | 'down' | 'degraded' | 'unknown';
  lastCheckedAt: Date | null;
  lastResponseTimeMs: number | null;
  createdAt: Date;
  updatedAt: Date;
}

const endpointSchema = new Schema<IEndpoint>({
  environmentId: {
    type: Schema.Types.ObjectId,
    ref: 'MonitorEnvironment',
    required: true,
    index: true
  },
  projectId: {
    type: Schema.Types.ObjectId,
    ref: 'MonitorProject',
    required: true,
    index: true
  },
  name: { type: String, required: true, trim: true },
  url: { type: String, required: true, trim: true },
  method: { type: String, enum: ['GET', 'POST', 'HEAD'], default: 'GET' },
  expectedStatus: { type: Number, default: 200 },
  timeoutMs: { type: Number, default: 10000 },
  intervalMinutes: { type: Number, default: 1 },
  enabled: { type: Boolean, default: true },
  lastStatus: { type: String, enum: ['up', 'down', 'degraded', 'unknown'], default: 'unknown' },
  lastCheckedAt: { type: Date, default: null },
  lastResponseTimeMs: { type: Number, default: null },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

endpointSchema.pre('save', function (next) {
  this.updatedAt = new Date();
  next();
});

export default mongoose.model<IEndpoint>('Endpoint', endpointSchema);
