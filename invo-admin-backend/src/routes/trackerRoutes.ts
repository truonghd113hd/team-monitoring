import { Router } from 'express';
import {
  listProjects, getProject, createProject, updateProject, deleteProject,
  listIssues, getIssue, createIssue, updateIssue, deleteIssue,
  createComment, updateComment, deleteComment,
  resolveGithubProject, proxyGithubImage,
  getGoogleSheetTabs, importGoogleSheet, syncProjectNow, syncSheetNow,
  getFilterOptions, getProjectMilestones,
} from '../controllers/trackerController';

const router = Router();

// GitHub resolver + image proxy
router.get('/github/resolve', resolveGithubProject);
router.get('/github/image', proxyGithubImage);

// Google Sheets
router.get('/sheet/tabs', getGoogleSheetTabs);
router.post('/projects/:id/import-sheet', importGoogleSheet);
router.post('/projects/:id/sync', syncProjectNow);
router.post('/projects/:id/sync-sheet', syncSheetNow); // backward compat

// Projects
router.get('/projects/:id/filter-options', getFilterOptions);
router.get('/projects/:id/milestones', getProjectMilestones);
router.get('/projects', listProjects);
router.get('/projects/:id', getProject);
router.post('/projects', createProject);
router.put('/projects/:id', updateProject);
router.delete('/projects/:id', deleteProject);

// Issues
router.get('/issues', listIssues);
router.get('/issues/:id', getIssue);
router.post('/issues', createIssue);
router.put('/issues/:id', updateIssue);
router.delete('/issues/:id', deleteIssue);

// Comments
router.post('/issues/:issueId/comments', createComment);
router.put('/issues/:issueId/comments/:commentId', updateComment);
router.delete('/issues/:issueId/comments/:commentId', deleteComment);

export default router;
