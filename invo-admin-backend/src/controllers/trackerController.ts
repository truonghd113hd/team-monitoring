import { Request, Response } from 'express';
import mongoose from 'mongoose';
import axios from 'axios';
import TrackerProject from '../models/TrackerProject';
import TrackerIssue from '../models/TrackerIssue';
import TrackerComment from '../models/TrackerComment';
import { syncProjectById, createGithubIssue, updateGithubIssue, updateGithubProjectStatus, lookupProjectItemId, getGithubMilestones, buildGsIssueGithubBody, priorityToGithubLabel, repoFromIssueUrl, addIssueToGithubProject } from '../services/githubSyncService';
import { parseSpreadsheetId, getSheetTabs, getSheetTabsWithIds, syncSheetForProject, writeIssueToSheet, appendIssueToSheet, mapIssueInternalStatus, deriveTestcaseStatus } from '../services/trackerSheetService';
import type { IssueType } from '../models/TrackerIssue';

// ── Projects ──────────────────────────────────────────────────────────────────

export const listProjects = async (req: Request, res: Response): Promise<void> => {
  try {
    const projects = await TrackerProject.find().sort({ createdAt: -1 }).lean();
    const ids = projects.map(p => p._id as mongoose.Types.ObjectId);

    const [counts, typeCounts] = await Promise.all([
      TrackerIssue.aggregate([
        { $match: { projectId: { $in: ids } } },
        { $group: { _id: { projectId: '$projectId', status: '$status' }, count: { $sum: 1 } } }
      ]),
      TrackerIssue.aggregate([
        { $match: { projectId: { $in: ids } } },
        { $group: { _id: { projectId: '$projectId', type: '$type' } } }
      ]),
    ]);

    const countMap: Record<string, Record<string, number>> = {};
    for (const c of counts) {
      const pid = String(c._id.projectId);
      if (!countMap[pid]) countMap[pid] = { total: 0, todo: 0, inprogress: 0, review: 0, done: 0 };
      countMap[pid][c._id.status as string] = c.count;
      countMap[pid].total += c.count;
    }

    const typeMap: Record<string, Set<string>> = {};
    for (const c of typeCounts) {
      const pid = String(c._id.projectId);
      if (!typeMap[pid]) typeMap[pid] = new Set();
      typeMap[pid].add(c._id.type as string);
    }

    const data = projects.map(p => {
      const types = typeMap[String(p._id)];
      return {
        ...p,
        stats: {
          ...(countMap[String(p._id)] ?? { total: 0, todo: 0, inprogress: 0, review: 0, done: 0 }),
          hasBug: types?.has('bug') ?? false,
          hasTestcase: types?.has('testcase') ?? false,
          hasIssue: types?.has('issue') ?? false,
        }
      };
    });
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, message: (err as Error).message });
  }
};

export const getProject = async (req: Request, res: Response): Promise<void> => {
  try {
    const project = await TrackerProject.findById(req.params.id).lean();
    if (!project) { res.status(404).json({ success: false, message: 'Not found' }); return; }

    const pid = project._id as mongoose.Types.ObjectId;
    const [counts, typeCounts] = await Promise.all([
      TrackerIssue.aggregate([
        { $match: { projectId: pid } },
        { $group: { _id: '$status', count: { $sum: 1 } } }
      ]),
      TrackerIssue.aggregate([
        { $match: { projectId: pid } },
        { $group: { _id: '$type' } }
      ]),
    ]);

    const statusMap: Record<string, number> = { total: 0, todo: 0, inprogress: 0, review: 0, done: 0 };
    for (const c of counts) {
      statusMap[c._id as string] = c.count;
      statusMap.total += c.count;
    }
    const types = new Set(typeCounts.map((c: any) => c._id as string));

    res.json({
      success: true,
      data: {
        ...project,
        stats: {
          ...statusMap,
          hasBug: types.has('bug'),
          hasTestcase: types.has('testcase'),
          hasIssue: types.has('issue'),
        }
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: (err as Error).message });
  }
};

export const createProject = async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, description, color, githubProjectId, githubProjectUrl, githubRepo } = req.body;
    const project = await TrackerProject.create({
      name,
      description,
      color,
      githubProjectId: githubProjectId?.trim() || null,
      githubProjectUrl: githubProjectUrl?.trim() || null,
      githubRepo: githubRepo?.trim() || null,
    });
    res.status(201).json({ success: true, data: project });
    // Fire-and-forget initial sync if a GitHub project was linked
    if (project.githubProjectId) {
      syncProjectById(String(project._id)).catch(err =>
        console.error('[GITHUB_SYNC] Initial sync failed:', err.message)
      );
    }
  } catch (err) {
    res.status(500).json({ success: false, message: (err as Error).message });
  }
};

