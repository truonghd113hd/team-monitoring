'use client';

import { useEffect, useRef, useState } from 'react';
import { trackerApi } from '@/services/api';
import { useSocket } from '@/contexts/SocketContext';
import MarkdownEditor from '@/components/MarkdownEditor';
import MarkdownRenderer from '@/components/MarkdownRenderer';
import type { TrackerIssueDetail, TrackerIssueStatus, TrackerIssuePriority, TrackerComment } from '@/types/api';

const ASSIGNEES = ['chounm28', 'khanh181296', 'thuhait03', 'truonghd113hd', 'VuDoiMu'];

const TC_RESULT_OPTIONS = ['Pass', 'Failed', 'N/A', 'Untested'];
const STATUS_TEST_OPTIONS = ['Passed', 'Wait', 'Close', 'Reopen'];
const STATUS_DEV_OPTIONS = ['Done', 'Reopen', 'Close', 'In progress'];
const DEVICE_OPTIONS = ['IOS', 'Android', 'All'];

const PRIORITY_COLOR: Record<TrackerIssuePriority, string> = {
  critical: 'bg-red-500/10 text-red-500 border-red-500/20',
  high: 'bg-orange-500/10 text-orange-500 border-orange-500/20',
  medium: 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20',
  low: 'bg-slate-500/10 text-slate-500 border-slate-300',
};

const STATUS_COLOR: Record<TrackerIssueStatus, string> = {
  todo: 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300',
  inprogress: 'bg-blue-500/10 text-blue-600',
  review: 'bg-purple-500/10 text-purple-600',
  done: 'bg-green-500/10 text-green-600',
};

const STATUS_LABEL: Record<TrackerIssueStatus, string> = {
  todo: 'Todo', inprogress: 'In Progress', review: 'Review', done: 'Done',
};

function tcResultBadge(v: string | null | undefined): string {
  if (v === 'Pass') return 'bg-green-500/10 text-green-600 border-green-500/20';
  if (v === 'Failed') return 'bg-red-500/10 text-red-500 border-red-500/20';
  if (v === 'N/A') return 'bg-slate-100 dark:bg-slate-700 text-slate-500 border-slate-300';
  if (v === 'Untested') return 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20';
  return 'bg-slate-100 dark:bg-slate-700 text-slate-400 border-slate-200';
}

function statusTestBadge(v: string | null | undefined): string {
  if (v === 'Passed') return 'bg-green-500/10 text-green-600 border-green-500/20';
  if (v === 'Wait') return 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20';
  if (v === 'Reopen') return 'bg-red-500/10 text-red-500 border-red-500/20';
  if (v === 'Close') return 'bg-slate-100 dark:bg-slate-700 text-slate-500 border-slate-300';
  return 'bg-slate-100 dark:bg-slate-700 text-slate-400 border-slate-200';
}

function statusDevBadge(v: string | null | undefined): string {
  if (v === 'Done') return 'bg-green-500/10 text-green-600 border-green-500/20';
  if (v === 'In progress') return 'bg-blue-500/10 text-blue-600 border-blue-500/20';
  if (v === 'Reopen') return 'bg-red-500/10 text-red-500 border-red-500/20';
  if (v === 'Close') return 'bg-slate-100 dark:bg-slate-700 text-slate-500 border-slate-300';
  return 'bg-slate-100 dark:bg-slate-700 text-slate-400 border-slate-200';
}

function deviceBadge(v: string | null | undefined): string {
  if (v === 'IOS') return 'bg-blue-500/10 text-blue-600 border-blue-500/20';
  if (v === 'Android') return 'bg-green-500/10 text-green-600 border-green-500/20';
  if (v === 'All') return 'bg-purple-500/10 text-purple-600 border-purple-500/20';
  return 'bg-slate-100 dark:bg-slate-700 text-slate-400 border-slate-200';
}

function tcPriorityLabel(p: TrackerIssuePriority): string {
  return p === 'critical' ? 'Highest' : p === 'high' ? 'High' : p === 'low' ? 'Low' : 'Medium';
}

function deriveTestcaseStatus(ios: string | null, android: string | null): TrackerIssueStatus {
  if (ios === 'Pass' && android === 'Pass') return 'done';
  if (ios === 'Failed' || android === 'Failed') return 'inprogress';
  return 'todo';
}

function deriveIssueStatus(statusDev: string | null): TrackerIssueStatus {
  const l = (statusDev ?? '').toLowerCase().trim();
  if (l === 'done' || l === 'close') return 'done';
  if (l === 'in progress' || l === 'inprogress') return 'inprogress';
  return 'todo';
}

const TextBlock = ({ label, value }: { label: string; value: string | null | undefined }) =>
  value ? (
    <div>
      <p className="text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wide">{label}</p>
      <p className="text-sm dark:text-slate-200 whitespace-pre-wrap leading-relaxed bg-slate-50 dark:bg-slate-700/40 rounded-lg px-4 py-3">{value}</p>
    </div>
  ) : null;

