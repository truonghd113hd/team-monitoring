import { Request, Response } from 'express';
import crypto from 'crypto';
import mongoose from 'mongoose';
import MonitorProject from '../models/MonitorProject';
import MonitorEnvironment from '../models/MonitorEnvironment';
import Endpoint from '../models/Endpoint';
import Host from '../models/Host';
import EndpointCheck from '../models/EndpointCheck';
import HostMetric from '../models/HostMetric';
import AlertRule from '../models/AlertRule';
import AlertEvent from '../models/AlertEvent';
import { checkAndPersist } from '../services/endpointCheckerService';
import { getEndpointUptime as computeEndpointUptime } from '../services/uptimeService';

// ── Projects ──────────────────────────────────────────────

export const listProjects = async (_req: Request, res: Response): Promise<void> => {
  try {
    const projects = await MonitorProject.find().sort({ createdAt: -1 });
    res.json({ success: true, data: projects });
  } catch (err) {
    res.status(500).json({ success: false, message: (err as Error).message });
  }
};

export const getProject = async (req: Request, res: Response): Promise<void> => {
  try {
    const project = await MonitorProject.findById(req.params.id);
    if (!project) { res.status(404).json({ success: false, message: 'Project not found' }); return; }
    res.json({ success: true, data: project });
  } catch (err) {
    res.status(500).json({ success: false, message: (err as Error).message });
  }
};

export const createProject = async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, slug, description, telegramChatId, isPublic } = req.body;
    const project = await MonitorProject.create({ name, slug, description, telegramChatId, isPublic });
    res.status(201).json({ success: true, data: project });
  } catch (err) {
    res.status(500).json({ success: false, message: (err as Error).message });
  }
};

export const updateProject = async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, slug, description, telegramChatId, isPublic } = req.body;
    const project = await MonitorProject.findByIdAndUpdate(
      req.params.id,
      { name, slug, description, telegramChatId, isPublic, updatedAt: new Date() },
      { new: true, runValidators: true }
    );
    if (!project) { res.status(404).json({ success: false, message: 'Project not found' }); return; }
    res.json({ success: true, data: project });
  } catch (err) {
    res.status(500).json({ success: false, message: (err as Error).message });
  }
};

export const deleteProject = async (req: Request, res: Response): Promise<void> => {
  try {
    const project = await MonitorProject.findById(req.params.id);
    if (!project) { res.status(404).json({ success: false, message: 'Project not found' }); return; }
    const envs = await MonitorEnvironment.find({ projectId: req.params.id });
    const envIds = envs.map(e => e._id);
    const hasEndpoints = await Endpoint.countDocuments({ environmentId: { $in: envIds } });
    const hasHosts = await Host.countDocuments({ environmentId: { $in: envIds } });
    if (hasEndpoints > 0 || hasHosts > 0) {
      res.status(400).json({ success: false, message: 'Delete all endpoints and hosts first' });
      return;
    }
    await MonitorEnvironment.deleteMany({ projectId: req.params.id });
    await AlertRule.deleteMany({ projectId: req.params.id });
    await MonitorProject.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Project deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: (err as Error).message });
  }
};

// ── Overview ──────────────────────────────────────────────

export const getOverview = async (_req: Request, res: Response): Promise<void> => {
  try {
    const projects = await MonitorProject.find().sort({ name: 1 }).lean();
    const result = await Promise.all(projects.map(async p => {
      const envs = await MonitorEnvironment.find({ projectId: p._id }).lean();
      const envsWithStats = await Promise.all(envs.map(async env => {
        const endpoints = await Endpoint.find({ environmentId: env._id }).lean();
        const upCount = endpoints.filter(e => e.lastStatus === 'up').length;
        const downCount = endpoints.filter(e => e.lastStatus === 'down').length;
        const degradedCount = endpoints.filter(e => e.lastStatus === 'degraded').length;
        const unknownCount = endpoints.filter(e => e.lastStatus === 'unknown').length;
        const hosts = await Host.find({ environmentId: env._id }).lean();
        const firingCount = await AlertEvent.countDocuments({
          projectId: p._id,
          state: 'firing'
        });
        return { ...env, endpoints: { total: endpoints.length, up: upCount, down: downCount, degraded: degradedCount, unknown: unknownCount }, hosts: hosts.length, firingAlerts: firingCount };
      }));
      return { ...p, environments: envsWithStats };
    }));
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ success: false, message: (err as Error).message });
  }
};

// ── Environments ──────────────────────────────────────────