export const updateProject = async (req: Request, res: Response): Promise<void> => {
  try {
    const project = await TrackerProject.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!project) { res.status(404).json({ success: false, message: 'Not found' }); return; }
    res.json({ success: true, data: project });
  } catch (err) {
    res.status(500).json({ success: false, message: (err as Error).message });
  }
};

export const deleteProject = async (req: Request, res: Response): Promise<void> => {
  try {
    await TrackerProject.findByIdAndDelete(req.params.id);
    const issues = await TrackerIssue.find({ projectId: req.params.id }).select('_id').lean();
    const issueIds = issues.map(i => i._id);
    await TrackerComment.deleteMany({ issueId: { $in: issueIds } });
    await TrackerIssue.deleteMany({ projectId: req.params.id });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: (err as Error).message });
  }
};

// ── Issues ────────────────────────────────────────────────────────────────────

const PRIORITY_ORDER = ['critical', 'high', 'medium', 'low'];
const STATUS_ORDER = ['todo', 'inprogress', 'review', 'done'];

export const listIssues = async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      projectId, status, priority, type, page = '0', limit = '20',
      assignee, sheetName, iosStatus, androidStatus, statusTest, statusDev, device,
      sortBy = 'createdAt', sortDir = 'desc', search,
    } = req.query;
    const filter: Record<string, unknown> = {};
    if (projectId) filter.projectId = projectId;
    if (status && status !== 'all') filter.status = status;
    if (priority && priority !== 'all') filter.priority = priority;
    if (type && type !== 'all') filter.type = type;
    if (assignee && assignee !== 'all') filter.assignees = assignee;
    if (sheetName && sheetName !== 'all') filter.sheetName = sheetName;
    if (iosStatus && iosStatus !== 'all') filter.iosStatus = iosStatus;
    if (androidStatus && androidStatus !== 'all') filter.androidStatus = androidStatus;
    if (statusTest && statusTest !== 'all') filter.statusTest = statusTest;
    if (statusDev && statusDev !== 'all') filter.statusDev = statusDev;
    if (device && device !== 'all') filter.device = device;
    if (search && String(search).trim()) filter.title = { $regex: String(search).trim(), $options: 'i' };

    const p = Math.max(0, parseInt(String(page), 10));
    const l = Math.min(20, Math.max(1, parseInt(String(limit), 10)));
    const dir = sortDir === 'asc' ? 1 : -1;

    const total = await TrackerIssue.countDocuments(filter);
    let issues: any[];

    const sb = String(sortBy);
    if (sb === 'priority' || sb === 'status') {
      // aggregate() does not auto-cast — convert projectId string → ObjectId
      const aggFilter: Record<string, unknown> = { ...filter };
      if (aggFilter.projectId) {
        aggFilter.projectId = new mongoose.Types.ObjectId(String(aggFilter.projectId));
      }
      const orderArr = sb === 'priority' ? PRIORITY_ORDER : STATUS_ORDER;
      issues = await TrackerIssue.aggregate([
        { $match: aggFilter },
        { $addFields: { _sk: { $indexOfArray: [orderArr, `$${sb}`] } } },
        { $sort: { _sk: dir, _id: 1 } },
        { $skip: p * l },
        { $limit: l },
        { $project: { _sk: 0 } },
      ]);
    } else {
      const sortField = sb === 'id' ? 'number' : sb;
      issues = await TrackerIssue.find(filter).sort({ [sortField]: dir }).skip(p * l).limit(l).lean();
    }

    res.json({ success: true, data: issues, page: p, limit: l, total });
  } catch (err) {
    res.status(500).json({ success: false, message: (err as Error).message });
  }
};

