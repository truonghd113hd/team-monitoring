import mongoose, { Document, Schema } from 'mongoose';

export interface IFile extends Document {
  projectId: mongoose.Types.ObjectId;
  projectName: string;
  sheetName: string;
  fileName: string;
  filePath: string;
  sheetUrl: string;
  totalIssues: number;
  pendingIssues: number;
  resolvedIssues: number;
  status: 'pending' | 'in-progress' | 'completed' | 'error';
  progress: number;
  lastUpdated: Date;
  createdAt: Date;
}

const fileSchema = new Schema<IFile>({
  projectId: {
    type: Schema.Types.ObjectId,
    ref: 'Project',
    required: true
  },
  projectName: {
    type: String,
    required: true
  },
  sheetName: {
    type: String,
    required: true
  },
  fileName: {
    type: String,
    required: true
  },
  filePath: {
    type: String,
    default: ''
  },
  sheetUrl: {
    type: String,
    default: ''
  },
  totalIssues: {
    type: Number,
    default: 0
  },
  pendingIssues: {
    type: Number,
    default: 0
  },
  resolvedIssues: {
    type: Number,
    default: 0
  },
  status: {
    type: String,
    enum: ['pending', 'in-progress', 'completed', 'error'],
    default: 'pending'
  },
  progress: {
    type: Number,
    default: 0,
    min: 0,
    max: 100
  },
  lastUpdated: {
    type: Date,
    default: Date.now
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

fileSchema.index({ projectId: 1, sheetName: 1, fileName: 1 }, { unique: true });

export default mongoose.model<IFile>('File', fileSchema);