export const listEnvironments = async (req: Request, res: Response): Promise<void> => {
  try {
    const envs = await MonitorEnvironment.find({ projectId: req.params.projectId }).sort({ createdAt: 1 });
    res.json({ success: true, data: envs });
  } catch (err) {
    res.status(500).json({ success: false, message: (err as Error).message });
  }
};

export const createEnvironment = async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, color } = req.body;
    const env = await MonitorEnvironment.create({ projectId: req.params.projectId, name, color });
    res.status(201).json({ success: true, data: env });
  } catch (err) {
    res.status(500).json({ success: false, message: (err as Error).message });
  }
};

export const updateEnvironment = async (req: Request, res: Response): Promise<void> => {
  try {
    const env = await MonitorEnvironment.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!env) { res.status(404).json({ success: false, message: 'Environment not found' }); return; }
    res.json({ success: true, data: env });
  } catch (err) {
    res.status(500).json({ success: false, message: (err as Error).message });
  }
};

export const deleteEnvironment = async (req: Request, res: Response): Promise<void> => {
  try {
    const hasEndpoints = await Endpoint.countDocuments({ environmentId: req.params.id });
    const hasHosts = await Host.countDocuments({ environmentId: req.params.id });
    if (hasEndpoints > 0 || hasHosts > 0) {
      res.status(400).json({ success: false, message: 'Delete all endpoints and hosts in this environment first' });
      return;
    }
    await MonitorEnvironment.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Environment deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: (err as Error).message });
  }
};

// ── Endpoints ─────────────────────────────────────────────

export const listEndpoints = async (req: Request, res: Response): Promise<void> => {
  try {
    const endpoints = await Endpoint.find({ environmentId: req.params.environmentId }).sort({ createdAt: 1 });
    res.json({ success: true, data: endpoints });
  } catch (err) {
    res.status(500).json({ success: false, message: (err as Error).message });
  }
};

export const createEndpoint = async (req: Request, res: Response): Promise<void> => {
  try {
    const env = await MonitorEnvironment.findById(req.params.environmentId);
    if (!env) { res.status(404).json({ success: false, message: 'Environment not found' }); return; }
    const ep = await Endpoint.create({ ...req.body, environmentId: req.params.environmentId, projectId: env.projectId });
    res.status(201).json({ success: true, data: ep });
  } catch (err) {
    res.status(500).json({ success: false, message: (err as Error).message });
  }
};

export const updateEndpoint = async (req: Request, res: Response): Promise<void> => {
  try {
    const ep = await Endpoint.findByIdAndUpdate(req.params.id, { ...req.body, updatedAt: new Date() }, { new: true });
    if (!ep) { res.status(404).json({ success: false, message: 'Endpoint not found' }); return; }
    res.json({ success: true, data: ep });
  } catch (err) {
    res.status(500).json({ success: false, message: (err as Error).message });
  }
};

export const deleteEndpoint = async (req: Request, res: Response): Promise<void> => {
  try {
    await AlertRule.deleteMany({ targetType: 'endpoint', targetId: req.params.id });
    await Endpoint.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Endpoint deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: (err as Error).message });
  }
};

export const checkEndpointNow = async (req: Request, res: Response): Promise<void> => {
  try {
    const ep = await Endpoint.findById(req.params.id);
    if (!ep) { res.status(404).json({ success: false, message: 'Endpoint not found' }); return; }
    const result = await checkAndPersist(ep);
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ success: false, message: (err as Error).message });
  }
};

export const getEndpointHistory = async (req: Request, res: Response): Promise<void> => {
  try {
    const hours = parseInt(String(req.query.hours || '24'), 10);
    const page = Math.max(0, parseInt(String(req.query.page || '0'), 10));
    const limit = Math.min(20, Math.max(1, parseInt(String(req.query.limit || '20'), 10)));
    const since = new Date(Date.now() - hours * 60 * 60 * 1000);
    const filter = { endpointId: req.params.id, checkedAt: { $gte: since } };
    const [checks, total] = await Promise.all([
      EndpointCheck.find(filter).sort({ checkedAt: -1 }).skip(page * limit).limit(limit).lean(),
      EndpointCheck.countDocuments(filter)
    ]);
    res.json({ success: true, data: checks, page, limit, total });
  } catch (err) {
    res.status(500).json({ success: false, message: (err as Error).message });
  }
};

export const getEndpointUptime = async (req: Request, res: Response): Promise<void> => {
  try {
    const days = parseInt(String(req.query.days || '7'), 10);
    const data = await computeEndpointUptime(req.params.id, Math.min(days, 90));
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, message: (err as Error).message });
  }
};

// ── Hosts ─────────────────────────────────────────────────