export const getFilterOptions = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const [assignees, sheetNames] = await Promise.all([
      TrackerIssue.distinct('assignees', { projectId: id }),
      TrackerIssue.distinct('sheetName', { projectId: id, sheetName: { $ne: null } }),
    ]);
    res.json({
      success: true,
      data: {
        assignees: (assignees as string[]).filter(Boolean).sort(),
        sheetNames: (sheetNames as string[]).filter(Boolean).sort(),
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: (err as Error).message });
  }
};

export const getProjectMilestones = async (req: Request, res: Response): Promise<void> => {
  try {
    const project = await TrackerProject.findById(req.params.id).lean();
    if (!project) { res.json({ success: true, data: [] }); return; }

    // Return cached milestones if available
    if ((project as any).githubMilestones?.length) {
      res.json({ success: true, data: (project as any).githubMilestones });
      return;
    }

    // Fall back to live GitHub API if repo is known
    if (!project.githubRepo) { res.json({ success: true, data: [] }); return; }
    const milestones = await getGithubMilestones(project.githubRepo);
    // Store for next time
    if (milestones.length) {
      await TrackerProject.updateOne({ _id: project._id }, { $set: { githubMilestones: milestones } });
    }
    res.json({ success: true, data: milestones });
  } catch (err) {
    res.status(500).json({ success: false, message: (err as Error).message });
  }
};

export const getIssue = async (req: Request, res: Response): Promise<void> => {
  try {
    const issue = await TrackerIssue.findById(req.params.id).lean();
    if (!issue) { res.status(404).json({ success: false, message: 'Not found' }); return; }
    const comments = await TrackerComment.find({ issueId: req.params.id }).sort({ createdAt: 1 }).lean();
    res.json({ success: true, data: { ...issue, comments } });
  } catch (err) {
    res.status(500).json({ success: false, message: (err as Error).message });
  }
};

