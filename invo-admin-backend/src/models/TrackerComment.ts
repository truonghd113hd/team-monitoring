import mongoose, { Document, Schema } from 'mongoose';

export interface ITrackerComment extends Document {
  issueId: mongoose.Types.ObjectId;
  author: string;
  body: string;
  githubCommentId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const schema = new Schema<ITrackerComment>(
  {
    issueId: { type: Schema.Types.ObjectId, ref: 'TrackerIssue', required: true },
    author: { type: String, required: true },
    body: { type: String, required: true },
    githubCommentId: { type: String, default: null }
  },
  { timestamps: true }
);

schema.index({ issueId: 1, createdAt: 1 });

export default mongoose.model<ITrackerComment>('TrackerComment', schema);
