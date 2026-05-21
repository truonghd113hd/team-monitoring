'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import Header from '@/components/header';
import { trackerApi } from '@/services/api';
import { useSocket } from '@/contexts/SocketContext';
import type { TrackerIssueDetail, TrackerIssueStatus, TrackerIssuePriority, TrackerComment } from '@/types/api';

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

const STATUS_TEST_OPTIONS = ['Passed', 'Wait', 'Close', 'Reopen'];
const STATUS_DEV_OPTIONS = ['Done', 'In progress', 'Reopen', 'Close'];
const TC_RESULT_OPTIONS = ['Pass', 'Failed', 'N/A', 'Untested'];

function deriveStatusFromDev(statusDev: string | null | undefined): TrackerIssueStatus {
  const l = (statusDev ?? '').toLowerCase().trim();
  if (l === 'done' || l === 'close') return 'done';
  if (l === 'in progress' || l === 'inprogress') return 'inprogress';
  return 'todo';
}

function deriveTestcaseStatus(ios: string, android: string): TrackerIssueStatus {
  if (ios === 'Pass' && android === 'Pass') return 'done';
  if (ios === 'Failed' || android === 'Failed') return 'inprogress';
  return 'todo';
}

function statusLabel(s: TrackerIssueStatus) {
  return s === 'inprogress' ? 'In Progress' : s.charAt(0).toUpperCase() + s.slice(1);
}

