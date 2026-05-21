import dotenv from 'dotenv';
import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import http from 'http';
import os from 'os';
import { execSync } from 'child_process';
import mongoose from 'mongoose';
import axios from 'axios';
import connectDB from './config/database';
import { initWs } from './services/wsService';
import Endpoint from './models/Endpoint';
import Host from './models/Host';
import { checkEndpointsBatch } from './services/endpointCheckerService';
import { pullSshMetrics } from './services/hostMetricsCollector';
import { evaluateAllRules } from './services/alertEngine';
import { acquireLock, releaseLock } from './services/jobLockService';
import { runGithubSync } from './services/githubSyncService';
import { runSheetSync } from './services/trackerSheetService';

dotenv.config();

const app = express();
const httpServer = http.createServer(app);
initWs(httpServer);

// Connect to MongoDB
connectDB();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
import projectRoutes from './routes/projectRoutes';
import fileRoutes from './routes/fileRoutes';
import issueRoutes from './routes/issueRoutes';
import noteRoutes from './routes/noteRoutes';
import notificationRoutes from './routes/notificationRoutes';
import syncRoutes from './routes/syncRoutes';
import statsRoutes from './routes/statsRoutes';
import monitoringRoutes from './routes/monitoringRoutes';
import agentRoutes from './routes/agentRoutes';
import publicStatusRoutes from './routes/publicStatusRoutes';
import authRoutes from './routes/authRoutes';
import trackerRoutes from './routes/trackerRoutes';
import { authenticate } from './middleware/auth';

// Public routes (no auth required)
app.use('/api/auth', authRoutes);       // login + user management
app.use('/api/agent', agentRoutes);     // agent token auth handled inside the route
app.use('/api/public', publicStatusRoutes); // public status page

// All remaining routes require a valid JWT
app.use('/api/projects', authenticate, projectRoutes);
app.use('/api/files', authenticate, fileRoutes);
app.use('/api/issues', authenticate, issueRoutes);
app.use('/api/notes', authenticate, noteRoutes);
app.use('/api/notifications', authenticate, notificationRoutes);
app.use('/api/sync', authenticate, syncRoutes);
app.use('/api/stats', authenticate, statsRoutes);
app.use('/api/monitoring', authenticate, monitoringRoutes);
app.use('/api/tracker', authenticate, trackerRoutes);

// ── Helpers for system metrics ────────────────────────────────────────────────

const getSystemSnapshot = () => {
  const cpuLoad1m = parseFloat(os.loadavg()[0].toFixed(2));
  const memoryUsedPct = Math.round(((os.totalmem() - os.freemem()) / os.totalmem()) * 100);

  let diskUsedPct = 0;
  try {
    const out = execSync('df -k / 2>/dev/null || df -k', { timeout: 3000 }).toString();
    const line = out.trim().split('\n')[1];
    if (line) {
      const parts = line.trim().split(/\s+/);
      const used = parseInt(parts[2], 10);
      const avail = parseInt(parts[3], 10);
      if (used + avail > 0) diskUsedPct = Math.round((used / (used + avail)) * 100);
    }
  } catch { /* ignore */ }

  return { cpuLoad1m, memoryUsedPct, diskUsedPct };
};

// Health check
app.get('/api/health', async (req: Request, res: Response) => {
  type ServiceStatus = { status: 'ok' | 'down'; responseTimeMs: number; error?: string };
  const services: Record<string, ServiceStatus> = {};

  // MongoDB
  const dbStart = Date.now();
  try {
    await mongoose.connection.db!.admin().ping();
    services.database = { status: 'ok', responseTimeMs: Date.now() - dbStart };
  } catch (err) {
    services.database = { status: 'down', responseTimeMs: Date.now() - dbStart, error: (err as Error).message };
  }

  // Telegram bot (if configured)
  if (process.env.TELEGRAM_BOT_TOKEN) {
    const tgStart = Date.now();
    try {
      const r = await axios.get(
        `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/getMe`,
        { timeout: 5000 }
      );
      services.telegram = { status: r.data?.ok ? 'ok' : 'down', responseTimeMs: Date.now() - tgStart };
    } catch (err) {
      services.telegram = { status: 'down', responseTimeMs: Date.now() - tgStart, error: (err as Error).message };
    }
  }

  const statuses = Object.values(services).map(s => s.status);
  const overallStatus = statuses.every(s => s === 'ok')
    ? 'ok'
    : statuses.every(s => s === 'down')
      ? 'down'
      : 'degraded';

  res.status(overallStatus === 'down' ? 503 : 200).json({
    status: overallStatus,
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.floor(process.uptime()),
    system: getSystemSnapshot(),
    services
  });
});

