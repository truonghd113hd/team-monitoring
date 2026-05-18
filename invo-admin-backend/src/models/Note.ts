import mongoose, { Document, Schema } from 'mongoose';

export interface INote extends Document {
  projectId: mongoose.Types.ObjectId | null;
  date: string; // Format: YYYY-MM-DD
  content: string;
  createdAt: Date;
  updatedAt: Date;
}

const noteSchema = new Schema<INote>({
  projectId: {
    type: Schema.Types.ObjectId,
    ref: 'Project',
    default: null
  },
  date: {
    type: String,
    required: true
  },
  content: {
    type: String,
    required: true
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

noteSchema.index({ date: 1 });
noteSchema.index({ projectId: 1, date: 1 });

noteSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

export default mongoose.model<INote>('Note', noteSchema);