export const createIssue = async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      projectId, title, description, status, priority, type, assignees, syncGithub,
      milestoneNumber, milestoneTitle,
      sheetName, module, initialCondition, testStep, expectedResult, actualResult,
      evidence, severity, statusTest, statusDev, device, note, issueDate,
      testData, iosStatus, androidStatus, version, tcName,
    } = req.body;

    const last = await TrackerIssue.findOne({ projectId }).sort({ number: -1 }).lean();
    const number = (last?.number ?? 0) + 1;
    const issueType = type || 'bug';

    // Always fetch project — needed to check githubRepo even when syncGithub flag is false
    const proj = await TrackerProject.findById(projectId).lean();
    const shouldSyncGithub = syncGithub || !!(proj?.githubRepo && issueType === 'bug');

    // ── Step 1: GitHub (must succeed before DB save) ──────────────────────────
    let githubFields: { githubIssueId?: string; githubIssueUrl?: string; githubIssueNumber?: number } = {};
    console.log(`[TRACKER] createIssue: type=${issueType} syncGithub=${syncGithub} shouldSyncGithub=${shouldSyncGithub} repo=${proj?.githubRepo ?? 'none'} sheetName=${sheetName ?? 'none'}`);
    if (shouldSyncGithub && proj?.githubRepo) {
      try {
        const ghTitle = issueType === 'issue' && module ? `${module} | ${title}` : title;
        const ghBody = issueType === 'issue'
          ? buildGsIssueGithubBody({ description, initialCondition, testStep, expectedResult, actualResult, evidence, priority, severity, device, note, issueDate })
          : description || '';
        console.log(`[TRACKER] Creating GitHub issue: repo=${proj.githubRepo} title="${ghTitle}"`);
        const gh = await createGithubIssue({ repo: proj.githubRepo, title: ghTitle, body: ghBody, assignees: assignees || [], milestoneNumber: milestoneNumber ?? null, labels: [priorityToGithubLabel(priority || 'medium')] });
        if (gh) {
          githubFields = { githubIssueId: gh.id, githubIssueUrl: gh.url, githubIssueNumber: gh.number };
          console.log(`[TRACKER] GitHub issue created: #${gh.number} url=${gh.url}`);
          if (proj.githubProjectId) {
            const itemId = await addIssueToGithubProject(proj.githubProjectId, gh.id);
            if (itemId) {
              (githubFields as any).githubProjectItemId = itemId;
              console.log(`[TRACKER] Added to GitHub project: itemId=${itemId}`);
            } else {
              console.warn(`[TRACKER] Failed to add issue to GitHub project`);
            }
          }
        }
      } catch (ghErr) {
        console.error(`[TRACKER] GitHub issue creation failed:`, (ghErr as Error).message);
        res.status(502).json({ success: false, message: `GitHub issue creation failed: ${(ghErr as Error).message}` });
        return;
      }
    }

    // ── Step 2: Google Sheet (must succeed before DB save) ────────────────────
    let sheetFields: { sheetIssueId?: string; sheetRowIndex?: number } = {};
    if ((issueType === 'issue' || issueType === 'testcase') && sheetName && proj?.googleSheetId) {
      try {
        const { sheetIssueId, sheetRowIndex } = await appendIssueToSheet(
          proj.googleSheetId,
          sheetName,
          issueType as IssueType,
          {
            tcName: tcName || null,
            title, description, priority,
            initialCondition, testData, testStep, expectedResult, actualResult,
            iosStatus, androidStatus, version,
            module, evidence, severity, statusTest, statusDev, device, note, issueDate,
            assignee: Array.isArray(assignees) ? (assignees[0] ?? null) : (assignees ?? null),
          }
        );
        sheetFields = { sheetIssueId, sheetRowIndex };
        console.log(`[TRACKER] GS append: ${issueType} id=${sheetIssueId} row=${sheetRowIndex} sheet="${sheetName}"`);
      } catch (gsErr) {
        res.status(502).json({ success: false, message: `Google Sheet append failed: ${(gsErr as Error).message}` });
        return;
      }
    }

    // ── Step 3: Save to DB only after all external calls succeed ──────────────
    const issue = await TrackerIssue.create({
      projectId, number, title, description, status, priority, type: issueType, assignees,
      milestoneNumber: milestoneNumber ?? null,
      milestoneTitle: milestoneTitle ?? null,
      ...githubFields,
      ...sheetFields,
      ...(issueType === 'issue' ? {
        sheetName: sheetName || null,
        module, initialCondition, testStep, expectedResult, actualResult,
        evidence, severity, device, note, issueDate,
      } : {}),
      ...(issueType === 'testcase' ? {
        sheetName: sheetName || null,
        testData: testData || null,
        iosStatus: iosStatus || null,
        androidStatus: androidStatus || null,
        version: version || null,
        initialCondition: initialCondition || null,
        testStep: testStep || null,
        expectedResult: expectedResult || null,
        actualResult: actualResult || null,
      } : {}),
    });

    res.status(201).json({ success: true, data: issue });
  } catch (err) {
    res.status(500).json({ success: false, message: (err as Error).message });
  }
};

