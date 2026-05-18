import { Router } from 'express';
import {
  listProjects, getProject, createProject, updateProject, deleteProject,
  getOverview,
  listEnvironments, createEnvironment, updateEnvironment, deleteEnvironment,
  listEndpoints, createEndpoint, updateEndpoint, deleteEndpoint,
  checkEndpointNow, getEndpointHistory, getEndpointUptime,
  listHosts, createHost, updateHost, deleteHost, rotateHostToken, getHostMetrics,
  listAlertRules, createAlertRule, updateAlertRule, deleteAlertRule, listAlertEvents
} from '../controllers/monitoringController';
import { requireAdmin, requireEditor } from '../middleware/auth';

// authenticate is already applied in server.ts before this router.
// requireEditor = editor | admin  (viewers get read-only)
// requireAdmin  = admin only      (used for project delete)

const router = Router();

router.get('/overview', getOverview);

// Projects — viewers can read; editors can create/update; only admins can delete
router.get('/projects', listProjects);
router.post('/projects', requireEditor, createProject);
router.get('/projects/:id', getProject);
router.put('/projects/:id', requireEditor, updateProject);
router.delete('/projects/:id', requireAdmin, deleteProject);
router.get('/projects/:projectId/environments', listEnvironments);
router.post('/projects/:projectId/environments', requireEditor, createEnvironment);

// Environments — editors can mutate
router.put('/environments/:id', requireEditor, updateEnvironment);
router.delete('/environments/:id', requireEditor, deleteEnvironment);
router.get('/environments/:environmentId/endpoints', listEndpoints);
router.post('/environments/:environmentId/endpoints', requireEditor, createEndpoint);
router.get('/environments/:environmentId/hosts', listHosts);
router.post('/environments/:environmentId/hosts', requireEditor, createHost);

// Endpoints — viewers read; editors write; check-now allowed for editors+
router.put('/endpoints/:id', requireEditor, updateEndpoint);
router.delete('/endpoints/:id', requireEditor, deleteEndpoint);
router.post('/endpoints/:id/check-now', requireEditor, checkEndpointNow);
router.get('/endpoints/:id/history', getEndpointHistory);
router.get('/endpoints/:id/uptime', getEndpointUptime);

// Hosts — viewers read; editors write; token rotate is editor+
router.put('/hosts/:id', requireEditor, updateHost);
router.delete('/hosts/:id', requireEditor, deleteHost);
router.post('/hosts/:id/rotate-token', requireEditor, rotateHostToken);
router.get('/hosts/:id/metrics', getHostMetrics);

// Alert rules — viewers read; editors write
router.get('/alert-rules', listAlertRules);
router.post('/alert-rules', requireEditor, createAlertRule);
router.put('/alert-rules/:id', requireEditor, updateAlertRule);
router.delete('/alert-rules/:id', requireEditor, deleteAlertRule);
router.get('/alert-events', listAlertEvents);

export default router;