function ChecklistDescription({
  description,
  issueId,
  onUpdate,
}: {
  description: string;
  issueId: string;
  onUpdate: (newDesc: string) => void;
}) {
  const [toggling, setToggling] = useState(false);
  const counterRef = useRef(0);

  const handleToggle = async (checkboxIndex: number) => {
    if (toggling) return;
    let count = 0;
    const newLines = description.split('\n').map(line => {
      if (/^(\s*[-*+]\s+)\[[ x]\]/i.test(line)) {
        if (count === checkboxIndex) {
          count++;
          return /\[ \]/.test(line) ? line.replace('[ ]', '[x]') : line.replace(/\[x\]/i, '[ ]');
        }
        count++;
      }
      return line;
    });
    const newDesc = newLines.join('\n');
    setToggling(true);
    try {
      await trackerApi.updateIssue(issueId, { description: newDesc });
      onUpdate(newDesc);
    } catch (err) {
      console.error(err);
    } finally {
      setToggling(false);
    }
  };

  // Reset before each render so indices are stable across re-renders
  counterRef.current = 0;

  const components = {
    input: ({ type, checked, ...rest }: React.InputHTMLAttributes<HTMLInputElement>) => {
      if (type === 'checkbox') {
        const idx = counterRef.current++;
        return (
          <input
            type="checkbox"
            checked={checked}
            disabled={toggling}
            onChange={() => handleToggle(idx)}
            className="w-4 h-4 rounded border-slate-300 accent-primary cursor-pointer"
          />
        );
      }
      return <input type={type} checked={checked} {...rest} />;
    },
  };

  return (
    <MarkdownRenderer
      className={`bg-slate-50 dark:bg-slate-700/40 rounded-lg px-4 py-3 ${toggling ? 'opacity-60' : ''}`}
      components={components as any}
    >
      {description}
    </MarkdownRenderer>
  );
}

interface Props {
  issueId: string;
  onClose: () => void;
  onIssueUpdated?: (issueId: string, patch: Partial<TrackerIssueDetail>) => void;
}