export const updateIssue = async (req: Request, res: Response): Promise<void> => {
  try {
    const update: Record<string, unknown> = { ...req.body };

    // For GS issues/testcases: derive status automatically; block direct status edits
    if ('statusDev' in update || 'statusTest' in update || 'iosStatus' in update || 'androidStatus' in update) {
      const existing = await TrackerIssue.findById(req.params.id).lean();
      if (existing?.type === 'issue') {
        const rawDev = ('statusDev' in update ? update.statusDev : existing.statusDev) as string ?? '';
        update.status = mapIssueInternalStatus(rawDev);
        delete update.closedAt;
      } else if (existing?.type === 'testcase') {
        const ios = ('iosStatus' in update ? update.iosStatus : existing.iosStatus) as string | null ?? null;
        const android = ('androidStatus' in update ? update.androidStatus : existing.androidStatus) as string | null ?? null;
        update.status = deriveTestcaseStatus(ios, android);
        delete update.closedAt;
      }
    }

    if (update.status === 'done') update.closedAt = new Date();
    else if ('status' in update) update.closedAt = null;

    // Fetch existing before update to compare for GitHub sync
    const existingForGh = await TrackerIssue.findById(req.params.id).lean();

    const issue = await TrackerIssue.findByIdAndUpdate(req.params.id, update, { new: true });
    if (!issue) { res.status(404).json({ success: false, message: 'Not found' }); return; }
    res.json({ success: true, data: issue });

    // Sync editable fields to GitHub for any GitHub-linked issue
    if (existingForGh?.githubIssueNumber && existingForGh?.githubIssueUrl) {
      const proj = await TrackerProject.findById(issue.projectId).lean();
      const repo = proj?.githubRepo || repoFromIssueUrl(existingForGh.githubIssueUrl);
      console.log(`[TRACKER] GitHub sync: issue #${existingForGh.githubIssueNumber} repo=${repo} status=${update.status}`);
      if (repo) {
        (async () => {
          try {
            const ghOpts: Parameters<typeof updateGithubIssue>[2] = {};
            if ('status' in update && update.status !== existingForGh.status)
              ghOpts.state = update.status === 'done' ? 'closed' : 'open';
            if ('milestoneNumber' in update && update.milestoneNumber !== existingForGh.milestoneNumber)
              ghOpts.milestoneNumber = (update.milestoneNumber as number | null) ?? null;
            if ('title' in update && update.title !== existingForGh.title)
              ghOpts.title = update.title as string;
            if ('description' in update && update.description != null)
              ghOpts.body = update.description as string;
            if ('assignees' in update)
              ghOpts.assignees = (update.assignees as string[]) ?? [];
            const ok = await updateGithubIssue(repo, existingForGh.githubIssueNumber!, ghOpts);
            console.log(`[TRACKER] GitHub sync result: ${ok ? 'ok' : 'failed'} opts=${JSON.stringify(ghOpts)}`);

            // Update the project board Status field when status changes
            if ('status' in update && update.status !== existingForGh.status) {
              let itemId: string | null = (existingForGh as any).githubProjectItemId ?? null;
              const fieldId: string | null = (proj as any)?.githubStatusFieldId ?? null;
              const options: Array<{ id: string; name: string }> = (proj as any)?.githubStatusOptions ?? [];
              if (!itemId && (existingForGh as any).githubIssueId && proj?.githubProjectId) {
                // Issue was synced before githubProjectItemId was added — look it up now and save
                itemId = await lookupProjectItemId((existingForGh as any).githubIssueId, proj.githubProjectId);
                if (itemId) {
                  await TrackerIssue.updateOne({ _id: existingForGh._id }, { $set: { githubProjectItemId: itemId } });
                  console.log(`[TRACKER] Resolved missing githubProjectItemId=${itemId} for issue #${existingForGh.githubIssueNumber}`);
                }
              }
              if (itemId && fieldId && options.length && proj?.githubProjectId) {
                const boardOk = await updateGithubProjectStatus(
                  proj.githubProjectId, itemId, fieldId, options, update.status as string
                );
                console.log(`[TRACKER] GitHub board status update: ${boardOk ? 'ok' : 'failed'} status=${update.status}`);
              } else {
                console.warn(`[TRACKER] GitHub board status skipped: itemId=${itemId} fieldId=${fieldId} optionsCount=${options.length}`);
              }
            }
          } catch (ghErr) {
            console.error('[TRACKER] GitHub update failed:', (ghErr as Error).message);
          }
        })();
      } else {
        console.warn(`[TRACKER] GitHub sync skipped: could not resolve repo from url=${existingForGh.githubIssueUrl}`);
      }
    }

    // Write back to Google Sheet asynchronously if linked
    if (issue.sheetRowIndex != null) {
      const project = await TrackerProject.findById(issue.projectId);
      const sheetName = (issue as any).sheetName ?? null;
      if (project?.googleSheetId && sheetName) {
        writeIssueToSheet(
          project.googleSheetId,
          sheetName,
          issue.sheetRowIndex,
          (project.googleSheetColMap ?? {}) as Record<string, number>,
          issue.type as IssueType,
          {
            title: typeof update.title === 'string' ? update.title : undefined,
            description: typeof update.description === 'string' ? update.description : undefined,
            status: typeof update.status === 'string' ? update.status : undefined,
            priority: typeof update.priority === 'string' ? update.priority : undefined,
            assignees: Array.isArray(update.assignees) ? update.assignees as string[] : undefined,
            actualResult: 'actualResult' in update ? update.actualResult as string : undefined,
            iosStatus: 'iosStatus' in update ? update.iosStatus as string : undefined,
            androidStatus: 'androidStatus' in update ? update.androidStatus as string : undefined,
            version: 'version' in update ? update.version as string : undefined,
            initialCondition: 'initialCondition' in update ? update.initialCondition as string : undefined,
            testData: 'testData' in update ? update.testData as string : undefined,
            testStep: 'testStep' in update ? update.testStep as string : undefined,
            expectedResult: 'expectedResult' in update ? update.expectedResult as string : undefined,
            // issue-specific
            module: 'module' in update ? update.module as string : undefined,
            evidence: 'evidence' in update ? update.evidence as string : undefined,
            severity: 'severity' in update ? update.severity as string : undefined,
            statusTest: 'statusTest' in update ? update.statusTest as string : undefined,
            statusDev: 'statusDev' in update ? update.statusDev as string : undefined,
            device: 'device' in update ? update.device as string : undefined,
            note: 'note' in update ? update.note as string : undefined,
            issueDate: 'issueDate' in update ? update.issueDate as string : undefined,
          }
        ).catch(err => console.error('[SHEET_WRITE_BACK]', err.message));
      }
    }
  } catch (err) {
    res.status(500).json({ success: false, message: (err as Error).message });
  }
};

