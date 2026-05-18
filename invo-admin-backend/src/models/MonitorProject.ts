import mongoose, { Document, Schema } from 'mongoose';

export interface IMonitorProject extends Document {
  name: string;
  slug: string;
  description: string;
  telegramChatId: string | null;
  isPublic: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const monitorProjectSchema = new Schema<IMonitorProject>({
  name: {
    type: String,
    required: true,
    trim: true
  },
  slug: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true
  },
  description: {
    type: String,
    default: ''
  },
  telegramChatId: {
    type: String,
    default: null
  },
  isPublic: {
    type: Boolean,
    default: false
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

monitorProjectSchema.pre('save', function (next) {
  this.updatedAt = new Date();
  next();
});

export default mongoose.model<IMonitorProject>('MonitorProject', monitorProjectSchema);