export default function IssueDetailModal({ issueId, onClose, onIssueUpdated }: Props) {
  const { socket } = useSocket();
  const [issue, setIssue] = useState<TrackerIssueDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);

  const [editForm, setEditForm] = useState({
    title: '', description: '',
    status: 'todo' as TrackerIssueStatus,
    priority: 'medium' as TrackerIssuePriority,
    assignees: '',
    milestoneNumber: null as number | null,
  });
  const [milestones, setMilestones] = useState<{ number: number; title: string }[]>([]);
  const [milestonesLoaded, setMilestonesLoaded] = useState(false);

  // Testcase extra fields
  const [tcForm, setTcForm] = useState({
    iosStatus: null as string | null,
    androidStatus: null as string | null,
    version: '',
    actualResult: null as string | null,
    initialCondition: '',
    testData: '',
    testStep: '',
    expectedResult: '',
  });

  // Issue extra fields
  const [issForm, setIssForm] = useState({
    module: '',
    severity: null as string | null,
    statusTest: null as string | null,
    statusDev: null as string | null,
    device: null as string | null,
    actualResult: null as string | null,
    evidence: null as string | null,
    note: null as string | null,
    issueDate: '',
    initialCondition: '',
    testStep: '',
    expectedResult: '',
  });

  const [saving, setSaving] = useState(false);
  const [commentBody, setCommentBody] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [editingComment, setEditingComment] = useState<string | null>(null);
  const [editCommentBody, setEditCommentBody] = useState('');
  const commentEndRef = useRef<HTMLDivElement>(null);

  const load = async () => {
    setMilestonesLoaded(false);
    try {
      const data = await trackerApi.getIssue(issueId);
      setIssue(data as TrackerIssueDetail);
      const isGh = !!(data as any).githubIssueUrl || !!(data as any).githubIssueNumber;
      setEditForm({
        title: data.title,
        description: data.description,
        status: data.status,
        priority: data.priority,
        assignees: (!isGh && data.type === 'issue') ? (data.assignees[0] ?? '') : data.assignees.join(', '),
        milestoneNumber: (data as any).milestoneNumber ?? null,
      });
      // Load milestones for bugs and GitHub issues
      if (isGh || data.type === 'bug') {
        trackerApi.getMilestones(data.projectId)
          .then(ms => { setMilestones((ms as any) ?? []); setMilestonesLoaded(true); })
          .catch(() => { setMilestonesLoaded(true); });
      }
      setTcForm({
        iosStatus: data.iosStatus ?? null,
        androidStatus: data.androidStatus ?? null,
        version: data.version ?? '',
        actualResult: data.actualResult ?? null,
        initialCondition: data.initialCondition ?? '',
        testData: data.testData ?? '',
        testStep: data.testStep ?? '',
        expectedResult: data.expectedResult ?? '',
      });
      setIssForm({
        module: data.module ?? '',
        severity: data.severity ?? null,
        statusTest: data.statusTest ?? null,
        statusDev: data.statusDev ?? null,
        device: data.device ?? null,
        actualResult: data.actualResult ?? null,
        evidence: data.evidence ?? null,
        note: data.note ?? null,
        issueDate: data.issueDate ?? '',
        initialCondition: data.initialCondition ?? '',
        testStep: data.testStep ?? '',
        expectedResult: data.expectedResult ?? '',
      });
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [issueId]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  useEffect(() => {
    if (!socket) return;
    const onWsIssueUpdated = (data: Partial<TrackerIssueDetail> & { _id: string }) => {
      if (data._id !== issueId) return;
      setIssue(prev => prev ? { ...prev, ...data } : prev);
      onIssueUpdated?.(data._id, data);
    };
    const onCommentNew = (data: TrackerComment & { issueId: string }) => {
      if (data.issueId !== issueId) return;
      setIssue(prev => prev ? { ...prev, comments: [...prev.comments, data] } : prev);
      setTimeout(() => commentEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    };
    socket.on('tracker:issue:updated', onWsIssueUpdated);
    socket.on('tracker:comment:new', onCommentNew);
    return () => {
      socket.off('tracker:issue:updated', onWsIssueUpdated);
      socket.off('tracker:comment:new', onCommentNew);
    };
  }, [socket, issueId]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const isGithubIssue = !!(issue as any)?.githubIssueUrl || !!(issue as any)?.githubIssueNumber;
      const isBugLike = isGithubIssue || issue?.type === 'bug';
      const patch: Record<string, unknown> = {
        title: editForm.title,
        description: editForm.description,
        priority: editForm.priority,
        assignees: (!isGithubIssue && issue?.type === 'issue')
          ? (editForm.assignees ? [editForm.assignees] : [])
          : editForm.assignees.split(',').map(s => s.trim()).filter(Boolean),
        // status is only directly editable for bugs and GitHub issues; for GS issue/testcase it is derived
        ...(isBugLike ? {
          status: editForm.status,
          milestoneNumber: editForm.milestoneNumber,
          milestoneTitle: milestones.find(m => m.number === editForm.milestoneNumber)?.title ?? null,
        } : {}),
      };
      if (!isGithubIssue && issue?.type === 'testcase') {
        Object.assign(patch, {
          iosStatus: tcForm.iosStatus,
          androidStatus: tcForm.androidStatus,
          version: tcForm.version || null,
          actualResult: tcForm.actualResult,
          initialCondition: tcForm.initialCondition || null,
          testData: tcForm.testData || null,
          testStep: tcForm.testStep || null,
          expectedResult: tcForm.expectedResult || null,
        });
      }
      if (!isGithubIssue && issue?.type === 'issue') {
        Object.assign(patch, {
          module: issForm.module || null,
          severity: issForm.severity,
          statusTest: issForm.statusTest,
          statusDev: issForm.statusDev,
          device: issForm.device,
          actualResult: issForm.actualResult,
          evidence: issForm.evidence,
          note: issForm.note,
          issueDate: issForm.issueDate || null,
          initialCondition: issForm.initialCondition || null,
          testStep: issForm.testStep || null,
          expectedResult: issForm.expectedResult || null,
        });
      }
      await trackerApi.updateIssue(issueId, patch);
      setEditing(false);

      // Derive the new status so the header badge updates immediately
      let derivedStatus: TrackerIssueStatus | undefined;
      if (!isGithubIssue && issue?.type === 'testcase') {
        derivedStatus = deriveTestcaseStatus(tcForm.iosStatus, tcForm.androidStatus);
      } else if (!isGithubIssue && issue?.type === 'issue') {
        derivedStatus = deriveIssueStatus(issForm.statusDev);
      }
      const fullPatch = { ...patch, ...(derivedStatus ? { status: derivedStatus } : {}) } as Partial<TrackerIssueDetail>;
      setIssue(prev => prev ? { ...prev, ...fullPatch } : prev);
      onIssueUpdated?.(issueId, fullPatch);
    } catch (err) { alert((err as Error).message); }
    finally { setSaving(false); }
  };

  const handleQuickStatus = async (status: TrackerIssueStatus) => {
    try {
      await trackerApi.updateIssue(issueId, { status });
      setIssue(prev => prev ? { ...prev, status } : prev);
      onIssueUpdated?.(issueId, { status });
    } catch (err) { alert((err as Error).message); }
  };

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentBody.trim()) return;
    setSubmitting(true);
    try {
      await trackerApi.createComment(issueId, commentBody.trim());
      setCommentBody('');
      await load();
      setTimeout(() => commentEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    } catch (err) { alert((err as Error).message); }
    finally { setSubmitting(false); }
  };

  const handleUpdateComment = async (commentId: string) => {
    if (!editCommentBody.trim()) return;
    try {
      await trackerApi.updateComment(issueId, commentId, editCommentBody.trim());
      setEditingComment(null);
      await load();
    } catch (err) { alert((err as Error).message); }
  };

  const handleDeleteComment = async (commentId: string) => {
    if (!confirm('Delete this comment?')) return;
    try { await trackerApi.deleteComment(issueId, commentId); await load(); }
    catch (err) { alert((err as Error).message); }
  };

  const selectCls = 'w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 dark:bg-slate-700 dark:text-white text-sm focus:outline-none';
  const inputCls = 'w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 dark:bg-slate-700 dark:text-white text-sm focus:outline-none';
  const textareaCls = 'w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 dark:bg-slate-700 dark:text-white text-sm focus:outline-none resize-none';

  return (
    <div
      className="fixed inset-0 bg-black/60 z-50 flex items-start justify-center p-4 pt-12 overflow-y-auto"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-2xl mb-12">
        {/* Modal header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-700">
          <div className="flex items-center gap-2 min-w-0">
            {issue && (
              <>
                <span className="text-xs text-slate-400 font-mono shrink-0">#{(issue.githubIssueNumber ?? 0) > 0 ? issue.githubIssueNumber : issue.number}</span>
                {(issue.type === 'testcase' || issue.type === 'issue') && issue.sheetIssueId && (
                  <span className="text-xs text-slate-400 font-mono shrink-0 bg-slate-50 dark:bg-slate-700 px-1.5 py-0.5 rounded">
                    {issue.sheetIssueId}
                  </span>
                )}
                {(issue.type === 'bug' || !!(issue as any).githubIssueUrl) ? (
                  <select
                    value={issue.status}
                    onChange={e => handleQuickStatus(e.target.value as TrackerIssueStatus)}
                    className={`text-xs font-semibold px-2 py-0.5 rounded-full shrink-0 border-0 cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary/40 ${STATUS_COLOR[issue.status]}`}
                  >
                    <option value="todo">Todo</option>
                    <option value="inprogress">In Progress</option>
                    <option value="review">Review</option>
                    <option value="done">Done</option>
                  </select>
                ) : (
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full shrink-0 ${STATUS_COLOR[issue.status]}`}>
                    {STATUS_LABEL[issue.status]}
                  </span>
                )}
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full border uppercase shrink-0 ${PRIORITY_COLOR[issue.priority]}`}>
                  {issue.type === 'bug' ? (issue.priority === 'critical' ? 'Urgent' : issue.priority) : tcPriorityLabel(issue.priority)}
                </span>
                <span className={`text-xs shrink-0 ${issue.type === 'bug' ? 'text-red-400' : issue.type === 'testcase' ? 'text-blue-400' : 'text-orange-400'}`}>
                  <span className="material-symbols-outlined text-sm">
                    {issue.type === 'bug' ? 'bug_report' : issue.type === 'testcase' ? 'labs' : 'assignment_late'}
                  </span>
                </span>
                <h2 className="text-sm font-bold dark:text-white truncate ml-1">{issue.title}</h2>
              </>
            )}
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors shrink-0 ml-3">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        {loading ? (
          <div className="p-8 text-center text-slate-400">Loading…</div>
        ) : !issue ? (
          <div className="p-8 text-center text-red-400">Issue not found.</div>
        ) : (
          <div className="p-6 space-y-5">
            {(() => {
              const isGithubIssue = !!(issue as any).githubIssueUrl || !!(issue as any).githubIssueNumber;
              return !editing ? (
              <>
                {/* Edit button */}
                <div className="flex justify-end">
                  <button onClick={() => setEditing(true)} className="text-xs px-3 py-1 rounded-full text-slate-400 hover:text-primary hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors flex items-center gap-1">
                    <span className="material-symbols-outlined text-sm">edit</span>Edit
                  </button>
                </div>

                {/* ── Issue view ── */}
                {!isGithubIssue && issue.type === 'issue' ? (
                  <div className="space-y-4">
                    {/* Status row */}
                    <div className="grid grid-cols-3 gap-3">
                      <div className="bg-slate-50 dark:bg-slate-700/50 rounded-lg p-3">
                        <p className="text-xs text-slate-400 mb-2">Test Status</p>
                        <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${statusTestBadge(issue.statusTest)}`}>
                          {issue.statusTest ?? 'Not set'}
                        </span>
                      </div>
                      <div className="bg-slate-50 dark:bg-slate-700/50 rounded-lg p-3">
                        <p className="text-xs text-slate-400 mb-2">Dev Status</p>
                        <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${statusDevBadge(issue.statusDev)}`}>
                          {issue.statusDev ?? 'Not set'}
                        </span>
                      </div>
                      <div className="bg-slate-50 dark:bg-slate-700/50 rounded-lg p-3">
                        <p className="text-xs text-slate-400 mb-2">Device</p>
                        <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${deviceBadge(issue.device)}`}>
                          {issue.device ?? 'Not set'}
                        </span>
                      </div>
                    </div>

                    {/* Meta grid */}
                    <div className="grid grid-cols-2 gap-2">
                      {issue.module && (
                        <div className="bg-slate-50 dark:bg-slate-700/50 rounded-lg p-3">
                          <p className="text-xs text-slate-400 mb-1">Module</p>
                          <p className="text-sm font-medium dark:text-white">{issue.module}</p>
                        </div>
                      )}
                      {issue.severity && (
                        <div className="bg-slate-50 dark:bg-slate-700/50 rounded-lg p-3">
                          <p className="text-xs text-slate-400 mb-1">Severity</p>
                          <p className="text-sm font-medium dark:text-white">{issue.severity}</p>
                        </div>
                      )}
                      {issue.assignees.length > 0 && (
                        <div className="bg-slate-50 dark:bg-slate-700/50 rounded-lg p-3">
                          <p className="text-xs text-slate-400 mb-1">Assigned</p>
                          <p className="text-sm font-medium dark:text-white">{issue.assignees[0]}</p>
                        </div>
                      )}
                      {issue.issueDate && (
                        <div className="bg-slate-50 dark:bg-slate-700/50 rounded-lg p-3">
                          <p className="text-xs text-slate-400 mb-1">Date</p>
                          <p className="text-sm font-medium dark:text-white">{issue.issueDate}</p>
                        </div>
                      )}
                      {issue.sheetName && (
                        <div className="bg-slate-50 dark:bg-slate-700/50 rounded-lg p-3 col-span-2">
                          <p className="text-xs text-slate-400 mb-1">Sheet</p>
                          <p className="text-sm text-green-600 flex items-center gap-1">
                            <span className="material-symbols-outlined text-sm">table_chart</span>
                            {issue.sheetName}
                            {issue.sheetRowIndex && <span className="text-slate-400 text-xs">· row {issue.sheetRowIndex}</span>}
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Text fields */}
                    <TextBlock label="Description" value={issue.description} />
                    <TextBlock label="Precondition" value={issue.initialCondition} />
                    <TextBlock label="Steps to Reproduce" value={issue.testStep} />
                    <TextBlock label="Expected Result" value={issue.expectedResult} />
                    <TextBlock label="Actual Result" value={issue.actualResult} />
                    <TextBlock label="Evidence" value={issue.evidence} />
                    <TextBlock label="Note" value={issue.note} />
                  </div>

                ) : !isGithubIssue && issue.type === 'testcase' ? (
                  /* ── Testcase view ── */
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-slate-50 dark:bg-slate-700/50 rounded-lg p-3">
                        <p className="text-xs text-slate-400 mb-2 flex items-center gap-1">
                          <span className="material-symbols-outlined text-sm">phone_iphone</span>iOS
                        </p>
                        <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${tcResultBadge(issue.iosStatus)}`}>
                          {issue.iosStatus ?? 'Not set'}
                        </span>
                      </div>
                      <div className="bg-slate-50 dark:bg-slate-700/50 rounded-lg p-3">
                        <p className="text-xs text-slate-400 mb-2 flex items-center gap-1">
                          <span className="material-symbols-outlined text-sm">android</span>Android
                        </p>
                        <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${tcResultBadge(issue.androidStatus)}`}>
                          {issue.androidStatus ?? 'Not set'}
                        </span>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      {issue.version && (
                        <div className="bg-slate-50 dark:bg-slate-700/50 rounded-lg p-3">
                          <p className="text-xs text-slate-400 mb-1">Version</p>
                          <p className="text-sm font-medium dark:text-white">{issue.version}</p>
                        </div>
                      )}
                      <div className="bg-slate-50 dark:bg-slate-700/50 rounded-lg p-3">
                        <p className="text-xs text-slate-400 mb-1">Created</p>
                        <p className="text-sm font-medium dark:text-white">{new Date(issue.createdAt).toLocaleString()}</p>
                      </div>
                      {issue.sheetName && (
                        <div className="bg-slate-50 dark:bg-slate-700/50 rounded-lg p-3">
                          <p className="text-xs text-slate-400 mb-1">Sheet</p>
                          <p className="text-sm text-green-600 flex items-center gap-1">
                            <span className="material-symbols-outlined text-sm">table_chart</span>
                            {issue.sheetName}
                            {issue.sheetRowIndex && <span className="text-slate-400 text-xs">row {issue.sheetRowIndex}</span>}
                          </p>
                        </div>
                      )}
                    </div>
                    <TextBlock label="Initial Condition" value={issue.initialCondition} />
                    <TextBlock label="Test Data" value={issue.testData} />
                    <TextBlock label="Steps" value={issue.testStep} />
                    <TextBlock label="Expected Result" value={issue.expectedResult} />
                    <TextBlock label="Actual Result" value={issue.actualResult} />
                  </div>

                ) : (
                  /* ── Bug view ── */
                  <>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="bg-slate-50 dark:bg-slate-700/50 rounded-lg p-3">
                        <p className="text-xs text-slate-400 mb-1">Assignees</p>
                        <p className="dark:text-white font-medium text-sm">
                          {issue.assignees.length > 0 ? issue.assignees.join(', ') : <span className="text-slate-400">Unassigned</span>}
                        </p>
                      </div>
                      <div className="bg-slate-50 dark:bg-slate-700/50 rounded-lg p-3">
                        <p className="text-xs text-slate-400 mb-1">Created</p>
                        <p className="dark:text-white font-medium text-sm">{new Date(issue.createdAt).toLocaleString()}</p>
                      </div>
                      {issue.closedAt && (
                        <div className="bg-slate-50 dark:bg-slate-700/50 rounded-lg p-3">
                          <p className="text-xs text-slate-400 mb-1">Closed</p>
                          <p className="text-green-600 font-medium text-sm">{new Date(issue.closedAt).toLocaleString()}</p>
                        </div>
                      )}
                      {issue.githubIssueUrl && (
                        <div className="bg-slate-50 dark:bg-slate-700/50 rounded-lg p-3">
                          <p className="text-xs text-slate-400 mb-1">GitHub</p>
                          <a href={issue.githubIssueUrl} target="_blank" rel="noopener noreferrer"
                            className="text-primary text-sm hover:underline flex items-center gap-1">
                            <span className="material-symbols-outlined text-sm">open_in_new</span>View on GitHub
                          </a>
                        </div>
                      )}
                      {(issue as any).milestoneTitle && (
                        <div className="bg-purple-500/5 border border-purple-500/20 rounded-lg p-3">
                          <p className="text-xs text-slate-400 mb-1">Milestone</p>
                          <p className="text-purple-600 font-medium text-sm flex items-center gap-1">
                            🏁 {(issue as any).milestoneTitle}
                          </p>
                        </div>
                      )}
                    </div>
                    {issue.description && (
                      <div>
                        <p className="text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wide">Description</p>
                        <ChecklistDescription
                          description={issue.description}
                          issueId={issueId}
                          onUpdate={newDesc => {
                            setIssue(prev => prev ? { ...prev, description: newDesc } : prev);
                            setEditForm(prev => ({ ...prev, description: newDesc }));
                            onIssueUpdated?.(issueId, { description: newDesc } as Partial<TrackerIssueDetail>);
                          }}
                        />
                      </div>
                    )}
                  </>
                )}
              </>
            ) : (
              /* ── Edit form ── */
              <form onSubmit={handleSave} className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">
                    {!isGithubIssue && issue.type === 'testcase' ? 'Description' : 'Title'} *
                  </label>
                  <input required value={editForm.title} onChange={e => setEditForm(f => ({ ...f, title: e.target.value }))}
                    className={inputCls + ' focus:ring-2 focus:ring-primary/50'} />
                </div>

                {(isGithubIssue || issue.type === 'bug') && (
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1">Description</label>
                    <MarkdownEditor
                      value={editForm.description}
                      onChange={v => setEditForm(f => ({ ...f, description: v }))}
                      placeholder="Describe the issue… (supports Markdown)"
                      rows={4}
                    />
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                  {(isGithubIssue || issue.type === 'bug') && (
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 mb-1">Status</label>
                      <select value={editForm.status} onChange={e => setEditForm(f => ({ ...f, status: e.target.value as TrackerIssueStatus }))} className={selectCls}>
                        <option value="todo">Todo</option>
                        <option value="inprogress">In Progress</option>
                        <option value="review">Review</option>
                        <option value="done">Done</option>
                      </select>
                    </div>
                  )}
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1">Priority</label>
                    <select value={editForm.priority} onChange={e => setEditForm(f => ({ ...f, priority: e.target.value as TrackerIssuePriority }))} className={selectCls}>
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                      <option value="critical">{!isGithubIssue && issue.type === 'testcase' ? 'Highest' : 'Urgent'}</option>
                    </select>
                  </div>
                </div>

                {/* GitHub / Bug assignees + milestone */}
                {(isGithubIssue || issue.type === 'bug') && (
                  <>
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 mb-2">Assignees</label>
                      <div className="flex flex-wrap gap-2">
                        {ASSIGNEES.map(a => {
                          const currentAssignees = editForm.assignees.split(',').map(s => s.trim()).filter(Boolean);
                          const selected = currentAssignees.includes(a);
                          return (
                            <button key={a} type="button"
                              onClick={() => {
                                const next = selected
                                  ? currentAssignees.filter(x => x !== a)
                                  : [...currentAssignees, a];
                                setEditForm(f => ({ ...f, assignees: next.join(', ') }));
                              }}
                              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
                                selected
                                  ? 'bg-primary/10 border-primary text-primary'
                                  : 'bg-slate-50 dark:bg-slate-700 border-slate-200 dark:border-slate-600 text-slate-500 hover:border-primary/50'
                              }`}
                            >
                              <span className="w-5 h-5 rounded-full bg-slate-300 dark:bg-slate-500 flex items-center justify-center text-[10px] font-bold text-white shrink-0">
                                {a[0].toUpperCase()}
                              </span>
                              {a}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 mb-1">Milestone</label>
                      <select
                        value={editForm.milestoneNumber ?? ''}
                        onChange={e => setEditForm(f => ({ ...f, milestoneNumber: e.target.value ? Number(e.target.value) : null }))}
                        className={selectCls}
                        disabled={!milestonesLoaded}
                      >
                        <option value="">{milestonesLoaded ? 'No milestone' : 'Loading…'}</option>
                        {milestones.map(m => <option key={m.number} value={m.number}>{m.title}</option>)}
                      </select>
                    </div>
                  </>
                )}

                {/* Issue assignee: predefined dropdown (GS issues only) */}
                {!isGithubIssue && issue.type === 'issue' && (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 mb-1">Assigned</label>
                      <select value={editForm.assignees} onChange={e => setEditForm(f => ({ ...f, assignees: e.target.value }))} className={selectCls}>
                        <option value="">— Unassigned —</option>
                        {ASSIGNEES.map(a => <option key={a} value={a}>{a}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 mb-1">Module</label>
                      <input value={issForm.module} onChange={e => setIssForm(f => ({ ...f, module: e.target.value }))}
                        className={inputCls} placeholder="e.g. Auth" />
                    </div>
                  </div>
                )}

                {/* Testcase extra fields (sheet testcases only) */}
                {!isGithubIssue && issue.type === 'testcase' && (
                  <>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-slate-500 mb-1 flex items-center gap-1">
                          <span className="material-symbols-outlined text-sm">phone_iphone</span>iOS Result
                        </label>
                        <select value={tcForm.iosStatus ?? ''} onChange={e => setTcForm(f => ({ ...f, iosStatus: e.target.value || null }))} className={selectCls}>
                          <option value="">— Not set —</option>
                          {TC_RESULT_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-500 mb-1 flex items-center gap-1">
                          <span className="material-symbols-outlined text-sm">android</span>Android Result
                        </label>
                        <select value={tcForm.androidStatus ?? ''} onChange={e => setTcForm(f => ({ ...f, androidStatus: e.target.value || null }))} className={selectCls}>
                          <option value="">— Not set —</option>
                          {TC_RESULT_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                        </select>
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 mb-1">Version</label>
                      <input value={tcForm.version} onChange={e => setTcForm(f => ({ ...f, version: e.target.value }))}
                        className={inputCls} placeholder="e.g. 1.2.3" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 mb-1">Actual Result</label>
                      <textarea rows={2} value={tcForm.actualResult ?? ''} onChange={e => setTcForm(f => ({ ...f, actualResult: e.target.value || null }))} className={textareaCls} />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 mb-1">Initial Condition</label>
                      <textarea rows={2} value={tcForm.initialCondition} onChange={e => setTcForm(f => ({ ...f, initialCondition: e.target.value }))} className={textareaCls} />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 mb-1">Test Data</label>
                      <textarea rows={2} value={tcForm.testData} onChange={e => setTcForm(f => ({ ...f, testData: e.target.value }))} className={textareaCls} placeholder="Input data used for this test case…" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 mb-1">Steps</label>
                      <textarea rows={3} value={tcForm.testStep} onChange={e => setTcForm(f => ({ ...f, testStep: e.target.value }))} className={textareaCls} />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 mb-1">Expected Result</label>
                      <textarea rows={2} value={tcForm.expectedResult} onChange={e => setTcForm(f => ({ ...f, expectedResult: e.target.value }))} className={textareaCls} />
                    </div>
                  </>
                )}

                {/* Issue extra fields (GS issues only) */}
                {!isGithubIssue && issue.type === 'issue' && (
                  <>
                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-slate-500 mb-1">Test Status</label>
                        <select value={issForm.statusTest ?? ''} onChange={e => setIssForm(f => ({ ...f, statusTest: e.target.value || null }))} className={selectCls}>
                          <option value="">— Not set —</option>
                          {STATUS_TEST_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-500 mb-1">Dev Status</label>
                        <select value={issForm.statusDev ?? ''} onChange={e => setIssForm(f => ({ ...f, statusDev: e.target.value || null }))} className={selectCls}>
                          <option value="">— Not set —</option>
                          {STATUS_DEV_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-500 mb-1">Device</label>
                        <select value={issForm.device ?? ''} onChange={e => setIssForm(f => ({ ...f, device: e.target.value || null }))} className={selectCls}>
                          <option value="">— None —</option>
                          {DEVICE_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                        </select>
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 mb-1">Actual Result</label>
                      <textarea rows={2} value={issForm.actualResult ?? ''} onChange={e => setIssForm(f => ({ ...f, actualResult: e.target.value || null }))} className={textareaCls} />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 mb-1">Evidence</label>
                      <textarea rows={2} value={issForm.evidence ?? ''} onChange={e => setIssForm(f => ({ ...f, evidence: e.target.value || null }))} className={textareaCls} />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 mb-1">Note</label>
                      <textarea rows={2} value={issForm.note ?? ''} onChange={e => setIssForm(f => ({ ...f, note: e.target.value || null }))} className={textareaCls} />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 mb-1">Precondition</label>
                      <textarea rows={2} value={issForm.initialCondition} onChange={e => setIssForm(f => ({ ...f, initialCondition: e.target.value }))} className={textareaCls} />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 mb-1">Steps to Reproduce</label>
                      <textarea rows={3} value={issForm.testStep} onChange={e => setIssForm(f => ({ ...f, testStep: e.target.value }))} className={textareaCls} />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 mb-1">Expected Result</label>
                      <textarea rows={2} value={issForm.expectedResult} onChange={e => setIssForm(f => ({ ...f, expectedResult: e.target.value }))} className={textareaCls} />
                    </div>
                  </>
                )}

                <div className="flex gap-2 justify-end">
                  <button type="button" onClick={() => setEditing(false)} className="px-4 py-2 rounded-lg text-sm text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700">Cancel</button>
                  <button type="submit" disabled={saving} className="px-4 py-2 rounded-lg text-sm font-semibold bg-primary text-white hover:bg-blue-600 disabled:opacity-50">
                    {saving ? 'Saving…' : 'Save'}
                  </button>
                </div>
              </form>
            );
            })()}

            {/* Comments */}
            <div className="border-t border-slate-100 dark:border-slate-700 pt-5">
              <p className="text-xs font-semibold text-slate-400 mb-4">
                COMMENTS <span className="ml-1 font-normal">({issue.comments.length})</span>
              </p>
              <div className="space-y-4 mb-4 max-h-64 overflow-y-auto pr-1">
                {issue.comments.length === 0 && <p className="text-sm text-slate-400">No comments yet.</p>}
                {issue.comments.map((c: TrackerComment) => (
                  <div key={c._id} className="flex gap-3">
                    <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs font-bold shrink-0">
                      {c.author.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-semibold dark:text-white">{c.author}</span>
                        <span className="text-xs text-slate-400">{new Date(c.createdAt).toLocaleString()}</span>
                        <div className="ml-auto flex gap-1 shrink-0">
                          <button onClick={() => { setEditingComment(c._id); setEditCommentBody(c.body); }} className="text-slate-300 hover:text-primary transition-colors">
                            <span className="material-symbols-outlined text-sm">edit</span>
                          </button>
                          <button onClick={() => handleDeleteComment(c._id)} className="text-slate-300 hover:text-red-500 transition-colors">
                            <span className="material-symbols-outlined text-sm">delete</span>
                          </button>
                        </div>
                      </div>
                      {editingComment === c._id ? (
                        <div className="space-y-2">
                          <textarea rows={2} value={editCommentBody} onChange={e => setEditCommentBody(e.target.value)} className={textareaCls} />
                          <div className="flex gap-2">
                            <button onClick={() => setEditingComment(null)} className="text-xs px-3 py-1 rounded text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700">Cancel</button>
                            <button onClick={() => handleUpdateComment(c._id)} className="text-xs px-3 py-1 rounded bg-primary text-white hover:bg-blue-600">Save</button>
                          </div>
                        </div>
                      ) : (
                        <MarkdownRenderer className="bg-slate-50 dark:bg-slate-700/40 rounded-lg px-3 py-2">{c.body}</MarkdownRenderer>
                      )}
                    </div>
                  </div>
                ))}
                <div ref={commentEndRef} />
              </div>
              <form onSubmit={handleAddComment} className="space-y-2">
                <textarea rows={2} value={commentBody} onChange={e => setCommentBody(e.target.value)}
                  placeholder="Leave a comment…"
                  className={textareaCls + ' focus:ring-2 focus:ring-primary/50'} />
                <div className="flex justify-end">
                  <button type="submit" disabled={submitting || !commentBody.trim()}
                    className="px-4 py-2 rounded-lg text-sm font-semibold bg-primary text-white hover:bg-blue-600 disabled:opacity-50 transition-colors">
                    {submitting ? 'Posting…' : 'Comment'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