// Error handling middleware
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error(err.stack);
  res.status(500).json({ 
    success: false, 
    message: err.message || 'Internal Server Error' 
  });
});

// ── In-process job scheduler ──────────────────────────────────────────────────

const runEndpointCheck = async () => {
  try {
    const locked = await acquireLock('endpoint-check', 55);
    if (!locked) return;
    const now = new Date();
    const allEndpoints = await Endpoint.find({ enabled: true });
    const due = allEndpoints.filter(ep => {
      if (!ep.lastCheckedAt) return true;
      const intervalMs = (ep.intervalMinutes || 1) * 60 * 1000;
      return now.getTime() - ep.lastCheckedAt.getTime() >= intervalMs;
    });
    if (due.length > 0) await checkEndpointsBatch(due, 20);
  } catch (err) {
    console.error('[ENDPOINT_CHECK]', (err as Error).message);
  } finally {
    await releaseLock('endpoint-check').catch(() => {});
  }
};

const runSshHostPull = async () => {
  try {
    const locked = await acquireLock('ssh-host-pull', 55);
    if (!locked) return;
    const hosts = await Host.find({ mode: 'ssh', enabled: true });
    if (hosts.length > 0) await Promise.allSettled(hosts.map(h => pullSshMetrics(h)));
  } catch (err) {
    console.error('[SSH_HOST_PULL]', (err as Error).message);
  } finally {
    await releaseLock('ssh-host-pull').catch(() => {});
  }
};

const runAlertEvaluation = async () => {
  try {
    const locked = await acquireLock('alert-evaluation', 55);
    if (!locked) return;
    await evaluateAllRules();
  } catch (err) {
    console.error('[ALERT_EVAL]', (err as Error).message);
  } finally {
    await releaseLock('alert-evaluation').catch(() => {});
  }
};

const runGithubSyncSafe = async () => {
  try {
    const locked = await acquireLock('github-sync', 280);
    if (!locked) return;
    await runGithubSync();
  } catch (err) {
    console.error('[GITHUB_SYNC]', (err as Error).message);
  } finally {
    await releaseLock('github-sync').catch(() => {});
  }
};

const runSheetSyncSafe = async () => {
  try {
    const locked = await acquireLock('sheet-sync', 14 * 60);
    if (!locked) return;
    await runSheetSync();
  } catch (err) {
    console.error('[SHEET_SYNC]', (err as Error).message);
  } finally {
    await releaseLock('sheet-sync').catch(() => {});
  }
};

const startScheduler = () => {
  // Run immediately on startup, then every 60 s
  runEndpointCheck();
  runSshHostPull();
  runAlertEvaluation();

  setInterval(runEndpointCheck, 60_000);
  setInterval(runSshHostPull, 60_000);
  setInterval(runAlertEvaluation, 60_000);

  // GitHub sync every 5 minutes
  runGithubSyncSafe();
  setInterval(runGithubSyncSafe, 5 * 60_000);

  // Google Sheets sync every 15 minutes
  runSheetSyncSafe();
  setInterval(runSheetSyncSafe, 15 * 60_000);

  console.log('⏱  In-process scheduler started (monitoring: 60s, github-sync: 5m, sheet-sync: 15m)');
};

const PORT = process.env.PORT || 5000;

httpServer.listen(PORT, async () => {
  console.log(`🚀 Server is running on port ${PORT}`);
  console.log(`📝 Note: Run note notification job separately with: npm run job:note-notifications`);
  // Wait briefly so DB connection is established before first job run
  setTimeout(startScheduler, 3000);
});

export default app;