export const listHosts = async (req: Request, res: Response): Promise<void> => {
  try {
    const hosts = await Host.find({ environmentId: req.params.environmentId }).sort({ createdAt: 1 });
    res.json({ success: true, data: hosts });
  } catch (err) {
    res.status(500).json({ success: false, message: (err as Error).message });
  }
};

export const createHost = async (req: Request, res: Response): Promise<void> => {
  try {
    const env = await MonitorEnvironment.findById(req.params.environmentId);
    if (!env) { res.status(404).json({ success: false, message: 'Environment not found' }); return; }
    const agentToken = req.body.mode === 'agent' ? crypto.randomBytes(32).toString('hex') : null;
    const host = await Host.create({ ...req.body, environmentId: req.params.environmentId, projectId: env.projectId, agentToken });
    res.status(201).json({ success: true, data: host });
  } catch (err) {
    res.status(500).json({ success: false, message: (err as Error).message });
  }
};

export const updateHost = async (req: Request, res: Response): Promise<void> => {
  try {
    const host = await Host.findByIdAndUpdate(req.params.id, { ...req.body, updatedAt: new Date() }, { new: true });
    if (!host) { res.status(404).json({ success: false, message: 'Host not found' }); return; }
    res.json({ success: true, data: host });
  } catch (err) {
    res.status(500).json({ success: false, message: (err as Error).message });
  }
};

export const deleteHost = async (req: Request, res: Response): Promise<void> => {
  try {
    await AlertRule.deleteMany({ targetType: 'host', targetId: req.params.id });
    await Host.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Host deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: (err as Error).message });
  }
};

export const rotateHostToken = async (req: Request, res: Response): Promise<void> => {
  try {
    const token = crypto.randomBytes(32).toString('hex');
    const host = await Host.findByIdAndUpdate(req.params.id, { agentToken: token, updatedAt: new Date() }, { new: true });
    if (!host) { res.status(404).json({ success: false, message: 'Host not found' }); return; }
    res.json({ success: true, data: { agentToken: token } });
  } catch (err) {
    res.status(500).json({ success: false, message: (err as Error).message });
  }
};

export const getHostMetrics = async (req: Request, res: Response): Promise<void> => {
  try {
    const hours = parseInt(String(req.query.hours || '24'), 10);
    const since = new Date(Date.now() - hours * 60 * 60 * 1000);
    const metrics = await HostMetric.find({
      hostId: req.params.id,
      sampledAt: { $gte: since }
    }).sort({ sampledAt: -1 }).limit(1440).lean();
    res.json({ success: true, data: metrics });
  } catch (err) {
    res.status(500).json({ success: false, message: (err as Error).message });
  }
};

// ── Alert Rules ───────────────────────────────────────────

export const listAlertRules = async (req: Request, res: Response): Promise<void> => {
  try {
    const { targetId, projectId } = req.query;
    const filter: any = {};
    if (targetId) filter.targetId = targetId;
    if (projectId) filter.projectId = projectId;
    const rules = await AlertRule.find(filter).sort({ createdAt: -1 });
    res.json({ success: true, data: rules });
  } catch (err) {
    res.status(500).json({ success: false, message: (err as Error).message });
  }
};

export const createAlertRule = async (req: Request, res: Response): Promise<void> => {
  try {
    const rule = await AlertRule.create(req.body);
    res.status(201).json({ success: true, data: rule });
  } catch (err) {
    res.status(500).json({ success: false, message: (err as Error).message });
  }
};

export const updateAlertRule = async (req: Request, res: Response): Promise<void> => {
  try {
    const rule = await AlertRule.findByIdAndUpdate(req.params.id, { ...req.body, updatedAt: new Date() }, { new: true });
    if (!rule) { res.status(404).json({ success: false, message: 'Alert rule not found' }); return; }
    res.json({ success: true, data: rule });
  } catch (err) {
    res.status(500).json({ success: false, message: (err as Error).message });
  }
};

export const deleteAlertRule = async (req: Request, res: Response): Promise<void> => {
  try {
    await AlertEvent.deleteMany({ ruleId: req.params.id });
    await AlertRule.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Alert rule deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: (err as Error).message });
  }
};

export const listAlertEvents = async (req: Request, res: Response): Promise<void> => {
  try {
    const { state, projectId, limit } = req.query;
    const filter: any = {};
    if (state) filter.state = state;
    if (projectId) filter.projectId = projectId;
    const events = await AlertEvent.find(filter)
      .sort({ firedAt: -1 })
      .limit(parseInt(String(limit || '50'), 10))
      .lean();
    res.json({ success: true, data: events });
  } catch (err) {
    res.status(500).json({ success: false, message: (err as Error).message });
  }
};