export default function IssueDetailPage() {
  const { projectId, issueId } = useParams<{ projectId: string; issueId: string }>();
  const { socket } = useSocket();
  const [issue, setIssue] = useState<TrackerIssueDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({ title: '', description: '', status: 'todo' as TrackerIssueStatus, priority: 'medium' as TrackerIssuePriority, assignees: '', statusTest: '', statusDev: '', iosStatus: '', androidStatus: '' });
  const [saving, setSaving] = useState(false);
  const [commentBody, setCommentBody] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [editingComment, setEditingComment] = useState<string | null>(null);
  const [editCommentBody, setEditCommentBody] = useState('');
  const commentEndRef = useRef<HTMLDivElement>(null);
  const issueRef = useRef<TrackerIssueDetail | null>(null);

  const load = async () => {
    try {
      const data = await trackerApi.getIssue(issueId);
      setIssue(data as TrackerIssueDetail);
      issueRef.current = data as TrackerIssueDetail;
      setEditForm({
        title: data.title,
        description: data.description,
        status: data.status,
        priority: data.priority,
        assignees: data.assignees.join(', '),
        statusTest: data.statusTest ?? '',
        statusDev: data.statusDev ?? '',
        iosStatus: data.iosStatus ?? '',
        androidStatus: data.androidStatus ?? '',
      });
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [issueId]);

  // WS subscriptions
  useEffect(() => {
    if (!socket) return;

    const onIssueUpdated = (data: Partial<TrackerIssueDetail> & { _id: string }) => {
      if (data._id !== issueId) return;
      setIssue(prev => {
        if (!prev) return prev;
        const next = { ...prev, ...data };
        issueRef.current = next;
        return next;
      });
    };

    const onCommentNew = (data: TrackerComment & { issueId: string }) => {
      if (data.issueId !== issueId) return;
      setIssue(prev => {
        if (!prev) return prev;
        const next = { ...prev, comments: [...prev.comments, data] };
        issueRef.current = next;
        return next;
      });
      setTimeout(() => commentEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    };

    socket.on('tracker:issue:updated', onIssueUpdated);
    socket.on('tracker:comment:new', onCommentNew);

    return () => {
      socket.off('tracker:issue:updated', onIssueUpdated);
      socket.off('tracker:comment:new', onCommentNew);
    };
  }, [socket, issueId]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const type = issue?.type;
      await trackerApi.updateIssue(issueId, {
        title: editForm.title,
        description: editForm.description,
        priority: editForm.priority,
        assignees: editForm.assignees.split(',').map(s => s.trim()).filter(Boolean),
        ...(type === 'issue'
          ? { statusTest: editForm.statusTest || null, statusDev: editForm.statusDev || null }
          : type === 'testcase'
          ? { iosStatus: editForm.iosStatus || null, androidStatus: editForm.androidStatus || null }
          : { status: editForm.status }),
      });
      setEditing(false);
      await load();
    } catch (err) { alert((err as Error).message); }
    finally { setSaving(false); }
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
    try {
      await trackerApi.deleteComment(issueId, commentId);
      await load();
    } catch (err) { alert((err as Error).message); }
  };

  const handleQuickStatus = async (status: TrackerIssueStatus) => {
    try {
      await trackerApi.updateIssue(issueId, { status });
      await load();
    } catch (err) { alert((err as Error).message); }
  };

  if (loading) return (
    <div className="flex flex-col h-full">
      <Header title="Issue" />
      <main className="flex-1 p-8"><div className="text-slate-400">Loading…</div></main>
    </div>
  );

  if (!issue) return (
    <div className="flex flex-col h-full">
      <Header title="Issue" />
      <main className="flex-1 p-8"><div className="text-red-400">Issue not found.</div></main>
    </div>
  );

  return (
    <div className="flex flex-col h-full">
      <Header title={`#${issue.number} ${issue.title}`} />
      <main className="flex-1 p-8 overflow-auto">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-slate-400 mb-6">
          <Link href="/tracker" className="hover:text-primary">Tracker</Link>
          <span>/</span>
          <Link href={`/tracker/${projectId}`} className="hover:text-primary">Project</Link>
          <span>/</span>
          <span className="dark:text-white font-medium">#{issue.number}</span>
        </div>

        <div className="max-w-3xl mx-auto space-y-6">
          {/* Issue card */}
          <div className="bg-white dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700 p-6">
            {!editing ? (
              <>
                {/* Title row */}
                <div className="flex items-start justify-between gap-4 mb-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs text-slate-400 font-mono">#{issue.number}</span>
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${STATUS_COLOR[issue.status]}`}>
                        {issue.status === 'inprogress' ? 'In Progress' : issue.status.charAt(0).toUpperCase() + issue.status.slice(1)}
                      </span>
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full border uppercase ${PRIORITY_COLOR[issue.priority]}`}>
                        {issue.priority}
                      </span>
                    </div>
                    <h1 className="text-xl font-bold dark:text-white">{issue.title}</h1>
                  </div>
                  <button onClick={() => setEditing(true)} className="text-slate-400 hover:text-primary transition-colors shrink-0">
                    <span className="material-symbols-outlined text-sm">edit</span>
                  </button>
                </div>

                {/* Quick status change — not available for GS issues/testcases (status is derived) */}
                {issue.type === 'bug' && (
                  <div className="flex gap-2 mb-4 flex-wrap">
                    {(['todo', 'inprogress', 'review', 'done'] as TrackerIssueStatus[]).map(s => (
                      <button key={s} onClick={() => handleQuickStatus(s)} disabled={issue.status === s}
                        className={`text-xs px-3 py-1 rounded-full font-medium transition-all ${
                          issue.status === s
                            ? STATUS_COLOR[s] + ' ring-2 ring-offset-1 ring-current'
                            : 'bg-slate-100 dark:bg-slate-700 text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-600'
                        }`}>
                        {s === 'inprogress' ? 'In Progress' : s.charAt(0).toUpperCase() + s.slice(1)}
                      </button>
                    ))}
                  </div>
                )}

                {/* Meta */}
                <div className="grid grid-cols-2 gap-3 text-sm mb-4">
                  <div className="bg-slate-50 dark:bg-slate-700/50 rounded-lg p-3">
                    <p className="text-xs text-slate-400 mb-1">Assignees</p>
                    <p className="dark:text-white font-medium">
                      {issue.assignees.length > 0 ? issue.assignees.join(', ') : <span className="text-slate-400">Unassigned</span>}
                    </p>
                  </div>
                  <div className="bg-slate-50 dark:bg-slate-700/50 rounded-lg p-3">
                    <p className="text-xs text-slate-400 mb-1">Created</p>
                    <p className="dark:text-white font-medium">{new Date(issue.createdAt).toLocaleString()}</p>
                  </div>
                  {issue.closedAt && (
                    <div className="bg-slate-50 dark:bg-slate-700/50 rounded-lg p-3">
                      <p className="text-xs text-slate-400 mb-1">Closed</p>
                      <p className="text-green-600 font-medium">{new Date(issue.closedAt).toLocaleString()}</p>
                    </div>
                  )}
                  <div className="bg-slate-50 dark:bg-slate-700/50 rounded-lg p-3">
                    <p className="text-xs text-slate-400 mb-1">Updated</p>
                    <p className="dark:text-white font-medium">{new Date(issue.updatedAt).toLocaleString()}</p>
                  </div>
                  {issue.type === 'issue' && (
                    <>
                      <div className="bg-slate-50 dark:bg-slate-700/50 rounded-lg p-3">
                        <p className="text-xs text-slate-400 mb-1">Test Status</p>
                        <p className="dark:text-white font-medium">{issue.statusTest ?? <span className="text-slate-400">—</span>}</p>
                      </div>
                      <div className="bg-slate-50 dark:bg-slate-700/50 rounded-lg p-3">
                        <p className="text-xs text-slate-400 mb-1">Dev Status</p>
                        <p className="dark:text-white font-medium">{issue.statusDev ?? <span className="text-slate-400">—</span>}</p>
                      </div>
                    </>
                  )}
                  {issue.type === 'testcase' && (
                    <>
                      <div className="bg-slate-50 dark:bg-slate-700/50 rounded-lg p-3">
                        <p className="text-xs text-slate-400 mb-1">iOS Status</p>
                        <p className="dark:text-white font-medium">{issue.iosStatus ?? <span className="text-slate-400">—</span>}</p>
                      </div>
                      <div className="bg-slate-50 dark:bg-slate-700/50 rounded-lg p-3">
                        <p className="text-xs text-slate-400 mb-1">Android Status</p>
                        <p className="dark:text-white font-medium">{issue.androidStatus ?? <span className="text-slate-400">—</span>}</p>
                      </div>
                    </>
                  )}
                </div>

                {/* Description */}
                <div>
                  <p className="text-xs font-semibold text-slate-400 mb-2">DESCRIPTION</p>
                  {issue.description ? (
                    <p className="text-sm dark:text-slate-200 whitespace-pre-wrap leading-relaxed">{issue.description}</p>
                  ) : (
                    <p className="text-sm text-slate-400 italic">No description provided.</p>
                  )}
                </div>
              </>
            ) : (
              /* Edit form */
              <form onSubmit={handleSave} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Title *</label>
                  <input required value={editForm.title} onChange={e => setEditForm(f => ({ ...f, title: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 dark:bg-slate-700 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Description</label>
                  <textarea rows={5} value={editForm.description} onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 dark:bg-slate-700 dark:text-white text-sm focus:outline-none resize-none" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {issue.type === 'issue' ? (
                    <>
                      <div>
                        <label className="block text-xs font-semibold text-slate-500 mb-1">Test Status</label>
                        <select value={editForm.statusTest} onChange={e => setEditForm(f => ({ ...f, statusTest: e.target.value }))}
                          className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 dark:bg-slate-700 dark:text-white text-sm focus:outline-none">
                          <option value="">— none —</option>
                          {STATUS_TEST_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-500 mb-1">Dev Status</label>
                        <select value={editForm.statusDev} onChange={e => setEditForm(f => ({ ...f, statusDev: e.target.value }))}
                          className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 dark:bg-slate-700 dark:text-white text-sm focus:outline-none">
                          <option value="">— none —</option>
                          {STATUS_DEV_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                        </select>
                      </div>
                      <div className="col-span-2">
                        <p className="text-xs text-slate-400">Derived status: <span className={`font-semibold px-1.5 py-0.5 rounded ${STATUS_COLOR[deriveStatusFromDev(editForm.statusDev)]}`}>{statusLabel(deriveStatusFromDev(editForm.statusDev))}</span></p>
                      </div>
                    </>
                  ) : issue.type === 'testcase' ? (
                    <>
                      <div>
                        <label className="block text-xs font-semibold text-slate-500 mb-1">iOS Status</label>
                        <select value={editForm.iosStatus} onChange={e => setEditForm(f => ({ ...f, iosStatus: e.target.value }))}
                          className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 dark:bg-slate-700 dark:text-white text-sm focus:outline-none">
                          <option value="">— none —</option>
                          {TC_RESULT_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-500 mb-1">Android Status</label>
                        <select value={editForm.androidStatus} onChange={e => setEditForm(f => ({ ...f, androidStatus: e.target.value }))}
                          className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 dark:bg-slate-700 dark:text-white text-sm focus:outline-none">
                          <option value="">— none —</option>
                          {TC_RESULT_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                        </select>
                      </div>
                      <div className="col-span-2">
                        <p className="text-xs text-slate-400">Derived status: <span className={`font-semibold px-1.5 py-0.5 rounded ${STATUS_COLOR[deriveTestcaseStatus(editForm.iosStatus, editForm.androidStatus)]}`}>{statusLabel(deriveTestcaseStatus(editForm.iosStatus, editForm.androidStatus))}</span></p>
                      </div>
                    </>
                  ) : (
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 mb-1">Status</label>
                      <select value={editForm.status} onChange={e => setEditForm(f => ({ ...f, status: e.target.value as TrackerIssueStatus }))}
                        className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 dark:bg-slate-700 dark:text-white text-sm focus:outline-none">
                        <option value="todo">Todo</option>
                        <option value="inprogress">In Progress</option>
                        <option value="review">Review</option>
                        <option value="done">Done</option>
                      </select>
                    </div>
                  )}
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1">Priority</label>
                    <select value={editForm.priority} onChange={e => setEditForm(f => ({ ...f, priority: e.target.value as TrackerIssuePriority }))}
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 dark:bg-slate-700 dark:text-white text-sm focus:outline-none">
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                      <option value="critical">Critical</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Assignees</label>
                  <input value={editForm.assignees} onChange={e => setEditForm(f => ({ ...f, assignees: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 dark:bg-slate-700 dark:text-white text-sm focus:outline-none"
                    placeholder="alice, bob (comma separated)" />
                </div>
                <div className="flex gap-2 justify-end">
                  <button type="button" onClick={() => setEditing(false)} className="px-4 py-2 rounded-lg text-sm text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700">Cancel</button>
                  <button type="submit" disabled={saving} className="px-4 py-2 rounded-lg text-sm font-semibold bg-primary text-white hover:bg-blue-600 disabled:opacity-50">
                    {saving ? 'Saving…' : 'Save'}
                  </button>
                </div>
              </form>
            )}
          </div>

          {/* Comments */}
          <div className="bg-white dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700 p-6">
            <p className="text-xs font-semibold text-slate-400 mb-4">
              COMMENTS <span className="ml-1 font-normal">({issue.comments.length})</span>
            </p>

            {issue.comments.length === 0 && (
              <p className="text-sm text-slate-400 mb-4">No comments yet. Be the first!</p>
            )}

            <div className="space-y-4 mb-6">
              {issue.comments.map((c: TrackerComment) => (
                <div key={c._id} className="flex gap-3">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs font-bold shrink-0">
                    {c.author.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-semibold dark:text-white">{c.author}</span>
                      <span className="text-xs text-slate-400">{new Date(c.createdAt).toLocaleString()}</span>
                      {c.updatedAt !== c.createdAt && (
                        <span className="text-[10px] text-slate-400 italic">(edited)</span>
                      )}
                      <div className="ml-auto flex gap-1">
                        <button onClick={() => { setEditingComment(c._id); setEditCommentBody(c.body); }}
                          className="text-slate-300 hover:text-primary transition-colors">
                          <span className="material-symbols-outlined text-sm">edit</span>
                        </button>
                        <button onClick={() => handleDeleteComment(c._id)} className="text-slate-300 hover:text-red-500 transition-colors">
                          <span className="material-symbols-outlined text-sm">delete</span>
                        </button>
                      </div>
                    </div>
                    {editingComment === c._id ? (
                      <div className="space-y-2">
                        <textarea rows={3} value={editCommentBody} onChange={e => setEditCommentBody(e.target.value)}
                          className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 dark:bg-slate-700 dark:text-white text-sm focus:outline-none resize-none" />
                        <div className="flex gap-2">
                          <button onClick={() => setEditingComment(null)} className="text-xs px-3 py-1 rounded text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700">Cancel</button>
                          <button onClick={() => handleUpdateComment(c._id)} className="text-xs px-3 py-1 rounded bg-primary text-white hover:bg-blue-600">Save</button>
                        </div>
                      </div>
                    ) : (
                      <p className="text-sm dark:text-slate-200 whitespace-pre-wrap leading-relaxed bg-slate-50 dark:bg-slate-700/40 rounded-lg px-3 py-2">
                        {c.body}
                      </p>
                    )}
                  </div>
                </div>
              ))}
              <div ref={commentEndRef} />
            </div>

            {/* Add comment */}
            <form onSubmit={handleAddComment} className="space-y-2">
              <textarea
                rows={3}
                value={commentBody}
                onChange={e => setCommentBody(e.target.value)}
                placeholder="Leave a comment…"
                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 dark:bg-slate-700 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none"
              />
              <div className="flex justify-end">
                <button type="submit" disabled={submitting || !commentBody.trim()}
                  className="px-4 py-2 rounded-lg text-sm font-semibold bg-primary text-white hover:bg-blue-600 disabled:opacity-50 transition-colors">
                  {submitting ? 'Posting…' : 'Comment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </main>
    </div>
  );
}
