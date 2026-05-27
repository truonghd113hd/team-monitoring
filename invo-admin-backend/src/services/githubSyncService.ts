import axios from 'axios';
import mongoose from 'mongoose';
import TrackerProject from '../models/TrackerProject';
import TrackerIssue, { IssueStatus, IssuePriority } from '../models/TrackerIssue';
import TrackerComment from '../models/TrackerComment';
import { sendTelegramMessage } from './telegramService';
import { emit } from './wsService';

const getGithubToken = () => process.env.PERSONAL_TOKEN || process.env.GITHUB_TOKEN || '';

const ghHeaders = () => ({
  Authorization: `Bearer ${getGithubToken()}`,
  'Content-Type': 'application/json',
  'X-GitHub-Api-Version': '2022-11-28',
});

// ── Helpers ───────────────────────────────────────────────────────────────────

function mapStatus(githubStatus: string, issueState?: string): IssueStatus {
  if (issueState === 'CLOSED') return 'done';
  const s = (githubStatus || '').toLowerCase();
  if (s.includes('progress') || s.includes('doing') || s.includes('wip')) return 'inprogress';
  if (s.includes('review') || s.includes('testing') || s.includes('qa')) return 'review';
  if (s.includes('done') || s.includes('close') || s.includes('complet') || s.includes('merged')) return 'done';
  return 'todo';
}

function mapPriority(labels: string[]): IssuePriority {
  for (const l of labels) {
    const lower = l.toLowerCase();
    if (lower.includes('urgent') || lower.includes('critical') || lower.includes('blocker') || lower.includes('p0')) return 'critical';
    if (lower.includes('high') || lower.includes('p1')) return 'high';
    if (lower.includes('low') || lower.includes('p3')) return 'low';
  }
  return 'medium';
}