export const deleteIssue = async (req: Request, res: Response): Promise<void> => {
  try {
    await TrackerIssue.findByIdAndDelete(req.params.id);
    await TrackerComment.deleteMany({ issueId: req.params.id });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: (err as Error).message });
  }
};

// ── Comments ──────────────────────────────────────────────────────────────────

export const createComment = async (req: Request, res: Response): Promise<void> => {
  try {
    const author = (req as any).user?.name ?? 'Unknown';
    const comment = await TrackerComment.create({ issueId: req.params.issueId, author, body: req.body.body });
    res.status(201).json({ success: true, data: comment });
  } catch (err) {
    res.status(500).json({ success: false, message: (err as Error).message });
  }
};

export const updateComment = async (req: Request, res: Response): Promise<void> => {
  try {
    const comment = await TrackerComment.findByIdAndUpdate(req.params.commentId, { body: req.body.body }, { new: true });
    if (!comment) { res.status(404).json({ success: false, message: 'Not found' }); return; }
    res.json({ success: true, data: comment });
  } catch (err) {
    res.status(500).json({ success: false, message: (err as Error).message });
  }
};

export const deleteComment = async (req: Request, res: Response): Promise<void> => {
  try {
    await TrackerComment.findByIdAndDelete(req.params.commentId);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: (err as Error).message });
  }
};

