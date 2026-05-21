import mongoose, { Document, Schema } from 'mongoose';

export interface ISshConfig {
  host: string;
  port: number;
  user: string;
  privateKeyPath: string;
}

export interface IHost extends Document {
  environmentId: mongoose.Types.ObjectId;
  projectId: mongoose.Types.ObjectId;
  name: string;
  mode: 'agent' | 'ssh';
  agentToken: string | null;
  sshConfig: ISshConfig | null;
  enabled: boolean;
  lastSampledAt: Date | null;
  lastCpuPct: number | null;
  lastMemPct: number | null;
  lastDiskPct: number | null;
  lastNetRxBytesPerSec: number | null;
  lastNetTxBytesPerSec: number | null;
  createdAt: Date;
  updatedAt: Date;
}

const sshConfigSchema = new Schema<ISshConfig>({
  host: { type: String, required: true },
  port: { type: Number, default: 22 },
  user: { type: String, required: true },
  privateKeyPath: { type: String, required: true }
}, { _id: false });

const hostSchema = new Schema<IHost>({
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
  mode: { type: String, enum: ['agent', 'ssh'], required: true },
  agentToken: { type: String, default: null, index: true },
  sshConfig: { type: sshConfigSchema, default: null },
  enabled: { type: Boolean, default: true },
  lastSampledAt: { type: Date, default: null },
  lastCpuPct: { type: Number, default: null },
  lastMemPct: { type: Number, default: null },
  lastDiskPct: { type: Number, default: null },
  lastNetRxBytesPerSec: { type: Number, default: null },
  lastNetTxBytesPerSec: { type: Number, default: null },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

hostSchema.pre('save', function (next) {
  this.updatedAt = new Date();
  next();
});

export default mongoose.model<IHost>('Host', hostSchema);
