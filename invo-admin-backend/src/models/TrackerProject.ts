import mongoose, { Document, Schema } from 'mongoose';

export interface ITrackerProject extends Document {
  name: string;
  description: string;
  color: string;
  githubProjectId: string | null;
  githubProjectUrl: string | null;
  githubRepo: string | null;
  githubMilestones: Array<{ number: number; title: string; state: string }>;
  githubStatusFieldId: string | null;
  githubStatusOptions: Array<{ id: string; name: string }>;
  googleSheetUrl: string | null;
  googleSheetTabs: Array<{ name: string; sheetId: number }>;
  googleSheetId: string | null;
  googleSheetColMap: Record<string, number> | null;
  googleSheetLastSync: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const schema = new Schema<ITrackerProject>(
  {
    name: { type: String, required: true },
    description: { type: String, default: '' },
    color: { type: String, default: '#3b82f6' },
    githubProjectId: { type: String, default: null, sparse: true },
    githubProjectUrl: { type: String, default: null },
    githubRepo: { type: String, default: null },
    githubMilestones: { type: [{ number: Number, title: String, state: String }], default: [] },
    githubStatusFieldId: { type: String, default: null },
    githubStatusOptions: { type: [{ id: String, name: String }], default: [] },
    googleSheetUrl: { type: String, default: null },
    googleSheetTabs: { type: [{ name: String, sheetId: Number }], default: [] },
    googleSheetId: { type: String, default: null },
    googleSheetColMap: { type: Schema.Types.Mixed, default: null },
    googleSheetLastSync: { type: Date, default: null },
  },
  { timestamps: true }
);

export default mongoose.model<ITrackerProject>('TrackerProject', schema);