// ── Google Sheets ─────────────────────────────────────────────────────────────

export const getGoogleSheetTabs = async (req: Request, res: Response): Promise<void> => {
  const url = String(req.query.url || '');
  if (!url) { res.status(400).json({ success: false, message: 'url query param required' }); return; }
  const spreadsheetId = parseSpreadsheetId(url);
  if (!spreadsheetId) { res.status(400).json({ success: false, message: 'Invalid Google Sheets URL' }); return; }
  try {
    const tabs = await getSheetTabs(spreadsheetId);
    res.json({ success: true, data: { spreadsheetId, tabs } });
  } catch (err) {
    res.status(500).json({ success: false, message: (err as Error).message });
  }
};

export const importGoogleSheet = async (req: Request, res: Response): Promise<void> => {
  try {
    const { googleSheetUrl } = req.body;
    if (!googleSheetUrl) { res.status(400).json({ success: false, message: 'googleSheetUrl required' }); return; }
    const spreadsheetId = parseSpreadsheetId(googleSheetUrl);
    if (!spreadsheetId) { res.status(400).json({ success: false, message: 'Invalid Google Sheets URL' }); return; }

    // Verify the sheet is accessible and store tab gids for tab-specific URLs
    let googleSheetTabs: Array<{ name: string; sheetId: number }> = [];
    try {
      googleSheetTabs = await getSheetTabsWithIds(spreadsheetId);
    } catch (err) {
      res.status(400).json({ success: false, message: 'Cannot access Google Sheet — check sharing permissions' }); return;
    }

    const project = await TrackerProject.findByIdAndUpdate(
      req.params.id,
      { $set: { googleSheetUrl, googleSheetId: spreadsheetId, googleSheetTabs } },
      { new: true }
    );
    if (!project) { res.status(404).json({ success: false, message: 'Project not found' }); return; }

    res.json({ success: true, data: project });
    syncSheetForProject(project).catch(err => console.error('[SHEET_IMPORT]', err.message));
  } catch (err) {
    res.status(500).json({ success: false, message: (err as Error).message });
  }
};

// Unified sync: handles GitHub and/or Google Sheet for a project
export const syncProjectNow = async (req: Request, res: Response): Promise<void> => {
  try {
    const project = await TrackerProject.findById(req.params.id);
    if (!project) { res.status(404).json({ success: false, message: 'Project not found' }); return; }
    if (!project.githubProjectId && !project.googleSheetId) {
      res.status(400).json({ success: false, message: 'No GitHub project or Google Sheet linked' }); return;
    }
    res.json({ success: true, message: 'Sync started' });
    if (project.githubProjectId) {
      syncProjectById(String(project._id)).catch(err => console.error('[SYNC_NOW_GITHUB]', err.message));
    }
    if (project.googleSheetId) {
      syncSheetForProject(project).catch(err => console.error('[SYNC_NOW_SHEET]', err.message));
    }
  } catch (err) {
    res.status(500).json({ success: false, message: (err as Error).message });
  }
};

// Keep for backward compat
export const syncSheetNow = syncProjectNow;

// ── GitHub project resolver ───────────────────────────────────────────────────

