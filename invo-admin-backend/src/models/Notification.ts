import mongoose, { Document, Schema } from 'mongoose';

export interface INotification extends Document {
  projectId: mongoose.Types.ObjectId | null;
  type: 'info' | 'success' | 'warning' | 'error';
  title: string;
  message: string;
  isRead: boolean;
  metadata: Record<string, any>;
  createdAt: Date;
}

const notificationSchema = new Schema<INotification>({
  projectId: {
    type: Schema.Types.ObjectId,
    ref: 'Project',
    default: null
  },
  type: {
    type: String,
    enum: ['info', 'success', 'warning', 'error'],
    default: 'info'
  },
  title: {
    type: String,
    required: true
  },
  message: {
    type: String,
    required: true
  },
  isRead: {
    type: Boolean,
    default: false
  },
  metadata: {
    type: Schema.Types.Mixed,
    default: {}
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

notificationSchema.index({ createdAt: -1 });
notificationSchema.index({ isRead: 1 });
notificationSchema.index({ projectId: 1 });

export default mongoose.model<INotification>('Notification', notificationSchema);
