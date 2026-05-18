import { Router, Request, Response } from 'express';
import MonitorProject from '../models/MonitorProject';
import MonitorEnvironment from '../models/MonitorEnvironment';
import Endpoint from '../models/Endpoint';
import Host from '../models/Host';
import EndpointCheck from '../models/EndpointCheck';
import AlertEvent from '../models/AlertEvent';
import { getEndpointUptime } from '../services/uptimeService';

const router = Router();

router.get('/status/:slug', async (req: Request, res: Response): Promise<void> => {
  try {
    const project = await MonitorProject.findOne({
      slug: req.params.slug,
      isPublic: true
    }).lean();
    if (!project) {
      res.status(404).json({ success: false, message: 'Status page not found' });
      return;
    }

    const envs = await MonitorEnvironment.find({ projectId: project._id }).lean();
    const envsWithData = await Promise.all(envs.map(async env => {
      const endpoints = await Endpoint.find({ environmentId: env._id, enabled: true }).lean();
      const endpointsWithUptime = await Promise.all(endpoints.map(async ep => {
        const uptime90 = await getEndpointUptime(String(ep._id), 90);
        // Last 24h for recent status
        const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
        const recentChecks = await EndpointCheck.find({
          endpointId: ep._id,
          checkedAt: { $gte: since }
        }).sort({ checkedAt: -1 }).limit(100).lean();
        return {
          _id: ep._id,
          name: ep.name,
          url: ep.url,
          lastStatus: ep.lastStatus,
          lastCheckedAt: ep.lastCheckedAt,
          lastResponseTimeMs: ep.lastResponseTimeMs,
          uptimePct30d: (await getEndpointUptime(String(ep._id), 30)).uptimePct,
          uptimePct90d: uptime90.uptimePct,
          timeline90d: uptime90.timeline,
          recentChecks: recentChecks.slice(0, 20)
        };
      }));

      const hosts = await Host.find({ environmentId: env._id, enabled: true })
        .select('name lastSampledAt lastCpuPct lastMemPct lastDiskPct')
        .lean();

      const firingAlerts = await AlertEvent.find({
        projectId: project._id,
        state: 'firing'
      }).sort({ firedAt: -1 }).lean();

      return {
        _id: env._id,
        name: env.name,
        color: env.color,
        endpoints: endpointsWithUptime,
        hosts,
        firingAlerts
      };
    }));

    res.json({
      success: true,
      data: {
        project: { _id: project._id, name: project.name, slug: project.slug, description: project.description },
        environments: envsWithData,
        generatedAt: new Date()
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: (err as Error).message });
  }
});

export default router;