function parseGithubProjectUrl(raw: string): { login: string; number: number; type: 'org' | 'user' } | null {
  try {
    const u = new URL(raw.trim());
    if (u.hostname !== 'github.com') return null;
    // Strip trailing segments after the project number (views/1, etc.)
    const parts = u.pathname.split('/').filter(Boolean);
    // /orgs/{org}/projects/{n}  or  /users/{user}/projects/{n}  or  /{user}/projects/{n}
    const projectIdx = parts.indexOf('projects');
    if (projectIdx < 0) return null;
    const number = parseInt(parts[projectIdx + 1], 10);
    if (!number || isNaN(number)) return null;
    const segment0 = parts[0]; // 'orgs' | 'users' | login
    const login = parts[projectIdx - 1];
    const type = segment0 === 'orgs' ? 'org' : 'user';
    if (!login) return null;
    return { login, number, type };
  } catch {
    return null;
  }
}

const GH_HEADERS = {
  'Content-Type': 'application/json',
  'X-GitHub-Api-Version': '2022-11-28',
};

export const resolveGithubProject = async (req: Request, res: Response): Promise<void> => {
  const url = String(req.query.url || '');
  if (!url) {
    res.status(400).json({ success: false, message: 'url query param is required' });
    return;
  }

  const GITHUB_TOKEN = process.env.PERSONAL_TOKEN || process.env.GITHUB_TOKEN;
  if (!GITHUB_TOKEN) {
    res.status(400).json({ success: false, message: 'GitHub token not configured on server (PERSONAL_TOKEN)' });
    return;
  }

  const parsed = parseGithubProjectUrl(url);
  if (!parsed) {
    res.status(400).json({ success: false, message: 'Invalid GitHub project URL. Expected: https://github.com/orgs/{org}/projects/{number}' });
    return;
  }

  const ORG_QUERY = `
    query($login: String!, $number: Int!) {
      organization(login: $login) {
        projectV2(number: $number) { id title shortDescription }
      }
    }`;
  const USER_QUERY = `
    query($login: String!, $number: Int!) {
      user(login: $login) {
        projectV2(number: $number) { id title shortDescription }
      }
    }`;

  // Try primary type first, then fall back to the other
  const attempts = parsed.type === 'org'
    ? [{ query: ORG_QUERY, key: 'organization' }, { query: USER_QUERY, key: 'user' }]
    : [{ query: USER_QUERY, key: 'user' }, { query: ORG_QUERY, key: 'organization' }];

  try {
    for (const { query, key } of attempts) {
      const response: any = await axios.post(
        'https://api.github.com/graphql',
        { query, variables: { login: parsed.login, number: parsed.number } },
        { headers: { Authorization: `Bearer ${GITHUB_TOKEN}`, ...GH_HEADERS }, timeout: 10_000 }
      );
      const project = response.data.data?.[key]?.projectV2;
      if (project) {
        res.json({
          success: true,
          data: {
            githubProjectId: project.id,
            githubProjectUrl: url,
            title: project.title,
            description: project.shortDescription || ''
          }
        });
        return;
      }
    }
    res.status(404).json({ success: false, message: 'Project not found. Make sure the token has access to this project.' });
  } catch (err) {
    res.status(500).json({ success: false, message: (err as Error).message });
  }
};

// ── GitHub image proxy ────────────────────────────────────────────────────────

export const proxyGithubImage = async (req: Request, res: Response): Promise<void> => {
  const url = req.query.url as string;
  if (!url || !url.startsWith('https://github.com/')) {
    res.status(400).json({ success: false, message: 'Invalid URL' });
    return;
  }
  try {
    const token = process.env.PERSONAL_TOKEN || process.env.GITHUB_TOKEN || '';
    const response = await axios.get(url, {
      responseType: 'stream',
      headers: {
        Authorization: token ? `Bearer ${token}` : '',
        Accept: 'image/*,*/*',
        'User-Agent': 'invo-admin/1.0',
      },
      timeout: 15_000,
    });
    const contentType = (response.headers['content-type'] as string) || 'image/png';
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=86400');
    (response.data as NodeJS.ReadableStream).pipe(res);
  } catch (err: any) {
    res.status(502).json({ success: false, message: 'Failed to fetch image from GitHub' });
  }
};
