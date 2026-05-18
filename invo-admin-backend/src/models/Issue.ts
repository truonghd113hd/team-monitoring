import mongoose, { Document, Schema } from 'mongoose';

export interface IIssue extends Document {
  projectId: mongoose.Types.ObjectId;
  projectName: string;
  sheetName: string;
  fileId: mongoose.Types.ObjectId;
  issueId: string;
  title: string;
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  status: string;
  systemStatus: 'open' | 'update' | 'progress' | 'completed';
  assignee: string;
  lineNumber: number | null;
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
  resolvedAt: Date | null;
  completedAt: Date | null;
}

const issueSchema = new Schema<IIssue>({
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
  fileId: {
    type: Schema.Types.ObjectId,
    ref: 'File',
    required: true
  },
  issueId: {
    type: String,
    required: true
  },
  title: {
    type: String,
    required: true
  },
  description: {
    type: String,
    default: ''
  },
  severity: {
    type: String,
    enum: ['low', 'medium', 'high', 'critical'],
    default: 'medium'
  },
  status: {
    type: String,
    default: 'open'
  },
  systemStatus: {
    type: String,
    enum: ['open', 'update', 'progress', 'completed'],
    default: 'open'
  },
  assignee: {
    type: String,
    default: ''
  },
  lineNumber: {
    type: Number,
    default: null
  },
  tags: [{
    type: String
  }],
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  },
  resolvedAt: {
    type: Date,
    default: null
  },
  completedAt: {
    type: Date,
    default: null
  }
});

issueSchema.index({ projectId: 1, fileId: 1 });
issueSchema.index({ projectId: 1, sheetName: 1, issueId: 1 }, { unique: true });
issueSchema.index({ status: 1 });
issueSchema.index({ severity: 1 });

issueSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  if (this.status === 'resolved' && !this.resolvedAt) {
    this.resolvedAt = new Date();
  }
  if (this.systemStatus === 'completed' && !this.completedAt) {
    this.completedAt = new Date();
  }
  next();
});

export default mongoose.model<IIssue>('Issue', issueSchema);