export function priorityToGithubLabel(priority: string): string {
  if (priority === 'critical') return 'Urgent';
  if (priority === 'high') return 'High';
  if (priority === 'low') return 'Low';
  return 'Medium';
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// ── GitHub GraphQL fetch ──────────────────────────────────────────────────────

const PROJECT_ITEMS_QUERY = `
query($projectId: ID!, $after: String) {
  node(id: $projectId) {
    ... on ProjectV2 {
      id
      title
      shortDescription
      fields(first: 20) {
        nodes {
          ... on ProjectV2SingleSelectField {
            id
            name
            options { id name }
          }
        }
      }
      items(first: 100, after: $after) {
        nodes {
          id
          type
          content {
            ... on Issue {
              id
              title
              number
              url
              state
              body
              createdAt
              updatedAt
              milestone { number title }
              assignees(first: 10) {
                nodes { login name }
              }
              labels(first: 10) {
                nodes { name }
              }
              comments(last: 10) {
                totalCount
                nodes {
                  id
                  body
                  createdAt
                  author { login }
                }
              }
            }
          }
          fieldValues(first: 20) {
            nodes {
              ... on ProjectV2ItemFieldSingleSelectValue {
                name
                field { ... on ProjectV2FieldCommon { name } }
              }
              ... on ProjectV2ItemFieldTextValue {
                text
                field { ... on ProjectV2FieldCommon { name } }
              }
              ... on ProjectV2ItemFieldNumberValue {
                number
                field { ... on ProjectV2FieldCommon { name } }
              }
            }
          }
        }
        pageInfo { hasNextPage endCursor }
      }
    }
  }
}`;

async function fetchProjectItems(projectId: string): Promise<any | null> {
  if (!getGithubToken()) return null;
  try {
    let allNodes: any[] = [];
    let after: string | null = null;
    let meta: any = null;

    do {
      const response: any = await axios.post(
        'https://api.github.com/graphql',
        { query: PROJECT_ITEMS_QUERY, variables: { projectId, after } },
        { headers: ghHeaders(), timeout: 20_000 }
      );
      if (response.data.errors) {
        console.error('[GITHUB_SYNC] GraphQL errors:', response.data.errors);
        return null;
      }
      const node = response.data.data?.node;
      if (!node) return null;

      if (!meta) {
        // Extract status single-select field from first page (fields are project-level, same on all pages)
        const statusField = (node.fields?.nodes || []).find(
          (f: any) => f?.name?.toLowerCase() === 'status' && Array.isArray(f?.options)
        );
        meta = {
          id: node.id,
          title: node.title,
          shortDescription: node.shortDescription,
          statusFieldId: statusField?.id ?? null,
          statusOptions: statusField?.options ?? [],
        };
      }

      allNodes.push(...(node.items?.nodes || []));
      after = node.items?.pageInfo?.hasNextPage ? node.items.pageInfo.endCursor : null;
    } while (after);

    return { ...meta, items: allNodes };
  } catch (err) {
    console.error('[GITHUB_SYNC] Fetch failed:', (err as Error).message);
    return null;
  }
}

// ── Sync one project ──────────────────────────────────────────────────────────

interface SyncStats {
  newIssues: number;
  updatedIssues: number;
  newComments: number;
  statusChanges: Array<{ title: string; from: string; to: string; url: string }>;
  newIssueList: Array<{ title: string; number: number; url: string; assignees: string[] }>;
  newCommentList: Array<{ issueTitle: string; issueUrl: string; author: string; body: string }>;
}

async function syncProject(trackerProject: InstanceType<typeof TrackerProject>): Promise<void> {
  const githubProjectId = trackerProject.githubProjectId!;
  console.log(`[GITHUB_SYNC] Syncing "${trackerProject.name}" (${githubProjectId})`);

  const projectData = await fetchProjectItems(githubProjectId);
  if (!projectData) {
    console.log(`[GITHUB_SYNC] Failed to fetch GitHub data for project ${githubProjectId}`);
    return;
  }

  // Sync project name/description from GitHub if it has changed
  if (trackerProject.name !== projectData.title) {
    await TrackerProject.updateOne(
      { _id: trackerProject._id },
      { $set: { name: projectData.title, description: projectData.shortDescription || trackerProject.description } }
    );
  }

  const projectId = trackerProject._id as mongoose.Types.ObjectId;

  // Detect initial import: no issues in DB yet for this project
  const existingCount = await TrackerIssue.countDocuments({ projectId });
  const isInitialSync = existingCount === 0;

  const stats: SyncStats = {
    newIssues: 0, updatedIssues: 0, newComments: 0,
    statusChanges: [], newIssueList: [], newCommentList: []
  };

  for (const item of projectData.items) {
    if (item.type !== 'ISSUE' || !item.content) continue;
    const gh = item.content;

    // Extract project status field value
    let githubStatus = '';
    for (const fv of (item.fieldValues?.nodes || [])) {
      const fieldName = (fv.field?.name || '').toLowerCase();
      if (fieldName === 'status' && fv.name) {
        githubStatus = fv.name;
        break;
      }
    }

    const status = mapStatus(githubStatus, gh.state);
    const labels: string[] = (gh.labels?.nodes || []).map((l: any) => l.name);
    const priority = mapPriority(labels);
    const assignees: string[] = (gh.assignees?.nodes || []).map((a: any) => a.login);
    const closedAt = gh.state === 'CLOSED' ? new Date(gh.updatedAt) : null;
    const milestoneNumber: number | null = gh.milestone?.number ?? null;
    const milestoneTitle: string | null = gh.milestone?.title ?? null;

    // Get current DB state for this issue
    const existing = await TrackerIssue.findOne({ githubIssueId: gh.id });

    if (!existing) {
      const last = await TrackerIssue.findOne({ projectId }).sort({ number: -1 }).lean();
      const number = (last?.number ?? 0) + 1;

      const created = await TrackerIssue.create({
        projectId, number,
        title: gh.title,
        description: gh.body || '',
        status, priority, assignees, closedAt,
        githubIssueId: gh.id,
        githubIssueUrl: gh.url,
        githubIssueNumber: gh.number,
        githubProjectItemId: item.id,
        milestoneNumber, milestoneTitle,
      });
      emit('tracker:issue:new', {
        _id: String(created._id),
        projectId: String(projectId),
        number: created.number,
        title: created.title,
        status: created.status,
        priority: created.priority,
        assignees: created.assignees,
        createdAt: created.createdAt,
        updatedAt: created.createdAt,
      });
      stats.newIssues++;
      // Only queue individual notifications on incremental syncs
      if (!isInitialSync) {
        stats.newIssueList.push({ title: gh.title, number: gh.number, url: gh.url, assignees });
      }
    } else {
      // Compare DB state vs GitHub state — only notify on real diffs
      if (existing.status !== status) {
        stats.statusChanges.push({
          title: gh.title,
          from: existing.status,
          to: status,
          url: gh.url || existing.githubIssueUrl || ''
        });
      }

      const changed =
        existing.status !== status ||
        existing.title !== gh.title ||
        (existing.description || '') !== (gh.body || '') ||
        JSON.stringify(existing.assignees) !== JSON.stringify(assignees) ||
        existing.priority !== priority ||
        existing.milestoneNumber !== milestoneNumber;

      if (changed) {
        await TrackerIssue.updateOne(
          { _id: existing._id },
          { $set: { title: gh.title, description: gh.body || '', status, priority, assignees, closedAt, milestoneNumber, milestoneTitle, githubProjectItemId: item.id } }
        );
        emit('tracker:issue:updated', {
          _id: String(existing._id),
          projectId: String(projectId),
          title: gh.title,
          status,
          priority,
          assignees,
          closedAt,
          milestoneNumber,
          milestoneTitle,
        });
        if (!stats.statusChanges.find(s => s.title === gh.title)) stats.updatedIssues++;
      }

      // Sync comments — only notify on incremental syncs
      const issueId = existing._id as mongoose.Types.ObjectId;
      const comments: any[] = gh.comments?.nodes || [];
      for (const c of comments) {
        const existingComment = await TrackerComment.findOne({ githubCommentId: c.id });
        if (!existingComment) {
          const newComment = await TrackerComment.create({
            issueId,
            author: c.author?.login || 'github',
            body: c.body || '',
            githubCommentId: c.id
          });
          emit('tracker:comment:new', {
            _id: String(newComment._id),
            issueId: String(issueId),
            issueTitle: gh.title,
            author: newComment.author,
            body: newComment.body,
            createdAt: newComment.createdAt,
            updatedAt: newComment.createdAt,
          });
          stats.newComments++;
          if (!isInitialSync) {
            stats.newCommentList.push({
              issueTitle: gh.title,
              issueUrl: gh.url || '',
              author: c.author?.login || 'github',
              body: c.body || ''
            });
          }
        } else if ((existingComment.body || '') !== (c.body || '')) {
          await TrackerComment.updateOne(
            { _id: existingComment._id },
            { $set: { body: c.body || '', author: c.author?.login || existingComment.author } }
          );
        }
      }
    }
  }

  console.log(`[GITHUB_SYNC] ${projectData.title}: +${stats.newIssues} issues, ${stats.updatedIssues} updated, ${stats.statusChanges.length} status changes, +${stats.newComments} comments`);

  // Auto-detect repo and store milestones in the project for offline use
  const detectedRepo = trackerProject.githubRepo ||
    (() => {
      const firstIssue = projectData.items.find((i: any) => i.type === 'ISSUE' && i.content?.url);
      return firstIssue ? repoFromIssueUrl(firstIssue.content.url) : null;
    })();

  if (detectedRepo) {
    const milestones = await getGithubMilestones(detectedRepo);
    const projectUpdate: Record<string, unknown> = { githubRepo: detectedRepo, githubMilestones: milestones };
    if (projectData.statusFieldId) {
      projectUpdate.githubStatusFieldId = projectData.statusFieldId;
      projectUpdate.githubStatusOptions = projectData.statusOptions;
    }
    await TrackerProject.updateOne({ _id: trackerProject._id }, { $set: projectUpdate });
  }

  await sendSyncNotifications(projectData.title, stats, isInitialSync);

  emit('tracker:project:synced', {
    projectId: String(trackerProject._id),
    source: 'github',
    newIssues: stats.newIssues,
    updatedIssues: stats.updatedIssues,
  });
}

// ── Telegram notifications (mirrors old notifyTelegram logic) ─────────────────

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

async function safeSend(msg: string): Promise<void> {
  try {
    await sendTelegramMessage(msg);
    await sleep(700); // stay well under Telegram's 30 msg/s limit
  } catch (err: any) {
    if (err?.response?.status === 429) {
      const retryAfter = (err.response?.data?.parameters?.retry_after ?? 5) * 1000 + 500;
      console.warn(`[TELEGRAM] Rate limited — waiting ${retryAfter}ms`);
      await sleep(retryAfter);
      await sendTelegramMessage(msg).catch(() => {}); // one retry
    }
  }
}

async function sendSyncNotifications(projectTitle: string, stats: SyncStats, isInitialSync: boolean): Promise<void> {
  // On initial import send a single summary instead of per-issue messages
  if (isInitialSync) {
    if (stats.newIssues > 0) {
      const msg = [
        `📥 <b>[${escapeHtml(projectTitle)}] Initial Import Complete</b>`,
        `✅ Imported <b>${stats.newIssues}</b> issue${stats.newIssues !== 1 ? 's' : ''} from GitHub`
      ].join('\n');
      await safeSend(msg);
    }
    return;
  }

  const statusLabel = (s: string) => {
    const m: Record<string, string> = { todo: '📋 Todo', inprogress: '🔄 In Progress', review: '👀 Review', done: '✅ Done' };
    return m[s] || s;
  };

  // Status changes — compare DB vs GitHub, notify only real diffs
  for (const sc of stats.statusChanges) {
    const msg = [
      `🔄 <b>[${escapeHtml(projectTitle)}] Status Change</b>`,
      `📌 <b>${escapeHtml(sc.title)}</b>`,
      `${statusLabel(sc.from)} → ${statusLabel(sc.to)}`,
      sc.url ? `<a href="${sc.url}">View Issue</a>` : ''
    ].filter(Boolean).join('\n');
    await safeSend(msg);
  }

  // New issues (batch when > 3 to avoid flooding)
  if (stats.newIssueList.length > 0) {
    if (stats.newIssueList.length <= 3) {
      for (const issue of stats.newIssueList) {
        const msg = [
          `🆕 <b>[${escapeHtml(projectTitle)}] New Issue #${issue.number}</b>`,
          `📌 <b>${escapeHtml(issue.title)}</b>`,
          issue.assignees.length > 0 ? `👤 ${issue.assignees.map(a => `@${escapeHtml(a)}`).join(', ')}` : '',
          issue.url ? `<a href="${issue.url}">View Issue</a>` : ''
        ].filter(Boolean).join('\n');
        await safeSend(msg);
      }
    } else {
      const msg = [
        `🆕 <b>[${escapeHtml(projectTitle)}] ${stats.newIssueList.length} New Issues</b>`,
        ...stats.newIssueList.slice(0, 5).map(i => `• #${i.number} ${escapeHtml(i.title)}`),
        stats.newIssueList.length > 5 ? `… and ${stats.newIssueList.length - 5} more` : ''
      ].filter(Boolean).join('\n');
      await safeSend(msg);
    }
  }

  // New comments
  for (const c of stats.newCommentList) {
    const preview = c.body.length > 100 ? c.body.slice(0, 100) + '…' : c.body;
    const msg = [
      `💬 <b>[${escapeHtml(projectTitle)}] New Comment</b>`,
      `📌 ${escapeHtml(c.issueTitle)}`,
      `👤 @${escapeHtml(c.author)}: <i>${escapeHtml(preview)}</i>`,
      c.issueUrl ? `<a href="${c.issueUrl}">View Issue</a>` : ''
    ].filter(Boolean).join('\n');
    await safeSend(msg);
  }
}

// ── Build rich GitHub issue body (mirrors the sheet-to-github script) ─────────

export interface GsIssueFields {
  id?: string | null;
  module?: string | null;
  description?: string | null;
  initialCondition?: string | null;   // precondition
  testStep?: string | null;           // steps to reproduce
  expectedResult?: string | null;
  actualResult?: string | null;
  evidence?: string | null;           // plain text / URL string
  priority?: string | null;
  severity?: string | null;
  device?: string | null;
  note?: string | null;
  issueDate?: string | null;
}

export function buildGsIssueGithubBody(fields: GsIssueFields): string {
  let body = '';
  if (fields.description) body += `## Description\n${fields.description}\n\n`;
  if (fields.initialCondition) body += `## Precondition\n${fields.initialCondition}\n\n`;
  if (fields.testStep) body += `## Steps to Reproduce\n${fields.testStep}\n\n`;
  if (fields.expectedResult) body += `## Expected Result\n${fields.expectedResult}\n\n`;
  if (fields.actualResult) body += `## Actual Result\n${fields.actualResult}\n\n`;
  if (fields.evidence) {
    const urls = fields.evidence.match(/https?:\/\/[^\s]+/g);
    if (urls && urls.length > 0) {
      body += `## Evidence\n${urls.map(u => `- [${u}](${u})`).join('\n')}\n\n`;
    } else {
      body += `## Evidence\n${fields.evidence}\n\n`;
    }
  }
  const meta: string[] = [];
  if (fields.id) meta.push(`- ID: ${fields.id}`);
  if (fields.priority) meta.push(`- Priority: ${fields.priority}`);
  if (fields.severity) meta.push(`- Severity: ${fields.severity}`);
  if (fields.device) meta.push(`- Device: ${fields.device}`);
  if (fields.issueDate) meta.push(`- Date: ${fields.issueDate}`);
  if (fields.note) meta.push(`- Note: ${fields.note}`);
  if (meta.length > 0) body += `---\n**Metadata**\n${meta.join('\n')}`;
  return body.trim();
}

// ── Create GitHub issue and add to project ────────────────────────────────────

const ADD_ITEM_MUTATION = `
mutation($projectId: ID!, $contentId: ID!) {
  addProjectV2ItemById(input: { projectId: $projectId, contentId: $contentId }) {
    item { id }
  }
}`;

// Extract "owner/repo" from a GitHub issue URL
export function repoFromIssueUrl(url: string): string | null {
  try {
    const parts = new URL(url).pathname.split('/').filter(Boolean);
    // /owner/repo/issues/number
    if (parts.length >= 4 && parts[2] === 'issues') return `${parts[0]}/${parts[1]}`;
    return null;
  } catch { return null; }
}

export interface GithubMilestone {
  number: number;
  title: string;
  state: 'open' | 'closed';
  dueOn: string | null;
}

export async function getGithubMilestones(repo: string): Promise<GithubMilestone[]> {
  const token = getGithubToken();
  if (!token) return [];
  const [owner, repoName] = repo.split('/');
  if (!owner || !repoName) return [];
  try {
    const res = await axios.get(
      `https://api.github.com/repos/${owner}/${repoName}/milestones?state=open&per_page=100`,
      { headers: ghHeaders(), timeout: 10_000 }
    );
    return (res.data as any[]).map(m => ({
      number: m.number,
      title: m.title,
      state: m.state,
      dueOn: m.due_on ?? null,
    }));
  } catch (err) {
    console.error('[GITHUB_SYNC] getGithubMilestones failed:', (err as Error).message);
    return [];
  }
}

export async function updateGithubIssue(repo: string, issueNumber: number, opts: {
  state?: 'open' | 'closed';
  milestoneNumber?: number | null;
  title?: string;
  body?: string;
  assignees?: string[];
}): Promise<boolean> {
  const token = getGithubToken();
  if (!token) return false;
  const [owner, repoName] = repo.split('/');
  if (!owner || !repoName) return false;
  const payload: Record<string, unknown> = {};
  if (opts.state !== undefined) payload.state = opts.state;
  if (opts.milestoneNumber !== undefined) payload.milestone = opts.milestoneNumber ?? null;
  if (opts.title !== undefined) payload.title = opts.title;
  if (opts.body !== undefined) payload.body = opts.body;
  if (opts.assignees !== undefined) payload.assignees = opts.assignees;
  if (Object.keys(payload).length === 0) return true;
  try {
    await axios.patch(
      `https://api.github.com/repos/${owner}/${repoName}/issues/${issueNumber}`,
      payload,
      { headers: ghHeaders(), timeout: 10_000 }
    );
    return true;
  } catch (err) {
    console.error('[GITHUB_SYNC] updateGithubIssue failed:', (err as Error).message);
    return false;
  }
}

export async function createGithubIssue(opts: {
  repo: string;
  title: string;
  body?: string;
  assignees?: string[];
  labels?: string[];
  milestoneNumber?: number | null;
}): Promise<{ id: string; number: number; url: string } | null> {
  const token = getGithubToken();
  if (!token) return null;
  const [owner, repoName] = opts.repo.split('/');
  if (!owner || !repoName) return null;
  try {
    const res = await axios.post(
      `https://api.github.com/repos/${owner}/${repoName}/issues`,
      {
        title: opts.title,
        body: opts.body || '',
        assignees: opts.assignees || [],
        labels: opts.labels || [],
        ...(opts.milestoneNumber != null ? { milestone: opts.milestoneNumber } : {}),
      },
      { headers: ghHeaders(), timeout: 15_000 }
    );
    const data = res.data;
    return { id: data.node_id, number: data.number, url: data.html_url };
  } catch (err) {
    console.error('[GITHUB_SYNC] createGithubIssue failed:', (err as Error).message);
    return null;
  }
}

const LOOKUP_PROJECT_ITEM_QUERY = `
query($issueId: ID!) {
  node(id: $issueId) {
    ... on Issue {
      projectItems(first: 10) {
        nodes {
          id
          project { id }
        }
      }
    }
  }
}`;

export async function lookupProjectItemId(issueNodeId: string, projectNodeId: string): Promise<string | null> {
  const token = getGithubToken();
  if (!token || !issueNodeId || !projectNodeId) return null;
  try {
    const res: any = await axios.post(
      'https://api.github.com/graphql',
      { query: LOOKUP_PROJECT_ITEM_QUERY, variables: { issueId: issueNodeId } },
      { headers: ghHeaders(), timeout: 10_000 }
    );
    if (res.data.errors) return null;
    const items: any[] = res.data.data?.node?.projectItems?.nodes || [];
    const match = items.find((n: any) => n.project?.id === projectNodeId);
    return match?.id ?? null;
  } catch (err) {
    console.error('[GITHUB_SYNC] lookupProjectItemId failed:', (err as Error).message);
    return null;
  }
}

const UPDATE_PROJECT_FIELD_MUTATION = `
mutation($projectId: ID!, $itemId: ID!, $fieldId: ID!, $optionId: String!) {
  updateProjectV2ItemFieldValue(
    input: {
      projectId: $projectId
      itemId: $itemId
      fieldId: $fieldId
      value: { singleSelectOptionId: $optionId }
    }
  ) {
    projectV2Item { id }
  }
}`;

function findStatusOptionId(options: Array<{ id: string; name: string }>, internalStatus: string): string | null {
  const candidates: Record<string, string[]> = {
    todo:       ['todo', 'to do', 'to-do', 'backlog', 'open', 'new', 'ready'],
    inprogress: ['in progress', 'inprogress', 'in-progress', 'progress', 'doing', 'wip'],
    review:     ['review', 'in review', 'testing', 'qa', 'testing/qa'],
    done:       ['done', 'closed', 'complete', 'completed', 'merged', 'resolved', 'close'],
  };
  const targets = candidates[internalStatus] ?? [internalStatus];
  for (const opt of options) {
    const lower = opt.name.toLowerCase();
    if (targets.some(t => lower === t || lower.includes(t) || t.includes(lower))) return opt.id;
  }
  return null;
}

export async function updateGithubProjectStatus(
  projectNodeId: string,
  itemId: string,
  statusFieldId: string,
  statusOptions: Array<{ id: string; name: string }>,
  internalStatus: string,
): Promise<boolean> {
  const token = getGithubToken();
  if (!token) return false;
  const optionId = findStatusOptionId(statusOptions, internalStatus);
  if (!optionId) {
    console.warn(`[GITHUB_SYNC] No project status option found for "${internalStatus}" in options: ${statusOptions.map(o => o.name).join(', ')}`);
    return false;
  }
  try {
    const res: any = await axios.post(
      'https://api.github.com/graphql',
      { query: UPDATE_PROJECT_FIELD_MUTATION, variables: { projectId: projectNodeId, itemId, fieldId: statusFieldId, optionId } },
      { headers: ghHeaders(), timeout: 10_000 }
    );
    if (res.data.errors) {
      console.error('[GITHUB_SYNC] updateProjectStatus errors:', res.data.errors);
      return false;
    }
    return true;
  } catch (err) {
    console.error('[GITHUB_SYNC] updateGithubProjectStatus failed:', (err as Error).message);
    return false;
  }
}

export async function addIssueToGithubProject(projectId: string, issueNodeId: string): Promise<string | null> {
  const token = getGithubToken();
  if (!token) return null;
  try {
    const res: any = await axios.post(
      'https://api.github.com/graphql',
      { query: ADD_ITEM_MUTATION, variables: { projectId, contentId: issueNodeId } },
      { headers: ghHeaders(), timeout: 15_000 }
    );
    if (res.data.errors) {
      console.error('[GITHUB_SYNC] addIssueToGithubProject errors:', res.data.errors);
      return null;
    }
    return res.data.data?.addProjectV2ItemById?.item?.id ?? null;
  } catch (err) {
    console.error('[GITHUB_SYNC] addIssueToGithubProject failed:', (err as Error).message);
    return null;
  }
}

// ── Public interface ──────────────────────────────────────────────────────────

export const syncProjectById = async (projectId: string): Promise<void> => {
  const project = await TrackerProject.findById(projectId);
  if (!project || !project.githubProjectId) return;
  try {
    await syncProject(project);
  } catch (err) {
    console.error(`[GITHUB_SYNC] Error syncing "${project.name}":`, (err as Error).message);
  }
};

export const runGithubSync = async (): Promise<void> => {
  if (!getGithubToken()) {
    console.log('[GITHUB_SYNC] No PERSONAL_TOKEN / GITHUB_TOKEN configured — skipping');
    return;
  }

  // Load all tracker projects that have a GitHub project ID linked
  const projects = await TrackerProject.find({
    githubProjectId: { $ne: null, $exists: true, $gt: '' }
  });

  if (projects.length === 0) {
    console.log('[GITHUB_SYNC] No projects with a GitHub project ID — skipping');
    return;
  }

  console.log(`[GITHUB_SYNC] Starting sync for ${projects.length} project(s) at ${new Date().toISOString()}`);
  for (const project of projects) {
    try {
      await syncProject(project);
    } catch (err) {
      console.error(`[GITHUB_SYNC] Error syncing "${project.name}":`, (err as Error).message);
    }
  }
  console.log('[GITHUB_SYNC] Sync complete');
};
