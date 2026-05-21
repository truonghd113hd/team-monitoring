import mongoose, { Document, Schema } from 'mongoose';

export type IssueStatus = 'todo' | 'inprogress' | 'review' | 'done';
export type IssuePriority = 'low' | 'medium' | 'high' | 'critical';
export type IssueType = 'bug' | 'testcase' | 'issue';

export interface ITrackerIssue extends Document {
  projectId: mongoose.Types.ObjectId;
  number: number;
  title: string;
  description: string;
  status: IssueStatus;
  priority: IssuePriority;
  type: IssueType;
  assignees: string[];
  closedAt: Date | null;
  // GitHub sync
  githubIssueId: string | null;
  githubIssueUrl: string | null;
  githubIssueNumber: number | null;
  githubProjectItemId: string | null;
  milestoneNumber: number | null;
  milestoneTitle: string | null;
  // Google Sheets sync
  sheetIssueId: string | null;
  sheetRowIndex: number | null;
  sheetName: string | null;
  // Shared testcase / issue fields
  initialCondition: string | null;  // testcase: col D (initial cond); issue: col E (precondition)
  testStep: string | null;           // testcase: col F (steps);        issue: col F (steps to reproduce)
  expectedResult: string | null;     // col G for both
  actualResult: string | null;       // col H for both
  // Testcase-only (columns D–K)
  testData: string | null;
  iosStatus: string | null;
  androidStatus: string | null;
  version: string | null;
  // Issue-only (columns A–U structured)
  module: string | null;
  evidence: string | null;
  severity: string | null;
  statusTest: string | null;   // Passed | Wait | Close | Reopen
  statusDev: string | null;    // Done | Reopen | Close | In progress
  device: string | null;       // IOS | Android | All
  note: string | null;
  issueDate: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const schema = new Schema<ITrackerIssue>(
  {
    projectId: { type: Schema.Types.ObjectId, ref: 'TrackerProject', required: true },
    number: { type: Number, required: true },
    title: { type: String, required: true },
    description: { type: String, default: '' },
    status: { type: String, enum: ['todo', 'inprogress', 'review', 'done'], default: 'todo' },
    priority: { type: String, enum: ['low', 'medium', 'high', 'critical'], default: 'medium' },
    type: { type: String, enum: ['bug', 'testcase', 'issue'], default: 'bug' },
    assignees: [{ type: String }],
    closedAt: { type: Date, default: null },
    githubIssueId: { type: String, default: null },
    githubIssueUrl: { type: String, default: null },
    githubIssueNumber: { type: Number, default: null },
    githubProjectItemId: { type: String, default: null },
    milestoneNumber: { type: Number, default: null },
    milestoneTitle: { type: String, default: null },
    sheetIssueId: { type: String, default: null },
    sheetRowIndex: { type: Number, default: null },
    sheetName: { type: String, default: null },
    // shared
    initialCondition: { type: String, default: null },
    testStep: { type: String, default: null },
    expectedResult: { type: String, default: null },
    actualResult: { type: String, default: null },
    // testcase-only
    testData: { type: String, default: null },
    iosStatus: { type: String, default: null },
    androidStatus: { type: String, default: null },
    version: { type: String, default: null },
    // issue-only
    module: { type: String, default: null },
    evidence: { type: String, default: null },
    severity: { type: String, default: null },
    statusTest: { type: String, default: null },
    statusDev: { type: String, default: null },
    device: { type: String, default: null },
    note: { type: String, default: null },
    issueDate: { type: String, default: null },
  },
  { timestamps: true }
);

schema.index({ projectId: 1, number: 1 }, { unique: true });
schema.index({ projectId: 1, status: 1 });
schema.index({ projectId: 1, sheetIssueId: 1, type: 1 }, { sparse: true });

export default mongoose.model<ITrackerIssue>('TrackerIssue', schema);
