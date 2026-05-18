import { Router, Request, Response } from 'express';
import Host from '../models/Host';
import { recordMetric } from '../services/hostMetricsCollector';

const router = Router();

router.post('/metrics', async (req: Request, res: Response): Promise<void> => {
  try {
    const auth = req.headers.authorization || '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
    if (!token) {
      res.status(401).json({ success: false, message: 'Missing token' });
      return;
    }
    const host = await Host.findOne({ agentToken: token, mode: 'agent', enabled: true });
    if (!host) {
      res.status(401).json({ success: false, message: 'Invalid token' });
      return;
    }
    const { cpuPct, memPct, memUsedMb, memTotalMb, disk, loadAvg, uptimeSec } = req.body;
    await recordMetric(String(host._id), 'agent', {
      cpuPct: Number(cpuPct) || 0,
      memPct: Number(memPct) || 0,
      memUsedMb: Number(memUsedMb) || 0,
      memTotalMb: Number(memTotalMb) || 0,
      disk: Array.isArray(disk) ? disk : [],
      loadAvg: Array.isArray(loadAvg) ? loadAvg : [],
      uptimeSec: Number(uptimeSec) || 0
    });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: (err as Error).message });
  }
});

export default router;
