import mongoose, { Document, Schema } from 'mongoose';

export interface INotificationCache extends Document {
  noteId: mongoose.Types.ObjectId;
  notificationDate: string; // Format: YYYY-MM-DD
  sentAt: Date;
  createdAt: Date;
}

const notificationCacheSchema = new Schema<INotificationCache>({
  noteId: {
    type: Schema.Types.ObjectId,
    ref: 'Note',
    required: true
  },
  notificationDate: {
    type: String,
    required: true
  },
  sentAt: {
    type: Date,
    default: Date.now
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Compound unique index to ensure only one notification per note per date
notificationCacheSchema.index({ noteId: 1, notificationDate: 1 }, { unique: true });
notificationCacheSchema.index({ createdAt: 1 });

export default mongoose.model<INotificationCache>('NotificationCache', notificationCacheSchema);
