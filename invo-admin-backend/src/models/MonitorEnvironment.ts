import mongoose, { Document, Schema } from 'mongoose';

export interface IMonitorEnvironment extends Document {
  projectId: mongoose.Types.ObjectId;
  name: string;
  color: string;
  createdAt: Date;
}

const monitorEnvironmentSchema = new Schema<IMonitorEnvironment>({
  projectId: {
    type: Schema.Types.ObjectId,
    ref: 'MonitorProject',
    required: true,
    index: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  color: {
    type: String,
    default: '#3b82f6'
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

monitorEnvironmentSchema.index({ projectId: 1, name: 1 }, { unique: true });

export default mongoose.model<IMonitorEnvironment>('MonitorEnvironment', monitorEnvironmentSchema);
